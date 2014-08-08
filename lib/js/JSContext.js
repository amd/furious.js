"use strict";

var NDArray = require("./../NDArray");
var DataType = require("./../DataType");
var util = require("./../util");
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
 * Constructs a 2-dimensional array with identity matrix.
 *
 * @method eye
 * @param {Number} rows - the number of rows in the matrix.
 * @param {Number} [columns=rows] - the number of columns in the matrix.
 * @param {Number} [diagonal=0] - position of the unit diagonal. 0 puts it on the main diagonal, positive values will place it above the main diagonal, negative - below the main diagonal.
 * @param {DataType} [dataType] - the data type of the matrix elements.
 */
JSContext.prototype.eye = function(rows, columns, diagonal, dataType) {
	rows = util.checkDimension(rows, "rows");
	if (typeof columns === "undefined") {
		columns = rows;
	} else {
		columns = util.checkDimension(columns, "columns");
	}
	if (typeof diagonal === "undefined") {
		diagonal = 0;
	} else {
		diagonal = util.checkInt(diagonal);
	}
	if ((diagonal >= columns) || (diagonal <= -rows)) {
		throw new RangeError("diagonal is out of range");
	}
	if (typeof dataType === "undefined") {
		dataType = new DataType("f64");
	} else {
		dataType = util.checkDataType(dataType);
	}
	var array = this.zeros([rows, columns], dataType);
	jsmath.fillDiagonal(array._data, rows, columns, diagonal, 1.0);
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
 * Fetches NDArray data and asynchronously returns it as JavaScript typed arrays.
 *
 * @method fetch
 * @async
 *
 * @param {NDArray} arrays* - NDArrays to fetch.
 * @param {Function} callback - A callback to be called with the data when it is available.
 * @param {ArrayBufferView} callback.arrays* - typed arrays with the data. The element type of the typed array matches the data type of the NDArray. For zero-dimensional arrays the output is returned as a typed array with a single element. Multi-dimensional arrays are returned in row-major storage format.
 */
JSContext.prototype.fetch = function() {
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
		callbackArguments[i] = new array.dataType.arrayType(array._data);
	}
	for (var i = 0; i < arguments.length - 1; ++i) {
		arguments[i]._tryInvalidate();
	}
	callback.apply(null, callbackArguments);
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
 * Waits until previous commands finished execution and calls the callback.
 *
 * @method barrier
 * @async
 *
 * @param {Function} callback - A callback to be called after the previous commands retire.
 */
JSContext.prototype.barrier = function(callback) {
	callback();
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
			out = context.empty(shapeOut, a.dataType);
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
	} else {
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
 * Solves a triangular linear system.
 *
 * @method solveTriangular
 * @param {NDArray} a - the triangular matrix that defines the system.
 * @param {NDArray} b - the matrix of right-hand sides of the system.
 * @param {String} [triangularKind="U"] - the kind of triangular matrix in **a**. "L" denotes lower triangular, "U" denotes upper triangular. Other values are invalid.
 * @param {String} [transposeKind="N"] - the type of transposition to be applied to **a**. Use "T" to transpose the matrix on-the-fly in the computation, "N" to use it as-is.
 * @param {Boolean} [unitDiagonal=false] - indicates that the diagonal elements should be assumed to equal 1.
 * @param {NDArray} [out] - an array to be used for the solutions vector or matrix. If supplied, must match the dimensions and data type of the **b** array.
 */
JSContext.prototype.solveTriangular = function(a, b, triangularKind, transposeKind, unitDiagonal, out) {
	util.checkSquare2DArray(a, "a");
	util.checkNDArray(b, "b");
	util.checkDataTypesCompatibility(a.dataType, b.dataType);
	if ((b.shape.length !== 1) && (b.shape.length !== 2)) {
		throw new Error("The right-hand must be a 1D or 2D array");
	}
	if (a.shape[0] != b.shape[0]) {
		throw new Error("The arrays have incompatible shapes");
	}
	transposeKind = util.checkTransposeKind(transposeKind, "N");
	triangularKind = util.checkTriangularKind(triangularKind, "U");
	if (typeof unitDiagonal === "undefined") {
		unitDiagonal = false;
	} else {
		unitDiagonal = !!unitDiagonal;
	}
	a._decRef();
	b._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(b.shape, b.dataType, this);
			if (!b._hasRefs()) {
				out._data = b._data;
			} else {
				out._data = new out.dataType.arrayType(b._data);
			}
		} else {
			util.checkNDArray(out, "out");
			util.checkShapesCompatibility(b.shape, out.shape);
			util.checkDataTypesCompatibility(b.dataType, out.dataType);
			out._data.set(b._data);
			out._incRef();
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		b._incRef();
		throw e;
	}
	jsmath.solveTriangular(a._data, out._data,
		b.shape[0], b.shape[1] || 1,
		transposeKind === "T",
		triangularKind === "L",
		unitDiagonal);
	a._tryInvalidate();
	b._tryInvalidate();
	return out;
};

/**
 * Computes Cholesky decomposition of an s.p.d. matrix
 *
 * @method cholesky
 * @param {NDArray} a - a square 2-dimensional matrix to be factored.
 * @param {String} [kind="U"] - the kind of Cholesky factorization. Pass "L" for lower Cholesky, "U" for upper Cholesky. Other values are invalid.
 * @param {NDArray} [out] - a square 2-dimensional array to be used to the Cholesky factor. If supplied, must match the dimensions and data type of the **a** array.
 */
JSContext.prototype.cholesky = function(a, kind, out) {
	util.checkSquare2DArray(a, "a");
	kind = util.checkTriangularKind(kind, "U");
	a._decRef();
	try {
		if (typeof out === "undefined") {
			out = new NDArray(a.shape, a.dataType, this);
			if (!a._hasRefs()) {
				out._data = a._data;
			} else {
				out._data = new out.dataType.arrayType(a._data);
			}
		} else {
			util.checkSquare2DArray(out, "out");
			util.checkShapesCompatibility(out.shape, a.shape);
			util.checkDataTypesCompatibility(out.dataType, a.dataType);
			out._data.set(a._data);
			out._incRef();
		}
	} catch (e) {
		/* Restore the previous state */
		a._incRef();
		throw e;
	}
	jsmath.cholesky(out._data, a.shape[0], kind === "L");
	a._tryInvalidate();
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
