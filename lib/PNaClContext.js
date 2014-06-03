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

var pnacl = null;

function PNaClContext(callback) {
	if (pnacl == null) {
		var context = this;
		pnacl = document.createElement('object');
		pnacl.width = 0;
		pnacl.height = 0;
		pnacl.data = "numjs.nmf";
		pnacl.type = "application/x-pnacl";
		pnacl.addEventListener('load', function () {
			callback(context);
		}, true);
		document.body.appendChild(pnacl);
	} else {
		callback(this);
	}
}

module.exports = PNaClContext;
