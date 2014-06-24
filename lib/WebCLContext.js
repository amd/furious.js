"use strict";

var NDArray = require("./NDArray");
var DataType = require("./DataType");
var util = require("./util");
var source = require("./WebCLKernels.js");

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

var context = null;
var queue = null;
var program = null;
var messageCallbacks = {};
var cl = null;

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

function WebCLContext(callback) {
	if (cl === null) {
		if (typeof webcl === "undefined") {
			cl = new WebCL();
		} else {
			cl = webcl;
		}
		context = cl.createContext();
		queue = context.createCommandQueue();
		program = context.createProgram(source);
		program.build();
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
	if (!util.isPositiveIntArray(shape) && !util.isPositiveInt(shape)) {
		throw new TypeError(shape + " is not a valid array shape");
	}
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var ndarray = new NDArray(shape, dataType, this);
	ndarray._buffer = context.createBuffer(cl.MEM_READ_WRITE, ndarray.length * dataType.size);
	return ndarray;
};

WebCLContext.prototype.array = function(data, dataType) {
	var shape = [];
	util.discoverArrayShapeRecursive(data, shape, 0);
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var ndarray = new NDArray(shape, dataType, this);
	var buffer = new dataType.arrayType(ndarray.length);
	util.copyArrayDataRecursive(buffer, data, shape, 0, 0);
	ndarray._buffer = context.createBuffer(cl.MEM_READ_WRITE, ndarray.length * dataType.size);
	queue.enqueueWriteBuffer(ndarray._buffer, false, 0, ndarray.length * dataType.size, buffer);
	return ndarray;
};

WebCLContext.prototype.release = function(ndarray) {
	if (!(ndarray instanceof NDArray)) {
		throw new TypeError(ndarray + " is not an NDArray");
	}
	ndarray._buffer.release();
	delete ndarray._buffer;
};

WebCLContext.prototype.get = function(ndarray, callback) {
	if (!(ndarray instanceof NDArray)) {
		throw new TypeError(ndarray + " is not an NDArray");
	}
	/*
	var readFinishEvent = new WebCLEvent();
	var buffer = new ndarray.dataType.arrayType(ndarray.length);
	queue.enqueueReadBuffer(ndarray._buffer, false, 0, ndarray.length * ndarray.dataType.size, buffer, null, readFinishEvent);
	readFinishEvent.setCallback(cl.COMPLETE, function() {
		readFinishEvent.release();
		var jsarray = new Array(ndarray.shape[0]);
		createArrayRecursive(new ndarray.dataType.arrayType(buffer), jsarray, ndarray.shape, 0, 0);
		callback(jsarray);
	});*/
	var readFinishEvent = new WebCLEvent();
	var buffer = new ndarray.dataType.arrayType(ndarray.length);
	queue.enqueueReadBuffer(ndarray._buffer, true, 0, ndarray.length * ndarray.dataType.size, buffer);
	var jsarray = new Array(ndarray.shape[0]);
	util.createArrayRecursive(new ndarray.dataType.arrayType(buffer), jsarray, ndarray.shape, 0, 0);
	callback(jsarray);
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
