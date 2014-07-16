"use strict";

var NDArray = require("./NDArray");
var DataType = require("./DataType");
var allocator = require("./allocator");
var util = require("./util");

var scriptDirectory = "";
try {
	var scripts = document.getElementsByTagName("script");
	for (var i = scripts.length - 1; i >= 0; --i) {
		var path = scripts[i].src;
		/* Remove url-encoded parameters */
		path = path.split("?")[0];
		var separatorPos = path.lastIndexOf("/");
		var scriptName = path.substring(separatorPos + 1);
		if ((scriptName === "furious.js") || (scriptName === "furious.min.js")){
			scriptDirectory = path.substring(0, separatorPos + 1);
			break;
		}
	}
} catch (e) {
}

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
			delete result.status;
			delete result.id;
			messageCallbacks[id](result);
		}
		delete messageCallbacks[id];
	}
};

function PNaClContext(options, callback) {
	var context = this;
	this._pnaclObject = document.createElement("object");
	this._pnaclObject.width = 0;
	this._pnaclObject.height = 0;
	this._pnaclObject.data = PNaClContext.getDefaultManifestURL();
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

PNaClContext.isSupported = function() {
	try {
		return (typeof navigator.mimeTypes["application/x-pnacl"]) !== "undefined";
	} catch (e) {
	}
	return false;
};

PNaClContext.getDefaultManifestURL = function() {
	return scriptDirectory + "furious.nmf";
};

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

PNaClContext.prototype.zeros = function(shape, dataType) {
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
		"command": "zeros",
		"shape": new Uint32Array(shape).buffer,
		"datatype": dataType.type,
		"out": array._id
	});
	return array;
};

PNaClContext.prototype.ones = function(shape, dataType) {
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
		"command": "ones",
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

PNaClContext.prototype.reshape = function(a, shape) {
	util.checkNDArray(a, "a");
	shape = util.checkShape(shape);
	if (util.computeLength(shape) !== a.length) {
		throw new RangeError("The shape is not compatible with the array");
	}
	var releaseArray = !a._decRef();
	var out = new NDArray(shape, a.dataType, this);
	if (releaseArray) {
		out._id = a._id;
		releaseArray = false;
	} else {
		out._id = allocator.newArrayId();
	}
	this._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": "reshape",
		"a": (releaseArray ? -a._id : a._id),
		"out": out._id,
		"shape": new Uint32Array(shape).buffer
	});
	return out;
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
		out._incRef();
	}
	var releaseA = !a._decRef();
	this._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": "repeat",
		"a": (releaseA ? -a._id : a._id),
		"out": out._id,
		"repeats": repeats,
		"axis": axis
	});
	return out;
};

PNaClContext.prototype._invalidate = function(array) {
	if (array._id !== 0) {
		this._pnaclObject.postMessage({
			"id": allocator.newMessageId(),
			"command": "free",
			"in": array._id
		});
	}
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
	for (var i = 0; i < arguments.length - 1; ++i) {
		util.checkNDArray(arguments[i], "argument " + i);
	}
	var release = new Array(arguments.length - 1);
	for (var i = 0; i < arguments.length - 1; ++i) {
		release[i] = !arguments[i]._decRef();
	}
	var callbackWaitArguments = arguments.length - 1;
	var callbackArguments = new Array(callbackWaitArguments);
	for (var i = 0; i < callbackWaitArguments; i++) {
		var array = arguments[i];
		var messageId = allocator.newMessageId();
		if (array.shape.length === 0) {
			messageCallbacks[messageId] = (function(i, ArrayType) {
				return function(buffer) {
					var typedArray = new ArrayType(buffer);
					callbackArguments[i] = typedArray[0];
					if (--callbackWaitArguments === 0) {
						callback.apply(null, callbackArguments);
					}
				};
			})(i, array.dataType.arrayType);
		} else {
			messageCallbacks[messageId] = (function(i, ArrayType, shape) {
				return function(buffer) {
					var jsarray = new Array(shape[0]);
					util.createArrayRecursive(new ArrayType(buffer), jsarray, shape, 0, 0);
					callbackArguments[i] = jsarray;
					if (--callbackWaitArguments === 0) {
						callback.apply(null, callbackArguments);
					}
				};
			})(i, array.dataType.arrayType, array.shape);
		}
		this._pnaclObject.postMessage({
			"id": messageId,
			"command": "get",
			"in": (release[i] ? -array._id : array._id)
		});
	}
};

PNaClContext.prototype.info = function(callback) {
	var messageId = allocator.newMessageId();
	messageCallbacks[messageId] = callback;
	this._pnaclObject.postMessage({
		"id": messageId,
		"command": "info"
	});
};

var binaryArithOp = function(a, b, out, context, operation) {
	var shapeOut = null, dataTypeOut = null, releaseA = false, releaseB = false;
	if (a instanceof NDArray) {
		shapeOut = a.shape;
		dataTypeOut = a.dataType;
		if (b instanceof NDArray) {
			util.checkShapesCompatibility(a.shape, b.shape);
			util.checkDataTypesCompatibility(a.dataType, b.dataType);
		} else if (!util.isNumber(b)) {
			throw new TypeError("Unsupported type of b");
		}
	} else if (util.isNumber(a)) {
		shapeOut = b.shape;
		dataTypeOut = b.dataType;
		util.checkNDArray(b, "b");
	} else {
		throw new TypeError("Unsupported type of a");
	}
	if (a instanceof NDArray) {
		releaseA = !a._decRef();
	}
	if (b instanceof NDArray) {
		releaseB = !b._decRef();
	}
	try {
		if (typeof out === "undefined") {
			out = new NDArray(shapeOut, dataTypeOut, context);
			if (releaseA) {
				out._id = a._id;
				releaseA = false;
			} else if (releaseB) {
				out._id = b._id;
				releaseB = false;
			} else {
				out._id = allocator.newArrayId();
			}
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(shapeOut, out.shape);
			util.checkDataTypesCompatibility(dataTypeOut, out.dataType);
			out._incRef();
		}
		if (a instanceof NDArray) {
			if (b instanceof NDArray) {
				context._pnaclObject.postMessage({
					"id": allocator.newMessageId(),
					"command": operation,
					"a": (releaseA ? -a._id : a._id),
					"b": (releaseB ? -b._id : b._id),
					"out": out._id
				});
			} else {
				context._pnaclObject.postMessage({
					"id": allocator.newMessageId(),
					"command": operation + "c",
					"a": (releaseA ? -a._id : a._id),
					"b": b,
					"out": out._id
				});
			}
		} else {
			if ((operation == "add") || (operation == "mul")) {
				/* Commutative operation: flip the operands */
				context._pnaclObject.postMessage({
					"id": allocator.newMessageId(),
					"command": operation + "c",
					"a": (releaseB ? -b._id : b._id),
					"b": a,
					"out": out._id
				});
			} else {
				context._pnaclObject.postMessage({
					"id": allocator.newMessageId(),
					"command": "r" + operation + "c",
					"a": b,
					"b": (releaseA ? -a._id : a._id),
					"out": out._id
				});
			}
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
	return out;
};

var unaryArithOp = function(a, out, context, operation) {
	util.checkNDArray(a, "a");
	var releaseA = !a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, context);
			if (releaseA) {
				out._id = a._id;
				releaseA = false;
			} else {
				out._id = allocator.newArrayId();
			}
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(a.shape, out.shape);
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			out._incRef();
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	context._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": operation,
		"a": (releaseA ? -a._id : a._id),
		"out": out._id
	});
	return out;
};

var reduceArithOp = function(a, out, context, operation) {
	util.checkNDArray(a, "a");
	var releaseA = !a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray([], a.dataType, context);
			out._id = allocator.newArrayId();
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(out.shape, []);
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			out._incRef();
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	context._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": operation,
		"a": (releaseA ? -a._id : a._id),
		"out": out._id
	});
	return out;
};

var axisReduceArithOp = function(a, axis, out, context, operation) {
	util.checkNDArray(a, "a");
	var releaseA = !a._decRef();
	try {
		util.checkAxis(axis);
		if (typeof out === "undefined") {
			out = new NDArray(util.computeAxisReductionOutShape(a.shape, axis), a.dataType, context);
			out._id = allocator.newArrayId();
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(out.shape, []);
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			out._incRef();
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	context._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": operation,
		"a": (releaseA ? -a._id : a._id),
		"axis": axis|0,
		"out": out._id
	});
	return out;
};

var dotArithOp = function(a, b, out, context) {
	util.checkNDArray(a, "a");
	util.checkNDArray(b, "b");
	util.checkDataTypesCompatibility(a.dataType, b.dataType);
	var releaseA = !a._decRef();
	var releaseB = !b._decRef();
	try {
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
			out = new NDArray(shapeOut, a.dataType, context);
			out._id = allocator.newArrayId();
		} else if (out instanceof NDArray) {
			util.checkNDArray(out, "out");
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			throw new Error("Not implemented");
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		b._incRef();
		throw e;
	}
	context._pnaclObject.postMessage({
		"id": allocator.newMessageId(),
		"command": "dot",
		"a": (releaseA ? -a._id : a._id),
		"b": (releaseB ? -b._id : b._id),
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
