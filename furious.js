!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.furious=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";

/**
 * A numerical data type object.
 *
 * @class DataType
 * @constructor
 * @param {String} type - the abbreviated name of the data type. The following names are supported:
 *
 *     <table>
 *         <tr>
 *             <th>Abbreviated Name</th>
 *             <th>Interpretation</th>
 *         </tr>
 *         <tr>
 *             <td>"f32"</td>
 *             <td>Single-precision (32-bit) IEEE-754 floating-point type.</td>
 *         </tr>
 *         <tr>
 *             <td>"f64"</td>
 *             <td>Double-precision (64-bit) IEEE-754 floating-point type.</td>
 *         </tr>
 *     </table>
 *
 */
function DataType(type) {
	if (["f32", "f64"].indexOf(type) >= 0) {
		this.type = type;
		this.size = {"f32": 4, "f64": 8}[type];
		this.epsilon = {"f32": 1.1920928955078125e-7, "f64": 2.2204460492503131e-16}[type];
		this.arrayType = {"f32": Float32Array, "f64": Float64Array}[type];
	} else {
		throw new RangeError("Type " + type + " is not supported");
	}
}

/**
 * Compares two data type objects for equality.
 *
 * @method equals
 * @param {any} other - an object to compare to.
 */
DataType.prototype.equals = function(other) {
	return (other instanceof DataType) && (this.arrayType === other.arrayType);
};

module.exports = DataType;

},{}],2:[function(_dereq_,module,exports){
"use strict";

var util = _dereq_("./util");
var DataType = _dereq_("./DataType");

/**
 * An opaque N-dimensional array object.
 *
 * @class NDArray
 */

/**
 * Constructs an NDArray object without data.
 * Normally this constructor is called from array construction methods of computational contexts.
 * The calling function is responsible for initializing the data for the array.
 *
 * @constructor
 * @private
 */
function NDArray(shape, dataType, context) {
	if (typeof context === "undefined") {
		throw new Error("Context not defined");
	}
	if (!util.isPositiveIntArray(shape) && !util.isPositiveInt(shape)) {
		throw new TypeError(shape + " is not a valid array shape");
	}
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	this.shape = shape;
	this.dataType = dataType;
	this._context = context;
	this.length = util.computeLength(this.shape);
	this._lockCount = 0;
	this._refCount = 1;
	this._isValid = true;
}

/**
 * Locks the array reference counter.
 * While the array is locked, functions and methods that operate on this array do not decrease its reference count.
 * The array can be locked multiple times, and would need just as many unlock calls to lift the lock.
 * If the array is not valid, this operation will fail with an error.
 *
 * @method lock
 * @chainable
 */
NDArray.prototype.lock = function() {
	if (!this.isValid()) {
		throw new Error("Attempted to lock an invalidated array");
	}
	this._lockCount++;
	return this;
};

/**
 * Unlocks the array reference counter.
 * Once the array is unlocked, functions and methods that operate on this array decrease its reference count and, if the reference count reaches zero, invalidate the array.
 * If the array was locked multiple times, it would need just as many unlock calls to lift the lock.
 * If the array is not locked, this operation will fail with an error.
 *
 * @method unlock
 * @chainable
 */
NDArray.prototype.unlock = function() {
	if (!this.isLocked()) {
		throw new Error("Attempted to lock a unlocked array");
	}
	this._lockCount--;
	return this;
};

/**
 * Checkes if the array is in the locked state.
 * If the array is not valid, this method return false.
 *
 * @method isLocked
 *
 * @return {Boolean} - true is the array is locked and false otherwise
 */
NDArray.prototype.isLocked = function() {
	return this._lockCount > 0;
};

/**
 * Increments the array reference count.
 * If the array is invalid or locked, this operation will fail with an error.
 *
 * @method retain
 * @chainable
 */
NDArray.prototype.retain = function() {
	if (!this.isValid()) {
		throw new Error("Attempted to release an invalidated array");
	}
	if (this.isLocked()) {
		throw new Error("Attempted to retain a locked array");
	}
	this._refCount++;
	return this;
};

/**
 * Decrements the array reference count. If the reference count turns zero, the array becomes invalid and its data buffer is deallocated.
 * If the array is invalid or locked, this operation will fail with an error.
 *
 * @method release
 * @chainable
 */
NDArray.prototype.release = function() {
	if (!this.isValid()) {
		throw new Error("Attempted to release an invalidated array");
	}
	if (this.isLocked()) {
		throw new Error("Attempted to release a locked array");
	}
	if (--this._refCount === 0) {
		this._context._invalidate(this);
	}
	return this;
};

/**
 * For a non-locked array, decrements the array reference count. If the reference count turns zero, the array becomes invalid and its data buffer is deallocated.
 * If the array is invalid, this operation will fail with an error.
 *
 * @method tryRelease
 * @chainable
 */
NDArray.prototype.tryRelease = function() {
	if (!this.isValid()) {
		throw new Error("Attempted to release an invalidated array");
	}
	if (!this.isLocked()) {
		if (--this._refCount === 0) {
			this._context._invalidate(this);
		}
	}
	return this;
};

/**
 * For a non-locked array, decrements the array reference count. If the reference count turns zero, the array becomes invalid and its data buffer is deallocated.
 * The array must be valid to perform this operation.
 *
 * @private
 * @method _tryRelease
 * @chainable
 */
NDArray.prototype._tryRelease = function() {
	if (!this.isLocked()) {
		if (--this._refCount === 0) {
			this._context._invalidate(this);
		}
	}
	return this;
};

/**
 * Invalidates the array and deallocates its data buffer, regardless of locks and reference count.
 * Calling this method on an invalidated array has no effect.
 *
 * @method invalidate
 * @chainable
 */
NDArray.prototype.invalidate = function() {
	if (this.isValid()) {
		this._context._invalidate(this);
		this._isValid = false;
		this._refCount = 0;
		this._lockCount = 0;
	}
	return this;
};

/**
 * Checkes if the array is in a valid state.
 * If the array is not in a valid state, its data buffer was deallocated, and any operations on the array will throw an error.
 *
 * @method isValid
 *
 * @return {Boolean} - true is the array is valid and false otherwise
 */
NDArray.prototype.isValid = function() {
	return this._isValid;
};

/**
 * Decrements the array reference count if the array is not locked.
 * This function does not invalidate the array when the reference count reach zero.
 * The caller is responsible for invalidating array if its reference count is zero after the operation.
 *
 * For a locked array the method has no effect and always returns true.
 *
 * @private
 * @method _decRef
 * @param {NDArray} array - the array to decrement the reference count for. Must be valid before the call.
 * @return {Boolean} - true if the reference count is non-zero after the operation and false otherwise.
 */
NDArray.prototype._decRef = function(array) {
	if (this._lockCount === 0) {
		--this._refCount;
	}
	return this._refCount !== 0;
};

/**
 * Increments the array reference count if the array is not locked.
 * For a locked array the method has no effect.
 *
 * @private
 * @method _incRef
 * @chainable
 * @param {NDArray} array - the array to increment the reference count for. Must be valid before the call, but may have zero reference count.
 */
NDArray.prototype._incRef = function(array) {
	if (this._lockCount === 0) {
		++this._refCount;
	}
	return this;
};

/**
 * Checks if the array is locked or has any references.
 *
 * @private
 * @method _hasRefs
 * @param {NDArray} array - the array to check. Must be valid before the call, but may have zero reference count.
 * @return {Boolean} - true if the array is locked or has references and false otherwise.
 */
NDArray.prototype._hasRefs = function(array) {
	return (this._lockCount !== 0) || (this._refCount !== 0);
};

/**
 * Invalidates the array if it valid, not locked, and has zero reference count.
 * Has no effect in all other cases.
 *
 * @private
 * @method _tryInvalidate
 * @param {NDArray} array - the array to try to invalidate. Can be invalid.
 * @return {Boolean} - true if the array was invalidated by this call and false otherwise.
 */
NDArray.prototype._tryInvalidate = function(array) {
	if (this.isValid() && !this._hasRefs()) {
		this._context._invalidate(this);
		this._isValid = false;
		return true;
	} else {
		return false;
	}
};

/**
 * Adds another array or a number to this array.
 *
 * @method add
 * @param {(NDArray|Number)} other - the array or scalar to be added.
 * @return {NDArray}
 */
NDArray.prototype.add = function(other) {
	return this._context.add(this, other);
};

/**
 * Subtracts another array or a number from this array.
 *
 * @method sub
 * @param {(NDArray|Number)} other - the array or scalar to be subtracted.
 * @return {NDArray}
 */
NDArray.prototype.sub = function(other) {
	return this._context.sub(this, other);
};

/**
 * Multiplies array elements by another array or by a number.
 *
 * @method mul
 * @param {(NDArray|Number)} other - the array or scalar to multiply elements by.
 * @return {NDArray}
 */
NDArray.prototype.mul = function(other) {
	return this._context.mul(this, other);
};

/**
 * Divides array elements by another array or by a number.
 *
 * @method div
 * @param {(NDArray|Number)} other - the array or scalar to divide elements by.
 * @return {NDArray}
 */
NDArray.prototype.div = function(other) {
	return this._context.div(this, other);
};

/**
 * Reduces array elements using minimum operation.
 * If the axis argument is provided, the method computes minimum of elements along the specified axis.
 * Otherwise, the method computes an all-array minimum of the elements and returns them as a 1-element array.
 *
 * @method min
 * @param {Number} [axis] - the axis along which the minimum is computed.
 * @return {NDArray}
 */
NDArray.prototype.min = function(axis) {
	return this._context.min(this, axis);
};

/**
 * Reduces array elements using maximum operation.
 * If the axis argument is provided, the method computes maximum of elements along the specified axis.
 * Otherwise, the method computes an all-array maximum of the elements and returns them as a 1-element array.
 *
 * @method min
 * @param {Number} [axis] - the axis along which the maximum is computed.
 * @return {NDArray}
 */
NDArray.prototype.max = function(axis) {
	return this._context.max(this, axis);
};

/**
 * Reduces array elements using sum operation.
 * If the axis argument is provided, the method computes sum of elements along the specified axis.
 * Otherwise, the method computes an all-array sum of the elements and returns them as a 1-element array.
 *
 * @method min
 * @param {Number} [axis] - the axis along which the sum is computed.
 * @return {NDArray}
 */
NDArray.prototype.sum = function(axis) {
	return this._context.sum(this, axis);
};

/**
 * Creates another array with the same data, but different dimensions.
 *
 * @method reshape
 * @param {(NDArray|Number)} other - dimensions of the new array.
 * @return {NDArray}
 */
NDArray.prototype.reshape = function(newShape) {
	return this._context.reshape(this, newShape);
};

/**
 * Duplicates array elements along the specified axis.
 *
 * @method repeat
 * @param {Number} repeats - the number of times to repeat each element.
 * @param {Number} axis - the axis along which the elements will be duplicated.
 * @return {NDArray}
 */
NDArray.prototype.repeat = function(repeats, axis) {
	return this._context.repeat(this, repeats, axis);
};

/**
 * Converts the data to a JavaScript Array.
 *
 * @method get
 * @async
 */
NDArray.prototype.get = function(callback) {
	this._context.get(this, callback);
};

module.exports = NDArray;

},{"./DataType":1,"./util":12}],3:[function(_dereq_,module,exports){
"use strict";

var NDArray = _dereq_("./NDArray");
var DataType = _dereq_("./DataType");
var allocator = _dereq_("./allocator");
var util = _dereq_("./util");
var requests = _dereq_("./requests.pb");
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
var CholeskyDecompositionRequest = requests.CholeskyDecompositionRequest;
var SolveTriangularRequest = requests.SolveTriangularRequest;
var Response = _dereq_("./responses.pb").Response;

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

},{"./DataType":1,"./NDArray":2,"./allocator":5,"./requests.pb":10,"./responses.pb":11,"./util":12}],4:[function(_dereq_,module,exports){
"use strict";

var PBContext = _dereq_("./PBContext");

function PNaClContext(options, callback) {
	var self = this;
	this._pnaclObject = document.createElement("object");
	this._pnaclObject.width = 0;
	this._pnaclObject.height = 0;
	this._pnaclObject.data = PNaClContext.getManifestURL(options.baseUrl);
	this._pnaclObject.type = "application/x-pnacl";
	this._pnaclObject.addEventListener("message", function(e) {
		self._messagingContext._onMessage(e);
	}, true);
	this._messagingContext = new PBContext(options, function(message) {
		self._pnaclObject.postMessage(message);
	}, callback);
	document.body.appendChild(this._pnaclObject);
}

PNaClContext.isSupported = function() {
	try {
		return (typeof navigator.mimeTypes["application/x-pnacl"]) !== "undefined";
	} catch (e) {
	}
	return false;
};

PNaClContext.getManifestURL = function(baseUrl) {
	if (baseUrl) {
		return baseUrl + "furious.nmf";
	} else {
		return "furious.nmf";
	}
};

PNaClContext.prototype.empty = function(shape, dataType) {
	return this._messagingContext.empty(shape, dataType);
};

PNaClContext.prototype.zeros = function(shape, dataType) {
	return this._messagingContext.zeros(shape, dataType);
};

PNaClContext.prototype.ones = function(shape, dataType) {
	return this._messagingContext.ones(shape, dataType);
};

PNaClContext.prototype.array = function(data, dataType) {
	return this._messagingContext.array(data, dataType);
};

PNaClContext.prototype.linspace = function(start, stop, samples, closed) {
	return this._messagingContext.linspace(start, stop, samples, closed);
};

PNaClContext.prototype.reshape = function(a, shape) {
	return this._messagingContext.reshape(a, shape);
};

PNaClContext.prototype.repeat = function(a, repeats, axis, out) {
	return this._messagingContext.repeat(a, repeats, axis, out);
};

PNaClContext.prototype._invalidate = function(array) {
	return this._messagingContext._invalidate(array);
};

PNaClContext.prototype.fetch = function() {
	this._messagingContext.fetch.apply(this._messagingContext, arguments);
};

PNaClContext.prototype.get = function() {
	this._messagingContext.get.apply(this._messagingContext, arguments);
};

PNaClContext.prototype.info = function(callback) {
	this._messagingContext.info(callback);
};

PNaClContext.prototype.barrier = function(callback) {
	this._messagingContext.barrier(callback);
};

PNaClContext.prototype.add = function(a, b, out) {
	return this._messagingContext.add(a, b, out);
};

PNaClContext.prototype.sub = function(a, b, out) {
	return this._messagingContext.sub(a, b, out);
};

PNaClContext.prototype.mul = function(a, b, out) {
	return this._messagingContext.mul(a, b, out);
};

PNaClContext.prototype.div = function(a, b, out) {
	return this._messagingContext.div(a, b, out);
};

PNaClContext.prototype.neg = function(a, out) {
	return this._messagingContext.neg(a, out);
};

PNaClContext.prototype.abs = function(a, out) {
	return this._messagingContext.abs(a, out);
};

PNaClContext.prototype.exp = function(a, out) {
	return this._messagingContext.exp(a, out);
};

PNaClContext.prototype.log = function(a, out) {
	return this._messagingContext.log(a, out);
};

PNaClContext.prototype.sqrt = function(a, out) {
	return this._messagingContext.sqrt(a, out);
};

PNaClContext.prototype.square = function(a, out) {
	return this._messagingContext.square(a, out);
};

PNaClContext.prototype.min = function(a, axis) {
	return this._messagingContext.min(a, axis);
};

PNaClContext.prototype.max = function(a, axis) {
	return this._messagingContext.max(a, axis);
};

PNaClContext.prototype.sum = function(a, axis) {
	return this._messagingContext.sum(a, axis);
};

PNaClContext.prototype.dot = function(a, b, out) {
	return this._messagingContext.dot(a, b, out);
};

PNaClContext.prototype.solveTriangular = function(a, b, triangularKind, transposeKind, unitDiagonal, out) {
	return this._messagingContext.solveTriangular(a, b, triangularKind, transposeKind, unitDiagonal, out);
};

PNaClContext.prototype.cholesky = function(a, kind, out) {
	return this._messagingContext.cholesky(a, kind, out);
};

module.exports = PNaClContext;

},{"./PBContext":3}],5:[function(_dereq_,module,exports){
"use strict";

var messageId = 1;
var arrayId = 1;

exports.newMessageId = function() {
	var id = messageId;
	messageId = (messageId+1)|0;
	return id;
};

exports.newArrayId = function () {
	var id = arrayId;
	arrayId = (arrayId+1)|0;
	return id;
};

},{}],6:[function(_dereq_,module,exports){
"use strict";

/**
 * Provides information and support functions
 *
 * @class furious
 */

var DataType = _dereq_("./DataType");
var JSContext = _dereq_("./js/JSContext");
var WebWorkerContext = _dereq_("./js/WebWorkerContext");
var PNaClContext = _dereq_("./PNaClContext");
var WebCLContext = _dereq_("./webcl/WebCLContext");

var currentScriptUri = null;
try {
	currentScriptUri = document.currentScript.src;
} catch (e) {
	try {
		var scripts = document.getElementsByTagName("script");
		currentScriptUri = scripts[scripts.length - 1].src;
	} catch (e) {
	}
}
var currentScriptDir = null;
if (currentScriptUri !== null) {
	var separatorPos = currentScriptUri.lastIndexOf("/");
	var currentScriptDir = currentScriptUri.substr(0, separatorPos + 1);
}

/**
 * Initializes a computational context.
 *
 * @static
 * @method init
 * @async
 *
 * @param {String} [backend] - A string identifier for the backend to use. The following values are supported:
 *
 *     <table>
 *         <tr>
 *             <th>Backend Identifier</th>
 *             <th>Interpretation</th>
 *         </tr>
 *         <tr>
 *             <td>"javascript"</td>
 *             <td>JavaScript backend. Works in all browsers and Node.js, but can not deliver optimal performance.</td>
 *         </tr>
 *         <tr>
 *             <td>"pnacl"</td>
 *             <td>Portable Native Client (PNaCl) backend. Works in Chromium-based browsers. Can accelerate computations through the use of advanced CPU optimization technologies, such as multi-threading and SIMD instructions.</td>
 *         </tr>
 *         <tr>
 *             <td>"webcl"</td>
 *             <td>WebCL backend. Works in browsers and Node.js when a WebCL plugin is available. Can use full power of CPUs and GPUs to accelerate computations.</td>
 *         </tr>
 *     </table>
 *
 * @param {Object} options - Backend-specific options.
 * @param {Function} callback - A callback function that is called when the backend finish initialization.
 * @param {Context} callback.context - A ready to use computational context.
 */
var init = function(backend, options, callback) {
	if (typeof callback === "undefined") {
		if (typeof options === "undefined") {
			/* Called with one parameter: callback */
			callback = backend;
			options = undefined;
			backend = undefined;
		} else {
			/* Called with two parameters: backend and callback */
			callback = options;
			options = undefined;
		}
	}
	if (typeof backend === "undefined") {
		backend = getDefaultBackend();
	}
	if (typeof options === "undefined") {
		options = {};
	}
	if (backend === "javascript") {
		var async = options.async;
		if (typeof async === "undefined") {
			async = WebWorkerContext.isSupported();
		}
		if (async) {
			options.baseUrl = currentScriptDir;
			return new WebWorkerContext(options, callback);
		} else {
			return new JSContext(options, callback);
		}
	} else if (backend === "pnacl") {
		options.baseUrl = currentScriptDir;
		return new PNaClContext(options, callback);
	} else if (backend === "webcl") {
		return new WebCLContext(options, callback);
	} else {
		throw new Error("Unsupported backend: " + backend);
	}
};

/**
 * Detects the optimal backend supported by the browser or JavaScript engine.
 *
 * @static
 * @method getDefaultBackend
 *
 * @return {String} - Default backend identifier from the following table:
 *
 *     <table>
 *         <tr>
 *             <th>Backend Identifier</th>
 *             <th>Interpretation</th>
 *         </tr>
 *         <tr>
 *             <td>"javascript"</td>
 *             <td>JavaScript backend. Works in all browsers and Node.js, but can not deliver optimal performance.</td>
 *         </tr>
 *         <tr>
 *             <td>"asmjs"</td>
 *             <td>Asm.js backend. Works in Firefox 29 and later. Can accelerate computations with a limited use of native CPU instructions.</td>
 *         </tr>
 *         <tr>
 *             <td>"pnacl"</td>
 *             <td>Portable Native Client (PNaCl) backend. Works in Chromium-based browsers. Can accelerate computations through the use of advanced CPU optimization technologies, such as multi-threading and SIMD instructions.</td>
 *         </tr>
 *         <tr>
 *             <td>"webcl"</td>
 *             <td>WebCL backend. Works in browsers and Node.js when a WebCL plugin is available. Can use full power of CPUs and GPUs to accelerate computations.</td>
 *         </tr>
 *     </table>
 */
var getDefaultBackend = function() {
	if (WebCLContext.isUsable()) {
		return "webcl";
	} else if (PNaClContext.isSupported()) {
		return "pnacl";
	} else {
		return "javascript";
	}
};

/**
 * Detects which backends are supported by the system.
 *
 * @static
 * @method getSupportedBackends
 *
 * @return {String[]} - An array of supported backend identifiers in priority order (prioritized backends first). The following identifiers could be present:
 *
 *     <table>
 *         <tr>
 *             <th>Backend Identifier</th>
 *             <th>Interpretation</th>
 *         </tr>
 *         <tr>
 *             <td>"javascript"</td>
 *             <td>JavaScript backend. Works in all browsers and Node.js, but can not deliver optimal performance.</td>
 *         </tr>
 *         <tr>
 *             <td>"asmjs"</td>
 *             <td>Asm.js backend. Works in Firefox 29 and later. Can accelerate computations with a limited use of native CPU instructions.</td>
 *         </tr>
 *         <tr>
 *             <td>"pnacl"</td>
 *             <td>Portable Native Client (PNaCl) backend. Works in Chromium-based browsers. Can accelerate computations through the use of advanced CPU optimization technologies, such as multi-threading and SIMD instructions.</td>
 *         </tr>
 *         <tr>
 *             <td>"webcl"</td>
 *             <td>WebCL backend. Works in browsers and Node.js when a WebCL plugin is available. Can use full power of CPUs and GPUs to accelerate computations.</td>
 *         </tr>
 *     </table>
 */
var getSupportedBackends = function() {
	var backends = [];
	if (WebCLContext.isUsable()) {
		backends.push("webcl");
	}
	if (PNaClContext.isSupported()) {
		backends.push("pnacl");
	}
	if (hasFeature("asm.js")) {
		backends.push("asm.js");
	}
	backends.push("javascript");
	return backends;
};

/**
 * Queries possible backend options available on this platform.
 *
 * @param {String} backend - name of the backend to query options for.
 *
 * @static
 * @method getBackendOptions
 *
 * @return {Object} - An object that describes available options.
 * The names of object's properties correspond to backend option names.
 * Object's properties have array values with possible option values.
 * Below are the backend options for the built-in backends:
 *
 *     <table>
 *         <caption>Options of "javascript" and "asmjs" backends</caption>
 *         <tr>
 *             <th>Option name</th>
 *             <th>Option values</th>
 *             <th>Default value</th>
 *         </tr>
 *         <tr>
 *             <td>"async"</td>
 *             <td>[true, false]</td>
 *             <td>true</td>
 *         </tr>
 *     </table>
 *
 *     <table>
 *         <caption>Options of "pnacl" backend</caption>
 *         <tr>
 *             <th>Option name</th>
 *             <th>Option values</th>
 *             <th>Default value</th>
 *         </tr>
 *         <tr>
 *             <td>"manifest"</td>
 *             <td>undefined</td>
 *             <td>URL of "furious.nmf" file in the same directory as "furious.js" library</td>
 *         </tr>
 *     </table>
 *
 *     <table>
 *         <caption>Options of "webcl" backend</caption>
 *         <tr>
 *             <th>Option name</th>
 *             <th>Option values</th>
 *             <th>Default value</th>
 *         </tr>
 *         <tr>
 *             <td>"device"</td>
 *             <td>Depends on the platform</td>
 *             <td>Discrete GPU device, if available. Otherwise integrated GPU device, if available. Otherwise CPU device.</td>
 *         </tr>
 *     </table>
 */
var getBackendOptions = function(backend) {
	if (backend === "javascript") {
		if (WebWorkerContext.isSupported()) {
			return {
				"async": [true, false]
			};
		} else {
			return {};
		}
	} else if (backend === "pnacl") {
		return {};
	} else if (backend === "webcl") {
		return {
			"device": WebCLContext.getAvailableDevices()
		};
	} else {
		throw new Error("Unsupported backend: " + backend);
	}
};

/**
 * Queries default backend options on this platform.
 *
 * @param {String} backend - name of the backend to query options for.
 *
 * @static
 * @method getBackendOptions
 *
 * @return {Object} - An object that describes available options.
 * The names of object's properties correspond to backend option names.
 * The values of object's properties correspond to default option values.
 */
var getDefaultBackendOptions = function(backend) {
	if (backend === "javascript") {
		return {
			"async": true
		};
	} else if (backend === "pnacl") {
		if (PNaClContext.isSupported()) {
			return {
				"manifest": PNaClContext.getDefaultManifestURL()
			};
		} else {
			return {};
		}
	} else if (backend === "webcl") {
		return {
			"device": WebCLContext.getDefaultDevice()
		};
	} else {
		throw new Error("Unsupported backend: " + backend);
	}
};

/**
 * Detects whether the requested computing feature is available
 *
 * @static
 * @method hasFeature
 *
 * @param {String} name - an identifier of the optional feature to detect. The following identifiers are supported:
 *
 *     <table>
 *         <tr>
 *             <th>Feature Identifier</th>
 *             <th>Interpretation</th>
 *         </tr>
 *         <tr>
 *             <td>"webworkers"</td>
 *             <td>Detect if the JavaScript engine can spawn dedicated Web Workers.</td>
 *         </tr>
 *         <tr>
 *             <td>"asm.js"</td>
 *             <td>Detect if the JavaScript engine recognizes Asm.js directive.</td>
 *         </tr>
 *         <tr>
 *             <td>"simd.js"</td>
 *             <td>Detect if the JavaScript engine provide SIMD.float32x4, SIMD.int32x4, Float32x4Array, and Int32x4Array of SIMD.js</td>
 *         </tr>
 *         <tr>
 *             <td>"webgl"</td>
 *             <td>Detect if the environment supports WebGL (either experimental or stable implementation)</td>
 *         </tr>
 *         <tr>
 *             <td>"webcl"</td>
 *             <td>Detect if the environment supports WebCL</td>
 *         </tr>
 *         <tr>
 *             <td>"pnacl"</td>
 *             <td>Detect if Portable Native Client (PNaCl) is supported and enabled</td>
 *         </tr>
 *         <tr>
 *             <td>"nacl"</td>
 *             <td>Detect if Native Client (NaCl) is supported and enabled</td>
 *         </tr>
 *     </table>
 *
 * @return {Boolean} - true if the feature is supported, false otherwise
 */
var hasFeature = function(name) {
	switch (name) {
		case "asm.js":
			try {
				var userAgent = window.navigator.userAgent;
				var userAgentComponents = userAgent.split(/\s+/);
				var firefoxRegexp = /[Ff]irefox\/(\d+)/g;
				for (var i = 0; i < userAgentComponents.length; ++i) {
					var component = userAgentComponents[i];
					var match = firefoxRegexp.exec(component);
					if (match !== null) {
						var firefoxVersion = parseInt(match[1]);
						return firefoxVersion >= 29;
					}
				}
				return false;
			} catch (e) {
			}
			return false;
		case "simd.js":
			return (typeof SIMD !== "undefined") &&
				(typeof Float32x4Array !== "undefined") &&
				(typeof Int32x4Array !== "undefined");
		case "webworkers":
			return (typeof Worker !== "undefined");
		case "webgl":
			try {
				var canvas = document.createElement("canvas");
				try {
					if (canvas.getContext("webgl") !== null) {
						return true;
					}
				} catch (e) {
				}
				try {
					if (canvas.getContext("experimental-webgl") !== null) {
						return true;
					}
				} catch (e) {
				}
			} catch (e) {
			}
			return false;
		case "webcl":
			return WebCLContext.isSupported();
		case "pnacl":
			return PNaClContext.isSupported();
		case "nacl":
			try {
				return (typeof navigator.mimeTypes["application/x-nacl"]) !== "undefined";
			} catch (e) {
			}
			return false;
		default:
			throw new Error("Unknown feature: " + name);
	}
};

exports.init = init;
exports.hasFeature = hasFeature;
exports.getDefaultBackend = getDefaultBackend;
exports.getSupportedBackends = getSupportedBackends;
exports.getBackendOptions = getBackendOptions;
exports.getDefaultBackendOptions = getDefaultBackendOptions;
exports.DataType = DataType;

},{"./DataType":1,"./PNaClContext":4,"./js/JSContext":7,"./js/WebWorkerContext":8,"./webcl/WebCLContext":13}],7:[function(_dereq_,module,exports){
"use strict";

var NDArray = _dereq_("./../NDArray");
var DataType = _dereq_("./../DataType");
var util = _dereq_("./../util");
var jsmath = _dereq_("./jsmath");

/**
 * Provides methods for creation, manipulation, and destruction of N-dimensional arrays.
 * Arithmetic operations are possible only on arrays that belong to the same context.
 *
 * @class Context
 * @constructor
 */
function JSContext(options, callback) {
	callback(this);
}

/**
 * Constructs an uninialized N-dimensional array.
 *
 * @method empty
 * @param {Number} shape - the dimensions of the array
 * @param {DataType} dataType - the type of elements in the array.
 */
JSContext.prototype.empty = function(shape, dataType) {
	/* The is no way to create uninitialized typed array in JavaScript */
	return this.zeros(shape, dataType);
};

/**
 * Constructs an N-dimensional array with elements initialized to zero.
 *
 * @method zeros
 * @param {Number} shape - the dimensions of the array
 * @param {DataType} dataType - the type of elements in the array.
 */
JSContext.prototype.zeros = function(shape, dataType) {
	shape = util.checkShape(shape);
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else {
		dataType = util.checkDataType(dataType);
	}
	var array = new NDArray(shape, dataType, this);
	array._data = new dataType.arrayType(array.length);
	return array;
};

/**
 * Constructs an N-dimensional array with elements initialized to one.
 *
 * @method ones
 * @param {Number} shape - the dimensions of the array
 * @param {DataType} dataType - the type of elements in the array.
 */
JSContext.prototype.ones = function(shape, dataType) {
	/* The is no way to create uninitialized typed array in JavaScript */
	var array = this.zeros(shape, dataType);
	jsmath.fill(array._data, 1.0);
	return array;
};

/**
 * Constructs a 2-dimensional array with identity matrix.
 *
 * @method eye
 * @param {Number} rows - the number of rows in the matrix.
 * @param {Number} [columns=rows] - the number of columns in the matrix.
 * @param {Number} [diagonal=0] - position of the unit diagonal. 0 puts it on the main diagonal, positive values will place it above the main diagonal, negative - below the main diagonal.
 * @param {DataType} [dataType] - the data type of the matrix elements.
 */
JSContext.prototype.eye = function(rows, columns, diagonal, dataType) {
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
	var maxDimension = Math.max(rows, columns);
	if ((diagonal > maxDimension) || (diagonal < -maxDimension)) {
		throw new RangeError("diagonal is out of range");
	}
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else {
		dataType = util.checkDataType(dataType);
	}
	var array = this.zeros([rows, columns], dataType);
	jsmath.fillDiagonal(array._data, rows, columns, diagonal, 1.0);
	return array;
};

/**
 * Constructs an N-dimensional array object with the provided data.
 *
 * @method array
 * @param {Number[]} data - the array data
 * @param {DataType} dataType - the type of elements in the array.
 */
JSContext.prototype.array = function(data, dataType) {
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else {
		dataType = util.checkDataType(dataType);
	}
	var shape = [];
	util.discoverArrayShapeRecursive(data, shape, 0);
	var array = this.empty(shape, dataType);
	util.copyArrayDataRecursive(array._data, data, shape, 0, 0);
	return array;
};

/**
 * De-allocates data associated with the array.
 *
 * @method _invalidate
 * @private
 *
 * @param {NDArray} array - the n-dimensional array object with data to be de-allocated.
 */
JSContext.prototype._invalidate = function(array) {
	util.checkNDArray(array, "array");
	array._data = null;
};

/**
 * Fetches NDArray data and asynchronously returns it as JavaScript typed arrays.
 *
 * @method fetch
 * @async
 *
 * @param {NDArray} arrays* - NDArrays to fetch.
 * @param {Function} callback - A callback to be called with the data when it is available.
 * @param {ArrayBufferView} callback.arrays* - typed arrays with the data. The element type of the typed array matches the data type of the NDArray. For zero-dimensional arrays the output is returned as a typed array with a single element. Multi-dimensional arrays are returned in row-major storage format.
 */
JSContext.prototype.fetch = function() {
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
	for (var i = 0; i < arguments.length - 1; ++i) {
		arguments[i]._decRef();
	}
	var callbackArguments = new Array(arguments.length - 1);
	for (var i = 0; i < callbackArguments.length; ++i) {
		var array = arguments[i];
		callbackArguments[i] = new array.dataType.arrayType(array._data);
	}
	for (var i = 0; i < arguments.length - 1; ++i) {
		arguments[i]._tryInvalidate();
	}
	callback.apply(null, callbackArguments);
};

/**
 * Fetches NDArray data and asynchronously returns it as JavaScript arrays or numbers.
 *
 * @method get
 * @async
 *
 * @param {NDArray} arrays* - NDArrays to fetch.
 * @param {Function} callback - A callback to be called with the data when it is available.
 * @param {Number|Number[]} callback.arrays* - JavaScript numbers or multidimensional arrays with the data. The number and order of arguments matches the NDArrays passed to the method call.
 */
JSContext.prototype.get = function() {
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
	for (var i = 0; i < arguments.length - 1; ++i) {
		arguments[i]._decRef();
	}
	var callbackArguments = new Array(arguments.length - 1);
	for (var i = 0; i < callbackArguments.length; ++i) {
		var array = arguments[i];
		if (array.shape.length === 0) {
			callbackArguments[i] = array._data[0];
		} else {
			var jsarray = new Array(array.shape[0]);
			util.createArrayRecursive(array._data, jsarray, array.shape, 0, 0);
			callbackArguments[i] = jsarray;
		}
	}
	for (var i = 0; i < arguments.length - 1; ++i) {
		arguments[i]._tryInvalidate();
	}
	callback.apply(null, callbackArguments);
};

/**
 * Waits until previous commands finished execution and calls the callback.
 *
 * @method barrier
 * @async
 *
 * @param {Function} callback - A callback to be called after the previous commands retire.
 */
JSContext.prototype.barrier = function(callback) {
	callback();
};

/**
 * Creates another array with the same data, but different dimensions.
 *
 * @method reshape
 * @param {(NDArray|Number)} shape - dimensions of the new array.
 */
JSContext.prototype.reshape = function(array, shape) {
	shape = util.checkShape(shape);
	if (util.computeLength(shape) !== array.length) {
		throw new RangeError("The shape is not compatible with the array");
	}
	var out = new NDArray(shape, array.dataType, this);
	if (array._decRef()) {
		out._data = new out.dataType.arrayType(out.length);
		out._data.set(array._data);
	} else {
		out._data = array._data;
		array._tryInvalidate();
	}
	return out;
};

/**
 * Duplicates array elements along the specified axis.
 *
 * @method repeat
 * @param {NDArray} a - the input array.
 * @param {Number} repeats - the number of times to repeat each element.
 * @param {Number} axis - the axis along which the elements will be duplicated.
 * @param {NDArray} [out] - an output array to store the result.
 * @return {NDArray} - an N-dimensional array with repeated elements of array **a**.
 */
JSContext.prototype.repeat = function(a, repeats, axis, out) {
	util.checkNDArray(a, "a");
	repeats = util.checkRepeats(repeats);
	axis = util.checkAxis(axis, a.shape.length);
	var shapeA = a.shape;
	var shapeOut = shapeA.slice(0);
	shapeOut[axis] *= repeats;
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = this.empty(shapeOut, a.dataType);
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(out.shape, shapeOut);
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			out._incRef();
		}
		var outerStride = util.computeOuterStride(shapeA, axis);
		var innerStride = util.computeInnerStride(shapeA, axis);
		jsmath.repeat(a._data, out._data, outerStride, innerStride, shapeA[axis], repeats);
	} catch (e) {
		a._incRef();
		throw e;
	}
	a._tryInvalidate();
	return out;
};

var binaryArithOp = function(a, b, out, context, operation, operationConst, operationRevConst) {
	var shapeOut = null, dataTypeOut = null;
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
		a._decRef();
	}
	if (b instanceof NDArray) {
		b._decRef();
	}
	try {
		if (typeof out === "undefined") {
			out = new NDArray(shapeOut, dataTypeOut, context);
			if ((a instanceof NDArray) && !a._hasRefs()) {
				out._data = a._data;
			} else if ((b instanceof NDArray) && !b._hasRefs()) {
				out._data = b._data;
			} else {
				out._data = new dataTypeOut.arrayType(out.length);
			}
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(shapeOut, out.shape);
			util.checkDataTypesCompatibility(dataTypeOut, out.dataType);
			out._incRef();
		}
		if (a instanceof NDArray) {
			if (b instanceof NDArray) {
				operation(a._data, b._data, out._data);
			} else {
				operationConst(a._data, +b, out._data);
			}
		} else {
			operationRevConst(b._data, +a, out._data);
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

var unaryArithOp = function(a, out, context, operation) {
	util.checkNDArray(a, "a");
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, context);
			if ((a instanceof NDArray) && !a._hasRefs()) {
				out._data = a._data;
			} else {
				out._data = new a.dataType.arrayType(out.length);
			}
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(a.shape, out.shape);
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			out._incRef();
		}
		operation(a._data, out._data);
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	a._tryInvalidate();
	return out;
};

var axisReduceOp = function(a, axis, out, context, operation, axisOperation) {
	util.checkNDArray(a, "a");
	if (typeof axis === "undefined") {
		if (typeof out === "undefined") {
			out = context.empty([], a.dataType);
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility([], out.shape);
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			out._incRef();
		}
		operation(a._data, out._data);
		a._tryRelease();
		return out;
	} else {
		axis = util.checkAxis(axis, a.shape.length);
		var shapeOut = util.computeAxisReductionOutShape(a.shape, axis);
		if (typeof out === "undefined") {
			out = context.empty(shapeOut, a.dataType);
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility([], out.shape);
			util.checkDataTypesCompatibility(a.dataType, out.dataType);
			out._incRef();
		}
		axisOperation(a._data, out._data,
			util.computeOuterStride(a.shape, axis),
			util.computeInnerStride(a.shape, axis),
			a.shape[axis]);
		a._tryRelease();
		return out;
	}
};

/**
 * Adds one number or array with another number or array.
 * Addition is performed element-by-element.
 *
 * @method add
 * @param {(NDArray|Number)} a - one number or array to add. If **b** is a *Number*, **a** must be an *NDArray*.
 * @param {(NDArray|Number)} b - another number or array to add. If **a** is a *Number*, **b** must be an *NDArray*.
 * @param {NDArray} [out] - the array where the result is to be stored. If provided, must match the shape and data type of input arrays.
 * @return {NDArray} - the result of element-wise addition of **a** and **b**.
 */
JSContext.prototype.add = function(a, b, out) {
	return binaryArithOp(a, b, out, this, jsmath.add, jsmath.addConst, jsmath.addConst);
};

/**
 * Subtracts one number or array from another number or array.
 * Subtraction is performed element-by-element.
 *
 * @method sub
 * @param {(NDArray|Number)} a - the number or array to subtract from. If **b** is a *Number*, **a** must be an *NDArray*.
 * @param {(NDArray|Number)} b - the number or array to subtract. If **a** is a *Number*, **b** must be an *NDArray*.
 * @param {NDArray} [out] - the array where the result is to be stored. If provided, must match the shape and data type of input arrays.
 * @return {NDArray} - the result of element-wise subtraction of **b** from **a**.
 */
JSContext.prototype.sub = function(a, b, out) {
	return binaryArithOp(a, b, out, this, jsmath.sub, jsmath.subConst, jsmath.subRevConst);
};

/**
 * Multiplies one number or array by another number or array.
 * Multiplication is performed element-by-element.
 *
 * @method mul
 * @param {(NDArray|Number)} a - one number or array to multiply. If **b** is a *Number*, **a** must be an *NDArray*.
 * @param {(NDArray|Number)} b - another number or array to multiply. If **a** is a *Number*, **b** must be an *NDArray*.
 * @param {NDArray} [out] - the array where the result is to be stored. If provided, must match the shape and data type of input arrays.
 * @return {NDArray} - the result of element-wise multiplication of **a** and **b**.
 */
JSContext.prototype.mul = function(a, b, out) {
	return binaryArithOp(a, b, out, this, jsmath.mul, jsmath.mulConst, jsmath.mulConst);
};

/**
 * Divides one number or array by another number or array.
 * Division is performed element-by-element.
 *
 * @method div
 * @param {(NDArray|Number)} a - the number or array to divide. If **b** is a *Number*, **a** must be an *NDArray*.
 * @param {(NDArray|Number)} b - the number or array to divide by. If **a** is a *Number*, **b** must be an *NDArray*.
 * @param {NDArray} [out] - the array where the result is to be stored. If provided, must match the shape and data type of input arrays.
 * @return {NDArray} - the result of element-wise division of **a** by **b**.
 */
JSContext.prototype.div = function(a, b, out) {
	return binaryArithOp(a, b, out, this, jsmath.div, jsmath.divConst, jsmath.divRevConst);
};

JSContext.prototype.min = function(a, axis, out) {
	return axisReduceOp(a, axis, out, this, jsmath.min, jsmath.axisMin);
};

JSContext.prototype.max = function(a, axis, out) {
	return axisReduceOp(a, axis, out, this, jsmath.max, jsmath.axisMax);
};

JSContext.prototype.sum = function(a, axis, out) {
	return axisReduceOp(a, axis, out, this, jsmath.sum, jsmath.axisSum);
};

/**
 * Negates array elements.
 *
 * @method neg
 * @param {NDArray} a - the array of elements to be negated.
 * @param {NDArray} [out] - the array for negated elements. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.neg = function(a, out) {
	return unaryArithOp(a, out, this, jsmath.neg);
};

/**
 * Computes absolute value of array elements.
 *
 * @method abs
 * @param {NDArray} a - the array of input elements.
 * @param {NDArray} [out] - the array for computed absolute values. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.abs = function(a, out) {
	return unaryArithOp(a, out, this, jsmath.abs);
};

/**
 * Exponentiates array elements.
 *
 * @method exp
 * @param {NDArray} a - the array of elements to be exponentiated.
 * @param {NDArray} [out] - the array for exponentiated elements. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.exp = function(a, out) {
	return unaryArithOp(a, out, this, jsmath.exp);
};

/**
 * Computes logarithm of array elements.
 *
 * @method log
 * @param {NDArray} a - the array of input elements.
 * @param {NDArray} [out] - the array for computed logarithm values. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.log = function(a, out) {
	return unaryArithOp(a, out, this, jsmath.log);
};

/**
 * Computes square root of array elements.
 *
 * @method sqrt
 * @param {NDArray} a - the array of input elements.
 * @param {NDArray} [out] - the array for computed square root values. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.sqrt = function(a, out) {
	return unaryArithOp(a, out, this, jsmath.sqrt);
};

/**
 * Squares array elements.
 *
 * @method square
 * @param {NDArray} a - the array of elements to be squared.
 * @param {NDArray} [out] - the array for squared elements. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.square = function(a, out) {
	return unaryArithOp(a, out, this, jsmath.square);
};

/**
 * Computes the dot product of two N-dimensional arrays.
 *
 * @method dot
 * @param {NDArray} a - the first input array.
 * @param {NDArray} b - the second input array.
 * @param {NDArray} [out] - the output array. If supplied, must match the data type of **a** and **b** arrays and have the expected shape. Can not be the same array as **a** or **b**.
 * @return {NDArray} - the array with the dot product of **a** and **b**.
 */
JSContext.prototype.dot = function(a, b, out) {
	util.checkNDArray(a, "a");
	util.checkNDArray(b, "b");
	util.checkDataTypesCompatibility(a.dataType, b.dataType);

	/* The axis of b used in reduction: axis 0 for 1D array, second-to-last axis for ND array */
	var aAxis = Math.max(a.shape.length - 1, 0);
	var bAxis = Math.max(b.shape.length - 2, 0);
	var reductionDim = a.shape[aAxis];
	if (reductionDim !== b.shape[bAxis]) {
		throw new RangeError("Arrays have incompatible reduction dimensions");
	}
	var shapeOut = [], strideA = 1, outerStrideB = 1, innerStrideB = 1;
	for (var i = 0; i < aAxis; i++) {
		shapeOut.push(a.shape[i]);
		strideA *= a.shape[i];
	}
	for (var i = 0; i < b.shape.length; i++) {
		var dim = b.shape[i];
		if (i < bAxis) {
			outerStrideB *= dim;
			shapeOut.push(dim);
		} else if (i > bAxis) {
			innerStrideB *= dim;
			shapeOut.push(dim);
		}
	}
	if (typeof out === "undefined") {
		out = this.empty(shapeOut, a.dataType);
	} else {
		util.checkNDArray(out, "out");
		util.checkShapesCompatibility(out.shape, shapeOut);
		util.checkDataTypesCompatibility(out.dataType, a.dataType);
		util.checkDifferentNDArrays(a, out, "a", "out");
		util.checkDifferentNDArrays(b, out, "b", "out");
		out._incRef();
	}
	jsmath.dot(a._data, b._data, out._data, strideA, outerStrideB, innerStrideB, reductionDim);
	a._tryRelease();
	b._tryRelease();
	return out;
};

/**
 * Solves a triangular linear system.
 *
 * @method solveTriangular
 * @param {NDArray} a - the triangular matrix that defines the system.
 * @param {NDArray} b - the matrix of right-hand sides of the system.
 * @param {String} [triangularKind="U"] - the kind of triangular matrix in **a**. "L" denotes lower triangular, "U" denotes upper triangular. Other values are invalid.
 * @param {String} [transposeKind="N"] - the type of transposition to be applied to **a**. Use "T" to transpose the matrix on-the-fly in the computation, "N" to use it as-is.
 * @param {Boolean} [unitDiagonal=false] - indicates that the diagonal elements should be assumed to equal 1.
 * @param {NDArray} [out] - an array to be used for the solutions vector or matrix. If supplied, must match the dimensions and data type of the **b** array.
 */
JSContext.prototype.solveTriangular = function(a, b, triangularKind, transposeKind, unitDiagonal, out) {
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
	a._decRef();
	b._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(b.shape, b.dataType, this);
			if (!b._hasRefs()) {
				out._data = b._data;
			} else {
				out._data = new out.dataType.arrayType(b._data);
			}
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(b.shape, out.shape);
			util.checkDataTypesCompatibility(b.dataType, out.dataType);
			out._data.set(b._data);
			out._incRef();
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		b._incRef();
		throw e;
	}
	jsmath.solveTriangular(a._data, out._data,
		b.shape[0], b.shape[1] || 1,
		transposeKind === "T",
		triangularKind === "L",
		unitDiagonal);
	a._tryInvalidate();
	b._tryInvalidate();
	return out;
};

/**
 * Computes Cholesky decomposition of an s.p.d. matrix
 *
 * @method cholesky
 * @param {NDArray} a - a square 2-dimensional matrix to be factored.
 * @param {String} [kind="U"] - the kind of Cholesky factorization. Pass "L" for lower Cholesky, "U" for upper Cholesky. Other values are invalid.
 * @param {NDArray} [out] - a square 2-dimensional array to be used to the Cholesky factor. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.cholesky = function(a, kind, out) {
	util.checkSquare2DArray(a, "a");
	kind = util.checkTriangularKind(kind, "U");
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, this);
			if (!a._hasRefs()) {
				out._data = a._data;
			} else {
				out._data = new out.dataType.arrayType(a._data);
			}
		} else {
			util.checkSquare2DArray(out, "out");
			util.checkShapesCompatibility(out.shape, a.shape);
			util.checkDataTypesCompatibility(out.dataType, a.dataType);
			out._data.set(a._data);
			out._incRef();
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	jsmath.cholesky(out._data, a.shape[0], kind === "L");
	a._tryInvalidate();
	return out;
};

/**
 * Creates an arithmetic sequence.
 *
 * @method linspace
 * @param {Number} start - the starting endpoint of the sequence. Must be a finite number.
 * @param {Number} stop - the final endpoint of the sequence. Must be a finite number.
 * @param {Number} [samples=50] - the number of samples in the sequency. Must be a positive integer.
 * @param {Boolean} [closed=true] - an indicator of whether the final endpoint (`stop` argument) should be included in the sequence.
 */
JSContext.prototype.linspace = function(start, stop, samples, closed) {
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
	var array = this.empty(samples, new DataType("f64"));
	var data = array._data;
	var range = stop - start;
	var n = (closed) ? samples - 1 : samples;
	var step = range / n;
	for (var i = 0; i < samples; i++) {
		data[i] = start + step * i;
	}
	return array;
};

module.exports = JSContext;

},{"./../DataType":1,"./../NDArray":2,"./../util":12,"./jsmath":9}],8:[function(_dereq_,module,exports){
"use strict";

var PBContext = _dereq_("./../PBContext.js");

function WebWorkerContext(options, callback) {
	var self = this;
	this._worker = new Worker(WebWorkerContext.getWorkerURL(options.baseUrl));
	this._worker.addEventListener("message", function(e) {
		self._messagingContext._onMessage(e);
	}, true);
	this._messagingContext = new PBContext(options, function(message) {
		self._worker.postMessage(message, [message]);
	}, callback);
}

WebWorkerContext.isSupported = function() {
	return typeof Worker !== "undefined";
};

WebWorkerContext.getWorkerURL = function(baseUrl) {
	if (baseUrl) {
		return baseUrl + "furious-worker.js";
	} else {
		return "furious-worker.js";
	}
};

WebWorkerContext.prototype.empty = function(shape, dataType) {
	return this._messagingContext.empty(shape, dataType);
};

WebWorkerContext.prototype.zeros = function(shape, dataType) {
	return this._messagingContext.zeros(shape, dataType);
};

WebWorkerContext.prototype.ones = function(shape, dataType) {
	return this._messagingContext.ones(shape, dataType);
};

WebWorkerContext.prototype.array = function(data, dataType) {
	return this._messagingContext.array(data, dataType);
};

WebWorkerContext.prototype.linspace = function(start, stop, samples, closed) {
	return this._messagingContext.linspace(start, stop, samples, closed);
};

WebWorkerContext.prototype.reshape = function(a, shape) {
	return this._messagingContext.reshape(a, shape);
};

WebWorkerContext.prototype.repeat = function(a, repeats, axis, out) {
	return this._messagingContext.repeat(a, repeats, axis, out);
};

WebWorkerContext.prototype._invalidate = function(array) {
	return this._messagingContext._invalidate(array);
};

WebWorkerContext.prototype.fetch = function() {
	this._messagingContext.fetch.apply(this._messagingContext, arguments);
};

WebWorkerContext.prototype.get = function() {
	this._messagingContext.get.apply(this._messagingContext, arguments);
};

WebWorkerContext.prototype.info = function(callback) {
	this._messagingContext.info(callback);
};

WebWorkerContext.prototype.barrier = function(callback) {
	this._messagingContext.barrier(callback);
};

WebWorkerContext.prototype.add = function(a, b, out) {
	return this._messagingContext.add(a, b, out);
};

WebWorkerContext.prototype.sub = function(a, b, out) {
	return this._messagingContext.sub(a, b, out);
};

WebWorkerContext.prototype.mul = function(a, b, out) {
	return this._messagingContext.mul(a, b, out);
};

WebWorkerContext.prototype.div = function(a, b, out) {
	return this._messagingContext.div(a, b, out);
};

WebWorkerContext.prototype.neg = function(a, out) {
	return this._messagingContext.neg(a, out);
};

WebWorkerContext.prototype.abs = function(a, out) {
	return this._messagingContext.abs(a, out);
};

WebWorkerContext.prototype.exp = function(a, out) {
	return this._messagingContext.exp(a, out);
};

WebWorkerContext.prototype.log = function(a, out) {
	return this._messagingContext.log(a, out);
};

WebWorkerContext.prototype.sqrt = function(a, out) {
	return this._messagingContext.sqrt(a, out);
};

WebWorkerContext.prototype.square = function(a, out) {
	return this._messagingContext.square(a, out);
};

WebWorkerContext.prototype.min = function(a, axis) {
	return this._messagingContext.min(a, axis);
};

WebWorkerContext.prototype.max = function(a, axis) {
	return this._messagingContext.max(a, axis);
};

WebWorkerContext.prototype.sum = function(a, axis) {
	return this._messagingContext.sum(a, axis);
};

WebWorkerContext.prototype.dot = function(a, b, out) {
	return this._messagingContext.dot(a, b, out);
};

WebWorkerContext.prototype.solveTriangular = function(a, b, triangularKind, transposeKind, unitDiagonal, out) {
	return this._messagingContext.solveTriangular(a, b, triangularKind, transposeKind, unitDiagonal, out);
};

WebWorkerContext.prototype.cholesky = function(a, kind, out) {
	return this._messagingContext.cholesky(a, kind, out);
};

module.exports = WebWorkerContext;

},{"./../PBContext.js":3}],9:[function(_dereq_,module,exports){
"use strict";

/**
 * JavaScript implementation of computational methods
 *
 * @private
 * @class JSMath
 */

/**
 * Sets all array elements to the specified value.
 *
 * @param {ArrayBufferView} data - the array data buffer.
 * @param {Number} value - the constant to fill the buffer with.
 *
 * @private
 * @static
 * @method fill
 */
exports.fill = function(data, value) {
	var n = data.length;
	for (var i = 0; i < n; ++i) {
		data[i] = value;
	}
};

/**
 * Sets diagonal elements to the specified value
 *
 * @param {ArrayBufferView} data - the array data buffer.
 * @param {Number} rows - the number of rows in the array.
 * @param {Number} columns - the number of columns in the array.
 * @param {Number} diagonal - offset of the diagonal to operate on.
 * @param {Number} value - the constant to fill the diagonal with.
 *
 * @private
 * @static
 * @method fillDiagonal
 */
exports.fillDiagonal = function(data, rows, columns, diagonal, value) {
	if (diagonal === 0) {
		var imax = Math.min(rows, columns);
		for (var i = 0; i < imax; ++i) {
			data[i*columns+i] = value;
		}
	} else if (diagonal > 0) {
		var imax = Math.min(rows, columns - diagonal);
		for (var i = 0; i < imax; ++i) {
			data[i*columns+i+diagonal] = value;
		}
	} else {
		var imax = Math.min(rows + diagonal, columns);
		for (var i = 0; i < imax; ++i) {
			data[(i - diagonal)*columns+i] = value;
		}
	}
};

/**
 * Adds two arrays.
 *
 * @param {ArrayBufferView} dataA - the input augend array.
 * @param {ArrayBufferView} dataB - the input addend array.
 * @param {ArrayBufferView} dataOut - the output sum array.
 *
 * @private
 * @static
 * @method add
 */
exports.add = function(dataA, dataB, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = dataA[i] + dataB[i];
	}
};

/**
 * Adds a constant to an array.
 *
 * @param {ArrayBufferView} dataA - the input augend array.
 * @param {Number} valueB - the addend constant.
 * @param {ArrayBufferView} dataOut - the output sum array.
 *
 * @private
 * @static
 * @method addConst
 */
exports.addConst = function(dataA, valueB, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = dataA[i] + valueB;
	}
};

/**
 * Subtracts two arrays.
 *
 * @param {ArrayBufferView} dataA - the input minuend array.
 * @param {ArrayBufferView} dataB - the input subtrahend array.
 * @param {ArrayBufferView} dataOut - the output difference array.
 *
 * @private
 * @static
 * @method sub
 */
exports.sub = function(dataA, dataB, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = dataA[i] - dataB[i];
	}
};

/**
 * Subtracts a constant from an array.
 *
 * @param {ArrayBufferView} dataA - the input minuend array.
 * @param {Number} valueB - the subtrahend constant.
 * @param {ArrayBufferView} dataOut - the output difference array.
 *
 * @private
 * @static
 * @method subConst
 */
exports.subConst = function(dataA, valueB, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = dataA[i] - valueB;
	}
};

/**
 * Subtracts an array from a constant.
 *
 * @param {ArrayBufferView} dataA - the input subtrahend array.
 * @param {Number} valueB - the minuend constant.
 * @param {ArrayBufferView} dataOut - the output difference array.
 *
 * @private
 * @static
 * @method subRevConst
 */
exports.subRevConst = function(dataA, valueB, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = valueB - dataA[i];
	}
};

/**
 * Multiplies two arrays.
 *
 * @param {ArrayBufferView} dataA - the input multiplicand array.
 * @param {ArrayBufferView} dataB - the input multiplier array.
 * @param {ArrayBufferView} dataOut - the output product array.
 *
 * @private
 * @static
 * @method mul
 */
exports.mul = function(dataA, dataB, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = dataA[i] * dataB[i];
	}
};

/**
 * Multiplies an array by a constant.
 *
 * @param {ArrayBufferView} dataA - the input multiplicand array.
 * @param {Number} valueB - the multiplier constant.
 * @param {ArrayBufferView} dataOut - the output product array.
 *
 * @private
 * @static
 * @method mulConst
 */
exports.mulConst = function(dataA, valueB, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = dataA[i] * valueB;
	}
};

/**
 * Divides two arrays.
 *
 * @param {ArrayBufferView} dataA - the input dividend array.
 * @param {ArrayBufferView} dataB - the input divisor array.
 * @param {ArrayBufferView} dataOut - the output quotient array.
 *
 * @private
 * @static
 * @method div
 */
exports.div = function(dataA, dataB, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = dataA[i] / dataB[i];
	}
};

/**
 * Divides an array by a constant.
 *
 * @param {ArrayBufferView} dataA - the input dividend array.
 * @param {Number} valueB - the divisor constant.
 * @param {ArrayBufferView} dataOut - the output quotient array.
 *
 * @private
 * @static
 * @method divConst
 */
exports.divConst = function(dataA, valueB, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = dataA[i] / valueB;
	}
};

/**
 * Divides a constant by an array.
 *
 * @param {ArrayBufferView} dataA - the input divisor array.
 * @param {Number} valueB - the dividend constant.
 * @param {ArrayBufferView} dataOut - the output quotient array.
 *
 * @private
 * @static
 * @method divRevConst
 */
exports.divRevConst = function(dataA, valueB, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = valueB / dataA[i];
	}
};

/**
 * Negates an array.
 *
 * @param {ArrayBufferView} dataA - the input array.
 * @param {ArrayBufferView} dataOut - the output array.
 *
 * @private
 * @static
 * @method neg
 */
exports.neg = function(dataA, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = -dataA[i];
	}
};

/**
 * Computes absolute value of array elements.
 *
 * @param {ArrayBufferView} dataA - the input array.
 * @param {ArrayBufferView} dataOut - the output array.
 *
 * @private
 * @static
 * @method abs
 */
exports.abs = function(dataA, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = Math.abs(dataA[i]);
	}
};

/**
 * Exponentiates array elements.
 *
 * @param {ArrayBufferView} dataA - the input array.
 * @param {ArrayBufferView} dataOut - the output array.
 *
 * @private
 * @static
 * @method exp
 */
exports.exp = function(dataA, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = Math.exp(dataA[i]);
	}
};

/**
 * Computes logarithm of array elements.
 *
 * @param {ArrayBufferView} dataA - the input array.
 * @param {ArrayBufferView} dataOut - the output array.
 *
 * @private
 * @static
 * @method log
 */
exports.log = function(dataA, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = Math.log(dataA[i]);
	}
};

/**
 * Computes square root of array elements.
 *
 * @param {ArrayBufferView} dataA - the input array.
 * @param {ArrayBufferView} dataOut - the output array.
 *
 * @private
 * @static
 * @method sqrt
 */
exports.sqrt = function(dataA, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		dataOut[i] = Math.sqrt(dataA[i]);
	}
};

/**
 * Squares array elements.
 *
 * @param {ArrayBufferView} dataA - the input array.
 * @param {ArrayBufferView} dataOut - the output array.
 *
 * @private
 * @static
 * @method square
 */
exports.square = function(dataA, dataOut) {
	var n = dataOut.length;
	for (var i = 0; i < n; ++i) {
		var a = dataA[i];
		dataOut[i] = a * a;
	}
};

/**
 * Computes the minimum value of elements in an array.
 *
 * @param {ArrayBufferView} dataA - the input array to compute minimum on.
 * @param {ArrayBufferView} dataOut - the output array to store the minimum at.
 *
 * @private
 * @static
 * @method min
 */
exports.min = function(dataA, dataOut) {
	/* Computation of all-array min */
	var lengthA = dataA.length;
	var result = dataA[0];
	for (var i = 1; i < lengthA; ++i) {
		result = Math.min(result, dataA[i]);
	}
	dataOut[0] = result;
};

/**
 * Computes the maximum value of elements in an array.
 *
 * @param {ArrayBufferView} dataA - the input array to compute maximum on.
 * @param {ArrayBufferView} dataOut - the output array to store the maximum at.
 *
 * @private
 * @static
 * @method max
 */
exports.max = function(dataA, dataOut) {
	/* Computation of all-array min */
	var lengthA = dataA.length;
	var result = dataA[0];
	for (var i = 1; i < lengthA; ++i) {
		result = Math.max(result, dataA[i]);
	}
	dataOut[0] = result;
};

/**
 * Computes the sum of elements in an array.
 *
 * @param {ArrayBufferView} dataA - the input array with elements to sum up.
 * @param {ArrayBufferView} dataOut - the output array to store the sum at.
 *
 * @private
 * @static
 * @method min
 */
exports.sum = function(dataA, dataOut) {
	var lengthA = dataA.length;
	var result = 0.0;
	for (var i = 0; i < lengthA; ++i) {
		result += dataA[i];
	}
	dataOut[0] = result;
};

/**
 * Computes the minimum value of elements along an axis.
 *
 * @param {ArrayBufferView} dataA - the input array to compute minima on.
 * @param {ArrayBufferView} dataOut - the output array to store the minima at.
 * @param {Number} outerStride - the product of input array dimensions preceeding the reduction dimension.
 * @param {Number} innerStride - the product of input array dimensions following the reduction dimension.
 * @param {Number} reductionDim - the length of input array along the reduction dimension.
 *
 * @private
 * @static
 * @method axisMin
 */
exports.axisMin = function(dataA, dataOut, outerStride, innerStride, reductionDim) {
	for (var i = 0; i < outerStride; ++i) {
		for (var k = 0; k < innerStride; ++k) {
			var offset = i * reductionDim * innerStride + k;
			var currentMin = dataA[offset];
			for (var j = 1; j < reductionDim; ++j) {
				offset += innerStride;
				currentMin = Math.min(currentMin, dataA[offset]);
			}
			dataOut[i * innerStride + k] = currentMin;
		}
	}
};

/**
 * Computes the maximum value of elements along an axis.
 *
 * @param {ArrayBufferView} dataA - the input array to compute maxima on.
 * @param {ArrayBufferView} dataOut - the output array to store the maxima at.
 * @param {Number} outerStride - the product of input array dimensions preceeding the reduction dimension.
 * @param {Number} innerStride - the product of input array dimensions following the reduction dimension.
 * @param {Number} reductionDim - the length of input array along the reduction dimension.
 *
 * @private
 * @static
 * @method axisMax
 */
exports.axisMax = function(dataA, dataOut, outerStride, innerStride, reductionDim) {
	for (var i = 0; i < outerStride; ++i) {
		for (var k = 0; k < innerStride; ++k) {
			var offset = i * reductionDim * innerStride + k;
			var currentMax = dataA[offset];
			for (var j = 1; j < reductionDim; ++j) {
				offset += innerStride;
				currentMax = Math.max(currentMax, dataA[offset]);
			}
			dataOut[i * innerStride + k] = currentMax;
		}
	}
};

/**
 * Computes the sum of elements along an axis.
 *
 * @param {ArrayBufferView} dataA - the input array to sum up.
 * @param {ArrayBufferView} dataOut - the output array to store the sums at.
 * @param {Number} outerStride - the product of input array dimensions preceeding the reduction dimension.
 * @param {Number} innerStride - the product of input array dimensions following the reduction dimension.
 * @param {Number} reductionDim - the length of input array along the reduction dimension.
 *
 * @private
 * @static
 * @method axisSum
 */
exports.axisSum = function(dataA, dataOut, outerStride, innerStride, reductionDim) {
	for (var i = 0; i < outerStride; ++i) {
		for (var k = 0; k < innerStride; ++k) {
			var offset = i * reductionDim * innerStride + k;
			var currentSum = dataA[offset];
			for (var j = 1; j < reductionDim; ++j) {
				offset += innerStride;
				currentSum += dataA[offset];
			}
			dataOut[i * innerStride + k] = currentSum;
		}
	}
};

/**
 * Computes the dot product of two N-dimensional arrays.
 *
 * @param {ArrayBufferView} dataA - an input multiplicand array.
 * @param {ArrayBufferView} dataB - an input multiplier array.
 * @param {ArrayBufferView} dataOut - the output product array.
 * @param {Number} strideA - the product of the the multiplicand dimensions preceeding the reduction dimension.
 * @param {Number} outerStrideB - the product of the multiplier dimensions preceeding the reduction dimension.
 * @param {Number} innerStrideB - the product of the multiplier dimensions following the reduction dimension.
 * @param {Number} reductionDim - the length of inputs arrays along the reduction dimension.
 *
 * @private
 * @static
 * @method dot
 */
exports.dot = function(dataA, dataB, dataOut, strideA, outerStrideB, innerStrideB, reductionDim) {
	for (var i = 0; i < strideA; ++i) {
		for (var j = 0; j < reductionDim; ++j) {
			for (var k = 0; k < outerStrideB; ++k) {
				for (var l = 0; l < innerStrideB; ++l) {
					dataOut[(i*outerStrideB + k) * innerStrideB + l] += dataA[i*reductionDim+j] * dataB[(k*reductionDim+j)*innerStrideB+l];
				}
			}
		}
	}
};

/**
 * Replicates array elements along an axis.
 *
 * @param {ArrayBufferView} dataA - the input array.
 * @param {ArrayBufferView} dataOut - the output array for repeated elements.
 * @param {Number} outerStride - the product of input array dimensions preceeding the expansion dimension.
 * @param {Number} innerStride - the product of input array dimensions following the expansion dimension.
 * @param {Number} expansionDim - the length of input array along the expansion dimension.
 * @param {Number} repeats - the number of times each element will be replicated.
 *
 * @private
 * @static
 * @method repeat
 */
exports.repeat = function(dataA, dataOut, outerStride, innerStride, expansionDim, repeats) {
	if (innerStride < repeats) {
		for (var i = 0; i < outerStride; ++i) {
			for (var j = 0; j < expansionDim; ++j) {
				for (var k = 0; k < innerStride; ++k) {
					var valueA = dataA[(i * expansionDim + j) * innerStride + k];
					for (var c = 0; c < repeats; ++c) {
						dataOut[((i * expansionDim + j) * repeats + c) * innerStride + k] = valueA;
					}
				}
			}
		}
	} else {
		for (var i = 0; i < outerStride; ++i) {
			for (var j = 0; j < expansionDim; ++j) {
				var rowA = dataA.subarray((i * expansionDim + j) * innerStride, (i * expansionDim + j + 1) * innerStride);
				for (var c = 0; c < repeats; ++c) {
					dataOut.set(rowA, ((i * expansionDim + j) * repeats + c) * innerStride);
				}
			}
		}
	}
};

/**
 * Solves a triangular system of equations.
 *
 * @param {ArrayBufferView} dataA - the NxN triangular matrix that defines the system.
 * @param {ArrayBufferView} dataB - the NxM matrix of right-hand sides.
 * @param {Number} rows - the number of rows (*N*) in the matrices.
 * @param {Number} columns - the number of columns (*M*) in the right-hand sides matrix.
 * @param {Boolean} transpose - indicator of whether the matrix **a** must be transposed.
 * @param {Boolean} lower - indicator of whether a lower or upper decomposition is to be computed.
 * @param {Boolean} unitDiagonal - specifies if the diagonal elements are implied to equal 1.
 *
 * @private
 * @static
 * @method solveTriangular
 */
exports.solveTriangular = function(dataA, dataB, rows, columns, transpose, lower, unitDiagonal) {
	if (lower) {
		if (transpose) {
			for (var i = rows - 1; i >= 0; --i) {
				for (var k = 0; k < columns; ++k){
					var Xii = dataB[i*columns+k];
					for (var j = rows - 1; j > i; --j) {
						Xii -= dataA[j*rows+i] * dataB[j*columns+k];
					}
					dataB[i*columns+k] = unitDiagonal ? Xii : Xii / dataA[i*rows+i];
				}
			}
		} else {
			for (var i = 0; i < rows; ++i) {
				for (var k = 0; k < columns; ++k){
					var Xii = dataB[i*columns+k];
					for (var j = 0; j < i; ++j) {
						Xii -= dataA[i*rows+j] * dataB[j*columns+k];
					}
					dataB[i*columns+k] = unitDiagonal ? Xii : Xii / dataA[i*rows+i];
				}
			}
		}
	} else {
		if (transpose) {
			for (var i = 0; i < rows; ++i) {
				for (var k = 0; k < columns; ++k){
					var Xii = dataB[i*columns+k];
					for (var j = 0; j < i; ++j) {
						Xii -= dataA[j*rows+i] * dataB[j*columns+k];
					}
					dataB[i*columns+k] = unitDiagonal ? Xii : Xii / dataA[i*rows+i];
				}
			}
		} else {
			for (var i = rows - 1; i >= 0; --i) {
				for (var k = 0; k < columns; ++k){
					var Xii = dataB[i*columns+k];
					for (var j = rows - 1; j > i; --j) {
						Xii -= dataA[i*rows+j] * dataB[j*columns+k];
					}
					dataB[i*columns+k] = unitDiagonal ? Xii : Xii / dataA[i*rows+i];
				}
			}
		}
	}
};


/**
 * Computes upper or lower cholesky decomposition.
 *
 * @param {ArrayBufferView} data - the matrix to be factored.
 * @param {Number} n - the number of rows and columns in the arrays.
 * @param {Boolean} lower - indicator of whether a lower or upper decomposition is to be computed.
 *
 * @private
 * @static
 * @method cholesky
 */
exports.cholesky = function(data, n, lower) {
	for (var i = 0; i < n; ++i) {
		/* Compute the diagonal value */
		var Lii = Math.sqrt(data[i*n+i]);
		data[i*n+i] = Lii;
		/* Update the ith column */
		for (var j = i + 1; j < n; ++j) {
			data[j*n+i] /= Lii;
		}
		/* Update the ith row */
		for (var j = i + 1; j < n; ++j) {
			data[i*n+j] /= Lii;
		}
		/* Compute Schur complement */
		for (var j = i + 1; j < n; ++j) {
			for (var k = i + 1; k < n; ++k) {
				data[j*n+k] -= data[j*n+i] * data[i*n+k];
			}
		}
	}
	if (lower) {
		/* Zero-out the upper sub-diagonals */
		for (var i = 0; i < n; ++i) {
			for (var j = i + 1; j < n; ++j) {
				data[i*n+j] = 0.0;
			}
		}
	} else {
		/* Zero-out the lower sub-diagonals */
		for (var i = 0; i < n; ++i) {
			for (var j = 0; j < i; ++j) {
				data[i*n+j] = 0.0;
			}
		}
	}
};

},{}],10:[function(_dereq_,module,exports){

var protobufjs = _dereq_("protobufjs");
protobufjs.convertFieldsToCamelCase = true;
var requestsProto = "package furious;\n\noption optimize_for = LITE_RUNTIME;\n\nenum DataType {\n\tFLOAT64 = 0;\n\tFLOAT32 = 1;\n}\n\nenum TriangularMatrixType {\n\tUPPER = 0;\n\tLOWER = 1;\n}\n\nenum TranspositionType {\n\tNORMAL    = 0;\n\tTRANSPOSE = 1;\n}\n\nmessage Request {\n\tenum Type {\n\t\tEMPTY_ARRAY              =  0;\n\t\tDATA_ARRAY               =  1;\n\t\tCONST_ARRAY              =  2;\n\t\tLINSPACE                 =  3;\n\t\tRESHAPE                  =  4;\n\t\tREPEAT                   =  5;\n\t\tDEALLOCATE               =  6;\n\t\tFETCH                    =  7;\n\t\tBARRIER                  =  8;\n\t\tINFO                     =  9;\n\t\tBINARY_OPERATION         = 10;\n\t\tBINARY_CONST_OPERATION   = 11;\n\t\tUNARY_OPERATION          = 12;\n\t\tREDUCTION_OPERATION      = 13;\n\t\tAXIS_REDUCTION_OPERATION = 14;\n\t\tDOT_OPERATION            = 15;\n\t\tCHOLESKY_DECOMPOSITION   = 16;\n\t\tSOLVE_TRIANGULAR         = 17;\n\t}\n\trequired fixed32                      id                             =  1;\n\trequired Type                         type                           =  2;\n\n\toptional EmptyArrayRequest            empty_array_request            =  3;\n\toptional DataArrayRequest             data_array_request             =  4;\n\toptional ConstArrayRequest            const_array_request            =  5;\n\toptional LinspaceRequest              linspace_request               =  6;\n\toptional ReshapeRequest               reshape_request                =  7;\n\toptional RepeatRequest                repeat_request                 =  8;\n\toptional DeallocateRequest            deallocate_request             =  9;\n\toptional FetchRequest                 fetch_request                  = 10;\n\toptional BinaryOperationRequest       binary_operation_request       = 11;\n\toptional BinaryConstOperationRequest  binary_const_operation_request = 12;\n\toptional UnaryOperationRequest        unary_operation_request        = 13;\n\toptional ReductionRequest             reduction_request              = 14;\n\toptional AxisReductionRequest         axis_reduction_request         = 15;\n\toptional DotOperationRequest          dot_operation_request          = 16;\n\toptional CholeskyDecompositionRequest cholesky_decomposition_request = 17;\n\toptional SolveTriangularRequest       solve_triangular_request       = 18;\n}\n\nmessage EmptyArrayRequest {\n\trequired fixed32  id_out      = 1;\n\trepeated uint32   shape       = 2 [packed=true];\n\trequired DataType data_type   = 3;\n}\n\nmessage DataArrayRequest {\n\trequired fixed32  id_out      = 1;\n\trepeated uint32   shape       = 2 [packed=true];\n\trequired DataType data_type   = 3;\n\trequired bytes    data_buffer = 4;\n}\n\nmessage ConstArrayRequest {\n\trequired fixed32  id_out      = 1;\n\trepeated uint32   shape       = 2 [packed=true];\n\trequired DataType data_type   = 3;\n\trequired double   fill_value  = 4;\n}\n\nmessage LinspaceRequest {\n\trequired sfixed32  id_out     = 1;\n\trequired double    start      = 2;\n\trequired double    stop       = 3;\n\trequired uint32    samples    = 4;\n\trequired bool      closed     = 5;\n\trequired DataType  data_type  = 6;\n}\n\nmessage ReshapeRequest {\n\trequired sfixed32  id_a      = 1;\n\trequired fixed32   id_out    = 2;\n\trepeated uint32    shape_out = 3 [packed=true];\n}\n\nmessage RepeatRequest {\n\trequired sfixed32 id_a    = 1;\n\trequired fixed32  id_out  = 2;\n\trequired uint32   axis    = 3;\n\trequired uint32   repeats = 4;\n}\n\nmessage DeallocateRequest {\n\trequired fixed32 id_a = 1;\n}\n\nmessage FetchRequest {\n\trequired sfixed32 id_a = 1;\n}\n\nmessage BinaryOperationRequest {\n\tenum Type {\n\t\tADD = 0;\n\t\tSUB = 1;\n\t\tMUL = 2;\n\t\tDIV = 3;\n\t}\n\trequired Type     type   = 1;\n\trequired sfixed32 id_a   = 2;\n\trequired sfixed32 id_b   = 3;\n\trequired fixed32  id_out = 4;\n}\n\nmessage BinaryConstOperationRequest {\n\tenum Type {\n\t\tADDC  = 0;\n\t\tSUBC  = 1;\n\t\tSUBRC = 2;\n\t\tMULC  = 3;\n\t\tDIVC  = 4;\n\t\tDIVRC = 5;\n\t}\n\trequired Type     type    = 1;\n\trequired sfixed32 id_a    = 2;\n\trequired double   value_b = 3;\n\trequired fixed32  id_out  = 4;\n}\n\nmessage UnaryOperationRequest {\n\tenum Type {\n\t\tNEG    = 0;\n\t\tABS    = 1;\n\t\tEXP    = 2;\n\t\tLOG    = 3;\n\t\tSQRT   = 4;\n\t\tSQUARE = 5;\n\t}\n\trequired Type     type   = 1;\n\trequired sfixed32 id_a   = 2;\n\trequired fixed32  id_out = 3;\n}\n\nmessage ReductionRequest {\n\tenum Type {\n\t\tSUM = 0;\n\t\tMIN = 1;\n\t\tMAX = 2;\n\t}\n\trequired Type     type   = 1;\n\trequired sfixed32 id_a   = 2;\n\trequired fixed32  id_out = 3;\n}\n\nmessage AxisReductionRequest {\n\tenum Type {\n\t\tSUM = 0;\n\t\tMIN = 1;\n\t\tMAX = 2;\n\t}\n\trequired Type     type   = 1;\n\trequired sfixed32 id_a   = 2;\n\trequired uint32   axis   = 3;\n\trequired fixed32  id_out = 4;\n}\n\nmessage DotOperationRequest {\n\trequired sfixed32 id_a   = 1;\n\trequired sfixed32 id_b   = 2;\n\trequired fixed32  id_out = 3;\n}\n\nmessage CholeskyDecompositionRequest {\n\trequired sfixed32             id_a   = 1;\n\trequired TriangularMatrixType a_type = 2;\n\trequired fixed32              id_out = 3;\n}\n\nmessage SolveTriangularRequest {\n\trequired sfixed32             id_a            = 1;\n\trequired TriangularMatrixType a_type          = 2;\n\trequired TranspositionType    a_transposition = 3;\n\trequired bool                 unit_diagonal   = 4;\n\trequired sfixed32             id_y            = 5;\n\trequired fixed32              id_x            = 6;\n}\n";
module.exports = protobufjs.loadProto(requestsProto).build("furious");

},{"protobufjs":18}],11:[function(_dereq_,module,exports){

var protobufjs = _dereq_("protobufjs");
protobufjs.convertFieldsToCamelCase = true;
var responsesProto = "package furious;\n\noption optimize_for = LITE_RUNTIME;\n\nmessage Response {\n\tenum Type {\n\t\tFETCH   = 0;\n\t\tERROR   = 1;\n\t\tINIT    = 2;\n\t\tBARRIER = 3;\n\t\tINFO    = 4;\n\t}\n\trequired fixed32         id               = 1;\n\trequired Type            type             = 2;\n\n\toptional FetchResponse   fetch_response   = 3;\n\toptional ErrorResponse   error_response   = 4;\n\toptional InitResponse    init_response    = 5;\n\toptional InfoResponse    info_response    = 7;\n}\n\nmessage FetchResponse {\n\trequired bytes data_buffer = 1;\n}\n\nmessage ErrorResponse {\n\tenum Type {\n\t\tRUNTIME  = 0;\n\t\tARGUMENT = 1;\n\t\tPARSE    = 2;\n\t}\n\trequired Type   type        = 1;\n\toptional string description = 2;\n}\n\nmessage InitResponse {\n\toptional uint32 concurrency = 1;\n}\n\nmessage InfoResponse {\n}\n";
module.exports = protobufjs.loadProto(responsesProto).build("furious");

},{"protobufjs":18}],12:[function(_dereq_,module,exports){
"use strict";

/**
 * Provides helper functions
 *
 * @private
 * @class util
 */

var isNumber = function(n) {
	return n === +n;
};
exports.isNumber = isNumber;

var isReal = function(n) {
	return (n === +n) && (isFinite(n));
};
exports.isReal = isReal;

var isInt = function(n) {
	return n === (n|0);
};
exports.isInt = isInt;

exports.isPositiveInt = function(n) {
	return (n === +n) && (n === (n|0)) && (n > 0);
};

var isArray = function(list) {
	return list instanceof Array;
};
exports.isArray = isArray;

exports.isIntArray = function(list) {
	if (exports.isArray(list)) {
		for (var i = 0; i < list.length; i++) {
			if (!exports.isInt(list[i])) {
				return false;
			}
		}
		return true;
	} else {
		return false;
	}
};

exports.isPositiveIntArray = function(list) {
	if (exports.isArray(list)) {
		for (var i = 0; i < list.length; i++) {
			if (!exports.isPositiveInt(list[i])) {
				return false;
			}
		}
		return true;
	} else {
		return false;
	}
};

exports.asIntArray = function (list) {
	if (exports.isInt(list)) {
		return [list];
	} else if (exports.isIntArray(list)) {
		return list;
	} else {
		throw new TypeError(list + " can not be converted to integer array");
	}
};

/**
 * Compares for equality two arrays of primitive types.
 *
 * @param {Number[]} arrayA - the first array to compare.
 * @param {Number[]} arrayB - the second array to compare.
 *
 * @example
 *     if (!util.arrayEquals(a.shape, b.shape)) {
 *	       throw new Error("a and b have incompatible shapes");
 *     }
 *
 * @private
 * @static
 * @method arrayEquals
 */
exports.arrayEquals = function(arrayA, arrayB) {
	if (arrayA === arrayB) {
		return true;
	}
	if (arrayA.length !== arrayB.length) {
		return false;
	}
	var n = arrayA.length;
	for (var i = 0; i < n; ++i) {
		if (arrayA[i] !== arrayB[i]) {
			return false;
		}
	}
	return true;
};

exports.roundUp = function (number, multiple) {
	return Math.ceil(number / multiple) * multiple;
};

/**
 * Validates an integer variable
 * Throws an error if the variable is not integer.
 *
 * @param {Number} variable - the variable to validate.
 * @param {String} variableName - the name of the variable, that may be used in an error message.
 * @return {Number} - the variable as integer.
 *
 * @example
 *     offset = util.checkInt(offset, "offset");
 *
 * @private
 * @static
 * @method checkInt
 */
var checkInt = function(variable, variableName) {
	if (!isNumber(variable)) {
		throw new TypeError(variableName + " must be a number");
	}
	if (!isInt(variable)) {
		throw new Error(variableName + " must be an integer");
	}
	return variable|0;
};
exports.checkInt = checkInt;

/**
 * Validates a dimension argument.
 * Throws an error if the argument is not an integer number or is not positive.
 *
 * @param {Number} dimension - the dimension to validate.
 * @param {String} dimensionName - the name of the dimension variable, that may be used in an error message.
 * @return {Number} - the dimension as integer.
 *
 * @example
 *     width = util.checkDimension(width, "width");
 *
 * @private
 * @static
 * @method checkDimension
 */
var checkDimension = function(dimension, dimensionName) {
	dimension = checkInt(dimension, dimensionName);
	if (dimension < 1) {
		throw new RangeError(dimension + " must be positive");
	}
	return dimension|0;
};
exports.checkDimension = checkDimension;

/**
 * Validate the shape argument.
 * Throws an error if the argument does not represent a valid shape.
 * Returns the shape as an integer array.
 *
 * @param {(Number|Number[])} shape - the shape argument to validate.
 *
 * @example
 *     shape = util.checkShape(shape);
 *
 * @private
 * @static
 * @method checkShape
 */
var checkShape = function(shape) {
	if (isNumber(shape)) {
		return checkShape([shape]);
	} else if (isArray(shape)) {
		var n = shape.length;
		var outShape = new Array(n);
		for (var i = 0; i < n; i++) {
			if (!isNumber(shape[i])) {
				throw new Error("Shape has non-numeric dimensions");
			}
			if (!isInt(shape[i])) {
				throw new Error("Shape must have integer dimensions");
			}
			if (shape[i] < 1) {
				throw new Error("Degenerate shape");
			}
			outShape[i] = shape[i]|0;
		}
		return outShape;
	} else {
		throw new Error("Shape must be an integer or integer array");
	}
};
exports.checkShape = checkShape;

/**
 * Checks that the two shapes are similar.
 * Throws an error if the two shapes are different.
 * If the data types are compatible, the function does nothing.
 *
 * @param {Number[]} shapeA - one valid shape to compare.
 * @param {Number[]} shapeB - another valid shape to compare.
 *
 * @example
 *     util.checkShapesCompatibility(a.shape, b.shape);
 *
 * @private
 * @static
 * @method checkShapesCompatibility
 */
exports.checkShapesCompatibility = function(shapeA, shapeB) {
	if (shapeA.length != shapeB.length) {
		throw new Error("The shapes have different dimensions");
	}
	var n = shapeA.length;
	for (var i = 0; i < n; i++) {
		if (shapeA[i] != shapeB[i]) {
			throw new Error("The shapes are different");
		}
	}
};

/**
 * Computes array length from its shape.
 *
 * @param {Number[]} shape - an array shape.  The shape must be valid w.r.t. **checkShape** function.
 *
 * @example
 *     var length = util.computeLength(shape);
 *
 * @private
 * @static
 * @method computeLength
 */
exports.computeLength = function(shape) {
	var length = 1;
	for (var i = 0; i < shape.length; ++i) {
		length *= shape[i];
	}
	return length;
};

/**
 * Checks the the argument represents a data type.
 * Throws an error if the argument is not of DataType type.
 * If the argument is a DataType object, the function does nothing.
 *
 * @param {DataType} dataType - the expectedly data type object to validate.
 * @return {DataType} - a data type object equivalent to the argument.
 *
 * @example
 *     dataType = util.checkDataType(dataType);
 *
 * @private
 * @static
 * @method checkDataType
 */
exports.checkDataType = function(dataType) {
	var DataType = _dereq_("./DataType");
	if (!(dataType instanceof DataType)) {
		throw new TypeError("dataType is not an instance of DataType");
	}
	return dataType;
};

/**
 * Checks that the two data types are compatible.
 * Throws an error if the data types do not match.
 * If the data types are compatible, the function does nothing.
 *
 * @param {DataType} dataTypeA - the first data type.
 * @param {DataType} dataTypeB - the second data type.
 *
 * @example
 *     util.checkDataTypesCompatibility(a.dataType, b.dataType);
 *
 * @private
 * @static
 * @method checkDataTypesCompatibility
 */
exports.checkDataTypesCompatibility = function(dataTypeA, dataTypeB) {
	if (!dataTypeA.equals(dataTypeB)) {
		throw new Error("The data types are not compatible");
	}
};

/**
 * Validates an NDArray parameter.
 * Throws an error if the expected NDArray argument has other type or if it has been invalidated.
 * If the argument is a valid NDArray, the function does nothing.
 *
 * @param {NDArray} array - the expectedly NDArray argument to be validated.
 * @param {String} vaname - the name of the NDArray argument to be used in error messages.
 *
 * @example
 *     util.checkNDArray(out, "out");
 *
 * @private
 * @static
 * @method checkNDArray
 */
exports.checkNDArray = function(array, varname) {
	var NDArray = _dereq_("./NDArray");
	if (!(array instanceof NDArray)) {
		throw new TypeError(varname + " is not an NDArray");
	}
	if (!array.isValid()) {
		throw new Error(varname + " is an invalidated array");
	}
};

/**
 * Validates an NDArray parameter and ensures that it is a 2-dimensional array.
 * Throws an error if the expected NDArray argument has other type, if it has been invalidated, or if the number of dimensions is different than 2.
 * If the argument is a valid 2-dimensional NDArray, the function does nothing.
 *
 * @param {NDArray} array - the expectedly NDArray argument to be validated.
 * @param {String} vaname - the name of the NDArray argument to be used in error messages.
 *
 * @example
 *     util.check2DArray(a, "a");
 *
 * @private
 * @static
 * @method check2DArray
 */
exports.check2DArray = function(array, varname) {
	exports.checkNDArray(array, varname);
	if (array.shape.length !== 2) {
		throw new Error(varname + " is not a 2-dimensional array");
	}
};

/**
 * Validates an NDArray parameter and ensures that it is a square 2-dimensional array.
 * Throws an error if the expected NDArray argument has other type, if it has been invalidated, or if the number of dimensions is different than 2, or the number of rows is different than the number of columns.
 * If the argument is a valid square 2-dimensional NDArray, the function does nothing.
 *
 * @param {NDArray} array - the expectedly NDArray argument to be validated.
 * @param {String} vaname - the name of the NDArray argument to be used in error messages.
 *
 * @example
 *     util.checkSquare2DArray(a, "a");
 *
 * @private
 * @static
 * @method checkSquare2DArray
 */
exports.checkSquare2DArray = function(array, varname) {
	exports.check2DArray(array, varname);
	if (array.shape[0] !== array.shape[1]) {
		throw new Error(varname + " has different number of rows and columns");
	}
};

/**
 * Checks that the two arrays are different.
 * Throws an error if they refer to the same object.
 * If the arrays are different, the function does nothing.
 *
 * @param {NDArray} a - the first array to check. Must be an NDArray object.
 * @param {NDArray} b - the second array to check. Must be an NDArray object.
 * @param {String} varnameA - name of the first array variable. This name may be used in an error message.
 * @param {String} varnameB - name of the second array variable. This name may be used in an error message.
 *
 * @example
 *     util.checkDifferentNDArrays(a, out, "a", "out");
 *
 * @private
 * @static
 * @method checkDifferentNDArrays
 */
exports.checkDifferentNDArrays = function(a, b, varnameA, varnameB) {
	if (a === b) {
		throw new Error("The arrays " + varnameA + " and " + varnameB + " must be different");
	}
};

/**
 * Validates **repeats** parameter for repeatition/tiling of array along an axis.
 * Throws an error if **repeats** is not an integer or if **repeats** is smaller than 2.
 * If **repeats** is valid, the function does nothing.
 *
 * @param {Number} repeats - the repeats argument to be verified.
 * @return {Number} - **repeats** casted to integer.
 *
 * @example
 *     repeats = util.checkRepeats(repeats);
 *
 * @private
 * @static
 * @method checkRepeats
 */
exports.checkRepeats = function(repeats) {
	if (!isInt(repeats)) {
		throw new TypeError("Repeats is not an integer");
	}
	if (repeats <= 1) {
		throw new RangeError("Repeats should be greater than 1");
	}
	return repeats|0;
};

/**
 * Validates axis parameter for reductions along an axis.
 * Throws an error if axis is not an integer, if axis is negative, or axis exceeds the number of dimensions.
 * If axis is valid, the function does nothing.
 *
 * @param {Number} axis - the axis argument to be verified.
 * @param {Number} numDimensions - the number of dimensions in the array being reduced.
 * @return {Number} - axis casted to integer.
 *
 * @example
 *     axis = util.checkAxis(axis, ndarray.shape.length);
 *
 * @private
 * @static
 * @method checkAxis
 */
exports.checkAxis = function(axis, numDimensions) {
	if (!isInt(axis)) {
		throw new TypeError("Axis is not an integer");
	}
	if (axis < 0) {
		throw new RangeError("Axis is negative");
	}
	/* E.g. 3-dimensional array has axes 0, 1, 2 (but not 3!) */
	if (axis >= numDimensions) {
		throw new RangeError("Axis out of range");
	}
	return axis|0;
};

exports.checkTransposeKind = function(kind, defaultKind) {
	if (typeof kind === "undefined") {
		return defaultKind;
	} else if ((kind === "N") || (kind === "T")) {
		return kind;
	} else {
		throw new Error("The kind of transposition is neither N(normal) nor T(ranspose)");
	}
};

/**
 * Validates the kind of triangular matrix.
 * Throws an error if the kind is neither "L" (for lower) nor "U" (for upper).
 * If the kind is valid, the function does nothing.
 *
 * @param {Number} kind - the kind of triangular matrix.
 * @param {Number} defaultKind - the value to be returned if kind is undefined.
 *
 * @example
 *     kind = util.checkTriangularKind(kind, "U");
 *
 * @private
 * @static
 * @method checkTriangularKind
 */
exports.checkTriangularKind = function(kind, defaultKind) {
	if (typeof kind === "undefined") {
		return defaultKind;
	} else if ((kind === "L") || (kind === "U")) {
		return kind;
	} else {
		throw new Error("The kind of a triangular matrix is neither L(ower) nor U(pper)");
	}
};

/**
 * Validates the shape of output array for reductions along an axis.
 * Throws an error if the shape of the output array does match the shape of input array after reduction along the axis.
 *
 * @param {Number[]} inShape - the shape of the input array.
 * @param {Number[]} outShape - the shape of the output array to be validated.
 * @param {Number} axis - the axis for reduction of input array. Must be valid w.r.t. inShape.
 *
 * @example
 *     util.checkAxisReductionOutShape(inArray.shape, outArray.shape, axis);
 *
 * @private
 * @static
 * @method
 */
exports.checkAxisReductionOutShape = function(inShape, outShape, axis) {
	if (inShape.length !== outShape.length + 1) {
		throw new Error("Output array has invalid number of dimensions for this operation");
	}
	for (var i = 0; i < axis; ++i) {
		if (inShape[i] !== outShape[i]) {
			throw new Error("Output array has invalid shape for this operation");
		}
	}
	for (var i = axis + 1; i < inShape.length; ++i) {
		if (inShape[i] !== outShape[i-1]) {
			throw new Error("Output array has invalid shape for this operation");
		}
	}
};

/**
 * Computes the shape of an array after reduction along an axis.
 *
 * @param {Number[]} inShape - the shape of the input array.
 * @param {Number} axis - the axis for reduction of input array. Must be valid w.r.t. inShape.
 * @return {Number[]} - the shape of the output array.
 *
 * @example
 *     var outShape = util.getAxisReductionOutShape(inArray.shape, axis);
 *     var outArray = new NDArray(outShape, inArray.dataType, context);
 *
 * @private
 * @static
 * @method
 */
exports.computeAxisReductionOutShape = function(inShape, axis) {
	var outShape = [];
	for (var i = 0; i < inShape.length; ++i) {
		if (i !== axis) {
			outShape.push(inShape[i]);
		}
	}
	return outShape;
};

/**
 * Computes the product of array dimensions before the axis.
 *
 * @param {Number[]} shape - the shape of the array.
 * @param {Number} axis - the axis used in an operation. Must be valid w.r.t. shape.
 * @return {Number} - the product of array dimensions before axis.
 *
 * @example
 *     // 5-dimensional array
 *     var ndarray = context.empty([2, 3, 4, 5, 6]);
 *     // Returns 6 = 2*3
 *     var outerStride = computeOuterStride(ndarray, 2);
 *
 * @private
 * @static
 * @method
 */
exports.computeOuterStride = function(shape, axis) {
	var outerStride = 1;
	for (var i = 0; i < axis; ++i) {
		outerStride *= shape[i];
	}
	return outerStride;
};

/**
 * Computes the product of array dimensions after the axis.
 *
 * @param {Number[]} shape - the shape of the array.
 * @param {Number} axis - the axis used in an operation. Must be valid w.r.t. shape.
 * @return {Number} - the product of array dimensions after axis.
 *
 * @example
 *     // 5-dimensional array
 *     var ndarray = context.empty([2, 3, 4, 5, 6]);
 *     // Returns 6 = 2*3
 *     var innerStride = computeInnerStride(ndarray, 2);
 *
 * @private
 * @static
 * @method
 */
exports.computeInnerStride = function(shape, axis) {
	var innerStride = 1;
	for (var i = axis + 1; i < shape.length; ++i) {
		innerStride *= shape[i];
	}
	return innerStride;
};

var discoverArrayShapeRecursive = function(data, shape, level) {
	if (isArray(data)) {
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
		if (!isNumber(data)) {
			throw new TypeError("Non-numeric element: " + data);
		}
	}
};
exports.discoverArrayShapeRecursive = discoverArrayShapeRecursive;

var copyArrayDataRecursive = function(dataBuffer, dataArray, shape, level, offset) {
	var n = shape[level];
	if (level === shape.length - 1) {
		dataBuffer.set(dataArray, offset * n);
	} else {
		for (var i = 0; i < n; i++) {
			copyArrayDataRecursive(dataBuffer, dataArray[i], shape, level + 1, offset * n  + i);
		}
	}
};
exports.copyArrayDataRecursive = copyArrayDataRecursive;

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
};
exports.createArrayRecursive = createArrayRecursive;

},{"./DataType":1,"./NDArray":2}],13:[function(_dereq_,module,exports){
"use strict";

var NDArray = _dereq_("../NDArray");
var DataType = _dereq_("../DataType");
var util = _dereq_("../util");


/* Buggy in Chromium-WebCL */
var useBufferCreationWithInit = false;

var isNodeWebCL = false;
var cl = void 0;
var availableDevices = null;
var availableDevicesDescriptions = null;
var defaultDeviceIndex = -1;

/**
 * If the global cl variable is undefined, this method would initialize it with a WebCL instance.
 * Works for both browser and Node.js
 *
 * @private
 * @static
 * @method initWebCL
 * @return {WebCL} - an instance of WebCL object from WebCL specification. If WebCL is not supported, return null.
 */
var initWebCL = function() {
	if (typeof cl === "undefined") {
		if (typeof window === "object") {
			cl = (typeof window.webcl !== "undefined") ? window.webcl : null;
		} else {
			try {
				cl = _dereq_("node-webcl");
				isNodeWebCL = true;
			} catch (e) {
				cl = null;
			}
		}
	}
	return cl;
};

/**
 * Creates an empty WebCLEvent.
 * Works for both browser and Node.js
 *
 * @private
 * @static
 * @method createEvent
 * @return {WebCLEvent} - an empty instance of WebCLEvent.
 */
var createEvent = function() {
	if (isNodeWebCL) {
		return new cl.WebCLEvent();
	} else {
		return new WebCLEvent();
	}
};

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
 * Checks if a WebCL device supports KHR_fp64 extension.
 *
 * @private
 * @method isFP64Capable
 * @param {WebCLDevice} device - the device to check for KHR_fp64 support.
 * @return {Boolean} - true if the device supports KHR_fp64 and false otherwise.
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
 * Initialises and returns a list of WebCL devices suitable for computation.
 *
 * @private
 * @static
 * @method getAvailableDevices
 * @return {WebCLDevice[]} - a list of GPU and CPU WebCL devices that support KHR_FP64 (may be empty).
 */
var getAvailableDevices = function() {
	if (availableDevices === null) {
		availableDevices = [];
		var webcl = initWebCL();
		if (webcl !== null) {
			var platforms = cl.getPlatforms();
			for (var i = 0; i < platforms.length; ++i) {
				var platform = platforms[i];
				var devices = platform.getDevices(cl.DEVICE_TYPE_ALL);
				for (var j = 0; j < devices.length; ++j) {
					var device = devices[j];
					if (isFP64Capable(device)) {
						availableDevices.push(device);
					}
				}
			}
		}
		generateAvailableDevicesDescriptions();
	}
	return availableDevices;
};

var generateAvailableDevicesDescriptions = function() {
	availableDevicesDescriptions = [];
	/* If devices names are available, use them */
	var haveNames = true;
	for (var i = 0; i < availableDevices.length; ++i) {
		var device = availableDevices[i];
		var name = device.getInfo(cl.DEVICE_NAME);
		if ((name === null) || (name === "")) {
			haveNames = false;
			break;
		}
		availableDevicesDescriptions[i] = name;
	}
	if (!haveNames) {
		/* At least some names are not available: try to assign names based on classification (e.g. "CPU", "dGPU", "iGPU") */
		var cpuCount = 0, igpuCount = 0, dgpuCount = 0;
		for (var i = 0; i < availableDevices.length; ++i) {
			var device = availableDevices[i];
			var classification = classifyDevice(device);
			if (classification === "cpu") {
				++cpuCount;
				availableDevicesDescriptions[i] = "CPU";
			} else if (classification === "igpu") {
				++igpuCount;
				availableDevicesDescriptions[i] = "iGPU";
			} else if (classification === "dgpu") {
				++dgpuCount;
				availableDevicesDescriptions[i] = "dGPU";
			} else {
				throw new Error("Impossible device classification: " + classification);
			}
		}
		if ((cpuCount > 1) || (igpuCount > 1) || (dgpuCount > 1)) {
			/* We have multiple devices of the same type. Need to use more complicated naming scheme */
			var cpuIndex = 0, igpuIndex = 0, dgpuIndex = 0;
			for (var i = 0; i < availableDevices.length; ++i) {
				var device = availableDevices[i];
				var classification = classifyDevice(device);
				if (classification === "cpu") {
					if (cpuCount > 1) {
						++cpuIndex;
						availableDevicesDescriptions[i] = "CPU #" + cpuIndex;
					}
				} else if (classification === "igpu") {
					if (igpuCount > 1) {
						++igpuIndex;
						availableDevicesDescriptions[i] = "iGPU #" + igpuIndex;
					}
				} else if (classification === "dgpu") {
					if (dgpuCount > 1) {
						++dgpuCount;
						availableDevicesDescriptions[i] = "dGPU #" + dgpuIndex;
					}
				} else {
					throw new Error("Impossible device classification: " + classification);
				}
			}
		}
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
 * Selects the optimal WebCL device among the available devices.
 * The priority of devices: "dgpu" > "igpu" > "cpu"
 *
 * @private
 * @method getDefaultDeviceIndex
 * @return {WebCLDevice} - the selected device from the list.
 */
var getDefaultDeviceIndex = function() {
	if (defaultDeviceIndex === -1) {
		var availableDevices = getAvailableDevices();
		if (availableDevices.length === 0) {
			defaultDeviceIndex = -2;
			return defaultDeviceIndex;
		}
		var deviceClassifications = [];
		/* Search for "dgpu" */
		for (var i = 0; i < availableDevices.length; ++i) {
			var device = availableDevices[i];
			var deviceClass = classifyDevice(device);
			if (deviceClass === "dgpu") {
				defaultDeviceIndex = i;
				return i;
			}
			deviceClassifications.push(deviceClass);
		}
		/* Search for "igpu" */
		for (var i = 0; i < availableDevices.length; ++i) {
			if (deviceClassifications[i] === "igpu") {
				defaultDeviceIndex = i;
				return i;
			}
		}
		/* Search for "cpu" */
		for (var i = 0; i < availableDevices.length; ++i) {
			if (deviceClassifications[i] === "cpu") {
				defaultDeviceIndex = i;
				return i;
			}
		}
	}
	return defaultDeviceIndex;
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
		},
		dot: {
			f32: program.createKernel("dot_f32"),
			f64: program.createKernel("dot_f64")
		}
	};
	return kernels;
};

function WebCLContext(options, callback) {
	initWebCL();
	var binaryKernelsSource = "kernel void add_f32(\n\tuint length,\n\tglobal float* a,\n\tglobal float* b,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] + b[id];\n\t}\n}\nkernel void add_f64(\n\tuint length,\n\tglobal double* a,\n\tglobal double* b,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] + b[id];\n\t}\n}\nkernel void sub_f32(\n\tuint length,\n\tglobal float* a,\n\tglobal float* b,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] - b[id];\n\t}\n}\nkernel void sub_f64(\n\tuint length,\n\tglobal double* a,\n\tglobal double* b,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] - b[id];\n\t}\n}\nkernel void mul_f32(\n\tuint length,\n\tglobal float* a,\n\tglobal float* b,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] * b[id];\n\t}\n}\nkernel void mul_f64(\n\tuint length,\n\tglobal double* a,\n\tglobal double* b,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] * b[id];\n\t}\n}\nkernel void div_f32(\n\tuint length,\n\tglobal float* a,\n\tglobal float* b,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] / b[id];\n\t}\n}\nkernel void div_f64(\n\tuint length,\n\tglobal double* a,\n\tglobal double* b,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] / b[id];\n\t}\n}\nkernel void addc_f32(\n\tuint length,\n\tglobal float* a,\n\tfloat b,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] + b;\n\t}\n}\nkernel void addc_f64(\n\tuint length,\n\tglobal double* a,\n\tdouble b,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] + b;\n\t}\n}\nkernel void subc_f32(\n\tuint length,\n\tglobal float* a,\n\tfloat b,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] - b;\n\t}\n}\nkernel void subc_f64(\n\tuint length,\n\tglobal double* a,\n\tdouble b,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] - b;\n\t}\n}\nkernel void subrc_f32(\n\tuint length,\n\tglobal float* a,\n\tfloat b,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = b / a[id];\n\t}\n}\nkernel void subrc_f64(\n\tuint length,\n\tglobal double* a,\n\tdouble b,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = b / a[id];\n\t}\n}\nkernel void mulc_f32(\n\tuint length,\n\tglobal float* a,\n\tfloat b,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] * b;\n\t}\n}\nkernel void mulc_f64(\n\tuint length,\n\tglobal double* a,\n\tdouble b,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] * b;\n\t}\n}\nkernel void divc_f32(\n\tuint length,\n\tglobal float* a,\n\tfloat b,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] / b;\n\t}\n}\nkernel void divc_f64(\n\tuint length,\n\tglobal double* a,\n\tdouble b,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = a[id] / b;\n\t}\n}\nkernel void divrc_f32(\n\tuint length,\n\tglobal float* a,\n\tfloat b,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = b / a[id];\n\t}\n}\nkernel void divrc_f64(\n\tuint length,\n\tglobal double* a,\n\tdouble b,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = b / a[id];\n\t}\n}\n";
	var unaryKernelsSource = "kernel void neg_f32(\n\tuint length,\n\tglobal float* a,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = -a[id];\n\t}\n}\nkernel void neg_f64(\n\tuint length,\n\tglobal double* a,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = -a[id];\n\t}\n}\nkernel void abs_f32(\n\tuint length,\n\tglobal float* a,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = fabs(a[id]);\n\t}\n}\nkernel void abs_f64(\n\tuint length,\n\tglobal double* a,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = fabs(a[id]);\n\t}\n}\nkernel void exp_f32(\n\tuint length,\n\tglobal float* a,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = exp(a[id]);\n\t}\n}\nkernel void exp_f64(\n\tuint length,\n\tglobal double* a,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = exp(a[id]);\n\t}\n}\nkernel void log_f32(\n\tuint length,\n\tglobal float* a,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = log(a[id]);\n\t}\n}\nkernel void log_f64(\n\tuint length,\n\tglobal double* a,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = log(a[id]);\n\t}\n}\nkernel void sqrt_f32(\n\tuint length,\n\tglobal float* a,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = sqrt(a[id]);\n\t}\n}\nkernel void sqrt_f64(\n\tuint length,\n\tglobal double* a,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = sqrt(a[id]);\n\t}\n}\nkernel void square_f32(\n\tuint length,\n\tglobal float* a,\n\tglobal float* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tconst float aVal = a[id]; \n\t\tout[id] = aVal * aVal;\n\t}\n}\nkernel void square_f64(\n\tuint length,\n\tglobal double* a,\n\tglobal double* out)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tconst double aVal = a[id];\n\t\tout[id] = aVal * aVal;\n\t}\n}\n";
	var reductionKernelsSource = "kernel void sum_f32_gpu(\n\tuint length,\n\tglobal float* a,\n\tlocal float* scratch,\n\tglobal float* out)\n{\n\tconst uint globalSize = get_global_size(0);\n\tuint globalIndex = get_global_id(0);\n\tfloat accumulator = 0.0f;\n\twhile (globalIndex < length) {\n\t\taccumulator += a[globalIndex];\n\t\tglobalIndex += globalSize;\n\t}\n\n\tuint localIndex = get_local_id(0);\n\tscratch[localIndex] = accumulator;\n\tbarrier(CLK_LOCAL_MEM_FENCE);\n\tfor (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {\n\t\tif (localIndex < offset) {\n\t\t\tscratch[localIndex] += scratch[localIndex + offset];\n\t\t}\n\t\tbarrier(CLK_LOCAL_MEM_FENCE);\n\t}\n\tif (localIndex == 0) {\n\t\tout[get_group_id(0)] = scratch[0];\n\t}\n}\n\nkernel void sum_f64_gpu(\n\tuint length,\n\tglobal double* a,\n\tlocal double* scratch,\n\tglobal double* out)\n{\n\tconst uint globalSize = get_global_size(0);\n\tuint globalIndex = get_global_id(0);\n\tdouble accumulator = 0.0;\n\twhile (globalIndex < length) {\n\t\taccumulator += a[globalIndex];\n\t\tglobalIndex += globalSize;\n\t}\n\n\tuint localIndex = get_local_id(0);\n\tscratch[localIndex] = accumulator;\n\tbarrier(CLK_LOCAL_MEM_FENCE);\n\tfor (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {\n\t\tif (localIndex < offset) {\n\t\t\tscratch[localIndex] += scratch[localIndex + offset];\n\t\t}\n\t\tbarrier(CLK_LOCAL_MEM_FENCE);\n\t}\n\tif (localIndex == 0) {\n\t\tout[get_group_id(0)] = scratch[0];\n\t}\n}\n\nkernel void min_f32_gpu(\n\tuint length,\n\tglobal float* a,\n\tlocal float* scratch,\n\tglobal float* out)\n{\n\tconst uint globalSize = get_global_size(0);\n\tuint globalIndex = get_global_id(0);\n\tfloat accumulator = INFINITY;\n\twhile (globalIndex < length) {\n\t\taccumulator = min(accumulator, a[globalIndex]);\n\t\tglobalIndex += globalSize;\n\t}\n\n\tuint localIndex = get_local_id(0);\n\tscratch[localIndex] = accumulator;\n\tbarrier(CLK_LOCAL_MEM_FENCE);\n\tfor (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {\n\t\tif (localIndex < offset) {\n\t\t\tscratch[localIndex] = min(scratch[localIndex], scratch[localIndex + offset]);\n\t\t}\n\t\tbarrier(CLK_LOCAL_MEM_FENCE);\n\t}\n\tif (localIndex == 0) {\n\t\tout[get_group_id(0)] = scratch[0];\n\t}\n}\n\nkernel void min_f64_gpu(\n\tuint length,\n\tglobal double* a,\n\tlocal double* scratch,\n\tglobal double* out)\n{\n\tconst uint globalSize = get_global_size(0);\n\tuint globalIndex = get_global_id(0);\n\tdouble accumulator = INFINITY;\n\twhile (globalIndex < length) {\n\t\taccumulator = min(accumulator, a[globalIndex]);\n\t\tglobalIndex += globalSize;\n\t}\n\n\tuint localIndex = get_local_id(0);\n\tscratch[localIndex] = accumulator;\n\tbarrier(CLK_LOCAL_MEM_FENCE);\n\tfor (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {\n\t\tif (localIndex < offset) {\n\t\t\tscratch[localIndex] = min(scratch[localIndex], scratch[localIndex + offset]);\n\t\t}\n\t\tbarrier(CLK_LOCAL_MEM_FENCE);\n\t}\n\tif (localIndex == 0) {\n\t\tout[get_group_id(0)] = scratch[0];\n\t}\n}\n\nkernel void max_f32_gpu(\n\tuint length,\n\tglobal float* a,\n\tlocal float* scratch,\n\tglobal float* out)\n{\n\tconst uint globalSize = get_global_size(0);\n\tuint globalIndex = get_global_id(0);\n\tfloat accumulator = -INFINITY;\n\twhile (globalIndex < length) {\n\t\taccumulator = max(accumulator, a[globalIndex]);\n\t\tglobalIndex += globalSize;\n\t}\n\n\tuint localIndex = get_local_id(0);\n\tscratch[localIndex] = accumulator;\n\tbarrier(CLK_LOCAL_MEM_FENCE);\n\tfor (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {\n\t\tif (localIndex < offset) {\n\t\t\tscratch[localIndex] = max(scratch[localIndex], scratch[localIndex + offset]);\n\t\t}\n\t\tbarrier(CLK_LOCAL_MEM_FENCE);\n\t}\n\tif (localIndex == 0) {\n\t\tout[get_group_id(0)] = scratch[0];\n\t}\n}\n\nkernel void max_f64_gpu(\n\tuint length,\n\tglobal double* a,\n\tlocal double* scratch,\n\tglobal double* out)\n{\n\tconst uint globalSize = get_global_size(0);\n\tuint globalIndex = get_global_id(0);\n\tdouble accumulator = -INFINITY;\n\twhile (globalIndex < length) {\n\t\taccumulator = max(accumulator, a[globalIndex]);\n\t\tglobalIndex += globalSize;\n\t}\n\n\tuint localIndex = get_local_id(0);\n\tscratch[localIndex] = accumulator;\n\tbarrier(CLK_LOCAL_MEM_FENCE);\n\tfor (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {\n\t\tif (localIndex < offset) {\n\t\t\tscratch[localIndex] = max(scratch[localIndex], scratch[localIndex + offset]);\n\t\t}\n\t\tbarrier(CLK_LOCAL_MEM_FENCE);\n\t}\n\tif (localIndex == 0) {\n\t\tout[get_group_id(0)] = scratch[0];\n\t}\n}\n";
	var axisReductionKernelsSource = "kernel void asum_f32(\n\tuint reductionDim,\n\tglobal float* a,\n\tglobal float* out)\n{\n\tconst uint innerStride = get_global_size(1);\n\tconst uint i = get_global_id(0);\n\tconst uint k = get_global_id(1);\n\ta += i * reductionDim * innerStride + k;\n\tfloat accumulator = *a;\n\twhile (--reductionDim) {\n\t\ta += innerStride;\n\t\taccumulator += *a;\n\t}\n\tout[i * innerStride + k] = accumulator;\n}\n\nkernel void asum_f64(\n\tuint reductionDim,\n\tglobal double* a,\n\tglobal double* out)\n{\n\tconst uint innerStride = get_global_size(1);\n\tconst uint i = get_global_id(0);\n\tconst uint k = get_global_id(1);\n\ta += i * reductionDim * innerStride + k;\n\tdouble accumulator = *a;\n\twhile (--reductionDim) {\n\t\ta += innerStride;\n\t\taccumulator += *a;\n\t}\n\tout[i * innerStride + k] = accumulator;\n}\n\nkernel void amin_f32(\n\tuint reductionDim,\n\tglobal float* a,\n\tglobal float* out)\n{\n\tconst uint innerStride = get_global_size(1);\n\tconst uint i = get_global_id(0);\n\tconst uint k = get_global_id(1);\n\ta += i * reductionDim * innerStride + k;\n\tfloat accumulator = *a;\n\twhile (--reductionDim) {\n\t\ta += innerStride;\n\t\taccumulator = min(accumulator, *a);\n\t}\n\tout[i * innerStride + k] = accumulator;\n}\n\nkernel void amin_f64(\n\tuint reductionDim,\n\tglobal double* a,\n\tglobal double* out)\n{\n\tconst uint innerStride = get_global_size(1);\n\tconst uint i = get_global_id(0);\n\tconst uint k = get_global_id(1);\n\ta += i * reductionDim * innerStride + k;\n\tdouble accumulator = *a;\n\twhile (--reductionDim) {\n\t\ta += innerStride;\n\t\taccumulator = min(accumulator, *a);\n\t}\n\tout[i * innerStride + k] = accumulator;\n}\n\nkernel void amax_f32(\n\tuint reductionDim,\n\tglobal float* a,\n\tglobal float* out)\n{\n\tconst uint innerStride = get_global_size(1);\n\tconst uint i = get_global_id(0);\n\tconst uint k = get_global_id(1);\n\ta += i * reductionDim * innerStride + k;\n\tfloat accumulator = *a;\n\twhile (--reductionDim) {\n\t\ta += innerStride;\n\t\taccumulator = max(accumulator, *a);\n\t}\n\tout[i * innerStride + k] = accumulator;\n}\n\nkernel void amax_f64(\n\tuint reductionDim,\n\tglobal double* a,\n\tglobal double* out)\n{\n\tconst uint innerStride = get_global_size(1);\n\tconst uint i = get_global_id(0);\n\tconst uint k = get_global_id(1);\n\ta += i * reductionDim * innerStride + k;\n\tdouble accumulator = *a;\n\twhile (--reductionDim) {\n\t\ta += innerStride;\n\t\taccumulator = max(accumulator, *a);\n\t}\n\tout[i * innerStride + k] = accumulator;\n}\n";
	var productKernelsSource = "kernel void dot_f32(\n\tuint reductionDim,\n\tglobal float* a,\n\tglobal float* b,\n\tglobal float* out)\n{\n\tconst uint i = get_global_id(0);\n\tconst uint k = get_global_id(1);\n\tconst uint l = get_global_id(2);\n\tconst uint outerStrideB = get_global_size(1);\n\tconst uint innerStrideB = get_global_size(2);\n\n\tfloat accumulator = 0.0f;\n\tfor (uint j = 0; j < reductionDim; ++j) {\n\t\taccumulator += a[i*reductionDim+j] * b[(k*reductionDim+j)*innerStrideB+l];\n\t}\n\tout[(i*outerStrideB + k) * innerStrideB + l] = accumulator;\n}\n\nkernel void dot_f64(\n\tuint reductionDim,\n\tglobal double* a,\n\tglobal double* b,\n\tglobal double* out)\n{\n\tconst uint i = get_global_id(0);\n\tconst uint k = get_global_id(1);\n\tconst uint l = get_global_id(2);\n\tconst uint outerStrideB = get_global_size(1);\n\tconst uint innerStrideB = get_global_size(2);\n\n\tdouble accumulator = 0.0;\n\tfor (uint j = 0; j < reductionDim; ++j) {\n\t\taccumulator += a[i*reductionDim+j] * b[(k*reductionDim+j)*innerStrideB+l];\n\t}\n\tout[(i*outerStrideB + k) * innerStrideB + l] = accumulator;\n}\n";
	var utilKernelsSource = "kernel void set_f32(\n\tuint length,\n\tglobal float* out,\n\tfloat value)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = value;\n\t}\n}\nkernel void set_f64(\n\tuint length,\n\tglobal double* out,\n\tdouble value)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = value;\n\t}\n}\n\nkernel void linspace_f32(\n\tuint length,\n\tglobal float* out,\n\tfloat start,\n\tfloat step)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = start + step * ((float) id);\n\t}\n}\nkernel void linspace_f64(\n\tuint length,\n\tglobal double* out,\n\tdouble start,\n\tdouble step)\n{\n\tconst uint id = get_global_id(0);\n\tif (id < length) {\n\t\tout[id] = start + step * ((double) id);\n\t}\n}\n\nkernel void repeat_f32(\n\tuint expansionDim,\n\tuint innerStride,\n\tuint repeats,\n\tglobal float *restrict a,\n\tglobal float *restrict out)\n{\n\tconst uint i = get_global_id(0);\n\tconst uint j = get_global_id(1);\n\tconst uint k = get_global_id(2);\n\tconst float value = a[(i * expansionDim + j) * innerStride + k];\n\tuint offsetOut = (i * expansionDim + j) * repeats * innerStride + k;\n\tfor (uint c = 0; c < repeats; ++c) {\n\t\tout[offsetOut] = value;\n\t\toffsetOut += innerStride;\n\t}\n}\nkernel void repeat_f64(\n\tuint expansionDim,\n\tuint innerStride,\n\tuint repeats,\n\tglobal double *restrict a,\n\tglobal double *restrict out)\n{\n\tconst uint i = get_global_id(0);\n\tconst uint j = get_global_id(1);\n\tconst uint k = get_global_id(2);\n\tconst double value = a[(i * expansionDim + j) * innerStride + k];\n\tuint offsetOut = (i * expansionDim + j) * repeats * innerStride + k;\n\tfor (uint c = 0; c < repeats; ++c) {\n\t\tout[offsetOut] = value;\n\t\toffsetOut += innerStride;\n\t}\n}\n";
	var source = binaryKernelsSource + unaryKernelsSource + 
		reductionKernelsSource + axisReductionKernelsSource + 
		productKernelsSource + utilKernelsSource;

	var asyncCallbacks = options.asyncCallbacks;
	if (typeof asyncCallbacks === "undefined") {
		/* Currently only Node-WebCL supports asynchronous callbacks */
		this.asyncCallbacks = isNodeWebCL;
	} else {
		this.asyncCallbacks = !!asyncCallbacks;
	}
	var deviceName = options.device;
	if (deviceName) {
		var deviceIndex = availableDevicesDescriptions.indexOf(deviceName);
		if (deviceIndex === -1) {
			throw new Error("Invalid WebCL device name: " + deviceName);
		}
		this.device = availableDevices[deviceIndex];
	} else {
		var deviceIndex = getDefaultDeviceIndex();
		if (deviceIndex < 0) {
			throw new Error("No suitable WebCL device found");
		}
		this.device = availableDevices[deviceIndex];
	}
	this.device.enableExtension("KHR_fp64");
	this.deviceInfo = {
		deviceClass: classifyDevice(this.device),
		localMemorySize: this.device.getInfo(cl.DEVICE_LOCAL_MEM_SIZE),
		maxComputeUnits: this.device.getInfo(cl.DEVICE_MAX_COMPUTE_UNITS),
		maxWorkGroupSize: this.device.getInfo(cl.DEVICE_MAX_WORK_GROUP_SIZE),
		maxWorkItemSizes: this.device.getInfo(cl.DEVICE_MAX_WORK_ITEM_SIZES)
	};
	this.context = cl.createContext(this.device);
	this.queue = this.context.createCommandQueue(this.device);
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

/**
 * Returns the names of devices that can be used for computation.
 * Any of these names can be passed as a "device" option when creating a WebCL context.
 *
 * @static
 * @method getAvailableDevices
 * @return {String[]} - a possibly empty list of available device names.
 */
WebCLContext.getAvailableDevices = function() {
	if (WebCLContext.isUsable()) {
		return availableDevicesDescriptions;
	} else {
		return [];
	}
};

/**
 * Returns the name of the default device used for computation.
 *
 * @static
 * @method getDefaultDevice
 * @return {String} - the name of the default WebCL device or null if no suitable device available.
 */
WebCLContext.getDefaultDevice = function() {
	var deviceIndex = getDefaultDeviceIndex();
	if (deviceIndex < 0) {
		return null;
	} else {
		return availableDevicesDescriptions[deviceIndex];
	}
};

/**
 * Checks if WebCL is supported by the environment.
 *
 * @static
 * @method isSupported
 * @return {Boolean} - true if WebCL is supported on this system and false otherwise.
 */
WebCLContext.isSupported = function() {
	return initWebCL() !== null;
};

/**
 * Checks if WebCL can be used for computation.
 * WebCL is usable for computations if it is supported by JS engine (or Node.js) and there is at least one CPU or GPU device with KHR_fp64 extension.
 *
 * @static
 * @method isUsable
 * @return {Boolean} - true if WebCL is usable on this system and false otherwise.
 */
WebCLContext.isUsable = function() {
	var webcl = initWebCL();
	if (webcl === null) {
		return false;
	}
	var availableDevices = getAvailableDevices();
	return availableDevices.length !== 0;
};

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
	this.queue.enqueueNDRangeKernel(kernel, 1, [0], [array.length], null);
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
	this.queue.enqueueNDRangeKernel(kernel, 1, [0], [array.length], null);
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
	var array = new NDArray([samples], dataType, this);
	array._buffer = this.context.createBuffer(cl.MEM_READ_WRITE, samples * dataType.size);

	var range = stop - start;
	var n = (closed) ? samples - 1 : samples;
	var step = range / n;

	var kernel = this.kernels.linspace[dataType.type];
	kernel.setArg(0, new Uint32Array([array.length]));
	kernel.setArg(1, array._buffer);
	kernel.setArg(2, new dataType.arrayType([start]));
	kernel.setArg(3, new dataType.arrayType([step]));
	this.queue.enqueueNDRangeKernel(kernel, 1, [0], [array.length], null);

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

WebCLContext.prototype.fetch = function() {
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
	if (this.asyncCallbacks) {
		var asyncEvents = [];
		for (var i = 0; i < callbackWaitArguments; i++) {
			var array = arguments[i];
			(function(queue, i, shape, ArrayType) {
				var buffer = new ArrayType(array.length);
				var readFinishEvent = createEvent();
				asyncEvents.push(readFinishEvent);
				queue.enqueueReadBuffer(array._buffer, false, 0, buffer.byteLength, buffer, null, readFinishEvent);
				readFinishEvent.setCallback(cl.COMPLETE, function() {
					readFinishEvent.release();
					callbackArguments[i] = buffer;
					if (--callbackWaitArguments === 0) {
						callback.apply(null, callbackArguments);
						/* OpenCL standard: commands enqueued in a callback won't start until clFlush */
						queue.flush();
					}
				});
			})(this.queue, i, array.shape, array.dataType.arrayType);
			/* This line mostly serializes execution. Unfortunately, without it nothing works */
			cl.waitForEvents(asyncEvents);
		}
	} else {
		for (var i = 0; i < callbackWaitArguments; i++) {
			var array = arguments[i];
			var buffer = new array.dataType.arrayType(array.length);
			this.queue.enqueueReadBuffer(array._buffer, true, 0, buffer.byteLength, buffer);
			callbackArguments[i] = buffer;
		}
		callback.apply(null, callbackArguments);
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
	if (this.asyncCallbacks) {
		var asyncEvents = [];
		for (var i = 0; i < callbackWaitArguments; i++) {
			var array = arguments[i];
			(function(queue, i, shape, ArrayType) {
				var buffer = new ArrayType(array.length);
				var readFinishEvent = createEvent();
				asyncEvents.push(readFinishEvent);
				queue.enqueueReadBuffer(array._buffer, false, 0, buffer.byteLength, buffer, null, readFinishEvent);
				if (shape.length === 0) {
					readFinishEvent.setCallback(cl.COMPLETE, function() {
						readFinishEvent.release();
						callbackArguments[i] = buffer[0];
						if (--callbackWaitArguments === 0) {
							callback.apply(null, callbackArguments);
							/* OpenCL standard: commands enqueued in a callback won't start until clFlush */
							queue.flush();
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
							/* OpenCL standard: commands enqueued in a callback won't start until clFlush */
							queue.flush();
						}
					});
				}
			})(this.queue, i, array.shape, array.dataType.arrayType);
			/* This line mostly serializes execution. Unfortunately, without it nothing works */
			cl.waitForEvents(asyncEvents);
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

WebCLContext.prototype.barrier = function(callback) {
	var barrierEvent = createEvent();
	this.queue.enqueueMarker(barrierEvent);
	if (this.asyncCallbacks) {
		var queue = this.queue;
		barrierEvent.setCallback(cl.COMPLETE, function() {
			barrierEvent.release();
			callback();
			/* OpenCL standard: commands enqueued in a callback won't start until clFlush */
			queue.flush();
		});
		cl.waitForEvents([barrierEvent]);
	} else {
		cl.waitForEvents([barrierEvent]);
		callback();
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
			out._buffer = this.context.createBuffer(cl.MEM_READ_WRITE, out.length * out.dataType.size);
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
		this.queue.enqueueNDRangeKernel(kernel, 3, [0, 0, 0], [outerStride, expansionDim, innerStride], null);
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
				furiousContext.queue.enqueueNDRangeKernel(kernel, 1, [0], [out.length], null);
			} else {
				var kernel = binaryConstOpKernels[dataTypeOut.type];
				kernel.setArg(0, new Uint32Array([out.length]));
				kernel.setArg(1, bufferA);
				kernel.setArg(2, new dataTypeOut.arrayType([b]));
				kernel.setArg(3, out._buffer);
				furiousContext.queue.enqueueNDRangeKernel(kernel, 1, [0], [out.length], null);
			}
		} else {
			var kernel = binaryRevConstKernels[dataTypeOut.type];
			kernel.setArg(0, new Uint32Array([out.length]));
			kernel.setArg(1, bufferB);
			kernel.setArg(2, new dataTypeOut.arrayType([a]));
			kernel.setArg(3, out._buffer);
			furiousContext.queue.enqueueNDRangeKernel(kernel, 1, [0], [out.length], null);
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
		furiousContext.queue.enqueueNDRangeKernel(kernel, 1, [0], [out.length], null);
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
			furiousContext.queue.enqueueNDRangeKernel(kernel, 1, [0], [maxWorkItemsPerCU], [maxWorkItemsPerCU], null);
		} else {
			/* Two-step reduction */
			var maxComputeUnits = furiousContext.deviceInfo.maxComputeUnits;
			var workGroupSizeMultiple = kernel.getWorkGroupInfo(furiousContext.device, cl.KERNEL_PREFERRED_WORK_GROUP_SIZE_MULTIPLE);
			var tempBuffer = furiousContext.context.createBuffer(cl.MEM_READ_WRITE, maxComputeUnits * a.dataType.size);

			kernel.setArg(0, new Uint32Array([lengthA]));
			kernel.setArg(1, a._buffer);
			kernel.setArg(2, new Uint32Array([maxWorkItemsPerCU * a.dataType.size]));
			kernel.setArg(3, tempBuffer);
			furiousContext.queue.enqueueNDRangeKernel(kernel, 1, [0],
				[maxWorkItemsPerCU * maxComputeUnits],
				[maxWorkItemsPerCU]);

			var workGroupSize = Math.min(maxWorkItemsPerCU,
				util.roundUp(maxComputeUnits, workGroupSizeMultiple));
			kernel.setArg(0, new Uint32Array([maxComputeUnits]));
			kernel.setArg(1, tempBuffer);
			kernel.setArg(2, new Uint32Array([workGroupSize * a.dataType.size]));
			kernel.setArg(3, out._buffer);
			/* Important: use only one work group */
			furiousContext.queue.enqueueNDRangeKernel(kernel, 1, [0],
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
			out = new NDArray(shapeOut, a.dataType, furiousContext);
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
		furiousContext.queue.enqueueNDRangeKernel(kernel, 2, [0, 0],
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

WebCLContext.prototype.dot = function(a, b, out) {
	util.checkNDArray(a, "a");
	util.checkNDArray(b, "b");
	util.checkDataTypesCompatibility(a.dataType, b.dataType);

	/* The axis of b used in reduction: axis 0 for 1D array, second-to-last axis for ND array */
	var aAxis = Math.max(a.shape.length - 1, 0);
	var bAxis = Math.max(b.shape.length - 2, 0);
	var reductionDim = a.shape[aAxis];
	if (reductionDim !== b.shape[bAxis]) {
		throw new RangeError("Arrays have incompatible reduction dimensions");
	}
	var shapeOut = [], strideA = 1, outerStrideB = 1, innerStrideB = 1;
	for (var i = 0; i < aAxis; i++) {
		shapeOut.push(a.shape[i]);
		strideA *= a.shape[i];
	}
	for (var i = 0; i < b.shape.length; i++) {
		var dim = b.shape[i];
		if (i < bAxis) {
			outerStrideB *= dim;
			shapeOut.push(dim);
		} else if (i > bAxis) {
			innerStrideB *= dim;
			shapeOut.push(dim);
		}
	}
	if (typeof out === "undefined") {
		out = this.empty(shapeOut, a.dataType);
	} else if (out instanceof NDArray) {
		util.checkNDArray(out, "out");
		util.checkShapesCompatibility(out.shape, shapeOut);
		util.checkDataTypesCompatibility(out.dataType, a.dataType);
		util.checkDifferentNDArrays(a, out, "a", "out");
		util.checkDifferentNDArrays(b, out, "b", "out");
		out._incRef();
	}
	var kernel = this.kernels.dot[out.dataType.type];
	kernel.setArg(0, new Uint32Array([reductionDim]));
	kernel.setArg(1, a._buffer);
	kernel.setArg(2, b._buffer);
	kernel.setArg(3, out._buffer);
	this.queue.enqueueNDRangeKernel(kernel, 3, [0, 0, 0],
		[strideA, outerStrideB, innerStrideB], null);
	a._tryRelease();
	b._tryRelease();
	return out;
};

module.exports = WebCLContext;

},{"../DataType":1,"../NDArray":2,"../util":12}],14:[function(_dereq_,module,exports){

},{}],15:[function(_dereq_,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,_dereq_("JkpR2F"))
},{"JkpR2F":16}],16:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],17:[function(_dereq_,module,exports){
/*
 Copyright 2013 Daniel Wirtz <dcode@dcode.io>

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 * @license ProtoBuf.js (c) 2013 Daniel Wirtz <dcode@dcode.io>
 * Released under the Apache License, Version 2.0
 * see: https://github.com/dcodeIO/ProtoBuf.js for details
 */
(function(global) {
    "use strict";

    function init(ByteBuffer) {

        /**
         * The ProtoBuf namespace.
         * @exports ProtoBuf
         * @namespace
         * @expose
         */
        var ProtoBuf = {};

        /**
         * ProtoBuf.js version.
         * @type {string}
         * @const
         * @expose
         */
        ProtoBuf.VERSION = "3.2.2";

        /**
         * Wire types.
         * @type {Object.<string,number>}
         * @const
         * @expose
         */
        ProtoBuf.WIRE_TYPES = {};

        /**
         * Varint wire type.
         * @type {number}
         * @expose
         */
        ProtoBuf.WIRE_TYPES.VARINT = 0;

        /**
         * Fixed 64 bits wire type.
         * @type {number}
         * @const
         * @expose
         */
        ProtoBuf.WIRE_TYPES.BITS64 = 1;

        /**
         * Length delimited wire type.
         * @type {number}
         * @const
         * @expose
         */
        ProtoBuf.WIRE_TYPES.LDELIM = 2;

        /**
         * Start group wire type.
         * @type {number}
         * @const
         * @expose
         */
        ProtoBuf.WIRE_TYPES.STARTGROUP = 3;

        /**
         * End group wire type.
         * @type {number}
         * @const
         * @expose
         */
        ProtoBuf.WIRE_TYPES.ENDGROUP = 4;

        /**
         * Fixed 32 bits wire type.
         * @type {number}
         * @const
         * @expose
         */
        ProtoBuf.WIRE_TYPES.BITS32 = 5;

        /**
         * Packable wire types.
         * @type {!Array.<number>}
         * @const
         * @expose
         */
        ProtoBuf.PACKABLE_WIRE_TYPES = [
            ProtoBuf.WIRE_TYPES.VARINT,
            ProtoBuf.WIRE_TYPES.BITS64,
            ProtoBuf.WIRE_TYPES.BITS32
        ];

        /**
         * Types.
         * @dict
         * @type {Object.<string,{name: string, wireType: number}>}
         * @const
         * @expose
         */
        ProtoBuf.TYPES = {
            // According to the protobuf spec.
            "int32": {
                name: "int32",
                wireType: ProtoBuf.WIRE_TYPES.VARINT
            },
            "uint32": {
                name: "uint32",
                wireType: ProtoBuf.WIRE_TYPES.VARINT
            },
            "sint32": {
                name: "sint32",
                wireType: ProtoBuf.WIRE_TYPES.VARINT
            },
            "int64": {
                name: "int64",
                wireType: ProtoBuf.WIRE_TYPES.VARINT
            },
            "uint64": {
                name: "uint64",
                wireType: ProtoBuf.WIRE_TYPES.VARINT
            },
            "sint64": {
                name: "sint64",
                wireType: ProtoBuf.WIRE_TYPES.VARINT
            },
            "bool": {
                name: "bool",
                wireType: ProtoBuf.WIRE_TYPES.VARINT
            },
            "double": {
                name: "double",
                wireType: ProtoBuf.WIRE_TYPES.BITS64
            },
            "string": {
                name: "string",
                wireType: ProtoBuf.WIRE_TYPES.LDELIM
            },
            "bytes": {
                name: "bytes",
                wireType: ProtoBuf.WIRE_TYPES.LDELIM
            },
            "fixed32": {
                name: "fixed32",
                wireType: ProtoBuf.WIRE_TYPES.BITS32
            },
            "sfixed32": {
                name: "sfixed32",
                wireType: ProtoBuf.WIRE_TYPES.BITS32
            },
            "fixed64": {
                name: "fixed64",
                wireType: ProtoBuf.WIRE_TYPES.BITS64
            },
            "sfixed64": {
                name: "sfixed64",
                wireType: ProtoBuf.WIRE_TYPES.BITS64
            },
            "float": {
                name: "float",
                wireType: ProtoBuf.WIRE_TYPES.BITS32
            },
            "enum": {
                name: "enum",
                wireType: ProtoBuf.WIRE_TYPES.VARINT
            },
            "message": {
                name: "message",
                wireType: ProtoBuf.WIRE_TYPES.LDELIM
            },
            "group": {
                name: "group",
                wireType: ProtoBuf.WIRE_TYPES.STARTGROUP
            }
        };

        /**
         * Minimum field id.
         * @type {number}
         * @const
         * @expose
         */
        ProtoBuf.ID_MIN = 1;

        /**
         * Maximum field id.
         * @type {number}
         * @const
         * @expose
         */
        ProtoBuf.ID_MAX = 0x1FFFFFFF;

        /**
         * @type {!function(new: ByteBuffer, ...[*])}
         * @expose
         */
        ProtoBuf.ByteBuffer = ByteBuffer;

        /**
         * @type {?function(new: Long, ...[*])}
         * @expose
         */
        ProtoBuf.Long = ByteBuffer.Long || null;

        /**
         * If set to `true`, field names will be converted from underscore notation to camel case. Defaults to `false`.
         *  Must be set prior to parsing.
         * @type {boolean}
         * @expose
         */
        ProtoBuf.convertFieldsToCamelCase = false;

        /**
         * @alias ProtoBuf.Util
         * @expose
         */
        ProtoBuf.Util = (function() {
            "use strict";

            // Object.create polyfill
            // ref: https://developer.mozilla.org/de/docs/JavaScript/Reference/Global_Objects/Object/create
            if (!Object.create)
                /** @expose */
                Object.create = function (o) {
                    if (arguments.length > 1)
                        throw Error('Object.create polyfill only accepts the first parameter.');
                    function F() {}
                    F.prototype = o;
                    return new F();
                };

            /**
             * ProtoBuf utilities.
             * @exports ProtoBuf.Util
             * @namespace
             */
            var Util = {};

            /**
             * Flag if running in node (fs is available) or not.
             * @type {boolean}
             * @const
             * @expose
             */
            Util.IS_NODE = false;
            try {
                // There is no reliable way to detect node.js as an environment, so our
                // best bet is to feature-detect what we actually need.
                Util.IS_NODE =
                    typeof _dereq_ === 'function' &&
                    typeof _dereq_("fs").readFileSync === 'function' &&
                    typeof _dereq_("path").resolve === 'function';
            } catch (e) {}

            /**
             * Constructs a XMLHttpRequest object.
             * @return {XMLHttpRequest}
             * @throws {Error} If XMLHttpRequest is not supported
             * @expose
             */
            Util.XHR = function() {
                // No dependencies please, ref: http://www.quirksmode.org/js/xmlhttp.html
                var XMLHttpFactories = [
                    function () {return new XMLHttpRequest()},
                    function () {return new ActiveXObject("Msxml2.XMLHTTP")},
                    function () {return new ActiveXObject("Msxml3.XMLHTTP")},
                    function () {return new ActiveXObject("Microsoft.XMLHTTP")}
                ];
                /** @type {?XMLHttpRequest} */
                var xhr = null;
                for (var i=0;i<XMLHttpFactories.length;i++) {
                    try { xhr = XMLHttpFactories[i](); }
                    catch (e) { continue; }
                    break;
                }
                if (!xhr)
                    throw Error("XMLHttpRequest is not supported");
                return xhr;
            };

            /**
             * Fetches a resource.
             * @param {string} path Resource path
             * @param {function(?string)=} callback Callback receiving the resource's contents. If omitted the resource will
             *   be fetched synchronously. If the request failed, contents will be null.
             * @return {?string|undefined} Resource contents if callback is omitted (null if the request failed), else undefined.
             * @expose
             */
            Util.fetch = function(path, callback) {
                if (callback && typeof callback != 'function')
                    callback = null;
                if (Util.IS_NODE) {
                    if (callback) {
                        _dereq_("fs").readFile(path, function(err, data) {
                            if (err)
                                callback(null);
                            else
                                callback(""+data);
                        });
                    } else
                        try {
                            return _dereq_("fs").readFileSync(path);
                        } catch (e) {
                            return null;
                        }
                } else {
                    var xhr = Util.XHR();
                    xhr.open('GET', path, callback ? true : false);
                    // xhr.setRequestHeader('User-Agent', 'XMLHTTP/1.0');
                    xhr.setRequestHeader('Accept', 'text/plain');
                    if (typeof xhr.overrideMimeType === 'function') xhr.overrideMimeType('text/plain');
                    if (callback) {
                        xhr.onreadystatechange = function() {
                            if (xhr.readyState != 4) return;
                            if (/* remote */ xhr.status == 200 || /* local */ (xhr.status == 0 && typeof xhr.responseText === 'string'))
                                callback(xhr.responseText);
                            else
                                callback(null);
                        };
                        if (xhr.readyState == 4)
                            return;
                        xhr.send(null);
                    } else {
                        xhr.send(null);
                        if (/* remote */ xhr.status == 200 || /* local */ (xhr.status == 0 && typeof xhr.responseText === 'string'))
                            return xhr.responseText;
                        return null;
                    }
                }
            };

            /**
             * Tests if an object is an array.
             * @function
             * @param {*} obj Object to test
             * @returns {boolean} true if it is an array, else false
             * @expose
             */
            Util.isArray = Array.isArray || function(obj) {
                return Object.prototype.toString.call(obj) === "[object Array]";
            };

            return Util;
        })();

        /**
         * Language expressions.
         * @exports ProtoBuf.Lang
         * @type {Object.<string,string|RegExp>}
         * @namespace
         * @expose
         */
        ProtoBuf.Lang = {
            OPEN: "{",
            CLOSE: "}",
            OPTOPEN: "[",
            OPTCLOSE: "]",
            OPTEND: ",",
            EQUAL: "=",
            END: ";",
            STRINGOPEN: '"',
            STRINGCLOSE: '"',
            STRINGOPEN_SQ: "'",
            STRINGCLOSE_SQ: "'",
            COPTOPEN: '(',
            COPTCLOSE: ')',
            DELIM: /[\s\{\}=;\[\],'"\(\)]/g,
            // KEYWORD: /^(?:package|option|import|message|enum|extend|service|syntax|extensions|group)$/,
            RULE: /^(?:required|optional|repeated)$/,
            TYPE: /^(?:double|float|int32|uint32|sint32|int64|uint64|sint64|fixed32|sfixed32|fixed64|sfixed64|bool|string|bytes)$/,
            NAME: /^[a-zA-Z_][a-zA-Z_0-9]*$/,
            TYPEDEF: /^[a-zA-Z][a-zA-Z_0-9]*$/,
            TYPEREF: /^(?:\.?[a-zA-Z_][a-zA-Z_0-9]*)+$/,
            FQTYPEREF: /^(?:\.[a-zA-Z][a-zA-Z_0-9]*)+$/,
            NUMBER: /^-?(?:[1-9][0-9]*|0|0x[0-9a-fA-F]+|0[0-7]+|([0-9]*\.[0-9]+([Ee][+-]?[0-9]+)?))$/,
            NUMBER_DEC: /^(?:[1-9][0-9]*|0)$/,
            NUMBER_HEX: /^0x[0-9a-fA-F]+$/,
            NUMBER_OCT: /^0[0-7]+$/,
            NUMBER_FLT: /^[0-9]*\.[0-9]+([Ee][+-]?[0-9]+)?$/,
            ID: /^(?:[1-9][0-9]*|0|0x[0-9a-fA-F]+|0[0-7]+)$/,
            NEGID: /^\-?(?:[1-9][0-9]*|0|0x[0-9a-fA-F]+|0[0-7]+)$/,
            WHITESPACE: /\s/,
            STRING: /['"]([^'"\\]*(\\.[^"\\]*)*)['"]/g,
            BOOL: /^(?:true|false)$/i
        };

        /**
         * @alias ProtoBuf.DotProto
         * @expose
         */
        ProtoBuf.DotProto = (function(ProtoBuf, Lang) {
            "use strict";

            /**
             * Utilities to parse .proto files.
             * @exports ProtoBuf.DotProto
             * @namespace
             */
            var DotProto = {};

            /**
             * Constructs a new Tokenizer.
             * @exports ProtoBuf.DotProto.Tokenizer
             * @class proto tokenizer
             * @param {string} proto Proto to tokenize
             * @constructor
             */
            var Tokenizer = function(proto) {

                /**
                 * Source to parse.
                 * @type {string}
                 * @expose
                 */
                this.source = ""+proto; // In case it's a buffer

                /**
                 * Current index.
                 * @type {number}
                 * @expose
                 */
                this.index = 0;

                /**
                 * Current line.
                 * @type {number}
                 * @expose
                 */
                this.line = 1;

                /**
                 * Stacked values.
                 * @type {Array}
                 * @expose
                 */
                this.stack = [];

                /**
                 * Whether currently reading a string or not.
                 * @type {boolean}
                 * @expose
                 */
                this.readingString = false;

                /**
                 * Whatever character ends the string. Either a single or double quote character.
                 * @type {string}
                 * @expose
                 */
                this.stringEndsWith = Lang.STRINGCLOSE;
            };

            /**
             * Reads a string beginning at the current index.
             * @return {string} The string
             * @throws {Error} If it's not a valid string
             * @private
             */
            Tokenizer.prototype._readString = function() {
                Lang.STRING.lastIndex = this.index-1; // Include the open quote
                var match;
                if ((match = Lang.STRING.exec(this.source)) !== null) {
                    var s = match[1];
                    this.index = Lang.STRING.lastIndex;
                    this.stack.push(this.stringEndsWith);
                    return s;
                }
                throw Error("Illegal string value at line "+this.line+", index "+this.index);
            };

            /**
             * Gets the next token and advances by one.
             * @return {?string} Token or `null` on EOF
             * @throws {Error} If it's not a valid proto file
             * @expose
             */
            Tokenizer.prototype.next = function() {
                if (this.stack.length > 0)
                    return this.stack.shift();
                if (this.index >= this.source.length)
                    return null; // No more tokens
                if (this.readingString) {
                    this.readingString = false;
                    return this._readString();
                }
                var repeat, last;
                do {
                    repeat = false;
                    // Strip white spaces
                    while (Lang.WHITESPACE.test(last = this.source.charAt(this.index))) {
                        this.index++;
                        if (last === "\n")
                            this.line++;
                        if (this.index === this.source.length)
                            return null;
                    }
                    // Strip comments
                    if (this.source.charAt(this.index) === '/') {
                        if (this.source.charAt(++this.index) === '/') { // Single line
                            while (this.source.charAt(this.index) !== "\n") {
                                this.index++;
                                if (this.index == this.source.length)
                                    return null;
                            }
                            this.index++;
                            this.line++;
                            repeat = true;
                        } else if (this.source.charAt(this.index) === '*') { /* Block */
                            last = '';
                            while (last+(last=this.source.charAt(this.index)) !== '*/') {
                                this.index++;
                                if (last === "\n")
                                    this.line++;
                                if (this.index === this.source.length)
                                    return null;
                            }
                            this.index++;
                            repeat = true;
                        } else
                            throw Error("Invalid comment at line "+this.line+": /"+this.source.charAt(this.index)+" ('/' or '*' expected)");
                    }
                } while (repeat);
                if (this.index === this.source.length) return null;

                // Read the next token
                var end = this.index;
                Lang.DELIM.lastIndex = 0;
                var delim = Lang.DELIM.test(this.source.charAt(end));
                if (!delim) {
                    ++end;
                    while(end < this.source.length && !Lang.DELIM.test(this.source.charAt(end)))
                        end++;
                } else
                    ++end;
                var token = this.source.substring(this.index, this.index = end);
                if (token === Lang.STRINGOPEN)
                    this.readingString = true,
                    this.stringEndsWith = Lang.STRINGCLOSE;
                else if (token === Lang.STRINGOPEN_SQ)
                    this.readingString = true,
                    this.stringEndsWith = Lang.STRINGCLOSE_SQ;
                return token;
            };

            /**
             * Peeks for the next token.
             * @return {?string} Token or `null` on EOF
             * @throws {Error} If it's not a valid proto file
             * @expose
             */
            Tokenizer.prototype.peek = function() {
                if (this.stack.length === 0) {
                    var token = this.next();
                    if (token === null)
                        return null;
                    this.stack.push(token);
                }
                return this.stack[0];
            };

            /**
             * Returns a string representation of this object.
             * @return {string} String representation as of "Tokenizer(index/length)"
             * @expose
             */
            Tokenizer.prototype.toString = function() {
                return "Tokenizer("+this.index+"/"+this.source.length+" at line "+this.line+")";
            };

            /**
             * @alias ProtoBuf.DotProto.Tokenizer
             * @expose
             */
            DotProto.Tokenizer = Tokenizer;

            /**
             * Constructs a new Parser.
             * @exports ProtoBuf.DotProto.Parser
             * @class proto parser
             * @param {string} proto Protocol source
             * @constructor
             */
            var Parser = function(proto) {

                /**
                 * Tokenizer.
                 * @type {ProtoBuf.DotProto.Tokenizer}
                 * @expose
                 */
                this.tn = new Tokenizer(proto);
            };

            /**
             * Runs the parser.
             * @return {{package: string|null, messages: Array.<object>, enums: Array.<object>, imports: Array.<string>, options: object<string,*>}}
             * @throws {Error} If the source cannot be parsed
             * @expose
             */
            Parser.prototype.parse = function() {
                var topLevel = {
                    "name": "[ROOT]", // temporary
                    "package": null,
                    "messages": [],
                    "enums": [],
                    "imports": [],
                    "options": {},
                    "services": []
                };
                var token, header = true;
                while(token = this.tn.next()) {
                    switch (token) {
                        case 'package':
                            if (!header || topLevel["package"] !== null)
                                throw Error("Illegal package at line "+this.tn.line);
                            topLevel["package"] = this._parsePackage(token);
                            break;
                        case 'import':
                            if (!header)
                                throw Error("Illegal import at line "+this.tn.line);
                            topLevel.imports.push(this._parseImport(token));
                            break;
                        case 'message':
                            this._parseMessage(topLevel, null, token);
                            header = false;
                            break;
                        case 'enum':
                            this._parseEnum(topLevel, token);
                            header = false;
                            break;
                        case 'option':
                            if (!header)
                                throw Error("Illegal option at line "+this.tn.line);
                            this._parseOption(topLevel, token);
                            break;
                        case 'service':
                            this._parseService(topLevel, token);
                            break;
                        case 'extend':
                            this._parseExtend(topLevel, token);
                            break;
                        case 'syntax':
                            this._parseIgnoredStatement(topLevel, token);
                            break;
                        default:
                            throw Error("Illegal token at line "+this.tn.line+": "+token);
                    }
                }
                delete topLevel["name"];
                return topLevel;
            };

            /**
             * Parses a number value.
             * @param {string} val Number value to parse
             * @return {number} Number
             * @throws {Error} If the number value is invalid
             * @private
             */
            Parser.prototype._parseNumber = function(val) {
                var sign = 1;
                if (val.charAt(0) == '-')
                    sign = -1,
                    val = val.substring(1);
                if (Lang.NUMBER_DEC.test(val))
                    return sign*parseInt(val, 10);
                else if (Lang.NUMBER_HEX.test(val))
                    return sign*parseInt(val.substring(2), 16);
                else if (Lang.NUMBER_OCT.test(val))
                    return sign*parseInt(val.substring(1), 8);
                else if (Lang.NUMBER_FLT.test(val))
                    return sign*parseFloat(val);
                throw Error("Illegal number at line "+this.tn.line+": "+(sign < 0 ? '-' : '')+val);
            };

            /**
             * Parses an ID value.
             * @param {string} val ID value to parse
             * @param {boolean=} neg Whether the ID may be negative, defaults to `false`
             * @returns {number} ID
             * @throws {Error} If the ID value is invalid
             * @private
             */
            Parser.prototype._parseId = function(val, neg) {
                var id = -1;
                var sign = 1;
                if (val.charAt(0) == '-')
                    sign = -1,
                    val = val.substring(1);
                if (Lang.NUMBER_DEC.test(val))
                    id = parseInt(val);
                else if (Lang.NUMBER_HEX.test(val))
                    id = parseInt(val.substring(2), 16);
                else if (Lang.NUMBER_OCT.test(val))
                    id = parseInt(val.substring(1), 8);
                else
                    throw Error("Illegal ID at line "+this.tn.line+": "+(sign < 0 ? '-' : '')+val);
                id = (sign*id)|0; // Force to 32bit
                if (!neg && id < 0)
                    throw Error("Illegal ID at line "+this.tn.line+": "+(sign < 0 ? '-' : '')+val);
                return id;
            };

            /**
             * Parses the package definition.
             * @param {string} token Initial token
             * @return {string} Package name
             * @throws {Error} If the package definition cannot be parsed
             * @private
             */
            Parser.prototype._parsePackage = function(token) {
                token = this.tn.next();
                if (!Lang.TYPEREF.test(token))
                    throw Error("Illegal package at line "+this.tn.line+": "+token);
                var pkg = token;
                token = this.tn.next();
                if (token != Lang.END)
                    throw Error("Illegal end of package at line "+this.tn.line+": "+token+" ('"+Lang.END+"' expected)");
                return pkg;
            };

            /**
             * Parses an import definition.
             * @param {string} token Initial token
             * @return {string} Import file name
             * @throws {Error} If the import definition cannot be parsed
             * @private
             */
            Parser.prototype._parseImport = function(token) {
                token = this.tn.next();
                if (token === "public")
                    token = this.tn.next();
                if (token !== Lang.STRINGOPEN && token !== Lang.STRINGOPEN_SQ)
                    throw Error("Illegal import at line "+this.tn.line+": "+token+" ('"+Lang.STRINGOPEN+"' or '"+Lang.STRINGOPEN_SQ+"' expected)");
                var imported = this.tn.next();
                token = this.tn.next();
                if (token !== this.tn.stringEndsWith)
                    throw Error("Illegal import at line "+this.tn.line+": "+token+" ('"+this.tn.stringEndsWith+"' expected)");
                token = this.tn.next();
                if (token !== Lang.END)
                    throw Error("Illegal import at line "+this.tn.line+": "+token+" ('"+Lang.END+"' expected)");
                return imported;
            };

            /**
             * Parses a namespace option.
             * @param {Object} parent Parent definition
             * @param {string} token Initial token
             * @throws {Error} If the option cannot be parsed
             * @private
             */
            Parser.prototype._parseOption = function(parent, token) {
                token = this.tn.next();
                var custom = false;
                if (token == Lang.COPTOPEN)
                    custom = true,
                    token = this.tn.next();
                if (!Lang.TYPEREF.test(token))
                    // we can allow options of the form google.protobuf.* since they will just get ignored anyways
                    if (!/google\.protobuf\./.test(token))
                        throw Error("Illegal option in message "+parent.name+" at line "+this.tn.line+": "+token);
                var name = token;
                token = this.tn.next();
                if (custom) { // (my_method_option).foo, (my_method_option), some_method_option, (foo.my_option).bar
                    if (token !== Lang.COPTCLOSE)
                        throw Error("Illegal option in message "+parent.name+", option "+name+" at line "+this.tn.line+": "+token+" ('"+Lang.COPTCLOSE+"' expected)");
                    name = '('+name+')';
                    token = this.tn.next();
                    if (Lang.FQTYPEREF.test(token))
                        name += token,
                        token = this.tn.next();
                }
                if (token !== Lang.EQUAL)
                    throw Error("Illegal option operator in message "+parent.name+", option "+name+" at line "+this.tn.line+": "+token+" ('"+Lang.EQUAL+"' expected)");
                var value;
                token = this.tn.next();
                if (token === Lang.STRINGOPEN || token === Lang.STRINGOPEN_SQ) {
                    value = this.tn.next();
                    token = this.tn.next();
                    if (token !== this.tn.stringEndsWith)
                        throw Error("Illegal end of option value in message "+parent.name+", option "+name+" at line "+this.tn.line+": "+token+" ('"+this.tn.stringEndsWith+"' expected)");
                } else {
                    if (Lang.NUMBER.test(token))
                        value = this._parseNumber(token, true);
                    else if (Lang.BOOL.test(token))
                        value = token === 'true';
                    else if (Lang.TYPEREF.test(token))
                        value = token;
                    else
                        throw Error("Illegal option value in message "+parent.name+", option "+name+" at line "+this.tn.line+": "+token);
                }
                token = this.tn.next();
                if (token !== Lang.END)
                    throw Error("Illegal end of option in message "+parent.name+", option "+name+" at line "+this.tn.line+": "+token+" ('"+Lang.END+"' expected)");
                parent["options"][name] = value;
            };

            /**
             * Parses an ignored statement of the form ['keyword', ..., ';'].
             * @param {Object} parent Parent definition
             * @param {string} keyword Initial token
             * @throws {Error} If the directive cannot be parsed
             * @private
             */
            Parser.prototype._parseIgnoredStatement = function(parent, keyword) {
                var token;
                do {
                    token = this.tn.next();
                    if (token === null)
                        throw Error("Unexpected EOF in "+parent.name+", "+keyword+" (ignored) at line "+this.tn.line);
                    if (token === Lang.END)
                        break;
                } while (true);
            };

            /**
             * Parses a service definition.
             * @param {Object} parent Parent definition
             * @param {string} token Initial token
             * @throws {Error} If the service cannot be parsed
             * @private
             */
            Parser.prototype._parseService = function(parent, token) {
                token = this.tn.next();
                if (!Lang.NAME.test(token))
                    throw Error("Illegal service name at line "+this.tn.line+": "+token);
                var name = token;
                var svc = {
                    "name": name,
                    "rpc": {},
                    "options": {}
                };
                token = this.tn.next();
                if (token !== Lang.OPEN)
                    throw Error("Illegal OPEN after service "+name+" at line "+this.tn.line+": "+token+" ('"+Lang.OPEN+"' expected)");
                do {
                    token = this.tn.next();
                    if (token === "option")
                        this._parseOption(svc, token);
                    else if (token === 'rpc')
                        this._parseServiceRPC(svc, token);
                    else if (token !== Lang.CLOSE)
                        throw Error("Illegal type for service "+name+" at line "+this.tn.line+": "+token);
                } while (token !== Lang.CLOSE);
                parent["services"].push(svc);
            };

            /**
             * Parses a RPC service definition of the form ['rpc', name, (request), 'returns', (response)].
             * @param {Object} svc Parent definition
             * @param {string} token Initial token
             * @private
             */
            Parser.prototype._parseServiceRPC = function(svc, token) {
                var type = token;
                token = this.tn.next();
                if (!Lang.NAME.test(token))
                    throw Error("Illegal RPC method name in service "+svc["name"]+" at line "+this.tn.line+": "+token);
                var name = token;
                var method = {
                    "request": null,
                    "response": null,
                    "options": {}
                };
                token = this.tn.next();
                if (token !== Lang.COPTOPEN)
                    throw Error("Illegal start of request type in RPC service "+svc["name"]+"#"+name+" at line "+this.tn.line+": "+token+" ('"+Lang.COPTOPEN+"' expected)");
                token = this.tn.next();
                if (!Lang.TYPEREF.test(token))
                    throw Error("Illegal request type in RPC service "+svc["name"]+"#"+name+" at line "+this.tn.line+": "+token);
                method["request"] = token;
                token = this.tn.next();
                if (token != Lang.COPTCLOSE)
                    throw Error("Illegal end of request type in RPC service "+svc["name"]+"#"+name+" at line "+this.tn.line+": "+token+" ('"+Lang.COPTCLOSE+"' expected)");
                token = this.tn.next();
                if (token.toLowerCase() !== "returns")
                    throw Error("Illegal request/response delimiter in RPC service "+svc["name"]+"#"+name+" at line "+this.tn.line+": "+token+" ('returns' expected)");
                token = this.tn.next();
                if (token != Lang.COPTOPEN)
                    throw Error("Illegal start of response type in RPC service "+svc["name"]+"#"+name+" at line "+this.tn.line+": "+token+" ('"+Lang.COPTOPEN+"' expected)");
                token = this.tn.next();
                method["response"] = token;
                token = this.tn.next();
                if (token !== Lang.COPTCLOSE)
                    throw Error("Illegal end of response type in RPC service "+svc["name"]+"#"+name+" at line "+this.tn.line+": "+token+" ('"+Lang.COPTCLOSE+"' expected)");
                token = this.tn.next();
                if (token === Lang.OPEN) {
                    do {
                        token = this.tn.next();
                        if (token === 'option')
                            this._parseOption(method, token); // <- will fail for the custom-options example
                        else if (token !== Lang.CLOSE)
                            throw Error("Illegal start of option in RPC service "+svc["name"]+"#"+name+" at line "+this.tn.line+": "+token+" ('option' expected)");
                    } while (token !== Lang.CLOSE);
                    if (this.tn.peek() === Lang.END)
                        this.tn.next();
                } else if (token !== Lang.END)
                    throw Error("Illegal method delimiter in RPC service "+svc["name"]+"#"+name+" at line "+this.tn.line+": "+token+" ('"+Lang.END+"' or '"+Lang.OPEN+"' expected)");
                if (typeof svc[type] === 'undefined')
                    svc[type] = {};
                svc[type][name] = method;
            };

            /**
             * Parses a message definition.
             * @param {Object} parent Parent definition
             * @param {Object} fld Field definition if this is a group, otherwise `null`
             * @param {string} token First token
             * @return {Object}
             * @throws {Error} If the message cannot be parsed
             * @private
             */
            Parser.prototype._parseMessage = function(parent, fld, token) {
                /** @dict */
                var msg = {}; // Note: At some point we might want to exclude the parser, so we need a dict.
                var isGroup = token === "group";
                token = this.tn.next();
                if (!Lang.NAME.test(token))
                    throw Error("Illegal "+(isGroup ? "group" : "message")+" name"+(parent ? " in message "+parent["name"] : "")+" at line "+this.tn.line+": "+token);
                msg["name"] = token;
                if (isGroup) {
                    token = this.tn.next();
                    if (token !== Lang.EQUAL)
                        throw Error("Illegal id assignment after group "+msg.name+" at line "+this.tn.line+": "+token+" ('"+Lang.EQUAL+"' expected)");
                    token = this.tn.next();
                    try {
                        fld["id"] = this._parseId(token);
                    } catch (e) {
                        throw Error("Illegal field id value for group "+msg.name+"#"+fld.name+" at line "+this.tn.line+": "+token);
                    }
                    msg["isGroup"] = true;
                }
                msg["fields"] = []; // Note: Using arrays to support also browser that cannot preserve order of object keys.
                msg["enums"] = [];
                msg["messages"] = [];
                msg["options"] = {};
                token = this.tn.next();
                if (token === Lang.OPTOPEN && fld)
                    this._parseFieldOptions(msg, fld, token),
                    token = this.tn.next();
                if (token !== Lang.OPEN)
                    throw Error("Illegal OPEN after "+(isGroup ? "group" : "message")+" "+msg.name+" at line "+this.tn.line+": "+token+" ('"+Lang.OPEN+"' expected)");
                // msg["extensions"] = undefined
                do {
                    token = this.tn.next();
                    if (token === Lang.CLOSE) {
                        token = this.tn.peek();
                        if (token === Lang.END)
                            this.tn.next();
                        break;
                    } else if (Lang.RULE.test(token))
                        this._parseMessageField(msg, token);
                    else if (token === "enum")
                        this._parseEnum(msg, token);
                    else if (token === "message")
                        this._parseMessage(msg, null, token);
                    else if (token === "option")
                        this._parseOption(msg, token);
                    else if (token === "extensions")
                        msg["extensions"] = this._parseExtensions(msg, token);
                    else if (token === "extend")
                        this._parseExtend(msg, token);
                    else
                        throw Error("Illegal token in message "+msg.name+" at line "+this.tn.line+": "+token+" (type or '"+Lang.CLOSE+"' expected)");
                } while (true);
                parent["messages"].push(msg);
                return msg;
            };

            /**
             * Parses a message field.
             * @param {Object} msg Message definition
             * @param {string} token Initial token
             * @throws {Error} If the message field cannot be parsed
             * @private
             */
            Parser.prototype._parseMessageField = function(msg, token) {
                /** @dict */
                var fld = {}, grp = null;
                fld["rule"] = token;
                /** @dict */
                fld["options"] = {};
                token = this.tn.next();
                if (token === "group") {
                    // "A [legacy] group simply combines a nested message type and a field into a single declaration. In your
                    // code, you can treat this message just as if it had a Result type field called result (the latter name is
                    // converted to lower-case so that it does not conflict with the former)."
                    grp = this._parseMessage(msg, fld, token);
                    if (!/^[A-Z]/.test(grp["name"]))
                        throw Error('Group names must start with a capital letter');
                    fld["type"] = grp["name"];
                    fld["name"] = grp["name"].toLowerCase();
                    token = this.tn.peek();
                    if (token === Lang.END)
                        this.tn.next();
                } else {
                    if (!Lang.TYPE.test(token) && !Lang.TYPEREF.test(token))
                        throw Error("Illegal field type in message "+msg.name+" at line "+this.tn.line+": "+token);
                    fld["type"] = token;
                    token = this.tn.next();
                    if (!Lang.NAME.test(token))
                        throw Error("Illegal field name in message "+msg.name+" at line "+this.tn.line+": "+token);
                    fld["name"] = token;
                    token = this.tn.next();
                    if (token !== Lang.EQUAL)
                        throw Error("Illegal field id assignment in message "+msg.name+"#"+fld.name+" at line "+this.tn.line+": "+token+" ('"+Lang.EQUAL+"' expected)");
                    token = this.tn.next();
                    try {
                        fld["id"] = this._parseId(token);
                    } catch (e) {
                        throw Error("Illegal field id value in message "+msg.name+"#"+fld.name+" at line "+this.tn.line+": "+token);
                    }
                    token = this.tn.next();
                    if (token === Lang.OPTOPEN)
                        this._parseFieldOptions(msg, fld, token),
                        token = this.tn.next();
                    if (token !== Lang.END)
                        throw Error("Illegal field delimiter in message "+msg.name+"#"+fld.name+" at line "+this.tn.line+": "+token+" ('"+Lang.END+"' expected)");
                }
                msg["fields"].push(fld);
            };

            /**
             * Parses a set of field option definitions.
             * @param {Object} msg Message definition
             * @param {Object} fld Field definition
             * @param {string} token Initial token
             * @throws {Error} If the message field options cannot be parsed
             * @private
             */
            Parser.prototype._parseFieldOptions = function(msg, fld, token) {
                var first = true;
                do {
                    token = this.tn.next();
                    if (token === Lang.OPTCLOSE)
                        break;
                    else if (token === Lang.OPTEND) {
                        if (first)
                            throw Error("Illegal start of message field options in message "+msg.name+"#"+fld.name+" at line "+this.tn.line+": "+token);
                        token = this.tn.next();
                    }
                    this._parseFieldOption(msg, fld, token);
                    first = false;
                } while (true);
            };

            /**
             * Parses a single field option.
             * @param {Object} msg Message definition
             * @param {Object} fld Field definition
             * @param {string} token Initial token
             * @throws {Error} If the mesage field option cannot be parsed
             * @private
             */
            Parser.prototype._parseFieldOption = function(msg, fld, token) {
                var custom = false;
                if (token === Lang.COPTOPEN)
                    token = this.tn.next(),
                    custom = true;
                if (!Lang.TYPEREF.test(token))
                    throw Error("Illegal field option in message "+msg.name+"#"+fld.name+" at line "+this.tn.line+": "+token);
                var name = token;
                token = this.tn.next();
                if (custom) {
                    if (token !== Lang.COPTCLOSE)
                        throw Error("Illegal custom field option name delimiter in message "+msg.name+"#"+fld.name+" at line "+this.tn.line+": "+token+" (')' expected)");
                    name = '('+name+')';
                    token = this.tn.next();
                    if (Lang.FQTYPEREF.test(token))
                        name += token,
                        token = this.tn.next();
                }
                if (token !== Lang.EQUAL)
                    throw Error("Illegal field option operation in message "+msg.name+"#"+fld.name+" at line "+this.tn.line+": "+token+" ('=' expected)");
                var value;
                token = this.tn.next();
                if (token === Lang.STRINGOPEN || token === Lang.STRINGOPEN_SQ) {
                    value = this.tn.next();
                    token = this.tn.next();
                    if (token != this.tn.stringEndsWith)
                        throw Error("Illegal end of field value in message "+msg.name+"#"+fld.name+", option "+name+" at line "+this.tn.line+": "+token+" ('"+this.tn.stringEndsWith+"' expected)");
                } else if (Lang.NUMBER.test(token, true))
                    value = this._parseNumber(token, true);
                else if (Lang.BOOL.test(token))
                    value = token.toLowerCase() === 'true';
                else if (Lang.TYPEREF.test(token))
                    value = token; // TODO: Resolve?
                else
                    throw Error("Illegal field option value in message "+msg.name+"#"+fld.name+", option "+name+" at line "+this.tn.line+": "+token);
                fld["options"][name] = value;
            };

            /**
             * Parses an enum.
             * @param {Object} msg Message definition
             * @param {string} token Initial token
             * @throws {Error} If the enum cannot be parsed
             * @private
             */
            Parser.prototype._parseEnum = function(msg, token) {
                /** @dict */
                var enm = {};
                token = this.tn.next();
                if (!Lang.NAME.test(token))
                    throw Error("Illegal enum name in message "+msg.name+" at line "+this.tn.line+": "+token);
                enm["name"] = token;
                token = this.tn.next();
                if (token !== Lang.OPEN)
                    throw Error("Illegal OPEN after enum "+enm.name+" at line "+this.tn.line+": "+token);
                enm["values"] = [];
                enm["options"] = {};
                do {
                    token = this.tn.next();
                    if (token === Lang.CLOSE) {
                        token = this.tn.peek();
                        if (token === Lang.END)
                            this.tn.next();
                        break;
                    }
                    if (token == 'option')
                        this._parseOption(enm, token);
                    else {
                        if (!Lang.NAME.test(token))
                            throw Error("Illegal enum value name in enum "+enm.name+" at line "+this.tn.line+": "+token);
                        this._parseEnumValue(enm, token);
                    }
                } while (true);
                msg["enums"].push(enm);
            };

            /**
             * Parses an enum value.
             * @param {Object} enm Enum definition
             * @param {string} token Initial token
             * @throws {Error} If the enum value cannot be parsed
             * @private
             */
            Parser.prototype._parseEnumValue = function(enm, token) {
                /** @dict */
                var val = {};
                val["name"] = token;
                token = this.tn.next();
                if (token !== Lang.EQUAL)
                    throw Error("Illegal enum value operator in enum "+enm.name+" at line "+this.tn.line+": "+token+" ('"+Lang.EQUAL+"' expected)");
                token = this.tn.next();
                try {
                    val["id"] = this._parseId(token, true);
                } catch (e) {
                    throw Error("Illegal enum value id in enum "+enm.name+" at line "+this.tn.line+": "+token);
                }
                enm["values"].push(val);
                token = this.tn.next();
                if (token === Lang.OPTOPEN) {
                    var opt = { 'options' : {} }; // TODO: Actually expose them somehow.
                    this._parseFieldOptions(enm, opt, token);
                    token = this.tn.next();
                }
                if (token !== Lang.END)
                    throw Error("Illegal enum value delimiter in enum "+enm.name+" at line "+this.tn.line+": "+token+" ('"+Lang.END+"' expected)");
            };

            /**
             * Parses an extensions statement.
             * @param {Object} msg Message object
             * @param {string} token Initial token
             * @throws {Error} If the extensions statement cannot be parsed
             * @private
             */
            Parser.prototype._parseExtensions = function(msg, token) {
                /** @type {Array.<number>} */
                var range = [];
                token = this.tn.next();
                if (token === "min") // FIXME: Does the official implementation support this?
                    range.push(ProtoBuf.ID_MIN);
                else if (token === "max")
                    range.push(ProtoBuf.ID_MAX);
                else
                    range.push(this._parseNumber(token));
                token = this.tn.next();
                if (token !== 'to')
                    throw Error("Illegal extensions delimiter in message "+msg.name+" at line "+this.tn.line+" ('to' expected)");
                token = this.tn.next();
                if (token === "min")
                    range.push(ProtoBuf.ID_MIN);
                else if (token === "max")
                    range.push(ProtoBuf.ID_MAX);
                else
                    range.push(this._parseNumber(token));
                token = this.tn.next();
                if (token !== Lang.END)
                    throw Error("Illegal extension delimiter in message "+msg.name+" at line "+this.tn.line+": "+token+" ('"+Lang.END+"' expected)");
                return range;
            };

            /**
             * Parses an extend block.
             * @param {Object} parent Parent object
             * @param {string} token Initial token
             * @throws {Error} If the extend block cannot be parsed
             * @private
             */
            Parser.prototype._parseExtend = function(parent, token) {
                token = this.tn.next();
                if (!Lang.TYPEREF.test(token))
                    throw Error("Illegal extended message name at line "+this.tn.line+": "+token);
                /** @dict */
                var ext = {};
                ext["ref"] = token;
                ext["fields"] = [];
                token = this.tn.next();
                if (token !== Lang.OPEN)
                    throw Error("Illegal OPEN in extend "+ext.name+" at line "+this.tn.line+": "+token+" ('"+Lang.OPEN+"' expected)");
                do {
                    token = this.tn.next();
                    if (token === Lang.CLOSE) {
                        token = this.tn.peek();
                        if (token == Lang.END)
                            this.tn.next();
                        break;
                    } else if (Lang.RULE.test(token))
                        this._parseMessageField(ext, token);
                    else
                        throw Error("Illegal token in extend "+ext.name+" at line "+this.tn.line+": "+token+" (rule or '"+Lang.CLOSE+"' expected)");
                } while (true);
                parent["messages"].push(ext);
                return ext;
            };

            /**
             * Returns a string representation of this object.
             * @returns {string} String representation as of "Parser"
             */
            Parser.prototype.toString = function() {
                return "Parser";
            };

            /**
             * @alias ProtoBuf.DotProto.Parser
             * @expose
             */
            DotProto.Parser = Parser;

            return DotProto;

        })(ProtoBuf, ProtoBuf.Lang);

        /**
         * @alias ProtoBuf.Reflect
         * @expose
         */
        ProtoBuf.Reflect = (function(ProtoBuf) {
            "use strict";

            /**
             * Reflection types.
             * @exports ProtoBuf.Reflect
             * @namespace
             */
            var Reflect = {};

            /**
             * Constructs a Reflect base class.
             * @exports ProtoBuf.Reflect.T
             * @constructor
             * @abstract
             * @param {ProtoBuf.Reflect.T} parent Parent object
             * @param {string} name Object name
             */
            var T = function(parent, name) {

                /**
                 * Parent object.
                 * @type {ProtoBuf.Reflect.T|null}
                 * @expose
                 */
                this.parent = parent;

                /**
                 * Object name in namespace.
                 * @type {string}
                 * @expose
                 */
                this.name = name;

                /**
                 * Fully qualified class name
                 * @type {string}
                 * @expose
                 */
                this.className;
            };

            /**
             * Returns the fully qualified name of this object.
             * @returns {string} Fully qualified name as of ".PATH.TO.THIS"
             * @expose
             */
            T.prototype.fqn = function() {
                var name = this.name,
                    ptr = this;
                do {
                    ptr = ptr.parent;
                    if (ptr == null)
                        break;
                    name = ptr.name+"."+name;
                } while (true);
                return name;
            };

            /**
             * Returns a string representation of this Reflect object (its fully qualified name).
             * @param {boolean=} includeClass Set to true to include the class name. Defaults to false.
             * @return String representation
             * @expose
             */
            T.prototype.toString = function(includeClass) {
                return (includeClass ? this.className + " " : "") + this.fqn();
            };

            /**
             * Builds this type.
             * @throws {Error} If this type cannot be built directly
             * @expose
             */
            T.prototype.build = function() {
                throw Error(this.toString(true)+" cannot be built directly");
            };

            /**
             * @alias ProtoBuf.Reflect.T
             * @expose
             */
            Reflect.T = T;

            /**
             * Constructs a new Namespace.
             * @exports ProtoBuf.Reflect.Namespace
             * @param {ProtoBuf.Reflect.Namespace|null} parent Namespace parent
             * @param {string} name Namespace name
             * @param {Object.<string,*>} options Namespace options
             * @constructor
             * @extends ProtoBuf.Reflect.T
             */
            var Namespace = function(parent, name, options) {
                T.call(this, parent, name);

                /**
                 * @override
                 */
                this.className = "Namespace";

                /**
                 * Children inside the namespace.
                 * @type {Array.<ProtoBuf.Reflect.T>}
                 */
                this.children = [];

                /**
                 * Options.
                 * @type {Object.<string, *>}
                 */
                this.options = options || {};
            };

            // Extends T
            Namespace.prototype = Object.create(T.prototype);

            /**
             * Returns an array of the namespace's children.
             * @param {ProtoBuf.Reflect.T=} type Filter type (returns instances of this type only). Defaults to null (all children).
             * @return {Array.<ProtoBuf.Reflect.T>}
             * @expose
             */
            Namespace.prototype.getChildren = function(type) {
                type = type || null;
                if (type == null)
                    return this.children.slice();
                var children = [];
                for (var i=0, k=this.children.length; i<k; ++i)
                    if (this.children[i] instanceof type)
                        // We also need to distinguish between Field and ExtensionField which is an instance of Field
                        if (type !== Message.Field || !(this.children[i] instanceof Message.ExtensionField))
                            children.push(this.children[i]);
                return children;
            };

            /**
             * Adds a child to the namespace.
             * @param {ProtoBuf.Reflect.T} child Child
             * @throws {Error} If the child cannot be added (duplicate)
             * @expose
             */
            Namespace.prototype.addChild = function(child) {
                var other;
                if (other = this.getChild(child.name)) {
                    // Try to revert camelcase transformation on collision
                    if (other instanceof Message.Field && other.name !== other.originalName && !this.hasChild(other.originalName))
                        other.name = other.originalName; // Revert previous first (effectively keeps both originals)
                    else if (child instanceof Message.Field && child.name !== child.originalName && !this.hasChild(child.originalName))
                        child.name = child.originalName;
                    else
                        throw Error("Duplicate name in namespace "+this.toString(true)+": "+child.name);
                }
                this.children.push(child);
            };

            /**
             * Tests if this namespace has a child with the specified name.
             * @param {string|number} nameOrId Child name or id
             * @returns {boolean} true if there is one, else false
             * @expose
             */
            Namespace.prototype.hasChild = function(nameOrId) {
                return this._indexOf(nameOrId) > -1;
            };

            /**
             * Gets a child by its name.
             * @param {string|number} nameOrId Child name or id
             * @return {?ProtoBuf.Reflect.T} The child or null if not found
             * @expose
             */
            Namespace.prototype.getChild = function(nameOrId) {
                var index = this._indexOf(nameOrId);
                return index > -1 ? this.children[index] : null;
            };

            /**
             * Returns child index by its name or id.
             * @param {string|number} nameOrId Child name or id
             * @return {Number} The child index
             * @private
             */
            Namespace.prototype._indexOf = function(nameOrId) {
                var key = typeof nameOrId === 'number' ? 'id' : 'name';
                for (var i=0; i<this.children.length; i++)
                    if (typeof this.children[i][key] !== 'undefined' && this.children[i][key] == nameOrId)
                        return i;
                return -1;
            };

            /**
             * Resolves a reflect object inside of this namespace.
             * @param {string} qn Qualified name to resolve
             * @param {boolean=} excludeFields Excludes fields, defaults to `false`
             * @return {ProtoBuf.Reflect.Namespace|null} The resolved type or null if not found
             * @expose
             */
            Namespace.prototype.resolve = function(qn, excludeFields) {
                var part = qn.split(".");
                var ptr = this, i=0;
                if (part[i] == "") { // Fully qualified name, e.g. ".My.Message'
                    while (ptr.parent != null)
                        ptr = ptr.parent;
                    i++;
                }
                var child;
                do {
                    do {
                        child = ptr.getChild(part[i]);
                        if (!child || !(child instanceof Reflect.T) || (excludeFields && child instanceof Reflect.Message.Field)) {
                            ptr = null;
                            break;
                        }
                        ptr = child; i++;
                    } while (i < part.length);
                    if (ptr != null)
                        break; // Found
                    // Else search the parent
                    if (this.parent !== null) {
                        return this.parent.resolve(qn, excludeFields);
                    }
                } while (ptr != null);
                return ptr;
            };

            /**
             * Builds the namespace and returns the runtime counterpart.
             * @return {Object.<string,Function|Object>} Runtime namespace
             * @expose
             */
            Namespace.prototype.build = function() {
                /** @dict */
                var ns = {};
                var children = this.getChildren(), child;
                for (var i=0, k=children.length; i<k; ++i) {
                    child = children[i];
                    if (child instanceof Namespace)
                        ns[child.name] = child.build();
                }
                if (Object.defineProperty)
                    Object.defineProperty(ns, "$options", { "value": this.buildOpt() });
                return ns;
            };

            /**
             * Builds the namespace's '$options' property.
             * @return {Object.<string,*>}
             */
            Namespace.prototype.buildOpt = function() {
                var opt = {};
                var keys = Object.keys(this.options);
                for (var i=0; i<keys.length; i++) {
                    var key = keys[i],
                        val = this.options[keys[i]];
                    // TODO: Options are not resolved, yet.
                    // if (val instanceof Namespace) {
                    //     opt[key] = val.build();
                    // } else {
                    opt[key] = val;
                    // }
                }
                return opt;
            };

            /**
             * Gets the value assigned to the option with the specified name.
             * @param {string=} name Returns the option value if specified, otherwise all options are returned.
             * @return {*|Object.<string,*>}null} Option value or NULL if there is no such option
             */
            Namespace.prototype.getOption = function(name) {
                if (typeof name === 'undefined')
                    return this.options;
                return typeof this.options[name] !== 'undefined' ? this.options[name] : null;
            };

            /**
             * @alias ProtoBuf.Reflect.Namespace
             * @expose
             */
            Reflect.Namespace = Namespace;

            /**
             * Constructs a new Message.
             * @exports ProtoBuf.Reflect.Message
             * @param {ProtoBuf.Reflect.Namespace} parent Parent message or namespace
             * @param {string} name Message name
             * @param {Object.<string,*>} options Message options
             * @param {boolean=} isGroup `true` if this is a legacy group
             * @constructor
             * @extends ProtoBuf.Reflect.Namespace
             */
            var Message = function(parent, name, options, isGroup) {
                Namespace.call(this, parent, name, options);

                /**
                 * @override
                 */
                this.className = "Message";

                /**
                 * Extensions range.
                 * @type {!Array.<number>}
                 * @expose
                 */
                this.extensions = [ProtoBuf.ID_MIN, ProtoBuf.ID_MAX];

                /**
                 * Runtime message class.
                 * @type {?function(new:ProtoBuf.Builder.Message)}
                 * @expose
                 */
                this.clazz = null;

                /**
                 * Whether this is a legacy group or not.
                 * @type {boolean}
                 * @expose
                 */
                this.isGroup = !!isGroup;
            };

            // Extends Namespace
            Message.prototype = Object.create(Namespace.prototype);

            /**
             * Builds the message and returns the runtime counterpart, which is a fully functional class.
             * @see ProtoBuf.Builder.Message
             * @param {boolean=} rebuild Whether to rebuild or not, defaults to false
             * @return {ProtoBuf.Reflect.Message} Message class
             * @throws {Error} If the message cannot be built
             * @expose
             */
            Message.prototype.build = function(rebuild) {
                if (this.clazz && !rebuild) return this.clazz;

                // We need to create a prototyped Message class in an isolated scope
                var clazz = (function(ProtoBuf, T) {

                    var fields = T.getChildren(ProtoBuf.Reflect.Message.Field);

                    /**
                     * Constructs a new runtime Message.
                     * @name ProtoBuf.Builder.Message
                     * @class Barebone of all runtime messages.
                     * @param {Object.<string,*>|...[string]} values Preset values
                     * @constructor
                     * @throws {Error} If the message cannot be created
                     */
                    var Message = function(values) {
                        ProtoBuf.Builder.Message.call(this);
                        var i, field;

                        // Create fields on the object itself to allow setting and getting through Message#fieldname
                        for (i=0; i<fields.length; i++) {
                            field = fields[i];
                            this[field.name] = (field.repeated) ? [] : null;
                        }
                        // Set the default values
                        for (i=0; i<fields.length; i++) {
                            field = fields[i];
                            if (typeof field.options['default'] != 'undefined') {
                                try {
                                    this.$set(field.name, field.options['default']); // Should not throw
                                } catch (e) {
                                    throw Error("[INTERNAL] "+e);
                                }
                            }
                        }
                        // Set field values from a values object
                        if (arguments.length == 1 && typeof values == 'object' &&
                            /* not another Message */ typeof values.encode != 'function' &&
                            /* not a repeated field */ !ProtoBuf.Util.isArray(values) &&
                            /* not a ByteBuffer */ !(values instanceof ByteBuffer) &&
                            /* not an ArrayBuffer */ !(values instanceof ArrayBuffer) &&
                            /* not a Long */ !(ProtoBuf.Long && values instanceof ProtoBuf.Long)) {
                            var keys = Object.keys(values);
                            for (i=0; i<keys.length; i++)
                                this.$set(keys[i], values[keys[i]]); // May throw
                            // Else set field values from arguments, in correct order
                        } else
                            for (i=0; i<arguments.length; i++)
                                if (i<fields.length)
                                    this.$set(fields[i].name, arguments[i]); // May throw
                    };

                    // Extends ProtoBuf.Builder.Message
                    Message.prototype = Object.create(ProtoBuf.Builder.Message.prototype);

                    /**
                     * Adds a value to a repeated field.
                     * @name ProtoBuf.Builder.Message#add
                     * @function
                     * @param {string} key Field name
                     * @param {*} value Value to add
                     * @param {boolean=} noAssert Whether to assert the value or not (asserts by default)
                     * @throws {Error} If the value cannot be added
                     * @expose
                     */
                    Message.prototype.add = function(key, value, noAssert) {
                        var field = T.getChild(key);
                        if (!field)
                            throw Error(this+"#"+key+" is undefined");
                        if (!(field instanceof ProtoBuf.Reflect.Message.Field))
                            throw Error(this+"#"+key+" is not a field: "+field.toString(true)); // May throw if it's an enum or embedded message
                        if (!field.repeated)
                            throw Error(this+"#"+key+" is not a repeated field");
                        if (this[field.name] === null)
                            this[field.name] = [];
                        this[field.name].push(noAssert ? value : field.verifyValue(value, true));
                    };

                    /**
                     * Adds a value to a repeated field. This is an alias for {@link ProtoBuf.Builder.Message#add}.
                     * @name ProtoBuf.Builder.Message#$add
                     * @function
                     * @param {string} key Field name
                     * @param {*} value Value to add
                     * @param {boolean=} noAssert Whether to assert the value or not (asserts by default)
                     * @throws {Error} If the value cannot be added
                     * @expose
                     */
                    Message.prototype.$add = Message.prototype.add;

                    /**
                     * Sets a field's value.
                     * @name ProtoBuf.Builder.Message#set
                     * @function
                     * @param {string} key Key
                     * @param {*} value Value to set
                     * @param {boolean=} noAssert Whether to assert the value or not (asserts by default)
                     * @throws {Error} If the value cannot be set
                     * @expose
                     */
                    Message.prototype.set = function(key, value, noAssert) {
                        var field = T.getChild(key);
                        if (!field)
                            throw Error(this+"#"+key+" is not a field: undefined");
                        if (!(field instanceof ProtoBuf.Reflect.Message.Field))
                            throw Error(this+"#"+key+" is not a field: "+field.toString(true));
                        this[field.name] = noAssert ? value : field.verifyValue(value); // May throw
                    };

                    /**
                     * Sets a field's value. This is an alias for [@link ProtoBuf.Builder.Message#set}.
                     * @name ProtoBuf.Builder.Message#$set
                     * @function
                     * @param {string} key Key
                     * @param {*} value Value to set
                     * @param {boolean=} noAssert Whether to assert the value or not (asserts by default)
                     * @throws {Error} If the value cannot be set
                     * @expose
                     */
                    Message.prototype.$set = Message.prototype.set;

                    /**
                     * Gets a field's value.
                     * @name ProtoBuf.Builder.Message#get
                     * @function
                     * @param {string} key Key
                     * @return {*} Value
                     * @throws {Error} If there is no such field
                     * @expose
                     */
                    Message.prototype.get = function(key) {
                        var field = T.getChild(key);
                        if (!field || !(field instanceof ProtoBuf.Reflect.Message.Field))
                            throw Error(this+"#"+key+" is not a field: undefined");
                        if (!(field instanceof ProtoBuf.Reflect.Message.Field))
                            throw Error(this+"#"+key+" is not a field: "+field.toString(true));
                        return this[field.name];
                    };

                    /**
                     * Gets a field's value. This is an alias for {@link ProtoBuf.Builder.Message#$get}.
                     * @name ProtoBuf.Builder.Message#$get
                     * @function
                     * @param {string} key Key
                     * @return {*} Value
                     * @throws {Error} If there is no such field
                     * @expose
                     */
                    Message.prototype.$get = Message.prototype.get;

                    // Getters and setters

                    for (var i=0; i<fields.length; i++) {
                        var field = fields[i];

                        (function(field) {
                            // set/get[SomeValue]
                            var Name = field.originalName.replace(/(_[a-zA-Z])/g, function(match) {
                                return match.toUpperCase().replace('_','');
                            });
                            Name = Name.substring(0,1).toUpperCase()+Name.substring(1);

                            // set/get_[some_value]
                            var name = field.originalName.replace(/([A-Z])/g, function(match) {
                                return "_"+match;
                            });

                            /**
                             * Sets a value. This method is present for each field, but only if there is no name conflict with
                             * another field.
                             * @name ProtoBuf.Builder.Message#set[SomeField]
                             * @function
                             * @param {*} value Value to set
                             * @abstract
                             * @throws {Error} If the value cannot be set
                             */
                            if (!T.hasChild("set"+Name))
                                Message.prototype["set"+Name] = function(value) {
                                    this.$set(field.name, value);
                                };

                            /**
                             * Sets a value. This method is present for each field, but only if there is no name conflict with
                             * another field.
                             * @name ProtoBuf.Builder.Message#set_[some_field]
                             * @function
                             * @param {*} value Value to set
                             * @abstract
                             * @throws {Error} If the value cannot be set
                             */
                            if (!T.hasChild("set_"+name))
                                Message.prototype["set_"+name] = function(value) {
                                    this.$set(field.name, value);
                                };

                            /**
                             * Gets a value. This method is present for each field, but only if there is no name conflict with
                             * another field.
                             * @name ProtoBuf.Builder.Message#get[SomeField]
                             * @function
                             * @abstract
                             * @return {*} The value
                             */
                            if (!T.hasChild("get"+Name))
                                Message.prototype["get"+Name] = function() {
                                    return this.$get(field.name); // Does not throw, field exists
                                }

                            /**
                             * Gets a value. This method is present for each field, but only if there is no name conflict with
                             * another field.
                             * @name ProtoBuf.Builder.Message#get_[some_field]
                             * @function
                             * @return {*} The value
                             * @abstract
                             */
                            if (!T.hasChild("get_"+name))
                                Message.prototype["get_"+name] = function() {
                                    return this.$get(field.name); // Does not throw, field exists
                                };

                        })(field);
                    }

                    // En-/decoding

                    /**
                     * Encodes the message.
                     * @name ProtoBuf.Builder.Message#$encode
                     * @function
                     * @param {(!ByteBuffer|boolean)=} buffer ByteBuffer to encode to. Will create a new one and flip it if omitted.
                     * @return {!ByteBuffer} Encoded message as a ByteBuffer
                     * @throws {Error} If the message cannot be encoded or if required fields are missing. The later still
                     *  returns the encoded ByteBuffer in the `encoded` property on the error.
                     * @expose
                     * @see ProtoBuf.Builder.Message#encode64
                     * @see ProtoBuf.Builder.Message#encodeHex
                     * @see ProtoBuf.Builder.Message#encodeAB
                     */
                    Message.prototype.encode = function(buffer) {
                        var isNew = false;
                        if (!buffer)
                            buffer = new ByteBuffer(), isNew = true;
                        var le = buffer.littleEndian;
                        try {
                            T.encode(this, buffer.LE());
                            return (isNew ? buffer.flip() : buffer).LE(le);
                        } catch (e) {
                            buffer.LE(le);
                            throw(e);
                        }
                    };

                    /**
                     * Calculates the byte length of the message.
                     * @name ProtoBuf.Builder.Message#calculate
                     * @function
                     * @returns {number} Byte length
                     * @throws {Error} If the message cannot be calculated or if required fields are missing.
                     * @expose
                     */
                    Message.prototype.calculate = function() {
                        return T.calculate(this);
                    };

                    /**
                     * Encodes the varint32 length-delimited message.
                     * @name ProtoBuf.Builder.Message#encodeDelimited
                     * @function
                     * @param {(!ByteBuffer|boolean)=} buffer ByteBuffer to encode to. Will create a new one and flip it if omitted.
                     * @return {!ByteBuffer} Encoded message as a ByteBuffer
                     * @throws {Error} If the message cannot be encoded or if required fields are missing. The later still
                     *  returns the encoded ByteBuffer in the `encoded` property on the error.
                     * @expose
                     */
                    Message.prototype.encodeDelimited = function(buffer) {
                        var isNew = false;
                        if (!buffer)
                            buffer = new ByteBuffer(), isNew = true;
                        var enc = new ByteBuffer().LE();
                        T.encode(this, enc).flip();
                        buffer.writeVarint32(enc.remaining());
                        buffer.append(enc);
                        return isNew ? buffer.flip() : buffer;
                    };

                    /**
                     * Directly encodes the message to an ArrayBuffer.
                     * @name ProtoBuf.Builder.Message#encodeAB
                     * @function
                     * @return {ArrayBuffer} Encoded message as ArrayBuffer
                     * @throws {Error} If the message cannot be encoded or if required fields are missing. The later still
                     *  returns the encoded ArrayBuffer in the `encoded` property on the error.
                     * @expose
                     */
                    Message.prototype.encodeAB = function() {
                        try {
                            return this.encode().toArrayBuffer();
                        } catch (e) {
                            if (e["encoded"]) e["encoded"] = e["encoded"].toArrayBuffer();
                            throw(e);
                        }
                    };

                    /**
                     * Returns the message as an ArrayBuffer. This is an alias for {@link ProtoBuf.Builder.Message#encodeAB}.
                     * @name ProtoBuf.Builder.Message#toArrayBuffer
                     * @function
                     * @return {ArrayBuffer} Encoded message as ArrayBuffer
                     * @throws {Error} If the message cannot be encoded or if required fields are missing. The later still
                     *  returns the encoded ArrayBuffer in the `encoded` property on the error.
                     * @expose
                     */
                    Message.prototype.toArrayBuffer = Message.prototype.encodeAB;

                    /**
                     * Directly encodes the message to a node Buffer.
                     * @name ProtoBuf.Builder.Message#encodeNB
                     * @function
                     * @return {!Buffer}
                     * @throws {Error} If the message cannot be encoded, not running under node.js or if required fields are
                     *  missing. The later still returns the encoded node Buffer in the `encoded` property on the error.
                     * @expose
                     */
                    Message.prototype.encodeNB = function() {
                        try {
                            return this.encode().toBuffer();
                        } catch (e) {
                            if (e["encoded"]) e["encoded"] = e["encoded"].toBuffer();
                            throw(e);
                        }
                    };

                    /**
                     * Returns the message as a node Buffer. This is an alias for {@link ProtoBuf.Builder.Message#encodeNB}.
                     * @name ProtoBuf.Builder.Message#toBuffer
                     * @function
                     * @return {!Buffer}
                     * @throws {Error} If the message cannot be encoded or if required fields are missing. The later still
                     *  returns the encoded node Buffer in the `encoded` property on the error.
                     * @expose
                     */
                    Message.prototype.toBuffer = Message.prototype.encodeNB;

                    /**
                     * Directly encodes the message to a base64 encoded string.
                     * @name ProtoBuf.Builder.Message#encode64
                     * @function
                     * @return {string} Base64 encoded string
                     * @throws {Error} If the underlying buffer cannot be encoded or if required fields are missing. The later
                     *  still returns the encoded base64 string in the `encoded` property on the error.
                     * @expose
                     */
                    Message.prototype.encode64 = function() {
                        try {
                            return this.encode().toBase64();
                        } catch (e) {
                            if (e["encoded"]) e["encoded"] = e["encoded"].toBase64();
                            throw(e);
                        }
                    };

                    /**
                     * Returns the message as a base64 encoded string. This is an alias for {@link ProtoBuf.Builder.Message#encode64}.
                     * @name ProtoBuf.Builder.Message#toBase64
                     * @function
                     * @return {string} Base64 encoded string
                     * @throws {Error} If the message cannot be encoded or if required fields are missing. The later still
                     *  returns the encoded base64 string in the `encoded` property on the error.
                     * @expose
                     */
                    Message.prototype.toBase64 = Message.prototype.encode64;

                    /**
                     * Directly encodes the message to a hex encoded string.
                     * @name ProtoBuf.Builder.Message#encodeHex
                     * @function
                     * @return {string} Hex encoded string
                     * @throws {Error} If the underlying buffer cannot be encoded or if required fields are missing. The later
                     *  still returns the encoded hex string in the `encoded` property on the error.
                     * @expose
                     */
                    Message.prototype.encodeHex = function() {
                        try {
                            return this.encode().toHex();
                        } catch (e) {
                            if (e["encoded"]) e["encoded"] = e["encoded"].toHex();
                            throw(e);
                        }
                    };

                    /**
                     * Returns the message as a hex encoded string. This is an alias for {@link ProtoBuf.Builder.Message#encodeHex}.
                     * @name ProtoBuf.Builder.Message#toHex
                     * @function
                     * @return {string} Hex encoded string
                     * @throws {Error} If the message cannot be encoded or if required fields are missing. The later still
                     *  returns the encoded hex string in the `encoded` property on the error.
                     * @expose
                     */
                    Message.prototype.toHex = Message.prototype.encodeHex;

                    /**
                     * Clones a message object to a raw object.
                     * @param {*} obj Object to clone
                     * @param {boolean} includeBuffers Whether to include native buffer data or not
                     * @returns {*} Cloned object
                     * @inner
                     */
                    function cloneRaw(obj, includeBuffers) {
                        var clone = {};
                        for (var i in obj)
                            if (obj.hasOwnProperty(i)) {
                                if (obj[i] === null || typeof obj[i] !== 'object')
                                    clone[i] = obj[i];
                                else if (obj[i] instanceof ByteBuffer) {
                                    if (includeBuffers)
                                        clone[i] = obj.toBuffer();
                                } else // is a non-null object
                                    clone[i] = cloneRaw(obj[i], includeBuffers);
                            }
                        return clone;
                    }

                    /**
                     * Returns the message's raw payload.
                     * @param {boolean=} includeBuffers Whether to include native buffer data or not, defaults to `false`
                     * @returns {Object.<string,*>} Raw payload
                     * @expose
                     */
                    Message.prototype.toRaw = function(includeBuffers) {
                        return cloneRaw(this, !!includeBuffers);
                    };

                    /**
                     * Decodes a message from the specified buffer or string.
                     * @name ProtoBuf.Builder.Message.decode
                     * @function
                     * @param {!ByteBuffer|!ArrayBuffer|!Buffer|string} buffer Buffer to decode from
                     * @param {string=} enc Encoding if buffer is a string: hex, utf8 (not recommended), defaults to base64
                     * @return {!ProtoBuf.Builder.Message} Decoded message
                     * @throws {Error} If the message cannot be decoded or if required fields are missing. The later still
                     *  returns the decoded message with missing fields in the `decoded` property on the error.
                     * @expose
                     * @see ProtoBuf.Builder.Message.decode64
                     * @see ProtoBuf.Builder.Message.decodeHex
                     */
                    Message.decode = function(buffer, enc) {
                        if (typeof buffer === 'string')
                            buffer = ByteBuffer.wrap(buffer, enc ? enc : "base64");
                        buffer = buffer instanceof ByteBuffer ? buffer : ByteBuffer.wrap(buffer); // May throw
                        var le = buffer.littleEndian;
                        try {
                            var msg = T.decode(buffer.LE());
                            buffer.LE(le);
                            return msg;
                        } catch (e) {
                            buffer.LE(le);
                            throw(e);
                        }
                    };

                    /**
                     * Decodes a varint32 length-delimited message from the specified buffer or string.
                     * @name ProtoBuf.Builder.Message.decodeDelimited
                     * @function
                     * @param {!ByteBuffer|!ArrayBuffer|!Buffer|string} buffer Buffer to decode from
                     * @param {string=} enc Encoding if buffer is a string: hex, utf8 (not recommended), defaults to base64
                     * @return {ProtoBuf.Builder.Message} Decoded message or `null` if not enough bytes are available yet
                     * @throws {Error} If the message cannot be decoded or if required fields are missing. The later still
                     *  returns the decoded message with missing fields in the `decoded` property on the error.
                     * @expose
                     */
                    Message.decodeDelimited = function(buffer, enc) {
                        if (typeof buffer === 'string')
                            buffer = ByteBuffer.wrap(buffer, enc ? enc : "base64");
                        buffer = buffer instanceof ByteBuffer ? buffer : ByteBuffer.wrap(buffer); // May throw
                        if (buffer.remaining() < 1)
                            return null;
                        var off = buffer.offset,
                            len = buffer.readVarint32();
                        if (buffer.remaining() < len) {
                            buffer.offset = off;
                            return null;
                        }
                        try {
                            var msg = T.decode(buffer.slice(buffer.offset, buffer.offset + len).LE());
                            buffer.offset += len;
                            return msg;
                        } catch (err) {
                            buffer.offset += len;
                            throw err;
                        }
                    };

                    /**
                     * Decodes the message from the specified base64 encoded string.
                     * @name ProtoBuf.Builder.Message.decode64
                     * @function
                     * @param {string} str String to decode from
                     * @return {!ProtoBuf.Builder.Message} Decoded message
                     * @throws {Error} If the message cannot be decoded or if required fields are missing. The later still
                     *  returns the decoded message with missing fields in the `decoded` property on the error.
                     * @expose
                     */
                    Message.decode64 = function(str) {
                        return Message.decode(str, "base64");
                    };

                    /**
                     * Decodes the message from the specified hex encoded string.
                     * @name ProtoBuf.Builder.Message.decodeHex
                     * @function
                     * @param {string} str String to decode from
                     * @return {!ProtoBuf.Builder.Message} Decoded message
                     * @throws {Error} If the message cannot be decoded or if required fields are missing. The later still
                     *  returns the decoded message with missing fields in the `decoded` property on the error.
                     * @expose
                     */
                    Message.decodeHex = function(str) {
                        return Message.decode(str, "hex");
                    };

                    // Utility

                    /**
                     * Returns a string representation of this Message.
                     * @name ProtoBuf.Builder.Message#toString
                     * @function
                     * @return {string} String representation as of ".Fully.Qualified.MessageName"
                     * @expose
                     */
                    Message.prototype.toString = function() {
                        return T.toString();
                    };

                    // Static

                    /**
                     * Options.
                     * @name ProtoBuf.Builder.Message.$options
                     * @type {Object.<string,*>}
                     * @expose
                     */
                    var $options; // for cc

                    if (Object.defineProperty)
                        Object.defineProperty(Message, '$options', { "value": T.buildOpt() });

                    return Message;

                })(ProtoBuf, this);

                // Static enums and prototyped sub-messages
                var children = this.getChildren();
                for (var i=0; i<children.length; i++) {
                    if (children[i] instanceof Enum)
                        clazz[children[i]['name']] = children[i].build();
                    else if (children[i] instanceof Message)
                        clazz[children[i]['name']] = children[i].build();
                    else if (children[i] instanceof Message.Field) {
                        // Ignore
                    } else
                        throw Error("Illegal reflect child of "+this.toString(true)+": "+children[i].toString(true));
                }
                return this.clazz = clazz;
            };

            /**
             * Encodes a runtime message's contents to the specified buffer.
             * @param {!ProtoBuf.Builder.Message} message Runtime message to encode
             * @param {ByteBuffer} buffer ByteBuffer to write to
             * @return {ByteBuffer} The ByteBuffer for chaining
             * @throws {Error} If required fields are missing or the message cannot be encoded for another reason
             * @expose
             */
            Message.prototype.encode = function(message, buffer) {
                var fields = this.getChildren(Message.Field),
                    fieldMissing = null;
                for (var i=0, val; i<fields.length; i++) {
                    val = message.$get(fields[i].name);
                    if (fields[i].required && val === null) {
                        if (fieldMissing === null)
                            fieldMissing = fields[i];
                    } else
                        fields[i].encode(val, buffer);
                }
                if (fieldMissing !== null) {
                    var err = Error("Missing at least one required field for "+this.toString(true)+": "+fieldMissing);
                    err["encoded"] = buffer; // Still expose what we got
                    throw(err);
                }
                return buffer;
            };

            /**
             * Calculates a runtime message's byte length.
             * @param {!ProtoBuf.Builder.Message} message Runtime message to encode
             * @returns {number} Byte length
             * @throws {Error} If required fields are missing or the message cannot be calculated for another reason
             * @expose
             */
            Message.prototype.calculate = function(message) {
                var fields = this.getChildren(Message.Field),
                    n = 0;
                for (var i=0, val; i<fields.length; i++) {
                    val = message.$get(fields[i].name);
                    if (fields[i].required && val === null)
                       throw Error("Missing at least one required field for "+this.toString(true)+": "+fields[i]);
                    else
                        n += fields[i].calculate(val);
                }
                return n;
            };

            /**
             * Skips all data until the end of the specified group has been reached.
             * @param {number} expectedId Expected GROUPEND id
             * @param {!ByteBuffer} buf ByteBuffer
             * @returns {boolean} `true` if a value as been skipped, `false` if the end has been reached
             * @throws {Error} If it wasn't possible to find the end of the group (buffer overrun or end tag mismatch)
             * @inner
             */
            function skipTillGroupEnd(expectedId, buf) {
                var tag = buf.readVarint32(), // Throws on OOB
                    wireType = tag & 0x07,
                    id = tag >> 3;
                switch (wireType) {
                    case ProtoBuf.WIRE_TYPES.VARINT:
                        do tag = buf.readUint8();
                        while ((tag & 0x80) === 0x80);
                        break;
                    case ProtoBuf.WIRE_TYPES.BITS64:
                        buf.offset += 8;
                        break;
                    case ProtoBuf.WIRE_TYPES.LDELIM:
                        tag = buf.readVarint32(); // reads the varint
                        buf.offset += tag;        // skips n bytes
                        break;
                    case ProtoBuf.WIRE_TYPES.STARTGROUP:
                        skipTillGroupEnd(id, buf);
                        break;
                    case ProtoBuf.WIRE_TYPES.ENDGROUP:
                        if (id === expectedId)
                            return false;
                        else
                            throw Error("Illegal GROUPEND after unknown group: "+id+" ("+expectedId+" expected)");
                    case ProtoBuf.WIRE_TYPES.BITS32:
                        buf.offset += 4;
                        break;
                    default:
                        throw Error("Illegal wire type in unknown group "+expectedId+": "+wireType);
                }
                return true;
            }

            /**
             * Decodes an encoded message and returns the decoded message.
             * @param {ByteBuffer} buffer ByteBuffer to decode from
             * @param {number=} length Message length. Defaults to decode all the available data.
             * @param {number=} expectedGroupEndId Expected GROUPEND id if this is a legacy group
             * @return {ProtoBuf.Builder.Message} Decoded message
             * @throws {Error} If the message cannot be decoded
             * @expose
             */
            Message.prototype.decode = function(buffer, length, expectedGroupEndId) {
                length = typeof length === 'number' ? length : -1;
                var start = buffer.offset;
                var msg = new (this.clazz)();
                var tag, wireType, id;
                while (buffer.offset < start+length || (length == -1 && buffer.remaining() > 0)) {
                    tag = buffer.readVarint32();
                    wireType = tag & 0x07;
                    id = tag >> 3;
                    if (wireType === ProtoBuf.WIRE_TYPES.ENDGROUP) {
                        if (id !== expectedGroupEndId)
                            throw Error("Illegal group end indicator for "+this.toString(true)+": "+id+" ("+(expectedGroupEndId ? expectedGroupEndId+" expected" : "not a group")+")");
                        break;
                    }
                    var field = this.getChild(id); // Message.Field only
                    if (!field) {
                        // "messages created by your new code can be parsed by your old code: old binaries simply ignore the new field when parsing."
                        switch (wireType) {
                            case ProtoBuf.WIRE_TYPES.VARINT:
                                buffer.readVarint32();
                                break;
                            case ProtoBuf.WIRE_TYPES.BITS32:
                                buffer.offset += 4;
                                break;
                            case ProtoBuf.WIRE_TYPES.BITS64:
                                buffer.offset += 8;
                                break;
                            case ProtoBuf.WIRE_TYPES.LDELIM:
                                var len = buffer.readVarint32();
                                buffer.offset += len;
                                break;
                            case ProtoBuf.WIRE_TYPES.STARTGROUP:
                                while (skipTillGroupEnd(id, buffer)) {}
                                break;
                            default:
                                throw Error("Illegal wire type for unknown field "+id+" in "+this.toString(true)+"#decode: "+wireType);
                        }
                        continue;
                    }
                    if (field.repeated && !field.options["packed"])
                        msg.$add(field.name, field.decode(wireType, buffer), true);
                    else
                        msg.$set(field.name, field.decode(wireType, buffer), true);
                }

                // Check if all required fields are present
                var fields = this.getChildren(ProtoBuf.Reflect.Field);
                for (var i=0; i<fields.length; i++)
                    if (fields[i].required && msg[fields[i].name] === null) {
                        var err = Error("Missing at least one required field for "+this.toString(true)+": "+fields[i].name);
                        err["decoded"] = msg; // Still expose what we got
                        throw(err);
                    }
                return msg;
            };

            /**
             * @alias ProtoBuf.Reflect.Message
             * @expose
             */
            Reflect.Message = Message;

            /**
             * Constructs a new Message Field.
             * @exports ProtoBuf.Reflect.Message.Field
             * @param {ProtoBuf.Reflect.Message} message Message reference
             * @param {string} rule Rule, one of requried, optional, repeated
             * @param {string} type Data type, e.g. int32
             * @param {string} name Field name
             * @param {number} id Unique field id
             * @param {Object.<string.*>=} options Options
             * @constructor
             * @extends ProtoBuf.Reflect.T
             */
            var Field = function(message, rule, type, name, id, options) {
                T.call(this, message, name);

                /**
                 * @override
                 */
                this.className = "Message.Field";

                /**
                 * Message field required flag.
                 * @type {boolean}
                 * @expose
                 */
                this.required = rule == "required";

                /**
                 * Message field repeated flag.
                 * @type {boolean}
                 * @expose
                 */
                this.repeated = rule == "repeated";

                /**
                 * Message field type. Type reference string if unresolved, protobuf type if resolved.
                 * @type {string|{name: string, wireType: number}}
                 * @expose
                 */
                this.type = type;

                /**
                 * Resolved type reference inside the global namespace.
                 * @type {ProtoBuf.Reflect.T|null}
                 * @expose
                 */
                this.resolvedType = null;

                /**
                 * Unique message field id.
                 * @type {number}
                 * @expose
                 */
                this.id = id;

                /**
                 * Message field options.
                 * @type {!Object.<string,*>}
                 * @dict
                 * @expose
                 */
                this.options = options || {};

                /**
                 * Original field name.
                 * @type {string}
                 * @expose
                 */
                this.originalName = this.name; // Used to revert camelcase transformation on naming collisions

                // Convert field names to camel case notation if the override is set
                if (ProtoBuf.convertFieldsToCamelCase) {
                    this.name = this.name.replace(/_([a-zA-Z])/g, function($0, $1) {
                        return $1.toUpperCase();
                    });
                }
            };

            // Extends T
            Field.prototype = Object.create(T.prototype);

            /**
             * Makes a Long from a value.
             * @param {{low: number, high: number, unsigned: boolean}|string|number} value Value
             * @param {boolean=} unsigned Whether unsigned or not, defaults to reuse it from Long-like objects or to signed for
             *  strings and numbers
             * @returns {!Long}
             * @throws {Error} If the value cannot be converted to a Long
             * @inner
             */
            function mkLong(value, unsigned) {
                if (value && typeof value.low === 'number' && typeof value.high === 'number' && typeof value.unsigned === 'boolean'
                    && value.low === value.low && value.high === value.high)
                    return new ProtoBuf.Long(value.low, value.high, typeof unsigned === 'undefined' ? value.unsigned : unsigned);
                if (typeof value === 'string')
                    return ProtoBuf.Long.fromString(value, unsigned || false, 10);
                if (typeof value === 'number')
                    return ProtoBuf.Long.fromNumber(value, unsigned || false);
                throw Error("not convertible to Long");
            }

            /**
             * Checks if the given value can be set for this field.
             * @param {*} value Value to check
             * @param {boolean=} skipRepeated Whether to skip the repeated value check or not. Defaults to false.
             * @return {*} Verified, maybe adjusted, value
             * @throws {Error} If the value cannot be set for this field
             * @expose
             */
            Field.prototype.verifyValue = function(value, skipRepeated) {
                skipRepeated = skipRepeated || false;
                var fail = function(val, msg) {
                    throw Error("Illegal value for "+this.toString(true)+" of type "+this.type.name+": "+val+" ("+msg+")");
                }.bind(this);
                if (value === null) { // NULL values for optional fields
                    if (this.required)
                        fail(typeof value, "required");
                    return null;
                }
                var i;
                if (this.repeated && !skipRepeated) { // Repeated values as arrays
                    if (!ProtoBuf.Util.isArray(value))
                        value = [value];
                    var res = [];
                    for (i=0; i<value.length; i++)
                        res.push(this.verifyValue(value[i], true));
                    return res;
                }
                // All non-repeated fields expect no array
                if (!this.repeated && ProtoBuf.Util.isArray(value))
                    fail(typeof value, "no array expected");

                switch (this.type) {
                    // Signed 32bit
                    case ProtoBuf.TYPES["int32"]:
                    case ProtoBuf.TYPES["sint32"]:
                    case ProtoBuf.TYPES["sfixed32"]:
                        // Account for !NaN: value === value
                        if (typeof value !== 'number' || (value === value && value % 1 !== 0))
                            fail(typeof value, "not an integer");
                        return value > 4294967295 ? value | 0 : value;

                    // Unsigned 32bit
                    case ProtoBuf.TYPES["uint32"]:
                    case ProtoBuf.TYPES["fixed32"]:
                        if (typeof value !== 'number' || (value === value && value % 1 !== 0))
                            fail(typeof value, "not an integer");
                        return value < 0 ? value >>> 0 : value;

                    // Signed 64bit
                    case ProtoBuf.TYPES["int64"]:
                    case ProtoBuf.TYPES["sint64"]:
                    case ProtoBuf.TYPES["sfixed64"]: {
                        if (ProtoBuf.Long)
                            try {
                                return mkLong(value, false);
                            } catch (e) {
                                fail(typeof value, e.message);
                            }
                        else
                            fail(typeof value, "requires Long.js");
                    }

                    // Unsigned 64bit
                    case ProtoBuf.TYPES["uint64"]:
                    case ProtoBuf.TYPES["fixed64"]: {
                        if (ProtoBuf.Long)
                            try {
                                return mkLong(value, true);
                            } catch (e) {
                                fail(typeof value, e.message);
                            }
                        else
                            fail(typeof value, "requires Long.js");
                    }

                    // Bool
                    case ProtoBuf.TYPES["bool"]:
                        if (typeof value !== 'boolean')
                            fail(typeof value, "not a boolean");
                        return value;

                    // Float
                    case ProtoBuf.TYPES["float"]:
                    case ProtoBuf.TYPES["double"]:
                        if (typeof value !== 'number')
                            fail(typeof value, "not a number");
                        return value;

                    // Length-delimited string
                    case ProtoBuf.TYPES["string"]:
                        if (typeof value !== 'string' && !(value && value instanceof String))
                            fail(typeof value, "not a string");
                        return ""+value; // Convert String object to string

                    // Length-delimited bytes
                    case ProtoBuf.TYPES["bytes"]:
                        return value && value instanceof ByteBuffer
                            ? value
                            : ByteBuffer.wrap(value);

                    // Constant enum value
                    case ProtoBuf.TYPES["enum"]: {
                        var values = this.resolvedType.getChildren(Enum.Value);
                        for (i=0; i<values.length; i++) {
                            if (values[i].name == value) {
                                return values[i].id;
                            } else if (values[i].id == value) {
                                return values[i].id;
                            }
                        }
                        fail(value, "not a valid enum value");
                    }
                    // Embedded message
                    case ProtoBuf.TYPES["group"]:
                    case ProtoBuf.TYPES["message"]: {
                        if (!value || typeof value !== 'object')
                            fail(typeof value, "object expected");
                        if (value instanceof this.resolvedType.clazz)
                            return value;
                        // Else let's try to construct one from a key-value object
                        return new (this.resolvedType.clazz)(value); // May throw for a hundred of reasons
                    }
                }

                // We should never end here
                throw Error("[INTERNAL] Illegal value for "+this.toString(true)+": "+value+" (undefined type "+this.type+")");
            };

            /**
             * Encodes the specified field value to the specified buffer.
             * @param {*} value Field value
             * @param {ByteBuffer} buffer ByteBuffer to encode to
             * @return {ByteBuffer} The ByteBuffer for chaining
             * @throws {Error} If the field cannot be encoded
             * @expose
             */
            Field.prototype.encode = function(value, buffer) {
                value = this.verifyValue(value); // May throw
                if (this.type === null || typeof this.type !== 'object')
                    throw Error("[INTERNAL] Unresolved type in "+this.toString(true)+": "+this.type);
                if (value === null || (this.repeated && value.length == 0))
                    return buffer; // Optional omitted
                try {
                    if (this.repeated) {
                        var i;
                        // "Only repeated fields of primitive numeric types (types which use the varint, 32-bit, or 64-bit wire
                        // types) can be declared 'packed'."
                        if (this.options["packed"] && ProtoBuf.PACKABLE_WIRE_TYPES.indexOf(this.type.wireType) >= 0) {
                            // "All of the elements of the field are packed into a single key-value pair with wire type 2
                            // (length-delimited). Each element is encoded the same way it would be normally, except without a
                            // tag preceding it."
                            buffer.writeVarint32((this.id << 3) | ProtoBuf.WIRE_TYPES.LDELIM);
                            buffer.ensureCapacity(buffer.offset += 1); // We do not know the length yet, so let's assume a varint of length 1
                            var start = buffer.offset; // Remember where the contents begin
                            for (i=0; i<value.length; i++)
                                this.encodeValue(value[i], buffer);
                            var len = buffer.offset-start;
                            var varintLen = ByteBuffer.calculateVarint32(len);
                            if (varintLen > 1) { // We need to move the contents
                                var contents = buffer.slice(start, buffer.offset);
                                start += varintLen-1;
                                buffer.offset = start;
                                buffer.append(contents);
                            }
                            buffer.writeVarint32(len, start-varintLen);
                        } else {
                            // "If your message definition has repeated elements (without the [packed=true] option), the encoded
                            // message has zero or more key-value pairs with the same tag number"
                            for (i=0; i<value.length; i++)
                                buffer.writeVarint32((this.id << 3) | this.type.wireType),
                                this.encodeValue(value[i], buffer);
                        }
                    } else
                        buffer.writeVarint32((this.id << 3) | this.type.wireType),
                        this.encodeValue(value, buffer);
                } catch (e) {
                    throw Error("Illegal value for "+this.toString(true)+": "+value+" ("+e+")");
                }
                return buffer;
            };

            /**
             * Encodes a value to the specified buffer. Does not encode the key.
             * @param {*} value Field value
             * @param {ByteBuffer} buffer ByteBuffer to encode to
             * @return {ByteBuffer} The ByteBuffer for chaining
             * @throws {Error} If the value cannot be encoded
             * @expose
             */
            Field.prototype.encodeValue = function(value, buffer) {
                if (value === null) return buffer; // Nothing to encode
                // Tag has already been written

                switch (this.type) {
                    // 32bit signed varint
                    case ProtoBuf.TYPES["int32"]:
                        // "If you use int32 or int64 as the type for a negative number, the resulting varint is always ten bytes
                        // long – it is, effectively, treated like a very large unsigned integer." (see #122)
                        if (value < 0)
                            buffer.writeVarint64(value);
                        else
                            buffer.writeVarint32(value);
                        break;

                    // 32bit unsigned varint
                    case ProtoBuf.TYPES["uint32"]:
                        buffer.writeVarint32(value);
                        break;

                    // 32bit varint zig-zag
                    case ProtoBuf.TYPES["sint32"]:
                        buffer.writeVarint32ZigZag(value);
                        break;

                    // Fixed unsigned 32bit
                    case ProtoBuf.TYPES["fixed32"]:
                        buffer.writeUint32(value);
                        break;

                    // Fixed signed 32bit
                    case ProtoBuf.TYPES["sfixed32"]:
                        buffer.writeInt32(value);
                        break;

                    // 64bit varint as-is
                    case ProtoBuf.TYPES["int64"]:
                    case ProtoBuf.TYPES["uint64"]:
                        buffer.writeVarint64(value); // throws
                        break;

                    // 64bit varint zig-zag
                    case ProtoBuf.TYPES["sint64"]:
                        buffer.writeVarint64ZigZag(value); // throws
                        break;

                    // Fixed unsigned 64bit
                    case ProtoBuf.TYPES["fixed64"]:
                        buffer.writeUint64(value); // throws
                        break;

                    // Fixed signed 64bit
                    case ProtoBuf.TYPES["sfixed64"]:
                        buffer.writeInt64(value); // throws
                        break;

                    // Bool
                    case ProtoBuf.TYPES["bool"]:
                        if (typeof value === 'string')
                            buffer.writeVarint32(value.toLowerCase() === 'false' ? 0 : !!value);
                        else
                            buffer.writeVarint32(value ? 1 : 0);
                        break;

                    // Constant enum value
                    case ProtoBuf.TYPES["enum"]:
                        buffer.writeVarint32(value);
                        break;

                    // 32bit float
                    case ProtoBuf.TYPES["float"]:
                        buffer.writeFloat32(value);
                        break;

                    // 64bit float
                    case ProtoBuf.TYPES["double"]:
                        buffer.writeFloat64(value);
                        break;

                    // Length-delimited string
                    case ProtoBuf.TYPES["string"]:
                        buffer.writeVString(value);
                        break;

                    // Length-delimited bytes
                    case ProtoBuf.TYPES["bytes"]:
                        if (value.remaining() < 0)
                            throw Error("Illegal value for "+this.toString(true)+": "+value.remaining()+" bytes remaining");
                        var prevOffset = value.offset;
                        buffer.writeVarint32(value.remaining());
                        buffer.append(value);
                        value.offset = prevOffset;
                        break;

                    // Embedded message
                    case ProtoBuf.TYPES["message"]:
                        var bb = new ByteBuffer().LE();
                        this.resolvedType.encode(value, bb);
                        buffer.writeVarint32(bb.offset);
                        buffer.append(bb.flip());
                        break;

                    // Legacy group
                    case ProtoBuf.TYPES["group"]:
                        this.resolvedType.encode(value, buffer);
                        buffer.writeVarint32((this.id << 3) | ProtoBuf.WIRE_TYPES.ENDGROUP);
                        break;

                    default:
                        // We should never end here
                        throw Error("[INTERNAL] Illegal value to encode in "+this.toString(true)+": "+value+" (unknown type)");
                }
                return buffer;
            };

            /**
             * Calculates the length of this field's value on the network level.
             * @param {*} value Field value
             * @returns {number} Byte length
             * @expose
             */
            Field.prototype.calculate = function(value) {
                value = this.verifyValue(value); // May throw
                if (this.type === null || typeof this.type !== 'object')
                    throw Error("[INTERNAL] Unresolved type in "+this.toString(true)+": "+this.type);
                if (value === null || (this.repeated && value.length == 0))
                    return 0; // Optional omitted
                var n = 0;
                try {
                    if (this.repeated) {
                        var i, ni;
                        if (this.options["packed"] && ProtoBuf.PACKABLE_WIRE_TYPES.indexOf(this.type.wireType) >= 0) {
                            n += ByteBuffer.calculateVarint32((this.id << 3) | ProtoBuf.WIRE_TYPES.LDELIM);
                            ni = 0;
                            for (i=0; i<value.length; i++)
                                ni += this.calculateValue(value[i]);
                            n += ByteBuffer.calculateVarint32(ni);
                            n += ni;
                        } else {
                            for (i=0; i<value.length; i++)
                                n += ByteBuffer.calculateVarint32((this.id << 3) | this.type.wireType),
                                n += this.calculateValue(value[i]);
                        }
                    } else {
                        n += ByteBuffer.calculateVarint32((this.id << 3) | this.type.wireType);
                        n += this.calculateValue(value);
                    }
                } catch (e) {
                    throw Error("Illegal value for "+this.toString(true)+": "+value+" ("+e+")");
                }
                return n;
            };

            /**
             * Calculates the byte length of a value.
             * @param {*} value Field value
             * @returns {number} Byte length
             * @throws {Error} If the value cannot be calculated
             * @expose
             */
            Field.prototype.calculateValue = function(value) {
                if (value === null) return 0; // Nothing to encode
                // Tag has already been written
                var n;
                switch (this.type) {
                    case ProtoBuf.TYPES["int32"]:
                        return value < 0 ? ByteBuffer.calculateVarint64(value) : ByteBuffer.calculateVarint32(value);
                    case ProtoBuf.TYPES["uint32"]:
                        return ByteBuffer.calculateVarint32(value);
                    case ProtoBuf.TYPES["sint32"]:
                        return ByteBuffer.calculateVarint32(ByteBuffer.zigZagEncode32(value));
                    case ProtoBuf.TYPES["fixed32"]:
                    case ProtoBuf.TYPES["sfixed32"]:
                    case ProtoBuf.TYPES["float"]:
                        return 4;
                    case ProtoBuf.TYPES["int64"]:
                    case ProtoBuf.TYPES["uint64"]:
                        return ByteBuffer.calculateVarint64(value);
                    case ProtoBuf.TYPES["sint64"]:
                        return ByteBuffer.calculateVarint64(ByteBuffer.zigZagEncode64(value));
                    case ProtoBuf.TYPES["fixed64"]:
                    case ProtoBuf.TYPES["sfixed64"]:
                        return 8;
                    case ProtoBuf.TYPES["bool"]:
                        return 1;
                    case ProtoBuf.TYPES["enum"]:
                        return ByteBuffer.calculateVarint32(value);
                    case ProtoBuf.TYPES["double"]:
                        return 8;
                    case ProtoBuf.TYPES["string"]:
                        n = ByteBuffer.calculateUTF8Bytes(value);
                        return ByteBuffer.calculateVarint32(n) + n;
                    case ProtoBuf.TYPES["bytes"]:
                        if (value.remaining() < 0)
                            throw Error("Illegal value for "+this.toString(true)+": "+value.remaining()+" bytes remaining");
                        return ByteBuffer.calculateVarint32(value.remaining()) + value.remaining();
                    case ProtoBuf.TYPES["message"]:
                        n = this.resolvedType.calculate(value);
                        return ByteBuffer.calculateVarint32(n) + n;
                    case ProtoBuf.TYPES["group"]:
                        n = this.resolvedType.calculate(value);
                        return n + ByteBuffer.calculateVarint32((this.id << 3) | ProtoBuf.WIRE_TYPES.ENDGROUP);
                }
                // We should never end here
                throw Error("[INTERNAL] Illegal value to encode in "+this.toString(true)+": "+value+" (unknown type)");
            };

            /**
             * Decode the field value from the specified buffer.
             * @param {number} wireType Leading wire type
             * @param {ByteBuffer} buffer ByteBuffer to decode from
             * @param {boolean=} skipRepeated Whether to skip the repeated check or not. Defaults to false.
             * @return {*} Decoded value
             * @throws {Error} If the field cannot be decoded
             * @expose
             */
            Field.prototype.decode = function(wireType, buffer, skipRepeated) {
                var value, nBytes;
                if (wireType != this.type.wireType && (skipRepeated || (wireType != ProtoBuf.WIRE_TYPES.LDELIM || !this.repeated)))
                    throw Error("Illegal wire type for field "+this.toString(true)+": "+wireType+" ("+this.type.wireType+" expected)");
                if (wireType == ProtoBuf.WIRE_TYPES.LDELIM && this.repeated && this.options["packed"] && ProtoBuf.PACKABLE_WIRE_TYPES.indexOf(this.type.wireType) >= 0) {
                    if (!skipRepeated) {
                        nBytes = buffer.readVarint32();
                        nBytes = buffer.offset + nBytes; // Limit
                        var values = [];
                        while (buffer.offset < nBytes)
                            values.push(this.decode(this.type.wireType, buffer, true));
                        return values;
                    }
                    // Read the next value otherwise...
                }
                switch (this.type) {
                    // 32bit signed varint
                    case ProtoBuf.TYPES["int32"]:
                        return buffer.readVarint32() | 0;

                    // 32bit unsigned varint
                    case ProtoBuf.TYPES["uint32"]:
                        return buffer.readVarint32() >>> 0;

                    // 32bit signed varint zig-zag
                    case ProtoBuf.TYPES["sint32"]:
                        return buffer.readVarint32ZigZag() | 0;

                    // Fixed 32bit unsigned
                    case ProtoBuf.TYPES["fixed32"]:
                        return buffer.readUint32() >>> 0;

                    case ProtoBuf.TYPES["sfixed32"]:
                        return buffer.readInt32() | 0;

                    // 64bit signed varint
                    case ProtoBuf.TYPES["int64"]:
                        return buffer.readVarint64();

                    // 64bit unsigned varint
                    case ProtoBuf.TYPES["uint64"]:
                        return buffer.readVarint64().toUnsigned();

                    // 64bit signed varint zig-zag
                    case ProtoBuf.TYPES["sint64"]:
                        return buffer.readVarint64ZigZag();

                    // Fixed 64bit unsigned
                    case ProtoBuf.TYPES["fixed64"]:
                        return buffer.readUint64();

                    // Fixed 64bit signed
                    case ProtoBuf.TYPES["sfixed64"]:
                        return buffer.readInt64();

                    // Bool varint
                    case ProtoBuf.TYPES["bool"]:
                        return !!buffer.readVarint32();

                    // Constant enum value (varint)
                    case ProtoBuf.TYPES["enum"]:
                        // The following Builder.Message#set will already throw
                        return buffer.readVarint32();

                    // 32bit float
                    case ProtoBuf.TYPES["float"]:
                        return buffer.readFloat();

                    // 64bit float
                    case ProtoBuf.TYPES["double"]:
                        return buffer.readDouble();

                    // Length-delimited string
                    case ProtoBuf.TYPES["string"]:
                        return buffer.readVString();

                    // Length-delimited bytes
                    case ProtoBuf.TYPES["bytes"]: {
                        nBytes = buffer.readVarint32();
                        if (buffer.remaining() < nBytes)
                            throw Error("Illegal number of bytes for "+this.toString(true)+": "+nBytes+" required but got only "+buffer.remaining());
                        value = buffer.clone(); // Offset already set
                        value.limit = value.offset+nBytes;
                        buffer.offset += nBytes;
                        return value;
                    }

                    // Length-delimited embedded message
                    case ProtoBuf.TYPES["message"]: {
                        nBytes = buffer.readVarint32();
                        return this.resolvedType.decode(buffer, nBytes);
                    }

                    // Legacy group
                    case ProtoBuf.TYPES["group"]:
                        return this.resolvedType.decode(buffer, -1, this.id);
                }

                // We should never end here
                throw Error("[INTERNAL] Illegal wire type for "+this.toString(true)+": "+wireType);
            }

            /**
             * @alias ProtoBuf.Reflect.Message.Field
             * @expose
             */
            Reflect.Message.Field = Field;

            /**
             * Constructs a new Message ExtensionField.
             * @exports ProtoBuf.Reflect.Message.ExtensionField
             * @param {ProtoBuf.Reflect.Message} message Message reference
             * @param {string} rule Rule, one of requried, optional, repeated
             * @param {string} type Data type, e.g. int32
             * @param {string} name Field name
             * @param {number} id Unique field id
             * @param {Object.<string.*>=} options Options
             * @constructor
             * @extends ProtoBuf.Reflect.Message.Field
             */
            var ExtensionField = function(message, rule, type, name, id, options) {
                Field.call(this, message, rule, type, name, id, options);
            };

            // Extends Field
            ExtensionField.prototype = Object.create(Field.prototype);

            /**
             * @alias ProtoBuf.Reflect.Message.ExtensionField
             * @expose
             */
            Reflect.Message.ExtensionField = ExtensionField;

            /**
             * Constructs a new Enum.
             * @exports ProtoBuf.Reflect.Enum
             * @param {!ProtoBuf.Reflect.T} parent Parent Reflect object
             * @param {string} name Enum name
             * @param {Object.<string.*>=} options Enum options
             * @constructor
             * @extends ProtoBuf.Reflect.Namespace
             */
            var Enum = function(parent, name, options) {
                Namespace.call(this, parent, name, options);

                /**
                 * @override
                 */
                this.className = "Enum";

                /**
                 * Runtime enum object.
                 * @type {Object.<string,number>|null}
                 * @expose
                 */
                this.object = null;
            };

            // Extends Namespace
            Enum.prototype = Object.create(Namespace.prototype);

            /**
             * Builds this enum and returns the runtime counterpart.
             * @return {Object<string,*>}
             * @expose
             */
            Enum.prototype.build = function() {
                var enm = {};
                var values = this.getChildren(Enum.Value);
                for (var i=0; i<values.length; i++)
                    enm[values[i]['name']] = values[i]['id'];
                if (Object.defineProperty)
                    Object.defineProperty(enm, '$options', { "value": this.buildOpt() });
                return this.object = enm;
            };

            /**
             * @alias ProtoBuf.Reflect.Enum
             * @expose
             */
            Reflect.Enum = Enum;

            /**
             * Constructs a new Enum Value.
             * @exports ProtoBuf.Reflect.Enum.Value
             * @param {!ProtoBuf.Reflect.Enum} enm Enum reference
             * @param {string} name Field name
             * @param {number} id Unique field id
             * @constructor
             * @extends ProtoBuf.Reflect.T
             */
            var Value = function(enm, name, id) {
                T.call(this, enm, name);

                /**
                 * @override
                 */
                this.className = "Enum.Value";

                /**
                 * Unique enum value id.
                 * @type {number}
                 * @expose
                 */
                this.id = id;
            };

            // Extends T
            Value.prototype = Object.create(T.prototype);

            /**
             * @alias ProtoBuf.Reflect.Enum.Value
             * @expose
             */
            Reflect.Enum.Value = Value;

            /**
             * Constructs a new Service.
             * @exports ProtoBuf.Reflect.Service
             * @param {!ProtoBuf.Reflect.Namespace} root Root
             * @param {string} name Service name
             * @param {Object.<string,*>=} options Options
             * @constructor
             * @extends ProtoBuf.Reflect.Namespace
             */
            var Service = function(root, name, options) {
                Namespace.call(this, root, name, options);

                /**
                 * @override
                 */
                this.className = "Service";

                /**
                 * Built runtime service class.
                 * @type {?function(new:ProtoBuf.Builder.Service)}
                 */
                this.clazz = null;
            };

            // Extends Namespace
            Service.prototype = Object.create(Namespace.prototype);

            /**
             * Builds the service and returns the runtime counterpart, which is a fully functional class.
             * @see ProtoBuf.Builder.Service
             * @param {boolean=} rebuild Whether to rebuild or not
             * @return {Function} Service class
             * @throws {Error} If the message cannot be built
             * @expose
             */
            Service.prototype.build = function(rebuild) {
                if (this.clazz && !rebuild) return this.clazz;
                return this.clazz = (function(ProtoBuf, T) {

                    /**
                     * Constructs a new runtime Service.
                     * @name ProtoBuf.Builder.Service
                     * @param {function(string, ProtoBuf.Builder.Message, function(Error, ProtoBuf.Builder.Message=))=} rpcImpl RPC implementation receiving the method name and the message
                     * @class Barebone of all runtime services.
                     * @constructor
                     * @throws {Error} If the service cannot be created
                     */
                    var Service = function(rpcImpl) {
                        ProtoBuf.Builder.Service.call(this);

                        /**
                         * Service implementation.
                         * @name ProtoBuf.Builder.Service#rpcImpl
                         * @type {!function(string, ProtoBuf.Builder.Message, function(Error, ProtoBuf.Builder.Message=))}
                         * @expose
                         */
                        this.rpcImpl = rpcImpl || function(name, msg, callback) {
                            // This is what a user has to implement: A function receiving the method name, the actual message to
                            // send (type checked) and the callback that's either provided with the error as its first
                            // argument or null and the actual response message.
                            setTimeout(callback.bind(this, Error("Not implemented, see: https://github.com/dcodeIO/ProtoBuf.js/wiki/Services")), 0); // Must be async!
                        };
                    };

                    // Extends ProtoBuf.Builder.Service
                    Service.prototype = Object.create(ProtoBuf.Builder.Service.prototype);

                    if (Object.defineProperty)
                        Object.defineProperty(Service, "$options", { "value": T.buildOpt() }),
                        Object.defineProperty(Service.prototype, "$options", { "value": Service["$options"] });

                    /**
                     * Asynchronously performs an RPC call using the given RPC implementation.
                     * @name ProtoBuf.Builder.Service.[Method]
                     * @function
                     * @param {!function(string, ProtoBuf.Builder.Message, function(Error, ProtoBuf.Builder.Message=))} rpcImpl RPC implementation
                     * @param {ProtoBuf.Builder.Message} req Request
                     * @param {function(Error, (ProtoBuf.Builder.Message|ByteBuffer|Buffer|string)=)} callback Callback receiving
                     *  the error if any and the response either as a pre-parsed message or as its raw bytes
                     * @abstract
                     */

                    /**
                     * Asynchronously performs an RPC call using the instance's RPC implementation.
                     * @name ProtoBuf.Builder.Service#[Method]
                     * @function
                     * @param {ProtoBuf.Builder.Message} req Request
                     * @param {function(Error, (ProtoBuf.Builder.Message|ByteBuffer|Buffer|string)=)} callback Callback receiving
                     *  the error if any and the response either as a pre-parsed message or as its raw bytes
                     * @abstract
                     */

                    var rpc = T.getChildren(ProtoBuf.Reflect.Service.RPCMethod);
                    for (var i=0; i<rpc.length; i++) {
                        (function(method) {

                            // service#Method(message, callback)
                            Service.prototype[method.name] = function(req, callback) {
                                try {
                                    if (!req || !(req instanceof method.resolvedRequestType.clazz)) {
                                        setTimeout(callback.bind(this, Error("Illegal request type provided to service method "+T.name+"#"+method.name)), 0);
                                        return;
                                    }
                                    this.rpcImpl(method.fqn(), req, function(err, res) { // Assumes that this is properly async
                                        if (err) {
                                            callback(err);
                                            return;
                                        }
                                        try { res = method.resolvedResponseType.clazz.decode(res); } catch (notABuffer) {}
                                        if (!res || !(res instanceof method.resolvedResponseType.clazz)) {
                                            callback(Error("Illegal response type received in service method "+ T.name+"#"+method.name));
                                            return;
                                        }
                                        callback(null, res);
                                    });
                                } catch (err) {
                                    setTimeout(callback.bind(this, err), 0);
                                }
                            };

                            // Service.Method(rpcImpl, message, callback)
                            Service[method.name] = function(rpcImpl, req, callback) {
                                new Service(rpcImpl)[method.name](req, callback);
                            };

                            if (Object.defineProperty)
                                Object.defineProperty(Service[method.name], "$options", { "value": method.buildOpt() }),
                                Object.defineProperty(Service.prototype[method.name], "$options", { "value": Service[method.name]["$options"] });
                        })(rpc[i]);
                    }

                    return Service;

                })(ProtoBuf, this);
            };

            /**
             * @alias ProtoBuf.Reflect.Service
             * @expose
             */
            Reflect.Service = Service;

            /**
             * Abstract service method.
             * @exports ProtoBuf.Reflect.Service.Method
             * @param {!ProtoBuf.Reflect.Service} svc Service
             * @param {string} name Method name
             * @param {Object.<string,*>=} options Options
             * @constructor
             * @extends ProtoBuf.Reflect.T
             */
            var Method = function(svc, name, options) {
                T.call(this, svc, name);

                /**
                 * @override
                 */
                this.className = "Service.Method";

                /**
                 * Options.
                 * @type {Object.<string, *>}
                 * @expose
                 */
                this.options = options || {};
            };

            // Extends T
            Method.prototype = Object.create(T.prototype);

            /**
             * Builds the method's '$options' property.
             * @name ProtoBuf.Reflect.Service.Method#buildOpt
             * @function
             * @return {Object.<string,*>}
             */
            Method.prototype.buildOpt = Namespace.prototype.buildOpt;

            /**
             * @alias ProtoBuf.Reflect.Service.Method
             * @expose
             */
            Reflect.Service.Method = Method;

            /**
             * RPC service method.
             * @exports ProtoBuf.Reflect.Service.RPCMethod
             * @param {!ProtoBuf.Reflect.Service} svc Service
             * @param {string} name Method name
             * @param {string} request Request message name
             * @param {string} response Response message name
             * @param {Object.<string,*>=} options Options
             * @constructor
             * @extends ProtoBuf.Reflect.Service.Method
             */
            var RPCMethod = function(svc, name, request, response, options) {
                Method.call(this, svc, name, options);

                /**
                 * @override
                 */
                this.className = "Service.RPCMethod";

                /**
                 * Request message name.
                 * @type {string}
                 * @expose
                 */
                this.requestName = request;

                /**
                 * Response message name.
                 * @type {string}
                 * @expose
                 */
                this.responseName = response;

                /**
                 * Resolved request message type.
                 * @type {ProtoBuf.Reflect.Message}
                 * @expose
                 */
                this.resolvedRequestType = null;

                /**
                 * Resolved response message type.
                 * @type {ProtoBuf.Reflect.Message}
                 * @expose
                 */
                this.resolvedResponseType = null;
            };

            // Extends Method
            RPCMethod.prototype = Object.create(Method.prototype);

            /**
             * @alias ProtoBuf.Reflect.Service.RPCMethod
             * @expose
             */
            Reflect.Service.RPCMethod = RPCMethod;

            return Reflect;
        })(ProtoBuf);

        /**
         * @alias ProtoBuf.Builder
         * @expose
         */
        ProtoBuf.Builder = (function(ProtoBuf, Lang, Reflect) {
            "use strict";

            /**
             * Constructs a new Builder.
             * @exports ProtoBuf.Builder
             * @class Provides the functionality to build protocol messages.
             * @constructor
             */
            var Builder = function() {

                /**
                 * Namespace.
                 * @type {ProtoBuf.Reflect.Namespace}
                 * @expose
                 */
                this.ns = new Reflect.Namespace(null, ""); // Global namespace

                /**
                 * Namespace pointer.
                 * @type {ProtoBuf.Reflect.T}
                 * @expose
                 */
                this.ptr = this.ns;

                /**
                 * Resolved flag.
                 * @type {boolean}
                 * @expose
                 */
                this.resolved = false;

                /**
                 * The current building result.
                 * @type {Object.<string,ProtoBuf.Builder.Message|Object>|null}
                 * @expose
                 */
                this.result = null;

                /**
                 * Imported files.
                 * @type {Array.<string>}
                 * @expose
                 */
                this.files = {};

                /**
                 * Import root override.
                 * @type {?string}
                 * @expose
                 */
                this.importRoot = null;
            };

            /**
             * Resets the pointer to the root namespace.
             * @expose
             */
            Builder.prototype.reset = function() {
                this.ptr = this.ns;
            };

            /**
             * Defines a package on top of the current pointer position and places the pointer on it.
             * @param {string} pkg
             * @param {Object.<string,*>=} options
             * @return {ProtoBuf.Builder} this
             * @throws {Error} If the package name is invalid
             * @expose
             */
            Builder.prototype.define = function(pkg, options) {
                if (typeof pkg !== 'string' || !Lang.TYPEREF.test(pkg))
                    throw Error("Illegal package: "+pkg);
                var part = pkg.split("."), i;
                for (i=0; i<part.length; i++) // To be absolutely sure
                    if (!Lang.NAME.test(part[i]))
                        throw Error("Illegal package: "+part[i]);
                for (i=0; i<part.length; i++) {
                    if (!this.ptr.hasChild(part[i])) // Keep existing namespace
                        this.ptr.addChild(new Reflect.Namespace(this.ptr, part[i], options));
                    this.ptr = this.ptr.getChild(part[i]);
                }
                return this;
            };

            /**
             * Tests if a definition is a valid message definition.
             * @param {Object.<string,*>} def Definition
             * @return {boolean} true if valid, else false
             * @expose
             */
            Builder.isValidMessage = function(def) {
                // Messages require a string name
                if (typeof def["name"] !== 'string' || !Lang.NAME.test(def["name"]))
                    return false;
                // Messages must not contain values (that'd be an enum) or methods (that'd be a service)
                if (typeof def["values"] !== 'undefined' || typeof def["rpc"] !== 'undefined')
                    return false;
                // Fields, enums and messages are arrays if provided
                var i;
                if (typeof def["fields"] !== 'undefined') {
                    if (!ProtoBuf.Util.isArray(def["fields"]))
                        return false;
                    var ids = [], id; // IDs must be unique
                    for (i=0; i<def["fields"].length; i++) {
                        if (!Builder.isValidMessageField(def["fields"][i]))
                            return false;
                        id = parseInt(def["fields"][i]["id"], 10);
                        if (ids.indexOf(id) >= 0)
                            return false;
                        ids.push(id);
                    }
                    ids = null;
                }
                if (typeof def["enums"] !== 'undefined') {
                    if (!ProtoBuf.Util.isArray(def["enums"]))
                        return false;
                    for (i=0; i<def["enums"].length; i++)
                        if (!Builder.isValidEnum(def["enums"][i]))
                            return false;
                }
                if (typeof def["messages"] !== 'undefined') {
                    if (!ProtoBuf.Util.isArray(def["messages"]))
                        return false;
                    for (i=0; i<def["messages"].length; i++)
                        if (!Builder.isValidMessage(def["messages"][i]) && !Builder.isValidExtend(def["messages"][i]))
                            return false;
                }
                if (typeof def["extensions"] !== 'undefined')
                    if (!ProtoBuf.Util.isArray(def["extensions"]) || def["extensions"].length !== 2 || typeof def["extensions"][0] !== 'number' || typeof def["extensions"][1] !== 'number')
                        return false;
                return true;
            };

            /**
             * Tests if a definition is a valid message field definition.
             * @param {Object} def Definition
             * @return {boolean} true if valid, else false
             * @expose
             */
            Builder.isValidMessageField = function(def) {
                // Message fields require a string rule, name and type and an id
                if (typeof def["rule"] !== 'string' || typeof def["name"] !== 'string' || typeof def["type"] !== 'string' || typeof def["id"] === 'undefined')
                    return false;
                if (!Lang.RULE.test(def["rule"]) || !Lang.NAME.test(def["name"]) || !Lang.TYPEREF.test(def["type"]) || !Lang.ID.test(""+def["id"]))
                    return false;
                if (typeof def["options"] !== 'undefined') {
                    // Options are objects
                    if (typeof def["options"] !== 'object')
                        return false;
                    // Options are <string,string|number|boolean>
                    var keys = Object.keys(def["options"]);
                    for (var i=0, key; i<keys.length; i++)
                        if (typeof (key = keys[i]) !== 'string' || (typeof def["options"][key] !== 'string' && typeof def["options"][key] !== 'number' && typeof def["options"][key] !== 'boolean'))
                            return false;
                }
                return true;
            };

            /**
             * Tests if a definition is a valid enum definition.
             * @param {Object} def Definition
             * @return {boolean} true if valid, else false
             * @expose
             */
            Builder.isValidEnum = function(def) {
                // Enums require a string name
                if (typeof def["name"] !== 'string' || !Lang.NAME.test(def["name"]))
                    return false;
                // Enums require at least one value
                if (typeof def["values"] === 'undefined' || !ProtoBuf.Util.isArray(def["values"]) || def["values"].length == 0)
                    return false;
                for (var i=0; i<def["values"].length; i++) {
                    // Values are objects
                    if (typeof def["values"][i] != "object")
                        return false;
                    // Values require a string name and an id
                    if (typeof def["values"][i]["name"] !== 'string' || typeof def["values"][i]["id"] === 'undefined')
                        return false;
                    if (!Lang.NAME.test(def["values"][i]["name"]) || !Lang.NEGID.test(""+def["values"][i]["id"]))
                        return false;
                }
                // It's not important if there are other fields because ["values"] is already unique
                return true;
            };

            /**
             * Creates ths specified protocol types at the current pointer position.
             * @param {Array.<Object.<string,*>>} defs Messages, enums or services to create
             * @return {ProtoBuf.Builder} this
             * @throws {Error} If a message definition is invalid
             * @expose
             */
            Builder.prototype.create = function(defs) {
                if (!defs)
                    return this; // Nothing to create
                if (!ProtoBuf.Util.isArray(defs))
                    defs = [defs];
                if (defs.length == 0)
                    return this;

                // It's quite hard to keep track of scopes and memory here, so let's do this iteratively.
                var stack = [], def, obj, subObj, i, j;
                stack.push(defs); // One level [a, b, c]
                while (stack.length > 0) {
                    defs = stack.pop();
                    if (ProtoBuf.Util.isArray(defs)) { // Stack always contains entire namespaces
                        while (defs.length > 0) {
                            def = defs.shift(); // Namespace always contains an array of messages, enums and services
                            if (Builder.isValidMessage(def)) {
                                obj = new Reflect.Message(this.ptr, def["name"], def["options"], def["isGroup"]);
                                // Create fields
                                if (def["fields"] && def["fields"].length > 0) {
                                    for (i=0; i<def["fields"].length; i++) { // i=Fields
                                        if (obj.hasChild(def['fields'][i]['id']))
                                            throw Error("Duplicate field id in message "+obj.name+": "+def['fields'][i]['id']);
                                        if (def["fields"][i]["options"]) {
                                            subObj = Object.keys(def["fields"][i]["options"]);
                                            for (j=0; j<subObj.length; j++) { // j=Option names
                                                if (typeof subObj[j] !== 'string')
                                                    throw Error("Illegal field option name in message "+obj.name+"#"+def["fields"][i]["name"]+": "+subObj[j]);
                                                if (typeof def["fields"][i]["options"][subObj[j]] !== 'string' && typeof def["fields"][i]["options"][subObj[j]] !== 'number' && typeof def["fields"][i]["options"][subObj[j]] !== 'boolean')
                                                    throw Error("Illegal field option value in message "+obj.name+"#"+def["fields"][i]["name"]+"#"+subObj[j]+": "+def["fields"][i]["options"][subObj[j]]);
                                            }
                                            subObj = null;
                                        }
                                        obj.addChild(new Reflect.Message.Field(obj, def["fields"][i]["rule"], def["fields"][i]["type"], def["fields"][i]["name"], def["fields"][i]["id"], def["fields"][i]["options"]));
                                    }
                                }
                                // Push enums and messages to stack
                                subObj = [];
                                if (typeof def["enums"] !== 'undefined' && def['enums'].length > 0)
                                    for (i=0; i<def["enums"].length; i++)
                                        subObj.push(def["enums"][i]);
                                if (def["messages"] && def["messages"].length > 0)
                                    for (i=0; i<def["messages"].length; i++)
                                        subObj.push(def["messages"][i]);
                                // Set extension range
                                if (def["extensions"]) {
                                    obj.extensions = def["extensions"];
                                    if (obj.extensions[0] < ProtoBuf.ID_MIN)
                                        obj.extensions[0] = ProtoBuf.ID_MIN;
                                    if (obj.extensions[1] > ProtoBuf.ID_MAX)
                                        obj.extensions[1] = ProtoBuf.ID_MAX;
                                }
                                this.ptr.addChild(obj); // Add to current namespace
                                if (subObj.length > 0) {
                                    stack.push(defs); // Push the current level back
                                    defs = subObj; // Continue processing sub level
                                    subObj = null;
                                    this.ptr = obj; // And move the pointer to this namespace
                                    obj = null;
                                    continue;
                                }
                                subObj = null;
                                obj = null;
                            } else if (Builder.isValidEnum(def)) {
                                obj = new Reflect.Enum(this.ptr, def["name"], def["options"]);
                                for (i=0; i<def["values"].length; i++)
                                    obj.addChild(new Reflect.Enum.Value(obj, def["values"][i]["name"], def["values"][i]["id"]));
                                this.ptr.addChild(obj);
                                obj = null;
                            } else if (Builder.isValidService(def)) {
                                obj = new Reflect.Service(this.ptr, def["name"], def["options"]);
                                for (i in def["rpc"])
                                    if (def["rpc"].hasOwnProperty(i))
                                        obj.addChild(new Reflect.Service.RPCMethod(obj, i, def["rpc"][i]["request"], def["rpc"][i]["response"], def["rpc"][i]["options"]));
                                this.ptr.addChild(obj);
                                obj = null;
                            } else if (Builder.isValidExtend(def)) {
                                obj = this.ptr.resolve(def["ref"]);
                                if (obj) {
                                    for (i=0; i<def["fields"].length; i++) { // i=Fields
                                        if (obj.hasChild(def['fields'][i]['id']))
                                            throw Error("Duplicate extended field id in message "+obj.name+": "+def['fields'][i]['id']);
                                        if (def['fields'][i]['id'] < obj.extensions[0] || def['fields'][i]['id'] > obj.extensions[1])
                                            throw Error("Illegal extended field id in message "+obj.name+": "+def['fields'][i]['id']+" ("+obj.extensions.join(' to ')+" expected)");
                                        // TODO: See #161
                                        /* subObj = new (this.ptr instanceof Reflect.Message ? Reflect.Message.ExtensionField : Reflect.Message.Field)(obj, def["fields"][i]["rule"], def["fields"][i]["type"], def["fields"][i]["name"], def["fields"][i]["id"], def["fields"][i]["options"]);
                                        if (this.ptr instanceof Reflect.Message)
                                            this.ptr.addChild(subObj);
                                        else
                                            obj.addChild(subObj); */
                                        obj.addChild(new Reflect.Message.Field(obj, def["fields"][i]["rule"], def["fields"][i]["type"], def["fields"][i]["name"], def["fields"][i]["id"], def["fields"][i]["options"]));
                                    }
                                } else if (!/\.?google\.protobuf\./.test(def["ref"])) // Silently skip internal extensions
                                    throw Error("Extended message "+def["ref"]+" is not defined");
                            } else
                                throw Error("Not a valid definition: "+JSON.stringify(def));
                            def = null;
                        }
                        // Break goes here
                    } else
                        throw Error("Not a valid namespace: "+JSON.stringify(defs));
                    defs = null;
                    this.ptr = this.ptr.parent; // This namespace is s done
                }
                this.resolved = false; // Require re-resolve
                this.result = null; // Require re-build
                return this;
            };

            /**
             * Imports another definition into this builder.
             * @param {Object.<string,*>} json Parsed import
             * @param {(string|{root: string, file: string})=} filename Imported file name
             * @return {ProtoBuf.Builder} this
             * @throws {Error} If the definition or file cannot be imported
             * @expose
             */
            Builder.prototype["import"] = function(json, filename) {
                if (typeof filename === 'string') {
                    if (ProtoBuf.Util.IS_NODE)
                        filename = _dereq_("path")['resolve'](filename);
                    if (this.files[filename] === true) {
                        this.reset();
                        return this; // Skip duplicate imports
                    }
                    this.files[filename] = true;
                }
                if (!!json['imports'] && json['imports'].length > 0) {
                    var importRoot, delim = '/', resetRoot = false;
                    if (typeof filename === 'object') { // If an import root is specified, override
                        this.importRoot = filename["root"]; resetRoot = true; // ... and reset afterwards
                        importRoot = this.importRoot;
                        filename = filename["file"];
                        if (importRoot.indexOf("\\") >= 0 || filename.indexOf("\\") >= 0) delim = '\\';
                    } else if (typeof filename === 'string') {
                        if (this.importRoot) // If import root is overridden, use it
                            importRoot = this.importRoot;
                        else { // Otherwise compute from filename
                            if (filename.indexOf("/") >= 0) { // Unix
                                importRoot = filename.replace(/\/[^\/]*$/, "");
                                if (/* /file.proto */ importRoot === "")
                                    importRoot = "/";
                            } else if (filename.indexOf("\\") >= 0) { // Windows
                                importRoot = filename.replace(/\\[^\\]*$/, "");
                                delim = '\\';
                            } else
                                importRoot = ".";
                        }
                    } else
                        importRoot = null;

                    for (var i=0; i<json['imports'].length; i++) {
                        if (typeof json['imports'][i] === 'string') { // Import file
                            if (!importRoot)
                                throw Error("Cannot determine import root: File name is unknown");
                            var importFilename = json['imports'][i];
                            if (/^google\/protobuf\//.test(importFilename))
                                continue; // Not needed and therefore not used
                            importFilename = importRoot+delim+importFilename;
                            if (this.files[importFilename] === true)
                                continue; // Already imported
                            if (/\.proto$/i.test(importFilename) && !ProtoBuf.DotProto)     // If this is a NOPARSE build
                                importFilename = importFilename.replace(/\.proto$/, ".json"); // always load the JSON file
                            var contents = ProtoBuf.Util.fetch(importFilename);
                            if (contents === null)
                                throw Error("Failed to import '"+importFilename+"' in '"+filename+"': File not found");
                            if (/\.json$/i.test(importFilename)) // Always possible
                                this["import"](JSON.parse(contents+""), importFilename); // May throw
                            else
                                this["import"]((new ProtoBuf.DotProto.Parser(contents+"")).parse(), importFilename); // May throw
                        } else // Import structure
                            if (!filename)
                                this["import"](json['imports'][i]);
                            else if (/\.(\w+)$/.test(filename)) // With extension: Append _importN to the name portion to make it unique
                                this["import"](json['imports'][i], filename.replace(/^(.+)\.(\w+)$/, function($0, $1, $2) { return $1+"_import"+i+"."+$2; }));
                            else // Without extension: Append _importN to make it unique
                                this["import"](json['imports'][i], filename+"_import"+i);
                    }
                    if (resetRoot) // Reset import root override when all imports are done
                        this.importRoot = null;
                }
                if (json['messages']) {
                    if (json['package'])
                        this.define(json['package'], json["options"]);
                    this.create(json['messages']);
                    this.reset();
                }
                if (json['enums']) {
                    if (json['package'])
                        this.define(json['package'], json["options"]);
                    this.create(json['enums']);
                    this.reset();
                }
                if (json['services']) {
                    if (json['package'])
                        this.define(json['package'], json["options"]);
                    this.create(json['services']);
                    this.reset();
                }
                if (json['extends']) {
                    if (json['package'])
                        this.define(json['package'], json["options"]);
                    this.create(json['extends']);
                    this.reset();
                }
                return this;
            };

            /**
             * Tests if a definition is a valid service definition.
             * @param {Object} def Definition
             * @return {boolean} true if valid, else false
             * @expose
             */
            Builder.isValidService = function(def) {
                // Services require a string name and an rpc object
                return !(typeof def["name"] !== 'string' || !Lang.NAME.test(def["name"]) || typeof def["rpc"] !== 'object');
            };

            /**
             * Tests if a definition is a valid extension.
             * @param {Object} def Definition
             * @returns {boolean} true if valid, else false
             * @expose
            */
            Builder.isValidExtend = function(def) {
                if (typeof def["ref"] !== 'string' || !Lang.TYPEREF.test(def["ref"]))
                    return false;
                var i;
                if (typeof def["fields"] !== 'undefined') {
                    if (!ProtoBuf.Util.isArray(def["fields"]))
                        return false;
                    var ids = [], id; // IDs must be unique (does not yet test for the extended message's ids)
                    for (i=0; i<def["fields"].length; i++) {
                        if (!Builder.isValidMessageField(def["fields"][i]))
                            return false;
                        id = parseInt(def["id"], 10);
                        if (ids.indexOf(id) >= 0)
                            return false;
                        ids.push(id);
                    }
                    ids = null;
                }
                return true;
            };

            /**
             * Resolves all namespace objects.
             * @throws {Error} If a type cannot be resolved
             * @expose
             */
            Builder.prototype.resolveAll = function() {
                // Resolve all reflected objects
                var res;
                if (this.ptr == null || typeof this.ptr.type === 'object')
                    return; // Done (already resolved)
                if (this.ptr instanceof Reflect.Namespace) {
                    // Build all children
                    var children = this.ptr.getChildren();
                    for (var i=0; i<children.length; i++)
                        this.ptr = children[i], this.resolveAll();
                } else if (this.ptr instanceof Reflect.Message.Field) {
                    if (!Lang.TYPE.test(this.ptr.type)) { // Resolve type...
                        if (!Lang.TYPEREF.test(this.ptr.type))
                            throw Error("Illegal type reference in "+this.ptr.toString(true)+": "+this.ptr.type);
                        res = this.ptr.parent.resolve(this.ptr.type, true);
                        if (!res)
                            throw Error("Unresolvable type reference in "+this.ptr.toString(true)+": "+this.ptr.type);
                        this.ptr.resolvedType = res;
                        if (res instanceof Reflect.Enum)
                            this.ptr.type = ProtoBuf.TYPES["enum"];
                        else if (res instanceof Reflect.Message)
                            this.ptr.type = res.isGroup ? ProtoBuf.TYPES["group"] : ProtoBuf.TYPES["message"];
                        else
                            throw Error("Illegal type reference in "+this.ptr.toString(true)+": "+this.ptr.type);
                    } else
                        this.ptr.type = ProtoBuf.TYPES[this.ptr.type];
                } else if (this.ptr instanceof ProtoBuf.Reflect.Enum.Value) {
                    // No need to build enum values (built in enum)
                } else if (this.ptr instanceof ProtoBuf.Reflect.Service.Method) {
                    if (this.ptr instanceof ProtoBuf.Reflect.Service.RPCMethod) {
                        res = this.ptr.parent.resolve(this.ptr.requestName);
                        if (!res || !(res instanceof ProtoBuf.Reflect.Message))
                            throw Error("Illegal type reference in "+this.ptr.toString(true)+": "+this.ptr.requestName);
                        this.ptr.resolvedRequestType = res;
                        res = this.ptr.parent.resolve(this.ptr.responseName);
                        if (!res || !(res instanceof ProtoBuf.Reflect.Message))
                            throw Error("Illegal type reference in "+this.ptr.toString(true)+": "+this.ptr.responseName);
                        this.ptr.resolvedResponseType = res;
                    } else {
                        // Should not happen as nothing else is implemented
                        throw Error("Illegal service type in "+this.ptr.toString(true));
                    }
                } else
                    throw Error("Illegal object in namespace: "+typeof(this.ptr)+":"+this.ptr);
                this.reset();
            };

            /**
             * Builds the protocol. This will first try to resolve all definitions and, if this has been successful,
             * return the built package.
             * @param {string=} path Specifies what to return. If omitted, the entire namespace will be returned.
             * @return {ProtoBuf.Builder.Message|Object.<string,*>}
             * @throws {Error} If a type could not be resolved
             * @expose
             */
            Builder.prototype.build = function(path) {
                this.reset();
                if (!this.resolved)
                    this.resolveAll(),
                    this.resolved = true,
                    this.result = null; // Require re-build
                if (this.result == null) // (Re-)Build
                    this.result = this.ns.build();
                if (!path)
                    return this.result;
                else {
                    var part = path.split(".");
                    var ptr = this.result; // Build namespace pointer (no hasChild etc.)
                    for (var i=0; i<part.length; i++)
                        if (ptr[part[i]])
                            ptr = ptr[part[i]];
                        else {
                            ptr = null;
                            break;
                        }
                    return ptr;
                }
            };

            /**
             * Similar to {@link ProtoBuf.Builder#build}, but looks up the internal reflection descriptor.
             * @param {string=} path Specifies what to return. If omitted, the entire namespace wiil be returned.
             * @return {ProtoBuf.Reflect.T} Reflection descriptor or `null` if not found
             */
            Builder.prototype.lookup = function(path) {
                return path ? this.ns.resolve(path) : this.ns;
            };

            /**
             * Returns a string representation of this object.
             * @return {string} String representation as of "Builder"
             * @expose
             */
            Builder.prototype.toString = function() {
                return "Builder";
            };

            // Pseudo types documented in Reflect.js.
            // Exist for the sole purpose of being able to "... instanceof ProtoBuf.Builder.Message" etc.
            Builder.Message = function() {};
            Builder.Service = function() {};

            return Builder;

        })(ProtoBuf, ProtoBuf.Lang, ProtoBuf.Reflect);


        /**
         * Loads a .proto string and returns the Builder.
         * @param {string} proto .proto file contents
         * @param {(ProtoBuf.Builder|string|{root: string, file: string})=} builder Builder to append to. Will create a new one if omitted.
         * @param {(string|{root: string, file: string})=} filename The corresponding file name if known. Must be specified for imports.
         * @return {ProtoBuf.Builder} Builder to create new messages
         * @throws {Error} If the definition cannot be parsed or built
         * @expose
         */
        ProtoBuf.loadProto = function(proto, builder, filename) {
            if (typeof builder === 'string' || (builder && typeof builder["file"] === 'string' && typeof builder["root"] === 'string')) {
                filename = builder;
                builder = null;
            }
            return ProtoBuf.loadJson((new ProtoBuf.DotProto.Parser(proto)).parse(), builder, filename);
        };

        /**
         * Loads a .proto string and returns the Builder. This is an alias of {@link ProtoBuf.loadProto}.
         * @function
         * @param {string} proto .proto file contents
         * @param {(ProtoBuf.Builder|string)=} builder Builder to append to. Will create a new one if omitted.
         * @param {(string|{root: string, file: string})=} filename The corresponding file name if known. Must be specified for imports.
         * @return {ProtoBuf.Builder} Builder to create new messages
         * @throws {Error} If the definition cannot be parsed or built
         * @expose
         */
        ProtoBuf.protoFromString = ProtoBuf.loadProto; // Legacy

        /**
         * Loads a .proto file and returns the Builder.
         * @param {string|{root: string, file: string}} filename Path to proto file or an object specifying 'file' with
         *  an overridden 'root' path for all imported files.
         * @param {function(?Error, !ProtoBuf.Builder=)=} callback Callback that will receive `null` as the first and
         *  the Builder as its second argument on success, otherwise the error as its first argument. If omitted, the
         *  file will be read synchronously and this function will return the Builder.
         * @param {ProtoBuf.Builder=} builder Builder to append to. Will create a new one if omitted.
         * @return {?ProtoBuf.Builder|undefined} The Builder if synchronous (no callback specified, will be NULL if the
         *   request has failed), else undefined
         * @expose
         */
        ProtoBuf.loadProtoFile = function(filename, callback, builder) {
            if (callback && typeof callback === 'object')
                builder = callback,
                callback = null;
            else if (!callback || typeof callback !== 'function')
                callback = null;
            if (callback)
                return ProtoBuf.Util.fetch(typeof filename === 'string' ? filename : filename["root"]+"/"+filename["file"], function(contents) {
                    if (contents === null) {
                        callback(Error("Failed to fetch file"));
                        return;
                    }
                    try {
                        callback(null, ProtoBuf.loadProto(contents, builder, filename));
                    } catch (e) {
                        callback(e);
                    }
                });
            var contents = ProtoBuf.Util.fetch(typeof filename === 'object' ? filename["root"]+"/"+filename["file"] : filename);
            return contents === null ? null : ProtoBuf.loadProto(contents, builder, filename);
        };

        /**
         * Loads a .proto file and returns the Builder. This is an alias of {@link ProtoBuf.loadProtoFile}.
         * @function
         * @param {string|{root: string, file: string}} filename Path to proto file or an object specifying 'file' with
         *  an overridden 'root' path for all imported files.
         * @param {function(?Error, !ProtoBuf.Builder=)=} callback Callback that will receive `null` as the first and
         *  the Builder as its second argument on success, otherwise the error as its first argument. If omitted, the
         *  file will be read synchronously and this function will return the Builder.
         * @param {ProtoBuf.Builder=} builder Builder to append to. Will create a new one if omitted.
         * @return {!ProtoBuf.Builder|undefined} The Builder if synchronous (no callback specified, will be NULL if the
         *   request has failed), else undefined
         * @expose
         */
        ProtoBuf.protoFromFile = ProtoBuf.loadProtoFile; // Legacy


        /**
         * Constructs a new Builder with the specified package defined.
         * @param {string=} pkg Package name as fully qualified name, e.g. "My.Game". If no package is specified, the
         * builder will only contain a global namespace.
         * @param {Object.<string,*>=} options Top level options
         * @return {ProtoBuf.Builder} New Builder
         * @expose
         */
        ProtoBuf.newBuilder = function(pkg, options) {
            var builder = new ProtoBuf.Builder();
            if (typeof pkg !== 'undefined' && pkg !== null)
                builder.define(pkg, options);
            return builder;
        };

        /**
         * Loads a .json definition and returns the Builder.
         * @param {!*|string} json JSON definition
         * @param {(ProtoBuf.Builder|string|{root: string, file: string})=} builder Builder to append to. Will create a new one if omitted.
         * @param {(string|{root: string, file: string})=} filename The corresponding file name if known. Must be specified for imports.
         * @return {ProtoBuf.Builder} Builder to create new messages
         * @throws {Error} If the definition cannot be parsed or built
         * @expose
         */
        ProtoBuf.loadJson = function(json, builder, filename) {
            if (typeof builder === 'string' || (builder && typeof builder["file"] === 'string' && typeof builder["root"] === 'string'))
                filename = builder,
                builder = null;
            if (!builder || typeof builder !== 'object')
                builder = ProtoBuf.newBuilder();
            if (typeof json === 'string')
                json = JSON.parse(json);
            builder["import"](json, filename);
            builder.resolveAll();
            builder.build();
            return builder;
        };

        /**
         * Loads a .json file and returns the Builder.
         * @param {string|!{root: string, file: string}} filename Path to json file or an object specifying 'file' with
         *  an overridden 'root' path for all imported files.
         * @param {function(?Error, !ProtoBuf.Builder=)=} callback Callback that will receive `null` as the first and
         *  the Builder as its second argument on success, otherwise the error as its first argument. If omitted, the
         *  file will be read synchronously and this function will return the Builder.
         * @param {ProtoBuf.Builder=} builder Builder to append to. Will create a new one if omitted.
         * @return {?ProtoBuf.Builder|undefined} The Builder if synchronous (no callback specified, will be NULL if the
         *   request has failed), else undefined
         * @expose
         */
        ProtoBuf.loadJsonFile = function(filename, callback, builder) {
            if (callback && typeof callback === 'object')
                builder = callback,
                callback = null;
            else if (!callback || typeof callback !== 'function')
                callback = null;
            if (callback)
                return ProtoBuf.Util.fetch(typeof filename === 'string' ? filename : filename["root"]+"/"+filename["file"], function(contents) {
                    if (contents === null) {
                        callback(Error("Failed to fetch file"));
                        return;
                    }
                    try {
                        callback(null, ProtoBuf.loadJson(JSON.parse(contents), builder, filename));
                    } catch (e) {
                        callback(e);
                    }
                });
            var contents = ProtoBuf.Util.fetch(typeof filename === 'object' ? filename["root"]+"/"+filename["file"] : filename);
            return contents === null ? null : ProtoBuf.loadJson(JSON.parse(contents), builder, filename);
        };

        return ProtoBuf;
    }

    /* CommonJS */ if (typeof module !== 'undefined' && module["exports"])
        module["exports"] = init(_dereq_("bytebuffer"));
    /* AMD */ else if (typeof define === 'function' && define["amd"])
        define(["ByteBuffer"], init);
    /* Global */ else
        (global["dcodeIO"] = global["dcodeIO"] || {})["ProtoBuf"] = init(global["dcodeIO"]["ByteBuffer"]);

})(this);

},{"bytebuffer":19,"fs":14,"path":15}],18:[function(_dereq_,module,exports){
/*
 Copyright 2013 Daniel Wirtz <dcode@dcode.io>

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
var ProtoBuf = _dereq_("./dist/ProtoBuf.js");

module.exports = ProtoBuf;

},{"./dist/ProtoBuf.js":17}],19:[function(_dereq_,module,exports){
/*
 ByteBuffer.js (c) 2013-2014 Daniel Wirtz <dcode@dcode.io>
 This version of ByteBuffer.js uses an ArrayBuffer (AB) as its backing buffer and is compatible with modern browsers.
 Released under the Apache License, Version 2.0
 see: https://github.com/dcodeIO/ByteBuffer.js for details
*/
(function(r){function s(l){function d(a,b,c){"undefined"===typeof a&&(a=d.DEFAULT_CAPACITY);"undefined"===typeof b&&(b=d.DEFAULT_ENDIAN);"undefined"===typeof c&&(c=d.DEFAULT_NOASSERT);if(!c){a|=0;if(0>a)throw new RangeError("Illegal capacity: 0 <= "+a);if("boolean"!==typeof b)throw new TypeError("Illegal littleEndian: Not a boolean");if("boolean"!==typeof c)throw new TypeError("Illegal noAssert: Not a boolean");}this.buffer=0===a?r:new ArrayBuffer(a);this.view=0===a?null:new DataView(this.buffer);
this.offset=0;this.markedOffset=-1;this.limit=a;this.littleEndian="undefined"!==typeof b?!!b:!1;this.noAssert=!!c}d.VERSION="3.1.0";d.LITTLE_ENDIAN=!0;d.BIG_ENDIAN=!1;d.DEFAULT_CAPACITY=16;d.DEFAULT_ENDIAN=d.BIG_ENDIAN;d.DEFAULT_NOASSERT=!1;d.Long=l||null;var r=new ArrayBuffer(0);d.allocate=function(a,b,c){return new d(a,b,c)};d.concat=function(a,b,c,e){if("boolean"===typeof b||"string"!==typeof b)e=c,c=b,b=void 0;for(var h=0,f=0,g=a.length,n;f<g;++f)d.isByteBuffer(a[f])||(a[f]=d.wrap(a[f],b)),n=
a[f].limit-a[f].offset,0<n&&(h+=n);if(0===h)return new d(0,c,e);b=new d(h,c,e);e=new Uint8Array(b.buffer);for(f=0;f<g;)c=a[f++],n=c.limit-c.offset,0>=n||(e.set((new Uint8Array(c.buffer)).subarray(c.offset,c.limit),b.offset),b.offset+=n);b.limit=b.offset;b.offset=0;return b};d.isByteBuffer=function(a){return a&&a instanceof d};d.type=function(){return ArrayBuffer};d.wrap=function(a,b,c,e){"string"!==typeof b&&(e=c,c=b,b=void 0);if("string"===typeof a)switch("undefined"===typeof b&&(b="utf8"),b){case "base64":return d.fromBase64(a,
c);case "hex":return d.fromHex(a,c);case "binary":return d.fromBinary(a,c);case "utf8":return d.fromUTF8(a,c);case "debug":return d.fromDebug(a,c);default:throw new TypeError("Unsupported encoding: "+b);}if(null===a||"object"!==typeof a)throw new TypeError("Illegal buffer: null or non-object");if(d.isByteBuffer(a))return b=d.prototype.clone.call(a),b.markedOffset=-1,b;if(a instanceof Uint8Array)b=new d(0,c,e),0<a.length&&(b.buffer=a.buffer,b.offset=a.byteOffset,b.limit=a.byteOffset+a.length,b.view=
0<a.length?new DataView(a.buffer):null);else if(a instanceof ArrayBuffer)b=new d(0,c,e),0<a.byteLength&&(b.buffer=a,b.offset=0,b.limit=a.byteLength,b.view=0<a.byteLength?new DataView(a):null);else if("[object Array]"===Object.prototype.toString.call(a))for(b=new d(a.length,c,e),b.limit=a.length,i=0;i<a.length;++i)b.view.setUint8(i,a[i]);else throw new TypeError("Illegal buffer");return b};d.prototype.writeInt8=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"!==
typeof a||0!==a%1)throw new TypeError("Illegal value: "+a+" (not an integer)");a|=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}b+=1;var e=this.buffer.byteLength;b>e&&this.resize((e*=2)>b?e:b);this.view.setInt8(b-1,a);c&&(this.offset+=1);return this};d.prototype.writeByte=d.prototype.writeInt8;d.prototype.readInt8=function(a){var b=
"undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||a+1>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+1) <= "+this.buffer.byteLength);}a=this.view.getInt8(a);b&&(this.offset+=1);return a};d.prototype.readByte=d.prototype.readInt8;d.prototype.writeUint8=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"!==typeof a||
0!==a%1)throw new TypeError("Illegal value: "+a+" (not an integer)");a>>>=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}b+=1;var e=this.buffer.byteLength;b>e&&this.resize((e*=2)>b?e:b);this.view.setUint8(b-1,a);c&&(this.offset+=1);return this};d.prototype.readUint8=function(a){var b="undefined"===typeof a;b&&(a=this.offset);
if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||a+1>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+1) <= "+this.buffer.byteLength);}a=this.view.getUint8(a);b&&(this.offset+=1);return a};d.prototype.writeInt16=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal value: "+a+" (not an integer)");a|=0;if("number"!==
typeof b||0!==b%1)throw new TypeError("Illegal offset: "+b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}b+=2;var e=this.buffer.byteLength;b>e&&this.resize((e*=2)>b?e:b);this.view.setInt16(b-2,a,this.littleEndian);c&&(this.offset+=2);return this};d.prototype.writeShort=d.prototype.writeInt16;d.prototype.readInt16=function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==
typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||a+2>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+2) <= "+this.buffer.byteLength);}a=this.view.getInt16(a,this.littleEndian);b&&(this.offset+=2);return a};d.prototype.readShort=d.prototype.readInt16;d.prototype.writeUint16=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal value: "+a+" (not an integer)");
a>>>=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}b+=2;var e=this.buffer.byteLength;b>e&&this.resize((e*=2)>b?e:b);this.view.setUint16(b-2,a,this.littleEndian);c&&(this.offset+=2);return this};d.prototype.readUint16=function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%
1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||a+2>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+2) <= "+this.buffer.byteLength);}a=this.view.getUint16(a,this.littleEndian);b&&(this.offset+=2);return a};d.prototype.writeInt32=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal value: "+a+" (not an integer)");a|=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+
b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}b+=4;var e=this.buffer.byteLength;b>e&&this.resize((e*=2)>b?e:b);this.view.setInt32(b-4,a,this.littleEndian);c&&(this.offset+=4);return this};d.prototype.writeInt=d.prototype.writeInt32;d.prototype.readInt32=function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+
a+" (not an integer)");a>>>=0;if(0>a||a+4>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+4) <= "+this.buffer.byteLength);}a=this.view.getInt32(a,this.littleEndian);b&&(this.offset+=4);return a};d.prototype.readInt=d.prototype.readInt32;d.prototype.writeUint32=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal value: "+a+" (not an integer)");a>>>=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+
b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}b+=4;var e=this.buffer.byteLength;b>e&&this.resize((e*=2)>b?e:b);this.view.setUint32(b-4,a,this.littleEndian);c&&(this.offset+=4);return this};d.prototype.readUint32=function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||
a+4>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+4) <= "+this.buffer.byteLength);}a=this.view.getUint32(a,this.littleEndian);b&&(this.offset+=4);return a};l&&(d.prototype.writeInt64=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"===typeof a)a=l.fromNumber(a);else if(!(a&&a instanceof l))throw new TypeError("Illegal value: "+a+" (not an integer or Long)");if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+
b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}"number"===typeof a&&(a=l.fromNumber(a));b+=8;var e=this.buffer.byteLength;b>e&&this.resize((e*=2)>b?e:b);b-=8;this.littleEndian?(this.view.setInt32(b,a.low,!0),this.view.setInt32(b+4,a.high,!0)):(this.view.setInt32(b,a.high,!1),this.view.setInt32(b+4,a.low,!1));c&&(this.offset+=8);return this},d.prototype.writeLong=d.prototype.writeInt64,d.prototype.readInt64=
function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||a+8>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+8) <= "+this.buffer.byteLength);}a=this.littleEndian?new l(this.view.getInt32(a,!0),this.view.getInt32(a+4,!0),!1):new l(this.view.getInt32(a+4,!1),this.view.getInt32(a,!1),!1);b&&(this.offset+=8);return a},d.prototype.readLong=d.prototype.readInt64,
d.prototype.writeUint64=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"===typeof a)a=l.fromNumber(a);else if(!(a&&a instanceof l))throw new TypeError("Illegal value: "+a+" (not an integer or Long)");if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}"number"===typeof a&&(a=l.fromNumber(a));
b+=8;var e=this.buffer.byteLength;b>e&&this.resize((e*=2)>b?e:b);b-=8;this.littleEndian?(this.view.setInt32(b,a.low,!0),this.view.setInt32(b+4,a.high,!0)):(this.view.setInt32(b,a.high,!1),this.view.setInt32(b+4,a.low,!1));c&&(this.offset+=8);return this},d.prototype.readUint64=function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||a+8>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+
a+" (+8) <= "+this.buffer.byteLength);}a=this.littleEndian?new l(this.view.getInt32(a,!0),this.view.getInt32(a+4,!0),!0):new l(this.view.getInt32(a+4,!1),this.view.getInt32(a,!1),!0);b&&(this.offset+=8);return a});d.prototype.writeFloat32=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"!==typeof a)throw new TypeError("Illegal value: "+a+" (not a number)");if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+b+" (not an integer)");b>>>=
0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}b+=4;var e=this.buffer.byteLength;b>e&&this.resize((e*=2)>b?e:b);this.view.setFloat32(b-4,a,this.littleEndian);c&&(this.offset+=4);return this};d.prototype.writeFloat=d.prototype.writeFloat32;d.prototype.readFloat32=function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");
a>>>=0;if(0>a||a+4>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+4) <= "+this.buffer.byteLength);}a=this.view.getFloat32(a,this.littleEndian);b&&(this.offset+=4);return a};d.prototype.readFloat=d.prototype.readFloat32;d.prototype.writeFloat64=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"!==typeof a)throw new TypeError("Illegal value: "+a+" (not a number)");if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+
b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}b+=8;var e=this.buffer.byteLength;b>e&&this.resize((e*=2)>b?e:b);this.view.setFloat64(b-8,a,this.littleEndian);c&&(this.offset+=8);return this};d.prototype.writeDouble=d.prototype.writeFloat64;d.prototype.readFloat64=function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+
a+" (not an integer)");a>>>=0;if(0>a||a+8>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+8) <= "+this.buffer.byteLength);}a=this.view.getFloat64(a,this.littleEndian);b&&(this.offset+=8);return a};d.prototype.readDouble=d.prototype.readFloat64;d.MAX_VARINT32_BYTES=5;d.calculateVarint32=function(a){a>>>=0;return 128>a?1:16384>a?2:2097152>a?3:268435456>a?4:5};d.zigZagEncode32=function(a){return((a|=0)<<1^a>>31)>>>0};d.zigZagDecode32=function(a){return a>>>1^-(a&1)|0};d.prototype.writeVarint32=
function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal value: "+a+" (not an integer)");a|=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}var e=d.calculateVarint32(a);b+=e;var h=this.buffer.byteLength;b>h&&this.resize((h*=2)>b?h:b);b-=e;this.view.setUint8(b,
e=a|128);a>>>=0;128<=a?(e=a>>7|128,this.view.setUint8(b+1,e),16384<=a?(e=a>>14|128,this.view.setUint8(b+2,e),2097152<=a?(e=a>>21|128,this.view.setUint8(b+3,e),268435456<=a?(this.view.setUint8(b+4,a>>28&15),e=5):(this.view.setUint8(b+3,e&127),e=4)):(this.view.setUint8(b+2,e&127),e=3)):(this.view.setUint8(b+1,e&127),e=2)):(this.view.setUint8(b,e&127),e=1);return c?(this.offset+=e,this):e};d.prototype.writeVarint32ZigZag=function(a,b){return this.writeVarint32(d.zigZagEncode32(a),b)};d.prototype.readVarint32=
function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||a+1>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+1) <= "+this.buffer.byteLength);}var c=0,e=0,d;do d=this.view.getUint8(a+c),5>c&&(e|=(d&127)<<7*c>>>0),++c;while(128===(d&128));e|=0;return b?(this.offset+=c,e):{value:e,length:c}};d.prototype.readVarint32ZigZag=function(a){a=this.readVarint32(a);
"object"===typeof a?a.value=d.zigZagDecode32(a.value):a=d.zigZagDecode32(a);return a};l&&(d.MAX_VARINT64_BYTES=10,d.calculateVarint64=function(a){"number"===typeof a&&(a=l.fromNumber(a));var b=a.toInt()>>>0,c=a.shiftRightUnsigned(28).toInt()>>>0;a=a.shiftRightUnsigned(56).toInt()>>>0;return 0==a?0==c?16384>b?128>b?1:2:2097152>b?3:4:16384>c?128>c?5:6:2097152>c?7:8:128>a?9:10},d.zigZagEncode64=function(a){"number"===typeof a?a=l.fromNumber(a,!1):!1!==a.unsigned&&(a=a.toSigned());return a.shiftLeft(1).xor(a.shiftRight(63)).toUnsigned()},
d.zigZagDecode64=function(a){"number"===typeof a?a=l.fromNumber(a,!1):!1!==a.unsigned&&(a=a.toSigned());return a.shiftRightUnsigned(1).xor(a.and(l.ONE).toSigned().negate()).toSigned()},d.prototype.writeVarint64=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"===typeof a)a=l.fromNumber(a);else if(!(a&&a instanceof l))throw new TypeError("Illegal value: "+a+" (not an integer or Long)");if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+
b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}"number"===typeof a?a=l.fromNumber(a,!1):!1!==a.unsigned&&(a=a.toSigned());var e=d.calculateVarint64(a),h=a.toInt()>>>0,f=a.shiftRightUnsigned(28).toInt()>>>0,g=a.shiftRightUnsigned(56).toInt()>>>0;b+=e;var n=this.buffer.byteLength;b>n&&this.resize((n*=2)>b?n:b);b-=e;switch(e){case 10:this.view.setUint8(b+9,g>>>7&1);case 9:this.view.setUint8(b+8,9!==
e?g|128:g&127);case 8:this.view.setUint8(b+7,8!==e?f>>>21|128:f>>>21&127);case 7:this.view.setUint8(b+6,7!==e?f>>>14|128:f>>>14&127);case 6:this.view.setUint8(b+5,6!==e?f>>>7|128:f>>>7&127);case 5:this.view.setUint8(b+4,5!==e?f|128:f&127);case 4:this.view.setUint8(b+3,4!==e?h>>>21|128:h>>>21&127);case 3:this.view.setUint8(b+2,3!==e?h>>>14|128:h>>>14&127);case 2:this.view.setUint8(b+1,2!==e?h>>>7|128:h>>>7&127);case 1:this.view.setUint8(b,1!==e?h|128:h&127)}return c?(this.offset+=e,this):e},d.prototype.writeVarint64ZigZag=
function(a,b){return this.writeVarint64(d.zigZagEncode64(a),b)},d.prototype.readVarint64=function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||a+1>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+1) <= "+this.buffer.byteLength);}var c=a,e=0,d=0,f=0,g=0,g=this.view.getUint8(a++),e=g&127;if(g&128&&(g=this.view.getUint8(a++),e|=(g&127)<<7,g&128&&
(g=this.view.getUint8(a++),e|=(g&127)<<14,g&128&&(g=this.view.getUint8(a++),e|=(g&127)<<21,g&128&&(g=this.view.getUint8(a++),d=g&127,g&128&&(g=this.view.getUint8(a++),d|=(g&127)<<7,g&128&&(g=this.view.getUint8(a++),d|=(g&127)<<14,g&128&&(g=this.view.getUint8(a++),d|=(g&127)<<21,g&128&&(g=this.view.getUint8(a++),f=g&127,g&128&&(g=this.view.getUint8(a++),f|=(g&127)<<7,g&128))))))))))throw Error("Data must be corrupt: Buffer overrun");e=l.from28Bits(e,d,f,!1);return b?(this.offset=a,e):{value:e,length:a-
c}},d.prototype.readVarint64ZigZag=function(a){(a=this.readVarint64(a))&&a.value instanceof l?a.value=d.zigZagDecode64(a.value):a=d.zigZagDecode64(a);return a});d.prototype.writeCString=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);var e,d=a.length;if(!this.noAssert){if("string"!==typeof a)throw new TypeError("Illegal str: Not a string");for(e=0;e<d;++e)if(0===a.charCodeAt(e))throw new RangeError("Illegal str: Contains NULL-characters");if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+
b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}e=b;d=k.b(k.a(a))[1];b+=d+1;var f=this.buffer.byteLength;b>f&&this.resize((f*=2)>b?f:b);b-=d+1;k.e(k.a(a),function(a){this.view.setUint8(b++,a)}.bind(this));this.view.setUint8(b++,0);return c?(this.offset=b-e,this):d};d.prototype.readCString=function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+
a+" (not an integer)");a>>>=0;if(0>a||a+1>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+1) <= "+this.buffer.byteLength);}var c=a,e,d=-1;k.d(function(){if(0===d)return null;if(a>=this.limit)throw RangeError("Illegal range: Truncated data, "+a+" < "+this.limit);return 0===(d=this.view.getUint8(a++))?null:d}.bind(this),e=k.c(),!0);return b?(this.offset=a,e()):{string:e(),length:a-c}};d.prototype.writeIString=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("string"!==
typeof a)throw new TypeError("Illegal str: Not a string");if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}var e=b,d;d=k.b(k.a(a),this.noAssert)[1];b+=4+d;var f=this.buffer.byteLength;b>f&&this.resize((f*=2)>b?f:b);b-=4+d;this.view.setUint32(b,d,this.littleEndian);b+=4;k.e(k.a(a),function(a){this.view.setUint8(b++,a)}.bind(this));
if(b!==e+4+d)throw new RangeError("Illegal range: Truncated data, "+b+" == "+(b+4+d));return c?(this.offset=b,this):b-e};d.prototype.readIString=function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||a+4>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+4) <= "+this.buffer.byteLength);}var c=0,e=a,c=this.view.getUint32(a,this.littleEndian);a+=
4;var d=a+c;k.d(function(){return a<d?this.view.getUint8(a++):null}.bind(this),c=k.c(),this.noAssert);c=c();return b?(this.offset=a,c):{string:c,length:a-e}};d.METRICS_CHARS="c";d.METRICS_BYTES="b";d.prototype.writeUTF8String=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+b+" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+
this.buffer.byteLength);}var e,d=b;e=k.b(k.a(a))[1];b+=e;var f=this.buffer.byteLength;b>f&&this.resize((f*=2)>b?f:b);b-=e;k.e(k.a(a),function(a){this.view.setUint8(b++,a)}.bind(this));return c?(this.offset=b,this):b-d};d.prototype.writeString=d.prototype.writeUTF8String;d.calculateUTF8Chars=function(a){return k.b(k.a(a))[0]};d.calculateUTF8Bytes=function(a){return k.b(k.a(a))[1]};d.prototype.readUTF8String=function(a,b,c){"number"===typeof b&&(c=b,b=void 0);var e="undefined"===typeof c;e&&(c=this.offset);
"undefined"===typeof b&&(b=d.METRICS_CHARS);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal length: "+a+" (not an integer)");a|=0;if("number"!==typeof c||0!==c%1)throw new TypeError("Illegal offset: "+c+" (not an integer)");c>>>=0;if(0>c||c+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+c+" (+0) <= "+this.buffer.byteLength);}var h=0,f=c,g;if(b===d.METRICS_CHARS){g=k.c();k.i(function(){return h<a&&c<this.limit?this.view.getUint8(c++):null}.bind(this),
function(a){++h;k.g(a,g)}.bind(this));if(h!==a)throw new RangeError("Illegal range: Truncated data, "+h+" == "+a);return e?(this.offset=c,g()):{string:g(),length:c-f}}if(b===d.METRICS_BYTES){if(!this.noAssert){if("number"!==typeof c||0!==c%1)throw new TypeError("Illegal offset: "+c+" (not an integer)");c>>>=0;if(0>c||c+a>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+c+" (+"+a+") <= "+this.buffer.byteLength);}var n=c+a;k.d(function(){return c<n?this.view.getUint8(c++):null}.bind(this),
g=k.c(),this.noAssert);if(c!==n)throw new RangeError("Illegal range: Truncated data, "+c+" == "+n);return e?(this.offset=c,g()):{string:g(),length:c-f}}throw new TypeError("Unsupported metrics: "+b);};d.prototype.readString=d.prototype.readUTF8String;d.prototype.writeVString=function(a,b){var c="undefined"===typeof b;c&&(b=this.offset);if(!this.noAssert){if("string"!==typeof a)throw new TypeError("Illegal str: Not a string");if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: "+b+
" (not an integer)");b>>>=0;if(0>b||b+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+b+" (+0) <= "+this.buffer.byteLength);}var e=b,h,f;h=k.b(k.a(a),this.noAssert)[1];f=d.calculateVarint32(h);b+=f+h;var g=this.buffer.byteLength;b>g&&this.resize((g*=2)>b?g:b);b-=f+h;b+=this.writeVarint32(h,b);k.e(k.a(a),function(a){this.view.setUint8(b++,a)}.bind(this));if(b!==e+h+f)throw new RangeError("Illegal range: Truncated data, "+b+" == "+(b+h+f));return c?(this.offset=b,this):b-e};d.prototype.readVString=
function(a){var b="undefined"===typeof a;b&&(a=this.offset);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||a+1>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+1) <= "+this.buffer.byteLength);}var c=this.readVarint32(a),e=a;a+=c.length;var c=c.value,d=a+c,c=k.c();k.d(function(){return a<d?this.view.getUint8(a++):null}.bind(this),c,this.noAssert);c=c();return b?(this.offset=a,c):{string:c,length:a-
e}};d.prototype.append=function(a,b,c){if("number"===typeof b||"string"!==typeof b)c=b,b=void 0;var e="undefined"===typeof c;e&&(c=this.offset);if(!this.noAssert){if("number"!==typeof c||0!==c%1)throw new TypeError("Illegal offset: "+c+" (not an integer)");c>>>=0;if(0>c||c+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+c+" (+0) <= "+this.buffer.byteLength);}a instanceof d||(a=d.wrap(a,b));b=a.limit-a.offset;if(0>=b)return this;c+=b;var h=this.buffer.byteLength;c>h&&this.resize((h*=
2)>c?h:c);(new Uint8Array(this.buffer,c-b)).set((new Uint8Array(a.buffer)).subarray(a.offset,a.limit));a.offset+=b;e&&(this.offset+=b);return this};d.prototype.appendTo=function(a,b){a.append(this,b);return this};d.prototype.assert=function(a){this.noAssert=!a;return this};d.prototype.capacity=function(){return this.buffer.byteLength};d.prototype.clear=function(){this.offset=0;this.limit=this.buffer.byteLength;this.markedOffset=-1;return this};d.prototype.clone=function(a){var b=new d(0,this.littleEndian,
this.noAssert);a?(a=new ArrayBuffer(this.buffer.byteLength),(new Uint8Array(a)).set(this.buffer),b.buffer=a,b.view=new DataView(a)):(b.buffer=this.buffer,b.view=this.view);b.offset=this.offset;b.markedOffset=this.markedOffset;b.limit=this.limit;return b};d.prototype.compact=function(a,b){"undefined"===typeof a&&(a=this.offset);"undefined"===typeof b&&(b=this.limit);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal begin: Not an integer");a>>>=0;if("number"!==typeof b||
0!==b%1)throw new TypeError("Illegal end: Not an integer");b>>>=0;if(0>a||a>b||b>this.buffer.byteLength)throw new RangeError("Illegal range: 0 <= "+a+" <= "+b+" <= "+this.buffer.byteLength);}if(0===a&&b===this.buffer.byteLength)return this;var c=b-a;if(0===c)return this.buffer=r,this.view=null,0<=this.markedOffset&&(this.markedOffset-=a),this.limit=this.offset=0,this;var e=new ArrayBuffer(c);(new Uint8Array(e)).set((new Uint8Array(this.buffer)).subarray(a,b));this.buffer=e;this.view=new DataView(e);
0<=this.markedOffset&&(this.markedOffset-=a);this.offset=0;this.limit=c;return this};d.prototype.copy=function(a,b){"undefined"===typeof a&&(a=this.offset);"undefined"===typeof b&&(b=this.limit);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal begin: Not an integer");a>>>=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal end: Not an integer");b>>>=0;if(0>a||a>b||b>this.buffer.byteLength)throw new RangeError("Illegal range: 0 <= "+a+" <= "+b+" <= "+this.buffer.byteLength);
}if(a===b)return new d(0,this.littleEndian,this.noAssert);var c=b-a,e=new d(c,this.littleEndian,this.noAssert);e.offset=0;e.limit=c;0<=e.markedOffset&&(e.markedOffset-=a);this.copyTo(e,0,a,b);return e};d.prototype.copyTo=function(a,b,c,e){var h,f;if(!this.noAssert&&!d.isByteBuffer(a))throw new TypeError("Illegal target: Not a ByteBuffer");b=(f="undefined"===typeof b)?a.offset:b|0;c=(h="undefined"===typeof c)?this.offset:c|0;e="undefined"===typeof e?this.limit:e|0;if(0>b||b>a.buffer.byteLength)throw new RangeError("Illegal target range: 0 <= "+
b+" <= "+a.buffer.byteLength);if(0>c||e>this.buffer.byteLength)throw new RangeError("Illegal source range: 0 <= "+c+" <= "+this.buffer.byteLength);var g=e-c;if(0===g)return a;a.ensureCapacity(b+g);(new Uint8Array(a.buffer)).set((new Uint8Array(this.buffer)).subarray(c,e),b);h&&(this.offset+=g);f&&(a.offset+=g);return this};d.prototype.ensureCapacity=function(a){var b=this.buffer.byteLength;return b<a?this.resize((b*=2)>a?b:a):this};d.prototype.fill=function(a,b,c){var e="undefined"===typeof b;e&&
(b=this.offset);"string"===typeof a&&0<a.length&&(a=a.charCodeAt(0));"undefined"===typeof b&&(b=this.offset);"undefined"===typeof c&&(c=this.limit);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal value: "+a+" (not an integer)");a|=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal begin: Not an integer");b>>>=0;if("number"!==typeof c||0!==c%1)throw new TypeError("Illegal end: Not an integer");c>>>=0;if(0>b||b>c||c>this.buffer.byteLength)throw new RangeError("Illegal range: 0 <= "+
b+" <= "+c+" <= "+this.buffer.byteLength);}if(b>=c)return this;for(;b<c;)this.view.setUint8(b++,a);e&&(this.offset=b);return this};d.prototype.flip=function(){this.limit=this.offset;this.offset=0;return this};d.prototype.mark=function(a){a="undefined"===typeof a?this.offset:a;if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal offset: "+a+" (not an integer)");a>>>=0;if(0>a||a+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+a+" (+0) <= "+this.buffer.byteLength);
}this.markedOffset=a;return this};d.prototype.order=function(a){if(!this.noAssert&&"boolean"!==typeof a)throw new TypeError("Illegal littleEndian: Not a boolean");this.littleEndian=!!a;return this};d.prototype.LE=function(a){this.littleEndian="undefined"!==typeof a?!!a:!0;return this};d.prototype.BE=function(a){this.littleEndian="undefined"!==typeof a?!a:!1;return this};d.prototype.prepend=function(a,b,c){if("number"===typeof b||"string"!==typeof b)c=b,b=void 0;var e="undefined"===typeof c;e&&(c=
this.offset);if(!this.noAssert){if("number"!==typeof c||0!==c%1)throw new TypeError("Illegal offset: "+c+" (not an integer)");c>>>=0;if(0>c||c+0>this.buffer.byteLength)throw new RangeError("Illegal offset: 0 <= "+c+" (+0) <= "+this.buffer.byteLength);}a instanceof d||(a=d.wrap(a,b));b=a.limit-a.offset;if(0>=b)return this;var h=b-c,f;if(0<h){var g=new ArrayBuffer(this.buffer.byteLength+h);f=new Uint8Array(g);f.set((new Uint8Array(this.buffer)).subarray(c,this.buffer.byteLength),b);this.buffer=g;this.view=
new DataView(g);this.offset+=h;0<=this.markedOffset&&(this.markedOffset+=h);this.limit+=h;c+=h}else f=new Uint8Array(this.buffer);f.set((new Uint8Array(a.buffer)).subarray(a.offset,a.limit),c-b);a.offset=a.limit;e&&(this.offset-=b);return this};d.prototype.prependTo=function(a,b){a.prepend(this,b);return this};d.prototype.printDebug=function(a){"function"!==typeof a&&(a=console.log.bind(console));a(this.toString()+"\n-------------------------------------------------------------------\n"+this.toDebug(!0))};
d.prototype.remaining=function(){return this.limit-this.offset};d.prototype.reset=function(){0<=this.markedOffset?(this.offset=this.markedOffset,this.markedOffset=-1):this.offset=0;return this};d.prototype.resize=function(a){if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal capacity: "+a+" (not an integer)");a|=0;if(0>a)throw new RangeError("Illegal capacity: 0 <= "+a);}this.buffer.byteLength<a&&(a=new ArrayBuffer(a),(new Uint8Array(a)).set(new Uint8Array(this.buffer)),
this.buffer=a,this.view=new DataView(a));return this};d.prototype.reverse=function(a,b){"undefined"===typeof a&&(a=this.offset);"undefined"===typeof b&&(b=this.limit);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal begin: Not an integer");a>>>=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal end: Not an integer");b>>>=0;if(0>a||a>b||b>this.buffer.byteLength)throw new RangeError("Illegal range: 0 <= "+a+" <= "+b+" <= "+this.buffer.byteLength);}if(a===b)return this;
Array.prototype.reverse.call((new Uint8Array(this.buffer)).subarray(a,b));this.view=new DataView(this.buffer);return this};d.prototype.skip=function(a){if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal length: "+a+" (not an integer)");a|=0}var b=this.offset+a;if(!this.noAssert&&(0>b||b>this.buffer.byteLength))throw new RangeError("Illegal length: 0 <= "+this.offset+" + "+a+" <= "+this.buffer.byteLength);this.offset=b;return this};d.prototype.slice=function(a,b){"undefined"===
typeof a&&(a=this.offset);"undefined"===typeof b&&(b=this.limit);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal begin: Not an integer");a>>>=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal end: Not an integer");b>>>=0;if(0>a||a>b||b>this.buffer.byteLength)throw new RangeError("Illegal range: 0 <= "+a+" <= "+b+" <= "+this.buffer.byteLength);}var c=this.clone();c.offset=a;c.limit=b;return c};d.prototype.toBuffer=function(a){var b=this.offset,c=this.limit;
if(b>c)var e=b,b=c,c=e;if(!this.noAssert){if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal offset: Not an integer");b>>>=0;if("number"!==typeof c||0!==c%1)throw new TypeError("Illegal limit: Not an integer");c>>>=0;if(0>b||b>c||c>this.buffer.byteLength)throw new RangeError("Illegal range: 0 <= "+b+" <= "+c+" <= "+this.buffer.byteLength);}if(!a&&0===b&&c===this.buffer.byteLength)return this.buffer;if(b===c)return r;a=new ArrayBuffer(c-b);(new Uint8Array(a)).set((new Uint8Array(this.buffer)).subarray(b,
c),0);return a};d.prototype.toArrayBuffer=d.prototype.toBuffer;d.prototype.toString=function(a){if("undefined"===typeof a)return"ByteBufferAB(offset="+this.offset+",markedOffset="+this.markedOffset+",limit="+this.limit+",capacity="+this.capacity()+")";switch(a){case "utf8":return this.toUTF8();case "base64":return this.toBase64();case "hex":return this.toHex();case "binary":return this.toBinary();case "debug":return this.toDebug();case "columns":return this.o();default:throw Error("Unsupported encoding: "+
a);}};var m="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",m=m+"";d.prototype.toBase64=function(a,b){"undefined"===typeof a&&(a=this.offset);"undefined"===typeof b&&(b=this.limit);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal begin: Not an integer");a>>>=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal end: Not an integer");b>>>=0;if(0>a||a>b||b>this.buffer.byteLength)throw new RangeError("Illegal range: 0 <= "+a+" <= "+b+" <= "+
this.buffer.byteLength);}if(a===b)return"";for(var c,e,d,f,g,k,l="";a<b;)c=this.view.getUint8(a++),e=(f=a<b)?this.view.getUint8(a++):0,d=(g=a<b)?this.view.getUint8(a++):0,k=c>>2,c=(c&3)<<4|e>>4,e=(e&15)<<2|d>>6,d&=63,g||(d=64,f||(e=64)),l+=m.charAt(k)+m.charAt(c)+m.charAt(e)+m.charAt(d);return l};d.fromBase64=function(a,b,c){if(!c){if("string"!==typeof a)throw new TypeError("Illegal str: Not a string");if(0!==a.length%4)throw new TypeError("Illegal str: Length not a multiple of 4");}var e=a.length,
h=0,f;for(f=a.length-1;0<=f;--f)if("="===a.charAt(f))h++;else break;if(2<h)throw new TypeError("Illegal str: Suffix is too large");if(0===e)return new d(0,b,c);var g,k,l,p=new d(e/4*3-h,b,c);for(b=f=0;f<e;){h=m.indexOf(a.charAt(f++));g=f<e?m.indexOf(a.charAt(f++)):0;k=f<e?m.indexOf(a.charAt(f++)):0;l=f<e?m.indexOf(a.charAt(f++)):0;if(!c&&(0>h||0>g||0>k||0>l))throw new TypeError("Illegal str: Contains non-base64 characters");p.view.setUint8(b++,h<<2|g>>4);64!==k&&(p.view.setUint8(b++,g<<4&240|k>>2,
b),64!==l&&p.view.setUint8(b++,k<<6&192|l))}p.limit=b;return p};d.btoa=function(a){return d.fromBinary(a).toBase64()};d.atob=function(a){return d.fromBase64(a).toBinary()};d.prototype.toBinary=function(a,b){a="undefined"===typeof a?this.offset:a;b="undefined"===typeof b?this.limit:b;if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal begin: Not an integer");a>>>=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal end: Not an integer");b>>>=0;if(0>a||a>b||b>this.buffer.byteLength)throw new RangeError("Illegal range: 0 <= "+
a+" <= "+b+" <= "+this.buffer.byteLength);}if(a===b)return"";for(var c=[];a<b;)c.push(this.view.getUint8(a++));return String.fromCharCode.apply(String,c)};d.fromBinary=function(a,b,c){if(!c&&"string"!==typeof a)throw new TypeError("Illegal str: Not a string");for(var e=0,h=a.length,f=new d(h,b,c);e<h;){b=a.charCodeAt(e);if(!c&&255<b)throw new TypeError("Illegal charCode at "+e+": 0 <= "+b+" <= 255");f.view.setUint8(e++,b)}f.limit=h;return f};d.prototype.toDebug=function(a){for(var b=-1,c=this.buffer.byteLength,
e,d="",f="",g="";b<c;){-1!==b&&(e=this.view.getUint8(b),d=16>e?d+("0"+e.toString(16).toUpperCase()):d+e.toString(16).toUpperCase(),a&&(f+=32<e&&127>e?String.fromCharCode(e):"."));++b;if(a&&0<b&&0===b%16&&b!==c){for(;51>d.length;)d+=" ";g+=d+f+"\n";d=f=""}d=b===this.offset&&b===this.limit?d+(b===this.markedOffset?"!":"|"):b===this.offset?d+(b===this.markedOffset?"[":"<"):b===this.limit?d+(b===this.markedOffset?"]":">"):d+(b===this.markedOffset?"'":a||0!==b&&b!==c?" ":"")}if(a&&" "!==d){for(;51>d.length;)d+=
" ";g+=d+f+"\n"}return a?g:d};d.fromDebug=function(a,b,c){var e=a.length;b=new d((e+1)/3|0,b,c);for(var h=0,f=0,g,k=!1,l=!1,p=!1,m=!1,q=!1;h<e;){switch(g=a.charAt(h++)){case "!":if(!c){if(l||p||m){q=!0;break}l=p=m=!0}b.offset=b.markedOffset=b.limit=f;k=!1;break;case "|":if(!c){if(l||m){q=!0;break}l=m=!0}b.offset=b.limit=f;k=!1;break;case "[":if(!c){if(l||p){q=!0;break}l=p=!0}b.offset=b.markedOffset=f;k=!1;break;case "<":if(!c){if(l){q=!0;break}l=!0}b.offset=f;k=!1;break;case "]":if(!c){if(m||p){q=
!0;break}m=p=!0}b.limit=b.markedOffset=f;k=!1;break;case ">":if(!c){if(m){q=!0;break}m=!0}b.limit=f;k=!1;break;case "'":if(!c){if(p){q=!0;break}p=!0}b.markedOffset=f;k=!1;break;case " ":k=!1;break;default:if(!c&&k){q=!0;break}g=parseInt(g+a.charAt(h++),16);if(!c&&(isNaN(g)||0>g||255<g))throw new TypeError("Illegal str: Not a debug encoded string");b.view.setUint8(f++,g);k=!0}if(q)throw new TypeError("Illegal str: Invalid symbol at "+h);}if(!c){if(!l||!m)throw new TypeError("Illegal str: Missing offset or limit");
if(f<b.buffer.byteLength)throw new TypeError("Illegal str: Not a debug encoded string (is it hex?) "+f+" < "+e);}return b};d.prototype.toHex=function(a,b){a="undefined"===typeof a?this.offset:a;b="undefined"===typeof b?this.limit:b;if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal begin: Not an integer");a>>>=0;if("number"!==typeof b||0!==b%1)throw new TypeError("Illegal end: Not an integer");b>>>=0;if(0>a||a>b||b>this.buffer.byteLength)throw new RangeError("Illegal range: 0 <= "+
a+" <= "+b+" <= "+this.buffer.byteLength);}for(var c=Array(b-a),e;a<b;)e=this.view.getUint8(a++),16>e?c.push("0",e.toString(16)):c.push(e.toString(16));return c.join("")};d.fromHex=function(a,b,c){if(!c){if("string"!==typeof a)throw new TypeError("Illegal str: Not a string");if(0!==a.length%2)throw new TypeError("Illegal str: Length not a multiple of 2");}var e=a.length;b=new d(e/2|0,b);for(var h,f=0,g=0;f<e;f+=2){h=parseInt(a.substring(f,f+2),16);if(!c&&(!isFinite(h)||0>h||255<h))throw new TypeError("Illegal str: Contains non-hex characters");
b.view.setUint8(g++,h)}b.limit=g;return b};var k=function(){var a={j:function(a,c){var e=null;"number"===typeof a&&(e=a,a=function(){return null});for(;null!==e||null!==(e=a());)128>e?c(e&127):(2048>e?c(e>>6&31|192):(65536>e?c(e>>12&15|224):(c(e>>18&7|240),c(e>>12&63|128)),c(e>>6&63|128)),c(e&63|128)),e=null},i:function(a,c){function e(a){a=a.slice(0,a.indexOf(null));var b=Error(a.toString());b.name="TruncatedError";b.bytes=a;throw b;}for(var d,f,g,k;null!==(d=a());)if(0===(d&128))c(d);else if(192===
(d&224))null===(f=a())&&e([d,f]),c((d&31)<<6|f&63);else if(224===(d&240))null!==(f=a())&&null!==(g=a())||e([d,f,g]),c((d&15)<<12|(f&63)<<6|g&63);else if(240===(d&248))null!==(f=a())&&null!==(g=a())&&null!==(k=a())||e([d,f,g,k]),c((d&7)<<18|(f&63)<<12|(g&63)<<6|k&63);else throw RangeError("Illegal starting byte: "+d);},f:function(a,c){for(var e,d=null;null!==(e=null!==d?d:a());)55296<=e&&57343>=e&&null!==(d=a())&&56320<=d&&57343>=d?(c(1024*(e-55296)+d-56320+65536),d=null):c(e);null!==d&&c(d)},g:function(a,
c){var e=null;"number"===typeof a&&(e=a,a=function(){return null});for(;null!==e||null!==(e=a());)65535>=e?c(e):(e-=65536,c((e>>10)+55296),c(e%1024+56320)),e=null},e:function(b,c){a.f(b,function(b){a.j(b,c)})},d:function(b,c){a.i(b,function(b){a.g(b,c)})},k:function(a){if("number"!==typeof a||a!==a)throw TypeError("Illegal byte: "+typeof a);if(-128>a||255<a)throw RangeError("Illegal byte: "+a);return a},l:function(a){if("number"!==typeof a||a!==a)throw TypeError("Illegal char code: "+typeof a);if(0>
a||65535<a)throw RangeError("Illegal char code: "+a);return a},m:function(a){if("number"!==typeof a||a!==a)throw TypeError("Illegal code point: "+typeof a);if(0>a||1114111<a)throw RangeError("Illegal code point: "+a);return a},h:function(a){return 128>a?1:2048>a?2:65536>a?3:4},n:function(b){for(var c,d=0;null!==(c=b());)d+=a.h(c);return d},b:function(b){var c=0,d=0;a.f(b,function(b){++c;d+=a.h(b)});return[c,d]}};return a}(),s=String.fromCharCode;k.a=function(a){var b=0;return function(){return b<
a.length?a.charCodeAt(b++):null}};k.c=function(){var a=[],b=[];return function(){if(0===arguments.length)return b.join("")+s.apply(String,a);1024<a.length+arguments.length&&(b.push(s.apply(String,a)),a.length=0);Array.prototype.push.apply(a,arguments)}};d.prototype.toUTF8=function(a,b){"undefined"===typeof a&&(a=this.offset);"undefined"===typeof b&&(b=this.limit);if(!this.noAssert){if("number"!==typeof a||0!==a%1)throw new TypeError("Illegal begin: Not an integer");a>>>=0;if("number"!==typeof b||
0!==b%1)throw new TypeError("Illegal end: Not an integer");b>>>=0;if(0>a||a>b||b>this.buffer.byteLength)throw new RangeError("Illegal range: 0 <= "+a+" <= "+b+" <= "+this.buffer.byteLength);}var c=this,d;try{k.d(function(){return a<b?c.view.getUint8(a++):null},d=k.c())}catch(h){if(a!==b)throw new RangeError("Illegal range: Truncated data, "+a+" != "+b);}return d()};d.fromUTF8=function(a,b,c){if(!c&&"string"!==typeof a)throw new TypeError("Illegal str: Not a string");var e=new d(k.b(k.a(a),!0)[1],
b,c),h=0;k.e(k.a(a),function(a){e.view.setUint8(h++,a)});e.limit=h;return e};return d}"undefined"!=typeof module&&module.exports?module.exports=s(_dereq_("long")):"undefined"!==typeof define&&define.amd?define("ByteBuffer",["Math/Long"],function(l){return s(l)}):(r.dcodeIO||(r.dcodeIO={}),r.dcodeIO.ByteBuffer=s(r.dcodeIO.Long))})(this);

},{"long":21}],20:[function(_dereq_,module,exports){
/*
 Copyright 2013 Daniel Wirtz <dcode@dcode.io>
 Copyright 2009 The Closure Library Authors. All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS-IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
/**
 * @license Long.js (c) 2013 Daniel Wirtz <dcode@dcode.io>
 * Released under the Apache License, Version 2.0
 * Derived from goog.math.Long from the Closure Library
 * see: https://github.com/dcodeIO/Long.js for details
 */
(function(global) {
    "use strict";

    /**
     * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
     * values as *signed* integers.  See the from* functions below for more
     * convenient ways of constructing Longs.
     *
     * The internal representation of a long is the two given signed, 32-bit values.
     * We use 32-bit pieces because these are the size of integers on which
     * Javascript performs bit-operations.  For operations like addition and
     * multiplication, we split each number into 16-bit pieces, which can easily be
     * multiplied within Javascript's floating-point representation without overflow
     * or change in sign.
     *
     * In the algorithms below, we frequently reduce the negative case to the
     * positive case by negating the input(s) and then post-processing the result.
     * Note that we must ALWAYS check specially whether those values are MIN_VALUE
     * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
     * a positive number, it overflows back into a negative).  Not handling this
     * case would often result in infinite recursion.
     * 
     * @exports Long
     * @class A Long class for representing a 64-bit two's-complement integer value.
     * @param {number|!{low: number, high: number, unsigned: boolean}} low The low (signed) 32 bits of the long.
     *  Optionally accepts a Long-like object as the first parameter.
     * @param {number=} high The high (signed) 32 bits of the long.
     * @param {boolean=} unsigned Whether unsigned or not. Defaults to `false` (signed).
     * @constructor
     */
    var Long = function(low, high, unsigned) {
        if (low && typeof low === 'object') {
            high = low.high;
            unsigned = low.unsigned;
            low = low.low;
        }
        
        /**
         * The low 32 bits as a signed value.
         * @type {number}
         * @expose
         */
        this.low = low | 0;

        /**
         * The high 32 bits as a signed value.
         * @type {number}
         * @expose
         */
        this.high = high | 0;

        /**
         * Whether unsigned or not.
         * @type {boolean}
         * @expose
         */
        this.unsigned = !!unsigned;
    };

    // NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the from* methods on which they depend.

    // NOTE: The following cache variables are used internally only and are therefore not exposed as properties of the
    // Long class.
    
    /**
     * A cache of the Long representations of small integer values.
     * @type {!Object}
     */
    var INT_CACHE = {};

    /**
     * A cache of the Long representations of small unsigned integer values.
     * @type {!Object}
     */
    var UINT_CACHE = {};

    /**
     * Returns a Long representing the given (32-bit) integer value.
     * @param {number} value The 32-bit integer in question.
     * @param {boolean=} unsigned Whether unsigned or not. Defaults to false (signed).
     * @return {!Long} The corresponding Long value.
     * @expose
     */
    Long.fromInt = function(value, unsigned) {
        var obj, cachedObj;
        if (!unsigned) {
            value = value | 0;
            if (-128 <= value && value < 128) {
                cachedObj = INT_CACHE[value];
                if (cachedObj) return cachedObj;
            }
            obj = new Long(value, value < 0 ? -1 : 0, false);
            if (-128 <= value && value < 128) {
                INT_CACHE[value] = obj;
            }
            return obj;
        } else {
            value = value >>> 0;
            if (0 <= value && value < 256) {
                cachedObj = UINT_CACHE[value];
                if (cachedObj) return cachedObj;
            }
            obj = new Long(value, (value | 0) < 0 ? -1 : 0, true);
            if (0 <= value && value < 256) {
                UINT_CACHE[value] = obj;
            }
            return obj;
        }
    };

    /**
     * Returns a Long representing the given value, provided that it is a finite
     * number.  Otherwise, zero is returned.
     * @param {number} value The number in question.
     * @param {boolean=} unsigned Whether unsigned or not. Defaults to false (signed).
     * @return {!Long} The corresponding Long value.
     * @expose
     */
    Long.fromNumber = function(value, unsigned) {
        unsigned = !!unsigned;
        if (isNaN(value) || !isFinite(value)) {
            return Long.ZERO;
        } else if (!unsigned && value <= -TWO_PWR_63_DBL) {
            return Long.MIN_SIGNED_VALUE;
        } else if (unsigned && value <= 0) {
            return Long.MIN_UNSIGNED_VALUE;
        } else if (!unsigned && value + 1 >= TWO_PWR_63_DBL) {
            return Long.MAX_SIGNED_VALUE;
        } else if (unsigned && value >= TWO_PWR_64_DBL) {
            return Long.MAX_UNSIGNED_VALUE;
        } else if (value < 0) {
            return Long.fromNumber(-value, false).negate();
        } else {
            return new Long((value % TWO_PWR_32_DBL) | 0, (value / TWO_PWR_32_DBL) | 0, unsigned);
        }
    };

    /**
     * Returns a Long representing the 64bit integer that comes by concatenating the given low and high bits. Each is
     *  assumed to use 32 bits.
     * @param {number} lowBits The low 32 bits.
     * @param {number} highBits The high 32 bits.
     * @param {boolean=} unsigned Whether unsigned or not. Defaults to false (signed).
     * @return {!Long} The corresponding Long value.
     * @expose
     */
    Long.fromBits = function(lowBits, highBits, unsigned) {
        return new Long(lowBits, highBits, unsigned);
    };

    /**
     * Returns a Long representing the 64bit integer that comes by concatenating the given low, middle and high bits.
     *  Each is assumed to use 28 bits.
     * @param {number} part0 The low 28 bits
     * @param {number} part1 The middle 28 bits
     * @param {number} part2 The high 28 (8) bits
     * @param {boolean=} unsigned Whether unsigned or not. Defaults to false (signed).
     * @return {!Long}
     * @expose
     */
    Long.from28Bits = function(part0, part1, part2, unsigned) {
        // 00000000000000000000000000001111 11111111111111111111111122222222 2222222222222
        // LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH
        return Long.fromBits(part0 | (part1 << 28), (part1 >>> 4) | (part2) << 24, unsigned);
    };

    /**
     * Returns a Long representation of the given string, written using the given
     * radix.
     * @param {string} str The textual representation of the Long.
     * @param {(boolean|number)=} unsigned Whether unsigned or not. Defaults to false (signed).
     * @param {number=} radix The radix in which the text is written.
     * @return {!Long} The corresponding Long value.
     * @expose
     */
    Long.fromString = function(str, unsigned, radix) {
        if (str.length == 0) {
            throw(new Error('number format error: empty string'));
        }
        if (str === "NaN" || str === "Infinity" || str === "+Infinity" || str === "-Infinity") {
            return Long.ZERO;
        }
        if (typeof unsigned === 'number') { // For goog.math.Long compatibility
            radix = unsigned;
            unsigned = false;
        }
        radix = radix || 10;
        if (radix < 2 || 36 < radix) {
            throw(new Error('radix out of range: ' + radix));
        }

        if (str.charAt(0) == '-') {
            return Long.fromString(str.substring(1), unsigned, radix).negate();
        } else if (str.indexOf('-') >= 0) {
            throw(new Error('number format error: interior "-" character: ' + str));
        }

        // Do several (8) digits each time through the loop, so as to
        // minimize the calls to the very expensive emulated div.
        var radixToPower = Long.fromNumber(Math.pow(radix, 8));

        var result = Long.ZERO;
        for (var i = 0; i < str.length; i += 8) {
            var size = Math.min(8, str.length - i);
            var value = parseInt(str.substring(i, i + size), radix);
            if (size < 8) {
                var power = Long.fromNumber(Math.pow(radix, size));
                result = result.multiply(power).add(Long.fromNumber(value));
            } else {
                result = result.multiply(radixToPower);
                result = result.add(Long.fromNumber(value));
            }
        }
        result.unsigned = unsigned;
        return result;
    };

    // NOTE: the compiler should inline these constant values below and then remove these variables, so there should be
    // no runtime penalty for these.
    
    // NOTE: The following constant values are used internally only and are therefore not exposed as properties of the
    // Long class.

    /**
     * @type {number}
     */
    var TWO_PWR_16_DBL = 1 << 16;

    /**
     * @type {number}
     */
    var TWO_PWR_24_DBL = 1 << 24;

    /**
     * @type {number}
     */
    var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;

    /**
     * @type {number}
     */
    var TWO_PWR_31_DBL = TWO_PWR_32_DBL / 2;

    /**
     * @type {number}
     */
    var TWO_PWR_48_DBL = TWO_PWR_32_DBL * TWO_PWR_16_DBL;

    /**
     * @type {number}
     */
    var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;

    /**
     * @type {number}
     */
    var TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2;

    /**
     * @type {!Long}
     */
    var TWO_PWR_24 = Long.fromInt(1 << 24);

    /**
     * @type {!Long}
     * @expose
     */
    Long.ZERO = Long.fromInt(0);

    /**
     * @type {!Long}
     * @expose
     */
    Long.UZERO = Long.fromInt(0, true);

    /**
     * @type {!Long}
     * @expose
     */
    Long.ONE = Long.fromInt(1);

    /**
     * @type {!Long}
     * @expose
     */
    Long.UONE = Long.fromInt(1, true);

    /**
     * @type {!Long}
     * @expose
     */
    Long.NEG_ONE = Long.fromInt(-1);

    /**
     * @type {!Long}
     * @expose
     */
    Long.MAX_SIGNED_VALUE = Long.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0, false);

    /**
     * @type {!Long}
     * @expose
     */
    Long.MAX_UNSIGNED_VALUE = Long.fromBits(0xFFFFFFFF | 0, 0xFFFFFFFF | 0, true);

    /**
     * Alias of {@link Long.MAX_SIGNED_VALUE} for goog.math.Long compatibility.
     * @type {!Long}
     * @expose
     */
    Long.MAX_VALUE = Long.MAX_SIGNED_VALUE;

    /**
     * @type {!Long}
     * @expose
     */
    Long.MIN_SIGNED_VALUE = Long.fromBits(0, 0x80000000 | 0, false);

    /**
     * @type {!Long}
     * @expose
     */
    Long.MIN_UNSIGNED_VALUE = Long.fromBits(0, 0, true);

    /**
     * Alias of {@link Long.MIN_SIGNED_VALUE}  for goog.math.Long compatibility.
     * @type {!Long}
     * @expose
     */
    Long.MIN_VALUE = Long.MIN_SIGNED_VALUE;

    /**
     * @return {number} The value, assuming it is a 32-bit integer.
     * @expose
     */
    Long.prototype.toInt = function() {
        return this.unsigned ? this.low >>> 0 : this.low;
    };

    /**
     * @return {number} The closest floating-point representation to this value.
     * @expose
     */
    Long.prototype.toNumber = function() {
        if (this.unsigned) {
            return ((this.high >>> 0) * TWO_PWR_32_DBL) + (this.low >>> 0);
        }
        return this.high * TWO_PWR_32_DBL + (this.low >>> 0);
    };

    /**
     * @param {number=} radix The radix in which the text should be written.
     * @return {string} The textual representation of this value.
     * @override
     * @expose
     */
    Long.prototype.toString = function(radix) {
        radix = radix || 10;
        if (radix < 2 || 36 < radix) {
            throw(new Error('radix out of range: ' + radix));
        }
        if (this.isZero()) {
            return '0';
        }
        var rem;
        if (this.isNegative()) { // Unsigned Longs are never negative
            if (this.equals(Long.MIN_SIGNED_VALUE)) {
                // We need to change the Long value before it can be negated, so we remove
                // the bottom-most digit in this base and then recurse to do the rest.
                var radixLong = Long.fromNumber(radix);
                var div = this.div(radixLong);
                rem = div.multiply(radixLong).subtract(this);
                return div.toString(radix) + rem.toInt().toString(radix);
            } else {
                return '-' + this.negate().toString(radix);
            }
        }

        // Do several (6) digits each time through the loop, so as to
        // minimize the calls to the very expensive emulated div.
        var radixToPower = Long.fromNumber(Math.pow(radix, 6));
        rem = this;
        var result = '';
        while (true) {
            var remDiv = rem.div(radixToPower);
            var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
            var digits = intval.toString(radix);
            rem = remDiv;
            if (rem.isZero()) {
                return digits + result;
            } else {
                while (digits.length < 6) {
                    digits = '0' + digits;
                }
                result = '' + digits + result;
            }
        }
    };

    /**
     * @return {number} The high 32 bits as a signed value.
     * @expose
     */
    Long.prototype.getHighBits = function() {
        return this.high;
    };

    /**
     * @return {number} The high 32 bits as an unsigned value.
     * @expose
     */
    Long.prototype.getHighBitsUnsigned = function() {
        return this.high >>> 0;
    };

    /**
     * @return {number} The low 32 bits as a signed value.
     * @expose
     */
    Long.prototype.getLowBits = function() {
        return this.low;
    };

    /**
     * @return {number} The low 32 bits as an unsigned value.
     * @expose
     */
    Long.prototype.getLowBitsUnsigned = function() {
        return this.low >>> 0;
    };

    /**
     * @return {number} Returns the number of bits needed to represent the absolute
     *     value of this Long.
     * @expose
     */
    Long.prototype.getNumBitsAbs = function() {
        if (this.isNegative()) { // Unsigned Longs are never negative
            if (this.equals(Long.MIN_SIGNED_VALUE)) {
                return 64;
            } else {
                return this.negate().getNumBitsAbs();
            }
        } else {
            var val = this.high != 0 ? this.high : this.low;
            for (var bit = 31; bit > 0; bit--) {
                if ((val & (1 << bit)) != 0) {
                    break;
                }
            }
            return this.high != 0 ? bit + 33 : bit + 1;
        }
    };

    /**
     * @return {boolean} Whether this value is zero.
     * @expose
     */
    Long.prototype.isZero = function() {
        return this.high == 0 && this.low == 0;
    };

    /**
     * @return {boolean} Whether this value is negative.
     * @expose
     */
    Long.prototype.isNegative = function() {
        return !this.unsigned && this.high < 0;
    };

    /**
     * @return {boolean} Whether this value is odd.
     * @expose
     */
    Long.prototype.isOdd = function() {
        return (this.low & 1) == 1;
    };

    /**
     * @return {boolean} Whether this value is even.
     */
    Long.prototype.isEven = function() {
        return (this.low & 1) == 0;
    };

    /**
     * @param {Long} other Long to compare against.
     * @return {boolean} Whether this Long equals the other.
     * @expose
     */
    Long.prototype.equals = function(other) {
        if (this.unsigned != other.unsigned && (this.high >>> 31) != (other.high >>> 31)) return false;
        return (this.high == other.high) && (this.low == other.low);
    };

    /**
     * @param {Long} other Long to compare against.
     * @return {boolean} Whether this Long does not equal the other.
     * @expose
     */
    Long.prototype.notEquals = function(other) {
        return !this.equals(other);
    };

    /**
     * @param {Long} other Long to compare against.
     * @return {boolean} Whether this Long is less than the other.
     * @expose
     */
    Long.prototype.lessThan = function(other) {
        return this.compare(other) < 0;
    };

    /**
     * @param {Long} other Long to compare against.
     * @return {boolean} Whether this Long is less than or equal to the other.
     * @expose
     */
    Long.prototype.lessThanOrEqual = function(other) {
        return this.compare(other) <= 0;
    };

    /**
     * @param {Long} other Long to compare against.
     * @return {boolean} Whether this Long is greater than the other.
     * @expose
     */
    Long.prototype.greaterThan = function(other) {
        return this.compare(other) > 0;
    };

    /**
     * @param {Long} other Long to compare against.
     * @return {boolean} Whether this Long is greater than or equal to the other.
     * @expose
     */
    Long.prototype.greaterThanOrEqual = function(other) {
        return this.compare(other) >= 0;
    };

    /**
     * Compares this Long with the given one.
     * @param {Long} other Long to compare against.
     * @return {number} 0 if they are the same, 1 if the this is greater, and -1
     *     if the given one is greater.
     * @expose
     */
    Long.prototype.compare = function(other) {
        if (this.equals(other)) {
            return 0;
        }
        var thisNeg = this.isNegative();
        var otherNeg = other.isNegative();
        if (thisNeg && !otherNeg) return -1;
        if (!thisNeg && otherNeg) return 1;
        if (!this.unsigned) {
            // At this point the signs are the same
            return this.subtract(other).isNegative() ? -1 : 1;
        } else {
            // Both are positive if at least one is unsigned
            return (other.high >>> 0) > (this.high >>> 0) || (other.high == this.high && (other.low >>> 0) > (this.low >>> 0)) ? -1 : 1;
        }
    };

    /**
     * @return {!Long} The negation of this value.
     * @expose
     */
    Long.prototype.negate = function() {
        if (!this.unsigned && this.equals(Long.MIN_SIGNED_VALUE)) {
            return Long.MIN_SIGNED_VALUE;
        }
        return this.not().add(Long.ONE);
    };

    /**
     * Returns the sum of this and the given Long.
     * @param {Long} other Long to add to this one.
     * @return {!Long} The sum of this and the given Long.
     * @expose
     */
    Long.prototype.add = function(other) {
        // Divide each number into 4 chunks of 16 bits, and then sum the chunks.
        
        var a48 = this.high >>> 16;
        var a32 = this.high & 0xFFFF;
        var a16 = this.low >>> 16;
        var a00 = this.low & 0xFFFF;

        var b48 = other.high >>> 16;
        var b32 = other.high & 0xFFFF;
        var b16 = other.low >>> 16;
        var b00 = other.low & 0xFFFF;

        var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
        c00 += a00 + b00;
        c16 += c00 >>> 16;
        c00 &= 0xFFFF;
        c16 += a16 + b16;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c32 += a32 + b32;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c48 += a48 + b48;
        c48 &= 0xFFFF;
        return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);
    };

    /**
     * Returns the difference of this and the given Long.
     * @param {Long} other Long to subtract from this.
     * @return {!Long} The difference of this and the given Long.
     * @expose
     */
    Long.prototype.subtract = function(other) {
        return this.add(other.negate());
    };

    /**
     * Returns the product of this and the given long.
     * @param {Long} other Long to multiply with this.
     * @return {!Long} The product of this and the other.
     * @expose
     */
    Long.prototype.multiply = function(other) {
        if (this.isZero()) {
            return Long.ZERO;
        } else if (other.isZero()) {
            return Long.ZERO;
        }

        if (this.equals(Long.MIN_VALUE)) {
            return other.isOdd() ? Long.MIN_VALUE : Long.ZERO;
        } else if (other.equals(Long.MIN_VALUE)) {
            return this.isOdd() ? Long.MIN_VALUE : Long.ZERO;
        }

        if (this.isNegative()) {
            if (other.isNegative()) {
                return this.negate().multiply(other.negate());
            } else {
                return this.negate().multiply(other).negate();
            }
        } else if (other.isNegative()) {
            return this.multiply(other.negate()).negate();
        }
        // If both longs are small, use float multiplication
        if (this.lessThan(TWO_PWR_24) &&
            other.lessThan(TWO_PWR_24)) {
            return Long.fromNumber(this.toNumber() * other.toNumber(), this.unsigned);
        }

        // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
        // We can skip products that would overflow.
        
        var a48 = this.high >>> 16;
        var a32 = this.high & 0xFFFF;
        var a16 = this.low >>> 16;
        var a00 = this.low & 0xFFFF;

        var b48 = other.high >>> 16;
        var b32 = other.high & 0xFFFF;
        var b16 = other.low >>> 16;
        var b00 = other.low & 0xFFFF;

        var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
        c00 += a00 * b00;
        c16 += c00 >>> 16;
        c00 &= 0xFFFF;
        c16 += a16 * b00;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c16 += a00 * b16;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c32 += a32 * b00;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c32 += a16 * b16;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c32 += a00 * b32;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
        c48 &= 0xFFFF;
        return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);
    };

    /**
     * Returns this Long divided by the given one.
     * @param {Long} other Long by which to divide.
     * @return {!Long} This Long divided by the given one.
     * @expose
     */
    Long.prototype.div = function(other) {
        if (other.isZero()) {
            throw(new Error('division by zero'));
        } else if (this.isZero()) {
            return this.unsigned ? Long.UZERO : Long.ZERO;
        }
        var approx, rem, res;
        if (this.equals(Long.MIN_SIGNED_VALUE)) {
            if (other.equals(Long.ONE) || other.equals(Long.NEG_ONE)) {
                return Long.MIN_SIGNED_VALUE;  // recall that -MIN_VALUE == MIN_VALUE
            } else if (other.equals(Long.MIN_SIGNED_VALUE)) {
                return Long.ONE;
            } else {
                // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
                var halfThis = this.shiftRight(1);
                approx = halfThis.div(other).shiftLeft(1);
                if (approx.equals(Long.ZERO)) {
                    return other.isNegative() ? Long.ONE : Long.NEG_ONE;
                } else {
                    rem = this.subtract(other.multiply(approx));
                    res = approx.add(rem.div(other));
                    return res;
                }
            }
        } else if (other.equals(Long.MIN_SIGNED_VALUE)) {
            return this.unsigned ? Long.UZERO : Long.ZERO;
        }
        if (this.isNegative()) {
            if (other.isNegative()) {
                return this.negate().div(other.negate());
            } else {
                return this.negate().div(other).negate();
            }
        } else if (other.isNegative()) {
            return this.div(other.negate()).negate();
        }
        
        // Repeat the following until the remainder is less than other:  find a
        // floating-point that approximates remainder / other *from below*, add this
        // into the result, and subtract it from the remainder.  It is critical that
        // the approximate value is less than or equal to the real value so that the
        // remainder never becomes negative.
        res = Long.ZERO;
        rem = this;
        while (rem.greaterThanOrEqual(other)) {
            // Approximate the result of division. This may be a little greater or
            // smaller than the actual value.
            approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));

            // We will tweak the approximate result by changing it in the 48-th digit or
            // the smallest non-fractional digit, whichever is larger.
            var log2 = Math.ceil(Math.log(approx) / Math.LN2);
            var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);

            // Decrease the approximation until it is smaller than the remainder.  Note
            // that if it is too large, the product overflows and is negative.
            var approxRes = Long.fromNumber(approx, this.unsigned);
            var approxRem = approxRes.multiply(other);
            while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
                approx -= delta;
                approxRes = Long.fromNumber(approx, this.unsigned);
                approxRem = approxRes.multiply(other);
            }

            // We know the answer can't be zero... and actually, zero would cause
            // infinite recursion since we would make no progress.
            if (approxRes.isZero()) {
                approxRes = Long.ONE;
            }

            res = res.add(approxRes);
            rem = rem.subtract(approxRem);
        }
        return res;
    };

    /**
     * Returns this Long modulo the given one.
     * @param {Long} other Long by which to mod.
     * @return {!Long} This Long modulo the given one.
     * @expose
     */
    Long.prototype.modulo = function(other) {
        return this.subtract(this.div(other).multiply(other));
    };

    /**
     * @return {!Long} The bitwise-NOT of this value.
     * @expose
     */
    Long.prototype.not = function() {
        return Long.fromBits(~this.low, ~this.high, this.unsigned);
    };

    /**
     * Returns the bitwise-AND of this Long and the given one.
     * @param {Long} other The Long with which to AND.
     * @return {!Long} The bitwise-AND of this and the other.
     * @expose
     */
    Long.prototype.and = function(other) {
        return Long.fromBits(this.low & other.low, this.high & other.high, this.unsigned);
    };

    /**
     * Returns the bitwise-OR of this Long and the given one.
     * @param {Long} other The Long with which to OR.
     * @return {!Long} The bitwise-OR of this and the other.
     * @expose
     */
    Long.prototype.or = function(other) {
        return Long.fromBits(this.low | other.low, this.high | other.high, this.unsigned);
    };

    /**
     * Returns the bitwise-XOR of this Long and the given one.
     * @param {Long} other The Long with which to XOR.
     * @return {!Long} The bitwise-XOR of this and the other.
     * @expose
     */
    Long.prototype.xor = function(other) {
        return Long.fromBits(this.low ^ other.low, this.high ^ other.high, this.unsigned);
    };

    /**
     * Returns this Long with bits shifted to the left by the given amount.
     * @param {number} numBits The number of bits by which to shift.
     * @return {!Long} This shifted to the left by the given amount.
     * @expose
     */
    Long.prototype.shiftLeft = function(numBits) {
        numBits &= 63;
        if (numBits == 0) {
            return this;
        } else {
            var low = this.low;
            if (numBits < 32) {
                var high = this.high;
                return Long.fromBits(low << numBits, (high << numBits) | (low >>> (32 - numBits)), this.unsigned);
            } else {
                return Long.fromBits(0, low << (numBits - 32), this.unsigned);
            }
        }
    };

    /**
     * Returns this Long with bits shifted to the right by the given amount.
     * @param {number} numBits The number of bits by which to shift.
     * @return {!Long} This shifted to the right by the given amount.
     * @expose
     */
    Long.prototype.shiftRight = function(numBits) {
        numBits &= 63;
        if (numBits == 0) {
            return this;
        } else {
            var high = this.high;
            if (numBits < 32) {
                var low = this.low;
                return Long.fromBits((low >>> numBits) | (high << (32 - numBits)), high >> numBits, this.unsigned);
            } else {
                return Long.fromBits(high >> (numBits - 32), high >= 0 ? 0 : -1, this.unsigned);
            }
        }
    };

    /**
     * Returns this Long with bits shifted to the right by the given amount, with
     * the new top bits matching the current sign bit.
     * @param {number} numBits The number of bits by which to shift.
     * @return {!Long} This shifted to the right by the given amount, with
     *     zeros placed into the new leading bits.
     * @expose
     */
    Long.prototype.shiftRightUnsigned = function(numBits) {
        numBits &= 63;
        if (numBits == 0) {
            return this;
        } else {
            var high = this.high;
            if (numBits < 32) {
                var low = this.low;
                return Long.fromBits((low >>> numBits) | (high << (32 - numBits)), high >>> numBits, this.unsigned);
            } else if (numBits == 32) {
                return Long.fromBits(high, 0, this.unsigned);
            } else {
                return Long.fromBits(high >>> (numBits - 32), 0, this.unsigned);
            }
        }
    };

    /**
     * @return {!Long} Signed long
     * @expose
     */
    Long.prototype.toSigned = function() {
        var l = this.clone();
        l.unsigned = false;
        return l;
    };

    /**
     * @return {!Long} Unsigned long
     * @expose
     */
    Long.prototype.toUnsigned = function() {
        var l = this.clone();
        l.unsigned = true;
        return l;
    };
    
    /**
     * @return {Long} Cloned instance with the same low/high bits and unsigned flag.
     * @expose
     */
    Long.prototype.clone = function() {
        return new Long(this.low, this.high, this.unsigned);
    };

    // Enable module loading if available
    if (typeof module != 'undefined' && module["exports"]) { // CommonJS
        module["exports"] = Long;
    } else if (typeof define != 'undefined' && define["amd"]) { // AMD
        define("Math/Long", [], function() { return Long; });
    } else { // Shim
        if (!global["dcodeIO"]) {
            global["dcodeIO"] = {};
        }
        global["dcodeIO"]["Long"] = Long;
    }

})(this);

},{}],21:[function(_dereq_,module,exports){
/*
 Copyright 2013 Daniel Wirtz <dcode@dcode.io>
 Copyright 2009 The Closure Library Authors. All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS-IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

module.exports = _dereq_("./dist/Long.js");

},{"./dist/Long.js":20}]},{},[6])
(6)
});