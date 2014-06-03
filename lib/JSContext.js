var NDArray = require("./NDArray");
var DataType = require("./DataType");
var util = require("./util");

function JSContext(callback) {
	callback(this);
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

/**
 * Constructs an N-dimensional array object with the provided data.
 * @function module:numjs.array
 * @param {Number[]} data - the array data
 * @param {DataType} dataType - the type of elements in the array.
 */
JSContext.prototype.array = function(data, dataType) {
	var shape = [];
	discoverArrayShapeRecursive(data, shape, 0);
	var ndarray = new NDArray(shape, dataType);
	copyArrayDataRecursive(ndarray.data, data, shape, 0, 0);
	return ndarray;
}

/**
 * Computes absolute value of array elements.
 * @function module:numjs.abs
 * @param {NDArray} input - the input array.
 * @param {NDArray=} output - the output array for the absolute values. If supplied, must match the dimensions of the `input` array.
 */
JSContext.prototype.abs = function(input, output) {
	if (!(input instanceof NDArray)) {
		throw new TypeError(input + " is not an NDArray");
	}
	if (typeof output === 'undefined') {
		output = new NDArray(input.shape, input.dataType);
	} else if (output instanceof NDArray) {
		if (!isCompatibleShape(this.shape, other.shape)) {
			throw new RangeError("The arrays have different dimensions");
		}
	} else {
		throw new TypeError(output + " is not an NDArray");
	}
	for (var i = 0; i < input.length; i++) {
		output.data[i] = Math.abs(input.data[i]);
	}
	return output;
}

/**
 * Exponentiates array elements.
 * @function module:numjs.exp
 * @param {NDArray} input - the array with elements to be exponentiated.
 * @param {NDArray=} output - the array for the exponentiated values. If supplied, must match the dimensions of the `input` array.
 */
JSContext.prototype.exp = function(input, output) {
	if (!(input instanceof NDArray)) {
		throw new TypeError(input + " is not an NDArray");
	}
	if (typeof output === 'undefined') {
		output = new NDArray(input.shape, input.dataType);
	} else if (output instanceof NDArray) {
		if (!isCompatibleShape(this.shape, other.shape)) {
			throw new RangeError("The arrays have different dimensions");
		}
	} else {
		throw new TypeError(output + " is not an NDArray");
	}
	for (var i = 0; i < input.length; i++) {
		output.data[i] = Math.exp(input.data[i]);
	}
	return output;
}

/**
 * Computes the natural (base e) logarithm of array elements.
 * @function module:numjs.log
 * @param {NDArray} input - the input array.
 * @param {NDArray=} output - the array for the logarithm value values. If supplied, must match the dimensions of the `input` array.
 */
JSContext.prototype.log = function(input, output) {
	if (!(input instanceof NDArray)) {
		throw new TypeError(input + " is not an NDArray");
	}
	if (typeof output === 'undefined') {
		output = new NDArray(input.shape, input.dataType);
	} else if (output instanceof NDArray) {
		if (!isCompatibleShape(this.shape, other.shape)) {
			throw new RangeError("The arrays have different dimensions");
		}
	} else {
		throw new TypeError(output + " is not an NDArray");
	}
	for (var i = 0; i < input.length; i++) {
		output.data[i] = Math.log(input.data[i]);
	}
	return output;
}

/**
 * Computes the dot product of two N-dimensional arrays.
 * @function module:numjs.log
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
	if (outputShape.length == 0) {
		outputShape.push(1);
	}
	if (typeof output === 'undefined') {
		output = new NDArray(outputShape, a.dataType);
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
}

/**
 * Creates an arithmetic sequence.
 * @function module:numjs.linspace
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
	if (typeof samples === 'undefined') {
		/* Default value in NumPy */
		samples = 50;
	} else if (!util.isInt(samples)) {
		throw new TypeError(sample + " is not an integer");
	} else if (samples <= 0) {
		throw new RangeError("The number of samples must be positive");
	}
	if (typeof includeStop === 'undefined') {
		includeStop = true;
	}
	if (includeStop && (samples === 1)) {
		throw new RangeError("The number of samples must be a least 2 (for start and end points)");
	}
	var x = new NDArray(samples);
	var range = stop - start;
	var n = (includeStop) ? samples - 1 : samples;
	var step = range / n;
	for (var i = 0; i < samples; i++) {
		x.data[i] = start + step * i;
	}
	return x;
}

JSContext.prototype.DataType = DataType;
JSContext.prototype.NDArray = NDArray;

module.exports = JSContext;
