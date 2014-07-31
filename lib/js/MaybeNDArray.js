"use strict";

var util = require("./../util");

function MaybeNDArray(shape, dataType, dataBuffer) {
	this.shape = shape;
	this.dataType = dataType;
	this.length = util.computeLength(this.shape);
	if (dataBuffer === null) {
		this.data = new dataType.arrayType(this.length);
	} else {
		this.data = new dataType.arrayType(dataBuffer);
	}
}

MaybeNDArray.prototype.deallocate = function() {
	this.data = null;
};

MaybeNDArray.prototype.hasData = function() {
	return this.data !== null;
};

module.exports = MaybeNDArray;
