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


function NodeWebCLContext(options) {
    this.id = options.id;
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
    this.kernels = webclCommon.createKernels(this.program);
}

var count = 0;
var server = ws.createServer({port: 8081});
server.on("connection", function(connection) {

    connection.connectionContext = new NodeWebCLContext({id: count});
    count++;
//    console.log(connection.connectionContext);

    connection.on("message", function(message) {
        var request = Request.decode(message);
        switch (request.type) {
            case Request.Type.EMPTY_ARRAY:
                break;
            case Request.Type.DATA_ARRAY:
                var dataArrayRequest = request.dataArrayRequest;
//                console.log("About to create array");
//                console.log(connection.connectionContext);
                createDataArray(
                    dataArrayRequest.idOut,
                    dataArrayRequest.shape,
                    dataTypeMap[dataArrayRequest.dataType],
                    dataArrayRequest.dataBuffer.toArrayBuffer(),
                    connection.connectionContext
                );
                break;
            case Request.Type.CONST_ARRAY:
                break;
            case Request.Type.IDENTITY_MATRIX:
                break;
            case Request.Type.LINSPACE:
                break;
            case Request.Type.RESHAPE:
                break;
            case Request.Type.REPEAT:
                break;
            case Request.Type.DEALLOCATE:
                break;
            case Request.Type.FETCH:
                var fetchRequest = request.fetchRequest;
                var requestId = request.id;
                var idA = fetchRequest.idA;
                var response = fetch(requestId, idA, connection.connectionContext);
                connection.send(response);
                break;
            case Request.Type.BARRIER:
                break;
            case Request.Type.INFO:
                break;
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

function createDataArray(idOut, shape, dataType, dataBuffer, nodeWebCLContext) {
    if (idOut in nodeWebCLContext.idMap) {
        throw new Error("Invalid output ID");
    }
    if (typeof dataType === "undefined") {
        dataType = new DataType("f64");
    } else {
        dataType = util.checkDataType(dataType);
    }
    var arrayOut = {
        buffer: nodeWebCLContext.context.createBuffer(nodeWebCL.MEM_READ_WRITE, dataBuffer.byteLength),
        shape: shape,
        dataType: dataType
    };
    nodeWebCLContext.queue.enqueueWriteBuffer(arrayOut.buffer, false, 0, dataBuffer.byteLength, dataBuffer);
    console.log(arrayOut);
    nodeWebCLContext.idMap[idOut] = arrayOut;
}

function fetch(requestId, id, nodeWebCLContext) {
    var response = new Response();
    response.id = requestId;
    response.type = Response.Type.FETCH;
    var fetchResponse = new FetchResponse();
    console.log(nodeWebCLContext.idMap[Math.abs(id)]);
    fetchResponse.dataBuffer = nodeWebCLContext.idMap[Math.abs(id)].buffer;
    if (typeof fetchResponse.dataBuffer === "undefined") {
        throw new Error("Invalid output ID");
    }
    response.fetchResponse = fetchResponse;
    return response.encodeAB();
}