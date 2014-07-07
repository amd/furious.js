"use strict";

var NDArray = require("../NDArray");
var DataType = require("../DataType");
var util = require("../util");
var fs = require("fs");

var shapeToLength = function(shape) {
	var length = 1;
	for (var i = 0; i < shape.length; i++) {
		length *= shape[i];
	}
	return length;
};

var isCompatibleShape = function(shape1, shape2) {
	if (shape1.length !== shape2.length) {
		return false;
	}
	for (var i = 0; i < shape1.length; i++) {
		if (shape1[i] !== shape2[i]) {
			return false;
		}
	}
	return true;
};

/* Not supported by Nokia-WebCL, buggy in Chromium-WebCL */
var useAsyncBufferRead = false;
/* Buggy in Chromium-WebCL */
var useBufferCreationWithInit = false;
/* Chromium-WebCL requires a list of devices. Nokia-WebCL, on the contrary, only works with no arguments to WebCLProgram.build */
var useDeviceForBuild = true;

var cl = (typeof window === "object") ? window.webcl : undefined;
var context = null;
var queue = null;
var messageCallbacks = {};

var binaryOpKernels = {
	add: {},
	sub: {},
	mul: {},
	div: {}
};
var binaryConstOpKernels = {
	add: {},
	sub: {},
	mul: {},
	div: {}
};
var unaryOpKernels = {
	neg: {},
	abs: {},
	exp: {},
	log: {},
	sqrt: {},
	square: {}
};

var setKernels = {};

function WebCLContext(callback) {
	if (typeof cl === "undefined") {
		cl = require("node-webcl");
	}
	if (context === null) {
		var source = fs.readFileSync(__dirname + "/kernels.cl", "utf8");

		var platforms = cl.getPlatforms();
		var platform = platforms[0];
		var devices = platform.getDevices(cl.DEVICE_TYPE_ALL);
		var device = devices[0];
		context = cl.createContext(device);
		queue = context.createCommandQueue();
		var program = context.createProgram(source);
		if (useDeviceForBuild) {
			program.build([device]);
		} else {
			program.build();
		}
		setKernels.f32 = program.createKernel("setF32");
		setKernels.f64 = program.createKernel("setF64");
		binaryOpKernels.add.f32 = program.createKernel("addF32");
		binaryOpKernels.add.f64 = program.createKernel("addF64");
		binaryOpKernels.sub.f32 = program.createKernel("subF32");
		binaryOpKernels.sub.f64 = program.createKernel("subF64");
		binaryOpKernels.mul.f32 = program.createKernel("mulF32");
		binaryOpKernels.mul.f64 = program.createKernel("mulF64");
		binaryOpKernels.div.f32 = program.createKernel("divF32");
		binaryOpKernels.div.f64 = program.createKernel("divF64");
		binaryConstOpKernels.add.f32 = program.createKernel("addConstF32");
		binaryConstOpKernels.add.f64 = program.createKernel("addConstF64");
		binaryConstOpKernels.sub.f32 = program.createKernel("subConstF32");
		binaryConstOpKernels.sub.f64 = program.createKernel("subConstF64");
		binaryConstOpKernels.mul.f32 = program.createKernel("mulConstF32");
		binaryConstOpKernels.mul.f64 = program.createKernel("mulConstF64");
		binaryConstOpKernels.div.f32 = program.createKernel("divConstF32");
		binaryConstOpKernels.div.f64 = program.createKernel("divConstF64");
		unaryOpKernels.neg.f32 = program.createKernel("negF32");
		unaryOpKernels.neg.f64 = program.createKernel("negF64");
		unaryOpKernels.abs.f32 = program.createKernel("absF32");
		unaryOpKernels.abs.f64 = program.createKernel("absF64");
		unaryOpKernels.exp.f32 = program.createKernel("expF32");
		unaryOpKernels.exp.f64 = program.createKernel("expF64");
		unaryOpKernels.log.f32 = program.createKernel("logF32");
		unaryOpKernels.log.f64 = program.createKernel("logF64");
		unaryOpKernels.sqrt.f32 = program.createKernel("sqrtF32");
		unaryOpKernels.sqrt.f64 = program.createKernel("sqrtF64");
		unaryOpKernels.square.f32 = program.createKernel("squareF32");
		unaryOpKernels.square.f64 = program.createKernel("squareF64");
	}
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
	array._buffer = context.createBuffer(cl.MEM_READ_WRITE, array.length * dataType.size);
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
	array._buffer = context.createBuffer(cl.MEM_READ_WRITE, array.length * dataType.size);
	var kernel = setKernels[dataType.type];
	kernel.setArg(0, new Uint32Array([array.length]));
	kernel.setArg(1, array._buffer);
	kernel.setArg(2, new dataType.arrayType([0.0]));
	queue.enqueueNDRangeKernel(kernel, 1, null, [array.length]);
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
		array._buffer = context.createBuffer(cl.MEM_READ_WRITE, buffer.byteLength, buffer);
	} else {
		array._buffer = context.createBuffer(cl.MEM_READ_WRITE, buffer.byteLength);
		queue.enqueueWriteBuffer(array._buffer, false, 0, buffer.byteLength, buffer);
	}
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
				queue.enqueueReadBuffer(array._buffer, false, 0, buffer.byteLength, buffer, null, readFinishEvent);
				if (shape.length === 0) {
					readFinishEvent.setCallback(cl.COMPLETE, function() {
						readFinishEvent.release();
						callbackArguments[i] = typedArray[0];
						if (--callbackWaitArguments === 0) {
							callback.apply(null, callbackArguments);
						}
					});
				} else {
					readFinishEvent.setCallback(cl.COMPLETE, function() {
						readFinishEvent.release();
						var jsarray = new Array(shape[0]);
						createArrayRecursive(new ArrayType(buffer), jsarray, shape, 0, 0);
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
			queue.enqueueReadBuffer(array._buffer, true, 0, buffer.byteLength, buffer);
			if (array.shape.length === 0) {
				callbackArguments[i] = typedArray[0];
			} else {
				var jsarray = new Array(array.shape[0]);
				util.createArrayRecursive(new array.dataType.arrayType(buffer), jsarray, array.shape, 0, 0);
				callbackArguments[i] = jsarray;
			}
		}
		callback.apply(null, callbackArguments);
	}
};

var binaryArithOp = function(a, b, out, context, operation) {
	var shape = null, dataType = null;
	if (a instanceof NDArray) {
		shape = a.shape;
		dataType = a.dataType;
		if (b instanceof NDArray) {
			if (!isCompatibleShape(shape, b.shape)) {
				throw new Error("The a and b arrays have incompatible shapes");
			}
		} else if (!util.isNumber(b)) {
			throw new TypeError("Unsupported type of b");
		}
	} else {
		throw new TypeError("Unsupported type of a");
	}
	if (typeof out === "undefined") {
		out = context.empty(shape, dataType);
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray");
	}
	if (a instanceof NDArray) {
		if (b instanceof NDArray) {
			var kernel = binaryOpKernels[operation][dataType.type];
			kernel.setArg(0, new Uint32Array([out.length]));
			kernel.setArg(1, a._buffer);
			kernel.setArg(2, b._buffer);
			kernel.setArg(3, out._buffer);
			queue.enqueueNDRangeKernel(kernel, 1, null, [out.length]);
		} else {
			var kernel = binaryConstOpKernels[operation][dataType.type];
			kernel.setArg(0, new Uint32Array([out.length]));
			kernel.setArg(1, a._buffer);
			kernel.setArg(2, new a.dataType.arrayType([b]));
			kernel.setArg(3, out._buffer);
			queue.enqueueNDRangeKernel(kernel, 1, null, [out.length]);
		}
	}
	return out;
};

var unaryArithOp = function(a, out, context, operation) {
	var shape = null, dataType = null;
	if (a instanceof NDArray) {
		shape = a.shape;
		dataType = a.dataType;
	} else {
		throw new TypeError("Unsupported type of a");
	}
	if (typeof out === "undefined") {
		out = context.empty(shape, dataType);
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray");
	}
	var kernel = unaryOpKernels[operation][dataType.type];
	kernel.setArg(0, new Uint32Array([out.length]));
	kernel.setArg(1, a._buffer);
	kernel.setArg(2, out._buffer);
	queue.enqueueNDRangeKernel(kernel, 1, null, [out.length]);
	return out;
};

WebCLContext.prototype.add = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "add");
};

WebCLContext.prototype.sub = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "sub");
};

WebCLContext.prototype.mul = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "mul");
};

WebCLContext.prototype.div = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "div");
};

WebCLContext.prototype.neg = function(a, out) {
	return unaryArithOp(a, out, this, "neg");
};

WebCLContext.prototype.abs = function(a, out) {
	return unaryArithOp(a, out, this, "abs");
};

WebCLContext.prototype.exp = function(a, out) {
	return unaryArithOp(a, out, this, "exp");
};

WebCLContext.prototype.log = function(a, out) {
	return unaryArithOp(a, out, this, "log");
};

WebCLContext.prototype.sqrt = function(a, out) {
	return unaryArithOp(a, out, this, "sqrt");
};

WebCLContext.prototype.square = function(a, out) {
	return unaryArithOp(a, out, this, "square");
};

module.exports = WebCLContext;
