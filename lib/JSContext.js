var NDArray = require("./NDArray");
var DataType = require("./DataType");
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

function JSContext(callback) {
	callback(this);
}

/**
 * Constructs an uninialized N-dimensional array.
 * @function module:numjs.empty
 * @param {Number} shape - the dimensions of the array
 * @param {DataType} dataType - the type of elements in the array.
 */
JSContext.prototype.empty = function(shape, dataType) {
	if (!util.isPositiveIntArray(shape) && !util.isPositiveInt(shape)) {
		throw new TypeError(shape + " is not a valid array shape");
	}
	if (typeof dataType === 'undefined') {
		dataType = new DataType('f64');
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of DataType");
	}
	var array = new NDArray(shape, dataType, this);
	array.data = new dataType.arrayType(array.length);
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

/**
 * Constructs an N-dimensional array object with the provided data.
 * @function module:numjs.array
 * @param {Number[]} data - the array data
 * @param {DataType} dataType - the type of elements in the array.
 */
JSContext.prototype.array = function(data, dataType) {
	var shape = [];
	discoverArrayShapeRecursive(data, shape, 0);
	var array = this.empty(shape, dataType, this);
	copyArrayDataRecursive(array.data, data, shape, 0, 0);
	return array;
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

JSContext.prototype.toArray = function(ndarray, callback) {
	if (!(ndarray instanceof NDArray)) {
		throw new TypeError(ndarray + " is not an NDArray");
	}
	var jsarray = new Array(ndarray.shape[0]);
	createArrayRecursive(ndarray.data, jsarray, ndarray.shape, 0, 0);
	callback(jsarray);
}

/**
 * Creates another array with the same data, but different dimensions.
 * @method module:numjs.NDArray#reshape
 * @param {(NDArray|Number)} newShape - dimensions of the new array.
 */
JSContext.prototype.reshape = function(ndarray, newShape) {
	if (!util.isPositiveIntArray(newShape) && !util.isPositiveInt(newShape)) {
		throw new TypeError(newShape + " is not a valid array shape");
	}
	if (shapeToLength(newShape) !== ndarray.length) {
		throw new RangeError(shape + " is not compatible with the array");
	}
	var output = this.empty(newShape, ndarray.dataType);
	output.data.set(ndarray.data);
	return output;
}

/**
 * Adds another array or a number to this array.
 * @method module:numjs.NDArray#add
 * @param {(NDArray|Number)} other - the array or scalar to be added.
 */
JSContext.prototype.add = function(a, b, out) {
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
		out = this.empty(shape, dataType);
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray")
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
}

/**
 * Subtracts another array or a number from this array.
 * @method module:numjs.NDArray#sub
 * @param {(NDArray|Number)} other - the array or scalar to be subtracted.
 */
JSContext.prototype.sub = function(a, b, out) {
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
		out = this.empty(shape, dataType);
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray")
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
}


/**
 * Multiplies array elements by another array or by a number.
 * @method module:numjs.NDArray#mul
 * @param {(NDArray|Number)} other - the array or scalar to multiply elements by.
 */
JSContext.prototype.mul = function(a, b, out) {
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
		out = this.empty(shape, dataType);
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray")
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
}

/**
 * Divides array elements by another array or by a number.
 * @method module:numjs.NDArray#div
 * @param {(NDArray|Number)} other - the array or scalar to divide elements by.
 */
JSContext.prototype.div = function(a, b, out) {
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
		out = this.empty(shape, dataType);
	} else if (out instanceof NDArray) {
		if (!isCompatibleShape(shape, out.shape)) {
			throw new Error("The out array has incompatible shape");
		}
	} else {
		throw new TypeError("out is not an NDArray")
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
}

JSContext.prototype.min = function(ndarray, axis) {
	if (typeof axis === 'undefined') {
		var result = ndarray.data[0];
		for (var i = 1; i < ndarray.length; i++) {
			result = Math.min(result, ndarray.data[i]);
		}
		return result;
	} else if (util.isInt(axis)) {
		if ((axis < 0) || (axis >= ndarray.shape.length)) {
			throw new RangeError("Invalid axis value " + axis);
		}
		var newShape = [];
		for (var dim = 0; dim < ndarray.shape.length; dim++) {
			if (dim !== axis) {
				newShape.push(ndarray.shape[dim]);
			}
		}
		var output = this.empty(newShape, ndarray.dataType);
		var preStride = 1;
		for (var dim = 0; dim < axis; dim++) {
			preStride *= ndarray.shape[dim];
		}
		var n = ndarray.shape[axis];
		var postStride = ndarray.length / preStride / n;
		var stride = preStride * postStride;
		for (var i = 0; i < preStride; i++) {
			for (var k = 0; k < postStride; k++) {
				var offset = i * n * postStride + k;
				var currentMin = ndarray.data[offset];
				for (var j = 1; j < n; j++) {
					offset += postStride;
					currentMin = Math.min(currentMin, ndarray.data[offset]);
				}
				output.data[i * postStride + k] = currentMin;
			}
		}
		return output;
	} else {
		throw new TypeError("Unsupported axis type");
	}
}

JSContext.prototype.max = function(ndarray, axis) {
	if (typeof axis === 'undefined') {
		var result = ndarray.data[0];
		for (var i = 1; i < ndarray.length; i++) {
			result = Math.max(result, ndarray.data[i]);
		}
		return result;
	} else if (util.isInt(axis)) {
		if ((axis < 0) || (axis >= ndarray.shape.length)) {
			throw new RangeError("Invalid axis value " + axis);
		}
		var newShape = [];
		for (var dim = 0; dim < ndarray.shape.length; dim++) {
			if (dim !== axis) {
				newShape.push(ndarray.shape[dim]);
			}
		}
		var output = this.empty(newShape, ndarray.dataType);
		var preStride = 1;
		for (var dim = 0; dim < axis; dim++) {
			preStride *= ndarray.shape[dim];
		}
		var n = ndarray.shape[axis];
		var postStride = ndarray.length / preStride / n;
		var stride = preStride * postStride;
		for (var i = 0; i < preStride; i++) {
			for (var k = 0; k < postStride; k++) {
				var offset = i * n * postStride + k;
				var currentMax = ndarray.data[offset];
				for (var j = 1; j < n; j++) {
					offset += postStride;
					currentMax = Math.max(currentMax, ndarray.data[offset]);
				}
				output.data[i * postStride + k] = currentMax;
			}
		}
		return output;
	} else {
		throw new TypeError("Unsupported axis type");
	}
}

JSContext.prototype.sum = function(ndarray, axis) {
	if (typeof axis === 'undefined') {
		var result = ndarray.data[0];
		for (var i = 1; i < ndarray.length; i++) {
			result += ndarray.data[i];
		}
		return result;
	} else if (util.isInt(axis)) {
		if ((axis < 0) || (axis >= ndarray.shape.length)) {
			throw new RangeError("Invalid axis value " + axis);
		}
		var newShape = [];
		for (var dim = 0; dim < ndarray.shape.length; dim++) {
			if (dim !== axis) {
				newShape.push(ndarray.shape[dim]);
			}
		}
		var output = this.empty(newShape, ndarray.dataType);
		var preStride = 1;
		for (var dim = 0; dim < axis; dim++) {
			preStride *= ndarray.shape[dim];
		}
		var n = ndarray.shape[axis];
		var postStride = ndarray.length / preStride / n;
		var stride = preStride * postStride;
		for (var i = 0; i < preStride; i++) {
			for (var k = 0; k < postStride; k++) {
				var offset = i * n * postStride + k;
				var currentSum = ndarray.data[offset];
				for (var j = 1; j < n; j++) {
					offset += postStride;
					currentSum += ndarray.data[offset];
				}
				output.data[i * postStride + k] = currentSum;
			}
		}
		return output;
	} else {
		throw new TypeError("Unsupported axis type");
	}
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
		output = this.empty(input.shape, input.dataType);
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
		output = this.empty(input.shape, input.dataType);
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
		output = this.empty(input.shape, input.dataType);
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
	var dataType = new DataType('f64')
	var array = new NDArray(samples, dataType, this);
	var data = new dataType.arrayType(array.length);
	var range = stop - start;
	var n = (includeStop) ? samples - 1 : samples;
	var step = range / n;
	for (var i = 0; i < samples; i++) {
		data[i] = start + step * i;
	}
	array.data = data;
	return array;
}

JSContext.prototype.DataType = DataType;
JSContext.prototype.NDArray = NDArray;

module.exports = JSContext;
