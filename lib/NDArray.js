/**
 * @module numjs
 * @exports numjs
 */
(function(exports){

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

	function shapeToLength(shape) {
		length = 1;
		for (var i = 0; i < shape.length; i++) {
			length *= shape[i];
		}
		return length;
	}

	function validateShapeCompatibility(shape1, shape2) {
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
			if (!isInt(index[i])) {
				throw new TypeError("The sub-index " + index[i] + " is not an integer");
			}
			if ((index[i] < 0) || (index[i] >= shape[i])) {
				throw new RangeError("The sub-index " + index[i] + " is out of bounds");
			}
		}
	}

	function DataType(type) {
		if (['f32', 'f64'].indexOf(type) >= 0) {
			this.type = type;
			this.size = {'f32': 4, 'f64': 8}[type];
			this.arrayType = {'f32': Float32Array, 'f64': Float64Array}[type];
		} else {
			throw new RangeError("Type " + type + " is not supported");
		}
	}

	/**
	 * An N-dimensional array.
	 * @class NDArray
	 * @param {Number} shape - the dimensions of the array
	 * @param {DataType} dataType - the type of elements in the array.
	 */
	function NDArray(shape, dataType) {
		if (!isPositiveIntArray(shape) && !isPositiveInt(shape)) {
			throw new TypeError(shape + " is not a valid array shape");
		}
		if (typeof dataType === 'undefined') {
			dataType = new DataType('f64');
		}
		if (!(dataType instanceof DataType)) {
			throw new TypeError(dataType + " is not an instance of numjs.DataType");
		}
		this.shape = asIntArray(shape);
		this.dateType = dataType;
		this.length = shapeToLength(this.shape);
		this.data = new dataType.arrayType(this.length);
	}


	function minReduceRecursive(data, currentMin, shape, level, offset) {
		var n = shape[level];
		if (level == shape.length - 1) {
			for (var i = 0; i < n; i++) {
				var idx = offset * n + i;
				currentMin = Math.min(currentMin, data[idx]);
			}
		} else {
			for (var i = 0; i < n; i++) {
				currentMin = minReduceRecursive(data, currentMin, shape, level + 1, offset * n + i);
			}
		}
		return currentMin;
	}

	function addRecursive(aData, bData, outData, shape, level, offset) {
		var n = shape[level];
		if (level == shape.length - 1) {
			for (var i = 0; i < n; i++) {
				var idx = offset * n + i;
				outData[idx] = aData[idx] + bData[idx];
			}
		} else {
			for (var i = 0; i < n; i++) {
				addRecursive(aData, bData, outData, shape, level + 1, offset * n + i);
			}
		}
	}

	function addScalarRecursive(aData, b, outData, shape, level, offset) {
		var n = shape[level];
		if (level == shape.length - 1) {
			for (var i = 0; i < n; i++) {
				var idx = offset * n + i;
				outData[idx] = aData[idx] + b;
			}
		} else {
			for (var i = 0; i < n; i++) {
				addScalarRecursive(aData, b, outData, shape, level + 1, offset * n + i);
			}
		}
	}

	function subRecursive(aData, bData, outData, shape, level, offset) {
		var n = shape[level];
		if (level == shape.length - 1) {
			for (var i = 0; i < n; i++) {
				var idx = offset * n + i;
				outData[idx] = aData[idx] - bData[idx];
			}
		} else {
			for (var i = 0; i < n; i++) {
				subRecursive(aData, bData, outData, shape, level + 1, offset * n + i);
			}
		}
	}

	function subScalarRecursive(aData, b, outData, shape, level, offset) {
		var n = shape[level];
		if (level == shape.length - 1) {
			for (var i = 0; i < n; i++) {
				var idx = offset * n + i;
				outData[idx] = aData[idx] - b;
			}
		} else {
			for (var i = 0; i < n; i++) {
				subScalarRecursive(aData, b, outData, shape, level + 1, offset * n + i);
			}
		}
	}

	function mulRecursive(aData, bData, outData, shape, level, offset) {
		var n = shape[level];
		if (level == shape.length - 1) {
			for (var i = 0; i < n; i++) {
				var idx = offset * n + i;
				outData[idx] = aData[idx] * bData[idx];
			}
		} else {
			for (var i = 0; i < n; i++) {
				mulRecursive(aData, bData, outData, shape, level + 1, offset * n + i);
			}
		}
	}

	function mulScalarRecursive(aData, b, outData, shape, level, offset) {
		var n = shape[level];
		if (level == shape.length - 1) {
			for (var i = 0; i < n; i++) {
				var idx = offset * n + i;
				outData[idx] = aData[idx] * b;
			}
		} else {
			for (var i = 0; i < n; i++) {
				mulScalarRecursive(aData, b, outData, shape, level + 1, offset * n + i);
			}
		}
	}

	function divRecursive(aData, bData, outData, shape, level, offset) {
		var n = shape[level];
		if (level == shape.length - 1) {
			for (var i = 0; i < n; i++) {
				var idx = offset * n + i;
				outData[idx] = aData[idx] / bData[idx];
			}
		} else {
			for (var i = 0; i < n; i++) {
				divRecursive(aData, bData, outData, shape, level + 1, offset * n + i);
			}
		}
	}

	function divScalarRecursive(aData, b, outData, shape, level, offset) {
		var n = shape[level];
		if (level == shape.length - 1) {
			for (var i = 0; i < n; i++) {
				var idx = offset * n + i;
				outData[idx] = aData[idx] / b;
			}
		} else {
			for (var i = 0; i < n; i++) {
				divScalarRecursive(aData, b, outData, shape, level + 1, offset * n + i);
			}
		}
	}

	NDArray.prototype.min = function(axis) {
		if (typeof axis === 'undefined') {
			return minReduceRecursive(data, Number.POSITIVE_INFINITY, shape, level, offset);
		}
	}

	/**
	 * Adds another array or a number to this array.
	 * @method NDArray#add
	 * @param {(NDArray|Number)} other - the array or scalar to be added.
	 */
	NDArray.prototype.add = function(other) {
		if (other instanceof NDArray) {
			if (!validateShapeCompatibility(this.shape, other.shape)) {
				throw new RangeError("The arrays have different shapes");
			}
			var output = new NDArray(this.shape, this.dataType);
			addRecursive(this.data, other.data, output.data, this.shape, 0, 0);
			return output;
		} else if (isNumber(other)) {
			var output = new NDArray(this.shape, this.dataType);
			addScalarRecursive(this.data, other, output.data, this.shape, 0, 0);
			return output;
		} else {
			throw new TypeError(other + " is neither NDArray nor a number");
		}
	}

	/**
	 * Subtracts another array or a number from this array.
	 * @method NDArray#sub
	 * @param {(NDArray|Number)} other - the array or scalar to be subtracted.
	 */
	NDArray.prototype.sub = function(other) {
		if (other instanceof NDArray) {
			if (!validateShapeCompatibility(this.shape, other.shape)) {
				throw new RangeError("The arrays have different shapes");
			}
			var output = new NDArray(this.shape, this.dataType);
			subRecursive(this.data, other.data, output.data, this.shape, 0, 0);
			return output;
		} else if (isNumber(other)) {
			var output = new NDArray(this.shape, this.dataType);
			subScalarRecursive(this.data, other, output.data, this.shape, 0, 0);
			return output;
		} else {
			throw new TypeError(other + " is neither NDArray nor a number");
		}
	}

	/**
	 * Multiplies array elements by another array or by a number.
	 * @method NDArray#mul
	 * @param {(NDArray|Number)} other - the array or scalar to multiply elements by.
	 */
	NDArray.prototype.mul = function(other) {
		if (other instanceof NDArray) {
			if (!validateShapeCompatibility(this.shape, other.shape)) {
				throw new RangeError("The arrays have different shapes");
			}
			var output = new NDArray(this.shape, this.dataType);
			mulRecursive(this.data, other.data, output.data, this.shape, 0, 0);
			return output;
		} else if (isNumber(other)) {
			var output = new NDArray(this.shape, this.dataType);
			mulScalarRecursive(this.data, other, output.data, this.shape, 0, 0);
			return output;
		} else {
			throw new TypeError(other + " is neither NDArray nor a number");
		}
	}

	/**
	 * Divides array elements by another array or by a number.
	 * @method NDArray#div
	 * @param {(NDArray|Number)} other - the array or scalar to divide elements by.
	 */
	NDArray.prototype.div = function(other) {
		if (other instanceof NDArray) {
			if (!validateShapeCompatibility(this.shape, other.shape)) {
				throw new RangeError("The arrays have different shapes");
			}
			var output = new NDArray(this.shape, this.dataType);
			divRecursive(this.data, other.data, output.data, this.shape, 0, 0);
			return output;
		} else if (isNumber(other)) {
			var output = new NDArray(this.shape, this.dataType);
			divScalarRecursive(this.data, other, output.data, this.shape, 0, 0);
			return output;
		} else {
			throw new TypeError(other + " is neither NDArray nor a number");
		}
	}

	NDArray.prototype.reshape = function(shape) {
		if (!isPositiveIntArray(shape) && !isPositiveInt(shape)) {
			throw new TypeError(shape + " is not a valid array shape");
		}
		if (shapeToLength(shape) !== this.length) {
			throw new RangeError(shape + " is not compatible with the array");
		}
		var output = new NDArray(shape, this.dataType);
		output.data.set(this.data);
		return output;
	}

	function offsetRecursive(shape, index, level, offset) {
		var n = shape[level];
		var i = index[level];
		if (level == shape.length - 1) {
			return offset * n + i;
		} else {
			return offsetRecursive(shape, index, level + 1, offset * n + i);
		}
	}

	NDArray.prototype.get = function() {
		var index = arguments;
		if ((arguments.length == 1) && isArray(index[0])) {
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

	/**
	 * Exponentiates array elements.
	 * @function numjs.exp
	 * @param {NDArray} input - the array with elements to be exponentiated.
	 * @param {NDArray=} output - the array for the exponentiated values. If supplied, must match the dimensions of the `input` array.
	 */
	function exp(input, output) {
		if (!(input instanceof NDArray)) {
			throw new TypeError(input + " is not an NDArray");
		}
		if (typeof output === 'undefined') {
			output = new NDArray(input.shape, input.dataType);
		} else if (!(output instanceof NDArray)) {
			throw new TypeError(output + " is not an NDArray");
		}
		function expRecursive(inData, outData, shape, level, offset) {
			var n = shape[level];
			if (level == shape.length - 1) {
				for (var i = 0; i < n; i++) {
					var idx = offset * n + i;
					outData[idx] = Math.exp(inData[idx]);
				}
			} else {
				for (var i = 0; i < n; i++) {
					expRecursive(inData, outData, shape, level + 1, offset * n + i);
				}
			}
		}
		expRecursive(input.data, output.data, input.shape, 0, 0);
		return output;
	}

	function linspace(start, stop, samples, includeStop) {
		if (!isReal(start)) {
			throw new TypeError(start + " is not a real number");
		}
		if (!isReal(stop)) {
			throw new TypeError(stop + " is not a real number");
		}
		if (typeof samples == 'undefined') {
			/* Default value in NumPy */
			samples = 50;
		} else if (!isInt(samples)) {
			throw new TypeError(sample + " is not an integer");
		} else if (samples <= 0) {
			throw new RangeError("The number of samples must be positive");
		}
		if (typeof includeStop == 'undefined') {
			includeStop = true;
		}
		if (includeStop && (samples == 1)) {
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
	exports.linspace = linspace;
	exports.exp = exp;

})(typeof exports === 'undefined' ? this['numjs'] = {} : exports);
