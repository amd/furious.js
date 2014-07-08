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
function JSContext(callback) {
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
	this._pnaclObject.data = scriptDirectory + "furious.nmf";
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
 * @param {Function} callback - A callback function that is called when the backend finish initialization.
 * @param {Context} callback.context - A ready to use computational context.
 */
var init = function(backend, callback) {
	if (typeof callback === "undefined") {
		callback = backend;
		backend = undefined;
	}
	if (typeof backend == "undefined") {
		backend = getDefaultBackend();
	}
	if (backend == "javascript") {
		return new JSContext(callback);
	} else if (backend == "pnacl") {
		return new PNaClContext(callback);
	} else if (backend == "webcl") {
		return new WebCLContext(callback);
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
 *             <td>Detect if the browser supports WebGL (either experimental or stable implementation)</td>
 *         </tr>
 *         <tr>
 *             <td>"webcl"</td>
 *             <td>Detect if the browser supports WebCL</td>
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
				for (var component in userAgentComponents) {
					var match = firefoxRegexp.exec(component);
					if (match !== null) {
						var firefoxVersion = parseInt(match[0]);
						return firefoxVersion >= 29;
					}
				}
				return false;
			} catch (e) {
			}
			return false;
		case "simd.js":
			return (typeof SIMD !== "undefined");
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
			if (typeof webcl !== "undefined") {
				try {
					var platforms = webcl.getPlatforms();
					return platforms.length >= 1;
				} catch (e) {
					return false;
				}
			} else {
				try {
					var cl = require("node-webcl");
					var platforms = cl.getPlatforms();
					return platforms.length >= 1;
				} catch (e) {
					return false;
				}
			}
			return false;
		case "pnacl":
			try {
				return (typeof navigator.mimeTypes["application/x-pnacl"]) !== "undefined";
			} catch (e) {
			}
			return false;
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
		var source = "kernel void setF32(\r\n\tuint length,\r\n\tglobal float* out,\r\n\tfloat value)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = value;\r\n\t}\r\n}\r\nkernel void setF64(\r\n\tuint length,\r\n\tglobal double* out,\r\n\tdouble value)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = value;\r\n\t}\r\n}\r\n\r\nkernel void addF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tglobal float* b,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] + b[id];\r\n\t}\r\n}\r\nkernel void addF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tglobal double* b,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] + b[id];\r\n\t}\r\n}\r\nkernel void subF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tglobal float* b,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] - b[id];\r\n\t}\r\n}\r\nkernel void subF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tglobal double* b,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] - b[id];\r\n\t}\r\n}\r\nkernel void mulF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tglobal float* b,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] * b[id];\r\n\t}\r\n}\r\nkernel void mulF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tglobal double* b,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] * b[id];\r\n\t}\r\n}\r\nkernel void divF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tglobal float* b,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] / b[id];\r\n\t}\r\n}\r\nkernel void divF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tglobal double* b,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] / b[id];\r\n\t}\r\n}\r\nkernel void addConstF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tfloat b,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] + b;\r\n\t}\r\n}\r\nkernel void addConstF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tdouble b,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] + b;\r\n\t}\r\n}\r\nkernel void subConstF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tfloat b,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] - b;\r\n\t}\r\n}\r\nkernel void subConstF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tdouble b,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] - b;\r\n\t}\r\n}\r\nkernel void mulConstF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tfloat b,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] * b;\r\n\t}\r\n}\r\nkernel void mulConstF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tdouble b,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] * b;\r\n\t}\r\n}\r\nkernel void divConstF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tfloat b,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] / b;\r\n\t}\r\n}\r\nkernel void divConstF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tdouble b,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = a[id] / b;\r\n\t}\r\n}\r\nkernel void negF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = -a[id];\r\n\t}\r\n}\r\nkernel void negF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = -a[id];\r\n\t}\r\n}\r\nkernel void absF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = fabs(a[id]);\r\n\t}\r\n}\r\nkernel void absF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = fabs(a[id]);\r\n\t}\r\n}\r\nkernel void expF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = exp(a[id]);\r\n\t}\r\n}\r\nkernel void expF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = exp(a[id]);\r\n\t}\r\n}\r\nkernel void logF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = log(a[id]);\r\n\t}\r\n}\r\nkernel void logF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = log(a[id]);\r\n\t}\r\n}\r\nkernel void sqrtF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = sqrt(a[id]);\r\n\t}\r\n}\r\nkernel void sqrtF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tout[id] = sqrt(a[id]);\r\n\t}\r\n}\r\nkernel void squareF32(\r\n\tuint length,\r\n\tglobal float* a,\r\n\tglobal float* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tconst float aVal = a[id]; \r\n\t\tout[id] = aVal * aVal;\r\n\t}\r\n}\r\nkernel void squareF64(\r\n\tuint length,\r\n\tglobal double* a,\r\n\tglobal double* out)\r\n{\r\n\tconst uint id = get_global_id(0);\r\n\tif (id < length) {\r\n\t\tconst double aVal = a[id];\r\n\t\tout[id] = aVal * aVal;\r\n\t}\r\n}\r\n";

		var platforms = cl.getPlatforms();
		var platform = platforms[0];
		var devices = platform.getDevices(cl.DEVICE_TYPE_ALL);
		var device = devices[0];
		context = cl.createContext(device);
		queue = context.createCommandQueue();
		var program = context.createProgram(source);
		try {
			/* Chromium-WebCL requires a list of devices */
			program.build([device]);
		} catch (e) {
			if (e.name === "INVALID_DEVICE") {
				/* Nokia-WebCL only works with no arguments to WebCLProgram.build */
				program.build();
			} else {
				throw e;
			}
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

describe("NDArray", function(){
	describe("length", function(){
		it("Equals to the number passed in constructor", function(){
			expect((context.empty(42)).length).to.equal(42);
		});
		it("Equals to the number passed in constructor as an array", function(){
			expect((context.empty([42])).length).to.equal(42);
		});
		it("Equals to the product of dimensions", function(){
			expect((context.empty([2, 5, 3])).length).to.equal(30);
		});
	});
	describe("reshape", function(){
		it("Preserves length", function(){
			var x = context.empty([7,5,3]);
			var y = x.reshape([21,5]);
			expect(y.length).to.equal(x.length);
		});
		it("Changes shape", function(){
			var x = context.empty([7,5,3]);
			var y = x.reshape([21,5]);
			expect(y.shape).to.deep.equal([21,5]);
		});
		it("Rearranges data", function(done){
			var x = context.linspace(1, 8, 8).reshape([2, 2, 2]);
			x.get(function(result){
				expect(result).to.deep.equal([[[ 1,  2], [ 3,  4]],
											  [[ 5,  6], [ 7,  8]]]);
				done();
			});
		});
	});
	describe("repeat", function(){
		it("Repeats array elements along axis 0", function(done){
			var x = context.array([[8, 1, 6],
			                       [3, 5, 7],
			                       [4, 9, 2]]);
			x.repeat(2, 0).get(function(result) {
				expect(result).to.deep.equal([[8, 1, 6],
				                              [8, 1, 6],
				                              [3, 5, 7],
				                              [3, 5, 7],
				                              [4, 9, 2],
				                              [4, 9, 2]]);
				done();
			});
		});
		it("Repeats array elements along axis 1", function(done){
			var x = context.array([[8, 1, 6],
			                       [3, 5, 7],
			                       [4, 9, 2]]);
			x.repeat(2, 1).get(function(result) {
				expect(result).to.deep.equal([[8, 8, 1, 1, 6, 6],
				                              [3, 3, 5, 5, 7, 7],
				                              [4, 4, 9, 9, 2, 2]]);
				done();
			});
		});
	});
	describe("get", function(){
		it("Works with 1-dimensional array", function(done){
			var x = context.array([42, 10]);
			x.get(function(result){
				expect(result).to.deep.equal([42, 10]);
				done();
			});
		});
		it("Works with 2-dimensional array", function(done){
			var array = [[16,  2,  3, 13,  5],
						 [11, 10,  8,  9,  7],
						 [ 6, 12,  4, 14, 15]];
			var x = context.array(array);
			x.get(function(result){
				expect(result).to.deep.equal(array);
				done();
			});
		});
	});
	describe("add", function(){
		describe("Add array", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = context.array([8, -1, 10]);
				var z = x.add(y);
				z.get(function(result){
					expect(result).to.deep.equal([9, 3, 19]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[8, -1], [10, -21]]);
				var z = x.add(y);
				z.get(function(result){
					expect(result).to.deep.equal([[9, 3], [19, -38]]);
					done();
				});
			});
		});
		describe("Add scalar", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var z = x.add(-7);
				z.get(function(result){
					expect(result).to.deep.equal([-6, -3, 2]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var z = x.add(42);
				z.get(function(result){
					expect(result).to.deep.equal([[43, 46], [51, 25]]);
					done();
				});
			});
		});
	});
	describe("sub", function(){
		describe("Subtract array", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = context.array([8, -1, 10]);
				var z = x.sub(y);
				z.get(function(result){
					expect(result).to.deep.equal([-7, 5, -1]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[8, -1], [10, -21]]);
				var z = x.sub(y);
				z.get(function(result){
					expect(result).to.deep.equal([[-7, 5], [-1, 4]]);
					done();
				});
			});
		});
		describe("Subtract scalar", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = x.sub(-7);
				y.get(function(result){
					expect(result).to.deep.equal([8, 11, 16]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = x.sub(42);
				y.get(function(result){
					expect(result).to.deep.equal([[-41, -38], [-33, -59]]);
					done();
				});
			});
		});
	});
	describe("mul", function(){
		describe("Multiply by array", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = context.array([8, -1, 10]);
				var z = x.mul(y);
				z.get(function(result){
					expect(result).to.deep.equal([8, -4, 90]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[8, -1], [10, -21]]);
				var z = x.mul(y);
				z.get(function(result){
					expect(result).to.deep.equal([[8, -4], [90, 357]]);
					done();
				});
			});
		});
		describe("Multiply by scalar", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = x.mul(-10);
				y.get(function(result){
					expect(result).to.deep.equal([-10, -40, -90]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = x.mul(10);
				y.get(function(result){
					expect(result).to.deep.equal([[10, 40], [90, -170]]);
					done();
				});
			});
		});
	});
	describe("div", function(){
		describe("Divide by array", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = context.array([2, -4, 8]);
				var z = x.div(y);
				z.get(function(result){
					expect(result).to.deep.equal([0.5, -1, 1.125]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[-2, 4], [-8, 16]]);
				var z = x.div(y);
				z.get(function(result){
					expect(result).to.deep.equal([[-0.5, 1], [-1.125, -1.0625]]);
					done();
				});
			});
		});
		describe("Divide by scalar", function(){
			it("Correct result for 1-dimensional arrays", function(){
				var x = context.array([1, 4, 9]);
				var y = x.div(-2);
				y.get(function(result){
					expect(result).to.deep.equal([-0.5, -2, -4.5]);
				});
			});
			it("Correct result for 2-dimensional arrays", function(){
				var x = context.array([[1, 4], [9, -17]]);
				var y = x.div(-4);
				y.get(function(result){
					expect(result).to.deep.equal([[-0.25, -1], [-2.25, 4.25]]);
				});
			});
		});
	});
	describe("min", function(){
		describe("All elements", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				x.min().get(function(result) {
					expect(result).to.equal(1);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[-2, 4], [-8, 16]]);
				x.min().get(function(result) {
					expect(result).to.equal(-8);
					done();
				});
			});
		});
		describe("Along an axis", function(){
			it("Correct shape for 3-dimensional arrays", function(){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]).lock();
				expect(x.min(0).shape).to.deep.equal([3, 4]);
				expect(x.min(1).shape).to.deep.equal([2, 4]);
				expect(x.min(2).shape).to.deep.equal([2, 3]);
				x.invalidate();
			});
			it("Correct result for 3-dimensional arrays, axis 0", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.min(0).get(function(result){
					expect(result).to.deep.equal([[ 1,  2,  3,  4],
												  [ 5,  6,  7,  8],
												  [ 9, 10, 11, 12]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 1", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.min(1).get(function(result){
					expect(result).to.deep.equal([[  1,  2,  3,  4],
												  [ 13, 14, 15, 16]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 2", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.min(2).get(function(result){
					expect(result).to.deep.equal([[  1,  5,  9],
												  [ 13, 17, 21]]);
					done();
				});
			});
		});
	});
	describe("max", function(){
		describe("All elements", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				x.max().get(function(result) {
					expect(result).to.equal(9);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[-2, 4], [-8, 16]]);
				x.max().get(function(result) {
					expect(result).to.equal(16);
					done();
				});
			});
		});
		describe("Along an axis", function(){
			it("Correct shape for 3-dimensional arrays", function(){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]).lock();
				expect(x.max(0).shape).to.deep.equal([3, 4]);
				expect(x.max(1).shape).to.deep.equal([2, 4]);
				expect(x.max(2).shape).to.deep.equal([2, 3]);
				x.invalidate();
			});
			it("Correct result for 3-dimensional arrays, axis 0", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.max(0).get(function(result){
					expect(result).to.deep.equal([[ 13, 14, 15, 16],
												  [ 17, 18, 19, 20],
												  [ 21, 22, 23, 24]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 1", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.max(1).get(function(result){
					expect(result).to.deep.equal([[  9, 10, 11, 12],
												  [ 21, 22, 23, 24]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 2", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.max(2).get(function(result){
					expect(result).to.deep.equal([[  4,  8, 12],
												  [ 16, 20, 24]]);
					done();
				});
			});
		});
	});
	describe("sum", function(){
		describe("All elements", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				x.sum().get(function (result) {
					expect(result).to.equal(14);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[-2, 4], [-8, 16]]);
				x.sum().get(function (result) {
					expect(result).to.equal(10);
					done();
				});
			});
		});
		describe("Along an axis", function(){
			it("Correct shape for 3-dimensional arrays", function(){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]).lock();
				expect(x.sum(0).shape).to.deep.equal([3, 4]);
				expect(x.sum(1).shape).to.deep.equal([2, 4]);
				expect(x.sum(2).shape).to.deep.equal([2, 3]);
				x.invalidate();
			});
			it("Correct result for 3-dimensional arrays, axis 0", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.sum(0).get(function(result){
					expect(result).to.deep.equal([[ 14, 16, 18, 20],
												  [ 22, 24, 26, 28],
												  [ 30, 32, 34, 36]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 1", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.sum(1).get(function(result){
					expect(result).to.deep.equal([[ 15,  18,  21,  24],
												  [ 51,  54,  57,  60]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 2", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.sum(2).get(function(result){
					expect(result).to.deep.equal([[ 10,  26,  42],
												  [ 58,  74,  90]]);
					done();
				});
			});
		});
	});
	describe("dot", function(){
		it("Correct shape for 2-dimensional arrays", function(){
			var x = context.empty([2, 5]);
			var y = context.empty([5, 11]);
			expect(context.dot(x, y).shape).to.deep.equal([2, 11]);
		});
		it("Correct shape for 3-dimensional arrays", function(){
			var x = context.empty([2, 3, 4]);
			var y = context.empty([7, 4, 8]);
			expect(context.dot(x, y).shape).to.deep.equal([2, 3, 7, 8]);
		});
		it("Correct shape for 4-dimensional arrays", function(){
			var x = context.empty([2, 3, 4, 5]);
			var y = context.empty([6, 7, 5, 8]);
			expect(context.dot(x, y).shape).to.deep.equal([2, 3, 4, 6, 7, 8]);
		});
		it("Correct value for 1-dimensional arrays", function(done){
			var x = context.array([2, 5]);
			var y = context.array([5, 11]);
			context.dot(x, y).get(function(result){
				expect(result).to.deep.equal(65);
				done();
			});
		});
		it("Correct value for 2-dimensional arrays", function(done){
			var x = context.array([[64,  2,  3],
								   [61, 60,  6]]);
			var y = context.array([[92, 99,  1,  8, 15],
								   [67, 74, 51, 58, 40],
								   [98, 80,  7, 14, 16]]);
			var z = context.dot(x, y);
			z.get(function(result){
				expect(result).to.deep.equal([[  6316,  6724,  187,  670, 1088],
											  [ 10220, 10959, 3163, 4052, 3411]]);
				done();
			});
		});
	});
});

},{"../lib/furious.js":6,"chai":13}]},{},[45,46,47])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxQcm9qZWN0c1xcZnVyaW91cy5qc1xcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL2xpYi9EYXRhVHlwZS5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL0pTQ29udGV4dC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL05EQXJyYXkuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL2xpYi9QTmFDbENvbnRleHQuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL2xpYi9hbGxvY2F0b3IuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL2xpYi9mdXJpb3VzLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9saWIvanNtYXRoLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9saWIvdXRpbC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL3dlYmNsL1dlYkNMQ29udGV4dC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2luZGV4LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvYXNzZXJ0aW9uLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS9jb25maWcuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL2NvcmUvYXNzZXJ0aW9ucy5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvaW50ZXJmYWNlL2Fzc2VydC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvaW50ZXJmYWNlL2V4cGVjdC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvaW50ZXJmYWNlL3Nob3VsZC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvYWRkQ2hhaW5hYmxlTWV0aG9kLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9hZGRNZXRob2QuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL2FkZFByb3BlcnR5LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9mbGFnLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9nZXRBY3R1YWwuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL2dldEVudW1lcmFibGVQcm9wZXJ0aWVzLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9nZXRNZXNzYWdlLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9nZXROYW1lLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9nZXRQYXRoVmFsdWUuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL2dldFByb3BlcnRpZXMuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL2luZGV4LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9pbnNwZWN0LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9vYmpEaXNwbGF5LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9vdmVyd3JpdGVDaGFpbmFibGVNZXRob2QuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL292ZXJ3cml0ZU1ldGhvZC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvb3ZlcndyaXRlUHJvcGVydHkuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL3Rlc3QuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL3RyYW5zZmVyRmxhZ3MuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL3R5cGUuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL25vZGVfbW9kdWxlcy9hc3NlcnRpb24tZXJyb3IvaW5kZXguanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL25vZGVfbW9kdWxlcy9kZWVwLWVxbC9pbmRleC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbm9kZV9tb2R1bGVzL2RlZXAtZXFsL2xpYi9lcWwuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL25vZGVfbW9kdWxlcy9kZWVwLWVxbC9ub2RlX21vZHVsZXMvdHlwZS1kZXRlY3QvaW5kZXguanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL25vZGVfbW9kdWxlcy9kZWVwLWVxbC9ub2RlX21vZHVsZXMvdHlwZS1kZXRlY3QvbGliL3R5cGUuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL3Rlc3QvQ29udGV4dC50ZXN0LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy90ZXN0L0RhdGFUeXBlLnRlc3QuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL3Rlc3QvTkRBcnJheS50ZXN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzaUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Y0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2x5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaGlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqUUE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogQSBudW1lcmljYWwgZGF0YSB0eXBlIG9iamVjdC5cclxuICpcclxuICogQGNsYXNzIERhdGFUeXBlXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZSAtIHRoZSBhYmJyZXZpYXRlZCBuYW1lIG9mIHRoZSBkYXRhIHR5cGUuIFRoZSBmb2xsb3dpbmcgbmFtZXMgYXJlIHN1cHBvcnRlZDpcclxuICpcclxuICogICAgIDx0YWJsZT5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0aD5BYmJyZXZpYXRlZCBOYW1lPC90aD5cclxuICogICAgICAgICAgICAgPHRoPkludGVycHJldGF0aW9uPC90aD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwiZjMyXCI8L3RkPlxyXG4gKiAgICAgICAgICAgICA8dGQ+U2luZ2xlLXByZWNpc2lvbiAoMzItYml0KSBJRUVFLTc1NCBmbG9hdGluZy1wb2ludCB0eXBlLjwvdGQ+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cImY2NFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPkRvdWJsZS1wcmVjaXNpb24gKDY0LWJpdCkgSUVFRS03NTQgZmxvYXRpbmctcG9pbnQgdHlwZS48L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICA8L3RhYmxlPlxyXG4gKlxyXG4gKi9cclxuZnVuY3Rpb24gRGF0YVR5cGUodHlwZSkge1xyXG5cdGlmIChbXCJmMzJcIiwgXCJmNjRcIl0uaW5kZXhPZih0eXBlKSA+PSAwKSB7XHJcblx0XHR0aGlzLnR5cGUgPSB0eXBlO1xyXG5cdFx0dGhpcy5zaXplID0ge1wiZjMyXCI6IDQsIFwiZjY0XCI6IDh9W3R5cGVdO1xyXG5cdFx0dGhpcy5lcHNpbG9uID0ge1wiZjMyXCI6IDEuMTkyMDkyODk1NTA3ODEyNWUtNywgXCJmNjRcIjogMi4yMjA0NDYwNDkyNTAzMTMxZS0xNn1bdHlwZV07XHJcblx0XHR0aGlzLmFycmF5VHlwZSA9IHtcImYzMlwiOiBGbG9hdDMyQXJyYXksIFwiZjY0XCI6IEZsb2F0NjRBcnJheX1bdHlwZV07XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVHlwZSBcIiArIHR5cGUgKyBcIiBpcyBub3Qgc3VwcG9ydGVkXCIpO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbXBhcmVzIHR3byBkYXRhIHR5cGUgb2JqZWN0cyBmb3IgZXF1YWxpdHkuXHJcbiAqXHJcbiAqIEBtZXRob2QgZXF1YWxzXHJcbiAqIEBwYXJhbSB7YW55fSBvdGhlciAtIGFuIG9iamVjdCB0byBjb21wYXJlIHRvLlxyXG4gKi9cclxuRGF0YVR5cGUucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uKG90aGVyKSB7XHJcblx0cmV0dXJuIChvdGhlciBpbnN0YW5jZW9mIERhdGFUeXBlKSAmJiAodGhpcy5hcnJheVR5cGUgPT09IG90aGVyLmFycmF5VHlwZSk7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IERhdGFUeXBlO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBOREFycmF5ID0gcmVxdWlyZShcIi4vTkRBcnJheVwiKTtcclxudmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XHJcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbFwiKTtcclxudmFyIGpzbWF0aCA9IHJlcXVpcmUoXCIuL2pzbWF0aFwiKTtcclxuXHJcbi8qKlxyXG4gKiBQcm92aWRlcyBtZXRob2RzIGZvciBjcmVhdGlvbiwgbWFuaXB1bGF0aW9uLCBhbmQgZGVzdHJ1Y3Rpb24gb2YgTi1kaW1lbnNpb25hbCBhcnJheXMuXHJcbiAqIEFyaXRobWV0aWMgb3BlcmF0aW9ucyBhcmUgcG9zc2libGUgb25seSBvbiBhcnJheXMgdGhhdCBiZWxvbmcgdG8gdGhlIHNhbWUgY29udGV4dC5cclxuICpcclxuICogQGNsYXNzIENvbnRleHRcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBKU0NvbnRleHQoY2FsbGJhY2spIHtcclxuXHRjYWxsYmFjayh0aGlzKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgYW4gdW5pbmlhbGl6ZWQgTi1kaW1lbnNpb25hbCBhcnJheS5cclxuICpcclxuICogQG1ldGhvZCBlbXB0eVxyXG4gKiBAcGFyYW0ge051bWJlcn0gc2hhcGUgLSB0aGUgZGltZW5zaW9ucyBvZiB0aGUgYXJyYXlcclxuICogQHBhcmFtIHtEYXRhVHlwZX0gZGF0YVR5cGUgLSB0aGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLmVtcHR5ID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XHJcblx0LyogVGhlIGlzIG5vIHdheSB0byBjcmVhdGUgdW5pbml0aWFsaXplZCB0eXBlZCBhcnJheSBpbiBKYXZhU2NyaXB0ICovXHJcblx0cmV0dXJuIHRoaXMuemVyb3Moc2hhcGUsIGRhdGFUeXBlKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGFuIE4tZGltZW5zaW9uYWwgYXJyYXkgd2l0aCBlbGVtZW50cyBpbml0aWFsaXplZCB0byB6ZXJvLlxyXG4gKlxyXG4gKiBAbWV0aG9kIHplcm9zXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBzaGFwZSAtIHRoZSBkaW1lbnNpb25zIG9mIHRoZSBhcnJheVxyXG4gKiBAcGFyYW0ge0RhdGFUeXBlfSBkYXRhVHlwZSAtIHRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cclxuICovXHJcbkpTQ29udGV4dC5wcm90b3R5cGUuemVyb3MgPSBmdW5jdGlvbihzaGFwZSwgZGF0YVR5cGUpIHtcclxuXHRzaGFwZSA9IHV0aWwuY2hlY2tTaGFwZShzaGFwZSk7XHJcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XHJcblx0fSBlbHNlIHtcclxuXHRcdGRhdGFUeXBlID0gdXRpbC5jaGVja0RhdGFUeXBlKGRhdGFUeXBlKTtcclxuXHR9XHJcblx0dmFyIGFycmF5ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCB0aGlzKTtcclxuXHRhcnJheS5fZGF0YSA9IG5ldyBkYXRhVHlwZS5hcnJheVR5cGUoYXJyYXkubGVuZ3RoKTtcclxuXHRyZXR1cm4gYXJyYXk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ29uc3RydWN0cyBhbiBOLWRpbWVuc2lvbmFsIGFycmF5IHdpdGggZWxlbWVudHMgaW5pdGlhbGl6ZWQgdG8gb25lLlxyXG4gKlxyXG4gKiBAbWV0aG9kIG9uZXNcclxuICogQHBhcmFtIHtOdW1iZXJ9IHNoYXBlIC0gdGhlIGRpbWVuc2lvbnMgb2YgdGhlIGFycmF5XHJcbiAqIEBwYXJhbSB7RGF0YVR5cGV9IGRhdGFUeXBlIC0gdGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5vbmVzID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XHJcblx0LyogVGhlIGlzIG5vIHdheSB0byBjcmVhdGUgdW5pbml0aWFsaXplZCB0eXBlZCBhcnJheSBpbiBKYXZhU2NyaXB0ICovXHJcblx0dmFyIGFycmF5ID0gdGhpcy56ZXJvcyhzaGFwZSwgZGF0YVR5cGUpO1xyXG5cdGpzbWF0aC5maWxsKGFycmF5Ll9kYXRhLCAxLjApO1xyXG5cdHJldHVybiBhcnJheTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGFuIE4tZGltZW5zaW9uYWwgYXJyYXkgb2JqZWN0IHdpdGggdGhlIHByb3ZpZGVkIGRhdGEuXHJcbiAqXHJcbiAqIEBtZXRob2QgYXJyYXlcclxuICogQHBhcmFtIHtOdW1iZXJbXX0gZGF0YSAtIHRoZSBhcnJheSBkYXRhXHJcbiAqIEBwYXJhbSB7RGF0YVR5cGV9IGRhdGFUeXBlIC0gdGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5hcnJheSA9IGZ1bmN0aW9uKGRhdGEsIGRhdGFUeXBlKSB7XHJcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XHJcblx0fSBlbHNlIHtcclxuXHRcdGRhdGFUeXBlID0gdXRpbC5jaGVja0RhdGFUeXBlKGRhdGFUeXBlKTtcclxuXHR9XHJcblx0dmFyIHNoYXBlID0gW107XHJcblx0dXRpbC5kaXNjb3ZlckFycmF5U2hhcGVSZWN1cnNpdmUoZGF0YSwgc2hhcGUsIDApO1xyXG5cdHZhciBhcnJheSA9IHRoaXMuZW1wdHkoc2hhcGUsIGRhdGFUeXBlKTtcclxuXHR1dGlsLmNvcHlBcnJheURhdGFSZWN1cnNpdmUoYXJyYXkuX2RhdGEsIGRhdGEsIHNoYXBlLCAwLCAwKTtcclxuXHRyZXR1cm4gYXJyYXk7XHJcbn07XHJcblxyXG4vKipcclxuICogRGUtYWxsb2NhdGVzIGRhdGEgYXNzb2NpYXRlZCB3aXRoIHRoZSBhcnJheS5cclxuICpcclxuICogQG1ldGhvZCBfaW52YWxpZGF0ZVxyXG4gKiBAcHJpdmF0ZVxyXG4gKlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IGFycmF5IC0gdGhlIG4tZGltZW5zaW9uYWwgYXJyYXkgb2JqZWN0IHdpdGggZGF0YSB0byBiZSBkZS1hbGxvY2F0ZWQuXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLl9pbnZhbGlkYXRlID0gZnVuY3Rpb24oYXJyYXkpIHtcclxuXHR1dGlsLmNoZWNrTkRBcnJheShhcnJheSwgXCJhcnJheVwiKTtcclxuXHRhcnJheS5fZGF0YSA9IG51bGw7XHJcbn07XHJcblxyXG4vKipcclxuICogRmV0Y2hlcyBOREFycmF5IGRhdGEgYW5kIGFzeW5jaHJvbm91c2x5IHJldHVybnMgaXQgYXMgSmF2YVNjcmlwdCBhcnJheXMgb3IgbnVtYmVycy5cclxuICpcclxuICogQG1ldGhvZCBnZXRcclxuICogQGFzeW5jXHJcbiAqXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXlzKiAtIE5EQXJyYXlzIHRvIGZldGNoLlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIEEgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdpdGggdGhlIGRhdGEgd2hlbiBpdCBpcyBhdmFpbGFibGUuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfE51bWJlcltdfSBjYWxsYmFjay5hcnJheXMqIC0gSmF2YVNjcmlwdCBudW1iZXJzIG9yIG11bHRpZGltZW5zaW9uYWwgYXJyYXlzIHdpdGggdGhlIGRhdGEuIFRoZSBudW1iZXIgYW5kIG9yZGVyIG9mIGFyZ3VtZW50cyBtYXRjaGVzIHRoZSBOREFycmF5cyBwYXNzZWQgdG8gdGhlIG1ldGhvZCBjYWxsLlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbigpIHtcclxuXHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgYXJndW1lbnQgbWlzc2luZ1wiKTtcclxuXHR9XHJcblx0dmFyIGNhbGxiYWNrID0gYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXTtcclxuXHQvKiBWYWxpZGF0ZSBhcmd1bWVudHMgKi9cclxuXHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXQgbGVhc3Qgb25lIE5EQXJyYXkgYXJndW1lbnQgZXhwZWN0ZWRcIik7XHJcblx0fVxyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aCAtIDE7ICsraSkge1xyXG5cdFx0dXRpbC5jaGVja05EQXJyYXkoYXJndW1lbnRzW2ldLCBcImFyZ3VtZW50IFwiICsgaSk7XHJcblx0fVxyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aCAtIDE7ICsraSkge1xyXG5cdFx0YXJndW1lbnRzW2ldLl9kZWNSZWYoKTtcclxuXHR9XHJcblx0dmFyIGNhbGxiYWNrQXJndW1lbnRzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrQXJndW1lbnRzLmxlbmd0aDsgKytpKSB7XHJcblx0XHR2YXIgYXJyYXkgPSBhcmd1bWVudHNbaV07XHJcblx0XHRpZiAoYXJyYXkuc2hhcGUubGVuZ3RoID09PSAwKSB7XHJcblx0XHRcdGNhbGxiYWNrQXJndW1lbnRzW2ldID0gYXJyYXkuX2RhdGFbMF07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR2YXIganNhcnJheSA9IG5ldyBBcnJheShhcnJheS5zaGFwZVswXSk7XHJcblx0XHRcdHV0aWwuY3JlYXRlQXJyYXlSZWN1cnNpdmUoYXJyYXkuX2RhdGEsIGpzYXJyYXksIGFycmF5LnNoYXBlLCAwLCAwKTtcclxuXHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBqc2FycmF5O1xyXG5cdFx0fVxyXG5cdH1cclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyArK2kpIHtcclxuXHRcdGFyZ3VtZW50c1tpXS5fdHJ5SW52YWxpZGF0ZSgpO1xyXG5cdH1cclxuXHRjYWxsYmFjay5hcHBseShudWxsLCBjYWxsYmFja0FyZ3VtZW50cyk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhbm90aGVyIGFycmF5IHdpdGggdGhlIHNhbWUgZGF0YSwgYnV0IGRpZmZlcmVudCBkaW1lbnNpb25zLlxyXG4gKlxyXG4gKiBAbWV0aG9kIHJlc2hhcGVcclxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBzaGFwZSAtIGRpbWVuc2lvbnMgb2YgdGhlIG5ldyBhcnJheS5cclxuICovXHJcbkpTQ29udGV4dC5wcm90b3R5cGUucmVzaGFwZSA9IGZ1bmN0aW9uKGFycmF5LCBzaGFwZSkge1xyXG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcclxuXHRpZiAodXRpbC5jb21wdXRlTGVuZ3RoKHNoYXBlKSAhPT0gYXJyYXkubGVuZ3RoKSB7XHJcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBzaGFwZSBpcyBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSBhcnJheVwiKTtcclxuXHR9XHJcblx0dmFyIG91dCA9IG5ldyBOREFycmF5KHNoYXBlLCBhcnJheS5kYXRhVHlwZSwgdGhpcyk7XHJcblx0aWYgKGFycmF5Ll9kZWNSZWYoKSkge1xyXG5cdFx0b3V0Ll9kYXRhID0gbmV3IG91dC5kYXRhVHlwZS5hcnJheVR5cGUob3V0Lmxlbmd0aCk7XHJcblx0XHRvdXQuX2RhdGEuc2V0KGFycmF5Ll9kYXRhKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0b3V0Ll9kYXRhID0gYXJyYXkuX2RhdGE7XHJcblx0XHRhcnJheS5fdHJ5SW52YWxpZGF0ZSgpO1xyXG5cdH1cclxuXHRyZXR1cm4gb3V0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIER1cGxpY2F0ZXMgYXJyYXkgZWxlbWVudHMgYWxvbmcgdGhlIHNwZWNpZmllZCBheGlzLlxyXG4gKlxyXG4gKiBAbWV0aG9kIHJlcGVhdFxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IGEgLSB0aGUgaW5wdXQgYXJyYXkuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByZXBlYXRzIC0gdGhlIG51bWJlciBvZiB0aW1lcyB0byByZXBlYXQgZWFjaCBlbGVtZW50LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gYXhpcyAtIHRoZSBheGlzIGFsb25nIHdoaWNoIHRoZSBlbGVtZW50cyB3aWxsIGJlIGR1cGxpY2F0ZWQuXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSBhbiBvdXRwdXQgYXJyYXkgdG8gc3RvcmUgdGhlIHJlc3VsdC5cclxuICogQHJldHVybiB7TkRBcnJheX0gLSBhbiBOLWRpbWVuc2lvbmFsIGFycmF5IHdpdGggcmVwZWF0ZWQgZWxlbWVudHMgb2YgYXJyYXkgKiphKiouXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLnJlcGVhdCA9IGZ1bmN0aW9uKGEsIHJlcGVhdHMsIGF4aXMsIG91dCkge1xyXG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcclxuXHRyZXBlYXRzID0gdXRpbC5jaGVja1JlcGVhdHMocmVwZWF0cyk7XHJcblx0YXhpcyA9IHV0aWwuY2hlY2tBeGlzKGF4aXMsIGEuc2hhcGUubGVuZ3RoKTtcclxuXHR2YXIgc2hhcGVBID0gYS5zaGFwZTtcclxuXHR2YXIgc2hhcGVPdXQgPSBzaGFwZUEuc2xpY2UoMCk7XHJcblx0c2hhcGVPdXRbYXhpc10gKj0gcmVwZWF0cztcclxuXHRhLl9kZWNSZWYoKTtcclxuXHR0cnkge1xyXG5cdFx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0b3V0ID0gdGhpcy5lbXB0eShzaGFwZU91dCwgYS5kYXRhVHlwZSk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xyXG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShvdXQuc2hhcGUsIHNoYXBlT3V0KTtcclxuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcclxuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdHZhciBvdXRlclN0cmlkZSA9IHV0aWwuY29tcHV0ZU91dGVyU3RyaWRlKHNoYXBlQSwgYXhpcyk7XHJcblx0XHR2YXIgaW5uZXJTdHJpZGUgPSB1dGlsLmNvbXB1dGVJbm5lclN0cmlkZShzaGFwZUEsIGF4aXMpO1xyXG5cdFx0anNtYXRoLnJlcGVhdChhLl9kYXRhLCBvdXQuX2RhdGEsIG91dGVyU3RyaWRlLCBpbm5lclN0cmlkZSwgc2hhcGVBW2F4aXNdLCByZXBlYXRzKTtcclxuXHR9IGNhdGNoIChlKSB7XHJcblx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGEuX3RyeUludmFsaWRhdGUoKTtcclxuXHRyZXR1cm4gb3V0O1xyXG59O1xyXG5cclxudmFyIGJpbmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBiLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbiwgb3BlcmF0aW9uQ29uc3QsIG9wZXJhdGlvblJldkNvbnN0KSB7XHJcblx0dmFyIHNoYXBlT3V0ID0gbnVsbCwgZGF0YVR5cGVPdXQgPSBudWxsO1xyXG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0c2hhcGVPdXQgPSBhLnNoYXBlO1xyXG5cdFx0ZGF0YVR5cGVPdXQgPSBhLmRhdGFUeXBlO1xyXG5cdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KGEuc2hhcGUsIGIuc2hhcGUpO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBiLmRhdGFUeXBlKTtcclxuXHRcdH0gZWxzZSBpZiAoIXV0aWwuaXNOdW1iZXIoYikpIHtcclxuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYlwiKTtcclxuXHRcdH1cclxuXHR9IGVsc2UgaWYgKHV0aWwuaXNOdW1iZXIoYSkpIHtcclxuXHRcdHNoYXBlT3V0ID0gYi5zaGFwZTtcclxuXHRcdGRhdGFUeXBlT3V0ID0gYi5kYXRhVHlwZTtcclxuXHRcdHV0aWwuY2hlY2tOREFycmF5KGIsIFwiYlwiKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYVwiKTtcclxuXHR9XHJcblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRhLl9kZWNSZWYoKTtcclxuXHR9XHJcblx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRiLl9kZWNSZWYoKTtcclxuXHR9XHJcblx0dHJ5IHtcclxuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRcdG91dCA9IG5ldyBOREFycmF5KHNoYXBlT3V0LCBkYXRhVHlwZU91dCwgY29udGV4dCk7XHJcblx0XHRcdGlmICgoYSBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFhLl9oYXNSZWZzKCkpIHtcclxuXHRcdFx0XHRvdXQuX2RhdGEgPSBhLl9kYXRhO1xyXG5cdFx0XHR9IGVsc2UgaWYgKChiIGluc3RhbmNlb2YgTkRBcnJheSkgJiYgIWIuX2hhc1JlZnMoKSkge1xyXG5cdFx0XHRcdG91dC5fZGF0YSA9IGIuX2RhdGE7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0b3V0Ll9kYXRhID0gbmV3IGRhdGFUeXBlT3V0LmFycmF5VHlwZShvdXQubGVuZ3RoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcclxuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoc2hhcGVPdXQsIG91dC5zaGFwZSk7XHJcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGRhdGFUeXBlT3V0LCBvdXQuZGF0YVR5cGUpO1xyXG5cdFx0XHRvdXQuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRcdG9wZXJhdGlvbihhLl9kYXRhLCBiLl9kYXRhLCBvdXQuX2RhdGEpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG9wZXJhdGlvbkNvbnN0KGEuX2RhdGEsICtiLCBvdXQuX2RhdGEpO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRvcGVyYXRpb25SZXZDb25zdChiLl9kYXRhLCArYSwgb3V0Ll9kYXRhKTtcclxuXHRcdH1cclxuXHR9IGNhdGNoIChlKSB7XHJcblx0XHQvKiBSZXN0b3JlIHRoZSBwcmV2aW91cyBzdGF0ZSAqL1xyXG5cdFx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRcdGEuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRcdGIuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdFx0dGhyb3cgZTtcclxuXHR9XHJcblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRhLl90cnlJbnZhbGlkYXRlKCk7XHJcblx0fVxyXG5cdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0Yi5fdHJ5SW52YWxpZGF0ZSgpO1xyXG5cdH1cclxuXHRyZXR1cm4gb3V0O1xyXG59O1xyXG5cclxudmFyIHVuYXJ5QXJpdGhPcCA9IGZ1bmN0aW9uKGEsIG91dCwgY29udGV4dCwgb3BlcmF0aW9uKSB7XHJcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xyXG5cdGEuX2RlY1JlZigpO1xyXG5cdHRyeSB7XHJcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShhLnNoYXBlLCBhLmRhdGFUeXBlLCBjb250ZXh0KTtcclxuXHRcdFx0aWYgKChhIGluc3RhbmNlb2YgTkRBcnJheSkgJiYgIWEuX2hhc1JlZnMoKSkge1xyXG5cdFx0XHRcdG91dC5fZGF0YSA9IGEuX2RhdGE7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0b3V0Ll9kYXRhID0gbmV3IGEuZGF0YVR5cGUuYXJyYXlUeXBlKG91dC5sZW5ndGgpO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xyXG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBvdXQuc2hhcGUpO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xyXG5cdFx0XHRvdXQuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdFx0b3BlcmF0aW9uKGEuX2RhdGEsIG91dC5fZGF0YSk7XHJcblx0fSBjYXRjaCAoZSkge1xyXG5cdFx0LyogUmVzdG9yZSB0aGUgcHJldmlvdXMgc3RhdGUgKi9cclxuXHRcdGEuX2luY1JlZigpO1xyXG5cdFx0dGhyb3cgZTtcclxuXHR9XHJcblx0YS5fdHJ5SW52YWxpZGF0ZSgpO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG52YXIgYXhpc1JlZHVjZU9wID0gZnVuY3Rpb24oYSwgYXhpcywgb3V0LCBjb250ZXh0LCBvcGVyYXRpb24sIGF4aXNPcGVyYXRpb24pIHtcclxuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XHJcblx0aWYgKHR5cGVvZiBheGlzID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRvdXQgPSBjb250ZXh0LmVtcHR5KFtdLCBhLmRhdGFUeXBlKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KFtdLCBvdXQuc2hhcGUpO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xyXG5cdFx0XHRvdXQuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdFx0b3BlcmF0aW9uKGEuX2RhdGEsIG91dC5fZGF0YSk7XHJcblx0XHRhLl90cnlSZWxlYXNlKCk7XHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH0gZWxzZSB7XHJcblx0XHRheGlzID0gdXRpbC5jaGVja0F4aXMoYXhpcywgYS5zaGFwZS5sZW5ndGgpO1xyXG5cdFx0dmFyIHNoYXBlT3V0ID0gdXRpbC5jb21wdXRlQXhpc1JlZHVjdGlvbk91dFNoYXBlKGEuc2hhcGUsIGF4aXMpO1xyXG5cdFx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0dmFyIG91dCA9IGNvbnRleHQuZW1wdHkoc2hhcGVPdXQsIGEuZGF0YVR5cGUpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcclxuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoW10sIG91dC5zaGFwZSk7XHJcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XHJcblx0XHRcdG91dC5faW5jUmVmKCk7XHJcblx0XHR9XHJcblx0XHRheGlzT3BlcmF0aW9uKGEuX2RhdGEsIG91dC5fZGF0YSxcclxuXHRcdFx0dXRpbC5jb21wdXRlT3V0ZXJTdHJpZGUoYS5zaGFwZSwgYXhpcyksXHJcblx0XHRcdHV0aWwuY29tcHV0ZUlubmVyU3RyaWRlKGEuc2hhcGUsIGF4aXMpLFxyXG5cdFx0XHRhLnNoYXBlW2F4aXNdKTtcclxuXHRcdGEuX3RyeVJlbGVhc2UoKTtcclxuXHRcdHJldHVybiBvdXQ7XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgb25lIG51bWJlciBvciBhcnJheSB3aXRoIGFub3RoZXIgbnVtYmVyIG9yIGFycmF5LlxyXG4gKiBBZGRpdGlvbiBpcyBwZXJmb3JtZWQgZWxlbWVudC1ieS1lbGVtZW50LlxyXG4gKlxyXG4gKiBAbWV0aG9kIGFkZFxyXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IGEgLSBvbmUgbnVtYmVyIG9yIGFycmF5IHRvIGFkZC4gSWYgKipiKiogaXMgYSAqTnVtYmVyKiwgKiphKiogbXVzdCBiZSBhbiAqTkRBcnJheSouXHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYiAtIGFub3RoZXIgbnVtYmVyIG9yIGFycmF5IHRvIGFkZC4gSWYgKiphKiogaXMgYSAqTnVtYmVyKiwgKipiKiogbXVzdCBiZSBhbiAqTkRBcnJheSouXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgd2hlcmUgdGhlIHJlc3VsdCBpcyB0byBiZSBzdG9yZWQuIElmIHByb3ZpZGVkLCBtdXN0IG1hdGNoIHRoZSBzaGFwZSBhbmQgZGF0YSB0eXBlIG9mIGlucHV0IGFycmF5cy5cclxuICogQHJldHVybiB7TkRBcnJheX0gLSB0aGUgcmVzdWx0IG9mIGVsZW1lbnQtd2lzZSBhZGRpdGlvbiBvZiAqKmEqKiBhbmQgKipiKiouXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywganNtYXRoLmFkZCwganNtYXRoLmFkZENvbnN0LCBqc21hdGguYWRkQ29uc3QpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFN1YnRyYWN0cyBvbmUgbnVtYmVyIG9yIGFycmF5IGZyb20gYW5vdGhlciBudW1iZXIgb3IgYXJyYXkuXHJcbiAqIFN1YnRyYWN0aW9uIGlzIHBlcmZvcm1lZCBlbGVtZW50LWJ5LWVsZW1lbnQuXHJcbiAqXHJcbiAqIEBtZXRob2Qgc3ViXHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYSAtIHRoZSBudW1iZXIgb3IgYXJyYXkgdG8gc3VidHJhY3QgZnJvbS4gSWYgKipiKiogaXMgYSAqTnVtYmVyKiwgKiphKiogbXVzdCBiZSBhbiAqTkRBcnJheSouXHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYiAtIHRoZSBudW1iZXIgb3IgYXJyYXkgdG8gc3VidHJhY3QuIElmICoqYSoqIGlzIGEgKk51bWJlciosICoqYioqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IHdoZXJlIHRoZSByZXN1bHQgaXMgdG8gYmUgc3RvcmVkLiBJZiBwcm92aWRlZCwgbXVzdCBtYXRjaCB0aGUgc2hhcGUgYW5kIGRhdGEgdHlwZSBvZiBpbnB1dCBhcnJheXMuXHJcbiAqIEByZXR1cm4ge05EQXJyYXl9IC0gdGhlIHJlc3VsdCBvZiBlbGVtZW50LXdpc2Ugc3VidHJhY3Rpb24gb2YgKipiKiogZnJvbSAqKmEqKi5cclxuICovXHJcbkpTQ29udGV4dC5wcm90b3R5cGUuc3ViID0gZnVuY3Rpb24oYSwgYiwgb3V0KSB7XHJcblx0cmV0dXJuIGJpbmFyeUFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzLCBqc21hdGguc3ViLCBqc21hdGguc3ViQ29uc3QsIGpzbWF0aC5zdWJSZXZDb25zdCk7XHJcbn07XHJcblxyXG4vKipcclxuICogTXVsdGlwbGllcyBvbmUgbnVtYmVyIG9yIGFycmF5IGJ5IGFub3RoZXIgbnVtYmVyIG9yIGFycmF5LlxyXG4gKiBNdWx0aXBsaWNhdGlvbiBpcyBwZXJmb3JtZWQgZWxlbWVudC1ieS1lbGVtZW50LlxyXG4gKlxyXG4gKiBAbWV0aG9kIG11bFxyXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IGEgLSBvbmUgbnVtYmVyIG9yIGFycmF5IHRvIG11bHRpcGx5LiBJZiAqKmIqKiBpcyBhICpOdW1iZXIqLCAqKmEqKiBtdXN0IGJlIGFuICpOREFycmF5Ki5cclxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBiIC0gYW5vdGhlciBudW1iZXIgb3IgYXJyYXkgdG8gbXVsdGlwbHkuIElmICoqYSoqIGlzIGEgKk51bWJlciosICoqYioqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IHdoZXJlIHRoZSByZXN1bHQgaXMgdG8gYmUgc3RvcmVkLiBJZiBwcm92aWRlZCwgbXVzdCBtYXRjaCB0aGUgc2hhcGUgYW5kIGRhdGEgdHlwZSBvZiBpbnB1dCBhcnJheXMuXHJcbiAqIEByZXR1cm4ge05EQXJyYXl9IC0gdGhlIHJlc3VsdCBvZiBlbGVtZW50LXdpc2UgbXVsdGlwbGljYXRpb24gb2YgKiphKiogYW5kICoqYioqLlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5tdWwgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcclxuXHRyZXR1cm4gYmluYXJ5QXJpdGhPcChhLCBiLCBvdXQsIHRoaXMsIGpzbWF0aC5tdWwsIGpzbWF0aC5tdWxDb25zdCwganNtYXRoLm11bENvbnN0KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBEaXZpZGVzIG9uZSBudW1iZXIgb3IgYXJyYXkgYnkgYW5vdGhlciBudW1iZXIgb3IgYXJyYXkuXHJcbiAqIERpdmlzaW9uIGlzIHBlcmZvcm1lZCBlbGVtZW50LWJ5LWVsZW1lbnQuXHJcbiAqXHJcbiAqIEBtZXRob2QgZGl2XHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYSAtIHRoZSBudW1iZXIgb3IgYXJyYXkgdG8gZGl2aWRlLiBJZiAqKmIqKiBpcyBhICpOdW1iZXIqLCAqKmEqKiBtdXN0IGJlIGFuICpOREFycmF5Ki5cclxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBiIC0gdGhlIG51bWJlciBvciBhcnJheSB0byBkaXZpZGUgYnkuIElmICoqYSoqIGlzIGEgKk51bWJlciosICoqYioqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IHdoZXJlIHRoZSByZXN1bHQgaXMgdG8gYmUgc3RvcmVkLiBJZiBwcm92aWRlZCwgbXVzdCBtYXRjaCB0aGUgc2hhcGUgYW5kIGRhdGEgdHlwZSBvZiBpbnB1dCBhcnJheXMuXHJcbiAqIEByZXR1cm4ge05EQXJyYXl9IC0gdGhlIHJlc3VsdCBvZiBlbGVtZW50LXdpc2UgZGl2aXNpb24gb2YgKiphKiogYnkgKipiKiouXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLmRpdiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywganNtYXRoLmRpdiwganNtYXRoLmRpdkNvbnN0LCBqc21hdGguZGl2UmV2Q29uc3QpO1xyXG59O1xyXG5cclxuSlNDb250ZXh0LnByb3RvdHlwZS5taW4gPSBmdW5jdGlvbihhLCBheGlzLCBvdXQpIHtcclxuXHRyZXR1cm4gYXhpc1JlZHVjZU9wKGEsIGF4aXMsIG91dCwgdGhpcywganNtYXRoLm1pbiwganNtYXRoLmF4aXNNaW4pO1xyXG59O1xyXG5cclxuSlNDb250ZXh0LnByb3RvdHlwZS5tYXggPSBmdW5jdGlvbihhLCBheGlzLCBvdXQpIHtcclxuXHRyZXR1cm4gYXhpc1JlZHVjZU9wKGEsIGF4aXMsIG91dCwgdGhpcywganNtYXRoLm1heCwganNtYXRoLmF4aXNNYXgpO1xyXG59O1xyXG5cclxuSlNDb250ZXh0LnByb3RvdHlwZS5zdW0gPSBmdW5jdGlvbihhLCBheGlzLCBvdXQpIHtcclxuXHRyZXR1cm4gYXhpc1JlZHVjZU9wKGEsIGF4aXMsIG91dCwgdGhpcywganNtYXRoLnN1bSwganNtYXRoLmF4aXNTdW0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIE5lZ2F0ZXMgYXJyYXkgZWxlbWVudHMuXHJcbiAqXHJcbiAqIEBtZXRob2QgbmVnXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBlbGVtZW50cyB0byBiZSBuZWdhdGVkLlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IGZvciBuZWdhdGVkIGVsZW1lbnRzLiBJZiBzdXBwbGllZCwgbXVzdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBhbmQgZGF0YSB0eXBlIG9mIHRoZSAqKmEqKiBhcnJheS5cclxuICovXHJcbkpTQ29udGV4dC5wcm90b3R5cGUubmVnID0gZnVuY3Rpb24oYSwgb3V0KSB7XHJcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIGpzbWF0aC5uZWcpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIGFic29sdXRlIHZhbHVlIG9mIGFycmF5IGVsZW1lbnRzLlxyXG4gKlxyXG4gKiBAbWV0aG9kIGFic1xyXG4gKiBAcGFyYW0ge05EQXJyYXl9IGEgLSB0aGUgYXJyYXkgb2YgaW5wdXQgZWxlbWVudHMuXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgZm9yIGNvbXB1dGVkIGFic29sdXRlIHZhbHVlcy4gSWYgc3VwcGxpZWQsIG11c3QgbWF0Y2ggdGhlIGRpbWVuc2lvbnMgYW5kIGRhdGEgdHlwZSBvZiB0aGUgKiphKiogYXJyYXkuXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLmFicyA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGguYWJzKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBFeHBvbmVudGlhdGVzIGFycmF5IGVsZW1lbnRzLlxyXG4gKlxyXG4gKiBAbWV0aG9kIGV4cFxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IGEgLSB0aGUgYXJyYXkgb2YgZWxlbWVudHMgdG8gYmUgZXhwb25lbnRpYXRlZC5cclxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSBmb3IgZXhwb25lbnRpYXRlZCBlbGVtZW50cy4gSWYgc3VwcGxpZWQsIG11c3QgbWF0Y2ggdGhlIGRpbWVuc2lvbnMgYW5kIGRhdGEgdHlwZSBvZiB0aGUgKiphKiogYXJyYXkuXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLmV4cCA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGguZXhwKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb21wdXRlcyBsb2dhcml0aG0gb2YgYXJyYXkgZWxlbWVudHMuXHJcbiAqXHJcbiAqIEBtZXRob2QgbG9nXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBpbnB1dCBlbGVtZW50cy5cclxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSBmb3IgY29tcHV0ZWQgbG9nYXJpdGhtIHZhbHVlcy4gSWYgc3VwcGxpZWQsIG11c3QgbWF0Y2ggdGhlIGRpbWVuc2lvbnMgYW5kIGRhdGEgdHlwZSBvZiB0aGUgKiphKiogYXJyYXkuXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLmxvZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGgubG9nKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb21wdXRlcyBzcXVhcmUgcm9vdCBvZiBhcnJheSBlbGVtZW50cy5cclxuICpcclxuICogQG1ldGhvZCBzcXJ0XHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBpbnB1dCBlbGVtZW50cy5cclxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSBmb3IgY29tcHV0ZWQgc3F1YXJlIHJvb3QgdmFsdWVzLiBJZiBzdXBwbGllZCwgbXVzdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBhbmQgZGF0YSB0eXBlIG9mIHRoZSAqKmEqKiBhcnJheS5cclxuICovXHJcbkpTQ29udGV4dC5wcm90b3R5cGUuc3FydCA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGguc3FydCk7XHJcbn07XHJcblxyXG4vKipcclxuICogU3F1YXJlcyBhcnJheSBlbGVtZW50cy5cclxuICpcclxuICogQG1ldGhvZCBzcXVhcmVcclxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGFycmF5IG9mIGVsZW1lbnRzIHRvIGJlIHNxdWFyZWQuXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgZm9yIHNxdWFyZWQgZWxlbWVudHMuIElmIHN1cHBsaWVkLCBtdXN0IG1hdGNoIHRoZSBkaW1lbnNpb25zIGFuZCBkYXRhIHR5cGUgb2YgdGhlICoqYSoqIGFycmF5LlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5zcXVhcmUgPSBmdW5jdGlvbihhLCBvdXQpIHtcclxuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywganNtYXRoLnNxdWFyZSk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ29tcHV0ZXMgdGhlIGRvdCBwcm9kdWN0IG9mIHR3byBOLWRpbWVuc2lvbmFsIGFycmF5cy5cclxuICpcclxuICogQG1ldGhvZCBkb3RcclxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGZpcnN0IGlucHV0IGFycmF5LlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IGIgLSB0aGUgc2Vjb25kIGlucHV0IGFycmF5LlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIG91dHB1dCBhcnJheS4gSWYgc3VwcGxpZWQsIG11c3QgbWF0Y2ggdGhlIGRhdGEgdHlwZSBvZiAqKmEqKiBhbmQgKipiKiogYXJyYXlzIGFuZCBoYXZlIHRoZSBleHBlY3RlZCBzaGFwZS4gQ2FuIG5vdCBiZSB0aGUgc2FtZSBhcnJheSBhcyAqKmEqKiBvciAqKmIqKi5cclxuICogQHJldHVybiB7TkRBcnJheX0gLSB0aGUgYXJyYXkgd2l0aCB0aGUgZG90IHByb2R1Y3Qgb2YgKiphKiogYW5kICoqYioqLlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5kb3QgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcclxuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XHJcblx0dXRpbC5jaGVja05EQXJyYXkoYiwgXCJiXCIpO1xyXG5cdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIGIuZGF0YVR5cGUpO1xyXG5cclxuXHQvKiBUaGUgYXhpcyBvZiBiIHVzZWQgaW4gcmVkdWN0aW9uOiBheGlzIDAgZm9yIDFEIGFycmF5LCBzZWNvbmQtdG8tbGFzdCBheGlzIGZvciBORCBhcnJheSAqL1xyXG5cdHZhciBhQXhpcyA9IE1hdGgubWF4KGEuc2hhcGUubGVuZ3RoIC0gMSwgMCk7XHJcblx0dmFyIGJBeGlzID0gTWF0aC5tYXgoYi5zaGFwZS5sZW5ndGggLSAyLCAwKTtcclxuXHR2YXIgcmVkdWN0aW9uRGltID0gYS5zaGFwZVthQXhpc107XHJcblx0aWYgKHJlZHVjdGlvbkRpbSAhPT0gYi5zaGFwZVtiQXhpc10pIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiQXJyYXlzIGhhdmUgaW5jb21wYXRpYmxlIHJlZHVjdGlvbiBkaW1lbnNpb25zXCIpO1xyXG5cdH1cclxuXHR2YXIgc2hhcGVPdXQgPSBbXSwgc3RyaWRlQSA9IDEsIG91dGVyU3RyaWRlQiA9IDEsIGlubmVyU3RyaWRlQiA9IDE7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhQXhpczsgaSsrKSB7XHJcblx0XHRzaGFwZU91dC5wdXNoKGEuc2hhcGVbaV0pO1xyXG5cdFx0c3RyaWRlQSAqPSBhLnNoYXBlW2ldO1xyXG5cdH1cclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGIuc2hhcGUubGVuZ3RoOyBpKyspIHtcclxuXHRcdHZhciBkaW0gPSBiLnNoYXBlW2ldO1xyXG5cdFx0aWYgKGkgPCBiQXhpcykge1xyXG5cdFx0XHRvdXRlclN0cmlkZUIgKj0gZGltO1xyXG5cdFx0XHRzaGFwZU91dC5wdXNoKGRpbSk7XHJcblx0XHR9IGVsc2UgaWYgKGkgPiBiQXhpcykge1xyXG5cdFx0XHRpbm5lclN0cmlkZUIgKj0gZGltO1xyXG5cdFx0XHRzaGFwZU91dC5wdXNoKGRpbSk7XHJcblx0XHR9XHJcblx0fVxyXG5cdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRvdXQgPSB0aGlzLmVtcHR5KHNoYXBlT3V0LCBhLmRhdGFUeXBlKTtcclxuXHR9IGVsc2UgaWYgKG91dCBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShvdXQuc2hhcGUsIHNoYXBlT3V0KTtcclxuXHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KG91dC5kYXRhVHlwZSwgYS5kYXRhVHlwZSk7XHJcblx0XHR1dGlsLmNoZWNrRGlmZmVyZW50TkRBcnJheXMoYSwgb3V0LCBcImFcIiwgXCJvdXRcIik7XHJcblx0XHR1dGlsLmNoZWNrRGlmZmVyZW50TkRBcnJheXMoYiwgb3V0LCBcImJcIiwgXCJvdXRcIik7XHJcblx0XHRvdXQuX2luY1JlZigpO1xyXG5cdH1cclxuXHRqc21hdGguZG90KGEuX2RhdGEsIGIuX2RhdGEsIG91dC5fZGF0YSwgc3RyaWRlQSwgb3V0ZXJTdHJpZGVCLCBpbm5lclN0cmlkZUIsIHJlZHVjdGlvbkRpbSk7XHJcblx0YS5fdHJ5UmVsZWFzZSgpO1xyXG5cdGIuX3RyeVJlbGVhc2UoKTtcclxuXHRyZXR1cm4gb3V0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYW4gYXJpdGhtZXRpYyBzZXF1ZW5jZS5cclxuICpcclxuICogQG1ldGhvZCBsaW5zcGFjZVxyXG4gKiBAcGFyYW0ge051bWJlcn0gc3RhcnQgLSB0aGUgc3RhcnRpbmcgZW5kcG9pbnQgb2YgdGhlIHNlcXVlbmNlLiBNdXN0IGJlIGEgZmluaXRlIG51bWJlci5cclxuICogQHBhcmFtIHtOdW1iZXJ9IHN0b3AgLSB0aGUgZmluYWwgZW5kcG9pbnQgb2YgdGhlIHNlcXVlbmNlLiBNdXN0IGJlIGEgZmluaXRlIG51bWJlci5cclxuICogQHBhcmFtIHtOdW1iZXJ9IFtzYW1wbGVzPTUwXSAtIHRoZSBudW1iZXIgb2Ygc2FtcGxlcyBpbiB0aGUgc2VxdWVuY3kuIE11c3QgYmUgYSBwb3NpdGl2ZSBpbnRlZ2VyLlxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtjbG9zZWQ9dHJ1ZV0gLSBhbiBpbmRpY2F0b3Igb2Ygd2hldGhlciB0aGUgZmluYWwgZW5kcG9pbnQgKGBzdG9wYCBhcmd1bWVudCkgc2hvdWxkIGJlIGluY2x1ZGVkIGluIHRoZSBzZXF1ZW5jZS5cclxuICovXHJcbkpTQ29udGV4dC5wcm90b3R5cGUubGluc3BhY2UgPSBmdW5jdGlvbihzdGFydCwgc3RvcCwgc2FtcGxlcywgY2xvc2VkKSB7XHJcblx0aWYgKCF1dGlsLmlzUmVhbChzdGFydCkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3Ioc3RhcnQgKyBcIiBpcyBub3QgYSByZWFsIG51bWJlclwiKTtcclxuXHR9XHJcblx0aWYgKCF1dGlsLmlzUmVhbChzdG9wKSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzdG9wICsgXCIgaXMgbm90IGEgcmVhbCBudW1iZXJcIik7XHJcblx0fVxyXG5cdGlmICh0eXBlb2Ygc2FtcGxlcyA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0LyogRGVmYXVsdCB2YWx1ZSBpbiBOdW1QeSAqL1xyXG5cdFx0c2FtcGxlcyA9IDUwO1xyXG5cdH0gZWxzZSBpZiAoIXV0aWwuaXNJbnQoc2FtcGxlcykpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3Ioc2FtcGxlcyArIFwiIGlzIG5vdCBhbiBpbnRlZ2VyXCIpO1xyXG5cdH0gZWxzZSBpZiAoc2FtcGxlcyA8PSAwKSB7XHJcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBudW1iZXIgb2Ygc2FtcGxlcyBtdXN0IGJlIHBvc2l0aXZlXCIpO1xyXG5cdH1cclxuXHRpZiAodHlwZW9mIGNsb3NlZCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0Y2xvc2VkID0gdHJ1ZTtcclxuXHR9XHJcblx0aWYgKGNsb3NlZCAmJiAoc2FtcGxlcyA9PT0gMSkpIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVGhlIG51bWJlciBvZiBzYW1wbGVzIG11c3QgYmUgYSBsZWFzdCAyIChmb3Igc3RhcnQgYW5kIGVuZCBwb2ludHMpXCIpO1xyXG5cdH1cclxuXHR2YXIgYXJyYXkgPSB0aGlzLmVtcHR5KHNhbXBsZXMsIG5ldyBEYXRhVHlwZShcImY2NFwiKSk7XHJcblx0dmFyIGRhdGEgPSBhcnJheS5fZGF0YTtcclxuXHR2YXIgcmFuZ2UgPSBzdG9wIC0gc3RhcnQ7XHJcblx0dmFyIG4gPSAoY2xvc2VkKSA/IHNhbXBsZXMgLSAxIDogc2FtcGxlcztcclxuXHR2YXIgc3RlcCA9IHJhbmdlIC8gbjtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IHNhbXBsZXM7IGkrKykge1xyXG5cdFx0ZGF0YVtpXSA9IHN0YXJ0ICsgc3RlcCAqIGk7XHJcblx0fVxyXG5cdHJldHVybiBhcnJheTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gSlNDb250ZXh0O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbFwiKTtcclxudmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XHJcblxyXG5mdW5jdGlvbiBzaGFwZVRvTGVuZ3RoKHNoYXBlKSB7XHJcblx0dmFyIGxlbmd0aCA9IDE7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzaGFwZS5sZW5ndGg7IGkrKykge1xyXG5cdFx0bGVuZ3RoICo9IHNoYXBlW2ldO1xyXG5cdH1cclxuXHRyZXR1cm4gbGVuZ3RoO1xyXG59XHJcblxyXG5mdW5jdGlvbiB2YWxpZGF0ZU11bHRpSW5kZXgoaW5kZXgsIHNoYXBlKSB7XHJcblx0aWYgKGluZGV4Lmxlbmd0aCAhPSBzaGFwZS5sZW5ndGgpIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVGhlIG11bHRpLWluZGV4IFwiICsgaW5kZXggKyBcIiBkb2VzIG5vdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBcIiArIHNoYXBlICsgXCIgb2YgdGhlIGFycmF5XCIpO1xyXG5cdH1cclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGluZGV4Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRpZiAoIXV0aWwuaXNJbnQoaW5kZXhbaV0pKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJUaGUgc3ViLWluZGV4IFwiICsgaW5kZXhbaV0gKyBcIiBpcyBub3QgYW4gaW50ZWdlclwiKTtcclxuXHRcdH1cclxuXHRcdGlmICgoaW5kZXhbaV0gPCAwKSB8fCAoaW5kZXhbaV0gPj0gc2hhcGVbaV0pKSB7XHJcblx0XHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVGhlIHN1Yi1pbmRleCBcIiArIGluZGV4W2ldICsgXCIgaXMgb3V0IG9mIGJvdW5kc1wiKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBbiBvcGFxdWUgTi1kaW1lbnNpb25hbCBhcnJheSBvYmplY3QuXHJcbiAqXHJcbiAqIEBjbGFzcyBOREFycmF5XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIENvbnN0cnVjdHMgYW4gTkRBcnJheSBvYmplY3Qgd2l0aG91dCBkYXRhLlxyXG4gKiBOb3JtYWxseSB0aGlzIGNvbnN0cnVjdG9yIGlzIGNhbGxlZCBmcm9tIGFycmF5IGNvbnN0cnVjdGlvbiBtZXRob2RzIG9mIGNvbXB1dGF0aW9uYWwgY29udGV4dHMuXHJcbiAqIFRoZSBjYWxsaW5nIGZ1bmN0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciBpbml0aWFsaXppbmcgdGhlIGRhdGEgZm9yIHRoZSBhcnJheS5cclxuICpcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqIEBwcml2YXRlXHJcbiAqL1xyXG5mdW5jdGlvbiBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgY29udGV4dCkge1xyXG5cdGlmICh0eXBlb2YgY29udGV4dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQ29udGV4dCBub3QgZGVmaW5lZFwiKTtcclxuXHR9XHJcblx0aWYgKCF1dGlsLmlzUG9zaXRpdmVJbnRBcnJheShzaGFwZSkgJiYgIXV0aWwuaXNQb3NpdGl2ZUludChzaGFwZSkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3Ioc2hhcGUgKyBcIiBpcyBub3QgYSB2YWxpZCBhcnJheSBzaGFwZVwiKTtcclxuXHR9XHJcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XHJcblx0fSBlbHNlIGlmICghKGRhdGFUeXBlIGluc3RhbmNlb2YgRGF0YVR5cGUpKSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xyXG5cdH1cclxuXHR0aGlzLnNoYXBlID0gdXRpbC5hc0ludEFycmF5KHNoYXBlKTtcclxuXHR0aGlzLmRhdGFUeXBlID0gZGF0YVR5cGU7XHJcblx0dGhpcy5fY29udGV4dCA9IGNvbnRleHQ7XHJcblx0dGhpcy5sZW5ndGggPSBzaGFwZVRvTGVuZ3RoKHRoaXMuc2hhcGUpO1xyXG5cdHRoaXMuX2xvY2tDb3VudCA9IDA7XHJcblx0dGhpcy5fcmVmQ291bnQgPSAxO1xyXG5cdHRoaXMuX2lzVmFsaWQgPSB0cnVlO1xyXG59XHJcblxyXG4vKipcclxuICogTG9ja3MgdGhlIGFycmF5IHJlZmVyZW5jZSBjb3VudGVyLlxyXG4gKiBXaGlsZSB0aGUgYXJyYXkgaXMgbG9ja2VkLCBmdW5jdGlvbnMgYW5kIG1ldGhvZHMgdGhhdCBvcGVyYXRlIG9uIHRoaXMgYXJyYXkgZG8gbm90IGRlY3JlYXNlIGl0cyByZWZlcmVuY2UgY291bnQuXHJcbiAqIFRoZSBhcnJheSBjYW4gYmUgbG9ja2VkIG11bHRpcGxlIHRpbWVzLCBhbmQgd291bGQgbmVlZCBqdXN0IGFzIG1hbnkgdW5sb2NrIGNhbGxzIHRvIGxpZnQgdGhlIGxvY2suXHJcbiAqIElmIHRoZSBhcnJheSBpcyBub3QgdmFsaWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxyXG4gKlxyXG4gKiBAbWV0aG9kIGxvY2tcclxuICogQGNoYWluYWJsZVxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUubG9jayA9IGZ1bmN0aW9uKCkge1xyXG5cdGlmICghdGhpcy5pc1ZhbGlkKCkpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihcIkF0dGVtcHRlZCB0byBsb2NrIGFuIGludmFsaWRhdGVkIGFycmF5XCIpO1xyXG5cdH1cclxuXHR0aGlzLl9sb2NrQ291bnQrKztcclxuXHRyZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBVbmxvY2tzIHRoZSBhcnJheSByZWZlcmVuY2UgY291bnRlci5cclxuICogT25jZSB0aGUgYXJyYXkgaXMgdW5sb2NrZWQsIGZ1bmN0aW9ucyBhbmQgbWV0aG9kcyB0aGF0IG9wZXJhdGUgb24gdGhpcyBhcnJheSBkZWNyZWFzZSBpdHMgcmVmZXJlbmNlIGNvdW50IGFuZCwgaWYgdGhlIHJlZmVyZW5jZSBjb3VudCByZWFjaGVzIHplcm8sIGludmFsaWRhdGUgdGhlIGFycmF5LlxyXG4gKiBJZiB0aGUgYXJyYXkgd2FzIGxvY2tlZCBtdWx0aXBsZSB0aW1lcywgaXQgd291bGQgbmVlZCBqdXN0IGFzIG1hbnkgdW5sb2NrIGNhbGxzIHRvIGxpZnQgdGhlIGxvY2suXHJcbiAqIElmIHRoZSBhcnJheSBpcyBub3QgbG9ja2VkLCB0aGlzIG9wZXJhdGlvbiB3aWxsIGZhaWwgd2l0aCBhbiBlcnJvci5cclxuICpcclxuICogQG1ldGhvZCB1bmxvY2tcclxuICogQGNoYWluYWJsZVxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUudW5sb2NrID0gZnVuY3Rpb24oKSB7XHJcblx0aWYgKCF0aGlzLmlzTG9ja2VkKCkpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihcIkF0dGVtcHRlZCB0byBsb2NrIGEgdW5sb2NrZWQgYXJyYXlcIik7XHJcblx0fVxyXG5cdHRoaXMuX2xvY2tDb3VudC0tO1xyXG5cdHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENoZWNrZXMgaWYgdGhlIGFycmF5IGlzIGluIHRoZSBsb2NrZWQgc3RhdGUuXHJcbiAqIElmIHRoZSBhcnJheSBpcyBub3QgdmFsaWQsIHRoaXMgbWV0aG9kIHJldHVybiBmYWxzZS5cclxuICpcclxuICogQG1ldGhvZCBpc0xvY2tlZFxyXG4gKlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaXMgdGhlIGFycmF5IGlzIGxvY2tlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlXHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS5pc0xvY2tlZCA9IGZ1bmN0aW9uKCkge1xyXG5cdHJldHVybiB0aGlzLl9sb2NrQ291bnQgPiAwO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEluY3JlbWVudHMgdGhlIGFycmF5IHJlZmVyZW5jZSBjb3VudC5cclxuICogSWYgdGhlIGFycmF5IGlzIGludmFsaWQgb3IgbG9ja2VkLCB0aGlzIG9wZXJhdGlvbiB3aWxsIGZhaWwgd2l0aCBhbiBlcnJvci5cclxuICpcclxuICogQG1ldGhvZCByZXRhaW5cclxuICogQGNoYWluYWJsZVxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUucmV0YWluID0gZnVuY3Rpb24oKSB7XHJcblx0aWYgKCF0aGlzLmlzVmFsaWQoKSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXR0ZW1wdGVkIHRvIHJlbGVhc2UgYW4gaW52YWxpZGF0ZWQgYXJyYXlcIik7XHJcblx0fVxyXG5cdGlmICh0aGlzLmlzTG9ja2VkKCkpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihcIkF0dGVtcHRlZCB0byByZXRhaW4gYSBsb2NrZWQgYXJyYXlcIik7XHJcblx0fVxyXG5cdHRoaXMuX3JlZkNvdW50Kys7XHJcblx0cmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogRGVjcmVtZW50cyB0aGUgYXJyYXkgcmVmZXJlbmNlIGNvdW50LiBJZiB0aGUgcmVmZXJlbmNlIGNvdW50IHR1cm5zIHplcm8sIHRoZSBhcnJheSBiZWNvbWVzIGludmFsaWQgYW5kIGl0cyBkYXRhIGJ1ZmZlciBpcyBkZWFsbG9jYXRlZC5cclxuICogSWYgdGhlIGFycmF5IGlzIGludmFsaWQgb3IgbG9ja2VkLCB0aGlzIG9wZXJhdGlvbiB3aWxsIGZhaWwgd2l0aCBhbiBlcnJvci5cclxuICpcclxuICogQG1ldGhvZCByZWxlYXNlXHJcbiAqIEBjaGFpbmFibGVcclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLnJlbGVhc2UgPSBmdW5jdGlvbigpIHtcclxuXHRpZiAoIXRoaXMuaXNWYWxpZCgpKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdHRlbXB0ZWQgdG8gcmVsZWFzZSBhbiBpbnZhbGlkYXRlZCBhcnJheVwiKTtcclxuXHR9XHJcblx0aWYgKHRoaXMuaXNMb2NrZWQoKSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXR0ZW1wdGVkIHRvIHJlbGVhc2UgYSBsb2NrZWQgYXJyYXlcIik7XHJcblx0fVxyXG5cdGlmICgtLXRoaXMuX3JlZkNvdW50ID09PSAwKSB7XHJcblx0XHR0aGlzLl9jb250ZXh0Ll9pbnZhbGlkYXRlKHRoaXMpO1xyXG5cdH1cclxuXHRyZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBGb3IgYSBub24tbG9ja2VkIGFycmF5LCBkZWNyZW1lbnRzIHRoZSBhcnJheSByZWZlcmVuY2UgY291bnQuIElmIHRoZSByZWZlcmVuY2UgY291bnQgdHVybnMgemVybywgdGhlIGFycmF5IGJlY29tZXMgaW52YWxpZCBhbmQgaXRzIGRhdGEgYnVmZmVyIGlzIGRlYWxsb2NhdGVkLlxyXG4gKiBJZiB0aGUgYXJyYXkgaXMgaW52YWxpZCwgdGhpcyBvcGVyYXRpb24gd2lsbCBmYWlsIHdpdGggYW4gZXJyb3IuXHJcbiAqXHJcbiAqIEBtZXRob2QgdHJ5UmVsZWFzZVxyXG4gKiBAY2hhaW5hYmxlXHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS50cnlSZWxlYXNlID0gZnVuY3Rpb24oKSB7XHJcblx0aWYgKCF0aGlzLmlzVmFsaWQoKSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXR0ZW1wdGVkIHRvIHJlbGVhc2UgYW4gaW52YWxpZGF0ZWQgYXJyYXlcIik7XHJcblx0fVxyXG5cdGlmICghdGhpcy5pc0xvY2tlZCgpKSB7XHJcblx0XHRpZiAoLS10aGlzLl9yZWZDb3VudCA9PT0gMCkge1xyXG5cdFx0XHR0aGlzLl9jb250ZXh0Ll9pbnZhbGlkYXRlKHRoaXMpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBGb3IgYSBub24tbG9ja2VkIGFycmF5LCBkZWNyZW1lbnRzIHRoZSBhcnJheSByZWZlcmVuY2UgY291bnQuIElmIHRoZSByZWZlcmVuY2UgY291bnQgdHVybnMgemVybywgdGhlIGFycmF5IGJlY29tZXMgaW52YWxpZCBhbmQgaXRzIGRhdGEgYnVmZmVyIGlzIGRlYWxsb2NhdGVkLlxyXG4gKiBUaGUgYXJyYXkgbXVzdCBiZSB2YWxpZCB0byBwZXJmb3JtIHRoaXMgb3BlcmF0aW9uLlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAbWV0aG9kIF90cnlSZWxlYXNlXHJcbiAqIEBjaGFpbmFibGVcclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLl90cnlSZWxlYXNlID0gZnVuY3Rpb24oKSB7XHJcblx0aWYgKCF0aGlzLmlzTG9ja2VkKCkpIHtcclxuXHRcdGlmICgtLXRoaXMuX3JlZkNvdW50ID09PSAwKSB7XHJcblx0XHRcdHRoaXMuX2NvbnRleHQuX2ludmFsaWRhdGUodGhpcyk7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEludmFsaWRhdGVzIHRoZSBhcnJheSBhbmQgZGVhbGxvY2F0ZXMgaXRzIGRhdGEgYnVmZmVyLCByZWdhcmRsZXNzIG9mIGxvY2tzIGFuZCByZWZlcmVuY2UgY291bnQuXHJcbiAqIENhbGxpbmcgdGhpcyBtZXRob2Qgb24gYW4gaW52YWxpZGF0ZWQgYXJyYXkgaGFzIG5vIGVmZmVjdC5cclxuICpcclxuICogQG1ldGhvZCBpbnZhbGlkYXRlXHJcbiAqIEBjaGFpbmFibGVcclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLmludmFsaWRhdGUgPSBmdW5jdGlvbigpIHtcclxuXHRpZiAodGhpcy5pc1ZhbGlkKCkpIHtcclxuXHRcdHRoaXMuX2NvbnRleHQuX2ludmFsaWRhdGUodGhpcyk7XHJcblx0XHR0aGlzLl9pc1ZhbGlkID0gZmFsc2U7XHJcblx0XHR0aGlzLl9yZWZDb3VudCA9IDA7XHJcblx0XHR0aGlzLl9sb2NrQ291bnQgPSAwO1xyXG5cdH1cclxuXHRyZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGVja2VzIGlmIHRoZSBhcnJheSBpcyBpbiBhIHZhbGlkIHN0YXRlLlxyXG4gKiBJZiB0aGUgYXJyYXkgaXMgbm90IGluIGEgdmFsaWQgc3RhdGUsIGl0cyBkYXRhIGJ1ZmZlciB3YXMgZGVhbGxvY2F0ZWQsIGFuZCBhbnkgb3BlcmF0aW9ucyBvbiB0aGUgYXJyYXkgd2lsbCB0aHJvdyBhbiBlcnJvci5cclxuICpcclxuICogQG1ldGhvZCBpc1ZhbGlkXHJcbiAqXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gdHJ1ZSBpcyB0aGUgYXJyYXkgaXMgdmFsaWQgYW5kIGZhbHNlIG90aGVyd2lzZVxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUuaXNWYWxpZCA9IGZ1bmN0aW9uKCkge1xyXG5cdHJldHVybiB0aGlzLl9pc1ZhbGlkO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIERlY3JlbWVudHMgdGhlIGFycmF5IHJlZmVyZW5jZSBjb3VudCBpZiB0aGUgYXJyYXkgaXMgbm90IGxvY2tlZC5cclxuICogVGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBpbnZhbGlkYXRlIHRoZSBhcnJheSB3aGVuIHRoZSByZWZlcmVuY2UgY291bnQgcmVhY2ggemVyby5cclxuICogVGhlIGNhbGxlciBpcyByZXNwb25zaWJsZSBmb3IgaW52YWxpZGF0aW5nIGFycmF5IGlmIGl0cyByZWZlcmVuY2UgY291bnQgaXMgemVybyBhZnRlciB0aGUgb3BlcmF0aW9uLlxyXG4gKlxyXG4gKiBGb3IgYSBsb2NrZWQgYXJyYXkgdGhlIG1ldGhvZCBoYXMgbm8gZWZmZWN0IGFuZCBhbHdheXMgcmV0dXJucyB0cnVlLlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAbWV0aG9kIF9kZWNSZWZcclxuICogQHBhcmFtIHtOREFycmF5fSBhcnJheSAtIHRoZSBhcnJheSB0byBkZWNyZW1lbnQgdGhlIHJlZmVyZW5jZSBjb3VudCBmb3IuIE11c3QgYmUgdmFsaWQgYmVmb3JlIHRoZSBjYWxsLlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaWYgdGhlIHJlZmVyZW5jZSBjb3VudCBpcyBub24temVybyBhZnRlciB0aGUgb3BlcmF0aW9uIGFuZCBmYWxzZSBvdGhlcndpc2UuXHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS5fZGVjUmVmID0gZnVuY3Rpb24oYXJyYXkpIHtcclxuXHRpZiAodGhpcy5fbG9ja0NvdW50ID09PSAwKSB7XHJcblx0XHQtLXRoaXMuX3JlZkNvdW50O1xyXG5cdH1cclxuXHRyZXR1cm4gdGhpcy5fcmVmQ291bnQgIT09IDA7XHJcbn07XHJcblxyXG4vKipcclxuICogSW5jcmVtZW50cyB0aGUgYXJyYXkgcmVmZXJlbmNlIGNvdW50IGlmIHRoZSBhcnJheSBpcyBub3QgbG9ja2VkLlxyXG4gKiBGb3IgYSBsb2NrZWQgYXJyYXkgdGhlIG1ldGhvZCBoYXMgbm8gZWZmZWN0LlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAbWV0aG9kIF9pbmNSZWZcclxuICogQGNoYWluYWJsZVxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IGFycmF5IC0gdGhlIGFycmF5IHRvIGluY3JlbWVudCB0aGUgcmVmZXJlbmNlIGNvdW50IGZvci4gTXVzdCBiZSB2YWxpZCBiZWZvcmUgdGhlIGNhbGwsIGJ1dCBtYXkgaGF2ZSB6ZXJvIHJlZmVyZW5jZSBjb3VudC5cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLl9pbmNSZWYgPSBmdW5jdGlvbihhcnJheSkge1xyXG5cdGlmICh0aGlzLl9sb2NrQ291bnQgPT09IDApIHtcclxuXHRcdCsrdGhpcy5fcmVmQ291bnQ7XHJcblx0fVxyXG5cdHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENoZWNrcyBpZiB0aGUgYXJyYXkgaXMgbG9ja2VkIG9yIGhhcyBhbnkgcmVmZXJlbmNlcy5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQG1ldGhvZCBfaGFzUmVmc1xyXG4gKiBAcGFyYW0ge05EQXJyYXl9IGFycmF5IC0gdGhlIGFycmF5IHRvIGNoZWNrLiBNdXN0IGJlIHZhbGlkIGJlZm9yZSB0aGUgY2FsbCwgYnV0IG1heSBoYXZlIHplcm8gcmVmZXJlbmNlIGNvdW50LlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaWYgdGhlIGFycmF5IGlzIGxvY2tlZCBvciBoYXMgcmVmZXJlbmNlcyBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUuX2hhc1JlZnMgPSBmdW5jdGlvbihhcnJheSkge1xyXG5cdHJldHVybiAodGhpcy5fbG9ja0NvdW50ICE9PSAwKSB8fCAodGhpcy5fcmVmQ291bnQgIT09IDApO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEludmFsaWRhdGVzIHRoZSBhcnJheSBpZiBpdCB2YWxpZCwgbm90IGxvY2tlZCwgYW5kIGhhcyB6ZXJvIHJlZmVyZW5jZSBjb3VudC5cclxuICogSGFzIG5vIGVmZmVjdCBpbiBhbGwgb3RoZXIgY2FzZXMuXHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBtZXRob2QgX3RyeUludmFsaWRhdGVcclxuICogQHBhcmFtIHtOREFycmF5fSBhcnJheSAtIHRoZSBhcnJheSB0byB0cnkgdG8gaW52YWxpZGF0ZS4gQ2FuIGJlIGludmFsaWQuXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gdHJ1ZSBpZiB0aGUgYXJyYXkgd2FzIGludmFsaWRhdGVkIGJ5IHRoaXMgY2FsbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUuX3RyeUludmFsaWRhdGUgPSBmdW5jdGlvbihhcnJheSkge1xyXG5cdGlmICh0aGlzLmlzVmFsaWQoKSAmJiAhdGhpcy5faGFzUmVmcygpKSB7XHJcblx0XHR0aGlzLl9jb250ZXh0Ll9pbnZhbGlkYXRlKHRoaXMpO1xyXG5cdFx0dGhpcy5faXNWYWxpZCA9IGZhbHNlO1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogQWRkcyBhbm90aGVyIGFycmF5IG9yIGEgbnVtYmVyIHRvIHRoaXMgYXJyYXkuXHJcbiAqXHJcbiAqIEBtZXRob2QgYWRkXHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gb3RoZXIgLSB0aGUgYXJyYXkgb3Igc2NhbGFyIHRvIGJlIGFkZGVkLlxyXG4gKiBAcmV0dXJuIHtOREFycmF5fVxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24ob3RoZXIpIHtcclxuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5hZGQodGhpcywgb3RoZXIpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFN1YnRyYWN0cyBhbm90aGVyIGFycmF5IG9yIGEgbnVtYmVyIGZyb20gdGhpcyBhcnJheS5cclxuICpcclxuICogQG1ldGhvZCBzdWJcclxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBvdGhlciAtIHRoZSBhcnJheSBvciBzY2FsYXIgdG8gYmUgc3VidHJhY3RlZC5cclxuICogQHJldHVybiB7TkRBcnJheX1cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLnN1YiA9IGZ1bmN0aW9uKG90aGVyKSB7XHJcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQuc3ViKHRoaXMsIG90aGVyKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBNdWx0aXBsaWVzIGFycmF5IGVsZW1lbnRzIGJ5IGFub3RoZXIgYXJyYXkgb3IgYnkgYSBudW1iZXIuXHJcbiAqXHJcbiAqIEBtZXRob2QgbXVsXHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gb3RoZXIgLSB0aGUgYXJyYXkgb3Igc2NhbGFyIHRvIG11bHRpcGx5IGVsZW1lbnRzIGJ5LlxyXG4gKiBAcmV0dXJuIHtOREFycmF5fVxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUubXVsID0gZnVuY3Rpb24ob3RoZXIpIHtcclxuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5tdWwodGhpcywgb3RoZXIpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIERpdmlkZXMgYXJyYXkgZWxlbWVudHMgYnkgYW5vdGhlciBhcnJheSBvciBieSBhIG51bWJlci5cclxuICpcclxuICogQG1ldGhvZCBkaXZcclxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBvdGhlciAtIHRoZSBhcnJheSBvciBzY2FsYXIgdG8gZGl2aWRlIGVsZW1lbnRzIGJ5LlxyXG4gKiBAcmV0dXJuIHtOREFycmF5fVxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUuZGl2ID0gZnVuY3Rpb24ob3RoZXIpIHtcclxuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5kaXYodGhpcywgb3RoZXIpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlZHVjZXMgYXJyYXkgZWxlbWVudHMgdXNpbmcgbWluaW11bSBvcGVyYXRpb24uXHJcbiAqIElmIHRoZSBheGlzIGFyZ3VtZW50IGlzIHByb3ZpZGVkLCB0aGUgbWV0aG9kIGNvbXB1dGVzIG1pbmltdW0gb2YgZWxlbWVudHMgYWxvbmcgdGhlIHNwZWNpZmllZCBheGlzLlxyXG4gKiBPdGhlcndpc2UsIHRoZSBtZXRob2QgY29tcHV0ZXMgYW4gYWxsLWFycmF5IG1pbmltdW0gb2YgdGhlIGVsZW1lbnRzIGFuZCByZXR1cm5zIHRoZW0gYXMgYSAxLWVsZW1lbnQgYXJyYXkuXHJcbiAqXHJcbiAqIEBtZXRob2QgbWluXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBbYXhpc10gLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgbWluaW11bSBpcyBjb21wdXRlZC5cclxuICogQHJldHVybiB7TkRBcnJheX1cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLm1pbiA9IGZ1bmN0aW9uKGF4aXMpIHtcclxuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5taW4odGhpcywgYXhpcyk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmVkdWNlcyBhcnJheSBlbGVtZW50cyB1c2luZyBtYXhpbXVtIG9wZXJhdGlvbi5cclxuICogSWYgdGhlIGF4aXMgYXJndW1lbnQgaXMgcHJvdmlkZWQsIHRoZSBtZXRob2QgY29tcHV0ZXMgbWF4aW11bSBvZiBlbGVtZW50cyBhbG9uZyB0aGUgc3BlY2lmaWVkIGF4aXMuXHJcbiAqIE90aGVyd2lzZSwgdGhlIG1ldGhvZCBjb21wdXRlcyBhbiBhbGwtYXJyYXkgbWF4aW11bSBvZiB0aGUgZWxlbWVudHMgYW5kIHJldHVybnMgdGhlbSBhcyBhIDEtZWxlbWVudCBhcnJheS5cclxuICpcclxuICogQG1ldGhvZCBtaW5cclxuICogQHBhcmFtIHtOdW1iZXJ9IFtheGlzXSAtIHRoZSBheGlzIGFsb25nIHdoaWNoIHRoZSBtYXhpbXVtIGlzIGNvbXB1dGVkLlxyXG4gKiBAcmV0dXJuIHtOREFycmF5fVxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUubWF4ID0gZnVuY3Rpb24oYXhpcykge1xyXG5cdHJldHVybiB0aGlzLl9jb250ZXh0Lm1heCh0aGlzLCBheGlzKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZWR1Y2VzIGFycmF5IGVsZW1lbnRzIHVzaW5nIHN1bSBvcGVyYXRpb24uXHJcbiAqIElmIHRoZSBheGlzIGFyZ3VtZW50IGlzIHByb3ZpZGVkLCB0aGUgbWV0aG9kIGNvbXB1dGVzIHN1bSBvZiBlbGVtZW50cyBhbG9uZyB0aGUgc3BlY2lmaWVkIGF4aXMuXHJcbiAqIE90aGVyd2lzZSwgdGhlIG1ldGhvZCBjb21wdXRlcyBhbiBhbGwtYXJyYXkgc3VtIG9mIHRoZSBlbGVtZW50cyBhbmQgcmV0dXJucyB0aGVtIGFzIGEgMS1lbGVtZW50IGFycmF5LlxyXG4gKlxyXG4gKiBAbWV0aG9kIG1pblxyXG4gKiBAcGFyYW0ge051bWJlcn0gW2F4aXNdIC0gdGhlIGF4aXMgYWxvbmcgd2hpY2ggdGhlIHN1bSBpcyBjb21wdXRlZC5cclxuICogQHJldHVybiB7TkRBcnJheX1cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLnN1bSA9IGZ1bmN0aW9uKGF4aXMpIHtcclxuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5zdW0odGhpcywgYXhpcyk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhbm90aGVyIGFycmF5IHdpdGggdGhlIHNhbWUgZGF0YSwgYnV0IGRpZmZlcmVudCBkaW1lbnNpb25zLlxyXG4gKlxyXG4gKiBAbWV0aG9kIHJlc2hhcGVcclxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBvdGhlciAtIGRpbWVuc2lvbnMgb2YgdGhlIG5ldyBhcnJheS5cclxuICogQHJldHVybiB7TkRBcnJheX1cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLnJlc2hhcGUgPSBmdW5jdGlvbihuZXdTaGFwZSkge1xyXG5cdHJldHVybiB0aGlzLl9jb250ZXh0LnJlc2hhcGUodGhpcywgbmV3U2hhcGUpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIER1cGxpY2F0ZXMgYXJyYXkgZWxlbWVudHMgYWxvbmcgdGhlIHNwZWNpZmllZCBheGlzLlxyXG4gKlxyXG4gKiBAbWV0aG9kIHJlcGVhdFxyXG4gKiBAcGFyYW0ge051bWJlcn0gcmVwZWF0cyAtIHRoZSBudW1iZXIgb2YgdGltZXMgdG8gcmVwZWF0IGVhY2ggZWxlbWVudC5cclxuICogQHBhcmFtIHtOdW1iZXJ9IGF4aXMgLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgZWxlbWVudHMgd2lsbCBiZSBkdXBsaWNhdGVkLlxyXG4gKiBAcmV0dXJuIHtOREFycmF5fVxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUucmVwZWF0ID0gZnVuY3Rpb24ocmVwZWF0cywgYXhpcykge1xyXG5cdHJldHVybiB0aGlzLl9jb250ZXh0LnJlcGVhdCh0aGlzLCByZXBlYXRzLCBheGlzKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb252ZXJ0cyB0aGUgZGF0YSB0byBhIEphdmFTY3JpcHQgQXJyYXkuXHJcbiAqXHJcbiAqIEBtZXRob2QgZ2V0XHJcbiAqIEBhc3luY1xyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcclxuXHR0aGlzLl9jb250ZXh0LmdldCh0aGlzLCBjYWxsYmFjayk7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE5EQXJyYXk7XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5cclxudmFyIE5EQXJyYXkgPSByZXF1aXJlKFwiLi9OREFycmF5XCIpO1xyXG52YXIgRGF0YVR5cGUgPSByZXF1aXJlKFwiLi9EYXRhVHlwZVwiKTtcclxudmFyIGFsbG9jYXRvciA9IHJlcXVpcmUoXCIuL2FsbG9jYXRvclwiKTtcclxudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xyXG5cclxudmFyIHNjcmlwdERpcmVjdG9yeSA9IFwiXCI7XHJcbnRyeSB7XHJcblx0dmFyIHNjcmlwdHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInNjcmlwdFwiKTtcclxuXHRmb3IgKHZhciBpID0gc2NyaXB0cy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xyXG5cdFx0dmFyIHBhdGggPSBzY3JpcHRzW2ldLnNyYztcclxuXHRcdC8qIFJlbW92ZSB1cmwtZW5jb2RlZCBwYXJhbWV0ZXJzICovXHJcblx0XHRwYXRoID0gcGF0aC5zcGxpdChcIj9cIilbMF07XHJcblx0XHR2YXIgc2VwYXJhdG9yUG9zID0gcGF0aC5sYXN0SW5kZXhPZihcIi9cIik7XHJcblx0XHR2YXIgc2NyaXB0TmFtZSA9IHBhdGguc3Vic3RyaW5nKHNlcGFyYXRvclBvcyArIDEpO1xyXG5cdFx0aWYgKChzY3JpcHROYW1lID09PSBcImZ1cmlvdXMuanNcIikgfHwgKHNjcmlwdE5hbWUgPT09IFwiZnVyaW91cy5taW4uanNcIikpe1xyXG5cdFx0XHRzY3JpcHREaXJlY3RvcnkgPSBwYXRoLnN1YnN0cmluZygwLCBzZXBhcmF0b3JQb3MgKyAxKTtcclxuXHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0fVxyXG59IGNhdGNoIChlKSB7XHJcbn1cclxuXHJcbnZhciBtZXNzYWdlQ2FsbGJhY2tzID0ge307XHJcblxyXG52YXIgb25QTmFDbE1lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlKSB7XHJcblx0dmFyIHJlc3VsdCA9IG1lc3NhZ2UuZGF0YTtcclxuXHR2YXIgaWQgPSByZXN1bHQuaWQ7XHJcblx0aWYgKHJlc3VsdC5zdGF0dXMgPT0gXCJlcnJvclwiKSB7XHJcblx0XHRjb25zb2xlLmxvZyhcIkVycm9yOiBcIiArIHJlc3VsdC5kZXNjcmlwdGlvbik7XHJcblx0fVxyXG5cdGlmIChpZCBpbiBtZXNzYWdlQ2FsbGJhY2tzKSB7XHJcblx0XHRpZiAoXCJidWZmZXJcIiBpbiByZXN1bHQpIHtcclxuXHRcdFx0bWVzc2FnZUNhbGxiYWNrc1tpZF0ocmVzdWx0LmJ1ZmZlcik7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRtZXNzYWdlQ2FsbGJhY2tzW2lkXSgpO1xyXG5cdFx0fVxyXG5cdFx0ZGVsZXRlIG1lc3NhZ2VDYWxsYmFja3NbaWRdO1xyXG5cdH1cclxufTtcclxuXHJcbmZ1bmN0aW9uIFBOYUNsQ29udGV4dChjYWxsYmFjaykge1xyXG5cdHZhciBjb250ZXh0ID0gdGhpcztcclxuXHR0aGlzLl9wbmFjbE9iamVjdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJvYmplY3RcIik7XHJcblx0dGhpcy5fcG5hY2xPYmplY3Qud2lkdGggPSAwO1xyXG5cdHRoaXMuX3BuYWNsT2JqZWN0LmhlaWdodCA9IDA7XHJcblx0dGhpcy5fcG5hY2xPYmplY3QuZGF0YSA9IHNjcmlwdERpcmVjdG9yeSArIFwiZnVyaW91cy5ubWZcIjtcclxuXHR0aGlzLl9wbmFjbE9iamVjdC50eXBlID0gXCJhcHBsaWNhdGlvbi94LXBuYWNsXCI7XHJcblx0dGhpcy5fcG5hY2xPYmplY3QuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIiwgZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIG1lc3NhZ2VJZCA9IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKTtcclxuXHRcdG1lc3NhZ2VDYWxsYmFja3NbbWVzc2FnZUlkXSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRjYWxsYmFjayhjb250ZXh0KTtcclxuXHRcdH07XHJcblx0XHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcdFwiaWRcIjogbWVzc2FnZUlkLFxyXG5cdFx0XHRcImNvbW1hbmRcIjogXCJpbml0XCJcclxuXHRcdH0pO1xyXG5cdH0sIHRydWUpO1xyXG5cdHRoaXMuX3BuYWNsT2JqZWN0LmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIG9uUE5hQ2xNZXNzYWdlLCB0cnVlKTtcclxuXHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuX3BuYWNsT2JqZWN0KTtcclxufVxyXG5cclxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5lbXB0eSA9IGZ1bmN0aW9uKHNoYXBlLCBkYXRhVHlwZSkge1xyXG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcclxuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRkYXRhVHlwZSA9IG5ldyBEYXRhVHlwZShcImY2NFwiKTtcclxuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoZGF0YVR5cGUgKyBcIiBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgRGF0YVR5cGVcIik7XHJcblx0fVxyXG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XHJcblx0YXJyYXkuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcclxuXHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFwiY29tbWFuZFwiOiBcImVtcHR5XCIsXHJcblx0XHRcInNoYXBlXCI6IG5ldyBVaW50MzJBcnJheShzaGFwZSkuYnVmZmVyLFxyXG5cdFx0XCJkYXRhdHlwZVwiOiBkYXRhVHlwZS50eXBlLFxyXG5cdFx0XCJvdXRcIjogYXJyYXkuX2lkXHJcblx0fSk7XHJcblx0cmV0dXJuIGFycmF5O1xyXG59O1xyXG5cclxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS56ZXJvcyA9IGZ1bmN0aW9uKHNoYXBlLCBkYXRhVHlwZSkge1xyXG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcclxuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRkYXRhVHlwZSA9IG5ldyBEYXRhVHlwZShcImY2NFwiKTtcclxuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoZGF0YVR5cGUgKyBcIiBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgRGF0YVR5cGVcIik7XHJcblx0fVxyXG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XHJcblx0YXJyYXkuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcclxuXHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFwiY29tbWFuZFwiOiBcInplcm9zXCIsXHJcblx0XHRcInNoYXBlXCI6IG5ldyBVaW50MzJBcnJheShzaGFwZSkuYnVmZmVyLFxyXG5cdFx0XCJkYXRhdHlwZVwiOiBkYXRhVHlwZS50eXBlLFxyXG5cdFx0XCJvdXRcIjogYXJyYXkuX2lkXHJcblx0fSk7XHJcblx0cmV0dXJuIGFycmF5O1xyXG59O1xyXG5cclxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5vbmVzID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XHJcblx0c2hhcGUgPSB1dGlsLmNoZWNrU2hhcGUoc2hhcGUpO1xyXG5cdGlmICh0eXBlb2YgZGF0YVR5cGUgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xyXG5cdH0gZWxzZSBpZiAoIShkYXRhVHlwZSBpbnN0YW5jZW9mIERhdGFUeXBlKSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihkYXRhVHlwZSArIFwiIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBEYXRhVHlwZVwiKTtcclxuXHR9XHJcblx0dmFyIGFycmF5ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCB0aGlzKTtcclxuXHRhcnJheS5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xyXG5cdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxyXG5cdFx0XCJjb21tYW5kXCI6IFwib25lc1wiLFxyXG5cdFx0XCJzaGFwZVwiOiBuZXcgVWludDMyQXJyYXkoc2hhcGUpLmJ1ZmZlcixcclxuXHRcdFwiZGF0YXR5cGVcIjogZGF0YVR5cGUudHlwZSxcclxuXHRcdFwib3V0XCI6IGFycmF5Ll9pZFxyXG5cdH0pO1xyXG5cdHJldHVybiBhcnJheTtcclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUuYXJyYXkgPSBmdW5jdGlvbihkYXRhLCBkYXRhVHlwZSkge1xyXG5cdHZhciBzaGFwZSA9IFtdO1xyXG5cdHV0aWwuZGlzY292ZXJBcnJheVNoYXBlUmVjdXJzaXZlKGRhdGEsIHNoYXBlLCAwKTtcclxuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRkYXRhVHlwZSA9IG5ldyBEYXRhVHlwZShcImY2NFwiKTtcclxuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoZGF0YVR5cGUgKyBcIiBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgRGF0YVR5cGVcIik7XHJcblx0fVxyXG5cdHZhciBuZGFycmF5ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCB0aGlzKTtcclxuXHRuZGFycmF5Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XHJcblx0dmFyIGJ1ZmZlciA9IG5ldyBkYXRhVHlwZS5hcnJheVR5cGUobmRhcnJheS5sZW5ndGgpO1xyXG5cdHV0aWwuY29weUFycmF5RGF0YVJlY3Vyc2l2ZShidWZmZXIsIGRhdGEsIHNoYXBlLCAwLCAwKTtcclxuXHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFwiY29tbWFuZFwiOiBcImFycmF5XCIsXHJcblx0XHRcInNoYXBlXCI6IG5ldyBVaW50MzJBcnJheShzaGFwZSkuYnVmZmVyLFxyXG5cdFx0XCJkYXRhdHlwZVwiOiBkYXRhVHlwZS50eXBlLFxyXG5cdFx0XCJidWZmZXJcIjogYnVmZmVyLmJ1ZmZlcixcclxuXHRcdFwib3V0XCI6IG5kYXJyYXkuX2lkXHJcblx0fSk7XHJcblx0cmV0dXJuIG5kYXJyYXk7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmxpbnNwYWNlID0gZnVuY3Rpb24oc3RhcnQsIHN0b3AsIHNhbXBsZXMsIGluY2x1ZGVTdG9wKSB7XHJcblx0aWYgKCF1dGlsLmlzUmVhbChzdGFydCkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3Ioc3RhcnQgKyBcIiBpcyBub3QgYSByZWFsIG51bWJlclwiKTtcclxuXHR9XHJcblx0aWYgKCF1dGlsLmlzUmVhbChzdG9wKSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzdG9wICsgXCIgaXMgbm90IGEgcmVhbCBudW1iZXJcIik7XHJcblx0fVxyXG5cdGlmICh0eXBlb2Ygc2FtcGxlcyA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0LyogRGVmYXVsdCB2YWx1ZSBpbiBOdW1QeSAqL1xyXG5cdFx0c2FtcGxlcyA9IDUwO1xyXG5cdH0gZWxzZSBpZiAoIXV0aWwuaXNJbnQoc2FtcGxlcykpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3Ioc2FtcGxlcyArIFwiIGlzIG5vdCBhbiBpbnRlZ2VyXCIpO1xyXG5cdH0gZWxzZSBpZiAoc2FtcGxlcyA8PSAwKSB7XHJcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBudW1iZXIgb2Ygc2FtcGxlcyBtdXN0IGJlIHBvc2l0aXZlXCIpO1xyXG5cdH1cclxuXHRpZiAodHlwZW9mIGluY2x1ZGVTdG9wID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRpbmNsdWRlU3RvcCA9IHRydWU7XHJcblx0fVxyXG5cdGlmIChpbmNsdWRlU3RvcCAmJiAoc2FtcGxlcyA9PT0gMSkpIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVGhlIG51bWJlciBvZiBzYW1wbGVzIG11c3QgYmUgYSBsZWFzdCAyIChmb3Igc3RhcnQgYW5kIGVuZCBwb2ludHMpXCIpO1xyXG5cdH1cclxuXHR2YXIgZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XHJcblx0dmFyIGFycmF5ID0gbmV3IE5EQXJyYXkoW3NhbXBsZXNdLCBkYXRhVHlwZSwgdGhpcyk7XHJcblx0YXJyYXkuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcclxuXHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFwiY29tbWFuZFwiOiBcImxpbnNwYWNlXCIsXHJcblx0XHRcInN0YXJ0XCI6ICtzdGFydCxcclxuXHRcdFwic3RvcFwiOiArc3RvcCxcclxuXHRcdFwic2FtcGxlc1wiOiBzYW1wbGVzfDAsXHJcblx0XHRcImNsb3NlZFwiOiAhIWluY2x1ZGVTdG9wLFxyXG5cdFx0XCJkYXRhdHlwZVwiOiBkYXRhVHlwZS50eXBlLFxyXG5cdFx0XCJvdXRcIjogYXJyYXkuX2lkXHJcblx0fSk7XHJcblx0cmV0dXJuIGFycmF5O1xyXG59O1xyXG5cclxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5yZXNoYXBlID0gZnVuY3Rpb24oYSwgc2hhcGUpIHtcclxuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XHJcblx0c2hhcGUgPSB1dGlsLmNoZWNrU2hhcGUoc2hhcGUpO1xyXG5cdGlmICh1dGlsLmNvbXB1dGVMZW5ndGgoc2hhcGUpICE9PSBhLmxlbmd0aCkge1xyXG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJUaGUgc2hhcGUgaXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgYXJyYXlcIik7XHJcblx0fVxyXG5cdHZhciByZWxlYXNlQXJyYXkgPSAhYS5fZGVjUmVmKCk7XHJcblx0dmFyIG91dCA9IG5ldyBOREFycmF5KHNoYXBlLCBhLmRhdGFUeXBlLCB0aGlzKTtcclxuXHRpZiAocmVsZWFzZUFycmF5KSB7XHJcblx0XHRvdXQuX2lkID0gYS5faWQ7XHJcblx0XHRyZWxlYXNlQXJyYXkgPSBmYWxzZTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0b3V0Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XHJcblx0fVxyXG5cdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxyXG5cdFx0XCJjb21tYW5kXCI6IFwicmVzaGFwZVwiLFxyXG5cdFx0XCJhXCI6IChyZWxlYXNlQXJyYXkgPyAtYS5faWQgOiBhLl9pZCksXHJcblx0XHRcIm91dFwiOiBvdXQuX2lkLFxyXG5cdFx0XCJzaGFwZVwiOiBuZXcgVWludDMyQXJyYXkoc2hhcGUpLmJ1ZmZlclxyXG5cdH0pO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLnJlcGVhdCA9IGZ1bmN0aW9uKGEsIHJlcGVhdHMsIGF4aXMsIG91dCkge1xyXG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcclxuXHRyZXBlYXRzID0gdXRpbC5jaGVja1JlcGVhdHMocmVwZWF0cyk7XHJcblx0YXhpcyA9IHV0aWwuY2hlY2tBeGlzKGF4aXMsIGEuc2hhcGUubGVuZ3RoKTtcclxuXHR2YXIgc2hhcGVBID0gYS5zaGFwZTtcclxuXHR2YXIgc2hhcGVPdXQgPSBzaGFwZUEuc2xpY2UoMCk7XHJcblx0c2hhcGVPdXRbYXhpc10gKj0gcmVwZWF0cztcclxuXHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0b3V0ID0gbmV3IE5EQXJyYXkoc2hhcGVPdXQsIGEuZGF0YVR5cGUsIHRoaXMpO1xyXG5cdFx0b3V0Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShvdXQuc2hhcGUsIHNoYXBlT3V0KTtcclxuXHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XHJcblx0XHRvdXQuX2luY1JlZigpO1xyXG5cdH1cclxuXHR2YXIgcmVsZWFzZUEgPSAhYS5fZGVjUmVmKCk7XHJcblx0dGhpcy5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xyXG5cdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXHJcblx0XHRcImNvbW1hbmRcIjogXCJyZXBlYXRcIixcclxuXHRcdFwiYVwiOiAocmVsZWFzZUEgPyAtYS5faWQgOiBhLl9pZCksXHJcblx0XHRcIm91dFwiOiBvdXQuX2lkLFxyXG5cdFx0XCJyZXBlYXRzXCI6IHJlcGVhdHMsXHJcblx0XHRcImF4aXNcIjogYXhpc1xyXG5cdH0pO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLl9pbnZhbGlkYXRlID0gZnVuY3Rpb24oYXJyYXkpIHtcclxuXHRpZiAoYXJyYXkuX2lkICE9PSAwKSB7XHJcblx0XHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxyXG5cdFx0XHRcImNvbW1hbmRcIjogXCJmcmVlXCIsXHJcblx0XHRcdFwiaW5cIjogYXJyYXkuX2lkXHJcblx0XHR9KTtcclxuXHR9XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKCkge1xyXG5cdGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBhcmd1bWVudCBtaXNzaW5nXCIpO1xyXG5cdH1cclxuXHR2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdO1xyXG5cdC8qIFZhbGlkYXRlIGFyZ3VtZW50cyAqL1xyXG5cdGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdCBsZWFzdCBvbmUgTkRBcnJheSBhcmd1bWVudCBleHBlY3RlZFwiKTtcclxuXHR9XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoIC0gMTsgKytpKSB7XHJcblx0XHR1dGlsLmNoZWNrTkRBcnJheShhcmd1bWVudHNbaV0sIFwiYXJndW1lbnQgXCIgKyBpKTtcclxuXHR9XHJcblx0dmFyIHJlbGVhc2UgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aCAtIDE7ICsraSkge1xyXG5cdFx0cmVsZWFzZVtpXSA9ICFhcmd1bWVudHNbaV0uX2RlY1JlZigpO1xyXG5cdH1cclxuXHR2YXIgY2FsbGJhY2tXYWl0QXJndW1lbnRzID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7XHJcblx0dmFyIGNhbGxiYWNrQXJndW1lbnRzID0gbmV3IEFycmF5KGNhbGxiYWNrV2FpdEFyZ3VtZW50cyk7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja1dhaXRBcmd1bWVudHM7IGkrKykge1xyXG5cdFx0dmFyIGFycmF5ID0gYXJndW1lbnRzW2ldO1xyXG5cdFx0dmFyIG1lc3NhZ2VJZCA9IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKTtcclxuXHRcdGlmIChhcnJheS5zaGFwZS5sZW5ndGggPT09IDApIHtcclxuXHRcdFx0bWVzc2FnZUNhbGxiYWNrc1ttZXNzYWdlSWRdID0gKGZ1bmN0aW9uKGksIEFycmF5VHlwZSkge1xyXG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbihidWZmZXIpIHtcclxuXHRcdFx0XHRcdHZhciB0eXBlZEFycmF5ID0gbmV3IEFycmF5VHlwZShidWZmZXIpO1xyXG5cdFx0XHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSB0eXBlZEFycmF5WzBdO1xyXG5cdFx0XHRcdFx0aWYgKC0tY2FsbGJhY2tXYWl0QXJndW1lbnRzID09PSAwKSB7XHJcblx0XHRcdFx0XHRcdGNhbGxiYWNrLmFwcGx5KG51bGwsIGNhbGxiYWNrQXJndW1lbnRzKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9O1xyXG5cdFx0XHR9KShpLCBhcnJheS5kYXRhVHlwZS5hcnJheVR5cGUpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bWVzc2FnZUNhbGxiYWNrc1ttZXNzYWdlSWRdID0gKGZ1bmN0aW9uKGksIEFycmF5VHlwZSwgc2hhcGUpIHtcclxuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oYnVmZmVyKSB7XHJcblx0XHRcdFx0XHR2YXIganNhcnJheSA9IG5ldyBBcnJheShzaGFwZVswXSk7XHJcblx0XHRcdFx0XHR1dGlsLmNyZWF0ZUFycmF5UmVjdXJzaXZlKG5ldyBBcnJheVR5cGUoYnVmZmVyKSwganNhcnJheSwgc2hhcGUsIDAsIDApO1xyXG5cdFx0XHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBqc2FycmF5O1xyXG5cdFx0XHRcdFx0aWYgKC0tY2FsbGJhY2tXYWl0QXJndW1lbnRzID09PSAwKSB7XHJcblx0XHRcdFx0XHRcdGNhbGxiYWNrLmFwcGx5KG51bGwsIGNhbGxiYWNrQXJndW1lbnRzKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9O1xyXG5cdFx0XHR9KShpLCBhcnJheS5kYXRhVHlwZS5hcnJheVR5cGUsIGFycmF5LnNoYXBlKTtcclxuXHRcdH1cclxuXHRcdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFx0XCJpZFwiOiBtZXNzYWdlSWQsXHJcblx0XHRcdFwiY29tbWFuZFwiOiBcImdldFwiLFxyXG5cdFx0XHRcImluXCI6IChyZWxlYXNlW2ldID8gLWFycmF5Ll9pZCA6IGFycmF5Ll9pZClcclxuXHRcdH0pO1xyXG5cdH1cclxufTtcclxuXHJcbnZhciBiaW5hcnlBcml0aE9wID0gZnVuY3Rpb24oYSwgYiwgb3V0LCBjb250ZXh0LCBvcGVyYXRpb24pIHtcclxuXHR2YXIgc2hhcGVPdXQgPSBudWxsLCBkYXRhVHlwZU91dCA9IG51bGwsIHJlbGVhc2VBID0gZmFsc2UsIHJlbGVhc2VCID0gZmFsc2U7XHJcblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRzaGFwZU91dCA9IGEuc2hhcGU7XHJcblx0XHRkYXRhVHlwZU91dCA9IGEuZGF0YVR5cGU7XHJcblx0XHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoYS5zaGFwZSwgYi5zaGFwZSk7XHJcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIGIuZGF0YVR5cGUpO1xyXG5cdFx0fSBlbHNlIGlmICghdXRpbC5pc051bWJlcihiKSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiVW5zdXBwb3J0ZWQgdHlwZSBvZiBiXCIpO1xyXG5cdFx0fVxyXG5cdH0gZWxzZSBpZiAodXRpbC5pc051bWJlcihhKSkge1xyXG5cdFx0c2hhcGVPdXQgPSBiLnNoYXBlO1xyXG5cdFx0ZGF0YVR5cGVPdXQgPSBiLmRhdGFUeXBlO1xyXG5cdFx0dXRpbC5jaGVja05EQXJyYXkoYiwgXCJiXCIpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiVW5zdXBwb3J0ZWQgdHlwZSBvZiBhXCIpO1xyXG5cdH1cclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdHJlbGVhc2VBID0gIWEuX2RlY1JlZigpO1xyXG5cdH1cclxuXHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdHJlbGVhc2VCID0gIWIuX2RlY1JlZigpO1xyXG5cdH1cclxuXHR0cnkge1xyXG5cdFx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoc2hhcGVPdXQsIGRhdGFUeXBlT3V0LCBjb250ZXh0KTtcclxuXHRcdFx0aWYgKHJlbGVhc2VBKSB7XHJcblx0XHRcdFx0b3V0Ll9pZCA9IGEuX2lkO1xyXG5cdFx0XHRcdHJlbGVhc2VBID0gZmFsc2U7XHJcblx0XHRcdH0gZWxzZSBpZiAocmVsZWFzZUIpIHtcclxuXHRcdFx0XHRvdXQuX2lkID0gYi5faWQ7XHJcblx0XHRcdFx0cmVsZWFzZUIgPSBmYWxzZTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcclxuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoc2hhcGVPdXQsIG91dC5zaGFwZSk7XHJcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGRhdGFUeXBlT3V0LCBvdXQuZGF0YVR5cGUpO1xyXG5cdFx0XHRvdXQuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRcdGNvbnRleHQuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFx0XHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxyXG5cdFx0XHRcdFx0XCJjb21tYW5kXCI6IG9wZXJhdGlvbixcclxuXHRcdFx0XHRcdFwiYVwiOiAocmVsZWFzZUEgPyAtYS5faWQgOiBhLl9pZCksXHJcblx0XHRcdFx0XHRcImJcIjogKHJlbGVhc2VCID8gLWIuX2lkIDogYi5faWQpLFxyXG5cdFx0XHRcdFx0XCJvdXRcIjogb3V0Ll9pZFxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGNvbnRleHQuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFx0XHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxyXG5cdFx0XHRcdFx0XCJjb21tYW5kXCI6IG9wZXJhdGlvbiArIFwiY1wiLFxyXG5cdFx0XHRcdFx0XCJhXCI6IChyZWxlYXNlQSA/IC1hLl9pZCA6IGEuX2lkKSxcclxuXHRcdFx0XHRcdFwiYlwiOiBiLFxyXG5cdFx0XHRcdFx0XCJvdXRcIjogb3V0Ll9pZFxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpZiAoKG9wZXJhdGlvbiA9PSBcImFkZFwiKSB8fCAob3BlcmF0aW9uID09IFwibXVsXCIpKSB7XHJcblx0XHRcdFx0LyogQ29tbXV0YXRpdmUgb3BlcmF0aW9uOiBmbGlwIHRoZSBvcGVyYW5kcyAqL1xyXG5cdFx0XHRcdGNvbnRleHQuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFx0XHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxyXG5cdFx0XHRcdFx0XCJjb21tYW5kXCI6IG9wZXJhdGlvbiArIFwiY1wiLFxyXG5cdFx0XHRcdFx0XCJhXCI6IChyZWxlYXNlQiA/IC1iLl9pZCA6IGIuX2lkKSxcclxuXHRcdFx0XHRcdFwiYlwiOiBhLFxyXG5cdFx0XHRcdFx0XCJvdXRcIjogb3V0Ll9pZFxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGNvbnRleHQuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFx0XHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxyXG5cdFx0XHRcdFx0XCJjb21tYW5kXCI6IFwiclwiICsgb3BlcmF0aW9uICsgXCJjXCIsXHJcblx0XHRcdFx0XHRcImFcIjogYixcclxuXHRcdFx0XHRcdFwiYlwiOiAocmVsZWFzZUEgPyAtYS5faWQgOiBhLl9pZCksXHJcblx0XHRcdFx0XHRcIm91dFwiOiBvdXQuX2lkXHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9IGNhdGNoIChlKSB7XHJcblx0XHQvKiBSZXN0b3JlIHRoZSBwcmV2aW91cyBzdGF0ZSAqL1xyXG5cdFx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRcdGEuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRcdGIuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdFx0dGhyb3cgZTtcclxuXHR9XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcbnZhciB1bmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xyXG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcclxuXHR2YXIgcmVsZWFzZUEgPSAhYS5fZGVjUmVmKCk7XHJcblx0dHJ5IHtcclxuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRcdG91dCA9IG5ldyBOREFycmF5KGEuc2hhcGUsIGEuZGF0YVR5cGUsIGNvbnRleHQpO1xyXG5cdFx0XHRpZiAocmVsZWFzZUEpIHtcclxuXHRcdFx0XHRvdXQuX2lkID0gYS5faWQ7XHJcblx0XHRcdFx0cmVsZWFzZUEgPSBmYWxzZTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcclxuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoYS5zaGFwZSwgb3V0LnNoYXBlKTtcclxuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcclxuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHR9IGNhdGNoIChlKSB7XHJcblx0XHQvKiBSZXN0b3JlIHRoZSBwcmV2aW91cyBzdGF0ZSAqL1xyXG5cdFx0YS5faW5jUmVmKCk7XHJcblx0XHR0aHJvdyBlO1xyXG5cdH1cclxuXHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24sXHJcblx0XHRcImFcIjogKHJlbGVhc2VBID8gLWEuX2lkIDogYS5faWQpLFxyXG5cdFx0XCJvdXRcIjogb3V0Ll9pZFxyXG5cdH0pO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG52YXIgcmVkdWNlQXJpdGhPcCA9IGZ1bmN0aW9uKGEsIG91dCwgY29udGV4dCwgb3BlcmF0aW9uKSB7XHJcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xyXG5cdHZhciByZWxlYXNlQSA9ICFhLl9kZWNSZWYoKTtcclxuXHR0cnkge1xyXG5cdFx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoW10sIGEuZGF0YVR5cGUsIGNvbnRleHQpO1xyXG5cdFx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KG91dC5zaGFwZSwgW10pO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xyXG5cdFx0XHRvdXQuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXHJcblx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGNvbnRleHQuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxyXG5cdFx0XCJjb21tYW5kXCI6IG9wZXJhdGlvbixcclxuXHRcdFwiYVwiOiAocmVsZWFzZUEgPyAtYS5faWQgOiBhLl9pZCksXHJcblx0XHRcIm91dFwiOiBvdXQuX2lkXHJcblx0fSk7XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcbnZhciBheGlzUmVkdWNlQXJpdGhPcCA9IGZ1bmN0aW9uKGEsIGF4aXMsIG91dCwgY29udGV4dCwgb3BlcmF0aW9uKSB7XHJcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xyXG5cdHZhciByZWxlYXNlQSA9ICFhLl9kZWNSZWYoKTtcclxuXHR0cnkge1xyXG5cdFx0dXRpbC5jaGVja0F4aXMoYXhpcyk7XHJcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheSh1dGlsLmNvbXB1dGVBeGlzUmVkdWN0aW9uT3V0U2hhcGUoYS5zaGFwZSwgYXhpcyksIGEuZGF0YVR5cGUsIGNvbnRleHQpO1xyXG5cdFx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KG91dC5zaGFwZSwgW10pO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xyXG5cdFx0XHRvdXQuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXHJcblx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGNvbnRleHQuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxyXG5cdFx0XCJjb21tYW5kXCI6IG9wZXJhdGlvbixcclxuXHRcdFwiYVwiOiAocmVsZWFzZUEgPyAtYS5faWQgOiBhLl9pZCksXHJcblx0XHRcImF4aXNcIjogYXhpc3wwLFxyXG5cdFx0XCJvdXRcIjogb3V0Ll9pZFxyXG5cdH0pO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG52YXIgZG90QXJpdGhPcCA9IGZ1bmN0aW9uKGEsIGIsIG91dCwgY29udGV4dCkge1xyXG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcclxuXHR1dGlsLmNoZWNrTkRBcnJheShiLCBcImJcIik7XHJcblx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XHJcblx0dmFyIHJlbGVhc2VBID0gIWEuX2RlY1JlZigpO1xyXG5cdHZhciByZWxlYXNlQiA9ICFiLl9kZWNSZWYoKTtcclxuXHR0cnkge1xyXG5cdFx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0dmFyIHNoYXBlQSA9IGEuc2hhcGU7XHJcblx0XHRcdHZhciBzaGFwZUIgPSBiLnNoYXBlO1xyXG5cdFx0XHR2YXIgYXhpc0EgPSBNYXRoLm1heChzaGFwZUEubGVuZ3RoIC0gMSwgMCk7XHJcblx0XHRcdHZhciBheGlzQiA9IE1hdGgubWF4KHNoYXBlQi5sZW5ndGggLSAyLCAwKTtcclxuXHRcdFx0aWYgKHNoYXBlQVtheGlzQV0gIT0gc2hhcGVCW2F4aXNCXSkge1xyXG5cdFx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJNaXNtYXRjaCBpbiByZWR1Y3Rpb24gZGltZW5zaW9uc1wiKTtcclxuXHRcdFx0fVxyXG5cdFx0XHR2YXIgc2hhcGVPdXQgPSBbXTtcclxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBheGlzQTsgaSsrKSB7XHJcblx0XHRcdFx0c2hhcGVPdXQucHVzaChzaGFwZUFbaV0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChzaGFwZUIubGVuZ3RoID4gMSkge1xyXG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXhpc0I7IGkrKykge1xyXG5cdFx0XHRcdFx0c2hhcGVPdXQucHVzaChzaGFwZUJbaV0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRzaGFwZU91dC5wdXNoKHNoYXBlQltzaGFwZUIubGVuZ3RoIC0gMV0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdG91dCA9IG5ldyBOREFycmF5KHNoYXBlT3V0LCBhLmRhdGFUeXBlLCBjb250ZXh0KTtcclxuXHRcdFx0b3V0Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XHJcblx0XHR9IGVsc2UgaWYgKG91dCBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcclxuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xyXG5cdFx0fVxyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXHJcblx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdGIuX2luY1JlZigpO1xyXG5cdFx0dGhyb3cgZTtcclxuXHR9XHJcblx0Y29udGV4dC5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xyXG5cdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXHJcblx0XHRcImNvbW1hbmRcIjogXCJkb3RcIixcclxuXHRcdFwiYVwiOiAocmVsZWFzZUEgPyAtYS5faWQgOiBhLl9pZCksXHJcblx0XHRcImJcIjogKHJlbGVhc2VCID8gLWIuX2lkIDogYi5faWQpLFxyXG5cdFx0XCJvdXRcIjogb3V0Ll9pZFxyXG5cdH0pO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJhZGRcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLnN1YiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJzdWJcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLm11bCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJtdWxcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmRpdiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJkaXZcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLm5lZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcIm5lZ1wiKTtcclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUuYWJzID0gZnVuY3Rpb24oYSwgb3V0KSB7XHJcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwiYWJzXCIpO1xyXG59O1xyXG5cclxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5leHAgPSBmdW5jdGlvbihhLCBvdXQpIHtcclxuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywgXCJleHBcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmxvZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcImxvZ1wiKTtcclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUuc3FydCA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcInNxcnRcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLnNxdWFyZSA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcInNxdWFyZVwiKTtcclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUubWluID0gZnVuY3Rpb24oYSwgYXhpcykge1xyXG5cdGlmICh0eXBlb2YgYXhpcyA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0cmV0dXJuIHJlZHVjZUFyaXRoT3AoYSwgdW5kZWZpbmVkLCB0aGlzLCBcIm1pblwiKTtcclxuXHR9IGVsc2UgaWYgKHV0aWwuaXNJbnQoYXhpcykpIHtcclxuXHRcdHJldHVybiBheGlzUmVkdWNlQXJpdGhPcChhLCBheGlzLCB1bmRlZmluZWQsIHRoaXMsIFwiYW1pblwiKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIGF4aXMgdHlwZVwiKTtcclxuXHR9XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLm1heCA9IGZ1bmN0aW9uKGEsIGF4aXMpIHtcclxuXHRpZiAodHlwZW9mIGF4aXMgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdHJldHVybiByZWR1Y2VBcml0aE9wKGEsIHVuZGVmaW5lZCwgdGhpcywgXCJtYXhcIik7XHJcblx0fSBlbHNlIGlmICh1dGlsLmlzSW50KGF4aXMpKSB7XHJcblx0XHRyZXR1cm4gYXhpc1JlZHVjZUFyaXRoT3AoYSwgYXhpcywgdW5kZWZpbmVkLCB0aGlzLCBcImFtYXhcIik7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCBheGlzIHR5cGVcIik7XHJcblx0fVxyXG59O1xyXG5cclxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5zdW0gPSBmdW5jdGlvbihhLCBheGlzKSB7XHJcblx0aWYgKHR5cGVvZiBheGlzID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRyZXR1cm4gcmVkdWNlQXJpdGhPcChhLCB1bmRlZmluZWQsIHRoaXMsIFwic3VtXCIpO1xyXG5cdH0gZWxzZSBpZiAodXRpbC5pc0ludChheGlzKSkge1xyXG5cdFx0cmV0dXJuIGF4aXNSZWR1Y2VBcml0aE9wKGEsIGF4aXMsIHVuZGVmaW5lZCwgdGhpcywgXCJhc3VtXCIpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiVW5zdXBwb3J0ZWQgYXhpcyB0eXBlXCIpO1xyXG5cdH1cclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUuZG90ID0gZnVuY3Rpb24oYSwgYiwgb3V0KSB7XHJcblx0cmV0dXJuIGRvdEFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzKTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUE5hQ2xDb250ZXh0O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBtZXNzYWdlSWQgPSAxO1xyXG52YXIgYXJyYXlJZCA9IDE7XHJcblxyXG5leHBvcnRzLm5ld01lc3NhZ2VJZCA9IGZ1bmN0aW9uKCkge1xyXG5cdHZhciBpZCA9IG1lc3NhZ2VJZDtcclxuXHRtZXNzYWdlSWQgPSAobWVzc2FnZUlkKzEpfDA7XHJcblx0cmV0dXJuIGlkO1xyXG59O1xyXG5cclxuZXhwb3J0cy5uZXdBcnJheUlkID0gZnVuY3Rpb24gKCkge1xyXG5cdHZhciBpZCA9IGFycmF5SWQ7XHJcblx0YXJyYXlJZCA9IChhcnJheUlkKzEpfDA7XHJcblx0cmV0dXJuIGlkO1xyXG59O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiBQcm92aWRlcyBpbmZvcm1hdGlvbiBhbmQgc3VwcG9ydCBmdW5jdGlvbnNcclxuICpcclxuICogQGNsYXNzIGZ1cmlvdXNcclxuICovXHJcblxyXG52YXIgRGF0YVR5cGUgPSByZXF1aXJlKFwiLi9EYXRhVHlwZVwiKTtcclxudmFyIEpTQ29udGV4dCA9IHJlcXVpcmUoXCIuL0pTQ29udGV4dFwiKTtcclxudmFyIFBOYUNsQ29udGV4dCA9IHJlcXVpcmUoXCIuL1BOYUNsQ29udGV4dFwiKTtcclxudmFyIFdlYkNMQ29udGV4dCA9IHJlcXVpcmUoXCIuL3dlYmNsL1dlYkNMQ29udGV4dFwiKTtcclxuXHJcbi8qKlxyXG4gKiBJbml0aWFsaXplcyBhIGNvbXB1dGF0aW9uYWwgY29udGV4dC5cclxuICpcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGluaXRcclxuICogQGFzeW5jXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbYmFja2VuZF0gLSBBIHN0cmluZyBpZGVudGlmaWVyIGZvciB0aGUgYmFja2VuZCB0byB1c2UuIFRoZSBmb2xsb3dpbmcgdmFsdWVzIGFyZSBzdXBwb3J0ZWQ6XHJcbiAqXHJcbiAqICAgICA8dGFibGU+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGg+QmFja2VuZCBJZGVudGlmaWVyPC90aD5cclxuICogICAgICAgICAgICAgPHRoPkludGVycHJldGF0aW9uPC90aD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwiamF2YXNjcmlwdFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPkphdmFTY3JpcHQgYmFja2VuZC4gV29ya3MgaW4gYWxsIGJyb3dzZXJzIGFuZCBOb2RlLmpzLCBidXQgY2FuIG5vdCBkZWxpdmVyIG9wdGltYWwgcGVyZm9ybWFuY2UuPC90ZD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwicG5hY2xcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5Qb3J0YWJsZSBOYXRpdmUgQ2xpZW50IChQTmFDbCkgYmFja2VuZC4gV29ya3MgaW4gQ2hyb21pdW0tYmFzZWQgYnJvd3NlcnMuIENhbiBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucyB0aHJvdWdoIHRoZSB1c2Ugb2YgYWR2YW5jZWQgQ1BVIG9wdGltaXphdGlvbiB0ZWNobm9sb2dpZXMsIHN1Y2ggYXMgbXVsdGktdGhyZWFkaW5nIGFuZCBTSU1EIGluc3RydWN0aW9ucy48L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJ3ZWJjbFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPldlYkNMIGJhY2tlbmQuIFdvcmtzIGluIGJyb3dzZXJzIGFuZCBOb2RlLmpzIHdoZW4gYSBXZWJDTCBwbHVnaW4gaXMgYXZhaWxhYmxlLiBDYW4gdXNlIGZ1bGwgcG93ZXIgb2YgQ1BVcyBhbmQgR1BVcyB0byBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucy48L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICA8L3RhYmxlPlxyXG4gKlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgYmFja2VuZCBmaW5pc2ggaW5pdGlhbGl6YXRpb24uXHJcbiAqIEBwYXJhbSB7Q29udGV4dH0gY2FsbGJhY2suY29udGV4dCAtIEEgcmVhZHkgdG8gdXNlIGNvbXB1dGF0aW9uYWwgY29udGV4dC5cclxuICovXHJcbnZhciBpbml0ID0gZnVuY3Rpb24oYmFja2VuZCwgY2FsbGJhY2spIHtcclxuXHRpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRjYWxsYmFjayA9IGJhY2tlbmQ7XHJcblx0XHRiYWNrZW5kID0gdW5kZWZpbmVkO1xyXG5cdH1cclxuXHRpZiAodHlwZW9mIGJhY2tlbmQgPT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0YmFja2VuZCA9IGdldERlZmF1bHRCYWNrZW5kKCk7XHJcblx0fVxyXG5cdGlmIChiYWNrZW5kID09IFwiamF2YXNjcmlwdFwiKSB7XHJcblx0XHRyZXR1cm4gbmV3IEpTQ29udGV4dChjYWxsYmFjayk7XHJcblx0fSBlbHNlIGlmIChiYWNrZW5kID09IFwicG5hY2xcIikge1xyXG5cdFx0cmV0dXJuIG5ldyBQTmFDbENvbnRleHQoY2FsbGJhY2spO1xyXG5cdH0gZWxzZSBpZiAoYmFja2VuZCA9PSBcIndlYmNsXCIpIHtcclxuXHRcdHJldHVybiBuZXcgV2ViQ0xDb250ZXh0KGNhbGxiYWNrKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiVW5zdXBwb3J0ZWQgYmFja2VuZDogXCIgKyBiYWNrZW5kKTtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogRGV0ZWN0cyB0aGUgb3B0aW1hbCBiYWNrZW5kIHN1cHBvcnRlZCBieSB0aGUgYnJvd3NlciBvciBKYXZhU2NyaXB0IGVuZ2luZS5cclxuICpcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGdldERlZmF1bHRCYWNrZW5kXHJcbiAqXHJcbiAqIEByZXR1cm4ge1N0cmluZ30gLSBEZWZhdWx0IGJhY2tlbmQgaWRlbnRpZmllciBmcm9tIHRoZSBmb2xsb3dpbmcgdGFibGU6XHJcbiAqXHJcbiAqICAgICA8dGFibGU+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGg+QmFja2VuZCBJZGVudGlmaWVyPC90aD5cclxuICogICAgICAgICAgICAgPHRoPkludGVycHJldGF0aW9uPC90aD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwiamF2YXNjcmlwdFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPkphdmFTY3JpcHQgYmFja2VuZC4gV29ya3MgaW4gYWxsIGJyb3dzZXJzIGFuZCBOb2RlLmpzLCBidXQgY2FuIG5vdCBkZWxpdmVyIG9wdGltYWwgcGVyZm9ybWFuY2UuPC90ZD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwiYXNtanNcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5Bc20uanMgYmFja2VuZC4gV29ya3MgaW4gRmlyZWZveCAyOSBhbmQgbGF0ZXIuIENhbiBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucyB3aXRoIGEgbGltaXRlZCB1c2Ugb2YgbmF0aXZlIENQVSBpbnN0cnVjdGlvbnMuPC90ZD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwicG5hY2xcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5Qb3J0YWJsZSBOYXRpdmUgQ2xpZW50IChQTmFDbCkgYmFja2VuZC4gV29ya3MgaW4gQ2hyb21pdW0tYmFzZWQgYnJvd3NlcnMuIENhbiBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucyB0aHJvdWdoIHRoZSB1c2Ugb2YgYWR2YW5jZWQgQ1BVIG9wdGltaXphdGlvbiB0ZWNobm9sb2dpZXMsIHN1Y2ggYXMgbXVsdGktdGhyZWFkaW5nIGFuZCBTSU1EIGluc3RydWN0aW9ucy48L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJ3ZWJjbFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPldlYkNMIGJhY2tlbmQuIFdvcmtzIGluIGJyb3dzZXJzIGFuZCBOb2RlLmpzIHdoZW4gYSBXZWJDTCBwbHVnaW4gaXMgYXZhaWxhYmxlLiBDYW4gdXNlIGZ1bGwgcG93ZXIgb2YgQ1BVcyBhbmQgR1BVcyB0byBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucy48L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICA8L3RhYmxlPlxyXG4gKi9cclxudmFyIGdldERlZmF1bHRCYWNrZW5kID0gZnVuY3Rpb24oKSB7XHJcblx0aWYgKGhhc0ZlYXR1cmUoXCJ3ZWJjbFwiKSkge1xyXG5cdFx0cmV0dXJuIFwid2ViY2xcIjtcclxuXHR9IGVsc2UgaWYgKGhhc0ZlYXR1cmUoXCJwbmFjbFwiKSkge1xyXG5cdFx0cmV0dXJuIFwicG5hY2xcIjtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIFwiamF2YXNjcmlwdFwiO1xyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBEZXRlY3RzIHdoaWNoIGJhY2tlbmRzIGFyZSBzdXBwb3J0ZWQgYnkgdGhlIHN5c3RlbS5cclxuICpcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGdldFN1cHBvcnRlZEJhY2tlbmRzXHJcbiAqXHJcbiAqIEByZXR1cm4ge1N0cmluZ1tdfSAtIEFuIGFycmF5IG9mIHN1cHBvcnRlZCBiYWNrZW5kIGlkZW50aWZpZXJzIGluIHByaW9yaXR5IG9yZGVyIChwcmlvcml0aXplZCBiYWNrZW5kcyBmaXJzdCkuIFRoZSBmb2xsb3dpbmcgaWRlbnRpZmllcnMgY291bGQgYmUgcHJlc2VudDpcclxuICpcclxuICogICAgIDx0YWJsZT5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0aD5CYWNrZW5kIElkZW50aWZpZXI8L3RoPlxyXG4gKiAgICAgICAgICAgICA8dGg+SW50ZXJwcmV0YXRpb248L3RoPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJqYXZhc2NyaXB0XCI8L3RkPlxyXG4gKiAgICAgICAgICAgICA8dGQ+SmF2YVNjcmlwdCBiYWNrZW5kLiBXb3JrcyBpbiBhbGwgYnJvd3NlcnMgYW5kIE5vZGUuanMsIGJ1dCBjYW4gbm90IGRlbGl2ZXIgb3B0aW1hbCBwZXJmb3JtYW5jZS48L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJhc21qc1wiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPkFzbS5qcyBiYWNrZW5kLiBXb3JrcyBpbiBGaXJlZm94IDI5IGFuZCBsYXRlci4gQ2FuIGFjY2VsZXJhdGUgY29tcHV0YXRpb25zIHdpdGggYSBsaW1pdGVkIHVzZSBvZiBuYXRpdmUgQ1BVIGluc3RydWN0aW9ucy48L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJwbmFjbFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPlBvcnRhYmxlIE5hdGl2ZSBDbGllbnQgKFBOYUNsKSBiYWNrZW5kLiBXb3JrcyBpbiBDaHJvbWl1bS1iYXNlZCBicm93c2Vycy4gQ2FuIGFjY2VsZXJhdGUgY29tcHV0YXRpb25zIHRocm91Z2ggdGhlIHVzZSBvZiBhZHZhbmNlZCBDUFUgb3B0aW1pemF0aW9uIHRlY2hub2xvZ2llcywgc3VjaCBhcyBtdWx0aS10aHJlYWRpbmcgYW5kIFNJTUQgaW5zdHJ1Y3Rpb25zLjwvdGQ+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cIndlYmNsXCI8L3RkPlxyXG4gKiAgICAgICAgICAgICA8dGQ+V2ViQ0wgYmFja2VuZC4gV29ya3MgaW4gYnJvd3NlcnMgYW5kIE5vZGUuanMgd2hlbiBhIFdlYkNMIHBsdWdpbiBpcyBhdmFpbGFibGUuIENhbiB1c2UgZnVsbCBwb3dlciBvZiBDUFVzIGFuZCBHUFVzIHRvIGFjY2VsZXJhdGUgY29tcHV0YXRpb25zLjwvdGQ+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgIDwvdGFibGU+XHJcbiAqL1xyXG52YXIgZ2V0U3VwcG9ydGVkQmFja2VuZHMgPSBmdW5jdGlvbigpIHtcclxuXHR2YXIgYmFja2VuZHMgPSBbXTtcclxuXHRpZiAoaGFzRmVhdHVyZShcIndlYmNsXCIpKSB7XHJcblx0XHRiYWNrZW5kcy5wdXNoKFwid2ViY2xcIik7XHJcblx0fVxyXG5cdGlmIChoYXNGZWF0dXJlKFwicG5hY2xcIikpIHtcclxuXHRcdGJhY2tlbmRzLnB1c2goXCJwbmFjbFwiKTtcclxuXHR9XHJcblx0aWYgKGhhc0ZlYXR1cmUoXCJhc20uanNcIikpIHtcclxuXHRcdGJhY2tlbmRzLnB1c2goXCJhc20uanNcIik7XHJcblx0fVxyXG5cdGJhY2tlbmRzLnB1c2goXCJqYXZhc2NyaXB0XCIpO1xyXG5cdHJldHVybiBiYWNrZW5kcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBEZXRlY3RzIHdoZXRoZXIgdGhlIHJlcXVlc3RlZCBjb21wdXRpbmcgZmVhdHVyZSBpcyBhdmFpbGFibGVcclxuICpcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGhhc0ZlYXR1cmVcclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSBhbiBpZGVudGlmaWVyIG9mIHRoZSBvcHRpb25hbCBmZWF0dXJlIHRvIGRldGVjdC4gVGhlIGZvbGxvd2luZyBpZGVudGlmaWVycyBhcmUgc3VwcG9ydGVkOlxyXG4gKlxyXG4gKiAgICAgPHRhYmxlPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRoPkZlYXR1cmUgSWRlbnRpZmllcjwvdGg+XHJcbiAqICAgICAgICAgICAgIDx0aD5JbnRlcnByZXRhdGlvbjwvdGg+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cImFzbS5qc1wiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPkRldGVjdCBpZiB0aGUgSmF2YVNjcmlwdCBlbmdpbmUgcmVjb2duaXplcyBBc20uanMgZGlyZWN0aXZlLjwvdGQ+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cInNpbWQuanNcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5EZXRlY3QgaWYgdGhlIEphdmFTY3JpcHQgZW5naW5lIHByb3ZpZGUgU0lNRC5mbG9hdDMyeDQsIFNJTUQuaW50MzJ4NCwgRmxvYXQzMng0QXJyYXksIGFuZCBJbnQzMng0QXJyYXkgb2YgU0lNRC5qczwvdGQ+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cIndlYmdsXCI8L3RkPlxyXG4gKiAgICAgICAgICAgICA8dGQ+RGV0ZWN0IGlmIHRoZSBicm93c2VyIHN1cHBvcnRzIFdlYkdMIChlaXRoZXIgZXhwZXJpbWVudGFsIG9yIHN0YWJsZSBpbXBsZW1lbnRhdGlvbik8L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJ3ZWJjbFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPkRldGVjdCBpZiB0aGUgYnJvd3NlciBzdXBwb3J0cyBXZWJDTDwvdGQ+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cInBuYWNsXCI8L3RkPlxyXG4gKiAgICAgICAgICAgICA8dGQ+RGV0ZWN0IGlmIFBvcnRhYmxlIE5hdGl2ZSBDbGllbnQgKFBOYUNsKSBpcyBzdXBwb3J0ZWQgYW5kIGVuYWJsZWQ8L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJuYWNsXCI8L3RkPlxyXG4gKiAgICAgICAgICAgICA8dGQ+RGV0ZWN0IGlmIE5hdGl2ZSBDbGllbnQgKE5hQ2wpIGlzIHN1cHBvcnRlZCBhbmQgZW5hYmxlZDwvdGQ+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgIDwvdGFibGU+XHJcbiAqXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gdHJ1ZSBpZiB0aGUgZmVhdHVyZSBpcyBzdXBwb3J0ZWQsIGZhbHNlIG90aGVyd2lzZVxyXG4gKi9cclxudmFyIGhhc0ZlYXR1cmUgPSBmdW5jdGlvbihuYW1lKSB7XHJcblx0c3dpdGNoIChuYW1lKSB7XHJcblx0XHRjYXNlIFwiYXNtLmpzXCI6XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dmFyIHVzZXJBZ2VudCA9IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50O1xyXG5cdFx0XHRcdHZhciB1c2VyQWdlbnRDb21wb25lbnRzID0gdXNlckFnZW50LnNwbGl0KC9cXHMrLyk7XHJcblx0XHRcdFx0dmFyIGZpcmVmb3hSZWdleHAgPSAvW0ZmXWlyZWZveFxcLyhcXGQrKS9nO1xyXG5cdFx0XHRcdGZvciAodmFyIGNvbXBvbmVudCBpbiB1c2VyQWdlbnRDb21wb25lbnRzKSB7XHJcblx0XHRcdFx0XHR2YXIgbWF0Y2ggPSBmaXJlZm94UmVnZXhwLmV4ZWMoY29tcG9uZW50KTtcclxuXHRcdFx0XHRcdGlmIChtYXRjaCAhPT0gbnVsbCkge1xyXG5cdFx0XHRcdFx0XHR2YXIgZmlyZWZveFZlcnNpb24gPSBwYXJzZUludChtYXRjaFswXSk7XHJcblx0XHRcdFx0XHRcdHJldHVybiBmaXJlZm94VmVyc2lvbiA+PSAyOTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0Y2FzZSBcInNpbWQuanNcIjpcclxuXHRcdFx0cmV0dXJuICh0eXBlb2YgU0lNRCAhPT0gXCJ1bmRlZmluZWRcIik7XHJcblx0XHRjYXNlIFwid2ViZ2xcIjpcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKGNhbnZhcy5nZXRDb250ZXh0KFwid2ViZ2xcIikgIT09IG51bGwpIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aWYgKGNhbnZhcy5nZXRDb250ZXh0KFwiZXhwZXJpbWVudGFsLXdlYmdsXCIpICE9PSBudWxsKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRjYXNlIFwid2ViY2xcIjpcclxuXHRcdFx0aWYgKHR5cGVvZiB3ZWJjbCAhPT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHR2YXIgcGxhdGZvcm1zID0gd2ViY2wuZ2V0UGxhdGZvcm1zKCk7XHJcblx0XHRcdFx0XHRyZXR1cm4gcGxhdGZvcm1zLmxlbmd0aCA+PSAxO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHZhciBjbCA9IHJlcXVpcmUoXCJub2RlLXdlYmNsXCIpO1xyXG5cdFx0XHRcdFx0dmFyIHBsYXRmb3JtcyA9IGNsLmdldFBsYXRmb3JtcygpO1xyXG5cdFx0XHRcdFx0cmV0dXJuIHBsYXRmb3Jtcy5sZW5ndGggPj0gMTtcclxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdGNhc2UgXCJwbmFjbFwiOlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHJldHVybiAodHlwZW9mIG5hdmlnYXRvci5taW1lVHlwZXNbXCJhcHBsaWNhdGlvbi94LXBuYWNsXCJdKSAhPT0gXCJ1bmRlZmluZWRcIjtcclxuXHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdGNhc2UgXCJuYWNsXCI6XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0cmV0dXJuICh0eXBlb2YgbmF2aWdhdG9yLm1pbWVUeXBlc1tcImFwcGxpY2F0aW9uL3gtbmFjbFwiXSkgIT09IFwidW5kZWZpbmVkXCI7XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRkZWZhdWx0OlxyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIGZlYXR1cmU6IFwiICsgbmFtZSk7XHJcblx0fVxyXG59O1xyXG5cclxuZXhwb3J0cy5pbml0ID0gaW5pdDtcclxuZXhwb3J0cy5oYXNGZWF0dXJlID0gaGFzRmVhdHVyZTtcclxuZXhwb3J0cy5nZXREZWZhdWx0QmFja2VuZCA9IGdldERlZmF1bHRCYWNrZW5kO1xyXG5leHBvcnRzLmdldFN1cHBvcnRlZEJhY2tlbmRzID0gZ2V0U3VwcG9ydGVkQmFja2VuZHM7XHJcbmV4cG9ydHMuRGF0YVR5cGUgPSBEYXRhVHlwZTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogSmF2YVNjcmlwdCBpbXBsZW1lbnRhdGlvbiBvZiBjb21wdXRhdGlvbmFsIG1ldGhvZHNcclxuICpcclxuICogQHByaXZhdGVcclxuICogQGNsYXNzIEpTTWF0aFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBTZXRzIGFsbCBhcnJheSBlbGVtZW50cyB0byB0aGUgc3BlY2lmaWVkIHZhbHVlLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YSAtIHRoZSBhcnJheSBkYXRhIGJ1ZmZlci5cclxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlIC0gdGhlIGNvbnN0YW50IHRvIGZpbGwgdGhlIGJ1ZmZlciB3aXRoLlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgZmlsbFxyXG4gKi9cclxuZXhwb3J0cy5maWxsID0gZnVuY3Rpb24oZGF0YSwgdmFsdWUpIHtcclxuXHR2YXIgbiA9IGRhdGEubGVuZ3RoO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcblx0XHRkYXRhW2ldID0gdmFsdWU7XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgdHdvIGFycmF5cy5cclxuICpcclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IGF1Z2VuZCBhcnJheS5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFCIC0gdGhlIGlucHV0IGFkZGVuZCBhcnJheS5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IHN1bSBhcnJheS5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGFkZFxyXG4gKi9cclxuZXhwb3J0cy5hZGQgPSBmdW5jdGlvbihkYXRhQSwgZGF0YUIsIGRhdGFPdXQpIHtcclxuXHR2YXIgbiA9IGRhdGFPdXQubGVuZ3RoO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcblx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gKyBkYXRhQltpXTtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogQWRkcyBhIGNvbnN0YW50IHRvIGFuIGFycmF5LlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXVnZW5kIGFycmF5LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWVCIC0gdGhlIGFkZGVuZCBjb25zdGFudC5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IHN1bSBhcnJheS5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGFkZENvbnN0XHJcbiAqL1xyXG5leHBvcnRzLmFkZENvbnN0ID0gZnVuY3Rpb24oZGF0YUEsIHZhbHVlQiwgZGF0YU91dCkge1xyXG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdGRhdGFPdXRbaV0gPSBkYXRhQVtpXSArIHZhbHVlQjtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogU3VidHJhY3RzIHR3byBhcnJheXMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBtaW51ZW5kIGFycmF5LlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUIgLSB0aGUgaW5wdXQgc3VidHJhaGVuZCBhcnJheS5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGRpZmZlcmVuY2UgYXJyYXkuXHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBzdWJcclxuICovXHJcbmV4cG9ydHMuc3ViID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFCLCBkYXRhT3V0KSB7XHJcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG5cdFx0ZGF0YU91dFtpXSA9IGRhdGFBW2ldIC0gZGF0YUJbaV07XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFN1YnRyYWN0cyBhIGNvbnN0YW50IGZyb20gYW4gYXJyYXkuXHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBtaW51ZW5kIGFycmF5LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWVCIC0gdGhlIHN1YnRyYWhlbmQgY29uc3RhbnQuXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBkaWZmZXJlbmNlIGFycmF5LlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2Qgc3ViQ29uc3RcclxuICovXHJcbmV4cG9ydHMuc3ViQ29uc3QgPSBmdW5jdGlvbihkYXRhQSwgdmFsdWVCLCBkYXRhT3V0KSB7XHJcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG5cdFx0ZGF0YU91dFtpXSA9IGRhdGFBW2ldIC0gdmFsdWVCO1xyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBTdWJ0cmFjdHMgYW4gYXJyYXkgZnJvbSBhIGNvbnN0YW50LlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgc3VidHJhaGVuZCBhcnJheS5cclxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlQiAtIHRoZSBtaW51ZW5kIGNvbnN0YW50LlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgZGlmZmVyZW5jZSBhcnJheS5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIHN1YlJldkNvbnN0XHJcbiAqL1xyXG5leHBvcnRzLnN1YlJldkNvbnN0ID0gZnVuY3Rpb24oZGF0YUEsIHZhbHVlQiwgZGF0YU91dCkge1xyXG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdGRhdGFPdXRbaV0gPSB2YWx1ZUIgLSBkYXRhQVtpXTtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogTXVsdGlwbGllcyB0d28gYXJyYXlzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgbXVsdGlwbGljYW5kIGFycmF5LlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUIgLSB0aGUgaW5wdXQgbXVsdGlwbGllciBhcnJheS5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IHByb2R1Y3QgYXJyYXkuXHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBtdWxcclxuICovXHJcbmV4cG9ydHMubXVsID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFCLCBkYXRhT3V0KSB7XHJcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG5cdFx0ZGF0YU91dFtpXSA9IGRhdGFBW2ldICogZGF0YUJbaV07XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIE11bHRpcGxpZXMgYW4gYXJyYXkgYnkgYSBjb25zdGFudC5cclxuICpcclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IG11bHRpcGxpY2FuZCBhcnJheS5cclxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlQiAtIHRoZSBtdWx0aXBsaWVyIGNvbnN0YW50LlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgcHJvZHVjdCBhcnJheS5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIG11bENvbnN0XHJcbiAqL1xyXG5leHBvcnRzLm11bENvbnN0ID0gZnVuY3Rpb24oZGF0YUEsIHZhbHVlQiwgZGF0YU91dCkge1xyXG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdGRhdGFPdXRbaV0gPSBkYXRhQVtpXSAqIHZhbHVlQjtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogRGl2aWRlcyB0d28gYXJyYXlzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgZGl2aWRlbmQgYXJyYXkuXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQiAtIHRoZSBpbnB1dCBkaXZpc29yIGFycmF5LlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgcXVvdGllbnQgYXJyYXkuXHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBkaXZcclxuICovXHJcbmV4cG9ydHMuZGl2ID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFCLCBkYXRhT3V0KSB7XHJcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG5cdFx0ZGF0YU91dFtpXSA9IGRhdGFBW2ldIC8gZGF0YUJbaV07XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIERpdmlkZXMgYW4gYXJyYXkgYnkgYSBjb25zdGFudC5cclxuICpcclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IGRpdmlkZW5kIGFycmF5LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWVCIC0gdGhlIGRpdmlzb3IgY29uc3RhbnQuXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBxdW90aWVudCBhcnJheS5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGRpdkNvbnN0XHJcbiAqL1xyXG5leHBvcnRzLmRpdkNvbnN0ID0gZnVuY3Rpb24oZGF0YUEsIHZhbHVlQiwgZGF0YU91dCkge1xyXG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdGRhdGFPdXRbaV0gPSBkYXRhQVtpXSAvIHZhbHVlQjtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogRGl2aWRlcyBhIGNvbnN0YW50IGJ5IGFuIGFycmF5LlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgZGl2aXNvciBhcnJheS5cclxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlQiAtIHRoZSBkaXZpZGVuZCBjb25zdGFudC5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IHF1b3RpZW50IGFycmF5LlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgZGl2UmV2Q29uc3RcclxuICovXHJcbmV4cG9ydHMuZGl2UmV2Q29uc3QgPSBmdW5jdGlvbihkYXRhQSwgdmFsdWVCLCBkYXRhT3V0KSB7XHJcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG5cdFx0ZGF0YU91dFtpXSA9IHZhbHVlQiAvIGRhdGFBW2ldO1xyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBOZWdhdGVzIGFuIGFycmF5LlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheS5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIG5lZ1xyXG4gKi9cclxuZXhwb3J0cy5uZWcgPSBmdW5jdGlvbihkYXRhQSwgZGF0YU91dCkge1xyXG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdGRhdGFPdXRbaV0gPSAtZGF0YUFbaV07XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIGFic29sdXRlIHZhbHVlIG9mIGFycmF5IGVsZW1lbnRzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheS5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGFic1xyXG4gKi9cclxuZXhwb3J0cy5hYnMgPSBmdW5jdGlvbihkYXRhQSwgZGF0YU91dCkge1xyXG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdGRhdGFPdXRbaV0gPSBNYXRoLmFicyhkYXRhQVtpXSk7XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIEV4cG9uZW50aWF0ZXMgYXJyYXkgZWxlbWVudHMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheS5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGFycmF5LlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgZXhwXHJcbiAqL1xyXG5leHBvcnRzLmV4cCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XHJcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG5cdFx0ZGF0YU91dFtpXSA9IE1hdGguZXhwKGRhdGFBW2ldKTtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogQ29tcHV0ZXMgbG9nYXJpdGhtIG9mIGFycmF5IGVsZW1lbnRzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheS5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGxvZ1xyXG4gKi9cclxuZXhwb3J0cy5sb2cgPSBmdW5jdGlvbihkYXRhQSwgZGF0YU91dCkge1xyXG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdGRhdGFPdXRbaV0gPSBNYXRoLmxvZyhkYXRhQVtpXSk7XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIHNxdWFyZSByb290IG9mIGFycmF5IGVsZW1lbnRzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheS5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIHNxcnRcclxuICovXHJcbmV4cG9ydHMuc3FydCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XHJcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG5cdFx0ZGF0YU91dFtpXSA9IE1hdGguc3FydChkYXRhQVtpXSk7XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNxdWFyZXMgYXJyYXkgZWxlbWVudHMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheS5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGFycmF5LlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2Qgc3F1YXJlXHJcbiAqL1xyXG5leHBvcnRzLnNxdWFyZSA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XHJcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG5cdFx0dmFyIGEgPSBkYXRhQVtpXTtcclxuXHRcdGRhdGFPdXRbaV0gPSBhICogYTtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogQ29tcHV0ZXMgdGhlIG1pbmltdW0gdmFsdWUgb2YgZWxlbWVudHMgaW4gYW4gYXJyYXkuXHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheSB0byBjb21wdXRlIG1pbmltdW0gb24uXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgbWluaW11bSBhdC5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIG1pblxyXG4gKi9cclxuZXhwb3J0cy5taW4gPSBmdW5jdGlvbihkYXRhQSwgZGF0YU91dCkge1xyXG5cdC8qIENvbXB1dGF0aW9uIG9mIGFsbC1hcnJheSBtaW4gKi9cclxuXHR2YXIgbGVuZ3RoQSA9IGRhdGFBLmxlbmd0aDtcclxuXHR2YXIgcmVzdWx0ID0gZGF0YUFbMF07XHJcblx0Zm9yICh2YXIgaSA9IDE7IGkgPCBsZW5ndGhBOyArK2kpIHtcclxuXHRcdHJlc3VsdCA9IE1hdGgubWluKHJlc3VsdCwgZGF0YUFbaV0pO1xyXG5cdH1cclxuXHRkYXRhT3V0WzBdID0gcmVzdWx0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIHRoZSBtYXhpbXVtIHZhbHVlIG9mIGVsZW1lbnRzIGluIGFuIGFycmF5LlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkgdG8gY29tcHV0ZSBtYXhpbXVtIG9uLlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgYXJyYXkgdG8gc3RvcmUgdGhlIG1heGltdW0gYXQuXHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBtYXhcclxuICovXHJcbmV4cG9ydHMubWF4ID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQpIHtcclxuXHQvKiBDb21wdXRhdGlvbiBvZiBhbGwtYXJyYXkgbWluICovXHJcblx0dmFyIGxlbmd0aEEgPSBkYXRhQS5sZW5ndGg7XHJcblx0dmFyIHJlc3VsdCA9IGRhdGFBWzBdO1xyXG5cdGZvciAodmFyIGkgPSAxOyBpIDwgbGVuZ3RoQTsgKytpKSB7XHJcblx0XHRyZXN1bHQgPSBNYXRoLm1heChyZXN1bHQsIGRhdGFBW2ldKTtcclxuXHR9XHJcblx0ZGF0YU91dFswXSA9IHJlc3VsdDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb21wdXRlcyB0aGUgc3VtIG9mIGVsZW1lbnRzIGluIGFuIGFycmF5LlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkgd2l0aCBlbGVtZW50cyB0byBzdW0gdXAuXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgc3VtIGF0LlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgbWluXHJcbiAqL1xyXG5leHBvcnRzLnN1bSA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XHJcblx0dmFyIGxlbmd0aEEgPSBkYXRhQS5sZW5ndGg7XHJcblx0dmFyIHJlc3VsdCA9IDAuMDtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aEE7ICsraSkge1xyXG5cdFx0cmVzdWx0ICs9IGRhdGFBW2ldO1xyXG5cdH1cclxuXHRkYXRhT3V0WzBdID0gcmVzdWx0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIHRoZSBtaW5pbXVtIHZhbHVlIG9mIGVsZW1lbnRzIGFsb25nIGFuIGF4aXMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheSB0byBjb21wdXRlIG1pbmltYSBvbi5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGFycmF5IHRvIHN0b3JlIHRoZSBtaW5pbWEgYXQuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBvdXRlclN0cmlkZSAtIHRoZSBwcm9kdWN0IG9mIGlucHV0IGFycmF5IGRpbWVuc2lvbnMgcHJlY2VlZGluZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cclxuICogQHBhcmFtIHtOdW1iZXJ9IGlubmVyU3RyaWRlIC0gdGhlIHByb2R1Y3Qgb2YgaW5wdXQgYXJyYXkgZGltZW5zaW9ucyBmb2xsb3dpbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByZWR1Y3Rpb25EaW0gLSB0aGUgbGVuZ3RoIG9mIGlucHV0IGFycmF5IGFsb25nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgYXhpc01pblxyXG4gKi9cclxuZXhwb3J0cy5heGlzTWluID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQsIG91dGVyU3RyaWRlLCBpbm5lclN0cmlkZSwgcmVkdWN0aW9uRGltKSB7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBvdXRlclN0cmlkZTsgKytpKSB7XHJcblx0XHRmb3IgKHZhciBrID0gMDsgayA8IGlubmVyU3RyaWRlOyArK2spIHtcclxuXHRcdFx0dmFyIG9mZnNldCA9IGkgKiByZWR1Y3Rpb25EaW0gKiBpbm5lclN0cmlkZSArIGs7XHJcblx0XHRcdHZhciBjdXJyZW50TWluID0gZGF0YUFbb2Zmc2V0XTtcclxuXHRcdFx0Zm9yICh2YXIgaiA9IDE7IGogPCByZWR1Y3Rpb25EaW07ICsraikge1xyXG5cdFx0XHRcdG9mZnNldCArPSBpbm5lclN0cmlkZTtcclxuXHRcdFx0XHRjdXJyZW50TWluID0gTWF0aC5taW4oY3VycmVudE1pbiwgZGF0YUFbb2Zmc2V0XSk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZGF0YU91dFtpICogaW5uZXJTdHJpZGUgKyBrXSA9IGN1cnJlbnRNaW47XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIHRoZSBtYXhpbXVtIHZhbHVlIG9mIGVsZW1lbnRzIGFsb25nIGFuIGF4aXMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheSB0byBjb21wdXRlIG1heGltYSBvbi5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGFycmF5IHRvIHN0b3JlIHRoZSBtYXhpbWEgYXQuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBvdXRlclN0cmlkZSAtIHRoZSBwcm9kdWN0IG9mIGlucHV0IGFycmF5IGRpbWVuc2lvbnMgcHJlY2VlZGluZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cclxuICogQHBhcmFtIHtOdW1iZXJ9IGlubmVyU3RyaWRlIC0gdGhlIHByb2R1Y3Qgb2YgaW5wdXQgYXJyYXkgZGltZW5zaW9ucyBmb2xsb3dpbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByZWR1Y3Rpb25EaW0gLSB0aGUgbGVuZ3RoIG9mIGlucHV0IGFycmF5IGFsb25nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgYXhpc01heFxyXG4gKi9cclxuZXhwb3J0cy5heGlzTWF4ID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQsIG91dGVyU3RyaWRlLCBpbm5lclN0cmlkZSwgcmVkdWN0aW9uRGltKSB7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBvdXRlclN0cmlkZTsgKytpKSB7XHJcblx0XHRmb3IgKHZhciBrID0gMDsgayA8IGlubmVyU3RyaWRlOyArK2spIHtcclxuXHRcdFx0dmFyIG9mZnNldCA9IGkgKiByZWR1Y3Rpb25EaW0gKiBpbm5lclN0cmlkZSArIGs7XHJcblx0XHRcdHZhciBjdXJyZW50TWF4ID0gZGF0YUFbb2Zmc2V0XTtcclxuXHRcdFx0Zm9yICh2YXIgaiA9IDE7IGogPCByZWR1Y3Rpb25EaW07ICsraikge1xyXG5cdFx0XHRcdG9mZnNldCArPSBpbm5lclN0cmlkZTtcclxuXHRcdFx0XHRjdXJyZW50TWF4ID0gTWF0aC5tYXgoY3VycmVudE1heCwgZGF0YUFbb2Zmc2V0XSk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZGF0YU91dFtpICogaW5uZXJTdHJpZGUgKyBrXSA9IGN1cnJlbnRNYXg7XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIHRoZSBzdW0gb2YgZWxlbWVudHMgYWxvbmcgYW4gYXhpcy5cclxuICpcclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IGFycmF5IHRvIHN1bSB1cC5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGFycmF5IHRvIHN0b3JlIHRoZSBzdW1zIGF0LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gb3V0ZXJTdHJpZGUgLSB0aGUgcHJvZHVjdCBvZiBpbnB1dCBhcnJheSBkaW1lbnNpb25zIHByZWNlZWRpbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBpbm5lclN0cmlkZSAtIHRoZSBwcm9kdWN0IG9mIGlucHV0IGFycmF5IGRpbWVuc2lvbnMgZm9sbG93aW5nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxyXG4gKiBAcGFyYW0ge051bWJlcn0gcmVkdWN0aW9uRGltIC0gdGhlIGxlbmd0aCBvZiBpbnB1dCBhcnJheSBhbG9uZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGF4aXNTdW1cclxuICovXHJcbmV4cG9ydHMuYXhpc1N1bSA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0LCBvdXRlclN0cmlkZSwgaW5uZXJTdHJpZGUsIHJlZHVjdGlvbkRpbSkge1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgb3V0ZXJTdHJpZGU7ICsraSkge1xyXG5cdFx0Zm9yICh2YXIgayA9IDA7IGsgPCBpbm5lclN0cmlkZTsgKytrKSB7XHJcblx0XHRcdHZhciBvZmZzZXQgPSBpICogcmVkdWN0aW9uRGltICogaW5uZXJTdHJpZGUgKyBrO1xyXG5cdFx0XHR2YXIgY3VycmVudFN1bSA9IGRhdGFBW29mZnNldF07XHJcblx0XHRcdGZvciAodmFyIGogPSAxOyBqIDwgcmVkdWN0aW9uRGltOyArK2opIHtcclxuXHRcdFx0XHRvZmZzZXQgKz0gaW5uZXJTdHJpZGU7XHJcblx0XHRcdFx0Y3VycmVudFN1bSArPSBkYXRhQVtvZmZzZXRdO1xyXG5cdFx0XHR9XHJcblx0XHRcdGRhdGFPdXRbaSAqIGlubmVyU3RyaWRlICsga10gPSBjdXJyZW50U3VtO1xyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb21wdXRlcyB0aGUgZG90IHByb2R1Y3Qgb2YgdHdvIE4tZGltZW5zaW9uYWwgYXJyYXlzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSBhbiBpbnB1dCBtdWx0aXBsaWNhbmQgYXJyYXkuXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQiAtIGFuIGlucHV0IG11bHRpcGxpZXIgYXJyYXkuXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBwcm9kdWN0IGFycmF5LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gc3RyaWRlQSAtIHRoZSBwcm9kdWN0IG9mIHRoZSB0aGUgbXVsdGlwbGljYW5kIGRpbWVuc2lvbnMgcHJlY2VlZGluZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cclxuICogQHBhcmFtIHtOdW1iZXJ9IG91dGVyU3RyaWRlQiAtIHRoZSBwcm9kdWN0IG9mIHRoZSBtdWx0aXBsaWVyIGRpbWVuc2lvbnMgcHJlY2VlZGluZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cclxuICogQHBhcmFtIHtOdW1iZXJ9IGlubmVyU3RyaWRlQiAtIHRoZSBwcm9kdWN0IG9mIHRoZSBtdWx0aXBsaWVyIGRpbWVuc2lvbnMgZm9sbG93aW5nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxyXG4gKiBAcGFyYW0ge051bWJlcn0gcmVkdWN0aW9uRGltIC0gdGhlIGxlbmd0aCBvZiBpbnB1dHMgYXJyYXlzIGFsb25nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgZG90XHJcbiAqL1xyXG5leHBvcnRzLmRvdCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhQiwgZGF0YU91dCwgc3RyaWRlQSwgb3V0ZXJTdHJpZGVCLCBpbm5lclN0cmlkZUIsIHJlZHVjdGlvbkRpbSkge1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgc3RyaWRlQTsgKytpKSB7XHJcblx0XHRmb3IgKHZhciBqID0gMDsgaiA8IHJlZHVjdGlvbkRpbTsgKytqKSB7XHJcblx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgb3V0ZXJTdHJpZGVCOyArK2spIHtcclxuXHRcdFx0XHRmb3IgKHZhciBsID0gMDsgbCA8IGlubmVyU3RyaWRlQjsgKytsKSB7XHJcblx0XHRcdFx0XHRkYXRhT3V0WyhpKm91dGVyU3RyaWRlQiArIGspICogaW5uZXJTdHJpZGVCICsgbF0gKz0gZGF0YUFbaSpyZWR1Y3Rpb25EaW0ral0gKiBkYXRhQlsoaypyZWR1Y3Rpb25EaW0raikqaW5uZXJTdHJpZGVCK2xdO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXBsaWNhdGVzIGFycmF5IGVsZW1lbnRzIGFsb25nIGFuIGF4aXMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheS5cclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGFycmF5IGZvciByZXBlYXRlZCBlbGVtZW50cy5cclxuICogQHBhcmFtIHtOdW1iZXJ9IG91dGVyU3RyaWRlIC0gdGhlIHByb2R1Y3Qgb2YgaW5wdXQgYXJyYXkgZGltZW5zaW9ucyBwcmVjZWVkaW5nIHRoZSBleHBhbnNpb24gZGltZW5zaW9uLlxyXG4gKiBAcGFyYW0ge051bWJlcn0gaW5uZXJTdHJpZGUgLSB0aGUgcHJvZHVjdCBvZiBpbnB1dCBhcnJheSBkaW1lbnNpb25zIGZvbGxvd2luZyB0aGUgZXhwYW5zaW9uIGRpbWVuc2lvbi5cclxuICogQHBhcmFtIHtOdW1iZXJ9IGV4cGFuc2lvbkRpbSAtIHRoZSBsZW5ndGggb2YgaW5wdXQgYXJyYXkgYWxvbmcgdGhlIGV4cGFuc2lvbiBkaW1lbnNpb24uXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByZXBlYXRzIC0gdGhlIG51bWJlciBvZiB0aW1lcyBlYWNoIGVsZW1lbnQgd2lsbCBiZSByZXBsaWNhdGVkLlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgcmVwZWF0XHJcbiAqL1xyXG5leHBvcnRzLnJlcGVhdCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0LCBvdXRlclN0cmlkZSwgaW5uZXJTdHJpZGUsIGV4cGFuc2lvbkRpbSwgcmVwZWF0cykge1xyXG5cdGlmIChpbm5lclN0cmlkZSA8IHJlcGVhdHMpIHtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgb3V0ZXJTdHJpZGU7ICsraSkge1xyXG5cdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IGV4cGFuc2lvbkRpbTsgKytqKSB7XHJcblx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCBpbm5lclN0cmlkZTsgKytrKSB7XHJcblx0XHRcdFx0XHR2YXIgdmFsdWVBID0gZGF0YUFbKGkgKiBleHBhbnNpb25EaW0gKyBqKSAqIGlubmVyU3RyaWRlICsga107XHJcblx0XHRcdFx0XHRmb3IgKHZhciBjID0gMDsgYyA8IHJlcGVhdHM7ICsrYykge1xyXG5cdFx0XHRcdFx0XHRkYXRhT3V0WygoaSAqIGV4cGFuc2lvbkRpbSArIGopICogcmVwZWF0cyArIGMpICogaW5uZXJTdHJpZGUgKyBrXSA9IHZhbHVlQTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBvdXRlclN0cmlkZTsgKytpKSB7XHJcblx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgZXhwYW5zaW9uRGltOyArK2opIHtcclxuXHRcdFx0XHR2YXIgcm93QSA9IGRhdGFBLnN1YmFycmF5KChpICogZXhwYW5zaW9uRGltICsgaikgKiBpbm5lclN0cmlkZSwgKGkgKiBleHBhbnNpb25EaW0gKyBqICsgMSkgKiBpbm5lclN0cmlkZSk7XHJcblx0XHRcdFx0Zm9yICh2YXIgYyA9IDA7IGMgPCByZXBlYXRzOyArK2MpIHtcclxuXHRcdFx0XHRcdGRhdGFPdXQuc2V0KHJvd0EsICgoaSAqIGV4cGFuc2lvbkRpbSArIGopICogcmVwZWF0cyArIGMpICogaW5uZXJTdHJpZGUpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogUHJvdmlkZXMgaGVscGVyIGZ1bmN0aW9uc1xyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAY2xhc3MgdXRpbFxyXG4gKi9cclxuXHJcbnZhciBpc051bWJlciA9IGZ1bmN0aW9uKG4pIHtcclxuXHRyZXR1cm4gbiA9PT0gK247XHJcbn07XHJcbmV4cG9ydHMuaXNOdW1iZXIgPSBpc051bWJlcjtcclxuXHJcbnZhciBpc1JlYWwgPSBmdW5jdGlvbihuKSB7XHJcblx0cmV0dXJuIChuID09PSArbikgJiYgKGlzRmluaXRlKG4pKTtcclxufTtcclxuZXhwb3J0cy5pc1JlYWwgPSBpc1JlYWw7XHJcblxyXG52YXIgaXNJbnQgPSBmdW5jdGlvbihuKSB7XHJcblx0cmV0dXJuIG4gPT09IChufDApO1xyXG59O1xyXG5leHBvcnRzLmlzSW50ID0gaXNJbnQ7XHJcblxyXG5leHBvcnRzLmlzUG9zaXRpdmVJbnQgPSBmdW5jdGlvbihuKSB7XHJcblx0cmV0dXJuIChuID09PSArbikgJiYgKG4gPT09IChufDApKSAmJiAobiA+IDApO1xyXG59O1xyXG5cclxuZXhwb3J0cy5pc05vbk5lZ2F0aXZlSW50ID0gZnVuY3Rpb24obikge1xyXG5cdHJldHVybiAobiA9PT0gK24pICYmIChuID09PSAobnwwKSkgJiYgKG4gPj0gMCk7XHJcbn07XHJcblxyXG52YXIgaXNBcnJheSA9IGZ1bmN0aW9uKGxpc3QpIHtcclxuXHRyZXR1cm4gbGlzdCBpbnN0YW5jZW9mIEFycmF5O1xyXG59O1xyXG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xyXG5cclxuZXhwb3J0cy5pc0ludEFycmF5ID0gZnVuY3Rpb24obGlzdCkge1xyXG5cdGlmIChleHBvcnRzLmlzQXJyYXkobGlzdCkpIHtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRpZiAoIWV4cG9ydHMuaXNJbnQobGlzdFtpXSkpIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59O1xyXG5cclxuZXhwb3J0cy5pc1Bvc2l0aXZlSW50QXJyYXkgPSBmdW5jdGlvbihsaXN0KSB7XHJcblx0aWYgKGV4cG9ydHMuaXNBcnJheShsaXN0KSkge1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGlmICghZXhwb3J0cy5pc1Bvc2l0aXZlSW50KGxpc3RbaV0pKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufTtcclxuXHJcbmV4cG9ydHMuYXNJbnRBcnJheSA9IGZ1bmN0aW9uIChsaXN0KSB7XHJcblx0aWYgKGV4cG9ydHMuaXNJbnQobGlzdCkpIHtcclxuXHRcdHJldHVybiBbbGlzdF07XHJcblx0fSBlbHNlIGlmIChleHBvcnRzLmlzSW50QXJyYXkobGlzdCkpIHtcclxuXHRcdHJldHVybiBsaXN0O1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGxpc3QgKyBcIiBjYW4gbm90IGJlIGNvbnZlcnRlZCB0byBpbnRlZ2VyIGFycmF5XCIpO1xyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBWYWxpZGF0ZSB0aGUgc2hhcGUgYXJndW1lbnQuXHJcbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgYXJndW1lbnQgcmVwcmVzZW50cyBhIHZhbGlkIHNoYXBlLlxyXG4gKiBSZXR1cm5zIHRoZSBzaGFwZSBhcyBhbiBpbnRlZ2VyIGFycmF5LlxyXG4gKlxyXG4gKiBAcGFyYW0geyhOdW1iZXJ8TnVtYmVyW10pfSBzaGFwZSAtIHRoZSBzaGFwZSBhcmd1bWVudCB0byB2YWxpZGF0ZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGNoZWNrU2hhcGVcclxuICovXHJcbnZhciBjaGVja1NoYXBlID0gZnVuY3Rpb24oc2hhcGUpIHtcclxuXHRpZiAoaXNOdW1iZXIoc2hhcGUpKSB7XHJcblx0XHRyZXR1cm4gY2hlY2tTaGFwZShbc2hhcGVdKTtcclxuXHR9IGVsc2UgaWYgKGlzQXJyYXkoc2hhcGUpKSB7XHJcblx0XHR2YXIgbiA9IHNoYXBlLmxlbmd0aDtcclxuXHRcdHZhciBvdXRTaGFwZSA9IG5ldyBBcnJheShuKTtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSB7XHJcblx0XHRcdGlmICghaXNOdW1iZXIoc2hhcGVbaV0pKSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiU2hhcGUgaGFzIG5vbi1udW1lcmljIGRpbWVuc2lvbnNcIik7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCFpc0ludChzaGFwZVtpXSkpIHtcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJTaGFwZSBtdXN0IGhhdmUgaW50ZWdlciBkaW1lbnNpb25zXCIpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChzaGFwZVtpXSA8IDEpIHtcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJEZWdlbmVyYXRlIHNoYXBlXCIpO1xyXG5cdFx0XHR9XHJcblx0XHRcdG91dFNoYXBlW2ldID0gc2hhcGVbaV18MDtcclxuXHRcdH1cclxuXHRcdHJldHVybiBvdXRTaGFwZTtcclxuXHR9XHJcbn07XHJcbmV4cG9ydHMuY2hlY2tTaGFwZSA9IGNoZWNrU2hhcGU7XHJcblxyXG4vKipcclxuICogQ2hlY2tzIHRoYXQgdGhlIHR3byBzaGFwZXMgYXJlIHNpbWlsYXIuXHJcbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgdHdvIHNoYXBlcyBhcmUgZGlmZmVyZW50LlxyXG4gKiBJZiB0aGUgZGF0YSB0eXBlcyBhcmUgY29tcGF0aWJsZSwgdGhlIGZ1bmN0aW9uIGRvZXMgbm90aGluZy5cclxuICpcclxuICogQHBhcmFtIHtOdW1iZXJbXX0gc2hhcGVBIC0gb25lIHZhbGlkIHNoYXBlIHRvIGNvbXBhcmUuXHJcbiAqIEBwYXJhbSB7TnVtYmVyW119IHNoYXBlQiAtIGFub3RoZXIgdmFsaWQgc2hhcGUgdG8gY29tcGFyZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KGEuc2hhcGUsIGIuc2hhcGUpO1xyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5XHJcbiAqL1xyXG5leHBvcnRzLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eSA9IGZ1bmN0aW9uKHNoYXBlQSwgc2hhcGVCKSB7XHJcblx0aWYgKHNoYXBlQS5sZW5ndGggIT0gc2hhcGVCLmxlbmd0aCkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiVGhlIHNoYXBlcyBoYXZlIGRpZmZlcmVudCBkaW1lbnNpb25zXCIpO1xyXG5cdH1cclxuXHR2YXIgbiA9IHNoYXBlQS5sZW5ndGg7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcclxuXHRcdGlmIChzaGFwZUFbaV0gIT0gc2hhcGVCW2ldKSB7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlRoZSBzaGFwZXMgYXJlIGRpZmZlcmVudFwiKTtcclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogQ29tcHV0ZXMgYXJyYXkgbGVuZ3RoIGZyb20gaXRzIHNoYXBlLlxyXG4gKlxyXG4gKiBAcGFyYW0ge051bWJlcltdfSBzaGFwZSAtIGFuIGFycmF5IHNoYXBlLiAgVGhlIHNoYXBlIG11c3QgYmUgdmFsaWQgdy5yLnQuICoqY2hlY2tTaGFwZSoqIGZ1bmN0aW9uLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiAgICAgdmFyIGxlbmd0aCA9IHV0aWwuY29tcHV0ZUxlbmd0aChzaGFwZSk7XHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBjb21wdXRlTGVuZ3RoXHJcbiAqL1xyXG5leHBvcnRzLmNvbXB1dGVMZW5ndGggPSBmdW5jdGlvbihzaGFwZSkge1xyXG5cdHZhciBsZW5ndGggPSAxO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgc2hhcGUubGVuZ3RoOyArK2kpIHtcclxuXHRcdGxlbmd0aCAqPSBzaGFwZVtpXTtcclxuXHR9XHJcblx0cmV0dXJuIGxlbmd0aDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGVja3MgdGhlIHRoZSBhcmd1bWVudCByZXByZXNlbnRzIGEgZGF0YSB0eXBlLlxyXG4gKiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIGFyZ3VtZW50IGlzIG5vdCBvZiBEYXRhVHlwZSB0eXBlLlxyXG4gKiBJZiB0aGUgYXJndW1lbnQgaXMgYSBEYXRhVHlwZSBvYmplY3QsIHRoZSBmdW5jdGlvbiBkb2VzIG5vdGhpbmcuXHJcbiAqXHJcbiAqIEBwYXJhbSB7RGF0YVR5cGV9IGRhdGFUeXBlIC0gdGhlIGV4cGVjdGVkbHkgZGF0YSB0eXBlIG9iamVjdCB0byB2YWxpZGF0ZS5cclxuICogQHJldHVybiB7RGF0YVR5cGV9IC0gYSBkYXRhIHR5cGUgb2JqZWN0IGVxdWl2YWxlbnQgdG8gdGhlIGFyZ3VtZW50LlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiAgICAgZGF0YVR5cGUgPSB1dGlsLmNoZWNrRGF0YVR5cGUoZGF0YVR5cGUpO1xyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgY2hlY2tEYXRhVHlwZVxyXG4gKi9cclxuZXhwb3J0cy5jaGVja0RhdGFUeXBlID0gZnVuY3Rpb24oZGF0YVR5cGUpIHtcclxuXHR2YXIgRGF0YVR5cGUgPSByZXF1aXJlKFwiLi9EYXRhVHlwZVwiKTtcclxuXHRpZiAoIShkYXRhVHlwZSBpbnN0YW5jZW9mIERhdGFUeXBlKSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcImRhdGFUeXBlIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBEYXRhVHlwZVwiKTtcclxuXHR9XHJcblx0cmV0dXJuIGRhdGFUeXBlO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENoZWNrcyB0aGF0IHRoZSB0d28gZGF0YSB0eXBlcyBhcmUgY29tcGF0aWJsZS5cclxuICogVGhyb3dzIGFuIGVycm9yIGlmIHRoZSBkYXRhIHR5cGVzIGRvIG5vdCBtYXRjaC5cclxuICogSWYgdGhlIGRhdGEgdHlwZXMgYXJlIGNvbXBhdGlibGUsIHRoZSBmdW5jdGlvbiBkb2VzIG5vdGhpbmcuXHJcbiAqXHJcbiAqIEBwYXJhbSB7RGF0YVR5cGV9IGRhdGFUeXBlQSAtIHRoZSBmaXJzdCBkYXRhIHR5cGUuXHJcbiAqIEBwYXJhbSB7RGF0YVR5cGV9IGRhdGFUeXBlQiAtIHRoZSBzZWNvbmQgZGF0YSB0eXBlLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiAgICAgdXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBjaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHlcclxuICovXHJcbmV4cG9ydHMuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5ID0gZnVuY3Rpb24oZGF0YVR5cGVBLCBkYXRhVHlwZUIpIHtcclxuXHRpZiAoIWRhdGFUeXBlQS5lcXVhbHMoZGF0YVR5cGVCKSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiVGhlIGRhdGEgdHlwZXMgYXJlIG5vdCBjb21wYXRpYmxlXCIpO1xyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBWYWxpZGF0ZXMgYW4gTkRBcnJheSBwYXJhbWV0ZXIuXHJcbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgZXhwZWN0ZWQgTkRBcnJheSBhcmd1bWVudCBoYXMgb3RoZXIgdHlwZSBvciBpZiBpdCBoYXMgYmVlbiBpbnZhbGlkYXRlZC5cclxuICogSWYgdGhlIGFyZ3VtZW50IGlzIGEgdmFsaWQgTkRBcnJheSwgdGhlIGZ1bmN0aW9uIGRvZXMgbm90aGluZy5cclxuICpcclxuICogQHBhcmFtIHtOREFycmF5fSBhcnJheSAtIHRoZSBleHBlY3RlZGx5IE5EQXJyYXkgYXJndW1lbnQgdG8gYmUgdmFsaWRhdGVkLlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gdmFuYW1lIC0gdGhlIG5hbWUgb2YgdGhlIE5EQXJyYXkgYXJndW1lbnQgdG8gYmUgdXNlZCBpbiBlcnJvciBtZXNzYWdlcy5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBjaGVja05EQXJyYXlcclxuICovXHJcbmV4cG9ydHMuY2hlY2tOREFycmF5ID0gZnVuY3Rpb24oYXJyYXksIHZhcm5hbWUpIHtcclxuXHR2YXIgTkRBcnJheSA9IHJlcXVpcmUoXCIuL05EQXJyYXlcIik7XHJcblx0aWYgKCEoYXJyYXkgaW5zdGFuY2VvZiBOREFycmF5KSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcih2YXJuYW1lICsgXCIgaXMgbm90IGFuIE5EQXJyYXlcIik7XHJcblx0fVxyXG5cdGlmICghYXJyYXkuaXNWYWxpZCgpKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IodmFybmFtZSArIFwiIGlzIGFuIGludmFsaWRhdGVkIGFycmF5XCIpO1xyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGVja3MgdGhhdCB0aGUgdHdvIGFycmF5cyBhcmUgZGlmZmVyZW50LlxyXG4gKiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhleSByZWZlciB0byB0aGUgc2FtZSBvYmplY3QuXHJcbiAqIElmIHRoZSBhcnJheXMgYXJlIGRpZmZlcmVudCwgdGhlIGZ1bmN0aW9uIGRvZXMgbm90aGluZy5cclxuICpcclxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGZpcnN0IGFycmF5IHRvIGNoZWNrLiBNdXN0IGJlIGFuIE5EQXJyYXkgb2JqZWN0LlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IGIgLSB0aGUgc2Vjb25kIGFycmF5IHRvIGNoZWNrLiBNdXN0IGJlIGFuIE5EQXJyYXkgb2JqZWN0LlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gdmFybmFtZUEgLSBuYW1lIG9mIHRoZSBmaXJzdCBhcnJheSB2YXJpYWJsZS4gVGhpcyBuYW1lIG1heSBiZSB1c2VkIGluIGFuIGVycm9yIG1lc3NhZ2UuXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSB2YXJuYW1lQiAtIG5hbWUgb2YgdGhlIHNlY29uZCBhcnJheSB2YXJpYWJsZS4gVGhpcyBuYW1lIG1heSBiZSB1c2VkIGluIGFuIGVycm9yIG1lc3NhZ2UuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqICAgICB1dGlsLmNoZWNrRGlmZmVyZW50TkRBcnJheXMoYSwgb3V0LCBcImFcIiwgXCJvdXRcIik7XHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBjaGVja0RpZmZlcmVudE5EQXJyYXlzXHJcbiAqL1xyXG5leHBvcnRzLmNoZWNrRGlmZmVyZW50TkRBcnJheXMgPSBmdW5jdGlvbihhLCBiLCB2YXJuYW1lQSwgdmFybmFtZUIpIHtcclxuXHRpZiAoYSA9PT0gYikge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiVGhlIGFycmF5cyBcIiArIHZhcm5hbWVBICsgXCIgYW5kIFwiICsgdmFybmFtZUIgKyBcIiBtdXN0IGJlIGRpZmZlcmVudFwiKTtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogVmFsaWRhdGVzICoqcmVwZWF0cyoqIHBhcmFtZXRlciBmb3IgcmVwZWF0aXRpb24vdGlsaW5nIG9mIGFycmF5IGFsb25nIGFuIGF4aXMuXHJcbiAqIFRocm93cyBhbiBlcnJvciBpZiAqKnJlcGVhdHMqKiBpcyBub3QgYW4gaW50ZWdlciBvciBpZiAqKnJlcGVhdHMqKiBpcyBzbWFsbGVyIHRoYW4gMi5cclxuICogSWYgKipyZXBlYXRzKiogaXMgdmFsaWQsIHRoZSBmdW5jdGlvbiBkb2VzIG5vdGhpbmcuXHJcbiAqXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByZXBlYXRzIC0gdGhlIHJlcGVhdHMgYXJndW1lbnQgdG8gYmUgdmVyaWZpZWQuXHJcbiAqIEByZXR1cm4ge051bWJlcn0gLSAqKnJlcGVhdHMqKiBjYXN0ZWQgdG8gaW50ZWdlci5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIHJlcGVhdHMgPSB1dGlsLmNoZWNrUmVwZWF0cyhyZXBlYXRzKTtcclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGNoZWNrUmVwZWF0c1xyXG4gKi9cclxuZXhwb3J0cy5jaGVja1JlcGVhdHMgPSBmdW5jdGlvbihyZXBlYXRzKSB7XHJcblx0aWYgKCFpc0ludChyZXBlYXRzKSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlJlcGVhdHMgaXMgbm90IGFuIGludGVnZXJcIik7XHJcblx0fVxyXG5cdGlmIChyZXBlYXRzIDw9IDEpIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiUmVwZWF0cyBzaG91bGQgYmUgZ3JlYXRlciB0aGFuIDFcIik7XHJcblx0fVxyXG5cdHJldHVybiByZXBlYXRzfDA7XHJcbn07XHJcblxyXG4vKipcclxuICogVmFsaWRhdGVzIGF4aXMgcGFyYW1ldGVyIGZvciByZWR1Y3Rpb25zIGFsb25nIGFuIGF4aXMuXHJcbiAqIFRocm93cyBhbiBlcnJvciBpZiBheGlzIGlzIG5vdCBhbiBpbnRlZ2VyLCBpZiBheGlzIGlzIG5lZ2F0aXZlLCBvciBheGlzIGV4Y2VlZHMgdGhlIG51bWJlciBvZiBkaW1lbnNpb25zLlxyXG4gKiBJZiBheGlzIGlzIHZhbGlkLCB0aGUgZnVuY3Rpb24gZG9lcyBub3RoaW5nLlxyXG4gKlxyXG4gKiBAcGFyYW0ge051bWJlcn0gYXhpcyAtIHRoZSBheGlzIGFyZ3VtZW50IHRvIGJlIHZlcmlmaWVkLlxyXG4gKiBAcGFyYW0ge051bWJlcn0gbnVtRGltZW5zaW9ucyAtIHRoZSBudW1iZXIgb2YgZGltZW5zaW9ucyBpbiB0aGUgYXJyYXkgYmVpbmcgcmVkdWNlZC5cclxuICogQHJldHVybiB7TnVtYmVyfSAtIGF4aXMgY2FzdGVkIHRvIGludGVnZXIuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqICAgICBheGlzID0gdXRpbC5jaGVja0F4aXMoYXhpcywgbmRhcnJheS5zaGFwZS5sZW5ndGgpO1xyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2RcclxuICovXHJcbmV4cG9ydHMuY2hlY2tBeGlzID0gZnVuY3Rpb24oYXhpcywgbnVtRGltZW5zaW9ucykge1xyXG5cdGlmICghaXNJbnQoYXhpcykpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJBeGlzIGlzIG5vdCBhbiBpbnRlZ2VyXCIpO1xyXG5cdH1cclxuXHRpZiAoYXhpcyA8IDApIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiQXhpcyBpcyBuZWdhdGl2ZVwiKTtcclxuXHR9XHJcblx0LyogRS5nLiAzLWRpbWVuc2lvbmFsIGFycmF5IGhhcyBheGVzIDAsIDEsIDIgKGJ1dCBub3QgMyEpICovXHJcblx0aWYgKGF4aXMgPj0gbnVtRGltZW5zaW9ucykge1xyXG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJBeGlzIG91dCBvZiByYW5nZVwiKTtcclxuXHR9XHJcblx0cmV0dXJuIGF4aXN8MDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBWYWxpZGF0ZXMgdGhlIHNoYXBlIG9mIG91dHB1dCBhcnJheSBmb3IgcmVkdWN0aW9ucyBhbG9uZyBhbiBheGlzLlxyXG4gKiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIHNoYXBlIG9mIHRoZSBvdXRwdXQgYXJyYXkgZG9lcyBtYXRjaCB0aGUgc2hhcGUgb2YgaW5wdXQgYXJyYXkgYWZ0ZXIgcmVkdWN0aW9uIGFsb25nIHRoZSBheGlzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge051bWJlcltdfSBpblNoYXBlIC0gdGhlIHNoYXBlIG9mIHRoZSBpbnB1dCBhcnJheS5cclxuICogQHBhcmFtIHtOdW1iZXJbXX0gb3V0U2hhcGUgLSB0aGUgc2hhcGUgb2YgdGhlIG91dHB1dCBhcnJheSB0byBiZSB2YWxpZGF0ZWQuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgZm9yIHJlZHVjdGlvbiBvZiBpbnB1dCBhcnJheS4gTXVzdCBiZSB2YWxpZCB3LnIudC4gaW5TaGFwZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIHV0aWwuY2hlY2tBeGlzUmVkdWN0aW9uT3V0U2hhcGUoaW5BcnJheS5zaGFwZSwgb3V0QXJyYXkuc2hhcGUsIGF4aXMpO1xyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2RcclxuICovXHJcbmV4cG9ydHMuY2hlY2tBeGlzUmVkdWN0aW9uT3V0U2hhcGUgPSBmdW5jdGlvbihpblNoYXBlLCBvdXRTaGFwZSwgYXhpcykge1xyXG5cdGlmIChpblNoYXBlLmxlbmd0aCAhPT0gb3V0U2hhcGUubGVuZ3RoICsgMSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiT3V0cHV0IGFycmF5IGhhcyBpbnZhbGlkIG51bWJlciBvZiBkaW1lbnNpb25zIGZvciB0aGlzIG9wZXJhdGlvblwiKTtcclxuXHR9XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBheGlzOyArK2kpIHtcclxuXHRcdGlmIChpblNoYXBlW2ldICE9PSBvdXRTaGFwZVtpXSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJPdXRwdXQgYXJyYXkgaGFzIGludmFsaWQgc2hhcGUgZm9yIHRoaXMgb3BlcmF0aW9uXCIpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRmb3IgKHZhciBpID0gYXhpcyArIDE7IGkgPCBpblNoYXBlLmxlbmd0aDsgKytpKSB7XHJcblx0XHRpZiAoaW5TaGFwZVtpXSAhPT0gb3V0U2hhcGVbaS0xXSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJPdXRwdXQgYXJyYXkgaGFzIGludmFsaWQgc2hhcGUgZm9yIHRoaXMgb3BlcmF0aW9uXCIpO1xyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb21wdXRlcyB0aGUgc2hhcGUgb2YgYW4gYXJyYXkgYWZ0ZXIgcmVkdWN0aW9uIGFsb25nIGFuIGF4aXMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7TnVtYmVyW119IGluU2hhcGUgLSB0aGUgc2hhcGUgb2YgdGhlIGlucHV0IGFycmF5LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gYXhpcyAtIHRoZSBheGlzIGZvciByZWR1Y3Rpb24gb2YgaW5wdXQgYXJyYXkuIE11c3QgYmUgdmFsaWQgdy5yLnQuIGluU2hhcGUuXHJcbiAqIEByZXR1cm4ge051bWJlcltdfSAtIHRoZSBzaGFwZSBvZiB0aGUgb3V0cHV0IGFycmF5LlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiAgICAgdmFyIG91dFNoYXBlID0gdXRpbC5nZXRBeGlzUmVkdWN0aW9uT3V0U2hhcGUoaW5BcnJheS5zaGFwZSwgYXhpcyk7XHJcbiAqICAgICB2YXIgb3V0QXJyYXkgPSBuZXcgTkRBcnJheShvdXRTaGFwZSwgaW5BcnJheS5kYXRhVHlwZSwgY29udGV4dCk7XHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZFxyXG4gKi9cclxuZXhwb3J0cy5jb21wdXRlQXhpc1JlZHVjdGlvbk91dFNoYXBlID0gZnVuY3Rpb24oaW5TaGFwZSwgYXhpcykge1xyXG5cdHZhciBvdXRTaGFwZSA9IFtdO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgaW5TaGFwZS5sZW5ndGg7ICsraSkge1xyXG5cdFx0aWYgKGkgIT09IGF4aXMpIHtcclxuXHRcdFx0b3V0U2hhcGUucHVzaChpblNoYXBlW2ldKTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIG91dFNoYXBlO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIHRoZSBwcm9kdWN0IG9mIGFycmF5IGRpbWVuc2lvbnMgYmVmb3JlIHRoZSBheGlzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge051bWJlcltdfSBzaGFwZSAtIHRoZSBzaGFwZSBvZiB0aGUgYXJyYXkuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgdXNlZCBpbiBhbiBvcGVyYXRpb24uIE11c3QgYmUgdmFsaWQgdy5yLnQuIHNoYXBlLlxyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IC0gdGhlIHByb2R1Y3Qgb2YgYXJyYXkgZGltZW5zaW9ucyBiZWZvcmUgYXhpcy5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIC8vIDUtZGltZW5zaW9uYWwgYXJyYXlcclxuICogICAgIHZhciBuZGFycmF5ID0gY29udGV4dC5lbXB0eShbMiwgMywgNCwgNSwgNl0pO1xyXG4gKiAgICAgLy8gUmV0dXJucyA2ID0gMiozXHJcbiAqICAgICB2YXIgb3V0ZXJTdHJpZGUgPSBjb21wdXRlT3V0ZXJTdHJpZGUobmRhcnJheSwgMik7XHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZFxyXG4gKi9cclxuZXhwb3J0cy5jb21wdXRlT3V0ZXJTdHJpZGUgPSBmdW5jdGlvbihzaGFwZSwgYXhpcykge1xyXG5cdHZhciBvdXRlclN0cmlkZSA9IDE7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBheGlzOyArK2kpIHtcclxuXHRcdG91dGVyU3RyaWRlICo9IHNoYXBlW2ldO1xyXG5cdH1cclxuXHRyZXR1cm4gb3V0ZXJTdHJpZGU7XHJcbn07XHJcblxyXG4vKipcclxuICogQ29tcHV0ZXMgdGhlIHByb2R1Y3Qgb2YgYXJyYXkgZGltZW5zaW9ucyBhZnRlciB0aGUgYXhpcy5cclxuICpcclxuICogQHBhcmFtIHtOdW1iZXJbXX0gc2hhcGUgLSB0aGUgc2hhcGUgb2YgdGhlIGFycmF5LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gYXhpcyAtIHRoZSBheGlzIHVzZWQgaW4gYW4gb3BlcmF0aW9uLiBNdXN0IGJlIHZhbGlkIHcuci50LiBzaGFwZS5cclxuICogQHJldHVybiB7TnVtYmVyfSAtIHRoZSBwcm9kdWN0IG9mIGFycmF5IGRpbWVuc2lvbnMgYWZ0ZXIgYXhpcy5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIC8vIDUtZGltZW5zaW9uYWwgYXJyYXlcclxuICogICAgIHZhciBuZGFycmF5ID0gY29udGV4dC5lbXB0eShbMiwgMywgNCwgNSwgNl0pO1xyXG4gKiAgICAgLy8gUmV0dXJucyA2ID0gMiozXHJcbiAqICAgICB2YXIgaW5uZXJTdHJpZGUgPSBjb21wdXRlSW5uZXJTdHJpZGUobmRhcnJheSwgMik7XHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZFxyXG4gKi9cclxuZXhwb3J0cy5jb21wdXRlSW5uZXJTdHJpZGUgPSBmdW5jdGlvbihzaGFwZSwgYXhpcykge1xyXG5cdHZhciBpbm5lclN0cmlkZSA9IDE7XHJcblx0Zm9yICh2YXIgaSA9IGF4aXMgKyAxOyBpIDwgc2hhcGUubGVuZ3RoOyArK2kpIHtcclxuXHRcdGlubmVyU3RyaWRlICo9IHNoYXBlW2ldO1xyXG5cdH1cclxuXHRyZXR1cm4gaW5uZXJTdHJpZGU7XHJcbn07XHJcblxyXG52YXIgZGlzY292ZXJBcnJheVNoYXBlUmVjdXJzaXZlID0gZnVuY3Rpb24oZGF0YSwgc2hhcGUsIGxldmVsKSB7XHJcblx0aWYgKGlzQXJyYXkoZGF0YSkpIHtcclxuXHRcdGlmIChzaGFwZS5sZW5ndGggPD0gbGV2ZWwpIHtcclxuXHRcdFx0LyogRGlzY292ZXJlZCBhIG5ldyBsZXZlbCBvZiBzdWItYXJyYXlzLiBSZWNvcmQgaXRzIGRpbWVuc2lvbi4gKi9cclxuXHRcdFx0c2hhcGUucHVzaChkYXRhLmxlbmd0aCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQvKiBPbmx5IGNoZWNrIGRpbWVuc2lvbiAqL1xyXG5cdFx0XHRpZiAoc2hhcGVbbGV2ZWxdICE9IGRhdGEubGVuZ3RoKSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJTdWItYXJyYXkgXCIgKyBkYXRhICsgXCIgZG9lcyBub3QgbWF0Y2ggdGhlIGV4cGVjdGVkIGRpbWVuc2lvbiBvZiBcIiArIHNoYXBlW2xldmVsXSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRkaXNjb3ZlckFycmF5U2hhcGVSZWN1cnNpdmUoZGF0YVtpXSwgc2hhcGUsIGxldmVsICsgMSk7XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdGlmIChsZXZlbCAhPSBzaGFwZS5sZW5ndGgpIHtcclxuXHRcdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJTdWItYXJyYXkgW1wiICsgZGF0YSArIFwiXSBkb2VzIG5vdCBtYXRjaCB0aGUgZXhwZWN0ZWQgZGltZW5zaW9uIG9mIFwiICsgc2hhcGVbbGV2ZWxdKTtcclxuXHRcdH1cclxuXHRcdGlmICghaXNOdW1iZXIoZGF0YSkpIHtcclxuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIk5vbi1udW1lcmljIGVsZW1lbnQ6IFwiICsgZGF0YSk7XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5leHBvcnRzLmRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZSA9IGRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZTtcclxuXHJcbnZhciBjb3B5QXJyYXlEYXRhUmVjdXJzaXZlID0gZnVuY3Rpb24oZGF0YUJ1ZmZlciwgZGF0YUFycmF5LCBzaGFwZSwgbGV2ZWwsIG9mZnNldCkge1xyXG5cdHZhciBuID0gc2hhcGVbbGV2ZWxdO1xyXG5cdGlmIChsZXZlbCA9PT0gc2hhcGUubGVuZ3RoIC0gMSkge1xyXG5cdFx0ZGF0YUJ1ZmZlci5zZXQoZGF0YUFycmF5LCBvZmZzZXQgKiBuKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcclxuXHRcdFx0Y29weUFycmF5RGF0YVJlY3Vyc2l2ZShkYXRhQnVmZmVyLCBkYXRhQXJyYXlbaV0sIHNoYXBlLCBsZXZlbCArIDEsIG9mZnNldCAqIG4gICsgaSk7XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5leHBvcnRzLmNvcHlBcnJheURhdGFSZWN1cnNpdmUgPSBjb3B5QXJyYXlEYXRhUmVjdXJzaXZlO1xyXG5cclxudmFyIGNyZWF0ZUFycmF5UmVjdXJzaXZlID0gZnVuY3Rpb24oZGF0YUJ1ZmZlciwgZGF0YUFycmF5LCBzaGFwZSwgbGV2ZWwsIG9mZnNldCkge1xyXG5cdHZhciBuID0gc2hhcGVbbGV2ZWxdO1xyXG5cdGlmIChsZXZlbCA9PT0gc2hhcGUubGVuZ3RoIC0gMSkge1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcclxuXHRcdFx0ZGF0YUFycmF5W2ldID0gZGF0YUJ1ZmZlcltvZmZzZXQgKiBuICsgaV07XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSB7XHJcblx0XHRcdGRhdGFBcnJheVtpXSA9IG5ldyBBcnJheShzaGFwZVtsZXZlbCArIDFdKTtcclxuXHRcdFx0Y3JlYXRlQXJyYXlSZWN1cnNpdmUoZGF0YUJ1ZmZlciwgZGF0YUFycmF5W2ldLCBzaGFwZSwgbGV2ZWwgKyAxLCBvZmZzZXQgKiBuICArIGkpO1xyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuZXhwb3J0cy5jcmVhdGVBcnJheVJlY3Vyc2l2ZSA9IGNyZWF0ZUFycmF5UmVjdXJzaXZlO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBOREFycmF5ID0gcmVxdWlyZShcIi4uL05EQXJyYXlcIik7XHJcbnZhciBEYXRhVHlwZSA9IHJlcXVpcmUoXCIuLi9EYXRhVHlwZVwiKTtcclxudmFyIHV0aWwgPSByZXF1aXJlKFwiLi4vdXRpbFwiKTtcclxuXHJcblxyXG52YXIgc2hhcGVUb0xlbmd0aCA9IGZ1bmN0aW9uKHNoYXBlKSB7XHJcblx0dmFyIGxlbmd0aCA9IDE7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzaGFwZS5sZW5ndGg7IGkrKykge1xyXG5cdFx0bGVuZ3RoICo9IHNoYXBlW2ldO1xyXG5cdH1cclxuXHRyZXR1cm4gbGVuZ3RoO1xyXG59O1xyXG5cclxudmFyIGlzQ29tcGF0aWJsZVNoYXBlID0gZnVuY3Rpb24oc2hhcGUxLCBzaGFwZTIpIHtcclxuXHRpZiAoc2hhcGUxLmxlbmd0aCAhPT0gc2hhcGUyLmxlbmd0aCkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IHNoYXBlMS5sZW5ndGg7IGkrKykge1xyXG5cdFx0aWYgKHNoYXBlMVtpXSAhPT0gc2hhcGUyW2ldKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIHRydWU7XHJcbn07XHJcblxyXG4vKiBOb3Qgc3VwcG9ydGVkIGJ5IE5va2lhLVdlYkNMLCBidWdneSBpbiBDaHJvbWl1bS1XZWJDTCAqL1xyXG52YXIgdXNlQXN5bmNCdWZmZXJSZWFkID0gZmFsc2U7XHJcbi8qIEJ1Z2d5IGluIENocm9taXVtLVdlYkNMICovXHJcbnZhciB1c2VCdWZmZXJDcmVhdGlvbldpdGhJbml0ID0gZmFsc2U7XHJcblxyXG52YXIgY2wgPSAodHlwZW9mIHdpbmRvdyA9PT0gXCJvYmplY3RcIikgPyB3aW5kb3cud2ViY2wgOiB1bmRlZmluZWQ7XHJcbnZhciBjb250ZXh0ID0gbnVsbDtcclxudmFyIHF1ZXVlID0gbnVsbDtcclxudmFyIG1lc3NhZ2VDYWxsYmFja3MgPSB7fTtcclxuXHJcbnZhciBiaW5hcnlPcEtlcm5lbHMgPSB7XHJcblx0YWRkOiB7fSxcclxuXHRzdWI6IHt9LFxyXG5cdG11bDoge30sXHJcblx0ZGl2OiB7fVxyXG59O1xyXG52YXIgYmluYXJ5Q29uc3RPcEtlcm5lbHMgPSB7XHJcblx0YWRkOiB7fSxcclxuXHRzdWI6IHt9LFxyXG5cdG11bDoge30sXHJcblx0ZGl2OiB7fVxyXG59O1xyXG52YXIgdW5hcnlPcEtlcm5lbHMgPSB7XHJcblx0bmVnOiB7fSxcclxuXHRhYnM6IHt9LFxyXG5cdGV4cDoge30sXHJcblx0bG9nOiB7fSxcclxuXHRzcXJ0OiB7fSxcclxuXHRzcXVhcmU6IHt9XHJcbn07XHJcblxyXG52YXIgc2V0S2VybmVscyA9IHt9O1xyXG5cclxuZnVuY3Rpb24gV2ViQ0xDb250ZXh0KGNhbGxiYWNrKSB7XHJcblx0aWYgKHR5cGVvZiBjbCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0Y2wgPSByZXF1aXJlKFwibm9kZS13ZWJjbFwiKTtcclxuXHR9XHJcblx0aWYgKGNvbnRleHQgPT09IG51bGwpIHtcclxuXHRcdHZhciBzb3VyY2UgPSBcImtlcm5lbCB2b2lkIHNldEYzMihcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZmxvYXQqIG91dCxcXHJcXG5cXHRmbG9hdCB2YWx1ZSlcXHJcXG57XFxyXFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxyXFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxyXFxuXFx0XFx0b3V0W2lkXSA9IHZhbHVlO1xcclxcblxcdH1cXHJcXG59XFxyXFxua2VybmVsIHZvaWQgc2V0RjY0KFxcclxcblxcdHVpbnQgbGVuZ3RoLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIG91dCxcXHJcXG5cXHRkb3VibGUgdmFsdWUpXFxyXFxue1xcclxcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcclxcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcclxcblxcdFxcdG91dFtpZF0gPSB2YWx1ZTtcXHJcXG5cXHR9XFxyXFxufVxcclxcblxcclxcbmtlcm5lbCB2b2lkIGFkZEYzMihcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxyXFxuXFx0Z2xvYmFsIGZsb2F0KiBiLFxcclxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gKyBiW2lkXTtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIGFkZEY2NChcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIGIsXFxyXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gKyBiW2lkXTtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIHN1YkYzMihcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxyXFxuXFx0Z2xvYmFsIGZsb2F0KiBiLFxcclxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gLSBiW2lkXTtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIHN1YkY2NChcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIGIsXFxyXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gLSBiW2lkXTtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIG11bEYzMihcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxyXFxuXFx0Z2xvYmFsIGZsb2F0KiBiLFxcclxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gKiBiW2lkXTtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIG11bEY2NChcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIGIsXFxyXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gKiBiW2lkXTtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIGRpdkYzMihcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxyXFxuXFx0Z2xvYmFsIGZsb2F0KiBiLFxcclxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gLyBiW2lkXTtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIGRpdkY2NChcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIGIsXFxyXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gLyBiW2lkXTtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIGFkZENvbnN0RjMyKFxcclxcblxcdHVpbnQgbGVuZ3RoLFxcclxcblxcdGdsb2JhbCBmbG9hdCogYSxcXHJcXG5cXHRmbG9hdCBiLFxcclxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gKyBiO1xcclxcblxcdH1cXHJcXG59XFxyXFxua2VybmVsIHZvaWQgYWRkQ29uc3RGNjQoXFxyXFxuXFx0dWludCBsZW5ndGgsXFxyXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXHJcXG5cXHRkb3VibGUgYixcXHJcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxyXFxue1xcclxcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcclxcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcclxcblxcdFxcdG91dFtpZF0gPSBhW2lkXSArIGI7XFxyXFxuXFx0fVxcclxcbn1cXHJcXG5rZXJuZWwgdm9pZCBzdWJDb25zdEYzMihcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxyXFxuXFx0ZmxvYXQgYixcXHJcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXHJcXG57XFxyXFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxyXFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxyXFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdIC0gYjtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIHN1YkNvbnN0RjY0KFxcclxcblxcdHVpbnQgbGVuZ3RoLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxyXFxuXFx0ZG91YmxlIGIsXFxyXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gLSBiO1xcclxcblxcdH1cXHJcXG59XFxyXFxua2VybmVsIHZvaWQgbXVsQ29uc3RGMzIoXFxyXFxuXFx0dWludCBsZW5ndGgsXFxyXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcclxcblxcdGZsb2F0IGIsXFxyXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxyXFxue1xcclxcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcclxcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcclxcblxcdFxcdG91dFtpZF0gPSBhW2lkXSAqIGI7XFxyXFxuXFx0fVxcclxcbn1cXHJcXG5rZXJuZWwgdm9pZCBtdWxDb25zdEY2NChcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcclxcblxcdGRvdWJsZSBiLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXHJcXG57XFxyXFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxyXFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxyXFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdICogYjtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIGRpdkNvbnN0RjMyKFxcclxcblxcdHVpbnQgbGVuZ3RoLFxcclxcblxcdGdsb2JhbCBmbG9hdCogYSxcXHJcXG5cXHRmbG9hdCBiLFxcclxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gLyBiO1xcclxcblxcdH1cXHJcXG59XFxyXFxua2VybmVsIHZvaWQgZGl2Q29uc3RGNjQoXFxyXFxuXFx0dWludCBsZW5ndGgsXFxyXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXHJcXG5cXHRkb3VibGUgYixcXHJcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxyXFxue1xcclxcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcclxcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcclxcblxcdFxcdG91dFtpZF0gPSBhW2lkXSAvIGI7XFxyXFxuXFx0fVxcclxcbn1cXHJcXG5rZXJuZWwgdm9pZCBuZWdGMzIoXFxyXFxuXFx0dWludCBsZW5ndGgsXFxyXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcclxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gLWFbaWRdO1xcclxcblxcdH1cXHJcXG59XFxyXFxua2VybmVsIHZvaWQgbmVnRjY0KFxcclxcblxcdHVpbnQgbGVuZ3RoLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxyXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gLWFbaWRdO1xcclxcblxcdH1cXHJcXG59XFxyXFxua2VybmVsIHZvaWQgYWJzRjMyKFxcclxcblxcdHVpbnQgbGVuZ3RoLFxcclxcblxcdGdsb2JhbCBmbG9hdCogYSxcXHJcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXHJcXG57XFxyXFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxyXFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxyXFxuXFx0XFx0b3V0W2lkXSA9IGZhYnMoYVtpZF0pO1xcclxcblxcdH1cXHJcXG59XFxyXFxua2VybmVsIHZvaWQgYWJzRjY0KFxcclxcblxcdHVpbnQgbGVuZ3RoLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxyXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gZmFicyhhW2lkXSk7XFxyXFxuXFx0fVxcclxcbn1cXHJcXG5rZXJuZWwgdm9pZCBleHBGMzIoXFxyXFxuXFx0dWludCBsZW5ndGgsXFxyXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcclxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gZXhwKGFbaWRdKTtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIGV4cEY2NChcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXHJcXG57XFxyXFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxyXFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxyXFxuXFx0XFx0b3V0W2lkXSA9IGV4cChhW2lkXSk7XFxyXFxuXFx0fVxcclxcbn1cXHJcXG5rZXJuZWwgdm9pZCBsb2dGMzIoXFxyXFxuXFx0dWludCBsZW5ndGgsXFxyXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcclxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcclxcbntcXHJcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXHJcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXHJcXG5cXHRcXHRvdXRbaWRdID0gbG9nKGFbaWRdKTtcXHJcXG5cXHR9XFxyXFxufVxcclxcbmtlcm5lbCB2b2lkIGxvZ0Y2NChcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXHJcXG57XFxyXFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxyXFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxyXFxuXFx0XFx0b3V0W2lkXSA9IGxvZyhhW2lkXSk7XFxyXFxuXFx0fVxcclxcbn1cXHJcXG5rZXJuZWwgdm9pZCBzcXJ0RjMyKFxcclxcblxcdHVpbnQgbGVuZ3RoLFxcclxcblxcdGdsb2JhbCBmbG9hdCogYSxcXHJcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXHJcXG57XFxyXFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxyXFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxyXFxuXFx0XFx0b3V0W2lkXSA9IHNxcnQoYVtpZF0pO1xcclxcblxcdH1cXHJcXG59XFxyXFxua2VybmVsIHZvaWQgc3FydEY2NChcXHJcXG5cXHR1aW50IGxlbmd0aCxcXHJcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcclxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXHJcXG57XFxyXFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxyXFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxyXFxuXFx0XFx0b3V0W2lkXSA9IHNxcnQoYVtpZF0pO1xcclxcblxcdH1cXHJcXG59XFxyXFxua2VybmVsIHZvaWQgc3F1YXJlRjMyKFxcclxcblxcdHVpbnQgbGVuZ3RoLFxcclxcblxcdGdsb2JhbCBmbG9hdCogYSxcXHJcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXHJcXG57XFxyXFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxyXFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxyXFxuXFx0XFx0Y29uc3QgZmxvYXQgYVZhbCA9IGFbaWRdOyBcXHJcXG5cXHRcXHRvdXRbaWRdID0gYVZhbCAqIGFWYWw7XFxyXFxuXFx0fVxcclxcbn1cXHJcXG5rZXJuZWwgdm9pZCBzcXVhcmVGNjQoXFxyXFxuXFx0dWludCBsZW5ndGgsXFxyXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXHJcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxyXFxue1xcclxcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcclxcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcclxcblxcdFxcdGNvbnN0IGRvdWJsZSBhVmFsID0gYVtpZF07XFxyXFxuXFx0XFx0b3V0W2lkXSA9IGFWYWwgKiBhVmFsO1xcclxcblxcdH1cXHJcXG59XFxyXFxuXCI7XHJcblxyXG5cdFx0dmFyIHBsYXRmb3JtcyA9IGNsLmdldFBsYXRmb3JtcygpO1xyXG5cdFx0dmFyIHBsYXRmb3JtID0gcGxhdGZvcm1zWzBdO1xyXG5cdFx0dmFyIGRldmljZXMgPSBwbGF0Zm9ybS5nZXREZXZpY2VzKGNsLkRFVklDRV9UWVBFX0FMTCk7XHJcblx0XHR2YXIgZGV2aWNlID0gZGV2aWNlc1swXTtcclxuXHRcdGNvbnRleHQgPSBjbC5jcmVhdGVDb250ZXh0KGRldmljZSk7XHJcblx0XHRxdWV1ZSA9IGNvbnRleHQuY3JlYXRlQ29tbWFuZFF1ZXVlKCk7XHJcblx0XHR2YXIgcHJvZ3JhbSA9IGNvbnRleHQuY3JlYXRlUHJvZ3JhbShzb3VyY2UpO1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0LyogQ2hyb21pdW0tV2ViQ0wgcmVxdWlyZXMgYSBsaXN0IG9mIGRldmljZXMgKi9cclxuXHRcdFx0cHJvZ3JhbS5idWlsZChbZGV2aWNlXSk7XHJcblx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdGlmIChlLm5hbWUgPT09IFwiSU5WQUxJRF9ERVZJQ0VcIikge1xyXG5cdFx0XHRcdC8qIE5va2lhLVdlYkNMIG9ubHkgd29ya3Mgd2l0aCBubyBhcmd1bWVudHMgdG8gV2ViQ0xQcm9ncmFtLmJ1aWxkICovXHJcblx0XHRcdFx0cHJvZ3JhbS5idWlsZCgpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRocm93IGU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHNldEtlcm5lbHMuZjMyID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJzZXRGMzJcIik7XHJcblx0XHRzZXRLZXJuZWxzLmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic2V0RjY0XCIpO1xyXG5cdFx0YmluYXJ5T3BLZXJuZWxzLmFkZC5mMzIgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFkZEYzMlwiKTtcclxuXHRcdGJpbmFyeU9wS2VybmVscy5hZGQuZjY0ID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhZGRGNjRcIik7XHJcblx0XHRiaW5hcnlPcEtlcm5lbHMuc3ViLmYzMiA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3ViRjMyXCIpO1xyXG5cdFx0YmluYXJ5T3BLZXJuZWxzLnN1Yi5mNjQgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInN1YkY2NFwiKTtcclxuXHRcdGJpbmFyeU9wS2VybmVscy5tdWwuZjMyID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJtdWxGMzJcIik7XHJcblx0XHRiaW5hcnlPcEtlcm5lbHMubXVsLmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibXVsRjY0XCIpO1xyXG5cdFx0YmluYXJ5T3BLZXJuZWxzLmRpdi5mMzIgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImRpdkYzMlwiKTtcclxuXHRcdGJpbmFyeU9wS2VybmVscy5kaXYuZjY0ID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJkaXZGNjRcIik7XHJcblx0XHRiaW5hcnlDb25zdE9wS2VybmVscy5hZGQuZjMyID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhZGRDb25zdEYzMlwiKTtcclxuXHRcdGJpbmFyeUNvbnN0T3BLZXJuZWxzLmFkZC5mNjQgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFkZENvbnN0RjY0XCIpO1xyXG5cdFx0YmluYXJ5Q29uc3RPcEtlcm5lbHMuc3ViLmYzMiA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3ViQ29uc3RGMzJcIik7XHJcblx0XHRiaW5hcnlDb25zdE9wS2VybmVscy5zdWIuZjY0ID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJzdWJDb25zdEY2NFwiKTtcclxuXHRcdGJpbmFyeUNvbnN0T3BLZXJuZWxzLm11bC5mMzIgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcIm11bENvbnN0RjMyXCIpO1xyXG5cdFx0YmluYXJ5Q29uc3RPcEtlcm5lbHMubXVsLmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibXVsQ29uc3RGNjRcIik7XHJcblx0XHRiaW5hcnlDb25zdE9wS2VybmVscy5kaXYuZjMyID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJkaXZDb25zdEYzMlwiKTtcclxuXHRcdGJpbmFyeUNvbnN0T3BLZXJuZWxzLmRpdi5mNjQgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImRpdkNvbnN0RjY0XCIpO1xyXG5cdFx0dW5hcnlPcEtlcm5lbHMubmVnLmYzMiA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibmVnRjMyXCIpO1xyXG5cdFx0dW5hcnlPcEtlcm5lbHMubmVnLmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibmVnRjY0XCIpO1xyXG5cdFx0dW5hcnlPcEtlcm5lbHMuYWJzLmYzMiA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiYWJzRjMyXCIpO1xyXG5cdFx0dW5hcnlPcEtlcm5lbHMuYWJzLmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiYWJzRjY0XCIpO1xyXG5cdFx0dW5hcnlPcEtlcm5lbHMuZXhwLmYzMiA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiZXhwRjMyXCIpO1xyXG5cdFx0dW5hcnlPcEtlcm5lbHMuZXhwLmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiZXhwRjY0XCIpO1xyXG5cdFx0dW5hcnlPcEtlcm5lbHMubG9nLmYzMiA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibG9nRjMyXCIpO1xyXG5cdFx0dW5hcnlPcEtlcm5lbHMubG9nLmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibG9nRjY0XCIpO1xyXG5cdFx0dW5hcnlPcEtlcm5lbHMuc3FydC5mMzIgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInNxcnRGMzJcIik7XHJcblx0XHR1bmFyeU9wS2VybmVscy5zcXJ0LmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3FydEY2NFwiKTtcclxuXHRcdHVuYXJ5T3BLZXJuZWxzLnNxdWFyZS5mMzIgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInNxdWFyZUYzMlwiKTtcclxuXHRcdHVuYXJ5T3BLZXJuZWxzLnNxdWFyZS5mNjQgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInNxdWFyZUY2NFwiKTtcclxuXHR9XHJcblx0Y2FsbGJhY2sodGhpcyk7XHJcbn1cclxuXHJcbldlYkNMQ29udGV4dC5wcm90b3R5cGUuZW1wdHkgPSBmdW5jdGlvbihzaGFwZSwgZGF0YVR5cGUpIHtcclxuXHRzaGFwZSA9IHV0aWwuY2hlY2tTaGFwZShzaGFwZSk7XHJcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XHJcblx0fSBlbHNlIGlmICghKGRhdGFUeXBlIGluc3RhbmNlb2YgRGF0YVR5cGUpKSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xyXG5cdH1cclxuXHR2YXIgYXJyYXkgPSBuZXcgTkRBcnJheShzaGFwZSwgZGF0YVR5cGUsIHRoaXMpO1xyXG5cdGFycmF5Ll9idWZmZXIgPSBjb250ZXh0LmNyZWF0ZUJ1ZmZlcihjbC5NRU1fUkVBRF9XUklURSwgYXJyYXkubGVuZ3RoICogZGF0YVR5cGUuc2l6ZSk7XHJcblx0cmV0dXJuIGFycmF5O1xyXG59O1xyXG5cclxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS56ZXJvcyA9IGZ1bmN0aW9uKHNoYXBlLCBkYXRhVHlwZSkge1xyXG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcclxuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRkYXRhVHlwZSA9IG5ldyBEYXRhVHlwZShcImY2NFwiKTtcclxuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoZGF0YVR5cGUgKyBcIiBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgRGF0YVR5cGVcIik7XHJcblx0fVxyXG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XHJcblx0YXJyYXkuX2J1ZmZlciA9IGNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBhcnJheS5sZW5ndGggKiBkYXRhVHlwZS5zaXplKTtcclxuXHR2YXIga2VybmVsID0gc2V0S2VybmVsc1tkYXRhVHlwZS50eXBlXTtcclxuXHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbYXJyYXkubGVuZ3RoXSkpO1xyXG5cdGtlcm5lbC5zZXRBcmcoMSwgYXJyYXkuX2J1ZmZlcik7XHJcblx0a2VybmVsLnNldEFyZygyLCBuZXcgZGF0YVR5cGUuYXJyYXlUeXBlKFswLjBdKSk7XHJcblx0cXVldWUuZW5xdWV1ZU5EUmFuZ2VLZXJuZWwoa2VybmVsLCAxLCBudWxsLCBbYXJyYXkubGVuZ3RoXSk7XHJcblx0cmV0dXJuIGFycmF5O1xyXG59O1xyXG5cclxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5hcnJheSA9IGZ1bmN0aW9uKGRhdGEsIGRhdGFUeXBlKSB7XHJcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XHJcblx0fSBlbHNlIHtcclxuXHRcdGRhdGFUeXBlID0gdXRpbC5jaGVja0RhdGFUeXBlKGRhdGFUeXBlKTtcclxuXHR9XHJcblx0dmFyIHNoYXBlID0gW107XHJcblx0dXRpbC5kaXNjb3ZlckFycmF5U2hhcGVSZWN1cnNpdmUoZGF0YSwgc2hhcGUsIDApO1xyXG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XHJcblx0dmFyIGJ1ZmZlciA9IG5ldyBkYXRhVHlwZS5hcnJheVR5cGUoYXJyYXkubGVuZ3RoKTtcclxuXHR1dGlsLmNvcHlBcnJheURhdGFSZWN1cnNpdmUoYnVmZmVyLCBkYXRhLCBzaGFwZSwgMCwgMCk7XHJcblx0aWYgKHVzZUJ1ZmZlckNyZWF0aW9uV2l0aEluaXQpIHtcclxuXHRcdGFycmF5Ll9idWZmZXIgPSBjb250ZXh0LmNyZWF0ZUJ1ZmZlcihjbC5NRU1fUkVBRF9XUklURSwgYnVmZmVyLmJ5dGVMZW5ndGgsIGJ1ZmZlcik7XHJcblx0fSBlbHNlIHtcclxuXHRcdGFycmF5Ll9idWZmZXIgPSBjb250ZXh0LmNyZWF0ZUJ1ZmZlcihjbC5NRU1fUkVBRF9XUklURSwgYnVmZmVyLmJ5dGVMZW5ndGgpO1xyXG5cdFx0cXVldWUuZW5xdWV1ZVdyaXRlQnVmZmVyKGFycmF5Ll9idWZmZXIsIGZhbHNlLCAwLCBidWZmZXIuYnl0ZUxlbmd0aCwgYnVmZmVyKTtcclxuXHR9XHJcblx0cmV0dXJuIGFycmF5O1xyXG59O1xyXG5cclxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5faW52YWxpZGF0ZSA9IGZ1bmN0aW9uKGFycmF5KSB7XHJcblx0aWYgKGFycmF5Ll9idWZmZXIgIT09IG51bGwpIHtcclxuXHRcdC8qIFdvcmstYXJvdW5kIGZvciBDaHJvbWl1bS1XZWJDTCB0aGF0IGN1cnJlbnRseSBsYWNrcyBXZWJDTE1lbU9iamVjdC5yZWxlYXNlIG1ldGhvZCAqL1xyXG5cdFx0aWYgKHR5cGVvZiBhcnJheS5fYnVmZmVyLnJlbGVhc2UgIT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0YXJyYXkuX2J1ZmZlci5yZWxlYXNlKCk7XHJcblx0XHR9XHJcblx0XHRhcnJheS5fYnVmZmVyID0gbnVsbDtcclxuXHR9XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKCkge1xyXG5cdGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBhcmd1bWVudCBtaXNzaW5nXCIpO1xyXG5cdH1cclxuXHR2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdO1xyXG5cdC8qIFZhbGlkYXRlIGFyZ3VtZW50cyAqL1xyXG5cdGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdCBsZWFzdCBvbmUgTkRBcnJheSBhcmd1bWVudCBleHBlY3RlZFwiKTtcclxuXHR9XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoIC0gMTsgaSsrKSB7XHJcblx0XHRpZiAoIShhcmd1bWVudHNbaV0gaW5zdGFuY2VvZiBOREFycmF5KSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiQXJndW1lbnQgXCIgKyBpICsgXCIgaXMgbm90IGFuIE5EQXJyYXlcIik7XHJcblx0XHR9XHJcblx0fVxyXG5cdHZhciBjYWxsYmFja1dhaXRBcmd1bWVudHMgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTtcclxuXHR2YXIgY2FsbGJhY2tBcmd1bWVudHMgPSBuZXcgQXJyYXkoY2FsbGJhY2tXYWl0QXJndW1lbnRzKTtcclxuXHRpZiAodXNlQXN5bmNCdWZmZXJSZWFkKSB7XHJcblx0XHQvKiBBc3luYyB2ZXJzaW9uOiBkb2Vzbid0IHNlZW0gdG8gYmUgc3VwcG9ydGVkIGJ5IFdlYkNMIGltcGxlbWVudGF0aW9ucyAqL1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja1dhaXRBcmd1bWVudHM7IGkrKykge1xyXG5cdFx0XHR2YXIgYXJyYXkgPSBhcmd1bWVudHNbaV07XHJcblx0XHRcdChmdW5jdGlvbihpLCBzaGFwZSwgQXJyYXlUeXBlKSB7XHJcblx0XHRcdFx0dmFyIGJ1ZmZlciA9IG5ldyBBcnJheVR5cGUobGVuZ3RoKTtcclxuXHRcdFx0XHR2YXIgcmVhZEZpbmlzaEV2ZW50ID0gbmV3IFdlYkNMRXZlbnQoKTtcclxuXHRcdFx0XHRxdWV1ZS5lbnF1ZXVlUmVhZEJ1ZmZlcihhcnJheS5fYnVmZmVyLCBmYWxzZSwgMCwgYnVmZmVyLmJ5dGVMZW5ndGgsIGJ1ZmZlciwgbnVsbCwgcmVhZEZpbmlzaEV2ZW50KTtcclxuXHRcdFx0XHRpZiAoc2hhcGUubGVuZ3RoID09PSAwKSB7XHJcblx0XHRcdFx0XHRyZWFkRmluaXNoRXZlbnQuc2V0Q2FsbGJhY2soY2wuQ09NUExFVEUsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0XHRyZWFkRmluaXNoRXZlbnQucmVsZWFzZSgpO1xyXG5cdFx0XHRcdFx0XHRjYWxsYmFja0FyZ3VtZW50c1tpXSA9IHR5cGVkQXJyYXlbMF07XHJcblx0XHRcdFx0XHRcdGlmICgtLWNhbGxiYWNrV2FpdEFyZ3VtZW50cyA9PT0gMCkge1xyXG5cdFx0XHRcdFx0XHRcdGNhbGxiYWNrLmFwcGx5KG51bGwsIGNhbGxiYWNrQXJndW1lbnRzKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHJlYWRGaW5pc2hFdmVudC5zZXRDYWxsYmFjayhjbC5DT01QTEVURSwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRcdHJlYWRGaW5pc2hFdmVudC5yZWxlYXNlKCk7XHJcblx0XHRcdFx0XHRcdHZhciBqc2FycmF5ID0gbmV3IEFycmF5KHNoYXBlWzBdKTtcclxuXHRcdFx0XHRcdFx0Y3JlYXRlQXJyYXlSZWN1cnNpdmUobmV3IEFycmF5VHlwZShidWZmZXIpLCBqc2FycmF5LCBzaGFwZSwgMCwgMCk7XHJcblx0XHRcdFx0XHRcdGNhbGxiYWNrQXJndW1lbnRzW2ldID0ganNhcnJheTtcclxuXHRcdFx0XHRcdFx0aWYgKC0tY2FsbGJhY2tXYWl0QXJndW1lbnRzID09PSAwKSB7XHJcblx0XHRcdFx0XHRcdFx0Y2FsbGJhY2suYXBwbHkobnVsbCwgY2FsbGJhY2tBcmd1bWVudHMpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pKGksIGFycmF5LnNoYXBlLCBhcnJheS5kYXRhVHlwZS5hcnJheVR5cGUpO1xyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrV2FpdEFyZ3VtZW50czsgaSsrKSB7XHJcblx0XHRcdHZhciBhcnJheSA9IGFyZ3VtZW50c1tpXTtcclxuXHRcdFx0dmFyIGJ1ZmZlciA9IG5ldyBhcnJheS5kYXRhVHlwZS5hcnJheVR5cGUoYXJyYXkubGVuZ3RoKTtcclxuXHRcdFx0cXVldWUuZW5xdWV1ZVJlYWRCdWZmZXIoYXJyYXkuX2J1ZmZlciwgdHJ1ZSwgMCwgYnVmZmVyLmJ5dGVMZW5ndGgsIGJ1ZmZlcik7XHJcblx0XHRcdGlmIChhcnJheS5zaGFwZS5sZW5ndGggPT09IDApIHtcclxuXHRcdFx0XHRjYWxsYmFja0FyZ3VtZW50c1tpXSA9IHR5cGVkQXJyYXlbMF07XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmFyIGpzYXJyYXkgPSBuZXcgQXJyYXkoYXJyYXkuc2hhcGVbMF0pO1xyXG5cdFx0XHRcdHV0aWwuY3JlYXRlQXJyYXlSZWN1cnNpdmUobmV3IGFycmF5LmRhdGFUeXBlLmFycmF5VHlwZShidWZmZXIpLCBqc2FycmF5LCBhcnJheS5zaGFwZSwgMCwgMCk7XHJcblx0XHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBqc2FycmF5O1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRjYWxsYmFjay5hcHBseShudWxsLCBjYWxsYmFja0FyZ3VtZW50cyk7XHJcblx0fVxyXG59O1xyXG5cclxudmFyIGJpbmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBiLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xyXG5cdHZhciBzaGFwZSA9IG51bGwsIGRhdGFUeXBlID0gbnVsbDtcclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdHNoYXBlID0gYS5zaGFwZTtcclxuXHRcdGRhdGFUeXBlID0gYS5kYXRhVHlwZTtcclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRpZiAoIWlzQ29tcGF0aWJsZVNoYXBlKHNoYXBlLCBiLnNoYXBlKSkge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihcIlRoZSBhIGFuZCBiIGFycmF5cyBoYXZlIGluY29tcGF0aWJsZSBzaGFwZXNcIik7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAoIXV0aWwuaXNOdW1iZXIoYikpIHtcclxuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYlwiKTtcclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYVwiKTtcclxuXHR9XHJcblx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdG91dCA9IGNvbnRleHQuZW1wdHkoc2hhcGUsIGRhdGFUeXBlKTtcclxuXHR9IGVsc2UgaWYgKG91dCBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGlmICghaXNDb21wYXRpYmxlU2hhcGUoc2hhcGUsIG91dC5zaGFwZSkpIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVGhlIG91dCBhcnJheSBoYXMgaW5jb21wYXRpYmxlIHNoYXBlXCIpO1xyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwib3V0IGlzIG5vdCBhbiBOREFycmF5XCIpO1xyXG5cdH1cclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHR2YXIga2VybmVsID0gYmluYXJ5T3BLZXJuZWxzW29wZXJhdGlvbl1bZGF0YVR5cGUudHlwZV07XHJcblx0XHRcdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFtvdXQubGVuZ3RoXSkpO1xyXG5cdFx0XHRrZXJuZWwuc2V0QXJnKDEsIGEuX2J1ZmZlcik7XHJcblx0XHRcdGtlcm5lbC5zZXRBcmcoMiwgYi5fYnVmZmVyKTtcclxuXHRcdFx0a2VybmVsLnNldEFyZygzLCBvdXQuX2J1ZmZlcik7XHJcblx0XHRcdHF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMSwgbnVsbCwgW291dC5sZW5ndGhdKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHZhciBrZXJuZWwgPSBiaW5hcnlDb25zdE9wS2VybmVsc1tvcGVyYXRpb25dW2RhdGFUeXBlLnR5cGVdO1xyXG5cdFx0XHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbb3V0Lmxlbmd0aF0pKTtcclxuXHRcdFx0a2VybmVsLnNldEFyZygxLCBhLl9idWZmZXIpO1xyXG5cdFx0XHRrZXJuZWwuc2V0QXJnKDIsIG5ldyBhLmRhdGFUeXBlLmFycmF5VHlwZShbYl0pKTtcclxuXHRcdFx0a2VybmVsLnNldEFyZygzLCBvdXQuX2J1ZmZlcik7XHJcblx0XHRcdHF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMSwgbnVsbCwgW291dC5sZW5ndGhdKTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcbnZhciB1bmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xyXG5cdHZhciBzaGFwZSA9IG51bGwsIGRhdGFUeXBlID0gbnVsbDtcclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdHNoYXBlID0gYS5zaGFwZTtcclxuXHRcdGRhdGFUeXBlID0gYS5kYXRhVHlwZTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYVwiKTtcclxuXHR9XHJcblx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdG91dCA9IGNvbnRleHQuZW1wdHkoc2hhcGUsIGRhdGFUeXBlKTtcclxuXHR9IGVsc2UgaWYgKG91dCBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGlmICghaXNDb21wYXRpYmxlU2hhcGUoc2hhcGUsIG91dC5zaGFwZSkpIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVGhlIG91dCBhcnJheSBoYXMgaW5jb21wYXRpYmxlIHNoYXBlXCIpO1xyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwib3V0IGlzIG5vdCBhbiBOREFycmF5XCIpO1xyXG5cdH1cclxuXHR2YXIga2VybmVsID0gdW5hcnlPcEtlcm5lbHNbb3BlcmF0aW9uXVtkYXRhVHlwZS50eXBlXTtcclxuXHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbb3V0Lmxlbmd0aF0pKTtcclxuXHRrZXJuZWwuc2V0QXJnKDEsIGEuX2J1ZmZlcik7XHJcblx0a2VybmVsLnNldEFyZygyLCBvdXQuX2J1ZmZlcik7XHJcblx0cXVldWUuZW5xdWV1ZU5EUmFuZ2VLZXJuZWwoa2VybmVsLCAxLCBudWxsLCBbb3V0Lmxlbmd0aF0pO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJhZGRcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLnN1YiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJzdWJcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLm11bCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJtdWxcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmRpdiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJkaXZcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLm5lZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcIm5lZ1wiKTtcclxufTtcclxuXHJcbldlYkNMQ29udGV4dC5wcm90b3R5cGUuYWJzID0gZnVuY3Rpb24oYSwgb3V0KSB7XHJcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwiYWJzXCIpO1xyXG59O1xyXG5cclxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5leHAgPSBmdW5jdGlvbihhLCBvdXQpIHtcclxuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywgXCJleHBcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmxvZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcImxvZ1wiKTtcclxufTtcclxuXHJcbldlYkNMQ29udGV4dC5wcm90b3R5cGUuc3FydCA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcInNxcnRcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLnNxdWFyZSA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcInNxdWFyZVwiKTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gV2ViQ0xDb250ZXh0O1xyXG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5fdXNlVHlwZWRBcnJheXNgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAoY29tcGF0aWJsZSBkb3duIHRvIElFNilcbiAqL1xuQnVmZmVyLl91c2VUeXBlZEFycmF5cyA9IChmdW5jdGlvbiAoKSB7XG4gIC8vIERldGVjdCBpZiBicm93c2VyIHN1cHBvcnRzIFR5cGVkIEFycmF5cy4gU3VwcG9ydGVkIGJyb3dzZXJzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssXG4gIC8vIENocm9tZSA3KywgU2FmYXJpIDUuMSssIE9wZXJhIDExLjYrLCBpT1MgNC4yKy4gSWYgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBhZGRpbmdcbiAgLy8gcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLCB0aGVuIHRoYXQncyB0aGUgc2FtZSBhcyBubyBgVWludDhBcnJheWAgc3VwcG9ydFxuICAvLyBiZWNhdXNlIHdlIG5lZWQgdG8gYmUgYWJsZSB0byBhZGQgYWxsIHRoZSBub2RlIEJ1ZmZlciBBUEkgbWV0aG9kcy4gVGhpcyBpcyBhbiBpc3N1ZVxuICAvLyBpbiBGaXJlZm94IDQtMjkuIE5vdyBmaXhlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJlxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nIC8vIENocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICBpZiAoZW5jb2RpbmcgPT09ICdiYXNlNjQnICYmIHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgc3ViamVjdCA9IGJhc2U2NGNsZWFuKHN1YmplY3QpXG4gIH1cblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdC5sZW5ndGgpIC8vIGFzc3VtZSB0aGF0IG9iamVjdCBpcyBhcnJheS1saWtlXG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG5lZWRzIHRvIGJlIGEgbnVtYmVyLCBhcnJheSBvciBzdHJpbmcuJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGlmIChCdWZmZXIuaXNCdWZmZXIoc3ViamVjdCkpIHtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKylcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICB9IGVsc2Uge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKVxuICAgICAgICBidWZbaV0gPSAoKHN1YmplY3RbaV0gJSAyNTYpICsgMjU2KSAlIDI1NlxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBTVEFUSUMgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9PSBudWxsICYmIGIgIT09IHVuZGVmaW5lZCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ci50b1N0cmluZygpXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggLyAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgYXNzZXJ0KGlzQXJyYXkobGlzdCksICdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0WywgbGVuZ3RoXSknKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH0gZWxzZSBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gbGlzdFswXVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKHRvdGFsTGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICB0b3RhbExlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgdG90YWxMZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcih0b3RhbExlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gIGFzc2VydChCdWZmZXIuaXNCdWZmZXIoYSkgJiYgQnVmZmVyLmlzQnVmZmVyKGIpLCAnQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gTWF0aC5taW4oeCwgeSk7IGkgPCBsZW4gJiYgYVtpXSA9PT0gYltpXTsgaSsrKSB7fVxuICBpZiAoaSAhPT0gbGVuKSB7XG4gICAgeCA9IGFbaV1cbiAgICB5ID0gYltpXVxuICB9XG4gIGlmICh4IDwgeSkge1xuICAgIHJldHVybiAtMVxuICB9XG4gIGlmICh5IDwgeCkge1xuICAgIHJldHVybiAxXG4gIH1cbiAgcmV0dXJuIDBcbn1cblxuLy8gQlVGRkVSIElOU1RBTkNFIE1FVEhPRFNcbi8vID09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgYXNzZXJ0KHN0ckxlbiAlIDIgPT09IDAsICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYnl0ZSA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBhc3NlcnQoIWlzTmFOKGJ5dGUpLCAnSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBieXRlXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBTdXBwb3J0IGJvdGggKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKVxuICAvLyBhbmQgdGhlIGxlZ2FjeSAoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpXG4gIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgaWYgKCFpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICB9IGVsc2UgeyAgLy8gbGVnYWN5XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcblxuICB2YXIgcmV0XG4gIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIHJldCA9IGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIHJldCA9IGJpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gdXRmMTZsZVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgc2VsZiA9IHRoaXNcblxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcbiAgc3RhcnQgPSBOdW1iZXIoc3RhcnQpIHx8IDBcbiAgZW5kID0gKGVuZCA9PT0gdW5kZWZpbmVkKSA/IHNlbGYubGVuZ3RoIDogTnVtYmVyKGVuZClcblxuICAvLyBGYXN0cGF0aCBlbXB0eSBzdHJpbmdzXG4gIGlmIChlbmQgPT09IHN0YXJ0KVxuICAgIHJldHVybiAnJ1xuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBoZXhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gYXNjaWlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gYmluYXJ5U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSB1dGYxNmxlU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChiKSB7XG4gIGFzc2VydChCdWZmZXIuaXNCdWZmZXIoYiksICdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIChiKSB7XG4gIGFzc2VydChCdWZmZXIuaXNCdWZmZXIoYiksICdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uICh0YXJnZXQsIHRhcmdldF9zdGFydCwgc3RhcnQsIGVuZCkge1xuICB2YXIgc291cmNlID0gdGhpc1xuXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICghdGFyZ2V0X3N0YXJ0KSB0YXJnZXRfc3RhcnQgPSAwXG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgc291cmNlLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnc291cmNlRW5kIDwgc291cmNlU3RhcnQnKVxuICBhc3NlcnQodGFyZ2V0X3N0YXJ0ID49IDAgJiYgdGFyZ2V0X3N0YXJ0IDwgdGFyZ2V0Lmxlbmd0aCxcbiAgICAgICd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCBzb3VyY2UubGVuZ3RoLCAnc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChlbmQgPj0gMCAmJiBlbmQgPD0gc291cmNlLmxlbmd0aCwgJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpXG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgPCBlbmQgLSBzdGFydClcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0ICsgc3RhcnRcblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAobGVuIDwgMTAwIHx8ICFCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRfc3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRhcmdldC5fc2V0KHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSwgdGFyZ2V0X3N0YXJ0KVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHJldHVybiBhc2NpaVNsaWNlKGJ1Ziwgc3RhcnQsIGVuZClcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2kgKyAxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSBjbGFtcChzdGFydCwgbGVuLCAwKVxuICBlbmQgPSBjbGFtcChlbmQsIGxlbiwgbGVuKVxuXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5fYXVnbWVudCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpKVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgdmFyIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZCwgdHJ1ZSlcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgICByZXR1cm4gbmV3QnVmXG4gIH1cbn1cblxuLy8gYGdldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLmdldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMucmVhZFVJbnQ4KG9mZnNldClcbn1cblxuLy8gYHNldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHYsIG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLnNldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMud3JpdGVVSW50OCh2LCBvZmZzZXQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbmZ1bmN0aW9uIHJlYWRVSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gIH0gZWxzZSB7XG4gICAgdmFsID0gYnVmW29mZnNldF0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZFVJbnQxNih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkVUludDE2KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiByZWFkVUludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMl0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICAgIHZhbCB8PSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXQgKyAzXSA8PCAyNCA+Pj4gMClcbiAgfSBlbHNlIHtcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAxXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAyXSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDNdXG4gICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXRdIDw8IDI0ID4+PiAwKVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZFVJbnQzMih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkVUludDMyKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsXG4gICAgICAgICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICB2YXIgbmVnID0gdGhpc1tvZmZzZXRdICYgMHg4MFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gcmVhZEludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IHJlYWRVSW50MTYoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgdHJ1ZSlcbiAgdmFyIG5lZyA9IHZhbCAmIDB4ODAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmIC0gdmFsICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRJbnQxNih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gcmVhZEludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IHJlYWRVSW50MzIoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgdHJ1ZSlcbiAgdmFyIG5lZyA9IHZhbCAmIDB4ODAwMDAwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZmZmZmYgLSB2YWwgKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZEludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZEludDMyKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiByZWFkRmxvYXQgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgcmV0dXJuIGllZWU3NTQucmVhZChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkRmxvYXQodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkRmxvYXQodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHJlYWREb3VibGUgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgcmV0dXJuIGllZWU3NTQucmVhZChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkRG91YmxlKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZilcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpIHJldHVyblxuXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIHdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAgICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZiwgLTB4ODApXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHRoaXMud3JpdGVVSW50OCh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHRoaXMud3JpdGVVSW50OCgweGZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIG5vQXNzZXJ0KVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiB3cml0ZUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZiwgLTB4ODAwMClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHdyaXRlVUludDE2KGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHdyaXRlVUludDE2KGJ1ZiwgMHhmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICB3cml0ZVVJbnQzMihidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICB3cml0ZVVJbnQzMihidWYsIDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZJRUVFNzU0KHZhbHVlLCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyA3IDwgYnVmLmxlbmd0aCxcbiAgICAgICAgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZJRUVFNzU0KHZhbHVlLCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGFzc2VydChlbmQgPj0gc3RhcnQsICdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBhc3NlcnQoc3RhcnQgPj0gMCAmJiBzdGFydCA8IHRoaXMubGVuZ3RoLCAnc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChlbmQgPj0gMCAmJiBlbmQgPD0gdGhpcy5sZW5ndGgsICdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gdXRmOFRvQnl0ZXModmFsdWUudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3V0ID0gW11cbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBvdXRbaV0gPSB0b0hleCh0aGlzW2ldKVxuICAgIGlmIChpID09PSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTKSB7XG4gICAgICBvdXRbaSArIDFdID0gJy4uLidcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgb3V0LmpvaW4oJyAnKSArICc+J1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgICAgICBidWZbaV0gPSB0aGlzW2ldXG4gICAgICB9XG4gICAgICByZXR1cm4gYnVmLmJ1ZmZlclxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0J1ZmZlci50b0FycmF5QnVmZmVyIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJylcbiAgfVxufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBCUCA9IEJ1ZmZlci5wcm90b3R5cGVcblxuLyoqXG4gKiBBdWdtZW50IGEgVWludDhBcnJheSAqaW5zdGFuY2UqIChub3QgdGhlIFVpbnQ4QXJyYXkgY2xhc3MhKSB3aXRoIEJ1ZmZlciBtZXRob2RzXG4gKi9cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9pc0J1ZmZlciA9IHRydWVcblxuICAvLyBzYXZlIHJlZmVyZW5jZSB0byBvcmlnaW5hbCBVaW50OEFycmF5IGdldC9zZXQgbWV0aG9kcyBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9nZXQgPSBhcnIuZ2V0XG4gIGFyci5fc2V0ID0gYXJyLnNldFxuXG4gIC8vIGRlcHJlY2F0ZWQsIHdpbGwgYmUgcmVtb3ZlZCBpbiBub2RlIDAuMTMrXG4gIGFyci5nZXQgPSBCUC5nZXRcbiAgYXJyLnNldCA9IEJQLnNldFxuXG4gIGFyci53cml0ZSA9IEJQLndyaXRlXG4gIGFyci50b1N0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0xvY2FsZVN0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0pTT04gPSBCUC50b0pTT05cbiAgYXJyLmVxdWFscyA9IEJQLmVxdWFsc1xuICBhcnIuY29tcGFyZSA9IEJQLmNvbXBhcmVcbiAgYXJyLmNvcHkgPSBCUC5jb3B5XG4gIGFyci5zbGljZSA9IEJQLnNsaWNlXG4gIGFyci5yZWFkVUludDggPSBCUC5yZWFkVUludDhcbiAgYXJyLnJlYWRVSW50MTZMRSA9IEJQLnJlYWRVSW50MTZMRVxuICBhcnIucmVhZFVJbnQxNkJFID0gQlAucmVhZFVJbnQxNkJFXG4gIGFyci5yZWFkVUludDMyTEUgPSBCUC5yZWFkVUludDMyTEVcbiAgYXJyLnJlYWRVSW50MzJCRSA9IEJQLnJlYWRVSW50MzJCRVxuICBhcnIucmVhZEludDggPSBCUC5yZWFkSW50OFxuICBhcnIucmVhZEludDE2TEUgPSBCUC5yZWFkSW50MTZMRVxuICBhcnIucmVhZEludDE2QkUgPSBCUC5yZWFkSW50MTZCRVxuICBhcnIucmVhZEludDMyTEUgPSBCUC5yZWFkSW50MzJMRVxuICBhcnIucmVhZEludDMyQkUgPSBCUC5yZWFkSW50MzJCRVxuICBhcnIucmVhZEZsb2F0TEUgPSBCUC5yZWFkRmxvYXRMRVxuICBhcnIucmVhZEZsb2F0QkUgPSBCUC5yZWFkRmxvYXRCRVxuICBhcnIucmVhZERvdWJsZUxFID0gQlAucmVhZERvdWJsZUxFXG4gIGFyci5yZWFkRG91YmxlQkUgPSBCUC5yZWFkRG91YmxlQkVcbiAgYXJyLndyaXRlVUludDggPSBCUC53cml0ZVVJbnQ4XG4gIGFyci53cml0ZVVJbnQxNkxFID0gQlAud3JpdGVVSW50MTZMRVxuICBhcnIud3JpdGVVSW50MTZCRSA9IEJQLndyaXRlVUludDE2QkVcbiAgYXJyLndyaXRlVUludDMyTEUgPSBCUC53cml0ZVVJbnQzMkxFXG4gIGFyci53cml0ZVVJbnQzMkJFID0gQlAud3JpdGVVSW50MzJCRVxuICBhcnIud3JpdGVJbnQ4ID0gQlAud3JpdGVJbnQ4XG4gIGFyci53cml0ZUludDE2TEUgPSBCUC53cml0ZUludDE2TEVcbiAgYXJyLndyaXRlSW50MTZCRSA9IEJQLndyaXRlSW50MTZCRVxuICBhcnIud3JpdGVJbnQzMkxFID0gQlAud3JpdGVJbnQzMkxFXG4gIGFyci53cml0ZUludDMyQkUgPSBCUC53cml0ZUludDMyQkVcbiAgYXJyLndyaXRlRmxvYXRMRSA9IEJQLndyaXRlRmxvYXRMRVxuICBhcnIud3JpdGVGbG9hdEJFID0gQlAud3JpdGVGbG9hdEJFXG4gIGFyci53cml0ZURvdWJsZUxFID0gQlAud3JpdGVEb3VibGVMRVxuICBhcnIud3JpdGVEb3VibGVCRSA9IEJQLndyaXRlRG91YmxlQkVcbiAgYXJyLmZpbGwgPSBCUC5maWxsXG4gIGFyci5pbnNwZWN0ID0gQlAuaW5zcGVjdFxuICBhcnIudG9BcnJheUJ1ZmZlciA9IEJQLnRvQXJyYXlCdWZmZXJcblxuICByZXR1cm4gYXJyXG59XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLXpdL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiBzdHJpbmd0cmltIChzdHIpIHtcbiAgaWYgKHN0ci50cmltKSByZXR1cm4gc3RyLnRyaW0oKVxuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxufVxuXG4vLyBzbGljZShzdGFydCwgZW5kKVxuZnVuY3Rpb24gY2xhbXAgKGluZGV4LCBsZW4sIGRlZmF1bHRWYWx1ZSkge1xuICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGRlZmF1bHRWYWx1ZVxuICBpbmRleCA9IH5+aW5kZXg7ICAvLyBDb2VyY2UgdG8gaW50ZWdlci5cbiAgaWYgKGluZGV4ID49IGxlbikgcmV0dXJuIGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIGluZGV4ICs9IGxlblxuICBpZiAoaW5kZXggPj0gMCkgcmV0dXJuIGluZGV4XG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGNvZXJjZSAobGVuZ3RoKSB7XG4gIC8vIENvZXJjZSBsZW5ndGggdG8gYSBudW1iZXIgKHBvc3NpYmx5IE5hTiksIHJvdW5kIHVwXG4gIC8vIGluIGNhc2UgaXQncyBmcmFjdGlvbmFsIChlLmcuIDEyMy40NTYpIHRoZW4gZG8gYVxuICAvLyBkb3VibGUgbmVnYXRlIHRvIGNvZXJjZSBhIE5hTiB0byAwLiBFYXN5LCByaWdodD9cbiAgbGVuZ3RoID0gfn5NYXRoLmNlaWwoK2xlbmd0aClcbiAgcmV0dXJuIGxlbmd0aCA8IDAgPyAwIDogbGVuZ3RoXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkgKHN1YmplY3QpIHtcbiAgcmV0dXJuIChBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChzdWJqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzdWJqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJ1xuICB9KShzdWJqZWN0KVxufVxuXG5mdW5jdGlvbiBpc0FycmF5aXNoIChzdWJqZWN0KSB7XG4gIHJldHVybiBpc0FycmF5KHN1YmplY3QpIHx8IEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSB8fFxuICAgICAgc3ViamVjdCAmJiB0eXBlb2Ygc3ViamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHR5cGVvZiBzdWJqZWN0Lmxlbmd0aCA9PT0gJ251bWJlcidcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBpZiAoYiA8PSAweDdGKSB7XG4gICAgICBieXRlQXJyYXkucHVzaChiKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgc3RhcnQgPSBpXG4gICAgICBpZiAoYiA+PSAweEQ4MDAgJiYgYiA8PSAweERGRkYpIGkrK1xuICAgICAgdmFyIGggPSBlbmNvZGVVUklDb21wb25lbnQoc3RyLnNsaWNlKHN0YXJ0LCBpKzEpKS5zdWJzdHIoMSkuc3BsaXQoJyUnKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGJ5dGVBcnJheS5wdXNoKHBhcnNlSW50KGhbal0sIDE2KSlcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoc3RyKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSlcbiAgICAgIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gZGVjb2RlVXRmOENoYXIgKHN0cikge1xuICB0cnkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoc3RyKVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgweEZGRkQpIC8vIFVURiA4IGludmFsaWQgY2hhclxuICB9XG59XG5cbi8qXG4gKiBXZSBoYXZlIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSB2YWx1ZSBpcyBhIHZhbGlkIGludGVnZXIuIFRoaXMgbWVhbnMgdGhhdCBpdFxuICogaXMgbm9uLW5lZ2F0aXZlLiBJdCBoYXMgbm8gZnJhY3Rpb25hbCBjb21wb25lbnQgYW5kIHRoYXQgaXQgZG9lcyBub3RcbiAqIGV4Y2VlZCB0aGUgbWF4aW11bSBhbGxvd2VkIHZhbHVlLlxuICovXG5mdW5jdGlvbiB2ZXJpZnVpbnQgKHZhbHVlLCBtYXgpIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlID49IDAsICdzcGVjaWZpZWQgYSBuZWdhdGl2ZSB2YWx1ZSBmb3Igd3JpdGluZyBhbiB1bnNpZ25lZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA8PSBtYXgsICd2YWx1ZSBpcyBsYXJnZXIgdGhhbiBtYXhpbXVtIHZhbHVlIGZvciB0eXBlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZzaW50ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSwgJ3ZhbHVlIGhhcyBhIGZyYWN0aW9uYWwgY29tcG9uZW50Jylcbn1cblxuZnVuY3Rpb24gdmVyaWZJRUVFNzU0ICh2YWx1ZSwgbWF4LCBtaW4pIHtcbiAgYXNzZXJ0KHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicsICdjYW5ub3Qgd3JpdGUgYSBub24tbnVtYmVyIGFzIGEgbnVtYmVyJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGxhcmdlciB0aGFuIG1heGltdW0gYWxsb3dlZCB2YWx1ZScpXG4gIGFzc2VydCh2YWx1ZSA+PSBtaW4sICd2YWx1ZSBzbWFsbGVyIHRoYW4gbWluaW11bSBhbGxvd2VkIHZhbHVlJylcbn1cblxuZnVuY3Rpb24gYXNzZXJ0ICh0ZXN0LCBtZXNzYWdlKSB7XG4gIGlmICghdGVzdCkgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UgfHwgJ0ZhaWxlZCBhc3NlcnRpb24nKVxufVxuIiwidmFyIGxvb2t1cCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJztcblxuOyhmdW5jdGlvbiAoZXhwb3J0cykge1xuXHQndXNlIHN0cmljdCc7XG5cbiAgdmFyIEFyciA9ICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgPyBVaW50OEFycmF5XG4gICAgOiBBcnJheVxuXG5cdHZhciBQTFVTICAgPSAnKycuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0ggID0gJy8nLmNoYXJDb2RlQXQoMClcblx0dmFyIE5VTUJFUiA9ICcwJy5jaGFyQ29kZUF0KDApXG5cdHZhciBMT1dFUiAgPSAnYScuY2hhckNvZGVBdCgwKVxuXHR2YXIgVVBQRVIgID0gJ0EnLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUylcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0gpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0ZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG5cdGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgbkJpdHMgPSAtNyxcbiAgICAgIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMCxcbiAgICAgIGQgPSBpc0xFID8gLTEgOiAxLFxuICAgICAgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXTtcblxuICBpICs9IGQ7XG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSk7XG4gIHMgPj49ICgtbkJpdHMpO1xuICBuQml0cyArPSBlTGVuO1xuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KTtcblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKTtcbiAgZSA+Pj0gKC1uQml0cyk7XG4gIG5CaXRzICs9IG1MZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhcztcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpO1xuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbik7XG4gICAgZSA9IGUgLSBlQmlhcztcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKTtcbn07XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbihidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgYyxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMCksXG4gICAgICBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSksXG4gICAgICBkID0gaXNMRSA/IDEgOiAtMSxcbiAgICAgIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDA7XG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSk7XG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDA7XG4gICAgZSA9IGVNYXg7XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpO1xuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLTtcbiAgICAgIGMgKj0gMjtcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKTtcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKys7XG4gICAgICBjIC89IDI7XG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMDtcbiAgICAgIGUgPSBlTWF4O1xuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSBlICsgZUJpYXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICAgIGUgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpO1xuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG07XG4gIGVMZW4gKz0gbUxlbjtcbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KTtcblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjg7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9jaGFpJyk7XG4iLCIvKiFcbiAqIGNoYWlcbiAqIENvcHlyaWdodChjKSAyMDExLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG52YXIgdXNlZCA9IFtdXG4gICwgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8qIVxuICogQ2hhaSB2ZXJzaW9uXG4gKi9cblxuZXhwb3J0cy52ZXJzaW9uID0gJzEuOS4xJztcblxuLyohXG4gKiBBc3NlcnRpb24gRXJyb3JcbiAqL1xuXG5leHBvcnRzLkFzc2VydGlvbkVycm9yID0gcmVxdWlyZSgnYXNzZXJ0aW9uLWVycm9yJyk7XG5cbi8qIVxuICogVXRpbHMgZm9yIHBsdWdpbnMgKG5vdCBleHBvcnRlZClcbiAqL1xuXG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vY2hhaS91dGlscycpO1xuXG4vKipcbiAqICMgLnVzZShmdW5jdGlvbilcbiAqXG4gKiBQcm92aWRlcyBhIHdheSB0byBleHRlbmQgdGhlIGludGVybmFscyBvZiBDaGFpXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn1cbiAqIEByZXR1cm5zIHt0aGlzfSBmb3IgY2hhaW5pbmdcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZXhwb3J0cy51c2UgPSBmdW5jdGlvbiAoZm4pIHtcbiAgaWYgKCF+dXNlZC5pbmRleE9mKGZuKSkge1xuICAgIGZuKHRoaXMsIHV0aWwpO1xuICAgIHVzZWQucHVzaChmbik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qIVxuICogQ29uZmlndXJhdGlvblxuICovXG5cbnZhciBjb25maWcgPSByZXF1aXJlKCcuL2NoYWkvY29uZmlnJyk7XG5leHBvcnRzLmNvbmZpZyA9IGNvbmZpZztcblxuLyohXG4gKiBQcmltYXJ5IGBBc3NlcnRpb25gIHByb3RvdHlwZVxuICovXG5cbnZhciBhc3NlcnRpb24gPSByZXF1aXJlKCcuL2NoYWkvYXNzZXJ0aW9uJyk7XG5leHBvcnRzLnVzZShhc3NlcnRpb24pO1xuXG4vKiFcbiAqIENvcmUgQXNzZXJ0aW9uc1xuICovXG5cbnZhciBjb3JlID0gcmVxdWlyZSgnLi9jaGFpL2NvcmUvYXNzZXJ0aW9ucycpO1xuZXhwb3J0cy51c2UoY29yZSk7XG5cbi8qIVxuICogRXhwZWN0IGludGVyZmFjZVxuICovXG5cbnZhciBleHBlY3QgPSByZXF1aXJlKCcuL2NoYWkvaW50ZXJmYWNlL2V4cGVjdCcpO1xuZXhwb3J0cy51c2UoZXhwZWN0KTtcblxuLyohXG4gKiBTaG91bGQgaW50ZXJmYWNlXG4gKi9cblxudmFyIHNob3VsZCA9IHJlcXVpcmUoJy4vY2hhaS9pbnRlcmZhY2Uvc2hvdWxkJyk7XG5leHBvcnRzLnVzZShzaG91bGQpO1xuXG4vKiFcbiAqIEFzc2VydCBpbnRlcmZhY2VcbiAqL1xuXG52YXIgYXNzZXJ0ID0gcmVxdWlyZSgnLi9jaGFpL2ludGVyZmFjZS9hc3NlcnQnKTtcbmV4cG9ydHMudXNlKGFzc2VydCk7XG4iLCIvKiFcbiAqIGNoYWlcbiAqIGh0dHA6Ly9jaGFpanMuY29tXG4gKiBDb3B5cmlnaHQoYykgMjAxMS0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY29uZmlnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKF9jaGFpLCB1dGlsKSB7XG4gIC8qIVxuICAgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICAgKi9cblxuICB2YXIgQXNzZXJ0aW9uRXJyb3IgPSBfY2hhaS5Bc3NlcnRpb25FcnJvclxuICAgICwgZmxhZyA9IHV0aWwuZmxhZztcblxuICAvKiFcbiAgICogTW9kdWxlIGV4cG9ydC5cbiAgICovXG5cbiAgX2NoYWkuQXNzZXJ0aW9uID0gQXNzZXJ0aW9uO1xuXG4gIC8qIVxuICAgKiBBc3NlcnRpb24gQ29uc3RydWN0b3JcbiAgICpcbiAgICogQ3JlYXRlcyBvYmplY3QgZm9yIGNoYWluaW5nLlxuICAgKlxuICAgKiBAYXBpIHByaXZhdGVcbiAgICovXG5cbiAgZnVuY3Rpb24gQXNzZXJ0aW9uIChvYmosIG1zZywgc3RhY2spIHtcbiAgICBmbGFnKHRoaXMsICdzc2ZpJywgc3RhY2sgfHwgYXJndW1lbnRzLmNhbGxlZSk7XG4gICAgZmxhZyh0aGlzLCAnb2JqZWN0Jywgb2JqKTtcbiAgICBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgfVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShBc3NlcnRpb24sICdpbmNsdWRlU3RhY2snLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnNvbGUud2FybignQXNzZXJ0aW9uLmluY2x1ZGVTdGFjayBpcyBkZXByZWNhdGVkLCB1c2UgY2hhaS5jb25maWcuaW5jbHVkZVN0YWNrIGluc3RlYWQuJyk7XG4gICAgICByZXR1cm4gY29uZmlnLmluY2x1ZGVTdGFjaztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGNvbnNvbGUud2FybignQXNzZXJ0aW9uLmluY2x1ZGVTdGFjayBpcyBkZXByZWNhdGVkLCB1c2UgY2hhaS5jb25maWcuaW5jbHVkZVN0YWNrIGluc3RlYWQuJyk7XG4gICAgICBjb25maWcuaW5jbHVkZVN0YWNrID0gdmFsdWU7XG4gICAgfVxuICB9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQXNzZXJ0aW9uLCAnc2hvd0RpZmYnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnNvbGUud2FybignQXNzZXJ0aW9uLnNob3dEaWZmIGlzIGRlcHJlY2F0ZWQsIHVzZSBjaGFpLmNvbmZpZy5zaG93RGlmZiBpbnN0ZWFkLicpO1xuICAgICAgcmV0dXJuIGNvbmZpZy5zaG93RGlmZjtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGNvbnNvbGUud2FybignQXNzZXJ0aW9uLnNob3dEaWZmIGlzIGRlcHJlY2F0ZWQsIHVzZSBjaGFpLmNvbmZpZy5zaG93RGlmZiBpbnN0ZWFkLicpO1xuICAgICAgY29uZmlnLnNob3dEaWZmID0gdmFsdWU7XG4gICAgfVxuICB9KTtcblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgICB1dGlsLmFkZFByb3BlcnR5KHRoaXMucHJvdG90eXBlLCBuYW1lLCBmbik7XG4gIH07XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICAgIHV0aWwuYWRkTWV0aG9kKHRoaXMucHJvdG90eXBlLCBuYW1lLCBmbik7XG4gIH07XG5cbiAgQXNzZXJ0aW9uLmFkZENoYWluYWJsZU1ldGhvZCA9IGZ1bmN0aW9uIChuYW1lLCBmbiwgY2hhaW5pbmdCZWhhdmlvcikge1xuICAgIHV0aWwuYWRkQ2hhaW5hYmxlTWV0aG9kKHRoaXMucHJvdG90eXBlLCBuYW1lLCBmbiwgY2hhaW5pbmdCZWhhdmlvcik7XG4gIH07XG5cbiAgQXNzZXJ0aW9uLm92ZXJ3cml0ZVByb3BlcnR5ID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gICAgdXRpbC5vdmVyd3JpdGVQcm9wZXJ0eSh0aGlzLnByb3RvdHlwZSwgbmFtZSwgZm4pO1xuICB9O1xuXG4gIEFzc2VydGlvbi5vdmVyd3JpdGVNZXRob2QgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgICB1dGlsLm92ZXJ3cml0ZU1ldGhvZCh0aGlzLnByb3RvdHlwZSwgbmFtZSwgZm4pO1xuICB9O1xuXG4gIEFzc2VydGlvbi5vdmVyd3JpdGVDaGFpbmFibGVNZXRob2QgPSBmdW5jdGlvbiAobmFtZSwgZm4sIGNoYWluaW5nQmVoYXZpb3IpIHtcbiAgICB1dGlsLm92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZCh0aGlzLnByb3RvdHlwZSwgbmFtZSwgZm4sIGNoYWluaW5nQmVoYXZpb3IpO1xuICB9O1xuXG4gIC8qIVxuICAgKiAjIyMgLmFzc2VydChleHByZXNzaW9uLCBtZXNzYWdlLCBuZWdhdGVNZXNzYWdlLCBleHBlY3RlZCwgYWN0dWFsKVxuICAgKlxuICAgKiBFeGVjdXRlcyBhbiBleHByZXNzaW9uIGFuZCBjaGVjayBleHBlY3RhdGlvbnMuIFRocm93cyBBc3NlcnRpb25FcnJvciBmb3IgcmVwb3J0aW5nIGlmIHRlc3QgZG9lc24ndCBwYXNzLlxuICAgKlxuICAgKiBAbmFtZSBhc3NlcnRcbiAgICogQHBhcmFtIHtQaGlsb3NvcGhpY2FsfSBleHByZXNzaW9uIHRvIGJlIHRlc3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSB0byBkaXNwbGF5IGlmIGZhaWxzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuZWdhdGVkTWVzc2FnZSB0byBkaXNwbGF5IGlmIG5lZ2F0ZWQgZXhwcmVzc2lvbiBmYWlsc1xuICAgKiBAcGFyYW0ge01peGVkfSBleHBlY3RlZCB2YWx1ZSAocmVtZW1iZXIgdG8gY2hlY2sgZm9yIG5lZ2F0aW9uKVxuICAgKiBAcGFyYW0ge01peGVkfSBhY3R1YWwgKG9wdGlvbmFsKSB3aWxsIGRlZmF1bHQgdG8gYHRoaXMub2JqYFxuICAgKiBAYXBpIHByaXZhdGVcbiAgICovXG5cbiAgQXNzZXJ0aW9uLnByb3RvdHlwZS5hc3NlcnQgPSBmdW5jdGlvbiAoZXhwciwgbXNnLCBuZWdhdGVNc2csIGV4cGVjdGVkLCBfYWN0dWFsLCBzaG93RGlmZikge1xuICAgIHZhciBvayA9IHV0aWwudGVzdCh0aGlzLCBhcmd1bWVudHMpO1xuICAgIGlmICh0cnVlICE9PSBzaG93RGlmZikgc2hvd0RpZmYgPSBmYWxzZTtcbiAgICBpZiAodHJ1ZSAhPT0gY29uZmlnLnNob3dEaWZmKSBzaG93RGlmZiA9IGZhbHNlO1xuXG4gICAgaWYgKCFvaykge1xuICAgICAgdmFyIG1zZyA9IHV0aWwuZ2V0TWVzc2FnZSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICAgICwgYWN0dWFsID0gdXRpbC5nZXRBY3R1YWwodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2csIHtcbiAgICAgICAgICBhY3R1YWw6IGFjdHVhbFxuICAgICAgICAsIGV4cGVjdGVkOiBleHBlY3RlZFxuICAgICAgICAsIHNob3dEaWZmOiBzaG93RGlmZlxuICAgICAgfSwgKGNvbmZpZy5pbmNsdWRlU3RhY2spID8gdGhpcy5hc3NlcnQgOiBmbGFnKHRoaXMsICdzc2ZpJykpO1xuICAgIH1cbiAgfTtcblxuICAvKiFcbiAgICogIyMjIC5fb2JqXG4gICAqXG4gICAqIFF1aWNrIHJlZmVyZW5jZSB0byBzdG9yZWQgYGFjdHVhbGAgdmFsdWUgZm9yIHBsdWdpbiBkZXZlbG9wZXJzLlxuICAgKlxuICAgKiBAYXBpIHByaXZhdGVcbiAgICovXG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEFzc2VydGlvbi5wcm90b3R5cGUsICdfb2JqJyxcbiAgICB7IGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgICB9XG4gICAgLCBzZXQ6IGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgZmxhZyh0aGlzLCAnb2JqZWN0JywgdmFsKTtcbiAgICAgIH1cbiAgfSk7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgLyoqXG4gICAqICMjIyBjb25maWcuaW5jbHVkZVN0YWNrXG4gICAqXG4gICAqIFVzZXIgY29uZmlndXJhYmxlIHByb3BlcnR5LCBpbmZsdWVuY2VzIHdoZXRoZXIgc3RhY2sgdHJhY2VcbiAgICogaXMgaW5jbHVkZWQgaW4gQXNzZXJ0aW9uIGVycm9yIG1lc3NhZ2UuIERlZmF1bHQgb2YgZmFsc2VcbiAgICogc3VwcHJlc3NlcyBzdGFjayB0cmFjZSBpbiB0aGUgZXJyb3IgbWVzc2FnZS5cbiAgICpcbiAgICogICAgIGNoYWkuY29uZmlnLmluY2x1ZGVTdGFjayA9IHRydWU7ICAvLyBlbmFibGUgc3RhY2sgb24gZXJyb3JcbiAgICpcbiAgICogQHBhcmFtIHtCb29sZWFufVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICAgaW5jbHVkZVN0YWNrOiBmYWxzZSxcblxuICAvKipcbiAgICogIyMjIGNvbmZpZy5zaG93RGlmZlxuICAgKlxuICAgKiBVc2VyIGNvbmZpZ3VyYWJsZSBwcm9wZXJ0eSwgaW5mbHVlbmNlcyB3aGV0aGVyIG9yIG5vdFxuICAgKiB0aGUgYHNob3dEaWZmYCBmbGFnIHNob3VsZCBiZSBpbmNsdWRlZCBpbiB0aGUgdGhyb3duXG4gICAqIEFzc2VydGlvbkVycm9ycy4gYGZhbHNlYCB3aWxsIGFsd2F5cyBiZSBgZmFsc2VgOyBgdHJ1ZWBcbiAgICogd2lsbCBiZSB0cnVlIHdoZW4gdGhlIGFzc2VydGlvbiBoYXMgcmVxdWVzdGVkIGEgZGlmZlxuICAgKiBiZSBzaG93bi5cbiAgICpcbiAgICogQHBhcmFtIHtCb29sZWFufVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBzaG93RGlmZjogdHJ1ZSxcblxuICAvKipcbiAgICogIyMjIGNvbmZpZy50cnVuY2F0ZVRocmVzaG9sZFxuICAgKlxuICAgKiBVc2VyIGNvbmZpZ3VyYWJsZSBwcm9wZXJ0eSwgc2V0cyBsZW5ndGggdGhyZXNob2xkIGZvciBhY3R1YWwgYW5kXG4gICAqIGV4cGVjdGVkIHZhbHVlcyBpbiBhc3NlcnRpb24gZXJyb3JzLiBJZiB0aGlzIHRocmVzaG9sZCBpcyBleGNlZWRlZCxcbiAgICogdGhlIHZhbHVlIGlzIHRydW5jYXRlZC5cbiAgICpcbiAgICogU2V0IGl0IHRvIHplcm8gaWYgeW91IHdhbnQgdG8gZGlzYWJsZSB0cnVuY2F0aW5nIGFsdG9nZXRoZXIuXG4gICAqXG4gICAqICAgICBjaGFpLmNvbmZpZy50cnVuY2F0ZVRocmVzaG9sZCA9IDA7ICAvLyBkaXNhYmxlIHRydW5jYXRpbmdcbiAgICpcbiAgICogQHBhcmFtIHtOdW1iZXJ9XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIHRydW5jYXRlVGhyZXNob2xkOiA0MFxuXG59O1xuIiwiLyohXG4gKiBjaGFpXG4gKiBodHRwOi8vY2hhaWpzLmNvbVxuICogQ29weXJpZ2h0KGMpIDIwMTEtMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNoYWksIF8pIHtcbiAgdmFyIEFzc2VydGlvbiA9IGNoYWkuQXNzZXJ0aW9uXG4gICAgLCB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdcbiAgICAsIGZsYWcgPSBfLmZsYWc7XG5cbiAgLyoqXG4gICAqICMjIyBMYW5ndWFnZSBDaGFpbnNcbiAgICpcbiAgICogVGhlIGZvbGxvd2luZyBhcmUgcHJvdmlkZWQgYXMgY2hhaW5hYmxlIGdldHRlcnMgdG9cbiAgICogaW1wcm92ZSB0aGUgcmVhZGFiaWxpdHkgb2YgeW91ciBhc3NlcnRpb25zLiBUaGV5XG4gICAqIGRvIG5vdCBwcm92aWRlIHRlc3RpbmcgY2FwYWJpbGl0aWVzIHVubGVzcyB0aGV5XG4gICAqIGhhdmUgYmVlbiBvdmVyd3JpdHRlbiBieSBhIHBsdWdpbi5cbiAgICpcbiAgICogKipDaGFpbnMqKlxuICAgKlxuICAgKiAtIHRvXG4gICAqIC0gYmVcbiAgICogLSBiZWVuXG4gICAqIC0gaXNcbiAgICogLSB0aGF0XG4gICAqIC0gYW5kXG4gICAqIC0gaGFzXG4gICAqIC0gaGF2ZVxuICAgKiAtIHdpdGhcbiAgICogLSBhdFxuICAgKiAtIG9mXG4gICAqIC0gc2FtZVxuICAgKlxuICAgKiBAbmFtZSBsYW5ndWFnZSBjaGFpbnNcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgWyAndG8nLCAnYmUnLCAnYmVlbidcbiAgLCAnaXMnLCAnYW5kJywgJ2hhcycsICdoYXZlJ1xuICAsICd3aXRoJywgJ3RoYXQnLCAnYXQnXG4gICwgJ29mJywgJ3NhbWUnIF0uZm9yRWFjaChmdW5jdGlvbiAoY2hhaW4pIHtcbiAgICBBc3NlcnRpb24uYWRkUHJvcGVydHkoY2hhaW4sIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0pO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5ub3RcbiAgICpcbiAgICogTmVnYXRlcyBhbnkgb2YgYXNzZXJ0aW9ucyBmb2xsb3dpbmcgaW4gdGhlIGNoYWluLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KGZvbykudG8ubm90LmVxdWFsKCdiYXInKTtcbiAgICogICAgIGV4cGVjdChnb29kRm4pLnRvLm5vdC50aHJvdyhFcnJvcik7XG4gICAqICAgICBleHBlY3QoeyBmb286ICdiYXonIH0pLnRvLmhhdmUucHJvcGVydHkoJ2ZvbycpXG4gICAqICAgICAgIC5hbmQubm90LmVxdWFsKCdiYXInKTtcbiAgICpcbiAgICogQG5hbWUgbm90XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnbm90JywgZnVuY3Rpb24gKCkge1xuICAgIGZsYWcodGhpcywgJ25lZ2F0ZScsIHRydWUpO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5kZWVwXG4gICAqXG4gICAqIFNldHMgdGhlIGBkZWVwYCBmbGFnLCBsYXRlciB1c2VkIGJ5IHRoZSBgZXF1YWxgIGFuZFxuICAgKiBgcHJvcGVydHlgIGFzc2VydGlvbnMuXG4gICAqXG4gICAqICAgICBleHBlY3QoZm9vKS50by5kZWVwLmVxdWFsKHsgYmFyOiAnYmF6JyB9KTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogeyBiYXI6IHsgYmF6OiAncXV1eCcgfSB9IH0pXG4gICAqICAgICAgIC50by5oYXZlLmRlZXAucHJvcGVydHkoJ2Zvby5iYXIuYmF6JywgJ3F1dXgnKTtcbiAgICpcbiAgICogQG5hbWUgZGVlcFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ2RlZXAnLCBmdW5jdGlvbiAoKSB7XG4gICAgZmxhZyh0aGlzLCAnZGVlcCcsIHRydWUpO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5hKHR5cGUpXG4gICAqXG4gICAqIFRoZSBgYWAgYW5kIGBhbmAgYXNzZXJ0aW9ucyBhcmUgYWxpYXNlcyB0aGF0IGNhbiBiZVxuICAgKiB1c2VkIGVpdGhlciBhcyBsYW5ndWFnZSBjaGFpbnMgb3IgdG8gYXNzZXJ0IGEgdmFsdWUnc1xuICAgKiB0eXBlLlxuICAgKlxuICAgKiAgICAgLy8gdHlwZW9mXG4gICAqICAgICBleHBlY3QoJ3Rlc3QnKS50by5iZS5hKCdzdHJpbmcnKTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogJ2JhcicgfSkudG8uYmUuYW4oJ29iamVjdCcpO1xuICAgKiAgICAgZXhwZWN0KG51bGwpLnRvLmJlLmEoJ251bGwnKTtcbiAgICogICAgIGV4cGVjdCh1bmRlZmluZWQpLnRvLmJlLmFuKCd1bmRlZmluZWQnKTtcbiAgICpcbiAgICogICAgIC8vIGxhbmd1YWdlIGNoYWluXG4gICAqICAgICBleHBlY3QoZm9vKS50by5iZS5hbi5pbnN0YW5jZW9mKEZvbyk7XG4gICAqXG4gICAqIEBuYW1lIGFcbiAgICogQGFsaWFzIGFuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYW4gKHR5cGUsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHR5cGUgPSB0eXBlLnRvTG93ZXJDYXNlKCk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsIGFydGljbGUgPSB+WyAnYScsICdlJywgJ2knLCAnbycsICd1JyBdLmluZGV4T2YodHlwZS5jaGFyQXQoMCkpID8gJ2FuICcgOiAnYSAnO1xuXG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIHR5cGUgPT09IF8udHlwZShvYmopXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlICcgKyBhcnRpY2xlICsgdHlwZVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSBub3QgdG8gYmUgJyArIGFydGljbGUgKyB0eXBlXG4gICAgKTtcbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRDaGFpbmFibGVNZXRob2QoJ2FuJywgYW4pO1xuICBBc3NlcnRpb24uYWRkQ2hhaW5hYmxlTWV0aG9kKCdhJywgYW4pO1xuXG4gIC8qKlxuICAgKiAjIyMgLmluY2x1ZGUodmFsdWUpXG4gICAqXG4gICAqIFRoZSBgaW5jbHVkZWAgYW5kIGBjb250YWluYCBhc3NlcnRpb25zIGNhbiBiZSB1c2VkIGFzIGVpdGhlciBwcm9wZXJ0eVxuICAgKiBiYXNlZCBsYW5ndWFnZSBjaGFpbnMgb3IgYXMgbWV0aG9kcyB0byBhc3NlcnQgdGhlIGluY2x1c2lvbiBvZiBhbiBvYmplY3RcbiAgICogaW4gYW4gYXJyYXkgb3IgYSBzdWJzdHJpbmcgaW4gYSBzdHJpbmcuIFdoZW4gdXNlZCBhcyBsYW5ndWFnZSBjaGFpbnMsXG4gICAqIHRoZXkgdG9nZ2xlIHRoZSBgY29udGFpbmAgZmxhZyBmb3IgdGhlIGBrZXlzYCBhc3NlcnRpb24uXG4gICAqXG4gICAqICAgICBleHBlY3QoWzEsMiwzXSkudG8uaW5jbHVkZSgyKTtcbiAgICogICAgIGV4cGVjdCgnZm9vYmFyJykudG8uY29udGFpbignZm9vJyk7XG4gICAqICAgICBleHBlY3QoeyBmb286ICdiYXInLCBoZWxsbzogJ3VuaXZlcnNlJyB9KS50by5pbmNsdWRlLmtleXMoJ2ZvbycpO1xuICAgKlxuICAgKiBAbmFtZSBpbmNsdWRlXG4gICAqIEBhbGlhcyBjb250YWluXG4gICAqIEBwYXJhbSB7T2JqZWN0fFN0cmluZ3xOdW1iZXJ9IG9ialxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGluY2x1ZGVDaGFpbmluZ0JlaGF2aW9yICgpIHtcbiAgICBmbGFnKHRoaXMsICdjb250YWlucycsIHRydWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gaW5jbHVkZSAodmFsLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgdmFyIGV4cGVjdGVkID0gZmFsc2U7XG4gICAgaWYgKF8udHlwZShvYmopID09PSAnYXJyYXknICYmIF8udHlwZSh2YWwpID09PSAnb2JqZWN0Jykge1xuICAgICAgZm9yICh2YXIgaSBpbiBvYmopIHtcbiAgICAgICAgaWYgKF8uZXFsKG9ialtpXSwgdmFsKSkge1xuICAgICAgICAgIGV4cGVjdGVkID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoXy50eXBlKHZhbCkgPT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoIWZsYWcodGhpcywgJ25lZ2F0ZScpKSB7XG4gICAgICAgIGZvciAodmFyIGsgaW4gdmFsKSBuZXcgQXNzZXJ0aW9uKG9iaikucHJvcGVydHkoaywgdmFsW2tdKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdmFyIHN1YnNldCA9IHt9XG4gICAgICBmb3IgKHZhciBrIGluIHZhbCkgc3Vic2V0W2tdID0gb2JqW2tdXG4gICAgICBleHBlY3RlZCA9IF8uZXFsKHN1YnNldCwgdmFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwZWN0ZWQgPSBvYmogJiYgfm9iai5pbmRleE9mKHZhbClcbiAgICB9XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIGV4cGVjdGVkXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGluY2x1ZGUgJyArIF8uaW5zcGVjdCh2YWwpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBpbmNsdWRlICcgKyBfLmluc3BlY3QodmFsKSk7XG4gIH1cblxuICBBc3NlcnRpb24uYWRkQ2hhaW5hYmxlTWV0aG9kKCdpbmNsdWRlJywgaW5jbHVkZSwgaW5jbHVkZUNoYWluaW5nQmVoYXZpb3IpO1xuICBBc3NlcnRpb24uYWRkQ2hhaW5hYmxlTWV0aG9kKCdjb250YWluJywgaW5jbHVkZSwgaW5jbHVkZUNoYWluaW5nQmVoYXZpb3IpO1xuXG4gIC8qKlxuICAgKiAjIyMgLm9rXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIHRydXRoeS5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnZXZlcnRoaW5nJykudG8uYmUub2s7XG4gICAqICAgICBleHBlY3QoMSkudG8uYmUub2s7XG4gICAqICAgICBleHBlY3QoZmFsc2UpLnRvLm5vdC5iZS5vaztcbiAgICogICAgIGV4cGVjdCh1bmRlZmluZWQpLnRvLm5vdC5iZS5vaztcbiAgICogICAgIGV4cGVjdChudWxsKS50by5ub3QuYmUub2s7XG4gICAqXG4gICAqIEBuYW1lIG9rXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnb2snLCBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIHRydXRoeSdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgZmFsc3knKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAudHJ1ZVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBgdHJ1ZWAuXG4gICAqXG4gICAqICAgICBleHBlY3QodHJ1ZSkudG8uYmUudHJ1ZTtcbiAgICogICAgIGV4cGVjdCgxKS50by5ub3QuYmUudHJ1ZTtcbiAgICpcbiAgICogQG5hbWUgdHJ1ZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ3RydWUnLCBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIHRydWUgPT09IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIHRydWUnXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGZhbHNlJ1xuICAgICAgLCB0aGlzLm5lZ2F0ZSA/IGZhbHNlIDogdHJ1ZVxuICAgICk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLmZhbHNlXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGBmYWxzZWAuXG4gICAqXG4gICAqICAgICBleHBlY3QoZmFsc2UpLnRvLmJlLmZhbHNlO1xuICAgKiAgICAgZXhwZWN0KDApLnRvLm5vdC5iZS5mYWxzZTtcbiAgICpcbiAgICogQG5hbWUgZmFsc2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdmYWxzZScsIGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgZmFsc2UgPT09IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGZhbHNlJ1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSB0cnVlJ1xuICAgICAgLCB0aGlzLm5lZ2F0ZSA/IHRydWUgOiBmYWxzZVxuICAgICk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLm51bGxcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgYG51bGxgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KG51bGwpLnRvLmJlLm51bGw7XG4gICAqICAgICBleHBlY3QodW5kZWZpbmVkKS5ub3QudG8uYmUubnVsbDtcbiAgICpcbiAgICogQG5hbWUgbnVsbFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ251bGwnLCBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIG51bGwgPT09IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIG51bGwnXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IG5vdCB0byBiZSBudWxsJ1xuICAgICk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLnVuZGVmaW5lZFxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBgdW5kZWZpbmVkYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCh1bmRlZmluZWQpLnRvLmJlLnVuZGVmaW5lZDtcbiAgICogICAgIGV4cGVjdChudWxsKS50by5ub3QuYmUudW5kZWZpbmVkO1xuICAgKlxuICAgKiBAbmFtZSB1bmRlZmluZWRcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCd1bmRlZmluZWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIHVuZGVmaW5lZCA9PT0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgdW5kZWZpbmVkJ1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSBub3QgdG8gYmUgdW5kZWZpbmVkJ1xuICAgICk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLmV4aXN0XG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIG5laXRoZXIgYG51bGxgIG5vciBgdW5kZWZpbmVkYC5cbiAgICpcbiAgICogICAgIHZhciBmb28gPSAnaGknXG4gICAqICAgICAgICwgYmFyID0gbnVsbFxuICAgKiAgICAgICAsIGJhejtcbiAgICpcbiAgICogICAgIGV4cGVjdChmb28pLnRvLmV4aXN0O1xuICAgKiAgICAgZXhwZWN0KGJhcikudG8ubm90LmV4aXN0O1xuICAgKiAgICAgZXhwZWN0KGJheikudG8ubm90LmV4aXN0O1xuICAgKlxuICAgKiBAbmFtZSBleGlzdFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ2V4aXN0JywgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBudWxsICE9IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGV4aXN0J1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgZXhpc3QnXG4gICAgKTtcbiAgfSk7XG5cblxuICAvKipcbiAgICogIyMjIC5lbXB0eVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCdzIGxlbmd0aCBpcyBgMGAuIEZvciBhcnJheXMsIGl0IGNoZWNrc1xuICAgKiB0aGUgYGxlbmd0aGAgcHJvcGVydHkuIEZvciBvYmplY3RzLCBpdCBnZXRzIHRoZSBjb3VudCBvZlxuICAgKiBlbnVtZXJhYmxlIGtleXMuXG4gICAqXG4gICAqICAgICBleHBlY3QoW10pLnRvLmJlLmVtcHR5O1xuICAgKiAgICAgZXhwZWN0KCcnKS50by5iZS5lbXB0eTtcbiAgICogICAgIGV4cGVjdCh7fSkudG8uYmUuZW1wdHk7XG4gICAqXG4gICAqIEBuYW1lIGVtcHR5XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnZW1wdHknLCBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsIGV4cGVjdGVkID0gb2JqO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSB8fCAnc3RyaW5nJyA9PT0gdHlwZW9mIG9iamVjdCkge1xuICAgICAgZXhwZWN0ZWQgPSBvYmoubGVuZ3RoO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGV4cGVjdGVkID0gT2JqZWN0LmtleXMob2JqKS5sZW5ndGg7XG4gICAgfVxuXG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICFleHBlY3RlZFxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBlbXB0eSdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gbm90IHRvIGJlIGVtcHR5J1xuICAgICk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLmFyZ3VtZW50c1xuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBhbiBhcmd1bWVudHMgb2JqZWN0LlxuICAgKlxuICAgKiAgICAgZnVuY3Rpb24gdGVzdCAoKSB7XG4gICAqICAgICAgIGV4cGVjdChhcmd1bWVudHMpLnRvLmJlLmFyZ3VtZW50cztcbiAgICogICAgIH1cbiAgICpcbiAgICogQG5hbWUgYXJndW1lbnRzXG4gICAqIEBhbGlhcyBBcmd1bWVudHNcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gY2hlY2tBcmd1bWVudHMgKCkge1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCB0eXBlID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICdbb2JqZWN0IEFyZ3VtZW50c10nID09PSB0eXBlXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGFyZ3VtZW50cyBidXQgZ290ICcgKyB0eXBlXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBiZSBhcmd1bWVudHMnXG4gICAgKTtcbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnYXJndW1lbnRzJywgY2hlY2tBcmd1bWVudHMpO1xuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ0FyZ3VtZW50cycsIGNoZWNrQXJndW1lbnRzKTtcblxuICAvKipcbiAgICogIyMjIC5lcXVhbCh2YWx1ZSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgc3RyaWN0bHkgZXF1YWwgKGA9PT1gKSB0byBgdmFsdWVgLlxuICAgKiBBbHRlcm5hdGVseSwgaWYgdGhlIGBkZWVwYCBmbGFnIGlzIHNldCwgYXNzZXJ0cyB0aGF0XG4gICAqIHRoZSB0YXJnZXQgaXMgZGVlcGx5IGVxdWFsIHRvIGB2YWx1ZWAuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2hlbGxvJykudG8uZXF1YWwoJ2hlbGxvJyk7XG4gICAqICAgICBleHBlY3QoNDIpLnRvLmVxdWFsKDQyKTtcbiAgICogICAgIGV4cGVjdCgxKS50by5ub3QuZXF1YWwodHJ1ZSk7XG4gICAqICAgICBleHBlY3QoeyBmb286ICdiYXInIH0pLnRvLm5vdC5lcXVhbCh7IGZvbzogJ2JhcicgfSk7XG4gICAqICAgICBleHBlY3QoeyBmb286ICdiYXInIH0pLnRvLmRlZXAuZXF1YWwoeyBmb286ICdiYXInIH0pO1xuICAgKlxuICAgKiBAbmFtZSBlcXVhbFxuICAgKiBAYWxpYXMgZXF1YWxzXG4gICAqIEBhbGlhcyBlcVxuICAgKiBAYWxpYXMgZGVlcC5lcXVhbFxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydEVxdWFsICh2YWwsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICBpZiAoZmxhZyh0aGlzLCAnZGVlcCcpKSB7XG4gICAgICByZXR1cm4gdGhpcy5lcWwodmFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgdmFsID09PSBvYmpcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBlcXVhbCAje2V4cH0nXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGVxdWFsICN7ZXhwfSdcbiAgICAgICAgLCB2YWxcbiAgICAgICAgLCB0aGlzLl9vYmpcbiAgICAgICAgLCB0cnVlXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2VxdWFsJywgYXNzZXJ0RXF1YWwpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdlcXVhbHMnLCBhc3NlcnRFcXVhbCk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2VxJywgYXNzZXJ0RXF1YWwpO1xuXG4gIC8qKlxuICAgKiAjIyMgLmVxbCh2YWx1ZSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgZGVlcGx5IGVxdWFsIHRvIGB2YWx1ZWAuXG4gICAqXG4gICAqICAgICBleHBlY3QoeyBmb286ICdiYXInIH0pLnRvLmVxbCh7IGZvbzogJ2JhcicgfSk7XG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzIF0pLnRvLmVxbChbIDEsIDIsIDMgXSk7XG4gICAqXG4gICAqIEBuYW1lIGVxbFxuICAgKiBAYWxpYXMgZXFsc1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydEVxbChvYmosIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBfLmVxbChvYmosIGZsYWcodGhpcywgJ29iamVjdCcpKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBkZWVwbHkgZXF1YWwgI3tleHB9J1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgZGVlcGx5IGVxdWFsICN7ZXhwfSdcbiAgICAgICwgb2JqXG4gICAgICAsIHRoaXMuX29ialxuICAgICAgLCB0cnVlXG4gICAgKTtcbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2VxbCcsIGFzc2VydEVxbCk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2VxbHMnLCBhc3NlcnRFcWwpO1xuXG4gIC8qKlxuICAgKiAjIyMgLmFib3ZlKHZhbHVlKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBncmVhdGVyIHRoYW4gYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCgxMCkudG8uYmUuYWJvdmUoNSk7XG4gICAqXG4gICAqIENhbiBhbHNvIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBgbGVuZ3RoYCB0b1xuICAgKiBhc3NlcnQgYSBtaW5pbXVtIGxlbmd0aC4gVGhlIGJlbmVmaXQgYmVpbmcgYVxuICAgKiBtb3JlIGluZm9ybWF0aXZlIGVycm9yIG1lc3NhZ2UgdGhhbiBpZiB0aGUgbGVuZ3RoXG4gICAqIHdhcyBzdXBwbGllZCBkaXJlY3RseS5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnZm9vJykudG8uaGF2ZS5sZW5ndGguYWJvdmUoMik7XG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzIF0pLnRvLmhhdmUubGVuZ3RoLmFib3ZlKDIpO1xuICAgKlxuICAgKiBAbmFtZSBhYm92ZVxuICAgKiBAYWxpYXMgZ3RcbiAgICogQGFsaWFzIGdyZWF0ZXJUaGFuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydEFib3ZlIChuLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgaWYgKGZsYWcodGhpcywgJ2RvTGVuZ3RoJykpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLmhhdmUucHJvcGVydHkoJ2xlbmd0aCcpO1xuICAgICAgdmFyIGxlbiA9IG9iai5sZW5ndGg7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBsZW4gPiBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhIGxlbmd0aCBhYm92ZSAje2V4cH0gYnV0IGdvdCAje2FjdH0nXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGhhdmUgYSBsZW5ndGggYWJvdmUgI3tleHB9J1xuICAgICAgICAsIG5cbiAgICAgICAgLCBsZW5cbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIG9iaiA+IG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhYm92ZSAnICsgblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGF0IG1vc3QgJyArIG5cbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnYWJvdmUnLCBhc3NlcnRBYm92ZSk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2d0JywgYXNzZXJ0QWJvdmUpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdncmVhdGVyVGhhbicsIGFzc2VydEFib3ZlKTtcblxuICAvKipcbiAgICogIyMjIC5sZWFzdCh2YWx1ZSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIGB2YWx1ZWAuXG4gICAqXG4gICAqICAgICBleHBlY3QoMTApLnRvLmJlLmF0LmxlYXN0KDEwKTtcbiAgICpcbiAgICogQ2FuIGFsc28gYmUgdXNlZCBpbiBjb25qdW5jdGlvbiB3aXRoIGBsZW5ndGhgIHRvXG4gICAqIGFzc2VydCBhIG1pbmltdW0gbGVuZ3RoLiBUaGUgYmVuZWZpdCBiZWluZyBhXG4gICAqIG1vcmUgaW5mb3JtYXRpdmUgZXJyb3IgbWVzc2FnZSB0aGFuIGlmIHRoZSBsZW5ndGhcbiAgICogd2FzIHN1cHBsaWVkIGRpcmVjdGx5LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdmb28nKS50by5oYXZlLmxlbmd0aC5vZi5hdC5sZWFzdCgyKTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uaGF2ZS5sZW5ndGgub2YuYXQubGVhc3QoMyk7XG4gICAqXG4gICAqIEBuYW1lIGxlYXN0XG4gICAqIEBhbGlhcyBndGVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0TGVhc3QgKG4sIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICBpZiAoZmxhZyh0aGlzLCAnZG9MZW5ndGgnKSkge1xuICAgICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgICB2YXIgbGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIGxlbiA+PSBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhIGxlbmd0aCBhdCBsZWFzdCAje2V4cH0gYnV0IGdvdCAje2FjdH0nXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhIGxlbmd0aCBiZWxvdyAje2V4cH0nXG4gICAgICAgICwgblxuICAgICAgICAsIGxlblxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgb2JqID49IG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhdCBsZWFzdCAnICsgblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGJlbG93ICcgKyBuXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2xlYXN0JywgYXNzZXJ0TGVhc3QpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdndGUnLCBhc3NlcnRMZWFzdCk7XG5cbiAgLyoqXG4gICAqICMjIyAuYmVsb3codmFsdWUpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGxlc3MgdGhhbiBgdmFsdWVgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KDUpLnRvLmJlLmJlbG93KDEwKTtcbiAgICpcbiAgICogQ2FuIGFsc28gYmUgdXNlZCBpbiBjb25qdW5jdGlvbiB3aXRoIGBsZW5ndGhgIHRvXG4gICAqIGFzc2VydCBhIG1heGltdW0gbGVuZ3RoLiBUaGUgYmVuZWZpdCBiZWluZyBhXG4gICAqIG1vcmUgaW5mb3JtYXRpdmUgZXJyb3IgbWVzc2FnZSB0aGFuIGlmIHRoZSBsZW5ndGhcbiAgICogd2FzIHN1cHBsaWVkIGRpcmVjdGx5LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdmb28nKS50by5oYXZlLmxlbmd0aC5iZWxvdyg0KTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uaGF2ZS5sZW5ndGguYmVsb3coNCk7XG4gICAqXG4gICAqIEBuYW1lIGJlbG93XG4gICAqIEBhbGlhcyBsdFxuICAgKiBAYWxpYXMgbGVzc1RoYW5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0QmVsb3cgKG4sIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICBpZiAoZmxhZyh0aGlzLCAnZG9MZW5ndGgnKSkge1xuICAgICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgICB2YXIgbGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIGxlbiA8IG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIGJlbG93ICN7ZXhwfSBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaGF2ZSBhIGxlbmd0aCBiZWxvdyAje2V4cH0nXG4gICAgICAgICwgblxuICAgICAgICAsIGxlblxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgb2JqIDwgblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGJlbG93ICcgKyBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYXQgbGVhc3QgJyArIG5cbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnYmVsb3cnLCBhc3NlcnRCZWxvdyk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2x0JywgYXNzZXJ0QmVsb3cpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdsZXNzVGhhbicsIGFzc2VydEJlbG93KTtcblxuICAvKipcbiAgICogIyMjIC5tb3N0KHZhbHVlKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCg1KS50by5iZS5hdC5tb3N0KDUpO1xuICAgKlxuICAgKiBDYW4gYWxzbyBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggYGxlbmd0aGAgdG9cbiAgICogYXNzZXJ0IGEgbWF4aW11bSBsZW5ndGguIFRoZSBiZW5lZml0IGJlaW5nIGFcbiAgICogbW9yZSBpbmZvcm1hdGl2ZSBlcnJvciBtZXNzYWdlIHRoYW4gaWYgdGhlIGxlbmd0aFxuICAgKiB3YXMgc3VwcGxpZWQgZGlyZWN0bHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLm9mLmF0Lm1vc3QoNCk7XG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzIF0pLnRvLmhhdmUubGVuZ3RoLm9mLmF0Lm1vc3QoMyk7XG4gICAqXG4gICAqIEBuYW1lIG1vc3RcbiAgICogQGFsaWFzIGx0ZVxuICAgKiBAcGFyYW0ge051bWJlcn0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRNb3N0IChuLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgaWYgKGZsYWcodGhpcywgJ2RvTGVuZ3RoJykpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLmhhdmUucHJvcGVydHkoJ2xlbmd0aCcpO1xuICAgICAgdmFyIGxlbiA9IG9iai5sZW5ndGg7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBsZW4gPD0gblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSBsZW5ndGggYXQgbW9zdCAje2V4cH0gYnV0IGdvdCAje2FjdH0nXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhIGxlbmd0aCBhYm92ZSAje2V4cH0nXG4gICAgICAgICwgblxuICAgICAgICAsIGxlblxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgb2JqIDw9IG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhdCBtb3N0ICcgKyBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYWJvdmUgJyArIG5cbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnbW9zdCcsIGFzc2VydE1vc3QpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdsdGUnLCBhc3NlcnRNb3N0KTtcblxuICAvKipcbiAgICogIyMjIC53aXRoaW4oc3RhcnQsIGZpbmlzaClcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgd2l0aGluIGEgcmFuZ2UuXG4gICAqXG4gICAqICAgICBleHBlY3QoNykudG8uYmUud2l0aGluKDUsMTApO1xuICAgKlxuICAgKiBDYW4gYWxzbyBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggYGxlbmd0aGAgdG9cbiAgICogYXNzZXJ0IGEgbGVuZ3RoIHJhbmdlLiBUaGUgYmVuZWZpdCBiZWluZyBhXG4gICAqIG1vcmUgaW5mb3JtYXRpdmUgZXJyb3IgbWVzc2FnZSB0aGFuIGlmIHRoZSBsZW5ndGhcbiAgICogd2FzIHN1cHBsaWVkIGRpcmVjdGx5LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdmb28nKS50by5oYXZlLmxlbmd0aC53aXRoaW4oMiw0KTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uaGF2ZS5sZW5ndGgud2l0aGluKDIsNCk7XG4gICAqXG4gICAqIEBuYW1lIHdpdGhpblxuICAgKiBAcGFyYW0ge051bWJlcn0gc3RhcnQgbG93ZXJib3VuZCBpbmNsdXNpdmVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGZpbmlzaCB1cHBlcmJvdW5kIGluY2x1c2l2ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ3dpdGhpbicsIGZ1bmN0aW9uIChzdGFydCwgZmluaXNoLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgcmFuZ2UgPSBzdGFydCArICcuLicgKyBmaW5pc2g7XG4gICAgaWYgKGZsYWcodGhpcywgJ2RvTGVuZ3RoJykpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLmhhdmUucHJvcGVydHkoJ2xlbmd0aCcpO1xuICAgICAgdmFyIGxlbiA9IG9iai5sZW5ndGg7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBsZW4gPj0gc3RhcnQgJiYgbGVuIDw9IGZpbmlzaFxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSBsZW5ndGggd2l0aGluICcgKyByYW5nZVxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBoYXZlIGEgbGVuZ3RoIHdpdGhpbiAnICsgcmFuZ2VcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIG9iaiA+PSBzdGFydCAmJiBvYmogPD0gZmluaXNoXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgd2l0aGluICcgKyByYW5nZVxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBiZSB3aXRoaW4gJyArIHJhbmdlXG4gICAgICApO1xuICAgIH1cbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuaW5zdGFuY2VvZihjb25zdHJ1Y3RvcilcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgYW4gaW5zdGFuY2Ugb2YgYGNvbnN0cnVjdG9yYC5cbiAgICpcbiAgICogICAgIHZhciBUZWEgPSBmdW5jdGlvbiAobmFtZSkgeyB0aGlzLm5hbWUgPSBuYW1lOyB9XG4gICAqICAgICAgICwgQ2hhaSA9IG5ldyBUZWEoJ2NoYWknKTtcbiAgICpcbiAgICogICAgIGV4cGVjdChDaGFpKS50by5iZS5hbi5pbnN0YW5jZW9mKFRlYSk7XG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzIF0pLnRvLmJlLmluc3RhbmNlb2YoQXJyYXkpO1xuICAgKlxuICAgKiBAbmFtZSBpbnN0YW5jZW9mXG4gICAqIEBwYXJhbSB7Q29uc3RydWN0b3J9IGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFsaWFzIGluc3RhbmNlT2ZcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0SW5zdGFuY2VPZiAoY29uc3RydWN0b3IsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBuYW1lID0gXy5nZXROYW1lKGNvbnN0cnVjdG9yKTtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgZmxhZyh0aGlzLCAnb2JqZWN0JykgaW5zdGFuY2VvZiBjb25zdHJ1Y3RvclxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhbiBpbnN0YW5jZSBvZiAnICsgbmFtZVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgYmUgYW4gaW5zdGFuY2Ugb2YgJyArIG5hbWVcbiAgICApO1xuICB9O1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2luc3RhbmNlb2YnLCBhc3NlcnRJbnN0YW5jZU9mKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnaW5zdGFuY2VPZicsIGFzc2VydEluc3RhbmNlT2YpO1xuXG4gIC8qKlxuICAgKiAjIyMgLnByb3BlcnR5KG5hbWUsIFt2YWx1ZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGhhcyBhIHByb3BlcnR5IGBuYW1lYCwgb3B0aW9uYWxseSBhc3NlcnRpbmcgdGhhdFxuICAgKiB0aGUgdmFsdWUgb2YgdGhhdCBwcm9wZXJ0eSBpcyBzdHJpY3RseSBlcXVhbCB0byAgYHZhbHVlYC5cbiAgICogSWYgdGhlIGBkZWVwYCBmbGFnIGlzIHNldCwgeW91IGNhbiB1c2UgZG90LSBhbmQgYnJhY2tldC1ub3RhdGlvbiBmb3IgZGVlcFxuICAgKiByZWZlcmVuY2VzIGludG8gb2JqZWN0cyBhbmQgYXJyYXlzLlxuICAgKlxuICAgKiAgICAgLy8gc2ltcGxlIHJlZmVyZW5jaW5nXG4gICAqICAgICB2YXIgb2JqID0geyBmb286ICdiYXInIH07XG4gICAqICAgICBleHBlY3Qob2JqKS50by5oYXZlLnByb3BlcnR5KCdmb28nKTtcbiAgICogICAgIGV4cGVjdChvYmopLnRvLmhhdmUucHJvcGVydHkoJ2ZvbycsICdiYXInKTtcbiAgICpcbiAgICogICAgIC8vIGRlZXAgcmVmZXJlbmNpbmdcbiAgICogICAgIHZhciBkZWVwT2JqID0ge1xuICAgKiAgICAgICAgIGdyZWVuOiB7IHRlYTogJ21hdGNoYScgfVxuICAgKiAgICAgICAsIHRlYXM6IFsgJ2NoYWknLCAnbWF0Y2hhJywgeyB0ZWE6ICdrb25hY2hhJyB9IF1cbiAgICogICAgIH07XG5cbiAgICogICAgIGV4cGVjdChkZWVwT2JqKS50by5oYXZlLmRlZXAucHJvcGVydHkoJ2dyZWVuLnRlYScsICdtYXRjaGEnKTtcbiAgICogICAgIGV4cGVjdChkZWVwT2JqKS50by5oYXZlLmRlZXAucHJvcGVydHkoJ3RlYXNbMV0nLCAnbWF0Y2hhJyk7XG4gICAqICAgICBleHBlY3QoZGVlcE9iaikudG8uaGF2ZS5kZWVwLnByb3BlcnR5KCd0ZWFzWzJdLnRlYScsICdrb25hY2hhJyk7XG4gICAqXG4gICAqIFlvdSBjYW4gYWxzbyB1c2UgYW4gYXJyYXkgYXMgdGhlIHN0YXJ0aW5nIHBvaW50IG9mIGEgYGRlZXAucHJvcGVydHlgXG4gICAqIGFzc2VydGlvbiwgb3IgdHJhdmVyc2UgbmVzdGVkIGFycmF5cy5cbiAgICpcbiAgICogICAgIHZhciBhcnIgPSBbXG4gICAqICAgICAgICAgWyAnY2hhaScsICdtYXRjaGEnLCAna29uYWNoYScgXVxuICAgKiAgICAgICAsIFsgeyB0ZWE6ICdjaGFpJyB9XG4gICAqICAgICAgICAgLCB7IHRlYTogJ21hdGNoYScgfVxuICAgKiAgICAgICAgICwgeyB0ZWE6ICdrb25hY2hhJyB9IF1cbiAgICogICAgIF07XG4gICAqXG4gICAqICAgICBleHBlY3QoYXJyKS50by5oYXZlLmRlZXAucHJvcGVydHkoJ1swXVsxXScsICdtYXRjaGEnKTtcbiAgICogICAgIGV4cGVjdChhcnIpLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgnWzFdWzJdLnRlYScsICdrb25hY2hhJyk7XG4gICAqXG4gICAqIEZ1cnRoZXJtb3JlLCBgcHJvcGVydHlgIGNoYW5nZXMgdGhlIHN1YmplY3Qgb2YgdGhlIGFzc2VydGlvblxuICAgKiB0byBiZSB0aGUgdmFsdWUgb2YgdGhhdCBwcm9wZXJ0eSBmcm9tIHRoZSBvcmlnaW5hbCBvYmplY3QuIFRoaXNcbiAgICogcGVybWl0cyBmb3IgZnVydGhlciBjaGFpbmFibGUgYXNzZXJ0aW9ucyBvbiB0aGF0IHByb3BlcnR5LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KG9iaikudG8uaGF2ZS5wcm9wZXJ0eSgnZm9vJylcbiAgICogICAgICAgLnRoYXQuaXMuYSgnc3RyaW5nJyk7XG4gICAqICAgICBleHBlY3QoZGVlcE9iaikudG8uaGF2ZS5wcm9wZXJ0eSgnZ3JlZW4nKVxuICAgKiAgICAgICAudGhhdC5pcy5hbignb2JqZWN0JylcbiAgICogICAgICAgLnRoYXQuZGVlcC5lcXVhbHMoeyB0ZWE6ICdtYXRjaGEnIH0pO1xuICAgKiAgICAgZXhwZWN0KGRlZXBPYmopLnRvLmhhdmUucHJvcGVydHkoJ3RlYXMnKVxuICAgKiAgICAgICAudGhhdC5pcy5hbignYXJyYXknKVxuICAgKiAgICAgICAud2l0aC5kZWVwLnByb3BlcnR5KCdbMl0nKVxuICAgKiAgICAgICAgIC50aGF0LmRlZXAuZXF1YWxzKHsgdGVhOiAna29uYWNoYScgfSk7XG4gICAqXG4gICAqIEBuYW1lIHByb3BlcnR5XG4gICAqIEBhbGlhcyBkZWVwLnByb3BlcnR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIChvcHRpb25hbClcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAcmV0dXJucyB2YWx1ZSBvZiBwcm9wZXJ0eSBmb3IgY2hhaW5pbmdcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgncHJvcGVydHknLCBmdW5jdGlvbiAobmFtZSwgdmFsLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcblxuICAgIHZhciBkZXNjcmlwdG9yID0gZmxhZyh0aGlzLCAnZGVlcCcpID8gJ2RlZXAgcHJvcGVydHkgJyA6ICdwcm9wZXJ0eSAnXG4gICAgICAsIG5lZ2F0ZSA9IGZsYWcodGhpcywgJ25lZ2F0ZScpXG4gICAgICAsIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsIHZhbHVlID0gZmxhZyh0aGlzLCAnZGVlcCcpXG4gICAgICAgID8gXy5nZXRQYXRoVmFsdWUobmFtZSwgb2JqKVxuICAgICAgICA6IG9ialtuYW1lXTtcblxuICAgIGlmIChuZWdhdGUgJiYgdW5kZWZpbmVkICE9PSB2YWwpIHtcbiAgICAgIGlmICh1bmRlZmluZWQgPT09IHZhbHVlKSB7XG4gICAgICAgIG1zZyA9IChtc2cgIT0gbnVsbCkgPyBtc2cgKyAnOiAnIDogJyc7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtc2cgKyBfLmluc3BlY3Qob2JqKSArICcgaGFzIG5vICcgKyBkZXNjcmlwdG9yICsgXy5pbnNwZWN0KG5hbWUpKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgdW5kZWZpbmVkICE9PSB2YWx1ZVxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSAnICsgZGVzY3JpcHRvciArIF8uaW5zcGVjdChuYW1lKVxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBoYXZlICcgKyBkZXNjcmlwdG9yICsgXy5pbnNwZWN0KG5hbWUpKTtcbiAgICB9XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB2YWwpIHtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIHZhbCA9PT0gdmFsdWVcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgJyArIGRlc2NyaXB0b3IgKyBfLmluc3BlY3QobmFtZSkgKyAnIG9mICN7ZXhwfSwgYnV0IGdvdCAje2FjdH0nXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGhhdmUgYSAnICsgZGVzY3JpcHRvciArIF8uaW5zcGVjdChuYW1lKSArICcgb2YgI3thY3R9J1xuICAgICAgICAsIHZhbFxuICAgICAgICAsIHZhbHVlXG4gICAgICApO1xuICAgIH1cblxuICAgIGZsYWcodGhpcywgJ29iamVjdCcsIHZhbHVlKTtcbiAgfSk7XG5cblxuICAvKipcbiAgICogIyMjIC5vd25Qcm9wZXJ0eShuYW1lKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBoYXMgYW4gb3duIHByb3BlcnR5IGBuYW1lYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCgndGVzdCcpLnRvLmhhdmUub3duUHJvcGVydHkoJ2xlbmd0aCcpO1xuICAgKlxuICAgKiBAbmFtZSBvd25Qcm9wZXJ0eVxuICAgKiBAYWxpYXMgaGF2ZU93blByb3BlcnR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0T3duUHJvcGVydHkgKG5hbWUsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgb2JqLmhhc093blByb3BlcnR5KG5hbWUpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgb3duIHByb3BlcnR5ICcgKyBfLmluc3BlY3QobmFtZSlcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGhhdmUgb3duIHByb3BlcnR5ICcgKyBfLmluc3BlY3QobmFtZSlcbiAgICApO1xuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnb3duUHJvcGVydHknLCBhc3NlcnRPd25Qcm9wZXJ0eSk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2hhdmVPd25Qcm9wZXJ0eScsIGFzc2VydE93blByb3BlcnR5KTtcblxuICAvKipcbiAgICogIyMjIC5sZW5ndGgodmFsdWUpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0J3MgYGxlbmd0aGAgcHJvcGVydHkgaGFzXG4gICAqIHRoZSBleHBlY3RlZCB2YWx1ZS5cbiAgICpcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDNdKS50by5oYXZlLmxlbmd0aCgzKTtcbiAgICogICAgIGV4cGVjdCgnZm9vYmFyJykudG8uaGF2ZS5sZW5ndGgoNik7XG4gICAqXG4gICAqIENhbiBhbHNvIGJlIHVzZWQgYXMgYSBjaGFpbiBwcmVjdXJzb3IgdG8gYSB2YWx1ZVxuICAgKiBjb21wYXJpc29uIGZvciB0aGUgbGVuZ3RoIHByb3BlcnR5LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdmb28nKS50by5oYXZlLmxlbmd0aC5hYm92ZSgyKTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uaGF2ZS5sZW5ndGguYWJvdmUoMik7XG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLmJlbG93KDQpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC5iZWxvdyg0KTtcbiAgICogICAgIGV4cGVjdCgnZm9vJykudG8uaGF2ZS5sZW5ndGgud2l0aGluKDIsNCk7XG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzIF0pLnRvLmhhdmUubGVuZ3RoLndpdGhpbigyLDQpO1xuICAgKlxuICAgKiBAbmFtZSBsZW5ndGhcbiAgICogQGFsaWFzIGxlbmd0aE9mXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBsZW5ndGhcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRMZW5ndGhDaGFpbiAoKSB7XG4gICAgZmxhZyh0aGlzLCAnZG9MZW5ndGgnLCB0cnVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFzc2VydExlbmd0aCAobiwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLmhhdmUucHJvcGVydHkoJ2xlbmd0aCcpO1xuICAgIHZhciBsZW4gPSBvYmoubGVuZ3RoO1xuXG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIGxlbiA9PSBuXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSBsZW5ndGggb2YgI3tleHB9IGJ1dCBnb3QgI3thY3R9J1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaGF2ZSBhIGxlbmd0aCBvZiAje2FjdH0nXG4gICAgICAsIG5cbiAgICAgICwgbGVuXG4gICAgKTtcbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRDaGFpbmFibGVNZXRob2QoJ2xlbmd0aCcsIGFzc2VydExlbmd0aCwgYXNzZXJ0TGVuZ3RoQ2hhaW4pO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdsZW5ndGhPZicsIGFzc2VydExlbmd0aCwgYXNzZXJ0TGVuZ3RoQ2hhaW4pO1xuXG4gIC8qKlxuICAgKiAjIyMgLm1hdGNoKHJlZ2V4cClcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgbWF0Y2hlcyBhIHJlZ3VsYXIgZXhwcmVzc2lvbi5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnZm9vYmFyJykudG8ubWF0Y2goL15mb28vKTtcbiAgICpcbiAgICogQG5hbWUgbWF0Y2hcbiAgICogQHBhcmFtIHtSZWdFeHB9IFJlZ3VsYXJFeHByZXNzaW9uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnbWF0Y2gnLCBmdW5jdGlvbiAocmUsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgcmUuZXhlYyhvYmopXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG1hdGNoICcgKyByZVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSBub3QgdG8gbWF0Y2ggJyArIHJlXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuc3RyaW5nKHN0cmluZylcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSBzdHJpbmcgdGFyZ2V0IGNvbnRhaW5zIGFub3RoZXIgc3RyaW5nLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdmb29iYXInKS50by5oYXZlLnN0cmluZygnYmFyJyk7XG4gICAqXG4gICAqIEBuYW1lIHN0cmluZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnc3RyaW5nJywgZnVuY3Rpb24gKHN0ciwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLmlzLmEoJ3N0cmluZycpO1xuXG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIH5vYmouaW5kZXhPZihzdHIpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGNvbnRhaW4gJyArIF8uaW5zcGVjdChzdHIpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBjb250YWluICcgKyBfLmluc3BlY3Qoc3RyKVxuICAgICk7XG4gIH0pO1xuXG5cbiAgLyoqXG4gICAqICMjIyAua2V5cyhrZXkxLCBba2V5Ml0sIFsuLi5dKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBoYXMgZXhhY3RseSB0aGUgZ2l2ZW4ga2V5cywgb3JcbiAgICogYXNzZXJ0cyB0aGUgaW5jbHVzaW9uIG9mIHNvbWUga2V5cyB3aGVuIHVzaW5nIHRoZVxuICAgKiBgaW5jbHVkZWAgb3IgYGNvbnRhaW5gIG1vZGlmaWVycy5cbiAgICpcbiAgICogICAgIGV4cGVjdCh7IGZvbzogMSwgYmFyOiAyIH0pLnRvLmhhdmUua2V5cyhbJ2ZvbycsICdiYXInXSk7XG4gICAqICAgICBleHBlY3QoeyBmb286IDEsIGJhcjogMiwgYmF6OiAzIH0pLnRvLmNvbnRhaW4ua2V5cygnZm9vJywgJ2JhcicpO1xuICAgKlxuICAgKiBAbmFtZSBrZXlzXG4gICAqIEBhbGlhcyBrZXlcbiAgICogQHBhcmFtIHtTdHJpbmcuLi58QXJyYXl9IGtleXNcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0S2V5cyAoa2V5cykge1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCBzdHJcbiAgICAgICwgb2sgPSB0cnVlO1xuXG4gICAga2V5cyA9IGtleXMgaW5zdGFuY2VvZiBBcnJheVxuICAgICAgPyBrZXlzXG4gICAgICA6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICBpZiAoIWtleXMubGVuZ3RoKSB0aHJvdyBuZXcgRXJyb3IoJ2tleXMgcmVxdWlyZWQnKTtcblxuICAgIHZhciBhY3R1YWwgPSBPYmplY3Qua2V5cyhvYmopXG4gICAgICAsIGxlbiA9IGtleXMubGVuZ3RoO1xuXG4gICAgLy8gSW5jbHVzaW9uXG4gICAgb2sgPSBrZXlzLmV2ZXJ5KGZ1bmN0aW9uKGtleSl7XG4gICAgICByZXR1cm4gfmFjdHVhbC5pbmRleE9mKGtleSk7XG4gICAgfSk7XG5cbiAgICAvLyBTdHJpY3RcbiAgICBpZiAoIWZsYWcodGhpcywgJ25lZ2F0ZScpICYmICFmbGFnKHRoaXMsICdjb250YWlucycpKSB7XG4gICAgICBvayA9IG9rICYmIGtleXMubGVuZ3RoID09IGFjdHVhbC5sZW5ndGg7XG4gICAgfVxuXG4gICAgLy8gS2V5IHN0cmluZ1xuICAgIGlmIChsZW4gPiAxKSB7XG4gICAgICBrZXlzID0ga2V5cy5tYXAoZnVuY3Rpb24oa2V5KXtcbiAgICAgICAgcmV0dXJuIF8uaW5zcGVjdChrZXkpO1xuICAgICAgfSk7XG4gICAgICB2YXIgbGFzdCA9IGtleXMucG9wKCk7XG4gICAgICBzdHIgPSBrZXlzLmpvaW4oJywgJykgKyAnLCBhbmQgJyArIGxhc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IF8uaW5zcGVjdChrZXlzWzBdKTtcbiAgICB9XG5cbiAgICAvLyBGb3JtXG4gICAgc3RyID0gKGxlbiA+IDEgPyAna2V5cyAnIDogJ2tleSAnKSArIHN0cjtcblxuICAgIC8vIEhhdmUgLyBpbmNsdWRlXG4gICAgc3RyID0gKGZsYWcodGhpcywgJ2NvbnRhaW5zJykgPyAnY29udGFpbiAnIDogJ2hhdmUgJykgKyBzdHI7XG5cbiAgICAvLyBBc3NlcnRpb25cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgb2tcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gJyArIHN0clxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgJyArIHN0clxuICAgICk7XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdrZXlzJywgYXNzZXJ0S2V5cyk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2tleScsIGFzc2VydEtleXMpO1xuXG4gIC8qKlxuICAgKiAjIyMgLnRocm93KGNvbnN0cnVjdG9yKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIGZ1bmN0aW9uIHRhcmdldCB3aWxsIHRocm93IGEgc3BlY2lmaWMgZXJyb3IsIG9yIHNwZWNpZmljIHR5cGUgb2YgZXJyb3JcbiAgICogKGFzIGRldGVybWluZWQgdXNpbmcgYGluc3RhbmNlb2ZgKSwgb3B0aW9uYWxseSB3aXRoIGEgUmVnRXhwIG9yIHN0cmluZyBpbmNsdXNpb24gdGVzdFxuICAgKiBmb3IgdGhlIGVycm9yJ3MgbWVzc2FnZS5cbiAgICpcbiAgICogICAgIHZhciBlcnIgPSBuZXcgUmVmZXJlbmNlRXJyb3IoJ1RoaXMgaXMgYSBiYWQgZnVuY3Rpb24uJyk7XG4gICAqICAgICB2YXIgZm4gPSBmdW5jdGlvbiAoKSB7IHRocm93IGVycjsgfVxuICAgKiAgICAgZXhwZWN0KGZuKS50by50aHJvdyhSZWZlcmVuY2VFcnJvcik7XG4gICAqICAgICBleHBlY3QoZm4pLnRvLnRocm93KEVycm9yKTtcbiAgICogICAgIGV4cGVjdChmbikudG8udGhyb3coL2JhZCBmdW5jdGlvbi8pO1xuICAgKiAgICAgZXhwZWN0KGZuKS50by5ub3QudGhyb3coJ2dvb2QgZnVuY3Rpb24nKTtcbiAgICogICAgIGV4cGVjdChmbikudG8udGhyb3coUmVmZXJlbmNlRXJyb3IsIC9iYWQgZnVuY3Rpb24vKTtcbiAgICogICAgIGV4cGVjdChmbikudG8udGhyb3coZXJyKTtcbiAgICogICAgIGV4cGVjdChmbikudG8ubm90LnRocm93KG5ldyBSYW5nZUVycm9yKCdPdXQgb2YgcmFuZ2UuJykpO1xuICAgKlxuICAgKiBQbGVhc2Ugbm90ZSB0aGF0IHdoZW4gYSB0aHJvdyBleHBlY3RhdGlvbiBpcyBuZWdhdGVkLCBpdCB3aWxsIGNoZWNrIGVhY2hcbiAgICogcGFyYW1ldGVyIGluZGVwZW5kZW50bHksIHN0YXJ0aW5nIHdpdGggZXJyb3IgY29uc3RydWN0b3IgdHlwZS4gVGhlIGFwcHJvcHJpYXRlIHdheVxuICAgKiB0byBjaGVjayBmb3IgdGhlIGV4aXN0ZW5jZSBvZiBhIHR5cGUgb2YgZXJyb3IgYnV0IGZvciBhIG1lc3NhZ2UgdGhhdCBkb2VzIG5vdCBtYXRjaFxuICAgKiBpcyB0byB1c2UgYGFuZGAuXG4gICAqXG4gICAqICAgICBleHBlY3QoZm4pLnRvLnRocm93KFJlZmVyZW5jZUVycm9yKVxuICAgKiAgICAgICAgLmFuZC5ub3QudGhyb3coL2dvb2QgZnVuY3Rpb24vKTtcbiAgICpcbiAgICogQG5hbWUgdGhyb3dcbiAgICogQGFsaWFzIHRocm93c1xuICAgKiBAYWxpYXMgVGhyb3dcbiAgICogQHBhcmFtIHtFcnJvckNvbnN0cnVjdG9yfSBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1N0cmluZ3xSZWdFeHB9IGV4cGVjdGVkIGVycm9yIG1lc3NhZ2VcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0Vycm9yI0Vycm9yX3R5cGVzXG4gICAqIEByZXR1cm5zIGVycm9yIGZvciBjaGFpbmluZyAobnVsbCBpZiBubyBlcnJvcilcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0VGhyb3dzIChjb25zdHJ1Y3RvciwgZXJyTXNnLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykuaXMuYSgnZnVuY3Rpb24nKTtcblxuICAgIHZhciB0aHJvd24gPSBmYWxzZVxuICAgICAgLCBkZXNpcmVkRXJyb3IgPSBudWxsXG4gICAgICAsIG5hbWUgPSBudWxsXG4gICAgICAsIHRocm93bkVycm9yID0gbnVsbDtcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBlcnJNc2cgPSBudWxsO1xuICAgICAgY29uc3RydWN0b3IgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAoY29uc3RydWN0b3IgJiYgKGNvbnN0cnVjdG9yIGluc3RhbmNlb2YgUmVnRXhwIHx8ICdzdHJpbmcnID09PSB0eXBlb2YgY29uc3RydWN0b3IpKSB7XG4gICAgICBlcnJNc2cgPSBjb25zdHJ1Y3RvcjtcbiAgICAgIGNvbnN0cnVjdG9yID0gbnVsbDtcbiAgICB9IGVsc2UgaWYgKGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIGRlc2lyZWRFcnJvciA9IGNvbnN0cnVjdG9yO1xuICAgICAgY29uc3RydWN0b3IgPSBudWxsO1xuICAgICAgZXJyTXNnID0gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25zdHJ1Y3RvciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgbmFtZSA9IGNvbnN0cnVjdG9yLnByb3RvdHlwZS5uYW1lIHx8IGNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBpZiAobmFtZSA9PT0gJ0Vycm9yJyAmJiBjb25zdHJ1Y3RvciAhPT0gRXJyb3IpIHtcbiAgICAgICAgbmFtZSA9IChuZXcgY29uc3RydWN0b3IoKSkubmFtZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3RydWN0b3IgPSBudWxsO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBvYmooKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIC8vIGZpcnN0LCBjaGVjayBkZXNpcmVkIGVycm9yXG4gICAgICBpZiAoZGVzaXJlZEVycm9yKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgICAgZXJyID09PSBkZXNpcmVkRXJyb3JcbiAgICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHRocm93ICN7ZXhwfSBidXQgI3thY3R9IHdhcyB0aHJvd24nXG4gICAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgdGhyb3cgI3tleHB9J1xuICAgICAgICAgICwgKGRlc2lyZWRFcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZGVzaXJlZEVycm9yLnRvU3RyaW5nKCkgOiBkZXNpcmVkRXJyb3IpXG4gICAgICAgICAgLCAoZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIudG9TdHJpbmcoKSA6IGVycilcbiAgICAgICAgKTtcblxuICAgICAgICBmbGFnKHRoaXMsICdvYmplY3QnLCBlcnIpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cblxuICAgICAgLy8gbmV4dCwgY2hlY2sgY29uc3RydWN0b3JcbiAgICAgIGlmIChjb25zdHJ1Y3Rvcikge1xuICAgICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICAgIGVyciBpbnN0YW5jZW9mIGNvbnN0cnVjdG9yXG4gICAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byB0aHJvdyAje2V4cH0gYnV0ICN7YWN0fSB3YXMgdGhyb3duJ1xuICAgICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IHRocm93ICN7ZXhwfSBidXQgI3thY3R9IHdhcyB0aHJvd24nXG4gICAgICAgICAgLCBuYW1lXG4gICAgICAgICAgLCAoZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIudG9TdHJpbmcoKSA6IGVycilcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoIWVyck1zZykge1xuICAgICAgICAgIGZsYWcodGhpcywgJ29iamVjdCcsIGVycik7XG4gICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gbmV4dCwgY2hlY2sgbWVzc2FnZVxuICAgICAgdmFyIG1lc3NhZ2UgPSAnb2JqZWN0JyA9PT0gXy50eXBlKGVycikgJiYgXCJtZXNzYWdlXCIgaW4gZXJyXG4gICAgICAgID8gZXJyLm1lc3NhZ2VcbiAgICAgICAgOiAnJyArIGVycjtcblxuICAgICAgaWYgKChtZXNzYWdlICE9IG51bGwpICYmIGVyck1zZyAmJiBlcnJNc2cgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgICBlcnJNc2cuZXhlYyhtZXNzYWdlKVxuICAgICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gdGhyb3cgZXJyb3IgbWF0Y2hpbmcgI3tleHB9IGJ1dCBnb3QgI3thY3R9J1xuICAgICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gdGhyb3cgZXJyb3Igbm90IG1hdGNoaW5nICN7ZXhwfSdcbiAgICAgICAgICAsIGVyck1zZ1xuICAgICAgICAgICwgbWVzc2FnZVxuICAgICAgICApO1xuXG4gICAgICAgIGZsYWcodGhpcywgJ29iamVjdCcsIGVycik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSBlbHNlIGlmICgobWVzc2FnZSAhPSBudWxsKSAmJiBlcnJNc2cgJiYgJ3N0cmluZycgPT09IHR5cGVvZiBlcnJNc2cpIHtcbiAgICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgICB+bWVzc2FnZS5pbmRleE9mKGVyck1zZylcbiAgICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHRocm93IGVycm9yIGluY2x1ZGluZyAje2V4cH0gYnV0IGdvdCAje2FjdH0nXG4gICAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byB0aHJvdyBlcnJvciBub3QgaW5jbHVkaW5nICN7YWN0fSdcbiAgICAgICAgICAsIGVyck1zZ1xuICAgICAgICAgICwgbWVzc2FnZVxuICAgICAgICApO1xuXG4gICAgICAgIGZsYWcodGhpcywgJ29iamVjdCcsIGVycik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3duID0gdHJ1ZTtcbiAgICAgICAgdGhyb3duRXJyb3IgPSBlcnI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGFjdHVhbGx5R290ID0gJydcbiAgICAgICwgZXhwZWN0ZWRUaHJvd24gPSBuYW1lICE9PSBudWxsXG4gICAgICAgID8gbmFtZVxuICAgICAgICA6IGRlc2lyZWRFcnJvclxuICAgICAgICAgID8gJyN7ZXhwfScgLy9fLmluc3BlY3QoZGVzaXJlZEVycm9yKVxuICAgICAgICAgIDogJ2FuIGVycm9yJztcblxuICAgIGlmICh0aHJvd24pIHtcbiAgICAgIGFjdHVhbGx5R290ID0gJyBidXQgI3thY3R9IHdhcyB0aHJvd24nXG4gICAgfVxuXG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIHRocm93biA9PT0gdHJ1ZVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byB0aHJvdyAnICsgZXhwZWN0ZWRUaHJvd24gKyBhY3R1YWxseUdvdFxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgdGhyb3cgJyArIGV4cGVjdGVkVGhyb3duICsgYWN0dWFsbHlHb3RcbiAgICAgICwgKGRlc2lyZWRFcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZGVzaXJlZEVycm9yLnRvU3RyaW5nKCkgOiBkZXNpcmVkRXJyb3IpXG4gICAgICAsICh0aHJvd25FcnJvciBpbnN0YW5jZW9mIEVycm9yID8gdGhyb3duRXJyb3IudG9TdHJpbmcoKSA6IHRocm93bkVycm9yKVxuICAgICk7XG5cbiAgICBmbGFnKHRoaXMsICdvYmplY3QnLCB0aHJvd25FcnJvcik7XG4gIH07XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgndGhyb3cnLCBhc3NlcnRUaHJvd3MpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCd0aHJvd3MnLCBhc3NlcnRUaHJvd3MpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdUaHJvdycsIGFzc2VydFRocm93cyk7XG5cbiAgLyoqXG4gICAqICMjIyAucmVzcG9uZFRvKG1ldGhvZClcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSBvYmplY3Qgb3IgY2xhc3MgdGFyZ2V0IHdpbGwgcmVzcG9uZCB0byBhIG1ldGhvZC5cbiAgICpcbiAgICogICAgIEtsYXNzLnByb3RvdHlwZS5iYXIgPSBmdW5jdGlvbigpe307XG4gICAqICAgICBleHBlY3QoS2xhc3MpLnRvLnJlc3BvbmRUbygnYmFyJyk7XG4gICAqICAgICBleHBlY3Qob2JqKS50by5yZXNwb25kVG8oJ2JhcicpO1xuICAgKlxuICAgKiBUbyBjaGVjayBpZiBhIGNvbnN0cnVjdG9yIHdpbGwgcmVzcG9uZCB0byBhIHN0YXRpYyBmdW5jdGlvbixcbiAgICogc2V0IHRoZSBgaXRzZWxmYCBmbGFnLlxuICAgKlxuICAgKiAgICAgS2xhc3MuYmF6ID0gZnVuY3Rpb24oKXt9O1xuICAgKiAgICAgZXhwZWN0KEtsYXNzKS5pdHNlbGYudG8ucmVzcG9uZFRvKCdiYXonKTtcbiAgICpcbiAgICogQG5hbWUgcmVzcG9uZFRvXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2RcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdyZXNwb25kVG8nLCBmdW5jdGlvbiAobWV0aG9kLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgaXRzZWxmID0gZmxhZyh0aGlzLCAnaXRzZWxmJylcbiAgICAgICwgY29udGV4dCA9ICgnZnVuY3Rpb24nID09PSBfLnR5cGUob2JqKSAmJiAhaXRzZWxmKVxuICAgICAgICA/IG9iai5wcm90b3R5cGVbbWV0aG9kXVxuICAgICAgICA6IG9ialttZXRob2RdO1xuXG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250ZXh0XG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHJlc3BvbmQgdG8gJyArIF8uaW5zcGVjdChtZXRob2QpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCByZXNwb25kIHRvICcgKyBfLmluc3BlY3QobWV0aG9kKVxuICAgICk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLml0c2VsZlxuICAgKlxuICAgKiBTZXRzIHRoZSBgaXRzZWxmYCBmbGFnLCBsYXRlciB1c2VkIGJ5IHRoZSBgcmVzcG9uZFRvYCBhc3NlcnRpb24uXG4gICAqXG4gICAqICAgICBmdW5jdGlvbiBGb28oKSB7fVxuICAgKiAgICAgRm9vLmJhciA9IGZ1bmN0aW9uKCkge31cbiAgICogICAgIEZvby5wcm90b3R5cGUuYmF6ID0gZnVuY3Rpb24oKSB7fVxuICAgKlxuICAgKiAgICAgZXhwZWN0KEZvbykuaXRzZWxmLnRvLnJlc3BvbmRUbygnYmFyJyk7XG4gICAqICAgICBleHBlY3QoRm9vKS5pdHNlbGYubm90LnRvLnJlc3BvbmRUbygnYmF6Jyk7XG4gICAqXG4gICAqIEBuYW1lIGl0c2VsZlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ2l0c2VsZicsIGZ1bmN0aW9uICgpIHtcbiAgICBmbGFnKHRoaXMsICdpdHNlbGYnLCB0cnVlKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuc2F0aXNmeShtZXRob2QpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IHBhc3NlcyBhIGdpdmVuIHRydXRoIHRlc3QuXG4gICAqXG4gICAqICAgICBleHBlY3QoMSkudG8uc2F0aXNmeShmdW5jdGlvbihudW0pIHsgcmV0dXJuIG51bSA+IDA7IH0pO1xuICAgKlxuICAgKiBAbmFtZSBzYXRpc2Z5XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG1hdGNoZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdzYXRpc2Z5JywgZnVuY3Rpb24gKG1hdGNoZXIsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgbWF0Y2hlcihvYmopXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHNhdGlzZnkgJyArIF8ub2JqRGlzcGxheShtYXRjaGVyKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3Qgc2F0aXNmeScgKyBfLm9iakRpc3BsYXkobWF0Y2hlcilcbiAgICAgICwgdGhpcy5uZWdhdGUgPyBmYWxzZSA6IHRydWVcbiAgICAgICwgbWF0Y2hlcihvYmopXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuY2xvc2VUbyhleHBlY3RlZCwgZGVsdGEpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGVxdWFsIGBleHBlY3RlZGAsIHRvIHdpdGhpbiBhICsvLSBgZGVsdGFgIHJhbmdlLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KDEuNSkudG8uYmUuY2xvc2VUbygxLCAwLjUpO1xuICAgKlxuICAgKiBAbmFtZSBjbG9zZVRvXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge051bWJlcn0gZGVsdGFcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdjbG9zZVRvJywgZnVuY3Rpb24gKGV4cGVjdGVkLCBkZWx0YSwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBNYXRoLmFicyhvYmogLSBleHBlY3RlZCkgPD0gZGVsdGFcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgY2xvc2UgdG8gJyArIGV4cGVjdGVkICsgJyArLy0gJyArIGRlbHRhXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IG5vdCB0byBiZSBjbG9zZSB0byAnICsgZXhwZWN0ZWQgKyAnICsvLSAnICsgZGVsdGFcbiAgICApO1xuICB9KTtcblxuICBmdW5jdGlvbiBpc1N1YnNldE9mKHN1YnNldCwgc3VwZXJzZXQsIGNtcCkge1xuICAgIHJldHVybiBzdWJzZXQuZXZlcnkoZnVuY3Rpb24oZWxlbSkge1xuICAgICAgaWYgKCFjbXApIHJldHVybiBzdXBlcnNldC5pbmRleE9mKGVsZW0pICE9PSAtMTtcblxuICAgICAgcmV0dXJuIHN1cGVyc2V0LnNvbWUoZnVuY3Rpb24oZWxlbTIpIHtcbiAgICAgICAgcmV0dXJuIGNtcChlbGVtLCBlbGVtMik7XG4gICAgICB9KTtcbiAgICB9KVxuICB9XG5cbiAgLyoqXG4gICAqICMjIyAubWVtYmVycyhzZXQpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGEgc3VwZXJzZXQgb2YgYHNldGAsXG4gICAqIG9yIHRoYXQgdGhlIHRhcmdldCBhbmQgYHNldGAgaGF2ZSB0aGUgc2FtZSBzdHJpY3RseS1lcXVhbCAoPT09KSBtZW1iZXJzLlxuICAgKiBBbHRlcm5hdGVseSwgaWYgdGhlIGBkZWVwYCBmbGFnIGlzIHNldCwgc2V0IG1lbWJlcnMgYXJlIGNvbXBhcmVkIGZvciBkZWVwXG4gICAqIGVxdWFsaXR5LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KFsxLCAyLCAzXSkudG8uaW5jbHVkZS5tZW1iZXJzKFszLCAyXSk7XG4gICAqICAgICBleHBlY3QoWzEsIDIsIDNdKS50by5ub3QuaW5jbHVkZS5tZW1iZXJzKFszLCAyLCA4XSk7XG4gICAqXG4gICAqICAgICBleHBlY3QoWzQsIDJdKS50by5oYXZlLm1lbWJlcnMoWzIsIDRdKTtcbiAgICogICAgIGV4cGVjdChbNSwgMl0pLnRvLm5vdC5oYXZlLm1lbWJlcnMoWzUsIDIsIDFdKTtcbiAgICpcbiAgICogICAgIGV4cGVjdChbeyBpZDogMSB9XSkudG8uZGVlcC5pbmNsdWRlLm1lbWJlcnMoW3sgaWQ6IDEgfV0pO1xuICAgKlxuICAgKiBAbmFtZSBtZW1iZXJzXG4gICAqIEBwYXJhbSB7QXJyYXl9IHNldFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ21lbWJlcnMnLCBmdW5jdGlvbiAoc3Vic2V0LCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG5cbiAgICBuZXcgQXNzZXJ0aW9uKG9iaikudG8uYmUuYW4oJ2FycmF5Jyk7XG4gICAgbmV3IEFzc2VydGlvbihzdWJzZXQpLnRvLmJlLmFuKCdhcnJheScpO1xuXG4gICAgdmFyIGNtcCA9IGZsYWcodGhpcywgJ2RlZXAnKSA/IF8uZXFsIDogdW5kZWZpbmVkO1xuXG4gICAgaWYgKGZsYWcodGhpcywgJ2NvbnRhaW5zJykpIHtcbiAgICAgIHJldHVybiB0aGlzLmFzc2VydChcbiAgICAgICAgICBpc1N1YnNldE9mKHN1YnNldCwgb2JqLCBjbXApXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYSBzdXBlcnNldCBvZiAje2FjdH0nXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGJlIGEgc3VwZXJzZXQgb2YgI3thY3R9J1xuICAgICAgICAsIG9ialxuICAgICAgICAsIHN1YnNldFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgaXNTdWJzZXRPZihvYmosIHN1YnNldCwgY21wKSAmJiBpc1N1YnNldE9mKHN1YnNldCwgb2JqLCBjbXApXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSB0aGUgc2FtZSBtZW1iZXJzIGFzICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaGF2ZSB0aGUgc2FtZSBtZW1iZXJzIGFzICN7YWN0fSdcbiAgICAgICAgLCBvYmpcbiAgICAgICAgLCBzdWJzZXRcbiAgICApO1xuICB9KTtcbn07XG4iLCIvKiFcbiAqIGNoYWlcbiAqIENvcHlyaWdodChjKSAyMDExLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNoYWksIHV0aWwpIHtcblxuICAvKiFcbiAgICogQ2hhaSBkZXBlbmRlbmNpZXMuXG4gICAqL1xuXG4gIHZhciBBc3NlcnRpb24gPSBjaGFpLkFzc2VydGlvblxuICAgICwgZmxhZyA9IHV0aWwuZmxhZztcblxuICAvKiFcbiAgICogTW9kdWxlIGV4cG9ydC5cbiAgICovXG5cbiAgLyoqXG4gICAqICMjIyBhc3NlcnQoZXhwcmVzc2lvbiwgbWVzc2FnZSlcbiAgICpcbiAgICogV3JpdGUgeW91ciBvd24gdGVzdCBleHByZXNzaW9ucy5cbiAgICpcbiAgICogICAgIGFzc2VydCgnZm9vJyAhPT0gJ2JhcicsICdmb28gaXMgbm90IGJhcicpO1xuICAgKiAgICAgYXNzZXJ0KEFycmF5LmlzQXJyYXkoW10pLCAnZW1wdHkgYXJyYXlzIGFyZSBhcnJheXMnKTtcbiAgICpcbiAgICogQHBhcmFtIHtNaXhlZH0gZXhwcmVzc2lvbiB0byB0ZXN0IGZvciB0cnV0aGluZXNzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIHRvIGRpc3BsYXkgb24gZXJyb3JcbiAgICogQG5hbWUgYXNzZXJ0XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIHZhciBhc3NlcnQgPSBjaGFpLmFzc2VydCA9IGZ1bmN0aW9uIChleHByZXNzLCBlcnJtc2cpIHtcbiAgICB2YXIgdGVzdCA9IG5ldyBBc3NlcnRpb24obnVsbCwgbnVsbCwgY2hhaS5hc3NlcnQpO1xuICAgIHRlc3QuYXNzZXJ0KFxuICAgICAgICBleHByZXNzXG4gICAgICAsIGVycm1zZ1xuICAgICAgLCAnWyBuZWdhdGlvbiBtZXNzYWdlIHVuYXZhaWxhYmxlIF0nXG4gICAgKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5mYWlsKGFjdHVhbCwgZXhwZWN0ZWQsIFttZXNzYWdlXSwgW29wZXJhdG9yXSlcbiAgICpcbiAgICogVGhyb3cgYSBmYWlsdXJlLiBOb2RlLmpzIGBhc3NlcnRgIG1vZHVsZS1jb21wYXRpYmxlLlxuICAgKlxuICAgKiBAbmFtZSBmYWlsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3BlcmF0b3JcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmZhaWwgPSBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgb3BlcmF0b3IpIHtcbiAgICBtZXNzYWdlID0gbWVzc2FnZSB8fCAnYXNzZXJ0LmZhaWwoKSc7XG4gICAgdGhyb3cgbmV3IGNoYWkuQXNzZXJ0aW9uRXJyb3IobWVzc2FnZSwge1xuICAgICAgICBhY3R1YWw6IGFjdHVhbFxuICAgICAgLCBleHBlY3RlZDogZXhwZWN0ZWRcbiAgICAgICwgb3BlcmF0b3I6IG9wZXJhdG9yXG4gICAgfSwgYXNzZXJ0LmZhaWwpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm9rKG9iamVjdCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaXMgdHJ1dGh5LlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm9rKCdldmVyeXRoaW5nJywgJ2V2ZXJ5dGhpbmcgaXMgb2snKTtcbiAgICogICAgIGFzc2VydC5vayhmYWxzZSwgJ3RoaXMgd2lsbCBmYWlsJyk7XG4gICAqXG4gICAqIEBuYW1lIG9rXG4gICAqIEBwYXJhbSB7TWl4ZWR9IG9iamVjdCB0byB0ZXN0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5vayA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLmlzLm9rO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdE9rKG9iamVjdCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaXMgZmFsc3kuXG4gICAqXG4gICAqICAgICBhc3NlcnQubm90T2soJ2V2ZXJ5dGhpbmcnLCAndGhpcyB3aWxsIGZhaWwnKTtcbiAgICogICAgIGFzc2VydC5ub3RPayhmYWxzZSwgJ3RoaXMgd2lsbCBwYXNzJyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdE9rXG4gICAqIEBwYXJhbSB7TWl4ZWR9IG9iamVjdCB0byB0ZXN0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3RPayA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLmlzLm5vdC5vaztcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5lcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgbm9uLXN0cmljdCBlcXVhbGl0eSAoYD09YCkgb2YgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQuZXF1YWwoMywgJzMnLCAnPT0gY29lcmNlcyB2YWx1ZXMgdG8gc3RyaW5ncycpO1xuICAgKlxuICAgKiBAbmFtZSBlcXVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBhY3R1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmVxdWFsID0gZnVuY3Rpb24gKGFjdCwgZXhwLCBtc2cpIHtcbiAgICB2YXIgdGVzdCA9IG5ldyBBc3NlcnRpb24oYWN0LCBtc2csIGFzc2VydC5lcXVhbCk7XG5cbiAgICB0ZXN0LmFzc2VydChcbiAgICAgICAgZXhwID09IGZsYWcodGVzdCwgJ29iamVjdCcpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGVxdWFsICN7ZXhwfSdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGVxdWFsICN7YWN0fSdcbiAgICAgICwgZXhwXG4gICAgICAsIGFjdFxuICAgICk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIG5vbi1zdHJpY3QgaW5lcXVhbGl0eSAoYCE9YCkgb2YgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQubm90RXF1YWwoMywgNCwgJ3RoZXNlIG51bWJlcnMgYXJlIG5vdCBlcXVhbCcpO1xuICAgKlxuICAgKiBAbmFtZSBub3RFcXVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBhY3R1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdEVxdWFsID0gZnVuY3Rpb24gKGFjdCwgZXhwLCBtc2cpIHtcbiAgICB2YXIgdGVzdCA9IG5ldyBBc3NlcnRpb24oYWN0LCBtc2csIGFzc2VydC5ub3RFcXVhbCk7XG5cbiAgICB0ZXN0LmFzc2VydChcbiAgICAgICAgZXhwICE9IGZsYWcodGVzdCwgJ29iamVjdCcpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBlcXVhbCAje2V4cH0nXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGVxdWFsICN7YWN0fSdcbiAgICAgICwgZXhwXG4gICAgICAsIGFjdFxuICAgICk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHN0cmljdCBlcXVhbGl0eSAoYD09PWApIG9mIGBhY3R1YWxgIGFuZCBgZXhwZWN0ZWRgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHRydWUsIHRydWUsICd0aGVzZSBib29sZWFucyBhcmUgc3RyaWN0bHkgZXF1YWwnKTtcbiAgICpcbiAgICogQG5hbWUgc3RyaWN0RXF1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gYWN0dWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5zdHJpY3RFcXVhbCA9IGZ1bmN0aW9uIChhY3QsIGV4cCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihhY3QsIG1zZykudG8uZXF1YWwoZXhwKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3RTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgc3RyaWN0IGluZXF1YWxpdHkgKGAhPT1gKSBvZiBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3RTdHJpY3RFcXVhbCgzLCAnMycsICdubyBjb2VyY2lvbiBmb3Igc3RyaWN0IGVxdWFsaXR5Jyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdFN0cmljdEVxdWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90U3RyaWN0RXF1YWwgPSBmdW5jdGlvbiAoYWN0LCBleHAsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oYWN0LCBtc2cpLnRvLm5vdC5lcXVhbChleHApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmRlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgYWN0dWFsYCBpcyBkZWVwbHkgZXF1YWwgdG8gYGV4cGVjdGVkYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5kZWVwRXF1YWwoeyB0ZWE6ICdncmVlbicgfSwgeyB0ZWE6ICdncmVlbicgfSk7XG4gICAqXG4gICAqIEBuYW1lIGRlZXBFcXVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBhY3R1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmRlZXBFcXVhbCA9IGZ1bmN0aW9uIChhY3QsIGV4cCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihhY3QsIG1zZykudG8uZXFsKGV4cCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90RGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0IHRoYXQgYGFjdHVhbGAgaXMgbm90IGRlZXBseSBlcXVhbCB0byBgZXhwZWN0ZWRgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm5vdERlZXBFcXVhbCh7IHRlYTogJ2dyZWVuJyB9LCB7IHRlYTogJ2phc21pbmUnIH0pO1xuICAgKlxuICAgKiBAbmFtZSBub3REZWVwRXF1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gYWN0dWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3REZWVwRXF1YWwgPSBmdW5jdGlvbiAoYWN0LCBleHAsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oYWN0LCBtc2cpLnRvLm5vdC5lcWwoZXhwKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc1RydWUodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgdHJ1ZS5cbiAgICpcbiAgICogICAgIHZhciB0ZWFTZXJ2ZWQgPSB0cnVlO1xuICAgKiAgICAgYXNzZXJ0LmlzVHJ1ZSh0ZWFTZXJ2ZWQsICd0aGUgdGVhIGhhcyBiZWVuIHNlcnZlZCcpO1xuICAgKlxuICAgKiBAbmFtZSBpc1RydWVcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzVHJ1ZSA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLmlzWyd0cnVlJ107XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNGYWxzZSh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBmYWxzZS5cbiAgICpcbiAgICogICAgIHZhciB0ZWFTZXJ2ZWQgPSBmYWxzZTtcbiAgICogICAgIGFzc2VydC5pc0ZhbHNlKHRlYVNlcnZlZCwgJ25vIHRlYSB5ZXQ/IGhtbS4uLicpO1xuICAgKlxuICAgKiBAbmFtZSBpc0ZhbHNlXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc0ZhbHNlID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykuaXNbJ2ZhbHNlJ107XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOdWxsKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIG51bGwuXG4gICAqXG4gICAqICAgICBhc3NlcnQuaXNOdWxsKGVyciwgJ3RoZXJlIHdhcyBubyBlcnJvcicpO1xuICAgKlxuICAgKiBAbmFtZSBpc051bGxcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTnVsbCA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmVxdWFsKG51bGwpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTm90TnVsbCh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBub3QgbnVsbC5cbiAgICpcbiAgICogICAgIHZhciB0ZWEgPSAndGFzdHkgY2hhaSc7XG4gICAqICAgICBhc3NlcnQuaXNOb3ROdWxsKHRlYSwgJ2dyZWF0LCB0aW1lIGZvciB0ZWEhJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzTm90TnVsbFxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNOb3ROdWxsID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmVxdWFsKG51bGwpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzVW5kZWZpbmVkKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGB1bmRlZmluZWRgLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYTtcbiAgICogICAgIGFzc2VydC5pc1VuZGVmaW5lZCh0ZWEsICdubyB0ZWEgZGVmaW5lZCcpO1xuICAgKlxuICAgKiBAbmFtZSBpc1VuZGVmaW5lZFxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNVbmRlZmluZWQgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5lcXVhbCh1bmRlZmluZWQpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzRGVmaW5lZCh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBub3QgYHVuZGVmaW5lZGAuXG4gICAqXG4gICAqICAgICB2YXIgdGVhID0gJ2N1cCBvZiBjaGFpJztcbiAgICogICAgIGFzc2VydC5pc0RlZmluZWQodGVhLCAndGVhIGhhcyBiZWVuIGRlZmluZWQnKTtcbiAgICpcbiAgICogQG5hbWUgaXNEZWZpbmVkXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc0RlZmluZWQgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuZXF1YWwodW5kZWZpbmVkKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc0Z1bmN0aW9uKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGEgZnVuY3Rpb24uXG4gICAqXG4gICAqICAgICBmdW5jdGlvbiBzZXJ2ZVRlYSgpIHsgcmV0dXJuICdjdXAgb2YgdGVhJzsgfTtcbiAgICogICAgIGFzc2VydC5pc0Z1bmN0aW9uKHNlcnZlVGVhLCAnZ3JlYXQsIHdlIGNhbiBoYXZlIHRlYSBub3cnKTtcbiAgICpcbiAgICogQG5hbWUgaXNGdW5jdGlvblxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNGdW5jdGlvbiA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmJlLmEoJ2Z1bmN0aW9uJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOb3RGdW5jdGlvbih2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBfbm90XyBhIGZ1bmN0aW9uLlxuICAgKlxuICAgKiAgICAgdmFyIHNlcnZlVGVhID0gWyAnaGVhdCcsICdwb3VyJywgJ3NpcCcgXTtcbiAgICogICAgIGFzc2VydC5pc05vdEZ1bmN0aW9uKHNlcnZlVGVhLCAnZ3JlYXQsIHdlIGhhdmUgbGlzdGVkIHRoZSBzdGVwcycpO1xuICAgKlxuICAgKiBAbmFtZSBpc05vdEZ1bmN0aW9uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc05vdEZ1bmN0aW9uID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmEoJ2Z1bmN0aW9uJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNPYmplY3QodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYW4gb2JqZWN0IChhcyByZXZlYWxlZCBieVxuICAgKiBgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ2ApLlxuICAgKlxuICAgKiAgICAgdmFyIHNlbGVjdGlvbiA9IHsgbmFtZTogJ0NoYWknLCBzZXJ2ZTogJ3dpdGggc3BpY2VzJyB9O1xuICAgKiAgICAgYXNzZXJ0LmlzT2JqZWN0KHNlbGVjdGlvbiwgJ3RlYSBzZWxlY3Rpb24gaXMgYW4gb2JqZWN0Jyk7XG4gICAqXG4gICAqIEBuYW1lIGlzT2JqZWN0XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc09iamVjdCA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmJlLmEoJ29iamVjdCcpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTm90T2JqZWN0KHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIF9ub3RfIGFuIG9iamVjdC5cbiAgICpcbiAgICogICAgIHZhciBzZWxlY3Rpb24gPSAnY2hhaSdcbiAgICogICAgIGFzc2VydC5pc05vdE9iamVjdChzZWxlY3Rpb24sICd0ZWEgc2VsZWN0aW9uIGlzIG5vdCBhbiBvYmplY3QnKTtcbiAgICogICAgIGFzc2VydC5pc05vdE9iamVjdChudWxsLCAnbnVsbCBpcyBub3QgYW4gb2JqZWN0Jyk7XG4gICAqXG4gICAqIEBuYW1lIGlzTm90T2JqZWN0XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc05vdE9iamVjdCA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5iZS5hKCdvYmplY3QnKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc0FycmF5KHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGFuIGFycmF5LlxuICAgKlxuICAgKiAgICAgdmFyIG1lbnUgPSBbICdncmVlbicsICdjaGFpJywgJ29vbG9uZycgXTtcbiAgICogICAgIGFzc2VydC5pc0FycmF5KG1lbnUsICd3aGF0IGtpbmQgb2YgdGVhIGRvIHdlIHdhbnQ/Jyk7XG4gICAqXG4gICAqIEBuYW1lIGlzQXJyYXlcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzQXJyYXkgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5iZS5hbignYXJyYXknKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc05vdEFycmF5KHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIF9ub3RfIGFuIGFycmF5LlxuICAgKlxuICAgKiAgICAgdmFyIG1lbnUgPSAnZ3JlZW58Y2hhaXxvb2xvbmcnO1xuICAgKiAgICAgYXNzZXJ0LmlzTm90QXJyYXkobWVudSwgJ3doYXQga2luZCBvZiB0ZWEgZG8gd2Ugd2FudD8nKTtcbiAgICpcbiAgICogQG5hbWUgaXNOb3RBcnJheVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNOb3RBcnJheSA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5iZS5hbignYXJyYXknKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc1N0cmluZyh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBhIHN0cmluZy5cbiAgICpcbiAgICogICAgIHZhciB0ZWFPcmRlciA9ICdjaGFpJztcbiAgICogICAgIGFzc2VydC5pc1N0cmluZyh0ZWFPcmRlciwgJ29yZGVyIHBsYWNlZCcpO1xuICAgKlxuICAgKiBAbmFtZSBpc1N0cmluZ1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNTdHJpbmcgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5iZS5hKCdzdHJpbmcnKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc05vdFN0cmluZyh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBfbm90XyBhIHN0cmluZy5cbiAgICpcbiAgICogICAgIHZhciB0ZWFPcmRlciA9IDQ7XG4gICAqICAgICBhc3NlcnQuaXNOb3RTdHJpbmcodGVhT3JkZXIsICdvcmRlciBwbGFjZWQnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOb3RTdHJpbmdcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTm90U3RyaW5nID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmEoJ3N0cmluZycpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTnVtYmVyKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGEgbnVtYmVyLlxuICAgKlxuICAgKiAgICAgdmFyIGN1cHMgPSAyO1xuICAgKiAgICAgYXNzZXJ0LmlzTnVtYmVyKGN1cHMsICdob3cgbWFueSBjdXBzJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzTnVtYmVyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNOdW1iZXIgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5iZS5hKCdudW1iZXInKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc05vdE51bWJlcih2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBfbm90XyBhIG51bWJlci5cbiAgICpcbiAgICogICAgIHZhciBjdXBzID0gJzIgY3VwcyBwbGVhc2UnO1xuICAgKiAgICAgYXNzZXJ0LmlzTm90TnVtYmVyKGN1cHMsICdob3cgbWFueSBjdXBzJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzTm90TnVtYmVyXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc05vdE51bWJlciA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5iZS5hKCdudW1iZXInKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc0Jvb2xlYW4odmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYSBib29sZWFuLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYVJlYWR5ID0gdHJ1ZVxuICAgKiAgICAgICAsIHRlYVNlcnZlZCA9IGZhbHNlO1xuICAgKlxuICAgKiAgICAgYXNzZXJ0LmlzQm9vbGVhbih0ZWFSZWFkeSwgJ2lzIHRoZSB0ZWEgcmVhZHknKTtcbiAgICogICAgIGFzc2VydC5pc0Jvb2xlYW4odGVhU2VydmVkLCAnaGFzIHRlYSBiZWVuIHNlcnZlZCcpO1xuICAgKlxuICAgKiBAbmFtZSBpc0Jvb2xlYW5cbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzQm9vbGVhbiA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmJlLmEoJ2Jvb2xlYW4nKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc05vdEJvb2xlYW4odmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgX25vdF8gYSBib29sZWFuLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYVJlYWR5ID0gJ3llcCdcbiAgICogICAgICAgLCB0ZWFTZXJ2ZWQgPSAnbm9wZSc7XG4gICAqXG4gICAqICAgICBhc3NlcnQuaXNOb3RCb29sZWFuKHRlYVJlYWR5LCAnaXMgdGhlIHRlYSByZWFkeScpO1xuICAgKiAgICAgYXNzZXJ0LmlzTm90Qm9vbGVhbih0ZWFTZXJ2ZWQsICdoYXMgdGVhIGJlZW4gc2VydmVkJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzTm90Qm9vbGVhblxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNOb3RCb29sZWFuID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmEoJ2Jvb2xlYW4nKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC50eXBlT2YodmFsdWUsIG5hbWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAncyB0eXBlIGlzIGBuYW1lYCwgYXMgZGV0ZXJtaW5lZCBieVxuICAgKiBgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ2AuXG4gICAqXG4gICAqICAgICBhc3NlcnQudHlwZU9mKHsgdGVhOiAnY2hhaScgfSwgJ29iamVjdCcsICd3ZSBoYXZlIGFuIG9iamVjdCcpO1xuICAgKiAgICAgYXNzZXJ0LnR5cGVPZihbJ2NoYWknLCAnamFzbWluZSddLCAnYXJyYXknLCAnd2UgaGF2ZSBhbiBhcnJheScpO1xuICAgKiAgICAgYXNzZXJ0LnR5cGVPZigndGVhJywgJ3N0cmluZycsICd3ZSBoYXZlIGEgc3RyaW5nJyk7XG4gICAqICAgICBhc3NlcnQudHlwZU9mKC90ZWEvLCAncmVnZXhwJywgJ3dlIGhhdmUgYSByZWd1bGFyIGV4cHJlc3Npb24nKTtcbiAgICogICAgIGFzc2VydC50eXBlT2YobnVsbCwgJ251bGwnLCAnd2UgaGF2ZSBhIG51bGwnKTtcbiAgICogICAgIGFzc2VydC50eXBlT2YodW5kZWZpbmVkLCAndW5kZWZpbmVkJywgJ3dlIGhhdmUgYW4gdW5kZWZpbmVkJyk7XG4gICAqXG4gICAqIEBuYW1lIHR5cGVPZlxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQudHlwZU9mID0gZnVuY3Rpb24gKHZhbCwgdHlwZSwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uYmUuYSh0eXBlKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3RUeXBlT2YodmFsdWUsIG5hbWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAncyB0eXBlIGlzIF9ub3RfIGBuYW1lYCwgYXMgZGV0ZXJtaW5lZCBieVxuICAgKiBgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ2AuXG4gICAqXG4gICAqICAgICBhc3NlcnQubm90VHlwZU9mKCd0ZWEnLCAnbnVtYmVyJywgJ3N0cmluZ3MgYXJlIG5vdCBudW1iZXJzJyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdFR5cGVPZlxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gdHlwZW9mIG5hbWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdFR5cGVPZiA9IGZ1bmN0aW9uICh2YWwsIHR5cGUsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5iZS5hKHR5cGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmluc3RhbmNlT2Yob2JqZWN0LCBjb25zdHJ1Y3RvciwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBhbiBpbnN0YW5jZSBvZiBgY29uc3RydWN0b3JgLlxuICAgKlxuICAgKiAgICAgdmFyIFRlYSA9IGZ1bmN0aW9uIChuYW1lKSB7IHRoaXMubmFtZSA9IG5hbWU7IH1cbiAgICogICAgICAgLCBjaGFpID0gbmV3IFRlYSgnY2hhaScpO1xuICAgKlxuICAgKiAgICAgYXNzZXJ0Lmluc3RhbmNlT2YoY2hhaSwgVGVhLCAnY2hhaSBpcyBhbiBpbnN0YW5jZSBvZiB0ZWEnKTtcbiAgICpcbiAgICogQG5hbWUgaW5zdGFuY2VPZlxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7Q29uc3RydWN0b3J9IGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pbnN0YW5jZU9mID0gZnVuY3Rpb24gKHZhbCwgdHlwZSwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uYmUuaW5zdGFuY2VPZih0eXBlKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3RJbnN0YW5jZU9mKG9iamVjdCwgY29uc3RydWN0b3IsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyBgdmFsdWVgIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBgY29uc3RydWN0b3JgLlxuICAgKlxuICAgKiAgICAgdmFyIFRlYSA9IGZ1bmN0aW9uIChuYW1lKSB7IHRoaXMubmFtZSA9IG5hbWU7IH1cbiAgICogICAgICAgLCBjaGFpID0gbmV3IFN0cmluZygnY2hhaScpO1xuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm5vdEluc3RhbmNlT2YoY2hhaSwgVGVhLCAnY2hhaSBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgdGVhJyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdEluc3RhbmNlT2ZcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge0NvbnN0cnVjdG9yfSBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90SW5zdGFuY2VPZiA9IGZ1bmN0aW9uICh2YWwsIHR5cGUsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5iZS5pbnN0YW5jZU9mKHR5cGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmluY2x1ZGUoaGF5c3RhY2ssIG5lZWRsZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYGhheXN0YWNrYCBpbmNsdWRlcyBgbmVlZGxlYC4gV29ya3NcbiAgICogZm9yIHN0cmluZ3MgYW5kIGFycmF5cy5cbiAgICpcbiAgICogICAgIGFzc2VydC5pbmNsdWRlKCdmb29iYXInLCAnYmFyJywgJ2Zvb2JhciBjb250YWlucyBzdHJpbmcgXCJiYXJcIicpO1xuICAgKiAgICAgYXNzZXJ0LmluY2x1ZGUoWyAxLCAyLCAzIF0sIDMsICdhcnJheSBjb250YWlucyB2YWx1ZScpO1xuICAgKlxuICAgKiBAbmFtZSBpbmNsdWRlXG4gICAqIEBwYXJhbSB7QXJyYXl8U3RyaW5nfSBoYXlzdGFja1xuICAgKiBAcGFyYW0ge01peGVkfSBuZWVkbGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmluY2x1ZGUgPSBmdW5jdGlvbiAoZXhwLCBpbmMsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oZXhwLCBtc2csIGFzc2VydC5pbmNsdWRlKS5pbmNsdWRlKGluYyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90SW5jbHVkZShoYXlzdGFjaywgbmVlZGxlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgaGF5c3RhY2tgIGRvZXMgbm90IGluY2x1ZGUgYG5lZWRsZWAuIFdvcmtzXG4gICAqIGZvciBzdHJpbmdzIGFuZCBhcnJheXMuXG4gICAqaVxuICAgKiAgICAgYXNzZXJ0Lm5vdEluY2x1ZGUoJ2Zvb2JhcicsICdiYXonLCAnc3RyaW5nIG5vdCBpbmNsdWRlIHN1YnN0cmluZycpO1xuICAgKiAgICAgYXNzZXJ0Lm5vdEluY2x1ZGUoWyAxLCAyLCAzIF0sIDQsICdhcnJheSBub3QgaW5jbHVkZSBjb250YWluIHZhbHVlJyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdEluY2x1ZGVcbiAgICogQHBhcmFtIHtBcnJheXxTdHJpbmd9IGhheXN0YWNrXG4gICAqIEBwYXJhbSB7TWl4ZWR9IG5lZWRsZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90SW5jbHVkZSA9IGZ1bmN0aW9uIChleHAsIGluYywgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihleHAsIG1zZywgYXNzZXJ0Lm5vdEluY2x1ZGUpLm5vdC5pbmNsdWRlKGluYyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubWF0Y2godmFsdWUsIHJlZ2V4cCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBtYXRjaGVzIHRoZSByZWd1bGFyIGV4cHJlc3Npb24gYHJlZ2V4cGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQubWF0Y2goJ2Zvb2JhcicsIC9eZm9vLywgJ3JlZ2V4cCBtYXRjaGVzJyk7XG4gICAqXG4gICAqIEBuYW1lIG1hdGNoXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7UmVnRXhwfSByZWdleHBcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm1hdGNoID0gZnVuY3Rpb24gKGV4cCwgcmUsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oZXhwLCBtc2cpLnRvLm1hdGNoKHJlKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3RNYXRjaCh2YWx1ZSwgcmVnZXhwLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGRvZXMgbm90IG1hdGNoIHRoZSByZWd1bGFyIGV4cHJlc3Npb24gYHJlZ2V4cGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQubm90TWF0Y2goJ2Zvb2JhcicsIC9eZm9vLywgJ3JlZ2V4cCBkb2VzIG5vdCBtYXRjaCcpO1xuICAgKlxuICAgKiBAbmFtZSBub3RNYXRjaFxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXhwXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3RNYXRjaCA9IGZ1bmN0aW9uIChleHAsIHJlLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGV4cCwgbXNnKS50by5ub3QubWF0Y2gocmUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLnByb3BlcnR5KG9iamVjdCwgcHJvcGVydHksIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGhhcyBhIHByb3BlcnR5IG5hbWVkIGJ5IGBwcm9wZXJ0eWAuXG4gICAqXG4gICAqICAgICBhc3NlcnQucHJvcGVydHkoeyB0ZWE6IHsgZ3JlZW46ICdtYXRjaGEnIH19LCAndGVhJyk7XG4gICAqXG4gICAqIEBuYW1lIHByb3BlcnR5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5wcm9wZXJ0eSA9IGZ1bmN0aW9uIChvYmosIHByb3AsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLmhhdmUucHJvcGVydHkocHJvcCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90UHJvcGVydHkob2JqZWN0LCBwcm9wZXJ0eSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgZG9lcyBfbm90XyBoYXZlIGEgcHJvcGVydHkgbmFtZWQgYnkgYHByb3BlcnR5YC5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3RQcm9wZXJ0eSh7IHRlYTogeyBncmVlbjogJ21hdGNoYScgfX0sICdjb2ZmZWUnKTtcbiAgICpcbiAgICogQG5hbWUgbm90UHJvcGVydHlcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdFByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgcHJvcCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8ubm90LmhhdmUucHJvcGVydHkocHJvcCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuZGVlcFByb3BlcnR5KG9iamVjdCwgcHJvcGVydHksIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGhhcyBhIHByb3BlcnR5IG5hbWVkIGJ5IGBwcm9wZXJ0eWAsIHdoaWNoIGNhbiBiZSBhXG4gICAqIHN0cmluZyB1c2luZyBkb3QtIGFuZCBicmFja2V0LW5vdGF0aW9uIGZvciBkZWVwIHJlZmVyZW5jZS5cbiAgICpcbiAgICogICAgIGFzc2VydC5kZWVwUHJvcGVydHkoeyB0ZWE6IHsgZ3JlZW46ICdtYXRjaGEnIH19LCAndGVhLmdyZWVuJyk7XG4gICAqXG4gICAqIEBuYW1lIGRlZXBQcm9wZXJ0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuZGVlcFByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgcHJvcCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5kZWVwLnByb3BlcnR5KHByb3ApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdERlZXBQcm9wZXJ0eShvYmplY3QsIHByb3BlcnR5LCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBkb2VzIF9ub3RfIGhhdmUgYSBwcm9wZXJ0eSBuYW1lZCBieSBgcHJvcGVydHlgLCB3aGljaFxuICAgKiBjYW4gYmUgYSBzdHJpbmcgdXNpbmcgZG90LSBhbmQgYnJhY2tldC1ub3RhdGlvbiBmb3IgZGVlcCByZWZlcmVuY2UuXG4gICAqXG4gICAqICAgICBhc3NlcnQubm90RGVlcFByb3BlcnR5KHsgdGVhOiB7IGdyZWVuOiAnbWF0Y2hhJyB9fSwgJ3RlYS5vb2xvbmcnKTtcbiAgICpcbiAgICogQG5hbWUgbm90RGVlcFByb3BlcnR5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3REZWVwUHJvcGVydHkgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5ub3QuaGF2ZS5kZWVwLnByb3BlcnR5KHByb3ApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLnByb3BlcnR5VmFsKG9iamVjdCwgcHJvcGVydHksIHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBoYXMgYSBwcm9wZXJ0eSBuYW1lZCBieSBgcHJvcGVydHlgIHdpdGggdmFsdWUgZ2l2ZW5cbiAgICogYnkgYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5wcm9wZXJ0eVZhbCh7IHRlYTogJ2lzIGdvb2QnIH0sICd0ZWEnLCAnaXMgZ29vZCcpO1xuICAgKlxuICAgKiBAbmFtZSBwcm9wZXJ0eVZhbFxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQucHJvcGVydHlWYWwgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCB2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLmhhdmUucHJvcGVydHkocHJvcCwgdmFsKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5wcm9wZXJ0eU5vdFZhbChvYmplY3QsIHByb3BlcnR5LCB2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaGFzIGEgcHJvcGVydHkgbmFtZWQgYnkgYHByb3BlcnR5YCwgYnV0IHdpdGggYSB2YWx1ZVxuICAgKiBkaWZmZXJlbnQgZnJvbSB0aGF0IGdpdmVuIGJ5IGB2YWx1ZWAuXG4gICAqXG4gICAqICAgICBhc3NlcnQucHJvcGVydHlOb3RWYWwoeyB0ZWE6ICdpcyBnb29kJyB9LCAndGVhJywgJ2lzIGJhZCcpO1xuICAgKlxuICAgKiBAbmFtZSBwcm9wZXJ0eU5vdFZhbFxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQucHJvcGVydHlOb3RWYWwgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCB2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLm5vdC5oYXZlLnByb3BlcnR5KHByb3AsIHZhbCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuZGVlcFByb3BlcnR5VmFsKG9iamVjdCwgcHJvcGVydHksIHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBoYXMgYSBwcm9wZXJ0eSBuYW1lZCBieSBgcHJvcGVydHlgIHdpdGggdmFsdWUgZ2l2ZW5cbiAgICogYnkgYHZhbHVlYC4gYHByb3BlcnR5YCBjYW4gdXNlIGRvdC0gYW5kIGJyYWNrZXQtbm90YXRpb24gZm9yIGRlZXBcbiAgICogcmVmZXJlbmNlLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmRlZXBQcm9wZXJ0eVZhbCh7IHRlYTogeyBncmVlbjogJ21hdGNoYScgfX0sICd0ZWEuZ3JlZW4nLCAnbWF0Y2hhJyk7XG4gICAqXG4gICAqIEBuYW1lIGRlZXBQcm9wZXJ0eVZhbFxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuZGVlcFByb3BlcnR5VmFsID0gZnVuY3Rpb24gKG9iaiwgcHJvcCwgdmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLmRlZXAucHJvcGVydHkocHJvcCwgdmFsKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5kZWVwUHJvcGVydHlOb3RWYWwob2JqZWN0LCBwcm9wZXJ0eSwgdmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGhhcyBhIHByb3BlcnR5IG5hbWVkIGJ5IGBwcm9wZXJ0eWAsIGJ1dCB3aXRoIGEgdmFsdWVcbiAgICogZGlmZmVyZW50IGZyb20gdGhhdCBnaXZlbiBieSBgdmFsdWVgLiBgcHJvcGVydHlgIGNhbiB1c2UgZG90LSBhbmRcbiAgICogYnJhY2tldC1ub3RhdGlvbiBmb3IgZGVlcCByZWZlcmVuY2UuXG4gICAqXG4gICAqICAgICBhc3NlcnQuZGVlcFByb3BlcnR5Tm90VmFsKHsgdGVhOiB7IGdyZWVuOiAnbWF0Y2hhJyB9fSwgJ3RlYS5ncmVlbicsICdrb25hY2hhJyk7XG4gICAqXG4gICAqIEBuYW1lIGRlZXBQcm9wZXJ0eU5vdFZhbFxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuZGVlcFByb3BlcnR5Tm90VmFsID0gZnVuY3Rpb24gKG9iaiwgcHJvcCwgdmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5ub3QuaGF2ZS5kZWVwLnByb3BlcnR5KHByb3AsIHZhbCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubGVuZ3RoT2Yob2JqZWN0LCBsZW5ndGgsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGhhcyBhIGBsZW5ndGhgIHByb3BlcnR5IHdpdGggdGhlIGV4cGVjdGVkIHZhbHVlLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lmxlbmd0aE9mKFsxLDIsM10sIDMsICdhcnJheSBoYXMgbGVuZ3RoIG9mIDMnKTtcbiAgICogICAgIGFzc2VydC5sZW5ndGhPZignZm9vYmFyJywgNSwgJ3N0cmluZyBoYXMgbGVuZ3RoIG9mIDYnKTtcbiAgICpcbiAgICogQG5hbWUgbGVuZ3RoT2ZcbiAgICogQHBhcmFtIHtNaXhlZH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7TnVtYmVyfSBsZW5ndGhcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lmxlbmd0aE9mID0gZnVuY3Rpb24gKGV4cCwgbGVuLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGV4cCwgbXNnKS50by5oYXZlLmxlbmd0aChsZW4pO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLnRocm93cyhmdW5jdGlvbiwgW2NvbnN0cnVjdG9yL3N0cmluZy9yZWdleHBdLCBbc3RyaW5nL3JlZ2V4cF0sIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBmdW5jdGlvbmAgd2lsbCB0aHJvdyBhbiBlcnJvciB0aGF0IGlzIGFuIGluc3RhbmNlIG9mXG4gICAqIGBjb25zdHJ1Y3RvcmAsIG9yIGFsdGVybmF0ZWx5IHRoYXQgaXQgd2lsbCB0aHJvdyBhbiBlcnJvciB3aXRoIG1lc3NhZ2VcbiAgICogbWF0Y2hpbmcgYHJlZ2V4cGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQudGhyb3coZm4sICdmdW5jdGlvbiB0aHJvd3MgYSByZWZlcmVuY2UgZXJyb3InKTtcbiAgICogICAgIGFzc2VydC50aHJvdyhmbiwgL2Z1bmN0aW9uIHRocm93cyBhIHJlZmVyZW5jZSBlcnJvci8pO1xuICAgKiAgICAgYXNzZXJ0LnRocm93KGZuLCBSZWZlcmVuY2VFcnJvcik7XG4gICAqICAgICBhc3NlcnQudGhyb3coZm4sIFJlZmVyZW5jZUVycm9yLCAnZnVuY3Rpb24gdGhyb3dzIGEgcmVmZXJlbmNlIGVycm9yJyk7XG4gICAqICAgICBhc3NlcnQudGhyb3coZm4sIFJlZmVyZW5jZUVycm9yLCAvZnVuY3Rpb24gdGhyb3dzIGEgcmVmZXJlbmNlIGVycm9yLyk7XG4gICAqXG4gICAqIEBuYW1lIHRocm93c1xuICAgKiBAYWxpYXMgdGhyb3dcbiAgICogQGFsaWFzIFRocm93XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmN0aW9uXG4gICAqIEBwYXJhbSB7RXJyb3JDb25zdHJ1Y3Rvcn0gY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4cFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0Vycm9yI0Vycm9yX3R5cGVzXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5UaHJvdyA9IGZ1bmN0aW9uIChmbiwgZXJydCwgZXJycywgbXNnKSB7XG4gICAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgZXJydCB8fCBlcnJ0IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICBlcnJzID0gZXJydDtcbiAgICAgIGVycnQgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBhc3NlcnRFcnIgPSBuZXcgQXNzZXJ0aW9uKGZuLCBtc2cpLnRvLlRocm93KGVycnQsIGVycnMpO1xuICAgIHJldHVybiBmbGFnKGFzc2VydEVyciwgJ29iamVjdCcpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmRvZXNOb3RUaHJvdyhmdW5jdGlvbiwgW2NvbnN0cnVjdG9yL3JlZ2V4cF0sIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBmdW5jdGlvbmAgd2lsbCBfbm90XyB0aHJvdyBhbiBlcnJvciB0aGF0IGlzIGFuIGluc3RhbmNlIG9mXG4gICAqIGBjb25zdHJ1Y3RvcmAsIG9yIGFsdGVybmF0ZWx5IHRoYXQgaXQgd2lsbCBub3QgdGhyb3cgYW4gZXJyb3Igd2l0aCBtZXNzYWdlXG4gICAqIG1hdGNoaW5nIGByZWdleHBgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmRvZXNOb3RUaHJvdyhmbiwgRXJyb3IsICdmdW5jdGlvbiBkb2VzIG5vdCB0aHJvdycpO1xuICAgKlxuICAgKiBAbmFtZSBkb2VzTm90VGhyb3dcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuY3Rpb25cbiAgICogQHBhcmFtIHtFcnJvckNvbnN0cnVjdG9yfSBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXhwXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRXJyb3IjRXJyb3JfdHlwZXNcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmRvZXNOb3RUaHJvdyA9IGZ1bmN0aW9uIChmbiwgdHlwZSwgbXNnKSB7XG4gICAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgdHlwZSkge1xuICAgICAgbXNnID0gdHlwZTtcbiAgICAgIHR5cGUgPSBudWxsO1xuICAgIH1cblxuICAgIG5ldyBBc3NlcnRpb24oZm4sIG1zZykudG8ubm90LlRocm93KHR5cGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm9wZXJhdG9yKHZhbDEsIG9wZXJhdG9yLCB2YWwyLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIENvbXBhcmVzIHR3byB2YWx1ZXMgdXNpbmcgYG9wZXJhdG9yYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5vcGVyYXRvcigxLCAnPCcsIDIsICdldmVyeXRoaW5nIGlzIG9rJyk7XG4gICAqICAgICBhc3NlcnQub3BlcmF0b3IoMSwgJz4nLCAyLCAndGhpcyB3aWxsIGZhaWwnKTtcbiAgICpcbiAgICogQG5hbWUgb3BlcmF0b3JcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsMVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3BlcmF0b3JcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsMlxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQub3BlcmF0b3IgPSBmdW5jdGlvbiAodmFsLCBvcGVyYXRvciwgdmFsMiwgbXNnKSB7XG4gICAgaWYgKCF+Wyc9PScsICc9PT0nLCAnPicsICc+PScsICc8JywgJzw9JywgJyE9JywgJyE9PSddLmluZGV4T2Yob3BlcmF0b3IpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgb3BlcmF0b3IgXCInICsgb3BlcmF0b3IgKyAnXCInKTtcbiAgICB9XG4gICAgdmFyIHRlc3QgPSBuZXcgQXNzZXJ0aW9uKGV2YWwodmFsICsgb3BlcmF0b3IgKyB2YWwyKSwgbXNnKTtcbiAgICB0ZXN0LmFzc2VydChcbiAgICAgICAgdHJ1ZSA9PT0gZmxhZyh0ZXN0LCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICcgKyB1dGlsLmluc3BlY3QodmFsKSArICcgdG8gYmUgJyArIG9wZXJhdG9yICsgJyAnICsgdXRpbC5pbnNwZWN0KHZhbDIpXG4gICAgICAsICdleHBlY3RlZCAnICsgdXRpbC5pbnNwZWN0KHZhbCkgKyAnIHRvIG5vdCBiZSAnICsgb3BlcmF0b3IgKyAnICcgKyB1dGlsLmluc3BlY3QodmFsMikgKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5jbG9zZVRvKGFjdHVhbCwgZXhwZWN0ZWQsIGRlbHRhLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGVxdWFsIGBleHBlY3RlZGAsIHRvIHdpdGhpbiBhICsvLSBgZGVsdGFgIHJhbmdlLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmNsb3NlVG8oMS41LCAxLCAwLjUsICdudW1iZXJzIGFyZSBjbG9zZScpO1xuICAgKlxuICAgKiBAbmFtZSBjbG9zZVRvXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBhY3R1YWxcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBkZWx0YVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuY2xvc2VUbyA9IGZ1bmN0aW9uIChhY3QsIGV4cCwgZGVsdGEsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oYWN0LCBtc2cpLnRvLmJlLmNsb3NlVG8oZXhwLCBkZWx0YSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuc2FtZU1lbWJlcnMoc2V0MSwgc2V0MiwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHNldDFgIGFuZCBgc2V0MmAgaGF2ZSB0aGUgc2FtZSBtZW1iZXJzLlxuICAgKiBPcmRlciBpcyBub3QgdGFrZW4gaW50byBhY2NvdW50LlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LnNhbWVNZW1iZXJzKFsgMSwgMiwgMyBdLCBbIDIsIDEsIDMgXSwgJ3NhbWUgbWVtYmVycycpO1xuICAgKlxuICAgKiBAbmFtZSBzYW1lTWVtYmVyc1xuICAgKiBAcGFyYW0ge0FycmF5fSBzdXBlcnNldFxuICAgKiBAcGFyYW0ge0FycmF5fSBzdWJzZXRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LnNhbWVNZW1iZXJzID0gZnVuY3Rpb24gKHNldDEsIHNldDIsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oc2V0MSwgbXNnKS50by5oYXZlLnNhbWUubWVtYmVycyhzZXQyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiAjIyMgLmluY2x1ZGVNZW1iZXJzKHN1cGVyc2V0LCBzdWJzZXQsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBzdWJzZXRgIGlzIGluY2x1ZGVkIGluIGBzdXBlcnNldGAuXG4gICAqIE9yZGVyIGlzIG5vdCB0YWtlbiBpbnRvIGFjY291bnQuXG4gICAqXG4gICAqICAgICBhc3NlcnQuaW5jbHVkZU1lbWJlcnMoWyAxLCAyLCAzIF0sIFsgMiwgMSBdLCAnaW5jbHVkZSBtZW1iZXJzJyk7XG4gICAqXG4gICAqIEBuYW1lIGluY2x1ZGVNZW1iZXJzXG4gICAqIEBwYXJhbSB7QXJyYXl9IHN1cGVyc2V0XG4gICAqIEBwYXJhbSB7QXJyYXl9IHN1YnNldFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaW5jbHVkZU1lbWJlcnMgPSBmdW5jdGlvbiAoc3VwZXJzZXQsIHN1YnNldCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihzdXBlcnNldCwgbXNnKS50by5pbmNsdWRlLm1lbWJlcnMoc3Vic2V0KTtcbiAgfVxuXG4gIC8qIVxuICAgKiBVbmRvY3VtZW50ZWQgLyB1bnRlc3RlZFxuICAgKi9cblxuICBhc3NlcnQuaWZFcnJvciA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5iZS5vaztcbiAgfTtcblxuICAvKiFcbiAgICogQWxpYXNlcy5cbiAgICovXG5cbiAgKGZ1bmN0aW9uIGFsaWFzKG5hbWUsIGFzKXtcbiAgICBhc3NlcnRbYXNdID0gYXNzZXJ0W25hbWVdO1xuICAgIHJldHVybiBhbGlhcztcbiAgfSlcbiAgKCdUaHJvdycsICd0aHJvdycpXG4gICgnVGhyb3cnLCAndGhyb3dzJyk7XG59O1xuIiwiLyohXG4gKiBjaGFpXG4gKiBDb3B5cmlnaHQoYykgMjAxMS0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY2hhaSwgdXRpbCkge1xuICBjaGFpLmV4cGVjdCA9IGZ1bmN0aW9uICh2YWwsIG1lc3NhZ2UpIHtcbiAgICByZXR1cm4gbmV3IGNoYWkuQXNzZXJ0aW9uKHZhbCwgbWVzc2FnZSk7XG4gIH07XG59O1xuXG4iLCIvKiFcbiAqIGNoYWlcbiAqIENvcHlyaWdodChjKSAyMDExLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjaGFpLCB1dGlsKSB7XG4gIHZhciBBc3NlcnRpb24gPSBjaGFpLkFzc2VydGlvbjtcblxuICBmdW5jdGlvbiBsb2FkU2hvdWxkICgpIHtcbiAgICAvLyBleHBsaWNpdGx5IGRlZmluZSB0aGlzIG1ldGhvZCBhcyBmdW5jdGlvbiBhcyB0byBoYXZlIGl0J3MgbmFtZSB0byBpbmNsdWRlIGFzIGBzc2ZpYFxuICAgIGZ1bmN0aW9uIHNob3VsZEdldHRlcigpIHtcbiAgICAgIGlmICh0aGlzIGluc3RhbmNlb2YgU3RyaW5nIHx8IHRoaXMgaW5zdGFuY2VvZiBOdW1iZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBBc3NlcnRpb24odGhpcy5jb25zdHJ1Y3Rvcih0aGlzKSwgbnVsbCwgc2hvdWxkR2V0dGVyKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcyBpbnN0YW5jZW9mIEJvb2xlYW4pIHtcbiAgICAgICAgcmV0dXJuIG5ldyBBc3NlcnRpb24odGhpcyA9PSB0cnVlLCBudWxsLCBzaG91bGRHZXR0ZXIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBBc3NlcnRpb24odGhpcywgbnVsbCwgc2hvdWxkR2V0dGVyKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gc2hvdWxkU2V0dGVyKHZhbHVlKSB7XG4gICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2NoYWlqcy9jaGFpL2lzc3Vlcy84NjogdGhpcyBtYWtlc1xuICAgICAgLy8gYHdoYXRldmVyLnNob3VsZCA9IHNvbWVWYWx1ZWAgYWN0dWFsbHkgc2V0IGBzb21lVmFsdWVgLCB3aGljaCBpc1xuICAgICAgLy8gZXNwZWNpYWxseSB1c2VmdWwgZm9yIGBnbG9iYWwuc2hvdWxkID0gcmVxdWlyZSgnY2hhaScpLnNob3VsZCgpYC5cbiAgICAgIC8vXG4gICAgICAvLyBOb3RlIHRoYXQgd2UgaGF2ZSB0byB1c2UgW1tEZWZpbmVQcm9wZXJ0eV1dIGluc3RlYWQgb2YgW1tQdXRdXVxuICAgICAgLy8gc2luY2Ugb3RoZXJ3aXNlIHdlIHdvdWxkIHRyaWdnZXIgdGhpcyB2ZXJ5IHNldHRlciFcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnc2hvdWxkJywge1xuICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBtb2RpZnkgT2JqZWN0LnByb3RvdHlwZSB0byBoYXZlIGBzaG91bGRgXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KE9iamVjdC5wcm90b3R5cGUsICdzaG91bGQnLCB7XG4gICAgICBzZXQ6IHNob3VsZFNldHRlclxuICAgICAgLCBnZXQ6IHNob3VsZEdldHRlclxuICAgICAgLCBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcblxuICAgIHZhciBzaG91bGQgPSB7fTtcblxuICAgIHNob3VsZC5lcXVhbCA9IGZ1bmN0aW9uICh2YWwxLCB2YWwyLCBtc2cpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24odmFsMSwgbXNnKS50by5lcXVhbCh2YWwyKTtcbiAgICB9O1xuXG4gICAgc2hvdWxkLlRocm93ID0gZnVuY3Rpb24gKGZuLCBlcnJ0LCBlcnJzLCBtc2cpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24oZm4sIG1zZykudG8uVGhyb3coZXJydCwgZXJycyk7XG4gICAgfTtcblxuICAgIHNob3VsZC5leGlzdCA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uZXhpc3Q7XG4gICAgfVxuXG4gICAgLy8gbmVnYXRpb25cbiAgICBzaG91bGQubm90ID0ge31cblxuICAgIHNob3VsZC5ub3QuZXF1YWwgPSBmdW5jdGlvbiAodmFsMSwgdmFsMiwgbXNnKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKHZhbDEsIG1zZykudG8ubm90LmVxdWFsKHZhbDIpO1xuICAgIH07XG5cbiAgICBzaG91bGQubm90LlRocm93ID0gZnVuY3Rpb24gKGZuLCBlcnJ0LCBlcnJzLCBtc2cpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24oZm4sIG1zZykudG8ubm90LlRocm93KGVycnQsIGVycnMpO1xuICAgIH07XG5cbiAgICBzaG91bGQubm90LmV4aXN0ID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuZXhpc3Q7XG4gICAgfVxuXG4gICAgc2hvdWxkWyd0aHJvdyddID0gc2hvdWxkWydUaHJvdyddO1xuICAgIHNob3VsZC5ub3RbJ3Rocm93J10gPSBzaG91bGQubm90WydUaHJvdyddO1xuXG4gICAgcmV0dXJuIHNob3VsZDtcbiAgfTtcblxuICBjaGFpLnNob3VsZCA9IGxvYWRTaG91bGQ7XG4gIGNoYWkuU2hvdWxkID0gbG9hZFNob3VsZDtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBhZGRDaGFpbmluZ01ldGhvZCB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzXG4gKi9cblxudmFyIHRyYW5zZmVyRmxhZ3MgPSByZXF1aXJlKCcuL3RyYW5zZmVyRmxhZ3MnKTtcbnZhciBmbGFnID0gcmVxdWlyZSgnLi9mbGFnJyk7XG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG5cbi8qIVxuICogTW9kdWxlIHZhcmlhYmxlc1xuICovXG5cbi8vIENoZWNrIHdoZXRoZXIgYF9fcHJvdG9fX2AgaXMgc3VwcG9ydGVkXG52YXIgaGFzUHJvdG9TdXBwb3J0ID0gJ19fcHJvdG9fXycgaW4gT2JqZWN0O1xuXG4vLyBXaXRob3V0IGBfX3Byb3RvX19gIHN1cHBvcnQsIHRoaXMgbW9kdWxlIHdpbGwgbmVlZCB0byBhZGQgcHJvcGVydGllcyB0byBhIGZ1bmN0aW9uLlxuLy8gSG93ZXZlciwgc29tZSBGdW5jdGlvbi5wcm90b3R5cGUgbWV0aG9kcyBjYW5ub3QgYmUgb3ZlcndyaXR0ZW4sXG4vLyBhbmQgdGhlcmUgc2VlbXMgbm8gZWFzeSBjcm9zcy1wbGF0Zm9ybSB3YXkgdG8gZGV0ZWN0IHRoZW0gKEBzZWUgY2hhaWpzL2NoYWkvaXNzdWVzLzY5KS5cbnZhciBleGNsdWRlTmFtZXMgPSAvXig/Omxlbmd0aHxuYW1lfGFyZ3VtZW50c3xjYWxsZXIpJC87XG5cbi8vIENhY2hlIGBGdW5jdGlvbmAgcHJvcGVydGllc1xudmFyIGNhbGwgID0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGwsXG4gICAgYXBwbHkgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHk7XG5cbi8qKlxuICogIyMjIGFkZENoYWluYWJsZU1ldGhvZCAoY3R4LCBuYW1lLCBtZXRob2QsIGNoYWluaW5nQmVoYXZpb3IpXG4gKlxuICogQWRkcyBhIG1ldGhvZCB0byBhbiBvYmplY3QsIHN1Y2ggdGhhdCB0aGUgbWV0aG9kIGNhbiBhbHNvIGJlIGNoYWluZWQuXG4gKlxuICogICAgIHV0aWxzLmFkZENoYWluYWJsZU1ldGhvZChjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUsICdmb28nLCBmdW5jdGlvbiAoc3RyKSB7XG4gKiAgICAgICB2YXIgb2JqID0gdXRpbHMuZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gKiAgICAgICBuZXcgY2hhaS5Bc3NlcnRpb24ob2JqKS50by5iZS5lcXVhbChzdHIpO1xuICogICAgIH0pO1xuICpcbiAqIENhbiBhbHNvIGJlIGFjY2Vzc2VkIGRpcmVjdGx5IGZyb20gYGNoYWkuQXNzZXJ0aW9uYC5cbiAqXG4gKiAgICAgY2hhaS5Bc3NlcnRpb24uYWRkQ2hhaW5hYmxlTWV0aG9kKCdmb28nLCBmbiwgY2hhaW5pbmdCZWhhdmlvcik7XG4gKlxuICogVGhlIHJlc3VsdCBjYW4gdGhlbiBiZSB1c2VkIGFzIGJvdGggYSBtZXRob2QgYXNzZXJ0aW9uLCBleGVjdXRpbmcgYm90aCBgbWV0aG9kYCBhbmRcbiAqIGBjaGFpbmluZ0JlaGF2aW9yYCwgb3IgYXMgYSBsYW5ndWFnZSBjaGFpbiwgd2hpY2ggb25seSBleGVjdXRlcyBgY2hhaW5pbmdCZWhhdmlvcmAuXG4gKlxuICogICAgIGV4cGVjdChmb29TdHIpLnRvLmJlLmZvbygnYmFyJyk7XG4gKiAgICAgZXhwZWN0KGZvb1N0cikudG8uYmUuZm9vLmVxdWFsKCdmb28nKTtcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gY3R4IG9iamVjdCB0byB3aGljaCB0aGUgbWV0aG9kIGlzIGFkZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBvZiBtZXRob2QgdG8gYWRkXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBtZXRob2QgZnVuY3Rpb24gdG8gYmUgdXNlZCBmb3IgYG5hbWVgLCB3aGVuIGNhbGxlZFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2hhaW5pbmdCZWhhdmlvciBmdW5jdGlvbiB0byBiZSBjYWxsZWQgZXZlcnkgdGltZSB0aGUgcHJvcGVydHkgaXMgYWNjZXNzZWRcbiAqIEBuYW1lIGFkZENoYWluYWJsZU1ldGhvZFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjdHgsIG5hbWUsIG1ldGhvZCwgY2hhaW5pbmdCZWhhdmlvcikge1xuICBpZiAodHlwZW9mIGNoYWluaW5nQmVoYXZpb3IgIT09ICdmdW5jdGlvbicpIHtcbiAgICBjaGFpbmluZ0JlaGF2aW9yID0gZnVuY3Rpb24gKCkgeyB9O1xuICB9XG5cbiAgdmFyIGNoYWluYWJsZUJlaGF2aW9yID0ge1xuICAgICAgbWV0aG9kOiBtZXRob2RcbiAgICAsIGNoYWluaW5nQmVoYXZpb3I6IGNoYWluaW5nQmVoYXZpb3JcbiAgfTtcblxuICAvLyBzYXZlIHRoZSBtZXRob2RzIHNvIHdlIGNhbiBvdmVyd3JpdGUgdGhlbSBsYXRlciwgaWYgd2UgbmVlZCB0by5cbiAgaWYgKCFjdHguX19tZXRob2RzKSB7XG4gICAgY3R4Ll9fbWV0aG9kcyA9IHt9O1xuICB9XG4gIGN0eC5fX21ldGhvZHNbbmFtZV0gPSBjaGFpbmFibGVCZWhhdmlvcjtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3R4LCBuYW1lLFxuICAgIHsgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNoYWluYWJsZUJlaGF2aW9yLmNoYWluaW5nQmVoYXZpb3IuY2FsbCh0aGlzKTtcblxuICAgICAgICB2YXIgYXNzZXJ0ID0gZnVuY3Rpb24gYXNzZXJ0KCkge1xuICAgICAgICAgIHZhciBvbGRfc3NmaSA9IGZsYWcodGhpcywgJ3NzZmknKTtcbiAgICAgICAgICBpZiAob2xkX3NzZmkgJiYgY29uZmlnLmluY2x1ZGVTdGFjayA9PT0gZmFsc2UpXG4gICAgICAgICAgICBmbGFnKHRoaXMsICdzc2ZpJywgYXNzZXJ0KTtcbiAgICAgICAgICB2YXIgcmVzdWx0ID0gY2hhaW5hYmxlQmVoYXZpb3IubWV0aG9kLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdCA9PT0gdW5kZWZpbmVkID8gdGhpcyA6IHJlc3VsdDtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBVc2UgYF9fcHJvdG9fX2AgaWYgYXZhaWxhYmxlXG4gICAgICAgIGlmIChoYXNQcm90b1N1cHBvcnQpIHtcbiAgICAgICAgICAvLyBJbmhlcml0IGFsbCBwcm9wZXJ0aWVzIGZyb20gdGhlIG9iamVjdCBieSByZXBsYWNpbmcgdGhlIGBGdW5jdGlvbmAgcHJvdG90eXBlXG4gICAgICAgICAgdmFyIHByb3RvdHlwZSA9IGFzc2VydC5fX3Byb3RvX18gPSBPYmplY3QuY3JlYXRlKHRoaXMpO1xuICAgICAgICAgIC8vIFJlc3RvcmUgdGhlIGBjYWxsYCBhbmQgYGFwcGx5YCBtZXRob2RzIGZyb20gYEZ1bmN0aW9uYFxuICAgICAgICAgIHByb3RvdHlwZS5jYWxsID0gY2FsbDtcbiAgICAgICAgICBwcm90b3R5cGUuYXBwbHkgPSBhcHBseTtcbiAgICAgICAgfVxuICAgICAgICAvLyBPdGhlcndpc2UsIHJlZGVmaW5lIGFsbCBwcm9wZXJ0aWVzIChzbG93ISlcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdmFyIGFzc2VydGVyTmFtZXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhjdHgpO1xuICAgICAgICAgIGFzc2VydGVyTmFtZXMuZm9yRWFjaChmdW5jdGlvbiAoYXNzZXJ0ZXJOYW1lKSB7XG4gICAgICAgICAgICBpZiAoIWV4Y2x1ZGVOYW1lcy50ZXN0KGFzc2VydGVyTmFtZSkpIHtcbiAgICAgICAgICAgICAgdmFyIHBkID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihjdHgsIGFzc2VydGVyTmFtZSk7XG4gICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShhc3NlcnQsIGFzc2VydGVyTmFtZSwgcGQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJhbnNmZXJGbGFncyh0aGlzLCBhc3NlcnQpO1xuICAgICAgICByZXR1cm4gYXNzZXJ0O1xuICAgICAgfVxuICAgICwgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIGFkZE1ldGhvZCB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpO1xuXG4vKipcbiAqICMjIyAuYWRkTWV0aG9kIChjdHgsIG5hbWUsIG1ldGhvZClcbiAqXG4gKiBBZGRzIGEgbWV0aG9kIHRvIHRoZSBwcm90b3R5cGUgb2YgYW4gb2JqZWN0LlxuICpcbiAqICAgICB1dGlscy5hZGRNZXRob2QoY2hhaS5Bc3NlcnRpb24ucHJvdG90eXBlLCAnZm9vJywgZnVuY3Rpb24gKHN0cikge1xuICogICAgICAgdmFyIG9iaiA9IHV0aWxzLmZsYWcodGhpcywgJ29iamVjdCcpO1xuICogICAgICAgbmV3IGNoYWkuQXNzZXJ0aW9uKG9iaikudG8uYmUuZXF1YWwoc3RyKTtcbiAqICAgICB9KTtcbiAqXG4gKiBDYW4gYWxzbyBiZSBhY2Nlc3NlZCBkaXJlY3RseSBmcm9tIGBjaGFpLkFzc2VydGlvbmAuXG4gKlxuICogICAgIGNoYWkuQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZm9vJywgZm4pO1xuICpcbiAqIFRoZW4gY2FuIGJlIHVzZWQgYXMgYW55IG90aGVyIGFzc2VydGlvbi5cbiAqXG4gKiAgICAgZXhwZWN0KGZvb1N0cikudG8uYmUuZm9vKCdiYXInKTtcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gY3R4IG9iamVjdCB0byB3aGljaCB0aGUgbWV0aG9kIGlzIGFkZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBvZiBtZXRob2QgdG8gYWRkXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBtZXRob2QgZnVuY3Rpb24gdG8gYmUgdXNlZCBmb3IgbmFtZVxuICogQG5hbWUgYWRkTWV0aG9kXG4gKiBAYXBpIHB1YmxpY1xuICovXG52YXIgZmxhZyA9IHJlcXVpcmUoJy4vZmxhZycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjdHgsIG5hbWUsIG1ldGhvZCkge1xuICBjdHhbbmFtZV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG9sZF9zc2ZpID0gZmxhZyh0aGlzLCAnc3NmaScpO1xuICAgIGlmIChvbGRfc3NmaSAmJiBjb25maWcuaW5jbHVkZVN0YWNrID09PSBmYWxzZSlcbiAgICAgIGZsYWcodGhpcywgJ3NzZmknLCBjdHhbbmFtZV0pO1xuICAgIHZhciByZXN1bHQgPSBtZXRob2QuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQgPyB0aGlzIDogcmVzdWx0O1xuICB9O1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIGFkZFByb3BlcnR5IHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMjIyBhZGRQcm9wZXJ0eSAoY3R4LCBuYW1lLCBnZXR0ZXIpXG4gKlxuICogQWRkcyBhIHByb3BlcnR5IHRvIHRoZSBwcm90b3R5cGUgb2YgYW4gb2JqZWN0LlxuICpcbiAqICAgICB1dGlscy5hZGRQcm9wZXJ0eShjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUsICdmb28nLCBmdW5jdGlvbiAoKSB7XG4gKiAgICAgICB2YXIgb2JqID0gdXRpbHMuZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gKiAgICAgICBuZXcgY2hhaS5Bc3NlcnRpb24ob2JqKS50by5iZS5pbnN0YW5jZW9mKEZvbyk7XG4gKiAgICAgfSk7XG4gKlxuICogQ2FuIGFsc28gYmUgYWNjZXNzZWQgZGlyZWN0bHkgZnJvbSBgY2hhaS5Bc3NlcnRpb25gLlxuICpcbiAqICAgICBjaGFpLkFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnZm9vJywgZm4pO1xuICpcbiAqIFRoZW4gY2FuIGJlIHVzZWQgYXMgYW55IG90aGVyIGFzc2VydGlvbi5cbiAqXG4gKiAgICAgZXhwZWN0KG15Rm9vKS50by5iZS5mb287XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGN0eCBvYmplY3QgdG8gd2hpY2ggdGhlIHByb3BlcnR5IGlzIGFkZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBvZiBwcm9wZXJ0eSB0byBhZGRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGdldHRlciBmdW5jdGlvbiB0byBiZSB1c2VkIGZvciBuYW1lXG4gKiBAbmFtZSBhZGRQcm9wZXJ0eVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjdHgsIG5hbWUsIGdldHRlcikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3R4LCBuYW1lLFxuICAgIHsgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBnZXR0ZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdCA9PT0gdW5kZWZpbmVkID8gdGhpcyA6IHJlc3VsdDtcbiAgICAgIH1cbiAgICAsIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICB9KTtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBmbGFnIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMjIyBmbGFnKG9iamVjdCAsa2V5LCBbdmFsdWVdKVxuICpcbiAqIEdldCBvciBzZXQgYSBmbGFnIHZhbHVlIG9uIGFuIG9iamVjdC4gSWYgYVxuICogdmFsdWUgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSBzZXQsIGVsc2UgaXQgd2lsbFxuICogcmV0dXJuIHRoZSBjdXJyZW50bHkgc2V0IHZhbHVlIG9yIGB1bmRlZmluZWRgIGlmXG4gKiB0aGUgdmFsdWUgaXMgbm90IHNldC5cbiAqXG4gKiAgICAgdXRpbHMuZmxhZyh0aGlzLCAnZm9vJywgJ2JhcicpOyAvLyBzZXR0ZXJcbiAqICAgICB1dGlscy5mbGFnKHRoaXMsICdmb28nKTsgLy8gZ2V0dGVyLCByZXR1cm5zIGBiYXJgXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCAoY29uc3RydWN0ZWQgQXNzZXJ0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcGFyYW0ge01peGVkfSB2YWx1ZSAob3B0aW9uYWwpXG4gKiBAbmFtZSBmbGFnXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmosIGtleSwgdmFsdWUpIHtcbiAgdmFyIGZsYWdzID0gb2JqLl9fZmxhZ3MgfHwgKG9iai5fX2ZsYWdzID0gT2JqZWN0LmNyZWF0ZShudWxsKSk7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAzKSB7XG4gICAgZmxhZ3Nba2V5XSA9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBmbGFnc1trZXldO1xuICB9XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gZ2V0QWN0dWFsIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMgZ2V0QWN0dWFsKG9iamVjdCwgW2FjdHVhbF0pXG4gKlxuICogUmV0dXJucyB0aGUgYGFjdHVhbGAgdmFsdWUgZm9yIGFuIEFzc2VydGlvblxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgKGNvbnN0cnVjdGVkIEFzc2VydGlvbilcbiAqIEBwYXJhbSB7QXJndW1lbnRzfSBjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUuYXNzZXJ0IGFyZ3VtZW50c1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaiwgYXJncykge1xuICByZXR1cm4gYXJncy5sZW5ndGggPiA0ID8gYXJnc1s0XSA6IG9iai5fb2JqO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIGdldEVudW1lcmFibGVQcm9wZXJ0aWVzIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMjIyAuZ2V0RW51bWVyYWJsZVByb3BlcnRpZXMob2JqZWN0KVxuICpcbiAqIFRoaXMgYWxsb3dzIHRoZSByZXRyaWV2YWwgb2YgZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBhbiBvYmplY3QsXG4gKiBpbmhlcml0ZWQgb3Igbm90LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqIEBuYW1lIGdldEVudW1lcmFibGVQcm9wZXJ0aWVzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZ2V0RW51bWVyYWJsZVByb3BlcnRpZXMob2JqZWN0KSB7XG4gIHZhciByZXN1bHQgPSBbXTtcbiAgZm9yICh2YXIgbmFtZSBpbiBvYmplY3QpIHtcbiAgICByZXN1bHQucHVzaChuYW1lKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIG1lc3NhZ2UgY29tcG9zaXRpb24gdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGFuY2llc1xuICovXG5cbnZhciBmbGFnID0gcmVxdWlyZSgnLi9mbGFnJylcbiAgLCBnZXRBY3R1YWwgPSByZXF1aXJlKCcuL2dldEFjdHVhbCcpXG4gICwgaW5zcGVjdCA9IHJlcXVpcmUoJy4vaW5zcGVjdCcpXG4gICwgb2JqRGlzcGxheSA9IHJlcXVpcmUoJy4vb2JqRGlzcGxheScpO1xuXG4vKipcbiAqICMjIyAuZ2V0TWVzc2FnZShvYmplY3QsIG1lc3NhZ2UsIG5lZ2F0ZU1lc3NhZ2UpXG4gKlxuICogQ29uc3RydWN0IHRoZSBlcnJvciBtZXNzYWdlIGJhc2VkIG9uIGZsYWdzXG4gKiBhbmQgdGVtcGxhdGUgdGFncy4gVGVtcGxhdGUgdGFncyB3aWxsIHJldHVyblxuICogYSBzdHJpbmdpZmllZCBpbnNwZWN0aW9uIG9mIHRoZSBvYmplY3QgcmVmZXJlbmNlZC5cbiAqXG4gKiBNZXNzYWdlIHRlbXBsYXRlIHRhZ3M6XG4gKiAtIGAje3RoaXN9YCBjdXJyZW50IGFzc2VydGVkIG9iamVjdFxuICogLSBgI3thY3R9YCBhY3R1YWwgdmFsdWVcbiAqIC0gYCN7ZXhwfWAgZXhwZWN0ZWQgdmFsdWVcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IChjb25zdHJ1Y3RlZCBBc3NlcnRpb24pXG4gKiBAcGFyYW0ge0FyZ3VtZW50c30gY2hhaS5Bc3NlcnRpb24ucHJvdG90eXBlLmFzc2VydCBhcmd1bWVudHNcbiAqIEBuYW1lIGdldE1lc3NhZ2VcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqLCBhcmdzKSB7XG4gIHZhciBuZWdhdGUgPSBmbGFnKG9iaiwgJ25lZ2F0ZScpXG4gICAgLCB2YWwgPSBmbGFnKG9iaiwgJ29iamVjdCcpXG4gICAgLCBleHBlY3RlZCA9IGFyZ3NbM11cbiAgICAsIGFjdHVhbCA9IGdldEFjdHVhbChvYmosIGFyZ3MpXG4gICAgLCBtc2cgPSBuZWdhdGUgPyBhcmdzWzJdIDogYXJnc1sxXVxuICAgICwgZmxhZ01zZyA9IGZsYWcob2JqLCAnbWVzc2FnZScpO1xuXG4gIG1zZyA9IG1zZyB8fCAnJztcbiAgbXNnID0gbXNnXG4gICAgLnJlcGxhY2UoLyN7dGhpc30vZywgb2JqRGlzcGxheSh2YWwpKVxuICAgIC5yZXBsYWNlKC8je2FjdH0vZywgb2JqRGlzcGxheShhY3R1YWwpKVxuICAgIC5yZXBsYWNlKC8je2V4cH0vZywgb2JqRGlzcGxheShleHBlY3RlZCkpO1xuXG4gIHJldHVybiBmbGFnTXNnID8gZmxhZ01zZyArICc6ICcgKyBtc2cgOiBtc2c7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gZ2V0TmFtZSB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIGdldE5hbWUoZnVuYylcbiAqXG4gKiBHZXRzIHRoZSBuYW1lIG9mIGEgZnVuY3Rpb24sIGluIGEgY3Jvc3MtYnJvd3NlciB3YXkuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gYSBmdW5jdGlvbiAodXN1YWxseSBhIGNvbnN0cnVjdG9yKVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgaWYgKGZ1bmMubmFtZSkgcmV0dXJuIGZ1bmMubmFtZTtcblxuICB2YXIgbWF0Y2ggPSAvXlxccz9mdW5jdGlvbiAoW14oXSopXFwoLy5leGVjKGZ1bmMpO1xuICByZXR1cm4gbWF0Y2ggJiYgbWF0Y2hbMV0gPyBtYXRjaFsxXSA6IFwiXCI7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gZ2V0UGF0aFZhbHVlIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9sb2dpY2FscGFyYWRveC9maWx0clxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgLmdldFBhdGhWYWx1ZShwYXRoLCBvYmplY3QpXG4gKlxuICogVGhpcyBhbGxvd3MgdGhlIHJldHJpZXZhbCBvZiB2YWx1ZXMgaW4gYW5cbiAqIG9iamVjdCBnaXZlbiBhIHN0cmluZyBwYXRoLlxuICpcbiAqICAgICB2YXIgb2JqID0ge1xuICogICAgICAgICBwcm9wMToge1xuICogICAgICAgICAgICAgYXJyOiBbJ2EnLCAnYicsICdjJ11cbiAqICAgICAgICAgICAsIHN0cjogJ0hlbGxvJ1xuICogICAgICAgICB9XG4gKiAgICAgICAsIHByb3AyOiB7XG4gKiAgICAgICAgICAgICBhcnI6IFsgeyBuZXN0ZWQ6ICdVbml2ZXJzZScgfSBdXG4gKiAgICAgICAgICAgLCBzdHI6ICdIZWxsbyBhZ2FpbiEnXG4gKiAgICAgICAgIH1cbiAqICAgICB9XG4gKlxuICogVGhlIGZvbGxvd2luZyB3b3VsZCBiZSB0aGUgcmVzdWx0cy5cbiAqXG4gKiAgICAgZ2V0UGF0aFZhbHVlKCdwcm9wMS5zdHInLCBvYmopOyAvLyBIZWxsb1xuICogICAgIGdldFBhdGhWYWx1ZSgncHJvcDEuYXR0WzJdJywgb2JqKTsgLy8gYlxuICogICAgIGdldFBhdGhWYWx1ZSgncHJvcDIuYXJyWzBdLm5lc3RlZCcsIG9iaik7IC8vIFVuaXZlcnNlXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAqIEByZXR1cm5zIHtPYmplY3R9IHZhbHVlIG9yIGB1bmRlZmluZWRgXG4gKiBAbmFtZSBnZXRQYXRoVmFsdWVcbiAqIEBhcGkgcHVibGljXG4gKi9cblxudmFyIGdldFBhdGhWYWx1ZSA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHBhdGgsIG9iaikge1xuICB2YXIgcGFyc2VkID0gcGFyc2VQYXRoKHBhdGgpO1xuICByZXR1cm4gX2dldFBhdGhWYWx1ZShwYXJzZWQsIG9iaik7XG59O1xuXG4vKiFcbiAqICMjIHBhcnNlUGF0aChwYXRoKVxuICpcbiAqIEhlbHBlciBmdW5jdGlvbiB1c2VkIHRvIHBhcnNlIHN0cmluZyBvYmplY3RcbiAqIHBhdGhzLiBVc2UgaW4gY29uanVuY3Rpb24gd2l0aCBgX2dldFBhdGhWYWx1ZWAuXG4gKlxuICogICAgICB2YXIgcGFyc2VkID0gcGFyc2VQYXRoKCdteW9iamVjdC5wcm9wZXJ0eS5zdWJwcm9wJyk7XG4gKlxuICogIyMjIFBhdGhzOlxuICpcbiAqICogQ2FuIGJlIGFzIG5lYXIgaW5maW5pdGVseSBkZWVwIGFuZCBuZXN0ZWRcbiAqICogQXJyYXlzIGFyZSBhbHNvIHZhbGlkIHVzaW5nIHRoZSBmb3JtYWwgYG15b2JqZWN0LmRvY3VtZW50WzNdLnByb3BlcnR5YC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHJldHVybnMge09iamVjdH0gcGFyc2VkXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBwYXJzZVBhdGggKHBhdGgpIHtcbiAgdmFyIHN0ciA9IHBhdGgucmVwbGFjZSgvXFxbL2csICcuWycpXG4gICAgLCBwYXJ0cyA9IHN0ci5tYXRjaCgvKFxcXFxcXC58W14uXSs/KSsvZyk7XG4gIHJldHVybiBwYXJ0cy5tYXAoZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgdmFyIHJlID0gL1xcWyhcXGQrKVxcXSQvXG4gICAgICAsIG1BcnIgPSByZS5leGVjKHZhbHVlKVxuICAgIGlmIChtQXJyKSByZXR1cm4geyBpOiBwYXJzZUZsb2F0KG1BcnJbMV0pIH07XG4gICAgZWxzZSByZXR1cm4geyBwOiB2YWx1ZSB9O1xuICB9KTtcbn07XG5cbi8qIVxuICogIyMgX2dldFBhdGhWYWx1ZShwYXJzZWQsIG9iailcbiAqXG4gKiBIZWxwZXIgY29tcGFuaW9uIGZ1bmN0aW9uIGZvciBgLnBhcnNlUGF0aGAgdGhhdCByZXR1cm5zXG4gKiB0aGUgdmFsdWUgbG9jYXRlZCBhdCB0aGUgcGFyc2VkIGFkZHJlc3MuXG4gKlxuICogICAgICB2YXIgdmFsdWUgPSBnZXRQYXRoVmFsdWUocGFyc2VkLCBvYmopO1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBwYXJzZWQgZGVmaW5pdGlvbiBmcm9tIGBwYXJzZVBhdGhgLlxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCB0byBzZWFyY2ggYWdhaW5zdFxuICogQHJldHVybnMge09iamVjdHxVbmRlZmluZWR9IHZhbHVlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBfZ2V0UGF0aFZhbHVlIChwYXJzZWQsIG9iaikge1xuICB2YXIgdG1wID0gb2JqXG4gICAgLCByZXM7XG4gIGZvciAodmFyIGkgPSAwLCBsID0gcGFyc2VkLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHZhciBwYXJ0ID0gcGFyc2VkW2ldO1xuICAgIGlmICh0bXApIHtcbiAgICAgIGlmICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHBhcnQucClcbiAgICAgICAgdG1wID0gdG1wW3BhcnQucF07XG4gICAgICBlbHNlIGlmICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHBhcnQuaSlcbiAgICAgICAgdG1wID0gdG1wW3BhcnQuaV07XG4gICAgICBpZiAoaSA9PSAobCAtIDEpKSByZXMgPSB0bXA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlcyA9IHVuZGVmaW5lZDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlcztcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBnZXRQcm9wZXJ0aWVzIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMjIyAuZ2V0UHJvcGVydGllcyhvYmplY3QpXG4gKlxuICogVGhpcyBhbGxvd3MgdGhlIHJldHJpZXZhbCBvZiBwcm9wZXJ0eSBuYW1lcyBvZiBhbiBvYmplY3QsIGVudW1lcmFibGUgb3Igbm90LFxuICogaW5oZXJpdGVkIG9yIG5vdC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKiBAbmFtZSBnZXRQcm9wZXJ0aWVzXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZ2V0UHJvcGVydGllcyhvYmplY3QpIHtcbiAgdmFyIHJlc3VsdCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHN1YmplY3QpO1xuXG4gIGZ1bmN0aW9uIGFkZFByb3BlcnR5KHByb3BlcnR5KSB7XG4gICAgaWYgKHJlc3VsdC5pbmRleE9mKHByb3BlcnR5KSA9PT0gLTEpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHByb3BlcnR5KTtcbiAgICB9XG4gIH1cblxuICB2YXIgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yoc3ViamVjdCk7XG4gIHdoaWxlIChwcm90byAhPT0gbnVsbCkge1xuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHByb3RvKS5mb3JFYWNoKGFkZFByb3BlcnR5KTtcbiAgICBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90byk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufTtcbiIsIi8qIVxuICogY2hhaVxuICogQ29weXJpZ2h0KGMpIDIwMTEgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIE1haW4gZXhwb3J0c1xuICovXG5cbnZhciBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLyohXG4gKiB0ZXN0IHV0aWxpdHlcbiAqL1xuXG5leHBvcnRzLnRlc3QgPSByZXF1aXJlKCcuL3Rlc3QnKTtcblxuLyohXG4gKiB0eXBlIHV0aWxpdHlcbiAqL1xuXG5leHBvcnRzLnR5cGUgPSByZXF1aXJlKCcuL3R5cGUnKTtcblxuLyohXG4gKiBtZXNzYWdlIHV0aWxpdHlcbiAqL1xuXG5leHBvcnRzLmdldE1lc3NhZ2UgPSByZXF1aXJlKCcuL2dldE1lc3NhZ2UnKTtcblxuLyohXG4gKiBhY3R1YWwgdXRpbGl0eVxuICovXG5cbmV4cG9ydHMuZ2V0QWN0dWFsID0gcmVxdWlyZSgnLi9nZXRBY3R1YWwnKTtcblxuLyohXG4gKiBJbnNwZWN0IHV0aWxcbiAqL1xuXG5leHBvcnRzLmluc3BlY3QgPSByZXF1aXJlKCcuL2luc3BlY3QnKTtcblxuLyohXG4gKiBPYmplY3QgRGlzcGxheSB1dGlsXG4gKi9cblxuZXhwb3J0cy5vYmpEaXNwbGF5ID0gcmVxdWlyZSgnLi9vYmpEaXNwbGF5Jyk7XG5cbi8qIVxuICogRmxhZyB1dGlsaXR5XG4gKi9cblxuZXhwb3J0cy5mbGFnID0gcmVxdWlyZSgnLi9mbGFnJyk7XG5cbi8qIVxuICogRmxhZyB0cmFuc2ZlcnJpbmcgdXRpbGl0eVxuICovXG5cbmV4cG9ydHMudHJhbnNmZXJGbGFncyA9IHJlcXVpcmUoJy4vdHJhbnNmZXJGbGFncycpO1xuXG4vKiFcbiAqIERlZXAgZXF1YWwgdXRpbGl0eVxuICovXG5cbmV4cG9ydHMuZXFsID0gcmVxdWlyZSgnZGVlcC1lcWwnKTtcblxuLyohXG4gKiBEZWVwIHBhdGggdmFsdWVcbiAqL1xuXG5leHBvcnRzLmdldFBhdGhWYWx1ZSA9IHJlcXVpcmUoJy4vZ2V0UGF0aFZhbHVlJyk7XG5cbi8qIVxuICogRnVuY3Rpb24gbmFtZVxuICovXG5cbmV4cG9ydHMuZ2V0TmFtZSA9IHJlcXVpcmUoJy4vZ2V0TmFtZScpO1xuXG4vKiFcbiAqIGFkZCBQcm9wZXJ0eVxuICovXG5cbmV4cG9ydHMuYWRkUHJvcGVydHkgPSByZXF1aXJlKCcuL2FkZFByb3BlcnR5Jyk7XG5cbi8qIVxuICogYWRkIE1ldGhvZFxuICovXG5cbmV4cG9ydHMuYWRkTWV0aG9kID0gcmVxdWlyZSgnLi9hZGRNZXRob2QnKTtcblxuLyohXG4gKiBvdmVyd3JpdGUgUHJvcGVydHlcbiAqL1xuXG5leHBvcnRzLm92ZXJ3cml0ZVByb3BlcnR5ID0gcmVxdWlyZSgnLi9vdmVyd3JpdGVQcm9wZXJ0eScpO1xuXG4vKiFcbiAqIG92ZXJ3cml0ZSBNZXRob2RcbiAqL1xuXG5leHBvcnRzLm92ZXJ3cml0ZU1ldGhvZCA9IHJlcXVpcmUoJy4vb3ZlcndyaXRlTWV0aG9kJyk7XG5cbi8qIVxuICogQWRkIGEgY2hhaW5hYmxlIG1ldGhvZFxuICovXG5cbmV4cG9ydHMuYWRkQ2hhaW5hYmxlTWV0aG9kID0gcmVxdWlyZSgnLi9hZGRDaGFpbmFibGVNZXRob2QnKTtcblxuLyohXG4gKiBPdmVyd3JpdGUgY2hhaW5hYmxlIG1ldGhvZFxuICovXG5cbmV4cG9ydHMub3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kID0gcmVxdWlyZSgnLi9vdmVyd3JpdGVDaGFpbmFibGVNZXRob2QnKTtcblxuIiwiLy8gVGhpcyBpcyAoYWxtb3N0KSBkaXJlY3RseSBmcm9tIE5vZGUuanMgdXRpbHNcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9qb3llbnQvbm9kZS9ibG9iL2Y4YzMzNWQwY2FmNDdmMTZkMzE0MTNmODlhYTI4ZWRhMzg3OGUzYWEvbGliL3V0aWwuanNcblxudmFyIGdldE5hbWUgPSByZXF1aXJlKCcuL2dldE5hbWUnKTtcbnZhciBnZXRQcm9wZXJ0aWVzID0gcmVxdWlyZSgnLi9nZXRQcm9wZXJ0aWVzJyk7XG52YXIgZ2V0RW51bWVyYWJsZVByb3BlcnRpZXMgPSByZXF1aXJlKCcuL2dldEVudW1lcmFibGVQcm9wZXJ0aWVzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gaW5zcGVjdDtcblxuLyoqXG4gKiBFY2hvcyB0aGUgdmFsdWUgb2YgYSB2YWx1ZS4gVHJ5cyB0byBwcmludCB0aGUgdmFsdWUgb3V0XG4gKiBpbiB0aGUgYmVzdCB3YXkgcG9zc2libGUgZ2l2ZW4gdGhlIGRpZmZlcmVudCB0eXBlcy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIFRoZSBvYmplY3QgdG8gcHJpbnQgb3V0LlxuICogQHBhcmFtIHtCb29sZWFufSBzaG93SGlkZGVuIEZsYWcgdGhhdCBzaG93cyBoaWRkZW4gKG5vdCBlbnVtZXJhYmxlKVxuICogICAgcHJvcGVydGllcyBvZiBvYmplY3RzLlxuICogQHBhcmFtIHtOdW1iZXJ9IGRlcHRoIERlcHRoIGluIHdoaWNoIHRvIGRlc2NlbmQgaW4gb2JqZWN0LiBEZWZhdWx0IGlzIDIuXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGNvbG9ycyBGbGFnIHRvIHR1cm4gb24gQU5TSSBlc2NhcGUgY29kZXMgdG8gY29sb3IgdGhlXG4gKiAgICBvdXRwdXQuIERlZmF1bHQgaXMgZmFsc2UgKG5vIGNvbG9yaW5nKS5cbiAqL1xuZnVuY3Rpb24gaW5zcGVjdChvYmosIHNob3dIaWRkZW4sIGRlcHRoLCBjb2xvcnMpIHtcbiAgdmFyIGN0eCA9IHtcbiAgICBzaG93SGlkZGVuOiBzaG93SGlkZGVuLFxuICAgIHNlZW46IFtdLFxuICAgIHN0eWxpemU6IGZ1bmN0aW9uIChzdHIpIHsgcmV0dXJuIHN0cjsgfVxuICB9O1xuICByZXR1cm4gZm9ybWF0VmFsdWUoY3R4LCBvYmosICh0eXBlb2YgZGVwdGggPT09ICd1bmRlZmluZWQnID8gMiA6IGRlcHRoKSk7XG59XG5cbi8vIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tLzEwNDQxMjgvXG52YXIgZ2V0T3V0ZXJIVE1MID0gZnVuY3Rpb24oZWxlbWVudCkge1xuICBpZiAoJ291dGVySFRNTCcgaW4gZWxlbWVudCkgcmV0dXJuIGVsZW1lbnQub3V0ZXJIVE1MO1xuICB2YXIgbnMgPSBcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWxcIjtcbiAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhucywgJ18nKTtcbiAgdmFyIGVsZW1Qcm90byA9ICh3aW5kb3cuSFRNTEVsZW1lbnQgfHwgd2luZG93LkVsZW1lbnQpLnByb3RvdHlwZTtcbiAgdmFyIHhtbFNlcmlhbGl6ZXIgPSBuZXcgWE1MU2VyaWFsaXplcigpO1xuICB2YXIgaHRtbDtcbiAgaWYgKGRvY3VtZW50LnhtbFZlcnNpb24pIHtcbiAgICByZXR1cm4geG1sU2VyaWFsaXplci5zZXJpYWxpemVUb1N0cmluZyhlbGVtZW50KTtcbiAgfSBlbHNlIHtcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoZWxlbWVudC5jbG9uZU5vZGUoZmFsc2UpKTtcbiAgICBodG1sID0gY29udGFpbmVyLmlubmVySFRNTC5yZXBsYWNlKCc+PCcsICc+JyArIGVsZW1lbnQuaW5uZXJIVE1MICsgJzwnKTtcbiAgICBjb250YWluZXIuaW5uZXJIVE1MID0gJyc7XG4gICAgcmV0dXJuIGh0bWw7XG4gIH1cbn07XG5cbi8vIFJldHVybnMgdHJ1ZSBpZiBvYmplY3QgaXMgYSBET00gZWxlbWVudC5cbnZhciBpc0RPTUVsZW1lbnQgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gIGlmICh0eXBlb2YgSFRNTEVsZW1lbnQgPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG9iamVjdCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBvYmplY3QgJiZcbiAgICAgIHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmXG4gICAgICBvYmplY3Qubm9kZVR5cGUgPT09IDEgJiZcbiAgICAgIHR5cGVvZiBvYmplY3Qubm9kZU5hbWUgPT09ICdzdHJpbmcnO1xuICB9XG59O1xuXG5mdW5jdGlvbiBmb3JtYXRWYWx1ZShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMpIHtcbiAgLy8gUHJvdmlkZSBhIGhvb2sgZm9yIHVzZXItc3BlY2lmaWVkIGluc3BlY3QgZnVuY3Rpb25zLlxuICAvLyBDaGVjayB0aGF0IHZhbHVlIGlzIGFuIG9iamVjdCB3aXRoIGFuIGluc3BlY3QgZnVuY3Rpb24gb24gaXRcbiAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZS5pbnNwZWN0ID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAvLyBGaWx0ZXIgb3V0IHRoZSB1dGlsIG1vZHVsZSwgaXQncyBpbnNwZWN0IGZ1bmN0aW9uIGlzIHNwZWNpYWxcbiAgICAgIHZhbHVlLmluc3BlY3QgIT09IGV4cG9ydHMuaW5zcGVjdCAmJlxuICAgICAgLy8gQWxzbyBmaWx0ZXIgb3V0IGFueSBwcm90b3R5cGUgb2JqZWN0cyB1c2luZyB0aGUgY2lyY3VsYXIgY2hlY2suXG4gICAgICAhKHZhbHVlLmNvbnN0cnVjdG9yICYmIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZSA9PT0gdmFsdWUpKSB7XG4gICAgdmFyIHJldCA9IHZhbHVlLmluc3BlY3QocmVjdXJzZVRpbWVzKTtcbiAgICBpZiAodHlwZW9mIHJldCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldCA9IGZvcm1hdFZhbHVlKGN0eCwgcmV0LCByZWN1cnNlVGltZXMpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgLy8gUHJpbWl0aXZlIHR5cGVzIGNhbm5vdCBoYXZlIHByb3BlcnRpZXNcbiAgdmFyIHByaW1pdGl2ZSA9IGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKTtcbiAgaWYgKHByaW1pdGl2ZSkge1xuICAgIHJldHVybiBwcmltaXRpdmU7XG4gIH1cblxuICAvLyBJZiBpdCdzIERPTSBlbGVtLCBnZXQgb3V0ZXIgSFRNTC5cbiAgaWYgKGlzRE9NRWxlbWVudCh2YWx1ZSkpIHtcbiAgICByZXR1cm4gZ2V0T3V0ZXJIVE1MKHZhbHVlKTtcbiAgfVxuXG4gIC8vIExvb2sgdXAgdGhlIGtleXMgb2YgdGhlIG9iamVjdC5cbiAgdmFyIHZpc2libGVLZXlzID0gZ2V0RW51bWVyYWJsZVByb3BlcnRpZXModmFsdWUpO1xuICB2YXIga2V5cyA9IGN0eC5zaG93SGlkZGVuID8gZ2V0UHJvcGVydGllcyh2YWx1ZSkgOiB2aXNpYmxlS2V5cztcblxuICAvLyBTb21lIHR5cGUgb2Ygb2JqZWN0IHdpdGhvdXQgcHJvcGVydGllcyBjYW4gYmUgc2hvcnRjdXR0ZWQuXG4gIC8vIEluIElFLCBlcnJvcnMgaGF2ZSBhIHNpbmdsZSBgc3RhY2tgIHByb3BlcnR5LCBvciBpZiB0aGV5IGFyZSB2YW5pbGxhIGBFcnJvcmAsXG4gIC8vIGEgYHN0YWNrYCBwbHVzIGBkZXNjcmlwdGlvbmAgcHJvcGVydHk7IGlnbm9yZSB0aG9zZSBmb3IgY29uc2lzdGVuY3kuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCB8fCAoaXNFcnJvcih2YWx1ZSkgJiYgKFxuICAgICAgKGtleXMubGVuZ3RoID09PSAxICYmIGtleXNbMF0gPT09ICdzdGFjaycpIHx8XG4gICAgICAoa2V5cy5sZW5ndGggPT09IDIgJiYga2V5c1swXSA9PT0gJ2Rlc2NyaXB0aW9uJyAmJiBrZXlzWzFdID09PSAnc3RhY2snKVxuICAgICApKSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHZhciBuYW1lID0gZ2V0TmFtZSh2YWx1ZSk7XG4gICAgICB2YXIgbmFtZVN1ZmZpeCA9IG5hbWUgPyAnOiAnICsgbmFtZSA6ICcnO1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbRnVuY3Rpb24nICsgbmFtZVN1ZmZpeCArICddJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9XG4gICAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShEYXRlLnByb3RvdHlwZS50b1VUQ1N0cmluZy5jYWxsKHZhbHVlKSwgJ2RhdGUnKTtcbiAgICB9XG4gICAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBiYXNlID0gJycsIGFycmF5ID0gZmFsc2UsIGJyYWNlcyA9IFsneycsICd9J107XG5cbiAgLy8gTWFrZSBBcnJheSBzYXkgdGhhdCB0aGV5IGFyZSBBcnJheVxuICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBhcnJheSA9IHRydWU7XG4gICAgYnJhY2VzID0gWydbJywgJ10nXTtcbiAgfVxuXG4gIC8vIE1ha2UgZnVuY3Rpb25zIHNheSB0aGF0IHRoZXkgYXJlIGZ1bmN0aW9uc1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIG5hbWUgPSBnZXROYW1lKHZhbHVlKTtcbiAgICB2YXIgbmFtZVN1ZmZpeCA9IG5hbWUgPyAnOiAnICsgbmFtZSA6ICcnO1xuICAgIGJhc2UgPSAnIFtGdW5jdGlvbicgKyBuYW1lU3VmZml4ICsgJ10nO1xuICB9XG5cbiAgLy8gTWFrZSBSZWdFeHBzIHNheSB0aGF0IHRoZXkgYXJlIFJlZ0V4cHNcbiAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBkYXRlcyB3aXRoIHByb3BlcnRpZXMgZmlyc3Qgc2F5IHRoZSBkYXRlXG4gIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIERhdGUucHJvdG90eXBlLnRvVVRDU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBlcnJvciB3aXRoIG1lc3NhZ2UgZmlyc3Qgc2F5IHRoZSBlcnJvclxuICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwICYmICghYXJyYXkgfHwgdmFsdWUubGVuZ3RoID09IDApKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyBicmFjZXNbMV07XG4gIH1cblxuICBpZiAocmVjdXJzZVRpbWVzIDwgMCkge1xuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW09iamVjdF0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuXG4gIGN0eC5zZWVuLnB1c2godmFsdWUpO1xuXG4gIHZhciBvdXRwdXQ7XG4gIGlmIChhcnJheSkge1xuICAgIG91dHB1dCA9IGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dCA9IGtleXMubWFwKGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmV0dXJuIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpO1xuICAgIH0pO1xuICB9XG5cbiAgY3R4LnNlZW4ucG9wKCk7XG5cbiAgcmV0dXJuIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSkge1xuICBzd2l0Y2ggKHR5cGVvZiB2YWx1ZSkge1xuICAgIGNhc2UgJ3VuZGVmaW5lZCc6XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ3VuZGVmaW5lZCcsICd1bmRlZmluZWQnKTtcblxuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICB2YXIgc2ltcGxlID0gJ1xcJycgKyBKU09OLnN0cmluZ2lmeSh2YWx1ZSkucmVwbGFjZSgvXlwifFwiJC9nLCAnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpICsgJ1xcJyc7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoc2ltcGxlLCAnc3RyaW5nJyk7XG5cbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdudW1iZXInKTtcblxuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdib29sZWFuJyk7XG4gIH1cbiAgLy8gRm9yIHNvbWUgcmVhc29uIHR5cGVvZiBudWxsIGlzIFwib2JqZWN0XCIsIHNvIHNwZWNpYWwgY2FzZSBoZXJlLlxuICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ251bGwnLCAnbnVsbCcpO1xuICB9XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0RXJyb3IodmFsdWUpIHtcbiAgcmV0dXJuICdbJyArIEVycm9yLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSArICddJztcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKSB7XG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCBTdHJpbmcoaSkpKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIFN0cmluZyhpKSwgdHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQucHVzaCgnJyk7XG4gICAgfVxuICB9XG4gIGtleXMuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICBpZiAoIWtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAga2V5LCB0cnVlKSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KSB7XG4gIHZhciBuYW1lLCBzdHI7XG4gIGlmICh2YWx1ZS5fX2xvb2t1cEdldHRlcl9fKSB7XG4gICAgaWYgKHZhbHVlLl9fbG9va3VwR2V0dGVyX18oa2V5KSkge1xuICAgICAgaWYgKHZhbHVlLl9fbG9va3VwU2V0dGVyX18oa2V5KSkge1xuICAgICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlci9TZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh2YWx1ZS5fX2xvb2t1cFNldHRlcl9fKGtleSkpIHtcbiAgICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tTZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKHZpc2libGVLZXlzLmluZGV4T2Yoa2V5KSA8IDApIHtcbiAgICBuYW1lID0gJ1snICsga2V5ICsgJ10nO1xuICB9XG4gIGlmICghc3RyKSB7XG4gICAgaWYgKGN0eC5zZWVuLmluZGV4T2YodmFsdWVba2V5XSkgPCAwKSB7XG4gICAgICBpZiAocmVjdXJzZVRpbWVzID09PSBudWxsKSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgdmFsdWVba2V5XSwgbnVsbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIHZhbHVlW2tleV0sIHJlY3Vyc2VUaW1lcyAtIDEpO1xuICAgICAgfVxuICAgICAgaWYgKHN0ci5pbmRleE9mKCdcXG4nKSA+IC0xKSB7XG4gICAgICAgIGlmIChhcnJheSkge1xuICAgICAgICAgIHN0ciA9IHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKS5zdWJzdHIoMik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyID0gJ1xcbicgKyBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbQ2lyY3VsYXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKHR5cGVvZiBuYW1lID09PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChhcnJheSAmJiBrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBuYW1lID0gSlNPTi5zdHJpbmdpZnkoJycgKyBrZXkpO1xuICAgIGlmIChuYW1lLm1hdGNoKC9eXCIoW2EtekEtWl9dW2EtekEtWl8wLTldKilcIiQvKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEsIG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyheXCJ8XCIkKS9nLCBcIidcIik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ3N0cmluZycpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lICsgJzogJyArIHN0cjtcbn1cblxuXG5mdW5jdGlvbiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcykge1xuICB2YXIgbnVtTGluZXNFc3QgPSAwO1xuICB2YXIgbGVuZ3RoID0gb3V0cHV0LnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXIpIHtcbiAgICBudW1MaW5lc0VzdCsrO1xuICAgIGlmIChjdXIuaW5kZXhPZignXFxuJykgPj0gMCkgbnVtTGluZXNFc3QrKztcbiAgICByZXR1cm4gcHJldiArIGN1ci5sZW5ndGggKyAxO1xuICB9LCAwKTtcblxuICBpZiAobGVuZ3RoID4gNjApIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICtcbiAgICAgICAgICAgKGJhc2UgPT09ICcnID8gJycgOiBiYXNlICsgJ1xcbiAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIG91dHB1dC5qb2luKCcsXFxuICAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIGJyYWNlc1sxXTtcbiAgfVxuXG4gIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgJyAnICsgb3V0cHV0LmpvaW4oJywgJykgKyAnICcgKyBicmFjZXNbMV07XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkoYXIpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYXIpIHx8XG4gICAgICAgICAodHlwZW9mIGFyID09PSAnb2JqZWN0JyAmJiBvYmplY3RUb1N0cmluZyhhcikgPT09ICdbb2JqZWN0IEFycmF5XScpO1xufVxuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gdHlwZW9mIHJlID09PSAnb2JqZWN0JyAmJiBvYmplY3RUb1N0cmluZyhyZSkgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufVxuXG5mdW5jdGlvbiBpc0RhdGUoZCkge1xuICByZXR1cm4gdHlwZW9mIGQgPT09ICdvYmplY3QnICYmIG9iamVjdFRvU3RyaW5nKGQpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gdHlwZW9mIGUgPT09ICdvYmplY3QnICYmIG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nO1xufVxuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG4iLCIvKiFcbiAqIENoYWkgLSBmbGFnIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRhbmNpZXNcbiAqL1xuXG52YXIgaW5zcGVjdCA9IHJlcXVpcmUoJy4vaW5zcGVjdCcpO1xudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpO1xuXG4vKipcbiAqICMjIyAub2JqRGlzcGxheSAob2JqZWN0KVxuICpcbiAqIERldGVybWluZXMgaWYgYW4gb2JqZWN0IG9yIGFuIGFycmF5IG1hdGNoZXNcbiAqIGNyaXRlcmlhIHRvIGJlIGluc3BlY3RlZCBpbi1saW5lIGZvciBlcnJvclxuICogbWVzc2FnZXMgb3Igc2hvdWxkIGJlIHRydW5jYXRlZC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBqYXZhc2NyaXB0IG9iamVjdCB0byBpbnNwZWN0XG4gKiBAbmFtZSBvYmpEaXNwbGF5XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaikge1xuICB2YXIgc3RyID0gaW5zcGVjdChvYmopXG4gICAgLCB0eXBlID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG5cbiAgaWYgKGNvbmZpZy50cnVuY2F0ZVRocmVzaG9sZCAmJiBzdHIubGVuZ3RoID49IGNvbmZpZy50cnVuY2F0ZVRocmVzaG9sZCkge1xuICAgIGlmICh0eXBlID09PSAnW29iamVjdCBGdW5jdGlvbl0nKSB7XG4gICAgICByZXR1cm4gIW9iai5uYW1lIHx8IG9iai5uYW1lID09PSAnJ1xuICAgICAgICA/ICdbRnVuY3Rpb25dJ1xuICAgICAgICA6ICdbRnVuY3Rpb246ICcgKyBvYmoubmFtZSArICddJztcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgIHJldHVybiAnWyBBcnJheSgnICsgb2JqLmxlbmd0aCArICcpIF0nO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ1tvYmplY3QgT2JqZWN0XScpIHtcbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMob2JqKVxuICAgICAgICAsIGtzdHIgPSBrZXlzLmxlbmd0aCA+IDJcbiAgICAgICAgICA/IGtleXMuc3BsaWNlKDAsIDIpLmpvaW4oJywgJykgKyAnLCAuLi4nXG4gICAgICAgICAgOiBrZXlzLmpvaW4oJywgJyk7XG4gICAgICByZXR1cm4gJ3sgT2JqZWN0ICgnICsga3N0ciArICcpIH0nO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3RyO1xuICB9XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gb3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMjIyBvdmVyd3JpdGVDaGFpbmFibGVNZXRob2QgKGN0eCwgbmFtZSwgZm4pXG4gKlxuICogT3ZlcndpdGVzIGFuIGFscmVhZHkgZXhpc3RpbmcgY2hhaW5hYmxlIG1ldGhvZFxuICogYW5kIHByb3ZpZGVzIGFjY2VzcyB0byB0aGUgcHJldmlvdXMgZnVuY3Rpb24gb3JcbiAqIHByb3BlcnR5LiAgTXVzdCByZXR1cm4gZnVuY3Rpb25zIHRvIGJlIHVzZWQgZm9yXG4gKiBuYW1lLlxuICpcbiAqICAgICB1dGlscy5vdmVyd3JpdGVDaGFpbmFibGVNZXRob2QoY2hhaS5Bc3NlcnRpb24ucHJvdG90eXBlLCAnbGVuZ3RoJyxcbiAqICAgICAgIGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAqICAgICAgIH1cbiAqICAgICAsIGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAqICAgICAgIH1cbiAqICAgICApO1xuICpcbiAqIENhbiBhbHNvIGJlIGFjY2Vzc2VkIGRpcmVjdGx5IGZyb20gYGNoYWkuQXNzZXJ0aW9uYC5cbiAqXG4gKiAgICAgY2hhaS5Bc3NlcnRpb24ub3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kKCdmb28nLCBmbiwgZm4pO1xuICpcbiAqIFRoZW4gY2FuIGJlIHVzZWQgYXMgYW55IG90aGVyIGFzc2VydGlvbi5cbiAqXG4gKiAgICAgZXhwZWN0KG15Rm9vKS50by5oYXZlLmxlbmd0aCgzKTtcbiAqICAgICBleHBlY3QobXlGb28pLnRvLmhhdmUubGVuZ3RoLmFib3ZlKDMpO1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHggb2JqZWN0IHdob3NlIG1ldGhvZCAvIHByb3BlcnR5IGlzIHRvIGJlIG92ZXJ3cml0dGVuXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBvZiBtZXRob2QgLyBwcm9wZXJ0eSB0byBvdmVyd3JpdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG1ldGhvZCBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBmdW5jdGlvbiB0byBiZSB1c2VkIGZvciBuYW1lXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjaGFpbmluZ0JlaGF2aW9yIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGZ1bmN0aW9uIHRvIGJlIHVzZWQgZm9yIHByb3BlcnR5XG4gKiBAbmFtZSBvdmVyd3JpdGVDaGFpbmFibGVNZXRob2RcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY3R4LCBuYW1lLCBtZXRob2QsIGNoYWluaW5nQmVoYXZpb3IpIHtcbiAgdmFyIGNoYWluYWJsZUJlaGF2aW9yID0gY3R4Ll9fbWV0aG9kc1tuYW1lXTtcblxuICB2YXIgX2NoYWluaW5nQmVoYXZpb3IgPSBjaGFpbmFibGVCZWhhdmlvci5jaGFpbmluZ0JlaGF2aW9yO1xuICBjaGFpbmFibGVCZWhhdmlvci5jaGFpbmluZ0JlaGF2aW9yID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSBjaGFpbmluZ0JlaGF2aW9yKF9jaGFpbmluZ0JlaGF2aW9yKS5jYWxsKHRoaXMpO1xuICAgIHJldHVybiByZXN1bHQgPT09IHVuZGVmaW5lZCA/IHRoaXMgOiByZXN1bHQ7XG4gIH07XG5cbiAgdmFyIF9tZXRob2QgPSBjaGFpbmFibGVCZWhhdmlvci5tZXRob2Q7XG4gIGNoYWluYWJsZUJlaGF2aW9yLm1ldGhvZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzdWx0ID0gbWV0aG9kKF9tZXRob2QpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIHJlc3VsdCA9PT0gdW5kZWZpbmVkID8gdGhpcyA6IHJlc3VsdDtcbiAgfTtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBvdmVyd3JpdGVNZXRob2QgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIG92ZXJ3cml0ZU1ldGhvZCAoY3R4LCBuYW1lLCBmbilcbiAqXG4gKiBPdmVyd2l0ZXMgYW4gYWxyZWFkeSBleGlzdGluZyBtZXRob2QgYW5kIHByb3ZpZGVzXG4gKiBhY2Nlc3MgdG8gcHJldmlvdXMgZnVuY3Rpb24uIE11c3QgcmV0dXJuIGZ1bmN0aW9uXG4gKiB0byBiZSB1c2VkIGZvciBuYW1lLlxuICpcbiAqICAgICB1dGlscy5vdmVyd3JpdGVNZXRob2QoY2hhaS5Bc3NlcnRpb24ucHJvdG90eXBlLCAnZXF1YWwnLCBmdW5jdGlvbiAoX3N1cGVyKSB7XG4gKiAgICAgICByZXR1cm4gZnVuY3Rpb24gKHN0cikge1xuICogICAgICAgICB2YXIgb2JqID0gdXRpbHMuZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gKiAgICAgICAgIGlmIChvYmogaW5zdGFuY2VvZiBGb28pIHtcbiAqICAgICAgICAgICBuZXcgY2hhaS5Bc3NlcnRpb24ob2JqLnZhbHVlKS50by5lcXVhbChzdHIpO1xuICogICAgICAgICB9IGVsc2Uge1xuICogICAgICAgICAgIF9zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICogICAgICAgICB9XG4gKiAgICAgICB9XG4gKiAgICAgfSk7XG4gKlxuICogQ2FuIGFsc28gYmUgYWNjZXNzZWQgZGlyZWN0bHkgZnJvbSBgY2hhaS5Bc3NlcnRpb25gLlxuICpcbiAqICAgICBjaGFpLkFzc2VydGlvbi5vdmVyd3JpdGVNZXRob2QoJ2ZvbycsIGZuKTtcbiAqXG4gKiBUaGVuIGNhbiBiZSB1c2VkIGFzIGFueSBvdGhlciBhc3NlcnRpb24uXG4gKlxuICogICAgIGV4cGVjdChteUZvbykudG8uZXF1YWwoJ2JhcicpO1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHggb2JqZWN0IHdob3NlIG1ldGhvZCBpcyB0byBiZSBvdmVyd3JpdHRlblxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgb2YgbWV0aG9kIHRvIG92ZXJ3cml0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gbWV0aG9kIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGZ1bmN0aW9uIHRvIGJlIHVzZWQgZm9yIG5hbWVcbiAqIEBuYW1lIG92ZXJ3cml0ZU1ldGhvZFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjdHgsIG5hbWUsIG1ldGhvZCkge1xuICB2YXIgX21ldGhvZCA9IGN0eFtuYW1lXVxuICAgICwgX3N1cGVyID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfTtcblxuICBpZiAoX21ldGhvZCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgX21ldGhvZClcbiAgICBfc3VwZXIgPSBfbWV0aG9kO1xuXG4gIGN0eFtuYW1lXSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzdWx0ID0gbWV0aG9kKF9zdXBlcikuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQgPyB0aGlzIDogcmVzdWx0O1xuICB9XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gb3ZlcndyaXRlUHJvcGVydHkgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIG92ZXJ3cml0ZVByb3BlcnR5IChjdHgsIG5hbWUsIGZuKVxuICpcbiAqIE92ZXJ3aXRlcyBhbiBhbHJlYWR5IGV4aXN0aW5nIHByb3BlcnR5IGdldHRlciBhbmQgcHJvdmlkZXNcbiAqIGFjY2VzcyB0byBwcmV2aW91cyB2YWx1ZS4gTXVzdCByZXR1cm4gZnVuY3Rpb24gdG8gdXNlIGFzIGdldHRlci5cbiAqXG4gKiAgICAgdXRpbHMub3ZlcndyaXRlUHJvcGVydHkoY2hhaS5Bc3NlcnRpb24ucHJvdG90eXBlLCAnb2snLCBmdW5jdGlvbiAoX3N1cGVyKSB7XG4gKiAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICogICAgICAgICB2YXIgb2JqID0gdXRpbHMuZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gKiAgICAgICAgIGlmIChvYmogaW5zdGFuY2VvZiBGb28pIHtcbiAqICAgICAgICAgICBuZXcgY2hhaS5Bc3NlcnRpb24ob2JqLm5hbWUpLnRvLmVxdWFsKCdiYXInKTtcbiAqICAgICAgICAgfSBlbHNlIHtcbiAqICAgICAgICAgICBfc3VwZXIuY2FsbCh0aGlzKTtcbiAqICAgICAgICAgfVxuICogICAgICAgfVxuICogICAgIH0pO1xuICpcbiAqXG4gKiBDYW4gYWxzbyBiZSBhY2Nlc3NlZCBkaXJlY3RseSBmcm9tIGBjaGFpLkFzc2VydGlvbmAuXG4gKlxuICogICAgIGNoYWkuQXNzZXJ0aW9uLm92ZXJ3cml0ZVByb3BlcnR5KCdmb28nLCBmbik7XG4gKlxuICogVGhlbiBjYW4gYmUgdXNlZCBhcyBhbnkgb3RoZXIgYXNzZXJ0aW9uLlxuICpcbiAqICAgICBleHBlY3QobXlGb28pLnRvLmJlLm9rO1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHggb2JqZWN0IHdob3NlIHByb3BlcnR5IGlzIHRvIGJlIG92ZXJ3cml0dGVuXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBvZiBwcm9wZXJ0eSB0byBvdmVyd3JpdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGdldHRlciBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBnZXR0ZXIgZnVuY3Rpb24gdG8gYmUgdXNlZCBmb3IgbmFtZVxuICogQG5hbWUgb3ZlcndyaXRlUHJvcGVydHlcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY3R4LCBuYW1lLCBnZXR0ZXIpIHtcbiAgdmFyIF9nZXQgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGN0eCwgbmFtZSlcbiAgICAsIF9zdXBlciA9IGZ1bmN0aW9uICgpIHt9O1xuXG4gIGlmIChfZ2V0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBfZ2V0LmdldClcbiAgICBfc3VwZXIgPSBfZ2V0LmdldFxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjdHgsIG5hbWUsXG4gICAgeyBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IGdldHRlcihfc3VwZXIpLmNhbGwodGhpcyk7XG4gICAgICAgIHJldHVybiByZXN1bHQgPT09IHVuZGVmaW5lZCA/IHRoaXMgOiByZXN1bHQ7XG4gICAgICB9XG4gICAgLCBjb25maWd1cmFibGU6IHRydWVcbiAgfSk7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gdGVzdCB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kYW5jaWVzXG4gKi9cblxudmFyIGZsYWcgPSByZXF1aXJlKCcuL2ZsYWcnKTtcblxuLyoqXG4gKiAjIHRlc3Qob2JqZWN0LCBleHByZXNzaW9uKVxuICpcbiAqIFRlc3QgYW5kIG9iamVjdCBmb3IgZXhwcmVzc2lvbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IChjb25zdHJ1Y3RlZCBBc3NlcnRpb24pXG4gKiBAcGFyYW0ge0FyZ3VtZW50c30gY2hhaS5Bc3NlcnRpb24ucHJvdG90eXBlLmFzc2VydCBhcmd1bWVudHNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmosIGFyZ3MpIHtcbiAgdmFyIG5lZ2F0ZSA9IGZsYWcob2JqLCAnbmVnYXRlJylcbiAgICAsIGV4cHIgPSBhcmdzWzBdO1xuICByZXR1cm4gbmVnYXRlID8gIWV4cHIgOiBleHByO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIHRyYW5zZmVyRmxhZ3MgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIHRyYW5zZmVyRmxhZ3MoYXNzZXJ0aW9uLCBvYmplY3QsIGluY2x1ZGVBbGwgPSB0cnVlKVxuICpcbiAqIFRyYW5zZmVyIGFsbCB0aGUgZmxhZ3MgZm9yIGBhc3NlcnRpb25gIHRvIGBvYmplY3RgLiBJZlxuICogYGluY2x1ZGVBbGxgIGlzIHNldCB0byBgZmFsc2VgLCB0aGVuIHRoZSBiYXNlIENoYWlcbiAqIGFzc2VydGlvbiBmbGFncyAobmFtZWx5IGBvYmplY3RgLCBgc3NmaWAsIGFuZCBgbWVzc2FnZWApXG4gKiB3aWxsIG5vdCBiZSB0cmFuc2ZlcnJlZC5cbiAqXG4gKlxuICogICAgIHZhciBuZXdBc3NlcnRpb24gPSBuZXcgQXNzZXJ0aW9uKCk7XG4gKiAgICAgdXRpbHMudHJhbnNmZXJGbGFncyhhc3NlcnRpb24sIG5ld0Fzc2VydGlvbik7XG4gKlxuICogICAgIHZhciBhbm90aGVyQXNzZXJpdG9uID0gbmV3IEFzc2VydGlvbihteU9iaik7XG4gKiAgICAgdXRpbHMudHJhbnNmZXJGbGFncyhhc3NlcnRpb24sIGFub3RoZXJBc3NlcnRpb24sIGZhbHNlKTtcbiAqXG4gKiBAcGFyYW0ge0Fzc2VydGlvbn0gYXNzZXJ0aW9uIHRoZSBhc3NlcnRpb24gdG8gdHJhbnNmZXIgdGhlIGZsYWdzIGZyb21cbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgdGhlIG9iamVjdCB0byB0cmFuc2ZlciB0aGUgZmxhZ3MgdG9vOyB1c3VhbGx5IGEgbmV3IGFzc2VydGlvblxuICogQHBhcmFtIHtCb29sZWFufSBpbmNsdWRlQWxsXG4gKiBAbmFtZSBnZXRBbGxGbGFnc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoYXNzZXJ0aW9uLCBvYmplY3QsIGluY2x1ZGVBbGwpIHtcbiAgdmFyIGZsYWdzID0gYXNzZXJ0aW9uLl9fZmxhZ3MgfHwgKGFzc2VydGlvbi5fX2ZsYWdzID0gT2JqZWN0LmNyZWF0ZShudWxsKSk7XG5cbiAgaWYgKCFvYmplY3QuX19mbGFncykge1xuICAgIG9iamVjdC5fX2ZsYWdzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfVxuXG4gIGluY2x1ZGVBbGwgPSBhcmd1bWVudHMubGVuZ3RoID09PSAzID8gaW5jbHVkZUFsbCA6IHRydWU7XG5cbiAgZm9yICh2YXIgZmxhZyBpbiBmbGFncykge1xuICAgIGlmIChpbmNsdWRlQWxsIHx8XG4gICAgICAgIChmbGFnICE9PSAnb2JqZWN0JyAmJiBmbGFnICE9PSAnc3NmaScgJiYgZmxhZyAhPSAnbWVzc2FnZScpKSB7XG4gICAgICBvYmplY3QuX19mbGFnc1tmbGFnXSA9IGZsYWdzW2ZsYWddO1xuICAgIH1cbiAgfVxufTtcbiIsIi8qIVxuICogQ2hhaSAtIHR5cGUgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogRGV0ZWN0YWJsZSBqYXZhc2NyaXB0IG5hdGl2ZXNcbiAqL1xuXG52YXIgbmF0aXZlcyA9IHtcbiAgICAnW29iamVjdCBBcmd1bWVudHNdJzogJ2FyZ3VtZW50cydcbiAgLCAnW29iamVjdCBBcnJheV0nOiAnYXJyYXknXG4gICwgJ1tvYmplY3QgRGF0ZV0nOiAnZGF0ZSdcbiAgLCAnW29iamVjdCBGdW5jdGlvbl0nOiAnZnVuY3Rpb24nXG4gICwgJ1tvYmplY3QgTnVtYmVyXSc6ICdudW1iZXInXG4gICwgJ1tvYmplY3QgUmVnRXhwXSc6ICdyZWdleHAnXG4gICwgJ1tvYmplY3QgU3RyaW5nXSc6ICdzdHJpbmcnXG59O1xuXG4vKipcbiAqICMjIyB0eXBlKG9iamVjdClcbiAqXG4gKiBCZXR0ZXIgaW1wbGVtZW50YXRpb24gb2YgYHR5cGVvZmAgZGV0ZWN0aW9uIHRoYXQgY2FuXG4gKiBiZSB1c2VkIGNyb3NzLWJyb3dzZXIuIEhhbmRsZXMgdGhlIGluY29uc2lzdGVuY2llcyBvZlxuICogQXJyYXksIGBudWxsYCwgYW5kIGB1bmRlZmluZWRgIGRldGVjdGlvbi5cbiAqXG4gKiAgICAgdXRpbHMudHlwZSh7fSkgLy8gJ29iamVjdCdcbiAqICAgICB1dGlscy50eXBlKG51bGwpIC8vIGBudWxsJ1xuICogICAgIHV0aWxzLnR5cGUodW5kZWZpbmVkKSAvLyBgdW5kZWZpbmVkYFxuICogICAgIHV0aWxzLnR5cGUoW10pIC8vIGBhcnJheWBcbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmplY3QgdG8gZGV0ZWN0IHR5cGUgb2ZcbiAqIEBuYW1lIHR5cGVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaikge1xuICB2YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG4gIGlmIChuYXRpdmVzW3N0cl0pIHJldHVybiBuYXRpdmVzW3N0cl07XG4gIGlmIChvYmogPT09IG51bGwpIHJldHVybiAnbnVsbCc7XG4gIGlmIChvYmogPT09IHVuZGVmaW5lZCkgcmV0dXJuICd1bmRlZmluZWQnO1xuICBpZiAob2JqID09PSBPYmplY3Qob2JqKSkgcmV0dXJuICdvYmplY3QnO1xuICByZXR1cm4gdHlwZW9mIG9iajtcbn07XG4iLCIvKiFcbiAqIGFzc2VydGlvbi1lcnJvclxuICogQ29weXJpZ2h0KGMpIDIwMTMgSmFrZSBMdWVyIDxqYWtlQHF1YWxpYW5jeS5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIFJldHVybiBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBjb3B5IHByb3BlcnRpZXMgZnJvbVxuICogb25lIG9iamVjdCB0byBhbm90aGVyIGV4Y2x1ZGluZyBhbnkgb3JpZ2luYWxseVxuICogbGlzdGVkLiBSZXR1cm5lZCBmdW5jdGlvbiB3aWxsIGNyZWF0ZSBhIG5ldyBge31gLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBleGNsdWRlZCBwcm9wZXJ0aWVzIC4uLlxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZnVuY3Rpb24gZXhjbHVkZSAoKSB7XG4gIHZhciBleGNsdWRlcyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICBmdW5jdGlvbiBleGNsdWRlUHJvcHMgKHJlcywgb2JqKSB7XG4gICAgT2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIGlmICghfmV4Y2x1ZGVzLmluZGV4T2Yoa2V5KSkgcmVzW2tleV0gPSBvYmpba2V5XTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiBleHRlbmRFeGNsdWRlICgpIHtcbiAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxuICAgICAgLCBpID0gMFxuICAgICAgLCByZXMgPSB7fTtcblxuICAgIGZvciAoOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgZXhjbHVkZVByb3BzKHJlcywgYXJnc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbiAgfTtcbn07XG5cbi8qIVxuICogUHJpbWFyeSBFeHBvcnRzXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBBc3NlcnRpb25FcnJvcjtcblxuLyoqXG4gKiAjIyMgQXNzZXJ0aW9uRXJyb3JcbiAqXG4gKiBBbiBleHRlbnNpb24gb2YgdGhlIEphdmFTY3JpcHQgYEVycm9yYCBjb25zdHJ1Y3RvciBmb3JcbiAqIGFzc2VydGlvbiBhbmQgdmFsaWRhdGlvbiBzY2VuYXJpb3MuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wZXJ0aWVzIHRvIGluY2x1ZGUgKG9wdGlvbmFsKVxuICogQHBhcmFtIHtjYWxsZWV9IHN0YXJ0IHN0YWNrIGZ1bmN0aW9uIChvcHRpb25hbClcbiAqL1xuXG5mdW5jdGlvbiBBc3NlcnRpb25FcnJvciAobWVzc2FnZSwgX3Byb3BzLCBzc2YpIHtcbiAgdmFyIGV4dGVuZCA9IGV4Y2x1ZGUoJ25hbWUnLCAnbWVzc2FnZScsICdzdGFjaycsICdjb25zdHJ1Y3RvcicsICd0b0pTT04nKVxuICAgICwgcHJvcHMgPSBleHRlbmQoX3Byb3BzIHx8IHt9KTtcblxuICAvLyBkZWZhdWx0IHZhbHVlc1xuICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlIHx8ICdVbnNwZWNpZmllZCBBc3NlcnRpb25FcnJvcic7XG4gIHRoaXMuc2hvd0RpZmYgPSBmYWxzZTtcblxuICAvLyBjb3B5IGZyb20gcHJvcGVydGllc1xuICBmb3IgKHZhciBrZXkgaW4gcHJvcHMpIHtcbiAgICB0aGlzW2tleV0gPSBwcm9wc1trZXldO1xuICB9XG5cbiAgLy8gY2FwdHVyZSBzdGFjayB0cmFjZVxuICBzc2YgPSBzc2YgfHwgYXJndW1lbnRzLmNhbGxlZTtcbiAgaWYgKHNzZiAmJiBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHNzZik7XG4gIH1cbn1cblxuLyohXG4gKiBJbmhlcml0IGZyb20gRXJyb3IucHJvdG90eXBlXG4gKi9cblxuQXNzZXJ0aW9uRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuXG4vKiFcbiAqIFN0YXRpY2FsbHkgc2V0IG5hbWVcbiAqL1xuXG5Bc3NlcnRpb25FcnJvci5wcm90b3R5cGUubmFtZSA9ICdBc3NlcnRpb25FcnJvcic7XG5cbi8qIVxuICogRW5zdXJlIGNvcnJlY3QgY29uc3RydWN0b3JcbiAqL1xuXG5Bc3NlcnRpb25FcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBBc3NlcnRpb25FcnJvcjtcblxuLyoqXG4gKiBBbGxvdyBlcnJvcnMgdG8gYmUgY29udmVydGVkIHRvIEpTT04gZm9yIHN0YXRpYyB0cmFuc2Zlci5cbiAqXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGluY2x1ZGUgc3RhY2sgKGRlZmF1bHQ6IGB0cnVlYClcbiAqIEByZXR1cm4ge09iamVjdH0gb2JqZWN0IHRoYXQgY2FuIGJlIGBKU09OLnN0cmluZ2lmeWBcbiAqL1xuXG5Bc3NlcnRpb25FcnJvci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gKHN0YWNrKSB7XG4gIHZhciBleHRlbmQgPSBleGNsdWRlKCdjb25zdHJ1Y3RvcicsICd0b0pTT04nLCAnc3RhY2snKVxuICAgICwgcHJvcHMgPSBleHRlbmQoeyBuYW1lOiB0aGlzLm5hbWUgfSwgdGhpcyk7XG5cbiAgLy8gaW5jbHVkZSBzdGFjayBpZiBleGlzdHMgYW5kIG5vdCB0dXJuZWQgb2ZmXG4gIGlmIChmYWxzZSAhPT0gc3RhY2sgJiYgdGhpcy5zdGFjaykge1xuICAgIHByb3BzLnN0YWNrID0gdGhpcy5zdGFjaztcbiAgfVxuXG4gIHJldHVybiBwcm9wcztcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2VxbCcpO1xuIiwiLyohXG4gKiBkZWVwLWVxbFxuICogQ29weXJpZ2h0KGMpIDIwMTMgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXNcbiAqL1xuXG52YXIgdHlwZSA9IHJlcXVpcmUoJ3R5cGUtZGV0ZWN0Jyk7XG5cbi8qIVxuICogQnVmZmVyLmlzQnVmZmVyIGJyb3dzZXIgc2hpbVxuICovXG5cbnZhciBCdWZmZXI7XG50cnkgeyBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7IH1cbmNhdGNoKGV4KSB7XG4gIEJ1ZmZlciA9IHt9O1xuICBCdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGZhbHNlOyB9XG59XG5cbi8qIVxuICogUHJpbWFyeSBFeHBvcnRcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRlZXBFcXVhbDtcblxuLyoqXG4gKiBBc3NlcnQgc3VwZXItc3RyaWN0IChlZ2FsKSBlcXVhbGl0eSBiZXR3ZWVuXG4gKiB0d28gb2JqZWN0cyBvZiBhbnkgdHlwZS5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBhXG4gKiBAcGFyYW0ge01peGVkfSBiXG4gKiBAcGFyYW0ge0FycmF5fSBtZW1vaXNlZCAob3B0aW9uYWwpXG4gKiBAcmV0dXJuIHtCb29sZWFufSBlcXVhbCBtYXRjaFxuICovXG5cbmZ1bmN0aW9uIGRlZXBFcXVhbChhLCBiLCBtKSB7XG4gIGlmIChzYW1lVmFsdWUoYSwgYikpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIGlmICgnZGF0ZScgPT09IHR5cGUoYSkpIHtcbiAgICByZXR1cm4gZGF0ZUVxdWFsKGEsIGIpO1xuICB9IGVsc2UgaWYgKCdyZWdleHAnID09PSB0eXBlKGEpKSB7XG4gICAgcmV0dXJuIHJlZ2V4cEVxdWFsKGEsIGIpO1xuICB9IGVsc2UgaWYgKEJ1ZmZlci5pc0J1ZmZlcihhKSkge1xuICAgIHJldHVybiBidWZmZXJFcXVhbChhLCBiKTtcbiAgfSBlbHNlIGlmICgnYXJndW1lbnRzJyA9PT0gdHlwZShhKSkge1xuICAgIHJldHVybiBhcmd1bWVudHNFcXVhbChhLCBiLCBtKTtcbiAgfSBlbHNlIGlmICghdHlwZUVxdWFsKGEsIGIpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9IGVsc2UgaWYgKCgnb2JqZWN0JyAhPT0gdHlwZShhKSAmJiAnb2JqZWN0JyAhPT0gdHlwZShiKSlcbiAgJiYgKCdhcnJheScgIT09IHR5cGUoYSkgJiYgJ2FycmF5JyAhPT0gdHlwZShiKSkpIHtcbiAgICByZXR1cm4gc2FtZVZhbHVlKGEsIGIpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBvYmplY3RFcXVhbChhLCBiLCBtKTtcbiAgfVxufVxuXG4vKiFcbiAqIFN0cmljdCAoZWdhbCkgZXF1YWxpdHkgdGVzdC4gRW5zdXJlcyB0aGF0IE5hTiBhbHdheXNcbiAqIGVxdWFscyBOYU4gYW5kIGAtMGAgZG9lcyBub3QgZXF1YWwgYCswYC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBhXG4gKiBAcGFyYW0ge01peGVkfSBiXG4gKiBAcmV0dXJuIHtCb29sZWFufSBlcXVhbCBtYXRjaFxuICovXG5cbmZ1bmN0aW9uIHNhbWVWYWx1ZShhLCBiKSB7XG4gIGlmIChhID09PSBiKSByZXR1cm4gYSAhPT0gMCB8fCAxIC8gYSA9PT0gMSAvIGI7XG4gIHJldHVybiBhICE9PSBhICYmIGIgIT09IGI7XG59XG5cbi8qIVxuICogQ29tcGFyZSB0aGUgdHlwZXMgb2YgdHdvIGdpdmVuIG9iamVjdHMgYW5kXG4gKiByZXR1cm4gaWYgdGhleSBhcmUgZXF1YWwuIE5vdGUgdGhhdCBhbiBBcnJheVxuICogaGFzIGEgdHlwZSBvZiBgYXJyYXlgIChub3QgYG9iamVjdGApIGFuZCBhcmd1bWVudHNcbiAqIGhhdmUgYSB0eXBlIG9mIGBhcmd1bWVudHNgIChub3QgYGFycmF5YC9gb2JqZWN0YCkuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gYVxuICogQHBhcmFtIHtNaXhlZH0gYlxuICogQHJldHVybiB7Qm9vbGVhbn0gcmVzdWx0XG4gKi9cblxuZnVuY3Rpb24gdHlwZUVxdWFsKGEsIGIpIHtcbiAgcmV0dXJuIHR5cGUoYSkgPT09IHR5cGUoYik7XG59XG5cbi8qIVxuICogQ29tcGFyZSB0d28gRGF0ZSBvYmplY3RzIGJ5IGFzc2VydGluZyB0aGF0XG4gKiB0aGUgdGltZSB2YWx1ZXMgYXJlIGVxdWFsIHVzaW5nIGBzYXZlVmFsdWVgLlxuICpcbiAqIEBwYXJhbSB7RGF0ZX0gYVxuICogQHBhcmFtIHtEYXRlfSBiXG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqL1xuXG5mdW5jdGlvbiBkYXRlRXF1YWwoYSwgYikge1xuICBpZiAoJ2RhdGUnICE9PSB0eXBlKGIpKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBzYW1lVmFsdWUoYS5nZXRUaW1lKCksIGIuZ2V0VGltZSgpKTtcbn1cblxuLyohXG4gKiBDb21wYXJlIHR3byByZWd1bGFyIGV4cHJlc3Npb25zIGJ5IGNvbnZlcnRpbmcgdGhlbVxuICogdG8gc3RyaW5nIGFuZCBjaGVja2luZyBmb3IgYHNhbWVWYWx1ZWAuXG4gKlxuICogQHBhcmFtIHtSZWdFeHB9IGFcbiAqIEBwYXJhbSB7UmVnRXhwfSBiXG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqL1xuXG5mdW5jdGlvbiByZWdleHBFcXVhbChhLCBiKSB7XG4gIGlmICgncmVnZXhwJyAhPT0gdHlwZShiKSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gc2FtZVZhbHVlKGEudG9TdHJpbmcoKSwgYi50b1N0cmluZygpKTtcbn1cblxuLyohXG4gKiBBc3NlcnQgZGVlcCBlcXVhbGl0eSBvZiB0d28gYGFyZ3VtZW50c2Agb2JqZWN0cy5cbiAqIFVuZm9ydHVuYXRlbHksIHRoZXNlIG11c3QgYmUgc2xpY2VkIHRvIGFycmF5c1xuICogcHJpb3IgdG8gdGVzdCB0byBlbnN1cmUgbm8gYmFkIGJlaGF2aW9yLlxuICpcbiAqIEBwYXJhbSB7QXJndW1lbnRzfSBhXG4gKiBAcGFyYW0ge0FyZ3VtZW50c30gYlxuICogQHBhcmFtIHtBcnJheX0gbWVtb2l6ZSAob3B0aW9uYWwpXG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqL1xuXG5mdW5jdGlvbiBhcmd1bWVudHNFcXVhbChhLCBiLCBtKSB7XG4gIGlmICgnYXJndW1lbnRzJyAhPT0gdHlwZShiKSkgcmV0dXJuIGZhbHNlO1xuICBhID0gW10uc2xpY2UuY2FsbChhKTtcbiAgYiA9IFtdLnNsaWNlLmNhbGwoYik7XG4gIHJldHVybiBkZWVwRXF1YWwoYSwgYiwgbSk7XG59XG5cbi8qIVxuICogR2V0IGVudW1lcmFibGUgcHJvcGVydGllcyBvZiBhIGdpdmVuIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gYVxuICogQHJldHVybiB7QXJyYXl9IHByb3BlcnR5IG5hbWVzXG4gKi9cblxuZnVuY3Rpb24gZW51bWVyYWJsZShhKSB7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIGEpIHJlcy5wdXNoKGtleSk7XG4gIHJldHVybiByZXM7XG59XG5cbi8qIVxuICogU2ltcGxlIGVxdWFsaXR5IGZvciBmbGF0IGl0ZXJhYmxlIG9iamVjdHNcbiAqIHN1Y2ggYXMgQXJyYXlzIG9yIE5vZGUuanMgYnVmZmVycy5cbiAqXG4gKiBAcGFyYW0ge0l0ZXJhYmxlfSBhXG4gKiBAcGFyYW0ge0l0ZXJhYmxlfSBiXG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqL1xuXG5mdW5jdGlvbiBpdGVyYWJsZUVxdWFsKGEsIGIpIHtcbiAgaWYgKGEubGVuZ3RoICE9PSAgYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICB2YXIgaSA9IDA7XG4gIHZhciBtYXRjaCA9IHRydWU7XG5cbiAgZm9yICg7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcbiAgICAgIG1hdGNoID0gZmFsc2U7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWF0Y2g7XG59XG5cbi8qIVxuICogRXh0ZW5zaW9uIHRvIGBpdGVyYWJsZUVxdWFsYCBzcGVjaWZpY2FsbHlcbiAqIGZvciBOb2RlLmpzIEJ1ZmZlcnMuXG4gKlxuICogQHBhcmFtIHtCdWZmZXJ9IGFcbiAqIEBwYXJhbSB7TWl4ZWR9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIGJ1ZmZlckVxdWFsKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIGl0ZXJhYmxlRXF1YWwoYSwgYik7XG59XG5cbi8qIVxuICogQmxvY2sgZm9yIGBvYmplY3RFcXVhbGAgZW5zdXJpbmcgbm9uLWV4aXN0aW5nXG4gKiB2YWx1ZXMgZG9uJ3QgZ2V0IGluLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IG9iamVjdFxuICogQHJldHVybiB7Qm9vbGVhbn0gcmVzdWx0XG4gKi9cblxuZnVuY3Rpb24gaXNWYWx1ZShhKSB7XG4gIHJldHVybiBhICE9PSBudWxsICYmIGEgIT09IHVuZGVmaW5lZDtcbn1cblxuLyohXG4gKiBSZWN1cnNpdmVseSBjaGVjayB0aGUgZXF1YWxpdHkgb2YgdHdvIG9iamVjdHMuXG4gKiBPbmNlIGJhc2ljIHNhbWVuZXNzIGhhcyBiZWVuIGVzdGFibGlzaGVkIGl0IHdpbGxcbiAqIGRlZmVyIHRvIGBkZWVwRXF1YWxgIGZvciBlYWNoIGVudW1lcmFibGUga2V5XG4gKiBpbiB0aGUgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IGFcbiAqIEBwYXJhbSB7TWl4ZWR9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIG9iamVjdEVxdWFsKGEsIGIsIG0pIHtcbiAgaWYgKCFpc1ZhbHVlKGEpIHx8ICFpc1ZhbHVlKGIpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGEucHJvdG90eXBlICE9PSBiLnByb3RvdHlwZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZhciBpO1xuICBpZiAobSkge1xuICAgIGZvciAoaSA9IDA7IGkgPCBtLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoKG1baV1bMF0gPT09IGEgJiYgbVtpXVsxXSA9PT0gYilcbiAgICAgIHx8ICAobVtpXVswXSA9PT0gYiAmJiBtW2ldWzFdID09PSBhKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgbSA9IFtdO1xuICB9XG5cbiAgdHJ5IHtcbiAgICB2YXIga2EgPSBlbnVtZXJhYmxlKGEpO1xuICAgIHZhciBrYiA9IGVudW1lcmFibGUoYik7XG4gIH0gY2F0Y2ggKGV4KSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAga2Euc29ydCgpO1xuICBrYi5zb3J0KCk7XG5cbiAgaWYgKCFpdGVyYWJsZUVxdWFsKGthLCBrYikpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBtLnB1c2goWyBhLCBiIF0pO1xuXG4gIHZhciBrZXk7XG4gIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAga2V5ID0ga2FbaV07XG4gICAgaWYgKCFkZWVwRXF1YWwoYVtrZXldLCBiW2tleV0sIG0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL3R5cGUnKTtcbiIsIi8qIVxuICogdHlwZS1kZXRlY3RcbiAqIENvcHlyaWdodChjKSAyMDEzIGpha2UgbHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyohXG4gKiBQcmltYXJ5IEV4cG9ydHNcbiAqL1xuXG52YXIgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gZ2V0VHlwZTtcblxuLyohXG4gKiBEZXRlY3RhYmxlIGphdmFzY3JpcHQgbmF0aXZlc1xuICovXG5cbnZhciBuYXRpdmVzID0ge1xuICAgICdbb2JqZWN0IEFycmF5XSc6ICdhcnJheSdcbiAgLCAnW29iamVjdCBSZWdFeHBdJzogJ3JlZ2V4cCdcbiAgLCAnW29iamVjdCBGdW5jdGlvbl0nOiAnZnVuY3Rpb24nXG4gICwgJ1tvYmplY3QgQXJndW1lbnRzXSc6ICdhcmd1bWVudHMnXG4gICwgJ1tvYmplY3QgRGF0ZV0nOiAnZGF0ZSdcbn07XG5cbi8qKlxuICogIyMjIHR5cGVPZiAob2JqKVxuICpcbiAqIFVzZSBzZXZlcmFsIGRpZmZlcmVudCB0ZWNobmlxdWVzIHRvIGRldGVybWluZVxuICogdGhlIHR5cGUgb2Ygb2JqZWN0IGJlaW5nIHRlc3RlZC5cbiAqXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqZWN0XG4gKiBAcmV0dXJuIHtTdHJpbmd9IG9iamVjdCB0eXBlXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGdldFR5cGUgKG9iaikge1xuICB2YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG4gIGlmIChuYXRpdmVzW3N0cl0pIHJldHVybiBuYXRpdmVzW3N0cl07XG4gIGlmIChvYmogPT09IG51bGwpIHJldHVybiAnbnVsbCc7XG4gIGlmIChvYmogPT09IHVuZGVmaW5lZCkgcmV0dXJuICd1bmRlZmluZWQnO1xuICBpZiAob2JqID09PSBPYmplY3Qob2JqKSkgcmV0dXJuICdvYmplY3QnO1xuICByZXR1cm4gdHlwZW9mIG9iajtcbn1cblxuZXhwb3J0cy5MaWJyYXJ5ID0gTGlicmFyeTtcblxuLyoqXG4gKiAjIyMgTGlicmFyeVxuICpcbiAqIENyZWF0ZSBhIHJlcG9zaXRvcnkgZm9yIGN1c3RvbSB0eXBlIGRldGVjdGlvbi5cbiAqXG4gKiBgYGBqc1xuICogdmFyIGxpYiA9IG5ldyB0eXBlLkxpYnJhcnk7XG4gKiBgYGBcbiAqXG4gKi9cblxuZnVuY3Rpb24gTGlicmFyeSAoKSB7XG4gIHRoaXMudGVzdHMgPSB7fTtcbn1cblxuLyoqXG4gKiAjIyMjIC5vZiAob2JqKVxuICpcbiAqIEV4cG9zZSByZXBsYWNlbWVudCBgdHlwZW9mYCBkZXRlY3Rpb24gdG8gdGhlIGxpYnJhcnkuXG4gKlxuICogYGBganNcbiAqIGlmICgnc3RyaW5nJyA9PT0gbGliLm9mKCdoZWxsbyB3b3JsZCcpKSB7XG4gKiAgIC8vIC4uLlxuICogfVxuICogYGBgXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqZWN0IHRvIHRlc3RcbiAqIEByZXR1cm4ge1N0cmluZ30gdHlwZVxuICovXG5cbkxpYnJhcnkucHJvdG90eXBlLm9mID0gZ2V0VHlwZTtcblxuLyoqXG4gKiAjIyMjIC5kZWZpbmUgKHR5cGUsIHRlc3QpXG4gKlxuICogQWRkIGEgdGVzdCB0byBmb3IgdGhlIGAudGVzdCgpYCBhc3NlcnRpb24uXG4gKlxuICogQ2FuIGJlIGRlZmluZWQgYXMgYSByZWd1bGFyIGV4cHJlc3Npb246XG4gKlxuICogYGBganNcbiAqIGxpYi5kZWZpbmUoJ2ludCcsIC9eWzAtOV0rJC8pO1xuICogYGBgXG4gKlxuICogLi4uIG9yIGFzIGEgZnVuY3Rpb246XG4gKlxuICogYGBganNcbiAqIGxpYi5kZWZpbmUoJ2JsbicsIGZ1bmN0aW9uIChvYmopIHtcbiAqICAgaWYgKCdib29sZWFuJyA9PT0gbGliLm9mKG9iaikpIHJldHVybiB0cnVlO1xuICogICB2YXIgYmxucyA9IFsgJ3llcycsICdubycsICd0cnVlJywgJ2ZhbHNlJywgMSwgMCBdO1xuICogICBpZiAoJ3N0cmluZycgPT09IGxpYi5vZihvYmopKSBvYmogPSBvYmoudG9Mb3dlckNhc2UoKTtcbiAqICAgcmV0dXJuICEhIH5ibG5zLmluZGV4T2Yob2JqKTtcbiAqIH0pO1xuICogYGBgXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqIEBwYXJhbSB7UmVnRXhwfEZ1bmN0aW9ufSB0ZXN0XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbkxpYnJhcnkucHJvdG90eXBlLmRlZmluZSA9IGZ1bmN0aW9uICh0eXBlLCB0ZXN0KSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSByZXR1cm4gdGhpcy50ZXN0c1t0eXBlXTtcbiAgdGhpcy50ZXN0c1t0eXBlXSA9IHRlc3Q7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiAjIyMjIC50ZXN0IChvYmosIHRlc3QpXG4gKlxuICogQXNzZXJ0IHRoYXQgYW4gb2JqZWN0IGlzIG9mIHR5cGUuIFdpbGwgZmlyc3RcbiAqIGNoZWNrIG5hdGl2ZXMsIGFuZCBpZiB0aGF0IGRvZXMgbm90IHBhc3MgaXQgd2lsbFxuICogdXNlIHRoZSB1c2VyIGRlZmluZWQgY3VzdG9tIHRlc3RzLlxuICpcbiAqIGBgYGpzXG4gKiBhc3NlcnQobGliLnRlc3QoJzEnLCAnaW50JykpO1xuICogYXNzZXJ0KGxpYi50ZXN0KCd5ZXMnLCAnYmxuJykpO1xuICogYGBgXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqZWN0XG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQHJldHVybiB7Qm9vbGVhbn0gcmVzdWx0XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbkxpYnJhcnkucHJvdG90eXBlLnRlc3QgPSBmdW5jdGlvbiAob2JqLCB0eXBlKSB7XG4gIGlmICh0eXBlID09PSBnZXRUeXBlKG9iaikpIHJldHVybiB0cnVlO1xuICB2YXIgdGVzdCA9IHRoaXMudGVzdHNbdHlwZV07XG5cbiAgaWYgKHRlc3QgJiYgJ3JlZ2V4cCcgPT09IGdldFR5cGUodGVzdCkpIHtcbiAgICByZXR1cm4gdGVzdC50ZXN0KG9iaik7XG4gIH0gZWxzZSBpZiAodGVzdCAmJiAnZnVuY3Rpb24nID09PSBnZXRUeXBlKHRlc3QpKSB7XG4gICAgcmV0dXJuIHRlc3Qob2JqKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoJ1R5cGUgdGVzdCBcIicgKyB0eXBlICsgJ1wiIG5vdCBkZWZpbmVkIG9yIGludmFsaWQuJyk7XG4gIH1cbn07XG4iLCJ2YXIgZnVyaW91cyA9IHJlcXVpcmUoXCIuLi9saWIvZnVyaW91cy5qc1wiKTtcclxudmFyIGV4cGVjdCA9IHJlcXVpcmUoXCJjaGFpXCIpLmV4cGVjdDtcclxuXHJcbnZhciBjb250ZXh0ID0gbnVsbDtcclxuYmVmb3JlKGZ1bmN0aW9uKGRvbmUpIHtcclxuXHRmdXJpb3VzLmluaXQoZnVuY3Rpb24oY3R4KSB7XHJcblx0XHRjb250ZXh0ID0gY3R4O1xyXG5cdFx0ZG9uZSgpO1xyXG5cdH0pO1xyXG59KTtcclxuXHJcbmRlc2NyaWJlKFwiQ29udGV4dFwiLCBmdW5jdGlvbigpe1xyXG5cdGRlc2NyaWJlKFwiZW1wdHlcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGl0KFwiQ3JlYXRlcyBhcnJheSB3aXRoIHNwZWNpZmllZCBzaGFwZVwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KDQyKTtcclxuXHRcdFx0dmFyIHkgPSBjb250ZXh0LmVtcHR5KFs0Ml0pO1xyXG5cdFx0XHR2YXIgeiA9IGNvbnRleHQuZW1wdHkoWzQsIDJdKTtcclxuXHRcdFx0ZXhwZWN0KHguc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzQyXSk7XHJcblx0XHRcdGV4cGVjdCh5LnNoYXBlKS50by5kZWVwLmVxdWFsKFs0Ml0pO1xyXG5cdFx0XHRleHBlY3Qoei5zaGFwZSkudG8uZGVlcC5lcXVhbChbNCwgMl0pO1xyXG5cdFx0XHR4LmludmFsaWRhdGUoKTtcclxuXHRcdFx0eS5pbnZhbGlkYXRlKCk7XHJcblx0XHRcdHouaW52YWxpZGF0ZSgpO1xyXG5cdFx0fSk7XHJcblx0XHRpdChcIkNyZWF0ZXMgYXJyYXkgd2l0aCBzcGVjaWZpZWQgZGF0YSB0eXBlIChmNjQgYnkgZGVmYXVsdClcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eShbNCwgMl0pO1xyXG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuZW1wdHkoWzQsIDJdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKSk7XHJcblx0XHRcdHZhciB6ID0gY29udGV4dC5lbXB0eShbNCwgMl0sIG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjMyXCIpKTtcclxuXHRcdFx0ZXhwZWN0KHguZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKSkudG8uYmUudHJ1ZTtcclxuXHRcdFx0ZXhwZWN0KHkuZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKSkudG8uYmUudHJ1ZTtcclxuXHRcdFx0ZXhwZWN0KHouZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjMyXCIpKSkudG8uYmUudHJ1ZTtcclxuXHRcdFx0eC5pbnZhbGlkYXRlKCk7XHJcblx0XHRcdHkuaW52YWxpZGF0ZSgpO1xyXG5cdFx0XHR6LmludmFsaWRhdGUoKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cdGRlc2NyaWJlKFwiemVyb3NcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGl0KFwiQ3JlYXRlcyBhcnJheSB3aXRoIHNwZWNpZmllZCBzaGFwZVwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0Lnplcm9zKDQyKTtcclxuXHRcdFx0dmFyIHkgPSBjb250ZXh0Lnplcm9zKFs0Ml0pO1xyXG5cdFx0XHR2YXIgeiA9IGNvbnRleHQuemVyb3MoWzQsIDJdKTtcclxuXHRcdFx0ZXhwZWN0KHguc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzQyXSk7XHJcblx0XHRcdGV4cGVjdCh5LnNoYXBlKS50by5kZWVwLmVxdWFsKFs0Ml0pO1xyXG5cdFx0XHRleHBlY3Qoei5zaGFwZSkudG8uZGVlcC5lcXVhbChbNCwgMl0pO1xyXG5cdFx0XHR4LmludmFsaWRhdGUoKTtcclxuXHRcdFx0eS5pbnZhbGlkYXRlKCk7XHJcblx0XHRcdHouaW52YWxpZGF0ZSgpO1xyXG5cdFx0fSk7XHJcblx0XHRpdChcIkNyZWF0ZXMgYXJyYXkgd2l0aCBzcGVjaWZpZWQgZGF0YSB0eXBlIChmNjQgYnkgZGVmYXVsdClcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC56ZXJvcyhbNCwgMl0pO1xyXG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuemVyb3MoWzQsIDJdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKSk7XHJcblx0XHRcdHZhciB6ID0gY29udGV4dC56ZXJvcyhbNCwgMl0sIG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjMyXCIpKTtcclxuXHRcdFx0ZXhwZWN0KHguZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKSkudG8uYmUudHJ1ZTtcclxuXHRcdFx0ZXhwZWN0KHkuZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKSkudG8uYmUudHJ1ZTtcclxuXHRcdFx0ZXhwZWN0KHouZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjMyXCIpKSkudG8uYmUudHJ1ZTtcclxuXHRcdFx0eC5pbnZhbGlkYXRlKCk7XHJcblx0XHRcdHkuaW52YWxpZGF0ZSgpO1xyXG5cdFx0XHR6LmludmFsaWRhdGUoKTtcclxuXHRcdH0pO1xyXG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IHdpdGggYWxsIGVsZW1lbnRzIGluaXRpYWxpemVkIHRvIHplcm9cIiwgZnVuY3Rpb24oZG9uZSkge1xyXG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuemVyb3MoWzMsIDJdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKSk7XHJcblx0XHRcdHZhciB5ID0gY29udGV4dC56ZXJvcyhbMiwgM10sIG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjMyXCIpKTtcclxuXHRcdFx0Y29udGV4dC5nZXQoeCwgeSwgZnVuY3Rpb24oeCwgeSkge1xyXG5cdFx0XHRcdGV4cGVjdCh4KS50by5kZWVwLmVxdWFsKFtbMC4wLCAwLjBdLFxyXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbMC4wLCAwLjBdLFxyXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbMC4wLCAwLjBdXSk7XHJcblx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1swLjAsIDAuMCwgMC4wXSxcclxuXHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWzAuMCwgMC4wLCAwLjBdXSk7XHJcblx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cdGRlc2NyaWJlKFwib25lc1wiLCBmdW5jdGlvbigpe1xyXG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IHdpdGggc3BlY2lmaWVkIHNoYXBlXCIsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyg0Mik7XHJcblx0XHRcdHZhciB5ID0gY29udGV4dC5vbmVzKFs0Ml0pO1xyXG5cdFx0XHR2YXIgeiA9IGNvbnRleHQub25lcyhbNCwgMl0pO1xyXG5cdFx0XHRleHBlY3QoeC5zaGFwZSkudG8uZGVlcC5lcXVhbChbNDJdKTtcclxuXHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzQyXSk7XHJcblx0XHRcdGV4cGVjdCh6LnNoYXBlKS50by5kZWVwLmVxdWFsKFs0LCAyXSk7XHJcblx0XHRcdHguaW52YWxpZGF0ZSgpO1xyXG5cdFx0XHR5LmludmFsaWRhdGUoKTtcclxuXHRcdFx0ei5pbnZhbGlkYXRlKCk7XHJcblx0XHR9KTtcclxuXHRcdGl0KFwiQ3JlYXRlcyBhcnJheSB3aXRoIHNwZWNpZmllZCBkYXRhIHR5cGUgKGY2NCBieSBkZWZhdWx0KVwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0Lm9uZXMoWzQsIDJdKTtcclxuXHRcdFx0dmFyIHkgPSBjb250ZXh0Lm9uZXMoWzQsIDJdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKSk7XHJcblx0XHRcdHZhciB6ID0gY29udGV4dC5vbmVzKFs0LCAyXSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIikpO1xyXG5cdFx0XHRleHBlY3QoeC5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpKS50by5iZS50cnVlO1xyXG5cdFx0XHRleHBlY3QoeS5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpKS50by5iZS50cnVlO1xyXG5cdFx0XHRleHBlY3Qoei5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIikpKS50by5iZS50cnVlO1xyXG5cdFx0XHR4LmludmFsaWRhdGUoKTtcclxuXHRcdFx0eS5pbnZhbGlkYXRlKCk7XHJcblx0XHRcdHouaW52YWxpZGF0ZSgpO1xyXG5cdFx0fSk7XHJcblx0XHRpdChcIkNyZWF0ZXMgYXJyYXkgd2l0aCBhbGwgZWxlbWVudHMgaW5pdGlhbGl6ZWQgdG8gb25lXCIsIGZ1bmN0aW9uKGRvbmUpIHtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0Lm9uZXMoWzMsIDJdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKSk7XHJcblx0XHRcdHZhciB5ID0gY29udGV4dC5vbmVzKFsyLCAzXSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIikpO1xyXG5cdFx0XHRjb250ZXh0LmdldCh4LCB5LCBmdW5jdGlvbih4LCB5KSB7XHJcblx0XHRcdFx0ZXhwZWN0KHgpLnRvLmRlZXAuZXF1YWwoW1sxLjAsIDEuMF0sXHJcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsxLjAsIDEuMF0sXHJcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsxLjAsIDEuMF1dKTtcclxuXHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbWzEuMCwgMS4wLCAxLjBdLFxyXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbMS4wLCAxLjAsIDEuMF1dKTtcclxuXHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJhcnJheVwiLCBmdW5jdGlvbigpe1xyXG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IG9mIHRoZSBzYW1lIGxlbmd0aCBhcyB0aGUgcHJvdmlkZWQgYXJyYXlcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFswLCAxXSk7XHJcblx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWzAsIDFdLFxyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgICAgIFsyLCAzXSxcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbMywgNF1dKTtcclxuXHRcdFx0ZXhwZWN0KHgubGVuZ3RoKS50by5lcXVhbCgyKTtcclxuXHRcdFx0ZXhwZWN0KHkubGVuZ3RoKS50by5lcXVhbCg2KTtcclxuXHRcdFx0eC5pbnZhbGlkYXRlKCk7XHJcblx0XHRcdHkuaW52YWxpZGF0ZSgpO1xyXG5cdFx0fSk7XHJcblx0XHRpdChcIkNyZWF0ZXMgYXJyYXkgb2YgdGhlIHNhbWUgc2hhcGUgYXMgdGhlIHByb3ZpZGVkIGFycmF5XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMCwgMV0pO1xyXG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoW1swLCAxXSxcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbMiwgM10sXHJcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgWzMsIDRdXSk7XHJcblx0XHRcdHZhciB6ID0gY29udGV4dC5hcnJheShbW1sxLCAyLCAzXSwgWyA0LCAgNSwgIDZdXSxcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbWzcsIDgsIDldLCBbMTAsIDExLCAxMl1dXSk7XHJcblx0XHRcdGV4cGVjdCh4LnNoYXBlKS50by5kZWVwLmVxdWFsKFsyXSk7XHJcblx0XHRcdGV4cGVjdCh5LnNoYXBlKS50by5kZWVwLmVxdWFsKFszLCAyXSk7XHJcblx0XHRcdGV4cGVjdCh6LnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAyLCAzXSk7XHJcblx0XHRcdHguaW52YWxpZGF0ZSgpO1xyXG5cdFx0XHR5LmludmFsaWRhdGUoKTtcclxuXHRcdFx0ei5pbnZhbGlkYXRlKCk7XHJcblx0XHR9KTtcclxuXHRcdGl0KFwiQ3JlYXRlcyBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEgYXMgdGhlIHByb3ZpZGVkIGFycmF5XCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHR2YXIgYXJyYXkgPSBbW1sxLCAyLCAzXSwgWyA0LCAgNSwgIDZdXSxcclxuXHRcdFx0ICAgICAgICAgICAgIFtbNywgOCwgOV0sIFsxMCwgMTEsIDEyXV1dO1xyXG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoYXJyYXksIG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKTtcclxuXHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KGFycmF5LCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKSk7XHJcblx0XHRcdGNvbnRleHQuZ2V0KHgsIHksIGZ1bmN0aW9uKHgsIHkpIHtcclxuXHRcdFx0XHRleHBlY3QoeCkudG8uZGVlcC5lcXVhbChhcnJheSk7XHJcblx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoYXJyYXkpO1xyXG5cdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHRkZXNjcmliZShcImxpbnNwYWNlXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRpdChcIkhhcyBsZW5ndGggb2YgNTAgd2l0aCBkZWZhdWx0IGFyZ3VtZW50c1wiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRleHBlY3QoKGNvbnRleHQubGluc3BhY2UoMCwgMSkpLmxlbmd0aCkudG8uZXF1YWwoNTApO1xyXG5cdFx0fSk7XHJcblx0XHRpdChcIkhhcyB0aGUgc3BlY2lmaWVkIG51bWJlciBvZiBzYW1wbGVzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGV4cGVjdCgoY29udGV4dC5saW5zcGFjZSgwLCAxLCAyNDMpKS5sZW5ndGgpLnRvLmVxdWFsKDI0Myk7XHJcblx0XHR9KTtcclxuXHRcdGl0KFwiSGFzIGV4cGVjdGVkIHZhbHVlc1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0dmFyIHN0YXJ0ID0gNTA7XHJcblx0XHRcdHZhciBzdG9wID0gOTk7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZShzdGFydCwgc3RvcCk7XHJcblx0XHRcdHguZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xyXG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcmVzdWx0Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0W2ldKS50by5lcXVhbChzdGFydCtpKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdFx0ZGVzY3JpYmUoXCJ3aXRoIGluY2x1ZGVTdG9wID09PSBmYWxzZVwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkhhcyB0aGUgc3BlY2lmaWVkIG51bWJlciBvZiBzYW1wbGVzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0ZXhwZWN0KChjb250ZXh0LmxpbnNwYWNlKDAsIDEsIDI0MywgZmFsc2UpKS5sZW5ndGgpLnRvLmVxdWFsKDI0Myk7XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRpdChcIkRvZXMgbm90IGNvbnRhaW4gdGhlIHJpZ2h0IGVuZHBvaW50XCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgtMSwgMSwgMTAwMCwgZmFsc2UpO1xyXG5cdFx0XHRcdHguZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdFtyZXN1bHQubGVuZ3RoIC0gMV0pLnRvLm5vdC5lcXVhbCgxKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHRkZXNjcmliZShcIm5lZ1wiLCBmdW5jdGlvbigpIHtcclxuXHRcdHZhciB4UmVmID0gWyAxLCAtNy41LCAgMCwgLTE1XTtcclxuXHRcdHZhciB5UmVmID0gWy0xLCAgNy41LCAtMCwgIDE1XTtcclxuXHRcdHZhciBkYXRhVHlwZXMgPSBbXCJmMzJcIiwgXCJmNjRcIl07XHJcblxyXG5cdFx0ZGVzY3JpYmUoXCJXaXRoIG5vIG91dHB1dCBhcnJheSBzdXBwbGllZFwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIHNoYXBlIGFzIGlucHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5vbmVzKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0Lm5lZyh4KTtcclxuXHRcdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMywgNF0pO1xyXG5cdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XHJcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggdGhlIHNhbWUgZGF0YSB0eXBlIGFzIGlucHV0IGFycmF5IChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XHJcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5uZWcoeCk7XHJcblx0XHRcdFx0XHRcdGV4cGVjdCh5LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpKS50by5iZS50cnVlO1xyXG5cdFx0XHRcdFx0XHR5LmludmFsaWRhdGUoKTtcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XHJcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggbmVnYXRlZCBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xyXG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcclxuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0Lm5lZyh4KTtcclxuXHRcdFx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xyXG5cdFx0XHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKHlSZWYpO1xyXG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiV2l0aCBhbiBvdXRwdXQgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XHJcblx0XHRcdFx0XHRpdChcIlBvcHVsYXRlcyB0aGUgb3V0cHV0IGFycmF5IHdpdGggbmVnYXRlZCBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xyXG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcclxuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0Lm9uZXMoeC5zaGFwZSwgeC5kYXRhVHlwZSk7XHJcblx0XHRcdFx0XHRcdGNvbnRleHQubmVnKHgsIHkpO1xyXG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XHJcblx0XHRcdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoeVJlZik7XHJcblx0XHRcdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cdGRlc2NyaWJlKFwiYWJzXCIsIGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIHhSZWYgPSBbMSwgLTcuNSwgMCwgLTE1XTtcclxuXHRcdHZhciB5UmVmID0gWzEsICA3LjUsIDAsICAxNV07XHJcblx0XHR2YXIgZGF0YVR5cGVzID0gW1wiZjMyXCIsIFwiZjY0XCJdO1xyXG5cclxuXHRcdGRlc2NyaWJlKFwiV2l0aCBubyBvdXRwdXQgYXJyYXkgc3VwcGxpZWRcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCB0aGUgc2FtZSBzaGFwZSBhcyBpbnB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyhbMiwgMywgNF0pO1xyXG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hYnMoeCk7XHJcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDMsIDRdKTtcclxuXHRcdFx0XHR5LmludmFsaWRhdGUoKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xyXG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEgdHlwZSBhcyBpbnB1dCBhcnJheSAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xyXG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuYWJzKHgpO1xyXG5cdFx0XHRcdFx0XHRleHBlY3QoeS5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKSkudG8uYmUudHJ1ZTtcclxuXHRcdFx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xyXG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIGFic29sdXRlIHZhbHVlcyBvZiBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xyXG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcclxuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFicyh4KTtcclxuXHRcdFx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xyXG5cdFx0XHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKHlSZWYpO1xyXG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiV2l0aCBhbiBvdXRwdXQgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XHJcblx0XHRcdFx0XHRpdChcIlBvcHVsYXRlcyB0aGUgb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XHJcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xyXG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQub25lcyh4LnNoYXBlLCB4LmRhdGFUeXBlKTtcclxuXHRcdFx0XHRcdFx0Y29udGV4dC5hYnMoeCwgeSk7XHJcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcclxuXHRcdFx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbCh5UmVmKTtcclxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJleHBcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgeFJlZiA9IFsxLCAtMSwgMF07XHJcblx0XHR2YXIgZGF0YVR5cGVzID0gW1wiZjMyXCIsIFwiZjY0XCJdO1xyXG5cclxuXHRcdGRlc2NyaWJlKFwiV2l0aCBubyBvdXRwdXQgYXJyYXkgc3VwcGxpZWRcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCB0aGUgc2FtZSBzaGFwZSBhcyBpbnB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyhbMiwgMywgNF0pO1xyXG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5leHAoeCk7XHJcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDMsIDRdKTtcclxuXHRcdFx0XHR5LmludmFsaWRhdGUoKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xyXG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEgdHlwZSBhcyBpbnB1dCBhcnJheSAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xyXG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuZXhwKHgpO1xyXG5cdFx0XHRcdFx0XHRleHBlY3QoeS5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKSkudG8uYmUudHJ1ZTtcclxuXHRcdFx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xyXG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIGFic29sdXRlIHZhbHVlcyBvZiBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xyXG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcclxuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmV4cCh4KTtcclxuXHRcdFx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xyXG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgeS5sZW5ndGg7IGsrKykge1xyXG5cdFx0XHRcdFx0XHRcdFx0ZXhwZWN0KHlba10pLnRvLmJlLmNsb3NlVG8oTWF0aC5leHAoeFJlZltrXSksIE1hdGguZXhwKHhSZWZba10pICogMyAqIHguZGF0YVR5cGUuZXBzaWxvbik7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiV2l0aCBhbiBvdXRwdXQgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XHJcblx0XHRcdFx0XHRpdChcIlBvcHVsYXRlcyB0aGUgb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XHJcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xyXG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQub25lcyh4LnNoYXBlLCB4LmRhdGFUeXBlKTtcclxuXHRcdFx0XHRcdFx0Y29udGV4dC5leHAoeCwgeSk7XHJcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcclxuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBrID0gMDsgayA8IHkubGVuZ3RoOyBrKyspIHtcclxuXHRcdFx0XHRcdFx0XHRcdGV4cGVjdCh5W2tdKS50by5iZS5jbG9zZVRvKE1hdGguZXhwKHhSZWZba10pLCBNYXRoLmV4cCh4UmVmW2tdKSAqIDMgKiB4LmRhdGFUeXBlLmVwc2lsb24pO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJsb2dcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgeFJlZiA9IFsxLCAzLCAxMF07XHJcblx0XHR2YXIgZGF0YVR5cGVzID0gW1wiZjMyXCIsIFwiZjY0XCJdO1xyXG5cclxuXHRcdGRlc2NyaWJlKFwiV2l0aCBubyBvdXRwdXQgYXJyYXkgc3VwcGxpZWRcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCB0aGUgc2FtZSBzaGFwZSBhcyBpbnB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyhbMiwgMywgNF0pO1xyXG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5sb2coeCk7XHJcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDMsIDRdKTtcclxuXHRcdFx0XHR5LmludmFsaWRhdGUoKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xyXG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEgdHlwZSBhcyBpbnB1dCBhcnJheSAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xyXG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQubG9nKHgpO1xyXG5cdFx0XHRcdFx0XHRleHBlY3QoeS5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKSkudG8uYmUudHJ1ZTtcclxuXHRcdFx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xyXG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIGFic29sdXRlIHZhbHVlcyBvZiBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xyXG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcclxuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmxvZyh4KTtcclxuXHRcdFx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xyXG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgeS5sZW5ndGg7IGsrKykge1xyXG5cdFx0XHRcdFx0XHRcdFx0ZXhwZWN0KHlba10pLnRvLmJlLmNsb3NlVG8oTWF0aC5sb2coeFJlZltrXSksIE1hdGgubG9nKHhSZWZba10pICogMyAqIHguZGF0YVR5cGUuZXBzaWxvbik7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiV2l0aCBhbiBvdXRwdXQgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XHJcblx0XHRcdFx0XHRpdChcIlBvcHVsYXRlcyB0aGUgb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XHJcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xyXG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQub25lcyh4LnNoYXBlLCB4LmRhdGFUeXBlKTtcclxuXHRcdFx0XHRcdFx0Y29udGV4dC5sb2coeCwgeSk7XHJcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcclxuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBrID0gMDsgayA8IHkubGVuZ3RoOyBrKyspIHtcclxuXHRcdFx0XHRcdFx0XHRcdGV4cGVjdCh5W2tdKS50by5iZS5jbG9zZVRvKE1hdGgubG9nKHhSZWZba10pLCBNYXRoLmxvZyh4UmVmW2tdKSAqIDMgKiB4LmRhdGFUeXBlLmVwc2lsb24pO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJzcXJ0XCIsIGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIHhSZWYgPSBbMCwgMC4yNSwgMSwgOSwgMTBdO1xyXG5cdFx0dmFyIGRhdGFUeXBlcyA9IFtcImYzMlwiLCBcImY2NFwiXTtcclxuXHJcblx0XHRkZXNjcmliZShcIldpdGggbm8gb3V0cHV0IGFycmF5IHN1cHBsaWVkXCIsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggdGhlIHNhbWUgc2hhcGUgYXMgaW5wdXQgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0Lm9uZXMoWzIsIDMsIDRdKTtcclxuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuc3FydCh4KTtcclxuXHRcdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMywgNF0pO1xyXG5cdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XHJcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggdGhlIHNhbWUgZGF0YSB0eXBlIGFzIGlucHV0IGFycmF5IChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XHJcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5zcXJ0KHgpO1xyXG5cdFx0XHRcdFx0XHRleHBlY3QoeS5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKSkudG8uYmUudHJ1ZTtcclxuXHRcdFx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xyXG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIGFic29sdXRlIHZhbHVlcyBvZiBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xyXG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcclxuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LnNxcnQoeCk7XHJcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcclxuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBrID0gMDsgayA8IHkubGVuZ3RoOyBrKyspIHtcclxuXHRcdFx0XHRcdFx0XHRcdGV4cGVjdCh5W2tdKS50by5iZS5jbG9zZVRvKE1hdGguc3FydCh4UmVmW2tdKSwgTWF0aC5zcXJ0KHhSZWZba10pICogMyAqIHguZGF0YVR5cGUuZXBzaWxvbik7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiV2l0aCBhbiBvdXRwdXQgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XHJcblx0XHRcdFx0XHRpdChcIlBvcHVsYXRlcyB0aGUgb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XHJcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xyXG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQub25lcyh4LnNoYXBlLCB4LmRhdGFUeXBlKTtcclxuXHRcdFx0XHRcdFx0Y29udGV4dC5zcXJ0KHgsIHkpO1xyXG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XHJcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCB5Lmxlbmd0aDsgaysrKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRleHBlY3QoeVtrXSkudG8uYmUuY2xvc2VUbyhNYXRoLnNxcnQoeFJlZltrXSksIE1hdGguc3FydCh4UmVmW2tdKSAqIDMgKiB4LmRhdGFUeXBlLmVwc2lsb24pO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJzcXVhcmVcIiwgZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgeFJlZiA9IFstMiwgMCwgMC41LCAxLCAzXTtcclxuXHRcdHZhciBkYXRhVHlwZXMgPSBbXCJmMzJcIiwgXCJmNjRcIl07XHJcblxyXG5cdFx0ZGVzY3JpYmUoXCJXaXRoIG5vIG91dHB1dCBhcnJheSBzdXBwbGllZFwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIHNoYXBlIGFzIGlucHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5vbmVzKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LnNxdWFyZSh4KTtcclxuXHRcdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMywgNF0pO1xyXG5cdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XHJcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggdGhlIHNhbWUgZGF0YSB0eXBlIGFzIGlucHV0IGFycmF5IChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XHJcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5zcXVhcmUoeCk7XHJcblx0XHRcdFx0XHRcdGV4cGVjdCh5LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpKS50by5iZS50cnVlO1xyXG5cdFx0XHRcdFx0XHR5LmludmFsaWRhdGUoKTtcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XHJcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XHJcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xyXG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuc3F1YXJlKHgpO1xyXG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XHJcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCB5Lmxlbmd0aDsgaysrKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRleHBlY3QoeVtrXSkudG8uYmUuY2xvc2VUbyh4UmVmW2tdICogeFJlZltrXSwgeFJlZltrXSAqIHhSZWZba10gKiB4LmRhdGFUeXBlLmVwc2lsb24pO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0XHRkZXNjcmliZShcIldpdGggYW4gb3V0cHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xyXG5cdFx0XHRcdFx0aXQoXCJQb3B1bGF0ZXMgdGhlIG91dHB1dCBhcnJheSB3aXRoIGFic29sdXRlIHZhbHVlcyBvZiBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xyXG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcclxuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0Lm9uZXMoeC5zaGFwZSwgeC5kYXRhVHlwZSk7XHJcblx0XHRcdFx0XHRcdGNvbnRleHQuc3F1YXJlKHgsIHkpO1xyXG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XHJcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCB5Lmxlbmd0aDsgaysrKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRleHBlY3QoeVtrXSkudG8uYmUuY2xvc2VUbyh4UmVmW2tdICogeFJlZltrXSwgeFJlZltrXSAqIHhSZWZba10gKiB4LmRhdGFUeXBlLmVwc2lsb24pO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fSk7XHJcbn0pO1xyXG4iLCJ2YXIgZnVyaW91cyA9IHJlcXVpcmUoXCIuLi9saWIvZnVyaW91cy5qc1wiKTtcclxudmFyIGV4cGVjdCA9IHJlcXVpcmUoXCJjaGFpXCIpLmV4cGVjdDtcclxuXHJcbmRlc2NyaWJlKFwiRGF0YVR5cGVcIiwgZnVuY3Rpb24oKXtcclxuXHRkZXNjcmliZShcImYzMlwiLCBmdW5jdGlvbigpe1xyXG5cdFx0aXQoXCJzaG91bGQgaGF2ZSBzaXplIDRcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0dmFyIGR0eXBlID0gbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIik7XHJcblx0XHRcdGV4cGVjdChkdHlwZS5zaXplKS50by5lcXVhbCg0KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGl0KFwic2hvdWxkIGhhdmUgdHlwZSBcXFwiZjMyXFxcIlwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgZHR5cGUgPSBuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKTtcclxuXHRcdFx0ZXhwZWN0KGR0eXBlLnR5cGUpLnRvLmVxdWFsKFwiZjMyXCIpO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJmNjRcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGl0KFwic2hvdWxkIGhhdmUgc2l6ZSA4XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdHZhciBkdHlwZSA9IG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpO1xyXG5cdFx0XHRleHBlY3QoZHR5cGUuc2l6ZSkudG8uZXF1YWwoOCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRpdChcInNob3VsZCBoYXZlIHR5cGUgXFxcImY2NFxcXCJcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0dmFyIGR0eXBlID0gbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIik7XHJcblx0XHRcdGV4cGVjdChkdHlwZS50eXBlKS50by5lcXVhbChcImY2NFwiKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG59KTtcclxuIiwidmFyIGZ1cmlvdXMgPSByZXF1aXJlKFwiLi4vbGliL2Z1cmlvdXMuanNcIik7XHJcbnZhciBleHBlY3QgPSByZXF1aXJlKFwiY2hhaVwiKS5leHBlY3Q7XHJcblxyXG52YXIgY29udGV4dCA9IG51bGw7XHJcbmJlZm9yZShmdW5jdGlvbihkb25lKSB7XHJcblx0ZnVyaW91cy5pbml0KGZ1bmN0aW9uKGN0eCkge1xyXG5cdFx0Y29udGV4dCA9IGN0eDtcclxuXHRcdGRvbmUoKTtcclxuXHR9KTtcclxufSk7XHJcblxyXG5kZXNjcmliZShcIk5EQXJyYXlcIiwgZnVuY3Rpb24oKXtcclxuXHRkZXNjcmliZShcImxlbmd0aFwiLCBmdW5jdGlvbigpe1xyXG5cdFx0aXQoXCJFcXVhbHMgdG8gdGhlIG51bWJlciBwYXNzZWQgaW4gY29uc3RydWN0b3JcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0ZXhwZWN0KChjb250ZXh0LmVtcHR5KDQyKSkubGVuZ3RoKS50by5lcXVhbCg0Mik7XHJcblx0XHR9KTtcclxuXHRcdGl0KFwiRXF1YWxzIHRvIHRoZSBudW1iZXIgcGFzc2VkIGluIGNvbnN0cnVjdG9yIGFzIGFuIGFycmF5XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGV4cGVjdCgoY29udGV4dC5lbXB0eShbNDJdKSkubGVuZ3RoKS50by5lcXVhbCg0Mik7XHJcblx0XHR9KTtcclxuXHRcdGl0KFwiRXF1YWxzIHRvIHRoZSBwcm9kdWN0IG9mIGRpbWVuc2lvbnNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0ZXhwZWN0KChjb250ZXh0LmVtcHR5KFsyLCA1LCAzXSkpLmxlbmd0aCkudG8uZXF1YWwoMzApO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJyZXNoYXBlXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRpdChcIlByZXNlcnZlcyBsZW5ndGhcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KFs3LDUsM10pO1xyXG5cdFx0XHR2YXIgeSA9IHgucmVzaGFwZShbMjEsNV0pO1xyXG5cdFx0XHRleHBlY3QoeS5sZW5ndGgpLnRvLmVxdWFsKHgubGVuZ3RoKTtcclxuXHRcdH0pO1xyXG5cdFx0aXQoXCJDaGFuZ2VzIHNoYXBlXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eShbNyw1LDNdKTtcclxuXHRcdFx0dmFyIHkgPSB4LnJlc2hhcGUoWzIxLDVdKTtcclxuXHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIxLDVdKTtcclxuXHRcdH0pO1xyXG5cdFx0aXQoXCJSZWFycmFuZ2VzIGRhdGFcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCA4LCA4KS5yZXNoYXBlKFsyLCAyLCAyXSk7XHJcblx0XHRcdHguZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbW1sgMSwgIDJdLCBbIDMsICA0XV0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFtbIDUsICA2XSwgWyA3LCAgOF1dXSk7XHJcblx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cdGRlc2NyaWJlKFwicmVwZWF0XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRpdChcIlJlcGVhdHMgYXJyYXkgZWxlbWVudHMgYWxvbmcgYXhpcyAwXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1s4LCAxLCA2XSxcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbMywgNSwgN10sXHJcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgWzQsIDksIDJdXSk7XHJcblx0XHRcdHgucmVwZWF0KDIsIDApLmdldChmdW5jdGlvbihyZXN1bHQpIHtcclxuXHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbOCwgMSwgNl0sXHJcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWzgsIDEsIDZdLFxyXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFszLCA1LCA3XSxcclxuXHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbMywgNSwgN10sXHJcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWzQsIDksIDJdLFxyXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFs0LCA5LCAyXV0pO1xyXG5cdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdGl0KFwiUmVwZWF0cyBhcnJheSBlbGVtZW50cyBhbG9uZyBheGlzIDFcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzgsIDEsIDZdLFxyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgICAgIFszLCA1LCA3XSxcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbNCwgOSwgMl1dKTtcclxuXHRcdFx0eC5yZXBlYXQoMiwgMSkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xyXG5cdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1s4LCA4LCAxLCAxLCA2LCA2XSxcclxuXHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbMywgMywgNSwgNSwgNywgN10sXHJcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWzQsIDQsIDksIDksIDIsIDJdXSk7XHJcblx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cdGRlc2NyaWJlKFwiZ2V0XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRpdChcIldvcmtzIHdpdGggMS1kaW1lbnNpb25hbCBhcnJheVwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFs0MiwgMTBdKTtcclxuXHRcdFx0eC5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFs0MiwgMTBdKTtcclxuXHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0XHRpdChcIldvcmtzIHdpdGggMi1kaW1lbnNpb25hbCBhcnJheVwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0dmFyIGFycmF5ID0gW1sxNiwgIDIsICAzLCAxMywgIDVdLFxyXG5cdFx0XHRcdFx0XHQgWzExLCAxMCwgIDgsICA5LCAgN10sXHJcblx0XHRcdFx0XHRcdCBbIDYsIDEyLCAgNCwgMTQsIDE1XV07XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShhcnJheSk7XHJcblx0XHRcdHguZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChhcnJheSk7XHJcblx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cdGRlc2NyaWJlKFwiYWRkXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRkZXNjcmliZShcIkFkZCBhcnJheVwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcclxuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoWzgsIC0xLCAxMF0pO1xyXG5cdFx0XHRcdHZhciB6ID0geC5hZGQoeSk7XHJcblx0XHRcdFx0ei5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoWzksIDMsIDE5XSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAyLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1sxLCA0XSwgWzksIC0xN11dKTtcclxuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoW1s4LCAtMV0sIFsxMCwgLTIxXV0pO1xyXG5cdFx0XHRcdHZhciB6ID0geC5hZGQoeSk7XHJcblx0XHRcdFx0ei5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1s5LCAzXSwgWzE5LCAtMzhdXSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0XHRkZXNjcmliZShcIkFkZCBzY2FsYXJcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XHJcblx0XHRcdFx0dmFyIHogPSB4LmFkZCgtNyk7XHJcblx0XHRcdFx0ei5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoWy02LCAtMywgMl0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XHJcblx0XHRcdFx0dmFyIHogPSB4LmFkZCg0Mik7XHJcblx0XHRcdFx0ei5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1s0MywgNDZdLCBbNTEsIDI1XV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cdGRlc2NyaWJlKFwic3ViXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRkZXNjcmliZShcIlN1YnRyYWN0IGFycmF5XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xyXG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbOCwgLTEsIDEwXSk7XHJcblx0XHRcdFx0dmFyIHogPSB4LnN1Yih5KTtcclxuXHRcdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbLTcsIDUsIC0xXSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAyLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1sxLCA0XSwgWzksIC0xN11dKTtcclxuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoW1s4LCAtMV0sIFsxMCwgLTIxXV0pO1xyXG5cdFx0XHRcdHZhciB6ID0geC5zdWIoeSk7XHJcblx0XHRcdFx0ei5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1stNywgNV0sIFstMSwgNF1dKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiU3VidHJhY3Qgc2NhbGFyXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xyXG5cdFx0XHRcdHZhciB5ID0geC5zdWIoLTcpO1xyXG5cdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFs4LCAxMSwgMTZdKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzEsIDRdLCBbOSwgLTE3XV0pO1xyXG5cdFx0XHRcdHZhciB5ID0geC5zdWIoNDIpO1xyXG5cdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbLTQxLCAtMzhdLCBbLTMzLCAtNTldXSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJtdWxcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGRlc2NyaWJlKFwiTXVsdGlwbHkgYnkgYXJyYXlcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XHJcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KFs4LCAtMSwgMTBdKTtcclxuXHRcdFx0XHR2YXIgeiA9IHgubXVsKHkpO1xyXG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFs4LCAtNCwgOTBdKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzEsIDRdLCBbOSwgLTE3XV0pO1xyXG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWzgsIC0xXSwgWzEwLCAtMjFdXSk7XHJcblx0XHRcdFx0dmFyIHogPSB4Lm11bCh5KTtcclxuXHRcdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbWzgsIC00XSwgWzkwLCAzNTddXSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0XHRkZXNjcmliZShcIk11bHRpcGx5IGJ5IHNjYWxhclwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcclxuXHRcdFx0XHR2YXIgeSA9IHgubXVsKC0xMCk7XHJcblx0XHRcdFx0eS5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoWy0xMCwgLTQwLCAtOTBdKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzEsIDRdLCBbOSwgLTE3XV0pO1xyXG5cdFx0XHRcdHZhciB5ID0geC5tdWwoMTApO1xyXG5cdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbMTAsIDQwXSwgWzkwLCAtMTcwXV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cdGRlc2NyaWJlKFwiZGl2XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRkZXNjcmliZShcIkRpdmlkZSBieSBhcnJheVwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcclxuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoWzIsIC00LCA4XSk7XHJcblx0XHRcdFx0dmFyIHogPSB4LmRpdih5KTtcclxuXHRcdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbMC41LCAtMSwgMS4xMjVdKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzEsIDRdLCBbOSwgLTE3XV0pO1xyXG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWy0yLCA0XSwgWy04LCAxNl1dKTtcclxuXHRcdFx0XHR2YXIgeiA9IHguZGl2KHkpO1xyXG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbLTAuNSwgMV0sIFstMS4xMjUsIC0xLjA2MjVdXSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0XHRkZXNjcmliZShcIkRpdmlkZSBieSBzY2FsYXJcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcclxuXHRcdFx0XHR2YXIgeSA9IHguZGl2KC0yKTtcclxuXHRcdFx0XHR5LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbLTAuNSwgLTIsIC00LjVdKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XHJcblx0XHRcdFx0dmFyIHkgPSB4LmRpdigtNCk7XHJcblx0XHRcdFx0eS5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1stMC4yNSwgLTFdLCBbLTIuMjUsIDQuMjVdXSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJtaW5cIiwgZnVuY3Rpb24oKXtcclxuXHRcdGRlc2NyaWJlKFwiQWxsIGVsZW1lbnRzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xyXG5cdFx0XHRcdHgubWluKCkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZXF1YWwoMSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAyLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1stMiwgNF0sIFstOCwgMTZdXSk7XHJcblx0XHRcdFx0eC5taW4oKS5nZXQoZnVuY3Rpb24ocmVzdWx0KSB7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5lcXVhbCgtOCk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0XHRkZXNjcmliZShcIkFsb25nIGFuIGF4aXNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHNoYXBlIGZvciAzLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKS5sb2NrKCk7XHJcblx0XHRcdFx0ZXhwZWN0KHgubWluKDApLnNoYXBlKS50by5kZWVwLmVxdWFsKFszLCA0XSk7XHJcblx0XHRcdFx0ZXhwZWN0KHgubWluKDEpLnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCA0XSk7XHJcblx0XHRcdFx0ZXhwZWN0KHgubWluKDIpLnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAzXSk7XHJcblx0XHRcdFx0eC5pbnZhbGlkYXRlKCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAzLWRpbWVuc2lvbmFsIGFycmF5cywgYXhpcyAwXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKTtcclxuXHRcdFx0XHR4Lm1pbigwKS5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1sgMSwgIDIsICAzLCAgNF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgWyA1LCAgNiwgIDcsICA4XSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDksIDEwLCAxMSwgMTJdXSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAzLWRpbWVuc2lvbmFsIGFycmF5cywgYXhpcyAxXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKTtcclxuXHRcdFx0XHR4Lm1pbigxKS5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1sgIDEsICAyLCAgMywgIDRdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFsgMTMsIDE0LCAxNSwgMTZdXSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAzLWRpbWVuc2lvbmFsIGFycmF5cywgYXhpcyAyXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKTtcclxuXHRcdFx0XHR4Lm1pbigyKS5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1sgIDEsICA1LCAgOV0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgWyAxMywgMTcsIDIxXV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cdGRlc2NyaWJlKFwibWF4XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRkZXNjcmliZShcIkFsbCBlbGVtZW50c1wiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcclxuXHRcdFx0XHR4Lm1heCgpLmdldChmdW5jdGlvbihyZXN1bHQpIHtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmVxdWFsKDkpO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbLTIsIDRdLCBbLTgsIDE2XV0pO1xyXG5cdFx0XHRcdHgubWF4KCkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZXF1YWwoMTYpO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdFx0ZGVzY3JpYmUoXCJBbG9uZyBhbiBheGlzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCBzaGFwZSBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSkubG9jaygpO1xyXG5cdFx0XHRcdGV4cGVjdCh4Lm1heCgwKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMywgNF0pO1xyXG5cdFx0XHRcdGV4cGVjdCh4Lm1heCgxKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgNF0pO1xyXG5cdFx0XHRcdGV4cGVjdCh4Lm1heCgyKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgM10pO1xyXG5cdFx0XHRcdHguaW52YWxpZGF0ZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMFwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5tYXgoMCkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbIDEzLCAxNCwgMTUsIDE2XSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDE3LCAxOCwgMTksIDIwXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDIxLCAyMiwgMjMsIDI0XV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMVwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5tYXgoMSkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbICA5LCAxMCwgMTEsIDEyXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDIxLCAyMiwgMjMsIDI0XV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMlwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5tYXgoMikuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbICA0LCAgOCwgMTJdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFsgMTYsIDIwLCAyNF1dKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHRkZXNjcmliZShcInN1bVwiLCBmdW5jdGlvbigpe1xyXG5cdFx0ZGVzY3JpYmUoXCJBbGwgZWxlbWVudHNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XHJcblx0XHRcdFx0eC5zdW0oKS5nZXQoZnVuY3Rpb24gKHJlc3VsdCkge1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZXF1YWwoMTQpO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbLTIsIDRdLCBbLTgsIDE2XV0pO1xyXG5cdFx0XHRcdHguc3VtKCkuZ2V0KGZ1bmN0aW9uIChyZXN1bHQpIHtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmVxdWFsKDEwKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiQWxvbmcgYW4gYXhpc1wiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkNvcnJlY3Qgc2hhcGUgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pLmxvY2soKTtcclxuXHRcdFx0XHRleHBlY3QoeC5zdW0oMCkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzMsIDRdKTtcclxuXHRcdFx0XHRleHBlY3QoeC5zdW0oMSkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDRdKTtcclxuXHRcdFx0XHRleHBlY3QoeC5zdW0oMikuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDNdKTtcclxuXHRcdFx0XHR4LmludmFsaWRhdGUoKTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzLCBheGlzIDBcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pO1xyXG5cdFx0XHRcdHguc3VtKDApLmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbWyAxNCwgMTYsIDE4LCAyMF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgWyAyMiwgMjQsIDI2LCAyOF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgWyAzMCwgMzIsIDM0LCAzNl1dKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzLCBheGlzIDFcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pO1xyXG5cdFx0XHRcdHguc3VtKDEpLmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbWyAxNSwgIDE4LCAgMjEsICAyNF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgWyA1MSwgIDU0LCAgNTcsICA2MF1dKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzLCBheGlzIDJcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pO1xyXG5cdFx0XHRcdHguc3VtKDIpLmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbWyAxMCwgIDI2LCAgNDJdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFsgNTgsICA3NCwgIDkwXV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cdGRlc2NyaWJlKFwiZG90XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRpdChcIkNvcnJlY3Qgc2hhcGUgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eShbMiwgNV0pO1xyXG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuZW1wdHkoWzUsIDExXSk7XHJcblx0XHRcdGV4cGVjdChjb250ZXh0LmRvdCh4LCB5KS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMTFdKTtcclxuXHRcdH0pO1xyXG5cdFx0aXQoXCJDb3JyZWN0IHNoYXBlIGZvciAzLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuZW1wdHkoWzIsIDMsIDRdKTtcclxuXHRcdFx0dmFyIHkgPSBjb250ZXh0LmVtcHR5KFs3LCA0LCA4XSk7XHJcblx0XHRcdGV4cGVjdChjb250ZXh0LmRvdCh4LCB5KS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMywgNywgOF0pO1xyXG5cdFx0fSk7XHJcblx0XHRpdChcIkNvcnJlY3Qgc2hhcGUgZm9yIDQtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eShbMiwgMywgNCwgNV0pO1xyXG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuZW1wdHkoWzYsIDcsIDUsIDhdKTtcclxuXHRcdFx0ZXhwZWN0KGNvbnRleHQuZG90KHgsIHkpLnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAzLCA0LCA2LCA3LCA4XSk7XHJcblx0XHR9KTtcclxuXHRcdGl0KFwiQ29ycmVjdCB2YWx1ZSBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMiwgNV0pO1xyXG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoWzUsIDExXSk7XHJcblx0XHRcdGNvbnRleHQuZG90KHgsIHkpLmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoNjUpO1xyXG5cdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdGl0KFwiQ29ycmVjdCB2YWx1ZSBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzY0LCAgMiwgIDNdLFxyXG5cdFx0XHRcdFx0XHRcdFx0ICAgWzYxLCA2MCwgIDZdXSk7XHJcblx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWzkyLCA5OSwgIDEsICA4LCAxNV0sXHJcblx0XHRcdFx0XHRcdFx0XHQgICBbNjcsIDc0LCA1MSwgNTgsIDQwXSxcclxuXHRcdFx0XHRcdFx0XHRcdCAgIFs5OCwgODAsICA3LCAxNCwgMTZdXSk7XHJcblx0XHRcdHZhciB6ID0gY29udGV4dC5kb3QoeCwgeSk7XHJcblx0XHRcdHouZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbWyAgNjMxNiwgIDY3MjQsICAxODcsICA2NzAsIDEwODhdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDEwMjIwLCAxMDk1OSwgMzE2MywgNDA1MiwgMzQxMV1dKTtcclxuXHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcbn0pO1xyXG4iXX0=
