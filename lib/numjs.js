var util = require("./util");
var DataType = require("./DataType");
var JSContext = require("./JSContext");
var PNaClContext = require("./PNaClContext");

var connect = function(specification, callback) {
	if (typeof callback === 'undefined') {
		callback = specification;
		specification = undefined;
	}
	if (typeof specification == "undefined") {
		if (hasFeature("pnacl")) {
			return new PNaClContext(callback);
		} else {
			return new JSContext(callback);
		}
	} else if (typeof specification == "javascript") {
		return new JSContext(callback);
	} else if (typeof specification == "pnacl") {
		return new PNaClContext(callback);
	} else if (typeof specification == "webcl") {
		return null; /* new WebCLContext(); */
	} else {
		throw new Error("Unsupported specification: " + specification);
	}
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
			return (typeof SIMD !== 'undefined');
		case 'webgl':
			return (typeof webgl !== 'undefined');
		case "webcl":
			return (typeof webcl !== 'undefined');
		case "pnacl":
			try {
				return (typeof navigator.mimeTypes['application/x-pnacl']) !== "undefined";
			} catch (e) {
				return false;
			}
		case "nacl":
			try {
				return (typeof navigator.mimeTypes['application/x-nacl']) !== "undefined";
			} catch (e) {
				return false;
			}
		default:
			throw new Error("Unknown feature: " + name);	
	}
}

exports.connect = connect;
exports.hasFeature = hasFeature;
exports.DataType = DataType;
