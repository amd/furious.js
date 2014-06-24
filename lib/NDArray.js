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
		this._content.invalidate(this);
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
		this._content.invalidate(this);
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
	return this._refCount > 0;
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
 * Converts the data to a JavaScript Array.
 *
 * @method get
 * @async
 */
NDArray.prototype.get = function(callback) {
	this._context.get(this, callback);
};

module.exports = NDArray;
