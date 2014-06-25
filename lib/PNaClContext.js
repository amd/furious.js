"use strict";

var NDArray = require("./NDArray");
var DataType = require("./DataType");
var allocator = require("./allocator");
var util = require("./util");

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

var messageCallbacks = {};

var onPNaClMessage = function(message) {
	var result = message.data;
	var id = result.id;
	if (result.status == "error") {
		console.log("Error: " + result.description);
	}
	if (id in messageCallbacks) {
		if ("buffer" in result) {
			messageCallbacks[id](result.buffer);
		} else {
			messageCallbacks[id]();
		}
		delete messageCallbacks[id];
	}
};

function PNaClContext(callback) {
	var context = this;
	this._pnaclObject = document.createElement("object");
	this._pnaclObject.width = 0;
	this._pnaclObject.height = 0;
	this._pnaclObject.data = "furious.nmf";
	this._pnaclObject.type = "application/x-pnacl";
	this._pnaclObject.addEventListener("load", function () {
		var messageId = allocator.newMessageId();
		messageCallbacks[messageId] = function() {
			callback(context);
		};
		context._pnaclObject.postMessage({
			"id": messageId,
			"command": "init"
		});
	}, true);
	this._pnaclObject.addEventListener("message", onPNaClMessage, true);
	document.body.appendChild(this._pnaclObject);
}

PNaClContext.prototype.empty = function(shape, dataType) {
	shape = util.checkShape(shape);
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var array = new NDArray(shape, dataType, this);
	array._id = allocator.newArrayId();
	this._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": "empty",
		"shape": new Uint32Array(shape).buffer,
		"datatype": dataType.type,
		"out": array._id
	});
	return array;
};

PNaClContext.prototype.array = function(data, dataType) {
	var shape = [];
	util.discoverArrayShapeRecursive(data, shape, 0);
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var ndarray = new NDArray(shape, dataType, this);
	ndarray._id = allocator.newArrayId();
	var buffer = new dataType.arrayType(ndarray.length);
	util.copyArrayDataRecursive(buffer, data, shape, 0, 0);
	this._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": "array",
		"shape": new Uint32Array(shape).buffer,
		"datatype": dataType.type,
		"buffer": buffer.buffer,
		"out": ndarray._id
	});
	return ndarray;
};

PNaClContext.prototype.linspace = function(start, stop, samples, includeStop) {
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
	if (typeof includeStop === "undefined") {
		includeStop = true;
	}
	if (includeStop && (samples === 1)) {
		throw new RangeError("The number of samples must be a least 2 (for start and end points)");
	}
	var dataType = new DataType("f64");
	var array = new NDArray([samples], dataType, this);
	array._id = allocator.newArrayId();
	this._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": "linspace",
		"start": +start,
		"stop": +stop,
		"samples": samples|0,
		"closed": !!includeStop,
		"datatype": dataType.type,
		"out": array._id
	});
	return array;
};

PNaClContext.prototype.reshape = function(array, shape) {
	if (!util.isPositiveIntArray(shape) && !util.isPositiveInt(shape)) {
		throw new TypeError(shape + " is not a valid array shape");
	}
	if (shapeToLength(shape) !== array.length) {
		throw new RangeError(shape + " is not compatible with the array");
	}
	var output = new NDArray(shape, array.dataType, this);
	output._id = allocator.newArrayId();
	this._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": "reshape",
		"a": array._id,
		"out": output._id,
		"shape": new Uint32Array(shape).buffer
	});
	return output;
};

PNaClContext.prototype.repeat = function(a, repeats, axis, out) {
	util.checkNDArray(a, "a");
	repeats = util.checkRepeats(repeats);
	axis = util.checkAxis(axis, a.shape.length);
	var shapeA = a.shape;
	var shapeOut = shapeA.slice(0);
	shapeOut[axis] *= repeats;
	if (typeof out === "undefined") {
		out = new NDArray(shapeOut, a.dataType, this);
		out._id = allocator.newArrayId();
	} else {
		util.checkNDArray(out, "out");
		util.checkShapesCompatibility(out.shape, shapeOut);
		util.checkDataTypesCompatibility(a.dataType, out.dataType);
	}
	this._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": "repeat",
		"a": a._id,
		"out": out._id,
		"repeats": repeats,
		"axis": axis
	});
	return out;
};

PNaClContext.prototype._invalidate = function(array) {
	util.checkNDArray(array, "array");
	this._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": "release",
		"in": array._id
	});
};

PNaClContext.prototype.get = function() {
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
	for (var i = 0; i < callbackWaitArguments; i++) {
		var array = arguments[i];
		var idx = i;
		var messageId = allocator.newMessageId();
		if (array.shape.length === 0) {
			messageCallbacks[messageId] = function(buffer) {
				var typedArray = new array.dataType.arrayType(buffer);
				callbackArguments[idx] = typedArray[0];
				if (--callbackWaitArguments === 0) {
					callback.apply(null, callbackArguments);
				}
			};
		} else {
			messageCallbacks[messageId] = function(buffer) {
				var jsarray = new Array(array.shape[0]);
				util.createArrayRecursive(new array.dataType.arrayType(buffer), jsarray, array.shape, 0, 0);
				callbackArguments[idx] = jsarray;
				if (--callbackWaitArguments === 0) {
					callback.apply(null, callbackArguments);
				}
			};
		}
		this._pnaclObject.postMessage({
			"id": messageId,
			"command": "get",
			"in": array._id
		});
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
		out = new NDArray(shape, dataType, context);
		out._id = allocator.newArrayId();
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray");
	}
	if (a instanceof NDArray) {
		if (b instanceof NDArray) {
			context._pnaclObject.postMessage({
				"id": allocator.newMessageId(),
				"command": operation,
				"a": a._id,
				"b": b._id,
				"out": out._id
			});
		} else {
			context._pnaclObject.postMessage({
				"id": allocator.newMessageId(),
				"command": operation + "c",
				"a": a._id,
				"b": b,
				"out": out._id
			});
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
		out = new NDArray(shape, dataType, context);
		out._id = allocator.newArrayId();
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray");
	}
	context._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": operation,
		"a": a._id,
		"out": out._id
	});
	return out;
};

var reduceArithOp = function(a, out, context, operation) {
	var dataType = null;
	if (a instanceof NDArray) {
		dataType = a.dataType;
	} else {
		throw new TypeError("Unsupported type of a");
	}
	if (typeof out === "undefined") {
		out = new NDArray([], dataType, context);
		out._id = allocator.newArrayId();
	} else if (out instanceof NDArray) {
		util.checkShapesCompatibility(out.shape, []);
	} else {
		throw new TypeError("out is not an NDArray");
	}
	context._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": operation,
		"a": a._id,
		"out": out._id
	});
	return out;
};

var axisReduceArithOp = function(a, axis, out, context, operation) {
	var dataType = null;
	if (a instanceof NDArray) {
		dataType = a.dataType;
	} else {
		throw new TypeError("Unsupported type of a");
	}
	util.checkAxis(axis);
	if (typeof out === "undefined") {
		out = new NDArray(util.computeAxisReductionOutShape(a.shape, axis), dataType, context);
		out._id = allocator.newArrayId();
	} else if (out instanceof NDArray) {
		util.checkAxisReductionOutShape(a.shape, out.shape, axis);
	} else {
		throw new TypeError("out is not an NDArray");
	}
	context._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": operation,
		"a": a._id,
		"axis": axis|0,
		"out": out._id
	});
	return out;
};

var dotArithOp = function(a, b, out, context) {
	var dataType = null;
	if (a instanceof NDArray) {
		dataType = a.dataType;
	} else {
		throw new TypeError("Unsupported type of a");
	}
	if (b instanceof NDArray) {
		util.checkDataTypesCompatibility(dataType, b.dataType);
	} else {
		throw new TypeError("Unsupported type of b");
	}
	if (typeof out === "undefined") {
		var shapeA = a.shape;
		var shapeB = b.shape;
		var axisA = Math.max(shapeA.length - 1, 0);
		var axisB = Math.max(shapeB.length - 2, 0);
		if (shapeA[axisA] != shapeB[axisB]) {
			throw new TypeError("Mismatch in reduction dimensions");
		}
		var shapeOut = [];
		for (var i = 0; i < axisA; i++) {
			shapeOut.push(shapeA[i]);
		}
		if (shapeB.length > 1) {
			for (var i = 0; i < axisB; i++) {
				shapeOut.push(shapeB[i]);
			}
			shapeOut.push(shapeB[shapeB.length - 1]);
		}
		out = new NDArray(shapeOut, dataType, context);
		out._id = allocator.newArrayId();
	} else if (out instanceof NDArray) {
		throw new Error("Not implemented");
	} else {
		throw new TypeError("out is not an NDArray");
	}
	context._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": "dot",
		"a": a._id,
		"b": b._id,
		"out": out._id
	});
	return out;
};

PNaClContext.prototype.add = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "add");
};

PNaClContext.prototype.sub = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "sub");
};

PNaClContext.prototype.mul = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "mul");
};

PNaClContext.prototype.div = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "div");
};

PNaClContext.prototype.neg = function(a, out) {
	return unaryArithOp(a, out, this, "neg");
};

PNaClContext.prototype.abs = function(a, out) {
	return unaryArithOp(a, out, this, "abs");
};

PNaClContext.prototype.exp = function(a, out) {
	return unaryArithOp(a, out, this, "exp");
};

PNaClContext.prototype.log = function(a, out) {
	return unaryArithOp(a, out, this, "log");
};

PNaClContext.prototype.sqrt = function(a, out) {
	return unaryArithOp(a, out, this, "sqrt");
};

PNaClContext.prototype.square = function(a, out) {
	return unaryArithOp(a, out, this, "square");
};

PNaClContext.prototype.min = function(a, axis) {
	if (typeof axis === "undefined") {
		return reduceArithOp(a, undefined, this, "min");
	} else if (util.isInt(axis)) {
		return axisReduceArithOp(a, axis, undefined, this, "amin");
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

PNaClContext.prototype.max = function(a, axis) {
	if (typeof axis === "undefined") {
		return reduceArithOp(a, undefined, this, "max");
	} else if (util.isInt(axis)) {
		return axisReduceArithOp(a, axis, undefined, this, "amax");
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

PNaClContext.prototype.sum = function(a, axis) {
	if (typeof axis === "undefined") {
		return reduceArithOp(a, undefined, this, "sum");
	} else if (util.isInt(axis)) {
		return axisReduceArithOp(a, axis, undefined, this, "asum");
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

PNaClContext.prototype.dot = function(a, b, out) {
	return dotArithOp(a, b, out, this);
};

module.exports = PNaClContext;
