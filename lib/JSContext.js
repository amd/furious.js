"use strict";

var NDArray = require("./NDArray");
var DataType = require("./DataType");
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
	if (!util.isPositiveIntArray(shape) && !util.isPositiveInt(shape)) {
		throw new TypeError(shape + " is not a valid array shape");
	}
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var array = new NDArray(shape, dataType, this);
	array.data = new dataType.arrayType(array.length);
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
	var shape = [];
	util.discoverArrayShapeRecursive(data, shape, 0);
	var array = this.empty(shape, dataType, this);
	util.copyArrayDataRecursive(array.data, data, shape, 0, 0);
	return array;
};

JSContext.prototype.release = function(ndarray) {
	if (!(ndarray instanceof NDArray)) {
		throw new TypeError(ndarray + " is not an NDArray");
	}
	ndarray.data = null;
};

JSContext.prototype.toArray = function(ndarray, callback) {
	if (!(ndarray instanceof NDArray)) {
		throw new TypeError(ndarray + " is not an NDArray");
	}
	var jsarray = new Array(ndarray.shape[0]);
	util.createArrayRecursive(ndarray.data, jsarray, ndarray.shape, 0, 0);
	callback(jsarray);
};

/**
 * Creates another array with the same data, but different dimensions.
 *
 * @method reshape
 * @param {(NDArray|Number)} newShape - dimensions of the new array.
 */
JSContext.prototype.reshape = function(ndarray, newShape) {
	if (!util.isPositiveIntArray(newShape) && !util.isPositiveInt(newShape)) {
		throw new TypeError(newShape + " is not a valid array shape");
	}
	if (shapeToLength(newShape) !== ndarray.length) {
		throw new RangeError(newShape + " is not compatible with the array");
	}
	var output = this.empty(newShape, ndarray.dataType);
	output.data.set(ndarray.data);
	return output;
};

/**
 * Adds another array or a number to this array.
 *
 * @method add
 * @param {(NDArray|Number)} other - the array or scalar to be added.
 */
JSContext.prototype.add = function(a, b, out) {
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
		out = this.empty(shape, dataType);
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray");
	}
	if (a instanceof NDArray) {
		if (b instanceof NDArray) {
			for (var i = 0; i < a.length; ++i) {
				out.data[i] = a.data[i] + b.data[i];
			}
		} else {
			for (var i = 0; i < a.length; ++i) {
				out.data[i] = a.data[i] + b;
			}
		}
	}
	return out;
};

/**
 * Subtracts another array or a number from this array.
 *
 * @method sub
 * @param {(NDArray|Number)} other - the array or scalar to be subtracted.
 */
JSContext.prototype.sub = function(a, b, out) {
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
		out = this.empty(shape, dataType);
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray");
	}
	if (a instanceof NDArray) {
		if (b instanceof NDArray) {
			for (var i = 0; i < a.length; ++i) {
				out.data[i] = a.data[i] - b.data[i];
			}
		} else {
			for (var i = 0; i < a.length; ++i) {
				out.data[i] = a.data[i] - b;
			}
		}
	}
	return out;
};


/**
 * Multiplies array elements by another array or by a number.
 *
 * @method mul
 * @param {(NDArray|Number)} other - the array or scalar to multiply elements by.
 */
JSContext.prototype.mul = function(a, b, out) {
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
		out = this.empty(shape, dataType);
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray");
	}
	if (a instanceof NDArray) {
		if (b instanceof NDArray) {
			for (var i = 0; i < a.length; ++i) {
				out.data[i] = a.data[i] * b.data[i];
			}
		} else {
			for (var i = 0; i < a.length; ++i) {
				out.data[i] = a.data[i] * b;
			}
		}
	}
	return out;
};

/**
 * Divides array elements by another array or by a number.
 *
 * @method div
 * @param {(NDArray|Number)} other - the array or scalar to divide elements by.
 */
JSContext.prototype.div = function(a, b, out) {
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
		out = this.empty(shape, dataType);
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray");
	}
	if (a instanceof NDArray) {
		if (b instanceof NDArray) {
			for (var i = 0; i < a.length; ++i) {
				out.data[i] = a.data[i] / b.data[i];
			}
		} else {
			for (var i = 0; i < a.length; ++i) {
				out.data[i] = a.data[i] / b;
			}
		}
	}
	return out;
};

JSContext.prototype.min = function(inArray, axis) {
	if (typeof axis === "undefined") {
		var output = this.empty([1], inArray.dataType);
		
		/* Computation of all-array min */
		var result = inArray.data[0];
		for (var i = 1; i < inArray.length; ++i) {
			result = Math.min(result, inArray.data[i]);
		}
		output.data[0] = result;

		return output;
	} else if (util.isInt(axis)) {
		axis = util.checkAxis(axis, inArray.shape.length);
		var outShape = util.computeAxisReductionOutShape(inArray.shape, axis);
		var outArray = this.empty(outShape, inArray.dataType);

		/* Computation of min along axis */
		var outerStride = util.computeAxisReductionOuterStride(outShape, axis);
		var innerStride = util.computeAxisReductionInnerStride(outShape, axis);
		var reductionDim = inArray.shape[axis];
		for (var i = 0; i < outerStride; ++i) {
			for (var k = 0; k < innerStride; ++k) {
				var offset = i * reductionDim * innerStride + k;
				var currentMin = inArray.data[offset];
				for (var j = 1; j < reductionDim; ++j) {
					offset += innerStride;
					currentMin = Math.min(currentMin, inArray.data[offset]);
				}
				outArray.data[i * innerStride + k] = currentMin;
			}
		}

		return outArray;
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

JSContext.prototype.max = function(inArray, axis) {
	if (typeof axis === "undefined") {
		var output = this.empty([1], inArray.dataType);
		
		/* Computation of all-array max */
		var result = inArray.data[0];
		for (var i = 1; i < inArray.length; ++i) {
			result = Math.max(result, inArray.data[i]);
		}
		output.data[0] = result;

		return output;
	} else if (util.isInt(axis)) {
		axis = util.checkAxis(axis, inArray.shape.length);
		var outShape = util.computeAxisReductionOutShape(inArray.shape, axis);
		var outArray = this.empty(outShape, inArray.dataType);

		/* Computation of max along axis */
		var outerStride = util.computeAxisReductionOuterStride(outShape, axis);
		var innerStride = util.computeAxisReductionInnerStride(outShape, axis);
		var reductionDim = inArray.shape[axis];
		for (var i = 0; i < outerStride; ++i) {
			for (var k = 0; k < innerStride; ++k) {
				var offset = i * reductionDim * innerStride + k;
				var currentMax = inArray.data[offset];
				for (var j = 1; j < reductionDim; ++j) {
					offset += innerStride;
					currentMax = Math.max(currentMax, inArray.data[offset]);
				}
				outArray.data[i * innerStride + k] = currentMax;
			}
		}

		return outArray;
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

JSContext.prototype.sum = function(inArray, axis) {
	if (typeof axis === "undefined") {
		var output = this.empty([1], inArray.dataType);
		
		/* Computation of all-array sum */
		var result = inArray.data[0];
		for (var i = 1; i < inArray.length; ++i) {
			result += inArray.data[i];
		}
		output.data[0] = result;

		return output;
	} else if (util.isInt(axis)) {
		axis = util.checkAxis(axis, inArray.shape.length);
		var outShape = util.computeAxisReductionOutShape(inArray.shape, axis);
		var outArray = this.empty(outShape, inArray.dataType);

		/* Computation of sum along axis */
		var outerStride = util.computeAxisReductionOuterStride(outShape, axis);
		var innerStride = util.computeAxisReductionInnerStride(outShape, axis);
		var reductionDim = inArray.shape[axis];
		for (var i = 0; i < outerStride; ++i) {
			for (var k = 0; k < innerStride; ++k) {
				var offset = i * reductionDim * innerStride + k;
				var currentSum = inArray.data[offset];
				for (var j = 1; j < reductionDim; ++j) {
					offset += innerStride;
					currentSum += inArray.data[offset];
				}
				outArray.data[i * innerStride + k] = currentSum;
			}
		}

		return outArray;
	} else {
		throw new TypeError("Unsupported axis type");
	}
};

JSContext.prototype.neg = function(input, output) {
	if (!(input instanceof NDArray)) {
		throw new TypeError(input + " is not an NDArray");
	}
	if (typeof output === "undefined") {
		output = this.empty(input.shape, input.dataType);
	} else if (output instanceof NDArray) {
		if (!isCompatibleShape(this.shape, output.shape)) {
			throw new RangeError("The arrays have different dimensions");
		}
	} else {
		throw new TypeError(output + " is not an NDArray");
	}
	for (var i = 0; i < input.length; i++) {
		output.data[i] = -input.data[i];
	}
	return output;
};

/**
 * Computes absolute value of array elements.
 *
 * @method abs
 * @param {NDArray} input - the input array.
 * @param {NDArray=} output - the output array for the absolute values. If supplied, must match the dimensions of the `input` array.
 */
JSContext.prototype.abs = function(input, output) {
	if (!(input instanceof NDArray)) {
		throw new TypeError(input + " is not an NDArray");
	}
	if (typeof output === "undefined") {
		output = this.empty(input.shape, input.dataType);
	} else if (output instanceof NDArray) {
		if (!isCompatibleShape(this.shape, output.shape)) {
			throw new RangeError("The arrays have different dimensions");
		}
	} else {
		throw new TypeError(output + " is not an NDArray");
	}
	for (var i = 0; i < input.length; i++) {
		output.data[i] = Math.abs(input.data[i]);
	}
	return output;
};

/**
 * Exponentiates array elements.
 *
 * @method exp
 * @param {NDArray} input - the array with elements to be exponentiated.
 * @param {NDArray=} output - the array for the exponentiated values. If supplied, must match the dimensions of the `input` array.
 */
JSContext.prototype.exp = function(input, output) {
	if (!(input instanceof NDArray)) {
		throw new TypeError(input + " is not an NDArray");
	}
	if (typeof output === "undefined") {
		output = this.empty(input.shape, input.dataType);
	} else if (output instanceof NDArray) {
		if (!isCompatibleShape(this.shape, output.shape)) {
			throw new RangeError("The arrays have different dimensions");
		}
	} else {
		throw new TypeError(output + " is not an NDArray");
	}
	for (var i = 0; i < input.length; i++) {
		output.data[i] = Math.exp(input.data[i]);
	}
	return output;
};

/**
 * Computes the natural (base e) logarithm of array elements.
 *
 * @method log
 * @param {NDArray} input - the input array.
 * @param {NDArray=} output - the array for the logarithm value values. If supplied, must match the dimensions of the `input` array.
 */
JSContext.prototype.log = function(input, output) {
	if (!(input instanceof NDArray)) {
		throw new TypeError(input + " is not an NDArray");
	}
	if (typeof output === "undefined") {
		output = this.empty(input.shape, input.dataType);
	} else if (output instanceof NDArray) {
		if (!isCompatibleShape(this.shape, output.shape)) {
			throw new RangeError("The arrays have different dimensions");
		}
	} else {
		throw new TypeError(output + " is not an NDArray");
	}
	for (var i = 0; i < input.length; i++) {
		output.data[i] = Math.log(input.data[i]);
	}
	return output;
};

JSContext.prototype.sqrt = function(input, output) {
	if (!(input instanceof NDArray)) {
		throw new TypeError(input + " is not an NDArray");
	}
	if (typeof output === "undefined") {
		output = this.empty(input.shape, input.dataType);
	} else if (output instanceof NDArray) {
		if (!isCompatibleShape(this.shape, output.shape)) {
			throw new RangeError("The arrays have different dimensions");
		}
	} else {
		throw new TypeError(output + " is not an NDArray");
	}
	for (var i = 0; i < input.length; i++) {
		output.data[i] = Math.sqrt(input.data[i]);
	}
	return output;
};

JSContext.prototype.square = function(input, output) {
	if (!(input instanceof NDArray)) {
		throw new TypeError(input + " is not an NDArray");
	}
	if (typeof output === "undefined") {
		output = this.empty(input.shape, input.dataType);
	} else if (output instanceof NDArray) {
		if (!isCompatibleShape(this.shape, output.shape)) {
			throw new RangeError("The arrays have different dimensions");
		}
	} else {
		throw new TypeError(output + " is not an NDArray");
	}
	for (var i = 0; i < input.length; i++) {
		var x = input.data[i];
		output.data[i] = x * x;
	}
	return output;
};

/**
 * Computes the dot product of two N-dimensional arrays.
 *
 * @method log
 * @param {NDArray} a - the first input array.
 * @param {NDArray} a - the second input array.
 * @param {NDArray=} output - the array for the logarithm value values. If supplied, must match the dimensions of the `input` array.
 */
JSContext.prototype.dot = function(a, b, output) {
	if (!(a instanceof NDArray)) {
		throw new TypeError(a + " is not an NDArray");
	}
	if (!(b instanceof NDArray)) {
		throw new TypeError(b + " is not an NDArray");
	}
	if (!a.dataType.equals(b.dataType)) {
		throw new TypeError("Input arrays have incompatible data types");
	}
	/* The axis of b used in reduction: axis 0 for 1D array, second-to-last axis for ND array */
	var bAxis = Math.max(b.shape.length - 2, 0);
	var reductionDim = b.shape[bAxis];
	if (a.shape[a.shape.length - 1] != reductionDim) {
		throw new RangeError("Arrays have incompatible reduction dimensions");
	}
	var outputShape = [], aStride = 1, bPreStride = 1, bPostStride = 1;
	for (var i = 0; i < a.shape.length - 1; i++) {
		outputShape.push(a.shape[i]);
		aStride *= a.shape[i];
	}
	for (var i = 0; i < b.shape.length; i++) {
		var dim = b.shape[i];
		if (i < bAxis) {
			bPreStride *= dim;
			outputShape.push(dim);
		} else if (i > bAxis) {
			bPostStride *= dim;
			outputShape.push(dim);
		}
	}
	if (outputShape.length === 0) {
		outputShape.push(1);
	}
	if (typeof output === "undefined") {
		output = this.empty(outputShape, a.dataType);
	} else if (output instanceof NDArray) {
		if (!isCompatibleShape(outputShape, output.shape)) {
			throw new RangeError("The output array has incompatible dimensions");
		}
	} else {
		throw new TypeError(output + " is not an NDArray");
	}
	for (var i = 0; i < aStride; i++) {
		for (var j = 0; j < reductionDim; j++) {
			for (var k = 0; k < bPreStride; k++) {
				for (var l = 0; l < bPostStride; l++) {
					output.data[(i*bPreStride + k) * bPostStride + l] += a.data[i*reductionDim+j] * b.data[(k*reductionDim+j)*bPostStride+l];
				}
			}
		}
	}
	return output;
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
	var data = array.data;
	var range = stop - start;
	var n = (includeStop) ? samples - 1 : samples;
	var step = range / n;
	for (var i = 0; i < samples; i++) {
		data[i] = start + step * i;
	}
	return array;
};

module.exports = JSContext;
