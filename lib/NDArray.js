/**
 * @module numjs
 */
(function(exports){

	var util = (function() {
		function isNumber(n) {
			return n === +n;
		}

		function isReal(n) {
			return (n === +n) && (isFinite(n));
		}

		function isInt(n) {
			return (n === +n) && (n === (n|0));
		}

		function isPositiveInt(n) {
			return (n === +n) && (n === (n|0)) && (n > 0);
		}

		function isNonNegativeInt(n) {
			return (n === +n) && (n === (n|0)) && (n >= 0);
		}

		function isArray(list) {
			return list instanceof Array;
		}

		function isIntArray(list) {
			if (isArray(list)) {
				for (var i = 0; i < list.length; i++) {
					if (!isInt(list[i])) {
						return false;
					}
				}
				return true;
			} else {
				return false;
			}
		}

		function isPositiveIntArray(list) {
			if (isArray(list)) {
				for (var i = 0; i < list.length; i++) {
					if (!isPositiveInt(list[i])) {
						return false;
					}
				}
				return true;
			} else {
				return false;
			}
		}

		function asIntArray(list) {
			if (isInt(list)) {
				return [list];
			} else if (isIntArray(list)) {
				return list;
			} else {
				throw new TypeError(list + " can not be converted to integer array");
			}
		}

		return {
			isNumber: isNumber,
			isReal: isReal,
			isInt: isInt,
			isPositiveInt: isPositiveInt,
			isNonNegativeInt: isNonNegativeInt,
			isArray: isArray,
			isIntArray: isIntArray,
			isPositiveIntArray: isPositiveIntArray,
			asIntArray: asIntArray
		}
	}());

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
	 * A numerical data type.
	 * @class module:numjs.DataType
	 * @param {String} type - the abbreviated name of the data type. Currently supported values are "f32" and "f64".
	 */
	function DataType(type) {
		if (['f32', 'f64'].indexOf(type) >= 0) {
			this.type = type;
			this.size = {'f32': 4, 'f64': 8}[type];
			this.arrayType = {'f32': Float32Array, 'f64': Float64Array}[type];
		} else {
			throw new RangeError("Type " + type + " is not supported");
		}
	}

	DataType.prototype.equals = function(other) {
		return (other instanceof DataType) && (this.arrayType === other.arrayType);
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
	NDArray.prototype.toArray = function() {
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
		return array;
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
	function array(data, dataType) {
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
	function abs(input, output) {
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
	function exp(input, output) {
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
	function log(input, output) {
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
	function dot(a, b, output) {
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
	function linspace(start, stop, samples, includeStop) {
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

	exports.DataType = DataType;
	exports.NDArray = NDArray;
	exports.array = array;
	exports.linspace = linspace;
	exports.dot = dot;
	exports.abs = abs;
	exports.exp = exp;
	exports.log = log;

})(typeof exports === 'undefined' ? this['numjs'] = {} : exports);
