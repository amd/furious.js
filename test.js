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
	var array = this.empty(shape, dataType, this);
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
	util.checkShape(shape);
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
		var innerStride = 1;
		for (var i = axis + 1; i < shapeA.length; i++) {
			innerStride *= shapeA[i];
		}
		var repeatLengthA = shapeA[axis];
		var dataA = a._data;
		var dataOut = out._data;
		for (var i = 0; i < outerStride; i++) {
			for (var j = 0; j < repeatLengthA; j++) {
				for (var k = 0; k < innerStride; k++) {
					var valueA = dataA[(i * repeatLengthA + j) * innerStride + k];
					for (var c = 0; c < repeats; c++) {
						dataOut[((i * repeatLengthA + j) * repeats + c) * innerStride + k] = valueA;
					}
				}
			}
		}
	} catch (e) {
		a._incRef();
		throw e;
	}
	a._tryInvalidate();
	return out;
};

/**
 * Adds one number or array with another number or array.
 * Addition is performed element-by-element.
 *
 * @method mul
 * @param {(NDArray|Number)} a - one number or array to add. If **b** is a *Number*, **a** must be an *NDArray*.
 * @param {(NDArray|Number)} b - another number or array to add. If **a** is a *Number*, **b** must be an *NDArray*.
 * @param {NDArray} [out] - the array where the result is to be stored. If provided, must match the shape and data type of input arrays.
 * @return {NDArray} - the result of element-wise addition of **a** and **b**.
 */
JSContext.prototype.add = function(a, b, out) {
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
			out = new NDArray(shapeOut, dataTypeOut, this);
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
				var dataA = a._data, dataB = b._data, dataOut = out._data, n = out.length;
				for (var i = 0; i < n; ++i) {
					dataOut[i] = dataA[i] + dataB[i];
				}
			} else {
				var dataA = a._data, dataOut = out._data, n = out.length;
				for (var i = 0; i < n; ++i) {
					dataOut[i] = dataA[i] + b;
				}
			}
		} else {
			var dataB = b._data, dataOut = out._data, n = out.length;
			for (var i = 0; i < n; ++i) {
				dataOut[i] = a + dataB[i];
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
	if (a instanceof NDArray) {
		a._tryInvalidate();
	}
	if (b instanceof NDArray) {
		b._tryInvalidate();
	}
	return out;
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
			out = new NDArray(shapeOut, dataTypeOut, this);
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
				var dataA = a._data, dataB = b._data, dataOut = out._data, n = out.length;
				for (var i = 0; i < n; ++i) {
					dataOut[i] = dataA[i] - dataB[i];
				}
			} else {
				var dataA = a._data, dataOut = out._data, n = out.length;
				for (var i = 0; i < n; ++i) {
					dataOut[i] = dataA[i] - b;
				}
			}
		} else {
			var dataB = b._data, dataOut = out._data, n = out.length;
			for (var i = 0; i < n; ++i) {
				dataOut[i] = a - dataB[i];
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
	if (a instanceof NDArray) {
		a._tryInvalidate();
	}
	if (b instanceof NDArray) {
		b._tryInvalidate();
	}
	return out;
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
			out = new NDArray(shapeOut, dataTypeOut, this);
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
				var dataA = a._data, dataB = b._data, dataOut = out._data, n = out.length;
				for (var i = 0; i < n; ++i) {
					dataOut[i] = dataA[i] * dataB[i];
				}
			} else {
				var dataA = a._data, dataOut = out._data, n = out.length;
				for (var i = 0; i < n; ++i) {
					dataOut[i] = dataA[i] * b;
				}
			}
		} else {
			var dataB = b._data, dataOut = out._data, n = out.length;
			for (var i = 0; i < n; ++i) {
				dataOut[i] = a * dataB[i];
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
	if (a instanceof NDArray) {
		a._tryInvalidate();
	}
	if (b instanceof NDArray) {
		b._tryInvalidate();
	}
	return out;
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
			out = new NDArray(shapeOut, dataTypeOut, this);
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
				var dataA = a._data, dataB = b._data, dataOut = out._data, n = out.length;
				for (var i = 0; i < n; ++i) {
					dataOut[i] = dataA[i] / dataB[i];
				}
			} else {
				var dataA = a._data, dataOut = out._data, n = out.length;
				for (var i = 0; i < n; ++i) {
					dataOut[i] = dataA[i] / b;
				}
			}
		} else {
			var dataB = b._data, dataOut = out._data, n = out.length;
			for (var i = 0; i < n; ++i) {
				dataOut[i] = a / dataB[i];
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
	if (a instanceof NDArray) {
		a._tryInvalidate();
	}
	if (b instanceof NDArray) {
		b._tryInvalidate();
	}
	return out;
};

JSContext.prototype.min = function(inArray, axis) {
	if (typeof axis === "undefined") {
		var output = this.empty([], inArray.dataType);

		/* Computation of all-array min */
		var result = inArray._data[0];
		for (var i = 1; i < inArray.length; ++i) {
			result = Math.min(result, inArray._data[i]);
		}
		output._data[0] = result;

		return output;
	} else if (util.isInt(axis)) {
		axis = util.checkAxis(axis, inArray.shape.length);
		var outShape = util.computeAxisReductionOutShape(inArray.shape, axis);
		var outArray = this.empty(outShape, inArray.dataType);

		/* Computation of min along axis */
		var outerStride = util.computeOuterStride(inArray.shape, axis);
		var innerStride = util.computeInnerStride(inArray.shape, axis);
		var reductionDim = inArray.shape[axis];
		for (var i = 0; i < outerStride; ++i) {
			for (var k = 0; k < innerStride; ++k) {
				var offset = i * reductionDim * innerStride + k;
				var currentMin = inArray._data[offset];
				for (var j = 1; j < reductionDim; ++j) {
					offset += innerStride;
					currentMin = Math.min(currentMin, inArray._data[offset]);
				}
				outArray._data[i * innerStride + k] = currentMin;
			}
		}

		return outArray;
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

JSContext.prototype.max = function(inArray, axis) {
	if (typeof axis === "undefined") {
		var output = this.empty([], inArray.dataType);

		/* Computation of all-array max */
		var result = inArray._data[0];
		for (var i = 1; i < inArray.length; ++i) {
			result = Math.max(result, inArray._data[i]);
		}
		output._data[0] = result;

		return output;
	} else if (util.isInt(axis)) {
		axis = util.checkAxis(axis, inArray.shape.length);
		var outShape = util.computeAxisReductionOutShape(inArray.shape, axis);
		var outArray = this.empty(outShape, inArray.dataType);

		/* Computation of max along axis */
		var outerStride = util.computeOuterStride(inArray.shape, axis);
		var innerStride = util.computeInnerStride(inArray.shape, axis);
		var reductionDim = inArray.shape[axis];
		for (var i = 0; i < outerStride; ++i) {
			for (var k = 0; k < innerStride; ++k) {
				var offset = i * reductionDim * innerStride + k;
				var currentMax = inArray._data[offset];
				for (var j = 1; j < reductionDim; ++j) {
					offset += innerStride;
					currentMax = Math.max(currentMax, inArray._data[offset]);
				}
				outArray._data[i * innerStride + k] = currentMax;
			}
		}

		return outArray;
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

JSContext.prototype.sum = function(inArray, axis) {
	if (typeof axis === "undefined") {
		var output = this.empty([], inArray.dataType);

		/* Computation of all-array sum */
		var result = inArray._data[0];
		for (var i = 1; i < inArray.length; ++i) {
			result += inArray._data[i];
		}
		output._data[0] = result;

		return output;
	} else if (util.isInt(axis)) {
		axis = util.checkAxis(axis, inArray.shape.length);
		var outShape = util.computeAxisReductionOutShape(inArray.shape, axis);
		var outArray = this.empty(outShape, inArray.dataType);

		/* Computation of sum along axis */
		var outerStride = util.computeOuterStride(inArray.shape, axis);
		var innerStride = util.computeInnerStride(inArray.shape, axis);
		var reductionDim = inArray.shape[axis];
		for (var i = 0; i < outerStride; ++i) {
			for (var k = 0; k < innerStride; ++k) {
				var offset = i * reductionDim * innerStride + k;
				var currentSum = inArray._data[offset];
				for (var j = 1; j < reductionDim; ++j) {
					offset += innerStride;
					currentSum += inArray._data[offset];
				}
				outArray._data[i * innerStride + k] = currentSum;
			}
		}

		return outArray;
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

/**
 * Negates array elements.
 *
 * @method neg
 * @param {NDArray} a - the array of elements to be negated.
 * @param {NDArray} [out] - the array for negated elements. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.neg = function(a, out) {
	util.checkNDArray(a, "a");
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, this);
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
		var dataA = a._data, dataOut = out._data, n = a.length;
		for (var i = 0; i < n; ++i) {
			dataOut[i] = -dataA[i];
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	a._tryInvalidate();
	return out;
};

/**
 * Computes absolute value of array elements.
 *
 * @method abs
 * @param {NDArray} a - the array of input elements.
 * @param {NDArray} [out] - the array for computed absolute values. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.abs = function(a, out) {
	util.checkNDArray(a, "a");
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, this);
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
		var dataA = a._data, dataOut = out._data, n = a.length;
		for (var i = 0; i < n; ++i) {
			dataOut[i] = Math.abs(dataA[i]);
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	a._tryInvalidate();
	return out;
};

/**
 * Exponentiates array elements.
 *
 * @method exp
 * @param {NDArray} a - the array of elements to be exponentiated.
 * @param {NDArray} [out] - the array for exponentiated elements. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.exp = function(a, out) {
	util.checkNDArray(a, "a");
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, this);
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
		var dataA = a._data, dataOut = out._data, n = a.length;
		for (var i = 0; i < n; ++i) {
			dataOut[i] = Math.exp(dataA[i]);
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	a._tryInvalidate();
	return out;
};

/**
 * Computes logarithm of array elements.
 *
 * @method log
 * @param {NDArray} a - the array of input elements.
 * @param {NDArray} [out] - the array for computed logarithm values. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.log = function(a, out) {
	util.checkNDArray(a, "a");
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, this);
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
		var dataA = a._data, dataOut = out._data, n = a.length;
		for (var i = 0; i < n; ++i) {
			dataOut[i] = Math.log(dataA[i]);
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	a._tryInvalidate();
	return out;
};

/**
 * Computes square root of array elements.
 *
 * @method sqrt
 * @param {NDArray} a - the array of input elements.
 * @param {NDArray} [out] - the array for computed square root values. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.sqrt = function(a, out) {
	util.checkNDArray(a, "a");
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, this);
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
		var dataA = a._data, dataOut = out._data, n = a.length;
		for (var i = 0; i < n; ++i) {
			dataOut[i] = Math.sqrt(dataA[i]);
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	a._tryInvalidate();
	return out;
};

/**
 * Squares array elements.
 *
 * @method square
 * @param {NDArray} a - the array of elements to be squared.
 * @param {NDArray} [out] - the array for squared elements. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.square = function(a, out) {
	util.checkNDArray(a, "a");
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, this);
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
		var dataA = a._data, dataOut = out._data, n = a.length;
		for (var i = 0; i < n; ++i) {
			var valueA = dataA[i];
			dataOut[i] = valueA * valueA;
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	a._tryInvalidate();
	return out;
};

/**
 * Computes the dot product of two N-dimensional arrays.
 *
 * @method dot
 * @param {NDArray} a - the first input array.
 * @param {NDArray} b - the second input array.
 * @param {NDArray} [out] - the output array. If supplied, must match the data type of **a** and **b** arrays and have the expected shape.
 * @return {NDArray} - the array with the dot product of **a** and **b**.
 */
JSContext.prototype.dot = function(a, b, out) {
	util.checkNDArray(a, "a");
	util.checkNDArray(b, "b");
	util.checkDataTypesCompatibility(a.dataType, b.dataType);

	/* The axis of b used in reduction: axis 0 for 1D array, second-to-last axis for ND array */
	var aAxis = Math.max(a.shape.length - 1, 0);
	var bAxis = Math.max(b.shape.length - 2, 0);
	var reductionLength = a.shape[aAxis];
	if (reductionLength !== b.shape[bAxis]) {
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
	}
	var dataA = a._data, dataB = b._data, dataOut = out._data;
	for (var i = 0; i < strideA; i++) {
		for (var j = 0; j < reductionLength; j++) {
			for (var k = 0; k < outerStrideB; k++) {
				for (var l = 0; l < innerStrideB; l++) {
					dataOut[(i*outerStrideB + k) * innerStrideB + l] += dataA[i*reductionLength+j] * dataB[(k*reductionLength+j)*innerStrideB+l];
				}
			}
		}
	}
	return out;
};

/**
 * Creates an arithmetic sequence.
 *
 * @method linspace
 * @param {Number} start - the starting endpoint of the sequence. Must be a finite number.
 * @param {Number} stop - the final endpoint of the sequence. Must be a finite number.
 * @param {Number} [samples=50] - the number of samples in the sequency. Must be a positive integer.
 * @param {Boolean} [includeStop=true] - an indicator of whether the final endpoint (`stop` argument) should be included in the sequence.
 */
JSContext.prototype.linspace = function(start, stop, samples, includeStop) {
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
	var array = this.empty(samples, new DataType("f64"));
	var data = array._data;
	var range = stop - start;
	var n = (includeStop) ? samples - 1 : samples;
	var step = range / n;
	for (var i = 0; i < samples; i++) {
		data[i] = start + step * i;
	}
	return array;
};

module.exports = JSContext;

},{"./DataType":1,"./NDArray":3,"./util":9}],3:[function(require,module,exports){
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
 * Decrements the array reference count. If the reference count achieves zero, the array becomes invalid and its data buffer is deallocated.
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
		this._context.invalidate(this);
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

},{"./DataType":1,"./util":9}],4:[function(require,module,exports){
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
	if (array._id !== 0) {
		this._pnaclObject.postMessage({
			"id": allocator.newMessageId(),
			"command": "release",
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
	for (var i = 0; i < arguments.length - 1; i++) {
		if (!(arguments[i] instanceof NDArray)) {
			throw new TypeError("Argument " + i + " is not an NDArray");
		}
	}
	var callbackWaitArguments = arguments.length - 1;
	var callbackArguments = new Array(callbackWaitArguments);
	for (var i = 0; i < callbackWaitArguments; i++) {
		var array = arguments[i];
		var messageId = allocator.newMessageId();
		if (array.shape.length === 0) {
			messageCallbacks[messageId] = (function(i) {
				return function(buffer) {
					var typedArray = new array.dataType.arrayType(buffer);
					callbackArguments[i] = typedArray[0];
					if (--callbackWaitArguments === 0) {
						callback.apply(null, callbackArguments);
					}
				};
			})(i);
		} else {
			messageCallbacks[messageId] = (function(i) {
				return function(buffer) {
					var jsarray = new Array(array.shape[0]);
					util.createArrayRecursive(new array.dataType.arrayType(buffer), jsarray, array.shape, 0, 0);
					callbackArguments[i] = jsarray;
					if (--callbackWaitArguments === 0) {
						callback.apply(null, callbackArguments);
					}
				};
			})(i);
		}
		this._pnaclObject.postMessage({
			"id": messageId,
			"command": "get",
			"in": array._id
		});
	}
};

var binaryArithOp = function(a, b, out, context, operation) {
	var shapeOut = null, dataTypeOut = null, idA = 0, idB = 0;
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
				out._id = a._id;
				a._id = 0;
			} else if ((b instanceof NDArray) && !b._hasRefs()) {
				out._id = b._id;
				b._id = 0;
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
					"a": idA,
					"b": idB,
					"out": out._id
				});
			} else {
				context._pnaclObject.postMessage({
					"id": allocator.newMessageId(),
					"command": operation + "c",
					"a": idA,
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
					"a": idB,
					"b": a,
					"out": out._id
				});
			} else {
				context._pnaclObject.postMessage({
					"id": allocator.newMessageId(),
					"command": "r" + operation + "c",
					"a": idA,
					"b": b,
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
	var idA = a._id;
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, context);
			if ((a instanceof NDArray) && !a._hasRefs()) {
				out._id = a._id;
				a._id = 0;
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
		"a": idA,
		"out": out._id
	});
	a._tryInvalidate();
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

},{"./DataType":1,"./NDArray":3,"./allocator":7,"./util":9}],5:[function(require,module,exports){
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

WebCLContext.prototype._invalidate = function(array) {
	util.checkNDArray(array, "array");
	array._buffer.release();
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

},{"./DataType":1,"./NDArray":3,"./WebCLKernels.js":6,"./util":9}],6:[function(require,module,exports){
"use strict";

module.exports = [
	"kernel void addF32(",
	"	uint length,",
	"	global float* a,",
	"	global float* b,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] + b[id];",
	"	}",
	"}",
	"kernel void addF64(",
	"	uint length,",
	"	global double* a,",
	"	global double* b,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] + b[id];",
	"	}",
	"}",
	"kernel void subF32(",
	"	uint length,",
	"	global float* a,",
	"	global float* b,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] - b[id];",
	"	}",
	"}",
	"kernel void subF64(",
	"	uint length,",
	"	global double* a,",
	"	global double* b,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] - b[id];",
	"	}",
	"}",
	"kernel void mulF32(",
	"	uint length,",
	"	global float* a,",
	"	global float* b,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] * b[id];",
	"	}",
	"}",
	"kernel void mulF64(",
	"	uint length,",
	"	global double* a,",
	"	global double* b,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] * b[id];",
	"	}",
	"}",
	"kernel void divF32(",
	"	uint length,",
	"	global float* a,",
	"	global float* b,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] / b[id];",
	"	}",
	"}",
	"kernel void divF64(",
	"	uint length,",
	"	global double* a,",
	"	global double* b,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] / b[id];",
	"	}",
	"}",
	"kernel void addConstF32(",
	"	uint length,",
	"	global float* a,",
	"	float b,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] + b;",
	"	}",
	"}",
	"kernel void addConstF64(",
	"	uint length,",
	"	global double* a,",
	"	double b,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] + b;",
	"	}",
	"}",
	"kernel void subConstF32(",
	"	uint length,",
	"	global float* a,",
	"	float b,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] - b;",
	"	}",
	"}",
	"kernel void subConstF64(",
	"	uint length,",
	"	global double* a,",
	"	double b,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] - b;",
	"	}",
	"}",
	"kernel void mulConstF32(",
	"	uint length,",
	"	global float* a,",
	"	float b,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] * b;",
	"	}",
	"}",
	"kernel void mulConstF64(",
	"	uint length,",
	"	global double* a,",
	"	double b,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] * b;",
	"	}",
	"}",
	"kernel void divConstF32(",
	"	uint length,",
	"	global float* a,",
	"	float b,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] / b;",
	"	}",
	"}",
	"kernel void divConstF64(",
	"	uint length,",
	"	global double* a,",
	"	double b,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = a[id] / b;",
	"	}",
	"}",
	"kernel void negF32(",
	"	uint length,",
	"	global float* a,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = -a[id];",
	"	}",
	"}",
	"kernel void negF64(",
	"	uint length,",
	"	global double* a,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = -a[id];",
	"	}",
	"}",
	"kernel void absF32(",
	"	uint length,",
	"	global float* a,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = fabs(a[id]);",
	"	}",
	"}",
	"kernel void absF64(",
	"	uint length,",
	"	global double* a,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = fabs(a[id]);",
	"	}",
	"}",
	"kernel void expF32(",
	"	uint length,",
	"	global float* a,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = exp(a[id]);",
	"	}",
	"}",
	"kernel void expF64(",
	"	uint length,",
	"	global double* a,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = exp(a[id]);",
	"	}",
	"}",
	"kernel void logF32(",
	"	uint length,",
	"	global float* a,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = log(a[id]);",
	"	}",
	"}",
	"kernel void logF64(",
	"	uint length,",
	"	global double* a,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = log(a[id]);",
	"	}",
	"}",
	"kernel void sqrtF32(",
	"	uint length,",
	"	global float* a,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = sqrt(a[id]);",
	"	}",
	"}",
	"kernel void sqrtF64(",
	"	uint length,",
	"	global double* a,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		out[id] = sqrt(a[id]);",
	"	}",
	"}",
	"kernel void squareF32(",
	"	uint length,",
	"	global float* a,",
	"	global float* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		const float aVal = a[id]; ",
	"		out[id] = aVal * aVal;",
	"	}",
	"}",
	"kernel void squareF64(",
	"	uint length,",
	"	global double* a,",
	"	global double* out)",
	"{",
	"	const uint id = get_global_id(0);",
	"	if (id < length) {",
	"		const double aVal = a[id];",
	"		out[id] = aVal * aVal;",
	"	}",
	"}"
].join("\n");

},{}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
"use strict";

/**
 * Provides information and support functions
 *
 * @class furious
 */

var DataType = require("./DataType");
var JSContext = require("./JSContext");
var PNaClContext = require("./PNaClContext");
var WebCLContext = require("./WebCLContext");

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
			} else if (typeof WebCL !== "undefined") {
				try {
					var webcl = new WebCL();
					var platforms = webcl.getPlatforms();
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

},{"./DataType":1,"./JSContext":2,"./PNaClContext":4,"./WebCLContext":5}],9:[function(require,module,exports){
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

},{"./DataType":1,"./NDArray":3}],10:[function(require,module,exports){
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

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
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
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf.writeInt8(subject[i], i)
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

	var ZERO   = '0'.charCodeAt(0)
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

	module.exports.toByteArray = b64ToByteArray
	module.exports.fromByteArray = uint8ToBase64
}())

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

},{"../lib/furious.js":8,"chai":13}],46:[function(require,module,exports){
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
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				expect(x.min(0).shape).to.deep.equal([3, 4]);
				expect(x.min(1).shape).to.deep.equal([2, 4]);
				expect(x.min(2).shape).to.deep.equal([2, 3]);
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
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				expect(x.max(0).shape).to.deep.equal([3, 4]);
				expect(x.max(1).shape).to.deep.equal([2, 4]);
				expect(x.max(2).shape).to.deep.equal([2, 3]);
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
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				expect(x.sum(0).shape).to.deep.equal([3, 4]);
				expect(x.sum(1).shape).to.deep.equal([2, 4]);
				expect(x.sum(2).shape).to.deep.equal([2, 3]);
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
describe("empty", function(){
	it("No error with integer shape", function(){
		expect(function (){context.empty(100);}).to.not.throw(Error);
	});
	it("No error with integer array shape", function(){
		expect(function (){context.empty([100]);}).to.not.throw(Error);
	});
	it("No error with multi-dimensional integer array shape", function(){
		expect(function (){context.empty([2, 5, 1]);}).to.not.throw(Error);
	});
	it("No error with explicit F64 data type", function(){
		expect(function (){context.empty([2, 5, 1], furious.DataType("f64"));}).to.not.throw(Error);
	});
	it("No error with F32 data type", function(){
		expect(function (){context.empty([2, 5, 1], furious.DataType("f32"));}).to.not.throw(Error);
	});
});
describe("array", function(){
	it("Matches the length of the provided array", function(){
		expect((context.array([0, 1])).length).to.equal(2);
		expect((context.array([[0, 1], [2,3], [3,4]])).length).to.equal(6);
	});
	it("Matches the shape of the provided array", function(){
		expect((context.array([0, 1])).shape).to.deep.equal([2]);
		expect((context.array([[0, 1], [2,3], [3,4]])).shape).to.deep.equal([3, 2]);
		expect((context.array([[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]])).shape).to.deep.equal([2, 2, 3]);
	});
	it("Matches the data of the provided array", function(done){
		var array = [[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]];
		var x = context.array(array);
		x.get(function(result){
			expect(result).to.deep.equal(array);
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
	it("Correct result for 2-dimensional array", function(done){
		var x = context.array([1, -7.5, 0, -15]);
		var y = context.neg(x);
		y.get(function(result){
			expect(result).to.deep.equal([-1, 7.5, -0, 15]);
			done();
		});
	});
});
describe("abs", function() {
	it("Correct result for 2-dimensional array", function(done){
		var x = context.array([1, -7.5, 0, -15]);
		var y = context.abs(x);
		y.get(function(result){
			expect(result).to.deep.equal([1, 7.5, 0, 15]);
			done();
		});
	});
});
describe("exp", function() {
	it("Correct result for 1-dimensional newly created output array", function(done){
		var x = context.array([1, -1, 0]);
		context.exp(x).get(function(result) {
			expect(result[0]).to.be.closeTo(Math.exp(1), Math.exp(1) * 2.2204460492503130808472633361816E-16 * 3);
			expect(result[1]).to.be.closeTo(Math.exp(-1), Math.exp(-1) * 2.2204460492503130808472633361816E-16 * 3);
			expect(result[2]).to.equal(1);
			done();
		});
	});
});
describe("log", function() {
	it("Correct result for 1-dimensional newly created output array", function(done){
		var x = context.array([1, 3, 10]);
		context.log(x).get(function(result) {
			expect(result[0]).to.equal(0);
			expect(result[1]).to.be.closeTo(Math.log(3), Math.log(3) * 2.2204460492503130808472633361816E-16 * 3);
			expect(result[2]).to.be.closeTo(Math.log(10), Math.log(10) * 2.2204460492503130808472633361816E-16 * 3);
			done();
		});
	});
});
describe("sqrt", function() {
	it("Correct result for 1-dimensional newly created output array", function(done){
		var x = context.array([0, 0.25, 1, 9, 10]);
		context.sqrt(x).get(function(result) {
			expect(result[0]).to.equal(0);
			expect(result[1]).to.equal(0.5);
			expect(result[2]).to.equal(1);
			expect(result[3]).to.equal(3);
			expect(result[4]).to.be.closeTo(Math.sqrt(10), Math.sqrt(10) * 2.2204460492503130808472633361816E-16 * 3);
			done();
		});
	});
});
describe("square", function() {
	it("Correct result for 1-dimensional newly created output array", function(done){
		var x = context.array([-2, 0, 0.5, 1, 3]);
		context.square(x).get(function(result) {
			expect(result[0]).to.equal(4);
			expect(result[1]).to.equal(0);
			expect(result[2]).to.equal(0.25);
			expect(result[3]).to.equal(1);
			expect(result[4]).to.equal(9);
			done();
		});
	});
});

},{"../lib/furious.js":8,"chai":13}]},{},[45,46])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJDOlxcUHJvamVjdHNcXGZ1cmlvdXMuanNcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9saWIvRGF0YVR5cGUuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL2xpYi9KU0NvbnRleHQuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL2xpYi9OREFycmF5LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9saWIvUE5hQ2xDb250ZXh0LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9saWIvV2ViQ0xDb250ZXh0LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9saWIvV2ViQ0xLZXJuZWxzLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9saWIvYWxsb2NhdG9yLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9saWIvZnVyaW91cy5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbGliL3V0aWwuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9pbmRleC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL2Fzc2VydGlvbi5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvY29uZmlnLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS9jb3JlL2Fzc2VydGlvbnMuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL2ludGVyZmFjZS9hc3NlcnQuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL2ludGVyZmFjZS9leHBlY3QuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL2ludGVyZmFjZS9zaG91bGQuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL2FkZENoYWluYWJsZU1ldGhvZC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvYWRkTWV0aG9kLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9hZGRQcm9wZXJ0eS5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvZmxhZy5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvZ2V0QWN0dWFsLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9nZXRFbnVtZXJhYmxlUHJvcGVydGllcy5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvZ2V0TWVzc2FnZS5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvZ2V0TmFtZS5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvZ2V0UGF0aFZhbHVlLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9nZXRQcm9wZXJ0aWVzLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9pbmRleC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvaW5zcGVjdC5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvb2JqRGlzcGxheS5qcyIsIkM6L1Byb2plY3RzL2Z1cmlvdXMuanMvbm9kZV9tb2R1bGVzL2NoYWkvbGliL2NoYWkvdXRpbHMvb3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy9vdmVyd3JpdGVNZXRob2QuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL2xpYi9jaGFpL3V0aWxzL292ZXJ3cml0ZVByb3BlcnR5LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy90ZXN0LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy90cmFuc2ZlckZsYWdzLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9saWIvY2hhaS91dGlscy90eXBlLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9ub2RlX21vZHVsZXMvYXNzZXJ0aW9uLWVycm9yL2luZGV4LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9ub2RlX21vZHVsZXMvZGVlcC1lcWwvaW5kZXguanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL25vZGVfbW9kdWxlcy9jaGFpL25vZGVfbW9kdWxlcy9kZWVwLWVxbC9saWIvZXFsLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9ub2RlX21vZHVsZXMvZGVlcC1lcWwvbm9kZV9tb2R1bGVzL3R5cGUtZGV0ZWN0L2luZGV4LmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy9ub2RlX21vZHVsZXMvY2hhaS9ub2RlX21vZHVsZXMvZGVlcC1lcWwvbm9kZV9tb2R1bGVzL3R5cGUtZGV0ZWN0L2xpYi90eXBlLmpzIiwiQzovUHJvamVjdHMvZnVyaW91cy5qcy90ZXN0L0RhdGFUeXBlLnRlc3QuanMiLCJDOi9Qcm9qZWN0cy9mdXJpb3VzLmpzL3Rlc3QvTkRBcnJheS50ZXN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNThCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyV0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5akJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdGJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1bkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2x5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaGlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqUUE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogQSBudW1lcmljYWwgZGF0YSB0eXBlIG9iamVjdC5cclxuICpcclxuICogQGNsYXNzIERhdGFUeXBlXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZSAtIHRoZSBhYmJyZXZpYXRlZCBuYW1lIG9mIHRoZSBkYXRhIHR5cGUuIFRoZSBmb2xsb3dpbmcgbmFtZXMgYXJlIHN1cHBvcnRlZDpcclxuICpcclxuICogICAgIDx0YWJsZT5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0aD5BYmJyZXZpYXRlZCBOYW1lPC90aD5cclxuICogICAgICAgICAgICAgPHRoPkludGVycHJldGF0aW9uPC90aD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwiZjMyXCI8L3RkPlxyXG4gKiAgICAgICAgICAgICA8dGQ+U2luZ2xlLXByZWNpc2lvbiAoMzItYml0KSBJRUVFLTc1NCBmbG9hdGluZy1wb2ludCB0eXBlLjwvdGQ+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cImY2NFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPkRvdWJsZS1wcmVjaXNpb24gKDY0LWJpdCkgSUVFRS03NTQgZmxvYXRpbmctcG9pbnQgdHlwZS48L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICA8L3RhYmxlPlxyXG4gKlxyXG4gKi9cclxuZnVuY3Rpb24gRGF0YVR5cGUodHlwZSkge1xyXG5cdGlmIChbXCJmMzJcIiwgXCJmNjRcIl0uaW5kZXhPZih0eXBlKSA+PSAwKSB7XHJcblx0XHR0aGlzLnR5cGUgPSB0eXBlO1xyXG5cdFx0dGhpcy5zaXplID0ge1wiZjMyXCI6IDQsIFwiZjY0XCI6IDh9W3R5cGVdO1xyXG5cdFx0dGhpcy5hcnJheVR5cGUgPSB7XCJmMzJcIjogRmxvYXQzMkFycmF5LCBcImY2NFwiOiBGbG9hdDY0QXJyYXl9W3R5cGVdO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlR5cGUgXCIgKyB0eXBlICsgXCIgaXMgbm90IHN1cHBvcnRlZFwiKTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb21wYXJlcyB0d28gZGF0YSB0eXBlIG9iamVjdHMgZm9yIGVxdWFsaXR5LlxyXG4gKlxyXG4gKiBAbWV0aG9kIGVxdWFsc1xyXG4gKiBAcGFyYW0ge2FueX0gb3RoZXIgLSBhbiBvYmplY3QgdG8gY29tcGFyZSB0by5cclxuICovXHJcbkRhdGFUeXBlLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbihvdGhlcikge1xyXG5cdHJldHVybiAob3RoZXIgaW5zdGFuY2VvZiBEYXRhVHlwZSkgJiYgKHRoaXMuYXJyYXlUeXBlID09PSBvdGhlci5hcnJheVR5cGUpO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBEYXRhVHlwZTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgTkRBcnJheSA9IHJlcXVpcmUoXCIuL05EQXJyYXlcIik7XHJcbnZhciBEYXRhVHlwZSA9IHJlcXVpcmUoXCIuL0RhdGFUeXBlXCIpO1xyXG52YXIgdXRpbCA9IHJlcXVpcmUoXCIuL3V0aWxcIik7XHJcblxyXG4vKipcclxuICogUHJvdmlkZXMgbWV0aG9kcyBmb3IgY3JlYXRpb24sIG1hbmlwdWxhdGlvbiwgYW5kIGRlc3RydWN0aW9uIG9mIE4tZGltZW5zaW9uYWwgYXJyYXlzLlxyXG4gKiBBcml0aG1ldGljIG9wZXJhdGlvbnMgYXJlIHBvc3NpYmxlIG9ubHkgb24gYXJyYXlzIHRoYXQgYmVsb25nIHRvIHRoZSBzYW1lIGNvbnRleHQuXHJcbiAqXHJcbiAqIEBjbGFzcyBDb250ZXh0XHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gSlNDb250ZXh0KGNhbGxiYWNrKSB7XHJcblx0Y2FsbGJhY2sodGhpcyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGFuIHVuaW5pYWxpemVkIE4tZGltZW5zaW9uYWwgYXJyYXkuXHJcbiAqXHJcbiAqIEBtZXRob2QgZW1wdHlcclxuICogQHBhcmFtIHtOdW1iZXJ9IHNoYXBlIC0gdGhlIGRpbWVuc2lvbnMgb2YgdGhlIGFycmF5XHJcbiAqIEBwYXJhbSB7RGF0YVR5cGV9IGRhdGFUeXBlIC0gdGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5lbXB0eSA9IGZ1bmN0aW9uKHNoYXBlLCBkYXRhVHlwZSkge1xyXG5cdHNoYXBlID0gdXRpbC5jaGVja1NoYXBlKHNoYXBlKTtcclxuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRkYXRhVHlwZSA9IG5ldyBEYXRhVHlwZShcImY2NFwiKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0ZGF0YVR5cGUgPSB1dGlsLmNoZWNrRGF0YVR5cGUoZGF0YVR5cGUpO1xyXG5cdH1cclxuXHR2YXIgYXJyYXkgPSBuZXcgTkRBcnJheShzaGFwZSwgZGF0YVR5cGUsIHRoaXMpO1xyXG5cdGFycmF5Ll9kYXRhID0gbmV3IGRhdGFUeXBlLmFycmF5VHlwZShhcnJheS5sZW5ndGgpO1xyXG5cdHJldHVybiBhcnJheTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb25zdHJ1Y3RzIGFuIE4tZGltZW5zaW9uYWwgYXJyYXkgb2JqZWN0IHdpdGggdGhlIHByb3ZpZGVkIGRhdGEuXHJcbiAqXHJcbiAqIEBtZXRob2QgYXJyYXlcclxuICogQHBhcmFtIHtOdW1iZXJbXX0gZGF0YSAtIHRoZSBhcnJheSBkYXRhXHJcbiAqIEBwYXJhbSB7RGF0YVR5cGV9IGRhdGFUeXBlIC0gdGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5hcnJheSA9IGZ1bmN0aW9uKGRhdGEsIGRhdGFUeXBlKSB7XHJcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XHJcblx0fSBlbHNlIHtcclxuXHRcdGRhdGFUeXBlID0gdXRpbC5jaGVja0RhdGFUeXBlKGRhdGFUeXBlKTtcclxuXHR9XHJcblx0dmFyIHNoYXBlID0gW107XHJcblx0dXRpbC5kaXNjb3ZlckFycmF5U2hhcGVSZWN1cnNpdmUoZGF0YSwgc2hhcGUsIDApO1xyXG5cdHZhciBhcnJheSA9IHRoaXMuZW1wdHkoc2hhcGUsIGRhdGFUeXBlLCB0aGlzKTtcclxuXHR1dGlsLmNvcHlBcnJheURhdGFSZWN1cnNpdmUoYXJyYXkuX2RhdGEsIGRhdGEsIHNoYXBlLCAwLCAwKTtcclxuXHRyZXR1cm4gYXJyYXk7XHJcbn07XHJcblxyXG4vKipcclxuICogRGUtYWxsb2NhdGVzIGRhdGEgYXNzb2NpYXRlZCB3aXRoIHRoZSBhcnJheS5cclxuICpcclxuICogQG1ldGhvZCBfaW52YWxpZGF0ZVxyXG4gKiBAcHJpdmF0ZVxyXG4gKlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IGFycmF5IC0gdGhlIG4tZGltZW5zaW9uYWwgYXJyYXkgb2JqZWN0IHdpdGggZGF0YSB0byBiZSBkZS1hbGxvY2F0ZWQuXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLl9pbnZhbGlkYXRlID0gZnVuY3Rpb24oYXJyYXkpIHtcclxuXHR1dGlsLmNoZWNrTkRBcnJheShhcnJheSwgXCJhcnJheVwiKTtcclxuXHRhcnJheS5fZGF0YSA9IG51bGw7XHJcbn07XHJcblxyXG4vKipcclxuICogRmV0Y2hlcyBOREFycmF5IGRhdGEgYW5kIGFzeW5jaHJvbm91c2x5IHJldHVybnMgaXQgYXMgSmF2YVNjcmlwdCBhcnJheXMgb3IgbnVtYmVycy5cclxuICpcclxuICogQG1ldGhvZCBnZXRcclxuICogQGFzeW5jXHJcbiAqXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXlzKiAtIE5EQXJyYXlzIHRvIGZldGNoLlxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIEEgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdpdGggdGhlIGRhdGEgd2hlbiBpdCBpcyBhdmFpbGFibGUuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfE51bWJlcltdfSBjYWxsYmFjay5hcnJheXMqIC0gSmF2YVNjcmlwdCBudW1iZXJzIG9yIG11bHRpZGltZW5zaW9uYWwgYXJyYXlzIHdpdGggdGhlIGRhdGEuIFRoZSBudW1iZXIgYW5kIG9yZGVyIG9mIGFyZ3VtZW50cyBtYXRjaGVzIHRoZSBOREFycmF5cyBwYXNzZWQgdG8gdGhlIG1ldGhvZCBjYWxsLlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbigpIHtcclxuXHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgYXJndW1lbnQgbWlzc2luZ1wiKTtcclxuXHR9XHJcblx0dmFyIGNhbGxiYWNrID0gYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXTtcclxuXHQvKiBWYWxpZGF0ZSBhcmd1bWVudHMgKi9cclxuXHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXQgbGVhc3Qgb25lIE5EQXJyYXkgYXJndW1lbnQgZXhwZWN0ZWRcIik7XHJcblx0fVxyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aCAtIDE7ICsraSkge1xyXG5cdFx0dXRpbC5jaGVja05EQXJyYXkoYXJndW1lbnRzW2ldLCBcImFyZ3VtZW50IFwiICsgaSk7XHJcblx0fVxyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aCAtIDE7ICsraSkge1xyXG5cdFx0YXJndW1lbnRzW2ldLl9kZWNSZWYoKTtcclxuXHR9XHJcblx0dmFyIGNhbGxiYWNrQXJndW1lbnRzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrQXJndW1lbnRzLmxlbmd0aDsgKytpKSB7XHJcblx0XHR2YXIgYXJyYXkgPSBhcmd1bWVudHNbaV07XHJcblx0XHRpZiAoYXJyYXkuc2hhcGUubGVuZ3RoID09PSAwKSB7XHJcblx0XHRcdGNhbGxiYWNrQXJndW1lbnRzW2ldID0gYXJyYXkuX2RhdGFbMF07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR2YXIganNhcnJheSA9IG5ldyBBcnJheShhcnJheS5zaGFwZVswXSk7XHJcblx0XHRcdHV0aWwuY3JlYXRlQXJyYXlSZWN1cnNpdmUoYXJyYXkuX2RhdGEsIGpzYXJyYXksIGFycmF5LnNoYXBlLCAwLCAwKTtcclxuXHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBqc2FycmF5O1xyXG5cdFx0fVxyXG5cdH1cclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyArK2kpIHtcclxuXHRcdGFyZ3VtZW50c1tpXS5fdHJ5SW52YWxpZGF0ZSgpO1xyXG5cdH1cclxuXHRjYWxsYmFjay5hcHBseShudWxsLCBjYWxsYmFja0FyZ3VtZW50cyk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhbm90aGVyIGFycmF5IHdpdGggdGhlIHNhbWUgZGF0YSwgYnV0IGRpZmZlcmVudCBkaW1lbnNpb25zLlxyXG4gKlxyXG4gKiBAbWV0aG9kIHJlc2hhcGVcclxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBzaGFwZSAtIGRpbWVuc2lvbnMgb2YgdGhlIG5ldyBhcnJheS5cclxuICovXHJcbkpTQ29udGV4dC5wcm90b3R5cGUucmVzaGFwZSA9IGZ1bmN0aW9uKGFycmF5LCBzaGFwZSkge1xyXG5cdHV0aWwuY2hlY2tTaGFwZShzaGFwZSk7XHJcblx0aWYgKHV0aWwuY29tcHV0ZUxlbmd0aChzaGFwZSkgIT09IGFycmF5Lmxlbmd0aCkge1xyXG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJUaGUgc2hhcGUgaXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgYXJyYXlcIik7XHJcblx0fVxyXG5cdHZhciBvdXQgPSBuZXcgTkRBcnJheShzaGFwZSwgYXJyYXkuZGF0YVR5cGUsIHRoaXMpO1xyXG5cdGlmIChhcnJheS5fZGVjUmVmKCkpIHtcclxuXHRcdG91dC5fZGF0YSA9IG5ldyBvdXQuZGF0YVR5cGUuYXJyYXlUeXBlKG91dC5sZW5ndGgpO1xyXG5cdFx0b3V0Ll9kYXRhLnNldChhcnJheS5fZGF0YSk7XHJcblx0fSBlbHNlIHtcclxuXHRcdG91dC5fZGF0YSA9IGFycmF5Ll9kYXRhO1xyXG5cdFx0YXJyYXkuX3RyeUludmFsaWRhdGUoKTtcclxuXHR9XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBEdXBsaWNhdGVzIGFycmF5IGVsZW1lbnRzIGFsb25nIHRoZSBzcGVjaWZpZWQgYXhpcy5cclxuICpcclxuICogQG1ldGhvZCByZXBlYXRcclxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGlucHV0IGFycmF5LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gcmVwZWF0cyAtIHRoZSBudW1iZXIgb2YgdGltZXMgdG8gcmVwZWF0IGVhY2ggZWxlbWVudC5cclxuICogQHBhcmFtIHtOdW1iZXJ9IGF4aXMgLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgZWxlbWVudHMgd2lsbCBiZSBkdXBsaWNhdGVkLlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gYW4gb3V0cHV0IGFycmF5IHRvIHN0b3JlIHRoZSByZXN1bHQuXHJcbiAqIEByZXR1cm4ge05EQXJyYXl9IC0gYW4gTi1kaW1lbnNpb25hbCBhcnJheSB3aXRoIHJlcGVhdGVkIGVsZW1lbnRzIG9mIGFycmF5ICoqYSoqLlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5yZXBlYXQgPSBmdW5jdGlvbihhLCByZXBlYXRzLCBheGlzLCBvdXQpIHtcclxuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XHJcblx0cmVwZWF0cyA9IHV0aWwuY2hlY2tSZXBlYXRzKHJlcGVhdHMpO1xyXG5cdGF4aXMgPSB1dGlsLmNoZWNrQXhpcyhheGlzLCBhLnNoYXBlLmxlbmd0aCk7XHJcblx0dmFyIHNoYXBlQSA9IGEuc2hhcGU7XHJcblx0dmFyIHNoYXBlT3V0ID0gc2hhcGVBLnNsaWNlKDApO1xyXG5cdHNoYXBlT3V0W2F4aXNdICo9IHJlcGVhdHM7XHJcblx0YS5fZGVjUmVmKCk7XHJcblx0dHJ5IHtcclxuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRcdG91dCA9IHRoaXMuZW1wdHkoc2hhcGVPdXQsIGEuZGF0YVR5cGUpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcclxuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkob3V0LnNoYXBlLCBzaGFwZU91dCk7XHJcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XHJcblx0XHRcdG91dC5faW5jUmVmKCk7XHJcblx0XHR9XHJcblx0XHR2YXIgb3V0ZXJTdHJpZGUgPSB1dGlsLmNvbXB1dGVPdXRlclN0cmlkZShzaGFwZUEsIGF4aXMpO1xyXG5cdFx0dmFyIGlubmVyU3RyaWRlID0gMTtcclxuXHRcdGZvciAodmFyIGkgPSBheGlzICsgMTsgaSA8IHNoYXBlQS5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRpbm5lclN0cmlkZSAqPSBzaGFwZUFbaV07XHJcblx0XHR9XHJcblx0XHR2YXIgcmVwZWF0TGVuZ3RoQSA9IHNoYXBlQVtheGlzXTtcclxuXHRcdHZhciBkYXRhQSA9IGEuX2RhdGE7XHJcblx0XHR2YXIgZGF0YU91dCA9IG91dC5fZGF0YTtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgb3V0ZXJTdHJpZGU7IGkrKykge1xyXG5cdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IHJlcGVhdExlbmd0aEE7IGorKykge1xyXG5cdFx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgaW5uZXJTdHJpZGU7IGsrKykge1xyXG5cdFx0XHRcdFx0dmFyIHZhbHVlQSA9IGRhdGFBWyhpICogcmVwZWF0TGVuZ3RoQSArIGopICogaW5uZXJTdHJpZGUgKyBrXTtcclxuXHRcdFx0XHRcdGZvciAodmFyIGMgPSAwOyBjIDwgcmVwZWF0czsgYysrKSB7XHJcblx0XHRcdFx0XHRcdGRhdGFPdXRbKChpICogcmVwZWF0TGVuZ3RoQSArIGopICogcmVwZWF0cyArIGMpICogaW5uZXJTdHJpZGUgKyBrXSA9IHZhbHVlQTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9IGNhdGNoIChlKSB7XHJcblx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGEuX3RyeUludmFsaWRhdGUoKTtcclxuXHRyZXR1cm4gb3V0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgb25lIG51bWJlciBvciBhcnJheSB3aXRoIGFub3RoZXIgbnVtYmVyIG9yIGFycmF5LlxyXG4gKiBBZGRpdGlvbiBpcyBwZXJmb3JtZWQgZWxlbWVudC1ieS1lbGVtZW50LlxyXG4gKlxyXG4gKiBAbWV0aG9kIG11bFxyXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IGEgLSBvbmUgbnVtYmVyIG9yIGFycmF5IHRvIGFkZC4gSWYgKipiKiogaXMgYSAqTnVtYmVyKiwgKiphKiogbXVzdCBiZSBhbiAqTkRBcnJheSouXHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYiAtIGFub3RoZXIgbnVtYmVyIG9yIGFycmF5IHRvIGFkZC4gSWYgKiphKiogaXMgYSAqTnVtYmVyKiwgKipiKiogbXVzdCBiZSBhbiAqTkRBcnJheSouXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgd2hlcmUgdGhlIHJlc3VsdCBpcyB0byBiZSBzdG9yZWQuIElmIHByb3ZpZGVkLCBtdXN0IG1hdGNoIHRoZSBzaGFwZSBhbmQgZGF0YSB0eXBlIG9mIGlucHV0IGFycmF5cy5cclxuICogQHJldHVybiB7TkRBcnJheX0gLSB0aGUgcmVzdWx0IG9mIGVsZW1lbnQtd2lzZSBhZGRpdGlvbiBvZiAqKmEqKiBhbmQgKipiKiouXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHZhciBzaGFwZU91dCA9IG51bGwsIGRhdGFUeXBlT3V0ID0gbnVsbDtcclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdHNoYXBlT3V0ID0gYS5zaGFwZTtcclxuXHRcdGRhdGFUeXBlT3V0ID0gYS5kYXRhVHlwZTtcclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBiLnNoYXBlKTtcclxuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XHJcblx0XHR9IGVsc2UgaWYgKCF1dGlsLmlzTnVtYmVyKGIpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGJcIik7XHJcblx0XHR9XHJcblx0fSBlbHNlIGlmICh1dGlsLmlzTnVtYmVyKGEpKSB7XHJcblx0XHRzaGFwZU91dCA9IGIuc2hhcGU7XHJcblx0XHRkYXRhVHlwZU91dCA9IGIuZGF0YVR5cGU7XHJcblx0XHR1dGlsLmNoZWNrTkRBcnJheShiLCBcImJcIik7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGFcIik7XHJcblx0fVxyXG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0YS5fZGVjUmVmKCk7XHJcblx0fVxyXG5cdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0Yi5fZGVjUmVmKCk7XHJcblx0fVxyXG5cdHRyeSB7XHJcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShzaGFwZU91dCwgZGF0YVR5cGVPdXQsIHRoaXMpO1xyXG5cdFx0XHRpZiAoKGEgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYS5faGFzUmVmcygpKSB7XHJcblx0XHRcdFx0b3V0Ll9kYXRhID0gYS5fZGF0YTtcclxuXHRcdFx0fSBlbHNlIGlmICgoYiBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFiLl9oYXNSZWZzKCkpIHtcclxuXHRcdFx0XHRvdXQuX2RhdGEgPSBiLl9kYXRhO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG91dC5fZGF0YSA9IG5ldyBkYXRhVHlwZU91dC5hcnJheVR5cGUob3V0Lmxlbmd0aCk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KHNoYXBlT3V0LCBvdXQuc2hhcGUpO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShkYXRhVHlwZU91dCwgb3V0LmRhdGFUeXBlKTtcclxuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdFx0XHR2YXIgZGF0YUEgPSBhLl9kYXRhLCBkYXRhQiA9IGIuX2RhdGEsIGRhdGFPdXQgPSBvdXQuX2RhdGEsIG4gPSBvdXQubGVuZ3RoO1xyXG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcblx0XHRcdFx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gKyBkYXRhQltpXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmFyIGRhdGFBID0gYS5fZGF0YSwgZGF0YU91dCA9IG91dC5fZGF0YSwgbiA9IG91dC5sZW5ndGg7XHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdFx0XHRcdGRhdGFPdXRbaV0gPSBkYXRhQVtpXSArIGI7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR2YXIgZGF0YUIgPSBiLl9kYXRhLCBkYXRhT3V0ID0gb3V0Ll9kYXRhLCBuID0gb3V0Lmxlbmd0aDtcclxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdFx0XHRkYXRhT3V0W2ldID0gYSArIGRhdGFCW2ldO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSBjYXRjaCAoZSkge1xyXG5cdFx0LyogUmVzdG9yZSB0aGUgcHJldmlvdXMgc3RhdGUgKi9cclxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRiLl9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0YS5fdHJ5SW52YWxpZGF0ZSgpO1xyXG5cdH1cclxuXHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGIuX3RyeUludmFsaWRhdGUoKTtcclxuXHR9XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBTdWJ0cmFjdHMgb25lIG51bWJlciBvciBhcnJheSBmcm9tIGFub3RoZXIgbnVtYmVyIG9yIGFycmF5LlxyXG4gKiBTdWJ0cmFjdGlvbiBpcyBwZXJmb3JtZWQgZWxlbWVudC1ieS1lbGVtZW50LlxyXG4gKlxyXG4gKiBAbWV0aG9kIHN1YlxyXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IGEgLSB0aGUgbnVtYmVyIG9yIGFycmF5IHRvIHN1YnRyYWN0IGZyb20uIElmICoqYioqIGlzIGEgKk51bWJlciosICoqYSoqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxyXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IGIgLSB0aGUgbnVtYmVyIG9yIGFycmF5IHRvIHN1YnRyYWN0LiBJZiAqKmEqKiBpcyBhICpOdW1iZXIqLCAqKmIqKiBtdXN0IGJlIGFuICpOREFycmF5Ki5cclxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSB3aGVyZSB0aGUgcmVzdWx0IGlzIHRvIGJlIHN0b3JlZC4gSWYgcHJvdmlkZWQsIG11c3QgbWF0Y2ggdGhlIHNoYXBlIGFuZCBkYXRhIHR5cGUgb2YgaW5wdXQgYXJyYXlzLlxyXG4gKiBAcmV0dXJuIHtOREFycmF5fSAtIHRoZSByZXN1bHQgb2YgZWxlbWVudC13aXNlIHN1YnRyYWN0aW9uIG9mICoqYioqIGZyb20gKiphKiouXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLnN1YiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHZhciBzaGFwZU91dCA9IG51bGwsIGRhdGFUeXBlT3V0ID0gbnVsbDtcclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdHNoYXBlT3V0ID0gYS5zaGFwZTtcclxuXHRcdGRhdGFUeXBlT3V0ID0gYS5kYXRhVHlwZTtcclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBiLnNoYXBlKTtcclxuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XHJcblx0XHR9IGVsc2UgaWYgKCF1dGlsLmlzTnVtYmVyKGIpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGJcIik7XHJcblx0XHR9XHJcblx0fSBlbHNlIGlmICh1dGlsLmlzTnVtYmVyKGEpKSB7XHJcblx0XHRzaGFwZU91dCA9IGIuc2hhcGU7XHJcblx0XHRkYXRhVHlwZU91dCA9IGIuZGF0YVR5cGU7XHJcblx0XHR1dGlsLmNoZWNrTkRBcnJheShiLCBcImJcIik7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGFcIik7XHJcblx0fVxyXG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0YS5fZGVjUmVmKCk7XHJcblx0fVxyXG5cdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0Yi5fZGVjUmVmKCk7XHJcblx0fVxyXG5cdHRyeSB7XHJcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShzaGFwZU91dCwgZGF0YVR5cGVPdXQsIHRoaXMpO1xyXG5cdFx0XHRpZiAoKGEgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYS5faGFzUmVmcygpKSB7XHJcblx0XHRcdFx0b3V0Ll9kYXRhID0gYS5fZGF0YTtcclxuXHRcdFx0fSBlbHNlIGlmICgoYiBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFiLl9oYXNSZWZzKCkpIHtcclxuXHRcdFx0XHRvdXQuX2RhdGEgPSBiLl9kYXRhO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG91dC5fZGF0YSA9IG5ldyBkYXRhVHlwZU91dC5hcnJheVR5cGUob3V0Lmxlbmd0aCk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KHNoYXBlT3V0LCBvdXQuc2hhcGUpO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShkYXRhVHlwZU91dCwgb3V0LmRhdGFUeXBlKTtcclxuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdFx0XHR2YXIgZGF0YUEgPSBhLl9kYXRhLCBkYXRhQiA9IGIuX2RhdGEsIGRhdGFPdXQgPSBvdXQuX2RhdGEsIG4gPSBvdXQubGVuZ3RoO1xyXG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcblx0XHRcdFx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gLSBkYXRhQltpXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmFyIGRhdGFBID0gYS5fZGF0YSwgZGF0YU91dCA9IG91dC5fZGF0YSwgbiA9IG91dC5sZW5ndGg7XHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdFx0XHRcdGRhdGFPdXRbaV0gPSBkYXRhQVtpXSAtIGI7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR2YXIgZGF0YUIgPSBiLl9kYXRhLCBkYXRhT3V0ID0gb3V0Ll9kYXRhLCBuID0gb3V0Lmxlbmd0aDtcclxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdFx0XHRkYXRhT3V0W2ldID0gYSAtIGRhdGFCW2ldO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSBjYXRjaCAoZSkge1xyXG5cdFx0LyogUmVzdG9yZSB0aGUgcHJldmlvdXMgc3RhdGUgKi9cclxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRiLl9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0YS5fdHJ5SW52YWxpZGF0ZSgpO1xyXG5cdH1cclxuXHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGIuX3RyeUludmFsaWRhdGUoKTtcclxuXHR9XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBNdWx0aXBsaWVzIG9uZSBudW1iZXIgb3IgYXJyYXkgYnkgYW5vdGhlciBudW1iZXIgb3IgYXJyYXkuXHJcbiAqIE11bHRpcGxpY2F0aW9uIGlzIHBlcmZvcm1lZCBlbGVtZW50LWJ5LWVsZW1lbnQuXHJcbiAqXHJcbiAqIEBtZXRob2QgbXVsXHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYSAtIG9uZSBudW1iZXIgb3IgYXJyYXkgdG8gbXVsdGlwbHkuIElmICoqYioqIGlzIGEgKk51bWJlciosICoqYSoqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxyXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IGIgLSBhbm90aGVyIG51bWJlciBvciBhcnJheSB0byBtdWx0aXBseS4gSWYgKiphKiogaXMgYSAqTnVtYmVyKiwgKipiKiogbXVzdCBiZSBhbiAqTkRBcnJheSouXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgd2hlcmUgdGhlIHJlc3VsdCBpcyB0byBiZSBzdG9yZWQuIElmIHByb3ZpZGVkLCBtdXN0IG1hdGNoIHRoZSBzaGFwZSBhbmQgZGF0YSB0eXBlIG9mIGlucHV0IGFycmF5cy5cclxuICogQHJldHVybiB7TkRBcnJheX0gLSB0aGUgcmVzdWx0IG9mIGVsZW1lbnQtd2lzZSBtdWx0aXBsaWNhdGlvbiBvZiAqKmEqKiBhbmQgKipiKiouXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLm11bCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHZhciBzaGFwZU91dCA9IG51bGwsIGRhdGFUeXBlT3V0ID0gbnVsbDtcclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdHNoYXBlT3V0ID0gYS5zaGFwZTtcclxuXHRcdGRhdGFUeXBlT3V0ID0gYS5kYXRhVHlwZTtcclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBiLnNoYXBlKTtcclxuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XHJcblx0XHR9IGVsc2UgaWYgKCF1dGlsLmlzTnVtYmVyKGIpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGJcIik7XHJcblx0XHR9XHJcblx0fSBlbHNlIGlmICh1dGlsLmlzTnVtYmVyKGEpKSB7XHJcblx0XHRzaGFwZU91dCA9IGIuc2hhcGU7XHJcblx0XHRkYXRhVHlwZU91dCA9IGIuZGF0YVR5cGU7XHJcblx0XHR1dGlsLmNoZWNrTkRBcnJheShiLCBcImJcIik7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGFcIik7XHJcblx0fVxyXG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0YS5fZGVjUmVmKCk7XHJcblx0fVxyXG5cdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0Yi5fZGVjUmVmKCk7XHJcblx0fVxyXG5cdHRyeSB7XHJcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShzaGFwZU91dCwgZGF0YVR5cGVPdXQsIHRoaXMpO1xyXG5cdFx0XHRpZiAoKGEgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYS5faGFzUmVmcygpKSB7XHJcblx0XHRcdFx0b3V0Ll9kYXRhID0gYS5fZGF0YTtcclxuXHRcdFx0fSBlbHNlIGlmICgoYiBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFiLl9oYXNSZWZzKCkpIHtcclxuXHRcdFx0XHRvdXQuX2RhdGEgPSBiLl9kYXRhO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG91dC5fZGF0YSA9IG5ldyBkYXRhVHlwZU91dC5hcnJheVR5cGUob3V0Lmxlbmd0aCk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KHNoYXBlT3V0LCBvdXQuc2hhcGUpO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShkYXRhVHlwZU91dCwgb3V0LmRhdGFUeXBlKTtcclxuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdFx0XHR2YXIgZGF0YUEgPSBhLl9kYXRhLCBkYXRhQiA9IGIuX2RhdGEsIGRhdGFPdXQgPSBvdXQuX2RhdGEsIG4gPSBvdXQubGVuZ3RoO1xyXG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcblx0XHRcdFx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gKiBkYXRhQltpXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmFyIGRhdGFBID0gYS5fZGF0YSwgZGF0YU91dCA9IG91dC5fZGF0YSwgbiA9IG91dC5sZW5ndGg7XHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdFx0XHRcdGRhdGFPdXRbaV0gPSBkYXRhQVtpXSAqIGI7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR2YXIgZGF0YUIgPSBiLl9kYXRhLCBkYXRhT3V0ID0gb3V0Ll9kYXRhLCBuID0gb3V0Lmxlbmd0aDtcclxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdFx0XHRkYXRhT3V0W2ldID0gYSAqIGRhdGFCW2ldO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSBjYXRjaCAoZSkge1xyXG5cdFx0LyogUmVzdG9yZSB0aGUgcHJldmlvdXMgc3RhdGUgKi9cclxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRiLl9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0YS5fdHJ5SW52YWxpZGF0ZSgpO1xyXG5cdH1cclxuXHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGIuX3RyeUludmFsaWRhdGUoKTtcclxuXHR9XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBEaXZpZGVzIG9uZSBudW1iZXIgb3IgYXJyYXkgYnkgYW5vdGhlciBudW1iZXIgb3IgYXJyYXkuXHJcbiAqIERpdmlzaW9uIGlzIHBlcmZvcm1lZCBlbGVtZW50LWJ5LWVsZW1lbnQuXHJcbiAqXHJcbiAqIEBtZXRob2QgZGl2XHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gYSAtIHRoZSBudW1iZXIgb3IgYXJyYXkgdG8gZGl2aWRlLiBJZiAqKmIqKiBpcyBhICpOdW1iZXIqLCAqKmEqKiBtdXN0IGJlIGFuICpOREFycmF5Ki5cclxuICogQHBhcmFtIHsoTkRBcnJheXxOdW1iZXIpfSBiIC0gdGhlIG51bWJlciBvciBhcnJheSB0byBkaXZpZGUgYnkuIElmICoqYSoqIGlzIGEgKk51bWJlciosICoqYioqIG11c3QgYmUgYW4gKk5EQXJyYXkqLlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IHdoZXJlIHRoZSByZXN1bHQgaXMgdG8gYmUgc3RvcmVkLiBJZiBwcm92aWRlZCwgbXVzdCBtYXRjaCB0aGUgc2hhcGUgYW5kIGRhdGEgdHlwZSBvZiBpbnB1dCBhcnJheXMuXHJcbiAqIEByZXR1cm4ge05EQXJyYXl9IC0gdGhlIHJlc3VsdCBvZiBlbGVtZW50LXdpc2UgZGl2aXNpb24gb2YgKiphKiogYnkgKipiKiouXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLmRpdiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHZhciBzaGFwZU91dCA9IG51bGwsIGRhdGFUeXBlT3V0ID0gbnVsbDtcclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdHNoYXBlT3V0ID0gYS5zaGFwZTtcclxuXHRcdGRhdGFUeXBlT3V0ID0gYS5kYXRhVHlwZTtcclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBiLnNoYXBlKTtcclxuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XHJcblx0XHR9IGVsc2UgaWYgKCF1dGlsLmlzTnVtYmVyKGIpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGJcIik7XHJcblx0XHR9XHJcblx0fSBlbHNlIGlmICh1dGlsLmlzTnVtYmVyKGEpKSB7XHJcblx0XHRzaGFwZU91dCA9IGIuc2hhcGU7XHJcblx0XHRkYXRhVHlwZU91dCA9IGIuZGF0YVR5cGU7XHJcblx0XHR1dGlsLmNoZWNrTkRBcnJheShiLCBcImJcIik7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGFcIik7XHJcblx0fVxyXG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0YS5fZGVjUmVmKCk7XHJcblx0fVxyXG5cdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0Yi5fZGVjUmVmKCk7XHJcblx0fVxyXG5cdHRyeSB7XHJcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShzaGFwZU91dCwgZGF0YVR5cGVPdXQsIHRoaXMpO1xyXG5cdFx0XHRpZiAoKGEgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYS5faGFzUmVmcygpKSB7XHJcblx0XHRcdFx0b3V0Ll9kYXRhID0gYS5fZGF0YTtcclxuXHRcdFx0fSBlbHNlIGlmICgoYiBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFiLl9oYXNSZWZzKCkpIHtcclxuXHRcdFx0XHRvdXQuX2RhdGEgPSBiLl9kYXRhO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG91dC5fZGF0YSA9IG5ldyBkYXRhVHlwZU91dC5hcnJheVR5cGUob3V0Lmxlbmd0aCk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KHNoYXBlT3V0LCBvdXQuc2hhcGUpO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShkYXRhVHlwZU91dCwgb3V0LmRhdGFUeXBlKTtcclxuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdFx0XHR2YXIgZGF0YUEgPSBhLl9kYXRhLCBkYXRhQiA9IGIuX2RhdGEsIGRhdGFPdXQgPSBvdXQuX2RhdGEsIG4gPSBvdXQubGVuZ3RoO1xyXG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcblx0XHRcdFx0XHRkYXRhT3V0W2ldID0gZGF0YUFbaV0gLyBkYXRhQltpXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmFyIGRhdGFBID0gYS5fZGF0YSwgZGF0YU91dCA9IG91dC5fZGF0YSwgbiA9IG91dC5sZW5ndGg7XHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdFx0XHRcdGRhdGFPdXRbaV0gPSBkYXRhQVtpXSAvIGI7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR2YXIgZGF0YUIgPSBiLl9kYXRhLCBkYXRhT3V0ID0gb3V0Ll9kYXRhLCBuID0gb3V0Lmxlbmd0aDtcclxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdFx0XHRkYXRhT3V0W2ldID0gYSAvIGRhdGFCW2ldO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSBjYXRjaCAoZSkge1xyXG5cdFx0LyogUmVzdG9yZSB0aGUgcHJldmlvdXMgc3RhdGUgKi9cclxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRiLl9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0YS5fdHJ5SW52YWxpZGF0ZSgpO1xyXG5cdH1cclxuXHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGIuX3RyeUludmFsaWRhdGUoKTtcclxuXHR9XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcbkpTQ29udGV4dC5wcm90b3R5cGUubWluID0gZnVuY3Rpb24oaW5BcnJheSwgYXhpcykge1xyXG5cdGlmICh0eXBlb2YgYXhpcyA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0dmFyIG91dHB1dCA9IHRoaXMuZW1wdHkoW10sIGluQXJyYXkuZGF0YVR5cGUpO1xyXG5cclxuXHRcdC8qIENvbXB1dGF0aW9uIG9mIGFsbC1hcnJheSBtaW4gKi9cclxuXHRcdHZhciByZXN1bHQgPSBpbkFycmF5Ll9kYXRhWzBdO1xyXG5cdFx0Zm9yICh2YXIgaSA9IDE7IGkgPCBpbkFycmF5Lmxlbmd0aDsgKytpKSB7XHJcblx0XHRcdHJlc3VsdCA9IE1hdGgubWluKHJlc3VsdCwgaW5BcnJheS5fZGF0YVtpXSk7XHJcblx0XHR9XHJcblx0XHRvdXRwdXQuX2RhdGFbMF0gPSByZXN1bHQ7XHJcblxyXG5cdFx0cmV0dXJuIG91dHB1dDtcclxuXHR9IGVsc2UgaWYgKHV0aWwuaXNJbnQoYXhpcykpIHtcclxuXHRcdGF4aXMgPSB1dGlsLmNoZWNrQXhpcyhheGlzLCBpbkFycmF5LnNoYXBlLmxlbmd0aCk7XHJcblx0XHR2YXIgb3V0U2hhcGUgPSB1dGlsLmNvbXB1dGVBeGlzUmVkdWN0aW9uT3V0U2hhcGUoaW5BcnJheS5zaGFwZSwgYXhpcyk7XHJcblx0XHR2YXIgb3V0QXJyYXkgPSB0aGlzLmVtcHR5KG91dFNoYXBlLCBpbkFycmF5LmRhdGFUeXBlKTtcclxuXHJcblx0XHQvKiBDb21wdXRhdGlvbiBvZiBtaW4gYWxvbmcgYXhpcyAqL1xyXG5cdFx0dmFyIG91dGVyU3RyaWRlID0gdXRpbC5jb21wdXRlT3V0ZXJTdHJpZGUoaW5BcnJheS5zaGFwZSwgYXhpcyk7XHJcblx0XHR2YXIgaW5uZXJTdHJpZGUgPSB1dGlsLmNvbXB1dGVJbm5lclN0cmlkZShpbkFycmF5LnNoYXBlLCBheGlzKTtcclxuXHRcdHZhciByZWR1Y3Rpb25EaW0gPSBpbkFycmF5LnNoYXBlW2F4aXNdO1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBvdXRlclN0cmlkZTsgKytpKSB7XHJcblx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgaW5uZXJTdHJpZGU7ICsraykge1xyXG5cdFx0XHRcdHZhciBvZmZzZXQgPSBpICogcmVkdWN0aW9uRGltICogaW5uZXJTdHJpZGUgKyBrO1xyXG5cdFx0XHRcdHZhciBjdXJyZW50TWluID0gaW5BcnJheS5fZGF0YVtvZmZzZXRdO1xyXG5cdFx0XHRcdGZvciAodmFyIGogPSAxOyBqIDwgcmVkdWN0aW9uRGltOyArK2opIHtcclxuXHRcdFx0XHRcdG9mZnNldCArPSBpbm5lclN0cmlkZTtcclxuXHRcdFx0XHRcdGN1cnJlbnRNaW4gPSBNYXRoLm1pbihjdXJyZW50TWluLCBpbkFycmF5Ll9kYXRhW29mZnNldF0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRvdXRBcnJheS5fZGF0YVtpICogaW5uZXJTdHJpZGUgKyBrXSA9IGN1cnJlbnRNaW47XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gb3V0QXJyYXk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCBheGlzIHR5cGVcIik7XHJcblx0fVxyXG59O1xyXG5cclxuSlNDb250ZXh0LnByb3RvdHlwZS5tYXggPSBmdW5jdGlvbihpbkFycmF5LCBheGlzKSB7XHJcblx0aWYgKHR5cGVvZiBheGlzID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHR2YXIgb3V0cHV0ID0gdGhpcy5lbXB0eShbXSwgaW5BcnJheS5kYXRhVHlwZSk7XHJcblxyXG5cdFx0LyogQ29tcHV0YXRpb24gb2YgYWxsLWFycmF5IG1heCAqL1xyXG5cdFx0dmFyIHJlc3VsdCA9IGluQXJyYXkuX2RhdGFbMF07XHJcblx0XHRmb3IgKHZhciBpID0gMTsgaSA8IGluQXJyYXkubGVuZ3RoOyArK2kpIHtcclxuXHRcdFx0cmVzdWx0ID0gTWF0aC5tYXgocmVzdWx0LCBpbkFycmF5Ll9kYXRhW2ldKTtcclxuXHRcdH1cclxuXHRcdG91dHB1dC5fZGF0YVswXSA9IHJlc3VsdDtcclxuXHJcblx0XHRyZXR1cm4gb3V0cHV0O1xyXG5cdH0gZWxzZSBpZiAodXRpbC5pc0ludChheGlzKSkge1xyXG5cdFx0YXhpcyA9IHV0aWwuY2hlY2tBeGlzKGF4aXMsIGluQXJyYXkuc2hhcGUubGVuZ3RoKTtcclxuXHRcdHZhciBvdXRTaGFwZSA9IHV0aWwuY29tcHV0ZUF4aXNSZWR1Y3Rpb25PdXRTaGFwZShpbkFycmF5LnNoYXBlLCBheGlzKTtcclxuXHRcdHZhciBvdXRBcnJheSA9IHRoaXMuZW1wdHkob3V0U2hhcGUsIGluQXJyYXkuZGF0YVR5cGUpO1xyXG5cclxuXHRcdC8qIENvbXB1dGF0aW9uIG9mIG1heCBhbG9uZyBheGlzICovXHJcblx0XHR2YXIgb3V0ZXJTdHJpZGUgPSB1dGlsLmNvbXB1dGVPdXRlclN0cmlkZShpbkFycmF5LnNoYXBlLCBheGlzKTtcclxuXHRcdHZhciBpbm5lclN0cmlkZSA9IHV0aWwuY29tcHV0ZUlubmVyU3RyaWRlKGluQXJyYXkuc2hhcGUsIGF4aXMpO1xyXG5cdFx0dmFyIHJlZHVjdGlvbkRpbSA9IGluQXJyYXkuc2hhcGVbYXhpc107XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG91dGVyU3RyaWRlOyArK2kpIHtcclxuXHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCBpbm5lclN0cmlkZTsgKytrKSB7XHJcblx0XHRcdFx0dmFyIG9mZnNldCA9IGkgKiByZWR1Y3Rpb25EaW0gKiBpbm5lclN0cmlkZSArIGs7XHJcblx0XHRcdFx0dmFyIGN1cnJlbnRNYXggPSBpbkFycmF5Ll9kYXRhW29mZnNldF07XHJcblx0XHRcdFx0Zm9yICh2YXIgaiA9IDE7IGogPCByZWR1Y3Rpb25EaW07ICsraikge1xyXG5cdFx0XHRcdFx0b2Zmc2V0ICs9IGlubmVyU3RyaWRlO1xyXG5cdFx0XHRcdFx0Y3VycmVudE1heCA9IE1hdGgubWF4KGN1cnJlbnRNYXgsIGluQXJyYXkuX2RhdGFbb2Zmc2V0XSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdG91dEFycmF5Ll9kYXRhW2kgKiBpbm5lclN0cmlkZSArIGtdID0gY3VycmVudE1heDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBvdXRBcnJheTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIGF4aXMgdHlwZVwiKTtcclxuXHR9XHJcbn07XHJcblxyXG5KU0NvbnRleHQucHJvdG90eXBlLnN1bSA9IGZ1bmN0aW9uKGluQXJyYXksIGF4aXMpIHtcclxuXHRpZiAodHlwZW9mIGF4aXMgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdHZhciBvdXRwdXQgPSB0aGlzLmVtcHR5KFtdLCBpbkFycmF5LmRhdGFUeXBlKTtcclxuXHJcblx0XHQvKiBDb21wdXRhdGlvbiBvZiBhbGwtYXJyYXkgc3VtICovXHJcblx0XHR2YXIgcmVzdWx0ID0gaW5BcnJheS5fZGF0YVswXTtcclxuXHRcdGZvciAodmFyIGkgPSAxOyBpIDwgaW5BcnJheS5sZW5ndGg7ICsraSkge1xyXG5cdFx0XHRyZXN1bHQgKz0gaW5BcnJheS5fZGF0YVtpXTtcclxuXHRcdH1cclxuXHRcdG91dHB1dC5fZGF0YVswXSA9IHJlc3VsdDtcclxuXHJcblx0XHRyZXR1cm4gb3V0cHV0O1xyXG5cdH0gZWxzZSBpZiAodXRpbC5pc0ludChheGlzKSkge1xyXG5cdFx0YXhpcyA9IHV0aWwuY2hlY2tBeGlzKGF4aXMsIGluQXJyYXkuc2hhcGUubGVuZ3RoKTtcclxuXHRcdHZhciBvdXRTaGFwZSA9IHV0aWwuY29tcHV0ZUF4aXNSZWR1Y3Rpb25PdXRTaGFwZShpbkFycmF5LnNoYXBlLCBheGlzKTtcclxuXHRcdHZhciBvdXRBcnJheSA9IHRoaXMuZW1wdHkob3V0U2hhcGUsIGluQXJyYXkuZGF0YVR5cGUpO1xyXG5cclxuXHRcdC8qIENvbXB1dGF0aW9uIG9mIHN1bSBhbG9uZyBheGlzICovXHJcblx0XHR2YXIgb3V0ZXJTdHJpZGUgPSB1dGlsLmNvbXB1dGVPdXRlclN0cmlkZShpbkFycmF5LnNoYXBlLCBheGlzKTtcclxuXHRcdHZhciBpbm5lclN0cmlkZSA9IHV0aWwuY29tcHV0ZUlubmVyU3RyaWRlKGluQXJyYXkuc2hhcGUsIGF4aXMpO1xyXG5cdFx0dmFyIHJlZHVjdGlvbkRpbSA9IGluQXJyYXkuc2hhcGVbYXhpc107XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG91dGVyU3RyaWRlOyArK2kpIHtcclxuXHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCBpbm5lclN0cmlkZTsgKytrKSB7XHJcblx0XHRcdFx0dmFyIG9mZnNldCA9IGkgKiByZWR1Y3Rpb25EaW0gKiBpbm5lclN0cmlkZSArIGs7XHJcblx0XHRcdFx0dmFyIGN1cnJlbnRTdW0gPSBpbkFycmF5Ll9kYXRhW29mZnNldF07XHJcblx0XHRcdFx0Zm9yICh2YXIgaiA9IDE7IGogPCByZWR1Y3Rpb25EaW07ICsraikge1xyXG5cdFx0XHRcdFx0b2Zmc2V0ICs9IGlubmVyU3RyaWRlO1xyXG5cdFx0XHRcdFx0Y3VycmVudFN1bSArPSBpbkFycmF5Ll9kYXRhW29mZnNldF07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdG91dEFycmF5Ll9kYXRhW2kgKiBpbm5lclN0cmlkZSArIGtdID0gY3VycmVudFN1bTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBvdXRBcnJheTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIGF4aXMgdHlwZVwiKTtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogTmVnYXRlcyBhcnJheSBlbGVtZW50cy5cclxuICpcclxuICogQG1ldGhvZCBuZWdcclxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGFycmF5IG9mIGVsZW1lbnRzIHRvIGJlIG5lZ2F0ZWQuXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgZm9yIG5lZ2F0ZWQgZWxlbWVudHMuIElmIHN1cHBsaWVkLCBtdXN0IG1hdGNoIHRoZSBkaW1lbnNpb25zIGFuZCBkYXRhIHR5cGUgb2YgdGhlICoqYSoqIGFycmF5LlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5uZWcgPSBmdW5jdGlvbihhLCBvdXQpIHtcclxuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XHJcblx0YS5fZGVjUmVmKCk7XHJcblx0dHJ5IHtcclxuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRcdG91dCA9IG5ldyBOREFycmF5KGEuc2hhcGUsIGEuZGF0YVR5cGUsIHRoaXMpO1xyXG5cdFx0XHRpZiAoKGEgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYS5faGFzUmVmcygpKSB7XHJcblx0XHRcdFx0b3V0Ll9kYXRhID0gYS5fZGF0YTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRvdXQuX2RhdGEgPSBuZXcgYS5kYXRhVHlwZS5hcnJheVR5cGUob3V0Lmxlbmd0aCk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KGEuc2hhcGUsIG91dC5zaGFwZSk7XHJcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XHJcblx0XHRcdG91dC5faW5jUmVmKCk7XHJcblx0XHR9XHJcblx0XHR2YXIgZGF0YUEgPSBhLl9kYXRhLCBkYXRhT3V0ID0gb3V0Ll9kYXRhLCBuID0gYS5sZW5ndGg7XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG5cdFx0XHRkYXRhT3V0W2ldID0gLWRhdGFBW2ldO1xyXG5cdFx0fVxyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXHJcblx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGEuX3RyeUludmFsaWRhdGUoKTtcclxuXHRyZXR1cm4gb3V0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIGFic29sdXRlIHZhbHVlIG9mIGFycmF5IGVsZW1lbnRzLlxyXG4gKlxyXG4gKiBAbWV0aG9kIGFic1xyXG4gKiBAcGFyYW0ge05EQXJyYXl9IGEgLSB0aGUgYXJyYXkgb2YgaW5wdXQgZWxlbWVudHMuXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgZm9yIGNvbXB1dGVkIGFic29sdXRlIHZhbHVlcy4gSWYgc3VwcGxpZWQsIG11c3QgbWF0Y2ggdGhlIGRpbWVuc2lvbnMgYW5kIGRhdGEgdHlwZSBvZiB0aGUgKiphKiogYXJyYXkuXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLmFicyA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcclxuXHRhLl9kZWNSZWYoKTtcclxuXHR0cnkge1xyXG5cdFx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoYS5zaGFwZSwgYS5kYXRhVHlwZSwgdGhpcyk7XHJcblx0XHRcdGlmICgoYSBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFhLl9oYXNSZWZzKCkpIHtcclxuXHRcdFx0XHRvdXQuX2RhdGEgPSBhLl9kYXRhO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG91dC5fZGF0YSA9IG5ldyBhLmRhdGFUeXBlLmFycmF5VHlwZShvdXQubGVuZ3RoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcclxuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoYS5zaGFwZSwgb3V0LnNoYXBlKTtcclxuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcclxuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdHZhciBkYXRhQSA9IGEuX2RhdGEsIGRhdGFPdXQgPSBvdXQuX2RhdGEsIG4gPSBhLmxlbmd0aDtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcblx0XHRcdGRhdGFPdXRbaV0gPSBNYXRoLmFicyhkYXRhQVtpXSk7XHJcblx0XHR9XHJcblx0fSBjYXRjaCAoZSkge1xyXG5cdFx0LyogUmVzdG9yZSB0aGUgcHJldmlvdXMgc3RhdGUgKi9cclxuXHRcdGEuX2luY1JlZigpO1xyXG5cdFx0dGhyb3cgZTtcclxuXHR9XHJcblx0YS5fdHJ5SW52YWxpZGF0ZSgpO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG4vKipcclxuICogRXhwb25lbnRpYXRlcyBhcnJheSBlbGVtZW50cy5cclxuICpcclxuICogQG1ldGhvZCBleHBcclxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGFycmF5IG9mIGVsZW1lbnRzIHRvIGJlIGV4cG9uZW50aWF0ZWQuXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gW291dF0gLSB0aGUgYXJyYXkgZm9yIGV4cG9uZW50aWF0ZWQgZWxlbWVudHMuIElmIHN1cHBsaWVkLCBtdXN0IG1hdGNoIHRoZSBkaW1lbnNpb25zIGFuZCBkYXRhIHR5cGUgb2YgdGhlICoqYSoqIGFycmF5LlxyXG4gKi9cclxuSlNDb250ZXh0LnByb3RvdHlwZS5leHAgPSBmdW5jdGlvbihhLCBvdXQpIHtcclxuXHR1dGlsLmNoZWNrTkRBcnJheShhLCBcImFcIik7XHJcblx0YS5fZGVjUmVmKCk7XHJcblx0dHJ5IHtcclxuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRcdG91dCA9IG5ldyBOREFycmF5KGEuc2hhcGUsIGEuZGF0YVR5cGUsIHRoaXMpO1xyXG5cdFx0XHRpZiAoKGEgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYS5faGFzUmVmcygpKSB7XHJcblx0XHRcdFx0b3V0Ll9kYXRhID0gYS5fZGF0YTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRvdXQuX2RhdGEgPSBuZXcgYS5kYXRhVHlwZS5hcnJheVR5cGUob3V0Lmxlbmd0aCk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KGEuc2hhcGUsIG91dC5zaGFwZSk7XHJcblx0XHRcdHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIG91dC5kYXRhVHlwZSk7XHJcblx0XHRcdG91dC5faW5jUmVmKCk7XHJcblx0XHR9XHJcblx0XHR2YXIgZGF0YUEgPSBhLl9kYXRhLCBkYXRhT3V0ID0gb3V0Ll9kYXRhLCBuID0gYS5sZW5ndGg7XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG5cdFx0XHRkYXRhT3V0W2ldID0gTWF0aC5leHAoZGF0YUFbaV0pO1xyXG5cdFx0fVxyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXHJcblx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGEuX3RyeUludmFsaWRhdGUoKTtcclxuXHRyZXR1cm4gb3V0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIGxvZ2FyaXRobSBvZiBhcnJheSBlbGVtZW50cy5cclxuICpcclxuICogQG1ldGhvZCBsb2dcclxuICogQHBhcmFtIHtOREFycmF5fSBhIC0gdGhlIGFycmF5IG9mIGlucHV0IGVsZW1lbnRzLlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IGZvciBjb21wdXRlZCBsb2dhcml0aG0gdmFsdWVzLiBJZiBzdXBwbGllZCwgbXVzdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBhbmQgZGF0YSB0eXBlIG9mIHRoZSAqKmEqKiBhcnJheS5cclxuICovXHJcbkpTQ29udGV4dC5wcm90b3R5cGUubG9nID0gZnVuY3Rpb24oYSwgb3V0KSB7XHJcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xyXG5cdGEuX2RlY1JlZigpO1xyXG5cdHRyeSB7XHJcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShhLnNoYXBlLCBhLmRhdGFUeXBlLCB0aGlzKTtcclxuXHRcdFx0aWYgKChhIGluc3RhbmNlb2YgTkRBcnJheSkgJiYgIWEuX2hhc1JlZnMoKSkge1xyXG5cdFx0XHRcdG91dC5fZGF0YSA9IGEuX2RhdGE7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0b3V0Ll9kYXRhID0gbmV3IGEuZGF0YVR5cGUuYXJyYXlUeXBlKG91dC5sZW5ndGgpO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xyXG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBvdXQuc2hhcGUpO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xyXG5cdFx0XHRvdXQuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGRhdGFBID0gYS5fZGF0YSwgZGF0YU91dCA9IG91dC5fZGF0YSwgbiA9IGEubGVuZ3RoO1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdFx0ZGF0YU91dFtpXSA9IE1hdGgubG9nKGRhdGFBW2ldKTtcclxuXHRcdH1cclxuXHR9IGNhdGNoIChlKSB7XHJcblx0XHQvKiBSZXN0b3JlIHRoZSBwcmV2aW91cyBzdGF0ZSAqL1xyXG5cdFx0YS5faW5jUmVmKCk7XHJcblx0XHR0aHJvdyBlO1xyXG5cdH1cclxuXHRhLl90cnlJbnZhbGlkYXRlKCk7XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb21wdXRlcyBzcXVhcmUgcm9vdCBvZiBhcnJheSBlbGVtZW50cy5cclxuICpcclxuICogQG1ldGhvZCBzcXJ0XHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBpbnB1dCBlbGVtZW50cy5cclxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBhcnJheSBmb3IgY29tcHV0ZWQgc3F1YXJlIHJvb3QgdmFsdWVzLiBJZiBzdXBwbGllZCwgbXVzdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBhbmQgZGF0YSB0eXBlIG9mIHRoZSAqKmEqKiBhcnJheS5cclxuICovXHJcbkpTQ29udGV4dC5wcm90b3R5cGUuc3FydCA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcclxuXHRhLl9kZWNSZWYoKTtcclxuXHR0cnkge1xyXG5cdFx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0b3V0ID0gbmV3IE5EQXJyYXkoYS5zaGFwZSwgYS5kYXRhVHlwZSwgdGhpcyk7XHJcblx0XHRcdGlmICgoYSBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFhLl9oYXNSZWZzKCkpIHtcclxuXHRcdFx0XHRvdXQuX2RhdGEgPSBhLl9kYXRhO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG91dC5fZGF0YSA9IG5ldyBhLmRhdGFUeXBlLmFycmF5VHlwZShvdXQubGVuZ3RoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcclxuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoYS5zaGFwZSwgb3V0LnNoYXBlKTtcclxuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcclxuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdHZhciBkYXRhQSA9IGEuX2RhdGEsIGRhdGFPdXQgPSBvdXQuX2RhdGEsIG4gPSBhLmxlbmd0aDtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcblx0XHRcdGRhdGFPdXRbaV0gPSBNYXRoLnNxcnQoZGF0YUFbaV0pO1xyXG5cdFx0fVxyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXHJcblx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGEuX3RyeUludmFsaWRhdGUoKTtcclxuXHRyZXR1cm4gb3V0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNxdWFyZXMgYXJyYXkgZWxlbWVudHMuXHJcbiAqXHJcbiAqIEBtZXRob2Qgc3F1YXJlXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBhcnJheSBvZiBlbGVtZW50cyB0byBiZSBzcXVhcmVkLlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IFtvdXRdIC0gdGhlIGFycmF5IGZvciBzcXVhcmVkIGVsZW1lbnRzLiBJZiBzdXBwbGllZCwgbXVzdCBtYXRjaCB0aGUgZGltZW5zaW9ucyBhbmQgZGF0YSB0eXBlIG9mIHRoZSAqKmEqKiBhcnJheS5cclxuICovXHJcbkpTQ29udGV4dC5wcm90b3R5cGUuc3F1YXJlID0gZnVuY3Rpb24oYSwgb3V0KSB7XHJcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xyXG5cdGEuX2RlY1JlZigpO1xyXG5cdHRyeSB7XHJcblx0XHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRvdXQgPSBuZXcgTkRBcnJheShhLnNoYXBlLCBhLmRhdGFUeXBlLCB0aGlzKTtcclxuXHRcdFx0aWYgKChhIGluc3RhbmNlb2YgTkRBcnJheSkgJiYgIWEuX2hhc1JlZnMoKSkge1xyXG5cdFx0XHRcdG91dC5fZGF0YSA9IGEuX2RhdGE7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0b3V0Ll9kYXRhID0gbmV3IGEuZGF0YVR5cGUuYXJyYXlUeXBlKG91dC5sZW5ndGgpO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xyXG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBvdXQuc2hhcGUpO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBvdXQuZGF0YVR5cGUpO1xyXG5cdFx0XHRvdXQuX2luY1JlZigpO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGRhdGFBID0gYS5fZGF0YSwgZGF0YU91dCA9IG91dC5fZGF0YSwgbiA9IGEubGVuZ3RoO1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpIHtcclxuXHRcdFx0dmFyIHZhbHVlQSA9IGRhdGFBW2ldO1xyXG5cdFx0XHRkYXRhT3V0W2ldID0gdmFsdWVBICogdmFsdWVBO1xyXG5cdFx0fVxyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdC8qIFJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlICovXHJcblx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGEuX3RyeUludmFsaWRhdGUoKTtcclxuXHRyZXR1cm4gb3V0O1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIHRoZSBkb3QgcHJvZHVjdCBvZiB0d28gTi1kaW1lbnNpb25hbCBhcnJheXMuXHJcbiAqXHJcbiAqIEBtZXRob2QgZG90XHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gYSAtIHRoZSBmaXJzdCBpbnB1dCBhcnJheS5cclxuICogQHBhcmFtIHtOREFycmF5fSBiIC0gdGhlIHNlY29uZCBpbnB1dCBhcnJheS5cclxuICogQHBhcmFtIHtOREFycmF5fSBbb3V0XSAtIHRoZSBvdXRwdXQgYXJyYXkuIElmIHN1cHBsaWVkLCBtdXN0IG1hdGNoIHRoZSBkYXRhIHR5cGUgb2YgKiphKiogYW5kICoqYioqIGFycmF5cyBhbmQgaGF2ZSB0aGUgZXhwZWN0ZWQgc2hhcGUuXHJcbiAqIEByZXR1cm4ge05EQXJyYXl9IC0gdGhlIGFycmF5IHdpdGggdGhlIGRvdCBwcm9kdWN0IG9mICoqYSoqIGFuZCAqKmIqKi5cclxuICovXHJcbkpTQ29udGV4dC5wcm90b3R5cGUuZG90ID0gZnVuY3Rpb24oYSwgYiwgb3V0KSB7XHJcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xyXG5cdHV0aWwuY2hlY2tOREFycmF5KGIsIFwiYlwiKTtcclxuXHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShhLmRhdGFUeXBlLCBiLmRhdGFUeXBlKTtcclxuXHJcblx0LyogVGhlIGF4aXMgb2YgYiB1c2VkIGluIHJlZHVjdGlvbjogYXhpcyAwIGZvciAxRCBhcnJheSwgc2Vjb25kLXRvLWxhc3QgYXhpcyBmb3IgTkQgYXJyYXkgKi9cclxuXHR2YXIgYUF4aXMgPSBNYXRoLm1heChhLnNoYXBlLmxlbmd0aCAtIDEsIDApO1xyXG5cdHZhciBiQXhpcyA9IE1hdGgubWF4KGIuc2hhcGUubGVuZ3RoIC0gMiwgMCk7XHJcblx0dmFyIHJlZHVjdGlvbkxlbmd0aCA9IGEuc2hhcGVbYUF4aXNdO1xyXG5cdGlmIChyZWR1Y3Rpb25MZW5ndGggIT09IGIuc2hhcGVbYkF4aXNdKSB7XHJcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkFycmF5cyBoYXZlIGluY29tcGF0aWJsZSByZWR1Y3Rpb24gZGltZW5zaW9uc1wiKTtcclxuXHR9XHJcblx0dmFyIHNoYXBlT3V0ID0gW10sIHN0cmlkZUEgPSAxLCBvdXRlclN0cmlkZUIgPSAxLCBpbm5lclN0cmlkZUIgPSAxO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYUF4aXM7IGkrKykge1xyXG5cdFx0c2hhcGVPdXQucHVzaChhLnNoYXBlW2ldKTtcclxuXHRcdHN0cmlkZUEgKj0gYS5zaGFwZVtpXTtcclxuXHR9XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBiLnNoYXBlLmxlbmd0aDsgaSsrKSB7XHJcblx0XHR2YXIgZGltID0gYi5zaGFwZVtpXTtcclxuXHRcdGlmIChpIDwgYkF4aXMpIHtcclxuXHRcdFx0b3V0ZXJTdHJpZGVCICo9IGRpbTtcclxuXHRcdFx0c2hhcGVPdXQucHVzaChkaW0pO1xyXG5cdFx0fSBlbHNlIGlmIChpID4gYkF4aXMpIHtcclxuXHRcdFx0aW5uZXJTdHJpZGVCICo9IGRpbTtcclxuXHRcdFx0c2hhcGVPdXQucHVzaChkaW0pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0b3V0ID0gdGhpcy5lbXB0eShzaGFwZU91dCwgYS5kYXRhVHlwZSk7XHJcblx0fSBlbHNlIGlmIChvdXQgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHR1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xyXG5cdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkob3V0LnNoYXBlLCBzaGFwZU91dCk7XHJcblx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShvdXQuZGF0YVR5cGUsIGEuZGF0YVR5cGUpO1xyXG5cdH1cclxuXHR2YXIgZGF0YUEgPSBhLl9kYXRhLCBkYXRhQiA9IGIuX2RhdGEsIGRhdGFPdXQgPSBvdXQuX2RhdGE7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzdHJpZGVBOyBpKyspIHtcclxuXHRcdGZvciAodmFyIGogPSAwOyBqIDwgcmVkdWN0aW9uTGVuZ3RoOyBqKyspIHtcclxuXHRcdFx0Zm9yICh2YXIgayA9IDA7IGsgPCBvdXRlclN0cmlkZUI7IGsrKykge1xyXG5cdFx0XHRcdGZvciAodmFyIGwgPSAwOyBsIDwgaW5uZXJTdHJpZGVCOyBsKyspIHtcclxuXHRcdFx0XHRcdGRhdGFPdXRbKGkqb3V0ZXJTdHJpZGVCICsgaykgKiBpbm5lclN0cmlkZUIgKyBsXSArPSBkYXRhQVtpKnJlZHVjdGlvbkxlbmd0aCtqXSAqIGRhdGFCWyhrKnJlZHVjdGlvbkxlbmd0aCtqKSppbm5lclN0cmlkZUIrbF07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhbiBhcml0aG1ldGljIHNlcXVlbmNlLlxyXG4gKlxyXG4gKiBAbWV0aG9kIGxpbnNwYWNlXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBzdGFydCAtIHRoZSBzdGFydGluZyBlbmRwb2ludCBvZiB0aGUgc2VxdWVuY2UuIE11c3QgYmUgYSBmaW5pdGUgbnVtYmVyLlxyXG4gKiBAcGFyYW0ge051bWJlcn0gc3RvcCAtIHRoZSBmaW5hbCBlbmRwb2ludCBvZiB0aGUgc2VxdWVuY2UuIE11c3QgYmUgYSBmaW5pdGUgbnVtYmVyLlxyXG4gKiBAcGFyYW0ge051bWJlcn0gW3NhbXBsZXM9NTBdIC0gdGhlIG51bWJlciBvZiBzYW1wbGVzIGluIHRoZSBzZXF1ZW5jeS4gTXVzdCBiZSBhIHBvc2l0aXZlIGludGVnZXIuXHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW2luY2x1ZGVTdG9wPXRydWVdIC0gYW4gaW5kaWNhdG9yIG9mIHdoZXRoZXIgdGhlIGZpbmFsIGVuZHBvaW50IChgc3RvcGAgYXJndW1lbnQpIHNob3VsZCBiZSBpbmNsdWRlZCBpbiB0aGUgc2VxdWVuY2UuXHJcbiAqL1xyXG5KU0NvbnRleHQucHJvdG90eXBlLmxpbnNwYWNlID0gZnVuY3Rpb24oc3RhcnQsIHN0b3AsIHNhbXBsZXMsIGluY2x1ZGVTdG9wKSB7XHJcblx0aWYgKCF1dGlsLmlzUmVhbChzdGFydCkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3Ioc3RhcnQgKyBcIiBpcyBub3QgYSByZWFsIG51bWJlclwiKTtcclxuXHR9XHJcblx0aWYgKCF1dGlsLmlzUmVhbChzdG9wKSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzdG9wICsgXCIgaXMgbm90IGEgcmVhbCBudW1iZXJcIik7XHJcblx0fVxyXG5cdGlmICh0eXBlb2Ygc2FtcGxlcyA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0LyogRGVmYXVsdCB2YWx1ZSBpbiBOdW1QeSAqL1xyXG5cdFx0c2FtcGxlcyA9IDUwO1xyXG5cdH0gZWxzZSBpZiAoIXV0aWwuaXNJbnQoc2FtcGxlcykpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3Ioc2FtcGxlcyArIFwiIGlzIG5vdCBhbiBpbnRlZ2VyXCIpO1xyXG5cdH0gZWxzZSBpZiAoc2FtcGxlcyA8PSAwKSB7XHJcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBudW1iZXIgb2Ygc2FtcGxlcyBtdXN0IGJlIHBvc2l0aXZlXCIpO1xyXG5cdH1cclxuXHRpZiAodHlwZW9mIGluY2x1ZGVTdG9wID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRpbmNsdWRlU3RvcCA9IHRydWU7XHJcblx0fVxyXG5cdGlmIChpbmNsdWRlU3RvcCAmJiAoc2FtcGxlcyA9PT0gMSkpIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVGhlIG51bWJlciBvZiBzYW1wbGVzIG11c3QgYmUgYSBsZWFzdCAyIChmb3Igc3RhcnQgYW5kIGVuZCBwb2ludHMpXCIpO1xyXG5cdH1cclxuXHR2YXIgYXJyYXkgPSB0aGlzLmVtcHR5KHNhbXBsZXMsIG5ldyBEYXRhVHlwZShcImY2NFwiKSk7XHJcblx0dmFyIGRhdGEgPSBhcnJheS5fZGF0YTtcclxuXHR2YXIgcmFuZ2UgPSBzdG9wIC0gc3RhcnQ7XHJcblx0dmFyIG4gPSAoaW5jbHVkZVN0b3ApID8gc2FtcGxlcyAtIDEgOiBzYW1wbGVzO1xyXG5cdHZhciBzdGVwID0gcmFuZ2UgLyBuO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgc2FtcGxlczsgaSsrKSB7XHJcblx0XHRkYXRhW2ldID0gc3RhcnQgKyBzdGVwICogaTtcclxuXHR9XHJcblx0cmV0dXJuIGFycmF5O1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBKU0NvbnRleHQ7XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5cclxudmFyIHV0aWwgPSByZXF1aXJlKFwiLi91dGlsXCIpO1xyXG52YXIgRGF0YVR5cGUgPSByZXF1aXJlKFwiLi9EYXRhVHlwZVwiKTtcclxuXHJcbmZ1bmN0aW9uIHNoYXBlVG9MZW5ndGgoc2hhcGUpIHtcclxuXHR2YXIgbGVuZ3RoID0gMTtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IHNoYXBlLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRsZW5ndGggKj0gc2hhcGVbaV07XHJcblx0fVxyXG5cdHJldHVybiBsZW5ndGg7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHZhbGlkYXRlTXVsdGlJbmRleChpbmRleCwgc2hhcGUpIHtcclxuXHRpZiAoaW5kZXgubGVuZ3RoICE9IHNoYXBlLmxlbmd0aCkge1xyXG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJUaGUgbXVsdGktaW5kZXggXCIgKyBpbmRleCArIFwiIGRvZXMgbm90IG1hdGNoIHRoZSBkaW1lbnNpb25zIFwiICsgc2hhcGUgKyBcIiBvZiB0aGUgYXJyYXlcIik7XHJcblx0fVxyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgaW5kZXgubGVuZ3RoOyBpKyspIHtcclxuXHRcdGlmICghdXRpbC5pc0ludChpbmRleFtpXSkpIHtcclxuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoZSBzdWItaW5kZXggXCIgKyBpbmRleFtpXSArIFwiIGlzIG5vdCBhbiBpbnRlZ2VyXCIpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKChpbmRleFtpXSA8IDApIHx8IChpbmRleFtpXSA+PSBzaGFwZVtpXSkpIHtcclxuXHRcdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJUaGUgc3ViLWluZGV4IFwiICsgaW5kZXhbaV0gKyBcIiBpcyBvdXQgb2YgYm91bmRzXCIpO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEFuIG9wYXF1ZSBOLWRpbWVuc2lvbmFsIGFycmF5IG9iamVjdC5cclxuICpcclxuICogQGNsYXNzIE5EQXJyYXlcclxuICovXHJcblxyXG4vKipcclxuICogQ29uc3RydWN0cyBhbiBOREFycmF5IG9iamVjdCB3aXRob3V0IGRhdGEuXHJcbiAqIE5vcm1hbGx5IHRoaXMgY29uc3RydWN0b3IgaXMgY2FsbGVkIGZyb20gYXJyYXkgY29uc3RydWN0aW9uIG1ldGhvZHMgb2YgY29tcHV0YXRpb25hbCBjb250ZXh0cy5cclxuICogVGhlIGNhbGxpbmcgZnVuY3Rpb24gaXMgcmVzcG9uc2libGUgZm9yIGluaXRpYWxpemluZyB0aGUgZGF0YSBmb3IgdGhlIGFycmF5LlxyXG4gKlxyXG4gKiBAY29uc3RydWN0b3JcclxuICogQHByaXZhdGVcclxuICovXHJcbmZ1bmN0aW9uIE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCBjb250ZXh0KSB7XHJcblx0aWYgKHR5cGVvZiBjb250ZXh0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDb250ZXh0IG5vdCBkZWZpbmVkXCIpO1xyXG5cdH1cclxuXHRpZiAoIXV0aWwuaXNQb3NpdGl2ZUludEFycmF5KHNoYXBlKSAmJiAhdXRpbC5pc1Bvc2l0aXZlSW50KHNoYXBlKSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzaGFwZSArIFwiIGlzIG5vdCBhIHZhbGlkIGFycmF5IHNoYXBlXCIpO1xyXG5cdH1cclxuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRkYXRhVHlwZSA9IG5ldyBEYXRhVHlwZShcImY2NFwiKTtcclxuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoZGF0YVR5cGUgKyBcIiBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgRGF0YVR5cGVcIik7XHJcblx0fVxyXG5cdHRoaXMuc2hhcGUgPSB1dGlsLmFzSW50QXJyYXkoc2hhcGUpO1xyXG5cdHRoaXMuZGF0YVR5cGUgPSBkYXRhVHlwZTtcclxuXHR0aGlzLl9jb250ZXh0ID0gY29udGV4dDtcclxuXHR0aGlzLmxlbmd0aCA9IHNoYXBlVG9MZW5ndGgodGhpcy5zaGFwZSk7XHJcblx0dGhpcy5fbG9ja0NvdW50ID0gMDtcclxuXHR0aGlzLl9yZWZDb3VudCA9IDE7XHJcblx0dGhpcy5faXNWYWxpZCA9IHRydWU7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBMb2NrcyB0aGUgYXJyYXkgcmVmZXJlbmNlIGNvdW50ZXIuXHJcbiAqIFdoaWxlIHRoZSBhcnJheSBpcyBsb2NrZWQsIGZ1bmN0aW9ucyBhbmQgbWV0aG9kcyB0aGF0IG9wZXJhdGUgb24gdGhpcyBhcnJheSBkbyBub3QgZGVjcmVhc2UgaXRzIHJlZmVyZW5jZSBjb3VudC5cclxuICogVGhlIGFycmF5IGNhbiBiZSBsb2NrZWQgbXVsdGlwbGUgdGltZXMsIGFuZCB3b3VsZCBuZWVkIGp1c3QgYXMgbWFueSB1bmxvY2sgY2FsbHMgdG8gbGlmdCB0aGUgbG9jay5cclxuICogSWYgdGhlIGFycmF5IGlzIG5vdCB2YWxpZCwgdGhpcyBvcGVyYXRpb24gd2lsbCBmYWlsIHdpdGggYW4gZXJyb3IuXHJcbiAqXHJcbiAqIEBtZXRob2QgbG9ja1xyXG4gKiBAY2hhaW5hYmxlXHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS5sb2NrID0gZnVuY3Rpb24oKSB7XHJcblx0aWYgKCF0aGlzLmlzVmFsaWQoKSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXR0ZW1wdGVkIHRvIGxvY2sgYW4gaW52YWxpZGF0ZWQgYXJyYXlcIik7XHJcblx0fVxyXG5cdHRoaXMuX2xvY2tDb3VudCsrO1xyXG5cdHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFVubG9ja3MgdGhlIGFycmF5IHJlZmVyZW5jZSBjb3VudGVyLlxyXG4gKiBPbmNlIHRoZSBhcnJheSBpcyB1bmxvY2tlZCwgZnVuY3Rpb25zIGFuZCBtZXRob2RzIHRoYXQgb3BlcmF0ZSBvbiB0aGlzIGFycmF5IGRlY3JlYXNlIGl0cyByZWZlcmVuY2UgY291bnQgYW5kLCBpZiB0aGUgcmVmZXJlbmNlIGNvdW50IHJlYWNoZXMgemVybywgaW52YWxpZGF0ZSB0aGUgYXJyYXkuXHJcbiAqIElmIHRoZSBhcnJheSB3YXMgbG9ja2VkIG11bHRpcGxlIHRpbWVzLCBpdCB3b3VsZCBuZWVkIGp1c3QgYXMgbWFueSB1bmxvY2sgY2FsbHMgdG8gbGlmdCB0aGUgbG9jay5cclxuICogSWYgdGhlIGFycmF5IGlzIG5vdCBsb2NrZWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxyXG4gKlxyXG4gKiBAbWV0aG9kIHVubG9ja1xyXG4gKiBAY2hhaW5hYmxlXHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS51bmxvY2sgPSBmdW5jdGlvbigpIHtcclxuXHRpZiAoIXRoaXMuaXNMb2NrZWQoKSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXR0ZW1wdGVkIHRvIGxvY2sgYSB1bmxvY2tlZCBhcnJheVwiKTtcclxuXHR9XHJcblx0dGhpcy5fbG9ja0NvdW50LS07XHJcblx0cmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogQ2hlY2tlcyBpZiB0aGUgYXJyYXkgaXMgaW4gdGhlIGxvY2tlZCBzdGF0ZS5cclxuICogSWYgdGhlIGFycmF5IGlzIG5vdCB2YWxpZCwgdGhpcyBtZXRob2QgcmV0dXJuIGZhbHNlLlxyXG4gKlxyXG4gKiBAbWV0aG9kIGlzTG9ja2VkXHJcbiAqXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gdHJ1ZSBpcyB0aGUgYXJyYXkgaXMgbG9ja2VkIGFuZCBmYWxzZSBvdGhlcndpc2VcclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLmlzTG9ja2VkID0gZnVuY3Rpb24oKSB7XHJcblx0cmV0dXJuIHRoaXMuX2xvY2tDb3VudCA+IDA7XHJcbn07XHJcblxyXG4vKipcclxuICogSW5jcmVtZW50cyB0aGUgYXJyYXkgcmVmZXJlbmNlIGNvdW50LlxyXG4gKiBJZiB0aGUgYXJyYXkgaXMgaW52YWxpZCBvciBsb2NrZWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxyXG4gKlxyXG4gKiBAbWV0aG9kIHJldGFpblxyXG4gKiBAY2hhaW5hYmxlXHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS5yZXRhaW4gPSBmdW5jdGlvbigpIHtcclxuXHRpZiAoIXRoaXMuaXNWYWxpZCgpKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdHRlbXB0ZWQgdG8gcmVsZWFzZSBhbiBpbnZhbGlkYXRlZCBhcnJheVwiKTtcclxuXHR9XHJcblx0aWYgKHRoaXMuaXNMb2NrZWQoKSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXR0ZW1wdGVkIHRvIHJldGFpbiBhIGxvY2tlZCBhcnJheVwiKTtcclxuXHR9XHJcblx0dGhpcy5fcmVmQ291bnQrKztcclxuXHRyZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBEZWNyZW1lbnRzIHRoZSBhcnJheSByZWZlcmVuY2UgY291bnQuIElmIHRoZSByZWZlcmVuY2UgY291bnQgYWNoaWV2ZXMgemVybywgdGhlIGFycmF5IGJlY29tZXMgaW52YWxpZCBhbmQgaXRzIGRhdGEgYnVmZmVyIGlzIGRlYWxsb2NhdGVkLlxyXG4gKiBJZiB0aGUgYXJyYXkgaXMgaW52YWxpZCBvciBsb2NrZWQsIHRoaXMgb3BlcmF0aW9uIHdpbGwgZmFpbCB3aXRoIGFuIGVycm9yLlxyXG4gKlxyXG4gKiBAbWV0aG9kIHJlbGVhc2VcclxuICogQGNoYWluYWJsZVxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUucmVsZWFzZSA9IGZ1bmN0aW9uKCkge1xyXG5cdGlmICghdGhpcy5pc1ZhbGlkKCkpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihcIkF0dGVtcHRlZCB0byByZWxlYXNlIGFuIGludmFsaWRhdGVkIGFycmF5XCIpO1xyXG5cdH1cclxuXHRpZiAodGhpcy5pc0xvY2tlZCgpKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJBdHRlbXB0ZWQgdG8gcmVsZWFzZSBhIGxvY2tlZCBhcnJheVwiKTtcclxuXHR9XHJcblx0aWYgKC0tdGhpcy5fcmVmQ291bnQgPT09IDApIHtcclxuXHRcdHRoaXMuX2NvbnRleHQuaW52YWxpZGF0ZSh0aGlzKTtcclxuXHR9XHJcblx0cmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogSW52YWxpZGF0ZXMgdGhlIGFycmF5IGFuZCBkZWFsbG9jYXRlcyBpdHMgZGF0YSBidWZmZXIsIHJlZ2FyZGxlc3Mgb2YgbG9ja3MgYW5kIHJlZmVyZW5jZSBjb3VudC5cclxuICogQ2FsbGluZyB0aGlzIG1ldGhvZCBvbiBhbiBpbnZhbGlkYXRlZCBhcnJheSBoYXMgbm8gZWZmZWN0LlxyXG4gKlxyXG4gKiBAbWV0aG9kIGludmFsaWRhdGVcclxuICogQGNoYWluYWJsZVxyXG4gKi9cclxuTkRBcnJheS5wcm90b3R5cGUuaW52YWxpZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cdGlmICh0aGlzLmlzVmFsaWQoKSkge1xyXG5cdFx0dGhpcy5fY29udGV4dC5faW52YWxpZGF0ZSh0aGlzKTtcclxuXHRcdHRoaXMuX2lzVmFsaWQgPSBmYWxzZTtcclxuXHRcdHRoaXMuX3JlZkNvdW50ID0gMDtcclxuXHRcdHRoaXMuX2xvY2tDb3VudCA9IDA7XHJcblx0fVxyXG5cdHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENoZWNrZXMgaWYgdGhlIGFycmF5IGlzIGluIGEgdmFsaWQgc3RhdGUuXHJcbiAqIElmIHRoZSBhcnJheSBpcyBub3QgaW4gYSB2YWxpZCBzdGF0ZSwgaXRzIGRhdGEgYnVmZmVyIHdhcyBkZWFsbG9jYXRlZCwgYW5kIGFueSBvcGVyYXRpb25zIG9uIHRoZSBhcnJheSB3aWxsIHRocm93IGFuIGVycm9yLlxyXG4gKlxyXG4gKiBAbWV0aG9kIGlzVmFsaWRcclxuICpcclxuICogQHJldHVybiB7Qm9vbGVhbn0gLSB0cnVlIGlzIHRoZSBhcnJheSBpcyB2YWxpZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlXHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS5pc1ZhbGlkID0gZnVuY3Rpb24oKSB7XHJcblx0cmV0dXJuIHRoaXMuX2lzVmFsaWQ7XHJcbn07XHJcblxyXG4vKipcclxuICogRGVjcmVtZW50cyB0aGUgYXJyYXkgcmVmZXJlbmNlIGNvdW50IGlmIHRoZSBhcnJheSBpcyBub3QgbG9ja2VkLlxyXG4gKiBUaGlzIGZ1bmN0aW9uIGRvZXMgbm90IGludmFsaWRhdGUgdGhlIGFycmF5IHdoZW4gdGhlIHJlZmVyZW5jZSBjb3VudCByZWFjaCB6ZXJvLlxyXG4gKiBUaGUgY2FsbGVyIGlzIHJlc3BvbnNpYmxlIGZvciBpbnZhbGlkYXRpbmcgYXJyYXkgaWYgaXRzIHJlZmVyZW5jZSBjb3VudCBpcyB6ZXJvIGFmdGVyIHRoZSBvcGVyYXRpb24uXHJcbiAqXHJcbiAqIEZvciBhIGxvY2tlZCBhcnJheSB0aGUgbWV0aG9kIGhhcyBubyBlZmZlY3QgYW5kIGFsd2F5cyByZXR1cm5zIHRydWUuXHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBtZXRob2QgX2RlY1JlZlxyXG4gKiBAcGFyYW0ge05EQXJyYXl9IGFycmF5IC0gdGhlIGFycmF5IHRvIGRlY3JlbWVudCB0aGUgcmVmZXJlbmNlIGNvdW50IGZvci4gTXVzdCBiZSB2YWxpZCBiZWZvcmUgdGhlIGNhbGwuXHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gdHJ1ZSBpZiB0aGUgcmVmZXJlbmNlIGNvdW50IGlzIG5vbi16ZXJvIGFmdGVyIHRoZSBvcGVyYXRpb24gYW5kIGZhbHNlIG90aGVyd2lzZS5cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLl9kZWNSZWYgPSBmdW5jdGlvbihhcnJheSkge1xyXG5cdGlmICh0aGlzLl9sb2NrQ291bnQgPT09IDApIHtcclxuXHRcdC0tdGhpcy5fcmVmQ291bnQ7XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIEluY3JlbWVudHMgdGhlIGFycmF5IHJlZmVyZW5jZSBjb3VudCBpZiB0aGUgYXJyYXkgaXMgbm90IGxvY2tlZC5cclxuICogRm9yIGEgbG9ja2VkIGFycmF5IHRoZSBtZXRob2QgaGFzIG5vIGVmZmVjdC5cclxuICpcclxuICogQHByaXZhdGVcclxuICogQG1ldGhvZCBfaW5jUmVmXHJcbiAqIEBjaGFpbmFibGVcclxuICogQHBhcmFtIHtOREFycmF5fSBhcnJheSAtIHRoZSBhcnJheSB0byBpbmNyZW1lbnQgdGhlIHJlZmVyZW5jZSBjb3VudCBmb3IuIE11c3QgYmUgdmFsaWQgYmVmb3JlIHRoZSBjYWxsLCBidXQgbWF5IGhhdmUgemVybyByZWZlcmVuY2UgY291bnQuXHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS5faW5jUmVmID0gZnVuY3Rpb24oYXJyYXkpIHtcclxuXHRpZiAodGhpcy5fbG9ja0NvdW50ID09PSAwKSB7XHJcblx0XHQrK3RoaXMuX3JlZkNvdW50O1xyXG5cdH1cclxuXHRyZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGVja3MgaWYgdGhlIGFycmF5IGlzIGxvY2tlZCBvciBoYXMgYW55IHJlZmVyZW5jZXMuXHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBtZXRob2QgX2hhc1JlZnNcclxuICogQHBhcmFtIHtOREFycmF5fSBhcnJheSAtIHRoZSBhcnJheSB0byBjaGVjay4gTXVzdCBiZSB2YWxpZCBiZWZvcmUgdGhlIGNhbGwsIGJ1dCBtYXkgaGF2ZSB6ZXJvIHJlZmVyZW5jZSBjb3VudC5cclxuICogQHJldHVybiB7Qm9vbGVhbn0gLSB0cnVlIGlmIHRoZSBhcnJheSBpcyBsb2NrZWQgb3IgaGFzIHJlZmVyZW5jZXMgYW5kIGZhbHNlIG90aGVyd2lzZS5cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLl9oYXNSZWZzID0gZnVuY3Rpb24oYXJyYXkpIHtcclxuXHRyZXR1cm4gKHRoaXMuX2xvY2tDb3VudCAhPT0gMCkgfHwgKHRoaXMuX3JlZkNvdW50ICE9PSAwKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBJbnZhbGlkYXRlcyB0aGUgYXJyYXkgaWYgaXQgdmFsaWQsIG5vdCBsb2NrZWQsIGFuZCBoYXMgemVybyByZWZlcmVuY2UgY291bnQuXHJcbiAqIEhhcyBubyBlZmZlY3QgaW4gYWxsIG90aGVyIGNhc2VzLlxyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAbWV0aG9kIF90cnlJbnZhbGlkYXRlXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXkgLSB0aGUgYXJyYXkgdG8gdHJ5IHRvIGludmFsaWRhdGUuIENhbiBiZSBpbnZhbGlkLlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaWYgdGhlIGFycmF5IHdhcyBpbnZhbGlkYXRlZCBieSB0aGlzIGNhbGwgYW5kIGZhbHNlIG90aGVyd2lzZS5cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLl90cnlJbnZhbGlkYXRlID0gZnVuY3Rpb24oYXJyYXkpIHtcclxuXHRpZiAodGhpcy5pc1ZhbGlkKCkgJiYgIXRoaXMuX2hhc1JlZnMoKSkge1xyXG5cdFx0dGhpcy5fY29udGV4dC5faW52YWxpZGF0ZSh0aGlzKTtcclxuXHRcdHRoaXMuX2lzVmFsaWQgPSBmYWxzZTtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIEFkZHMgYW5vdGhlciBhcnJheSBvciBhIG51bWJlciB0byB0aGlzIGFycmF5LlxyXG4gKlxyXG4gKiBAbWV0aG9kIGFkZFxyXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IG90aGVyIC0gdGhlIGFycmF5IG9yIHNjYWxhciB0byBiZSBhZGRlZC5cclxuICogQHJldHVybiB7TkRBcnJheX1cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKG90aGVyKSB7XHJcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQuYWRkKHRoaXMsIG90aGVyKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBTdWJ0cmFjdHMgYW5vdGhlciBhcnJheSBvciBhIG51bWJlciBmcm9tIHRoaXMgYXJyYXkuXHJcbiAqXHJcbiAqIEBtZXRob2Qgc3ViXHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gb3RoZXIgLSB0aGUgYXJyYXkgb3Igc2NhbGFyIHRvIGJlIHN1YnRyYWN0ZWQuXHJcbiAqIEByZXR1cm4ge05EQXJyYXl9XHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS5zdWIgPSBmdW5jdGlvbihvdGhlcikge1xyXG5cdHJldHVybiB0aGlzLl9jb250ZXh0LnN1Yih0aGlzLCBvdGhlcik7XHJcbn07XHJcblxyXG4vKipcclxuICogTXVsdGlwbGllcyBhcnJheSBlbGVtZW50cyBieSBhbm90aGVyIGFycmF5IG9yIGJ5IGEgbnVtYmVyLlxyXG4gKlxyXG4gKiBAbWV0aG9kIG11bFxyXG4gKiBAcGFyYW0geyhOREFycmF5fE51bWJlcil9IG90aGVyIC0gdGhlIGFycmF5IG9yIHNjYWxhciB0byBtdWx0aXBseSBlbGVtZW50cyBieS5cclxuICogQHJldHVybiB7TkRBcnJheX1cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLm11bCA9IGZ1bmN0aW9uKG90aGVyKSB7XHJcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQubXVsKHRoaXMsIG90aGVyKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBEaXZpZGVzIGFycmF5IGVsZW1lbnRzIGJ5IGFub3RoZXIgYXJyYXkgb3IgYnkgYSBudW1iZXIuXHJcbiAqXHJcbiAqIEBtZXRob2QgZGl2XHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gb3RoZXIgLSB0aGUgYXJyYXkgb3Igc2NhbGFyIHRvIGRpdmlkZSBlbGVtZW50cyBieS5cclxuICogQHJldHVybiB7TkRBcnJheX1cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLmRpdiA9IGZ1bmN0aW9uKG90aGVyKSB7XHJcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQuZGl2KHRoaXMsIG90aGVyKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZWR1Y2VzIGFycmF5IGVsZW1lbnRzIHVzaW5nIG1pbmltdW0gb3BlcmF0aW9uLlxyXG4gKiBJZiB0aGUgYXhpcyBhcmd1bWVudCBpcyBwcm92aWRlZCwgdGhlIG1ldGhvZCBjb21wdXRlcyBtaW5pbXVtIG9mIGVsZW1lbnRzIGFsb25nIHRoZSBzcGVjaWZpZWQgYXhpcy5cclxuICogT3RoZXJ3aXNlLCB0aGUgbWV0aG9kIGNvbXB1dGVzIGFuIGFsbC1hcnJheSBtaW5pbXVtIG9mIHRoZSBlbGVtZW50cyBhbmQgcmV0dXJucyB0aGVtIGFzIGEgMS1lbGVtZW50IGFycmF5LlxyXG4gKlxyXG4gKiBAbWV0aG9kIG1pblxyXG4gKiBAcGFyYW0ge051bWJlcn0gW2F4aXNdIC0gdGhlIGF4aXMgYWxvbmcgd2hpY2ggdGhlIG1pbmltdW0gaXMgY29tcHV0ZWQuXHJcbiAqIEByZXR1cm4ge05EQXJyYXl9XHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS5taW4gPSBmdW5jdGlvbihheGlzKSB7XHJcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQubWluKHRoaXMsIGF4aXMpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlZHVjZXMgYXJyYXkgZWxlbWVudHMgdXNpbmcgbWF4aW11bSBvcGVyYXRpb24uXHJcbiAqIElmIHRoZSBheGlzIGFyZ3VtZW50IGlzIHByb3ZpZGVkLCB0aGUgbWV0aG9kIGNvbXB1dGVzIG1heGltdW0gb2YgZWxlbWVudHMgYWxvbmcgdGhlIHNwZWNpZmllZCBheGlzLlxyXG4gKiBPdGhlcndpc2UsIHRoZSBtZXRob2QgY29tcHV0ZXMgYW4gYWxsLWFycmF5IG1heGltdW0gb2YgdGhlIGVsZW1lbnRzIGFuZCByZXR1cm5zIHRoZW0gYXMgYSAxLWVsZW1lbnQgYXJyYXkuXHJcbiAqXHJcbiAqIEBtZXRob2QgbWluXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBbYXhpc10gLSB0aGUgYXhpcyBhbG9uZyB3aGljaCB0aGUgbWF4aW11bSBpcyBjb21wdXRlZC5cclxuICogQHJldHVybiB7TkRBcnJheX1cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLm1heCA9IGZ1bmN0aW9uKGF4aXMpIHtcclxuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5tYXgodGhpcywgYXhpcyk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmVkdWNlcyBhcnJheSBlbGVtZW50cyB1c2luZyBzdW0gb3BlcmF0aW9uLlxyXG4gKiBJZiB0aGUgYXhpcyBhcmd1bWVudCBpcyBwcm92aWRlZCwgdGhlIG1ldGhvZCBjb21wdXRlcyBzdW0gb2YgZWxlbWVudHMgYWxvbmcgdGhlIHNwZWNpZmllZCBheGlzLlxyXG4gKiBPdGhlcndpc2UsIHRoZSBtZXRob2QgY29tcHV0ZXMgYW4gYWxsLWFycmF5IHN1bSBvZiB0aGUgZWxlbWVudHMgYW5kIHJldHVybnMgdGhlbSBhcyBhIDEtZWxlbWVudCBhcnJheS5cclxuICpcclxuICogQG1ldGhvZCBtaW5cclxuICogQHBhcmFtIHtOdW1iZXJ9IFtheGlzXSAtIHRoZSBheGlzIGFsb25nIHdoaWNoIHRoZSBzdW0gaXMgY29tcHV0ZWQuXHJcbiAqIEByZXR1cm4ge05EQXJyYXl9XHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS5zdW0gPSBmdW5jdGlvbihheGlzKSB7XHJcblx0cmV0dXJuIHRoaXMuX2NvbnRleHQuc3VtKHRoaXMsIGF4aXMpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYW5vdGhlciBhcnJheSB3aXRoIHRoZSBzYW1lIGRhdGEsIGJ1dCBkaWZmZXJlbnQgZGltZW5zaW9ucy5cclxuICpcclxuICogQG1ldGhvZCByZXNoYXBlXHJcbiAqIEBwYXJhbSB7KE5EQXJyYXl8TnVtYmVyKX0gb3RoZXIgLSBkaW1lbnNpb25zIG9mIHRoZSBuZXcgYXJyYXkuXHJcbiAqIEByZXR1cm4ge05EQXJyYXl9XHJcbiAqL1xyXG5OREFycmF5LnByb3RvdHlwZS5yZXNoYXBlID0gZnVuY3Rpb24obmV3U2hhcGUpIHtcclxuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5yZXNoYXBlKHRoaXMsIG5ld1NoYXBlKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBEdXBsaWNhdGVzIGFycmF5IGVsZW1lbnRzIGFsb25nIHRoZSBzcGVjaWZpZWQgYXhpcy5cclxuICpcclxuICogQG1ldGhvZCByZXBlYXRcclxuICogQHBhcmFtIHtOdW1iZXJ9IHJlcGVhdHMgLSB0aGUgbnVtYmVyIG9mIHRpbWVzIHRvIHJlcGVhdCBlYWNoIGVsZW1lbnQuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgYWxvbmcgd2hpY2ggdGhlIGVsZW1lbnRzIHdpbGwgYmUgZHVwbGljYXRlZC5cclxuICogQHJldHVybiB7TkRBcnJheX1cclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLnJlcGVhdCA9IGZ1bmN0aW9uKHJlcGVhdHMsIGF4aXMpIHtcclxuXHRyZXR1cm4gdGhpcy5fY29udGV4dC5yZXBlYXQodGhpcywgcmVwZWF0cywgYXhpcyk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ29udmVydHMgdGhlIGRhdGEgdG8gYSBKYXZhU2NyaXB0IEFycmF5LlxyXG4gKlxyXG4gKiBAbWV0aG9kIGdldFxyXG4gKiBAYXN5bmNcclxuICovXHJcbk5EQXJyYXkucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcblx0dGhpcy5fY29udGV4dC5nZXQodGhpcywgY2FsbGJhY2spO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBOREFycmF5O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBOREFycmF5ID0gcmVxdWlyZShcIi4vTkRBcnJheVwiKTtcclxudmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XHJcbnZhciBhbGxvY2F0b3IgPSByZXF1aXJlKFwiLi9hbGxvY2F0b3JcIik7XHJcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbFwiKTtcclxuXHJcbnZhciBzY3JpcHREaXJlY3RvcnkgPSBcIlwiO1xyXG50cnkge1xyXG5cdHZhciBzY3JpcHRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJzY3JpcHRcIik7XHJcblx0Zm9yICh2YXIgaSA9IHNjcmlwdHMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcclxuXHRcdHZhciBwYXRoID0gc2NyaXB0c1tpXS5zcmM7XHJcblx0XHQvKiBSZW1vdmUgdXJsLWVuY29kZWQgcGFyYW1ldGVycyAqL1xyXG5cdFx0cGF0aCA9IHBhdGguc3BsaXQoXCI/XCIpWzBdO1xyXG5cdFx0dmFyIHNlcGFyYXRvclBvcyA9IHBhdGgubGFzdEluZGV4T2YoXCIvXCIpO1xyXG5cdFx0dmFyIHNjcmlwdE5hbWUgPSBwYXRoLnN1YnN0cmluZyhzZXBhcmF0b3JQb3MgKyAxKTtcclxuXHRcdGlmICgoc2NyaXB0TmFtZSA9PT0gXCJmdXJpb3VzLmpzXCIpIHx8IChzY3JpcHROYW1lID09PSBcImZ1cmlvdXMubWluLmpzXCIpKXtcclxuXHRcdFx0c2NyaXB0RGlyZWN0b3J5ID0gcGF0aC5zdWJzdHJpbmcoMCwgc2VwYXJhdG9yUG9zICsgMSk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdH1cclxufSBjYXRjaCAoZSkge1xyXG59XHJcblxyXG52YXIgc2hhcGVUb0xlbmd0aCA9IGZ1bmN0aW9uKHNoYXBlKSB7XHJcblx0dmFyIGxlbmd0aCA9IDE7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzaGFwZS5sZW5ndGg7IGkrKykge1xyXG5cdFx0bGVuZ3RoICo9IHNoYXBlW2ldO1xyXG5cdH1cclxuXHRyZXR1cm4gbGVuZ3RoO1xyXG59O1xyXG5cclxudmFyIGlzQ29tcGF0aWJsZVNoYXBlID0gZnVuY3Rpb24oc2hhcGUxLCBzaGFwZTIpIHtcclxuXHRpZiAoc2hhcGUxLmxlbmd0aCAhPT0gc2hhcGUyLmxlbmd0aCkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IHNoYXBlMS5sZW5ndGg7IGkrKykge1xyXG5cdFx0aWYgKHNoYXBlMVtpXSAhPT0gc2hhcGUyW2ldKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIHRydWU7XHJcbn07XHJcblxyXG52YXIgbWVzc2FnZUNhbGxiYWNrcyA9IHt9O1xyXG5cclxudmFyIG9uUE5hQ2xNZXNzYWdlID0gZnVuY3Rpb24obWVzc2FnZSkge1xyXG5cdHZhciByZXN1bHQgPSBtZXNzYWdlLmRhdGE7XHJcblx0dmFyIGlkID0gcmVzdWx0LmlkO1xyXG5cdGlmIChyZXN1bHQuc3RhdHVzID09IFwiZXJyb3JcIikge1xyXG5cdFx0Y29uc29sZS5sb2coXCJFcnJvcjogXCIgKyByZXN1bHQuZGVzY3JpcHRpb24pO1xyXG5cdH1cclxuXHRpZiAoaWQgaW4gbWVzc2FnZUNhbGxiYWNrcykge1xyXG5cdFx0aWYgKFwiYnVmZmVyXCIgaW4gcmVzdWx0KSB7XHJcblx0XHRcdG1lc3NhZ2VDYWxsYmFja3NbaWRdKHJlc3VsdC5idWZmZXIpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bWVzc2FnZUNhbGxiYWNrc1tpZF0oKTtcclxuXHRcdH1cclxuXHRcdGRlbGV0ZSBtZXNzYWdlQ2FsbGJhY2tzW2lkXTtcclxuXHR9XHJcbn07XHJcblxyXG5mdW5jdGlvbiBQTmFDbENvbnRleHQoY2FsbGJhY2spIHtcclxuXHR2YXIgY29udGV4dCA9IHRoaXM7XHJcblx0dGhpcy5fcG5hY2xPYmplY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwib2JqZWN0XCIpO1xyXG5cdHRoaXMuX3BuYWNsT2JqZWN0LndpZHRoID0gMDtcclxuXHR0aGlzLl9wbmFjbE9iamVjdC5oZWlnaHQgPSAwO1xyXG5cdHRoaXMuX3BuYWNsT2JqZWN0LmRhdGEgPSBzY3JpcHREaXJlY3RvcnkgKyBcImZ1cmlvdXMubm1mXCI7XHJcblx0dGhpcy5fcG5hY2xPYmplY3QudHlwZSA9IFwiYXBwbGljYXRpb24veC1wbmFjbFwiO1xyXG5cdHRoaXMuX3BuYWNsT2JqZWN0LmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsIGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBtZXNzYWdlSWQgPSBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCk7XHJcblx0XHRtZXNzYWdlQ2FsbGJhY2tzW21lc3NhZ2VJZF0gPSBmdW5jdGlvbigpIHtcclxuXHRcdFx0Y2FsbGJhY2soY29udGV4dCk7XHJcblx0XHR9O1xyXG5cdFx0Y29udGV4dC5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xyXG5cdFx0XHRcImlkXCI6IG1lc3NhZ2VJZCxcclxuXHRcdFx0XCJjb21tYW5kXCI6IFwiaW5pdFwiXHJcblx0XHR9KTtcclxuXHR9LCB0cnVlKTtcclxuXHR0aGlzLl9wbmFjbE9iamVjdC5hZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBvblBOYUNsTWVzc2FnZSwgdHJ1ZSk7XHJcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLl9wbmFjbE9iamVjdCk7XHJcbn1cclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUuZW1wdHkgPSBmdW5jdGlvbihzaGFwZSwgZGF0YVR5cGUpIHtcclxuXHRzaGFwZSA9IHV0aWwuY2hlY2tTaGFwZShzaGFwZSk7XHJcblx0aWYgKHR5cGVvZiBkYXRhVHlwZSA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0ZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XHJcblx0fSBlbHNlIGlmICghKGRhdGFUeXBlIGluc3RhbmNlb2YgRGF0YVR5cGUpKSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGRhdGFUeXBlICsgXCIgaXMgbm90IGFuIGluc3RhbmNlIG9mIERhdGFUeXBlXCIpO1xyXG5cdH1cclxuXHR2YXIgYXJyYXkgPSBuZXcgTkRBcnJheShzaGFwZSwgZGF0YVR5cGUsIHRoaXMpO1xyXG5cdGFycmF5Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XHJcblx0dGhpcy5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xyXG5cdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXHJcblx0XHRcImNvbW1hbmRcIjogXCJlbXB0eVwiLFxyXG5cdFx0XCJzaGFwZVwiOiBuZXcgVWludDMyQXJyYXkoc2hhcGUpLmJ1ZmZlcixcclxuXHRcdFwiZGF0YXR5cGVcIjogZGF0YVR5cGUudHlwZSxcclxuXHRcdFwib3V0XCI6IGFycmF5Ll9pZFxyXG5cdH0pO1xyXG5cdHJldHVybiBhcnJheTtcclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUuYXJyYXkgPSBmdW5jdGlvbihkYXRhLCBkYXRhVHlwZSkge1xyXG5cdHZhciBzaGFwZSA9IFtdO1xyXG5cdHV0aWwuZGlzY292ZXJBcnJheVNoYXBlUmVjdXJzaXZlKGRhdGEsIHNoYXBlLCAwKTtcclxuXHRpZiAodHlwZW9mIGRhdGFUeXBlID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRkYXRhVHlwZSA9IG5ldyBEYXRhVHlwZShcImY2NFwiKTtcclxuXHR9IGVsc2UgaWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoZGF0YVR5cGUgKyBcIiBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgRGF0YVR5cGVcIik7XHJcblx0fVxyXG5cdHZhciBuZGFycmF5ID0gbmV3IE5EQXJyYXkoc2hhcGUsIGRhdGFUeXBlLCB0aGlzKTtcclxuXHRuZGFycmF5Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XHJcblx0dmFyIGJ1ZmZlciA9IG5ldyBkYXRhVHlwZS5hcnJheVR5cGUobmRhcnJheS5sZW5ndGgpO1xyXG5cdHV0aWwuY29weUFycmF5RGF0YVJlY3Vyc2l2ZShidWZmZXIsIGRhdGEsIHNoYXBlLCAwLCAwKTtcclxuXHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFwiY29tbWFuZFwiOiBcImFycmF5XCIsXHJcblx0XHRcInNoYXBlXCI6IG5ldyBVaW50MzJBcnJheShzaGFwZSkuYnVmZmVyLFxyXG5cdFx0XCJkYXRhdHlwZVwiOiBkYXRhVHlwZS50eXBlLFxyXG5cdFx0XCJidWZmZXJcIjogYnVmZmVyLmJ1ZmZlcixcclxuXHRcdFwib3V0XCI6IG5kYXJyYXkuX2lkXHJcblx0fSk7XHJcblx0cmV0dXJuIG5kYXJyYXk7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmxpbnNwYWNlID0gZnVuY3Rpb24oc3RhcnQsIHN0b3AsIHNhbXBsZXMsIGluY2x1ZGVTdG9wKSB7XHJcblx0aWYgKCF1dGlsLmlzUmVhbChzdGFydCkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3Ioc3RhcnQgKyBcIiBpcyBub3QgYSByZWFsIG51bWJlclwiKTtcclxuXHR9XHJcblx0aWYgKCF1dGlsLmlzUmVhbChzdG9wKSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihzdG9wICsgXCIgaXMgbm90IGEgcmVhbCBudW1iZXJcIik7XHJcblx0fVxyXG5cdGlmICh0eXBlb2Ygc2FtcGxlcyA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0LyogRGVmYXVsdCB2YWx1ZSBpbiBOdW1QeSAqL1xyXG5cdFx0c2FtcGxlcyA9IDUwO1xyXG5cdH0gZWxzZSBpZiAoIXV0aWwuaXNJbnQoc2FtcGxlcykpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3Ioc2FtcGxlcyArIFwiIGlzIG5vdCBhbiBpbnRlZ2VyXCIpO1xyXG5cdH0gZWxzZSBpZiAoc2FtcGxlcyA8PSAwKSB7XHJcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBudW1iZXIgb2Ygc2FtcGxlcyBtdXN0IGJlIHBvc2l0aXZlXCIpO1xyXG5cdH1cclxuXHRpZiAodHlwZW9mIGluY2x1ZGVTdG9wID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRpbmNsdWRlU3RvcCA9IHRydWU7XHJcblx0fVxyXG5cdGlmIChpbmNsdWRlU3RvcCAmJiAoc2FtcGxlcyA9PT0gMSkpIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiVGhlIG51bWJlciBvZiBzYW1wbGVzIG11c3QgYmUgYSBsZWFzdCAyIChmb3Igc3RhcnQgYW5kIGVuZCBwb2ludHMpXCIpO1xyXG5cdH1cclxuXHR2YXIgZGF0YVR5cGUgPSBuZXcgRGF0YVR5cGUoXCJmNjRcIik7XHJcblx0dmFyIGFycmF5ID0gbmV3IE5EQXJyYXkoW3NhbXBsZXNdLCBkYXRhVHlwZSwgdGhpcyk7XHJcblx0YXJyYXkuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcclxuXHR0aGlzLl9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFwiY29tbWFuZFwiOiBcImxpbnNwYWNlXCIsXHJcblx0XHRcInN0YXJ0XCI6ICtzdGFydCxcclxuXHRcdFwic3RvcFwiOiArc3RvcCxcclxuXHRcdFwic2FtcGxlc1wiOiBzYW1wbGVzfDAsXHJcblx0XHRcImNsb3NlZFwiOiAhIWluY2x1ZGVTdG9wLFxyXG5cdFx0XCJkYXRhdHlwZVwiOiBkYXRhVHlwZS50eXBlLFxyXG5cdFx0XCJvdXRcIjogYXJyYXkuX2lkXHJcblx0fSk7XHJcblx0cmV0dXJuIGFycmF5O1xyXG59O1xyXG5cclxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5yZXNoYXBlID0gZnVuY3Rpb24oYXJyYXksIHNoYXBlKSB7XHJcblx0aWYgKCF1dGlsLmlzUG9zaXRpdmVJbnRBcnJheShzaGFwZSkgJiYgIXV0aWwuaXNQb3NpdGl2ZUludChzaGFwZSkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3Ioc2hhcGUgKyBcIiBpcyBub3QgYSB2YWxpZCBhcnJheSBzaGFwZVwiKTtcclxuXHR9XHJcblx0aWYgKHNoYXBlVG9MZW5ndGgoc2hhcGUpICE9PSBhcnJheS5sZW5ndGgpIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKHNoYXBlICsgXCIgaXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgYXJyYXlcIik7XHJcblx0fVxyXG5cdHZhciBvdXRwdXQgPSBuZXcgTkRBcnJheShzaGFwZSwgYXJyYXkuZGF0YVR5cGUsIHRoaXMpO1xyXG5cdG91dHB1dC5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xyXG5cdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFwiaWRcIjogYWxsb2NhdG9yLm5ld01lc3NhZ2VJZCgpLFxyXG5cdFx0XCJjb21tYW5kXCI6IFwicmVzaGFwZVwiLFxyXG5cdFx0XCJhXCI6IGFycmF5Ll9pZCxcclxuXHRcdFwib3V0XCI6IG91dHB1dC5faWQsXHJcblx0XHRcInNoYXBlXCI6IG5ldyBVaW50MzJBcnJheShzaGFwZSkuYnVmZmVyXHJcblx0fSk7XHJcblx0cmV0dXJuIG91dHB1dDtcclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUucmVwZWF0ID0gZnVuY3Rpb24oYSwgcmVwZWF0cywgYXhpcywgb3V0KSB7XHJcblx0dXRpbC5jaGVja05EQXJyYXkoYSwgXCJhXCIpO1xyXG5cdHJlcGVhdHMgPSB1dGlsLmNoZWNrUmVwZWF0cyhyZXBlYXRzKTtcclxuXHRheGlzID0gdXRpbC5jaGVja0F4aXMoYXhpcywgYS5zaGFwZS5sZW5ndGgpO1xyXG5cdHZhciBzaGFwZUEgPSBhLnNoYXBlO1xyXG5cdHZhciBzaGFwZU91dCA9IHNoYXBlQS5zbGljZSgwKTtcclxuXHRzaGFwZU91dFtheGlzXSAqPSByZXBlYXRzO1xyXG5cdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRvdXQgPSBuZXcgTkRBcnJheShzaGFwZU91dCwgYS5kYXRhVHlwZSwgdGhpcyk7XHJcblx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcclxuXHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KG91dC5zaGFwZSwgc2hhcGVPdXQpO1xyXG5cdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcclxuXHR9XHJcblx0dGhpcy5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xyXG5cdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXHJcblx0XHRcImNvbW1hbmRcIjogXCJyZXBlYXRcIixcclxuXHRcdFwiYVwiOiBhLl9pZCxcclxuXHRcdFwib3V0XCI6IG91dC5faWQsXHJcblx0XHRcInJlcGVhdHNcIjogcmVwZWF0cyxcclxuXHRcdFwiYXhpc1wiOiBheGlzXHJcblx0fSk7XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUuX2ludmFsaWRhdGUgPSBmdW5jdGlvbihhcnJheSkge1xyXG5cdGlmIChhcnJheS5faWQgIT09IDApIHtcclxuXHRcdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXHJcblx0XHRcdFwiY29tbWFuZFwiOiBcInJlbGVhc2VcIixcclxuXHRcdFx0XCJpblwiOiBhcnJheS5faWRcclxuXHRcdH0pO1xyXG5cdH1cclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oKSB7XHJcblx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIGFyZ3VtZW50IG1pc3NpbmdcIik7XHJcblx0fVxyXG5cdHZhciBjYWxsYmFjayA9IGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV07XHJcblx0LyogVmFsaWRhdGUgYXJndW1lbnRzICovXHJcblx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihcIkF0IGxlYXN0IG9uZSBOREFycmF5IGFyZ3VtZW50IGV4cGVjdGVkXCIpO1xyXG5cdH1cclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAxOyBpKyspIHtcclxuXHRcdGlmICghKGFyZ3VtZW50c1tpXSBpbnN0YW5jZW9mIE5EQXJyYXkpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJBcmd1bWVudCBcIiArIGkgKyBcIiBpcyBub3QgYW4gTkRBcnJheVwiKTtcclxuXHRcdH1cclxuXHR9XHJcblx0dmFyIGNhbGxiYWNrV2FpdEFyZ3VtZW50cyA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xyXG5cdHZhciBjYWxsYmFja0FyZ3VtZW50cyA9IG5ldyBBcnJheShjYWxsYmFja1dhaXRBcmd1bWVudHMpO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tXYWl0QXJndW1lbnRzOyBpKyspIHtcclxuXHRcdHZhciBhcnJheSA9IGFyZ3VtZW50c1tpXTtcclxuXHRcdHZhciBtZXNzYWdlSWQgPSBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCk7XHJcblx0XHRpZiAoYXJyYXkuc2hhcGUubGVuZ3RoID09PSAwKSB7XHJcblx0XHRcdG1lc3NhZ2VDYWxsYmFja3NbbWVzc2FnZUlkXSA9IChmdW5jdGlvbihpKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKGJ1ZmZlcikge1xyXG5cdFx0XHRcdFx0dmFyIHR5cGVkQXJyYXkgPSBuZXcgYXJyYXkuZGF0YVR5cGUuYXJyYXlUeXBlKGJ1ZmZlcik7XHJcblx0XHRcdFx0XHRjYWxsYmFja0FyZ3VtZW50c1tpXSA9IHR5cGVkQXJyYXlbMF07XHJcblx0XHRcdFx0XHRpZiAoLS1jYWxsYmFja1dhaXRBcmd1bWVudHMgPT09IDApIHtcclxuXHRcdFx0XHRcdFx0Y2FsbGJhY2suYXBwbHkobnVsbCwgY2FsbGJhY2tBcmd1bWVudHMpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH07XHJcblx0XHRcdH0pKGkpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bWVzc2FnZUNhbGxiYWNrc1ttZXNzYWdlSWRdID0gKGZ1bmN0aW9uKGkpIHtcclxuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oYnVmZmVyKSB7XHJcblx0XHRcdFx0XHR2YXIganNhcnJheSA9IG5ldyBBcnJheShhcnJheS5zaGFwZVswXSk7XHJcblx0XHRcdFx0XHR1dGlsLmNyZWF0ZUFycmF5UmVjdXJzaXZlKG5ldyBhcnJheS5kYXRhVHlwZS5hcnJheVR5cGUoYnVmZmVyKSwganNhcnJheSwgYXJyYXkuc2hhcGUsIDAsIDApO1xyXG5cdFx0XHRcdFx0Y2FsbGJhY2tBcmd1bWVudHNbaV0gPSBqc2FycmF5O1xyXG5cdFx0XHRcdFx0aWYgKC0tY2FsbGJhY2tXYWl0QXJndW1lbnRzID09PSAwKSB7XHJcblx0XHRcdFx0XHRcdGNhbGxiYWNrLmFwcGx5KG51bGwsIGNhbGxiYWNrQXJndW1lbnRzKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9O1xyXG5cdFx0XHR9KShpKTtcclxuXHRcdH1cclxuXHRcdHRoaXMuX3BuYWNsT2JqZWN0LnBvc3RNZXNzYWdlKHtcclxuXHRcdFx0XCJpZFwiOiBtZXNzYWdlSWQsXHJcblx0XHRcdFwiY29tbWFuZFwiOiBcImdldFwiLFxyXG5cdFx0XHRcImluXCI6IGFycmF5Ll9pZFxyXG5cdFx0fSk7XHJcblx0fVxyXG59O1xyXG5cclxudmFyIGJpbmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBiLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xyXG5cdHZhciBzaGFwZU91dCA9IG51bGwsIGRhdGFUeXBlT3V0ID0gbnVsbCwgaWRBID0gMCwgaWRCID0gMDtcclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGlkQSA9IGEuX2lkO1xyXG5cdFx0c2hhcGVPdXQgPSBhLnNoYXBlO1xyXG5cdFx0ZGF0YVR5cGVPdXQgPSBhLmRhdGFUeXBlO1xyXG5cdFx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRcdGlkQiA9IGIuX2lkO1xyXG5cdFx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBiLnNoYXBlKTtcclxuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgYi5kYXRhVHlwZSk7XHJcblx0XHR9IGVsc2UgaWYgKCF1dGlsLmlzTnVtYmVyKGIpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGJcIik7XHJcblx0XHR9XHJcblx0fSBlbHNlIGlmICh1dGlsLmlzTnVtYmVyKGEpKSB7XHJcblx0XHRpZEIgPSBiLl9pZDtcclxuXHRcdHNoYXBlT3V0ID0gYi5zaGFwZTtcclxuXHRcdGRhdGFUeXBlT3V0ID0gYi5kYXRhVHlwZTtcclxuXHRcdHV0aWwuY2hlY2tOREFycmF5KGIsIFwiYlwiKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYVwiKTtcclxuXHR9XHJcblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRhLl9kZWNSZWYoKTtcclxuXHR9XHJcblx0aWYgKGIgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRiLl9kZWNSZWYoKTtcclxuXHR9XHJcblx0dHJ5IHtcclxuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRcdG91dCA9IG5ldyBOREFycmF5KHNoYXBlT3V0LCBkYXRhVHlwZU91dCwgY29udGV4dCk7XHJcblx0XHRcdGlmICgoYSBpbnN0YW5jZW9mIE5EQXJyYXkpICYmICFhLl9oYXNSZWZzKCkpIHtcclxuXHRcdFx0XHRvdXQuX2lkID0gYS5faWQ7XHJcblx0XHRcdFx0YS5faWQgPSAwO1xyXG5cdFx0XHR9IGVsc2UgaWYgKChiIGluc3RhbmNlb2YgTkRBcnJheSkgJiYgIWIuX2hhc1JlZnMoKSkge1xyXG5cdFx0XHRcdG91dC5faWQgPSBiLl9pZDtcclxuXHRcdFx0XHRiLl9pZCA9IDA7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0b3V0Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHV0aWwuY2hlY2tOREFycmF5KG91dCwgXCJvdXRcIik7XHJcblx0XHRcdHV0aWwuY2hlY2tTaGFwZXNDb21wYXRpYmlsaXR5KHNoYXBlT3V0LCBvdXQuc2hhcGUpO1xyXG5cdFx0XHR1dGlsLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eShkYXRhVHlwZU91dCwgb3V0LmRhdGFUeXBlKTtcclxuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdFx0XHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcdFx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFx0XHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24sXHJcblx0XHRcdFx0XHRcImFcIjogaWRBLFxyXG5cdFx0XHRcdFx0XCJiXCI6IGlkQixcclxuXHRcdFx0XHRcdFwib3V0XCI6IG91dC5faWRcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcdFx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFx0XHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24gKyBcImNcIixcclxuXHRcdFx0XHRcdFwiYVwiOiBpZEEsXHJcblx0XHRcdFx0XHRcImJcIjogYixcclxuXHRcdFx0XHRcdFwib3V0XCI6IG91dC5faWRcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aWYgKChvcGVyYXRpb24gPT0gXCJhZGRcIikgfHwgKG9wZXJhdGlvbiA9PSBcIm11bFwiKSkge1xyXG5cdFx0XHRcdC8qIENvbW11dGF0aXZlIG9wZXJhdGlvbjogZmxpcCB0aGUgb3BlcmFuZHMgKi9cclxuXHRcdFx0XHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcdFx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFx0XHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24gKyBcImNcIixcclxuXHRcdFx0XHRcdFwiYVwiOiBpZEIsXHJcblx0XHRcdFx0XHRcImJcIjogYSxcclxuXHRcdFx0XHRcdFwib3V0XCI6IG91dC5faWRcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcdFx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFx0XHRcdFwiY29tbWFuZFwiOiBcInJcIiArIG9wZXJhdGlvbiArIFwiY1wiLFxyXG5cdFx0XHRcdFx0XCJhXCI6IGlkQSxcclxuXHRcdFx0XHRcdFwiYlwiOiBiLFxyXG5cdFx0XHRcdFx0XCJvdXRcIjogb3V0Ll9pZFxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSBjYXRjaCAoZSkge1xyXG5cdFx0LyogUmVzdG9yZSB0aGUgcHJldmlvdXMgc3RhdGUgKi9cclxuXHRcdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRhLl9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRiLl9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHRcdHRocm93IGU7XHJcblx0fVxyXG5cdGlmIChhIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0YS5fdHJ5SW52YWxpZGF0ZSgpO1xyXG5cdH1cclxuXHRpZiAoYiBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGIuX3RyeUludmFsaWRhdGUoKTtcclxuXHR9XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcbnZhciB1bmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xyXG5cdHV0aWwuY2hlY2tOREFycmF5KGEsIFwiYVwiKTtcclxuXHR2YXIgaWRBID0gYS5faWQ7XHJcblx0YS5fZGVjUmVmKCk7XHJcblx0dHJ5IHtcclxuXHRcdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRcdG91dCA9IG5ldyBOREFycmF5KGEuc2hhcGUsIGEuZGF0YVR5cGUsIGNvbnRleHQpO1xyXG5cdFx0XHRpZiAoKGEgaW5zdGFuY2VvZiBOREFycmF5KSAmJiAhYS5faGFzUmVmcygpKSB7XHJcblx0XHRcdFx0b3V0Ll9pZCA9IGEuX2lkO1xyXG5cdFx0XHRcdGEuX2lkID0gMDtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRvdXQuX2lkID0gYWxsb2NhdG9yLm5ld0FycmF5SWQoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dXRpbC5jaGVja05EQXJyYXkob3V0LCBcIm91dFwiKTtcclxuXHRcdFx0dXRpbC5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkoYS5zaGFwZSwgb3V0LnNoYXBlKTtcclxuXHRcdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoYS5kYXRhVHlwZSwgb3V0LmRhdGFUeXBlKTtcclxuXHRcdFx0b3V0Ll9pbmNSZWYoKTtcclxuXHRcdH1cclxuXHR9IGNhdGNoIChlKSB7XHJcblx0XHQvKiBSZXN0b3JlIHRoZSBwcmV2aW91cyBzdGF0ZSAqL1xyXG5cdFx0YS5faW5jUmVmKCk7XHJcblx0XHR0aHJvdyBlO1xyXG5cdH1cclxuXHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24sXHJcblx0XHRcImFcIjogaWRBLFxyXG5cdFx0XCJvdXRcIjogb3V0Ll9pZFxyXG5cdH0pO1xyXG5cdGEuX3RyeUludmFsaWRhdGUoKTtcclxuXHRyZXR1cm4gb3V0O1xyXG59O1xyXG5cclxudmFyIHJlZHVjZUFyaXRoT3AgPSBmdW5jdGlvbihhLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xyXG5cdHZhciBkYXRhVHlwZSA9IG51bGw7XHJcblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRkYXRhVHlwZSA9IGEuZGF0YVR5cGU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGFcIik7XHJcblx0fVxyXG5cdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRvdXQgPSBuZXcgTkRBcnJheShbXSwgZGF0YVR5cGUsIGNvbnRleHQpO1xyXG5cdFx0b3V0Ll9pZCA9IGFsbG9jYXRvci5uZXdBcnJheUlkKCk7XHJcblx0fSBlbHNlIGlmIChvdXQgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHR1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShvdXQuc2hhcGUsIFtdKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIm91dCBpcyBub3QgYW4gTkRBcnJheVwiKTtcclxuXHR9XHJcblx0Y29udGV4dC5fcG5hY2xPYmplY3QucG9zdE1lc3NhZ2Uoe1xyXG5cdFx0XCJpZFwiOiBhbGxvY2F0b3IubmV3TWVzc2FnZUlkKCksXHJcblx0XHRcImNvbW1hbmRcIjogb3BlcmF0aW9uLFxyXG5cdFx0XCJhXCI6IGEuX2lkLFxyXG5cdFx0XCJvdXRcIjogb3V0Ll9pZFxyXG5cdH0pO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG52YXIgYXhpc1JlZHVjZUFyaXRoT3AgPSBmdW5jdGlvbihhLCBheGlzLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xyXG5cdHZhciBkYXRhVHlwZSA9IG51bGw7XHJcblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRkYXRhVHlwZSA9IGEuZGF0YVR5cGU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGFcIik7XHJcblx0fVxyXG5cdHV0aWwuY2hlY2tBeGlzKGF4aXMpO1xyXG5cdGlmICh0eXBlb2Ygb3V0ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRvdXQgPSBuZXcgTkRBcnJheSh1dGlsLmNvbXB1dGVBeGlzUmVkdWN0aW9uT3V0U2hhcGUoYS5zaGFwZSwgYXhpcyksIGRhdGFUeXBlLCBjb250ZXh0KTtcclxuXHRcdG91dC5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xyXG5cdH0gZWxzZSBpZiAob3V0IGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0dXRpbC5jaGVja0F4aXNSZWR1Y3Rpb25PdXRTaGFwZShhLnNoYXBlLCBvdXQuc2hhcGUsIGF4aXMpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwib3V0IGlzIG5vdCBhbiBOREFycmF5XCIpO1xyXG5cdH1cclxuXHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFwiY29tbWFuZFwiOiBvcGVyYXRpb24sXHJcblx0XHRcImFcIjogYS5faWQsXHJcblx0XHRcImF4aXNcIjogYXhpc3wwLFxyXG5cdFx0XCJvdXRcIjogb3V0Ll9pZFxyXG5cdH0pO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG52YXIgZG90QXJpdGhPcCA9IGZ1bmN0aW9uKGEsIGIsIG91dCwgY29udGV4dCkge1xyXG5cdHZhciBkYXRhVHlwZSA9IG51bGw7XHJcblx0aWYgKGEgaW5zdGFuY2VvZiBOREFycmF5KSB7XHJcblx0XHRkYXRhVHlwZSA9IGEuZGF0YVR5cGU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCB0eXBlIG9mIGFcIik7XHJcblx0fVxyXG5cdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0dXRpbC5jaGVja0RhdGFUeXBlc0NvbXBhdGliaWxpdHkoZGF0YVR5cGUsIGIuZGF0YVR5cGUpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiVW5zdXBwb3J0ZWQgdHlwZSBvZiBiXCIpO1xyXG5cdH1cclxuXHRpZiAodHlwZW9mIG91dCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0dmFyIHNoYXBlQSA9IGEuc2hhcGU7XHJcblx0XHR2YXIgc2hhcGVCID0gYi5zaGFwZTtcclxuXHRcdHZhciBheGlzQSA9IE1hdGgubWF4KHNoYXBlQS5sZW5ndGggLSAxLCAwKTtcclxuXHRcdHZhciBheGlzQiA9IE1hdGgubWF4KHNoYXBlQi5sZW5ndGggLSAyLCAwKTtcclxuXHRcdGlmIChzaGFwZUFbYXhpc0FdICE9IHNoYXBlQltheGlzQl0pIHtcclxuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIk1pc21hdGNoIGluIHJlZHVjdGlvbiBkaW1lbnNpb25zXCIpO1xyXG5cdFx0fVxyXG5cdFx0dmFyIHNoYXBlT3V0ID0gW107XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGF4aXNBOyBpKyspIHtcclxuXHRcdFx0c2hhcGVPdXQucHVzaChzaGFwZUFbaV0pO1xyXG5cdFx0fVxyXG5cdFx0aWYgKHNoYXBlQi5sZW5ndGggPiAxKSB7XHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXhpc0I7IGkrKykge1xyXG5cdFx0XHRcdHNoYXBlT3V0LnB1c2goc2hhcGVCW2ldKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRzaGFwZU91dC5wdXNoKHNoYXBlQltzaGFwZUIubGVuZ3RoIC0gMV0pO1xyXG5cdFx0fVxyXG5cdFx0b3V0ID0gbmV3IE5EQXJyYXkoc2hhcGVPdXQsIGRhdGFUeXBlLCBjb250ZXh0KTtcclxuXHRcdG91dC5faWQgPSBhbGxvY2F0b3IubmV3QXJyYXlJZCgpO1xyXG5cdH0gZWxzZSBpZiAob3V0IGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwib3V0IGlzIG5vdCBhbiBOREFycmF5XCIpO1xyXG5cdH1cclxuXHRjb250ZXh0Ll9wbmFjbE9iamVjdC5wb3N0TWVzc2FnZSh7XHJcblx0XHRcImlkXCI6IGFsbG9jYXRvci5uZXdNZXNzYWdlSWQoKSxcclxuXHRcdFwiY29tbWFuZFwiOiBcImRvdFwiLFxyXG5cdFx0XCJhXCI6IGEuX2lkLFxyXG5cdFx0XCJiXCI6IGIuX2lkLFxyXG5cdFx0XCJvdXRcIjogb3V0Ll9pZFxyXG5cdH0pO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJhZGRcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLnN1YiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJzdWJcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLm11bCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJtdWxcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmRpdiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJkaXZcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLm5lZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcIm5lZ1wiKTtcclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUuYWJzID0gZnVuY3Rpb24oYSwgb3V0KSB7XHJcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwiYWJzXCIpO1xyXG59O1xyXG5cclxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5leHAgPSBmdW5jdGlvbihhLCBvdXQpIHtcclxuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywgXCJleHBcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLmxvZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcImxvZ1wiKTtcclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUuc3FydCA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcInNxcnRcIik7XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLnNxdWFyZSA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcInNxdWFyZVwiKTtcclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUubWluID0gZnVuY3Rpb24oYSwgYXhpcykge1xyXG5cdGlmICh0eXBlb2YgYXhpcyA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0cmV0dXJuIHJlZHVjZUFyaXRoT3AoYSwgdW5kZWZpbmVkLCB0aGlzLCBcIm1pblwiKTtcclxuXHR9IGVsc2UgaWYgKHV0aWwuaXNJbnQoYXhpcykpIHtcclxuXHRcdHJldHVybiBheGlzUmVkdWNlQXJpdGhPcChhLCBheGlzLCB1bmRlZmluZWQsIHRoaXMsIFwiYW1pblwiKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIGF4aXMgdHlwZVwiKTtcclxuXHR9XHJcbn07XHJcblxyXG5QTmFDbENvbnRleHQucHJvdG90eXBlLm1heCA9IGZ1bmN0aW9uKGEsIGF4aXMpIHtcclxuXHRpZiAodHlwZW9mIGF4aXMgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdHJldHVybiByZWR1Y2VBcml0aE9wKGEsIHVuZGVmaW5lZCwgdGhpcywgXCJtYXhcIik7XHJcblx0fSBlbHNlIGlmICh1dGlsLmlzSW50KGF4aXMpKSB7XHJcblx0XHRyZXR1cm4gYXhpc1JlZHVjZUFyaXRoT3AoYSwgYXhpcywgdW5kZWZpbmVkLCB0aGlzLCBcImFtYXhcIik7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJVbnN1cHBvcnRlZCBheGlzIHR5cGVcIik7XHJcblx0fVxyXG59O1xyXG5cclxuUE5hQ2xDb250ZXh0LnByb3RvdHlwZS5zdW0gPSBmdW5jdGlvbihhLCBheGlzKSB7XHJcblx0aWYgKHR5cGVvZiBheGlzID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRyZXR1cm4gcmVkdWNlQXJpdGhPcChhLCB1bmRlZmluZWQsIHRoaXMsIFwic3VtXCIpO1xyXG5cdH0gZWxzZSBpZiAodXRpbC5pc0ludChheGlzKSkge1xyXG5cdFx0cmV0dXJuIGF4aXNSZWR1Y2VBcml0aE9wKGEsIGF4aXMsIHVuZGVmaW5lZCwgdGhpcywgXCJhc3VtXCIpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwiVW5zdXBwb3J0ZWQgYXhpcyB0eXBlXCIpO1xyXG5cdH1cclxufTtcclxuXHJcblBOYUNsQ29udGV4dC5wcm90b3R5cGUuZG90ID0gZnVuY3Rpb24oYSwgYiwgb3V0KSB7XHJcblx0cmV0dXJuIGRvdEFyaXRoT3AoYSwgYiwgb3V0LCB0aGlzKTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUE5hQ2xDb250ZXh0O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBOREFycmF5ID0gcmVxdWlyZShcIi4vTkRBcnJheVwiKTtcclxudmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XHJcbnZhciB1dGlsID0gcmVxdWlyZShcIi4vdXRpbFwiKTtcclxudmFyIHNvdXJjZSA9IHJlcXVpcmUoXCIuL1dlYkNMS2VybmVscy5qc1wiKTtcclxuXHJcbnZhciBzaGFwZVRvTGVuZ3RoID0gZnVuY3Rpb24oc2hhcGUpIHtcclxuXHR2YXIgbGVuZ3RoID0gMTtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IHNoYXBlLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRsZW5ndGggKj0gc2hhcGVbaV07XHJcblx0fVxyXG5cdHJldHVybiBsZW5ndGg7XHJcbn07XHJcblxyXG52YXIgaXNDb21wYXRpYmxlU2hhcGUgPSBmdW5jdGlvbihzaGFwZTEsIHNoYXBlMikge1xyXG5cdGlmIChzaGFwZTEubGVuZ3RoICE9PSBzaGFwZTIubGVuZ3RoKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgc2hhcGUxLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRpZiAoc2hhcGUxW2ldICE9PSBzaGFwZTJbaV0pIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gdHJ1ZTtcclxufTtcclxuXHJcbnZhciBjb250ZXh0ID0gbnVsbDtcclxudmFyIHF1ZXVlID0gbnVsbDtcclxudmFyIHByb2dyYW0gPSBudWxsO1xyXG52YXIgbWVzc2FnZUNhbGxiYWNrcyA9IHt9O1xyXG52YXIgY2wgPSBudWxsO1xyXG5cclxudmFyIGJpbmFyeU9wS2VybmVscyA9IHtcclxuXHRhZGQ6IHt9LFxyXG5cdHN1Yjoge30sXHJcblx0bXVsOiB7fSxcclxuXHRkaXY6IHt9XHJcbn07XHJcbnZhciBiaW5hcnlDb25zdE9wS2VybmVscyA9IHtcclxuXHRhZGQ6IHt9LFxyXG5cdHN1Yjoge30sXHJcblx0bXVsOiB7fSxcclxuXHRkaXY6IHt9XHJcbn07XHJcbnZhciB1bmFyeU9wS2VybmVscyA9IHtcclxuXHRuZWc6IHt9LFxyXG5cdGFiczoge30sXHJcblx0ZXhwOiB7fSxcclxuXHRsb2c6IHt9LFxyXG5cdHNxcnQ6IHt9LFxyXG5cdHNxdWFyZToge31cclxufTtcclxuXHJcbmZ1bmN0aW9uIFdlYkNMQ29udGV4dChjYWxsYmFjaykge1xyXG5cdGlmIChjbCA9PT0gbnVsbCkge1xyXG5cdFx0aWYgKHR5cGVvZiB3ZWJjbCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRjbCA9IG5ldyBXZWJDTCgpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Y2wgPSB3ZWJjbDtcclxuXHRcdH1cclxuXHRcdGNvbnRleHQgPSBjbC5jcmVhdGVDb250ZXh0KCk7XHJcblx0XHRxdWV1ZSA9IGNvbnRleHQuY3JlYXRlQ29tbWFuZFF1ZXVlKCk7XHJcblx0XHRwcm9ncmFtID0gY29udGV4dC5jcmVhdGVQcm9ncmFtKHNvdXJjZSk7XHJcblx0XHRwcm9ncmFtLmJ1aWxkKCk7XHJcblx0XHRiaW5hcnlPcEtlcm5lbHMuYWRkLmYzMiA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiYWRkRjMyXCIpO1xyXG5cdFx0YmluYXJ5T3BLZXJuZWxzLmFkZC5mNjQgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFkZEY2NFwiKTtcclxuXHRcdGJpbmFyeU9wS2VybmVscy5zdWIuZjMyID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJzdWJGMzJcIik7XHJcblx0XHRiaW5hcnlPcEtlcm5lbHMuc3ViLmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3ViRjY0XCIpO1xyXG5cdFx0YmluYXJ5T3BLZXJuZWxzLm11bC5mMzIgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcIm11bEYzMlwiKTtcclxuXHRcdGJpbmFyeU9wS2VybmVscy5tdWwuZjY0ID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJtdWxGNjRcIik7XHJcblx0XHRiaW5hcnlPcEtlcm5lbHMuZGl2LmYzMiA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiZGl2RjMyXCIpO1xyXG5cdFx0YmluYXJ5T3BLZXJuZWxzLmRpdi5mNjQgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImRpdkY2NFwiKTtcclxuXHRcdGJpbmFyeUNvbnN0T3BLZXJuZWxzLmFkZC5mMzIgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImFkZENvbnN0RjMyXCIpO1xyXG5cdFx0YmluYXJ5Q29uc3RPcEtlcm5lbHMuYWRkLmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiYWRkQ29uc3RGNjRcIik7XHJcblx0XHRiaW5hcnlDb25zdE9wS2VybmVscy5zdWIuZjMyID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJzdWJDb25zdEYzMlwiKTtcclxuXHRcdGJpbmFyeUNvbnN0T3BLZXJuZWxzLnN1Yi5mNjQgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcInN1YkNvbnN0RjY0XCIpO1xyXG5cdFx0YmluYXJ5Q29uc3RPcEtlcm5lbHMubXVsLmYzMiA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwibXVsQ29uc3RGMzJcIik7XHJcblx0XHRiaW5hcnlDb25zdE9wS2VybmVscy5tdWwuZjY0ID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJtdWxDb25zdEY2NFwiKTtcclxuXHRcdGJpbmFyeUNvbnN0T3BLZXJuZWxzLmRpdi5mMzIgPSBwcm9ncmFtLmNyZWF0ZUtlcm5lbChcImRpdkNvbnN0RjMyXCIpO1xyXG5cdFx0YmluYXJ5Q29uc3RPcEtlcm5lbHMuZGl2LmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwiZGl2Q29uc3RGNjRcIik7XHJcblx0XHR1bmFyeU9wS2VybmVscy5uZWcuZjMyID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJuZWdGMzJcIik7XHJcblx0XHR1bmFyeU9wS2VybmVscy5uZWcuZjY0ID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJuZWdGNjRcIik7XHJcblx0XHR1bmFyeU9wS2VybmVscy5hYnMuZjMyID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhYnNGMzJcIik7XHJcblx0XHR1bmFyeU9wS2VybmVscy5hYnMuZjY0ID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJhYnNGNjRcIik7XHJcblx0XHR1bmFyeU9wS2VybmVscy5leHAuZjMyID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJleHBGMzJcIik7XHJcblx0XHR1bmFyeU9wS2VybmVscy5leHAuZjY0ID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJleHBGNjRcIik7XHJcblx0XHR1bmFyeU9wS2VybmVscy5sb2cuZjMyID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJsb2dGMzJcIik7XHJcblx0XHR1bmFyeU9wS2VybmVscy5sb2cuZjY0ID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJsb2dGNjRcIik7XHJcblx0XHR1bmFyeU9wS2VybmVscy5zcXJ0LmYzMiA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3FydEYzMlwiKTtcclxuXHRcdHVuYXJ5T3BLZXJuZWxzLnNxcnQuZjY0ID0gcHJvZ3JhbS5jcmVhdGVLZXJuZWwoXCJzcXJ0RjY0XCIpO1xyXG5cdFx0dW5hcnlPcEtlcm5lbHMuc3F1YXJlLmYzMiA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3F1YXJlRjMyXCIpO1xyXG5cdFx0dW5hcnlPcEtlcm5lbHMuc3F1YXJlLmY2NCA9IHByb2dyYW0uY3JlYXRlS2VybmVsKFwic3F1YXJlRjY0XCIpO1xyXG5cdH1cclxuXHRjYWxsYmFjayh0aGlzKTtcclxufVxyXG5cclxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5lbXB0eSA9IGZ1bmN0aW9uKHNoYXBlLCBkYXRhVHlwZSkge1xyXG5cdGlmICghdXRpbC5pc1Bvc2l0aXZlSW50QXJyYXkoc2hhcGUpICYmICF1dGlsLmlzUG9zaXRpdmVJbnQoc2hhcGUpKSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKHNoYXBlICsgXCIgaXMgbm90IGEgdmFsaWQgYXJyYXkgc2hhcGVcIik7XHJcblx0fVxyXG5cdGlmICh0eXBlb2YgZGF0YVR5cGUgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xyXG5cdH0gZWxzZSBpZiAoIShkYXRhVHlwZSBpbnN0YW5jZW9mIERhdGFUeXBlKSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihkYXRhVHlwZSArIFwiIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBEYXRhVHlwZVwiKTtcclxuXHR9XHJcblx0dmFyIG5kYXJyYXkgPSBuZXcgTkRBcnJheShzaGFwZSwgZGF0YVR5cGUsIHRoaXMpO1xyXG5cdG5kYXJyYXkuX2J1ZmZlciA9IGNvbnRleHQuY3JlYXRlQnVmZmVyKGNsLk1FTV9SRUFEX1dSSVRFLCBuZGFycmF5Lmxlbmd0aCAqIGRhdGFUeXBlLnNpemUpO1xyXG5cdHJldHVybiBuZGFycmF5O1xyXG59O1xyXG5cclxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5hcnJheSA9IGZ1bmN0aW9uKGRhdGEsIGRhdGFUeXBlKSB7XHJcblx0dmFyIHNoYXBlID0gW107XHJcblx0dXRpbC5kaXNjb3ZlckFycmF5U2hhcGVSZWN1cnNpdmUoZGF0YSwgc2hhcGUsIDApO1xyXG5cdGlmICh0eXBlb2YgZGF0YVR5cGUgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdGRhdGFUeXBlID0gbmV3IERhdGFUeXBlKFwiZjY0XCIpO1xyXG5cdH0gZWxzZSBpZiAoIShkYXRhVHlwZSBpbnN0YW5jZW9mIERhdGFUeXBlKSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihkYXRhVHlwZSArIFwiIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiBEYXRhVHlwZVwiKTtcclxuXHR9XHJcblx0dmFyIG5kYXJyYXkgPSBuZXcgTkRBcnJheShzaGFwZSwgZGF0YVR5cGUsIHRoaXMpO1xyXG5cdHZhciBidWZmZXIgPSBuZXcgZGF0YVR5cGUuYXJyYXlUeXBlKG5kYXJyYXkubGVuZ3RoKTtcclxuXHR1dGlsLmNvcHlBcnJheURhdGFSZWN1cnNpdmUoYnVmZmVyLCBkYXRhLCBzaGFwZSwgMCwgMCk7XHJcblx0bmRhcnJheS5fYnVmZmVyID0gY29udGV4dC5jcmVhdGVCdWZmZXIoY2wuTUVNX1JFQURfV1JJVEUsIG5kYXJyYXkubGVuZ3RoICogZGF0YVR5cGUuc2l6ZSk7XHJcblx0cXVldWUuZW5xdWV1ZVdyaXRlQnVmZmVyKG5kYXJyYXkuX2J1ZmZlciwgZmFsc2UsIDAsIG5kYXJyYXkubGVuZ3RoICogZGF0YVR5cGUuc2l6ZSwgYnVmZmVyKTtcclxuXHRyZXR1cm4gbmRhcnJheTtcclxufTtcclxuXHJcbldlYkNMQ29udGV4dC5wcm90b3R5cGUuX2ludmFsaWRhdGUgPSBmdW5jdGlvbihhcnJheSkge1xyXG5cdHV0aWwuY2hlY2tOREFycmF5KGFycmF5LCBcImFycmF5XCIpO1xyXG5cdGFycmF5Ll9idWZmZXIucmVsZWFzZSgpO1xyXG59O1xyXG5cclxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihuZGFycmF5LCBjYWxsYmFjaykge1xyXG5cdGlmICghKG5kYXJyYXkgaW5zdGFuY2VvZiBOREFycmF5KSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihuZGFycmF5ICsgXCIgaXMgbm90IGFuIE5EQXJyYXlcIik7XHJcblx0fVxyXG5cdC8qXHJcblx0dmFyIHJlYWRGaW5pc2hFdmVudCA9IG5ldyBXZWJDTEV2ZW50KCk7XHJcblx0dmFyIGJ1ZmZlciA9IG5ldyBuZGFycmF5LmRhdGFUeXBlLmFycmF5VHlwZShuZGFycmF5Lmxlbmd0aCk7XHJcblx0cXVldWUuZW5xdWV1ZVJlYWRCdWZmZXIobmRhcnJheS5fYnVmZmVyLCBmYWxzZSwgMCwgbmRhcnJheS5sZW5ndGggKiBuZGFycmF5LmRhdGFUeXBlLnNpemUsIGJ1ZmZlciwgbnVsbCwgcmVhZEZpbmlzaEV2ZW50KTtcclxuXHRyZWFkRmluaXNoRXZlbnQuc2V0Q2FsbGJhY2soY2wuQ09NUExFVEUsIGZ1bmN0aW9uKCkge1xyXG5cdFx0cmVhZEZpbmlzaEV2ZW50LnJlbGVhc2UoKTtcclxuXHRcdHZhciBqc2FycmF5ID0gbmV3IEFycmF5KG5kYXJyYXkuc2hhcGVbMF0pO1xyXG5cdFx0Y3JlYXRlQXJyYXlSZWN1cnNpdmUobmV3IG5kYXJyYXkuZGF0YVR5cGUuYXJyYXlUeXBlKGJ1ZmZlciksIGpzYXJyYXksIG5kYXJyYXkuc2hhcGUsIDAsIDApO1xyXG5cdFx0Y2FsbGJhY2soanNhcnJheSk7XHJcblx0fSk7Ki9cclxuXHR2YXIgcmVhZEZpbmlzaEV2ZW50ID0gbmV3IFdlYkNMRXZlbnQoKTtcclxuXHR2YXIgYnVmZmVyID0gbmV3IG5kYXJyYXkuZGF0YVR5cGUuYXJyYXlUeXBlKG5kYXJyYXkubGVuZ3RoKTtcclxuXHRxdWV1ZS5lbnF1ZXVlUmVhZEJ1ZmZlcihuZGFycmF5Ll9idWZmZXIsIHRydWUsIDAsIG5kYXJyYXkubGVuZ3RoICogbmRhcnJheS5kYXRhVHlwZS5zaXplLCBidWZmZXIpO1xyXG5cdHZhciBqc2FycmF5ID0gbmV3IEFycmF5KG5kYXJyYXkuc2hhcGVbMF0pO1xyXG5cdHV0aWwuY3JlYXRlQXJyYXlSZWN1cnNpdmUobmV3IG5kYXJyYXkuZGF0YVR5cGUuYXJyYXlUeXBlKGJ1ZmZlciksIGpzYXJyYXksIG5kYXJyYXkuc2hhcGUsIDAsIDApO1xyXG5cdGNhbGxiYWNrKGpzYXJyYXkpO1xyXG59O1xyXG5cclxudmFyIGJpbmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBiLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xyXG5cdHZhciBzaGFwZSA9IG51bGwsIGRhdGFUeXBlID0gbnVsbDtcclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdHNoYXBlID0gYS5zaGFwZTtcclxuXHRcdGRhdGFUeXBlID0gYS5kYXRhVHlwZTtcclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHRpZiAoIWlzQ29tcGF0aWJsZVNoYXBlKHNoYXBlLCBiLnNoYXBlKSkge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihcIlRoZSBhIGFuZCBiIGFycmF5cyBoYXZlIGluY29tcGF0aWJsZSBzaGFwZXNcIik7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAoIXV0aWwuaXNOdW1iZXIoYikpIHtcclxuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYlwiKTtcclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYVwiKTtcclxuXHR9XHJcblx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdG91dCA9IGNvbnRleHQuZW1wdHkoc2hhcGUsIGRhdGFUeXBlKTtcclxuXHR9IGVsc2UgaWYgKG91dCBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGlmICghaXNDb21wYXRpYmxlU2hhcGUoc2hhcGUsIG91dC5zaGFwZSkpIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVGhlIG91dCBhcnJheSBoYXMgaW5jb21wYXRpYmxlIHNoYXBlXCIpO1xyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwib3V0IGlzIG5vdCBhbiBOREFycmF5XCIpO1xyXG5cdH1cclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGlmIChiIGluc3RhbmNlb2YgTkRBcnJheSkge1xyXG5cdFx0XHR2YXIga2VybmVsID0gYmluYXJ5T3BLZXJuZWxzW29wZXJhdGlvbl1bZGF0YVR5cGUudHlwZV07XHJcblx0XHRcdGtlcm5lbC5zZXRBcmcoMCwgbmV3IFVpbnQzMkFycmF5KFtvdXQubGVuZ3RoXSkpO1xyXG5cdFx0XHRrZXJuZWwuc2V0QXJnKDEsIGEuX2J1ZmZlcik7XHJcblx0XHRcdGtlcm5lbC5zZXRBcmcoMiwgYi5fYnVmZmVyKTtcclxuXHRcdFx0a2VybmVsLnNldEFyZygzLCBvdXQuX2J1ZmZlcik7XHJcblx0XHRcdHF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMSwgbnVsbCwgW291dC5sZW5ndGhdKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHZhciBrZXJuZWwgPSBiaW5hcnlDb25zdE9wS2VybmVsc1tvcGVyYXRpb25dW2RhdGFUeXBlLnR5cGVdO1xyXG5cdFx0XHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbb3V0Lmxlbmd0aF0pKTtcclxuXHRcdFx0a2VybmVsLnNldEFyZygxLCBhLl9idWZmZXIpO1xyXG5cdFx0XHRrZXJuZWwuc2V0QXJnKDIsIG5ldyBhLmRhdGFUeXBlLmFycmF5VHlwZShbYl0pKTtcclxuXHRcdFx0a2VybmVsLnNldEFyZygzLCBvdXQuX2J1ZmZlcik7XHJcblx0XHRcdHF1ZXVlLmVucXVldWVORFJhbmdlS2VybmVsKGtlcm5lbCwgMSwgbnVsbCwgW291dC5sZW5ndGhdKTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIG91dDtcclxufTtcclxuXHJcbnZhciB1bmFyeUFyaXRoT3AgPSBmdW5jdGlvbihhLCBvdXQsIGNvbnRleHQsIG9wZXJhdGlvbikge1xyXG5cdHZhciBzaGFwZSA9IG51bGwsIGRhdGFUeXBlID0gbnVsbDtcclxuXHRpZiAoYSBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdHNoYXBlID0gYS5zaGFwZTtcclxuXHRcdGRhdGFUeXBlID0gYS5kYXRhVHlwZTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlVuc3VwcG9ydGVkIHR5cGUgb2YgYVwiKTtcclxuXHR9XHJcblx0aWYgKHR5cGVvZiBvdXQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdG91dCA9IGNvbnRleHQuZW1wdHkoc2hhcGUsIGRhdGFUeXBlKTtcclxuXHR9IGVsc2UgaWYgKG91dCBpbnN0YW5jZW9mIE5EQXJyYXkpIHtcclxuXHRcdGlmICghaXNDb21wYXRpYmxlU2hhcGUoc2hhcGUsIG91dC5zaGFwZSkpIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVGhlIG91dCBhcnJheSBoYXMgaW5jb21wYXRpYmxlIHNoYXBlXCIpO1xyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwib3V0IGlzIG5vdCBhbiBOREFycmF5XCIpO1xyXG5cdH1cclxuXHR2YXIga2VybmVsID0gdW5hcnlPcEtlcm5lbHNbb3BlcmF0aW9uXVtkYXRhVHlwZS50eXBlXTtcclxuXHRrZXJuZWwuc2V0QXJnKDAsIG5ldyBVaW50MzJBcnJheShbb3V0Lmxlbmd0aF0pKTtcclxuXHRrZXJuZWwuc2V0QXJnKDEsIGEuX2J1ZmZlcik7XHJcblx0a2VybmVsLnNldEFyZygyLCBvdXQuX2J1ZmZlcik7XHJcblx0cXVldWUuZW5xdWV1ZU5EUmFuZ2VLZXJuZWwoa2VybmVsLCAxLCBudWxsLCBbb3V0Lmxlbmd0aF0pO1xyXG5cdHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJhZGRcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLnN1YiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJzdWJcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLm11bCA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJtdWxcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmRpdiA9IGZ1bmN0aW9uKGEsIGIsIG91dCkge1xyXG5cdHJldHVybiBiaW5hcnlBcml0aE9wKGEsIGIsIG91dCwgdGhpcywgXCJkaXZcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLm5lZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcIm5lZ1wiKTtcclxufTtcclxuXHJcbldlYkNMQ29udGV4dC5wcm90b3R5cGUuYWJzID0gZnVuY3Rpb24oYSwgb3V0KSB7XHJcblx0cmV0dXJuIHVuYXJ5QXJpdGhPcChhLCBvdXQsIHRoaXMsIFwiYWJzXCIpO1xyXG59O1xyXG5cclxuV2ViQ0xDb250ZXh0LnByb3RvdHlwZS5leHAgPSBmdW5jdGlvbihhLCBvdXQpIHtcclxuXHRyZXR1cm4gdW5hcnlBcml0aE9wKGEsIG91dCwgdGhpcywgXCJleHBcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLmxvZyA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcImxvZ1wiKTtcclxufTtcclxuXHJcbldlYkNMQ29udGV4dC5wcm90b3R5cGUuc3FydCA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcInNxcnRcIik7XHJcbn07XHJcblxyXG5XZWJDTENvbnRleHQucHJvdG90eXBlLnNxdWFyZSA9IGZ1bmN0aW9uKGEsIG91dCkge1xyXG5cdHJldHVybiB1bmFyeUFyaXRoT3AoYSwgb3V0LCB0aGlzLCBcInNxdWFyZVwiKTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gV2ViQ0xDb250ZXh0O1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gW1xyXG5cdFwia2VybmVsIHZvaWQgYWRkRjMyKFwiLFxyXG5cdFwiXHR1aW50IGxlbmd0aCxcIixcclxuXHRcIlx0Z2xvYmFsIGZsb2F0KiBhLFwiLFxyXG5cdFwiXHRnbG9iYWwgZmxvYXQqIGIsXCIsXHJcblx0XCJcdGdsb2JhbCBmbG9hdCogb3V0KVwiLFxyXG5cdFwie1wiLFxyXG5cdFwiXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcIixcclxuXHRcIlx0aWYgKGlkIDwgbGVuZ3RoKSB7XCIsXHJcblx0XCJcdFx0b3V0W2lkXSA9IGFbaWRdICsgYltpZF07XCIsXHJcblx0XCJcdH1cIixcclxuXHRcIn1cIixcclxuXHRcImtlcm5lbCB2b2lkIGFkZEY2NChcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIGEsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIGIsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIG91dClcIixcclxuXHRcIntcIixcclxuXHRcIlx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XCIsXHJcblx0XCJcdGlmIChpZCA8IGxlbmd0aCkge1wiLFxyXG5cdFwiXHRcdG91dFtpZF0gPSBhW2lkXSArIGJbaWRdO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBzdWJGMzIoXCIsXHJcblx0XCJcdHVpbnQgbGVuZ3RoLFwiLFxyXG5cdFwiXHRnbG9iYWwgZmxvYXQqIGEsXCIsXHJcblx0XCJcdGdsb2JhbCBmbG9hdCogYixcIixcclxuXHRcIlx0Z2xvYmFsIGZsb2F0KiBvdXQpXCIsXHJcblx0XCJ7XCIsXHJcblx0XCJcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1wiLFxyXG5cdFwiXHRpZiAoaWQgPCBsZW5ndGgpIHtcIixcclxuXHRcIlx0XHRvdXRbaWRdID0gYVtpZF0gLSBiW2lkXTtcIixcclxuXHRcIlx0fVwiLFxyXG5cdFwifVwiLFxyXG5cdFwia2VybmVsIHZvaWQgc3ViRjY0KFwiLFxyXG5cdFwiXHR1aW50IGxlbmd0aCxcIixcclxuXHRcIlx0Z2xvYmFsIGRvdWJsZSogYSxcIixcclxuXHRcIlx0Z2xvYmFsIGRvdWJsZSogYixcIixcclxuXHRcIlx0Z2xvYmFsIGRvdWJsZSogb3V0KVwiLFxyXG5cdFwie1wiLFxyXG5cdFwiXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcIixcclxuXHRcIlx0aWYgKGlkIDwgbGVuZ3RoKSB7XCIsXHJcblx0XCJcdFx0b3V0W2lkXSA9IGFbaWRdIC0gYltpZF07XCIsXHJcblx0XCJcdH1cIixcclxuXHRcIn1cIixcclxuXHRcImtlcm5lbCB2b2lkIG11bEYzMihcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBmbG9hdCogYSxcIixcclxuXHRcIlx0Z2xvYmFsIGZsb2F0KiBiLFwiLFxyXG5cdFwiXHRnbG9iYWwgZmxvYXQqIG91dClcIixcclxuXHRcIntcIixcclxuXHRcIlx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XCIsXHJcblx0XCJcdGlmIChpZCA8IGxlbmd0aCkge1wiLFxyXG5cdFwiXHRcdG91dFtpZF0gPSBhW2lkXSAqIGJbaWRdO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBtdWxGNjQoXCIsXHJcblx0XCJcdHVpbnQgbGVuZ3RoLFwiLFxyXG5cdFwiXHRnbG9iYWwgZG91YmxlKiBhLFwiLFxyXG5cdFwiXHRnbG9iYWwgZG91YmxlKiBiLFwiLFxyXG5cdFwiXHRnbG9iYWwgZG91YmxlKiBvdXQpXCIsXHJcblx0XCJ7XCIsXHJcblx0XCJcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1wiLFxyXG5cdFwiXHRpZiAoaWQgPCBsZW5ndGgpIHtcIixcclxuXHRcIlx0XHRvdXRbaWRdID0gYVtpZF0gKiBiW2lkXTtcIixcclxuXHRcIlx0fVwiLFxyXG5cdFwifVwiLFxyXG5cdFwia2VybmVsIHZvaWQgZGl2RjMyKFwiLFxyXG5cdFwiXHR1aW50IGxlbmd0aCxcIixcclxuXHRcIlx0Z2xvYmFsIGZsb2F0KiBhLFwiLFxyXG5cdFwiXHRnbG9iYWwgZmxvYXQqIGIsXCIsXHJcblx0XCJcdGdsb2JhbCBmbG9hdCogb3V0KVwiLFxyXG5cdFwie1wiLFxyXG5cdFwiXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcIixcclxuXHRcIlx0aWYgKGlkIDwgbGVuZ3RoKSB7XCIsXHJcblx0XCJcdFx0b3V0W2lkXSA9IGFbaWRdIC8gYltpZF07XCIsXHJcblx0XCJcdH1cIixcclxuXHRcIn1cIixcclxuXHRcImtlcm5lbCB2b2lkIGRpdkY2NChcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIGEsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIGIsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIG91dClcIixcclxuXHRcIntcIixcclxuXHRcIlx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XCIsXHJcblx0XCJcdGlmIChpZCA8IGxlbmd0aCkge1wiLFxyXG5cdFwiXHRcdG91dFtpZF0gPSBhW2lkXSAvIGJbaWRdO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBhZGRDb25zdEYzMihcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBmbG9hdCogYSxcIixcclxuXHRcIlx0ZmxvYXQgYixcIixcclxuXHRcIlx0Z2xvYmFsIGZsb2F0KiBvdXQpXCIsXHJcblx0XCJ7XCIsXHJcblx0XCJcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1wiLFxyXG5cdFwiXHRpZiAoaWQgPCBsZW5ndGgpIHtcIixcclxuXHRcIlx0XHRvdXRbaWRdID0gYVtpZF0gKyBiO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBhZGRDb25zdEY2NChcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIGEsXCIsXHJcblx0XCJcdGRvdWJsZSBiLFwiLFxyXG5cdFwiXHRnbG9iYWwgZG91YmxlKiBvdXQpXCIsXHJcblx0XCJ7XCIsXHJcblx0XCJcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1wiLFxyXG5cdFwiXHRpZiAoaWQgPCBsZW5ndGgpIHtcIixcclxuXHRcIlx0XHRvdXRbaWRdID0gYVtpZF0gKyBiO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBzdWJDb25zdEYzMihcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBmbG9hdCogYSxcIixcclxuXHRcIlx0ZmxvYXQgYixcIixcclxuXHRcIlx0Z2xvYmFsIGZsb2F0KiBvdXQpXCIsXHJcblx0XCJ7XCIsXHJcblx0XCJcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1wiLFxyXG5cdFwiXHRpZiAoaWQgPCBsZW5ndGgpIHtcIixcclxuXHRcIlx0XHRvdXRbaWRdID0gYVtpZF0gLSBiO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBzdWJDb25zdEY2NChcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIGEsXCIsXHJcblx0XCJcdGRvdWJsZSBiLFwiLFxyXG5cdFwiXHRnbG9iYWwgZG91YmxlKiBvdXQpXCIsXHJcblx0XCJ7XCIsXHJcblx0XCJcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1wiLFxyXG5cdFwiXHRpZiAoaWQgPCBsZW5ndGgpIHtcIixcclxuXHRcIlx0XHRvdXRbaWRdID0gYVtpZF0gLSBiO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBtdWxDb25zdEYzMihcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBmbG9hdCogYSxcIixcclxuXHRcIlx0ZmxvYXQgYixcIixcclxuXHRcIlx0Z2xvYmFsIGZsb2F0KiBvdXQpXCIsXHJcblx0XCJ7XCIsXHJcblx0XCJcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1wiLFxyXG5cdFwiXHRpZiAoaWQgPCBsZW5ndGgpIHtcIixcclxuXHRcIlx0XHRvdXRbaWRdID0gYVtpZF0gKiBiO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBtdWxDb25zdEY2NChcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIGEsXCIsXHJcblx0XCJcdGRvdWJsZSBiLFwiLFxyXG5cdFwiXHRnbG9iYWwgZG91YmxlKiBvdXQpXCIsXHJcblx0XCJ7XCIsXHJcblx0XCJcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1wiLFxyXG5cdFwiXHRpZiAoaWQgPCBsZW5ndGgpIHtcIixcclxuXHRcIlx0XHRvdXRbaWRdID0gYVtpZF0gKiBiO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBkaXZDb25zdEYzMihcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBmbG9hdCogYSxcIixcclxuXHRcIlx0ZmxvYXQgYixcIixcclxuXHRcIlx0Z2xvYmFsIGZsb2F0KiBvdXQpXCIsXHJcblx0XCJ7XCIsXHJcblx0XCJcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1wiLFxyXG5cdFwiXHRpZiAoaWQgPCBsZW5ndGgpIHtcIixcclxuXHRcIlx0XHRvdXRbaWRdID0gYVtpZF0gLyBiO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBkaXZDb25zdEY2NChcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIGEsXCIsXHJcblx0XCJcdGRvdWJsZSBiLFwiLFxyXG5cdFwiXHRnbG9iYWwgZG91YmxlKiBvdXQpXCIsXHJcblx0XCJ7XCIsXHJcblx0XCJcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1wiLFxyXG5cdFwiXHRpZiAoaWQgPCBsZW5ndGgpIHtcIixcclxuXHRcIlx0XHRvdXRbaWRdID0gYVtpZF0gLyBiO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBuZWdGMzIoXCIsXHJcblx0XCJcdHVpbnQgbGVuZ3RoLFwiLFxyXG5cdFwiXHRnbG9iYWwgZmxvYXQqIGEsXCIsXHJcblx0XCJcdGdsb2JhbCBmbG9hdCogb3V0KVwiLFxyXG5cdFwie1wiLFxyXG5cdFwiXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcIixcclxuXHRcIlx0aWYgKGlkIDwgbGVuZ3RoKSB7XCIsXHJcblx0XCJcdFx0b3V0W2lkXSA9IC1hW2lkXTtcIixcclxuXHRcIlx0fVwiLFxyXG5cdFwifVwiLFxyXG5cdFwia2VybmVsIHZvaWQgbmVnRjY0KFwiLFxyXG5cdFwiXHR1aW50IGxlbmd0aCxcIixcclxuXHRcIlx0Z2xvYmFsIGRvdWJsZSogYSxcIixcclxuXHRcIlx0Z2xvYmFsIGRvdWJsZSogb3V0KVwiLFxyXG5cdFwie1wiLFxyXG5cdFwiXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcIixcclxuXHRcIlx0aWYgKGlkIDwgbGVuZ3RoKSB7XCIsXHJcblx0XCJcdFx0b3V0W2lkXSA9IC1hW2lkXTtcIixcclxuXHRcIlx0fVwiLFxyXG5cdFwifVwiLFxyXG5cdFwia2VybmVsIHZvaWQgYWJzRjMyKFwiLFxyXG5cdFwiXHR1aW50IGxlbmd0aCxcIixcclxuXHRcIlx0Z2xvYmFsIGZsb2F0KiBhLFwiLFxyXG5cdFwiXHRnbG9iYWwgZmxvYXQqIG91dClcIixcclxuXHRcIntcIixcclxuXHRcIlx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XCIsXHJcblx0XCJcdGlmIChpZCA8IGxlbmd0aCkge1wiLFxyXG5cdFwiXHRcdG91dFtpZF0gPSBmYWJzKGFbaWRdKTtcIixcclxuXHRcIlx0fVwiLFxyXG5cdFwifVwiLFxyXG5cdFwia2VybmVsIHZvaWQgYWJzRjY0KFwiLFxyXG5cdFwiXHR1aW50IGxlbmd0aCxcIixcclxuXHRcIlx0Z2xvYmFsIGRvdWJsZSogYSxcIixcclxuXHRcIlx0Z2xvYmFsIGRvdWJsZSogb3V0KVwiLFxyXG5cdFwie1wiLFxyXG5cdFwiXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcIixcclxuXHRcIlx0aWYgKGlkIDwgbGVuZ3RoKSB7XCIsXHJcblx0XCJcdFx0b3V0W2lkXSA9IGZhYnMoYVtpZF0pO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBleHBGMzIoXCIsXHJcblx0XCJcdHVpbnQgbGVuZ3RoLFwiLFxyXG5cdFwiXHRnbG9iYWwgZmxvYXQqIGEsXCIsXHJcblx0XCJcdGdsb2JhbCBmbG9hdCogb3V0KVwiLFxyXG5cdFwie1wiLFxyXG5cdFwiXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcIixcclxuXHRcIlx0aWYgKGlkIDwgbGVuZ3RoKSB7XCIsXHJcblx0XCJcdFx0b3V0W2lkXSA9IGV4cChhW2lkXSk7XCIsXHJcblx0XCJcdH1cIixcclxuXHRcIn1cIixcclxuXHRcImtlcm5lbCB2b2lkIGV4cEY2NChcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIGEsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIG91dClcIixcclxuXHRcIntcIixcclxuXHRcIlx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XCIsXHJcblx0XCJcdGlmIChpZCA8IGxlbmd0aCkge1wiLFxyXG5cdFwiXHRcdG91dFtpZF0gPSBleHAoYVtpZF0pO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBsb2dGMzIoXCIsXHJcblx0XCJcdHVpbnQgbGVuZ3RoLFwiLFxyXG5cdFwiXHRnbG9iYWwgZmxvYXQqIGEsXCIsXHJcblx0XCJcdGdsb2JhbCBmbG9hdCogb3V0KVwiLFxyXG5cdFwie1wiLFxyXG5cdFwiXHRjb25zdCB1aW50IGlkID0gZ2V0X2dsb2JhbF9pZCgwKTtcIixcclxuXHRcIlx0aWYgKGlkIDwgbGVuZ3RoKSB7XCIsXHJcblx0XCJcdFx0b3V0W2lkXSA9IGxvZyhhW2lkXSk7XCIsXHJcblx0XCJcdH1cIixcclxuXHRcIn1cIixcclxuXHRcImtlcm5lbCB2b2lkIGxvZ0Y2NChcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIGEsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIG91dClcIixcclxuXHRcIntcIixcclxuXHRcIlx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XCIsXHJcblx0XCJcdGlmIChpZCA8IGxlbmd0aCkge1wiLFxyXG5cdFwiXHRcdG91dFtpZF0gPSBsb2coYVtpZF0pO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBzcXJ0RjMyKFwiLFxyXG5cdFwiXHR1aW50IGxlbmd0aCxcIixcclxuXHRcIlx0Z2xvYmFsIGZsb2F0KiBhLFwiLFxyXG5cdFwiXHRnbG9iYWwgZmxvYXQqIG91dClcIixcclxuXHRcIntcIixcclxuXHRcIlx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XCIsXHJcblx0XCJcdGlmIChpZCA8IGxlbmd0aCkge1wiLFxyXG5cdFwiXHRcdG91dFtpZF0gPSBzcXJ0KGFbaWRdKTtcIixcclxuXHRcIlx0fVwiLFxyXG5cdFwifVwiLFxyXG5cdFwia2VybmVsIHZvaWQgc3FydEY2NChcIixcclxuXHRcIlx0dWludCBsZW5ndGgsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIGEsXCIsXHJcblx0XCJcdGdsb2JhbCBkb3VibGUqIG91dClcIixcclxuXHRcIntcIixcclxuXHRcIlx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XCIsXHJcblx0XCJcdGlmIChpZCA8IGxlbmd0aCkge1wiLFxyXG5cdFwiXHRcdG91dFtpZF0gPSBzcXJ0KGFbaWRdKTtcIixcclxuXHRcIlx0fVwiLFxyXG5cdFwifVwiLFxyXG5cdFwia2VybmVsIHZvaWQgc3F1YXJlRjMyKFwiLFxyXG5cdFwiXHR1aW50IGxlbmd0aCxcIixcclxuXHRcIlx0Z2xvYmFsIGZsb2F0KiBhLFwiLFxyXG5cdFwiXHRnbG9iYWwgZmxvYXQqIG91dClcIixcclxuXHRcIntcIixcclxuXHRcIlx0Y29uc3QgdWludCBpZCA9IGdldF9nbG9iYWxfaWQoMCk7XCIsXHJcblx0XCJcdGlmIChpZCA8IGxlbmd0aCkge1wiLFxyXG5cdFwiXHRcdGNvbnN0IGZsb2F0IGFWYWwgPSBhW2lkXTsgXCIsXHJcblx0XCJcdFx0b3V0W2lkXSA9IGFWYWwgKiBhVmFsO1wiLFxyXG5cdFwiXHR9XCIsXHJcblx0XCJ9XCIsXHJcblx0XCJrZXJuZWwgdm9pZCBzcXVhcmVGNjQoXCIsXHJcblx0XCJcdHVpbnQgbGVuZ3RoLFwiLFxyXG5cdFwiXHRnbG9iYWwgZG91YmxlKiBhLFwiLFxyXG5cdFwiXHRnbG9iYWwgZG91YmxlKiBvdXQpXCIsXHJcblx0XCJ7XCIsXHJcblx0XCJcdGNvbnN0IHVpbnQgaWQgPSBnZXRfZ2xvYmFsX2lkKDApO1wiLFxyXG5cdFwiXHRpZiAoaWQgPCBsZW5ndGgpIHtcIixcclxuXHRcIlx0XHRjb25zdCBkb3VibGUgYVZhbCA9IGFbaWRdO1wiLFxyXG5cdFwiXHRcdG91dFtpZF0gPSBhVmFsICogYVZhbDtcIixcclxuXHRcIlx0fVwiLFxyXG5cdFwifVwiXHJcbl0uam9pbihcIlxcblwiKTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgbWVzc2FnZUlkID0gMTtcclxudmFyIGFycmF5SWQgPSAxO1xyXG5cclxuZXhwb3J0cy5uZXdNZXNzYWdlSWQgPSBmdW5jdGlvbigpIHtcclxuXHR2YXIgaWQgPSBtZXNzYWdlSWQ7XHJcblx0bWVzc2FnZUlkID0gKG1lc3NhZ2VJZCsxKXwwO1xyXG5cdHJldHVybiBpZDtcclxufTtcclxuXHJcbmV4cG9ydHMubmV3QXJyYXlJZCA9IGZ1bmN0aW9uICgpIHtcclxuXHR2YXIgaWQgPSBhcnJheUlkO1xyXG5cdGFycmF5SWQgPSAoYXJyYXlJZCsxKXwwO1xyXG5cdHJldHVybiBpZDtcclxufTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogUHJvdmlkZXMgaW5mb3JtYXRpb24gYW5kIHN1cHBvcnQgZnVuY3Rpb25zXHJcbiAqXHJcbiAqIEBjbGFzcyBmdXJpb3VzXHJcbiAqL1xyXG5cclxudmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XHJcbnZhciBKU0NvbnRleHQgPSByZXF1aXJlKFwiLi9KU0NvbnRleHRcIik7XHJcbnZhciBQTmFDbENvbnRleHQgPSByZXF1aXJlKFwiLi9QTmFDbENvbnRleHRcIik7XHJcbnZhciBXZWJDTENvbnRleHQgPSByZXF1aXJlKFwiLi9XZWJDTENvbnRleHRcIik7XHJcblxyXG4vKipcclxuICogSW5pdGlhbGl6ZXMgYSBjb21wdXRhdGlvbmFsIGNvbnRleHQuXHJcbiAqXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBpbml0XHJcbiAqIEBhc3luY1xyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gW2JhY2tlbmRdIC0gQSBzdHJpbmcgaWRlbnRpZmllciBmb3IgdGhlIGJhY2tlbmQgdG8gdXNlLiBUaGUgZm9sbG93aW5nIHZhbHVlcyBhcmUgc3VwcG9ydGVkOlxyXG4gKlxyXG4gKiAgICAgPHRhYmxlPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRoPkJhY2tlbmQgSWRlbnRpZmllcjwvdGg+XHJcbiAqICAgICAgICAgICAgIDx0aD5JbnRlcnByZXRhdGlvbjwvdGg+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cImphdmFzY3JpcHRcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5KYXZhU2NyaXB0IGJhY2tlbmQuIFdvcmtzIGluIGFsbCBicm93c2VycyBhbmQgTm9kZS5qcywgYnV0IGNhbiBub3QgZGVsaXZlciBvcHRpbWFsIHBlcmZvcm1hbmNlLjwvdGQ+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cInBuYWNsXCI8L3RkPlxyXG4gKiAgICAgICAgICAgICA8dGQ+UG9ydGFibGUgTmF0aXZlIENsaWVudCAoUE5hQ2wpIGJhY2tlbmQuIFdvcmtzIGluIENocm9taXVtLWJhc2VkIGJyb3dzZXJzLiBDYW4gYWNjZWxlcmF0ZSBjb21wdXRhdGlvbnMgdGhyb3VnaCB0aGUgdXNlIG9mIGFkdmFuY2VkIENQVSBvcHRpbWl6YXRpb24gdGVjaG5vbG9naWVzLCBzdWNoIGFzIG11bHRpLXRocmVhZGluZyBhbmQgU0lNRCBpbnN0cnVjdGlvbnMuPC90ZD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwid2ViY2xcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5XZWJDTCBiYWNrZW5kLiBXb3JrcyBpbiBicm93c2VycyBhbmQgTm9kZS5qcyB3aGVuIGEgV2ViQ0wgcGx1Z2luIGlzIGF2YWlsYWJsZS4gQ2FuIHVzZSBmdWxsIHBvd2VyIG9mIENQVXMgYW5kIEdQVXMgdG8gYWNjZWxlcmF0ZSBjb21wdXRhdGlvbnMuPC90ZD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgPC90YWJsZT5cclxuICpcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGJhY2tlbmQgZmluaXNoIGluaXRpYWxpemF0aW9uLlxyXG4gKiBAcGFyYW0ge0NvbnRleHR9IGNhbGxiYWNrLmNvbnRleHQgLSBBIHJlYWR5IHRvIHVzZSBjb21wdXRhdGlvbmFsIGNvbnRleHQuXHJcbiAqL1xyXG52YXIgaW5pdCA9IGZ1bmN0aW9uKGJhY2tlbmQsIGNhbGxiYWNrKSB7XHJcblx0aWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0Y2FsbGJhY2sgPSBiYWNrZW5kO1xyXG5cdFx0YmFja2VuZCA9IHVuZGVmaW5lZDtcclxuXHR9XHJcblx0aWYgKHR5cGVvZiBiYWNrZW5kID09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdGJhY2tlbmQgPSBnZXREZWZhdWx0QmFja2VuZCgpO1xyXG5cdH1cclxuXHRpZiAoYmFja2VuZCA9PSBcImphdmFzY3JpcHRcIikge1xyXG5cdFx0cmV0dXJuIG5ldyBKU0NvbnRleHQoY2FsbGJhY2spO1xyXG5cdH0gZWxzZSBpZiAoYmFja2VuZCA9PSBcInBuYWNsXCIpIHtcclxuXHRcdHJldHVybiBuZXcgUE5hQ2xDb250ZXh0KGNhbGxiYWNrKTtcclxuXHR9IGVsc2UgaWYgKGJhY2tlbmQgPT0gXCJ3ZWJjbFwiKSB7XHJcblx0XHRyZXR1cm4gbmV3IFdlYkNMQ29udGV4dChjYWxsYmFjayk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGJhY2tlbmQ6IFwiICsgYmFja2VuZCk7XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIERldGVjdHMgdGhlIG9wdGltYWwgYmFja2VuZCBzdXBwb3J0ZWQgYnkgdGhlIGJyb3dzZXIgb3IgSmF2YVNjcmlwdCBlbmdpbmUuXHJcbiAqXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBnZXREZWZhdWx0QmFja2VuZFxyXG4gKlxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IC0gRGVmYXVsdCBiYWNrZW5kIGlkZW50aWZpZXIgZnJvbSB0aGUgZm9sbG93aW5nIHRhYmxlOlxyXG4gKlxyXG4gKiAgICAgPHRhYmxlPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRoPkJhY2tlbmQgSWRlbnRpZmllcjwvdGg+XHJcbiAqICAgICAgICAgICAgIDx0aD5JbnRlcnByZXRhdGlvbjwvdGg+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cImphdmFzY3JpcHRcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5KYXZhU2NyaXB0IGJhY2tlbmQuIFdvcmtzIGluIGFsbCBicm93c2VycyBhbmQgTm9kZS5qcywgYnV0IGNhbiBub3QgZGVsaXZlciBvcHRpbWFsIHBlcmZvcm1hbmNlLjwvdGQ+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cImFzbWpzXCI8L3RkPlxyXG4gKiAgICAgICAgICAgICA8dGQ+QXNtLmpzIGJhY2tlbmQuIFdvcmtzIGluIEZpcmVmb3ggMjkgYW5kIGxhdGVyLiBDYW4gYWNjZWxlcmF0ZSBjb21wdXRhdGlvbnMgd2l0aCBhIGxpbWl0ZWQgdXNlIG9mIG5hdGl2ZSBDUFUgaW5zdHJ1Y3Rpb25zLjwvdGQ+XHJcbiAqICAgICAgICAgPC90cj5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0ZD5cInBuYWNsXCI8L3RkPlxyXG4gKiAgICAgICAgICAgICA8dGQ+UG9ydGFibGUgTmF0aXZlIENsaWVudCAoUE5hQ2wpIGJhY2tlbmQuIFdvcmtzIGluIENocm9taXVtLWJhc2VkIGJyb3dzZXJzLiBDYW4gYWNjZWxlcmF0ZSBjb21wdXRhdGlvbnMgdGhyb3VnaCB0aGUgdXNlIG9mIGFkdmFuY2VkIENQVSBvcHRpbWl6YXRpb24gdGVjaG5vbG9naWVzLCBzdWNoIGFzIG11bHRpLXRocmVhZGluZyBhbmQgU0lNRCBpbnN0cnVjdGlvbnMuPC90ZD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwid2ViY2xcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5XZWJDTCBiYWNrZW5kLiBXb3JrcyBpbiBicm93c2VycyBhbmQgTm9kZS5qcyB3aGVuIGEgV2ViQ0wgcGx1Z2luIGlzIGF2YWlsYWJsZS4gQ2FuIHVzZSBmdWxsIHBvd2VyIG9mIENQVXMgYW5kIEdQVXMgdG8gYWNjZWxlcmF0ZSBjb21wdXRhdGlvbnMuPC90ZD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgPC90YWJsZT5cclxuICovXHJcbnZhciBnZXREZWZhdWx0QmFja2VuZCA9IGZ1bmN0aW9uKCkge1xyXG5cdGlmIChoYXNGZWF0dXJlKFwid2ViY2xcIikpIHtcclxuXHRcdHJldHVybiBcIndlYmNsXCI7XHJcblx0fSBlbHNlIGlmIChoYXNGZWF0dXJlKFwicG5hY2xcIikpIHtcclxuXHRcdHJldHVybiBcInBuYWNsXCI7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBcImphdmFzY3JpcHRcIjtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogRGV0ZWN0cyB3aGljaCBiYWNrZW5kcyBhcmUgc3VwcG9ydGVkIGJ5IHRoZSBzeXN0ZW0uXHJcbiAqXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBnZXRTdXBwb3J0ZWRCYWNrZW5kc1xyXG4gKlxyXG4gKiBAcmV0dXJuIHtTdHJpbmdbXX0gLSBBbiBhcnJheSBvZiBzdXBwb3J0ZWQgYmFja2VuZCBpZGVudGlmaWVycyBpbiBwcmlvcml0eSBvcmRlciAocHJpb3JpdGl6ZWQgYmFja2VuZHMgZmlyc3QpLiBUaGUgZm9sbG93aW5nIGlkZW50aWZpZXJzIGNvdWxkIGJlIHByZXNlbnQ6XHJcbiAqXHJcbiAqICAgICA8dGFibGU+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGg+QmFja2VuZCBJZGVudGlmaWVyPC90aD5cclxuICogICAgICAgICAgICAgPHRoPkludGVycHJldGF0aW9uPC90aD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwiamF2YXNjcmlwdFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPkphdmFTY3JpcHQgYmFja2VuZC4gV29ya3MgaW4gYWxsIGJyb3dzZXJzIGFuZCBOb2RlLmpzLCBidXQgY2FuIG5vdCBkZWxpdmVyIG9wdGltYWwgcGVyZm9ybWFuY2UuPC90ZD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwiYXNtanNcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5Bc20uanMgYmFja2VuZC4gV29ya3MgaW4gRmlyZWZveCAyOSBhbmQgbGF0ZXIuIENhbiBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucyB3aXRoIGEgbGltaXRlZCB1c2Ugb2YgbmF0aXZlIENQVSBpbnN0cnVjdGlvbnMuPC90ZD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwicG5hY2xcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5Qb3J0YWJsZSBOYXRpdmUgQ2xpZW50IChQTmFDbCkgYmFja2VuZC4gV29ya3MgaW4gQ2hyb21pdW0tYmFzZWQgYnJvd3NlcnMuIENhbiBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucyB0aHJvdWdoIHRoZSB1c2Ugb2YgYWR2YW5jZWQgQ1BVIG9wdGltaXphdGlvbiB0ZWNobm9sb2dpZXMsIHN1Y2ggYXMgbXVsdGktdGhyZWFkaW5nIGFuZCBTSU1EIGluc3RydWN0aW9ucy48L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJ3ZWJjbFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPldlYkNMIGJhY2tlbmQuIFdvcmtzIGluIGJyb3dzZXJzIGFuZCBOb2RlLmpzIHdoZW4gYSBXZWJDTCBwbHVnaW4gaXMgYXZhaWxhYmxlLiBDYW4gdXNlIGZ1bGwgcG93ZXIgb2YgQ1BVcyBhbmQgR1BVcyB0byBhY2NlbGVyYXRlIGNvbXB1dGF0aW9ucy48L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICA8L3RhYmxlPlxyXG4gKi9cclxudmFyIGdldFN1cHBvcnRlZEJhY2tlbmRzID0gZnVuY3Rpb24oKSB7XHJcblx0dmFyIGJhY2tlbmRzID0gW107XHJcblx0aWYgKGhhc0ZlYXR1cmUoXCJ3ZWJjbFwiKSkge1xyXG5cdFx0YmFja2VuZHMucHVzaChcIndlYmNsXCIpO1xyXG5cdH1cclxuXHRpZiAoaGFzRmVhdHVyZShcInBuYWNsXCIpKSB7XHJcblx0XHRiYWNrZW5kcy5wdXNoKFwicG5hY2xcIik7XHJcblx0fVxyXG5cdGlmIChoYXNGZWF0dXJlKFwiYXNtLmpzXCIpKSB7XHJcblx0XHRiYWNrZW5kcy5wdXNoKFwiYXNtLmpzXCIpO1xyXG5cdH1cclxuXHRiYWNrZW5kcy5wdXNoKFwiamF2YXNjcmlwdFwiKTtcclxuXHRyZXR1cm4gYmFja2VuZHM7XHJcbn07XHJcblxyXG4vKipcclxuICogRGV0ZWN0cyB3aGV0aGVyIHRoZSByZXF1ZXN0ZWQgY29tcHV0aW5nIGZlYXR1cmUgaXMgYXZhaWxhYmxlXHJcbiAqXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBoYXNGZWF0dXJlXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0gYW4gaWRlbnRpZmllciBvZiB0aGUgb3B0aW9uYWwgZmVhdHVyZSB0byBkZXRlY3QuIFRoZSBmb2xsb3dpbmcgaWRlbnRpZmllcnMgYXJlIHN1cHBvcnRlZDpcclxuICpcclxuICogICAgIDx0YWJsZT5cclxuICogICAgICAgICA8dHI+XHJcbiAqICAgICAgICAgICAgIDx0aD5GZWF0dXJlIElkZW50aWZpZXI8L3RoPlxyXG4gKiAgICAgICAgICAgICA8dGg+SW50ZXJwcmV0YXRpb248L3RoPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJhc20uanNcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5EZXRlY3QgaWYgdGhlIEphdmFTY3JpcHQgZW5naW5lIHJlY29nbml6ZXMgQXNtLmpzIGRpcmVjdGl2ZS48L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJzaW1kLmpzXCI8L3RkPlxyXG4gKiAgICAgICAgICAgICA8dGQ+RGV0ZWN0IGlmIHRoZSBKYXZhU2NyaXB0IGVuZ2luZSBwcm92aWRlIFNJTUQuZmxvYXQzMng0LCBTSU1ELmludDMyeDQsIEZsb2F0MzJ4NEFycmF5LCBhbmQgSW50MzJ4NEFycmF5IG9mIFNJTUQuanM8L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJ3ZWJnbFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPkRldGVjdCBpZiB0aGUgYnJvd3NlciBzdXBwb3J0cyBXZWJHTCAoZWl0aGVyIGV4cGVyaW1lbnRhbCBvciBzdGFibGUgaW1wbGVtZW50YXRpb24pPC90ZD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwid2ViY2xcIjwvdGQ+XHJcbiAqICAgICAgICAgICAgIDx0ZD5EZXRlY3QgaWYgdGhlIGJyb3dzZXIgc3VwcG9ydHMgV2ViQ0w8L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICAgICAgPHRyPlxyXG4gKiAgICAgICAgICAgICA8dGQ+XCJwbmFjbFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPkRldGVjdCBpZiBQb3J0YWJsZSBOYXRpdmUgQ2xpZW50IChQTmFDbCkgaXMgc3VwcG9ydGVkIGFuZCBlbmFibGVkPC90ZD5cclxuICogICAgICAgICA8L3RyPlxyXG4gKiAgICAgICAgIDx0cj5cclxuICogICAgICAgICAgICAgPHRkPlwibmFjbFwiPC90ZD5cclxuICogICAgICAgICAgICAgPHRkPkRldGVjdCBpZiBOYXRpdmUgQ2xpZW50IChOYUNsKSBpcyBzdXBwb3J0ZWQgYW5kIGVuYWJsZWQ8L3RkPlxyXG4gKiAgICAgICAgIDwvdHI+XHJcbiAqICAgICA8L3RhYmxlPlxyXG4gKlxyXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIHRydWUgaWYgdGhlIGZlYXR1cmUgaXMgc3VwcG9ydGVkLCBmYWxzZSBvdGhlcndpc2VcclxuICovXHJcbnZhciBoYXNGZWF0dXJlID0gZnVuY3Rpb24obmFtZSkge1xyXG5cdHN3aXRjaCAobmFtZSkge1xyXG5cdFx0Y2FzZSBcImFzbS5qc1wiOlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHZhciB1c2VyQWdlbnQgPSB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudDtcclxuXHRcdFx0XHR2YXIgdXNlckFnZW50Q29tcG9uZW50cyA9IHVzZXJBZ2VudC5zcGxpdCgvXFxzKy8pO1xyXG5cdFx0XHRcdHZhciBmaXJlZm94UmVnZXhwID0gL1tGZl1pcmVmb3hcXC8oXFxkKykvZztcclxuXHRcdFx0XHRmb3IgKHZhciBjb21wb25lbnQgaW4gdXNlckFnZW50Q29tcG9uZW50cykge1xyXG5cdFx0XHRcdFx0dmFyIG1hdGNoID0gZmlyZWZveFJlZ2V4cC5leGVjKGNvbXBvbmVudCk7XHJcblx0XHRcdFx0XHRpZiAobWF0Y2ggIT09IG51bGwpIHtcclxuXHRcdFx0XHRcdFx0dmFyIGZpcmVmb3hWZXJzaW9uID0gcGFyc2VJbnQobWF0Y2hbMF0pO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gZmlyZWZveFZlcnNpb24gPj0gMjk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdGNhc2UgXCJzaW1kLmpzXCI6XHJcblx0XHRcdHJldHVybiAodHlwZW9mIFNJTUQgIT09IFwidW5kZWZpbmVkXCIpO1xyXG5cdFx0Y2FzZSBcIndlYmdsXCI6XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGlmIChjYW52YXMuZ2V0Q29udGV4dChcIndlYmdsXCIpICE9PSBudWxsKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGlmIChjYW52YXMuZ2V0Q29udGV4dChcImV4cGVyaW1lbnRhbC13ZWJnbFwiKSAhPT0gbnVsbCkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0Y2FzZSBcIndlYmNsXCI6XHJcblx0XHRcdGlmICh0eXBlb2Ygd2ViY2wgIT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0dmFyIHBsYXRmb3JtcyA9IHdlYmNsLmdldFBsYXRmb3JtcygpO1xyXG5cdFx0XHRcdFx0cmV0dXJuIHBsYXRmb3Jtcy5sZW5ndGggPj0gMTtcclxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBXZWJDTCAhPT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHR2YXIgd2ViY2wgPSBuZXcgV2ViQ0woKTtcclxuXHRcdFx0XHRcdHZhciBwbGF0Zm9ybXMgPSB3ZWJjbC5nZXRQbGF0Zm9ybXMoKTtcclxuXHRcdFx0XHRcdHJldHVybiBwbGF0Zm9ybXMubGVuZ3RoID49IDE7XHJcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRjYXNlIFwicG5hY2xcIjpcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRyZXR1cm4gKHR5cGVvZiBuYXZpZ2F0b3IubWltZVR5cGVzW1wiYXBwbGljYXRpb24veC1wbmFjbFwiXSkgIT09IFwidW5kZWZpbmVkXCI7XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRjYXNlIFwibmFjbFwiOlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHJldHVybiAodHlwZW9mIG5hdmlnYXRvci5taW1lVHlwZXNbXCJhcHBsaWNhdGlvbi94LW5hY2xcIl0pICE9PSBcInVuZGVmaW5lZFwiO1xyXG5cdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0ZGVmYXVsdDpcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBmZWF0dXJlOiBcIiArIG5hbWUpO1xyXG5cdH1cclxufTtcclxuXHJcbmV4cG9ydHMuaW5pdCA9IGluaXQ7XHJcbmV4cG9ydHMuaGFzRmVhdHVyZSA9IGhhc0ZlYXR1cmU7XHJcbmV4cG9ydHMuZ2V0RGVmYXVsdEJhY2tlbmQgPSBnZXREZWZhdWx0QmFja2VuZDtcclxuZXhwb3J0cy5nZXRTdXBwb3J0ZWRCYWNrZW5kcyA9IGdldFN1cHBvcnRlZEJhY2tlbmRzO1xyXG5leHBvcnRzLkRhdGFUeXBlID0gRGF0YVR5cGU7XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5cclxuLyoqXHJcbiAqIFByb3ZpZGVzIGhlbHBlciBmdW5jdGlvbnNcclxuICpcclxuICogQHByaXZhdGVcclxuICogQGNsYXNzIHV0aWxcclxuICovXHJcblxyXG52YXIgaXNOdW1iZXIgPSBmdW5jdGlvbihuKSB7XHJcblx0cmV0dXJuIG4gPT09ICtuO1xyXG59O1xyXG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XHJcblxyXG52YXIgaXNSZWFsID0gZnVuY3Rpb24obikge1xyXG5cdHJldHVybiAobiA9PT0gK24pICYmIChpc0Zpbml0ZShuKSk7XHJcbn07XHJcbmV4cG9ydHMuaXNSZWFsID0gaXNSZWFsO1xyXG5cclxudmFyIGlzSW50ID0gZnVuY3Rpb24obikge1xyXG5cdHJldHVybiBuID09PSAobnwwKTtcclxufTtcclxuZXhwb3J0cy5pc0ludCA9IGlzSW50O1xyXG5cclxuZXhwb3J0cy5pc1Bvc2l0aXZlSW50ID0gZnVuY3Rpb24obikge1xyXG5cdHJldHVybiAobiA9PT0gK24pICYmIChuID09PSAobnwwKSkgJiYgKG4gPiAwKTtcclxufTtcclxuXHJcbmV4cG9ydHMuaXNOb25OZWdhdGl2ZUludCA9IGZ1bmN0aW9uKG4pIHtcclxuXHRyZXR1cm4gKG4gPT09ICtuKSAmJiAobiA9PT0gKG58MCkpICYmIChuID49IDApO1xyXG59O1xyXG5cclxudmFyIGlzQXJyYXkgPSBmdW5jdGlvbihsaXN0KSB7XHJcblx0cmV0dXJuIGxpc3QgaW5zdGFuY2VvZiBBcnJheTtcclxufTtcclxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcclxuXHJcbmV4cG9ydHMuaXNJbnRBcnJheSA9IGZ1bmN0aW9uKGxpc3QpIHtcclxuXHRpZiAoZXhwb3J0cy5pc0FycmF5KGxpc3QpKSB7XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0aWYgKCFleHBvcnRzLmlzSW50KGxpc3RbaV0pKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufTtcclxuXHJcbmV4cG9ydHMuaXNQb3NpdGl2ZUludEFycmF5ID0gZnVuY3Rpb24obGlzdCkge1xyXG5cdGlmIChleHBvcnRzLmlzQXJyYXkobGlzdCkpIHtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRpZiAoIWV4cG9ydHMuaXNQb3NpdGl2ZUludChsaXN0W2ldKSkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn07XHJcblxyXG5leHBvcnRzLmFzSW50QXJyYXkgPSBmdW5jdGlvbiAobGlzdCkge1xyXG5cdGlmIChleHBvcnRzLmlzSW50KGxpc3QpKSB7XHJcblx0XHRyZXR1cm4gW2xpc3RdO1xyXG5cdH0gZWxzZSBpZiAoZXhwb3J0cy5pc0ludEFycmF5KGxpc3QpKSB7XHJcblx0XHRyZXR1cm4gbGlzdDtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihsaXN0ICsgXCIgY2FuIG5vdCBiZSBjb252ZXJ0ZWQgdG8gaW50ZWdlciBhcnJheVwiKTtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogVmFsaWRhdGUgdGhlIHNoYXBlIGFyZ3VtZW50LlxyXG4gKiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIGFyZ3VtZW50IHJlcHJlc2VudHMgYSB2YWxpZCBzaGFwZS5cclxuICogUmV0dXJucyB0aGUgc2hhcGUgYXMgYW4gaW50ZWdlciBhcnJheS5cclxuICpcclxuICogQHBhcmFtIHsoTnVtYmVyfE51bWJlcltdKX0gc2hhcGUgLSB0aGUgc2hhcGUgYXJndW1lbnQgdG8gdmFsaWRhdGUuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqICAgICBzaGFwZSA9IHV0aWwuY2hlY2tTaGFwZShzaGFwZSk7XHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZCBjaGVja1NoYXBlXHJcbiAqL1xyXG52YXIgY2hlY2tTaGFwZSA9IGZ1bmN0aW9uKHNoYXBlKSB7XHJcblx0aWYgKGlzTnVtYmVyKHNoYXBlKSkge1xyXG5cdFx0cmV0dXJuIGNoZWNrU2hhcGUoW3NoYXBlXSk7XHJcblx0fSBlbHNlIGlmIChpc0FycmF5KHNoYXBlKSkge1xyXG5cdFx0dmFyIG4gPSBzaGFwZS5sZW5ndGg7XHJcblx0XHR2YXIgb3V0U2hhcGUgPSBuZXcgQXJyYXkobik7XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykge1xyXG5cdFx0XHRpZiAoIWlzTnVtYmVyKHNoYXBlW2ldKSkge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihcIlNoYXBlIGhhcyBub24tbnVtZXJpYyBkaW1lbnNpb25zXCIpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICghaXNJbnQoc2hhcGVbaV0pKSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiU2hhcGUgbXVzdCBoYXZlIGludGVnZXIgZGltZW5zaW9uc1wiKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoc2hhcGVbaV0gPCAxKSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRGVnZW5lcmF0ZSBzaGFwZVwiKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRvdXRTaGFwZVtpXSA9IHNoYXBlW2ldfDA7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gb3V0U2hhcGU7XHJcblx0fVxyXG59O1xyXG5leHBvcnRzLmNoZWNrU2hhcGUgPSBjaGVja1NoYXBlO1xyXG5cclxuLyoqXHJcbiAqIENoZWNrcyB0aGF0IHRoZSB0d28gc2hhcGVzIGFyZSBzaW1pbGFyLlxyXG4gKiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIHR3byBzaGFwZXMgYXJlIGRpZmZlcmVudC5cclxuICogSWYgdGhlIGRhdGEgdHlwZXMgYXJlIGNvbXBhdGlibGUsIHRoZSBmdW5jdGlvbiBkb2VzIG5vdGhpbmcuXHJcbiAqXHJcbiAqIEBwYXJhbSB7TnVtYmVyW119IHNoYXBlQSAtIG9uZSB2YWxpZCBzaGFwZSB0byBjb21wYXJlLlxyXG4gKiBAcGFyYW0ge051bWJlcltdfSBzaGFwZUIgLSBhbm90aGVyIHZhbGlkIHNoYXBlIHRvIGNvbXBhcmUuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqICAgICB1dGlsLmNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eShhLnNoYXBlLCBiLnNoYXBlKTtcclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGNoZWNrU2hhcGVzQ29tcGF0aWJpbGl0eVxyXG4gKi9cclxuZXhwb3J0cy5jaGVja1NoYXBlc0NvbXBhdGliaWxpdHkgPSBmdW5jdGlvbihzaGFwZUEsIHNoYXBlQikge1xyXG5cdGlmIChzaGFwZUEubGVuZ3RoICE9IHNoYXBlQi5sZW5ndGgpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihcIlRoZSBzaGFwZXMgaGF2ZSBkaWZmZXJlbnQgZGltZW5zaW9uc1wiKTtcclxuXHR9XHJcblx0dmFyIG4gPSBzaGFwZUEubGVuZ3RoO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSB7XHJcblx0XHRpZiAoc2hhcGVBW2ldICE9IHNoYXBlQltpXSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJUaGUgc2hhcGVzIGFyZSBkaWZmZXJlbnRcIik7XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIGFycmF5IGxlbmd0aCBmcm9tIGl0cyBzaGFwZS5cclxuICpcclxuICogQHBhcmFtIHtOdW1iZXJbXX0gc2hhcGUgLSBhbiBhcnJheSBzaGFwZS4gIFRoZSBzaGFwZSBtdXN0IGJlIHZhbGlkIHcuci50LiAqKmNoZWNrU2hhcGUqKiBmdW5jdGlvbi5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIHZhciBsZW5ndGggPSB1dGlsLmNvbXB1dGVMZW5ndGgoc2hhcGUpO1xyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgY29tcHV0ZUxlbmd0aFxyXG4gKi9cclxuZXhwb3J0cy5jb21wdXRlTGVuZ3RoID0gZnVuY3Rpb24oc2hhcGUpIHtcclxuXHR2YXIgbGVuZ3RoID0gMTtcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IHNoYXBlLmxlbmd0aDsgKytpKSB7XHJcblx0XHRsZW5ndGggKj0gc2hhcGVbaV07XHJcblx0fVxyXG5cdHJldHVybiBsZW5ndGg7XHJcbn07XHJcblxyXG4vKipcclxuICogQ2hlY2tzIHRoZSB0aGUgYXJndW1lbnQgcmVwcmVzZW50cyBhIGRhdGEgdHlwZS5cclxuICogVGhyb3dzIGFuIGVycm9yIGlmIHRoZSBhcmd1bWVudCBpcyBub3Qgb2YgRGF0YVR5cGUgdHlwZS5cclxuICogSWYgdGhlIGFyZ3VtZW50IGlzIGEgRGF0YVR5cGUgb2JqZWN0LCB0aGUgZnVuY3Rpb24gZG9lcyBub3RoaW5nLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0RhdGFUeXBlfSBkYXRhVHlwZSAtIHRoZSBleHBlY3RlZGx5IGRhdGEgdHlwZSBvYmplY3QgdG8gdmFsaWRhdGUuXHJcbiAqIEByZXR1cm4ge0RhdGFUeXBlfSAtIGEgZGF0YSB0eXBlIG9iamVjdCBlcXVpdmFsZW50IHRvIHRoZSBhcmd1bWVudC5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIGRhdGFUeXBlID0gdXRpbC5jaGVja0RhdGFUeXBlKGRhdGFUeXBlKTtcclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGNoZWNrRGF0YVR5cGVcclxuICovXHJcbmV4cG9ydHMuY2hlY2tEYXRhVHlwZSA9IGZ1bmN0aW9uKGRhdGFUeXBlKSB7XHJcblx0dmFyIERhdGFUeXBlID0gcmVxdWlyZShcIi4vRGF0YVR5cGVcIik7XHJcblx0aWYgKCEoZGF0YVR5cGUgaW5zdGFuY2VvZiBEYXRhVHlwZSkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJkYXRhVHlwZSBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgRGF0YVR5cGVcIik7XHJcblx0fVxyXG5cdHJldHVybiBkYXRhVHlwZTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDaGVja3MgdGhhdCB0aGUgdHdvIGRhdGEgdHlwZXMgYXJlIGNvbXBhdGlibGUuXHJcbiAqIFRocm93cyBhbiBlcnJvciBpZiB0aGUgZGF0YSB0eXBlcyBkbyBub3QgbWF0Y2guXHJcbiAqIElmIHRoZSBkYXRhIHR5cGVzIGFyZSBjb21wYXRpYmxlLCB0aGUgZnVuY3Rpb24gZG9lcyBub3RoaW5nLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0RhdGFUeXBlfSBkYXRhVHlwZUEgLSB0aGUgZmlyc3QgZGF0YSB0eXBlLlxyXG4gKiBAcGFyYW0ge0RhdGFUeXBlfSBkYXRhVHlwZUIgLSB0aGUgc2Vjb25kIGRhdGEgdHlwZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIHV0aWwuY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5KGEuZGF0YVR5cGUsIGIuZGF0YVR5cGUpO1xyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgY2hlY2tEYXRhVHlwZXNDb21wYXRpYmlsaXR5XHJcbiAqL1xyXG5leHBvcnRzLmNoZWNrRGF0YVR5cGVzQ29tcGF0aWJpbGl0eSA9IGZ1bmN0aW9uKGRhdGFUeXBlQSwgZGF0YVR5cGVCKSB7XHJcblx0aWYgKCFkYXRhVHlwZUEuZXF1YWxzKGRhdGFUeXBlQikpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihcIlRoZSBkYXRhIHR5cGVzIGFyZSBub3QgY29tcGF0aWJsZVwiKTtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogVmFsaWRhdGVzIGFuIE5EQXJyYXkgcGFyYW1ldGVyLlxyXG4gKiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIGV4cGVjdGVkIE5EQXJyYXkgYXJndW1lbnQgaGFzIG90aGVyIHR5cGUgb3IgaWYgaXQgaGFzIGJlZW4gaW52YWxpZGF0ZWQuXHJcbiAqIElmIHRoZSBhcmd1bWVudCBpcyBhIHZhbGlkIE5EQXJyYXksIHRoZSBmdW5jdGlvbiBkb2VzIG5vdGhpbmcuXHJcbiAqXHJcbiAqIEBwYXJhbSB7TkRBcnJheX0gYXJyYXkgLSB0aGUgZXhwZWN0ZWRseSBOREFycmF5IGFyZ3VtZW50IHRvIGJlIHZhbGlkYXRlZC5cclxuICogQHBhcmFtIHtTdHJpbmd9IHZhbmFtZSAtIHRoZSBuYW1lIG9mIHRoZSBOREFycmF5IGFyZ3VtZW50IHRvIGJlIHVzZWQgaW4gZXJyb3IgbWVzc2FnZXMuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqICAgICB1dGlsLmNoZWNrTkRBcnJheShvdXQsIFwib3V0XCIpO1xyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2QgY2hlY2tOREFycmF5XHJcbiAqL1xyXG5leHBvcnRzLmNoZWNrTkRBcnJheSA9IGZ1bmN0aW9uKGFycmF5LCB2YXJuYW1lKSB7XHJcblx0dmFyIE5EQXJyYXkgPSByZXF1aXJlKFwiLi9OREFycmF5XCIpO1xyXG5cdGlmICghKGFycmF5IGluc3RhbmNlb2YgTkRBcnJheSkpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IodmFybmFtZSArIFwiIGlzIG5vdCBhbiBOREFycmF5XCIpO1xyXG5cdH1cclxuXHRpZiAoIWFycmF5LmlzVmFsaWQoKSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKHZhcm5hbWUgKyBcIiBpcyBhbiBpbnZhbGlkYXRlZCBhcnJheVwiKTtcclxuXHR9XHJcbn07XHJcblxyXG4vKipcclxuICogVmFsaWRhdGVzICoqcmVwZWF0cyoqIHBhcmFtZXRlciBmb3IgcmVwZWF0aXRpb24vdGlsaW5nIG9mIGFycmF5IGFsb25nIGFuIGF4aXMuXHJcbiAqIFRocm93cyBhbiBlcnJvciBpZiAqKnJlcGVhdHMqKiBpcyBub3QgYW4gaW50ZWdlciBvciBpZiAqKnJlcGVhdHMqKiBpcyBzbWFsbGVyIHRoYW4gMi5cclxuICogSWYgKipyZXBlYXRzKiogaXMgdmFsaWQsIHRoZSBmdW5jdGlvbiBkb2VzIG5vdGhpbmcuXHJcbiAqXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSByZXBlYXRzIC0gdGhlIHJlcGVhdHMgYXJndW1lbnQgdG8gYmUgdmVyaWZpZWQuXHJcbiAqIEByZXR1cm4ge051bWJlcn0gLSAqKnJlcGVhdHMqKiBjYXN0ZWQgdG8gaW50ZWdlci5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIHJlcGVhdHMgPSB1dGlsLmNoZWNrUmVwZWF0cyhyZXBlYXRzKTtcclxuICpcclxuICogQHByaXZhdGVcclxuICogQHN0YXRpY1xyXG4gKiBAbWV0aG9kIGNoZWNrUmVwZWF0c1xyXG4gKi9cclxuZXhwb3J0cy5jaGVja1JlcGVhdHMgPSBmdW5jdGlvbihyZXBlYXRzKSB7XHJcblx0aWYgKCFpc0ludChyZXBlYXRzKSkge1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlJlcGVhdHMgaXMgbm90IGFuIGludGVnZXJcIik7XHJcblx0fVxyXG5cdGlmIChyZXBlYXRzIDw9IDEpIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiUmVwZWF0cyBzaG91bGQgYmUgZ3JlYXRlciB0aGFuIDFcIik7XHJcblx0fVxyXG5cdHJldHVybiByZXBlYXRzfDA7XHJcbn07XHJcblxyXG4vKipcclxuICogVmFsaWRhdGVzIGF4aXMgcGFyYW1ldGVyIGZvciByZWR1Y3Rpb25zIGFsb25nIGFuIGF4aXMuXHJcbiAqIFRocm93cyBhbiBlcnJvciBpZiBheGlzIGlzIG5vdCBhbiBpbnRlZ2VyLCBpZiBheGlzIGlzIG5lZ2F0aXZlLCBvciBheGlzIGV4Y2VlZHMgdGhlIG51bWJlciBvZiBkaW1lbnNpb25zLlxyXG4gKiBJZiBheGlzIGlzIHZhbGlkLCB0aGUgZnVuY3Rpb24gZG9lcyBub3RoaW5nLlxyXG4gKlxyXG4gKiBAcGFyYW0ge051bWJlcn0gYXhpcyAtIHRoZSBheGlzIGFyZ3VtZW50IHRvIGJlIHZlcmlmaWVkLlxyXG4gKiBAcGFyYW0ge051bWJlcn0gbnVtRGltZW5zaW9ucyAtIHRoZSBudW1iZXIgb2YgZGltZW5zaW9ucyBpbiB0aGUgYXJyYXkgYmVpbmcgcmVkdWNlZC5cclxuICogQHJldHVybiB7TnVtYmVyfSAtIGF4aXMgY2FzdGVkIHRvIGludGVnZXIuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqICAgICBheGlzID0gdXRpbC5jaGVja0F4aXMoYXhpcywgbmRhcnJheS5zaGFwZS5sZW5ndGgpO1xyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2RcclxuICovXHJcbmV4cG9ydHMuY2hlY2tBeGlzID0gZnVuY3Rpb24oYXhpcywgbnVtRGltZW5zaW9ucykge1xyXG5cdGlmICghaXNJbnQoYXhpcykpIHtcclxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoXCJBeGlzIGlzIG5vdCBhbiBpbnRlZ2VyXCIpO1xyXG5cdH1cclxuXHRpZiAoYXhpcyA8IDApIHtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKFwiQXhpcyBpcyBuZWdhdGl2ZVwiKTtcclxuXHR9XHJcblx0LyogRS5nLiAzLWRpbWVuc2lvbmFsIGFycmF5IGhhcyBheGVzIDAsIDEsIDIgKGJ1dCBub3QgMyEpICovXHJcblx0aWYgKGF4aXMgPj0gbnVtRGltZW5zaW9ucykge1xyXG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJBeGlzIG91dCBvZiByYW5nZVwiKTtcclxuXHR9XHJcblx0cmV0dXJuIGF4aXN8MDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBWYWxpZGF0ZXMgdGhlIHNoYXBlIG9mIG91dHB1dCBhcnJheSBmb3IgcmVkdWN0aW9ucyBhbG9uZyBhbiBheGlzLlxyXG4gKiBUaHJvd3MgYW4gZXJyb3IgaWYgdGhlIHNoYXBlIG9mIHRoZSBvdXRwdXQgYXJyYXkgZG9lcyBtYXRjaCB0aGUgc2hhcGUgb2YgaW5wdXQgYXJyYXkgYWZ0ZXIgcmVkdWN0aW9uIGFsb25nIHRoZSBheGlzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge051bWJlcltdfSBpblNoYXBlIC0gdGhlIHNoYXBlIG9mIHRoZSBpbnB1dCBhcnJheS5cclxuICogQHBhcmFtIHtOdW1iZXJbXX0gb3V0U2hhcGUgLSB0aGUgc2hhcGUgb2YgdGhlIG91dHB1dCBhcnJheSB0byBiZSB2YWxpZGF0ZWQuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgZm9yIHJlZHVjdGlvbiBvZiBpbnB1dCBhcnJheS4gTXVzdCBiZSB2YWxpZCB3LnIudC4gaW5TaGFwZS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIHV0aWwuY2hlY2tBeGlzUmVkdWN0aW9uT3V0U2hhcGUoaW5BcnJheS5zaGFwZSwgb3V0QXJyYXkuc2hhcGUsIGF4aXMpO1xyXG4gKlxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAc3RhdGljXHJcbiAqIEBtZXRob2RcclxuICovXHJcbmV4cG9ydHMuY2hlY2tBeGlzUmVkdWN0aW9uT3V0U2hhcGUgPSBmdW5jdGlvbihpblNoYXBlLCBvdXRTaGFwZSwgYXhpcykge1xyXG5cdGlmIChpblNoYXBlLmxlbmd0aCAhPT0gb3V0U2hhcGUubGVuZ3RoICsgMSkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiT3V0cHV0IGFycmF5IGhhcyBpbnZhbGlkIG51bWJlciBvZiBkaW1lbnNpb25zIGZvciB0aGlzIG9wZXJhdGlvblwiKTtcclxuXHR9XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBheGlzOyArK2kpIHtcclxuXHRcdGlmIChpblNoYXBlW2ldICE9PSBvdXRTaGFwZVtpXSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJPdXRwdXQgYXJyYXkgaGFzIGludmFsaWQgc2hhcGUgZm9yIHRoaXMgb3BlcmF0aW9uXCIpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRmb3IgKHZhciBpID0gYXhpcyArIDE7IGkgPCBpblNoYXBlLmxlbmd0aDsgKytpKSB7XHJcblx0XHRpZiAoaW5TaGFwZVtpXSAhPT0gb3V0U2hhcGVbaS0xXSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJPdXRwdXQgYXJyYXkgaGFzIGludmFsaWQgc2hhcGUgZm9yIHRoaXMgb3BlcmF0aW9uXCIpO1xyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDb21wdXRlcyB0aGUgc2hhcGUgb2YgYW4gYXJyYXkgYWZ0ZXIgcmVkdWN0aW9uIGFsb25nIGFuIGF4aXMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7TnVtYmVyW119IGluU2hhcGUgLSB0aGUgc2hhcGUgb2YgdGhlIGlucHV0IGFycmF5LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gYXhpcyAtIHRoZSBheGlzIGZvciByZWR1Y3Rpb24gb2YgaW5wdXQgYXJyYXkuIE11c3QgYmUgdmFsaWQgdy5yLnQuIGluU2hhcGUuXHJcbiAqIEByZXR1cm4ge051bWJlcltdfSAtIHRoZSBzaGFwZSBvZiB0aGUgb3V0cHV0IGFycmF5LlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiAgICAgdmFyIG91dFNoYXBlID0gdXRpbC5nZXRBeGlzUmVkdWN0aW9uT3V0U2hhcGUoaW5BcnJheS5zaGFwZSwgYXhpcyk7XHJcbiAqICAgICB2YXIgb3V0QXJyYXkgPSBuZXcgTkRBcnJheShvdXRTaGFwZSwgaW5BcnJheS5kYXRhVHlwZSwgY29udGV4dCk7XHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZFxyXG4gKi9cclxuZXhwb3J0cy5jb21wdXRlQXhpc1JlZHVjdGlvbk91dFNoYXBlID0gZnVuY3Rpb24oaW5TaGFwZSwgYXhpcykge1xyXG5cdHZhciBvdXRTaGFwZSA9IFtdO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgaW5TaGFwZS5sZW5ndGg7ICsraSkge1xyXG5cdFx0aWYgKGkgIT09IGF4aXMpIHtcclxuXHRcdFx0b3V0U2hhcGUucHVzaChpblNoYXBlW2ldKTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIG91dFNoYXBlO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENvbXB1dGVzIHRoZSBwcm9kdWN0IG9mIGFycmF5IGRpbWVuc2lvbnMgYmVmb3JlIHRoZSBheGlzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge051bWJlcltdfSBzaGFwZSAtIHRoZSBzaGFwZSBvZiB0aGUgYXJyYXkuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBheGlzIC0gdGhlIGF4aXMgdXNlZCBpbiBhbiBvcGVyYXRpb24uIE11c3QgYmUgdmFsaWQgdy5yLnQuIHNoYXBlLlxyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IC0gdGhlIHByb2R1Y3Qgb2YgYXJyYXkgZGltZW5zaW9ucyBiZWZvcmUgYXhpcy5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIC8vIDUtZGltZW5zaW9uYWwgYXJyYXlcclxuICogICAgIHZhciBuZGFycmF5ID0gY29udGV4dC5lbXB0eShbMiwgMywgNCwgNSwgNl0pO1xyXG4gKiAgICAgLy8gUmV0dXJucyA2ID0gMiozXHJcbiAqICAgICB2YXIgb3V0ZXJTdHJpZGUgPSBjb21wdXRlT3V0ZXJTdHJpZGUobmRhcnJheSwgMik7XHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZFxyXG4gKi9cclxuZXhwb3J0cy5jb21wdXRlT3V0ZXJTdHJpZGUgPSBmdW5jdGlvbihzaGFwZSwgYXhpcykge1xyXG5cdHZhciBvdXRlclN0cmlkZSA9IDE7XHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBheGlzOyArK2kpIHtcclxuXHRcdG91dGVyU3RyaWRlICo9IHNoYXBlW2ldO1xyXG5cdH1cclxuXHRyZXR1cm4gb3V0ZXJTdHJpZGU7XHJcbn07XHJcblxyXG4vKipcclxuICogQ29tcHV0ZXMgdGhlIHByb2R1Y3Qgb2YgYXJyYXkgZGltZW5zaW9ucyBhZnRlciB0aGUgYXhpcy5cclxuICpcclxuICogQHBhcmFtIHtOdW1iZXJbXX0gc2hhcGUgLSB0aGUgc2hhcGUgb2YgdGhlIGFycmF5LlxyXG4gKiBAcGFyYW0ge051bWJlcn0gYXhpcyAtIHRoZSBheGlzIHVzZWQgaW4gYW4gb3BlcmF0aW9uLiBNdXN0IGJlIHZhbGlkIHcuci50LiBzaGFwZS5cclxuICogQHJldHVybiB7TnVtYmVyfSAtIHRoZSBwcm9kdWN0IG9mIGFycmF5IGRpbWVuc2lvbnMgYWZ0ZXIgYXhpcy5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogICAgIC8vIDUtZGltZW5zaW9uYWwgYXJyYXlcclxuICogICAgIHZhciBuZGFycmF5ID0gY29udGV4dC5lbXB0eShbMiwgMywgNCwgNSwgNl0pO1xyXG4gKiAgICAgLy8gUmV0dXJucyA2ID0gMiozXHJcbiAqICAgICB2YXIgaW5uZXJTdHJpZGUgPSBjb21wdXRlSW5uZXJTdHJpZGUobmRhcnJheSwgMik7XHJcbiAqXHJcbiAqIEBwcml2YXRlXHJcbiAqIEBzdGF0aWNcclxuICogQG1ldGhvZFxyXG4gKi9cclxuZXhwb3J0cy5jb21wdXRlSW5uZXJTdHJpZGUgPSBmdW5jdGlvbihzaGFwZSwgYXhpcykge1xyXG5cdHZhciBpbm5lclN0cmlkZSA9IDE7XHJcblx0Zm9yICh2YXIgaSA9IGF4aXMgKyAxOyBpIDwgc2hhcGUubGVuZ3RoOyArK2kpIHtcclxuXHRcdGlubmVyU3RyaWRlICo9IHNoYXBlW2ldO1xyXG5cdH1cclxuXHRyZXR1cm4gaW5uZXJTdHJpZGU7XHJcbn07XHJcblxyXG52YXIgZGlzY292ZXJBcnJheVNoYXBlUmVjdXJzaXZlID0gZnVuY3Rpb24oZGF0YSwgc2hhcGUsIGxldmVsKSB7XHJcblx0aWYgKGlzQXJyYXkoZGF0YSkpIHtcclxuXHRcdGlmIChzaGFwZS5sZW5ndGggPD0gbGV2ZWwpIHtcclxuXHRcdFx0LyogRGlzY292ZXJlZCBhIG5ldyBsZXZlbCBvZiBzdWItYXJyYXlzLiBSZWNvcmQgaXRzIGRpbWVuc2lvbi4gKi9cclxuXHRcdFx0c2hhcGUucHVzaChkYXRhLmxlbmd0aCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQvKiBPbmx5IGNoZWNrIGRpbWVuc2lvbiAqL1xyXG5cdFx0XHRpZiAoc2hhcGVbbGV2ZWxdICE9IGRhdGEubGVuZ3RoKSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJTdWItYXJyYXkgXCIgKyBkYXRhICsgXCIgZG9lcyBub3QgbWF0Y2ggdGhlIGV4cGVjdGVkIGRpbWVuc2lvbiBvZiBcIiArIHNoYXBlW2xldmVsXSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRkaXNjb3ZlckFycmF5U2hhcGVSZWN1cnNpdmUoZGF0YVtpXSwgc2hhcGUsIGxldmVsICsgMSk7XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdGlmIChsZXZlbCAhPSBzaGFwZS5sZW5ndGgpIHtcclxuXHRcdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJTdWItYXJyYXkgW1wiICsgZGF0YSArIFwiXSBkb2VzIG5vdCBtYXRjaCB0aGUgZXhwZWN0ZWQgZGltZW5zaW9uIG9mIFwiICsgc2hhcGVbbGV2ZWxdKTtcclxuXHRcdH1cclxuXHRcdGlmICghaXNOdW1iZXIoZGF0YSkpIHtcclxuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIk5vbi1udW1lcmljIGVsZW1lbnQ6IFwiICsgZGF0YSk7XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5leHBvcnRzLmRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZSA9IGRpc2NvdmVyQXJyYXlTaGFwZVJlY3Vyc2l2ZTtcclxuXHJcbnZhciBjb3B5QXJyYXlEYXRhUmVjdXJzaXZlID0gZnVuY3Rpb24oZGF0YUJ1ZmZlciwgZGF0YUFycmF5LCBzaGFwZSwgbGV2ZWwsIG9mZnNldCkge1xyXG5cdHZhciBuID0gc2hhcGVbbGV2ZWxdO1xyXG5cdGlmIChsZXZlbCA9PT0gc2hhcGUubGVuZ3RoIC0gMSkge1xyXG5cdFx0ZGF0YUJ1ZmZlci5zZXQoZGF0YUFycmF5LCBvZmZzZXQgKiBuKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcclxuXHRcdFx0Y29weUFycmF5RGF0YVJlY3Vyc2l2ZShkYXRhQnVmZmVyLCBkYXRhQXJyYXlbaV0sIHNoYXBlLCBsZXZlbCArIDEsIG9mZnNldCAqIG4gICsgaSk7XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5leHBvcnRzLmNvcHlBcnJheURhdGFSZWN1cnNpdmUgPSBjb3B5QXJyYXlEYXRhUmVjdXJzaXZlO1xyXG5cclxudmFyIGNyZWF0ZUFycmF5UmVjdXJzaXZlID0gZnVuY3Rpb24oZGF0YUJ1ZmZlciwgZGF0YUFycmF5LCBzaGFwZSwgbGV2ZWwsIG9mZnNldCkge1xyXG5cdHZhciBuID0gc2hhcGVbbGV2ZWxdO1xyXG5cdGlmIChsZXZlbCA9PT0gc2hhcGUubGVuZ3RoIC0gMSkge1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcclxuXHRcdFx0ZGF0YUFycmF5W2ldID0gZGF0YUJ1ZmZlcltvZmZzZXQgKiBuICsgaV07XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSB7XHJcblx0XHRcdGRhdGFBcnJheVtpXSA9IG5ldyBBcnJheShzaGFwZVtsZXZlbCArIDFdKTtcclxuXHRcdFx0Y3JlYXRlQXJyYXlSZWN1cnNpdmUoZGF0YUJ1ZmZlciwgZGF0YUFycmF5W2ldLCBzaGFwZSwgbGV2ZWwgKyAxLCBvZmZzZXQgKiBuICArIGkpO1xyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuZXhwb3J0cy5jcmVhdGVBcnJheVJlY3Vyc2l2ZSA9IGNyZWF0ZUFycmF5UmVjdXJzaXZlO1xyXG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5fdXNlVHlwZWRBcnJheXNgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAoY29tcGF0aWJsZSBkb3duIHRvIElFNilcbiAqL1xuQnVmZmVyLl91c2VUeXBlZEFycmF5cyA9IChmdW5jdGlvbiAoKSB7XG4gIC8vIERldGVjdCBpZiBicm93c2VyIHN1cHBvcnRzIFR5cGVkIEFycmF5cy4gU3VwcG9ydGVkIGJyb3dzZXJzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssXG4gIC8vIENocm9tZSA3KywgU2FmYXJpIDUuMSssIE9wZXJhIDExLjYrLCBpT1MgNC4yKy4gSWYgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBhZGRpbmdcbiAgLy8gcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLCB0aGVuIHRoYXQncyB0aGUgc2FtZSBhcyBubyBgVWludDhBcnJheWAgc3VwcG9ydFxuICAvLyBiZWNhdXNlIHdlIG5lZWQgdG8gYmUgYWJsZSB0byBhZGQgYWxsIHRoZSBub2RlIEJ1ZmZlciBBUEkgbWV0aG9kcy4gVGhpcyBpcyBhbiBpc3N1ZVxuICAvLyBpbiBGaXJlZm94IDQtMjkuIE5vdyBmaXhlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4XG4gIHRyeSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcigwKVxuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gNDIgPT09IGFyci5mb28oKSAmJlxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nIC8vIENocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcsIG5vWmVybykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZywgbm9aZXJvKVxuXG4gIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3RcblxuICAvLyBXb3JrYXJvdW5kOiBub2RlJ3MgYmFzZTY0IGltcGxlbWVudGF0aW9uIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBzdHJpbmdzXG4gIC8vIHdoaWxlIGJhc2U2NC1qcyBkb2VzIG5vdC5cbiAgaWYgKGVuY29kaW5nID09PSAnYmFzZTY0JyAmJiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIHN1YmplY3QgPSBzdHJpbmd0cmltKHN1YmplY3QpXG4gICAgd2hpbGUgKHN1YmplY3QubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgICAgc3ViamVjdCA9IHN1YmplY3QgKyAnPSdcbiAgICB9XG4gIH1cblxuICAvLyBGaW5kIHRoZSBsZW5ndGhcbiAgdmFyIGxlbmd0aFxuICBpZiAodHlwZSA9PT0gJ251bWJlcicpXG4gICAgbGVuZ3RoID0gY29lcmNlKHN1YmplY3QpXG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKVxuICAgIGxlbmd0aCA9IEJ1ZmZlci5ieXRlTGVuZ3RoKHN1YmplY3QsIGVuY29kaW5nKVxuICBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0JylcbiAgICBsZW5ndGggPSBjb2VyY2Uoc3ViamVjdC5sZW5ndGgpIC8vIGFzc3VtZSB0aGF0IG9iamVjdCBpcyBhcnJheS1saWtlXG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpcnN0IGFyZ3VtZW50IG5lZWRzIHRvIGJlIGEgbnVtYmVyLCBhcnJheSBvciBzdHJpbmcuJylcblxuICB2YXIgYnVmXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgLy8gUHJlZmVycmVkOiBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGJ1ZiA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gVEhJUyBpbnN0YW5jZSBvZiBCdWZmZXIgKGNyZWF0ZWQgYnkgYG5ld2ApXG4gICAgYnVmID0gdGhpc1xuICAgIGJ1Zi5sZW5ndGggPSBsZW5ndGhcbiAgICBidWYuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKEJ1ZmZlci5fdXNlVHlwZWRBcnJheXMgJiYgdHlwZW9mIHN1YmplY3QuYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpIHtcbiAgICAvLyBTcGVlZCBvcHRpbWl6YXRpb24gLS0gdXNlIHNldCBpZiB3ZSdyZSBjb3B5aW5nIGZyb20gYSB0eXBlZCBhcnJheVxuICAgIGJ1Zi5fc2V0KHN1YmplY3QpXG4gIH0gZWxzZSBpZiAoaXNBcnJheWlzaChzdWJqZWN0KSkge1xuICAgIC8vIFRyZWF0IGFycmF5LWlzaCBvYmplY3RzIGFzIGEgYnl0ZSBhcnJheVxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdWJqZWN0KSlcbiAgICAgICAgYnVmW2ldID0gc3ViamVjdC5yZWFkVUludDgoaSlcbiAgICAgIGVsc2VcbiAgICAgICAgYnVmLndyaXRlSW50OChzdWJqZWN0W2ldLCBpKVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGJ1Zi53cml0ZShzdWJqZWN0LCAwLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiAhQnVmZmVyLl91c2VUeXBlZEFycmF5cyAmJiAhbm9aZXJvKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZbaV0gPSAwXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG4vLyBTVEFUSUMgTUVUSE9EU1xuLy8gPT09PT09PT09PT09PT1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIChiKSB7XG4gIHJldHVybiAhIShiICE9PSBudWxsICYmIGIgIT09IHVuZGVmaW5lZCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmJ5dGVMZW5ndGggPSBmdW5jdGlvbiAoc3RyLCBlbmNvZGluZykge1xuICB2YXIgcmV0XG4gIHN0ciA9IHN0ci50b1N0cmluZygpXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICAgIHJldCA9IHN0ci5sZW5ndGggLyAyXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldCA9IHV0ZjhUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRUb0J5dGVzKHN0cikubGVuZ3RoXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSBzdHIubGVuZ3RoICogMlxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGVuY29kaW5nJylcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiAobGlzdCwgdG90YWxMZW5ndGgpIHtcbiAgYXNzZXJ0KGlzQXJyYXkobGlzdCksICdVc2FnZTogQnVmZmVyLmNvbmNhdChsaXN0WywgbGVuZ3RoXSknKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH0gZWxzZSBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gbGlzdFswXVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKHRvdGFsTGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICB0b3RhbExlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgdG90YWxMZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcih0b3RhbExlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gIGFzc2VydChCdWZmZXIuaXNCdWZmZXIoYSkgJiYgQnVmZmVyLmlzQnVmZmVyKGIpLCAnQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gTWF0aC5taW4oeCwgeSk7IGkgPCBsZW4gJiYgYVtpXSA9PT0gYltpXTsgaSsrKSB7fVxuICBpZiAoaSAhPT0gbGVuKSB7XG4gICAgeCA9IGFbaV1cbiAgICB5ID0gYltpXVxuICB9XG4gIGlmICh4IDwgeSkge1xuICAgIHJldHVybiAtMVxuICB9XG4gIGlmICh5IDwgeCkge1xuICAgIHJldHVybiAxXG4gIH1cbiAgcmV0dXJuIDBcbn1cblxuLy8gQlVGRkVSIElOU1RBTkNFIE1FVEhPRFNcbi8vID09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgYXNzZXJ0KHN0ckxlbiAlIDIgPT09IDAsICdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgYnl0ZSA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBhc3NlcnQoIWlzTmFOKGJ5dGUpLCAnSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBieXRlXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbiAgcmV0dXJuIGNoYXJzV3JpdHRlblxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuZnVuY3Rpb24gYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgdmFyIGNoYXJzV3JpdHRlbiA9IGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxuICByZXR1cm4gY2hhcnNXcml0dGVuXG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHZhciBjaGFyc1dyaXR0ZW4gPSBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG4gIHJldHVybiBjaGFyc1dyaXR0ZW5cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBTdXBwb3J0IGJvdGggKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKVxuICAvLyBhbmQgdGhlIGxlZ2FjeSAoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpXG4gIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgaWYgKCFpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICB9IGVsc2UgeyAgLy8gbGVnYWN5XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcblxuICB2YXIgcmV0XG4gIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgICAgcmV0ID0gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgICAgcmV0ID0gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIHJldCA9IGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIHJldCA9IGJpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXQgPSBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0ID0gdXRmMTZsZVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZW5jb2RpbmcnKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgc2VsZiA9IHRoaXNcblxuICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZyB8fCAndXRmOCcpLnRvTG93ZXJDYXNlKClcbiAgc3RhcnQgPSBOdW1iZXIoc3RhcnQpIHx8IDBcbiAgZW5kID0gKGVuZCA9PT0gdW5kZWZpbmVkKSA/IHNlbGYubGVuZ3RoIDogTnVtYmVyKGVuZClcblxuICAvLyBGYXN0cGF0aCBlbXB0eSBzdHJpbmdzXG4gIGlmIChlbmQgPT09IHN0YXJ0KVxuICAgIHJldHVybiAnJ1xuXG4gIHZhciByZXRcbiAgc3dpdGNoIChlbmNvZGluZykge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXQgPSBoZXhTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgICByZXQgPSB1dGY4U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYXNjaWknOlxuICAgICAgcmV0ID0gYXNjaWlTbGljZShzZWxmLCBzdGFydCwgZW5kKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdiaW5hcnknOlxuICAgICAgcmV0ID0gYmluYXJ5U2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIHJldCA9IGJhc2U2NFNsaWNlKHNlbGYsIHN0YXJ0LCBlbmQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXQgPSB1dGYxNmxlU2xpY2Uoc2VsZiwgc3RhcnQsIGVuZClcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZycpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChiKSB7XG4gIGFzc2VydChCdWZmZXIuaXNCdWZmZXIoYiksICdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIChiKSB7XG4gIGFzc2VydChCdWZmZXIuaXNCdWZmZXIoYiksICdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uICh0YXJnZXQsIHRhcmdldF9zdGFydCwgc3RhcnQsIGVuZCkge1xuICB2YXIgc291cmNlID0gdGhpc1xuXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICghdGFyZ2V0X3N0YXJ0KSB0YXJnZXRfc3RhcnQgPSAwXG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgc291cmNlLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBhc3NlcnQoZW5kID49IHN0YXJ0LCAnc291cmNlRW5kIDwgc291cmNlU3RhcnQnKVxuICBhc3NlcnQodGFyZ2V0X3N0YXJ0ID49IDAgJiYgdGFyZ2V0X3N0YXJ0IDwgdGFyZ2V0Lmxlbmd0aCxcbiAgICAgICd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgYXNzZXJ0KHN0YXJ0ID49IDAgJiYgc3RhcnQgPCBzb3VyY2UubGVuZ3RoLCAnc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChlbmQgPj0gMCAmJiBlbmQgPD0gc291cmNlLmxlbmd0aCwgJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpXG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRfc3RhcnQgPCBlbmQgLSBzdGFydClcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0X3N0YXJ0ICsgc3RhcnRcblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAobGVuIDwgMTAwIHx8ICFCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRfc3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRhcmdldC5fc2V0KHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSwgdGFyZ2V0X3N0YXJ0KVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmVzID0gJydcbiAgdmFyIHRtcCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGlmIChidWZbaV0gPD0gMHg3Rikge1xuICAgICAgcmVzICs9IGRlY29kZVV0ZjhDaGFyKHRtcCkgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgIHRtcCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgIHRtcCArPSAnJScgKyBidWZbaV0udG9TdHJpbmcoMTYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlcyArIGRlY29kZVV0ZjhDaGFyKHRtcClcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHJldHVybiBhc2NpaVNsaWNlKGJ1Ziwgc3RhcnQsIGVuZClcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2kgKyAxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSBjbGFtcChzdGFydCwgbGVuLCAwKVxuICBlbmQgPSBjbGFtcChlbmQsIGxlbiwgbGVuKVxuXG4gIGlmIChCdWZmZXIuX3VzZVR5cGVkQXJyYXlzKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5fYXVnbWVudCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpKVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgdmFyIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZCwgdHJ1ZSlcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgICByZXR1cm4gbmV3QnVmXG4gIH1cbn1cblxuLy8gYGdldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLmdldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMucmVhZFVJbnQ4KG9mZnNldClcbn1cblxuLy8gYHNldGAgd2lsbCBiZSByZW1vdmVkIGluIE5vZGUgMC4xMytcbkJ1ZmZlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHYsIG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLnNldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMud3JpdGVVSW50OCh2LCBvZmZzZXQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbmZ1bmN0aW9uIHJlYWRVSW50MTYgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMSA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gcmVhZCBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICB2YXIgdmFsXG4gIGlmIChsaXR0bGVFbmRpYW4pIHtcbiAgICB2YWwgPSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXSA8PCA4XG4gIH0gZWxzZSB7XG4gICAgdmFsID0gYnVmW29mZnNldF0gPDwgOFxuICAgIGlmIChvZmZzZXQgKyAxIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAxXVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZFVJbnQxNih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkVUludDE2KHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiByZWFkVUludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbFxuICBpZiAobGl0dGxlRW5kaWFuKSB7XG4gICAgaWYgKG9mZnNldCArIDIgPCBsZW4pXG4gICAgICB2YWwgPSBidWZbb2Zmc2V0ICsgMl0gPDwgMTZcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCB8PSBidWZbb2Zmc2V0ICsgMV0gPDwgOFxuICAgIHZhbCB8PSBidWZbb2Zmc2V0XVxuICAgIGlmIChvZmZzZXQgKyAzIDwgbGVuKVxuICAgICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXQgKyAzXSA8PCAyNCA+Pj4gMClcbiAgfSBlbHNlIHtcbiAgICBpZiAob2Zmc2V0ICsgMSA8IGxlbilcbiAgICAgIHZhbCA9IGJ1ZltvZmZzZXQgKyAxXSA8PCAxNlxuICAgIGlmIChvZmZzZXQgKyAyIDwgbGVuKVxuICAgICAgdmFsIHw9IGJ1ZltvZmZzZXQgKyAyXSA8PCA4XG4gICAgaWYgKG9mZnNldCArIDMgPCBsZW4pXG4gICAgICB2YWwgfD0gYnVmW29mZnNldCArIDNdXG4gICAgdmFsID0gdmFsICsgKGJ1ZltvZmZzZXRdIDw8IDI0ID4+PiAwKVxuICB9XG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZFVJbnQzMih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkVUludDMyKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsXG4gICAgICAgICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCA8IHRoaXMubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgaWYgKG9mZnNldCA+PSB0aGlzLmxlbmd0aClcbiAgICByZXR1cm5cblxuICB2YXIgbmVnID0gdGhpc1tvZmZzZXRdICYgMHg4MFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTFcbiAgZWxzZVxuICAgIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuZnVuY3Rpb24gcmVhZEludDE2IChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IHJlYWRVSW50MTYoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgdHJ1ZSlcbiAgdmFyIG5lZyA9IHZhbCAmIDB4ODAwMFxuICBpZiAobmVnKVxuICAgIHJldHVybiAoMHhmZmZmIC0gdmFsICsgMSkgKiAtMVxuICBlbHNlXG4gICAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRJbnQxNih0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHJlYWRJbnQxNih0aGlzLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gcmVhZEludDMyIChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgdmFyIHZhbCA9IHJlYWRVSW50MzIoYnVmLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgdHJ1ZSlcbiAgdmFyIG5lZyA9IHZhbCAmIDB4ODAwMDAwMDBcbiAgaWYgKG5lZylcbiAgICByZXR1cm4gKDB4ZmZmZmZmZmYgLSB2YWwgKyAxKSAqIC0xXG4gIGVsc2VcbiAgICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZEludDMyKHRoaXMsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZEludDMyKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiByZWFkRmxvYXQgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCArIDMgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgcmV0dXJuIGllZWU3NTQucmVhZChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkRmxvYXQodGhpcywgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkRmxvYXQodGhpcywgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHJlYWREb3VibGUgKGJ1Ziwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCArIDcgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHJlYWQgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICB9XG5cbiAgcmV0dXJuIGllZWU3NTQucmVhZChidWYsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiAob2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gcmVhZERvdWJsZSh0aGlzLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiByZWFkRG91YmxlKHRoaXMsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZilcbiAgfVxuXG4gIGlmIChvZmZzZXQgPj0gdGhpcy5sZW5ndGgpIHJldHVyblxuXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIHdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAndHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnVpbnQodmFsdWUsIDB4ZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAgICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICd0cnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmdWludCh2YWx1ZSwgMHhmZmZmZmZmZilcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4obGVuIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9XG4gICAgICAgICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0IDwgdGhpcy5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZiwgLTB4ODApXG4gIH1cblxuICBpZiAob2Zmc2V0ID49IHRoaXMubGVuZ3RoKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHRoaXMud3JpdGVVSW50OCh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHRoaXMud3JpdGVVSW50OCgweGZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIG5vQXNzZXJ0KVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiB3cml0ZUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGFzc2VydCh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsLCAnbWlzc2luZyB2YWx1ZScpXG4gICAgYXNzZXJ0KHR5cGVvZiBsaXR0bGVFbmRpYW4gPT09ICdib29sZWFuJywgJ21pc3Npbmcgb3IgaW52YWxpZCBlbmRpYW4nKVxuICAgIGFzc2VydChvZmZzZXQgIT09IHVuZGVmaW5lZCAmJiBvZmZzZXQgIT09IG51bGwsICdtaXNzaW5nIG9mZnNldCcpXG4gICAgYXNzZXJ0KG9mZnNldCArIDEgPCBidWYubGVuZ3RoLCAnVHJ5aW5nIHRvIHdyaXRlIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbiAgICB2ZXJpZnNpbnQodmFsdWUsIDB4N2ZmZiwgLTB4ODAwMClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGlmICh2YWx1ZSA+PSAwKVxuICAgIHdyaXRlVUludDE2KGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgZWxzZVxuICAgIHdyaXRlVUludDE2KGJ1ZiwgMHhmZmZmICsgdmFsdWUgKyAxLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgYXNzZXJ0KHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwsICdtaXNzaW5nIHZhbHVlJylcbiAgICBhc3NlcnQodHlwZW9mIGxpdHRsZUVuZGlhbiA9PT0gJ2Jvb2xlYW4nLCAnbWlzc2luZyBvciBpbnZhbGlkIGVuZGlhbicpXG4gICAgYXNzZXJ0KG9mZnNldCAhPT0gdW5kZWZpbmVkICYmIG9mZnNldCAhPT0gbnVsbCwgJ21pc3Npbmcgb2Zmc2V0JylcbiAgICBhc3NlcnQob2Zmc2V0ICsgMyA8IGJ1Zi5sZW5ndGgsICdUcnlpbmcgdG8gd3JpdGUgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxuICAgIHZlcmlmc2ludCh2YWx1ZSwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIH1cblxuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuICBpZiAob2Zmc2V0ID49IGxlbilcbiAgICByZXR1cm5cblxuICBpZiAodmFsdWUgPj0gMClcbiAgICB3cml0ZVVJbnQzMihidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpXG4gIGVsc2VcbiAgICB3cml0ZVVJbnQzMihidWYsIDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDEsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyAzIDwgYnVmLmxlbmd0aCwgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZJRUVFNzU0KHZhbHVlLCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuXG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG4gIGlmIChvZmZzZXQgPj0gbGVuKVxuICAgIHJldHVyblxuXG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBhc3NlcnQodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCwgJ21pc3NpbmcgdmFsdWUnKVxuICAgIGFzc2VydCh0eXBlb2YgbGl0dGxlRW5kaWFuID09PSAnYm9vbGVhbicsICdtaXNzaW5nIG9yIGludmFsaWQgZW5kaWFuJylcbiAgICBhc3NlcnQob2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgb2Zmc2V0ICE9PSBudWxsLCAnbWlzc2luZyBvZmZzZXQnKVxuICAgIGFzc2VydChvZmZzZXQgKyA3IDwgYnVmLmxlbmd0aCxcbiAgICAgICAgJ1RyeWluZyB0byB3cml0ZSBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG4gICAgdmVyaWZJRUVFNzU0KHZhbHVlLCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG5cbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcbiAgaWYgKG9mZnNldCA+PSBsZW4pXG4gICAgcmV0dXJuXG5cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGFzc2VydChlbmQgPj0gc3RhcnQsICdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBhc3NlcnQoc3RhcnQgPj0gMCAmJiBzdGFydCA8IHRoaXMubGVuZ3RoLCAnc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGFzc2VydChlbmQgPj0gMCAmJiBlbmQgPD0gdGhpcy5sZW5ndGgsICdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gdXRmOFRvQnl0ZXModmFsdWUudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3V0ID0gW11cbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBvdXRbaV0gPSB0b0hleCh0aGlzW2ldKVxuICAgIGlmIChpID09PSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTKSB7XG4gICAgICBvdXRbaSArIDFdID0gJy4uLidcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgb3V0LmpvaW4oJyAnKSArICc+J1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAoQnVmZmVyLl91c2VUeXBlZEFycmF5cykge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgICAgICBidWZbaV0gPSB0aGlzW2ldXG4gICAgICB9XG4gICAgICByZXR1cm4gYnVmLmJ1ZmZlclxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0J1ZmZlci50b0FycmF5QnVmZmVyIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJylcbiAgfVxufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBCUCA9IEJ1ZmZlci5wcm90b3R5cGVcblxuLyoqXG4gKiBBdWdtZW50IGEgVWludDhBcnJheSAqaW5zdGFuY2UqIChub3QgdGhlIFVpbnQ4QXJyYXkgY2xhc3MhKSB3aXRoIEJ1ZmZlciBtZXRob2RzXG4gKi9cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9pc0J1ZmZlciA9IHRydWVcblxuICAvLyBzYXZlIHJlZmVyZW5jZSB0byBvcmlnaW5hbCBVaW50OEFycmF5IGdldC9zZXQgbWV0aG9kcyBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9nZXQgPSBhcnIuZ2V0XG4gIGFyci5fc2V0ID0gYXJyLnNldFxuXG4gIC8vIGRlcHJlY2F0ZWQsIHdpbGwgYmUgcmVtb3ZlZCBpbiBub2RlIDAuMTMrXG4gIGFyci5nZXQgPSBCUC5nZXRcbiAgYXJyLnNldCA9IEJQLnNldFxuXG4gIGFyci53cml0ZSA9IEJQLndyaXRlXG4gIGFyci50b1N0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0xvY2FsZVN0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0pTT04gPSBCUC50b0pTT05cbiAgYXJyLmVxdWFscyA9IEJQLmVxdWFsc1xuICBhcnIuY29tcGFyZSA9IEJQLmNvbXBhcmVcbiAgYXJyLmNvcHkgPSBCUC5jb3B5XG4gIGFyci5zbGljZSA9IEJQLnNsaWNlXG4gIGFyci5yZWFkVUludDggPSBCUC5yZWFkVUludDhcbiAgYXJyLnJlYWRVSW50MTZMRSA9IEJQLnJlYWRVSW50MTZMRVxuICBhcnIucmVhZFVJbnQxNkJFID0gQlAucmVhZFVJbnQxNkJFXG4gIGFyci5yZWFkVUludDMyTEUgPSBCUC5yZWFkVUludDMyTEVcbiAgYXJyLnJlYWRVSW50MzJCRSA9IEJQLnJlYWRVSW50MzJCRVxuICBhcnIucmVhZEludDggPSBCUC5yZWFkSW50OFxuICBhcnIucmVhZEludDE2TEUgPSBCUC5yZWFkSW50MTZMRVxuICBhcnIucmVhZEludDE2QkUgPSBCUC5yZWFkSW50MTZCRVxuICBhcnIucmVhZEludDMyTEUgPSBCUC5yZWFkSW50MzJMRVxuICBhcnIucmVhZEludDMyQkUgPSBCUC5yZWFkSW50MzJCRVxuICBhcnIucmVhZEZsb2F0TEUgPSBCUC5yZWFkRmxvYXRMRVxuICBhcnIucmVhZEZsb2F0QkUgPSBCUC5yZWFkRmxvYXRCRVxuICBhcnIucmVhZERvdWJsZUxFID0gQlAucmVhZERvdWJsZUxFXG4gIGFyci5yZWFkRG91YmxlQkUgPSBCUC5yZWFkRG91YmxlQkVcbiAgYXJyLndyaXRlVUludDggPSBCUC53cml0ZVVJbnQ4XG4gIGFyci53cml0ZVVJbnQxNkxFID0gQlAud3JpdGVVSW50MTZMRVxuICBhcnIud3JpdGVVSW50MTZCRSA9IEJQLndyaXRlVUludDE2QkVcbiAgYXJyLndyaXRlVUludDMyTEUgPSBCUC53cml0ZVVJbnQzMkxFXG4gIGFyci53cml0ZVVJbnQzMkJFID0gQlAud3JpdGVVSW50MzJCRVxuICBhcnIud3JpdGVJbnQ4ID0gQlAud3JpdGVJbnQ4XG4gIGFyci53cml0ZUludDE2TEUgPSBCUC53cml0ZUludDE2TEVcbiAgYXJyLndyaXRlSW50MTZCRSA9IEJQLndyaXRlSW50MTZCRVxuICBhcnIud3JpdGVJbnQzMkxFID0gQlAud3JpdGVJbnQzMkxFXG4gIGFyci53cml0ZUludDMyQkUgPSBCUC53cml0ZUludDMyQkVcbiAgYXJyLndyaXRlRmxvYXRMRSA9IEJQLndyaXRlRmxvYXRMRVxuICBhcnIud3JpdGVGbG9hdEJFID0gQlAud3JpdGVGbG9hdEJFXG4gIGFyci53cml0ZURvdWJsZUxFID0gQlAud3JpdGVEb3VibGVMRVxuICBhcnIud3JpdGVEb3VibGVCRSA9IEJQLndyaXRlRG91YmxlQkVcbiAgYXJyLmZpbGwgPSBCUC5maWxsXG4gIGFyci5pbnNwZWN0ID0gQlAuaW5zcGVjdFxuICBhcnIudG9BcnJheUJ1ZmZlciA9IEJQLnRvQXJyYXlCdWZmZXJcblxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbi8vIHNsaWNlKHN0YXJ0LCBlbmQpXG5mdW5jdGlvbiBjbGFtcCAoaW5kZXgsIGxlbiwgZGVmYXVsdFZhbHVlKSB7XG4gIGlmICh0eXBlb2YgaW5kZXggIT09ICdudW1iZXInKSByZXR1cm4gZGVmYXVsdFZhbHVlXG4gIGluZGV4ID0gfn5pbmRleDsgIC8vIENvZXJjZSB0byBpbnRlZ2VyLlxuICBpZiAoaW5kZXggPj0gbGVuKSByZXR1cm4gbGVuXG4gIGlmIChpbmRleCA+PSAwKSByZXR1cm4gaW5kZXhcbiAgaW5kZXggKz0gbGVuXG4gIGlmIChpbmRleCA+PSAwKSByZXR1cm4gaW5kZXhcbiAgcmV0dXJuIDBcbn1cblxuZnVuY3Rpb24gY29lcmNlIChsZW5ndGgpIHtcbiAgLy8gQ29lcmNlIGxlbmd0aCB0byBhIG51bWJlciAocG9zc2libHkgTmFOKSwgcm91bmQgdXBcbiAgLy8gaW4gY2FzZSBpdCdzIGZyYWN0aW9uYWwgKGUuZy4gMTIzLjQ1NikgdGhlbiBkbyBhXG4gIC8vIGRvdWJsZSBuZWdhdGUgdG8gY29lcmNlIGEgTmFOIHRvIDAuIEVhc3ksIHJpZ2h0P1xuICBsZW5ndGggPSB+fk1hdGguY2VpbCgrbGVuZ3RoKVxuICByZXR1cm4gbGVuZ3RoIDwgMCA/IDAgOiBsZW5ndGhcbn1cblxuZnVuY3Rpb24gaXNBcnJheSAoc3ViamVjdCkge1xuICByZXR1cm4gKEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHN1YmplY3QpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHN1YmplY3QpID09PSAnW29iamVjdCBBcnJheV0nXG4gIH0pKHN1YmplY3QpXG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlpc2ggKHN1YmplY3QpIHtcbiAgcmV0dXJuIGlzQXJyYXkoc3ViamVjdCkgfHwgQnVmZmVyLmlzQnVmZmVyKHN1YmplY3QpIHx8XG4gICAgICBzdWJqZWN0ICYmIHR5cGVvZiBzdWJqZWN0ID09PSAnb2JqZWN0JyAmJlxuICAgICAgdHlwZW9mIHN1YmplY3QubGVuZ3RoID09PSAnbnVtYmVyJ1xufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGIgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGlmIChiIDw9IDB4N0YpIHtcbiAgICAgIGJ5dGVBcnJheS5wdXNoKGIpXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBzdGFydCA9IGlcbiAgICAgIGlmIChiID49IDB4RDgwMCAmJiBiIDw9IDB4REZGRikgaSsrXG4gICAgICB2YXIgaCA9IGVuY29kZVVSSUNvbXBvbmVudChzdHIuc2xpY2Uoc3RhcnQsIGkrMSkpLnN1YnN0cigxKS5zcGxpdCgnJScpXG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGgubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgYnl0ZUFycmF5LnB1c2gocGFyc2VJbnQoaFtqXSwgMTYpKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShzdHIpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKVxuICAgICAgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBkZWNvZGVVdGY4Q2hhciAoc3RyKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChzdHIpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4RkZGRCkgLy8gVVRGIDggaW52YWxpZCBjaGFyXG4gIH1cbn1cblxuLypcbiAqIFdlIGhhdmUgdG8gbWFrZSBzdXJlIHRoYXQgdGhlIHZhbHVlIGlzIGEgdmFsaWQgaW50ZWdlci4gVGhpcyBtZWFucyB0aGF0IGl0XG4gKiBpcyBub24tbmVnYXRpdmUuIEl0IGhhcyBubyBmcmFjdGlvbmFsIGNvbXBvbmVudCBhbmQgdGhhdCBpdCBkb2VzIG5vdFxuICogZXhjZWVkIHRoZSBtYXhpbXVtIGFsbG93ZWQgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIHZlcmlmdWludCAodmFsdWUsIG1heCkge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPj0gMCwgJ3NwZWNpZmllZCBhIG5lZ2F0aXZlIHZhbHVlIGZvciB3cml0aW5nIGFuIHVuc2lnbmVkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlIDw9IG1heCwgJ3ZhbHVlIGlzIGxhcmdlciB0aGFuIG1heGltdW0gdmFsdWUgZm9yIHR5cGUnKVxuICBhc3NlcnQoTWF0aC5mbG9vcih2YWx1ZSkgPT09IHZhbHVlLCAndmFsdWUgaGFzIGEgZnJhY3Rpb25hbCBjb21wb25lbnQnKVxufVxuXG5mdW5jdGlvbiB2ZXJpZnNpbnQgKHZhbHVlLCBtYXgsIG1pbikge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgbGFyZ2VyIHRoYW4gbWF4aW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlID49IG1pbiwgJ3ZhbHVlIHNtYWxsZXIgdGhhbiBtaW5pbXVtIGFsbG93ZWQgdmFsdWUnKVxuICBhc3NlcnQoTWF0aC5mbG9vcih2YWx1ZSkgPT09IHZhbHVlLCAndmFsdWUgaGFzIGEgZnJhY3Rpb25hbCBjb21wb25lbnQnKVxufVxuXG5mdW5jdGlvbiB2ZXJpZklFRUU3NTQgKHZhbHVlLCBtYXgsIG1pbikge1xuICBhc3NlcnQodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJywgJ2Nhbm5vdCB3cml0ZSBhIG5vbi1udW1iZXIgYXMgYSBudW1iZXInKVxuICBhc3NlcnQodmFsdWUgPD0gbWF4LCAndmFsdWUgbGFyZ2VyIHRoYW4gbWF4aW11bSBhbGxvd2VkIHZhbHVlJylcbiAgYXNzZXJ0KHZhbHVlID49IG1pbiwgJ3ZhbHVlIHNtYWxsZXIgdGhhbiBtaW5pbXVtIGFsbG93ZWQgdmFsdWUnKVxufVxuXG5mdW5jdGlvbiBhc3NlcnQgKHRlc3QsIG1lc3NhZ2UpIHtcbiAgaWYgKCF0ZXN0KSB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSB8fCAnRmFpbGVkIGFzc2VydGlvbicpXG59XG4iLCJ2YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuXG47KGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuICB2YXIgQXJyID0gKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJylcbiAgICA/IFVpbnQ4QXJyYXlcbiAgICA6IEFycmF5XG5cblx0dmFyIFpFUk8gICA9ICcwJy5jaGFyQ29kZUF0KDApXG5cdHZhciBQTFVTICAgPSAnKycuY2hhckNvZGVBdCgwKVxuXHR2YXIgU0xBU0ggID0gJy8nLmNoYXJDb2RlQXQoMClcblx0dmFyIE5VTUJFUiA9ICcwJy5jaGFyQ29kZUF0KDApXG5cdHZhciBMT1dFUiAgPSAnYScuY2hhckNvZGVBdCgwKVxuXHR2YXIgVVBQRVIgID0gJ0EnLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUylcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0gpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0bW9kdWxlLmV4cG9ydHMudG9CeXRlQXJyYXkgPSBiNjRUb0J5dGVBcnJheVxuXHRtb2R1bGUuZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSgpKVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24oYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBuQml0cyA9IC03LFxuICAgICAgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwLFxuICAgICAgZCA9IGlzTEUgPyAtMSA6IDEsXG4gICAgICBzID0gYnVmZmVyW29mZnNldCArIGldO1xuXG4gIGkgKz0gZDtcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKTtcbiAgcyA+Pj0gKC1uQml0cyk7XG4gIG5CaXRzICs9IGVMZW47XG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpO1xuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpO1xuICBlID4+PSAoLW5CaXRzKTtcbiAgbkJpdHMgKz0gbUxlbjtcbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCk7XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzO1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSk7XG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKTtcbiAgICBlID0gZSAtIGVCaWFzO1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pO1xufTtcblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjLFxuICAgICAgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMSxcbiAgICAgIGVNYXggPSAoMSA8PCBlTGVuKSAtIDEsXG4gICAgICBlQmlhcyA9IGVNYXggPj4gMSxcbiAgICAgIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKSxcbiAgICAgIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKSxcbiAgICAgIGQgPSBpc0xFID8gMSA6IC0xLFxuICAgICAgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMDtcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKTtcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMDtcbiAgICBlID0gZU1heDtcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMik7XG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tO1xuICAgICAgYyAqPSAyO1xuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gYztcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpO1xuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrKztcbiAgICAgIGMgLz0gMjtcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwO1xuICAgICAgZSA9IGVNYXg7XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pO1xuICAgICAgZSA9IGUgKyBlQmlhcztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pO1xuICAgICAgZSA9IDA7XG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCk7XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbTtcbiAgZUxlbiArPSBtTGVuO1xuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpO1xuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyODtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2NoYWknKTtcbiIsIi8qIVxuICogY2hhaVxuICogQ29weXJpZ2h0KGMpIDIwMTEtMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbnZhciB1c2VkID0gW11cbiAgLCBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLyohXG4gKiBDaGFpIHZlcnNpb25cbiAqL1xuXG5leHBvcnRzLnZlcnNpb24gPSAnMS45LjEnO1xuXG4vKiFcbiAqIEFzc2VydGlvbiBFcnJvclxuICovXG5cbmV4cG9ydHMuQXNzZXJ0aW9uRXJyb3IgPSByZXF1aXJlKCdhc3NlcnRpb24tZXJyb3InKTtcblxuLyohXG4gKiBVdGlscyBmb3IgcGx1Z2lucyAobm90IGV4cG9ydGVkKVxuICovXG5cbnZhciB1dGlsID0gcmVxdWlyZSgnLi9jaGFpL3V0aWxzJyk7XG5cbi8qKlxuICogIyAudXNlKGZ1bmN0aW9uKVxuICpcbiAqIFByb3ZpZGVzIGEgd2F5IHRvIGV4dGVuZCB0aGUgaW50ZXJuYWxzIG9mIENoYWlcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufVxuICogQHJldHVybnMge3RoaXN9IGZvciBjaGFpbmluZ1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5leHBvcnRzLnVzZSA9IGZ1bmN0aW9uIChmbikge1xuICBpZiAoIX51c2VkLmluZGV4T2YoZm4pKSB7XG4gICAgZm4odGhpcywgdXRpbCk7XG4gICAgdXNlZC5wdXNoKGZuKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyohXG4gKiBDb25maWd1cmF0aW9uXG4gKi9cblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY2hhaS9jb25maWcnKTtcbmV4cG9ydHMuY29uZmlnID0gY29uZmlnO1xuXG4vKiFcbiAqIFByaW1hcnkgYEFzc2VydGlvbmAgcHJvdG90eXBlXG4gKi9cblxudmFyIGFzc2VydGlvbiA9IHJlcXVpcmUoJy4vY2hhaS9hc3NlcnRpb24nKTtcbmV4cG9ydHMudXNlKGFzc2VydGlvbik7XG5cbi8qIVxuICogQ29yZSBBc3NlcnRpb25zXG4gKi9cblxudmFyIGNvcmUgPSByZXF1aXJlKCcuL2NoYWkvY29yZS9hc3NlcnRpb25zJyk7XG5leHBvcnRzLnVzZShjb3JlKTtcblxuLyohXG4gKiBFeHBlY3QgaW50ZXJmYWNlXG4gKi9cblxudmFyIGV4cGVjdCA9IHJlcXVpcmUoJy4vY2hhaS9pbnRlcmZhY2UvZXhwZWN0Jyk7XG5leHBvcnRzLnVzZShleHBlY3QpO1xuXG4vKiFcbiAqIFNob3VsZCBpbnRlcmZhY2VcbiAqL1xuXG52YXIgc2hvdWxkID0gcmVxdWlyZSgnLi9jaGFpL2ludGVyZmFjZS9zaG91bGQnKTtcbmV4cG9ydHMudXNlKHNob3VsZCk7XG5cbi8qIVxuICogQXNzZXJ0IGludGVyZmFjZVxuICovXG5cbnZhciBhc3NlcnQgPSByZXF1aXJlKCcuL2NoYWkvaW50ZXJmYWNlL2Fzc2VydCcpO1xuZXhwb3J0cy51c2UoYXNzZXJ0KTtcbiIsIi8qIVxuICogY2hhaVxuICogaHR0cDovL2NoYWlqcy5jb21cbiAqIENvcHlyaWdodChjKSAyMDExLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoX2NoYWksIHV0aWwpIHtcbiAgLyohXG4gICAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gICAqL1xuXG4gIHZhciBBc3NlcnRpb25FcnJvciA9IF9jaGFpLkFzc2VydGlvbkVycm9yXG4gICAgLCBmbGFnID0gdXRpbC5mbGFnO1xuXG4gIC8qIVxuICAgKiBNb2R1bGUgZXhwb3J0LlxuICAgKi9cblxuICBfY2hhaS5Bc3NlcnRpb24gPSBBc3NlcnRpb247XG5cbiAgLyohXG4gICAqIEFzc2VydGlvbiBDb25zdHJ1Y3RvclxuICAgKlxuICAgKiBDcmVhdGVzIG9iamVjdCBmb3IgY2hhaW5pbmcuXG4gICAqXG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cblxuICBmdW5jdGlvbiBBc3NlcnRpb24gKG9iaiwgbXNnLCBzdGFjaykge1xuICAgIGZsYWcodGhpcywgJ3NzZmknLCBzdGFjayB8fCBhcmd1bWVudHMuY2FsbGVlKTtcbiAgICBmbGFnKHRoaXMsICdvYmplY3QnLCBvYmopO1xuICAgIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICB9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEFzc2VydGlvbiwgJ2luY2x1ZGVTdGFjaycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc29sZS53YXJuKCdBc3NlcnRpb24uaW5jbHVkZVN0YWNrIGlzIGRlcHJlY2F0ZWQsIHVzZSBjaGFpLmNvbmZpZy5pbmNsdWRlU3RhY2sgaW5zdGVhZC4nKTtcbiAgICAgIHJldHVybiBjb25maWcuaW5jbHVkZVN0YWNrO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgY29uc29sZS53YXJuKCdBc3NlcnRpb24uaW5jbHVkZVN0YWNrIGlzIGRlcHJlY2F0ZWQsIHVzZSBjaGFpLmNvbmZpZy5pbmNsdWRlU3RhY2sgaW5zdGVhZC4nKTtcbiAgICAgIGNvbmZpZy5pbmNsdWRlU3RhY2sgPSB2YWx1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShBc3NlcnRpb24sICdzaG93RGlmZicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgY29uc29sZS53YXJuKCdBc3NlcnRpb24uc2hvd0RpZmYgaXMgZGVwcmVjYXRlZCwgdXNlIGNoYWkuY29uZmlnLnNob3dEaWZmIGluc3RlYWQuJyk7XG4gICAgICByZXR1cm4gY29uZmlnLnNob3dEaWZmO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgY29uc29sZS53YXJuKCdBc3NlcnRpb24uc2hvd0RpZmYgaXMgZGVwcmVjYXRlZCwgdXNlIGNoYWkuY29uZmlnLnNob3dEaWZmIGluc3RlYWQuJyk7XG4gICAgICBjb25maWcuc2hvd0RpZmYgPSB2YWx1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICAgIHV0aWwuYWRkUHJvcGVydHkodGhpcy5wcm90b3R5cGUsIG5hbWUsIGZuKTtcbiAgfTtcblxuICBBc3NlcnRpb24uYWRkTWV0aG9kID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gICAgdXRpbC5hZGRNZXRob2QodGhpcy5wcm90b3R5cGUsIG5hbWUsIGZuKTtcbiAgfTtcblxuICBBc3NlcnRpb24uYWRkQ2hhaW5hYmxlTWV0aG9kID0gZnVuY3Rpb24gKG5hbWUsIGZuLCBjaGFpbmluZ0JlaGF2aW9yKSB7XG4gICAgdXRpbC5hZGRDaGFpbmFibGVNZXRob2QodGhpcy5wcm90b3R5cGUsIG5hbWUsIGZuLCBjaGFpbmluZ0JlaGF2aW9yKTtcbiAgfTtcblxuICBBc3NlcnRpb24ub3ZlcndyaXRlUHJvcGVydHkgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgICB1dGlsLm92ZXJ3cml0ZVByb3BlcnR5KHRoaXMucHJvdG90eXBlLCBuYW1lLCBmbik7XG4gIH07XG5cbiAgQXNzZXJ0aW9uLm92ZXJ3cml0ZU1ldGhvZCA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICAgIHV0aWwub3ZlcndyaXRlTWV0aG9kKHRoaXMucHJvdG90eXBlLCBuYW1lLCBmbik7XG4gIH07XG5cbiAgQXNzZXJ0aW9uLm92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZCA9IGZ1bmN0aW9uIChuYW1lLCBmbiwgY2hhaW5pbmdCZWhhdmlvcikge1xuICAgIHV0aWwub3ZlcndyaXRlQ2hhaW5hYmxlTWV0aG9kKHRoaXMucHJvdG90eXBlLCBuYW1lLCBmbiwgY2hhaW5pbmdCZWhhdmlvcik7XG4gIH07XG5cbiAgLyohXG4gICAqICMjIyAuYXNzZXJ0KGV4cHJlc3Npb24sIG1lc3NhZ2UsIG5lZ2F0ZU1lc3NhZ2UsIGV4cGVjdGVkLCBhY3R1YWwpXG4gICAqXG4gICAqIEV4ZWN1dGVzIGFuIGV4cHJlc3Npb24gYW5kIGNoZWNrIGV4cGVjdGF0aW9ucy4gVGhyb3dzIEFzc2VydGlvbkVycm9yIGZvciByZXBvcnRpbmcgaWYgdGVzdCBkb2Vzbid0IHBhc3MuXG4gICAqXG4gICAqIEBuYW1lIGFzc2VydFxuICAgKiBAcGFyYW0ge1BoaWxvc29waGljYWx9IGV4cHJlc3Npb24gdG8gYmUgdGVzdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIHRvIGRpc3BsYXkgaWYgZmFpbHNcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5lZ2F0ZWRNZXNzYWdlIHRvIGRpc3BsYXkgaWYgbmVnYXRlZCBleHByZXNzaW9uIGZhaWxzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cGVjdGVkIHZhbHVlIChyZW1lbWJlciB0byBjaGVjayBmb3IgbmVnYXRpb24pXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbCAob3B0aW9uYWwpIHdpbGwgZGVmYXVsdCB0byBgdGhpcy5vYmpgXG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cblxuICBBc3NlcnRpb24ucHJvdG90eXBlLmFzc2VydCA9IGZ1bmN0aW9uIChleHByLCBtc2csIG5lZ2F0ZU1zZywgZXhwZWN0ZWQsIF9hY3R1YWwsIHNob3dEaWZmKSB7XG4gICAgdmFyIG9rID0gdXRpbC50ZXN0KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgaWYgKHRydWUgIT09IHNob3dEaWZmKSBzaG93RGlmZiA9IGZhbHNlO1xuICAgIGlmICh0cnVlICE9PSBjb25maWcuc2hvd0RpZmYpIHNob3dEaWZmID0gZmFsc2U7XG5cbiAgICBpZiAoIW9rKSB7XG4gICAgICB2YXIgbXNnID0gdXRpbC5nZXRNZXNzYWdlKHRoaXMsIGFyZ3VtZW50cylcbiAgICAgICAgLCBhY3R1YWwgPSB1dGlsLmdldEFjdHVhbCh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZywge1xuICAgICAgICAgIGFjdHVhbDogYWN0dWFsXG4gICAgICAgICwgZXhwZWN0ZWQ6IGV4cGVjdGVkXG4gICAgICAgICwgc2hvd0RpZmY6IHNob3dEaWZmXG4gICAgICB9LCAoY29uZmlnLmluY2x1ZGVTdGFjaykgPyB0aGlzLmFzc2VydCA6IGZsYWcodGhpcywgJ3NzZmknKSk7XG4gICAgfVxuICB9O1xuXG4gIC8qIVxuICAgKiAjIyMgLl9vYmpcbiAgICpcbiAgICogUXVpY2sgcmVmZXJlbmNlIHRvIHN0b3JlZCBgYWN0dWFsYCB2YWx1ZSBmb3IgcGx1Z2luIGRldmVsb3BlcnMuXG4gICAqXG4gICAqIEBhcGkgcHJpdmF0ZVxuICAgKi9cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQXNzZXJ0aW9uLnByb3RvdHlwZSwgJ19vYmonLFxuICAgIHsgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICAgIH1cbiAgICAsIHNldDogZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICBmbGFnKHRoaXMsICdvYmplY3QnLCB2YWwpO1xuICAgICAgfVxuICB9KTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcblxuICAvKipcbiAgICogIyMjIGNvbmZpZy5pbmNsdWRlU3RhY2tcbiAgICpcbiAgICogVXNlciBjb25maWd1cmFibGUgcHJvcGVydHksIGluZmx1ZW5jZXMgd2hldGhlciBzdGFjayB0cmFjZVxuICAgKiBpcyBpbmNsdWRlZCBpbiBBc3NlcnRpb24gZXJyb3IgbWVzc2FnZS4gRGVmYXVsdCBvZiBmYWxzZVxuICAgKiBzdXBwcmVzc2VzIHN0YWNrIHRyYWNlIGluIHRoZSBlcnJvciBtZXNzYWdlLlxuICAgKlxuICAgKiAgICAgY2hhaS5jb25maWcuaW5jbHVkZVN0YWNrID0gdHJ1ZTsgIC8vIGVuYWJsZSBzdGFjayBvbiBlcnJvclxuICAgKlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gICBpbmNsdWRlU3RhY2s6IGZhbHNlLFxuXG4gIC8qKlxuICAgKiAjIyMgY29uZmlnLnNob3dEaWZmXG4gICAqXG4gICAqIFVzZXIgY29uZmlndXJhYmxlIHByb3BlcnR5LCBpbmZsdWVuY2VzIHdoZXRoZXIgb3Igbm90XG4gICAqIHRoZSBgc2hvd0RpZmZgIGZsYWcgc2hvdWxkIGJlIGluY2x1ZGVkIGluIHRoZSB0aHJvd25cbiAgICogQXNzZXJ0aW9uRXJyb3JzLiBgZmFsc2VgIHdpbGwgYWx3YXlzIGJlIGBmYWxzZWA7IGB0cnVlYFxuICAgKiB3aWxsIGJlIHRydWUgd2hlbiB0aGUgYXNzZXJ0aW9uIGhhcyByZXF1ZXN0ZWQgYSBkaWZmXG4gICAqIGJlIHNob3duLlxuICAgKlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIHNob3dEaWZmOiB0cnVlLFxuXG4gIC8qKlxuICAgKiAjIyMgY29uZmlnLnRydW5jYXRlVGhyZXNob2xkXG4gICAqXG4gICAqIFVzZXIgY29uZmlndXJhYmxlIHByb3BlcnR5LCBzZXRzIGxlbmd0aCB0aHJlc2hvbGQgZm9yIGFjdHVhbCBhbmRcbiAgICogZXhwZWN0ZWQgdmFsdWVzIGluIGFzc2VydGlvbiBlcnJvcnMuIElmIHRoaXMgdGhyZXNob2xkIGlzIGV4Y2VlZGVkLFxuICAgKiB0aGUgdmFsdWUgaXMgdHJ1bmNhdGVkLlxuICAgKlxuICAgKiBTZXQgaXQgdG8gemVybyBpZiB5b3Ugd2FudCB0byBkaXNhYmxlIHRydW5jYXRpbmcgYWx0b2dldGhlci5cbiAgICpcbiAgICogICAgIGNoYWkuY29uZmlnLnRydW5jYXRlVGhyZXNob2xkID0gMDsgIC8vIGRpc2FibGUgdHJ1bmNhdGluZ1xuICAgKlxuICAgKiBAcGFyYW0ge051bWJlcn1cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgdHJ1bmNhdGVUaHJlc2hvbGQ6IDQwXG5cbn07XG4iLCIvKiFcbiAqIGNoYWlcbiAqIGh0dHA6Ly9jaGFpanMuY29tXG4gKiBDb3B5cmlnaHQoYykgMjAxMS0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY2hhaSwgXykge1xuICB2YXIgQXNzZXJ0aW9uID0gY2hhaS5Bc3NlcnRpb25cbiAgICAsIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ1xuICAgICwgZmxhZyA9IF8uZmxhZztcblxuICAvKipcbiAgICogIyMjIExhbmd1YWdlIENoYWluc1xuICAgKlxuICAgKiBUaGUgZm9sbG93aW5nIGFyZSBwcm92aWRlZCBhcyBjaGFpbmFibGUgZ2V0dGVycyB0b1xuICAgKiBpbXByb3ZlIHRoZSByZWFkYWJpbGl0eSBvZiB5b3VyIGFzc2VydGlvbnMuIFRoZXlcbiAgICogZG8gbm90IHByb3ZpZGUgdGVzdGluZyBjYXBhYmlsaXRpZXMgdW5sZXNzIHRoZXlcbiAgICogaGF2ZSBiZWVuIG92ZXJ3cml0dGVuIGJ5IGEgcGx1Z2luLlxuICAgKlxuICAgKiAqKkNoYWlucyoqXG4gICAqXG4gICAqIC0gdG9cbiAgICogLSBiZVxuICAgKiAtIGJlZW5cbiAgICogLSBpc1xuICAgKiAtIHRoYXRcbiAgICogLSBhbmRcbiAgICogLSBoYXNcbiAgICogLSBoYXZlXG4gICAqIC0gd2l0aFxuICAgKiAtIGF0XG4gICAqIC0gb2ZcbiAgICogLSBzYW1lXG4gICAqXG4gICAqIEBuYW1lIGxhbmd1YWdlIGNoYWluc1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBbICd0bycsICdiZScsICdiZWVuJ1xuICAsICdpcycsICdhbmQnLCAnaGFzJywgJ2hhdmUnXG4gICwgJ3dpdGgnLCAndGhhdCcsICdhdCdcbiAgLCAnb2YnLCAnc2FtZScgXS5mb3JFYWNoKGZ1bmN0aW9uIChjaGFpbikge1xuICAgIEFzc2VydGlvbi5hZGRQcm9wZXJ0eShjaGFpbiwgZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdFxuICAgKlxuICAgKiBOZWdhdGVzIGFueSBvZiBhc3NlcnRpb25zIGZvbGxvd2luZyBpbiB0aGUgY2hhaW4uXG4gICAqXG4gICAqICAgICBleHBlY3QoZm9vKS50by5ub3QuZXF1YWwoJ2JhcicpO1xuICAgKiAgICAgZXhwZWN0KGdvb2RGbikudG8ubm90LnRocm93KEVycm9yKTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogJ2JheicgfSkudG8uaGF2ZS5wcm9wZXJ0eSgnZm9vJylcbiAgICogICAgICAgLmFuZC5ub3QuZXF1YWwoJ2JhcicpO1xuICAgKlxuICAgKiBAbmFtZSBub3RcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdub3QnLCBmdW5jdGlvbiAoKSB7XG4gICAgZmxhZyh0aGlzLCAnbmVnYXRlJywgdHJ1ZSk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLmRlZXBcbiAgICpcbiAgICogU2V0cyB0aGUgYGRlZXBgIGZsYWcsIGxhdGVyIHVzZWQgYnkgdGhlIGBlcXVhbGAgYW5kXG4gICAqIGBwcm9wZXJ0eWAgYXNzZXJ0aW9ucy5cbiAgICpcbiAgICogICAgIGV4cGVjdChmb28pLnRvLmRlZXAuZXF1YWwoeyBiYXI6ICdiYXonIH0pO1xuICAgKiAgICAgZXhwZWN0KHsgZm9vOiB7IGJhcjogeyBiYXo6ICdxdXV4JyB9IH0gfSlcbiAgICogICAgICAgLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgnZm9vLmJhci5iYXonLCAncXV1eCcpO1xuICAgKlxuICAgKiBAbmFtZSBkZWVwXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnZGVlcCcsIGZ1bmN0aW9uICgpIHtcbiAgICBmbGFnKHRoaXMsICdkZWVwJywgdHJ1ZSk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAjIyMgLmEodHlwZSlcbiAgICpcbiAgICogVGhlIGBhYCBhbmQgYGFuYCBhc3NlcnRpb25zIGFyZSBhbGlhc2VzIHRoYXQgY2FuIGJlXG4gICAqIHVzZWQgZWl0aGVyIGFzIGxhbmd1YWdlIGNoYWlucyBvciB0byBhc3NlcnQgYSB2YWx1ZSdzXG4gICAqIHR5cGUuXG4gICAqXG4gICAqICAgICAvLyB0eXBlb2ZcbiAgICogICAgIGV4cGVjdCgndGVzdCcpLnRvLmJlLmEoJ3N0cmluZycpO1xuICAgKiAgICAgZXhwZWN0KHsgZm9vOiAnYmFyJyB9KS50by5iZS5hbignb2JqZWN0Jyk7XG4gICAqICAgICBleHBlY3QobnVsbCkudG8uYmUuYSgnbnVsbCcpO1xuICAgKiAgICAgZXhwZWN0KHVuZGVmaW5lZCkudG8uYmUuYW4oJ3VuZGVmaW5lZCcpO1xuICAgKlxuICAgKiAgICAgLy8gbGFuZ3VhZ2UgY2hhaW5cbiAgICogICAgIGV4cGVjdChmb28pLnRvLmJlLmFuLmluc3RhbmNlb2YoRm9vKTtcbiAgICpcbiAgICogQG5hbWUgYVxuICAgKiBAYWxpYXMgYW5cbiAgICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhbiAodHlwZSwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdHlwZSA9IHR5cGUudG9Mb3dlckNhc2UoKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgYXJ0aWNsZSA9IH5bICdhJywgJ2UnLCAnaScsICdvJywgJ3UnIF0uaW5kZXhPZih0eXBlLmNoYXJBdCgwKSkgPyAnYW4gJyA6ICdhICc7XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdHlwZSA9PT0gXy50eXBlKG9iailcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgJyArIGFydGljbGUgKyB0eXBlXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IG5vdCB0byBiZSAnICsgYXJ0aWNsZSArIHR5cGVcbiAgICApO1xuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZENoYWluYWJsZU1ldGhvZCgnYW4nLCBhbik7XG4gIEFzc2VydGlvbi5hZGRDaGFpbmFibGVNZXRob2QoJ2EnLCBhbik7XG5cbiAgLyoqXG4gICAqICMjIyAuaW5jbHVkZSh2YWx1ZSlcbiAgICpcbiAgICogVGhlIGBpbmNsdWRlYCBhbmQgYGNvbnRhaW5gIGFzc2VydGlvbnMgY2FuIGJlIHVzZWQgYXMgZWl0aGVyIHByb3BlcnR5XG4gICAqIGJhc2VkIGxhbmd1YWdlIGNoYWlucyBvciBhcyBtZXRob2RzIHRvIGFzc2VydCB0aGUgaW5jbHVzaW9uIG9mIGFuIG9iamVjdFxuICAgKiBpbiBhbiBhcnJheSBvciBhIHN1YnN0cmluZyBpbiBhIHN0cmluZy4gV2hlbiB1c2VkIGFzIGxhbmd1YWdlIGNoYWlucyxcbiAgICogdGhleSB0b2dnbGUgdGhlIGBjb250YWluYCBmbGFnIGZvciB0aGUgYGtleXNgIGFzc2VydGlvbi5cbiAgICpcbiAgICogICAgIGV4cGVjdChbMSwyLDNdKS50by5pbmNsdWRlKDIpO1xuICAgKiAgICAgZXhwZWN0KCdmb29iYXInKS50by5jb250YWluKCdmb28nKTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogJ2JhcicsIGhlbGxvOiAndW5pdmVyc2UnIH0pLnRvLmluY2x1ZGUua2V5cygnZm9vJyk7XG4gICAqXG4gICAqIEBuYW1lIGluY2x1ZGVcbiAgICogQGFsaWFzIGNvbnRhaW5cbiAgICogQHBhcmFtIHtPYmplY3R8U3RyaW5nfE51bWJlcn0gb2JqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gaW5jbHVkZUNoYWluaW5nQmVoYXZpb3IgKCkge1xuICAgIGZsYWcodGhpcywgJ2NvbnRhaW5zJywgdHJ1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBpbmNsdWRlICh2YWwsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICB2YXIgZXhwZWN0ZWQgPSBmYWxzZTtcbiAgICBpZiAoXy50eXBlKG9iaikgPT09ICdhcnJheScgJiYgXy50eXBlKHZhbCkgPT09ICdvYmplY3QnKSB7XG4gICAgICBmb3IgKHZhciBpIGluIG9iaikge1xuICAgICAgICBpZiAoXy5lcWwob2JqW2ldLCB2YWwpKSB7XG4gICAgICAgICAgZXhwZWN0ZWQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChfLnR5cGUodmFsKSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGlmICghZmxhZyh0aGlzLCAnbmVnYXRlJykpIHtcbiAgICAgICAgZm9yICh2YXIgayBpbiB2YWwpIG5ldyBBc3NlcnRpb24ob2JqKS5wcm9wZXJ0eShrLCB2YWxba10pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgc3Vic2V0ID0ge31cbiAgICAgIGZvciAodmFyIGsgaW4gdmFsKSBzdWJzZXRba10gPSBvYmpba11cbiAgICAgIGV4cGVjdGVkID0gXy5lcWwoc3Vic2V0LCB2YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHBlY3RlZCA9IG9iaiAmJiB+b2JqLmluZGV4T2YodmFsKVxuICAgIH1cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgZXhwZWN0ZWRcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaW5jbHVkZSAnICsgXy5pbnNwZWN0KHZhbClcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGluY2x1ZGUgJyArIF8uaW5zcGVjdCh2YWwpKTtcbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRDaGFpbmFibGVNZXRob2QoJ2luY2x1ZGUnLCBpbmNsdWRlLCBpbmNsdWRlQ2hhaW5pbmdCZWhhdmlvcik7XG4gIEFzc2VydGlvbi5hZGRDaGFpbmFibGVNZXRob2QoJ2NvbnRhaW4nLCBpbmNsdWRlLCBpbmNsdWRlQ2hhaW5pbmdCZWhhdmlvcik7XG5cbiAgLyoqXG4gICAqICMjIyAub2tcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgdHJ1dGh5LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdldmVydGhpbmcnKS50by5iZS5vaztcbiAgICogICAgIGV4cGVjdCgxKS50by5iZS5vaztcbiAgICogICAgIGV4cGVjdChmYWxzZSkudG8ubm90LmJlLm9rO1xuICAgKiAgICAgZXhwZWN0KHVuZGVmaW5lZCkudG8ubm90LmJlLm9rO1xuICAgKiAgICAgZXhwZWN0KG51bGwpLnRvLm5vdC5iZS5vaztcbiAgICpcbiAgICogQG5hbWUgb2tcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdvaycsIGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgdHJ1dGh5J1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBmYWxzeScpO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC50cnVlXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGB0cnVlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCh0cnVlKS50by5iZS50cnVlO1xuICAgKiAgICAgZXhwZWN0KDEpLnRvLm5vdC5iZS50cnVlO1xuICAgKlxuICAgKiBAbmFtZSB0cnVlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgndHJ1ZScsIGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdHJ1ZSA9PT0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgdHJ1ZSdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgZmFsc2UnXG4gICAgICAsIHRoaXMubmVnYXRlID8gZmFsc2UgOiB0cnVlXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuZmFsc2VcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgYGZhbHNlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdChmYWxzZSkudG8uYmUuZmFsc2U7XG4gICAqICAgICBleHBlY3QoMCkudG8ubm90LmJlLmZhbHNlO1xuICAgKlxuICAgKiBAbmFtZSBmYWxzZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ2ZhbHNlJywgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBmYWxzZSA9PT0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgZmFsc2UnXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIHRydWUnXG4gICAgICAsIHRoaXMubmVnYXRlID8gdHJ1ZSA6IGZhbHNlXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAubnVsbFxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBgbnVsbGAuXG4gICAqXG4gICAqICAgICBleHBlY3QobnVsbCkudG8uYmUubnVsbDtcbiAgICogICAgIGV4cGVjdCh1bmRlZmluZWQpLm5vdC50by5iZS5udWxsO1xuICAgKlxuICAgKiBAbmFtZSBudWxsXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnbnVsbCcsIGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgbnVsbCA9PT0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgbnVsbCdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gbm90IHRvIGJlIG51bGwnXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAudW5kZWZpbmVkXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGB1bmRlZmluZWRgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KHVuZGVmaW5lZCkudG8uYmUudW5kZWZpbmVkO1xuICAgKiAgICAgZXhwZWN0KG51bGwpLnRvLm5vdC5iZS51bmRlZmluZWQ7XG4gICAqXG4gICAqIEBuYW1lIHVuZGVmaW5lZFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkUHJvcGVydHkoJ3VuZGVmaW5lZCcsIGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdW5kZWZpbmVkID09PSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSB1bmRlZmluZWQnXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IG5vdCB0byBiZSB1bmRlZmluZWQnXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuZXhpc3RcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgbmVpdGhlciBgbnVsbGAgbm9yIGB1bmRlZmluZWRgLlxuICAgKlxuICAgKiAgICAgdmFyIGZvbyA9ICdoaSdcbiAgICogICAgICAgLCBiYXIgPSBudWxsXG4gICAqICAgICAgICwgYmF6O1xuICAgKlxuICAgKiAgICAgZXhwZWN0KGZvbykudG8uZXhpc3Q7XG4gICAqICAgICBleHBlY3QoYmFyKS50by5ub3QuZXhpc3Q7XG4gICAqICAgICBleHBlY3QoYmF6KS50by5ub3QuZXhpc3Q7XG4gICAqXG4gICAqIEBuYW1lIGV4aXN0XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnZXhpc3QnLCBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIG51bGwgIT0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gZXhpc3QnXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBleGlzdCdcbiAgICApO1xuICB9KTtcblxuXG4gIC8qKlxuICAgKiAjIyMgLmVtcHR5XG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0J3MgbGVuZ3RoIGlzIGAwYC4gRm9yIGFycmF5cywgaXQgY2hlY2tzXG4gICAqIHRoZSBgbGVuZ3RoYCBwcm9wZXJ0eS4gRm9yIG9iamVjdHMsIGl0IGdldHMgdGhlIGNvdW50IG9mXG4gICAqIGVudW1lcmFibGUga2V5cy5cbiAgICpcbiAgICogICAgIGV4cGVjdChbXSkudG8uYmUuZW1wdHk7XG4gICAqICAgICBleHBlY3QoJycpLnRvLmJlLmVtcHR5O1xuICAgKiAgICAgZXhwZWN0KHt9KS50by5iZS5lbXB0eTtcbiAgICpcbiAgICogQG5hbWUgZW1wdHlcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdlbXB0eScsIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgZXhwZWN0ZWQgPSBvYmo7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmopIHx8ICdzdHJpbmcnID09PSB0eXBlb2Ygb2JqZWN0KSB7XG4gICAgICBleHBlY3RlZCA9IG9iai5sZW5ndGg7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgICAgZXhwZWN0ZWQgPSBPYmplY3Qua2V5cyhvYmopLmxlbmd0aDtcbiAgICB9XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgIWV4cGVjdGVkXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGVtcHR5J1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSBub3QgdG8gYmUgZW1wdHknXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuYXJndW1lbnRzXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGFuIGFyZ3VtZW50cyBvYmplY3QuXG4gICAqXG4gICAqICAgICBmdW5jdGlvbiB0ZXN0ICgpIHtcbiAgICogICAgICAgZXhwZWN0KGFyZ3VtZW50cykudG8uYmUuYXJndW1lbnRzO1xuICAgKiAgICAgfVxuICAgKlxuICAgKiBAbmFtZSBhcmd1bWVudHNcbiAgICogQGFsaWFzIEFyZ3VtZW50c1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBjaGVja0FyZ3VtZW50cyAoKSB7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsIHR5cGUgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgJ1tvYmplY3QgQXJndW1lbnRzXScgPT09IHR5cGVcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYXJndW1lbnRzIGJ1dCBnb3QgJyArIHR5cGVcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGJlIGFyZ3VtZW50cydcbiAgICApO1xuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdhcmd1bWVudHMnLCBjaGVja0FyZ3VtZW50cyk7XG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnQXJndW1lbnRzJywgY2hlY2tBcmd1bWVudHMpO1xuXG4gIC8qKlxuICAgKiAjIyMgLmVxdWFsKHZhbHVlKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBzdHJpY3RseSBlcXVhbCAoYD09PWApIHRvIGB2YWx1ZWAuXG4gICAqIEFsdGVybmF0ZWx5LCBpZiB0aGUgYGRlZXBgIGZsYWcgaXMgc2V0LCBhc3NlcnRzIHRoYXRcbiAgICogdGhlIHRhcmdldCBpcyBkZWVwbHkgZXF1YWwgdG8gYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnaGVsbG8nKS50by5lcXVhbCgnaGVsbG8nKTtcbiAgICogICAgIGV4cGVjdCg0MikudG8uZXF1YWwoNDIpO1xuICAgKiAgICAgZXhwZWN0KDEpLnRvLm5vdC5lcXVhbCh0cnVlKTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogJ2JhcicgfSkudG8ubm90LmVxdWFsKHsgZm9vOiAnYmFyJyB9KTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogJ2JhcicgfSkudG8uZGVlcC5lcXVhbCh7IGZvbzogJ2JhcicgfSk7XG4gICAqXG4gICAqIEBuYW1lIGVxdWFsXG4gICAqIEBhbGlhcyBlcXVhbHNcbiAgICogQGFsaWFzIGVxXG4gICAqIEBhbGlhcyBkZWVwLmVxdWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0RXF1YWwgKHZhbCwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIGlmIChmbGFnKHRoaXMsICdkZWVwJykpIHtcbiAgICAgIHJldHVybiB0aGlzLmVxbCh2YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICB2YWwgPT09IG9ialxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGVxdWFsICN7ZXhwfSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgZXF1YWwgI3tleHB9J1xuICAgICAgICAsIHZhbFxuICAgICAgICAsIHRoaXMuX29ialxuICAgICAgICAsIHRydWVcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZXF1YWwnLCBhc3NlcnRFcXVhbCk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2VxdWFscycsIGFzc2VydEVxdWFsKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZXEnLCBhc3NlcnRFcXVhbCk7XG5cbiAgLyoqXG4gICAqICMjIyAuZXFsKHZhbHVlKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBkZWVwbHkgZXF1YWwgdG8gYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCh7IGZvbzogJ2JhcicgfSkudG8uZXFsKHsgZm9vOiAnYmFyJyB9KTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uZXFsKFsgMSwgMiwgMyBdKTtcbiAgICpcbiAgICogQG5hbWUgZXFsXG4gICAqIEBhbGlhcyBlcWxzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0RXFsKG9iaiwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIF8uZXFsKG9iaiwgZmxhZyh0aGlzLCAnb2JqZWN0JykpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGRlZXBseSBlcXVhbCAje2V4cH0nXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBkZWVwbHkgZXF1YWwgI3tleHB9J1xuICAgICAgLCBvYmpcbiAgICAgICwgdGhpcy5fb2JqXG4gICAgICAsIHRydWVcbiAgICApO1xuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZXFsJywgYXNzZXJ0RXFsKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZXFscycsIGFzc2VydEVxbCk7XG5cbiAgLyoqXG4gICAqICMjIyAuYWJvdmUodmFsdWUpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGdyZWF0ZXIgdGhhbiBgdmFsdWVgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KDEwKS50by5iZS5hYm92ZSg1KTtcbiAgICpcbiAgICogQ2FuIGFsc28gYmUgdXNlZCBpbiBjb25qdW5jdGlvbiB3aXRoIGBsZW5ndGhgIHRvXG4gICAqIGFzc2VydCBhIG1pbmltdW0gbGVuZ3RoLiBUaGUgYmVuZWZpdCBiZWluZyBhXG4gICAqIG1vcmUgaW5mb3JtYXRpdmUgZXJyb3IgbWVzc2FnZSB0aGFuIGlmIHRoZSBsZW5ndGhcbiAgICogd2FzIHN1cHBsaWVkIGRpcmVjdGx5LlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdmb28nKS50by5oYXZlLmxlbmd0aC5hYm92ZSgyKTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uaGF2ZS5sZW5ndGguYWJvdmUoMik7XG4gICAqXG4gICAqIEBuYW1lIGFib3ZlXG4gICAqIEBhbGlhcyBndFxuICAgKiBAYWxpYXMgZ3JlYXRlclRoYW5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gYXNzZXJ0QWJvdmUgKG4sIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICBpZiAoZmxhZyh0aGlzLCAnZG9MZW5ndGgnKSkge1xuICAgICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgICB2YXIgbGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIGxlbiA+IG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIGFib3ZlICN7ZXhwfSBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaGF2ZSBhIGxlbmd0aCBhYm92ZSAje2V4cH0nXG4gICAgICAgICwgblxuICAgICAgICAsIGxlblxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgb2JqID4gblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGFib3ZlICcgKyBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYXQgbW9zdCAnICsgblxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdhYm92ZScsIGFzc2VydEFib3ZlKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnZ3QnLCBhc3NlcnRBYm92ZSk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2dyZWF0ZXJUaGFuJywgYXNzZXJ0QWJvdmUpO1xuXG4gIC8qKlxuICAgKiAjIyMgLmxlYXN0KHZhbHVlKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGV4cGVjdCgxMCkudG8uYmUuYXQubGVhc3QoMTApO1xuICAgKlxuICAgKiBDYW4gYWxzbyBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggYGxlbmd0aGAgdG9cbiAgICogYXNzZXJ0IGEgbWluaW11bSBsZW5ndGguIFRoZSBiZW5lZml0IGJlaW5nIGFcbiAgICogbW9yZSBpbmZvcm1hdGl2ZSBlcnJvciBtZXNzYWdlIHRoYW4gaWYgdGhlIGxlbmd0aFxuICAgKiB3YXMgc3VwcGxpZWQgZGlyZWN0bHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLm9mLmF0LmxlYXN0KDIpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC5vZi5hdC5sZWFzdCgzKTtcbiAgICpcbiAgICogQG5hbWUgbGVhc3RcbiAgICogQGFsaWFzIGd0ZVxuICAgKiBAcGFyYW0ge051bWJlcn0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRMZWFzdCAobiwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIGlmIChmbGFnKHRoaXMsICdkb0xlbmd0aCcpKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLnByb3BlcnR5KCdsZW5ndGgnKTtcbiAgICAgIHZhciBsZW4gPSBvYmoubGVuZ3RoO1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgbGVuID49IG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIGF0IGxlYXN0ICN7ZXhwfSBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIGJlbG93ICN7ZXhwfSdcbiAgICAgICAgLCBuXG4gICAgICAgICwgbGVuXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBvYmogPj0gblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGF0IGxlYXN0ICcgKyBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYmVsb3cgJyArIG5cbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnbGVhc3QnLCBhc3NlcnRMZWFzdCk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2d0ZScsIGFzc2VydExlYXN0KTtcblxuICAvKipcbiAgICogIyMjIC5iZWxvdyh2YWx1ZSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgbGVzcyB0aGFuIGB2YWx1ZWAuXG4gICAqXG4gICAqICAgICBleHBlY3QoNSkudG8uYmUuYmVsb3coMTApO1xuICAgKlxuICAgKiBDYW4gYWxzbyBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggYGxlbmd0aGAgdG9cbiAgICogYXNzZXJ0IGEgbWF4aW11bSBsZW5ndGguIFRoZSBiZW5lZml0IGJlaW5nIGFcbiAgICogbW9yZSBpbmZvcm1hdGl2ZSBlcnJvciBtZXNzYWdlIHRoYW4gaWYgdGhlIGxlbmd0aFxuICAgKiB3YXMgc3VwcGxpZWQgZGlyZWN0bHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLmJlbG93KDQpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC5iZWxvdyg0KTtcbiAgICpcbiAgICogQG5hbWUgYmVsb3dcbiAgICogQGFsaWFzIGx0XG4gICAqIEBhbGlhcyBsZXNzVGhhblxuICAgKiBAcGFyYW0ge051bWJlcn0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRCZWxvdyAobiwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIGlmIChmbGFnKHRoaXMsICdkb0xlbmd0aCcpKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLnByb3BlcnR5KCdsZW5ndGgnKTtcbiAgICAgIHZhciBsZW4gPSBvYmoubGVuZ3RoO1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgbGVuIDwgblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSBsZW5ndGggYmVsb3cgI3tleHB9IGJ1dCBnb3QgI3thY3R9J1xuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBoYXZlIGEgbGVuZ3RoIGJlbG93ICN7ZXhwfSdcbiAgICAgICAgLCBuXG4gICAgICAgICwgbGVuXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBvYmogPCBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gYmUgYmVsb3cgJyArIG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhdCBsZWFzdCAnICsgblxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdiZWxvdycsIGFzc2VydEJlbG93KTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnbHQnLCBhc3NlcnRCZWxvdyk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2xlc3NUaGFuJywgYXNzZXJ0QmVsb3cpO1xuXG4gIC8qKlxuICAgKiAjIyMgLm1vc3QodmFsdWUpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGlzIGxlc3MgdGhhbiBvciBlcXVhbCB0byBgdmFsdWVgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KDUpLnRvLmJlLmF0Lm1vc3QoNSk7XG4gICAqXG4gICAqIENhbiBhbHNvIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBgbGVuZ3RoYCB0b1xuICAgKiBhc3NlcnQgYSBtYXhpbXVtIGxlbmd0aC4gVGhlIGJlbmVmaXQgYmVpbmcgYVxuICAgKiBtb3JlIGluZm9ybWF0aXZlIGVycm9yIG1lc3NhZ2UgdGhhbiBpZiB0aGUgbGVuZ3RoXG4gICAqIHdhcyBzdXBwbGllZCBkaXJlY3RseS5cbiAgICpcbiAgICogICAgIGV4cGVjdCgnZm9vJykudG8uaGF2ZS5sZW5ndGgub2YuYXQubW9zdCg0KTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uaGF2ZS5sZW5ndGgub2YuYXQubW9zdCgzKTtcbiAgICpcbiAgICogQG5hbWUgbW9zdFxuICAgKiBAYWxpYXMgbHRlXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydE1vc3QgKG4sIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICBpZiAoZmxhZyh0aGlzLCAnZG9MZW5ndGgnKSkge1xuICAgICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgICB2YXIgbGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIGxlbiA8PSBuXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhIGxlbmd0aCBhdCBtb3N0ICN7ZXhwfSBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIGEgbGVuZ3RoIGFib3ZlICN7ZXhwfSdcbiAgICAgICAgLCBuXG4gICAgICAgICwgbGVuXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICBvYmogPD0gblxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGF0IG1vc3QgJyArIG5cbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhYm92ZSAnICsgblxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdtb3N0JywgYXNzZXJ0TW9zdCk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2x0ZScsIGFzc2VydE1vc3QpO1xuXG4gIC8qKlxuICAgKiAjIyMgLndpdGhpbihzdGFydCwgZmluaXNoKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyB3aXRoaW4gYSByYW5nZS5cbiAgICpcbiAgICogICAgIGV4cGVjdCg3KS50by5iZS53aXRoaW4oNSwxMCk7XG4gICAqXG4gICAqIENhbiBhbHNvIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBgbGVuZ3RoYCB0b1xuICAgKiBhc3NlcnQgYSBsZW5ndGggcmFuZ2UuIFRoZSBiZW5lZml0IGJlaW5nIGFcbiAgICogbW9yZSBpbmZvcm1hdGl2ZSBlcnJvciBtZXNzYWdlIHRoYW4gaWYgdGhlIGxlbmd0aFxuICAgKiB3YXMgc3VwcGxpZWQgZGlyZWN0bHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLndpdGhpbigyLDQpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC53aXRoaW4oMiw0KTtcbiAgICpcbiAgICogQG5hbWUgd2l0aGluXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBzdGFydCBsb3dlcmJvdW5kIGluY2x1c2l2ZVxuICAgKiBAcGFyYW0ge051bWJlcn0gZmluaXNoIHVwcGVyYm91bmQgaW5jbHVzaXZlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnd2l0aGluJywgZnVuY3Rpb24gKHN0YXJ0LCBmaW5pc2gsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCByYW5nZSA9IHN0YXJ0ICsgJy4uJyArIGZpbmlzaDtcbiAgICBpZiAoZmxhZyh0aGlzLCAnZG9MZW5ndGgnKSkge1xuICAgICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgICB2YXIgbGVuID0gb2JqLmxlbmd0aDtcbiAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIGxlbiA+PSBzdGFydCAmJiBsZW4gPD0gZmluaXNoXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhIGxlbmd0aCB3aXRoaW4gJyArIHJhbmdlXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGhhdmUgYSBsZW5ndGggd2l0aGluICcgKyByYW5nZVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgb2JqID49IHN0YXJ0ICYmIG9iaiA8PSBmaW5pc2hcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSB3aXRoaW4gJyArIHJhbmdlXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGJlIHdpdGhpbiAnICsgcmFuZ2VcbiAgICAgICk7XG4gICAgfVxuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5pbnN0YW5jZW9mKGNvbnN0cnVjdG9yKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBpcyBhbiBpbnN0YW5jZSBvZiBgY29uc3RydWN0b3JgLlxuICAgKlxuICAgKiAgICAgdmFyIFRlYSA9IGZ1bmN0aW9uIChuYW1lKSB7IHRoaXMubmFtZSA9IG5hbWU7IH1cbiAgICogICAgICAgLCBDaGFpID0gbmV3IFRlYSgnY2hhaScpO1xuICAgKlxuICAgKiAgICAgZXhwZWN0KENoYWkpLnRvLmJlLmFuLmluc3RhbmNlb2YoVGVhKTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uYmUuaW5zdGFuY2VvZihBcnJheSk7XG4gICAqXG4gICAqIEBuYW1lIGluc3RhbmNlb2ZcbiAgICogQHBhcmFtIHtDb25zdHJ1Y3Rvcn0gY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYWxpYXMgaW5zdGFuY2VPZlxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRJbnN0YW5jZU9mIChjb25zdHJ1Y3RvciwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG5hbWUgPSBfLmdldE5hbWUoY29uc3RydWN0b3IpO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBmbGFnKHRoaXMsICdvYmplY3QnKSBpbnN0YW5jZW9mIGNvbnN0cnVjdG9yXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGJlIGFuIGluc3RhbmNlIG9mICcgKyBuYW1lXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBiZSBhbiBpbnN0YW5jZSBvZiAnICsgbmFtZVxuICAgICk7XG4gIH07XG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnaW5zdGFuY2VvZicsIGFzc2VydEluc3RhbmNlT2YpO1xuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdpbnN0YW5jZU9mJywgYXNzZXJ0SW5zdGFuY2VPZik7XG5cbiAgLyoqXG4gICAqICMjIyAucHJvcGVydHkobmFtZSwgW3ZhbHVlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaGFzIGEgcHJvcGVydHkgYG5hbWVgLCBvcHRpb25hbGx5IGFzc2VydGluZyB0aGF0XG4gICAqIHRoZSB2YWx1ZSBvZiB0aGF0IHByb3BlcnR5IGlzIHN0cmljdGx5IGVxdWFsIHRvICBgdmFsdWVgLlxuICAgKiBJZiB0aGUgYGRlZXBgIGZsYWcgaXMgc2V0LCB5b3UgY2FuIHVzZSBkb3QtIGFuZCBicmFja2V0LW5vdGF0aW9uIGZvciBkZWVwXG4gICAqIHJlZmVyZW5jZXMgaW50byBvYmplY3RzIGFuZCBhcnJheXMuXG4gICAqXG4gICAqICAgICAvLyBzaW1wbGUgcmVmZXJlbmNpbmdcbiAgICogICAgIHZhciBvYmogPSB7IGZvbzogJ2JhcicgfTtcbiAgICogICAgIGV4cGVjdChvYmopLnRvLmhhdmUucHJvcGVydHkoJ2ZvbycpO1xuICAgKiAgICAgZXhwZWN0KG9iaikudG8uaGF2ZS5wcm9wZXJ0eSgnZm9vJywgJ2JhcicpO1xuICAgKlxuICAgKiAgICAgLy8gZGVlcCByZWZlcmVuY2luZ1xuICAgKiAgICAgdmFyIGRlZXBPYmogPSB7XG4gICAqICAgICAgICAgZ3JlZW46IHsgdGVhOiAnbWF0Y2hhJyB9XG4gICAqICAgICAgICwgdGVhczogWyAnY2hhaScsICdtYXRjaGEnLCB7IHRlYTogJ2tvbmFjaGEnIH0gXVxuICAgKiAgICAgfTtcblxuICAgKiAgICAgZXhwZWN0KGRlZXBPYmopLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgnZ3JlZW4udGVhJywgJ21hdGNoYScpO1xuICAgKiAgICAgZXhwZWN0KGRlZXBPYmopLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgndGVhc1sxXScsICdtYXRjaGEnKTtcbiAgICogICAgIGV4cGVjdChkZWVwT2JqKS50by5oYXZlLmRlZXAucHJvcGVydHkoJ3RlYXNbMl0udGVhJywgJ2tvbmFjaGEnKTtcbiAgICpcbiAgICogWW91IGNhbiBhbHNvIHVzZSBhbiBhcnJheSBhcyB0aGUgc3RhcnRpbmcgcG9pbnQgb2YgYSBgZGVlcC5wcm9wZXJ0eWBcbiAgICogYXNzZXJ0aW9uLCBvciB0cmF2ZXJzZSBuZXN0ZWQgYXJyYXlzLlxuICAgKlxuICAgKiAgICAgdmFyIGFyciA9IFtcbiAgICogICAgICAgICBbICdjaGFpJywgJ21hdGNoYScsICdrb25hY2hhJyBdXG4gICAqICAgICAgICwgWyB7IHRlYTogJ2NoYWknIH1cbiAgICogICAgICAgICAsIHsgdGVhOiAnbWF0Y2hhJyB9XG4gICAqICAgICAgICAgLCB7IHRlYTogJ2tvbmFjaGEnIH0gXVxuICAgKiAgICAgXTtcbiAgICpcbiAgICogICAgIGV4cGVjdChhcnIpLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eSgnWzBdWzFdJywgJ21hdGNoYScpO1xuICAgKiAgICAgZXhwZWN0KGFycikudG8uaGF2ZS5kZWVwLnByb3BlcnR5KCdbMV1bMl0udGVhJywgJ2tvbmFjaGEnKTtcbiAgICpcbiAgICogRnVydGhlcm1vcmUsIGBwcm9wZXJ0eWAgY2hhbmdlcyB0aGUgc3ViamVjdCBvZiB0aGUgYXNzZXJ0aW9uXG4gICAqIHRvIGJlIHRoZSB2YWx1ZSBvZiB0aGF0IHByb3BlcnR5IGZyb20gdGhlIG9yaWdpbmFsIG9iamVjdC4gVGhpc1xuICAgKiBwZXJtaXRzIGZvciBmdXJ0aGVyIGNoYWluYWJsZSBhc3NlcnRpb25zIG9uIHRoYXQgcHJvcGVydHkuXG4gICAqXG4gICAqICAgICBleHBlY3Qob2JqKS50by5oYXZlLnByb3BlcnR5KCdmb28nKVxuICAgKiAgICAgICAudGhhdC5pcy5hKCdzdHJpbmcnKTtcbiAgICogICAgIGV4cGVjdChkZWVwT2JqKS50by5oYXZlLnByb3BlcnR5KCdncmVlbicpXG4gICAqICAgICAgIC50aGF0LmlzLmFuKCdvYmplY3QnKVxuICAgKiAgICAgICAudGhhdC5kZWVwLmVxdWFscyh7IHRlYTogJ21hdGNoYScgfSk7XG4gICAqICAgICBleHBlY3QoZGVlcE9iaikudG8uaGF2ZS5wcm9wZXJ0eSgndGVhcycpXG4gICAqICAgICAgIC50aGF0LmlzLmFuKCdhcnJheScpXG4gICAqICAgICAgIC53aXRoLmRlZXAucHJvcGVydHkoJ1syXScpXG4gICAqICAgICAgICAgLnRoYXQuZGVlcC5lcXVhbHMoeyB0ZWE6ICdrb25hY2hhJyB9KTtcbiAgICpcbiAgICogQG5hbWUgcHJvcGVydHlcbiAgICogQGFsaWFzIGRlZXAucHJvcGVydHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgKG9wdGlvbmFsKVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEByZXR1cm5zIHZhbHVlIG9mIHByb3BlcnR5IGZvciBjaGFpbmluZ1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdwcm9wZXJ0eScsIGZ1bmN0aW9uIChuYW1lLCB2YWwsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuXG4gICAgdmFyIGRlc2NyaXB0b3IgPSBmbGFnKHRoaXMsICdkZWVwJykgPyAnZGVlcCBwcm9wZXJ0eSAnIDogJ3Byb3BlcnR5ICdcbiAgICAgICwgbmVnYXRlID0gZmxhZyh0aGlzLCAnbmVnYXRlJylcbiAgICAgICwgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0JylcbiAgICAgICwgdmFsdWUgPSBmbGFnKHRoaXMsICdkZWVwJylcbiAgICAgICAgPyBfLmdldFBhdGhWYWx1ZShuYW1lLCBvYmopXG4gICAgICAgIDogb2JqW25hbWVdO1xuXG4gICAgaWYgKG5lZ2F0ZSAmJiB1bmRlZmluZWQgIT09IHZhbCkge1xuICAgICAgaWYgKHVuZGVmaW5lZCA9PT0gdmFsdWUpIHtcbiAgICAgICAgbXNnID0gKG1zZyAhPSBudWxsKSA/IG1zZyArICc6ICcgOiAnJztcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyArIF8uaW5zcGVjdChvYmopICsgJyBoYXMgbm8gJyArIGRlc2NyaXB0b3IgKyBfLmluc3BlY3QobmFtZSkpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICB1bmRlZmluZWQgIT09IHZhbHVlXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhICcgKyBkZXNjcmlwdG9yICsgXy5pbnNwZWN0KG5hbWUpXG4gICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGhhdmUgJyArIGRlc2NyaXB0b3IgKyBfLmluc3BlY3QobmFtZSkpO1xuICAgIH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHZhbCkge1xuICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgdmFsID09PSB2YWx1ZVxuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIGhhdmUgYSAnICsgZGVzY3JpcHRvciArIF8uaW5zcGVjdChuYW1lKSArICcgb2YgI3tleHB9LCBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaGF2ZSBhICcgKyBkZXNjcmlwdG9yICsgXy5pbnNwZWN0KG5hbWUpICsgJyBvZiAje2FjdH0nXG4gICAgICAgICwgdmFsXG4gICAgICAgICwgdmFsdWVcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZmxhZyh0aGlzLCAnb2JqZWN0JywgdmFsdWUpO1xuICB9KTtcblxuXG4gIC8qKlxuICAgKiAjIyMgLm93blByb3BlcnR5KG5hbWUpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGhhcyBhbiBvd24gcHJvcGVydHkgYG5hbWVgLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCd0ZXN0JykudG8uaGF2ZS5vd25Qcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAqXG4gICAqIEBuYW1lIG93blByb3BlcnR5XG4gICAqIEBhbGlhcyBoYXZlT3duUHJvcGVydHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRPd25Qcm9wZXJ0eSAobmFtZSwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBvYmouaGFzT3duUHJvcGVydHkobmFtZSlcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBvd24gcHJvcGVydHkgJyArIF8uaW5zcGVjdChuYW1lKVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgaGF2ZSBvd24gcHJvcGVydHkgJyArIF8uaW5zcGVjdChuYW1lKVxuICAgICk7XG4gIH1cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdvd25Qcm9wZXJ0eScsIGFzc2VydE93blByb3BlcnR5KTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnaGF2ZU93blByb3BlcnR5JywgYXNzZXJ0T3duUHJvcGVydHkpO1xuXG4gIC8qKlxuICAgKiAjIyMgLmxlbmd0aCh2YWx1ZSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQncyBgbGVuZ3RoYCBwcm9wZXJ0eSBoYXNcbiAgICogdGhlIGV4cGVjdGVkIHZhbHVlLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgM10pLnRvLmhhdmUubGVuZ3RoKDMpO1xuICAgKiAgICAgZXhwZWN0KCdmb29iYXInKS50by5oYXZlLmxlbmd0aCg2KTtcbiAgICpcbiAgICogQ2FuIGFsc28gYmUgdXNlZCBhcyBhIGNoYWluIHByZWN1cnNvciB0byBhIHZhbHVlXG4gICAqIGNvbXBhcmlzb24gZm9yIHRoZSBsZW5ndGggcHJvcGVydHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2ZvbycpLnRvLmhhdmUubGVuZ3RoLmFib3ZlKDIpO1xuICAgKiAgICAgZXhwZWN0KFsgMSwgMiwgMyBdKS50by5oYXZlLmxlbmd0aC5hYm92ZSgyKTtcbiAgICogICAgIGV4cGVjdCgnZm9vJykudG8uaGF2ZS5sZW5ndGguYmVsb3coNCk7XG4gICAqICAgICBleHBlY3QoWyAxLCAyLCAzIF0pLnRvLmhhdmUubGVuZ3RoLmJlbG93KDQpO1xuICAgKiAgICAgZXhwZWN0KCdmb28nKS50by5oYXZlLmxlbmd0aC53aXRoaW4oMiw0KTtcbiAgICogICAgIGV4cGVjdChbIDEsIDIsIDMgXSkudG8uaGF2ZS5sZW5ndGgud2l0aGluKDIsNCk7XG4gICAqXG4gICAqIEBuYW1lIGxlbmd0aFxuICAgKiBAYWxpYXMgbGVuZ3RoT2ZcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGxlbmd0aFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFzc2VydExlbmd0aENoYWluICgpIHtcbiAgICBmbGFnKHRoaXMsICdkb0xlbmd0aCcsIHRydWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gYXNzZXJ0TGVuZ3RoIChuLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eSgnbGVuZ3RoJyk7XG4gICAgdmFyIGxlbiA9IG9iai5sZW5ndGg7XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgbGVuID09IG5cbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gaGF2ZSBhIGxlbmd0aCBvZiAje2V4cH0gYnV0IGdvdCAje2FjdH0nXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBoYXZlIGEgbGVuZ3RoIG9mICN7YWN0fSdcbiAgICAgICwgblxuICAgICAgLCBsZW5cbiAgICApO1xuICB9XG5cbiAgQXNzZXJ0aW9uLmFkZENoYWluYWJsZU1ldGhvZCgnbGVuZ3RoJywgYXNzZXJ0TGVuZ3RoLCBhc3NlcnRMZW5ndGhDaGFpbik7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2xlbmd0aE9mJywgYXNzZXJ0TGVuZ3RoLCBhc3NlcnRMZW5ndGhDaGFpbik7XG5cbiAgLyoqXG4gICAqICMjIyAubWF0Y2gocmVnZXhwKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHRhcmdldCBtYXRjaGVzIGEgcmVndWxhciBleHByZXNzaW9uLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KCdmb29iYXInKS50by5tYXRjaCgvXmZvby8pO1xuICAgKlxuICAgKiBAbmFtZSBtYXRjaFxuICAgKiBAcGFyYW0ge1JlZ0V4cH0gUmVndWxhckV4cHJlc3Npb25cbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdtYXRjaCcsIGZ1bmN0aW9uIChyZSwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICByZS5leGVjKG9iailcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbWF0Y2ggJyArIHJlXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IG5vdCB0byBtYXRjaCAnICsgcmVcbiAgICApO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5zdHJpbmcoc3RyaW5nKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIHN0cmluZyB0YXJnZXQgY29udGFpbnMgYW5vdGhlciBzdHJpbmcuXG4gICAqXG4gICAqICAgICBleHBlY3QoJ2Zvb2JhcicpLnRvLmhhdmUuc3RyaW5nKCdiYXInKTtcbiAgICpcbiAgICogQG5hbWUgc3RyaW5nXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmdcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgX29wdGlvbmFsX1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCdzdHJpbmcnLCBmdW5jdGlvbiAoc3RyLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykuaXMuYSgnc3RyaW5nJyk7XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgfm9iai5pbmRleE9mKHN0cilcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gY29udGFpbiAnICsgXy5pbnNwZWN0KHN0cilcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGNvbnRhaW4gJyArIF8uaW5zcGVjdChzdHIpXG4gICAgKTtcbiAgfSk7XG5cblxuICAvKipcbiAgICogIyMjIC5rZXlzKGtleTEsIFtrZXkyXSwgWy4uLl0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgdGFyZ2V0IGhhcyBleGFjdGx5IHRoZSBnaXZlbiBrZXlzLCBvclxuICAgKiBhc3NlcnRzIHRoZSBpbmNsdXNpb24gb2Ygc29tZSBrZXlzIHdoZW4gdXNpbmcgdGhlXG4gICAqIGBpbmNsdWRlYCBvciBgY29udGFpbmAgbW9kaWZpZXJzLlxuICAgKlxuICAgKiAgICAgZXhwZWN0KHsgZm9vOiAxLCBiYXI6IDIgfSkudG8uaGF2ZS5rZXlzKFsnZm9vJywgJ2JhciddKTtcbiAgICogICAgIGV4cGVjdCh7IGZvbzogMSwgYmFyOiAyLCBiYXo6IDMgfSkudG8uY29udGFpbi5rZXlzKCdmb28nLCAnYmFyJyk7XG4gICAqXG4gICAqIEBuYW1lIGtleXNcbiAgICogQGFsaWFzIGtleVxuICAgKiBAcGFyYW0ge1N0cmluZy4uLnxBcnJheX0ga2V5c1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRLZXlzIChrZXlzKSB7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpXG4gICAgICAsIHN0clxuICAgICAgLCBvayA9IHRydWU7XG5cbiAgICBrZXlzID0ga2V5cyBpbnN0YW5jZW9mIEFycmF5XG4gICAgICA/IGtleXNcbiAgICAgIDogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgIGlmICgha2V5cy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcigna2V5cyByZXF1aXJlZCcpO1xuXG4gICAgdmFyIGFjdHVhbCA9IE9iamVjdC5rZXlzKG9iailcbiAgICAgICwgbGVuID0ga2V5cy5sZW5ndGg7XG5cbiAgICAvLyBJbmNsdXNpb25cbiAgICBvayA9IGtleXMuZXZlcnkoZnVuY3Rpb24oa2V5KXtcbiAgICAgIHJldHVybiB+YWN0dWFsLmluZGV4T2Yoa2V5KTtcbiAgICB9KTtcblxuICAgIC8vIFN0cmljdFxuICAgIGlmICghZmxhZyh0aGlzLCAnbmVnYXRlJykgJiYgIWZsYWcodGhpcywgJ2NvbnRhaW5zJykpIHtcbiAgICAgIG9rID0gb2sgJiYga2V5cy5sZW5ndGggPT0gYWN0dWFsLmxlbmd0aDtcbiAgICB9XG5cbiAgICAvLyBLZXkgc3RyaW5nXG4gICAgaWYgKGxlbiA+IDEpIHtcbiAgICAgIGtleXMgPSBrZXlzLm1hcChmdW5jdGlvbihrZXkpe1xuICAgICAgICByZXR1cm4gXy5pbnNwZWN0KGtleSk7XG4gICAgICB9KTtcbiAgICAgIHZhciBsYXN0ID0ga2V5cy5wb3AoKTtcbiAgICAgIHN0ciA9IGtleXMuam9pbignLCAnKSArICcsIGFuZCAnICsgbGFzdDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gXy5pbnNwZWN0KGtleXNbMF0pO1xuICAgIH1cblxuICAgIC8vIEZvcm1cbiAgICBzdHIgPSAobGVuID4gMSA/ICdrZXlzICcgOiAna2V5ICcpICsgc3RyO1xuXG4gICAgLy8gSGF2ZSAvIGluY2x1ZGVcbiAgICBzdHIgPSAoZmxhZyh0aGlzLCAnY29udGFpbnMnKSA/ICdjb250YWluICcgOiAnaGF2ZSAnKSArIHN0cjtcblxuICAgIC8vIEFzc2VydGlvblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBva1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byAnICsgc3RyXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCAnICsgc3RyXG4gICAgKTtcbiAgfVxuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2tleXMnLCBhc3NlcnRLZXlzKTtcbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgna2V5JywgYXNzZXJ0S2V5cyk7XG5cbiAgLyoqXG4gICAqICMjIyAudGhyb3coY29uc3RydWN0b3IpXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCB0aGUgZnVuY3Rpb24gdGFyZ2V0IHdpbGwgdGhyb3cgYSBzcGVjaWZpYyBlcnJvciwgb3Igc3BlY2lmaWMgdHlwZSBvZiBlcnJvclxuICAgKiAoYXMgZGV0ZXJtaW5lZCB1c2luZyBgaW5zdGFuY2VvZmApLCBvcHRpb25hbGx5IHdpdGggYSBSZWdFeHAgb3Igc3RyaW5nIGluY2x1c2lvbiB0ZXN0XG4gICAqIGZvciB0aGUgZXJyb3IncyBtZXNzYWdlLlxuICAgKlxuICAgKiAgICAgdmFyIGVyciA9IG5ldyBSZWZlcmVuY2VFcnJvcignVGhpcyBpcyBhIGJhZCBmdW5jdGlvbi4nKTtcbiAgICogICAgIHZhciBmbiA9IGZ1bmN0aW9uICgpIHsgdGhyb3cgZXJyOyB9XG4gICAqICAgICBleHBlY3QoZm4pLnRvLnRocm93KFJlZmVyZW5jZUVycm9yKTtcbiAgICogICAgIGV4cGVjdChmbikudG8udGhyb3coRXJyb3IpO1xuICAgKiAgICAgZXhwZWN0KGZuKS50by50aHJvdygvYmFkIGZ1bmN0aW9uLyk7XG4gICAqICAgICBleHBlY3QoZm4pLnRvLm5vdC50aHJvdygnZ29vZCBmdW5jdGlvbicpO1xuICAgKiAgICAgZXhwZWN0KGZuKS50by50aHJvdyhSZWZlcmVuY2VFcnJvciwgL2JhZCBmdW5jdGlvbi8pO1xuICAgKiAgICAgZXhwZWN0KGZuKS50by50aHJvdyhlcnIpO1xuICAgKiAgICAgZXhwZWN0KGZuKS50by5ub3QudGhyb3cobmV3IFJhbmdlRXJyb3IoJ091dCBvZiByYW5nZS4nKSk7XG4gICAqXG4gICAqIFBsZWFzZSBub3RlIHRoYXQgd2hlbiBhIHRocm93IGV4cGVjdGF0aW9uIGlzIG5lZ2F0ZWQsIGl0IHdpbGwgY2hlY2sgZWFjaFxuICAgKiBwYXJhbWV0ZXIgaW5kZXBlbmRlbnRseSwgc3RhcnRpbmcgd2l0aCBlcnJvciBjb25zdHJ1Y3RvciB0eXBlLiBUaGUgYXBwcm9wcmlhdGUgd2F5XG4gICAqIHRvIGNoZWNrIGZvciB0aGUgZXhpc3RlbmNlIG9mIGEgdHlwZSBvZiBlcnJvciBidXQgZm9yIGEgbWVzc2FnZSB0aGF0IGRvZXMgbm90IG1hdGNoXG4gICAqIGlzIHRvIHVzZSBgYW5kYC5cbiAgICpcbiAgICogICAgIGV4cGVjdChmbikudG8udGhyb3coUmVmZXJlbmNlRXJyb3IpXG4gICAqICAgICAgICAuYW5kLm5vdC50aHJvdygvZ29vZCBmdW5jdGlvbi8pO1xuICAgKlxuICAgKiBAbmFtZSB0aHJvd1xuICAgKiBAYWxpYXMgdGhyb3dzXG4gICAqIEBhbGlhcyBUaHJvd1xuICAgKiBAcGFyYW0ge0Vycm9yQ29uc3RydWN0b3J9IGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7U3RyaW5nfFJlZ0V4cH0gZXhwZWN0ZWQgZXJyb3IgbWVzc2FnZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRXJyb3IjRXJyb3JfdHlwZXNcbiAgICogQHJldHVybnMgZXJyb3IgZm9yIGNoYWluaW5nIChudWxsIGlmIG5vIGVycm9yKVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBhc3NlcnRUaHJvd3MgKGNvbnN0cnVjdG9yLCBlcnJNc2csIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS5pcy5hKCdmdW5jdGlvbicpO1xuXG4gICAgdmFyIHRocm93biA9IGZhbHNlXG4gICAgICAsIGRlc2lyZWRFcnJvciA9IG51bGxcbiAgICAgICwgbmFtZSA9IG51bGxcbiAgICAgICwgdGhyb3duRXJyb3IgPSBudWxsO1xuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIGVyck1zZyA9IG51bGw7XG4gICAgICBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgfSBlbHNlIGlmIChjb25zdHJ1Y3RvciAmJiAoY29uc3RydWN0b3IgaW5zdGFuY2VvZiBSZWdFeHAgfHwgJ3N0cmluZycgPT09IHR5cGVvZiBjb25zdHJ1Y3RvcikpIHtcbiAgICAgIGVyck1zZyA9IGNvbnN0cnVjdG9yO1xuICAgICAgY29uc3RydWN0b3IgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAoY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgZGVzaXJlZEVycm9yID0gY29uc3RydWN0b3I7XG4gICAgICBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgICBlcnJNc2cgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvbnN0cnVjdG9yID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBuYW1lID0gY29uc3RydWN0b3IucHJvdG90eXBlLm5hbWUgfHwgY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGlmIChuYW1lID09PSAnRXJyb3InICYmIGNvbnN0cnVjdG9yICE9PSBFcnJvcikge1xuICAgICAgICBuYW1lID0gKG5ldyBjb25zdHJ1Y3RvcigpKS5uYW1lO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIG9iaigpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gZmlyc3QsIGNoZWNrIGRlc2lyZWQgZXJyb3JcbiAgICAgIGlmIChkZXNpcmVkRXJyb3IpIHtcbiAgICAgICAgdGhpcy5hc3NlcnQoXG4gICAgICAgICAgICBlcnIgPT09IGRlc2lyZWRFcnJvclxuICAgICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gdGhyb3cgI3tleHB9IGJ1dCAje2FjdH0gd2FzIHRocm93bidcbiAgICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCB0aHJvdyAje2V4cH0nXG4gICAgICAgICAgLCAoZGVzaXJlZEVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBkZXNpcmVkRXJyb3IudG9TdHJpbmcoKSA6IGRlc2lyZWRFcnJvcilcbiAgICAgICAgICAsIChlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci50b1N0cmluZygpIDogZXJyKVxuICAgICAgICApO1xuXG4gICAgICAgIGZsYWcodGhpcywgJ29iamVjdCcsIGVycik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuXG4gICAgICAvLyBuZXh0LCBjaGVjayBjb25zdHJ1Y3RvclxuICAgICAgaWYgKGNvbnN0cnVjdG9yKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgICAgZXJyIGluc3RhbmNlb2YgY29uc3RydWN0b3JcbiAgICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHRocm93ICN7ZXhwfSBidXQgI3thY3R9IHdhcyB0aHJvd24nXG4gICAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgdGhyb3cgI3tleHB9IGJ1dCAje2FjdH0gd2FzIHRocm93bidcbiAgICAgICAgICAsIG5hbWVcbiAgICAgICAgICAsIChlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci50b1N0cmluZygpIDogZXJyKVxuICAgICAgICApO1xuXG4gICAgICAgIGlmICghZXJyTXNnKSB7XG4gICAgICAgICAgZmxhZyh0aGlzLCAnb2JqZWN0JywgZXJyKTtcbiAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBuZXh0LCBjaGVjayBtZXNzYWdlXG4gICAgICB2YXIgbWVzc2FnZSA9ICdvYmplY3QnID09PSBfLnR5cGUoZXJyKSAmJiBcIm1lc3NhZ2VcIiBpbiBlcnJcbiAgICAgICAgPyBlcnIubWVzc2FnZVxuICAgICAgICA6ICcnICsgZXJyO1xuXG4gICAgICBpZiAoKG1lc3NhZ2UgIT0gbnVsbCkgJiYgZXJyTXNnICYmIGVyck1zZyBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICAgIGVyck1zZy5leGVjKG1lc3NhZ2UpXG4gICAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byB0aHJvdyBlcnJvciBtYXRjaGluZyAje2V4cH0gYnV0IGdvdCAje2FjdH0nXG4gICAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byB0aHJvdyBlcnJvciBub3QgbWF0Y2hpbmcgI3tleHB9J1xuICAgICAgICAgICwgZXJyTXNnXG4gICAgICAgICAgLCBtZXNzYWdlXG4gICAgICAgICk7XG5cbiAgICAgICAgZmxhZyh0aGlzLCAnb2JqZWN0JywgZXJyKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2UgaWYgKChtZXNzYWdlICE9IG51bGwpICYmIGVyck1zZyAmJiAnc3RyaW5nJyA9PT0gdHlwZW9mIGVyck1zZykge1xuICAgICAgICB0aGlzLmFzc2VydChcbiAgICAgICAgICAgIH5tZXNzYWdlLmluZGV4T2YoZXJyTXNnKVxuICAgICAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gdGhyb3cgZXJyb3IgaW5jbHVkaW5nICN7ZXhwfSBidXQgZ290ICN7YWN0fSdcbiAgICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHRocm93IGVycm9yIG5vdCBpbmNsdWRpbmcgI3thY3R9J1xuICAgICAgICAgICwgZXJyTXNnXG4gICAgICAgICAgLCBtZXNzYWdlXG4gICAgICAgICk7XG5cbiAgICAgICAgZmxhZyh0aGlzLCAnb2JqZWN0JywgZXJyKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvd24gPSB0cnVlO1xuICAgICAgICB0aHJvd25FcnJvciA9IGVycjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgYWN0dWFsbHlHb3QgPSAnJ1xuICAgICAgLCBleHBlY3RlZFRocm93biA9IG5hbWUgIT09IG51bGxcbiAgICAgICAgPyBuYW1lXG4gICAgICAgIDogZGVzaXJlZEVycm9yXG4gICAgICAgICAgPyAnI3tleHB9JyAvL18uaW5zcGVjdChkZXNpcmVkRXJyb3IpXG4gICAgICAgICAgOiAnYW4gZXJyb3InO1xuXG4gICAgaWYgKHRocm93bikge1xuICAgICAgYWN0dWFsbHlHb3QgPSAnIGJ1dCAje2FjdH0gd2FzIHRocm93bidcbiAgICB9XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgdGhyb3duID09PSB0cnVlXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIHRocm93ICcgKyBleHBlY3RlZFRocm93biArIGFjdHVhbGx5R290XG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCB0aHJvdyAnICsgZXhwZWN0ZWRUaHJvd24gKyBhY3R1YWxseUdvdFxuICAgICAgLCAoZGVzaXJlZEVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBkZXNpcmVkRXJyb3IudG9TdHJpbmcoKSA6IGRlc2lyZWRFcnJvcilcbiAgICAgICwgKHRocm93bkVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyB0aHJvd25FcnJvci50b1N0cmluZygpIDogdGhyb3duRXJyb3IpXG4gICAgKTtcblxuICAgIGZsYWcodGhpcywgJ29iamVjdCcsIHRocm93bkVycm9yKTtcbiAgfTtcblxuICBBc3NlcnRpb24uYWRkTWV0aG9kKCd0aHJvdycsIGFzc2VydFRocm93cyk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ3Rocm93cycsIGFzc2VydFRocm93cyk7XG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ1Rocm93JywgYXNzZXJ0VGhyb3dzKTtcblxuICAvKipcbiAgICogIyMjIC5yZXNwb25kVG8obWV0aG9kKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgdGhlIG9iamVjdCBvciBjbGFzcyB0YXJnZXQgd2lsbCByZXNwb25kIHRvIGEgbWV0aG9kLlxuICAgKlxuICAgKiAgICAgS2xhc3MucHJvdG90eXBlLmJhciA9IGZ1bmN0aW9uKCl7fTtcbiAgICogICAgIGV4cGVjdChLbGFzcykudG8ucmVzcG9uZFRvKCdiYXInKTtcbiAgICogICAgIGV4cGVjdChvYmopLnRvLnJlc3BvbmRUbygnYmFyJyk7XG4gICAqXG4gICAqIFRvIGNoZWNrIGlmIGEgY29uc3RydWN0b3Igd2lsbCByZXNwb25kIHRvIGEgc3RhdGljIGZ1bmN0aW9uLFxuICAgKiBzZXQgdGhlIGBpdHNlbGZgIGZsYWcuXG4gICAqXG4gICAqICAgICBLbGFzcy5iYXogPSBmdW5jdGlvbigpe307XG4gICAqICAgICBleHBlY3QoS2xhc3MpLml0c2VsZi50by5yZXNwb25kVG8oJ2JheicpO1xuICAgKlxuICAgKiBAbmFtZSByZXNwb25kVG9cbiAgICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ3Jlc3BvbmRUbycsIGZ1bmN0aW9uIChtZXRob2QsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKVxuICAgICAgLCBpdHNlbGYgPSBmbGFnKHRoaXMsICdpdHNlbGYnKVxuICAgICAgLCBjb250ZXh0ID0gKCdmdW5jdGlvbicgPT09IF8udHlwZShvYmopICYmICFpdHNlbGYpXG4gICAgICAgID8gb2JqLnByb3RvdHlwZVttZXRob2RdXG4gICAgICAgIDogb2JqW21ldGhvZF07XG5cbiAgICB0aGlzLmFzc2VydChcbiAgICAgICAgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRleHRcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gcmVzcG9uZCB0byAnICsgXy5pbnNwZWN0KG1ldGhvZClcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IHJlc3BvbmQgdG8gJyArIF8uaW5zcGVjdChtZXRob2QpXG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqICMjIyAuaXRzZWxmXG4gICAqXG4gICAqIFNldHMgdGhlIGBpdHNlbGZgIGZsYWcsIGxhdGVyIHVzZWQgYnkgdGhlIGByZXNwb25kVG9gIGFzc2VydGlvbi5cbiAgICpcbiAgICogICAgIGZ1bmN0aW9uIEZvbygpIHt9XG4gICAqICAgICBGb28uYmFyID0gZnVuY3Rpb24oKSB7fVxuICAgKiAgICAgRm9vLnByb3RvdHlwZS5iYXogPSBmdW5jdGlvbigpIHt9XG4gICAqXG4gICAqICAgICBleHBlY3QoRm9vKS5pdHNlbGYudG8ucmVzcG9uZFRvKCdiYXInKTtcbiAgICogICAgIGV4cGVjdChGb28pLml0c2VsZi5ub3QudG8ucmVzcG9uZFRvKCdiYXonKTtcbiAgICpcbiAgICogQG5hbWUgaXRzZWxmXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRQcm9wZXJ0eSgnaXRzZWxmJywgZnVuY3Rpb24gKCkge1xuICAgIGZsYWcodGhpcywgJ2l0c2VsZicsIHRydWUpO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5zYXRpc2Z5KG1ldGhvZClcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgcGFzc2VzIGEgZ2l2ZW4gdHJ1dGggdGVzdC5cbiAgICpcbiAgICogICAgIGV4cGVjdCgxKS50by5zYXRpc2Z5KGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gbnVtID4gMDsgfSk7XG4gICAqXG4gICAqIEBuYW1lIHNhdGlzZnlcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbWF0Y2hlclxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ3NhdGlzZnknLCBmdW5jdGlvbiAobWF0Y2hlciwgbXNnKSB7XG4gICAgaWYgKG1zZykgZmxhZyh0aGlzLCAnbWVzc2FnZScsIG1zZyk7XG4gICAgdmFyIG9iaiA9IGZsYWcodGhpcywgJ29iamVjdCcpO1xuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBtYXRjaGVyKG9iailcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gc2F0aXNmeSAnICsgXy5vYmpEaXNwbGF5KG1hdGNoZXIpXG4gICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBzYXRpc2Z5JyArIF8ub2JqRGlzcGxheShtYXRjaGVyKVxuICAgICAgLCB0aGlzLm5lZ2F0ZSA/IGZhbHNlIDogdHJ1ZVxuICAgICAgLCBtYXRjaGVyKG9iailcbiAgICApO1xuICB9KTtcblxuICAvKipcbiAgICogIyMjIC5jbG9zZVRvKGV4cGVjdGVkLCBkZWx0YSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgZXF1YWwgYGV4cGVjdGVkYCwgdG8gd2l0aGluIGEgKy8tIGBkZWx0YWAgcmFuZ2UuXG4gICAqXG4gICAqICAgICBleHBlY3QoMS41KS50by5iZS5jbG9zZVRvKDEsIDAuNSk7XG4gICAqXG4gICAqIEBuYW1lIGNsb3NlVG9cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBkZWx0YVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSBfb3B0aW9uYWxfXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIEFzc2VydGlvbi5hZGRNZXRob2QoJ2Nsb3NlVG8nLCBmdW5jdGlvbiAoZXhwZWN0ZWQsIGRlbHRhLCBtc2cpIHtcbiAgICBpZiAobXNnKSBmbGFnKHRoaXMsICdtZXNzYWdlJywgbXNnKTtcbiAgICB2YXIgb2JqID0gZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gICAgdGhpcy5hc3NlcnQoXG4gICAgICAgIE1hdGguYWJzKG9iaiAtIGV4cGVjdGVkKSA8PSBkZWx0YVxuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBjbG9zZSB0byAnICsgZXhwZWN0ZWQgKyAnICsvLSAnICsgZGVsdGFcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gbm90IHRvIGJlIGNsb3NlIHRvICcgKyBleHBlY3RlZCArICcgKy8tICcgKyBkZWx0YVxuICAgICk7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGlzU3Vic2V0T2Yoc3Vic2V0LCBzdXBlcnNldCwgY21wKSB7XG4gICAgcmV0dXJuIHN1YnNldC5ldmVyeShmdW5jdGlvbihlbGVtKSB7XG4gICAgICBpZiAoIWNtcCkgcmV0dXJuIHN1cGVyc2V0LmluZGV4T2YoZWxlbSkgIT09IC0xO1xuXG4gICAgICByZXR1cm4gc3VwZXJzZXQuc29tZShmdW5jdGlvbihlbGVtMikge1xuICAgICAgICByZXR1cm4gY21wKGVsZW0sIGVsZW0yKTtcbiAgICAgIH0pO1xuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogIyMjIC5tZW1iZXJzKHNldClcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgYSBzdXBlcnNldCBvZiBgc2V0YCxcbiAgICogb3IgdGhhdCB0aGUgdGFyZ2V0IGFuZCBgc2V0YCBoYXZlIHRoZSBzYW1lIHN0cmljdGx5LWVxdWFsICg9PT0pIG1lbWJlcnMuXG4gICAqIEFsdGVybmF0ZWx5LCBpZiB0aGUgYGRlZXBgIGZsYWcgaXMgc2V0LCBzZXQgbWVtYmVycyBhcmUgY29tcGFyZWQgZm9yIGRlZXBcbiAgICogZXF1YWxpdHkuXG4gICAqXG4gICAqICAgICBleHBlY3QoWzEsIDIsIDNdKS50by5pbmNsdWRlLm1lbWJlcnMoWzMsIDJdKTtcbiAgICogICAgIGV4cGVjdChbMSwgMiwgM10pLnRvLm5vdC5pbmNsdWRlLm1lbWJlcnMoWzMsIDIsIDhdKTtcbiAgICpcbiAgICogICAgIGV4cGVjdChbNCwgMl0pLnRvLmhhdmUubWVtYmVycyhbMiwgNF0pO1xuICAgKiAgICAgZXhwZWN0KFs1LCAyXSkudG8ubm90LmhhdmUubWVtYmVycyhbNSwgMiwgMV0pO1xuICAgKlxuICAgKiAgICAgZXhwZWN0KFt7IGlkOiAxIH1dKS50by5kZWVwLmluY2x1ZGUubWVtYmVycyhbeyBpZDogMSB9XSk7XG4gICAqXG4gICAqIEBuYW1lIG1lbWJlcnNcbiAgICogQHBhcmFtIHtBcnJheX0gc2V0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlIF9vcHRpb25hbF9cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQXNzZXJ0aW9uLmFkZE1ldGhvZCgnbWVtYmVycycsIGZ1bmN0aW9uIChzdWJzZXQsIG1zZykge1xuICAgIGlmIChtc2cpIGZsYWcodGhpcywgJ21lc3NhZ2UnLCBtc2cpO1xuICAgIHZhciBvYmogPSBmbGFnKHRoaXMsICdvYmplY3QnKTtcblxuICAgIG5ldyBBc3NlcnRpb24ob2JqKS50by5iZS5hbignYXJyYXknKTtcbiAgICBuZXcgQXNzZXJ0aW9uKHN1YnNldCkudG8uYmUuYW4oJ2FycmF5Jyk7XG5cbiAgICB2YXIgY21wID0gZmxhZyh0aGlzLCAnZGVlcCcpID8gXy5lcWwgOiB1bmRlZmluZWQ7XG5cbiAgICBpZiAoZmxhZyh0aGlzLCAnY29udGFpbnMnKSkge1xuICAgICAgcmV0dXJuIHRoaXMuYXNzZXJ0KFxuICAgICAgICAgIGlzU3Vic2V0T2Yoc3Vic2V0LCBvYmosIGNtcClcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBiZSBhIHN1cGVyc2V0IG9mICN7YWN0fSdcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgYmUgYSBzdXBlcnNldCBvZiAje2FjdH0nXG4gICAgICAgICwgb2JqXG4gICAgICAgICwgc3Vic2V0XG4gICAgICApO1xuICAgIH1cblxuICAgIHRoaXMuYXNzZXJ0KFxuICAgICAgICBpc1N1YnNldE9mKG9iaiwgc3Vic2V0LCBjbXApICYmIGlzU3Vic2V0T2Yoc3Vic2V0LCBvYmosIGNtcClcbiAgICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBoYXZlIHRoZSBzYW1lIG1lbWJlcnMgYXMgI3thY3R9J1xuICAgICAgICAsICdleHBlY3RlZCAje3RoaXN9IHRvIG5vdCBoYXZlIHRoZSBzYW1lIG1lbWJlcnMgYXMgI3thY3R9J1xuICAgICAgICAsIG9ialxuICAgICAgICAsIHN1YnNldFxuICAgICk7XG4gIH0pO1xufTtcbiIsIi8qIVxuICogY2hhaVxuICogQ29weXJpZ2h0KGMpIDIwMTEtMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY2hhaSwgdXRpbCkge1xuXG4gIC8qIVxuICAgKiBDaGFpIGRlcGVuZGVuY2llcy5cbiAgICovXG5cbiAgdmFyIEFzc2VydGlvbiA9IGNoYWkuQXNzZXJ0aW9uXG4gICAgLCBmbGFnID0gdXRpbC5mbGFnO1xuXG4gIC8qIVxuICAgKiBNb2R1bGUgZXhwb3J0LlxuICAgKi9cblxuICAvKipcbiAgICogIyMjIGFzc2VydChleHByZXNzaW9uLCBtZXNzYWdlKVxuICAgKlxuICAgKiBXcml0ZSB5b3VyIG93biB0ZXN0IGV4cHJlc3Npb25zLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0KCdmb28nICE9PSAnYmFyJywgJ2ZvbyBpcyBub3QgYmFyJyk7XG4gICAqICAgICBhc3NlcnQoQXJyYXkuaXNBcnJheShbXSksICdlbXB0eSBhcnJheXMgYXJlIGFycmF5cycpO1xuICAgKlxuICAgKiBAcGFyYW0ge01peGVkfSBleHByZXNzaW9uIHRvIHRlc3QgZm9yIHRydXRoaW5lc3NcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgdG8gZGlzcGxheSBvbiBlcnJvclxuICAgKiBAbmFtZSBhc3NlcnRcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgdmFyIGFzc2VydCA9IGNoYWkuYXNzZXJ0ID0gZnVuY3Rpb24gKGV4cHJlc3MsIGVycm1zZykge1xuICAgIHZhciB0ZXN0ID0gbmV3IEFzc2VydGlvbihudWxsLCBudWxsLCBjaGFpLmFzc2VydCk7XG4gICAgdGVzdC5hc3NlcnQoXG4gICAgICAgIGV4cHJlc3NcbiAgICAgICwgZXJybXNnXG4gICAgICAsICdbIG5lZ2F0aW9uIG1lc3NhZ2UgdW5hdmFpbGFibGUgXSdcbiAgICApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmZhaWwoYWN0dWFsLCBleHBlY3RlZCwgW21lc3NhZ2VdLCBbb3BlcmF0b3JdKVxuICAgKlxuICAgKiBUaHJvdyBhIGZhaWx1cmUuIE5vZGUuanMgYGFzc2VydGAgbW9kdWxlLWNvbXBhdGlibGUuXG4gICAqXG4gICAqIEBuYW1lIGZhaWxcbiAgICogQHBhcmFtIHtNaXhlZH0gYWN0dWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcGVyYXRvclxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuZmFpbCA9IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCBvcGVyYXRvcikge1xuICAgIG1lc3NhZ2UgPSBtZXNzYWdlIHx8ICdhc3NlcnQuZmFpbCgpJztcbiAgICB0aHJvdyBuZXcgY2hhaS5Bc3NlcnRpb25FcnJvcihtZXNzYWdlLCB7XG4gICAgICAgIGFjdHVhbDogYWN0dWFsXG4gICAgICAsIGV4cGVjdGVkOiBleHBlY3RlZFxuICAgICAgLCBvcGVyYXRvcjogb3BlcmF0b3JcbiAgICB9LCBhc3NlcnQuZmFpbCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAub2sob2JqZWN0LCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBpcyB0cnV0aHkuXG4gICAqXG4gICAqICAgICBhc3NlcnQub2soJ2V2ZXJ5dGhpbmcnLCAnZXZlcnl0aGluZyBpcyBvaycpO1xuICAgKiAgICAgYXNzZXJ0Lm9rKGZhbHNlLCAndGhpcyB3aWxsIGZhaWwnKTtcbiAgICpcbiAgICogQG5hbWUgb2tcbiAgICogQHBhcmFtIHtNaXhlZH0gb2JqZWN0IHRvIHRlc3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm9rID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykuaXMub2s7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90T2sob2JqZWN0LCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBpcyBmYWxzeS5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3RPaygnZXZlcnl0aGluZycsICd0aGlzIHdpbGwgZmFpbCcpO1xuICAgKiAgICAgYXNzZXJ0Lm5vdE9rKGZhbHNlLCAndGhpcyB3aWxsIHBhc3MnKTtcbiAgICpcbiAgICogQG5hbWUgbm90T2tcbiAgICogQHBhcmFtIHtNaXhlZH0gb2JqZWN0IHRvIHRlc3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdE9rID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykuaXMubm90Lm9rO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyBub24tc3RyaWN0IGVxdWFsaXR5IChgPT1gKSBvZiBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5lcXVhbCgzLCAnMycsICc9PSBjb2VyY2VzIHZhbHVlcyB0byBzdHJpbmdzJyk7XG4gICAqXG4gICAqIEBuYW1lIGVxdWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuZXF1YWwgPSBmdW5jdGlvbiAoYWN0LCBleHAsIG1zZykge1xuICAgIHZhciB0ZXN0ID0gbmV3IEFzc2VydGlvbihhY3QsIG1zZywgYXNzZXJ0LmVxdWFsKTtcblxuICAgIHRlc3QuYXNzZXJ0KFxuICAgICAgICBleHAgPT0gZmxhZyh0ZXN0LCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gZXF1YWwgI3tleHB9J1xuICAgICAgLCAnZXhwZWN0ZWQgI3t0aGlzfSB0byBub3QgZXF1YWwgI3thY3R9J1xuICAgICAgLCBleHBcbiAgICAgICwgYWN0XG4gICAgKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgbm9uLXN0cmljdCBpbmVxdWFsaXR5IChgIT1gKSBvZiBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3RFcXVhbCgzLCA0LCAndGhlc2UgbnVtYmVycyBhcmUgbm90IGVxdWFsJyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdEVxdWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90RXF1YWwgPSBmdW5jdGlvbiAoYWN0LCBleHAsIG1zZykge1xuICAgIHZhciB0ZXN0ID0gbmV3IEFzc2VydGlvbihhY3QsIG1zZywgYXNzZXJ0Lm5vdEVxdWFsKTtcblxuICAgIHRlc3QuYXNzZXJ0KFxuICAgICAgICBleHAgIT0gZmxhZyh0ZXN0LCAnb2JqZWN0JylcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gbm90IGVxdWFsICN7ZXhwfSdcbiAgICAgICwgJ2V4cGVjdGVkICN7dGhpc30gdG8gZXF1YWwgI3thY3R9J1xuICAgICAgLCBleHBcbiAgICAgICwgYWN0XG4gICAgKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgc3RyaWN0IGVxdWFsaXR5IChgPT09YCkgb2YgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQuc3RyaWN0RXF1YWwodHJ1ZSwgdHJ1ZSwgJ3RoZXNlIGJvb2xlYW5zIGFyZSBzdHJpY3RseSBlcXVhbCcpO1xuICAgKlxuICAgKiBAbmFtZSBzdHJpY3RFcXVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBhY3R1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LnN0cmljdEVxdWFsID0gZnVuY3Rpb24gKGFjdCwgZXhwLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGFjdCwgbXNnKS50by5lcXVhbChleHApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyBzdHJpY3QgaW5lcXVhbGl0eSAoYCE9PWApIG9mIGBhY3R1YWxgIGFuZCBgZXhwZWN0ZWRgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm5vdFN0cmljdEVxdWFsKDMsICczJywgJ25vIGNvZXJjaW9uIGZvciBzdHJpY3QgZXF1YWxpdHknKTtcbiAgICpcbiAgICogQG5hbWUgbm90U3RyaWN0RXF1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gYWN0dWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV4cGVjdGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3RTdHJpY3RFcXVhbCA9IGZ1bmN0aW9uIChhY3QsIGV4cCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihhY3QsIG1zZykudG8ubm90LmVxdWFsKGV4cCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuZGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBhY3R1YWxgIGlzIGRlZXBseSBlcXVhbCB0byBgZXhwZWN0ZWRgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmRlZXBFcXVhbCh7IHRlYTogJ2dyZWVuJyB9LCB7IHRlYTogJ2dyZWVuJyB9KTtcbiAgICpcbiAgICogQG5hbWUgZGVlcEVxdWFsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGFjdHVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBleHBlY3RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuZGVlcEVxdWFsID0gZnVuY3Rpb24gKGFjdCwgZXhwLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGFjdCwgbXNnKS50by5lcWwoZXhwKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3REZWVwRXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnQgdGhhdCBgYWN0dWFsYCBpcyBub3QgZGVlcGx5IGVxdWFsIHRvIGBleHBlY3RlZGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQubm90RGVlcEVxdWFsKHsgdGVhOiAnZ3JlZW4nIH0sIHsgdGVhOiAnamFzbWluZScgfSk7XG4gICAqXG4gICAqIEBuYW1lIG5vdERlZXBFcXVhbFxuICAgKiBAcGFyYW0ge01peGVkfSBhY3R1YWxcbiAgICogQHBhcmFtIHtNaXhlZH0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdERlZXBFcXVhbCA9IGZ1bmN0aW9uIChhY3QsIGV4cCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihhY3QsIG1zZykudG8ubm90LmVxbChleHApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzVHJ1ZSh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyB0cnVlLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYVNlcnZlZCA9IHRydWU7XG4gICAqICAgICBhc3NlcnQuaXNUcnVlKHRlYVNlcnZlZCwgJ3RoZSB0ZWEgaGFzIGJlZW4gc2VydmVkJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzVHJ1ZVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNUcnVlID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykuaXNbJ3RydWUnXTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc0ZhbHNlKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGZhbHNlLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYVNlcnZlZCA9IGZhbHNlO1xuICAgKiAgICAgYXNzZXJ0LmlzRmFsc2UodGVhU2VydmVkLCAnbm8gdGVhIHlldD8gaG1tLi4uJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzRmFsc2VcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzRmFsc2UgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS5pc1snZmFsc2UnXTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc051bGwodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgbnVsbC5cbiAgICpcbiAgICogICAgIGFzc2VydC5pc051bGwoZXJyLCAndGhlcmUgd2FzIG5vIGVycm9yJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzTnVsbFxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNOdWxsID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uZXF1YWwobnVsbCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOb3ROdWxsKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIG5vdCBudWxsLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYSA9ICd0YXN0eSBjaGFpJztcbiAgICogICAgIGFzc2VydC5pc05vdE51bGwodGVhLCAnZ3JlYXQsIHRpbWUgZm9yIHRlYSEnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOb3ROdWxsXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc05vdE51bGwgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuZXF1YWwobnVsbCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNVbmRlZmluZWQodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYHVuZGVmaW5lZGAuXG4gICAqXG4gICAqICAgICB2YXIgdGVhO1xuICAgKiAgICAgYXNzZXJ0LmlzVW5kZWZpbmVkKHRlYSwgJ25vIHRlYSBkZWZpbmVkJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzVW5kZWZpbmVkXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc1VuZGVmaW5lZCA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmVxdWFsKHVuZGVmaW5lZCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNEZWZpbmVkKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIG5vdCBgdW5kZWZpbmVkYC5cbiAgICpcbiAgICogICAgIHZhciB0ZWEgPSAnY3VwIG9mIGNoYWknO1xuICAgKiAgICAgYXNzZXJ0LmlzRGVmaW5lZCh0ZWEsICd0ZWEgaGFzIGJlZW4gZGVmaW5lZCcpO1xuICAgKlxuICAgKiBAbmFtZSBpc0RlZmluZWRcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzRGVmaW5lZCA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5lcXVhbCh1bmRlZmluZWQpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzRnVuY3Rpb24odmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYSBmdW5jdGlvbi5cbiAgICpcbiAgICogICAgIGZ1bmN0aW9uIHNlcnZlVGVhKCkgeyByZXR1cm4gJ2N1cCBvZiB0ZWEnOyB9O1xuICAgKiAgICAgYXNzZXJ0LmlzRnVuY3Rpb24oc2VydmVUZWEsICdncmVhdCwgd2UgY2FuIGhhdmUgdGVhIG5vdycpO1xuICAgKlxuICAgKiBAbmFtZSBpc0Z1bmN0aW9uXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc0Z1bmN0aW9uID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uYmUuYSgnZnVuY3Rpb24nKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc05vdEZ1bmN0aW9uKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIF9ub3RfIGEgZnVuY3Rpb24uXG4gICAqXG4gICAqICAgICB2YXIgc2VydmVUZWEgPSBbICdoZWF0JywgJ3BvdXInLCAnc2lwJyBdO1xuICAgKiAgICAgYXNzZXJ0LmlzTm90RnVuY3Rpb24oc2VydmVUZWEsICdncmVhdCwgd2UgaGF2ZSBsaXN0ZWQgdGhlIHN0ZXBzJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzTm90RnVuY3Rpb25cbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTm90RnVuY3Rpb24gPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUuYSgnZnVuY3Rpb24nKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5pc09iamVjdCh2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBhbiBvYmplY3QgKGFzIHJldmVhbGVkIGJ5XG4gICAqIGBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nYCkuXG4gICAqXG4gICAqICAgICB2YXIgc2VsZWN0aW9uID0geyBuYW1lOiAnQ2hhaScsIHNlcnZlOiAnd2l0aCBzcGljZXMnIH07XG4gICAqICAgICBhc3NlcnQuaXNPYmplY3Qoc2VsZWN0aW9uLCAndGVhIHNlbGVjdGlvbiBpcyBhbiBvYmplY3QnKTtcbiAgICpcbiAgICogQG5hbWUgaXNPYmplY3RcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzT2JqZWN0ID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uYmUuYSgnb2JqZWN0Jyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOb3RPYmplY3QodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgX25vdF8gYW4gb2JqZWN0LlxuICAgKlxuICAgKiAgICAgdmFyIHNlbGVjdGlvbiA9ICdjaGFpJ1xuICAgKiAgICAgYXNzZXJ0LmlzTm90T2JqZWN0KHNlbGVjdGlvbiwgJ3RlYSBzZWxlY3Rpb24gaXMgbm90IGFuIG9iamVjdCcpO1xuICAgKiAgICAgYXNzZXJ0LmlzTm90T2JqZWN0KG51bGwsICdudWxsIGlzIG5vdCBhbiBvYmplY3QnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOb3RPYmplY3RcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTm90T2JqZWN0ID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmEoJ29iamVjdCcpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzQXJyYXkodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYW4gYXJyYXkuXG4gICAqXG4gICAqICAgICB2YXIgbWVudSA9IFsgJ2dyZWVuJywgJ2NoYWknLCAnb29sb25nJyBdO1xuICAgKiAgICAgYXNzZXJ0LmlzQXJyYXkobWVudSwgJ3doYXQga2luZCBvZiB0ZWEgZG8gd2Ugd2FudD8nKTtcbiAgICpcbiAgICogQG5hbWUgaXNBcnJheVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNBcnJheSA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmJlLmFuKCdhcnJheScpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTm90QXJyYXkodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgX25vdF8gYW4gYXJyYXkuXG4gICAqXG4gICAqICAgICB2YXIgbWVudSA9ICdncmVlbnxjaGFpfG9vbG9uZyc7XG4gICAqICAgICBhc3NlcnQuaXNOb3RBcnJheShtZW51LCAnd2hhdCBraW5kIG9mIHRlYSBkbyB3ZSB3YW50PycpO1xuICAgKlxuICAgKiBAbmFtZSBpc05vdEFycmF5XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc05vdEFycmF5ID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmFuKCdhcnJheScpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzU3RyaW5nKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGEgc3RyaW5nLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYU9yZGVyID0gJ2NoYWknO1xuICAgKiAgICAgYXNzZXJ0LmlzU3RyaW5nKHRlYU9yZGVyLCAnb3JkZXIgcGxhY2VkJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzU3RyaW5nXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc1N0cmluZyA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmJlLmEoJ3N0cmluZycpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTm90U3RyaW5nKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIF9ub3RfIGEgc3RyaW5nLlxuICAgKlxuICAgKiAgICAgdmFyIHRlYU9yZGVyID0gNDtcbiAgICogICAgIGFzc2VydC5pc05vdFN0cmluZyh0ZWFPcmRlciwgJ29yZGVyIHBsYWNlZCcpO1xuICAgKlxuICAgKiBAbmFtZSBpc05vdFN0cmluZ1xuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNOb3RTdHJpbmcgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUuYSgnc3RyaW5nJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaXNOdW1iZXIodmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgaXMgYSBudW1iZXIuXG4gICAqXG4gICAqICAgICB2YXIgY3VwcyA9IDI7XG4gICAqICAgICBhc3NlcnQuaXNOdW1iZXIoY3VwcywgJ2hvdyBtYW55IGN1cHMnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOdW1iZXJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc051bWJlciA9IGZ1bmN0aW9uICh2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLmJlLmEoJ251bWJlcicpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTm90TnVtYmVyKHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIF9ub3RfIGEgbnVtYmVyLlxuICAgKlxuICAgKiAgICAgdmFyIGN1cHMgPSAnMiBjdXBzIHBsZWFzZSc7XG4gICAqICAgICBhc3NlcnQuaXNOb3ROdW1iZXIoY3VwcywgJ2hvdyBtYW55IGN1cHMnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOb3ROdW1iZXJcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LmlzTm90TnVtYmVyID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmEoJ251bWJlcicpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzQm9vbGVhbih2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBhIGJvb2xlYW4uXG4gICAqXG4gICAqICAgICB2YXIgdGVhUmVhZHkgPSB0cnVlXG4gICAqICAgICAgICwgdGVhU2VydmVkID0gZmFsc2U7XG4gICAqXG4gICAqICAgICBhc3NlcnQuaXNCb29sZWFuKHRlYVJlYWR5LCAnaXMgdGhlIHRlYSByZWFkeScpO1xuICAgKiAgICAgYXNzZXJ0LmlzQm9vbGVhbih0ZWFTZXJ2ZWQsICdoYXMgdGVhIGJlZW4gc2VydmVkJyk7XG4gICAqXG4gICAqIEBuYW1lIGlzQm9vbGVhblxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaXNCb29sZWFuID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8uYmUuYSgnYm9vbGVhbicpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmlzTm90Qm9vbGVhbih2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCBpcyBfbm90XyBhIGJvb2xlYW4uXG4gICAqXG4gICAqICAgICB2YXIgdGVhUmVhZHkgPSAneWVwJ1xuICAgKiAgICAgICAsIHRlYVNlcnZlZCA9ICdub3BlJztcbiAgICpcbiAgICogICAgIGFzc2VydC5pc05vdEJvb2xlYW4odGVhUmVhZHksICdpcyB0aGUgdGVhIHJlYWR5Jyk7XG4gICAqICAgICBhc3NlcnQuaXNOb3RCb29sZWFuKHRlYVNlcnZlZCwgJ2hhcyB0ZWEgYmVlbiBzZXJ2ZWQnKTtcbiAgICpcbiAgICogQG5hbWUgaXNOb3RCb29sZWFuXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pc05vdEJvb2xlYW4gPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5ub3QuYmUuYSgnYm9vbGVhbicpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLnR5cGVPZih2YWx1ZSwgbmFtZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCdzIHR5cGUgaXMgYG5hbWVgLCBhcyBkZXRlcm1pbmVkIGJ5XG4gICAqIGBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nYC5cbiAgICpcbiAgICogICAgIGFzc2VydC50eXBlT2YoeyB0ZWE6ICdjaGFpJyB9LCAnb2JqZWN0JywgJ3dlIGhhdmUgYW4gb2JqZWN0Jyk7XG4gICAqICAgICBhc3NlcnQudHlwZU9mKFsnY2hhaScsICdqYXNtaW5lJ10sICdhcnJheScsICd3ZSBoYXZlIGFuIGFycmF5Jyk7XG4gICAqICAgICBhc3NlcnQudHlwZU9mKCd0ZWEnLCAnc3RyaW5nJywgJ3dlIGhhdmUgYSBzdHJpbmcnKTtcbiAgICogICAgIGFzc2VydC50eXBlT2YoL3RlYS8sICdyZWdleHAnLCAnd2UgaGF2ZSBhIHJlZ3VsYXIgZXhwcmVzc2lvbicpO1xuICAgKiAgICAgYXNzZXJ0LnR5cGVPZihudWxsLCAnbnVsbCcsICd3ZSBoYXZlIGEgbnVsbCcpO1xuICAgKiAgICAgYXNzZXJ0LnR5cGVPZih1bmRlZmluZWQsICd1bmRlZmluZWQnLCAnd2UgaGF2ZSBhbiB1bmRlZmluZWQnKTtcbiAgICpcbiAgICogQG5hbWUgdHlwZU9mXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC50eXBlT2YgPSBmdW5jdGlvbiAodmFsLCB0eXBlLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5iZS5hKHR5cGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdFR5cGVPZih2YWx1ZSwgbmFtZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHZhbHVlYCdzIHR5cGUgaXMgX25vdF8gYG5hbWVgLCBhcyBkZXRlcm1pbmVkIGJ5XG4gICAqIGBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3RUeXBlT2YoJ3RlYScsICdudW1iZXInLCAnc3RyaW5ncyBhcmUgbm90IG51bWJlcnMnKTtcbiAgICpcbiAgICogQG5hbWUgbm90VHlwZU9mXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlb2YgbmFtZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90VHlwZU9mID0gZnVuY3Rpb24gKHZhbCwgdHlwZSwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmEodHlwZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaW5zdGFuY2VPZihvYmplY3QsIGNvbnN0cnVjdG9yLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIGlzIGFuIGluc3RhbmNlIG9mIGBjb25zdHJ1Y3RvcmAuXG4gICAqXG4gICAqICAgICB2YXIgVGVhID0gZnVuY3Rpb24gKG5hbWUpIHsgdGhpcy5uYW1lID0gbmFtZTsgfVxuICAgKiAgICAgICAsIGNoYWkgPSBuZXcgVGVhKCdjaGFpJyk7XG4gICAqXG4gICAqICAgICBhc3NlcnQuaW5zdGFuY2VPZihjaGFpLCBUZWEsICdjaGFpIGlzIGFuIGluc3RhbmNlIG9mIHRlYScpO1xuICAgKlxuICAgKiBAbmFtZSBpbnN0YW5jZU9mXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtDb25zdHJ1Y3Rvcn0gY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lmluc3RhbmNlT2YgPSBmdW5jdGlvbiAodmFsLCB0eXBlLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5iZS5pbnN0YW5jZU9mKHR5cGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdEluc3RhbmNlT2Yob2JqZWN0LCBjb25zdHJ1Y3RvciwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIGB2YWx1ZWAgaXMgbm90IGFuIGluc3RhbmNlIG9mIGBjb25zdHJ1Y3RvcmAuXG4gICAqXG4gICAqICAgICB2YXIgVGVhID0gZnVuY3Rpb24gKG5hbWUpIHsgdGhpcy5uYW1lID0gbmFtZTsgfVxuICAgKiAgICAgICAsIGNoYWkgPSBuZXcgU3RyaW5nKCdjaGFpJyk7XG4gICAqXG4gICAqICAgICBhc3NlcnQubm90SW5zdGFuY2VPZihjaGFpLCBUZWEsICdjaGFpIGlzIG5vdCBhbiBpbnN0YW5jZSBvZiB0ZWEnKTtcbiAgICpcbiAgICogQG5hbWUgbm90SW5zdGFuY2VPZlxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7Q29uc3RydWN0b3J9IGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3RJbnN0YW5jZU9mID0gZnVuY3Rpb24gKHZhbCwgdHlwZSwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLmluc3RhbmNlT2YodHlwZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuaW5jbHVkZShoYXlzdGFjaywgbmVlZGxlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgaGF5c3RhY2tgIGluY2x1ZGVzIGBuZWVkbGVgLiBXb3Jrc1xuICAgKiBmb3Igc3RyaW5ncyBhbmQgYXJyYXlzLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmluY2x1ZGUoJ2Zvb2JhcicsICdiYXInLCAnZm9vYmFyIGNvbnRhaW5zIHN0cmluZyBcImJhclwiJyk7XG4gICAqICAgICBhc3NlcnQuaW5jbHVkZShbIDEsIDIsIDMgXSwgMywgJ2FycmF5IGNvbnRhaW5zIHZhbHVlJyk7XG4gICAqXG4gICAqIEBuYW1lIGluY2x1ZGVcbiAgICogQHBhcmFtIHtBcnJheXxTdHJpbmd9IGhheXN0YWNrXG4gICAqIEBwYXJhbSB7TWl4ZWR9IG5lZWRsZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuaW5jbHVkZSA9IGZ1bmN0aW9uIChleHAsIGluYywgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihleHAsIG1zZywgYXNzZXJ0LmluY2x1ZGUpLmluY2x1ZGUoaW5jKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3RJbmNsdWRlKGhheXN0YWNrLCBuZWVkbGUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBoYXlzdGFja2AgZG9lcyBub3QgaW5jbHVkZSBgbmVlZGxlYC4gV29ya3NcbiAgICogZm9yIHN0cmluZ3MgYW5kIGFycmF5cy5cbiAgICppXG4gICAqICAgICBhc3NlcnQubm90SW5jbHVkZSgnZm9vYmFyJywgJ2JheicsICdzdHJpbmcgbm90IGluY2x1ZGUgc3Vic3RyaW5nJyk7XG4gICAqICAgICBhc3NlcnQubm90SW5jbHVkZShbIDEsIDIsIDMgXSwgNCwgJ2FycmF5IG5vdCBpbmNsdWRlIGNvbnRhaW4gdmFsdWUnKTtcbiAgICpcbiAgICogQG5hbWUgbm90SW5jbHVkZVxuICAgKiBAcGFyYW0ge0FycmF5fFN0cmluZ30gaGF5c3RhY2tcbiAgICogQHBhcmFtIHtNaXhlZH0gbmVlZGxlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5ub3RJbmNsdWRlID0gZnVuY3Rpb24gKGV4cCwgaW5jLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKGV4cCwgbXNnLCBhc3NlcnQubm90SW5jbHVkZSkubm90LmluY2x1ZGUoaW5jKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5tYXRjaCh2YWx1ZSwgcmVnZXhwLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgdmFsdWVgIG1hdGNoZXMgdGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiBgcmVnZXhwYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5tYXRjaCgnZm9vYmFyJywgL15mb28vLCAncmVnZXhwIG1hdGNoZXMnKTtcbiAgICpcbiAgICogQG5hbWUgbWF0Y2hcbiAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcbiAgICogQHBhcmFtIHtSZWdFeHB9IHJlZ2V4cFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubWF0Y2ggPSBmdW5jdGlvbiAoZXhwLCByZSwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihleHAsIG1zZykudG8ubWF0Y2gocmUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLm5vdE1hdGNoKHZhbHVlLCByZWdleHAsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGB2YWx1ZWAgZG9lcyBub3QgbWF0Y2ggdGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiBgcmVnZXhwYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3RNYXRjaCgnZm9vYmFyJywgL15mb28vLCAncmVnZXhwIGRvZXMgbm90IG1hdGNoJyk7XG4gICAqXG4gICAqIEBuYW1lIG5vdE1hdGNoXG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7UmVnRXhwfSByZWdleHBcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdE1hdGNoID0gZnVuY3Rpb24gKGV4cCwgcmUsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oZXhwLCBtc2cpLnRvLm5vdC5tYXRjaChyZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAucHJvcGVydHkob2JqZWN0LCBwcm9wZXJ0eSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaGFzIGEgcHJvcGVydHkgbmFtZWQgYnkgYHByb3BlcnR5YC5cbiAgICpcbiAgICogICAgIGFzc2VydC5wcm9wZXJ0eSh7IHRlYTogeyBncmVlbjogJ21hdGNoYScgfX0sICd0ZWEnKTtcbiAgICpcbiAgICogQG5hbWUgcHJvcGVydHlcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LnByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgcHJvcCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eShwcm9wKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5ub3RQcm9wZXJ0eShvYmplY3QsIHByb3BlcnR5LCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBkb2VzIF9ub3RfIGhhdmUgYSBwcm9wZXJ0eSBuYW1lZCBieSBgcHJvcGVydHlgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm5vdFByb3BlcnR5KHsgdGVhOiB7IGdyZWVuOiAnbWF0Y2hhJyB9fSwgJ2NvZmZlZScpO1xuICAgKlxuICAgKiBAbmFtZSBub3RQcm9wZXJ0eVxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubm90UHJvcGVydHkgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5ub3QuaGF2ZS5wcm9wZXJ0eShwcm9wKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5kZWVwUHJvcGVydHkob2JqZWN0LCBwcm9wZXJ0eSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaGFzIGEgcHJvcGVydHkgbmFtZWQgYnkgYHByb3BlcnR5YCwgd2hpY2ggY2FuIGJlIGFcbiAgICogc3RyaW5nIHVzaW5nIGRvdC0gYW5kIGJyYWNrZXQtbm90YXRpb24gZm9yIGRlZXAgcmVmZXJlbmNlLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LmRlZXBQcm9wZXJ0eSh7IHRlYTogeyBncmVlbjogJ21hdGNoYScgfX0sICd0ZWEuZ3JlZW4nKTtcbiAgICpcbiAgICogQG5hbWUgZGVlcFByb3BlcnR5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5kZWVwUHJvcGVydHkgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKG9iaiwgbXNnKS50by5oYXZlLmRlZXAucHJvcGVydHkocHJvcCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAubm90RGVlcFByb3BlcnR5KG9iamVjdCwgcHJvcGVydHksIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGRvZXMgX25vdF8gaGF2ZSBhIHByb3BlcnR5IG5hbWVkIGJ5IGBwcm9wZXJ0eWAsIHdoaWNoXG4gICAqIGNhbiBiZSBhIHN0cmluZyB1c2luZyBkb3QtIGFuZCBicmFja2V0LW5vdGF0aW9uIGZvciBkZWVwIHJlZmVyZW5jZS5cbiAgICpcbiAgICogICAgIGFzc2VydC5ub3REZWVwUHJvcGVydHkoeyB0ZWE6IHsgZ3JlZW46ICdtYXRjaGEnIH19LCAndGVhLm9vbG9uZycpO1xuICAgKlxuICAgKiBAbmFtZSBub3REZWVwUHJvcGVydHlcbiAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcGVydHlcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0Lm5vdERlZXBQcm9wZXJ0eSA9IGZ1bmN0aW9uIChvYmosIHByb3AsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLm5vdC5oYXZlLmRlZXAucHJvcGVydHkocHJvcCk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAucHJvcGVydHlWYWwob2JqZWN0LCBwcm9wZXJ0eSwgdmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGhhcyBhIHByb3BlcnR5IG5hbWVkIGJ5IGBwcm9wZXJ0eWAgd2l0aCB2YWx1ZSBnaXZlblxuICAgKiBieSBgdmFsdWVgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0LnByb3BlcnR5VmFsKHsgdGVhOiAnaXMgZ29vZCcgfSwgJ3RlYScsICdpcyBnb29kJyk7XG4gICAqXG4gICAqIEBuYW1lIHByb3BlcnR5VmFsXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5wcm9wZXJ0eVZhbCA9IGZ1bmN0aW9uIChvYmosIHByb3AsIHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8uaGF2ZS5wcm9wZXJ0eShwcm9wLCB2YWwpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLnByb3BlcnR5Tm90VmFsKG9iamVjdCwgcHJvcGVydHksIHZhbHVlLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgb2JqZWN0YCBoYXMgYSBwcm9wZXJ0eSBuYW1lZCBieSBgcHJvcGVydHlgLCBidXQgd2l0aCBhIHZhbHVlXG4gICAqIGRpZmZlcmVudCBmcm9tIHRoYXQgZ2l2ZW4gYnkgYHZhbHVlYC5cbiAgICpcbiAgICogICAgIGFzc2VydC5wcm9wZXJ0eU5vdFZhbCh7IHRlYTogJ2lzIGdvb2QnIH0sICd0ZWEnLCAnaXMgYmFkJyk7XG4gICAqXG4gICAqIEBuYW1lIHByb3BlcnR5Tm90VmFsXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5wcm9wZXJ0eU5vdFZhbCA9IGZ1bmN0aW9uIChvYmosIHByb3AsIHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihvYmosIG1zZykudG8ubm90LmhhdmUucHJvcGVydHkocHJvcCwgdmFsKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5kZWVwUHJvcGVydHlWYWwob2JqZWN0LCBwcm9wZXJ0eSwgdmFsdWUsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IGBvYmplY3RgIGhhcyBhIHByb3BlcnR5IG5hbWVkIGJ5IGBwcm9wZXJ0eWAgd2l0aCB2YWx1ZSBnaXZlblxuICAgKiBieSBgdmFsdWVgLiBgcHJvcGVydHlgIGNhbiB1c2UgZG90LSBhbmQgYnJhY2tldC1ub3RhdGlvbiBmb3IgZGVlcFxuICAgKiByZWZlcmVuY2UuXG4gICAqXG4gICAqICAgICBhc3NlcnQuZGVlcFByb3BlcnR5VmFsKHsgdGVhOiB7IGdyZWVuOiAnbWF0Y2hhJyB9fSwgJ3RlYS5ncmVlbicsICdtYXRjaGEnKTtcbiAgICpcbiAgICogQG5hbWUgZGVlcFByb3BlcnR5VmFsXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5kZWVwUHJvcGVydHlWYWwgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCB2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLmhhdmUuZGVlcC5wcm9wZXJ0eShwcm9wLCB2YWwpO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmRlZXBQcm9wZXJ0eU5vdFZhbChvYmplY3QsIHByb3BlcnR5LCB2YWx1ZSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaGFzIGEgcHJvcGVydHkgbmFtZWQgYnkgYHByb3BlcnR5YCwgYnV0IHdpdGggYSB2YWx1ZVxuICAgKiBkaWZmZXJlbnQgZnJvbSB0aGF0IGdpdmVuIGJ5IGB2YWx1ZWAuIGBwcm9wZXJ0eWAgY2FuIHVzZSBkb3QtIGFuZFxuICAgKiBicmFja2V0LW5vdGF0aW9uIGZvciBkZWVwIHJlZmVyZW5jZS5cbiAgICpcbiAgICogICAgIGFzc2VydC5kZWVwUHJvcGVydHlOb3RWYWwoeyB0ZWE6IHsgZ3JlZW46ICdtYXRjaGEnIH19LCAndGVhLmdyZWVuJywgJ2tvbmFjaGEnKTtcbiAgICpcbiAgICogQG5hbWUgZGVlcFByb3BlcnR5Tm90VmFsXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5kZWVwUHJvcGVydHlOb3RWYWwgPSBmdW5jdGlvbiAob2JqLCBwcm9wLCB2YWwsIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24ob2JqLCBtc2cpLnRvLm5vdC5oYXZlLmRlZXAucHJvcGVydHkocHJvcCwgdmFsKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5sZW5ndGhPZihvYmplY3QsIGxlbmd0aCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYG9iamVjdGAgaGFzIGEgYGxlbmd0aGAgcHJvcGVydHkgd2l0aCB0aGUgZXhwZWN0ZWQgdmFsdWUuXG4gICAqXG4gICAqICAgICBhc3NlcnQubGVuZ3RoT2YoWzEsMiwzXSwgMywgJ2FycmF5IGhhcyBsZW5ndGggb2YgMycpO1xuICAgKiAgICAgYXNzZXJ0Lmxlbmd0aE9mKCdmb29iYXInLCA1LCAnc3RyaW5nIGhhcyBsZW5ndGggb2YgNicpO1xuICAgKlxuICAgKiBAbmFtZSBsZW5ndGhPZlxuICAgKiBAcGFyYW0ge01peGVkfSBvYmplY3RcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGxlbmd0aFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQubGVuZ3RoT2YgPSBmdW5jdGlvbiAoZXhwLCBsZW4sIG1zZykge1xuICAgIG5ldyBBc3NlcnRpb24oZXhwLCBtc2cpLnRvLmhhdmUubGVuZ3RoKGxlbik7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAudGhyb3dzKGZ1bmN0aW9uLCBbY29uc3RydWN0b3Ivc3RyaW5nL3JlZ2V4cF0sIFtzdHJpbmcvcmVnZXhwXSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYGZ1bmN0aW9uYCB3aWxsIHRocm93IGFuIGVycm9yIHRoYXQgaXMgYW4gaW5zdGFuY2Ugb2ZcbiAgICogYGNvbnN0cnVjdG9yYCwgb3IgYWx0ZXJuYXRlbHkgdGhhdCBpdCB3aWxsIHRocm93IGFuIGVycm9yIHdpdGggbWVzc2FnZVxuICAgKiBtYXRjaGluZyBgcmVnZXhwYC5cbiAgICpcbiAgICogICAgIGFzc2VydC50aHJvdyhmbiwgJ2Z1bmN0aW9uIHRocm93cyBhIHJlZmVyZW5jZSBlcnJvcicpO1xuICAgKiAgICAgYXNzZXJ0LnRocm93KGZuLCAvZnVuY3Rpb24gdGhyb3dzIGEgcmVmZXJlbmNlIGVycm9yLyk7XG4gICAqICAgICBhc3NlcnQudGhyb3coZm4sIFJlZmVyZW5jZUVycm9yKTtcbiAgICogICAgIGFzc2VydC50aHJvdyhmbiwgUmVmZXJlbmNlRXJyb3IsICdmdW5jdGlvbiB0aHJvd3MgYSByZWZlcmVuY2UgZXJyb3InKTtcbiAgICogICAgIGFzc2VydC50aHJvdyhmbiwgUmVmZXJlbmNlRXJyb3IsIC9mdW5jdGlvbiB0aHJvd3MgYSByZWZlcmVuY2UgZXJyb3IvKTtcbiAgICpcbiAgICogQG5hbWUgdGhyb3dzXG4gICAqIEBhbGlhcyB0aHJvd1xuICAgKiBAYWxpYXMgVGhyb3dcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuY3Rpb25cbiAgICogQHBhcmFtIHtFcnJvckNvbnN0cnVjdG9yfSBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge1JlZ0V4cH0gcmVnZXhwXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRXJyb3IjRXJyb3JfdHlwZXNcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgYXNzZXJ0LlRocm93ID0gZnVuY3Rpb24gKGZuLCBlcnJ0LCBlcnJzLCBtc2cpIHtcbiAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiBlcnJ0IHx8IGVycnQgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIGVycnMgPSBlcnJ0O1xuICAgICAgZXJydCA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIGFzc2VydEVyciA9IG5ldyBBc3NlcnRpb24oZm4sIG1zZykudG8uVGhyb3coZXJydCwgZXJycyk7XG4gICAgcmV0dXJuIGZsYWcoYXNzZXJ0RXJyLCAnb2JqZWN0Jyk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAuZG9lc05vdFRocm93KGZ1bmN0aW9uLCBbY29uc3RydWN0b3IvcmVnZXhwXSwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYGZ1bmN0aW9uYCB3aWxsIF9ub3RfIHRocm93IGFuIGVycm9yIHRoYXQgaXMgYW4gaW5zdGFuY2Ugb2ZcbiAgICogYGNvbnN0cnVjdG9yYCwgb3IgYWx0ZXJuYXRlbHkgdGhhdCBpdCB3aWxsIG5vdCB0aHJvdyBhbiBlcnJvciB3aXRoIG1lc3NhZ2VcbiAgICogbWF0Y2hpbmcgYHJlZ2V4cGAuXG4gICAqXG4gICAqICAgICBhc3NlcnQuZG9lc05vdFRocm93KGZuLCBFcnJvciwgJ2Z1bmN0aW9uIGRvZXMgbm90IHRocm93Jyk7XG4gICAqXG4gICAqIEBuYW1lIGRvZXNOb3RUaHJvd1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jdGlvblxuICAgKiBAcGFyYW0ge0Vycm9yQ29uc3RydWN0b3J9IGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7UmVnRXhwfSByZWdleHBcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9FcnJvciNFcnJvcl90eXBlc1xuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuZG9lc05vdFRocm93ID0gZnVuY3Rpb24gKGZuLCB0eXBlLCBtc2cpIHtcbiAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiB0eXBlKSB7XG4gICAgICBtc2cgPSB0eXBlO1xuICAgICAgdHlwZSA9IG51bGw7XG4gICAgfVxuXG4gICAgbmV3IEFzc2VydGlvbihmbiwgbXNnKS50by5ub3QuVGhyb3codHlwZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqICMjIyAub3BlcmF0b3IodmFsMSwgb3BlcmF0b3IsIHZhbDIsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQ29tcGFyZXMgdHdvIHZhbHVlcyB1c2luZyBgb3BlcmF0b3JgLlxuICAgKlxuICAgKiAgICAgYXNzZXJ0Lm9wZXJhdG9yKDEsICc8JywgMiwgJ2V2ZXJ5dGhpbmcgaXMgb2snKTtcbiAgICogICAgIGFzc2VydC5vcGVyYXRvcigxLCAnPicsIDIsICd0aGlzIHdpbGwgZmFpbCcpO1xuICAgKlxuICAgKiBAbmFtZSBvcGVyYXRvclxuICAgKiBAcGFyYW0ge01peGVkfSB2YWwxXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcGVyYXRvclxuICAgKiBAcGFyYW0ge01peGVkfSB2YWwyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5vcGVyYXRvciA9IGZ1bmN0aW9uICh2YWwsIG9wZXJhdG9yLCB2YWwyLCBtc2cpIHtcbiAgICBpZiAoIX5bJz09JywgJz09PScsICc+JywgJz49JywgJzwnLCAnPD0nLCAnIT0nLCAnIT09J10uaW5kZXhPZihvcGVyYXRvcikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBvcGVyYXRvciBcIicgKyBvcGVyYXRvciArICdcIicpO1xuICAgIH1cbiAgICB2YXIgdGVzdCA9IG5ldyBBc3NlcnRpb24oZXZhbCh2YWwgKyBvcGVyYXRvciArIHZhbDIpLCBtc2cpO1xuICAgIHRlc3QuYXNzZXJ0KFxuICAgICAgICB0cnVlID09PSBmbGFnKHRlc3QsICdvYmplY3QnKVxuICAgICAgLCAnZXhwZWN0ZWQgJyArIHV0aWwuaW5zcGVjdCh2YWwpICsgJyB0byBiZSAnICsgb3BlcmF0b3IgKyAnICcgKyB1dGlsLmluc3BlY3QodmFsMilcbiAgICAgICwgJ2V4cGVjdGVkICcgKyB1dGlsLmluc3BlY3QodmFsKSArICcgdG8gbm90IGJlICcgKyBvcGVyYXRvciArICcgJyArIHV0aWwuaW5zcGVjdCh2YWwyKSApO1xuICB9O1xuXG4gIC8qKlxuICAgKiAjIyMgLmNsb3NlVG8oYWN0dWFsLCBleHBlY3RlZCwgZGVsdGEsIFttZXNzYWdlXSlcbiAgICpcbiAgICogQXNzZXJ0cyB0aGF0IHRoZSB0YXJnZXQgaXMgZXF1YWwgYGV4cGVjdGVkYCwgdG8gd2l0aGluIGEgKy8tIGBkZWx0YWAgcmFuZ2UuXG4gICAqXG4gICAqICAgICBhc3NlcnQuY2xvc2VUbygxLjUsIDEsIDAuNSwgJ251bWJlcnMgYXJlIGNsb3NlJyk7XG4gICAqXG4gICAqIEBuYW1lIGNsb3NlVG9cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGFjdHVhbFxuICAgKiBAcGFyYW0ge051bWJlcn0gZXhwZWN0ZWRcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbHRhXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5jbG9zZVRvID0gZnVuY3Rpb24gKGFjdCwgZXhwLCBkZWx0YSwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihhY3QsIG1zZykudG8uYmUuY2xvc2VUbyhleHAsIGRlbHRhKTtcbiAgfTtcblxuICAvKipcbiAgICogIyMjIC5zYW1lTWVtYmVycyhzZXQxLCBzZXQyLCBbbWVzc2FnZV0pXG4gICAqXG4gICAqIEFzc2VydHMgdGhhdCBgc2V0MWAgYW5kIGBzZXQyYCBoYXZlIHRoZSBzYW1lIG1lbWJlcnMuXG4gICAqIE9yZGVyIGlzIG5vdCB0YWtlbiBpbnRvIGFjY291bnQuXG4gICAqXG4gICAqICAgICBhc3NlcnQuc2FtZU1lbWJlcnMoWyAxLCAyLCAzIF0sIFsgMiwgMSwgMyBdLCAnc2FtZSBtZW1iZXJzJyk7XG4gICAqXG4gICAqIEBuYW1lIHNhbWVNZW1iZXJzXG4gICAqIEBwYXJhbSB7QXJyYXl9IHN1cGVyc2V0XG4gICAqIEBwYXJhbSB7QXJyYXl9IHN1YnNldFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBhc3NlcnQuc2FtZU1lbWJlcnMgPSBmdW5jdGlvbiAoc2V0MSwgc2V0MiwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbihzZXQxLCBtc2cpLnRvLmhhdmUuc2FtZS5tZW1iZXJzKHNldDIpO1xuICB9XG5cbiAgLyoqXG4gICAqICMjIyAuaW5jbHVkZU1lbWJlcnMoc3VwZXJzZXQsIHN1YnNldCwgW21lc3NhZ2VdKVxuICAgKlxuICAgKiBBc3NlcnRzIHRoYXQgYHN1YnNldGAgaXMgaW5jbHVkZWQgaW4gYHN1cGVyc2V0YC5cbiAgICogT3JkZXIgaXMgbm90IHRha2VuIGludG8gYWNjb3VudC5cbiAgICpcbiAgICogICAgIGFzc2VydC5pbmNsdWRlTWVtYmVycyhbIDEsIDIsIDMgXSwgWyAyLCAxIF0sICdpbmNsdWRlIG1lbWJlcnMnKTtcbiAgICpcbiAgICogQG5hbWUgaW5jbHVkZU1lbWJlcnNcbiAgICogQHBhcmFtIHtBcnJheX0gc3VwZXJzZXRcbiAgICogQHBhcmFtIHtBcnJheX0gc3Vic2V0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIGFzc2VydC5pbmNsdWRlTWVtYmVycyA9IGZ1bmN0aW9uIChzdXBlcnNldCwgc3Vic2V0LCBtc2cpIHtcbiAgICBuZXcgQXNzZXJ0aW9uKHN1cGVyc2V0LCBtc2cpLnRvLmluY2x1ZGUubWVtYmVycyhzdWJzZXQpO1xuICB9XG5cbiAgLyohXG4gICAqIFVuZG9jdW1lbnRlZCAvIHVudGVzdGVkXG4gICAqL1xuXG4gIGFzc2VydC5pZkVycm9yID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgbmV3IEFzc2VydGlvbih2YWwsIG1zZykudG8ubm90LmJlLm9rO1xuICB9O1xuXG4gIC8qIVxuICAgKiBBbGlhc2VzLlxuICAgKi9cblxuICAoZnVuY3Rpb24gYWxpYXMobmFtZSwgYXMpe1xuICAgIGFzc2VydFthc10gPSBhc3NlcnRbbmFtZV07XG4gICAgcmV0dXJuIGFsaWFzO1xuICB9KVxuICAoJ1Rocm93JywgJ3Rocm93JylcbiAgKCdUaHJvdycsICd0aHJvd3MnKTtcbn07XG4iLCIvKiFcbiAqIGNoYWlcbiAqIENvcHlyaWdodChjKSAyMDExLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjaGFpLCB1dGlsKSB7XG4gIGNoYWkuZXhwZWN0ID0gZnVuY3Rpb24gKHZhbCwgbWVzc2FnZSkge1xuICAgIHJldHVybiBuZXcgY2hhaS5Bc3NlcnRpb24odmFsLCBtZXNzYWdlKTtcbiAgfTtcbn07XG5cbiIsIi8qIVxuICogY2hhaVxuICogQ29weXJpZ2h0KGMpIDIwMTEtMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNoYWksIHV0aWwpIHtcbiAgdmFyIEFzc2VydGlvbiA9IGNoYWkuQXNzZXJ0aW9uO1xuXG4gIGZ1bmN0aW9uIGxvYWRTaG91bGQgKCkge1xuICAgIC8vIGV4cGxpY2l0bHkgZGVmaW5lIHRoaXMgbWV0aG9kIGFzIGZ1bmN0aW9uIGFzIHRvIGhhdmUgaXQncyBuYW1lIHRvIGluY2x1ZGUgYXMgYHNzZmlgXG4gICAgZnVuY3Rpb24gc2hvdWxkR2V0dGVyKCkge1xuICAgICAgaWYgKHRoaXMgaW5zdGFuY2VvZiBTdHJpbmcgfHwgdGhpcyBpbnN0YW5jZW9mIE51bWJlcikge1xuICAgICAgICByZXR1cm4gbmV3IEFzc2VydGlvbih0aGlzLmNvbnN0cnVjdG9yKHRoaXMpLCBudWxsLCBzaG91bGRHZXR0ZXIpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzIGluc3RhbmNlb2YgQm9vbGVhbikge1xuICAgICAgICByZXR1cm4gbmV3IEFzc2VydGlvbih0aGlzID09IHRydWUsIG51bGwsIHNob3VsZEdldHRlcik7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IEFzc2VydGlvbih0aGlzLCBudWxsLCBzaG91bGRHZXR0ZXIpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBzaG91bGRTZXR0ZXIodmFsdWUpIHtcbiAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vY2hhaWpzL2NoYWkvaXNzdWVzLzg2OiB0aGlzIG1ha2VzXG4gICAgICAvLyBgd2hhdGV2ZXIuc2hvdWxkID0gc29tZVZhbHVlYCBhY3R1YWxseSBzZXQgYHNvbWVWYWx1ZWAsIHdoaWNoIGlzXG4gICAgICAvLyBlc3BlY2lhbGx5IHVzZWZ1bCBmb3IgYGdsb2JhbC5zaG91bGQgPSByZXF1aXJlKCdjaGFpJykuc2hvdWxkKClgLlxuICAgICAgLy9cbiAgICAgIC8vIE5vdGUgdGhhdCB3ZSBoYXZlIHRvIHVzZSBbW0RlZmluZVByb3BlcnR5XV0gaW5zdGVhZCBvZiBbW1B1dF1dXG4gICAgICAvLyBzaW5jZSBvdGhlcndpc2Ugd2Ugd291bGQgdHJpZ2dlciB0aGlzIHZlcnkgc2V0dGVyIVxuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdzaG91bGQnLCB7XG4gICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIG1vZGlmeSBPYmplY3QucHJvdG90eXBlIHRvIGhhdmUgYHNob3VsZGBcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoT2JqZWN0LnByb3RvdHlwZSwgJ3Nob3VsZCcsIHtcbiAgICAgIHNldDogc2hvdWxkU2V0dGVyXG4gICAgICAsIGdldDogc2hvdWxkR2V0dGVyXG4gICAgICAsIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgdmFyIHNob3VsZCA9IHt9O1xuXG4gICAgc2hvdWxkLmVxdWFsID0gZnVuY3Rpb24gKHZhbDEsIHZhbDIsIG1zZykge1xuICAgICAgbmV3IEFzc2VydGlvbih2YWwxLCBtc2cpLnRvLmVxdWFsKHZhbDIpO1xuICAgIH07XG5cbiAgICBzaG91bGQuVGhyb3cgPSBmdW5jdGlvbiAoZm4sIGVycnQsIGVycnMsIG1zZykge1xuICAgICAgbmV3IEFzc2VydGlvbihmbiwgbXNnKS50by5UaHJvdyhlcnJ0LCBlcnJzKTtcbiAgICB9O1xuXG4gICAgc2hvdWxkLmV4aXN0ID0gZnVuY3Rpb24gKHZhbCwgbXNnKSB7XG4gICAgICBuZXcgQXNzZXJ0aW9uKHZhbCwgbXNnKS50by5leGlzdDtcbiAgICB9XG5cbiAgICAvLyBuZWdhdGlvblxuICAgIHNob3VsZC5ub3QgPSB7fVxuXG4gICAgc2hvdWxkLm5vdC5lcXVhbCA9IGZ1bmN0aW9uICh2YWwxLCB2YWwyLCBtc2cpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24odmFsMSwgbXNnKS50by5ub3QuZXF1YWwodmFsMik7XG4gICAgfTtcblxuICAgIHNob3VsZC5ub3QuVGhyb3cgPSBmdW5jdGlvbiAoZm4sIGVycnQsIGVycnMsIG1zZykge1xuICAgICAgbmV3IEFzc2VydGlvbihmbiwgbXNnKS50by5ub3QuVGhyb3coZXJydCwgZXJycyk7XG4gICAgfTtcblxuICAgIHNob3VsZC5ub3QuZXhpc3QgPSBmdW5jdGlvbiAodmFsLCBtc2cpIHtcbiAgICAgIG5ldyBBc3NlcnRpb24odmFsLCBtc2cpLnRvLm5vdC5leGlzdDtcbiAgICB9XG5cbiAgICBzaG91bGRbJ3Rocm93J10gPSBzaG91bGRbJ1Rocm93J107XG4gICAgc2hvdWxkLm5vdFsndGhyb3cnXSA9IHNob3VsZC5ub3RbJ1Rocm93J107XG5cbiAgICByZXR1cm4gc2hvdWxkO1xuICB9O1xuXG4gIGNoYWkuc2hvdWxkID0gbG9hZFNob3VsZDtcbiAgY2hhaS5TaG91bGQgPSBsb2FkU2hvdWxkO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIGFkZENoYWluaW5nTWV0aG9kIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXNcbiAqL1xuXG52YXIgdHJhbnNmZXJGbGFncyA9IHJlcXVpcmUoJy4vdHJhbnNmZXJGbGFncycpO1xudmFyIGZsYWcgPSByZXF1aXJlKCcuL2ZsYWcnKTtcbnZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKTtcblxuLyohXG4gKiBNb2R1bGUgdmFyaWFibGVzXG4gKi9cblxuLy8gQ2hlY2sgd2hldGhlciBgX19wcm90b19fYCBpcyBzdXBwb3J0ZWRcbnZhciBoYXNQcm90b1N1cHBvcnQgPSAnX19wcm90b19fJyBpbiBPYmplY3Q7XG5cbi8vIFdpdGhvdXQgYF9fcHJvdG9fX2Agc3VwcG9ydCwgdGhpcyBtb2R1bGUgd2lsbCBuZWVkIHRvIGFkZCBwcm9wZXJ0aWVzIHRvIGEgZnVuY3Rpb24uXG4vLyBIb3dldmVyLCBzb21lIEZ1bmN0aW9uLnByb3RvdHlwZSBtZXRob2RzIGNhbm5vdCBiZSBvdmVyd3JpdHRlbixcbi8vIGFuZCB0aGVyZSBzZWVtcyBubyBlYXN5IGNyb3NzLXBsYXRmb3JtIHdheSB0byBkZXRlY3QgdGhlbSAoQHNlZSBjaGFpanMvY2hhaS9pc3N1ZXMvNjkpLlxudmFyIGV4Y2x1ZGVOYW1lcyA9IC9eKD86bGVuZ3RofG5hbWV8YXJndW1lbnRzfGNhbGxlcikkLztcblxuLy8gQ2FjaGUgYEZ1bmN0aW9uYCBwcm9wZXJ0aWVzXG52YXIgY2FsbCAgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbCxcbiAgICBhcHBseSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseTtcblxuLyoqXG4gKiAjIyMgYWRkQ2hhaW5hYmxlTWV0aG9kIChjdHgsIG5hbWUsIG1ldGhvZCwgY2hhaW5pbmdCZWhhdmlvcilcbiAqXG4gKiBBZGRzIGEgbWV0aG9kIHRvIGFuIG9iamVjdCwgc3VjaCB0aGF0IHRoZSBtZXRob2QgY2FuIGFsc28gYmUgY2hhaW5lZC5cbiAqXG4gKiAgICAgdXRpbHMuYWRkQ2hhaW5hYmxlTWV0aG9kKGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZSwgJ2ZvbycsIGZ1bmN0aW9uIChzdHIpIHtcbiAqICAgICAgIHZhciBvYmogPSB1dGlscy5mbGFnKHRoaXMsICdvYmplY3QnKTtcbiAqICAgICAgIG5ldyBjaGFpLkFzc2VydGlvbihvYmopLnRvLmJlLmVxdWFsKHN0cik7XG4gKiAgICAgfSk7XG4gKlxuICogQ2FuIGFsc28gYmUgYWNjZXNzZWQgZGlyZWN0bHkgZnJvbSBgY2hhaS5Bc3NlcnRpb25gLlxuICpcbiAqICAgICBjaGFpLkFzc2VydGlvbi5hZGRDaGFpbmFibGVNZXRob2QoJ2ZvbycsIGZuLCBjaGFpbmluZ0JlaGF2aW9yKTtcbiAqXG4gKiBUaGUgcmVzdWx0IGNhbiB0aGVuIGJlIHVzZWQgYXMgYm90aCBhIG1ldGhvZCBhc3NlcnRpb24sIGV4ZWN1dGluZyBib3RoIGBtZXRob2RgIGFuZFxuICogYGNoYWluaW5nQmVoYXZpb3JgLCBvciBhcyBhIGxhbmd1YWdlIGNoYWluLCB3aGljaCBvbmx5IGV4ZWN1dGVzIGBjaGFpbmluZ0JlaGF2aW9yYC5cbiAqXG4gKiAgICAgZXhwZWN0KGZvb1N0cikudG8uYmUuZm9vKCdiYXInKTtcbiAqICAgICBleHBlY3QoZm9vU3RyKS50by5iZS5mb28uZXF1YWwoJ2ZvbycpO1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHggb2JqZWN0IHRvIHdoaWNoIHRoZSBtZXRob2QgaXMgYWRkZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG9mIG1ldGhvZCB0byBhZGRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG1ldGhvZCBmdW5jdGlvbiB0byBiZSB1c2VkIGZvciBgbmFtZWAsIHdoZW4gY2FsbGVkXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjaGFpbmluZ0JlaGF2aW9yIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBldmVyeSB0aW1lIHRoZSBwcm9wZXJ0eSBpcyBhY2Nlc3NlZFxuICogQG5hbWUgYWRkQ2hhaW5hYmxlTWV0aG9kXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGN0eCwgbmFtZSwgbWV0aG9kLCBjaGFpbmluZ0JlaGF2aW9yKSB7XG4gIGlmICh0eXBlb2YgY2hhaW5pbmdCZWhhdmlvciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIGNoYWluaW5nQmVoYXZpb3IgPSBmdW5jdGlvbiAoKSB7IH07XG4gIH1cblxuICB2YXIgY2hhaW5hYmxlQmVoYXZpb3IgPSB7XG4gICAgICBtZXRob2Q6IG1ldGhvZFxuICAgICwgY2hhaW5pbmdCZWhhdmlvcjogY2hhaW5pbmdCZWhhdmlvclxuICB9O1xuXG4gIC8vIHNhdmUgdGhlIG1ldGhvZHMgc28gd2UgY2FuIG92ZXJ3cml0ZSB0aGVtIGxhdGVyLCBpZiB3ZSBuZWVkIHRvLlxuICBpZiAoIWN0eC5fX21ldGhvZHMpIHtcbiAgICBjdHguX19tZXRob2RzID0ge307XG4gIH1cbiAgY3R4Ll9fbWV0aG9kc1tuYW1lXSA9IGNoYWluYWJsZUJlaGF2aW9yO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjdHgsIG5hbWUsXG4gICAgeyBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2hhaW5hYmxlQmVoYXZpb3IuY2hhaW5pbmdCZWhhdmlvci5jYWxsKHRoaXMpO1xuXG4gICAgICAgIHZhciBhc3NlcnQgPSBmdW5jdGlvbiBhc3NlcnQoKSB7XG4gICAgICAgICAgdmFyIG9sZF9zc2ZpID0gZmxhZyh0aGlzLCAnc3NmaScpO1xuICAgICAgICAgIGlmIChvbGRfc3NmaSAmJiBjb25maWcuaW5jbHVkZVN0YWNrID09PSBmYWxzZSlcbiAgICAgICAgICAgIGZsYWcodGhpcywgJ3NzZmknLCBhc3NlcnQpO1xuICAgICAgICAgIHZhciByZXN1bHQgPSBjaGFpbmFibGVCZWhhdmlvci5tZXRob2QuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQgPyB0aGlzIDogcmVzdWx0O1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFVzZSBgX19wcm90b19fYCBpZiBhdmFpbGFibGVcbiAgICAgICAgaWYgKGhhc1Byb3RvU3VwcG9ydCkge1xuICAgICAgICAgIC8vIEluaGVyaXQgYWxsIHByb3BlcnRpZXMgZnJvbSB0aGUgb2JqZWN0IGJ5IHJlcGxhY2luZyB0aGUgYEZ1bmN0aW9uYCBwcm90b3R5cGVcbiAgICAgICAgICB2YXIgcHJvdG90eXBlID0gYXNzZXJ0Ll9fcHJvdG9fXyA9IE9iamVjdC5jcmVhdGUodGhpcyk7XG4gICAgICAgICAgLy8gUmVzdG9yZSB0aGUgYGNhbGxgIGFuZCBgYXBwbHlgIG1ldGhvZHMgZnJvbSBgRnVuY3Rpb25gXG4gICAgICAgICAgcHJvdG90eXBlLmNhbGwgPSBjYWxsO1xuICAgICAgICAgIHByb3RvdHlwZS5hcHBseSA9IGFwcGx5O1xuICAgICAgICB9XG4gICAgICAgIC8vIE90aGVyd2lzZSwgcmVkZWZpbmUgYWxsIHByb3BlcnRpZXMgKHNsb3chKVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB2YXIgYXNzZXJ0ZXJOYW1lcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGN0eCk7XG4gICAgICAgICAgYXNzZXJ0ZXJOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChhc3NlcnRlck5hbWUpIHtcbiAgICAgICAgICAgIGlmICghZXhjbHVkZU5hbWVzLnRlc3QoYXNzZXJ0ZXJOYW1lKSkge1xuICAgICAgICAgICAgICB2YXIgcGQgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGN0eCwgYXNzZXJ0ZXJOYW1lKTtcbiAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGFzc2VydCwgYXNzZXJ0ZXJOYW1lLCBwZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB0cmFuc2ZlckZsYWdzKHRoaXMsIGFzc2VydCk7XG4gICAgICAgIHJldHVybiBhc3NlcnQ7XG4gICAgICB9XG4gICAgLCBjb25maWd1cmFibGU6IHRydWVcbiAgfSk7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gYWRkTWV0aG9kIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG5cbi8qKlxuICogIyMjIC5hZGRNZXRob2QgKGN0eCwgbmFtZSwgbWV0aG9kKVxuICpcbiAqIEFkZHMgYSBtZXRob2QgdG8gdGhlIHByb3RvdHlwZSBvZiBhbiBvYmplY3QuXG4gKlxuICogICAgIHV0aWxzLmFkZE1ldGhvZChjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUsICdmb28nLCBmdW5jdGlvbiAoc3RyKSB7XG4gKiAgICAgICB2YXIgb2JqID0gdXRpbHMuZmxhZyh0aGlzLCAnb2JqZWN0Jyk7XG4gKiAgICAgICBuZXcgY2hhaS5Bc3NlcnRpb24ob2JqKS50by5iZS5lcXVhbChzdHIpO1xuICogICAgIH0pO1xuICpcbiAqIENhbiBhbHNvIGJlIGFjY2Vzc2VkIGRpcmVjdGx5IGZyb20gYGNoYWkuQXNzZXJ0aW9uYC5cbiAqXG4gKiAgICAgY2hhaS5Bc3NlcnRpb24uYWRkTWV0aG9kKCdmb28nLCBmbik7XG4gKlxuICogVGhlbiBjYW4gYmUgdXNlZCBhcyBhbnkgb3RoZXIgYXNzZXJ0aW9uLlxuICpcbiAqICAgICBleHBlY3QoZm9vU3RyKS50by5iZS5mb28oJ2JhcicpO1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHggb2JqZWN0IHRvIHdoaWNoIHRoZSBtZXRob2QgaXMgYWRkZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG9mIG1ldGhvZCB0byBhZGRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG1ldGhvZCBmdW5jdGlvbiB0byBiZSB1c2VkIGZvciBuYW1lXG4gKiBAbmFtZSBhZGRNZXRob2RcbiAqIEBhcGkgcHVibGljXG4gKi9cbnZhciBmbGFnID0gcmVxdWlyZSgnLi9mbGFnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGN0eCwgbmFtZSwgbWV0aG9kKSB7XG4gIGN0eFtuYW1lXSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgb2xkX3NzZmkgPSBmbGFnKHRoaXMsICdzc2ZpJyk7XG4gICAgaWYgKG9sZF9zc2ZpICYmIGNvbmZpZy5pbmNsdWRlU3RhY2sgPT09IGZhbHNlKVxuICAgICAgZmxhZyh0aGlzLCAnc3NmaScsIGN0eFtuYW1lXSk7XG4gICAgdmFyIHJlc3VsdCA9IG1ldGhvZC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIHJldHVybiByZXN1bHQgPT09IHVuZGVmaW5lZCA/IHRoaXMgOiByZXN1bHQ7XG4gIH07XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gYWRkUHJvcGVydHkgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIGFkZFByb3BlcnR5IChjdHgsIG5hbWUsIGdldHRlcilcbiAqXG4gKiBBZGRzIGEgcHJvcGVydHkgdG8gdGhlIHByb3RvdHlwZSBvZiBhbiBvYmplY3QuXG4gKlxuICogICAgIHV0aWxzLmFkZFByb3BlcnR5KGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZSwgJ2ZvbycsIGZ1bmN0aW9uICgpIHtcbiAqICAgICAgIHZhciBvYmogPSB1dGlscy5mbGFnKHRoaXMsICdvYmplY3QnKTtcbiAqICAgICAgIG5ldyBjaGFpLkFzc2VydGlvbihvYmopLnRvLmJlLmluc3RhbmNlb2YoRm9vKTtcbiAqICAgICB9KTtcbiAqXG4gKiBDYW4gYWxzbyBiZSBhY2Nlc3NlZCBkaXJlY3RseSBmcm9tIGBjaGFpLkFzc2VydGlvbmAuXG4gKlxuICogICAgIGNoYWkuQXNzZXJ0aW9uLmFkZFByb3BlcnR5KCdmb28nLCBmbik7XG4gKlxuICogVGhlbiBjYW4gYmUgdXNlZCBhcyBhbnkgb3RoZXIgYXNzZXJ0aW9uLlxuICpcbiAqICAgICBleHBlY3QobXlGb28pLnRvLmJlLmZvbztcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gY3R4IG9iamVjdCB0byB3aGljaCB0aGUgcHJvcGVydHkgaXMgYWRkZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG9mIHByb3BlcnR5IHRvIGFkZFxuICogQHBhcmFtIHtGdW5jdGlvbn0gZ2V0dGVyIGZ1bmN0aW9uIHRvIGJlIHVzZWQgZm9yIG5hbWVcbiAqIEBuYW1lIGFkZFByb3BlcnR5XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGN0eCwgbmFtZSwgZ2V0dGVyKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjdHgsIG5hbWUsXG4gICAgeyBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IGdldHRlci5jYWxsKHRoaXMpO1xuICAgICAgICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQgPyB0aGlzIDogcmVzdWx0O1xuICAgICAgfVxuICAgICwgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIGZsYWcgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIGZsYWcob2JqZWN0ICxrZXksIFt2YWx1ZV0pXG4gKlxuICogR2V0IG9yIHNldCBhIGZsYWcgdmFsdWUgb24gYW4gb2JqZWN0LiBJZiBhXG4gKiB2YWx1ZSBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHNldCwgZWxzZSBpdCB3aWxsXG4gKiByZXR1cm4gdGhlIGN1cnJlbnRseSBzZXQgdmFsdWUgb3IgYHVuZGVmaW5lZGAgaWZcbiAqIHRoZSB2YWx1ZSBpcyBub3Qgc2V0LlxuICpcbiAqICAgICB1dGlscy5mbGFnKHRoaXMsICdmb28nLCAnYmFyJyk7IC8vIHNldHRlclxuICogICAgIHV0aWxzLmZsYWcodGhpcywgJ2ZvbycpOyAvLyBnZXR0ZXIsIHJldHVybnMgYGJhcmBcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IChjb25zdHJ1Y3RlZCBBc3NlcnRpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlIChvcHRpb25hbClcbiAqIEBuYW1lIGZsYWdcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaiwga2V5LCB2YWx1ZSkge1xuICB2YXIgZmxhZ3MgPSBvYmouX19mbGFncyB8fCAob2JqLl9fZmxhZ3MgPSBPYmplY3QuY3JlYXRlKG51bGwpKTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDMpIHtcbiAgICBmbGFnc1trZXldID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZsYWdzW2tleV07XG4gIH1cbn07XG4iLCIvKiFcbiAqIENoYWkgLSBnZXRBY3R1YWwgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyBnZXRBY3R1YWwob2JqZWN0LCBbYWN0dWFsXSlcbiAqXG4gKiBSZXR1cm5zIHRoZSBgYWN0dWFsYCB2YWx1ZSBmb3IgYW4gQXNzZXJ0aW9uXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCAoY29uc3RydWN0ZWQgQXNzZXJ0aW9uKVxuICogQHBhcmFtIHtBcmd1bWVudHN9IGNoYWkuQXNzZXJ0aW9uLnByb3RvdHlwZS5hc3NlcnQgYXJndW1lbnRzXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqLCBhcmdzKSB7XG4gIHJldHVybiBhcmdzLmxlbmd0aCA+IDQgPyBhcmdzWzRdIDogb2JqLl9vYmo7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gZ2V0RW51bWVyYWJsZVByb3BlcnRpZXMgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIC5nZXRFbnVtZXJhYmxlUHJvcGVydGllcyhvYmplY3QpXG4gKlxuICogVGhpcyBhbGxvd3MgdGhlIHJldHJpZXZhbCBvZiBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGFuIG9iamVjdCxcbiAqIGluaGVyaXRlZCBvciBub3QuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICogQHJldHVybnMge0FycmF5fVxuICogQG5hbWUgZ2V0RW51bWVyYWJsZVByb3BlcnRpZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBnZXRFbnVtZXJhYmxlUHJvcGVydGllcyhvYmplY3QpIHtcbiAgdmFyIHJlc3VsdCA9IFtdO1xuICBmb3IgKHZhciBuYW1lIGluIG9iamVjdCkge1xuICAgIHJlc3VsdC5wdXNoKG5hbWUpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gbWVzc2FnZSBjb21wb3NpdGlvbiB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyohXG4gKiBNb2R1bGUgZGVwZW5kYW5jaWVzXG4gKi9cblxudmFyIGZsYWcgPSByZXF1aXJlKCcuL2ZsYWcnKVxuICAsIGdldEFjdHVhbCA9IHJlcXVpcmUoJy4vZ2V0QWN0dWFsJylcbiAgLCBpbnNwZWN0ID0gcmVxdWlyZSgnLi9pbnNwZWN0JylcbiAgLCBvYmpEaXNwbGF5ID0gcmVxdWlyZSgnLi9vYmpEaXNwbGF5Jyk7XG5cbi8qKlxuICogIyMjIC5nZXRNZXNzYWdlKG9iamVjdCwgbWVzc2FnZSwgbmVnYXRlTWVzc2FnZSlcbiAqXG4gKiBDb25zdHJ1Y3QgdGhlIGVycm9yIG1lc3NhZ2UgYmFzZWQgb24gZmxhZ3NcbiAqIGFuZCB0ZW1wbGF0ZSB0YWdzLiBUZW1wbGF0ZSB0YWdzIHdpbGwgcmV0dXJuXG4gKiBhIHN0cmluZ2lmaWVkIGluc3BlY3Rpb24gb2YgdGhlIG9iamVjdCByZWZlcmVuY2VkLlxuICpcbiAqIE1lc3NhZ2UgdGVtcGxhdGUgdGFnczpcbiAqIC0gYCN7dGhpc31gIGN1cnJlbnQgYXNzZXJ0ZWQgb2JqZWN0XG4gKiAtIGAje2FjdH1gIGFjdHVhbCB2YWx1ZVxuICogLSBgI3tleHB9YCBleHBlY3RlZCB2YWx1ZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgKGNvbnN0cnVjdGVkIEFzc2VydGlvbilcbiAqIEBwYXJhbSB7QXJndW1lbnRzfSBjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUuYXNzZXJ0IGFyZ3VtZW50c1xuICogQG5hbWUgZ2V0TWVzc2FnZVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmosIGFyZ3MpIHtcbiAgdmFyIG5lZ2F0ZSA9IGZsYWcob2JqLCAnbmVnYXRlJylcbiAgICAsIHZhbCA9IGZsYWcob2JqLCAnb2JqZWN0JylcbiAgICAsIGV4cGVjdGVkID0gYXJnc1szXVxuICAgICwgYWN0dWFsID0gZ2V0QWN0dWFsKG9iaiwgYXJncylcbiAgICAsIG1zZyA9IG5lZ2F0ZSA/IGFyZ3NbMl0gOiBhcmdzWzFdXG4gICAgLCBmbGFnTXNnID0gZmxhZyhvYmosICdtZXNzYWdlJyk7XG5cbiAgbXNnID0gbXNnIHx8ICcnO1xuICBtc2cgPSBtc2dcbiAgICAucmVwbGFjZSgvI3t0aGlzfS9nLCBvYmpEaXNwbGF5KHZhbCkpXG4gICAgLnJlcGxhY2UoLyN7YWN0fS9nLCBvYmpEaXNwbGF5KGFjdHVhbCkpXG4gICAgLnJlcGxhY2UoLyN7ZXhwfS9nLCBvYmpEaXNwbGF5KGV4cGVjdGVkKSk7XG5cbiAgcmV0dXJuIGZsYWdNc2cgPyBmbGFnTXNnICsgJzogJyArIG1zZyA6IG1zZztcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBnZXROYW1lIHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMgZ2V0TmFtZShmdW5jKVxuICpcbiAqIEdldHMgdGhlIG5hbWUgb2YgYSBmdW5jdGlvbiwgaW4gYSBjcm9zcy1icm93c2VyIHdheS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBhIGZ1bmN0aW9uICh1c3VhbGx5IGEgY29uc3RydWN0b3IpXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZnVuYykge1xuICBpZiAoZnVuYy5uYW1lKSByZXR1cm4gZnVuYy5uYW1lO1xuXG4gIHZhciBtYXRjaCA9IC9eXFxzP2Z1bmN0aW9uIChbXihdKilcXCgvLmV4ZWMoZnVuYyk7XG4gIHJldHVybiBtYXRjaCAmJiBtYXRjaFsxXSA/IG1hdGNoWzFdIDogXCJcIjtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSBnZXRQYXRoVmFsdWUgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIEBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2xvZ2ljYWxwYXJhZG94L2ZpbHRyXG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqICMjIyAuZ2V0UGF0aFZhbHVlKHBhdGgsIG9iamVjdClcbiAqXG4gKiBUaGlzIGFsbG93cyB0aGUgcmV0cmlldmFsIG9mIHZhbHVlcyBpbiBhblxuICogb2JqZWN0IGdpdmVuIGEgc3RyaW5nIHBhdGguXG4gKlxuICogICAgIHZhciBvYmogPSB7XG4gKiAgICAgICAgIHByb3AxOiB7XG4gKiAgICAgICAgICAgICBhcnI6IFsnYScsICdiJywgJ2MnXVxuICogICAgICAgICAgICwgc3RyOiAnSGVsbG8nXG4gKiAgICAgICAgIH1cbiAqICAgICAgICwgcHJvcDI6IHtcbiAqICAgICAgICAgICAgIGFycjogWyB7IG5lc3RlZDogJ1VuaXZlcnNlJyB9IF1cbiAqICAgICAgICAgICAsIHN0cjogJ0hlbGxvIGFnYWluISdcbiAqICAgICAgICAgfVxuICogICAgIH1cbiAqXG4gKiBUaGUgZm9sbG93aW5nIHdvdWxkIGJlIHRoZSByZXN1bHRzLlxuICpcbiAqICAgICBnZXRQYXRoVmFsdWUoJ3Byb3AxLnN0cicsIG9iaik7IC8vIEhlbGxvXG4gKiAgICAgZ2V0UGF0aFZhbHVlKCdwcm9wMS5hdHRbMl0nLCBvYmopOyAvLyBiXG4gKiAgICAgZ2V0UGF0aFZhbHVlKCdwcm9wMi5hcnJbMF0ubmVzdGVkJywgb2JqKTsgLy8gVW5pdmVyc2VcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdFxuICogQHJldHVybnMge09iamVjdH0gdmFsdWUgb3IgYHVuZGVmaW5lZGBcbiAqIEBuYW1lIGdldFBhdGhWYWx1ZVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG52YXIgZ2V0UGF0aFZhbHVlID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAocGF0aCwgb2JqKSB7XG4gIHZhciBwYXJzZWQgPSBwYXJzZVBhdGgocGF0aCk7XG4gIHJldHVybiBfZ2V0UGF0aFZhbHVlKHBhcnNlZCwgb2JqKTtcbn07XG5cbi8qIVxuICogIyMgcGFyc2VQYXRoKHBhdGgpXG4gKlxuICogSGVscGVyIGZ1bmN0aW9uIHVzZWQgdG8gcGFyc2Ugc3RyaW5nIG9iamVjdFxuICogcGF0aHMuIFVzZSBpbiBjb25qdW5jdGlvbiB3aXRoIGBfZ2V0UGF0aFZhbHVlYC5cbiAqXG4gKiAgICAgIHZhciBwYXJzZWQgPSBwYXJzZVBhdGgoJ215b2JqZWN0LnByb3BlcnR5LnN1YnByb3AnKTtcbiAqXG4gKiAjIyMgUGF0aHM6XG4gKlxuICogKiBDYW4gYmUgYXMgbmVhciBpbmZpbml0ZWx5IGRlZXAgYW5kIG5lc3RlZFxuICogKiBBcnJheXMgYXJlIGFsc28gdmFsaWQgdXNpbmcgdGhlIGZvcm1hbCBgbXlvYmplY3QuZG9jdW1lbnRbM10ucHJvcGVydHlgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBwYXJzZWRcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlUGF0aCAocGF0aCkge1xuICB2YXIgc3RyID0gcGF0aC5yZXBsYWNlKC9cXFsvZywgJy5bJylcbiAgICAsIHBhcnRzID0gc3RyLm1hdGNoKC8oXFxcXFxcLnxbXi5dKz8pKy9nKTtcbiAgcmV0dXJuIHBhcnRzLm1hcChmdW5jdGlvbiAodmFsdWUpIHtcbiAgICB2YXIgcmUgPSAvXFxbKFxcZCspXFxdJC9cbiAgICAgICwgbUFyciA9IHJlLmV4ZWModmFsdWUpXG4gICAgaWYgKG1BcnIpIHJldHVybiB7IGk6IHBhcnNlRmxvYXQobUFyclsxXSkgfTtcbiAgICBlbHNlIHJldHVybiB7IHA6IHZhbHVlIH07XG4gIH0pO1xufTtcblxuLyohXG4gKiAjIyBfZ2V0UGF0aFZhbHVlKHBhcnNlZCwgb2JqKVxuICpcbiAqIEhlbHBlciBjb21wYW5pb24gZnVuY3Rpb24gZm9yIGAucGFyc2VQYXRoYCB0aGF0IHJldHVybnNcbiAqIHRoZSB2YWx1ZSBsb2NhdGVkIGF0IHRoZSBwYXJzZWQgYWRkcmVzcy5cbiAqXG4gKiAgICAgIHZhciB2YWx1ZSA9IGdldFBhdGhWYWx1ZShwYXJzZWQsIG9iaik7XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHBhcnNlZCBkZWZpbml0aW9uIGZyb20gYHBhcnNlUGF0aGAuXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IHRvIHNlYXJjaCBhZ2FpbnN0XG4gKiBAcmV0dXJucyB7T2JqZWN0fFVuZGVmaW5lZH0gdmFsdWVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIF9nZXRQYXRoVmFsdWUgKHBhcnNlZCwgb2JqKSB7XG4gIHZhciB0bXAgPSBvYmpcbiAgICAsIHJlcztcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBwYXJzZWQubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgdmFyIHBhcnQgPSBwYXJzZWRbaV07XG4gICAgaWYgKHRtcCkge1xuICAgICAgaWYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgcGFydC5wKVxuICAgICAgICB0bXAgPSB0bXBbcGFydC5wXTtcbiAgICAgIGVsc2UgaWYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgcGFydC5pKVxuICAgICAgICB0bXAgPSB0bXBbcGFydC5pXTtcbiAgICAgIGlmIChpID09IChsIC0gMSkpIHJlcyA9IHRtcDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzO1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIGdldFByb3BlcnRpZXMgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIC5nZXRQcm9wZXJ0aWVzKG9iamVjdClcbiAqXG4gKiBUaGlzIGFsbG93cyB0aGUgcmV0cmlldmFsIG9mIHByb3BlcnR5IG5hbWVzIG9mIGFuIG9iamVjdCwgZW51bWVyYWJsZSBvciBub3QsXG4gKiBpbmhlcml0ZWQgb3Igbm90LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3RcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqIEBuYW1lIGdldFByb3BlcnRpZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBnZXRQcm9wZXJ0aWVzKG9iamVjdCkge1xuICB2YXIgcmVzdWx0ID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoc3ViamVjdCk7XG5cbiAgZnVuY3Rpb24gYWRkUHJvcGVydHkocHJvcGVydHkpIHtcbiAgICBpZiAocmVzdWx0LmluZGV4T2YocHJvcGVydHkpID09PSAtMSkge1xuICAgICAgcmVzdWx0LnB1c2gocHJvcGVydHkpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihzdWJqZWN0KTtcbiAgd2hpbGUgKHByb3RvICE9PSBudWxsKSB7XG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMocHJvdG8pLmZvckVhY2goYWRkUHJvcGVydHkpO1xuICAgIHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuIiwiLyohXG4gKiBjaGFpXG4gKiBDb3B5cmlnaHQoYykgMjAxMSBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogTWFpbiBleHBvcnRzXG4gKi9cblxudmFyIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vKiFcbiAqIHRlc3QgdXRpbGl0eVxuICovXG5cbmV4cG9ydHMudGVzdCA9IHJlcXVpcmUoJy4vdGVzdCcpO1xuXG4vKiFcbiAqIHR5cGUgdXRpbGl0eVxuICovXG5cbmV4cG9ydHMudHlwZSA9IHJlcXVpcmUoJy4vdHlwZScpO1xuXG4vKiFcbiAqIG1lc3NhZ2UgdXRpbGl0eVxuICovXG5cbmV4cG9ydHMuZ2V0TWVzc2FnZSA9IHJlcXVpcmUoJy4vZ2V0TWVzc2FnZScpO1xuXG4vKiFcbiAqIGFjdHVhbCB1dGlsaXR5XG4gKi9cblxuZXhwb3J0cy5nZXRBY3R1YWwgPSByZXF1aXJlKCcuL2dldEFjdHVhbCcpO1xuXG4vKiFcbiAqIEluc3BlY3QgdXRpbFxuICovXG5cbmV4cG9ydHMuaW5zcGVjdCA9IHJlcXVpcmUoJy4vaW5zcGVjdCcpO1xuXG4vKiFcbiAqIE9iamVjdCBEaXNwbGF5IHV0aWxcbiAqL1xuXG5leHBvcnRzLm9iakRpc3BsYXkgPSByZXF1aXJlKCcuL29iakRpc3BsYXknKTtcblxuLyohXG4gKiBGbGFnIHV0aWxpdHlcbiAqL1xuXG5leHBvcnRzLmZsYWcgPSByZXF1aXJlKCcuL2ZsYWcnKTtcblxuLyohXG4gKiBGbGFnIHRyYW5zZmVycmluZyB1dGlsaXR5XG4gKi9cblxuZXhwb3J0cy50cmFuc2ZlckZsYWdzID0gcmVxdWlyZSgnLi90cmFuc2ZlckZsYWdzJyk7XG5cbi8qIVxuICogRGVlcCBlcXVhbCB1dGlsaXR5XG4gKi9cblxuZXhwb3J0cy5lcWwgPSByZXF1aXJlKCdkZWVwLWVxbCcpO1xuXG4vKiFcbiAqIERlZXAgcGF0aCB2YWx1ZVxuICovXG5cbmV4cG9ydHMuZ2V0UGF0aFZhbHVlID0gcmVxdWlyZSgnLi9nZXRQYXRoVmFsdWUnKTtcblxuLyohXG4gKiBGdW5jdGlvbiBuYW1lXG4gKi9cblxuZXhwb3J0cy5nZXROYW1lID0gcmVxdWlyZSgnLi9nZXROYW1lJyk7XG5cbi8qIVxuICogYWRkIFByb3BlcnR5XG4gKi9cblxuZXhwb3J0cy5hZGRQcm9wZXJ0eSA9IHJlcXVpcmUoJy4vYWRkUHJvcGVydHknKTtcblxuLyohXG4gKiBhZGQgTWV0aG9kXG4gKi9cblxuZXhwb3J0cy5hZGRNZXRob2QgPSByZXF1aXJlKCcuL2FkZE1ldGhvZCcpO1xuXG4vKiFcbiAqIG92ZXJ3cml0ZSBQcm9wZXJ0eVxuICovXG5cbmV4cG9ydHMub3ZlcndyaXRlUHJvcGVydHkgPSByZXF1aXJlKCcuL292ZXJ3cml0ZVByb3BlcnR5Jyk7XG5cbi8qIVxuICogb3ZlcndyaXRlIE1ldGhvZFxuICovXG5cbmV4cG9ydHMub3ZlcndyaXRlTWV0aG9kID0gcmVxdWlyZSgnLi9vdmVyd3JpdGVNZXRob2QnKTtcblxuLyohXG4gKiBBZGQgYSBjaGFpbmFibGUgbWV0aG9kXG4gKi9cblxuZXhwb3J0cy5hZGRDaGFpbmFibGVNZXRob2QgPSByZXF1aXJlKCcuL2FkZENoYWluYWJsZU1ldGhvZCcpO1xuXG4vKiFcbiAqIE92ZXJ3cml0ZSBjaGFpbmFibGUgbWV0aG9kXG4gKi9cblxuZXhwb3J0cy5vdmVyd3JpdGVDaGFpbmFibGVNZXRob2QgPSByZXF1aXJlKCcuL292ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZCcpO1xuXG4iLCIvLyBUaGlzIGlzIChhbG1vc3QpIGRpcmVjdGx5IGZyb20gTm9kZS5qcyB1dGlsc1xuLy8gaHR0cHM6Ly9naXRodWIuY29tL2pveWVudC9ub2RlL2Jsb2IvZjhjMzM1ZDBjYWY0N2YxNmQzMTQxM2Y4OWFhMjhlZGEzODc4ZTNhYS9saWIvdXRpbC5qc1xuXG52YXIgZ2V0TmFtZSA9IHJlcXVpcmUoJy4vZ2V0TmFtZScpO1xudmFyIGdldFByb3BlcnRpZXMgPSByZXF1aXJlKCcuL2dldFByb3BlcnRpZXMnKTtcbnZhciBnZXRFbnVtZXJhYmxlUHJvcGVydGllcyA9IHJlcXVpcmUoJy4vZ2V0RW51bWVyYWJsZVByb3BlcnRpZXMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbnNwZWN0O1xuXG4vKipcbiAqIEVjaG9zIHRoZSB2YWx1ZSBvZiBhIHZhbHVlLiBUcnlzIHRvIHByaW50IHRoZSB2YWx1ZSBvdXRcbiAqIGluIHRoZSBiZXN0IHdheSBwb3NzaWJsZSBnaXZlbiB0aGUgZGlmZmVyZW50IHR5cGVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIG9iamVjdCB0byBwcmludCBvdXQuXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHNob3dIaWRkZW4gRmxhZyB0aGF0IHNob3dzIGhpZGRlbiAobm90IGVudW1lcmFibGUpXG4gKiAgICBwcm9wZXJ0aWVzIG9mIG9iamVjdHMuXG4gKiBAcGFyYW0ge051bWJlcn0gZGVwdGggRGVwdGggaW4gd2hpY2ggdG8gZGVzY2VuZCBpbiBvYmplY3QuIERlZmF1bHQgaXMgMi5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gY29sb3JzIEZsYWcgdG8gdHVybiBvbiBBTlNJIGVzY2FwZSBjb2RlcyB0byBjb2xvciB0aGVcbiAqICAgIG91dHB1dC4gRGVmYXVsdCBpcyBmYWxzZSAobm8gY29sb3JpbmcpLlxuICovXG5mdW5jdGlvbiBpbnNwZWN0KG9iaiwgc2hvd0hpZGRlbiwgZGVwdGgsIGNvbG9ycykge1xuICB2YXIgY3R4ID0ge1xuICAgIHNob3dIaWRkZW46IHNob3dIaWRkZW4sXG4gICAgc2VlbjogW10sXG4gICAgc3R5bGl6ZTogZnVuY3Rpb24gKHN0cikgeyByZXR1cm4gc3RyOyB9XG4gIH07XG4gIHJldHVybiBmb3JtYXRWYWx1ZShjdHgsIG9iaiwgKHR5cGVvZiBkZXB0aCA9PT0gJ3VuZGVmaW5lZCcgPyAyIDogZGVwdGgpKTtcbn1cblxuLy8gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vMTA0NDEyOC9cbnZhciBnZXRPdXRlckhUTUwgPSBmdW5jdGlvbihlbGVtZW50KSB7XG4gIGlmICgnb3V0ZXJIVE1MJyBpbiBlbGVtZW50KSByZXR1cm4gZWxlbWVudC5vdXRlckhUTUw7XG4gIHZhciBucyA9IFwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbFwiO1xuICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5zLCAnXycpO1xuICB2YXIgZWxlbVByb3RvID0gKHdpbmRvdy5IVE1MRWxlbWVudCB8fCB3aW5kb3cuRWxlbWVudCkucHJvdG90eXBlO1xuICB2YXIgeG1sU2VyaWFsaXplciA9IG5ldyBYTUxTZXJpYWxpemVyKCk7XG4gIHZhciBodG1sO1xuICBpZiAoZG9jdW1lbnQueG1sVmVyc2lvbikge1xuICAgIHJldHVybiB4bWxTZXJpYWxpemVyLnNlcmlhbGl6ZVRvU3RyaW5nKGVsZW1lbnQpO1xuICB9IGVsc2Uge1xuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChlbGVtZW50LmNsb25lTm9kZShmYWxzZSkpO1xuICAgIGh0bWwgPSBjb250YWluZXIuaW5uZXJIVE1MLnJlcGxhY2UoJz48JywgJz4nICsgZWxlbWVudC5pbm5lckhUTUwgKyAnPCcpO1xuICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcbiAgICByZXR1cm4gaHRtbDtcbiAgfVxufTtcblxuLy8gUmV0dXJucyB0cnVlIGlmIG9iamVjdCBpcyBhIERPTSBlbGVtZW50LlxudmFyIGlzRE9NRWxlbWVudCA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgaWYgKHR5cGVvZiBIVE1MRWxlbWVudCA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gb2JqZWN0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG9iamVjdCAmJlxuICAgICAgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiZcbiAgICAgIG9iamVjdC5ub2RlVHlwZSA9PT0gMSAmJlxuICAgICAgdHlwZW9mIG9iamVjdC5ub2RlTmFtZSA9PT0gJ3N0cmluZyc7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcykge1xuICAvLyBQcm92aWRlIGEgaG9vayBmb3IgdXNlci1zcGVjaWZpZWQgaW5zcGVjdCBmdW5jdGlvbnMuXG4gIC8vIENoZWNrIHRoYXQgdmFsdWUgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5zcGVjdCBmdW5jdGlvbiBvbiBpdFxuICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlLmluc3BlY3QgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgIC8vIEZpbHRlciBvdXQgdGhlIHV0aWwgbW9kdWxlLCBpdCdzIGluc3BlY3QgZnVuY3Rpb24gaXMgc3BlY2lhbFxuICAgICAgdmFsdWUuaW5zcGVjdCAhPT0gZXhwb3J0cy5pbnNwZWN0ICYmXG4gICAgICAvLyBBbHNvIGZpbHRlciBvdXQgYW55IHByb3RvdHlwZSBvYmplY3RzIHVzaW5nIHRoZSBjaXJjdWxhciBjaGVjay5cbiAgICAgICEodmFsdWUuY29uc3RydWN0b3IgJiYgdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlID09PSB2YWx1ZSkpIHtcbiAgICB2YXIgcmV0ID0gdmFsdWUuaW5zcGVjdChyZWN1cnNlVGltZXMpO1xuICAgIGlmICh0eXBlb2YgcmV0ICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0ID0gZm9ybWF0VmFsdWUoY3R4LCByZXQsIHJlY3Vyc2VUaW1lcyk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvLyBQcmltaXRpdmUgdHlwZXMgY2Fubm90IGhhdmUgcHJvcGVydGllc1xuICB2YXIgcHJpbWl0aXZlID0gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpO1xuICBpZiAocHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIHByaW1pdGl2ZTtcbiAgfVxuXG4gIC8vIElmIGl0J3MgRE9NIGVsZW0sIGdldCBvdXRlciBIVE1MLlxuICBpZiAoaXNET01FbGVtZW50KHZhbHVlKSkge1xuICAgIHJldHVybiBnZXRPdXRlckhUTUwodmFsdWUpO1xuICB9XG5cbiAgLy8gTG9vayB1cCB0aGUga2V5cyBvZiB0aGUgb2JqZWN0LlxuICB2YXIgdmlzaWJsZUtleXMgPSBnZXRFbnVtZXJhYmxlUHJvcGVydGllcyh2YWx1ZSk7XG4gIHZhciBrZXlzID0gY3R4LnNob3dIaWRkZW4gPyBnZXRQcm9wZXJ0aWVzKHZhbHVlKSA6IHZpc2libGVLZXlzO1xuXG4gIC8vIFNvbWUgdHlwZSBvZiBvYmplY3Qgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZC5cbiAgLy8gSW4gSUUsIGVycm9ycyBoYXZlIGEgc2luZ2xlIGBzdGFja2AgcHJvcGVydHksIG9yIGlmIHRoZXkgYXJlIHZhbmlsbGEgYEVycm9yYCxcbiAgLy8gYSBgc3RhY2tgIHBsdXMgYGRlc2NyaXB0aW9uYCBwcm9wZXJ0eTsgaWdub3JlIHRob3NlIGZvciBjb25zaXN0ZW5jeS5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwIHx8IChpc0Vycm9yKHZhbHVlKSAmJiAoXG4gICAgICAoa2V5cy5sZW5ndGggPT09IDEgJiYga2V5c1swXSA9PT0gJ3N0YWNrJykgfHxcbiAgICAgIChrZXlzLmxlbmd0aCA9PT0gMiAmJiBrZXlzWzBdID09PSAnZGVzY3JpcHRpb24nICYmIGtleXNbMV0gPT09ICdzdGFjaycpXG4gICAgICkpKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdmFyIG5hbWUgPSBnZXROYW1lKHZhbHVlKTtcbiAgICAgIHZhciBuYW1lU3VmZml4ID0gbmFtZSA/ICc6ICcgKyBuYW1lIDogJyc7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tGdW5jdGlvbicgKyBuYW1lU3VmZml4ICsgJ10nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH1cbiAgICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKERhdGUucHJvdG90eXBlLnRvVVRDU3RyaW5nLmNhbGwodmFsdWUpLCAnZGF0ZScpO1xuICAgIH1cbiAgICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIGJhc2UgPSAnJywgYXJyYXkgPSBmYWxzZSwgYnJhY2VzID0gWyd7JywgJ30nXTtcblxuICAvLyBNYWtlIEFycmF5IHNheSB0aGF0IHRoZXkgYXJlIEFycmF5XG4gIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgIGFycmF5ID0gdHJ1ZTtcbiAgICBicmFjZXMgPSBbJ1snLCAnXSddO1xuICB9XG5cbiAgLy8gTWFrZSBmdW5jdGlvbnMgc2F5IHRoYXQgdGhleSBhcmUgZnVuY3Rpb25zXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICB2YXIgbmFtZSA9IGdldE5hbWUodmFsdWUpO1xuICAgIHZhciBuYW1lU3VmZml4ID0gbmFtZSA/ICc6ICcgKyBuYW1lIDogJyc7XG4gICAgYmFzZSA9ICcgW0Z1bmN0aW9uJyArIG5hbWVTdWZmaXggKyAnXSc7XG4gIH1cblxuICAvLyBNYWtlIFJlZ0V4cHMgc2F5IHRoYXQgdGhleSBhcmUgUmVnRXhwc1xuICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGRhdGVzIHdpdGggcHJvcGVydGllcyBmaXJzdCBzYXkgdGhlIGRhdGVcbiAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgRGF0ZS5wcm90b3R5cGUudG9VVENTdHJpbmcuY2FsbCh2YWx1ZSk7XG4gIH1cblxuICAvLyBNYWtlIGVycm9yIHdpdGggbWVzc2FnZSBmaXJzdCBzYXkgdGhlIGVycm9yXG4gIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICBpZiAoa2V5cy5sZW5ndGggPT09IDAgJiYgKCFhcnJheSB8fCB2YWx1ZS5sZW5ndGggPT0gMCkpIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArIGJyYWNlc1sxXTtcbiAgfVxuXG4gIGlmIChyZWN1cnNlVGltZXMgPCAwKSB7XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbT2JqZWN0XScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG5cbiAgY3R4LnNlZW4ucHVzaCh2YWx1ZSk7XG5cbiAgdmFyIG91dHB1dDtcbiAgaWYgKGFycmF5KSB7XG4gICAgb3V0cHV0ID0gZm9ybWF0QXJyYXkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5cyk7XG4gIH0gZWxzZSB7XG4gICAgb3V0cHV0ID0ga2V5cy5tYXAoZnVuY3Rpb24oa2V5KSB7XG4gICAgICByZXR1cm4gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSk7XG4gICAgfSk7XG4gIH1cblxuICBjdHguc2Vlbi5wb3AoKTtcblxuICByZXR1cm4gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKSB7XG4gIHN3aXRjaCAodHlwZW9mIHZhbHVlKSB7XG4gICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgndW5kZWZpbmVkJywgJ3VuZGVmaW5lZCcpO1xuXG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIHZhciBzaW1wbGUgPSAnXFwnJyArIEpTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC9eXCJ8XCIkL2csICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJykgKyAnXFwnJztcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShzaW1wbGUsICdzdHJpbmcnKTtcblxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ251bWJlcicpO1xuXG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJycgKyB2YWx1ZSwgJ2Jvb2xlYW4nKTtcbiAgfVxuICAvLyBGb3Igc29tZSByZWFzb24gdHlwZW9mIG51bGwgaXMgXCJvYmplY3RcIiwgc28gc3BlY2lhbCBjYXNlIGhlcmUuXG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnbnVsbCcsICdudWxsJyk7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRFcnJvcih2YWx1ZSkge1xuICByZXR1cm4gJ1snICsgRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpICsgJ10nO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHZhbHVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodmFsdWUsIFN0cmluZyhpKSkpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAgU3RyaW5nKGkpLCB0cnVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC5wdXNoKCcnKTtcbiAgICB9XG4gIH1cbiAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgIGlmICgha2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBrZXksIHRydWUpKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpIHtcbiAgdmFyIG5hbWUsIHN0cjtcbiAgaWYgKHZhbHVlLl9fbG9va3VwR2V0dGVyX18pIHtcbiAgICBpZiAodmFsdWUuX19sb29rdXBHZXR0ZXJfXyhrZXkpKSB7XG4gICAgICBpZiAodmFsdWUuX19sb29rdXBTZXR0ZXJfXyhrZXkpKSB7XG4gICAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyL1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHZhbHVlLl9fbG9va3VwU2V0dGVyX18oa2V5KSkge1xuICAgICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAodmlzaWJsZUtleXMuaW5kZXhPZihrZXkpIDwgMCkge1xuICAgIG5hbWUgPSAnWycgKyBrZXkgKyAnXSc7XG4gIH1cbiAgaWYgKCFzdHIpIHtcbiAgICBpZiAoY3R4LnNlZW4uaW5kZXhPZih2YWx1ZVtrZXldKSA8IDApIHtcbiAgICAgIGlmIChyZWN1cnNlVGltZXMgPT09IG51bGwpIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCB2YWx1ZVtrZXldLCBudWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgdmFsdWVba2V5XSwgcmVjdXJzZVRpbWVzIC0gMSk7XG4gICAgICB9XG4gICAgICBpZiAoc3RyLmluZGV4T2YoJ1xcbicpID4gLTEpIHtcbiAgICAgICAgaWYgKGFycmF5KSB7XG4gICAgICAgICAgc3RyID0gc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpLnN1YnN0cigyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdHIgPSAnXFxuJyArIHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tDaXJjdWxhcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAodHlwZW9mIG5hbWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKGFycmF5ICYmIGtleS5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIG5hbWUgPSBKU09OLnN0cmluZ2lmeSgnJyArIGtleSk7XG4gICAgaWYgKG5hbWUubWF0Y2goL15cIihbYS16QS1aX11bYS16QS1aXzAtOV0qKVwiJC8pKSB7XG4gICAgICBuYW1lID0gbmFtZS5zdWJzdHIoMSwgbmFtZS5sZW5ndGggLSAyKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnbmFtZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lID0gbmFtZS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKF5cInxcIiQpL2csIFwiJ1wiKTtcbiAgICAgIG5hbWUgPSBjdHguc3R5bGl6ZShuYW1lLCAnc3RyaW5nJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWUgKyAnOiAnICsgc3RyO1xufVxuXG5cbmZ1bmN0aW9uIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKSB7XG4gIHZhciBudW1MaW5lc0VzdCA9IDA7XG4gIHZhciBsZW5ndGggPSBvdXRwdXQucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cikge1xuICAgIG51bUxpbmVzRXN0Kys7XG4gICAgaWYgKGN1ci5pbmRleE9mKCdcXG4nKSA+PSAwKSBudW1MaW5lc0VzdCsrO1xuICAgIHJldHVybiBwcmV2ICsgY3VyLmxlbmd0aCArIDE7XG4gIH0sIDApO1xuXG4gIGlmIChsZW5ndGggPiA2MCkge1xuICAgIHJldHVybiBicmFjZXNbMF0gK1xuICAgICAgICAgICAoYmFzZSA9PT0gJycgPyAnJyA6IGJhc2UgKyAnXFxuICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgYnJhY2VzWzFdO1xuICB9XG5cbiAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyAnICcgKyBvdXRwdXQuam9pbignLCAnKSArICcgJyArIGJyYWNlc1sxXTtcbn1cblxuZnVuY3Rpb24gaXNBcnJheShhcikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhcikgfHxcbiAgICAgICAgICh0eXBlb2YgYXIgPT09ICdvYmplY3QnICYmIG9iamVjdFRvU3RyaW5nKGFyKSA9PT0gJ1tvYmplY3QgQXJyYXldJyk7XG59XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiB0eXBlb2YgcmUgPT09ICdvYmplY3QnICYmIG9iamVjdFRvU3RyaW5nKHJlKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiB0eXBlb2YgZCA9PT0gJ29iamVjdCcgJiYgb2JqZWN0VG9TdHJpbmcoZCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn1cblxuZnVuY3Rpb24gaXNFcnJvcihlKSB7XG4gIHJldHVybiB0eXBlb2YgZSA9PT0gJ29iamVjdCcgJiYgb2JqZWN0VG9TdHJpbmcoZSkgPT09ICdbb2JqZWN0IEVycm9yXSc7XG59XG5cbmZ1bmN0aW9uIG9iamVjdFRvU3RyaW5nKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn1cbiIsIi8qIVxuICogQ2hhaSAtIGZsYWcgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGFuY2llc1xuICovXG5cbnZhciBpbnNwZWN0ID0gcmVxdWlyZSgnLi9pbnNwZWN0Jyk7XG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyk7XG5cbi8qKlxuICogIyMjIC5vYmpEaXNwbGF5IChvYmplY3QpXG4gKlxuICogRGV0ZXJtaW5lcyBpZiBhbiBvYmplY3Qgb3IgYW4gYXJyYXkgbWF0Y2hlc1xuICogY3JpdGVyaWEgdG8gYmUgaW5zcGVjdGVkIGluLWxpbmUgZm9yIGVycm9yXG4gKiBtZXNzYWdlcyBvciBzaG91bGQgYmUgdHJ1bmNhdGVkLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IGphdmFzY3JpcHQgb2JqZWN0IHRvIGluc3BlY3RcbiAqIEBuYW1lIG9iakRpc3BsYXlcbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciBzdHIgPSBpbnNwZWN0KG9iailcbiAgICAsIHR5cGUgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcblxuICBpZiAoY29uZmlnLnRydW5jYXRlVGhyZXNob2xkICYmIHN0ci5sZW5ndGggPj0gY29uZmlnLnRydW5jYXRlVGhyZXNob2xkKSB7XG4gICAgaWYgKHR5cGUgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXScpIHtcbiAgICAgIHJldHVybiAhb2JqLm5hbWUgfHwgb2JqLm5hbWUgPT09ICcnXG4gICAgICAgID8gJ1tGdW5jdGlvbl0nXG4gICAgICAgIDogJ1tGdW5jdGlvbjogJyArIG9iai5uYW1lICsgJ10nO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgcmV0dXJuICdbIEFycmF5KCcgKyBvYmoubGVuZ3RoICsgJykgXSc7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnW29iamVjdCBPYmplY3RdJykge1xuICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopXG4gICAgICAgICwga3N0ciA9IGtleXMubGVuZ3RoID4gMlxuICAgICAgICAgID8ga2V5cy5zcGxpY2UoMCwgMikuam9pbignLCAnKSArICcsIC4uLidcbiAgICAgICAgICA6IGtleXMuam9pbignLCAnKTtcbiAgICAgIHJldHVybiAneyBPYmplY3QgKCcgKyBrc3RyICsgJykgfSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHI7XG4gIH1cbn07XG4iLCIvKiFcbiAqIENoYWkgLSBvdmVyd3JpdGVDaGFpbmFibGVNZXRob2QgdXRpbGl0eVxuICogQ29weXJpZ2h0KGMpIDIwMTItMjAxNCBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qKlxuICogIyMjIG92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZCAoY3R4LCBuYW1lLCBmbilcbiAqXG4gKiBPdmVyd2l0ZXMgYW4gYWxyZWFkeSBleGlzdGluZyBjaGFpbmFibGUgbWV0aG9kXG4gKiBhbmQgcHJvdmlkZXMgYWNjZXNzIHRvIHRoZSBwcmV2aW91cyBmdW5jdGlvbiBvclxuICogcHJvcGVydHkuICBNdXN0IHJldHVybiBmdW5jdGlvbnMgdG8gYmUgdXNlZCBmb3JcbiAqIG5hbWUuXG4gKlxuICogICAgIHV0aWxzLm92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZChjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUsICdsZW5ndGgnLFxuICogICAgICAgZnVuY3Rpb24gKF9zdXBlcikge1xuICogICAgICAgfVxuICogICAgICwgZnVuY3Rpb24gKF9zdXBlcikge1xuICogICAgICAgfVxuICogICAgICk7XG4gKlxuICogQ2FuIGFsc28gYmUgYWNjZXNzZWQgZGlyZWN0bHkgZnJvbSBgY2hhaS5Bc3NlcnRpb25gLlxuICpcbiAqICAgICBjaGFpLkFzc2VydGlvbi5vdmVyd3JpdGVDaGFpbmFibGVNZXRob2QoJ2ZvbycsIGZuLCBmbik7XG4gKlxuICogVGhlbiBjYW4gYmUgdXNlZCBhcyBhbnkgb3RoZXIgYXNzZXJ0aW9uLlxuICpcbiAqICAgICBleHBlY3QobXlGb28pLnRvLmhhdmUubGVuZ3RoKDMpO1xuICogICAgIGV4cGVjdChteUZvbykudG8uaGF2ZS5sZW5ndGguYWJvdmUoMyk7XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGN0eCBvYmplY3Qgd2hvc2UgbWV0aG9kIC8gcHJvcGVydHkgaXMgdG8gYmUgb3ZlcndyaXR0ZW5cbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG9mIG1ldGhvZCAvIHByb3BlcnR5IHRvIG92ZXJ3cml0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gbWV0aG9kIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGZ1bmN0aW9uIHRvIGJlIHVzZWQgZm9yIG5hbWVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNoYWluaW5nQmVoYXZpb3IgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgZnVuY3Rpb24gdG8gYmUgdXNlZCBmb3IgcHJvcGVydHlcbiAqIEBuYW1lIG92ZXJ3cml0ZUNoYWluYWJsZU1ldGhvZFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjdHgsIG5hbWUsIG1ldGhvZCwgY2hhaW5pbmdCZWhhdmlvcikge1xuICB2YXIgY2hhaW5hYmxlQmVoYXZpb3IgPSBjdHguX19tZXRob2RzW25hbWVdO1xuXG4gIHZhciBfY2hhaW5pbmdCZWhhdmlvciA9IGNoYWluYWJsZUJlaGF2aW9yLmNoYWluaW5nQmVoYXZpb3I7XG4gIGNoYWluYWJsZUJlaGF2aW9yLmNoYWluaW5nQmVoYXZpb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IGNoYWluaW5nQmVoYXZpb3IoX2NoYWluaW5nQmVoYXZpb3IpLmNhbGwodGhpcyk7XG4gICAgcmV0dXJuIHJlc3VsdCA9PT0gdW5kZWZpbmVkID8gdGhpcyA6IHJlc3VsdDtcbiAgfTtcblxuICB2YXIgX21ldGhvZCA9IGNoYWluYWJsZUJlaGF2aW9yLm1ldGhvZDtcbiAgY2hhaW5hYmxlQmVoYXZpb3IubWV0aG9kID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSBtZXRob2QoX21ldGhvZCkuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQgPyB0aGlzIDogcmVzdWx0O1xuICB9O1xufTtcbiIsIi8qIVxuICogQ2hhaSAtIG92ZXJ3cml0ZU1ldGhvZCB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgb3ZlcndyaXRlTWV0aG9kIChjdHgsIG5hbWUsIGZuKVxuICpcbiAqIE92ZXJ3aXRlcyBhbiBhbHJlYWR5IGV4aXN0aW5nIG1ldGhvZCBhbmQgcHJvdmlkZXNcbiAqIGFjY2VzcyB0byBwcmV2aW91cyBmdW5jdGlvbi4gTXVzdCByZXR1cm4gZnVuY3Rpb25cbiAqIHRvIGJlIHVzZWQgZm9yIG5hbWUuXG4gKlxuICogICAgIHV0aWxzLm92ZXJ3cml0ZU1ldGhvZChjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUsICdlcXVhbCcsIGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAqICAgICAgIHJldHVybiBmdW5jdGlvbiAoc3RyKSB7XG4gKiAgICAgICAgIHZhciBvYmogPSB1dGlscy5mbGFnKHRoaXMsICdvYmplY3QnKTtcbiAqICAgICAgICAgaWYgKG9iaiBpbnN0YW5jZW9mIEZvbykge1xuICogICAgICAgICAgIG5ldyBjaGFpLkFzc2VydGlvbihvYmoudmFsdWUpLnRvLmVxdWFsKHN0cik7XG4gKiAgICAgICAgIH0gZWxzZSB7XG4gKiAgICAgICAgICAgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gKiAgICAgICAgIH1cbiAqICAgICAgIH1cbiAqICAgICB9KTtcbiAqXG4gKiBDYW4gYWxzbyBiZSBhY2Nlc3NlZCBkaXJlY3RseSBmcm9tIGBjaGFpLkFzc2VydGlvbmAuXG4gKlxuICogICAgIGNoYWkuQXNzZXJ0aW9uLm92ZXJ3cml0ZU1ldGhvZCgnZm9vJywgZm4pO1xuICpcbiAqIFRoZW4gY2FuIGJlIHVzZWQgYXMgYW55IG90aGVyIGFzc2VydGlvbi5cbiAqXG4gKiAgICAgZXhwZWN0KG15Rm9vKS50by5lcXVhbCgnYmFyJyk7XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGN0eCBvYmplY3Qgd2hvc2UgbWV0aG9kIGlzIHRvIGJlIG92ZXJ3cml0dGVuXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBvZiBtZXRob2QgdG8gb3ZlcndyaXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBtZXRob2QgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgZnVuY3Rpb24gdG8gYmUgdXNlZCBmb3IgbmFtZVxuICogQG5hbWUgb3ZlcndyaXRlTWV0aG9kXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGN0eCwgbmFtZSwgbWV0aG9kKSB7XG4gIHZhciBfbWV0aG9kID0gY3R4W25hbWVdXG4gICAgLCBfc3VwZXIgPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9O1xuXG4gIGlmIChfbWV0aG9kICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBfbWV0aG9kKVxuICAgIF9zdXBlciA9IF9tZXRob2Q7XG5cbiAgY3R4W25hbWVdID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSBtZXRob2QoX3N1cGVyKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIHJldHVybiByZXN1bHQgPT09IHVuZGVmaW5lZCA/IHRoaXMgOiByZXN1bHQ7XG4gIH1cbn07XG4iLCIvKiFcbiAqIENoYWkgLSBvdmVyd3JpdGVQcm9wZXJ0eSB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgb3ZlcndyaXRlUHJvcGVydHkgKGN0eCwgbmFtZSwgZm4pXG4gKlxuICogT3ZlcndpdGVzIGFuIGFscmVhZHkgZXhpc3RpbmcgcHJvcGVydHkgZ2V0dGVyIGFuZCBwcm92aWRlc1xuICogYWNjZXNzIHRvIHByZXZpb3VzIHZhbHVlLiBNdXN0IHJldHVybiBmdW5jdGlvbiB0byB1c2UgYXMgZ2V0dGVyLlxuICpcbiAqICAgICB1dGlscy5vdmVyd3JpdGVQcm9wZXJ0eShjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUsICdvaycsIGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAqICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gKiAgICAgICAgIHZhciBvYmogPSB1dGlscy5mbGFnKHRoaXMsICdvYmplY3QnKTtcbiAqICAgICAgICAgaWYgKG9iaiBpbnN0YW5jZW9mIEZvbykge1xuICogICAgICAgICAgIG5ldyBjaGFpLkFzc2VydGlvbihvYmoubmFtZSkudG8uZXF1YWwoJ2JhcicpO1xuICogICAgICAgICB9IGVsc2Uge1xuICogICAgICAgICAgIF9zdXBlci5jYWxsKHRoaXMpO1xuICogICAgICAgICB9XG4gKiAgICAgICB9XG4gKiAgICAgfSk7XG4gKlxuICpcbiAqIENhbiBhbHNvIGJlIGFjY2Vzc2VkIGRpcmVjdGx5IGZyb20gYGNoYWkuQXNzZXJ0aW9uYC5cbiAqXG4gKiAgICAgY2hhaS5Bc3NlcnRpb24ub3ZlcndyaXRlUHJvcGVydHkoJ2ZvbycsIGZuKTtcbiAqXG4gKiBUaGVuIGNhbiBiZSB1c2VkIGFzIGFueSBvdGhlciBhc3NlcnRpb24uXG4gKlxuICogICAgIGV4cGVjdChteUZvbykudG8uYmUub2s7XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGN0eCBvYmplY3Qgd2hvc2UgcHJvcGVydHkgaXMgdG8gYmUgb3ZlcndyaXR0ZW5cbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG9mIHByb3BlcnR5IHRvIG92ZXJ3cml0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZ2V0dGVyIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGdldHRlciBmdW5jdGlvbiB0byBiZSB1c2VkIGZvciBuYW1lXG4gKiBAbmFtZSBvdmVyd3JpdGVQcm9wZXJ0eVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjdHgsIG5hbWUsIGdldHRlcikge1xuICB2YXIgX2dldCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoY3R4LCBuYW1lKVxuICAgICwgX3N1cGVyID0gZnVuY3Rpb24gKCkge307XG5cbiAgaWYgKF9nZXQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIF9nZXQuZ2V0KVxuICAgIF9zdXBlciA9IF9nZXQuZ2V0XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGN0eCwgbmFtZSxcbiAgICB7IGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gZ2V0dGVyKF9zdXBlcikuY2FsbCh0aGlzKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdCA9PT0gdW5kZWZpbmVkID8gdGhpcyA6IHJlc3VsdDtcbiAgICAgIH1cbiAgICAsIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICB9KTtcbn07XG4iLCIvKiFcbiAqIENoYWkgLSB0ZXN0IHV0aWxpdHlcbiAqIENvcHlyaWdodChjKSAyMDEyLTIwMTQgSmFrZSBMdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIE1vZHVsZSBkZXBlbmRhbmNpZXNcbiAqL1xuXG52YXIgZmxhZyA9IHJlcXVpcmUoJy4vZmxhZycpO1xuXG4vKipcbiAqICMgdGVzdChvYmplY3QsIGV4cHJlc3Npb24pXG4gKlxuICogVGVzdCBhbmQgb2JqZWN0IGZvciBleHByZXNzaW9uLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgKGNvbnN0cnVjdGVkIEFzc2VydGlvbilcbiAqIEBwYXJhbSB7QXJndW1lbnRzfSBjaGFpLkFzc2VydGlvbi5wcm90b3R5cGUuYXNzZXJ0IGFyZ3VtZW50c1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaiwgYXJncykge1xuICB2YXIgbmVnYXRlID0gZmxhZyhvYmosICduZWdhdGUnKVxuICAgICwgZXhwciA9IGFyZ3NbMF07XG4gIHJldHVybiBuZWdhdGUgPyAhZXhwciA6IGV4cHI7XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gdHJhbnNmZXJGbGFncyB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyoqXG4gKiAjIyMgdHJhbnNmZXJGbGFncyhhc3NlcnRpb24sIG9iamVjdCwgaW5jbHVkZUFsbCA9IHRydWUpXG4gKlxuICogVHJhbnNmZXIgYWxsIHRoZSBmbGFncyBmb3IgYGFzc2VydGlvbmAgdG8gYG9iamVjdGAuIElmXG4gKiBgaW5jbHVkZUFsbGAgaXMgc2V0IHRvIGBmYWxzZWAsIHRoZW4gdGhlIGJhc2UgQ2hhaVxuICogYXNzZXJ0aW9uIGZsYWdzIChuYW1lbHkgYG9iamVjdGAsIGBzc2ZpYCwgYW5kIGBtZXNzYWdlYClcbiAqIHdpbGwgbm90IGJlIHRyYW5zZmVycmVkLlxuICpcbiAqXG4gKiAgICAgdmFyIG5ld0Fzc2VydGlvbiA9IG5ldyBBc3NlcnRpb24oKTtcbiAqICAgICB1dGlscy50cmFuc2ZlckZsYWdzKGFzc2VydGlvbiwgbmV3QXNzZXJ0aW9uKTtcbiAqXG4gKiAgICAgdmFyIGFub3RoZXJBc3Nlcml0b24gPSBuZXcgQXNzZXJ0aW9uKG15T2JqKTtcbiAqICAgICB1dGlscy50cmFuc2ZlckZsYWdzKGFzc2VydGlvbiwgYW5vdGhlckFzc2VydGlvbiwgZmFsc2UpO1xuICpcbiAqIEBwYXJhbSB7QXNzZXJ0aW9ufSBhc3NlcnRpb24gdGhlIGFzc2VydGlvbiB0byB0cmFuc2ZlciB0aGUgZmxhZ3MgZnJvbVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCB0aGUgb2JqZWN0IHRvIHRyYW5zZmVyIHRoZSBmbGFncyB0b287IHVzdWFsbHkgYSBuZXcgYXNzZXJ0aW9uXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGluY2x1ZGVBbGxcbiAqIEBuYW1lIGdldEFsbEZsYWdzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhc3NlcnRpb24sIG9iamVjdCwgaW5jbHVkZUFsbCkge1xuICB2YXIgZmxhZ3MgPSBhc3NlcnRpb24uX19mbGFncyB8fCAoYXNzZXJ0aW9uLl9fZmxhZ3MgPSBPYmplY3QuY3JlYXRlKG51bGwpKTtcblxuICBpZiAoIW9iamVjdC5fX2ZsYWdzKSB7XG4gICAgb2JqZWN0Ll9fZmxhZ3MgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB9XG5cbiAgaW5jbHVkZUFsbCA9IGFyZ3VtZW50cy5sZW5ndGggPT09IDMgPyBpbmNsdWRlQWxsIDogdHJ1ZTtcblxuICBmb3IgKHZhciBmbGFnIGluIGZsYWdzKSB7XG4gICAgaWYgKGluY2x1ZGVBbGwgfHxcbiAgICAgICAgKGZsYWcgIT09ICdvYmplY3QnICYmIGZsYWcgIT09ICdzc2ZpJyAmJiBmbGFnICE9ICdtZXNzYWdlJykpIHtcbiAgICAgIG9iamVjdC5fX2ZsYWdzW2ZsYWddID0gZmxhZ3NbZmxhZ107XG4gICAgfVxuICB9XG59O1xuIiwiLyohXG4gKiBDaGFpIC0gdHlwZSB1dGlsaXR5XG4gKiBDb3B5cmlnaHQoYykgMjAxMi0yMDE0IEpha2UgTHVlciA8amFrZUBhbG9naWNhbHBhcmFkb3guY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuLyohXG4gKiBEZXRlY3RhYmxlIGphdmFzY3JpcHQgbmF0aXZlc1xuICovXG5cbnZhciBuYXRpdmVzID0ge1xuICAgICdbb2JqZWN0IEFyZ3VtZW50c10nOiAnYXJndW1lbnRzJ1xuICAsICdbb2JqZWN0IEFycmF5XSc6ICdhcnJheSdcbiAgLCAnW29iamVjdCBEYXRlXSc6ICdkYXRlJ1xuICAsICdbb2JqZWN0IEZ1bmN0aW9uXSc6ICdmdW5jdGlvbidcbiAgLCAnW29iamVjdCBOdW1iZXJdJzogJ251bWJlcidcbiAgLCAnW29iamVjdCBSZWdFeHBdJzogJ3JlZ2V4cCdcbiAgLCAnW29iamVjdCBTdHJpbmddJzogJ3N0cmluZydcbn07XG5cbi8qKlxuICogIyMjIHR5cGUob2JqZWN0KVxuICpcbiAqIEJldHRlciBpbXBsZW1lbnRhdGlvbiBvZiBgdHlwZW9mYCBkZXRlY3Rpb24gdGhhdCBjYW5cbiAqIGJlIHVzZWQgY3Jvc3MtYnJvd3Nlci4gSGFuZGxlcyB0aGUgaW5jb25zaXN0ZW5jaWVzIG9mXG4gKiBBcnJheSwgYG51bGxgLCBhbmQgYHVuZGVmaW5lZGAgZGV0ZWN0aW9uLlxuICpcbiAqICAgICB1dGlscy50eXBlKHt9KSAvLyAnb2JqZWN0J1xuICogICAgIHV0aWxzLnR5cGUobnVsbCkgLy8gYG51bGwnXG4gKiAgICAgdXRpbHMudHlwZSh1bmRlZmluZWQpIC8vIGB1bmRlZmluZWRgXG4gKiAgICAgdXRpbHMudHlwZShbXSkgLy8gYGFycmF5YFxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IG9iamVjdCB0byBkZXRlY3QgdHlwZSBvZlxuICogQG5hbWUgdHlwZVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcbiAgaWYgKG5hdGl2ZXNbc3RyXSkgcmV0dXJuIG5hdGl2ZXNbc3RyXTtcbiAgaWYgKG9iaiA9PT0gbnVsbCkgcmV0dXJuICdudWxsJztcbiAgaWYgKG9iaiA9PT0gdW5kZWZpbmVkKSByZXR1cm4gJ3VuZGVmaW5lZCc7XG4gIGlmIChvYmogPT09IE9iamVjdChvYmopKSByZXR1cm4gJ29iamVjdCc7XG4gIHJldHVybiB0eXBlb2Ygb2JqO1xufTtcbiIsIi8qIVxuICogYXNzZXJ0aW9uLWVycm9yXG4gKiBDb3B5cmlnaHQoYykgMjAxMyBKYWtlIEx1ZXIgPGpha2VAcXVhbGlhbmN5LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogUmV0dXJuIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGNvcHkgcHJvcGVydGllcyBmcm9tXG4gKiBvbmUgb2JqZWN0IHRvIGFub3RoZXIgZXhjbHVkaW5nIGFueSBvcmlnaW5hbGx5XG4gKiBsaXN0ZWQuIFJldHVybmVkIGZ1bmN0aW9uIHdpbGwgY3JlYXRlIGEgbmV3IGB7fWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV4Y2x1ZGVkIHByb3BlcnRpZXMgLi4uXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuXG5mdW5jdGlvbiBleGNsdWRlICgpIHtcbiAgdmFyIGV4Y2x1ZGVzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gIGZ1bmN0aW9uIGV4Y2x1ZGVQcm9wcyAocmVzLCBvYmopIHtcbiAgICBPYmplY3Qua2V5cyhvYmopLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgaWYgKCF+ZXhjbHVkZXMuaW5kZXhPZihrZXkpKSByZXNba2V5XSA9IG9ialtrZXldO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uIGV4dGVuZEV4Y2x1ZGUgKCkge1xuICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgICAsIGkgPSAwXG4gICAgICAsIHJlcyA9IHt9O1xuXG4gICAgZm9yICg7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBleGNsdWRlUHJvcHMocmVzLCBhcmdzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xuICB9O1xufTtcblxuLyohXG4gKiBQcmltYXJ5IEV4cG9ydHNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFzc2VydGlvbkVycm9yO1xuXG4vKipcbiAqICMjIyBBc3NlcnRpb25FcnJvclxuICpcbiAqIEFuIGV4dGVuc2lvbiBvZiB0aGUgSmF2YVNjcmlwdCBgRXJyb3JgIGNvbnN0cnVjdG9yIGZvclxuICogYXNzZXJ0aW9uIGFuZCB2YWxpZGF0aW9uIHNjZW5hcmlvcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICogQHBhcmFtIHtPYmplY3R9IHByb3BlcnRpZXMgdG8gaW5jbHVkZSAob3B0aW9uYWwpXG4gKiBAcGFyYW0ge2NhbGxlZX0gc3RhcnQgc3RhY2sgZnVuY3Rpb24gKG9wdGlvbmFsKVxuICovXG5cbmZ1bmN0aW9uIEFzc2VydGlvbkVycm9yIChtZXNzYWdlLCBfcHJvcHMsIHNzZikge1xuICB2YXIgZXh0ZW5kID0gZXhjbHVkZSgnbmFtZScsICdtZXNzYWdlJywgJ3N0YWNrJywgJ2NvbnN0cnVjdG9yJywgJ3RvSlNPTicpXG4gICAgLCBwcm9wcyA9IGV4dGVuZChfcHJvcHMgfHwge30pO1xuXG4gIC8vIGRlZmF1bHQgdmFsdWVzXG4gIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2UgfHwgJ1Vuc3BlY2lmaWVkIEFzc2VydGlvbkVycm9yJztcbiAgdGhpcy5zaG93RGlmZiA9IGZhbHNlO1xuXG4gIC8vIGNvcHkgZnJvbSBwcm9wZXJ0aWVzXG4gIGZvciAodmFyIGtleSBpbiBwcm9wcykge1xuICAgIHRoaXNba2V5XSA9IHByb3BzW2tleV07XG4gIH1cblxuICAvLyBjYXB0dXJlIHN0YWNrIHRyYWNlXG4gIHNzZiA9IHNzZiB8fCBhcmd1bWVudHMuY2FsbGVlO1xuICBpZiAoc3NmICYmIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKSB7XG4gICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgc3NmKTtcbiAgfVxufVxuXG4vKiFcbiAqIEluaGVyaXQgZnJvbSBFcnJvci5wcm90b3R5cGVcbiAqL1xuXG5Bc3NlcnRpb25FcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5cbi8qIVxuICogU3RhdGljYWxseSBzZXQgbmFtZVxuICovXG5cbkFzc2VydGlvbkVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0Fzc2VydGlvbkVycm9yJztcblxuLyohXG4gKiBFbnN1cmUgY29ycmVjdCBjb25zdHJ1Y3RvclxuICovXG5cbkFzc2VydGlvbkVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEFzc2VydGlvbkVycm9yO1xuXG4vKipcbiAqIEFsbG93IGVycm9ycyB0byBiZSBjb252ZXJ0ZWQgdG8gSlNPTiBmb3Igc3RhdGljIHRyYW5zZmVyLlxuICpcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gaW5jbHVkZSBzdGFjayAoZGVmYXVsdDogYHRydWVgKVxuICogQHJldHVybiB7T2JqZWN0fSBvYmplY3QgdGhhdCBjYW4gYmUgYEpTT04uc3RyaW5naWZ5YFxuICovXG5cbkFzc2VydGlvbkVycm9yLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiAoc3RhY2spIHtcbiAgdmFyIGV4dGVuZCA9IGV4Y2x1ZGUoJ2NvbnN0cnVjdG9yJywgJ3RvSlNPTicsICdzdGFjaycpXG4gICAgLCBwcm9wcyA9IGV4dGVuZCh7IG5hbWU6IHRoaXMubmFtZSB9LCB0aGlzKTtcblxuICAvLyBpbmNsdWRlIHN0YWNrIGlmIGV4aXN0cyBhbmQgbm90IHR1cm5lZCBvZmZcbiAgaWYgKGZhbHNlICE9PSBzdGFjayAmJiB0aGlzLnN0YWNrKSB7XG4gICAgcHJvcHMuc3RhY2sgPSB0aGlzLnN0YWNrO1xuICB9XG5cbiAgcmV0dXJuIHByb3BzO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvZXFsJyk7XG4iLCIvKiFcbiAqIGRlZXAtZXFsXG4gKiBDb3B5cmlnaHQoYykgMjAxMyBKYWtlIEx1ZXIgPGpha2VAYWxvZ2ljYWxwYXJhZG94LmNvbT5cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbi8qIVxuICogTW9kdWxlIGRlcGVuZGVuY2llc1xuICovXG5cbnZhciB0eXBlID0gcmVxdWlyZSgndHlwZS1kZXRlY3QnKTtcblxuLyohXG4gKiBCdWZmZXIuaXNCdWZmZXIgYnJvd3NlciBzaGltXG4gKi9cblxudmFyIEJ1ZmZlcjtcbnRyeSB7IEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjsgfVxuY2F0Y2goZXgpIHtcbiAgQnVmZmVyID0ge307XG4gIEJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gZmFsc2U7IH1cbn1cblxuLyohXG4gKiBQcmltYXJ5IEV4cG9ydFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZGVlcEVxdWFsO1xuXG4vKipcbiAqIEFzc2VydCBzdXBlci1zdHJpY3QgKGVnYWwpIGVxdWFsaXR5IGJldHdlZW5cbiAqIHR3byBvYmplY3RzIG9mIGFueSB0eXBlLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IGFcbiAqIEBwYXJhbSB7TWl4ZWR9IGJcbiAqIEBwYXJhbSB7QXJyYXl9IG1lbW9pc2VkIChvcHRpb25hbClcbiAqIEByZXR1cm4ge0Jvb2xlYW59IGVxdWFsIG1hdGNoXG4gKi9cblxuZnVuY3Rpb24gZGVlcEVxdWFsKGEsIGIsIG0pIHtcbiAgaWYgKHNhbWVWYWx1ZShhLCBiKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2UgaWYgKCdkYXRlJyA9PT0gdHlwZShhKSkge1xuICAgIHJldHVybiBkYXRlRXF1YWwoYSwgYik7XG4gIH0gZWxzZSBpZiAoJ3JlZ2V4cCcgPT09IHR5cGUoYSkpIHtcbiAgICByZXR1cm4gcmVnZXhwRXF1YWwoYSwgYik7XG4gIH0gZWxzZSBpZiAoQnVmZmVyLmlzQnVmZmVyKGEpKSB7XG4gICAgcmV0dXJuIGJ1ZmZlckVxdWFsKGEsIGIpO1xuICB9IGVsc2UgaWYgKCdhcmd1bWVudHMnID09PSB0eXBlKGEpKSB7XG4gICAgcmV0dXJuIGFyZ3VtZW50c0VxdWFsKGEsIGIsIG0pO1xuICB9IGVsc2UgaWYgKCF0eXBlRXF1YWwoYSwgYikpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0gZWxzZSBpZiAoKCdvYmplY3QnICE9PSB0eXBlKGEpICYmICdvYmplY3QnICE9PSB0eXBlKGIpKVxuICAmJiAoJ2FycmF5JyAhPT0gdHlwZShhKSAmJiAnYXJyYXknICE9PSB0eXBlKGIpKSkge1xuICAgIHJldHVybiBzYW1lVmFsdWUoYSwgYik7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG9iamVjdEVxdWFsKGEsIGIsIG0pO1xuICB9XG59XG5cbi8qIVxuICogU3RyaWN0IChlZ2FsKSBlcXVhbGl0eSB0ZXN0LiBFbnN1cmVzIHRoYXQgTmFOIGFsd2F5c1xuICogZXF1YWxzIE5hTiBhbmQgYC0wYCBkb2VzIG5vdCBlcXVhbCBgKzBgLlxuICpcbiAqIEBwYXJhbSB7TWl4ZWR9IGFcbiAqIEBwYXJhbSB7TWl4ZWR9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IGVxdWFsIG1hdGNoXG4gKi9cblxuZnVuY3Rpb24gc2FtZVZhbHVlKGEsIGIpIHtcbiAgaWYgKGEgPT09IGIpIHJldHVybiBhICE9PSAwIHx8IDEgLyBhID09PSAxIC8gYjtcbiAgcmV0dXJuIGEgIT09IGEgJiYgYiAhPT0gYjtcbn1cblxuLyohXG4gKiBDb21wYXJlIHRoZSB0eXBlcyBvZiB0d28gZ2l2ZW4gb2JqZWN0cyBhbmRcbiAqIHJldHVybiBpZiB0aGV5IGFyZSBlcXVhbC4gTm90ZSB0aGF0IGFuIEFycmF5XG4gKiBoYXMgYSB0eXBlIG9mIGBhcnJheWAgKG5vdCBgb2JqZWN0YCkgYW5kIGFyZ3VtZW50c1xuICogaGF2ZSBhIHR5cGUgb2YgYGFyZ3VtZW50c2AgKG5vdCBgYXJyYXlgL2BvYmplY3RgKS5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSBhXG4gKiBAcGFyYW0ge01peGVkfSBiXG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqL1xuXG5mdW5jdGlvbiB0eXBlRXF1YWwoYSwgYikge1xuICByZXR1cm4gdHlwZShhKSA9PT0gdHlwZShiKTtcbn1cblxuLyohXG4gKiBDb21wYXJlIHR3byBEYXRlIG9iamVjdHMgYnkgYXNzZXJ0aW5nIHRoYXRcbiAqIHRoZSB0aW1lIHZhbHVlcyBhcmUgZXF1YWwgdXNpbmcgYHNhdmVWYWx1ZWAuXG4gKlxuICogQHBhcmFtIHtEYXRlfSBhXG4gKiBAcGFyYW0ge0RhdGV9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIGRhdGVFcXVhbChhLCBiKSB7XG4gIGlmICgnZGF0ZScgIT09IHR5cGUoYikpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHNhbWVWYWx1ZShhLmdldFRpbWUoKSwgYi5nZXRUaW1lKCkpO1xufVxuXG4vKiFcbiAqIENvbXBhcmUgdHdvIHJlZ3VsYXIgZXhwcmVzc2lvbnMgYnkgY29udmVydGluZyB0aGVtXG4gKiB0byBzdHJpbmcgYW5kIGNoZWNraW5nIGZvciBgc2FtZVZhbHVlYC5cbiAqXG4gKiBAcGFyYW0ge1JlZ0V4cH0gYVxuICogQHBhcmFtIHtSZWdFeHB9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIHJlZ2V4cEVxdWFsKGEsIGIpIHtcbiAgaWYgKCdyZWdleHAnICE9PSB0eXBlKGIpKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBzYW1lVmFsdWUoYS50b1N0cmluZygpLCBiLnRvU3RyaW5nKCkpO1xufVxuXG4vKiFcbiAqIEFzc2VydCBkZWVwIGVxdWFsaXR5IG9mIHR3byBgYXJndW1lbnRzYCBvYmplY3RzLlxuICogVW5mb3J0dW5hdGVseSwgdGhlc2UgbXVzdCBiZSBzbGljZWQgdG8gYXJyYXlzXG4gKiBwcmlvciB0byB0ZXN0IHRvIGVuc3VyZSBubyBiYWQgYmVoYXZpb3IuXG4gKlxuICogQHBhcmFtIHtBcmd1bWVudHN9IGFcbiAqIEBwYXJhbSB7QXJndW1lbnRzfSBiXG4gKiBAcGFyYW0ge0FycmF5fSBtZW1vaXplIChvcHRpb25hbClcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIGFyZ3VtZW50c0VxdWFsKGEsIGIsIG0pIHtcbiAgaWYgKCdhcmd1bWVudHMnICE9PSB0eXBlKGIpKSByZXR1cm4gZmFsc2U7XG4gIGEgPSBbXS5zbGljZS5jYWxsKGEpO1xuICBiID0gW10uc2xpY2UuY2FsbChiKTtcbiAgcmV0dXJuIGRlZXBFcXVhbChhLCBiLCBtKTtcbn1cblxuLyohXG4gKiBHZXQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzIG9mIGEgZ2l2ZW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBhXG4gKiBAcmV0dXJuIHtBcnJheX0gcHJvcGVydHkgbmFtZXNcbiAqL1xuXG5mdW5jdGlvbiBlbnVtZXJhYmxlKGEpIHtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gYSkgcmVzLnB1c2goa2V5KTtcbiAgcmV0dXJuIHJlcztcbn1cblxuLyohXG4gKiBTaW1wbGUgZXF1YWxpdHkgZm9yIGZsYXQgaXRlcmFibGUgb2JqZWN0c1xuICogc3VjaCBhcyBBcnJheXMgb3IgTm9kZS5qcyBidWZmZXJzLlxuICpcbiAqIEBwYXJhbSB7SXRlcmFibGV9IGFcbiAqIEBwYXJhbSB7SXRlcmFibGV9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59IHJlc3VsdFxuICovXG5cbmZ1bmN0aW9uIGl0ZXJhYmxlRXF1YWwoYSwgYikge1xuICBpZiAoYS5sZW5ndGggIT09ICBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gIHZhciBpID0gMDtcbiAgdmFyIG1hdGNoID0gdHJ1ZTtcblxuICBmb3IgKDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgbWF0Y2ggPSBmYWxzZTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtYXRjaDtcbn1cblxuLyohXG4gKiBFeHRlbnNpb24gdG8gYGl0ZXJhYmxlRXF1YWxgIHNwZWNpZmljYWxseVxuICogZm9yIE5vZGUuanMgQnVmZmVycy5cbiAqXG4gKiBAcGFyYW0ge0J1ZmZlcn0gYVxuICogQHBhcmFtIHtNaXhlZH0gYlxuICogQHJldHVybiB7Qm9vbGVhbn0gcmVzdWx0XG4gKi9cblxuZnVuY3Rpb24gYnVmZmVyRXF1YWwoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gaXRlcmFibGVFcXVhbChhLCBiKTtcbn1cblxuLyohXG4gKiBCbG9jayBmb3IgYG9iamVjdEVxdWFsYCBlbnN1cmluZyBub24tZXhpc3RpbmdcbiAqIHZhbHVlcyBkb24ndCBnZXQgaW4uXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gb2JqZWN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqL1xuXG5mdW5jdGlvbiBpc1ZhbHVlKGEpIHtcbiAgcmV0dXJuIGEgIT09IG51bGwgJiYgYSAhPT0gdW5kZWZpbmVkO1xufVxuXG4vKiFcbiAqIFJlY3Vyc2l2ZWx5IGNoZWNrIHRoZSBlcXVhbGl0eSBvZiB0d28gb2JqZWN0cy5cbiAqIE9uY2UgYmFzaWMgc2FtZW5lc3MgaGFzIGJlZW4gZXN0YWJsaXNoZWQgaXQgd2lsbFxuICogZGVmZXIgdG8gYGRlZXBFcXVhbGAgZm9yIGVhY2ggZW51bWVyYWJsZSBrZXlcbiAqIGluIHRoZSBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gYVxuICogQHBhcmFtIHtNaXhlZH0gYlxuICogQHJldHVybiB7Qm9vbGVhbn0gcmVzdWx0XG4gKi9cblxuZnVuY3Rpb24gb2JqZWN0RXF1YWwoYSwgYiwgbSkge1xuICBpZiAoIWlzVmFsdWUoYSkgfHwgIWlzVmFsdWUoYikpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoYS5wcm90b3R5cGUgIT09IGIucHJvdG90eXBlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdmFyIGk7XG4gIGlmIChtKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IG0ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICgobVtpXVswXSA9PT0gYSAmJiBtW2ldWzFdID09PSBiKVxuICAgICAgfHwgIChtW2ldWzBdID09PSBiICYmIG1baV1bMV0gPT09IGEpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBtID0gW107XG4gIH1cblxuICB0cnkge1xuICAgIHZhciBrYSA9IGVudW1lcmFibGUoYSk7XG4gICAgdmFyIGtiID0gZW51bWVyYWJsZShiKTtcbiAgfSBjYXRjaCAoZXgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBrYS5zb3J0KCk7XG4gIGtiLnNvcnQoKTtcblxuICBpZiAoIWl0ZXJhYmxlRXF1YWwoa2EsIGtiKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIG0ucHVzaChbIGEsIGIgXSk7XG5cbiAgdmFyIGtleTtcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBrZXkgPSBrYVtpXTtcbiAgICBpZiAoIWRlZXBFcXVhbChhW2tleV0sIGJba2V5XSwgbSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvdHlwZScpO1xuIiwiLyohXG4gKiB0eXBlLWRldGVjdFxuICogQ29weXJpZ2h0KGMpIDIwMTMgamFrZSBsdWVyIDxqYWtlQGFsb2dpY2FscGFyYWRveC5jb20+XG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKiFcbiAqIFByaW1hcnkgRXhwb3J0c1xuICovXG5cbnZhciBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBnZXRUeXBlO1xuXG4vKiFcbiAqIERldGVjdGFibGUgamF2YXNjcmlwdCBuYXRpdmVzXG4gKi9cblxudmFyIG5hdGl2ZXMgPSB7XG4gICAgJ1tvYmplY3QgQXJyYXldJzogJ2FycmF5J1xuICAsICdbb2JqZWN0IFJlZ0V4cF0nOiAncmVnZXhwJ1xuICAsICdbb2JqZWN0IEZ1bmN0aW9uXSc6ICdmdW5jdGlvbidcbiAgLCAnW29iamVjdCBBcmd1bWVudHNdJzogJ2FyZ3VtZW50cydcbiAgLCAnW29iamVjdCBEYXRlXSc6ICdkYXRlJ1xufTtcblxuLyoqXG4gKiAjIyMgdHlwZU9mIChvYmopXG4gKlxuICogVXNlIHNldmVyYWwgZGlmZmVyZW50IHRlY2huaXF1ZXMgdG8gZGV0ZXJtaW5lXG4gKiB0aGUgdHlwZSBvZiBvYmplY3QgYmVpbmcgdGVzdGVkLlxuICpcbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmplY3RcbiAqIEByZXR1cm4ge1N0cmluZ30gb2JqZWN0IHR5cGVcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZ2V0VHlwZSAob2JqKSB7XG4gIHZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcbiAgaWYgKG5hdGl2ZXNbc3RyXSkgcmV0dXJuIG5hdGl2ZXNbc3RyXTtcbiAgaWYgKG9iaiA9PT0gbnVsbCkgcmV0dXJuICdudWxsJztcbiAgaWYgKG9iaiA9PT0gdW5kZWZpbmVkKSByZXR1cm4gJ3VuZGVmaW5lZCc7XG4gIGlmIChvYmogPT09IE9iamVjdChvYmopKSByZXR1cm4gJ29iamVjdCc7XG4gIHJldHVybiB0eXBlb2Ygb2JqO1xufVxuXG5leHBvcnRzLkxpYnJhcnkgPSBMaWJyYXJ5O1xuXG4vKipcbiAqICMjIyBMaWJyYXJ5XG4gKlxuICogQ3JlYXRlIGEgcmVwb3NpdG9yeSBmb3IgY3VzdG9tIHR5cGUgZGV0ZWN0aW9uLlxuICpcbiAqIGBgYGpzXG4gKiB2YXIgbGliID0gbmV3IHR5cGUuTGlicmFyeTtcbiAqIGBgYFxuICpcbiAqL1xuXG5mdW5jdGlvbiBMaWJyYXJ5ICgpIHtcbiAgdGhpcy50ZXN0cyA9IHt9O1xufVxuXG4vKipcbiAqICMjIyMgLm9mIChvYmopXG4gKlxuICogRXhwb3NlIHJlcGxhY2VtZW50IGB0eXBlb2ZgIGRldGVjdGlvbiB0byB0aGUgbGlicmFyeS5cbiAqXG4gKiBgYGBqc1xuICogaWYgKCdzdHJpbmcnID09PSBsaWIub2YoJ2hlbGxvIHdvcmxkJykpIHtcbiAqICAgLy8gLi4uXG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmplY3QgdG8gdGVzdFxuICogQHJldHVybiB7U3RyaW5nfSB0eXBlXG4gKi9cblxuTGlicmFyeS5wcm90b3R5cGUub2YgPSBnZXRUeXBlO1xuXG4vKipcbiAqICMjIyMgLmRlZmluZSAodHlwZSwgdGVzdClcbiAqXG4gKiBBZGQgYSB0ZXN0IHRvIGZvciB0aGUgYC50ZXN0KClgIGFzc2VydGlvbi5cbiAqXG4gKiBDYW4gYmUgZGVmaW5lZCBhcyBhIHJlZ3VsYXIgZXhwcmVzc2lvbjpcbiAqXG4gKiBgYGBqc1xuICogbGliLmRlZmluZSgnaW50JywgL15bMC05XSskLyk7XG4gKiBgYGBcbiAqXG4gKiAuLi4gb3IgYXMgYSBmdW5jdGlvbjpcbiAqXG4gKiBgYGBqc1xuICogbGliLmRlZmluZSgnYmxuJywgZnVuY3Rpb24gKG9iaikge1xuICogICBpZiAoJ2Jvb2xlYW4nID09PSBsaWIub2Yob2JqKSkgcmV0dXJuIHRydWU7XG4gKiAgIHZhciBibG5zID0gWyAneWVzJywgJ25vJywgJ3RydWUnLCAnZmFsc2UnLCAxLCAwIF07XG4gKiAgIGlmICgnc3RyaW5nJyA9PT0gbGliLm9mKG9iaikpIG9iaiA9IG9iai50b0xvd2VyQ2FzZSgpO1xuICogICByZXR1cm4gISEgfmJsbnMuaW5kZXhPZihvYmopO1xuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQHBhcmFtIHtSZWdFeHB8RnVuY3Rpb259IHRlc3RcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuTGlicmFyeS5wcm90b3R5cGUuZGVmaW5lID0gZnVuY3Rpb24gKHR5cGUsIHRlc3QpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHJldHVybiB0aGlzLnRlc3RzW3R5cGVdO1xuICB0aGlzLnRlc3RzW3R5cGVdID0gdGVzdDtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqICMjIyMgLnRlc3QgKG9iaiwgdGVzdClcbiAqXG4gKiBBc3NlcnQgdGhhdCBhbiBvYmplY3QgaXMgb2YgdHlwZS4gV2lsbCBmaXJzdFxuICogY2hlY2sgbmF0aXZlcywgYW5kIGlmIHRoYXQgZG9lcyBub3QgcGFzcyBpdCB3aWxsXG4gKiB1c2UgdGhlIHVzZXIgZGVmaW5lZCBjdXN0b20gdGVzdHMuXG4gKlxuICogYGBganNcbiAqIGFzc2VydChsaWIudGVzdCgnMScsICdpbnQnKSk7XG4gKiBhc3NlcnQobGliLnRlc3QoJ3llcycsICdibG4nKSk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge01peGVkfSBvYmplY3RcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcmV0dXJuIHtCb29sZWFufSByZXN1bHRcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuTGlicmFyeS5wcm90b3R5cGUudGVzdCA9IGZ1bmN0aW9uIChvYmosIHR5cGUpIHtcbiAgaWYgKHR5cGUgPT09IGdldFR5cGUob2JqKSkgcmV0dXJuIHRydWU7XG4gIHZhciB0ZXN0ID0gdGhpcy50ZXN0c1t0eXBlXTtcblxuICBpZiAodGVzdCAmJiAncmVnZXhwJyA9PT0gZ2V0VHlwZSh0ZXN0KSkge1xuICAgIHJldHVybiB0ZXN0LnRlc3Qob2JqKTtcbiAgfSBlbHNlIGlmICh0ZXN0ICYmICdmdW5jdGlvbicgPT09IGdldFR5cGUodGVzdCkpIHtcbiAgICByZXR1cm4gdGVzdChvYmopO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBSZWZlcmVuY2VFcnJvcignVHlwZSB0ZXN0IFwiJyArIHR5cGUgKyAnXCIgbm90IGRlZmluZWQgb3IgaW52YWxpZC4nKTtcbiAgfVxufTtcbiIsInZhciBmdXJpb3VzID0gcmVxdWlyZShcIi4uL2xpYi9mdXJpb3VzLmpzXCIpO1xyXG52YXIgZXhwZWN0ID0gcmVxdWlyZShcImNoYWlcIikuZXhwZWN0O1xyXG5cclxuZGVzY3JpYmUoXCJEYXRhVHlwZVwiLCBmdW5jdGlvbigpe1xyXG5cdGRlc2NyaWJlKFwiZjMyXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRpdChcInNob3VsZCBoYXZlIHNpemUgNFwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgZHR5cGUgPSBuZXcgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKTtcclxuXHRcdFx0ZXhwZWN0KGR0eXBlLnNpemUpLnRvLmVxdWFsKDQpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0aXQoXCJzaG91bGQgaGF2ZSB0eXBlIFxcXCJmMzJcXFwiXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdHZhciBkdHlwZSA9IG5ldyBmdXJpb3VzLkRhdGFUeXBlKFwiZjMyXCIpO1xyXG5cdFx0XHRleHBlY3QoZHR5cGUudHlwZSkudG8uZXF1YWwoXCJmMzJcIik7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHRkZXNjcmliZShcImY2NFwiLCBmdW5jdGlvbigpe1xyXG5cdFx0aXQoXCJzaG91bGQgaGF2ZSBzaXplIDhcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0dmFyIGR0eXBlID0gbmV3IGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIik7XHJcblx0XHRcdGV4cGVjdChkdHlwZS5zaXplKS50by5lcXVhbCg4KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGl0KFwic2hvdWxkIGhhdmUgdHlwZSBcXFwiZjY0XFxcIlwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgZHR5cGUgPSBuZXcgZnVyaW91cy5EYXRhVHlwZShcImY2NFwiKTtcclxuXHRcdFx0ZXhwZWN0KGR0eXBlLnR5cGUpLnRvLmVxdWFsKFwiZjY0XCIpO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcbn0pO1xyXG4iLCJ2YXIgZnVyaW91cyA9IHJlcXVpcmUoXCIuLi9saWIvZnVyaW91cy5qc1wiKTtcclxudmFyIGV4cGVjdCA9IHJlcXVpcmUoXCJjaGFpXCIpLmV4cGVjdDtcclxuXHJcbnZhciBjb250ZXh0ID0gbnVsbDtcclxuYmVmb3JlKGZ1bmN0aW9uKGRvbmUpIHtcclxuXHRmdXJpb3VzLmluaXQoZnVuY3Rpb24oY3R4KSB7XHJcblx0XHRjb250ZXh0ID0gY3R4O1xyXG5cdFx0ZG9uZSgpO1xyXG5cdH0pO1xyXG59KTtcclxuXHJcbmRlc2NyaWJlKFwiTkRBcnJheVwiLCBmdW5jdGlvbigpe1xyXG5cdGRlc2NyaWJlKFwibGVuZ3RoXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRpdChcIkVxdWFscyB0byB0aGUgbnVtYmVyIHBhc3NlZCBpbiBjb25zdHJ1Y3RvclwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRleHBlY3QoKGNvbnRleHQuZW1wdHkoNDIpKS5sZW5ndGgpLnRvLmVxdWFsKDQyKTtcclxuXHRcdH0pO1xyXG5cdFx0aXQoXCJFcXVhbHMgdG8gdGhlIG51bWJlciBwYXNzZWQgaW4gY29uc3RydWN0b3IgYXMgYW4gYXJyYXlcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0ZXhwZWN0KChjb250ZXh0LmVtcHR5KFs0Ml0pKS5sZW5ndGgpLnRvLmVxdWFsKDQyKTtcclxuXHRcdH0pO1xyXG5cdFx0aXQoXCJFcXVhbHMgdG8gdGhlIHByb2R1Y3Qgb2YgZGltZW5zaW9uc1wiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRleHBlY3QoKGNvbnRleHQuZW1wdHkoWzIsIDUsIDNdKSkubGVuZ3RoKS50by5lcXVhbCgzMCk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHRkZXNjcmliZShcInJlc2hhcGVcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGl0KFwiUHJlc2VydmVzIGxlbmd0aFwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuZW1wdHkoWzcsNSwzXSk7XHJcblx0XHRcdHZhciB5ID0geC5yZXNoYXBlKFsyMSw1XSk7XHJcblx0XHRcdGV4cGVjdCh5Lmxlbmd0aCkudG8uZXF1YWwoeC5sZW5ndGgpO1xyXG5cdFx0fSk7XHJcblx0XHRpdChcIkNoYW5nZXMgc2hhcGVcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KFs3LDUsM10pO1xyXG5cdFx0XHR2YXIgeSA9IHgucmVzaGFwZShbMjEsNV0pO1xyXG5cdFx0XHRleHBlY3QoeS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMjEsNV0pO1xyXG5cdFx0fSk7XHJcblx0XHRpdChcIlJlYXJyYW5nZXMgZGF0YVwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDgsIDgpLnJlc2hhcGUoWzIsIDIsIDJdKTtcclxuXHRcdFx0eC5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbWyAxLCAgMl0sIFsgMywgIDRdXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgW1sgNSwgIDZdLCBbIDcsICA4XV1dKTtcclxuXHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJyZXBlYXRcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGl0KFwiUmVwZWF0cyBhcnJheSBlbGVtZW50cyBhbG9uZyBheGlzIDBcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzgsIDEsIDZdLFxyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgICAgIFszLCA1LCA3XSxcclxuXHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICBbNCwgOSwgMl1dKTtcclxuXHRcdFx0eC5yZXBlYXQoMiwgMCkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xyXG5cdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1s4LCAxLCA2XSxcclxuXHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbOCwgMSwgNl0sXHJcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWzMsIDUsIDddLFxyXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFszLCA1LCA3XSxcclxuXHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbNCwgOSwgMl0sXHJcblx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWzQsIDksIDJdXSk7XHJcblx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdFx0aXQoXCJSZXBlYXRzIGFycmF5IGVsZW1lbnRzIGFsb25nIGF4aXMgMVwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbOCwgMSwgNl0sXHJcblx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgWzMsIDUsIDddLFxyXG5cdFx0XHQgICAgICAgICAgICAgICAgICAgICAgIFs0LCA5LCAyXV0pO1xyXG5cdFx0XHR4LnJlcGVhdCgyLCAxKS5nZXQoZnVuY3Rpb24ocmVzdWx0KSB7XHJcblx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbWzgsIDgsIDEsIDEsIDYsIDZdLFxyXG5cdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFszLCAzLCA1LCA1LCA3LCA3XSxcclxuXHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbNCwgNCwgOSwgOSwgMiwgMl1dKTtcclxuXHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJnZXRcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGl0KFwiV29ya3Mgd2l0aCAxLWRpbWVuc2lvbmFsIGFycmF5XCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzQyLCAxMF0pO1xyXG5cdFx0XHR4LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoWzQyLCAxMF0pO1xyXG5cdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdGl0KFwiV29ya3Mgd2l0aCAyLWRpbWVuc2lvbmFsIGFycmF5XCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHR2YXIgYXJyYXkgPSBbWzE2LCAgMiwgIDMsIDEzLCAgNV0sXHJcblx0XHRcdFx0XHRcdCBbMTEsIDEwLCAgOCwgIDksICA3XSxcclxuXHRcdFx0XHRcdFx0IFsgNiwgMTIsICA0LCAxNCwgMTVdXTtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KGFycmF5KTtcclxuXHRcdFx0eC5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKGFycmF5KTtcclxuXHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJhZGRcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGRlc2NyaWJlKFwiQWRkIGFycmF5XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xyXG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbOCwgLTEsIDEwXSk7XHJcblx0XHRcdFx0dmFyIHogPSB4LmFkZCh5KTtcclxuXHRcdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbOSwgMywgMTldKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzEsIDRdLCBbOSwgLTE3XV0pO1xyXG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWzgsIC0xXSwgWzEwLCAtMjFdXSk7XHJcblx0XHRcdFx0dmFyIHogPSB4LmFkZCh5KTtcclxuXHRcdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbWzksIDNdLCBbMTksIC0zOF1dKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiQWRkIHNjYWxhclwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcclxuXHRcdFx0XHR2YXIgeiA9IHguYWRkKC03KTtcclxuXHRcdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbLTYsIC0zLCAyXSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAyLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1sxLCA0XSwgWzksIC0xN11dKTtcclxuXHRcdFx0XHR2YXIgeiA9IHguYWRkKDQyKTtcclxuXHRcdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbWzQzLCA0Nl0sIFs1MSwgMjVdXSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJzdWJcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGRlc2NyaWJlKFwiU3VidHJhY3QgYXJyYXlcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XHJcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KFs4LCAtMSwgMTBdKTtcclxuXHRcdFx0XHR2YXIgeiA9IHguc3ViKHkpO1xyXG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFstNywgNSwgLTFdKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWzEsIDRdLCBbOSwgLTE3XV0pO1xyXG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbWzgsIC0xXSwgWzEwLCAtMjFdXSk7XHJcblx0XHRcdFx0dmFyIHogPSB4LnN1Yih5KTtcclxuXHRcdFx0XHR6LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbWy03LCA1XSwgWy0xLCA0XV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdFx0ZGVzY3JpYmUoXCJTdWJ0cmFjdCBzY2FsYXJcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XHJcblx0XHRcdFx0dmFyIHkgPSB4LnN1YigtNyk7XHJcblx0XHRcdFx0eS5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoWzgsIDExLCAxNl0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XHJcblx0XHRcdFx0dmFyIHkgPSB4LnN1Yig0Mik7XHJcblx0XHRcdFx0eS5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1stNDEsIC0zOF0sIFstMzMsIC01OV1dKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHRkZXNjcmliZShcIm11bFwiLCBmdW5jdGlvbigpe1xyXG5cdFx0ZGVzY3JpYmUoXCJNdWx0aXBseSBieSBhcnJheVwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIDQsIDldKTtcclxuXHRcdFx0XHR2YXIgeSA9IGNvbnRleHQuYXJyYXkoWzgsIC0xLCAxMF0pO1xyXG5cdFx0XHRcdHZhciB6ID0geC5tdWwoeSk7XHJcblx0XHRcdFx0ei5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoWzgsIC00LCA5MF0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XHJcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KFtbOCwgLTFdLCBbMTAsIC0yMV1dKTtcclxuXHRcdFx0XHR2YXIgeiA9IHgubXVsKHkpO1xyXG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbOCwgLTRdLCBbOTAsIDM1N11dKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiTXVsdGlwbHkgYnkgc2NhbGFyXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xyXG5cdFx0XHRcdHZhciB5ID0geC5tdWwoLTEwKTtcclxuXHRcdFx0XHR5LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbLTEwLCAtNDAsIC05MF0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XHJcblx0XHRcdFx0dmFyIHkgPSB4Lm11bCgxMCk7XHJcblx0XHRcdFx0eS5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1sxMCwgNDBdLCBbOTAsIC0xNzBdXSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJkaXZcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGRlc2NyaWJlKFwiRGl2aWRlIGJ5IGFycmF5XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xyXG5cdFx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbMiwgLTQsIDhdKTtcclxuXHRcdFx0XHR2YXIgeiA9IHguZGl2KHkpO1xyXG5cdFx0XHRcdHouZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFswLjUsIC0xLCAxLjEyNV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbMSwgNF0sIFs5LCAtMTddXSk7XHJcblx0XHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KFtbLTIsIDRdLCBbLTgsIDE2XV0pO1xyXG5cdFx0XHRcdHZhciB6ID0geC5kaXYoeSk7XHJcblx0XHRcdFx0ei5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoW1stMC41LCAxXSwgWy0xLjEyNSwgLTEuMDYyNV1dKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiRGl2aWRlIGJ5IHNjYWxhclwiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgNCwgOV0pO1xyXG5cdFx0XHRcdHZhciB5ID0geC5kaXYoLTIpO1xyXG5cdFx0XHRcdHkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFstMC41LCAtMiwgLTQuNV0pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoW1sxLCA0XSwgWzksIC0xN11dKTtcclxuXHRcdFx0XHR2YXIgeSA9IHguZGl2KC00KTtcclxuXHRcdFx0XHR5LmdldChmdW5jdGlvbihyZXN1bHQpe1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChbWy0wLjI1LCAtMV0sIFstMi4yNSwgNC4yNV1dKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHRkZXNjcmliZShcIm1pblwiLCBmdW5jdGlvbigpe1xyXG5cdFx0ZGVzY3JpYmUoXCJBbGwgZWxlbWVudHNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XHJcblx0XHRcdFx0eC5taW4oKS5nZXQoZnVuY3Rpb24ocmVzdWx0KSB7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5lcXVhbCgxKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWy0yLCA0XSwgWy04LCAxNl1dKTtcclxuXHRcdFx0XHR4Lm1pbigpLmdldChmdW5jdGlvbihyZXN1bHQpIHtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmVxdWFsKC04KTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiQWxvbmcgYW4gYXhpc1wiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkNvcnJlY3Qgc2hhcGUgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pO1xyXG5cdFx0XHRcdGV4cGVjdCh4Lm1pbigwKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMywgNF0pO1xyXG5cdFx0XHRcdGV4cGVjdCh4Lm1pbigxKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgNF0pO1xyXG5cdFx0XHRcdGV4cGVjdCh4Lm1pbigyKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgM10pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMFwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5taW4oMCkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbIDEsICAyLCAgMywgIDRdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFsgNSwgIDYsICA3LCAgOF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgWyA5LCAxMCwgMTEsIDEyXV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMVwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5taW4oMSkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbICAxLCAgMiwgIDMsICA0XSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDEzLCAxNCwgMTUsIDE2XV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMlwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5taW4oMikuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbICAxLCAgNSwgIDldLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFsgMTMsIDE3LCAyMV1dKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHRkZXNjcmliZShcIm1heFwiLCBmdW5jdGlvbigpe1xyXG5cdFx0ZGVzY3JpYmUoXCJBbGwgZWxlbWVudHNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XHJcblx0XHRcdFx0eC5tYXgoKS5nZXQoZnVuY3Rpb24ocmVzdWx0KSB7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5lcXVhbCg5KTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0XHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbWy0yLCA0XSwgWy04LCAxNl1dKTtcclxuXHRcdFx0XHR4Lm1heCgpLmdldChmdW5jdGlvbihyZXN1bHQpIHtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmVxdWFsKDE2KTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiQWxvbmcgYW4gYXhpc1wiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkNvcnJlY3Qgc2hhcGUgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pO1xyXG5cdFx0XHRcdGV4cGVjdCh4Lm1heCgwKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMywgNF0pO1xyXG5cdFx0XHRcdGV4cGVjdCh4Lm1heCgxKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgNF0pO1xyXG5cdFx0XHRcdGV4cGVjdCh4Lm1heCgyKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgM10pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMFwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5tYXgoMCkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbIDEzLCAxNCwgMTUsIDE2XSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDE3LCAxOCwgMTksIDIwXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDIxLCAyMiwgMjMsIDI0XV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMVwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5tYXgoMSkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbICA5LCAxMCwgMTEsIDEyXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDIxLCAyMiwgMjMsIDI0XV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMlwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5tYXgoMikuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbICA0LCAgOCwgMTJdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFsgMTYsIDIwLCAyNF1dKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHRkZXNjcmliZShcInN1bVwiLCBmdW5jdGlvbigpe1xyXG5cdFx0ZGVzY3JpYmUoXCJBbGwgZWxlbWVudHNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCA0LCA5XSk7XHJcblx0XHRcdFx0eC5zdW0oKS5nZXQoZnVuY3Rpb24gKHJlc3VsdCkge1xyXG5cdFx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZXF1YWwoMTQpO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbLTIsIDRdLCBbLTgsIDE2XV0pO1xyXG5cdFx0XHRcdHguc3VtKCkuZ2V0KGZ1bmN0aW9uIChyZXN1bHQpIHtcclxuXHRcdFx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmVxdWFsKDEwKTtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdGRlc2NyaWJlKFwiQWxvbmcgYW4gYXhpc1wiLCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpdChcIkNvcnJlY3Qgc2hhcGUgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKDEsIDI0LCAyNCkucmVzaGFwZShbMiwgMywgNF0pO1xyXG5cdFx0XHRcdGV4cGVjdCh4LnN1bSgwKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMywgNF0pO1xyXG5cdFx0XHRcdGV4cGVjdCh4LnN1bSgxKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgNF0pO1xyXG5cdFx0XHRcdGV4cGVjdCh4LnN1bSgyKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgM10pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMFwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5zdW0oMCkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbIDE0LCAxNiwgMTgsIDIwXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDIyLCAyNCwgMjYsIDI4XSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDMwLCAzMiwgMzQsIDM2XV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMVwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5zdW0oMSkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbIDE1LCAgMTgsICAyMSwgIDI0XSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBbIDUxLCAgNTQsICA1NywgIDYwXV0pO1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMy1kaW1lbnNpb25hbCBhcnJheXMsIGF4aXMgMlwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0XHR2YXIgeCA9IGNvbnRleHQubGluc3BhY2UoMSwgMjQsIDI0KS5yZXNoYXBlKFsyLCAzLCA0XSk7XHJcblx0XHRcdFx0eC5zdW0oMikuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbIDEwLCAgMjYsICA0Ml0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgWyA1OCwgIDc0LCAgOTBdXSk7XHJcblx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblx0ZGVzY3JpYmUoXCJkb3RcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGl0KFwiQ29ycmVjdCBzaGFwZSBmb3IgMi1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KFsyLCA1XSk7XHJcblx0XHRcdHZhciB5ID0gY29udGV4dC5lbXB0eShbNSwgMTFdKTtcclxuXHRcdFx0ZXhwZWN0KGNvbnRleHQuZG90KHgsIHkpLnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAxMV0pO1xyXG5cdFx0fSk7XHJcblx0XHRpdChcIkNvcnJlY3Qgc2hhcGUgZm9yIDMtZGltZW5zaW9uYWwgYXJyYXlzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5lbXB0eShbMiwgMywgNF0pO1xyXG5cdFx0XHR2YXIgeSA9IGNvbnRleHQuZW1wdHkoWzcsIDQsIDhdKTtcclxuXHRcdFx0ZXhwZWN0KGNvbnRleHQuZG90KHgsIHkpLnNoYXBlKS50by5kZWVwLmVxdWFsKFsyLCAzLCA3LCA4XSk7XHJcblx0XHR9KTtcclxuXHRcdGl0KFwiQ29ycmVjdCBzaGFwZSBmb3IgNC1kaW1lbnNpb25hbCBhcnJheXNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmVtcHR5KFsyLCAzLCA0LCA1XSk7XHJcblx0XHRcdHZhciB5ID0gY29udGV4dC5lbXB0eShbNiwgNywgNSwgOF0pO1xyXG5cdFx0XHRleHBlY3QoY29udGV4dC5kb3QoeCwgeSkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzIsIDMsIDQsIDYsIDcsIDhdKTtcclxuXHRcdH0pO1xyXG5cdFx0aXQoXCJDb3JyZWN0IHZhbHVlIGZvciAxLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsyLCA1XSk7XHJcblx0XHRcdHZhciB5ID0gY29udGV4dC5hcnJheShbNSwgMTFdKTtcclxuXHRcdFx0Y29udGV4dC5kb3QoeCwgeSkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbCg2NSk7XHJcblx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdFx0aXQoXCJDb3JyZWN0IHZhbHVlIGZvciAyLWRpbWVuc2lvbmFsIGFycmF5c1wiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFtbNjQsICAyLCAgM10sXHJcblx0XHRcdFx0XHRcdFx0XHQgICBbNjEsIDYwLCAgNl1dKTtcclxuXHRcdFx0dmFyIHkgPSBjb250ZXh0LmFycmF5KFtbOTIsIDk5LCAgMSwgIDgsIDE1XSxcclxuXHRcdFx0XHRcdFx0XHRcdCAgIFs2NywgNzQsIDUxLCA1OCwgNDBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0ICAgWzk4LCA4MCwgIDcsIDE0LCAxNl1dKTtcclxuXHRcdFx0dmFyIHogPSBjb250ZXh0LmRvdCh4LCB5KTtcclxuXHRcdFx0ei5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0XHRleHBlY3QocmVzdWx0KS50by5kZWVwLmVxdWFsKFtbICA2MzE2LCAgNjcyNCwgIDE4NywgIDY3MCwgMTA4OF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFsgMTAyMjAsIDEwOTU5LCAzMTYzLCA0MDUyLCAzNDExXV0pO1xyXG5cdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxufSk7XHJcbmRlc2NyaWJlKFwiZW1wdHlcIiwgZnVuY3Rpb24oKXtcclxuXHRpdChcIk5vIGVycm9yIHdpdGggaW50ZWdlciBzaGFwZVwiLCBmdW5jdGlvbigpe1xyXG5cdFx0ZXhwZWN0KGZ1bmN0aW9uICgpe2NvbnRleHQuZW1wdHkoMTAwKTt9KS50by5ub3QudGhyb3coRXJyb3IpO1xyXG5cdH0pO1xyXG5cdGl0KFwiTm8gZXJyb3Igd2l0aCBpbnRlZ2VyIGFycmF5IHNoYXBlXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRleHBlY3QoZnVuY3Rpb24gKCl7Y29udGV4dC5lbXB0eShbMTAwXSk7fSkudG8ubm90LnRocm93KEVycm9yKTtcclxuXHR9KTtcclxuXHRpdChcIk5vIGVycm9yIHdpdGggbXVsdGktZGltZW5zaW9uYWwgaW50ZWdlciBhcnJheSBzaGFwZVwiLCBmdW5jdGlvbigpe1xyXG5cdFx0ZXhwZWN0KGZ1bmN0aW9uICgpe2NvbnRleHQuZW1wdHkoWzIsIDUsIDFdKTt9KS50by5ub3QudGhyb3coRXJyb3IpO1xyXG5cdH0pO1xyXG5cdGl0KFwiTm8gZXJyb3Igd2l0aCBleHBsaWNpdCBGNjQgZGF0YSB0eXBlXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRleHBlY3QoZnVuY3Rpb24gKCl7Y29udGV4dC5lbXB0eShbMiwgNSwgMV0sIGZ1cmlvdXMuRGF0YVR5cGUoXCJmNjRcIikpO30pLnRvLm5vdC50aHJvdyhFcnJvcik7XHJcblx0fSk7XHJcblx0aXQoXCJObyBlcnJvciB3aXRoIEYzMiBkYXRhIHR5cGVcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGV4cGVjdChmdW5jdGlvbiAoKXtjb250ZXh0LmVtcHR5KFsyLCA1LCAxXSwgZnVyaW91cy5EYXRhVHlwZShcImYzMlwiKSk7fSkudG8ubm90LnRocm93KEVycm9yKTtcclxuXHR9KTtcclxufSk7XHJcbmRlc2NyaWJlKFwiYXJyYXlcIiwgZnVuY3Rpb24oKXtcclxuXHRpdChcIk1hdGNoZXMgdGhlIGxlbmd0aCBvZiB0aGUgcHJvdmlkZWQgYXJyYXlcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGV4cGVjdCgoY29udGV4dC5hcnJheShbMCwgMV0pKS5sZW5ndGgpLnRvLmVxdWFsKDIpO1xyXG5cdFx0ZXhwZWN0KChjb250ZXh0LmFycmF5KFtbMCwgMV0sIFsyLDNdLCBbMyw0XV0pKS5sZW5ndGgpLnRvLmVxdWFsKDYpO1xyXG5cdH0pO1xyXG5cdGl0KFwiTWF0Y2hlcyB0aGUgc2hhcGUgb2YgdGhlIHByb3ZpZGVkIGFycmF5XCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRleHBlY3QoKGNvbnRleHQuYXJyYXkoWzAsIDFdKSkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzJdKTtcclxuXHRcdGV4cGVjdCgoY29udGV4dC5hcnJheShbWzAsIDFdLCBbMiwzXSwgWzMsNF1dKSkuc2hhcGUpLnRvLmRlZXAuZXF1YWwoWzMsIDJdKTtcclxuXHRcdGV4cGVjdCgoY29udGV4dC5hcnJheShbW1sxLCAyLCAzXSwgWzQsIDUsIDZdXSwgW1s3LCA4LCA5XSwgWzEwLCAxMSwgMTJdXV0pKS5zaGFwZSkudG8uZGVlcC5lcXVhbChbMiwgMiwgM10pO1xyXG5cdH0pO1xyXG5cdGl0KFwiTWF0Y2hlcyB0aGUgZGF0YSBvZiB0aGUgcHJvdmlkZWQgYXJyYXlcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHR2YXIgYXJyYXkgPSBbW1sxLCAyLCAzXSwgWzQsIDUsIDZdXSwgW1s3LCA4LCA5XSwgWzEwLCAxMSwgMTJdXV07XHJcblx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoYXJyYXkpO1xyXG5cdFx0eC5nZXQoZnVuY3Rpb24ocmVzdWx0KXtcclxuXHRcdFx0ZXhwZWN0KHJlc3VsdCkudG8uZGVlcC5lcXVhbChhcnJheSk7XHJcblx0XHRcdGRvbmUoKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG59KTtcclxuZGVzY3JpYmUoXCJsaW5zcGFjZVwiLCBmdW5jdGlvbigpe1xyXG5cdGl0KFwiSGFzIGxlbmd0aCBvZiA1MCB3aXRoIGRlZmF1bHQgYXJndW1lbnRzXCIsIGZ1bmN0aW9uKCl7XHJcblx0XHRleHBlY3QoKGNvbnRleHQubGluc3BhY2UoMCwgMSkpLmxlbmd0aCkudG8uZXF1YWwoNTApO1xyXG5cdH0pO1xyXG5cdGl0KFwiSGFzIHRoZSBzcGVjaWZpZWQgbnVtYmVyIG9mIHNhbXBsZXNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGV4cGVjdCgoY29udGV4dC5saW5zcGFjZSgwLCAxLCAyNDMpKS5sZW5ndGgpLnRvLmVxdWFsKDI0Myk7XHJcblx0fSk7XHJcblx0aXQoXCJIYXMgZXhwZWN0ZWQgdmFsdWVzXCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0dmFyIHN0YXJ0ID0gNTA7XHJcblx0XHR2YXIgc3RvcCA9IDk5O1xyXG5cdFx0dmFyIHggPSBjb250ZXh0LmxpbnNwYWNlKHN0YXJ0LCBzdG9wKTtcclxuXHRcdHguZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdC5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdGV4cGVjdChyZXN1bHRbaV0pLnRvLmVxdWFsKHN0YXJ0K2kpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGRvbmUoKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cdGRlc2NyaWJlKFwid2l0aCBpbmNsdWRlU3RvcCA9PT0gZmFsc2VcIiwgZnVuY3Rpb24oKXtcclxuXHRcdGl0KFwiSGFzIHRoZSBzcGVjaWZpZWQgbnVtYmVyIG9mIHNhbXBsZXNcIiwgZnVuY3Rpb24oKXtcclxuXHRcdFx0ZXhwZWN0KChjb250ZXh0LmxpbnNwYWNlKDAsIDEsIDI0MywgZmFsc2UpKS5sZW5ndGgpLnRvLmVxdWFsKDI0Myk7XHJcblx0XHR9KTtcclxuXHRcdGl0KFwiRG9lcyBub3QgY29udGFpbiB0aGUgcmlnaHQgZW5kcG9pbnRcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHRcdHZhciB4ID0gY29udGV4dC5saW5zcGFjZSgtMSwgMSwgMTAwMCwgZmFsc2UpO1xyXG5cdFx0XHR4LmdldChmdW5jdGlvbihyZXN1bHQpIHtcclxuXHRcdFx0XHRleHBlY3QocmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXSkudG8ubm90LmVxdWFsKDEpO1xyXG5cdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxufSk7XHJcbmRlc2NyaWJlKFwibmVnXCIsIGZ1bmN0aW9uKCkge1xyXG5cdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIC03LjUsIDAsIC0xNV0pO1xyXG5cdFx0dmFyIHkgPSBjb250ZXh0Lm5lZyh4KTtcclxuXHRcdHkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoWy0xLCA3LjUsIC0wLCAxNV0pO1xyXG5cdFx0XHRkb25lKCk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxufSk7XHJcbmRlc2NyaWJlKFwiYWJzXCIsIGZ1bmN0aW9uKCkge1xyXG5cdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDItZGltZW5zaW9uYWwgYXJyYXlcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWzEsIC03LjUsIDAsIC0xNV0pO1xyXG5cdFx0dmFyIHkgPSBjb250ZXh0LmFicyh4KTtcclxuXHRcdHkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCl7XHJcblx0XHRcdGV4cGVjdChyZXN1bHQpLnRvLmRlZXAuZXF1YWwoWzEsIDcuNSwgMCwgMTVdKTtcclxuXHRcdFx0ZG9uZSgpO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcbn0pO1xyXG5kZXNjcmliZShcImV4cFwiLCBmdW5jdGlvbigpIHtcclxuXHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIG5ld2x5IGNyZWF0ZWQgb3V0cHV0IGFycmF5XCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFsxLCAtMSwgMF0pO1xyXG5cdFx0Y29udGV4dC5leHAoeCkuZ2V0KGZ1bmN0aW9uKHJlc3VsdCkge1xyXG5cdFx0XHRleHBlY3QocmVzdWx0WzBdKS50by5iZS5jbG9zZVRvKE1hdGguZXhwKDEpLCBNYXRoLmV4cCgxKSAqIDIuMjIwNDQ2MDQ5MjUwMzEzMDgwODQ3MjYzMzM2MTgxNkUtMTYgKiAzKTtcclxuXHRcdFx0ZXhwZWN0KHJlc3VsdFsxXSkudG8uYmUuY2xvc2VUbyhNYXRoLmV4cCgtMSksIE1hdGguZXhwKC0xKSAqIDIuMjIwNDQ2MDQ5MjUwMzEzMDgwODQ3MjYzMzM2MTgxNkUtMTYgKiAzKTtcclxuXHRcdFx0ZXhwZWN0KHJlc3VsdFsyXSkudG8uZXF1YWwoMSk7XHJcblx0XHRcdGRvbmUoKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG59KTtcclxuZGVzY3JpYmUoXCJsb2dcIiwgZnVuY3Rpb24oKSB7XHJcblx0aXQoXCJDb3JyZWN0IHJlc3VsdCBmb3IgMS1kaW1lbnNpb25hbCBuZXdseSBjcmVhdGVkIG91dHB1dCBhcnJheVwiLCBmdW5jdGlvbihkb25lKXtcclxuXHRcdHZhciB4ID0gY29udGV4dC5hcnJheShbMSwgMywgMTBdKTtcclxuXHRcdGNvbnRleHQubG9nKHgpLmdldChmdW5jdGlvbihyZXN1bHQpIHtcclxuXHRcdFx0ZXhwZWN0KHJlc3VsdFswXSkudG8uZXF1YWwoMCk7XHJcblx0XHRcdGV4cGVjdChyZXN1bHRbMV0pLnRvLmJlLmNsb3NlVG8oTWF0aC5sb2coMyksIE1hdGgubG9nKDMpICogMi4yMjA0NDYwNDkyNTAzMTMwODA4NDcyNjMzMzYxODE2RS0xNiAqIDMpO1xyXG5cdFx0XHRleHBlY3QocmVzdWx0WzJdKS50by5iZS5jbG9zZVRvKE1hdGgubG9nKDEwKSwgTWF0aC5sb2coMTApICogMi4yMjA0NDYwNDkyNTAzMTMwODA4NDcyNjMzMzYxODE2RS0xNiAqIDMpO1xyXG5cdFx0XHRkb25lKCk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxufSk7XHJcbmRlc2NyaWJlKFwic3FydFwiLCBmdW5jdGlvbigpIHtcclxuXHRpdChcIkNvcnJlY3QgcmVzdWx0IGZvciAxLWRpbWVuc2lvbmFsIG5ld2x5IGNyZWF0ZWQgb3V0cHV0IGFycmF5XCIsIGZ1bmN0aW9uKGRvbmUpe1xyXG5cdFx0dmFyIHggPSBjb250ZXh0LmFycmF5KFswLCAwLjI1LCAxLCA5LCAxMF0pO1xyXG5cdFx0Y29udGV4dC5zcXJ0KHgpLmdldChmdW5jdGlvbihyZXN1bHQpIHtcclxuXHRcdFx0ZXhwZWN0KHJlc3VsdFswXSkudG8uZXF1YWwoMCk7XHJcblx0XHRcdGV4cGVjdChyZXN1bHRbMV0pLnRvLmVxdWFsKDAuNSk7XHJcblx0XHRcdGV4cGVjdChyZXN1bHRbMl0pLnRvLmVxdWFsKDEpO1xyXG5cdFx0XHRleHBlY3QocmVzdWx0WzNdKS50by5lcXVhbCgzKTtcclxuXHRcdFx0ZXhwZWN0KHJlc3VsdFs0XSkudG8uYmUuY2xvc2VUbyhNYXRoLnNxcnQoMTApLCBNYXRoLnNxcnQoMTApICogMi4yMjA0NDYwNDkyNTAzMTMwODA4NDcyNjMzMzYxODE2RS0xNiAqIDMpO1xyXG5cdFx0XHRkb25lKCk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxufSk7XHJcbmRlc2NyaWJlKFwic3F1YXJlXCIsIGZ1bmN0aW9uKCkge1xyXG5cdGl0KFwiQ29ycmVjdCByZXN1bHQgZm9yIDEtZGltZW5zaW9uYWwgbmV3bHkgY3JlYXRlZCBvdXRwdXQgYXJyYXlcIiwgZnVuY3Rpb24oZG9uZSl7XHJcblx0XHR2YXIgeCA9IGNvbnRleHQuYXJyYXkoWy0yLCAwLCAwLjUsIDEsIDNdKTtcclxuXHRcdGNvbnRleHQuc3F1YXJlKHgpLmdldChmdW5jdGlvbihyZXN1bHQpIHtcclxuXHRcdFx0ZXhwZWN0KHJlc3VsdFswXSkudG8uZXF1YWwoNCk7XHJcblx0XHRcdGV4cGVjdChyZXN1bHRbMV0pLnRvLmVxdWFsKDApO1xyXG5cdFx0XHRleHBlY3QocmVzdWx0WzJdKS50by5lcXVhbCgwLjI1KTtcclxuXHRcdFx0ZXhwZWN0KHJlc3VsdFszXSkudG8uZXF1YWwoMSk7XHJcblx0XHRcdGV4cGVjdChyZXN1bHRbNF0pLnRvLmVxdWFsKDkpO1xyXG5cdFx0XHRkb25lKCk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxufSk7XHJcbiJdfQ==
