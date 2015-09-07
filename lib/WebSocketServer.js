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
var WebCLMath = require("./webcl/WebCLMath");
var DataType = require("./DataType");
var fs = require("fs");
var nodeWebCL = null;
var nopt = require("nopt");

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
	this.kernels = webclCommon.createKernels(this.program);
	this.clmath = new WebCLMath(nodeWebCL, this.deviceInfo, this.program);
	this.binaryOperationMap = {};
	this.binaryOperationMap[BinaryOperationRequest.Type.ADD] = this.clmath.add.bind(this.clmath);
	this.binaryOperationMap[BinaryOperationRequest.Type.SUB] = this.clmath.sub.bind(this.clmath);
	this.binaryOperationMap[BinaryOperationRequest.Type.MUL] = this.clmath.mul.bind(this.clmath);
	this.binaryOperationMap[BinaryOperationRequest.Type.DIV] = this.clmath.div.bind(this.clmath);
	this.binaryConstOperationMap = {};
	this.binaryConstOperationMap[BinaryConstOperationRequest.Type.ADDC]  = this.clmath.addConst.bind(this.clmath);
	this.binaryConstOperationMap[BinaryConstOperationRequest.Type.SUBC]  = this.clmath.subConst.bind(this.clmath);
	this.binaryConstOperationMap[BinaryConstOperationRequest.Type.SUBRC] = this.clmath.subRevConst.bind(this.clmath);
	this.binaryConstOperationMap[BinaryConstOperationRequest.Type.MULC]  = this.clmath.mulConst.bind(this.clmath);
	this.binaryConstOperationMap[BinaryConstOperationRequest.Type.DIVC]  = this.clmath.divConst.bind(this.clmath);
	this.binaryConstOperationMap[BinaryConstOperationRequest.Type.DIVRC] = this.clmath.divRevConst.bind(this.clmath);
	this.unaryOperationMap = {};
	this.unaryOperationMap[UnaryOperationRequest.Type.NEG]    = this.clmath.neg.bind(this.clmath);
	this.unaryOperationMap[UnaryOperationRequest.Type.ABS]    = this.clmath.abs.bind(this.clmath);
	this.unaryOperationMap[UnaryOperationRequest.Type.EXP]    = this.clmath.exp.bind(this.clmath);
	this.unaryOperationMap[UnaryOperationRequest.Type.LOG]    = this.clmath.log.bind(this.clmath);
	this.unaryOperationMap[UnaryOperationRequest.Type.SQRT]   = this.clmath.sqrt.bind(this.clmath);
	this.unaryOperationMap[UnaryOperationRequest.Type.SQUARE] = this.clmath.square.bind(this.clmath);
}

ConnectionContext.prototype.createEmptyArray = function(requestId, idOut, shape, dataType) {
	if (idOut in this.idMap) {
		console.error("Empty Array: Invalid ID");
		return;
	}
	dataType = util.checkDataType(dataType);
	var length = util.computeLength(shape);
	var buffer = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, dataType.size * length);
	var arrayOut = {
		buffer: buffer,
		shape: shape,
		length: length,
		dataType: dataType
	};
	this.idMap[idOut] = arrayOut;
};

ConnectionContext.prototype.createDataArray = function(requestId, idOut, shape, dataType, dataBuffer) {
	if (idOut in this.idMap) {
		console.error("Error: invalid output ID in CREATE_DATA_ARRAY request");
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
};

ConnectionContext.prototype.createConstArray = function(requestId, idOut, shape, dataType, fillValue) {
	if (idOut in this.idMap) {
		console.error("Const Array: Invalid idOut");
		return;
	}
	dataType = util.checkDataType(dataType);
	var length = util.computeLength(shape);
	var buffer = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, dataType.size * length);
	var kernel = this.kernels.set[dataType.type];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, buffer);
	kernel.setArg(2, new dataType.arrayType([fillValue]));
	this.queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
	var arrayOut = {
		buffer: buffer,
		shape: shape,
		length: length,
		dataType: dataType
	};

	this.idMap[idOut] = arrayOut;

};

ConnectionContext.prototype.createIdentityMatrix = function(requestId, idOut, rows, columns, diagonal, dataType) {
    if (idOut in this.idMap) {
       console.error("Identity Matrix Error: Invalid idOut");
       return;
    }
    dataType = util.checkDataType(dataType);
	var buffer = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, dataType.size * rows * columns);
    var kernel = this.kernels.eye[dataType.type];
    kernel.setArg(0, new Uint32Array([rows]));
    kernel.setArg(1, new Uint32Array([columns]));
    kernel.setArg(2, new Uint32Array([diagonal]));
    kernel.setArg(3, buffer);
    this.queue.enqueueNDRangeKernel(kernel, 2, null, [rows, columns], null);
    var arrayOut = {
        buffer: buffer,
        shape: [rows, columns],
        length: rows*columns,
        dataType: dataType
    };

    this.idMap[idOut] = arrayOut;
};

ConnectionContext.prototype.linspace = function(requestId, idOut, start, stop, samples, closed, dataType) {
	if (idOut in this.idMap) {
		console.error("Error: invalid output ID in LINSPACE request");
		return;
	}
	if (!isFinite(start)) {
		console.error("Error: start is not a real number in LINSPACE request");
		return;
	}
	if (!isFinite(stop)) {
		console.error("Error: stop is not a real number in LINSPACE request");
		return;
	}
	if (samples === 0) {
		console.error("Error: the number of samples is zero in LINSPACE request");
		return;
	} else if (closed && (samples === 1)) {
		console.error("Error: not enough samples for a closed interval in LINSPACE request");
		return;
	}

	dataType = util.checkDataType(dataType);
	var buffer = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, samples * dataType.size);

	var range = stop - start;
	var n = (closed) ? samples - 1 : samples;
	var step = range / n;

	var kernel = this.kernels.linspace[dataType.type];
	kernel.setArg(0, new Uint32Array([samples]));
	kernel.setArg(1, buffer);
	kernel.setArg(2, new dataType.arrayType([start]));
	kernel.setArg(3, new dataType.arrayType([step]));
	this.queue.enqueueNDRangeKernel(kernel, 1, null, [samples], null);

	var arrayOut = {
		buffer: buffer,
		shape: new Uint32Array([samples]),
		length: samples,
		dataType: dataType
	};
	this.idMap[idOut] = arrayOut;
};

ConnectionContext.prototype.reshape = function(requestId, idA, idOut, shapeOut) {
	var array = this.idMap[Math.abs(idA)];
	if (typeof array === "undefined") {
		console.error("Reshape Error: Invalid input ID");
		return;
	}
	if (array.length !== util.computeLength(shapeOut)) {
		console.error("Reshape Error: Incompatible length");
		return;
	}
	var arrayOut = this.idMap[idOut];
	if (typeof arrayOut !== "undefined") {
		if (arrayOut.length !== array.length) {
			console.error("Reshape Error: Incompatible Length");
			return;
		}
		if (!arrayOut.dataType.equals(array.dataType)) {
			console.error("Reshape Error: Incompatible data type");
			return;
		}

		arrayOut.shape = shapeOut;

		if (arrayOut !== array) {
			this.queue.enqueueCopyBuffer(array.buffer, arrayOut.buffer, 0, 0, arrayOut.dataType.size * arrayOut.length);
		}
		if (idA < 0) {
			this.deallocate(requestId, -idA);
		}
	} else {
		var buffer = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, array.length * array.dataType.size);
		this.queue.enqueueCopyBuffer(array.buffer, buffer, 0, 0, array.length * array.dataType.size);
		arrayOut = {
			buffer: buffer,
			shape: shapeOut,
			length: array.length,
			dataType: array.dataType
		};
		this.idMap[idOut] = arrayOut;
	}
	if (idA < 0) {
		this.deallocate(requestId, -idA);
	}

};

ConnectionContext.prototype.repeat = function(requestId, idA, idOut, axis, repeats) {
	var arrayA = this.idMap[Math.abs(idA)];
	if (typeof arrayA === "undefined") {
		console.error("Repeat Error: Array A is not valid");
		return;
	}
	if (axis >= arrayA.length) {
		console.error("Repeat Error: Invalid axis");
		return;
	}
	if (repeats < 2) {
		console.error("Repeat Error: Invalid repeat count");
		return;
	}

	var shapeOut = arrayA.shape.slice(0);
	shapeOut[axis] *= repeats;

	var arrayOut = this.idMap[Math.abs(idOut)];

	if (typeof arrayOut !== "undefined") {
		try {
			util.checkShapesCompatibility(arrayOut.shape, shapeOut);
			util.checkDataTypesCompatibility(arrayA.dataType, arrayOut.dataType);
		} catch (e) {
			console.error("Repeat Error: data types or shapes not compatible");
			return;
		}
	} else {
		var length = util.computeLength(shapeOut);
		var bufferOut = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, arrayA.dataType.size * length);
		arrayOut = {
			buffer: bufferOut,
			shape: shapeOut,
			length: length,
			dataType: arrayA.dataType
		};
	}
	var outerStride = util.computeOuterStride(arrayA.shape, axis);
	var innerStride = util.computeInnerStride(arrayA.shape, axis);
	var expansionDim = arrayA.shape[axis];
	var kernel = this.kernels.repeat[arrayA.dataType.type];
	kernel.setArg(0, new Uint32Array([expansionDim]));
	kernel.setArg(1, new Uint32Array([innerStride]));
	kernel.setArg(2, new Uint32Array([repeats]));
	kernel.setArg(3, arrayA.buffer);
	kernel.setArg(4, arrayOut.buffer);
	this.queue.enqueueNDRangeKernel(kernel, 3, null, [outerStride, expansionDim, innerStride], null);

	this.idMap[idOut] = arrayOut;

	if (idA < 0) {
		this.deallocate(requestId, -idA);
	}

};

ConnectionContext.prototype.deallocate = function(requestId, idA) {
	var arrayA = this.idMap[Math.abs(idA)];
	if (typeof arrayA === "undefined") {
		console.error("Error: invalid input ID in deallocate");
		return;
	}
	arrayA.buffer.release();
	delete this.idMap[Math.abs(idA)];
};

ConnectionContext.prototype.fetch = function(requestId, idA) {
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
};

ConnectionContext.prototype.barrier = function(requestId) {
	var response = new Response();
	response.id = requestId;
	response.type = Response.Type.BARRIER;
	var message = response.encodeAB();
	return message;
};

ConnectionContext.prototype.binaryOperation = function(requestId, type, idA, idB, idOut) {
	var arrayA = this.idMap[Math.abs(idA)];
	var arrayB = this.idMap[Math.abs(idB)];
	if (typeof arrayA === "undefined") {
		console.error("Binary Operation Error: Array A is not valid");
		return;
	}
	if (typeof arrayB === "undefined") {
		console.error("Binary Operation Error: Array B is not valid");
		return;
	}

	try {
		util.checkDataTypesCompatibility(arrayA.dataType, arrayB.dataType);
		util.checkShapesCompatibility(arrayA.shape, arrayB.shape);
	} catch (e) {
		console.error("Binary Operation Error: DataType or Shape incompatible");
		return;
	}

	var bufferOut = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, arrayA.dataType.size * arrayA.length);
	var arrayOut = {
		buffer: bufferOut,
		shape: arrayA.shape,
		length: arrayA.length,
		dataType: arrayA.dataType
	};

	this.binaryOperationMap[type](this.queue, arrayA.buffer, arrayB.buffer, arrayOut.buffer, arrayOut.length, arrayOut.dataType.type);
	this.idMap[idOut] = arrayOut;

	if (idA < 0) {
		arrayA.buffer.release();
		delete this.idMap[-idA];
	}
	if (idB < 0) {
		arrayB.buffer.release();
		delete this.idMap[-idB];
	}
};

ConnectionContext.prototype.binaryConstOperation = function(requestId, type, idA, valueB, idOut) {
	var arrayA = this.idMap[Math.abs(idA)];
	if (typeof arrayA === "undefined") {
		console.error("Binary Const Operation Error: Array A is not valid");
		return;
	}

	var bufferOut = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, arrayA.dataType.size * arrayA.length);
	var arrayOut = {
		buffer: bufferOut,
		shape: arrayA.shape,
		length: arrayA.length,
		dataType: arrayA.dataType
	};

	this.binaryConstOperationMap[type](this.queue, arrayA.buffer, valueB, arrayOut.buffer, arrayOut.length, arrayOut.dataType.type);
	this.idMap[idOut] = arrayOut;

	if (idA < 0) {
		arrayA.buffer.release();
		delete this.idMap[-idA];
	}
};

ConnectionContext.prototype.unaryOperation = function(requestId, type, idA, idOut) {
	var arrayA = this.idMap[Math.abs(idA)];
	if (typeof arrayA === "undefined") {
		console.error("Unary Operation Error: Array A is not valid");
		return;
	}

	var arrayOut = this.idMap[Math.abs(idOut)];
	if (typeof arrayOut !== "undefined") {
		try {
			util.checkDataTypesCompatibility(arrayA.dataType, arrayOut.dataType);
			util.checkShapesCompatibility(arrayA.shape, arrayOut.shape);
		} catch (e) {
			console.error("Unary Operation Error: DataType or Shape incompatible");
			return;
		}
	} else {
		var bufferOut = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, arrayA.dataType.size * arrayA.length);
		arrayOut = {
			buffer: bufferOut,
			shape: arrayA.shape,
			length: arrayA.length,
			dataType: arrayA.dataType
		};
	}

	this.unaryOperationMap[type](this.queue, arrayA.buffer, arrayOut.buffer, arrayOut.length, arrayOut.dataType.type);
	this.idMap[idOut] = arrayOut;

	if (idA < 0) {
		this.deallocate(requestId, -idA);
	}
};

ConnectionContext.prototype.reductionOperation = function(requestId, type, idA, idOut) {
	var arrayA = this.idMap[Math.abs(idA)];
	var arrayOut = this.idMap[Math.abs(idOut)];
	if (typeof arrayA === "undefined") {
		console.error("Reduction Error: invalid array");
		return;
	}
	if (typeof arrayOut === "undefined") {
		var bufferOut = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, arrayA.dataType.size);
		arrayOut = {
			buffer: bufferOut,
			shape: [],
			length: 1,
			dataType: arrayA.dataType
		};
	} else {
		try {
			util.checkShapesCompatibility([], arrayOut.shape);
			util.checkDataTypesCompatibility(arrayA.dataType, arrayOut.dataType);
		} catch (e) {
			console.error("Reduction Error: incompatible data types or shapes");
			return;
		}
	}

	var maxWorkItemsPerCU = Math.min(
		Math.min(this.deviceInfo.maxWorkGroupSize, this.deviceInfo.maxWorkItemSizes[0]),
			this.deviceInfo.localMemorySize / arrayA.dataType.size);
	console.log("MAX WORK ITEMS PER CU: " + maxWorkItemsPerCU);
	var parallelisationThreshold = 16;
	var kernel;
	if (type === 0) {
		kernel = this.kernels.sum[arrayA.dataType.type];
	} else if (type === 1) {
		kernel = this.kernels.min[arrayA.dataType.type];
	} else if (type === 2) {
		kernel = this.kernels.max[arrayA.dataType.type];
	}

	if (arrayA.length < maxWorkItemsPerCU * parallelisationThreshold) {
		kernel.setArg(0, new Uint32Array([arrayA.length]));
		kernel.setArg(1, arrayA.buffer);
		kernel.setArg(2, new Uint32Array([maxWorkItemsPerCU * arrayA.dataType.size]));
		kernel.setArg(3, arrayOut.buffer);
		this.queue.enqueueNDRangeKernel(kernel, 1, null, [maxWorkItemsPerCU], [maxWorkItemsPerCU], null);
	} else {
		var maxComputeUnits = this.deviceInfo.maxComputeUnits;
		var workGroupSizeMultiple = kernel.getWorkGroupInfo(this.device, nodeWebCL.KERNEL_PREFERRED_WORK_GROUP_SIZE_MULTIPLE);
		var tempBuffer = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, maxComputeUnits * arrayA.dataType.size);

		kernel.setArg(0, new Uint32Array([arrayA.length]));
		kernel.setArg(1, arrayA.buffer);
		kernel.setArg(2, new Uint32Array([maxWorkItemsPerCU * arrayA.dataType.size]));
		kernel.setArg(3, tempBuffer);
		this.queue.enqueueNDRangeKernel(kernel, 1, null,
			[maxWorkItemsPerCU * maxComputeUnits],
			[maxWorkItemsPerCU]);
		var workGroupSize = Math.min(maxWorkItemsPerCU,
			util.roundUp(maxComputeUnits, workGroupSizeMultiple));
		kernel.setArg(0, new Uint32Array([maxComputeUnits]));
		kernel.setArg(1, tempBuffer);
		kernel.setArg(2, new Uint32Array([workGroupSize * arrayA.dataType.size]));
		kernel.setArg(3, arrayOut.buffer);
		/* Important: use only one work group */
		this.queue.enqueueNDRangeKernel(kernel, 1, null,
			[workGroupSize],
			[workGroupSize]);

		tempBuffer.release();

		this.idMap[idOut] = arrayOut;

		if (idA < 0) {
			this.deallocate(requestId, -idA);
		}
	}
};

ConnectionContext.prototype.axisReductionOperation = function(requestId, type, idA, axis, idOut) {
	var arrayA = this.idMap[Math.abs(idA)];
	var arrayOut = this.idMap[Math.abs(idOut)];
	if (typeof arrayA === "undefined") {
		console.error("Axis Reduction Error: Invalid array");
		return;
	}
	axis = util.checkAxis(axis, arrayA.shape.length);
	var shapeOut = util.computeAxisReductionOutShape(arrayA.shape, axis);
	var lengthOut = util.computeLength(shapeOut);
	if (typeof arrayOut === "undefined") {
		var bufferOut = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, arrayA.dataType.size * lengthOut);
		arrayOut = {
			buffer: bufferOut,
			shape: shapeOut,
			length: lengthOut,
			dataType: arrayA.dataType
		};
	} else {
		try {
			util.checkDataTypesCompatibility(arrayA.dataType, arrayOut.dataType);
			util.checkShapesCompatibility(arrayA.shape, arrayOut.shape);
		} catch (e) {
			console.error("Reduction Error: Shape or Datatypes incompatible");
			return;
		}
	}

	var outerStride = util.computeOuterStride(arrayA.shape, axis);
	var reductionDim = arrayA.shape[axis];
	var innerStride = util.computeInnerStride(arrayA.shape, axis);
	var kernel;
	if (type === 0) {
		kernel = this.kernels.asum[arrayA.dataType.type];
	} else if (type === 1) {
		kernel = this.kernels.amin[arrayA.dataType.type];
	} else if (type === 2) {
		kernel = this.kernels.amax[arrayA.dataType.type];
	}
	kernel.setArg(0, new Uint32Array([reductionDim]));
	kernel.setArg(1, arrayA.buffer);
	kernel.setArg(2, arrayOut.buffer);

	this.queue.enqueueNDRangeKernel(kernel, 2, null, [outerStride, innerStride], null);

	this.idMap[idOut] = arrayOut;

	if (idA < 0) {
		this.deallocate(requestId, -idA);
	}
};

ConnectionContext.prototype.dot = function(requestId, idA, idB, idOut) {
	var arrayA = this.idMap[Math.abs(idA)];
	var arrayB = this.idMap[Math.abs(idB)];
	if (typeof arrayA === "undefined") {
		console.error("Dot Error: Array A invalid");
		return;
	}
	if (typeof arrayB === "undefined") {
		console.error("Dot Error: Array B invalid");
		return;
	}

	var aAxis = Math.max(arrayA.shape.length - 1, 0);
	var bAxis = Math.max(arrayB.shape.length - 2, 0);
	var reductionDim = arrayA.shape[aAxis];
	if (reductionDim !== arrayB.shape[bAxis]) {
		console.error("Dot Error: Incompatible reduction dimensions");
		return;
	}
	var shapeOut = [], strideA = 1, outerStrideB = 1, innerStrideB = 1;
	for (var i = 0; i < aAxis; i++) {
		shapeOut.push(arrayA.shape[i]);
		strideA *= arrayA.shape[i];
	}
	for (var i = 0; i < arrayB.shape.length; i++) {
		var dim = arrayB.shape[i];
		if (i < bAxis) {
			outerStrideB *= dim;
			shapeOut.push(dim);
		} else if (i > bAxis) {
			innerStrideB *= dim;
			shapeOut.push(dim);
		}
	}
	var length = util.computeLength(shapeOut);
	var bufferOut = this.context.createBuffer(nodeWebCL.MEM_READ_WRITE, length * arrayA.dataType.size);
	var arrayOut = {
		buffer: bufferOut,
		shape: shapeOut,
		length: length,
		dataType: arrayA.dataType
	};
	var kernel = this.kernels.dot[arrayA.dataType.type];
	kernel.setArg(0, new Uint32Array([reductionDim]));
	kernel.setArg(1, arrayA.buffer);
	kernel.setArg(2, arrayB.buffer);
	kernel.setArg(3, arrayOut.buffer);
	this.queue.enqueueNDRangeKernel(kernel, 3, null, [strideA, outerStrideB, innerStrideB], null);

	this.idMap[idOut] = arrayOut;

	if (idA < 0) {
		this.deallocate(requestId, -idA);
	}
	if (idB < 0) {
		this.deallocate(requestId, -idB);
	}
};

var commandLineOptions = {
	"host" : String,
	"path": String,
	"port" : Number
};
var commandLineShorthands = {
	"h": ["--host"],
	"p": ["--port"]
};
var commandLineArguments = nopt(commandLineOptions, commandLineShorthands, process.argv, 2);
var port = commandLineArguments.port || 8081;
var host = commandLineArguments.host || "localhost";
var path = commandLineArguments.path;

var server = ws.createServer({port: port, host: host, path: path});
server.on("connection", function(connection) {
	connection.connectionContext = new ConnectionContext();
	console.info("INFO: CONNECTED");

		connection.on("message", function (message, flags) {
			var request = Request.decode(message);
			switch (request.type) {
				case Request.Type.EMPTY_ARRAY:
					var emptyArrayRequest = request.emptyArrayRequest;
					connection.connectionContext.createEmptyArray(request.id,
						emptyArrayRequest.idOut,
						emptyArrayRequest.shape,
						dataTypeMap[emptyArrayRequest.dataType]);
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
					var constArrayRequest = request.constArrayRequest;
					connection.connectionContext.createConstArray(request.id,
						constArrayRequest.idOut,
						constArrayRequest.shape,
						dataTypeMap[constArrayRequest.dataType],
						constArrayRequest.fillValue);
					break;
				case Request.Type.IDENTITY_MATRIX:
                    var identityMatrixRequest = request.identityMatrixRequest;
                    connection.connectionContext.createIdentityMatrix(request.id,
                        identityMatrixRequest.idOut,
                        identityMatrixRequest.rows,
                        identityMatrixRequest.columns,
                        identityMatrixRequest.diagonal,
                        dataTypeMap[identityMatrixRequest.dataType]);
					break;
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
				case Request.Type.RESHAPE:
					var reshapeRequest = request.reshapeRequest;
					connection.connectionContext.reshape(request.id,
						reshapeRequest.idA,
						reshapeRequest.idOut,
						reshapeRequest.shapeOut);
					break;
				case Request.Type.REPEAT:
					var repeatRequest = request.repeatRequest;
					connection.connectionContext.repeat(request.id,
						repeatRequest.idA,
						repeatRequest.idOut,
						repeatRequest.axis,
						repeatRequest.repeats);
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
					var response = connection.connectionContext.barrier(request.id);
					if (response !== null) {
						connection.send(response, {binary: true});
					}
					break;
				case Request.Type.INFO:
					break;
				case Request.Type.BINARY_OPERATION:
					var binaryOperationRequest = request.binaryOperationRequest;
					connection.connectionContext.binaryOperation(request.id,
						binaryOperationRequest.type,
						binaryOperationRequest.idA,
						binaryOperationRequest.idB,
						binaryOperationRequest.idOut);
					break;
				case Request.Type.BINARY_CONST_OPERATION:
					var binaryConstOperationRequest = request.binaryConstOperationRequest;
					connection.connectionContext.binaryConstOperation(request.id,
						binaryConstOperationRequest.type,
						binaryConstOperationRequest.idA,
						binaryConstOperationRequest.valueB,
						binaryConstOperationRequest.idOut);
					break;
				case Request.Type.UNARY_OPERATION:
					var unaryOperationRequest = request.unaryOperationRequest;
					connection.connectionContext.unaryOperation(request.id,
						unaryOperationRequest.type,
						unaryOperationRequest.idA,
						unaryOperationRequest.idOut);
					break;
				case Request.Type.REDUCTION_OPERATION:
					/*var reductionOperationRequest = request.reductionRequest;
					connection.connectionContext.reductionOperation(request.id,
						reductionOperationRequest.type,
						reductionOperationRequest.idA,
						reductionOperationRequest.idOut);*/
					break;
				case Request.Type.AXIS_REDUCTION_OPERATION:
					var axisReductionRequest = request.axisReductionRequest;
					connection.connectionContext.axisReductionOperation(request.id,
						axisReductionRequest.type,
						axisReductionRequest.idA,
						axisReductionRequest.axis,
						axisReductionRequest.idOut);
					break;
				case Request.Type.DOT_OPERATION:
					var dotOperationRequest = request.dotOperationRequest;
					connection.connectionContext.dot(request.id,
						dotOperationRequest.idA,
						dotOperationRequest.idB,
						dotOperationRequest.idOut);
					break;
				case Request.Type.CHOLESKY_DECOMPOSITION:
					break;
				case Request.Type.SOLVE_TRIANGULAR:
					break;
		}
	});
});

