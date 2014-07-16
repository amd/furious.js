(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){
"use strict";

var NDArray = require("./NDArray");
var DataType = require("./DataType");
var util = require("./util");
var jsmath = require("./jsmath");

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
			var out = context.empty(shapeOut, a.dataType);
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
	} else if (out instanceof NDArray) {
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

},{"./DataType":1,"./NDArray":3,"./jsmath":7,"./util":8}],3:[function(require,module,exports){
"use strict";

var util = require("./util");
var DataType = require("./DataType");

function shapeToLength(shape) {
	var length = 1;
	for (var i = 0; i < shape.length; i++) {
		length *= shape[i];
	}
	return length;
}

function validateMultiIndex(index, shape) {
	if (index.length != shape.length) {
		throw new RangeError("The multi-index " + index + " does not match the dimensions " + shape + " of the array");
	}
	for (var i = 0; i < index.length; i++) {
		if (!util.isInt(index[i])) {
			throw new TypeError("The sub-index " + index[i] + " is not an integer");
		}
		if ((index[i] < 0) || (index[i] >= shape[i])) {
			throw new RangeError("The sub-index " + index[i] + " is out of bounds");
		}
	}
}

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
	this.shape = util.asIntArray(shape);
	this.dataType = dataType;
	this._context = context;
	this.length = shapeToLength(this.shape);
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

},{"./DataType":1,"./util":8}],4:[function(require,module,exports){
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

},{"./DataType":1,"./NDArray":3,"./allocator":5,"./util":8}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
"use strict";

/**
 * Provides information and support functions
 *
 * @class furious
 */

var DataType = require("./DataType");
var JSContext = require("./JSContext");
var PNaClContext = require("./PNaClContext");
var WebCLContext = require("./webcl/WebCLContext");

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
		return new JSContext(options, callback);
	} else if (backend === "pnacl") {
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
	if (hasFeature("webcl")) {
		return "webcl";
	} else if (hasFeature("pnacl")) {
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
	if (hasFeature("webcl")) {
		backends.push("webcl");
	}
	if (hasFeature("pnacl")) {
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
		return {
			"async": [true, false]
		};
	} else if (backend === "pnacl") {
		if (PNaClContext.isSupported()) {
			return {
				"manifest": [PNaClContext.getDefaultManifestURL()]
			};
		} else {
			return {};
		}
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

},{"./DataType":1,"./JSContext":2,"./PNaClContext":4,"./webcl/WebCLContext":9}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
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

exports.isNonNegativeInt = function(n) {
	return (n === +n) && (n === (n|0)) && (n >= 0);
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

exports.roundUp = function (number, multiple) {
	return Math.ceil(number / multiple) * multiple;
};

/**
 * Validate the shape argument.
 * Throws an error if the argument represents a valid shape.
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
	var DataType = require("./DataType");
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
	var NDArray = require("./NDArray");
	if (!(array instanceof NDArray)) {
		throw new TypeError(varname + " is not an NDArray");
	}
	if (!array.isValid()) {
		throw new Error(varname + " is an invalidated array");
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
 * @method
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

},{"./DataType":1,"./NDArray":3}],9:[function(require,module,exports){
"use strict";

var NDArray = require("../NDArray");
var DataType = require("../DataType");
var util = require("../util");


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
			cl = window.webcl;
		} else {
			try {
				cl = require("node-webcl");
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
	if (WebCLContext.isSupported()) {
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
 * Checks if WebCL can be used for computation.
 * WebCL is usable for computations if it is supported by JS engine (or Node.js) and there is at least one CPU or GPU device with KHR_fp64 extension.
 *
 * @static
 * @method isSupported
 * @return {Boolean} - true if WebCL is usable on this system and false otherwise.
 */
WebCLContext.isSupported = function() {
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
	this.queue.enqueueNDRangeKernel(kernel, 3, null,
		[strideA, outerStrideB, innerStrideB], null);
	a._tryRelease();
	b._tryRelease();
	return out;
};

module.exports = WebCLContext;

},{"../DataType":1,"../NDArray":3,"../util":8}],10:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  if (encoding === 'base64' && type === 'string') {
    subject = base64clean(subject)
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str.toString()
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.compare = function (a, b) {
  assert(Buffer.isBuffer(a) && Buffer.isBuffer(b), 'Arguments must be Buffers')
  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) {
    return -1
  }
  if (y < x) {
    return 1
  }
  return 0
}

// BUFFER INSTANCE METHODS
// =======================

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end === undefined) ? self.length : Number(end)

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = asciiSlice(self, start, end)
      break
    case 'binary':
      ret = binarySlice(self, start, end)
      break
    case 'base64':
      ret = base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

Buffer.prototype.equals = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.compare = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return readUInt16(this, offset, false, noAssert)
}

function readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return readInt16(this, offset, false, noAssert)
}

function readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return readInt32(this, offset, false, noAssert)
}

function readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return readFloat(this, offset, false, noAssert)
}

function readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
  return offset + 1
}

function writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
  return offset + 2
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, false, noAssert)
}

function writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
  return offset + 4
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
  return offset + 1
}

function writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
  return offset + 2
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, false, noAssert)
}

function writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
  return offset + 4
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, false, noAssert)
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":11,"ieee754":12}],11:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],12:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],13:[function(require,module,exports){
module.exports = require('./lib/chai');

},{"./lib/chai":14}],14:[function(require,module,exports){
/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var used = []
  , exports = module.exports = {};

/*!
 * Chai version
 */

exports.version = '1.9.1';

/*!
 * Assertion Error
 */

exports.AssertionError = require('assertion-error');

/*!
 * Utils for plugins (not exported)
 */

var util = require('./chai/utils');

/**
 * # .use(function)
 *
 * Provides a way to extend the internals of Chai
 *
 * @param {Function}
 * @returns {this} for chaining
 * @api public
 */

exports.use = function (fn) {
  if (!~used.indexOf(fn)) {
    fn(this, util);
    used.push(fn);
  }

  return this;
};

/*!
 * Configuration
 */

var config = require('./chai/config');
exports.config = config;

/*!
 * Primary `Assertion` prototype
 */

var assertion = require('./chai/assertion');
exports.use(assertion);

/*!
 * Core Assertions
 */

var core = require('./chai/core/assertions');
exports.use(core);

/*!
 * Expect interface
 */

var expect = require('./chai/interface/expect');
exports.use(expect);

/*!
 * Should interface
 */

var should = require('./chai/interface/should');
exports.use(should);

/*!
 * Assert interface
 */

var assert = require('./chai/interface/assert');
exports.use(assert);

},{"./chai/assertion":15,"./chai/config":16,"./chai/core/assertions":17,"./chai/interface/assert":18,"./chai/interface/expect":19,"./chai/interface/should":20,"./chai/utils":31,"assertion-error":40}],15:[function(require,module,exports){
/*!
 * chai
 * http://chaijs.com
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var config = require('./config');

module.exports = function (_chai, util) {
  /*!
   * Module dependencies.
   */

  var AssertionError = _chai.AssertionError
    , flag = util.flag;

  /*!
   * Module export.
   */

  _chai.Assertion = Assertion;

  /*!
   * Assertion Constructor
   *
   * Creates object for chaining.
   *
   * @api private
   */

  function Assertion (obj, msg, stack) {
    flag(this, 'ssfi', stack || arguments.callee);
    flag(this, 'object', obj);
    flag(this, 'message', msg);
  }

  Object.defineProperty(Assertion, 'includeStack', {
    get: function() {
      console.warn('Assertion.includeStack is deprecated, use chai.config.includeStack instead.');
      return config.includeStack;
    },
    set: function(value) {
      console.warn('Assertion.includeStack is deprecated, use chai.config.includeStack instead.');
      config.includeStack = value;
    }
  });

  Object.defineProperty(Assertion, 'showDiff', {
    get: function() {
      console.warn('Assertion.showDiff is deprecated, use chai.config.showDiff instead.');
      return config.showDiff;
    },
    set: function(value) {
      console.warn('Assertion.showDiff is deprecated, use chai.config.showDiff instead.');
      config.showDiff = value;
    }
  });

  Assertion.addProperty = function (name, fn) {
    util.addProperty(this.prototype, name, fn);
  };

  Assertion.addMethod = function (name, fn) {
    util.addMethod(this.prototype, name, fn);
  };

  Assertion.addChainableMethod = function (name, fn, chainingBehavior) {
    util.addChainableMethod(this.prototype, name, fn, chainingBehavior);
  };

  Assertion.overwriteProperty = function (name, fn) {
    util.overwriteProperty(this.prototype, name, fn);
  };

  Assertion.overwriteMethod = function (name, fn) {
    util.overwriteMethod(this.prototype, name, fn);
  };

  Assertion.overwriteChainableMethod = function (name, fn, chainingBehavior) {
    util.overwriteChainableMethod(this.prototype, name, fn, chainingBehavior);
  };

  /*!
   * ### .assert(expression, message, negateMessage, expected, actual)
   *
   * Executes an expression and check expectations. Throws AssertionError for reporting if test doesn't pass.
   *
   * @name assert
   * @param {Philosophical} expression to be tested
   * @param {String} message to display if fails
   * @param {String} negatedMessage to display if negated expression fails
   * @param {Mixed} expected value (remember to check for negation)
   * @param {Mixed} actual (optional) will default to `this.obj`
   * @api private
   */

  Assertion.prototype.assert = function (expr, msg, negateMsg, expected, _actual, showDiff) {
    var ok = util.test(this, arguments);
    if (true !== showDiff) showDiff = false;
    if (true !== config.showDiff) showDiff = false;

    if (!ok) {
      var msg = util.getMessage(this, arguments)
        , actual = util.getActual(this, arguments);
      throw new AssertionError(msg, {
          actual: actual
        , expected: expected
        , showDiff: showDiff
      }, (config.includeStack) ? this.assert : flag(this, 'ssfi'));
    }
  };

  /*!
   * ### ._obj
   *
   * Quick reference to stored `actual` value for plugin developers.
   *
   * @api private
   */

  Object.defineProperty(Assertion.prototype, '_obj',
    { get: function () {
        return flag(this, 'object');
      }
    , set: function (val) {
        flag(this, 'object', val);
      }
  });
};

},{"./config":16}],16:[function(require,module,exports){
module.exports = {

  /**
   * ### config.includeStack
   *
   * User configurable property, influences whether stack trace
   * is included in Assertion error message. Default of false
   * suppresses stack trace in the error message.
   *
   *     chai.config.includeStack = true;  // enable stack on error
   *
   * @param {Boolean}
   * @api public
   */

   includeStack: false,

  /**
   * ### config.showDiff
   *
   * User configurable property, influences whether or not
   * the `showDiff` flag should be included in the thrown
   * AssertionErrors. `false` will always be `false`; `true`
   * will be true when the assertion has requested a diff
   * be shown.
   *
   * @param {Boolean}
   * @api public
   */

  showDiff: true,

  /**
   * ### config.truncateThreshold
   *
   * User configurable property, sets length threshold for actual and
   * expected values in assertion errors. If this threshold is exceeded,
   * the value is truncated.
   *
   * Set it to zero if you want to disable truncating altogether.
   *
   *     chai.config.truncateThreshold = 0;  // disable truncating
   *
   * @param {Number}
   * @api public
   */

  truncateThreshold: 40

};

},{}],17:[function(require,module,exports){
/*!
 * chai
 * http://chaijs.com
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai, _) {
  var Assertion = chai.Assertion
    , toString = Object.prototype.toString
    , flag = _.flag;

  /**
   * ### Language Chains
   *
   * The following are provided as chainable getters to
   * improve the readability of your assertions. They
   * do not provide testing capabilities unless they
   * have been overwritten by a plugin.
   *
   * **Chains**
   *
   * - to
   * - be
   * - been
   * - is
   * - that
   * - and
   * - has
   * - have
   * - with
   * - at
   * - of
   * - same
   *
   * @name language chains
   * @api public
   */

  [ 'to', 'be', 'been'
  , 'is', 'and', 'has', 'have'
  , 'with', 'that', 'at'
  , 'of', 'same' ].forEach(function (chain) {
    Assertion.addProperty(chain, function () {
      return this;
    });
  });

  /**
   * ### .not
   *
   * Negates any of assertions following in the chain.
   *
   *     expect(foo).to.not.equal('bar');
   *     expect(goodFn).to.not.throw(Error);
   *     expect({ foo: 'baz' }).to.have.property('foo')
   *       .and.not.equal('bar');
   *
   * @name not
   * @api public
   */

  Assertion.addProperty('not', function () {
    flag(this, 'negate', true);
  });

  /**
   * ### .deep
   *
   * Sets the `deep` flag, later used by the `equal` and
   * `property` assertions.
   *
   *     expect(foo).to.deep.equal({ bar: 'baz' });
   *     expect({ foo: { bar: { baz: 'quux' } } })
   *       .to.have.deep.property('foo.bar.baz', 'quux');
   *
   * @name deep
   * @api public
   */

  Assertion.addProperty('deep', function () {
    flag(this, 'deep', true);
  });

  /**
   * ### .a(type)
   *
   * The `a` and `an` assertions are aliases that can be
   * used either as language chains or to assert a value's
   * type.
   *
   *     // typeof
   *     expect('test').to.be.a('string');
   *     expect({ foo: 'bar' }).to.be.an('object');
   *     expect(null).to.be.a('null');
   *     expect(undefined).to.be.an('undefined');
   *
   *     // language chain
   *     expect(foo).to.be.an.instanceof(Foo);
   *
   * @name a
   * @alias an
   * @param {String} type
   * @param {String} message _optional_
   * @api public
   */

  function an (type, msg) {
    if (msg) flag(this, 'message', msg);
    type = type.toLowerCase();
    var obj = flag(this, 'object')
      , article = ~[ 'a', 'e', 'i', 'o', 'u' ].indexOf(type.charAt(0)) ? 'an ' : 'a ';

    this.assert(
        type === _.type(obj)
      , 'expected #{this} to be ' + article + type
      , 'expected #{this} not to be ' + article + type
    );
  }

  Assertion.addChainableMethod('an', an);
  Assertion.addChainableMethod('a', an);

  /**
   * ### .include(value)
   *
   * The `include` and `contain` assertions can be used as either property
   * based language chains or as methods to assert the inclusion of an object
   * in an array or a substring in a string. When used as language chains,
   * they toggle the `contain` flag for the `keys` assertion.
   *
   *     expect([1,2,3]).to.include(2);
   *     expect('foobar').to.contain('foo');
   *     expect({ foo: 'bar', hello: 'universe' }).to.include.keys('foo');
   *
   * @name include
   * @alias contain
   * @param {Object|String|Number} obj
   * @param {String} message _optional_
   * @api public
   */

  function includeChainingBehavior () {
    flag(this, 'contains', true);
  }

  function include (val, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    var expected = false;
    if (_.type(obj) === 'array' && _.type(val) === 'object') {
      for (var i in obj) {
        if (_.eql(obj[i], val)) {
          expected = true;
          break;
        }
      }
    } else if (_.type(val) === 'object') {
      if (!flag(this, 'negate')) {
        for (var k in val) new Assertion(obj).property(k, val[k]);
        return;
      }
      var subset = {}
      for (var k in val) subset[k] = obj[k]
      expected = _.eql(subset, val);
    } else {
      expected = obj && ~obj.indexOf(val)
    }
    this.assert(
        expected
      , 'expected #{this} to include ' + _.inspect(val)
      , 'expected #{this} to not include ' + _.inspect(val));
  }

  Assertion.addChainableMethod('include', include, includeChainingBehavior);
  Assertion.addChainableMethod('contain', include, includeChainingBehavior);

  /**
   * ### .ok
   *
   * Asserts that the target is truthy.
   *
   *     expect('everthing').to.be.ok;
   *     expect(1).to.be.ok;
   *     expect(false).to.not.be.ok;
   *     expect(undefined).to.not.be.ok;
   *     expect(null).to.not.be.ok;
   *
   * @name ok
   * @api public
   */

  Assertion.addProperty('ok', function () {
    this.assert(
        flag(this, 'object')
      , 'expected #{this} to be truthy'
      , 'expected #{this} to be falsy');
  });

  /**
   * ### .true
   *
   * Asserts that the target is `true`.
   *
   *     expect(true).to.be.true;
   *     expect(1).to.not.be.true;
   *
   * @name true
   * @api public
   */

  Assertion.addProperty('true', function () {
    this.assert(
        true === flag(this, 'object')
      , 'expected #{this} to be true'
      , 'expected #{this} to be false'
      , this.negate ? false : true
    );
  });

  /**
   * ### .false
   *
   * Asserts that the target is `false`.
   *
   *     expect(false).to.be.false;
   *     expect(0).to.not.be.false;
   *
   * @name false
   * @api public
   */

  Assertion.addProperty('false', function () {
    this.assert(
        false === flag(this, 'object')
      , 'expected #{this} to be false'
      , 'expected #{this} to be true'
      , this.negate ? true : false
    );
  });

  /**
   * ### .null
   *
   * Asserts that the target is `null`.
   *
   *     expect(null).to.be.null;
   *     expect(undefined).not.to.be.null;
   *
   * @name null
   * @api public
   */

  Assertion.addProperty('null', function () {
    this.assert(
        null === flag(this, 'object')
      , 'expected #{this} to be null'
      , 'expected #{this} not to be null'
    );
  });

  /**
   * ### .undefined
   *
   * Asserts that the target is `undefined`.
   *
   *     expect(undefined).to.be.undefined;
   *     expect(null).to.not.be.undefined;
   *
   * @name undefined
   * @api public
   */

  Assertion.addProperty('undefined', function () {
    this.assert(
        undefined === flag(this, 'object')
      , 'expected #{this} to be undefined'
      , 'expected #{this} not to be undefined'
    );
  });

  /**
   * ### .exist
   *
   * Asserts that the target is neither `null` nor `undefined`.
   *
   *     var foo = 'hi'
   *       , bar = null
   *       , baz;
   *
   *     expect(foo).to.exist;
   *     expect(bar).to.not.exist;
   *     expect(baz).to.not.exist;
   *
   * @name exist
   * @api public
   */

  Assertion.addProperty('exist', function () {
    this.assert(
        null != flag(this, 'object')
      , 'expected #{this} to exist'
      , 'expected #{this} to not exist'
    );
  });


  /**
   * ### .empty
   *
   * Asserts that the target's length is `0`. For arrays, it checks
   * the `length` property. For objects, it gets the count of
   * enumerable keys.
   *
   *     expect([]).to.be.empty;
   *     expect('').to.be.empty;
   *     expect({}).to.be.empty;
   *
   * @name empty
   * @api public
   */

  Assertion.addProperty('empty', function () {
    var obj = flag(this, 'object')
      , expected = obj;

    if (Array.isArray(obj) || 'string' === typeof object) {
      expected = obj.length;
    } else if (typeof obj === 'object') {
      expected = Object.keys(obj).length;
    }

    this.assert(
        !expected
      , 'expected #{this} to be empty'
      , 'expected #{this} not to be empty'
    );
  });

  /**
   * ### .arguments
   *
   * Asserts that the target is an arguments object.
   *
   *     function test () {
   *       expect(arguments).to.be.arguments;
   *     }
   *
   * @name arguments
   * @alias Arguments
   * @api public
   */

  function checkArguments () {
    var obj = flag(this, 'object')
      , type = Object.prototype.toString.call(obj);
    this.assert(
        '[object Arguments]' === type
      , 'expected #{this} to be arguments but got ' + type
      , 'expected #{this} to not be arguments'
    );
  }

  Assertion.addProperty('arguments', checkArguments);
  Assertion.addProperty('Arguments', checkArguments);

  /**
   * ### .equal(value)
   *
   * Asserts that the target is strictly equal (`===`) to `value`.
   * Alternately, if the `deep` flag is set, asserts that
   * the target is deeply equal to `value`.
   *
   *     expect('hello').to.equal('hello');
   *     expect(42).to.equal(42);
   *     expect(1).to.not.equal(true);
   *     expect({ foo: 'bar' }).to.not.equal({ foo: 'bar' });
   *     expect({ foo: 'bar' }).to.deep.equal({ foo: 'bar' });
   *
   * @name equal
   * @alias equals
   * @alias eq
   * @alias deep.equal
   * @param {Mixed} value
   * @param {String} message _optional_
   * @api public
   */

  function assertEqual (val, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    if (flag(this, 'deep')) {
      return this.eql(val);
    } else {
      this.assert(
          val === obj
        , 'expected #{this} to equal #{exp}'
        , 'expected #{this} to not equal #{exp}'
        , val
        , this._obj
        , true
      );
    }
  }

  Assertion.addMethod('equal', assertEqual);
  Assertion.addMethod('equals', assertEqual);
  Assertion.addMethod('eq', assertEqual);

  /**
   * ### .eql(value)
   *
   * Asserts that the target is deeply equal to `value`.
   *
   *     expect({ foo: 'bar' }).to.eql({ foo: 'bar' });
   *     expect([ 1, 2, 3 ]).to.eql([ 1, 2, 3 ]);
   *
   * @name eql
   * @alias eqls
   * @param {Mixed} value
   * @param {String} message _optional_
   * @api public
   */

  function assertEql(obj, msg) {
    if (msg) flag(this, 'message', msg);
    this.assert(
        _.eql(obj, flag(this, 'object'))
      , 'expected #{this} to deeply equal #{exp}'
      , 'expected #{this} to not deeply equal #{exp}'
      , obj
      , this._obj
      , true
    );
  }

  Assertion.addMethod('eql', assertEql);
  Assertion.addMethod('eqls', assertEql);

  /**
   * ### .above(value)
   *
   * Asserts that the target is greater than `value`.
   *
   *     expect(10).to.be.above(5);
   *
   * Can also be used in conjunction with `length` to
   * assert a minimum length. The benefit being a
   * more informative error message than if the length
   * was supplied directly.
   *
   *     expect('foo').to.have.length.above(2);
   *     expect([ 1, 2, 3 ]).to.have.length.above(2);
   *
   * @name above
   * @alias gt
   * @alias greaterThan
   * @param {Number} value
   * @param {String} message _optional_
   * @api public
   */

  function assertAbove (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    if (flag(this, 'doLength')) {
      new Assertion(obj, msg).to.have.property('length');
      var len = obj.length;
      this.assert(
          len > n
        , 'expected #{this} to have a length above #{exp} but got #{act}'
        , 'expected #{this} to not have a length above #{exp}'
        , n
        , len
      );
    } else {
      this.assert(
          obj > n
        , 'expected #{this} to be above ' + n
        , 'expected #{this} to be at most ' + n
      );
    }
  }

  Assertion.addMethod('above', assertAbove);
  Assertion.addMethod('gt', assertAbove);
  Assertion.addMethod('greaterThan', assertAbove);

  /**
   * ### .least(value)
   *
   * Asserts that the target is greater than or equal to `value`.
   *
   *     expect(10).to.be.at.least(10);
   *
   * Can also be used in conjunction with `length` to
   * assert a minimum length. The benefit being a
   * more informative error message than if the length
   * was supplied directly.
   *
   *     expect('foo').to.have.length.of.at.least(2);
   *     expect([ 1, 2, 3 ]).to.have.length.of.at.least(3);
   *
   * @name least
   * @alias gte
   * @param {Number} value
   * @param {String} message _optional_
   * @api public
   */

  function assertLeast (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    if (flag(this, 'doLength')) {
      new Assertion(obj, msg).to.have.property('length');
      var len = obj.length;
      this.assert(
          len >= n
        , 'expected #{this} to have a length at least #{exp} but got #{act}'
        , 'expected #{this} to have a length below #{exp}'
        , n
        , len
      );
    } else {
      this.assert(
          obj >= n
        , 'expected #{this} to be at least ' + n
        , 'expected #{this} to be below ' + n
      );
    }
  }

  Assertion.addMethod('least', assertLeast);
  Assertion.addMethod('gte', assertLeast);

  /**
   * ### .below(value)
   *
   * Asserts that the target is less than `value`.
   *
   *     expect(5).to.be.below(10);
   *
   * Can also be used in conjunction with `length` to
   * assert a maximum length. The benefit being a
   * more informative error message than if the length
   * was supplied directly.
   *
   *     expect('foo').to.have.length.below(4);
   *     expect([ 1, 2, 3 ]).to.have.length.below(4);
   *
   * @name below
   * @alias lt
   * @alias lessThan
   * @param {Number} value
   * @param {String} message _optional_
   * @api public
   */

  function assertBelow (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    if (flag(this, 'doLength')) {
      new Assertion(obj, msg).to.have.property('length');
      var len = obj.length;
      this.assert(
          len < n
        , 'expected #{this} to have a length below #{exp} but got #{act}'
        , 'expected #{this} to not have a length below #{exp}'
        , n
        , len
      );
    } else {
      this.assert(
          obj < n
        , 'expected #{this} to be below ' + n
        , 'expected #{this} to be at least ' + n
      );
    }
  }

  Assertion.addMethod('below', assertBelow);
  Assertion.addMethod('lt', assertBelow);
  Assertion.addMethod('lessThan', assertBelow);

  /**
   * ### .most(value)
   *
   * Asserts that the target is less than or equal to `value`.
   *
   *     expect(5).to.be.at.most(5);
   *
   * Can also be used in conjunction with `length` to
   * assert a maximum length. The benefit being a
   * more informative error message than if the length
   * was supplied directly.
   *
   *     expect('foo').to.have.length.of.at.most(4);
   *     expect([ 1, 2, 3 ]).to.have.length.of.at.most(3);
   *
   * @name most
   * @alias lte
   * @param {Number} value
   * @param {String} message _optional_
   * @api public
   */

  function assertMost (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    if (flag(this, 'doLength')) {
      new Assertion(obj, msg).to.have.property('length');
      var len = obj.length;
      this.assert(
          len <= n
        , 'expected #{this} to have a length at most #{exp} but got #{act}'
        , 'expected #{this} to have a length above #{exp}'
        , n
        , len
      );
    } else {
      this.assert(
          obj <= n
        , 'expected #{this} to be at most ' + n
        , 'expected #{this} to be above ' + n
      );
    }
  }

  Assertion.addMethod('most', assertMost);
  Assertion.addMethod('lte', assertMost);

  /**
   * ### .within(start, finish)
   *
   * Asserts that the target is within a range.
   *
   *     expect(7).to.be.within(5,10);
   *
   * Can also be used in conjunction with `length` to
   * assert a length range. The benefit being a
   * more informative error message than if the length
   * was supplied directly.
   *
   *     expect('foo').to.have.length.within(2,4);
   *     expect([ 1, 2, 3 ]).to.have.length.within(2,4);
   *
   * @name within
   * @param {Number} start lowerbound inclusive
   * @param {Number} finish upperbound inclusive
   * @param {String} message _optional_
   * @api public
   */

  Assertion.addMethod('within', function (start, finish, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , range = start + '..' + finish;
    if (flag(this, 'doLength')) {
      new Assertion(obj, msg).to.have.property('length');
      var len = obj.length;
      this.assert(
          len >= start && len <= finish
        , 'expected #{this} to have a length within ' + range
        , 'expected #{this} to not have a length within ' + range
      );
    } else {
      this.assert(
          obj >= start && obj <= finish
        , 'expected #{this} to be within ' + range
        , 'expected #{this} to not be within ' + range
      );
    }
  });

  /**
   * ### .instanceof(constructor)
   *
   * Asserts that the target is an instance of `constructor`.
   *
   *     var Tea = function (name) { this.name = name; }
   *       , Chai = new Tea('chai');
   *
   *     expect(Chai).to.be.an.instanceof(Tea);
   *     expect([ 1, 2, 3 ]).to.be.instanceof(Array);
   *
   * @name instanceof
   * @param {Constructor} constructor
   * @param {String} message _optional_
   * @alias instanceOf
   * @api public
   */

  function assertInstanceOf (constructor, msg) {
    if (msg) flag(this, 'message', msg);
    var name = _.getName(constructor);
    this.assert(
        flag(this, 'object') instanceof constructor
      , 'expected #{this} to be an instance of ' + name
      , 'expected #{this} to not be an instance of ' + name
    );
  };

  Assertion.addMethod('instanceof', assertInstanceOf);
  Assertion.addMethod('instanceOf', assertInstanceOf);

  /**
   * ### .property(name, [value])
   *
   * Asserts that the target has a property `name`, optionally asserting that
   * the value of that property is strictly equal to  `value`.
   * If the `deep` flag is set, you can use dot- and bracket-notation for deep
   * references into objects and arrays.
   *
   *     // simple referencing
   *     var obj = { foo: 'bar' };
   *     expect(obj).to.have.property('foo');
   *     expect(obj).to.have.property('foo', 'bar');
   *
   *     // deep referencing
   *     var deepObj = {
   *         green: { tea: 'matcha' }
   *       , teas: [ 'chai', 'matcha', { tea: 'konacha' } ]
   *     };

   *     expect(deepObj).to.have.deep.property('green.tea', 'matcha');
   *     expect(deepObj).to.have.deep.property('teas[1]', 'matcha');
   *     expect(deepObj).to.have.deep.property('teas[2].tea', 'konacha');
   *
   * You can also use an array as the starting point of a `deep.property`
   * assertion, or traverse nested arrays.
   *
   *     var arr = [
   *         [ 'chai', 'matcha', 'konacha' ]
   *       , [ { tea: 'chai' }
   *         , { tea: 'matcha' }
   *         , { tea: 'konacha' } ]
   *     ];
   *
   *     expect(arr).to.have.deep.property('[0][1]', 'matcha');
   *     expect(arr).to.have.deep.property('[1][2].tea', 'konacha');
   *
   * Furthermore, `property` changes the subject of the assertion
   * to be the value of that property from the original object. This
   * permits for further chainable assertions on that property.
   *
   *     expect(obj).to.have.property('foo')
   *       .that.is.a('string');
   *     expect(deepObj).to.have.property('green')
   *       .that.is.an('object')
   *       .that.deep.equals({ tea: 'matcha' });
   *     expect(deepObj).to.have.property('teas')
   *       .that.is.an('array')
   *       .with.deep.property('[2]')
   *         .that.deep.equals({ tea: 'konacha' });
   *
   * @name property
   * @alias deep.property
   * @param {String} name
   * @param {Mixed} value (optional)
   * @param {String} message _optional_
   * @returns value of property for chaining
   * @api public
   */

  Assertion.addMethod('property', function (name, val, msg) {
    if (msg) flag(this, 'message', msg);

    var descriptor = flag(this, 'deep') ? 'deep property ' : 'property '
      , negate = flag(this, 'negate')
      , obj = flag(this, 'object')
      , value = flag(this, 'deep')
        ? _.getPathValue(name, obj)
        : obj[name];

    if (negate && undefined !== val) {
      if (undefined === value) {
        msg = (msg != null) ? msg + ': ' : '';
        throw new Error(msg + _.inspect(obj) + ' has no ' + descriptor + _.inspect(name));
      }
    } else {
      this.assert(
          undefined !== value
        , 'expected #{this} to have a ' + descriptor + _.inspect(name)
        , 'expected #{this} to not have ' + descriptor + _.inspect(name));
    }

    if (undefined !== val) {
      this.assert(
          val === value
        , 'expected #{this} to have a ' + descriptor + _.inspect(name) + ' of #{exp}, but got #{act}'
        , 'expected #{this} to not have a ' + descriptor + _.inspect(name) + ' of #{act}'
        , val
        , value
      );
    }

    flag(this, 'object', value);
  });


  /**
   * ### .ownProperty(name)
   *
   * Asserts that the target has an own property `name`.
   *
   *     expect('test').to.have.ownProperty('length');
   *
   * @name ownProperty
   * @alias haveOwnProperty
   * @param {String} name
   * @param {String} message _optional_
   * @api public
   */

  function assertOwnProperty (name, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    this.assert(
        obj.hasOwnProperty(name)
      , 'expected #{this} to have own property ' + _.inspect(name)
      , 'expected #{this} to not have own property ' + _.inspect(name)
    );
  }

  Assertion.addMethod('ownProperty', assertOwnProperty);
  Assertion.addMethod('haveOwnProperty', assertOwnProperty);

  /**
   * ### .length(value)
   *
   * Asserts that the target's `length` property has
   * the expected value.
   *
   *     expect([ 1, 2, 3]).to.have.length(3);
   *     expect('foobar').to.have.length(6);
   *
   * Can also be used as a chain precursor to a value
   * comparison for the length property.
   *
   *     expect('foo').to.have.length.above(2);
   *     expect([ 1, 2, 3 ]).to.have.length.above(2);
   *     expect('foo').to.have.length.below(4);
   *     expect([ 1, 2, 3 ]).to.have.length.below(4);
   *     expect('foo').to.have.length.within(2,4);
   *     expect([ 1, 2, 3 ]).to.have.length.within(2,4);
   *
   * @name length
   * @alias lengthOf
   * @param {Number} length
   * @param {String} message _optional_
   * @api public
   */

  function assertLengthChain () {
    flag(this, 'doLength', true);
  }

  function assertLength (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    new Assertion(obj, msg).to.have.property('length');
    var len = obj.length;

    this.assert(
        len == n
      , 'expected #{this} to have a length of #{exp} but got #{act}'
      , 'expected #{this} to not have a length of #{act}'
      , n
      , len
    );
  }

  Assertion.addChainableMethod('length', assertLength, assertLengthChain);
  Assertion.addMethod('lengthOf', assertLength, assertLengthChain);

  /**
   * ### .match(regexp)
   *
   * Asserts that the target matches a regular expression.
   *
   *     expect('foobar').to.match(/^foo/);
   *
   * @name match
   * @param {RegExp} RegularExpression
   * @param {String} message _optional_
   * @api public
   */

  Assertion.addMethod('match', function (re, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    this.assert(
        re.exec(obj)
      , 'expected #{this} to match ' + re
      , 'expected #{this} not to match ' + re
    );
  });

  /**
   * ### .string(string)
   *
   * Asserts that the string target contains another string.
   *
   *     expect('foobar').to.have.string('bar');
   *
   * @name string
   * @param {String} string
   * @param {String} message _optional_
   * @api public
   */

  Assertion.addMethod('string', function (str, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    new Assertion(obj, msg).is.a('string');

    this.assert(
        ~obj.indexOf(str)
      , 'expected #{this} to contain ' + _.inspect(str)
      , 'expected #{this} to not contain ' + _.inspect(str)
    );
  });


  /**
   * ### .keys(key1, [key2], [...])
   *
   * Asserts that the target has exactly the given keys, or
   * asserts the inclusion of some keys when using the
   * `include` or `contain` modifiers.
   *
   *     expect({ foo: 1, bar: 2 }).to.have.keys(['foo', 'bar']);
   *     expect({ foo: 1, bar: 2, baz: 3 }).to.contain.keys('foo', 'bar');
   *
   * @name keys
   * @alias key
   * @param {String...|Array} keys
   * @api public
   */

  function assertKeys (keys) {
    var obj = flag(this, 'object')
      , str
      , ok = true;

    keys = keys instanceof Array
      ? keys
      : Array.prototype.slice.call(arguments);

    if (!keys.length) throw new Error('keys required');

    var actual = Object.keys(obj)
      , len = keys.length;

    // Inclusion
    ok = keys.every(function(key){
      return ~actual.indexOf(key);
    });

    // Strict
    if (!flag(this, 'negate') && !flag(this, 'contains')) {
      ok = ok && keys.length == actual.length;
    }

    // Key string
    if (len > 1) {
      keys = keys.map(function(key){
        return _.inspect(key);
      });
      var last = keys.pop();
      str = keys.join(', ') + ', and ' + last;
    } else {
      str = _.inspect(keys[0]);
    }

    // Form
    str = (len > 1 ? 'keys ' : 'key ') + str;

    // Have / include
    str = (flag(this, 'contains') ? 'contain ' : 'have ') + str;

    // Assertion
    this.assert(
        ok
      , 'expected #{this} to ' + str
      , 'expected #{this} to not ' + str
    );
  }

  Assertion.addMethod('keys', assertKeys);
  Assertion.addMethod('key', assertKeys);

  /**
   * ### .throw(constructor)
   *
   * Asserts that the function target will throw a specific error, or specific type of error
   * (as determined using `instanceof`), optionally with a RegExp or string inclusion test
   * for the error's message.
   *
   *     var err = new ReferenceError('This is a bad function.');
   *     var fn = function () { throw err; }
   *     expect(fn).to.throw(ReferenceError);
   *     expect(fn).to.throw(Error);
   *     expect(fn).to.throw(/bad function/);
   *     expect(fn).to.not.throw('good function');
   *     expect(fn).to.throw(ReferenceError, /bad function/);
   *     expect(fn).to.throw(err);
   *     expect(fn).to.not.throw(new RangeError('Out of range.'));
   *
   * Please note that when a throw expectation is negated, it will check each
   * parameter independently, starting with error constructor type. The appropriate way
   * to check for the existence of a type of error but for a message that does not match
   * is to use `and`.
   *
   *     expect(fn).to.throw(ReferenceError)
   *        .and.not.throw(/good function/);
   *
   * @name throw
   * @alias throws
   * @alias Throw
   * @param {ErrorConstructor} constructor
   * @param {String|RegExp} expected error message
   * @param {String} message _optional_
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
   * @returns error for chaining (null if no error)
   * @api public
   */

  function assertThrows (constructor, errMsg, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    new Assertion(obj, msg).is.a('function');

    var thrown = false
      , desiredError = null
      , name = null
      , thrownError = null;

    if (arguments.length === 0) {
      errMsg = null;
      constructor = null;
    } else if (constructor && (constructor instanceof RegExp || 'string' === typeof constructor)) {
      errMsg = constructor;
      constructor = null;
    } else if (constructor && constructor instanceof Error) {
      desiredError = constructor;
      constructor = null;
      errMsg = null;
    } else if (typeof constructor === 'function') {
      name = constructor.prototype.name || constructor.name;
      if (name === 'Error' && constructor !== Error) {
        name = (new constructor()).name;
      }
    } else {
      constructor = null;
    }

    try {
      obj();
    } catch (err) {
      // first, check desired error
      if (desiredError) {
        this.assert(
            err === desiredError
          , 'expected #{this} to throw #{exp} but #{act} was thrown'
          , 'expected #{this} to not throw #{exp}'
          , (desiredError instanceof Error ? desiredError.toString() : desiredError)
          , (err instanceof Error ? err.toString() : err)
        );

        flag(this, 'object', err);
        return this;
      }

      // next, check constructor
      if (constructor) {
        this.assert(
            err instanceof constructor
          , 'expected #{this} to throw #{exp} but #{act} was thrown'
          , 'expected #{this} to not throw #{exp} but #{act} was thrown'
          , name
          , (err instanceof Error ? err.toString() : err)
        );

        if (!errMsg) {
          flag(this, 'object', err);
          return this;
        }
      }

      // next, check message
      var message = 'object' === _.type(err) && "message" in err
        ? err.message
        : '' + err;

      if ((message != null) && errMsg && errMsg instanceof RegExp) {
        this.assert(
            errMsg.exec(message)
          , 'expected #{this} to throw error matching #{exp} but got #{act}'
          , 'expected #{this} to throw error not matching #{exp}'
          , errMsg
          , message
        );

        flag(this, 'object', err);
        return this;
      } else if ((message != null) && errMsg && 'string' === typeof errMsg) {
        this.assert(
            ~message.indexOf(errMsg)
          , 'expected #{this} to throw error including #{exp} but got #{act}'
          , 'expected #{this} to throw error not including #{act}'
          , errMsg
          , message
        );

        flag(this, 'object', err);
        return this;
      } else {
        thrown = true;
        thrownError = err;
      }
    }

    var actuallyGot = ''
      , expectedThrown = name !== null
        ? name
        : desiredError
          ? '#{exp}' //_.inspect(desiredError)
          : 'an error';

    if (thrown) {
      actuallyGot = ' but #{act} was thrown'
    }

    this.assert(
        thrown === true
      , 'expected #{this} to throw ' + expectedThrown + actuallyGot
      , 'expected #{this} to not throw ' + expectedThrown + actuallyGot
      , (desiredError instanceof Error ? desiredError.toString() : desiredError)
      , (thrownError instanceof Error ? thrownError.toString() : thrownError)
    );

    flag(this, 'object', thrownError);
  };

  Assertion.addMethod('throw', assertThrows);
  Assertion.addMethod('throws', assertThrows);
  Assertion.addMethod('Throw', assertThrows);

  /**
   * ### .respondTo(method)
   *
   * Asserts that the object or class target will respond to a method.
   *
   *     Klass.prototype.bar = function(){};
   *     expect(Klass).to.respondTo('bar');
   *     expect(obj).to.respondTo('bar');
   *
   * To check if a constructor will respond to a static function,
   * set the `itself` flag.
   *
   *     Klass.baz = function(){};
   *     expect(Klass).itself.to.respondTo('baz');
   *
   * @name respondTo
   * @param {String} method
   * @param {String} message _optional_
   * @api public
   */

  Assertion.addMethod('respondTo', function (method, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , itself = flag(this, 'itself')
      , context = ('function' === _.type(obj) && !itself)
        ? obj.prototype[method]
        : obj[method];

    this.assert(
        'function' === typeof context
      , 'expected #{this} to respond to ' + _.inspect(method)
      , 'expected #{this} to not respond to ' + _.inspect(method)
    );
  });

  /**
   * ### .itself
   *
   * Sets the `itself` flag, later used by the `respondTo` assertion.
   *
   *     function Foo() {}
   *     Foo.bar = function() {}
   *     Foo.prototype.baz = function() {}
   *
   *     expect(Foo).itself.to.respondTo('bar');
   *     expect(Foo).itself.not.to.respondTo('baz');
   *
   * @name itself
   * @api public
   */

  Assertion.addProperty('itself', function () {
    flag(this, 'itself', true);
  });

  /**
   * ### .satisfy(method)
   *
   * Asserts that the target passes a given truth test.
   *
   *     expect(1).to.satisfy(function(num) { return num > 0; });
   *
   * @name satisfy
   * @param {Function} matcher
   * @param {String} message _optional_
   * @api public
   */

  Assertion.addMethod('satisfy', function (matcher, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    this.assert(
        matcher(obj)
      , 'expected #{this} to satisfy ' + _.objDisplay(matcher)
      , 'expected #{this} to not satisfy' + _.objDisplay(matcher)
      , this.negate ? false : true
      , matcher(obj)
    );
  });

  /**
   * ### .closeTo(expected, delta)
   *
   * Asserts that the target is equal `expected`, to within a +/- `delta` range.
   *
   *     expect(1.5).to.be.closeTo(1, 0.5);
   *
   * @name closeTo
   * @param {Number} expected
   * @param {Number} delta
   * @param {String} message _optional_
   * @api public
   */

  Assertion.addMethod('closeTo', function (expected, delta, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    this.assert(
        Math.abs(obj - expected) <= delta
      , 'expected #{this} to be close to ' + expected + ' +/- ' + delta
      , 'expected #{this} not to be close to ' + expected + ' +/- ' + delta
    );
  });

  function isSubsetOf(subset, superset, cmp) {
    return subset.every(function(elem) {
      if (!cmp) return superset.indexOf(elem) !== -1;

      return superset.some(function(elem2) {
        return cmp(elem, elem2);
      });
    })
  }

  /**
   * ### .members(set)
   *
   * Asserts that the target is a superset of `set`,
   * or that the target and `set` have the same strictly-equal (===) members.
   * Alternately, if the `deep` flag is set, set members are compared for deep
   * equality.
   *
   *     expect([1, 2, 3]).to.include.members([3, 2]);
   *     expect([1, 2, 3]).to.not.include.members([3, 2, 8]);
   *
   *     expect([4, 2]).to.have.members([2, 4]);
   *     expect([5, 2]).to.not.have.members([5, 2, 1]);
   *
   *     expect([{ id: 1 }]).to.deep.include.members([{ id: 1 }]);
   *
   * @name members
   * @param {Array} set
   * @param {String} message _optional_
   * @api public
   */

  Assertion.addMethod('members', function (subset, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');

    new Assertion(obj).to.be.an('array');
    new Assertion(subset).to.be.an('array');

    var cmp = flag(this, 'deep') ? _.eql : undefined;

    if (flag(this, 'contains')) {
      return this.assert(
          isSubsetOf(subset, obj, cmp)
        , 'expected #{this} to be a superset of #{act}'
        , 'expected #{this} to not be a superset of #{act}'
        , obj
        , subset
      );
    }

    this.assert(
        isSubsetOf(obj, subset, cmp) && isSubsetOf(subset, obj, cmp)
        , 'expected #{this} to have the same members as #{act}'
        , 'expected #{this} to not have the same members as #{act}'
        , obj
        , subset
    );
  });
};

},{}],18:[function(require,module,exports){
/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */


module.exports = function (chai, util) {

  /*!
   * Chai dependencies.
   */

  var Assertion = chai.Assertion
    , flag = util.flag;

  /*!
   * Module export.
   */

  /**
   * ### assert(expression, message)
   *
   * Write your own test expressions.
   *
   *     assert('foo' !== 'bar', 'foo is not bar');
   *     assert(Array.isArray([]), 'empty arrays are arrays');
   *
   * @param {Mixed} expression to test for truthiness
   * @param {String} message to display on error
   * @name assert
   * @api public
   */

  var assert = chai.assert = function (express, errmsg) {
    var test = new Assertion(null, null, chai.assert);
    test.assert(
        express
      , errmsg
      , '[ negation message unavailable ]'
    );
  };

  /**
   * ### .fail(actual, expected, [message], [operator])
   *
   * Throw a failure. Node.js `assert` module-compatible.
   *
   * @name fail
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @param {String} operator
   * @api public
   */

  assert.fail = function (actual, expected, message, operator) {
    message = message || 'assert.fail()';
    throw new chai.AssertionError(message, {
        actual: actual
      , expected: expected
      , operator: operator
    }, assert.fail);
  };

  /**
   * ### .ok(object, [message])
   *
   * Asserts that `object` is truthy.
   *
   *     assert.ok('everything', 'everything is ok');
   *     assert.ok(false, 'this will fail');
   *
   * @name ok
   * @param {Mixed} object to test
   * @param {String} message
   * @api public
   */

  assert.ok = function (val, msg) {
    new Assertion(val, msg).is.ok;
  };

  /**
   * ### .notOk(object, [message])
   *
   * Asserts that `object` is falsy.
   *
   *     assert.notOk('everything', 'this will fail');
   *     assert.notOk(false, 'this will pass');
   *
   * @name notOk
   * @param {Mixed} object to test
   * @param {String} message
   * @api public
   */

  assert.notOk = function (val, msg) {
    new Assertion(val, msg).is.not.ok;
  };

  /**
   * ### .equal(actual, expected, [message])
   *
   * Asserts non-strict equality (`==`) of `actual` and `expected`.
   *
   *     assert.equal(3, '3', '== coerces values to strings');
   *
   * @name equal
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @api public
   */

  assert.equal = function (act, exp, msg) {
    var test = new Assertion(act, msg, assert.equal);

    test.assert(
        exp == flag(test, 'object')
      , 'expected #{this} to equal #{exp}'
      , 'expected #{this} to not equal #{act}'
      , exp
      , act
    );
  };

  /**
   * ### .notEqual(actual, expected, [message])
   *
   * Asserts non-strict inequality (`!=`) of `actual` and `expected`.
   *
   *     assert.notEqual(3, 4, 'these numbers are not equal');
   *
   * @name notEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @api public
   */

  assert.notEqual = function (act, exp, msg) {
    var test = new Assertion(act, msg, assert.notEqual);

    test.assert(
        exp != flag(test, 'object')
      , 'expected #{this} to not equal #{exp}'
      , 'expected #{this} to equal #{act}'
      , exp
      , act
    );
  };

  /**
   * ### .strictEqual(actual, expected, [message])
   *
   * Asserts strict equality (`===`) of `actual` and `expected`.
   *
   *     assert.strictEqual(true, true, 'these booleans are strictly equal');
   *
   * @name strictEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @api public
   */

  assert.strictEqual = function (act, exp, msg) {
    new Assertion(act, msg).to.equal(exp);
  };

  /**
   * ### .notStrictEqual(actual, expected, [message])
   *
   * Asserts strict inequality (`!==`) of `actual` and `expected`.
   *
   *     assert.notStrictEqual(3, '3', 'no coercion for strict equality');
   *
   * @name notStrictEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @api public
   */

  assert.notStrictEqual = function (act, exp, msg) {
    new Assertion(act, msg).to.not.equal(exp);
  };

  /**
   * ### .deepEqual(actual, expected, [message])
   *
   * Asserts that `actual` is deeply equal to `expected`.
   *
   *     assert.deepEqual({ tea: 'green' }, { tea: 'green' });
   *
   * @name deepEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @api public
   */

  assert.deepEqual = function (act, exp, msg) {
    new Assertion(act, msg).to.eql(exp);
  };

  /**
   * ### .notDeepEqual(actual, expected, [message])
   *
   * Assert that `actual` is not deeply equal to `expected`.
   *
   *     assert.notDeepEqual({ tea: 'green' }, { tea: 'jasmine' });
   *
   * @name notDeepEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @api public
   */

  assert.notDeepEqual = function (act, exp, msg) {
    new Assertion(act, msg).to.not.eql(exp);
  };

  /**
   * ### .isTrue(value, [message])
   *
   * Asserts that `value` is true.
   *
   *     var teaServed = true;
   *     assert.isTrue(teaServed, 'the tea has been served');
   *
   * @name isTrue
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isTrue = function (val, msg) {
    new Assertion(val, msg).is['true'];
  };

  /**
   * ### .isFalse(value, [message])
   *
   * Asserts that `value` is false.
   *
   *     var teaServed = false;
   *     assert.isFalse(teaServed, 'no tea yet? hmm...');
   *
   * @name isFalse
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isFalse = function (val, msg) {
    new Assertion(val, msg).is['false'];
  };

  /**
   * ### .isNull(value, [message])
   *
   * Asserts that `value` is null.
   *
   *     assert.isNull(err, 'there was no error');
   *
   * @name isNull
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isNull = function (val, msg) {
    new Assertion(val, msg).to.equal(null);
  };

  /**
   * ### .isNotNull(value, [message])
   *
   * Asserts that `value` is not null.
   *
   *     var tea = 'tasty chai';
   *     assert.isNotNull(tea, 'great, time for tea!');
   *
   * @name isNotNull
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isNotNull = function (val, msg) {
    new Assertion(val, msg).to.not.equal(null);
  };

  /**
   * ### .isUndefined(value, [message])
   *
   * Asserts that `value` is `undefined`.
   *
   *     var tea;
   *     assert.isUndefined(tea, 'no tea defined');
   *
   * @name isUndefined
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isUndefined = function (val, msg) {
    new Assertion(val, msg).to.equal(undefined);
  };

  /**
   * ### .isDefined(value, [message])
   *
   * Asserts that `value` is not `undefined`.
   *
   *     var tea = 'cup of chai';
   *     assert.isDefined(tea, 'tea has been defined');
   *
   * @name isDefined
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isDefined = function (val, msg) {
    new Assertion(val, msg).to.not.equal(undefined);
  };

  /**
   * ### .isFunction(value, [message])
   *
   * Asserts that `value` is a function.
   *
   *     function serveTea() { return 'cup of tea'; };
   *     assert.isFunction(serveTea, 'great, we can have tea now');
   *
   * @name isFunction
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isFunction = function (val, msg) {
    new Assertion(val, msg).to.be.a('function');
  };

  /**
   * ### .isNotFunction(value, [message])
   *
   * Asserts that `value` is _not_ a function.
   *
   *     var serveTea = [ 'heat', 'pour', 'sip' ];
   *     assert.isNotFunction(serveTea, 'great, we have listed the steps');
   *
   * @name isNotFunction
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isNotFunction = function (val, msg) {
    new Assertion(val, msg).to.not.be.a('function');
  };

  /**
   * ### .isObject(value, [message])
   *
   * Asserts that `value` is an object (as revealed by
   * `Object.prototype.toString`).
   *
   *     var selection = { name: 'Chai', serve: 'with spices' };
   *     assert.isObject(selection, 'tea selection is an object');
   *
   * @name isObject
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isObject = function (val, msg) {
    new Assertion(val, msg).to.be.a('object');
  };

  /**
   * ### .isNotObject(value, [message])
   *
   * Asserts that `value` is _not_ an object.
   *
   *     var selection = 'chai'
   *     assert.isNotObject(selection, 'tea selection is not an object');
   *     assert.isNotObject(null, 'null is not an object');
   *
   * @name isNotObject
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isNotObject = function (val, msg) {
    new Assertion(val, msg).to.not.be.a('object');
  };

  /**
   * ### .isArray(value, [message])
   *
   * Asserts that `value` is an array.
   *
   *     var menu = [ 'green', 'chai', 'oolong' ];
   *     assert.isArray(menu, 'what kind of tea do we want?');
   *
   * @name isArray
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isArray = function (val, msg) {
    new Assertion(val, msg).to.be.an('array');
  };

  /**
   * ### .isNotArray(value, [message])
   *
   * Asserts that `value` is _not_ an array.
   *
   *     var menu = 'green|chai|oolong';
   *     assert.isNotArray(menu, 'what kind of tea do we want?');
   *
   * @name isNotArray
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isNotArray = function (val, msg) {
    new Assertion(val, msg).to.not.be.an('array');
  };

  /**
   * ### .isString(value, [message])
   *
   * Asserts that `value` is a string.
   *
   *     var teaOrder = 'chai';
   *     assert.isString(teaOrder, 'order placed');
   *
   * @name isString
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isString = function (val, msg) {
    new Assertion(val, msg).to.be.a('string');
  };

  /**
   * ### .isNotString(value, [message])
   *
   * Asserts that `value` is _not_ a string.
   *
   *     var teaOrder = 4;
   *     assert.isNotString(teaOrder, 'order placed');
   *
   * @name isNotString
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isNotString = function (val, msg) {
    new Assertion(val, msg).to.not.be.a('string');
  };

  /**
   * ### .isNumber(value, [message])
   *
   * Asserts that `value` is a number.
   *
   *     var cups = 2;
   *     assert.isNumber(cups, 'how many cups');
   *
   * @name isNumber
   * @param {Number} value
   * @param {String} message
   * @api public
   */

  assert.isNumber = function (val, msg) {
    new Assertion(val, msg).to.be.a('number');
  };

  /**
   * ### .isNotNumber(value, [message])
   *
   * Asserts that `value` is _not_ a number.
   *
   *     var cups = '2 cups please';
   *     assert.isNotNumber(cups, 'how many cups');
   *
   * @name isNotNumber
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isNotNumber = function (val, msg) {
    new Assertion(val, msg).to.not.be.a('number');
  };

  /**
   * ### .isBoolean(value, [message])
   *
   * Asserts that `value` is a boolean.
   *
   *     var teaReady = true
   *       , teaServed = false;
   *
   *     assert.isBoolean(teaReady, 'is the tea ready');
   *     assert.isBoolean(teaServed, 'has tea been served');
   *
   * @name isBoolean
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isBoolean = function (val, msg) {
    new Assertion(val, msg).to.be.a('boolean');
  };

  /**
   * ### .isNotBoolean(value, [message])
   *
   * Asserts that `value` is _not_ a boolean.
   *
   *     var teaReady = 'yep'
   *       , teaServed = 'nope';
   *
   *     assert.isNotBoolean(teaReady, 'is the tea ready');
   *     assert.isNotBoolean(teaServed, 'has tea been served');
   *
   * @name isNotBoolean
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.isNotBoolean = function (val, msg) {
    new Assertion(val, msg).to.not.be.a('boolean');
  };

  /**
   * ### .typeOf(value, name, [message])
   *
   * Asserts that `value`'s type is `name`, as determined by
   * `Object.prototype.toString`.
   *
   *     assert.typeOf({ tea: 'chai' }, 'object', 'we have an object');
   *     assert.typeOf(['chai', 'jasmine'], 'array', 'we have an array');
   *     assert.typeOf('tea', 'string', 'we have a string');
   *     assert.typeOf(/tea/, 'regexp', 'we have a regular expression');
   *     assert.typeOf(null, 'null', 'we have a null');
   *     assert.typeOf(undefined, 'undefined', 'we have an undefined');
   *
   * @name typeOf
   * @param {Mixed} value
   * @param {String} name
   * @param {String} message
   * @api public
   */

  assert.typeOf = function (val, type, msg) {
    new Assertion(val, msg).to.be.a(type);
  };

  /**
   * ### .notTypeOf(value, name, [message])
   *
   * Asserts that `value`'s type is _not_ `name`, as determined by
   * `Object.prototype.toString`.
   *
   *     assert.notTypeOf('tea', 'number', 'strings are not numbers');
   *
   * @name notTypeOf
   * @param {Mixed} value
   * @param {String} typeof name
   * @param {String} message
   * @api public
   */

  assert.notTypeOf = function (val, type, msg) {
    new Assertion(val, msg).to.not.be.a(type);
  };

  /**
   * ### .instanceOf(object, constructor, [message])
   *
   * Asserts that `value` is an instance of `constructor`.
   *
   *     var Tea = function (name) { this.name = name; }
   *       , chai = new Tea('chai');
   *
   *     assert.instanceOf(chai, Tea, 'chai is an instance of tea');
   *
   * @name instanceOf
   * @param {Object} object
   * @param {Constructor} constructor
   * @param {String} message
   * @api public
   */

  assert.instanceOf = function (val, type, msg) {
    new Assertion(val, msg).to.be.instanceOf(type);
  };

  /**
   * ### .notInstanceOf(object, constructor, [message])
   *
   * Asserts `value` is not an instance of `constructor`.
   *
   *     var Tea = function (name) { this.name = name; }
   *       , chai = new String('chai');
   *
   *     assert.notInstanceOf(chai, Tea, 'chai is not an instance of tea');
   *
   * @name notInstanceOf
   * @param {Object} object
   * @param {Constructor} constructor
   * @param {String} message
   * @api public
   */

  assert.notInstanceOf = function (val, type, msg) {
    new Assertion(val, msg).to.not.be.instanceOf(type);
  };

  /**
   * ### .include(haystack, needle, [message])
   *
   * Asserts that `haystack` includes `needle`. Works
   * for strings and arrays.
   *
   *     assert.include('foobar', 'bar', 'foobar contains string "bar"');
   *     assert.include([ 1, 2, 3 ], 3, 'array contains value');
   *
   * @name include
   * @param {Array|String} haystack
   * @param {Mixed} needle
   * @param {String} message
   * @api public
   */

  assert.include = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.include).include(inc);
  };

  /**
   * ### .notInclude(haystack, needle, [message])
   *
   * Asserts that `haystack` does not include `needle`. Works
   * for strings and arrays.
   *i
   *     assert.notInclude('foobar', 'baz', 'string not include substring');
   *     assert.notInclude([ 1, 2, 3 ], 4, 'array not include contain value');
   *
   * @name notInclude
   * @param {Array|String} haystack
   * @param {Mixed} needle
   * @param {String} message
   * @api public
   */

  assert.notInclude = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.notInclude).not.include(inc);
  };

  /**
   * ### .match(value, regexp, [message])
   *
   * Asserts that `value` matches the regular expression `regexp`.
   *
   *     assert.match('foobar', /^foo/, 'regexp matches');
   *
   * @name match
   * @param {Mixed} value
   * @param {RegExp} regexp
   * @param {String} message
   * @api public
   */

  assert.match = function (exp, re, msg) {
    new Assertion(exp, msg).to.match(re);
  };

  /**
   * ### .notMatch(value, regexp, [message])
   *
   * Asserts that `value` does not match the regular expression `regexp`.
   *
   *     assert.notMatch('foobar', /^foo/, 'regexp does not match');
   *
   * @name notMatch
   * @param {Mixed} value
   * @param {RegExp} regexp
   * @param {String} message
   * @api public
   */

  assert.notMatch = function (exp, re, msg) {
    new Assertion(exp, msg).to.not.match(re);
  };

  /**
   * ### .property(object, property, [message])
   *
   * Asserts that `object` has a property named by `property`.
   *
   *     assert.property({ tea: { green: 'matcha' }}, 'tea');
   *
   * @name property
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @api public
   */

  assert.property = function (obj, prop, msg) {
    new Assertion(obj, msg).to.have.property(prop);
  };

  /**
   * ### .notProperty(object, property, [message])
   *
   * Asserts that `object` does _not_ have a property named by `property`.
   *
   *     assert.notProperty({ tea: { green: 'matcha' }}, 'coffee');
   *
   * @name notProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @api public
   */

  assert.notProperty = function (obj, prop, msg) {
    new Assertion(obj, msg).to.not.have.property(prop);
  };

  /**
   * ### .deepProperty(object, property, [message])
   *
   * Asserts that `object` has a property named by `property`, which can be a
   * string using dot- and bracket-notation for deep reference.
   *
   *     assert.deepProperty({ tea: { green: 'matcha' }}, 'tea.green');
   *
   * @name deepProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @api public
   */

  assert.deepProperty = function (obj, prop, msg) {
    new Assertion(obj, msg).to.have.deep.property(prop);
  };

  /**
   * ### .notDeepProperty(object, property, [message])
   *
   * Asserts that `object` does _not_ have a property named by `property`, which
   * can be a string using dot- and bracket-notation for deep reference.
   *
   *     assert.notDeepProperty({ tea: { green: 'matcha' }}, 'tea.oolong');
   *
   * @name notDeepProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @api public
   */

  assert.notDeepProperty = function (obj, prop, msg) {
    new Assertion(obj, msg).to.not.have.deep.property(prop);
  };

  /**
   * ### .propertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a property named by `property` with value given
   * by `value`.
   *
   *     assert.propertyVal({ tea: 'is good' }, 'tea', 'is good');
   *
   * @name propertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.propertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg).to.have.property(prop, val);
  };

  /**
   * ### .propertyNotVal(object, property, value, [message])
   *
   * Asserts that `object` has a property named by `property`, but with a value
   * different from that given by `value`.
   *
   *     assert.propertyNotVal({ tea: 'is good' }, 'tea', 'is bad');
   *
   * @name propertyNotVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.propertyNotVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg).to.not.have.property(prop, val);
  };

  /**
   * ### .deepPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a property named by `property` with value given
   * by `value`. `property` can use dot- and bracket-notation for deep
   * reference.
   *
   *     assert.deepPropertyVal({ tea: { green: 'matcha' }}, 'tea.green', 'matcha');
   *
   * @name deepPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.deepPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg).to.have.deep.property(prop, val);
  };

  /**
   * ### .deepPropertyNotVal(object, property, value, [message])
   *
   * Asserts that `object` has a property named by `property`, but with a value
   * different from that given by `value`. `property` can use dot- and
   * bracket-notation for deep reference.
   *
   *     assert.deepPropertyNotVal({ tea: { green: 'matcha' }}, 'tea.green', 'konacha');
   *
   * @name deepPropertyNotVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.deepPropertyNotVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg).to.not.have.deep.property(prop, val);
  };

  /**
   * ### .lengthOf(object, length, [message])
   *
   * Asserts that `object` has a `length` property with the expected value.
   *
   *     assert.lengthOf([1,2,3], 3, 'array has length of 3');
   *     assert.lengthOf('foobar', 5, 'string has length of 6');
   *
   * @name lengthOf
   * @param {Mixed} object
   * @param {Number} length
   * @param {String} message
   * @api public
   */

  assert.lengthOf = function (exp, len, msg) {
    new Assertion(exp, msg).to.have.length(len);
  };

  /**
   * ### .throws(function, [constructor/string/regexp], [string/regexp], [message])
   *
   * Asserts that `function` will throw an error that is an instance of
   * `constructor`, or alternately that it will throw an error with message
   * matching `regexp`.
   *
   *     assert.throw(fn, 'function throws a reference error');
   *     assert.throw(fn, /function throws a reference error/);
   *     assert.throw(fn, ReferenceError);
   *     assert.throw(fn, ReferenceError, 'function throws a reference error');
   *     assert.throw(fn, ReferenceError, /function throws a reference error/);
   *
   * @name throws
   * @alias throw
   * @alias Throw
   * @param {Function} function
   * @param {ErrorConstructor} constructor
   * @param {RegExp} regexp
   * @param {String} message
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
   * @api public
   */

  assert.Throw = function (fn, errt, errs, msg) {
    if ('string' === typeof errt || errt instanceof RegExp) {
      errs = errt;
      errt = null;
    }

    var assertErr = new Assertion(fn, msg).to.Throw(errt, errs);
    return flag(assertErr, 'object');
  };

  /**
   * ### .doesNotThrow(function, [constructor/regexp], [message])
   *
   * Asserts that `function` will _not_ throw an error that is an instance of
   * `constructor`, or alternately that it will not throw an error with message
   * matching `regexp`.
   *
   *     assert.doesNotThrow(fn, Error, 'function does not throw');
   *
   * @name doesNotThrow
   * @param {Function} function
   * @param {ErrorConstructor} constructor
   * @param {RegExp} regexp
   * @param {String} message
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
   * @api public
   */

  assert.doesNotThrow = function (fn, type, msg) {
    if ('string' === typeof type) {
      msg = type;
      type = null;
    }

    new Assertion(fn, msg).to.not.Throw(type);
  };

  /**
   * ### .operator(val1, operator, val2, [message])
   *
   * Compares two values using `operator`.
   *
   *     assert.operator(1, '<', 2, 'everything is ok');
   *     assert.operator(1, '>', 2, 'this will fail');
   *
   * @name operator
   * @param {Mixed} val1
   * @param {String} operator
   * @param {Mixed} val2
   * @param {String} message
   * @api public
   */

  assert.operator = function (val, operator, val2, msg) {
    if (!~['==', '===', '>', '>=', '<', '<=', '!=', '!=='].indexOf(operator)) {
      throw new Error('Invalid operator "' + operator + '"');
    }
    var test = new Assertion(eval(val + operator + val2), msg);
    test.assert(
        true === flag(test, 'object')
      , 'expected ' + util.inspect(val) + ' to be ' + operator + ' ' + util.inspect(val2)
      , 'expected ' + util.inspect(val) + ' to not be ' + operator + ' ' + util.inspect(val2) );
  };

  /**
   * ### .closeTo(actual, expected, delta, [message])
   *
   * Asserts that the target is equal `expected`, to within a +/- `delta` range.
   *
   *     assert.closeTo(1.5, 1, 0.5, 'numbers are close');
   *
   * @name closeTo
   * @param {Number} actual
   * @param {Number} expected
   * @param {Number} delta
   * @param {String} message
   * @api public
   */

  assert.closeTo = function (act, exp, delta, msg) {
    new Assertion(act, msg).to.be.closeTo(exp, delta);
  };

  /**
   * ### .sameMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` have the same members.
   * Order is not taken into account.
   *
   *     assert.sameMembers([ 1, 2, 3 ], [ 2, 1, 3 ], 'same members');
   *
   * @name sameMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @api public
   */

  assert.sameMembers = function (set1, set2, msg) {
    new Assertion(set1, msg).to.have.same.members(set2);
  }

  /**
   * ### .includeMembers(superset, subset, [message])
   *
   * Asserts that `subset` is included in `superset`.
   * Order is not taken into account.
   *
   *     assert.includeMembers([ 1, 2, 3 ], [ 2, 1 ], 'include members');
   *
   * @name includeMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @api public
   */

  assert.includeMembers = function (superset, subset, msg) {
    new Assertion(superset, msg).to.include.members(subset);
  }

  /*!
   * Undocumented / untested
   */

  assert.ifError = function (val, msg) {
    new Assertion(val, msg).to.not.be.ok;
  };

  /*!
   * Aliases.
   */

  (function alias(name, as){
    assert[as] = assert[name];
    return alias;
  })
  ('Throw', 'throw')
  ('Throw', 'throws');
};

},{}],19:[function(require,module,exports){
/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai, util) {
  chai.expect = function (val, message) {
    return new chai.Assertion(val, message);
  };
};


},{}],20:[function(require,module,exports){
/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai, util) {
  var Assertion = chai.Assertion;

  function loadShould () {
    // explicitly define this method as function as to have it's name to include as `ssfi`
    function shouldGetter() {
      if (this instanceof String || this instanceof Number) {
        return new Assertion(this.constructor(this), null, shouldGetter);
      } else if (this instanceof Boolean) {
        return new Assertion(this == true, null, shouldGetter);
      }
      return new Assertion(this, null, shouldGetter);
    }
    function shouldSetter(value) {
      // See https://github.com/chaijs/chai/issues/86: this makes
      // `whatever.should = someValue` actually set `someValue`, which is
      // especially useful for `global.should = require('chai').should()`.
      //
      // Note that we have to use [[DefineProperty]] instead of [[Put]]
      // since otherwise we would trigger this very setter!
      Object.defineProperty(this, 'should', {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    // modify Object.prototype to have `should`
    Object.defineProperty(Object.prototype, 'should', {
      set: shouldSetter
      , get: shouldGetter
      , configurable: true
    });

    var should = {};

    should.equal = function (val1, val2, msg) {
      new Assertion(val1, msg).to.equal(val2);
    };

    should.Throw = function (fn, errt, errs, msg) {
      new Assertion(fn, msg).to.Throw(errt, errs);
    };

    should.exist = function (val, msg) {
      new Assertion(val, msg).to.exist;
    }

    // negation
    should.not = {}

    should.not.equal = function (val1, val2, msg) {
      new Assertion(val1, msg).to.not.equal(val2);
    };

    should.not.Throw = function (fn, errt, errs, msg) {
      new Assertion(fn, msg).to.not.Throw(errt, errs);
    };

    should.not.exist = function (val, msg) {
      new Assertion(val, msg).to.not.exist;
    }

    should['throw'] = should['Throw'];
    should.not['throw'] = should.not['Throw'];

    return should;
  };

  chai.should = loadShould;
  chai.Should = loadShould;
};

},{}],21:[function(require,module,exports){
/*!
 * Chai - addChainingMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var transferFlags = require('./transferFlags');
var flag = require('./flag');
var config = require('../config');

/*!
 * Module variables
 */

// Check whether `__proto__` is supported
var hasProtoSupport = '__proto__' in Object;

// Without `__proto__` support, this module will need to add properties to a function.
// However, some Function.prototype methods cannot be overwritten,
// and there seems no easy cross-platform way to detect them (@see chaijs/chai/issues/69).
var excludeNames = /^(?:length|name|arguments|caller)$/;

// Cache `Function` properties
var call  = Function.prototype.call,
    apply = Function.prototype.apply;

/**
 * ### addChainableMethod (ctx, name, method, chainingBehavior)
 *
 * Adds a method to an object, such that the method can also be chained.
 *
 *     utils.addChainableMethod(chai.Assertion.prototype, 'foo', function (str) {
 *       var obj = utils.flag(this, 'object');
 *       new chai.Assertion(obj).to.be.equal(str);
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.addChainableMethod('foo', fn, chainingBehavior);
 *
 * The result can then be used as both a method assertion, executing both `method` and
 * `chainingBehavior`, or as a language chain, which only executes `chainingBehavior`.
 *
 *     expect(fooStr).to.be.foo('bar');
 *     expect(fooStr).to.be.foo.equal('foo');
 *
 * @param {Object} ctx object to which the method is added
 * @param {String} name of method to add
 * @param {Function} method function to be used for `name`, when called
 * @param {Function} chainingBehavior function to be called every time the property is accessed
 * @name addChainableMethod
 * @api public
 */

module.exports = function (ctx, name, method, chainingBehavior) {
  if (typeof chainingBehavior !== 'function') {
    chainingBehavior = function () { };
  }

  var chainableBehavior = {
      method: method
    , chainingBehavior: chainingBehavior
  };

  // save the methods so we can overwrite them later, if we need to.
  if (!ctx.__methods) {
    ctx.__methods = {};
  }
  ctx.__methods[name] = chainableBehavior;

  Object.defineProperty(ctx, name,
    { get: function () {
        chainableBehavior.chainingBehavior.call(this);

        var assert = function assert() {
          var old_ssfi = flag(this, 'ssfi');
          if (old_ssfi && config.includeStack === false)
            flag(this, 'ssfi', assert);
          var result = chainableBehavior.method.apply(this, arguments);
          return result === undefined ? this : result;
        };

        // Use `__proto__` if available
        if (hasProtoSupport) {
          // Inherit all properties from the object by replacing the `Function` prototype
          var prototype = assert.__proto__ = Object.create(this);
          // Restore the `call` and `apply` methods from `Function`
          prototype.call = call;
          prototype.apply = apply;
        }
        // Otherwise, redefine all properties (slow!)
        else {
          var asserterNames = Object.getOwnPropertyNames(ctx);
          asserterNames.forEach(function (asserterName) {
            if (!excludeNames.test(asserterName)) {
              var pd = Object.getOwnPropertyDescriptor(ctx, asserterName);
              Object.defineProperty(assert, asserterName, pd);
            }
          });
        }

        transferFlags(this, assert);
        return assert;
      }
    , configurable: true
  });
};

},{"../config":16,"./flag":24,"./transferFlags":38}],22:[function(require,module,exports){
/*!
 * Chai - addMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var config = require('../config');

/**
 * ### .addMethod (ctx, name, method)
 *
 * Adds a method to the prototype of an object.
 *
 *     utils.addMethod(chai.Assertion.prototype, 'foo', function (str) {
 *       var obj = utils.flag(this, 'object');
 *       new chai.Assertion(obj).to.be.equal(str);
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.addMethod('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(fooStr).to.be.foo('bar');
 *
 * @param {Object} ctx object to which the method is added
 * @param {String} name of method to add
 * @param {Function} method function to be used for name
 * @name addMethod
 * @api public
 */
var flag = require('./flag');

module.exports = function (ctx, name, method) {
  ctx[name] = function () {
    var old_ssfi = flag(this, 'ssfi');
    if (old_ssfi && config.includeStack === false)
      flag(this, 'ssfi', ctx[name]);
    var result = method.apply(this, arguments);
    return result === undefined ? this : result;
  };
};

},{"../config":16,"./flag":24}],23:[function(require,module,exports){
/*!
 * Chai - addProperty utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### addProperty (ctx, name, getter)
 *
 * Adds a property to the prototype of an object.
 *
 *     utils.addProperty(chai.Assertion.prototype, 'foo', function () {
 *       var obj = utils.flag(this, 'object');
 *       new chai.Assertion(obj).to.be.instanceof(Foo);
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.addProperty('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.be.foo;
 *
 * @param {Object} ctx object to which the property is added
 * @param {String} name of property to add
 * @param {Function} getter function to be used for name
 * @name addProperty
 * @api public
 */

module.exports = function (ctx, name, getter) {
  Object.defineProperty(ctx, name,
    { get: function () {
        var result = getter.call(this);
        return result === undefined ? this : result;
      }
    , configurable: true
  });
};

},{}],24:[function(require,module,exports){
/*!
 * Chai - flag utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### flag(object ,key, [value])
 *
 * Get or set a flag value on an object. If a
 * value is provided it will be set, else it will
 * return the currently set value or `undefined` if
 * the value is not set.
 *
 *     utils.flag(this, 'foo', 'bar'); // setter
 *     utils.flag(this, 'foo'); // getter, returns `bar`
 *
 * @param {Object} object (constructed Assertion
 * @param {String} key
 * @param {Mixed} value (optional)
 * @name flag
 * @api private
 */

module.exports = function (obj, key, value) {
  var flags = obj.__flags || (obj.__flags = Object.create(null));
  if (arguments.length === 3) {
    flags[key] = value;
  } else {
    return flags[key];
  }
};

},{}],25:[function(require,module,exports){
/*!
 * Chai - getActual utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * # getActual(object, [actual])
 *
 * Returns the `actual` value for an Assertion
 *
 * @param {Object} object (constructed Assertion)
 * @param {Arguments} chai.Assertion.prototype.assert arguments
 */

module.exports = function (obj, args) {
  return args.length > 4 ? args[4] : obj._obj;
};

},{}],26:[function(require,module,exports){
/*!
 * Chai - getEnumerableProperties utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .getEnumerableProperties(object)
 *
 * This allows the retrieval of enumerable property names of an object,
 * inherited or not.
 *
 * @param {Object} object
 * @returns {Array}
 * @name getEnumerableProperties
 * @api public
 */

module.exports = function getEnumerableProperties(object) {
  var result = [];
  for (var name in object) {
    result.push(name);
  }
  return result;
};

},{}],27:[function(require,module,exports){
/*!
 * Chai - message composition utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependancies
 */

var flag = require('./flag')
  , getActual = require('./getActual')
  , inspect = require('./inspect')
  , objDisplay = require('./objDisplay');

/**
 * ### .getMessage(object, message, negateMessage)
 *
 * Construct the error message based on flags
 * and template tags. Template tags will return
 * a stringified inspection of the object referenced.
 *
 * Message template tags:
 * - `#{this}` current asserted object
 * - `#{act}` actual value
 * - `#{exp}` expected value
 *
 * @param {Object} object (constructed Assertion)
 * @param {Arguments} chai.Assertion.prototype.assert arguments
 * @name getMessage
 * @api public
 */

module.exports = function (obj, args) {
  var negate = flag(obj, 'negate')
    , val = flag(obj, 'object')
    , expected = args[3]
    , actual = getActual(obj, args)
    , msg = negate ? args[2] : args[1]
    , flagMsg = flag(obj, 'message');

  msg = msg || '';
  msg = msg
    .replace(/#{this}/g, objDisplay(val))
    .replace(/#{act}/g, objDisplay(actual))
    .replace(/#{exp}/g, objDisplay(expected));

  return flagMsg ? flagMsg + ': ' + msg : msg;
};

},{"./flag":24,"./getActual":25,"./inspect":32,"./objDisplay":33}],28:[function(require,module,exports){
/*!
 * Chai - getName utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * # getName(func)
 *
 * Gets the name of a function, in a cross-browser way.
 *
 * @param {Function} a function (usually a constructor)
 */

module.exports = function (func) {
  if (func.name) return func.name;

  var match = /^\s?function ([^(]*)\(/.exec(func);
  return match && match[1] ? match[1] : "";
};

},{}],29:[function(require,module,exports){
/*!
 * Chai - getPathValue utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * @see https://github.com/logicalparadox/filtr
 * MIT Licensed
 */

/**
 * ### .getPathValue(path, object)
 *
 * This allows the retrieval of values in an
 * object given a string path.
 *
 *     var obj = {
 *         prop1: {
 *             arr: ['a', 'b', 'c']
 *           , str: 'Hello'
 *         }
 *       , prop2: {
 *             arr: [ { nested: 'Universe' } ]
 *           , str: 'Hello again!'
 *         }
 *     }
 *
 * The following would be the results.
 *
 *     getPathValue('prop1.str', obj); // Hello
 *     getPathValue('prop1.att[2]', obj); // b
 *     getPathValue('prop2.arr[0].nested', obj); // Universe
 *
 * @param {String} path
 * @param {Object} object
 * @returns {Object} value or `undefined`
 * @name getPathValue
 * @api public
 */

var getPathValue = module.exports = function (path, obj) {
  var parsed = parsePath(path);
  return _getPathValue(parsed, obj);
};

/*!
 * ## parsePath(path)
 *
 * Helper function used to parse string object
 * paths. Use in conjunction with `_getPathValue`.
 *
 *      var parsed = parsePath('myobject.property.subprop');
 *
 * ### Paths:
 *
 * * Can be as near infinitely deep and nested
 * * Arrays are also valid using the formal `myobject.document[3].property`.
 *
 * @param {String} path
 * @returns {Object} parsed
 * @api private
 */

function parsePath (path) {
  var str = path.replace(/\[/g, '.[')
    , parts = str.match(/(\\\.|[^.]+?)+/g);
  return parts.map(function (value) {
    var re = /\[(\d+)\]$/
      , mArr = re.exec(value)
    if (mArr) return { i: parseFloat(mArr[1]) };
    else return { p: value };
  });
};

/*!
 * ## _getPathValue(parsed, obj)
 *
 * Helper companion function for `.parsePath` that returns
 * the value located at the parsed address.
 *
 *      var value = getPathValue(parsed, obj);
 *
 * @param {Object} parsed definition from `parsePath`.
 * @param {Object} object to search against
 * @returns {Object|Undefined} value
 * @api private
 */

function _getPathValue (parsed, obj) {
  var tmp = obj
    , res;
  for (var i = 0, l = parsed.length; i < l; i++) {
    var part = parsed[i];
    if (tmp) {
      if ('undefined' !== typeof part.p)
        tmp = tmp[part.p];
      else if ('undefined' !== typeof part.i)
        tmp = tmp[part.i];
      if (i == (l - 1)) res = tmp;
    } else {
      res = undefined;
    }
  }
  return res;
};

},{}],30:[function(require,module,exports){
/*!
 * Chai - getProperties utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .getProperties(object)
 *
 * This allows the retrieval of property names of an object, enumerable or not,
 * inherited or not.
 *
 * @param {Object} object
 * @returns {Array}
 * @name getProperties
 * @api public
 */

module.exports = function getProperties(object) {
  var result = Object.getOwnPropertyNames(subject);

  function addProperty(property) {
    if (result.indexOf(property) === -1) {
      result.push(property);
    }
  }

  var proto = Object.getPrototypeOf(subject);
  while (proto !== null) {
    Object.getOwnPropertyNames(proto).forEach(addProperty);
    proto = Object.getPrototypeOf(proto);
  }

  return result;
};

},{}],31:[function(require,module,exports){
/*!
 * chai
 * Copyright(c) 2011 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Main exports
 */

var exports = module.exports = {};

/*!
 * test utility
 */

exports.test = require('./test');

/*!
 * type utility
 */

exports.type = require('./type');

/*!
 * message utility
 */

exports.getMessage = require('./getMessage');

/*!
 * actual utility
 */

exports.getActual = require('./getActual');

/*!
 * Inspect util
 */

exports.inspect = require('./inspect');

/*!
 * Object Display util
 */

exports.objDisplay = require('./objDisplay');

/*!
 * Flag utility
 */

exports.flag = require('./flag');

/*!
 * Flag transferring utility
 */

exports.transferFlags = require('./transferFlags');

/*!
 * Deep equal utility
 */

exports.eql = require('deep-eql');

/*!
 * Deep path value
 */

exports.getPathValue = require('./getPathValue');

/*!
 * Function name
 */

exports.getName = require('./getName');

/*!
 * add Property
 */

exports.addProperty = require('./addProperty');

/*!
 * add Method
 */

exports.addMethod = require('./addMethod');

/*!
 * overwrite Property
 */

exports.overwriteProperty = require('./overwriteProperty');

/*!
 * overwrite Method
 */

exports.overwriteMethod = require('./overwriteMethod');

/*!
 * Add a chainable method
 */

exports.addChainableMethod = require('./addChainableMethod');

/*!
 * Overwrite chainable method
 */

exports.overwriteChainableMethod = require('./overwriteChainableMethod');


},{"./addChainableMethod":21,"./addMethod":22,"./addProperty":23,"./flag":24,"./getActual":25,"./getMessage":27,"./getName":28,"./getPathValue":29,"./inspect":32,"./objDisplay":33,"./overwriteChainableMethod":34,"./overwriteMethod":35,"./overwriteProperty":36,"./test":37,"./transferFlags":38,"./type":39,"deep-eql":41}],32:[function(require,module,exports){
// This is (almost) directly from Node.js utils
// https://github.com/joyent/node/blob/f8c335d0caf47f16d31413f89aa28eda3878e3aa/lib/util.js

var getName = require('./getName');
var getProperties = require('./getProperties');
var getEnumerableProperties = require('./getEnumerableProperties');

module.exports = inspect;

/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Boolean} showHidden Flag that shows hidden (not enumerable)
 *    properties of objects.
 * @param {Number} depth Depth in which to descend in object. Default is 2.
 * @param {Boolean} colors Flag to turn on ANSI escape codes to color the
 *    output. Default is false (no coloring).
 */
function inspect(obj, showHidden, depth, colors) {
  var ctx = {
    showHidden: showHidden,
    seen: [],
    stylize: function (str) { return str; }
  };
  return formatValue(ctx, obj, (typeof depth === 'undefined' ? 2 : depth));
}

// https://gist.github.com/1044128/
var getOuterHTML = function(element) {
  if ('outerHTML' in element) return element.outerHTML;
  var ns = "http://www.w3.org/1999/xhtml";
  var container = document.createElementNS(ns, '_');
  var elemProto = (window.HTMLElement || window.Element).prototype;
  var xmlSerializer = new XMLSerializer();
  var html;
  if (document.xmlVersion) {
    return xmlSerializer.serializeToString(element);
  } else {
    container.appendChild(element.cloneNode(false));
    html = container.innerHTML.replace('><', '>' + element.innerHTML + '<');
    container.innerHTML = '';
    return html;
  }
};

// Returns true if object is a DOM element.
var isDOMElement = function (object) {
  if (typeof HTMLElement === 'object') {
    return object instanceof HTMLElement;
  } else {
    return object &&
      typeof object === 'object' &&
      object.nodeType === 1 &&
      typeof object.nodeName === 'string';
  }
};

function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (value && typeof value.inspect === 'function' &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes);
    if (typeof ret !== 'string') {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // If it's DOM elem, get outer HTML.
  if (isDOMElement(value)) {
    return getOuterHTML(value);
  }

  // Look up the keys of the object.
  var visibleKeys = getEnumerableProperties(value);
  var keys = ctx.showHidden ? getProperties(value) : visibleKeys;

  // Some type of object without properties can be shortcutted.
  // In IE, errors have a single `stack` property, or if they are vanilla `Error`,
  // a `stack` plus `description` property; ignore those for consistency.
  if (keys.length === 0 || (isError(value) && (
      (keys.length === 1 && keys[0] === 'stack') ||
      (keys.length === 2 && keys[0] === 'description' && keys[1] === 'stack')
     ))) {
    if (typeof value === 'function') {
      var name = getName(value);
      var nameSuffix = name ? ': ' + name : '';
      return ctx.stylize('[Function' + nameSuffix + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toUTCString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (typeof value === 'function') {
    var name = getName(value);
    var nameSuffix = name ? ': ' + name : '';
    base = ' [Function' + nameSuffix + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    return formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  switch (typeof value) {
    case 'undefined':
      return ctx.stylize('undefined', 'undefined');

    case 'string':
      var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                               .replace(/'/g, "\\'")
                                               .replace(/\\"/g, '"') + '\'';
      return ctx.stylize(simple, 'string');

    case 'number':
      return ctx.stylize('' + value, 'number');

    case 'boolean':
      return ctx.stylize('' + value, 'boolean');
  }
  // For some reason typeof null is "object", so special case here.
  if (value === null) {
    return ctx.stylize('null', 'null');
  }
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (Object.prototype.hasOwnProperty.call(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str;
  if (value.__lookupGetter__) {
    if (value.__lookupGetter__(key)) {
      if (value.__lookupSetter__(key)) {
        str = ctx.stylize('[Getter/Setter]', 'special');
      } else {
        str = ctx.stylize('[Getter]', 'special');
      }
    } else {
      if (value.__lookupSetter__(key)) {
        str = ctx.stylize('[Setter]', 'special');
      }
    }
  }
  if (visibleKeys.indexOf(key) < 0) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(value[key]) < 0) {
      if (recurseTimes === null) {
        str = formatValue(ctx, value[key], null);
      } else {
        str = formatValue(ctx, value[key], recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (typeof name === 'undefined') {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}

function isArray(ar) {
  return Array.isArray(ar) ||
         (typeof ar === 'object' && objectToString(ar) === '[object Array]');
}

function isRegExp(re) {
  return typeof re === 'object' && objectToString(re) === '[object RegExp]';
}

function isDate(d) {
  return typeof d === 'object' && objectToString(d) === '[object Date]';
}

function isError(e) {
  return typeof e === 'object' && objectToString(e) === '[object Error]';
}

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

},{"./getEnumerableProperties":26,"./getName":28,"./getProperties":30}],33:[function(require,module,exports){
/*!
 * Chai - flag utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependancies
 */

var inspect = require('./inspect');
var config = require('../config');

/**
 * ### .objDisplay (object)
 *
 * Determines if an object or an array matches
 * criteria to be inspected in-line for error
 * messages or should be truncated.
 *
 * @param {Mixed} javascript object to inspect
 * @name objDisplay
 * @api public
 */

module.exports = function (obj) {
  var str = inspect(obj)
    , type = Object.prototype.toString.call(obj);

  if (config.truncateThreshold && str.length >= config.truncateThreshold) {
    if (type === '[object Function]') {
      return !obj.name || obj.name === ''
        ? '[Function]'
        : '[Function: ' + obj.name + ']';
    } else if (type === '[object Array]') {
      return '[ Array(' + obj.length + ') ]';
    } else if (type === '[object Object]') {
      var keys = Object.keys(obj)
        , kstr = keys.length > 2
          ? keys.splice(0, 2).join(', ') + ', ...'
          : keys.join(', ');
      return '{ Object (' + kstr + ') }';
    } else {
      return str;
    }
  } else {
    return str;
  }
};

},{"../config":16,"./inspect":32}],34:[function(require,module,exports){
/*!
 * Chai - overwriteChainableMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### overwriteChainableMethod (ctx, name, fn)
 *
 * Overwites an already existing chainable method
 * and provides access to the previous function or
 * property.  Must return functions to be used for
 * name.
 *
 *     utils.overwriteChainableMethod(chai.Assertion.prototype, 'length',
 *       function (_super) {
 *       }
 *     , function (_super) {
 *       }
 *     );
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.overwriteChainableMethod('foo', fn, fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.have.length(3);
 *     expect(myFoo).to.have.length.above(3);
 *
 * @param {Object} ctx object whose method / property is to be overwritten
 * @param {String} name of method / property to overwrite
 * @param {Function} method function that returns a function to be used for name
 * @param {Function} chainingBehavior function that returns a function to be used for property
 * @name overwriteChainableMethod
 * @api public
 */

module.exports = function (ctx, name, method, chainingBehavior) {
  var chainableBehavior = ctx.__methods[name];

  var _chainingBehavior = chainableBehavior.chainingBehavior;
  chainableBehavior.chainingBehavior = function () {
    var result = chainingBehavior(_chainingBehavior).call(this);
    return result === undefined ? this : result;
  };

  var _method = chainableBehavior.method;
  chainableBehavior.method = function () {
    var result = method(_method).apply(this, arguments);
    return result === undefined ? this : result;
  };
};

},{}],35:[function(require,module,exports){
/*!
 * Chai - overwriteMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### overwriteMethod (ctx, name, fn)
 *
 * Overwites an already existing method and provides
 * access to previous function. Must return function
 * to be used for name.
 *
 *     utils.overwriteMethod(chai.Assertion.prototype, 'equal', function (_super) {
 *       return function (str) {
 *         var obj = utils.flag(this, 'object');
 *         if (obj instanceof Foo) {
 *           new chai.Assertion(obj.value).to.equal(str);
 *         } else {
 *           _super.apply(this, arguments);
 *         }
 *       }
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.overwriteMethod('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.equal('bar');
 *
 * @param {Object} ctx object whose method is to be overwritten
 * @param {String} name of method to overwrite
 * @param {Function} method function that returns a function to be used for name
 * @name overwriteMethod
 * @api public
 */

module.exports = function (ctx, name, method) {
  var _method = ctx[name]
    , _super = function () { return this; };

  if (_method && 'function' === typeof _method)
    _super = _method;

  ctx[name] = function () {
    var result = method(_super).apply(this, arguments);
    return result === undefined ? this : result;
  }
};

},{}],36:[function(require,module,exports){
/*!
 * Chai - overwriteProperty utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### overwriteProperty (ctx, name, fn)
 *
 * Overwites an already existing property getter and provides
 * access to previous value. Must return function to use as getter.
 *
 *     utils.overwriteProperty(chai.Assertion.prototype, 'ok', function (_super) {
 *       return function () {
 *         var obj = utils.flag(this, 'object');
 *         if (obj instanceof Foo) {
 *           new chai.Assertion(obj.name).to.equal('bar');
 *         } else {
 *           _super.call(this);
 *         }
 *       }
 *     });
 *
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.overwriteProperty('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.be.ok;
 *
 * @param {Object} ctx object whose property is to be overwritten
 * @param {String} name of property to overwrite
 * @param {Function} getter function that returns a getter function to be used for name
 * @name overwriteProperty
 * @api public
 */

module.exports = function (ctx, name, getter) {
  var _get = Object.getOwnPropertyDescriptor(ctx, name)
    , _super = function () {};

  if (_get && 'function' === typeof _get.get)
    _super = _get.get

  Object.defineProperty(ctx, name,
    { get: function () {
        var result = getter(_super).call(this);
        return result === undefined ? this : result;
      }
    , configurable: true
  });
};

},{}],37:[function(require,module,exports){
/*!
 * Chai - test utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependancies
 */

var flag = require('./flag');

/**
 * # test(object, expression)
 *
 * Test and object for expression.
 *
 * @param {Object} object (constructed Assertion)
 * @param {Arguments} chai.Assertion.prototype.assert arguments
 */

module.exports = function (obj, args) {
  var negate = flag(obj, 'negate')
    , expr = args[0];
  return negate ? !expr : expr;
};

},{"./flag":24}],38:[function(require,module,exports){
/*!
 * Chai - transferFlags utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### transferFlags(assertion, object, includeAll = true)
 *
 * Transfer all the flags for `assertion` to `object`. If
 * `includeAll` is set to `false`, then the base Chai
 * assertion flags (namely `object`, `ssfi`, and `message`)
 * will not be transferred.
 *
 *
 *     var newAssertion = new Assertion();
 *     utils.transferFlags(assertion, newAssertion);
 *
 *     var anotherAsseriton = new Assertion(myObj);
 *     utils.transferFlags(assertion, anotherAssertion, false);
 *
 * @param {Assertion} assertion the assertion to transfer the flags from
 * @param {Object} object the object to transfer the flags too; usually a new assertion
 * @param {Boolean} includeAll
 * @name getAllFlags
 * @api private
 */

module.exports = function (assertion, object, includeAll) {
  var flags = assertion.__flags || (assertion.__flags = Object.create(null));

  if (!object.__flags) {
    object.__flags = Object.create(null);
  }

  includeAll = arguments.length === 3 ? includeAll : true;

  for (var flag in flags) {
    if (includeAll ||
        (flag !== 'object' && flag !== 'ssfi' && flag != 'message')) {
      object.__flags[flag] = flags[flag];
    }
  }
};

},{}],39:[function(require,module,exports){
/*!
 * Chai - type utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Detectable javascript natives
 */

var natives = {
    '[object Arguments]': 'arguments'
  , '[object Array]': 'array'
  , '[object Date]': 'date'
  , '[object Function]': 'function'
  , '[object Number]': 'number'
  , '[object RegExp]': 'regexp'
  , '[object String]': 'string'
};

/**
 * ### type(object)
 *
 * Better implementation of `typeof` detection that can
 * be used cross-browser. Handles the inconsistencies of
 * Array, `null`, and `undefined` detection.
 *
 *     utils.type({}) // 'object'
 *     utils.type(null) // `null'
 *     utils.type(undefined) // `undefined`
 *     utils.type([]) // `array`
 *
 * @param {Mixed} object to detect type of
 * @name type
 * @api private
 */

module.exports = function (obj) {
  var str = Object.prototype.toString.call(obj);
  if (natives[str]) return natives[str];
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (obj === Object(obj)) return 'object';
  return typeof obj;
};

},{}],40:[function(require,module,exports){
/*!
 * assertion-error
 * Copyright(c) 2013 Jake Luer <jake@qualiancy.com>
 * MIT Licensed
 */

/*!
 * Return a function that will copy properties from
 * one object to another excluding any originally
 * listed. Returned function will create a new `{}`.
 *
 * @param {String} excluded properties ...
 * @return {Function}
 */

function exclude () {
  var excludes = [].slice.call(arguments);

  function excludeProps (res, obj) {
    Object.keys(obj).forEach(function (key) {
      if (!~excludes.indexOf(key)) res[key] = obj[key];
    });
  }

  return function extendExclude () {
    var args = [].slice.call(arguments)
      , i = 0
      , res = {};

    for (; i < args.length; i++) {
      excludeProps(res, args[i]);
    }

    return res;
  };
};

/*!
 * Primary Exports
 */

module.exports = AssertionError;

/**
 * ### AssertionError
 *
 * An extension of the JavaScript `Error` constructor for
 * assertion and validation scenarios.
 *
 * @param {String} message
 * @param {Object} properties to include (optional)
 * @param {callee} start stack function (optional)
 */

function AssertionError (message, _props, ssf) {
  var extend = exclude('name', 'message', 'stack', 'constructor', 'toJSON')
    , props = extend(_props || {});

  // default values
  this.message = message || 'Unspecified AssertionError';
  this.showDiff = false;

  // copy from properties
  for (var key in props) {
    this[key] = props[key];
  }

  // capture stack trace
  ssf = ssf || arguments.callee;
  if (ssf && Error.captureStackTrace) {
    Error.captureStackTrace(this, ssf);
  }
}

/*!
 * Inherit from Error.prototype
 */

AssertionError.prototype = Object.create(Error.prototype);

/*!
 * Statically set name
 */

AssertionError.prototype.name = 'AssertionError';

/*!
 * Ensure correct constructor
 */

AssertionError.prototype.constructor = AssertionError;

/**
 * Allow errors to be converted to JSON for static transfer.
 *
 * @param {Boolean} include stack (default: `true`)
 * @return {Object} object that can be `JSON.stringify`
 */

AssertionError.prototype.toJSON = function (stack) {
  var extend = exclude('constructor', 'toJSON', 'stack')
    , props = extend({ name: this.name }, this);

  // include stack if exists and not turned off
  if (false !== stack && this.stack) {
    props.stack = this.stack;
  }

  return props;
};

},{}],41:[function(require,module,exports){
module.exports = require('./lib/eql');

},{"./lib/eql":42}],42:[function(require,module,exports){
/*!
 * deep-eql
 * Copyright(c) 2013 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var type = require('type-detect');

/*!
 * Buffer.isBuffer browser shim
 */

var Buffer;
try { Buffer = require('buffer').Buffer; }
catch(ex) {
  Buffer = {};
  Buffer.isBuffer = function() { return false; }
}

/*!
 * Primary Export
 */

module.exports = deepEqual;

/**
 * Assert super-strict (egal) equality between
 * two objects of any type.
 *
 * @param {Mixed} a
 * @param {Mixed} b
 * @param {Array} memoised (optional)
 * @return {Boolean} equal match
 */

function deepEqual(a, b, m) {
  if (sameValue(a, b)) {
    return true;
  } else if ('date' === type(a)) {
    return dateEqual(a, b);
  } else if ('regexp' === type(a)) {
    return regexpEqual(a, b);
  } else if (Buffer.isBuffer(a)) {
    return bufferEqual(a, b);
  } else if ('arguments' === type(a)) {
    return argumentsEqual(a, b, m);
  } else if (!typeEqual(a, b)) {
    return false;
  } else if (('object' !== type(a) && 'object' !== type(b))
  && ('array' !== type(a) && 'array' !== type(b))) {
    return sameValue(a, b);
  } else {
    return objectEqual(a, b, m);
  }
}

/*!
 * Strict (egal) equality test. Ensures that NaN always
 * equals NaN and `-0` does not equal `+0`.
 *
 * @param {Mixed} a
 * @param {Mixed} b
 * @return {Boolean} equal match
 */

function sameValue(a, b) {
  if (a === b) return a !== 0 || 1 / a === 1 / b;
  return a !== a && b !== b;
}

/*!
 * Compare the types of two given objects and
 * return if they are equal. Note that an Array
 * has a type of `array` (not `object`) and arguments
 * have a type of `arguments` (not `array`/`object`).
 *
 * @param {Mixed} a
 * @param {Mixed} b
 * @return {Boolean} result
 */

function typeEqual(a, b) {
  return type(a) === type(b);
}

/*!
 * Compare two Date objects by asserting that
 * the time values are equal using `saveValue`.
 *
 * @param {Date} a
 * @param {Date} b
 * @return {Boolean} result
 */

function dateEqual(a, b) {
  if ('date' !== type(b)) return false;
  return sameValue(a.getTime(), b.getTime());
}

/*!
 * Compare two regular expressions by converting them
 * to string and checking for `sameValue`.
 *
 * @param {RegExp} a
 * @param {RegExp} b
 * @return {Boolean} result
 */

function regexpEqual(a, b) {
  if ('regexp' !== type(b)) return false;
  return sameValue(a.toString(), b.toString());
}

/*!
 * Assert deep equality of two `arguments` objects.
 * Unfortunately, these must be sliced to arrays
 * prior to test to ensure no bad behavior.
 *
 * @param {Arguments} a
 * @param {Arguments} b
 * @param {Array} memoize (optional)
 * @return {Boolean} result
 */

function argumentsEqual(a, b, m) {
  if ('arguments' !== type(b)) return false;
  a = [].slice.call(a);
  b = [].slice.call(b);
  return deepEqual(a, b, m);
}

/*!
 * Get enumerable properties of a given object.
 *
 * @param {Object} a
 * @return {Array} property names
 */

function enumerable(a) {
  var res = [];
  for (var key in a) res.push(key);
  return res;
}

/*!
 * Simple equality for flat iterable objects
 * such as Arrays or Node.js buffers.
 *
 * @param {Iterable} a
 * @param {Iterable} b
 * @return {Boolean} result
 */

function iterableEqual(a, b) {
  if (a.length !==  b.length) return false;

  var i = 0;
  var match = true;

  for (; i < a.length; i++) {
    if (a[i] !== b[i]) {
      match = false;
      break;
    }
  }

  return match;
}

/*!
 * Extension to `iterableEqual` specifically
 * for Node.js Buffers.
 *
 * @param {Buffer} a
 * @param {Mixed} b
 * @return {Boolean} result
 */

function bufferEqual(a, b) {
  if (!Buffer.isBuffer(b)) return false;
  return iterableEqual(a, b);
}

/*!
 * Block for `objectEqual` ensuring non-existing
 * values don't get in.
 *
 * @param {Mixed} object
 * @return {Boolean} result
 */

function isValue(a) {
  return a !== null && a !== undefined;
}

/*!
 * Recursively check the equality of two objects.
 * Once basic sameness has been established it will
 * defer to `deepEqual` for each enumerable key
 * in the object.
 *
 * @param {Mixed} a
 * @param {Mixed} b
 * @return {Boolean} result
 */

function objectEqual(a, b, m) {
  if (!isValue(a) || !isValue(b)) {
    return false;
  }

  if (a.prototype !== b.prototype) {
    return false;
  }

  var i;
  if (m) {
    for (i = 0; i < m.length; i++) {
      if ((m[i][0] === a && m[i][1] === b)
      ||  (m[i][0] === b && m[i][1] === a)) {
        return true;
      }
    }
  } else {
    m = [];
  }

  try {
    var ka = enumerable(a);
    var kb = enumerable(b);
  } catch (ex) {
    return false;
  }

  ka.sort();
  kb.sort();

  if (!iterableEqual(ka, kb)) {
    return false;
  }

  m.push([ a, b ]);

  var key;
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], m)) {
      return false;
    }
  }

  return true;
}

},{"buffer":10,"type-detect":43}],43:[function(require,module,exports){
module.exports = require('./lib/type');

},{"./lib/type":44}],44:[function(require,module,exports){
/*!
 * type-detect
 * Copyright(c) 2013 jake luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Primary Exports
 */

var exports = module.exports = getType;

/*!
 * Detectable javascript natives
 */

var natives = {
    '[object Array]': 'array'
  , '[object RegExp]': 'regexp'
  , '[object Function]': 'function'
  , '[object Arguments]': 'arguments'
  , '[object Date]': 'date'
};

/**
 * ### typeOf (obj)
 *
 * Use several different techniques to determine
 * the type of object being tested.
 *
 *
 * @param {Mixed} object
 * @return {String} object type
 * @api public
 */

function getType (obj) {
  var str = Object.prototype.toString.call(obj);
  if (natives[str]) return natives[str];
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (obj === Object(obj)) return 'object';
  return typeof obj;
}

exports.Library = Library;

/**
 * ### Library
 *
 * Create a repository for custom type detection.
 *
 * ```js
 * var lib = new type.Library;
 * ```
 *
 */

function Library () {
  this.tests = {};
}

/**
 * #### .of (obj)
 *
 * Expose replacement `typeof` detection to the library.
 *
 * ```js
 * if ('string' === lib.of('hello world')) {
 *   // ...
 * }
 * ```
 *
 * @param {Mixed} object to test
 * @return {String} type
 */

Library.prototype.of = getType;

/**
 * #### .define (type, test)
 *
 * Add a test to for the `.test()` assertion.
 *
 * Can be defined as a regular expression:
 *
 * ```js
 * lib.define('int', /^[0-9]+$/);
 * ```
 *
 * ... or as a function:
 *
 * ```js
 * lib.define('bln', function (obj) {
 *   if ('boolean' === lib.of(obj)) return true;
 *   var blns = [ 'yes', 'no', 'true', 'false', 1, 0 ];
 *   if ('string' === lib.of(obj)) obj = obj.toLowerCase();
 *   return !! ~blns.indexOf(obj);
 * });
 * ```
 *
 * @param {String} type
 * @param {RegExp|Function} test
 * @api public
 */

Library.prototype.define = function (type, test) {
  if (arguments.length === 1) return this.tests[type];
  this.tests[type] = test;
  return this;
};

/**
 * #### .test (obj, test)
 *
 * Assert that an object is of type. Will first
 * check natives, and if that does not pass it will
 * use the user defined custom tests.
 *
 * ```js
 * assert(lib.test('1', 'int'));
 * assert(lib.test('yes', 'bln'));
 * ```
 *
 * @param {Mixed} object
 * @param {String} type
 * @return {Boolean} result
 * @api public
 */

Library.prototype.test = function (obj, type) {
  if (type === getType(obj)) return true;
  var test = this.tests[type];

  if (test && 'regexp' === getType(test)) {
    return test.test(obj);
  } else if (test && 'function' === getType(test)) {
    return test(obj);
  } else {
    throw new ReferenceError('Type test "' + type + '" not defined or invalid.');
  }
};

},{}],45:[function(require,module,exports){
var furious = require("../lib/furious.js");
var expect = require("chai").expect;

var context = null;
before(function(done) {
	furious.init(function(ctx) {
		context = ctx;
		done();
	});
});

describe("Context", function(){
	describe("empty", function(){
		it("Creates array with specified shape", function() {
			var x = context.empty(42);
			var y = context.empty([42]);
			var z = context.empty([4, 2]);
			expect(x.shape).to.deep.equal([42]);
			expect(y.shape).to.deep.equal([42]);
			expect(z.shape).to.deep.equal([4, 2]);
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with specified data type (f64 by default)", function() {
			var x = context.empty([4, 2]);
			var y = context.empty([4, 2], new furious.DataType("f64"));
			var z = context.empty([4, 2], new furious.DataType("f32"));
			expect(x.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(y.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(z.dataType.equals(new furious.DataType("f32"))).to.be.true;
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
	});
	describe("zeros", function(){
		it("Creates array with specified shape", function() {
			var x = context.zeros(42);
			var y = context.zeros([42]);
			var z = context.zeros([4, 2]);
			expect(x.shape).to.deep.equal([42]);
			expect(y.shape).to.deep.equal([42]);
			expect(z.shape).to.deep.equal([4, 2]);
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with specified data type (f64 by default)", function() {
			var x = context.zeros([4, 2]);
			var y = context.zeros([4, 2], new furious.DataType("f64"));
			var z = context.zeros([4, 2], new furious.DataType("f32"));
			expect(x.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(y.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(z.dataType.equals(new furious.DataType("f32"))).to.be.true;
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with all elements initialized to zero", function(done) {
			var x = context.zeros([3, 2], new furious.DataType("f64"));
			var y = context.zeros([2, 3], new furious.DataType("f32"));
			context.get(x, y, function(x, y) {
				expect(x).to.deep.equal([[0.0, 0.0],
				                         [0.0, 0.0],
				                         [0.0, 0.0]]);
				expect(y).to.deep.equal([[0.0, 0.0, 0.0],
				                         [0.0, 0.0, 0.0]]);
				done();
			});
		});
	});
	describe("ones", function(){
		it("Creates array with specified shape", function() {
			var x = context.ones(42);
			var y = context.ones([42]);
			var z = context.ones([4, 2]);
			expect(x.shape).to.deep.equal([42]);
			expect(y.shape).to.deep.equal([42]);
			expect(z.shape).to.deep.equal([4, 2]);
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with specified data type (f64 by default)", function() {
			var x = context.ones([4, 2]);
			var y = context.ones([4, 2], new furious.DataType("f64"));
			var z = context.ones([4, 2], new furious.DataType("f32"));
			expect(x.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(y.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(z.dataType.equals(new furious.DataType("f32"))).to.be.true;
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with all elements initialized to one", function(done) {
			var x = context.ones([3, 2], new furious.DataType("f64"));
			var y = context.ones([2, 3], new furious.DataType("f32"));
			context.get(x, y, function(x, y) {
				expect(x).to.deep.equal([[1.0, 1.0],
				                         [1.0, 1.0],
				                         [1.0, 1.0]]);
				expect(y).to.deep.equal([[1.0, 1.0, 1.0],
				                         [1.0, 1.0, 1.0]]);
				done();
			});
		});
	});
	describe("array", function(){
		it("Creates array of the same length as the provided array", function(){
			var x = context.array([0, 1]);
			var y = context.array([[0, 1],
			                       [2, 3],
			                       [3, 4]]);
			expect(x.length).to.equal(2);
			expect(y.length).to.equal(6);
			x.invalidate();
			y.invalidate();
		});
		it("Creates array of the same shape as the provided array", function(){
			var x = context.array([0, 1]);
			var y = context.array([[0, 1],
			                       [2, 3],
			                       [3, 4]]);
			var z = context.array([[[1, 2, 3], [ 4,  5,  6]],
			                       [[7, 8, 9], [10, 11, 12]]]);
			expect(x.shape).to.deep.equal([2]);
			expect(y.shape).to.deep.equal([3, 2]);
			expect(z.shape).to.deep.equal([2, 2, 3]);
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with the same data as the provided array", function(done){
			var array = [[[1, 2, 3], [ 4,  5,  6]],
			             [[7, 8, 9], [10, 11, 12]]];
			var x = context.array(array, new furious.DataType("f64"));
			var y = context.array(array, new furious.DataType("f32"));
			context.get(x, y, function(x, y) {
				expect(x).to.deep.equal(array);
				expect(y).to.deep.equal(array);
				done();
			});
		});
	});
	describe("linspace", function(){
		it("Has length of 50 with default arguments", function(){
			expect((context.linspace(0, 1)).length).to.equal(50);
		});
		it("Has the specified number of samples", function(){
			expect((context.linspace(0, 1, 243)).length).to.equal(243);
		});
		it("Has expected values", function(done){
			var start = 50;
			var stop = 99;
			var x = context.linspace(start, stop);
			x.get(function(result) {
				for (var i = 0; i < result.length; i++) {
					expect(result[i]).to.equal(start+i);
				}
				done();
			});
		});
		describe("with includeStop === false", function(){
			it("Has the specified number of samples", function(){
				expect((context.linspace(0, 1, 243, false)).length).to.equal(243);
			});
			it("Does not contain the right endpoint", function(done){
				var x = context.linspace(-1, 1, 1000, false);
				x.get(function(result) {
					expect(result[result.length - 1]).to.not.equal(1);
					done();
				});
			});
		});
	});
	describe("neg", function() {
		var xRef = [ 1, -7.5,  0, -15];
		var yRef = [-1,  7.5, -0,  15];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.neg(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.neg(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with negated elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.neg(x);
						y.get(function(y) {
							expect(y).to.deep.equal(yRef);
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with negated elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.neg(x, y);
						y.get(function(y) {
							expect(y).to.deep.equal(yRef);
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
	describe("abs", function() {
		var xRef = [1, -7.5, 0, -15];
		var yRef = [1,  7.5, 0,  15];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.abs(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.abs(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.abs(x);
						y.get(function(y) {
							expect(y).to.deep.equal(yRef);
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.abs(x, y);
						y.get(function(y) {
							expect(y).to.deep.equal(yRef);
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
	describe("exp", function() {
		var xRef = [1, -1, 0];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.exp(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.exp(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.exp(x);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.exp(xRef[k]), Math.exp(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.exp(x, y);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.exp(xRef[k]), Math.exp(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
	describe("log", function() {
		var xRef = [1, 3, 10];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.log(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.log(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.log(x);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.log(xRef[k]), Math.log(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.log(x, y);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.log(xRef[k]), Math.log(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
	describe("sqrt", function() {
		var xRef = [0, 0.25, 1, 9, 10];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.sqrt(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.sqrt(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.sqrt(x);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.sqrt(xRef[k]), Math.sqrt(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.sqrt(x, y);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.sqrt(xRef[k]), Math.sqrt(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
	describe("square", function() {
		var xRef = [-2, 0, 0.5, 1, 3];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.square(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.square(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.square(x);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(xRef[k] * xRef[k], xRef[k] * xRef[k] * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.square(x, y);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(xRef[k] * xRef[k], xRef[k] * xRef[k] * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
});

},{"../lib/furious.js":6,"chai":13}],46:[function(require,module,exports){
var furious = require("../lib/furious.js");
var expect = require("chai").expect;

describe("DataType", function(){
	describe("f32", function(){
		it("should have size 4", function(){
			var dtype = new furious.DataType("f32");
			expect(dtype.size).to.equal(4);
		});

		it("should have type \"f32\"", function(){
			var dtype = new furious.DataType("f32");
			expect(dtype.type).to.equal("f32");
		});
	});
	describe("f64", function(){
		it("should have size 8", function(){
			var dtype = new furious.DataType("f64");
			expect(dtype.size).to.equal(8);
		});

		it("should have type \"f64\"", function(){
			var dtype = new furious.DataType("f64");
			expect(dtype.type).to.equal("f64");
		});
	});
});

},{"../lib/furious.js":6,"chai":13}],47:[function(require,module,exports){
var furious = require("../lib/furious.js");
var expect = require("chai").expect;

var context = null;
before(function(done) {
	furious.init(function(ctx) {
		context = ctx;
		done();
	});
});

describe("NDArray", function() {
	describe("length", function() {
		it("Equals to the number passed in constructor", function() {
			var x = context.empty(42);
			expect(x.length).to.equal(42);
			x.invalidate();
		});
		it("Equals to the number passed in constructor as an array", function() {
			var x = context.empty([42]);
			expect(x.length).to.equal(42);
			x.invalidate();
		});
		it("Equals to the product of dimensions", function() {
			var x = context.empty([2, 5, 3]);
			expect(x.length).to.equal(30);
			x.invalidate();
		});
	});
	describe("reshape", function() {
		it("Preserves length", function() {
			var x = context.empty([7,5,3]);
			var y = x.reshape([21,5]);
			expect(y.length).to.equal(x.length);
			y.invalidate();
		});
		it("Changes shape", function() {
			var x = context.empty([7,5,3]);
			var y = x.reshape([21,5]);
			expect(y.shape).to.deep.equal([21,5]);
			y.invalidate();
		});
		it("Rearranges data", function(done) {
			var x = context.linspace(1, 8, 8).reshape([2, 2, 2]);
			x.get(function(result) {
				expect(result).to.deep.equal([[[ 1,  2], [ 3,  4]],
											  [[ 5,  6], [ 7,  8]]]);
				done();
			});
		});
	});
	describe("repeat", function() {
		it("Repeats array elements along axis 0", function(done) {
			var x = context.array([[8, 1, 6],
			                       [3, 5, 7],
			                       [4, 9, 2]]);
			x.repeat(2, 0).get(function(y) {
				expect(y).to.deep.equal([[8, 1, 6],
				                         [8, 1, 6],
				                         [3, 5, 7],
				                         [3, 5, 7],
				                         [4, 9, 2],
				                         [4, 9, 2]]);
				done();
			});
		});
		it("Repeats array elements along axis 1", function(done) {
			var x = context.array([[8, 1, 6],
			                       [3, 5, 7],
			                       [4, 9, 2]]);
			x.repeat(2, 1).get(function(y) {
				expect(y).to.deep.equal([[8, 8, 1, 1, 6, 6],
				                         [3, 3, 5, 5, 7, 7],
				                         [4, 4, 9, 9, 2, 2]]);
				done();
			});
		});
	});
	describe("get", function(){
		it("Works with 1-dimensional array", function(done) {
			var x = context.array([42, 10]);
			x.get(function(y) {
				expect(y).to.deep.equal([42, 10]);
				done();
			});
		});
		it("Works with 2-dimensional array", function(done) {
			var array = [[16,  2,  3, 13,  5],
						 [11, 10,  8,  9,  7],
						 [ 6, 12,  4, 14, 15]];
			var x = context.array(array);
			x.get(function(y) {
				expect(y).to.deep.equal(array);
				done();
			});
		});
	});
	describe("add", function() {
		describe("Add array", function() {
			it("Correct result for 1-dimensional arrays", function(done) {
				var x = context.array([1, 4, 9]);
				var y = context.array([8, -1, 10]);
				var z = x.add(y);
				z.get(function(z) {
					expect(z).to.deep.equal([9, 3, 19]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done) {
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[8, -1], [10, -21]]);
				var z = x.add(y);
				z.get(function(result) {
					expect(result).to.deep.equal([[9, 3], [19, -38]]);
					done();
				});
			});
		});
		describe("Add scalar", function(){
			it("Correct result for 1-dimensional arrays", function(done) {
				var x = context.array([1, 4, 9]);
				var z = x.add(-7);
				z.get(function(z) {
					expect(z).to.deep.equal([-6, -3, 2]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done) {
				var x = context.array([[1, 4], [9, -17]]);
				var z = x.add(42);
				z.get(function(z) {
					expect(z).to.deep.equal([[43, 46], [51, 25]]);
					done();
				});
			});
		});
	});
	describe("sub", function() {
		describe("Subtract array", function() {
			it("Correct result for 1-dimensional arrays", function(done) {
				var x = context.array([1, 4, 9]);
				var y = context.array([8, -1, 10]);
				var z = x.sub(y);
				z.get(function(result) {
					expect(result).to.deep.equal([-7, 5, -1]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done) {
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[8, -1], [10, -21]]);
				var z = x.sub(y);
				z.get(function(result) {
					expect(result).to.deep.equal([[-7, 5], [-1, 4]]);
					done();
				});
			});
		});
		describe("Subtract scalar", function() {
			it("Correct result for 1-dimensional arrays", function(done) {
				var x = context.array([1, 4, 9]);
				var y = x.sub(-7);
				y.get(function(y) {
					expect(y).to.deep.equal([8, 11, 16]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done) {
				var x = context.array([[1, 4], [9, -17]]);
				var y = x.sub(42);
				y.get(function(y) {
					expect(y).to.deep.equal([[-41, -38], [-33, -59]]);
					done();
				});
			});
		});
	});
	describe("mul", function() {
		describe("Multiply by array", function() {
			it("Correct result for 1-dimensional arrays", function(done) {
				var x = context.array([1, 4, 9]);
				var y = context.array([8, -1, 10]);
				var z = x.mul(y);
				z.get(function(z) {
					expect(z).to.deep.equal([8, -4, 90]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done) {
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[8, -1], [10, -21]]);
				var z = x.mul(y);
				z.get(function(z) {
					expect(z).to.deep.equal([[8, -4], [90, 357]]);
					done();
				});
			});
		});
		describe("Multiply by scalar", function() {
			it("Correct result for 1-dimensional arrays", function(done) {
				var x = context.array([1, 4, 9]);
				var y = x.mul(-10);
				y.get(function(y) {
					expect(y).to.deep.equal([-10, -40, -90]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done) {
				var x = context.array([[1, 4], [9, -17]]);
				var y = x.mul(10);
				y.get(function(y) {
					expect(y).to.deep.equal([[10, 40], [90, -170]]);
					done();
				});
			});
		});
	});
	describe("div", function(){
		describe("Divide by array", function(){
			it("Correct result for 1-dimensional arrays", function(done) {
				var x = context.array([1, 4, 9]);
				var y = context.array([2, -4, 8]);
				var z = x.div(y);
				z.get(function(z) {
					expect(z).to.deep.equal([0.5, -1, 1.125]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done) {
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[-2, 4], [-8, 16]]);
				var z = x.div(y);
				z.get(function(z) {
					expect(z).to.deep.equal([[-0.5, 1], [-1.125, -1.0625]]);
					done();
				});
			});
		});
		describe("Divide by scalar", function() {
			it("Correct result for 1-dimensional arrays", function() {
				var x = context.array([1, 4, 9]);
				var y = x.div(-2);
				y.get(function(y) {
					expect(y).to.deep.equal([-0.5, -2, -4.5]);
				});
			});
			it("Correct result for 2-dimensional arrays", function() {
				var x = context.array([[1, 4], [9, -17]]);
				var y = x.div(-4);
				y.get(function(y) {
					expect(y).to.deep.equal([[-0.25, -1], [-2.25, 4.25]]);
				});
			});
		});
	});
	describe("min", function(){
		describe("All elements", function(){
			it("Returns zero-dimensional array of length one", function() {
				var x = context.zeros([20, 30]);
				var y = x.min();
				expect(y.shape).to.deep.equal([]);
				expect(y.length).to.equal(1);
				y.invalidate();
			});
			it("Computes the minimum of all elements in an array", function(done) {
				var x = context.linspace(-50, 100, 100000).reshape([200, 500]);
				x.min().get(function(y) {
					expect(y).to.equal(-50);
					done();
				});
			});
		});
		describe("Along an axis", function() {
			it("Correct shape for 3-dimensional arrays", function() {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]).lock();
				expect(x.min(0).shape).to.deep.equal([3, 4]);
				expect(x.min(1).shape).to.deep.equal([2, 4]);
				expect(x.min(2).shape).to.deep.equal([2, 3]);
				x.invalidate();
			});
			it("Correct result for 3-dimensional arrays, axis 0", function(done) {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.min(0).get(function(y) {
					expect(y).to.deep.equal([[ 1,  2,  3,  4],
					                         [ 5,  6,  7,  8],
					                         [ 9, 10, 11, 12]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 1", function(done) {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.min(1).get(function(y) {
					expect(y).to.deep.equal([[  1,  2,  3,  4],
					                         [ 13, 14, 15, 16]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 2", function(done) {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.min(2).get(function(y) {
					expect(y).to.deep.equal([[  1,  5,  9],
					                         [ 13, 17, 21]]);
					done();
				});
			});
		});
	});
	describe("max", function() {
		describe("All elements", function() {
			it("Returns zero-dimensional array of length one", function() {
				var x = context.zeros([20, 30]);
				var y = x.max();
				expect(y.shape).to.deep.equal([]);
				expect(y.length).to.equal(1);
				y.invalidate();
			});
			it("Computes the maximum of all elements in an array", function(done) {
				var x = context.linspace(-50, 100, 100000).reshape([200, 500]);
				x.max().get(function(y) {
					expect(y).to.equal(100);
					done();
				});
			});
		});
		describe("Along an axis", function() {
			it("Correct shape for 3-dimensional arrays", function() {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]).lock();
				expect(x.max(0).shape).to.deep.equal([3, 4]);
				expect(x.max(1).shape).to.deep.equal([2, 4]);
				expect(x.max(2).shape).to.deep.equal([2, 3]);
				x.invalidate();
			});
			it("Correct result for 3-dimensional arrays, axis 0", function(done) {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.max(0).get(function(y) {
					expect(y).to.deep.equal([[ 13, 14, 15, 16],
					                         [ 17, 18, 19, 20],
					                         [ 21, 22, 23, 24]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 1", function(done) {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.max(1).get(function(y) {
					expect(y).to.deep.equal([[  9, 10, 11, 12],
					                         [ 21, 22, 23, 24]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 2", function(done) {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.max(2).get(function(y) {
					expect(y).to.deep.equal([[  4,  8, 12],
					                         [ 16, 20, 24]]);
					done();
				});
			});
		});
	});
	describe("sum", function() {
		describe("All elements", function() {
			it("Returns zero-dimensional array of length one", function() {
				var x = context.zeros([20, 30]);
				var y = x.sum();
				expect(y.shape).to.deep.equal([]);
				expect(y.length).to.equal(1);
				y.invalidate();
			});
			it("Computes the sum of all elements in an array", function(done) {
				var x = context.linspace(1, 100000, 100000).reshape([200, 500]);
				x.sum().get(function(y) {
					expect(y).to.equal(5000050000);
					done();
				});
			});
		});
		describe("Along an axis", function() {
			it("Correct shape for 3-dimensional arrays", function() {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]).lock();
				expect(x.sum(0).shape).to.deep.equal([3, 4]);
				expect(x.sum(1).shape).to.deep.equal([2, 4]);
				expect(x.sum(2).shape).to.deep.equal([2, 3]);
				x.invalidate();
			});
			it("Correct result for 3-dimensional arrays, axis 0", function(done) {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.sum(0).get(function(y) {
					expect(y).to.deep.equal([[ 14, 16, 18, 20],
					                         [ 22, 24, 26, 28],
					                         [ 30, 32, 34, 36]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 1", function(done) {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.sum(1).get(function(y) {
					expect(y).to.deep.equal([[ 15,  18,  21,  24],
					                         [ 51,  54,  57,  60]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 2", function(done) {
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.sum(2).get(function(y) {
					expect(y).to.deep.equal([[ 10,  26,  42],
					                         [ 58,  74,  90]]);
					done();
				});
			});
		});
	});
	describe("dot", function() {
		it("Correct shape for 2-dimensional arrays", function() {
			var x = context.empty([2, 5]);
			var y = context.empty([5, 11]);
			var z = context.dot(x, y);
			expect(z.shape).to.deep.equal([2, 11]);
			z.invalidate();
		});
		it("Correct shape for 3-dimensional arrays", function() {
			var x = context.empty([2, 3, 4]);
			var y = context.empty([7, 4, 8]);
			var z = context.dot(x, y);
			expect(z.shape).to.deep.equal([2, 3, 7, 8]);
			z.invalidate();
		});
		it("Correct shape for 4-dimensional arrays", function() {
			var x = context.empty([2, 3, 4, 5]);
			var y = context.empty([6, 7, 5, 8]);
			var z = context.dot(x, y);
			expect(z.shape).to.deep.equal([2, 3, 4, 6, 7, 8]);
			z.invalidate();
		});
		it("Correct value for 1-dimensional arrays", function(done) {
			var x = context.array([2, 5]);
			var y = context.array([5, 11]);
			context.dot(x, y).get(function(z) {
				expect(z).to.deep.equal(65);
				done();
			});
		});
		it("Correct value for 2-dimensional arrays", function(done) {
			var x = context.array([[64,  2,  3],
			                       [61, 60,  6]]);
			var y = context.array([[92, 99,  1,  8, 15],
			                       [67, 74, 51, 58, 40],
			                       [98, 80,  7, 14, 16]]);
			var z = context.dot(x, y);
			z.get(function(result) {
				expect(result).to.deep.equal([[  6316,  6724,  187,  670, 1088],
				                              [ 10220, 10959, 3163, 4052, 3411]]);
				done();
			});
		});
	});
});

},{"../lib/furious.js":6,"chai":13}]},{},[45,46,47])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9saWIvRGF0YVR5cGUuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9saWIvSlNDb250ZXh0LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL05EQXJyYXkuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9saWIvUE5hQ2xDb250ZXh0LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL2FsbG9jYXRvci5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL2xpYi9mdXJpb3VzLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL2pzbWF0aC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL2xpYi91dGlsLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL3dlYmNsL1dlYkNMQ29udGV4dC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9pbmRleC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvYXNzZXJ0aW9uLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvY29uZmlnLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvY29yZS9hc3NlcnRpb25zLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvaW50ZXJmYWNlL2Fzc2VydC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL2ludGVyZmFjZS9leHBlY3QuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS9pbnRlcmZhY2Uvc2hvdWxkLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvYWRkQ2hhaW5hYmxlTWV0aG9kLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvYWRkTWV0aG9kLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvYWRkUHJvcGVydHkuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9mbGFnLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvZ2V0QWN0dWFsLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvZ2V0RW51bWVyYWJsZVByb3BlcnRpZXMuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9nZXRNZXNzYWdlLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvZ2V0TmFtZS5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL2dldFBhdGhWYWx1ZS5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL2dldFByb3BlcnRpZXMuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9pbmRleC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL2luc3BlY3QuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9vYmpEaXNwbGF5LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvb3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvb3ZlcndyaXRlTWV0aG9kLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvb3ZlcndyaXRlUHJvcGVydHkuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy90ZXN0LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvdHJhbnNmZXJGbGFncy5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL3R5cGUuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9ub2RlX21vZHVsZXMvYXNzZXJ0aW9uLWVycm9yL2luZGV4LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbm9kZV9tb2R1bGVzL2RlZXAtZXFsL2luZGV4LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbm9kZV9tb2R1bGVzL2RlZXAtZXFsL2xpYi9lcWwuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9ub2RlX21vZHVsZXMvZGVlcC1lcWwvbm9kZV9tb2R1bGVzL3R5cGUtZGV0ZWN0L2luZGV4LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbm9kZV9tb2R1bGVzL2RlZXAtZXFsL25vZGVfbW9kdWxlcy90eXBlLWRldGVjdC9saWIvdHlwZS5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL3Rlc3QvQ29udGV4dC50ZXN0LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvdGVzdC9EYXRhVHlwZS50ZXN0LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvdGVzdC9OREFycmF5LnRlc3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNpQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxWUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVtQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2x5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaGlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqUUE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIEEgbnVtZXJpY2FsIGRhdGEgdHlwZSBvYmplY3QuXG4gKlxuICogQGNsYXNzIERhdGFUeXBlXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIC0gdGhlIGFiYnJldmlhdGVkIG5hbWUgb2YgdGhlIGRhdGEgdHlwZS4gVGhlIGZvbGxvd2luZyBuYW1lcyBhcmUgc3VwcG9ydGVkOlxuICpcbiAqICAgICA8dGFibGU+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0aD5BYmJyZXZpYXRlZCBOYW1lPC90aD5cbiAqICAgICAgICAgICAgIDx0aD5JbnRlcnByZXRhdGlvbjwvdGg+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cImYzMlwiPC90ZD5cbiAqICAgICAgICAgICAgIDx0ZD5TaW5nbGUtcHJlY2lzaW9uICgzMi1iaXQpIElFRUUtNzU0IGZsb2F0aW5nLXBvaW50IHR5cGUuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwiZjY0XCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPkRvdWJsZS1wcmVjaXNpb24gKDY0LWJpdCkgSUVFRS03NTQgZmxvYXRpbmctcG9pbnQgdHlwZS48L3RkPlxuICogICAgICAgICA8L3RyPlxuICogICAgIDwvdGFibGU+XG4gKlxuICovXG5mdW5jdGlvbiBEYXRhVHlwZSh0eXBlKSB7XG5cdGlmIChbXCJmMzJcIiwgXCJmNjRcIl0uaW5kZXhPZih0eXBlKSA+PSAwKSB7XG5cdFx0dGhpcy50eXBlID0gdHlwZTtcblx0XHR0aGlzLnNpemUgPSB7XCJmMzJcIjogNCwgXCJmNjRcIjogOH1bdHlwZV07XG5cdFx0dGhpcy5lcHNpbG9uID0ge1wiZjMyXCI6IDEuMTkyMDkyODk1NTA3ODEyNWUtNywgXCJmNjRcIjogMi4yMjA0NDYwNDkyNTAzMTMxZS0xNn1bdHlwZV07XG5cdFx0dGhpcy5hcnJheVR5cGUgPSB7XCJmMzJcIjogRmxvYXQzMkFycmF5LCBcImY2NFwiOiBGbG9hdDY0QXJyYXl9W3R5cGVdO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVHlwZSBcIiArIHR5cGUgKyBcIiBpcyBub3Qgc3VwcG9ydGVkXCIpO1xuXHR9XG59XG5cbi8qKlxuICogQ29tcGFyZXMgdHdvIGRhdGEgdHlwZSBvYmplY3RzIGZvciBlcXVhbGl0eS5cbiAqXG4gKiBAbWV0aG9kIGVxdWFsc1xuICogQHBhcmFtIHthbnl9IG90aGVyIC0gYW4gb2JqZWN0IHRvIGNvbXBhcmUgdG8uXG4gKi9cbkRhdGFUeXBlLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbihvdGhlcikge1xuXHRyZXR1cm4gKG90aGVyIGluc3RhbmNlb2YgRGF0YVR5cGUpICYmICh0aGlzLmFycmF5VHlwZSA9PT0gb3RoZXIuYXJyYXlUeXBlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGF0YVR5cGU7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIE5EQXJyYXkgPSByZXF1aXJlKFwiLi9OREFycmF5XCIpO1xudmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWxcIik7XG52YXIganNtYXRoID0gcmVxdWlyZShcIi4vanNtYXRoXCIpO1xuXG4vKipcbiAqIFByb3ZpZGVzIG1ldGhvZHMgZm9yIGNyZWF0aW9uLCBtYW5pcHVsYXRpb24sIGFuZCBkZXN0cnVjdGlvbiBvZiBOLWRpbWVuc2lvbmFsIGFycmF5cy5cbiAqIEFyaXRobWV0aWMgb3BlcmF0aW9ucyBhcmUgcG9zc2libGUgb25seSBvbiBhcnJheXMgdGhhdCBiZWxvbmcgdG8gdGhlIHNhbWUgY29udGV4dC5cbiAqXG4gKiBAY2xhc3MgQ29udGV4dFxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEpTQ29udGV4dChvcHRpb25zLCBjYWxsYmFjaykge1xuXHRjYWxsYmFjayh0aGlzKTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGFuIHVuaW5pYWxpemVkIE4tZGltZW5zaW9uYWwgYXJyYXkuXG4gKlxuICogQG1ldGhvZCBlbXB0eVxuICogQHBhcmFtIHtOdW1iZXJ9IHNoYXBlIC0gdGhlIGRpbWVuc2lvbnMgb2YgdGhlIGFycmF5XG4gKiBAcGFyYW0ge0RhdGFUeXBlfSBkYXRhVHlwZSAtIHRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5lbXB0eSA9IGZ1bmN0aW9uKHNoYXBlLCBkYXRhVHlwZSkge1xuXHQvKiBUaGUgaXMgbm8gd2F5IHRvIGNyZWF0ZSB1bmluaXRpYWxpemVkIHR5cGVkIGFycmF5IGluIEphdmFTY3JpcHQgKi9cblx0cmV0dXJuIHRoaXMuemVyb3Moc2hhcGUsIGRhdGFUeXBlKTtcbn07XG5cbi8qKlxuICogQ29uc3RydWN0cyBhbiBOLWRpbWVuc2lvbmFsIGFycmF5IHdpdGggZWxlbWVudHMgaW5pdGlhbGl6ZWQgdG8gemVyby5cbiAqXG4gKiBAbWV0aG9kIHplcm9zXG4gKiBAcGFyYW0ge051bWJlcn0gc2hhcGUgLSB0aGUgZGltZW5zaW9ucyBvZiB0aGUgYXJyYXlcbiAqIEBwYXJhbSB7RGF0YVR5cGV9IGRhdGFUeXBlIC0gdGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICovXG5KU0NvbnRleHQucHJvdG90eXBlLnplcm9zID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2Uge1xuXHRcdGRhdGFUeXBlID0gdXRpbC5jaGVja0RhdGFUeXBlKGRhdGFUeXBlKTtcblx0fVxuXHR2YXIgYXJyYXkgPSBuZXcgTkRBcnJheShzaGFwZSwgZGF0YVR5cGUsIHRoaXMpO1xuXHRhcnJheS5fZGF0YSA9IG5ldyBkYXRhVHlwZS5hcnJheVR5cGUoYXJyYXkubGVuZ3RoKTtcblx0cmV0dXJuIGFycmF5O1xufTtcblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGFuIE4tZGltZW5zaW9uYWwgYXJyYXkgd2l0aCBlbGVtZW50cyBpbml0aWFsaXplZCB0byBvbmUuXG4gKlxuICogQG1ldGhvZCBvbmVzXG4gKiBAcGFyYW0ge051bWJlcn0gc2hhcGUgLSB0aGUgZGltZW5zaW9ucyBvZiB0aGUgYXJyYXlcbiAqIEBwYXJhbSB7RGF0YVR5cGV9IGRhdGFUeXBlIC0gdGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICovXG5KU0NvbnRleHQucHJvdG90eXBlLm9uZXMgPSBmdW5jdGlvbihzaGFwZSwgZGF0YVR5cGUpIHtcblx0LyogVGhlIGlzIG5vIHdheSB0byBjcmVhdGUgdW5pbml0aWFsaXplZCB0eXBlZCBhcnJheSBpbiBKYXZhU2NyaXB0ICovXG5cdHZhciBhcnJheSA9IHRoaXMuemVyb3Moc2hhcGUsIGRhdGFUeXBlKTtcblx0anNtYXRoLmZpbGwoYXJyYXkuX2RhdGEsIDEuMCk7XG5cdHJldHVybiBhcnJheTtcbn07XG5cbi8qKlxuICogQ29uc3RydWN0cyBhbiBOLWRpbWVuc2lvbmFsIGFycmF5IG9iamVjdCB3aXRoIHRoZSBwcm92aWRlZCBkYXRhLlxuICpcbiAqIEBtZXRob2QgYXJyYXlcbiAqIEBwYXJhbSB7TnVtYmVyW119IGRhdGEgLSB0aGUgYXJyYXkgZGF0YVxuICogQHBhcmFtIHtEYXRhVHlwZX0gZGF0YVR5cGUgLSB0aGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUuYXJyYXkgPSBmdW5jdGlvbihkYXRhLCBkYXRhVHlwZSkge1xuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XG5cdH0gZWxzZSB7XG5cdFx0ZGF0YVR5cGUgPSB1dGlsLmNoZWNrRGF0YVR5cGUoZGF0YVR5cGUpO1xuXHR9XG5cdHZhciBzaGFwZSA9IFtdO1xuXHR1dGlsLmRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZShkYXRhLCBzaGFwZSwgMCk7XG5cdHZhciBhcnJheSA9IHRoaXMuZW1wdHkoc2hhcGUsIGRhdGFUeXBlKTtcblx0dXRpbC5jb3B5QXJyYXlEYXRhUmVjdXJzaXZlKGFycmF5Ll9kYXRhLCBkYXRhLCBzaGFwZSwgMCwgMCk7XG5cdHJldHVybiBhcnJheTtcbn07XG5cbi8qKlxuICogRGUtYWxsb2NhdGVzIGRhdGEgYXNzb2NpYXRlZCB3aXRoIHRoZSBhcnJheS5cbiAqXG4gKiBAbWV0aG9kIF9pbnZhbGlkYXRlXG4gKiBAcHJpdmF0ZVxuICpcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXkgLSB0aGUgbi1kaW1lbnNpb25hbCBhcnJheSBvYmplY3Qgd2l0aCBkYXRhIHRvIGJlIGRlLWFsbG9jYXRlZC5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5faW52YWxpZGF0ZSA9IGZ1bmN0aW9uKGFycmF5KSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGFycmF5LCBcImFycmF5XCIpO1xuXHRhcnJheS5fZGF0YSA9IG51bGw7XG59O1xuXG4vKipcbiAqIEZldGNoZXMgTkRBcnJheSBkYXRhIGFuZCBhc3luY2hyb25vdXNseSByZXR1cm5zIGl0IGFzIEphdmFTY3JpcHQgYXJyYXlzIG9yIG51bWJlcnMuXG4gKlxuICogQG1ldGhvZCBnZXRcbiAqIEBhc3luY1xuICpcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXlzKiAtIE5EQXJyYXlzIHRvIGZldGNoLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBBIGNhbGxiYWNrIHRvIGJlIGNhbGxlZCB3aXRoIHRoZSBkYXRhIHdoZW4gaXQgaXMgYXZhaWxhYmxlLlxuICogQHBhcmFtIHtOdW1iZXJ8TnVtYmVyW119IGNhbGxiYWNrLmFycmF5cyogLSBKYXZhU2NyaXB0IG51bWJlcnMgb3IgbXVsdGlkaW1lbnNpb25hbCBhcnJheXMgd2l0aCB0aGUgZGF0YS4gVGhlIG51bWJlciBhbmQgb3JkZXIgb2YgYXJndW1lbnRzIG1hdGNoZXMgdGhlIE5EQXJyYXlzIHBhc3NlZCB0byB0aGUgbWV0aG9kIGNhbGwuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oKSB7XG5cdGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgYXJndW1lbnQgbWlzc2luZ1wiKTtcblx0fVxuXHR2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdO1xuXHQvKiBWYWxpZGF0ZSBhcmd1bWVudHMgKi9cblx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdCBsZWFzdCBvbmUgTkRBcnJheSBhcmd1bWVudCBleHBlY3RlZFwiKTtcblx0fVxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyArK2kpIHtcblx0XHR1dGlsLmNoZWNrTkRBcnJheShhcmd1bWVudHNbaV0sIFwiYXJndW1lbnQgXCIgKyBpKTtcblx0fVxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyArK2kpIHtcblx0XHRhcmd1bWVudHNbaV0uX2RlY1JlZigpO1xuXHR9XG5cdHZhciBjYWxsYmFja0FyZ3VtZW50cyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tBcmd1bWVudHMubGVuZ3RoOyArK2kpIHtcblx0XHR2YXIgYXJyYXkgPSBhcmd1bWVudHNbaV07XG5cdFx0aWYgKGFycmF5LnNoYXBlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBhcnJheS5fZGF0YVswXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmFyIGpzYXJyYXkgPSBuZXcgQXJyYXkoYXJyYXkuc2hhcGVbMF0pO1xuXHRcdFx0dXRpbC5jcmVhdGVBcnJheVJlY3Vyc2l2ZShhcnJheS5fZGF0YSwganNhcnJheSwgYXJyYXkuc2hhcGUsIDAsIDApO1xuXHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBqc2FycmF5O1xuXHRcdH1cblx0fVxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyArK2kpIHtcblx0XHRhcmd1bWVudHNbaV0uX3RyeUludmFsaWRhdGUoKTtcblx0fVxuXHRjYWxsYmFjay5hcHBseShudWxsLCBjYWxsYmFja0FyZ3VtZW50cyk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYW5vdGhlciBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEsIGJ1dCBkaWZmZXJlbnQgZGltZW5zaW9ucy5cbiAqXG4gKiBAbWV0aG9kIHJlc2hhcGVcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gc2hhcGUgLSBkaW1lbnNpb25zIG9mIHRoZSBuZXcgYXJyYXkuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUucmVzaGFwZSA9IGZ1bmN0aW9uKGFycmF5LCBzaGFwZSkge1xuXHRzaGFwZSA9IHV0aWwuY2hlY2tTaGFwZShzaGFwZSk7XG5cdGlmICh1dGlsLmNvbXB1dGVMZW5ndGgoc2hhcGUpICE9PSBhcnJheS5sZW5ndGgpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBzaGFwZSBpcyBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSBhcnJheVwiKTtcblx0fVxuXHR2YXIgb3V0ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGFycmF5LmRhdGFUeXBlLCB0aGlzKTtcblx0aWYgKGFycmF5Ll9kZWNSZWYoKSkge1xuXHRcdG91dC5fZGF0YSA9IG5ldyBvdXQuZGF0YVR5cGUuYXJyYXlUeXBlKG91dC5sZW5ndGgpO1xuXHRcdG91dC5fZGF0YS5zZXQoYXJyYXkuX2RhdGEpO1xuXHR9IGVsc2Uge1xuXHRcdG91dC5fZGF0YSA9IGFycmF5Ll9kYXRhO1xuXHRcdGFycmF5Ll90cnlJbnZhbGlkYXRlKCk7XG5cdH1cblx0cmV0dXJuIG91dDtcbn07XG5cbi8qKlxuICogRHVwbGljYXRlcyBhcnJheSBlbGVtZW50cyBhbG9uZyB0aGUgc3BlY2lmaWVkIGF4aXMuXG4gKlxuICogQG1ldGhvZCByZXBlYXRcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSByZXBlYXRzIC0gdGhlIG51bWJlciBvZiB0aW1lcyB0byByZXBlYXQgZWFjaCBlbGVtZW50LlxuICogQHBhcmFtIHtOdW1iZXJ9IGF4aXMgLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgZWxlbWVudHMgd2lsbCBiZSBkdXBsaWNhdGVkLlxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIGFuIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgcmVzdWx0LlxuICogQHJldHVybiB7TkRBcnJheX0gLSBhbiBOLWRpbWVuc2lvbmFsIGFycmF5IHdpdGggcmVwZWF0ZWQgZWxlbWVudHMgb2YgYXJyYXkgKiphKiouXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUucmVwZWF0ID0gZnVuY3Rpb24oYSwgcmVwZWF0cywgYXhpcywgb3V0KSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcblx0cmVwZWF0cyA9IHV0aWwuY2hlY2tSZXBlYXRzKHJlcGVhdHMpO1xuXHRheGlzID0gdXRpbC5jaGVja0F4aXMoYXhpcywgYS5zaGFwZS5sZW5ndGgpO1xuXHR2YXIgc2hhcGVBID0gYS5zaGFwZTtcblx0dmFyIHNoYXBlT3V0ID0gc2hhcGVBLnNsaWNlKDApO1xuXHRzaGFwZU91dFtheGlzXSAqPSByZXBlYXRzO1xuXHRhLl9kZWNSZWYoKTtcblx0dHJ5IHtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gdGhpcy5lbXB0eShzaGFwZU91dCwgYS5kYXRhVHlwZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShvdXQuc2hhcGUsIHNoYXBlT3V0KTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XG5cdFx0XHRvdXQuX2luY1JlZigpO1xuXHRcdH1cblx0XHR2YXIgb3V0ZXJTdHJpZGUgPSB1dGlsLmNvbXB1dGVPdXRlclN0cmlkZShzaGFwZUEsIGF4aXMpO1xuXHRcdHZhciBpbm5lclN0cmlkZSA9IHV0aWwuY29tcHV0ZUlubmVyU3RyaWRlKHNoYXBlQSwgYXhpcyk7XG5cdFx0anNtYXRoLnJlcGVhdChhLl9kYXRhLCBvdXQuX2RhdGEsIG91dGVyU3RyaWRlLCBpbm5lclN0cmlkZSwgc2hhcGVBW2F4aXNdLCByZXBlYXRzKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdGEuX2luY1JlZigpO1xuXHRcdHRocm93IGU7XG5cdH1cblx0YS5fdHJ5SW52YWxpZGF0ZSgpO1xuXHRyZXR1cm4gb3V0O1xufTtcblxudmFyIGJpbmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBiLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbiwgb3BlcmF0aW9uQ29uc3QsIG9wZXJhdGlvblJldkNvbnN0KSB7XG5cdHZhciBzaGFwZU91dCA9IG51bGwsIGRhdGFUeXBlT3V0ID0gbnVsbDtcblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0c2hhcGVPdXQgPSBhLnNoYXBlO1xuXHRcdGRhdGFUeXBlT3V0ID0gYS5kYXRhVHlwZTtcblx0XHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KGEuc2hhcGUsIGIuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XG5cdFx0fSBlbHNlIGlmICghdXRpbC5pc051bWJlcihiKSkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYlwiKTtcblx0XHR9XG5cdH0gZWxzZSBpZiAodXRpbC5pc051bWJlcihhKSkge1xuXHRcdHNoYXBlT3V0ID0gYi5zaGFwZTtcblx0XHRkYXRhVHlwZU91dCA9IGIuZGF0YVR5cGU7XG5cdFx0dXRpbC5jaGVja05EQXJyYXkoYiwgXCJiXCIpO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGFcIik7XG5cdH1cblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0YS5fZGVjUmVmKCk7XG5cdH1cblx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0Yi5fZGVjUmVmKCk7XG5cdH1cblx0dHJ5IHtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoc2hhcGVPdXQsIGRhdGFUeXBlT3V0LCBjb250ZXh0KTtcblx0XHRcdGlmICgoYSBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFhLl9oYXNSZWZzKCkpIHtcblx0XHRcdFx0b3V0Ll9kYXRhID0gYS5fZGF0YTtcblx0XHRcdH0gZWxzZSBpZiAoKGIgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYi5faGFzUmVmcygpKSB7XG5cdFx0XHRcdG91dC5fZGF0YSA9IGIuX2RhdGE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXQuX2RhdGEgPSBuZXcgZGF0YVR5cGVPdXQuYXJyYXlUeXBlKG91dC5sZW5ndGgpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoc2hhcGVPdXQsIG91dC5zaGFwZSk7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShkYXRhVHlwZU91dCwgb3V0LmRhdGFUeXBlKTtcblx0XHRcdG91dC5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRcdG9wZXJhdGlvbihhLl9kYXRhLCBiLl9kYXRhLCBvdXQuX2RhdGEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3BlcmF0aW9uQ29uc3QoYS5fZGF0YSwgK2IsIG91dC5fZGF0YSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdG9wZXJhdGlvblJldkNvbnN0KGIuX2RhdGEsICthLCBvdXQuX2RhdGEpO1xuXHRcdH1cblx0fSBjYXRjaCAoZSkge1xuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXG5cdFx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRhLl9pbmNSZWYoKTtcblx0XHR9XG5cdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRiLl9pbmNSZWYoKTtcblx0XHR9XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRhLl90cnlJbnZhbGlkYXRlKCk7XG5cdH1cblx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0Yi5fdHJ5SW52YWxpZGF0ZSgpO1xuXHR9XG5cdHJldHVybiBvdXQ7XG59O1xuXG52YXIgdW5hcnlBcml0aE9wID0gZnVuY3Rpb24oYSwgb3V0LCBjb250ZXh0LCBvcGVyYXRpb24pIHtcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xuXHRhLl9kZWNSZWYoKTtcblx0dHJ5IHtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoYS5zaGFwZSwgYS5kYXRhVHlwZSwgY29udGV4dCk7XG5cdFx0XHRpZiAoKGEgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYS5faGFzUmVmcygpKSB7XG5cdFx0XHRcdG91dC5fZGF0YSA9IGEuX2RhdGE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXQuX2RhdGEgPSBuZXcgYS5kYXRhVHlwZS5hcnJheVR5cGUob3V0Lmxlbmd0aCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBvdXQuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcblx0XHRcdG91dC5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdG9wZXJhdGlvbihhLl9kYXRhLCBvdXQuX2RhdGEpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0LyogUmVzdG9yZSB0aGUgcHJldmlvdXMgc3RhdGUgKi9cblx0XHRhLl9pbmNSZWYoKTtcblx0XHR0aHJvdyBlO1xuXHR9XG5cdGEuX3RyeUludmFsaWRhdGUoKTtcblx0cmV0dXJuIG91dDtcbn07XG5cbnZhciBheGlzUmVkdWNlT3AgPSBmdW5jdGlvbihhLCBheGlzLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbiwgYXhpc09wZXJhdGlvbikge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdGlmICh0eXBlb2YgYXhpcyA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHRvdXQgPSBjb250ZXh0LmVtcHR5KFtdLCBhLmRhdGFUeXBlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KFtdLCBvdXQuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcblx0XHRcdG91dC5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdG9wZXJhdGlvbihhLl9kYXRhLCBvdXQuX2RhdGEpO1xuXHRcdGEuX3RyeVJlbGVhc2UoKTtcblx0XHRyZXR1cm4gb3V0O1xuXHR9IGVsc2Uge1xuXHRcdGF4aXMgPSB1dGlsLmNoZWNrQXhpcyhheGlzLCBhLnNoYXBlLmxlbmd0aCk7XG5cdFx0dmFyIHNoYXBlT3V0ID0gdXRpbC5jb21wdXRlQXhpc1JlZHVjdGlvbk91dFNoYXBlKGEuc2hhcGUsIGF4aXMpO1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHR2YXIgb3V0ID0gY29udGV4dC5lbXB0eShzaGFwZU91dCwgYS5kYXRhVHlwZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShbXSwgb3V0LnNoYXBlKTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XG5cdFx0XHRvdXQuX2luY1JlZigpO1xuXHRcdH1cblx0XHRheGlzT3BlcmF0aW9uKGEuX2RhdGEsIG91dC5fZGF0YSxcblx0XHRcdHV0aWwuY29tcHV0ZU91dGVyU3RyaWRlKGEuc2hhcGUsIGF4aXMpLFxuXHRcdFx0dXRpbC5jb21wdXRlSW5uZXJTdHJpZGUoYS5zaGFwZSwgYXhpcyksXG5cdFx0XHRhLnNoYXBlW2F4aXNdKTtcblx0XHRhLl90cnlSZWxlYXNlKCk7XG5cdFx0cmV0dXJuIG91dDtcblx0fVxufTtcblxuLyoqXG4gKiBBZGRzIG9uZSBudW1iZXIgb3IgYXJyYXkgd2l0aCBhbm90aGVyIG51bWJlciBvciBhcnJheS5cbiAqIEFkZGl0aW9uIGlzIHBlcmZvcm1lZCBlbGVtZW50LWJ5LWVsZW1lbnQuXG4gKlxuICogQG1ldGhvZCBhZGRcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYSAtIG9uZSBudW1iZXIgb3IgYXJyYXkgdG8gYWRkLiBJZiAqKmIqKiBpcyBhICpOdW1iZXIqLCAqKmEqKiBtdXN0IGJlIGFuICpOREFycmF5Ki5cbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYiAtIGFub3RoZXIgbnVtYmVyIG9yIGFycmF5IHRvIGFkZC4gSWYgKiphKiogaXMgYSAqTnVtYmVyKiwgKipiKiogbXVzdCBiZSBhbiAqTkRBcnJheSouXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IHdoZXJlIHRoZSByZXN1bHQgaXMgdG8gYmUgc3RvcmVkLiBJZiBwcm92aWRlZCwgbXVzdCBtYXRjaCB0aGUgc2hhcGUgYW5kIGRhdGEgdHlwZSBvZiBpbnB1dCBhcnJheXMuXG4gKiBAcmV0dXJuIHtOREFycmF5fSAtIHRoZSByZXN1bHQgb2YgZWxlbWVudC13aXNlIGFkZGl0aW9uIG9mICoqYSoqIGFuZCAqKmIqKi5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcblx0cmV0dXJuIGJpbmFyeUFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzLCBqc21hdGguYWRkLCBqc21hdGguYWRkQ29uc3QsIGpzbWF0aC5hZGRDb25zdCk7XG59O1xuXG4vKipcbiAqIFN1YnRyYWN0cyBvbmUgbnVtYmVyIG9yIGFycmF5IGZyb20gYW5vdGhlciBudW1iZXIgb3IgYXJyYXkuXG4gKiBTdWJ0cmFjdGlvbiBpcyBwZXJmb3JtZWQgZWxlbWVudC1ieS1lbGVtZW50LlxuICpcbiAqIEBtZXRob2Qgc3ViXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IGEgLSB0aGUgbnVtYmVyIG9yIGFycmF5IHRvIHN1YnRyYWN0IGZyb20uIElmICoqYioqIGlzIGEgKk51bWJlciosICoqYSoqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBiIC0gdGhlIG51bWJlciBvciBhcnJheSB0byBzdWJ0cmFjdC4gSWYgKiphKiogaXMgYSAqTnVtYmVyKiwgKipiKiogbXVzdCBiZSBhbiAqTkRBcnJheSouXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IHdoZXJlIHRoZSByZXN1bHQgaXMgdG8gYmUgc3RvcmVkLiBJZiBwcm92aWRlZCwgbXVzdCBtYXRjaCB0aGUgc2hhcGUgYW5kIGRhdGEgdHlwZSBvZiBpbnB1dCBhcnJheXMuXG4gKiBAcmV0dXJuIHtOREFycmF5fSAtIHRoZSByZXN1bHQgb2YgZWxlbWVudC13aXNlIHN1YnRyYWN0aW9uIG9mICoqYioqIGZyb20gKiphKiouXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUuc3ViID0gZnVuY3Rpb24oYSwgYiwgb3V0KSB7XG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywganNtYXRoLnN1YiwganNtYXRoLnN1YkNvbnN0LCBqc21hdGguc3ViUmV2Q29uc3QpO1xufTtcblxuLyoqXG4gKiBNdWx0aXBsaWVzIG9uZSBudW1iZXIgb3IgYXJyYXkgYnkgYW5vdGhlciBudW1iZXIgb3IgYXJyYXkuXG4gKiBNdWx0aXBsaWNhdGlvbiBpcyBwZXJmb3JtZWQgZWxlbWVudC1ieS1lbGVtZW50LlxuICpcbiAqIEBtZXRob2QgbXVsXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IGEgLSBvbmUgbnVtYmVyIG9yIGFycmF5IHRvIG11bHRpcGx5LiBJZiAqKmIqKiBpcyBhICpOdW1iZXIqLCAqKmEqKiBtdXN0IGJlIGFuICpOREFycmF5Ki5cbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYiAtIGFub3RoZXIgbnVtYmVyIG9yIGFycmF5IHRvIG11bHRpcGx5LiBJZiAqKmEqKiBpcyBhICpOdW1iZXIqLCAqKmIqKiBtdXN0IGJlIGFuICpOREFycmF5Ki5cbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgd2hlcmUgdGhlIHJlc3VsdCBpcyB0byBiZSBzdG9yZWQuIElmIHByb3ZpZGVkLCBtdXN0IG1hdGNoIHRoZSBzaGFwZSBhbmQgZGF0YSB0eXBlIG9mIGlucHV0IGFycmF5cy5cbiAqIEByZXR1cm4ge05EQXJyYXl9IC0gdGhlIHJlc3VsdCBvZiBlbGVtZW50LXdpc2UgbXVsdGlwbGljYXRpb24gb2YgKiphKiogYW5kICoqYioqLlxuICovXG5KU0NvbnRleHQucHJvdG90eXBlLm11bCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHRyZXR1cm4gYmluYXJ5QXJpdGhPcChhLCBiLCBvdXQsIHRoaXMsIGpzbWF0aC5tdWwsIGpzbWF0aC5tdWxDb25zdCwganNtYXRoLm11bENvbnN0KTtcbn07XG5cbi8qKlxuICogRGl2aWRlcyBvbmUgbnVtYmVyIG9yIGFycmF5IGJ5IGFub3RoZXIgbnVtYmVyIG9yIGFycmF5LlxuICogRGl2aXNpb24gaXMgcGVyZm9ybWVkIGVsZW1lbnQtYnktZWxlbWVudC5cbiAqXG4gKiBAbWV0aG9kIGRpdlxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBhIC0gdGhlIG51bWJlciBvciBhcnJheSB0byBkaXZpZGUuIElmICoqYioqIGlzIGEgKk51bWJlciosICoqYSoqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBiIC0gdGhlIG51bWJlciBvciBhcnJheSB0byBkaXZpZGUgYnkuIElmICoqYSoqIGlzIGEgKk51bWJlciosICoqYioqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSB3aGVyZSB0aGUgcmVzdWx0IGlzIHRvIGJlIHN0b3JlZC4gSWYgcHJvdmlkZWQsIG11c3QgbWF0Y2ggdGhlIHNoYXBlIGFuZCBkYXRhIHR5cGUgb2YgaW5wdXQgYXJyYXlzLlxuICogQHJldHVybiB7TkRBcnJheX0gLSB0aGUgcmVzdWx0IG9mIGVsZW1lbnQtd2lzZSBkaXZpc2lvbiBvZiAqKmEqKiBieSAqKmIqKi5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5kaXYgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcblx0cmV0dXJuIGJpbmFyeUFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzLCBqc21hdGguZGl2LCBqc21hdGguZGl2Q29uc3QsIGpzbWF0aC5kaXZSZXZDb25zdCk7XG59O1xuXG5KU0NvbnRleHQucHJvdG90eXBlLm1pbiA9IGZ1bmN0aW9uKGEsIGF4aXMsIG91dCkge1xuXHRyZXR1cm4gYXhpc1JlZHVjZU9wKGEsIGF4aXMsIG91dCwgdGhpcywganNtYXRoLm1pbiwganNtYXRoLmF4aXNNaW4pO1xufTtcblxuSlNDb250ZXh0LnByb3RvdHlwZS5tYXggPSBmdW5jdGlvbihhLCBheGlzLCBvdXQpIHtcblx0cmV0dXJuIGF4aXNSZWR1Y2VPcChhLCBheGlzLCBvdXQsIHRoaXMsIGpzbWF0aC5tYXgsIGpzbWF0aC5heGlzTWF4KTtcbn07XG5cbkpTQ29udGV4dC5wcm90b3R5cGUuc3VtID0gZnVuY3Rpb24oYSwgYXhpcywgb3V0KSB7XG5cdHJldHVybiBheGlzUmVkdWNlT3AoYSwgYXhpcywgb3V0LCB0aGlzLCBqc21hdGguc3VtLCBqc21hdGguYXhpc1N1bSk7XG59O1xuXG4vKipcbiAqIE5lZ2F0ZXMgYXJyYXkgZWxlbWVudHMuXG4gKlxuICogQG1ldGhvZCBuZWdcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBlbGVtZW50cyB0byBiZSBuZWdhdGVkLlxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSBmb3IgbmVnYXRlZCBlbGVtZW50cy4gSWYgc3VwcGxpZWQsIG11c3QgbWF0Y2ggdGhlIGRpbWVuc2lvbnMgYW5kIGRhdGEgdHlwZSBvZiB0aGUgKiphKiogYXJyYXkuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUubmVnID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGgubmVnKTtcbn07XG5cbi8qKlxuICogQ29tcHV0ZXMgYWJzb2x1dGUgdmFsdWUgb2YgYXJyYXkgZWxlbWVudHMuXG4gKlxuICogQG1ldGhvZCBhYnNcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBpbnB1dCBlbGVtZW50cy5cbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgZm9yIGNvbXB1dGVkIGFic29sdXRlIHZhbHVlcy4gSWYgc3VwcGxpZWQsIG11c3QgbWF0Y2ggdGhlIGRpbWVuc2lvbnMgYW5kIGRhdGEgdHlwZSBvZiB0aGUgKiphKiogYXJyYXkuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUuYWJzID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGguYWJzKTtcbn07XG5cbi8qKlxuICogRXhwb25lbnRpYXRlcyBhcnJheSBlbGVtZW50cy5cbiAqXG4gKiBAbWV0aG9kIGV4cFxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGFycmF5IG9mIGVsZW1lbnRzIHRvIGJlIGV4cG9uZW50aWF0ZWQuXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IGZvciBleHBvbmVudGlhdGVkIGVsZW1lbnRzLiBJZiBzdXBwbGllZCwgbXVzdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBhbmQgZGF0YSB0eXBlIG9mIHRoZSAqKmEqKiBhcnJheS5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5leHAgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIGpzbWF0aC5leHApO1xufTtcblxuLyoqXG4gKiBDb21wdXRlcyBsb2dhcml0aG0gb2YgYXJyYXkgZWxlbWVudHMuXG4gKlxuICogQG1ldGhvZCBsb2dcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBpbnB1dCBlbGVtZW50cy5cbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgZm9yIGNvbXB1dGVkIGxvZ2FyaXRobSB2YWx1ZXMuIElmIHN1cHBsaWVkLCBtdXN0IG1hdGNoIHRoZSBkaW1lbnNpb25zIGFuZCBkYXRhIHR5cGUgb2YgdGhlICoqYSoqIGFycmF5LlxuICovXG5KU0NvbnRleHQucHJvdG90eXBlLmxvZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywganNtYXRoLmxvZyk7XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIHNxdWFyZSByb290IG9mIGFycmF5IGVsZW1lbnRzLlxuICpcbiAqIEBtZXRob2Qgc3FydFxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGFycmF5IG9mIGlucHV0IGVsZW1lbnRzLlxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSBmb3IgY29tcHV0ZWQgc3F1YXJlIHJvb3QgdmFsdWVzLiBJZiBzdXBwbGllZCwgbXVzdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBhbmQgZGF0YSB0eXBlIG9mIHRoZSAqKmEqKiBhcnJheS5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5zcXJ0ID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGguc3FydCk7XG59O1xuXG4vKipcbiAqIFNxdWFyZXMgYXJyYXkgZWxlbWVudHMuXG4gKlxuICogQG1ldGhvZCBzcXVhcmVcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBlbGVtZW50cyB0byBiZSBzcXVhcmVkLlxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSBmb3Igc3F1YXJlZCBlbGVtZW50cy4gSWYgc3VwcGxpZWQsIG11c3QgbWF0Y2ggdGhlIGRpbWVuc2lvbnMgYW5kIGRhdGEgdHlwZSBvZiB0aGUgKiphKiogYXJyYXkuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUuc3F1YXJlID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGguc3F1YXJlKTtcbn07XG5cbi8qKlxuICogQ29tcHV0ZXMgdGhlIGRvdCBwcm9kdWN0IG9mIHR3byBOLWRpbWVuc2lvbmFsIGFycmF5cy5cbiAqXG4gKiBAbWV0aG9kIGRvdFxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGZpcnN0IGlucHV0IGFycmF5LlxuICogQHBhcmFtIHtOREFycmF5fSBiIC0gdGhlIHNlY29uZCBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgb3V0cHV0IGFycmF5LiBJZiBzdXBwbGllZCwgbXVzdCBtYXRjaCB0aGUgZGF0YSB0eXBlIG9mICoqYSoqIGFuZCAqKmIqKiBhcnJheXMgYW5kIGhhdmUgdGhlIGV4cGVjdGVkIHNoYXBlLiBDYW4gbm90IGJlIHRoZSBzYW1lIGFycmF5IGFzICoqYSoqIG9yICoqYioqLlxuICogQHJldHVybiB7TkRBcnJheX0gLSB0aGUgYXJyYXkgd2l0aCB0aGUgZG90IHByb2R1Y3Qgb2YgKiphKiogYW5kICoqYioqLlxuICovXG5KU0NvbnRleHQucHJvdG90eXBlLmRvdCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdHV0aWwuY2hlY2tOREFycmF5KGIsIFwiYlwiKTtcblx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XG5cblx0LyogVGhlIGF4aXMgb2YgYiB1c2VkIGluIHJlZHVjdGlvbjogYXhpcyAwIGZvciAxRCBhcnJheSwgc2Vjb25kLXRvLWxhc3QgYXhpcyBmb3IgTkQgYXJyYXkgKi9cblx0dmFyIGFBeGlzID0gTWF0aC5tYXgoYS5zaGFwZS5sZW5ndGggLSAxLCAwKTtcblx0dmFyIGJBeGlzID0gTWF0aC5tYXgoYi5zaGFwZS5sZW5ndGggLSAyLCAwKTtcblx0dmFyIHJlZHVjdGlvbkRpbSA9IGEuc2hhcGVbYUF4aXNdO1xuXHRpZiAocmVkdWN0aW9uRGltICE9PSBiLnNoYXBlW2JBeGlzXSkge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiQXJyYXlzIGhhdmUgaW5jb21wYXRpYmxlIHJlZHVjdGlvbiBkaW1lbnNpb25zXCIpO1xuXHR9XG5cdHZhciBzaGFwZU91dCA9IFtdLCBzdHJpZGVBID0gMSwgb3V0ZXJTdHJpZGVCID0gMSwgaW5uZXJTdHJpZGVCID0gMTtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhQXhpczsgaSsrKSB7XG5cdFx0c2hhcGVPdXQucHVzaChhLnNoYXBlW2ldKTtcblx0XHRzdHJpZGVBICo9IGEuc2hhcGVbaV07XG5cdH1cblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBiLnNoYXBlLmxlbmd0aDsgaSsrKSB7XG5cdFx0dmFyIGRpbSA9IGIuc2hhcGVbaV07XG5cdFx0aWYgKGkgPCBiQXhpcykge1xuXHRcdFx0b3V0ZXJTdHJpZGVCICo9IGRpbTtcblx0XHRcdHNoYXBlT3V0LnB1c2goZGltKTtcblx0XHR9IGVsc2UgaWYgKGkgPiBiQXhpcykge1xuXHRcdFx0aW5uZXJTdHJpZGVCICo9IGRpbTtcblx0XHRcdHNoYXBlT3V0LnB1c2goZGltKTtcblx0XHR9XG5cdH1cblx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRvdXQgPSB0aGlzLmVtcHR5KHNoYXBlT3V0LCBhLmRhdGFUeXBlKTtcblx0fSBlbHNlIGlmIChvdXQgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcblx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShvdXQuc2hhcGUsIHNoYXBlT3V0KTtcblx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShvdXQuZGF0YVR5cGUsIGEuZGF0YVR5cGUpO1xuXHRcdHV0aWwuY2hlY2tEaWZmZXJlbnROREFycmF5cyhhLCBvdXQsIFwiYVwiLCBcIm91dFwiKTtcblx0XHR1dGlsLmNoZWNrRGlmZmVyZW50TkRBcnJheXMoYiwgb3V0LCBcImJcIiwgXCJvdXRcIik7XG5cdFx0b3V0Ll9pbmNSZWYoKTtcblx0fVxuXHRqc21hdGguZG90KGEuX2RhdGEsIGIuX2RhdGEsIG91dC5fZGF0YSwgc3RyaWRlQSwgb3V0ZXJTdHJpZGVCLCBpbm5lclN0cmlkZUIsIHJlZHVjdGlvbkRpbSk7XG5cdGEuX3RyeVJlbGVhc2UoKTtcblx0Yi5fdHJ5UmVsZWFzZSgpO1xuXHRyZXR1cm4gb3V0O1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFyaXRobWV0aWMgc2VxdWVuY2UuXG4gKlxuICogQG1ldGhvZCBsaW5zcGFjZVxuICogQHBhcmFtIHtOdW1iZXJ9IHN0YXJ0IC0gdGhlIHN0YXJ0aW5nIGVuZHBvaW50IG9mIHRoZSBzZXF1ZW5jZS4gTXVzdCBiZSBhIGZpbml0ZSBudW1iZXIuXG4gKiBAcGFyYW0ge051bWJlcn0gc3RvcCAtIHRoZSBmaW5hbCBlbmRwb2ludCBvZiB0aGUgc2VxdWVuY2UuIE11c3QgYmUgYSBmaW5pdGUgbnVtYmVyLlxuICogQHBhcmFtIHtOdW1iZXJ9IFtzYW1wbGVzPTUwXSAtIHRoZSBudW1iZXIgb2Ygc2FtcGxlcyBpbiB0aGUgc2VxdWVuY3kuIE11c3QgYmUgYSBwb3NpdGl2ZSBpbnRlZ2VyLlxuICogQHBhcmFtIHtCb29sZWFufSBbY2xvc2VkPXRydWVdIC0gYW4gaW5kaWNhdG9yIG9mIHdoZXRoZXIgdGhlIGZpbmFsIGVuZHBvaW50IChgc3RvcGAgYXJndW1lbnQpIHNob3VsZCBiZSBpbmNsdWRlZCBpbiB0aGUgc2VxdWVuY2UuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUubGluc3BhY2UgPSBmdW5jdGlvbihzdGFydCwgc3RvcCwgc2FtcGxlcywgY2xvc2VkKSB7XG5cdGlmICghdXRpbC5pc1JlYWwoc3RhcnQpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzdGFydCArIFwiIGlzIG5vdCBhIHJlYWwgbnVtYmVyXCIpO1xuXHR9XG5cdGlmICghdXRpbC5pc1JlYWwoc3RvcCkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHN0b3AgKyBcIiBpcyBub3QgYSByZWFsIG51bWJlclwiKTtcblx0fVxuXHRpZiAodHlwZW9mIHNhbXBsZXMgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHQvKiBEZWZhdWx0IHZhbHVlIGluIE51bVB5ICovXG5cdFx0c2FtcGxlcyA9IDUwO1xuXHR9IGVsc2UgaWYgKCF1dGlsLmlzSW50KHNhbXBsZXMpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzYW1wbGVzICsgXCIgaXMgbm90IGFuIGludGVnZXJcIik7XG5cdH0gZWxzZSBpZiAoc2FtcGxlcyA8PSAwKSB7XG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJUaGUgbnVtYmVyIG9mIHNhbXBsZXMgbXVzdCBiZSBwb3NpdGl2ZVwiKTtcblx0fVxuXHRpZiAodHlwZW9mIGNsb3NlZCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGNsb3NlZCA9IHRydWU7XG5cdH1cblx0aWYgKGNsb3NlZCAmJiAoc2FtcGxlcyA9PT0gMSkpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBudW1iZXIgb2Ygc2FtcGxlcyBtdXN0IGJlIGEgbGVhc3QgMiAoZm9yIHN0YXJ0IGFuZCBlbmQgcG9pbnRzKVwiKTtcblx0fVxuXHR2YXIgYXJyYXkgPSB0aGlzLmVtcHR5KHNhbXBsZXMsIG5ldyBEYXRhVHlwZShcImY2NFwiKSk7XG5cdHZhciBkYXRhID0gYXJyYXkuX2RhdGE7XG5cdHZhciByYW5nZSA9IHN0b3AgLSBzdGFydDtcblx0dmFyIG4gPSAoY2xvc2VkKSA/IHNhbXBsZXMgLSAxIDogc2FtcGxlcztcblx0dmFyIHN0ZXAgPSByYW5nZSAvIG47XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgc2FtcGxlczsgaSsrKSB7XG5cdFx0ZGF0YVtpXSA9IHN0YXJ0ICsgc3RlcCAqIGk7XG5cdH1cblx0cmV0dXJuIGFycmF5O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBKU0NvbnRleHQ7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xudmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XG5cbmZ1bmN0aW9uIHNoYXBlVG9MZW5ndGgoc2hhcGUpIHtcblx0dmFyIGxlbmd0aCA9IDE7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgc2hhcGUubGVuZ3RoOyBpKyspIHtcblx0XHRsZW5ndGggKj0gc2hhcGVbaV07XG5cdH1cblx0cmV0dXJuIGxlbmd0aDtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVNdWx0aUluZGV4KGluZGV4LCBzaGFwZSkge1xuXHRpZiAoaW5kZXgubGVuZ3RoICE9IHNoYXBlLmxlbmd0aCkge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVGhlIG11bHRpLWluZGV4IFwiICsgaW5kZXggKyBcIiBkb2VzIG5vdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBcIiArIHNoYXBlICsgXCIgb2YgdGhlIGFycmF5XCIpO1xuXHR9XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgaW5kZXgubGVuZ3RoOyBpKyspIHtcblx0XHRpZiAoIXV0aWwuaXNJbnQoaW5kZXhbaV0pKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiVGhlIHN1Yi1pbmRleCBcIiArIGluZGV4W2ldICsgXCIgaXMgbm90IGFuIGludGVnZXJcIik7XG5cdFx0fVxuXHRcdGlmICgoaW5kZXhbaV0gPCAwKSB8fCAoaW5kZXhbaV0gPj0gc2hhcGVbaV0pKSB7XG5cdFx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBzdWItaW5kZXggXCIgKyBpbmRleFtpXSArIFwiIGlzIG91dCBvZiBib3VuZHNcIik7XG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogQW4gb3BhcXVlIE4tZGltZW5zaW9uYWwgYXJyYXkgb2JqZWN0LlxuICpcbiAqIEBjbGFzcyBOREFycmF5XG4gKi9cblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGFuIE5EQXJyYXkgb2JqZWN0IHdpdGhvdXQgZGF0YS5cbiAqIE5vcm1hbGx5IHRoaXMgY29uc3RydWN0b3IgaXMgY2FsbGVkIGZyb20gYXJyYXkgY29uc3RydWN0aW9uIG1ldGhvZHMgb2YgY29tcHV0YXRpb25hbCBjb250ZXh0cy5cbiAqIFRoZSBjYWxsaW5nIGZ1bmN0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciBpbml0aWFsaXppbmcgdGhlIGRhdGEgZm9yIHRoZSBhcnJheS5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCBjb250ZXh0KSB7XG5cdGlmICh0eXBlb2YgY29udGV4dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIkNvbnRleHQgbm90IGRlZmluZWRcIik7XG5cdH1cblx0aWYgKCF1dGlsLmlzUG9zaXRpdmVJbnRBcnJheShzaGFwZSkgJiYgIXV0aWwuaXNQb3NpdGl2ZUludChzaGFwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHNoYXBlICsgXCIgaXMgbm90IGEgdmFsaWQgYXJyYXkgc2hhcGVcIik7XG5cdH1cblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xuXHR9XG5cdHRoaXMuc2hhcGUgPSB1dGlsLmFzSW50QXJyYXkoc2hhcGUpO1xuXHR0aGlzLmRhdGFUeXBlID0gZGF0YVR5cGU7XG5cdHRoaXMuX2NvbnRleHQgPSBjb250ZXh0O1xuXHR0aGlzLmxlbmd0aCA9IHNoYXBlVG9MZW5ndGgodGhpcy5zaGFwZSk7XG5cdHRoaXMuX2xvY2tDb3VudCA9IDA7XG5cdHRoaXMuX3JlZkNvdW50ID0gMTtcblx0dGhpcy5faXNWYWxpZCA9IHRydWU7XG59XG5cbi8qKlxuICogTG9ja3MgdGhlIGFycmF5IHJlZmVyZW5jZSBjb3VudGVyLlxuICogV2hpbGUgdGhlIGFycmF5IGlzIGxvY2tlZCwgZnVuY3Rpb25zIGFuZCBtZXRob2RzIHRoYXQgb3BlcmF0ZSBvbiB0aGlzIGFycmF5IGRvIG5vdCBkZWNyZWFzZSBpdHMgcmVmZXJlbmNlIGNvdW50LlxuICogVGhlIGFycmF5IGNhbiBiZSBsb2NrZWQgbXVsdGlwbGUgdGltZXMsIGFuZCB3b3VsZCBuZWVkIGp1c3QgYXMgbWFueSB1bmxvY2sgY2FsbHMgdG8gbGlmdCB0aGUgbG9jay5cbiAqIElmIHRoZSBhcnJheSBpcyBub3QgdmFsaWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxuICpcbiAqIEBtZXRob2QgbG9ja1xuICogQGNoYWluYWJsZVxuICovXG5OREFycmF5LnByb3RvdHlwZS5sb2NrID0gZnVuY3Rpb24oKSB7XG5cdGlmICghdGhpcy5pc1ZhbGlkKCkpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdHRlbXB0ZWQgdG8gbG9jayBhbiBpbnZhbGlkYXRlZCBhcnJheVwiKTtcblx0fVxuXHR0aGlzLl9sb2NrQ291bnQrKztcblx0cmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFVubG9ja3MgdGhlIGFycmF5IHJlZmVyZW5jZSBjb3VudGVyLlxuICogT25jZSB0aGUgYXJyYXkgaXMgdW5sb2NrZWQsIGZ1bmN0aW9ucyBhbmQgbWV0aG9kcyB0aGF0IG9wZXJhdGUgb24gdGhpcyBhcnJheSBkZWNyZWFzZSBpdHMgcmVmZXJlbmNlIGNvdW50IGFuZCwgaWYgdGhlIHJlZmVyZW5jZSBjb3VudCByZWFjaGVzIHplcm8sIGludmFsaWRhdGUgdGhlIGFycmF5LlxuICogSWYgdGhlIGFycmF5IHdhcyBsb2NrZWQgbXVsdGlwbGUgdGltZXMsIGl0IHdvdWxkIG5lZWQganVzdCBhcyBtYW55IHVubG9jayBjYWxscyB0byBsaWZ0IHRoZSBsb2NrLlxuICogSWYgdGhlIGFycmF5IGlzIG5vdCBsb2NrZWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxuICpcbiAqIEBtZXRob2QgdW5sb2NrXG4gKiBAY2hhaW5hYmxlXG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLnVubG9jayA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoIXRoaXMuaXNMb2NrZWQoKSkge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIkF0dGVtcHRlZCB0byBsb2NrIGEgdW5sb2NrZWQgYXJyYXlcIik7XG5cdH1cblx0dGhpcy5fbG9ja0NvdW50LS07XG5cdHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBDaGVja2VzIGlmIHRoZSBhcnJheSBpcyBpbiB0aGUgbG9ja2VkIHN0YXRlLlxuICogSWYgdGhlIGFycmF5IGlzIG5vdCB2YWxpZCwgdGhpcyBtZXRob2QgcmV0dXJuIGZhbHNlLlxuICpcbiAqIEBtZXRob2QgaXNMb2NrZWRcbiAqXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaXMgdGhlIGFycmF5IGlzIGxvY2tlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlXG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLmlzTG9ja2VkID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLl9sb2NrQ291bnQgPiAwO1xufTtcblxuLyoqXG4gKiBJbmNyZW1lbnRzIHRoZSBhcnJheSByZWZlcmVuY2UgY291bnQuXG4gKiBJZiB0aGUgYXJyYXkgaXMgaW52YWxpZCBvciBsb2NrZWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxuICpcbiAqIEBtZXRob2QgcmV0YWluXG4gKiBAY2hhaW5hYmxlXG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLnJldGFpbiA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoIXRoaXMuaXNWYWxpZCgpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXR0ZW1wdGVkIHRvIHJlbGVhc2UgYW4gaW52YWxpZGF0ZWQgYXJyYXlcIik7XG5cdH1cblx0aWYgKHRoaXMuaXNMb2NrZWQoKSkge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIkF0dGVtcHRlZCB0byByZXRhaW4gYSBsb2NrZWQgYXJyYXlcIik7XG5cdH1cblx0dGhpcy5fcmVmQ291bnQrKztcblx0cmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIERlY3JlbWVudHMgdGhlIGFycmF5IHJlZmVyZW5jZSBjb3VudC4gSWYgdGhlIHJlZmVyZW5jZSBjb3VudCB0dXJucyB6ZXJvLCB0aGUgYXJyYXkgYmVjb21lcyBpbnZhbGlkIGFuZCBpdHMgZGF0YSBidWZmZXIgaXMgZGVhbGxvY2F0ZWQuXG4gKiBJZiB0aGUgYXJyYXkgaXMgaW52YWxpZCBvciBsb2NrZWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxuICpcbiAqIEBtZXRob2QgcmVsZWFzZVxuICogQGNoYWluYWJsZVxuICovXG5OREFycmF5LnByb3RvdHlwZS5yZWxlYXNlID0gZnVuY3Rpb24oKSB7XG5cdGlmICghdGhpcy5pc1ZhbGlkKCkpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdHRlbXB0ZWQgdG8gcmVsZWFzZSBhbiBpbnZhbGlkYXRlZCBhcnJheVwiKTtcblx0fVxuXHRpZiAodGhpcy5pc0xvY2tlZCgpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXR0ZW1wdGVkIHRvIHJlbGVhc2UgYSBsb2NrZWQgYXJyYXlcIik7XG5cdH1cblx0aWYgKC0tdGhpcy5fcmVmQ291bnQgPT09IDApIHtcblx0XHR0aGlzLl9jb250ZXh0Ll9pbnZhbGlkYXRlKHRoaXMpO1xuXHR9XG5cdHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBGb3IgYSBub24tbG9ja2VkIGFycmF5LCBkZWNyZW1lbnRzIHRoZSBhcnJheSByZWZlcmVuY2UgY291bnQuIElmIHRoZSByZWZlcmVuY2UgY291bnQgdHVybnMgemVybywgdGhlIGFycmF5IGJlY29tZXMgaW52YWxpZCBhbmQgaXRzIGRhdGEgYnVmZmVyIGlzIGRlYWxsb2NhdGVkLlxuICogSWYgdGhlIGFycmF5IGlzIGludmFsaWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxuICpcbiAqIEBtZXRob2QgdHJ5UmVsZWFzZVxuICogQGNoYWluYWJsZVxuICovXG5OREFycmF5LnByb3RvdHlwZS50cnlSZWxlYXNlID0gZnVuY3Rpb24oKSB7XG5cdGlmICghdGhpcy5pc1ZhbGlkKCkpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdHRlbXB0ZWQgdG8gcmVsZWFzZSBhbiBpbnZhbGlkYXRlZCBhcnJheVwiKTtcblx0fVxuXHRpZiAoIXRoaXMuaXNMb2NrZWQoKSkge1xuXHRcdGlmICgtLXRoaXMuX3JlZkNvdW50ID09PSAwKSB7XG5cdFx0XHR0aGlzLl9jb250ZXh0Ll9pbnZhbGlkYXRlKHRoaXMpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogRm9yIGEgbm9uLWxvY2tlZCBhcnJheSwgZGVjcmVtZW50cyB0aGUgYXJyYXkgcmVmZXJlbmNlIGNvdW50LiBJZiB0aGUgcmVmZXJlbmNlIGNvdW50IHR1cm5zIHplcm8sIHRoZSBhcnJheSBiZWNvbWVzIGludmFsaWQgYW5kIGl0cyBkYXRhIGJ1ZmZlciBpcyBkZWFsbG9jYXRlZC5cbiAqIFRoZSBhcnJheSBtdXN0IGJlIHZhbGlkIHRvIHBlcmZvcm0gdGhpcyBvcGVyYXRpb24uXG4gKlxuICogQHByaXZhdGVcbiAqIEBtZXRob2QgX3RyeVJlbGVhc2VcbiAqIEBjaGFpbmFibGVcbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuX3RyeVJlbGVhc2UgPSBmdW5jdGlvbigpIHtcblx0aWYgKCF0aGlzLmlzTG9ja2VkKCkpIHtcblx0XHRpZiAoLS10aGlzLl9yZWZDb3VudCA9PT0gMCkge1xuXHRcdFx0dGhpcy5fY29udGV4dC5faW52YWxpZGF0ZSh0aGlzKTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEludmFsaWRhdGVzIHRoZSBhcnJheSBhbmQgZGVhbGxvY2F0ZXMgaXRzIGRhdGEgYnVmZmVyLCByZWdhcmRsZXNzIG9mIGxvY2tzIGFuZCByZWZlcmVuY2UgY291bnQuXG4gKiBDYWxsaW5nIHRoaXMgbWV0aG9kIG9uIGFuIGludmFsaWRhdGVkIGFycmF5IGhhcyBubyBlZmZlY3QuXG4gKlxuICogQG1ldGhvZCBpbnZhbGlkYXRlXG4gKiBAY2hhaW5hYmxlXG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLmludmFsaWRhdGUgPSBmdW5jdGlvbigpIHtcblx0aWYgKHRoaXMuaXNWYWxpZCgpKSB7XG5cdFx0dGhpcy5fY29udGV4dC5faW52YWxpZGF0ZSh0aGlzKTtcblx0XHR0aGlzLl9pc1ZhbGlkID0gZmFsc2U7XG5cdFx0dGhpcy5fcmVmQ291bnQgPSAwO1xuXHRcdHRoaXMuX2xvY2tDb3VudCA9IDA7XG5cdH1cblx0cmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIENoZWNrZXMgaWYgdGhlIGFycmF5IGlzIGluIGEgdmFsaWQgc3RhdGUuXG4gKiBJZiB0aGUgYXJyYXkgaXMgbm90IGluIGEgdmFsaWQgc3RhdGUsIGl0cyBkYXRhIGJ1ZmZlciB3YXMgZGVhbGxvY2F0ZWQsIGFuZCBhbnkgb3BlcmF0aW9ucyBvbiB0aGUgYXJyYXkgd2lsbCB0aHJvdyBhbiBlcnJvci5cbiAqXG4gKiBAbWV0aG9kIGlzVmFsaWRcbiAqXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaXMgdGhlIGFycmF5IGlzIHZhbGlkIGFuZCBmYWxzZSBvdGhlcndpc2VcbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuaXNWYWxpZCA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdGhpcy5faXNWYWxpZDtcbn07XG5cbi8qKlxuICogRGVjcmVtZW50cyB0aGUgYXJyYXkgcmVmZXJlbmNlIGNvdW50IGlmIHRoZSBhcnJheSBpcyBub3QgbG9ja2VkLlxuICogVGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBpbnZhbGlkYXRlIHRoZSBhcnJheSB3aGVuIHRoZSByZWZlcmVuY2UgY291bnQgcmVhY2ggemVyby5cbiAqIFRoZSBjYWxsZXIgaXMgcmVzcG9uc2libGUgZm9yIGludmFsaWRhdGluZyBhcnJheSBpZiBpdHMgcmVmZXJlbmNlIGNvdW50IGlzIHplcm8gYWZ0ZXIgdGhlIG9wZXJhdGlvbi5cbiAqXG4gKiBGb3IgYSBsb2NrZWQgYXJyYXkgdGhlIG1ldGhvZCBoYXMgbm8gZWZmZWN0IGFuZCBhbHdheXMgcmV0dXJucyB0cnVlLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAbWV0aG9kIF9kZWNSZWZcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXkgLSB0aGUgYXJyYXkgdG8gZGVjcmVtZW50IHRoZSByZWZlcmVuY2UgY291bnQgZm9yLiBNdXN0IGJlIHZhbGlkIGJlZm9yZSB0aGUgY2FsbC5cbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gdHJ1ZSBpZiB0aGUgcmVmZXJlbmNlIGNvdW50IGlzIG5vbi16ZXJvIGFmdGVyIHRoZSBvcGVyYXRpb24gYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuX2RlY1JlZiA9IGZ1bmN0aW9uKGFycmF5KSB7XG5cdGlmICh0aGlzLl9sb2NrQ291bnQgPT09IDApIHtcblx0XHQtLXRoaXMuX3JlZkNvdW50O1xuXHR9XG5cdHJldHVybiB0aGlzLl9yZWZDb3VudCAhPT0gMDtcbn07XG5cbi8qKlxuICogSW5jcmVtZW50cyB0aGUgYXJyYXkgcmVmZXJlbmNlIGNvdW50IGlmIHRoZSBhcnJheSBpcyBub3QgbG9ja2VkLlxuICogRm9yIGEgbG9ja2VkIGFycmF5IHRoZSBtZXRob2QgaGFzIG5vIGVmZmVjdC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBfaW5jUmVmXG4gKiBAY2hhaW5hYmxlXG4gKiBAcGFyYW0ge05EQXJyYXl9IGFycmF5IC0gdGhlIGFycmF5IHRvIGluY3JlbWVudCB0aGUgcmVmZXJlbmNlIGNvdW50IGZvci4gTXVzdCBiZSB2YWxpZCBiZWZvcmUgdGhlIGNhbGwsIGJ1dCBtYXkgaGF2ZSB6ZXJvIHJlZmVyZW5jZSBjb3VudC5cbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuX2luY1JlZiA9IGZ1bmN0aW9uKGFycmF5KSB7XG5cdGlmICh0aGlzLl9sb2NrQ291bnQgPT09IDApIHtcblx0XHQrK3RoaXMuX3JlZkNvdW50O1xuXHR9XG5cdHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIGFycmF5IGlzIGxvY2tlZCBvciBoYXMgYW55IHJlZmVyZW5jZXMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBtZXRob2QgX2hhc1JlZnNcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXkgLSB0aGUgYXJyYXkgdG8gY2hlY2suIE11c3QgYmUgdmFsaWQgYmVmb3JlIHRoZSBjYWxsLCBidXQgbWF5IGhhdmUgemVybyByZWZlcmVuY2UgY291bnQuXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaWYgdGhlIGFycmF5IGlzIGxvY2tlZCBvciBoYXMgcmVmZXJlbmNlcyBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICovXG5OREFycmF5LnByb3RvdHlwZS5faGFzUmVmcyA9IGZ1bmN0aW9uKGFycmF5KSB7XG5cdHJldHVybiAodGhpcy5fbG9ja0NvdW50ICE9PSAwKSB8fCAodGhpcy5fcmVmQ291bnQgIT09IDApO1xufTtcblxuLyoqXG4gKiBJbnZhbGlkYXRlcyB0aGUgYXJyYXkgaWYgaXQgdmFsaWQsIG5vdCBsb2NrZWQsIGFuZCBoYXMgemVybyByZWZlcmVuY2UgY291bnQuXG4gKiBIYXMgbm8gZWZmZWN0IGluIGFsbCBvdGhlciBjYXNlcy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBfdHJ5SW52YWxpZGF0ZVxuICogQHBhcmFtIHtOREFycmF5fSBhcnJheSAtIHRoZSBhcnJheSB0byB0cnkgdG8gaW52YWxpZGF0ZS4gQ2FuIGJlIGludmFsaWQuXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaWYgdGhlIGFycmF5IHdhcyBpbnZhbGlkYXRlZCBieSB0aGlzIGNhbGwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuX3RyeUludmFsaWRhdGUgPSBmdW5jdGlvbihhcnJheSkge1xuXHRpZiAodGhpcy5pc1ZhbGlkKCkgJiYgIXRoaXMuX2hhc1JlZnMoKSkge1xuXHRcdHRoaXMuX2NvbnRleHQuX2ludmFsaWRhdGUodGhpcyk7XG5cdFx0dGhpcy5faXNWYWxpZCA9IGZhbHNlO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufTtcblxuLyoqXG4gKiBBZGRzIGFub3RoZXIgYXJyYXkgb3IgYSBudW1iZXIgdG8gdGhpcyBhcnJheS5cbiAqXG4gKiBAbWV0aG9kIGFkZFxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBvdGhlciAtIHRoZSBhcnJheSBvciBzY2FsYXIgdG8gYmUgYWRkZWQuXG4gKiBAcmV0dXJuIHtOREFycmF5fVxuICovXG5OREFycmF5LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihvdGhlcikge1xuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5hZGQodGhpcywgb3RoZXIpO1xufTtcblxuLyoqXG4gKiBTdWJ0cmFjdHMgYW5vdGhlciBhcnJheSBvciBhIG51bWJlciBmcm9tIHRoaXMgYXJyYXkuXG4gKlxuICogQG1ldGhvZCBzdWJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gb3RoZXIgLSB0aGUgYXJyYXkgb3Igc2NhbGFyIHRvIGJlIHN1YnRyYWN0ZWQuXG4gKiBAcmV0dXJuIHtOREFycmF5fVxuICovXG5OREFycmF5LnByb3RvdHlwZS5zdWIgPSBmdW5jdGlvbihvdGhlcikge1xuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5zdWIodGhpcywgb3RoZXIpO1xufTtcblxuLyoqXG4gKiBNdWx0aXBsaWVzIGFycmF5IGVsZW1lbnRzIGJ5IGFub3RoZXIgYXJyYXkgb3IgYnkgYSBudW1iZXIuXG4gKlxuICogQG1ldGhvZCBtdWxcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gb3RoZXIgLSB0aGUgYXJyYXkgb3Igc2NhbGFyIHRvIG11bHRpcGx5IGVsZW1lbnRzIGJ5LlxuICogQHJldHVybiB7TkRBcnJheX1cbiAqL1xuTkRBcnJheS5wcm90b3R5cGUubXVsID0gZnVuY3Rpb24ob3RoZXIpIHtcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQubXVsKHRoaXMsIG90aGVyKTtcbn07XG5cbi8qKlxuICogRGl2aWRlcyBhcnJheSBlbGVtZW50cyBieSBhbm90aGVyIGFycmF5IG9yIGJ5IGEgbnVtYmVyLlxuICpcbiAqIEBtZXRob2QgZGl2XG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IG90aGVyIC0gdGhlIGFycmF5IG9yIHNjYWxhciB0byBkaXZpZGUgZWxlbWVudHMgYnkuXG4gKiBAcmV0dXJuIHtOREFycmF5fVxuICovXG5OREFycmF5LnByb3RvdHlwZS5kaXYgPSBmdW5jdGlvbihvdGhlcikge1xuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5kaXYodGhpcywgb3RoZXIpO1xufTtcblxuLyoqXG4gKiBSZWR1Y2VzIGFycmF5IGVsZW1lbnRzIHVzaW5nIG1pbmltdW0gb3BlcmF0aW9uLlxuICogSWYgdGhlIGF4aXMgYXJndW1lbnQgaXMgcHJvdmlkZWQsIHRoZSBtZXRob2QgY29tcHV0ZXMgbWluaW11bSBvZiBlbGVtZW50cyBhbG9uZyB0aGUgc3BlY2lmaWVkIGF4aXMuXG4gKiBPdGhlcndpc2UsIHRoZSBtZXRob2QgY29tcHV0ZXMgYW4gYWxsLWFycmF5IG1pbmltdW0gb2YgdGhlIGVsZW1lbnRzIGFuZCByZXR1cm5zIHRoZW0gYXMgYSAxLWVsZW1lbnQgYXJyYXkuXG4gKlxuICogQG1ldGhvZCBtaW5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbYXhpc10gLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgbWluaW11bSBpcyBjb21wdXRlZC5cbiAqIEByZXR1cm4ge05EQXJyYXl9XG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLm1pbiA9IGZ1bmN0aW9uKGF4aXMpIHtcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQubWluKHRoaXMsIGF4aXMpO1xufTtcblxuLyoqXG4gKiBSZWR1Y2VzIGFycmF5IGVsZW1lbnRzIHVzaW5nIG1heGltdW0gb3BlcmF0aW9uLlxuICogSWYgdGhlIGF4aXMgYXJndW1lbnQgaXMgcHJvdmlkZWQsIHRoZSBtZXRob2QgY29tcHV0ZXMgbWF4aW11bSBvZiBlbGVtZW50cyBhbG9uZyB0aGUgc3BlY2lmaWVkIGF4aXMuXG4gKiBPdGhlcndpc2UsIHRoZSBtZXRob2QgY29tcHV0ZXMgYW4gYWxsLWFycmF5IG1heGltdW0gb2YgdGhlIGVsZW1lbnRzIGFuZCByZXR1cm5zIHRoZW0gYXMgYSAxLWVsZW1lbnQgYXJyYXkuXG4gKlxuICogQG1ldGhvZCBtaW5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbYXhpc10gLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgbWF4aW11bSBpcyBjb21wdXRlZC5cbiAqIEByZXR1cm4ge05EQXJyYXl9XG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLm1heCA9IGZ1bmN0aW9uKGF4aXMpIHtcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQubWF4KHRoaXMsIGF4aXMpO1xufTtcblxuLyoqXG4gKiBSZWR1Y2VzIGFycmF5IGVsZW1lbnRzIHVzaW5nIHN1bSBvcGVyYXRpb24uXG4gKiBJZiB0aGUgYXhpcyBhcmd1bWVudCBpcyBwcm92aWRlZCwgdGhlIG1ldGhvZCBjb21wdXRlcyBzdW0gb2YgZWxlbWVudHMgYWxvbmcgdGhlIHNwZWNpZmllZCBheGlzLlxuICogT3RoZXJ3aXNlLCB0aGUgbWV0aG9kIGNvbXB1dGVzIGFuIGFsbC1hcnJheSBzdW0gb2YgdGhlIGVsZW1lbnRzIGFuZCByZXR1cm5zIHRoZW0gYXMgYSAxLWVsZW1lbnQgYXJyYXkuXG4gKlxuICogQG1ldGhvZCBtaW5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbYXhpc10gLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgc3VtIGlzIGNvbXB1dGVkLlxuICogQHJldHVybiB7TkRBcnJheX1cbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuc3VtID0gZnVuY3Rpb24oYXhpcykge1xuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5zdW0odGhpcywgYXhpcyk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYW5vdGhlciBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEsIGJ1dCBkaWZmZXJlbnQgZGltZW5zaW9ucy5cbiAqXG4gKiBAbWV0aG9kIHJlc2hhcGVcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gb3RoZXIgLSBkaW1lbnNpb25zIG9mIHRoZSBuZXcgYXJyYXkuXG4gKiBAcmV0dXJuIHtOREFycmF5fVxuICovXG5OREFycmF5LnByb3RvdHlwZS5yZXNoYXBlID0gZnVuY3Rpb24obmV3U2hhcGUpIHtcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQucmVzaGFwZSh0aGlzLCBuZXdTaGFwZSk7XG59O1xuXG4vKipcbiAqIER1cGxpY2F0ZXMgYXJyYXkgZWxlbWVudHMgYWxvbmcgdGhlIHNwZWNpZmllZCBheGlzLlxuICpcbiAqIEBtZXRob2QgcmVwZWF0XG4gKiBAcGFyYW0ge051bWJlcn0gcmVwZWF0cyAtIHRoZSBudW1iZXIgb2YgdGltZXMgdG8gcmVwZWF0IGVhY2ggZWxlbWVudC5cbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgYWxvbmcgd2hpY2ggdGhlIGVsZW1lbnRzIHdpbGwgYmUgZHVwbGljYXRlZC5cbiAqIEByZXR1cm4ge05EQXJyYXl9XG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLnJlcGVhdCA9IGZ1bmN0aW9uKHJlcGVhdHMsIGF4aXMpIHtcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQucmVwZWF0KHRoaXMsIHJlcGVhdHMsIGF4aXMpO1xufTtcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgZGF0YSB0byBhIEphdmFTY3JpcHQgQXJyYXkuXG4gKlxuICogQG1ldGhvZCBnZXRcbiAqIEBhc3luY1xuICovXG5OREFycmF5LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHR0aGlzLl9jb250ZXh0LmdldCh0aGlzLCBjYWxsYmFjayk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE5EQXJyYXk7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIE5EQXJyYXkgPSByZXF1aXJlKFwiLi9OREFycmF5XCIpO1xudmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XG52YXIgYWxsb2NhdG9yID0gcmVxdWlyZShcIi4vYWxsb2NhdG9yXCIpO1xudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xuXG52YXIgc2NyaXB0RGlyZWN0b3J5ID0gXCJcIjtcbnRyeSB7XG5cdHZhciBzY3JpcHRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJzY3JpcHRcIik7XG5cdGZvciAodmFyIGkgPSBzY3JpcHRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG5cdFx0dmFyIHBhdGggPSBzY3JpcHRzW2ldLnNyYztcblx0XHQvKiBSZW1vdmUgdXJsLWVuY29kZWQgcGFyYW1ldGVycyAqL1xuXHRcdHBhdGggPSBwYXRoLnNwbGl0KFwiP1wiKVswXTtcblx0XHR2YXIgc2VwYXJhdG9yUG9zID0gcGF0aC5sYXN0SW5kZXhPZihcIi9cIik7XG5cdFx0dmFyIHNjcmlwdE5hbWUgPSBwYXRoLnN1YnN0cmluZyhzZXBhcmF0b3JQb3MgKyAxKTtcblx0XHRpZiAoKHNjcmlwdE5hbWUgPT09IFwiZnVyaW91cy5qc1wiKSB8fCAoc2NyaXB0TmFtZSA9PT0gXCJmdXJpb3VzLm1pbi5qc1wiKSl7XG5cdFx0XHRzY3JpcHREaXJlY3RvcnkgPSBwYXRoLnN1YnN0cmluZygwLCBzZXBhcmF0b3JQb3MgKyAxKTtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxufSBjYXRjaCAoZSkge1xufVxuXG52YXIgbWVzc2FnZUNhbGxiYWNrcyA9IHt9O1xuXG52YXIgb25QTmFDbE1lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG5cdHZhciByZXN1bHQgPSBtZXNzYWdlLmRhdGE7XG5cdHZhciBpZCA9IHJlc3VsdC5pZDtcblx0aWYgKHJlc3VsdC5zdGF0dXMgPT0gXCJlcnJvclwiKSB7XG5cdFx0Y29uc29sZS5sb2coXCJFcnJvcjogXCIgKyByZXN1bHQuZGVzY3JpcHRpb24pO1xuXHR9XG5cdGlmIChpZCBpbiBtZXNzYWdlQ2FsbGJhY2tzKSB7XG5cdFx0aWYgKFwiYnVmZmVyXCIgaW4gcmVzdWx0KSB7XG5cdFx0XHRtZXNzYWdlQ2FsbGJhY2tzW2lkXShyZXN1bHQuYnVmZmVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGVsZXRlIHJlc3VsdC5zdGF0dXM7XG5cdFx0XHRkZWxldGUgcmVzdWx0LmlkO1xuXHRcdFx0bWVzc2FnZUNhbGxiYWNrc1tpZF0ocmVzdWx0KTtcblx0XHR9XG5cdFx0ZGVsZXRlIG1lc3NhZ2VDYWxsYmFja3NbaWRdO1xuXHR9XG59O1xuXG5mdW5jdGlvbiBQTmFDbENvbnRleHQob3B0aW9ucywgY2FsbGJhY2spIHtcblx0dmFyIGNvbnRleHQgPSB0aGlzO1xuXHR0aGlzLl9wbmFjbE9iamVjdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJvYmplY3RcIik7XG5cdHRoaXMuX3BuYWNsT2JqZWN0LndpZHRoID0gMDtcblx0dGhpcy5fcG5hY2xPYmplY3QuaGVpZ2h0ID0gMDtcblx0dGhpcy5fcG5hY2xPYmplY3QuZGF0YSA9IFBOYUNsQ29udGV4dC5nZXREZWZhdWx0TWFuaWZlc3RVUkwoKTtcblx0dGhpcy5fcG5hY2xPYmplY3QudHlwZSA9IFwiYXBwbGljYXRpb24veC1wbmFjbFwiO1xuXHR0aGlzLl9wbmFjbE9iamVjdC5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIG1lc3NhZ2VJZCA9IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKTtcblx0XHRtZXNzYWdlQ2FsbGJhY2tzW21lc3NhZ2VJZF0gPSBmdW5jdGlvbigpIHtcblx0XHRcdGNhbGxiYWNrKGNvbnRleHQpO1xuXHRcdH07XG5cdFx0Y29udGV4dC5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0XCJpZFwiOiBtZXNzYWdlSWQsXG5cdFx0XHRcImNvbW1hbmRcIjogXCJpbml0XCJcblx0XHR9KTtcblx0fSwgdHJ1ZSk7XG5cdHRoaXMuX3BuYWNsT2JqZWN0LmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIG9uUE5hQ2xNZXNzYWdlLCB0cnVlKTtcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLl9wbmFjbE9iamVjdCk7XG59XG5cblBOYUNsQ29udGV4dC5pc1N1cHBvcnRlZCA9IGZ1bmN0aW9uKCkge1xuXHR0cnkge1xuXHRcdHJldHVybiAodHlwZW9mIG5hdmlnYXRvci5taW1lVHlwZXNbXCJhcHBsaWNhdGlvbi94LXBuYWNsXCJdKSAhPT0gXCJ1bmRlZmluZWRcIjtcblx0fSBjYXRjaCAoZSkge1xuXHR9XG5cdHJldHVybiBmYWxzZTtcbn07XG5cblBOYUNsQ29udGV4dC5nZXREZWZhdWx0TWFuaWZlc3RVUkwgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHNjcmlwdERpcmVjdG9yeSArIFwiZnVyaW91cy5ubWZcIjtcbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUuZW1wdHkgPSBmdW5jdGlvbihzaGFwZSwgZGF0YVR5cGUpIHtcblx0c2hhcGUgPSB1dGlsLmNoZWNrU2hhcGUoc2hhcGUpO1xuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XG5cdH0gZWxzZSBpZiAoIShkYXRhVHlwZSBpbnN0YW5jZW9mIERhdGFUeXBlKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoZGF0YVR5cGUgKyBcIiBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgRGF0YVR5cGVcIik7XG5cdH1cblx0dmFyIGFycmF5ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCB0aGlzKTtcblx0YXJyYXkuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcblx0dGhpcy5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFwiY29tbWFuZFwiOiBcImVtcHR5XCIsXG5cdFx0XCJzaGFwZVwiOiBuZXcgVWludDMyQXJyYXkoc2hhcGUpLmJ1ZmZlcixcblx0XHRcImRhdGF0eXBlXCI6IGRhdGFUeXBlLnR5cGUsXG5cdFx0XCJvdXRcIjogYXJyYXkuX2lkXG5cdH0pO1xuXHRyZXR1cm4gYXJyYXk7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLnplcm9zID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xuXHR9XG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XG5cdGFycmF5Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XG5cdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcblx0XHRcImNvbW1hbmRcIjogXCJ6ZXJvc1wiLFxuXHRcdFwic2hhcGVcIjogbmV3IFVpbnQzMkFycmF5KHNoYXBlKS5idWZmZXIsXG5cdFx0XCJkYXRhdHlwZVwiOiBkYXRhVHlwZS50eXBlLFxuXHRcdFwib3V0XCI6IGFycmF5Ll9pZFxuXHR9KTtcblx0cmV0dXJuIGFycmF5O1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5vbmVzID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xuXHR9XG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XG5cdGFycmF5Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XG5cdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcblx0XHRcImNvbW1hbmRcIjogXCJvbmVzXCIsXG5cdFx0XCJzaGFwZVwiOiBuZXcgVWludDMyQXJyYXkoc2hhcGUpLmJ1ZmZlcixcblx0XHRcImRhdGF0eXBlXCI6IGRhdGFUeXBlLnR5cGUsXG5cdFx0XCJvdXRcIjogYXJyYXkuX2lkXG5cdH0pO1xuXHRyZXR1cm4gYXJyYXk7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmFycmF5ID0gZnVuY3Rpb24oZGF0YSwgZGF0YVR5cGUpIHtcblx0dmFyIHNoYXBlID0gW107XG5cdHV0aWwuZGlzY292ZXJBcnJheVNoYXBlUmVjdXJzaXZlKGRhdGEsIHNoYXBlLCAwKTtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xuXHR9XG5cdHZhciBuZGFycmF5ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCB0aGlzKTtcblx0bmRhcnJheS5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xuXHR2YXIgYnVmZmVyID0gbmV3IGRhdGFUeXBlLmFycmF5VHlwZShuZGFycmF5Lmxlbmd0aCk7XG5cdHV0aWwuY29weUFycmF5RGF0YVJlY3Vyc2l2ZShidWZmZXIsIGRhdGEsIHNoYXBlLCAwLCAwKTtcblx0dGhpcy5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFwiY29tbWFuZFwiOiBcImFycmF5XCIsXG5cdFx0XCJzaGFwZVwiOiBuZXcgVWludDMyQXJyYXkoc2hhcGUpLmJ1ZmZlcixcblx0XHRcImRhdGF0eXBlXCI6IGRhdGFUeXBlLnR5cGUsXG5cdFx0XCJidWZmZXJcIjogYnVmZmVyLmJ1ZmZlcixcblx0XHRcIm91dFwiOiBuZGFycmF5Ll9pZFxuXHR9KTtcblx0cmV0dXJuIG5kYXJyYXk7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmxpbnNwYWNlID0gZnVuY3Rpb24oc3RhcnQsIHN0b3AsIHNhbXBsZXMsIGluY2x1ZGVTdG9wKSB7XG5cdGlmICghdXRpbC5pc1JlYWwoc3RhcnQpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzdGFydCArIFwiIGlzIG5vdCBhIHJlYWwgbnVtYmVyXCIpO1xuXHR9XG5cdGlmICghdXRpbC5pc1JlYWwoc3RvcCkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHN0b3AgKyBcIiBpcyBub3QgYSByZWFsIG51bWJlclwiKTtcblx0fVxuXHRpZiAodHlwZW9mIHNhbXBsZXMgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHQvKiBEZWZhdWx0IHZhbHVlIGluIE51bVB5ICovXG5cdFx0c2FtcGxlcyA9IDUwO1xuXHR9IGVsc2UgaWYgKCF1dGlsLmlzSW50KHNhbXBsZXMpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzYW1wbGVzICsgXCIgaXMgbm90IGFuIGludGVnZXJcIik7XG5cdH0gZWxzZSBpZiAoc2FtcGxlcyA8PSAwKSB7XG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJUaGUgbnVtYmVyIG9mIHNhbXBsZXMgbXVzdCBiZSBwb3NpdGl2ZVwiKTtcblx0fVxuXHRpZiAodHlwZW9mIGluY2x1ZGVTdG9wID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0aW5jbHVkZVN0b3AgPSB0cnVlO1xuXHR9XG5cdGlmIChpbmNsdWRlU3RvcCAmJiAoc2FtcGxlcyA9PT0gMSkpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBudW1iZXIgb2Ygc2FtcGxlcyBtdXN0IGJlIGEgbGVhc3QgMiAoZm9yIHN0YXJ0IGFuZCBlbmQgcG9pbnRzKVwiKTtcblx0fVxuXHR2YXIgZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KFtzYW1wbGVzXSwgZGF0YVR5cGUsIHRoaXMpO1xuXHRhcnJheS5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xuXHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XCJjb21tYW5kXCI6IFwibGluc3BhY2VcIixcblx0XHRcInN0YXJ0XCI6ICtzdGFydCxcblx0XHRcInN0b3BcIjogK3N0b3AsXG5cdFx0XCJzYW1wbGVzXCI6IHNhbXBsZXN8MCxcblx0XHRcImNsb3NlZFwiOiAhIWluY2x1ZGVTdG9wLFxuXHRcdFwiZGF0YXR5cGVcIjogZGF0YVR5cGUudHlwZSxcblx0XHRcIm91dFwiOiBhcnJheS5faWRcblx0fSk7XG5cdHJldHVybiBhcnJheTtcbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUucmVzaGFwZSA9IGZ1bmN0aW9uKGEsIHNoYXBlKSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcblx0c2hhcGUgPSB1dGlsLmNoZWNrU2hhcGUoc2hhcGUpO1xuXHRpZiAodXRpbC5jb21wdXRlTGVuZ3RoKHNoYXBlKSAhPT0gYS5sZW5ndGgpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBzaGFwZSBpcyBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSBhcnJheVwiKTtcblx0fVxuXHR2YXIgcmVsZWFzZUFycmF5ID0gIWEuX2RlY1JlZigpO1xuXHR2YXIgb3V0ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGEuZGF0YVR5cGUsIHRoaXMpO1xuXHRpZiAocmVsZWFzZUFycmF5KSB7XG5cdFx0b3V0Ll9pZCA9IGEuX2lkO1xuXHRcdHJlbGVhc2VBcnJheSA9IGZhbHNlO1xuXHR9IGVsc2Uge1xuXHRcdG91dC5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xuXHR9XG5cdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcblx0XHRcImNvbW1hbmRcIjogXCJyZXNoYXBlXCIsXG5cdFx0XCJhXCI6IChyZWxlYXNlQXJyYXkgPyAtYS5faWQgOiBhLl9pZCksXG5cdFx0XCJvdXRcIjogb3V0Ll9pZCxcblx0XHRcInNoYXBlXCI6IG5ldyBVaW50MzJBcnJheShzaGFwZSkuYnVmZmVyXG5cdH0pO1xuXHRyZXR1cm4gb3V0O1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5yZXBlYXQgPSBmdW5jdGlvbihhLCByZXBlYXRzLCBheGlzLCBvdXQpIHtcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xuXHRyZXBlYXRzID0gdXRpbC5jaGVja1JlcGVhdHMocmVwZWF0cyk7XG5cdGF4aXMgPSB1dGlsLmNoZWNrQXhpcyhheGlzLCBhLnNoYXBlLmxlbmd0aCk7XG5cdHZhciBzaGFwZUEgPSBhLnNoYXBlO1xuXHR2YXIgc2hhcGVPdXQgPSBzaGFwZUEuc2xpY2UoMCk7XG5cdHNoYXBlT3V0W2F4aXNdICo9IHJlcGVhdHM7XG5cdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0b3V0ID0gbmV3IE5EQXJyYXkoc2hhcGVPdXQsIGEuZGF0YVR5cGUsIHRoaXMpO1xuXHRcdG91dC5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xuXHR9IGVsc2Uge1xuXHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkob3V0LnNoYXBlLCBzaGFwZU91dCk7XG5cdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcblx0XHRvdXQuX2luY1JlZigpO1xuXHR9XG5cdHZhciByZWxlYXNlQSA9ICFhLl9kZWNSZWYoKTtcblx0dGhpcy5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFwiY29tbWFuZFwiOiBcInJlcGVhdFwiLFxuXHRcdFwiYVwiOiAocmVsZWFzZUEgPyAtYS5faWQgOiBhLl9pZCksXG5cdFx0XCJvdXRcIjogb3V0Ll9pZCxcblx0XHRcInJlcGVhdHNcIjogcmVwZWF0cyxcblx0XHRcImF4aXNcIjogYXhpc1xuXHR9KTtcblx0cmV0dXJuIG91dDtcbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUuX2ludmFsaWRhdGUgPSBmdW5jdGlvbihhcnJheSkge1xuXHRpZiAoYXJyYXkuX2lkICE9PSAwKSB7XG5cdFx0dGhpcy5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XHRcImNvbW1hbmRcIjogXCJmcmVlXCIsXG5cdFx0XHRcImluXCI6IGFycmF5Ll9pZFxuXHRcdH0pO1xuXHR9XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIGFyZ3VtZW50IG1pc3NpbmdcIik7XG5cdH1cblx0dmFyIGNhbGxiYWNrID0gYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXTtcblx0LyogVmFsaWRhdGUgYXJndW1lbnRzICovXG5cdGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXQgbGVhc3Qgb25lIE5EQXJyYXkgYXJndW1lbnQgZXhwZWN0ZWRcIik7XG5cdH1cblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoIC0gMTsgKytpKSB7XG5cdFx0dXRpbC5jaGVja05EQXJyYXkoYXJndW1lbnRzW2ldLCBcImFyZ3VtZW50IFwiICsgaSk7XG5cdH1cblx0dmFyIHJlbGVhc2UgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyArK2kpIHtcblx0XHRyZWxlYXNlW2ldID0gIWFyZ3VtZW50c1tpXS5fZGVjUmVmKCk7XG5cdH1cblx0dmFyIGNhbGxiYWNrV2FpdEFyZ3VtZW50cyA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xuXHR2YXIgY2FsbGJhY2tBcmd1bWVudHMgPSBuZXcgQXJyYXkoY2FsbGJhY2tXYWl0QXJndW1lbnRzKTtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja1dhaXRBcmd1bWVudHM7IGkrKykge1xuXHRcdHZhciBhcnJheSA9IGFyZ3VtZW50c1tpXTtcblx0XHR2YXIgbWVzc2FnZUlkID0gYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpO1xuXHRcdGlmIChhcnJheS5zaGFwZS5sZW5ndGggPT09IDApIHtcblx0XHRcdG1lc3NhZ2VDYWxsYmFja3NbbWVzc2FnZUlkXSA9IChmdW5jdGlvbihpLCBBcnJheVR5cGUpIHtcblx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKGJ1ZmZlcikge1xuXHRcdFx0XHRcdHZhciB0eXBlZEFycmF5ID0gbmV3IEFycmF5VHlwZShidWZmZXIpO1xuXHRcdFx0XHRcdGNhbGxiYWNrQXJndW1lbnRzW2ldID0gdHlwZWRBcnJheVswXTtcblx0XHRcdFx0XHRpZiAoLS1jYWxsYmFja1dhaXRBcmd1bWVudHMgPT09IDApIHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrLmFwcGx5KG51bGwsIGNhbGxiYWNrQXJndW1lbnRzKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9KShpLCBhcnJheS5kYXRhVHlwZS5hcnJheVR5cGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZXNzYWdlQ2FsbGJhY2tzW21lc3NhZ2VJZF0gPSAoZnVuY3Rpb24oaSwgQXJyYXlUeXBlLCBzaGFwZSkge1xuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oYnVmZmVyKSB7XG5cdFx0XHRcdFx0dmFyIGpzYXJyYXkgPSBuZXcgQXJyYXkoc2hhcGVbMF0pO1xuXHRcdFx0XHRcdHV0aWwuY3JlYXRlQXJyYXlSZWN1cnNpdmUobmV3IEFycmF5VHlwZShidWZmZXIpLCBqc2FycmF5LCBzaGFwZSwgMCwgMCk7XG5cdFx0XHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBqc2FycmF5O1xuXHRcdFx0XHRcdGlmICgtLWNhbGxiYWNrV2FpdEFyZ3VtZW50cyA9PT0gMCkge1xuXHRcdFx0XHRcdFx0Y2FsbGJhY2suYXBwbHkobnVsbCwgY2FsbGJhY2tBcmd1bWVudHMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH0pKGksIGFycmF5LmRhdGFUeXBlLmFycmF5VHlwZSwgYXJyYXkuc2hhcGUpO1xuXHRcdH1cblx0XHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XHRcImlkXCI6IG1lc3NhZ2VJZCxcblx0XHRcdFwiY29tbWFuZFwiOiBcImdldFwiLFxuXHRcdFx0XCJpblwiOiAocmVsZWFzZVtpXSA/IC1hcnJheS5faWQgOiBhcnJheS5faWQpXG5cdFx0fSk7XG5cdH1cbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUuaW5mbyA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdHZhciBtZXNzYWdlSWQgPSBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCk7XG5cdG1lc3NhZ2VDYWxsYmFja3NbbWVzc2FnZUlkXSA9IGNhbGxiYWNrO1xuXHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XCJpZFwiOiBtZXNzYWdlSWQsXG5cdFx0XCJjb21tYW5kXCI6IFwiaW5mb1wiXG5cdH0pO1xufTtcblxudmFyIGJpbmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBiLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xuXHR2YXIgc2hhcGVPdXQgPSBudWxsLCBkYXRhVHlwZU91dCA9IG51bGwsIHJlbGVhc2VBID0gZmFsc2UsIHJlbGVhc2VCID0gZmFsc2U7XG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdHNoYXBlT3V0ID0gYS5zaGFwZTtcblx0XHRkYXRhVHlwZU91dCA9IGEuZGF0YVR5cGU7XG5cdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBiLnNoYXBlKTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIGIuZGF0YVR5cGUpO1xuXHRcdH0gZWxzZSBpZiAoIXV0aWwuaXNOdW1iZXIoYikpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGJcIik7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKHV0aWwuaXNOdW1iZXIoYSkpIHtcblx0XHRzaGFwZU91dCA9IGIuc2hhcGU7XG5cdFx0ZGF0YVR5cGVPdXQgPSBiLmRhdGFUeXBlO1xuXHRcdHV0aWwuY2hlY2tOREFycmF5KGIsIFwiYlwiKTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiVW5zdXBwb3J0ZWQgdHlwZSBvZiBhXCIpO1xuXHR9XG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdHJlbGVhc2VBID0gIWEuX2RlY1JlZigpO1xuXHR9XG5cdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdHJlbGVhc2VCID0gIWIuX2RlY1JlZigpO1xuXHR9XG5cdHRyeSB7XG5cdFx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRcdG91dCA9IG5ldyBOREFycmF5KHNoYXBlT3V0LCBkYXRhVHlwZU91dCwgY29udGV4dCk7XG5cdFx0XHRpZiAocmVsZWFzZUEpIHtcblx0XHRcdFx0b3V0Ll9pZCA9IGEuX2lkO1xuXHRcdFx0XHRyZWxlYXNlQSA9IGZhbHNlO1xuXHRcdFx0fSBlbHNlIGlmIChyZWxlYXNlQikge1xuXHRcdFx0XHRvdXQuX2lkID0gYi5faWQ7XG5cdFx0XHRcdHJlbGVhc2VCID0gZmFsc2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KHNoYXBlT3V0LCBvdXQuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoZGF0YVR5cGVPdXQsIG91dC5kYXRhVHlwZSk7XG5cdFx0XHRvdXQuX2luY1JlZigpO1xuXHRcdH1cblx0XHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdFx0XHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XHRcdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XHRcdFx0XCJjb21tYW5kXCI6IG9wZXJhdGlvbixcblx0XHRcdFx0XHRcImFcIjogKHJlbGVhc2VBID8gLWEuX2lkIDogYS5faWQpLFxuXHRcdFx0XHRcdFwiYlwiOiAocmVsZWFzZUIgPyAtYi5faWQgOiBiLl9pZCksXG5cdFx0XHRcdFx0XCJvdXRcIjogb3V0Ll9pZFxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnRleHQuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcblx0XHRcdFx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcblx0XHRcdFx0XHRcImNvbW1hbmRcIjogb3BlcmF0aW9uICsgXCJjXCIsXG5cdFx0XHRcdFx0XCJhXCI6IChyZWxlYXNlQSA/IC1hLl9pZCA6IGEuX2lkKSxcblx0XHRcdFx0XHRcImJcIjogYixcblx0XHRcdFx0XHRcIm91dFwiOiBvdXQuX2lkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoKG9wZXJhdGlvbiA9PSBcImFkZFwiKSB8fCAob3BlcmF0aW9uID09IFwibXVsXCIpKSB7XG5cdFx0XHRcdC8qIENvbW11dGF0aXZlIG9wZXJhdGlvbjogZmxpcCB0aGUgb3BlcmFuZHMgKi9cblx0XHRcdFx0Y29udGV4dC5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0XHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFx0XHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24gKyBcImNcIixcblx0XHRcdFx0XHRcImFcIjogKHJlbGVhc2VCID8gLWIuX2lkIDogYi5faWQpLFxuXHRcdFx0XHRcdFwiYlwiOiBhLFxuXHRcdFx0XHRcdFwib3V0XCI6IG91dC5faWRcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XHRcdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XHRcdFx0XCJjb21tYW5kXCI6IFwiclwiICsgb3BlcmF0aW9uICsgXCJjXCIsXG5cdFx0XHRcdFx0XCJhXCI6IGIsXG5cdFx0XHRcdFx0XCJiXCI6IChyZWxlYXNlQSA/IC1hLl9pZCA6IGEuX2lkKSxcblx0XHRcdFx0XHRcIm91dFwiOiBvdXQuX2lkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBjYXRjaCAoZSkge1xuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXG5cdFx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRhLl9pbmNSZWYoKTtcblx0XHR9XG5cdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRiLl9pbmNSZWYoKTtcblx0XHR9XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRyZXR1cm4gb3V0O1xufTtcblxudmFyIHVuYXJ5QXJpdGhPcCA9IGZ1bmN0aW9uKGEsIG91dCwgY29udGV4dCwgb3BlcmF0aW9uKSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcblx0dmFyIHJlbGVhc2VBID0gIWEuX2RlY1JlZigpO1xuXHR0cnkge1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShhLnNoYXBlLCBhLmRhdGFUeXBlLCBjb250ZXh0KTtcblx0XHRcdGlmIChyZWxlYXNlQSkge1xuXHRcdFx0XHRvdXQuX2lkID0gYS5faWQ7XG5cdFx0XHRcdHJlbGVhc2VBID0gZmFsc2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KGEuc2hhcGUsIG91dC5zaGFwZSk7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcblx0XHR9XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHQvKiBSZXN0b3JlIHRoZSBwcmV2aW91cyBzdGF0ZSAqL1xuXHRcdGEuX2luY1JlZigpO1xuXHRcdHRocm93IGU7XG5cdH1cblx0Y29udGV4dC5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24sXG5cdFx0XCJhXCI6IChyZWxlYXNlQSA/IC1hLl9pZCA6IGEuX2lkKSxcblx0XHRcIm91dFwiOiBvdXQuX2lkXG5cdH0pO1xuXHRyZXR1cm4gb3V0O1xufTtcblxudmFyIHJlZHVjZUFyaXRoT3AgPSBmdW5jdGlvbihhLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdHZhciByZWxlYXNlQSA9ICFhLl9kZWNSZWYoKTtcblx0dHJ5IHtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoW10sIGEuZGF0YVR5cGUsIGNvbnRleHQpO1xuXHRcdFx0b3V0Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShvdXQuc2hhcGUsIFtdKTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XG5cdFx0XHRvdXQuX2luY1JlZigpO1xuXHRcdH1cblx0fSBjYXRjaCAoZSkge1xuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXG5cdFx0YS5faW5jUmVmKCk7XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XCJjb21tYW5kXCI6IG9wZXJhdGlvbixcblx0XHRcImFcIjogKHJlbGVhc2VBID8gLWEuX2lkIDogYS5faWQpLFxuXHRcdFwib3V0XCI6IG91dC5faWRcblx0fSk7XG5cdHJldHVybiBvdXQ7XG59O1xuXG52YXIgYXhpc1JlZHVjZUFyaXRoT3AgPSBmdW5jdGlvbihhLCBheGlzLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdHZhciByZWxlYXNlQSA9ICFhLl9kZWNSZWYoKTtcblx0dHJ5IHtcblx0XHR1dGlsLmNoZWNrQXhpcyhheGlzKTtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkodXRpbC5jb21wdXRlQXhpc1JlZHVjdGlvbk91dFNoYXBlKGEuc2hhcGUsIGF4aXMpLCBhLmRhdGFUeXBlLCBjb250ZXh0KTtcblx0XHRcdG91dC5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkob3V0LnNoYXBlLCBbXSk7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcblx0XHR9XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHQvKiBSZXN0b3JlIHRoZSBwcmV2aW91cyBzdGF0ZSAqL1xuXHRcdGEuX2luY1JlZigpO1xuXHRcdHRocm93IGU7XG5cdH1cblx0Y29udGV4dC5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24sXG5cdFx0XCJhXCI6IChyZWxlYXNlQSA/IC1hLl9pZCA6IGEuX2lkKSxcblx0XHRcImF4aXNcIjogYXhpc3wwLFxuXHRcdFwib3V0XCI6IG91dC5faWRcblx0fSk7XG5cdHJldHVybiBvdXQ7XG59O1xuXG52YXIgZG90QXJpdGhPcCA9IGZ1bmN0aW9uKGEsIGIsIG91dCwgY29udGV4dCkge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdHV0aWwuY2hlY2tOREFycmF5KGIsIFwiYlwiKTtcblx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XG5cdHZhciByZWxlYXNlQSA9ICFhLl9kZWNSZWYoKTtcblx0dmFyIHJlbGVhc2VCID0gIWIuX2RlY1JlZigpO1xuXHR0cnkge1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHR2YXIgc2hhcGVBID0gYS5zaGFwZTtcblx0XHRcdHZhciBzaGFwZUIgPSBiLnNoYXBlO1xuXHRcdFx0dmFyIGF4aXNBID0gTWF0aC5tYXgoc2hhcGVBLmxlbmd0aCAtIDEsIDApO1xuXHRcdFx0dmFyIGF4aXNCID0gTWF0aC5tYXgoc2hhcGVCLmxlbmd0aCAtIDIsIDApO1xuXHRcdFx0aWYgKHNoYXBlQVtheGlzQV0gIT0gc2hhcGVCW2F4aXNCXSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiTWlzbWF0Y2ggaW4gcmVkdWN0aW9uIGRpbWVuc2lvbnNcIik7XG5cdFx0XHR9XG5cdFx0XHR2YXIgc2hhcGVPdXQgPSBbXTtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXhpc0E7IGkrKykge1xuXHRcdFx0XHRzaGFwZU91dC5wdXNoKHNoYXBlQVtpXSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc2hhcGVCLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBheGlzQjsgaSsrKSB7XG5cdFx0XHRcdFx0c2hhcGVPdXQucHVzaChzaGFwZUJbaV0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNoYXBlT3V0LnB1c2goc2hhcGVCW3NoYXBlQi5sZW5ndGggLSAxXSk7XG5cdFx0XHR9XG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShzaGFwZU91dCwgYS5kYXRhVHlwZSwgY29udGV4dCk7XG5cdFx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcblx0XHR9IGVsc2UgaWYgKG91dCBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuXHRcdH1cblx0fSBjYXRjaCAoZSkge1xuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXG5cdFx0YS5faW5jUmVmKCk7XG5cdFx0Yi5faW5jUmVmKCk7XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XCJjb21tYW5kXCI6IFwiZG90XCIsXG5cdFx0XCJhXCI6IChyZWxlYXNlQSA/IC1hLl9pZCA6IGEuX2lkKSxcblx0XHRcImJcIjogKHJlbGVhc2VCID8gLWIuX2lkIDogYi5faWQpLFxuXHRcdFwib3V0XCI6IG91dC5faWRcblx0fSk7XG5cdHJldHVybiBvdXQ7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHRyZXR1cm4gYmluYXJ5QXJpdGhPcChhLCBiLCBvdXQsIHRoaXMsIFwiYWRkXCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5zdWIgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcblx0cmV0dXJuIGJpbmFyeUFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzLCBcInN1YlwiKTtcbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUubXVsID0gZnVuY3Rpb24oYSwgYiwgb3V0KSB7XG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJtdWxcIik7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmRpdiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHRyZXR1cm4gYmluYXJ5QXJpdGhPcChhLCBiLCBvdXQsIHRoaXMsIFwiZGl2XCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5uZWcgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwibmVnXCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5hYnMgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwiYWJzXCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5leHAgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwiZXhwXCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5sb2cgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwibG9nXCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5zcXJ0ID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcInNxcnRcIik7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLnNxdWFyZSA9IGZ1bmN0aW9uKGEsIG91dCkge1xuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywgXCJzcXVhcmVcIik7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLm1pbiA9IGZ1bmN0aW9uKGEsIGF4aXMpIHtcblx0aWYgKHR5cGVvZiBheGlzID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0cmV0dXJuIHJlZHVjZUFyaXRoT3AoYSwgdW5kZWZpbmVkLCB0aGlzLCBcIm1pblwiKTtcblx0fSBlbHNlIGlmICh1dGlsLmlzSW50KGF4aXMpKSB7XG5cdFx0cmV0dXJuIGF4aXNSZWR1Y2VBcml0aE9wKGEsIGF4aXMsIHVuZGVmaW5lZCwgdGhpcywgXCJhbWluXCIpO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCBheGlzIHR5cGVcIik7XG5cdH1cbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUubWF4ID0gZnVuY3Rpb24oYSwgYXhpcykge1xuXHRpZiAodHlwZW9mIGF4aXMgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRyZXR1cm4gcmVkdWNlQXJpdGhPcChhLCB1bmRlZmluZWQsIHRoaXMsIFwibWF4XCIpO1xuXHR9IGVsc2UgaWYgKHV0aWwuaXNJbnQoYXhpcykpIHtcblx0XHRyZXR1cm4gYXhpc1JlZHVjZUFyaXRoT3AoYSwgYXhpcywgdW5kZWZpbmVkLCB0aGlzLCBcImFtYXhcIik7XG5cdH0gZWxzZSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIGF4aXMgdHlwZVwiKTtcblx0fVxufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5zdW0gPSBmdW5jdGlvbihhLCBheGlzKSB7XG5cdGlmICh0eXBlb2YgYXhpcyA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdHJldHVybiByZWR1Y2VBcml0aE9wKGEsIHVuZGVmaW5lZCwgdGhpcywgXCJzdW1cIik7XG5cdH0gZWxzZSBpZiAodXRpbC5pc0ludChheGlzKSkge1xuXHRcdHJldHVybiBheGlzUmVkdWNlQXJpdGhPcChhLCBheGlzLCB1bmRlZmluZWQsIHRoaXMsIFwiYXN1bVwiKTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiVW5zdXBwb3J0ZWQgYXhpcyB0eXBlXCIpO1xuXHR9XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmRvdCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHRyZXR1cm4gZG90QXJpdGhPcChhLCBiLCBvdXQsIHRoaXMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQTmFDbENvbnRleHQ7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIG1lc3NhZ2VJZCA9IDE7XG52YXIgYXJyYXlJZCA9IDE7XG5cbmV4cG9ydHMubmV3TWVzc2FnZUlkID0gZnVuY3Rpb24oKSB7XG5cdHZhciBpZCA9IG1lc3NhZ2VJZDtcblx0bWVzc2FnZUlkID0gKG1lc3NhZ2VJZCsxKXwwO1xuXHRyZXR1cm4gaWQ7XG59O1xuXG5leHBvcnRzLm5ld0FycmF5SWQgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBpZCA9IGFycmF5SWQ7XG5cdGFycmF5SWQgPSAoYXJyYXlJZCsxKXwwO1xuXHRyZXR1cm4gaWQ7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qKlxuICogUHJvdmlkZXMgaW5mb3JtYXRpb24gYW5kIHN1cHBvcnQgZnVuY3Rpb25zXG4gKlxuICogQGNsYXNzIGZ1cmlvdXNcbiAqL1xuXG52YXIgRGF0YVR5cGUgPSByZXF1aXJlKFwiLi9EYXRhVHlwZVwiKTtcbnZhciBKU0NvbnRleHQgPSByZXF1aXJlKFwiLi9KU0NvbnRleHRcIik7XG52YXIgUE5hQ2xDb250ZXh0ID0gcmVxdWlyZShcIi4vUE5hQ2xDb250ZXh0XCIpO1xudmFyIFdlYkNMQ29udGV4dCA9IHJlcXVpcmUoXCIuL3dlYmNsL1dlYkNMQ29udGV4dFwiKTtcblxuLyoqXG4gKiBJbml0aWFsaXplcyBhIGNvbXB1dGF0aW9uYWwgY29udGV4dC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGluaXRcbiAqIEBhc3luY1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBbYmFja2VuZF0gLSBBIHN0cmluZyBpZGVudGlmaWVyIGZvciB0aGUgYmFja2VuZCB0byB1c2UuIFRoZSBmb2xsb3dpbmcgdmFsdWVzIGFyZSBzdXBwb3J0ZWQ6XG4gKlxuICogICAgIDx0YWJsZT5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRoPkJhY2tlbmQgSWRlbnRpZmllcjwvdGg+XG4gKiAgICAgICAgICAgICA8dGg+SW50ZXJwcmV0YXRpb248L3RoPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJqYXZhc2NyaXB0XCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPkphdmFTY3JpcHQgYmFja2VuZC4gV29ya3MgaW4gYWxsIGJyb3dzZXJzIGFuZCBOb2RlLmpzLCBidXQgY2FuIG5vdCBkZWxpdmVyIG9wdGltYWwgcGVyZm9ybWFuY2UuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwicG5hY2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+UG9ydGFibGUgTmF0aXZlIENsaWVudCAoUE5hQ2wpIGJhY2tlbmQuIFdvcmtzIGluIENocm9taXVtLWJhc2VkIGJyb3dzZXJzLiBDYW4gYWNjZWxlcmF0ZSBjb21wdXRhdGlvbnMgdGhyb3VnaCB0aGUgdXNlIG9mIGFkdmFuY2VkIENQVSBvcHRpbWl6YXRpb24gdGVjaG5vbG9naWVzLCBzdWNoIGFzIG11bHRpLXRocmVhZGluZyBhbmQgU0lNRCBpbnN0cnVjdGlvbnMuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwid2ViY2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+V2ViQ0wgYmFja2VuZC4gV29ya3MgaW4gYnJvd3NlcnMgYW5kIE5vZGUuanMgd2hlbiBhIFdlYkNMIHBsdWdpbiBpcyBhdmFpbGFibGUuIENhbiB1c2UgZnVsbCBwb3dlciBvZiBDUFVzIGFuZCBHUFVzIHRvIGFjY2VsZXJhdGUgY29tcHV0YXRpb25zLjwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgPC90YWJsZT5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIEJhY2tlbmQtc3BlY2lmaWMgb3B0aW9ucy5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBiYWNrZW5kIGZpbmlzaCBpbml0aWFsaXphdGlvbi5cbiAqIEBwYXJhbSB7Q29udGV4dH0gY2FsbGJhY2suY29udGV4dCAtIEEgcmVhZHkgdG8gdXNlIGNvbXB1dGF0aW9uYWwgY29udGV4dC5cbiAqL1xudmFyIGluaXQgPSBmdW5jdGlvbihiYWNrZW5kLCBvcHRpb25zLCBjYWxsYmFjaykge1xuXHRpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0aWYgKHR5cGVvZiBvcHRpb25zID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHQvKiBDYWxsZWQgd2l0aCBvbmUgcGFyYW1ldGVyOiBjYWxsYmFjayAqL1xuXHRcdFx0Y2FsbGJhY2sgPSBiYWNrZW5kO1xuXHRcdFx0b3B0aW9ucyA9IHVuZGVmaW5lZDtcblx0XHRcdGJhY2tlbmQgPSB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8qIENhbGxlZCB3aXRoIHR3byBwYXJhbWV0ZXJzOiBiYWNrZW5kIGFuZCBjYWxsYmFjayAqL1xuXHRcdFx0Y2FsbGJhY2sgPSBvcHRpb25zO1xuXHRcdFx0b3B0aW9ucyA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblx0aWYgKHR5cGVvZiBiYWNrZW5kID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0YmFja2VuZCA9IGdldERlZmF1bHRCYWNrZW5kKCk7XG5cdH1cblx0aWYgKHR5cGVvZiBvcHRpb25zID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0b3B0aW9ucyA9IHt9O1xuXHR9XG5cdGlmIChiYWNrZW5kID09PSBcImphdmFzY3JpcHRcIikge1xuXHRcdHJldHVybiBuZXcgSlNDb250ZXh0KG9wdGlvbnMsIGNhbGxiYWNrKTtcblx0fSBlbHNlIGlmIChiYWNrZW5kID09PSBcInBuYWNsXCIpIHtcblx0XHRyZXR1cm4gbmV3IFBOYUNsQ29udGV4dChvcHRpb25zLCBjYWxsYmFjayk7XG5cdH0gZWxzZSBpZiAoYmFja2VuZCA9PT0gXCJ3ZWJjbFwiKSB7XG5cdFx0cmV0dXJuIG5ldyBXZWJDTENvbnRleHQob3B0aW9ucywgY2FsbGJhY2spO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGJhY2tlbmQ6IFwiICsgYmFja2VuZCk7XG5cdH1cbn07XG5cbi8qKlxuICogRGV0ZWN0cyB0aGUgb3B0aW1hbCBiYWNrZW5kIHN1cHBvcnRlZCBieSB0aGUgYnJvd3NlciBvciBKYXZhU2NyaXB0IGVuZ2luZS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGdldERlZmF1bHRCYWNrZW5kXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSAtIERlZmF1bHQgYmFja2VuZCBpZGVudGlmaWVyIGZyb20gdGhlIGZvbGxvd2luZyB0YWJsZTpcbiAqXG4gKiAgICAgPHRhYmxlPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGg+QmFja2VuZCBJZGVudGlmaWVyPC90aD5cbiAqICAgICAgICAgICAgIDx0aD5JbnRlcnByZXRhdGlvbjwvdGg+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cImphdmFzY3JpcHRcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+SmF2YVNjcmlwdCBiYWNrZW5kLiBXb3JrcyBpbiBhbGwgYnJvd3NlcnMgYW5kIE5vZGUuanMsIGJ1dCBjYW4gbm90IGRlbGl2ZXIgb3B0aW1hbCBwZXJmb3JtYW5jZS48L3RkPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJhc21qc1wiPC90ZD5cbiAqICAgICAgICAgICAgIDx0ZD5Bc20uanMgYmFja2VuZC4gV29ya3MgaW4gRmlyZWZveCAyOSBhbmQgbGF0ZXIuIENhbiBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucyB3aXRoIGEgbGltaXRlZCB1c2Ugb2YgbmF0aXZlIENQVSBpbnN0cnVjdGlvbnMuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwicG5hY2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+UG9ydGFibGUgTmF0aXZlIENsaWVudCAoUE5hQ2wpIGJhY2tlbmQuIFdvcmtzIGluIENocm9taXVtLWJhc2VkIGJyb3dzZXJzLiBDYW4gYWNjZWxlcmF0ZSBjb21wdXRhdGlvbnMgdGhyb3VnaCB0aGUgdXNlIG9mIGFkdmFuY2VkIENQVSBvcHRpbWl6YXRpb24gdGVjaG5vbG9naWVzLCBzdWNoIGFzIG11bHRpLXRocmVhZGluZyBhbmQgU0lNRCBpbnN0cnVjdGlvbnMuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwid2ViY2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+V2ViQ0wgYmFja2VuZC4gV29ya3MgaW4gYnJvd3NlcnMgYW5kIE5vZGUuanMgd2hlbiBhIFdlYkNMIHBsdWdpbiBpcyBhdmFpbGFibGUuIENhbiB1c2UgZnVsbCBwb3dlciBvZiBDUFVzIGFuZCBHUFVzIHRvIGFjY2VsZXJhdGUgY29tcHV0YXRpb25zLjwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgPC90YWJsZT5cbiAqL1xudmFyIGdldERlZmF1bHRCYWNrZW5kID0gZnVuY3Rpb24oKSB7XG5cdGlmIChoYXNGZWF0dXJlKFwid2ViY2xcIikpIHtcblx0XHRyZXR1cm4gXCJ3ZWJjbFwiO1xuXHR9IGVsc2UgaWYgKGhhc0ZlYXR1cmUoXCJwbmFjbFwiKSkge1xuXHRcdHJldHVybiBcInBuYWNsXCI7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIFwiamF2YXNjcmlwdFwiO1xuXHR9XG59O1xuXG4vKipcbiAqIERldGVjdHMgd2hpY2ggYmFja2VuZHMgYXJlIHN1cHBvcnRlZCBieSB0aGUgc3lzdGVtLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZ2V0U3VwcG9ydGVkQmFja2VuZHNcbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmdbXX0gLSBBbiBhcnJheSBvZiBzdXBwb3J0ZWQgYmFja2VuZCBpZGVudGlmaWVycyBpbiBwcmlvcml0eSBvcmRlciAocHJpb3JpdGl6ZWQgYmFja2VuZHMgZmlyc3QpLiBUaGUgZm9sbG93aW5nIGlkZW50aWZpZXJzIGNvdWxkIGJlIHByZXNlbnQ6XG4gKlxuICogICAgIDx0YWJsZT5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRoPkJhY2tlbmQgSWRlbnRpZmllcjwvdGg+XG4gKiAgICAgICAgICAgICA8dGg+SW50ZXJwcmV0YXRpb248L3RoPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJqYXZhc2NyaXB0XCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPkphdmFTY3JpcHQgYmFja2VuZC4gV29ya3MgaW4gYWxsIGJyb3dzZXJzIGFuZCBOb2RlLmpzLCBidXQgY2FuIG5vdCBkZWxpdmVyIG9wdGltYWwgcGVyZm9ybWFuY2UuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwiYXNtanNcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+QXNtLmpzIGJhY2tlbmQuIFdvcmtzIGluIEZpcmVmb3ggMjkgYW5kIGxhdGVyLiBDYW4gYWNjZWxlcmF0ZSBjb21wdXRhdGlvbnMgd2l0aCBhIGxpbWl0ZWQgdXNlIG9mIG5hdGl2ZSBDUFUgaW5zdHJ1Y3Rpb25zLjwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cInBuYWNsXCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPlBvcnRhYmxlIE5hdGl2ZSBDbGllbnQgKFBOYUNsKSBiYWNrZW5kLiBXb3JrcyBpbiBDaHJvbWl1bS1iYXNlZCBicm93c2Vycy4gQ2FuIGFjY2VsZXJhdGUgY29tcHV0YXRpb25zIHRocm91Z2ggdGhlIHVzZSBvZiBhZHZhbmNlZCBDUFUgb3B0aW1pemF0aW9uIHRlY2hub2xvZ2llcywgc3VjaCBhcyBtdWx0aS10aHJlYWRpbmcgYW5kIFNJTUQgaW5zdHJ1Y3Rpb25zLjwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cIndlYmNsXCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPldlYkNMIGJhY2tlbmQuIFdvcmtzIGluIGJyb3dzZXJzIGFuZCBOb2RlLmpzIHdoZW4gYSBXZWJDTCBwbHVnaW4gaXMgYXZhaWxhYmxlLiBDYW4gdXNlIGZ1bGwgcG93ZXIgb2YgQ1BVcyBhbmQgR1BVcyB0byBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucy48L3RkPlxuICogICAgICAgICA8L3RyPlxuICogICAgIDwvdGFibGU+XG4gKi9cbnZhciBnZXRTdXBwb3J0ZWRCYWNrZW5kcyA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgYmFja2VuZHMgPSBbXTtcblx0aWYgKGhhc0ZlYXR1cmUoXCJ3ZWJjbFwiKSkge1xuXHRcdGJhY2tlbmRzLnB1c2goXCJ3ZWJjbFwiKTtcblx0fVxuXHRpZiAoaGFzRmVhdHVyZShcInBuYWNsXCIpKSB7XG5cdFx0YmFja2VuZHMucHVzaChcInBuYWNsXCIpO1xuXHR9XG5cdGlmIChoYXNGZWF0dXJlKFwiYXNtLmpzXCIpKSB7XG5cdFx0YmFja2VuZHMucHVzaChcImFzbS5qc1wiKTtcblx0fVxuXHRiYWNrZW5kcy5wdXNoKFwiamF2YXNjcmlwdFwiKTtcblx0cmV0dXJuIGJhY2tlbmRzO1xufTtcblxuLyoqXG4gKiBRdWVyaWVzIHBvc3NpYmxlIGJhY2tlbmQgb3B0aW9ucyBhdmFpbGFibGUgb24gdGhpcyBwbGF0Zm9ybS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gYmFja2VuZCAtIG5hbWUgb2YgdGhlIGJhY2tlbmQgdG8gcXVlcnkgb3B0aW9ucyBmb3IuXG4gKlxuICogQHN0YXRpY1xuICogQG1ldGhvZCBnZXRCYWNrZW5kT3B0aW9uc1xuICpcbiAqIEByZXR1cm4ge09iamVjdH0gLSBBbiBvYmplY3QgdGhhdCBkZXNjcmliZXMgYXZhaWxhYmxlIG9wdGlvbnMuXG4gKiBUaGUgbmFtZXMgb2Ygb2JqZWN0J3MgcHJvcGVydGllcyBjb3JyZXNwb25kIHRvIGJhY2tlbmQgb3B0aW9uIG5hbWVzLlxuICogT2JqZWN0J3MgcHJvcGVydGllcyBoYXZlIGFycmF5IHZhbHVlcyB3aXRoIHBvc3NpYmxlIG9wdGlvbiB2YWx1ZXMuXG4gKiBCZWxvdyBhcmUgdGhlIGJhY2tlbmQgb3B0aW9ucyBmb3IgdGhlIGJ1aWx0LWluIGJhY2tlbmRzOlxuICpcbiAqICAgICA8dGFibGU+XG4gKiAgICAgICAgIDxjYXB0aW9uPk9wdGlvbnMgb2YgXCJqYXZhc2NyaXB0XCIgYW5kIFwiYXNtanNcIiBiYWNrZW5kczwvY2FwdGlvbj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRoPk9wdGlvbiBuYW1lPC90aD5cbiAqICAgICAgICAgICAgIDx0aD5PcHRpb24gdmFsdWVzPC90aD5cbiAqICAgICAgICAgICAgIDx0aD5EZWZhdWx0IHZhbHVlPC90aD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwiYXN5bmNcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+W3RydWUsIGZhbHNlXTwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+dHJ1ZTwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgPC90YWJsZT5cbiAqXG4gKiAgICAgPHRhYmxlPlxuICogICAgICAgICA8Y2FwdGlvbj5PcHRpb25zIG9mIFwicG5hY2xcIiBiYWNrZW5kPC9jYXB0aW9uPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGg+T3B0aW9uIG5hbWU8L3RoPlxuICogICAgICAgICAgICAgPHRoPk9wdGlvbiB2YWx1ZXM8L3RoPlxuICogICAgICAgICAgICAgPHRoPkRlZmF1bHQgdmFsdWU8L3RoPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJtYW5pZmVzdFwiPC90ZD5cbiAqICAgICAgICAgICAgIDx0ZD51bmRlZmluZWQ8L3RkPlxuICogICAgICAgICAgICAgPHRkPlVSTCBvZiBcImZ1cmlvdXMubm1mXCIgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkgYXMgXCJmdXJpb3VzLmpzXCIgbGlicmFyeTwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgPC90YWJsZT5cbiAqXG4gKiAgICAgPHRhYmxlPlxuICogICAgICAgICA8Y2FwdGlvbj5PcHRpb25zIG9mIFwid2ViY2xcIiBiYWNrZW5kPC9jYXB0aW9uPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGg+T3B0aW9uIG5hbWU8L3RoPlxuICogICAgICAgICAgICAgPHRoPk9wdGlvbiB2YWx1ZXM8L3RoPlxuICogICAgICAgICAgICAgPHRoPkRlZmF1bHQgdmFsdWU8L3RoPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJkZXZpY2VcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+RGVwZW5kcyBvbiB0aGUgcGxhdGZvcm08L3RkPlxuICogICAgICAgICAgICAgPHRkPkRpc2NyZXRlIEdQVSBkZXZpY2UsIGlmIGF2YWlsYWJsZS4gT3RoZXJ3aXNlIGludGVncmF0ZWQgR1BVIGRldmljZSwgaWYgYXZhaWxhYmxlLiBPdGhlcndpc2UgQ1BVIGRldmljZS48L3RkPlxuICogICAgICAgICA8L3RyPlxuICogICAgIDwvdGFibGU+XG4gKi9cbnZhciBnZXRCYWNrZW5kT3B0aW9ucyA9IGZ1bmN0aW9uKGJhY2tlbmQpIHtcblx0aWYgKGJhY2tlbmQgPT09IFwiamF2YXNjcmlwdFwiKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdFwiYXN5bmNcIjogW3RydWUsIGZhbHNlXVxuXHRcdH07XG5cdH0gZWxzZSBpZiAoYmFja2VuZCA9PT0gXCJwbmFjbFwiKSB7XG5cdFx0aWYgKFBOYUNsQ29udGV4dC5pc1N1cHBvcnRlZCgpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcIm1hbmlmZXN0XCI6IFtQTmFDbENvbnRleHQuZ2V0RGVmYXVsdE1hbmlmZXN0VVJMKCldXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4ge307XG5cdFx0fVxuXHR9IGVsc2UgaWYgKGJhY2tlbmQgPT09IFwid2ViY2xcIikge1xuXHRcdHJldHVybiB7XG5cdFx0XHRcImRldmljZVwiOiBXZWJDTENvbnRleHQuZ2V0QXZhaWxhYmxlRGV2aWNlcygpXG5cdFx0fTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCBiYWNrZW5kOiBcIiArIGJhY2tlbmQpO1xuXHR9XG59O1xuXG4vKipcbiAqIFF1ZXJpZXMgZGVmYXVsdCBiYWNrZW5kIG9wdGlvbnMgb24gdGhpcyBwbGF0Zm9ybS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gYmFja2VuZCAtIG5hbWUgb2YgdGhlIGJhY2tlbmQgdG8gcXVlcnkgb3B0aW9ucyBmb3IuXG4gKlxuICogQHN0YXRpY1xuICogQG1ldGhvZCBnZXRCYWNrZW5kT3B0aW9uc1xuICpcbiAqIEByZXR1cm4ge09iamVjdH0gLSBBbiBvYmplY3QgdGhhdCBkZXNjcmliZXMgYXZhaWxhYmxlIG9wdGlvbnMuXG4gKiBUaGUgbmFtZXMgb2Ygb2JqZWN0J3MgcHJvcGVydGllcyBjb3JyZXNwb25kIHRvIGJhY2tlbmQgb3B0aW9uIG5hbWVzLlxuICogVGhlIHZhbHVlcyBvZiBvYmplY3QncyBwcm9wZXJ0aWVzIGNvcnJlc3BvbmQgdG8gZGVmYXVsdCBvcHRpb24gdmFsdWVzLlxuICovXG52YXIgZ2V0RGVmYXVsdEJhY2tlbmRPcHRpb25zID0gZnVuY3Rpb24oYmFja2VuZCkge1xuXHRpZiAoYmFja2VuZCA9PT0gXCJqYXZhc2NyaXB0XCIpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0XCJhc3luY1wiOiB0cnVlXG5cdFx0fTtcblx0fSBlbHNlIGlmIChiYWNrZW5kID09PSBcInBuYWNsXCIpIHtcblx0XHRpZiAoUE5hQ2xDb250ZXh0LmlzU3VwcG9ydGVkKCkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFwibWFuaWZlc3RcIjogUE5hQ2xDb250ZXh0LmdldERlZmF1bHRNYW5pZmVzdFVSTCgpXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4ge307XG5cdFx0fVxuXHR9IGVsc2UgaWYgKGJhY2tlbmQgPT09IFwid2ViY2xcIikge1xuXHRcdHJldHVybiB7XG5cdFx0XHRcImRldmljZVwiOiBXZWJDTENvbnRleHQuZ2V0RGVmYXVsdERldmljZSgpXG5cdFx0fTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCBiYWNrZW5kOiBcIiArIGJhY2tlbmQpO1xuXHR9XG59O1xuXG4vKipcbiAqIERldGVjdHMgd2hldGhlciB0aGUgcmVxdWVzdGVkIGNvbXB1dGluZyBmZWF0dXJlIGlzIGF2YWlsYWJsZVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgaGFzRmVhdHVyZVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0gYW4gaWRlbnRpZmllciBvZiB0aGUgb3B0aW9uYWwgZmVhdHVyZSB0byBkZXRlY3QuIFRoZSBmb2xsb3dpbmcgaWRlbnRpZmllcnMgYXJlIHN1cHBvcnRlZDpcbiAqXG4gKiAgICAgPHRhYmxlPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGg+RmVhdHVyZSBJZGVudGlmaWVyPC90aD5cbiAqICAgICAgICAgICAgIDx0aD5JbnRlcnByZXRhdGlvbjwvdGg+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cImFzbS5qc1wiPC90ZD5cbiAqICAgICAgICAgICAgIDx0ZD5EZXRlY3QgaWYgdGhlIEphdmFTY3JpcHQgZW5naW5lIHJlY29nbml6ZXMgQXNtLmpzIGRpcmVjdGl2ZS48L3RkPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJzaW1kLmpzXCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPkRldGVjdCBpZiB0aGUgSmF2YVNjcmlwdCBlbmdpbmUgcHJvdmlkZSBTSU1ELmZsb2F0MzJ4NCwgU0lNRC5pbnQzMng0LCBGbG9hdDMyeDRBcnJheSwgYW5kIEludDMyeDRBcnJheSBvZiBTSU1ELmpzPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwid2ViZ2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+RGV0ZWN0IGlmIHRoZSBlbnZpcm9ubWVudCBzdXBwb3J0cyBXZWJHTCAoZWl0aGVyIGV4cGVyaW1lbnRhbCBvciBzdGFibGUgaW1wbGVtZW50YXRpb24pPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwid2ViY2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+RGV0ZWN0IGlmIHRoZSBlbnZpcm9ubWVudCBzdXBwb3J0cyBXZWJDTDwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cInBuYWNsXCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPkRldGVjdCBpZiBQb3J0YWJsZSBOYXRpdmUgQ2xpZW50IChQTmFDbCkgaXMgc3VwcG9ydGVkIGFuZCBlbmFibGVkPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwibmFjbFwiPC90ZD5cbiAqICAgICAgICAgICAgIDx0ZD5EZXRlY3QgaWYgTmF0aXZlIENsaWVudCAoTmFDbCkgaXMgc3VwcG9ydGVkIGFuZCBlbmFibGVkPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICA8L3RhYmxlPlxuICpcbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gdHJ1ZSBpZiB0aGUgZmVhdHVyZSBpcyBzdXBwb3J0ZWQsIGZhbHNlIG90aGVyd2lzZVxuICovXG52YXIgaGFzRmVhdHVyZSA9IGZ1bmN0aW9uKG5hbWUpIHtcblx0c3dpdGNoIChuYW1lKSB7XG5cdFx0Y2FzZSBcImFzbS5qc1wiOlxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dmFyIHVzZXJBZ2VudCA9IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50O1xuXHRcdFx0XHR2YXIgdXNlckFnZW50Q29tcG9uZW50cyA9IHVzZXJBZ2VudC5zcGxpdCgvXFxzKy8pO1xuXHRcdFx0XHR2YXIgZmlyZWZveFJlZ2V4cCA9IC9bRmZdaXJlZm94XFwvKFxcZCspL2c7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdXNlckFnZW50Q29tcG9uZW50cy5sZW5ndGg7ICsraSkge1xuXHRcdFx0XHRcdHZhciBjb21wb25lbnQgPSB1c2VyQWdlbnRDb21wb25lbnRzW2ldO1xuXHRcdFx0XHRcdHZhciBtYXRjaCA9IGZpcmVmb3hSZWdleHAuZXhlYyhjb21wb25lbnQpO1xuXHRcdFx0XHRcdGlmIChtYXRjaCAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0dmFyIGZpcmVmb3hWZXJzaW9uID0gcGFyc2VJbnQobWF0Y2hbMV0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZpcmVmb3hWZXJzaW9uID49IDI5O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0Y2FzZSBcInNpbWQuanNcIjpcblx0XHRcdHJldHVybiAodHlwZW9mIFNJTUQgIT09IFwidW5kZWZpbmVkXCIpICYmXG5cdFx0XHRcdCh0eXBlb2YgRmxvYXQzMng0QXJyYXkgIT09IFwidW5kZWZpbmVkXCIpICYmXG5cdFx0XHRcdCh0eXBlb2YgSW50MzJ4NEFycmF5ICE9PSBcInVuZGVmaW5lZFwiKTtcblx0XHRjYXNlIFwid2ViZ2xcIjpcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGlmIChjYW52YXMuZ2V0Q29udGV4dChcIndlYmdsXCIpICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGlmIChjYW52YXMuZ2V0Q29udGV4dChcImV4cGVyaW1lbnRhbC13ZWJnbFwiKSAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRjYXNlIFwid2ViY2xcIjpcblx0XHRcdHJldHVybiBXZWJDTENvbnRleHQuaXNTdXBwb3J0ZWQoKTtcblx0XHRjYXNlIFwicG5hY2xcIjpcblx0XHRcdHJldHVybiBQTmFDbENvbnRleHQuaXNTdXBwb3J0ZWQoKTtcblx0XHRjYXNlIFwibmFjbFwiOlxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuICh0eXBlb2YgbmF2aWdhdG9yLm1pbWVUeXBlc1tcImFwcGxpY2F0aW9uL3gtbmFjbFwiXSkgIT09IFwidW5kZWZpbmVkXCI7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0ZGVmYXVsdDpcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlVua25vd24gZmVhdHVyZTogXCIgKyBuYW1lKTtcblx0fVxufTtcblxuZXhwb3J0cy5pbml0ID0gaW5pdDtcbmV4cG9ydHMuaGFzRmVhdHVyZSA9IGhhc0ZlYXR1cmU7XG5leHBvcnRzLmdldERlZmF1bHRCYWNrZW5kID0gZ2V0RGVmYXVsdEJhY2tlbmQ7XG5leHBvcnRzLmdldFN1cHBvcnRlZEJhY2tlbmRzID0gZ2V0U3VwcG9ydGVkQmFja2VuZHM7XG5leHBvcnRzLmdldEJhY2tlbmRPcHRpb25zID0gZ2V0QmFja2VuZE9wdGlvbnM7XG5leHBvcnRzLmdldERlZmF1bHRCYWNrZW5kT3B0aW9ucyA9IGdldERlZmF1bHRCYWNrZW5kT3B0aW9ucztcbmV4cG9ydHMuRGF0YVR5cGUgPSBEYXRhVHlwZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIEphdmFTY3JpcHQgaW1wbGVtZW50YXRpb24gb2YgY29tcHV0YXRpb25hbCBtZXRob2RzXG4gKlxuICogQHByaXZhdGVcbiAqIEBjbGFzcyBKU01hdGhcbiAqL1xuXG4vKipcbiAqIFNldHMgYWxsIGFycmF5IGVsZW1lbnRzIHRvIHRoZSBzcGVjaWZpZWQgdmFsdWUuXG4gKlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGEgLSB0aGUgYXJyYXkgZGF0YSBidWZmZXIuXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgLSB0aGUgY29uc3RhbnQgdG8gZmlsbCB0aGUgYnVmZmVyIHdpdGguXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZmlsbFxuICovXG5leHBvcnRzLmZpbGwgPSBmdW5jdGlvbihkYXRhLCB2YWx1ZSkge1xuXHR2YXIgbiA9IGRhdGEubGVuZ3RoO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xuXHRcdGRhdGFbaV0gPSB2YWx1ZTtcblx0fVxufTtcblxuLyoqXG4gKiBBZGRzIHR3byBhcnJheXMuXG4gKlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IGF1Z2VuZCBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQiAtIHRoZSBpbnB1dCBhZGRlbmQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgc3VtIGFycmF5LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGFkZFxuICovXG5leHBvcnRzLmFkZCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhQiwgZGF0YU91dCkge1xuXHR2YXIgbiA9IGRhdGFPdXQubGVuZ3RoO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xuXHRcdGRhdGFPdXRbaV0gPSBkYXRhQVtpXSArIGRhdGFCW2ldO1xuXHR9XG59O1xuXG4vKipcbiAqIEFkZHMgYSBjb25zdGFudCB0byBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXVnZW5kIGFycmF5LlxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlQiAtIHRoZSBhZGRlbmQgY29uc3RhbnQuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgc3VtIGFycmF5LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGFkZENvbnN0XG4gKi9cbmV4cG9ydHMuYWRkQ29uc3QgPSBmdW5jdGlvbihkYXRhQSwgdmFsdWVCLCBkYXRhT3V0KSB7XG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XG5cdFx0ZGF0YU91dFtpXSA9IGRhdGFBW2ldICsgdmFsdWVCO1xuXHR9XG59O1xuXG4vKipcbiAqIFN1YnRyYWN0cyB0d28gYXJyYXlzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBtaW51ZW5kIGFycmF5LlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFCIC0gdGhlIGlucHV0IHN1YnRyYWhlbmQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgZGlmZmVyZW5jZSBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBzdWJcbiAqL1xuZXhwb3J0cy5zdWIgPSBmdW5jdGlvbihkYXRhQSwgZGF0YUIsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gLSBkYXRhQltpXTtcblx0fVxufTtcblxuLyoqXG4gKiBTdWJ0cmFjdHMgYSBjb25zdGFudCBmcm9tIGFuIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBtaW51ZW5kIGFycmF5LlxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlQiAtIHRoZSBzdWJ0cmFoZW5kIGNvbnN0YW50LlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGRpZmZlcmVuY2UgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2Qgc3ViQ29uc3RcbiAqL1xuZXhwb3J0cy5zdWJDb25zdCA9IGZ1bmN0aW9uKGRhdGFBLCB2YWx1ZUIsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gLSB2YWx1ZUI7XG5cdH1cbn07XG5cbi8qKlxuICogU3VidHJhY3RzIGFuIGFycmF5IGZyb20gYSBjb25zdGFudC5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgc3VidHJhaGVuZCBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZUIgLSB0aGUgbWludWVuZCBjb25zdGFudC5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBkaWZmZXJlbmNlIGFycmF5LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIHN1YlJldkNvbnN0XG4gKi9cbmV4cG9ydHMuc3ViUmV2Q29uc3QgPSBmdW5jdGlvbihkYXRhQSwgdmFsdWVCLCBkYXRhT3V0KSB7XG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XG5cdFx0ZGF0YU91dFtpXSA9IHZhbHVlQiAtIGRhdGFBW2ldO1xuXHR9XG59O1xuXG4vKipcbiAqIE11bHRpcGxpZXMgdHdvIGFycmF5cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgbXVsdGlwbGljYW5kIGFycmF5LlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFCIC0gdGhlIGlucHV0IG11bHRpcGxpZXIgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgcHJvZHVjdCBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBtdWxcbiAqL1xuZXhwb3J0cy5tdWwgPSBmdW5jdGlvbihkYXRhQSwgZGF0YUIsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gKiBkYXRhQltpXTtcblx0fVxufTtcblxuLyoqXG4gKiBNdWx0aXBsaWVzIGFuIGFycmF5IGJ5IGEgY29uc3RhbnQuXG4gKlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IG11bHRpcGxpY2FuZCBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZUIgLSB0aGUgbXVsdGlwbGllciBjb25zdGFudC5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBwcm9kdWN0IGFycmF5LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIG11bENvbnN0XG4gKi9cbmV4cG9ydHMubXVsQ29uc3QgPSBmdW5jdGlvbihkYXRhQSwgdmFsdWVCLCBkYXRhT3V0KSB7XG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XG5cdFx0ZGF0YU91dFtpXSA9IGRhdGFBW2ldICogdmFsdWVCO1xuXHR9XG59O1xuXG4vKipcbiAqIERpdmlkZXMgdHdvIGFycmF5cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgZGl2aWRlbmQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUIgLSB0aGUgaW5wdXQgZGl2aXNvciBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBxdW90aWVudCBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBkaXZcbiAqL1xuZXhwb3J0cy5kaXYgPSBmdW5jdGlvbihkYXRhQSwgZGF0YUIsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gLyBkYXRhQltpXTtcblx0fVxufTtcblxuLyoqXG4gKiBEaXZpZGVzIGFuIGFycmF5IGJ5IGEgY29uc3RhbnQuXG4gKlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IGRpdmlkZW5kIGFycmF5LlxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlQiAtIHRoZSBkaXZpc29yIGNvbnN0YW50LlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IHF1b3RpZW50IGFycmF5LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGRpdkNvbnN0XG4gKi9cbmV4cG9ydHMuZGl2Q29uc3QgPSBmdW5jdGlvbihkYXRhQSwgdmFsdWVCLCBkYXRhT3V0KSB7XG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XG5cdFx0ZGF0YU91dFtpXSA9IGRhdGFBW2ldIC8gdmFsdWVCO1xuXHR9XG59O1xuXG4vKipcbiAqIERpdmlkZXMgYSBjb25zdGFudCBieSBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgZGl2aXNvciBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZUIgLSB0aGUgZGl2aWRlbmQgY29uc3RhbnQuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgcXVvdGllbnQgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZGl2UmV2Q29uc3RcbiAqL1xuZXhwb3J0cy5kaXZSZXZDb25zdCA9IGZ1bmN0aW9uKGRhdGFBLCB2YWx1ZUIsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gdmFsdWVCIC8gZGF0YUFbaV07XG5cdH1cbn07XG5cbi8qKlxuICogTmVnYXRlcyBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgbmVnXG4gKi9cbmV4cG9ydHMubmVnID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gLWRhdGFBW2ldO1xuXHR9XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIGFic29sdXRlIHZhbHVlIG9mIGFycmF5IGVsZW1lbnRzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBhYnNcbiAqL1xuZXhwb3J0cy5hYnMgPSBmdW5jdGlvbihkYXRhQSwgZGF0YU91dCkge1xuXHR2YXIgbiA9IGRhdGFPdXQubGVuZ3RoO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xuXHRcdGRhdGFPdXRbaV0gPSBNYXRoLmFicyhkYXRhQVtpXSk7XG5cdH1cbn07XG5cbi8qKlxuICogRXhwb25lbnRpYXRlcyBhcnJheSBlbGVtZW50cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZXhwXG4gKi9cbmV4cG9ydHMuZXhwID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gTWF0aC5leHAoZGF0YUFbaV0pO1xuXHR9XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIGxvZ2FyaXRobSBvZiBhcnJheSBlbGVtZW50cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgbG9nXG4gKi9cbmV4cG9ydHMubG9nID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gTWF0aC5sb2coZGF0YUFbaV0pO1xuXHR9XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIHNxdWFyZSByb290IG9mIGFycmF5IGVsZW1lbnRzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBzcXJ0XG4gKi9cbmV4cG9ydHMuc3FydCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XG5cdFx0ZGF0YU91dFtpXSA9IE1hdGguc3FydChkYXRhQVtpXSk7XG5cdH1cbn07XG5cbi8qKlxuICogU3F1YXJlcyBhcnJheSBlbGVtZW50cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2Qgc3F1YXJlXG4gKi9cbmV4cG9ydHMuc3F1YXJlID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHR2YXIgYSA9IGRhdGFBW2ldO1xuXHRcdGRhdGFPdXRbaV0gPSBhICogYTtcblx0fVxufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgbWluaW11bSB2YWx1ZSBvZiBlbGVtZW50cyBpbiBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkgdG8gY29tcHV0ZSBtaW5pbXVtIG9uLlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGFycmF5IHRvIHN0b3JlIHRoZSBtaW5pbXVtIGF0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIG1pblxuICovXG5leHBvcnRzLm1pbiA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XG5cdC8qIENvbXB1dGF0aW9uIG9mIGFsbC1hcnJheSBtaW4gKi9cblx0dmFyIGxlbmd0aEEgPSBkYXRhQS5sZW5ndGg7XG5cdHZhciByZXN1bHQgPSBkYXRhQVswXTtcblx0Zm9yICh2YXIgaSA9IDE7IGkgPCBsZW5ndGhBOyArK2kpIHtcblx0XHRyZXN1bHQgPSBNYXRoLm1pbihyZXN1bHQsIGRhdGFBW2ldKTtcblx0fVxuXHRkYXRhT3V0WzBdID0gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgbWF4aW11bSB2YWx1ZSBvZiBlbGVtZW50cyBpbiBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkgdG8gY29tcHV0ZSBtYXhpbXVtIG9uLlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGFycmF5IHRvIHN0b3JlIHRoZSBtYXhpbXVtIGF0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIG1heFxuICovXG5leHBvcnRzLm1heCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XG5cdC8qIENvbXB1dGF0aW9uIG9mIGFsbC1hcnJheSBtaW4gKi9cblx0dmFyIGxlbmd0aEEgPSBkYXRhQS5sZW5ndGg7XG5cdHZhciByZXN1bHQgPSBkYXRhQVswXTtcblx0Zm9yICh2YXIgaSA9IDE7IGkgPCBsZW5ndGhBOyArK2kpIHtcblx0XHRyZXN1bHQgPSBNYXRoLm1heChyZXN1bHQsIGRhdGFBW2ldKTtcblx0fVxuXHRkYXRhT3V0WzBdID0gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgc3VtIG9mIGVsZW1lbnRzIGluIGFuIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheSB3aXRoIGVsZW1lbnRzIHRvIHN1bSB1cC5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgc3VtIGF0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIG1pblxuICovXG5leHBvcnRzLnN1bSA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XG5cdHZhciBsZW5ndGhBID0gZGF0YUEubGVuZ3RoO1xuXHR2YXIgcmVzdWx0ID0gMC4wO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aEE7ICsraSkge1xuXHRcdHJlc3VsdCArPSBkYXRhQVtpXTtcblx0fVxuXHRkYXRhT3V0WzBdID0gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgbWluaW11bSB2YWx1ZSBvZiBlbGVtZW50cyBhbG9uZyBhbiBheGlzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheSB0byBjb21wdXRlIG1pbmltYSBvbi5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgbWluaW1hIGF0LlxuICogQHBhcmFtIHtOdW1iZXJ9IG91dGVyU3RyaWRlIC0gdGhlIHByb2R1Y3Qgb2YgaW5wdXQgYXJyYXkgZGltZW5zaW9ucyBwcmVjZWVkaW5nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxuICogQHBhcmFtIHtOdW1iZXJ9IGlubmVyU3RyaWRlIC0gdGhlIHByb2R1Y3Qgb2YgaW5wdXQgYXJyYXkgZGltZW5zaW9ucyBmb2xsb3dpbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXG4gKiBAcGFyYW0ge051bWJlcn0gcmVkdWN0aW9uRGltIC0gdGhlIGxlbmd0aCBvZiBpbnB1dCBhcnJheSBhbG9uZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBheGlzTWluXG4gKi9cbmV4cG9ydHMuYXhpc01pbiA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0LCBvdXRlclN0cmlkZSwgaW5uZXJTdHJpZGUsIHJlZHVjdGlvbkRpbSkge1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IG91dGVyU3RyaWRlOyArK2kpIHtcblx0XHRmb3IgKHZhciBrID0gMDsgayA8IGlubmVyU3RyaWRlOyArK2spIHtcblx0XHRcdHZhciBvZmZzZXQgPSBpICogcmVkdWN0aW9uRGltICogaW5uZXJTdHJpZGUgKyBrO1xuXHRcdFx0dmFyIGN1cnJlbnRNaW4gPSBkYXRhQVtvZmZzZXRdO1xuXHRcdFx0Zm9yICh2YXIgaiA9IDE7IGogPCByZWR1Y3Rpb25EaW07ICsraikge1xuXHRcdFx0XHRvZmZzZXQgKz0gaW5uZXJTdHJpZGU7XG5cdFx0XHRcdGN1cnJlbnRNaW4gPSBNYXRoLm1pbihjdXJyZW50TWluLCBkYXRhQVtvZmZzZXRdKTtcblx0XHRcdH1cblx0XHRcdGRhdGFPdXRbaSAqIGlubmVyU3RyaWRlICsga10gPSBjdXJyZW50TWluO1xuXHRcdH1cblx0fVxufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgbWF4aW11bSB2YWx1ZSBvZiBlbGVtZW50cyBhbG9uZyBhbiBheGlzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheSB0byBjb21wdXRlIG1heGltYSBvbi5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgbWF4aW1hIGF0LlxuICogQHBhcmFtIHtOdW1iZXJ9IG91dGVyU3RyaWRlIC0gdGhlIHByb2R1Y3Qgb2YgaW5wdXQgYXJyYXkgZGltZW5zaW9ucyBwcmVjZWVkaW5nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxuICogQHBhcmFtIHtOdW1iZXJ9IGlubmVyU3RyaWRlIC0gdGhlIHByb2R1Y3Qgb2YgaW5wdXQgYXJyYXkgZGltZW5zaW9ucyBmb2xsb3dpbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXG4gKiBAcGFyYW0ge051bWJlcn0gcmVkdWN0aW9uRGltIC0gdGhlIGxlbmd0aCBvZiBpbnB1dCBhcnJheSBhbG9uZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBheGlzTWF4XG4gKi9cbmV4cG9ydHMuYXhpc01heCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0LCBvdXRlclN0cmlkZSwgaW5uZXJTdHJpZGUsIHJlZHVjdGlvbkRpbSkge1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IG91dGVyU3RyaWRlOyArK2kpIHtcblx0XHRmb3IgKHZhciBrID0gMDsgayA8IGlubmVyU3RyaWRlOyArK2spIHtcblx0XHRcdHZhciBvZmZzZXQgPSBpICogcmVkdWN0aW9uRGltICogaW5uZXJTdHJpZGUgKyBrO1xuXHRcdFx0dmFyIGN1cnJlbnRNYXggPSBkYXRhQVtvZmZzZXRdO1xuXHRcdFx0Zm9yICh2YXIgaiA9IDE7IGogPCByZWR1Y3Rpb25EaW07ICsraikge1xuXHRcdFx0XHRvZmZzZXQgKz0gaW5uZXJTdHJpZGU7XG5cdFx0XHRcdGN1cnJlbnRNYXggPSBNYXRoLm1heChjdXJyZW50TWF4LCBkYXRhQVtvZmZzZXRdKTtcblx0XHRcdH1cblx0XHRcdGRhdGFPdXRbaSAqIGlubmVyU3RyaWRlICsga10gPSBjdXJyZW50TWF4O1xuXHRcdH1cblx0fVxufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgc3VtIG9mIGVsZW1lbnRzIGFsb25nIGFuIGF4aXMuXG4gKlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IGFycmF5IHRvIHN1bSB1cC5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgc3VtcyBhdC5cbiAqIEBwYXJhbSB7TnVtYmVyfSBvdXRlclN0cmlkZSAtIHRoZSBwcm9kdWN0IG9mIGlucHV0IGFycmF5IGRpbWVuc2lvbnMgcHJlY2VlZGluZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cbiAqIEBwYXJhbSB7TnVtYmVyfSBpbm5lclN0cmlkZSAtIHRoZSBwcm9kdWN0IG9mIGlucHV0IGFycmF5IGRpbWVuc2lvbnMgZm9sbG93aW5nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxuICogQHBhcmFtIHtOdW1iZXJ9IHJlZHVjdGlvbkRpbSAtIHRoZSBsZW5ndGggb2YgaW5wdXQgYXJyYXkgYWxvbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgYXhpc1N1bVxuICovXG5leHBvcnRzLmF4aXNTdW0gPSBmdW5jdGlvbihkYXRhQSwgZGF0YU91dCwgb3V0ZXJTdHJpZGUsIGlubmVyU3RyaWRlLCByZWR1Y3Rpb25EaW0pIHtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBvdXRlclN0cmlkZTsgKytpKSB7XG5cdFx0Zm9yICh2YXIgayA9IDA7IGsgPCBpbm5lclN0cmlkZTsgKytrKSB7XG5cdFx0XHR2YXIgb2Zmc2V0ID0gaSAqIHJlZHVjdGlvbkRpbSAqIGlubmVyU3RyaWRlICsgaztcblx0XHRcdHZhciBjdXJyZW50U3VtID0gZGF0YUFbb2Zmc2V0XTtcblx0XHRcdGZvciAodmFyIGogPSAxOyBqIDwgcmVkdWN0aW9uRGltOyArK2opIHtcblx0XHRcdFx0b2Zmc2V0ICs9IGlubmVyU3RyaWRlO1xuXHRcdFx0XHRjdXJyZW50U3VtICs9IGRhdGFBW29mZnNldF07XG5cdFx0XHR9XG5cdFx0XHRkYXRhT3V0W2kgKiBpbm5lclN0cmlkZSArIGtdID0gY3VycmVudFN1bTtcblx0XHR9XG5cdH1cbn07XG5cbi8qKlxuICogQ29tcHV0ZXMgdGhlIGRvdCBwcm9kdWN0IG9mIHR3byBOLWRpbWVuc2lvbmFsIGFycmF5cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSBhbiBpbnB1dCBtdWx0aXBsaWNhbmQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUIgLSBhbiBpbnB1dCBtdWx0aXBsaWVyIGFycmF5LlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IHByb2R1Y3QgYXJyYXkuXG4gKiBAcGFyYW0ge051bWJlcn0gc3RyaWRlQSAtIHRoZSBwcm9kdWN0IG9mIHRoZSB0aGUgbXVsdGlwbGljYW5kIGRpbWVuc2lvbnMgcHJlY2VlZGluZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cbiAqIEBwYXJhbSB7TnVtYmVyfSBvdXRlclN0cmlkZUIgLSB0aGUgcHJvZHVjdCBvZiB0aGUgbXVsdGlwbGllciBkaW1lbnNpb25zIHByZWNlZWRpbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXG4gKiBAcGFyYW0ge051bWJlcn0gaW5uZXJTdHJpZGVCIC0gdGhlIHByb2R1Y3Qgb2YgdGhlIG11bHRpcGxpZXIgZGltZW5zaW9ucyBmb2xsb3dpbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXG4gKiBAcGFyYW0ge051bWJlcn0gcmVkdWN0aW9uRGltIC0gdGhlIGxlbmd0aCBvZiBpbnB1dHMgYXJyYXlzIGFsb25nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGRvdFxuICovXG5leHBvcnRzLmRvdCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhQiwgZGF0YU91dCwgc3RyaWRlQSwgb3V0ZXJTdHJpZGVCLCBpbm5lclN0cmlkZUIsIHJlZHVjdGlvbkRpbSkge1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IHN0cmlkZUE7ICsraSkge1xuXHRcdGZvciAodmFyIGogPSAwOyBqIDwgcmVkdWN0aW9uRGltOyArK2opIHtcblx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgb3V0ZXJTdHJpZGVCOyArK2spIHtcblx0XHRcdFx0Zm9yICh2YXIgbCA9IDA7IGwgPCBpbm5lclN0cmlkZUI7ICsrbCkge1xuXHRcdFx0XHRcdGRhdGFPdXRbKGkqb3V0ZXJTdHJpZGVCICsgaykgKiBpbm5lclN0cmlkZUIgKyBsXSArPSBkYXRhQVtpKnJlZHVjdGlvbkRpbStqXSAqIGRhdGFCWyhrKnJlZHVjdGlvbkRpbStqKSppbm5lclN0cmlkZUIrbF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn07XG5cbi8qKlxuICogUmVwbGljYXRlcyBhcnJheSBlbGVtZW50cyBhbG9uZyBhbiBheGlzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSBmb3IgcmVwZWF0ZWQgZWxlbWVudHMuXG4gKiBAcGFyYW0ge051bWJlcn0gb3V0ZXJTdHJpZGUgLSB0aGUgcHJvZHVjdCBvZiBpbnB1dCBhcnJheSBkaW1lbnNpb25zIHByZWNlZWRpbmcgdGhlIGV4cGFuc2lvbiBkaW1lbnNpb24uXG4gKiBAcGFyYW0ge051bWJlcn0gaW5uZXJTdHJpZGUgLSB0aGUgcHJvZHVjdCBvZiBpbnB1dCBhcnJheSBkaW1lbnNpb25zIGZvbGxvd2luZyB0aGUgZXhwYW5zaW9uIGRpbWVuc2lvbi5cbiAqIEBwYXJhbSB7TnVtYmVyfSBleHBhbnNpb25EaW0gLSB0aGUgbGVuZ3RoIG9mIGlucHV0IGFycmF5IGFsb25nIHRoZSBleHBhbnNpb24gZGltZW5zaW9uLlxuICogQHBhcmFtIHtOdW1iZXJ9IHJlcGVhdHMgLSB0aGUgbnVtYmVyIG9mIHRpbWVzIGVhY2ggZWxlbWVudCB3aWxsIGJlIHJlcGxpY2F0ZWQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgcmVwZWF0XG4gKi9cbmV4cG9ydHMucmVwZWF0ID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQsIG91dGVyU3RyaWRlLCBpbm5lclN0cmlkZSwgZXhwYW5zaW9uRGltLCByZXBlYXRzKSB7XG5cdGlmIChpbm5lclN0cmlkZSA8IHJlcGVhdHMpIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG91dGVyU3RyaWRlOyArK2kpIHtcblx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgZXhwYW5zaW9uRGltOyArK2opIHtcblx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCBpbm5lclN0cmlkZTsgKytrKSB7XG5cdFx0XHRcdFx0dmFyIHZhbHVlQSA9IGRhdGFBWyhpICogZXhwYW5zaW9uRGltICsgaikgKiBpbm5lclN0cmlkZSArIGtdO1xuXHRcdFx0XHRcdGZvciAodmFyIGMgPSAwOyBjIDwgcmVwZWF0czsgKytjKSB7XG5cdFx0XHRcdFx0XHRkYXRhT3V0WygoaSAqIGV4cGFuc2lvbkRpbSArIGopICogcmVwZWF0cyArIGMpICogaW5uZXJTdHJpZGUgKyBrXSA9IHZhbHVlQTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBvdXRlclN0cmlkZTsgKytpKSB7XG5cdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IGV4cGFuc2lvbkRpbTsgKytqKSB7XG5cdFx0XHRcdHZhciByb3dBID0gZGF0YUEuc3ViYXJyYXkoKGkgKiBleHBhbnNpb25EaW0gKyBqKSAqIGlubmVyU3RyaWRlLCAoaSAqIGV4cGFuc2lvbkRpbSArIGogKyAxKSAqIGlubmVyU3RyaWRlKTtcblx0XHRcdFx0Zm9yICh2YXIgYyA9IDA7IGMgPCByZXBlYXRzOyArK2MpIHtcblx0XHRcdFx0XHRkYXRhT3V0LnNldChyb3dBLCAoKGkgKiBleHBhbnNpb25EaW0gKyBqKSAqIHJlcGVhdHMgKyBjKSAqIGlubmVyU3RyaWRlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIFByb3ZpZGVzIGhlbHBlciBmdW5jdGlvbnNcbiAqXG4gKiBAcHJpdmF0ZVxuICogQGNsYXNzIHV0aWxcbiAqL1xuXG52YXIgaXNOdW1iZXIgPSBmdW5jdGlvbihuKSB7XG5cdHJldHVybiBuID09PSArbjtcbn07XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbnZhciBpc1JlYWwgPSBmdW5jdGlvbihuKSB7XG5cdHJldHVybiAobiA9PT0gK24pICYmIChpc0Zpbml0ZShuKSk7XG59O1xuZXhwb3J0cy5pc1JlYWwgPSBpc1JlYWw7XG5cbnZhciBpc0ludCA9IGZ1bmN0aW9uKG4pIHtcblx0cmV0dXJuIG4gPT09IChufDApO1xufTtcbmV4cG9ydHMuaXNJbnQgPSBpc0ludDtcblxuZXhwb3J0cy5pc1Bvc2l0aXZlSW50ID0gZnVuY3Rpb24obikge1xuXHRyZXR1cm4gKG4gPT09ICtuKSAmJiAobiA9PT0gKG58MCkpICYmIChuID4gMCk7XG59O1xuXG5leHBvcnRzLmlzTm9uTmVnYXRpdmVJbnQgPSBmdW5jdGlvbihuKSB7XG5cdHJldHVybiAobiA9PT0gK24pICYmIChuID09PSAobnwwKSkgJiYgKG4gPj0gMCk7XG59O1xuXG52YXIgaXNBcnJheSA9IGZ1bmN0aW9uKGxpc3QpIHtcblx0cmV0dXJuIGxpc3QgaW5zdGFuY2VvZiBBcnJheTtcbn07XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5leHBvcnRzLmlzSW50QXJyYXkgPSBmdW5jdGlvbihsaXN0KSB7XG5cdGlmIChleHBvcnRzLmlzQXJyYXkobGlzdCkpIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmICghZXhwb3J0cy5pc0ludChsaXN0W2ldKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufTtcblxuZXhwb3J0cy5pc1Bvc2l0aXZlSW50QXJyYXkgPSBmdW5jdGlvbihsaXN0KSB7XG5cdGlmIChleHBvcnRzLmlzQXJyYXkobGlzdCkpIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmICghZXhwb3J0cy5pc1Bvc2l0aXZlSW50KGxpc3RbaV0pKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59O1xuXG5leHBvcnRzLmFzSW50QXJyYXkgPSBmdW5jdGlvbiAobGlzdCkge1xuXHRpZiAoZXhwb3J0cy5pc0ludChsaXN0KSkge1xuXHRcdHJldHVybiBbbGlzdF07XG5cdH0gZWxzZSBpZiAoZXhwb3J0cy5pc0ludEFycmF5KGxpc3QpKSB7XG5cdFx0cmV0dXJuIGxpc3Q7XG5cdH0gZWxzZSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihsaXN0ICsgXCIgY2FuIG5vdCBiZSBjb252ZXJ0ZWQgdG8gaW50ZWdlciBhcnJheVwiKTtcblx0fVxufTtcblxuZXhwb3J0cy5yb3VuZFVwID0gZnVuY3Rpb24gKG51bWJlciwgbXVsdGlwbGUpIHtcblx0cmV0dXJuIE1hdGguY2VpbChudW1iZXIgLyBtdWx0aXBsZSkgKiBtdWx0aXBsZTtcbn07XG5cbi8qKlxuICogVmFsaWRhdGUgdGhlIHNoYXBlIGFyZ3VtZW50LlxuICogVGhyb3dzIGFuIGVycm9yIGlmIHRoZSBhcmd1bWVudCByZXByZXNlbnRzIGEgdmFsaWQgc2hhcGUuXG4gKiBSZXR1cm5zIHRoZSBzaGFwZSBhcyBhbiBpbnRlZ2VyIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7KE51bWJlcnxOdW1iZXJbXSl9IHNoYXBlIC0gdGhlIHNoYXBlIGFyZ3VtZW50IHRvIHZhbGlkYXRlLlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgc2hhcGUgPSB1dGlsLmNoZWNrU2hhcGUoc2hhcGUpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGNoZWNrU2hhcGVcbiAqL1xudmFyIGNoZWNrU2hhcGUgPSBmdW5jdGlvbihzaGFwZSkge1xuXHRpZiAoaXNOdW1iZXIoc2hhcGUpKSB7XG5cdFx0cmV0dXJuIGNoZWNrU2hhcGUoW3NoYXBlXSk7XG5cdH0gZWxzZSBpZiAoaXNBcnJheShzaGFwZSkpIHtcblx0XHR2YXIgbiA9IHNoYXBlLmxlbmd0aDtcblx0XHR2YXIgb3V0U2hhcGUgPSBuZXcgQXJyYXkobik7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcblx0XHRcdGlmICghaXNOdW1iZXIoc2hhcGVbaV0pKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihcIlNoYXBlIGhhcyBub24tbnVtZXJpYyBkaW1lbnNpb25zXCIpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFpc0ludChzaGFwZVtpXSkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiU2hhcGUgbXVzdCBoYXZlIGludGVnZXIgZGltZW5zaW9uc1wiKTtcblx0XHRcdH1cblx0XHRcdGlmIChzaGFwZVtpXSA8IDEpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRGVnZW5lcmF0ZSBzaGFwZVwiKTtcblx0XHRcdH1cblx0XHRcdG91dFNoYXBlW2ldID0gc2hhcGVbaV18MDtcblx0XHR9XG5cdFx0cmV0dXJuIG91dFNoYXBlO1xuXHR9XG59O1xuZXhwb3J0cy5jaGVja1NoYXBlID0gY2hlY2tTaGFwZTtcblxuLyoqXG4gKiBDaGVja3MgdGhhdCB0aGUgdHdvIHNoYXBlcyBhcmUgc2ltaWxhci5cbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgdHdvIHNoYXBlcyBhcmUgZGlmZmVyZW50LlxuICogSWYgdGhlIGRhdGEgdHlwZXMgYXJlIGNvbXBhdGlibGUsIHRoZSBmdW5jdGlvbiBkb2VzIG5vdGhpbmcuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJbXX0gc2hhcGVBIC0gb25lIHZhbGlkIHNoYXBlIHRvIGNvbXBhcmUuXG4gKiBAcGFyYW0ge051bWJlcltdfSBzaGFwZUIgLSBhbm90aGVyIHZhbGlkIHNoYXBlIHRvIGNvbXBhcmUuXG4gKlxuICogQGV4YW1wbGVcbiAqICAgICB1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBiLnNoYXBlKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBjaGVja1NoYXBlc0NvbXBhdGliaWxpdHlcbiAqL1xuZXhwb3J0cy5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkgPSBmdW5jdGlvbihzaGFwZUEsIHNoYXBlQikge1xuXHRpZiAoc2hhcGVBLmxlbmd0aCAhPSBzaGFwZUIubGVuZ3RoKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiVGhlIHNoYXBlcyBoYXZlIGRpZmZlcmVudCBkaW1lbnNpb25zXCIpO1xuXHR9XG5cdHZhciBuID0gc2hhcGVBLmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcblx0XHRpZiAoc2hhcGVBW2ldICE9IHNoYXBlQltpXSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVGhlIHNoYXBlcyBhcmUgZGlmZmVyZW50XCIpO1xuXHRcdH1cblx0fVxufTtcblxuLyoqXG4gKiBDb21wdXRlcyBhcnJheSBsZW5ndGggZnJvbSBpdHMgc2hhcGUuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJbXX0gc2hhcGUgLSBhbiBhcnJheSBzaGFwZS4gIFRoZSBzaGFwZSBtdXN0IGJlIHZhbGlkIHcuci50LiAqKmNoZWNrU2hhcGUqKiBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogICAgIHZhciBsZW5ndGggPSB1dGlsLmNvbXB1dGVMZW5ndGgoc2hhcGUpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGNvbXB1dGVMZW5ndGhcbiAqL1xuZXhwb3J0cy5jb21wdXRlTGVuZ3RoID0gZnVuY3Rpb24oc2hhcGUpIHtcblx0dmFyIGxlbmd0aCA9IDE7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgc2hhcGUubGVuZ3RoOyArK2kpIHtcblx0XHRsZW5ndGggKj0gc2hhcGVbaV07XG5cdH1cblx0cmV0dXJuIGxlbmd0aDtcbn07XG5cbi8qKlxuICogQ2hlY2tzIHRoZSB0aGUgYXJndW1lbnQgcmVwcmVzZW50cyBhIGRhdGEgdHlwZS5cbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgYXJndW1lbnQgaXMgbm90IG9mIERhdGFUeXBlIHR5cGUuXG4gKiBJZiB0aGUgYXJndW1lbnQgaXMgYSBEYXRhVHlwZSBvYmplY3QsIHRoZSBmdW5jdGlvbiBkb2VzIG5vdGhpbmcuXG4gKlxuICogQHBhcmFtIHtEYXRhVHlwZX0gZGF0YVR5cGUgLSB0aGUgZXhwZWN0ZWRseSBkYXRhIHR5cGUgb2JqZWN0IHRvIHZhbGlkYXRlLlxuICogQHJldHVybiB7RGF0YVR5cGV9IC0gYSBkYXRhIHR5cGUgb2JqZWN0IGVxdWl2YWxlbnQgdG8gdGhlIGFyZ3VtZW50LlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgZGF0YVR5cGUgPSB1dGlsLmNoZWNrRGF0YVR5cGUoZGF0YVR5cGUpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGNoZWNrRGF0YVR5cGVcbiAqL1xuZXhwb3J0cy5jaGVja0RhdGFUeXBlID0gZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0dmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XG5cdGlmICghKGRhdGFUeXBlIGluc3RhbmNlb2YgRGF0YVR5cGUpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcImRhdGFUeXBlIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBEYXRhVHlwZVwiKTtcblx0fVxuXHRyZXR1cm4gZGF0YVR5cGU7XG59O1xuXG4vKipcbiAqIENoZWNrcyB0aGF0IHRoZSB0d28gZGF0YSB0eXBlcyBhcmUgY29tcGF0aWJsZS5cbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgZGF0YSB0eXBlcyBkbyBub3QgbWF0Y2guXG4gKiBJZiB0aGUgZGF0YSB0eXBlcyBhcmUgY29tcGF0aWJsZSwgdGhlIGZ1bmN0aW9uIGRvZXMgbm90aGluZy5cbiAqXG4gKiBAcGFyYW0ge0RhdGFUeXBlfSBkYXRhVHlwZUEgLSB0aGUgZmlyc3QgZGF0YSB0eXBlLlxuICogQHBhcmFtIHtEYXRhVHlwZX0gZGF0YVR5cGVCIC0gdGhlIHNlY29uZCBkYXRhIHR5cGUuXG4gKlxuICogQGV4YW1wbGVcbiAqICAgICB1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBiLmRhdGFUeXBlKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBjaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHlcbiAqL1xuZXhwb3J0cy5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkgPSBmdW5jdGlvbihkYXRhVHlwZUEsIGRhdGFUeXBlQikge1xuXHRpZiAoIWRhdGFUeXBlQS5lcXVhbHMoZGF0YVR5cGVCKSkge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIlRoZSBkYXRhIHR5cGVzIGFyZSBub3QgY29tcGF0aWJsZVwiKTtcblx0fVxufTtcblxuLyoqXG4gKiBWYWxpZGF0ZXMgYW4gTkRBcnJheSBwYXJhbWV0ZXIuXG4gKiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIGV4cGVjdGVkIE5EQXJyYXkgYXJndW1lbnQgaGFzIG90aGVyIHR5cGUgb3IgaWYgaXQgaGFzIGJlZW4gaW52YWxpZGF0ZWQuXG4gKiBJZiB0aGUgYXJndW1lbnQgaXMgYSB2YWxpZCBOREFycmF5LCB0aGUgZnVuY3Rpb24gZG9lcyBub3RoaW5nLlxuICpcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXkgLSB0aGUgZXhwZWN0ZWRseSBOREFycmF5IGFyZ3VtZW50IHRvIGJlIHZhbGlkYXRlZC5cbiAqIEBwYXJhbSB7U3RyaW5nfSB2YW5hbWUgLSB0aGUgbmFtZSBvZiB0aGUgTkRBcnJheSBhcmd1bWVudCB0byBiZSB1c2VkIGluIGVycm9yIG1lc3NhZ2VzLlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgdXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBjaGVja05EQXJyYXlcbiAqL1xuZXhwb3J0cy5jaGVja05EQXJyYXkgPSBmdW5jdGlvbihhcnJheSwgdmFybmFtZSkge1xuXHR2YXIgTkRBcnJheSA9IHJlcXVpcmUoXCIuL05EQXJyYXlcIik7XG5cdGlmICghKGFycmF5IGluc3RhbmNlb2YgTkRBcnJheSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHZhcm5hbWUgKyBcIiBpcyBub3QgYW4gTkRBcnJheVwiKTtcblx0fVxuXHRpZiAoIWFycmF5LmlzVmFsaWQoKSkge1xuXHRcdHRocm93IG5ldyBFcnJvcih2YXJuYW1lICsgXCIgaXMgYW4gaW52YWxpZGF0ZWQgYXJyYXlcIik7XG5cdH1cbn07XG5cbi8qKlxuICogQ2hlY2tzIHRoYXQgdGhlIHR3byBhcnJheXMgYXJlIGRpZmZlcmVudC5cbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGV5IHJlZmVyIHRvIHRoZSBzYW1lIG9iamVjdC5cbiAqIElmIHRoZSBhcnJheXMgYXJlIGRpZmZlcmVudCwgdGhlIGZ1bmN0aW9uIGRvZXMgbm90aGluZy5cbiAqXG4gKiBAcGFyYW0ge05EQXJyYXl9IGEgLSB0aGUgZmlyc3QgYXJyYXkgdG8gY2hlY2suIE11c3QgYmUgYW4gTkRBcnJheSBvYmplY3QuXG4gKiBAcGFyYW0ge05EQXJyYXl9IGIgLSB0aGUgc2Vjb25kIGFycmF5IHRvIGNoZWNrLiBNdXN0IGJlIGFuIE5EQXJyYXkgb2JqZWN0LlxuICogQHBhcmFtIHtTdHJpbmd9IHZhcm5hbWVBIC0gbmFtZSBvZiB0aGUgZmlyc3QgYXJyYXkgdmFyaWFibGUuIFRoaXMgbmFtZSBtYXkgYmUgdXNlZCBpbiBhbiBlcnJvciBtZXNzYWdlLlxuICogQHBhcmFtIHtTdHJpbmd9IHZhcm5hbWVCIC0gbmFtZSBvZiB0aGUgc2Vjb25kIGFycmF5IHZhcmlhYmxlLiBUaGlzIG5hbWUgbWF5IGJlIHVzZWQgaW4gYW4gZXJyb3IgbWVzc2FnZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogICAgIHV0aWwuY2hlY2tEaWZmZXJlbnROREFycmF5cyhhLCBvdXQsIFwiYVwiLCBcIm91dFwiKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBjaGVja0RpZmZlcmVudE5EQXJyYXlzXG4gKi9cbmV4cG9ydHMuY2hlY2tEaWZmZXJlbnROREFycmF5cyA9IGZ1bmN0aW9uKGEsIGIsIHZhcm5hbWVBLCB2YXJuYW1lQikge1xuXHRpZiAoYSA9PT0gYikge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIlRoZSBhcnJheXMgXCIgKyB2YXJuYW1lQSArIFwiIGFuZCBcIiArIHZhcm5hbWVCICsgXCIgbXVzdCBiZSBkaWZmZXJlbnRcIik7XG5cdH1cbn07XG5cbi8qKlxuICogVmFsaWRhdGVzICoqcmVwZWF0cyoqIHBhcmFtZXRlciBmb3IgcmVwZWF0aXRpb24vdGlsaW5nIG9mIGFycmF5IGFsb25nIGFuIGF4aXMuXG4gKiBUaHJvd3MgYW4gZXJyb3IgaWYgKipyZXBlYXRzKiogaXMgbm90IGFuIGludGVnZXIgb3IgaWYgKipyZXBlYXRzKiogaXMgc21hbGxlciB0aGFuIDIuXG4gKiBJZiAqKnJlcGVhdHMqKiBpcyB2YWxpZCwgdGhlIGZ1bmN0aW9uIGRvZXMgbm90aGluZy5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gcmVwZWF0cyAtIHRoZSByZXBlYXRzIGFyZ3VtZW50IHRvIGJlIHZlcmlmaWVkLlxuICogQHJldHVybiB7TnVtYmVyfSAtICoqcmVwZWF0cyoqIGNhc3RlZCB0byBpbnRlZ2VyLlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgcmVwZWF0cyA9IHV0aWwuY2hlY2tSZXBlYXRzKHJlcGVhdHMpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGNoZWNrUmVwZWF0c1xuICovXG5leHBvcnRzLmNoZWNrUmVwZWF0cyA9IGZ1bmN0aW9uKHJlcGVhdHMpIHtcblx0aWYgKCFpc0ludChyZXBlYXRzKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJSZXBlYXRzIGlzIG5vdCBhbiBpbnRlZ2VyXCIpO1xuXHR9XG5cdGlmIChyZXBlYXRzIDw9IDEpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlJlcGVhdHMgc2hvdWxkIGJlIGdyZWF0ZXIgdGhhbiAxXCIpO1xuXHR9XG5cdHJldHVybiByZXBlYXRzfDA7XG59O1xuXG4vKipcbiAqIFZhbGlkYXRlcyBheGlzIHBhcmFtZXRlciBmb3IgcmVkdWN0aW9ucyBhbG9uZyBhbiBheGlzLlxuICogVGhyb3dzIGFuIGVycm9yIGlmIGF4aXMgaXMgbm90IGFuIGludGVnZXIsIGlmIGF4aXMgaXMgbmVnYXRpdmUsIG9yIGF4aXMgZXhjZWVkcyB0aGUgbnVtYmVyIG9mIGRpbWVuc2lvbnMuXG4gKiBJZiBheGlzIGlzIHZhbGlkLCB0aGUgZnVuY3Rpb24gZG9lcyBub3RoaW5nLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgYXJndW1lbnQgdG8gYmUgdmVyaWZpZWQuXG4gKiBAcGFyYW0ge051bWJlcn0gbnVtRGltZW5zaW9ucyAtIHRoZSBudW1iZXIgb2YgZGltZW5zaW9ucyBpbiB0aGUgYXJyYXkgYmVpbmcgcmVkdWNlZC5cbiAqIEByZXR1cm4ge051bWJlcn0gLSBheGlzIGNhc3RlZCB0byBpbnRlZ2VyLlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgYXhpcyA9IHV0aWwuY2hlY2tBeGlzKGF4aXMsIG5kYXJyYXkuc2hhcGUubGVuZ3RoKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZFxuICovXG5leHBvcnRzLmNoZWNrQXhpcyA9IGZ1bmN0aW9uKGF4aXMsIG51bURpbWVuc2lvbnMpIHtcblx0aWYgKCFpc0ludChheGlzKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJBeGlzIGlzIG5vdCBhbiBpbnRlZ2VyXCIpO1xuXHR9XG5cdGlmIChheGlzIDwgMCkge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiQXhpcyBpcyBuZWdhdGl2ZVwiKTtcblx0fVxuXHQvKiBFLmcuIDMtZGltZW5zaW9uYWwgYXJyYXkgaGFzIGF4ZXMgMCwgMSwgMiAoYnV0IG5vdCAzISkgKi9cblx0aWYgKGF4aXMgPj0gbnVtRGltZW5zaW9ucykge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiQXhpcyBvdXQgb2YgcmFuZ2VcIik7XG5cdH1cblx0cmV0dXJuIGF4aXN8MDtcbn07XG5cbi8qKlxuICogVmFsaWRhdGVzIHRoZSBzaGFwZSBvZiBvdXRwdXQgYXJyYXkgZm9yIHJlZHVjdGlvbnMgYWxvbmcgYW4gYXhpcy5cbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgc2hhcGUgb2YgdGhlIG91dHB1dCBhcnJheSBkb2VzIG1hdGNoIHRoZSBzaGFwZSBvZiBpbnB1dCBhcnJheSBhZnRlciByZWR1Y3Rpb24gYWxvbmcgdGhlIGF4aXMuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJbXX0gaW5TaGFwZSAtIHRoZSBzaGFwZSBvZiB0aGUgaW5wdXQgYXJyYXkuXG4gKiBAcGFyYW0ge051bWJlcltdfSBvdXRTaGFwZSAtIHRoZSBzaGFwZSBvZiB0aGUgb3V0cHV0IGFycmF5IHRvIGJlIHZhbGlkYXRlZC5cbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgZm9yIHJlZHVjdGlvbiBvZiBpbnB1dCBhcnJheS4gTXVzdCBiZSB2YWxpZCB3LnIudC4gaW5TaGFwZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogICAgIHV0aWwuY2hlY2tBeGlzUmVkdWN0aW9uT3V0U2hhcGUoaW5BcnJheS5zaGFwZSwgb3V0QXJyYXkuc2hhcGUsIGF4aXMpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kXG4gKi9cbmV4cG9ydHMuY2hlY2tBeGlzUmVkdWN0aW9uT3V0U2hhcGUgPSBmdW5jdGlvbihpblNoYXBlLCBvdXRTaGFwZSwgYXhpcykge1xuXHRpZiAoaW5TaGFwZS5sZW5ndGggIT09IG91dFNoYXBlLmxlbmd0aCArIDEpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJPdXRwdXQgYXJyYXkgaGFzIGludmFsaWQgbnVtYmVyIG9mIGRpbWVuc2lvbnMgZm9yIHRoaXMgb3BlcmF0aW9uXCIpO1xuXHR9XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYXhpczsgKytpKSB7XG5cdFx0aWYgKGluU2hhcGVbaV0gIT09IG91dFNoYXBlW2ldKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJPdXRwdXQgYXJyYXkgaGFzIGludmFsaWQgc2hhcGUgZm9yIHRoaXMgb3BlcmF0aW9uXCIpO1xuXHRcdH1cblx0fVxuXHRmb3IgKHZhciBpID0gYXhpcyArIDE7IGkgPCBpblNoYXBlLmxlbmd0aDsgKytpKSB7XG5cdFx0aWYgKGluU2hhcGVbaV0gIT09IG91dFNoYXBlW2ktMV0pIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIk91dHB1dCBhcnJheSBoYXMgaW52YWxpZCBzaGFwZSBmb3IgdGhpcyBvcGVyYXRpb25cIik7XG5cdFx0fVxuXHR9XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIHRoZSBzaGFwZSBvZiBhbiBhcnJheSBhZnRlciByZWR1Y3Rpb24gYWxvbmcgYW4gYXhpcy5cbiAqXG4gKiBAcGFyYW0ge051bWJlcltdfSBpblNoYXBlIC0gdGhlIHNoYXBlIG9mIHRoZSBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgZm9yIHJlZHVjdGlvbiBvZiBpbnB1dCBhcnJheS4gTXVzdCBiZSB2YWxpZCB3LnIudC4gaW5TaGFwZS5cbiAqIEByZXR1cm4ge051bWJlcltdfSAtIHRoZSBzaGFwZSBvZiB0aGUgb3V0cHV0IGFycmF5LlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgdmFyIG91dFNoYXBlID0gdXRpbC5nZXRBeGlzUmVkdWN0aW9uT3V0U2hhcGUoaW5BcnJheS5zaGFwZSwgYXhpcyk7XG4gKiAgICAgdmFyIG91dEFycmF5ID0gbmV3IE5EQXJyYXkob3V0U2hhcGUsIGluQXJyYXkuZGF0YVR5cGUsIGNvbnRleHQpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kXG4gKi9cbmV4cG9ydHMuY29tcHV0ZUF4aXNSZWR1Y3Rpb25PdXRTaGFwZSA9IGZ1bmN0aW9uKGluU2hhcGUsIGF4aXMpIHtcblx0dmFyIG91dFNoYXBlID0gW107XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgaW5TaGFwZS5sZW5ndGg7ICsraSkge1xuXHRcdGlmIChpICE9PSBheGlzKSB7XG5cdFx0XHRvdXRTaGFwZS5wdXNoKGluU2hhcGVbaV0pO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gb3V0U2hhcGU7XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIHRoZSBwcm9kdWN0IG9mIGFycmF5IGRpbWVuc2lvbnMgYmVmb3JlIHRoZSBheGlzLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyW119IHNoYXBlIC0gdGhlIHNoYXBlIG9mIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgdXNlZCBpbiBhbiBvcGVyYXRpb24uIE11c3QgYmUgdmFsaWQgdy5yLnQuIHNoYXBlLlxuICogQHJldHVybiB7TnVtYmVyfSAtIHRoZSBwcm9kdWN0IG9mIGFycmF5IGRpbWVuc2lvbnMgYmVmb3JlIGF4aXMuXG4gKlxuICogQGV4YW1wbGVcbiAqICAgICAvLyA1LWRpbWVuc2lvbmFsIGFycmF5XG4gKiAgICAgdmFyIG5kYXJyYXkgPSBjb250ZXh0LmVtcHR5KFsyLCAzLCA0LCA1LCA2XSk7XG4gKiAgICAgLy8gUmV0dXJucyA2ID0gMiozXG4gKiAgICAgdmFyIG91dGVyU3RyaWRlID0gY29tcHV0ZU91dGVyU3RyaWRlKG5kYXJyYXksIDIpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kXG4gKi9cbmV4cG9ydHMuY29tcHV0ZU91dGVyU3RyaWRlID0gZnVuY3Rpb24oc2hhcGUsIGF4aXMpIHtcblx0dmFyIG91dGVyU3RyaWRlID0gMTtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBheGlzOyArK2kpIHtcblx0XHRvdXRlclN0cmlkZSAqPSBzaGFwZVtpXTtcblx0fVxuXHRyZXR1cm4gb3V0ZXJTdHJpZGU7XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIHRoZSBwcm9kdWN0IG9mIGFycmF5IGRpbWVuc2lvbnMgYWZ0ZXIgdGhlIGF4aXMuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJbXX0gc2hhcGUgLSB0aGUgc2hhcGUgb2YgdGhlIGFycmF5LlxuICogQHBhcmFtIHtOdW1iZXJ9IGF4aXMgLSB0aGUgYXhpcyB1c2VkIGluIGFuIG9wZXJhdGlvbi4gTXVzdCBiZSB2YWxpZCB3LnIudC4gc2hhcGUuXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IC0gdGhlIHByb2R1Y3Qgb2YgYXJyYXkgZGltZW5zaW9ucyBhZnRlciBheGlzLlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgLy8gNS1kaW1lbnNpb25hbCBhcnJheVxuICogICAgIHZhciBuZGFycmF5ID0gY29udGV4dC5lbXB0eShbMiwgMywgNCwgNSwgNl0pO1xuICogICAgIC8vIFJldHVybnMgNiA9IDIqM1xuICogICAgIHZhciBpbm5lclN0cmlkZSA9IGNvbXB1dGVJbm5lclN0cmlkZShuZGFycmF5LCAyKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZFxuICovXG5leHBvcnRzLmNvbXB1dGVJbm5lclN0cmlkZSA9IGZ1bmN0aW9uKHNoYXBlLCBheGlzKSB7XG5cdHZhciBpbm5lclN0cmlkZSA9IDE7XG5cdGZvciAodmFyIGkgPSBheGlzICsgMTsgaSA8IHNoYXBlLmxlbmd0aDsgKytpKSB7XG5cdFx0aW5uZXJTdHJpZGUgKj0gc2hhcGVbaV07XG5cdH1cblx0cmV0dXJuIGlubmVyU3RyaWRlO1xufTtcblxudmFyIGRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZSA9IGZ1bmN0aW9uKGRhdGEsIHNoYXBlLCBsZXZlbCkge1xuXHRpZiAoaXNBcnJheShkYXRhKSkge1xuXHRcdGlmIChzaGFwZS5sZW5ndGggPD0gbGV2ZWwpIHtcblx0XHRcdC8qIERpc2NvdmVyZWQgYSBuZXcgbGV2ZWwgb2Ygc3ViLWFycmF5cy4gUmVjb3JkIGl0cyBkaW1lbnNpb24uICovXG5cdFx0XHRzaGFwZS5wdXNoKGRhdGEubGVuZ3RoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0LyogT25seSBjaGVjayBkaW1lbnNpb24gKi9cblx0XHRcdGlmIChzaGFwZVtsZXZlbF0gIT0gZGF0YS5sZW5ndGgpIHtcblx0XHRcdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJTdWItYXJyYXkgXCIgKyBkYXRhICsgXCIgZG9lcyBub3QgbWF0Y2ggdGhlIGV4cGVjdGVkIGRpbWVuc2lvbiBvZiBcIiArIHNoYXBlW2xldmVsXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuXHRcdFx0ZGlzY292ZXJBcnJheVNoYXBlUmVjdXJzaXZlKGRhdGFbaV0sIHNoYXBlLCBsZXZlbCArIDEpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRpZiAobGV2ZWwgIT0gc2hhcGUubGVuZ3RoKSB7XG5cdFx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlN1Yi1hcnJheSBbXCIgKyBkYXRhICsgXCJdIGRvZXMgbm90IG1hdGNoIHRoZSBleHBlY3RlZCBkaW1lbnNpb24gb2YgXCIgKyBzaGFwZVtsZXZlbF0pO1xuXHRcdH1cblx0XHRpZiAoIWlzTnVtYmVyKGRhdGEpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiTm9uLW51bWVyaWMgZWxlbWVudDogXCIgKyBkYXRhKTtcblx0XHR9XG5cdH1cbn07XG5leHBvcnRzLmRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZSA9IGRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZTtcblxudmFyIGNvcHlBcnJheURhdGFSZWN1cnNpdmUgPSBmdW5jdGlvbihkYXRhQnVmZmVyLCBkYXRhQXJyYXksIHNoYXBlLCBsZXZlbCwgb2Zmc2V0KSB7XG5cdHZhciBuID0gc2hhcGVbbGV2ZWxdO1xuXHRpZiAobGV2ZWwgPT09IHNoYXBlLmxlbmd0aCAtIDEpIHtcblx0XHRkYXRhQnVmZmVyLnNldChkYXRhQXJyYXksIG9mZnNldCAqIG4pO1xuXHR9IGVsc2Uge1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSB7XG5cdFx0XHRjb3B5QXJyYXlEYXRhUmVjdXJzaXZlKGRhdGFCdWZmZXIsIGRhdGFBcnJheVtpXSwgc2hhcGUsIGxldmVsICsgMSwgb2Zmc2V0ICogbiAgKyBpKTtcblx0XHR9XG5cdH1cbn07XG5leHBvcnRzLmNvcHlBcnJheURhdGFSZWN1cnNpdmUgPSBjb3B5QXJyYXlEYXRhUmVjdXJzaXZlO1xuXG52YXIgY3JlYXRlQXJyYXlSZWN1cnNpdmUgPSBmdW5jdGlvbihkYXRhQnVmZmVyLCBkYXRhQXJyYXksIHNoYXBlLCBsZXZlbCwgb2Zmc2V0KSB7XG5cdHZhciBuID0gc2hhcGVbbGV2ZWxdO1xuXHRpZiAobGV2ZWwgPT09IHNoYXBlLmxlbmd0aCAtIDEpIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykge1xuXHRcdFx0ZGF0YUFycmF5W2ldID0gZGF0YUJ1ZmZlcltvZmZzZXQgKiBuICsgaV07XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSB7XG5cdFx0XHRkYXRhQXJyYXlbaV0gPSBuZXcgQXJyYXkoc2hhcGVbbGV2ZWwgKyAxXSk7XG5cdFx0XHRjcmVhdGVBcnJheVJlY3Vyc2l2ZShkYXRhQnVmZmVyLCBkYXRhQXJyYXlbaV0sIHNoYXBlLCBsZXZlbCArIDEsIG9mZnNldCAqIG4gICsgaSk7XG5cdFx0fVxuXHR9XG59O1xuZXhwb3J0cy5jcmVhdGVBcnJheVJlY3Vyc2l2ZSA9IGNyZWF0ZUFycmF5UmVjdXJzaXZlO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBOREFycmF5ID0gcmVxdWlyZShcIi4uL05EQXJyYXlcIik7XG52YXIgRGF0YVR5cGUgPSByZXF1aXJlKFwiLi4vRGF0YVR5cGVcIik7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuLi91dGlsXCIpO1xuXG5cbi8qIEJ1Z2d5IGluIENocm9taXVtLVdlYkNMICovXG52YXIgdXNlQnVmZmVyQ3JlYXRpb25XaXRoSW5pdCA9IGZhbHNlO1xuXG52YXIgaXNOb2RlV2ViQ0wgPSBmYWxzZTtcbnZhciBjbCA9IHZvaWQgMDtcbnZhciBhdmFpbGFibGVEZXZpY2VzID0gbnVsbDtcbnZhciBhdmFpbGFibGVEZXZpY2VzRGVzY3JpcHRpb25zID0gbnVsbDtcbnZhciBkZWZhdWx0RGV2aWNlSW5kZXggPSAtMTtcblxuLyoqXG4gKiBJZiB0aGUgZ2xvYmFsIGNsIHZhcmlhYmxlIGlzIHVuZGVmaW5lZCwgdGhpcyBtZXRob2Qgd291bGQgaW5pdGlhbGl6ZSBpdCB3aXRoIGEgV2ViQ0wgaW5zdGFuY2UuXG4gKiBXb3JrcyBmb3IgYm90aCBicm93c2VyIGFuZCBOb2RlLmpzXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgaW5pdFdlYkNMXG4gKiBAcmV0dXJuIHtXZWJDTH0gLSBhbiBpbnN0YW5jZSBvZiBXZWJDTCBvYmplY3QgZnJvbSBXZWJDTCBzcGVjaWZpY2F0aW9uLiBJZiBXZWJDTCBpcyBub3Qgc3VwcG9ydGVkLCByZXR1cm4gbnVsbC5cbiAqL1xudmFyIGluaXRXZWJDTCA9IGZ1bmN0aW9uKCkge1xuXHRpZiAodHlwZW9mIGNsID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0aWYgKHR5cGVvZiB3aW5kb3cgPT09IFwib2JqZWN0XCIpIHtcblx0XHRcdGNsID0gd2luZG93LndlYmNsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjbCA9IHJlcXVpcmUoXCJub2RlLXdlYmNsXCIpO1xuXHRcdFx0XHRpc05vZGVXZWJDTCA9IHRydWU7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGNsID0gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIGNsO1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGVtcHR5IFdlYkNMRXZlbnQuXG4gKiBXb3JrcyBmb3IgYm90aCBicm93c2VyIGFuZCBOb2RlLmpzXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgY3JlYXRlRXZlbnRcbiAqIEByZXR1cm4ge1dlYkNMRXZlbnR9IC0gYW4gZW1wdHkgaW5zdGFuY2Ugb2YgV2ViQ0xFdmVudC5cbiAqL1xudmFyIGNyZWF0ZUV2ZW50ID0gZnVuY3Rpb24oKSB7XG5cdGlmIChpc05vZGVXZWJDTCkge1xuXHRcdHJldHVybiBuZXcgY2wuV2ViQ0xFdmVudCgpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBuZXcgV2ViQ0xFdmVudCgpO1xuXHR9XG59O1xuXG4vKipcbiAqIFRyaWVzIHRvIHJlbGVhc2UgYSBXZWJDTCByZXNvdXJjZSBhbmQgaWdub3JlcyBhbnkgZXJyb3JzIGluIHRoZSBwcm9jZXNzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAbWV0aG9kIHRyeVJsZWFzZVxuICogQHBhcmFtIHtPYmplY3R9IHdlYmNsT2JqZWN0IC0gYSBXZWJDTCBvYmplY3QuXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaWYgdGhlIG9iamVjdCB3YXMgc3VjY2Vzc2Z1bGx5IHJlbGVhc2VkIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gKi9cbnZhciB0cnlSZWxlYXNlID0gZnVuY3Rpb24od2ViY2xSZXNvdXJjZSkge1xuXHRpZiAod2ViY2xSZXNvdXJjZSAhPT0gbnVsbCkge1xuXHRcdHRyeSB7XG5cdFx0XHR3ZWJjbFJlc291cmNlLnJlbGVhc2UoKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8qIFNpbGVudGx5IGlnbm9yZSAqL1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gZmFsc2U7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiBhIFdlYkNMIGRldmljZSBzdXBwb3J0cyBLSFJfZnA2NCBleHRlbnNpb24uXG4gKlxuICogQHByaXZhdGVcbiAqIEBtZXRob2QgaXNGUDY0Q2FwYWJsZVxuICogQHBhcmFtIHtXZWJDTERldmljZX0gZGV2aWNlIC0gdGhlIGRldmljZSB0byBjaGVjayBmb3IgS0hSX2ZwNjQgc3VwcG9ydC5cbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gdHJ1ZSBpZiB0aGUgZGV2aWNlIHN1cHBvcnRzIEtIUl9mcDY0IGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gKi9cbnZhciBpc0ZQNjRDYXBhYmxlID0gZnVuY3Rpb24oZGV2aWNlKSB7XG5cdHZhciBleHRlbnNpb25zID0gZGV2aWNlLmdldFN1cHBvcnRlZEV4dGVuc2lvbnMoKTtcblx0aWYgKGV4dGVuc2lvbnMuaW5kZXhPZihcIktIUl9mcDY0XCIpID09PSAtMSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHQvKlxuXHQgKiBEdWUgdG8gYSBidWcgV2ViS2l0LVdlYkNMIG1heSByZXBvcnQgS0hSX2ZwNjQgZXZlbiBpZiBpdCBpcyBub3Qgc3VwcG9ydGVkIGJ5IHRoZSB1bmRlcmx5aW5nIE9wZW5DTCBkZXZpY2UuXG5cdCAqIFNlZSBidWcgaHR0cHM6Ly9naXRodWIuY29tL1NSQS1TaWxpY29uVmFsbGV5L3dlYmtpdC13ZWJjbC9pc3N1ZXMvNTM2XG5cdCAqL1xuXHR2YXIgdGVzdFNvdXJjZSA9IFwia2VybmVsIHZvaWQgZm9vKGdsb2JhbCBkb3VibGUqIGJhcikgeyB9XCI7XG5cdHZhciBjb250ZXh0ID0gbnVsbCwgcHJvZ3JhbSA9IG51bGw7XG5cdHRyeSB7XG5cdFx0Y29udGV4dCA9IGNsLmNyZWF0ZUNvbnRleHQoZGV2aWNlKTtcblx0XHRwcm9ncmFtID0gY29udGV4dC5jcmVhdGVQcm9ncmFtKHRlc3RTb3VyY2UpO1xuXHRcdHByb2dyYW0uYnVpbGQoKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fSBmaW5hbGx5IHtcblx0XHR0cnlSZWxlYXNlKHByb2dyYW0pO1xuXHRcdHRyeVJlbGVhc2UoY29udGV4dCk7XG5cdH1cbn07XG5cbi8qKlxuICogSW5pdGlhbGlzZXMgYW5kIHJldHVybnMgYSBsaXN0IG9mIFdlYkNMIGRldmljZXMgc3VpdGFibGUgZm9yIGNvbXB1dGF0aW9uLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGdldEF2YWlsYWJsZURldmljZXNcbiAqIEByZXR1cm4ge1dlYkNMRGV2aWNlW119IC0gYSBsaXN0IG9mIEdQVSBhbmQgQ1BVIFdlYkNMIGRldmljZXMgdGhhdCBzdXBwb3J0IEtIUl9GUDY0IChtYXkgYmUgZW1wdHkpLlxuICovXG52YXIgZ2V0QXZhaWxhYmxlRGV2aWNlcyA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoYXZhaWxhYmxlRGV2aWNlcyA9PT0gbnVsbCkge1xuXHRcdGF2YWlsYWJsZURldmljZXMgPSBbXTtcblx0XHR2YXIgd2ViY2wgPSBpbml0V2ViQ0woKTtcblx0XHRpZiAod2ViY2wgIT09IG51bGwpIHtcblx0XHRcdHZhciBwbGF0Zm9ybXMgPSBjbC5nZXRQbGF0Zm9ybXMoKTtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcGxhdGZvcm1zLmxlbmd0aDsgKytpKSB7XG5cdFx0XHRcdHZhciBwbGF0Zm9ybSA9IHBsYXRmb3Jtc1tpXTtcblx0XHRcdFx0dmFyIGRldmljZXMgPSBwbGF0Zm9ybS5nZXREZXZpY2VzKGNsLkRFVklDRV9UWVBFX0FMTCk7XG5cdFx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgZGV2aWNlcy5sZW5ndGg7ICsraikge1xuXHRcdFx0XHRcdHZhciBkZXZpY2UgPSBkZXZpY2VzW2pdO1xuXHRcdFx0XHRcdGlmIChpc0ZQNjRDYXBhYmxlKGRldmljZSkpIHtcblx0XHRcdFx0XHRcdGF2YWlsYWJsZURldmljZXMucHVzaChkZXZpY2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRnZW5lcmF0ZUF2YWlsYWJsZURldmljZXNEZXNjcmlwdGlvbnMoKTtcblx0fVxuXHRyZXR1cm4gYXZhaWxhYmxlRGV2aWNlcztcbn07XG5cbnZhciBnZW5lcmF0ZUF2YWlsYWJsZURldmljZXNEZXNjcmlwdGlvbnMgPSBmdW5jdGlvbigpIHtcblx0YXZhaWxhYmxlRGV2aWNlc0Rlc2NyaXB0aW9ucyA9IFtdO1xuXHQvKiBJZiBkZXZpY2VzIG5hbWVzIGFyZSBhdmFpbGFibGUsIHVzZSB0aGVtICovXG5cdHZhciBoYXZlTmFtZXMgPSB0cnVlO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IGF2YWlsYWJsZURldmljZXMubGVuZ3RoOyArK2kpIHtcblx0XHR2YXIgZGV2aWNlID0gYXZhaWxhYmxlRGV2aWNlc1tpXTtcblx0XHR2YXIgbmFtZSA9IGRldmljZS5nZXRJbmZvKGNsLkRFVklDRV9OQU1FKTtcblx0XHRpZiAoKG5hbWUgPT09IG51bGwpIHx8IChuYW1lID09PSBcIlwiKSkge1xuXHRcdFx0aGF2ZU5hbWVzID0gZmFsc2U7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0YXZhaWxhYmxlRGV2aWNlc0Rlc2NyaXB0aW9uc1tpXSA9IG5hbWU7XG5cdH1cblx0aWYgKCFoYXZlTmFtZXMpIHtcblx0XHQvKiBBdCBsZWFzdCBzb21lIG5hbWVzIGFyZSBub3QgYXZhaWxhYmxlOiB0cnkgdG8gYXNzaWduIG5hbWVzIGJhc2VkIG9uIGNsYXNzaWZpY2F0aW9uIChlLmcuIFwiQ1BVXCIsIFwiZEdQVVwiLCBcImlHUFVcIikgKi9cblx0XHR2YXIgY3B1Q291bnQgPSAwLCBpZ3B1Q291bnQgPSAwLCBkZ3B1Q291bnQgPSAwO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXZhaWxhYmxlRGV2aWNlcy5sZW5ndGg7ICsraSkge1xuXHRcdFx0dmFyIGRldmljZSA9IGF2YWlsYWJsZURldmljZXNbaV07XG5cdFx0XHR2YXIgY2xhc3NpZmljYXRpb24gPSBjbGFzc2lmeURldmljZShkZXZpY2UpO1xuXHRcdFx0aWYgKGNsYXNzaWZpY2F0aW9uID09PSBcImNwdVwiKSB7XG5cdFx0XHRcdCsrY3B1Q291bnQ7XG5cdFx0XHRcdGF2YWlsYWJsZURldmljZXNEZXNjcmlwdGlvbnNbaV0gPSBcIkNQVVwiO1xuXHRcdFx0fSBlbHNlIGlmIChjbGFzc2lmaWNhdGlvbiA9PT0gXCJpZ3B1XCIpIHtcblx0XHRcdFx0KytpZ3B1Q291bnQ7XG5cdFx0XHRcdGF2YWlsYWJsZURldmljZXNEZXNjcmlwdGlvbnNbaV0gPSBcImlHUFVcIjtcblx0XHRcdH0gZWxzZSBpZiAoY2xhc3NpZmljYXRpb24gPT09IFwiZGdwdVwiKSB7XG5cdFx0XHRcdCsrZGdwdUNvdW50O1xuXHRcdFx0XHRhdmFpbGFibGVEZXZpY2VzRGVzY3JpcHRpb25zW2ldID0gXCJkR1BVXCI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJJbXBvc3NpYmxlIGRldmljZSBjbGFzc2lmaWNhdGlvbjogXCIgKyBjbGFzc2lmaWNhdGlvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICgoY3B1Q291bnQgPiAxKSB8fCAoaWdwdUNvdW50ID4gMSkgfHwgKGRncHVDb3VudCA+IDEpKSB7XG5cdFx0XHQvKiBXZSBoYXZlIG11bHRpcGxlIGRldmljZXMgb2YgdGhlIHNhbWUgdHlwZS4gTmVlZCB0byB1c2UgbW9yZSBjb21wbGljYXRlZCBuYW1pbmcgc2NoZW1lICovXG5cdFx0XHR2YXIgY3B1SW5kZXggPSAwLCBpZ3B1SW5kZXggPSAwLCBkZ3B1SW5kZXggPSAwO1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhdmFpbGFibGVEZXZpY2VzLmxlbmd0aDsgKytpKSB7XG5cdFx0XHRcdHZhciBkZXZpY2UgPSBhdmFpbGFibGVEZXZpY2VzW2ldO1xuXHRcdFx0XHR2YXIgY2xhc3NpZmljYXRpb24gPSBjbGFzc2lmeURldmljZShkZXZpY2UpO1xuXHRcdFx0XHRpZiAoY2xhc3NpZmljYXRpb24gPT09IFwiY3B1XCIpIHtcblx0XHRcdFx0XHRpZiAoY3B1Q291bnQgPiAxKSB7XG5cdFx0XHRcdFx0XHQrK2NwdUluZGV4O1xuXHRcdFx0XHRcdFx0YXZhaWxhYmxlRGV2aWNlc0Rlc2NyaXB0aW9uc1tpXSA9IFwiQ1BVICNcIiArIGNwdUluZGV4O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChjbGFzc2lmaWNhdGlvbiA9PT0gXCJpZ3B1XCIpIHtcblx0XHRcdFx0XHRpZiAoaWdwdUNvdW50ID4gMSkge1xuXHRcdFx0XHRcdFx0KytpZ3B1SW5kZXg7XG5cdFx0XHRcdFx0XHRhdmFpbGFibGVEZXZpY2VzRGVzY3JpcHRpb25zW2ldID0gXCJpR1BVICNcIiArIGlncHVJbmRleDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoY2xhc3NpZmljYXRpb24gPT09IFwiZGdwdVwiKSB7XG5cdFx0XHRcdFx0aWYgKGRncHVDb3VudCA+IDEpIHtcblx0XHRcdFx0XHRcdCsrZGdwdUNvdW50O1xuXHRcdFx0XHRcdFx0YXZhaWxhYmxlRGV2aWNlc0Rlc2NyaXB0aW9uc1tpXSA9IFwiZEdQVSAjXCIgKyBkZ3B1SW5kZXg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihcIkltcG9zc2libGUgZGV2aWNlIGNsYXNzaWZpY2F0aW9uOiBcIiArIGNsYXNzaWZpY2F0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufTtcblxuLyoqXG4gKiBDbGFzc2lmaWVzIFdlYkNMIGRldmljZSB0byBvbmUgb2YgZm91ciBjYXRlZ29yaWVzOlxuICogLSBcImNwdVwiIGZvciBDUFUgZGV2aWNlcy5cbiAqIC0gXCJpZ3B1XCIgZm9yIEdQVXMgaW50ZWdyYXRlZCB3aXRoIENQVSBwYWNrYWdlIG9yIGNoaXBzZXQuXG4gKiAtIFwiZGdwdVwiIGZvciBkaXNjcmV0ZSBHUFVzLlxuICogLSBcInVua25vd25cIiBmb3Igb3RoZXIgdHlwZXMgb2YgZGV2aWNlcyAoZS5nLiBGUEdBcylcbiAqXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBjbGFzc2lmeURldmljZVxuICogQHBhcmFtIHtXZWJDTERldmljZX0gZGV2aWNlIC0gdGhlIFdlYkNMIGRldmljZSB0byBjbGFzc2lmeS5cbiAqIEByZXR1cm4ge1N0cmluZ30gLSBvbmUgb2YgdGhlIHN0cmluZ3MgZGVzY3JpYmVkIGFib3ZlLlxuICovXG52YXIgY2xhc3NpZnlEZXZpY2UgPSBmdW5jdGlvbihkZXZpY2UpIHtcblx0dHJ5IHtcblx0XHR2YXIgZGV2aWNlVHlwZSA9IGRldmljZS5nZXRJbmZvKGNsLkRFVklDRV9UWVBFKTtcblx0XHRpZiAoZGV2aWNlVHlwZSA9PT0gY2wuREVWSUNFX1RZUEVfQ1BVKSB7XG5cdFx0XHRyZXR1cm4gXCJjcHVcIjtcblx0XHR9IGVsc2UgaWYgKGRldmljZVR5cGUgPT09IGNsLkRFVklDRV9UWVBFX0dQVSkge1xuXHRcdFx0dmFyIGlzSG9zdFVuaWZpZWRNZW1vcnkgPSBkZXZpY2UuZ2V0SW5mbyhjbC5ERVZJQ0VfSE9TVF9VTklGSUVEX01FTU9SWSk7XG5cdFx0XHRyZXR1cm4gKGlzSG9zdFVuaWZpZWRNZW1vcnkgPyBcImlncHVcIiA6IFwiZGdwdVwiKTtcblx0XHR9XG5cdH0gY2F0Y2ggKGUpIHtcblx0fVxuXHRyZXR1cm4gXCJ1bmtub3duXCI7XG59O1xuXG4vKipcbiAqIFNlbGVjdHMgdGhlIG9wdGltYWwgV2ViQ0wgZGV2aWNlIGFtb25nIHRoZSBhdmFpbGFibGUgZGV2aWNlcy5cbiAqIFRoZSBwcmlvcml0eSBvZiBkZXZpY2VzOiBcImRncHVcIiA+IFwiaWdwdVwiID4gXCJjcHVcIlxuICpcbiAqIEBwcml2YXRlXG4gKiBAbWV0aG9kIGdldERlZmF1bHREZXZpY2VJbmRleFxuICogQHJldHVybiB7V2ViQ0xEZXZpY2V9IC0gdGhlIHNlbGVjdGVkIGRldmljZSBmcm9tIHRoZSBsaXN0LlxuICovXG52YXIgZ2V0RGVmYXVsdERldmljZUluZGV4ID0gZnVuY3Rpb24oKSB7XG5cdGlmIChkZWZhdWx0RGV2aWNlSW5kZXggPT09IC0xKSB7XG5cdFx0dmFyIGF2YWlsYWJsZURldmljZXMgPSBnZXRBdmFpbGFibGVEZXZpY2VzKCk7XG5cdFx0aWYgKGF2YWlsYWJsZURldmljZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRkZWZhdWx0RGV2aWNlSW5kZXggPSAtMjtcblx0XHRcdHJldHVybiBkZWZhdWx0RGV2aWNlSW5kZXg7XG5cdFx0fVxuXHRcdHZhciBkZXZpY2VDbGFzc2lmaWNhdGlvbnMgPSBbXTtcblx0XHQvKiBTZWFyY2ggZm9yIFwiZGdwdVwiICovXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhdmFpbGFibGVEZXZpY2VzLmxlbmd0aDsgKytpKSB7XG5cdFx0XHR2YXIgZGV2aWNlID0gYXZhaWxhYmxlRGV2aWNlc1tpXTtcblx0XHRcdHZhciBkZXZpY2VDbGFzcyA9IGNsYXNzaWZ5RGV2aWNlKGRldmljZSk7XG5cdFx0XHRpZiAoZGV2aWNlQ2xhc3MgPT09IFwiZGdwdVwiKSB7XG5cdFx0XHRcdGRlZmF1bHREZXZpY2VJbmRleCA9IGk7XG5cdFx0XHRcdHJldHVybiBpO1xuXHRcdFx0fVxuXHRcdFx0ZGV2aWNlQ2xhc3NpZmljYXRpb25zLnB1c2goZGV2aWNlQ2xhc3MpO1xuXHRcdH1cblx0XHQvKiBTZWFyY2ggZm9yIFwiaWdwdVwiICovXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhdmFpbGFibGVEZXZpY2VzLmxlbmd0aDsgKytpKSB7XG5cdFx0XHRpZiAoZGV2aWNlQ2xhc3NpZmljYXRpb25zW2ldID09PSBcImlncHVcIikge1xuXHRcdFx0XHRkZWZhdWx0RGV2aWNlSW5kZXggPSBpO1xuXHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdH1cblx0XHR9XG5cdFx0LyogU2VhcmNoIGZvciBcImNwdVwiICovXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhdmFpbGFibGVEZXZpY2VzLmxlbmd0aDsgKytpKSB7XG5cdFx0XHRpZiAoZGV2aWNlQ2xhc3NpZmljYXRpb25zW2ldID09PSBcImNwdVwiKSB7XG5cdFx0XHRcdGRlZmF1bHREZXZpY2VJbmRleCA9IGk7XG5cdFx0XHRcdHJldHVybiBpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gZGVmYXVsdERldmljZUluZGV4O1xufTtcblxudmFyIGNyZWF0ZUtlcm5lbHMgPSBmdW5jdGlvbihwcm9ncmFtKSB7XG5cdHZhciBrZXJuZWxzID0ge1xuXHRcdHNldDoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInNldF9mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic2V0X2Y2NFwiKVxuXHRcdH0sXG5cdFx0bGluc3BhY2U6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJsaW5zcGFjZV9mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibGluc3BhY2VfZjY0XCIpXG5cdFx0fSxcblx0XHRyZXBlYXQ6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJyZXBlYXRfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInJlcGVhdF9mNjRcIilcblx0XHR9LFxuXHRcdGFkZDoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFkZF9mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiYWRkX2Y2NFwiKVxuXHRcdH0sXG5cdFx0c3ViOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3ViX2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJzdWJfZjY0XCIpXG5cdFx0fSxcblx0XHRtdWw6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJtdWxfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcIm11bF9mNjRcIilcblx0XHR9LFxuXHRcdGRpdjoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImRpdl9mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiZGl2X2Y2NFwiKVxuXHRcdH0sXG5cdFx0YWRkYzoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFkZGNfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFkZGNfZjY0XCIpXG5cdFx0fSxcblx0XHRzdWJjOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3ViY19mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3ViY19mNjRcIilcblx0XHR9LFxuXHRcdHN1YnJjOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3VicmNfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInN1YnJjX2Y2NFwiKVxuXHRcdH0sXG5cdFx0bXVsYzoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcIm11bGNfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcIm11bGNfZjY0XCIpXG5cdFx0fSxcblx0XHRkaXZjOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiZGl2Y19mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiZGl2Y19mNjRcIilcblx0XHR9LFxuXHRcdGRpdnJjOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiZGl2cmNfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImRpdnJjX2Y2NFwiKVxuXHRcdH0sXG5cdFx0bmVnOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibmVnX2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJuZWdfZjY0XCIpXG5cdFx0fSxcblx0XHRhYnM6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhYnNfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFic19mNjRcIilcblx0XHR9LFxuXHRcdGV4cDoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImV4cF9mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiZXhwX2Y2NFwiKVxuXHRcdH0sXG5cdFx0bG9nOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibG9nX2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJsb2dfZjY0XCIpXG5cdFx0fSxcblx0XHRzcXJ0OiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3FydF9mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3FydF9mNjRcIilcblx0XHR9LFxuXHRcdHNxdWFyZToge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInNxdWFyZV9mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3F1YXJlX2Y2NFwiKVxuXHRcdH0sXG5cdFx0c3VtOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3VtX2YzMl9ncHVcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3VtX2Y2NF9ncHVcIilcblx0XHR9LFxuXHRcdG1pbjoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcIm1pbl9mMzJfZ3B1XCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcIm1pbl9mNjRfZ3B1XCIpXG5cdFx0fSxcblx0XHRtYXg6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJtYXhfZjMyX2dwdVwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJtYXhfZjY0X2dwdVwiKVxuXHRcdH0sXG5cdFx0YXN1bToge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFzdW1fZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFzdW1fZjY0XCIpXG5cdFx0fSxcblx0XHRhbWluOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiYW1pbl9mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiYW1pbl9mNjRcIilcblx0XHR9LFxuXHRcdGFtYXg6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhbWF4X2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhbWF4X2Y2NFwiKVxuXHRcdH0sXG5cdFx0ZG90OiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiZG90X2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJkb3RfZjY0XCIpXG5cdFx0fVxuXHR9O1xuXHRyZXR1cm4ga2VybmVscztcbn07XG5cbmZ1bmN0aW9uIFdlYkNMQ29udGV4dChvcHRpb25zLCBjYWxsYmFjaykge1xuXHRpbml0V2ViQ0woKTtcblx0dmFyIGJpbmFyeUtlcm5lbHNTb3VyY2UgPSBcImtlcm5lbCB2b2lkIGFkZF9mMzIoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGdsb2JhbCBmbG9hdCogYixcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdICsgYltpZF07XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBhZGRfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYixcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSArIGJbaWRdO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgc3ViX2YzMihcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0Z2xvYmFsIGZsb2F0KiBiLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gLSBiW2lkXTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIHN1Yl9mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRnbG9iYWwgZG91YmxlKiBiLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdIC0gYltpZF07XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBtdWxfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRnbG9iYWwgZmxvYXQqIGIsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSAqIGJbaWRdO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgbXVsX2Y2NChcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGdsb2JhbCBkb3VibGUqIGIsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gKiBiW2lkXTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIGRpdl9mMzIoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGdsb2JhbCBmbG9hdCogYixcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdIC8gYltpZF07XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBkaXZfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYixcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSAvIGJbaWRdO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgYWRkY19mMzIoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGZsb2F0IGIsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSArIGI7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBhZGRjX2Y2NChcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGRvdWJsZSBiLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdICsgYjtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIHN1YmNfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRmbG9hdCBiLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gLSBiO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgc3ViY19mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRkb3VibGUgYixcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSAtIGI7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBzdWJyY19mMzIoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGZsb2F0IGIsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBiIC8gYVtpZF07XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBzdWJyY19mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRkb3VibGUgYixcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBiIC8gYVtpZF07XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBtdWxjX2YzMihcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0ZmxvYXQgYixcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdICogYjtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIG11bGNfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0ZG91YmxlIGIsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gKiBiO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgZGl2Y19mMzIoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGZsb2F0IGIsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSAvIGI7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBkaXZjX2Y2NChcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGRvdWJsZSBiLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdIC8gYjtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIGRpdnJjX2YzMihcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0ZmxvYXQgYixcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGIgLyBhW2lkXTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIGRpdnJjX2Y2NChcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGRvdWJsZSBiLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGIgLyBhW2lkXTtcXG5cXHR9XFxufVxcblwiO1xuXHR2YXIgdW5hcnlLZXJuZWxzU291cmNlID0gXCJrZXJuZWwgdm9pZCBuZWdfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IC1hW2lkXTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIG5lZ19mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSAtYVtpZF07XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBhYnNfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGZhYnMoYVtpZF0pO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgYWJzX2Y2NChcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGZhYnMoYVtpZF0pO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgZXhwX2YzMihcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBleHAoYVtpZF0pO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgZXhwX2Y2NChcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGV4cChhW2lkXSk7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBsb2dfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGxvZyhhW2lkXSk7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBsb2dfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gbG9nKGFbaWRdKTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIHNxcnRfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IHNxcnQoYVtpZF0pO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgc3FydF9mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBzcXJ0KGFbaWRdKTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIHNxdWFyZV9mMzIoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRjb25zdCBmbG9hdCBhVmFsID0gYVtpZF07IFxcblxcdFxcdG91dFtpZF0gPSBhVmFsICogYVZhbDtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIHNxdWFyZV9mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdGNvbnN0IGRvdWJsZSBhVmFsID0gYVtpZF07XFxuXFx0XFx0b3V0W2lkXSA9IGFWYWwgKiBhVmFsO1xcblxcdH1cXG59XFxuXCI7XG5cdHZhciByZWR1Y3Rpb25LZXJuZWxzU291cmNlID0gXCJrZXJuZWwgdm9pZCBzdW1fZjMyX2dwdShcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0bG9jYWwgZmxvYXQqIHNjcmF0Y2gsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgZ2xvYmFsU2l6ZSA9IGdldF9nbG9iYWxfc2l6ZSgwKTtcXG5cXHR1aW50IGdsb2JhbEluZGV4ID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRmbG9hdCBhY2N1bXVsYXRvciA9IDAuMGY7XFxuXFx0d2hpbGUgKGdsb2JhbEluZGV4IDwgbGVuZ3RoKSB7XFxuXFx0XFx0YWNjdW11bGF0b3IgKz0gYVtnbG9iYWxJbmRleF07XFxuXFx0XFx0Z2xvYmFsSW5kZXggKz0gZ2xvYmFsU2l6ZTtcXG5cXHR9XFxuXFxuXFx0dWludCBsb2NhbEluZGV4ID0gZ2V0X2xvY2FsX2lkKDApO1xcblxcdHNjcmF0Y2hbbG9jYWxJbmRleF0gPSBhY2N1bXVsYXRvcjtcXG5cXHRiYXJyaWVyKENMS19MT0NBTF9NRU1fRkVOQ0UpO1xcblxcdGZvciAodWludCBvZmZzZXQgPSBnZXRfbG9jYWxfc2l6ZSgwKSAvIDI7IG9mZnNldCAhPSAwOyBvZmZzZXQgPj49IDEpIHtcXG5cXHRcXHRpZiAobG9jYWxJbmRleCA8IG9mZnNldCkge1xcblxcdFxcdFxcdHNjcmF0Y2hbbG9jYWxJbmRleF0gKz0gc2NyYXRjaFtsb2NhbEluZGV4ICsgb2Zmc2V0XTtcXG5cXHRcXHR9XFxuXFx0XFx0YmFycmllcihDTEtfTE9DQUxfTUVNX0ZFTkNFKTtcXG5cXHR9XFxuXFx0aWYgKGxvY2FsSW5kZXggPT0gMCkge1xcblxcdFxcdG91dFtnZXRfZ3JvdXBfaWQoMCldID0gc2NyYXRjaFswXTtcXG5cXHR9XFxufVxcblxcbmtlcm5lbCB2b2lkIHN1bV9mNjRfZ3B1KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0bG9jYWwgZG91YmxlKiBzY3JhdGNoLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBnbG9iYWxTaXplID0gZ2V0X2dsb2JhbF9zaXplKDApO1xcblxcdHVpbnQgZ2xvYmFsSW5kZXggPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGRvdWJsZSBhY2N1bXVsYXRvciA9IDAuMDtcXG5cXHR3aGlsZSAoZ2xvYmFsSW5kZXggPCBsZW5ndGgpIHtcXG5cXHRcXHRhY2N1bXVsYXRvciArPSBhW2dsb2JhbEluZGV4XTtcXG5cXHRcXHRnbG9iYWxJbmRleCArPSBnbG9iYWxTaXplO1xcblxcdH1cXG5cXG5cXHR1aW50IGxvY2FsSW5kZXggPSBnZXRfbG9jYWxfaWQoMCk7XFxuXFx0c2NyYXRjaFtsb2NhbEluZGV4XSA9IGFjY3VtdWxhdG9yO1xcblxcdGJhcnJpZXIoQ0xLX0xPQ0FMX01FTV9GRU5DRSk7XFxuXFx0Zm9yICh1aW50IG9mZnNldCA9IGdldF9sb2NhbF9zaXplKDApIC8gMjsgb2Zmc2V0ICE9IDA7IG9mZnNldCA+Pj0gMSkge1xcblxcdFxcdGlmIChsb2NhbEluZGV4IDwgb2Zmc2V0KSB7XFxuXFx0XFx0XFx0c2NyYXRjaFtsb2NhbEluZGV4XSArPSBzY3JhdGNoW2xvY2FsSW5kZXggKyBvZmZzZXRdO1xcblxcdFxcdH1cXG5cXHRcXHRiYXJyaWVyKENMS19MT0NBTF9NRU1fRkVOQ0UpO1xcblxcdH1cXG5cXHRpZiAobG9jYWxJbmRleCA9PSAwKSB7XFxuXFx0XFx0b3V0W2dldF9ncm91cF9pZCgwKV0gPSBzY3JhdGNoWzBdO1xcblxcdH1cXG59XFxuXFxua2VybmVsIHZvaWQgbWluX2YzMl9ncHUoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGxvY2FsIGZsb2F0KiBzY3JhdGNoLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGdsb2JhbFNpemUgPSBnZXRfZ2xvYmFsX3NpemUoMCk7XFxuXFx0dWludCBnbG9iYWxJbmRleCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0ZmxvYXQgYWNjdW11bGF0b3IgPSBJTkZJTklUWTtcXG5cXHR3aGlsZSAoZ2xvYmFsSW5kZXggPCBsZW5ndGgpIHtcXG5cXHRcXHRhY2N1bXVsYXRvciA9IG1pbihhY2N1bXVsYXRvciwgYVtnbG9iYWxJbmRleF0pO1xcblxcdFxcdGdsb2JhbEluZGV4ICs9IGdsb2JhbFNpemU7XFxuXFx0fVxcblxcblxcdHVpbnQgbG9jYWxJbmRleCA9IGdldF9sb2NhbF9pZCgwKTtcXG5cXHRzY3JhdGNoW2xvY2FsSW5kZXhdID0gYWNjdW11bGF0b3I7XFxuXFx0YmFycmllcihDTEtfTE9DQUxfTUVNX0ZFTkNFKTtcXG5cXHRmb3IgKHVpbnQgb2Zmc2V0ID0gZ2V0X2xvY2FsX3NpemUoMCkgLyAyOyBvZmZzZXQgIT0gMDsgb2Zmc2V0ID4+PSAxKSB7XFxuXFx0XFx0aWYgKGxvY2FsSW5kZXggPCBvZmZzZXQpIHtcXG5cXHRcXHRcXHRzY3JhdGNoW2xvY2FsSW5kZXhdID0gbWluKHNjcmF0Y2hbbG9jYWxJbmRleF0sIHNjcmF0Y2hbbG9jYWxJbmRleCArIG9mZnNldF0pO1xcblxcdFxcdH1cXG5cXHRcXHRiYXJyaWVyKENMS19MT0NBTF9NRU1fRkVOQ0UpO1xcblxcdH1cXG5cXHRpZiAobG9jYWxJbmRleCA9PSAwKSB7XFxuXFx0XFx0b3V0W2dldF9ncm91cF9pZCgwKV0gPSBzY3JhdGNoWzBdO1xcblxcdH1cXG59XFxuXFxua2VybmVsIHZvaWQgbWluX2Y2NF9ncHUoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRsb2NhbCBkb3VibGUqIHNjcmF0Y2gsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGdsb2JhbFNpemUgPSBnZXRfZ2xvYmFsX3NpemUoMCk7XFxuXFx0dWludCBnbG9iYWxJbmRleCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0ZG91YmxlIGFjY3VtdWxhdG9yID0gSU5GSU5JVFk7XFxuXFx0d2hpbGUgKGdsb2JhbEluZGV4IDwgbGVuZ3RoKSB7XFxuXFx0XFx0YWNjdW11bGF0b3IgPSBtaW4oYWNjdW11bGF0b3IsIGFbZ2xvYmFsSW5kZXhdKTtcXG5cXHRcXHRnbG9iYWxJbmRleCArPSBnbG9iYWxTaXplO1xcblxcdH1cXG5cXG5cXHR1aW50IGxvY2FsSW5kZXggPSBnZXRfbG9jYWxfaWQoMCk7XFxuXFx0c2NyYXRjaFtsb2NhbEluZGV4XSA9IGFjY3VtdWxhdG9yO1xcblxcdGJhcnJpZXIoQ0xLX0xPQ0FMX01FTV9GRU5DRSk7XFxuXFx0Zm9yICh1aW50IG9mZnNldCA9IGdldF9sb2NhbF9zaXplKDApIC8gMjsgb2Zmc2V0ICE9IDA7IG9mZnNldCA+Pj0gMSkge1xcblxcdFxcdGlmIChsb2NhbEluZGV4IDwgb2Zmc2V0KSB7XFxuXFx0XFx0XFx0c2NyYXRjaFtsb2NhbEluZGV4XSA9IG1pbihzY3JhdGNoW2xvY2FsSW5kZXhdLCBzY3JhdGNoW2xvY2FsSW5kZXggKyBvZmZzZXRdKTtcXG5cXHRcXHR9XFxuXFx0XFx0YmFycmllcihDTEtfTE9DQUxfTUVNX0ZFTkNFKTtcXG5cXHR9XFxuXFx0aWYgKGxvY2FsSW5kZXggPT0gMCkge1xcblxcdFxcdG91dFtnZXRfZ3JvdXBfaWQoMCldID0gc2NyYXRjaFswXTtcXG5cXHR9XFxufVxcblxcbmtlcm5lbCB2b2lkIG1heF9mMzJfZ3B1KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRsb2NhbCBmbG9hdCogc2NyYXRjaCxcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBnbG9iYWxTaXplID0gZ2V0X2dsb2JhbF9zaXplKDApO1xcblxcdHVpbnQgZ2xvYmFsSW5kZXggPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGZsb2F0IGFjY3VtdWxhdG9yID0gLUlORklOSVRZO1xcblxcdHdoaWxlIChnbG9iYWxJbmRleCA8IGxlbmd0aCkge1xcblxcdFxcdGFjY3VtdWxhdG9yID0gbWF4KGFjY3VtdWxhdG9yLCBhW2dsb2JhbEluZGV4XSk7XFxuXFx0XFx0Z2xvYmFsSW5kZXggKz0gZ2xvYmFsU2l6ZTtcXG5cXHR9XFxuXFxuXFx0dWludCBsb2NhbEluZGV4ID0gZ2V0X2xvY2FsX2lkKDApO1xcblxcdHNjcmF0Y2hbbG9jYWxJbmRleF0gPSBhY2N1bXVsYXRvcjtcXG5cXHRiYXJyaWVyKENMS19MT0NBTF9NRU1fRkVOQ0UpO1xcblxcdGZvciAodWludCBvZmZzZXQgPSBnZXRfbG9jYWxfc2l6ZSgwKSAvIDI7IG9mZnNldCAhPSAwOyBvZmZzZXQgPj49IDEpIHtcXG5cXHRcXHRpZiAobG9jYWxJbmRleCA8IG9mZnNldCkge1xcblxcdFxcdFxcdHNjcmF0Y2hbbG9jYWxJbmRleF0gPSBtYXgoc2NyYXRjaFtsb2NhbEluZGV4XSwgc2NyYXRjaFtsb2NhbEluZGV4ICsgb2Zmc2V0XSk7XFxuXFx0XFx0fVxcblxcdFxcdGJhcnJpZXIoQ0xLX0xPQ0FMX01FTV9GRU5DRSk7XFxuXFx0fVxcblxcdGlmIChsb2NhbEluZGV4ID09IDApIHtcXG5cXHRcXHRvdXRbZ2V0X2dyb3VwX2lkKDApXSA9IHNjcmF0Y2hbMF07XFxuXFx0fVxcbn1cXG5cXG5rZXJuZWwgdm9pZCBtYXhfZjY0X2dwdShcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGxvY2FsIGRvdWJsZSogc2NyYXRjaCxcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgZ2xvYmFsU2l6ZSA9IGdldF9nbG9iYWxfc2l6ZSgwKTtcXG5cXHR1aW50IGdsb2JhbEluZGV4ID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRkb3VibGUgYWNjdW11bGF0b3IgPSAtSU5GSU5JVFk7XFxuXFx0d2hpbGUgKGdsb2JhbEluZGV4IDwgbGVuZ3RoKSB7XFxuXFx0XFx0YWNjdW11bGF0b3IgPSBtYXgoYWNjdW11bGF0b3IsIGFbZ2xvYmFsSW5kZXhdKTtcXG5cXHRcXHRnbG9iYWxJbmRleCArPSBnbG9iYWxTaXplO1xcblxcdH1cXG5cXG5cXHR1aW50IGxvY2FsSW5kZXggPSBnZXRfbG9jYWxfaWQoMCk7XFxuXFx0c2NyYXRjaFtsb2NhbEluZGV4XSA9IGFjY3VtdWxhdG9yO1xcblxcdGJhcnJpZXIoQ0xLX0xPQ0FMX01FTV9GRU5DRSk7XFxuXFx0Zm9yICh1aW50IG9mZnNldCA9IGdldF9sb2NhbF9zaXplKDApIC8gMjsgb2Zmc2V0ICE9IDA7IG9mZnNldCA+Pj0gMSkge1xcblxcdFxcdGlmIChsb2NhbEluZGV4IDwgb2Zmc2V0KSB7XFxuXFx0XFx0XFx0c2NyYXRjaFtsb2NhbEluZGV4XSA9IG1heChzY3JhdGNoW2xvY2FsSW5kZXhdLCBzY3JhdGNoW2xvY2FsSW5kZXggKyBvZmZzZXRdKTtcXG5cXHRcXHR9XFxuXFx0XFx0YmFycmllcihDTEtfTE9DQUxfTUVNX0ZFTkNFKTtcXG5cXHR9XFxuXFx0aWYgKGxvY2FsSW5kZXggPT0gMCkge1xcblxcdFxcdG91dFtnZXRfZ3JvdXBfaWQoMCldID0gc2NyYXRjaFswXTtcXG5cXHR9XFxufVxcblwiO1xuXHR2YXIgYXhpc1JlZHVjdGlvbktlcm5lbHNTb3VyY2UgPSBcImtlcm5lbCB2b2lkIGFzdW1fZjMyKFxcblxcdHVpbnQgcmVkdWN0aW9uRGltLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpbm5lclN0cmlkZSA9IGdldF9nbG9iYWxfc2l6ZSgxKTtcXG5cXHRjb25zdCB1aW50IGkgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGNvbnN0IHVpbnQgayA9IGdldF9nbG9iYWxfaWQoMSk7XFxuXFx0YSArPSBpICogcmVkdWN0aW9uRGltICogaW5uZXJTdHJpZGUgKyBrO1xcblxcdGZsb2F0IGFjY3VtdWxhdG9yID0gKmE7XFxuXFx0d2hpbGUgKC0tcmVkdWN0aW9uRGltKSB7XFxuXFx0XFx0YSArPSBpbm5lclN0cmlkZTtcXG5cXHRcXHRhY2N1bXVsYXRvciArPSAqYTtcXG5cXHR9XFxuXFx0b3V0W2kgKiBpbm5lclN0cmlkZSArIGtdID0gYWNjdW11bGF0b3I7XFxufVxcblxcbmtlcm5lbCB2b2lkIGFzdW1fZjY0KFxcblxcdHVpbnQgcmVkdWN0aW9uRGltLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlubmVyU3RyaWRlID0gZ2V0X2dsb2JhbF9zaXplKDEpO1xcblxcdGNvbnN0IHVpbnQgaSA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0Y29uc3QgdWludCBrID0gZ2V0X2dsb2JhbF9pZCgxKTtcXG5cXHRhICs9IGkgKiByZWR1Y3Rpb25EaW0gKiBpbm5lclN0cmlkZSArIGs7XFxuXFx0ZG91YmxlIGFjY3VtdWxhdG9yID0gKmE7XFxuXFx0d2hpbGUgKC0tcmVkdWN0aW9uRGltKSB7XFxuXFx0XFx0YSArPSBpbm5lclN0cmlkZTtcXG5cXHRcXHRhY2N1bXVsYXRvciArPSAqYTtcXG5cXHR9XFxuXFx0b3V0W2kgKiBpbm5lclN0cmlkZSArIGtdID0gYWNjdW11bGF0b3I7XFxufVxcblxcbmtlcm5lbCB2b2lkIGFtaW5fZjMyKFxcblxcdHVpbnQgcmVkdWN0aW9uRGltLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpbm5lclN0cmlkZSA9IGdldF9nbG9iYWxfc2l6ZSgxKTtcXG5cXHRjb25zdCB1aW50IGkgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGNvbnN0IHVpbnQgayA9IGdldF9nbG9iYWxfaWQoMSk7XFxuXFx0YSArPSBpICogcmVkdWN0aW9uRGltICogaW5uZXJTdHJpZGUgKyBrO1xcblxcdGZsb2F0IGFjY3VtdWxhdG9yID0gKmE7XFxuXFx0d2hpbGUgKC0tcmVkdWN0aW9uRGltKSB7XFxuXFx0XFx0YSArPSBpbm5lclN0cmlkZTtcXG5cXHRcXHRhY2N1bXVsYXRvciA9IG1pbihhY2N1bXVsYXRvciwgKmEpO1xcblxcdH1cXG5cXHRvdXRbaSAqIGlubmVyU3RyaWRlICsga10gPSBhY2N1bXVsYXRvcjtcXG59XFxuXFxua2VybmVsIHZvaWQgYW1pbl9mNjQoXFxuXFx0dWludCByZWR1Y3Rpb25EaW0sXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaW5uZXJTdHJpZGUgPSBnZXRfZ2xvYmFsX3NpemUoMSk7XFxuXFx0Y29uc3QgdWludCBpID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRjb25zdCB1aW50IGsgPSBnZXRfZ2xvYmFsX2lkKDEpO1xcblxcdGEgKz0gaSAqIHJlZHVjdGlvbkRpbSAqIGlubmVyU3RyaWRlICsgaztcXG5cXHRkb3VibGUgYWNjdW11bGF0b3IgPSAqYTtcXG5cXHR3aGlsZSAoLS1yZWR1Y3Rpb25EaW0pIHtcXG5cXHRcXHRhICs9IGlubmVyU3RyaWRlO1xcblxcdFxcdGFjY3VtdWxhdG9yID0gbWluKGFjY3VtdWxhdG9yLCAqYSk7XFxuXFx0fVxcblxcdG91dFtpICogaW5uZXJTdHJpZGUgKyBrXSA9IGFjY3VtdWxhdG9yO1xcbn1cXG5cXG5rZXJuZWwgdm9pZCBhbWF4X2YzMihcXG5cXHR1aW50IHJlZHVjdGlvbkRpbSxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaW5uZXJTdHJpZGUgPSBnZXRfZ2xvYmFsX3NpemUoMSk7XFxuXFx0Y29uc3QgdWludCBpID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRjb25zdCB1aW50IGsgPSBnZXRfZ2xvYmFsX2lkKDEpO1xcblxcdGEgKz0gaSAqIHJlZHVjdGlvbkRpbSAqIGlubmVyU3RyaWRlICsgaztcXG5cXHRmbG9hdCBhY2N1bXVsYXRvciA9ICphO1xcblxcdHdoaWxlICgtLXJlZHVjdGlvbkRpbSkge1xcblxcdFxcdGEgKz0gaW5uZXJTdHJpZGU7XFxuXFx0XFx0YWNjdW11bGF0b3IgPSBtYXgoYWNjdW11bGF0b3IsICphKTtcXG5cXHR9XFxuXFx0b3V0W2kgKiBpbm5lclN0cmlkZSArIGtdID0gYWNjdW11bGF0b3I7XFxufVxcblxcbmtlcm5lbCB2b2lkIGFtYXhfZjY0KFxcblxcdHVpbnQgcmVkdWN0aW9uRGltLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlubmVyU3RyaWRlID0gZ2V0X2dsb2JhbF9zaXplKDEpO1xcblxcdGNvbnN0IHVpbnQgaSA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0Y29uc3QgdWludCBrID0gZ2V0X2dsb2JhbF9pZCgxKTtcXG5cXHRhICs9IGkgKiByZWR1Y3Rpb25EaW0gKiBpbm5lclN0cmlkZSArIGs7XFxuXFx0ZG91YmxlIGFjY3VtdWxhdG9yID0gKmE7XFxuXFx0d2hpbGUgKC0tcmVkdWN0aW9uRGltKSB7XFxuXFx0XFx0YSArPSBpbm5lclN0cmlkZTtcXG5cXHRcXHRhY2N1bXVsYXRvciA9IG1heChhY2N1bXVsYXRvciwgKmEpO1xcblxcdH1cXG5cXHRvdXRbaSAqIGlubmVyU3RyaWRlICsga10gPSBhY2N1bXVsYXRvcjtcXG59XFxuXCI7XG5cdHZhciBwcm9kdWN0S2VybmVsc1NvdXJjZSA9IFwia2VybmVsIHZvaWQgZG90X2YzMihcXG5cXHR1aW50IHJlZHVjdGlvbkRpbSxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0Z2xvYmFsIGZsb2F0KiBiLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGkgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGNvbnN0IHVpbnQgayA9IGdldF9nbG9iYWxfaWQoMSk7XFxuXFx0Y29uc3QgdWludCBsID0gZ2V0X2dsb2JhbF9pZCgyKTtcXG5cXHRjb25zdCB1aW50IG91dGVyU3RyaWRlQiA9IGdldF9nbG9iYWxfc2l6ZSgxKTtcXG5cXHRjb25zdCB1aW50IGlubmVyU3RyaWRlQiA9IGdldF9nbG9iYWxfc2l6ZSgyKTtcXG5cXG5cXHRmbG9hdCBhY2N1bXVsYXRvciA9IDAuMGY7XFxuXFx0Zm9yICh1aW50IGogPSAwOyBqIDwgcmVkdWN0aW9uRGltOyArK2opIHtcXG5cXHRcXHRhY2N1bXVsYXRvciArPSBhW2kqcmVkdWN0aW9uRGltK2pdICogYlsoaypyZWR1Y3Rpb25EaW0raikqaW5uZXJTdHJpZGVCK2xdO1xcblxcdH1cXG5cXHRvdXRbKGkqb3V0ZXJTdHJpZGVCICsgaykgKiBpbm5lclN0cmlkZUIgKyBsXSA9IGFjY3VtdWxhdG9yO1xcbn1cXG5cXG5rZXJuZWwgdm9pZCBkb3RfZjY0KFxcblxcdHVpbnQgcmVkdWN0aW9uRGltLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYixcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaSA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0Y29uc3QgdWludCBrID0gZ2V0X2dsb2JhbF9pZCgxKTtcXG5cXHRjb25zdCB1aW50IGwgPSBnZXRfZ2xvYmFsX2lkKDIpO1xcblxcdGNvbnN0IHVpbnQgb3V0ZXJTdHJpZGVCID0gZ2V0X2dsb2JhbF9zaXplKDEpO1xcblxcdGNvbnN0IHVpbnQgaW5uZXJTdHJpZGVCID0gZ2V0X2dsb2JhbF9zaXplKDIpO1xcblxcblxcdGRvdWJsZSBhY2N1bXVsYXRvciA9IDAuMDtcXG5cXHRmb3IgKHVpbnQgaiA9IDA7IGogPCByZWR1Y3Rpb25EaW07ICsraikge1xcblxcdFxcdGFjY3VtdWxhdG9yICs9IGFbaSpyZWR1Y3Rpb25EaW0ral0gKiBiWyhrKnJlZHVjdGlvbkRpbStqKSppbm5lclN0cmlkZUIrbF07XFxuXFx0fVxcblxcdG91dFsoaSpvdXRlclN0cmlkZUIgKyBrKSAqIGlubmVyU3RyaWRlQiArIGxdID0gYWNjdW11bGF0b3I7XFxufVxcblwiO1xuXHR2YXIgdXRpbEtlcm5lbHNTb3VyY2UgPSBcImtlcm5lbCB2b2lkIHNldF9mMzIoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQsXFxuXFx0ZmxvYXQgdmFsdWUpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSB2YWx1ZTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIHNldF9mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0LFxcblxcdGRvdWJsZSB2YWx1ZSlcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IHZhbHVlO1xcblxcdH1cXG59XFxuXFxua2VybmVsIHZvaWQgbGluc3BhY2VfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0LFxcblxcdGZsb2F0IHN0YXJ0LFxcblxcdGZsb2F0IHN0ZXApXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBzdGFydCArIHN0ZXAgKiAoKGZsb2F0KSBpZCk7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBsaW5zcGFjZV9mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0LFxcblxcdGRvdWJsZSBzdGFydCxcXG5cXHRkb3VibGUgc3RlcClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IHN0YXJ0ICsgc3RlcCAqICgoZG91YmxlKSBpZCk7XFxuXFx0fVxcbn1cXG5cXG5rZXJuZWwgdm9pZCByZXBlYXRfZjMyKFxcblxcdHVpbnQgZXhwYW5zaW9uRGltLFxcblxcdHVpbnQgaW5uZXJTdHJpZGUsXFxuXFx0dWludCByZXBlYXRzLFxcblxcdGdsb2JhbCBmbG9hdCAqcmVzdHJpY3QgYSxcXG5cXHRnbG9iYWwgZmxvYXQgKnJlc3RyaWN0IG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRjb25zdCB1aW50IGogPSBnZXRfZ2xvYmFsX2lkKDEpO1xcblxcdGNvbnN0IHVpbnQgayA9IGdldF9nbG9iYWxfaWQoMik7XFxuXFx0Y29uc3QgZmxvYXQgdmFsdWUgPSBhWyhpICogZXhwYW5zaW9uRGltICsgaikgKiBpbm5lclN0cmlkZSArIGtdO1xcblxcdHVpbnQgb2Zmc2V0T3V0ID0gKGkgKiBleHBhbnNpb25EaW0gKyBqKSAqIHJlcGVhdHMgKiBpbm5lclN0cmlkZSArIGs7XFxuXFx0Zm9yICh1aW50IGMgPSAwOyBjIDwgcmVwZWF0czsgKytjKSB7XFxuXFx0XFx0b3V0W29mZnNldE91dF0gPSB2YWx1ZTtcXG5cXHRcXHRvZmZzZXRPdXQgKz0gaW5uZXJTdHJpZGU7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCByZXBlYXRfZjY0KFxcblxcdHVpbnQgZXhwYW5zaW9uRGltLFxcblxcdHVpbnQgaW5uZXJTdHJpZGUsXFxuXFx0dWludCByZXBlYXRzLFxcblxcdGdsb2JhbCBkb3VibGUgKnJlc3RyaWN0IGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSAqcmVzdHJpY3Qgb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGkgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGNvbnN0IHVpbnQgaiA9IGdldF9nbG9iYWxfaWQoMSk7XFxuXFx0Y29uc3QgdWludCBrID0gZ2V0X2dsb2JhbF9pZCgyKTtcXG5cXHRjb25zdCBkb3VibGUgdmFsdWUgPSBhWyhpICogZXhwYW5zaW9uRGltICsgaikgKiBpbm5lclN0cmlkZSArIGtdO1xcblxcdHVpbnQgb2Zmc2V0T3V0ID0gKGkgKiBleHBhbnNpb25EaW0gKyBqKSAqIHJlcGVhdHMgKiBpbm5lclN0cmlkZSArIGs7XFxuXFx0Zm9yICh1aW50IGMgPSAwOyBjIDwgcmVwZWF0czsgKytjKSB7XFxuXFx0XFx0b3V0W29mZnNldE91dF0gPSB2YWx1ZTtcXG5cXHRcXHRvZmZzZXRPdXQgKz0gaW5uZXJTdHJpZGU7XFxuXFx0fVxcbn1cXG5cIjtcblx0dmFyIHNvdXJjZSA9IGJpbmFyeUtlcm5lbHNTb3VyY2UgKyB1bmFyeUtlcm5lbHNTb3VyY2UgKyBcblx0XHRyZWR1Y3Rpb25LZXJuZWxzU291cmNlICsgYXhpc1JlZHVjdGlvbktlcm5lbHNTb3VyY2UgKyBcblx0XHRwcm9kdWN0S2VybmVsc1NvdXJjZSArIHV0aWxLZXJuZWxzU291cmNlO1xuXG5cdHZhciBhc3luY0NhbGxiYWNrcyA9IG9wdGlvbnMuYXN5bmNDYWxsYmFja3M7XG5cdGlmICh0eXBlb2YgYXN5bmNDYWxsYmFja3MgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHQvKiBDdXJyZW50bHkgb25seSBOb2RlLVdlYkNMIHN1cHBvcnRzIGFzeW5jaHJvbm91cyBjYWxsYmFja3MgKi9cblx0XHR0aGlzLmFzeW5jQ2FsbGJhY2tzID0gaXNOb2RlV2ViQ0w7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5hc3luY0NhbGxiYWNrcyA9ICEhYXN5bmNDYWxsYmFja3M7XG5cdH1cblx0dmFyIGRldmljZU5hbWUgPSBvcHRpb25zLmRldmljZTtcblx0aWYgKGRldmljZU5hbWUpIHtcblx0XHR2YXIgZGV2aWNlSW5kZXggPSBhdmFpbGFibGVEZXZpY2VzRGVzY3JpcHRpb25zLmluZGV4T2YoZGV2aWNlTmFtZSk7XG5cdFx0aWYgKGRldmljZUluZGV4ID09PSAtMSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBXZWJDTCBkZXZpY2UgbmFtZTogXCIgKyBkZXZpY2VOYW1lKTtcblx0XHR9XG5cdFx0dGhpcy5kZXZpY2UgPSBhdmFpbGFibGVEZXZpY2VzW2RldmljZUluZGV4XTtcblx0fSBlbHNlIHtcblx0XHR2YXIgZGV2aWNlSW5kZXggPSBnZXREZWZhdWx0RGV2aWNlSW5kZXgoKTtcblx0XHRpZiAoZGV2aWNlSW5kZXggPCAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJObyBzdWl0YWJsZSBXZWJDTCBkZXZpY2UgZm91bmRcIik7XG5cdFx0fVxuXHRcdHRoaXMuZGV2aWNlID0gYXZhaWxhYmxlRGV2aWNlc1tkZXZpY2VJbmRleF07XG5cdH1cblx0dGhpcy5kZXZpY2UuZW5hYmxlRXh0ZW5zaW9uKFwiS0hSX2ZwNjRcIik7XG5cdHRoaXMuZGV2aWNlSW5mbyA9IHtcblx0XHRkZXZpY2VDbGFzczogY2xhc3NpZnlEZXZpY2UodGhpcy5kZXZpY2UpLFxuXHRcdGxvY2FsTWVtb3J5U2l6ZTogdGhpcy5kZXZpY2UuZ2V0SW5mbyhjbC5ERVZJQ0VfTE9DQUxfTUVNX1NJWkUpLFxuXHRcdG1heENvbXB1dGVVbml0czogdGhpcy5kZXZpY2UuZ2V0SW5mbyhjbC5ERVZJQ0VfTUFYX0NPTVBVVEVfVU5JVFMpLFxuXHRcdG1heFdvcmtHcm91cFNpemU6IHRoaXMuZGV2aWNlLmdldEluZm8oY2wuREVWSUNFX01BWF9XT1JLX0dST1VQX1NJWkUpLFxuXHRcdG1heFdvcmtJdGVtU2l6ZXM6IHRoaXMuZGV2aWNlLmdldEluZm8oY2wuREVWSUNFX01BWF9XT1JLX0lURU1fU0laRVMpXG5cdH07XG5cdHRoaXMuY29udGV4dCA9IGNsLmNyZWF0ZUNvbnRleHQodGhpcy5kZXZpY2UpO1xuXHR0aGlzLnF1ZXVlID0gdGhpcy5jb250ZXh0LmNyZWF0ZUNvbW1hbmRRdWV1ZSh0aGlzLmRldmljZSk7XG5cdHRoaXMucHJvZ3JhbSA9IHRoaXMuY29udGV4dC5jcmVhdGVQcm9ncmFtKHNvdXJjZSk7XG5cdHRyeSB7XG5cdFx0LyogQ2hyb21pdW0tV2ViQ0wgcmVxdWlyZXMgYSBsaXN0IG9mIGRldmljZXMgKi9cblx0XHR0aGlzLnByb2dyYW0uYnVpbGQoW3RoaXMuZGV2aWNlXSk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRpZiAoZS5uYW1lID09PSBcIklOVkFMSURfREVWSUNFXCIpIHtcblx0XHRcdC8qIE5va2lhLVdlYkNMIG9ubHkgd29ya3Mgd2l0aCBubyBhcmd1bWVudHMgdG8gV2ViQ0xQcm9ncmFtLmJ1aWxkICovXG5cdFx0XHR0aGlzLnByb2dyYW0uYnVpbGQoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgZTtcblx0XHR9XG5cdH1cblx0dGhpcy5rZXJuZWxzID0gY3JlYXRlS2VybmVscyh0aGlzLnByb2dyYW0pO1xuXHQvKiBDb250ZXh0IGlzIHJlYWR5IGZvciBjb21wdXRhdGlvbnMgKi9cblx0Y2FsbGJhY2sodGhpcyk7XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgbmFtZXMgb2YgZGV2aWNlcyB0aGF0IGNhbiBiZSB1c2VkIGZvciBjb21wdXRhdGlvbi5cbiAqIEFueSBvZiB0aGVzZSBuYW1lcyBjYW4gYmUgcGFzc2VkIGFzIGEgXCJkZXZpY2VcIiBvcHRpb24gd2hlbiBjcmVhdGluZyBhIFdlYkNMIGNvbnRleHQuXG4gKlxuICogQHN0YXRpY1xuICogQG1ldGhvZCBnZXRBdmFpbGFibGVEZXZpY2VzXG4gKiBAcmV0dXJuIHtTdHJpbmdbXX0gLSBhIHBvc3NpYmx5IGVtcHR5IGxpc3Qgb2YgYXZhaWxhYmxlIGRldmljZSBuYW1lcy5cbiAqL1xuV2ViQ0xDb250ZXh0LmdldEF2YWlsYWJsZURldmljZXMgPSBmdW5jdGlvbigpIHtcblx0aWYgKFdlYkNMQ29udGV4dC5pc1N1cHBvcnRlZCgpKSB7XG5cdFx0cmV0dXJuIGF2YWlsYWJsZURldmljZXNEZXNjcmlwdGlvbnM7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIG5hbWUgb2YgdGhlIGRlZmF1bHQgZGV2aWNlIHVzZWQgZm9yIGNvbXB1dGF0aW9uLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZ2V0RGVmYXVsdERldmljZVxuICogQHJldHVybiB7U3RyaW5nfSAtIHRoZSBuYW1lIG9mIHRoZSBkZWZhdWx0IFdlYkNMIGRldmljZSBvciBudWxsIGlmIG5vIHN1aXRhYmxlIGRldmljZSBhdmFpbGFibGUuXG4gKi9cbldlYkNMQ29udGV4dC5nZXREZWZhdWx0RGV2aWNlID0gZnVuY3Rpb24oKSB7XG5cdHZhciBkZXZpY2VJbmRleCA9IGdldERlZmF1bHREZXZpY2VJbmRleCgpO1xuXHRpZiAoZGV2aWNlSW5kZXggPCAwKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIGF2YWlsYWJsZURldmljZXNEZXNjcmlwdGlvbnNbZGV2aWNlSW5kZXhdO1xuXHR9XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiBXZWJDTCBjYW4gYmUgdXNlZCBmb3IgY29tcHV0YXRpb24uXG4gKiBXZWJDTCBpcyB1c2FibGUgZm9yIGNvbXB1dGF0aW9ucyBpZiBpdCBpcyBzdXBwb3J0ZWQgYnkgSlMgZW5naW5lIChvciBOb2RlLmpzKSBhbmQgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIENQVSBvciBHUFUgZGV2aWNlIHdpdGggS0hSX2ZwNjQgZXh0ZW5zaW9uLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgaXNTdXBwb3J0ZWRcbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gdHJ1ZSBpZiBXZWJDTCBpcyB1c2FibGUgb24gdGhpcyBzeXN0ZW0gYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuV2ViQ0xDb250ZXh0LmlzU3VwcG9ydGVkID0gZnVuY3Rpb24oKSB7XG5cdHZhciB3ZWJjbCA9IGluaXRXZWJDTCgpO1xuXHRpZiAod2ViY2wgPT09IG51bGwpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0dmFyIGF2YWlsYWJsZURldmljZXMgPSBnZXRBdmFpbGFibGVEZXZpY2VzKCk7XG5cdHJldHVybiBhdmFpbGFibGVEZXZpY2VzLmxlbmd0aCAhPT0gMDtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUuZW1wdHkgPSBmdW5jdGlvbihzaGFwZSwgZGF0YVR5cGUpIHtcblx0c2hhcGUgPSB1dGlsLmNoZWNrU2hhcGUoc2hhcGUpO1xuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XG5cdH0gZWxzZSBpZiAoIShkYXRhVHlwZSBpbnN0YW5jZW9mIERhdGFUeXBlKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoZGF0YVR5cGUgKyBcIiBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgRGF0YVR5cGVcIik7XG5cdH1cblx0dmFyIGFycmF5ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCB0aGlzKTtcblx0YXJyYXkuX2J1ZmZlciA9IHRoaXMuY29udGV4dC5jcmVhdGVCdWZmZXIoY2wuTUVNX1JFQURfV1JJVEUsIGFycmF5Lmxlbmd0aCAqIGRhdGFUeXBlLnNpemUpO1xuXHRyZXR1cm4gYXJyYXk7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLnplcm9zID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xuXHR9XG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XG5cdGFycmF5Ll9idWZmZXIgPSB0aGlzLmNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBhcnJheS5sZW5ndGggKiBkYXRhVHlwZS5zaXplKTtcblx0dmFyIGtlcm5lbCA9IHRoaXMua2VybmVscy5zZXRbZGF0YVR5cGUudHlwZV07XG5cdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFthcnJheS5sZW5ndGhdKSk7XG5cdGtlcm5lbC5zZXRBcmcoMSwgYXJyYXkuX2J1ZmZlcik7XG5cdGtlcm5lbC5zZXRBcmcoMiwgbmV3IGRhdGFUeXBlLmFycmF5VHlwZShbMC4wXSkpO1xuXHR0aGlzLnF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMSwgbnVsbCwgW2FycmF5Lmxlbmd0aF0sIG51bGwpO1xuXHRyZXR1cm4gYXJyYXk7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLm9uZXMgPSBmdW5jdGlvbihzaGFwZSwgZGF0YVR5cGUpIHtcblx0c2hhcGUgPSB1dGlsLmNoZWNrU2hhcGUoc2hhcGUpO1xuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XG5cdH0gZWxzZSBpZiAoIShkYXRhVHlwZSBpbnN0YW5jZW9mIERhdGFUeXBlKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoZGF0YVR5cGUgKyBcIiBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgRGF0YVR5cGVcIik7XG5cdH1cblx0dmFyIGFycmF5ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCB0aGlzKTtcblx0YXJyYXkuX2J1ZmZlciA9IHRoaXMuY29udGV4dC5jcmVhdGVCdWZmZXIoY2wuTUVNX1JFQURfV1JJVEUsIGFycmF5Lmxlbmd0aCAqIGRhdGFUeXBlLnNpemUpO1xuXHR2YXIga2VybmVsID0gdGhpcy5rZXJuZWxzLnNldFtkYXRhVHlwZS50eXBlXTtcblx0a2VybmVsLnNldEFyZygwLCBuZXcgVWludDMyQXJyYXkoW2FycmF5Lmxlbmd0aF0pKTtcblx0a2VybmVsLnNldEFyZygxLCBhcnJheS5fYnVmZmVyKTtcblx0a2VybmVsLnNldEFyZygyLCBuZXcgZGF0YVR5cGUuYXJyYXlUeXBlKFsxLjBdKSk7XG5cdHRoaXMucXVldWUuZW5xdWV1ZU5EUmFuZ2VLZXJuZWwoa2VybmVsLCAxLCBudWxsLCBbYXJyYXkubGVuZ3RoXSwgbnVsbCk7XG5cdHJldHVybiBhcnJheTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUuYXJyYXkgPSBmdW5jdGlvbihkYXRhLCBkYXRhVHlwZSkge1xuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XG5cdH0gZWxzZSB7XG5cdFx0ZGF0YVR5cGUgPSB1dGlsLmNoZWNrRGF0YVR5cGUoZGF0YVR5cGUpO1xuXHR9XG5cdHZhciBzaGFwZSA9IFtdO1xuXHR1dGlsLmRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZShkYXRhLCBzaGFwZSwgMCk7XG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XG5cdHZhciBidWZmZXIgPSBuZXcgZGF0YVR5cGUuYXJyYXlUeXBlKGFycmF5Lmxlbmd0aCk7XG5cdHV0aWwuY29weUFycmF5RGF0YVJlY3Vyc2l2ZShidWZmZXIsIGRhdGEsIHNoYXBlLCAwLCAwKTtcblx0aWYgKHVzZUJ1ZmZlckNyZWF0aW9uV2l0aEluaXQpIHtcblx0XHRhcnJheS5fYnVmZmVyID0gdGhpcy5jb250ZXh0LmNyZWF0ZUJ1ZmZlcihjbC5NRU1fUkVBRF9XUklURSwgYnVmZmVyLmJ5dGVMZW5ndGgsIGJ1ZmZlcik7XG5cdH0gZWxzZSB7XG5cdFx0YXJyYXkuX2J1ZmZlciA9IHRoaXMuY29udGV4dC5jcmVhdGVCdWZmZXIoY2wuTUVNX1JFQURfV1JJVEUsIGJ1ZmZlci5ieXRlTGVuZ3RoKTtcblx0XHR0aGlzLnF1ZXVlLmVucXVldWVXcml0ZUJ1ZmZlcihhcnJheS5fYnVmZmVyLCBmYWxzZSwgMCwgYnVmZmVyLmJ5dGVMZW5ndGgsIGJ1ZmZlcik7XG5cdH1cblx0cmV0dXJuIGFycmF5O1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5saW5zcGFjZSA9IGZ1bmN0aW9uKHN0YXJ0LCBzdG9wLCBzYW1wbGVzLCBjbG9zZWQpIHtcblx0aWYgKCF1dGlsLmlzUmVhbChzdGFydCkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHN0YXJ0ICsgXCIgaXMgbm90IGEgcmVhbCBudW1iZXJcIik7XG5cdH1cblx0aWYgKCF1dGlsLmlzUmVhbChzdG9wKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3Ioc3RvcCArIFwiIGlzIG5vdCBhIHJlYWwgbnVtYmVyXCIpO1xuXHR9XG5cdGlmICh0eXBlb2Ygc2FtcGxlcyA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdC8qIERlZmF1bHQgdmFsdWUgaW4gTnVtUHkgKi9cblx0XHRzYW1wbGVzID0gNTA7XG5cdH0gZWxzZSBpZiAoIXV0aWwuaXNJbnQoc2FtcGxlcykpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHNhbXBsZXMgKyBcIiBpcyBub3QgYW4gaW50ZWdlclwiKTtcblx0fSBlbHNlIGlmIChzYW1wbGVzIDw9IDApIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBudW1iZXIgb2Ygc2FtcGxlcyBtdXN0IGJlIHBvc2l0aXZlXCIpO1xuXHR9XG5cdGlmICh0eXBlb2YgY2xvc2VkID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0Y2xvc2VkID0gdHJ1ZTtcblx0fVxuXHRpZiAoY2xvc2VkICYmIChzYW1wbGVzID09PSAxKSkge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVGhlIG51bWJlciBvZiBzYW1wbGVzIG11c3QgYmUgYSBsZWFzdCAyIChmb3Igc3RhcnQgYW5kIGVuZCBwb2ludHMpXCIpO1xuXHR9XG5cblx0dmFyIGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR2YXIgYXJyYXkgPSBuZXcgTkRBcnJheShzYW1wbGVzLCBkYXRhVHlwZSwgdGhpcyk7XG5cdGFycmF5Ll9idWZmZXIgPSB0aGlzLmNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBzYW1wbGVzICogZGF0YVR5cGUuc2l6ZSk7XG5cblx0dmFyIHJhbmdlID0gc3RvcCAtIHN0YXJ0O1xuXHR2YXIgbiA9IChjbG9zZWQpID8gc2FtcGxlcyAtIDEgOiBzYW1wbGVzO1xuXHR2YXIgc3RlcCA9IHJhbmdlIC8gbjtcblxuXHR2YXIga2VybmVsID0gdGhpcy5rZXJuZWxzLmxpbnNwYWNlW2RhdGFUeXBlLnR5cGVdO1xuXHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbYXJyYXkubGVuZ3RoXSkpO1xuXHRrZXJuZWwuc2V0QXJnKDEsIGFycmF5Ll9idWZmZXIpO1xuXHRrZXJuZWwuc2V0QXJnKDIsIG5ldyBkYXRhVHlwZS5hcnJheVR5cGUoW3N0YXJ0XSkpO1xuXHRrZXJuZWwuc2V0QXJnKDMsIG5ldyBkYXRhVHlwZS5hcnJheVR5cGUoW3N0ZXBdKSk7XG5cdHRoaXMucXVldWUuZW5xdWV1ZU5EUmFuZ2VLZXJuZWwoa2VybmVsLCAxLCBudWxsLCBbYXJyYXkubGVuZ3RoXSwgbnVsbCk7XG5cblx0cmV0dXJuIGFycmF5O1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5faW52YWxpZGF0ZSA9IGZ1bmN0aW9uKGFycmF5KSB7XG5cdGlmIChhcnJheS5fYnVmZmVyICE9PSBudWxsKSB7XG5cdFx0LyogV29yay1hcm91bmQgZm9yIENocm9taXVtLVdlYkNMIHRoYXQgY3VycmVudGx5IGxhY2tzIFdlYkNMTWVtT2JqZWN0LnJlbGVhc2UgbWV0aG9kICovXG5cdFx0aWYgKHR5cGVvZiBhcnJheS5fYnVmZmVyLnJlbGVhc2UgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRcdGFycmF5Ll9idWZmZXIucmVsZWFzZSgpO1xuXHRcdH1cblx0XHRhcnJheS5fYnVmZmVyID0gbnVsbDtcblx0fVxufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbigpIHtcblx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBhcmd1bWVudCBtaXNzaW5nXCIpO1xuXHR9XG5cdHZhciBjYWxsYmFjayA9IGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV07XG5cdC8qIFZhbGlkYXRlIGFyZ3VtZW50cyAqL1xuXHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIkF0IGxlYXN0IG9uZSBOREFycmF5IGFyZ3VtZW50IGV4cGVjdGVkXCIpO1xuXHR9XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aCAtIDE7IGkrKykge1xuXHRcdGlmICghKGFyZ3VtZW50c1tpXSBpbnN0YW5jZW9mIE5EQXJyYXkpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiQXJndW1lbnQgXCIgKyBpICsgXCIgaXMgbm90IGFuIE5EQXJyYXlcIik7XG5cdFx0fVxuXHR9XG5cdHZhciBjYWxsYmFja1dhaXRBcmd1bWVudHMgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTtcblx0dmFyIGNhbGxiYWNrQXJndW1lbnRzID0gbmV3IEFycmF5KGNhbGxiYWNrV2FpdEFyZ3VtZW50cyk7XG5cdGlmICh0aGlzLmFzeW5jQ2FsbGJhY2tzKSB7XG5cdFx0dmFyIGFzeW5jRXZlbnRzID0gW107XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja1dhaXRBcmd1bWVudHM7IGkrKykge1xuXHRcdFx0dmFyIGFycmF5ID0gYXJndW1lbnRzW2ldO1xuXHRcdFx0KGZ1bmN0aW9uKHF1ZXVlLCBpLCBzaGFwZSwgQXJyYXlUeXBlKSB7XG5cdFx0XHRcdHZhciBidWZmZXIgPSBuZXcgQXJyYXlUeXBlKGFycmF5Lmxlbmd0aCk7XG5cdFx0XHRcdHZhciByZWFkRmluaXNoRXZlbnQgPSBjcmVhdGVFdmVudCgpO1xuXHRcdFx0XHRhc3luY0V2ZW50cy5wdXNoKHJlYWRGaW5pc2hFdmVudCk7XG5cdFx0XHRcdHF1ZXVlLmVucXVldWVSZWFkQnVmZmVyKGFycmF5Ll9idWZmZXIsIGZhbHNlLCAwLCBidWZmZXIuYnl0ZUxlbmd0aCwgYnVmZmVyLCBudWxsLCByZWFkRmluaXNoRXZlbnQpO1xuXHRcdFx0XHRpZiAoc2hhcGUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0cmVhZEZpbmlzaEV2ZW50LnNldENhbGxiYWNrKGNsLkNPTVBMRVRFLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHJlYWRGaW5pc2hFdmVudC5yZWxlYXNlKCk7XG5cdFx0XHRcdFx0XHRjYWxsYmFja0FyZ3VtZW50c1tpXSA9IGJ1ZmZlclswXTtcblx0XHRcdFx0XHRcdGlmICgtLWNhbGxiYWNrV2FpdEFyZ3VtZW50cyA9PT0gMCkge1xuXHRcdFx0XHRcdFx0XHRjYWxsYmFjay5hcHBseShudWxsLCBjYWxsYmFja0FyZ3VtZW50cyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVhZEZpbmlzaEV2ZW50LnNldENhbGxiYWNrKGNsLkNPTVBMRVRFLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHJlYWRGaW5pc2hFdmVudC5yZWxlYXNlKCk7XG5cdFx0XHRcdFx0XHR2YXIganNhcnJheSA9IG5ldyBBcnJheShzaGFwZVswXSk7XG5cdFx0XHRcdFx0XHR1dGlsLmNyZWF0ZUFycmF5UmVjdXJzaXZlKG5ldyBBcnJheVR5cGUoYnVmZmVyKSwganNhcnJheSwgc2hhcGUsIDAsIDApO1xuXHRcdFx0XHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBqc2FycmF5O1xuXHRcdFx0XHRcdFx0aWYgKC0tY2FsbGJhY2tXYWl0QXJndW1lbnRzID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdGNhbGxiYWNrLmFwcGx5KG51bGwsIGNhbGxiYWNrQXJndW1lbnRzKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSkodGhpcy5xdWV1ZSwgaSwgYXJyYXkuc2hhcGUsIGFycmF5LmRhdGFUeXBlLmFycmF5VHlwZSk7XG5cdFx0XHQvKiBUaGlzIGxpbmUgbW9zdGx5IHNlcmlhbGl6ZXMgZXhlY3V0aW9uLiBVbmZvcnR1bmF0ZWx5LCB3aXRob3V0IGl0IG5vdGhpbmcgd29ya3MgKi9cblx0XHRcdGNsLndhaXRGb3JFdmVudHMoYXN5bmNFdmVudHMpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrV2FpdEFyZ3VtZW50czsgaSsrKSB7XG5cdFx0XHR2YXIgYXJyYXkgPSBhcmd1bWVudHNbaV07XG5cdFx0XHR2YXIgYnVmZmVyID0gbmV3IGFycmF5LmRhdGFUeXBlLmFycmF5VHlwZShhcnJheS5sZW5ndGgpO1xuXHRcdFx0dGhpcy5xdWV1ZS5lbnF1ZXVlUmVhZEJ1ZmZlcihhcnJheS5fYnVmZmVyLCB0cnVlLCAwLCBidWZmZXIuYnl0ZUxlbmd0aCwgYnVmZmVyKTtcblx0XHRcdGlmIChhcnJheS5zaGFwZS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBidWZmZXJbMF07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YXIganNhcnJheSA9IG5ldyBBcnJheShhcnJheS5zaGFwZVswXSk7XG5cdFx0XHRcdHV0aWwuY3JlYXRlQXJyYXlSZWN1cnNpdmUobmV3IGFycmF5LmRhdGFUeXBlLmFycmF5VHlwZShidWZmZXIpLCBqc2FycmF5LCBhcnJheS5zaGFwZSwgMCwgMCk7XG5cdFx0XHRcdGNhbGxiYWNrQXJndW1lbnRzW2ldID0ganNhcnJheTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y2FsbGJhY2suYXBwbHkobnVsbCwgY2FsbGJhY2tBcmd1bWVudHMpO1xuXHR9XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLnJlc2hhcGUgPSBmdW5jdGlvbihhLCBzaGFwZSkge1xuXHRzaGFwZSA9IHV0aWwuY2hlY2tTaGFwZShzaGFwZSk7XG5cdGlmICh1dGlsLmNvbXB1dGVMZW5ndGgoc2hhcGUpICE9PSBhLmxlbmd0aCkge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVGhlIHNoYXBlIGlzIG5vdCBjb21wYXRpYmxlIHdpdGggdGhlIGFycmF5XCIpO1xuXHR9XG5cdHZhciBvdXQgPSBuZXcgTkRBcnJheShzaGFwZSwgYS5kYXRhVHlwZSwgdGhpcyk7XG5cdGlmIChhLl9kZWNSZWYoKSkge1xuXHRcdG91dC5fYnVmZmVyID0gdGhpcy5jb250ZXh0LmNyZWF0ZUJ1ZmZlcih3ZWJjbC5NRU1fUkVBRF9XUklURSwgb3V0Lmxlbmd0aCAqIG91dC5kYXRhVHlwZS5zaXplKTtcblx0XHR0aGlzLnF1ZXVlLmVucXVldWVDb3B5QnVmZmVyKGEuX2J1ZmZlciwgb3V0Ll9idWZmZXIsIDAsIDAsIG91dC5sZW5ndGggKiBvdXQuZGF0YVR5cGUuc2l6ZSk7XG5cdH0gZWxzZSB7XG5cdFx0b3V0Ll9idWZmZXIgPSBhLl9idWZmZXI7XG5cdFx0YS5fYnVmZmVyID0gbnVsbDtcblx0fVxuXHRyZXR1cm4gb3V0O1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5yZXBlYXQgPSBmdW5jdGlvbihhLCByZXBlYXRzLCBheGlzLCBvdXQpIHtcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xuXHRyZXBlYXRzID0gdXRpbC5jaGVja1JlcGVhdHMocmVwZWF0cyk7XG5cdGF4aXMgPSB1dGlsLmNoZWNrQXhpcyhheGlzLCBhLnNoYXBlLmxlbmd0aCk7XG5cdHZhciBzaGFwZUEgPSBhLnNoYXBlO1xuXHR2YXIgc2hhcGVPdXQgPSBzaGFwZUEuc2xpY2UoMCk7XG5cdHNoYXBlT3V0W2F4aXNdICo9IHJlcGVhdHM7XG5cdGEuX2RlY1JlZigpO1xuXHR0cnkge1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShzaGFwZU91dCwgYS5kYXRhVHlwZSwgdGhpcyk7XG5cdFx0XHRvdXQuX2J1ZmZlciA9IHRoaXMuY29udGV4dC5jcmVhdGVCdWZmZXIoY2wuTUVNX1JFQURfV1JJVEUsIG91dC5sZW5ndGggKiBvdXQuZGF0YVR5cGUuc2l6ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShvdXQuc2hhcGUsIHNoYXBlT3V0KTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XG5cdFx0XHRvdXQuX2luY1JlZigpO1xuXHRcdH1cblx0XHR2YXIgb3V0ZXJTdHJpZGUgPSB1dGlsLmNvbXB1dGVPdXRlclN0cmlkZShzaGFwZUEsIGF4aXMpO1xuXHRcdHZhciBleHBhbnNpb25EaW0gPSBzaGFwZUFbYXhpc107XG5cdFx0dmFyIGlubmVyU3RyaWRlID0gdXRpbC5jb21wdXRlSW5uZXJTdHJpZGUoc2hhcGVBLCBheGlzKTtcblx0XHR2YXIga2VybmVsID0gdGhpcy5rZXJuZWxzLnJlcGVhdFthLmRhdGFUeXBlLnR5cGVdO1xuXHRcdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFtleHBhbnNpb25EaW1dKSk7XG5cdFx0a2VybmVsLnNldEFyZygxLCBuZXcgVWludDMyQXJyYXkoW2lubmVyU3RyaWRlXSkpO1xuXHRcdGtlcm5lbC5zZXRBcmcoMiwgbmV3IFVpbnQzMkFycmF5KFtyZXBlYXRzXSkpO1xuXHRcdGtlcm5lbC5zZXRBcmcoMywgYS5fYnVmZmVyKTtcblx0XHRrZXJuZWwuc2V0QXJnKDQsIG91dC5fYnVmZmVyKTtcblx0XHR0aGlzLnF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMywgbnVsbCwgW291dGVyU3RyaWRlLCBleHBhbnNpb25EaW0sIGlubmVyU3RyaWRlXSwgbnVsbCk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRhLl9pbmNSZWYoKTtcblx0XHR0aHJvdyBlO1xuXHR9XG5cdGEuX3RyeUludmFsaWRhdGUoKTtcblx0cmV0dXJuIG91dDtcbn07XG5cbnZhciBiaW5hcnlBcml0aE9wID0gZnVuY3Rpb24oYSwgYiwgb3V0LCBmdXJpb3VzQ29udGV4dCwgYmluYXJ5T3BLZXJuZWxzLCBiaW5hcnlDb25zdE9wS2VybmVscywgYmluYXJ5UmV2Q29uc3RLZXJuZWxzKSB7XG5cdHZhciBzaGFwZU91dCA9IG51bGwsIGRhdGFUeXBlT3V0ID0gbnVsbDtcblx0dmFyIGJ1ZmZlckEgPSBudWxsLCBidWZmZXJCID0gbnVsbDtcblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0YnVmZmVyQSA9IGEuX2J1ZmZlcjtcblx0XHRzaGFwZU91dCA9IGEuc2hhcGU7XG5cdFx0ZGF0YVR5cGVPdXQgPSBhLmRhdGFUeXBlO1xuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdFx0YnVmZmVyQiA9IGIuX2J1ZmZlcjtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KGEuc2hhcGUsIGIuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XG5cdFx0fSBlbHNlIGlmICghdXRpbC5pc051bWJlcihiKSkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYlwiKTtcblx0XHR9XG5cdH0gZWxzZSBpZiAodXRpbC5pc051bWJlcihhKSkge1xuXHRcdHV0aWwuY2hlY2tOREFycmF5KGIsIFwiYlwiKTtcblx0XHRidWZmZXJCID0gYi5fYnVmZmVyO1xuXHRcdHNoYXBlT3V0ID0gYi5zaGFwZTtcblx0XHRkYXRhVHlwZU91dCA9IGIuZGF0YVR5cGU7XG5cdH0gZWxzZSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYVwiKTtcblx0fVxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRhLl9kZWNSZWYoKTtcblx0fVxuXHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRiLl9kZWNSZWYoKTtcblx0fVxuXHR0cnkge1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShzaGFwZU91dCwgZGF0YVR5cGVPdXQsIGZ1cmlvdXNDb250ZXh0KTtcblx0XHRcdGlmICgoYSBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFhLl9oYXNSZWZzKCkpIHtcblx0XHRcdFx0b3V0Ll9idWZmZXIgPSBhLl9idWZmZXI7XG5cdFx0XHRcdGEuX2J1ZmZlciA9IG51bGw7XG5cdFx0XHR9IGVsc2UgaWYgKChiIGluc3RhbmNlb2YgTkRBcnJheSkgJiYgIWIuX2hhc1JlZnMoKSkge1xuXHRcdFx0XHRvdXQuX2J1ZmZlciA9IGIuX2J1ZmZlcjtcblx0XHRcdFx0Yi5fYnVmZmVyID0gbnVsbDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG91dC5fYnVmZmVyID0gZnVyaW91c0NvbnRleHQuY29udGV4dC5jcmVhdGVCdWZmZXIoY2wuTUVNX1JFQURfV1JJVEUsIG91dC5sZW5ndGggKiBvdXQuZGF0YVR5cGUuc2l6ZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShzaGFwZU91dCwgb3V0LnNoYXBlKTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGRhdGFUeXBlT3V0LCBvdXQuZGF0YVR5cGUpO1xuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcblx0XHR9XG5cdFx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRcdFx0dmFyIGtlcm5lbCA9IGJpbmFyeU9wS2VybmVsc1tkYXRhVHlwZU91dC50eXBlXTtcblx0XHRcdFx0a2VybmVsLnNldEFyZygwLCBuZXcgVWludDMyQXJyYXkoW291dC5sZW5ndGhdKSk7XG5cdFx0XHRcdGtlcm5lbC5zZXRBcmcoMSwgYnVmZmVyQSk7XG5cdFx0XHRcdGtlcm5lbC5zZXRBcmcoMiwgYnVmZmVyQik7XG5cdFx0XHRcdGtlcm5lbC5zZXRBcmcoMywgb3V0Ll9idWZmZXIpO1xuXHRcdFx0XHRmdXJpb3VzQ29udGV4dC5xdWV1ZS5lbnF1ZXVlTkRSYW5nZUtlcm5lbChrZXJuZWwsIDEsIG51bGwsIFtvdXQubGVuZ3RoXSwgbnVsbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YXIga2VybmVsID0gYmluYXJ5Q29uc3RPcEtlcm5lbHNbZGF0YVR5cGVPdXQudHlwZV07XG5cdFx0XHRcdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFtvdXQubGVuZ3RoXSkpO1xuXHRcdFx0XHRrZXJuZWwuc2V0QXJnKDEsIGJ1ZmZlckEpO1xuXHRcdFx0XHRrZXJuZWwuc2V0QXJnKDIsIG5ldyBkYXRhVHlwZU91dC5hcnJheVR5cGUoW2JdKSk7XG5cdFx0XHRcdGtlcm5lbC5zZXRBcmcoMywgb3V0Ll9idWZmZXIpO1xuXHRcdFx0XHRmdXJpb3VzQ29udGV4dC5xdWV1ZS5lbnF1ZXVlTkRSYW5nZUtlcm5lbChrZXJuZWwsIDEsIG51bGwsIFtvdXQubGVuZ3RoXSwgbnVsbCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhciBrZXJuZWwgPSBiaW5hcnlSZXZDb25zdEtlcm5lbHNbZGF0YVR5cGVPdXQudHlwZV07XG5cdFx0XHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbb3V0Lmxlbmd0aF0pKTtcblx0XHRcdGtlcm5lbC5zZXRBcmcoMSwgYnVmZmVyQik7XG5cdFx0XHRrZXJuZWwuc2V0QXJnKDIsIG5ldyBkYXRhVHlwZU91dC5hcnJheVR5cGUoW2FdKSk7XG5cdFx0XHRrZXJuZWwuc2V0QXJnKDMsIG91dC5fYnVmZmVyKTtcblx0XHRcdGZ1cmlvdXNDb250ZXh0LnF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMSwgbnVsbCwgW291dC5sZW5ndGhdLCBudWxsKTtcblx0XHR9XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHQvKiBSZXN0b3JlIHRoZSBwcmV2aW91cyBzdGF0ZSAqL1xuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdFx0YS5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdFx0Yi5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdHRocm93IGU7XG5cdH1cblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0YS5fdHJ5SW52YWxpZGF0ZSgpO1xuXHR9XG5cdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdGIuX3RyeUludmFsaWRhdGUoKTtcblx0fVxuXHRyZXR1cm4gb3V0O1xufTtcblxudmFyIHVuYXJ5QXJpdGhPcCA9IGZ1bmN0aW9uKGEsIG91dCwgZnVyaW91c0NvbnRleHQsIHVuYXJ5T3BLZXJuZWxzKSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcblx0YS5fZGVjUmVmKCk7XG5cdHZhciBidWZmZXJBID0gYS5fYnVmZmVyO1xuXHR0cnkge1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShhLnNoYXBlLCBhLmRhdGFUeXBlLCBmdXJpb3VzQ29udGV4dCk7XG5cdFx0XHRpZiAoKGEgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYS5faGFzUmVmcygpKSB7XG5cdFx0XHRcdG91dC5fYnVmZmVyID0gYS5fYnVmZmVyO1xuXHRcdFx0XHRhLl9idWZmZXIgPSBudWxsO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3V0Ll9idWZmZXIgPSBmdXJpb3VzQ29udGV4dC5jb250ZXh0LmNyZWF0ZUJ1ZmZlcihjbC5NRU1fUkVBRF9XUklURSwgb3V0Lmxlbmd0aCAqIG91dC5kYXRhVHlwZS5zaXplKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KGEuc2hhcGUsIG91dC5zaGFwZSk7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcblx0XHR9XG5cdFx0dmFyIGtlcm5lbCA9IHVuYXJ5T3BLZXJuZWxzW2EuZGF0YVR5cGUudHlwZV07XG5cdFx0a2VybmVsLnNldEFyZygwLCBuZXcgVWludDMyQXJyYXkoW291dC5sZW5ndGhdKSk7XG5cdFx0a2VybmVsLnNldEFyZygxLCBidWZmZXJBKTtcblx0XHRrZXJuZWwuc2V0QXJnKDIsIG91dC5fYnVmZmVyKTtcblx0XHRmdXJpb3VzQ29udGV4dC5xdWV1ZS5lbnF1ZXVlTkRSYW5nZUtlcm5lbChrZXJuZWwsIDEsIG51bGwsIFtvdXQubGVuZ3RoXSwgbnVsbCk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHQvKiBSZXN0b3JlIHRoZSBwcmV2aW91cyBzdGF0ZSAqL1xuXHRcdGEuX2luY1JlZigpO1xuXHRcdHRocm93IGU7XG5cdH1cblx0YS5fdHJ5SW52YWxpZGF0ZSgpO1xuXHRyZXR1cm4gb3V0O1xufTtcblxudmFyIGF4aXNSZWR1Y2VPcCA9IGZ1bmN0aW9uKGEsIGF4aXMsIG91dCwgZnVyaW91c0NvbnRleHQsIHJlZHVjZUtlcm5lbHMsIGF4aXNSZWR1Y2VLZXJuZWxzKSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcblx0aWYgKHR5cGVvZiBheGlzID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRcdG91dCA9IG5ldyBOREFycmF5KFtdLCBhLmRhdGFUeXBlLCBmdXJpb3VzQ29udGV4dCk7XG5cdFx0XHRvdXQuX2J1ZmZlciA9IGZ1cmlvdXNDb250ZXh0LmNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBhLmRhdGFUeXBlLnNpemUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoW10sIG91dC5zaGFwZSk7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcblx0XHR9XG5cdFx0dmFyIGxlbmd0aEEgPSBhLmxlbmd0aDtcblx0XHR2YXIgbWF4V29ya0l0ZW1zUGVyQ1UgPSBNYXRoLm1pbihcblx0XHRcdE1hdGgubWluKGZ1cmlvdXNDb250ZXh0LmRldmljZUluZm8ubWF4V29ya0dyb3VwU2l6ZSxcblx0XHRcdFx0ZnVyaW91c0NvbnRleHQuZGV2aWNlSW5mby5tYXhXb3JrSXRlbVNpemVzWzBdKSwgXG5cdFx0XHRmdXJpb3VzQ29udGV4dC5kZXZpY2VJbmZvLmxvY2FsTWVtb3J5U2l6ZSAvIGEuZGF0YVR5cGUuc2l6ZSk7XG5cdFx0LyogVGhlIG1pbmltYWwgYW1tb3VudCBvZiBwYXJhbGxlbGlzbSB0aGF0IGp1c3RpZmllcyBzd2l0Y2hpbmcgdG8gdHdvLXBhc3MgcmVkdWN0aW9uICovXG5cdFx0dmFyIHBhcmFsbGVsaXNhdGlvblRocmVzaG9sZCA9IDE2O1xuXHRcdHZhciBrZXJuZWwgPSByZWR1Y2VLZXJuZWxzW2EuZGF0YVR5cGUudHlwZV07XG5cdFx0aWYgKGxlbmd0aEEgPCBtYXhXb3JrSXRlbXNQZXJDVSAqIHBhcmFsbGVsaXNhdGlvblRocmVzaG9sZCkge1xuXHRcdFx0LyogT25lIHJlZHVjdGlvbiBpcyBlbm91Z2ggKi9cblx0XHRcdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFtsZW5ndGhBXSkpO1xuXHRcdFx0a2VybmVsLnNldEFyZygxLCBhLl9idWZmZXIpO1xuXHRcdFx0a2VybmVsLnNldEFyZygyLCBuZXcgVWludDMyQXJyYXkoW21heFdvcmtJdGVtc1BlckNVICogYS5kYXRhVHlwZS5zaXplXSkpO1xuXHRcdFx0a2VybmVsLnNldEFyZygzLCBvdXQuX2J1ZmZlcik7XG5cdFx0XHQvKiBJbXBvcnRhbnQ6IHVzZSBvbmx5IG9uZSB3b3JrIGdyb3VwICovXG5cdFx0XHRmdXJpb3VzQ29udGV4dC5xdWV1ZS5lbnF1ZXVlTkRSYW5nZUtlcm5lbChrZXJuZWwsIDEsIG51bGwsIFttYXhXb3JrSXRlbXNQZXJDVV0sIFttYXhXb3JrSXRlbXNQZXJDVV0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvKiBUd28tc3RlcCByZWR1Y3Rpb24gKi9cblx0XHRcdHZhciBtYXhDb21wdXRlVW5pdHMgPSBmdXJpb3VzQ29udGV4dC5kZXZpY2VJbmZvLm1heENvbXB1dGVVbml0cztcblx0XHRcdHZhciB3b3JrR3JvdXBTaXplTXVsdGlwbGUgPSBrZXJuZWwuZ2V0V29ya0dyb3VwSW5mbyhmdXJpb3VzQ29udGV4dC5kZXZpY2UsIGNsLktFUk5FTF9QUkVGRVJSRURfV09SS19HUk9VUF9TSVpFX01VTFRJUExFKTtcblx0XHRcdHZhciB0ZW1wQnVmZmVyID0gZnVyaW91c0NvbnRleHQuY29udGV4dC5jcmVhdGVCdWZmZXIoY2wuTUVNX1JFQURfV1JJVEUsIG1heENvbXB1dGVVbml0cyAqIGEuZGF0YVR5cGUuc2l6ZSk7XG5cblx0XHRcdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFtsZW5ndGhBXSkpO1xuXHRcdFx0a2VybmVsLnNldEFyZygxLCBhLl9idWZmZXIpO1xuXHRcdFx0a2VybmVsLnNldEFyZygyLCBuZXcgVWludDMyQXJyYXkoW21heFdvcmtJdGVtc1BlckNVICogYS5kYXRhVHlwZS5zaXplXSkpO1xuXHRcdFx0a2VybmVsLnNldEFyZygzLCB0ZW1wQnVmZmVyKTtcblx0XHRcdGZ1cmlvdXNDb250ZXh0LnF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMSwgbnVsbCxcblx0XHRcdFx0W21heFdvcmtJdGVtc1BlckNVICogbWF4Q29tcHV0ZVVuaXRzXSxcblx0XHRcdFx0W21heFdvcmtJdGVtc1BlckNVXSk7XG5cblx0XHRcdHZhciB3b3JrR3JvdXBTaXplID0gTWF0aC5taW4obWF4V29ya0l0ZW1zUGVyQ1UsXG5cdFx0XHRcdHV0aWwucm91bmRVcChtYXhDb21wdXRlVW5pdHMsIHdvcmtHcm91cFNpemVNdWx0aXBsZSkpO1xuXHRcdFx0a2VybmVsLnNldEFyZygwLCBuZXcgVWludDMyQXJyYXkoW21heENvbXB1dGVVbml0c10pKTtcblx0XHRcdGtlcm5lbC5zZXRBcmcoMSwgdGVtcEJ1ZmZlcik7XG5cdFx0XHRrZXJuZWwuc2V0QXJnKDIsIG5ldyBVaW50MzJBcnJheShbd29ya0dyb3VwU2l6ZSAqIGEuZGF0YVR5cGUuc2l6ZV0pKTtcblx0XHRcdGtlcm5lbC5zZXRBcmcoMywgb3V0Ll9idWZmZXIpO1xuXHRcdFx0LyogSW1wb3J0YW50OiB1c2Ugb25seSBvbmUgd29yayBncm91cCAqL1xuXHRcdFx0ZnVyaW91c0NvbnRleHQucXVldWUuZW5xdWV1ZU5EUmFuZ2VLZXJuZWwoa2VybmVsLCAxLCBudWxsLFxuXHRcdFx0XHRbd29ya0dyb3VwU2l6ZV0sXG5cdFx0XHRcdFt3b3JrR3JvdXBTaXplXSk7XG5cblx0XHRcdHRlbXBCdWZmZXIucmVsZWFzZSgpO1xuXHRcdH1cblx0XHRhLl90cnlSZWxlYXNlKCk7XG5cdFx0cmV0dXJuIG91dDtcblx0fSBlbHNlIHtcblx0XHRheGlzID0gdXRpbC5jaGVja0F4aXMoYXhpcywgYS5zaGFwZS5sZW5ndGgpO1xuXHRcdHZhciBzaGFwZU91dCA9IHV0aWwuY29tcHV0ZUF4aXNSZWR1Y3Rpb25PdXRTaGFwZShhLnNoYXBlLCBheGlzKTtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0dmFyIG91dCA9IG5ldyBOREFycmF5KHNoYXBlT3V0LCBhLmRhdGFUeXBlLCBmdXJpb3VzQ29udGV4dCk7XG5cdFx0XHRvdXQuX2J1ZmZlciA9IGZ1cmlvdXNDb250ZXh0LmNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBhLmRhdGFUeXBlLnNpemUgKiBvdXQubGVuZ3RoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KFtdLCBvdXQuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcblx0XHRcdG91dC5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdHZhciBvdXRlclN0cmlkZSA9IHV0aWwuY29tcHV0ZU91dGVyU3RyaWRlKGEuc2hhcGUsIGF4aXMpO1xuXHRcdHZhciByZWR1Y3Rpb25EaW0gPSBhLnNoYXBlW2F4aXNdO1xuXHRcdHZhciBpbm5lclN0cmlkZSA9IHV0aWwuY29tcHV0ZUlubmVyU3RyaWRlKGEuc2hhcGUsIGF4aXMpO1xuXHRcdHZhciBrZXJuZWwgPSBheGlzUmVkdWNlS2VybmVsc1thLmRhdGFUeXBlLnR5cGVdO1xuXHRcdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFtyZWR1Y3Rpb25EaW1dKSk7XG5cdFx0a2VybmVsLnNldEFyZygxLCBhLl9idWZmZXIpO1xuXHRcdGtlcm5lbC5zZXRBcmcoMiwgb3V0Ll9idWZmZXIpO1xuXHRcdGZ1cmlvdXNDb250ZXh0LnF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMiwgbnVsbCxcblx0XHRcdFtvdXRlclN0cmlkZSwgaW5uZXJTdHJpZGVdLCBudWxsKTtcblx0XHRhLl90cnlSZWxlYXNlKCk7XG5cdFx0cmV0dXJuIG91dDtcblx0fVxufTtcblxuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHRyZXR1cm4gYmluYXJ5QXJpdGhPcChhLCBiLCBvdXQsIHRoaXMsIHRoaXMua2VybmVscy5hZGQsIHRoaXMua2VybmVscy5hZGRjLCB0aGlzLmtlcm5lbHMuYWRkYyk7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLnN1YiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHRyZXR1cm4gYmluYXJ5QXJpdGhPcChhLCBiLCBvdXQsIHRoaXMsIHRoaXMua2VybmVscy5zdWIsIHRoaXMua2VybmVscy5zdWJjLCB0aGlzLmtlcm5lbHMuc3VicmMpO1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5tdWwgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcblx0cmV0dXJuIGJpbmFyeUFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzLCB0aGlzLmtlcm5lbHMubXVsLCB0aGlzLmtlcm5lbHMubXVsYywgdGhpcy5rZXJuZWxzLm11bGMpO1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5kaXYgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcblx0cmV0dXJuIGJpbmFyeUFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzLCB0aGlzLmtlcm5lbHMuZGl2LCB0aGlzLmtlcm5lbHMuZGl2YywgdGhpcy5rZXJuZWxzLmRpdnJjKTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUubmVnID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCB0aGlzLmtlcm5lbHMubmVnKTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUuYWJzID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCB0aGlzLmtlcm5lbHMuYWJzKTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUuZXhwID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCB0aGlzLmtlcm5lbHMuZXhwKTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUubG9nID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCB0aGlzLmtlcm5lbHMubG9nKTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUuc3FydCA9IGZ1bmN0aW9uKGEsIG91dCkge1xuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywgdGhpcy5rZXJuZWxzLnNxcnQpO1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5zcXVhcmUgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIHRoaXMua2VybmVscy5zcXVhcmUpO1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5taW4gPSBmdW5jdGlvbihhLCBheGlzLCBvdXQpIHtcblx0cmV0dXJuIGF4aXNSZWR1Y2VPcChhLCBheGlzLCBvdXQsIHRoaXMsIHRoaXMua2VybmVscy5taW4sIHRoaXMua2VybmVscy5hbWluKTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUubWF4ID0gZnVuY3Rpb24oYSwgYXhpcywgb3V0KSB7XG5cdHJldHVybiBheGlzUmVkdWNlT3AoYSwgYXhpcywgb3V0LCB0aGlzLCB0aGlzLmtlcm5lbHMubWF4LCB0aGlzLmtlcm5lbHMuYW1heCk7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLnN1bSA9IGZ1bmN0aW9uKGEsIGF4aXMsIG91dCkge1xuXHRyZXR1cm4gYXhpc1JlZHVjZU9wKGEsIGF4aXMsIG91dCwgdGhpcywgdGhpcy5rZXJuZWxzLnN1bSwgdGhpcy5rZXJuZWxzLmFzdW0pO1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5kb3QgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xuXHR1dGlsLmNoZWNrTkRBcnJheShiLCBcImJcIik7XG5cdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIGIuZGF0YVR5cGUpO1xuXG5cdC8qIFRoZSBheGlzIG9mIGIgdXNlZCBpbiByZWR1Y3Rpb246IGF4aXMgMCBmb3IgMUQgYXJyYXksIHNlY29uZC10by1sYXN0IGF4aXMgZm9yIE5EIGFycmF5ICovXG5cdHZhciBhQXhpcyA9IE1hdGgubWF4KGEuc2hhcGUubGVuZ3RoIC0gMSwgMCk7XG5cdHZhciBiQXhpcyA9IE1hdGgubWF4KGIuc2hhcGUubGVuZ3RoIC0gMiwgMCk7XG5cdHZhciByZWR1Y3Rpb25EaW0gPSBhLnNoYXBlW2FBeGlzXTtcblx0aWYgKHJlZHVjdGlvbkRpbSAhPT0gYi5zaGFwZVtiQXhpc10pIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkFycmF5cyBoYXZlIGluY29tcGF0aWJsZSByZWR1Y3Rpb24gZGltZW5zaW9uc1wiKTtcblx0fVxuXHR2YXIgc2hhcGVPdXQgPSBbXSwgc3RyaWRlQSA9IDEsIG91dGVyU3RyaWRlQiA9IDEsIGlubmVyU3RyaWRlQiA9IDE7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYUF4aXM7IGkrKykge1xuXHRcdHNoYXBlT3V0LnB1c2goYS5zaGFwZVtpXSk7XG5cdFx0c3RyaWRlQSAqPSBhLnNoYXBlW2ldO1xuXHR9XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYi5zaGFwZS5sZW5ndGg7IGkrKykge1xuXHRcdHZhciBkaW0gPSBiLnNoYXBlW2ldO1xuXHRcdGlmIChpIDwgYkF4aXMpIHtcblx0XHRcdG91dGVyU3RyaWRlQiAqPSBkaW07XG5cdFx0XHRzaGFwZU91dC5wdXNoKGRpbSk7XG5cdFx0fSBlbHNlIGlmIChpID4gYkF4aXMpIHtcblx0XHRcdGlubmVyU3RyaWRlQiAqPSBkaW07XG5cdFx0XHRzaGFwZU91dC5wdXNoKGRpbSk7XG5cdFx0fVxuXHR9XG5cdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0b3V0ID0gdGhpcy5lbXB0eShzaGFwZU91dCwgYS5kYXRhVHlwZSk7XG5cdH0gZWxzZSBpZiAob3V0IGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkob3V0LnNoYXBlLCBzaGFwZU91dCk7XG5cdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkob3V0LmRhdGFUeXBlLCBhLmRhdGFUeXBlKTtcblx0XHR1dGlsLmNoZWNrRGlmZmVyZW50TkRBcnJheXMoYSwgb3V0LCBcImFcIiwgXCJvdXRcIik7XG5cdFx0dXRpbC5jaGVja0RpZmZlcmVudE5EQXJyYXlzKGIsIG91dCwgXCJiXCIsIFwib3V0XCIpO1xuXHRcdG91dC5faW5jUmVmKCk7XG5cdH1cblx0dmFyIGtlcm5lbCA9IHRoaXMua2VybmVscy5kb3Rbb3V0LmRhdGFUeXBlLnR5cGVdO1xuXHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbcmVkdWN0aW9uRGltXSkpO1xuXHRrZXJuZWwuc2V0QXJnKDEsIGEuX2J1ZmZlcik7XG5cdGtlcm5lbC5zZXRBcmcoMiwgYi5fYnVmZmVyKTtcblx0a2VybmVsLnNldEFyZygzLCBvdXQuX2J1ZmZlcik7XG5cdHRoaXMucXVldWUuZW5xdWV1ZU5EUmFuZ2VLZXJuZWwoa2VybmVsLCAzLCBudWxsLFxuXHRcdFtzdHJpZGVBLCBvdXRlclN0cmlkZUIsIGlubmVyU3RyaWRlQl0sIG51bGwpO1xuXHRhLl90cnlSZWxlYXNlKCk7XG5cdGIuX3RyeVJlbGVhc2UoKTtcblx0cmV0dXJuIG91dDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gV2ViQ0xDb250ZXh0O1xuIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuQnVmZmVyLnBvb2xTaXplID0gODE5MlxuXG4vKipcbiAqIElmIGBCdWZmZXIuX3VzZVR5cGVkQXJyYXlzYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKGNvbXBhdGlibGUgZG93biB0byBJRTYpXG4gKi9cbkJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgPSAoZnVuY3Rpb24gKCkge1xuICAvLyBEZXRlY3QgaWYgYnJvd3NlciBzdXBwb3J0cyBUeXBlZCBBcnJheXMuIFN1cHBvcnRlZCBicm93c2VycyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLFxuICAvLyBDaHJvbWUgNyssIFNhZmFyaSA1LjErLCBPcGVyYSAxMS42KywgaU9TIDQuMisuIElmIHRoZSBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgYWRkaW5nXG4gIC8vIHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcywgdGhlbiB0aGF0J3MgdGhlIHNhbWUgYXMgbm8gYFVpbnQ4QXJyYXlgIHN1cHBvcnRcbiAgLy8gYmVjYXVzZSB3ZSBuZWVkIHRvIGJlIGFibGUgdG8gYWRkIGFsbCB0aGUgbm9kZSBCdWZmZXIgQVBJIG1ldGhvZHMuIFRoaXMgaXMgYW4gaXNzdWVcbiAgLy8gaW4gRmlyZWZveCA0LTI5LiBOb3cgZml4ZWQ6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOFxuICB0cnkge1xuICAgIHZhciBidWYgPSBuZXcgQXJyYXlCdWZmZXIoMClcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnVmKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIDQyID09PSBhcnIuZm9vKCkgJiZcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAvLyBDaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59KSgpXG5cbi8qKlxuICogQ2xhc3M6IEJ1ZmZlclxuICogPT09PT09PT09PT09PVxuICpcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgYXJlIGF1Z21lbnRlZFxuICogd2l0aCBmdW5jdGlvbiBwcm9wZXJ0aWVzIGZvciBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgQVBJIGZ1bmN0aW9ucy4gV2UgdXNlXG4gKiBgVWludDhBcnJheWAgc28gdGhhdCBzcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdCByZXR1cm5zXG4gKiBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBCeSBhdWdtZW50aW5nIHRoZSBpbnN0YW5jZXMsIHdlIGNhbiBhdm9pZCBtb2RpZnlpbmcgdGhlIGBVaW50OEFycmF5YFxuICogcHJvdG90eXBlLlxuICovXG5mdW5jdGlvbiBCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybylcblxuICB2YXIgdHlwZSA9IHR5cGVvZiBzdWJqZWN0XG5cbiAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JyAmJiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIHN1YmplY3QgPSBiYXNlNjRjbGVhbihzdWJqZWN0KVxuICB9XG5cbiAgLy8gRmluZCB0aGUgbGVuZ3RoXG4gIHZhciBsZW5ndGhcbiAgaWYgKHR5cGUgPT09ICdudW1iZXInKVxuICAgIGxlbmd0aCA9IGNvZXJjZShzdWJqZWN0KVxuICBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJylcbiAgICBsZW5ndGggPSBCdWZmZXIuYnl0ZUxlbmd0aChzdWJqZWN0LCBlbmNvZGluZylcbiAgZWxzZSBpZiAodHlwZSA9PT0gJ29iamVjdCcpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QubGVuZ3RoKSAvLyBhc3N1bWUgdGhhdCBvYmplY3QgaXMgYXJyYXktbGlrZVxuICBlbHNlXG4gICAgdGhyb3cgbmV3IEVycm9yKCdGaXJzdCBhcmd1bWVudCBuZWVkcyB0byBiZSBhIG51bWJlciwgYXJyYXkgb3Igc3RyaW5nLicpXG5cbiAgdmFyIGJ1ZlxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIC8vIFByZWZlcnJlZDogUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICBidWYgPSBCdWZmZXIuX2F1Z21lbnQobmV3IFVpbnQ4QXJyYXkobGVuZ3RoKSlcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIFRISVMgaW5zdGFuY2Ugb2YgQnVmZmVyIChjcmVhdGVkIGJ5IGBuZXdgKVxuICAgIGJ1ZiA9IHRoaXNcbiAgICBidWYubGVuZ3RoID0gbGVuZ3RoXG4gICAgYnVmLl9pc0J1ZmZlciA9IHRydWVcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzICYmIHR5cGVvZiBzdWJqZWN0LmJ5dGVMZW5ndGggPT09ICdudW1iZXInKSB7XG4gICAgLy8gU3BlZWQgb3B0aW1pemF0aW9uIC0tIHVzZSBzZXQgaWYgd2UncmUgY29weWluZyBmcm9tIGEgdHlwZWQgYXJyYXlcbiAgICBidWYuX3NldChzdWJqZWN0KVxuICB9IGVsc2UgaWYgKGlzQXJyYXlpc2goc3ViamVjdCkpIHtcbiAgICAvLyBUcmVhdCBhcnJheS1pc2ggb2JqZWN0cyBhcyBhIGJ5dGUgYXJyYXlcbiAgICBpZiAoQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpKSB7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspXG4gICAgICAgIGJ1ZltpXSA9IHN1YmplY3QucmVhZFVJbnQ4KGkpXG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKylcbiAgICAgICAgYnVmW2ldID0gKChzdWJqZWN0W2ldICUgMjU2KSArIDI1NikgJSAyNTZcbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBidWYud3JpdGUoc3ViamVjdCwgMCwgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicgJiYgIUJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgIW5vWmVybykge1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgYnVmW2ldID0gMFxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBidWZcbn1cblxuLy8gU1RBVElDIE1FVEhPRFNcbi8vID09PT09PT09PT09PT09XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiAoYikge1xuICByZXR1cm4gISEoYiAhPT0gbnVsbCAmJiBiICE9PSB1bmRlZmluZWQgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gZnVuY3Rpb24gKHN0ciwgZW5jb2RpbmcpIHtcbiAgdmFyIHJldFxuICBzdHIgPSBzdHIudG9TdHJpbmcoKVxuICBzd2l0Y2ggKGVuY29kaW5nIHx8ICd1dGY4Jykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoIC8gMlxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdyYXcnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gYmFzZTY0VG9CeXRlcyhzdHIpLmxlbmd0aFxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCAqIDJcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gKGxpc3QsIHRvdGFsTGVuZ3RoKSB7XG4gIGFzc2VydChpc0FycmF5KGxpc3QpLCAnVXNhZ2U6IEJ1ZmZlci5jb25jYXQobGlzdFssIGxlbmd0aF0pJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9IGVsc2UgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGxpc3RbMF1cbiAgfVxuXG4gIHZhciBpXG4gIGlmICh0b3RhbExlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdG90YWxMZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRvdGFsTGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIodG90YWxMZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiAoYSwgYikge1xuICBhc3NlcnQoQnVmZmVyLmlzQnVmZmVyKGEpICYmIEJ1ZmZlci5pc0J1ZmZlcihiKSwgJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuICYmIGFbaV0gPT09IGJbaV07IGkrKykge31cbiAgaWYgKGkgIT09IGxlbikge1xuICAgIHggPSBhW2ldXG4gICAgeSA9IGJbaV1cbiAgfVxuICBpZiAoeCA8IHkpIHtcbiAgICByZXR1cm4gLTFcbiAgfVxuICBpZiAoeSA8IHgpIHtcbiAgICByZXR1cm4gMVxuICB9XG4gIHJldHVybiAwXG59XG5cbi8vIEJVRkZFUiBJTlNUQU5DRSBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGFzc2VydChzdHJMZW4gJSAyID09PSAwLCAnSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGJ5dGUgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgYXNzZXJ0KCFpc05hTihieXRlKSwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG4gICAgYnVmW29mZnNldCArIGldID0gYnl0ZVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiB1dGYxNmxlV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gU3VwcG9ydCBib3RoIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZylcbiAgLy8gYW5kIHRoZSBsZWdhY3kgKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIGlmICghaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSBlbHNlIHsgIC8vIGxlZ2FjeVxuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aFxuICAgIGxlbmd0aCA9IHN3YXBcbiAgfVxuXG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cbiAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpXG5cbiAgdmFyIHJldFxuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICByZXQgPSBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IHV0ZjE2bGVXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpXG4gIHN0YXJ0ID0gTnVtYmVyKHN0YXJ0KSB8fCAwXG4gIGVuZCA9IChlbmQgPT09IHVuZGVmaW5lZCkgPyBzZWxmLmxlbmd0aCA6IE51bWJlcihlbmQpXG5cbiAgLy8gRmFzdHBhdGggZW1wdHkgc3RyaW5nc1xuICBpZiAoZW5kID09PSBzdGFydClcbiAgICByZXR1cm4gJydcblxuICB2YXIgcmV0XG4gIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gaGV4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gdXRmOFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIHJldCA9IGFzY2lpU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIHJldCA9IGJpbmFyeVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gdXRmMTZsZVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiAoYikge1xuICBhc3NlcnQoQnVmZmVyLmlzQnVmZmVyKGIpLCAnQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiAoYikge1xuICBhc3NlcnQoQnVmZmVyLmlzQnVmZmVyKGIpLCAnQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiAodGFyZ2V0LCB0YXJnZXRfc3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXNcblxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoIXRhcmdldF9zdGFydCkgdGFyZ2V0X3N0YXJ0ID0gMFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHNvdXJjZS5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ3NvdXJjZUVuZCA8IHNvdXJjZVN0YXJ0JylcbiAgYXNzZXJ0KHRhcmdldF9zdGFydCA+PSAwICYmIHRhcmdldF9zdGFydCA8IHRhcmdldC5sZW5ndGgsXG4gICAgICAndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgc291cmNlLmxlbmd0aCwgJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKVxuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0IDwgZW5kIC0gc3RhcnQpXG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCArIHN0YXJ0XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKGxlbiA8IDEwMCB8fCAhQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0X3N0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldF9zdGFydClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJlcyA9ICcnXG4gIHZhciB0bXAgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBpZiAoYnVmW2ldIDw9IDB4N0YpIHtcbiAgICAgIHJlcyArPSBkZWNvZGVVdGY4Q2hhcih0bXApICsgU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gICAgICB0bXAgPSAnJ1xuICAgIH0gZWxzZSB7XG4gICAgICB0bXAgKz0gJyUnICsgYnVmW2ldLnRvU3RyaW5nKDE2KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXMgKyBkZWNvZGVVdGY4Q2hhcih0bXApXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICByZXR1cm4gYXNjaWlTbGljZShidWYsIHN0YXJ0LCBlbmQpXG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gY2xhbXAoc3RhcnQsIGxlbiwgMClcbiAgZW5kID0gY2xhbXAoZW5kLCBsZW4sIGxlbilcblxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgIHJldHVybiBCdWZmZXIuX2F1Z21lbnQodGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIHZhciBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQsIHRydWUpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gICAgcmV0dXJuIG5ld0J1ZlxuICB9XG59XG5cbi8vIGBnZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5nZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLnJlYWRVSW50OChvZmZzZXQpXG59XG5cbi8vIGBzZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uICh2LCBvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5zZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLndyaXRlVUludDgodiwgb2Zmc2V0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiByZWFkVUludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgdmFsID0gYnVmW29mZnNldF1cbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICB9IGVsc2Uge1xuICAgIHZhbCA9IGJ1ZltvZmZzZXRdIDw8IDhcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV1cbiAgfVxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRVSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZFVJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gcmVhZFVJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWxcbiAgaWYgKGxpdHRsZUVuZGlhbikge1xuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsID0gYnVmW29mZnNldCArIDJdIDw8IDE2XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdIDw8IDhcbiAgICB2YWwgfD0gYnVmW29mZnNldF1cbiAgICBpZiAob2Zmc2V0ICsgMyA8IGxlbilcbiAgICAgIHZhbCA9IHZhbCArIChidWZbb2Zmc2V0ICsgM10gPDwgMjQgPj4+IDApXG4gIH0gZWxzZSB7XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMV0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMiA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMl0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAzXVxuICAgIHZhbCA9IHZhbCArIChidWZbb2Zmc2V0XSA8PCAyNCA+Pj4gMClcbiAgfVxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRVSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZFVJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLFxuICAgICAgICAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgdmFyIG5lZyA9IHRoaXNbb2Zmc2V0XSAmIDB4ODBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbmZ1bmN0aW9uIHJlYWRJbnQxNiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSByZWFkVUludDE2KGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkSW50MTYodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHJlYWRJbnQzMiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWwgPSByZWFkVUludDMyKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIHRydWUpXG4gIHZhciBuZWcgPSB2YWwgJiAweDgwMDAwMDAwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmZmZmZmZmIC0gdmFsICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRJbnQzMih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRJbnQzMih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gcmVhZEZsb2F0IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHJldHVybiBpZWVlNzU0LnJlYWQoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZEZsb2F0KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiByZWFkRG91YmxlIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgKyA3IDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHJldHVybiBpZWVlNzU0LnJlYWQoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWREb3VibGUodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmYpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm5cblxuICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiB3cml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmZmYpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGxlbiAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPVxuICAgICAgICAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmZmZmZmZmYpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGxlbiAtIG9mZnNldCwgNCk7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPVxuICAgICAgICAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2YsIC0weDgwKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICB0aGlzLndyaXRlVUludDgodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICB0aGlzLndyaXRlVUludDgoMHhmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBub0Fzc2VydClcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gd3JpdGVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmYsIC0weDgwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICB3cml0ZVVJbnQxNihidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICB3cml0ZVVJbnQxNihidWYsIDB4ZmZmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgd3JpdGVVSW50MzIoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgd3JpdGVVSW50MzIoYnVmLCAweGZmZmZmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsXG4gICAgICAgICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmSUVFRTc1NCh2YWx1ZSwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCB0aGlzLmxlbmd0aCwgJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoZW5kID49IDAgJiYgZW5kIDw9IHRoaXMubGVuZ3RoLCAnZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IHZhbHVlXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IHV0ZjhUb0J5dGVzKHZhbHVlLnRvU3RyaW5nKCkpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIG91dCA9IFtdXG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgb3V0W2ldID0gdG9IZXgodGhpc1tpXSlcbiAgICBpZiAoaSA9PT0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUykge1xuICAgICAgb3V0W2kgKyAxXSA9ICcuLi4nXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIG91dC5qb2luKCcgJykgKyAnPidcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGBBcnJheUJ1ZmZlcmAgd2l0aCB0aGUgKmNvcGllZCogbWVtb3J5IG9mIHRoZSBidWZmZXIgaW5zdGFuY2UuXG4gKiBBZGRlZCBpbiBOb2RlIDAuMTIuIE9ubHkgYXZhaWxhYmxlIGluIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBBcnJheUJ1ZmZlci5cbiAqL1xuQnVmZmVyLnByb3RvdHlwZS50b0FycmF5QnVmZmVyID0gZnVuY3Rpb24gKCkge1xuICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICAgIHJldHVybiAobmV3IEJ1ZmZlcih0aGlzKSkuYnVmZmVyXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBidWYgPSBuZXcgVWludDhBcnJheSh0aGlzLmxlbmd0aClcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBidWYubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEpIHtcbiAgICAgICAgYnVmW2ldID0gdGhpc1tpXVxuICAgICAgfVxuICAgICAgcmV0dXJuIGJ1Zi5idWZmZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBnZXQvc2V0IG1ldGhvZHMgYmVmb3JlIG92ZXJ3cml0aW5nXG4gIGFyci5fZ2V0ID0gYXJyLmdldFxuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkLCB3aWxsIGJlIHJlbW92ZWQgaW4gbm9kZSAwLjEzK1xuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5lcXVhbHMgPSBCUC5lcXVhbHNcbiAgYXJyLmNvbXBhcmUgPSBCUC5jb21wYXJlXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS16XS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0cmluZ3RyaW0oc3RyKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuLy8gc2xpY2Uoc3RhcnQsIGVuZClcbmZ1bmN0aW9uIGNsYW1wIChpbmRleCwgbGVuLCBkZWZhdWx0VmFsdWUpIHtcbiAgaWYgKHR5cGVvZiBpbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBkZWZhdWx0VmFsdWVcbiAgaW5kZXggPSB+fmluZGV4OyAgLy8gQ29lcmNlIHRvIGludGVnZXIuXG4gIGlmIChpbmRleCA+PSBsZW4pIHJldHVybiBsZW5cbiAgaWYgKGluZGV4ID49IDApIHJldHVybiBpbmRleFxuICBpbmRleCArPSBsZW5cbiAgaWYgKGluZGV4ID49IDApIHJldHVybiBpbmRleFxuICByZXR1cm4gMFxufVxuXG5mdW5jdGlvbiBjb2VyY2UgKGxlbmd0aCkge1xuICAvLyBDb2VyY2UgbGVuZ3RoIHRvIGEgbnVtYmVyIChwb3NzaWJseSBOYU4pLCByb3VuZCB1cFxuICAvLyBpbiBjYXNlIGl0J3MgZnJhY3Rpb25hbCAoZS5nLiAxMjMuNDU2KSB0aGVuIGRvIGFcbiAgLy8gZG91YmxlIG5lZ2F0ZSB0byBjb2VyY2UgYSBOYU4gdG8gMC4gRWFzeSwgcmlnaHQ/XG4gIGxlbmd0aCA9IH5+TWF0aC5jZWlsKCtsZW5ndGgpXG4gIHJldHVybiBsZW5ndGggPCAwID8gMCA6IGxlbmd0aFxufVxuXG5mdW5jdGlvbiBpc0FycmF5IChzdWJqZWN0KSB7XG4gIHJldHVybiAoQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoc3ViamVjdCkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc3ViamVjdCkgPT09ICdbb2JqZWN0IEFycmF5XSdcbiAgfSkoc3ViamVjdClcbn1cblxuZnVuY3Rpb24gaXNBcnJheWlzaCAoc3ViamVjdCkge1xuICByZXR1cm4gaXNBcnJheShzdWJqZWN0KSB8fCBCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkgfHxcbiAgICAgIHN1YmplY3QgJiYgdHlwZW9mIHN1YmplY3QgPT09ICdvYmplY3QnICYmXG4gICAgICB0eXBlb2Ygc3ViamVjdC5sZW5ndGggPT09ICdudW1iZXInXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYiA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaWYgKGIgPD0gMHg3Rikge1xuICAgICAgYnl0ZUFycmF5LnB1c2goYilcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHN0YXJ0ID0gaVxuICAgICAgaWYgKGIgPj0gMHhEODAwICYmIGIgPD0gMHhERkZGKSBpKytcbiAgICAgIHZhciBoID0gZW5jb2RlVVJJQ29tcG9uZW50KHN0ci5zbGljZShzdGFydCwgaSsxKSkuc3Vic3RyKDEpLnNwbGl0KCclJylcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgaC5sZW5ndGg7IGorKykge1xuICAgICAgICBieXRlQXJyYXkucHVzaChwYXJzZUludChoW2pdLCAxNikpXG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KHN0cilcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpXG4gICAgICBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIGRlY29kZVV0ZjhDaGFyIChzdHIpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHN0cilcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoMHhGRkZEKSAvLyBVVEYgOCBpbnZhbGlkIGNoYXJcbiAgfVxufVxuXG4vKlxuICogV2UgaGF2ZSB0byBtYWtlIHN1cmUgdGhhdCB0aGUgdmFsdWUgaXMgYSB2YWxpZCBpbnRlZ2VyLiBUaGlzIG1lYW5zIHRoYXQgaXRcbiAqIGlzIG5vbi1uZWdhdGl2ZS4gSXQgaGFzIG5vIGZyYWN0aW9uYWwgY29tcG9uZW50IGFuZCB0aGF0IGl0IGRvZXMgbm90XG4gKiBleGNlZWQgdGhlIG1heGltdW0gYWxsb3dlZCB2YWx1ZS5cbiAqL1xuZnVuY3Rpb24gdmVyaWZ1aW50ICh2YWx1ZSwgbWF4KSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA+PSAwLCAnc3BlY2lmaWVkIGEgbmVnYXRpdmUgdmFsdWUgZm9yIHdyaXRpbmcgYW4gdW5zaWduZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgaXMgbGFyZ2VyIHRoYW4gbWF4aW11bSB2YWx1ZSBmb3IgdHlwZScpXG4gIGFzc2VydChNYXRoLmZsb29yKHZhbHVlKSA9PT0gdmFsdWUsICd2YWx1ZSBoYXMgYSBmcmFjdGlvbmFsIGNvbXBvbmVudCcpXG59XG5cbmZ1bmN0aW9uIHZlcmlmc2ludCAodmFsdWUsIG1heCwgbWluKSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBsYXJnZXIgdGhhbiBtYXhpbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPj0gbWluLCAndmFsdWUgc21hbGxlciB0aGFuIG1pbmltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydChNYXRoLmZsb29yKHZhbHVlKSA9PT0gdmFsdWUsICd2YWx1ZSBoYXMgYSBmcmFjdGlvbmFsIGNvbXBvbmVudCcpXG59XG5cbmZ1bmN0aW9uIHZlcmlmSUVFRTc1NCAodmFsdWUsIG1heCwgbWluKSB7XG4gIGFzc2VydCh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInLCAnY2Fubm90IHdyaXRlIGEgbm9uLW51bWJlciBhcyBhIG51bWJlcicpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBsYXJnZXIgdGhhbiBtYXhpbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQodmFsdWUgPj0gbWluLCAndmFsdWUgc21hbGxlciB0aGFuIG1pbmltdW0gYWxsb3dlZCB2YWx1ZScpXG59XG5cbmZ1bmN0aW9uIGFzc2VydCAodGVzdCwgbWVzc2FnZSkge1xuICBpZiAoIXRlc3QpIHRocm93IG5ldyBFcnJvcihtZXNzYWdlIHx8ICdGYWlsZWQgYXNzZXJ0aW9uJylcbn1cbiIsInZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMpXG5cdFx0XHRyZXR1cm4gNjIgLy8gJysnXG5cdFx0aWYgKGNvZGUgPT09IFNMQVNIKVxuXHRcdFx0cmV0dXJuIDYzIC8vICcvJ1xuXHRcdGlmIChjb2RlIDwgTlVNQkVSKVxuXHRcdFx0cmV0dXJuIC0xIC8vbm8gbWF0Y2hcblx0XHRpZiAoY29kZSA8IE5VTUJFUiArIDEwKVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBOVU1CRVIgKyAyNiArIDI2XG5cdFx0aWYgKGNvZGUgPCBVUFBFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBVUFBFUlxuXHRcdGlmIChjb2RlIDwgTE9XRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gTE9XRVIgKyAyNlxuXHR9XG5cblx0ZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuXHRcdHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cblx0XHRpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuXHRcdH1cblxuXHRcdC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuXHRcdC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuXHRcdC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuXHRcdC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2Vcblx0XHR2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXHRcdHBsYWNlSG9sZGVycyA9ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAyKSA/IDIgOiAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMSkgPyAxIDogMFxuXG5cdFx0Ly8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5cdFx0YXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cblx0XHQvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG5cdFx0bCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuXHRcdHZhciBMID0gMFxuXG5cdFx0ZnVuY3Rpb24gcHVzaCAodikge1xuXHRcdFx0YXJyW0wrK10gPSB2XG5cdFx0fVxuXG5cdFx0Zm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcblx0XHRcdHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG5cdFx0XHRwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdHJldHVybiBhcnJcblx0fVxuXG5cdGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG5cdFx0dmFyIGksXG5cdFx0XHRleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMywgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcblx0XHRcdG91dHB1dCA9IFwiXCIsXG5cdFx0XHR0ZW1wLCBsZW5ndGhcblxuXHRcdGZ1bmN0aW9uIGVuY29kZSAobnVtKSB7XG5cdFx0XHRyZXR1cm4gbG9va3VwLmNoYXJBdChudW0pXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcblx0XHRcdHJldHVybiBlbmNvZGUobnVtID4+IDE4ICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDEyICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDYgJiAweDNGKSArIGVuY29kZShudW0gJiAweDNGKVxuXHRcdH1cblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcblx0XHRmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcblx0XHRcdHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG5cdFx0XHRvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApXG5cdFx0fVxuXG5cdFx0Ly8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuXHRcdHN3aXRjaCAoZXh0cmFCeXRlcykge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHR0ZW1wID0gdWludDhbdWludDgubGVuZ3RoIC0gMV1cblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDIpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz09J1xuXHRcdFx0XHRicmVha1xuXHRcdFx0Y2FzZSAyOlxuXHRcdFx0XHR0ZW1wID0gKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDJdIDw8IDgpICsgKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMTApXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPj4gNCkgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDIpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9J1xuXHRcdFx0XHRicmVha1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXRcblx0fVxuXG5cdGV4cG9ydHMudG9CeXRlQXJyYXkgPSBiNjRUb0J5dGVBcnJheVxuXHRleHBvcnRzLmZyb21CeXRlQXJyYXkgPSB1aW50OFRvQmFzZTY0XG59KHR5cGVvZiBleHBvcnRzID09PSAndW5kZWZpbmVkJyA/ICh0aGlzLmJhc2U2NGpzID0ge30pIDogZXhwb3J0cykpXG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbihidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLFxuICAgICAgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMSxcbiAgICAgIGVNYXggPSAoMSA8PCBlTGVuKSAtIDEsXG4gICAgICBlQmlhcyA9IGVNYXggPj4gMSxcbiAgICAgIG5CaXRzID0gLTcsXG4gICAgICBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDAsXG4gICAgICBkID0gaXNMRSA/IC0xIDogMSxcbiAgICAgIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV07XG5cbiAgaSArPSBkO1xuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpO1xuICBzID4+PSAoLW5CaXRzKTtcbiAgbkJpdHMgKz0gZUxlbjtcbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCk7XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIGUgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBtTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXM7XG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KTtcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pO1xuICAgIGUgPSBlIC0gZUJpYXM7XG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbik7XG59O1xuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24oYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGMsXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApLFxuICAgICAgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpLFxuICAgICAgZCA9IGlzTEUgPyAxIDogLTEsXG4gICAgICBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwO1xuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpO1xuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwO1xuICAgIGUgPSBlTWF4O1xuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKTtcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS07XG4gICAgICBjICo9IDI7XG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcyk7XG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrO1xuICAgICAgYyAvPSAyO1xuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDA7XG4gICAgICBlID0gZU1heDtcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gZSArIGVCaWFzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbik7XG4gICAgICBlID0gMDtcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KTtcblxuICBlID0gKGUgPDwgbUxlbikgfCBtO1xuICBlTGVuICs9IG1MZW47XG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCk7XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4O1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvY2hhaScpO1xuIiwiLyohXG4gKiBjaGFpXG4gKiBDb3B5cmlnaHQoYykgMjAxMS0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxudmFyIHVzZWQgPSBbXVxuICAsIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vKiFcbiAqIENoYWkgdmVyc2lvblxuICovXG5cbmV4cG9ydHMudmVyc2lvbiA9ICcxLjkuMSc7XG5cbi8qIVxuICogQXNzZXJ0aW9uIEVycm9yXG4gKi9cblxuZXhwb3J0cy5Bc3NlcnRpb25FcnJvciA9IHJlcXVpcmUoJ2Fzc2VydGlvbi1lcnJvcicpO1xuXG4vKiFcbiAqIFV0aWxzIGZvciBwbHVnaW5zIChub3QgZXhwb3J0ZWQpXG4gKi9cblxudmFyIHV0aWwgPSByZXF1aXJlKCcuL2NoYWkvdXRpbHMnKTtcblxuLyoqXG4gKiAjIC51c2UoZnVuY3Rpb24pXG4gKlxuICogUHJvdmlkZXMgYSB3YXkgdG8gZXh0ZW5kIHRoZSBpbnRlcm5hbHMgb2YgQ2hhaVxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259XG4gKiBAcmV0dXJucyB7dGhpc30gZm9yIGNoYWluaW5nXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmV4cG9ydHMudXNlID0gZnVuY3Rpb24gKGZuKSB7XG4gIGlmICghfnVzZWQuaW5kZXhPZihmbikpIHtcbiAgICBmbih0aGlzLCB1dGlsKTtcbiAgICB1c2VkLnB1c2goZm4pO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKiFcbiAqIENvbmZpZ3VyYXRpb25cbiAqL1xuXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jaGFpL2NvbmZpZycpO1xuZXhwb3J0cy5jb25maWcgPSBjb25maWc7XG5cbi8qIVxuICogUHJpbWFyeSBgQXNzZXJ0aW9uYCBwcm90b3R5cGVcbiAqL1xuXG52YXIgYXNzZXJ0aW9uID0gcmVxdWlyZSgnLi9jaGFpL2Fzc2VydGlvbicpO1xuZXhwb3J0cy51c2UoYXNzZXJ0aW9uKTtcblxuLyohXG4gKiBDb3JlIEFzc2VydGlvbnNcbiAqL1xuXG52YXIgY29yZSA9IHJlcXVpcmUoJy4vY2hhaS9jb3JlL2Fzc2VydGlvbnMnKTtcbmV4cG9ydHMudXNlKGNvcmUpO1xuXG4vKiFcbiAqIEV4cGVjdCBpbnRlcmZhY2VcbiAqL1xuXG52YXIgZXhwZWN0ID0gcmVxdWlyZSgnLi9jaGFpL2ludGVyZmFjZS9leHBlY3QnKTtcbmV4cG9ydHMudXNlKGV4cGVjdCk7XG5cbi8qIVxuICogU2hvdWxkIGludGVyZmFjZVxuICovXG5cbnZhciBzaG91bGQgPSByZXF1aXJlKCcuL2NoYWkvaW50ZXJmYWNlL3Nob3VsZCcpO1xuZXhwb3J0cy51c2Uoc2hvdWxkKTtcblxuLyohXG4gKiBBc3NlcnQgaW50ZXJmYWNlXG4gKi9cblxudmFyIGFzc2VydCA9IHJlcXVpcmUoJy4vY2hhaS9pbnRlcmZhY2UvYXNzZXJ0Jyk7XG5leHBvcnRzLnVzZShhc3NlcnQpO1xuIiwiLyohXG4gKiBjaGFpXG4gKiBodHRwOi8vY2hhaWpzLmNvbVxuICogQ29weXJpZ2h0KGMpIDIwMTEtMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbnZhciBjb25maWcgPSByZXF1aXJlKCcuL2NvbmZpZycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChfY2hhaSwgdXRpbCkge1xuICAvKiFcbiAgICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAgICovXG5cbiAgdmFyIEFzc2VydGlvbkVycm9yID0gX2NoYWkuQXNzZXJ0aW9uRXJyb3JcbiAgICAsIGZsYWcgPSB1dGlsLmZsYWc7XG5cbiAgLyohXG4gICAqIE1vZHVsZSBleHBvcnQuXG4gICAqL1xuXG4gIF9jaGFpLkFzc2VydGlvbiA9IEFzc2VydGlvbjtcblxuICAvKiFcbiAgICogQXNzZXJ0aW9uIENvbnN0cnVjdG9yXG4gICAqXG4gICAqIENyZWF0ZXMgb2JqZWN0IGZvciBjaGFpbmluZy5cbiAgICpcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIGZ1bmN0aW9uIEFzc2VydGlvbiAob2JqLCBtc2csIHN0YWNrKSB7XG4gICAgZmxhZyh0aGlzLCAnc3NmaScsIHN0YWNrIHx8IGFyZ3VtZW50cy5jYWxsZWUpO1xuICAgIGZsYWcodGhpcywgJ29iamVjdCcsIG9iaik7XG4gICAgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQXNzZXJ0aW9uLCAnaW5jbHVkZVN0YWNrJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ0Fzc2VydGlvbi5pbmNsdWRlU3RhY2sgaXMgZGVwcmVjYXRlZCwgdXNlIGNoYWkuY29uZmlnLmluY2x1ZGVTdGFjayBpbnN0ZWFkLicpO1xuICAgICAgcmV0dXJuIGNvbmZpZy5pbmNsdWRlU3RhY2s7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ0Fzc2VydGlvbi5pbmNsdWRlU3RhY2sgaXMgZGVwcmVjYXRlZCwgdXNlIGNoYWkuY29uZmlnLmluY2x1ZGVTdGFjayBpbnN0ZWFkLicpO1xuICAgICAgY29uZmlnLmluY2x1ZGVTdGFjayA9IHZhbHVlO1xuICAgIH1cbiAgfSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEFzc2VydGlvbiwgJ3Nob3dEaWZmJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ0Fzc2VydGlvbi5zaG93RGlmZiBpcyBkZXByZWNhdGVkLCB1c2UgY2hhaS5jb25maWcuc2hvd0RpZmYgaW5zdGVhZC4nKTtcbiAgICAgIHJldHVybiBjb25maWcuc2hvd0RpZmY7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ0Fzc2VydGlvbi5zaG93RGlmZiBpcyBkZXByZWNhdGVkLCB1c2UgY2hhaS5jb25maWcuc2hvd0RpZmYgaW5zdGVhZC4nKTtcbiAgICAgIGNvbmZpZy5zaG93RGlmZiA9IHZhbHVlO1xuICAgIH1cbiAgfSk7XG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5ID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gICAgdXRpbC5hZGRQcm9wZXJ0eSh0aGlzLnByb3RvdHlwZSwgbmFtZSwgZm4pO1xuICB9O1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgICB1dGlsLmFkZE1ldGhvZCh0aGlzLnByb3RvdHlwZSwgbmFtZSwgZm4pO1xuICB9O1xuXG4gIEFzc2VydGlvbi5hZGRDaGFpbmFibGVNZXRob2QgPSBmdW5jdGlvbiAobmFtZSwgZm4sIGNoYWluaW5nQmVoYXZpb3IpIHtcbiAgICB1dGlsLmFkZENoYWluYWJsZU1ldGhvZCh0aGlzLnByb3RvdHlwZSwgbmFtZSwgZm4sIGNoYWluaW5nQmVoYXZpb3IpO1xuICB9O1xuXG4gIEFzc2VydGlvbi5vdmVyd3JpdGVQcm9wZXJ0eSA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICAgIHV0aWwub3ZlcndyaXRlUHJvcGVydHkodGhpcy5wcm90b3R5cGUsIG5hbWUsIGZuKTtcbiAgfTtcblxuICBBc3NlcnRpb24ub3ZlcndyaXRlTWV0aG9kID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gICAgdXRpbC5vdmVyd3JpdGVNZXRob2QodGhpcy5wcm90b3R5cGUsIG5hbWUsIGZuKTtcbiAgfTtcblxuICBBc3NlcnRpb24ub3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kID0gZnVuY3Rpb24gKG5hbWUsIGZuLCBjaGFpbmluZ0JlaGF2aW9yKSB7XG4gICAgdXRpbC5vdmVyd3JpdGVDaGFpbmFibGVNZXRob2QodGhpcy5wcm90b3R5cGUsIG5hbWUsIGZuLCBjaGFpbmluZ0JlaGF2aW9yKTtcbiAgfTtcblxuICAvKiFcbiAgICogIyMjIC5hc3NlcnQoZXhwcmVzc2lvbiwgbWVzc2FnZSwgbmVnYXRlTWVzc2FnZSwgZXhwZWN0ZWQsIGFjdHVhbClcbiAgICpcbiAgICogRXhlY3V0ZXMgYW4gZXhwcmVzc2lvbiBhbmQgY2hlY2sgZXhwZWN0YXRpb25zLiBUaHJvd3MgQXNzZXJ0aW9uRXJyb3IgZm9yIHJlcG9ydGluZyBpZiB0ZXN0IGRvZXNuJ3QgcGFzcy5cbiAgICpcbiAgICogQG5hbWUgYXNzZXJ0XG4gICAqIEBwYXJhbSB7UGhpbG9zb3BoaWNhbH0gZXhwcmVzc2lvbiB0byBiZSB0ZXN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgdG8gZGlzcGxheSBpZiBmYWlsc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gbmVnYXRlZE1lc3NhZ2UgdG8gZGlzcGxheSBpZiBuZWdhdGVkIGV4cHJlc3Npb24gZmFpbHNcbiAgICogQHBhcmFtIHtNaXhlZH0gZXhwZWN0ZWQgdmFsdWUgKHJlbWVtYmVyIHRvIGNoZWNrIGZvciBuZWdhdGlvbilcbiAgICogQHBhcmFtIHtNaXhlZH0gYWN0dWFsIChvcHRpb25hbCkgd2lsbCBkZWZhdWx0IHRvIGB0aGlzLm9iamBcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIEFzc2VydGlvbi5wcm90b3R5cGUuYXNzZXJ0ID0gZnVuY3Rpb24gKGV4cHIsIG1zZywgbmVnYXRlTXNnLCBleHBlY3RlZCwgX2FjdHVhbCwgc2hvd0RpZmYpIHtcbiAgICB2YXIgb2sgPSB1dGlsLnRlc3QodGhpcywgYXJndW1lbnRzKTtcbiAgICBpZiAodHJ1ZSAhPT0gc2hvd0RpZmYpIHNob3dEaWZmID0gZmFsc2U7XG4gICAgaWYgKHRydWUgIT09IGNvbmZpZy5zaG93RGlmZikgc2hvd0RpZmYgPSBmYWxzZTtcblxuICAgIGlmICghb2spIHtcbiAgICAgIHZhciBtc2cgPSB1dGlsLmdldE1lc3NhZ2UodGhpcywgYXJndW1lbnRzKVxuICAgICAgICAsIGFjdHVhbCA9IHV0aWwuZ2V0QWN0dWFsKHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnLCB7XG4gICAgICAgICAgYWN0dWFsOiBhY3R1YWxcbiAgICAgICAgLCBleHBlY3RlZDogZXhwZWN0ZWRcbiAgICAgICAgLCBzaG93RGlmZjogc2hvd0RpZmZcbiAgICAgIH0sIChjb25maWcuaW5jbHVkZVN0YWNrKSA/IHRoaXMuYXNzZXJ0IDogZmxhZyh0aGlzLCAnc3NmaScpKTtcbiAgICB9XG4gIH07XG5cbiAgLyohXG4gICAqICMjIyAuX29ialxuICAgKlxuICAgKiBRdWljayByZWZlcmVuY2UgdG8gc3RvcmVkIGBhY3R1YWxgIHZhbHVlIGZvciBwbHVnaW4gZGV2ZWxvcGVycy5cbiAgICpcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShBc3NlcnRpb24ucHJvdG90eXBlLCAnX29iaicsXG4gICAgeyBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgICAgfVxuICAgICwgc2V0OiBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgIGZsYWcodGhpcywgJ29iamVjdCcsIHZhbCk7XG4gICAgICB9XG4gIH0pO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIC8qKlxuICAgKiAjIyMgY29uZmlnLmluY2x1ZGVTdGFja1xuICAgKlxuICAgKiBVc2VyIGNvbmZpZ3VyYWJsZSBwcm9wZXJ0eSwgaW5mbHVlbmNlcyB3aGV0aGVyIHN0YWNrIHRyYWNlXG4gICAqIGlzIGluY2x1ZGVkIGluIEFzc2VydGlvbiBlcnJvciBtZXNzYWdlLiBEZWZhdWx0IG9mIGZhbHNlXG4gICAqIHN1cHByZXNzZXMgc3RhY2sgdHJhY2UgaW4gdGhlIGVycm9yIG1lc3NhZ2UuXG4gICAqXG4gICAqICAgICBjaGFpLmNvbmZpZy5pbmNsdWRlU3RhY2sgPSB0cnVlOyAgLy8gZW5hYmxlIHN0YWNrIG9uIGVycm9yXG4gICAqXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn1cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgIGluY2x1ZGVTdGFjazogZmFsc2UsXG5cbiAgLyoqXG4gICAqICMjIyBjb25maWcuc2hvd0RpZmZcbiAgICpcbiAgICogVXNlciBjb25maWd1cmFibGUgcHJvcGVydHksIGluZmx1ZW5jZXMgd2hldGhlciBvciBub3RcbiAgICogdGhlIGBzaG93RGlmZmAgZmxhZyBzaG91bGQgYmUgaW5jbHVkZWQgaW4gdGhlIHRocm93blxuICAgKiBBc3NlcnRpb25FcnJvcnMuIGBmYWxzZWAgd2lsbCBhbHdheXMgYmUgYGZhbHNlYDsgYHRydWVgXG4gICAqIHdpbGwgYmUgdHJ1ZSB3aGVuIHRoZSBhc3NlcnRpb24gaGFzIHJlcXVlc3RlZCBhIGRpZmZcbiAgICogYmUgc2hvd24uXG4gICAqXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn1cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgc2hvd0RpZmY6IHRydWUsXG5cbiAgLyoqXG4gICAqICMjIyBjb25maWcudHJ1bmNhdGVUaHJlc2hvbGRcbiAgICpcbiAgICogVXNlciBjb25maWd1cmFibGUgcHJvcGVydHksIHNldHMgbGVuZ3RoIHRocmVzaG9sZCBmb3IgYWN0dWFsIGFuZFxuICAgKiBleHBlY3RlZCB2YWx1ZXMgaW4gYXNzZXJ0aW9uIGVycm9ycy4gSWYgdGhpcyB0aHJlc2hvbGQgaXMgZXhjZWVkZWQsXG4gICAqIHRoZSB2YWx1ZSBpcyB0cnVuY2F0ZWQuXG4gICAqXG4gICAqIFNldCBpdCB0byB6ZXJvIGlmIHlvdSB3YW50IHRvIGRpc2FibGUgdHJ1bmNhdGluZyBhbHRvZ2V0aGVyLlxuICAgKlxuICAgKiAgICAgY2hhaS5jb25maWcudHJ1bmNhdGVUaHJlc2hvbGQgPSAwOyAgLy8gZGlzYWJsZSB0cnVuY2F0aW5nXG4gICAqXG4gICAqIEBwYXJhbSB7TnVtYmVyfVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICB0cnVuY2F0ZVRocmVzaG9sZDogNDBcblxufTtcbiIsIi8qIVxuICogY2hhaVxuICogaHR0cDovL2NoYWlqcy5jb21cbiAqIENvcHlyaWdodChjKSAyMDExLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjaGFpLCBfKSB7XG4gIHZhciBBc3NlcnRpb24gPSBjaGFpLkFzc2VydGlvblxuICAgICwgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG4gICAgLCBmbGFnID0gXy5mbGFnO1xuXG4gIC8qKlxuICAgKiAjIyMgTGFuZ3VhZ2UgQ2hhaW5zXG4gICAqXG4gICAqIFRoZSBmb2xsb3dpbmcgYXJlIHByb3ZpZGVkIGFzIGNoYWluYWJsZSBnZXR0ZXJzIHRvXG4gICAqIGltcHJvdmUgdGhlIHJlYWRhYmlsaXR5IG9mIHlvdXIgYXNzZXJ0aW9ucy4gVGhleVxuICAgKiBkbyBub3QgcHJvdmlkZSB0ZXN0aW5nIGNhcGFiaWxpdGllcyB1bmxlc3MgdGhleVxuICAgKiBoYXZlIGJlZW4gb3ZlcndyaXR0ZW4gYnkgYSBwbHVnaW4uXG4gICAqXG4gICAqICoqQ2hhaW5zKipcbiAgICpcbiAgICogLSB0b1xuICAgKiAtIGJlXG4gICAqIC0gYmVlblxuICAgKiAtIGlzXG4gICAqIC0gdGhhdFxuICAgKiAtIGFuZFxuICAgKiAtIGhhc1xuICAgKiAtIGhhdmVcbiAgICogLSB3aXRoXG4gICAqIC0gYXRcbiAgICogLSBvZlxuICAgKiAtIHNhbWVcbiAgICpcbiAgICogQG5hbWUgbGFuZ3VhZ2UgY2hhaW5zXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIFsgJ3RvJywgJ2JlJywgJ2JlZW4nXG4gICwgJ2lzJywgJ2FuZCcsICdoYXMnLCAnaGF2ZSdcbiAgLCAnd2l0aCcsICd0aGF0JywgJ2F0J1xuICAsICdvZicsICdzYW1lJyBdLmZvckVhY2goZnVuY3Rpb24gKGNoYWluKSB7XG4gICAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KGNoYWluLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9KTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAubm90XG4gICAqXG4gICAqIE5lZ2F0ZXMgYW55IG9mIGFzc2VydGlvbnMgZm9sbG93aW5nIGluIHRoZSBjaGFpbi5cbiAgICpcbiAgICogICAgIGV4cGVjdChmb28pLnRvLm5vdC5lcXVhbCgnYmFyJyk7XG4gICAqICAgICBleHBlY3QoZ29vZEZuKS50by5ub3QudGhyb3coRXJyb3IpO1xuICAgKiAgICAgZXhwZWN0KHsgZm9vOiAnYmF6JyB9KS50by5oYXZlLnByb3BlcnR5KCdmb28nKVxuICAgKiAgICAgICAuYW5kLm5vdC5lcXVhbCgnYmFyJyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ25vdCcsIGZ1bmN0aW9uICgpIHtcbiAgICBmbGFnKHRoaXMsICduZWdhdGUnLCB0cnVlKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuZGVlcFxuICAgKlxuICAgKiBTZXRzIHRoZSBgZGVlcGAgZmxhZywgbGF0ZXIgdXNlZCBieSB0aGUgYGVxdWFsYCBhbmRcbiAgICogYHByb3BlcnR5YCBhc3NlcnRpb25zLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KGZvbykudG8uZGVlcC5lcXVhbCh7IGJhcjogJ2JheicgfSk7XG4gICAqICAgICBleHBlY3QoeyBmb286IHsgYmFyOiB7IGJhejogJ3F1dXgnIH0gfSB9KVxuICAgKiAgICAgICAudG8uaGF2ZS5kZWVwLnByb3BlcnR5KCdmb28uYmFyLmJheicsICdxdXV4Jyk7XG4gICAqXG4gICAqIEBuYW1lIGRlZXBcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdkZWVwJywgZnVuY3Rpb24gKCkge1xuICAgIGZsYWcodGhpcywgJ2RlZXAnLCB0cnVlKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuYSh0eXBlKVxuICAgKlxuICAgKiBUaGUgYGFgIGFuZCBgYW5gIGFzc2VydGlvbnMgYXJlIGFsaWFzZXMgdGhhdCBjYW4gYmVcbiAgICogdXNlZCBlaXRoZXIgYXMgbGFuZ3VhZ2UgY2hhaW5zIG9yIHRvIGFzc2VydCBhIHZhbHVlJ3NcbiAgICogdHlwZS5cbiAgICpcbiAgICogICAgIC8vIHR5cGVvZlxuICAgKiAgICAgZXhwZWN0KCd0ZXN0JykudG8uYmUuYSgnc3RyaW5nJyk7XG4gICAqICAgICBleHBlY3QoeyBmb286ICdiYXInIH0pLnRvLmJlLmFuKCdvYmplY3QnKTtcbiAgICogICAgIGV4cGVjdChudWxsKS50by5iZS5hKCdudWxsJyk7XG4gICAqICAgICBleHBlY3QodW5kZWZpbmVkKS50by5iZS5hbigndW5kZWZpbmVkJyk7XG4gICAqXG4gICAqICAgICAvLyBsYW5ndWFnZSBjaGFpblxuICAgKiAgICAgZXhwZWN0KGZvbykudG8uYmUuYW4uaW5zdGFuY2VvZihGb28pO1xuICAgKlxuICAgKiBAbmFtZSBhXG4gICAqIEBhbGlhcyBhblxuICAgKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFuICh0eXBlLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB0eXBlID0gdHlwZS50b0xvd2VyQ2FzZSgpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCBhcnRpY2xlID0gflsgJ2EnLCAnZScsICdpJywgJ28nLCAndScgXS5pbmRleE9mKHR5cGUuY2hhckF0KDApKSA/ICdhbiAnIDogJ2EgJztcblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICB0eXBlID09PSBfLnR5cGUob2JqKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSAnICsgYXJ0aWNsZSArIHR5cGVcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gbm90IHRvIGJlICcgKyBhcnRpY2xlICsgdHlwZVxuICAgICk7XG4gIH1cblxuICBBc3NlcnRpb24uYWRkQ2hhaW5hYmxlTWV0aG9kKCdhbicsIGFuKTtcbiAgQXNzZXJ0aW9uLmFkZENoYWluYWJsZU1ldGhvZCgnYScsIGFuKTtcblxuICAvKipcbiAgICogIyMjIC5pbmNsdWRlKHZhbHVlKVxuICAgKlxuICAgKiBUaGUgYGluY2x1ZGVgIGFuZCBgY29udGFpbmAgYXNzZXJ0aW9ucyBjYW4gYmUgdXNlZCBhcyBlaXRoZXIgcHJvcGVydHlcbiAgICogYmFzZWQgbGFuZ3VhZ2UgY2hhaW5zIG9yIGFzIG1ldGhvZHMgdG8gYXNzZXJ0IHRoZSBpbmNsdXNpb24gb2YgYW4gb2JqZWN0XG4gICAqIGluIGFuIGFycmF5IG9yIGEgc3Vic3RyaW5nIGluIGEgc3RyaW5nLiBXaGVuIHVzZWQgYXMgbGFuZ3VhZ2UgY2hhaW5zLFxuICAgKiB0aGV5IHRvZ2dsZSB0aGUgYGNvbnRhaW5gIGZsYWcgZm9yIHRoZSBga2V5c2AgYXNzZXJ0aW9uLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KFsxLDIsM10pLnRvLmluY2x1ZGUoMik7XG4gICAqICAgICBleHBlY3QoJ2Zvb2JhcicpLnRvLmNvbnRhaW4oJ2ZvbycpO1xuICAgKiAgICAgZXhwZWN0KHsgZm9vOiAnYmFyJywgaGVsbG86ICd1bml2ZXJzZScgfSkudG8uaW5jbHVkZS5rZXlzKCdmb28nKTtcbiAgICpcbiAgICogQG5hbWUgaW5jbHVkZVxuICAgKiBAYWxpYXMgY29udGFpblxuICAgKiBAcGFyYW0ge09iamVjdHxTdHJpbmd8TnVtYmVyfSBvYmpcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBpbmNsdWRlQ2hhaW5pbmdCZWhhdmlvciAoKSB7XG4gICAgZmxhZyh0aGlzLCAnY29udGFpbnMnLCB0cnVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGluY2x1ZGUgKHZhbCwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIHZhciBleHBlY3RlZCA9IGZhbHNlO1xuICAgIGlmIChfLnR5cGUob2JqKSA9PT0gJ2FycmF5JyAmJiBfLnR5cGUodmFsKSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGZvciAodmFyIGkgaW4gb2JqKSB7XG4gICAgICAgIGlmIChfLmVxbChvYmpbaV0sIHZhbCkpIHtcbiAgICAgICAgICBleHBlY3RlZCA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKF8udHlwZSh2YWwpID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKCFmbGFnKHRoaXMsICduZWdhdGUnKSkge1xuICAgICAgICBmb3IgKHZhciBrIGluIHZhbCkgbmV3IEFzc2VydGlvbihvYmopLnByb3BlcnR5KGssIHZhbFtrXSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHZhciBzdWJzZXQgPSB7fVxuICAgICAgZm9yICh2YXIgayBpbiB2YWwpIHN1YnNldFtrXSA9IG9ialtrXVxuICAgICAgZXhwZWN0ZWQgPSBfLmVxbChzdWJzZXQsIHZhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cGVjdGVkID0gb2JqICYmIH5vYmouaW5kZXhPZih2YWwpXG4gICAgfVxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBleHBlY3RlZFxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBpbmNsdWRlICcgKyBfLmluc3BlY3QodmFsKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaW5jbHVkZSAnICsgXy5pbnNwZWN0KHZhbCkpO1xuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZENoYWluYWJsZU1ldGhvZCgnaW5jbHVkZScsIGluY2x1ZGUsIGluY2x1ZGVDaGFpbmluZ0JlaGF2aW9yKTtcbiAgQXNzZXJ0aW9uLmFkZENoYWluYWJsZU1ldGhvZCgnY29udGFpbicsIGluY2x1ZGUsIGluY2x1ZGVDaGFpbmluZ0JlaGF2aW9yKTtcblxuICAvKipcbiAgICogIyMjIC5va1xuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyB0cnV0aHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2V2ZXJ0aGluZycpLnRvLmJlLm9rO1xuICAgKiAgICAgZXhwZWN0KDEpLnRvLmJlLm9rO1xuICAgKiAgICAgZXhwZWN0KGZhbHNlKS50by5ub3QuYmUub2s7XG4gICAqICAgICBleHBlY3QodW5kZWZpbmVkKS50by5ub3QuYmUub2s7XG4gICAqICAgICBleHBlY3QobnVsbCkudG8ubm90LmJlLm9rO1xuICAgKlxuICAgKiBAbmFtZSBva1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ29rJywgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSB0cnV0aHknXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGZhbHN5Jyk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLnRydWVcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgYHRydWVgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KHRydWUpLnRvLmJlLnRydWU7XG4gICAqICAgICBleHBlY3QoMSkudG8ubm90LmJlLnRydWU7XG4gICAqXG4gICAqIEBuYW1lIHRydWVcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCd0cnVlJywgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICB0cnVlID09PSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSB0cnVlJ1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBmYWxzZSdcbiAgICAgICwgdGhpcy5uZWdhdGUgPyBmYWxzZSA6IHRydWVcbiAgICApO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5mYWxzZVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBgZmFsc2VgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KGZhbHNlKS50by5iZS5mYWxzZTtcbiAgICogICAgIGV4cGVjdCgwKS50by5ub3QuYmUuZmFsc2U7XG4gICAqXG4gICAqIEBuYW1lIGZhbHNlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnZmFsc2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIGZhbHNlID09PSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBmYWxzZSdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgdHJ1ZSdcbiAgICAgICwgdGhpcy5uZWdhdGUgPyB0cnVlIDogZmFsc2VcbiAgICApO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5udWxsXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGBudWxsYC5cbiAgICpcbiAgICogICAgIGV4cGVjdChudWxsKS50by5iZS5udWxsO1xuICAgKiAgICAgZXhwZWN0KHVuZGVmaW5lZCkubm90LnRvLmJlLm51bGw7XG4gICAqXG4gICAqIEBuYW1lIG51bGxcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdudWxsJywgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBudWxsID09PSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBudWxsJ1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSBub3QgdG8gYmUgbnVsbCdcbiAgICApO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC51bmRlZmluZWRcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgYHVuZGVmaW5lZGAuXG4gICAqXG4gICAqICAgICBleHBlY3QodW5kZWZpbmVkKS50by5iZS51bmRlZmluZWQ7XG4gICAqICAgICBleHBlY3QobnVsbCkudG8ubm90LmJlLnVuZGVmaW5lZDtcbiAgICpcbiAgICogQG5hbWUgdW5kZWZpbmVkXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgndW5kZWZpbmVkJywgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICB1bmRlZmluZWQgPT09IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIHVuZGVmaW5lZCdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gbm90IHRvIGJlIHVuZGVmaW5lZCdcbiAgICApO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5leGlzdFxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBuZWl0aGVyIGBudWxsYCBub3IgYHVuZGVmaW5lZGAuXG4gICAqXG4gICAqICAgICB2YXIgZm9vID0gJ2hpJ1xuICAgKiAgICAgICAsIGJhciA9IG51bGxcbiAgICogICAgICAgLCBiYXo7XG4gICAqXG4gICAqICAgICBleHBlY3QoZm9vKS50by5leGlzdDtcbiAgICogICAgIGV4cGVjdChiYXIpLnRvLm5vdC5leGlzdDtcbiAgICogICAgIGV4cGVjdChiYXopLnRvLm5vdC5leGlzdDtcbiAgICpcbiAgICogQG5hbWUgZXhpc3RcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdleGlzdCcsIGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgbnVsbCAhPSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBleGlzdCdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGV4aXN0J1xuICAgICk7XG4gIH0pO1xuXG5cbiAgLyoqXG4gICAqICMjIyAuZW1wdHlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQncyBsZW5ndGggaXMgYDBgLiBGb3IgYXJyYXlzLCBpdCBjaGVja3NcbiAgICogdGhlIGBsZW5ndGhgIHByb3BlcnR5LiBGb3Igb2JqZWN0cywgaXQgZ2V0cyB0aGUgY291bnQgb2ZcbiAgICogZW51bWVyYWJsZSBrZXlzLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KFtdKS50by5iZS5lbXB0eTtcbiAgICogICAgIGV4cGVjdCgnJykudG8uYmUuZW1wdHk7XG4gICAqICAgICBleHBlY3Qoe30pLnRvLmJlLmVtcHR5O1xuICAgKlxuICAgKiBAbmFtZSBlbXB0eVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ2VtcHR5JywgZnVuY3Rpb24gKCkge1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCBleHBlY3RlZCA9IG9iajtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikgfHwgJ3N0cmluZycgPT09IHR5cGVvZiBvYmplY3QpIHtcbiAgICAgIGV4cGVjdGVkID0gb2JqLmxlbmd0aDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgICBleHBlY3RlZCA9IE9iamVjdC5rZXlzKG9iaikubGVuZ3RoO1xuICAgIH1cblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAhZXhwZWN0ZWRcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgZW1wdHknXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IG5vdCB0byBiZSBlbXB0eSdcbiAgICApO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5hcmd1bWVudHNcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgYW4gYXJndW1lbnRzIG9iamVjdC5cbiAgICpcbiAgICogICAgIGZ1bmN0aW9uIHRlc3QgKCkge1xuICAgKiAgICAgICBleHBlY3QoYXJndW1lbnRzKS50by5iZS5hcmd1bWVudHM7XG4gICAqICAgICB9XG4gICAqXG4gICAqIEBuYW1lIGFyZ3VtZW50c1xuICAgKiBAYWxpYXMgQXJndW1lbnRzXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGNoZWNrQXJndW1lbnRzICgpIHtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgdHlwZSA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAnW29iamVjdCBBcmd1bWVudHNdJyA9PT0gdHlwZVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhcmd1bWVudHMgYnV0IGdvdCAnICsgdHlwZVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgYmUgYXJndW1lbnRzJ1xuICAgICk7XG4gIH1cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ2FyZ3VtZW50cycsIGNoZWNrQXJndW1lbnRzKTtcbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdBcmd1bWVudHMnLCBjaGVja0FyZ3VtZW50cyk7XG5cbiAgLyoqXG4gICAqICMjIyAuZXF1YWwodmFsdWUpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIHN0cmljdGx5IGVxdWFsIChgPT09YCkgdG8gYHZhbHVlYC5cbiAgICogQWx0ZXJuYXRlbHksIGlmIHRoZSBgZGVlcGAgZmxhZyBpcyBzZXQsIGFzc2VydHMgdGhhdFxuICAgKiB0aGUgdGFyZ2V0IGlzIGRlZXBseSBlcXVhbCB0byBgdmFsdWVgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdoZWxsbycpLnRvLmVxdWFsKCdoZWxsbycpO1xuICAgKiAgICAgZXhwZWN0KDQyKS50by5lcXVhbCg0Mik7XG4gICAqICAgICBleHBlY3QoMSkudG8ubm90LmVxdWFsKHRydWUpO1xuICAgKiAgICAgZXhwZWN0KHsgZm9vOiAnYmFyJyB9KS50by5ub3QuZXF1YWwoeyBmb286ICdiYXInIH0pO1xuICAgKiAgICAgZXhwZWN0KHsgZm9vOiAnYmFyJyB9KS50by5kZWVwLmVxdWFsKHsgZm9vOiAnYmFyJyB9KTtcbiAgICpcbiAgICogQG5hbWUgZXF1YWxcbiAgICogQGFsaWFzIGVxdWFsc1xuICAgKiBAYWxpYXMgZXFcbiAgICogQGFsaWFzIGRlZXAuZXF1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRFcXVhbCAodmFsLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgaWYgKGZsYWcodGhpcywgJ2RlZXAnKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZXFsKHZhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIHZhbCA9PT0gb2JqXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gZXF1YWwgI3tleHB9J1xuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBlcXVhbCAje2V4cH0nXG4gICAgICAgICwgdmFsXG4gICAgICAgICwgdGhpcy5fb2JqXG4gICAgICAgICwgdHJ1ZVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdlcXVhbCcsIGFzc2VydEVxdWFsKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZXF1YWxzJywgYXNzZXJ0RXF1YWwpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdlcScsIGFzc2VydEVxdWFsKTtcblxuICAvKipcbiAgICogIyMjIC5lcWwodmFsdWUpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGRlZXBseSBlcXVhbCB0byBgdmFsdWVgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KHsgZm9vOiAnYmFyJyB9KS50by5lcWwoeyBmb286ICdiYXInIH0pO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5lcWwoWyAxLCAyLCAzIF0pO1xuICAgKlxuICAgKiBAbmFtZSBlcWxcbiAgICogQGFsaWFzIGVxbHNcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRFcWwob2JqLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgXy5lcWwob2JqLCBmbGFnKHRoaXMsICdvYmplY3QnKSlcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gZGVlcGx5IGVxdWFsICN7ZXhwfSdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGRlZXBseSBlcXVhbCAje2V4cH0nXG4gICAgICAsIG9ialxuICAgICAgLCB0aGlzLl9vYmpcbiAgICAgICwgdHJ1ZVxuICAgICk7XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdlcWwnLCBhc3NlcnRFcWwpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdlcWxzJywgYXNzZXJ0RXFsKTtcblxuICAvKipcbiAgICogIyMjIC5hYm92ZSh2YWx1ZSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgZ3JlYXRlciB0aGFuIGB2YWx1ZWAuXG4gICAqXG4gICAqICAgICBleHBlY3QoMTApLnRvLmJlLmFib3ZlKDUpO1xuICAgKlxuICAgKiBDYW4gYWxzbyBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggYGxlbmd0aGAgdG9cbiAgICogYXNzZXJ0IGEgbWluaW11bSBsZW5ndGguIFRoZSBiZW5lZml0IGJlaW5nIGFcbiAgICogbW9yZSBpbmZvcm1hdGl2ZSBlcnJvciBtZXNzYWdlIHRoYW4gaWYgdGhlIGxlbmd0aFxuICAgKiB3YXMgc3VwcGxpZWQgZGlyZWN0bHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLmFib3ZlKDIpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC5hYm92ZSgyKTtcbiAgICpcbiAgICogQG5hbWUgYWJvdmVcbiAgICogQGFsaWFzIGd0XG4gICAqIEBhbGlhcyBncmVhdGVyVGhhblxuICAgKiBAcGFyYW0ge051bWJlcn0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRBYm92ZSAobiwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIGlmIChmbGFnKHRoaXMsICdkb0xlbmd0aCcpKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLnByb3BlcnR5KCdsZW5ndGgnKTtcbiAgICAgIHZhciBsZW4gPSBvYmoubGVuZ3RoO1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgbGVuID4gblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSBsZW5ndGggYWJvdmUgI3tleHB9IGJ1dCBnb3QgI3thY3R9J1xuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBoYXZlIGEgbGVuZ3RoIGFib3ZlICN7ZXhwfSdcbiAgICAgICAgLCBuXG4gICAgICAgICwgbGVuXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBvYmogPiBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYWJvdmUgJyArIG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhdCBtb3N0ICcgKyBuXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2Fib3ZlJywgYXNzZXJ0QWJvdmUpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdndCcsIGFzc2VydEFib3ZlKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZ3JlYXRlclRoYW4nLCBhc3NlcnRBYm92ZSk7XG5cbiAgLyoqXG4gICAqICMjIyAubGVhc3QodmFsdWUpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byBgdmFsdWVgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KDEwKS50by5iZS5hdC5sZWFzdCgxMCk7XG4gICAqXG4gICAqIENhbiBhbHNvIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBgbGVuZ3RoYCB0b1xuICAgKiBhc3NlcnQgYSBtaW5pbXVtIGxlbmd0aC4gVGhlIGJlbmVmaXQgYmVpbmcgYVxuICAgKiBtb3JlIGluZm9ybWF0aXZlIGVycm9yIG1lc3NhZ2UgdGhhbiBpZiB0aGUgbGVuZ3RoXG4gICAqIHdhcyBzdXBwbGllZCBkaXJlY3RseS5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnZm9vJykudG8uaGF2ZS5sZW5ndGgub2YuYXQubGVhc3QoMik7XG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzIF0pLnRvLmhhdmUubGVuZ3RoLm9mLmF0LmxlYXN0KDMpO1xuICAgKlxuICAgKiBAbmFtZSBsZWFzdFxuICAgKiBAYWxpYXMgZ3RlXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydExlYXN0IChuLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgaWYgKGZsYWcodGhpcywgJ2RvTGVuZ3RoJykpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLmhhdmUucHJvcGVydHkoJ2xlbmd0aCcpO1xuICAgICAgdmFyIGxlbiA9IG9iai5sZW5ndGg7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBsZW4gPj0gblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSBsZW5ndGggYXQgbGVhc3QgI3tleHB9IGJ1dCBnb3QgI3thY3R9J1xuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSBsZW5ndGggYmVsb3cgI3tleHB9J1xuICAgICAgICAsIG5cbiAgICAgICAgLCBsZW5cbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIG9iaiA+PSBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYXQgbGVhc3QgJyArIG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBiZWxvdyAnICsgblxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdsZWFzdCcsIGFzc2VydExlYXN0KTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZ3RlJywgYXNzZXJ0TGVhc3QpO1xuXG4gIC8qKlxuICAgKiAjIyMgLmJlbG93KHZhbHVlKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBsZXNzIHRoYW4gYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCg1KS50by5iZS5iZWxvdygxMCk7XG4gICAqXG4gICAqIENhbiBhbHNvIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBgbGVuZ3RoYCB0b1xuICAgKiBhc3NlcnQgYSBtYXhpbXVtIGxlbmd0aC4gVGhlIGJlbmVmaXQgYmVpbmcgYVxuICAgKiBtb3JlIGluZm9ybWF0aXZlIGVycm9yIG1lc3NhZ2UgdGhhbiBpZiB0aGUgbGVuZ3RoXG4gICAqIHdhcyBzdXBwbGllZCBkaXJlY3RseS5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnZm9vJykudG8uaGF2ZS5sZW5ndGguYmVsb3coNCk7XG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzIF0pLnRvLmhhdmUubGVuZ3RoLmJlbG93KDQpO1xuICAgKlxuICAgKiBAbmFtZSBiZWxvd1xuICAgKiBAYWxpYXMgbHRcbiAgICogQGFsaWFzIGxlc3NUaGFuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydEJlbG93IChuLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgaWYgKGZsYWcodGhpcywgJ2RvTGVuZ3RoJykpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLmhhdmUucHJvcGVydHkoJ2xlbmd0aCcpO1xuICAgICAgdmFyIGxlbiA9IG9iai5sZW5ndGg7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBsZW4gPCBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhIGxlbmd0aCBiZWxvdyAje2V4cH0gYnV0IGdvdCAje2FjdH0nXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGhhdmUgYSBsZW5ndGggYmVsb3cgI3tleHB9J1xuICAgICAgICAsIG5cbiAgICAgICAgLCBsZW5cbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIG9iaiA8IG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBiZWxvdyAnICsgblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGF0IGxlYXN0ICcgKyBuXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2JlbG93JywgYXNzZXJ0QmVsb3cpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdsdCcsIGFzc2VydEJlbG93KTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnbGVzc1RoYW4nLCBhc3NlcnRCZWxvdyk7XG5cbiAgLyoqXG4gICAqICMjIyAubW9zdCh2YWx1ZSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIGB2YWx1ZWAuXG4gICAqXG4gICAqICAgICBleHBlY3QoNSkudG8uYmUuYXQubW9zdCg1KTtcbiAgICpcbiAgICogQ2FuIGFsc28gYmUgdXNlZCBpbiBjb25qdW5jdGlvbiB3aXRoIGBsZW5ndGhgIHRvXG4gICAqIGFzc2VydCBhIG1heGltdW0gbGVuZ3RoLiBUaGUgYmVuZWZpdCBiZWluZyBhXG4gICAqIG1vcmUgaW5mb3JtYXRpdmUgZXJyb3IgbWVzc2FnZSB0aGFuIGlmIHRoZSBsZW5ndGhcbiAgICogd2FzIHN1cHBsaWVkIGRpcmVjdGx5LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdmb28nKS50by5oYXZlLmxlbmd0aC5vZi5hdC5tb3N0KDQpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC5vZi5hdC5tb3N0KDMpO1xuICAgKlxuICAgKiBAbmFtZSBtb3N0XG4gICAqIEBhbGlhcyBsdGVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0TW9zdCAobiwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIGlmIChmbGFnKHRoaXMsICdkb0xlbmd0aCcpKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLnByb3BlcnR5KCdsZW5ndGgnKTtcbiAgICAgIHZhciBsZW4gPSBvYmoubGVuZ3RoO1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgbGVuIDw9IG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIGF0IG1vc3QgI3tleHB9IGJ1dCBnb3QgI3thY3R9J1xuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSBsZW5ndGggYWJvdmUgI3tleHB9J1xuICAgICAgICAsIG5cbiAgICAgICAgLCBsZW5cbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIG9iaiA8PSBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYXQgbW9zdCAnICsgblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGFib3ZlICcgKyBuXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ21vc3QnLCBhc3NlcnRNb3N0KTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnbHRlJywgYXNzZXJ0TW9zdCk7XG5cbiAgLyoqXG4gICAqICMjIyAud2l0aGluKHN0YXJ0LCBmaW5pc2gpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIHdpdGhpbiBhIHJhbmdlLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KDcpLnRvLmJlLndpdGhpbig1LDEwKTtcbiAgICpcbiAgICogQ2FuIGFsc28gYmUgdXNlZCBpbiBjb25qdW5jdGlvbiB3aXRoIGBsZW5ndGhgIHRvXG4gICAqIGFzc2VydCBhIGxlbmd0aCByYW5nZS4gVGhlIGJlbmVmaXQgYmVpbmcgYVxuICAgKiBtb3JlIGluZm9ybWF0aXZlIGVycm9yIG1lc3NhZ2UgdGhhbiBpZiB0aGUgbGVuZ3RoXG4gICAqIHdhcyBzdXBwbGllZCBkaXJlY3RseS5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnZm9vJykudG8uaGF2ZS5sZW5ndGgud2l0aGluKDIsNCk7XG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzIF0pLnRvLmhhdmUubGVuZ3RoLndpdGhpbigyLDQpO1xuICAgKlxuICAgKiBAbmFtZSB3aXRoaW5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHN0YXJ0IGxvd2VyYm91bmQgaW5jbHVzaXZlXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBmaW5pc2ggdXBwZXJib3VuZCBpbmNsdXNpdmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCd3aXRoaW4nLCBmdW5jdGlvbiAoc3RhcnQsIGZpbmlzaCwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsIHJhbmdlID0gc3RhcnQgKyAnLi4nICsgZmluaXNoO1xuICAgIGlmIChmbGFnKHRoaXMsICdkb0xlbmd0aCcpKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLnByb3BlcnR5KCdsZW5ndGgnKTtcbiAgICAgIHZhciBsZW4gPSBvYmoubGVuZ3RoO1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgbGVuID49IHN0YXJ0ICYmIGxlbiA8PSBmaW5pc2hcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIHdpdGhpbiAnICsgcmFuZ2VcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaGF2ZSBhIGxlbmd0aCB3aXRoaW4gJyArIHJhbmdlXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBvYmogPj0gc3RhcnQgJiYgb2JqIDw9IGZpbmlzaFxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIHdpdGhpbiAnICsgcmFuZ2VcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgYmUgd2l0aGluICcgKyByYW5nZVxuICAgICAgKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLmluc3RhbmNlb2YoY29uc3RydWN0b3IpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGFuIGluc3RhbmNlIG9mIGBjb25zdHJ1Y3RvcmAuXG4gICAqXG4gICAqICAgICB2YXIgVGVhID0gZnVuY3Rpb24gKG5hbWUpIHsgdGhpcy5uYW1lID0gbmFtZTsgfVxuICAgKiAgICAgICAsIENoYWkgPSBuZXcgVGVhKCdjaGFpJyk7XG4gICAqXG4gICAqICAgICBleHBlY3QoQ2hhaSkudG8uYmUuYW4uaW5zdGFuY2VvZihUZWEpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5iZS5pbnN0YW5jZW9mKEFycmF5KTtcbiAgICpcbiAgICogQG5hbWUgaW5zdGFuY2VvZlxuICAgKiBAcGFyYW0ge0NvbnN0cnVjdG9yfSBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhbGlhcyBpbnN0YW5jZU9mXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydEluc3RhbmNlT2YgKGNvbnN0cnVjdG9yLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgbmFtZSA9IF8uZ2V0TmFtZShjb25zdHJ1Y3Rvcik7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIGZsYWcodGhpcywgJ29iamVjdCcpIGluc3RhbmNlb2YgY29uc3RydWN0b3JcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYW4gaW5zdGFuY2Ugb2YgJyArIG5hbWVcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGJlIGFuIGluc3RhbmNlIG9mICcgKyBuYW1lXG4gICAgKTtcbiAgfTtcblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdpbnN0YW5jZW9mJywgYXNzZXJ0SW5zdGFuY2VPZik7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2luc3RhbmNlT2YnLCBhc3NlcnRJbnN0YW5jZU9mKTtcblxuICAvKipcbiAgICogIyMjIC5wcm9wZXJ0eShuYW1lLCBbdmFsdWVdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBoYXMgYSBwcm9wZXJ0eSBgbmFtZWAsIG9wdGlvbmFsbHkgYXNzZXJ0aW5nIHRoYXRcbiAgICogdGhlIHZhbHVlIG9mIHRoYXQgcHJvcGVydHkgaXMgc3RyaWN0bHkgZXF1YWwgdG8gIGB2YWx1ZWAuXG4gICAqIElmIHRoZSBgZGVlcGAgZmxhZyBpcyBzZXQsIHlvdSBjYW4gdXNlIGRvdC0gYW5kIGJyYWNrZXQtbm90YXRpb24gZm9yIGRlZXBcbiAgICogcmVmZXJlbmNlcyBpbnRvIG9iamVjdHMgYW5kIGFycmF5cy5cbiAgICpcbiAgICogICAgIC8vIHNpbXBsZSByZWZlcmVuY2luZ1xuICAgKiAgICAgdmFyIG9iaiA9IHsgZm9vOiAnYmFyJyB9O1xuICAgKiAgICAgZXhwZWN0KG9iaikudG8uaGF2ZS5wcm9wZXJ0eSgnZm9vJyk7XG4gICAqICAgICBleHBlY3Qob2JqKS50by5oYXZlLnByb3BlcnR5KCdmb28nLCAnYmFyJyk7XG4gICAqXG4gICAqICAgICAvLyBkZWVwIHJlZmVyZW5jaW5nXG4gICAqICAgICB2YXIgZGVlcE9iaiA9IHtcbiAgICogICAgICAgICBncmVlbjogeyB0ZWE6ICdtYXRjaGEnIH1cbiAgICogICAgICAgLCB0ZWFzOiBbICdjaGFpJywgJ21hdGNoYScsIHsgdGVhOiAna29uYWNoYScgfSBdXG4gICAqICAgICB9O1xuXG4gICAqICAgICBleHBlY3QoZGVlcE9iaikudG8uaGF2ZS5kZWVwLnByb3BlcnR5KCdncmVlbi50ZWEnLCAnbWF0Y2hhJyk7XG4gICAqICAgICBleHBlY3QoZGVlcE9iaikudG8uaGF2ZS5kZWVwLnByb3BlcnR5KCd0ZWFzWzFdJywgJ21hdGNoYScpO1xuICAgKiAgICAgZXhwZWN0KGRlZXBPYmopLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgndGVhc1syXS50ZWEnLCAna29uYWNoYScpO1xuICAgKlxuICAgKiBZb3UgY2FuIGFsc28gdXNlIGFuIGFycmF5IGFzIHRoZSBzdGFydGluZyBwb2ludCBvZiBhIGBkZWVwLnByb3BlcnR5YFxuICAgKiBhc3NlcnRpb24sIG9yIHRyYXZlcnNlIG5lc3RlZCBhcnJheXMuXG4gICAqXG4gICAqICAgICB2YXIgYXJyID0gW1xuICAgKiAgICAgICAgIFsgJ2NoYWknLCAnbWF0Y2hhJywgJ2tvbmFjaGEnIF1cbiAgICogICAgICAgLCBbIHsgdGVhOiAnY2hhaScgfVxuICAgKiAgICAgICAgICwgeyB0ZWE6ICdtYXRjaGEnIH1cbiAgICogICAgICAgICAsIHsgdGVhOiAna29uYWNoYScgfSBdXG4gICAqICAgICBdO1xuICAgKlxuICAgKiAgICAgZXhwZWN0KGFycikudG8uaGF2ZS5kZWVwLnByb3BlcnR5KCdbMF1bMV0nLCAnbWF0Y2hhJyk7XG4gICAqICAgICBleHBlY3QoYXJyKS50by5oYXZlLmRlZXAucHJvcGVydHkoJ1sxXVsyXS50ZWEnLCAna29uYWNoYScpO1xuICAgKlxuICAgKiBGdXJ0aGVybW9yZSwgYHByb3BlcnR5YCBjaGFuZ2VzIHRoZSBzdWJqZWN0IG9mIHRoZSBhc3NlcnRpb25cbiAgICogdG8gYmUgdGhlIHZhbHVlIG9mIHRoYXQgcHJvcGVydHkgZnJvbSB0aGUgb3JpZ2luYWwgb2JqZWN0LiBUaGlzXG4gICAqIHBlcm1pdHMgZm9yIGZ1cnRoZXIgY2hhaW5hYmxlIGFzc2VydGlvbnMgb24gdGhhdCBwcm9wZXJ0eS5cbiAgICpcbiAgICogICAgIGV4cGVjdChvYmopLnRvLmhhdmUucHJvcGVydHkoJ2ZvbycpXG4gICAqICAgICAgIC50aGF0LmlzLmEoJ3N0cmluZycpO1xuICAgKiAgICAgZXhwZWN0KGRlZXBPYmopLnRvLmhhdmUucHJvcGVydHkoJ2dyZWVuJylcbiAgICogICAgICAgLnRoYXQuaXMuYW4oJ29iamVjdCcpXG4gICAqICAgICAgIC50aGF0LmRlZXAuZXF1YWxzKHsgdGVhOiAnbWF0Y2hhJyB9KTtcbiAgICogICAgIGV4cGVjdChkZWVwT2JqKS50by5oYXZlLnByb3BlcnR5KCd0ZWFzJylcbiAgICogICAgICAgLnRoYXQuaXMuYW4oJ2FycmF5JylcbiAgICogICAgICAgLndpdGguZGVlcC5wcm9wZXJ0eSgnWzJdJylcbiAgICogICAgICAgICAudGhhdC5kZWVwLmVxdWFscyh7IHRlYTogJ2tvbmFjaGEnIH0pO1xuICAgKlxuICAgKiBAbmFtZSBwcm9wZXJ0eVxuICAgKiBAYWxpYXMgZGVlcC5wcm9wZXJ0eVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSAob3B0aW9uYWwpXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQHJldHVybnMgdmFsdWUgb2YgcHJvcGVydHkgZm9yIGNoYWluaW5nXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ3Byb3BlcnR5JywgZnVuY3Rpb24gKG5hbWUsIHZhbCwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG5cbiAgICB2YXIgZGVzY3JpcHRvciA9IGZsYWcodGhpcywgJ2RlZXAnKSA/ICdkZWVwIHByb3BlcnR5ICcgOiAncHJvcGVydHkgJ1xuICAgICAgLCBuZWdhdGUgPSBmbGFnKHRoaXMsICduZWdhdGUnKVxuICAgICAgLCBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCB2YWx1ZSA9IGZsYWcodGhpcywgJ2RlZXAnKVxuICAgICAgICA/IF8uZ2V0UGF0aFZhbHVlKG5hbWUsIG9iailcbiAgICAgICAgOiBvYmpbbmFtZV07XG5cbiAgICBpZiAobmVnYXRlICYmIHVuZGVmaW5lZCAhPT0gdmFsKSB7XG4gICAgICBpZiAodW5kZWZpbmVkID09PSB2YWx1ZSkge1xuICAgICAgICBtc2cgPSAobXNnICE9IG51bGwpID8gbXNnICsgJzogJyA6ICcnO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnICsgXy5pbnNwZWN0KG9iaikgKyAnIGhhcyBubyAnICsgZGVzY3JpcHRvciArIF8uaW5zcGVjdChuYW1lKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIHVuZGVmaW5lZCAhPT0gdmFsdWVcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgJyArIGRlc2NyaXB0b3IgKyBfLmluc3BlY3QobmFtZSlcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaGF2ZSAnICsgZGVzY3JpcHRvciArIF8uaW5zcGVjdChuYW1lKSk7XG4gICAgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gdmFsKSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICB2YWwgPT09IHZhbHVlXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhICcgKyBkZXNjcmlwdG9yICsgXy5pbnNwZWN0KG5hbWUpICsgJyBvZiAje2V4cH0sIGJ1dCBnb3QgI3thY3R9J1xuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBoYXZlIGEgJyArIGRlc2NyaXB0b3IgKyBfLmluc3BlY3QobmFtZSkgKyAnIG9mICN7YWN0fSdcbiAgICAgICAgLCB2YWxcbiAgICAgICAgLCB2YWx1ZVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBmbGFnKHRoaXMsICdvYmplY3QnLCB2YWx1ZSk7XG4gIH0pO1xuXG5cbiAgLyoqXG4gICAqICMjIyAub3duUHJvcGVydHkobmFtZSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaGFzIGFuIG93biBwcm9wZXJ0eSBgbmFtZWAuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ3Rlc3QnKS50by5oYXZlLm93blByb3BlcnR5KCdsZW5ndGgnKTtcbiAgICpcbiAgICogQG5hbWUgb3duUHJvcGVydHlcbiAgICogQGFsaWFzIGhhdmVPd25Qcm9wZXJ0eVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydE93blByb3BlcnR5IChuYW1lLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIG9iai5oYXNPd25Qcm9wZXJ0eShuYW1lKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIG93biBwcm9wZXJ0eSAnICsgXy5pbnNwZWN0KG5hbWUpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBoYXZlIG93biBwcm9wZXJ0eSAnICsgXy5pbnNwZWN0KG5hbWUpXG4gICAgKTtcbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ293blByb3BlcnR5JywgYXNzZXJ0T3duUHJvcGVydHkpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdoYXZlT3duUHJvcGVydHknLCBhc3NlcnRPd25Qcm9wZXJ0eSk7XG5cbiAgLyoqXG4gICAqICMjIyAubGVuZ3RoKHZhbHVlKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCdzIGBsZW5ndGhgIHByb3BlcnR5IGhhc1xuICAgKiB0aGUgZXhwZWN0ZWQgdmFsdWUuXG4gICAqXG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzXSkudG8uaGF2ZS5sZW5ndGgoMyk7XG4gICAqICAgICBleHBlY3QoJ2Zvb2JhcicpLnRvLmhhdmUubGVuZ3RoKDYpO1xuICAgKlxuICAgKiBDYW4gYWxzbyBiZSB1c2VkIGFzIGEgY2hhaW4gcHJlY3Vyc29yIHRvIGEgdmFsdWVcbiAgICogY29tcGFyaXNvbiBmb3IgdGhlIGxlbmd0aCBwcm9wZXJ0eS5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnZm9vJykudG8uaGF2ZS5sZW5ndGguYWJvdmUoMik7XG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzIF0pLnRvLmhhdmUubGVuZ3RoLmFib3ZlKDIpO1xuICAgKiAgICAgZXhwZWN0KCdmb28nKS50by5oYXZlLmxlbmd0aC5iZWxvdyg0KTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uaGF2ZS5sZW5ndGguYmVsb3coNCk7XG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLndpdGhpbigyLDQpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC53aXRoaW4oMiw0KTtcbiAgICpcbiAgICogQG5hbWUgbGVuZ3RoXG4gICAqIEBhbGlhcyBsZW5ndGhPZlxuICAgKiBAcGFyYW0ge051bWJlcn0gbGVuZ3RoXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0TGVuZ3RoQ2hhaW4gKCkge1xuICAgIGZsYWcodGhpcywgJ2RvTGVuZ3RoJywgdHJ1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBhc3NlcnRMZW5ndGggKG4sIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLnByb3BlcnR5KCdsZW5ndGgnKTtcbiAgICB2YXIgbGVuID0gb2JqLmxlbmd0aDtcblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBsZW4gPT0gblxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIG9mICN7ZXhwfSBidXQgZ290ICN7YWN0fSdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGhhdmUgYSBsZW5ndGggb2YgI3thY3R9J1xuICAgICAgLCBuXG4gICAgICAsIGxlblxuICAgICk7XG4gIH1cblxuICBBc3NlcnRpb24uYWRkQ2hhaW5hYmxlTWV0aG9kKCdsZW5ndGgnLCBhc3NlcnRMZW5ndGgsIGFzc2VydExlbmd0aENoYWluKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnbGVuZ3RoT2YnLCBhc3NlcnRMZW5ndGgsIGFzc2VydExlbmd0aENoYWluKTtcblxuICAvKipcbiAgICogIyMjIC5tYXRjaChyZWdleHApXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IG1hdGNoZXMgYSByZWd1bGFyIGV4cHJlc3Npb24uXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2Zvb2JhcicpLnRvLm1hdGNoKC9eZm9vLyk7XG4gICAqXG4gICAqIEBuYW1lIG1hdGNoXG4gICAqIEBwYXJhbSB7UmVnRXhwfSBSZWd1bGFyRXhwcmVzc2lvblxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ21hdGNoJywgZnVuY3Rpb24gKHJlLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIHJlLmV4ZWMob2JqKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBtYXRjaCAnICsgcmVcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gbm90IHRvIG1hdGNoICcgKyByZVxuICAgICk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLnN0cmluZyhzdHJpbmcpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgc3RyaW5nIHRhcmdldCBjb250YWlucyBhbm90aGVyIHN0cmluZy5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnZm9vYmFyJykudG8uaGF2ZS5zdHJpbmcoJ2JhcicpO1xuICAgKlxuICAgKiBAbmFtZSBzdHJpbmdcbiAgICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ3N0cmluZycsIGZ1bmN0aW9uIChzdHIsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS5pcy5hKCdzdHJpbmcnKTtcblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICB+b2JqLmluZGV4T2Yoc3RyKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBjb250YWluICcgKyBfLmluc3BlY3Qoc3RyKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgY29udGFpbiAnICsgXy5pbnNwZWN0KHN0cilcbiAgICApO1xuICB9KTtcblxuXG4gIC8qKlxuICAgKiAjIyMgLmtleXMoa2V5MSwgW2tleTJdLCBbLi4uXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaGFzIGV4YWN0bHkgdGhlIGdpdmVuIGtleXMsIG9yXG4gICAqIGFzc2VydHMgdGhlIGluY2x1c2lvbiBvZiBzb21lIGtleXMgd2hlbiB1c2luZyB0aGVcbiAgICogYGluY2x1ZGVgIG9yIGBjb250YWluYCBtb2RpZmllcnMuXG4gICAqXG4gICAqICAgICBleHBlY3QoeyBmb286IDEsIGJhcjogMiB9KS50by5oYXZlLmtleXMoWydmb28nLCAnYmFyJ10pO1xuICAgKiAgICAgZXhwZWN0KHsgZm9vOiAxLCBiYXI6IDIsIGJhejogMyB9KS50by5jb250YWluLmtleXMoJ2ZvbycsICdiYXInKTtcbiAgICpcbiAgICogQG5hbWUga2V5c1xuICAgKiBAYWxpYXMga2V5XG4gICAqIEBwYXJhbSB7U3RyaW5nLi4ufEFycmF5fSBrZXlzXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydEtleXMgKGtleXMpIHtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgc3RyXG4gICAgICAsIG9rID0gdHJ1ZTtcblxuICAgIGtleXMgPSBrZXlzIGluc3RhbmNlb2YgQXJyYXlcbiAgICAgID8ga2V5c1xuICAgICAgOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgaWYgKCFrZXlzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKCdrZXlzIHJlcXVpcmVkJyk7XG5cbiAgICB2YXIgYWN0dWFsID0gT2JqZWN0LmtleXMob2JqKVxuICAgICAgLCBsZW4gPSBrZXlzLmxlbmd0aDtcblxuICAgIC8vIEluY2x1c2lvblxuICAgIG9rID0ga2V5cy5ldmVyeShmdW5jdGlvbihrZXkpe1xuICAgICAgcmV0dXJuIH5hY3R1YWwuaW5kZXhPZihrZXkpO1xuICAgIH0pO1xuXG4gICAgLy8gU3RyaWN0XG4gICAgaWYgKCFmbGFnKHRoaXMsICduZWdhdGUnKSAmJiAhZmxhZyh0aGlzLCAnY29udGFpbnMnKSkge1xuICAgICAgb2sgPSBvayAmJiBrZXlzLmxlbmd0aCA9PSBhY3R1YWwubGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIEtleSBzdHJpbmdcbiAgICBpZiAobGVuID4gMSkge1xuICAgICAga2V5cyA9IGtleXMubWFwKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIHJldHVybiBfLmluc3BlY3Qoa2V5KTtcbiAgICAgIH0pO1xuICAgICAgdmFyIGxhc3QgPSBrZXlzLnBvcCgpO1xuICAgICAgc3RyID0ga2V5cy5qb2luKCcsICcpICsgJywgYW5kICcgKyBsYXN0O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBfLmluc3BlY3Qoa2V5c1swXSk7XG4gICAgfVxuXG4gICAgLy8gRm9ybVxuICAgIHN0ciA9IChsZW4gPiAxID8gJ2tleXMgJyA6ICdrZXkgJykgKyBzdHI7XG5cbiAgICAvLyBIYXZlIC8gaW5jbHVkZVxuICAgIHN0ciA9IChmbGFnKHRoaXMsICdjb250YWlucycpID8gJ2NvbnRhaW4gJyA6ICdoYXZlICcpICsgc3RyO1xuXG4gICAgLy8gQXNzZXJ0aW9uXG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIG9rXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvICcgKyBzdHJcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90ICcgKyBzdHJcbiAgICApO1xuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgna2V5cycsIGFzc2VydEtleXMpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdrZXknLCBhc3NlcnRLZXlzKTtcblxuICAvKipcbiAgICogIyMjIC50aHJvdyhjb25zdHJ1Y3RvcilcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSBmdW5jdGlvbiB0YXJnZXQgd2lsbCB0aHJvdyBhIHNwZWNpZmljIGVycm9yLCBvciBzcGVjaWZpYyB0eXBlIG9mIGVycm9yXG4gICAqIChhcyBkZXRlcm1pbmVkIHVzaW5nIGBpbnN0YW5jZW9mYCksIG9wdGlvbmFsbHkgd2l0aCBhIFJlZ0V4cCBvciBzdHJpbmcgaW5jbHVzaW9uIHRlc3RcbiAgICogZm9yIHRoZSBlcnJvcidzIG1lc3NhZ2UuXG4gICAqXG4gICAqICAgICB2YXIgZXJyID0gbmV3IFJlZmVyZW5jZUVycm9yKCdUaGlzIGlzIGEgYmFkIGZ1bmN0aW9uLicpO1xuICAgKiAgICAgdmFyIGZuID0gZnVuY3Rpb24gKCkgeyB0aHJvdyBlcnI7IH1cbiAgICogICAgIGV4cGVjdChmbikudG8udGhyb3coUmVmZXJlbmNlRXJyb3IpO1xuICAgKiAgICAgZXhwZWN0KGZuKS50by50aHJvdyhFcnJvcik7XG4gICAqICAgICBleHBlY3QoZm4pLnRvLnRocm93KC9iYWQgZnVuY3Rpb24vKTtcbiAgICogICAgIGV4cGVjdChmbikudG8ubm90LnRocm93KCdnb29kIGZ1bmN0aW9uJyk7XG4gICAqICAgICBleHBlY3QoZm4pLnRvLnRocm93KFJlZmVyZW5jZUVycm9yLCAvYmFkIGZ1bmN0aW9uLyk7XG4gICAqICAgICBleHBlY3QoZm4pLnRvLnRocm93KGVycik7XG4gICAqICAgICBleHBlY3QoZm4pLnRvLm5vdC50aHJvdyhuZXcgUmFuZ2VFcnJvcignT3V0IG9mIHJhbmdlLicpKTtcbiAgICpcbiAgICogUGxlYXNlIG5vdGUgdGhhdCB3aGVuIGEgdGhyb3cgZXhwZWN0YXRpb24gaXMgbmVnYXRlZCwgaXQgd2lsbCBjaGVjayBlYWNoXG4gICAqIHBhcmFtZXRlciBpbmRlcGVuZGVudGx5LCBzdGFydGluZyB3aXRoIGVycm9yIGNvbnN0cnVjdG9yIHR5cGUuIFRoZSBhcHByb3ByaWF0ZSB3YXlcbiAgICogdG8gY2hlY2sgZm9yIHRoZSBleGlzdGVuY2Ugb2YgYSB0eXBlIG9mIGVycm9yIGJ1dCBmb3IgYSBtZXNzYWdlIHRoYXQgZG9lcyBub3QgbWF0Y2hcbiAgICogaXMgdG8gdXNlIGBhbmRgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KGZuKS50by50aHJvdyhSZWZlcmVuY2VFcnJvcilcbiAgICogICAgICAgIC5hbmQubm90LnRocm93KC9nb29kIGZ1bmN0aW9uLyk7XG4gICAqXG4gICAqIEBuYW1lIHRocm93XG4gICAqIEBhbGlhcyB0aHJvd3NcbiAgICogQGFsaWFzIFRocm93XG4gICAqIEBwYXJhbSB7RXJyb3JDb25zdHJ1Y3Rvcn0gY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtTdHJpbmd8UmVnRXhwfSBleHBlY3RlZCBlcnJvciBtZXNzYWdlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9FcnJvciNFcnJvcl90eXBlc1xuICAgKiBAcmV0dXJucyBlcnJvciBmb3IgY2hhaW5pbmcgKG51bGwgaWYgbm8gZXJyb3IpXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydFRocm93cyAoY29uc3RydWN0b3IsIGVyck1zZywgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLmlzLmEoJ2Z1bmN0aW9uJyk7XG5cbiAgICB2YXIgdGhyb3duID0gZmFsc2VcbiAgICAgICwgZGVzaXJlZEVycm9yID0gbnVsbFxuICAgICAgLCBuYW1lID0gbnVsbFxuICAgICAgLCB0aHJvd25FcnJvciA9IG51bGw7XG5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZXJyTXNnID0gbnVsbDtcbiAgICAgIGNvbnN0cnVjdG9yID0gbnVsbDtcbiAgICB9IGVsc2UgaWYgKGNvbnN0cnVjdG9yICYmIChjb25zdHJ1Y3RvciBpbnN0YW5jZW9mIFJlZ0V4cCB8fCAnc3RyaW5nJyA9PT0gdHlwZW9mIGNvbnN0cnVjdG9yKSkge1xuICAgICAgZXJyTXNnID0gY29uc3RydWN0b3I7XG4gICAgICBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgfSBlbHNlIGlmIChjb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3RvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBkZXNpcmVkRXJyb3IgPSBjb25zdHJ1Y3RvcjtcbiAgICAgIGNvbnN0cnVjdG9yID0gbnVsbDtcbiAgICAgIGVyck1zZyA9IG51bGw7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY29uc3RydWN0b3IgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIG5hbWUgPSBjb25zdHJ1Y3Rvci5wcm90b3R5cGUubmFtZSB8fCBjb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgaWYgKG5hbWUgPT09ICdFcnJvcicgJiYgY29uc3RydWN0b3IgIT09IEVycm9yKSB7XG4gICAgICAgIG5hbWUgPSAobmV3IGNvbnN0cnVjdG9yKCkpLm5hbWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0cnVjdG9yID0gbnVsbDtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgb2JqKCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBmaXJzdCwgY2hlY2sgZGVzaXJlZCBlcnJvclxuICAgICAgaWYgKGRlc2lyZWRFcnJvcikge1xuICAgICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICAgIGVyciA9PT0gZGVzaXJlZEVycm9yXG4gICAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byB0aHJvdyAje2V4cH0gYnV0ICN7YWN0fSB3YXMgdGhyb3duJ1xuICAgICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IHRocm93ICN7ZXhwfSdcbiAgICAgICAgICAsIChkZXNpcmVkRXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGRlc2lyZWRFcnJvci50b1N0cmluZygpIDogZGVzaXJlZEVycm9yKVxuICAgICAgICAgICwgKGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLnRvU3RyaW5nKCkgOiBlcnIpXG4gICAgICAgICk7XG5cbiAgICAgICAgZmxhZyh0aGlzLCAnb2JqZWN0JywgZXJyKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG5cbiAgICAgIC8vIG5leHQsIGNoZWNrIGNvbnN0cnVjdG9yXG4gICAgICBpZiAoY29uc3RydWN0b3IpIHtcbiAgICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgICBlcnIgaW5zdGFuY2VvZiBjb25zdHJ1Y3RvclxuICAgICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gdGhyb3cgI3tleHB9IGJ1dCAje2FjdH0gd2FzIHRocm93bidcbiAgICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCB0aHJvdyAje2V4cH0gYnV0ICN7YWN0fSB3YXMgdGhyb3duJ1xuICAgICAgICAgICwgbmFtZVxuICAgICAgICAgICwgKGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLnRvU3RyaW5nKCkgOiBlcnIpXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKCFlcnJNc2cpIHtcbiAgICAgICAgICBmbGFnKHRoaXMsICdvYmplY3QnLCBlcnIpO1xuICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIG5leHQsIGNoZWNrIG1lc3NhZ2VcbiAgICAgIHZhciBtZXNzYWdlID0gJ29iamVjdCcgPT09IF8udHlwZShlcnIpICYmIFwibWVzc2FnZVwiIGluIGVyclxuICAgICAgICA/IGVyci5tZXNzYWdlXG4gICAgICAgIDogJycgKyBlcnI7XG5cbiAgICAgIGlmICgobWVzc2FnZSAhPSBudWxsKSAmJiBlcnJNc2cgJiYgZXJyTXNnIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgICAgZXJyTXNnLmV4ZWMobWVzc2FnZSlcbiAgICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHRocm93IGVycm9yIG1hdGNoaW5nICN7ZXhwfSBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHRocm93IGVycm9yIG5vdCBtYXRjaGluZyAje2V4cH0nXG4gICAgICAgICAgLCBlcnJNc2dcbiAgICAgICAgICAsIG1lc3NhZ2VcbiAgICAgICAgKTtcblxuICAgICAgICBmbGFnKHRoaXMsICdvYmplY3QnLCBlcnIpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0gZWxzZSBpZiAoKG1lc3NhZ2UgIT0gbnVsbCkgJiYgZXJyTXNnICYmICdzdHJpbmcnID09PSB0eXBlb2YgZXJyTXNnKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgICAgfm1lc3NhZ2UuaW5kZXhPZihlcnJNc2cpXG4gICAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byB0aHJvdyBlcnJvciBpbmNsdWRpbmcgI3tleHB9IGJ1dCBnb3QgI3thY3R9J1xuICAgICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gdGhyb3cgZXJyb3Igbm90IGluY2x1ZGluZyAje2FjdH0nXG4gICAgICAgICAgLCBlcnJNc2dcbiAgICAgICAgICAsIG1lc3NhZ2VcbiAgICAgICAgKTtcblxuICAgICAgICBmbGFnKHRoaXMsICdvYmplY3QnLCBlcnIpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93biA9IHRydWU7XG4gICAgICAgIHRocm93bkVycm9yID0gZXJyO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBhY3R1YWxseUdvdCA9ICcnXG4gICAgICAsIGV4cGVjdGVkVGhyb3duID0gbmFtZSAhPT0gbnVsbFxuICAgICAgICA/IG5hbWVcbiAgICAgICAgOiBkZXNpcmVkRXJyb3JcbiAgICAgICAgICA/ICcje2V4cH0nIC8vXy5pbnNwZWN0KGRlc2lyZWRFcnJvcilcbiAgICAgICAgICA6ICdhbiBlcnJvcic7XG5cbiAgICBpZiAodGhyb3duKSB7XG4gICAgICBhY3R1YWxseUdvdCA9ICcgYnV0ICN7YWN0fSB3YXMgdGhyb3duJ1xuICAgIH1cblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICB0aHJvd24gPT09IHRydWVcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gdGhyb3cgJyArIGV4cGVjdGVkVGhyb3duICsgYWN0dWFsbHlHb3RcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IHRocm93ICcgKyBleHBlY3RlZFRocm93biArIGFjdHVhbGx5R290XG4gICAgICAsIChkZXNpcmVkRXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGRlc2lyZWRFcnJvci50b1N0cmluZygpIDogZGVzaXJlZEVycm9yKVxuICAgICAgLCAodGhyb3duRXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IHRocm93bkVycm9yLnRvU3RyaW5nKCkgOiB0aHJvd25FcnJvcilcbiAgICApO1xuXG4gICAgZmxhZyh0aGlzLCAnb2JqZWN0JywgdGhyb3duRXJyb3IpO1xuICB9O1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ3Rocm93JywgYXNzZXJ0VGhyb3dzKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgndGhyb3dzJywgYXNzZXJ0VGhyb3dzKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnVGhyb3cnLCBhc3NlcnRUaHJvd3MpO1xuXG4gIC8qKlxuICAgKiAjIyMgLnJlc3BvbmRUbyhtZXRob2QpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgb2JqZWN0IG9yIGNsYXNzIHRhcmdldCB3aWxsIHJlc3BvbmQgdG8gYSBtZXRob2QuXG4gICAqXG4gICAqICAgICBLbGFzcy5wcm90b3R5cGUuYmFyID0gZnVuY3Rpb24oKXt9O1xuICAgKiAgICAgZXhwZWN0KEtsYXNzKS50by5yZXNwb25kVG8oJ2JhcicpO1xuICAgKiAgICAgZXhwZWN0KG9iaikudG8ucmVzcG9uZFRvKCdiYXInKTtcbiAgICpcbiAgICogVG8gY2hlY2sgaWYgYSBjb25zdHJ1Y3RvciB3aWxsIHJlc3BvbmQgdG8gYSBzdGF0aWMgZnVuY3Rpb24sXG4gICAqIHNldCB0aGUgYGl0c2VsZmAgZmxhZy5cbiAgICpcbiAgICogICAgIEtsYXNzLmJheiA9IGZ1bmN0aW9uKCl7fTtcbiAgICogICAgIGV4cGVjdChLbGFzcykuaXRzZWxmLnRvLnJlc3BvbmRUbygnYmF6Jyk7XG4gICAqXG4gICAqIEBuYW1lIHJlc3BvbmRUb1xuICAgKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgncmVzcG9uZFRvJywgZnVuY3Rpb24gKG1ldGhvZCwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsIGl0c2VsZiA9IGZsYWcodGhpcywgJ2l0c2VsZicpXG4gICAgICAsIGNvbnRleHQgPSAoJ2Z1bmN0aW9uJyA9PT0gXy50eXBlKG9iaikgJiYgIWl0c2VsZilcbiAgICAgICAgPyBvYmoucHJvdG90eXBlW21ldGhvZF1cbiAgICAgICAgOiBvYmpbbWV0aG9kXTtcblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dFxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byByZXNwb25kIHRvICcgKyBfLmluc3BlY3QobWV0aG9kKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgcmVzcG9uZCB0byAnICsgXy5pbnNwZWN0KG1ldGhvZClcbiAgICApO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5pdHNlbGZcbiAgICpcbiAgICogU2V0cyB0aGUgYGl0c2VsZmAgZmxhZywgbGF0ZXIgdXNlZCBieSB0aGUgYHJlc3BvbmRUb2AgYXNzZXJ0aW9uLlxuICAgKlxuICAgKiAgICAgZnVuY3Rpb24gRm9vKCkge31cbiAgICogICAgIEZvby5iYXIgPSBmdW5jdGlvbigpIHt9XG4gICAqICAgICBGb28ucHJvdG90eXBlLmJheiA9IGZ1bmN0aW9uKCkge31cbiAgICpcbiAgICogICAgIGV4cGVjdChGb28pLml0c2VsZi50by5yZXNwb25kVG8oJ2JhcicpO1xuICAgKiAgICAgZXhwZWN0KEZvbykuaXRzZWxmLm5vdC50by5yZXNwb25kVG8oJ2JheicpO1xuICAgKlxuICAgKiBAbmFtZSBpdHNlbGZcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdpdHNlbGYnLCBmdW5jdGlvbiAoKSB7XG4gICAgZmxhZyh0aGlzLCAnaXRzZWxmJywgdHJ1ZSk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLnNhdGlzZnkobWV0aG9kKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBwYXNzZXMgYSBnaXZlbiB0cnV0aCB0ZXN0LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KDEpLnRvLnNhdGlzZnkoZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gPiAwOyB9KTtcbiAgICpcbiAgICogQG5hbWUgc2F0aXNmeVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBtYXRjaGVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnc2F0aXNmeScsIGZ1bmN0aW9uIChtYXRjaGVyLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIG1hdGNoZXIob2JqKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBzYXRpc2Z5ICcgKyBfLm9iakRpc3BsYXkobWF0Y2hlcilcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IHNhdGlzZnknICsgXy5vYmpEaXNwbGF5KG1hdGNoZXIpXG4gICAgICAsIHRoaXMubmVnYXRlID8gZmFsc2UgOiB0cnVlXG4gICAgICAsIG1hdGNoZXIob2JqKVxuICAgICk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLmNsb3NlVG8oZXhwZWN0ZWQsIGRlbHRhKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBlcXVhbCBgZXhwZWN0ZWRgLCB0byB3aXRoaW4gYSArLy0gYGRlbHRhYCByYW5nZS5cbiAgICpcbiAgICogICAgIGV4cGVjdCgxLjUpLnRvLmJlLmNsb3NlVG8oMSwgMC41KTtcbiAgICpcbiAgICogQG5hbWUgY2xvc2VUb1xuICAgKiBAcGFyYW0ge051bWJlcn0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnY2xvc2VUbycsIGZ1bmN0aW9uIChleHBlY3RlZCwgZGVsdGEsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgTWF0aC5hYnMob2JqIC0gZXhwZWN0ZWQpIDw9IGRlbHRhXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGNsb3NlIHRvICcgKyBleHBlY3RlZCArICcgKy8tICcgKyBkZWx0YVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSBub3QgdG8gYmUgY2xvc2UgdG8gJyArIGV4cGVjdGVkICsgJyArLy0gJyArIGRlbHRhXG4gICAgKTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gaXNTdWJzZXRPZihzdWJzZXQsIHN1cGVyc2V0LCBjbXApIHtcbiAgICByZXR1cm4gc3Vic2V0LmV2ZXJ5KGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgIGlmICghY21wKSByZXR1cm4gc3VwZXJzZXQuaW5kZXhPZihlbGVtKSAhPT0gLTE7XG5cbiAgICAgIHJldHVybiBzdXBlcnNldC5zb21lKGZ1bmN0aW9uKGVsZW0yKSB7XG4gICAgICAgIHJldHVybiBjbXAoZWxlbSwgZWxlbTIpO1xuICAgICAgfSk7XG4gICAgfSlcbiAgfVxuXG4gIC8qKlxuICAgKiAjIyMgLm1lbWJlcnMoc2V0KVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBhIHN1cGVyc2V0IG9mIGBzZXRgLFxuICAgKiBvciB0aGF0IHRoZSB0YXJnZXQgYW5kIGBzZXRgIGhhdmUgdGhlIHNhbWUgc3RyaWN0bHktZXF1YWwgKD09PSkgbWVtYmVycy5cbiAgICogQWx0ZXJuYXRlbHksIGlmIHRoZSBgZGVlcGAgZmxhZyBpcyBzZXQsIHNldCBtZW1iZXJzIGFyZSBjb21wYXJlZCBmb3IgZGVlcFxuICAgKiBlcXVhbGl0eS5cbiAgICpcbiAgICogICAgIGV4cGVjdChbMSwgMiwgM10pLnRvLmluY2x1ZGUubWVtYmVycyhbMywgMl0pO1xuICAgKiAgICAgZXhwZWN0KFsxLCAyLCAzXSkudG8ubm90LmluY2x1ZGUubWVtYmVycyhbMywgMiwgOF0pO1xuICAgKlxuICAgKiAgICAgZXhwZWN0KFs0LCAyXSkudG8uaGF2ZS5tZW1iZXJzKFsyLCA0XSk7XG4gICAqICAgICBleHBlY3QoWzUsIDJdKS50by5ub3QuaGF2ZS5tZW1iZXJzKFs1LCAyLCAxXSk7XG4gICAqXG4gICAqICAgICBleHBlY3QoW3sgaWQ6IDEgfV0pLnRvLmRlZXAuaW5jbHVkZS5tZW1iZXJzKFt7IGlkOiAxIH1dKTtcbiAgICpcbiAgICogQG5hbWUgbWVtYmVyc1xuICAgKiBAcGFyYW0ge0FycmF5fSBzZXRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdtZW1iZXJzJywgZnVuY3Rpb24gKHN1YnNldCwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuXG4gICAgbmV3IEFzc2VydGlvbihvYmopLnRvLmJlLmFuKCdhcnJheScpO1xuICAgIG5ldyBBc3NlcnRpb24oc3Vic2V0KS50by5iZS5hbignYXJyYXknKTtcblxuICAgIHZhciBjbXAgPSBmbGFnKHRoaXMsICdkZWVwJykgPyBfLmVxbCA6IHVuZGVmaW5lZDtcblxuICAgIGlmIChmbGFnKHRoaXMsICdjb250YWlucycpKSB7XG4gICAgICByZXR1cm4gdGhpcy5hc3NlcnQoXG4gICAgICAgICAgaXNTdWJzZXRPZihzdWJzZXQsIG9iaiwgY21wKVxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGEgc3VwZXJzZXQgb2YgI3thY3R9J1xuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBiZSBhIHN1cGVyc2V0IG9mICN7YWN0fSdcbiAgICAgICAgLCBvYmpcbiAgICAgICAgLCBzdWJzZXRcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIGlzU3Vic2V0T2Yob2JqLCBzdWJzZXQsIGNtcCkgJiYgaXNTdWJzZXRPZihzdWJzZXQsIG9iaiwgY21wKVxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgdGhlIHNhbWUgbWVtYmVycyBhcyAje2FjdH0nXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGhhdmUgdGhlIHNhbWUgbWVtYmVycyBhcyAje2FjdH0nXG4gICAgICAgICwgb2JqXG4gICAgICAgICwgc3Vic2V0XG4gICAgKTtcbiAgfSk7XG59O1xuIiwiLyohXG4gKiBjaGFpXG4gKiBDb3B5cmlnaHQoYykgMjAxMS0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjaGFpLCB1dGlsKSB7XG5cbiAgLyohXG4gICAqIENoYWkgZGVwZW5kZW5jaWVzLlxuICAgKi9cblxuICB2YXIgQXNzZXJ0aW9uID0gY2hhaS5Bc3NlcnRpb25cbiAgICAsIGZsYWcgPSB1dGlsLmZsYWc7XG5cbiAgLyohXG4gICAqIE1vZHVsZSBleHBvcnQuXG4gICAqL1xuXG4gIC8qKlxuICAgKiAjIyMgYXNzZXJ0KGV4cHJlc3Npb24sIG1lc3NhZ2UpXG4gICAqXG4gICAqIFdyaXRlIHlvdXIgb3duIHRlc3QgZXhwcmVzc2lvbnMuXG4gICAqXG4gICAqICAgICBhc3NlcnQoJ2ZvbycgIT09ICdiYXInLCAnZm9vIGlzIG5vdCBiYXInKTtcbiAgICogICAgIGFzc2VydChBcnJheS5pc0FycmF5KFtdKSwgJ2VtcHR5IGFycmF5cyBhcmUgYXJyYXlzJyk7XG4gICAqXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cHJlc3Npb24gdG8gdGVzdCBmb3IgdHJ1dGhpbmVzc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSB0byBkaXNwbGF5IG9uIGVycm9yXG4gICAqIEBuYW1lIGFzc2VydFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICB2YXIgYXNzZXJ0ID0gY2hhaS5hc3NlcnQgPSBmdW5jdGlvbiAoZXhwcmVzcywgZXJybXNnKSB7XG4gICAgdmFyIHRlc3QgPSBuZXcgQXNzZXJ0aW9uKG51bGwsIG51bGwsIGNoYWkuYXNzZXJ0KTtcbiAgICB0ZXN0LmFzc2VydChcbiAgICAgICAgZXhwcmVzc1xuICAgICAgLCBlcnJtc2dcbiAgICAgICwgJ1sgbmVnYXRpb24gbWVzc2FnZSB1bmF2YWlsYWJsZSBdJ1xuICAgICk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuZmFpbChhY3R1YWwsIGV4cGVjdGVkLCBbbWVzc2FnZV0sIFtvcGVyYXRvcl0pXG4gICAqXG4gICAqIFRocm93IGEgZmFpbHVyZS4gTm9kZS5qcyBgYXNzZXJ0YCBtb2R1bGUtY29tcGF0aWJsZS5cbiAgICpcbiAgICogQG5hbWUgZmFpbFxuICAgKiBAcGFyYW0ge01peGVkfSBhY3R1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQHBhcmFtIHtTdHJpbmd9IG9wZXJhdG9yXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5mYWlsID0gZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsIG9wZXJhdG9yKSB7XG4gICAgbWVzc2FnZSA9IG1lc3NhZ2UgfHwgJ2Fzc2VydC5mYWlsKCknO1xuICAgIHRocm93IG5ldyBjaGFpLkFzc2VydGlvbkVycm9yKG1lc3NhZ2UsIHtcbiAgICAgICAgYWN0dWFsOiBhY3R1YWxcbiAgICAgICwgZXhwZWN0ZWQ6IGV4cGVjdGVkXG4gICAgICAsIG9wZXJhdG9yOiBvcGVyYXRvclxuICAgIH0sIGFzc2VydC5mYWlsKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5vayhvYmplY3QsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGlzIHRydXRoeS5cbiAgICpcbiAgICogICAgIGFzc2VydC5vaygnZXZlcnl0aGluZycsICdldmVyeXRoaW5nIGlzIG9rJyk7XG4gICAqICAgICBhc3NlcnQub2soZmFsc2UsICd0aGlzIHdpbGwgZmFpbCcpO1xuICAgKlxuICAgKiBAbmFtZSBva1xuICAgKiBAcGFyYW0ge01peGVkfSBvYmplY3QgdG8gdGVzdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQub2sgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS5pcy5vaztcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3RPayhvYmplY3QsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGlzIGZhbHN5LlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm5vdE9rKCdldmVyeXRoaW5nJywgJ3RoaXMgd2lsbCBmYWlsJyk7XG4gICAqICAgICBhc3NlcnQubm90T2soZmFsc2UsICd0aGlzIHdpbGwgcGFzcycpO1xuICAgKlxuICAgKiBAbmFtZSBub3RPa1xuICAgKiBAcGFyYW0ge01peGVkfSBvYmplY3QgdG8gdGVzdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90T2sgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS5pcy5ub3Qub2s7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuZXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIG5vbi1zdHJpY3QgZXF1YWxpdHkgKGA9PWApIG9mIGBhY3R1YWxgIGFuZCBgZXhwZWN0ZWRgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmVxdWFsKDMsICczJywgJz09IGNvZXJjZXMgdmFsdWVzIHRvIHN0cmluZ3MnKTtcbiAgICpcbiAgICogQG5hbWUgZXF1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gYWN0dWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5lcXVhbCA9IGZ1bmN0aW9uIChhY3QsIGV4cCwgbXNnKSB7XG4gICAgdmFyIHRlc3QgPSBuZXcgQXNzZXJ0aW9uKGFjdCwgbXNnLCBhc3NlcnQuZXF1YWwpO1xuXG4gICAgdGVzdC5hc3NlcnQoXG4gICAgICAgIGV4cCA9PSBmbGFnKHRlc3QsICdvYmplY3QnKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBlcXVhbCAje2V4cH0nXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBlcXVhbCAje2FjdH0nXG4gICAgICAsIGV4cFxuICAgICAgLCBhY3RcbiAgICApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyBub24tc3RyaWN0IGluZXF1YWxpdHkgKGAhPWApIG9mIGBhY3R1YWxgIGFuZCBgZXhwZWN0ZWRgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm5vdEVxdWFsKDMsIDQsICd0aGVzZSBudW1iZXJzIGFyZSBub3QgZXF1YWwnKTtcbiAgICpcbiAgICogQG5hbWUgbm90RXF1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gYWN0dWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3RFcXVhbCA9IGZ1bmN0aW9uIChhY3QsIGV4cCwgbXNnKSB7XG4gICAgdmFyIHRlc3QgPSBuZXcgQXNzZXJ0aW9uKGFjdCwgbXNnLCBhc3NlcnQubm90RXF1YWwpO1xuXG4gICAgdGVzdC5hc3NlcnQoXG4gICAgICAgIGV4cCAhPSBmbGFnKHRlc3QsICdvYmplY3QnKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgZXF1YWwgI3tleHB9J1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBlcXVhbCAje2FjdH0nXG4gICAgICAsIGV4cFxuICAgICAgLCBhY3RcbiAgICApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyBzdHJpY3QgZXF1YWxpdHkgKGA9PT1gKSBvZiBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5zdHJpY3RFcXVhbCh0cnVlLCB0cnVlLCAndGhlc2UgYm9vbGVhbnMgYXJlIHN0cmljdGx5IGVxdWFsJyk7XG4gICAqXG4gICAqIEBuYW1lIHN0cmljdEVxdWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuc3RyaWN0RXF1YWwgPSBmdW5jdGlvbiAoYWN0LCBleHAsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oYWN0LCBtc2cpLnRvLmVxdWFsKGV4cCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90U3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHN0cmljdCBpbmVxdWFsaXR5IChgIT09YCkgb2YgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQubm90U3RyaWN0RXF1YWwoMywgJzMnLCAnbm8gY29lcmNpb24gZm9yIHN0cmljdCBlcXVhbGl0eScpO1xuICAgKlxuICAgKiBAbmFtZSBub3RTdHJpY3RFcXVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBhY3R1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdFN0cmljdEVxdWFsID0gZnVuY3Rpb24gKGFjdCwgZXhwLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGFjdCwgbXNnKS50by5ub3QuZXF1YWwoZXhwKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5kZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYGFjdHVhbGAgaXMgZGVlcGx5IGVxdWFsIHRvIGBleHBlY3RlZGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQuZGVlcEVxdWFsKHsgdGVhOiAnZ3JlZW4nIH0sIHsgdGVhOiAnZ3JlZW4nIH0pO1xuICAgKlxuICAgKiBAbmFtZSBkZWVwRXF1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gYWN0dWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5kZWVwRXF1YWwgPSBmdW5jdGlvbiAoYWN0LCBleHAsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oYWN0LCBtc2cpLnRvLmVxbChleHApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdERlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydCB0aGF0IGBhY3R1YWxgIGlzIG5vdCBkZWVwbHkgZXF1YWwgdG8gYGV4cGVjdGVkYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3REZWVwRXF1YWwoeyB0ZWE6ICdncmVlbicgfSwgeyB0ZWE6ICdqYXNtaW5lJyB9KTtcbiAgICpcbiAgICogQG5hbWUgbm90RGVlcEVxdWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90RGVlcEVxdWFsID0gZnVuY3Rpb24gKGFjdCwgZXhwLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGFjdCwgbXNnKS50by5ub3QuZXFsKGV4cCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNUcnVlKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIHRydWUuXG4gICAqXG4gICAqICAgICB2YXIgdGVhU2VydmVkID0gdHJ1ZTtcbiAgICogICAgIGFzc2VydC5pc1RydWUodGVhU2VydmVkLCAndGhlIHRlYSBoYXMgYmVlbiBzZXJ2ZWQnKTtcbiAgICpcbiAgICogQG5hbWUgaXNUcnVlXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc1RydWUgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS5pc1sndHJ1ZSddO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzRmFsc2UodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgZmFsc2UuXG4gICAqXG4gICAqICAgICB2YXIgdGVhU2VydmVkID0gZmFsc2U7XG4gICAqICAgICBhc3NlcnQuaXNGYWxzZSh0ZWFTZXJ2ZWQsICdubyB0ZWEgeWV0PyBobW0uLi4nKTtcbiAgICpcbiAgICogQG5hbWUgaXNGYWxzZVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNGYWxzZSA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLmlzWydmYWxzZSddO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTnVsbCh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBudWxsLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmlzTnVsbChlcnIsICd0aGVyZSB3YXMgbm8gZXJyb3InKTtcbiAgICpcbiAgICogQG5hbWUgaXNOdWxsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc051bGwgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5lcXVhbChudWxsKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc05vdE51bGwodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgbm90IG51bGwuXG4gICAqXG4gICAqICAgICB2YXIgdGVhID0gJ3Rhc3R5IGNoYWknO1xuICAgKiAgICAgYXNzZXJ0LmlzTm90TnVsbCh0ZWEsICdncmVhdCwgdGltZSBmb3IgdGVhIScpO1xuICAgKlxuICAgKiBAbmFtZSBpc05vdE51bGxcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTm90TnVsbCA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5lcXVhbChudWxsKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc1VuZGVmaW5lZCh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBgdW5kZWZpbmVkYC5cbiAgICpcbiAgICogICAgIHZhciB0ZWE7XG4gICAqICAgICBhc3NlcnQuaXNVbmRlZmluZWQodGVhLCAnbm8gdGVhIGRlZmluZWQnKTtcbiAgICpcbiAgICogQG5hbWUgaXNVbmRlZmluZWRcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzVW5kZWZpbmVkID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uZXF1YWwodW5kZWZpbmVkKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc0RlZmluZWQodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgbm90IGB1bmRlZmluZWRgLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYSA9ICdjdXAgb2YgY2hhaSc7XG4gICAqICAgICBhc3NlcnQuaXNEZWZpbmVkKHRlYSwgJ3RlYSBoYXMgYmVlbiBkZWZpbmVkJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzRGVmaW5lZFxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNEZWZpbmVkID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmVxdWFsKHVuZGVmaW5lZCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNGdW5jdGlvbih2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBhIGZ1bmN0aW9uLlxuICAgKlxuICAgKiAgICAgZnVuY3Rpb24gc2VydmVUZWEoKSB7IHJldHVybiAnY3VwIG9mIHRlYSc7IH07XG4gICAqICAgICBhc3NlcnQuaXNGdW5jdGlvbihzZXJ2ZVRlYSwgJ2dyZWF0LCB3ZSBjYW4gaGF2ZSB0ZWEgbm93Jyk7XG4gICAqXG4gICAqIEBuYW1lIGlzRnVuY3Rpb25cbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzRnVuY3Rpb24gPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5iZS5hKCdmdW5jdGlvbicpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTm90RnVuY3Rpb24odmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgX25vdF8gYSBmdW5jdGlvbi5cbiAgICpcbiAgICogICAgIHZhciBzZXJ2ZVRlYSA9IFsgJ2hlYXQnLCAncG91cicsICdzaXAnIF07XG4gICAqICAgICBhc3NlcnQuaXNOb3RGdW5jdGlvbihzZXJ2ZVRlYSwgJ2dyZWF0LCB3ZSBoYXZlIGxpc3RlZCB0aGUgc3RlcHMnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOb3RGdW5jdGlvblxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNOb3RGdW5jdGlvbiA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5iZS5hKCdmdW5jdGlvbicpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzT2JqZWN0KHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGFuIG9iamVjdCAoYXMgcmV2ZWFsZWQgYnlcbiAgICogYE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdgKS5cbiAgICpcbiAgICogICAgIHZhciBzZWxlY3Rpb24gPSB7IG5hbWU6ICdDaGFpJywgc2VydmU6ICd3aXRoIHNwaWNlcycgfTtcbiAgICogICAgIGFzc2VydC5pc09iamVjdChzZWxlY3Rpb24sICd0ZWEgc2VsZWN0aW9uIGlzIGFuIG9iamVjdCcpO1xuICAgKlxuICAgKiBAbmFtZSBpc09iamVjdFxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNPYmplY3QgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5iZS5hKCdvYmplY3QnKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc05vdE9iamVjdCh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBfbm90XyBhbiBvYmplY3QuXG4gICAqXG4gICAqICAgICB2YXIgc2VsZWN0aW9uID0gJ2NoYWknXG4gICAqICAgICBhc3NlcnQuaXNOb3RPYmplY3Qoc2VsZWN0aW9uLCAndGVhIHNlbGVjdGlvbiBpcyBub3QgYW4gb2JqZWN0Jyk7XG4gICAqICAgICBhc3NlcnQuaXNOb3RPYmplY3QobnVsbCwgJ251bGwgaXMgbm90IGFuIG9iamVjdCcpO1xuICAgKlxuICAgKiBAbmFtZSBpc05vdE9iamVjdFxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNOb3RPYmplY3QgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUuYSgnb2JqZWN0Jyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNBcnJheSh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBhbiBhcnJheS5cbiAgICpcbiAgICogICAgIHZhciBtZW51ID0gWyAnZ3JlZW4nLCAnY2hhaScsICdvb2xvbmcnIF07XG4gICAqICAgICBhc3NlcnQuaXNBcnJheShtZW51LCAnd2hhdCBraW5kIG9mIHRlYSBkbyB3ZSB3YW50PycpO1xuICAgKlxuICAgKiBAbmFtZSBpc0FycmF5XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc0FycmF5ID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uYmUuYW4oJ2FycmF5Jyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOb3RBcnJheSh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBfbm90XyBhbiBhcnJheS5cbiAgICpcbiAgICogICAgIHZhciBtZW51ID0gJ2dyZWVufGNoYWl8b29sb25nJztcbiAgICogICAgIGFzc2VydC5pc05vdEFycmF5KG1lbnUsICd3aGF0IGtpbmQgb2YgdGVhIGRvIHdlIHdhbnQ/Jyk7XG4gICAqXG4gICAqIEBuYW1lIGlzTm90QXJyYXlcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTm90QXJyYXkgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUuYW4oJ2FycmF5Jyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNTdHJpbmcodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYSBzdHJpbmcuXG4gICAqXG4gICAqICAgICB2YXIgdGVhT3JkZXIgPSAnY2hhaSc7XG4gICAqICAgICBhc3NlcnQuaXNTdHJpbmcodGVhT3JkZXIsICdvcmRlciBwbGFjZWQnKTtcbiAgICpcbiAgICogQG5hbWUgaXNTdHJpbmdcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzU3RyaW5nID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uYmUuYSgnc3RyaW5nJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOb3RTdHJpbmcodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgX25vdF8gYSBzdHJpbmcuXG4gICAqXG4gICAqICAgICB2YXIgdGVhT3JkZXIgPSA0O1xuICAgKiAgICAgYXNzZXJ0LmlzTm90U3RyaW5nKHRlYU9yZGVyLCAnb3JkZXIgcGxhY2VkJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzTm90U3RyaW5nXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc05vdFN0cmluZyA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5iZS5hKCdzdHJpbmcnKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc051bWJlcih2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBhIG51bWJlci5cbiAgICpcbiAgICogICAgIHZhciBjdXBzID0gMjtcbiAgICogICAgIGFzc2VydC5pc051bWJlcihjdXBzLCAnaG93IG1hbnkgY3VwcycpO1xuICAgKlxuICAgKiBAbmFtZSBpc051bWJlclxuICAgKiBAcGFyYW0ge051bWJlcn0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTnVtYmVyID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uYmUuYSgnbnVtYmVyJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOb3ROdW1iZXIodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgX25vdF8gYSBudW1iZXIuXG4gICAqXG4gICAqICAgICB2YXIgY3VwcyA9ICcyIGN1cHMgcGxlYXNlJztcbiAgICogICAgIGFzc2VydC5pc05vdE51bWJlcihjdXBzLCAnaG93IG1hbnkgY3VwcycpO1xuICAgKlxuICAgKiBAbmFtZSBpc05vdE51bWJlclxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNOb3ROdW1iZXIgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUuYSgnbnVtYmVyJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNCb29sZWFuKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGEgYm9vbGVhbi5cbiAgICpcbiAgICogICAgIHZhciB0ZWFSZWFkeSA9IHRydWVcbiAgICogICAgICAgLCB0ZWFTZXJ2ZWQgPSBmYWxzZTtcbiAgICpcbiAgICogICAgIGFzc2VydC5pc0Jvb2xlYW4odGVhUmVhZHksICdpcyB0aGUgdGVhIHJlYWR5Jyk7XG4gICAqICAgICBhc3NlcnQuaXNCb29sZWFuKHRlYVNlcnZlZCwgJ2hhcyB0ZWEgYmVlbiBzZXJ2ZWQnKTtcbiAgICpcbiAgICogQG5hbWUgaXNCb29sZWFuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc0Jvb2xlYW4gPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5iZS5hKCdib29sZWFuJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOb3RCb29sZWFuKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIF9ub3RfIGEgYm9vbGVhbi5cbiAgICpcbiAgICogICAgIHZhciB0ZWFSZWFkeSA9ICd5ZXAnXG4gICAqICAgICAgICwgdGVhU2VydmVkID0gJ25vcGUnO1xuICAgKlxuICAgKiAgICAgYXNzZXJ0LmlzTm90Qm9vbGVhbih0ZWFSZWFkeSwgJ2lzIHRoZSB0ZWEgcmVhZHknKTtcbiAgICogICAgIGFzc2VydC5pc05vdEJvb2xlYW4odGVhU2VydmVkLCAnaGFzIHRlYSBiZWVuIHNlcnZlZCcpO1xuICAgKlxuICAgKiBAbmFtZSBpc05vdEJvb2xlYW5cbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTm90Qm9vbGVhbiA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5iZS5hKCdib29sZWFuJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAudHlwZU9mKHZhbHVlLCBuYW1lLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgJ3MgdHlwZSBpcyBgbmFtZWAsIGFzIGRldGVybWluZWQgYnlcbiAgICogYE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LnR5cGVPZih7IHRlYTogJ2NoYWknIH0sICdvYmplY3QnLCAnd2UgaGF2ZSBhbiBvYmplY3QnKTtcbiAgICogICAgIGFzc2VydC50eXBlT2YoWydjaGFpJywgJ2phc21pbmUnXSwgJ2FycmF5JywgJ3dlIGhhdmUgYW4gYXJyYXknKTtcbiAgICogICAgIGFzc2VydC50eXBlT2YoJ3RlYScsICdzdHJpbmcnLCAnd2UgaGF2ZSBhIHN0cmluZycpO1xuICAgKiAgICAgYXNzZXJ0LnR5cGVPZigvdGVhLywgJ3JlZ2V4cCcsICd3ZSBoYXZlIGEgcmVndWxhciBleHByZXNzaW9uJyk7XG4gICAqICAgICBhc3NlcnQudHlwZU9mKG51bGwsICdudWxsJywgJ3dlIGhhdmUgYSBudWxsJyk7XG4gICAqICAgICBhc3NlcnQudHlwZU9mKHVuZGVmaW5lZCwgJ3VuZGVmaW5lZCcsICd3ZSBoYXZlIGFuIHVuZGVmaW5lZCcpO1xuICAgKlxuICAgKiBAbmFtZSB0eXBlT2ZcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LnR5cGVPZiA9IGZ1bmN0aW9uICh2YWwsIHR5cGUsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmJlLmEodHlwZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90VHlwZU9mKHZhbHVlLCBuYW1lLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgJ3MgdHlwZSBpcyBfbm90XyBgbmFtZWAsIGFzIGRldGVybWluZWQgYnlcbiAgICogYE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm5vdFR5cGVPZigndGVhJywgJ251bWJlcicsICdzdHJpbmdzIGFyZSBub3QgbnVtYmVycycpO1xuICAgKlxuICAgKiBAbmFtZSBub3RUeXBlT2ZcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IHR5cGVvZiBuYW1lXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3RUeXBlT2YgPSBmdW5jdGlvbiAodmFsLCB0eXBlLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUuYSh0eXBlKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pbnN0YW5jZU9mKG9iamVjdCwgY29uc3RydWN0b3IsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYW4gaW5zdGFuY2Ugb2YgYGNvbnN0cnVjdG9yYC5cbiAgICpcbiAgICogICAgIHZhciBUZWEgPSBmdW5jdGlvbiAobmFtZSkgeyB0aGlzLm5hbWUgPSBuYW1lOyB9XG4gICAqICAgICAgICwgY2hhaSA9IG5ldyBUZWEoJ2NoYWknKTtcbiAgICpcbiAgICogICAgIGFzc2VydC5pbnN0YW5jZU9mKGNoYWksIFRlYSwgJ2NoYWkgaXMgYW4gaW5zdGFuY2Ugb2YgdGVhJyk7XG4gICAqXG4gICAqIEBuYW1lIGluc3RhbmNlT2ZcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge0NvbnN0cnVjdG9yfSBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaW5zdGFuY2VPZiA9IGZ1bmN0aW9uICh2YWwsIHR5cGUsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmJlLmluc3RhbmNlT2YodHlwZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90SW5zdGFuY2VPZihvYmplY3QsIGNvbnN0cnVjdG9yLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgYHZhbHVlYCBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgYGNvbnN0cnVjdG9yYC5cbiAgICpcbiAgICogICAgIHZhciBUZWEgPSBmdW5jdGlvbiAobmFtZSkgeyB0aGlzLm5hbWUgPSBuYW1lOyB9XG4gICAqICAgICAgICwgY2hhaSA9IG5ldyBTdHJpbmcoJ2NoYWknKTtcbiAgICpcbiAgICogICAgIGFzc2VydC5ub3RJbnN0YW5jZU9mKGNoYWksIFRlYSwgJ2NoYWkgaXMgbm90IGFuIGluc3RhbmNlIG9mIHRlYScpO1xuICAgKlxuICAgKiBAbmFtZSBub3RJbnN0YW5jZU9mXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtDb25zdHJ1Y3Rvcn0gY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdEluc3RhbmNlT2YgPSBmdW5jdGlvbiAodmFsLCB0eXBlLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUuaW5zdGFuY2VPZih0eXBlKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pbmNsdWRlKGhheXN0YWNrLCBuZWVkbGUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBoYXlzdGFja2AgaW5jbHVkZXMgYG5lZWRsZWAuIFdvcmtzXG4gICAqIGZvciBzdHJpbmdzIGFuZCBhcnJheXMuXG4gICAqXG4gICAqICAgICBhc3NlcnQuaW5jbHVkZSgnZm9vYmFyJywgJ2JhcicsICdmb29iYXIgY29udGFpbnMgc3RyaW5nIFwiYmFyXCInKTtcbiAgICogICAgIGFzc2VydC5pbmNsdWRlKFsgMSwgMiwgMyBdLCAzLCAnYXJyYXkgY29udGFpbnMgdmFsdWUnKTtcbiAgICpcbiAgICogQG5hbWUgaW5jbHVkZVxuICAgKiBAcGFyYW0ge0FycmF5fFN0cmluZ30gaGF5c3RhY2tcbiAgICogQHBhcmFtIHtNaXhlZH0gbmVlZGxlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pbmNsdWRlID0gZnVuY3Rpb24gKGV4cCwgaW5jLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGV4cCwgbXNnLCBhc3NlcnQuaW5jbHVkZSkuaW5jbHVkZShpbmMpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdEluY2x1ZGUoaGF5c3RhY2ssIG5lZWRsZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYGhheXN0YWNrYCBkb2VzIG5vdCBpbmNsdWRlIGBuZWVkbGVgLiBXb3Jrc1xuICAgKiBmb3Igc3RyaW5ncyBhbmQgYXJyYXlzLlxuICAgKmlcbiAgICogICAgIGFzc2VydC5ub3RJbmNsdWRlKCdmb29iYXInLCAnYmF6JywgJ3N0cmluZyBub3QgaW5jbHVkZSBzdWJzdHJpbmcnKTtcbiAgICogICAgIGFzc2VydC5ub3RJbmNsdWRlKFsgMSwgMiwgMyBdLCA0LCAnYXJyYXkgbm90IGluY2x1ZGUgY29udGFpbiB2YWx1ZScpO1xuICAgKlxuICAgKiBAbmFtZSBub3RJbmNsdWRlXG4gICAqIEBwYXJhbSB7QXJyYXl8U3RyaW5nfSBoYXlzdGFja1xuICAgKiBAcGFyYW0ge01peGVkfSBuZWVkbGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdEluY2x1ZGUgPSBmdW5jdGlvbiAoZXhwLCBpbmMsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oZXhwLCBtc2csIGFzc2VydC5ub3RJbmNsdWRlKS5ub3QuaW5jbHVkZShpbmMpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm1hdGNoKHZhbHVlLCByZWdleHAsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgbWF0Y2hlcyB0aGUgcmVndWxhciBleHByZXNzaW9uIGByZWdleHBgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm1hdGNoKCdmb29iYXInLCAvXmZvby8sICdyZWdleHAgbWF0Y2hlcycpO1xuICAgKlxuICAgKiBAbmFtZSBtYXRjaFxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXhwXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5tYXRjaCA9IGZ1bmN0aW9uIChleHAsIHJlLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGV4cCwgbXNnKS50by5tYXRjaChyZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90TWF0Y2godmFsdWUsIHJlZ2V4cCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBkb2VzIG5vdCBtYXRjaCB0aGUgcmVndWxhciBleHByZXNzaW9uIGByZWdleHBgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm5vdE1hdGNoKCdmb29iYXInLCAvXmZvby8sICdyZWdleHAgZG9lcyBub3QgbWF0Y2gnKTtcbiAgICpcbiAgICogQG5hbWUgbm90TWF0Y2hcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4cFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90TWF0Y2ggPSBmdW5jdGlvbiAoZXhwLCByZSwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihleHAsIG1zZykudG8ubm90Lm1hdGNoKHJlKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5wcm9wZXJ0eShvYmplY3QsIHByb3BlcnR5LCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBoYXMgYSBwcm9wZXJ0eSBuYW1lZCBieSBgcHJvcGVydHlgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LnByb3BlcnR5KHsgdGVhOiB7IGdyZWVuOiAnbWF0Y2hhJyB9fSwgJ3RlYScpO1xuICAgKlxuICAgKiBAbmFtZSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQucHJvcGVydHkgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLnByb3BlcnR5KHByb3ApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdFByb3BlcnR5KG9iamVjdCwgcHJvcGVydHksIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGRvZXMgX25vdF8gaGF2ZSBhIHByb3BlcnR5IG5hbWVkIGJ5IGBwcm9wZXJ0eWAuXG4gICAqXG4gICAqICAgICBhc3NlcnQubm90UHJvcGVydHkoeyB0ZWE6IHsgZ3JlZW46ICdtYXRjaGEnIH19LCAnY29mZmVlJyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdFByb3BlcnR5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3RQcm9wZXJ0eSA9IGZ1bmN0aW9uIChvYmosIHByb3AsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLm5vdC5oYXZlLnByb3BlcnR5KHByb3ApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmRlZXBQcm9wZXJ0eShvYmplY3QsIHByb3BlcnR5LCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBoYXMgYSBwcm9wZXJ0eSBuYW1lZCBieSBgcHJvcGVydHlgLCB3aGljaCBjYW4gYmUgYVxuICAgKiBzdHJpbmcgdXNpbmcgZG90LSBhbmQgYnJhY2tldC1ub3RhdGlvbiBmb3IgZGVlcCByZWZlcmVuY2UuXG4gICAqXG4gICAqICAgICBhc3NlcnQuZGVlcFByb3BlcnR5KHsgdGVhOiB7IGdyZWVuOiAnbWF0Y2hhJyB9fSwgJ3RlYS5ncmVlbicpO1xuICAgKlxuICAgKiBAbmFtZSBkZWVwUHJvcGVydHlcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmRlZXBQcm9wZXJ0eSA9IGZ1bmN0aW9uIChvYmosIHByb3AsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eShwcm9wKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3REZWVwUHJvcGVydHkob2JqZWN0LCBwcm9wZXJ0eSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgZG9lcyBfbm90XyBoYXZlIGEgcHJvcGVydHkgbmFtZWQgYnkgYHByb3BlcnR5YCwgd2hpY2hcbiAgICogY2FuIGJlIGEgc3RyaW5nIHVzaW5nIGRvdC0gYW5kIGJyYWNrZXQtbm90YXRpb24gZm9yIGRlZXAgcmVmZXJlbmNlLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm5vdERlZXBQcm9wZXJ0eSh7IHRlYTogeyBncmVlbjogJ21hdGNoYScgfX0sICd0ZWEub29sb25nJyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdERlZXBQcm9wZXJ0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90RGVlcFByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgcHJvcCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8ubm90LmhhdmUuZGVlcC5wcm9wZXJ0eShwcm9wKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5wcm9wZXJ0eVZhbChvYmplY3QsIHByb3BlcnR5LCB2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaGFzIGEgcHJvcGVydHkgbmFtZWQgYnkgYHByb3BlcnR5YCB3aXRoIHZhbHVlIGdpdmVuXG4gICAqIGJ5IGB2YWx1ZWAuXG4gICAqXG4gICAqICAgICBhc3NlcnQucHJvcGVydHlWYWwoeyB0ZWE6ICdpcyBnb29kJyB9LCAndGVhJywgJ2lzIGdvb2QnKTtcbiAgICpcbiAgICogQG5hbWUgcHJvcGVydHlWYWxcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LnByb3BlcnR5VmFsID0gZnVuY3Rpb24gKG9iaiwgcHJvcCwgdmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLnByb3BlcnR5KHByb3AsIHZhbCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAucHJvcGVydHlOb3RWYWwob2JqZWN0LCBwcm9wZXJ0eSwgdmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGhhcyBhIHByb3BlcnR5IG5hbWVkIGJ5IGBwcm9wZXJ0eWAsIGJ1dCB3aXRoIGEgdmFsdWVcbiAgICogZGlmZmVyZW50IGZyb20gdGhhdCBnaXZlbiBieSBgdmFsdWVgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LnByb3BlcnR5Tm90VmFsKHsgdGVhOiAnaXMgZ29vZCcgfSwgJ3RlYScsICdpcyBiYWQnKTtcbiAgICpcbiAgICogQG5hbWUgcHJvcGVydHlOb3RWYWxcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LnByb3BlcnR5Tm90VmFsID0gZnVuY3Rpb24gKG9iaiwgcHJvcCwgdmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5ub3QuaGF2ZS5wcm9wZXJ0eShwcm9wLCB2YWwpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmRlZXBQcm9wZXJ0eVZhbChvYmplY3QsIHByb3BlcnR5LCB2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaGFzIGEgcHJvcGVydHkgbmFtZWQgYnkgYHByb3BlcnR5YCB3aXRoIHZhbHVlIGdpdmVuXG4gICAqIGJ5IGB2YWx1ZWAuIGBwcm9wZXJ0eWAgY2FuIHVzZSBkb3QtIGFuZCBicmFja2V0LW5vdGF0aW9uIGZvciBkZWVwXG4gICAqIHJlZmVyZW5jZS5cbiAgICpcbiAgICogICAgIGFzc2VydC5kZWVwUHJvcGVydHlWYWwoeyB0ZWE6IHsgZ3JlZW46ICdtYXRjaGEnIH19LCAndGVhLmdyZWVuJywgJ21hdGNoYScpO1xuICAgKlxuICAgKiBAbmFtZSBkZWVwUHJvcGVydHlWYWxcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmRlZXBQcm9wZXJ0eVZhbCA9IGZ1bmN0aW9uIChvYmosIHByb3AsIHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5kZWVwLnByb3BlcnR5KHByb3AsIHZhbCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuZGVlcFByb3BlcnR5Tm90VmFsKG9iamVjdCwgcHJvcGVydHksIHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBoYXMgYSBwcm9wZXJ0eSBuYW1lZCBieSBgcHJvcGVydHlgLCBidXQgd2l0aCBhIHZhbHVlXG4gICAqIGRpZmZlcmVudCBmcm9tIHRoYXQgZ2l2ZW4gYnkgYHZhbHVlYC4gYHByb3BlcnR5YCBjYW4gdXNlIGRvdC0gYW5kXG4gICAqIGJyYWNrZXQtbm90YXRpb24gZm9yIGRlZXAgcmVmZXJlbmNlLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmRlZXBQcm9wZXJ0eU5vdFZhbCh7IHRlYTogeyBncmVlbjogJ21hdGNoYScgfX0sICd0ZWEuZ3JlZW4nLCAna29uYWNoYScpO1xuICAgKlxuICAgKiBAbmFtZSBkZWVwUHJvcGVydHlOb3RWYWxcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmRlZXBQcm9wZXJ0eU5vdFZhbCA9IGZ1bmN0aW9uIChvYmosIHByb3AsIHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8ubm90LmhhdmUuZGVlcC5wcm9wZXJ0eShwcm9wLCB2YWwpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmxlbmd0aE9mKG9iamVjdCwgbGVuZ3RoLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBoYXMgYSBgbGVuZ3RoYCBwcm9wZXJ0eSB3aXRoIHRoZSBleHBlY3RlZCB2YWx1ZS5cbiAgICpcbiAgICogICAgIGFzc2VydC5sZW5ndGhPZihbMSwyLDNdLCAzLCAnYXJyYXkgaGFzIGxlbmd0aCBvZiAzJyk7XG4gICAqICAgICBhc3NlcnQubGVuZ3RoT2YoJ2Zvb2JhcicsIDUsICdzdHJpbmcgaGFzIGxlbmd0aCBvZiA2Jyk7XG4gICAqXG4gICAqIEBuYW1lIGxlbmd0aE9mXG4gICAqIEBwYXJhbSB7TWl4ZWR9IG9iamVjdFxuICAgKiBAcGFyYW0ge051bWJlcn0gbGVuZ3RoXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5sZW5ndGhPZiA9IGZ1bmN0aW9uIChleHAsIGxlbiwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihleHAsIG1zZykudG8uaGF2ZS5sZW5ndGgobGVuKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC50aHJvd3MoZnVuY3Rpb24sIFtjb25zdHJ1Y3Rvci9zdHJpbmcvcmVnZXhwXSwgW3N0cmluZy9yZWdleHBdLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgZnVuY3Rpb25gIHdpbGwgdGhyb3cgYW4gZXJyb3IgdGhhdCBpcyBhbiBpbnN0YW5jZSBvZlxuICAgKiBgY29uc3RydWN0b3JgLCBvciBhbHRlcm5hdGVseSB0aGF0IGl0IHdpbGwgdGhyb3cgYW4gZXJyb3Igd2l0aCBtZXNzYWdlXG4gICAqIG1hdGNoaW5nIGByZWdleHBgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LnRocm93KGZuLCAnZnVuY3Rpb24gdGhyb3dzIGEgcmVmZXJlbmNlIGVycm9yJyk7XG4gICAqICAgICBhc3NlcnQudGhyb3coZm4sIC9mdW5jdGlvbiB0aHJvd3MgYSByZWZlcmVuY2UgZXJyb3IvKTtcbiAgICogICAgIGFzc2VydC50aHJvdyhmbiwgUmVmZXJlbmNlRXJyb3IpO1xuICAgKiAgICAgYXNzZXJ0LnRocm93KGZuLCBSZWZlcmVuY2VFcnJvciwgJ2Z1bmN0aW9uIHRocm93cyBhIHJlZmVyZW5jZSBlcnJvcicpO1xuICAgKiAgICAgYXNzZXJ0LnRocm93KGZuLCBSZWZlcmVuY2VFcnJvciwgL2Z1bmN0aW9uIHRocm93cyBhIHJlZmVyZW5jZSBlcnJvci8pO1xuICAgKlxuICAgKiBAbmFtZSB0aHJvd3NcbiAgICogQGFsaWFzIHRocm93XG4gICAqIEBhbGlhcyBUaHJvd1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jdGlvblxuICAgKiBAcGFyYW0ge0Vycm9yQ29uc3RydWN0b3J9IGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7UmVnRXhwfSByZWdleHBcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9FcnJvciNFcnJvcl90eXBlc1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuVGhyb3cgPSBmdW5jdGlvbiAoZm4sIGVycnQsIGVycnMsIG1zZykge1xuICAgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIGVycnQgfHwgZXJydCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgZXJycyA9IGVycnQ7XG4gICAgICBlcnJ0ID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgYXNzZXJ0RXJyID0gbmV3IEFzc2VydGlvbihmbiwgbXNnKS50by5UaHJvdyhlcnJ0LCBlcnJzKTtcbiAgICByZXR1cm4gZmxhZyhhc3NlcnRFcnIsICdvYmplY3QnKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5kb2VzTm90VGhyb3coZnVuY3Rpb24sIFtjb25zdHJ1Y3Rvci9yZWdleHBdLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgZnVuY3Rpb25gIHdpbGwgX25vdF8gdGhyb3cgYW4gZXJyb3IgdGhhdCBpcyBhbiBpbnN0YW5jZSBvZlxuICAgKiBgY29uc3RydWN0b3JgLCBvciBhbHRlcm5hdGVseSB0aGF0IGl0IHdpbGwgbm90IHRocm93IGFuIGVycm9yIHdpdGggbWVzc2FnZVxuICAgKiBtYXRjaGluZyBgcmVnZXhwYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5kb2VzTm90VGhyb3coZm4sIEVycm9yLCAnZnVuY3Rpb24gZG9lcyBub3QgdGhyb3cnKTtcbiAgICpcbiAgICogQG5hbWUgZG9lc05vdFRocm93XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmN0aW9uXG4gICAqIEBwYXJhbSB7RXJyb3JDb25zdHJ1Y3Rvcn0gY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4cFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0Vycm9yI0Vycm9yX3R5cGVzXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5kb2VzTm90VGhyb3cgPSBmdW5jdGlvbiAoZm4sIHR5cGUsIG1zZykge1xuICAgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIHR5cGUpIHtcbiAgICAgIG1zZyA9IHR5cGU7XG4gICAgICB0eXBlID0gbnVsbDtcbiAgICB9XG5cbiAgICBuZXcgQXNzZXJ0aW9uKGZuLCBtc2cpLnRvLm5vdC5UaHJvdyh0eXBlKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5vcGVyYXRvcih2YWwxLCBvcGVyYXRvciwgdmFsMiwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBDb21wYXJlcyB0d28gdmFsdWVzIHVzaW5nIGBvcGVyYXRvcmAuXG4gICAqXG4gICAqICAgICBhc3NlcnQub3BlcmF0b3IoMSwgJzwnLCAyLCAnZXZlcnl0aGluZyBpcyBvaycpO1xuICAgKiAgICAgYXNzZXJ0Lm9wZXJhdG9yKDEsICc+JywgMiwgJ3RoaXMgd2lsbCBmYWlsJyk7XG4gICAqXG4gICAqIEBuYW1lIG9wZXJhdG9yXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbDFcbiAgICogQHBhcmFtIHtTdHJpbmd9IG9wZXJhdG9yXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbDJcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm9wZXJhdG9yID0gZnVuY3Rpb24gKHZhbCwgb3BlcmF0b3IsIHZhbDIsIG1zZykge1xuICAgIGlmICghflsnPT0nLCAnPT09JywgJz4nLCAnPj0nLCAnPCcsICc8PScsICchPScsICchPT0nXS5pbmRleE9mKG9wZXJhdG9yKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIG9wZXJhdG9yIFwiJyArIG9wZXJhdG9yICsgJ1wiJyk7XG4gICAgfVxuICAgIHZhciB0ZXN0ID0gbmV3IEFzc2VydGlvbihldmFsKHZhbCArIG9wZXJhdG9yICsgdmFsMiksIG1zZyk7XG4gICAgdGVzdC5hc3NlcnQoXG4gICAgICAgIHRydWUgPT09IGZsYWcodGVzdCwgJ29iamVjdCcpXG4gICAgICAsICdleHBlY3RlZCAnICsgdXRpbC5pbnNwZWN0KHZhbCkgKyAnIHRvIGJlICcgKyBvcGVyYXRvciArICcgJyArIHV0aWwuaW5zcGVjdCh2YWwyKVxuICAgICAgLCAnZXhwZWN0ZWQgJyArIHV0aWwuaW5zcGVjdCh2YWwpICsgJyB0byBub3QgYmUgJyArIG9wZXJhdG9yICsgJyAnICsgdXRpbC5pbnNwZWN0KHZhbDIpICk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuY2xvc2VUbyhhY3R1YWwsIGV4cGVjdGVkLCBkZWx0YSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBlcXVhbCBgZXhwZWN0ZWRgLCB0byB3aXRoaW4gYSArLy0gYGRlbHRhYCByYW5nZS5cbiAgICpcbiAgICogICAgIGFzc2VydC5jbG9zZVRvKDEuNSwgMSwgMC41LCAnbnVtYmVycyBhcmUgY2xvc2UnKTtcbiAgICpcbiAgICogQG5hbWUgY2xvc2VUb1xuICAgKiBAcGFyYW0ge051bWJlcn0gYWN0dWFsXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge051bWJlcn0gZGVsdGFcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmNsb3NlVG8gPSBmdW5jdGlvbiAoYWN0LCBleHAsIGRlbHRhLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGFjdCwgbXNnKS50by5iZS5jbG9zZVRvKGV4cCwgZGVsdGEpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLnNhbWVNZW1iZXJzKHNldDEsIHNldDIsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBzZXQxYCBhbmQgYHNldDJgIGhhdmUgdGhlIHNhbWUgbWVtYmVycy5cbiAgICogT3JkZXIgaXMgbm90IHRha2VuIGludG8gYWNjb3VudC5cbiAgICpcbiAgICogICAgIGFzc2VydC5zYW1lTWVtYmVycyhbIDEsIDIsIDMgXSwgWyAyLCAxLCAzIF0sICdzYW1lIG1lbWJlcnMnKTtcbiAgICpcbiAgICogQG5hbWUgc2FtZU1lbWJlcnNcbiAgICogQHBhcmFtIHtBcnJheX0gc3VwZXJzZXRcbiAgICogQHBhcmFtIHtBcnJheX0gc3Vic2V0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5zYW1lTWVtYmVycyA9IGZ1bmN0aW9uIChzZXQxLCBzZXQyLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHNldDEsIG1zZykudG8uaGF2ZS5zYW1lLm1lbWJlcnMoc2V0Mik7XG4gIH1cblxuICAvKipcbiAgICogIyMjIC5pbmNsdWRlTWVtYmVycyhzdXBlcnNldCwgc3Vic2V0LCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgc3Vic2V0YCBpcyBpbmNsdWRlZCBpbiBgc3VwZXJzZXRgLlxuICAgKiBPcmRlciBpcyBub3QgdGFrZW4gaW50byBhY2NvdW50LlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmluY2x1ZGVNZW1iZXJzKFsgMSwgMiwgMyBdLCBbIDIsIDEgXSwgJ2luY2x1ZGUgbWVtYmVycycpO1xuICAgKlxuICAgKiBAbmFtZSBpbmNsdWRlTWVtYmVyc1xuICAgKiBAcGFyYW0ge0FycmF5fSBzdXBlcnNldFxuICAgKiBAcGFyYW0ge0FycmF5fSBzdWJzZXRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmluY2x1ZGVNZW1iZXJzID0gZnVuY3Rpb24gKHN1cGVyc2V0LCBzdWJzZXQsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oc3VwZXJzZXQsIG1zZykudG8uaW5jbHVkZS5tZW1iZXJzKHN1YnNldCk7XG4gIH1cblxuICAvKiFcbiAgICogVW5kb2N1bWVudGVkIC8gdW50ZXN0ZWRcbiAgICovXG5cbiAgYXNzZXJ0LmlmRXJyb3IgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUub2s7XG4gIH07XG5cbiAgLyohXG4gICAqIEFsaWFzZXMuXG4gICAqL1xuXG4gIChmdW5jdGlvbiBhbGlhcyhuYW1lLCBhcyl7XG4gICAgYXNzZXJ0W2FzXSA9IGFzc2VydFtuYW1lXTtcbiAgICByZXR1cm4gYWxpYXM7XG4gIH0pXG4gICgnVGhyb3cnLCAndGhyb3cnKVxuICAoJ1Rocm93JywgJ3Rocm93cycpO1xufTtcbiIsIi8qIVxuICogY2hhaVxuICogQ29weXJpZ2h0KGMpIDIwMTEtMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNoYWksIHV0aWwpIHtcbiAgY2hhaS5leHBlY3QgPSBmdW5jdGlvbiAodmFsLCBtZXNzYWdlKSB7XG4gICAgcmV0dXJuIG5ldyBjaGFpLkFzc2VydGlvbih2YWwsIG1lc3NhZ2UpO1xuICB9O1xufTtcblxuIiwiLyohXG4gKiBjaGFpXG4gKiBDb3B5cmlnaHQoYykgMjAxMS0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY2hhaSwgdXRpbCkge1xuICB2YXIgQXNzZXJ0aW9uID0gY2hhaS5Bc3NlcnRpb247XG5cbiAgZnVuY3Rpb24gbG9hZFNob3VsZCAoKSB7XG4gICAgLy8gZXhwbGljaXRseSBkZWZpbmUgdGhpcyBtZXRob2QgYXMgZnVuY3Rpb24gYXMgdG8gaGF2ZSBpdCdzIG5hbWUgdG8gaW5jbHVkZSBhcyBgc3NmaWBcbiAgICBmdW5jdGlvbiBzaG91bGRHZXR0ZXIoKSB7XG4gICAgICBpZiAodGhpcyBpbnN0YW5jZW9mIFN0cmluZyB8fCB0aGlzIGluc3RhbmNlb2YgTnVtYmVyKSB7XG4gICAgICAgIHJldHVybiBuZXcgQXNzZXJ0aW9uKHRoaXMuY29uc3RydWN0b3IodGhpcyksIG51bGwsIHNob3VsZEdldHRlcik7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMgaW5zdGFuY2VvZiBCb29sZWFuKSB7XG4gICAgICAgIHJldHVybiBuZXcgQXNzZXJ0aW9uKHRoaXMgPT0gdHJ1ZSwgbnVsbCwgc2hvdWxkR2V0dGVyKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgQXNzZXJ0aW9uKHRoaXMsIG51bGwsIHNob3VsZEdldHRlcik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHNob3VsZFNldHRlcih2YWx1ZSkge1xuICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9jaGFpanMvY2hhaS9pc3N1ZXMvODY6IHRoaXMgbWFrZXNcbiAgICAgIC8vIGB3aGF0ZXZlci5zaG91bGQgPSBzb21lVmFsdWVgIGFjdHVhbGx5IHNldCBgc29tZVZhbHVlYCwgd2hpY2ggaXNcbiAgICAgIC8vIGVzcGVjaWFsbHkgdXNlZnVsIGZvciBgZ2xvYmFsLnNob3VsZCA9IHJlcXVpcmUoJ2NoYWknKS5zaG91bGQoKWAuXG4gICAgICAvL1xuICAgICAgLy8gTm90ZSB0aGF0IHdlIGhhdmUgdG8gdXNlIFtbRGVmaW5lUHJvcGVydHldXSBpbnN0ZWFkIG9mIFtbUHV0XV1cbiAgICAgIC8vIHNpbmNlIG90aGVyd2lzZSB3ZSB3b3VsZCB0cmlnZ2VyIHRoaXMgdmVyeSBzZXR0ZXIhXG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3Nob3VsZCcsIHtcbiAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gbW9kaWZ5IE9iamVjdC5wcm90b3R5cGUgdG8gaGF2ZSBgc2hvdWxkYFxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShPYmplY3QucHJvdG90eXBlLCAnc2hvdWxkJywge1xuICAgICAgc2V0OiBzaG91bGRTZXR0ZXJcbiAgICAgICwgZ2V0OiBzaG91bGRHZXR0ZXJcbiAgICAgICwgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG5cbiAgICB2YXIgc2hvdWxkID0ge307XG5cbiAgICBzaG91bGQuZXF1YWwgPSBmdW5jdGlvbiAodmFsMSwgdmFsMiwgbXNnKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKHZhbDEsIG1zZykudG8uZXF1YWwodmFsMik7XG4gICAgfTtcblxuICAgIHNob3VsZC5UaHJvdyA9IGZ1bmN0aW9uIChmbiwgZXJydCwgZXJycywgbXNnKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKGZuLCBtc2cpLnRvLlRocm93KGVycnQsIGVycnMpO1xuICAgIH07XG5cbiAgICBzaG91bGQuZXhpc3QgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmV4aXN0O1xuICAgIH1cblxuICAgIC8vIG5lZ2F0aW9uXG4gICAgc2hvdWxkLm5vdCA9IHt9XG5cbiAgICBzaG91bGQubm90LmVxdWFsID0gZnVuY3Rpb24gKHZhbDEsIHZhbDIsIG1zZykge1xuICAgICAgbmV3IEFzc2VydGlvbih2YWwxLCBtc2cpLnRvLm5vdC5lcXVhbCh2YWwyKTtcbiAgICB9O1xuXG4gICAgc2hvdWxkLm5vdC5UaHJvdyA9IGZ1bmN0aW9uIChmbiwgZXJydCwgZXJycywgbXNnKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKGZuLCBtc2cpLnRvLm5vdC5UaHJvdyhlcnJ0LCBlcnJzKTtcbiAgICB9O1xuXG4gICAgc2hvdWxkLm5vdC5leGlzdCA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmV4aXN0O1xuICAgIH1cblxuICAgIHNob3VsZFsndGhyb3cnXSA9IHNob3VsZFsnVGhyb3cnXTtcbiAgICBzaG91bGQubm90Wyd0aHJvdyddID0gc2hvdWxkLm5vdFsnVGhyb3cnXTtcblxuICAgIHJldHVybiBzaG91bGQ7XG4gIH07XG5cbiAgY2hhaS5zaG91bGQgPSBsb2FkU2hvdWxkO1xuICBjaGFpLlNob3VsZCA9IGxvYWRTaG91bGQ7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gYWRkQ2hhaW5pbmdNZXRob2QgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGVuY2llc1xuICovXG5cbnZhciB0cmFuc2ZlckZsYWdzID0gcmVxdWlyZSgnLi90cmFuc2ZlckZsYWdzJyk7XG52YXIgZmxhZyA9IHJlcXVpcmUoJy4vZmxhZycpO1xudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpO1xuXG4vKiFcbiAqIE1vZHVsZSB2YXJpYWJsZXNcbiAqL1xuXG4vLyBDaGVjayB3aGV0aGVyIGBfX3Byb3RvX19gIGlzIHN1cHBvcnRlZFxudmFyIGhhc1Byb3RvU3VwcG9ydCA9ICdfX3Byb3RvX18nIGluIE9iamVjdDtcblxuLy8gV2l0aG91dCBgX19wcm90b19fYCBzdXBwb3J0LCB0aGlzIG1vZHVsZSB3aWxsIG5lZWQgdG8gYWRkIHByb3BlcnRpZXMgdG8gYSBmdW5jdGlvbi5cbi8vIEhvd2V2ZXIsIHNvbWUgRnVuY3Rpb24ucHJvdG90eXBlIG1ldGhvZHMgY2Fubm90IGJlIG92ZXJ3cml0dGVuLFxuLy8gYW5kIHRoZXJlIHNlZW1zIG5vIGVhc3kgY3Jvc3MtcGxhdGZvcm0gd2F5IHRvIGRldGVjdCB0aGVtIChAc2VlIGNoYWlqcy9jaGFpL2lzc3Vlcy82OSkuXG52YXIgZXhjbHVkZU5hbWVzID0gL14oPzpsZW5ndGh8bmFtZXxhcmd1bWVudHN8Y2FsbGVyKSQvO1xuXG4vLyBDYWNoZSBgRnVuY3Rpb25gIHByb3BlcnRpZXNcbnZhciBjYWxsICA9IEZ1bmN0aW9uLnByb3RvdHlwZS5jYWxsLFxuICAgIGFwcGx5ID0gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5O1xuXG4vKipcbiAqICMjIyBhZGRDaGFpbmFibGVNZXRob2QgKGN0eCwgbmFtZSwgbWV0aG9kLCBjaGFpbmluZ0JlaGF2aW9yKVxuICpcbiAqIEFkZHMgYSBtZXRob2QgdG8gYW4gb2JqZWN0LCBzdWNoIHRoYXQgdGhlIG1ldGhvZCBjYW4gYWxzbyBiZSBjaGFpbmVkLlxuICpcbiAqICAgICB1dGlscy5hZGRDaGFpbmFibGVNZXRob2QoY2hhaS5Bc3NlcnRpb24ucHJvdG90eXBlLCAnZm9vJywgZnVuY3Rpb24gKHN0cikge1xuICogICAgICAgdmFyIG9iaiA9IHV0aWxzLmZsYWcodGhpcywgJ29iamVjdCcpO1xuICogICAgICAgbmV3IGNoYWkuQXNzZXJ0aW9uKG9iaikudG8uYmUuZXF1YWwoc3RyKTtcbiAqICAgICB9KTtcbiAqXG4gKiBDYW4gYWxzbyBiZSBhY2Nlc3NlZCBkaXJlY3RseSBmcm9tIGBjaGFpLkFzc2VydGlvbmAuXG4gKlxuICogICAgIGNoYWkuQXNzZXJ0aW9uLmFkZENoYWluYWJsZU1ldGhvZCgnZm9vJywgZm4sIGNoYWluaW5nQmVoYXZpb3IpO1xuICpcbiAqIFRoZSByZXN1bHQgY2FuIHRoZW4gYmUgdXNlZCBhcyBib3RoIGEgbWV0aG9kIGFzc2VydGlvbiwgZXhlY3V0aW5nIGJvdGggYG1ldGhvZGAgYW5kXG4gKiBgY2hhaW5pbmdCZWhhdmlvcmAsIG9yIGFzIGEgbGFuZ3VhZ2UgY2hhaW4sIHdoaWNoIG9ubHkgZXhlY3V0ZXMgYGNoYWluaW5nQmVoYXZpb3JgLlxuICpcbiAqICAgICBleHBlY3QoZm9vU3RyKS50by5iZS5mb28oJ2JhcicpO1xuICogICAgIGV4cGVjdChmb29TdHIpLnRvLmJlLmZvby5lcXVhbCgnZm9vJyk7XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGN0eCBvYmplY3QgdG8gd2hpY2ggdGhlIG1ldGhvZCBpcyBhZGRlZFxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgb2YgbWV0aG9kIHRvIGFkZFxuICogQHBhcmFtIHtGdW5jdGlvbn0gbWV0aG9kIGZ1bmN0aW9uIHRvIGJlIHVzZWQgZm9yIGBuYW1lYCwgd2hlbiBjYWxsZWRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNoYWluaW5nQmVoYXZpb3IgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGV2ZXJ5IHRpbWUgdGhlIHByb3BlcnR5IGlzIGFjY2Vzc2VkXG4gKiBAbmFtZSBhZGRDaGFpbmFibGVNZXRob2RcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY3R4LCBuYW1lLCBtZXRob2QsIGNoYWluaW5nQmVoYXZpb3IpIHtcbiAgaWYgKHR5cGVvZiBjaGFpbmluZ0JlaGF2aW9yICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgY2hhaW5pbmdCZWhhdmlvciA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgfVxuXG4gIHZhciBjaGFpbmFibGVCZWhhdmlvciA9IHtcbiAgICAgIG1ldGhvZDogbWV0aG9kXG4gICAgLCBjaGFpbmluZ0JlaGF2aW9yOiBjaGFpbmluZ0JlaGF2aW9yXG4gIH07XG5cbiAgLy8gc2F2ZSB0aGUgbWV0aG9kcyBzbyB3ZSBjYW4gb3ZlcndyaXRlIHRoZW0gbGF0ZXIsIGlmIHdlIG5lZWQgdG8uXG4gIGlmICghY3R4Ll9fbWV0aG9kcykge1xuICAgIGN0eC5fX21ldGhvZHMgPSB7fTtcbiAgfVxuICBjdHguX19tZXRob2RzW25hbWVdID0gY2hhaW5hYmxlQmVoYXZpb3I7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGN0eCwgbmFtZSxcbiAgICB7IGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBjaGFpbmFibGVCZWhhdmlvci5jaGFpbmluZ0JlaGF2aW9yLmNhbGwodGhpcyk7XG5cbiAgICAgICAgdmFyIGFzc2VydCA9IGZ1bmN0aW9uIGFzc2VydCgpIHtcbiAgICAgICAgICB2YXIgb2xkX3NzZmkgPSBmbGFnKHRoaXMsICdzc2ZpJyk7XG4gICAgICAgICAgaWYgKG9sZF9zc2ZpICYmIGNvbmZpZy5pbmNsdWRlU3RhY2sgPT09IGZhbHNlKVxuICAgICAgICAgICAgZmxhZyh0aGlzLCAnc3NmaScsIGFzc2VydCk7XG4gICAgICAgICAgdmFyIHJlc3VsdCA9IGNoYWluYWJsZUJlaGF2aW9yLm1ldGhvZC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgIHJldHVybiByZXN1bHQgPT09IHVuZGVmaW5lZCA/IHRoaXMgOiByZXN1bHQ7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVXNlIGBfX3Byb3RvX19gIGlmIGF2YWlsYWJsZVxuICAgICAgICBpZiAoaGFzUHJvdG9TdXBwb3J0KSB7XG4gICAgICAgICAgLy8gSW5oZXJpdCBhbGwgcHJvcGVydGllcyBmcm9tIHRoZSBvYmplY3QgYnkgcmVwbGFjaW5nIHRoZSBgRnVuY3Rpb25gIHByb3RvdHlwZVxuICAgICAgICAgIHZhciBwcm90b3R5cGUgPSBhc3NlcnQuX19wcm90b19fID0gT2JqZWN0LmNyZWF0ZSh0aGlzKTtcbiAgICAgICAgICAvLyBSZXN0b3JlIHRoZSBgY2FsbGAgYW5kIGBhcHBseWAgbWV0aG9kcyBmcm9tIGBGdW5jdGlvbmBcbiAgICAgICAgICBwcm90b3R5cGUuY2FsbCA9IGNhbGw7XG4gICAgICAgICAgcHJvdG90eXBlLmFwcGx5ID0gYXBwbHk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gT3RoZXJ3aXNlLCByZWRlZmluZSBhbGwgcHJvcGVydGllcyAoc2xvdyEpXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHZhciBhc3NlcnRlck5hbWVzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoY3R4KTtcbiAgICAgICAgICBhc3NlcnRlck5hbWVzLmZvckVhY2goZnVuY3Rpb24gKGFzc2VydGVyTmFtZSkge1xuICAgICAgICAgICAgaWYgKCFleGNsdWRlTmFtZXMudGVzdChhc3NlcnRlck5hbWUpKSB7XG4gICAgICAgICAgICAgIHZhciBwZCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoY3R4LCBhc3NlcnRlck5hbWUpO1xuICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoYXNzZXJ0LCBhc3NlcnRlck5hbWUsIHBkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyYW5zZmVyRmxhZ3ModGhpcywgYXNzZXJ0KTtcbiAgICAgICAgcmV0dXJuIGFzc2VydDtcbiAgICAgIH1cbiAgICAsIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICB9KTtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBhZGRNZXRob2QgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbnZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKTtcblxuLyoqXG4gKiAjIyMgLmFkZE1ldGhvZCAoY3R4LCBuYW1lLCBtZXRob2QpXG4gKlxuICogQWRkcyBhIG1ldGhvZCB0byB0aGUgcHJvdG90eXBlIG9mIGFuIG9iamVjdC5cbiAqXG4gKiAgICAgdXRpbHMuYWRkTWV0aG9kKGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZSwgJ2ZvbycsIGZ1bmN0aW9uIChzdHIpIHtcbiAqICAgICAgIHZhciBvYmogPSB1dGlscy5mbGFnKHRoaXMsICdvYmplY3QnKTtcbiAqICAgICAgIG5ldyBjaGFpLkFzc2VydGlvbihvYmopLnRvLmJlLmVxdWFsKHN0cik7XG4gKiAgICAgfSk7XG4gKlxuICogQ2FuIGFsc28gYmUgYWNjZXNzZWQgZGlyZWN0bHkgZnJvbSBgY2hhaS5Bc3NlcnRpb25gLlxuICpcbiAqICAgICBjaGFpLkFzc2VydGlvbi5hZGRNZXRob2QoJ2ZvbycsIGZuKTtcbiAqXG4gKiBUaGVuIGNhbiBiZSB1c2VkIGFzIGFueSBvdGhlciBhc3NlcnRpb24uXG4gKlxuICogICAgIGV4cGVjdChmb29TdHIpLnRvLmJlLmZvbygnYmFyJyk7XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGN0eCBvYmplY3QgdG8gd2hpY2ggdGhlIG1ldGhvZCBpcyBhZGRlZFxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgb2YgbWV0aG9kIHRvIGFkZFxuICogQHBhcmFtIHtGdW5jdGlvbn0gbWV0aG9kIGZ1bmN0aW9uIHRvIGJlIHVzZWQgZm9yIG5hbWVcbiAqIEBuYW1lIGFkZE1ldGhvZFxuICogQGFwaSBwdWJsaWNcbiAqL1xudmFyIGZsYWcgPSByZXF1aXJlKCcuL2ZsYWcnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY3R4LCBuYW1lLCBtZXRob2QpIHtcbiAgY3R4W25hbWVdID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBvbGRfc3NmaSA9IGZsYWcodGhpcywgJ3NzZmknKTtcbiAgICBpZiAob2xkX3NzZmkgJiYgY29uZmlnLmluY2x1ZGVTdGFjayA9PT0gZmFsc2UpXG4gICAgICBmbGFnKHRoaXMsICdzc2ZpJywgY3R4W25hbWVdKTtcbiAgICB2YXIgcmVzdWx0ID0gbWV0aG9kLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIHJlc3VsdCA9PT0gdW5kZWZpbmVkID8gdGhpcyA6IHJlc3VsdDtcbiAgfTtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBhZGRQcm9wZXJ0eSB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgYWRkUHJvcGVydHkgKGN0eCwgbmFtZSwgZ2V0dGVyKVxuICpcbiAqIEFkZHMgYSBwcm9wZXJ0eSB0byB0aGUgcHJvdG90eXBlIG9mIGFuIG9iamVjdC5cbiAqXG4gKiAgICAgdXRpbHMuYWRkUHJvcGVydHkoY2hhaS5Bc3NlcnRpb24ucHJvdG90eXBlLCAnZm9vJywgZnVuY3Rpb24gKCkge1xuICogICAgICAgdmFyIG9iaiA9IHV0aWxzLmZsYWcodGhpcywgJ29iamVjdCcpO1xuICogICAgICAgbmV3IGNoYWkuQXNzZXJ0aW9uKG9iaikudG8uYmUuaW5zdGFuY2VvZihGb28pO1xuICogICAgIH0pO1xuICpcbiAqIENhbiBhbHNvIGJlIGFjY2Vzc2VkIGRpcmVjdGx5IGZyb20gYGNoYWkuQXNzZXJ0aW9uYC5cbiAqXG4gKiAgICAgY2hhaS5Bc3NlcnRpb24uYWRkUHJvcGVydHkoJ2ZvbycsIGZuKTtcbiAqXG4gKiBUaGVuIGNhbiBiZSB1c2VkIGFzIGFueSBvdGhlciBhc3NlcnRpb24uXG4gKlxuICogICAgIGV4cGVjdChteUZvbykudG8uYmUuZm9vO1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHggb2JqZWN0IHRvIHdoaWNoIHRoZSBwcm9wZXJ0eSBpcyBhZGRlZFxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgb2YgcHJvcGVydHkgdG8gYWRkXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBnZXR0ZXIgZnVuY3Rpb24gdG8gYmUgdXNlZCBmb3IgbmFtZVxuICogQG5hbWUgYWRkUHJvcGVydHlcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY3R4LCBuYW1lLCBnZXR0ZXIpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGN0eCwgbmFtZSxcbiAgICB7IGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gZ2V0dGVyLmNhbGwodGhpcyk7XG4gICAgICAgIHJldHVybiByZXN1bHQgPT09IHVuZGVmaW5lZCA/IHRoaXMgOiByZXN1bHQ7XG4gICAgICB9XG4gICAgLCBjb25maWd1cmFibGU6IHRydWVcbiAgfSk7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gZmxhZyB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgZmxhZyhvYmplY3QgLGtleSwgW3ZhbHVlXSlcbiAqXG4gKiBHZXQgb3Igc2V0IGEgZmxhZyB2YWx1ZSBvbiBhbiBvYmplY3QuIElmIGFcbiAqIHZhbHVlIGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgc2V0LCBlbHNlIGl0IHdpbGxcbiAqIHJldHVybiB0aGUgY3VycmVudGx5IHNldCB2YWx1ZSBvciBgdW5kZWZpbmVkYCBpZlxuICogdGhlIHZhbHVlIGlzIG5vdCBzZXQuXG4gKlxuICogICAgIHV0aWxzLmZsYWcodGhpcywgJ2ZvbycsICdiYXInKTsgLy8gc2V0dGVyXG4gKiAgICAgdXRpbHMuZmxhZyh0aGlzLCAnZm9vJyk7IC8vIGdldHRlciwgcmV0dXJucyBgYmFyYFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgKGNvbnN0cnVjdGVkIEFzc2VydGlvblxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgKG9wdGlvbmFsKVxuICogQG5hbWUgZmxhZ1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqLCBrZXksIHZhbHVlKSB7XG4gIHZhciBmbGFncyA9IG9iai5fX2ZsYWdzIHx8IChvYmouX19mbGFncyA9IE9iamVjdC5jcmVhdGUobnVsbCkpO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMykge1xuICAgIGZsYWdzW2tleV0gPSB2YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmxhZ3Nba2V5XTtcbiAgfVxufTtcbiIsIi8qIVxuICogQ2hhaSAtIGdldEFjdHVhbCB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIGdldEFjdHVhbChvYmplY3QsIFthY3R1YWxdKVxuICpcbiAqIFJldHVybnMgdGhlIGBhY3R1YWxgIHZhbHVlIGZvciBhbiBBc3NlcnRpb25cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IChjb25zdHJ1Y3RlZCBBc3NlcnRpb24pXG4gKiBAcGFyYW0ge0FyZ3VtZW50c30gY2hhaS5Bc3NlcnRpb24ucHJvdG90eXBlLmFzc2VydCBhcmd1bWVudHNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmosIGFyZ3MpIHtcbiAgcmV0dXJuIGFyZ3MubGVuZ3RoID4gNCA/IGFyZ3NbNF0gOiBvYmouX29iajtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBnZXRFbnVtZXJhYmxlUHJvcGVydGllcyB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgLmdldEVudW1lcmFibGVQcm9wZXJ0aWVzKG9iamVjdClcbiAqXG4gKiBUaGlzIGFsbG93cyB0aGUgcmV0cmlldmFsIG9mIGVudW1lcmFibGUgcHJvcGVydHkgbmFtZXMgb2YgYW4gb2JqZWN0LFxuICogaW5oZXJpdGVkIG9yIG5vdC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKiBAbmFtZSBnZXRFbnVtZXJhYmxlUHJvcGVydGllc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGdldEVudW1lcmFibGVQcm9wZXJ0aWVzKG9iamVjdCkge1xuICB2YXIgcmVzdWx0ID0gW107XG4gIGZvciAodmFyIG5hbWUgaW4gb2JqZWN0KSB7XG4gICAgcmVzdWx0LnB1c2gobmFtZSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBtZXNzYWdlIGNvbXBvc2l0aW9uIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRhbmNpZXNcbiAqL1xuXG52YXIgZmxhZyA9IHJlcXVpcmUoJy4vZmxhZycpXG4gICwgZ2V0QWN0dWFsID0gcmVxdWlyZSgnLi9nZXRBY3R1YWwnKVxuICAsIGluc3BlY3QgPSByZXF1aXJlKCcuL2luc3BlY3QnKVxuICAsIG9iakRpc3BsYXkgPSByZXF1aXJlKCcuL29iakRpc3BsYXknKTtcblxuLyoqXG4gKiAjIyMgLmdldE1lc3NhZ2Uob2JqZWN0LCBtZXNzYWdlLCBuZWdhdGVNZXNzYWdlKVxuICpcbiAqIENvbnN0cnVjdCB0aGUgZXJyb3IgbWVzc2FnZSBiYXNlZCBvbiBmbGFnc1xuICogYW5kIHRlbXBsYXRlIHRhZ3MuIFRlbXBsYXRlIHRhZ3Mgd2lsbCByZXR1cm5cbiAqIGEgc3RyaW5naWZpZWQgaW5zcGVjdGlvbiBvZiB0aGUgb2JqZWN0IHJlZmVyZW5jZWQuXG4gKlxuICogTWVzc2FnZSB0ZW1wbGF0ZSB0YWdzOlxuICogLSBgI3t0aGlzfWAgY3VycmVudCBhc3NlcnRlZCBvYmplY3RcbiAqIC0gYCN7YWN0fWAgYWN0dWFsIHZhbHVlXG4gKiAtIGAje2V4cH1gIGV4cGVjdGVkIHZhbHVlXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCAoY29uc3RydWN0ZWQgQXNzZXJ0aW9uKVxuICogQHBhcmFtIHtBcmd1bWVudHN9IGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZS5hc3NlcnQgYXJndW1lbnRzXG4gKiBAbmFtZSBnZXRNZXNzYWdlXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaiwgYXJncykge1xuICB2YXIgbmVnYXRlID0gZmxhZyhvYmosICduZWdhdGUnKVxuICAgICwgdmFsID0gZmxhZyhvYmosICdvYmplY3QnKVxuICAgICwgZXhwZWN0ZWQgPSBhcmdzWzNdXG4gICAgLCBhY3R1YWwgPSBnZXRBY3R1YWwob2JqLCBhcmdzKVxuICAgICwgbXNnID0gbmVnYXRlID8gYXJnc1syXSA6IGFyZ3NbMV1cbiAgICAsIGZsYWdNc2cgPSBmbGFnKG9iaiwgJ21lc3NhZ2UnKTtcblxuICBtc2cgPSBtc2cgfHwgJyc7XG4gIG1zZyA9IG1zZ1xuICAgIC5yZXBsYWNlKC8je3RoaXN9L2csIG9iakRpc3BsYXkodmFsKSlcbiAgICAucmVwbGFjZSgvI3thY3R9L2csIG9iakRpc3BsYXkoYWN0dWFsKSlcbiAgICAucmVwbGFjZSgvI3tleHB9L2csIG9iakRpc3BsYXkoZXhwZWN0ZWQpKTtcblxuICByZXR1cm4gZmxhZ01zZyA/IGZsYWdNc2cgKyAnOiAnICsgbXNnIDogbXNnO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIGdldE5hbWUgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyBnZXROYW1lKGZ1bmMpXG4gKlxuICogR2V0cyB0aGUgbmFtZSBvZiBhIGZ1bmN0aW9uLCBpbiBhIGNyb3NzLWJyb3dzZXIgd2F5LlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGEgZnVuY3Rpb24gKHVzdWFsbHkgYSBjb25zdHJ1Y3RvcilcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmdW5jKSB7XG4gIGlmIChmdW5jLm5hbWUpIHJldHVybiBmdW5jLm5hbWU7XG5cbiAgdmFyIG1hdGNoID0gL15cXHM/ZnVuY3Rpb24gKFteKF0qKVxcKC8uZXhlYyhmdW5jKTtcbiAgcmV0dXJuIG1hdGNoICYmIG1hdGNoWzFdID8gbWF0Y2hbMV0gOiBcIlwiO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIGdldFBhdGhWYWx1ZSB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogQHNlZSBodHRwczovL2dpdGh1Yi5jb20vbG9naWNhbHBhcmFkb3gvZmlsdHJcbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIC5nZXRQYXRoVmFsdWUocGF0aCwgb2JqZWN0KVxuICpcbiAqIFRoaXMgYWxsb3dzIHRoZSByZXRyaWV2YWwgb2YgdmFsdWVzIGluIGFuXG4gKiBvYmplY3QgZ2l2ZW4gYSBzdHJpbmcgcGF0aC5cbiAqXG4gKiAgICAgdmFyIG9iaiA9IHtcbiAqICAgICAgICAgcHJvcDE6IHtcbiAqICAgICAgICAgICAgIGFycjogWydhJywgJ2InLCAnYyddXG4gKiAgICAgICAgICAgLCBzdHI6ICdIZWxsbydcbiAqICAgICAgICAgfVxuICogICAgICAgLCBwcm9wMjoge1xuICogICAgICAgICAgICAgYXJyOiBbIHsgbmVzdGVkOiAnVW5pdmVyc2UnIH0gXVxuICogICAgICAgICAgICwgc3RyOiAnSGVsbG8gYWdhaW4hJ1xuICogICAgICAgICB9XG4gKiAgICAgfVxuICpcbiAqIFRoZSBmb2xsb3dpbmcgd291bGQgYmUgdGhlIHJlc3VsdHMuXG4gKlxuICogICAgIGdldFBhdGhWYWx1ZSgncHJvcDEuc3RyJywgb2JqKTsgLy8gSGVsbG9cbiAqICAgICBnZXRQYXRoVmFsdWUoJ3Byb3AxLmF0dFsyXScsIG9iaik7IC8vIGJcbiAqICAgICBnZXRQYXRoVmFsdWUoJ3Byb3AyLmFyclswXS5uZXN0ZWQnLCBvYmopOyAvLyBVbml2ZXJzZVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gKiBAcmV0dXJucyB7T2JqZWN0fSB2YWx1ZSBvciBgdW5kZWZpbmVkYFxuICogQG5hbWUgZ2V0UGF0aFZhbHVlXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbnZhciBnZXRQYXRoVmFsdWUgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChwYXRoLCBvYmopIHtcbiAgdmFyIHBhcnNlZCA9IHBhcnNlUGF0aChwYXRoKTtcbiAgcmV0dXJuIF9nZXRQYXRoVmFsdWUocGFyc2VkLCBvYmopO1xufTtcblxuLyohXG4gKiAjIyBwYXJzZVBhdGgocGF0aClcbiAqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdXNlZCB0byBwYXJzZSBzdHJpbmcgb2JqZWN0XG4gKiBwYXRocy4gVXNlIGluIGNvbmp1bmN0aW9uIHdpdGggYF9nZXRQYXRoVmFsdWVgLlxuICpcbiAqICAgICAgdmFyIHBhcnNlZCA9IHBhcnNlUGF0aCgnbXlvYmplY3QucHJvcGVydHkuc3VicHJvcCcpO1xuICpcbiAqICMjIyBQYXRoczpcbiAqXG4gKiAqIENhbiBiZSBhcyBuZWFyIGluZmluaXRlbHkgZGVlcCBhbmQgbmVzdGVkXG4gKiAqIEFycmF5cyBhcmUgYWxzbyB2YWxpZCB1c2luZyB0aGUgZm9ybWFsIGBteW9iamVjdC5kb2N1bWVudFszXS5wcm9wZXJ0eWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEByZXR1cm5zIHtPYmplY3R9IHBhcnNlZFxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2VQYXRoIChwYXRoKSB7XG4gIHZhciBzdHIgPSBwYXRoLnJlcGxhY2UoL1xcWy9nLCAnLlsnKVxuICAgICwgcGFydHMgPSBzdHIubWF0Y2goLyhcXFxcXFwufFteLl0rPykrL2cpO1xuICByZXR1cm4gcGFydHMubWFwKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHZhciByZSA9IC9cXFsoXFxkKylcXF0kL1xuICAgICAgLCBtQXJyID0gcmUuZXhlYyh2YWx1ZSlcbiAgICBpZiAobUFycikgcmV0dXJuIHsgaTogcGFyc2VGbG9hdChtQXJyWzFdKSB9O1xuICAgIGVsc2UgcmV0dXJuIHsgcDogdmFsdWUgfTtcbiAgfSk7XG59O1xuXG4vKiFcbiAqICMjIF9nZXRQYXRoVmFsdWUocGFyc2VkLCBvYmopXG4gKlxuICogSGVscGVyIGNvbXBhbmlvbiBmdW5jdGlvbiBmb3IgYC5wYXJzZVBhdGhgIHRoYXQgcmV0dXJuc1xuICogdGhlIHZhbHVlIGxvY2F0ZWQgYXQgdGhlIHBhcnNlZCBhZGRyZXNzLlxuICpcbiAqICAgICAgdmFyIHZhbHVlID0gZ2V0UGF0aFZhbHVlKHBhcnNlZCwgb2JqKTtcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gcGFyc2VkIGRlZmluaXRpb24gZnJvbSBgcGFyc2VQYXRoYC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgdG8gc2VhcmNoIGFnYWluc3RcbiAqIEByZXR1cm5zIHtPYmplY3R8VW5kZWZpbmVkfSB2YWx1ZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gX2dldFBhdGhWYWx1ZSAocGFyc2VkLCBvYmopIHtcbiAgdmFyIHRtcCA9IG9ialxuICAgICwgcmVzO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHBhcnNlZC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICB2YXIgcGFydCA9IHBhcnNlZFtpXTtcbiAgICBpZiAodG1wKSB7XG4gICAgICBpZiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBwYXJ0LnApXG4gICAgICAgIHRtcCA9IHRtcFtwYXJ0LnBdO1xuICAgICAgZWxzZSBpZiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBwYXJ0LmkpXG4gICAgICAgIHRtcCA9IHRtcFtwYXJ0LmldO1xuICAgICAgaWYgKGkgPT0gKGwgLSAxKSkgcmVzID0gdG1wO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXMgPSB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gZ2V0UHJvcGVydGllcyB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgLmdldFByb3BlcnRpZXMob2JqZWN0KVxuICpcbiAqIFRoaXMgYWxsb3dzIHRoZSByZXRyaWV2YWwgb2YgcHJvcGVydHkgbmFtZXMgb2YgYW4gb2JqZWN0LCBlbnVtZXJhYmxlIG9yIG5vdCxcbiAqIGluaGVyaXRlZCBvciBub3QuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICogQHJldHVybnMge0FycmF5fVxuICogQG5hbWUgZ2V0UHJvcGVydGllc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGdldFByb3BlcnRpZXMob2JqZWN0KSB7XG4gIHZhciByZXN1bHQgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhzdWJqZWN0KTtcblxuICBmdW5jdGlvbiBhZGRQcm9wZXJ0eShwcm9wZXJ0eSkge1xuICAgIGlmIChyZXN1bHQuaW5kZXhPZihwcm9wZXJ0eSkgPT09IC0xKSB7XG4gICAgICByZXN1bHQucHVzaChwcm9wZXJ0eSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHN1YmplY3QpO1xuICB3aGlsZSAocHJvdG8gIT09IG51bGwpIHtcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm90bykuZm9yRWFjaChhZGRQcm9wZXJ0eSk7XG4gICAgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YocHJvdG8pO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG4iLCIvKiFcbiAqIGNoYWlcbiAqIENvcHlyaWdodChjKSAyMDExIEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyohXG4gKiBNYWluIGV4cG9ydHNcbiAqL1xuXG52YXIgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8qIVxuICogdGVzdCB1dGlsaXR5XG4gKi9cblxuZXhwb3J0cy50ZXN0ID0gcmVxdWlyZSgnLi90ZXN0Jyk7XG5cbi8qIVxuICogdHlwZSB1dGlsaXR5XG4gKi9cblxuZXhwb3J0cy50eXBlID0gcmVxdWlyZSgnLi90eXBlJyk7XG5cbi8qIVxuICogbWVzc2FnZSB1dGlsaXR5XG4gKi9cblxuZXhwb3J0cy5nZXRNZXNzYWdlID0gcmVxdWlyZSgnLi9nZXRNZXNzYWdlJyk7XG5cbi8qIVxuICogYWN0dWFsIHV0aWxpdHlcbiAqL1xuXG5leHBvcnRzLmdldEFjdHVhbCA9IHJlcXVpcmUoJy4vZ2V0QWN0dWFsJyk7XG5cbi8qIVxuICogSW5zcGVjdCB1dGlsXG4gKi9cblxuZXhwb3J0cy5pbnNwZWN0ID0gcmVxdWlyZSgnLi9pbnNwZWN0Jyk7XG5cbi8qIVxuICogT2JqZWN0IERpc3BsYXkgdXRpbFxuICovXG5cbmV4cG9ydHMub2JqRGlzcGxheSA9IHJlcXVpcmUoJy4vb2JqRGlzcGxheScpO1xuXG4vKiFcbiAqIEZsYWcgdXRpbGl0eVxuICovXG5cbmV4cG9ydHMuZmxhZyA9IHJlcXVpcmUoJy4vZmxhZycpO1xuXG4vKiFcbiAqIEZsYWcgdHJhbnNmZXJyaW5nIHV0aWxpdHlcbiAqL1xuXG5leHBvcnRzLnRyYW5zZmVyRmxhZ3MgPSByZXF1aXJlKCcuL3RyYW5zZmVyRmxhZ3MnKTtcblxuLyohXG4gKiBEZWVwIGVxdWFsIHV0aWxpdHlcbiAqL1xuXG5leHBvcnRzLmVxbCA9IHJlcXVpcmUoJ2RlZXAtZXFsJyk7XG5cbi8qIVxuICogRGVlcCBwYXRoIHZhbHVlXG4gKi9cblxuZXhwb3J0cy5nZXRQYXRoVmFsdWUgPSByZXF1aXJlKCcuL2dldFBhdGhWYWx1ZScpO1xuXG4vKiFcbiAqIEZ1bmN0aW9uIG5hbWVcbiAqL1xuXG5leHBvcnRzLmdldE5hbWUgPSByZXF1aXJlKCcuL2dldE5hbWUnKTtcblxuLyohXG4gKiBhZGQgUHJvcGVydHlcbiAqL1xuXG5leHBvcnRzLmFkZFByb3BlcnR5ID0gcmVxdWlyZSgnLi9hZGRQcm9wZXJ0eScpO1xuXG4vKiFcbiAqIGFkZCBNZXRob2RcbiAqL1xuXG5leHBvcnRzLmFkZE1ldGhvZCA9IHJlcXVpcmUoJy4vYWRkTWV0aG9kJyk7XG5cbi8qIVxuICogb3ZlcndyaXRlIFByb3BlcnR5XG4gKi9cblxuZXhwb3J0cy5vdmVyd3JpdGVQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vb3ZlcndyaXRlUHJvcGVydHknKTtcblxuLyohXG4gKiBvdmVyd3JpdGUgTWV0aG9kXG4gKi9cblxuZXhwb3J0cy5vdmVyd3JpdGVNZXRob2QgPSByZXF1aXJlKCcuL292ZXJ3cml0ZU1ldGhvZCcpO1xuXG4vKiFcbiAqIEFkZCBhIGNoYWluYWJsZSBtZXRob2RcbiAqL1xuXG5leHBvcnRzLmFkZENoYWluYWJsZU1ldGhvZCA9IHJlcXVpcmUoJy4vYWRkQ2hhaW5hYmxlTWV0aG9kJyk7XG5cbi8qIVxuICogT3ZlcndyaXRlIGNoYWluYWJsZSBtZXRob2RcbiAqL1xuXG5leHBvcnRzLm92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZCA9IHJlcXVpcmUoJy4vb3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kJyk7XG5cbiIsIi8vIFRoaXMgaXMgKGFsbW9zdCkgZGlyZWN0bHkgZnJvbSBOb2RlLmpzIHV0aWxzXG4vLyBodHRwczovL2dpdGh1Yi5jb20vam95ZW50L25vZGUvYmxvYi9mOGMzMzVkMGNhZjQ3ZjE2ZDMxNDEzZjg5YWEyOGVkYTM4NzhlM2FhL2xpYi91dGlsLmpzXG5cbnZhciBnZXROYW1lID0gcmVxdWlyZSgnLi9nZXROYW1lJyk7XG52YXIgZ2V0UHJvcGVydGllcyA9IHJlcXVpcmUoJy4vZ2V0UHJvcGVydGllcycpO1xudmFyIGdldEVudW1lcmFibGVQcm9wZXJ0aWVzID0gcmVxdWlyZSgnLi9nZXRFbnVtZXJhYmxlUHJvcGVydGllcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluc3BlY3Q7XG5cbi8qKlxuICogRWNob3MgdGhlIHZhbHVlIG9mIGEgdmFsdWUuIFRyeXMgdG8gcHJpbnQgdGhlIHZhbHVlIG91dFxuICogaW4gdGhlIGJlc3Qgd2F5IHBvc3NpYmxlIGdpdmVuIHRoZSBkaWZmZXJlbnQgdHlwZXMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iaiBUaGUgb2JqZWN0IHRvIHByaW50IG91dC5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gc2hvd0hpZGRlbiBGbGFnIHRoYXQgc2hvd3MgaGlkZGVuIChub3QgZW51bWVyYWJsZSlcbiAqICAgIHByb3BlcnRpZXMgb2Ygb2JqZWN0cy5cbiAqIEBwYXJhbSB7TnVtYmVyfSBkZXB0aCBEZXB0aCBpbiB3aGljaCB0byBkZXNjZW5kIGluIG9iamVjdC4gRGVmYXVsdCBpcyAyLlxuICogQHBhcmFtIHtCb29sZWFufSBjb2xvcnMgRmxhZyB0byB0dXJuIG9uIEFOU0kgZXNjYXBlIGNvZGVzIHRvIGNvbG9yIHRoZVxuICogICAgb3V0cHV0LiBEZWZhdWx0IGlzIGZhbHNlIChubyBjb2xvcmluZykuXG4gKi9cbmZ1bmN0aW9uIGluc3BlY3Qob2JqLCBzaG93SGlkZGVuLCBkZXB0aCwgY29sb3JzKSB7XG4gIHZhciBjdHggPSB7XG4gICAgc2hvd0hpZGRlbjogc2hvd0hpZGRlbixcbiAgICBzZWVuOiBbXSxcbiAgICBzdHlsaXplOiBmdW5jdGlvbiAoc3RyKSB7IHJldHVybiBzdHI7IH1cbiAgfTtcbiAgcmV0dXJuIGZvcm1hdFZhbHVlKGN0eCwgb2JqLCAodHlwZW9mIGRlcHRoID09PSAndW5kZWZpbmVkJyA/IDIgOiBkZXB0aCkpO1xufVxuXG4vLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS8xMDQ0MTI4L1xudmFyIGdldE91dGVySFRNTCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgaWYgKCdvdXRlckhUTUwnIGluIGVsZW1lbnQpIHJldHVybiBlbGVtZW50Lm91dGVySFRNTDtcbiAgdmFyIG5zID0gXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hodG1sXCI7XG4gIHZhciBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMobnMsICdfJyk7XG4gIHZhciBlbGVtUHJvdG8gPSAod2luZG93LkhUTUxFbGVtZW50IHx8IHdpbmRvdy5FbGVtZW50KS5wcm90b3R5cGU7XG4gIHZhciB4bWxTZXJpYWxpemVyID0gbmV3IFhNTFNlcmlhbGl6ZXIoKTtcbiAgdmFyIGh0bWw7XG4gIGlmIChkb2N1bWVudC54bWxWZXJzaW9uKSB7XG4gICAgcmV0dXJuIHhtbFNlcmlhbGl6ZXIuc2VyaWFsaXplVG9TdHJpbmcoZWxlbWVudCk7XG4gIH0gZWxzZSB7XG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGVsZW1lbnQuY2xvbmVOb2RlKGZhbHNlKSk7XG4gICAgaHRtbCA9IGNvbnRhaW5lci5pbm5lckhUTUwucmVwbGFjZSgnPjwnLCAnPicgKyBlbGVtZW50LmlubmVySFRNTCArICc8Jyk7XG4gICAgY29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xuICAgIHJldHVybiBodG1sO1xuICB9XG59O1xuXG4vLyBSZXR1cm5zIHRydWUgaWYgb2JqZWN0IGlzIGEgRE9NIGVsZW1lbnQuXG52YXIgaXNET01FbGVtZW50ID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICBpZiAodHlwZW9mIEhUTUxFbGVtZW50ID09PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBvYmplY3QgaW5zdGFuY2VvZiBIVE1MRWxlbWVudDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gb2JqZWN0ICYmXG4gICAgICB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJlxuICAgICAgb2JqZWN0Lm5vZGVUeXBlID09PSAxICYmXG4gICAgICB0eXBlb2Ygb2JqZWN0Lm5vZGVOYW1lID09PSAnc3RyaW5nJztcbiAgfVxufTtcblxuZnVuY3Rpb24gZm9ybWF0VmFsdWUoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzKSB7XG4gIC8vIFByb3ZpZGUgYSBob29rIGZvciB1c2VyLXNwZWNpZmllZCBpbnNwZWN0IGZ1bmN0aW9ucy5cbiAgLy8gQ2hlY2sgdGhhdCB2YWx1ZSBpcyBhbiBvYmplY3Qgd2l0aCBhbiBpbnNwZWN0IGZ1bmN0aW9uIG9uIGl0XG4gIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUuaW5zcGVjdCA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgLy8gRmlsdGVyIG91dCB0aGUgdXRpbCBtb2R1bGUsIGl0J3MgaW5zcGVjdCBmdW5jdGlvbiBpcyBzcGVjaWFsXG4gICAgICB2YWx1ZS5pbnNwZWN0ICE9PSBleHBvcnRzLmluc3BlY3QgJiZcbiAgICAgIC8vIEFsc28gZmlsdGVyIG91dCBhbnkgcHJvdG90eXBlIG9iamVjdHMgdXNpbmcgdGhlIGNpcmN1bGFyIGNoZWNrLlxuICAgICAgISh2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgPT09IHZhbHVlKSkge1xuICAgIHZhciByZXQgPSB2YWx1ZS5pbnNwZWN0KHJlY3Vyc2VUaW1lcyk7XG4gICAgaWYgKHR5cGVvZiByZXQgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXQgPSBmb3JtYXRWYWx1ZShjdHgsIHJldCwgcmVjdXJzZVRpbWVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8vIFByaW1pdGl2ZSB0eXBlcyBjYW5ub3QgaGF2ZSBwcm9wZXJ0aWVzXG4gIHZhciBwcmltaXRpdmUgPSBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSk7XG4gIGlmIChwcmltaXRpdmUpIHtcbiAgICByZXR1cm4gcHJpbWl0aXZlO1xuICB9XG5cbiAgLy8gSWYgaXQncyBET00gZWxlbSwgZ2V0IG91dGVyIEhUTUwuXG4gIGlmIChpc0RPTUVsZW1lbnQodmFsdWUpKSB7XG4gICAgcmV0dXJuIGdldE91dGVySFRNTCh2YWx1ZSk7XG4gIH1cblxuICAvLyBMb29rIHVwIHRoZSBrZXlzIG9mIHRoZSBvYmplY3QuXG4gIHZhciB2aXNpYmxlS2V5cyA9IGdldEVudW1lcmFibGVQcm9wZXJ0aWVzKHZhbHVlKTtcbiAgdmFyIGtleXMgPSBjdHguc2hvd0hpZGRlbiA/IGdldFByb3BlcnRpZXModmFsdWUpIDogdmlzaWJsZUtleXM7XG5cbiAgLy8gU29tZSB0eXBlIG9mIG9iamVjdCB3aXRob3V0IHByb3BlcnRpZXMgY2FuIGJlIHNob3J0Y3V0dGVkLlxuICAvLyBJbiBJRSwgZXJyb3JzIGhhdmUgYSBzaW5nbGUgYHN0YWNrYCBwcm9wZXJ0eSwgb3IgaWYgdGhleSBhcmUgdmFuaWxsYSBgRXJyb3JgLFxuICAvLyBhIGBzdGFja2AgcGx1cyBgZGVzY3JpcHRpb25gIHByb3BlcnR5OyBpZ25vcmUgdGhvc2UgZm9yIGNvbnNpc3RlbmN5LlxuICBpZiAoa2V5cy5sZW5ndGggPT09IDAgfHwgKGlzRXJyb3IodmFsdWUpICYmIChcbiAgICAgIChrZXlzLmxlbmd0aCA9PT0gMSAmJiBrZXlzWzBdID09PSAnc3RhY2snKSB8fFxuICAgICAgKGtleXMubGVuZ3RoID09PSAyICYmIGtleXNbMF0gPT09ICdkZXNjcmlwdGlvbicgJiYga2V5c1sxXSA9PT0gJ3N0YWNrJylcbiAgICAgKSkpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB2YXIgbmFtZSA9IGdldE5hbWUodmFsdWUpO1xuICAgICAgdmFyIG5hbWVTdWZmaXggPSBuYW1lID8gJzogJyArIG5hbWUgOiAnJztcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW0Z1bmN0aW9uJyArIG5hbWVTdWZmaXggKyAnXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfVxuICAgIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoRGF0ZS5wcm90b3R5cGUudG9VVENTdHJpbmcuY2FsbCh2YWx1ZSksICdkYXRlJyk7XG4gICAgfVxuICAgIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICB2YXIgYmFzZSA9ICcnLCBhcnJheSA9IGZhbHNlLCBicmFjZXMgPSBbJ3snLCAnfSddO1xuXG4gIC8vIE1ha2UgQXJyYXkgc2F5IHRoYXQgdGhleSBhcmUgQXJyYXlcbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgYXJyYXkgPSB0cnVlO1xuICAgIGJyYWNlcyA9IFsnWycsICddJ107XG4gIH1cblxuICAvLyBNYWtlIGZ1bmN0aW9ucyBzYXkgdGhhdCB0aGV5IGFyZSBmdW5jdGlvbnNcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBuYW1lID0gZ2V0TmFtZSh2YWx1ZSk7XG4gICAgdmFyIG5hbWVTdWZmaXggPSBuYW1lID8gJzogJyArIG5hbWUgOiAnJztcbiAgICBiYXNlID0gJyBbRnVuY3Rpb24nICsgbmFtZVN1ZmZpeCArICddJztcbiAgfVxuXG4gIC8vIE1ha2UgUmVnRXhwcyBzYXkgdGhhdCB0aGV5IGFyZSBSZWdFeHBzXG4gIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZGF0ZXMgd2l0aCBwcm9wZXJ0aWVzIGZpcnN0IHNheSB0aGUgZGF0ZVxuICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBEYXRlLnByb3RvdHlwZS50b1VUQ1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZXJyb3Igd2l0aCBtZXNzYWdlIGZpcnN0IHNheSB0aGUgZXJyb3JcbiAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCAmJiAoIWFycmF5IHx8IHZhbHVlLmxlbmd0aCA9PSAwKSkge1xuICAgIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgYnJhY2VzWzFdO1xuICB9XG5cbiAgaWYgKHJlY3Vyc2VUaW1lcyA8IDApIHtcbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tPYmplY3RdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cblxuICBjdHguc2Vlbi5wdXNoKHZhbHVlKTtcblxuICB2YXIgb3V0cHV0O1xuICBpZiAoYXJyYXkpIHtcbiAgICBvdXRwdXQgPSBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKTtcbiAgfSBlbHNlIHtcbiAgICBvdXRwdXQgPSBrZXlzLm1hcChmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KTtcbiAgICB9KTtcbiAgfVxuXG4gIGN0eC5zZWVuLnBvcCgpO1xuXG4gIHJldHVybiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpIHtcbiAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICBjYXNlICd1bmRlZmluZWQnOlxuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCd1bmRlZmluZWQnLCAndW5kZWZpbmVkJyk7XG5cbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgdmFyIHNpbXBsZSA9ICdcXCcnICsgSlNPTi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoL15cInxcIiQvZywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKSArICdcXCcnO1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKHNpbXBsZSwgJ3N0cmluZycpO1xuXG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnbnVtYmVyJyk7XG5cbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnYm9vbGVhbicpO1xuICB9XG4gIC8vIEZvciBzb21lIHJlYXNvbiB0eXBlb2YgbnVsbCBpcyBcIm9iamVjdFwiLCBzbyBzcGVjaWFsIGNhc2UgaGVyZS5cbiAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCdudWxsJywgJ251bGwnKTtcbiAgfVxufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEVycm9yKHZhbHVlKSB7XG4gIHJldHVybiAnWycgKyBFcnJvci5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgKyAnXSc7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cykge1xuICB2YXIgb3V0cHV0ID0gW107XG4gIGZvciAodmFyIGkgPSAwLCBsID0gdmFsdWUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgU3RyaW5nKGkpKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBTdHJpbmcoaSksIHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0LnB1c2goJycpO1xuICAgIH1cbiAgfVxuICBrZXlzLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgaWYgKCFrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIGtleSwgdHJ1ZSkpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSkge1xuICB2YXIgbmFtZSwgc3RyO1xuICBpZiAodmFsdWUuX19sb29rdXBHZXR0ZXJfXykge1xuICAgIGlmICh2YWx1ZS5fX2xvb2t1cEdldHRlcl9fKGtleSkpIHtcbiAgICAgIGlmICh2YWx1ZS5fX2xvb2t1cFNldHRlcl9fKGtleSkpIHtcbiAgICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodmFsdWUuX19sb29rdXBTZXR0ZXJfXyhrZXkpKSB7XG4gICAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmICh2aXNpYmxlS2V5cy5pbmRleE9mKGtleSkgPCAwKSB7XG4gICAgbmFtZSA9ICdbJyArIGtleSArICddJztcbiAgfVxuICBpZiAoIXN0cikge1xuICAgIGlmIChjdHguc2Vlbi5pbmRleE9mKHZhbHVlW2tleV0pIDwgMCkge1xuICAgICAgaWYgKHJlY3Vyc2VUaW1lcyA9PT0gbnVsbCkge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIHZhbHVlW2tleV0sIG51bGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCB2YWx1ZVtrZXldLCByZWN1cnNlVGltZXMgLSAxKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdHIuaW5kZXhPZignXFxuJykgPiAtMSkge1xuICAgICAgICBpZiAoYXJyYXkpIHtcbiAgICAgICAgICBzdHIgPSBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJykuc3Vic3RyKDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0ciA9ICdcXG4nICsgc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0NpcmN1bGFyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmICh0eXBlb2YgbmFtZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoYXJyYXkgJiYga2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgbmFtZSA9IEpTT04uc3RyaW5naWZ5KCcnICsga2V5KTtcbiAgICBpZiAobmFtZS5tYXRjaCgvXlwiKFthLXpBLVpfXVthLXpBLVpfMC05XSopXCIkLykpIHtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cigxLCBuYW1lLmxlbmd0aCAtIDIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICduYW1lJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oXlwifFwiJCkvZywgXCInXCIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICdzdHJpbmcnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmFtZSArICc6ICcgKyBzdHI7XG59XG5cblxuZnVuY3Rpb24gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpIHtcbiAgdmFyIG51bUxpbmVzRXN0ID0gMDtcbiAgdmFyIGxlbmd0aCA9IG91dHB1dC5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VyKSB7XG4gICAgbnVtTGluZXNFc3QrKztcbiAgICBpZiAoY3VyLmluZGV4T2YoJ1xcbicpID49IDApIG51bUxpbmVzRXN0Kys7XG4gICAgcmV0dXJuIHByZXYgKyBjdXIubGVuZ3RoICsgMTtcbiAgfSwgMCk7XG5cbiAgaWYgKGxlbmd0aCA+IDYwKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArXG4gICAgICAgICAgIChiYXNlID09PSAnJyA/ICcnIDogYmFzZSArICdcXG4gJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBvdXRwdXQuam9pbignLFxcbiAgJykgK1xuICAgICAgICAgICAnICcgK1xuICAgICAgICAgICBicmFjZXNbMV07XG4gIH1cblxuICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArICcgJyArIG91dHB1dC5qb2luKCcsICcpICsgJyAnICsgYnJhY2VzWzFdO1xufVxuXG5mdW5jdGlvbiBpc0FycmF5KGFyKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KGFyKSB8fFxuICAgICAgICAgKHR5cGVvZiBhciA9PT0gJ29iamVjdCcgJiYgb2JqZWN0VG9TdHJpbmcoYXIpID09PSAnW29iamVjdCBBcnJheV0nKTtcbn1cblxuZnVuY3Rpb24gaXNSZWdFeHAocmUpIHtcbiAgcmV0dXJuIHR5cGVvZiByZSA9PT0gJ29iamVjdCcgJiYgb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cblxuZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgcmV0dXJuIHR5cGVvZiBkID09PSAnb2JqZWN0JyAmJiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuXG5mdW5jdGlvbiBpc0Vycm9yKGUpIHtcbiAgcmV0dXJuIHR5cGVvZiBlID09PSAnb2JqZWN0JyAmJiBvYmplY3RUb1N0cmluZyhlKSA9PT0gJ1tvYmplY3QgRXJyb3JdJztcbn1cblxuZnVuY3Rpb24gb2JqZWN0VG9TdHJpbmcobykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pO1xufVxuIiwiLyohXG4gKiBDaGFpIC0gZmxhZyB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kYW5jaWVzXG4gKi9cblxudmFyIGluc3BlY3QgPSByZXF1aXJlKCcuL2luc3BlY3QnKTtcbnZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKTtcblxuLyoqXG4gKiAjIyMgLm9iakRpc3BsYXkgKG9iamVjdClcbiAqXG4gKiBEZXRlcm1pbmVzIGlmIGFuIG9iamVjdCBvciBhbiBhcnJheSBtYXRjaGVzXG4gKiBjcml0ZXJpYSB0byBiZSBpbnNwZWN0ZWQgaW4tbGluZSBmb3IgZXJyb3JcbiAqIG1lc3NhZ2VzIG9yIHNob3VsZCBiZSB0cnVuY2F0ZWQuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gamF2YXNjcmlwdCBvYmplY3QgdG8gaW5zcGVjdFxuICogQG5hbWUgb2JqRGlzcGxheVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIHN0ciA9IGluc3BlY3Qob2JqKVxuICAgICwgdHlwZSA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopO1xuXG4gIGlmIChjb25maWcudHJ1bmNhdGVUaHJlc2hvbGQgJiYgc3RyLmxlbmd0aCA+PSBjb25maWcudHJ1bmNhdGVUaHJlc2hvbGQpIHtcbiAgICBpZiAodHlwZSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJykge1xuICAgICAgcmV0dXJuICFvYmoubmFtZSB8fCBvYmoubmFtZSA9PT0gJydcbiAgICAgICAgPyAnW0Z1bmN0aW9uXSdcbiAgICAgICAgOiAnW0Z1bmN0aW9uOiAnICsgb2JqLm5hbWUgKyAnXSc7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICByZXR1cm4gJ1sgQXJyYXkoJyArIG9iai5sZW5ndGggKyAnKSBdJztcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdbb2JqZWN0IE9iamVjdF0nKSB7XG4gICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKG9iailcbiAgICAgICAgLCBrc3RyID0ga2V5cy5sZW5ndGggPiAyXG4gICAgICAgICAgPyBrZXlzLnNwbGljZSgwLCAyKS5qb2luKCcsICcpICsgJywgLi4uJ1xuICAgICAgICAgIDoga2V5cy5qb2luKCcsICcpO1xuICAgICAgcmV0dXJuICd7IE9iamVjdCAoJyArIGtzdHIgKyAnKSB9JztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxufTtcbiIsIi8qIVxuICogQ2hhaSAtIG92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZCB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgb3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kIChjdHgsIG5hbWUsIGZuKVxuICpcbiAqIE92ZXJ3aXRlcyBhbiBhbHJlYWR5IGV4aXN0aW5nIGNoYWluYWJsZSBtZXRob2RcbiAqIGFuZCBwcm92aWRlcyBhY2Nlc3MgdG8gdGhlIHByZXZpb3VzIGZ1bmN0aW9uIG9yXG4gKiBwcm9wZXJ0eS4gIE11c3QgcmV0dXJuIGZ1bmN0aW9ucyB0byBiZSB1c2VkIGZvclxuICogbmFtZS5cbiAqXG4gKiAgICAgdXRpbHMub3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kKGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZSwgJ2xlbmd0aCcsXG4gKiAgICAgICBmdW5jdGlvbiAoX3N1cGVyKSB7XG4gKiAgICAgICB9XG4gKiAgICAgLCBmdW5jdGlvbiAoX3N1cGVyKSB7XG4gKiAgICAgICB9XG4gKiAgICAgKTtcbiAqXG4gKiBDYW4gYWxzbyBiZSBhY2Nlc3NlZCBkaXJlY3RseSBmcm9tIGBjaGFpLkFzc2VydGlvbmAuXG4gKlxuICogICAgIGNoYWkuQXNzZXJ0aW9uLm92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZCgnZm9vJywgZm4sIGZuKTtcbiAqXG4gKiBUaGVuIGNhbiBiZSB1c2VkIGFzIGFueSBvdGhlciBhc3NlcnRpb24uXG4gKlxuICogICAgIGV4cGVjdChteUZvbykudG8uaGF2ZS5sZW5ndGgoMyk7XG4gKiAgICAgZXhwZWN0KG15Rm9vKS50by5oYXZlLmxlbmd0aC5hYm92ZSgzKTtcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gY3R4IG9iamVjdCB3aG9zZSBtZXRob2QgLyBwcm9wZXJ0eSBpcyB0byBiZSBvdmVyd3JpdHRlblxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgb2YgbWV0aG9kIC8gcHJvcGVydHkgdG8gb3ZlcndyaXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBtZXRob2QgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgZnVuY3Rpb24gdG8gYmUgdXNlZCBmb3IgbmFtZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2hhaW5pbmdCZWhhdmlvciBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBmdW5jdGlvbiB0byBiZSB1c2VkIGZvciBwcm9wZXJ0eVxuICogQG5hbWUgb3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGN0eCwgbmFtZSwgbWV0aG9kLCBjaGFpbmluZ0JlaGF2aW9yKSB7XG4gIHZhciBjaGFpbmFibGVCZWhhdmlvciA9IGN0eC5fX21ldGhvZHNbbmFtZV07XG5cbiAgdmFyIF9jaGFpbmluZ0JlaGF2aW9yID0gY2hhaW5hYmxlQmVoYXZpb3IuY2hhaW5pbmdCZWhhdmlvcjtcbiAgY2hhaW5hYmxlQmVoYXZpb3IuY2hhaW5pbmdCZWhhdmlvciA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzdWx0ID0gY2hhaW5pbmdCZWhhdmlvcihfY2hhaW5pbmdCZWhhdmlvcikuY2FsbCh0aGlzKTtcbiAgICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQgPyB0aGlzIDogcmVzdWx0O1xuICB9O1xuXG4gIHZhciBfbWV0aG9kID0gY2hhaW5hYmxlQmVoYXZpb3IubWV0aG9kO1xuICBjaGFpbmFibGVCZWhhdmlvci5tZXRob2QgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IG1ldGhvZChfbWV0aG9kKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIHJldHVybiByZXN1bHQgPT09IHVuZGVmaW5lZCA/IHRoaXMgOiByZXN1bHQ7XG4gIH07XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gb3ZlcndyaXRlTWV0aG9kIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMjIyBvdmVyd3JpdGVNZXRob2QgKGN0eCwgbmFtZSwgZm4pXG4gKlxuICogT3ZlcndpdGVzIGFuIGFscmVhZHkgZXhpc3RpbmcgbWV0aG9kIGFuZCBwcm92aWRlc1xuICogYWNjZXNzIHRvIHByZXZpb3VzIGZ1bmN0aW9uLiBNdXN0IHJldHVybiBmdW5jdGlvblxuICogdG8gYmUgdXNlZCBmb3IgbmFtZS5cbiAqXG4gKiAgICAgdXRpbHMub3ZlcndyaXRlTWV0aG9kKGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZSwgJ2VxdWFsJywgZnVuY3Rpb24gKF9zdXBlcikge1xuICogICAgICAgcmV0dXJuIGZ1bmN0aW9uIChzdHIpIHtcbiAqICAgICAgICAgdmFyIG9iaiA9IHV0aWxzLmZsYWcodGhpcywgJ29iamVjdCcpO1xuICogICAgICAgICBpZiAob2JqIGluc3RhbmNlb2YgRm9vKSB7XG4gKiAgICAgICAgICAgbmV3IGNoYWkuQXNzZXJ0aW9uKG9iai52YWx1ZSkudG8uZXF1YWwoc3RyKTtcbiAqICAgICAgICAgfSBlbHNlIHtcbiAqICAgICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAqICAgICAgICAgfVxuICogICAgICAgfVxuICogICAgIH0pO1xuICpcbiAqIENhbiBhbHNvIGJlIGFjY2Vzc2VkIGRpcmVjdGx5IGZyb20gYGNoYWkuQXNzZXJ0aW9uYC5cbiAqXG4gKiAgICAgY2hhaS5Bc3NlcnRpb24ub3ZlcndyaXRlTWV0aG9kKCdmb28nLCBmbik7XG4gKlxuICogVGhlbiBjYW4gYmUgdXNlZCBhcyBhbnkgb3RoZXIgYXNzZXJ0aW9uLlxuICpcbiAqICAgICBleHBlY3QobXlGb28pLnRvLmVxdWFsKCdiYXInKTtcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gY3R4IG9iamVjdCB3aG9zZSBtZXRob2QgaXMgdG8gYmUgb3ZlcndyaXR0ZW5cbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG9mIG1ldGhvZCB0byBvdmVyd3JpdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG1ldGhvZCBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBmdW5jdGlvbiB0byBiZSB1c2VkIGZvciBuYW1lXG4gKiBAbmFtZSBvdmVyd3JpdGVNZXRob2RcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY3R4LCBuYW1lLCBtZXRob2QpIHtcbiAgdmFyIF9tZXRob2QgPSBjdHhbbmFtZV1cbiAgICAsIF9zdXBlciA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH07XG5cbiAgaWYgKF9tZXRob2QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIF9tZXRob2QpXG4gICAgX3N1cGVyID0gX21ldGhvZDtcblxuICBjdHhbbmFtZV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IG1ldGhvZChfc3VwZXIpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIHJlc3VsdCA9PT0gdW5kZWZpbmVkID8gdGhpcyA6IHJlc3VsdDtcbiAgfVxufTtcbiIsIi8qIVxuICogQ2hhaSAtIG92ZXJ3cml0ZVByb3BlcnR5IHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMjIyBvdmVyd3JpdGVQcm9wZXJ0eSAoY3R4LCBuYW1lLCBmbilcbiAqXG4gKiBPdmVyd2l0ZXMgYW4gYWxyZWFkeSBleGlzdGluZyBwcm9wZXJ0eSBnZXR0ZXIgYW5kIHByb3ZpZGVzXG4gKiBhY2Nlc3MgdG8gcHJldmlvdXMgdmFsdWUuIE11c3QgcmV0dXJuIGZ1bmN0aW9uIHRvIHVzZSBhcyBnZXR0ZXIuXG4gKlxuICogICAgIHV0aWxzLm92ZXJ3cml0ZVByb3BlcnR5KGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZSwgJ29rJywgZnVuY3Rpb24gKF9zdXBlcikge1xuICogICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAqICAgICAgICAgdmFyIG9iaiA9IHV0aWxzLmZsYWcodGhpcywgJ29iamVjdCcpO1xuICogICAgICAgICBpZiAob2JqIGluc3RhbmNlb2YgRm9vKSB7XG4gKiAgICAgICAgICAgbmV3IGNoYWkuQXNzZXJ0aW9uKG9iai5uYW1lKS50by5lcXVhbCgnYmFyJyk7XG4gKiAgICAgICAgIH0gZWxzZSB7XG4gKiAgICAgICAgICAgX3N1cGVyLmNhbGwodGhpcyk7XG4gKiAgICAgICAgIH1cbiAqICAgICAgIH1cbiAqICAgICB9KTtcbiAqXG4gKlxuICogQ2FuIGFsc28gYmUgYWNjZXNzZWQgZGlyZWN0bHkgZnJvbSBgY2hhaS5Bc3NlcnRpb25gLlxuICpcbiAqICAgICBjaGFpLkFzc2VydGlvbi5vdmVyd3JpdGVQcm9wZXJ0eSgnZm9vJywgZm4pO1xuICpcbiAqIFRoZW4gY2FuIGJlIHVzZWQgYXMgYW55IG90aGVyIGFzc2VydGlvbi5cbiAqXG4gKiAgICAgZXhwZWN0KG15Rm9vKS50by5iZS5vaztcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gY3R4IG9iamVjdCB3aG9zZSBwcm9wZXJ0eSBpcyB0byBiZSBvdmVyd3JpdHRlblxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgb2YgcHJvcGVydHkgdG8gb3ZlcndyaXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBnZXR0ZXIgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgZ2V0dGVyIGZ1bmN0aW9uIHRvIGJlIHVzZWQgZm9yIG5hbWVcbiAqIEBuYW1lIG92ZXJ3cml0ZVByb3BlcnR5XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGN0eCwgbmFtZSwgZ2V0dGVyKSB7XG4gIHZhciBfZ2V0ID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihjdHgsIG5hbWUpXG4gICAgLCBfc3VwZXIgPSBmdW5jdGlvbiAoKSB7fTtcblxuICBpZiAoX2dldCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgX2dldC5nZXQpXG4gICAgX3N1cGVyID0gX2dldC5nZXRcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3R4LCBuYW1lLFxuICAgIHsgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBnZXR0ZXIoX3N1cGVyKS5jYWxsKHRoaXMpO1xuICAgICAgICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQgPyB0aGlzIDogcmVzdWx0O1xuICAgICAgfVxuICAgICwgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIHRlc3QgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGFuY2llc1xuICovXG5cbnZhciBmbGFnID0gcmVxdWlyZSgnLi9mbGFnJyk7XG5cbi8qKlxuICogIyB0ZXN0KG9iamVjdCwgZXhwcmVzc2lvbilcbiAqXG4gKiBUZXN0IGFuZCBvYmplY3QgZm9yIGV4cHJlc3Npb24uXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCAoY29uc3RydWN0ZWQgQXNzZXJ0aW9uKVxuICogQHBhcmFtIHtBcmd1bWVudHN9IGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZS5hc3NlcnQgYXJndW1lbnRzXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqLCBhcmdzKSB7XG4gIHZhciBuZWdhdGUgPSBmbGFnKG9iaiwgJ25lZ2F0ZScpXG4gICAgLCBleHByID0gYXJnc1swXTtcbiAgcmV0dXJuIG5lZ2F0ZSA/ICFleHByIDogZXhwcjtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSB0cmFuc2ZlckZsYWdzIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMjIyB0cmFuc2ZlckZsYWdzKGFzc2VydGlvbiwgb2JqZWN0LCBpbmNsdWRlQWxsID0gdHJ1ZSlcbiAqXG4gKiBUcmFuc2ZlciBhbGwgdGhlIGZsYWdzIGZvciBgYXNzZXJ0aW9uYCB0byBgb2JqZWN0YC4gSWZcbiAqIGBpbmNsdWRlQWxsYCBpcyBzZXQgdG8gYGZhbHNlYCwgdGhlbiB0aGUgYmFzZSBDaGFpXG4gKiBhc3NlcnRpb24gZmxhZ3MgKG5hbWVseSBgb2JqZWN0YCwgYHNzZmlgLCBhbmQgYG1lc3NhZ2VgKVxuICogd2lsbCBub3QgYmUgdHJhbnNmZXJyZWQuXG4gKlxuICpcbiAqICAgICB2YXIgbmV3QXNzZXJ0aW9uID0gbmV3IEFzc2VydGlvbigpO1xuICogICAgIHV0aWxzLnRyYW5zZmVyRmxhZ3MoYXNzZXJ0aW9uLCBuZXdBc3NlcnRpb24pO1xuICpcbiAqICAgICB2YXIgYW5vdGhlckFzc2VyaXRvbiA9IG5ldyBBc3NlcnRpb24obXlPYmopO1xuICogICAgIHV0aWxzLnRyYW5zZmVyRmxhZ3MoYXNzZXJ0aW9uLCBhbm90aGVyQXNzZXJ0aW9uLCBmYWxzZSk7XG4gKlxuICogQHBhcmFtIHtBc3NlcnRpb259IGFzc2VydGlvbiB0aGUgYXNzZXJ0aW9uIHRvIHRyYW5zZmVyIHRoZSBmbGFncyBmcm9tXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IHRoZSBvYmplY3QgdG8gdHJhbnNmZXIgdGhlIGZsYWdzIHRvbzsgdXN1YWxseSBhIG5ldyBhc3NlcnRpb25cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gaW5jbHVkZUFsbFxuICogQG5hbWUgZ2V0QWxsRmxhZ3NcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGFzc2VydGlvbiwgb2JqZWN0LCBpbmNsdWRlQWxsKSB7XG4gIHZhciBmbGFncyA9IGFzc2VydGlvbi5fX2ZsYWdzIHx8IChhc3NlcnRpb24uX19mbGFncyA9IE9iamVjdC5jcmVhdGUobnVsbCkpO1xuXG4gIGlmICghb2JqZWN0Ll9fZmxhZ3MpIHtcbiAgICBvYmplY3QuX19mbGFncyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIH1cblxuICBpbmNsdWRlQWxsID0gYXJndW1lbnRzLmxlbmd0aCA9PT0gMyA/IGluY2x1ZGVBbGwgOiB0cnVlO1xuXG4gIGZvciAodmFyIGZsYWcgaW4gZmxhZ3MpIHtcbiAgICBpZiAoaW5jbHVkZUFsbCB8fFxuICAgICAgICAoZmxhZyAhPT0gJ29iamVjdCcgJiYgZmxhZyAhPT0gJ3NzZmknICYmIGZsYWcgIT0gJ21lc3NhZ2UnKSkge1xuICAgICAgb2JqZWN0Ll9fZmxhZ3NbZmxhZ10gPSBmbGFnc1tmbGFnXTtcbiAgICB9XG4gIH1cbn07XG4iLCIvKiFcbiAqIENoYWkgLSB0eXBlIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIERldGVjdGFibGUgamF2YXNjcmlwdCBuYXRpdmVzXG4gKi9cblxudmFyIG5hdGl2ZXMgPSB7XG4gICAgJ1tvYmplY3QgQXJndW1lbnRzXSc6ICdhcmd1bWVudHMnXG4gICwgJ1tvYmplY3QgQXJyYXldJzogJ2FycmF5J1xuICAsICdbb2JqZWN0IERhdGVdJzogJ2RhdGUnXG4gICwgJ1tvYmplY3QgRnVuY3Rpb25dJzogJ2Z1bmN0aW9uJ1xuICAsICdbb2JqZWN0IE51bWJlcl0nOiAnbnVtYmVyJ1xuICAsICdbb2JqZWN0IFJlZ0V4cF0nOiAncmVnZXhwJ1xuICAsICdbb2JqZWN0IFN0cmluZ10nOiAnc3RyaW5nJ1xufTtcblxuLyoqXG4gKiAjIyMgdHlwZShvYmplY3QpXG4gKlxuICogQmV0dGVyIGltcGxlbWVudGF0aW9uIG9mIGB0eXBlb2ZgIGRldGVjdGlvbiB0aGF0IGNhblxuICogYmUgdXNlZCBjcm9zcy1icm93c2VyLiBIYW5kbGVzIHRoZSBpbmNvbnNpc3RlbmNpZXMgb2ZcbiAqIEFycmF5LCBgbnVsbGAsIGFuZCBgdW5kZWZpbmVkYCBkZXRlY3Rpb24uXG4gKlxuICogICAgIHV0aWxzLnR5cGUoe30pIC8vICdvYmplY3QnXG4gKiAgICAgdXRpbHMudHlwZShudWxsKSAvLyBgbnVsbCdcbiAqICAgICB1dGlscy50eXBlKHVuZGVmaW5lZCkgLy8gYHVuZGVmaW5lZGBcbiAqICAgICB1dGlscy50eXBlKFtdKSAvLyBgYXJyYXlgXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqZWN0IHRvIGRldGVjdCB0eXBlIG9mXG4gKiBAbmFtZSB0eXBlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIHN0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopO1xuICBpZiAobmF0aXZlc1tzdHJdKSByZXR1cm4gbmF0aXZlc1tzdHJdO1xuICBpZiAob2JqID09PSBudWxsKSByZXR1cm4gJ251bGwnO1xuICBpZiAob2JqID09PSB1bmRlZmluZWQpIHJldHVybiAndW5kZWZpbmVkJztcbiAgaWYgKG9iaiA9PT0gT2JqZWN0KG9iaikpIHJldHVybiAnb2JqZWN0JztcbiAgcmV0dXJuIHR5cGVvZiBvYmo7XG59O1xuIiwiLyohXG4gKiBhc3NlcnRpb24tZXJyb3JcbiAqIENvcHlyaWdodChjKSAyMDEzIEpha2UgTHVlciA8amFrZUBxdWFsaWFuY3kuY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyohXG4gKiBSZXR1cm4gYSBmdW5jdGlvbiB0aGF0IHdpbGwgY29weSBwcm9wZXJ0aWVzIGZyb21cbiAqIG9uZSBvYmplY3QgdG8gYW5vdGhlciBleGNsdWRpbmcgYW55IG9yaWdpbmFsbHlcbiAqIGxpc3RlZC4gUmV0dXJuZWQgZnVuY3Rpb24gd2lsbCBjcmVhdGUgYSBuZXcgYHt9YC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXhjbHVkZWQgcHJvcGVydGllcyAuLi5cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5cbmZ1bmN0aW9uIGV4Y2x1ZGUgKCkge1xuICB2YXIgZXhjbHVkZXMgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgZnVuY3Rpb24gZXhjbHVkZVByb3BzIChyZXMsIG9iaikge1xuICAgIE9iamVjdC5rZXlzKG9iaikuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICBpZiAoIX5leGNsdWRlcy5pbmRleE9mKGtleSkpIHJlc1trZXldID0gb2JqW2tleV07XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24gZXh0ZW5kRXhjbHVkZSAoKSB7XG4gICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgICwgaSA9IDBcbiAgICAgICwgcmVzID0ge307XG5cbiAgICBmb3IgKDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV4Y2x1ZGVQcm9wcyhyZXMsIGFyZ3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXM7XG4gIH07XG59O1xuXG4vKiFcbiAqIFByaW1hcnkgRXhwb3J0c1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gQXNzZXJ0aW9uRXJyb3I7XG5cbi8qKlxuICogIyMjIEFzc2VydGlvbkVycm9yXG4gKlxuICogQW4gZXh0ZW5zaW9uIG9mIHRoZSBKYXZhU2NyaXB0IGBFcnJvcmAgY29uc3RydWN0b3IgZm9yXG4gKiBhc3NlcnRpb24gYW5kIHZhbGlkYXRpb24gc2NlbmFyaW9zLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gKiBAcGFyYW0ge09iamVjdH0gcHJvcGVydGllcyB0byBpbmNsdWRlIChvcHRpb25hbClcbiAqIEBwYXJhbSB7Y2FsbGVlfSBzdGFydCBzdGFjayBmdW5jdGlvbiAob3B0aW9uYWwpXG4gKi9cblxuZnVuY3Rpb24gQXNzZXJ0aW9uRXJyb3IgKG1lc3NhZ2UsIF9wcm9wcywgc3NmKSB7XG4gIHZhciBleHRlbmQgPSBleGNsdWRlKCduYW1lJywgJ21lc3NhZ2UnLCAnc3RhY2snLCAnY29uc3RydWN0b3InLCAndG9KU09OJylcbiAgICAsIHByb3BzID0gZXh0ZW5kKF9wcm9wcyB8fCB7fSk7XG5cbiAgLy8gZGVmYXVsdCB2YWx1ZXNcbiAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZSB8fCAnVW5zcGVjaWZpZWQgQXNzZXJ0aW9uRXJyb3InO1xuICB0aGlzLnNob3dEaWZmID0gZmFsc2U7XG5cbiAgLy8gY29weSBmcm9tIHByb3BlcnRpZXNcbiAgZm9yICh2YXIga2V5IGluIHByb3BzKSB7XG4gICAgdGhpc1trZXldID0gcHJvcHNba2V5XTtcbiAgfVxuXG4gIC8vIGNhcHR1cmUgc3RhY2sgdHJhY2VcbiAgc3NmID0gc3NmIHx8IGFyZ3VtZW50cy5jYWxsZWU7XG4gIGlmIChzc2YgJiYgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UpIHtcbiAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBzc2YpO1xuICB9XG59XG5cbi8qIVxuICogSW5oZXJpdCBmcm9tIEVycm9yLnByb3RvdHlwZVxuICovXG5cbkFzc2VydGlvbkVycm9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXJyb3IucHJvdG90eXBlKTtcblxuLyohXG4gKiBTdGF0aWNhbGx5IHNldCBuYW1lXG4gKi9cblxuQXNzZXJ0aW9uRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnQXNzZXJ0aW9uRXJyb3InO1xuXG4vKiFcbiAqIEVuc3VyZSBjb3JyZWN0IGNvbnN0cnVjdG9yXG4gKi9cblxuQXNzZXJ0aW9uRXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQXNzZXJ0aW9uRXJyb3I7XG5cbi8qKlxuICogQWxsb3cgZXJyb3JzIHRvIGJlIGNvbnZlcnRlZCB0byBKU09OIGZvciBzdGF0aWMgdHJhbnNmZXIuXG4gKlxuICogQHBhcmFtIHtCb29sZWFufSBpbmNsdWRlIHN0YWNrIChkZWZhdWx0OiBgdHJ1ZWApXG4gKiBAcmV0dXJuIHtPYmplY3R9IG9iamVjdCB0aGF0IGNhbiBiZSBgSlNPTi5zdHJpbmdpZnlgXG4gKi9cblxuQXNzZXJ0aW9uRXJyb3IucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIChzdGFjaykge1xuICB2YXIgZXh0ZW5kID0gZXhjbHVkZSgnY29uc3RydWN0b3InLCAndG9KU09OJywgJ3N0YWNrJylcbiAgICAsIHByb3BzID0gZXh0ZW5kKHsgbmFtZTogdGhpcy5uYW1lIH0sIHRoaXMpO1xuXG4gIC8vIGluY2x1ZGUgc3RhY2sgaWYgZXhpc3RzIGFuZCBub3QgdHVybmVkIG9mZlxuICBpZiAoZmFsc2UgIT09IHN0YWNrICYmIHRoaXMuc3RhY2spIHtcbiAgICBwcm9wcy5zdGFjayA9IHRoaXMuc3RhY2s7XG4gIH1cblxuICByZXR1cm4gcHJvcHM7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9lcWwnKTtcbiIsIi8qIVxuICogZGVlcC1lcWxcbiAqIENvcHlyaWdodChjKSAyMDEzIEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzXG4gKi9cblxudmFyIHR5cGUgPSByZXF1aXJlKCd0eXBlLWRldGVjdCcpO1xuXG4vKiFcbiAqIEJ1ZmZlci5pc0J1ZmZlciBicm93c2VyIHNoaW1cbiAqL1xuXG52YXIgQnVmZmVyO1xudHJ5IHsgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyOyB9XG5jYXRjaChleCkge1xuICBCdWZmZXIgPSB7fTtcbiAgQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24oKSB7IHJldHVybiBmYWxzZTsgfVxufVxuXG4vKiFcbiAqIFByaW1hcnkgRXhwb3J0XG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBkZWVwRXF1YWw7XG5cbi8qKlxuICogQXNzZXJ0IHN1cGVyLXN0cmljdCAoZWdhbCkgZXF1YWxpdHkgYmV0d2VlblxuICogdHdvIG9iamVjdHMgb2YgYW55IHR5cGUuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gYVxuICogQHBhcmFtIHtNaXhlZH0gYlxuICogQHBhcmFtIHtBcnJheX0gbWVtb2lzZWQgKG9wdGlvbmFsKVxuICogQHJldHVybiB7Qm9vbGVhbn0gZXF1YWwgbWF0Y2hcbiAqL1xuXG5mdW5jdGlvbiBkZWVwRXF1YWwoYSwgYiwgbSkge1xuICBpZiAoc2FtZVZhbHVlKGEsIGIpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSBpZiAoJ2RhdGUnID09PSB0eXBlKGEpKSB7XG4gICAgcmV0dXJuIGRhdGVFcXVhbChhLCBiKTtcbiAgfSBlbHNlIGlmICgncmVnZXhwJyA9PT0gdHlwZShhKSkge1xuICAgIHJldHVybiByZWdleHBFcXVhbChhLCBiKTtcbiAgfSBlbHNlIGlmIChCdWZmZXIuaXNCdWZmZXIoYSkpIHtcbiAgICByZXR1cm4gYnVmZmVyRXF1YWwoYSwgYik7XG4gIH0gZWxzZSBpZiAoJ2FyZ3VtZW50cycgPT09IHR5cGUoYSkpIHtcbiAgICByZXR1cm4gYXJndW1lbnRzRXF1YWwoYSwgYiwgbSk7XG4gIH0gZWxzZSBpZiAoIXR5cGVFcXVhbChhLCBiKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSBlbHNlIGlmICgoJ29iamVjdCcgIT09IHR5cGUoYSkgJiYgJ29iamVjdCcgIT09IHR5cGUoYikpXG4gICYmICgnYXJyYXknICE9PSB0eXBlKGEpICYmICdhcnJheScgIT09IHR5cGUoYikpKSB7XG4gICAgcmV0dXJuIHNhbWVWYWx1ZShhLCBiKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gb2JqZWN0RXF1YWwoYSwgYiwgbSk7XG4gIH1cbn1cblxuLyohXG4gKiBTdHJpY3QgKGVnYWwpIGVxdWFsaXR5IHRlc3QuIEVuc3VyZXMgdGhhdCBOYU4gYWx3YXlzXG4gKiBlcXVhbHMgTmFOIGFuZCBgLTBgIGRvZXMgbm90IGVxdWFsIGArMGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gYVxuICogQHBhcmFtIHtNaXhlZH0gYlxuICogQHJldHVybiB7Qm9vbGVhbn0gZXF1YWwgbWF0Y2hcbiAqL1xuXG5mdW5jdGlvbiBzYW1lVmFsdWUoYSwgYikge1xuICBpZiAoYSA9PT0gYikgcmV0dXJuIGEgIT09IDAgfHwgMSAvIGEgPT09IDEgLyBiO1xuICByZXR1cm4gYSAhPT0gYSAmJiBiICE9PSBiO1xufVxuXG4vKiFcbiAqIENvbXBhcmUgdGhlIHR5cGVzIG9mIHR3byBnaXZlbiBvYmplY3RzIGFuZFxuICogcmV0dXJuIGlmIHRoZXkgYXJlIGVxdWFsLiBOb3RlIHRoYXQgYW4gQXJyYXlcbiAqIGhhcyBhIHR5cGUgb2YgYGFycmF5YCAobm90IGBvYmplY3RgKSBhbmQgYXJndW1lbnRzXG4gKiBoYXZlIGEgdHlwZSBvZiBgYXJndW1lbnRzYCAobm90IGBhcnJheWAvYG9iamVjdGApLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IGFcbiAqIEBwYXJhbSB7TWl4ZWR9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIHR5cGVFcXVhbChhLCBiKSB7XG4gIHJldHVybiB0eXBlKGEpID09PSB0eXBlKGIpO1xufVxuXG4vKiFcbiAqIENvbXBhcmUgdHdvIERhdGUgb2JqZWN0cyBieSBhc3NlcnRpbmcgdGhhdFxuICogdGhlIHRpbWUgdmFsdWVzIGFyZSBlcXVhbCB1c2luZyBgc2F2ZVZhbHVlYC5cbiAqXG4gKiBAcGFyYW0ge0RhdGV9IGFcbiAqIEBwYXJhbSB7RGF0ZX0gYlxuICogQHJldHVybiB7Qm9vbGVhbn0gcmVzdWx0XG4gKi9cblxuZnVuY3Rpb24gZGF0ZUVxdWFsKGEsIGIpIHtcbiAgaWYgKCdkYXRlJyAhPT0gdHlwZShiKSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gc2FtZVZhbHVlKGEuZ2V0VGltZSgpLCBiLmdldFRpbWUoKSk7XG59XG5cbi8qIVxuICogQ29tcGFyZSB0d28gcmVndWxhciBleHByZXNzaW9ucyBieSBjb252ZXJ0aW5nIHRoZW1cbiAqIHRvIHN0cmluZyBhbmQgY2hlY2tpbmcgZm9yIGBzYW1lVmFsdWVgLlxuICpcbiAqIEBwYXJhbSB7UmVnRXhwfSBhXG4gKiBAcGFyYW0ge1JlZ0V4cH0gYlxuICogQHJldHVybiB7Qm9vbGVhbn0gcmVzdWx0XG4gKi9cblxuZnVuY3Rpb24gcmVnZXhwRXF1YWwoYSwgYikge1xuICBpZiAoJ3JlZ2V4cCcgIT09IHR5cGUoYikpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHNhbWVWYWx1ZShhLnRvU3RyaW5nKCksIGIudG9TdHJpbmcoKSk7XG59XG5cbi8qIVxuICogQXNzZXJ0IGRlZXAgZXF1YWxpdHkgb2YgdHdvIGBhcmd1bWVudHNgIG9iamVjdHMuXG4gKiBVbmZvcnR1bmF0ZWx5LCB0aGVzZSBtdXN0IGJlIHNsaWNlZCB0byBhcnJheXNcbiAqIHByaW9yIHRvIHRlc3QgdG8gZW5zdXJlIG5vIGJhZCBiZWhhdmlvci5cbiAqXG4gKiBAcGFyYW0ge0FyZ3VtZW50c30gYVxuICogQHBhcmFtIHtBcmd1bWVudHN9IGJcbiAqIEBwYXJhbSB7QXJyYXl9IG1lbW9pemUgKG9wdGlvbmFsKVxuICogQHJldHVybiB7Qm9vbGVhbn0gcmVzdWx0XG4gKi9cblxuZnVuY3Rpb24gYXJndW1lbnRzRXF1YWwoYSwgYiwgbSkge1xuICBpZiAoJ2FyZ3VtZW50cycgIT09IHR5cGUoYikpIHJldHVybiBmYWxzZTtcbiAgYSA9IFtdLnNsaWNlLmNhbGwoYSk7XG4gIGIgPSBbXS5zbGljZS5jYWxsKGIpO1xuICByZXR1cm4gZGVlcEVxdWFsKGEsIGIsIG0pO1xufVxuXG4vKiFcbiAqIEdldCBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2YgYSBnaXZlbiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGFcbiAqIEByZXR1cm4ge0FycmF5fSBwcm9wZXJ0eSBuYW1lc1xuICovXG5cbmZ1bmN0aW9uIGVudW1lcmFibGUoYSkge1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBhKSByZXMucHVzaChrZXkpO1xuICByZXR1cm4gcmVzO1xufVxuXG4vKiFcbiAqIFNpbXBsZSBlcXVhbGl0eSBmb3IgZmxhdCBpdGVyYWJsZSBvYmplY3RzXG4gKiBzdWNoIGFzIEFycmF5cyBvciBOb2RlLmpzIGJ1ZmZlcnMuXG4gKlxuICogQHBhcmFtIHtJdGVyYWJsZX0gYVxuICogQHBhcmFtIHtJdGVyYWJsZX0gYlxuICogQHJldHVybiB7Qm9vbGVhbn0gcmVzdWx0XG4gKi9cblxuZnVuY3Rpb24gaXRlcmFibGVFcXVhbChhLCBiKSB7XG4gIGlmIChhLmxlbmd0aCAhPT0gIGIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG5cbiAgdmFyIGkgPSAwO1xuICB2YXIgbWF0Y2ggPSB0cnVlO1xuXG4gIGZvciAoOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICBtYXRjaCA9IGZhbHNlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG1hdGNoO1xufVxuXG4vKiFcbiAqIEV4dGVuc2lvbiB0byBgaXRlcmFibGVFcXVhbGAgc3BlY2lmaWNhbGx5XG4gKiBmb3IgTm9kZS5qcyBCdWZmZXJzLlxuICpcbiAqIEBwYXJhbSB7QnVmZmVyfSBhXG4gKiBAcGFyYW0ge01peGVkfSBiXG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqL1xuXG5mdW5jdGlvbiBidWZmZXJFcXVhbChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBpdGVyYWJsZUVxdWFsKGEsIGIpO1xufVxuXG4vKiFcbiAqIEJsb2NrIGZvciBgb2JqZWN0RXF1YWxgIGVuc3VyaW5nIG5vbi1leGlzdGluZ1xuICogdmFsdWVzIGRvbid0IGdldCBpbi5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmplY3RcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIGlzVmFsdWUoYSkge1xuICByZXR1cm4gYSAhPT0gbnVsbCAmJiBhICE9PSB1bmRlZmluZWQ7XG59XG5cbi8qIVxuICogUmVjdXJzaXZlbHkgY2hlY2sgdGhlIGVxdWFsaXR5IG9mIHR3byBvYmplY3RzLlxuICogT25jZSBiYXNpYyBzYW1lbmVzcyBoYXMgYmVlbiBlc3RhYmxpc2hlZCBpdCB3aWxsXG4gKiBkZWZlciB0byBgZGVlcEVxdWFsYCBmb3IgZWFjaCBlbnVtZXJhYmxlIGtleVxuICogaW4gdGhlIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBhXG4gKiBAcGFyYW0ge01peGVkfSBiXG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqL1xuXG5mdW5jdGlvbiBvYmplY3RFcXVhbChhLCBiLCBtKSB7XG4gIGlmICghaXNWYWx1ZShhKSB8fCAhaXNWYWx1ZShiKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChhLnByb3RvdHlwZSAhPT0gYi5wcm90b3R5cGUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB2YXIgaTtcbiAgaWYgKG0pIHtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKChtW2ldWzBdID09PSBhICYmIG1baV1bMV0gPT09IGIpXG4gICAgICB8fCAgKG1baV1bMF0gPT09IGIgJiYgbVtpXVsxXSA9PT0gYSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIG0gPSBbXTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgdmFyIGthID0gZW51bWVyYWJsZShhKTtcbiAgICB2YXIga2IgPSBlbnVtZXJhYmxlKGIpO1xuICB9IGNhdGNoIChleCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGthLnNvcnQoKTtcbiAga2Iuc29ydCgpO1xuXG4gIGlmICghaXRlcmFibGVFcXVhbChrYSwga2IpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgbS5wdXNoKFsgYSwgYiBdKTtcblxuICB2YXIga2V5O1xuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGtleSA9IGthW2ldO1xuICAgIGlmICghZGVlcEVxdWFsKGFba2V5XSwgYltrZXldLCBtKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi90eXBlJyk7XG4iLCIvKiFcbiAqIHR5cGUtZGV0ZWN0XG4gKiBDb3B5cmlnaHQoYykgMjAxMyBqYWtlIGx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogUHJpbWFyeSBFeHBvcnRzXG4gKi9cblxudmFyIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGdldFR5cGU7XG5cbi8qIVxuICogRGV0ZWN0YWJsZSBqYXZhc2NyaXB0IG5hdGl2ZXNcbiAqL1xuXG52YXIgbmF0aXZlcyA9IHtcbiAgICAnW29iamVjdCBBcnJheV0nOiAnYXJyYXknXG4gICwgJ1tvYmplY3QgUmVnRXhwXSc6ICdyZWdleHAnXG4gICwgJ1tvYmplY3QgRnVuY3Rpb25dJzogJ2Z1bmN0aW9uJ1xuICAsICdbb2JqZWN0IEFyZ3VtZW50c10nOiAnYXJndW1lbnRzJ1xuICAsICdbb2JqZWN0IERhdGVdJzogJ2RhdGUnXG59O1xuXG4vKipcbiAqICMjIyB0eXBlT2YgKG9iailcbiAqXG4gKiBVc2Ugc2V2ZXJhbCBkaWZmZXJlbnQgdGVjaG5pcXVlcyB0byBkZXRlcm1pbmVcbiAqIHRoZSB0eXBlIG9mIG9iamVjdCBiZWluZyB0ZXN0ZWQuXG4gKlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IG9iamVjdFxuICogQHJldHVybiB7U3RyaW5nfSBvYmplY3QgdHlwZVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBnZXRUeXBlIChvYmopIHtcbiAgdmFyIHN0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopO1xuICBpZiAobmF0aXZlc1tzdHJdKSByZXR1cm4gbmF0aXZlc1tzdHJdO1xuICBpZiAob2JqID09PSBudWxsKSByZXR1cm4gJ251bGwnO1xuICBpZiAob2JqID09PSB1bmRlZmluZWQpIHJldHVybiAndW5kZWZpbmVkJztcbiAgaWYgKG9iaiA9PT0gT2JqZWN0KG9iaikpIHJldHVybiAnb2JqZWN0JztcbiAgcmV0dXJuIHR5cGVvZiBvYmo7XG59XG5cbmV4cG9ydHMuTGlicmFyeSA9IExpYnJhcnk7XG5cbi8qKlxuICogIyMjIExpYnJhcnlcbiAqXG4gKiBDcmVhdGUgYSByZXBvc2l0b3J5IGZvciBjdXN0b20gdHlwZSBkZXRlY3Rpb24uXG4gKlxuICogYGBganNcbiAqIHZhciBsaWIgPSBuZXcgdHlwZS5MaWJyYXJ5O1xuICogYGBgXG4gKlxuICovXG5cbmZ1bmN0aW9uIExpYnJhcnkgKCkge1xuICB0aGlzLnRlc3RzID0ge307XG59XG5cbi8qKlxuICogIyMjIyAub2YgKG9iailcbiAqXG4gKiBFeHBvc2UgcmVwbGFjZW1lbnQgYHR5cGVvZmAgZGV0ZWN0aW9uIHRvIHRoZSBsaWJyYXJ5LlxuICpcbiAqIGBgYGpzXG4gKiBpZiAoJ3N0cmluZycgPT09IGxpYi5vZignaGVsbG8gd29ybGQnKSkge1xuICogICAvLyAuLi5cbiAqIH1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IG9iamVjdCB0byB0ZXN0XG4gKiBAcmV0dXJuIHtTdHJpbmd9IHR5cGVcbiAqL1xuXG5MaWJyYXJ5LnByb3RvdHlwZS5vZiA9IGdldFR5cGU7XG5cbi8qKlxuICogIyMjIyAuZGVmaW5lICh0eXBlLCB0ZXN0KVxuICpcbiAqIEFkZCBhIHRlc3QgdG8gZm9yIHRoZSBgLnRlc3QoKWAgYXNzZXJ0aW9uLlxuICpcbiAqIENhbiBiZSBkZWZpbmVkIGFzIGEgcmVndWxhciBleHByZXNzaW9uOlxuICpcbiAqIGBgYGpzXG4gKiBsaWIuZGVmaW5lKCdpbnQnLCAvXlswLTldKyQvKTtcbiAqIGBgYFxuICpcbiAqIC4uLiBvciBhcyBhIGZ1bmN0aW9uOlxuICpcbiAqIGBgYGpzXG4gKiBsaWIuZGVmaW5lKCdibG4nLCBmdW5jdGlvbiAob2JqKSB7XG4gKiAgIGlmICgnYm9vbGVhbicgPT09IGxpYi5vZihvYmopKSByZXR1cm4gdHJ1ZTtcbiAqICAgdmFyIGJsbnMgPSBbICd5ZXMnLCAnbm8nLCAndHJ1ZScsICdmYWxzZScsIDEsIDAgXTtcbiAqICAgaWYgKCdzdHJpbmcnID09PSBsaWIub2Yob2JqKSkgb2JqID0gb2JqLnRvTG93ZXJDYXNlKCk7XG4gKiAgIHJldHVybiAhISB+Ymxucy5pbmRleE9mKG9iaik7XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcGFyYW0ge1JlZ0V4cHxGdW5jdGlvbn0gdGVzdFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5MaWJyYXJ5LnByb3RvdHlwZS5kZWZpbmUgPSBmdW5jdGlvbiAodHlwZSwgdGVzdCkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkgcmV0dXJuIHRoaXMudGVzdHNbdHlwZV07XG4gIHRoaXMudGVzdHNbdHlwZV0gPSB0ZXN0O1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogIyMjIyAudGVzdCAob2JqLCB0ZXN0KVxuICpcbiAqIEFzc2VydCB0aGF0IGFuIG9iamVjdCBpcyBvZiB0eXBlLiBXaWxsIGZpcnN0XG4gKiBjaGVjayBuYXRpdmVzLCBhbmQgaWYgdGhhdCBkb2VzIG5vdCBwYXNzIGl0IHdpbGxcbiAqIHVzZSB0aGUgdXNlciBkZWZpbmVkIGN1c3RvbSB0ZXN0cy5cbiAqXG4gKiBgYGBqc1xuICogYXNzZXJ0KGxpYi50ZXN0KCcxJywgJ2ludCcpKTtcbiAqIGFzc2VydChsaWIudGVzdCgneWVzJywgJ2JsbicpKTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IG9iamVjdFxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5MaWJyYXJ5LnByb3RvdHlwZS50ZXN0ID0gZnVuY3Rpb24gKG9iaiwgdHlwZSkge1xuICBpZiAodHlwZSA9PT0gZ2V0VHlwZShvYmopKSByZXR1cm4gdHJ1ZTtcbiAgdmFyIHRlc3QgPSB0aGlzLnRlc3RzW3R5cGVdO1xuXG4gIGlmICh0ZXN0ICYmICdyZWdleHAnID09PSBnZXRUeXBlKHRlc3QpKSB7XG4gICAgcmV0dXJuIHRlc3QudGVzdChvYmopO1xuICB9IGVsc2UgaWYgKHRlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gZ2V0VHlwZSh0ZXN0KSkge1xuICAgIHJldHVybiB0ZXN0KG9iaik7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKCdUeXBlIHRlc3QgXCInICsgdHlwZSArICdcIiBub3QgZGVmaW5lZCBvciBpbnZhbGlkLicpO1xuICB9XG59O1xuIiwidmFyIGZ1cmlvdXMgPSByZXF1aXJlKFwiLi4vbGliL2Z1cmlvdXMuanNcIik7XG52YXIgZXhwZWN0ID0gcmVxdWlyZShcImNoYWlcIikuZXhwZWN0O1xuXG52YXIgY29udGV4dCA9IG51bGw7XG5iZWZvcmUoZnVuY3Rpb24oZG9uZSkge1xuXHRmdXJpb3VzLmluaXQoZnVuY3Rpb24oY3R4KSB7XG5cdFx0Y29udGV4dCA9IGN0eDtcblx0XHRkb25lKCk7XG5cdH0pO1xufSk7XG5cbmRlc2NyaWJlKFwiQ29udGV4dFwiLCBmdW5jdGlvbigpe1xuXHRkZXNjcmliZShcImVtcHR5XCIsIGZ1bmN0aW9uKCl7XG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IHdpdGggc3BlY2lmaWVkIHNoYXBlXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KDQyKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC5lbXB0eShbNDJdKTtcblx0XHRcdHZhciB6ID0gY29udGV4dC5lbXB0eShbNCwgMl0pO1xuXHRcdFx0ZXhwZWN0KHguc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzQyXSk7XG5cdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbNDJdKTtcblx0XHRcdGV4cGVjdCh6LnNoYXBlKS50by5kZWVwLmVxdWFsKFs0LCAyXSk7XG5cdFx0XHR4LmludmFsaWRhdGUoKTtcblx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0ei5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IHdpdGggc3BlY2lmaWVkIGRhdGEgdHlwZSAoZjY0IGJ5IGRlZmF1bHQpXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KFs0LCAyXSk7XG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuZW1wdHkoWzQsIDJdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKSk7XG5cdFx0XHR2YXIgeiA9IGNvbnRleHQuZW1wdHkoWzQsIDJdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKSk7XG5cdFx0XHRleHBlY3QoeC5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpKS50by5iZS50cnVlO1xuXHRcdFx0ZXhwZWN0KHkuZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKSkudG8uYmUudHJ1ZTtcblx0XHRcdGV4cGVjdCh6LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKSkpLnRvLmJlLnRydWU7XG5cdFx0XHR4LmludmFsaWRhdGUoKTtcblx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0ei5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcInplcm9zXCIsIGZ1bmN0aW9uKCl7XG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IHdpdGggc3BlY2lmaWVkIHNoYXBlXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0Lnplcm9zKDQyKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC56ZXJvcyhbNDJdKTtcblx0XHRcdHZhciB6ID0gY29udGV4dC56ZXJvcyhbNCwgMl0pO1xuXHRcdFx0ZXhwZWN0KHguc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzQyXSk7XG5cdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbNDJdKTtcblx0XHRcdGV4cGVjdCh6LnNoYXBlKS50by5kZWVwLmVxdWFsKFs0LCAyXSk7XG5cdFx0XHR4LmludmFsaWRhdGUoKTtcblx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0ei5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IHdpdGggc3BlY2lmaWVkIGRhdGEgdHlwZSAoZjY0IGJ5IGRlZmF1bHQpXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0Lnplcm9zKFs0LCAyXSk7XG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuemVyb3MoWzQsIDJdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKSk7XG5cdFx0XHR2YXIgeiA9IGNvbnRleHQuemVyb3MoWzQsIDJdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKSk7XG5cdFx0XHRleHBlY3QoeC5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpKS50by5iZS50cnVlO1xuXHRcdFx0ZXhwZWN0KHkuZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKSkudG8uYmUudHJ1ZTtcblx0XHRcdGV4cGVjdCh6LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKSkpLnRvLmJlLnRydWU7XG5cdFx0XHR4LmludmFsaWRhdGUoKTtcblx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0ei5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IHdpdGggYWxsIGVsZW1lbnRzIGluaXRpYWxpemVkIHRvIHplcm9cIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0Lnplcm9zKFszLCAyXSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpO1xuXHRcdFx0dmFyIHkgPSBjb250ZXh0Lnplcm9zKFsyLCAzXSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIikpO1xuXHRcdFx0Y29udGV4dC5nZXQoeCwgeSwgZnVuY3Rpb24oeCwgeSkge1xuXHRcdFx0XHRleHBlY3QoeCkudG8uZGVlcC5lcXVhbChbWzAuMCwgMC4wXSxcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFswLjAsIDAuMF0sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbMC4wLCAwLjBdXSk7XG5cdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFtbMC4wLCAwLjAsIDAuMF0sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbMC4wLCAwLjAsIDAuMF1dKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcIm9uZXNcIiwgZnVuY3Rpb24oKXtcblx0XHRpdChcIkNyZWF0ZXMgYXJyYXkgd2l0aCBzcGVjaWZpZWQgc2hhcGVcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyg0Mik7XG5cdFx0XHR2YXIgeSA9IGNvbnRleHQub25lcyhbNDJdKTtcblx0XHRcdHZhciB6ID0gY29udGV4dC5vbmVzKFs0LCAyXSk7XG5cdFx0XHRleHBlY3QoeC5zaGFwZSkudG8uZGVlcC5lcXVhbChbNDJdKTtcblx0XHRcdGV4cGVjdCh5LnNoYXBlKS50by5kZWVwLmVxdWFsKFs0Ml0pO1xuXHRcdFx0ZXhwZWN0KHouc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzQsIDJdKTtcblx0XHRcdHguaW52YWxpZGF0ZSgpO1xuXHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHR6LmludmFsaWRhdGUoKTtcblx0XHR9KTtcblx0XHRpdChcIkNyZWF0ZXMgYXJyYXkgd2l0aCBzcGVjaWZpZWQgZGF0YSB0eXBlIChmNjQgYnkgZGVmYXVsdClcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyhbNCwgMl0pO1xuXHRcdFx0dmFyIHkgPSBjb250ZXh0Lm9uZXMoWzQsIDJdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKSk7XG5cdFx0XHR2YXIgeiA9IGNvbnRleHQub25lcyhbNCwgMl0sIG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjMyXCIpKTtcblx0XHRcdGV4cGVjdCh4LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKSkpLnRvLmJlLnRydWU7XG5cdFx0XHRleHBlY3QoeS5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpKS50by5iZS50cnVlO1xuXHRcdFx0ZXhwZWN0KHouZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjMyXCIpKSkudG8uYmUudHJ1ZTtcblx0XHRcdHguaW52YWxpZGF0ZSgpO1xuXHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHR6LmludmFsaWRhdGUoKTtcblx0XHR9KTtcblx0XHRpdChcIkNyZWF0ZXMgYXJyYXkgd2l0aCBhbGwgZWxlbWVudHMgaW5pdGlhbGl6ZWQgdG8gb25lXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5vbmVzKFszLCAyXSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpO1xuXHRcdFx0dmFyIHkgPSBjb250ZXh0Lm9uZXMoWzIsIDNdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKSk7XG5cdFx0XHRjb250ZXh0LmdldCh4LCB5LCBmdW5jdGlvbih4LCB5KSB7XG5cdFx0XHRcdGV4cGVjdCh4KS50by5kZWVwLmVxdWFsKFtbMS4wLCAxLjBdLFxuXHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWzEuMCwgMS4wXSxcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsxLjAsIDEuMF1dKTtcblx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1sxLjAsIDEuMCwgMS4wXSxcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsxLjAsIDEuMCwgMS4wXV0pO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwiYXJyYXlcIiwgZnVuY3Rpb24oKXtcblx0XHRpdChcIkNyZWF0ZXMgYXJyYXkgb2YgdGhlIHNhbWUgbGVuZ3RoIGFzIHRoZSBwcm92aWRlZCBhcnJheVwiLCBmdW5jdGlvbigpe1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFswLCAxXSk7XG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoW1swLCAxXSxcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgWzIsIDNdLFxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbMywgNF1dKTtcblx0XHRcdGV4cGVjdCh4Lmxlbmd0aCkudG8uZXF1YWwoMik7XG5cdFx0XHRleHBlY3QoeS5sZW5ndGgpLnRvLmVxdWFsKDYpO1xuXHRcdFx0eC5pbnZhbGlkYXRlKCk7XG5cdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHR9KTtcblx0XHRpdChcIkNyZWF0ZXMgYXJyYXkgb2YgdGhlIHNhbWUgc2hhcGUgYXMgdGhlIHByb3ZpZGVkIGFycmF5XCIsIGZ1bmN0aW9uKCl7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzAsIDFdKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWzAsIDFdLFxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbMiwgM10sXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgICAgIFszLCA0XV0pO1xuXHRcdFx0dmFyIHogPSBjb250ZXh0LmFycmF5KFtbWzEsIDIsIDNdLCBbIDQsICA1LCAgNl1dLFxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbWzcsIDgsIDldLCBbMTAsIDExLCAxMl1dXSk7XG5cdFx0XHRleHBlY3QoeC5zaGFwZSkudG8uZGVlcC5lcXVhbChbMl0pO1xuXHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzMsIDJdKTtcblx0XHRcdGV4cGVjdCh6LnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAyLCAzXSk7XG5cdFx0XHR4LmludmFsaWRhdGUoKTtcblx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0ei5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IHdpdGggdGhlIHNhbWUgZGF0YSBhcyB0aGUgcHJvdmlkZWQgYXJyYXlcIiwgZnVuY3Rpb24oZG9uZSl7XG5cdFx0XHR2YXIgYXJyYXkgPSBbW1sxLCAyLCAzXSwgWyA0LCAgNSwgIDZdXSxcblx0XHRcdCAgICAgICAgICAgICBbWzcsIDgsIDldLCBbMTAsIDExLCAxMl1dXTtcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShhcnJheSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpO1xuXHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KGFycmF5LCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKSk7XG5cdFx0XHRjb250ZXh0LmdldCh4LCB5LCBmdW5jdGlvbih4LCB5KSB7XG5cdFx0XHRcdGV4cGVjdCh4KS50by5kZWVwLmVxdWFsKGFycmF5KTtcblx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoYXJyYXkpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwibGluc3BhY2VcIiwgZnVuY3Rpb24oKXtcblx0XHRpdChcIkhhcyBsZW5ndGggb2YgNTAgd2l0aCBkZWZhdWx0IGFyZ3VtZW50c1wiLCBmdW5jdGlvbigpe1xuXHRcdFx0ZXhwZWN0KChjb250ZXh0LmxpbnNwYWNlKDAsIDEpKS5sZW5ndGgpLnRvLmVxdWFsKDUwKTtcblx0XHR9KTtcblx0XHRpdChcIkhhcyB0aGUgc3BlY2lmaWVkIG51bWJlciBvZiBzYW1wbGVzXCIsIGZ1bmN0aW9uKCl7XG5cdFx0XHRleHBlY3QoKGNvbnRleHQubGluc3BhY2UoMCwgMSwgMjQzKSkubGVuZ3RoKS50by5lcXVhbCgyNDMpO1xuXHRcdH0pO1xuXHRcdGl0KFwiSGFzIGV4cGVjdGVkIHZhbHVlc1wiLCBmdW5jdGlvbihkb25lKXtcblx0XHRcdHZhciBzdGFydCA9IDUwO1xuXHRcdFx0dmFyIHN0b3AgPSA5OTtcblx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZShzdGFydCwgc3RvcCk7XG5cdFx0XHR4LmdldChmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCByZXN1bHQubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0W2ldKS50by5lcXVhbChzdGFydCtpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRkZXNjcmliZShcIndpdGggaW5jbHVkZVN0b3AgPT09IGZhbHNlXCIsIGZ1bmN0aW9uKCl7XG5cdFx0XHRpdChcIkhhcyB0aGUgc3BlY2lmaWVkIG51bWJlciBvZiBzYW1wbGVzXCIsIGZ1bmN0aW9uKCl7XG5cdFx0XHRcdGV4cGVjdCgoY29udGV4dC5saW5zcGFjZSgwLCAxLCAyNDMsIGZhbHNlKSkubGVuZ3RoKS50by5lcXVhbCgyNDMpO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkRvZXMgbm90IGNvbnRhaW4gdGhlIHJpZ2h0IGVuZHBvaW50XCIsIGZ1bmN0aW9uKGRvbmUpe1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoLTEsIDEsIDEwMDAsIGZhbHNlKTtcblx0XHRcdFx0eC5nZXQoZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdFtyZXN1bHQubGVuZ3RoIC0gMV0pLnRvLm5vdC5lcXVhbCgxKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcIm5lZ1wiLCBmdW5jdGlvbigpIHtcblx0XHR2YXIgeFJlZiA9IFsgMSwgLTcuNSwgIDAsIC0xNV07XG5cdFx0dmFyIHlSZWYgPSBbLTEsICA3LjUsIC0wLCAgMTVdO1xuXHRcdHZhciBkYXRhVHlwZXMgPSBbXCJmMzJcIiwgXCJmNjRcIl07XG5cblx0XHRkZXNjcmliZShcIldpdGggbm8gb3V0cHV0IGFycmF5IHN1cHBsaWVkXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIHNoYXBlIGFzIGlucHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyhbMiwgMywgNF0pO1xuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQubmVnKHgpO1xuXHRcdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMywgNF0pO1xuXHRcdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggdGhlIHNhbWUgZGF0YSB0eXBlIGFzIGlucHV0IGFycmF5IChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0Lm5lZyh4KTtcblx0XHRcdFx0XHRcdGV4cGVjdCh5LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpKS50by5iZS50cnVlO1xuXHRcdFx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xuXHRcdFx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCBuZWdhdGVkIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5uZWcoeCk7XG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKHlSZWYpO1xuXHRcdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRkZXNjcmliZShcIldpdGggYW4gb3V0cHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJQb3B1bGF0ZXMgdGhlIG91dHB1dCBhcnJheSB3aXRoIG5lZ2F0ZWQgZWxlbWVudHMgKFwiICsgZGF0YVR5cGUgKyBcIiBkYXRhIHR5cGUpXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0Lm9uZXMoeC5zaGFwZSwgeC5kYXRhVHlwZSk7XG5cdFx0XHRcdFx0XHRjb250ZXh0Lm5lZyh4LCB5KTtcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoeVJlZik7XG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJhYnNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHhSZWYgPSBbMSwgLTcuNSwgMCwgLTE1XTtcblx0XHR2YXIgeVJlZiA9IFsxLCAgNy41LCAwLCAgMTVdO1xuXHRcdHZhciBkYXRhVHlwZXMgPSBbXCJmMzJcIiwgXCJmNjRcIl07XG5cblx0XHRkZXNjcmliZShcIldpdGggbm8gb3V0cHV0IGFycmF5IHN1cHBsaWVkXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIHNoYXBlIGFzIGlucHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyhbMiwgMywgNF0pO1xuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuYWJzKHgpO1xuXHRcdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMywgNF0pO1xuXHRcdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggdGhlIHNhbWUgZGF0YSB0eXBlIGFzIGlucHV0IGFycmF5IChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFicyh4KTtcblx0XHRcdFx0XHRcdGV4cGVjdCh5LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpKS50by5iZS50cnVlO1xuXHRcdFx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xuXHRcdFx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCBhYnNvbHV0ZSB2YWx1ZXMgb2YgZWxlbWVudHMgKFwiICsgZGF0YVR5cGUgKyBcIiBkYXRhIHR5cGUpXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFicyh4KTtcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoeVJlZik7XG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGRlc2NyaWJlKFwiV2l0aCBhbiBvdXRwdXQgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIlBvcHVsYXRlcyB0aGUgb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5vbmVzKHguc2hhcGUsIHguZGF0YVR5cGUpO1xuXHRcdFx0XHRcdFx0Y29udGV4dC5hYnMoeCwgeSk7XG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKHlSZWYpO1xuXHRcdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwiZXhwXCIsIGZ1bmN0aW9uKCkge1xuXHRcdHZhciB4UmVmID0gWzEsIC0xLCAwXTtcblx0XHR2YXIgZGF0YVR5cGVzID0gW1wiZjMyXCIsIFwiZjY0XCJdO1xuXG5cdFx0ZGVzY3JpYmUoXCJXaXRoIG5vIG91dHB1dCBhcnJheSBzdXBwbGllZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCB0aGUgc2FtZSBzaGFwZSBhcyBpbnB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0Lm9uZXMoWzIsIDMsIDRdKTtcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmV4cCh4KTtcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDMsIDRdKTtcblx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEgdHlwZSBhcyBpbnB1dCBhcnJheSAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5leHAoeCk7XG5cdFx0XHRcdFx0XHRleHBlY3QoeS5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKSkudG8uYmUudHJ1ZTtcblx0XHRcdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5leHAoeCk7XG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgeS5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0XHRcdGV4cGVjdCh5W2tdKS50by5iZS5jbG9zZVRvKE1hdGguZXhwKHhSZWZba10pLCBNYXRoLmV4cCh4UmVmW2tdKSAqIDMgKiB4LmRhdGFUeXBlLmVwc2lsb24pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGRlc2NyaWJlKFwiV2l0aCBhbiBvdXRwdXQgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIlBvcHVsYXRlcyB0aGUgb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5vbmVzKHguc2hhcGUsIHguZGF0YVR5cGUpO1xuXHRcdFx0XHRcdFx0Y29udGV4dC5leHAoeCwgeSk7XG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgeS5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0XHRcdGV4cGVjdCh5W2tdKS50by5iZS5jbG9zZVRvKE1hdGguZXhwKHhSZWZba10pLCBNYXRoLmV4cCh4UmVmW2tdKSAqIDMgKiB4LmRhdGFUeXBlLmVwc2lsb24pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJsb2dcIiwgZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHhSZWYgPSBbMSwgMywgMTBdO1xuXHRcdHZhciBkYXRhVHlwZXMgPSBbXCJmMzJcIiwgXCJmNjRcIl07XG5cblx0XHRkZXNjcmliZShcIldpdGggbm8gb3V0cHV0IGFycmF5IHN1cHBsaWVkXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIHNoYXBlIGFzIGlucHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyhbMiwgMywgNF0pO1xuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQubG9nKHgpO1xuXHRcdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMywgNF0pO1xuXHRcdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggdGhlIHNhbWUgZGF0YSB0eXBlIGFzIGlucHV0IGFycmF5IChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmxvZyh4KTtcblx0XHRcdFx0XHRcdGV4cGVjdCh5LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpKS50by5iZS50cnVlO1xuXHRcdFx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xuXHRcdFx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCBhYnNvbHV0ZSB2YWx1ZXMgb2YgZWxlbWVudHMgKFwiICsgZGF0YVR5cGUgKyBcIiBkYXRhIHR5cGUpXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmxvZyh4KTtcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCB5Lmxlbmd0aDsgaysrKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZXhwZWN0KHlba10pLnRvLmJlLmNsb3NlVG8oTWF0aC5sb2coeFJlZltrXSksIE1hdGgubG9nKHhSZWZba10pICogMyAqIHguZGF0YVR5cGUuZXBzaWxvbik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0ZGVzY3JpYmUoXCJXaXRoIGFuIG91dHB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xuXHRcdFx0XHRcdGl0KFwiUG9wdWxhdGVzIHRoZSBvdXRwdXQgYXJyYXkgd2l0aCBhYnNvbHV0ZSB2YWx1ZXMgb2YgZWxlbWVudHMgKFwiICsgZGF0YVR5cGUgKyBcIiBkYXRhIHR5cGUpXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0Lm9uZXMoeC5zaGFwZSwgeC5kYXRhVHlwZSk7XG5cdFx0XHRcdFx0XHRjb250ZXh0LmxvZyh4LCB5KTtcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCB5Lmxlbmd0aDsgaysrKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZXhwZWN0KHlba10pLnRvLmJlLmNsb3NlVG8oTWF0aC5sb2coeFJlZltrXSksIE1hdGgubG9nKHhSZWZba10pICogMyAqIHguZGF0YVR5cGUuZXBzaWxvbik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcInNxcnRcIiwgZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHhSZWYgPSBbMCwgMC4yNSwgMSwgOSwgMTBdO1xuXHRcdHZhciBkYXRhVHlwZXMgPSBbXCJmMzJcIiwgXCJmNjRcIl07XG5cblx0XHRkZXNjcmliZShcIldpdGggbm8gb3V0cHV0IGFycmF5IHN1cHBsaWVkXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIHNoYXBlIGFzIGlucHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyhbMiwgMywgNF0pO1xuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuc3FydCh4KTtcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDMsIDRdKTtcblx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEgdHlwZSBhcyBpbnB1dCBhcnJheSAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5zcXJ0KHgpO1xuXHRcdFx0XHRcdFx0ZXhwZWN0KHkuZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSkpLnRvLmJlLnRydWU7XG5cdFx0XHRcdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIGFic29sdXRlIHZhbHVlcyBvZiBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuc3FydCh4KTtcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCB5Lmxlbmd0aDsgaysrKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZXhwZWN0KHlba10pLnRvLmJlLmNsb3NlVG8oTWF0aC5zcXJ0KHhSZWZba10pLCBNYXRoLnNxcnQoeFJlZltrXSkgKiAzICogeC5kYXRhVHlwZS5lcHNpbG9uKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRkZXNjcmliZShcIldpdGggYW4gb3V0cHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJQb3B1bGF0ZXMgdGhlIG91dHB1dCBhcnJheSB3aXRoIGFic29sdXRlIHZhbHVlcyBvZiBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQub25lcyh4LnNoYXBlLCB4LmRhdGFUeXBlKTtcblx0XHRcdFx0XHRcdGNvbnRleHQuc3FydCh4LCB5KTtcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCB5Lmxlbmd0aDsgaysrKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZXhwZWN0KHlba10pLnRvLmJlLmNsb3NlVG8oTWF0aC5zcXJ0KHhSZWZba10pLCBNYXRoLnNxcnQoeFJlZltrXSkgKiAzICogeC5kYXRhVHlwZS5lcHNpbG9uKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwic3F1YXJlXCIsIGZ1bmN0aW9uKCkge1xuXHRcdHZhciB4UmVmID0gWy0yLCAwLCAwLjUsIDEsIDNdO1xuXHRcdHZhciBkYXRhVHlwZXMgPSBbXCJmMzJcIiwgXCJmNjRcIl07XG5cblx0XHRkZXNjcmliZShcIldpdGggbm8gb3V0cHV0IGFycmF5IHN1cHBsaWVkXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIHNoYXBlIGFzIGlucHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyhbMiwgMywgNF0pO1xuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuc3F1YXJlKHgpO1xuXHRcdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMywgNF0pO1xuXHRcdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggdGhlIHNhbWUgZGF0YSB0eXBlIGFzIGlucHV0IGFycmF5IChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LnNxdWFyZSh4KTtcblx0XHRcdFx0XHRcdGV4cGVjdCh5LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpKS50by5iZS50cnVlO1xuXHRcdFx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xuXHRcdFx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCBhYnNvbHV0ZSB2YWx1ZXMgb2YgZWxlbWVudHMgKFwiICsgZGF0YVR5cGUgKyBcIiBkYXRhIHR5cGUpXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LnNxdWFyZSh4KTtcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCB5Lmxlbmd0aDsgaysrKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZXhwZWN0KHlba10pLnRvLmJlLmNsb3NlVG8oeFJlZltrXSAqIHhSZWZba10sIHhSZWZba10gKiB4UmVmW2tdICogeC5kYXRhVHlwZS5lcHNpbG9uKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRkZXNjcmliZShcIldpdGggYW4gb3V0cHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJQb3B1bGF0ZXMgdGhlIG91dHB1dCBhcnJheSB3aXRoIGFic29sdXRlIHZhbHVlcyBvZiBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQub25lcyh4LnNoYXBlLCB4LmRhdGFUeXBlKTtcblx0XHRcdFx0XHRcdGNvbnRleHQuc3F1YXJlKHgsIHkpO1xuXHRcdFx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBrID0gMDsgayA8IHkubGVuZ3RoOyBrKyspIHtcblx0XHRcdFx0XHRcdFx0XHRleHBlY3QoeVtrXSkudG8uYmUuY2xvc2VUbyh4UmVmW2tdICogeFJlZltrXSwgeFJlZltrXSAqIHhSZWZba10gKiB4LmRhdGFUeXBlLmVwc2lsb24pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIiwidmFyIGZ1cmlvdXMgPSByZXF1aXJlKFwiLi4vbGliL2Z1cmlvdXMuanNcIik7XG52YXIgZXhwZWN0ID0gcmVxdWlyZShcImNoYWlcIikuZXhwZWN0O1xuXG5kZXNjcmliZShcIkRhdGFUeXBlXCIsIGZ1bmN0aW9uKCl7XG5cdGRlc2NyaWJlKFwiZjMyXCIsIGZ1bmN0aW9uKCl7XG5cdFx0aXQoXCJzaG91bGQgaGF2ZSBzaXplIDRcIiwgZnVuY3Rpb24oKXtcblx0XHRcdHZhciBkdHlwZSA9IG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjMyXCIpO1xuXHRcdFx0ZXhwZWN0KGR0eXBlLnNpemUpLnRvLmVxdWFsKDQpO1xuXHRcdH0pO1xuXG5cdFx0aXQoXCJzaG91bGQgaGF2ZSB0eXBlIFxcXCJmMzJcXFwiXCIsIGZ1bmN0aW9uKCl7XG5cdFx0XHR2YXIgZHR5cGUgPSBuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKTtcblx0XHRcdGV4cGVjdChkdHlwZS50eXBlKS50by5lcXVhbChcImYzMlwiKTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwiZjY0XCIsIGZ1bmN0aW9uKCl7XG5cdFx0aXQoXCJzaG91bGQgaGF2ZSBzaXplIDhcIiwgZnVuY3Rpb24oKXtcblx0XHRcdHZhciBkdHlwZSA9IG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpO1xuXHRcdFx0ZXhwZWN0KGR0eXBlLnNpemUpLnRvLmVxdWFsKDgpO1xuXHRcdH0pO1xuXG5cdFx0aXQoXCJzaG91bGQgaGF2ZSB0eXBlIFxcXCJmNjRcXFwiXCIsIGZ1bmN0aW9uKCl7XG5cdFx0XHR2YXIgZHR5cGUgPSBuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKTtcblx0XHRcdGV4cGVjdChkdHlwZS50eXBlKS50by5lcXVhbChcImY2NFwiKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiIsInZhciBmdXJpb3VzID0gcmVxdWlyZShcIi4uL2xpYi9mdXJpb3VzLmpzXCIpO1xudmFyIGV4cGVjdCA9IHJlcXVpcmUoXCJjaGFpXCIpLmV4cGVjdDtcblxudmFyIGNvbnRleHQgPSBudWxsO1xuYmVmb3JlKGZ1bmN0aW9uKGRvbmUpIHtcblx0ZnVyaW91cy5pbml0KGZ1bmN0aW9uKGN0eCkge1xuXHRcdGNvbnRleHQgPSBjdHg7XG5cdFx0ZG9uZSgpO1xuXHR9KTtcbn0pO1xuXG5kZXNjcmliZShcIk5EQXJyYXlcIiwgZnVuY3Rpb24oKSB7XG5cdGRlc2NyaWJlKFwibGVuZ3RoXCIsIGZ1bmN0aW9uKCkge1xuXHRcdGl0KFwiRXF1YWxzIHRvIHRoZSBudW1iZXIgcGFzc2VkIGluIGNvbnN0cnVjdG9yXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KDQyKTtcblx0XHRcdGV4cGVjdCh4Lmxlbmd0aCkudG8uZXF1YWwoNDIpO1xuXHRcdFx0eC5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJFcXVhbHMgdG8gdGhlIG51bWJlciBwYXNzZWQgaW4gY29uc3RydWN0b3IgYXMgYW4gYXJyYXlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuZW1wdHkoWzQyXSk7XG5cdFx0XHRleHBlY3QoeC5sZW5ndGgpLnRvLmVxdWFsKDQyKTtcblx0XHRcdHguaW52YWxpZGF0ZSgpO1xuXHRcdH0pO1xuXHRcdGl0KFwiRXF1YWxzIHRvIHRoZSBwcm9kdWN0IG9mIGRpbWVuc2lvbnNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuZW1wdHkoWzIsIDUsIDNdKTtcblx0XHRcdGV4cGVjdCh4Lmxlbmd0aCkudG8uZXF1YWwoMzApO1xuXHRcdFx0eC5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcInJlc2hhcGVcIiwgZnVuY3Rpb24oKSB7XG5cdFx0aXQoXCJQcmVzZXJ2ZXMgbGVuZ3RoXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KFs3LDUsM10pO1xuXHRcdFx0dmFyIHkgPSB4LnJlc2hhcGUoWzIxLDVdKTtcblx0XHRcdGV4cGVjdCh5Lmxlbmd0aCkudG8uZXF1YWwoeC5sZW5ndGgpO1xuXHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJDaGFuZ2VzIHNoYXBlXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KFs3LDUsM10pO1xuXHRcdFx0dmFyIHkgPSB4LnJlc2hhcGUoWzIxLDVdKTtcblx0XHRcdGV4cGVjdCh5LnNoYXBlKS50by5kZWVwLmVxdWFsKFsyMSw1XSk7XG5cdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHR9KTtcblx0XHRpdChcIlJlYXJyYW5nZXMgZGF0YVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgOCwgOCkucmVzaGFwZShbMiwgMiwgMl0pO1xuXHRcdFx0eC5nZXQoZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1tbIDEsICAyXSwgWyAzLCAgNF1dLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgW1sgNSwgIDZdLCBbIDcsICA4XV1dKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcInJlcGVhdFwiLCBmdW5jdGlvbigpIHtcblx0XHRpdChcIlJlcGVhdHMgYXJyYXkgZWxlbWVudHMgYWxvbmcgYXhpcyAwXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzgsIDEsIDZdLFxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbMywgNSwgN10sXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgICAgIFs0LCA5LCAyXV0pO1xuXHRcdFx0eC5yZXBlYXQoMiwgMCkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1s4LCAxLCA2XSxcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFs4LCAxLCA2XSxcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFszLCA1LCA3XSxcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFszLCA1LCA3XSxcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFs0LCA5LCAyXSxcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFs0LCA5LCAyXV0pO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRpdChcIlJlcGVhdHMgYXJyYXkgZWxlbWVudHMgYWxvbmcgYXhpcyAxXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzgsIDEsIDZdLFxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbMywgNSwgN10sXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgICAgIFs0LCA5LCAyXV0pO1xuXHRcdFx0eC5yZXBlYXQoMiwgMSkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1s4LCA4LCAxLCAxLCA2LCA2XSxcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFszLCAzLCA1LCA1LCA3LCA3XSxcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFs0LCA0LCA5LCA5LCAyLCAyXV0pO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwiZ2V0XCIsIGZ1bmN0aW9uKCl7XG5cdFx0aXQoXCJXb3JrcyB3aXRoIDEtZGltZW5zaW9uYWwgYXJyYXlcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFs0MiwgMTBdKTtcblx0XHRcdHguZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoWzQyLCAxMF0pO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRpdChcIldvcmtzIHdpdGggMi1kaW1lbnNpb25hbCBhcnJheVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHR2YXIgYXJyYXkgPSBbWzE2LCAgMiwgIDMsIDEzLCAgNV0sXG5cdFx0XHRcdFx0XHQgWzExLCAxMCwgIDgsICA5LCAgN10sXG5cdFx0XHRcdFx0XHQgWyA2LCAxMiwgIDQsIDE0LCAxNV1dO1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KGFycmF5KTtcblx0XHRcdHguZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoYXJyYXkpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwiYWRkXCIsIGZ1bmN0aW9uKCkge1xuXHRcdGRlc2NyaWJlKFwiQWRkIGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KFs4LCAtMSwgMTBdKTtcblx0XHRcdFx0dmFyIHogPSB4LmFkZCh5KTtcblx0XHRcdFx0ei5nZXQoZnVuY3Rpb24oeikge1xuXHRcdFx0XHRcdGV4cGVjdCh6KS50by5kZWVwLmVxdWFsKFs5LCAzLCAxOV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWzgsIC0xXSwgWzEwLCAtMjFdXSk7XG5cdFx0XHRcdHZhciB6ID0geC5hZGQoeSk7XG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1s5LCAzXSwgWzE5LCAtMzhdXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdGRlc2NyaWJlKFwiQWRkIHNjYWxhclwiLCBmdW5jdGlvbigpe1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcblx0XHRcdFx0dmFyIHogPSB4LmFkZCgtNyk7XG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHopIHtcblx0XHRcdFx0XHRleHBlY3QoeikudG8uZGVlcC5lcXVhbChbLTYsIC0zLCAyXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1sxLCA0XSwgWzksIC0xN11dKTtcblx0XHRcdFx0dmFyIHogPSB4LmFkZCg0Mik7XG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHopIHtcblx0XHRcdFx0XHRleHBlY3QoeikudG8uZGVlcC5lcXVhbChbWzQzLCA0Nl0sIFs1MSwgMjVdXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJzdWJcIiwgZnVuY3Rpb24oKSB7XG5cdFx0ZGVzY3JpYmUoXCJTdWJ0cmFjdCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbOCwgLTEsIDEwXSk7XG5cdFx0XHRcdHZhciB6ID0geC5zdWIoeSk7XG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoWy03LCA1LCAtMV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWzgsIC0xXSwgWzEwLCAtMjFdXSk7XG5cdFx0XHRcdHZhciB6ID0geC5zdWIoeSk7XG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1stNywgNV0sIFstMSwgNF1dKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0ZGVzY3JpYmUoXCJTdWJ0cmFjdCBzY2FsYXJcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xuXHRcdFx0XHR2YXIgeSA9IHguc3ViKC03KTtcblx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFs4LCAxMSwgMTZdKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAyLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzEsIDRdLCBbOSwgLTE3XV0pO1xuXHRcdFx0XHR2YXIgeSA9IHguc3ViKDQyKTtcblx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFtbLTQxLCAtMzhdLCBbLTMzLCAtNTldXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJtdWxcIiwgZnVuY3Rpb24oKSB7XG5cdFx0ZGVzY3JpYmUoXCJNdWx0aXBseSBieSBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbOCwgLTEsIDEwXSk7XG5cdFx0XHRcdHZhciB6ID0geC5tdWwoeSk7XG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHopIHtcblx0XHRcdFx0XHRleHBlY3QoeikudG8uZGVlcC5lcXVhbChbOCwgLTQsIDkwXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1sxLCA0XSwgWzksIC0xN11dKTtcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KFtbOCwgLTFdLCBbMTAsIC0yMV1dKTtcblx0XHRcdFx0dmFyIHogPSB4Lm11bCh5KTtcblx0XHRcdFx0ei5nZXQoZnVuY3Rpb24oeikge1xuXHRcdFx0XHRcdGV4cGVjdCh6KS50by5kZWVwLmVxdWFsKFtbOCwgLTRdLCBbOTAsIDM1N11dKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0ZGVzY3JpYmUoXCJNdWx0aXBseSBieSBzY2FsYXJcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xuXHRcdFx0XHR2YXIgeSA9IHgubXVsKC0xMCk7XG5cdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbLTEwLCAtNDAsIC05MF0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XG5cdFx0XHRcdHZhciB5ID0geC5tdWwoMTApO1xuXHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1sxMCwgNDBdLCBbOTAsIC0xNzBdXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJkaXZcIiwgZnVuY3Rpb24oKXtcblx0XHRkZXNjcmliZShcIkRpdmlkZSBieSBhcnJheVwiLCBmdW5jdGlvbigpe1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KFsyLCAtNCwgOF0pO1xuXHRcdFx0XHR2YXIgeiA9IHguZGl2KHkpO1xuXHRcdFx0XHR6LmdldChmdW5jdGlvbih6KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHopLnRvLmRlZXAuZXF1YWwoWzAuNSwgLTEsIDEuMTI1XSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1sxLCA0XSwgWzksIC0xN11dKTtcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KFtbLTIsIDRdLCBbLTgsIDE2XV0pO1xuXHRcdFx0XHR2YXIgeiA9IHguZGl2KHkpO1xuXHRcdFx0XHR6LmdldChmdW5jdGlvbih6KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHopLnRvLmRlZXAuZXF1YWwoW1stMC41LCAxXSwgWy0xLjEyNSwgLTEuMDYyNV1dKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0ZGVzY3JpYmUoXCJEaXZpZGUgYnkgc2NhbGFyXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xuXHRcdFx0XHR2YXIgeSA9IHguZGl2KC0yKTtcblx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFstMC41LCAtMiwgLTQuNV0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzEsIDRdLCBbOSwgLTE3XV0pO1xuXHRcdFx0XHR2YXIgeSA9IHguZGl2KC00KTtcblx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFtbLTAuMjUsIC0xXSwgWy0yLjI1LCA0LjI1XV0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJtaW5cIiwgZnVuY3Rpb24oKXtcblx0XHRkZXNjcmliZShcIkFsbCBlbGVtZW50c1wiLCBmdW5jdGlvbigpe1xuXHRcdFx0aXQoXCJSZXR1cm5zIHplcm8tZGltZW5zaW9uYWwgYXJyYXkgb2YgbGVuZ3RoIG9uZVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0Lnplcm9zKFsyMCwgMzBdKTtcblx0XHRcdFx0dmFyIHkgPSB4Lm1pbigpO1xuXHRcdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbXSk7XG5cdFx0XHRcdGV4cGVjdCh5Lmxlbmd0aCkudG8uZXF1YWwoMSk7XG5cdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkNvbXB1dGVzIHRoZSBtaW5pbXVtIG9mIGFsbCBlbGVtZW50cyBpbiBhbiBhcnJheVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgtNTAsIDEwMCwgMTAwMDAwKS5yZXNoYXBlKFsyMDAsIDUwMF0pO1xuXHRcdFx0XHR4Lm1pbigpLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmVxdWFsKC01MCk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdGRlc2NyaWJlKFwiQWxvbmcgYW4gYXhpc1wiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ29ycmVjdCBzaGFwZSBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKS5sb2NrKCk7XG5cdFx0XHRcdGV4cGVjdCh4Lm1pbigwKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMywgNF0pO1xuXHRcdFx0XHRleHBlY3QoeC5taW4oMSkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDRdKTtcblx0XHRcdFx0ZXhwZWN0KHgubWluKDIpLnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAzXSk7XG5cdFx0XHRcdHguaW52YWxpZGF0ZSgpO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAzLWRpbWVuc2lvbmFsIGFycmF5cywgYXhpcyAwXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pO1xuXHRcdFx0XHR4Lm1pbigwKS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFtbIDEsICAyLCAgMywgIDRdLFxuXHRcdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbIDUsICA2LCAgNywgIDhdLFxuXHRcdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbIDksIDEwLCAxMSwgMTJdXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKTtcblx0XHRcdFx0eC5taW4oMSkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbWyAgMSwgIDIsICAzLCAgNF0sXG5cdFx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsgMTMsIDE0LCAxNSwgMTZdXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMlwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKTtcblx0XHRcdFx0eC5taW4oMikuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbWyAgMSwgIDUsICA5XSxcblx0XHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWyAxMywgMTcsIDIxXV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwibWF4XCIsIGZ1bmN0aW9uKCkge1xuXHRcdGRlc2NyaWJlKFwiQWxsIGVsZW1lbnRzXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJSZXR1cm5zIHplcm8tZGltZW5zaW9uYWwgYXJyYXkgb2YgbGVuZ3RoIG9uZVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0Lnplcm9zKFsyMCwgMzBdKTtcblx0XHRcdFx0dmFyIHkgPSB4Lm1heCgpO1xuXHRcdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbXSk7XG5cdFx0XHRcdGV4cGVjdCh5Lmxlbmd0aCkudG8uZXF1YWwoMSk7XG5cdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkNvbXB1dGVzIHRoZSBtYXhpbXVtIG9mIGFsbCBlbGVtZW50cyBpbiBhbiBhcnJheVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgtNTAsIDEwMCwgMTAwMDAwKS5yZXNoYXBlKFsyMDAsIDUwMF0pO1xuXHRcdFx0XHR4Lm1heCgpLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmVxdWFsKDEwMCk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdGRlc2NyaWJlKFwiQWxvbmcgYW4gYXhpc1wiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ29ycmVjdCBzaGFwZSBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKS5sb2NrKCk7XG5cdFx0XHRcdGV4cGVjdCh4Lm1heCgwKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMywgNF0pO1xuXHRcdFx0XHRleHBlY3QoeC5tYXgoMSkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDRdKTtcblx0XHRcdFx0ZXhwZWN0KHgubWF4KDIpLnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAzXSk7XG5cdFx0XHRcdHguaW52YWxpZGF0ZSgpO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAzLWRpbWVuc2lvbmFsIGFycmF5cywgYXhpcyAwXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pO1xuXHRcdFx0XHR4Lm1heCgwKS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFtbIDEzLCAxNCwgMTUsIDE2XSxcblx0XHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWyAxNywgMTgsIDE5LCAyMF0sXG5cdFx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsgMjEsIDIyLCAyMywgMjRdXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKTtcblx0XHRcdFx0eC5tYXgoMSkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbWyAgOSwgMTAsIDExLCAxMl0sXG5cdFx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsgMjEsIDIyLCAyMywgMjRdXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMlwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKTtcblx0XHRcdFx0eC5tYXgoMikuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbWyAgNCwgIDgsIDEyXSxcblx0XHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWyAxNiwgMjAsIDI0XV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwic3VtXCIsIGZ1bmN0aW9uKCkge1xuXHRcdGRlc2NyaWJlKFwiQWxsIGVsZW1lbnRzXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJSZXR1cm5zIHplcm8tZGltZW5zaW9uYWwgYXJyYXkgb2YgbGVuZ3RoIG9uZVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0Lnplcm9zKFsyMCwgMzBdKTtcblx0XHRcdFx0dmFyIHkgPSB4LnN1bSgpO1xuXHRcdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbXSk7XG5cdFx0XHRcdGV4cGVjdCh5Lmxlbmd0aCkudG8uZXF1YWwoMSk7XG5cdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkNvbXB1dGVzIHRoZSBzdW0gb2YgYWxsIGVsZW1lbnRzIGluIGFuIGFycmF5XCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDEwMDAwMCwgMTAwMDAwKS5yZXNoYXBlKFsyMDAsIDUwMF0pO1xuXHRcdFx0XHR4LnN1bSgpLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmVxdWFsKDUwMDAwNTAwMDApO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRkZXNjcmliZShcIkFsb25nIGFuIGF4aXNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRpdChcIkNvcnJlY3Qgc2hhcGUgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSkubG9jaygpO1xuXHRcdFx0XHRleHBlY3QoeC5zdW0oMCkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzMsIDRdKTtcblx0XHRcdFx0ZXhwZWN0KHguc3VtKDEpLnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCA0XSk7XG5cdFx0XHRcdGV4cGVjdCh4LnN1bSgyKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgM10pO1xuXHRcdFx0XHR4LmludmFsaWRhdGUoKTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMFwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKTtcblx0XHRcdFx0eC5zdW0oMCkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbWyAxNCwgMTYsIDE4LCAyMF0sXG5cdFx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsgMjIsIDI0LCAyNiwgMjhdLFxuXHRcdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbIDMwLCAzMiwgMzQsIDM2XV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzLCBheGlzIDFcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XG5cdFx0XHRcdHguc3VtKDEpLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1sgMTUsICAxOCwgIDIxLCAgMjRdLFxuXHRcdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbIDUxLCAgNTQsICA1NywgIDYwXV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzLCBheGlzIDJcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XG5cdFx0XHRcdHguc3VtKDIpLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1sgMTAsICAyNiwgIDQyXSxcblx0XHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWyA1OCwgIDc0LCAgOTBdXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJkb3RcIiwgZnVuY3Rpb24oKSB7XG5cdFx0aXQoXCJDb3JyZWN0IHNoYXBlIGZvciAyLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eShbMiwgNV0pO1xuXHRcdFx0dmFyIHkgPSBjb250ZXh0LmVtcHR5KFs1LCAxMV0pO1xuXHRcdFx0dmFyIHogPSBjb250ZXh0LmRvdCh4LCB5KTtcblx0XHRcdGV4cGVjdCh6LnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAxMV0pO1xuXHRcdFx0ei5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJDb3JyZWN0IHNoYXBlIGZvciAzLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eShbMiwgMywgNF0pO1xuXHRcdFx0dmFyIHkgPSBjb250ZXh0LmVtcHR5KFs3LCA0LCA4XSk7XG5cdFx0XHR2YXIgeiA9IGNvbnRleHQuZG90KHgsIHkpO1xuXHRcdFx0ZXhwZWN0KHouc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDMsIDcsIDhdKTtcblx0XHRcdHouaW52YWxpZGF0ZSgpO1xuXHRcdH0pO1xuXHRcdGl0KFwiQ29ycmVjdCBzaGFwZSBmb3IgNC1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuZW1wdHkoWzIsIDMsIDQsIDVdKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC5lbXB0eShbNiwgNywgNSwgOF0pO1xuXHRcdFx0dmFyIHogPSBjb250ZXh0LmRvdCh4LCB5KTtcblx0XHRcdGV4cGVjdCh6LnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAzLCA0LCA2LCA3LCA4XSk7XG5cdFx0XHR6LmludmFsaWRhdGUoKTtcblx0XHR9KTtcblx0XHRpdChcIkNvcnJlY3QgdmFsdWUgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMiwgNV0pO1xuXHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KFs1LCAxMV0pO1xuXHRcdFx0Y29udGV4dC5kb3QoeCwgeSkuZ2V0KGZ1bmN0aW9uKHopIHtcblx0XHRcdFx0ZXhwZWN0KHopLnRvLmRlZXAuZXF1YWwoNjUpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRpdChcIkNvcnJlY3QgdmFsdWUgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzY0LCAgMiwgIDNdLFxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbNjEsIDYwLCAgNl1dKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWzkyLCA5OSwgIDEsICA4LCAxNV0sXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgICAgIFs2NywgNzQsIDUxLCA1OCwgNDBdLFxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbOTgsIDgwLCAgNywgMTQsIDE2XV0pO1xuXHRcdFx0dmFyIHogPSBjb250ZXh0LmRvdCh4LCB5KTtcblx0XHRcdHouZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbICA2MzE2LCAgNjcyNCwgIDE4NywgIDY3MCwgMTA4OF0sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsgMTAyMjAsIDEwOTU5LCAzMTYzLCA0MDUyLCAzNDExXV0pO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdfQ==
