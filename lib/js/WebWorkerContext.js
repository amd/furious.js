"use strict";

var PBContext = require("./../PBContext.js");

function WebWorkerContext(options, callback) {
	var self = this;
	this._worker = new Worker(WebWorkerContext.getWorkerURL(options.baseUrl));
	this._worker.addEventListener("message", function(e) {
		self._messagingContext._onMessage(e);
	}, true);
	this._messagingContext = new PBContext(options, function(message) {
		self._worker.postMessage(message, [message]);
	}, callback);
}

WebWorkerContext.isSupported = function() {
	return typeof Worker !== "undefined";
};

WebWorkerContext.getWorkerURL = function(baseUrl) {
	if (baseUrl) {
		return baseUrl + "furious-worker.js";
	} else {
		return "furious-worker.js";
	}
};

WebWorkerContext.prototype.empty = function(shape, dataType) {
	return this._messagingContext.empty(shape, dataType);
};

WebWorkerContext.prototype.zeros = function(shape, dataType) {
	return this._messagingContext.zeros(shape, dataType);
};

WebWorkerContext.prototype.ones = function(shape, dataType) {
	return this._messagingContext.ones(shape, dataType);
};

WebWorkerContext.prototype.eye = function(rows, columns, diagonal, dataType) {
	return this._messagingContext.eye(rows, columns, diagonal, dataType);
};

WebWorkerContext.prototype.array = function(data, dataType) {
	return this._messagingContext.array(data, dataType);
};

WebWorkerContext.prototype.linspace = function(start, stop, samples, closed) {
	return this._messagingContext.linspace(start, stop, samples, closed);
};

WebWorkerContext.prototype.reshape = function(a, shape) {
	return this._messagingContext.reshape(a, shape);
};

WebWorkerContext.prototype.repeat = function(a, repeats, axis, out) {
	return this._messagingContext.repeat(a, repeats, axis, out);
};

WebWorkerContext.prototype._invalidate = function(array) {
	return this._messagingContext._invalidate(array);
};

WebWorkerContext.prototype.fetch = function() {
	this._messagingContext.fetch.apply(this._messagingContext, arguments);
};

WebWorkerContext.prototype.get = function() {
	this._messagingContext.get.apply(this._messagingContext, arguments);
};

WebWorkerContext.prototype.info = function(callback) {
	this._messagingContext.info(callback);
};

WebWorkerContext.prototype.barrier = function(callback) {
	this._messagingContext.barrier(callback);
};

WebWorkerContext.prototype.add = function(a, b, out) {
	return this._messagingContext.add(a, b, out);
};

WebWorkerContext.prototype.sub = function(a, b, out) {
	return this._messagingContext.sub(a, b, out);
};

WebWorkerContext.prototype.mul = function(a, b, out) {
	return this._messagingContext.mul(a, b, out);
};

WebWorkerContext.prototype.div = function(a, b, out) {
	return this._messagingContext.div(a, b, out);
};

WebWorkerContext.prototype.neg = function(a, out) {
	return this._messagingContext.neg(a, out);
};

WebWorkerContext.prototype.abs = function(a, out) {
	return this._messagingContext.abs(a, out);
};

WebWorkerContext.prototype.exp = function(a, out) {
	return this._messagingContext.exp(a, out);
};

WebWorkerContext.prototype.log = function(a, out) {
	return this._messagingContext.log(a, out);
};

WebWorkerContext.prototype.sqrt = function(a, out) {
	return this._messagingContext.sqrt(a, out);
};

WebWorkerContext.prototype.square = function(a, out) {
	return this._messagingContext.square(a, out);
};

WebWorkerContext.prototype.min = function(a, axis) {
	return this._messagingContext.min(a, axis);
};

WebWorkerContext.prototype.max = function(a, axis) {
	return this._messagingContext.max(a, axis);
};

WebWorkerContext.prototype.sum = function(a, axis) {
	return this._messagingContext.sum(a, axis);
};

WebWorkerContext.prototype.dot = function(a, b, out) {
	return this._messagingContext.dot(a, b, out);
};

WebWorkerContext.prototype.solveTriangular = function(a, b, triangularKind, transposeKind, unitDiagonal, out) {
	return this._messagingContext.solveTriangular(a, b, triangularKind, transposeKind, unitDiagonal, out);
};

WebWorkerContext.prototype.cholesky = function(a, kind, out) {
	return this._messagingContext.cholesky(a, kind, out);
};

module.exports = WebWorkerContext;
