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

function NDArray(shape, dataType, context) {
	if (typeof context === 'undefined') {
		throw new Error("CONTEXT NOT DEFINED");
	}
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
	this.context = context;
	this.length = shapeToLength(this.shape);
}

NDArray.prototype.min = function(axis) {
	return this.context.min(this, axis);
}

NDArray.prototype.max = function(axis) {
	return this.context.max(this, axis);
}

NDArray.prototype.sum = function(axis) {
	return this.context.sum(this, axis);
}

/**
 * Adds another array or a number to this array.
 * @method module:numjs.NDArray#add
 * @param {(NDArray|Number)} other - the array or scalar to be added.
 */
NDArray.prototype.add = function(other) {
	return this.context.add(this, other);
}

/**
 * Subtracts another array or a number from this array.
 * @method module:numjs.NDArray#sub
 * @param {(NDArray|Number)} other - the array or scalar to be subtracted.
 */
NDArray.prototype.sub = function(other) {
	return this.context.sub(this, other);
}

/**
 * Multiplies array elements by another array or by a number.
 * @method module:numjs.NDArray#mul
 * @param {(NDArray|Number)} other - the array or scalar to multiply elements by.
 */
NDArray.prototype.mul = function(other) {
	return this.context.mul(this, other);
}

/**
 * Divides array elements by another array or by a number.
 * @method module:numjs.NDArray#div
 * @param {(NDArray|Number)} other - the array or scalar to divide elements by.
 */
NDArray.prototype.div = function(other) {
	return this.context.div(this, other);
}

/**
 * Creates another array with the same data, but different dimensions.
 * @method module:numjs.NDArray#reshape
 * @param {(NDArray|Number)} other - dimensions of the new array.
 */
NDArray.prototype.reshape = function(newShape) {
	return this.context.reshape(this, newShape);
}

/**
 * Converts the data to a JavaScript Array.
 * @method module:numjs.NDArray#toArray
 */
NDArray.prototype.toArray = function(callback) {
	this.context.toArray(this, callback);
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
