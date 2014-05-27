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

module.exports = DataType;
