var util = require("./util");
var DataType = require("./DataType");
var JSContext = require("./JSContext");
var PNaClContext = require("./PNaClContext");

var connect = function(backend, callback) {
	if (typeof callback === "undefined") {
		callback = backend;
		backend = undefined;
	}
	if (typeof backend == "undefined") {
		backend = getDefaultBackend();
	} else if (typeof backend == "javascript") {
		return new JSContext(callback);
	} else if (typeof backend == "pnacl") {
		return new PNaClContext(callback);
	} else if (typeof backend == "webcl") {
		return null; /* new WebCLContext(); */
	} else {
		throw new Error("Unsupported backend: " + backend);
	}
}

var getDefaultBackend = function() {
	if (hasFeature("webcl")) {
		return "webcl";
	} else if (hasFeature("pnacl")) {
		return "pnacl";
	} else {
		return "javascript";
	}
}

var getSupportedBackends = function() {
	var backends = [];
	if (hasFeature("webcl")) {
		backends.push("webcl");
	}
	if (hasFeature("pnacl")) {
		backends.push("pnacl");
	}
	if (hasFeature("asm.js")) {
		backends.push("asm.js");
	}
	backends.push("javascript");
	return backends;
}

var hasFeature = function(name) {
	switch (name) {
		case "asm.js":
			try {
				var userAgent = window.navigator.userAgent;
				var userAgentComponents = userAgent.split(/\s+/);
				var firefoxRegexp = /[Ff]irefox\/(\d+)/g;
				for (component in userAgentComponents) {
					var match = firefoxRegexp.exec(component);
					if (match != null) {
						var firefoxVersion = parseInt(match[0]);
						return firefoxVersion >= 29;
					}
				}
				return false;
			} catch (e) {
				return false;
			}
		case "simd.js":
			return (typeof SIMD !== "undefined");
		case "webgl":
			try {
				var canvas = document.createElement("canvas");
				try {
					if (canvas.getContext("webgl") != null) {
						return true;
					}
				} catch (e) {
				}
				try {
					if (canvas.getContext("experimental-webgl") != null) {
						return true;
					}
				} catch (e) {
				}
			} catch (e) {
			}
			return false;
		case "webcl":
			return (typeof webcl !== "undefined");
		case "pnacl":
			try {
				return (typeof navigator.mimeTypes["application/x-pnacl"]) !== "undefined";
			} catch (e) {
				return false;
			}
		case "nacl":
			try {
				return (typeof navigator.mimeTypes["application/x-nacl"]) !== "undefined";
			} catch (e) {
				return false;
			}
		default:
			throw new Error("Unknown feature: " + name);	
	}
}

exports.connect = connect;
exports.hasFeature = hasFeature;
exports.getDefaultBackend = getDefaultBackend;
exports.getSupportedBackends = getSupportedBackends;
exports.DataType = DataType;
