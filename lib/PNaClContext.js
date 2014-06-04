var NDArray = require("./NDArray");
var DataType = require("./DataType");
var allocator = require("./allocator");
var util = require("./util");

var shapeToLength = function(shape) {
	length = 1;
	for (var i = 0; i < shape.length; i++) {
		length *= shape[i];
	}
	return length;
}

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
}

var pnacl = null;
var messageCallbacks = {};

var onPNaClMessage = function(message) {
	var result = message.data;
	var id = result.id;
	if (id in messageCallbacks) {
		if ('buffer' in result) {
			messageCallbacks[id](result.buffer);
		} else {
			messageCallbacks[id]();
		}
		delete messageCallbacks[id];
	}
}

function PNaClContext(callback) {
	if (pnacl == null) {
		var context = this;
		pnacl = document.createElement('object');
		pnacl.width = 0;
		pnacl.height = 0;
		pnacl.data = "numjs.nmf";
		pnacl.type = "application/x-pnacl";
		pnacl.addEventListener('load', function () {
			callback(context);
		}, true);
		pnacl.addEventListener('message', onPNaClMessage, true);
		document.body.appendChild(pnacl);
	} else {
		callback(this);
	}
}

PNaClContext.prototype.empty = function(shape, dataType) {
	if (!util.isPositiveIntArray(shape) && !util.isPositiveInt(shape)) {
		throw new TypeError(shape + " is not a valid array shape");
	}
	if (typeof dataType === 'undefined') {
		dataType = new DataType('f64');
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var array = new NDArray(shape, dataType, this);
	array.id = allocator.newArrayId();
	pnacl.postMessage({
		"id": allocator.newMessageId(),
		"command": "create",
		"shape": new Uint32Array(shape).buffer,
		"datatype": dataType.type,
		"out": array.id
	});
	return array;
}

function discoverArrayShapeRecursive(data, shape, level) {
	if (util.isArray(data)) {
		if (shape.length <= level) {
			/* Discovered a new level of sub-arrays. Record its dimension. */
			shape.push(data.length);
		} else {
			/* Only check dimension */
			if (shape[level] != data.length) {
				throw new RangeError("Sub-array " + data + " does not match the expected dimension of " + shape[level]);
			}
		}
		for (var i = 0; i < data.length; i++) {
			discoverArrayShapeRecursive(data[i], shape, level + 1);
		}
	} else {
		if (level != shape.length) {
			throw new RangeError("Sub-array [" + data + "] does not match the expected dimension of " + shape[level]);
		}
		if (!util.isNumber(data)) {
			throw new ValueError("Non-numeric element: " + data);
		}
	}
}

function copyArrayDataRecursive(dataBuffer, dataArray, shape, level, offset) {
	var n = shape[level];
	if (level === shape.length - 1) {
		dataBuffer.set(dataArray, offset * n);
	} else {
		for (var i = 0; i < n; i++) {
			copyArrayDataRecursive(dataBuffer, dataArray[i], shape, level + 1, offset * n  + i);
		}
	}
}

PNaClContext.prototype.array = function(data, dataType) {
	var shape = [];
	discoverArrayShapeRecursive(data, shape, 0);
	if (typeof dataType === 'undefined') {
		dataType = new DataType('f64');
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var ndarray = new NDArray(shape, dataType, this);
	var buffer = new dataType.arrayType(ndarray.length);
	copyArrayDataRecursive(buffer, data, shape, 0, 0);
	ndarray.id = allocator.newArrayId();
	pnacl.postMessage({
		"id": allocator.newMessageId(),
		"command": "create-from-buffer",
		"shape": new Uint32Array(shape).buffer,
		"datatype": dataType.type,
		"buffer": buffer.buffer,
		"out": ndarray.id
	});
	return ndarray;
}

PNaClContext.prototype.release = function(ndarray) {
	if (!(ndarray instanceof NDArray)) {
		throw new TypeError(ndarray + " is not an NDArray");
	}
	pnacl.postMessage({
		"id": allocator.newMessageId(),
		"command": "release",
		"in": ndarray.id
	});
	delete ndarray.id;
}

var createArrayRecursive = function(dataBuffer, dataArray, shape, level, offset) {
	var n = shape[level];
	if (level === shape.length - 1) {
		for (var i = 0; i < n; i++) {
			dataArray[i] = dataBuffer[offset * n + i];
		}
	} else {
		for (var i = 0; i < n; i++) {
			dataArray[i] = new Array(shape[level + 1]);
			createArrayRecursive(dataBuffer, dataArray[i], shape, level + 1, offset * n  + i);
		}
	}
}

PNaClContext.prototype.toArray = function(ndarray, callback) {
	if (!(ndarray instanceof NDArray)) {
		throw new TypeError(ndarray + " is not an NDArray");
	}
	var messageId = allocator.newMessageId();
	messageCallbacks[messageId] = function(buffer) {
		var jsarray = new Array(ndarray.shape[0]);
		createArrayRecursive(new ndarray.dataType.arrayType(buffer), jsarray, ndarray.shape, 0, 0);
		callback(jsarray);
	};
	pnacl.postMessage({
		"id": messageId,
		"command": "get-buffer",
		"in": ndarray.id
	});
}

var binaryArithOp = function(a, b, out, context, operation) {
	if (a instanceof NDArray) {
		var shape = a.shape;
		var dataType = a.dataType;
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
		out.id = allocator.newArrayId();
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray")
	}
	if (a instanceof NDArray) {
		if (b instanceof NDArray) {
			pnacl.postMessage({
				"id": allocator.newMessageId(),
				"command": operation,
				"a": a.id,
				"b": b.id,
				"out": out.id
			});
		} else {
			pnacl.postMessage({
				"id": allocator.newMessageId(),
				"command": operation + "c",
				"a": a.id,
				"b": b,
				"out": out.id
			});
		}
	}
	return out;
}

var unaryArithOp = function(a, out, context, operation) {
	if (a instanceof NDArray) {
		var shape = a.shape;
		var dataType = a.dataType;
	} else {
		throw new TypeError("Unsupported type of a");
	}
	if (typeof out === "undefined") {
		out = context.empty(shape, dataType);
		out.id = allocator.newArrayId();
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray")
	}
	pnacl.postMessage({
		"id": allocator.newMessageId(),
		"command": operation,
		"a": a.id,
		"out": out.id
	});
	return out;
}

PNaClContext.prototype.add = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "add");
}

PNaClContext.prototype.sub = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "sub");
}

PNaClContext.prototype.mul = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "mul");
}

PNaClContext.prototype.div = function(a, b, out) {
	return binaryArithOp(a, b, out, this, "div");
}

PNaClContext.prototype.neg = function(a, out) {
	return unaryArithOp(a, out, this, "neg");
}

PNaClContext.prototype.abs = function(a, out) {
	return unaryArithOp(a, out, this, "abs");
}

PNaClContext.prototype.exp = function(a, out) {
	return unaryArithOp(a, out, this, "exp");
}

PNaClContext.prototype.log = function(a, out) {
	return unaryArithOp(a, out, this, "log");
}

PNaClContext.prototype.sqrt = function(a, out) {
	return unaryArithOp(a, out, this, "sqrt");
}

PNaClContext.prototype.square = function(a, out) {
	return unaryArithOp(a, out, this, "square");
}

module.exports = PNaClContext;
