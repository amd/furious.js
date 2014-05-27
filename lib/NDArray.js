/**
 * @module numjs
 */

var util = require("./util")
var DataType = require("./DataType")

function shapeToLength(shape) {
	length = 1;
	for (var i = 0; i < shape.length; i++) {
		length *= shape[i];
	}
	return length;
}

function isCompatibleShape(shape1, shape2) {
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
 * An N-dimensional array.
 * @class module:numjs.NDArray
 * @param {Number} shape - the dimensions of the array
 * @param {DataType} dataType - the type of elements in the array.
 */
function NDArray(shape, dataType) {
	if (!util.isPositiveIntArray(shape) && !util.isPositiveInt(shape)) {
		throw new TypeError(shape + " is not a valid array shape");
	}
	if (typeof dataType === 'undefined') {
		dataType = new DataType('f64');
	} else if (!(dataType instanceof DataType)) {
		throw new TypeError(dataType + " is not an instance of numjs.DataType");
	}
	this.shape = util.asIntArray(shape);
	this.dataType = dataType;
	this.length = shapeToLength(this.shape);
	this.data = new dataType.arrayType(this.length);
}

NDArray.prototype.min = function(axis) {
	if (typeof axis === 'undefined') {
		var result = this.data[0];
		for (var i = 1; i < this.length; i++) {
			result = Math.min(result, this.data[i]);
		}
		return result;
	} else if (util.isInt(axis)) {
		if ((axis < 0) || (axis >= this.shape.length)) {
			throw new RangeError("Invalid axis value " + axis);
		}
		var newShape = [];
		for (var dim = 0; dim < this.shape.length; dim++) {
			if (dim !== axis) {
				newShape.push(this.shape[dim]);
			}
		}
		var output = new NDArray(newShape, this.dataType);
		var preStride = 1;
		for (var dim = 0; dim < axis; dim++) {
			preStride *= this.shape[dim];
		}
		var n = this.shape[axis];
		var postStride = this.length / preStride / n;
		var stride = preStride * postStride;
		for (var i = 0; i < preStride; i++) {
			for (var k = 0; k < postStride; k++) {
				var offset = i * n * postStride + k;
				var currentMin = this.data[offset];
				for (var j = 1; j < n; j++) {
					offset += postStride;
					currentMin = Math.min(currentMin, this.data[offset]);
				}
				output.data[i * postStride + k] = currentMin;
			}
		}
		return output;
	} else {
		throw new TypeError("Unsupported axis type");
	}
}

NDArray.prototype.max = function(axis) {
	if (typeof axis === 'undefined') {
		var result = this.data[0];
		for (var i = 1; i < this.length; i++) {
			result = Math.max(result, this.data[i]);
		}
		return result;
	} else if (util.isInt(axis)) {
		if ((axis < 0) || (axis >= this.shape.length)) {
			throw new RangeError("Invalid axis value " + axis);
		}
		var newShape = [];
		for (var dim = 0; dim < this.shape.length; dim++) {
			if (dim !== axis) {
				newShape.push(this.shape[dim]);
			}
		}
		var output = new NDArray(newShape, this.dataType);
		var preStride = 1;
		for (var dim = 0; dim < axis; dim++) {
			preStride *= this.shape[dim];
		}
		var n = this.shape[axis];
		var postStride = this.length / preStride / n;
		var stride = preStride * postStride;
		for (var i = 0; i < preStride; i++) {
			for (var k = 0; k < postStride; k++) {
				var offset = i * n * postStride + k;
				var currentMax = this.data[offset];
				for (var j = 1; j < n; j++) {
					offset += postStride;
					currentMax = Math.max(currentMax, this.data[offset]);
				}
				output.data[i * postStride + k] = currentMax;
			}
		}
		return output;
	} else {
		throw new TypeError("Unsupported axis type");
	}
}

NDArray.prototype.sum = function(axis) {
	if (typeof axis === 'undefined') {
		var result = this.data[0];
		for (var i = 1; i < this.length; i++) {
			result += this.data[i];
		}
		return result;
	} else if (util.isInt(axis)) {
		if ((axis < 0) || (axis >= this.shape.length)) {
			throw new RangeError("Invalid axis value " + axis);
		}
		var newShape = [];
		for (var dim = 0; dim < this.shape.length; dim++) {
			if (dim !== axis) {
				newShape.push(this.shape[dim]);
			}
		}
		var output = new NDArray(newShape, this.dataType);
		var preStride = 1;
		for (var dim = 0; dim < axis; dim++) {
			preStride *= this.shape[dim];
		}
		var n = this.shape[axis];
		var postStride = this.length / preStride / n;
		var stride = preStride * postStride;
		for (var i = 0; i < preStride; i++) {
			for (var k = 0; k < postStride; k++) {
				var offset = i * n * postStride + k;
				var currentSum = this.data[offset];
				for (var j = 1; j < n; j++) {
					offset += postStride;
					currentSum += this.data[offset];
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
 * Adds another array or a number to this array.
 * @method module:numjs.NDArray#add
 * @param {(NDArray|Number)} other - the array or scalar to be added.
 */
NDArray.prototype.add = function(other) {
	if (other instanceof NDArray) {
		if (!isCompatibleShape(this.shape, other.shape)) {
			throw new RangeError("The arrays have different dimensions");
		}
		var output = new NDArray(this.shape, this.dataType);
		for (var i = 0; i < this.length; i++) {
			output.data[i] = this.data[i] + other.data[i];
		}
		return output;
	} else if (util.isNumber(other)) {
		var output = new NDArray(this.shape, this.dataType);
		for (var i = 0; i < this.length; i++) {
			output.data[i] = this.data[i] + other;
		}
		return output;
	} else {
		throw new TypeError(other + " is neither NDArray nor a number");
	}
}

/**
 * Subtracts another array or a number from this array.
 * @method module:numjs.NDArray#sub
 * @param {(NDArray|Number)} other - the array or scalar to be subtracted.
 */
NDArray.prototype.sub = function(other) {
	if (other instanceof NDArray) {
		if (!isCompatibleShape(this.shape, other.shape)) {
			throw new RangeError("The arrays have different shapes");
		}
		var output = new NDArray(this.shape, this.dataType);
		for (var i = 0; i < this.length; i++) {
			output.data[i] = this.data[i] - other.data[i];
		}
		return output;
	} else if (util.isNumber(other)) {
		var output = new NDArray(this.shape, this.dataType);
		for (var i = 0; i < this.length; i++) {
			output.data[i] = this.data[i] - other;
		}
		return output;
	} else {
		throw new TypeError(other + " is neither NDArray nor a number");
	}
}

/**
 * Multiplies array elements by another array or by a number.
 * @method module:numjs.NDArray#mul
 * @param {(NDArray|Number)} other - the array or scalar to multiply elements by.
 */
NDArray.prototype.mul = function(other) {
	if (other instanceof NDArray) {
		if (!isCompatibleShape(this.shape, other.shape)) {
			throw new RangeError("The arrays have different shapes");
		}
		var output = new NDArray(this.shape, this.dataType);
		for (var i = 0; i < this.length; i++) {
			output.data[i] = this.data[i] * other.data[i];
		}
		return output;
	} else if (util.isNumber(other)) {
		var output = new NDArray(this.shape, this.dataType);
		for (var i = 0; i < this.length; i++) {
			output.data[i] = this.data[i] * other;
		}
		return output;
	} else {
		throw new TypeError(other + " is neither NDArray nor a number");
	}
}

/**
 * Divides array elements by another array or by a number.
 * @method module:numjs.NDArray#div
 * @param {(NDArray|Number)} other - the array or scalar to divide elements by.
 */
NDArray.prototype.div = function(other) {
	if (other instanceof NDArray) {
		if (!isCompatibleShape(this.shape, other.shape)) {
			throw new RangeError("The arrays have different shapes");
		}
		var output = new NDArray(this.shape, this.dataType);
		for (var i = 0; i < this.length; i++) {
			output.data[i] = this.data[i] / other.data[i];
		}
		return output;
	} else if (util.isNumber(other)) {
		var output = new NDArray(this.shape, this.dataType);
		for (var i = 0; i < this.length; i++) {
			output.data[i] = this.data[i] / other;
		}
		return output;
	} else {
		throw new TypeError(other + " is neither NDArray nor a number");
	}
}

/**
 * Creates another array with the same data, but different dimensions.
 * @method module:numjs.NDArray#reshape
 * @param {(NDArray|Number)} other - dimensions of the new array.
 */
NDArray.prototype.reshape = function(shape) {
	if (!util.isPositiveIntArray(shape) && !util.isPositiveInt(shape)) {
		throw new TypeError(shape + " is not a valid array shape");
	}
	if (shapeToLength(shape) !== this.length) {
		throw new RangeError(shape + " is not compatible with the array");
	}
	var output = new NDArray(shape, this.dataType);
	output.data.set(this.data);
	return output;
}

/**
 * Converts the data to a JavaScript Array.
 * @method module:numjs.NDArray#toArray
 */
NDArray.prototype.toArray = function(callback) {
	function createArrayRecursive(dataBuffer, dataArray, shape, level, offset) {
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

	var array = new Array(this.shape[0]);
	createArrayRecursive(this.data, array, this.shape, 0, 0);
	callback(array);
}

function offsetRecursive(shape, index, level, offset) {
	var n = shape[level];
	var i = index[level];
	if (level === shape.length - 1) {
		return offset * n + i;
	} else {
		return offsetRecursive(shape, index, level + 1, offset * n + i);
	}
}

NDArray.prototype.get = function() {
	var index = arguments;
	if ((arguments.length === 1) && util.isArray(index[0])) {
		index = index[0];
	}
	validateMultiIndex(index, this.shape);
	var offset = offsetRecursive(this.shape, index, 0, 0);
	return this.data[offset];
}

NDArray.prototype.set = function(index, value) {
	validateMultiIndex(index, this.shape);
	var offset = offsetRecursive(this.shape, index, 0, 0);
	this.data[offset] = value;
}

module.exports = NDArray;
