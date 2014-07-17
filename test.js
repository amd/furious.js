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
			cl = (typeof window.webcl !== "undefined") ? window.webcl : null;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9saWIvRGF0YVR5cGUuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9saWIvSlNDb250ZXh0LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL05EQXJyYXkuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9saWIvUE5hQ2xDb250ZXh0LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL2FsbG9jYXRvci5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL2xpYi9mdXJpb3VzLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL2pzbWF0aC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL2xpYi91dGlsLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL3dlYmNsL1dlYkNMQ29udGV4dC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9pbmRleC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvYXNzZXJ0aW9uLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvY29uZmlnLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvY29yZS9hc3NlcnRpb25zLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvaW50ZXJmYWNlL2Fzc2VydC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL2ludGVyZmFjZS9leHBlY3QuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS9pbnRlcmZhY2Uvc2hvdWxkLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvYWRkQ2hhaW5hYmxlTWV0aG9kLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvYWRkTWV0aG9kLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvYWRkUHJvcGVydHkuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9mbGFnLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvZ2V0QWN0dWFsLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvZ2V0RW51bWVyYWJsZVByb3BlcnRpZXMuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9nZXRNZXNzYWdlLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvZ2V0TmFtZS5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL2dldFBhdGhWYWx1ZS5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL2dldFByb3BlcnRpZXMuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9pbmRleC5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL2luc3BlY3QuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9vYmpEaXNwbGF5LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvb3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvb3ZlcndyaXRlTWV0aG9kLmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvb3ZlcndyaXRlUHJvcGVydHkuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy90ZXN0LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvdHJhbnNmZXJGbGFncy5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL3R5cGUuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9ub2RlX21vZHVsZXMvYXNzZXJ0aW9uLWVycm9yL2luZGV4LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbm9kZV9tb2R1bGVzL2RlZXAtZXFsL2luZGV4LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbm9kZV9tb2R1bGVzL2RlZXAtZXFsL2xpYi9lcWwuanMiLCIvVXNlcnMvbWFyYXQvUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9ub2RlX21vZHVsZXMvZGVlcC1lcWwvbm9kZV9tb2R1bGVzL3R5cGUtZGV0ZWN0L2luZGV4LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbm9kZV9tb2R1bGVzL2RlZXAtZXFsL25vZGVfbW9kdWxlcy90eXBlLWRldGVjdC9saWIvdHlwZS5qcyIsIi9Vc2Vycy9tYXJhdC9Qcm9qZWN0cy9mdXJpb3VzLmpzL3Rlc3QvQ29udGV4dC50ZXN0LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvdGVzdC9EYXRhVHlwZS50ZXN0LmpzIiwiL1VzZXJzL21hcmF0L1Byb2plY3RzL2Z1cmlvdXMuanMvdGVzdC9OREFycmF5LnRlc3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNpQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxWUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVtQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2x5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaGlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqUUE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIEEgbnVtZXJpY2FsIGRhdGEgdHlwZSBvYmplY3QuXG4gKlxuICogQGNsYXNzIERhdGFUeXBlXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIC0gdGhlIGFiYnJldmlhdGVkIG5hbWUgb2YgdGhlIGRhdGEgdHlwZS4gVGhlIGZvbGxvd2luZyBuYW1lcyBhcmUgc3VwcG9ydGVkOlxuICpcbiAqICAgICA8dGFibGU+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0aD5BYmJyZXZpYXRlZCBOYW1lPC90aD5cbiAqICAgICAgICAgICAgIDx0aD5JbnRlcnByZXRhdGlvbjwvdGg+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cImYzMlwiPC90ZD5cbiAqICAgICAgICAgICAgIDx0ZD5TaW5nbGUtcHJlY2lzaW9uICgzMi1iaXQpIElFRUUtNzU0IGZsb2F0aW5nLXBvaW50IHR5cGUuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwiZjY0XCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPkRvdWJsZS1wcmVjaXNpb24gKDY0LWJpdCkgSUVFRS03NTQgZmxvYXRpbmctcG9pbnQgdHlwZS48L3RkPlxuICogICAgICAgICA8L3RyPlxuICogICAgIDwvdGFibGU+XG4gKlxuICovXG5mdW5jdGlvbiBEYXRhVHlwZSh0eXBlKSB7XG5cdGlmIChbXCJmMzJcIiwgXCJmNjRcIl0uaW5kZXhPZih0eXBlKSA+PSAwKSB7XG5cdFx0dGhpcy50eXBlID0gdHlwZTtcblx0XHR0aGlzLnNpemUgPSB7XCJmMzJcIjogNCwgXCJmNjRcIjogOH1bdHlwZV07XG5cdFx0dGhpcy5lcHNpbG9uID0ge1wiZjMyXCI6IDEuMTkyMDkyODk1NTA3ODEyNWUtNywgXCJmNjRcIjogMi4yMjA0NDYwNDkyNTAzMTMxZS0xNn1bdHlwZV07XG5cdFx0dGhpcy5hcnJheVR5cGUgPSB7XCJmMzJcIjogRmxvYXQzMkFycmF5LCBcImY2NFwiOiBGbG9hdDY0QXJyYXl9W3R5cGVdO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVHlwZSBcIiArIHR5cGUgKyBcIiBpcyBub3Qgc3VwcG9ydGVkXCIpO1xuXHR9XG59XG5cbi8qKlxuICogQ29tcGFyZXMgdHdvIGRhdGEgdHlwZSBvYmplY3RzIGZvciBlcXVhbGl0eS5cbiAqXG4gKiBAbWV0aG9kIGVxdWFsc1xuICogQHBhcmFtIHthbnl9IG90aGVyIC0gYW4gb2JqZWN0IHRvIGNvbXBhcmUgdG8uXG4gKi9cbkRhdGFUeXBlLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbihvdGhlcikge1xuXHRyZXR1cm4gKG90aGVyIGluc3RhbmNlb2YgRGF0YVR5cGUpICYmICh0aGlzLmFycmF5VHlwZSA9PT0gb3RoZXIuYXJyYXlUeXBlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGF0YVR5cGU7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIE5EQXJyYXkgPSByZXF1aXJlKFwiLi9OREFycmF5XCIpO1xudmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWxcIik7XG52YXIganNtYXRoID0gcmVxdWlyZShcIi4vanNtYXRoXCIpO1xuXG4vKipcbiAqIFByb3ZpZGVzIG1ldGhvZHMgZm9yIGNyZWF0aW9uLCBtYW5pcHVsYXRpb24sIGFuZCBkZXN0cnVjdGlvbiBvZiBOLWRpbWVuc2lvbmFsIGFycmF5cy5cbiAqIEFyaXRobWV0aWMgb3BlcmF0aW9ucyBhcmUgcG9zc2libGUgb25seSBvbiBhcnJheXMgdGhhdCBiZWxvbmcgdG8gdGhlIHNhbWUgY29udGV4dC5cbiAqXG4gKiBAY2xhc3MgQ29udGV4dFxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEpTQ29udGV4dChvcHRpb25zLCBjYWxsYmFjaykge1xuXHRjYWxsYmFjayh0aGlzKTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGFuIHVuaW5pYWxpemVkIE4tZGltZW5zaW9uYWwgYXJyYXkuXG4gKlxuICogQG1ldGhvZCBlbXB0eVxuICogQHBhcmFtIHtOdW1iZXJ9IHNoYXBlIC0gdGhlIGRpbWVuc2lvbnMgb2YgdGhlIGFycmF5XG4gKiBAcGFyYW0ge0RhdGFUeXBlfSBkYXRhVHlwZSAtIHRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5lbXB0eSA9IGZ1bmN0aW9uKHNoYXBlLCBkYXRhVHlwZSkge1xuXHQvKiBUaGUgaXMgbm8gd2F5IHRvIGNyZWF0ZSB1bmluaXRpYWxpemVkIHR5cGVkIGFycmF5IGluIEphdmFTY3JpcHQgKi9cblx0cmV0dXJuIHRoaXMuemVyb3Moc2hhcGUsIGRhdGFUeXBlKTtcbn07XG5cbi8qKlxuICogQ29uc3RydWN0cyBhbiBOLWRpbWVuc2lvbmFsIGFycmF5IHdpdGggZWxlbWVudHMgaW5pdGlhbGl6ZWQgdG8gemVyby5cbiAqXG4gKiBAbWV0aG9kIHplcm9zXG4gKiBAcGFyYW0ge051bWJlcn0gc2hhcGUgLSB0aGUgZGltZW5zaW9ucyBvZiB0aGUgYXJyYXlcbiAqIEBwYXJhbSB7RGF0YVR5cGV9IGRhdGFUeXBlIC0gdGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICovXG5KU0NvbnRleHQucHJvdG90eXBlLnplcm9zID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2Uge1xuXHRcdGRhdGFUeXBlID0gdXRpbC5jaGVja0RhdGFUeXBlKGRhdGFUeXBlKTtcblx0fVxuXHR2YXIgYXJyYXkgPSBuZXcgTkRBcnJheShzaGFwZSwgZGF0YVR5cGUsIHRoaXMpO1xuXHRhcnJheS5fZGF0YSA9IG5ldyBkYXRhVHlwZS5hcnJheVR5cGUoYXJyYXkubGVuZ3RoKTtcblx0cmV0dXJuIGFycmF5O1xufTtcblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGFuIE4tZGltZW5zaW9uYWwgYXJyYXkgd2l0aCBlbGVtZW50cyBpbml0aWFsaXplZCB0byBvbmUuXG4gKlxuICogQG1ldGhvZCBvbmVzXG4gKiBAcGFyYW0ge051bWJlcn0gc2hhcGUgLSB0aGUgZGltZW5zaW9ucyBvZiB0aGUgYXJyYXlcbiAqIEBwYXJhbSB7RGF0YVR5cGV9IGRhdGFUeXBlIC0gdGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICovXG5KU0NvbnRleHQucHJvdG90eXBlLm9uZXMgPSBmdW5jdGlvbihzaGFwZSwgZGF0YVR5cGUpIHtcblx0LyogVGhlIGlzIG5vIHdheSB0byBjcmVhdGUgdW5pbml0aWFsaXplZCB0eXBlZCBhcnJheSBpbiBKYXZhU2NyaXB0ICovXG5cdHZhciBhcnJheSA9IHRoaXMuemVyb3Moc2hhcGUsIGRhdGFUeXBlKTtcblx0anNtYXRoLmZpbGwoYXJyYXkuX2RhdGEsIDEuMCk7XG5cdHJldHVybiBhcnJheTtcbn07XG5cbi8qKlxuICogQ29uc3RydWN0cyBhbiBOLWRpbWVuc2lvbmFsIGFycmF5IG9iamVjdCB3aXRoIHRoZSBwcm92aWRlZCBkYXRhLlxuICpcbiAqIEBtZXRob2QgYXJyYXlcbiAqIEBwYXJhbSB7TnVtYmVyW119IGRhdGEgLSB0aGUgYXJyYXkgZGF0YVxuICogQHBhcmFtIHtEYXRhVHlwZX0gZGF0YVR5cGUgLSB0aGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUuYXJyYXkgPSBmdW5jdGlvbihkYXRhLCBkYXRhVHlwZSkge1xuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XG5cdH0gZWxzZSB7XG5cdFx0ZGF0YVR5cGUgPSB1dGlsLmNoZWNrRGF0YVR5cGUoZGF0YVR5cGUpO1xuXHR9XG5cdHZhciBzaGFwZSA9IFtdO1xuXHR1dGlsLmRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZShkYXRhLCBzaGFwZSwgMCk7XG5cdHZhciBhcnJheSA9IHRoaXMuZW1wdHkoc2hhcGUsIGRhdGFUeXBlKTtcblx0dXRpbC5jb3B5QXJyYXlEYXRhUmVjdXJzaXZlKGFycmF5Ll9kYXRhLCBkYXRhLCBzaGFwZSwgMCwgMCk7XG5cdHJldHVybiBhcnJheTtcbn07XG5cbi8qKlxuICogRGUtYWxsb2NhdGVzIGRhdGEgYXNzb2NpYXRlZCB3aXRoIHRoZSBhcnJheS5cbiAqXG4gKiBAbWV0aG9kIF9pbnZhbGlkYXRlXG4gKiBAcHJpdmF0ZVxuICpcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXkgLSB0aGUgbi1kaW1lbnNpb25hbCBhcnJheSBvYmplY3Qgd2l0aCBkYXRhIHRvIGJlIGRlLWFsbG9jYXRlZC5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5faW52YWxpZGF0ZSA9IGZ1bmN0aW9uKGFycmF5KSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGFycmF5LCBcImFycmF5XCIpO1xuXHRhcnJheS5fZGF0YSA9IG51bGw7XG59O1xuXG4vKipcbiAqIEZldGNoZXMgTkRBcnJheSBkYXRhIGFuZCBhc3luY2hyb25vdXNseSByZXR1cm5zIGl0IGFzIEphdmFTY3JpcHQgYXJyYXlzIG9yIG51bWJlcnMuXG4gKlxuICogQG1ldGhvZCBnZXRcbiAqIEBhc3luY1xuICpcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXlzKiAtIE5EQXJyYXlzIHRvIGZldGNoLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBBIGNhbGxiYWNrIHRvIGJlIGNhbGxlZCB3aXRoIHRoZSBkYXRhIHdoZW4gaXQgaXMgYXZhaWxhYmxlLlxuICogQHBhcmFtIHtOdW1iZXJ8TnVtYmVyW119IGNhbGxiYWNrLmFycmF5cyogLSBKYXZhU2NyaXB0IG51bWJlcnMgb3IgbXVsdGlkaW1lbnNpb25hbCBhcnJheXMgd2l0aCB0aGUgZGF0YS4gVGhlIG51bWJlciBhbmQgb3JkZXIgb2YgYXJndW1lbnRzIG1hdGNoZXMgdGhlIE5EQXJyYXlzIHBhc3NlZCB0byB0aGUgbWV0aG9kIGNhbGwuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oKSB7XG5cdGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgYXJndW1lbnQgbWlzc2luZ1wiKTtcblx0fVxuXHR2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdO1xuXHQvKiBWYWxpZGF0ZSBhcmd1bWVudHMgKi9cblx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdCBsZWFzdCBvbmUgTkRBcnJheSBhcmd1bWVudCBleHBlY3RlZFwiKTtcblx0fVxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyArK2kpIHtcblx0XHR1dGlsLmNoZWNrTkRBcnJheShhcmd1bWVudHNbaV0sIFwiYXJndW1lbnQgXCIgKyBpKTtcblx0fVxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyArK2kpIHtcblx0XHRhcmd1bWVudHNbaV0uX2RlY1JlZigpO1xuXHR9XG5cdHZhciBjYWxsYmFja0FyZ3VtZW50cyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tBcmd1bWVudHMubGVuZ3RoOyArK2kpIHtcblx0XHR2YXIgYXJyYXkgPSBhcmd1bWVudHNbaV07XG5cdFx0aWYgKGFycmF5LnNoYXBlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBhcnJheS5fZGF0YVswXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmFyIGpzYXJyYXkgPSBuZXcgQXJyYXkoYXJyYXkuc2hhcGVbMF0pO1xuXHRcdFx0dXRpbC5jcmVhdGVBcnJheVJlY3Vyc2l2ZShhcnJheS5fZGF0YSwganNhcnJheSwgYXJyYXkuc2hhcGUsIDAsIDApO1xuXHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBqc2FycmF5O1xuXHRcdH1cblx0fVxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyArK2kpIHtcblx0XHRhcmd1bWVudHNbaV0uX3RyeUludmFsaWRhdGUoKTtcblx0fVxuXHRjYWxsYmFjay5hcHBseShudWxsLCBjYWxsYmFja0FyZ3VtZW50cyk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYW5vdGhlciBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEsIGJ1dCBkaWZmZXJlbnQgZGltZW5zaW9ucy5cbiAqXG4gKiBAbWV0aG9kIHJlc2hhcGVcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gc2hhcGUgLSBkaW1lbnNpb25zIG9mIHRoZSBuZXcgYXJyYXkuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUucmVzaGFwZSA9IGZ1bmN0aW9uKGFycmF5LCBzaGFwZSkge1xuXHRzaGFwZSA9IHV0aWwuY2hlY2tTaGFwZShzaGFwZSk7XG5cdGlmICh1dGlsLmNvbXB1dGVMZW5ndGgoc2hhcGUpICE9PSBhcnJheS5sZW5ndGgpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBzaGFwZSBpcyBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSBhcnJheVwiKTtcblx0fVxuXHR2YXIgb3V0ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGFycmF5LmRhdGFUeXBlLCB0aGlzKTtcblx0aWYgKGFycmF5Ll9kZWNSZWYoKSkge1xuXHRcdG91dC5fZGF0YSA9IG5ldyBvdXQuZGF0YVR5cGUuYXJyYXlUeXBlKG91dC5sZW5ndGgpO1xuXHRcdG91dC5fZGF0YS5zZXQoYXJyYXkuX2RhdGEpO1xuXHR9IGVsc2Uge1xuXHRcdG91dC5fZGF0YSA9IGFycmF5Ll9kYXRhO1xuXHRcdGFycmF5Ll90cnlJbnZhbGlkYXRlKCk7XG5cdH1cblx0cmV0dXJuIG91dDtcbn07XG5cbi8qKlxuICogRHVwbGljYXRlcyBhcnJheSBlbGVtZW50cyBhbG9uZyB0aGUgc3BlY2lmaWVkIGF4aXMuXG4gKlxuICogQG1ldGhvZCByZXBlYXRcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSByZXBlYXRzIC0gdGhlIG51bWJlciBvZiB0aW1lcyB0byByZXBlYXQgZWFjaCBlbGVtZW50LlxuICogQHBhcmFtIHtOdW1iZXJ9IGF4aXMgLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgZWxlbWVudHMgd2lsbCBiZSBkdXBsaWNhdGVkLlxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIGFuIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgcmVzdWx0LlxuICogQHJldHVybiB7TkRBcnJheX0gLSBhbiBOLWRpbWVuc2lvbmFsIGFycmF5IHdpdGggcmVwZWF0ZWQgZWxlbWVudHMgb2YgYXJyYXkgKiphKiouXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUucmVwZWF0ID0gZnVuY3Rpb24oYSwgcmVwZWF0cywgYXhpcywgb3V0KSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcblx0cmVwZWF0cyA9IHV0aWwuY2hlY2tSZXBlYXRzKHJlcGVhdHMpO1xuXHRheGlzID0gdXRpbC5jaGVja0F4aXMoYXhpcywgYS5zaGFwZS5sZW5ndGgpO1xuXHR2YXIgc2hhcGVBID0gYS5zaGFwZTtcblx0dmFyIHNoYXBlT3V0ID0gc2hhcGVBLnNsaWNlKDApO1xuXHRzaGFwZU91dFtheGlzXSAqPSByZXBlYXRzO1xuXHRhLl9kZWNSZWYoKTtcblx0dHJ5IHtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gdGhpcy5lbXB0eShzaGFwZU91dCwgYS5kYXRhVHlwZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShvdXQuc2hhcGUsIHNoYXBlT3V0KTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XG5cdFx0XHRvdXQuX2luY1JlZigpO1xuXHRcdH1cblx0XHR2YXIgb3V0ZXJTdHJpZGUgPSB1dGlsLmNvbXB1dGVPdXRlclN0cmlkZShzaGFwZUEsIGF4aXMpO1xuXHRcdHZhciBpbm5lclN0cmlkZSA9IHV0aWwuY29tcHV0ZUlubmVyU3RyaWRlKHNoYXBlQSwgYXhpcyk7XG5cdFx0anNtYXRoLnJlcGVhdChhLl9kYXRhLCBvdXQuX2RhdGEsIG91dGVyU3RyaWRlLCBpbm5lclN0cmlkZSwgc2hhcGVBW2F4aXNdLCByZXBlYXRzKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdGEuX2luY1JlZigpO1xuXHRcdHRocm93IGU7XG5cdH1cblx0YS5fdHJ5SW52YWxpZGF0ZSgpO1xuXHRyZXR1cm4gb3V0O1xufTtcblxudmFyIGJpbmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBiLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbiwgb3BlcmF0aW9uQ29uc3QsIG9wZXJhdGlvblJldkNvbnN0KSB7XG5cdHZhciBzaGFwZU91dCA9IG51bGwsIGRhdGFUeXBlT3V0ID0gbnVsbDtcblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0c2hhcGVPdXQgPSBhLnNoYXBlO1xuXHRcdGRhdGFUeXBlT3V0ID0gYS5kYXRhVHlwZTtcblx0XHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KGEuc2hhcGUsIGIuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XG5cdFx0fSBlbHNlIGlmICghdXRpbC5pc051bWJlcihiKSkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYlwiKTtcblx0XHR9XG5cdH0gZWxzZSBpZiAodXRpbC5pc051bWJlcihhKSkge1xuXHRcdHNoYXBlT3V0ID0gYi5zaGFwZTtcblx0XHRkYXRhVHlwZU91dCA9IGIuZGF0YVR5cGU7XG5cdFx0dXRpbC5jaGVja05EQXJyYXkoYiwgXCJiXCIpO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGFcIik7XG5cdH1cblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0YS5fZGVjUmVmKCk7XG5cdH1cblx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0Yi5fZGVjUmVmKCk7XG5cdH1cblx0dHJ5IHtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoc2hhcGVPdXQsIGRhdGFUeXBlT3V0LCBjb250ZXh0KTtcblx0XHRcdGlmICgoYSBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFhLl9oYXNSZWZzKCkpIHtcblx0XHRcdFx0b3V0Ll9kYXRhID0gYS5fZGF0YTtcblx0XHRcdH0gZWxzZSBpZiAoKGIgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYi5faGFzUmVmcygpKSB7XG5cdFx0XHRcdG91dC5fZGF0YSA9IGIuX2RhdGE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXQuX2RhdGEgPSBuZXcgZGF0YVR5cGVPdXQuYXJyYXlUeXBlKG91dC5sZW5ndGgpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoc2hhcGVPdXQsIG91dC5zaGFwZSk7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShkYXRhVHlwZU91dCwgb3V0LmRhdGFUeXBlKTtcblx0XHRcdG91dC5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRcdG9wZXJhdGlvbihhLl9kYXRhLCBiLl9kYXRhLCBvdXQuX2RhdGEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3BlcmF0aW9uQ29uc3QoYS5fZGF0YSwgK2IsIG91dC5fZGF0YSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdG9wZXJhdGlvblJldkNvbnN0KGIuX2RhdGEsICthLCBvdXQuX2RhdGEpO1xuXHRcdH1cblx0fSBjYXRjaCAoZSkge1xuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXG5cdFx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRhLl9pbmNSZWYoKTtcblx0XHR9XG5cdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRiLl9pbmNSZWYoKTtcblx0XHR9XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRhLl90cnlJbnZhbGlkYXRlKCk7XG5cdH1cblx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0Yi5fdHJ5SW52YWxpZGF0ZSgpO1xuXHR9XG5cdHJldHVybiBvdXQ7XG59O1xuXG52YXIgdW5hcnlBcml0aE9wID0gZnVuY3Rpb24oYSwgb3V0LCBjb250ZXh0LCBvcGVyYXRpb24pIHtcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xuXHRhLl9kZWNSZWYoKTtcblx0dHJ5IHtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoYS5zaGFwZSwgYS5kYXRhVHlwZSwgY29udGV4dCk7XG5cdFx0XHRpZiAoKGEgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYS5faGFzUmVmcygpKSB7XG5cdFx0XHRcdG91dC5fZGF0YSA9IGEuX2RhdGE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXQuX2RhdGEgPSBuZXcgYS5kYXRhVHlwZS5hcnJheVR5cGUob3V0Lmxlbmd0aCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBvdXQuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcblx0XHRcdG91dC5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdG9wZXJhdGlvbihhLl9kYXRhLCBvdXQuX2RhdGEpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0LyogUmVzdG9yZSB0aGUgcHJldmlvdXMgc3RhdGUgKi9cblx0XHRhLl9pbmNSZWYoKTtcblx0XHR0aHJvdyBlO1xuXHR9XG5cdGEuX3RyeUludmFsaWRhdGUoKTtcblx0cmV0dXJuIG91dDtcbn07XG5cbnZhciBheGlzUmVkdWNlT3AgPSBmdW5jdGlvbihhLCBheGlzLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbiwgYXhpc09wZXJhdGlvbikge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdGlmICh0eXBlb2YgYXhpcyA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHRvdXQgPSBjb250ZXh0LmVtcHR5KFtdLCBhLmRhdGFUeXBlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KFtdLCBvdXQuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcblx0XHRcdG91dC5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdG9wZXJhdGlvbihhLl9kYXRhLCBvdXQuX2RhdGEpO1xuXHRcdGEuX3RyeVJlbGVhc2UoKTtcblx0XHRyZXR1cm4gb3V0O1xuXHR9IGVsc2Uge1xuXHRcdGF4aXMgPSB1dGlsLmNoZWNrQXhpcyhheGlzLCBhLnNoYXBlLmxlbmd0aCk7XG5cdFx0dmFyIHNoYXBlT3V0ID0gdXRpbC5jb21wdXRlQXhpc1JlZHVjdGlvbk91dFNoYXBlKGEuc2hhcGUsIGF4aXMpO1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHR2YXIgb3V0ID0gY29udGV4dC5lbXB0eShzaGFwZU91dCwgYS5kYXRhVHlwZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShbXSwgb3V0LnNoYXBlKTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XG5cdFx0XHRvdXQuX2luY1JlZigpO1xuXHRcdH1cblx0XHRheGlzT3BlcmF0aW9uKGEuX2RhdGEsIG91dC5fZGF0YSxcblx0XHRcdHV0aWwuY29tcHV0ZU91dGVyU3RyaWRlKGEuc2hhcGUsIGF4aXMpLFxuXHRcdFx0dXRpbC5jb21wdXRlSW5uZXJTdHJpZGUoYS5zaGFwZSwgYXhpcyksXG5cdFx0XHRhLnNoYXBlW2F4aXNdKTtcblx0XHRhLl90cnlSZWxlYXNlKCk7XG5cdFx0cmV0dXJuIG91dDtcblx0fVxufTtcblxuLyoqXG4gKiBBZGRzIG9uZSBudW1iZXIgb3IgYXJyYXkgd2l0aCBhbm90aGVyIG51bWJlciBvciBhcnJheS5cbiAqIEFkZGl0aW9uIGlzIHBlcmZvcm1lZCBlbGVtZW50LWJ5LWVsZW1lbnQuXG4gKlxuICogQG1ldGhvZCBhZGRcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYSAtIG9uZSBudW1iZXIgb3IgYXJyYXkgdG8gYWRkLiBJZiAqKmIqKiBpcyBhICpOdW1iZXIqLCAqKmEqKiBtdXN0IGJlIGFuICpOREFycmF5Ki5cbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYiAtIGFub3RoZXIgbnVtYmVyIG9yIGFycmF5IHRvIGFkZC4gSWYgKiphKiogaXMgYSAqTnVtYmVyKiwgKipiKiogbXVzdCBiZSBhbiAqTkRBcnJheSouXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IHdoZXJlIHRoZSByZXN1bHQgaXMgdG8gYmUgc3RvcmVkLiBJZiBwcm92aWRlZCwgbXVzdCBtYXRjaCB0aGUgc2hhcGUgYW5kIGRhdGEgdHlwZSBvZiBpbnB1dCBhcnJheXMuXG4gKiBAcmV0dXJuIHtOREFycmF5fSAtIHRoZSByZXN1bHQgb2YgZWxlbWVudC13aXNlIGFkZGl0aW9uIG9mICoqYSoqIGFuZCAqKmIqKi5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcblx0cmV0dXJuIGJpbmFyeUFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzLCBqc21hdGguYWRkLCBqc21hdGguYWRkQ29uc3QsIGpzbWF0aC5hZGRDb25zdCk7XG59O1xuXG4vKipcbiAqIFN1YnRyYWN0cyBvbmUgbnVtYmVyIG9yIGFycmF5IGZyb20gYW5vdGhlciBudW1iZXIgb3IgYXJyYXkuXG4gKiBTdWJ0cmFjdGlvbiBpcyBwZXJmb3JtZWQgZWxlbWVudC1ieS1lbGVtZW50LlxuICpcbiAqIEBtZXRob2Qgc3ViXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IGEgLSB0aGUgbnVtYmVyIG9yIGFycmF5IHRvIHN1YnRyYWN0IGZyb20uIElmICoqYioqIGlzIGEgKk51bWJlciosICoqYSoqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBiIC0gdGhlIG51bWJlciBvciBhcnJheSB0byBzdWJ0cmFjdC4gSWYgKiphKiogaXMgYSAqTnVtYmVyKiwgKipiKiogbXVzdCBiZSBhbiAqTkRBcnJheSouXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IHdoZXJlIHRoZSByZXN1bHQgaXMgdG8gYmUgc3RvcmVkLiBJZiBwcm92aWRlZCwgbXVzdCBtYXRjaCB0aGUgc2hhcGUgYW5kIGRhdGEgdHlwZSBvZiBpbnB1dCBhcnJheXMuXG4gKiBAcmV0dXJuIHtOREFycmF5fSAtIHRoZSByZXN1bHQgb2YgZWxlbWVudC13aXNlIHN1YnRyYWN0aW9uIG9mICoqYioqIGZyb20gKiphKiouXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUuc3ViID0gZnVuY3Rpb24oYSwgYiwgb3V0KSB7XG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywganNtYXRoLnN1YiwganNtYXRoLnN1YkNvbnN0LCBqc21hdGguc3ViUmV2Q29uc3QpO1xufTtcblxuLyoqXG4gKiBNdWx0aXBsaWVzIG9uZSBudW1iZXIgb3IgYXJyYXkgYnkgYW5vdGhlciBudW1iZXIgb3IgYXJyYXkuXG4gKiBNdWx0aXBsaWNhdGlvbiBpcyBwZXJmb3JtZWQgZWxlbWVudC1ieS1lbGVtZW50LlxuICpcbiAqIEBtZXRob2QgbXVsXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IGEgLSBvbmUgbnVtYmVyIG9yIGFycmF5IHRvIG11bHRpcGx5LiBJZiAqKmIqKiBpcyBhICpOdW1iZXIqLCAqKmEqKiBtdXN0IGJlIGFuICpOREFycmF5Ki5cbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYiAtIGFub3RoZXIgbnVtYmVyIG9yIGFycmF5IHRvIG11bHRpcGx5LiBJZiAqKmEqKiBpcyBhICpOdW1iZXIqLCAqKmIqKiBtdXN0IGJlIGFuICpOREFycmF5Ki5cbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgd2hlcmUgdGhlIHJlc3VsdCBpcyB0byBiZSBzdG9yZWQuIElmIHByb3ZpZGVkLCBtdXN0IG1hdGNoIHRoZSBzaGFwZSBhbmQgZGF0YSB0eXBlIG9mIGlucHV0IGFycmF5cy5cbiAqIEByZXR1cm4ge05EQXJyYXl9IC0gdGhlIHJlc3VsdCBvZiBlbGVtZW50LXdpc2UgbXVsdGlwbGljYXRpb24gb2YgKiphKiogYW5kICoqYioqLlxuICovXG5KU0NvbnRleHQucHJvdG90eXBlLm11bCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHRyZXR1cm4gYmluYXJ5QXJpdGhPcChhLCBiLCBvdXQsIHRoaXMsIGpzbWF0aC5tdWwsIGpzbWF0aC5tdWxDb25zdCwganNtYXRoLm11bENvbnN0KTtcbn07XG5cbi8qKlxuICogRGl2aWRlcyBvbmUgbnVtYmVyIG9yIGFycmF5IGJ5IGFub3RoZXIgbnVtYmVyIG9yIGFycmF5LlxuICogRGl2aXNpb24gaXMgcGVyZm9ybWVkIGVsZW1lbnQtYnktZWxlbWVudC5cbiAqXG4gKiBAbWV0aG9kIGRpdlxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBhIC0gdGhlIG51bWJlciBvciBhcnJheSB0byBkaXZpZGUuIElmICoqYioqIGlzIGEgKk51bWJlciosICoqYSoqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBiIC0gdGhlIG51bWJlciBvciBhcnJheSB0byBkaXZpZGUgYnkuIElmICoqYSoqIGlzIGEgKk51bWJlciosICoqYioqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSB3aGVyZSB0aGUgcmVzdWx0IGlzIHRvIGJlIHN0b3JlZC4gSWYgcHJvdmlkZWQsIG11c3QgbWF0Y2ggdGhlIHNoYXBlIGFuZCBkYXRhIHR5cGUgb2YgaW5wdXQgYXJyYXlzLlxuICogQHJldHVybiB7TkRBcnJheX0gLSB0aGUgcmVzdWx0IG9mIGVsZW1lbnQtd2lzZSBkaXZpc2lvbiBvZiAqKmEqKiBieSAqKmIqKi5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5kaXYgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcblx0cmV0dXJuIGJpbmFyeUFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzLCBqc21hdGguZGl2LCBqc21hdGguZGl2Q29uc3QsIGpzbWF0aC5kaXZSZXZDb25zdCk7XG59O1xuXG5KU0NvbnRleHQucHJvdG90eXBlLm1pbiA9IGZ1bmN0aW9uKGEsIGF4aXMsIG91dCkge1xuXHRyZXR1cm4gYXhpc1JlZHVjZU9wKGEsIGF4aXMsIG91dCwgdGhpcywganNtYXRoLm1pbiwganNtYXRoLmF4aXNNaW4pO1xufTtcblxuSlNDb250ZXh0LnByb3RvdHlwZS5tYXggPSBmdW5jdGlvbihhLCBheGlzLCBvdXQpIHtcblx0cmV0dXJuIGF4aXNSZWR1Y2VPcChhLCBheGlzLCBvdXQsIHRoaXMsIGpzbWF0aC5tYXgsIGpzbWF0aC5heGlzTWF4KTtcbn07XG5cbkpTQ29udGV4dC5wcm90b3R5cGUuc3VtID0gZnVuY3Rpb24oYSwgYXhpcywgb3V0KSB7XG5cdHJldHVybiBheGlzUmVkdWNlT3AoYSwgYXhpcywgb3V0LCB0aGlzLCBqc21hdGguc3VtLCBqc21hdGguYXhpc1N1bSk7XG59O1xuXG4vKipcbiAqIE5lZ2F0ZXMgYXJyYXkgZWxlbWVudHMuXG4gKlxuICogQG1ldGhvZCBuZWdcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBlbGVtZW50cyB0byBiZSBuZWdhdGVkLlxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSBmb3IgbmVnYXRlZCBlbGVtZW50cy4gSWYgc3VwcGxpZWQsIG11c3QgbWF0Y2ggdGhlIGRpbWVuc2lvbnMgYW5kIGRhdGEgdHlwZSBvZiB0aGUgKiphKiogYXJyYXkuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUubmVnID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGgubmVnKTtcbn07XG5cbi8qKlxuICogQ29tcHV0ZXMgYWJzb2x1dGUgdmFsdWUgb2YgYXJyYXkgZWxlbWVudHMuXG4gKlxuICogQG1ldGhvZCBhYnNcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBpbnB1dCBlbGVtZW50cy5cbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgZm9yIGNvbXB1dGVkIGFic29sdXRlIHZhbHVlcy4gSWYgc3VwcGxpZWQsIG11c3QgbWF0Y2ggdGhlIGRpbWVuc2lvbnMgYW5kIGRhdGEgdHlwZSBvZiB0aGUgKiphKiogYXJyYXkuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUuYWJzID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGguYWJzKTtcbn07XG5cbi8qKlxuICogRXhwb25lbnRpYXRlcyBhcnJheSBlbGVtZW50cy5cbiAqXG4gKiBAbWV0aG9kIGV4cFxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGFycmF5IG9mIGVsZW1lbnRzIHRvIGJlIGV4cG9uZW50aWF0ZWQuXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IGZvciBleHBvbmVudGlhdGVkIGVsZW1lbnRzLiBJZiBzdXBwbGllZCwgbXVzdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBhbmQgZGF0YSB0eXBlIG9mIHRoZSAqKmEqKiBhcnJheS5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5leHAgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIGpzbWF0aC5leHApO1xufTtcblxuLyoqXG4gKiBDb21wdXRlcyBsb2dhcml0aG0gb2YgYXJyYXkgZWxlbWVudHMuXG4gKlxuICogQG1ldGhvZCBsb2dcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBpbnB1dCBlbGVtZW50cy5cbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgZm9yIGNvbXB1dGVkIGxvZ2FyaXRobSB2YWx1ZXMuIElmIHN1cHBsaWVkLCBtdXN0IG1hdGNoIHRoZSBkaW1lbnNpb25zIGFuZCBkYXRhIHR5cGUgb2YgdGhlICoqYSoqIGFycmF5LlxuICovXG5KU0NvbnRleHQucHJvdG90eXBlLmxvZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywganNtYXRoLmxvZyk7XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIHNxdWFyZSByb290IG9mIGFycmF5IGVsZW1lbnRzLlxuICpcbiAqIEBtZXRob2Qgc3FydFxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGFycmF5IG9mIGlucHV0IGVsZW1lbnRzLlxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSBmb3IgY29tcHV0ZWQgc3F1YXJlIHJvb3QgdmFsdWVzLiBJZiBzdXBwbGllZCwgbXVzdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBhbmQgZGF0YSB0eXBlIG9mIHRoZSAqKmEqKiBhcnJheS5cbiAqL1xuSlNDb250ZXh0LnByb3RvdHlwZS5zcXJ0ID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGguc3FydCk7XG59O1xuXG4vKipcbiAqIFNxdWFyZXMgYXJyYXkgZWxlbWVudHMuXG4gKlxuICogQG1ldGhvZCBzcXVhcmVcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBlbGVtZW50cyB0byBiZSBzcXVhcmVkLlxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSBmb3Igc3F1YXJlZCBlbGVtZW50cy4gSWYgc3VwcGxpZWQsIG11c3QgbWF0Y2ggdGhlIGRpbWVuc2lvbnMgYW5kIGRhdGEgdHlwZSBvZiB0aGUgKiphKiogYXJyYXkuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUuc3F1YXJlID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBqc21hdGguc3F1YXJlKTtcbn07XG5cbi8qKlxuICogQ29tcHV0ZXMgdGhlIGRvdCBwcm9kdWN0IG9mIHR3byBOLWRpbWVuc2lvbmFsIGFycmF5cy5cbiAqXG4gKiBAbWV0aG9kIGRvdFxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGZpcnN0IGlucHV0IGFycmF5LlxuICogQHBhcmFtIHtOREFycmF5fSBiIC0gdGhlIHNlY29uZCBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgb3V0cHV0IGFycmF5LiBJZiBzdXBwbGllZCwgbXVzdCBtYXRjaCB0aGUgZGF0YSB0eXBlIG9mICoqYSoqIGFuZCAqKmIqKiBhcnJheXMgYW5kIGhhdmUgdGhlIGV4cGVjdGVkIHNoYXBlLiBDYW4gbm90IGJlIHRoZSBzYW1lIGFycmF5IGFzICoqYSoqIG9yICoqYioqLlxuICogQHJldHVybiB7TkRBcnJheX0gLSB0aGUgYXJyYXkgd2l0aCB0aGUgZG90IHByb2R1Y3Qgb2YgKiphKiogYW5kICoqYioqLlxuICovXG5KU0NvbnRleHQucHJvdG90eXBlLmRvdCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdHV0aWwuY2hlY2tOREFycmF5KGIsIFwiYlwiKTtcblx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XG5cblx0LyogVGhlIGF4aXMgb2YgYiB1c2VkIGluIHJlZHVjdGlvbjogYXhpcyAwIGZvciAxRCBhcnJheSwgc2Vjb25kLXRvLWxhc3QgYXhpcyBmb3IgTkQgYXJyYXkgKi9cblx0dmFyIGFBeGlzID0gTWF0aC5tYXgoYS5zaGFwZS5sZW5ndGggLSAxLCAwKTtcblx0dmFyIGJBeGlzID0gTWF0aC5tYXgoYi5zaGFwZS5sZW5ndGggLSAyLCAwKTtcblx0dmFyIHJlZHVjdGlvbkRpbSA9IGEuc2hhcGVbYUF4aXNdO1xuXHRpZiAocmVkdWN0aW9uRGltICE9PSBiLnNoYXBlW2JBeGlzXSkge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiQXJyYXlzIGhhdmUgaW5jb21wYXRpYmxlIHJlZHVjdGlvbiBkaW1lbnNpb25zXCIpO1xuXHR9XG5cdHZhciBzaGFwZU91dCA9IFtdLCBzdHJpZGVBID0gMSwgb3V0ZXJTdHJpZGVCID0gMSwgaW5uZXJTdHJpZGVCID0gMTtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhQXhpczsgaSsrKSB7XG5cdFx0c2hhcGVPdXQucHVzaChhLnNoYXBlW2ldKTtcblx0XHRzdHJpZGVBICo9IGEuc2hhcGVbaV07XG5cdH1cblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBiLnNoYXBlLmxlbmd0aDsgaSsrKSB7XG5cdFx0dmFyIGRpbSA9IGIuc2hhcGVbaV07XG5cdFx0aWYgKGkgPCBiQXhpcykge1xuXHRcdFx0b3V0ZXJTdHJpZGVCICo9IGRpbTtcblx0XHRcdHNoYXBlT3V0LnB1c2goZGltKTtcblx0XHR9IGVsc2UgaWYgKGkgPiBiQXhpcykge1xuXHRcdFx0aW5uZXJTdHJpZGVCICo9IGRpbTtcblx0XHRcdHNoYXBlT3V0LnB1c2goZGltKTtcblx0XHR9XG5cdH1cblx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRvdXQgPSB0aGlzLmVtcHR5KHNoYXBlT3V0LCBhLmRhdGFUeXBlKTtcblx0fSBlbHNlIGlmIChvdXQgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcblx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShvdXQuc2hhcGUsIHNoYXBlT3V0KTtcblx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShvdXQuZGF0YVR5cGUsIGEuZGF0YVR5cGUpO1xuXHRcdHV0aWwuY2hlY2tEaWZmZXJlbnROREFycmF5cyhhLCBvdXQsIFwiYVwiLCBcIm91dFwiKTtcblx0XHR1dGlsLmNoZWNrRGlmZmVyZW50TkRBcnJheXMoYiwgb3V0LCBcImJcIiwgXCJvdXRcIik7XG5cdFx0b3V0Ll9pbmNSZWYoKTtcblx0fVxuXHRqc21hdGguZG90KGEuX2RhdGEsIGIuX2RhdGEsIG91dC5fZGF0YSwgc3RyaWRlQSwgb3V0ZXJTdHJpZGVCLCBpbm5lclN0cmlkZUIsIHJlZHVjdGlvbkRpbSk7XG5cdGEuX3RyeVJlbGVhc2UoKTtcblx0Yi5fdHJ5UmVsZWFzZSgpO1xuXHRyZXR1cm4gb3V0O1xufTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFyaXRobWV0aWMgc2VxdWVuY2UuXG4gKlxuICogQG1ldGhvZCBsaW5zcGFjZVxuICogQHBhcmFtIHtOdW1iZXJ9IHN0YXJ0IC0gdGhlIHN0YXJ0aW5nIGVuZHBvaW50IG9mIHRoZSBzZXF1ZW5jZS4gTXVzdCBiZSBhIGZpbml0ZSBudW1iZXIuXG4gKiBAcGFyYW0ge051bWJlcn0gc3RvcCAtIHRoZSBmaW5hbCBlbmRwb2ludCBvZiB0aGUgc2VxdWVuY2UuIE11c3QgYmUgYSBmaW5pdGUgbnVtYmVyLlxuICogQHBhcmFtIHtOdW1iZXJ9IFtzYW1wbGVzPTUwXSAtIHRoZSBudW1iZXIgb2Ygc2FtcGxlcyBpbiB0aGUgc2VxdWVuY3kuIE11c3QgYmUgYSBwb3NpdGl2ZSBpbnRlZ2VyLlxuICogQHBhcmFtIHtCb29sZWFufSBbY2xvc2VkPXRydWVdIC0gYW4gaW5kaWNhdG9yIG9mIHdoZXRoZXIgdGhlIGZpbmFsIGVuZHBvaW50IChgc3RvcGAgYXJndW1lbnQpIHNob3VsZCBiZSBpbmNsdWRlZCBpbiB0aGUgc2VxdWVuY2UuXG4gKi9cbkpTQ29udGV4dC5wcm90b3R5cGUubGluc3BhY2UgPSBmdW5jdGlvbihzdGFydCwgc3RvcCwgc2FtcGxlcywgY2xvc2VkKSB7XG5cdGlmICghdXRpbC5pc1JlYWwoc3RhcnQpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzdGFydCArIFwiIGlzIG5vdCBhIHJlYWwgbnVtYmVyXCIpO1xuXHR9XG5cdGlmICghdXRpbC5pc1JlYWwoc3RvcCkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHN0b3AgKyBcIiBpcyBub3QgYSByZWFsIG51bWJlclwiKTtcblx0fVxuXHRpZiAodHlwZW9mIHNhbXBsZXMgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHQvKiBEZWZhdWx0IHZhbHVlIGluIE51bVB5ICovXG5cdFx0c2FtcGxlcyA9IDUwO1xuXHR9IGVsc2UgaWYgKCF1dGlsLmlzSW50KHNhbXBsZXMpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzYW1wbGVzICsgXCIgaXMgbm90IGFuIGludGVnZXJcIik7XG5cdH0gZWxzZSBpZiAoc2FtcGxlcyA8PSAwKSB7XG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJUaGUgbnVtYmVyIG9mIHNhbXBsZXMgbXVzdCBiZSBwb3NpdGl2ZVwiKTtcblx0fVxuXHRpZiAodHlwZW9mIGNsb3NlZCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGNsb3NlZCA9IHRydWU7XG5cdH1cblx0aWYgKGNsb3NlZCAmJiAoc2FtcGxlcyA9PT0gMSkpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBudW1iZXIgb2Ygc2FtcGxlcyBtdXN0IGJlIGEgbGVhc3QgMiAoZm9yIHN0YXJ0IGFuZCBlbmQgcG9pbnRzKVwiKTtcblx0fVxuXHR2YXIgYXJyYXkgPSB0aGlzLmVtcHR5KHNhbXBsZXMsIG5ldyBEYXRhVHlwZShcImY2NFwiKSk7XG5cdHZhciBkYXRhID0gYXJyYXkuX2RhdGE7XG5cdHZhciByYW5nZSA9IHN0b3AgLSBzdGFydDtcblx0dmFyIG4gPSAoY2xvc2VkKSA/IHNhbXBsZXMgLSAxIDogc2FtcGxlcztcblx0dmFyIHN0ZXAgPSByYW5nZSAvIG47XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgc2FtcGxlczsgaSsrKSB7XG5cdFx0ZGF0YVtpXSA9IHN0YXJ0ICsgc3RlcCAqIGk7XG5cdH1cblx0cmV0dXJuIGFycmF5O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBKU0NvbnRleHQ7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xudmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XG5cbmZ1bmN0aW9uIHNoYXBlVG9MZW5ndGgoc2hhcGUpIHtcblx0dmFyIGxlbmd0aCA9IDE7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgc2hhcGUubGVuZ3RoOyBpKyspIHtcblx0XHRsZW5ndGggKj0gc2hhcGVbaV07XG5cdH1cblx0cmV0dXJuIGxlbmd0aDtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVNdWx0aUluZGV4KGluZGV4LCBzaGFwZSkge1xuXHRpZiAoaW5kZXgubGVuZ3RoICE9IHNoYXBlLmxlbmd0aCkge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVGhlIG11bHRpLWluZGV4IFwiICsgaW5kZXggKyBcIiBkb2VzIG5vdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBcIiArIHNoYXBlICsgXCIgb2YgdGhlIGFycmF5XCIpO1xuXHR9XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgaW5kZXgubGVuZ3RoOyBpKyspIHtcblx0XHRpZiAoIXV0aWwuaXNJbnQoaW5kZXhbaV0pKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiVGhlIHN1Yi1pbmRleCBcIiArIGluZGV4W2ldICsgXCIgaXMgbm90IGFuIGludGVnZXJcIik7XG5cdFx0fVxuXHRcdGlmICgoaW5kZXhbaV0gPCAwKSB8fCAoaW5kZXhbaV0gPj0gc2hhcGVbaV0pKSB7XG5cdFx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBzdWItaW5kZXggXCIgKyBpbmRleFtpXSArIFwiIGlzIG91dCBvZiBib3VuZHNcIik7XG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogQW4gb3BhcXVlIE4tZGltZW5zaW9uYWwgYXJyYXkgb2JqZWN0LlxuICpcbiAqIEBjbGFzcyBOREFycmF5XG4gKi9cblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGFuIE5EQXJyYXkgb2JqZWN0IHdpdGhvdXQgZGF0YS5cbiAqIE5vcm1hbGx5IHRoaXMgY29uc3RydWN0b3IgaXMgY2FsbGVkIGZyb20gYXJyYXkgY29uc3RydWN0aW9uIG1ldGhvZHMgb2YgY29tcHV0YXRpb25hbCBjb250ZXh0cy5cbiAqIFRoZSBjYWxsaW5nIGZ1bmN0aW9uIGlzIHJlc3BvbnNpYmxlIGZvciBpbml0aWFsaXppbmcgdGhlIGRhdGEgZm9yIHRoZSBhcnJheS5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCBjb250ZXh0KSB7XG5cdGlmICh0eXBlb2YgY29udGV4dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIkNvbnRleHQgbm90IGRlZmluZWRcIik7XG5cdH1cblx0aWYgKCF1dGlsLmlzUG9zaXRpdmVJbnRBcnJheShzaGFwZSkgJiYgIXV0aWwuaXNQb3NpdGl2ZUludChzaGFwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHNoYXBlICsgXCIgaXMgbm90IGEgdmFsaWQgYXJyYXkgc2hhcGVcIik7XG5cdH1cblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xuXHR9XG5cdHRoaXMuc2hhcGUgPSB1dGlsLmFzSW50QXJyYXkoc2hhcGUpO1xuXHR0aGlzLmRhdGFUeXBlID0gZGF0YVR5cGU7XG5cdHRoaXMuX2NvbnRleHQgPSBjb250ZXh0O1xuXHR0aGlzLmxlbmd0aCA9IHNoYXBlVG9MZW5ndGgodGhpcy5zaGFwZSk7XG5cdHRoaXMuX2xvY2tDb3VudCA9IDA7XG5cdHRoaXMuX3JlZkNvdW50ID0gMTtcblx0dGhpcy5faXNWYWxpZCA9IHRydWU7XG59XG5cbi8qKlxuICogTG9ja3MgdGhlIGFycmF5IHJlZmVyZW5jZSBjb3VudGVyLlxuICogV2hpbGUgdGhlIGFycmF5IGlzIGxvY2tlZCwgZnVuY3Rpb25zIGFuZCBtZXRob2RzIHRoYXQgb3BlcmF0ZSBvbiB0aGlzIGFycmF5IGRvIG5vdCBkZWNyZWFzZSBpdHMgcmVmZXJlbmNlIGNvdW50LlxuICogVGhlIGFycmF5IGNhbiBiZSBsb2NrZWQgbXVsdGlwbGUgdGltZXMsIGFuZCB3b3VsZCBuZWVkIGp1c3QgYXMgbWFueSB1bmxvY2sgY2FsbHMgdG8gbGlmdCB0aGUgbG9jay5cbiAqIElmIHRoZSBhcnJheSBpcyBub3QgdmFsaWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxuICpcbiAqIEBtZXRob2QgbG9ja1xuICogQGNoYWluYWJsZVxuICovXG5OREFycmF5LnByb3RvdHlwZS5sb2NrID0gZnVuY3Rpb24oKSB7XG5cdGlmICghdGhpcy5pc1ZhbGlkKCkpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdHRlbXB0ZWQgdG8gbG9jayBhbiBpbnZhbGlkYXRlZCBhcnJheVwiKTtcblx0fVxuXHR0aGlzLl9sb2NrQ291bnQrKztcblx0cmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFVubG9ja3MgdGhlIGFycmF5IHJlZmVyZW5jZSBjb3VudGVyLlxuICogT25jZSB0aGUgYXJyYXkgaXMgdW5sb2NrZWQsIGZ1bmN0aW9ucyBhbmQgbWV0aG9kcyB0aGF0IG9wZXJhdGUgb24gdGhpcyBhcnJheSBkZWNyZWFzZSBpdHMgcmVmZXJlbmNlIGNvdW50IGFuZCwgaWYgdGhlIHJlZmVyZW5jZSBjb3VudCByZWFjaGVzIHplcm8sIGludmFsaWRhdGUgdGhlIGFycmF5LlxuICogSWYgdGhlIGFycmF5IHdhcyBsb2NrZWQgbXVsdGlwbGUgdGltZXMsIGl0IHdvdWxkIG5lZWQganVzdCBhcyBtYW55IHVubG9jayBjYWxscyB0byBsaWZ0IHRoZSBsb2NrLlxuICogSWYgdGhlIGFycmF5IGlzIG5vdCBsb2NrZWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxuICpcbiAqIEBtZXRob2QgdW5sb2NrXG4gKiBAY2hhaW5hYmxlXG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLnVubG9jayA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoIXRoaXMuaXNMb2NrZWQoKSkge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIkF0dGVtcHRlZCB0byBsb2NrIGEgdW5sb2NrZWQgYXJyYXlcIik7XG5cdH1cblx0dGhpcy5fbG9ja0NvdW50LS07XG5cdHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBDaGVja2VzIGlmIHRoZSBhcnJheSBpcyBpbiB0aGUgbG9ja2VkIHN0YXRlLlxuICogSWYgdGhlIGFycmF5IGlzIG5vdCB2YWxpZCwgdGhpcyBtZXRob2QgcmV0dXJuIGZhbHNlLlxuICpcbiAqIEBtZXRob2QgaXNMb2NrZWRcbiAqXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaXMgdGhlIGFycmF5IGlzIGxvY2tlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlXG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLmlzTG9ja2VkID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLl9sb2NrQ291bnQgPiAwO1xufTtcblxuLyoqXG4gKiBJbmNyZW1lbnRzIHRoZSBhcnJheSByZWZlcmVuY2UgY291bnQuXG4gKiBJZiB0aGUgYXJyYXkgaXMgaW52YWxpZCBvciBsb2NrZWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxuICpcbiAqIEBtZXRob2QgcmV0YWluXG4gKiBAY2hhaW5hYmxlXG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLnJldGFpbiA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoIXRoaXMuaXNWYWxpZCgpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXR0ZW1wdGVkIHRvIHJlbGVhc2UgYW4gaW52YWxpZGF0ZWQgYXJyYXlcIik7XG5cdH1cblx0aWYgKHRoaXMuaXNMb2NrZWQoKSkge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIkF0dGVtcHRlZCB0byByZXRhaW4gYSBsb2NrZWQgYXJyYXlcIik7XG5cdH1cblx0dGhpcy5fcmVmQ291bnQrKztcblx0cmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIERlY3JlbWVudHMgdGhlIGFycmF5IHJlZmVyZW5jZSBjb3VudC4gSWYgdGhlIHJlZmVyZW5jZSBjb3VudCB0dXJucyB6ZXJvLCB0aGUgYXJyYXkgYmVjb21lcyBpbnZhbGlkIGFuZCBpdHMgZGF0YSBidWZmZXIgaXMgZGVhbGxvY2F0ZWQuXG4gKiBJZiB0aGUgYXJyYXkgaXMgaW52YWxpZCBvciBsb2NrZWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxuICpcbiAqIEBtZXRob2QgcmVsZWFzZVxuICogQGNoYWluYWJsZVxuICovXG5OREFycmF5LnByb3RvdHlwZS5yZWxlYXNlID0gZnVuY3Rpb24oKSB7XG5cdGlmICghdGhpcy5pc1ZhbGlkKCkpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdHRlbXB0ZWQgdG8gcmVsZWFzZSBhbiBpbnZhbGlkYXRlZCBhcnJheVwiKTtcblx0fVxuXHRpZiAodGhpcy5pc0xvY2tlZCgpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXR0ZW1wdGVkIHRvIHJlbGVhc2UgYSBsb2NrZWQgYXJyYXlcIik7XG5cdH1cblx0aWYgKC0tdGhpcy5fcmVmQ291bnQgPT09IDApIHtcblx0XHR0aGlzLl9jb250ZXh0Ll9pbnZhbGlkYXRlKHRoaXMpO1xuXHR9XG5cdHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBGb3IgYSBub24tbG9ja2VkIGFycmF5LCBkZWNyZW1lbnRzIHRoZSBhcnJheSByZWZlcmVuY2UgY291bnQuIElmIHRoZSByZWZlcmVuY2UgY291bnQgdHVybnMgemVybywgdGhlIGFycmF5IGJlY29tZXMgaW52YWxpZCBhbmQgaXRzIGRhdGEgYnVmZmVyIGlzIGRlYWxsb2NhdGVkLlxuICogSWYgdGhlIGFycmF5IGlzIGludmFsaWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxuICpcbiAqIEBtZXRob2QgdHJ5UmVsZWFzZVxuICogQGNoYWluYWJsZVxuICovXG5OREFycmF5LnByb3RvdHlwZS50cnlSZWxlYXNlID0gZnVuY3Rpb24oKSB7XG5cdGlmICghdGhpcy5pc1ZhbGlkKCkpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdHRlbXB0ZWQgdG8gcmVsZWFzZSBhbiBpbnZhbGlkYXRlZCBhcnJheVwiKTtcblx0fVxuXHRpZiAoIXRoaXMuaXNMb2NrZWQoKSkge1xuXHRcdGlmICgtLXRoaXMuX3JlZkNvdW50ID09PSAwKSB7XG5cdFx0XHR0aGlzLl9jb250ZXh0Ll9pbnZhbGlkYXRlKHRoaXMpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogRm9yIGEgbm9uLWxvY2tlZCBhcnJheSwgZGVjcmVtZW50cyB0aGUgYXJyYXkgcmVmZXJlbmNlIGNvdW50LiBJZiB0aGUgcmVmZXJlbmNlIGNvdW50IHR1cm5zIHplcm8sIHRoZSBhcnJheSBiZWNvbWVzIGludmFsaWQgYW5kIGl0cyBkYXRhIGJ1ZmZlciBpcyBkZWFsbG9jYXRlZC5cbiAqIFRoZSBhcnJheSBtdXN0IGJlIHZhbGlkIHRvIHBlcmZvcm0gdGhpcyBvcGVyYXRpb24uXG4gKlxuICogQHByaXZhdGVcbiAqIEBtZXRob2QgX3RyeVJlbGVhc2VcbiAqIEBjaGFpbmFibGVcbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuX3RyeVJlbGVhc2UgPSBmdW5jdGlvbigpIHtcblx0aWYgKCF0aGlzLmlzTG9ja2VkKCkpIHtcblx0XHRpZiAoLS10aGlzLl9yZWZDb3VudCA9PT0gMCkge1xuXHRcdFx0dGhpcy5fY29udGV4dC5faW52YWxpZGF0ZSh0aGlzKTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEludmFsaWRhdGVzIHRoZSBhcnJheSBhbmQgZGVhbGxvY2F0ZXMgaXRzIGRhdGEgYnVmZmVyLCByZWdhcmRsZXNzIG9mIGxvY2tzIGFuZCByZWZlcmVuY2UgY291bnQuXG4gKiBDYWxsaW5nIHRoaXMgbWV0aG9kIG9uIGFuIGludmFsaWRhdGVkIGFycmF5IGhhcyBubyBlZmZlY3QuXG4gKlxuICogQG1ldGhvZCBpbnZhbGlkYXRlXG4gKiBAY2hhaW5hYmxlXG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLmludmFsaWRhdGUgPSBmdW5jdGlvbigpIHtcblx0aWYgKHRoaXMuaXNWYWxpZCgpKSB7XG5cdFx0dGhpcy5fY29udGV4dC5faW52YWxpZGF0ZSh0aGlzKTtcblx0XHR0aGlzLl9pc1ZhbGlkID0gZmFsc2U7XG5cdFx0dGhpcy5fcmVmQ291bnQgPSAwO1xuXHRcdHRoaXMuX2xvY2tDb3VudCA9IDA7XG5cdH1cblx0cmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIENoZWNrZXMgaWYgdGhlIGFycmF5IGlzIGluIGEgdmFsaWQgc3RhdGUuXG4gKiBJZiB0aGUgYXJyYXkgaXMgbm90IGluIGEgdmFsaWQgc3RhdGUsIGl0cyBkYXRhIGJ1ZmZlciB3YXMgZGVhbGxvY2F0ZWQsIGFuZCBhbnkgb3BlcmF0aW9ucyBvbiB0aGUgYXJyYXkgd2lsbCB0aHJvdyBhbiBlcnJvci5cbiAqXG4gKiBAbWV0aG9kIGlzVmFsaWRcbiAqXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaXMgdGhlIGFycmF5IGlzIHZhbGlkIGFuZCBmYWxzZSBvdGhlcndpc2VcbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuaXNWYWxpZCA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdGhpcy5faXNWYWxpZDtcbn07XG5cbi8qKlxuICogRGVjcmVtZW50cyB0aGUgYXJyYXkgcmVmZXJlbmNlIGNvdW50IGlmIHRoZSBhcnJheSBpcyBub3QgbG9ja2VkLlxuICogVGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBpbnZhbGlkYXRlIHRoZSBhcnJheSB3aGVuIHRoZSByZWZlcmVuY2UgY291bnQgcmVhY2ggemVyby5cbiAqIFRoZSBjYWxsZXIgaXMgcmVzcG9uc2libGUgZm9yIGludmFsaWRhdGluZyBhcnJheSBpZiBpdHMgcmVmZXJlbmNlIGNvdW50IGlzIHplcm8gYWZ0ZXIgdGhlIG9wZXJhdGlvbi5cbiAqXG4gKiBGb3IgYSBsb2NrZWQgYXJyYXkgdGhlIG1ldGhvZCBoYXMgbm8gZWZmZWN0IGFuZCBhbHdheXMgcmV0dXJucyB0cnVlLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAbWV0aG9kIF9kZWNSZWZcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXkgLSB0aGUgYXJyYXkgdG8gZGVjcmVtZW50IHRoZSByZWZlcmVuY2UgY291bnQgZm9yLiBNdXN0IGJlIHZhbGlkIGJlZm9yZSB0aGUgY2FsbC5cbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gdHJ1ZSBpZiB0aGUgcmVmZXJlbmNlIGNvdW50IGlzIG5vbi16ZXJvIGFmdGVyIHRoZSBvcGVyYXRpb24gYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuX2RlY1JlZiA9IGZ1bmN0aW9uKGFycmF5KSB7XG5cdGlmICh0aGlzLl9sb2NrQ291bnQgPT09IDApIHtcblx0XHQtLXRoaXMuX3JlZkNvdW50O1xuXHR9XG5cdHJldHVybiB0aGlzLl9yZWZDb3VudCAhPT0gMDtcbn07XG5cbi8qKlxuICogSW5jcmVtZW50cyB0aGUgYXJyYXkgcmVmZXJlbmNlIGNvdW50IGlmIHRoZSBhcnJheSBpcyBub3QgbG9ja2VkLlxuICogRm9yIGEgbG9ja2VkIGFycmF5IHRoZSBtZXRob2QgaGFzIG5vIGVmZmVjdC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBfaW5jUmVmXG4gKiBAY2hhaW5hYmxlXG4gKiBAcGFyYW0ge05EQXJyYXl9IGFycmF5IC0gdGhlIGFycmF5IHRvIGluY3JlbWVudCB0aGUgcmVmZXJlbmNlIGNvdW50IGZvci4gTXVzdCBiZSB2YWxpZCBiZWZvcmUgdGhlIGNhbGwsIGJ1dCBtYXkgaGF2ZSB6ZXJvIHJlZmVyZW5jZSBjb3VudC5cbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuX2luY1JlZiA9IGZ1bmN0aW9uKGFycmF5KSB7XG5cdGlmICh0aGlzLl9sb2NrQ291bnQgPT09IDApIHtcblx0XHQrK3RoaXMuX3JlZkNvdW50O1xuXHR9XG5cdHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIGFycmF5IGlzIGxvY2tlZCBvciBoYXMgYW55IHJlZmVyZW5jZXMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBtZXRob2QgX2hhc1JlZnNcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXkgLSB0aGUgYXJyYXkgdG8gY2hlY2suIE11c3QgYmUgdmFsaWQgYmVmb3JlIHRoZSBjYWxsLCBidXQgbWF5IGhhdmUgemVybyByZWZlcmVuY2UgY291bnQuXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaWYgdGhlIGFycmF5IGlzIGxvY2tlZCBvciBoYXMgcmVmZXJlbmNlcyBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICovXG5OREFycmF5LnByb3RvdHlwZS5faGFzUmVmcyA9IGZ1bmN0aW9uKGFycmF5KSB7XG5cdHJldHVybiAodGhpcy5fbG9ja0NvdW50ICE9PSAwKSB8fCAodGhpcy5fcmVmQ291bnQgIT09IDApO1xufTtcblxuLyoqXG4gKiBJbnZhbGlkYXRlcyB0aGUgYXJyYXkgaWYgaXQgdmFsaWQsIG5vdCBsb2NrZWQsIGFuZCBoYXMgemVybyByZWZlcmVuY2UgY291bnQuXG4gKiBIYXMgbm8gZWZmZWN0IGluIGFsbCBvdGhlciBjYXNlcy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBfdHJ5SW52YWxpZGF0ZVxuICogQHBhcmFtIHtOREFycmF5fSBhcnJheSAtIHRoZSBhcnJheSB0byB0cnkgdG8gaW52YWxpZGF0ZS4gQ2FuIGJlIGludmFsaWQuXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaWYgdGhlIGFycmF5IHdhcyBpbnZhbGlkYXRlZCBieSB0aGlzIGNhbGwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuX3RyeUludmFsaWRhdGUgPSBmdW5jdGlvbihhcnJheSkge1xuXHRpZiAodGhpcy5pc1ZhbGlkKCkgJiYgIXRoaXMuX2hhc1JlZnMoKSkge1xuXHRcdHRoaXMuX2NvbnRleHQuX2ludmFsaWRhdGUodGhpcyk7XG5cdFx0dGhpcy5faXNWYWxpZCA9IGZhbHNlO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufTtcblxuLyoqXG4gKiBBZGRzIGFub3RoZXIgYXJyYXkgb3IgYSBudW1iZXIgdG8gdGhpcyBhcnJheS5cbiAqXG4gKiBAbWV0aG9kIGFkZFxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBvdGhlciAtIHRoZSBhcnJheSBvciBzY2FsYXIgdG8gYmUgYWRkZWQuXG4gKiBAcmV0dXJuIHtOREFycmF5fVxuICovXG5OREFycmF5LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihvdGhlcikge1xuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5hZGQodGhpcywgb3RoZXIpO1xufTtcblxuLyoqXG4gKiBTdWJ0cmFjdHMgYW5vdGhlciBhcnJheSBvciBhIG51bWJlciBmcm9tIHRoaXMgYXJyYXkuXG4gKlxuICogQG1ldGhvZCBzdWJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gb3RoZXIgLSB0aGUgYXJyYXkgb3Igc2NhbGFyIHRvIGJlIHN1YnRyYWN0ZWQuXG4gKiBAcmV0dXJuIHtOREFycmF5fVxuICovXG5OREFycmF5LnByb3RvdHlwZS5zdWIgPSBmdW5jdGlvbihvdGhlcikge1xuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5zdWIodGhpcywgb3RoZXIpO1xufTtcblxuLyoqXG4gKiBNdWx0aXBsaWVzIGFycmF5IGVsZW1lbnRzIGJ5IGFub3RoZXIgYXJyYXkgb3IgYnkgYSBudW1iZXIuXG4gKlxuICogQG1ldGhvZCBtdWxcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gb3RoZXIgLSB0aGUgYXJyYXkgb3Igc2NhbGFyIHRvIG11bHRpcGx5IGVsZW1lbnRzIGJ5LlxuICogQHJldHVybiB7TkRBcnJheX1cbiAqL1xuTkRBcnJheS5wcm90b3R5cGUubXVsID0gZnVuY3Rpb24ob3RoZXIpIHtcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQubXVsKHRoaXMsIG90aGVyKTtcbn07XG5cbi8qKlxuICogRGl2aWRlcyBhcnJheSBlbGVtZW50cyBieSBhbm90aGVyIGFycmF5IG9yIGJ5IGEgbnVtYmVyLlxuICpcbiAqIEBtZXRob2QgZGl2XG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IG90aGVyIC0gdGhlIGFycmF5IG9yIHNjYWxhciB0byBkaXZpZGUgZWxlbWVudHMgYnkuXG4gKiBAcmV0dXJuIHtOREFycmF5fVxuICovXG5OREFycmF5LnByb3RvdHlwZS5kaXYgPSBmdW5jdGlvbihvdGhlcikge1xuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5kaXYodGhpcywgb3RoZXIpO1xufTtcblxuLyoqXG4gKiBSZWR1Y2VzIGFycmF5IGVsZW1lbnRzIHVzaW5nIG1pbmltdW0gb3BlcmF0aW9uLlxuICogSWYgdGhlIGF4aXMgYXJndW1lbnQgaXMgcHJvdmlkZWQsIHRoZSBtZXRob2QgY29tcHV0ZXMgbWluaW11bSBvZiBlbGVtZW50cyBhbG9uZyB0aGUgc3BlY2lmaWVkIGF4aXMuXG4gKiBPdGhlcndpc2UsIHRoZSBtZXRob2QgY29tcHV0ZXMgYW4gYWxsLWFycmF5IG1pbmltdW0gb2YgdGhlIGVsZW1lbnRzIGFuZCByZXR1cm5zIHRoZW0gYXMgYSAxLWVsZW1lbnQgYXJyYXkuXG4gKlxuICogQG1ldGhvZCBtaW5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbYXhpc10gLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgbWluaW11bSBpcyBjb21wdXRlZC5cbiAqIEByZXR1cm4ge05EQXJyYXl9XG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLm1pbiA9IGZ1bmN0aW9uKGF4aXMpIHtcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQubWluKHRoaXMsIGF4aXMpO1xufTtcblxuLyoqXG4gKiBSZWR1Y2VzIGFycmF5IGVsZW1lbnRzIHVzaW5nIG1heGltdW0gb3BlcmF0aW9uLlxuICogSWYgdGhlIGF4aXMgYXJndW1lbnQgaXMgcHJvdmlkZWQsIHRoZSBtZXRob2QgY29tcHV0ZXMgbWF4aW11bSBvZiBlbGVtZW50cyBhbG9uZyB0aGUgc3BlY2lmaWVkIGF4aXMuXG4gKiBPdGhlcndpc2UsIHRoZSBtZXRob2QgY29tcHV0ZXMgYW4gYWxsLWFycmF5IG1heGltdW0gb2YgdGhlIGVsZW1lbnRzIGFuZCByZXR1cm5zIHRoZW0gYXMgYSAxLWVsZW1lbnQgYXJyYXkuXG4gKlxuICogQG1ldGhvZCBtaW5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbYXhpc10gLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgbWF4aW11bSBpcyBjb21wdXRlZC5cbiAqIEByZXR1cm4ge05EQXJyYXl9XG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLm1heCA9IGZ1bmN0aW9uKGF4aXMpIHtcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQubWF4KHRoaXMsIGF4aXMpO1xufTtcblxuLyoqXG4gKiBSZWR1Y2VzIGFycmF5IGVsZW1lbnRzIHVzaW5nIHN1bSBvcGVyYXRpb24uXG4gKiBJZiB0aGUgYXhpcyBhcmd1bWVudCBpcyBwcm92aWRlZCwgdGhlIG1ldGhvZCBjb21wdXRlcyBzdW0gb2YgZWxlbWVudHMgYWxvbmcgdGhlIHNwZWNpZmllZCBheGlzLlxuICogT3RoZXJ3aXNlLCB0aGUgbWV0aG9kIGNvbXB1dGVzIGFuIGFsbC1hcnJheSBzdW0gb2YgdGhlIGVsZW1lbnRzIGFuZCByZXR1cm5zIHRoZW0gYXMgYSAxLWVsZW1lbnQgYXJyYXkuXG4gKlxuICogQG1ldGhvZCBtaW5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbYXhpc10gLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgc3VtIGlzIGNvbXB1dGVkLlxuICogQHJldHVybiB7TkRBcnJheX1cbiAqL1xuTkRBcnJheS5wcm90b3R5cGUuc3VtID0gZnVuY3Rpb24oYXhpcykge1xuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5zdW0odGhpcywgYXhpcyk7XG59O1xuXG4vKipcbiAqIENyZWF0ZXMgYW5vdGhlciBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEsIGJ1dCBkaWZmZXJlbnQgZGltZW5zaW9ucy5cbiAqXG4gKiBAbWV0aG9kIHJlc2hhcGVcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gb3RoZXIgLSBkaW1lbnNpb25zIG9mIHRoZSBuZXcgYXJyYXkuXG4gKiBAcmV0dXJuIHtOREFycmF5fVxuICovXG5OREFycmF5LnByb3RvdHlwZS5yZXNoYXBlID0gZnVuY3Rpb24obmV3U2hhcGUpIHtcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQucmVzaGFwZSh0aGlzLCBuZXdTaGFwZSk7XG59O1xuXG4vKipcbiAqIER1cGxpY2F0ZXMgYXJyYXkgZWxlbWVudHMgYWxvbmcgdGhlIHNwZWNpZmllZCBheGlzLlxuICpcbiAqIEBtZXRob2QgcmVwZWF0XG4gKiBAcGFyYW0ge051bWJlcn0gcmVwZWF0cyAtIHRoZSBudW1iZXIgb2YgdGltZXMgdG8gcmVwZWF0IGVhY2ggZWxlbWVudC5cbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgYWxvbmcgd2hpY2ggdGhlIGVsZW1lbnRzIHdpbGwgYmUgZHVwbGljYXRlZC5cbiAqIEByZXR1cm4ge05EQXJyYXl9XG4gKi9cbk5EQXJyYXkucHJvdG90eXBlLnJlcGVhdCA9IGZ1bmN0aW9uKHJlcGVhdHMsIGF4aXMpIHtcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQucmVwZWF0KHRoaXMsIHJlcGVhdHMsIGF4aXMpO1xufTtcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgZGF0YSB0byBhIEphdmFTY3JpcHQgQXJyYXkuXG4gKlxuICogQG1ldGhvZCBnZXRcbiAqIEBhc3luY1xuICovXG5OREFycmF5LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHR0aGlzLl9jb250ZXh0LmdldCh0aGlzLCBjYWxsYmFjayk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE5EQXJyYXk7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIE5EQXJyYXkgPSByZXF1aXJlKFwiLi9OREFycmF5XCIpO1xudmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XG52YXIgYWxsb2NhdG9yID0gcmVxdWlyZShcIi4vYWxsb2NhdG9yXCIpO1xudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xuXG52YXIgc2NyaXB0RGlyZWN0b3J5ID0gXCJcIjtcbnRyeSB7XG5cdHZhciBzY3JpcHRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJzY3JpcHRcIik7XG5cdGZvciAodmFyIGkgPSBzY3JpcHRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG5cdFx0dmFyIHBhdGggPSBzY3JpcHRzW2ldLnNyYztcblx0XHQvKiBSZW1vdmUgdXJsLWVuY29kZWQgcGFyYW1ldGVycyAqL1xuXHRcdHBhdGggPSBwYXRoLnNwbGl0KFwiP1wiKVswXTtcblx0XHR2YXIgc2VwYXJhdG9yUG9zID0gcGF0aC5sYXN0SW5kZXhPZihcIi9cIik7XG5cdFx0dmFyIHNjcmlwdE5hbWUgPSBwYXRoLnN1YnN0cmluZyhzZXBhcmF0b3JQb3MgKyAxKTtcblx0XHRpZiAoKHNjcmlwdE5hbWUgPT09IFwiZnVyaW91cy5qc1wiKSB8fCAoc2NyaXB0TmFtZSA9PT0gXCJmdXJpb3VzLm1pbi5qc1wiKSl7XG5cdFx0XHRzY3JpcHREaXJlY3RvcnkgPSBwYXRoLnN1YnN0cmluZygwLCBzZXBhcmF0b3JQb3MgKyAxKTtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxufSBjYXRjaCAoZSkge1xufVxuXG52YXIgbWVzc2FnZUNhbGxiYWNrcyA9IHt9O1xuXG52YXIgb25QTmFDbE1lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG5cdHZhciByZXN1bHQgPSBtZXNzYWdlLmRhdGE7XG5cdHZhciBpZCA9IHJlc3VsdC5pZDtcblx0aWYgKHJlc3VsdC5zdGF0dXMgPT0gXCJlcnJvclwiKSB7XG5cdFx0Y29uc29sZS5sb2coXCJFcnJvcjogXCIgKyByZXN1bHQuZGVzY3JpcHRpb24pO1xuXHR9XG5cdGlmIChpZCBpbiBtZXNzYWdlQ2FsbGJhY2tzKSB7XG5cdFx0aWYgKFwiYnVmZmVyXCIgaW4gcmVzdWx0KSB7XG5cdFx0XHRtZXNzYWdlQ2FsbGJhY2tzW2lkXShyZXN1bHQuYnVmZmVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGVsZXRlIHJlc3VsdC5zdGF0dXM7XG5cdFx0XHRkZWxldGUgcmVzdWx0LmlkO1xuXHRcdFx0bWVzc2FnZUNhbGxiYWNrc1tpZF0ocmVzdWx0KTtcblx0XHR9XG5cdFx0ZGVsZXRlIG1lc3NhZ2VDYWxsYmFja3NbaWRdO1xuXHR9XG59O1xuXG5mdW5jdGlvbiBQTmFDbENvbnRleHQob3B0aW9ucywgY2FsbGJhY2spIHtcblx0dmFyIGNvbnRleHQgPSB0aGlzO1xuXHR0aGlzLl9wbmFjbE9iamVjdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJvYmplY3RcIik7XG5cdHRoaXMuX3BuYWNsT2JqZWN0LndpZHRoID0gMDtcblx0dGhpcy5fcG5hY2xPYmplY3QuaGVpZ2h0ID0gMDtcblx0dGhpcy5fcG5hY2xPYmplY3QuZGF0YSA9IFBOYUNsQ29udGV4dC5nZXREZWZhdWx0TWFuaWZlc3RVUkwoKTtcblx0dGhpcy5fcG5hY2xPYmplY3QudHlwZSA9IFwiYXBwbGljYXRpb24veC1wbmFjbFwiO1xuXHR0aGlzLl9wbmFjbE9iamVjdC5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIG1lc3NhZ2VJZCA9IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKTtcblx0XHRtZXNzYWdlQ2FsbGJhY2tzW21lc3NhZ2VJZF0gPSBmdW5jdGlvbigpIHtcblx0XHRcdGNhbGxiYWNrKGNvbnRleHQpO1xuXHRcdH07XG5cdFx0Y29udGV4dC5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0XCJpZFwiOiBtZXNzYWdlSWQsXG5cdFx0XHRcImNvbW1hbmRcIjogXCJpbml0XCJcblx0XHR9KTtcblx0fSwgdHJ1ZSk7XG5cdHRoaXMuX3BuYWNsT2JqZWN0LmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIG9uUE5hQ2xNZXNzYWdlLCB0cnVlKTtcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLl9wbmFjbE9iamVjdCk7XG59XG5cblBOYUNsQ29udGV4dC5pc1N1cHBvcnRlZCA9IGZ1bmN0aW9uKCkge1xuXHR0cnkge1xuXHRcdHJldHVybiAodHlwZW9mIG5hdmlnYXRvci5taW1lVHlwZXNbXCJhcHBsaWNhdGlvbi94LXBuYWNsXCJdKSAhPT0gXCJ1bmRlZmluZWRcIjtcblx0fSBjYXRjaCAoZSkge1xuXHR9XG5cdHJldHVybiBmYWxzZTtcbn07XG5cblBOYUNsQ29udGV4dC5nZXREZWZhdWx0TWFuaWZlc3RVUkwgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHNjcmlwdERpcmVjdG9yeSArIFwiZnVyaW91cy5ubWZcIjtcbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUuZW1wdHkgPSBmdW5jdGlvbihzaGFwZSwgZGF0YVR5cGUpIHtcblx0c2hhcGUgPSB1dGlsLmNoZWNrU2hhcGUoc2hhcGUpO1xuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XG5cdH0gZWxzZSBpZiAoIShkYXRhVHlwZSBpbnN0YW5jZW9mIERhdGFUeXBlKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoZGF0YVR5cGUgKyBcIiBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgRGF0YVR5cGVcIik7XG5cdH1cblx0dmFyIGFycmF5ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCB0aGlzKTtcblx0YXJyYXkuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcblx0dGhpcy5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFwiY29tbWFuZFwiOiBcImVtcHR5XCIsXG5cdFx0XCJzaGFwZVwiOiBuZXcgVWludDMyQXJyYXkoc2hhcGUpLmJ1ZmZlcixcblx0XHRcImRhdGF0eXBlXCI6IGRhdGFUeXBlLnR5cGUsXG5cdFx0XCJvdXRcIjogYXJyYXkuX2lkXG5cdH0pO1xuXHRyZXR1cm4gYXJyYXk7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLnplcm9zID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xuXHR9XG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XG5cdGFycmF5Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XG5cdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcblx0XHRcImNvbW1hbmRcIjogXCJ6ZXJvc1wiLFxuXHRcdFwic2hhcGVcIjogbmV3IFVpbnQzMkFycmF5KHNoYXBlKS5idWZmZXIsXG5cdFx0XCJkYXRhdHlwZVwiOiBkYXRhVHlwZS50eXBlLFxuXHRcdFwib3V0XCI6IGFycmF5Ll9pZFxuXHR9KTtcblx0cmV0dXJuIGFycmF5O1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5vbmVzID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xuXHR9XG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XG5cdGFycmF5Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XG5cdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcblx0XHRcImNvbW1hbmRcIjogXCJvbmVzXCIsXG5cdFx0XCJzaGFwZVwiOiBuZXcgVWludDMyQXJyYXkoc2hhcGUpLmJ1ZmZlcixcblx0XHRcImRhdGF0eXBlXCI6IGRhdGFUeXBlLnR5cGUsXG5cdFx0XCJvdXRcIjogYXJyYXkuX2lkXG5cdH0pO1xuXHRyZXR1cm4gYXJyYXk7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmFycmF5ID0gZnVuY3Rpb24oZGF0YSwgZGF0YVR5cGUpIHtcblx0dmFyIHNoYXBlID0gW107XG5cdHV0aWwuZGlzY292ZXJBcnJheVNoYXBlUmVjdXJzaXZlKGRhdGEsIHNoYXBlLCAwKTtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xuXHR9XG5cdHZhciBuZGFycmF5ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCB0aGlzKTtcblx0bmRhcnJheS5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xuXHR2YXIgYnVmZmVyID0gbmV3IGRhdGFUeXBlLmFycmF5VHlwZShuZGFycmF5Lmxlbmd0aCk7XG5cdHV0aWwuY29weUFycmF5RGF0YVJlY3Vyc2l2ZShidWZmZXIsIGRhdGEsIHNoYXBlLCAwLCAwKTtcblx0dGhpcy5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFwiY29tbWFuZFwiOiBcImFycmF5XCIsXG5cdFx0XCJzaGFwZVwiOiBuZXcgVWludDMyQXJyYXkoc2hhcGUpLmJ1ZmZlcixcblx0XHRcImRhdGF0eXBlXCI6IGRhdGFUeXBlLnR5cGUsXG5cdFx0XCJidWZmZXJcIjogYnVmZmVyLmJ1ZmZlcixcblx0XHRcIm91dFwiOiBuZGFycmF5Ll9pZFxuXHR9KTtcblx0cmV0dXJuIG5kYXJyYXk7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmxpbnNwYWNlID0gZnVuY3Rpb24oc3RhcnQsIHN0b3AsIHNhbXBsZXMsIGluY2x1ZGVTdG9wKSB7XG5cdGlmICghdXRpbC5pc1JlYWwoc3RhcnQpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzdGFydCArIFwiIGlzIG5vdCBhIHJlYWwgbnVtYmVyXCIpO1xuXHR9XG5cdGlmICghdXRpbC5pc1JlYWwoc3RvcCkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHN0b3AgKyBcIiBpcyBub3QgYSByZWFsIG51bWJlclwiKTtcblx0fVxuXHRpZiAodHlwZW9mIHNhbXBsZXMgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHQvKiBEZWZhdWx0IHZhbHVlIGluIE51bVB5ICovXG5cdFx0c2FtcGxlcyA9IDUwO1xuXHR9IGVsc2UgaWYgKCF1dGlsLmlzSW50KHNhbXBsZXMpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzYW1wbGVzICsgXCIgaXMgbm90IGFuIGludGVnZXJcIik7XG5cdH0gZWxzZSBpZiAoc2FtcGxlcyA8PSAwKSB7XG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJUaGUgbnVtYmVyIG9mIHNhbXBsZXMgbXVzdCBiZSBwb3NpdGl2ZVwiKTtcblx0fVxuXHRpZiAodHlwZW9mIGluY2x1ZGVTdG9wID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0aW5jbHVkZVN0b3AgPSB0cnVlO1xuXHR9XG5cdGlmIChpbmNsdWRlU3RvcCAmJiAoc2FtcGxlcyA9PT0gMSkpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBudW1iZXIgb2Ygc2FtcGxlcyBtdXN0IGJlIGEgbGVhc3QgMiAoZm9yIHN0YXJ0IGFuZCBlbmQgcG9pbnRzKVwiKTtcblx0fVxuXHR2YXIgZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KFtzYW1wbGVzXSwgZGF0YVR5cGUsIHRoaXMpO1xuXHRhcnJheS5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xuXHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XCJjb21tYW5kXCI6IFwibGluc3BhY2VcIixcblx0XHRcInN0YXJ0XCI6ICtzdGFydCxcblx0XHRcInN0b3BcIjogK3N0b3AsXG5cdFx0XCJzYW1wbGVzXCI6IHNhbXBsZXN8MCxcblx0XHRcImNsb3NlZFwiOiAhIWluY2x1ZGVTdG9wLFxuXHRcdFwiZGF0YXR5cGVcIjogZGF0YVR5cGUudHlwZSxcblx0XHRcIm91dFwiOiBhcnJheS5faWRcblx0fSk7XG5cdHJldHVybiBhcnJheTtcbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUucmVzaGFwZSA9IGZ1bmN0aW9uKGEsIHNoYXBlKSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcblx0c2hhcGUgPSB1dGlsLmNoZWNrU2hhcGUoc2hhcGUpO1xuXHRpZiAodXRpbC5jb21wdXRlTGVuZ3RoKHNoYXBlKSAhPT0gYS5sZW5ndGgpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBzaGFwZSBpcyBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSBhcnJheVwiKTtcblx0fVxuXHR2YXIgcmVsZWFzZUFycmF5ID0gIWEuX2RlY1JlZigpO1xuXHR2YXIgb3V0ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGEuZGF0YVR5cGUsIHRoaXMpO1xuXHRpZiAocmVsZWFzZUFycmF5KSB7XG5cdFx0b3V0Ll9pZCA9IGEuX2lkO1xuXHRcdHJlbGVhc2VBcnJheSA9IGZhbHNlO1xuXHR9IGVsc2Uge1xuXHRcdG91dC5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xuXHR9XG5cdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcblx0XHRcImNvbW1hbmRcIjogXCJyZXNoYXBlXCIsXG5cdFx0XCJhXCI6IChyZWxlYXNlQXJyYXkgPyAtYS5faWQgOiBhLl9pZCksXG5cdFx0XCJvdXRcIjogb3V0Ll9pZCxcblx0XHRcInNoYXBlXCI6IG5ldyBVaW50MzJBcnJheShzaGFwZSkuYnVmZmVyXG5cdH0pO1xuXHRyZXR1cm4gb3V0O1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5yZXBlYXQgPSBmdW5jdGlvbihhLCByZXBlYXRzLCBheGlzLCBvdXQpIHtcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xuXHRyZXBlYXRzID0gdXRpbC5jaGVja1JlcGVhdHMocmVwZWF0cyk7XG5cdGF4aXMgPSB1dGlsLmNoZWNrQXhpcyhheGlzLCBhLnNoYXBlLmxlbmd0aCk7XG5cdHZhciBzaGFwZUEgPSBhLnNoYXBlO1xuXHR2YXIgc2hhcGVPdXQgPSBzaGFwZUEuc2xpY2UoMCk7XG5cdHNoYXBlT3V0W2F4aXNdICo9IHJlcGVhdHM7XG5cdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0b3V0ID0gbmV3IE5EQXJyYXkoc2hhcGVPdXQsIGEuZGF0YVR5cGUsIHRoaXMpO1xuXHRcdG91dC5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xuXHR9IGVsc2Uge1xuXHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkob3V0LnNoYXBlLCBzaGFwZU91dCk7XG5cdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcblx0XHRvdXQuX2luY1JlZigpO1xuXHR9XG5cdHZhciByZWxlYXNlQSA9ICFhLl9kZWNSZWYoKTtcblx0dGhpcy5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFwiY29tbWFuZFwiOiBcInJlcGVhdFwiLFxuXHRcdFwiYVwiOiAocmVsZWFzZUEgPyAtYS5faWQgOiBhLl9pZCksXG5cdFx0XCJvdXRcIjogb3V0Ll9pZCxcblx0XHRcInJlcGVhdHNcIjogcmVwZWF0cyxcblx0XHRcImF4aXNcIjogYXhpc1xuXHR9KTtcblx0cmV0dXJuIG91dDtcbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUuX2ludmFsaWRhdGUgPSBmdW5jdGlvbihhcnJheSkge1xuXHRpZiAoYXJyYXkuX2lkICE9PSAwKSB7XG5cdFx0dGhpcy5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XHRcImNvbW1hbmRcIjogXCJmcmVlXCIsXG5cdFx0XHRcImluXCI6IGFycmF5Ll9pZFxuXHRcdH0pO1xuXHR9XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIGFyZ3VtZW50IG1pc3NpbmdcIik7XG5cdH1cblx0dmFyIGNhbGxiYWNrID0gYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXTtcblx0LyogVmFsaWRhdGUgYXJndW1lbnRzICovXG5cdGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXQgbGVhc3Qgb25lIE5EQXJyYXkgYXJndW1lbnQgZXhwZWN0ZWRcIik7XG5cdH1cblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoIC0gMTsgKytpKSB7XG5cdFx0dXRpbC5jaGVja05EQXJyYXkoYXJndW1lbnRzW2ldLCBcImFyZ3VtZW50IFwiICsgaSk7XG5cdH1cblx0dmFyIHJlbGVhc2UgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyArK2kpIHtcblx0XHRyZWxlYXNlW2ldID0gIWFyZ3VtZW50c1tpXS5fZGVjUmVmKCk7XG5cdH1cblx0dmFyIGNhbGxiYWNrV2FpdEFyZ3VtZW50cyA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xuXHR2YXIgY2FsbGJhY2tBcmd1bWVudHMgPSBuZXcgQXJyYXkoY2FsbGJhY2tXYWl0QXJndW1lbnRzKTtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja1dhaXRBcmd1bWVudHM7IGkrKykge1xuXHRcdHZhciBhcnJheSA9IGFyZ3VtZW50c1tpXTtcblx0XHR2YXIgbWVzc2FnZUlkID0gYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpO1xuXHRcdGlmIChhcnJheS5zaGFwZS5sZW5ndGggPT09IDApIHtcblx0XHRcdG1lc3NhZ2VDYWxsYmFja3NbbWVzc2FnZUlkXSA9IChmdW5jdGlvbihpLCBBcnJheVR5cGUpIHtcblx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKGJ1ZmZlcikge1xuXHRcdFx0XHRcdHZhciB0eXBlZEFycmF5ID0gbmV3IEFycmF5VHlwZShidWZmZXIpO1xuXHRcdFx0XHRcdGNhbGxiYWNrQXJndW1lbnRzW2ldID0gdHlwZWRBcnJheVswXTtcblx0XHRcdFx0XHRpZiAoLS1jYWxsYmFja1dhaXRBcmd1bWVudHMgPT09IDApIHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrLmFwcGx5KG51bGwsIGNhbGxiYWNrQXJndW1lbnRzKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9KShpLCBhcnJheS5kYXRhVHlwZS5hcnJheVR5cGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZXNzYWdlQ2FsbGJhY2tzW21lc3NhZ2VJZF0gPSAoZnVuY3Rpb24oaSwgQXJyYXlUeXBlLCBzaGFwZSkge1xuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oYnVmZmVyKSB7XG5cdFx0XHRcdFx0dmFyIGpzYXJyYXkgPSBuZXcgQXJyYXkoc2hhcGVbMF0pO1xuXHRcdFx0XHRcdHV0aWwuY3JlYXRlQXJyYXlSZWN1cnNpdmUobmV3IEFycmF5VHlwZShidWZmZXIpLCBqc2FycmF5LCBzaGFwZSwgMCwgMCk7XG5cdFx0XHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBqc2FycmF5O1xuXHRcdFx0XHRcdGlmICgtLWNhbGxiYWNrV2FpdEFyZ3VtZW50cyA9PT0gMCkge1xuXHRcdFx0XHRcdFx0Y2FsbGJhY2suYXBwbHkobnVsbCwgY2FsbGJhY2tBcmd1bWVudHMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH0pKGksIGFycmF5LmRhdGFUeXBlLmFycmF5VHlwZSwgYXJyYXkuc2hhcGUpO1xuXHRcdH1cblx0XHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XHRcImlkXCI6IG1lc3NhZ2VJZCxcblx0XHRcdFwiY29tbWFuZFwiOiBcImdldFwiLFxuXHRcdFx0XCJpblwiOiAocmVsZWFzZVtpXSA/IC1hcnJheS5faWQgOiBhcnJheS5faWQpXG5cdFx0fSk7XG5cdH1cbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUuaW5mbyA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdHZhciBtZXNzYWdlSWQgPSBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCk7XG5cdG1lc3NhZ2VDYWxsYmFja3NbbWVzc2FnZUlkXSA9IGNhbGxiYWNrO1xuXHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XCJpZFwiOiBtZXNzYWdlSWQsXG5cdFx0XCJjb21tYW5kXCI6IFwiaW5mb1wiXG5cdH0pO1xufTtcblxudmFyIGJpbmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBiLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xuXHR2YXIgc2hhcGVPdXQgPSBudWxsLCBkYXRhVHlwZU91dCA9IG51bGwsIHJlbGVhc2VBID0gZmFsc2UsIHJlbGVhc2VCID0gZmFsc2U7XG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdHNoYXBlT3V0ID0gYS5zaGFwZTtcblx0XHRkYXRhVHlwZU91dCA9IGEuZGF0YVR5cGU7XG5cdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBiLnNoYXBlKTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIGIuZGF0YVR5cGUpO1xuXHRcdH0gZWxzZSBpZiAoIXV0aWwuaXNOdW1iZXIoYikpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGJcIik7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKHV0aWwuaXNOdW1iZXIoYSkpIHtcblx0XHRzaGFwZU91dCA9IGIuc2hhcGU7XG5cdFx0ZGF0YVR5cGVPdXQgPSBiLmRhdGFUeXBlO1xuXHRcdHV0aWwuY2hlY2tOREFycmF5KGIsIFwiYlwiKTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiVW5zdXBwb3J0ZWQgdHlwZSBvZiBhXCIpO1xuXHR9XG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdHJlbGVhc2VBID0gIWEuX2RlY1JlZigpO1xuXHR9XG5cdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdHJlbGVhc2VCID0gIWIuX2RlY1JlZigpO1xuXHR9XG5cdHRyeSB7XG5cdFx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRcdG91dCA9IG5ldyBOREFycmF5KHNoYXBlT3V0LCBkYXRhVHlwZU91dCwgY29udGV4dCk7XG5cdFx0XHRpZiAocmVsZWFzZUEpIHtcblx0XHRcdFx0b3V0Ll9pZCA9IGEuX2lkO1xuXHRcdFx0XHRyZWxlYXNlQSA9IGZhbHNlO1xuXHRcdFx0fSBlbHNlIGlmIChyZWxlYXNlQikge1xuXHRcdFx0XHRvdXQuX2lkID0gYi5faWQ7XG5cdFx0XHRcdHJlbGVhc2VCID0gZmFsc2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KHNoYXBlT3V0LCBvdXQuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoZGF0YVR5cGVPdXQsIG91dC5kYXRhVHlwZSk7XG5cdFx0XHRvdXQuX2luY1JlZigpO1xuXHRcdH1cblx0XHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdFx0XHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XHRcdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XHRcdFx0XCJjb21tYW5kXCI6IG9wZXJhdGlvbixcblx0XHRcdFx0XHRcImFcIjogKHJlbGVhc2VBID8gLWEuX2lkIDogYS5faWQpLFxuXHRcdFx0XHRcdFwiYlwiOiAocmVsZWFzZUIgPyAtYi5faWQgOiBiLl9pZCksXG5cdFx0XHRcdFx0XCJvdXRcIjogb3V0Ll9pZFxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnRleHQuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcblx0XHRcdFx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcblx0XHRcdFx0XHRcImNvbW1hbmRcIjogb3BlcmF0aW9uICsgXCJjXCIsXG5cdFx0XHRcdFx0XCJhXCI6IChyZWxlYXNlQSA/IC1hLl9pZCA6IGEuX2lkKSxcblx0XHRcdFx0XHRcImJcIjogYixcblx0XHRcdFx0XHRcIm91dFwiOiBvdXQuX2lkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoKG9wZXJhdGlvbiA9PSBcImFkZFwiKSB8fCAob3BlcmF0aW9uID09IFwibXVsXCIpKSB7XG5cdFx0XHRcdC8qIENvbW11dGF0aXZlIG9wZXJhdGlvbjogZmxpcCB0aGUgb3BlcmFuZHMgKi9cblx0XHRcdFx0Y29udGV4dC5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0XHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFx0XHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24gKyBcImNcIixcblx0XHRcdFx0XHRcImFcIjogKHJlbGVhc2VCID8gLWIuX2lkIDogYi5faWQpLFxuXHRcdFx0XHRcdFwiYlwiOiBhLFxuXHRcdFx0XHRcdFwib3V0XCI6IG91dC5faWRcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XHRcdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XHRcdFx0XCJjb21tYW5kXCI6IFwiclwiICsgb3BlcmF0aW9uICsgXCJjXCIsXG5cdFx0XHRcdFx0XCJhXCI6IGIsXG5cdFx0XHRcdFx0XCJiXCI6IChyZWxlYXNlQSA/IC1hLl9pZCA6IGEuX2lkKSxcblx0XHRcdFx0XHRcIm91dFwiOiBvdXQuX2lkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBjYXRjaCAoZSkge1xuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXG5cdFx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRhLl9pbmNSZWYoKTtcblx0XHR9XG5cdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRiLl9pbmNSZWYoKTtcblx0XHR9XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRyZXR1cm4gb3V0O1xufTtcblxudmFyIHVuYXJ5QXJpdGhPcCA9IGZ1bmN0aW9uKGEsIG91dCwgY29udGV4dCwgb3BlcmF0aW9uKSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcblx0dmFyIHJlbGVhc2VBID0gIWEuX2RlY1JlZigpO1xuXHR0cnkge1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShhLnNoYXBlLCBhLmRhdGFUeXBlLCBjb250ZXh0KTtcblx0XHRcdGlmIChyZWxlYXNlQSkge1xuXHRcdFx0XHRvdXQuX2lkID0gYS5faWQ7XG5cdFx0XHRcdHJlbGVhc2VBID0gZmFsc2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KGEuc2hhcGUsIG91dC5zaGFwZSk7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcblx0XHR9XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHQvKiBSZXN0b3JlIHRoZSBwcmV2aW91cyBzdGF0ZSAqL1xuXHRcdGEuX2luY1JlZigpO1xuXHRcdHRocm93IGU7XG5cdH1cblx0Y29udGV4dC5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24sXG5cdFx0XCJhXCI6IChyZWxlYXNlQSA/IC1hLl9pZCA6IGEuX2lkKSxcblx0XHRcIm91dFwiOiBvdXQuX2lkXG5cdH0pO1xuXHRyZXR1cm4gb3V0O1xufTtcblxudmFyIHJlZHVjZUFyaXRoT3AgPSBmdW5jdGlvbihhLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdHZhciByZWxlYXNlQSA9ICFhLl9kZWNSZWYoKTtcblx0dHJ5IHtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoW10sIGEuZGF0YVR5cGUsIGNvbnRleHQpO1xuXHRcdFx0b3V0Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShvdXQuc2hhcGUsIFtdKTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XG5cdFx0XHRvdXQuX2luY1JlZigpO1xuXHRcdH1cblx0fSBjYXRjaCAoZSkge1xuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXG5cdFx0YS5faW5jUmVmKCk7XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XCJjb21tYW5kXCI6IG9wZXJhdGlvbixcblx0XHRcImFcIjogKHJlbGVhc2VBID8gLWEuX2lkIDogYS5faWQpLFxuXHRcdFwib3V0XCI6IG91dC5faWRcblx0fSk7XG5cdHJldHVybiBvdXQ7XG59O1xuXG52YXIgYXhpc1JlZHVjZUFyaXRoT3AgPSBmdW5jdGlvbihhLCBheGlzLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdHZhciByZWxlYXNlQSA9ICFhLl9kZWNSZWYoKTtcblx0dHJ5IHtcblx0XHR1dGlsLmNoZWNrQXhpcyhheGlzKTtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkodXRpbC5jb21wdXRlQXhpc1JlZHVjdGlvbk91dFNoYXBlKGEuc2hhcGUsIGF4aXMpLCBhLmRhdGFUeXBlLCBjb250ZXh0KTtcblx0XHRcdG91dC5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkob3V0LnNoYXBlLCBbXSk7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcblx0XHR9XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHQvKiBSZXN0b3JlIHRoZSBwcmV2aW91cyBzdGF0ZSAqL1xuXHRcdGEuX2luY1JlZigpO1xuXHRcdHRocm93IGU7XG5cdH1cblx0Y29udGV4dC5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxuXHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24sXG5cdFx0XCJhXCI6IChyZWxlYXNlQSA/IC1hLl9pZCA6IGEuX2lkKSxcblx0XHRcImF4aXNcIjogYXhpc3wwLFxuXHRcdFwib3V0XCI6IG91dC5faWRcblx0fSk7XG5cdHJldHVybiBvdXQ7XG59O1xuXG52YXIgZG90QXJpdGhPcCA9IGZ1bmN0aW9uKGEsIGIsIG91dCwgY29udGV4dCkge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdHV0aWwuY2hlY2tOREFycmF5KGIsIFwiYlwiKTtcblx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XG5cdHZhciByZWxlYXNlQSA9ICFhLl9kZWNSZWYoKTtcblx0dmFyIHJlbGVhc2VCID0gIWIuX2RlY1JlZigpO1xuXHR0cnkge1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHR2YXIgc2hhcGVBID0gYS5zaGFwZTtcblx0XHRcdHZhciBzaGFwZUIgPSBiLnNoYXBlO1xuXHRcdFx0dmFyIGF4aXNBID0gTWF0aC5tYXgoc2hhcGVBLmxlbmd0aCAtIDEsIDApO1xuXHRcdFx0dmFyIGF4aXNCID0gTWF0aC5tYXgoc2hhcGVCLmxlbmd0aCAtIDIsIDApO1xuXHRcdFx0aWYgKHNoYXBlQVtheGlzQV0gIT0gc2hhcGVCW2F4aXNCXSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiTWlzbWF0Y2ggaW4gcmVkdWN0aW9uIGRpbWVuc2lvbnNcIik7XG5cdFx0XHR9XG5cdFx0XHR2YXIgc2hhcGVPdXQgPSBbXTtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXhpc0E7IGkrKykge1xuXHRcdFx0XHRzaGFwZU91dC5wdXNoKHNoYXBlQVtpXSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc2hhcGVCLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBheGlzQjsgaSsrKSB7XG5cdFx0XHRcdFx0c2hhcGVPdXQucHVzaChzaGFwZUJbaV0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNoYXBlT3V0LnB1c2goc2hhcGVCW3NoYXBlQi5sZW5ndGggLSAxXSk7XG5cdFx0XHR9XG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShzaGFwZU91dCwgYS5kYXRhVHlwZSwgY29udGV4dCk7XG5cdFx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcblx0XHR9IGVsc2UgaWYgKG91dCBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuXHRcdH1cblx0fSBjYXRjaCAoZSkge1xuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXG5cdFx0YS5faW5jUmVmKCk7XG5cdFx0Yi5faW5jUmVmKCk7XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XG5cdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXG5cdFx0XCJjb21tYW5kXCI6IFwiZG90XCIsXG5cdFx0XCJhXCI6IChyZWxlYXNlQSA/IC1hLl9pZCA6IGEuX2lkKSxcblx0XHRcImJcIjogKHJlbGVhc2VCID8gLWIuX2lkIDogYi5faWQpLFxuXHRcdFwib3V0XCI6IG91dC5faWRcblx0fSk7XG5cdHJldHVybiBvdXQ7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHRyZXR1cm4gYmluYXJ5QXJpdGhPcChhLCBiLCBvdXQsIHRoaXMsIFwiYWRkXCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5zdWIgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcblx0cmV0dXJuIGJpbmFyeUFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzLCBcInN1YlwiKTtcbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUubXVsID0gZnVuY3Rpb24oYSwgYiwgb3V0KSB7XG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJtdWxcIik7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmRpdiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHRyZXR1cm4gYmluYXJ5QXJpdGhPcChhLCBiLCBvdXQsIHRoaXMsIFwiZGl2XCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5uZWcgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwibmVnXCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5hYnMgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwiYWJzXCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5leHAgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwiZXhwXCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5sb2cgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwibG9nXCIpO1xufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5zcXJ0ID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcInNxcnRcIik7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLnNxdWFyZSA9IGZ1bmN0aW9uKGEsIG91dCkge1xuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywgXCJzcXVhcmVcIik7XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLm1pbiA9IGZ1bmN0aW9uKGEsIGF4aXMpIHtcblx0aWYgKHR5cGVvZiBheGlzID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0cmV0dXJuIHJlZHVjZUFyaXRoT3AoYSwgdW5kZWZpbmVkLCB0aGlzLCBcIm1pblwiKTtcblx0fSBlbHNlIGlmICh1dGlsLmlzSW50KGF4aXMpKSB7XG5cdFx0cmV0dXJuIGF4aXNSZWR1Y2VBcml0aE9wKGEsIGF4aXMsIHVuZGVmaW5lZCwgdGhpcywgXCJhbWluXCIpO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCBheGlzIHR5cGVcIik7XG5cdH1cbn07XG5cblBOYUNsQ29udGV4dC5wcm90b3R5cGUubWF4ID0gZnVuY3Rpb24oYSwgYXhpcykge1xuXHRpZiAodHlwZW9mIGF4aXMgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRyZXR1cm4gcmVkdWNlQXJpdGhPcChhLCB1bmRlZmluZWQsIHRoaXMsIFwibWF4XCIpO1xuXHR9IGVsc2UgaWYgKHV0aWwuaXNJbnQoYXhpcykpIHtcblx0XHRyZXR1cm4gYXhpc1JlZHVjZUFyaXRoT3AoYSwgYXhpcywgdW5kZWZpbmVkLCB0aGlzLCBcImFtYXhcIik7XG5cdH0gZWxzZSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIGF4aXMgdHlwZVwiKTtcblx0fVxufTtcblxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5zdW0gPSBmdW5jdGlvbihhLCBheGlzKSB7XG5cdGlmICh0eXBlb2YgYXhpcyA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdHJldHVybiByZWR1Y2VBcml0aE9wKGEsIHVuZGVmaW5lZCwgdGhpcywgXCJzdW1cIik7XG5cdH0gZWxzZSBpZiAodXRpbC5pc0ludChheGlzKSkge1xuXHRcdHJldHVybiBheGlzUmVkdWNlQXJpdGhPcChhLCBheGlzLCB1bmRlZmluZWQsIHRoaXMsIFwiYXN1bVwiKTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiVW5zdXBwb3J0ZWQgYXhpcyB0eXBlXCIpO1xuXHR9XG59O1xuXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmRvdCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xuXHRyZXR1cm4gZG90QXJpdGhPcChhLCBiLCBvdXQsIHRoaXMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQTmFDbENvbnRleHQ7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIG1lc3NhZ2VJZCA9IDE7XG52YXIgYXJyYXlJZCA9IDE7XG5cbmV4cG9ydHMubmV3TWVzc2FnZUlkID0gZnVuY3Rpb24oKSB7XG5cdHZhciBpZCA9IG1lc3NhZ2VJZDtcblx0bWVzc2FnZUlkID0gKG1lc3NhZ2VJZCsxKXwwO1xuXHRyZXR1cm4gaWQ7XG59O1xuXG5leHBvcnRzLm5ld0FycmF5SWQgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBpZCA9IGFycmF5SWQ7XG5cdGFycmF5SWQgPSAoYXJyYXlJZCsxKXwwO1xuXHRyZXR1cm4gaWQ7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qKlxuICogUHJvdmlkZXMgaW5mb3JtYXRpb24gYW5kIHN1cHBvcnQgZnVuY3Rpb25zXG4gKlxuICogQGNsYXNzIGZ1cmlvdXNcbiAqL1xuXG52YXIgRGF0YVR5cGUgPSByZXF1aXJlKFwiLi9EYXRhVHlwZVwiKTtcbnZhciBKU0NvbnRleHQgPSByZXF1aXJlKFwiLi9KU0NvbnRleHRcIik7XG52YXIgUE5hQ2xDb250ZXh0ID0gcmVxdWlyZShcIi4vUE5hQ2xDb250ZXh0XCIpO1xudmFyIFdlYkNMQ29udGV4dCA9IHJlcXVpcmUoXCIuL3dlYmNsL1dlYkNMQ29udGV4dFwiKTtcblxuLyoqXG4gKiBJbml0aWFsaXplcyBhIGNvbXB1dGF0aW9uYWwgY29udGV4dC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGluaXRcbiAqIEBhc3luY1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBbYmFja2VuZF0gLSBBIHN0cmluZyBpZGVudGlmaWVyIGZvciB0aGUgYmFja2VuZCB0byB1c2UuIFRoZSBmb2xsb3dpbmcgdmFsdWVzIGFyZSBzdXBwb3J0ZWQ6XG4gKlxuICogICAgIDx0YWJsZT5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRoPkJhY2tlbmQgSWRlbnRpZmllcjwvdGg+XG4gKiAgICAgICAgICAgICA8dGg+SW50ZXJwcmV0YXRpb248L3RoPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJqYXZhc2NyaXB0XCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPkphdmFTY3JpcHQgYmFja2VuZC4gV29ya3MgaW4gYWxsIGJyb3dzZXJzIGFuZCBOb2RlLmpzLCBidXQgY2FuIG5vdCBkZWxpdmVyIG9wdGltYWwgcGVyZm9ybWFuY2UuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwicG5hY2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+UG9ydGFibGUgTmF0aXZlIENsaWVudCAoUE5hQ2wpIGJhY2tlbmQuIFdvcmtzIGluIENocm9taXVtLWJhc2VkIGJyb3dzZXJzLiBDYW4gYWNjZWxlcmF0ZSBjb21wdXRhdGlvbnMgdGhyb3VnaCB0aGUgdXNlIG9mIGFkdmFuY2VkIENQVSBvcHRpbWl6YXRpb24gdGVjaG5vbG9naWVzLCBzdWNoIGFzIG11bHRpLXRocmVhZGluZyBhbmQgU0lNRCBpbnN0cnVjdGlvbnMuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwid2ViY2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+V2ViQ0wgYmFja2VuZC4gV29ya3MgaW4gYnJvd3NlcnMgYW5kIE5vZGUuanMgd2hlbiBhIFdlYkNMIHBsdWdpbiBpcyBhdmFpbGFibGUuIENhbiB1c2UgZnVsbCBwb3dlciBvZiBDUFVzIGFuZCBHUFVzIHRvIGFjY2VsZXJhdGUgY29tcHV0YXRpb25zLjwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgPC90YWJsZT5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIEJhY2tlbmQtc3BlY2lmaWMgb3B0aW9ucy5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBiYWNrZW5kIGZpbmlzaCBpbml0aWFsaXphdGlvbi5cbiAqIEBwYXJhbSB7Q29udGV4dH0gY2FsbGJhY2suY29udGV4dCAtIEEgcmVhZHkgdG8gdXNlIGNvbXB1dGF0aW9uYWwgY29udGV4dC5cbiAqL1xudmFyIGluaXQgPSBmdW5jdGlvbihiYWNrZW5kLCBvcHRpb25zLCBjYWxsYmFjaykge1xuXHRpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0aWYgKHR5cGVvZiBvcHRpb25zID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHQvKiBDYWxsZWQgd2l0aCBvbmUgcGFyYW1ldGVyOiBjYWxsYmFjayAqL1xuXHRcdFx0Y2FsbGJhY2sgPSBiYWNrZW5kO1xuXHRcdFx0b3B0aW9ucyA9IHVuZGVmaW5lZDtcblx0XHRcdGJhY2tlbmQgPSB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8qIENhbGxlZCB3aXRoIHR3byBwYXJhbWV0ZXJzOiBiYWNrZW5kIGFuZCBjYWxsYmFjayAqL1xuXHRcdFx0Y2FsbGJhY2sgPSBvcHRpb25zO1xuXHRcdFx0b3B0aW9ucyA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblx0aWYgKHR5cGVvZiBiYWNrZW5kID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0YmFja2VuZCA9IGdldERlZmF1bHRCYWNrZW5kKCk7XG5cdH1cblx0aWYgKHR5cGVvZiBvcHRpb25zID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0b3B0aW9ucyA9IHt9O1xuXHR9XG5cdGlmIChiYWNrZW5kID09PSBcImphdmFzY3JpcHRcIikge1xuXHRcdHJldHVybiBuZXcgSlNDb250ZXh0KG9wdGlvbnMsIGNhbGxiYWNrKTtcblx0fSBlbHNlIGlmIChiYWNrZW5kID09PSBcInBuYWNsXCIpIHtcblx0XHRyZXR1cm4gbmV3IFBOYUNsQ29udGV4dChvcHRpb25zLCBjYWxsYmFjayk7XG5cdH0gZWxzZSBpZiAoYmFja2VuZCA9PT0gXCJ3ZWJjbFwiKSB7XG5cdFx0cmV0dXJuIG5ldyBXZWJDTENvbnRleHQob3B0aW9ucywgY2FsbGJhY2spO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGJhY2tlbmQ6IFwiICsgYmFja2VuZCk7XG5cdH1cbn07XG5cbi8qKlxuICogRGV0ZWN0cyB0aGUgb3B0aW1hbCBiYWNrZW5kIHN1cHBvcnRlZCBieSB0aGUgYnJvd3NlciBvciBKYXZhU2NyaXB0IGVuZ2luZS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGdldERlZmF1bHRCYWNrZW5kXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSAtIERlZmF1bHQgYmFja2VuZCBpZGVudGlmaWVyIGZyb20gdGhlIGZvbGxvd2luZyB0YWJsZTpcbiAqXG4gKiAgICAgPHRhYmxlPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGg+QmFja2VuZCBJZGVudGlmaWVyPC90aD5cbiAqICAgICAgICAgICAgIDx0aD5JbnRlcnByZXRhdGlvbjwvdGg+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cImphdmFzY3JpcHRcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+SmF2YVNjcmlwdCBiYWNrZW5kLiBXb3JrcyBpbiBhbGwgYnJvd3NlcnMgYW5kIE5vZGUuanMsIGJ1dCBjYW4gbm90IGRlbGl2ZXIgb3B0aW1hbCBwZXJmb3JtYW5jZS48L3RkPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJhc21qc1wiPC90ZD5cbiAqICAgICAgICAgICAgIDx0ZD5Bc20uanMgYmFja2VuZC4gV29ya3MgaW4gRmlyZWZveCAyOSBhbmQgbGF0ZXIuIENhbiBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucyB3aXRoIGEgbGltaXRlZCB1c2Ugb2YgbmF0aXZlIENQVSBpbnN0cnVjdGlvbnMuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwicG5hY2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+UG9ydGFibGUgTmF0aXZlIENsaWVudCAoUE5hQ2wpIGJhY2tlbmQuIFdvcmtzIGluIENocm9taXVtLWJhc2VkIGJyb3dzZXJzLiBDYW4gYWNjZWxlcmF0ZSBjb21wdXRhdGlvbnMgdGhyb3VnaCB0aGUgdXNlIG9mIGFkdmFuY2VkIENQVSBvcHRpbWl6YXRpb24gdGVjaG5vbG9naWVzLCBzdWNoIGFzIG11bHRpLXRocmVhZGluZyBhbmQgU0lNRCBpbnN0cnVjdGlvbnMuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwid2ViY2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+V2ViQ0wgYmFja2VuZC4gV29ya3MgaW4gYnJvd3NlcnMgYW5kIE5vZGUuanMgd2hlbiBhIFdlYkNMIHBsdWdpbiBpcyBhdmFpbGFibGUuIENhbiB1c2UgZnVsbCBwb3dlciBvZiBDUFVzIGFuZCBHUFVzIHRvIGFjY2VsZXJhdGUgY29tcHV0YXRpb25zLjwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgPC90YWJsZT5cbiAqL1xudmFyIGdldERlZmF1bHRCYWNrZW5kID0gZnVuY3Rpb24oKSB7XG5cdGlmIChoYXNGZWF0dXJlKFwid2ViY2xcIikpIHtcblx0XHRyZXR1cm4gXCJ3ZWJjbFwiO1xuXHR9IGVsc2UgaWYgKGhhc0ZlYXR1cmUoXCJwbmFjbFwiKSkge1xuXHRcdHJldHVybiBcInBuYWNsXCI7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIFwiamF2YXNjcmlwdFwiO1xuXHR9XG59O1xuXG4vKipcbiAqIERldGVjdHMgd2hpY2ggYmFja2VuZHMgYXJlIHN1cHBvcnRlZCBieSB0aGUgc3lzdGVtLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZ2V0U3VwcG9ydGVkQmFja2VuZHNcbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmdbXX0gLSBBbiBhcnJheSBvZiBzdXBwb3J0ZWQgYmFja2VuZCBpZGVudGlmaWVycyBpbiBwcmlvcml0eSBvcmRlciAocHJpb3JpdGl6ZWQgYmFja2VuZHMgZmlyc3QpLiBUaGUgZm9sbG93aW5nIGlkZW50aWZpZXJzIGNvdWxkIGJlIHByZXNlbnQ6XG4gKlxuICogICAgIDx0YWJsZT5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRoPkJhY2tlbmQgSWRlbnRpZmllcjwvdGg+XG4gKiAgICAgICAgICAgICA8dGg+SW50ZXJwcmV0YXRpb248L3RoPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJqYXZhc2NyaXB0XCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPkphdmFTY3JpcHQgYmFja2VuZC4gV29ya3MgaW4gYWxsIGJyb3dzZXJzIGFuZCBOb2RlLmpzLCBidXQgY2FuIG5vdCBkZWxpdmVyIG9wdGltYWwgcGVyZm9ybWFuY2UuPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwiYXNtanNcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+QXNtLmpzIGJhY2tlbmQuIFdvcmtzIGluIEZpcmVmb3ggMjkgYW5kIGxhdGVyLiBDYW4gYWNjZWxlcmF0ZSBjb21wdXRhdGlvbnMgd2l0aCBhIGxpbWl0ZWQgdXNlIG9mIG5hdGl2ZSBDUFUgaW5zdHJ1Y3Rpb25zLjwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cInBuYWNsXCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPlBvcnRhYmxlIE5hdGl2ZSBDbGllbnQgKFBOYUNsKSBiYWNrZW5kLiBXb3JrcyBpbiBDaHJvbWl1bS1iYXNlZCBicm93c2Vycy4gQ2FuIGFjY2VsZXJhdGUgY29tcHV0YXRpb25zIHRocm91Z2ggdGhlIHVzZSBvZiBhZHZhbmNlZCBDUFUgb3B0aW1pemF0aW9uIHRlY2hub2xvZ2llcywgc3VjaCBhcyBtdWx0aS10aHJlYWRpbmcgYW5kIFNJTUQgaW5zdHJ1Y3Rpb25zLjwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cIndlYmNsXCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPldlYkNMIGJhY2tlbmQuIFdvcmtzIGluIGJyb3dzZXJzIGFuZCBOb2RlLmpzIHdoZW4gYSBXZWJDTCBwbHVnaW4gaXMgYXZhaWxhYmxlLiBDYW4gdXNlIGZ1bGwgcG93ZXIgb2YgQ1BVcyBhbmQgR1BVcyB0byBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucy48L3RkPlxuICogICAgICAgICA8L3RyPlxuICogICAgIDwvdGFibGU+XG4gKi9cbnZhciBnZXRTdXBwb3J0ZWRCYWNrZW5kcyA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgYmFja2VuZHMgPSBbXTtcblx0aWYgKGhhc0ZlYXR1cmUoXCJ3ZWJjbFwiKSkge1xuXHRcdGJhY2tlbmRzLnB1c2goXCJ3ZWJjbFwiKTtcblx0fVxuXHRpZiAoaGFzRmVhdHVyZShcInBuYWNsXCIpKSB7XG5cdFx0YmFja2VuZHMucHVzaChcInBuYWNsXCIpO1xuXHR9XG5cdGlmIChoYXNGZWF0dXJlKFwiYXNtLmpzXCIpKSB7XG5cdFx0YmFja2VuZHMucHVzaChcImFzbS5qc1wiKTtcblx0fVxuXHRiYWNrZW5kcy5wdXNoKFwiamF2YXNjcmlwdFwiKTtcblx0cmV0dXJuIGJhY2tlbmRzO1xufTtcblxuLyoqXG4gKiBRdWVyaWVzIHBvc3NpYmxlIGJhY2tlbmQgb3B0aW9ucyBhdmFpbGFibGUgb24gdGhpcyBwbGF0Zm9ybS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gYmFja2VuZCAtIG5hbWUgb2YgdGhlIGJhY2tlbmQgdG8gcXVlcnkgb3B0aW9ucyBmb3IuXG4gKlxuICogQHN0YXRpY1xuICogQG1ldGhvZCBnZXRCYWNrZW5kT3B0aW9uc1xuICpcbiAqIEByZXR1cm4ge09iamVjdH0gLSBBbiBvYmplY3QgdGhhdCBkZXNjcmliZXMgYXZhaWxhYmxlIG9wdGlvbnMuXG4gKiBUaGUgbmFtZXMgb2Ygb2JqZWN0J3MgcHJvcGVydGllcyBjb3JyZXNwb25kIHRvIGJhY2tlbmQgb3B0aW9uIG5hbWVzLlxuICogT2JqZWN0J3MgcHJvcGVydGllcyBoYXZlIGFycmF5IHZhbHVlcyB3aXRoIHBvc3NpYmxlIG9wdGlvbiB2YWx1ZXMuXG4gKiBCZWxvdyBhcmUgdGhlIGJhY2tlbmQgb3B0aW9ucyBmb3IgdGhlIGJ1aWx0LWluIGJhY2tlbmRzOlxuICpcbiAqICAgICA8dGFibGU+XG4gKiAgICAgICAgIDxjYXB0aW9uPk9wdGlvbnMgb2YgXCJqYXZhc2NyaXB0XCIgYW5kIFwiYXNtanNcIiBiYWNrZW5kczwvY2FwdGlvbj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRoPk9wdGlvbiBuYW1lPC90aD5cbiAqICAgICAgICAgICAgIDx0aD5PcHRpb24gdmFsdWVzPC90aD5cbiAqICAgICAgICAgICAgIDx0aD5EZWZhdWx0IHZhbHVlPC90aD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwiYXN5bmNcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+W3RydWUsIGZhbHNlXTwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+dHJ1ZTwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgPC90YWJsZT5cbiAqXG4gKiAgICAgPHRhYmxlPlxuICogICAgICAgICA8Y2FwdGlvbj5PcHRpb25zIG9mIFwicG5hY2xcIiBiYWNrZW5kPC9jYXB0aW9uPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGg+T3B0aW9uIG5hbWU8L3RoPlxuICogICAgICAgICAgICAgPHRoPk9wdGlvbiB2YWx1ZXM8L3RoPlxuICogICAgICAgICAgICAgPHRoPkRlZmF1bHQgdmFsdWU8L3RoPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJtYW5pZmVzdFwiPC90ZD5cbiAqICAgICAgICAgICAgIDx0ZD51bmRlZmluZWQ8L3RkPlxuICogICAgICAgICAgICAgPHRkPlVSTCBvZiBcImZ1cmlvdXMubm1mXCIgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkgYXMgXCJmdXJpb3VzLmpzXCIgbGlicmFyeTwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgPC90YWJsZT5cbiAqXG4gKiAgICAgPHRhYmxlPlxuICogICAgICAgICA8Y2FwdGlvbj5PcHRpb25zIG9mIFwid2ViY2xcIiBiYWNrZW5kPC9jYXB0aW9uPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGg+T3B0aW9uIG5hbWU8L3RoPlxuICogICAgICAgICAgICAgPHRoPk9wdGlvbiB2YWx1ZXM8L3RoPlxuICogICAgICAgICAgICAgPHRoPkRlZmF1bHQgdmFsdWU8L3RoPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJkZXZpY2VcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+RGVwZW5kcyBvbiB0aGUgcGxhdGZvcm08L3RkPlxuICogICAgICAgICAgICAgPHRkPkRpc2NyZXRlIEdQVSBkZXZpY2UsIGlmIGF2YWlsYWJsZS4gT3RoZXJ3aXNlIGludGVncmF0ZWQgR1BVIGRldmljZSwgaWYgYXZhaWxhYmxlLiBPdGhlcndpc2UgQ1BVIGRldmljZS48L3RkPlxuICogICAgICAgICA8L3RyPlxuICogICAgIDwvdGFibGU+XG4gKi9cbnZhciBnZXRCYWNrZW5kT3B0aW9ucyA9IGZ1bmN0aW9uKGJhY2tlbmQpIHtcblx0aWYgKGJhY2tlbmQgPT09IFwiamF2YXNjcmlwdFwiKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdFwiYXN5bmNcIjogW3RydWUsIGZhbHNlXVxuXHRcdH07XG5cdH0gZWxzZSBpZiAoYmFja2VuZCA9PT0gXCJwbmFjbFwiKSB7XG5cdFx0aWYgKFBOYUNsQ29udGV4dC5pc1N1cHBvcnRlZCgpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcIm1hbmlmZXN0XCI6IFtQTmFDbENvbnRleHQuZ2V0RGVmYXVsdE1hbmlmZXN0VVJMKCldXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4ge307XG5cdFx0fVxuXHR9IGVsc2UgaWYgKGJhY2tlbmQgPT09IFwid2ViY2xcIikge1xuXHRcdHJldHVybiB7XG5cdFx0XHRcImRldmljZVwiOiBXZWJDTENvbnRleHQuZ2V0QXZhaWxhYmxlRGV2aWNlcygpXG5cdFx0fTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCBiYWNrZW5kOiBcIiArIGJhY2tlbmQpO1xuXHR9XG59O1xuXG4vKipcbiAqIFF1ZXJpZXMgZGVmYXVsdCBiYWNrZW5kIG9wdGlvbnMgb24gdGhpcyBwbGF0Zm9ybS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gYmFja2VuZCAtIG5hbWUgb2YgdGhlIGJhY2tlbmQgdG8gcXVlcnkgb3B0aW9ucyBmb3IuXG4gKlxuICogQHN0YXRpY1xuICogQG1ldGhvZCBnZXRCYWNrZW5kT3B0aW9uc1xuICpcbiAqIEByZXR1cm4ge09iamVjdH0gLSBBbiBvYmplY3QgdGhhdCBkZXNjcmliZXMgYXZhaWxhYmxlIG9wdGlvbnMuXG4gKiBUaGUgbmFtZXMgb2Ygb2JqZWN0J3MgcHJvcGVydGllcyBjb3JyZXNwb25kIHRvIGJhY2tlbmQgb3B0aW9uIG5hbWVzLlxuICogVGhlIHZhbHVlcyBvZiBvYmplY3QncyBwcm9wZXJ0aWVzIGNvcnJlc3BvbmQgdG8gZGVmYXVsdCBvcHRpb24gdmFsdWVzLlxuICovXG52YXIgZ2V0RGVmYXVsdEJhY2tlbmRPcHRpb25zID0gZnVuY3Rpb24oYmFja2VuZCkge1xuXHRpZiAoYmFja2VuZCA9PT0gXCJqYXZhc2NyaXB0XCIpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0XCJhc3luY1wiOiB0cnVlXG5cdFx0fTtcblx0fSBlbHNlIGlmIChiYWNrZW5kID09PSBcInBuYWNsXCIpIHtcblx0XHRpZiAoUE5hQ2xDb250ZXh0LmlzU3VwcG9ydGVkKCkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFwibWFuaWZlc3RcIjogUE5hQ2xDb250ZXh0LmdldERlZmF1bHRNYW5pZmVzdFVSTCgpXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4ge307XG5cdFx0fVxuXHR9IGVsc2UgaWYgKGJhY2tlbmQgPT09IFwid2ViY2xcIikge1xuXHRcdHJldHVybiB7XG5cdFx0XHRcImRldmljZVwiOiBXZWJDTENvbnRleHQuZ2V0RGVmYXVsdERldmljZSgpXG5cdFx0fTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCBiYWNrZW5kOiBcIiArIGJhY2tlbmQpO1xuXHR9XG59O1xuXG4vKipcbiAqIERldGVjdHMgd2hldGhlciB0aGUgcmVxdWVzdGVkIGNvbXB1dGluZyBmZWF0dXJlIGlzIGF2YWlsYWJsZVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgaGFzRmVhdHVyZVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0gYW4gaWRlbnRpZmllciBvZiB0aGUgb3B0aW9uYWwgZmVhdHVyZSB0byBkZXRlY3QuIFRoZSBmb2xsb3dpbmcgaWRlbnRpZmllcnMgYXJlIHN1cHBvcnRlZDpcbiAqXG4gKiAgICAgPHRhYmxlPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGg+RmVhdHVyZSBJZGVudGlmaWVyPC90aD5cbiAqICAgICAgICAgICAgIDx0aD5JbnRlcnByZXRhdGlvbjwvdGg+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cImFzbS5qc1wiPC90ZD5cbiAqICAgICAgICAgICAgIDx0ZD5EZXRlY3QgaWYgdGhlIEphdmFTY3JpcHQgZW5naW5lIHJlY29nbml6ZXMgQXNtLmpzIGRpcmVjdGl2ZS48L3RkPlxuICogICAgICAgICA8L3RyPlxuICogICAgICAgICA8dHI+XG4gKiAgICAgICAgICAgICA8dGQ+XCJzaW1kLmpzXCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPkRldGVjdCBpZiB0aGUgSmF2YVNjcmlwdCBlbmdpbmUgcHJvdmlkZSBTSU1ELmZsb2F0MzJ4NCwgU0lNRC5pbnQzMng0LCBGbG9hdDMyeDRBcnJheSwgYW5kIEludDMyeDRBcnJheSBvZiBTSU1ELmpzPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwid2ViZ2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+RGV0ZWN0IGlmIHRoZSBlbnZpcm9ubWVudCBzdXBwb3J0cyBXZWJHTCAoZWl0aGVyIGV4cGVyaW1lbnRhbCBvciBzdGFibGUgaW1wbGVtZW50YXRpb24pPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwid2ViY2xcIjwvdGQ+XG4gKiAgICAgICAgICAgICA8dGQ+RGV0ZWN0IGlmIHRoZSBlbnZpcm9ubWVudCBzdXBwb3J0cyBXZWJDTDwvdGQ+XG4gKiAgICAgICAgIDwvdHI+XG4gKiAgICAgICAgIDx0cj5cbiAqICAgICAgICAgICAgIDx0ZD5cInBuYWNsXCI8L3RkPlxuICogICAgICAgICAgICAgPHRkPkRldGVjdCBpZiBQb3J0YWJsZSBOYXRpdmUgQ2xpZW50IChQTmFDbCkgaXMgc3VwcG9ydGVkIGFuZCBlbmFibGVkPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICAgICAgPHRyPlxuICogICAgICAgICAgICAgPHRkPlwibmFjbFwiPC90ZD5cbiAqICAgICAgICAgICAgIDx0ZD5EZXRlY3QgaWYgTmF0aXZlIENsaWVudCAoTmFDbCkgaXMgc3VwcG9ydGVkIGFuZCBlbmFibGVkPC90ZD5cbiAqICAgICAgICAgPC90cj5cbiAqICAgICA8L3RhYmxlPlxuICpcbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gdHJ1ZSBpZiB0aGUgZmVhdHVyZSBpcyBzdXBwb3J0ZWQsIGZhbHNlIG90aGVyd2lzZVxuICovXG52YXIgaGFzRmVhdHVyZSA9IGZ1bmN0aW9uKG5hbWUpIHtcblx0c3dpdGNoIChuYW1lKSB7XG5cdFx0Y2FzZSBcImFzbS5qc1wiOlxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dmFyIHVzZXJBZ2VudCA9IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50O1xuXHRcdFx0XHR2YXIgdXNlckFnZW50Q29tcG9uZW50cyA9IHVzZXJBZ2VudC5zcGxpdCgvXFxzKy8pO1xuXHRcdFx0XHR2YXIgZmlyZWZveFJlZ2V4cCA9IC9bRmZdaXJlZm94XFwvKFxcZCspL2c7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdXNlckFnZW50Q29tcG9uZW50cy5sZW5ndGg7ICsraSkge1xuXHRcdFx0XHRcdHZhciBjb21wb25lbnQgPSB1c2VyQWdlbnRDb21wb25lbnRzW2ldO1xuXHRcdFx0XHRcdHZhciBtYXRjaCA9IGZpcmVmb3hSZWdleHAuZXhlYyhjb21wb25lbnQpO1xuXHRcdFx0XHRcdGlmIChtYXRjaCAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0dmFyIGZpcmVmb3hWZXJzaW9uID0gcGFyc2VJbnQobWF0Y2hbMV0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZpcmVmb3hWZXJzaW9uID49IDI5O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0Y2FzZSBcInNpbWQuanNcIjpcblx0XHRcdHJldHVybiAodHlwZW9mIFNJTUQgIT09IFwidW5kZWZpbmVkXCIpICYmXG5cdFx0XHRcdCh0eXBlb2YgRmxvYXQzMng0QXJyYXkgIT09IFwidW5kZWZpbmVkXCIpICYmXG5cdFx0XHRcdCh0eXBlb2YgSW50MzJ4NEFycmF5ICE9PSBcInVuZGVmaW5lZFwiKTtcblx0XHRjYXNlIFwid2ViZ2xcIjpcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGlmIChjYW52YXMuZ2V0Q29udGV4dChcIndlYmdsXCIpICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGlmIChjYW52YXMuZ2V0Q29udGV4dChcImV4cGVyaW1lbnRhbC13ZWJnbFwiKSAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRjYXNlIFwid2ViY2xcIjpcblx0XHRcdHJldHVybiBXZWJDTENvbnRleHQuaXNTdXBwb3J0ZWQoKTtcblx0XHRjYXNlIFwicG5hY2xcIjpcblx0XHRcdHJldHVybiBQTmFDbENvbnRleHQuaXNTdXBwb3J0ZWQoKTtcblx0XHRjYXNlIFwibmFjbFwiOlxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuICh0eXBlb2YgbmF2aWdhdG9yLm1pbWVUeXBlc1tcImFwcGxpY2F0aW9uL3gtbmFjbFwiXSkgIT09IFwidW5kZWZpbmVkXCI7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0ZGVmYXVsdDpcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlVua25vd24gZmVhdHVyZTogXCIgKyBuYW1lKTtcblx0fVxufTtcblxuZXhwb3J0cy5pbml0ID0gaW5pdDtcbmV4cG9ydHMuaGFzRmVhdHVyZSA9IGhhc0ZlYXR1cmU7XG5leHBvcnRzLmdldERlZmF1bHRCYWNrZW5kID0gZ2V0RGVmYXVsdEJhY2tlbmQ7XG5leHBvcnRzLmdldFN1cHBvcnRlZEJhY2tlbmRzID0gZ2V0U3VwcG9ydGVkQmFja2VuZHM7XG5leHBvcnRzLmdldEJhY2tlbmRPcHRpb25zID0gZ2V0QmFja2VuZE9wdGlvbnM7XG5leHBvcnRzLmdldERlZmF1bHRCYWNrZW5kT3B0aW9ucyA9IGdldERlZmF1bHRCYWNrZW5kT3B0aW9ucztcbmV4cG9ydHMuRGF0YVR5cGUgPSBEYXRhVHlwZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIEphdmFTY3JpcHQgaW1wbGVtZW50YXRpb24gb2YgY29tcHV0YXRpb25hbCBtZXRob2RzXG4gKlxuICogQHByaXZhdGVcbiAqIEBjbGFzcyBKU01hdGhcbiAqL1xuXG4vKipcbiAqIFNldHMgYWxsIGFycmF5IGVsZW1lbnRzIHRvIHRoZSBzcGVjaWZpZWQgdmFsdWUuXG4gKlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGEgLSB0aGUgYXJyYXkgZGF0YSBidWZmZXIuXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgLSB0aGUgY29uc3RhbnQgdG8gZmlsbCB0aGUgYnVmZmVyIHdpdGguXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZmlsbFxuICovXG5leHBvcnRzLmZpbGwgPSBmdW5jdGlvbihkYXRhLCB2YWx1ZSkge1xuXHR2YXIgbiA9IGRhdGEubGVuZ3RoO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xuXHRcdGRhdGFbaV0gPSB2YWx1ZTtcblx0fVxufTtcblxuLyoqXG4gKiBBZGRzIHR3byBhcnJheXMuXG4gKlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IGF1Z2VuZCBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQiAtIHRoZSBpbnB1dCBhZGRlbmQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgc3VtIGFycmF5LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGFkZFxuICovXG5leHBvcnRzLmFkZCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhQiwgZGF0YU91dCkge1xuXHR2YXIgbiA9IGRhdGFPdXQubGVuZ3RoO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xuXHRcdGRhdGFPdXRbaV0gPSBkYXRhQVtpXSArIGRhdGFCW2ldO1xuXHR9XG59O1xuXG4vKipcbiAqIEFkZHMgYSBjb25zdGFudCB0byBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXVnZW5kIGFycmF5LlxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlQiAtIHRoZSBhZGRlbmQgY29uc3RhbnQuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgc3VtIGFycmF5LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGFkZENvbnN0XG4gKi9cbmV4cG9ydHMuYWRkQ29uc3QgPSBmdW5jdGlvbihkYXRhQSwgdmFsdWVCLCBkYXRhT3V0KSB7XG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XG5cdFx0ZGF0YU91dFtpXSA9IGRhdGFBW2ldICsgdmFsdWVCO1xuXHR9XG59O1xuXG4vKipcbiAqIFN1YnRyYWN0cyB0d28gYXJyYXlzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBtaW51ZW5kIGFycmF5LlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFCIC0gdGhlIGlucHV0IHN1YnRyYWhlbmQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgZGlmZmVyZW5jZSBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBzdWJcbiAqL1xuZXhwb3J0cy5zdWIgPSBmdW5jdGlvbihkYXRhQSwgZGF0YUIsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gLSBkYXRhQltpXTtcblx0fVxufTtcblxuLyoqXG4gKiBTdWJ0cmFjdHMgYSBjb25zdGFudCBmcm9tIGFuIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBtaW51ZW5kIGFycmF5LlxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlQiAtIHRoZSBzdWJ0cmFoZW5kIGNvbnN0YW50LlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGRpZmZlcmVuY2UgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2Qgc3ViQ29uc3RcbiAqL1xuZXhwb3J0cy5zdWJDb25zdCA9IGZ1bmN0aW9uKGRhdGFBLCB2YWx1ZUIsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gLSB2YWx1ZUI7XG5cdH1cbn07XG5cbi8qKlxuICogU3VidHJhY3RzIGFuIGFycmF5IGZyb20gYSBjb25zdGFudC5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgc3VidHJhaGVuZCBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZUIgLSB0aGUgbWludWVuZCBjb25zdGFudC5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBkaWZmZXJlbmNlIGFycmF5LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIHN1YlJldkNvbnN0XG4gKi9cbmV4cG9ydHMuc3ViUmV2Q29uc3QgPSBmdW5jdGlvbihkYXRhQSwgdmFsdWVCLCBkYXRhT3V0KSB7XG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XG5cdFx0ZGF0YU91dFtpXSA9IHZhbHVlQiAtIGRhdGFBW2ldO1xuXHR9XG59O1xuXG4vKipcbiAqIE11bHRpcGxpZXMgdHdvIGFycmF5cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgbXVsdGlwbGljYW5kIGFycmF5LlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFCIC0gdGhlIGlucHV0IG11bHRpcGxpZXIgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgcHJvZHVjdCBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBtdWxcbiAqL1xuZXhwb3J0cy5tdWwgPSBmdW5jdGlvbihkYXRhQSwgZGF0YUIsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gKiBkYXRhQltpXTtcblx0fVxufTtcblxuLyoqXG4gKiBNdWx0aXBsaWVzIGFuIGFycmF5IGJ5IGEgY29uc3RhbnQuXG4gKlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IG11bHRpcGxpY2FuZCBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZUIgLSB0aGUgbXVsdGlwbGllciBjb25zdGFudC5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBwcm9kdWN0IGFycmF5LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIG11bENvbnN0XG4gKi9cbmV4cG9ydHMubXVsQ29uc3QgPSBmdW5jdGlvbihkYXRhQSwgdmFsdWVCLCBkYXRhT3V0KSB7XG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XG5cdFx0ZGF0YU91dFtpXSA9IGRhdGFBW2ldICogdmFsdWVCO1xuXHR9XG59O1xuXG4vKipcbiAqIERpdmlkZXMgdHdvIGFycmF5cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgZGl2aWRlbmQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUIgLSB0aGUgaW5wdXQgZGl2aXNvciBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBxdW90aWVudCBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBkaXZcbiAqL1xuZXhwb3J0cy5kaXYgPSBmdW5jdGlvbihkYXRhQSwgZGF0YUIsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gLyBkYXRhQltpXTtcblx0fVxufTtcblxuLyoqXG4gKiBEaXZpZGVzIGFuIGFycmF5IGJ5IGEgY29uc3RhbnQuXG4gKlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IGRpdmlkZW5kIGFycmF5LlxuICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlQiAtIHRoZSBkaXZpc29yIGNvbnN0YW50LlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IHF1b3RpZW50IGFycmF5LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGRpdkNvbnN0XG4gKi9cbmV4cG9ydHMuZGl2Q29uc3QgPSBmdW5jdGlvbihkYXRhQSwgdmFsdWVCLCBkYXRhT3V0KSB7XG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XG5cdFx0ZGF0YU91dFtpXSA9IGRhdGFBW2ldIC8gdmFsdWVCO1xuXHR9XG59O1xuXG4vKipcbiAqIERpdmlkZXMgYSBjb25zdGFudCBieSBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgZGl2aXNvciBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZUIgLSB0aGUgZGl2aWRlbmQgY29uc3RhbnQuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgcXVvdGllbnQgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZGl2UmV2Q29uc3RcbiAqL1xuZXhwb3J0cy5kaXZSZXZDb25zdCA9IGZ1bmN0aW9uKGRhdGFBLCB2YWx1ZUIsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gdmFsdWVCIC8gZGF0YUFbaV07XG5cdH1cbn07XG5cbi8qKlxuICogTmVnYXRlcyBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgbmVnXG4gKi9cbmV4cG9ydHMubmVnID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gLWRhdGFBW2ldO1xuXHR9XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIGFic29sdXRlIHZhbHVlIG9mIGFycmF5IGVsZW1lbnRzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBhYnNcbiAqL1xuZXhwb3J0cy5hYnMgPSBmdW5jdGlvbihkYXRhQSwgZGF0YU91dCkge1xuXHR2YXIgbiA9IGRhdGFPdXQubGVuZ3RoO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xuXHRcdGRhdGFPdXRbaV0gPSBNYXRoLmFicyhkYXRhQVtpXSk7XG5cdH1cbn07XG5cbi8qKlxuICogRXhwb25lbnRpYXRlcyBhcnJheSBlbGVtZW50cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZXhwXG4gKi9cbmV4cG9ydHMuZXhwID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gTWF0aC5leHAoZGF0YUFbaV0pO1xuXHR9XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIGxvZ2FyaXRobSBvZiBhcnJheSBlbGVtZW50cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgbG9nXG4gKi9cbmV4cG9ydHMubG9nID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHRkYXRhT3V0W2ldID0gTWF0aC5sb2coZGF0YUFbaV0pO1xuXHR9XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIHNxdWFyZSByb290IG9mIGFycmF5IGVsZW1lbnRzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBzcXJ0XG4gKi9cbmV4cG9ydHMuc3FydCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XG5cdHZhciBuID0gZGF0YU91dC5sZW5ndGg7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XG5cdFx0ZGF0YU91dFtpXSA9IE1hdGguc3FydChkYXRhQVtpXSk7XG5cdH1cbn07XG5cbi8qKlxuICogU3F1YXJlcyBhcnJheSBlbGVtZW50cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YU91dCAtIHRoZSBvdXRwdXQgYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2Qgc3F1YXJlXG4gKi9cbmV4cG9ydHMuc3F1YXJlID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQpIHtcblx0dmFyIG4gPSBkYXRhT3V0Lmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcblx0XHR2YXIgYSA9IGRhdGFBW2ldO1xuXHRcdGRhdGFPdXRbaV0gPSBhICogYTtcblx0fVxufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgbWluaW11bSB2YWx1ZSBvZiBlbGVtZW50cyBpbiBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkgdG8gY29tcHV0ZSBtaW5pbXVtIG9uLlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGFycmF5IHRvIHN0b3JlIHRoZSBtaW5pbXVtIGF0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIG1pblxuICovXG5leHBvcnRzLm1pbiA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XG5cdC8qIENvbXB1dGF0aW9uIG9mIGFsbC1hcnJheSBtaW4gKi9cblx0dmFyIGxlbmd0aEEgPSBkYXRhQS5sZW5ndGg7XG5cdHZhciByZXN1bHQgPSBkYXRhQVswXTtcblx0Zm9yICh2YXIgaSA9IDE7IGkgPCBsZW5ndGhBOyArK2kpIHtcblx0XHRyZXN1bHQgPSBNYXRoLm1pbihyZXN1bHQsIGRhdGFBW2ldKTtcblx0fVxuXHRkYXRhT3V0WzBdID0gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgbWF4aW11bSB2YWx1ZSBvZiBlbGVtZW50cyBpbiBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSB0aGUgaW5wdXQgYXJyYXkgdG8gY29tcHV0ZSBtYXhpbXVtIG9uLlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IGFycmF5IHRvIHN0b3JlIHRoZSBtYXhpbXVtIGF0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIG1heFxuICovXG5leHBvcnRzLm1heCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XG5cdC8qIENvbXB1dGF0aW9uIG9mIGFsbC1hcnJheSBtaW4gKi9cblx0dmFyIGxlbmd0aEEgPSBkYXRhQS5sZW5ndGg7XG5cdHZhciByZXN1bHQgPSBkYXRhQVswXTtcblx0Zm9yICh2YXIgaSA9IDE7IGkgPCBsZW5ndGhBOyArK2kpIHtcblx0XHRyZXN1bHQgPSBNYXRoLm1heChyZXN1bHQsIGRhdGFBW2ldKTtcblx0fVxuXHRkYXRhT3V0WzBdID0gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgc3VtIG9mIGVsZW1lbnRzIGluIGFuIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheSB3aXRoIGVsZW1lbnRzIHRvIHN1bSB1cC5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgc3VtIGF0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIG1pblxuICovXG5leHBvcnRzLnN1bSA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0KSB7XG5cdHZhciBsZW5ndGhBID0gZGF0YUEubGVuZ3RoO1xuXHR2YXIgcmVzdWx0ID0gMC4wO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aEE7ICsraSkge1xuXHRcdHJlc3VsdCArPSBkYXRhQVtpXTtcblx0fVxuXHRkYXRhT3V0WzBdID0gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgbWluaW11bSB2YWx1ZSBvZiBlbGVtZW50cyBhbG9uZyBhbiBheGlzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheSB0byBjb21wdXRlIG1pbmltYSBvbi5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgbWluaW1hIGF0LlxuICogQHBhcmFtIHtOdW1iZXJ9IG91dGVyU3RyaWRlIC0gdGhlIHByb2R1Y3Qgb2YgaW5wdXQgYXJyYXkgZGltZW5zaW9ucyBwcmVjZWVkaW5nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxuICogQHBhcmFtIHtOdW1iZXJ9IGlubmVyU3RyaWRlIC0gdGhlIHByb2R1Y3Qgb2YgaW5wdXQgYXJyYXkgZGltZW5zaW9ucyBmb2xsb3dpbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXG4gKiBAcGFyYW0ge051bWJlcn0gcmVkdWN0aW9uRGltIC0gdGhlIGxlbmd0aCBvZiBpbnB1dCBhcnJheSBhbG9uZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBheGlzTWluXG4gKi9cbmV4cG9ydHMuYXhpc01pbiA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0LCBvdXRlclN0cmlkZSwgaW5uZXJTdHJpZGUsIHJlZHVjdGlvbkRpbSkge1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IG91dGVyU3RyaWRlOyArK2kpIHtcblx0XHRmb3IgKHZhciBrID0gMDsgayA8IGlubmVyU3RyaWRlOyArK2spIHtcblx0XHRcdHZhciBvZmZzZXQgPSBpICogcmVkdWN0aW9uRGltICogaW5uZXJTdHJpZGUgKyBrO1xuXHRcdFx0dmFyIGN1cnJlbnRNaW4gPSBkYXRhQVtvZmZzZXRdO1xuXHRcdFx0Zm9yICh2YXIgaiA9IDE7IGogPCByZWR1Y3Rpb25EaW07ICsraikge1xuXHRcdFx0XHRvZmZzZXQgKz0gaW5uZXJTdHJpZGU7XG5cdFx0XHRcdGN1cnJlbnRNaW4gPSBNYXRoLm1pbihjdXJyZW50TWluLCBkYXRhQVtvZmZzZXRdKTtcblx0XHRcdH1cblx0XHRcdGRhdGFPdXRbaSAqIGlubmVyU3RyaWRlICsga10gPSBjdXJyZW50TWluO1xuXHRcdH1cblx0fVxufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgbWF4aW11bSB2YWx1ZSBvZiBlbGVtZW50cyBhbG9uZyBhbiBheGlzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheSB0byBjb21wdXRlIG1heGltYSBvbi5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgbWF4aW1hIGF0LlxuICogQHBhcmFtIHtOdW1iZXJ9IG91dGVyU3RyaWRlIC0gdGhlIHByb2R1Y3Qgb2YgaW5wdXQgYXJyYXkgZGltZW5zaW9ucyBwcmVjZWVkaW5nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxuICogQHBhcmFtIHtOdW1iZXJ9IGlubmVyU3RyaWRlIC0gdGhlIHByb2R1Y3Qgb2YgaW5wdXQgYXJyYXkgZGltZW5zaW9ucyBmb2xsb3dpbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXG4gKiBAcGFyYW0ge051bWJlcn0gcmVkdWN0aW9uRGltIC0gdGhlIGxlbmd0aCBvZiBpbnB1dCBhcnJheSBhbG9uZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBheGlzTWF4XG4gKi9cbmV4cG9ydHMuYXhpc01heCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhT3V0LCBvdXRlclN0cmlkZSwgaW5uZXJTdHJpZGUsIHJlZHVjdGlvbkRpbSkge1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IG91dGVyU3RyaWRlOyArK2kpIHtcblx0XHRmb3IgKHZhciBrID0gMDsgayA8IGlubmVyU3RyaWRlOyArK2spIHtcblx0XHRcdHZhciBvZmZzZXQgPSBpICogcmVkdWN0aW9uRGltICogaW5uZXJTdHJpZGUgKyBrO1xuXHRcdFx0dmFyIGN1cnJlbnRNYXggPSBkYXRhQVtvZmZzZXRdO1xuXHRcdFx0Zm9yICh2YXIgaiA9IDE7IGogPCByZWR1Y3Rpb25EaW07ICsraikge1xuXHRcdFx0XHRvZmZzZXQgKz0gaW5uZXJTdHJpZGU7XG5cdFx0XHRcdGN1cnJlbnRNYXggPSBNYXRoLm1heChjdXJyZW50TWF4LCBkYXRhQVtvZmZzZXRdKTtcblx0XHRcdH1cblx0XHRcdGRhdGFPdXRbaSAqIGlubmVyU3RyaWRlICsga10gPSBjdXJyZW50TWF4O1xuXHRcdH1cblx0fVxufTtcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgc3VtIG9mIGVsZW1lbnRzIGFsb25nIGFuIGF4aXMuXG4gKlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFBIC0gdGhlIGlucHV0IGFycmF5IHRvIHN1bSB1cC5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSB0byBzdG9yZSB0aGUgc3VtcyBhdC5cbiAqIEBwYXJhbSB7TnVtYmVyfSBvdXRlclN0cmlkZSAtIHRoZSBwcm9kdWN0IG9mIGlucHV0IGFycmF5IGRpbWVuc2lvbnMgcHJlY2VlZGluZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cbiAqIEBwYXJhbSB7TnVtYmVyfSBpbm5lclN0cmlkZSAtIHRoZSBwcm9kdWN0IG9mIGlucHV0IGFycmF5IGRpbWVuc2lvbnMgZm9sbG93aW5nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxuICogQHBhcmFtIHtOdW1iZXJ9IHJlZHVjdGlvbkRpbSAtIHRoZSBsZW5ndGggb2YgaW5wdXQgYXJyYXkgYWxvbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgYXhpc1N1bVxuICovXG5leHBvcnRzLmF4aXNTdW0gPSBmdW5jdGlvbihkYXRhQSwgZGF0YU91dCwgb3V0ZXJTdHJpZGUsIGlubmVyU3RyaWRlLCByZWR1Y3Rpb25EaW0pIHtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBvdXRlclN0cmlkZTsgKytpKSB7XG5cdFx0Zm9yICh2YXIgayA9IDA7IGsgPCBpbm5lclN0cmlkZTsgKytrKSB7XG5cdFx0XHR2YXIgb2Zmc2V0ID0gaSAqIHJlZHVjdGlvbkRpbSAqIGlubmVyU3RyaWRlICsgaztcblx0XHRcdHZhciBjdXJyZW50U3VtID0gZGF0YUFbb2Zmc2V0XTtcblx0XHRcdGZvciAodmFyIGogPSAxOyBqIDwgcmVkdWN0aW9uRGltOyArK2opIHtcblx0XHRcdFx0b2Zmc2V0ICs9IGlubmVyU3RyaWRlO1xuXHRcdFx0XHRjdXJyZW50U3VtICs9IGRhdGFBW29mZnNldF07XG5cdFx0XHR9XG5cdFx0XHRkYXRhT3V0W2kgKiBpbm5lclN0cmlkZSArIGtdID0gY3VycmVudFN1bTtcblx0XHR9XG5cdH1cbn07XG5cbi8qKlxuICogQ29tcHV0ZXMgdGhlIGRvdCBwcm9kdWN0IG9mIHR3byBOLWRpbWVuc2lvbmFsIGFycmF5cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUEgLSBhbiBpbnB1dCBtdWx0aXBsaWNhbmQgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gZGF0YUIgLSBhbiBpbnB1dCBtdWx0aXBsaWVyIGFycmF5LlxuICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGFPdXQgLSB0aGUgb3V0cHV0IHByb2R1Y3QgYXJyYXkuXG4gKiBAcGFyYW0ge051bWJlcn0gc3RyaWRlQSAtIHRoZSBwcm9kdWN0IG9mIHRoZSB0aGUgbXVsdGlwbGljYW5kIGRpbWVuc2lvbnMgcHJlY2VlZGluZyB0aGUgcmVkdWN0aW9uIGRpbWVuc2lvbi5cbiAqIEBwYXJhbSB7TnVtYmVyfSBvdXRlclN0cmlkZUIgLSB0aGUgcHJvZHVjdCBvZiB0aGUgbXVsdGlwbGllciBkaW1lbnNpb25zIHByZWNlZWRpbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXG4gKiBAcGFyYW0ge051bWJlcn0gaW5uZXJTdHJpZGVCIC0gdGhlIHByb2R1Y3Qgb2YgdGhlIG11bHRpcGxpZXIgZGltZW5zaW9ucyBmb2xsb3dpbmcgdGhlIHJlZHVjdGlvbiBkaW1lbnNpb24uXG4gKiBAcGFyYW0ge051bWJlcn0gcmVkdWN0aW9uRGltIC0gdGhlIGxlbmd0aCBvZiBpbnB1dHMgYXJyYXlzIGFsb25nIHRoZSByZWR1Y3Rpb24gZGltZW5zaW9uLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGRvdFxuICovXG5leHBvcnRzLmRvdCA9IGZ1bmN0aW9uKGRhdGFBLCBkYXRhQiwgZGF0YU91dCwgc3RyaWRlQSwgb3V0ZXJTdHJpZGVCLCBpbm5lclN0cmlkZUIsIHJlZHVjdGlvbkRpbSkge1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IHN0cmlkZUE7ICsraSkge1xuXHRcdGZvciAodmFyIGogPSAwOyBqIDwgcmVkdWN0aW9uRGltOyArK2opIHtcblx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgb3V0ZXJTdHJpZGVCOyArK2spIHtcblx0XHRcdFx0Zm9yICh2YXIgbCA9IDA7IGwgPCBpbm5lclN0cmlkZUI7ICsrbCkge1xuXHRcdFx0XHRcdGRhdGFPdXRbKGkqb3V0ZXJTdHJpZGVCICsgaykgKiBpbm5lclN0cmlkZUIgKyBsXSArPSBkYXRhQVtpKnJlZHVjdGlvbkRpbStqXSAqIGRhdGFCWyhrKnJlZHVjdGlvbkRpbStqKSppbm5lclN0cmlkZUIrbF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn07XG5cbi8qKlxuICogUmVwbGljYXRlcyBhcnJheSBlbGVtZW50cyBhbG9uZyBhbiBheGlzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhQSAtIHRoZSBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhT3V0IC0gdGhlIG91dHB1dCBhcnJheSBmb3IgcmVwZWF0ZWQgZWxlbWVudHMuXG4gKiBAcGFyYW0ge051bWJlcn0gb3V0ZXJTdHJpZGUgLSB0aGUgcHJvZHVjdCBvZiBpbnB1dCBhcnJheSBkaW1lbnNpb25zIHByZWNlZWRpbmcgdGhlIGV4cGFuc2lvbiBkaW1lbnNpb24uXG4gKiBAcGFyYW0ge051bWJlcn0gaW5uZXJTdHJpZGUgLSB0aGUgcHJvZHVjdCBvZiBpbnB1dCBhcnJheSBkaW1lbnNpb25zIGZvbGxvd2luZyB0aGUgZXhwYW5zaW9uIGRpbWVuc2lvbi5cbiAqIEBwYXJhbSB7TnVtYmVyfSBleHBhbnNpb25EaW0gLSB0aGUgbGVuZ3RoIG9mIGlucHV0IGFycmF5IGFsb25nIHRoZSBleHBhbnNpb24gZGltZW5zaW9uLlxuICogQHBhcmFtIHtOdW1iZXJ9IHJlcGVhdHMgLSB0aGUgbnVtYmVyIG9mIHRpbWVzIGVhY2ggZWxlbWVudCB3aWxsIGJlIHJlcGxpY2F0ZWQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgcmVwZWF0XG4gKi9cbmV4cG9ydHMucmVwZWF0ID0gZnVuY3Rpb24oZGF0YUEsIGRhdGFPdXQsIG91dGVyU3RyaWRlLCBpbm5lclN0cmlkZSwgZXhwYW5zaW9uRGltLCByZXBlYXRzKSB7XG5cdGlmIChpbm5lclN0cmlkZSA8IHJlcGVhdHMpIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG91dGVyU3RyaWRlOyArK2kpIHtcblx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgZXhwYW5zaW9uRGltOyArK2opIHtcblx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCBpbm5lclN0cmlkZTsgKytrKSB7XG5cdFx0XHRcdFx0dmFyIHZhbHVlQSA9IGRhdGFBWyhpICogZXhwYW5zaW9uRGltICsgaikgKiBpbm5lclN0cmlkZSArIGtdO1xuXHRcdFx0XHRcdGZvciAodmFyIGMgPSAwOyBjIDwgcmVwZWF0czsgKytjKSB7XG5cdFx0XHRcdFx0XHRkYXRhT3V0WygoaSAqIGV4cGFuc2lvbkRpbSArIGopICogcmVwZWF0cyArIGMpICogaW5uZXJTdHJpZGUgKyBrXSA9IHZhbHVlQTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBvdXRlclN0cmlkZTsgKytpKSB7XG5cdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IGV4cGFuc2lvbkRpbTsgKytqKSB7XG5cdFx0XHRcdHZhciByb3dBID0gZGF0YUEuc3ViYXJyYXkoKGkgKiBleHBhbnNpb25EaW0gKyBqKSAqIGlubmVyU3RyaWRlLCAoaSAqIGV4cGFuc2lvbkRpbSArIGogKyAxKSAqIGlubmVyU3RyaWRlKTtcblx0XHRcdFx0Zm9yICh2YXIgYyA9IDA7IGMgPCByZXBlYXRzOyArK2MpIHtcblx0XHRcdFx0XHRkYXRhT3V0LnNldChyb3dBLCAoKGkgKiBleHBhbnNpb25EaW0gKyBqKSAqIHJlcGVhdHMgKyBjKSAqIGlubmVyU3RyaWRlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIFByb3ZpZGVzIGhlbHBlciBmdW5jdGlvbnNcbiAqXG4gKiBAcHJpdmF0ZVxuICogQGNsYXNzIHV0aWxcbiAqL1xuXG52YXIgaXNOdW1iZXIgPSBmdW5jdGlvbihuKSB7XG5cdHJldHVybiBuID09PSArbjtcbn07XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbnZhciBpc1JlYWwgPSBmdW5jdGlvbihuKSB7XG5cdHJldHVybiAobiA9PT0gK24pICYmIChpc0Zpbml0ZShuKSk7XG59O1xuZXhwb3J0cy5pc1JlYWwgPSBpc1JlYWw7XG5cbnZhciBpc0ludCA9IGZ1bmN0aW9uKG4pIHtcblx0cmV0dXJuIG4gPT09IChufDApO1xufTtcbmV4cG9ydHMuaXNJbnQgPSBpc0ludDtcblxuZXhwb3J0cy5pc1Bvc2l0aXZlSW50ID0gZnVuY3Rpb24obikge1xuXHRyZXR1cm4gKG4gPT09ICtuKSAmJiAobiA9PT0gKG58MCkpICYmIChuID4gMCk7XG59O1xuXG5leHBvcnRzLmlzTm9uTmVnYXRpdmVJbnQgPSBmdW5jdGlvbihuKSB7XG5cdHJldHVybiAobiA9PT0gK24pICYmIChuID09PSAobnwwKSkgJiYgKG4gPj0gMCk7XG59O1xuXG52YXIgaXNBcnJheSA9IGZ1bmN0aW9uKGxpc3QpIHtcblx0cmV0dXJuIGxpc3QgaW5zdGFuY2VvZiBBcnJheTtcbn07XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5leHBvcnRzLmlzSW50QXJyYXkgPSBmdW5jdGlvbihsaXN0KSB7XG5cdGlmIChleHBvcnRzLmlzQXJyYXkobGlzdCkpIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmICghZXhwb3J0cy5pc0ludChsaXN0W2ldKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufTtcblxuZXhwb3J0cy5pc1Bvc2l0aXZlSW50QXJyYXkgPSBmdW5jdGlvbihsaXN0KSB7XG5cdGlmIChleHBvcnRzLmlzQXJyYXkobGlzdCkpIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmICghZXhwb3J0cy5pc1Bvc2l0aXZlSW50KGxpc3RbaV0pKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59O1xuXG5leHBvcnRzLmFzSW50QXJyYXkgPSBmdW5jdGlvbiAobGlzdCkge1xuXHRpZiAoZXhwb3J0cy5pc0ludChsaXN0KSkge1xuXHRcdHJldHVybiBbbGlzdF07XG5cdH0gZWxzZSBpZiAoZXhwb3J0cy5pc0ludEFycmF5KGxpc3QpKSB7XG5cdFx0cmV0dXJuIGxpc3Q7XG5cdH0gZWxzZSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihsaXN0ICsgXCIgY2FuIG5vdCBiZSBjb252ZXJ0ZWQgdG8gaW50ZWdlciBhcnJheVwiKTtcblx0fVxufTtcblxuZXhwb3J0cy5yb3VuZFVwID0gZnVuY3Rpb24gKG51bWJlciwgbXVsdGlwbGUpIHtcblx0cmV0dXJuIE1hdGguY2VpbChudW1iZXIgLyBtdWx0aXBsZSkgKiBtdWx0aXBsZTtcbn07XG5cbi8qKlxuICogVmFsaWRhdGUgdGhlIHNoYXBlIGFyZ3VtZW50LlxuICogVGhyb3dzIGFuIGVycm9yIGlmIHRoZSBhcmd1bWVudCByZXByZXNlbnRzIGEgdmFsaWQgc2hhcGUuXG4gKiBSZXR1cm5zIHRoZSBzaGFwZSBhcyBhbiBpbnRlZ2VyIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7KE51bWJlcnxOdW1iZXJbXSl9IHNoYXBlIC0gdGhlIHNoYXBlIGFyZ3VtZW50IHRvIHZhbGlkYXRlLlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgc2hhcGUgPSB1dGlsLmNoZWNrU2hhcGUoc2hhcGUpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGNoZWNrU2hhcGVcbiAqL1xudmFyIGNoZWNrU2hhcGUgPSBmdW5jdGlvbihzaGFwZSkge1xuXHRpZiAoaXNOdW1iZXIoc2hhcGUpKSB7XG5cdFx0cmV0dXJuIGNoZWNrU2hhcGUoW3NoYXBlXSk7XG5cdH0gZWxzZSBpZiAoaXNBcnJheShzaGFwZSkpIHtcblx0XHR2YXIgbiA9IHNoYXBlLmxlbmd0aDtcblx0XHR2YXIgb3V0U2hhcGUgPSBuZXcgQXJyYXkobik7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcblx0XHRcdGlmICghaXNOdW1iZXIoc2hhcGVbaV0pKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihcIlNoYXBlIGhhcyBub24tbnVtZXJpYyBkaW1lbnNpb25zXCIpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFpc0ludChzaGFwZVtpXSkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiU2hhcGUgbXVzdCBoYXZlIGludGVnZXIgZGltZW5zaW9uc1wiKTtcblx0XHRcdH1cblx0XHRcdGlmIChzaGFwZVtpXSA8IDEpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRGVnZW5lcmF0ZSBzaGFwZVwiKTtcblx0XHRcdH1cblx0XHRcdG91dFNoYXBlW2ldID0gc2hhcGVbaV18MDtcblx0XHR9XG5cdFx0cmV0dXJuIG91dFNoYXBlO1xuXHR9XG59O1xuZXhwb3J0cy5jaGVja1NoYXBlID0gY2hlY2tTaGFwZTtcblxuLyoqXG4gKiBDaGVja3MgdGhhdCB0aGUgdHdvIHNoYXBlcyBhcmUgc2ltaWxhci5cbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgdHdvIHNoYXBlcyBhcmUgZGlmZmVyZW50LlxuICogSWYgdGhlIGRhdGEgdHlwZXMgYXJlIGNvbXBhdGlibGUsIHRoZSBmdW5jdGlvbiBkb2VzIG5vdGhpbmcuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJbXX0gc2hhcGVBIC0gb25lIHZhbGlkIHNoYXBlIHRvIGNvbXBhcmUuXG4gKiBAcGFyYW0ge051bWJlcltdfSBzaGFwZUIgLSBhbm90aGVyIHZhbGlkIHNoYXBlIHRvIGNvbXBhcmUuXG4gKlxuICogQGV4YW1wbGVcbiAqICAgICB1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBiLnNoYXBlKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBjaGVja1NoYXBlc0NvbXBhdGliaWxpdHlcbiAqL1xuZXhwb3J0cy5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkgPSBmdW5jdGlvbihzaGFwZUEsIHNoYXBlQikge1xuXHRpZiAoc2hhcGVBLmxlbmd0aCAhPSBzaGFwZUIubGVuZ3RoKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiVGhlIHNoYXBlcyBoYXZlIGRpZmZlcmVudCBkaW1lbnNpb25zXCIpO1xuXHR9XG5cdHZhciBuID0gc2hhcGVBLmxlbmd0aDtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcblx0XHRpZiAoc2hhcGVBW2ldICE9IHNoYXBlQltpXSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVGhlIHNoYXBlcyBhcmUgZGlmZmVyZW50XCIpO1xuXHRcdH1cblx0fVxufTtcblxuLyoqXG4gKiBDb21wdXRlcyBhcnJheSBsZW5ndGggZnJvbSBpdHMgc2hhcGUuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJbXX0gc2hhcGUgLSBhbiBhcnJheSBzaGFwZS4gIFRoZSBzaGFwZSBtdXN0IGJlIHZhbGlkIHcuci50LiAqKmNoZWNrU2hhcGUqKiBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogICAgIHZhciBsZW5ndGggPSB1dGlsLmNvbXB1dGVMZW5ndGgoc2hhcGUpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGNvbXB1dGVMZW5ndGhcbiAqL1xuZXhwb3J0cy5jb21wdXRlTGVuZ3RoID0gZnVuY3Rpb24oc2hhcGUpIHtcblx0dmFyIGxlbmd0aCA9IDE7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgc2hhcGUubGVuZ3RoOyArK2kpIHtcblx0XHRsZW5ndGggKj0gc2hhcGVbaV07XG5cdH1cblx0cmV0dXJuIGxlbmd0aDtcbn07XG5cbi8qKlxuICogQ2hlY2tzIHRoZSB0aGUgYXJndW1lbnQgcmVwcmVzZW50cyBhIGRhdGEgdHlwZS5cbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgYXJndW1lbnQgaXMgbm90IG9mIERhdGFUeXBlIHR5cGUuXG4gKiBJZiB0aGUgYXJndW1lbnQgaXMgYSBEYXRhVHlwZSBvYmplY3QsIHRoZSBmdW5jdGlvbiBkb2VzIG5vdGhpbmcuXG4gKlxuICogQHBhcmFtIHtEYXRhVHlwZX0gZGF0YVR5cGUgLSB0aGUgZXhwZWN0ZWRseSBkYXRhIHR5cGUgb2JqZWN0IHRvIHZhbGlkYXRlLlxuICogQHJldHVybiB7RGF0YVR5cGV9IC0gYSBkYXRhIHR5cGUgb2JqZWN0IGVxdWl2YWxlbnQgdG8gdGhlIGFyZ3VtZW50LlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgZGF0YVR5cGUgPSB1dGlsLmNoZWNrRGF0YVR5cGUoZGF0YVR5cGUpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGNoZWNrRGF0YVR5cGVcbiAqL1xuZXhwb3J0cy5jaGVja0RhdGFUeXBlID0gZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0dmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XG5cdGlmICghKGRhdGFUeXBlIGluc3RhbmNlb2YgRGF0YVR5cGUpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcImRhdGFUeXBlIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBEYXRhVHlwZVwiKTtcblx0fVxuXHRyZXR1cm4gZGF0YVR5cGU7XG59O1xuXG4vKipcbiAqIENoZWNrcyB0aGF0IHRoZSB0d28gZGF0YSB0eXBlcyBhcmUgY29tcGF0aWJsZS5cbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgZGF0YSB0eXBlcyBkbyBub3QgbWF0Y2guXG4gKiBJZiB0aGUgZGF0YSB0eXBlcyBhcmUgY29tcGF0aWJsZSwgdGhlIGZ1bmN0aW9uIGRvZXMgbm90aGluZy5cbiAqXG4gKiBAcGFyYW0ge0RhdGFUeXBlfSBkYXRhVHlwZUEgLSB0aGUgZmlyc3QgZGF0YSB0eXBlLlxuICogQHBhcmFtIHtEYXRhVHlwZX0gZGF0YVR5cGVCIC0gdGhlIHNlY29uZCBkYXRhIHR5cGUuXG4gKlxuICogQGV4YW1wbGVcbiAqICAgICB1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBiLmRhdGFUeXBlKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBjaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHlcbiAqL1xuZXhwb3J0cy5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkgPSBmdW5jdGlvbihkYXRhVHlwZUEsIGRhdGFUeXBlQikge1xuXHRpZiAoIWRhdGFUeXBlQS5lcXVhbHMoZGF0YVR5cGVCKSkge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIlRoZSBkYXRhIHR5cGVzIGFyZSBub3QgY29tcGF0aWJsZVwiKTtcblx0fVxufTtcblxuLyoqXG4gKiBWYWxpZGF0ZXMgYW4gTkRBcnJheSBwYXJhbWV0ZXIuXG4gKiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIGV4cGVjdGVkIE5EQXJyYXkgYXJndW1lbnQgaGFzIG90aGVyIHR5cGUgb3IgaWYgaXQgaGFzIGJlZW4gaW52YWxpZGF0ZWQuXG4gKiBJZiB0aGUgYXJndW1lbnQgaXMgYSB2YWxpZCBOREFycmF5LCB0aGUgZnVuY3Rpb24gZG9lcyBub3RoaW5nLlxuICpcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXkgLSB0aGUgZXhwZWN0ZWRseSBOREFycmF5IGFyZ3VtZW50IHRvIGJlIHZhbGlkYXRlZC5cbiAqIEBwYXJhbSB7U3RyaW5nfSB2YW5hbWUgLSB0aGUgbmFtZSBvZiB0aGUgTkRBcnJheSBhcmd1bWVudCB0byBiZSB1c2VkIGluIGVycm9yIG1lc3NhZ2VzLlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgdXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBjaGVja05EQXJyYXlcbiAqL1xuZXhwb3J0cy5jaGVja05EQXJyYXkgPSBmdW5jdGlvbihhcnJheSwgdmFybmFtZSkge1xuXHR2YXIgTkRBcnJheSA9IHJlcXVpcmUoXCIuL05EQXJyYXlcIik7XG5cdGlmICghKGFycmF5IGluc3RhbmNlb2YgTkRBcnJheSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHZhcm5hbWUgKyBcIiBpcyBub3QgYW4gTkRBcnJheVwiKTtcblx0fVxuXHRpZiAoIWFycmF5LmlzVmFsaWQoKSkge1xuXHRcdHRocm93IG5ldyBFcnJvcih2YXJuYW1lICsgXCIgaXMgYW4gaW52YWxpZGF0ZWQgYXJyYXlcIik7XG5cdH1cbn07XG5cbi8qKlxuICogQ2hlY2tzIHRoYXQgdGhlIHR3byBhcnJheXMgYXJlIGRpZmZlcmVudC5cbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGV5IHJlZmVyIHRvIHRoZSBzYW1lIG9iamVjdC5cbiAqIElmIHRoZSBhcnJheXMgYXJlIGRpZmZlcmVudCwgdGhlIGZ1bmN0aW9uIGRvZXMgbm90aGluZy5cbiAqXG4gKiBAcGFyYW0ge05EQXJyYXl9IGEgLSB0aGUgZmlyc3QgYXJyYXkgdG8gY2hlY2suIE11c3QgYmUgYW4gTkRBcnJheSBvYmplY3QuXG4gKiBAcGFyYW0ge05EQXJyYXl9IGIgLSB0aGUgc2Vjb25kIGFycmF5IHRvIGNoZWNrLiBNdXN0IGJlIGFuIE5EQXJyYXkgb2JqZWN0LlxuICogQHBhcmFtIHtTdHJpbmd9IHZhcm5hbWVBIC0gbmFtZSBvZiB0aGUgZmlyc3QgYXJyYXkgdmFyaWFibGUuIFRoaXMgbmFtZSBtYXkgYmUgdXNlZCBpbiBhbiBlcnJvciBtZXNzYWdlLlxuICogQHBhcmFtIHtTdHJpbmd9IHZhcm5hbWVCIC0gbmFtZSBvZiB0aGUgc2Vjb25kIGFycmF5IHZhcmlhYmxlLiBUaGlzIG5hbWUgbWF5IGJlIHVzZWQgaW4gYW4gZXJyb3IgbWVzc2FnZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogICAgIHV0aWwuY2hlY2tEaWZmZXJlbnROREFycmF5cyhhLCBvdXQsIFwiYVwiLCBcIm91dFwiKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBjaGVja0RpZmZlcmVudE5EQXJyYXlzXG4gKi9cbmV4cG9ydHMuY2hlY2tEaWZmZXJlbnROREFycmF5cyA9IGZ1bmN0aW9uKGEsIGIsIHZhcm5hbWVBLCB2YXJuYW1lQikge1xuXHRpZiAoYSA9PT0gYikge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIlRoZSBhcnJheXMgXCIgKyB2YXJuYW1lQSArIFwiIGFuZCBcIiArIHZhcm5hbWVCICsgXCIgbXVzdCBiZSBkaWZmZXJlbnRcIik7XG5cdH1cbn07XG5cbi8qKlxuICogVmFsaWRhdGVzICoqcmVwZWF0cyoqIHBhcmFtZXRlciBmb3IgcmVwZWF0aXRpb24vdGlsaW5nIG9mIGFycmF5IGFsb25nIGFuIGF4aXMuXG4gKiBUaHJvd3MgYW4gZXJyb3IgaWYgKipyZXBlYXRzKiogaXMgbm90IGFuIGludGVnZXIgb3IgaWYgKipyZXBlYXRzKiogaXMgc21hbGxlciB0aGFuIDIuXG4gKiBJZiAqKnJlcGVhdHMqKiBpcyB2YWxpZCwgdGhlIGZ1bmN0aW9uIGRvZXMgbm90aGluZy5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gcmVwZWF0cyAtIHRoZSByZXBlYXRzIGFyZ3VtZW50IHRvIGJlIHZlcmlmaWVkLlxuICogQHJldHVybiB7TnVtYmVyfSAtICoqcmVwZWF0cyoqIGNhc3RlZCB0byBpbnRlZ2VyLlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgcmVwZWF0cyA9IHV0aWwuY2hlY2tSZXBlYXRzKHJlcGVhdHMpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGNoZWNrUmVwZWF0c1xuICovXG5leHBvcnRzLmNoZWNrUmVwZWF0cyA9IGZ1bmN0aW9uKHJlcGVhdHMpIHtcblx0aWYgKCFpc0ludChyZXBlYXRzKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJSZXBlYXRzIGlzIG5vdCBhbiBpbnRlZ2VyXCIpO1xuXHR9XG5cdGlmIChyZXBlYXRzIDw9IDEpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlJlcGVhdHMgc2hvdWxkIGJlIGdyZWF0ZXIgdGhhbiAxXCIpO1xuXHR9XG5cdHJldHVybiByZXBlYXRzfDA7XG59O1xuXG4vKipcbiAqIFZhbGlkYXRlcyBheGlzIHBhcmFtZXRlciBmb3IgcmVkdWN0aW9ucyBhbG9uZyBhbiBheGlzLlxuICogVGhyb3dzIGFuIGVycm9yIGlmIGF4aXMgaXMgbm90IGFuIGludGVnZXIsIGlmIGF4aXMgaXMgbmVnYXRpdmUsIG9yIGF4aXMgZXhjZWVkcyB0aGUgbnVtYmVyIG9mIGRpbWVuc2lvbnMuXG4gKiBJZiBheGlzIGlzIHZhbGlkLCB0aGUgZnVuY3Rpb24gZG9lcyBub3RoaW5nLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgYXJndW1lbnQgdG8gYmUgdmVyaWZpZWQuXG4gKiBAcGFyYW0ge051bWJlcn0gbnVtRGltZW5zaW9ucyAtIHRoZSBudW1iZXIgb2YgZGltZW5zaW9ucyBpbiB0aGUgYXJyYXkgYmVpbmcgcmVkdWNlZC5cbiAqIEByZXR1cm4ge051bWJlcn0gLSBheGlzIGNhc3RlZCB0byBpbnRlZ2VyLlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgYXhpcyA9IHV0aWwuY2hlY2tBeGlzKGF4aXMsIG5kYXJyYXkuc2hhcGUubGVuZ3RoKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZFxuICovXG5leHBvcnRzLmNoZWNrQXhpcyA9IGZ1bmN0aW9uKGF4aXMsIG51bURpbWVuc2lvbnMpIHtcblx0aWYgKCFpc0ludChheGlzKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJBeGlzIGlzIG5vdCBhbiBpbnRlZ2VyXCIpO1xuXHR9XG5cdGlmIChheGlzIDwgMCkge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiQXhpcyBpcyBuZWdhdGl2ZVwiKTtcblx0fVxuXHQvKiBFLmcuIDMtZGltZW5zaW9uYWwgYXJyYXkgaGFzIGF4ZXMgMCwgMSwgMiAoYnV0IG5vdCAzISkgKi9cblx0aWYgKGF4aXMgPj0gbnVtRGltZW5zaW9ucykge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiQXhpcyBvdXQgb2YgcmFuZ2VcIik7XG5cdH1cblx0cmV0dXJuIGF4aXN8MDtcbn07XG5cbi8qKlxuICogVmFsaWRhdGVzIHRoZSBzaGFwZSBvZiBvdXRwdXQgYXJyYXkgZm9yIHJlZHVjdGlvbnMgYWxvbmcgYW4gYXhpcy5cbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgc2hhcGUgb2YgdGhlIG91dHB1dCBhcnJheSBkb2VzIG1hdGNoIHRoZSBzaGFwZSBvZiBpbnB1dCBhcnJheSBhZnRlciByZWR1Y3Rpb24gYWxvbmcgdGhlIGF4aXMuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJbXX0gaW5TaGFwZSAtIHRoZSBzaGFwZSBvZiB0aGUgaW5wdXQgYXJyYXkuXG4gKiBAcGFyYW0ge051bWJlcltdfSBvdXRTaGFwZSAtIHRoZSBzaGFwZSBvZiB0aGUgb3V0cHV0IGFycmF5IHRvIGJlIHZhbGlkYXRlZC5cbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgZm9yIHJlZHVjdGlvbiBvZiBpbnB1dCBhcnJheS4gTXVzdCBiZSB2YWxpZCB3LnIudC4gaW5TaGFwZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogICAgIHV0aWwuY2hlY2tBeGlzUmVkdWN0aW9uT3V0U2hhcGUoaW5BcnJheS5zaGFwZSwgb3V0QXJyYXkuc2hhcGUsIGF4aXMpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kXG4gKi9cbmV4cG9ydHMuY2hlY2tBeGlzUmVkdWN0aW9uT3V0U2hhcGUgPSBmdW5jdGlvbihpblNoYXBlLCBvdXRTaGFwZSwgYXhpcykge1xuXHRpZiAoaW5TaGFwZS5sZW5ndGggIT09IG91dFNoYXBlLmxlbmd0aCArIDEpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJPdXRwdXQgYXJyYXkgaGFzIGludmFsaWQgbnVtYmVyIG9mIGRpbWVuc2lvbnMgZm9yIHRoaXMgb3BlcmF0aW9uXCIpO1xuXHR9XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYXhpczsgKytpKSB7XG5cdFx0aWYgKGluU2hhcGVbaV0gIT09IG91dFNoYXBlW2ldKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJPdXRwdXQgYXJyYXkgaGFzIGludmFsaWQgc2hhcGUgZm9yIHRoaXMgb3BlcmF0aW9uXCIpO1xuXHRcdH1cblx0fVxuXHRmb3IgKHZhciBpID0gYXhpcyArIDE7IGkgPCBpblNoYXBlLmxlbmd0aDsgKytpKSB7XG5cdFx0aWYgKGluU2hhcGVbaV0gIT09IG91dFNoYXBlW2ktMV0pIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIk91dHB1dCBhcnJheSBoYXMgaW52YWxpZCBzaGFwZSBmb3IgdGhpcyBvcGVyYXRpb25cIik7XG5cdFx0fVxuXHR9XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIHRoZSBzaGFwZSBvZiBhbiBhcnJheSBhZnRlciByZWR1Y3Rpb24gYWxvbmcgYW4gYXhpcy5cbiAqXG4gKiBAcGFyYW0ge051bWJlcltdfSBpblNoYXBlIC0gdGhlIHNoYXBlIG9mIHRoZSBpbnB1dCBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgZm9yIHJlZHVjdGlvbiBvZiBpbnB1dCBhcnJheS4gTXVzdCBiZSB2YWxpZCB3LnIudC4gaW5TaGFwZS5cbiAqIEByZXR1cm4ge051bWJlcltdfSAtIHRoZSBzaGFwZSBvZiB0aGUgb3V0cHV0IGFycmF5LlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgdmFyIG91dFNoYXBlID0gdXRpbC5nZXRBeGlzUmVkdWN0aW9uT3V0U2hhcGUoaW5BcnJheS5zaGFwZSwgYXhpcyk7XG4gKiAgICAgdmFyIG91dEFycmF5ID0gbmV3IE5EQXJyYXkob3V0U2hhcGUsIGluQXJyYXkuZGF0YVR5cGUsIGNvbnRleHQpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kXG4gKi9cbmV4cG9ydHMuY29tcHV0ZUF4aXNSZWR1Y3Rpb25PdXRTaGFwZSA9IGZ1bmN0aW9uKGluU2hhcGUsIGF4aXMpIHtcblx0dmFyIG91dFNoYXBlID0gW107XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgaW5TaGFwZS5sZW5ndGg7ICsraSkge1xuXHRcdGlmIChpICE9PSBheGlzKSB7XG5cdFx0XHRvdXRTaGFwZS5wdXNoKGluU2hhcGVbaV0pO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gb3V0U2hhcGU7XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIHRoZSBwcm9kdWN0IG9mIGFycmF5IGRpbWVuc2lvbnMgYmVmb3JlIHRoZSBheGlzLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyW119IHNoYXBlIC0gdGhlIHNoYXBlIG9mIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgdXNlZCBpbiBhbiBvcGVyYXRpb24uIE11c3QgYmUgdmFsaWQgdy5yLnQuIHNoYXBlLlxuICogQHJldHVybiB7TnVtYmVyfSAtIHRoZSBwcm9kdWN0IG9mIGFycmF5IGRpbWVuc2lvbnMgYmVmb3JlIGF4aXMuXG4gKlxuICogQGV4YW1wbGVcbiAqICAgICAvLyA1LWRpbWVuc2lvbmFsIGFycmF5XG4gKiAgICAgdmFyIG5kYXJyYXkgPSBjb250ZXh0LmVtcHR5KFsyLCAzLCA0LCA1LCA2XSk7XG4gKiAgICAgLy8gUmV0dXJucyA2ID0gMiozXG4gKiAgICAgdmFyIG91dGVyU3RyaWRlID0gY29tcHV0ZU91dGVyU3RyaWRlKG5kYXJyYXksIDIpO1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kXG4gKi9cbmV4cG9ydHMuY29tcHV0ZU91dGVyU3RyaWRlID0gZnVuY3Rpb24oc2hhcGUsIGF4aXMpIHtcblx0dmFyIG91dGVyU3RyaWRlID0gMTtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBheGlzOyArK2kpIHtcblx0XHRvdXRlclN0cmlkZSAqPSBzaGFwZVtpXTtcblx0fVxuXHRyZXR1cm4gb3V0ZXJTdHJpZGU7XG59O1xuXG4vKipcbiAqIENvbXB1dGVzIHRoZSBwcm9kdWN0IG9mIGFycmF5IGRpbWVuc2lvbnMgYWZ0ZXIgdGhlIGF4aXMuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJbXX0gc2hhcGUgLSB0aGUgc2hhcGUgb2YgdGhlIGFycmF5LlxuICogQHBhcmFtIHtOdW1iZXJ9IGF4aXMgLSB0aGUgYXhpcyB1c2VkIGluIGFuIG9wZXJhdGlvbi4gTXVzdCBiZSB2YWxpZCB3LnIudC4gc2hhcGUuXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IC0gdGhlIHByb2R1Y3Qgb2YgYXJyYXkgZGltZW5zaW9ucyBhZnRlciBheGlzLlxuICpcbiAqIEBleGFtcGxlXG4gKiAgICAgLy8gNS1kaW1lbnNpb25hbCBhcnJheVxuICogICAgIHZhciBuZGFycmF5ID0gY29udGV4dC5lbXB0eShbMiwgMywgNCwgNSwgNl0pO1xuICogICAgIC8vIFJldHVybnMgNiA9IDIqM1xuICogICAgIHZhciBpbm5lclN0cmlkZSA9IGNvbXB1dGVJbm5lclN0cmlkZShuZGFycmF5LCAyKTtcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZFxuICovXG5leHBvcnRzLmNvbXB1dGVJbm5lclN0cmlkZSA9IGZ1bmN0aW9uKHNoYXBlLCBheGlzKSB7XG5cdHZhciBpbm5lclN0cmlkZSA9IDE7XG5cdGZvciAodmFyIGkgPSBheGlzICsgMTsgaSA8IHNoYXBlLmxlbmd0aDsgKytpKSB7XG5cdFx0aW5uZXJTdHJpZGUgKj0gc2hhcGVbaV07XG5cdH1cblx0cmV0dXJuIGlubmVyU3RyaWRlO1xufTtcblxudmFyIGRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZSA9IGZ1bmN0aW9uKGRhdGEsIHNoYXBlLCBsZXZlbCkge1xuXHRpZiAoaXNBcnJheShkYXRhKSkge1xuXHRcdGlmIChzaGFwZS5sZW5ndGggPD0gbGV2ZWwpIHtcblx0XHRcdC8qIERpc2NvdmVyZWQgYSBuZXcgbGV2ZWwgb2Ygc3ViLWFycmF5cy4gUmVjb3JkIGl0cyBkaW1lbnNpb24uICovXG5cdFx0XHRzaGFwZS5wdXNoKGRhdGEubGVuZ3RoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0LyogT25seSBjaGVjayBkaW1lbnNpb24gKi9cblx0XHRcdGlmIChzaGFwZVtsZXZlbF0gIT0gZGF0YS5sZW5ndGgpIHtcblx0XHRcdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJTdWItYXJyYXkgXCIgKyBkYXRhICsgXCIgZG9lcyBub3QgbWF0Y2ggdGhlIGV4cGVjdGVkIGRpbWVuc2lvbiBvZiBcIiArIHNoYXBlW2xldmVsXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuXHRcdFx0ZGlzY292ZXJBcnJheVNoYXBlUmVjdXJzaXZlKGRhdGFbaV0sIHNoYXBlLCBsZXZlbCArIDEpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRpZiAobGV2ZWwgIT0gc2hhcGUubGVuZ3RoKSB7XG5cdFx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlN1Yi1hcnJheSBbXCIgKyBkYXRhICsgXCJdIGRvZXMgbm90IG1hdGNoIHRoZSBleHBlY3RlZCBkaW1lbnNpb24gb2YgXCIgKyBzaGFwZVtsZXZlbF0pO1xuXHRcdH1cblx0XHRpZiAoIWlzTnVtYmVyKGRhdGEpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiTm9uLW51bWVyaWMgZWxlbWVudDogXCIgKyBkYXRhKTtcblx0XHR9XG5cdH1cbn07XG5leHBvcnRzLmRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZSA9IGRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZTtcblxudmFyIGNvcHlBcnJheURhdGFSZWN1cnNpdmUgPSBmdW5jdGlvbihkYXRhQnVmZmVyLCBkYXRhQXJyYXksIHNoYXBlLCBsZXZlbCwgb2Zmc2V0KSB7XG5cdHZhciBuID0gc2hhcGVbbGV2ZWxdO1xuXHRpZiAobGV2ZWwgPT09IHNoYXBlLmxlbmd0aCAtIDEpIHtcblx0XHRkYXRhQnVmZmVyLnNldChkYXRhQXJyYXksIG9mZnNldCAqIG4pO1xuXHR9IGVsc2Uge1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSB7XG5cdFx0XHRjb3B5QXJyYXlEYXRhUmVjdXJzaXZlKGRhdGFCdWZmZXIsIGRhdGFBcnJheVtpXSwgc2hhcGUsIGxldmVsICsgMSwgb2Zmc2V0ICogbiAgKyBpKTtcblx0XHR9XG5cdH1cbn07XG5leHBvcnRzLmNvcHlBcnJheURhdGFSZWN1cnNpdmUgPSBjb3B5QXJyYXlEYXRhUmVjdXJzaXZlO1xuXG52YXIgY3JlYXRlQXJyYXlSZWN1cnNpdmUgPSBmdW5jdGlvbihkYXRhQnVmZmVyLCBkYXRhQXJyYXksIHNoYXBlLCBsZXZlbCwgb2Zmc2V0KSB7XG5cdHZhciBuID0gc2hhcGVbbGV2ZWxdO1xuXHRpZiAobGV2ZWwgPT09IHNoYXBlLmxlbmd0aCAtIDEpIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykge1xuXHRcdFx0ZGF0YUFycmF5W2ldID0gZGF0YUJ1ZmZlcltvZmZzZXQgKiBuICsgaV07XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSB7XG5cdFx0XHRkYXRhQXJyYXlbaV0gPSBuZXcgQXJyYXkoc2hhcGVbbGV2ZWwgKyAxXSk7XG5cdFx0XHRjcmVhdGVBcnJheVJlY3Vyc2l2ZShkYXRhQnVmZmVyLCBkYXRhQXJyYXlbaV0sIHNoYXBlLCBsZXZlbCArIDEsIG9mZnNldCAqIG4gICsgaSk7XG5cdFx0fVxuXHR9XG59O1xuZXhwb3J0cy5jcmVhdGVBcnJheVJlY3Vyc2l2ZSA9IGNyZWF0ZUFycmF5UmVjdXJzaXZlO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBOREFycmF5ID0gcmVxdWlyZShcIi4uL05EQXJyYXlcIik7XG52YXIgRGF0YVR5cGUgPSByZXF1aXJlKFwiLi4vRGF0YVR5cGVcIik7XG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuLi91dGlsXCIpO1xuXG5cbi8qIEJ1Z2d5IGluIENocm9taXVtLVdlYkNMICovXG52YXIgdXNlQnVmZmVyQ3JlYXRpb25XaXRoSW5pdCA9IGZhbHNlO1xuXG52YXIgaXNOb2RlV2ViQ0wgPSBmYWxzZTtcbnZhciBjbCA9IHZvaWQgMDtcbnZhciBhdmFpbGFibGVEZXZpY2VzID0gbnVsbDtcbnZhciBhdmFpbGFibGVEZXZpY2VzRGVzY3JpcHRpb25zID0gbnVsbDtcbnZhciBkZWZhdWx0RGV2aWNlSW5kZXggPSAtMTtcblxuLyoqXG4gKiBJZiB0aGUgZ2xvYmFsIGNsIHZhcmlhYmxlIGlzIHVuZGVmaW5lZCwgdGhpcyBtZXRob2Qgd291bGQgaW5pdGlhbGl6ZSBpdCB3aXRoIGEgV2ViQ0wgaW5zdGFuY2UuXG4gKiBXb3JrcyBmb3IgYm90aCBicm93c2VyIGFuZCBOb2RlLmpzXG4gKlxuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgaW5pdFdlYkNMXG4gKiBAcmV0dXJuIHtXZWJDTH0gLSBhbiBpbnN0YW5jZSBvZiBXZWJDTCBvYmplY3QgZnJvbSBXZWJDTCBzcGVjaWZpY2F0aW9uLiBJZiBXZWJDTCBpcyBub3Qgc3VwcG9ydGVkLCByZXR1cm4gbnVsbC5cbiAqL1xudmFyIGluaXRXZWJDTCA9IGZ1bmN0aW9uKCkge1xuXHRpZiAodHlwZW9mIGNsID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0aWYgKHR5cGVvZiB3aW5kb3cgPT09IFwib2JqZWN0XCIpIHtcblx0XHRcdGNsID0gKHR5cGVvZiB3aW5kb3cud2ViY2wgIT09IFwidW5kZWZpbmVkXCIpID8gd2luZG93LndlYmNsIDogbnVsbDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y2wgPSByZXF1aXJlKFwibm9kZS13ZWJjbFwiKTtcblx0XHRcdFx0aXNOb2RlV2ViQ0wgPSB0cnVlO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRjbCA9IG51bGw7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBjbDtcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBlbXB0eSBXZWJDTEV2ZW50LlxuICogV29ya3MgZm9yIGJvdGggYnJvd3NlciBhbmQgTm9kZS5qc1xuICpcbiAqIEBwcml2YXRlXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGNyZWF0ZUV2ZW50XG4gKiBAcmV0dXJuIHtXZWJDTEV2ZW50fSAtIGFuIGVtcHR5IGluc3RhbmNlIG9mIFdlYkNMRXZlbnQuXG4gKi9cbnZhciBjcmVhdGVFdmVudCA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoaXNOb2RlV2ViQ0wpIHtcblx0XHRyZXR1cm4gbmV3IGNsLldlYkNMRXZlbnQoKTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gbmV3IFdlYkNMRXZlbnQoKTtcblx0fVxufTtcblxuLyoqXG4gKiBUcmllcyB0byByZWxlYXNlIGEgV2ViQ0wgcmVzb3VyY2UgYW5kIGlnbm9yZXMgYW55IGVycm9ycyBpbiB0aGUgcHJvY2Vzcy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCB0cnlSbGVhc2VcbiAqIEBwYXJhbSB7T2JqZWN0fSB3ZWJjbE9iamVjdCAtIGEgV2ViQ0wgb2JqZWN0LlxuICogQHJldHVybiB7Qm9vbGVhbn0gLSB0cnVlIGlmIHRoZSBvYmplY3Qgd2FzIHN1Y2Nlc3NmdWxseSByZWxlYXNlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICovXG52YXIgdHJ5UmVsZWFzZSA9IGZ1bmN0aW9uKHdlYmNsUmVzb3VyY2UpIHtcblx0aWYgKHdlYmNsUmVzb3VyY2UgIT09IG51bGwpIHtcblx0XHR0cnkge1xuXHRcdFx0d2ViY2xSZXNvdXJjZS5yZWxlYXNlKCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHQvKiBTaWxlbnRseSBpZ25vcmUgKi9cblx0XHR9XG5cdH1cblx0cmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYSBXZWJDTCBkZXZpY2Ugc3VwcG9ydHMgS0hSX2ZwNjQgZXh0ZW5zaW9uLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAbWV0aG9kIGlzRlA2NENhcGFibGVcbiAqIEBwYXJhbSB7V2ViQ0xEZXZpY2V9IGRldmljZSAtIHRoZSBkZXZpY2UgdG8gY2hlY2sgZm9yIEtIUl9mcDY0IHN1cHBvcnQuXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaWYgdGhlIGRldmljZSBzdXBwb3J0cyBLSFJfZnA2NCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICovXG52YXIgaXNGUDY0Q2FwYWJsZSA9IGZ1bmN0aW9uKGRldmljZSkge1xuXHR2YXIgZXh0ZW5zaW9ucyA9IGRldmljZS5nZXRTdXBwb3J0ZWRFeHRlbnNpb25zKCk7XG5cdGlmIChleHRlbnNpb25zLmluZGV4T2YoXCJLSFJfZnA2NFwiKSA9PT0gLTEpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0Lypcblx0ICogRHVlIHRvIGEgYnVnIFdlYktpdC1XZWJDTCBtYXkgcmVwb3J0IEtIUl9mcDY0IGV2ZW4gaWYgaXQgaXMgbm90IHN1cHBvcnRlZCBieSB0aGUgdW5kZXJseWluZyBPcGVuQ0wgZGV2aWNlLlxuXHQgKiBTZWUgYnVnIGh0dHBzOi8vZ2l0aHViLmNvbS9TUkEtU2lsaWNvblZhbGxleS93ZWJraXQtd2ViY2wvaXNzdWVzLzUzNlxuXHQgKi9cblx0dmFyIHRlc3RTb3VyY2UgPSBcImtlcm5lbCB2b2lkIGZvbyhnbG9iYWwgZG91YmxlKiBiYXIpIHsgfVwiO1xuXHR2YXIgY29udGV4dCA9IG51bGwsIHByb2dyYW0gPSBudWxsO1xuXHR0cnkge1xuXHRcdGNvbnRleHQgPSBjbC5jcmVhdGVDb250ZXh0KGRldmljZSk7XG5cdFx0cHJvZ3JhbSA9IGNvbnRleHQuY3JlYXRlUHJvZ3JhbSh0ZXN0U291cmNlKTtcblx0XHRwcm9ncmFtLmJ1aWxkKCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH0gZmluYWxseSB7XG5cdFx0dHJ5UmVsZWFzZShwcm9ncmFtKTtcblx0XHR0cnlSZWxlYXNlKGNvbnRleHQpO1xuXHR9XG59O1xuXG4vKipcbiAqIEluaXRpYWxpc2VzIGFuZCByZXR1cm5zIGEgbGlzdCBvZiBXZWJDTCBkZXZpY2VzIHN1aXRhYmxlIGZvciBjb21wdXRhdGlvbi5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHN0YXRpY1xuICogQG1ldGhvZCBnZXRBdmFpbGFibGVEZXZpY2VzXG4gKiBAcmV0dXJuIHtXZWJDTERldmljZVtdfSAtIGEgbGlzdCBvZiBHUFUgYW5kIENQVSBXZWJDTCBkZXZpY2VzIHRoYXQgc3VwcG9ydCBLSFJfRlA2NCAobWF5IGJlIGVtcHR5KS5cbiAqL1xudmFyIGdldEF2YWlsYWJsZURldmljZXMgPSBmdW5jdGlvbigpIHtcblx0aWYgKGF2YWlsYWJsZURldmljZXMgPT09IG51bGwpIHtcblx0XHRhdmFpbGFibGVEZXZpY2VzID0gW107XG5cdFx0dmFyIHdlYmNsID0gaW5pdFdlYkNMKCk7XG5cdFx0aWYgKHdlYmNsICE9PSBudWxsKSB7XG5cdFx0XHR2YXIgcGxhdGZvcm1zID0gY2wuZ2V0UGxhdGZvcm1zKCk7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHBsYXRmb3Jtcy5sZW5ndGg7ICsraSkge1xuXHRcdFx0XHR2YXIgcGxhdGZvcm0gPSBwbGF0Zm9ybXNbaV07XG5cdFx0XHRcdHZhciBkZXZpY2VzID0gcGxhdGZvcm0uZ2V0RGV2aWNlcyhjbC5ERVZJQ0VfVFlQRV9BTEwpO1xuXHRcdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IGRldmljZXMubGVuZ3RoOyArK2opIHtcblx0XHRcdFx0XHR2YXIgZGV2aWNlID0gZGV2aWNlc1tqXTtcblx0XHRcdFx0XHRpZiAoaXNGUDY0Q2FwYWJsZShkZXZpY2UpKSB7XG5cdFx0XHRcdFx0XHRhdmFpbGFibGVEZXZpY2VzLnB1c2goZGV2aWNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Z2VuZXJhdGVBdmFpbGFibGVEZXZpY2VzRGVzY3JpcHRpb25zKCk7XG5cdH1cblx0cmV0dXJuIGF2YWlsYWJsZURldmljZXM7XG59O1xuXG52YXIgZ2VuZXJhdGVBdmFpbGFibGVEZXZpY2VzRGVzY3JpcHRpb25zID0gZnVuY3Rpb24oKSB7XG5cdGF2YWlsYWJsZURldmljZXNEZXNjcmlwdGlvbnMgPSBbXTtcblx0LyogSWYgZGV2aWNlcyBuYW1lcyBhcmUgYXZhaWxhYmxlLCB1c2UgdGhlbSAqL1xuXHR2YXIgaGF2ZU5hbWVzID0gdHJ1ZTtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhdmFpbGFibGVEZXZpY2VzLmxlbmd0aDsgKytpKSB7XG5cdFx0dmFyIGRldmljZSA9IGF2YWlsYWJsZURldmljZXNbaV07XG5cdFx0dmFyIG5hbWUgPSBkZXZpY2UuZ2V0SW5mbyhjbC5ERVZJQ0VfTkFNRSk7XG5cdFx0aWYgKChuYW1lID09PSBudWxsKSB8fCAobmFtZSA9PT0gXCJcIikpIHtcblx0XHRcdGhhdmVOYW1lcyA9IGZhbHNlO1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdGF2YWlsYWJsZURldmljZXNEZXNjcmlwdGlvbnNbaV0gPSBuYW1lO1xuXHR9XG5cdGlmICghaGF2ZU5hbWVzKSB7XG5cdFx0LyogQXQgbGVhc3Qgc29tZSBuYW1lcyBhcmUgbm90IGF2YWlsYWJsZTogdHJ5IHRvIGFzc2lnbiBuYW1lcyBiYXNlZCBvbiBjbGFzc2lmaWNhdGlvbiAoZS5nLiBcIkNQVVwiLCBcImRHUFVcIiwgXCJpR1BVXCIpICovXG5cdFx0dmFyIGNwdUNvdW50ID0gMCwgaWdwdUNvdW50ID0gMCwgZGdwdUNvdW50ID0gMDtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGF2YWlsYWJsZURldmljZXMubGVuZ3RoOyArK2kpIHtcblx0XHRcdHZhciBkZXZpY2UgPSBhdmFpbGFibGVEZXZpY2VzW2ldO1xuXHRcdFx0dmFyIGNsYXNzaWZpY2F0aW9uID0gY2xhc3NpZnlEZXZpY2UoZGV2aWNlKTtcblx0XHRcdGlmIChjbGFzc2lmaWNhdGlvbiA9PT0gXCJjcHVcIikge1xuXHRcdFx0XHQrK2NwdUNvdW50O1xuXHRcdFx0XHRhdmFpbGFibGVEZXZpY2VzRGVzY3JpcHRpb25zW2ldID0gXCJDUFVcIjtcblx0XHRcdH0gZWxzZSBpZiAoY2xhc3NpZmljYXRpb24gPT09IFwiaWdwdVwiKSB7XG5cdFx0XHRcdCsraWdwdUNvdW50O1xuXHRcdFx0XHRhdmFpbGFibGVEZXZpY2VzRGVzY3JpcHRpb25zW2ldID0gXCJpR1BVXCI7XG5cdFx0XHR9IGVsc2UgaWYgKGNsYXNzaWZpY2F0aW9uID09PSBcImRncHVcIikge1xuXHRcdFx0XHQrK2RncHVDb3VudDtcblx0XHRcdFx0YXZhaWxhYmxlRGV2aWNlc0Rlc2NyaXB0aW9uc1tpXSA9IFwiZEdQVVwiO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiSW1wb3NzaWJsZSBkZXZpY2UgY2xhc3NpZmljYXRpb246IFwiICsgY2xhc3NpZmljYXRpb24pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoKGNwdUNvdW50ID4gMSkgfHwgKGlncHVDb3VudCA+IDEpIHx8IChkZ3B1Q291bnQgPiAxKSkge1xuXHRcdFx0LyogV2UgaGF2ZSBtdWx0aXBsZSBkZXZpY2VzIG9mIHRoZSBzYW1lIHR5cGUuIE5lZWQgdG8gdXNlIG1vcmUgY29tcGxpY2F0ZWQgbmFtaW5nIHNjaGVtZSAqL1xuXHRcdFx0dmFyIGNwdUluZGV4ID0gMCwgaWdwdUluZGV4ID0gMCwgZGdwdUluZGV4ID0gMDtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXZhaWxhYmxlRGV2aWNlcy5sZW5ndGg7ICsraSkge1xuXHRcdFx0XHR2YXIgZGV2aWNlID0gYXZhaWxhYmxlRGV2aWNlc1tpXTtcblx0XHRcdFx0dmFyIGNsYXNzaWZpY2F0aW9uID0gY2xhc3NpZnlEZXZpY2UoZGV2aWNlKTtcblx0XHRcdFx0aWYgKGNsYXNzaWZpY2F0aW9uID09PSBcImNwdVwiKSB7XG5cdFx0XHRcdFx0aWYgKGNwdUNvdW50ID4gMSkge1xuXHRcdFx0XHRcdFx0KytjcHVJbmRleDtcblx0XHRcdFx0XHRcdGF2YWlsYWJsZURldmljZXNEZXNjcmlwdGlvbnNbaV0gPSBcIkNQVSAjXCIgKyBjcHVJbmRleDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoY2xhc3NpZmljYXRpb24gPT09IFwiaWdwdVwiKSB7XG5cdFx0XHRcdFx0aWYgKGlncHVDb3VudCA+IDEpIHtcblx0XHRcdFx0XHRcdCsraWdwdUluZGV4O1xuXHRcdFx0XHRcdFx0YXZhaWxhYmxlRGV2aWNlc0Rlc2NyaXB0aW9uc1tpXSA9IFwiaUdQVSAjXCIgKyBpZ3B1SW5kZXg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKGNsYXNzaWZpY2F0aW9uID09PSBcImRncHVcIikge1xuXHRcdFx0XHRcdGlmIChkZ3B1Q291bnQgPiAxKSB7XG5cdFx0XHRcdFx0XHQrK2RncHVDb3VudDtcblx0XHRcdFx0XHRcdGF2YWlsYWJsZURldmljZXNEZXNjcmlwdGlvbnNbaV0gPSBcImRHUFUgI1wiICsgZGdwdUluZGV4O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJJbXBvc3NpYmxlIGRldmljZSBjbGFzc2lmaWNhdGlvbjogXCIgKyBjbGFzc2lmaWNhdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn07XG5cbi8qKlxuICogQ2xhc3NpZmllcyBXZWJDTCBkZXZpY2UgdG8gb25lIG9mIGZvdXIgY2F0ZWdvcmllczpcbiAqIC0gXCJjcHVcIiBmb3IgQ1BVIGRldmljZXMuXG4gKiAtIFwiaWdwdVwiIGZvciBHUFVzIGludGVncmF0ZWQgd2l0aCBDUFUgcGFja2FnZSBvciBjaGlwc2V0LlxuICogLSBcImRncHVcIiBmb3IgZGlzY3JldGUgR1BVcy5cbiAqIC0gXCJ1bmtub3duXCIgZm9yIG90aGVyIHR5cGVzIG9mIGRldmljZXMgKGUuZy4gRlBHQXMpXG4gKlxuICogQHByaXZhdGVcbiAqIEBtZXRob2QgY2xhc3NpZnlEZXZpY2VcbiAqIEBwYXJhbSB7V2ViQ0xEZXZpY2V9IGRldmljZSAtIHRoZSBXZWJDTCBkZXZpY2UgdG8gY2xhc3NpZnkuXG4gKiBAcmV0dXJuIHtTdHJpbmd9IC0gb25lIG9mIHRoZSBzdHJpbmdzIGRlc2NyaWJlZCBhYm92ZS5cbiAqL1xudmFyIGNsYXNzaWZ5RGV2aWNlID0gZnVuY3Rpb24oZGV2aWNlKSB7XG5cdHRyeSB7XG5cdFx0dmFyIGRldmljZVR5cGUgPSBkZXZpY2UuZ2V0SW5mbyhjbC5ERVZJQ0VfVFlQRSk7XG5cdFx0aWYgKGRldmljZVR5cGUgPT09IGNsLkRFVklDRV9UWVBFX0NQVSkge1xuXHRcdFx0cmV0dXJuIFwiY3B1XCI7XG5cdFx0fSBlbHNlIGlmIChkZXZpY2VUeXBlID09PSBjbC5ERVZJQ0VfVFlQRV9HUFUpIHtcblx0XHRcdHZhciBpc0hvc3RVbmlmaWVkTWVtb3J5ID0gZGV2aWNlLmdldEluZm8oY2wuREVWSUNFX0hPU1RfVU5JRklFRF9NRU1PUlkpO1xuXHRcdFx0cmV0dXJuIChpc0hvc3RVbmlmaWVkTWVtb3J5ID8gXCJpZ3B1XCIgOiBcImRncHVcIik7XG5cdFx0fVxuXHR9IGNhdGNoIChlKSB7XG5cdH1cblx0cmV0dXJuIFwidW5rbm93blwiO1xufTtcblxuLyoqXG4gKiBTZWxlY3RzIHRoZSBvcHRpbWFsIFdlYkNMIGRldmljZSBhbW9uZyB0aGUgYXZhaWxhYmxlIGRldmljZXMuXG4gKiBUaGUgcHJpb3JpdHkgb2YgZGV2aWNlczogXCJkZ3B1XCIgPiBcImlncHVcIiA+IFwiY3B1XCJcbiAqXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBnZXREZWZhdWx0RGV2aWNlSW5kZXhcbiAqIEByZXR1cm4ge1dlYkNMRGV2aWNlfSAtIHRoZSBzZWxlY3RlZCBkZXZpY2UgZnJvbSB0aGUgbGlzdC5cbiAqL1xudmFyIGdldERlZmF1bHREZXZpY2VJbmRleCA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoZGVmYXVsdERldmljZUluZGV4ID09PSAtMSkge1xuXHRcdHZhciBhdmFpbGFibGVEZXZpY2VzID0gZ2V0QXZhaWxhYmxlRGV2aWNlcygpO1xuXHRcdGlmIChhdmFpbGFibGVEZXZpY2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0ZGVmYXVsdERldmljZUluZGV4ID0gLTI7XG5cdFx0XHRyZXR1cm4gZGVmYXVsdERldmljZUluZGV4O1xuXHRcdH1cblx0XHR2YXIgZGV2aWNlQ2xhc3NpZmljYXRpb25zID0gW107XG5cdFx0LyogU2VhcmNoIGZvciBcImRncHVcIiAqL1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXZhaWxhYmxlRGV2aWNlcy5sZW5ndGg7ICsraSkge1xuXHRcdFx0dmFyIGRldmljZSA9IGF2YWlsYWJsZURldmljZXNbaV07XG5cdFx0XHR2YXIgZGV2aWNlQ2xhc3MgPSBjbGFzc2lmeURldmljZShkZXZpY2UpO1xuXHRcdFx0aWYgKGRldmljZUNsYXNzID09PSBcImRncHVcIikge1xuXHRcdFx0XHRkZWZhdWx0RGV2aWNlSW5kZXggPSBpO1xuXHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdH1cblx0XHRcdGRldmljZUNsYXNzaWZpY2F0aW9ucy5wdXNoKGRldmljZUNsYXNzKTtcblx0XHR9XG5cdFx0LyogU2VhcmNoIGZvciBcImlncHVcIiAqL1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXZhaWxhYmxlRGV2aWNlcy5sZW5ndGg7ICsraSkge1xuXHRcdFx0aWYgKGRldmljZUNsYXNzaWZpY2F0aW9uc1tpXSA9PT0gXCJpZ3B1XCIpIHtcblx0XHRcdFx0ZGVmYXVsdERldmljZUluZGV4ID0gaTtcblx0XHRcdFx0cmV0dXJuIGk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8qIFNlYXJjaCBmb3IgXCJjcHVcIiAqL1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXZhaWxhYmxlRGV2aWNlcy5sZW5ndGg7ICsraSkge1xuXHRcdFx0aWYgKGRldmljZUNsYXNzaWZpY2F0aW9uc1tpXSA9PT0gXCJjcHVcIikge1xuXHRcdFx0XHRkZWZhdWx0RGV2aWNlSW5kZXggPSBpO1xuXHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIGRlZmF1bHREZXZpY2VJbmRleDtcbn07XG5cbnZhciBjcmVhdGVLZXJuZWxzID0gZnVuY3Rpb24ocHJvZ3JhbSkge1xuXHR2YXIga2VybmVscyA9IHtcblx0XHRzZXQ6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJzZXRfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInNldF9mNjRcIilcblx0XHR9LFxuXHRcdGxpbnNwYWNlOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibGluc3BhY2VfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImxpbnNwYWNlX2Y2NFwiKVxuXHRcdH0sXG5cdFx0cmVwZWF0OiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwicmVwZWF0X2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJyZXBlYXRfZjY0XCIpXG5cdFx0fSxcblx0XHRhZGQ6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhZGRfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFkZF9mNjRcIilcblx0XHR9LFxuXHRcdHN1Yjoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInN1Yl9mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3ViX2Y2NFwiKVxuXHRcdH0sXG5cdFx0bXVsOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibXVsX2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJtdWxfZjY0XCIpXG5cdFx0fSxcblx0XHRkaXY6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJkaXZfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImRpdl9mNjRcIilcblx0XHR9LFxuXHRcdGFkZGM6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhZGRjX2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhZGRjX2Y2NFwiKVxuXHRcdH0sXG5cdFx0c3ViYzoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInN1YmNfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInN1YmNfZjY0XCIpXG5cdFx0fSxcblx0XHRzdWJyYzoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInN1YnJjX2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJzdWJyY19mNjRcIilcblx0XHR9LFxuXHRcdG11bGM6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJtdWxjX2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJtdWxjX2Y2NFwiKVxuXHRcdH0sXG5cdFx0ZGl2Yzoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImRpdmNfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImRpdmNfZjY0XCIpXG5cdFx0fSxcblx0XHRkaXZyYzoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImRpdnJjX2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJkaXZyY19mNjRcIilcblx0XHR9LFxuXHRcdG5lZzoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcIm5lZ19mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibmVnX2Y2NFwiKVxuXHRcdH0sXG5cdFx0YWJzOiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiYWJzX2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhYnNfZjY0XCIpXG5cdFx0fSxcblx0XHRleHA6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJleHBfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImV4cF9mNjRcIilcblx0XHR9LFxuXHRcdGxvZzoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImxvZ19mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibG9nX2Y2NFwiKVxuXHRcdH0sXG5cdFx0c3FydDoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInNxcnRfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInNxcnRfZjY0XCIpXG5cdFx0fSxcblx0XHRzcXVhcmU6IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJzcXVhcmVfZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInNxdWFyZV9mNjRcIilcblx0XHR9LFxuXHRcdHN1bToge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInN1bV9mMzJfZ3B1XCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInN1bV9mNjRfZ3B1XCIpXG5cdFx0fSxcblx0XHRtaW46IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJtaW5fZjMyX2dwdVwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJtaW5fZjY0X2dwdVwiKVxuXHRcdH0sXG5cdFx0bWF4OiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibWF4X2YzMl9ncHVcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibWF4X2Y2NF9ncHVcIilcblx0XHR9LFxuXHRcdGFzdW06IHtcblx0XHRcdGYzMjogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhc3VtX2YzMlwiKSxcblx0XHRcdGY2NDogcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhc3VtX2Y2NFwiKVxuXHRcdH0sXG5cdFx0YW1pbjoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFtaW5fZjMyXCIpLFxuXHRcdFx0ZjY0OiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFtaW5fZjY0XCIpXG5cdFx0fSxcblx0XHRhbWF4OiB7XG5cdFx0XHRmMzI6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiYW1heF9mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiYW1heF9mNjRcIilcblx0XHR9LFxuXHRcdGRvdDoge1xuXHRcdFx0ZjMyOiBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImRvdF9mMzJcIiksXG5cdFx0XHRmNjQ6IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiZG90X2Y2NFwiKVxuXHRcdH1cblx0fTtcblx0cmV0dXJuIGtlcm5lbHM7XG59O1xuXG5mdW5jdGlvbiBXZWJDTENvbnRleHQob3B0aW9ucywgY2FsbGJhY2spIHtcblx0aW5pdFdlYkNMKCk7XG5cdHZhciBiaW5hcnlLZXJuZWxzU291cmNlID0gXCJrZXJuZWwgdm9pZCBhZGRfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRnbG9iYWwgZmxvYXQqIGIsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSArIGJbaWRdO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgYWRkX2Y2NChcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGdsb2JhbCBkb3VibGUqIGIsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gKyBiW2lkXTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIHN1Yl9mMzIoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGdsb2JhbCBmbG9hdCogYixcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdIC0gYltpZF07XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBzdWJfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYixcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSAtIGJbaWRdO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgbXVsX2YzMihcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0Z2xvYmFsIGZsb2F0KiBiLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gKiBiW2lkXTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIG11bF9mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRnbG9iYWwgZG91YmxlKiBiLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdICogYltpZF07XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBkaXZfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRnbG9iYWwgZmxvYXQqIGIsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSAvIGJbaWRdO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgZGl2X2Y2NChcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGdsb2JhbCBkb3VibGUqIGIsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gLyBiW2lkXTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIGFkZGNfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRmbG9hdCBiLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gKyBiO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgYWRkY19mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRkb3VibGUgYixcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSArIGI7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBzdWJjX2YzMihcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0ZmxvYXQgYixcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdIC0gYjtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIHN1YmNfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0ZG91YmxlIGIsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gLSBiO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgc3VicmNfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRmbG9hdCBiLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYiAvIGFbaWRdO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgc3VicmNfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0ZG91YmxlIGIsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYiAvIGFbaWRdO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgbXVsY19mMzIoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGZsb2F0IGIsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSAqIGI7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBtdWxjX2Y2NChcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGRvdWJsZSBiLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGFbaWRdICogYjtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIGRpdmNfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRmbG9hdCBiLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gYVtpZF0gLyBiO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgZGl2Y19mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRkb3VibGUgYixcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBhW2lkXSAvIGI7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBkaXZyY19mMzIoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGZsb2F0IGIsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBiIC8gYVtpZF07XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBkaXZyY19mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRkb3VibGUgYixcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBiIC8gYVtpZF07XFxuXFx0fVxcbn1cXG5cIjtcblx0dmFyIHVuYXJ5S2VybmVsc1NvdXJjZSA9IFwia2VybmVsIHZvaWQgbmVnX2YzMihcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSAtYVtpZF07XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBuZWdfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gLWFbaWRdO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgYWJzX2YzMihcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBmYWJzKGFbaWRdKTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIGFic19mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBmYWJzKGFbaWRdKTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIGV4cF9mMzIoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gZXhwKGFbaWRdKTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIGV4cF9mNjQoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBleHAoYVtpZF0pO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgbG9nX2YzMihcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBsb2coYVtpZF0pO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgbG9nX2Y2NChcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0b3V0W2lkXSA9IGxvZyhhW2lkXSk7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBzcXJ0X2YzMihcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBzcXJ0KGFbaWRdKTtcXG5cXHR9XFxufVxcbmtlcm5lbCB2b2lkIHNxcnRfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gc3FydChhW2lkXSk7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBzcXVhcmVfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0aWYgKGlkIDwgbGVuZ3RoKSB7XFxuXFx0XFx0Y29uc3QgZmxvYXQgYVZhbCA9IGFbaWRdOyBcXG5cXHRcXHRvdXRbaWRdID0gYVZhbCAqIGFWYWw7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBzcXVhcmVfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRjb25zdCBkb3VibGUgYVZhbCA9IGFbaWRdO1xcblxcdFxcdG91dFtpZF0gPSBhVmFsICogYVZhbDtcXG5cXHR9XFxufVxcblwiO1xuXHR2YXIgcmVkdWN0aW9uS2VybmVsc1NvdXJjZSA9IFwia2VybmVsIHZvaWQgc3VtX2YzMl9ncHUoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGxvY2FsIGZsb2F0KiBzY3JhdGNoLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGdsb2JhbFNpemUgPSBnZXRfZ2xvYmFsX3NpemUoMCk7XFxuXFx0dWludCBnbG9iYWxJbmRleCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0ZmxvYXQgYWNjdW11bGF0b3IgPSAwLjBmO1xcblxcdHdoaWxlIChnbG9iYWxJbmRleCA8IGxlbmd0aCkge1xcblxcdFxcdGFjY3VtdWxhdG9yICs9IGFbZ2xvYmFsSW5kZXhdO1xcblxcdFxcdGdsb2JhbEluZGV4ICs9IGdsb2JhbFNpemU7XFxuXFx0fVxcblxcblxcdHVpbnQgbG9jYWxJbmRleCA9IGdldF9sb2NhbF9pZCgwKTtcXG5cXHRzY3JhdGNoW2xvY2FsSW5kZXhdID0gYWNjdW11bGF0b3I7XFxuXFx0YmFycmllcihDTEtfTE9DQUxfTUVNX0ZFTkNFKTtcXG5cXHRmb3IgKHVpbnQgb2Zmc2V0ID0gZ2V0X2xvY2FsX3NpemUoMCkgLyAyOyBvZmZzZXQgIT0gMDsgb2Zmc2V0ID4+PSAxKSB7XFxuXFx0XFx0aWYgKGxvY2FsSW5kZXggPCBvZmZzZXQpIHtcXG5cXHRcXHRcXHRzY3JhdGNoW2xvY2FsSW5kZXhdICs9IHNjcmF0Y2hbbG9jYWxJbmRleCArIG9mZnNldF07XFxuXFx0XFx0fVxcblxcdFxcdGJhcnJpZXIoQ0xLX0xPQ0FMX01FTV9GRU5DRSk7XFxuXFx0fVxcblxcdGlmIChsb2NhbEluZGV4ID09IDApIHtcXG5cXHRcXHRvdXRbZ2V0X2dyb3VwX2lkKDApXSA9IHNjcmF0Y2hbMF07XFxuXFx0fVxcbn1cXG5cXG5rZXJuZWwgdm9pZCBzdW1fZjY0X2dwdShcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGxvY2FsIGRvdWJsZSogc2NyYXRjaCxcXG5cXHRnbG9iYWwgZG91YmxlKiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgZ2xvYmFsU2l6ZSA9IGdldF9nbG9iYWxfc2l6ZSgwKTtcXG5cXHR1aW50IGdsb2JhbEluZGV4ID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRkb3VibGUgYWNjdW11bGF0b3IgPSAwLjA7XFxuXFx0d2hpbGUgKGdsb2JhbEluZGV4IDwgbGVuZ3RoKSB7XFxuXFx0XFx0YWNjdW11bGF0b3IgKz0gYVtnbG9iYWxJbmRleF07XFxuXFx0XFx0Z2xvYmFsSW5kZXggKz0gZ2xvYmFsU2l6ZTtcXG5cXHR9XFxuXFxuXFx0dWludCBsb2NhbEluZGV4ID0gZ2V0X2xvY2FsX2lkKDApO1xcblxcdHNjcmF0Y2hbbG9jYWxJbmRleF0gPSBhY2N1bXVsYXRvcjtcXG5cXHRiYXJyaWVyKENMS19MT0NBTF9NRU1fRkVOQ0UpO1xcblxcdGZvciAodWludCBvZmZzZXQgPSBnZXRfbG9jYWxfc2l6ZSgwKSAvIDI7IG9mZnNldCAhPSAwOyBvZmZzZXQgPj49IDEpIHtcXG5cXHRcXHRpZiAobG9jYWxJbmRleCA8IG9mZnNldCkge1xcblxcdFxcdFxcdHNjcmF0Y2hbbG9jYWxJbmRleF0gKz0gc2NyYXRjaFtsb2NhbEluZGV4ICsgb2Zmc2V0XTtcXG5cXHRcXHR9XFxuXFx0XFx0YmFycmllcihDTEtfTE9DQUxfTUVNX0ZFTkNFKTtcXG5cXHR9XFxuXFx0aWYgKGxvY2FsSW5kZXggPT0gMCkge1xcblxcdFxcdG91dFtnZXRfZ3JvdXBfaWQoMCldID0gc2NyYXRjaFswXTtcXG5cXHR9XFxufVxcblxcbmtlcm5lbCB2b2lkIG1pbl9mMzJfZ3B1KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogYSxcXG5cXHRsb2NhbCBmbG9hdCogc2NyYXRjaCxcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBnbG9iYWxTaXplID0gZ2V0X2dsb2JhbF9zaXplKDApO1xcblxcdHVpbnQgZ2xvYmFsSW5kZXggPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGZsb2F0IGFjY3VtdWxhdG9yID0gSU5GSU5JVFk7XFxuXFx0d2hpbGUgKGdsb2JhbEluZGV4IDwgbGVuZ3RoKSB7XFxuXFx0XFx0YWNjdW11bGF0b3IgPSBtaW4oYWNjdW11bGF0b3IsIGFbZ2xvYmFsSW5kZXhdKTtcXG5cXHRcXHRnbG9iYWxJbmRleCArPSBnbG9iYWxTaXplO1xcblxcdH1cXG5cXG5cXHR1aW50IGxvY2FsSW5kZXggPSBnZXRfbG9jYWxfaWQoMCk7XFxuXFx0c2NyYXRjaFtsb2NhbEluZGV4XSA9IGFjY3VtdWxhdG9yO1xcblxcdGJhcnJpZXIoQ0xLX0xPQ0FMX01FTV9GRU5DRSk7XFxuXFx0Zm9yICh1aW50IG9mZnNldCA9IGdldF9sb2NhbF9zaXplKDApIC8gMjsgb2Zmc2V0ICE9IDA7IG9mZnNldCA+Pj0gMSkge1xcblxcdFxcdGlmIChsb2NhbEluZGV4IDwgb2Zmc2V0KSB7XFxuXFx0XFx0XFx0c2NyYXRjaFtsb2NhbEluZGV4XSA9IG1pbihzY3JhdGNoW2xvY2FsSW5kZXhdLCBzY3JhdGNoW2xvY2FsSW5kZXggKyBvZmZzZXRdKTtcXG5cXHRcXHR9XFxuXFx0XFx0YmFycmllcihDTEtfTE9DQUxfTUVNX0ZFTkNFKTtcXG5cXHR9XFxuXFx0aWYgKGxvY2FsSW5kZXggPT0gMCkge1xcblxcdFxcdG91dFtnZXRfZ3JvdXBfaWQoMCldID0gc2NyYXRjaFswXTtcXG5cXHR9XFxufVxcblxcbmtlcm5lbCB2b2lkIG1pbl9mNjRfZ3B1KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0bG9jYWwgZG91YmxlKiBzY3JhdGNoLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBnbG9iYWxTaXplID0gZ2V0X2dsb2JhbF9zaXplKDApO1xcblxcdHVpbnQgZ2xvYmFsSW5kZXggPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGRvdWJsZSBhY2N1bXVsYXRvciA9IElORklOSVRZO1xcblxcdHdoaWxlIChnbG9iYWxJbmRleCA8IGxlbmd0aCkge1xcblxcdFxcdGFjY3VtdWxhdG9yID0gbWluKGFjY3VtdWxhdG9yLCBhW2dsb2JhbEluZGV4XSk7XFxuXFx0XFx0Z2xvYmFsSW5kZXggKz0gZ2xvYmFsU2l6ZTtcXG5cXHR9XFxuXFxuXFx0dWludCBsb2NhbEluZGV4ID0gZ2V0X2xvY2FsX2lkKDApO1xcblxcdHNjcmF0Y2hbbG9jYWxJbmRleF0gPSBhY2N1bXVsYXRvcjtcXG5cXHRiYXJyaWVyKENMS19MT0NBTF9NRU1fRkVOQ0UpO1xcblxcdGZvciAodWludCBvZmZzZXQgPSBnZXRfbG9jYWxfc2l6ZSgwKSAvIDI7IG9mZnNldCAhPSAwOyBvZmZzZXQgPj49IDEpIHtcXG5cXHRcXHRpZiAobG9jYWxJbmRleCA8IG9mZnNldCkge1xcblxcdFxcdFxcdHNjcmF0Y2hbbG9jYWxJbmRleF0gPSBtaW4oc2NyYXRjaFtsb2NhbEluZGV4XSwgc2NyYXRjaFtsb2NhbEluZGV4ICsgb2Zmc2V0XSk7XFxuXFx0XFx0fVxcblxcdFxcdGJhcnJpZXIoQ0xLX0xPQ0FMX01FTV9GRU5DRSk7XFxuXFx0fVxcblxcdGlmIChsb2NhbEluZGV4ID09IDApIHtcXG5cXHRcXHRvdXRbZ2V0X2dyb3VwX2lkKDApXSA9IHNjcmF0Y2hbMF07XFxuXFx0fVxcbn1cXG5cXG5rZXJuZWwgdm9pZCBtYXhfZjMyX2dwdShcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0bG9jYWwgZmxvYXQqIHNjcmF0Y2gsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgZ2xvYmFsU2l6ZSA9IGdldF9nbG9iYWxfc2l6ZSgwKTtcXG5cXHR1aW50IGdsb2JhbEluZGV4ID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRmbG9hdCBhY2N1bXVsYXRvciA9IC1JTkZJTklUWTtcXG5cXHR3aGlsZSAoZ2xvYmFsSW5kZXggPCBsZW5ndGgpIHtcXG5cXHRcXHRhY2N1bXVsYXRvciA9IG1heChhY2N1bXVsYXRvciwgYVtnbG9iYWxJbmRleF0pO1xcblxcdFxcdGdsb2JhbEluZGV4ICs9IGdsb2JhbFNpemU7XFxuXFx0fVxcblxcblxcdHVpbnQgbG9jYWxJbmRleCA9IGdldF9sb2NhbF9pZCgwKTtcXG5cXHRzY3JhdGNoW2xvY2FsSW5kZXhdID0gYWNjdW11bGF0b3I7XFxuXFx0YmFycmllcihDTEtfTE9DQUxfTUVNX0ZFTkNFKTtcXG5cXHRmb3IgKHVpbnQgb2Zmc2V0ID0gZ2V0X2xvY2FsX3NpemUoMCkgLyAyOyBvZmZzZXQgIT0gMDsgb2Zmc2V0ID4+PSAxKSB7XFxuXFx0XFx0aWYgKGxvY2FsSW5kZXggPCBvZmZzZXQpIHtcXG5cXHRcXHRcXHRzY3JhdGNoW2xvY2FsSW5kZXhdID0gbWF4KHNjcmF0Y2hbbG9jYWxJbmRleF0sIHNjcmF0Y2hbbG9jYWxJbmRleCArIG9mZnNldF0pO1xcblxcdFxcdH1cXG5cXHRcXHRiYXJyaWVyKENMS19MT0NBTF9NRU1fRkVOQ0UpO1xcblxcdH1cXG5cXHRpZiAobG9jYWxJbmRleCA9PSAwKSB7XFxuXFx0XFx0b3V0W2dldF9ncm91cF9pZCgwKV0gPSBzY3JhdGNoWzBdO1xcblxcdH1cXG59XFxuXFxua2VybmVsIHZvaWQgbWF4X2Y2NF9ncHUoXFxuXFx0dWludCBsZW5ndGgsXFxuXFx0Z2xvYmFsIGRvdWJsZSogYSxcXG5cXHRsb2NhbCBkb3VibGUqIHNjcmF0Y2gsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGdsb2JhbFNpemUgPSBnZXRfZ2xvYmFsX3NpemUoMCk7XFxuXFx0dWludCBnbG9iYWxJbmRleCA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0ZG91YmxlIGFjY3VtdWxhdG9yID0gLUlORklOSVRZO1xcblxcdHdoaWxlIChnbG9iYWxJbmRleCA8IGxlbmd0aCkge1xcblxcdFxcdGFjY3VtdWxhdG9yID0gbWF4KGFjY3VtdWxhdG9yLCBhW2dsb2JhbEluZGV4XSk7XFxuXFx0XFx0Z2xvYmFsSW5kZXggKz0gZ2xvYmFsU2l6ZTtcXG5cXHR9XFxuXFxuXFx0dWludCBsb2NhbEluZGV4ID0gZ2V0X2xvY2FsX2lkKDApO1xcblxcdHNjcmF0Y2hbbG9jYWxJbmRleF0gPSBhY2N1bXVsYXRvcjtcXG5cXHRiYXJyaWVyKENMS19MT0NBTF9NRU1fRkVOQ0UpO1xcblxcdGZvciAodWludCBvZmZzZXQgPSBnZXRfbG9jYWxfc2l6ZSgwKSAvIDI7IG9mZnNldCAhPSAwOyBvZmZzZXQgPj49IDEpIHtcXG5cXHRcXHRpZiAobG9jYWxJbmRleCA8IG9mZnNldCkge1xcblxcdFxcdFxcdHNjcmF0Y2hbbG9jYWxJbmRleF0gPSBtYXgoc2NyYXRjaFtsb2NhbEluZGV4XSwgc2NyYXRjaFtsb2NhbEluZGV4ICsgb2Zmc2V0XSk7XFxuXFx0XFx0fVxcblxcdFxcdGJhcnJpZXIoQ0xLX0xPQ0FMX01FTV9GRU5DRSk7XFxuXFx0fVxcblxcdGlmIChsb2NhbEluZGV4ID09IDApIHtcXG5cXHRcXHRvdXRbZ2V0X2dyb3VwX2lkKDApXSA9IHNjcmF0Y2hbMF07XFxuXFx0fVxcbn1cXG5cIjtcblx0dmFyIGF4aXNSZWR1Y3Rpb25LZXJuZWxzU291cmNlID0gXCJrZXJuZWwgdm9pZCBhc3VtX2YzMihcXG5cXHR1aW50IHJlZHVjdGlvbkRpbSxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaW5uZXJTdHJpZGUgPSBnZXRfZ2xvYmFsX3NpemUoMSk7XFxuXFx0Y29uc3QgdWludCBpID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRjb25zdCB1aW50IGsgPSBnZXRfZ2xvYmFsX2lkKDEpO1xcblxcdGEgKz0gaSAqIHJlZHVjdGlvbkRpbSAqIGlubmVyU3RyaWRlICsgaztcXG5cXHRmbG9hdCBhY2N1bXVsYXRvciA9ICphO1xcblxcdHdoaWxlICgtLXJlZHVjdGlvbkRpbSkge1xcblxcdFxcdGEgKz0gaW5uZXJTdHJpZGU7XFxuXFx0XFx0YWNjdW11bGF0b3IgKz0gKmE7XFxuXFx0fVxcblxcdG91dFtpICogaW5uZXJTdHJpZGUgKyBrXSA9IGFjY3VtdWxhdG9yO1xcbn1cXG5cXG5rZXJuZWwgdm9pZCBhc3VtX2Y2NChcXG5cXHR1aW50IHJlZHVjdGlvbkRpbSxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpbm5lclN0cmlkZSA9IGdldF9nbG9iYWxfc2l6ZSgxKTtcXG5cXHRjb25zdCB1aW50IGkgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGNvbnN0IHVpbnQgayA9IGdldF9nbG9iYWxfaWQoMSk7XFxuXFx0YSArPSBpICogcmVkdWN0aW9uRGltICogaW5uZXJTdHJpZGUgKyBrO1xcblxcdGRvdWJsZSBhY2N1bXVsYXRvciA9ICphO1xcblxcdHdoaWxlICgtLXJlZHVjdGlvbkRpbSkge1xcblxcdFxcdGEgKz0gaW5uZXJTdHJpZGU7XFxuXFx0XFx0YWNjdW11bGF0b3IgKz0gKmE7XFxuXFx0fVxcblxcdG91dFtpICogaW5uZXJTdHJpZGUgKyBrXSA9IGFjY3VtdWxhdG9yO1xcbn1cXG5cXG5rZXJuZWwgdm9pZCBhbWluX2YzMihcXG5cXHR1aW50IHJlZHVjdGlvbkRpbSxcXG5cXHRnbG9iYWwgZmxvYXQqIGEsXFxuXFx0Z2xvYmFsIGZsb2F0KiBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaW5uZXJTdHJpZGUgPSBnZXRfZ2xvYmFsX3NpemUoMSk7XFxuXFx0Y29uc3QgdWludCBpID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRjb25zdCB1aW50IGsgPSBnZXRfZ2xvYmFsX2lkKDEpO1xcblxcdGEgKz0gaSAqIHJlZHVjdGlvbkRpbSAqIGlubmVyU3RyaWRlICsgaztcXG5cXHRmbG9hdCBhY2N1bXVsYXRvciA9ICphO1xcblxcdHdoaWxlICgtLXJlZHVjdGlvbkRpbSkge1xcblxcdFxcdGEgKz0gaW5uZXJTdHJpZGU7XFxuXFx0XFx0YWNjdW11bGF0b3IgPSBtaW4oYWNjdW11bGF0b3IsICphKTtcXG5cXHR9XFxuXFx0b3V0W2kgKiBpbm5lclN0cmlkZSArIGtdID0gYWNjdW11bGF0b3I7XFxufVxcblxcbmtlcm5lbCB2b2lkIGFtaW5fZjY0KFxcblxcdHVpbnQgcmVkdWN0aW9uRGltLFxcblxcdGdsb2JhbCBkb3VibGUqIGEsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlubmVyU3RyaWRlID0gZ2V0X2dsb2JhbF9zaXplKDEpO1xcblxcdGNvbnN0IHVpbnQgaSA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0Y29uc3QgdWludCBrID0gZ2V0X2dsb2JhbF9pZCgxKTtcXG5cXHRhICs9IGkgKiByZWR1Y3Rpb25EaW0gKiBpbm5lclN0cmlkZSArIGs7XFxuXFx0ZG91YmxlIGFjY3VtdWxhdG9yID0gKmE7XFxuXFx0d2hpbGUgKC0tcmVkdWN0aW9uRGltKSB7XFxuXFx0XFx0YSArPSBpbm5lclN0cmlkZTtcXG5cXHRcXHRhY2N1bXVsYXRvciA9IG1pbihhY2N1bXVsYXRvciwgKmEpO1xcblxcdH1cXG5cXHRvdXRbaSAqIGlubmVyU3RyaWRlICsga10gPSBhY2N1bXVsYXRvcjtcXG59XFxuXFxua2VybmVsIHZvaWQgYW1heF9mMzIoXFxuXFx0dWludCByZWR1Y3Rpb25EaW0sXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGlubmVyU3RyaWRlID0gZ2V0X2dsb2JhbF9zaXplKDEpO1xcblxcdGNvbnN0IHVpbnQgaSA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0Y29uc3QgdWludCBrID0gZ2V0X2dsb2JhbF9pZCgxKTtcXG5cXHRhICs9IGkgKiByZWR1Y3Rpb25EaW0gKiBpbm5lclN0cmlkZSArIGs7XFxuXFx0ZmxvYXQgYWNjdW11bGF0b3IgPSAqYTtcXG5cXHR3aGlsZSAoLS1yZWR1Y3Rpb25EaW0pIHtcXG5cXHRcXHRhICs9IGlubmVyU3RyaWRlO1xcblxcdFxcdGFjY3VtdWxhdG9yID0gbWF4KGFjY3VtdWxhdG9yLCAqYSk7XFxuXFx0fVxcblxcdG91dFtpICogaW5uZXJTdHJpZGUgKyBrXSA9IGFjY3VtdWxhdG9yO1xcbn1cXG5cXG5rZXJuZWwgdm9pZCBhbWF4X2Y2NChcXG5cXHR1aW50IHJlZHVjdGlvbkRpbSxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpbm5lclN0cmlkZSA9IGdldF9nbG9iYWxfc2l6ZSgxKTtcXG5cXHRjb25zdCB1aW50IGkgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGNvbnN0IHVpbnQgayA9IGdldF9nbG9iYWxfaWQoMSk7XFxuXFx0YSArPSBpICogcmVkdWN0aW9uRGltICogaW5uZXJTdHJpZGUgKyBrO1xcblxcdGRvdWJsZSBhY2N1bXVsYXRvciA9ICphO1xcblxcdHdoaWxlICgtLXJlZHVjdGlvbkRpbSkge1xcblxcdFxcdGEgKz0gaW5uZXJTdHJpZGU7XFxuXFx0XFx0YWNjdW11bGF0b3IgPSBtYXgoYWNjdW11bGF0b3IsICphKTtcXG5cXHR9XFxuXFx0b3V0W2kgKiBpbm5lclN0cmlkZSArIGtdID0gYWNjdW11bGF0b3I7XFxufVxcblwiO1xuXHR2YXIgcHJvZHVjdEtlcm5lbHNTb3VyY2UgPSBcImtlcm5lbCB2b2lkIGRvdF9mMzIoXFxuXFx0dWludCByZWR1Y3Rpb25EaW0sXFxuXFx0Z2xvYmFsIGZsb2F0KiBhLFxcblxcdGdsb2JhbCBmbG9hdCogYixcXG5cXHRnbG9iYWwgZmxvYXQqIG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRjb25zdCB1aW50IGsgPSBnZXRfZ2xvYmFsX2lkKDEpO1xcblxcdGNvbnN0IHVpbnQgbCA9IGdldF9nbG9iYWxfaWQoMik7XFxuXFx0Y29uc3QgdWludCBvdXRlclN0cmlkZUIgPSBnZXRfZ2xvYmFsX3NpemUoMSk7XFxuXFx0Y29uc3QgdWludCBpbm5lclN0cmlkZUIgPSBnZXRfZ2xvYmFsX3NpemUoMik7XFxuXFxuXFx0ZmxvYXQgYWNjdW11bGF0b3IgPSAwLjBmO1xcblxcdGZvciAodWludCBqID0gMDsgaiA8IHJlZHVjdGlvbkRpbTsgKytqKSB7XFxuXFx0XFx0YWNjdW11bGF0b3IgKz0gYVtpKnJlZHVjdGlvbkRpbStqXSAqIGJbKGsqcmVkdWN0aW9uRGltK2opKmlubmVyU3RyaWRlQitsXTtcXG5cXHR9XFxuXFx0b3V0WyhpKm91dGVyU3RyaWRlQiArIGspICogaW5uZXJTdHJpZGVCICsgbF0gPSBhY2N1bXVsYXRvcjtcXG59XFxuXFxua2VybmVsIHZvaWQgZG90X2Y2NChcXG5cXHR1aW50IHJlZHVjdGlvbkRpbSxcXG5cXHRnbG9iYWwgZG91YmxlKiBhLFxcblxcdGdsb2JhbCBkb3VibGUqIGIsXFxuXFx0Z2xvYmFsIGRvdWJsZSogb3V0KVxcbntcXG5cXHRjb25zdCB1aW50IGkgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGNvbnN0IHVpbnQgayA9IGdldF9nbG9iYWxfaWQoMSk7XFxuXFx0Y29uc3QgdWludCBsID0gZ2V0X2dsb2JhbF9pZCgyKTtcXG5cXHRjb25zdCB1aW50IG91dGVyU3RyaWRlQiA9IGdldF9nbG9iYWxfc2l6ZSgxKTtcXG5cXHRjb25zdCB1aW50IGlubmVyU3RyaWRlQiA9IGdldF9nbG9iYWxfc2l6ZSgyKTtcXG5cXG5cXHRkb3VibGUgYWNjdW11bGF0b3IgPSAwLjA7XFxuXFx0Zm9yICh1aW50IGogPSAwOyBqIDwgcmVkdWN0aW9uRGltOyArK2opIHtcXG5cXHRcXHRhY2N1bXVsYXRvciArPSBhW2kqcmVkdWN0aW9uRGltK2pdICogYlsoaypyZWR1Y3Rpb25EaW0raikqaW5uZXJTdHJpZGVCK2xdO1xcblxcdH1cXG5cXHRvdXRbKGkqb3V0ZXJTdHJpZGVCICsgaykgKiBpbm5lclN0cmlkZUIgKyBsXSA9IGFjY3VtdWxhdG9yO1xcbn1cXG5cIjtcblx0dmFyIHV0aWxLZXJuZWxzU291cmNlID0gXCJrZXJuZWwgdm9pZCBzZXRfZjMyKFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBmbG9hdCogb3V0LFxcblxcdGZsb2F0IHZhbHVlKVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gdmFsdWU7XFxuXFx0fVxcbn1cXG5rZXJuZWwgdm9pZCBzZXRfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dCxcXG5cXHRkb3VibGUgdmFsdWUpXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSB2YWx1ZTtcXG5cXHR9XFxufVxcblxcbmtlcm5lbCB2b2lkIGxpbnNwYWNlX2YzMihcXG5cXHR1aW50IGxlbmd0aCxcXG5cXHRnbG9iYWwgZmxvYXQqIG91dCxcXG5cXHRmbG9hdCBzdGFydCxcXG5cXHRmbG9hdCBzdGVwKVxcbntcXG5cXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRpZiAoaWQgPCBsZW5ndGgpIHtcXG5cXHRcXHRvdXRbaWRdID0gc3RhcnQgKyBzdGVwICogKChmbG9hdCkgaWQpO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgbGluc3BhY2VfZjY0KFxcblxcdHVpbnQgbGVuZ3RoLFxcblxcdGdsb2JhbCBkb3VibGUqIG91dCxcXG5cXHRkb3VibGUgc3RhcnQsXFxuXFx0ZG91YmxlIHN0ZXApXFxue1xcblxcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1xcblxcdGlmIChpZCA8IGxlbmd0aCkge1xcblxcdFxcdG91dFtpZF0gPSBzdGFydCArIHN0ZXAgKiAoKGRvdWJsZSkgaWQpO1xcblxcdH1cXG59XFxuXFxua2VybmVsIHZvaWQgcmVwZWF0X2YzMihcXG5cXHR1aW50IGV4cGFuc2lvbkRpbSxcXG5cXHR1aW50IGlubmVyU3RyaWRlLFxcblxcdHVpbnQgcmVwZWF0cyxcXG5cXHRnbG9iYWwgZmxvYXQgKnJlc3RyaWN0IGEsXFxuXFx0Z2xvYmFsIGZsb2F0ICpyZXN0cmljdCBvdXQpXFxue1xcblxcdGNvbnN0IHVpbnQgaSA9IGdldF9nbG9iYWxfaWQoMCk7XFxuXFx0Y29uc3QgdWludCBqID0gZ2V0X2dsb2JhbF9pZCgxKTtcXG5cXHRjb25zdCB1aW50IGsgPSBnZXRfZ2xvYmFsX2lkKDIpO1xcblxcdGNvbnN0IGZsb2F0IHZhbHVlID0gYVsoaSAqIGV4cGFuc2lvbkRpbSArIGopICogaW5uZXJTdHJpZGUgKyBrXTtcXG5cXHR1aW50IG9mZnNldE91dCA9IChpICogZXhwYW5zaW9uRGltICsgaikgKiByZXBlYXRzICogaW5uZXJTdHJpZGUgKyBrO1xcblxcdGZvciAodWludCBjID0gMDsgYyA8IHJlcGVhdHM7ICsrYykge1xcblxcdFxcdG91dFtvZmZzZXRPdXRdID0gdmFsdWU7XFxuXFx0XFx0b2Zmc2V0T3V0ICs9IGlubmVyU3RyaWRlO1xcblxcdH1cXG59XFxua2VybmVsIHZvaWQgcmVwZWF0X2Y2NChcXG5cXHR1aW50IGV4cGFuc2lvbkRpbSxcXG5cXHR1aW50IGlubmVyU3RyaWRlLFxcblxcdHVpbnQgcmVwZWF0cyxcXG5cXHRnbG9iYWwgZG91YmxlICpyZXN0cmljdCBhLFxcblxcdGdsb2JhbCBkb3VibGUgKnJlc3RyaWN0IG91dClcXG57XFxuXFx0Y29uc3QgdWludCBpID0gZ2V0X2dsb2JhbF9pZCgwKTtcXG5cXHRjb25zdCB1aW50IGogPSBnZXRfZ2xvYmFsX2lkKDEpO1xcblxcdGNvbnN0IHVpbnQgayA9IGdldF9nbG9iYWxfaWQoMik7XFxuXFx0Y29uc3QgZG91YmxlIHZhbHVlID0gYVsoaSAqIGV4cGFuc2lvbkRpbSArIGopICogaW5uZXJTdHJpZGUgKyBrXTtcXG5cXHR1aW50IG9mZnNldE91dCA9IChpICogZXhwYW5zaW9uRGltICsgaikgKiByZXBlYXRzICogaW5uZXJTdHJpZGUgKyBrO1xcblxcdGZvciAodWludCBjID0gMDsgYyA8IHJlcGVhdHM7ICsrYykge1xcblxcdFxcdG91dFtvZmZzZXRPdXRdID0gdmFsdWU7XFxuXFx0XFx0b2Zmc2V0T3V0ICs9IGlubmVyU3RyaWRlO1xcblxcdH1cXG59XFxuXCI7XG5cdHZhciBzb3VyY2UgPSBiaW5hcnlLZXJuZWxzU291cmNlICsgdW5hcnlLZXJuZWxzU291cmNlICsgXG5cdFx0cmVkdWN0aW9uS2VybmVsc1NvdXJjZSArIGF4aXNSZWR1Y3Rpb25LZXJuZWxzU291cmNlICsgXG5cdFx0cHJvZHVjdEtlcm5lbHNTb3VyY2UgKyB1dGlsS2VybmVsc1NvdXJjZTtcblxuXHR2YXIgYXN5bmNDYWxsYmFja3MgPSBvcHRpb25zLmFzeW5jQ2FsbGJhY2tzO1xuXHRpZiAodHlwZW9mIGFzeW5jQ2FsbGJhY2tzID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0LyogQ3VycmVudGx5IG9ubHkgTm9kZS1XZWJDTCBzdXBwb3J0cyBhc3luY2hyb25vdXMgY2FsbGJhY2tzICovXG5cdFx0dGhpcy5hc3luY0NhbGxiYWNrcyA9IGlzTm9kZVdlYkNMO1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMuYXN5bmNDYWxsYmFja3MgPSAhIWFzeW5jQ2FsbGJhY2tzO1xuXHR9XG5cdHZhciBkZXZpY2VOYW1lID0gb3B0aW9ucy5kZXZpY2U7XG5cdGlmIChkZXZpY2VOYW1lKSB7XG5cdFx0dmFyIGRldmljZUluZGV4ID0gYXZhaWxhYmxlRGV2aWNlc0Rlc2NyaXB0aW9ucy5pbmRleE9mKGRldmljZU5hbWUpO1xuXHRcdGlmIChkZXZpY2VJbmRleCA9PT0gLTEpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgV2ViQ0wgZGV2aWNlIG5hbWU6IFwiICsgZGV2aWNlTmFtZSk7XG5cdFx0fVxuXHRcdHRoaXMuZGV2aWNlID0gYXZhaWxhYmxlRGV2aWNlc1tkZXZpY2VJbmRleF07XG5cdH0gZWxzZSB7XG5cdFx0dmFyIGRldmljZUluZGV4ID0gZ2V0RGVmYXVsdERldmljZUluZGV4KCk7XG5cdFx0aWYgKGRldmljZUluZGV4IDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiTm8gc3VpdGFibGUgV2ViQ0wgZGV2aWNlIGZvdW5kXCIpO1xuXHRcdH1cblx0XHR0aGlzLmRldmljZSA9IGF2YWlsYWJsZURldmljZXNbZGV2aWNlSW5kZXhdO1xuXHR9XG5cdHRoaXMuZGV2aWNlLmVuYWJsZUV4dGVuc2lvbihcIktIUl9mcDY0XCIpO1xuXHR0aGlzLmRldmljZUluZm8gPSB7XG5cdFx0ZGV2aWNlQ2xhc3M6IGNsYXNzaWZ5RGV2aWNlKHRoaXMuZGV2aWNlKSxcblx0XHRsb2NhbE1lbW9yeVNpemU6IHRoaXMuZGV2aWNlLmdldEluZm8oY2wuREVWSUNFX0xPQ0FMX01FTV9TSVpFKSxcblx0XHRtYXhDb21wdXRlVW5pdHM6IHRoaXMuZGV2aWNlLmdldEluZm8oY2wuREVWSUNFX01BWF9DT01QVVRFX1VOSVRTKSxcblx0XHRtYXhXb3JrR3JvdXBTaXplOiB0aGlzLmRldmljZS5nZXRJbmZvKGNsLkRFVklDRV9NQVhfV09SS19HUk9VUF9TSVpFKSxcblx0XHRtYXhXb3JrSXRlbVNpemVzOiB0aGlzLmRldmljZS5nZXRJbmZvKGNsLkRFVklDRV9NQVhfV09SS19JVEVNX1NJWkVTKVxuXHR9O1xuXHR0aGlzLmNvbnRleHQgPSBjbC5jcmVhdGVDb250ZXh0KHRoaXMuZGV2aWNlKTtcblx0dGhpcy5xdWV1ZSA9IHRoaXMuY29udGV4dC5jcmVhdGVDb21tYW5kUXVldWUodGhpcy5kZXZpY2UpO1xuXHR0aGlzLnByb2dyYW0gPSB0aGlzLmNvbnRleHQuY3JlYXRlUHJvZ3JhbShzb3VyY2UpO1xuXHR0cnkge1xuXHRcdC8qIENocm9taXVtLVdlYkNMIHJlcXVpcmVzIGEgbGlzdCBvZiBkZXZpY2VzICovXG5cdFx0dGhpcy5wcm9ncmFtLmJ1aWxkKFt0aGlzLmRldmljZV0pO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0aWYgKGUubmFtZSA9PT0gXCJJTlZBTElEX0RFVklDRVwiKSB7XG5cdFx0XHQvKiBOb2tpYS1XZWJDTCBvbmx5IHdvcmtzIHdpdGggbm8gYXJndW1lbnRzIHRvIFdlYkNMUHJvZ3JhbS5idWlsZCAqL1xuXHRcdFx0dGhpcy5wcm9ncmFtLmJ1aWxkKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IGU7XG5cdFx0fVxuXHR9XG5cdHRoaXMua2VybmVscyA9IGNyZWF0ZUtlcm5lbHModGhpcy5wcm9ncmFtKTtcblx0LyogQ29udGV4dCBpcyByZWFkeSBmb3IgY29tcHV0YXRpb25zICovXG5cdGNhbGxiYWNrKHRoaXMpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIG5hbWVzIG9mIGRldmljZXMgdGhhdCBjYW4gYmUgdXNlZCBmb3IgY29tcHV0YXRpb24uXG4gKiBBbnkgb2YgdGhlc2UgbmFtZXMgY2FuIGJlIHBhc3NlZCBhcyBhIFwiZGV2aWNlXCIgb3B0aW9uIHdoZW4gY3JlYXRpbmcgYSBXZWJDTCBjb250ZXh0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZ2V0QXZhaWxhYmxlRGV2aWNlc1xuICogQHJldHVybiB7U3RyaW5nW119IC0gYSBwb3NzaWJseSBlbXB0eSBsaXN0IG9mIGF2YWlsYWJsZSBkZXZpY2UgbmFtZXMuXG4gKi9cbldlYkNMQ29udGV4dC5nZXRBdmFpbGFibGVEZXZpY2VzID0gZnVuY3Rpb24oKSB7XG5cdGlmIChXZWJDTENvbnRleHQuaXNTdXBwb3J0ZWQoKSkge1xuXHRcdHJldHVybiBhdmFpbGFibGVEZXZpY2VzRGVzY3JpcHRpb25zO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBbXTtcblx0fVxufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBuYW1lIG9mIHRoZSBkZWZhdWx0IGRldmljZSB1c2VkIGZvciBjb21wdXRhdGlvbi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGdldERlZmF1bHREZXZpY2VcbiAqIEByZXR1cm4ge1N0cmluZ30gLSB0aGUgbmFtZSBvZiB0aGUgZGVmYXVsdCBXZWJDTCBkZXZpY2Ugb3IgbnVsbCBpZiBubyBzdWl0YWJsZSBkZXZpY2UgYXZhaWxhYmxlLlxuICovXG5XZWJDTENvbnRleHQuZ2V0RGVmYXVsdERldmljZSA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgZGV2aWNlSW5kZXggPSBnZXREZWZhdWx0RGV2aWNlSW5kZXgoKTtcblx0aWYgKGRldmljZUluZGV4IDwgMCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBhdmFpbGFibGVEZXZpY2VzRGVzY3JpcHRpb25zW2RldmljZUluZGV4XTtcblx0fVxufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgV2ViQ0wgY2FuIGJlIHVzZWQgZm9yIGNvbXB1dGF0aW9uLlxuICogV2ViQ0wgaXMgdXNhYmxlIGZvciBjb21wdXRhdGlvbnMgaWYgaXQgaXMgc3VwcG9ydGVkIGJ5IEpTIGVuZ2luZSAob3IgTm9kZS5qcykgYW5kIHRoZXJlIGlzIGF0IGxlYXN0IG9uZSBDUFUgb3IgR1BVIGRldmljZSB3aXRoIEtIUl9mcDY0IGV4dGVuc2lvbi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGlzU3VwcG9ydGVkXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaWYgV2ViQ0wgaXMgdXNhYmxlIG9uIHRoaXMgc3lzdGVtIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gKi9cbldlYkNMQ29udGV4dC5pc1N1cHBvcnRlZCA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgd2ViY2wgPSBpbml0V2ViQ0woKTtcblx0aWYgKHdlYmNsID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHZhciBhdmFpbGFibGVEZXZpY2VzID0gZ2V0QXZhaWxhYmxlRGV2aWNlcygpO1xuXHRyZXR1cm4gYXZhaWxhYmxlRGV2aWNlcy5sZW5ndGggIT09IDA7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmVtcHR5ID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xuXHR9XG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XG5cdGFycmF5Ll9idWZmZXIgPSB0aGlzLmNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBhcnJheS5sZW5ndGggKiBkYXRhVHlwZS5zaXplKTtcblx0cmV0dXJuIGFycmF5O1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS56ZXJvcyA9IGZ1bmN0aW9uKHNoYXBlLCBkYXRhVHlwZSkge1xuXHRzaGFwZSA9IHV0aWwuY2hlY2tTaGFwZShzaGFwZSk7XG5cdGlmICh0eXBlb2YgZGF0YVR5cGUgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRkYXRhVHlwZSA9IG5ldyBEYXRhVHlwZShcImY2NFwiKTtcblx0fSBlbHNlIGlmICghKGRhdGFUeXBlIGluc3RhbmNlb2YgRGF0YVR5cGUpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihkYXRhVHlwZSArIFwiIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBEYXRhVHlwZVwiKTtcblx0fVxuXHR2YXIgYXJyYXkgPSBuZXcgTkRBcnJheShzaGFwZSwgZGF0YVR5cGUsIHRoaXMpO1xuXHRhcnJheS5fYnVmZmVyID0gdGhpcy5jb250ZXh0LmNyZWF0ZUJ1ZmZlcihjbC5NRU1fUkVBRF9XUklURSwgYXJyYXkubGVuZ3RoICogZGF0YVR5cGUuc2l6ZSk7XG5cdHZhciBrZXJuZWwgPSB0aGlzLmtlcm5lbHMuc2V0W2RhdGFUeXBlLnR5cGVdO1xuXHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbYXJyYXkubGVuZ3RoXSkpO1xuXHRrZXJuZWwuc2V0QXJnKDEsIGFycmF5Ll9idWZmZXIpO1xuXHRrZXJuZWwuc2V0QXJnKDIsIG5ldyBkYXRhVHlwZS5hcnJheVR5cGUoWzAuMF0pKTtcblx0dGhpcy5xdWV1ZS5lbnF1ZXVlTkRSYW5nZUtlcm5lbChrZXJuZWwsIDEsIG51bGwsIFthcnJheS5sZW5ndGhdLCBudWxsKTtcblx0cmV0dXJuIGFycmF5O1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5vbmVzID0gZnVuY3Rpb24oc2hhcGUsIGRhdGFUeXBlKSB7XG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xuXHR9XG5cdHZhciBhcnJheSA9IG5ldyBOREFycmF5KHNoYXBlLCBkYXRhVHlwZSwgdGhpcyk7XG5cdGFycmF5Ll9idWZmZXIgPSB0aGlzLmNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBhcnJheS5sZW5ndGggKiBkYXRhVHlwZS5zaXplKTtcblx0dmFyIGtlcm5lbCA9IHRoaXMua2VybmVscy5zZXRbZGF0YVR5cGUudHlwZV07XG5cdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFthcnJheS5sZW5ndGhdKSk7XG5cdGtlcm5lbC5zZXRBcmcoMSwgYXJyYXkuX2J1ZmZlcik7XG5cdGtlcm5lbC5zZXRBcmcoMiwgbmV3IGRhdGFUeXBlLmFycmF5VHlwZShbMS4wXSkpO1xuXHR0aGlzLnF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMSwgbnVsbCwgW2FycmF5Lmxlbmd0aF0sIG51bGwpO1xuXHRyZXR1cm4gYXJyYXk7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmFycmF5ID0gZnVuY3Rpb24oZGF0YSwgZGF0YVR5cGUpIHtcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xuXHR9IGVsc2Uge1xuXHRcdGRhdGFUeXBlID0gdXRpbC5jaGVja0RhdGFUeXBlKGRhdGFUeXBlKTtcblx0fVxuXHR2YXIgc2hhcGUgPSBbXTtcblx0dXRpbC5kaXNjb3ZlckFycmF5U2hhcGVSZWN1cnNpdmUoZGF0YSwgc2hhcGUsIDApO1xuXHR2YXIgYXJyYXkgPSBuZXcgTkRBcnJheShzaGFwZSwgZGF0YVR5cGUsIHRoaXMpO1xuXHR2YXIgYnVmZmVyID0gbmV3IGRhdGFUeXBlLmFycmF5VHlwZShhcnJheS5sZW5ndGgpO1xuXHR1dGlsLmNvcHlBcnJheURhdGFSZWN1cnNpdmUoYnVmZmVyLCBkYXRhLCBzaGFwZSwgMCwgMCk7XG5cdGlmICh1c2VCdWZmZXJDcmVhdGlvbldpdGhJbml0KSB7XG5cdFx0YXJyYXkuX2J1ZmZlciA9IHRoaXMuY29udGV4dC5jcmVhdGVCdWZmZXIoY2wuTUVNX1JFQURfV1JJVEUsIGJ1ZmZlci5ieXRlTGVuZ3RoLCBidWZmZXIpO1xuXHR9IGVsc2Uge1xuXHRcdGFycmF5Ll9idWZmZXIgPSB0aGlzLmNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBidWZmZXIuYnl0ZUxlbmd0aCk7XG5cdFx0dGhpcy5xdWV1ZS5lbnF1ZXVlV3JpdGVCdWZmZXIoYXJyYXkuX2J1ZmZlciwgZmFsc2UsIDAsIGJ1ZmZlci5ieXRlTGVuZ3RoLCBidWZmZXIpO1xuXHR9XG5cdHJldHVybiBhcnJheTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUubGluc3BhY2UgPSBmdW5jdGlvbihzdGFydCwgc3RvcCwgc2FtcGxlcywgY2xvc2VkKSB7XG5cdGlmICghdXRpbC5pc1JlYWwoc3RhcnQpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzdGFydCArIFwiIGlzIG5vdCBhIHJlYWwgbnVtYmVyXCIpO1xuXHR9XG5cdGlmICghdXRpbC5pc1JlYWwoc3RvcCkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHN0b3AgKyBcIiBpcyBub3QgYSByZWFsIG51bWJlclwiKTtcblx0fVxuXHRpZiAodHlwZW9mIHNhbXBsZXMgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHQvKiBEZWZhdWx0IHZhbHVlIGluIE51bVB5ICovXG5cdFx0c2FtcGxlcyA9IDUwO1xuXHR9IGVsc2UgaWYgKCF1dGlsLmlzSW50KHNhbXBsZXMpKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzYW1wbGVzICsgXCIgaXMgbm90IGFuIGludGVnZXJcIik7XG5cdH0gZWxzZSBpZiAoc2FtcGxlcyA8PSAwKSB7XG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJUaGUgbnVtYmVyIG9mIHNhbXBsZXMgbXVzdCBiZSBwb3NpdGl2ZVwiKTtcblx0fVxuXHRpZiAodHlwZW9mIGNsb3NlZCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGNsb3NlZCA9IHRydWU7XG5cdH1cblx0aWYgKGNsb3NlZCAmJiAoc2FtcGxlcyA9PT0gMSkpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBudW1iZXIgb2Ygc2FtcGxlcyBtdXN0IGJlIGEgbGVhc3QgMiAoZm9yIHN0YXJ0IGFuZCBlbmQgcG9pbnRzKVwiKTtcblx0fVxuXG5cdHZhciBkYXRhVHlwZSA9IG5ldyBEYXRhVHlwZShcImY2NFwiKTtcblx0dmFyIGFycmF5ID0gbmV3IE5EQXJyYXkoc2FtcGxlcywgZGF0YVR5cGUsIHRoaXMpO1xuXHRhcnJheS5fYnVmZmVyID0gdGhpcy5jb250ZXh0LmNyZWF0ZUJ1ZmZlcihjbC5NRU1fUkVBRF9XUklURSwgc2FtcGxlcyAqIGRhdGFUeXBlLnNpemUpO1xuXG5cdHZhciByYW5nZSA9IHN0b3AgLSBzdGFydDtcblx0dmFyIG4gPSAoY2xvc2VkKSA/IHNhbXBsZXMgLSAxIDogc2FtcGxlcztcblx0dmFyIHN0ZXAgPSByYW5nZSAvIG47XG5cblx0dmFyIGtlcm5lbCA9IHRoaXMua2VybmVscy5saW5zcGFjZVtkYXRhVHlwZS50eXBlXTtcblx0a2VybmVsLnNldEFyZygwLCBuZXcgVWludDMyQXJyYXkoW2FycmF5Lmxlbmd0aF0pKTtcblx0a2VybmVsLnNldEFyZygxLCBhcnJheS5fYnVmZmVyKTtcblx0a2VybmVsLnNldEFyZygyLCBuZXcgZGF0YVR5cGUuYXJyYXlUeXBlKFtzdGFydF0pKTtcblx0a2VybmVsLnNldEFyZygzLCBuZXcgZGF0YVR5cGUuYXJyYXlUeXBlKFtzdGVwXSkpO1xuXHR0aGlzLnF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMSwgbnVsbCwgW2FycmF5Lmxlbmd0aF0sIG51bGwpO1xuXG5cdHJldHVybiBhcnJheTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUuX2ludmFsaWRhdGUgPSBmdW5jdGlvbihhcnJheSkge1xuXHRpZiAoYXJyYXkuX2J1ZmZlciAhPT0gbnVsbCkge1xuXHRcdC8qIFdvcmstYXJvdW5kIGZvciBDaHJvbWl1bS1XZWJDTCB0aGF0IGN1cnJlbnRseSBsYWNrcyBXZWJDTE1lbU9iamVjdC5yZWxlYXNlIG1ldGhvZCAqL1xuXHRcdGlmICh0eXBlb2YgYXJyYXkuX2J1ZmZlci5yZWxlYXNlICE9PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHRhcnJheS5fYnVmZmVyLnJlbGVhc2UoKTtcblx0XHR9XG5cdFx0YXJyYXkuX2J1ZmZlciA9IG51bGw7XG5cdH1cbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oKSB7XG5cdGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgYXJndW1lbnQgbWlzc2luZ1wiKTtcblx0fVxuXHR2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdO1xuXHQvKiBWYWxpZGF0ZSBhcmd1bWVudHMgKi9cblx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdCBsZWFzdCBvbmUgTkRBcnJheSBhcmd1bWVudCBleHBlY3RlZFwiKTtcblx0fVxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyBpKyspIHtcblx0XHRpZiAoIShhcmd1bWVudHNbaV0gaW5zdGFuY2VvZiBOREFycmF5KSkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIkFyZ3VtZW50IFwiICsgaSArIFwiIGlzIG5vdCBhbiBOREFycmF5XCIpO1xuXHRcdH1cblx0fVxuXHR2YXIgY2FsbGJhY2tXYWl0QXJndW1lbnRzID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7XG5cdHZhciBjYWxsYmFja0FyZ3VtZW50cyA9IG5ldyBBcnJheShjYWxsYmFja1dhaXRBcmd1bWVudHMpO1xuXHRpZiAodGhpcy5hc3luY0NhbGxiYWNrcykge1xuXHRcdHZhciBhc3luY0V2ZW50cyA9IFtdO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tXYWl0QXJndW1lbnRzOyBpKyspIHtcblx0XHRcdHZhciBhcnJheSA9IGFyZ3VtZW50c1tpXTtcblx0XHRcdChmdW5jdGlvbihxdWV1ZSwgaSwgc2hhcGUsIEFycmF5VHlwZSkge1xuXHRcdFx0XHR2YXIgYnVmZmVyID0gbmV3IEFycmF5VHlwZShhcnJheS5sZW5ndGgpO1xuXHRcdFx0XHR2YXIgcmVhZEZpbmlzaEV2ZW50ID0gY3JlYXRlRXZlbnQoKTtcblx0XHRcdFx0YXN5bmNFdmVudHMucHVzaChyZWFkRmluaXNoRXZlbnQpO1xuXHRcdFx0XHRxdWV1ZS5lbnF1ZXVlUmVhZEJ1ZmZlcihhcnJheS5fYnVmZmVyLCBmYWxzZSwgMCwgYnVmZmVyLmJ5dGVMZW5ndGgsIGJ1ZmZlciwgbnVsbCwgcmVhZEZpbmlzaEV2ZW50KTtcblx0XHRcdFx0aWYgKHNoYXBlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHJlYWRGaW5pc2hFdmVudC5zZXRDYWxsYmFjayhjbC5DT01QTEVURSwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRyZWFkRmluaXNoRXZlbnQucmVsZWFzZSgpO1xuXHRcdFx0XHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBidWZmZXJbMF07XG5cdFx0XHRcdFx0XHRpZiAoLS1jYWxsYmFja1dhaXRBcmd1bWVudHMgPT09IDApIHtcblx0XHRcdFx0XHRcdFx0Y2FsbGJhY2suYXBwbHkobnVsbCwgY2FsbGJhY2tBcmd1bWVudHMpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlYWRGaW5pc2hFdmVudC5zZXRDYWxsYmFjayhjbC5DT01QTEVURSwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRyZWFkRmluaXNoRXZlbnQucmVsZWFzZSgpO1xuXHRcdFx0XHRcdFx0dmFyIGpzYXJyYXkgPSBuZXcgQXJyYXkoc2hhcGVbMF0pO1xuXHRcdFx0XHRcdFx0dXRpbC5jcmVhdGVBcnJheVJlY3Vyc2l2ZShuZXcgQXJyYXlUeXBlKGJ1ZmZlciksIGpzYXJyYXksIHNoYXBlLCAwLCAwKTtcblx0XHRcdFx0XHRcdGNhbGxiYWNrQXJndW1lbnRzW2ldID0ganNhcnJheTtcblx0XHRcdFx0XHRcdGlmICgtLWNhbGxiYWNrV2FpdEFyZ3VtZW50cyA9PT0gMCkge1xuXHRcdFx0XHRcdFx0XHRjYWxsYmFjay5hcHBseShudWxsLCBjYWxsYmFja0FyZ3VtZW50cyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKHRoaXMucXVldWUsIGksIGFycmF5LnNoYXBlLCBhcnJheS5kYXRhVHlwZS5hcnJheVR5cGUpO1xuXHRcdFx0LyogVGhpcyBsaW5lIG1vc3RseSBzZXJpYWxpemVzIGV4ZWN1dGlvbi4gVW5mb3J0dW5hdGVseSwgd2l0aG91dCBpdCBub3RoaW5nIHdvcmtzICovXG5cdFx0XHRjbC53YWl0Rm9yRXZlbnRzKGFzeW5jRXZlbnRzKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja1dhaXRBcmd1bWVudHM7IGkrKykge1xuXHRcdFx0dmFyIGFycmF5ID0gYXJndW1lbnRzW2ldO1xuXHRcdFx0dmFyIGJ1ZmZlciA9IG5ldyBhcnJheS5kYXRhVHlwZS5hcnJheVR5cGUoYXJyYXkubGVuZ3RoKTtcblx0XHRcdHRoaXMucXVldWUuZW5xdWV1ZVJlYWRCdWZmZXIoYXJyYXkuX2J1ZmZlciwgdHJ1ZSwgMCwgYnVmZmVyLmJ5dGVMZW5ndGgsIGJ1ZmZlcik7XG5cdFx0XHRpZiAoYXJyYXkuc2hhcGUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdGNhbGxiYWNrQXJndW1lbnRzW2ldID0gYnVmZmVyWzBdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmFyIGpzYXJyYXkgPSBuZXcgQXJyYXkoYXJyYXkuc2hhcGVbMF0pO1xuXHRcdFx0XHR1dGlsLmNyZWF0ZUFycmF5UmVjdXJzaXZlKG5ldyBhcnJheS5kYXRhVHlwZS5hcnJheVR5cGUoYnVmZmVyKSwganNhcnJheSwgYXJyYXkuc2hhcGUsIDAsIDApO1xuXHRcdFx0XHRjYWxsYmFja0FyZ3VtZW50c1tpXSA9IGpzYXJyYXk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNhbGxiYWNrLmFwcGx5KG51bGwsIGNhbGxiYWNrQXJndW1lbnRzKTtcblx0fVxufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5yZXNoYXBlID0gZnVuY3Rpb24oYSwgc2hhcGUpIHtcblx0c2hhcGUgPSB1dGlsLmNoZWNrU2hhcGUoc2hhcGUpO1xuXHRpZiAodXRpbC5jb21wdXRlTGVuZ3RoKHNoYXBlKSAhPT0gYS5sZW5ndGgpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBzaGFwZSBpcyBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSBhcnJheVwiKTtcblx0fVxuXHR2YXIgb3V0ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGEuZGF0YVR5cGUsIHRoaXMpO1xuXHRpZiAoYS5fZGVjUmVmKCkpIHtcblx0XHRvdXQuX2J1ZmZlciA9IHRoaXMuY29udGV4dC5jcmVhdGVCdWZmZXIod2ViY2wuTUVNX1JFQURfV1JJVEUsIG91dC5sZW5ndGggKiBvdXQuZGF0YVR5cGUuc2l6ZSk7XG5cdFx0dGhpcy5xdWV1ZS5lbnF1ZXVlQ29weUJ1ZmZlcihhLl9idWZmZXIsIG91dC5fYnVmZmVyLCAwLCAwLCBvdXQubGVuZ3RoICogb3V0LmRhdGFUeXBlLnNpemUpO1xuXHR9IGVsc2Uge1xuXHRcdG91dC5fYnVmZmVyID0gYS5fYnVmZmVyO1xuXHRcdGEuX2J1ZmZlciA9IG51bGw7XG5cdH1cblx0cmV0dXJuIG91dDtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUucmVwZWF0ID0gZnVuY3Rpb24oYSwgcmVwZWF0cywgYXhpcywgb3V0KSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcblx0cmVwZWF0cyA9IHV0aWwuY2hlY2tSZXBlYXRzKHJlcGVhdHMpO1xuXHRheGlzID0gdXRpbC5jaGVja0F4aXMoYXhpcywgYS5zaGFwZS5sZW5ndGgpO1xuXHR2YXIgc2hhcGVBID0gYS5zaGFwZTtcblx0dmFyIHNoYXBlT3V0ID0gc2hhcGVBLnNsaWNlKDApO1xuXHRzaGFwZU91dFtheGlzXSAqPSByZXBlYXRzO1xuXHRhLl9kZWNSZWYoKTtcblx0dHJ5IHtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoc2hhcGVPdXQsIGEuZGF0YVR5cGUsIHRoaXMpO1xuXHRcdFx0b3V0Ll9idWZmZXIgPSB0aGlzLmNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBvdXQubGVuZ3RoICogb3V0LmRhdGFUeXBlLnNpemUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkob3V0LnNoYXBlLCBzaGFwZU91dCk7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcblx0XHR9XG5cdFx0dmFyIG91dGVyU3RyaWRlID0gdXRpbC5jb21wdXRlT3V0ZXJTdHJpZGUoc2hhcGVBLCBheGlzKTtcblx0XHR2YXIgZXhwYW5zaW9uRGltID0gc2hhcGVBW2F4aXNdO1xuXHRcdHZhciBpbm5lclN0cmlkZSA9IHV0aWwuY29tcHV0ZUlubmVyU3RyaWRlKHNoYXBlQSwgYXhpcyk7XG5cdFx0dmFyIGtlcm5lbCA9IHRoaXMua2VybmVscy5yZXBlYXRbYS5kYXRhVHlwZS50eXBlXTtcblx0XHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbZXhwYW5zaW9uRGltXSkpO1xuXHRcdGtlcm5lbC5zZXRBcmcoMSwgbmV3IFVpbnQzMkFycmF5KFtpbm5lclN0cmlkZV0pKTtcblx0XHRrZXJuZWwuc2V0QXJnKDIsIG5ldyBVaW50MzJBcnJheShbcmVwZWF0c10pKTtcblx0XHRrZXJuZWwuc2V0QXJnKDMsIGEuX2J1ZmZlcik7XG5cdFx0a2VybmVsLnNldEFyZyg0LCBvdXQuX2J1ZmZlcik7XG5cdFx0dGhpcy5xdWV1ZS5lbnF1ZXVlTkRSYW5nZUtlcm5lbChrZXJuZWwsIDMsIG51bGwsIFtvdXRlclN0cmlkZSwgZXhwYW5zaW9uRGltLCBpbm5lclN0cmlkZV0sIG51bGwpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0YS5faW5jUmVmKCk7XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRhLl90cnlJbnZhbGlkYXRlKCk7XG5cdHJldHVybiBvdXQ7XG59O1xuXG52YXIgYmluYXJ5QXJpdGhPcCA9IGZ1bmN0aW9uKGEsIGIsIG91dCwgZnVyaW91c0NvbnRleHQsIGJpbmFyeU9wS2VybmVscywgYmluYXJ5Q29uc3RPcEtlcm5lbHMsIGJpbmFyeVJldkNvbnN0S2VybmVscykge1xuXHR2YXIgc2hhcGVPdXQgPSBudWxsLCBkYXRhVHlwZU91dCA9IG51bGw7XG5cdHZhciBidWZmZXJBID0gbnVsbCwgYnVmZmVyQiA9IG51bGw7XG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdGJ1ZmZlckEgPSBhLl9idWZmZXI7XG5cdFx0c2hhcGVPdXQgPSBhLnNoYXBlO1xuXHRcdGRhdGFUeXBlT3V0ID0gYS5kYXRhVHlwZTtcblx0XHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRcdGJ1ZmZlckIgPSBiLl9idWZmZXI7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBiLnNoYXBlKTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIGIuZGF0YVR5cGUpO1xuXHRcdH0gZWxzZSBpZiAoIXV0aWwuaXNOdW1iZXIoYikpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGJcIik7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKHV0aWwuaXNOdW1iZXIoYSkpIHtcblx0XHR1dGlsLmNoZWNrTkRBcnJheShiLCBcImJcIik7XG5cdFx0YnVmZmVyQiA9IGIuX2J1ZmZlcjtcblx0XHRzaGFwZU91dCA9IGIuc2hhcGU7XG5cdFx0ZGF0YVR5cGVPdXQgPSBiLmRhdGFUeXBlO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGFcIik7XG5cdH1cblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0YS5fZGVjUmVmKCk7XG5cdH1cblx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0Yi5fZGVjUmVmKCk7XG5cdH1cblx0dHJ5IHtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoc2hhcGVPdXQsIGRhdGFUeXBlT3V0LCBmdXJpb3VzQ29udGV4dCk7XG5cdFx0XHRpZiAoKGEgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYS5faGFzUmVmcygpKSB7XG5cdFx0XHRcdG91dC5fYnVmZmVyID0gYS5fYnVmZmVyO1xuXHRcdFx0XHRhLl9idWZmZXIgPSBudWxsO1xuXHRcdFx0fSBlbHNlIGlmICgoYiBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFiLl9oYXNSZWZzKCkpIHtcblx0XHRcdFx0b3V0Ll9idWZmZXIgPSBiLl9idWZmZXI7XG5cdFx0XHRcdGIuX2J1ZmZlciA9IG51bGw7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXQuX2J1ZmZlciA9IGZ1cmlvdXNDb250ZXh0LmNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBvdXQubGVuZ3RoICogb3V0LmRhdGFUeXBlLnNpemUpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoc2hhcGVPdXQsIG91dC5zaGFwZSk7XG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShkYXRhVHlwZU91dCwgb3V0LmRhdGFUeXBlKTtcblx0XHRcdG91dC5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XG5cdFx0XHRcdHZhciBrZXJuZWwgPSBiaW5hcnlPcEtlcm5lbHNbZGF0YVR5cGVPdXQudHlwZV07XG5cdFx0XHRcdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFtvdXQubGVuZ3RoXSkpO1xuXHRcdFx0XHRrZXJuZWwuc2V0QXJnKDEsIGJ1ZmZlckEpO1xuXHRcdFx0XHRrZXJuZWwuc2V0QXJnKDIsIGJ1ZmZlckIpO1xuXHRcdFx0XHRrZXJuZWwuc2V0QXJnKDMsIG91dC5fYnVmZmVyKTtcblx0XHRcdFx0ZnVyaW91c0NvbnRleHQucXVldWUuZW5xdWV1ZU5EUmFuZ2VLZXJuZWwoa2VybmVsLCAxLCBudWxsLCBbb3V0Lmxlbmd0aF0sIG51bGwpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmFyIGtlcm5lbCA9IGJpbmFyeUNvbnN0T3BLZXJuZWxzW2RhdGFUeXBlT3V0LnR5cGVdO1xuXHRcdFx0XHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbb3V0Lmxlbmd0aF0pKTtcblx0XHRcdFx0a2VybmVsLnNldEFyZygxLCBidWZmZXJBKTtcblx0XHRcdFx0a2VybmVsLnNldEFyZygyLCBuZXcgZGF0YVR5cGVPdXQuYXJyYXlUeXBlKFtiXSkpO1xuXHRcdFx0XHRrZXJuZWwuc2V0QXJnKDMsIG91dC5fYnVmZmVyKTtcblx0XHRcdFx0ZnVyaW91c0NvbnRleHQucXVldWUuZW5xdWV1ZU5EUmFuZ2VLZXJuZWwoa2VybmVsLCAxLCBudWxsLCBbb3V0Lmxlbmd0aF0sIG51bGwpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR2YXIga2VybmVsID0gYmluYXJ5UmV2Q29uc3RLZXJuZWxzW2RhdGFUeXBlT3V0LnR5cGVdO1xuXHRcdFx0a2VybmVsLnNldEFyZygwLCBuZXcgVWludDMyQXJyYXkoW291dC5sZW5ndGhdKSk7XG5cdFx0XHRrZXJuZWwuc2V0QXJnKDEsIGJ1ZmZlckIpO1xuXHRcdFx0a2VybmVsLnNldEFyZygyLCBuZXcgZGF0YVR5cGVPdXQuYXJyYXlUeXBlKFthXSkpO1xuXHRcdFx0a2VybmVsLnNldEFyZygzLCBvdXQuX2J1ZmZlcik7XG5cdFx0XHRmdXJpb3VzQ29udGV4dC5xdWV1ZS5lbnF1ZXVlTkRSYW5nZUtlcm5lbChrZXJuZWwsIDEsIG51bGwsIFtvdXQubGVuZ3RoXSwgbnVsbCk7XG5cdFx0fVxuXHR9IGNhdGNoIChlKSB7XG5cdFx0LyogUmVzdG9yZSB0aGUgcHJldmlvdXMgc3RhdGUgKi9cblx0XHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRcdGEuX2luY1JlZigpO1xuXHRcdH1cblx0XHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRcdGIuX2luY1JlZigpO1xuXHRcdH1cblx0XHR0aHJvdyBlO1xuXHR9XG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xuXHRcdGEuX3RyeUludmFsaWRhdGUoKTtcblx0fVxuXHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHRiLl90cnlJbnZhbGlkYXRlKCk7XG5cdH1cblx0cmV0dXJuIG91dDtcbn07XG5cbnZhciB1bmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBvdXQsIGZ1cmlvdXNDb250ZXh0LCB1bmFyeU9wS2VybmVscykge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdGEuX2RlY1JlZigpO1xuXHR2YXIgYnVmZmVyQSA9IGEuX2J1ZmZlcjtcblx0dHJ5IHtcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoYS5zaGFwZSwgYS5kYXRhVHlwZSwgZnVyaW91c0NvbnRleHQpO1xuXHRcdFx0aWYgKChhIGluc3RhbmNlb2YgTkRBcnJheSkgJiYgIWEuX2hhc1JlZnMoKSkge1xuXHRcdFx0XHRvdXQuX2J1ZmZlciA9IGEuX2J1ZmZlcjtcblx0XHRcdFx0YS5fYnVmZmVyID0gbnVsbDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG91dC5fYnVmZmVyID0gZnVyaW91c0NvbnRleHQuY29udGV4dC5jcmVhdGVCdWZmZXIoY2wuTUVNX1JFQURfV1JJVEUsIG91dC5sZW5ndGggKiBvdXQuZGF0YVR5cGUuc2l6ZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBvdXQuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcblx0XHRcdG91dC5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdHZhciBrZXJuZWwgPSB1bmFyeU9wS2VybmVsc1thLmRhdGFUeXBlLnR5cGVdO1xuXHRcdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFtvdXQubGVuZ3RoXSkpO1xuXHRcdGtlcm5lbC5zZXRBcmcoMSwgYnVmZmVyQSk7XG5cdFx0a2VybmVsLnNldEFyZygyLCBvdXQuX2J1ZmZlcik7XG5cdFx0ZnVyaW91c0NvbnRleHQucXVldWUuZW5xdWV1ZU5EUmFuZ2VLZXJuZWwoa2VybmVsLCAxLCBudWxsLCBbb3V0Lmxlbmd0aF0sIG51bGwpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0LyogUmVzdG9yZSB0aGUgcHJldmlvdXMgc3RhdGUgKi9cblx0XHRhLl9pbmNSZWYoKTtcblx0XHR0aHJvdyBlO1xuXHR9XG5cdGEuX3RyeUludmFsaWRhdGUoKTtcblx0cmV0dXJuIG91dDtcbn07XG5cbnZhciBheGlzUmVkdWNlT3AgPSBmdW5jdGlvbihhLCBheGlzLCBvdXQsIGZ1cmlvdXNDb250ZXh0LCByZWR1Y2VLZXJuZWxzLCBheGlzUmVkdWNlS2VybmVscykge1xuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XG5cdGlmICh0eXBlb2YgYXhpcyA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShbXSwgYS5kYXRhVHlwZSwgZnVyaW91c0NvbnRleHQpO1xuXHRcdFx0b3V0Ll9idWZmZXIgPSBmdXJpb3VzQ29udGV4dC5jb250ZXh0LmNyZWF0ZUJ1ZmZlcihjbC5NRU1fUkVBRF9XUklURSwgYS5kYXRhVHlwZS5zaXplKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KFtdLCBvdXQuc2hhcGUpO1xuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcblx0XHRcdG91dC5faW5jUmVmKCk7XG5cdFx0fVxuXHRcdHZhciBsZW5ndGhBID0gYS5sZW5ndGg7XG5cdFx0dmFyIG1heFdvcmtJdGVtc1BlckNVID0gTWF0aC5taW4oXG5cdFx0XHRNYXRoLm1pbihmdXJpb3VzQ29udGV4dC5kZXZpY2VJbmZvLm1heFdvcmtHcm91cFNpemUsXG5cdFx0XHRcdGZ1cmlvdXNDb250ZXh0LmRldmljZUluZm8ubWF4V29ya0l0ZW1TaXplc1swXSksIFxuXHRcdFx0ZnVyaW91c0NvbnRleHQuZGV2aWNlSW5mby5sb2NhbE1lbW9yeVNpemUgLyBhLmRhdGFUeXBlLnNpemUpO1xuXHRcdC8qIFRoZSBtaW5pbWFsIGFtbW91bnQgb2YgcGFyYWxsZWxpc20gdGhhdCBqdXN0aWZpZXMgc3dpdGNoaW5nIHRvIHR3by1wYXNzIHJlZHVjdGlvbiAqL1xuXHRcdHZhciBwYXJhbGxlbGlzYXRpb25UaHJlc2hvbGQgPSAxNjtcblx0XHR2YXIga2VybmVsID0gcmVkdWNlS2VybmVsc1thLmRhdGFUeXBlLnR5cGVdO1xuXHRcdGlmIChsZW5ndGhBIDwgbWF4V29ya0l0ZW1zUGVyQ1UgKiBwYXJhbGxlbGlzYXRpb25UaHJlc2hvbGQpIHtcblx0XHRcdC8qIE9uZSByZWR1Y3Rpb24gaXMgZW5vdWdoICovXG5cdFx0XHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbbGVuZ3RoQV0pKTtcblx0XHRcdGtlcm5lbC5zZXRBcmcoMSwgYS5fYnVmZmVyKTtcblx0XHRcdGtlcm5lbC5zZXRBcmcoMiwgbmV3IFVpbnQzMkFycmF5KFttYXhXb3JrSXRlbXNQZXJDVSAqIGEuZGF0YVR5cGUuc2l6ZV0pKTtcblx0XHRcdGtlcm5lbC5zZXRBcmcoMywgb3V0Ll9idWZmZXIpO1xuXHRcdFx0LyogSW1wb3J0YW50OiB1c2Ugb25seSBvbmUgd29yayBncm91cCAqL1xuXHRcdFx0ZnVyaW91c0NvbnRleHQucXVldWUuZW5xdWV1ZU5EUmFuZ2VLZXJuZWwoa2VybmVsLCAxLCBudWxsLCBbbWF4V29ya0l0ZW1zUGVyQ1VdLCBbbWF4V29ya0l0ZW1zUGVyQ1VdKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0LyogVHdvLXN0ZXAgcmVkdWN0aW9uICovXG5cdFx0XHR2YXIgbWF4Q29tcHV0ZVVuaXRzID0gZnVyaW91c0NvbnRleHQuZGV2aWNlSW5mby5tYXhDb21wdXRlVW5pdHM7XG5cdFx0XHR2YXIgd29ya0dyb3VwU2l6ZU11bHRpcGxlID0ga2VybmVsLmdldFdvcmtHcm91cEluZm8oZnVyaW91c0NvbnRleHQuZGV2aWNlLCBjbC5LRVJORUxfUFJFRkVSUkVEX1dPUktfR1JPVVBfU0laRV9NVUxUSVBMRSk7XG5cdFx0XHR2YXIgdGVtcEJ1ZmZlciA9IGZ1cmlvdXNDb250ZXh0LmNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBtYXhDb21wdXRlVW5pdHMgKiBhLmRhdGFUeXBlLnNpemUpO1xuXG5cdFx0XHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbbGVuZ3RoQV0pKTtcblx0XHRcdGtlcm5lbC5zZXRBcmcoMSwgYS5fYnVmZmVyKTtcblx0XHRcdGtlcm5lbC5zZXRBcmcoMiwgbmV3IFVpbnQzMkFycmF5KFttYXhXb3JrSXRlbXNQZXJDVSAqIGEuZGF0YVR5cGUuc2l6ZV0pKTtcblx0XHRcdGtlcm5lbC5zZXRBcmcoMywgdGVtcEJ1ZmZlcik7XG5cdFx0XHRmdXJpb3VzQ29udGV4dC5xdWV1ZS5lbnF1ZXVlTkRSYW5nZUtlcm5lbChrZXJuZWwsIDEsIG51bGwsXG5cdFx0XHRcdFttYXhXb3JrSXRlbXNQZXJDVSAqIG1heENvbXB1dGVVbml0c10sXG5cdFx0XHRcdFttYXhXb3JrSXRlbXNQZXJDVV0pO1xuXG5cdFx0XHR2YXIgd29ya0dyb3VwU2l6ZSA9IE1hdGgubWluKG1heFdvcmtJdGVtc1BlckNVLFxuXHRcdFx0XHR1dGlsLnJvdW5kVXAobWF4Q29tcHV0ZVVuaXRzLCB3b3JrR3JvdXBTaXplTXVsdGlwbGUpKTtcblx0XHRcdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFttYXhDb21wdXRlVW5pdHNdKSk7XG5cdFx0XHRrZXJuZWwuc2V0QXJnKDEsIHRlbXBCdWZmZXIpO1xuXHRcdFx0a2VybmVsLnNldEFyZygyLCBuZXcgVWludDMyQXJyYXkoW3dvcmtHcm91cFNpemUgKiBhLmRhdGFUeXBlLnNpemVdKSk7XG5cdFx0XHRrZXJuZWwuc2V0QXJnKDMsIG91dC5fYnVmZmVyKTtcblx0XHRcdC8qIEltcG9ydGFudDogdXNlIG9ubHkgb25lIHdvcmsgZ3JvdXAgKi9cblx0XHRcdGZ1cmlvdXNDb250ZXh0LnF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMSwgbnVsbCxcblx0XHRcdFx0W3dvcmtHcm91cFNpemVdLFxuXHRcdFx0XHRbd29ya0dyb3VwU2l6ZV0pO1xuXG5cdFx0XHR0ZW1wQnVmZmVyLnJlbGVhc2UoKTtcblx0XHR9XG5cdFx0YS5fdHJ5UmVsZWFzZSgpO1xuXHRcdHJldHVybiBvdXQ7XG5cdH0gZWxzZSB7XG5cdFx0YXhpcyA9IHV0aWwuY2hlY2tBeGlzKGF4aXMsIGEuc2hhcGUubGVuZ3RoKTtcblx0XHR2YXIgc2hhcGVPdXQgPSB1dGlsLmNvbXB1dGVBeGlzUmVkdWN0aW9uT3V0U2hhcGUoYS5zaGFwZSwgYXhpcyk7XG5cdFx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRcdHZhciBvdXQgPSBuZXcgTkRBcnJheShzaGFwZU91dCwgYS5kYXRhVHlwZSwgZnVyaW91c0NvbnRleHQpO1xuXHRcdFx0b3V0Ll9idWZmZXIgPSBmdXJpb3VzQ29udGV4dC5jb250ZXh0LmNyZWF0ZUJ1ZmZlcihjbC5NRU1fUkVBRF9XUklURSwgYS5kYXRhVHlwZS5zaXplICogb3V0Lmxlbmd0aCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShbXSwgb3V0LnNoYXBlKTtcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XG5cdFx0XHRvdXQuX2luY1JlZigpO1xuXHRcdH1cblx0XHR2YXIgb3V0ZXJTdHJpZGUgPSB1dGlsLmNvbXB1dGVPdXRlclN0cmlkZShhLnNoYXBlLCBheGlzKTtcblx0XHR2YXIgcmVkdWN0aW9uRGltID0gYS5zaGFwZVtheGlzXTtcblx0XHR2YXIgaW5uZXJTdHJpZGUgPSB1dGlsLmNvbXB1dGVJbm5lclN0cmlkZShhLnNoYXBlLCBheGlzKTtcblx0XHR2YXIga2VybmVsID0gYXhpc1JlZHVjZUtlcm5lbHNbYS5kYXRhVHlwZS50eXBlXTtcblx0XHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbcmVkdWN0aW9uRGltXSkpO1xuXHRcdGtlcm5lbC5zZXRBcmcoMSwgYS5fYnVmZmVyKTtcblx0XHRrZXJuZWwuc2V0QXJnKDIsIG91dC5fYnVmZmVyKTtcblx0XHRmdXJpb3VzQ29udGV4dC5xdWV1ZS5lbnF1ZXVlTkRSYW5nZUtlcm5lbChrZXJuZWwsIDIsIG51bGwsXG5cdFx0XHRbb3V0ZXJTdHJpZGUsIGlubmVyU3RyaWRlXSwgbnVsbCk7XG5cdFx0YS5fdHJ5UmVsZWFzZSgpO1xuXHRcdHJldHVybiBvdXQ7XG5cdH1cbn07XG5cblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcblx0cmV0dXJuIGJpbmFyeUFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzLCB0aGlzLmtlcm5lbHMuYWRkLCB0aGlzLmtlcm5lbHMuYWRkYywgdGhpcy5rZXJuZWxzLmFkZGMpO1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5zdWIgPSBmdW5jdGlvbihhLCBiLCBvdXQpIHtcblx0cmV0dXJuIGJpbmFyeUFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzLCB0aGlzLmtlcm5lbHMuc3ViLCB0aGlzLmtlcm5lbHMuc3ViYywgdGhpcy5rZXJuZWxzLnN1YnJjKTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUubXVsID0gZnVuY3Rpb24oYSwgYiwgb3V0KSB7XG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgdGhpcy5rZXJuZWxzLm11bCwgdGhpcy5rZXJuZWxzLm11bGMsIHRoaXMua2VybmVscy5tdWxjKTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUuZGl2ID0gZnVuY3Rpb24oYSwgYiwgb3V0KSB7XG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgdGhpcy5rZXJuZWxzLmRpdiwgdGhpcy5rZXJuZWxzLmRpdmMsIHRoaXMua2VybmVscy5kaXZyYyk7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLm5lZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywgdGhpcy5rZXJuZWxzLm5lZyk7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmFicyA9IGZ1bmN0aW9uKGEsIG91dCkge1xuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywgdGhpcy5rZXJuZWxzLmFicyk7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmV4cCA9IGZ1bmN0aW9uKGEsIG91dCkge1xuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywgdGhpcy5rZXJuZWxzLmV4cCk7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmxvZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywgdGhpcy5rZXJuZWxzLmxvZyk7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLnNxcnQgPSBmdW5jdGlvbihhLCBvdXQpIHtcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIHRoaXMua2VybmVscy5zcXJ0KTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUuc3F1YXJlID0gZnVuY3Rpb24oYSwgb3V0KSB7XG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCB0aGlzLmtlcm5lbHMuc3F1YXJlKTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUubWluID0gZnVuY3Rpb24oYSwgYXhpcywgb3V0KSB7XG5cdHJldHVybiBheGlzUmVkdWNlT3AoYSwgYXhpcywgb3V0LCB0aGlzLCB0aGlzLmtlcm5lbHMubWluLCB0aGlzLmtlcm5lbHMuYW1pbik7XG59O1xuXG5XZWJDTENvbnRleHQucHJvdG90eXBlLm1heCA9IGZ1bmN0aW9uKGEsIGF4aXMsIG91dCkge1xuXHRyZXR1cm4gYXhpc1JlZHVjZU9wKGEsIGF4aXMsIG91dCwgdGhpcywgdGhpcy5rZXJuZWxzLm1heCwgdGhpcy5rZXJuZWxzLmFtYXgpO1xufTtcblxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5zdW0gPSBmdW5jdGlvbihhLCBheGlzLCBvdXQpIHtcblx0cmV0dXJuIGF4aXNSZWR1Y2VPcChhLCBheGlzLCBvdXQsIHRoaXMsIHRoaXMua2VybmVscy5zdW0sIHRoaXMua2VybmVscy5hc3VtKTtcbn07XG5cbldlYkNMQ29udGV4dC5wcm90b3R5cGUuZG90ID0gZnVuY3Rpb24oYSwgYiwgb3V0KSB7XG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcblx0dXRpbC5jaGVja05EQXJyYXkoYiwgXCJiXCIpO1xuXHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBiLmRhdGFUeXBlKTtcblxuXHQvKiBUaGUgYXhpcyBvZiBiIHVzZWQgaW4gcmVkdWN0aW9uOiBheGlzIDAgZm9yIDFEIGFycmF5LCBzZWNvbmQtdG8tbGFzdCBheGlzIGZvciBORCBhcnJheSAqL1xuXHR2YXIgYUF4aXMgPSBNYXRoLm1heChhLnNoYXBlLmxlbmd0aCAtIDEsIDApO1xuXHR2YXIgYkF4aXMgPSBNYXRoLm1heChiLnNoYXBlLmxlbmd0aCAtIDIsIDApO1xuXHR2YXIgcmVkdWN0aW9uRGltID0gYS5zaGFwZVthQXhpc107XG5cdGlmIChyZWR1Y3Rpb25EaW0gIT09IGIuc2hhcGVbYkF4aXNdKSB7XG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJBcnJheXMgaGF2ZSBpbmNvbXBhdGlibGUgcmVkdWN0aW9uIGRpbWVuc2lvbnNcIik7XG5cdH1cblx0dmFyIHNoYXBlT3V0ID0gW10sIHN0cmlkZUEgPSAxLCBvdXRlclN0cmlkZUIgPSAxLCBpbm5lclN0cmlkZUIgPSAxO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFBeGlzOyBpKyspIHtcblx0XHRzaGFwZU91dC5wdXNoKGEuc2hhcGVbaV0pO1xuXHRcdHN0cmlkZUEgKj0gYS5zaGFwZVtpXTtcblx0fVxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGIuc2hhcGUubGVuZ3RoOyBpKyspIHtcblx0XHR2YXIgZGltID0gYi5zaGFwZVtpXTtcblx0XHRpZiAoaSA8IGJBeGlzKSB7XG5cdFx0XHRvdXRlclN0cmlkZUIgKj0gZGltO1xuXHRcdFx0c2hhcGVPdXQucHVzaChkaW0pO1xuXHRcdH0gZWxzZSBpZiAoaSA+IGJBeGlzKSB7XG5cdFx0XHRpbm5lclN0cmlkZUIgKj0gZGltO1xuXHRcdFx0c2hhcGVPdXQucHVzaChkaW0pO1xuXHRcdH1cblx0fVxuXHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdG91dCA9IHRoaXMuZW1wdHkoc2hhcGVPdXQsIGEuZGF0YVR5cGUpO1xuXHR9IGVsc2UgaWYgKG91dCBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcblx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xuXHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KG91dC5zaGFwZSwgc2hhcGVPdXQpO1xuXHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KG91dC5kYXRhVHlwZSwgYS5kYXRhVHlwZSk7XG5cdFx0dXRpbC5jaGVja0RpZmZlcmVudE5EQXJyYXlzKGEsIG91dCwgXCJhXCIsIFwib3V0XCIpO1xuXHRcdHV0aWwuY2hlY2tEaWZmZXJlbnROREFycmF5cyhiLCBvdXQsIFwiYlwiLCBcIm91dFwiKTtcblx0XHRvdXQuX2luY1JlZigpO1xuXHR9XG5cdHZhciBrZXJuZWwgPSB0aGlzLmtlcm5lbHMuZG90W291dC5kYXRhVHlwZS50eXBlXTtcblx0a2VybmVsLnNldEFyZygwLCBuZXcgVWludDMyQXJyYXkoW3JlZHVjdGlvbkRpbV0pKTtcblx0a2VybmVsLnNldEFyZygxLCBhLl9idWZmZXIpO1xuXHRrZXJuZWwuc2V0QXJnKDIsIGIuX2J1ZmZlcik7XG5cdGtlcm5lbC5zZXRBcmcoMywgb3V0Ll9idWZmZXIpO1xuXHR0aGlzLnF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMywgbnVsbCxcblx0XHRbc3RyaWRlQSwgb3V0ZXJTdHJpZGVCLCBpbm5lclN0cmlkZUJdLCBudWxsKTtcblx0YS5fdHJ5UmVsZWFzZSgpO1xuXHRiLl90cnlSZWxlYXNlKCk7XG5cdHJldHVybiBvdXQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYkNMQ29udGV4dDtcbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTJcblxuLyoqXG4gKiBJZiBgQnVmZmVyLl91c2VUeXBlZEFycmF5c2A6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChjb21wYXRpYmxlIGRvd24gdG8gSUU2KVxuICovXG5CdWZmZXIuX3VzZVR5cGVkQXJyYXlzID0gKGZ1bmN0aW9uICgpIHtcbiAgLy8gRGV0ZWN0IGlmIGJyb3dzZXIgc3VwcG9ydHMgVHlwZWQgQXJyYXlzLiBTdXBwb3J0ZWQgYnJvd3NlcnMgYXJlIElFIDEwKywgRmlyZWZveCA0KyxcbiAgLy8gQ2hyb21lIDcrLCBTYWZhcmkgNS4xKywgT3BlcmEgMTEuNissIGlPUyA0LjIrLiBJZiB0aGUgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IGFkZGluZ1xuICAvLyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsIHRoZW4gdGhhdCdzIHRoZSBzYW1lIGFzIG5vIGBVaW50OEFycmF5YCBzdXBwb3J0XG4gIC8vIGJlY2F1c2Ugd2UgbmVlZCB0byBiZSBhYmxlIHRvIGFkZCBhbGwgdGhlIG5vZGUgQnVmZmVyIEFQSSBtZXRob2RzLiBUaGlzIGlzIGFuIGlzc3VlXG4gIC8vIGluIEZpcmVmb3ggNC0yOS4gTm93IGZpeGVkOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzhcbiAgdHJ5IHtcbiAgICB2YXIgYnVmID0gbmV3IEFycmF5QnVmZmVyKDApXG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KGJ1ZilcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIHJldHVybiA0MiA9PT0gYXJyLmZvbygpICYmXG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgLy8gQ2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufSkoKVxuXG4vKipcbiAqIENsYXNzOiBCdWZmZXJcbiAqID09PT09PT09PT09PT1cbiAqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGFyZSBhdWdtZW50ZWRcbiAqIHdpdGggZnVuY3Rpb24gcHJvcGVydGllcyBmb3IgYWxsIHRoZSBub2RlIGBCdWZmZXJgIEFQSSBmdW5jdGlvbnMuIFdlIHVzZVxuICogYFVpbnQ4QXJyYXlgIHNvIHRoYXQgc3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXQgcmV0dXJuc1xuICogYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogQnkgYXVnbWVudGluZyB0aGUgaW5zdGFuY2VzLCB3ZSBjYW4gYXZvaWQgbW9kaWZ5aW5nIHRoZSBgVWludDhBcnJheWBcbiAqIHByb3RvdHlwZS5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nLCBub1plcm8pXG5cbiAgdmFyIHR5cGUgPSB0eXBlb2Ygc3ViamVjdFxuXG4gIGlmIChlbmNvZGluZyA9PT0gJ2Jhc2U2NCcgJiYgdHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBzdWJqZWN0ID0gYmFzZTY0Y2xlYW4oc3ViamVjdClcbiAgfVxuXG4gIC8vIEZpbmQgdGhlIGxlbmd0aFxuICB2YXIgbGVuZ3RoXG4gIGlmICh0eXBlID09PSAnbnVtYmVyJylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdClcbiAgZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpXG4gICAgbGVuZ3RoID0gQnVmZmVyLmJ5dGVMZW5ndGgoc3ViamVjdCwgZW5jb2RpbmcpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdvYmplY3QnKVxuICAgIGxlbmd0aCA9IGNvZXJjZShzdWJqZWN0Lmxlbmd0aCkgLy8gYXNzdW1lIHRoYXQgb2JqZWN0IGlzIGFycmF5LWxpa2VcbiAgZWxzZVxuICAgIHRocm93IG5ldyBFcnJvcignRmlyc3QgYXJndW1lbnQgbmVlZHMgdG8gYmUgYSBudW1iZXIsIGFycmF5IG9yIHN0cmluZy4nKVxuXG4gIHZhciBidWZcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICAvLyBQcmVmZXJyZWQ6IFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgYnVmID0gQnVmZmVyLl9hdWdtZW50KG5ldyBVaW50OEFycmF5KGxlbmd0aCkpXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBUSElTIGluc3RhbmNlIG9mIEJ1ZmZlciAoY3JlYXRlZCBieSBgbmV3YClcbiAgICBidWYgPSB0aGlzXG4gICAgYnVmLmxlbmd0aCA9IGxlbmd0aFxuICAgIGJ1Zi5faXNCdWZmZXIgPSB0cnVlXG4gIH1cblxuICB2YXIgaVxuICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiB0eXBlb2Ygc3ViamVjdC5ieXRlTGVuZ3RoID09PSAnbnVtYmVyJykge1xuICAgIC8vIFNwZWVkIG9wdGltaXphdGlvbiAtLSB1c2Ugc2V0IGlmIHdlJ3JlIGNvcHlpbmcgZnJvbSBhIHR5cGVkIGFycmF5XG4gICAgYnVmLl9zZXQoc3ViamVjdClcbiAgfSBlbHNlIGlmIChpc0FycmF5aXNoKHN1YmplY3QpKSB7XG4gICAgLy8gVHJlYXQgYXJyYXktaXNoIG9iamVjdHMgYXMgYSBieXRlIGFycmF5XG4gICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSkge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKVxuICAgICAgICBidWZbaV0gPSBzdWJqZWN0LnJlYWRVSW50OChpKVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspXG4gICAgICAgIGJ1ZltpXSA9ICgoc3ViamVjdFtpXSAlIDI1NikgKyAyNTYpICUgMjU2XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgYnVmLndyaXRlKHN1YmplY3QsIDAsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmICFCdWZmZXIuX3VzZVR5cGVkQXJyYXlzICYmICFub1plcm8pIHtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGJ1ZltpXSA9IDBcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnVmXG59XG5cbi8vIFNUQVRJQyBNRVRIT0RTXG4vLyA9PT09PT09PT09PT09PVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gKGIpIHtcbiAgcmV0dXJuICEhKGIgIT09IG51bGwgJiYgYiAhPT0gdW5kZWZpbmVkICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGZ1bmN0aW9uIChzdHIsIGVuY29kaW5nKSB7XG4gIHZhciByZXRcbiAgc3RyID0gc3RyLnRvU3RyaW5nKClcbiAgc3dpdGNoIChlbmNvZGluZyB8fCAndXRmOCcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gc3RyLmxlbmd0aCAvIDJcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gdXRmOFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAncmF3JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFRvQnl0ZXMoc3RyKS5sZW5ndGhcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggKiAyXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIChsaXN0LCB0b3RhbExlbmd0aCkge1xuICBhc3NlcnQoaXNBcnJheShsaXN0KSwgJ1VzYWdlOiBCdWZmZXIuY29uY2F0KGxpc3RbLCBsZW5ndGhdKScpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfSBlbHNlIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBsaXN0WzBdXG4gIH1cblxuICB2YXIgaVxuICBpZiAodG90YWxMZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIHRvdGFsTGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHRvdGFsTGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgYXNzZXJ0KEJ1ZmZlci5pc0J1ZmZlcihhKSAmJiBCdWZmZXIuaXNCdWZmZXIoYiksICdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBNYXRoLm1pbih4LCB5KTsgaSA8IGxlbiAmJiBhW2ldID09PSBiW2ldOyBpKyspIHt9XG4gIGlmIChpICE9PSBsZW4pIHtcbiAgICB4ID0gYVtpXVxuICAgIHkgPSBiW2ldXG4gIH1cbiAgaWYgKHggPCB5KSB7XG4gICAgcmV0dXJuIC0xXG4gIH1cbiAgaWYgKHkgPCB4KSB7XG4gICAgcmV0dXJuIDFcbiAgfVxuICByZXR1cm4gMFxufVxuXG4vLyBCVUZGRVIgSU5TVEFOQ0UgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBhc3NlcnQoc3RyTGVuICUgMiA9PT0gMCwgJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBieXRlID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGFzc2VydCghaXNOYU4oYnl0ZSksICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IGJ5dGVcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBiaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICB2YXIgY2hhcnNXcml0dGVuID0gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gdXRmMTZsZVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIFN1cHBvcnQgYm90aCAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpXG4gIC8vIGFuZCB0aGUgbGVnYWN5IChzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBpZiAoIWlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7ICAvLyBsZWdhY3lcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGhcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSB1dGYxNmxlV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4JykudG9Mb3dlckNhc2UoKVxuICBzdGFydCA9IE51bWJlcihzdGFydCkgfHwgMFxuICBlbmQgPSAoZW5kID09PSB1bmRlZmluZWQpID8gc2VsZi5sZW5ndGggOiBOdW1iZXIoZW5kKVxuXG4gIC8vIEZhc3RwYXRoIGVtcHR5IHN0cmluZ3NcbiAgaWYgKGVuZCA9PT0gc3RhcnQpXG4gICAgcmV0dXJuICcnXG5cbiAgdmFyIHJldFxuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IGhleFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgICByZXQgPSBhc2NpaVNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICByZXQgPSBiaW5hcnlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgcmV0ID0gYmFzZTY0U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldCA9IHV0ZjE2bGVTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gKGIpIHtcbiAgYXNzZXJ0KEJ1ZmZlci5pc0J1ZmZlcihiKSwgJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gKGIpIHtcbiAgYXNzZXJ0KEJ1ZmZlci5pc0J1ZmZlcihiKSwgJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYilcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gKHRhcmdldCwgdGFyZ2V0X3N0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIHZhciBzb3VyY2UgPSB0aGlzXG5cbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKCF0YXJnZXRfc3RhcnQpIHRhcmdldF9zdGFydCA9IDBcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCBzb3VyY2UubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGFzc2VydChlbmQgPj0gc3RhcnQsICdzb3VyY2VFbmQgPCBzb3VyY2VTdGFydCcpXG4gIGFzc2VydCh0YXJnZXRfc3RhcnQgPj0gMCAmJiB0YXJnZXRfc3RhcnQgPCB0YXJnZXQubGVuZ3RoLFxuICAgICAgJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBhc3NlcnQoc3RhcnQgPj0gMCAmJiBzdGFydCA8IHNvdXJjZS5sZW5ndGgsICdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KGVuZCA+PSAwICYmIGVuZCA8PSBzb3VyY2UubGVuZ3RoLCAnc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aClcbiAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldF9zdGFydCA8IGVuZCAtIHN0YXJ0KVxuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgKyBzdGFydFxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuXG4gIGlmIChsZW4gPCAxMDAgfHwgIUJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldF9zdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGFyZ2V0Ll9zZXQodGhpcy5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBsZW4pLCB0YXJnZXRfc3RhcnQpXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXMgPSAnJ1xuICB2YXIgdG1wID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgaWYgKGJ1ZltpXSA8PSAweDdGKSB7XG4gICAgICByZXMgKz0gZGVjb2RlVXRmOENoYXIodG1wKSArIFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICAgICAgdG1wID0gJydcbiAgICB9IGVsc2Uge1xuICAgICAgdG1wICs9ICclJyArIGJ1ZltpXS50b1N0cmluZygxNilcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzICsgZGVjb2RlVXRmOENoYXIodG1wKVxufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgcmV0dXJuIGFzY2lpU2xpY2UoYnVmLCBzdGFydCwgZW5kKVxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IGNsYW1wKHN0YXJ0LCBsZW4sIDApXG4gIGVuZCA9IGNsYW1wKGVuZCwgbGVuLCBsZW4pXG5cbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMpIHtcbiAgICByZXR1cm4gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkLCB0cnVlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICAgIHJldHVybiBuZXdCdWZcbiAgfVxufVxuXG4vLyBgZ2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gcmVhZFVJbnQxNiAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAxIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byByZWFkIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIHZhciB2YWxcbiAgaWYgKGxpdHRsZUVuZGlhbikge1xuICAgIHZhbCA9IGJ1ZltvZmZzZXRdXG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdIDw8IDhcbiAgfSBlbHNlIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDEgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDFdXG4gIH1cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkVUludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRVSW50MTYodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHJlYWRVSW50MzIgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICBpZiAob2Zmc2V0ICsgMiA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAyXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gICAgdmFsIHw9IGJ1ZltvZmZzZXRdXG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgPSB2YWwgKyAoYnVmW29mZnNldCArIDNdIDw8IDI0ID4+PiAwKVxuICB9IGVsc2Uge1xuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsID0gYnVmW29mZnNldCArIDFdIDw8IDE2XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDJdIDw8IDhcbiAgICBpZiAob2Zmc2V0ICsgMyA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgM11cbiAgICB2YWwgPSB2YWwgKyAoYnVmW29mZnNldF0gPDwgMjQgPj4+IDApXG4gIH1cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkVUludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRVSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCxcbiAgICAgICAgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIHZhciBuZWcgPSB0aGlzW29mZnNldF0gJiAweDgwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5mdW5jdGlvbiByZWFkSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsID0gcmVhZFVJbnQxNihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwXG4gIGlmIChuZWcpXG4gICAgcmV0dXJuICgweGZmZmYgLSB2YWwgKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZEludDE2KHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZEludDE2KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiByZWFkSW50MzIgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsID0gcmVhZFVJbnQzMihidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCB0cnVlKVxuICB2YXIgbmVnID0gdmFsICYgMHg4MDAwMDAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmZmZmZiAtIHZhbCArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkSW50MzIodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkSW50MzIodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHJlYWRGbG9hdCAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRGbG9hdCh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRGbG9hdCh0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gcmVhZERvdWJsZSAoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICsgNyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICByZXR1cm4gaWVlZTc1NC5yZWFkKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkRG91YmxlKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWREb3VibGUodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuXG5cbiAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gd3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgICAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ3RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZ1aW50KHZhbHVlLCAweGZmZmZmZmZmKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihsZW4gLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID1cbiAgICAgICAgKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgPCB0aGlzLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmLCAtMHg4MClcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgdGhpcy53cml0ZVVJbnQ4KHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgdGhpcy53cml0ZVVJbnQ4KDB4ZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbm9Bc3NlcnQpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIHdyaXRlSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZmZmLCAtMHg4MDAwKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWYgKHZhbHVlID49IDApXG4gICAgd3JpdGVVSW50MTYoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICBlbHNlXG4gICAgd3JpdGVVSW50MTYoYnVmLCAweGZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZzaW50KHZhbHVlLCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHdyaXRlVUludDMyKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHdyaXRlVUludDMyKGJ1ZiwgMHhmZmZmZmZmZiArIHZhbHVlICsgMSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLFxuICAgICAgICAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZklFRUU3NTQodmFsdWUsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgYXNzZXJ0KGVuZCA+PSBzdGFydCwgJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGFzc2VydChzdGFydCA+PSAwICYmIHN0YXJ0IDwgdGhpcy5sZW5ndGgsICdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KGVuZCA+PSAwICYmIGVuZCA8PSB0aGlzLmxlbmd0aCwgJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSB2YWx1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSB1dGY4VG9CeXRlcyh2YWx1ZS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBvdXQgPSBbXVxuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIG91dFtpXSA9IHRvSGV4KHRoaXNbaV0pXG4gICAgaWYgKGkgPT09IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMpIHtcbiAgICAgIG91dFtpICsgMV0gPSAnLi4uJ1xuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBvdXQuam9pbignICcpICsgJz4nXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBgQXJyYXlCdWZmZXJgIHdpdGggdGhlICpjb3BpZWQqIG1lbW9yeSBvZiB0aGUgYnVmZmVyIGluc3RhbmNlLlxuICogQWRkZWQgaW4gTm9kZSAwLjEyLiBPbmx5IGF2YWlsYWJsZSBpbiBicm93c2VycyB0aGF0IHN1cHBvcnQgQXJyYXlCdWZmZXIuXG4gKi9cbkJ1ZmZlci5wcm90b3R5cGUudG9BcnJheUJ1ZmZlciA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgICByZXR1cm4gKG5ldyBCdWZmZXIodGhpcykpLmJ1ZmZlclxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5sZW5ndGgpXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYnVmLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKSB7XG4gICAgICAgIGJ1ZltpXSA9IHRoaXNbaV1cbiAgICAgIH1cbiAgICAgIHJldHVybiBidWYuYnVmZmVyXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcignQnVmZmVyLnRvQXJyYXlCdWZmZXIgbm90IHN1cHBvcnRlZCBpbiB0aGlzIGJyb3dzZXInKVxuICB9XG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIEJQID0gQnVmZmVyLnByb3RvdHlwZVxuXG4vKipcbiAqIEF1Z21lbnQgYSBVaW50OEFycmF5ICppbnN0YW5jZSogKG5vdCB0aGUgVWludDhBcnJheSBjbGFzcyEpIHdpdGggQnVmZmVyIG1ldGhvZHNcbiAqL1xuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX2lzQnVmZmVyID0gdHJ1ZVxuXG4gIC8vIHNhdmUgcmVmZXJlbmNlIHRvIG9yaWdpbmFsIFVpbnQ4QXJyYXkgZ2V0L3NldCBtZXRob2RzIGJlZm9yZSBvdmVyd3JpdGluZ1xuICBhcnIuX2dldCA9IGFyci5nZXRcbiAgYXJyLl9zZXQgPSBhcnIuc2V0XG5cbiAgLy8gZGVwcmVjYXRlZCwgd2lsbCBiZSByZW1vdmVkIGluIG5vZGUgMC4xMytcbiAgYXJyLmdldCA9IEJQLmdldFxuICBhcnIuc2V0ID0gQlAuc2V0XG5cbiAgYXJyLndyaXRlID0gQlAud3JpdGVcbiAgYXJyLnRvU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvTG9jYWxlU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvSlNPTiA9IEJQLnRvSlNPTlxuICBhcnIuZXF1YWxzID0gQlAuZXF1YWxzXG4gIGFyci5jb21wYXJlID0gQlAuY29tcGFyZVxuICBhcnIuY29weSA9IEJQLmNvcHlcbiAgYXJyLnNsaWNlID0gQlAuc2xpY2VcbiAgYXJyLnJlYWRVSW50OCA9IEJQLnJlYWRVSW50OFxuICBhcnIucmVhZFVJbnQxNkxFID0gQlAucmVhZFVJbnQxNkxFXG4gIGFyci5yZWFkVUludDE2QkUgPSBCUC5yZWFkVUludDE2QkVcbiAgYXJyLnJlYWRVSW50MzJMRSA9IEJQLnJlYWRVSW50MzJMRVxuICBhcnIucmVhZFVJbnQzMkJFID0gQlAucmVhZFVJbnQzMkJFXG4gIGFyci5yZWFkSW50OCA9IEJQLnJlYWRJbnQ4XG4gIGFyci5yZWFkSW50MTZMRSA9IEJQLnJlYWRJbnQxNkxFXG4gIGFyci5yZWFkSW50MTZCRSA9IEJQLnJlYWRJbnQxNkJFXG4gIGFyci5yZWFkSW50MzJMRSA9IEJQLnJlYWRJbnQzMkxFXG4gIGFyci5yZWFkSW50MzJCRSA9IEJQLnJlYWRJbnQzMkJFXG4gIGFyci5yZWFkRmxvYXRMRSA9IEJQLnJlYWRGbG9hdExFXG4gIGFyci5yZWFkRmxvYXRCRSA9IEJQLnJlYWRGbG9hdEJFXG4gIGFyci5yZWFkRG91YmxlTEUgPSBCUC5yZWFkRG91YmxlTEVcbiAgYXJyLnJlYWREb3VibGVCRSA9IEJQLnJlYWREb3VibGVCRVxuICBhcnIud3JpdGVVSW50OCA9IEJQLndyaXRlVUludDhcbiAgYXJyLndyaXRlVUludDE2TEUgPSBCUC53cml0ZVVJbnQxNkxFXG4gIGFyci53cml0ZVVJbnQxNkJFID0gQlAud3JpdGVVSW50MTZCRVxuICBhcnIud3JpdGVVSW50MzJMRSA9IEJQLndyaXRlVUludDMyTEVcbiAgYXJyLndyaXRlVUludDMyQkUgPSBCUC53cml0ZVVJbnQzMkJFXG4gIGFyci53cml0ZUludDggPSBCUC53cml0ZUludDhcbiAgYXJyLndyaXRlSW50MTZMRSA9IEJQLndyaXRlSW50MTZMRVxuICBhcnIud3JpdGVJbnQxNkJFID0gQlAud3JpdGVJbnQxNkJFXG4gIGFyci53cml0ZUludDMyTEUgPSBCUC53cml0ZUludDMyTEVcbiAgYXJyLndyaXRlSW50MzJCRSA9IEJQLndyaXRlSW50MzJCRVxuICBhcnIud3JpdGVGbG9hdExFID0gQlAud3JpdGVGbG9hdExFXG4gIGFyci53cml0ZUZsb2F0QkUgPSBCUC53cml0ZUZsb2F0QkVcbiAgYXJyLndyaXRlRG91YmxlTEUgPSBCUC53cml0ZURvdWJsZUxFXG4gIGFyci53cml0ZURvdWJsZUJFID0gQlAud3JpdGVEb3VibGVCRVxuICBhcnIuZmlsbCA9IEJQLmZpbGxcbiAgYXJyLmluc3BlY3QgPSBCUC5pbnNwZWN0XG4gIGFyci50b0FycmF5QnVmZmVyID0gQlAudG9BcnJheUJ1ZmZlclxuXG4gIHJldHVybiBhcnJcbn1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teK1xcLzAtOUEtel0vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbi8vIHNsaWNlKHN0YXJ0LCBlbmQpXG5mdW5jdGlvbiBjbGFtcCAoaW5kZXgsIGxlbiwgZGVmYXVsdFZhbHVlKSB7XG4gIGlmICh0eXBlb2YgaW5kZXggIT09ICdudW1iZXInKSByZXR1cm4gZGVmYXVsdFZhbHVlXG4gIGluZGV4ID0gfn5pbmRleDsgIC8vIENvZXJjZSB0byBpbnRlZ2VyLlxuICBpZiAoaW5kZXggPj0gbGVuKSByZXR1cm4gbGVuXG4gIGlmIChpbmRleCA+PSAwKSByZXR1cm4gaW5kZXhcbiAgaW5kZXggKz0gbGVuXG4gIGlmIChpbmRleCA+PSAwKSByZXR1cm4gaW5kZXhcbiAgcmV0dXJuIDBcbn1cblxuZnVuY3Rpb24gY29lcmNlIChsZW5ndGgpIHtcbiAgLy8gQ29lcmNlIGxlbmd0aCB0byBhIG51bWJlciAocG9zc2libHkgTmFOKSwgcm91bmQgdXBcbiAgLy8gaW4gY2FzZSBpdCdzIGZyYWN0aW9uYWwgKGUuZy4gMTIzLjQ1NikgdGhlbiBkbyBhXG4gIC8vIGRvdWJsZSBuZWdhdGUgdG8gY29lcmNlIGEgTmFOIHRvIDAuIEVhc3ksIHJpZ2h0P1xuICBsZW5ndGggPSB+fk1hdGguY2VpbCgrbGVuZ3RoKVxuICByZXR1cm4gbGVuZ3RoIDwgMCA/IDAgOiBsZW5ndGhcbn1cblxuZnVuY3Rpb24gaXNBcnJheSAoc3ViamVjdCkge1xuICByZXR1cm4gKEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHN1YmplY3QpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN1YmplY3QpID09PSAnW29iamVjdCBBcnJheV0nXG4gIH0pKHN1YmplY3QpXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlpc2ggKHN1YmplY3QpIHtcbiAgcmV0dXJuIGlzQXJyYXkoc3ViamVjdCkgfHwgQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpIHx8XG4gICAgICBzdWJqZWN0ICYmIHR5cGVvZiBzdWJqZWN0ID09PSAnb2JqZWN0JyAmJlxuICAgICAgdHlwZW9mIHN1YmplY3QubGVuZ3RoID09PSAnbnVtYmVyJ1xufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGIgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGlmIChiIDw9IDB4N0YpIHtcbiAgICAgIGJ5dGVBcnJheS5wdXNoKGIpXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBzdGFydCA9IGlcbiAgICAgIGlmIChiID49IDB4RDgwMCAmJiBiIDw9IDB4REZGRikgaSsrXG4gICAgICB2YXIgaCA9IGVuY29kZVVSSUNvbXBvbmVudChzdHIuc2xpY2Uoc3RhcnQsIGkrMSkpLnN1YnN0cigxKS5zcGxpdCgnJScpXG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGgubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgYnl0ZUFycmF5LnB1c2gocGFyc2VJbnQoaFtqXSwgMTYpKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShzdHIpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKVxuICAgICAgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBkZWNvZGVVdGY4Q2hhciAoc3RyKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChzdHIpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4RkZGRCkgLy8gVVRGIDggaW52YWxpZCBjaGFyXG4gIH1cbn1cblxuLypcbiAqIFdlIGhhdmUgdG8gbWFrZSBzdXJlIHRoYXQgdGhlIHZhbHVlIGlzIGEgdmFsaWQgaW50ZWdlci4gVGhpcyBtZWFucyB0aGF0IGl0XG4gKiBpcyBub24tbmVnYXRpdmUuIEl0IGhhcyBubyBmcmFjdGlvbmFsIGNvbXBvbmVudCBhbmQgdGhhdCBpdCBkb2VzIG5vdFxuICogZXhjZWVkIHRoZSBtYXhpbXVtIGFsbG93ZWQgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIHZlcmlmdWludCAodmFsdWUsIG1heCkge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPj0gMCwgJ3NwZWNpZmllZCBhIG5lZ2F0aXZlIHZhbHVlIGZvciB3cml0aW5nIGFuIHVuc2lnbmVkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGlzIGxhcmdlciB0aGFuIG1heGltdW0gdmFsdWUgZm9yIHR5cGUnKVxuICBhc3NlcnQoTWF0aC5mbG9vcih2YWx1ZSkgPT09IHZhbHVlLCAndmFsdWUgaGFzIGEgZnJhY3Rpb25hbCBjb21wb25lbnQnKVxufVxuXG5mdW5jdGlvbiB2ZXJpZnNpbnQgKHZhbHVlLCBtYXgsIG1pbikge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgbGFyZ2VyIHRoYW4gbWF4aW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlID49IG1pbiwgJ3ZhbHVlIHNtYWxsZXIgdGhhbiBtaW5pbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQoTWF0aC5mbG9vcih2YWx1ZSkgPT09IHZhbHVlLCAndmFsdWUgaGFzIGEgZnJhY3Rpb25hbCBjb21wb25lbnQnKVxufVxuXG5mdW5jdGlvbiB2ZXJpZklFRUU3NTQgKHZhbHVlLCBtYXgsIG1pbikge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgbGFyZ2VyIHRoYW4gbWF4aW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlID49IG1pbiwgJ3ZhbHVlIHNtYWxsZXIgdGhhbiBtaW5pbXVtIGFsbG93ZWQgdmFsdWUnKVxufVxuXG5mdW5jdGlvbiBhc3NlcnQgKHRlc3QsIG1lc3NhZ2UpIHtcbiAgaWYgKCF0ZXN0KSB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSB8fCAnRmFpbGVkIGFzc2VydGlvbicpXG59XG4iLCJ2YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuXG47KGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuICB2YXIgQXJyID0gKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJylcbiAgICA/IFVpbnQ4QXJyYXlcbiAgICA6IEFycmF5XG5cblx0dmFyIFBMVVMgICA9ICcrJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSCAgPSAnLycuY2hhckNvZGVBdCgwKVxuXHR2YXIgTlVNQkVSID0gJzAnLmNoYXJDb2RlQXQoMClcblx0dmFyIExPV0VSICA9ICdhJy5jaGFyQ29kZUF0KDApXG5cdHZhciBVUFBFUiAgPSAnQScuY2hhckNvZGVBdCgwKVxuXG5cdGZ1bmN0aW9uIGRlY29kZSAoZWx0KSB7XG5cdFx0dmFyIGNvZGUgPSBlbHQuY2hhckNvZGVBdCgwKVxuXHRcdGlmIChjb2RlID09PSBQTFVTKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSClcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24oYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBuQml0cyA9IC03LFxuICAgICAgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwLFxuICAgICAgZCA9IGlzTEUgPyAtMSA6IDEsXG4gICAgICBzID0gYnVmZmVyW29mZnNldCArIGldO1xuXG4gIGkgKz0gZDtcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKTtcbiAgcyA+Pj0gKC1uQml0cyk7XG4gIG5CaXRzICs9IGVMZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpO1xuICBlID4+PSAoLW5CaXRzKTtcbiAgbkJpdHMgKz0gbUxlbjtcbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCk7XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzO1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSk7XG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICBlID0gZSAtIGVCaWFzO1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pO1xufTtcblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjLFxuICAgICAgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMSxcbiAgICAgIGVNYXggPSAoMSA8PCBlTGVuKSAtIDEsXG4gICAgICBlQmlhcyA9IGVNYXggPj4gMSxcbiAgICAgIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKSxcbiAgICAgIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKSxcbiAgICAgIGQgPSBpc0xFID8gMSA6IC0xLFxuICAgICAgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMDtcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKTtcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMDtcbiAgICBlID0gZU1heDtcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMik7XG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tO1xuICAgICAgYyAqPSAyO1xuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gYztcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpO1xuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrKztcbiAgICAgIGMgLz0gMjtcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwO1xuICAgICAgZSA9IGVNYXg7XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pO1xuICAgICAgZSA9IGUgKyBlQmlhcztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pO1xuICAgICAgZSA9IDA7XG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCk7XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbTtcbiAgZUxlbiArPSBtTGVuO1xuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpO1xuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyODtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2NoYWknKTtcbiIsIi8qIVxuICogY2hhaVxuICogQ29weXJpZ2h0KGMpIDIwMTEtMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbnZhciB1c2VkID0gW11cbiAgLCBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLyohXG4gKiBDaGFpIHZlcnNpb25cbiAqL1xuXG5leHBvcnRzLnZlcnNpb24gPSAnMS45LjEnO1xuXG4vKiFcbiAqIEFzc2VydGlvbiBFcnJvclxuICovXG5cbmV4cG9ydHMuQXNzZXJ0aW9uRXJyb3IgPSByZXF1aXJlKCdhc3NlcnRpb24tZXJyb3InKTtcblxuLyohXG4gKiBVdGlscyBmb3IgcGx1Z2lucyAobm90IGV4cG9ydGVkKVxuICovXG5cbnZhciB1dGlsID0gcmVxdWlyZSgnLi9jaGFpL3V0aWxzJyk7XG5cbi8qKlxuICogIyAudXNlKGZ1bmN0aW9uKVxuICpcbiAqIFByb3ZpZGVzIGEgd2F5IHRvIGV4dGVuZCB0aGUgaW50ZXJuYWxzIG9mIENoYWlcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufVxuICogQHJldHVybnMge3RoaXN9IGZvciBjaGFpbmluZ1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5leHBvcnRzLnVzZSA9IGZ1bmN0aW9uIChmbikge1xuICBpZiAoIX51c2VkLmluZGV4T2YoZm4pKSB7XG4gICAgZm4odGhpcywgdXRpbCk7XG4gICAgdXNlZC5wdXNoKGZuKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyohXG4gKiBDb25maWd1cmF0aW9uXG4gKi9cblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY2hhaS9jb25maWcnKTtcbmV4cG9ydHMuY29uZmlnID0gY29uZmlnO1xuXG4vKiFcbiAqIFByaW1hcnkgYEFzc2VydGlvbmAgcHJvdG90eXBlXG4gKi9cblxudmFyIGFzc2VydGlvbiA9IHJlcXVpcmUoJy4vY2hhaS9hc3NlcnRpb24nKTtcbmV4cG9ydHMudXNlKGFzc2VydGlvbik7XG5cbi8qIVxuICogQ29yZSBBc3NlcnRpb25zXG4gKi9cblxudmFyIGNvcmUgPSByZXF1aXJlKCcuL2NoYWkvY29yZS9hc3NlcnRpb25zJyk7XG5leHBvcnRzLnVzZShjb3JlKTtcblxuLyohXG4gKiBFeHBlY3QgaW50ZXJmYWNlXG4gKi9cblxudmFyIGV4cGVjdCA9IHJlcXVpcmUoJy4vY2hhaS9pbnRlcmZhY2UvZXhwZWN0Jyk7XG5leHBvcnRzLnVzZShleHBlY3QpO1xuXG4vKiFcbiAqIFNob3VsZCBpbnRlcmZhY2VcbiAqL1xuXG52YXIgc2hvdWxkID0gcmVxdWlyZSgnLi9jaGFpL2ludGVyZmFjZS9zaG91bGQnKTtcbmV4cG9ydHMudXNlKHNob3VsZCk7XG5cbi8qIVxuICogQXNzZXJ0IGludGVyZmFjZVxuICovXG5cbnZhciBhc3NlcnQgPSByZXF1aXJlKCcuL2NoYWkvaW50ZXJmYWNlL2Fzc2VydCcpO1xuZXhwb3J0cy51c2UoYXNzZXJ0KTtcbiIsIi8qIVxuICogY2hhaVxuICogaHR0cDovL2NoYWlqcy5jb21cbiAqIENvcHlyaWdodChjKSAyMDExLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2NoYWksIHV0aWwpIHtcbiAgLyohXG4gICAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gICAqL1xuXG4gIHZhciBBc3NlcnRpb25FcnJvciA9IF9jaGFpLkFzc2VydGlvbkVycm9yXG4gICAgLCBmbGFnID0gdXRpbC5mbGFnO1xuXG4gIC8qIVxuICAgKiBNb2R1bGUgZXhwb3J0LlxuICAgKi9cblxuICBfY2hhaS5Bc3NlcnRpb24gPSBBc3NlcnRpb247XG5cbiAgLyohXG4gICAqIEFzc2VydGlvbiBDb25zdHJ1Y3RvclxuICAgKlxuICAgKiBDcmVhdGVzIG9iamVjdCBmb3IgY2hhaW5pbmcuXG4gICAqXG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cblxuICBmdW5jdGlvbiBBc3NlcnRpb24gKG9iaiwgbXNnLCBzdGFjaykge1xuICAgIGZsYWcodGhpcywgJ3NzZmknLCBzdGFjayB8fCBhcmd1bWVudHMuY2FsbGVlKTtcbiAgICBmbGFnKHRoaXMsICdvYmplY3QnLCBvYmopO1xuICAgIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICB9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEFzc2VydGlvbiwgJ2luY2x1ZGVTdGFjaycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc29sZS53YXJuKCdBc3NlcnRpb24uaW5jbHVkZVN0YWNrIGlzIGRlcHJlY2F0ZWQsIHVzZSBjaGFpLmNvbmZpZy5pbmNsdWRlU3RhY2sgaW5zdGVhZC4nKTtcbiAgICAgIHJldHVybiBjb25maWcuaW5jbHVkZVN0YWNrO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgY29uc29sZS53YXJuKCdBc3NlcnRpb24uaW5jbHVkZVN0YWNrIGlzIGRlcHJlY2F0ZWQsIHVzZSBjaGFpLmNvbmZpZy5pbmNsdWRlU3RhY2sgaW5zdGVhZC4nKTtcbiAgICAgIGNvbmZpZy5pbmNsdWRlU3RhY2sgPSB2YWx1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShBc3NlcnRpb24sICdzaG93RGlmZicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc29sZS53YXJuKCdBc3NlcnRpb24uc2hvd0RpZmYgaXMgZGVwcmVjYXRlZCwgdXNlIGNoYWkuY29uZmlnLnNob3dEaWZmIGluc3RlYWQuJyk7XG4gICAgICByZXR1cm4gY29uZmlnLnNob3dEaWZmO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgY29uc29sZS53YXJuKCdBc3NlcnRpb24uc2hvd0RpZmYgaXMgZGVwcmVjYXRlZCwgdXNlIGNoYWkuY29uZmlnLnNob3dEaWZmIGluc3RlYWQuJyk7XG4gICAgICBjb25maWcuc2hvd0RpZmYgPSB2YWx1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICAgIHV0aWwuYWRkUHJvcGVydHkodGhpcy5wcm90b3R5cGUsIG5hbWUsIGZuKTtcbiAgfTtcblxuICBBc3NlcnRpb24uYWRkTWV0aG9kID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gICAgdXRpbC5hZGRNZXRob2QodGhpcy5wcm90b3R5cGUsIG5hbWUsIGZuKTtcbiAgfTtcblxuICBBc3NlcnRpb24uYWRkQ2hhaW5hYmxlTWV0aG9kID0gZnVuY3Rpb24gKG5hbWUsIGZuLCBjaGFpbmluZ0JlaGF2aW9yKSB7XG4gICAgdXRpbC5hZGRDaGFpbmFibGVNZXRob2QodGhpcy5wcm90b3R5cGUsIG5hbWUsIGZuLCBjaGFpbmluZ0JlaGF2aW9yKTtcbiAgfTtcblxuICBBc3NlcnRpb24ub3ZlcndyaXRlUHJvcGVydHkgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgICB1dGlsLm92ZXJ3cml0ZVByb3BlcnR5KHRoaXMucHJvdG90eXBlLCBuYW1lLCBmbik7XG4gIH07XG5cbiAgQXNzZXJ0aW9uLm92ZXJ3cml0ZU1ldGhvZCA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICAgIHV0aWwub3ZlcndyaXRlTWV0aG9kKHRoaXMucHJvdG90eXBlLCBuYW1lLCBmbik7XG4gIH07XG5cbiAgQXNzZXJ0aW9uLm92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZCA9IGZ1bmN0aW9uIChuYW1lLCBmbiwgY2hhaW5pbmdCZWhhdmlvcikge1xuICAgIHV0aWwub3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kKHRoaXMucHJvdG90eXBlLCBuYW1lLCBmbiwgY2hhaW5pbmdCZWhhdmlvcik7XG4gIH07XG5cbiAgLyohXG4gICAqICMjIyAuYXNzZXJ0KGV4cHJlc3Npb24sIG1lc3NhZ2UsIG5lZ2F0ZU1lc3NhZ2UsIGV4cGVjdGVkLCBhY3R1YWwpXG4gICAqXG4gICAqIEV4ZWN1dGVzIGFuIGV4cHJlc3Npb24gYW5kIGNoZWNrIGV4cGVjdGF0aW9ucy4gVGhyb3dzIEFzc2VydGlvbkVycm9yIGZvciByZXBvcnRpbmcgaWYgdGVzdCBkb2Vzbid0IHBhc3MuXG4gICAqXG4gICAqIEBuYW1lIGFzc2VydFxuICAgKiBAcGFyYW0ge1BoaWxvc29waGljYWx9IGV4cHJlc3Npb24gdG8gYmUgdGVzdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIHRvIGRpc3BsYXkgaWYgZmFpbHNcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5lZ2F0ZWRNZXNzYWdlIHRvIGRpc3BsYXkgaWYgbmVnYXRlZCBleHByZXNzaW9uIGZhaWxzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cGVjdGVkIHZhbHVlIChyZW1lbWJlciB0byBjaGVjayBmb3IgbmVnYXRpb24pXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbCAob3B0aW9uYWwpIHdpbGwgZGVmYXVsdCB0byBgdGhpcy5vYmpgXG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLmFzc2VydCA9IGZ1bmN0aW9uIChleHByLCBtc2csIG5lZ2F0ZU1zZywgZXhwZWN0ZWQsIF9hY3R1YWwsIHNob3dEaWZmKSB7XG4gICAgdmFyIG9rID0gdXRpbC50ZXN0KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgaWYgKHRydWUgIT09IHNob3dEaWZmKSBzaG93RGlmZiA9IGZhbHNlO1xuICAgIGlmICh0cnVlICE9PSBjb25maWcuc2hvd0RpZmYpIHNob3dEaWZmID0gZmFsc2U7XG5cbiAgICBpZiAoIW9rKSB7XG4gICAgICB2YXIgbXNnID0gdXRpbC5nZXRNZXNzYWdlKHRoaXMsIGFyZ3VtZW50cylcbiAgICAgICAgLCBhY3R1YWwgPSB1dGlsLmdldEFjdHVhbCh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZywge1xuICAgICAgICAgIGFjdHVhbDogYWN0dWFsXG4gICAgICAgICwgZXhwZWN0ZWQ6IGV4cGVjdGVkXG4gICAgICAgICwgc2hvd0RpZmY6IHNob3dEaWZmXG4gICAgICB9LCAoY29uZmlnLmluY2x1ZGVTdGFjaykgPyB0aGlzLmFzc2VydCA6IGZsYWcodGhpcywgJ3NzZmknKSk7XG4gICAgfVxuICB9O1xuXG4gIC8qIVxuICAgKiAjIyMgLl9vYmpcbiAgICpcbiAgICogUXVpY2sgcmVmZXJlbmNlIHRvIHN0b3JlZCBgYWN0dWFsYCB2YWx1ZSBmb3IgcGx1Z2luIGRldmVsb3BlcnMuXG4gICAqXG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQXNzZXJ0aW9uLnByb3RvdHlwZSwgJ19vYmonLFxuICAgIHsgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICAgIH1cbiAgICAsIHNldDogZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICBmbGFnKHRoaXMsICdvYmplY3QnLCB2YWwpO1xuICAgICAgfVxuICB9KTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcblxuICAvKipcbiAgICogIyMjIGNvbmZpZy5pbmNsdWRlU3RhY2tcbiAgICpcbiAgICogVXNlciBjb25maWd1cmFibGUgcHJvcGVydHksIGluZmx1ZW5jZXMgd2hldGhlciBzdGFjayB0cmFjZVxuICAgKiBpcyBpbmNsdWRlZCBpbiBBc3NlcnRpb24gZXJyb3IgbWVzc2FnZS4gRGVmYXVsdCBvZiBmYWxzZVxuICAgKiBzdXBwcmVzc2VzIHN0YWNrIHRyYWNlIGluIHRoZSBlcnJvciBtZXNzYWdlLlxuICAgKlxuICAgKiAgICAgY2hhaS5jb25maWcuaW5jbHVkZVN0YWNrID0gdHJ1ZTsgIC8vIGVuYWJsZSBzdGFjayBvbiBlcnJvclxuICAgKlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gICBpbmNsdWRlU3RhY2s6IGZhbHNlLFxuXG4gIC8qKlxuICAgKiAjIyMgY29uZmlnLnNob3dEaWZmXG4gICAqXG4gICAqIFVzZXIgY29uZmlndXJhYmxlIHByb3BlcnR5LCBpbmZsdWVuY2VzIHdoZXRoZXIgb3Igbm90XG4gICAqIHRoZSBgc2hvd0RpZmZgIGZsYWcgc2hvdWxkIGJlIGluY2x1ZGVkIGluIHRoZSB0aHJvd25cbiAgICogQXNzZXJ0aW9uRXJyb3JzLiBgZmFsc2VgIHdpbGwgYWx3YXlzIGJlIGBmYWxzZWA7IGB0cnVlYFxuICAgKiB3aWxsIGJlIHRydWUgd2hlbiB0aGUgYXNzZXJ0aW9uIGhhcyByZXF1ZXN0ZWQgYSBkaWZmXG4gICAqIGJlIHNob3duLlxuICAgKlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIHNob3dEaWZmOiB0cnVlLFxuXG4gIC8qKlxuICAgKiAjIyMgY29uZmlnLnRydW5jYXRlVGhyZXNob2xkXG4gICAqXG4gICAqIFVzZXIgY29uZmlndXJhYmxlIHByb3BlcnR5LCBzZXRzIGxlbmd0aCB0aHJlc2hvbGQgZm9yIGFjdHVhbCBhbmRcbiAgICogZXhwZWN0ZWQgdmFsdWVzIGluIGFzc2VydGlvbiBlcnJvcnMuIElmIHRoaXMgdGhyZXNob2xkIGlzIGV4Y2VlZGVkLFxuICAgKiB0aGUgdmFsdWUgaXMgdHJ1bmNhdGVkLlxuICAgKlxuICAgKiBTZXQgaXQgdG8gemVybyBpZiB5b3Ugd2FudCB0byBkaXNhYmxlIHRydW5jYXRpbmcgYWx0b2dldGhlci5cbiAgICpcbiAgICogICAgIGNoYWkuY29uZmlnLnRydW5jYXRlVGhyZXNob2xkID0gMDsgIC8vIGRpc2FibGUgdHJ1bmNhdGluZ1xuICAgKlxuICAgKiBAcGFyYW0ge051bWJlcn1cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgdHJ1bmNhdGVUaHJlc2hvbGQ6IDQwXG5cbn07XG4iLCIvKiFcbiAqIGNoYWlcbiAqIGh0dHA6Ly9jaGFpanMuY29tXG4gKiBDb3B5cmlnaHQoYykgMjAxMS0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY2hhaSwgXykge1xuICB2YXIgQXNzZXJ0aW9uID0gY2hhaS5Bc3NlcnRpb25cbiAgICAsIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ1xuICAgICwgZmxhZyA9IF8uZmxhZztcblxuICAvKipcbiAgICogIyMjIExhbmd1YWdlIENoYWluc1xuICAgKlxuICAgKiBUaGUgZm9sbG93aW5nIGFyZSBwcm92aWRlZCBhcyBjaGFpbmFibGUgZ2V0dGVycyB0b1xuICAgKiBpbXByb3ZlIHRoZSByZWFkYWJpbGl0eSBvZiB5b3VyIGFzc2VydGlvbnMuIFRoZXlcbiAgICogZG8gbm90IHByb3ZpZGUgdGVzdGluZyBjYXBhYmlsaXRpZXMgdW5sZXNzIHRoZXlcbiAgICogaGF2ZSBiZWVuIG92ZXJ3cml0dGVuIGJ5IGEgcGx1Z2luLlxuICAgKlxuICAgKiAqKkNoYWlucyoqXG4gICAqXG4gICAqIC0gdG9cbiAgICogLSBiZVxuICAgKiAtIGJlZW5cbiAgICogLSBpc1xuICAgKiAtIHRoYXRcbiAgICogLSBhbmRcbiAgICogLSBoYXNcbiAgICogLSBoYXZlXG4gICAqIC0gd2l0aFxuICAgKiAtIGF0XG4gICAqIC0gb2ZcbiAgICogLSBzYW1lXG4gICAqXG4gICAqIEBuYW1lIGxhbmd1YWdlIGNoYWluc1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBbICd0bycsICdiZScsICdiZWVuJ1xuICAsICdpcycsICdhbmQnLCAnaGFzJywgJ2hhdmUnXG4gICwgJ3dpdGgnLCAndGhhdCcsICdhdCdcbiAgLCAnb2YnLCAnc2FtZScgXS5mb3JFYWNoKGZ1bmN0aW9uIChjaGFpbikge1xuICAgIEFzc2VydGlvbi5hZGRQcm9wZXJ0eShjaGFpbiwgZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdFxuICAgKlxuICAgKiBOZWdhdGVzIGFueSBvZiBhc3NlcnRpb25zIGZvbGxvd2luZyBpbiB0aGUgY2hhaW4uXG4gICAqXG4gICAqICAgICBleHBlY3QoZm9vKS50by5ub3QuZXF1YWwoJ2JhcicpO1xuICAgKiAgICAgZXhwZWN0KGdvb2RGbikudG8ubm90LnRocm93KEVycm9yKTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogJ2JheicgfSkudG8uaGF2ZS5wcm9wZXJ0eSgnZm9vJylcbiAgICogICAgICAgLmFuZC5ub3QuZXF1YWwoJ2JhcicpO1xuICAgKlxuICAgKiBAbmFtZSBub3RcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdub3QnLCBmdW5jdGlvbiAoKSB7XG4gICAgZmxhZyh0aGlzLCAnbmVnYXRlJywgdHJ1ZSk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLmRlZXBcbiAgICpcbiAgICogU2V0cyB0aGUgYGRlZXBgIGZsYWcsIGxhdGVyIHVzZWQgYnkgdGhlIGBlcXVhbGAgYW5kXG4gICAqIGBwcm9wZXJ0eWAgYXNzZXJ0aW9ucy5cbiAgICpcbiAgICogICAgIGV4cGVjdChmb28pLnRvLmRlZXAuZXF1YWwoeyBiYXI6ICdiYXonIH0pO1xuICAgKiAgICAgZXhwZWN0KHsgZm9vOiB7IGJhcjogeyBiYXo6ICdxdXV4JyB9IH0gfSlcbiAgICogICAgICAgLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgnZm9vLmJhci5iYXonLCAncXV1eCcpO1xuICAgKlxuICAgKiBAbmFtZSBkZWVwXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnZGVlcCcsIGZ1bmN0aW9uICgpIHtcbiAgICBmbGFnKHRoaXMsICdkZWVwJywgdHJ1ZSk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLmEodHlwZSlcbiAgICpcbiAgICogVGhlIGBhYCBhbmQgYGFuYCBhc3NlcnRpb25zIGFyZSBhbGlhc2VzIHRoYXQgY2FuIGJlXG4gICAqIHVzZWQgZWl0aGVyIGFzIGxhbmd1YWdlIGNoYWlucyBvciB0byBhc3NlcnQgYSB2YWx1ZSdzXG4gICAqIHR5cGUuXG4gICAqXG4gICAqICAgICAvLyB0eXBlb2ZcbiAgICogICAgIGV4cGVjdCgndGVzdCcpLnRvLmJlLmEoJ3N0cmluZycpO1xuICAgKiAgICAgZXhwZWN0KHsgZm9vOiAnYmFyJyB9KS50by5iZS5hbignb2JqZWN0Jyk7XG4gICAqICAgICBleHBlY3QobnVsbCkudG8uYmUuYSgnbnVsbCcpO1xuICAgKiAgICAgZXhwZWN0KHVuZGVmaW5lZCkudG8uYmUuYW4oJ3VuZGVmaW5lZCcpO1xuICAgKlxuICAgKiAgICAgLy8gbGFuZ3VhZ2UgY2hhaW5cbiAgICogICAgIGV4cGVjdChmb28pLnRvLmJlLmFuLmluc3RhbmNlb2YoRm9vKTtcbiAgICpcbiAgICogQG5hbWUgYVxuICAgKiBAYWxpYXMgYW5cbiAgICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhbiAodHlwZSwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdHlwZSA9IHR5cGUudG9Mb3dlckNhc2UoKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgYXJ0aWNsZSA9IH5bICdhJywgJ2UnLCAnaScsICdvJywgJ3UnIF0uaW5kZXhPZih0eXBlLmNoYXJBdCgwKSkgPyAnYW4gJyA6ICdhICc7XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdHlwZSA9PT0gXy50eXBlKG9iailcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgJyArIGFydGljbGUgKyB0eXBlXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IG5vdCB0byBiZSAnICsgYXJ0aWNsZSArIHR5cGVcbiAgICApO1xuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZENoYWluYWJsZU1ldGhvZCgnYW4nLCBhbik7XG4gIEFzc2VydGlvbi5hZGRDaGFpbmFibGVNZXRob2QoJ2EnLCBhbik7XG5cbiAgLyoqXG4gICAqICMjIyAuaW5jbHVkZSh2YWx1ZSlcbiAgICpcbiAgICogVGhlIGBpbmNsdWRlYCBhbmQgYGNvbnRhaW5gIGFzc2VydGlvbnMgY2FuIGJlIHVzZWQgYXMgZWl0aGVyIHByb3BlcnR5XG4gICAqIGJhc2VkIGxhbmd1YWdlIGNoYWlucyBvciBhcyBtZXRob2RzIHRvIGFzc2VydCB0aGUgaW5jbHVzaW9uIG9mIGFuIG9iamVjdFxuICAgKiBpbiBhbiBhcnJheSBvciBhIHN1YnN0cmluZyBpbiBhIHN0cmluZy4gV2hlbiB1c2VkIGFzIGxhbmd1YWdlIGNoYWlucyxcbiAgICogdGhleSB0b2dnbGUgdGhlIGBjb250YWluYCBmbGFnIGZvciB0aGUgYGtleXNgIGFzc2VydGlvbi5cbiAgICpcbiAgICogICAgIGV4cGVjdChbMSwyLDNdKS50by5pbmNsdWRlKDIpO1xuICAgKiAgICAgZXhwZWN0KCdmb29iYXInKS50by5jb250YWluKCdmb28nKTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogJ2JhcicsIGhlbGxvOiAndW5pdmVyc2UnIH0pLnRvLmluY2x1ZGUua2V5cygnZm9vJyk7XG4gICAqXG4gICAqIEBuYW1lIGluY2x1ZGVcbiAgICogQGFsaWFzIGNvbnRhaW5cbiAgICogQHBhcmFtIHtPYmplY3R8U3RyaW5nfE51bWJlcn0gb2JqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gaW5jbHVkZUNoYWluaW5nQmVoYXZpb3IgKCkge1xuICAgIGZsYWcodGhpcywgJ2NvbnRhaW5zJywgdHJ1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBpbmNsdWRlICh2YWwsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICB2YXIgZXhwZWN0ZWQgPSBmYWxzZTtcbiAgICBpZiAoXy50eXBlKG9iaikgPT09ICdhcnJheScgJiYgXy50eXBlKHZhbCkgPT09ICdvYmplY3QnKSB7XG4gICAgICBmb3IgKHZhciBpIGluIG9iaikge1xuICAgICAgICBpZiAoXy5lcWwob2JqW2ldLCB2YWwpKSB7XG4gICAgICAgICAgZXhwZWN0ZWQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChfLnR5cGUodmFsKSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGlmICghZmxhZyh0aGlzLCAnbmVnYXRlJykpIHtcbiAgICAgICAgZm9yICh2YXIgayBpbiB2YWwpIG5ldyBBc3NlcnRpb24ob2JqKS5wcm9wZXJ0eShrLCB2YWxba10pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgc3Vic2V0ID0ge31cbiAgICAgIGZvciAodmFyIGsgaW4gdmFsKSBzdWJzZXRba10gPSBvYmpba11cbiAgICAgIGV4cGVjdGVkID0gXy5lcWwoc3Vic2V0LCB2YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHBlY3RlZCA9IG9iaiAmJiB+b2JqLmluZGV4T2YodmFsKVxuICAgIH1cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgZXhwZWN0ZWRcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaW5jbHVkZSAnICsgXy5pbnNwZWN0KHZhbClcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGluY2x1ZGUgJyArIF8uaW5zcGVjdCh2YWwpKTtcbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRDaGFpbmFibGVNZXRob2QoJ2luY2x1ZGUnLCBpbmNsdWRlLCBpbmNsdWRlQ2hhaW5pbmdCZWhhdmlvcik7XG4gIEFzc2VydGlvbi5hZGRDaGFpbmFibGVNZXRob2QoJ2NvbnRhaW4nLCBpbmNsdWRlLCBpbmNsdWRlQ2hhaW5pbmdCZWhhdmlvcik7XG5cbiAgLyoqXG4gICAqICMjIyAub2tcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgdHJ1dGh5LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdldmVydGhpbmcnKS50by5iZS5vaztcbiAgICogICAgIGV4cGVjdCgxKS50by5iZS5vaztcbiAgICogICAgIGV4cGVjdChmYWxzZSkudG8ubm90LmJlLm9rO1xuICAgKiAgICAgZXhwZWN0KHVuZGVmaW5lZCkudG8ubm90LmJlLm9rO1xuICAgKiAgICAgZXhwZWN0KG51bGwpLnRvLm5vdC5iZS5vaztcbiAgICpcbiAgICogQG5hbWUgb2tcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdvaycsIGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgdHJ1dGh5J1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBmYWxzeScpO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC50cnVlXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGB0cnVlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCh0cnVlKS50by5iZS50cnVlO1xuICAgKiAgICAgZXhwZWN0KDEpLnRvLm5vdC5iZS50cnVlO1xuICAgKlxuICAgKiBAbmFtZSB0cnVlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgndHJ1ZScsIGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdHJ1ZSA9PT0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgdHJ1ZSdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgZmFsc2UnXG4gICAgICAsIHRoaXMubmVnYXRlID8gZmFsc2UgOiB0cnVlXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuZmFsc2VcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgYGZhbHNlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdChmYWxzZSkudG8uYmUuZmFsc2U7XG4gICAqICAgICBleHBlY3QoMCkudG8ubm90LmJlLmZhbHNlO1xuICAgKlxuICAgKiBAbmFtZSBmYWxzZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ2ZhbHNlJywgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBmYWxzZSA9PT0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgZmFsc2UnXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIHRydWUnXG4gICAgICAsIHRoaXMubmVnYXRlID8gdHJ1ZSA6IGZhbHNlXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAubnVsbFxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBgbnVsbGAuXG4gICAqXG4gICAqICAgICBleHBlY3QobnVsbCkudG8uYmUubnVsbDtcbiAgICogICAgIGV4cGVjdCh1bmRlZmluZWQpLm5vdC50by5iZS5udWxsO1xuICAgKlxuICAgKiBAbmFtZSBudWxsXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnbnVsbCcsIGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgbnVsbCA9PT0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgbnVsbCdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gbm90IHRvIGJlIG51bGwnXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAudW5kZWZpbmVkXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGB1bmRlZmluZWRgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KHVuZGVmaW5lZCkudG8uYmUudW5kZWZpbmVkO1xuICAgKiAgICAgZXhwZWN0KG51bGwpLnRvLm5vdC5iZS51bmRlZmluZWQ7XG4gICAqXG4gICAqIEBuYW1lIHVuZGVmaW5lZFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ3VuZGVmaW5lZCcsIGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdW5kZWZpbmVkID09PSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSB1bmRlZmluZWQnXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IG5vdCB0byBiZSB1bmRlZmluZWQnXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuZXhpc3RcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgbmVpdGhlciBgbnVsbGAgbm9yIGB1bmRlZmluZWRgLlxuICAgKlxuICAgKiAgICAgdmFyIGZvbyA9ICdoaSdcbiAgICogICAgICAgLCBiYXIgPSBudWxsXG4gICAqICAgICAgICwgYmF6O1xuICAgKlxuICAgKiAgICAgZXhwZWN0KGZvbykudG8uZXhpc3Q7XG4gICAqICAgICBleHBlY3QoYmFyKS50by5ub3QuZXhpc3Q7XG4gICAqICAgICBleHBlY3QoYmF6KS50by5ub3QuZXhpc3Q7XG4gICAqXG4gICAqIEBuYW1lIGV4aXN0XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnZXhpc3QnLCBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIG51bGwgIT0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gZXhpc3QnXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBleGlzdCdcbiAgICApO1xuICB9KTtcblxuXG4gIC8qKlxuICAgKiAjIyMgLmVtcHR5XG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0J3MgbGVuZ3RoIGlzIGAwYC4gRm9yIGFycmF5cywgaXQgY2hlY2tzXG4gICAqIHRoZSBgbGVuZ3RoYCBwcm9wZXJ0eS4gRm9yIG9iamVjdHMsIGl0IGdldHMgdGhlIGNvdW50IG9mXG4gICAqIGVudW1lcmFibGUga2V5cy5cbiAgICpcbiAgICogICAgIGV4cGVjdChbXSkudG8uYmUuZW1wdHk7XG4gICAqICAgICBleHBlY3QoJycpLnRvLmJlLmVtcHR5O1xuICAgKiAgICAgZXhwZWN0KHt9KS50by5iZS5lbXB0eTtcbiAgICpcbiAgICogQG5hbWUgZW1wdHlcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdlbXB0eScsIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgZXhwZWN0ZWQgPSBvYmo7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmopIHx8ICdzdHJpbmcnID09PSB0eXBlb2Ygb2JqZWN0KSB7XG4gICAgICBleHBlY3RlZCA9IG9iai5sZW5ndGg7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgICAgZXhwZWN0ZWQgPSBPYmplY3Qua2V5cyhvYmopLmxlbmd0aDtcbiAgICB9XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgIWV4cGVjdGVkXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGVtcHR5J1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSBub3QgdG8gYmUgZW1wdHknXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuYXJndW1lbnRzXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGFuIGFyZ3VtZW50cyBvYmplY3QuXG4gICAqXG4gICAqICAgICBmdW5jdGlvbiB0ZXN0ICgpIHtcbiAgICogICAgICAgZXhwZWN0KGFyZ3VtZW50cykudG8uYmUuYXJndW1lbnRzO1xuICAgKiAgICAgfVxuICAgKlxuICAgKiBAbmFtZSBhcmd1bWVudHNcbiAgICogQGFsaWFzIEFyZ3VtZW50c1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBjaGVja0FyZ3VtZW50cyAoKSB7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsIHR5cGUgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgJ1tvYmplY3QgQXJndW1lbnRzXScgPT09IHR5cGVcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYXJndW1lbnRzIGJ1dCBnb3QgJyArIHR5cGVcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGJlIGFyZ3VtZW50cydcbiAgICApO1xuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdhcmd1bWVudHMnLCBjaGVja0FyZ3VtZW50cyk7XG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnQXJndW1lbnRzJywgY2hlY2tBcmd1bWVudHMpO1xuXG4gIC8qKlxuICAgKiAjIyMgLmVxdWFsKHZhbHVlKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBzdHJpY3RseSBlcXVhbCAoYD09PWApIHRvIGB2YWx1ZWAuXG4gICAqIEFsdGVybmF0ZWx5LCBpZiB0aGUgYGRlZXBgIGZsYWcgaXMgc2V0LCBhc3NlcnRzIHRoYXRcbiAgICogdGhlIHRhcmdldCBpcyBkZWVwbHkgZXF1YWwgdG8gYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnaGVsbG8nKS50by5lcXVhbCgnaGVsbG8nKTtcbiAgICogICAgIGV4cGVjdCg0MikudG8uZXF1YWwoNDIpO1xuICAgKiAgICAgZXhwZWN0KDEpLnRvLm5vdC5lcXVhbCh0cnVlKTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogJ2JhcicgfSkudG8ubm90LmVxdWFsKHsgZm9vOiAnYmFyJyB9KTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogJ2JhcicgfSkudG8uZGVlcC5lcXVhbCh7IGZvbzogJ2JhcicgfSk7XG4gICAqXG4gICAqIEBuYW1lIGVxdWFsXG4gICAqIEBhbGlhcyBlcXVhbHNcbiAgICogQGFsaWFzIGVxXG4gICAqIEBhbGlhcyBkZWVwLmVxdWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0RXF1YWwgKHZhbCwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIGlmIChmbGFnKHRoaXMsICdkZWVwJykpIHtcbiAgICAgIHJldHVybiB0aGlzLmVxbCh2YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICB2YWwgPT09IG9ialxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGVxdWFsICN7ZXhwfSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgZXF1YWwgI3tleHB9J1xuICAgICAgICAsIHZhbFxuICAgICAgICAsIHRoaXMuX29ialxuICAgICAgICAsIHRydWVcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZXF1YWwnLCBhc3NlcnRFcXVhbCk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2VxdWFscycsIGFzc2VydEVxdWFsKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZXEnLCBhc3NlcnRFcXVhbCk7XG5cbiAgLyoqXG4gICAqICMjIyAuZXFsKHZhbHVlKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBkZWVwbHkgZXF1YWwgdG8gYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCh7IGZvbzogJ2JhcicgfSkudG8uZXFsKHsgZm9vOiAnYmFyJyB9KTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uZXFsKFsgMSwgMiwgMyBdKTtcbiAgICpcbiAgICogQG5hbWUgZXFsXG4gICAqIEBhbGlhcyBlcWxzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0RXFsKG9iaiwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIF8uZXFsKG9iaiwgZmxhZyh0aGlzLCAnb2JqZWN0JykpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGRlZXBseSBlcXVhbCAje2V4cH0nXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBkZWVwbHkgZXF1YWwgI3tleHB9J1xuICAgICAgLCBvYmpcbiAgICAgICwgdGhpcy5fb2JqXG4gICAgICAsIHRydWVcbiAgICApO1xuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZXFsJywgYXNzZXJ0RXFsKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZXFscycsIGFzc2VydEVxbCk7XG5cbiAgLyoqXG4gICAqICMjIyAuYWJvdmUodmFsdWUpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGdyZWF0ZXIgdGhhbiBgdmFsdWVgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KDEwKS50by5iZS5hYm92ZSg1KTtcbiAgICpcbiAgICogQ2FuIGFsc28gYmUgdXNlZCBpbiBjb25qdW5jdGlvbiB3aXRoIGBsZW5ndGhgIHRvXG4gICAqIGFzc2VydCBhIG1pbmltdW0gbGVuZ3RoLiBUaGUgYmVuZWZpdCBiZWluZyBhXG4gICAqIG1vcmUgaW5mb3JtYXRpdmUgZXJyb3IgbWVzc2FnZSB0aGFuIGlmIHRoZSBsZW5ndGhcbiAgICogd2FzIHN1cHBsaWVkIGRpcmVjdGx5LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdmb28nKS50by5oYXZlLmxlbmd0aC5hYm92ZSgyKTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uaGF2ZS5sZW5ndGguYWJvdmUoMik7XG4gICAqXG4gICAqIEBuYW1lIGFib3ZlXG4gICAqIEBhbGlhcyBndFxuICAgKiBAYWxpYXMgZ3JlYXRlclRoYW5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0QWJvdmUgKG4sIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICBpZiAoZmxhZyh0aGlzLCAnZG9MZW5ndGgnKSkge1xuICAgICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgICB2YXIgbGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIGxlbiA+IG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIGFib3ZlICN7ZXhwfSBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaGF2ZSBhIGxlbmd0aCBhYm92ZSAje2V4cH0nXG4gICAgICAgICwgblxuICAgICAgICAsIGxlblxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgb2JqID4gblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGFib3ZlICcgKyBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYXQgbW9zdCAnICsgblxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdhYm92ZScsIGFzc2VydEFib3ZlKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZ3QnLCBhc3NlcnRBYm92ZSk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2dyZWF0ZXJUaGFuJywgYXNzZXJ0QWJvdmUpO1xuXG4gIC8qKlxuICAgKiAjIyMgLmxlYXN0KHZhbHVlKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCgxMCkudG8uYmUuYXQubGVhc3QoMTApO1xuICAgKlxuICAgKiBDYW4gYWxzbyBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggYGxlbmd0aGAgdG9cbiAgICogYXNzZXJ0IGEgbWluaW11bSBsZW5ndGguIFRoZSBiZW5lZml0IGJlaW5nIGFcbiAgICogbW9yZSBpbmZvcm1hdGl2ZSBlcnJvciBtZXNzYWdlIHRoYW4gaWYgdGhlIGxlbmd0aFxuICAgKiB3YXMgc3VwcGxpZWQgZGlyZWN0bHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLm9mLmF0LmxlYXN0KDIpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC5vZi5hdC5sZWFzdCgzKTtcbiAgICpcbiAgICogQG5hbWUgbGVhc3RcbiAgICogQGFsaWFzIGd0ZVxuICAgKiBAcGFyYW0ge051bWJlcn0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRMZWFzdCAobiwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIGlmIChmbGFnKHRoaXMsICdkb0xlbmd0aCcpKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLnByb3BlcnR5KCdsZW5ndGgnKTtcbiAgICAgIHZhciBsZW4gPSBvYmoubGVuZ3RoO1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgbGVuID49IG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIGF0IGxlYXN0ICN7ZXhwfSBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIGJlbG93ICN7ZXhwfSdcbiAgICAgICAgLCBuXG4gICAgICAgICwgbGVuXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBvYmogPj0gblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGF0IGxlYXN0ICcgKyBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYmVsb3cgJyArIG5cbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnbGVhc3QnLCBhc3NlcnRMZWFzdCk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2d0ZScsIGFzc2VydExlYXN0KTtcblxuICAvKipcbiAgICogIyMjIC5iZWxvdyh2YWx1ZSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgbGVzcyB0aGFuIGB2YWx1ZWAuXG4gICAqXG4gICAqICAgICBleHBlY3QoNSkudG8uYmUuYmVsb3coMTApO1xuICAgKlxuICAgKiBDYW4gYWxzbyBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggYGxlbmd0aGAgdG9cbiAgICogYXNzZXJ0IGEgbWF4aW11bSBsZW5ndGguIFRoZSBiZW5lZml0IGJlaW5nIGFcbiAgICogbW9yZSBpbmZvcm1hdGl2ZSBlcnJvciBtZXNzYWdlIHRoYW4gaWYgdGhlIGxlbmd0aFxuICAgKiB3YXMgc3VwcGxpZWQgZGlyZWN0bHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLmJlbG93KDQpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC5iZWxvdyg0KTtcbiAgICpcbiAgICogQG5hbWUgYmVsb3dcbiAgICogQGFsaWFzIGx0XG4gICAqIEBhbGlhcyBsZXNzVGhhblxuICAgKiBAcGFyYW0ge051bWJlcn0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRCZWxvdyAobiwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIGlmIChmbGFnKHRoaXMsICdkb0xlbmd0aCcpKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLnByb3BlcnR5KCdsZW5ndGgnKTtcbiAgICAgIHZhciBsZW4gPSBvYmoubGVuZ3RoO1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgbGVuIDwgblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSBsZW5ndGggYmVsb3cgI3tleHB9IGJ1dCBnb3QgI3thY3R9J1xuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBoYXZlIGEgbGVuZ3RoIGJlbG93ICN7ZXhwfSdcbiAgICAgICAgLCBuXG4gICAgICAgICwgbGVuXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBvYmogPCBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYmVsb3cgJyArIG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhdCBsZWFzdCAnICsgblxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdiZWxvdycsIGFzc2VydEJlbG93KTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnbHQnLCBhc3NlcnRCZWxvdyk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2xlc3NUaGFuJywgYXNzZXJ0QmVsb3cpO1xuXG4gIC8qKlxuICAgKiAjIyMgLm1vc3QodmFsdWUpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGxlc3MgdGhhbiBvciBlcXVhbCB0byBgdmFsdWVgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KDUpLnRvLmJlLmF0Lm1vc3QoNSk7XG4gICAqXG4gICAqIENhbiBhbHNvIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBgbGVuZ3RoYCB0b1xuICAgKiBhc3NlcnQgYSBtYXhpbXVtIGxlbmd0aC4gVGhlIGJlbmVmaXQgYmVpbmcgYVxuICAgKiBtb3JlIGluZm9ybWF0aXZlIGVycm9yIG1lc3NhZ2UgdGhhbiBpZiB0aGUgbGVuZ3RoXG4gICAqIHdhcyBzdXBwbGllZCBkaXJlY3RseS5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnZm9vJykudG8uaGF2ZS5sZW5ndGgub2YuYXQubW9zdCg0KTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uaGF2ZS5sZW5ndGgub2YuYXQubW9zdCgzKTtcbiAgICpcbiAgICogQG5hbWUgbW9zdFxuICAgKiBAYWxpYXMgbHRlXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydE1vc3QgKG4sIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICBpZiAoZmxhZyh0aGlzLCAnZG9MZW5ndGgnKSkge1xuICAgICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgICB2YXIgbGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIGxlbiA8PSBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhIGxlbmd0aCBhdCBtb3N0ICN7ZXhwfSBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIGFib3ZlICN7ZXhwfSdcbiAgICAgICAgLCBuXG4gICAgICAgICwgbGVuXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBvYmogPD0gblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGF0IG1vc3QgJyArIG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhYm92ZSAnICsgblxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdtb3N0JywgYXNzZXJ0TW9zdCk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2x0ZScsIGFzc2VydE1vc3QpO1xuXG4gIC8qKlxuICAgKiAjIyMgLndpdGhpbihzdGFydCwgZmluaXNoKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyB3aXRoaW4gYSByYW5nZS5cbiAgICpcbiAgICogICAgIGV4cGVjdCg3KS50by5iZS53aXRoaW4oNSwxMCk7XG4gICAqXG4gICAqIENhbiBhbHNvIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBgbGVuZ3RoYCB0b1xuICAgKiBhc3NlcnQgYSBsZW5ndGggcmFuZ2UuIFRoZSBiZW5lZml0IGJlaW5nIGFcbiAgICogbW9yZSBpbmZvcm1hdGl2ZSBlcnJvciBtZXNzYWdlIHRoYW4gaWYgdGhlIGxlbmd0aFxuICAgKiB3YXMgc3VwcGxpZWQgZGlyZWN0bHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLndpdGhpbigyLDQpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC53aXRoaW4oMiw0KTtcbiAgICpcbiAgICogQG5hbWUgd2l0aGluXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBzdGFydCBsb3dlcmJvdW5kIGluY2x1c2l2ZVxuICAgKiBAcGFyYW0ge051bWJlcn0gZmluaXNoIHVwcGVyYm91bmQgaW5jbHVzaXZlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnd2l0aGluJywgZnVuY3Rpb24gKHN0YXJ0LCBmaW5pc2gsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCByYW5nZSA9IHN0YXJ0ICsgJy4uJyArIGZpbmlzaDtcbiAgICBpZiAoZmxhZyh0aGlzLCAnZG9MZW5ndGgnKSkge1xuICAgICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgICB2YXIgbGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIGxlbiA+PSBzdGFydCAmJiBsZW4gPD0gZmluaXNoXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhIGxlbmd0aCB3aXRoaW4gJyArIHJhbmdlXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGhhdmUgYSBsZW5ndGggd2l0aGluICcgKyByYW5nZVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgb2JqID49IHN0YXJ0ICYmIG9iaiA8PSBmaW5pc2hcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSB3aXRoaW4gJyArIHJhbmdlXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGJlIHdpdGhpbiAnICsgcmFuZ2VcbiAgICAgICk7XG4gICAgfVxuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5pbnN0YW5jZW9mKGNvbnN0cnVjdG9yKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBhbiBpbnN0YW5jZSBvZiBgY29uc3RydWN0b3JgLlxuICAgKlxuICAgKiAgICAgdmFyIFRlYSA9IGZ1bmN0aW9uIChuYW1lKSB7IHRoaXMubmFtZSA9IG5hbWU7IH1cbiAgICogICAgICAgLCBDaGFpID0gbmV3IFRlYSgnY2hhaScpO1xuICAgKlxuICAgKiAgICAgZXhwZWN0KENoYWkpLnRvLmJlLmFuLmluc3RhbmNlb2YoVGVhKTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uYmUuaW5zdGFuY2VvZihBcnJheSk7XG4gICAqXG4gICAqIEBuYW1lIGluc3RhbmNlb2ZcbiAgICogQHBhcmFtIHtDb25zdHJ1Y3Rvcn0gY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYWxpYXMgaW5zdGFuY2VPZlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRJbnN0YW5jZU9mIChjb25zdHJ1Y3RvciwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG5hbWUgPSBfLmdldE5hbWUoY29uc3RydWN0b3IpO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBmbGFnKHRoaXMsICdvYmplY3QnKSBpbnN0YW5jZW9mIGNvbnN0cnVjdG9yXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGFuIGluc3RhbmNlIG9mICcgKyBuYW1lXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBiZSBhbiBpbnN0YW5jZSBvZiAnICsgbmFtZVxuICAgICk7XG4gIH07XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnaW5zdGFuY2VvZicsIGFzc2VydEluc3RhbmNlT2YpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdpbnN0YW5jZU9mJywgYXNzZXJ0SW5zdGFuY2VPZik7XG5cbiAgLyoqXG4gICAqICMjIyAucHJvcGVydHkobmFtZSwgW3ZhbHVlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaGFzIGEgcHJvcGVydHkgYG5hbWVgLCBvcHRpb25hbGx5IGFzc2VydGluZyB0aGF0XG4gICAqIHRoZSB2YWx1ZSBvZiB0aGF0IHByb3BlcnR5IGlzIHN0cmljdGx5IGVxdWFsIHRvICBgdmFsdWVgLlxuICAgKiBJZiB0aGUgYGRlZXBgIGZsYWcgaXMgc2V0LCB5b3UgY2FuIHVzZSBkb3QtIGFuZCBicmFja2V0LW5vdGF0aW9uIGZvciBkZWVwXG4gICAqIHJlZmVyZW5jZXMgaW50byBvYmplY3RzIGFuZCBhcnJheXMuXG4gICAqXG4gICAqICAgICAvLyBzaW1wbGUgcmVmZXJlbmNpbmdcbiAgICogICAgIHZhciBvYmogPSB7IGZvbzogJ2JhcicgfTtcbiAgICogICAgIGV4cGVjdChvYmopLnRvLmhhdmUucHJvcGVydHkoJ2ZvbycpO1xuICAgKiAgICAgZXhwZWN0KG9iaikudG8uaGF2ZS5wcm9wZXJ0eSgnZm9vJywgJ2JhcicpO1xuICAgKlxuICAgKiAgICAgLy8gZGVlcCByZWZlcmVuY2luZ1xuICAgKiAgICAgdmFyIGRlZXBPYmogPSB7XG4gICAqICAgICAgICAgZ3JlZW46IHsgdGVhOiAnbWF0Y2hhJyB9XG4gICAqICAgICAgICwgdGVhczogWyAnY2hhaScsICdtYXRjaGEnLCB7IHRlYTogJ2tvbmFjaGEnIH0gXVxuICAgKiAgICAgfTtcblxuICAgKiAgICAgZXhwZWN0KGRlZXBPYmopLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgnZ3JlZW4udGVhJywgJ21hdGNoYScpO1xuICAgKiAgICAgZXhwZWN0KGRlZXBPYmopLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgndGVhc1sxXScsICdtYXRjaGEnKTtcbiAgICogICAgIGV4cGVjdChkZWVwT2JqKS50by5oYXZlLmRlZXAucHJvcGVydHkoJ3RlYXNbMl0udGVhJywgJ2tvbmFjaGEnKTtcbiAgICpcbiAgICogWW91IGNhbiBhbHNvIHVzZSBhbiBhcnJheSBhcyB0aGUgc3RhcnRpbmcgcG9pbnQgb2YgYSBgZGVlcC5wcm9wZXJ0eWBcbiAgICogYXNzZXJ0aW9uLCBvciB0cmF2ZXJzZSBuZXN0ZWQgYXJyYXlzLlxuICAgKlxuICAgKiAgICAgdmFyIGFyciA9IFtcbiAgICogICAgICAgICBbICdjaGFpJywgJ21hdGNoYScsICdrb25hY2hhJyBdXG4gICAqICAgICAgICwgWyB7IHRlYTogJ2NoYWknIH1cbiAgICogICAgICAgICAsIHsgdGVhOiAnbWF0Y2hhJyB9XG4gICAqICAgICAgICAgLCB7IHRlYTogJ2tvbmFjaGEnIH0gXVxuICAgKiAgICAgXTtcbiAgICpcbiAgICogICAgIGV4cGVjdChhcnIpLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgnWzBdWzFdJywgJ21hdGNoYScpO1xuICAgKiAgICAgZXhwZWN0KGFycikudG8uaGF2ZS5kZWVwLnByb3BlcnR5KCdbMV1bMl0udGVhJywgJ2tvbmFjaGEnKTtcbiAgICpcbiAgICogRnVydGhlcm1vcmUsIGBwcm9wZXJ0eWAgY2hhbmdlcyB0aGUgc3ViamVjdCBvZiB0aGUgYXNzZXJ0aW9uXG4gICAqIHRvIGJlIHRoZSB2YWx1ZSBvZiB0aGF0IHByb3BlcnR5IGZyb20gdGhlIG9yaWdpbmFsIG9iamVjdC4gVGhpc1xuICAgKiBwZXJtaXRzIGZvciBmdXJ0aGVyIGNoYWluYWJsZSBhc3NlcnRpb25zIG9uIHRoYXQgcHJvcGVydHkuXG4gICAqXG4gICAqICAgICBleHBlY3Qob2JqKS50by5oYXZlLnByb3BlcnR5KCdmb28nKVxuICAgKiAgICAgICAudGhhdC5pcy5hKCdzdHJpbmcnKTtcbiAgICogICAgIGV4cGVjdChkZWVwT2JqKS50by5oYXZlLnByb3BlcnR5KCdncmVlbicpXG4gICAqICAgICAgIC50aGF0LmlzLmFuKCdvYmplY3QnKVxuICAgKiAgICAgICAudGhhdC5kZWVwLmVxdWFscyh7IHRlYTogJ21hdGNoYScgfSk7XG4gICAqICAgICBleHBlY3QoZGVlcE9iaikudG8uaGF2ZS5wcm9wZXJ0eSgndGVhcycpXG4gICAqICAgICAgIC50aGF0LmlzLmFuKCdhcnJheScpXG4gICAqICAgICAgIC53aXRoLmRlZXAucHJvcGVydHkoJ1syXScpXG4gICAqICAgICAgICAgLnRoYXQuZGVlcC5lcXVhbHMoeyB0ZWE6ICdrb25hY2hhJyB9KTtcbiAgICpcbiAgICogQG5hbWUgcHJvcGVydHlcbiAgICogQGFsaWFzIGRlZXAucHJvcGVydHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgKG9wdGlvbmFsKVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEByZXR1cm5zIHZhbHVlIG9mIHByb3BlcnR5IGZvciBjaGFpbmluZ1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdwcm9wZXJ0eScsIGZ1bmN0aW9uIChuYW1lLCB2YWwsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuXG4gICAgdmFyIGRlc2NyaXB0b3IgPSBmbGFnKHRoaXMsICdkZWVwJykgPyAnZGVlcCBwcm9wZXJ0eSAnIDogJ3Byb3BlcnR5ICdcbiAgICAgICwgbmVnYXRlID0gZmxhZyh0aGlzLCAnbmVnYXRlJylcbiAgICAgICwgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgdmFsdWUgPSBmbGFnKHRoaXMsICdkZWVwJylcbiAgICAgICAgPyBfLmdldFBhdGhWYWx1ZShuYW1lLCBvYmopXG4gICAgICAgIDogb2JqW25hbWVdO1xuXG4gICAgaWYgKG5lZ2F0ZSAmJiB1bmRlZmluZWQgIT09IHZhbCkge1xuICAgICAgaWYgKHVuZGVmaW5lZCA9PT0gdmFsdWUpIHtcbiAgICAgICAgbXNnID0gKG1zZyAhPSBudWxsKSA/IG1zZyArICc6ICcgOiAnJztcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyArIF8uaW5zcGVjdChvYmopICsgJyBoYXMgbm8gJyArIGRlc2NyaXB0b3IgKyBfLmluc3BlY3QobmFtZSkpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICB1bmRlZmluZWQgIT09IHZhbHVlXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhICcgKyBkZXNjcmlwdG9yICsgXy5pbnNwZWN0KG5hbWUpXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGhhdmUgJyArIGRlc2NyaXB0b3IgKyBfLmluc3BlY3QobmFtZSkpO1xuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHZhbCkge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgdmFsID09PSB2YWx1ZVxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSAnICsgZGVzY3JpcHRvciArIF8uaW5zcGVjdChuYW1lKSArICcgb2YgI3tleHB9LCBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaGF2ZSBhICcgKyBkZXNjcmlwdG9yICsgXy5pbnNwZWN0KG5hbWUpICsgJyBvZiAje2FjdH0nXG4gICAgICAgICwgdmFsXG4gICAgICAgICwgdmFsdWVcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZmxhZyh0aGlzLCAnb2JqZWN0JywgdmFsdWUpO1xuICB9KTtcblxuXG4gIC8qKlxuICAgKiAjIyMgLm93blByb3BlcnR5KG5hbWUpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGhhcyBhbiBvd24gcHJvcGVydHkgYG5hbWVgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCd0ZXN0JykudG8uaGF2ZS5vd25Qcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAqXG4gICAqIEBuYW1lIG93blByb3BlcnR5XG4gICAqIEBhbGlhcyBoYXZlT3duUHJvcGVydHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRPd25Qcm9wZXJ0eSAobmFtZSwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBvYmouaGFzT3duUHJvcGVydHkobmFtZSlcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBvd24gcHJvcGVydHkgJyArIF8uaW5zcGVjdChuYW1lKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaGF2ZSBvd24gcHJvcGVydHkgJyArIF8uaW5zcGVjdChuYW1lKVxuICAgICk7XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdvd25Qcm9wZXJ0eScsIGFzc2VydE93blByb3BlcnR5KTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnaGF2ZU93blByb3BlcnR5JywgYXNzZXJ0T3duUHJvcGVydHkpO1xuXG4gIC8qKlxuICAgKiAjIyMgLmxlbmd0aCh2YWx1ZSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQncyBgbGVuZ3RoYCBwcm9wZXJ0eSBoYXNcbiAgICogdGhlIGV4cGVjdGVkIHZhbHVlLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgM10pLnRvLmhhdmUubGVuZ3RoKDMpO1xuICAgKiAgICAgZXhwZWN0KCdmb29iYXInKS50by5oYXZlLmxlbmd0aCg2KTtcbiAgICpcbiAgICogQ2FuIGFsc28gYmUgdXNlZCBhcyBhIGNoYWluIHByZWN1cnNvciB0byBhIHZhbHVlXG4gICAqIGNvbXBhcmlzb24gZm9yIHRoZSBsZW5ndGggcHJvcGVydHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLmFib3ZlKDIpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC5hYm92ZSgyKTtcbiAgICogICAgIGV4cGVjdCgnZm9vJykudG8uaGF2ZS5sZW5ndGguYmVsb3coNCk7XG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzIF0pLnRvLmhhdmUubGVuZ3RoLmJlbG93KDQpO1xuICAgKiAgICAgZXhwZWN0KCdmb28nKS50by5oYXZlLmxlbmd0aC53aXRoaW4oMiw0KTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uaGF2ZS5sZW5ndGgud2l0aGluKDIsNCk7XG4gICAqXG4gICAqIEBuYW1lIGxlbmd0aFxuICAgKiBAYWxpYXMgbGVuZ3RoT2ZcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGxlbmd0aFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydExlbmd0aENoYWluICgpIHtcbiAgICBmbGFnKHRoaXMsICdkb0xlbmd0aCcsIHRydWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gYXNzZXJ0TGVuZ3RoIChuLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgdmFyIGxlbiA9IG9iai5sZW5ndGg7XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgbGVuID09IG5cbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhIGxlbmd0aCBvZiAje2V4cH0gYnV0IGdvdCAje2FjdH0nXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBoYXZlIGEgbGVuZ3RoIG9mICN7YWN0fSdcbiAgICAgICwgblxuICAgICAgLCBsZW5cbiAgICApO1xuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZENoYWluYWJsZU1ldGhvZCgnbGVuZ3RoJywgYXNzZXJ0TGVuZ3RoLCBhc3NlcnRMZW5ndGhDaGFpbik7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2xlbmd0aE9mJywgYXNzZXJ0TGVuZ3RoLCBhc3NlcnRMZW5ndGhDaGFpbik7XG5cbiAgLyoqXG4gICAqICMjIyAubWF0Y2gocmVnZXhwKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBtYXRjaGVzIGEgcmVndWxhciBleHByZXNzaW9uLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdmb29iYXInKS50by5tYXRjaCgvXmZvby8pO1xuICAgKlxuICAgKiBAbmFtZSBtYXRjaFxuICAgKiBAcGFyYW0ge1JlZ0V4cH0gUmVndWxhckV4cHJlc3Npb25cbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdtYXRjaCcsIGZ1bmN0aW9uIChyZSwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICByZS5leGVjKG9iailcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbWF0Y2ggJyArIHJlXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IG5vdCB0byBtYXRjaCAnICsgcmVcbiAgICApO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5zdHJpbmcoc3RyaW5nKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHN0cmluZyB0YXJnZXQgY29udGFpbnMgYW5vdGhlciBzdHJpbmcuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2Zvb2JhcicpLnRvLmhhdmUuc3RyaW5nKCdiYXInKTtcbiAgICpcbiAgICogQG5hbWUgc3RyaW5nXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmdcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdzdHJpbmcnLCBmdW5jdGlvbiAoc3RyLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykuaXMuYSgnc3RyaW5nJyk7XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgfm9iai5pbmRleE9mKHN0cilcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gY29udGFpbiAnICsgXy5pbnNwZWN0KHN0cilcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGNvbnRhaW4gJyArIF8uaW5zcGVjdChzdHIpXG4gICAgKTtcbiAgfSk7XG5cblxuICAvKipcbiAgICogIyMjIC5rZXlzKGtleTEsIFtrZXkyXSwgWy4uLl0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGhhcyBleGFjdGx5IHRoZSBnaXZlbiBrZXlzLCBvclxuICAgKiBhc3NlcnRzIHRoZSBpbmNsdXNpb24gb2Ygc29tZSBrZXlzIHdoZW4gdXNpbmcgdGhlXG4gICAqIGBpbmNsdWRlYCBvciBgY29udGFpbmAgbW9kaWZpZXJzLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KHsgZm9vOiAxLCBiYXI6IDIgfSkudG8uaGF2ZS5rZXlzKFsnZm9vJywgJ2JhciddKTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogMSwgYmFyOiAyLCBiYXo6IDMgfSkudG8uY29udGFpbi5rZXlzKCdmb28nLCAnYmFyJyk7XG4gICAqXG4gICAqIEBuYW1lIGtleXNcbiAgICogQGFsaWFzIGtleVxuICAgKiBAcGFyYW0ge1N0cmluZy4uLnxBcnJheX0ga2V5c1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRLZXlzIChrZXlzKSB7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsIHN0clxuICAgICAgLCBvayA9IHRydWU7XG5cbiAgICBrZXlzID0ga2V5cyBpbnN0YW5jZW9mIEFycmF5XG4gICAgICA/IGtleXNcbiAgICAgIDogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgIGlmICgha2V5cy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcigna2V5cyByZXF1aXJlZCcpO1xuXG4gICAgdmFyIGFjdHVhbCA9IE9iamVjdC5rZXlzKG9iailcbiAgICAgICwgbGVuID0ga2V5cy5sZW5ndGg7XG5cbiAgICAvLyBJbmNsdXNpb25cbiAgICBvayA9IGtleXMuZXZlcnkoZnVuY3Rpb24oa2V5KXtcbiAgICAgIHJldHVybiB+YWN0dWFsLmluZGV4T2Yoa2V5KTtcbiAgICB9KTtcblxuICAgIC8vIFN0cmljdFxuICAgIGlmICghZmxhZyh0aGlzLCAnbmVnYXRlJykgJiYgIWZsYWcodGhpcywgJ2NvbnRhaW5zJykpIHtcbiAgICAgIG9rID0gb2sgJiYga2V5cy5sZW5ndGggPT0gYWN0dWFsLmxlbmd0aDtcbiAgICB9XG5cbiAgICAvLyBLZXkgc3RyaW5nXG4gICAgaWYgKGxlbiA+IDEpIHtcbiAgICAgIGtleXMgPSBrZXlzLm1hcChmdW5jdGlvbihrZXkpe1xuICAgICAgICByZXR1cm4gXy5pbnNwZWN0KGtleSk7XG4gICAgICB9KTtcbiAgICAgIHZhciBsYXN0ID0ga2V5cy5wb3AoKTtcbiAgICAgIHN0ciA9IGtleXMuam9pbignLCAnKSArICcsIGFuZCAnICsgbGFzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gXy5pbnNwZWN0KGtleXNbMF0pO1xuICAgIH1cblxuICAgIC8vIEZvcm1cbiAgICBzdHIgPSAobGVuID4gMSA/ICdrZXlzICcgOiAna2V5ICcpICsgc3RyO1xuXG4gICAgLy8gSGF2ZSAvIGluY2x1ZGVcbiAgICBzdHIgPSAoZmxhZyh0aGlzLCAnY29udGFpbnMnKSA/ICdjb250YWluICcgOiAnaGF2ZSAnKSArIHN0cjtcblxuICAgIC8vIEFzc2VydGlvblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBva1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byAnICsgc3RyXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCAnICsgc3RyXG4gICAgKTtcbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2tleXMnLCBhc3NlcnRLZXlzKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgna2V5JywgYXNzZXJ0S2V5cyk7XG5cbiAgLyoqXG4gICAqICMjIyAudGhyb3coY29uc3RydWN0b3IpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgZnVuY3Rpb24gdGFyZ2V0IHdpbGwgdGhyb3cgYSBzcGVjaWZpYyBlcnJvciwgb3Igc3BlY2lmaWMgdHlwZSBvZiBlcnJvclxuICAgKiAoYXMgZGV0ZXJtaW5lZCB1c2luZyBgaW5zdGFuY2VvZmApLCBvcHRpb25hbGx5IHdpdGggYSBSZWdFeHAgb3Igc3RyaW5nIGluY2x1c2lvbiB0ZXN0XG4gICAqIGZvciB0aGUgZXJyb3IncyBtZXNzYWdlLlxuICAgKlxuICAgKiAgICAgdmFyIGVyciA9IG5ldyBSZWZlcmVuY2VFcnJvcignVGhpcyBpcyBhIGJhZCBmdW5jdGlvbi4nKTtcbiAgICogICAgIHZhciBmbiA9IGZ1bmN0aW9uICgpIHsgdGhyb3cgZXJyOyB9XG4gICAqICAgICBleHBlY3QoZm4pLnRvLnRocm93KFJlZmVyZW5jZUVycm9yKTtcbiAgICogICAgIGV4cGVjdChmbikudG8udGhyb3coRXJyb3IpO1xuICAgKiAgICAgZXhwZWN0KGZuKS50by50aHJvdygvYmFkIGZ1bmN0aW9uLyk7XG4gICAqICAgICBleHBlY3QoZm4pLnRvLm5vdC50aHJvdygnZ29vZCBmdW5jdGlvbicpO1xuICAgKiAgICAgZXhwZWN0KGZuKS50by50aHJvdyhSZWZlcmVuY2VFcnJvciwgL2JhZCBmdW5jdGlvbi8pO1xuICAgKiAgICAgZXhwZWN0KGZuKS50by50aHJvdyhlcnIpO1xuICAgKiAgICAgZXhwZWN0KGZuKS50by5ub3QudGhyb3cobmV3IFJhbmdlRXJyb3IoJ091dCBvZiByYW5nZS4nKSk7XG4gICAqXG4gICAqIFBsZWFzZSBub3RlIHRoYXQgd2hlbiBhIHRocm93IGV4cGVjdGF0aW9uIGlzIG5lZ2F0ZWQsIGl0IHdpbGwgY2hlY2sgZWFjaFxuICAgKiBwYXJhbWV0ZXIgaW5kZXBlbmRlbnRseSwgc3RhcnRpbmcgd2l0aCBlcnJvciBjb25zdHJ1Y3RvciB0eXBlLiBUaGUgYXBwcm9wcmlhdGUgd2F5XG4gICAqIHRvIGNoZWNrIGZvciB0aGUgZXhpc3RlbmNlIG9mIGEgdHlwZSBvZiBlcnJvciBidXQgZm9yIGEgbWVzc2FnZSB0aGF0IGRvZXMgbm90IG1hdGNoXG4gICAqIGlzIHRvIHVzZSBgYW5kYC5cbiAgICpcbiAgICogICAgIGV4cGVjdChmbikudG8udGhyb3coUmVmZXJlbmNlRXJyb3IpXG4gICAqICAgICAgICAuYW5kLm5vdC50aHJvdygvZ29vZCBmdW5jdGlvbi8pO1xuICAgKlxuICAgKiBAbmFtZSB0aHJvd1xuICAgKiBAYWxpYXMgdGhyb3dzXG4gICAqIEBhbGlhcyBUaHJvd1xuICAgKiBAcGFyYW0ge0Vycm9yQ29uc3RydWN0b3J9IGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7U3RyaW5nfFJlZ0V4cH0gZXhwZWN0ZWQgZXJyb3IgbWVzc2FnZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRXJyb3IjRXJyb3JfdHlwZXNcbiAgICogQHJldHVybnMgZXJyb3IgZm9yIGNoYWluaW5nIChudWxsIGlmIG5vIGVycm9yKVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRUaHJvd3MgKGNvbnN0cnVjdG9yLCBlcnJNc2csIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS5pcy5hKCdmdW5jdGlvbicpO1xuXG4gICAgdmFyIHRocm93biA9IGZhbHNlXG4gICAgICAsIGRlc2lyZWRFcnJvciA9IG51bGxcbiAgICAgICwgbmFtZSA9IG51bGxcbiAgICAgICwgdGhyb3duRXJyb3IgPSBudWxsO1xuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIGVyck1zZyA9IG51bGw7XG4gICAgICBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgfSBlbHNlIGlmIChjb25zdHJ1Y3RvciAmJiAoY29uc3RydWN0b3IgaW5zdGFuY2VvZiBSZWdFeHAgfHwgJ3N0cmluZycgPT09IHR5cGVvZiBjb25zdHJ1Y3RvcikpIHtcbiAgICAgIGVyck1zZyA9IGNvbnN0cnVjdG9yO1xuICAgICAgY29uc3RydWN0b3IgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAoY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgZGVzaXJlZEVycm9yID0gY29uc3RydWN0b3I7XG4gICAgICBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgICBlcnJNc2cgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvbnN0cnVjdG9yID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBuYW1lID0gY29uc3RydWN0b3IucHJvdG90eXBlLm5hbWUgfHwgY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGlmIChuYW1lID09PSAnRXJyb3InICYmIGNvbnN0cnVjdG9yICE9PSBFcnJvcikge1xuICAgICAgICBuYW1lID0gKG5ldyBjb25zdHJ1Y3RvcigpKS5uYW1lO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIG9iaigpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gZmlyc3QsIGNoZWNrIGRlc2lyZWQgZXJyb3JcbiAgICAgIGlmIChkZXNpcmVkRXJyb3IpIHtcbiAgICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgICBlcnIgPT09IGRlc2lyZWRFcnJvclxuICAgICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gdGhyb3cgI3tleHB9IGJ1dCAje2FjdH0gd2FzIHRocm93bidcbiAgICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCB0aHJvdyAje2V4cH0nXG4gICAgICAgICAgLCAoZGVzaXJlZEVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBkZXNpcmVkRXJyb3IudG9TdHJpbmcoKSA6IGRlc2lyZWRFcnJvcilcbiAgICAgICAgICAsIChlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci50b1N0cmluZygpIDogZXJyKVxuICAgICAgICApO1xuXG4gICAgICAgIGZsYWcodGhpcywgJ29iamVjdCcsIGVycik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuXG4gICAgICAvLyBuZXh0LCBjaGVjayBjb25zdHJ1Y3RvclxuICAgICAgaWYgKGNvbnN0cnVjdG9yKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgICAgZXJyIGluc3RhbmNlb2YgY29uc3RydWN0b3JcbiAgICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHRocm93ICN7ZXhwfSBidXQgI3thY3R9IHdhcyB0aHJvd24nXG4gICAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgdGhyb3cgI3tleHB9IGJ1dCAje2FjdH0gd2FzIHRocm93bidcbiAgICAgICAgICAsIG5hbWVcbiAgICAgICAgICAsIChlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci50b1N0cmluZygpIDogZXJyKVxuICAgICAgICApO1xuXG4gICAgICAgIGlmICghZXJyTXNnKSB7XG4gICAgICAgICAgZmxhZyh0aGlzLCAnb2JqZWN0JywgZXJyKTtcbiAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBuZXh0LCBjaGVjayBtZXNzYWdlXG4gICAgICB2YXIgbWVzc2FnZSA9ICdvYmplY3QnID09PSBfLnR5cGUoZXJyKSAmJiBcIm1lc3NhZ2VcIiBpbiBlcnJcbiAgICAgICAgPyBlcnIubWVzc2FnZVxuICAgICAgICA6ICcnICsgZXJyO1xuXG4gICAgICBpZiAoKG1lc3NhZ2UgIT0gbnVsbCkgJiYgZXJyTXNnICYmIGVyck1zZyBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICAgIGVyck1zZy5leGVjKG1lc3NhZ2UpXG4gICAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byB0aHJvdyBlcnJvciBtYXRjaGluZyAje2V4cH0gYnV0IGdvdCAje2FjdH0nXG4gICAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byB0aHJvdyBlcnJvciBub3QgbWF0Y2hpbmcgI3tleHB9J1xuICAgICAgICAgICwgZXJyTXNnXG4gICAgICAgICAgLCBtZXNzYWdlXG4gICAgICAgICk7XG5cbiAgICAgICAgZmxhZyh0aGlzLCAnb2JqZWN0JywgZXJyKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2UgaWYgKChtZXNzYWdlICE9IG51bGwpICYmIGVyck1zZyAmJiAnc3RyaW5nJyA9PT0gdHlwZW9mIGVyck1zZykge1xuICAgICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICAgIH5tZXNzYWdlLmluZGV4T2YoZXJyTXNnKVxuICAgICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gdGhyb3cgZXJyb3IgaW5jbHVkaW5nICN7ZXhwfSBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHRocm93IGVycm9yIG5vdCBpbmNsdWRpbmcgI3thY3R9J1xuICAgICAgICAgICwgZXJyTXNnXG4gICAgICAgICAgLCBtZXNzYWdlXG4gICAgICAgICk7XG5cbiAgICAgICAgZmxhZyh0aGlzLCAnb2JqZWN0JywgZXJyKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvd24gPSB0cnVlO1xuICAgICAgICB0aHJvd25FcnJvciA9IGVycjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgYWN0dWFsbHlHb3QgPSAnJ1xuICAgICAgLCBleHBlY3RlZFRocm93biA9IG5hbWUgIT09IG51bGxcbiAgICAgICAgPyBuYW1lXG4gICAgICAgIDogZGVzaXJlZEVycm9yXG4gICAgICAgICAgPyAnI3tleHB9JyAvL18uaW5zcGVjdChkZXNpcmVkRXJyb3IpXG4gICAgICAgICAgOiAnYW4gZXJyb3InO1xuXG4gICAgaWYgKHRocm93bikge1xuICAgICAgYWN0dWFsbHlHb3QgPSAnIGJ1dCAje2FjdH0gd2FzIHRocm93bidcbiAgICB9XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdGhyb3duID09PSB0cnVlXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHRocm93ICcgKyBleHBlY3RlZFRocm93biArIGFjdHVhbGx5R290XG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCB0aHJvdyAnICsgZXhwZWN0ZWRUaHJvd24gKyBhY3R1YWxseUdvdFxuICAgICAgLCAoZGVzaXJlZEVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBkZXNpcmVkRXJyb3IudG9TdHJpbmcoKSA6IGRlc2lyZWRFcnJvcilcbiAgICAgICwgKHRocm93bkVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyB0aHJvd25FcnJvci50b1N0cmluZygpIDogdGhyb3duRXJyb3IpXG4gICAgKTtcblxuICAgIGZsYWcodGhpcywgJ29iamVjdCcsIHRocm93bkVycm9yKTtcbiAgfTtcblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCd0aHJvdycsIGFzc2VydFRocm93cyk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ3Rocm93cycsIGFzc2VydFRocm93cyk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ1Rocm93JywgYXNzZXJ0VGhyb3dzKTtcblxuICAvKipcbiAgICogIyMjIC5yZXNwb25kVG8obWV0aG9kKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIG9iamVjdCBvciBjbGFzcyB0YXJnZXQgd2lsbCByZXNwb25kIHRvIGEgbWV0aG9kLlxuICAgKlxuICAgKiAgICAgS2xhc3MucHJvdG90eXBlLmJhciA9IGZ1bmN0aW9uKCl7fTtcbiAgICogICAgIGV4cGVjdChLbGFzcykudG8ucmVzcG9uZFRvKCdiYXInKTtcbiAgICogICAgIGV4cGVjdChvYmopLnRvLnJlc3BvbmRUbygnYmFyJyk7XG4gICAqXG4gICAqIFRvIGNoZWNrIGlmIGEgY29uc3RydWN0b3Igd2lsbCByZXNwb25kIHRvIGEgc3RhdGljIGZ1bmN0aW9uLFxuICAgKiBzZXQgdGhlIGBpdHNlbGZgIGZsYWcuXG4gICAqXG4gICAqICAgICBLbGFzcy5iYXogPSBmdW5jdGlvbigpe307XG4gICAqICAgICBleHBlY3QoS2xhc3MpLml0c2VsZi50by5yZXNwb25kVG8oJ2JheicpO1xuICAgKlxuICAgKiBAbmFtZSByZXNwb25kVG9cbiAgICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ3Jlc3BvbmRUbycsIGZ1bmN0aW9uIChtZXRob2QsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCBpdHNlbGYgPSBmbGFnKHRoaXMsICdpdHNlbGYnKVxuICAgICAgLCBjb250ZXh0ID0gKCdmdW5jdGlvbicgPT09IF8udHlwZShvYmopICYmICFpdHNlbGYpXG4gICAgICAgID8gb2JqLnByb3RvdHlwZVttZXRob2RdXG4gICAgICAgIDogb2JqW21ldGhvZF07XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRleHRcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gcmVzcG9uZCB0byAnICsgXy5pbnNwZWN0KG1ldGhvZClcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IHJlc3BvbmQgdG8gJyArIF8uaW5zcGVjdChtZXRob2QpXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuaXRzZWxmXG4gICAqXG4gICAqIFNldHMgdGhlIGBpdHNlbGZgIGZsYWcsIGxhdGVyIHVzZWQgYnkgdGhlIGByZXNwb25kVG9gIGFzc2VydGlvbi5cbiAgICpcbiAgICogICAgIGZ1bmN0aW9uIEZvbygpIHt9XG4gICAqICAgICBGb28uYmFyID0gZnVuY3Rpb24oKSB7fVxuICAgKiAgICAgRm9vLnByb3RvdHlwZS5iYXogPSBmdW5jdGlvbigpIHt9XG4gICAqXG4gICAqICAgICBleHBlY3QoRm9vKS5pdHNlbGYudG8ucmVzcG9uZFRvKCdiYXInKTtcbiAgICogICAgIGV4cGVjdChGb28pLml0c2VsZi5ub3QudG8ucmVzcG9uZFRvKCdiYXonKTtcbiAgICpcbiAgICogQG5hbWUgaXRzZWxmXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnaXRzZWxmJywgZnVuY3Rpb24gKCkge1xuICAgIGZsYWcodGhpcywgJ2l0c2VsZicsIHRydWUpO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5zYXRpc2Z5KG1ldGhvZClcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgcGFzc2VzIGEgZ2l2ZW4gdHJ1dGggdGVzdC5cbiAgICpcbiAgICogICAgIGV4cGVjdCgxKS50by5zYXRpc2Z5KGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gbnVtID4gMDsgfSk7XG4gICAqXG4gICAqIEBuYW1lIHNhdGlzZnlcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbWF0Y2hlclxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ3NhdGlzZnknLCBmdW5jdGlvbiAobWF0Y2hlciwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBtYXRjaGVyKG9iailcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gc2F0aXNmeSAnICsgXy5vYmpEaXNwbGF5KG1hdGNoZXIpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBzYXRpc2Z5JyArIF8ub2JqRGlzcGxheShtYXRjaGVyKVxuICAgICAgLCB0aGlzLm5lZ2F0ZSA/IGZhbHNlIDogdHJ1ZVxuICAgICAgLCBtYXRjaGVyKG9iailcbiAgICApO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5jbG9zZVRvKGV4cGVjdGVkLCBkZWx0YSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgZXF1YWwgYGV4cGVjdGVkYCwgdG8gd2l0aGluIGEgKy8tIGBkZWx0YWAgcmFuZ2UuXG4gICAqXG4gICAqICAgICBleHBlY3QoMS41KS50by5iZS5jbG9zZVRvKDEsIDAuNSk7XG4gICAqXG4gICAqIEBuYW1lIGNsb3NlVG9cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBkZWx0YVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2Nsb3NlVG8nLCBmdW5jdGlvbiAoZXhwZWN0ZWQsIGRlbHRhLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIE1hdGguYWJzKG9iaiAtIGV4cGVjdGVkKSA8PSBkZWx0YVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBjbG9zZSB0byAnICsgZXhwZWN0ZWQgKyAnICsvLSAnICsgZGVsdGFcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gbm90IHRvIGJlIGNsb3NlIHRvICcgKyBleHBlY3RlZCArICcgKy8tICcgKyBkZWx0YVxuICAgICk7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGlzU3Vic2V0T2Yoc3Vic2V0LCBzdXBlcnNldCwgY21wKSB7XG4gICAgcmV0dXJuIHN1YnNldC5ldmVyeShmdW5jdGlvbihlbGVtKSB7XG4gICAgICBpZiAoIWNtcCkgcmV0dXJuIHN1cGVyc2V0LmluZGV4T2YoZWxlbSkgIT09IC0xO1xuXG4gICAgICByZXR1cm4gc3VwZXJzZXQuc29tZShmdW5jdGlvbihlbGVtMikge1xuICAgICAgICByZXR1cm4gY21wKGVsZW0sIGVsZW0yKTtcbiAgICAgIH0pO1xuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogIyMjIC5tZW1iZXJzKHNldClcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgYSBzdXBlcnNldCBvZiBgc2V0YCxcbiAgICogb3IgdGhhdCB0aGUgdGFyZ2V0IGFuZCBgc2V0YCBoYXZlIHRoZSBzYW1lIHN0cmljdGx5LWVxdWFsICg9PT0pIG1lbWJlcnMuXG4gICAqIEFsdGVybmF0ZWx5LCBpZiB0aGUgYGRlZXBgIGZsYWcgaXMgc2V0LCBzZXQgbWVtYmVycyBhcmUgY29tcGFyZWQgZm9yIGRlZXBcbiAgICogZXF1YWxpdHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoWzEsIDIsIDNdKS50by5pbmNsdWRlLm1lbWJlcnMoWzMsIDJdKTtcbiAgICogICAgIGV4cGVjdChbMSwgMiwgM10pLnRvLm5vdC5pbmNsdWRlLm1lbWJlcnMoWzMsIDIsIDhdKTtcbiAgICpcbiAgICogICAgIGV4cGVjdChbNCwgMl0pLnRvLmhhdmUubWVtYmVycyhbMiwgNF0pO1xuICAgKiAgICAgZXhwZWN0KFs1LCAyXSkudG8ubm90LmhhdmUubWVtYmVycyhbNSwgMiwgMV0pO1xuICAgKlxuICAgKiAgICAgZXhwZWN0KFt7IGlkOiAxIH1dKS50by5kZWVwLmluY2x1ZGUubWVtYmVycyhbeyBpZDogMSB9XSk7XG4gICAqXG4gICAqIEBuYW1lIG1lbWJlcnNcbiAgICogQHBhcmFtIHtBcnJheX0gc2V0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnbWVtYmVycycsIGZ1bmN0aW9uIChzdWJzZXQsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcblxuICAgIG5ldyBBc3NlcnRpb24ob2JqKS50by5iZS5hbignYXJyYXknKTtcbiAgICBuZXcgQXNzZXJ0aW9uKHN1YnNldCkudG8uYmUuYW4oJ2FycmF5Jyk7XG5cbiAgICB2YXIgY21wID0gZmxhZyh0aGlzLCAnZGVlcCcpID8gXy5lcWwgOiB1bmRlZmluZWQ7XG5cbiAgICBpZiAoZmxhZyh0aGlzLCAnY29udGFpbnMnKSkge1xuICAgICAgcmV0dXJuIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIGlzU3Vic2V0T2Yoc3Vic2V0LCBvYmosIGNtcClcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhIHN1cGVyc2V0IG9mICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgYmUgYSBzdXBlcnNldCBvZiAje2FjdH0nXG4gICAgICAgICwgb2JqXG4gICAgICAgICwgc3Vic2V0XG4gICAgICApO1xuICAgIH1cblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBpc1N1YnNldE9mKG9iaiwgc3Vic2V0LCBjbXApICYmIGlzU3Vic2V0T2Yoc3Vic2V0LCBvYmosIGNtcClcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIHRoZSBzYW1lIG1lbWJlcnMgYXMgI3thY3R9J1xuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBoYXZlIHRoZSBzYW1lIG1lbWJlcnMgYXMgI3thY3R9J1xuICAgICAgICAsIG9ialxuICAgICAgICAsIHN1YnNldFxuICAgICk7XG4gIH0pO1xufTtcbiIsIi8qIVxuICogY2hhaVxuICogQ29weXJpZ2h0KGMpIDIwMTEtMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY2hhaSwgdXRpbCkge1xuXG4gIC8qIVxuICAgKiBDaGFpIGRlcGVuZGVuY2llcy5cbiAgICovXG5cbiAgdmFyIEFzc2VydGlvbiA9IGNoYWkuQXNzZXJ0aW9uXG4gICAgLCBmbGFnID0gdXRpbC5mbGFnO1xuXG4gIC8qIVxuICAgKiBNb2R1bGUgZXhwb3J0LlxuICAgKi9cblxuICAvKipcbiAgICogIyMjIGFzc2VydChleHByZXNzaW9uLCBtZXNzYWdlKVxuICAgKlxuICAgKiBXcml0ZSB5b3VyIG93biB0ZXN0IGV4cHJlc3Npb25zLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0KCdmb28nICE9PSAnYmFyJywgJ2ZvbyBpcyBub3QgYmFyJyk7XG4gICAqICAgICBhc3NlcnQoQXJyYXkuaXNBcnJheShbXSksICdlbXB0eSBhcnJheXMgYXJlIGFycmF5cycpO1xuICAgKlxuICAgKiBAcGFyYW0ge01peGVkfSBleHByZXNzaW9uIHRvIHRlc3QgZm9yIHRydXRoaW5lc3NcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgdG8gZGlzcGxheSBvbiBlcnJvclxuICAgKiBAbmFtZSBhc3NlcnRcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgdmFyIGFzc2VydCA9IGNoYWkuYXNzZXJ0ID0gZnVuY3Rpb24gKGV4cHJlc3MsIGVycm1zZykge1xuICAgIHZhciB0ZXN0ID0gbmV3IEFzc2VydGlvbihudWxsLCBudWxsLCBjaGFpLmFzc2VydCk7XG4gICAgdGVzdC5hc3NlcnQoXG4gICAgICAgIGV4cHJlc3NcbiAgICAgICwgZXJybXNnXG4gICAgICAsICdbIG5lZ2F0aW9uIG1lc3NhZ2UgdW5hdmFpbGFibGUgXSdcbiAgICApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmZhaWwoYWN0dWFsLCBleHBlY3RlZCwgW21lc3NhZ2VdLCBbb3BlcmF0b3JdKVxuICAgKlxuICAgKiBUaHJvdyBhIGZhaWx1cmUuIE5vZGUuanMgYGFzc2VydGAgbW9kdWxlLWNvbXBhdGlibGUuXG4gICAqXG4gICAqIEBuYW1lIGZhaWxcbiAgICogQHBhcmFtIHtNaXhlZH0gYWN0dWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcGVyYXRvclxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuZmFpbCA9IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCBvcGVyYXRvcikge1xuICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8ICdhc3NlcnQuZmFpbCgpJztcbiAgICB0aHJvdyBuZXcgY2hhaS5Bc3NlcnRpb25FcnJvcihtZXNzYWdlLCB7XG4gICAgICAgIGFjdHVhbDogYWN0dWFsXG4gICAgICAsIGV4cGVjdGVkOiBleHBlY3RlZFxuICAgICAgLCBvcGVyYXRvcjogb3BlcmF0b3JcbiAgICB9LCBhc3NlcnQuZmFpbCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAub2sob2JqZWN0LCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBpcyB0cnV0aHkuXG4gICAqXG4gICAqICAgICBhc3NlcnQub2soJ2V2ZXJ5dGhpbmcnLCAnZXZlcnl0aGluZyBpcyBvaycpO1xuICAgKiAgICAgYXNzZXJ0Lm9rKGZhbHNlLCAndGhpcyB3aWxsIGZhaWwnKTtcbiAgICpcbiAgICogQG5hbWUgb2tcbiAgICogQHBhcmFtIHtNaXhlZH0gb2JqZWN0IHRvIHRlc3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm9rID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykuaXMub2s7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90T2sob2JqZWN0LCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBpcyBmYWxzeS5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3RPaygnZXZlcnl0aGluZycsICd0aGlzIHdpbGwgZmFpbCcpO1xuICAgKiAgICAgYXNzZXJ0Lm5vdE9rKGZhbHNlLCAndGhpcyB3aWxsIHBhc3MnKTtcbiAgICpcbiAgICogQG5hbWUgbm90T2tcbiAgICogQHBhcmFtIHtNaXhlZH0gb2JqZWN0IHRvIHRlc3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdE9rID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykuaXMubm90Lm9rO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyBub24tc3RyaWN0IGVxdWFsaXR5IChgPT1gKSBvZiBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5lcXVhbCgzLCAnMycsICc9PSBjb2VyY2VzIHZhbHVlcyB0byBzdHJpbmdzJyk7XG4gICAqXG4gICAqIEBuYW1lIGVxdWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuZXF1YWwgPSBmdW5jdGlvbiAoYWN0LCBleHAsIG1zZykge1xuICAgIHZhciB0ZXN0ID0gbmV3IEFzc2VydGlvbihhY3QsIG1zZywgYXNzZXJ0LmVxdWFsKTtcblxuICAgIHRlc3QuYXNzZXJ0KFxuICAgICAgICBleHAgPT0gZmxhZyh0ZXN0LCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gZXF1YWwgI3tleHB9J1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgZXF1YWwgI3thY3R9J1xuICAgICAgLCBleHBcbiAgICAgICwgYWN0XG4gICAgKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgbm9uLXN0cmljdCBpbmVxdWFsaXR5IChgIT1gKSBvZiBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3RFcXVhbCgzLCA0LCAndGhlc2UgbnVtYmVycyBhcmUgbm90IGVxdWFsJyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdEVxdWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90RXF1YWwgPSBmdW5jdGlvbiAoYWN0LCBleHAsIG1zZykge1xuICAgIHZhciB0ZXN0ID0gbmV3IEFzc2VydGlvbihhY3QsIG1zZywgYXNzZXJ0Lm5vdEVxdWFsKTtcblxuICAgIHRlc3QuYXNzZXJ0KFxuICAgICAgICBleHAgIT0gZmxhZyh0ZXN0LCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGVxdWFsICN7ZXhwfSdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gZXF1YWwgI3thY3R9J1xuICAgICAgLCBleHBcbiAgICAgICwgYWN0XG4gICAgKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgc3RyaWN0IGVxdWFsaXR5IChgPT09YCkgb2YgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQuc3RyaWN0RXF1YWwodHJ1ZSwgdHJ1ZSwgJ3RoZXNlIGJvb2xlYW5zIGFyZSBzdHJpY3RseSBlcXVhbCcpO1xuICAgKlxuICAgKiBAbmFtZSBzdHJpY3RFcXVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBhY3R1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LnN0cmljdEVxdWFsID0gZnVuY3Rpb24gKGFjdCwgZXhwLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGFjdCwgbXNnKS50by5lcXVhbChleHApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyBzdHJpY3QgaW5lcXVhbGl0eSAoYCE9PWApIG9mIGBhY3R1YWxgIGFuZCBgZXhwZWN0ZWRgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm5vdFN0cmljdEVxdWFsKDMsICczJywgJ25vIGNvZXJjaW9uIGZvciBzdHJpY3QgZXF1YWxpdHknKTtcbiAgICpcbiAgICogQG5hbWUgbm90U3RyaWN0RXF1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gYWN0dWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3RTdHJpY3RFcXVhbCA9IGZ1bmN0aW9uIChhY3QsIGV4cCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihhY3QsIG1zZykudG8ubm90LmVxdWFsKGV4cCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuZGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBhY3R1YWxgIGlzIGRlZXBseSBlcXVhbCB0byBgZXhwZWN0ZWRgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmRlZXBFcXVhbCh7IHRlYTogJ2dyZWVuJyB9LCB7IHRlYTogJ2dyZWVuJyB9KTtcbiAgICpcbiAgICogQG5hbWUgZGVlcEVxdWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuZGVlcEVxdWFsID0gZnVuY3Rpb24gKGFjdCwgZXhwLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGFjdCwgbXNnKS50by5lcWwoZXhwKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3REZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnQgdGhhdCBgYWN0dWFsYCBpcyBub3QgZGVlcGx5IGVxdWFsIHRvIGBleHBlY3RlZGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQubm90RGVlcEVxdWFsKHsgdGVhOiAnZ3JlZW4nIH0sIHsgdGVhOiAnamFzbWluZScgfSk7XG4gICAqXG4gICAqIEBuYW1lIG5vdERlZXBFcXVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBhY3R1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdERlZXBFcXVhbCA9IGZ1bmN0aW9uIChhY3QsIGV4cCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihhY3QsIG1zZykudG8ubm90LmVxbChleHApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzVHJ1ZSh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyB0cnVlLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYVNlcnZlZCA9IHRydWU7XG4gICAqICAgICBhc3NlcnQuaXNUcnVlKHRlYVNlcnZlZCwgJ3RoZSB0ZWEgaGFzIGJlZW4gc2VydmVkJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzVHJ1ZVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNUcnVlID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykuaXNbJ3RydWUnXTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc0ZhbHNlKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGZhbHNlLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYVNlcnZlZCA9IGZhbHNlO1xuICAgKiAgICAgYXNzZXJ0LmlzRmFsc2UodGVhU2VydmVkLCAnbm8gdGVhIHlldD8gaG1tLi4uJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzRmFsc2VcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzRmFsc2UgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS5pc1snZmFsc2UnXTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc051bGwodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgbnVsbC5cbiAgICpcbiAgICogICAgIGFzc2VydC5pc051bGwoZXJyLCAndGhlcmUgd2FzIG5vIGVycm9yJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzTnVsbFxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNOdWxsID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uZXF1YWwobnVsbCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOb3ROdWxsKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIG5vdCBudWxsLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYSA9ICd0YXN0eSBjaGFpJztcbiAgICogICAgIGFzc2VydC5pc05vdE51bGwodGVhLCAnZ3JlYXQsIHRpbWUgZm9yIHRlYSEnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOb3ROdWxsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc05vdE51bGwgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuZXF1YWwobnVsbCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNVbmRlZmluZWQodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYHVuZGVmaW5lZGAuXG4gICAqXG4gICAqICAgICB2YXIgdGVhO1xuICAgKiAgICAgYXNzZXJ0LmlzVW5kZWZpbmVkKHRlYSwgJ25vIHRlYSBkZWZpbmVkJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzVW5kZWZpbmVkXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc1VuZGVmaW5lZCA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmVxdWFsKHVuZGVmaW5lZCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNEZWZpbmVkKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIG5vdCBgdW5kZWZpbmVkYC5cbiAgICpcbiAgICogICAgIHZhciB0ZWEgPSAnY3VwIG9mIGNoYWknO1xuICAgKiAgICAgYXNzZXJ0LmlzRGVmaW5lZCh0ZWEsICd0ZWEgaGFzIGJlZW4gZGVmaW5lZCcpO1xuICAgKlxuICAgKiBAbmFtZSBpc0RlZmluZWRcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzRGVmaW5lZCA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5lcXVhbCh1bmRlZmluZWQpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzRnVuY3Rpb24odmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYSBmdW5jdGlvbi5cbiAgICpcbiAgICogICAgIGZ1bmN0aW9uIHNlcnZlVGVhKCkgeyByZXR1cm4gJ2N1cCBvZiB0ZWEnOyB9O1xuICAgKiAgICAgYXNzZXJ0LmlzRnVuY3Rpb24oc2VydmVUZWEsICdncmVhdCwgd2UgY2FuIGhhdmUgdGVhIG5vdycpO1xuICAgKlxuICAgKiBAbmFtZSBpc0Z1bmN0aW9uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc0Z1bmN0aW9uID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uYmUuYSgnZnVuY3Rpb24nKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc05vdEZ1bmN0aW9uKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIF9ub3RfIGEgZnVuY3Rpb24uXG4gICAqXG4gICAqICAgICB2YXIgc2VydmVUZWEgPSBbICdoZWF0JywgJ3BvdXInLCAnc2lwJyBdO1xuICAgKiAgICAgYXNzZXJ0LmlzTm90RnVuY3Rpb24oc2VydmVUZWEsICdncmVhdCwgd2UgaGF2ZSBsaXN0ZWQgdGhlIHN0ZXBzJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzTm90RnVuY3Rpb25cbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTm90RnVuY3Rpb24gPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUuYSgnZnVuY3Rpb24nKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc09iamVjdCh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBhbiBvYmplY3QgKGFzIHJldmVhbGVkIGJ5XG4gICAqIGBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nYCkuXG4gICAqXG4gICAqICAgICB2YXIgc2VsZWN0aW9uID0geyBuYW1lOiAnQ2hhaScsIHNlcnZlOiAnd2l0aCBzcGljZXMnIH07XG4gICAqICAgICBhc3NlcnQuaXNPYmplY3Qoc2VsZWN0aW9uLCAndGVhIHNlbGVjdGlvbiBpcyBhbiBvYmplY3QnKTtcbiAgICpcbiAgICogQG5hbWUgaXNPYmplY3RcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzT2JqZWN0ID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uYmUuYSgnb2JqZWN0Jyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOb3RPYmplY3QodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgX25vdF8gYW4gb2JqZWN0LlxuICAgKlxuICAgKiAgICAgdmFyIHNlbGVjdGlvbiA9ICdjaGFpJ1xuICAgKiAgICAgYXNzZXJ0LmlzTm90T2JqZWN0KHNlbGVjdGlvbiwgJ3RlYSBzZWxlY3Rpb24gaXMgbm90IGFuIG9iamVjdCcpO1xuICAgKiAgICAgYXNzZXJ0LmlzTm90T2JqZWN0KG51bGwsICdudWxsIGlzIG5vdCBhbiBvYmplY3QnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOb3RPYmplY3RcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTm90T2JqZWN0ID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmEoJ29iamVjdCcpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzQXJyYXkodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYW4gYXJyYXkuXG4gICAqXG4gICAqICAgICB2YXIgbWVudSA9IFsgJ2dyZWVuJywgJ2NoYWknLCAnb29sb25nJyBdO1xuICAgKiAgICAgYXNzZXJ0LmlzQXJyYXkobWVudSwgJ3doYXQga2luZCBvZiB0ZWEgZG8gd2Ugd2FudD8nKTtcbiAgICpcbiAgICogQG5hbWUgaXNBcnJheVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNBcnJheSA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmJlLmFuKCdhcnJheScpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTm90QXJyYXkodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgX25vdF8gYW4gYXJyYXkuXG4gICAqXG4gICAqICAgICB2YXIgbWVudSA9ICdncmVlbnxjaGFpfG9vbG9uZyc7XG4gICAqICAgICBhc3NlcnQuaXNOb3RBcnJheShtZW51LCAnd2hhdCBraW5kIG9mIHRlYSBkbyB3ZSB3YW50PycpO1xuICAgKlxuICAgKiBAbmFtZSBpc05vdEFycmF5XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc05vdEFycmF5ID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmFuKCdhcnJheScpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzU3RyaW5nKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGEgc3RyaW5nLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYU9yZGVyID0gJ2NoYWknO1xuICAgKiAgICAgYXNzZXJ0LmlzU3RyaW5nKHRlYU9yZGVyLCAnb3JkZXIgcGxhY2VkJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzU3RyaW5nXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc1N0cmluZyA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmJlLmEoJ3N0cmluZycpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTm90U3RyaW5nKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIF9ub3RfIGEgc3RyaW5nLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYU9yZGVyID0gNDtcbiAgICogICAgIGFzc2VydC5pc05vdFN0cmluZyh0ZWFPcmRlciwgJ29yZGVyIHBsYWNlZCcpO1xuICAgKlxuICAgKiBAbmFtZSBpc05vdFN0cmluZ1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNOb3RTdHJpbmcgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUuYSgnc3RyaW5nJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOdW1iZXIodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYSBudW1iZXIuXG4gICAqXG4gICAqICAgICB2YXIgY3VwcyA9IDI7XG4gICAqICAgICBhc3NlcnQuaXNOdW1iZXIoY3VwcywgJ2hvdyBtYW55IGN1cHMnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOdW1iZXJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc051bWJlciA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmJlLmEoJ251bWJlcicpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTm90TnVtYmVyKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIF9ub3RfIGEgbnVtYmVyLlxuICAgKlxuICAgKiAgICAgdmFyIGN1cHMgPSAnMiBjdXBzIHBsZWFzZSc7XG4gICAqICAgICBhc3NlcnQuaXNOb3ROdW1iZXIoY3VwcywgJ2hvdyBtYW55IGN1cHMnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOb3ROdW1iZXJcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTm90TnVtYmVyID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmEoJ251bWJlcicpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzQm9vbGVhbih2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBhIGJvb2xlYW4uXG4gICAqXG4gICAqICAgICB2YXIgdGVhUmVhZHkgPSB0cnVlXG4gICAqICAgICAgICwgdGVhU2VydmVkID0gZmFsc2U7XG4gICAqXG4gICAqICAgICBhc3NlcnQuaXNCb29sZWFuKHRlYVJlYWR5LCAnaXMgdGhlIHRlYSByZWFkeScpO1xuICAgKiAgICAgYXNzZXJ0LmlzQm9vbGVhbih0ZWFTZXJ2ZWQsICdoYXMgdGVhIGJlZW4gc2VydmVkJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzQm9vbGVhblxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNCb29sZWFuID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uYmUuYSgnYm9vbGVhbicpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTm90Qm9vbGVhbih2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBfbm90XyBhIGJvb2xlYW4uXG4gICAqXG4gICAqICAgICB2YXIgdGVhUmVhZHkgPSAneWVwJ1xuICAgKiAgICAgICAsIHRlYVNlcnZlZCA9ICdub3BlJztcbiAgICpcbiAgICogICAgIGFzc2VydC5pc05vdEJvb2xlYW4odGVhUmVhZHksICdpcyB0aGUgdGVhIHJlYWR5Jyk7XG4gICAqICAgICBhc3NlcnQuaXNOb3RCb29sZWFuKHRlYVNlcnZlZCwgJ2hhcyB0ZWEgYmVlbiBzZXJ2ZWQnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOb3RCb29sZWFuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc05vdEJvb2xlYW4gPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUuYSgnYm9vbGVhbicpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLnR5cGVPZih2YWx1ZSwgbmFtZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCdzIHR5cGUgaXMgYG5hbWVgLCBhcyBkZXRlcm1pbmVkIGJ5XG4gICAqIGBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nYC5cbiAgICpcbiAgICogICAgIGFzc2VydC50eXBlT2YoeyB0ZWE6ICdjaGFpJyB9LCAnb2JqZWN0JywgJ3dlIGhhdmUgYW4gb2JqZWN0Jyk7XG4gICAqICAgICBhc3NlcnQudHlwZU9mKFsnY2hhaScsICdqYXNtaW5lJ10sICdhcnJheScsICd3ZSBoYXZlIGFuIGFycmF5Jyk7XG4gICAqICAgICBhc3NlcnQudHlwZU9mKCd0ZWEnLCAnc3RyaW5nJywgJ3dlIGhhdmUgYSBzdHJpbmcnKTtcbiAgICogICAgIGFzc2VydC50eXBlT2YoL3RlYS8sICdyZWdleHAnLCAnd2UgaGF2ZSBhIHJlZ3VsYXIgZXhwcmVzc2lvbicpO1xuICAgKiAgICAgYXNzZXJ0LnR5cGVPZihudWxsLCAnbnVsbCcsICd3ZSBoYXZlIGEgbnVsbCcpO1xuICAgKiAgICAgYXNzZXJ0LnR5cGVPZih1bmRlZmluZWQsICd1bmRlZmluZWQnLCAnd2UgaGF2ZSBhbiB1bmRlZmluZWQnKTtcbiAgICpcbiAgICogQG5hbWUgdHlwZU9mXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC50eXBlT2YgPSBmdW5jdGlvbiAodmFsLCB0eXBlLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5iZS5hKHR5cGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdFR5cGVPZih2YWx1ZSwgbmFtZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCdzIHR5cGUgaXMgX25vdF8gYG5hbWVgLCBhcyBkZXRlcm1pbmVkIGJ5XG4gICAqIGBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3RUeXBlT2YoJ3RlYScsICdudW1iZXInLCAnc3RyaW5ncyBhcmUgbm90IG51bWJlcnMnKTtcbiAgICpcbiAgICogQG5hbWUgbm90VHlwZU9mXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlb2YgbmFtZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90VHlwZU9mID0gZnVuY3Rpb24gKHZhbCwgdHlwZSwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmEodHlwZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaW5zdGFuY2VPZihvYmplY3QsIGNvbnN0cnVjdG9yLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGFuIGluc3RhbmNlIG9mIGBjb25zdHJ1Y3RvcmAuXG4gICAqXG4gICAqICAgICB2YXIgVGVhID0gZnVuY3Rpb24gKG5hbWUpIHsgdGhpcy5uYW1lID0gbmFtZTsgfVxuICAgKiAgICAgICAsIGNoYWkgPSBuZXcgVGVhKCdjaGFpJyk7XG4gICAqXG4gICAqICAgICBhc3NlcnQuaW5zdGFuY2VPZihjaGFpLCBUZWEsICdjaGFpIGlzIGFuIGluc3RhbmNlIG9mIHRlYScpO1xuICAgKlxuICAgKiBAbmFtZSBpbnN0YW5jZU9mXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtDb25zdHJ1Y3Rvcn0gY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lmluc3RhbmNlT2YgPSBmdW5jdGlvbiAodmFsLCB0eXBlLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5iZS5pbnN0YW5jZU9mKHR5cGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdEluc3RhbmNlT2Yob2JqZWN0LCBjb25zdHJ1Y3RvciwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIGB2YWx1ZWAgaXMgbm90IGFuIGluc3RhbmNlIG9mIGBjb25zdHJ1Y3RvcmAuXG4gICAqXG4gICAqICAgICB2YXIgVGVhID0gZnVuY3Rpb24gKG5hbWUpIHsgdGhpcy5uYW1lID0gbmFtZTsgfVxuICAgKiAgICAgICAsIGNoYWkgPSBuZXcgU3RyaW5nKCdjaGFpJyk7XG4gICAqXG4gICAqICAgICBhc3NlcnQubm90SW5zdGFuY2VPZihjaGFpLCBUZWEsICdjaGFpIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiB0ZWEnKTtcbiAgICpcbiAgICogQG5hbWUgbm90SW5zdGFuY2VPZlxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7Q29uc3RydWN0b3J9IGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3RJbnN0YW5jZU9mID0gZnVuY3Rpb24gKHZhbCwgdHlwZSwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmluc3RhbmNlT2YodHlwZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaW5jbHVkZShoYXlzdGFjaywgbmVlZGxlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgaGF5c3RhY2tgIGluY2x1ZGVzIGBuZWVkbGVgLiBXb3Jrc1xuICAgKiBmb3Igc3RyaW5ncyBhbmQgYXJyYXlzLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmluY2x1ZGUoJ2Zvb2JhcicsICdiYXInLCAnZm9vYmFyIGNvbnRhaW5zIHN0cmluZyBcImJhclwiJyk7XG4gICAqICAgICBhc3NlcnQuaW5jbHVkZShbIDEsIDIsIDMgXSwgMywgJ2FycmF5IGNvbnRhaW5zIHZhbHVlJyk7XG4gICAqXG4gICAqIEBuYW1lIGluY2x1ZGVcbiAgICogQHBhcmFtIHtBcnJheXxTdHJpbmd9IGhheXN0YWNrXG4gICAqIEBwYXJhbSB7TWl4ZWR9IG5lZWRsZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaW5jbHVkZSA9IGZ1bmN0aW9uIChleHAsIGluYywgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihleHAsIG1zZywgYXNzZXJ0LmluY2x1ZGUpLmluY2x1ZGUoaW5jKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3RJbmNsdWRlKGhheXN0YWNrLCBuZWVkbGUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBoYXlzdGFja2AgZG9lcyBub3QgaW5jbHVkZSBgbmVlZGxlYC4gV29ya3NcbiAgICogZm9yIHN0cmluZ3MgYW5kIGFycmF5cy5cbiAgICppXG4gICAqICAgICBhc3NlcnQubm90SW5jbHVkZSgnZm9vYmFyJywgJ2JheicsICdzdHJpbmcgbm90IGluY2x1ZGUgc3Vic3RyaW5nJyk7XG4gICAqICAgICBhc3NlcnQubm90SW5jbHVkZShbIDEsIDIsIDMgXSwgNCwgJ2FycmF5IG5vdCBpbmNsdWRlIGNvbnRhaW4gdmFsdWUnKTtcbiAgICpcbiAgICogQG5hbWUgbm90SW5jbHVkZVxuICAgKiBAcGFyYW0ge0FycmF5fFN0cmluZ30gaGF5c3RhY2tcbiAgICogQHBhcmFtIHtNaXhlZH0gbmVlZGxlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3RJbmNsdWRlID0gZnVuY3Rpb24gKGV4cCwgaW5jLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGV4cCwgbXNnLCBhc3NlcnQubm90SW5jbHVkZSkubm90LmluY2x1ZGUoaW5jKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5tYXRjaCh2YWx1ZSwgcmVnZXhwLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIG1hdGNoZXMgdGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiBgcmVnZXhwYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5tYXRjaCgnZm9vYmFyJywgL15mb28vLCAncmVnZXhwIG1hdGNoZXMnKTtcbiAgICpcbiAgICogQG5hbWUgbWF0Y2hcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4cFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubWF0Y2ggPSBmdW5jdGlvbiAoZXhwLCByZSwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihleHAsIG1zZykudG8ubWF0Y2gocmUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdE1hdGNoKHZhbHVlLCByZWdleHAsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgZG9lcyBub3QgbWF0Y2ggdGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiBgcmVnZXhwYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3RNYXRjaCgnZm9vYmFyJywgL15mb28vLCAncmVnZXhwIGRvZXMgbm90IG1hdGNoJyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdE1hdGNoXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7UmVnRXhwfSByZWdleHBcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdE1hdGNoID0gZnVuY3Rpb24gKGV4cCwgcmUsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oZXhwLCBtc2cpLnRvLm5vdC5tYXRjaChyZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAucHJvcGVydHkob2JqZWN0LCBwcm9wZXJ0eSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaGFzIGEgcHJvcGVydHkgbmFtZWQgYnkgYHByb3BlcnR5YC5cbiAgICpcbiAgICogICAgIGFzc2VydC5wcm9wZXJ0eSh7IHRlYTogeyBncmVlbjogJ21hdGNoYScgfX0sICd0ZWEnKTtcbiAgICpcbiAgICogQG5hbWUgcHJvcGVydHlcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LnByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgcHJvcCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eShwcm9wKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3RQcm9wZXJ0eShvYmplY3QsIHByb3BlcnR5LCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBkb2VzIF9ub3RfIGhhdmUgYSBwcm9wZXJ0eSBuYW1lZCBieSBgcHJvcGVydHlgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm5vdFByb3BlcnR5KHsgdGVhOiB7IGdyZWVuOiAnbWF0Y2hhJyB9fSwgJ2NvZmZlZScpO1xuICAgKlxuICAgKiBAbmFtZSBub3RQcm9wZXJ0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90UHJvcGVydHkgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5ub3QuaGF2ZS5wcm9wZXJ0eShwcm9wKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5kZWVwUHJvcGVydHkob2JqZWN0LCBwcm9wZXJ0eSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaGFzIGEgcHJvcGVydHkgbmFtZWQgYnkgYHByb3BlcnR5YCwgd2hpY2ggY2FuIGJlIGFcbiAgICogc3RyaW5nIHVzaW5nIGRvdC0gYW5kIGJyYWNrZXQtbm90YXRpb24gZm9yIGRlZXAgcmVmZXJlbmNlLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmRlZXBQcm9wZXJ0eSh7IHRlYTogeyBncmVlbjogJ21hdGNoYScgfX0sICd0ZWEuZ3JlZW4nKTtcbiAgICpcbiAgICogQG5hbWUgZGVlcFByb3BlcnR5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5kZWVwUHJvcGVydHkgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLmRlZXAucHJvcGVydHkocHJvcCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90RGVlcFByb3BlcnR5KG9iamVjdCwgcHJvcGVydHksIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGRvZXMgX25vdF8gaGF2ZSBhIHByb3BlcnR5IG5hbWVkIGJ5IGBwcm9wZXJ0eWAsIHdoaWNoXG4gICAqIGNhbiBiZSBhIHN0cmluZyB1c2luZyBkb3QtIGFuZCBicmFja2V0LW5vdGF0aW9uIGZvciBkZWVwIHJlZmVyZW5jZS5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3REZWVwUHJvcGVydHkoeyB0ZWE6IHsgZ3JlZW46ICdtYXRjaGEnIH19LCAndGVhLm9vbG9uZycpO1xuICAgKlxuICAgKiBAbmFtZSBub3REZWVwUHJvcGVydHlcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdERlZXBQcm9wZXJ0eSA9IGZ1bmN0aW9uIChvYmosIHByb3AsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLm5vdC5oYXZlLmRlZXAucHJvcGVydHkocHJvcCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAucHJvcGVydHlWYWwob2JqZWN0LCBwcm9wZXJ0eSwgdmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGhhcyBhIHByb3BlcnR5IG5hbWVkIGJ5IGBwcm9wZXJ0eWAgd2l0aCB2YWx1ZSBnaXZlblxuICAgKiBieSBgdmFsdWVgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LnByb3BlcnR5VmFsKHsgdGVhOiAnaXMgZ29vZCcgfSwgJ3RlYScsICdpcyBnb29kJyk7XG4gICAqXG4gICAqIEBuYW1lIHByb3BlcnR5VmFsXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5wcm9wZXJ0eVZhbCA9IGZ1bmN0aW9uIChvYmosIHByb3AsIHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eShwcm9wLCB2YWwpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLnByb3BlcnR5Tm90VmFsKG9iamVjdCwgcHJvcGVydHksIHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBoYXMgYSBwcm9wZXJ0eSBuYW1lZCBieSBgcHJvcGVydHlgLCBidXQgd2l0aCBhIHZhbHVlXG4gICAqIGRpZmZlcmVudCBmcm9tIHRoYXQgZ2l2ZW4gYnkgYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5wcm9wZXJ0eU5vdFZhbCh7IHRlYTogJ2lzIGdvb2QnIH0sICd0ZWEnLCAnaXMgYmFkJyk7XG4gICAqXG4gICAqIEBuYW1lIHByb3BlcnR5Tm90VmFsXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5wcm9wZXJ0eU5vdFZhbCA9IGZ1bmN0aW9uIChvYmosIHByb3AsIHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8ubm90LmhhdmUucHJvcGVydHkocHJvcCwgdmFsKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5kZWVwUHJvcGVydHlWYWwob2JqZWN0LCBwcm9wZXJ0eSwgdmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGhhcyBhIHByb3BlcnR5IG5hbWVkIGJ5IGBwcm9wZXJ0eWAgd2l0aCB2YWx1ZSBnaXZlblxuICAgKiBieSBgdmFsdWVgLiBgcHJvcGVydHlgIGNhbiB1c2UgZG90LSBhbmQgYnJhY2tldC1ub3RhdGlvbiBmb3IgZGVlcFxuICAgKiByZWZlcmVuY2UuXG4gICAqXG4gICAqICAgICBhc3NlcnQuZGVlcFByb3BlcnR5VmFsKHsgdGVhOiB7IGdyZWVuOiAnbWF0Y2hhJyB9fSwgJ3RlYS5ncmVlbicsICdtYXRjaGEnKTtcbiAgICpcbiAgICogQG5hbWUgZGVlcFByb3BlcnR5VmFsXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5kZWVwUHJvcGVydHlWYWwgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCB2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eShwcm9wLCB2YWwpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmRlZXBQcm9wZXJ0eU5vdFZhbChvYmplY3QsIHByb3BlcnR5LCB2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaGFzIGEgcHJvcGVydHkgbmFtZWQgYnkgYHByb3BlcnR5YCwgYnV0IHdpdGggYSB2YWx1ZVxuICAgKiBkaWZmZXJlbnQgZnJvbSB0aGF0IGdpdmVuIGJ5IGB2YWx1ZWAuIGBwcm9wZXJ0eWAgY2FuIHVzZSBkb3QtIGFuZFxuICAgKiBicmFja2V0LW5vdGF0aW9uIGZvciBkZWVwIHJlZmVyZW5jZS5cbiAgICpcbiAgICogICAgIGFzc2VydC5kZWVwUHJvcGVydHlOb3RWYWwoeyB0ZWE6IHsgZ3JlZW46ICdtYXRjaGEnIH19LCAndGVhLmdyZWVuJywgJ2tvbmFjaGEnKTtcbiAgICpcbiAgICogQG5hbWUgZGVlcFByb3BlcnR5Tm90VmFsXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5kZWVwUHJvcGVydHlOb3RWYWwgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCB2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLm5vdC5oYXZlLmRlZXAucHJvcGVydHkocHJvcCwgdmFsKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5sZW5ndGhPZihvYmplY3QsIGxlbmd0aCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaGFzIGEgYGxlbmd0aGAgcHJvcGVydHkgd2l0aCB0aGUgZXhwZWN0ZWQgdmFsdWUuXG4gICAqXG4gICAqICAgICBhc3NlcnQubGVuZ3RoT2YoWzEsMiwzXSwgMywgJ2FycmF5IGhhcyBsZW5ndGggb2YgMycpO1xuICAgKiAgICAgYXNzZXJ0Lmxlbmd0aE9mKCdmb29iYXInLCA1LCAnc3RyaW5nIGhhcyBsZW5ndGggb2YgNicpO1xuICAgKlxuICAgKiBAbmFtZSBsZW5ndGhPZlxuICAgKiBAcGFyYW0ge01peGVkfSBvYmplY3RcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGxlbmd0aFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubGVuZ3RoT2YgPSBmdW5jdGlvbiAoZXhwLCBsZW4sIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oZXhwLCBtc2cpLnRvLmhhdmUubGVuZ3RoKGxlbik7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAudGhyb3dzKGZ1bmN0aW9uLCBbY29uc3RydWN0b3Ivc3RyaW5nL3JlZ2V4cF0sIFtzdHJpbmcvcmVnZXhwXSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYGZ1bmN0aW9uYCB3aWxsIHRocm93IGFuIGVycm9yIHRoYXQgaXMgYW4gaW5zdGFuY2Ugb2ZcbiAgICogYGNvbnN0cnVjdG9yYCwgb3IgYWx0ZXJuYXRlbHkgdGhhdCBpdCB3aWxsIHRocm93IGFuIGVycm9yIHdpdGggbWVzc2FnZVxuICAgKiBtYXRjaGluZyBgcmVnZXhwYC5cbiAgICpcbiAgICogICAgIGFzc2VydC50aHJvdyhmbiwgJ2Z1bmN0aW9uIHRocm93cyBhIHJlZmVyZW5jZSBlcnJvcicpO1xuICAgKiAgICAgYXNzZXJ0LnRocm93KGZuLCAvZnVuY3Rpb24gdGhyb3dzIGEgcmVmZXJlbmNlIGVycm9yLyk7XG4gICAqICAgICBhc3NlcnQudGhyb3coZm4sIFJlZmVyZW5jZUVycm9yKTtcbiAgICogICAgIGFzc2VydC50aHJvdyhmbiwgUmVmZXJlbmNlRXJyb3IsICdmdW5jdGlvbiB0aHJvd3MgYSByZWZlcmVuY2UgZXJyb3InKTtcbiAgICogICAgIGFzc2VydC50aHJvdyhmbiwgUmVmZXJlbmNlRXJyb3IsIC9mdW5jdGlvbiB0aHJvd3MgYSByZWZlcmVuY2UgZXJyb3IvKTtcbiAgICpcbiAgICogQG5hbWUgdGhyb3dzXG4gICAqIEBhbGlhcyB0aHJvd1xuICAgKiBAYWxpYXMgVGhyb3dcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuY3Rpb25cbiAgICogQHBhcmFtIHtFcnJvckNvbnN0cnVjdG9yfSBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXhwXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRXJyb3IjRXJyb3JfdHlwZXNcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LlRocm93ID0gZnVuY3Rpb24gKGZuLCBlcnJ0LCBlcnJzLCBtc2cpIHtcbiAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiBlcnJ0IHx8IGVycnQgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIGVycnMgPSBlcnJ0O1xuICAgICAgZXJydCA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIGFzc2VydEVyciA9IG5ldyBBc3NlcnRpb24oZm4sIG1zZykudG8uVGhyb3coZXJydCwgZXJycyk7XG4gICAgcmV0dXJuIGZsYWcoYXNzZXJ0RXJyLCAnb2JqZWN0Jyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuZG9lc05vdFRocm93KGZ1bmN0aW9uLCBbY29uc3RydWN0b3IvcmVnZXhwXSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYGZ1bmN0aW9uYCB3aWxsIF9ub3RfIHRocm93IGFuIGVycm9yIHRoYXQgaXMgYW4gaW5zdGFuY2Ugb2ZcbiAgICogYGNvbnN0cnVjdG9yYCwgb3IgYWx0ZXJuYXRlbHkgdGhhdCBpdCB3aWxsIG5vdCB0aHJvdyBhbiBlcnJvciB3aXRoIG1lc3NhZ2VcbiAgICogbWF0Y2hpbmcgYHJlZ2V4cGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQuZG9lc05vdFRocm93KGZuLCBFcnJvciwgJ2Z1bmN0aW9uIGRvZXMgbm90IHRocm93Jyk7XG4gICAqXG4gICAqIEBuYW1lIGRvZXNOb3RUaHJvd1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jdGlvblxuICAgKiBAcGFyYW0ge0Vycm9yQ29uc3RydWN0b3J9IGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7UmVnRXhwfSByZWdleHBcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9FcnJvciNFcnJvcl90eXBlc1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuZG9lc05vdFRocm93ID0gZnVuY3Rpb24gKGZuLCB0eXBlLCBtc2cpIHtcbiAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiB0eXBlKSB7XG4gICAgICBtc2cgPSB0eXBlO1xuICAgICAgdHlwZSA9IG51bGw7XG4gICAgfVxuXG4gICAgbmV3IEFzc2VydGlvbihmbiwgbXNnKS50by5ub3QuVGhyb3codHlwZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAub3BlcmF0b3IodmFsMSwgb3BlcmF0b3IsIHZhbDIsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQ29tcGFyZXMgdHdvIHZhbHVlcyB1c2luZyBgb3BlcmF0b3JgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm9wZXJhdG9yKDEsICc8JywgMiwgJ2V2ZXJ5dGhpbmcgaXMgb2snKTtcbiAgICogICAgIGFzc2VydC5vcGVyYXRvcigxLCAnPicsIDIsICd0aGlzIHdpbGwgZmFpbCcpO1xuICAgKlxuICAgKiBAbmFtZSBvcGVyYXRvclxuICAgKiBAcGFyYW0ge01peGVkfSB2YWwxXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcGVyYXRvclxuICAgKiBAcGFyYW0ge01peGVkfSB2YWwyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5vcGVyYXRvciA9IGZ1bmN0aW9uICh2YWwsIG9wZXJhdG9yLCB2YWwyLCBtc2cpIHtcbiAgICBpZiAoIX5bJz09JywgJz09PScsICc+JywgJz49JywgJzwnLCAnPD0nLCAnIT0nLCAnIT09J10uaW5kZXhPZihvcGVyYXRvcikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBvcGVyYXRvciBcIicgKyBvcGVyYXRvciArICdcIicpO1xuICAgIH1cbiAgICB2YXIgdGVzdCA9IG5ldyBBc3NlcnRpb24oZXZhbCh2YWwgKyBvcGVyYXRvciArIHZhbDIpLCBtc2cpO1xuICAgIHRlc3QuYXNzZXJ0KFxuICAgICAgICB0cnVlID09PSBmbGFnKHRlc3QsICdvYmplY3QnKVxuICAgICAgLCAnZXhwZWN0ZWQgJyArIHV0aWwuaW5zcGVjdCh2YWwpICsgJyB0byBiZSAnICsgb3BlcmF0b3IgKyAnICcgKyB1dGlsLmluc3BlY3QodmFsMilcbiAgICAgICwgJ2V4cGVjdGVkICcgKyB1dGlsLmluc3BlY3QodmFsKSArICcgdG8gbm90IGJlICcgKyBvcGVyYXRvciArICcgJyArIHV0aWwuaW5zcGVjdCh2YWwyKSApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmNsb3NlVG8oYWN0dWFsLCBleHBlY3RlZCwgZGVsdGEsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgZXF1YWwgYGV4cGVjdGVkYCwgdG8gd2l0aGluIGEgKy8tIGBkZWx0YWAgcmFuZ2UuXG4gICAqXG4gICAqICAgICBhc3NlcnQuY2xvc2VUbygxLjUsIDEsIDAuNSwgJ251bWJlcnMgYXJlIGNsb3NlJyk7XG4gICAqXG4gICAqIEBuYW1lIGNsb3NlVG9cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGFjdHVhbFxuICAgKiBAcGFyYW0ge051bWJlcn0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5jbG9zZVRvID0gZnVuY3Rpb24gKGFjdCwgZXhwLCBkZWx0YSwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihhY3QsIG1zZykudG8uYmUuY2xvc2VUbyhleHAsIGRlbHRhKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5zYW1lTWVtYmVycyhzZXQxLCBzZXQyLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgc2V0MWAgYW5kIGBzZXQyYCBoYXZlIHRoZSBzYW1lIG1lbWJlcnMuXG4gICAqIE9yZGVyIGlzIG5vdCB0YWtlbiBpbnRvIGFjY291bnQuXG4gICAqXG4gICAqICAgICBhc3NlcnQuc2FtZU1lbWJlcnMoWyAxLCAyLCAzIF0sIFsgMiwgMSwgMyBdLCAnc2FtZSBtZW1iZXJzJyk7XG4gICAqXG4gICAqIEBuYW1lIHNhbWVNZW1iZXJzXG4gICAqIEBwYXJhbSB7QXJyYXl9IHN1cGVyc2V0XG4gICAqIEBwYXJhbSB7QXJyYXl9IHN1YnNldFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuc2FtZU1lbWJlcnMgPSBmdW5jdGlvbiAoc2V0MSwgc2V0MiwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihzZXQxLCBtc2cpLnRvLmhhdmUuc2FtZS5tZW1iZXJzKHNldDIpO1xuICB9XG5cbiAgLyoqXG4gICAqICMjIyAuaW5jbHVkZU1lbWJlcnMoc3VwZXJzZXQsIHN1YnNldCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHN1YnNldGAgaXMgaW5jbHVkZWQgaW4gYHN1cGVyc2V0YC5cbiAgICogT3JkZXIgaXMgbm90IHRha2VuIGludG8gYWNjb3VudC5cbiAgICpcbiAgICogICAgIGFzc2VydC5pbmNsdWRlTWVtYmVycyhbIDEsIDIsIDMgXSwgWyAyLCAxIF0sICdpbmNsdWRlIG1lbWJlcnMnKTtcbiAgICpcbiAgICogQG5hbWUgaW5jbHVkZU1lbWJlcnNcbiAgICogQHBhcmFtIHtBcnJheX0gc3VwZXJzZXRcbiAgICogQHBhcmFtIHtBcnJheX0gc3Vic2V0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pbmNsdWRlTWVtYmVycyA9IGZ1bmN0aW9uIChzdXBlcnNldCwgc3Vic2V0LCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHN1cGVyc2V0LCBtc2cpLnRvLmluY2x1ZGUubWVtYmVycyhzdWJzZXQpO1xuICB9XG5cbiAgLyohXG4gICAqIFVuZG9jdW1lbnRlZCAvIHVudGVzdGVkXG4gICAqL1xuXG4gIGFzc2VydC5pZkVycm9yID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLm9rO1xuICB9O1xuXG4gIC8qIVxuICAgKiBBbGlhc2VzLlxuICAgKi9cblxuICAoZnVuY3Rpb24gYWxpYXMobmFtZSwgYXMpe1xuICAgIGFzc2VydFthc10gPSBhc3NlcnRbbmFtZV07XG4gICAgcmV0dXJuIGFsaWFzO1xuICB9KVxuICAoJ1Rocm93JywgJ3Rocm93JylcbiAgKCdUaHJvdycsICd0aHJvd3MnKTtcbn07XG4iLCIvKiFcbiAqIGNoYWlcbiAqIENvcHlyaWdodChjKSAyMDExLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjaGFpLCB1dGlsKSB7XG4gIGNoYWkuZXhwZWN0ID0gZnVuY3Rpb24gKHZhbCwgbWVzc2FnZSkge1xuICAgIHJldHVybiBuZXcgY2hhaS5Bc3NlcnRpb24odmFsLCBtZXNzYWdlKTtcbiAgfTtcbn07XG5cbiIsIi8qIVxuICogY2hhaVxuICogQ29weXJpZ2h0KGMpIDIwMTEtMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNoYWksIHV0aWwpIHtcbiAgdmFyIEFzc2VydGlvbiA9IGNoYWkuQXNzZXJ0aW9uO1xuXG4gIGZ1bmN0aW9uIGxvYWRTaG91bGQgKCkge1xuICAgIC8vIGV4cGxpY2l0bHkgZGVmaW5lIHRoaXMgbWV0aG9kIGFzIGZ1bmN0aW9uIGFzIHRvIGhhdmUgaXQncyBuYW1lIHRvIGluY2x1ZGUgYXMgYHNzZmlgXG4gICAgZnVuY3Rpb24gc2hvdWxkR2V0dGVyKCkge1xuICAgICAgaWYgKHRoaXMgaW5zdGFuY2VvZiBTdHJpbmcgfHwgdGhpcyBpbnN0YW5jZW9mIE51bWJlcikge1xuICAgICAgICByZXR1cm4gbmV3IEFzc2VydGlvbih0aGlzLmNvbnN0cnVjdG9yKHRoaXMpLCBudWxsLCBzaG91bGRHZXR0ZXIpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzIGluc3RhbmNlb2YgQm9vbGVhbikge1xuICAgICAgICByZXR1cm4gbmV3IEFzc2VydGlvbih0aGlzID09IHRydWUsIG51bGwsIHNob3VsZEdldHRlcik7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IEFzc2VydGlvbih0aGlzLCBudWxsLCBzaG91bGRHZXR0ZXIpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBzaG91bGRTZXR0ZXIodmFsdWUpIHtcbiAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vY2hhaWpzL2NoYWkvaXNzdWVzLzg2OiB0aGlzIG1ha2VzXG4gICAgICAvLyBgd2hhdGV2ZXIuc2hvdWxkID0gc29tZVZhbHVlYCBhY3R1YWxseSBzZXQgYHNvbWVWYWx1ZWAsIHdoaWNoIGlzXG4gICAgICAvLyBlc3BlY2lhbGx5IHVzZWZ1bCBmb3IgYGdsb2JhbC5zaG91bGQgPSByZXF1aXJlKCdjaGFpJykuc2hvdWxkKClgLlxuICAgICAgLy9cbiAgICAgIC8vIE5vdGUgdGhhdCB3ZSBoYXZlIHRvIHVzZSBbW0RlZmluZVByb3BlcnR5XV0gaW5zdGVhZCBvZiBbW1B1dF1dXG4gICAgICAvLyBzaW5jZSBvdGhlcndpc2Ugd2Ugd291bGQgdHJpZ2dlciB0aGlzIHZlcnkgc2V0dGVyIVxuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdzaG91bGQnLCB7XG4gICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIG1vZGlmeSBPYmplY3QucHJvdG90eXBlIHRvIGhhdmUgYHNob3VsZGBcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoT2JqZWN0LnByb3RvdHlwZSwgJ3Nob3VsZCcsIHtcbiAgICAgIHNldDogc2hvdWxkU2V0dGVyXG4gICAgICAsIGdldDogc2hvdWxkR2V0dGVyXG4gICAgICAsIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgdmFyIHNob3VsZCA9IHt9O1xuXG4gICAgc2hvdWxkLmVxdWFsID0gZnVuY3Rpb24gKHZhbDEsIHZhbDIsIG1zZykge1xuICAgICAgbmV3IEFzc2VydGlvbih2YWwxLCBtc2cpLnRvLmVxdWFsKHZhbDIpO1xuICAgIH07XG5cbiAgICBzaG91bGQuVGhyb3cgPSBmdW5jdGlvbiAoZm4sIGVycnQsIGVycnMsIG1zZykge1xuICAgICAgbmV3IEFzc2VydGlvbihmbiwgbXNnKS50by5UaHJvdyhlcnJ0LCBlcnJzKTtcbiAgICB9O1xuXG4gICAgc2hvdWxkLmV4aXN0ID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5leGlzdDtcbiAgICB9XG5cbiAgICAvLyBuZWdhdGlvblxuICAgIHNob3VsZC5ub3QgPSB7fVxuXG4gICAgc2hvdWxkLm5vdC5lcXVhbCA9IGZ1bmN0aW9uICh2YWwxLCB2YWwyLCBtc2cpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24odmFsMSwgbXNnKS50by5ub3QuZXF1YWwodmFsMik7XG4gICAgfTtcblxuICAgIHNob3VsZC5ub3QuVGhyb3cgPSBmdW5jdGlvbiAoZm4sIGVycnQsIGVycnMsIG1zZykge1xuICAgICAgbmV3IEFzc2VydGlvbihmbiwgbXNnKS50by5ub3QuVGhyb3coZXJydCwgZXJycyk7XG4gICAgfTtcblxuICAgIHNob3VsZC5ub3QuZXhpc3QgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5leGlzdDtcbiAgICB9XG5cbiAgICBzaG91bGRbJ3Rocm93J10gPSBzaG91bGRbJ1Rocm93J107XG4gICAgc2hvdWxkLm5vdFsndGhyb3cnXSA9IHNob3VsZC5ub3RbJ1Rocm93J107XG5cbiAgICByZXR1cm4gc2hvdWxkO1xuICB9O1xuXG4gIGNoYWkuc2hvdWxkID0gbG9hZFNob3VsZDtcbiAgY2hhaS5TaG91bGQgPSBsb2FkU2hvdWxkO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIGFkZENoYWluaW5nTWV0aG9kIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXNcbiAqL1xuXG52YXIgdHJhbnNmZXJGbGFncyA9IHJlcXVpcmUoJy4vdHJhbnNmZXJGbGFncycpO1xudmFyIGZsYWcgPSByZXF1aXJlKCcuL2ZsYWcnKTtcbnZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKTtcblxuLyohXG4gKiBNb2R1bGUgdmFyaWFibGVzXG4gKi9cblxuLy8gQ2hlY2sgd2hldGhlciBgX19wcm90b19fYCBpcyBzdXBwb3J0ZWRcbnZhciBoYXNQcm90b1N1cHBvcnQgPSAnX19wcm90b19fJyBpbiBPYmplY3Q7XG5cbi8vIFdpdGhvdXQgYF9fcHJvdG9fX2Agc3VwcG9ydCwgdGhpcyBtb2R1bGUgd2lsbCBuZWVkIHRvIGFkZCBwcm9wZXJ0aWVzIHRvIGEgZnVuY3Rpb24uXG4vLyBIb3dldmVyLCBzb21lIEZ1bmN0aW9uLnByb3RvdHlwZSBtZXRob2RzIGNhbm5vdCBiZSBvdmVyd3JpdHRlbixcbi8vIGFuZCB0aGVyZSBzZWVtcyBubyBlYXN5IGNyb3NzLXBsYXRmb3JtIHdheSB0byBkZXRlY3QgdGhlbSAoQHNlZSBjaGFpanMvY2hhaS9pc3N1ZXMvNjkpLlxudmFyIGV4Y2x1ZGVOYW1lcyA9IC9eKD86bGVuZ3RofG5hbWV8YXJndW1lbnRzfGNhbGxlcikkLztcblxuLy8gQ2FjaGUgYEZ1bmN0aW9uYCBwcm9wZXJ0aWVzXG52YXIgY2FsbCAgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbCxcbiAgICBhcHBseSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseTtcblxuLyoqXG4gKiAjIyMgYWRkQ2hhaW5hYmxlTWV0aG9kIChjdHgsIG5hbWUsIG1ldGhvZCwgY2hhaW5pbmdCZWhhdmlvcilcbiAqXG4gKiBBZGRzIGEgbWV0aG9kIHRvIGFuIG9iamVjdCwgc3VjaCB0aGF0IHRoZSBtZXRob2QgY2FuIGFsc28gYmUgY2hhaW5lZC5cbiAqXG4gKiAgICAgdXRpbHMuYWRkQ2hhaW5hYmxlTWV0aG9kKGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZSwgJ2ZvbycsIGZ1bmN0aW9uIChzdHIpIHtcbiAqICAgICAgIHZhciBvYmogPSB1dGlscy5mbGFnKHRoaXMsICdvYmplY3QnKTtcbiAqICAgICAgIG5ldyBjaGFpLkFzc2VydGlvbihvYmopLnRvLmJlLmVxdWFsKHN0cik7XG4gKiAgICAgfSk7XG4gKlxuICogQ2FuIGFsc28gYmUgYWNjZXNzZWQgZGlyZWN0bHkgZnJvbSBgY2hhaS5Bc3NlcnRpb25gLlxuICpcbiAqICAgICBjaGFpLkFzc2VydGlvbi5hZGRDaGFpbmFibGVNZXRob2QoJ2ZvbycsIGZuLCBjaGFpbmluZ0JlaGF2aW9yKTtcbiAqXG4gKiBUaGUgcmVzdWx0IGNhbiB0aGVuIGJlIHVzZWQgYXMgYm90aCBhIG1ldGhvZCBhc3NlcnRpb24sIGV4ZWN1dGluZyBib3RoIGBtZXRob2RgIGFuZFxuICogYGNoYWluaW5nQmVoYXZpb3JgLCBvciBhcyBhIGxhbmd1YWdlIGNoYWluLCB3aGljaCBvbmx5IGV4ZWN1dGVzIGBjaGFpbmluZ0JlaGF2aW9yYC5cbiAqXG4gKiAgICAgZXhwZWN0KGZvb1N0cikudG8uYmUuZm9vKCdiYXInKTtcbiAqICAgICBleHBlY3QoZm9vU3RyKS50by5iZS5mb28uZXF1YWwoJ2ZvbycpO1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHggb2JqZWN0IHRvIHdoaWNoIHRoZSBtZXRob2QgaXMgYWRkZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG9mIG1ldGhvZCB0byBhZGRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG1ldGhvZCBmdW5jdGlvbiB0byBiZSB1c2VkIGZvciBgbmFtZWAsIHdoZW4gY2FsbGVkXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjaGFpbmluZ0JlaGF2aW9yIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBldmVyeSB0aW1lIHRoZSBwcm9wZXJ0eSBpcyBhY2Nlc3NlZFxuICogQG5hbWUgYWRkQ2hhaW5hYmxlTWV0aG9kXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGN0eCwgbmFtZSwgbWV0aG9kLCBjaGFpbmluZ0JlaGF2aW9yKSB7XG4gIGlmICh0eXBlb2YgY2hhaW5pbmdCZWhhdmlvciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIGNoYWluaW5nQmVoYXZpb3IgPSBmdW5jdGlvbiAoKSB7IH07XG4gIH1cblxuICB2YXIgY2hhaW5hYmxlQmVoYXZpb3IgPSB7XG4gICAgICBtZXRob2Q6IG1ldGhvZFxuICAgICwgY2hhaW5pbmdCZWhhdmlvcjogY2hhaW5pbmdCZWhhdmlvclxuICB9O1xuXG4gIC8vIHNhdmUgdGhlIG1ldGhvZHMgc28gd2UgY2FuIG92ZXJ3cml0ZSB0aGVtIGxhdGVyLCBpZiB3ZSBuZWVkIHRvLlxuICBpZiAoIWN0eC5fX21ldGhvZHMpIHtcbiAgICBjdHguX19tZXRob2RzID0ge307XG4gIH1cbiAgY3R4Ll9fbWV0aG9kc1tuYW1lXSA9IGNoYWluYWJsZUJlaGF2aW9yO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjdHgsIG5hbWUsXG4gICAgeyBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2hhaW5hYmxlQmVoYXZpb3IuY2hhaW5pbmdCZWhhdmlvci5jYWxsKHRoaXMpO1xuXG4gICAgICAgIHZhciBhc3NlcnQgPSBmdW5jdGlvbiBhc3NlcnQoKSB7XG4gICAgICAgICAgdmFyIG9sZF9zc2ZpID0gZmxhZyh0aGlzLCAnc3NmaScpO1xuICAgICAgICAgIGlmIChvbGRfc3NmaSAmJiBjb25maWcuaW5jbHVkZVN0YWNrID09PSBmYWxzZSlcbiAgICAgICAgICAgIGZsYWcodGhpcywgJ3NzZmknLCBhc3NlcnQpO1xuICAgICAgICAgIHZhciByZXN1bHQgPSBjaGFpbmFibGVCZWhhdmlvci5tZXRob2QuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQgPyB0aGlzIDogcmVzdWx0O1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFVzZSBgX19wcm90b19fYCBpZiBhdmFpbGFibGVcbiAgICAgICAgaWYgKGhhc1Byb3RvU3VwcG9ydCkge1xuICAgICAgICAgIC8vIEluaGVyaXQgYWxsIHByb3BlcnRpZXMgZnJvbSB0aGUgb2JqZWN0IGJ5IHJlcGxhY2luZyB0aGUgYEZ1bmN0aW9uYCBwcm90b3R5cGVcbiAgICAgICAgICB2YXIgcHJvdG90eXBlID0gYXNzZXJ0Ll9fcHJvdG9fXyA9IE9iamVjdC5jcmVhdGUodGhpcyk7XG4gICAgICAgICAgLy8gUmVzdG9yZSB0aGUgYGNhbGxgIGFuZCBgYXBwbHlgIG1ldGhvZHMgZnJvbSBgRnVuY3Rpb25gXG4gICAgICAgICAgcHJvdG90eXBlLmNhbGwgPSBjYWxsO1xuICAgICAgICAgIHByb3RvdHlwZS5hcHBseSA9IGFwcGx5O1xuICAgICAgICB9XG4gICAgICAgIC8vIE90aGVyd2lzZSwgcmVkZWZpbmUgYWxsIHByb3BlcnRpZXMgKHNsb3chKVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB2YXIgYXNzZXJ0ZXJOYW1lcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGN0eCk7XG4gICAgICAgICAgYXNzZXJ0ZXJOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChhc3NlcnRlck5hbWUpIHtcbiAgICAgICAgICAgIGlmICghZXhjbHVkZU5hbWVzLnRlc3QoYXNzZXJ0ZXJOYW1lKSkge1xuICAgICAgICAgICAgICB2YXIgcGQgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGN0eCwgYXNzZXJ0ZXJOYW1lKTtcbiAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGFzc2VydCwgYXNzZXJ0ZXJOYW1lLCBwZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB0cmFuc2ZlckZsYWdzKHRoaXMsIGFzc2VydCk7XG4gICAgICAgIHJldHVybiBhc3NlcnQ7XG4gICAgICB9XG4gICAgLCBjb25maWd1cmFibGU6IHRydWVcbiAgfSk7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gYWRkTWV0aG9kIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG5cbi8qKlxuICogIyMjIC5hZGRNZXRob2QgKGN0eCwgbmFtZSwgbWV0aG9kKVxuICpcbiAqIEFkZHMgYSBtZXRob2QgdG8gdGhlIHByb3RvdHlwZSBvZiBhbiBvYmplY3QuXG4gKlxuICogICAgIHV0aWxzLmFkZE1ldGhvZChjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUsICdmb28nLCBmdW5jdGlvbiAoc3RyKSB7XG4gKiAgICAgICB2YXIgb2JqID0gdXRpbHMuZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gKiAgICAgICBuZXcgY2hhaS5Bc3NlcnRpb24ob2JqKS50by5iZS5lcXVhbChzdHIpO1xuICogICAgIH0pO1xuICpcbiAqIENhbiBhbHNvIGJlIGFjY2Vzc2VkIGRpcmVjdGx5IGZyb20gYGNoYWkuQXNzZXJ0aW9uYC5cbiAqXG4gKiAgICAgY2hhaS5Bc3NlcnRpb24uYWRkTWV0aG9kKCdmb28nLCBmbik7XG4gKlxuICogVGhlbiBjYW4gYmUgdXNlZCBhcyBhbnkgb3RoZXIgYXNzZXJ0aW9uLlxuICpcbiAqICAgICBleHBlY3QoZm9vU3RyKS50by5iZS5mb28oJ2JhcicpO1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHggb2JqZWN0IHRvIHdoaWNoIHRoZSBtZXRob2QgaXMgYWRkZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG9mIG1ldGhvZCB0byBhZGRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG1ldGhvZCBmdW5jdGlvbiB0byBiZSB1c2VkIGZvciBuYW1lXG4gKiBAbmFtZSBhZGRNZXRob2RcbiAqIEBhcGkgcHVibGljXG4gKi9cbnZhciBmbGFnID0gcmVxdWlyZSgnLi9mbGFnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGN0eCwgbmFtZSwgbWV0aG9kKSB7XG4gIGN0eFtuYW1lXSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgb2xkX3NzZmkgPSBmbGFnKHRoaXMsICdzc2ZpJyk7XG4gICAgaWYgKG9sZF9zc2ZpICYmIGNvbmZpZy5pbmNsdWRlU3RhY2sgPT09IGZhbHNlKVxuICAgICAgZmxhZyh0aGlzLCAnc3NmaScsIGN0eFtuYW1lXSk7XG4gICAgdmFyIHJlc3VsdCA9IG1ldGhvZC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIHJldHVybiByZXN1bHQgPT09IHVuZGVmaW5lZCA/IHRoaXMgOiByZXN1bHQ7XG4gIH07XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gYWRkUHJvcGVydHkgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIGFkZFByb3BlcnR5IChjdHgsIG5hbWUsIGdldHRlcilcbiAqXG4gKiBBZGRzIGEgcHJvcGVydHkgdG8gdGhlIHByb3RvdHlwZSBvZiBhbiBvYmplY3QuXG4gKlxuICogICAgIHV0aWxzLmFkZFByb3BlcnR5KGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZSwgJ2ZvbycsIGZ1bmN0aW9uICgpIHtcbiAqICAgICAgIHZhciBvYmogPSB1dGlscy5mbGFnKHRoaXMsICdvYmplY3QnKTtcbiAqICAgICAgIG5ldyBjaGFpLkFzc2VydGlvbihvYmopLnRvLmJlLmluc3RhbmNlb2YoRm9vKTtcbiAqICAgICB9KTtcbiAqXG4gKiBDYW4gYWxzbyBiZSBhY2Nlc3NlZCBkaXJlY3RseSBmcm9tIGBjaGFpLkFzc2VydGlvbmAuXG4gKlxuICogICAgIGNoYWkuQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdmb28nLCBmbik7XG4gKlxuICogVGhlbiBjYW4gYmUgdXNlZCBhcyBhbnkgb3RoZXIgYXNzZXJ0aW9uLlxuICpcbiAqICAgICBleHBlY3QobXlGb28pLnRvLmJlLmZvbztcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gY3R4IG9iamVjdCB0byB3aGljaCB0aGUgcHJvcGVydHkgaXMgYWRkZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG9mIHByb3BlcnR5IHRvIGFkZFxuICogQHBhcmFtIHtGdW5jdGlvbn0gZ2V0dGVyIGZ1bmN0aW9uIHRvIGJlIHVzZWQgZm9yIG5hbWVcbiAqIEBuYW1lIGFkZFByb3BlcnR5XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGN0eCwgbmFtZSwgZ2V0dGVyKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjdHgsIG5hbWUsXG4gICAgeyBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IGdldHRlci5jYWxsKHRoaXMpO1xuICAgICAgICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQgPyB0aGlzIDogcmVzdWx0O1xuICAgICAgfVxuICAgICwgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIGZsYWcgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIGZsYWcob2JqZWN0ICxrZXksIFt2YWx1ZV0pXG4gKlxuICogR2V0IG9yIHNldCBhIGZsYWcgdmFsdWUgb24gYW4gb2JqZWN0LiBJZiBhXG4gKiB2YWx1ZSBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHNldCwgZWxzZSBpdCB3aWxsXG4gKiByZXR1cm4gdGhlIGN1cnJlbnRseSBzZXQgdmFsdWUgb3IgYHVuZGVmaW5lZGAgaWZcbiAqIHRoZSB2YWx1ZSBpcyBub3Qgc2V0LlxuICpcbiAqICAgICB1dGlscy5mbGFnKHRoaXMsICdmb28nLCAnYmFyJyk7IC8vIHNldHRlclxuICogICAgIHV0aWxzLmZsYWcodGhpcywgJ2ZvbycpOyAvLyBnZXR0ZXIsIHJldHVybnMgYGJhcmBcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IChjb25zdHJ1Y3RlZCBBc3NlcnRpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIChvcHRpb25hbClcbiAqIEBuYW1lIGZsYWdcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaiwga2V5LCB2YWx1ZSkge1xuICB2YXIgZmxhZ3MgPSBvYmouX19mbGFncyB8fCAob2JqLl9fZmxhZ3MgPSBPYmplY3QuY3JlYXRlKG51bGwpKTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDMpIHtcbiAgICBmbGFnc1trZXldID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZsYWdzW2tleV07XG4gIH1cbn07XG4iLCIvKiFcbiAqIENoYWkgLSBnZXRBY3R1YWwgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyBnZXRBY3R1YWwob2JqZWN0LCBbYWN0dWFsXSlcbiAqXG4gKiBSZXR1cm5zIHRoZSBgYWN0dWFsYCB2YWx1ZSBmb3IgYW4gQXNzZXJ0aW9uXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCAoY29uc3RydWN0ZWQgQXNzZXJ0aW9uKVxuICogQHBhcmFtIHtBcmd1bWVudHN9IGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZS5hc3NlcnQgYXJndW1lbnRzXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqLCBhcmdzKSB7XG4gIHJldHVybiBhcmdzLmxlbmd0aCA+IDQgPyBhcmdzWzRdIDogb2JqLl9vYmo7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gZ2V0RW51bWVyYWJsZVByb3BlcnRpZXMgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIC5nZXRFbnVtZXJhYmxlUHJvcGVydGllcyhvYmplY3QpXG4gKlxuICogVGhpcyBhbGxvd3MgdGhlIHJldHJpZXZhbCBvZiBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGFuIG9iamVjdCxcbiAqIGluaGVyaXRlZCBvciBub3QuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICogQHJldHVybnMge0FycmF5fVxuICogQG5hbWUgZ2V0RW51bWVyYWJsZVByb3BlcnRpZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBnZXRFbnVtZXJhYmxlUHJvcGVydGllcyhvYmplY3QpIHtcbiAgdmFyIHJlc3VsdCA9IFtdO1xuICBmb3IgKHZhciBuYW1lIGluIG9iamVjdCkge1xuICAgIHJlc3VsdC5wdXNoKG5hbWUpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gbWVzc2FnZSBjb21wb3NpdGlvbiB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kYW5jaWVzXG4gKi9cblxudmFyIGZsYWcgPSByZXF1aXJlKCcuL2ZsYWcnKVxuICAsIGdldEFjdHVhbCA9IHJlcXVpcmUoJy4vZ2V0QWN0dWFsJylcbiAgLCBpbnNwZWN0ID0gcmVxdWlyZSgnLi9pbnNwZWN0JylcbiAgLCBvYmpEaXNwbGF5ID0gcmVxdWlyZSgnLi9vYmpEaXNwbGF5Jyk7XG5cbi8qKlxuICogIyMjIC5nZXRNZXNzYWdlKG9iamVjdCwgbWVzc2FnZSwgbmVnYXRlTWVzc2FnZSlcbiAqXG4gKiBDb25zdHJ1Y3QgdGhlIGVycm9yIG1lc3NhZ2UgYmFzZWQgb24gZmxhZ3NcbiAqIGFuZCB0ZW1wbGF0ZSB0YWdzLiBUZW1wbGF0ZSB0YWdzIHdpbGwgcmV0dXJuXG4gKiBhIHN0cmluZ2lmaWVkIGluc3BlY3Rpb24gb2YgdGhlIG9iamVjdCByZWZlcmVuY2VkLlxuICpcbiAqIE1lc3NhZ2UgdGVtcGxhdGUgdGFnczpcbiAqIC0gYCN7dGhpc31gIGN1cnJlbnQgYXNzZXJ0ZWQgb2JqZWN0XG4gKiAtIGAje2FjdH1gIGFjdHVhbCB2YWx1ZVxuICogLSBgI3tleHB9YCBleHBlY3RlZCB2YWx1ZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgKGNvbnN0cnVjdGVkIEFzc2VydGlvbilcbiAqIEBwYXJhbSB7QXJndW1lbnRzfSBjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUuYXNzZXJ0IGFyZ3VtZW50c1xuICogQG5hbWUgZ2V0TWVzc2FnZVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmosIGFyZ3MpIHtcbiAgdmFyIG5lZ2F0ZSA9IGZsYWcob2JqLCAnbmVnYXRlJylcbiAgICAsIHZhbCA9IGZsYWcob2JqLCAnb2JqZWN0JylcbiAgICAsIGV4cGVjdGVkID0gYXJnc1szXVxuICAgICwgYWN0dWFsID0gZ2V0QWN0dWFsKG9iaiwgYXJncylcbiAgICAsIG1zZyA9IG5lZ2F0ZSA/IGFyZ3NbMl0gOiBhcmdzWzFdXG4gICAgLCBmbGFnTXNnID0gZmxhZyhvYmosICdtZXNzYWdlJyk7XG5cbiAgbXNnID0gbXNnIHx8ICcnO1xuICBtc2cgPSBtc2dcbiAgICAucmVwbGFjZSgvI3t0aGlzfS9nLCBvYmpEaXNwbGF5KHZhbCkpXG4gICAgLnJlcGxhY2UoLyN7YWN0fS9nLCBvYmpEaXNwbGF5KGFjdHVhbCkpXG4gICAgLnJlcGxhY2UoLyN7ZXhwfS9nLCBvYmpEaXNwbGF5KGV4cGVjdGVkKSk7XG5cbiAgcmV0dXJuIGZsYWdNc2cgPyBmbGFnTXNnICsgJzogJyArIG1zZyA6IG1zZztcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBnZXROYW1lIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMgZ2V0TmFtZShmdW5jKVxuICpcbiAqIEdldHMgdGhlIG5hbWUgb2YgYSBmdW5jdGlvbiwgaW4gYSBjcm9zcy1icm93c2VyIHdheS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBhIGZ1bmN0aW9uICh1c3VhbGx5IGEgY29uc3RydWN0b3IpXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZnVuYykge1xuICBpZiAoZnVuYy5uYW1lKSByZXR1cm4gZnVuYy5uYW1lO1xuXG4gIHZhciBtYXRjaCA9IC9eXFxzP2Z1bmN0aW9uIChbXihdKilcXCgvLmV4ZWMoZnVuYyk7XG4gIHJldHVybiBtYXRjaCAmJiBtYXRjaFsxXSA/IG1hdGNoWzFdIDogXCJcIjtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBnZXRQYXRoVmFsdWUgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIEBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2xvZ2ljYWxwYXJhZG94L2ZpbHRyXG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMjIyAuZ2V0UGF0aFZhbHVlKHBhdGgsIG9iamVjdClcbiAqXG4gKiBUaGlzIGFsbG93cyB0aGUgcmV0cmlldmFsIG9mIHZhbHVlcyBpbiBhblxuICogb2JqZWN0IGdpdmVuIGEgc3RyaW5nIHBhdGguXG4gKlxuICogICAgIHZhciBvYmogPSB7XG4gKiAgICAgICAgIHByb3AxOiB7XG4gKiAgICAgICAgICAgICBhcnI6IFsnYScsICdiJywgJ2MnXVxuICogICAgICAgICAgICwgc3RyOiAnSGVsbG8nXG4gKiAgICAgICAgIH1cbiAqICAgICAgICwgcHJvcDI6IHtcbiAqICAgICAgICAgICAgIGFycjogWyB7IG5lc3RlZDogJ1VuaXZlcnNlJyB9IF1cbiAqICAgICAgICAgICAsIHN0cjogJ0hlbGxvIGFnYWluISdcbiAqICAgICAgICAgfVxuICogICAgIH1cbiAqXG4gKiBUaGUgZm9sbG93aW5nIHdvdWxkIGJlIHRoZSByZXN1bHRzLlxuICpcbiAqICAgICBnZXRQYXRoVmFsdWUoJ3Byb3AxLnN0cicsIG9iaik7IC8vIEhlbGxvXG4gKiAgICAgZ2V0UGF0aFZhbHVlKCdwcm9wMS5hdHRbMl0nLCBvYmopOyAvLyBiXG4gKiAgICAgZ2V0UGF0aFZhbHVlKCdwcm9wMi5hcnJbMF0ubmVzdGVkJywgb2JqKTsgLy8gVW5pdmVyc2VcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICogQHJldHVybnMge09iamVjdH0gdmFsdWUgb3IgYHVuZGVmaW5lZGBcbiAqIEBuYW1lIGdldFBhdGhWYWx1ZVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG52YXIgZ2V0UGF0aFZhbHVlID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAocGF0aCwgb2JqKSB7XG4gIHZhciBwYXJzZWQgPSBwYXJzZVBhdGgocGF0aCk7XG4gIHJldHVybiBfZ2V0UGF0aFZhbHVlKHBhcnNlZCwgb2JqKTtcbn07XG5cbi8qIVxuICogIyMgcGFyc2VQYXRoKHBhdGgpXG4gKlxuICogSGVscGVyIGZ1bmN0aW9uIHVzZWQgdG8gcGFyc2Ugc3RyaW5nIG9iamVjdFxuICogcGF0aHMuIFVzZSBpbiBjb25qdW5jdGlvbiB3aXRoIGBfZ2V0UGF0aFZhbHVlYC5cbiAqXG4gKiAgICAgIHZhciBwYXJzZWQgPSBwYXJzZVBhdGgoJ215b2JqZWN0LnByb3BlcnR5LnN1YnByb3AnKTtcbiAqXG4gKiAjIyMgUGF0aHM6XG4gKlxuICogKiBDYW4gYmUgYXMgbmVhciBpbmZpbml0ZWx5IGRlZXAgYW5kIG5lc3RlZFxuICogKiBBcnJheXMgYXJlIGFsc28gdmFsaWQgdXNpbmcgdGhlIGZvcm1hbCBgbXlvYmplY3QuZG9jdW1lbnRbM10ucHJvcGVydHlgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBwYXJzZWRcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlUGF0aCAocGF0aCkge1xuICB2YXIgc3RyID0gcGF0aC5yZXBsYWNlKC9cXFsvZywgJy5bJylcbiAgICAsIHBhcnRzID0gc3RyLm1hdGNoKC8oXFxcXFxcLnxbXi5dKz8pKy9nKTtcbiAgcmV0dXJuIHBhcnRzLm1hcChmdW5jdGlvbiAodmFsdWUpIHtcbiAgICB2YXIgcmUgPSAvXFxbKFxcZCspXFxdJC9cbiAgICAgICwgbUFyciA9IHJlLmV4ZWModmFsdWUpXG4gICAgaWYgKG1BcnIpIHJldHVybiB7IGk6IHBhcnNlRmxvYXQobUFyclsxXSkgfTtcbiAgICBlbHNlIHJldHVybiB7IHA6IHZhbHVlIH07XG4gIH0pO1xufTtcblxuLyohXG4gKiAjIyBfZ2V0UGF0aFZhbHVlKHBhcnNlZCwgb2JqKVxuICpcbiAqIEhlbHBlciBjb21wYW5pb24gZnVuY3Rpb24gZm9yIGAucGFyc2VQYXRoYCB0aGF0IHJldHVybnNcbiAqIHRoZSB2YWx1ZSBsb2NhdGVkIGF0IHRoZSBwYXJzZWQgYWRkcmVzcy5cbiAqXG4gKiAgICAgIHZhciB2YWx1ZSA9IGdldFBhdGhWYWx1ZShwYXJzZWQsIG9iaik7XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHBhcnNlZCBkZWZpbml0aW9uIGZyb20gYHBhcnNlUGF0aGAuXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IHRvIHNlYXJjaCBhZ2FpbnN0XG4gKiBAcmV0dXJucyB7T2JqZWN0fFVuZGVmaW5lZH0gdmFsdWVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIF9nZXRQYXRoVmFsdWUgKHBhcnNlZCwgb2JqKSB7XG4gIHZhciB0bXAgPSBvYmpcbiAgICAsIHJlcztcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBwYXJzZWQubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgdmFyIHBhcnQgPSBwYXJzZWRbaV07XG4gICAgaWYgKHRtcCkge1xuICAgICAgaWYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgcGFydC5wKVxuICAgICAgICB0bXAgPSB0bXBbcGFydC5wXTtcbiAgICAgIGVsc2UgaWYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgcGFydC5pKVxuICAgICAgICB0bXAgPSB0bXBbcGFydC5pXTtcbiAgICAgIGlmIChpID09IChsIC0gMSkpIHJlcyA9IHRtcDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIGdldFByb3BlcnRpZXMgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIC5nZXRQcm9wZXJ0aWVzKG9iamVjdClcbiAqXG4gKiBUaGlzIGFsbG93cyB0aGUgcmV0cmlldmFsIG9mIHByb3BlcnR5IG5hbWVzIG9mIGFuIG9iamVjdCwgZW51bWVyYWJsZSBvciBub3QsXG4gKiBpbmhlcml0ZWQgb3Igbm90LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqIEBuYW1lIGdldFByb3BlcnRpZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBnZXRQcm9wZXJ0aWVzKG9iamVjdCkge1xuICB2YXIgcmVzdWx0ID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoc3ViamVjdCk7XG5cbiAgZnVuY3Rpb24gYWRkUHJvcGVydHkocHJvcGVydHkpIHtcbiAgICBpZiAocmVzdWx0LmluZGV4T2YocHJvcGVydHkpID09PSAtMSkge1xuICAgICAgcmVzdWx0LnB1c2gocHJvcGVydHkpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihzdWJqZWN0KTtcbiAgd2hpbGUgKHByb3RvICE9PSBudWxsKSB7XG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocHJvdG8pLmZvckVhY2goYWRkUHJvcGVydHkpO1xuICAgIHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuIiwiLyohXG4gKiBjaGFpXG4gKiBDb3B5cmlnaHQoYykgMjAxMSBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogTWFpbiBleHBvcnRzXG4gKi9cblxudmFyIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vKiFcbiAqIHRlc3QgdXRpbGl0eVxuICovXG5cbmV4cG9ydHMudGVzdCA9IHJlcXVpcmUoJy4vdGVzdCcpO1xuXG4vKiFcbiAqIHR5cGUgdXRpbGl0eVxuICovXG5cbmV4cG9ydHMudHlwZSA9IHJlcXVpcmUoJy4vdHlwZScpO1xuXG4vKiFcbiAqIG1lc3NhZ2UgdXRpbGl0eVxuICovXG5cbmV4cG9ydHMuZ2V0TWVzc2FnZSA9IHJlcXVpcmUoJy4vZ2V0TWVzc2FnZScpO1xuXG4vKiFcbiAqIGFjdHVhbCB1dGlsaXR5XG4gKi9cblxuZXhwb3J0cy5nZXRBY3R1YWwgPSByZXF1aXJlKCcuL2dldEFjdHVhbCcpO1xuXG4vKiFcbiAqIEluc3BlY3QgdXRpbFxuICovXG5cbmV4cG9ydHMuaW5zcGVjdCA9IHJlcXVpcmUoJy4vaW5zcGVjdCcpO1xuXG4vKiFcbiAqIE9iamVjdCBEaXNwbGF5IHV0aWxcbiAqL1xuXG5leHBvcnRzLm9iakRpc3BsYXkgPSByZXF1aXJlKCcuL29iakRpc3BsYXknKTtcblxuLyohXG4gKiBGbGFnIHV0aWxpdHlcbiAqL1xuXG5leHBvcnRzLmZsYWcgPSByZXF1aXJlKCcuL2ZsYWcnKTtcblxuLyohXG4gKiBGbGFnIHRyYW5zZmVycmluZyB1dGlsaXR5XG4gKi9cblxuZXhwb3J0cy50cmFuc2ZlckZsYWdzID0gcmVxdWlyZSgnLi90cmFuc2ZlckZsYWdzJyk7XG5cbi8qIVxuICogRGVlcCBlcXVhbCB1dGlsaXR5XG4gKi9cblxuZXhwb3J0cy5lcWwgPSByZXF1aXJlKCdkZWVwLWVxbCcpO1xuXG4vKiFcbiAqIERlZXAgcGF0aCB2YWx1ZVxuICovXG5cbmV4cG9ydHMuZ2V0UGF0aFZhbHVlID0gcmVxdWlyZSgnLi9nZXRQYXRoVmFsdWUnKTtcblxuLyohXG4gKiBGdW5jdGlvbiBuYW1lXG4gKi9cblxuZXhwb3J0cy5nZXROYW1lID0gcmVxdWlyZSgnLi9nZXROYW1lJyk7XG5cbi8qIVxuICogYWRkIFByb3BlcnR5XG4gKi9cblxuZXhwb3J0cy5hZGRQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vYWRkUHJvcGVydHknKTtcblxuLyohXG4gKiBhZGQgTWV0aG9kXG4gKi9cblxuZXhwb3J0cy5hZGRNZXRob2QgPSByZXF1aXJlKCcuL2FkZE1ldGhvZCcpO1xuXG4vKiFcbiAqIG92ZXJ3cml0ZSBQcm9wZXJ0eVxuICovXG5cbmV4cG9ydHMub3ZlcndyaXRlUHJvcGVydHkgPSByZXF1aXJlKCcuL292ZXJ3cml0ZVByb3BlcnR5Jyk7XG5cbi8qIVxuICogb3ZlcndyaXRlIE1ldGhvZFxuICovXG5cbmV4cG9ydHMub3ZlcndyaXRlTWV0aG9kID0gcmVxdWlyZSgnLi9vdmVyd3JpdGVNZXRob2QnKTtcblxuLyohXG4gKiBBZGQgYSBjaGFpbmFibGUgbWV0aG9kXG4gKi9cblxuZXhwb3J0cy5hZGRDaGFpbmFibGVNZXRob2QgPSByZXF1aXJlKCcuL2FkZENoYWluYWJsZU1ldGhvZCcpO1xuXG4vKiFcbiAqIE92ZXJ3cml0ZSBjaGFpbmFibGUgbWV0aG9kXG4gKi9cblxuZXhwb3J0cy5vdmVyd3JpdGVDaGFpbmFibGVNZXRob2QgPSByZXF1aXJlKCcuL292ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZCcpO1xuXG4iLCIvLyBUaGlzIGlzIChhbG1vc3QpIGRpcmVjdGx5IGZyb20gTm9kZS5qcyB1dGlsc1xuLy8gaHR0cHM6Ly9naXRodWIuY29tL2pveWVudC9ub2RlL2Jsb2IvZjhjMzM1ZDBjYWY0N2YxNmQzMTQxM2Y4OWFhMjhlZGEzODc4ZTNhYS9saWIvdXRpbC5qc1xuXG52YXIgZ2V0TmFtZSA9IHJlcXVpcmUoJy4vZ2V0TmFtZScpO1xudmFyIGdldFByb3BlcnRpZXMgPSByZXF1aXJlKCcuL2dldFByb3BlcnRpZXMnKTtcbnZhciBnZXRFbnVtZXJhYmxlUHJvcGVydGllcyA9IHJlcXVpcmUoJy4vZ2V0RW51bWVyYWJsZVByb3BlcnRpZXMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbnNwZWN0O1xuXG4vKipcbiAqIEVjaG9zIHRoZSB2YWx1ZSBvZiBhIHZhbHVlLiBUcnlzIHRvIHByaW50IHRoZSB2YWx1ZSBvdXRcbiAqIGluIHRoZSBiZXN0IHdheSBwb3NzaWJsZSBnaXZlbiB0aGUgZGlmZmVyZW50IHR5cGVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIG9iamVjdCB0byBwcmludCBvdXQuXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHNob3dIaWRkZW4gRmxhZyB0aGF0IHNob3dzIGhpZGRlbiAobm90IGVudW1lcmFibGUpXG4gKiAgICBwcm9wZXJ0aWVzIG9mIG9iamVjdHMuXG4gKiBAcGFyYW0ge051bWJlcn0gZGVwdGggRGVwdGggaW4gd2hpY2ggdG8gZGVzY2VuZCBpbiBvYmplY3QuIERlZmF1bHQgaXMgMi5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gY29sb3JzIEZsYWcgdG8gdHVybiBvbiBBTlNJIGVzY2FwZSBjb2RlcyB0byBjb2xvciB0aGVcbiAqICAgIG91dHB1dC4gRGVmYXVsdCBpcyBmYWxzZSAobm8gY29sb3JpbmcpLlxuICovXG5mdW5jdGlvbiBpbnNwZWN0KG9iaiwgc2hvd0hpZGRlbiwgZGVwdGgsIGNvbG9ycykge1xuICB2YXIgY3R4ID0ge1xuICAgIHNob3dIaWRkZW46IHNob3dIaWRkZW4sXG4gICAgc2VlbjogW10sXG4gICAgc3R5bGl6ZTogZnVuY3Rpb24gKHN0cikgeyByZXR1cm4gc3RyOyB9XG4gIH07XG4gIHJldHVybiBmb3JtYXRWYWx1ZShjdHgsIG9iaiwgKHR5cGVvZiBkZXB0aCA9PT0gJ3VuZGVmaW5lZCcgPyAyIDogZGVwdGgpKTtcbn1cblxuLy8gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vMTA0NDEyOC9cbnZhciBnZXRPdXRlckhUTUwgPSBmdW5jdGlvbihlbGVtZW50KSB7XG4gIGlmICgnb3V0ZXJIVE1MJyBpbiBlbGVtZW50KSByZXR1cm4gZWxlbWVudC5vdXRlckhUTUw7XG4gIHZhciBucyA9IFwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbFwiO1xuICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5zLCAnXycpO1xuICB2YXIgZWxlbVByb3RvID0gKHdpbmRvdy5IVE1MRWxlbWVudCB8fCB3aW5kb3cuRWxlbWVudCkucHJvdG90eXBlO1xuICB2YXIgeG1sU2VyaWFsaXplciA9IG5ldyBYTUxTZXJpYWxpemVyKCk7XG4gIHZhciBodG1sO1xuICBpZiAoZG9jdW1lbnQueG1sVmVyc2lvbikge1xuICAgIHJldHVybiB4bWxTZXJpYWxpemVyLnNlcmlhbGl6ZVRvU3RyaW5nKGVsZW1lbnQpO1xuICB9IGVsc2Uge1xuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChlbGVtZW50LmNsb25lTm9kZShmYWxzZSkpO1xuICAgIGh0bWwgPSBjb250YWluZXIuaW5uZXJIVE1MLnJlcGxhY2UoJz48JywgJz4nICsgZWxlbWVudC5pbm5lckhUTUwgKyAnPCcpO1xuICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcbiAgICByZXR1cm4gaHRtbDtcbiAgfVxufTtcblxuLy8gUmV0dXJucyB0cnVlIGlmIG9iamVjdCBpcyBhIERPTSBlbGVtZW50LlxudmFyIGlzRE9NRWxlbWVudCA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgaWYgKHR5cGVvZiBIVE1MRWxlbWVudCA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gb2JqZWN0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG9iamVjdCAmJlxuICAgICAgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIG9iamVjdC5ub2RlVHlwZSA9PT0gMSAmJlxuICAgICAgdHlwZW9mIG9iamVjdC5ub2RlTmFtZSA9PT0gJ3N0cmluZyc7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcykge1xuICAvLyBQcm92aWRlIGEgaG9vayBmb3IgdXNlci1zcGVjaWZpZWQgaW5zcGVjdCBmdW5jdGlvbnMuXG4gIC8vIENoZWNrIHRoYXQgdmFsdWUgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5zcGVjdCBmdW5jdGlvbiBvbiBpdFxuICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlLmluc3BlY3QgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgIC8vIEZpbHRlciBvdXQgdGhlIHV0aWwgbW9kdWxlLCBpdCdzIGluc3BlY3QgZnVuY3Rpb24gaXMgc3BlY2lhbFxuICAgICAgdmFsdWUuaW5zcGVjdCAhPT0gZXhwb3J0cy5pbnNwZWN0ICYmXG4gICAgICAvLyBBbHNvIGZpbHRlciBvdXQgYW55IHByb3RvdHlwZSBvYmplY3RzIHVzaW5nIHRoZSBjaXJjdWxhciBjaGVjay5cbiAgICAgICEodmFsdWUuY29uc3RydWN0b3IgJiYgdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlID09PSB2YWx1ZSkpIHtcbiAgICB2YXIgcmV0ID0gdmFsdWUuaW5zcGVjdChyZWN1cnNlVGltZXMpO1xuICAgIGlmICh0eXBlb2YgcmV0ICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0ID0gZm9ybWF0VmFsdWUoY3R4LCByZXQsIHJlY3Vyc2VUaW1lcyk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvLyBQcmltaXRpdmUgdHlwZXMgY2Fubm90IGhhdmUgcHJvcGVydGllc1xuICB2YXIgcHJpbWl0aXZlID0gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpO1xuICBpZiAocHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIHByaW1pdGl2ZTtcbiAgfVxuXG4gIC8vIElmIGl0J3MgRE9NIGVsZW0sIGdldCBvdXRlciBIVE1MLlxuICBpZiAoaXNET01FbGVtZW50KHZhbHVlKSkge1xuICAgIHJldHVybiBnZXRPdXRlckhUTUwodmFsdWUpO1xuICB9XG5cbiAgLy8gTG9vayB1cCB0aGUga2V5cyBvZiB0aGUgb2JqZWN0LlxuICB2YXIgdmlzaWJsZUtleXMgPSBnZXRFbnVtZXJhYmxlUHJvcGVydGllcyh2YWx1ZSk7XG4gIHZhciBrZXlzID0gY3R4LnNob3dIaWRkZW4gPyBnZXRQcm9wZXJ0aWVzKHZhbHVlKSA6IHZpc2libGVLZXlzO1xuXG4gIC8vIFNvbWUgdHlwZSBvZiBvYmplY3Qgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZC5cbiAgLy8gSW4gSUUsIGVycm9ycyBoYXZlIGEgc2luZ2xlIGBzdGFja2AgcHJvcGVydHksIG9yIGlmIHRoZXkgYXJlIHZhbmlsbGEgYEVycm9yYCxcbiAgLy8gYSBgc3RhY2tgIHBsdXMgYGRlc2NyaXB0aW9uYCBwcm9wZXJ0eTsgaWdub3JlIHRob3NlIGZvciBjb25zaXN0ZW5jeS5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwIHx8IChpc0Vycm9yKHZhbHVlKSAmJiAoXG4gICAgICAoa2V5cy5sZW5ndGggPT09IDEgJiYga2V5c1swXSA9PT0gJ3N0YWNrJykgfHxcbiAgICAgIChrZXlzLmxlbmd0aCA9PT0gMiAmJiBrZXlzWzBdID09PSAnZGVzY3JpcHRpb24nICYmIGtleXNbMV0gPT09ICdzdGFjaycpXG4gICAgICkpKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdmFyIG5hbWUgPSBnZXROYW1lKHZhbHVlKTtcbiAgICAgIHZhciBuYW1lU3VmZml4ID0gbmFtZSA/ICc6ICcgKyBuYW1lIDogJyc7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tGdW5jdGlvbicgKyBuYW1lU3VmZml4ICsgJ10nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH1cbiAgICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKERhdGUucHJvdG90eXBlLnRvVVRDU3RyaW5nLmNhbGwodmFsdWUpLCAnZGF0ZScpO1xuICAgIH1cbiAgICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIGJhc2UgPSAnJywgYXJyYXkgPSBmYWxzZSwgYnJhY2VzID0gWyd7JywgJ30nXTtcblxuICAvLyBNYWtlIEFycmF5IHNheSB0aGF0IHRoZXkgYXJlIEFycmF5XG4gIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgIGFycmF5ID0gdHJ1ZTtcbiAgICBicmFjZXMgPSBbJ1snLCAnXSddO1xuICB9XG5cbiAgLy8gTWFrZSBmdW5jdGlvbnMgc2F5IHRoYXQgdGhleSBhcmUgZnVuY3Rpb25zXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICB2YXIgbmFtZSA9IGdldE5hbWUodmFsdWUpO1xuICAgIHZhciBuYW1lU3VmZml4ID0gbmFtZSA/ICc6ICcgKyBuYW1lIDogJyc7XG4gICAgYmFzZSA9ICcgW0Z1bmN0aW9uJyArIG5hbWVTdWZmaXggKyAnXSc7XG4gIH1cblxuICAvLyBNYWtlIFJlZ0V4cHMgc2F5IHRoYXQgdGhleSBhcmUgUmVnRXhwc1xuICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGRhdGVzIHdpdGggcHJvcGVydGllcyBmaXJzdCBzYXkgdGhlIGRhdGVcbiAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgRGF0ZS5wcm90b3R5cGUudG9VVENTdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGVycm9yIHdpdGggbWVzc2FnZSBmaXJzdCBzYXkgdGhlIGVycm9yXG4gIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICBpZiAoa2V5cy5sZW5ndGggPT09IDAgJiYgKCFhcnJheSB8fCB2YWx1ZS5sZW5ndGggPT0gMCkpIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArIGJyYWNlc1sxXTtcbiAgfVxuXG4gIGlmIChyZWN1cnNlVGltZXMgPCAwKSB7XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbT2JqZWN0XScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG5cbiAgY3R4LnNlZW4ucHVzaCh2YWx1ZSk7XG5cbiAgdmFyIG91dHB1dDtcbiAgaWYgKGFycmF5KSB7XG4gICAgb3V0cHV0ID0gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cyk7XG4gIH0gZWxzZSB7XG4gICAgb3V0cHV0ID0ga2V5cy5tYXAoZnVuY3Rpb24oa2V5KSB7XG4gICAgICByZXR1cm4gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSk7XG4gICAgfSk7XG4gIH1cblxuICBjdHguc2Vlbi5wb3AoKTtcblxuICByZXR1cm4gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKSB7XG4gIHN3aXRjaCAodHlwZW9mIHZhbHVlKSB7XG4gICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgndW5kZWZpbmVkJywgJ3VuZGVmaW5lZCcpO1xuXG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIHZhciBzaW1wbGUgPSAnXFwnJyArIEpTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC9eXCJ8XCIkL2csICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJykgKyAnXFwnJztcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShzaW1wbGUsICdzdHJpbmcnKTtcblxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ251bWJlcicpO1xuXG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ2Jvb2xlYW4nKTtcbiAgfVxuICAvLyBGb3Igc29tZSByZWFzb24gdHlwZW9mIG51bGwgaXMgXCJvYmplY3RcIiwgc28gc3BlY2lhbCBjYXNlIGhlcmUuXG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnbnVsbCcsICdudWxsJyk7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRFcnJvcih2YWx1ZSkge1xuICByZXR1cm4gJ1snICsgRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpICsgJ10nO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHZhbHVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodmFsdWUsIFN0cmluZyhpKSkpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAgU3RyaW5nKGkpLCB0cnVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC5wdXNoKCcnKTtcbiAgICB9XG4gIH1cbiAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgIGlmICgha2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBrZXksIHRydWUpKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpIHtcbiAgdmFyIG5hbWUsIHN0cjtcbiAgaWYgKHZhbHVlLl9fbG9va3VwR2V0dGVyX18pIHtcbiAgICBpZiAodmFsdWUuX19sb29rdXBHZXR0ZXJfXyhrZXkpKSB7XG4gICAgICBpZiAodmFsdWUuX19sb29rdXBTZXR0ZXJfXyhrZXkpKSB7XG4gICAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyL1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHZhbHVlLl9fbG9va3VwU2V0dGVyX18oa2V5KSkge1xuICAgICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAodmlzaWJsZUtleXMuaW5kZXhPZihrZXkpIDwgMCkge1xuICAgIG5hbWUgPSAnWycgKyBrZXkgKyAnXSc7XG4gIH1cbiAgaWYgKCFzdHIpIHtcbiAgICBpZiAoY3R4LnNlZW4uaW5kZXhPZih2YWx1ZVtrZXldKSA8IDApIHtcbiAgICAgIGlmIChyZWN1cnNlVGltZXMgPT09IG51bGwpIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCB2YWx1ZVtrZXldLCBudWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgdmFsdWVba2V5XSwgcmVjdXJzZVRpbWVzIC0gMSk7XG4gICAgICB9XG4gICAgICBpZiAoc3RyLmluZGV4T2YoJ1xcbicpID4gLTEpIHtcbiAgICAgICAgaWYgKGFycmF5KSB7XG4gICAgICAgICAgc3RyID0gc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpLnN1YnN0cigyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdHIgPSAnXFxuJyArIHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tDaXJjdWxhcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAodHlwZW9mIG5hbWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKGFycmF5ICYmIGtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIG5hbWUgPSBKU09OLnN0cmluZ2lmeSgnJyArIGtleSk7XG4gICAgaWYgKG5hbWUubWF0Y2goL15cIihbYS16QS1aX11bYS16QS1aXzAtOV0qKVwiJC8pKSB7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHIoMSwgbmFtZS5sZW5ndGggLSAyKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnbmFtZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lID0gbmFtZS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKF5cInxcIiQpL2csIFwiJ1wiKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnc3RyaW5nJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWUgKyAnOiAnICsgc3RyO1xufVxuXG5cbmZ1bmN0aW9uIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKSB7XG4gIHZhciBudW1MaW5lc0VzdCA9IDA7XG4gIHZhciBsZW5ndGggPSBvdXRwdXQucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cikge1xuICAgIG51bUxpbmVzRXN0Kys7XG4gICAgaWYgKGN1ci5pbmRleE9mKCdcXG4nKSA+PSAwKSBudW1MaW5lc0VzdCsrO1xuICAgIHJldHVybiBwcmV2ICsgY3VyLmxlbmd0aCArIDE7XG4gIH0sIDApO1xuXG4gIGlmIChsZW5ndGggPiA2MCkge1xuICAgIHJldHVybiBicmFjZXNbMF0gK1xuICAgICAgICAgICAoYmFzZSA9PT0gJycgPyAnJyA6IGJhc2UgKyAnXFxuICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgYnJhY2VzWzFdO1xuICB9XG5cbiAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyAnICcgKyBvdXRwdXQuam9pbignLCAnKSArICcgJyArIGJyYWNlc1sxXTtcbn1cblxuZnVuY3Rpb24gaXNBcnJheShhcikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhcikgfHxcbiAgICAgICAgICh0eXBlb2YgYXIgPT09ICdvYmplY3QnICYmIG9iamVjdFRvU3RyaW5nKGFyKSA9PT0gJ1tvYmplY3QgQXJyYXldJyk7XG59XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiB0eXBlb2YgcmUgPT09ICdvYmplY3QnICYmIG9iamVjdFRvU3RyaW5nKHJlKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiB0eXBlb2YgZCA9PT0gJ29iamVjdCcgJiYgb2JqZWN0VG9TdHJpbmcoZCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn1cblxuZnVuY3Rpb24gaXNFcnJvcihlKSB7XG4gIHJldHVybiB0eXBlb2YgZSA9PT0gJ29iamVjdCcgJiYgb2JqZWN0VG9TdHJpbmcoZSkgPT09ICdbb2JqZWN0IEVycm9yXSc7XG59XG5cbmZ1bmN0aW9uIG9iamVjdFRvU3RyaW5nKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn1cbiIsIi8qIVxuICogQ2hhaSAtIGZsYWcgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGFuY2llc1xuICovXG5cbnZhciBpbnNwZWN0ID0gcmVxdWlyZSgnLi9pbnNwZWN0Jyk7XG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG5cbi8qKlxuICogIyMjIC5vYmpEaXNwbGF5IChvYmplY3QpXG4gKlxuICogRGV0ZXJtaW5lcyBpZiBhbiBvYmplY3Qgb3IgYW4gYXJyYXkgbWF0Y2hlc1xuICogY3JpdGVyaWEgdG8gYmUgaW5zcGVjdGVkIGluLWxpbmUgZm9yIGVycm9yXG4gKiBtZXNzYWdlcyBvciBzaG91bGQgYmUgdHJ1bmNhdGVkLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IGphdmFzY3JpcHQgb2JqZWN0IHRvIGluc3BlY3RcbiAqIEBuYW1lIG9iakRpc3BsYXlcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciBzdHIgPSBpbnNwZWN0KG9iailcbiAgICAsIHR5cGUgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcblxuICBpZiAoY29uZmlnLnRydW5jYXRlVGhyZXNob2xkICYmIHN0ci5sZW5ndGggPj0gY29uZmlnLnRydW5jYXRlVGhyZXNob2xkKSB7XG4gICAgaWYgKHR5cGUgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXScpIHtcbiAgICAgIHJldHVybiAhb2JqLm5hbWUgfHwgb2JqLm5hbWUgPT09ICcnXG4gICAgICAgID8gJ1tGdW5jdGlvbl0nXG4gICAgICAgIDogJ1tGdW5jdGlvbjogJyArIG9iai5uYW1lICsgJ10nO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgcmV0dXJuICdbIEFycmF5KCcgKyBvYmoubGVuZ3RoICsgJykgXSc7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnW29iamVjdCBPYmplY3RdJykge1xuICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopXG4gICAgICAgICwga3N0ciA9IGtleXMubGVuZ3RoID4gMlxuICAgICAgICAgID8ga2V5cy5zcGxpY2UoMCwgMikuam9pbignLCAnKSArICcsIC4uLidcbiAgICAgICAgICA6IGtleXMuam9pbignLCAnKTtcbiAgICAgIHJldHVybiAneyBPYmplY3QgKCcgKyBrc3RyICsgJykgfSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHI7XG4gIH1cbn07XG4iLCIvKiFcbiAqIENoYWkgLSBvdmVyd3JpdGVDaGFpbmFibGVNZXRob2QgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIG92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZCAoY3R4LCBuYW1lLCBmbilcbiAqXG4gKiBPdmVyd2l0ZXMgYW4gYWxyZWFkeSBleGlzdGluZyBjaGFpbmFibGUgbWV0aG9kXG4gKiBhbmQgcHJvdmlkZXMgYWNjZXNzIHRvIHRoZSBwcmV2aW91cyBmdW5jdGlvbiBvclxuICogcHJvcGVydHkuICBNdXN0IHJldHVybiBmdW5jdGlvbnMgdG8gYmUgdXNlZCBmb3JcbiAqIG5hbWUuXG4gKlxuICogICAgIHV0aWxzLm92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZChjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUsICdsZW5ndGgnLFxuICogICAgICAgZnVuY3Rpb24gKF9zdXBlcikge1xuICogICAgICAgfVxuICogICAgICwgZnVuY3Rpb24gKF9zdXBlcikge1xuICogICAgICAgfVxuICogICAgICk7XG4gKlxuICogQ2FuIGFsc28gYmUgYWNjZXNzZWQgZGlyZWN0bHkgZnJvbSBgY2hhaS5Bc3NlcnRpb25gLlxuICpcbiAqICAgICBjaGFpLkFzc2VydGlvbi5vdmVyd3JpdGVDaGFpbmFibGVNZXRob2QoJ2ZvbycsIGZuLCBmbik7XG4gKlxuICogVGhlbiBjYW4gYmUgdXNlZCBhcyBhbnkgb3RoZXIgYXNzZXJ0aW9uLlxuICpcbiAqICAgICBleHBlY3QobXlGb28pLnRvLmhhdmUubGVuZ3RoKDMpO1xuICogICAgIGV4cGVjdChteUZvbykudG8uaGF2ZS5sZW5ndGguYWJvdmUoMyk7XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGN0eCBvYmplY3Qgd2hvc2UgbWV0aG9kIC8gcHJvcGVydHkgaXMgdG8gYmUgb3ZlcndyaXR0ZW5cbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG9mIG1ldGhvZCAvIHByb3BlcnR5IHRvIG92ZXJ3cml0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gbWV0aG9kIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGZ1bmN0aW9uIHRvIGJlIHVzZWQgZm9yIG5hbWVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNoYWluaW5nQmVoYXZpb3IgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgZnVuY3Rpb24gdG8gYmUgdXNlZCBmb3IgcHJvcGVydHlcbiAqIEBuYW1lIG92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjdHgsIG5hbWUsIG1ldGhvZCwgY2hhaW5pbmdCZWhhdmlvcikge1xuICB2YXIgY2hhaW5hYmxlQmVoYXZpb3IgPSBjdHguX19tZXRob2RzW25hbWVdO1xuXG4gIHZhciBfY2hhaW5pbmdCZWhhdmlvciA9IGNoYWluYWJsZUJlaGF2aW9yLmNoYWluaW5nQmVoYXZpb3I7XG4gIGNoYWluYWJsZUJlaGF2aW9yLmNoYWluaW5nQmVoYXZpb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IGNoYWluaW5nQmVoYXZpb3IoX2NoYWluaW5nQmVoYXZpb3IpLmNhbGwodGhpcyk7XG4gICAgcmV0dXJuIHJlc3VsdCA9PT0gdW5kZWZpbmVkID8gdGhpcyA6IHJlc3VsdDtcbiAgfTtcblxuICB2YXIgX21ldGhvZCA9IGNoYWluYWJsZUJlaGF2aW9yLm1ldGhvZDtcbiAgY2hhaW5hYmxlQmVoYXZpb3IubWV0aG9kID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSBtZXRob2QoX21ldGhvZCkuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQgPyB0aGlzIDogcmVzdWx0O1xuICB9O1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIG92ZXJ3cml0ZU1ldGhvZCB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgb3ZlcndyaXRlTWV0aG9kIChjdHgsIG5hbWUsIGZuKVxuICpcbiAqIE92ZXJ3aXRlcyBhbiBhbHJlYWR5IGV4aXN0aW5nIG1ldGhvZCBhbmQgcHJvdmlkZXNcbiAqIGFjY2VzcyB0byBwcmV2aW91cyBmdW5jdGlvbi4gTXVzdCByZXR1cm4gZnVuY3Rpb25cbiAqIHRvIGJlIHVzZWQgZm9yIG5hbWUuXG4gKlxuICogICAgIHV0aWxzLm92ZXJ3cml0ZU1ldGhvZChjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUsICdlcXVhbCcsIGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAqICAgICAgIHJldHVybiBmdW5jdGlvbiAoc3RyKSB7XG4gKiAgICAgICAgIHZhciBvYmogPSB1dGlscy5mbGFnKHRoaXMsICdvYmplY3QnKTtcbiAqICAgICAgICAgaWYgKG9iaiBpbnN0YW5jZW9mIEZvbykge1xuICogICAgICAgICAgIG5ldyBjaGFpLkFzc2VydGlvbihvYmoudmFsdWUpLnRvLmVxdWFsKHN0cik7XG4gKiAgICAgICAgIH0gZWxzZSB7XG4gKiAgICAgICAgICAgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gKiAgICAgICAgIH1cbiAqICAgICAgIH1cbiAqICAgICB9KTtcbiAqXG4gKiBDYW4gYWxzbyBiZSBhY2Nlc3NlZCBkaXJlY3RseSBmcm9tIGBjaGFpLkFzc2VydGlvbmAuXG4gKlxuICogICAgIGNoYWkuQXNzZXJ0aW9uLm92ZXJ3cml0ZU1ldGhvZCgnZm9vJywgZm4pO1xuICpcbiAqIFRoZW4gY2FuIGJlIHVzZWQgYXMgYW55IG90aGVyIGFzc2VydGlvbi5cbiAqXG4gKiAgICAgZXhwZWN0KG15Rm9vKS50by5lcXVhbCgnYmFyJyk7XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGN0eCBvYmplY3Qgd2hvc2UgbWV0aG9kIGlzIHRvIGJlIG92ZXJ3cml0dGVuXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBvZiBtZXRob2QgdG8gb3ZlcndyaXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBtZXRob2QgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgZnVuY3Rpb24gdG8gYmUgdXNlZCBmb3IgbmFtZVxuICogQG5hbWUgb3ZlcndyaXRlTWV0aG9kXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGN0eCwgbmFtZSwgbWV0aG9kKSB7XG4gIHZhciBfbWV0aG9kID0gY3R4W25hbWVdXG4gICAgLCBfc3VwZXIgPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9O1xuXG4gIGlmIChfbWV0aG9kICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBfbWV0aG9kKVxuICAgIF9zdXBlciA9IF9tZXRob2Q7XG5cbiAgY3R4W25hbWVdID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSBtZXRob2QoX3N1cGVyKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIHJldHVybiByZXN1bHQgPT09IHVuZGVmaW5lZCA/IHRoaXMgOiByZXN1bHQ7XG4gIH1cbn07XG4iLCIvKiFcbiAqIENoYWkgLSBvdmVyd3JpdGVQcm9wZXJ0eSB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgb3ZlcndyaXRlUHJvcGVydHkgKGN0eCwgbmFtZSwgZm4pXG4gKlxuICogT3ZlcndpdGVzIGFuIGFscmVhZHkgZXhpc3RpbmcgcHJvcGVydHkgZ2V0dGVyIGFuZCBwcm92aWRlc1xuICogYWNjZXNzIHRvIHByZXZpb3VzIHZhbHVlLiBNdXN0IHJldHVybiBmdW5jdGlvbiB0byB1c2UgYXMgZ2V0dGVyLlxuICpcbiAqICAgICB1dGlscy5vdmVyd3JpdGVQcm9wZXJ0eShjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUsICdvaycsIGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAqICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gKiAgICAgICAgIHZhciBvYmogPSB1dGlscy5mbGFnKHRoaXMsICdvYmplY3QnKTtcbiAqICAgICAgICAgaWYgKG9iaiBpbnN0YW5jZW9mIEZvbykge1xuICogICAgICAgICAgIG5ldyBjaGFpLkFzc2VydGlvbihvYmoubmFtZSkudG8uZXF1YWwoJ2JhcicpO1xuICogICAgICAgICB9IGVsc2Uge1xuICogICAgICAgICAgIF9zdXBlci5jYWxsKHRoaXMpO1xuICogICAgICAgICB9XG4gKiAgICAgICB9XG4gKiAgICAgfSk7XG4gKlxuICpcbiAqIENhbiBhbHNvIGJlIGFjY2Vzc2VkIGRpcmVjdGx5IGZyb20gYGNoYWkuQXNzZXJ0aW9uYC5cbiAqXG4gKiAgICAgY2hhaS5Bc3NlcnRpb24ub3ZlcndyaXRlUHJvcGVydHkoJ2ZvbycsIGZuKTtcbiAqXG4gKiBUaGVuIGNhbiBiZSB1c2VkIGFzIGFueSBvdGhlciBhc3NlcnRpb24uXG4gKlxuICogICAgIGV4cGVjdChteUZvbykudG8uYmUub2s7XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGN0eCBvYmplY3Qgd2hvc2UgcHJvcGVydHkgaXMgdG8gYmUgb3ZlcndyaXR0ZW5cbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG9mIHByb3BlcnR5IHRvIG92ZXJ3cml0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZ2V0dGVyIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGdldHRlciBmdW5jdGlvbiB0byBiZSB1c2VkIGZvciBuYW1lXG4gKiBAbmFtZSBvdmVyd3JpdGVQcm9wZXJ0eVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjdHgsIG5hbWUsIGdldHRlcikge1xuICB2YXIgX2dldCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoY3R4LCBuYW1lKVxuICAgICwgX3N1cGVyID0gZnVuY3Rpb24gKCkge307XG5cbiAgaWYgKF9nZXQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIF9nZXQuZ2V0KVxuICAgIF9zdXBlciA9IF9nZXQuZ2V0XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGN0eCwgbmFtZSxcbiAgICB7IGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gZ2V0dGVyKF9zdXBlcikuY2FsbCh0aGlzKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdCA9PT0gdW5kZWZpbmVkID8gdGhpcyA6IHJlc3VsdDtcbiAgICAgIH1cbiAgICAsIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICB9KTtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSB0ZXN0IHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRhbmNpZXNcbiAqL1xuXG52YXIgZmxhZyA9IHJlcXVpcmUoJy4vZmxhZycpO1xuXG4vKipcbiAqICMgdGVzdChvYmplY3QsIGV4cHJlc3Npb24pXG4gKlxuICogVGVzdCBhbmQgb2JqZWN0IGZvciBleHByZXNzaW9uLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgKGNvbnN0cnVjdGVkIEFzc2VydGlvbilcbiAqIEBwYXJhbSB7QXJndW1lbnRzfSBjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUuYXNzZXJ0IGFyZ3VtZW50c1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaiwgYXJncykge1xuICB2YXIgbmVnYXRlID0gZmxhZyhvYmosICduZWdhdGUnKVxuICAgICwgZXhwciA9IGFyZ3NbMF07XG4gIHJldHVybiBuZWdhdGUgPyAhZXhwciA6IGV4cHI7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gdHJhbnNmZXJGbGFncyB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgdHJhbnNmZXJGbGFncyhhc3NlcnRpb24sIG9iamVjdCwgaW5jbHVkZUFsbCA9IHRydWUpXG4gKlxuICogVHJhbnNmZXIgYWxsIHRoZSBmbGFncyBmb3IgYGFzc2VydGlvbmAgdG8gYG9iamVjdGAuIElmXG4gKiBgaW5jbHVkZUFsbGAgaXMgc2V0IHRvIGBmYWxzZWAsIHRoZW4gdGhlIGJhc2UgQ2hhaVxuICogYXNzZXJ0aW9uIGZsYWdzIChuYW1lbHkgYG9iamVjdGAsIGBzc2ZpYCwgYW5kIGBtZXNzYWdlYClcbiAqIHdpbGwgbm90IGJlIHRyYW5zZmVycmVkLlxuICpcbiAqXG4gKiAgICAgdmFyIG5ld0Fzc2VydGlvbiA9IG5ldyBBc3NlcnRpb24oKTtcbiAqICAgICB1dGlscy50cmFuc2ZlckZsYWdzKGFzc2VydGlvbiwgbmV3QXNzZXJ0aW9uKTtcbiAqXG4gKiAgICAgdmFyIGFub3RoZXJBc3Nlcml0b24gPSBuZXcgQXNzZXJ0aW9uKG15T2JqKTtcbiAqICAgICB1dGlscy50cmFuc2ZlckZsYWdzKGFzc2VydGlvbiwgYW5vdGhlckFzc2VydGlvbiwgZmFsc2UpO1xuICpcbiAqIEBwYXJhbSB7QXNzZXJ0aW9ufSBhc3NlcnRpb24gdGhlIGFzc2VydGlvbiB0byB0cmFuc2ZlciB0aGUgZmxhZ3MgZnJvbVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCB0aGUgb2JqZWN0IHRvIHRyYW5zZmVyIHRoZSBmbGFncyB0b287IHVzdWFsbHkgYSBuZXcgYXNzZXJ0aW9uXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGluY2x1ZGVBbGxcbiAqIEBuYW1lIGdldEFsbEZsYWdzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhc3NlcnRpb24sIG9iamVjdCwgaW5jbHVkZUFsbCkge1xuICB2YXIgZmxhZ3MgPSBhc3NlcnRpb24uX19mbGFncyB8fCAoYXNzZXJ0aW9uLl9fZmxhZ3MgPSBPYmplY3QuY3JlYXRlKG51bGwpKTtcblxuICBpZiAoIW9iamVjdC5fX2ZsYWdzKSB7XG4gICAgb2JqZWN0Ll9fZmxhZ3MgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB9XG5cbiAgaW5jbHVkZUFsbCA9IGFyZ3VtZW50cy5sZW5ndGggPT09IDMgPyBpbmNsdWRlQWxsIDogdHJ1ZTtcblxuICBmb3IgKHZhciBmbGFnIGluIGZsYWdzKSB7XG4gICAgaWYgKGluY2x1ZGVBbGwgfHxcbiAgICAgICAgKGZsYWcgIT09ICdvYmplY3QnICYmIGZsYWcgIT09ICdzc2ZpJyAmJiBmbGFnICE9ICdtZXNzYWdlJykpIHtcbiAgICAgIG9iamVjdC5fX2ZsYWdzW2ZsYWddID0gZmxhZ3NbZmxhZ107XG4gICAgfVxuICB9XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gdHlwZSB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyohXG4gKiBEZXRlY3RhYmxlIGphdmFzY3JpcHQgbmF0aXZlc1xuICovXG5cbnZhciBuYXRpdmVzID0ge1xuICAgICdbb2JqZWN0IEFyZ3VtZW50c10nOiAnYXJndW1lbnRzJ1xuICAsICdbb2JqZWN0IEFycmF5XSc6ICdhcnJheSdcbiAgLCAnW29iamVjdCBEYXRlXSc6ICdkYXRlJ1xuICAsICdbb2JqZWN0IEZ1bmN0aW9uXSc6ICdmdW5jdGlvbidcbiAgLCAnW29iamVjdCBOdW1iZXJdJzogJ251bWJlcidcbiAgLCAnW29iamVjdCBSZWdFeHBdJzogJ3JlZ2V4cCdcbiAgLCAnW29iamVjdCBTdHJpbmddJzogJ3N0cmluZydcbn07XG5cbi8qKlxuICogIyMjIHR5cGUob2JqZWN0KVxuICpcbiAqIEJldHRlciBpbXBsZW1lbnRhdGlvbiBvZiBgdHlwZW9mYCBkZXRlY3Rpb24gdGhhdCBjYW5cbiAqIGJlIHVzZWQgY3Jvc3MtYnJvd3Nlci4gSGFuZGxlcyB0aGUgaW5jb25zaXN0ZW5jaWVzIG9mXG4gKiBBcnJheSwgYG51bGxgLCBhbmQgYHVuZGVmaW5lZGAgZGV0ZWN0aW9uLlxuICpcbiAqICAgICB1dGlscy50eXBlKHt9KSAvLyAnb2JqZWN0J1xuICogICAgIHV0aWxzLnR5cGUobnVsbCkgLy8gYG51bGwnXG4gKiAgICAgdXRpbHMudHlwZSh1bmRlZmluZWQpIC8vIGB1bmRlZmluZWRgXG4gKiAgICAgdXRpbHMudHlwZShbXSkgLy8gYGFycmF5YFxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IG9iamVjdCB0byBkZXRlY3QgdHlwZSBvZlxuICogQG5hbWUgdHlwZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcbiAgaWYgKG5hdGl2ZXNbc3RyXSkgcmV0dXJuIG5hdGl2ZXNbc3RyXTtcbiAgaWYgKG9iaiA9PT0gbnVsbCkgcmV0dXJuICdudWxsJztcbiAgaWYgKG9iaiA9PT0gdW5kZWZpbmVkKSByZXR1cm4gJ3VuZGVmaW5lZCc7XG4gIGlmIChvYmogPT09IE9iamVjdChvYmopKSByZXR1cm4gJ29iamVjdCc7XG4gIHJldHVybiB0eXBlb2Ygb2JqO1xufTtcbiIsIi8qIVxuICogYXNzZXJ0aW9uLWVycm9yXG4gKiBDb3B5cmlnaHQoYykgMjAxMyBKYWtlIEx1ZXIgPGpha2VAcXVhbGlhbmN5LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogUmV0dXJuIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGNvcHkgcHJvcGVydGllcyBmcm9tXG4gKiBvbmUgb2JqZWN0IHRvIGFub3RoZXIgZXhjbHVkaW5nIGFueSBvcmlnaW5hbGx5XG4gKiBsaXN0ZWQuIFJldHVybmVkIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgbmV3IGB7fWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV4Y2x1ZGVkIHByb3BlcnRpZXMgLi4uXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuXG5mdW5jdGlvbiBleGNsdWRlICgpIHtcbiAgdmFyIGV4Y2x1ZGVzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gIGZ1bmN0aW9uIGV4Y2x1ZGVQcm9wcyAocmVzLCBvYmopIHtcbiAgICBPYmplY3Qua2V5cyhvYmopLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgaWYgKCF+ZXhjbHVkZXMuaW5kZXhPZihrZXkpKSByZXNba2V5XSA9IG9ialtrZXldO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uIGV4dGVuZEV4Y2x1ZGUgKCkge1xuICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgICAsIGkgPSAwXG4gICAgICAsIHJlcyA9IHt9O1xuXG4gICAgZm9yICg7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBleGNsdWRlUHJvcHMocmVzLCBhcmdzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufTtcblxuLyohXG4gKiBQcmltYXJ5IEV4cG9ydHNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFzc2VydGlvbkVycm9yO1xuXG4vKipcbiAqICMjIyBBc3NlcnRpb25FcnJvclxuICpcbiAqIEFuIGV4dGVuc2lvbiBvZiB0aGUgSmF2YVNjcmlwdCBgRXJyb3JgIGNvbnN0cnVjdG9yIGZvclxuICogYXNzZXJ0aW9uIGFuZCB2YWxpZGF0aW9uIHNjZW5hcmlvcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICogQHBhcmFtIHtPYmplY3R9IHByb3BlcnRpZXMgdG8gaW5jbHVkZSAob3B0aW9uYWwpXG4gKiBAcGFyYW0ge2NhbGxlZX0gc3RhcnQgc3RhY2sgZnVuY3Rpb24gKG9wdGlvbmFsKVxuICovXG5cbmZ1bmN0aW9uIEFzc2VydGlvbkVycm9yIChtZXNzYWdlLCBfcHJvcHMsIHNzZikge1xuICB2YXIgZXh0ZW5kID0gZXhjbHVkZSgnbmFtZScsICdtZXNzYWdlJywgJ3N0YWNrJywgJ2NvbnN0cnVjdG9yJywgJ3RvSlNPTicpXG4gICAgLCBwcm9wcyA9IGV4dGVuZChfcHJvcHMgfHwge30pO1xuXG4gIC8vIGRlZmF1bHQgdmFsdWVzXG4gIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2UgfHwgJ1Vuc3BlY2lmaWVkIEFzc2VydGlvbkVycm9yJztcbiAgdGhpcy5zaG93RGlmZiA9IGZhbHNlO1xuXG4gIC8vIGNvcHkgZnJvbSBwcm9wZXJ0aWVzXG4gIGZvciAodmFyIGtleSBpbiBwcm9wcykge1xuICAgIHRoaXNba2V5XSA9IHByb3BzW2tleV07XG4gIH1cblxuICAvLyBjYXB0dXJlIHN0YWNrIHRyYWNlXG4gIHNzZiA9IHNzZiB8fCBhcmd1bWVudHMuY2FsbGVlO1xuICBpZiAoc3NmICYmIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKSB7XG4gICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgc3NmKTtcbiAgfVxufVxuXG4vKiFcbiAqIEluaGVyaXQgZnJvbSBFcnJvci5wcm90b3R5cGVcbiAqL1xuXG5Bc3NlcnRpb25FcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5cbi8qIVxuICogU3RhdGljYWxseSBzZXQgbmFtZVxuICovXG5cbkFzc2VydGlvbkVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0Fzc2VydGlvbkVycm9yJztcblxuLyohXG4gKiBFbnN1cmUgY29ycmVjdCBjb25zdHJ1Y3RvclxuICovXG5cbkFzc2VydGlvbkVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEFzc2VydGlvbkVycm9yO1xuXG4vKipcbiAqIEFsbG93IGVycm9ycyB0byBiZSBjb252ZXJ0ZWQgdG8gSlNPTiBmb3Igc3RhdGljIHRyYW5zZmVyLlxuICpcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gaW5jbHVkZSBzdGFjayAoZGVmYXVsdDogYHRydWVgKVxuICogQHJldHVybiB7T2JqZWN0fSBvYmplY3QgdGhhdCBjYW4gYmUgYEpTT04uc3RyaW5naWZ5YFxuICovXG5cbkFzc2VydGlvbkVycm9yLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiAoc3RhY2spIHtcbiAgdmFyIGV4dGVuZCA9IGV4Y2x1ZGUoJ2NvbnN0cnVjdG9yJywgJ3RvSlNPTicsICdzdGFjaycpXG4gICAgLCBwcm9wcyA9IGV4dGVuZCh7IG5hbWU6IHRoaXMubmFtZSB9LCB0aGlzKTtcblxuICAvLyBpbmNsdWRlIHN0YWNrIGlmIGV4aXN0cyBhbmQgbm90IHR1cm5lZCBvZmZcbiAgaWYgKGZhbHNlICE9PSBzdGFjayAmJiB0aGlzLnN0YWNrKSB7XG4gICAgcHJvcHMuc3RhY2sgPSB0aGlzLnN0YWNrO1xuICB9XG5cbiAgcmV0dXJuIHByb3BzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvZXFsJyk7XG4iLCIvKiFcbiAqIGRlZXAtZXFsXG4gKiBDb3B5cmlnaHQoYykgMjAxMyBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGVuY2llc1xuICovXG5cbnZhciB0eXBlID0gcmVxdWlyZSgndHlwZS1kZXRlY3QnKTtcblxuLyohXG4gKiBCdWZmZXIuaXNCdWZmZXIgYnJvd3NlciBzaGltXG4gKi9cblxudmFyIEJ1ZmZlcjtcbnRyeSB7IEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjsgfVxuY2F0Y2goZXgpIHtcbiAgQnVmZmVyID0ge307XG4gIEJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gZmFsc2U7IH1cbn1cblxuLyohXG4gKiBQcmltYXJ5IEV4cG9ydFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZGVlcEVxdWFsO1xuXG4vKipcbiAqIEFzc2VydCBzdXBlci1zdHJpY3QgKGVnYWwpIGVxdWFsaXR5IGJldHdlZW5cbiAqIHR3byBvYmplY3RzIG9mIGFueSB0eXBlLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IGFcbiAqIEBwYXJhbSB7TWl4ZWR9IGJcbiAqIEBwYXJhbSB7QXJyYXl9IG1lbW9pc2VkIChvcHRpb25hbClcbiAqIEByZXR1cm4ge0Jvb2xlYW59IGVxdWFsIG1hdGNoXG4gKi9cblxuZnVuY3Rpb24gZGVlcEVxdWFsKGEsIGIsIG0pIHtcbiAgaWYgKHNhbWVWYWx1ZShhLCBiKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2UgaWYgKCdkYXRlJyA9PT0gdHlwZShhKSkge1xuICAgIHJldHVybiBkYXRlRXF1YWwoYSwgYik7XG4gIH0gZWxzZSBpZiAoJ3JlZ2V4cCcgPT09IHR5cGUoYSkpIHtcbiAgICByZXR1cm4gcmVnZXhwRXF1YWwoYSwgYik7XG4gIH0gZWxzZSBpZiAoQnVmZmVyLmlzQnVmZmVyKGEpKSB7XG4gICAgcmV0dXJuIGJ1ZmZlckVxdWFsKGEsIGIpO1xuICB9IGVsc2UgaWYgKCdhcmd1bWVudHMnID09PSB0eXBlKGEpKSB7XG4gICAgcmV0dXJuIGFyZ3VtZW50c0VxdWFsKGEsIGIsIG0pO1xuICB9IGVsc2UgaWYgKCF0eXBlRXF1YWwoYSwgYikpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0gZWxzZSBpZiAoKCdvYmplY3QnICE9PSB0eXBlKGEpICYmICdvYmplY3QnICE9PSB0eXBlKGIpKVxuICAmJiAoJ2FycmF5JyAhPT0gdHlwZShhKSAmJiAnYXJyYXknICE9PSB0eXBlKGIpKSkge1xuICAgIHJldHVybiBzYW1lVmFsdWUoYSwgYik7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG9iamVjdEVxdWFsKGEsIGIsIG0pO1xuICB9XG59XG5cbi8qIVxuICogU3RyaWN0IChlZ2FsKSBlcXVhbGl0eSB0ZXN0LiBFbnN1cmVzIHRoYXQgTmFOIGFsd2F5c1xuICogZXF1YWxzIE5hTiBhbmQgYC0wYCBkb2VzIG5vdCBlcXVhbCBgKzBgLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IGFcbiAqIEBwYXJhbSB7TWl4ZWR9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IGVxdWFsIG1hdGNoXG4gKi9cblxuZnVuY3Rpb24gc2FtZVZhbHVlKGEsIGIpIHtcbiAgaWYgKGEgPT09IGIpIHJldHVybiBhICE9PSAwIHx8IDEgLyBhID09PSAxIC8gYjtcbiAgcmV0dXJuIGEgIT09IGEgJiYgYiAhPT0gYjtcbn1cblxuLyohXG4gKiBDb21wYXJlIHRoZSB0eXBlcyBvZiB0d28gZ2l2ZW4gb2JqZWN0cyBhbmRcbiAqIHJldHVybiBpZiB0aGV5IGFyZSBlcXVhbC4gTm90ZSB0aGF0IGFuIEFycmF5XG4gKiBoYXMgYSB0eXBlIG9mIGBhcnJheWAgKG5vdCBgb2JqZWN0YCkgYW5kIGFyZ3VtZW50c1xuICogaGF2ZSBhIHR5cGUgb2YgYGFyZ3VtZW50c2AgKG5vdCBgYXJyYXlgL2BvYmplY3RgKS5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBhXG4gKiBAcGFyYW0ge01peGVkfSBiXG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqL1xuXG5mdW5jdGlvbiB0eXBlRXF1YWwoYSwgYikge1xuICByZXR1cm4gdHlwZShhKSA9PT0gdHlwZShiKTtcbn1cblxuLyohXG4gKiBDb21wYXJlIHR3byBEYXRlIG9iamVjdHMgYnkgYXNzZXJ0aW5nIHRoYXRcbiAqIHRoZSB0aW1lIHZhbHVlcyBhcmUgZXF1YWwgdXNpbmcgYHNhdmVWYWx1ZWAuXG4gKlxuICogQHBhcmFtIHtEYXRlfSBhXG4gKiBAcGFyYW0ge0RhdGV9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIGRhdGVFcXVhbChhLCBiKSB7XG4gIGlmICgnZGF0ZScgIT09IHR5cGUoYikpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHNhbWVWYWx1ZShhLmdldFRpbWUoKSwgYi5nZXRUaW1lKCkpO1xufVxuXG4vKiFcbiAqIENvbXBhcmUgdHdvIHJlZ3VsYXIgZXhwcmVzc2lvbnMgYnkgY29udmVydGluZyB0aGVtXG4gKiB0byBzdHJpbmcgYW5kIGNoZWNraW5nIGZvciBgc2FtZVZhbHVlYC5cbiAqXG4gKiBAcGFyYW0ge1JlZ0V4cH0gYVxuICogQHBhcmFtIHtSZWdFeHB9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIHJlZ2V4cEVxdWFsKGEsIGIpIHtcbiAgaWYgKCdyZWdleHAnICE9PSB0eXBlKGIpKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBzYW1lVmFsdWUoYS50b1N0cmluZygpLCBiLnRvU3RyaW5nKCkpO1xufVxuXG4vKiFcbiAqIEFzc2VydCBkZWVwIGVxdWFsaXR5IG9mIHR3byBgYXJndW1lbnRzYCBvYmplY3RzLlxuICogVW5mb3J0dW5hdGVseSwgdGhlc2UgbXVzdCBiZSBzbGljZWQgdG8gYXJyYXlzXG4gKiBwcmlvciB0byB0ZXN0IHRvIGVuc3VyZSBubyBiYWQgYmVoYXZpb3IuXG4gKlxuICogQHBhcmFtIHtBcmd1bWVudHN9IGFcbiAqIEBwYXJhbSB7QXJndW1lbnRzfSBiXG4gKiBAcGFyYW0ge0FycmF5fSBtZW1vaXplIChvcHRpb25hbClcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIGFyZ3VtZW50c0VxdWFsKGEsIGIsIG0pIHtcbiAgaWYgKCdhcmd1bWVudHMnICE9PSB0eXBlKGIpKSByZXR1cm4gZmFsc2U7XG4gIGEgPSBbXS5zbGljZS5jYWxsKGEpO1xuICBiID0gW10uc2xpY2UuY2FsbChiKTtcbiAgcmV0dXJuIGRlZXBFcXVhbChhLCBiLCBtKTtcbn1cblxuLyohXG4gKiBHZXQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzIG9mIGEgZ2l2ZW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBhXG4gKiBAcmV0dXJuIHtBcnJheX0gcHJvcGVydHkgbmFtZXNcbiAqL1xuXG5mdW5jdGlvbiBlbnVtZXJhYmxlKGEpIHtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gYSkgcmVzLnB1c2goa2V5KTtcbiAgcmV0dXJuIHJlcztcbn1cblxuLyohXG4gKiBTaW1wbGUgZXF1YWxpdHkgZm9yIGZsYXQgaXRlcmFibGUgb2JqZWN0c1xuICogc3VjaCBhcyBBcnJheXMgb3IgTm9kZS5qcyBidWZmZXJzLlxuICpcbiAqIEBwYXJhbSB7SXRlcmFibGV9IGFcbiAqIEBwYXJhbSB7SXRlcmFibGV9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIGl0ZXJhYmxlRXF1YWwoYSwgYikge1xuICBpZiAoYS5sZW5ndGggIT09ICBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gIHZhciBpID0gMDtcbiAgdmFyIG1hdGNoID0gdHJ1ZTtcblxuICBmb3IgKDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgbWF0Y2ggPSBmYWxzZTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtYXRjaDtcbn1cblxuLyohXG4gKiBFeHRlbnNpb24gdG8gYGl0ZXJhYmxlRXF1YWxgIHNwZWNpZmljYWxseVxuICogZm9yIE5vZGUuanMgQnVmZmVycy5cbiAqXG4gKiBAcGFyYW0ge0J1ZmZlcn0gYVxuICogQHBhcmFtIHtNaXhlZH0gYlxuICogQHJldHVybiB7Qm9vbGVhbn0gcmVzdWx0XG4gKi9cblxuZnVuY3Rpb24gYnVmZmVyRXF1YWwoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gaXRlcmFibGVFcXVhbChhLCBiKTtcbn1cblxuLyohXG4gKiBCbG9jayBmb3IgYG9iamVjdEVxdWFsYCBlbnN1cmluZyBub24tZXhpc3RpbmdcbiAqIHZhbHVlcyBkb24ndCBnZXQgaW4uXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqZWN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqL1xuXG5mdW5jdGlvbiBpc1ZhbHVlKGEpIHtcbiAgcmV0dXJuIGEgIT09IG51bGwgJiYgYSAhPT0gdW5kZWZpbmVkO1xufVxuXG4vKiFcbiAqIFJlY3Vyc2l2ZWx5IGNoZWNrIHRoZSBlcXVhbGl0eSBvZiB0d28gb2JqZWN0cy5cbiAqIE9uY2UgYmFzaWMgc2FtZW5lc3MgaGFzIGJlZW4gZXN0YWJsaXNoZWQgaXQgd2lsbFxuICogZGVmZXIgdG8gYGRlZXBFcXVhbGAgZm9yIGVhY2ggZW51bWVyYWJsZSBrZXlcbiAqIGluIHRoZSBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gYVxuICogQHBhcmFtIHtNaXhlZH0gYlxuICogQHJldHVybiB7Qm9vbGVhbn0gcmVzdWx0XG4gKi9cblxuZnVuY3Rpb24gb2JqZWN0RXF1YWwoYSwgYiwgbSkge1xuICBpZiAoIWlzVmFsdWUoYSkgfHwgIWlzVmFsdWUoYikpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoYS5wcm90b3R5cGUgIT09IGIucHJvdG90eXBlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdmFyIGk7XG4gIGlmIChtKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IG0ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICgobVtpXVswXSA9PT0gYSAmJiBtW2ldWzFdID09PSBiKVxuICAgICAgfHwgIChtW2ldWzBdID09PSBiICYmIG1baV1bMV0gPT09IGEpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBtID0gW107XG4gIH1cblxuICB0cnkge1xuICAgIHZhciBrYSA9IGVudW1lcmFibGUoYSk7XG4gICAgdmFyIGtiID0gZW51bWVyYWJsZShiKTtcbiAgfSBjYXRjaCAoZXgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBrYS5zb3J0KCk7XG4gIGtiLnNvcnQoKTtcblxuICBpZiAoIWl0ZXJhYmxlRXF1YWwoa2EsIGtiKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG0ucHVzaChbIGEsIGIgXSk7XG5cbiAgdmFyIGtleTtcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBrZXkgPSBrYVtpXTtcbiAgICBpZiAoIWRlZXBFcXVhbChhW2tleV0sIGJba2V5XSwgbSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvdHlwZScpO1xuIiwiLyohXG4gKiB0eXBlLWRldGVjdFxuICogQ29weXJpZ2h0KGMpIDIwMTMgamFrZSBsdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIFByaW1hcnkgRXhwb3J0c1xuICovXG5cbnZhciBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBnZXRUeXBlO1xuXG4vKiFcbiAqIERldGVjdGFibGUgamF2YXNjcmlwdCBuYXRpdmVzXG4gKi9cblxudmFyIG5hdGl2ZXMgPSB7XG4gICAgJ1tvYmplY3QgQXJyYXldJzogJ2FycmF5J1xuICAsICdbb2JqZWN0IFJlZ0V4cF0nOiAncmVnZXhwJ1xuICAsICdbb2JqZWN0IEZ1bmN0aW9uXSc6ICdmdW5jdGlvbidcbiAgLCAnW29iamVjdCBBcmd1bWVudHNdJzogJ2FyZ3VtZW50cydcbiAgLCAnW29iamVjdCBEYXRlXSc6ICdkYXRlJ1xufTtcblxuLyoqXG4gKiAjIyMgdHlwZU9mIChvYmopXG4gKlxuICogVXNlIHNldmVyYWwgZGlmZmVyZW50IHRlY2huaXF1ZXMgdG8gZGV0ZXJtaW5lXG4gKiB0aGUgdHlwZSBvZiBvYmplY3QgYmVpbmcgdGVzdGVkLlxuICpcbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmplY3RcbiAqIEByZXR1cm4ge1N0cmluZ30gb2JqZWN0IHR5cGVcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZ2V0VHlwZSAob2JqKSB7XG4gIHZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcbiAgaWYgKG5hdGl2ZXNbc3RyXSkgcmV0dXJuIG5hdGl2ZXNbc3RyXTtcbiAgaWYgKG9iaiA9PT0gbnVsbCkgcmV0dXJuICdudWxsJztcbiAgaWYgKG9iaiA9PT0gdW5kZWZpbmVkKSByZXR1cm4gJ3VuZGVmaW5lZCc7XG4gIGlmIChvYmogPT09IE9iamVjdChvYmopKSByZXR1cm4gJ29iamVjdCc7XG4gIHJldHVybiB0eXBlb2Ygb2JqO1xufVxuXG5leHBvcnRzLkxpYnJhcnkgPSBMaWJyYXJ5O1xuXG4vKipcbiAqICMjIyBMaWJyYXJ5XG4gKlxuICogQ3JlYXRlIGEgcmVwb3NpdG9yeSBmb3IgY3VzdG9tIHR5cGUgZGV0ZWN0aW9uLlxuICpcbiAqIGBgYGpzXG4gKiB2YXIgbGliID0gbmV3IHR5cGUuTGlicmFyeTtcbiAqIGBgYFxuICpcbiAqL1xuXG5mdW5jdGlvbiBMaWJyYXJ5ICgpIHtcbiAgdGhpcy50ZXN0cyA9IHt9O1xufVxuXG4vKipcbiAqICMjIyMgLm9mIChvYmopXG4gKlxuICogRXhwb3NlIHJlcGxhY2VtZW50IGB0eXBlb2ZgIGRldGVjdGlvbiB0byB0aGUgbGlicmFyeS5cbiAqXG4gKiBgYGBqc1xuICogaWYgKCdzdHJpbmcnID09PSBsaWIub2YoJ2hlbGxvIHdvcmxkJykpIHtcbiAqICAgLy8gLi4uXG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmplY3QgdG8gdGVzdFxuICogQHJldHVybiB7U3RyaW5nfSB0eXBlXG4gKi9cblxuTGlicmFyeS5wcm90b3R5cGUub2YgPSBnZXRUeXBlO1xuXG4vKipcbiAqICMjIyMgLmRlZmluZSAodHlwZSwgdGVzdClcbiAqXG4gKiBBZGQgYSB0ZXN0IHRvIGZvciB0aGUgYC50ZXN0KClgIGFzc2VydGlvbi5cbiAqXG4gKiBDYW4gYmUgZGVmaW5lZCBhcyBhIHJlZ3VsYXIgZXhwcmVzc2lvbjpcbiAqXG4gKiBgYGBqc1xuICogbGliLmRlZmluZSgnaW50JywgL15bMC05XSskLyk7XG4gKiBgYGBcbiAqXG4gKiAuLi4gb3IgYXMgYSBmdW5jdGlvbjpcbiAqXG4gKiBgYGBqc1xuICogbGliLmRlZmluZSgnYmxuJywgZnVuY3Rpb24gKG9iaikge1xuICogICBpZiAoJ2Jvb2xlYW4nID09PSBsaWIub2Yob2JqKSkgcmV0dXJuIHRydWU7XG4gKiAgIHZhciBibG5zID0gWyAneWVzJywgJ25vJywgJ3RydWUnLCAnZmFsc2UnLCAxLCAwIF07XG4gKiAgIGlmICgnc3RyaW5nJyA9PT0gbGliLm9mKG9iaikpIG9iaiA9IG9iai50b0xvd2VyQ2FzZSgpO1xuICogICByZXR1cm4gISEgfmJsbnMuaW5kZXhPZihvYmopO1xuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQHBhcmFtIHtSZWdFeHB8RnVuY3Rpb259IHRlc3RcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuTGlicmFyeS5wcm90b3R5cGUuZGVmaW5lID0gZnVuY3Rpb24gKHR5cGUsIHRlc3QpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHJldHVybiB0aGlzLnRlc3RzW3R5cGVdO1xuICB0aGlzLnRlc3RzW3R5cGVdID0gdGVzdDtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqICMjIyMgLnRlc3QgKG9iaiwgdGVzdClcbiAqXG4gKiBBc3NlcnQgdGhhdCBhbiBvYmplY3QgaXMgb2YgdHlwZS4gV2lsbCBmaXJzdFxuICogY2hlY2sgbmF0aXZlcywgYW5kIGlmIHRoYXQgZG9lcyBub3QgcGFzcyBpdCB3aWxsXG4gKiB1c2UgdGhlIHVzZXIgZGVmaW5lZCBjdXN0b20gdGVzdHMuXG4gKlxuICogYGBganNcbiAqIGFzc2VydChsaWIudGVzdCgnMScsICdpbnQnKSk7XG4gKiBhc3NlcnQobGliLnRlc3QoJ3llcycsICdibG4nKSk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmplY3RcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuTGlicmFyeS5wcm90b3R5cGUudGVzdCA9IGZ1bmN0aW9uIChvYmosIHR5cGUpIHtcbiAgaWYgKHR5cGUgPT09IGdldFR5cGUob2JqKSkgcmV0dXJuIHRydWU7XG4gIHZhciB0ZXN0ID0gdGhpcy50ZXN0c1t0eXBlXTtcblxuICBpZiAodGVzdCAmJiAncmVnZXhwJyA9PT0gZ2V0VHlwZSh0ZXN0KSkge1xuICAgIHJldHVybiB0ZXN0LnRlc3Qob2JqKTtcbiAgfSBlbHNlIGlmICh0ZXN0ICYmICdmdW5jdGlvbicgPT09IGdldFR5cGUodGVzdCkpIHtcbiAgICByZXR1cm4gdGVzdChvYmopO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBSZWZlcmVuY2VFcnJvcignVHlwZSB0ZXN0IFwiJyArIHR5cGUgKyAnXCIgbm90IGRlZmluZWQgb3IgaW52YWxpZC4nKTtcbiAgfVxufTtcbiIsInZhciBmdXJpb3VzID0gcmVxdWlyZShcIi4uL2xpYi9mdXJpb3VzLmpzXCIpO1xudmFyIGV4cGVjdCA9IHJlcXVpcmUoXCJjaGFpXCIpLmV4cGVjdDtcblxudmFyIGNvbnRleHQgPSBudWxsO1xuYmVmb3JlKGZ1bmN0aW9uKGRvbmUpIHtcblx0ZnVyaW91cy5pbml0KGZ1bmN0aW9uKGN0eCkge1xuXHRcdGNvbnRleHQgPSBjdHg7XG5cdFx0ZG9uZSgpO1xuXHR9KTtcbn0pO1xuXG5kZXNjcmliZShcIkNvbnRleHRcIiwgZnVuY3Rpb24oKXtcblx0ZGVzY3JpYmUoXCJlbXB0eVwiLCBmdW5jdGlvbigpe1xuXHRcdGl0KFwiQ3JlYXRlcyBhcnJheSB3aXRoIHNwZWNpZmllZCBzaGFwZVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eSg0Mik7XG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuZW1wdHkoWzQyXSk7XG5cdFx0XHR2YXIgeiA9IGNvbnRleHQuZW1wdHkoWzQsIDJdKTtcblx0XHRcdGV4cGVjdCh4LnNoYXBlKS50by5kZWVwLmVxdWFsKFs0Ml0pO1xuXHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzQyXSk7XG5cdFx0XHRleHBlY3Qoei5zaGFwZSkudG8uZGVlcC5lcXVhbChbNCwgMl0pO1xuXHRcdFx0eC5pbnZhbGlkYXRlKCk7XG5cdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdHouaW52YWxpZGF0ZSgpO1xuXHRcdH0pO1xuXHRcdGl0KFwiQ3JlYXRlcyBhcnJheSB3aXRoIHNwZWNpZmllZCBkYXRhIHR5cGUgKGY2NCBieSBkZWZhdWx0KVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eShbNCwgMl0pO1xuXHRcdFx0dmFyIHkgPSBjb250ZXh0LmVtcHR5KFs0LCAyXSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpO1xuXHRcdFx0dmFyIHogPSBjb250ZXh0LmVtcHR5KFs0LCAyXSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIikpO1xuXHRcdFx0ZXhwZWN0KHguZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKSkudG8uYmUudHJ1ZTtcblx0XHRcdGV4cGVjdCh5LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKSkpLnRvLmJlLnRydWU7XG5cdFx0XHRleHBlY3Qoei5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIikpKS50by5iZS50cnVlO1xuXHRcdFx0eC5pbnZhbGlkYXRlKCk7XG5cdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdHouaW52YWxpZGF0ZSgpO1xuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJ6ZXJvc1wiLCBmdW5jdGlvbigpe1xuXHRcdGl0KFwiQ3JlYXRlcyBhcnJheSB3aXRoIHNwZWNpZmllZCBzaGFwZVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC56ZXJvcyg0Mik7XG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuemVyb3MoWzQyXSk7XG5cdFx0XHR2YXIgeiA9IGNvbnRleHQuemVyb3MoWzQsIDJdKTtcblx0XHRcdGV4cGVjdCh4LnNoYXBlKS50by5kZWVwLmVxdWFsKFs0Ml0pO1xuXHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzQyXSk7XG5cdFx0XHRleHBlY3Qoei5zaGFwZSkudG8uZGVlcC5lcXVhbChbNCwgMl0pO1xuXHRcdFx0eC5pbnZhbGlkYXRlKCk7XG5cdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdHouaW52YWxpZGF0ZSgpO1xuXHRcdH0pO1xuXHRcdGl0KFwiQ3JlYXRlcyBhcnJheSB3aXRoIHNwZWNpZmllZCBkYXRhIHR5cGUgKGY2NCBieSBkZWZhdWx0KVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC56ZXJvcyhbNCwgMl0pO1xuXHRcdFx0dmFyIHkgPSBjb250ZXh0Lnplcm9zKFs0LCAyXSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpO1xuXHRcdFx0dmFyIHogPSBjb250ZXh0Lnplcm9zKFs0LCAyXSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIikpO1xuXHRcdFx0ZXhwZWN0KHguZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKSkudG8uYmUudHJ1ZTtcblx0XHRcdGV4cGVjdCh5LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKSkpLnRvLmJlLnRydWU7XG5cdFx0XHRleHBlY3Qoei5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIikpKS50by5iZS50cnVlO1xuXHRcdFx0eC5pbnZhbGlkYXRlKCk7XG5cdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdHouaW52YWxpZGF0ZSgpO1xuXHRcdH0pO1xuXHRcdGl0KFwiQ3JlYXRlcyBhcnJheSB3aXRoIGFsbCBlbGVtZW50cyBpbml0aWFsaXplZCB0byB6ZXJvXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC56ZXJvcyhbMywgMl0sIG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC56ZXJvcyhbMiwgM10sIG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjMyXCIpKTtcblx0XHRcdGNvbnRleHQuZ2V0KHgsIHksIGZ1bmN0aW9uKHgsIHkpIHtcblx0XHRcdFx0ZXhwZWN0KHgpLnRvLmRlZXAuZXF1YWwoW1swLjAsIDAuMF0sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbMC4wLCAwLjBdLFxuXHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWzAuMCwgMC4wXV0pO1xuXHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbWzAuMCwgMC4wLCAwLjBdLFxuXHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWzAuMCwgMC4wLCAwLjBdXSk7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJvbmVzXCIsIGZ1bmN0aW9uKCl7XG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IHdpdGggc3BlY2lmaWVkIHNoYXBlXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0Lm9uZXMoNDIpO1xuXHRcdFx0dmFyIHkgPSBjb250ZXh0Lm9uZXMoWzQyXSk7XG5cdFx0XHR2YXIgeiA9IGNvbnRleHQub25lcyhbNCwgMl0pO1xuXHRcdFx0ZXhwZWN0KHguc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzQyXSk7XG5cdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbNDJdKTtcblx0XHRcdGV4cGVjdCh6LnNoYXBlKS50by5kZWVwLmVxdWFsKFs0LCAyXSk7XG5cdFx0XHR4LmludmFsaWRhdGUoKTtcblx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0ei5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IHdpdGggc3BlY2lmaWVkIGRhdGEgdHlwZSAoZjY0IGJ5IGRlZmF1bHQpXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0Lm9uZXMoWzQsIDJdKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC5vbmVzKFs0LCAyXSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpO1xuXHRcdFx0dmFyIHogPSBjb250ZXh0Lm9uZXMoWzQsIDJdLCBuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKSk7XG5cdFx0XHRleHBlY3QoeC5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpKS50by5iZS50cnVlO1xuXHRcdFx0ZXhwZWN0KHkuZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKSkudG8uYmUudHJ1ZTtcblx0XHRcdGV4cGVjdCh6LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKSkpLnRvLmJlLnRydWU7XG5cdFx0XHR4LmludmFsaWRhdGUoKTtcblx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0ei5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IHdpdGggYWxsIGVsZW1lbnRzIGluaXRpYWxpemVkIHRvIG9uZVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQub25lcyhbMywgMl0sIG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC5vbmVzKFsyLCAzXSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIikpO1xuXHRcdFx0Y29udGV4dC5nZXQoeCwgeSwgZnVuY3Rpb24oeCwgeSkge1xuXHRcdFx0XHRleHBlY3QoeCkudG8uZGVlcC5lcXVhbChbWzEuMCwgMS4wXSxcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsxLjAsIDEuMF0sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbMS4wLCAxLjBdXSk7XG5cdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFtbMS4wLCAxLjAsIDEuMF0sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbMS4wLCAxLjAsIDEuMF1dKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcImFycmF5XCIsIGZ1bmN0aW9uKCl7XG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IG9mIHRoZSBzYW1lIGxlbmd0aCBhcyB0aGUgcHJvdmlkZWQgYXJyYXlcIiwgZnVuY3Rpb24oKXtcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMCwgMV0pO1xuXHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KFtbMCwgMV0sXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgICAgIFsyLCAzXSxcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgWzMsIDRdXSk7XG5cdFx0XHRleHBlY3QoeC5sZW5ndGgpLnRvLmVxdWFsKDIpO1xuXHRcdFx0ZXhwZWN0KHkubGVuZ3RoKS50by5lcXVhbCg2KTtcblx0XHRcdHguaW52YWxpZGF0ZSgpO1xuXHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJDcmVhdGVzIGFycmF5IG9mIHRoZSBzYW1lIHNoYXBlIGFzIHRoZSBwcm92aWRlZCBhcnJheVwiLCBmdW5jdGlvbigpe1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFswLCAxXSk7XG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoW1swLCAxXSxcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgWzIsIDNdLFxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbMywgNF1dKTtcblx0XHRcdHZhciB6ID0gY29udGV4dC5hcnJheShbW1sxLCAyLCAzXSwgWyA0LCAgNSwgIDZdXSxcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgW1s3LCA4LCA5XSwgWzEwLCAxMSwgMTJdXV0pO1xuXHRcdFx0ZXhwZWN0KHguc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzJdKTtcblx0XHRcdGV4cGVjdCh5LnNoYXBlKS50by5kZWVwLmVxdWFsKFszLCAyXSk7XG5cdFx0XHRleHBlY3Qoei5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMiwgM10pO1xuXHRcdFx0eC5pbnZhbGlkYXRlKCk7XG5cdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdHouaW52YWxpZGF0ZSgpO1xuXHRcdH0pO1xuXHRcdGl0KFwiQ3JlYXRlcyBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEgYXMgdGhlIHByb3ZpZGVkIGFycmF5XCIsIGZ1bmN0aW9uKGRvbmUpe1xuXHRcdFx0dmFyIGFycmF5ID0gW1tbMSwgMiwgM10sIFsgNCwgIDUsICA2XV0sXG5cdFx0XHQgICAgICAgICAgICAgW1s3LCA4LCA5XSwgWzEwLCAxMSwgMTJdXV07XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoYXJyYXksIG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjY0XCIpKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShhcnJheSwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIikpO1xuXHRcdFx0Y29udGV4dC5nZXQoeCwgeSwgZnVuY3Rpb24oeCwgeSkge1xuXHRcdFx0XHRleHBlY3QoeCkudG8uZGVlcC5lcXVhbChhcnJheSk7XG5cdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKGFycmF5KTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcImxpbnNwYWNlXCIsIGZ1bmN0aW9uKCl7XG5cdFx0aXQoXCJIYXMgbGVuZ3RoIG9mIDUwIHdpdGggZGVmYXVsdCBhcmd1bWVudHNcIiwgZnVuY3Rpb24oKXtcblx0XHRcdGV4cGVjdCgoY29udGV4dC5saW5zcGFjZSgwLCAxKSkubGVuZ3RoKS50by5lcXVhbCg1MCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJIYXMgdGhlIHNwZWNpZmllZCBudW1iZXIgb2Ygc2FtcGxlc1wiLCBmdW5jdGlvbigpe1xuXHRcdFx0ZXhwZWN0KChjb250ZXh0LmxpbnNwYWNlKDAsIDEsIDI0MykpLmxlbmd0aCkudG8uZXF1YWwoMjQzKTtcblx0XHR9KTtcblx0XHRpdChcIkhhcyBleHBlY3RlZCB2YWx1ZXNcIiwgZnVuY3Rpb24oZG9uZSl7XG5cdFx0XHR2YXIgc3RhcnQgPSA1MDtcblx0XHRcdHZhciBzdG9wID0gOTk7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2Uoc3RhcnQsIHN0b3ApO1xuXHRcdFx0eC5nZXQoZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcmVzdWx0Lmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdFtpXSkudG8uZXF1YWwoc3RhcnQraSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0ZGVzY3JpYmUoXCJ3aXRoIGluY2x1ZGVTdG9wID09PSBmYWxzZVwiLCBmdW5jdGlvbigpe1xuXHRcdFx0aXQoXCJIYXMgdGhlIHNwZWNpZmllZCBudW1iZXIgb2Ygc2FtcGxlc1wiLCBmdW5jdGlvbigpe1xuXHRcdFx0XHRleHBlY3QoKGNvbnRleHQubGluc3BhY2UoMCwgMSwgMjQzLCBmYWxzZSkpLmxlbmd0aCkudG8uZXF1YWwoMjQzKTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJEb2VzIG5vdCBjb250YWluIHRoZSByaWdodCBlbmRwb2ludFwiLCBmdW5jdGlvbihkb25lKXtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKC0xLCAxLCAxMDAwLCBmYWxzZSk7XG5cdFx0XHRcdHguZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHRbcmVzdWx0Lmxlbmd0aCAtIDFdKS50by5ub3QuZXF1YWwoMSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJuZWdcIiwgZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHhSZWYgPSBbIDEsIC03LjUsICAwLCAtMTVdO1xuXHRcdHZhciB5UmVmID0gWy0xLCAgNy41LCAtMCwgIDE1XTtcblx0XHR2YXIgZGF0YVR5cGVzID0gW1wiZjMyXCIsIFwiZjY0XCJdO1xuXG5cdFx0ZGVzY3JpYmUoXCJXaXRoIG5vIG91dHB1dCBhcnJheSBzdXBwbGllZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCB0aGUgc2FtZSBzaGFwZSBhcyBpbnB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0Lm9uZXMoWzIsIDMsIDRdKTtcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0Lm5lZyh4KTtcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDMsIDRdKTtcblx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEgdHlwZSBhcyBpbnB1dCBhcnJheSAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5uZWcoeCk7XG5cdFx0XHRcdFx0XHRleHBlY3QoeS5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKSkudG8uYmUudHJ1ZTtcblx0XHRcdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggbmVnYXRlZCBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQubmVnKHgpO1xuXHRcdFx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbCh5UmVmKTtcblx0XHRcdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0ZGVzY3JpYmUoXCJXaXRoIGFuIG91dHB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xuXHRcdFx0XHRcdGl0KFwiUG9wdWxhdGVzIHRoZSBvdXRwdXQgYXJyYXkgd2l0aCBuZWdhdGVkIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5vbmVzKHguc2hhcGUsIHguZGF0YVR5cGUpO1xuXHRcdFx0XHRcdFx0Y29udGV4dC5uZWcoeCwgeSk7XG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKHlSZWYpO1xuXHRcdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwiYWJzXCIsIGZ1bmN0aW9uKCkge1xuXHRcdHZhciB4UmVmID0gWzEsIC03LjUsIDAsIC0xNV07XG5cdFx0dmFyIHlSZWYgPSBbMSwgIDcuNSwgMCwgIDE1XTtcblx0XHR2YXIgZGF0YVR5cGVzID0gW1wiZjMyXCIsIFwiZjY0XCJdO1xuXG5cdFx0ZGVzY3JpYmUoXCJXaXRoIG5vIG91dHB1dCBhcnJheSBzdXBwbGllZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCB0aGUgc2FtZSBzaGFwZSBhcyBpbnB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0Lm9uZXMoWzIsIDMsIDRdKTtcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFicyh4KTtcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDMsIDRdKTtcblx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEgdHlwZSBhcyBpbnB1dCBhcnJheSAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5hYnMoeCk7XG5cdFx0XHRcdFx0XHRleHBlY3QoeS5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKSkudG8uYmUudHJ1ZTtcblx0XHRcdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5hYnMoeCk7XG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKHlSZWYpO1xuXHRcdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRkZXNjcmliZShcIldpdGggYW4gb3V0cHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJQb3B1bGF0ZXMgdGhlIG91dHB1dCBhcnJheSB3aXRoIGFic29sdXRlIHZhbHVlcyBvZiBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQub25lcyh4LnNoYXBlLCB4LmRhdGFUeXBlKTtcblx0XHRcdFx0XHRcdGNvbnRleHQuYWJzKHgsIHkpO1xuXHRcdFx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbCh5UmVmKTtcblx0XHRcdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcImV4cFwiLCBmdW5jdGlvbigpIHtcblx0XHR2YXIgeFJlZiA9IFsxLCAtMSwgMF07XG5cdFx0dmFyIGRhdGFUeXBlcyA9IFtcImYzMlwiLCBcImY2NFwiXTtcblxuXHRcdGRlc2NyaWJlKFwiV2l0aCBubyBvdXRwdXQgYXJyYXkgc3VwcGxpZWRcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggdGhlIHNhbWUgc2hhcGUgYXMgaW5wdXQgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5vbmVzKFsyLCAzLCA0XSk7XG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5leHAoeCk7XG5cdFx0XHRcdGV4cGVjdCh5LnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAzLCA0XSk7XG5cdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xuXHRcdFx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCB0aGUgc2FtZSBkYXRhIHR5cGUgYXMgaW5wdXQgYXJyYXkgKFwiICsgZGF0YVR5cGUgKyBcIiBkYXRhIHR5cGUpXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuZXhwKHgpO1xuXHRcdFx0XHRcdFx0ZXhwZWN0KHkuZGF0YVR5cGUuZXF1YWxzKG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSkpLnRvLmJlLnRydWU7XG5cdFx0XHRcdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIGFic29sdXRlIHZhbHVlcyBvZiBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuZXhwKHgpO1xuXHRcdFx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBrID0gMDsgayA8IHkubGVuZ3RoOyBrKyspIHtcblx0XHRcdFx0XHRcdFx0XHRleHBlY3QoeVtrXSkudG8uYmUuY2xvc2VUbyhNYXRoLmV4cCh4UmVmW2tdKSwgTWF0aC5leHAoeFJlZltrXSkgKiAzICogeC5kYXRhVHlwZS5lcHNpbG9uKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRkZXNjcmliZShcIldpdGggYW4gb3V0cHV0IGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJQb3B1bGF0ZXMgdGhlIG91dHB1dCBhcnJheSB3aXRoIGFic29sdXRlIHZhbHVlcyBvZiBlbGVtZW50cyAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQub25lcyh4LnNoYXBlLCB4LmRhdGFUeXBlKTtcblx0XHRcdFx0XHRcdGNvbnRleHQuZXhwKHgsIHkpO1xuXHRcdFx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBrID0gMDsgayA8IHkubGVuZ3RoOyBrKyspIHtcblx0XHRcdFx0XHRcdFx0XHRleHBlY3QoeVtrXSkudG8uYmUuY2xvc2VUbyhNYXRoLmV4cCh4UmVmW2tdKSwgTWF0aC5leHAoeFJlZltrXSkgKiAzICogeC5kYXRhVHlwZS5lcHNpbG9uKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwibG9nXCIsIGZ1bmN0aW9uKCkge1xuXHRcdHZhciB4UmVmID0gWzEsIDMsIDEwXTtcblx0XHR2YXIgZGF0YVR5cGVzID0gW1wiZjMyXCIsIFwiZjY0XCJdO1xuXG5cdFx0ZGVzY3JpYmUoXCJXaXRoIG5vIG91dHB1dCBhcnJheSBzdXBwbGllZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCB0aGUgc2FtZSBzaGFwZSBhcyBpbnB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0Lm9uZXMoWzIsIDMsIDRdKTtcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmxvZyh4KTtcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDMsIDRdKTtcblx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEgdHlwZSBhcyBpbnB1dCBhcnJheSAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5sb2coeCk7XG5cdFx0XHRcdFx0XHRleHBlY3QoeS5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKSkudG8uYmUudHJ1ZTtcblx0XHRcdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5sb2coeCk7XG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgeS5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0XHRcdGV4cGVjdCh5W2tdKS50by5iZS5jbG9zZVRvKE1hdGgubG9nKHhSZWZba10pLCBNYXRoLmxvZyh4UmVmW2tdKSAqIDMgKiB4LmRhdGFUeXBlLmVwc2lsb24pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGRlc2NyaWJlKFwiV2l0aCBhbiBvdXRwdXQgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIlBvcHVsYXRlcyB0aGUgb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5vbmVzKHguc2hhcGUsIHguZGF0YVR5cGUpO1xuXHRcdFx0XHRcdFx0Y29udGV4dC5sb2coeCwgeSk7XG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgeS5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0XHRcdGV4cGVjdCh5W2tdKS50by5iZS5jbG9zZVRvKE1hdGgubG9nKHhSZWZba10pLCBNYXRoLmxvZyh4UmVmW2tdKSAqIDMgKiB4LmRhdGFUeXBlLmVwc2lsb24pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJzcXJ0XCIsIGZ1bmN0aW9uKCkge1xuXHRcdHZhciB4UmVmID0gWzAsIDAuMjUsIDEsIDksIDEwXTtcblx0XHR2YXIgZGF0YVR5cGVzID0gW1wiZjMyXCIsIFwiZjY0XCJdO1xuXG5cdFx0ZGVzY3JpYmUoXCJXaXRoIG5vIG91dHB1dCBhcnJheSBzdXBwbGllZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCB0aGUgc2FtZSBzaGFwZSBhcyBpbnB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0Lm9uZXMoWzIsIDMsIDRdKTtcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LnNxcnQoeCk7XG5cdFx0XHRcdGV4cGVjdCh5LnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAzLCA0XSk7XG5cdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xuXHRcdFx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCB0aGUgc2FtZSBkYXRhIHR5cGUgYXMgaW5wdXQgYXJyYXkgKFwiICsgZGF0YVR5cGUgKyBcIiBkYXRhIHR5cGUpXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KHhSZWYsIG5ldyBmdXJpb3VzLkRhdGFUeXBlKGRhdGFUeXBlKSk7XG5cdFx0XHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuc3FydCh4KTtcblx0XHRcdFx0XHRcdGV4cGVjdCh5LmRhdGFUeXBlLmVxdWFscyhuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpKS50by5iZS50cnVlO1xuXHRcdFx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xuXHRcdFx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCBhYnNvbHV0ZSB2YWx1ZXMgb2YgZWxlbWVudHMgKFwiICsgZGF0YVR5cGUgKyBcIiBkYXRhIHR5cGUpXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LnNxcnQoeCk7XG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgeS5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0XHRcdGV4cGVjdCh5W2tdKS50by5iZS5jbG9zZVRvKE1hdGguc3FydCh4UmVmW2tdKSwgTWF0aC5zcXJ0KHhSZWZba10pICogMyAqIHguZGF0YVR5cGUuZXBzaWxvbik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0ZGVzY3JpYmUoXCJXaXRoIGFuIG91dHB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xuXHRcdFx0XHRcdGl0KFwiUG9wdWxhdGVzIHRoZSBvdXRwdXQgYXJyYXkgd2l0aCBhYnNvbHV0ZSB2YWx1ZXMgb2YgZWxlbWVudHMgKFwiICsgZGF0YVR5cGUgKyBcIiBkYXRhIHR5cGUpXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0Lm9uZXMoeC5zaGFwZSwgeC5kYXRhVHlwZSk7XG5cdFx0XHRcdFx0XHRjb250ZXh0LnNxcnQoeCwgeSk7XG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgeS5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0XHRcdGV4cGVjdCh5W2tdKS50by5iZS5jbG9zZVRvKE1hdGguc3FydCh4UmVmW2tdKSwgTWF0aC5zcXJ0KHhSZWZba10pICogMyAqIHguZGF0YVR5cGUuZXBzaWxvbik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcInNxdWFyZVwiLCBmdW5jdGlvbigpIHtcblx0XHR2YXIgeFJlZiA9IFstMiwgMCwgMC41LCAxLCAzXTtcblx0XHR2YXIgZGF0YVR5cGVzID0gW1wiZjMyXCIsIFwiZjY0XCJdO1xuXG5cdFx0ZGVzY3JpYmUoXCJXaXRoIG5vIG91dHB1dCBhcnJheSBzdXBwbGllZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ3JlYXRlcyBhbiBvdXRwdXQgYXJyYXkgd2l0aCB0aGUgc2FtZSBzaGFwZSBhcyBpbnB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0Lm9uZXMoWzIsIDMsIDRdKTtcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LnNxdWFyZSh4KTtcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDMsIDRdKTtcblx0XHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhVHlwZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0KGZ1bmN0aW9uKGRhdGFUeXBlKSB7XG5cdFx0XHRcdFx0aXQoXCJDcmVhdGVzIGFuIG91dHB1dCBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEgdHlwZSBhcyBpbnB1dCBhcnJheSAoXCIgKyBkYXRhVHlwZSArIFwiIGRhdGEgdHlwZSlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5zcXVhcmUoeCk7XG5cdFx0XHRcdFx0XHRleHBlY3QoeS5kYXRhVHlwZS5lcXVhbHMobmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKSkudG8uYmUudHJ1ZTtcblx0XHRcdFx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KShkYXRhVHlwZXNbaV0pO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRhdGFUeXBlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQoZnVuY3Rpb24oZGF0YVR5cGUpIHtcblx0XHRcdFx0XHRpdChcIkNyZWF0ZXMgYW4gb3V0cHV0IGFycmF5IHdpdGggYWJzb2x1dGUgdmFsdWVzIG9mIGVsZW1lbnRzIChcIiArIGRhdGFUeXBlICsgXCIgZGF0YSB0eXBlKVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoeFJlZiwgbmV3IGZ1cmlvdXMuRGF0YVR5cGUoZGF0YVR5cGUpKTtcblx0XHRcdFx0XHRcdHZhciB5ID0gY29udGV4dC5zcXVhcmUoeCk7XG5cdFx0XHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgeS5sZW5ndGg7IGsrKykge1xuXHRcdFx0XHRcdFx0XHRcdGV4cGVjdCh5W2tdKS50by5iZS5jbG9zZVRvKHhSZWZba10gKiB4UmVmW2tdLCB4UmVmW2tdICogeFJlZltrXSAqIHguZGF0YVR5cGUuZXBzaWxvbik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pKGRhdGFUeXBlc1tpXSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0ZGVzY3JpYmUoXCJXaXRoIGFuIG91dHB1dCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YVR5cGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdChmdW5jdGlvbihkYXRhVHlwZSkge1xuXHRcdFx0XHRcdGl0KFwiUG9wdWxhdGVzIHRoZSBvdXRwdXQgYXJyYXkgd2l0aCBhYnNvbHV0ZSB2YWx1ZXMgb2YgZWxlbWVudHMgKFwiICsgZGF0YVR5cGUgKyBcIiBkYXRhIHR5cGUpXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheSh4UmVmLCBuZXcgZnVyaW91cy5EYXRhVHlwZShkYXRhVHlwZSkpO1xuXHRcdFx0XHRcdFx0dmFyIHkgPSBjb250ZXh0Lm9uZXMoeC5zaGFwZSwgeC5kYXRhVHlwZSk7XG5cdFx0XHRcdFx0XHRjb250ZXh0LnNxdWFyZSh4LCB5KTtcblx0XHRcdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCB5Lmxlbmd0aDsgaysrKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZXhwZWN0KHlba10pLnRvLmJlLmNsb3NlVG8oeFJlZltrXSAqIHhSZWZba10sIHhSZWZba10gKiB4UmVmW2tdICogeC5kYXRhVHlwZS5lcHNpbG9uKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkoZGF0YVR5cGVzW2ldKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG59KTtcbiIsInZhciBmdXJpb3VzID0gcmVxdWlyZShcIi4uL2xpYi9mdXJpb3VzLmpzXCIpO1xudmFyIGV4cGVjdCA9IHJlcXVpcmUoXCJjaGFpXCIpLmV4cGVjdDtcblxuZGVzY3JpYmUoXCJEYXRhVHlwZVwiLCBmdW5jdGlvbigpe1xuXHRkZXNjcmliZShcImYzMlwiLCBmdW5jdGlvbigpe1xuXHRcdGl0KFwic2hvdWxkIGhhdmUgc2l6ZSA0XCIsIGZ1bmN0aW9uKCl7XG5cdFx0XHR2YXIgZHR5cGUgPSBuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKTtcblx0XHRcdGV4cGVjdChkdHlwZS5zaXplKS50by5lcXVhbCg0KTtcblx0XHR9KTtcblxuXHRcdGl0KFwic2hvdWxkIGhhdmUgdHlwZSBcXFwiZjMyXFxcIlwiLCBmdW5jdGlvbigpe1xuXHRcdFx0dmFyIGR0eXBlID0gbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmMzJcIik7XG5cdFx0XHRleHBlY3QoZHR5cGUudHlwZSkudG8uZXF1YWwoXCJmMzJcIik7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcImY2NFwiLCBmdW5jdGlvbigpe1xuXHRcdGl0KFwic2hvdWxkIGhhdmUgc2l6ZSA4XCIsIGZ1bmN0aW9uKCl7XG5cdFx0XHR2YXIgZHR5cGUgPSBuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKTtcblx0XHRcdGV4cGVjdChkdHlwZS5zaXplKS50by5lcXVhbCg4KTtcblx0XHR9KTtcblxuXHRcdGl0KFwic2hvdWxkIGhhdmUgdHlwZSBcXFwiZjY0XFxcIlwiLCBmdW5jdGlvbigpe1xuXHRcdFx0dmFyIGR0eXBlID0gbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIik7XG5cdFx0XHRleHBlY3QoZHR5cGUudHlwZSkudG8uZXF1YWwoXCJmNjRcIik7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iLCJ2YXIgZnVyaW91cyA9IHJlcXVpcmUoXCIuLi9saWIvZnVyaW91cy5qc1wiKTtcbnZhciBleHBlY3QgPSByZXF1aXJlKFwiY2hhaVwiKS5leHBlY3Q7XG5cbnZhciBjb250ZXh0ID0gbnVsbDtcbmJlZm9yZShmdW5jdGlvbihkb25lKSB7XG5cdGZ1cmlvdXMuaW5pdChmdW5jdGlvbihjdHgpIHtcblx0XHRjb250ZXh0ID0gY3R4O1xuXHRcdGRvbmUoKTtcblx0fSk7XG59KTtcblxuZGVzY3JpYmUoXCJOREFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRkZXNjcmliZShcImxlbmd0aFwiLCBmdW5jdGlvbigpIHtcblx0XHRpdChcIkVxdWFscyB0byB0aGUgbnVtYmVyIHBhc3NlZCBpbiBjb25zdHJ1Y3RvclwiLCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eSg0Mik7XG5cdFx0XHRleHBlY3QoeC5sZW5ndGgpLnRvLmVxdWFsKDQyKTtcblx0XHRcdHguaW52YWxpZGF0ZSgpO1xuXHRcdH0pO1xuXHRcdGl0KFwiRXF1YWxzIHRvIHRoZSBudW1iZXIgcGFzc2VkIGluIGNvbnN0cnVjdG9yIGFzIGFuIGFycmF5XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KFs0Ml0pO1xuXHRcdFx0ZXhwZWN0KHgubGVuZ3RoKS50by5lcXVhbCg0Mik7XG5cdFx0XHR4LmludmFsaWRhdGUoKTtcblx0XHR9KTtcblx0XHRpdChcIkVxdWFscyB0byB0aGUgcHJvZHVjdCBvZiBkaW1lbnNpb25zXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KFsyLCA1LCAzXSk7XG5cdFx0XHRleHBlY3QoeC5sZW5ndGgpLnRvLmVxdWFsKDMwKTtcblx0XHRcdHguaW52YWxpZGF0ZSgpO1xuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJyZXNoYXBlXCIsIGZ1bmN0aW9uKCkge1xuXHRcdGl0KFwiUHJlc2VydmVzIGxlbmd0aFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eShbNyw1LDNdKTtcblx0XHRcdHZhciB5ID0geC5yZXNoYXBlKFsyMSw1XSk7XG5cdFx0XHRleHBlY3QoeS5sZW5ndGgpLnRvLmVxdWFsKHgubGVuZ3RoKTtcblx0XHRcdHkuaW52YWxpZGF0ZSgpO1xuXHRcdH0pO1xuXHRcdGl0KFwiQ2hhbmdlcyBzaGFwZVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eShbNyw1LDNdKTtcblx0XHRcdHZhciB5ID0geC5yZXNoYXBlKFsyMSw1XSk7XG5cdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMjEsNV0pO1xuXHRcdFx0eS5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJSZWFycmFuZ2VzIGRhdGFcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDgsIDgpLnJlc2hhcGUoWzIsIDIsIDJdKTtcblx0XHRcdHguZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbWyAxLCAgMl0sIFsgMywgIDRdXSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFtbIDUsICA2XSwgWyA3LCAgOF1dXSk7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblx0ZGVzY3JpYmUoXCJyZXBlYXRcIiwgZnVuY3Rpb24oKSB7XG5cdFx0aXQoXCJSZXBlYXRzIGFycmF5IGVsZW1lbnRzIGFsb25nIGF4aXMgMFwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1s4LCAxLCA2XSxcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgWzMsIDUsIDddLFxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbNCwgOSwgMl1dKTtcblx0XHRcdHgucmVwZWF0KDIsIDApLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFtbOCwgMSwgNl0sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbOCwgMSwgNl0sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbMywgNSwgN10sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbMywgNSwgN10sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbNCwgOSwgMl0sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbNCwgOSwgMl1dKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0aXQoXCJSZXBlYXRzIGFycmF5IGVsZW1lbnRzIGFsb25nIGF4aXMgMVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1s4LCAxLCA2XSxcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgWzMsIDUsIDddLFxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbNCwgOSwgMl1dKTtcblx0XHRcdHgucmVwZWF0KDIsIDEpLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFtbOCwgOCwgMSwgMSwgNiwgNl0sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbMywgMywgNSwgNSwgNywgN10sXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbNCwgNCwgOSwgOSwgMiwgMl1dKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcImdldFwiLCBmdW5jdGlvbigpe1xuXHRcdGl0KFwiV29ya3Mgd2l0aCAxLWRpbWVuc2lvbmFsIGFycmF5XCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbNDIsIDEwXSk7XG5cdFx0XHR4LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFs0MiwgMTBdKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0aXQoXCJXb3JrcyB3aXRoIDItZGltZW5zaW9uYWwgYXJyYXlcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0dmFyIGFycmF5ID0gW1sxNiwgIDIsICAzLCAxMywgIDVdLFxuXHRcdFx0XHRcdFx0IFsxMSwgMTAsICA4LCAgOSwgIDddLFxuXHRcdFx0XHRcdFx0IFsgNiwgMTIsICA0LCAxNCwgMTVdXTtcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShhcnJheSk7XG5cdFx0XHR4LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKGFycmF5KTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcImFkZFwiLCBmdW5jdGlvbigpIHtcblx0XHRkZXNjcmliZShcIkFkZCBhcnJheVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbOCwgLTEsIDEwXSk7XG5cdFx0XHRcdHZhciB6ID0geC5hZGQoeSk7XG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHopIHtcblx0XHRcdFx0XHRleHBlY3QoeikudG8uZGVlcC5lcXVhbChbOSwgMywgMTldKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAyLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzEsIDRdLCBbOSwgLTE3XV0pO1xuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoW1s4LCAtMV0sIFsxMCwgLTIxXV0pO1xuXHRcdFx0XHR2YXIgeiA9IHguYWRkKHkpO1xuXHRcdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbOSwgM10sIFsxOSwgLTM4XV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRkZXNjcmliZShcIkFkZCBzY2FsYXJcIiwgZnVuY3Rpb24oKXtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XG5cdFx0XHRcdHZhciB6ID0geC5hZGQoLTcpO1xuXHRcdFx0XHR6LmdldChmdW5jdGlvbih6KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHopLnRvLmRlZXAuZXF1YWwoWy02LCAtMywgMl0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XG5cdFx0XHRcdHZhciB6ID0geC5hZGQoNDIpO1xuXHRcdFx0XHR6LmdldChmdW5jdGlvbih6KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHopLnRvLmRlZXAuZXF1YWwoW1s0MywgNDZdLCBbNTEsIDI1XV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwic3ViXCIsIGZ1bmN0aW9uKCkge1xuXHRcdGRlc2NyaWJlKFwiU3VidHJhY3QgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoWzgsIC0xLCAxMF0pO1xuXHRcdFx0XHR2YXIgeiA9IHguc3ViKHkpO1xuXHRcdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFstNywgNSwgLTFdKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAyLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzEsIDRdLCBbOSwgLTE3XV0pO1xuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoW1s4LCAtMV0sIFsxMCwgLTIxXV0pO1xuXHRcdFx0XHR2YXIgeiA9IHguc3ViKHkpO1xuXHRcdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbLTcsIDVdLCBbLTEsIDRdXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdGRlc2NyaWJlKFwiU3VidHJhY3Qgc2NhbGFyXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcblx0XHRcdFx0dmFyIHkgPSB4LnN1YigtNyk7XG5cdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbOCwgMTEsIDE2XSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1sxLCA0XSwgWzksIC0xN11dKTtcblx0XHRcdFx0dmFyIHkgPSB4LnN1Yig0Mik7XG5cdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbWy00MSwgLTM4XSwgWy0zMywgLTU5XV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwibXVsXCIsIGZ1bmN0aW9uKCkge1xuXHRcdGRlc2NyaWJlKFwiTXVsdGlwbHkgYnkgYXJyYXlcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoWzgsIC0xLCAxMF0pO1xuXHRcdFx0XHR2YXIgeiA9IHgubXVsKHkpO1xuXHRcdFx0XHR6LmdldChmdW5jdGlvbih6KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHopLnRvLmRlZXAuZXF1YWwoWzgsIC00LCA5MF0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWzgsIC0xXSwgWzEwLCAtMjFdXSk7XG5cdFx0XHRcdHZhciB6ID0geC5tdWwoeSk7XG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHopIHtcblx0XHRcdFx0XHRleHBlY3QoeikudG8uZGVlcC5lcXVhbChbWzgsIC00XSwgWzkwLCAzNTddXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdGRlc2NyaWJlKFwiTXVsdGlwbHkgYnkgc2NhbGFyXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcblx0XHRcdFx0dmFyIHkgPSB4Lm11bCgtMTApO1xuXHRcdFx0XHR5LmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoWy0xMCwgLTQwLCAtOTBdKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAyLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzEsIDRdLCBbOSwgLTE3XV0pO1xuXHRcdFx0XHR2YXIgeSA9IHgubXVsKDEwKTtcblx0XHRcdFx0eS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFtbMTAsIDQwXSwgWzkwLCAtMTcwXV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwiZGl2XCIsIGZ1bmN0aW9uKCl7XG5cdFx0ZGVzY3JpYmUoXCJEaXZpZGUgYnkgYXJyYXlcIiwgZnVuY3Rpb24oKXtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbMiwgLTQsIDhdKTtcblx0XHRcdFx0dmFyIHogPSB4LmRpdih5KTtcblx0XHRcdFx0ei5nZXQoZnVuY3Rpb24oeikge1xuXHRcdFx0XHRcdGV4cGVjdCh6KS50by5kZWVwLmVxdWFsKFswLjUsIC0xLCAxLjEyNV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWy0yLCA0XSwgWy04LCAxNl1dKTtcblx0XHRcdFx0dmFyIHogPSB4LmRpdih5KTtcblx0XHRcdFx0ei5nZXQoZnVuY3Rpb24oeikge1xuXHRcdFx0XHRcdGV4cGVjdCh6KS50by5kZWVwLmVxdWFsKFtbLTAuNSwgMV0sIFstMS4xMjUsIC0xLjA2MjVdXSk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdGRlc2NyaWJlKFwiRGl2aWRlIGJ5IHNjYWxhclwiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcblx0XHRcdFx0dmFyIHkgPSB4LmRpdigtMik7XG5cdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbLTAuNSwgLTIsIC00LjVdKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1sxLCA0XSwgWzksIC0xN11dKTtcblx0XHRcdFx0dmFyIHkgPSB4LmRpdigtNCk7XG5cdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbWy0wLjI1LCAtMV0sIFstMi4yNSwgNC4yNV1dKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwibWluXCIsIGZ1bmN0aW9uKCl7XG5cdFx0ZGVzY3JpYmUoXCJBbGwgZWxlbWVudHNcIiwgZnVuY3Rpb24oKXtcblx0XHRcdGl0KFwiUmV0dXJucyB6ZXJvLWRpbWVuc2lvbmFsIGFycmF5IG9mIGxlbmd0aCBvbmVcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC56ZXJvcyhbMjAsIDMwXSk7XG5cdFx0XHRcdHZhciB5ID0geC5taW4oKTtcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoW10pO1xuXHRcdFx0XHRleHBlY3QoeS5sZW5ndGgpLnRvLmVxdWFsKDEpO1xuXHRcdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb21wdXRlcyB0aGUgbWluaW11bSBvZiBhbGwgZWxlbWVudHMgaW4gYW4gYXJyYXlcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoLTUwLCAxMDAsIDEwMDAwMCkucmVzaGFwZShbMjAwLCA1MDBdKTtcblx0XHRcdFx0eC5taW4oKS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5lcXVhbCgtNTApO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRkZXNjcmliZShcIkFsb25nIGFuIGF4aXNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRpdChcIkNvcnJlY3Qgc2hhcGUgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSkubG9jaygpO1xuXHRcdFx0XHRleHBlY3QoeC5taW4oMCkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzMsIDRdKTtcblx0XHRcdFx0ZXhwZWN0KHgubWluKDEpLnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCA0XSk7XG5cdFx0XHRcdGV4cGVjdCh4Lm1pbigyKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgM10pO1xuXHRcdFx0XHR4LmludmFsaWRhdGUoKTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMFwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKTtcblx0XHRcdFx0eC5taW4oMCkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbWyAxLCAgMiwgIDMsICA0XSxcblx0XHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWyA1LCAgNiwgIDcsICA4XSxcblx0XHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWyA5LCAxMCwgMTEsIDEyXV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzLCBheGlzIDFcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XG5cdFx0XHRcdHgubWluKDEpLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1sgIDEsICAyLCAgMywgIDRdLFxuXHRcdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbIDEzLCAxNCwgMTUsIDE2XV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzLCBheGlzIDJcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XG5cdFx0XHRcdHgubWluKDIpLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1sgIDEsICA1LCAgOV0sXG5cdFx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsgMTMsIDE3LCAyMV1dKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcIm1heFwiLCBmdW5jdGlvbigpIHtcblx0XHRkZXNjcmliZShcIkFsbCBlbGVtZW50c1wiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiUmV0dXJucyB6ZXJvLWRpbWVuc2lvbmFsIGFycmF5IG9mIGxlbmd0aCBvbmVcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC56ZXJvcyhbMjAsIDMwXSk7XG5cdFx0XHRcdHZhciB5ID0geC5tYXgoKTtcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoW10pO1xuXHRcdFx0XHRleHBlY3QoeS5sZW5ndGgpLnRvLmVxdWFsKDEpO1xuXHRcdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb21wdXRlcyB0aGUgbWF4aW11bSBvZiBhbGwgZWxlbWVudHMgaW4gYW4gYXJyYXlcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoLTUwLCAxMDAsIDEwMDAwMCkucmVzaGFwZShbMjAwLCA1MDBdKTtcblx0XHRcdFx0eC5tYXgoKS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5lcXVhbCgxMDApO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRkZXNjcmliZShcIkFsb25nIGFuIGF4aXNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRpdChcIkNvcnJlY3Qgc2hhcGUgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSkubG9jaygpO1xuXHRcdFx0XHRleHBlY3QoeC5tYXgoMCkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzMsIDRdKTtcblx0XHRcdFx0ZXhwZWN0KHgubWF4KDEpLnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCA0XSk7XG5cdFx0XHRcdGV4cGVjdCh4Lm1heCgyKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgM10pO1xuXHRcdFx0XHR4LmludmFsaWRhdGUoKTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMFwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAyNCwgMjQpLnJlc2hhcGUoWzIsIDMsIDRdKTtcblx0XHRcdFx0eC5tYXgoMCkuZ2V0KGZ1bmN0aW9uKHkpIHtcblx0XHRcdFx0XHRleHBlY3QoeSkudG8uZGVlcC5lcXVhbChbWyAxMywgMTQsIDE1LCAxNl0sXG5cdFx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsgMTcsIDE4LCAxOSwgMjBdLFxuXHRcdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbIDIxLCAyMiwgMjMsIDI0XV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzLCBheGlzIDFcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XG5cdFx0XHRcdHgubWF4KDEpLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1sgIDksIDEwLCAxMSwgMTJdLFxuXHRcdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbIDIxLCAyMiwgMjMsIDI0XV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzLCBheGlzIDJcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XG5cdFx0XHRcdHgubWF4KDIpLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1sgIDQsICA4LCAxMl0sXG5cdFx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsgMTYsIDIwLCAyNF1dKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRkZXNjcmliZShcInN1bVwiLCBmdW5jdGlvbigpIHtcblx0XHRkZXNjcmliZShcIkFsbCBlbGVtZW50c1wiLCBmdW5jdGlvbigpIHtcblx0XHRcdGl0KFwiUmV0dXJucyB6ZXJvLWRpbWVuc2lvbmFsIGFycmF5IG9mIGxlbmd0aCBvbmVcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC56ZXJvcyhbMjAsIDMwXSk7XG5cdFx0XHRcdHZhciB5ID0geC5zdW0oKTtcblx0XHRcdFx0ZXhwZWN0KHkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoW10pO1xuXHRcdFx0XHRleHBlY3QoeS5sZW5ndGgpLnRvLmVxdWFsKDEpO1xuXHRcdFx0XHR5LmludmFsaWRhdGUoKTtcblx0XHRcdH0pO1xuXHRcdFx0aXQoXCJDb21wdXRlcyB0aGUgc3VtIG9mIGFsbCBlbGVtZW50cyBpbiBhbiBhcnJheVwiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgxLCAxMDAwMDAsIDEwMDAwMCkucmVzaGFwZShbMjAwLCA1MDBdKTtcblx0XHRcdFx0eC5zdW0oKS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5lcXVhbCg1MDAwMDUwMDAwKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0ZGVzY3JpYmUoXCJBbG9uZyBhbiBheGlzXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aXQoXCJDb3JyZWN0IHNoYXBlIGZvciAzLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pLmxvY2soKTtcblx0XHRcdFx0ZXhwZWN0KHguc3VtKDApLnNoYXBlKS50by5kZWVwLmVxdWFsKFszLCA0XSk7XG5cdFx0XHRcdGV4cGVjdCh4LnN1bSgxKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgNF0pO1xuXHRcdFx0XHRleHBlY3QoeC5zdW0oMikuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDNdKTtcblx0XHRcdFx0eC5pbnZhbGlkYXRlKCk7XG5cdFx0XHR9KTtcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzLCBheGlzIDBcIiwgZnVuY3Rpb24oZG9uZSkge1xuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XG5cdFx0XHRcdHguc3VtKDApLmdldChmdW5jdGlvbih5KSB7XG5cdFx0XHRcdFx0ZXhwZWN0KHkpLnRvLmRlZXAuZXF1YWwoW1sgMTQsIDE2LCAxOCwgMjBdLFxuXHRcdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICBbIDIyLCAyNCwgMjYsIDI4XSxcblx0XHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWyAzMCwgMzIsIDM0LCAzNl1dKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAzLWRpbWVuc2lvbmFsIGFycmF5cywgYXhpcyAxXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pO1xuXHRcdFx0XHR4LnN1bSgxKS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFtbIDE1LCAgMTgsICAyMSwgIDI0XSxcblx0XHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgWyA1MSwgIDU0LCAgNTcsICA2MF1dKTtcblx0XHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAzLWRpbWVuc2lvbmFsIGFycmF5cywgYXhpcyAyXCIsIGZ1bmN0aW9uKGRvbmUpIHtcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pO1xuXHRcdFx0XHR4LnN1bSgyKS5nZXQoZnVuY3Rpb24oeSkge1xuXHRcdFx0XHRcdGV4cGVjdCh5KS50by5kZWVwLmVxdWFsKFtbIDEwLCAgMjYsICA0Ml0sXG5cdFx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgIFsgNTgsICA3NCwgIDkwXV0pO1xuXHRcdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cdGRlc2NyaWJlKFwiZG90XCIsIGZ1bmN0aW9uKCkge1xuXHRcdGl0KFwiQ29ycmVjdCBzaGFwZSBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuZW1wdHkoWzIsIDVdKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC5lbXB0eShbNSwgMTFdKTtcblx0XHRcdHZhciB6ID0gY29udGV4dC5kb3QoeCwgeSk7XG5cdFx0XHRleHBlY3Qoei5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMTFdKTtcblx0XHRcdHouaW52YWxpZGF0ZSgpO1xuXHRcdH0pO1xuXHRcdGl0KFwiQ29ycmVjdCBzaGFwZSBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuZW1wdHkoWzIsIDMsIDRdKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC5lbXB0eShbNywgNCwgOF0pO1xuXHRcdFx0dmFyIHogPSBjb250ZXh0LmRvdCh4LCB5KTtcblx0XHRcdGV4cGVjdCh6LnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAzLCA3LCA4XSk7XG5cdFx0XHR6LmludmFsaWRhdGUoKTtcblx0XHR9KTtcblx0XHRpdChcIkNvcnJlY3Qgc2hhcGUgZm9yIDQtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KFsyLCAzLCA0LCA1XSk7XG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuZW1wdHkoWzYsIDcsIDUsIDhdKTtcblx0XHRcdHZhciB6ID0gY29udGV4dC5kb3QoeCwgeSk7XG5cdFx0XHRleHBlY3Qoei5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMywgNCwgNiwgNywgOF0pO1xuXHRcdFx0ei5pbnZhbGlkYXRlKCk7XG5cdFx0fSk7XG5cdFx0aXQoXCJDb3JyZWN0IHZhbHVlIGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzIsIDVdKTtcblx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbNSwgMTFdKTtcblx0XHRcdGNvbnRleHQuZG90KHgsIHkpLmdldChmdW5jdGlvbih6KSB7XG5cdFx0XHRcdGV4cGVjdCh6KS50by5kZWVwLmVxdWFsKDY1KTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0aXQoXCJDb3JyZWN0IHZhbHVlIGZvciAyLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKSB7XG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1s2NCwgIDIsICAzXSxcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgWzYxLCA2MCwgIDZdXSk7XG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoW1s5MiwgOTksICAxLCAgOCwgMTVdLFxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbNjcsIDc0LCA1MSwgNTgsIDQwXSxcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgWzk4LCA4MCwgIDcsIDE0LCAxNl1dKTtcblx0XHRcdHZhciB6ID0gY29udGV4dC5kb3QoeCwgeSk7XG5cdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbWyAgNjMxNiwgIDY3MjQsICAxODcsICA2NzAsIDEwODhdLFxuXHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbIDEwMjIwLCAxMDk1OSwgMzE2MywgNDA1MiwgMzQxMV1dKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXX0=
