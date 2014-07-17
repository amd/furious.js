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

var NDArray = _dereq_("./NDArray");
var DataType = _dereq_("./DataType");
var util = _dereq_("./util");
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

},{"./DataType":1,"./NDArray":3,"./jsmath":7,"./util":8}],3:[function(_dereq_,module,exports){
"use strict";

var util = _dereq_("./util");
var DataType = _dereq_("./DataType");

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

},{"./DataType":1,"./util":8}],4:[function(_dereq_,module,exports){
"use strict";

var NDArray = _dereq_("./NDArray");
var DataType = _dereq_("./DataType");
var allocator = _dereq_("./allocator");
var util = _dereq_("./util");

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

},{"./DataType":1,"./NDArray":3,"./allocator":5,"./util":8}],5:[function(_dereq_,module,exports){
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
var JSContext = _dereq_("./JSContext");
var PNaClContext = _dereq_("./PNaClContext");
var WebCLContext = _dereq_("./webcl/WebCLContext");

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

},{"./DataType":1,"./JSContext":2,"./PNaClContext":4,"./webcl/WebCLContext":9}],7:[function(_dereq_,module,exports){
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

},{}],8:[function(_dereq_,module,exports){
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

},{"./DataType":1,"./NDArray":3}],9:[function(_dereq_,module,exports){
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

},{"../DataType":1,"../NDArray":3,"../util":8}]},{},[6])
(6)
});