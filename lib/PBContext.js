"use strict";

var NDArray = require("./NDArray");
var DataType = require("./DataType");
var allocator = require("./allocator");
var util = require("./util");
var requests = require("./requests.pb");
var Request = requests.Request;
var EmptyArrayRequest = requests.EmptyArrayRequest;
var DataArrayRequest = requests.DataArrayRequest;
var ConstArrayRequest = requests.ConstArrayRequest;
var IdentityMatrixRequest = requests.IdentityMatrixRequest;
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
var CholeskyDecompositionRequest = requests.CholeskyDecompositionRequest;
var SolveTriangularRequest = requests.SolveTriangularRequest;
var Response = require("./responses.pb").Response;

var dataTypeMap = {
	"f32": requests.DataType.FLOAT32,
	"f64": requests.DataType.FLOAT64
};

function PBContext(options, postMessage, callback) {
	var context = this;
	this._postMessage = postMessage;
	this._callbacks = {};
	this._callbacks[0] = function(limits) {
		callback(context, limits);
	};
}

PBContext.prototype._onMessage = function(message) {
	var response = Response.decode(message.data);
	var id = response.id;
	var callback = this._callbacks[id];
	delete this._callbacks[id];
	switch (response.type) {
		case Response.Type.INIT:
			var limits = {};
			var initResponse = response.initResponse;
			if (initResponse.concurrency !== null) {
				limits.concurrency = initResponse.concurrency;
			}
			callback(limits);
			break;
		case Response.Type.BARRIER:
			callback();
			break;
		case Response.Type.FETCH:
			callback(response.fetchResponse.dataBuffer.toArrayBuffer());
			break;
		case Response.Type.ERROR:
			break;
		case Response.Type.INFO:
			break;
	}
};

PBContext.prototype.empty = function(shape, dataType) {
	shape = util.checkShape(shape);
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var array = new NDArray(shape, dataType, this);
	array._id = allocator.newArrayId();

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.EMPTY_ARRAY;
	var emptyArrayRequest = new EmptyArrayRequest();
	emptyArrayRequest.idOut = array._id;
	emptyArrayRequest.shape = shape;
	emptyArrayRequest.dataType = dataTypeMap[dataType.type];
	request.emptyArrayRequest = emptyArrayRequest;
	this._postMessage(request.encodeAB());

	return array;
};

PBContext.prototype.zeros = function(shape, dataType) {
	shape = util.checkShape(shape);
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var array = new NDArray(shape, dataType, this);
	array._id = allocator.newArrayId();

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.CONST_ARRAY;
	var constArrayRequest = new ConstArrayRequest();
	constArrayRequest.idOut = array._id;
	constArrayRequest.shape = shape;
	constArrayRequest.dataType = dataTypeMap[dataType.type];
	constArrayRequest.fillValue = 0.0;
	request.constArrayRequest = constArrayRequest;
	this._postMessage(request.encodeAB());

	return array;
};

PBContext.prototype.ones = function(shape, dataType) {
	shape = util.checkShape(shape);
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var array = new NDArray(shape, dataType, this);
	array._id = allocator.newArrayId();

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.CONST_ARRAY;
	var constArrayRequest = new ConstArrayRequest();
	constArrayRequest.idOut = array._id;
	constArrayRequest.shape = shape;
	constArrayRequest.dataType = dataTypeMap[dataType.type];
	constArrayRequest.fillValue = 1.0;
	request.constArrayRequest = constArrayRequest;
	this._postMessage(request.encodeAB());

	return array;
};

PBContext.prototype.eye = function(rows, columns, diagonal, dataType) {
	rows = util.checkDimension(rows, "rows");
	if (typeof columns === "undefined") {
		columns = rows;
	} else {
		columns = util.checkDimension(columns, "columns");
	}
	if (typeof diagonal === "undefined") {
		diagonal = 0;
	} else {
		diagonal = util.checkInt(diagonal);
	}
	if ((diagonal >= columns) || (diagonal <= -rows)) {
		throw new RangeError("diagonal is out of range");
	}
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else {
		dataType = util.checkDataType(dataType);
	}
	var arrayOut = new NDArray([rows, columns], dataType, this);
	arrayOut._id = allocator.newArrayId();

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.IDENTITY_MATRIX;
	var identityMatrixRequest = new IdentityMatrixRequest();
	identityMatrixRequest.idOut = arrayOut._id;
	identityMatrixRequest.rows = rows;
	identityMatrixRequest.columns = columns;
	identityMatrixRequest.diagonal = diagonal;
	identityMatrixRequest.dataType = dataTypeMap[dataType.type];
	request.identityMatrixRequest = identityMatrixRequest;
	this._postMessage(request.encodeAB());

	return arrayOut;
};

PBContext.prototype.array = function(data, dataType) {
	var shape = [];
	util.discoverArrayShapeRecursive(data, shape, 0);
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var array = new NDArray(shape, dataType, this);
	array._id = allocator.newArrayId();
	var arrayBuffer = new dataType.arrayType(array.length);
	util.copyArrayDataRecursive(arrayBuffer, data, shape, 0, 0);

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.DATA_ARRAY;
	var dataArrayRequest = new DataArrayRequest();
	dataArrayRequest.idOut = array._id;
	dataArrayRequest.shape = shape;
	dataArrayRequest.dataType = dataTypeMap[dataType.type];
	dataArrayRequest.dataBuffer = arrayBuffer.buffer;
	request.dataArrayRequest = dataArrayRequest;
	this._postMessage(request.encodeAB());

	return array;
};

PBContext.prototype.linspace = function(start, stop, samples, includeStop) {
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

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.LINSPACE;
	var linspaceRequest = new LinspaceRequest();
	linspaceRequest.idOut = array._id;
	linspaceRequest.start = start;
	linspaceRequest.stop = stop;
	linspaceRequest.samples = samples;
	linspaceRequest.closed = includeStop;
	linspaceRequest.dataType = dataTypeMap[dataType.type];
	request.linspaceRequest = linspaceRequest;
	this._postMessage(request.encodeAB());

	return array;
};

PBContext.prototype.reshape = function(a, shape) {
	util.checkNDArray(a, "a");
	shape = util.checkShape(shape);
	if (util.computeLength(shape) !== a.length) {
		throw new RangeError("The shape is not compatible with the array");
	}
	var idA = a._id;
	var releaseA = !a._decRef();
	var out = new NDArray(shape, a.dataType, this);
	if (releaseA) {
		out._id = idA;
		a._id = 0;
		releaseA = false;
	} else {
		out._id = allocator.newArrayId();
	}

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.RESHAPE;
	var reshapeRequest = new ReshapeRequest();
	reshapeRequest.idA = idA;
	reshapeRequest.idOut = out._id;
	reshapeRequest.shapeOut = shape;
	request.reshapeRequest = reshapeRequest;
	this._postMessage(request.encodeAB());

	a._tryInvalidate();
	return out;
};

PBContext.prototype.repeat = function(a, repeats, axis, out) {
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
	var idA = a._id;
	if (!a._decRef()) {
		idA = -idA;
		a._id = 0;
	}

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.REPEAT;
	var repeatRequest = new RepeatRequest();
	repeatRequest.idA = idA;
	repeatRequest.idOut = out._id;
	repeatRequest.axis = axis;
	repeatRequest.repeats = repeats;
	request.repeatRequest = repeatRequest;
	this._postMessage(request.encodeAB());

	a._tryInvalidate();
	return out;
};

PBContext.prototype._invalidate = function(array) {
	if (array._id !== 0) {
		var request = new Request();
		request.id = allocator.newMessageId();
		request.type = Request.Type.DEALLOCATE;
		var deallocateRequest = new DeallocateRequest();
		deallocateRequest.idA = array._id;
		request.deallocateRequest = deallocateRequest;
		this._postMessage(request.encodeAB());
	}
};

PBContext.prototype.fetch = function() {
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
		this._callbacks[messageId] = (function(i, ArrayType) {
			return function(buffer) {
				callbackArguments[i] = new ArrayType(buffer);
				if (--callbackWaitArguments === 0) {
					callback.apply(null, callbackArguments);
				}
			};
		})(i, array.dataType.arrayType);
		var arrayId = array._id;
		if (release[i]) {
			array._id = 0;
			arrayId = -arrayId;
			array._tryInvalidate();
		}

		var request = new Request();
		request.id = messageId;
		request.type = Request.Type.FETCH;
		var fetchRequest = new FetchRequest();
		fetchRequest.idA = arrayId;
		request.fetchRequest = fetchRequest;
		this._postMessage(request.encodeAB());
	}
};

PBContext.prototype.get = function() {
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
			this._callbacks[messageId] = (function(i, ArrayType) {
				return function(buffer) {
					var typedArray = new ArrayType(buffer);
					callbackArguments[i] = typedArray[0];
					if (--callbackWaitArguments === 0) {
						callback.apply(null, callbackArguments);
					}
				};
			})(i, array.dataType.arrayType);
		} else {
			this._callbacks[messageId] = (function(i, ArrayType, shape) {
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
		var arrayId = array._id;
		if (release[i]) {
			array._id = 0;
			arrayId = -arrayId;
			array._tryInvalidate();
		}

		var request = new Request();
		request.id = messageId;
		request.type = Request.Type.FETCH;
		var fetchRequest = new FetchRequest();
		fetchRequest.idA = arrayId;
		request.fetchRequest = fetchRequest;
		this._postMessage(request.encodeAB());
	}
};

PBContext.prototype.info = function(callback) {
	throw new Error("Not implemented");
/*	var messageId = allocator.newMessageId();
	messageCallbacks[messageId] = callback;
	this._pnaclObject.postMessage({
		"id": messageId,
		"command": "info"
	});*/
};

PBContext.prototype.barrier = function(callback) {
	var messageId = allocator.newMessageId();
	this._callbacks[messageId] = callback;

	var request = new Request();
	request.id = messageId;
	request.type = Request.Type.BARRIER;
	this._postMessage(request.encodeAB());
};

var binaryArithOp = function(a, b, out, context, operation, constOperation, revConstOperation) {
	var shapeOut = null, dataTypeOut = null, releaseIdA = false, releaseIdB = false, idA = 0, idB = 0;
	if (a instanceof NDArray) {
		idA = a._id;
		shapeOut = a.shape;
		dataTypeOut = a.dataType;
		if (b instanceof NDArray) {
			idB = b._id;
			util.checkShapesCompatibility(a.shape, b.shape);
			util.checkDataTypesCompatibility(a.dataType, b.dataType);
		} else if (!util.isNumber(b)) {
			throw new TypeError("Unsupported type of b");
		}
	} else if (util.isNumber(a)) {
		idB = b._id;
		shapeOut = b.shape;
		dataTypeOut = b.dataType;
		util.checkNDArray(b, "b");
	} else {
		throw new TypeError("Unsupported type of a");
	}
	/* The IDs of a and b must be invalidated before we assign ID to out because a/b and out may be the same arrays */
	if (idA !== 0) {
		releaseIdA = !a._decRef();
		if (releaseIdA) {
			a._id = 0;
		}
	}
	if (idB !== 0) {
		releaseIdB = !b._decRef();
		if (releaseIdB) {
			b._id = 0;
		}
	}
	try {
		if (typeof out === "undefined") {
			out = new NDArray(shapeOut, dataTypeOut, context);
			if (releaseIdA) {
				out._id = idA;
				releaseIdA = false;
			} else if (releaseIdB) {
				out._id = idB;
				releaseIdB = false;
			} else {
				out._id = allocator.newArrayId();
			}
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(shapeOut, out.shape);
			util.checkDataTypesCompatibility(dataTypeOut, out.dataType);
			out._incRef();
		}
		var request = new Request();
		request.id = allocator.newMessageId();
		if (idA !== 0) {
			if (idB !== 0) {
				request.type = Request.Type.BINARY_OPERATION;
				var binaryOperationRequest = new BinaryOperationRequest();
				binaryOperationRequest.type = operation;
				binaryOperationRequest.idA = (releaseIdA ? -idA : idA);
				binaryOperationRequest.idB = (releaseIdB ? -idB : idB);
				binaryOperationRequest.idOut = out._id;
				request.binaryOperationRequest = binaryOperationRequest;
				context._postMessage(request.encodeAB());
			} else {
				request.type = Request.Type.BINARY_CONST_OPERATION;
				var binaryConstOperationRequest = new BinaryConstOperationRequest();
				binaryConstOperationRequest.type = constOperation;
				binaryConstOperationRequest.idA = (releaseIdA ? -idA : idA);
				binaryConstOperationRequest.valueB = b;
				binaryConstOperationRequest.idOut = out._id;
				request.binaryConstOperationRequest = binaryConstOperationRequest;
				context._postMessage(request.encodeAB());
			}
		} else {
			request.type = Request.Type.BINARY_CONST_OPERATION;
			var binaryConstOperationRequest = new BinaryConstOperationRequest();
			binaryConstOperationRequest.type = revConstOperation;
			binaryConstOperationRequest.idA = (releaseIdB ? -idB : idB);
			binaryConstOperationRequest.valueB = a;
			binaryConstOperationRequest.idOut = out._id;
			request.binaryConstOperationRequest = binaryConstOperationRequest;
			context._postMessage(request.encodeAB());
		}
	} catch (e) {
		/* Restore the previous state */
		if (idA !== 0) {
			a._id = idA;
			a._incRef();
		}
		if (idB !== 0) {
			b._id = idB;
			b._incRef();
		}
		throw e;
	}
	/*
	 * If a or b are arrays, invalidate them as needed.
	 * If a/b and out are the same, their ref count is non-zero at this point, so they will stay valid.
	 */
	if (idA !== 0) {
		a._tryInvalidate();
	}
	if (idB !== 0) {
		b._tryInvalidate();
	}
	return out;
};

var unaryArithOp = function(a, out, context, operation) {
	util.checkNDArray(a, "a");
	var idA = a._id;
	var releaseIdA = !a._decRef();
	/* The ID of a must be invalidated before we assign ID to out because a and out may be the same arrays */
	if (releaseIdA) {
		a._id = 0;
	}
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, context);
			if (releaseIdA) {
				out._id = idA;
				releaseIdA = false;
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
		a._id = idA;
		a._incRef();
		throw e;
	}

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.UNARY_OPERATION;
	var unaryOperationRequest = new UnaryOperationRequest();
	unaryOperationRequest.type = operation;
	unaryOperationRequest.idA = (releaseIdA ? -idA : idA);
	unaryOperationRequest.idOut = out._id;
	request.unaryOperationRequest = unaryOperationRequest;
	context._postMessage(request.encodeAB());

	/* If a and out are the same, their ref count is non-zero at this point, so they will stay valid. */
	a._tryInvalidate();
	return out;
};

var reduceArithOp = function(a, out, context, operation) {
	util.checkNDArray(a, "a");
	var idA = a._id;
	var releaseIdA = !a._decRef();
	if (releaseIdA) {
		a._id = 0;
	}
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
		a._id = idA;
		a._incRef();
		throw e;
	}

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.REDUCTION_OPERATION;
	var reductionRequest = new ReductionRequest();
	reductionRequest.type = operation;
	reductionRequest.idA = (releaseIdA ? -idA : idA);
	reductionRequest.idOut = out._id;
	request.reductionRequest = reductionRequest;
	context._postMessage(request.encodeAB());

	a._tryInvalidate();
	return out;
};

var axisReduceArithOp = function(a, axis, out, context, operation) {
	util.checkNDArray(a, "a");
	var idA = a._id;
	var releaseIdA = !a._decRef();
	if (releaseIdA) {
		a._id = 0;
	}
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
		a._id = idA;
		a._incRef();
		throw e;
	}

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.AXIS_REDUCTION_OPERATION;
	var axisReductionRequest = new AxisReductionRequest();
	axisReductionRequest.type = operation;
	axisReductionRequest.idA = (releaseIdA ? -idA : idA);
	axisReductionRequest.axis = axis;
	axisReductionRequest.idOut = out._id;
	request.axisReductionRequest = axisReductionRequest;
	context._postMessage(request.encodeAB());

	a._tryInvalidate();
	return out;
};

var dotArithOp = function(a, b, out, context) {
	util.checkNDArray(a, "a");
	util.checkNDArray(b, "b");
	util.checkDataTypesCompatibility(a.dataType, b.dataType);
	var idA = a._id;
	var releaseIdA = !a._decRef();
	if (releaseIdA) {
		a._id = 0;
	}
	var idB = b._id;
	var releaseIdB = !b._decRef();
	if (releaseIdB) {
		b._id = 0;
	}
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
		a._id = idA;
		a._incRef();
		b._id = idB;
		b._incRef();
		throw e;
	}

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.DOT_OPERATION;
	var dotOperationRequest = new DotOperationRequest();
	dotOperationRequest.idA = (releaseIdA ? -idA : idA);
	dotOperationRequest.idB = (releaseIdB ? -idB : idB);
	dotOperationRequest.idOut = out._id;
	request.dotOperationRequest = dotOperationRequest;
	context._postMessage(request.encodeAB());

	a._tryInvalidate();
	b._tryInvalidate();
	return out;
};

PBContext.prototype.add = function(a, b, out) {
	return binaryArithOp(a, b, out, this,
		BinaryOperationRequest.Type.ADD,
		BinaryConstOperationRequest.Type.ADDC,
		BinaryConstOperationRequest.Type.ADDC);
};

PBContext.prototype.sub = function(a, b, out) {
	return binaryArithOp(a, b, out, this,
		BinaryOperationRequest.Type.SUB,
		BinaryConstOperationRequest.Type.SUBC,
		BinaryConstOperationRequest.Type.SUBRC);
};

PBContext.prototype.mul = function(a, b, out) {
	return binaryArithOp(a, b, out, this,
		BinaryOperationRequest.Type.MUL,
		BinaryConstOperationRequest.Type.MULC,
		BinaryConstOperationRequest.Type.MULC);
};

PBContext.prototype.div = function(a, b, out) {
	return binaryArithOp(a, b, out, this,
		BinaryOperationRequest.Type.DIV,
		BinaryConstOperationRequest.Type.DIVC,
		BinaryConstOperationRequest.Type.DIVRC);
};

PBContext.prototype.neg = function(a, out) {
	return unaryArithOp(a, out, this,
		UnaryOperationRequest.Type.NEG);
};

PBContext.prototype.abs = function(a, out) {
	return unaryArithOp(a, out, this,
		UnaryOperationRequest.Type.ABS);
};

PBContext.prototype.exp = function(a, out) {
	return unaryArithOp(a, out, this,
		UnaryOperationRequest.Type.EXP);
};

PBContext.prototype.log = function(a, out) {
	return unaryArithOp(a, out, this,
		UnaryOperationRequest.Type.LOG);
};

PBContext.prototype.sqrt = function(a, out) {
	return unaryArithOp(a, out, this,
		UnaryOperationRequest.Type.SQRT);
};

PBContext.prototype.square = function(a, out) {
	return unaryArithOp(a, out, this,
		UnaryOperationRequest.Type.SQUARE);
};

PBContext.prototype.min = function(a, axis) {
	if (typeof axis === "undefined") {
		return reduceArithOp(a, undefined, this,
			ReductionRequest.Type.MIN);
	} else if (util.isInt(axis)) {
		return axisReduceArithOp(a, axis, undefined, this,
			AxisReductionRequest.Type.MIN);
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

PBContext.prototype.max = function(a, axis) {
	if (typeof axis === "undefined") {
		return reduceArithOp(a, undefined, this,
			ReductionRequest.Type.MAX);
	} else if (util.isInt(axis)) {
		return axisReduceArithOp(a, axis, undefined, this,
			AxisReductionRequest.Type.MAX);
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

PBContext.prototype.sum = function(a, axis) {
	if (typeof axis === "undefined") {
		return reduceArithOp(a, undefined, this,
			ReductionRequest.Type.SUM);
	} else if (util.isInt(axis)) {
		return axisReduceArithOp(a, axis, undefined, this,
			AxisReductionRequest.Type.SUM);
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

PBContext.prototype.dot = function(a, b, out) {
	return dotArithOp(a, b, out, this);
};

PBContext.prototype.solveTriangular = function(a, b, triangularKind, transposeKind, unitDiagonal, out) {
	util.checkSquare2DArray(a, "a");
	util.checkNDArray(b, "b");
	util.checkDataTypesCompatibility(a.dataType, b.dataType);
	if ((b.shape.length !== 1) && (b.shape.length !== 2)) {
		throw new Error("The right-hand must be a 1D or 2D array");
	}
	if (a.shape[0] != b.shape[0]) {
		throw new Error("The arrays have incompatible shapes");
	}
	transposeKind = util.checkTransposeKind(transposeKind, "N");
	triangularKind = util.checkTriangularKind(triangularKind, "U");
	if (typeof unitDiagonal === "undefined") {
		unitDiagonal = false;
	} else {
		unitDiagonal = !!unitDiagonal;
	}
	var idA = a._id, idB = b._id;
	var releaseIdA = !a._decRef();
	if (releaseIdA) {
		a._id = 0;
	}
	var releaseIdB = !b._decRef();
	if (releaseIdB) {
		b._id = 0;
	}
	try {
		if (typeof out === "undefined") {
			out = new NDArray(b.shape, b.dataType, this);
			if (releaseIdB) {
				out._id = idB;
				releaseIdB = false;
			} else {
				out._id = allocator.newArrayId();
			}
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(b.shape, out.shape);
			util.checkDataTypesCompatibility(b.dataType, out.dataType);
			out._incRef();
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		b._incRef();
		throw e;
	}

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.SOLVE_TRIANGULAR;
	var solveTriangularRequest = new SolveTriangularRequest();
	solveTriangularRequest.idA = (releaseIdA ? -idA : idA);
	solveTriangularRequest.aType = {
		"U": requests.TriangularMatrixType.UPPER,
		"L": requests.TriangularMatrixType.LOWER
	}[triangularKind];
	solveTriangularRequest.aTransposition = {
		"N": requests.TranspositionType.NORMAL,
		"T": requests.TranspositionType.TRANSPOSE
	}[transposeKind];
	solveTriangularRequest.unitDiagonal = unitDiagonal;
	solveTriangularRequest.idY = (releaseIdB ? -idB : idB);
	solveTriangularRequest.idX = out._id;
	request.solveTriangularRequest = solveTriangularRequest;
	this._postMessage(request.encodeAB());

	a._tryInvalidate();
	b._tryInvalidate();
	return out;
};

PBContext.prototype.cholesky = function(a, kind, out) {
	util.checkSquare2DArray(a, "a");
	kind = util.checkTriangularKind(kind, "U");
	var idA = a._id;
	var releaseIdA = !a._decRef();
	if (releaseIdA) {
		a._id = 0;
	}
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, this);
			if (releaseIdA) {
				out._id = idA;
				releaseIdA = false;
			} else {
				out._id = allocator.newArrayId();
			}
		} else {
			util.checkSquare2DArray(out, "out");
			util.checkShapesCompatibility(out.shape, a.shape);
			util.checkDataTypesCompatibility(out.dataType, a.dataType);
			out._incRef();
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}

	var request = new Request();
	request.id = allocator.newMessageId();
	request.type = Request.Type.CHOLESKY_DECOMPOSITION;
	var choleskyDecompositionRequest = new CholeskyDecompositionRequest();
	choleskyDecompositionRequest.idA = (releaseIdA ? -idA : idA);
	choleskyDecompositionRequest.aType = {
		"U": requests.TriangularMatrixType.UPPER,
		"L": requests.TriangularMatrixType.LOWER
	}[kind];
	choleskyDecompositionRequest.idOut = out._id;
	request.choleskyDecompositionRequest = choleskyDecompositionRequest;
	this._postMessage(request.encodeAB());

	a._tryInvalidate();
	return out;
};

module.exports = PBContext;
