var ws = require("ws");
var requests = require("./requests.pb");
var Request = requests.Request;
var EmptyArrayRequest = requests.EmptyArrayRequest;
var DataArrayRequest = requests.DataArrayRequest;
var ConstArrayRequest = requests.ConstArrayRequest;
var LinspaceRequest = requests.LinspaceRequest;
var ReshapeRequest = requests.ReshapeRequest;
var RepeatRequest = requests.RepeatRequest;
var DeallocateRequest = requests.DeallocateRequest;
var FetchRequest = requests.FetchRequest;
var BinaryOperationRequest = requests.BinaryOperationRequest;
var BinaryConstOperationRequest = requests.BinaryConstOperationRequest;
var UnaryOperationRequest = requests.UnaryOperationRequest;
var ReductionRequest = requests.ReductionRequest;
var AxisReductionRequest = requests.AxisReductionRequest;
var DotOperationRequest = requests.DotOperationRequest;
var responses = require("./responses.pb");
var Response = responses.Response;
var FetchResponse = responses.FetchResponse;
var ErrorResponse = responses.ErrorResponse;
var InitResponse = responses.InitResponse;
var InfoResponse = responses.InfoResponse;
var util = require("./util");
var webclCommon = require("./webcl/WebCLCommon");
var DataType = require("./DataType");
var fs = require("fs");
var NDArray = require("./NDArray");
var nodeWebCL = null;

var dataTypeMap = {};
dataTypeMap[requests.DataType.FLOAT64] = new DataType("f64");
dataTypeMap[requests.DataType.FLOAT32] = new DataType("f32");

function ConnectionContext(options) {
    options = options || {};
    nodeWebCL = webclCommon.initWebCL();
    var binaryKernelsSource = fs.readFileSync(__dirname + "/webcl/binaryKernels.cl", "utf8");
    var unaryKernelsSource = fs.readFileSync(__dirname + "/webcl/unaryKernels.cl", "utf8");
    var reductionKernelsSource = fs.readFileSync(__dirname + "/webcl/reductionKernels.cl", "utf8");
    var axisReductionKernelsSource = fs.readFileSync(__dirname + "/webcl/axisReductionKernels.cl", "utf8");
    var productKernelsSource = fs.readFileSync(__dirname + "/webcl/productKernels.cl", "utf8");
    var utilKernelsSource = fs.readFileSync(__dirname + "/webcl/utilKernels.cl", "utf8");
    var source = binaryKernelsSource + unaryKernelsSource +
        reductionKernelsSource + axisReductionKernelsSource +
        productKernelsSource + utilKernelsSource;

    this.asyncCallbacks = true;
    this.idMap = {};
    this.clContext = new nodeWebCL.WebCLContext();
    var deviceName = options.device;
    if (deviceName) {
        var deviceIndex = webclCommon.availableDevicesDescriptions.indexOf(deviceName);
        if (deviceIndex === -1) {
            throw new Error("Invalid NodeWebCL device name: " + deviceName);
        }
        this.device = webclCommon.availableDevices[deviceIndex];
    } else {
        var deviceIndex = webclCommon.getDefaultDeviceIndex();
        if (deviceIndex < 0) {
            throw new Error("No Suitable WebCL device found");
        }
        this.device = webclCommon.availableDevices[deviceIndex];
    }
    this.device.enableExtension("KHR_fp64");
    this.deviceInfo = {
        deviceClass: webclCommon.classifyDevice(this.device),
        localMemorySize: this.device.getInfo(nodeWebCL.DEVICE_LOCAL_MEM_SIZE),
        maxComputeUnits: this.device.getInfo(nodeWebCL.DEVICE_MAX_COMPUTE_UNITS),
        maxWorkGroupSize: this.device.getInfo(nodeWebCL.DEVICE_MAX_WORK_GROUP_SIZE),
        maxWorkItemSizes: this.device.getInfo(nodeWebCL.DEVICE_MAX_WORK_ITEM_SIZES)
    };
    this.context = nodeWebCL.createContext(this.device);
    this.queue = this.context.createCommandQueue(this.device);
    this.program = this.context.createProgram(source);
    this.program.build();
    console.log(this.program);
    this.kernels = webclCommon.createKernels(this.program);
}

ConnectionContext.prototype.createDataArray = function(requestId, idOut, shape, dataType, dataBuffer) {
    if (idOut in this.idMap) {
        console.error("Error: invalid output ID in createDataArray")
        return;
    }
    dataType = util.checkDataType(dataType);
    var buffer = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, dataBuffer.byteLength);
    // TODO: use non-blocking write
    this.queue.enqueueWriteBuffer(buffer, true, 0, dataBuffer.byteLength, dataBuffer);
    var arrayOut = {
        buffer: buffer,
        shape: shape,
        length: util.computeLength(shape),
        dataType: dataType
    };
    this.idMap[idOut] = arrayOut;
}

ConnectionContext.prototype.linspace = function (requestId, idOut, start, stop, samples, closed, dataType) {
    if (idOut in this.idMap) {
        throw new Error("Invalid output ID");
    }
    if (!isFinite(start)) {
        throw new TypeError("start is not a real number");
    }
    if (!isFinite(stop)) {
        throw new TypeError("stop is not a real number");
    }
    if (samples === 0) {
        throw new RangeError("The number of samples must be positive");
    } else if (closed && (samples === 1)) {
        throw new RangeError("The number of samples must be a least 2 (for start and end points)");
    }

    dataType = util.checkDataType(dataType);
    var array = new NDArray([samples], dataType, this);
    array._buffer = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, samples * dataType.size);

    var range = stop - start;
    var n = (closed) ? samples - 1 : samples;
    var step = range / n;

    var kernel = this.kernels.linspace[dataType.type];

    kernel.setArg(0, new Uint32Array([array.length]));
    kernel.setArg(1, array._buffer);
    kernel.setArg(2, new dataType.arrayType([start]));
    kernel.setArg(3, new dataType.arrayType([step]));
    this.queue.enqueueNDRangeKernel(kernel, 1, null, [array.length], null);
    this.idMap[idOut] = array;

    return array;
}

ConnectionContext.prototype.deallocate = function deallocate(requestId, idA) {
    var arrayA = this.idMap[idA];
    if (typeof arrayA === "undefined") {
        console.error("Error: invalid input ID in deallocate");
        return;
    }
    arrayA.buffer.release();
    delete this.idMap[idA];
}

ConnectionContext.prototype.fetch = function fetch(requestId, idA) {
    var arrayA = this.idMap[Math.abs(idA)];
    if (typeof arrayA === "undefined") {
        console.error("Error: invalid input ID in fetch");
        return null;
    }

    var dataBuffer = new arrayA.dataType.arrayType(arrayA.length);
    // TODO: use non-blocking read
    this.queue.enqueueReadBuffer(arrayA.buffer, true, 0, dataBuffer.byteLength, dataBuffer);

    var response = new Response();
    response.id = requestId;
    response.type = Response.Type.FETCH;
    var fetchResponse = new FetchResponse();
    fetchResponse.dataBuffer = dataBuffer.buffer;
    response.fetchResponse = fetchResponse;
    var message = response.encodeAB();

    if (idA < 0) {
        arrayA.buffer.release();
        delete this.idMap[-idA];
    }

    return message;
}

var server = ws.createServer({port: 8081});
server.on("connection", function(connection) {
    connection.connectionContext = new ConnectionContext();
    console.info("INFO: CONNECTED");
    connection.on("message", function(message, flags) {
        var request = Request.decode(message);
        switch (request.type) {
            case Request.Type.EMPTY_ARRAY:
                break;
            case Request.Type.DATA_ARRAY:
                var dataArrayRequest = request.dataArrayRequest;
                connection.connectionContext.createDataArray(request.id,
                    dataArrayRequest.idOut,
                    dataArrayRequest.shape,
                    dataTypeMap[dataArrayRequest.dataType],
                    dataArrayRequest.dataBuffer.toArrayBuffer());
                break;
            case Request.Type.CONST_ARRAY:
                break;
            case Request.Type.IDENTITY_MATRIX:
                break;
            // TODO
            case Request.Type.LINSPACE:
                var linspaceRequest = request.linspaceRequest;
                connection.connectionContext.linspace(request.id,
                         linspaceRequest.idOut,
                         linspaceRequest.start,
                         linspaceRequest.stop,
                         linspaceRequest.samples,
                         linspaceRequest.closed,
                         dataTypeMap[linspaceRequest.dataType]);
                break;
            // TODO
            case Request.Type.RESHAPE:
                var reshapeRequest = request.reshapeRequest;
                connection.connectionContext.reshape(reshapeRequest.idA,
                    reshapeRequest.shapeOut);
                break;
            case Request.Type.REPEAT:
                break;
            case Request.Type.DEALLOCATE:
                var deallocateRequest = request.deallocateRequest;
                connection.connectionContext.deallocate(request.id,
                    deallocateRequest.idA);
                break;
            case Request.Type.FETCH:
                var fetchRequest = request.fetchRequest;
                var response = connection.connectionContext.fetch(request.id,
                    fetchRequest.idA);
                if (response !== null) {
                    connection.send(response, {binary: true});
                }
                break;
            case Request.Type.BARRIER:
                break;
            case Request.Type.INFO:
                break;
            // TODO
            case Request.Type.BINARY_OPERATION:
                break;
            case Request.Type.BINARY_CONST_OPERATION:
                break;
            case Request.Type.UNARY_OPERATION:
                break;
            case Request.Type.REDUCTION_OPERATION:
                break;
            case Request.Type.AXIS_REDUCTION_OPERATION:
                break;
            case Request.Type.DOT_OPERATION:
                break;
            case Request.Type.CHOLESKY_DECOMPOSITION:
                break;
            case Request.Type.SOLVE_TRIANGULAR:
                break;
        }
    });

});
