"use strict";

var PBContext = require("./PBContext");

function PNaClContext(options, callback) {
	var self = this;
	this._pnaclObject = document.createElement("object");
	this._pnaclObject.width = 0;
	this._pnaclObject.height = 0;
	this._pnaclObject.data = PNaClContext.getManifestURL(options.baseUrl);
	this._pnaclObject.type = "application/x-pnacl";
	this._pnaclObject.addEventListener("message", function(e) {
		self._messagingContext._onMessage(e);
	}, true);
	this._messagingContext = new PBContext(options, function(message) {
		self._pnaclObject.postMessage(message);
	}, callback);
	document.body.appendChild(this._pnaclObject);
}

PNaClContext.isSupported = function() {
	try {
		return (typeof navigator.mimeTypes["application/x-pnacl"]) !== "undefined";
	} catch (e) {
	}
	return false;
};

PNaClContext.getManifestURL = function(baseUrl) {
	if (baseUrl) {
		return baseUrl + "furious.nmf";
	} else {
		return "furious.nmf";
	}
};

PNaClContext.prototype.empty = function(shape, dataType) {
	return this._messagingContext.empty(shape, dataType);
};

PNaClContext.prototype.zeros = function(shape, dataType) {
	return this._messagingContext.zeros(shape, dataType);
};

PNaClContext.prototype.ones = function(shape, dataType) {
	return this._messagingContext.ones(shape, dataType);
};

PNaClContext.prototype.eye = function(rows, columns, diagonal, dataType) {
	return this._messagingContext.eye(rows, columns, diagonal, dataType);
};

PNaClContext.prototype.array = function(data, dataType) {
	return this._messagingContext.array(data, dataType);
};

PNaClContext.prototype.linspace = function(start, stop, samples, closed) {
	return this._messagingContext.linspace(start, stop, samples, closed);
};

PNaClContext.prototype.reshape = function(a, shape) {
	return this._messagingContext.reshape(a, shape);
};

PNaClContext.prototype.repeat = function(a, repeats, axis, out) {
	return this._messagingContext.repeat(a, repeats, axis, out);
};

PNaClContext.prototype._invalidate = function(array) {
	return this._messagingContext._invalidate(array);
};

PNaClContext.prototype.fetch = function() {
	this._messagingContext.fetch.apply(this._messagingContext, arguments);
};

PNaClContext.prototype.get = function() {
	this._messagingContext.get.apply(this._messagingContext, arguments);
};

PNaClContext.prototype.info = function(callback) {
	this._messagingContext.info(callback);
};

PNaClContext.prototype.barrier = function(callback) {
	this._messagingContext.barrier(callback);
};

PNaClContext.prototype.add = function(a, b, out) {
	return this._messagingContext.add(a, b, out);
};

PNaClContext.prototype.sub = function(a, b, out) {
	return this._messagingContext.sub(a, b, out);
};

PNaClContext.prototype.mul = function(a, b, out) {
	return this._messagingContext.mul(a, b, out);
};

PNaClContext.prototype.div = function(a, b, out) {
	return this._messagingContext.div(a, b, out);
};

PNaClContext.prototype.matrixPower = function(a, b, out) {
	return this._messagingContext.matrixPower(a, b, out);
};

PNaClContext.prototype.around = function(a, b, out) {
	return this._messagingContext.around(a, b, out);
};

PNaClContext.prototype.round = function(a, b, out) {
	return this._messagingContext.round(a, b, out);
};

PNaClContext.prototype.logaddexp = function(a, b, out) {
	return this._messagingContext.logaddexp(a, b, out);
};

PNaClContext.prototype.logaddexp2 = function(a, b, out) {
	return this._messagingContext.logaddexp2(a, b, out);
};

PNaClContext.prototype.neg = function(a, out) {
	return this._messagingContext.neg(a, out);
};

PNaClContext.prototype.abs = function(a, out) {
	return this._messagingContext.abs(a, out);
};

PNaClContext.prototype.exp = function(a, out) {
	return this._messagingContext.exp(a, out);
};

PNaClContext.prototype.expm1 = function(a, out) {
	return this._messagingContext.expm1(a, out);
};

PNaClContext.prototype.exp2 = function(a, out) {
	return this._messagingContext.exp2(a, out);
};

PNaClContext.prototype.log = function(a, out) {
	return this._messagingContext.log(a, out);
};

PNaClContext.prototype.log10 = function(a, out) {
	return this._messagingContext.log10(a, out);
};

PNaClContext.prototype.log2 = function(a, out) {
	return this._messagingContext.log2(a, out);
};

PNaClContext.prototype.log1p = function(a, out) {
	return this._messagingContext.log1p(a, out);
};

PNaClContext.prototype.sqrt = function(a, out) {
	return this._messagingContext.sqrt(a, out);
};

PNaClContext.prototype.square = function(a, out) {
	return this._messagingContext.square(a, out);
};

PNaClContext.prototype.sin = function(a, out) {
	return this._messagingContext.sin(a, out);
};

PNaClContext.prototype.cos = function(a, out) {
	return this._messagingContext.cos(a, out);
};

PNaClContext.prototype.tan = function(a, out) {
	return this._messagingContext.tan(a, out);
};

PNaClContext.prototype.arcsin = function(a, out) {
	return this._messagingContext.arcsin(a, out);
};

PNaClContext.prototype.arccos = function(a, out) {
	return this._messagingContext.arccos(a, out);
};

PNaClContext.prototype.arctan = function(a, out) {
	return this._messagingContext.arctan(a, out);
};

PNaClContext.prototype.degrees = function(a, out) {
	return this._messagingContext.degrees(a, out);
};

PNaClContext.prototype.radians = function(a, out) {
	return this._messagingContext.radians(a, out);
};

PNaClContext.prototype.rint = function(a, out) {
	return this._messagingContext.rint(a, out);
};

PNaClContext.prototype.fix = function(a, out) {
	return this._messagingContext.fix(a, out);
};

PNaClContext.prototype.floor = function(a, out) {
	return this._messagingContext.floor(a, out);
};

PNaClContext.prototype.ceil = function(a, out) {
	return this._messagingContext.ceil(a, out);
};

PNaClContext.prototype.trunc = function(a, out) {
	return this._messagingContext.trunc(a, out);
};

PNaClContext.prototype.min = function(a, axis) {
	return this._messagingContext.min(a, axis);
};

PNaClContext.prototype.max = function(a, axis) {
	return this._messagingContext.max(a, axis);
};

PNaClContext.prototype.sum = function(a, axis) {
	return this._messagingContext.sum(a, axis);
};

PNaClContext.prototype.dot = function(a, b, out) {
	return this._messagingContext.dot(a, b, out);
};

PNaClContext.prototype.solveTriangular = function(a, b, triangularKind, transposeKind, unitDiagonal, out) {
	return this._messagingContext.solveTriangular(a, b, triangularKind, transposeKind, unitDiagonal, out);
};

PNaClContext.prototype.cholesky = function(a, kind, out) {
	return this._messagingContext.cholesky(a, kind, out);
};

module.exports = PNaClContext;

