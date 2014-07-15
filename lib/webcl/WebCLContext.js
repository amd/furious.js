"use strict";

var NDArray = require("../NDArray");
var DataType = require("../DataType");
var util = require("../util");
var fs = require("fs");

/* Not supported by Nokia-WebCL, buggy in Chromium-WebCL */
var useAsyncBufferRead = false;
/* Buggy in Chromium-WebCL */
var useBufferCreationWithInit = false;

var cl = (typeof window === "object") ? window.webcl : undefined;

/**
 * Tries to release a WebCL resource and ignores any errors in the process.
 *
 * @private
 * @method tryRlease
 * @param {Object} webclObject - a WebCL object.
 * @return {Boolean} - true if the object was successfully released and false otherwise.
 */
var tryRelease = function(webclResource) {
	if (webclResource !== null) {
		try {
			webclResource.release();
			return true;
		} catch (e) {
			/* Silently ignore */
		}
	}
	return false;
};

/**
 * Constructs an uninialized N-dimensional array.
 *
 * @private
 * @method isFP64Capable
 * @param {WebCLDevice} device - the device to check for KHR_FP64 support.
 * @return {Boolean} - true if the device supports KHR_FP64 and false otherwise.
 */
var isFP64Capable = function(device) {
	var extensions = device.getSupportedExtensions();
	if (extensions.indexOf("KHR_fp64") === -1) {
		return false;
	}
	/*
	 * Due to a bug WebKit-WebCL may report KHR_fp64 even if it is not supported by the underlying OpenCL device.
	 * See bug https://github.com/SRA-SiliconValley/webkit-webcl/issues/536
	 */
	var testSource = "kernel void foo(global double* bar) { }";
	var context = null, program = null;
	try {
		context = cl.createContext(device);
		program = context.createProgram(testSource);
		program.build();
		return true;
	} catch (e) {
		return false;
	} finally {
		tryRelease(program);
		tryRelease(context);
	}
};

/**
 * Classifies WebCL device to one of four categories:
 * - "cpu" for CPU devices.
 * - "igpu" for GPUs integrated with CPU package or chipset.
 * - "dgpu" for discrete GPUs.
 * - "unknown" for other types of devices (e.g. FPGAs)
 *
 * @private
 * @method classifyDevice
 * @param {WebCLDevice} device - the WebCL device to classify.
 * @return {String} - one of the strings described above.
 */
var classifyDevice = function(device) {
	try {
		var deviceType = device.getInfo(cl.DEVICE_TYPE);
		if (deviceType === cl.DEVICE_TYPE_CPU) {
			return "cpu";
		} else if (deviceType === cl.DEVICE_TYPE_GPU) {
			var isHostUnifiedMemory = device.getInfo(cl.DEVICE_HOST_UNIFIED_MEMORY);
			return (isHostUnifiedMemory ? "igpu" : "dgpu");
		}
	} catch (e) {
	}
	return "unknown";
};

/**
 * Selects the optimal WebCL device from a list of devices
 * The priority of devices: "dgpu" > "igpu" > "cpu"
 *
 * @private
 * @method selectDevice
 * @param {WebCLDevice[]} deviceList - a list of WebCL devices to select from.
 * @return {WebCLDevice} - the selected device from the list.
 */
var selectDevice = function(deviceList) {
	var deviceClassList = [];
	/* Search for "dgpu" */
	for (var i = 0; i < deviceList.length; ++i) {
		var device = deviceList[i];
		var deviceClass = classifyDevice(device);
		if (deviceClass === "dgpu") {
			return device;
		}
		deviceClassList.push(deviceClass);
	}
	/* Search for "igpu" */
	for (var i = 0; i < deviceList.length; ++i) {
		if (deviceClassList[i] === "igpu") {
			return deviceList[i];
		}
	}
	/* Search for "cpu" */
	for (var i = 0; i < deviceList.length; ++i) {
		if (deviceClassList[i] === "cpu") {
			return deviceList[i];
		}
	}
	/* Did not find a reasonable device */
	throw new Error("No compatible device present");
};

var createKernels = function(program) {
	var kernels = {
		set: {
			f32: program.createKernel("set_f32"),
			f64: program.createKernel("set_f64")
		},
		linspace: {
			f32: program.createKernel("linspace_f32"),
			f64: program.createKernel("linspace_f64")
		},
		repeat: {
			f32: program.createKernel("repeat_f32"),
			f64: program.createKernel("repeat_f64")
		},
		add: {
			f32: program.createKernel("add_f32"),
			f64: program.createKernel("add_f64")
		},
		sub: {
			f32: program.createKernel("sub_f32"),
			f64: program.createKernel("sub_f64")
		},
		mul: {
			f32: program.createKernel("mul_f32"),
			f64: program.createKernel("mul_f64")
		},
		div: {
			f32: program.createKernel("div_f32"),
			f64: program.createKernel("div_f64")
		},
		addc: {
			f32: program.createKernel("addc_f32"),
			f64: program.createKernel("addc_f64")
		},
		subc: {
			f32: program.createKernel("subc_f32"),
			f64: program.createKernel("subc_f64")
		},
		subrc: {
			f32: program.createKernel("subrc_f32"),
			f64: program.createKernel("subrc_f64")
		},
		mulc: {
			f32: program.createKernel("mulc_f32"),
			f64: program.createKernel("mulc_f64")
		},
		divc: {
			f32: program.createKernel("divc_f32"),
			f64: program.createKernel("divc_f64")
		},
		divrc: {
			f32: program.createKernel("divrc_f32"),
			f64: program.createKernel("divrc_f64")
		},
		neg: {
			f32: program.createKernel("neg_f32"),
			f64: program.createKernel("neg_f64")
		},
		abs: {
			f32: program.createKernel("abs_f32"),
			f64: program.createKernel("abs_f64")
		},
		exp: {
			f32: program.createKernel("exp_f32"),
			f64: program.createKernel("exp_f64")
		},
		log: {
			f32: program.createKernel("log_f32"),
			f64: program.createKernel("log_f64")
		},
		sqrt: {
			f32: program.createKernel("sqrt_f32"),
			f64: program.createKernel("sqrt_f64")
		},
		square: {
			f32: program.createKernel("square_f32"),
			f64: program.createKernel("square_f64")
		},
		sum: {
			f32: program.createKernel("sum_f32_gpu"),
			f64: program.createKernel("sum_f64_gpu")
		},
		min: {
			f32: program.createKernel("min_f32_gpu"),
			f64: program.createKernel("min_f64_gpu")
		},
		max: {
			f32: program.createKernel("max_f32_gpu"),
			f64: program.createKernel("max_f64_gpu")
		},
		asum: {
			f32: program.createKernel("asum_f32"),
			f64: program.createKernel("asum_f64")
		},
		amin: {
			f32: program.createKernel("amin_f32"),
			f64: program.createKernel("amin_f64")
		},
		amax: {
			f32: program.createKernel("amax_f32"),
			f64: program.createKernel("amax_f64")
		}
	};
	return kernels;
};

function WebCLContext(callback) {
	if (typeof cl === "undefined") {
		cl = require("node-webcl");
	}
	var binaryKernelsSource = fs.readFileSync(__dirname + "/binaryKernels.cl", "utf8");
	var unaryKernelsSource = fs.readFileSync(__dirname + "/unaryKernels.cl", "utf8");
	var reductionKernelsSource = fs.readFileSync(__dirname + "/reductionKernels.cl", "utf8");
	var axisReductionKernelsSource = fs.readFileSync(__dirname + "/axisReductionKernels.cl", "utf8");
	var utilKernelsSource = fs.readFileSync(__dirname + "/utilKernels.cl", "utf8");
	var source = binaryKernelsSource + unaryKernelsSource + reductionKernelsSource + axisReductionKernelsSource + utilKernelsSource;

	var compatibleDevices = [];
	var platforms = cl.getPlatforms();
	for (var i = 0; i < platforms.length; ++i) {
		var platform = platforms[i];
		var devices = platform.getDevices(cl.DEVICE_TYPE_ALL);
		for (var j = 0; j < devices.length; ++j) {
			var device = devices[j];
			if (isFP64Capable(device)) {
				compatibleDevices.push(device);
			}
		}
	}
	this.device = selectDevice(compatibleDevices);
	this.device.enableExtension("KHR_fp64");
	this.deviceInfo = {
		deviceClass: classifyDevice(this.device),
		localMemorySize: this.device.getInfo(cl.DEVICE_LOCAL_MEM_SIZE),
		maxComputeUnits: this.device.getInfo(cl.DEVICE_MAX_COMPUTE_UNITS),
		maxWorkGroupSize: this.device.getInfo(cl.DEVICE_MAX_WORK_GROUP_SIZE),
		maxWorkItemSizes: this.device.getInfo(cl.DEVICE_MAX_WORK_ITEM_SIZES)
	};
	this.context = cl.createContext(this.device);
	this.queue = this.context.createCommandQueue();
	this.program = this.context.createProgram(source);
	try {
		/* Chromium-WebCL requires a list of devices */
		this.program.build([this.device]);
	} catch (e) {
		if (e.name === "INVALID_DEVICE") {
			/* Nokia-WebCL only works with no arguments to WebCLProgram.build */
			this.program.build();
		} else {
			throw e;
		}
	}
	this.kernels = createKernels(this.program);
	/* Context is ready for computations */
	callback(this);
}

WebCLContext.prototype.empty = function(shape, dataType) {
	shape = util.checkShape(shape);
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var array = new NDArray(shape, dataType, this);
	array._buffer = this.context.createBuffer(cl.MEM_READ_WRITE, array.length * dataType.size);
	return array;
};

WebCLContext.prototype.zeros = function(shape, dataType) {
	shape = util.checkShape(shape);
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var array = new NDArray(shape, dataType, this);
	array._buffer = this.context.createBuffer(cl.MEM_READ_WRITE, array.length * dataType.size);
	var kernel = this.kernels.set[dataType.type];
	kernel.setArg(0, new Uint32Array([array.length]));
	kernel.setArg(1, array._buffer);
	kernel.setArg(2, new dataType.arrayType([0.0]));
	this.queue.enqueueNDRangeKernel(kernel, 1, null, [array.length], null);
	return array;
};

WebCLContext.prototype.ones = function(shape, dataType) {
	shape = util.checkShape(shape);
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var array = new NDArray(shape, dataType, this);
	array._buffer = this.context.createBuffer(cl.MEM_READ_WRITE, array.length * dataType.size);
	var kernel = this.kernels.set[dataType.type];
	kernel.setArg(0, new Uint32Array([array.length]));
	kernel.setArg(1, array._buffer);
	kernel.setArg(2, new dataType.arrayType([1.0]));
	this.queue.enqueueNDRangeKernel(kernel, 1, null, [array.length], null);
	return array;
};

WebCLContext.prototype.array = function(data, dataType) {
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else {
		dataType = util.checkDataType(dataType);
	}
	var shape = [];
	util.discoverArrayShapeRecursive(data, shape, 0);
	var array = new NDArray(shape, dataType, this);
	var buffer = new dataType.arrayType(array.length);
	util.copyArrayDataRecursive(buffer, data, shape, 0, 0);
	if (useBufferCreationWithInit) {
		array._buffer = this.context.createBuffer(cl.MEM_READ_WRITE, buffer.byteLength, buffer);
	} else {
		array._buffer = this.context.createBuffer(cl.MEM_READ_WRITE, buffer.byteLength);
		this.queue.enqueueWriteBuffer(array._buffer, false, 0, buffer.byteLength, buffer);
	}
	return array;
};

WebCLContext.prototype.linspace = function(start, stop, samples, closed) {
	if (!util.isReal(start)) {
		throw new TypeError(start + " is not a real number");
	}
	if (!util.isReal(stop)) {
		throw new TypeError(stop + " is not a real number");
	}
	if (typeof samples === "undefined") {
		/* Default value in NumPy */
		samples = 50;
	} else if (!util.isInt(samples)) {
		throw new TypeError(samples + " is not an integer");
	} else if (samples <= 0) {
		throw new RangeError("The number of samples must be positive");
	}
	if (typeof closed === "undefined") {
		closed = true;
	}
	if (closed && (samples === 1)) {
		throw new RangeError("The number of samples must be a least 2 (for start and end points)");
	}

	var dataType = new DataType("f64");
	var array = new NDArray(samples, dataType, this);
	array._buffer = this.context.createBuffer(cl.MEM_READ_WRITE, samples * dataType.size);

	var range = stop - start;
	var n = (closed) ? samples - 1 : samples;
	var step = range / n;

	var kernel = this.kernels.linspace[dataType.type];
	kernel.setArg(0, new Uint32Array([array.length]));
	kernel.setArg(1, array._buffer);
	kernel.setArg(2, new dataType.arrayType([start]));
	kernel.setArg(3, new dataType.arrayType([step]));
	this.queue.enqueueNDRangeKernel(kernel, 1, null, [array.length], null);

	return array;
};

WebCLContext.prototype._invalidate = function(array) {
	if (array._buffer !== null) {
		/* Work-around for Chromium-WebCL that currently lacks WebCLMemObject.release method */
		if (typeof array._buffer.release !== "undefined") {
			array._buffer.release();
		}
		array._buffer = null;
	}
};

WebCLContext.prototype.get = function() {
	if (arguments.length === 0) {
		throw new Error("Callback argument missing");
	}
	var callback = arguments[arguments.length - 1];
	/* Validate arguments */
	if (arguments.length === 1) {
		throw new Error("At least one NDArray argument expected");
	}
	for (var i = 0; i < arguments.length - 1; i++) {
		if (!(arguments[i] instanceof NDArray)) {
			throw new TypeError("Argument " + i + " is not an NDArray");
		}
	}
	var callbackWaitArguments = arguments.length - 1;
	var callbackArguments = new Array(callbackWaitArguments);
	if (useAsyncBufferRead) {
		/* Async version: doesn't seem to be supported by WebCL implementations */
		for (var i = 0; i < callbackWaitArguments; i++) {
			var array = arguments[i];
			(function(i, shape, ArrayType) {
				var buffer = new ArrayType(length);
				var readFinishEvent = new WebCLEvent();
				this.queue.enqueueReadBuffer(array._buffer, false, 0, buffer.byteLength, buffer, null, readFinishEvent);
				if (shape.length === 0) {
					readFinishEvent.setCallback(cl.COMPLETE, function() {
						readFinishEvent.release();
						callbackArguments[i] = buffer[0];
						if (--callbackWaitArguments === 0) {
							callback.apply(null, callbackArguments);
						}
					});
				} else {
					readFinishEvent.setCallback(cl.COMPLETE, function() {
						readFinishEvent.release();
						var jsarray = new Array(shape[0]);
						util.createArrayRecursive(new ArrayType(buffer), jsarray, shape, 0, 0);
						callbackArguments[i] = jsarray;
						if (--callbackWaitArguments === 0) {
							callback.apply(null, callbackArguments);
						}
					});
				}
			})(i, array.shape, array.dataType.arrayType);
		}
	} else {
		for (var i = 0; i < callbackWaitArguments; i++) {
			var array = arguments[i];
			var buffer = new array.dataType.arrayType(array.length);
			this.queue.enqueueReadBuffer(array._buffer, true, 0, buffer.byteLength, buffer);
			if (array.shape.length === 0) {
				callbackArguments[i] = buffer[0];
			} else {
				var jsarray = new Array(array.shape[0]);
				util.createArrayRecursive(new array.dataType.arrayType(buffer), jsarray, array.shape, 0, 0);
				callbackArguments[i] = jsarray;
			}
		}
		callback.apply(null, callbackArguments);
	}
};

WebCLContext.prototype.reshape = function(a, shape) {
	shape = util.checkShape(shape);
	if (util.computeLength(shape) !== a.length) {
		throw new RangeError("The shape is not compatible with the array");
	}
	var out = new NDArray(shape, a.dataType, this);
	if (a._decRef()) {
		out._buffer = this.context.createBuffer(webcl.MEM_READ_WRITE, out.length * out.dataType.size);
		this.queue.enqueueCopyBuffer(a._buffer, out._buffer, 0, 0, out.length * out.dataType.size);
	} else {
		out._buffer = a._buffer;
		a._buffer = null;
	}
	return out;
};

WebCLContext.prototype.repeat = function(a, repeats, axis, out) {
	util.checkNDArray(a, "a");
	repeats = util.checkRepeats(repeats);
	axis = util.checkAxis(axis, a.shape.length);
	var shapeA = a.shape;
	var shapeOut = shapeA.slice(0);
	shapeOut[axis] *= repeats;
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(shapeOut, a.dataType, this);
			out._buffer = this.context.createBuffer(webcl.MEM_READ_WRITE, out.length * out.dataType.size);
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(out.shape, shapeOut);
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			out._incRef();
		}
		var outerStride = util.computeOuterStride(shapeA, axis);
		var expansionDim = shapeA[axis];
		var innerStride = util.computeInnerStride(shapeA, axis);
		var kernel = this.kernels.repeat[a.dataType.type];
		kernel.setArg(0, new Uint32Array([expansionDim]));
		kernel.setArg(1, new Uint32Array([innerStride]));
		kernel.setArg(2, new Uint32Array([repeats]));
		kernel.setArg(3, a._buffer);
		kernel.setArg(4, out._buffer);
		this.queue.enqueueNDRangeKernel(kernel, 3, null, [outerStride, expansionDim, innerStride], null);
	} catch (e) {
		a._incRef();
		throw e;
	}
	a._tryInvalidate();
	return out;
};

var binaryArithOp = function(a, b, out, furiousContext, binaryOpKernels, binaryConstOpKernels, binaryRevConstKernels) {
	var shapeOut = null, dataTypeOut = null;
	var bufferA = null, bufferB = null;
	if (a instanceof NDArray) {
		bufferA = a._buffer;
		shapeOut = a.shape;
		dataTypeOut = a.dataType;
		if (b instanceof NDArray) {
			bufferB = b._buffer;
			util.checkShapesCompatibility(a.shape, b.shape);
			util.checkDataTypesCompatibility(a.dataType, b.dataType);
		} else if (!util.isNumber(b)) {
			throw new TypeError("Unsupported type of b");
		}
	} else if (util.isNumber(a)) {
		util.checkNDArray(b, "b");
		bufferB = b._buffer;
		shapeOut = b.shape;
		dataTypeOut = b.dataType;
	} else {
		throw new TypeError("Unsupported type of a");
	}
	if (a instanceof NDArray) {
		a._decRef();
	}
	if (b instanceof NDArray) {
		b._decRef();
	}
	try {
		if (typeof out === "undefined") {
			out = new NDArray(shapeOut, dataTypeOut, furiousContext);
			if ((a instanceof NDArray) && !a._hasRefs()) {
				out._buffer = a._buffer;
				a._buffer = null;
			} else if ((b instanceof NDArray) && !b._hasRefs()) {
				out._buffer = b._buffer;
				b._buffer = null;
			} else {
				out._buffer = furiousContext.context.createBuffer(cl.MEM_READ_WRITE, out.length * out.dataType.size);
			}
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(shapeOut, out.shape);
			util.checkDataTypesCompatibility(dataTypeOut, out.dataType);
			out._incRef();
		}
		if (a instanceof NDArray) {
			if (b instanceof NDArray) {
				var kernel = binaryOpKernels[dataTypeOut.type];
				kernel.setArg(0, new Uint32Array([out.length]));
				kernel.setArg(1, bufferA);
				kernel.setArg(2, bufferB);
				kernel.setArg(3, out._buffer);
				furiousContext.queue.enqueueNDRangeKernel(kernel, 1, null, [out.length], null);
			} else {
				var kernel = binaryConstOpKernels[dataTypeOut.type];
				kernel.setArg(0, new Uint32Array([out.length]));
				kernel.setArg(1, bufferA);
				kernel.setArg(2, new dataTypeOut.arrayType([b]));
				kernel.setArg(3, out._buffer);
				furiousContext.queue.enqueueNDRangeKernel(kernel, 1, null, [out.length], null);
			}
		} else {
			var kernel = binaryRevConstKernels[dataTypeOut.type];
			kernel.setArg(0, new Uint32Array([out.length]));
			kernel.setArg(1, bufferB);
			kernel.setArg(2, new dataTypeOut.arrayType([a]));
			kernel.setArg(3, out._buffer);
			furiousContext.queue.enqueueNDRangeKernel(kernel, 1, null, [out.length], null);
		}
	} catch (e) {
		/* Restore the previous state */
		if (a instanceof NDArray) {
			a._incRef();
		}
		if (b instanceof NDArray) {
			b._incRef();
		}
		throw e;
	}
	if (a instanceof NDArray) {
		a._tryInvalidate();
	}
	if (b instanceof NDArray) {
		b._tryInvalidate();
	}
	return out;
};

var unaryArithOp = function(a, out, furiousContext, unaryOpKernels) {
	util.checkNDArray(a, "a");
	a._decRef();
	var bufferA = a._buffer;
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, furiousContext);
			if ((a instanceof NDArray) && !a._hasRefs()) {
				out._buffer = a._buffer;
				a._buffer = null;
			} else {
				out._buffer = furiousContext.context.createBuffer(cl.MEM_READ_WRITE, out.length * out.dataType.size);
			}
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(a.shape, out.shape);
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			out._incRef();
		}
		var kernel = unaryOpKernels[a.dataType.type];
		kernel.setArg(0, new Uint32Array([out.length]));
		kernel.setArg(1, bufferA);
		kernel.setArg(2, out._buffer);
		furiousContext.queue.enqueueNDRangeKernel(kernel, 1, null, [out.length], null);
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	a._tryInvalidate();
	return out;
};

var axisReduceOp = function(a, axis, out, furiousContext, reduceKernels, axisReduceKernels) {
	util.checkNDArray(a, "a");
	if (typeof axis === "undefined") {
		if (typeof out === "undefined") {
			out = new NDArray([], a.dataType, furiousContext);
			out._buffer = furiousContext.context.createBuffer(cl.MEM_READ_WRITE, a.dataType.size);
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility([], out.shape);
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			out._incRef();
		}
		var lengthA = a.length;
		var maxWorkItemsPerCU = Math.min(
			Math.min(furiousContext.deviceInfo.maxWorkGroupSize,
				furiousContext.deviceInfo.maxWorkItemSizes[0]), 
			furiousContext.deviceInfo.localMemorySize / a.dataType.size);
		/* The minimal ammount of parallelism that justifies switching to two-pass reduction */
		var parallelisationThreshold = 16;
		var kernel = reduceKernels[a.dataType.type];
		if (lengthA < maxWorkItemsPerCU * parallelisationThreshold) {
			/* One reduction is enough */
			kernel.setArg(0, new Uint32Array([lengthA]));
			kernel.setArg(1, a._buffer);
			kernel.setArg(2, new Uint32Array([maxWorkItemsPerCU * a.dataType.size]));
			kernel.setArg(3, out._buffer);
			/* Important: use only one work group */
			furiousContext.queue.enqueueNDRangeKernel(kernel, 1, null, [maxWorkItemsPerCU], [maxWorkItemsPerCU]);
		} else {
			/* Two-step reduction */
			var maxComputeUnits = furiousContext.deviceInfo.maxComputeUnits;
			var workGroupSizeMultiple = kernel.getWorkGroupInfo(furiousContext.device, cl.KERNEL_PREFERRED_WORK_GROUP_SIZE_MULTIPLE);
			var tempBuffer = furiousContext.context.createBuffer(cl.MEM_READ_WRITE, maxComputeUnits * a.dataType.size);

			kernel.setArg(0, new Uint32Array([lengthA]));
			kernel.setArg(1, a._buffer);
			kernel.setArg(2, new Uint32Array([maxWorkItemsPerCU * a.dataType.size]));
			kernel.setArg(3, tempBuffer);
			furiousContext.queue.enqueueNDRangeKernel(kernel, 1, null,
				[maxWorkItemsPerCU * maxComputeUnits],
				[maxWorkItemsPerCU]);

			var workGroupSize = Math.min(maxWorkItemsPerCU,
				util.roundUp(maxComputeUnits, workGroupSizeMultiple));
			kernel.setArg(0, new Uint32Array([maxComputeUnits]));
			kernel.setArg(1, tempBuffer);
			kernel.setArg(2, new Uint32Array([workGroupSize * a.dataType.size]));
			kernel.setArg(3, out._buffer);
			/* Important: use only one work group */
			furiousContext.queue.enqueueNDRangeKernel(kernel, 1, null,
				[workGroupSize],
				[workGroupSize]);

			tempBuffer.release();
		}
		a._tryRelease();
		return out;
	} else {
		axis = util.checkAxis(axis, a.shape.length);
		var shapeOut = util.computeAxisReductionOutShape(a.shape, axis);
		if (typeof out === "undefined") {
			var out = new NDArray(shapeOut, a.dataType, furiousContext);
			out._buffer = furiousContext.context.createBuffer(cl.MEM_READ_WRITE, a.dataType.size * out.length);
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility([], out.shape);
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			out._incRef();
		}
		var outerStride = util.computeOuterStride(a.shape, axis);
		var reductionDim = a.shape[axis];
		var innerStride = util.computeInnerStride(a.shape, axis);
		var kernel = axisReduceKernels[a.dataType.type];
		kernel.setArg(0, new Uint32Array([reductionDim]));
		kernel.setArg(1, a._buffer);
		kernel.setArg(2, out._buffer);
		furiousContext.queue.enqueueNDRangeKernel(kernel, 2, null,
			[outerStride, innerStride], null);
		a._tryRelease();
		return out;
	}
};


WebCLContext.prototype.add = function(a, b, out) {
	return binaryArithOp(a, b, out, this, this.kernels.add, this.kernels.addc, this.kernels.addc);
};

WebCLContext.prototype.sub = function(a, b, out) {
	return binaryArithOp(a, b, out, this, this.kernels.sub, this.kernels.subc, this.kernels.subrc);
};

WebCLContext.prototype.mul = function(a, b, out) {
	return binaryArithOp(a, b, out, this, this.kernels.mul, this.kernels.mulc, this.kernels.mulc);
};

WebCLContext.prototype.div = function(a, b, out) {
	return binaryArithOp(a, b, out, this, this.kernels.div, this.kernels.divc, this.kernels.divrc);
};

WebCLContext.prototype.neg = function(a, out) {
	return unaryArithOp(a, out, this, this.kernels.neg);
};

WebCLContext.prototype.abs = function(a, out) {
	return unaryArithOp(a, out, this, this.kernels.abs);
};

WebCLContext.prototype.exp = function(a, out) {
	return unaryArithOp(a, out, this, this.kernels.exp);
};

WebCLContext.prototype.log = function(a, out) {
	return unaryArithOp(a, out, this, this.kernels.log);
};

WebCLContext.prototype.sqrt = function(a, out) {
	return unaryArithOp(a, out, this, this.kernels.sqrt);
};

WebCLContext.prototype.square = function(a, out) {
	return unaryArithOp(a, out, this, this.kernels.square);
};

WebCLContext.prototype.min = function(a, axis, out) {
	return axisReduceOp(a, axis, out, this, this.kernels.min, this.kernels.amin);
};

WebCLContext.prototype.max = function(a, axis, out) {
	return axisReduceOp(a, axis, out, this, this.kernels.max, this.kernels.amax);
};

WebCLContext.prototype.sum = function(a, axis, out) {
	return axisReduceOp(a, axis, out, this, this.kernels.sum, this.kernels.asum);
};

module.exports = WebCLContext;
