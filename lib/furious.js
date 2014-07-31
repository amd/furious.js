"use strict";

/**
 * Provides information and support functions
 *
 * @class furious
 */

var DataType = require("./DataType");
var JSContext = require("./js/JSContext");
var WebWorkerContext = require("./js/WebWorkerContext");
var PNaClContext = require("./PNaClContext");
var WebCLContext = require("./webcl/WebCLContext");

var currentScriptUri = null;
try {
	currentScriptUri = document.currentScript.src;
} catch (e) {
	try {
		var scripts = document.getElementsByTagName("script");
		currentScriptUri = scripts[scripts.length - 1].src;
	} catch (e) {
	}
}
var currentScriptDir = null;
if (currentScriptUri !== null) {
	var separatorPos = currentScriptUri.lastIndexOf("/");
	var currentScriptDir = currentScriptUri.substr(0, separatorPos + 1);
}

/**
 * Initializes a computational context.
 *
 * @static
 * @method init
 * @async
 *
 * @param {String} [backend] - A string identifier for the backend to use. The following values are supported:
 *
 *     <table>
 *         <tr>
 *             <th>Backend Identifier</th>
 *             <th>Interpretation</th>
 *         </tr>
 *         <tr>
 *             <td>"javascript"</td>
 *             <td>JavaScript backend. Works in all browsers and Node.js, but can not deliver optimal performance.</td>
 *         </tr>
 *         <tr>
 *             <td>"pnacl"</td>
 *             <td>Portable Native Client (PNaCl) backend. Works in Chromium-based browsers. Can accelerate computations through the use of advanced CPU optimization technologies, such as multi-threading and SIMD instructions.</td>
 *         </tr>
 *         <tr>
 *             <td>"webcl"</td>
 *             <td>WebCL backend. Works in browsers and Node.js when a WebCL plugin is available. Can use full power of CPUs and GPUs to accelerate computations.</td>
 *         </tr>
 *     </table>
 *
 * @param {Object} options - Backend-specific options.
 * @param {Function} callback - A callback function that is called when the backend finish initialization.
 * @param {Context} callback.context - A ready to use computational context.
 */
var init = function(backend, options, callback) {
	if (typeof callback === "undefined") {
		if (typeof options === "undefined") {
			/* Called with one parameter: callback */
			callback = backend;
			options = undefined;
			backend = undefined;
		} else {
			/* Called with two parameters: backend and callback */
			callback = options;
			options = undefined;
		}
	}
	if (typeof backend === "undefined") {
		backend = getDefaultBackend();
	}
	if (typeof options === "undefined") {
		options = {};
	}
	if (backend === "javascript") {
		var async = options.async;
		if (typeof async === "undefined") {
			async = WebWorkerContext.isSupported();
		}
		if (async) {
			options.baseUrl = currentScriptDir;
			return new WebWorkerContext(options, callback);
		} else {
			return new JSContext(options, callback);
		}
	} else if (backend === "pnacl") {
		options.baseUrl = currentScriptDir;
		return new PNaClContext(options, callback);
	} else if (backend === "webcl") {
		return new WebCLContext(options, callback);
	} else {
		throw new Error("Unsupported backend: " + backend);
	}
};

/**
 * Detects the optimal backend supported by the browser or JavaScript engine.
 *
 * @static
 * @method getDefaultBackend
 *
 * @return {String} - Default backend identifier from the following table:
 *
 *     <table>
 *         <tr>
 *             <th>Backend Identifier</th>
 *             <th>Interpretation</th>
 *         </tr>
 *         <tr>
 *             <td>"javascript"</td>
 *             <td>JavaScript backend. Works in all browsers and Node.js, but can not deliver optimal performance.</td>
 *         </tr>
 *         <tr>
 *             <td>"asmjs"</td>
 *             <td>Asm.js backend. Works in Firefox 29 and later. Can accelerate computations with a limited use of native CPU instructions.</td>
 *         </tr>
 *         <tr>
 *             <td>"pnacl"</td>
 *             <td>Portable Native Client (PNaCl) backend. Works in Chromium-based browsers. Can accelerate computations through the use of advanced CPU optimization technologies, such as multi-threading and SIMD instructions.</td>
 *         </tr>
 *         <tr>
 *             <td>"webcl"</td>
 *             <td>WebCL backend. Works in browsers and Node.js when a WebCL plugin is available. Can use full power of CPUs and GPUs to accelerate computations.</td>
 *         </tr>
 *     </table>
 */
var getDefaultBackend = function() {
	if (WebCLContext.isUsable()) {
		return "webcl";
	} else if (PNaClContext.isSupported()) {
		return "pnacl";
	} else {
		return "javascript";
	}
};

/**
 * Detects which backends are supported by the system.
 *
 * @static
 * @method getSupportedBackends
 *
 * @return {String[]} - An array of supported backend identifiers in priority order (prioritized backends first). The following identifiers could be present:
 *
 *     <table>
 *         <tr>
 *             <th>Backend Identifier</th>
 *             <th>Interpretation</th>
 *         </tr>
 *         <tr>
 *             <td>"javascript"</td>
 *             <td>JavaScript backend. Works in all browsers and Node.js, but can not deliver optimal performance.</td>
 *         </tr>
 *         <tr>
 *             <td>"asmjs"</td>
 *             <td>Asm.js backend. Works in Firefox 29 and later. Can accelerate computations with a limited use of native CPU instructions.</td>
 *         </tr>
 *         <tr>
 *             <td>"pnacl"</td>
 *             <td>Portable Native Client (PNaCl) backend. Works in Chromium-based browsers. Can accelerate computations through the use of advanced CPU optimization technologies, such as multi-threading and SIMD instructions.</td>
 *         </tr>
 *         <tr>
 *             <td>"webcl"</td>
 *             <td>WebCL backend. Works in browsers and Node.js when a WebCL plugin is available. Can use full power of CPUs and GPUs to accelerate computations.</td>
 *         </tr>
 *     </table>
 */
var getSupportedBackends = function() {
	var backends = [];
	if (WebCLContext.isUsable()) {
		backends.push("webcl");
	}
	if (PNaClContext.isSupported()) {
		backends.push("pnacl");
	}
	if (hasFeature("asm.js")) {
		backends.push("asm.js");
	}
	backends.push("javascript");
	return backends;
};

/**
 * Queries possible backend options available on this platform.
 *
 * @param {String} backend - name of the backend to query options for.
 *
 * @static
 * @method getBackendOptions
 *
 * @return {Object} - An object that describes available options.
 * The names of object's properties correspond to backend option names.
 * Object's properties have array values with possible option values.
 * Below are the backend options for the built-in backends:
 *
 *     <table>
 *         <caption>Options of "javascript" and "asmjs" backends</caption>
 *         <tr>
 *             <th>Option name</th>
 *             <th>Option values</th>
 *             <th>Default value</th>
 *         </tr>
 *         <tr>
 *             <td>"async"</td>
 *             <td>[true, false]</td>
 *             <td>true</td>
 *         </tr>
 *     </table>
 *
 *     <table>
 *         <caption>Options of "pnacl" backend</caption>
 *         <tr>
 *             <th>Option name</th>
 *             <th>Option values</th>
 *             <th>Default value</th>
 *         </tr>
 *         <tr>
 *             <td>"manifest"</td>
 *             <td>undefined</td>
 *             <td>URL of "furious.nmf" file in the same directory as "furious.js" library</td>
 *         </tr>
 *     </table>
 *
 *     <table>
 *         <caption>Options of "webcl" backend</caption>
 *         <tr>
 *             <th>Option name</th>
 *             <th>Option values</th>
 *             <th>Default value</th>
 *         </tr>
 *         <tr>
 *             <td>"device"</td>
 *             <td>Depends on the platform</td>
 *             <td>Discrete GPU device, if available. Otherwise integrated GPU device, if available. Otherwise CPU device.</td>
 *         </tr>
 *     </table>
 */
var getBackendOptions = function(backend) {
	if (backend === "javascript") {
		if (WebWorkerContext.isSupported()) {
			return {
				"async": [true, false]
			};
		} else {
			return {};
		}
	} else if (backend === "pnacl") {
		return {};
	} else if (backend === "webcl") {
		return {
			"device": WebCLContext.getAvailableDevices()
		};
	} else {
		throw new Error("Unsupported backend: " + backend);
	}
};

/**
 * Queries default backend options on this platform.
 *
 * @param {String} backend - name of the backend to query options for.
 *
 * @static
 * @method getBackendOptions
 *
 * @return {Object} - An object that describes available options.
 * The names of object's properties correspond to backend option names.
 * The values of object's properties correspond to default option values.
 */
var getDefaultBackendOptions = function(backend) {
	if (backend === "javascript") {
		return {
			"async": true
		};
	} else if (backend === "pnacl") {
		if (PNaClContext.isSupported()) {
			return {
				"manifest": PNaClContext.getDefaultManifestURL()
			};
		} else {
			return {};
		}
	} else if (backend === "webcl") {
		return {
			"device": WebCLContext.getDefaultDevice()
		};
	} else {
		throw new Error("Unsupported backend: " + backend);
	}
};

/**
 * Detects whether the requested computing feature is available
 *
 * @static
 * @method hasFeature
 *
 * @param {String} name - an identifier of the optional feature to detect. The following identifiers are supported:
 *
 *     <table>
 *         <tr>
 *             <th>Feature Identifier</th>
 *             <th>Interpretation</th>
 *         </tr>
 *         <tr>
 *             <td>"webworkers"</td>
 *             <td>Detect if the JavaScript engine can spawn dedicated Web Workers.</td>
 *         </tr>
 *         <tr>
 *             <td>"asm.js"</td>
 *             <td>Detect if the JavaScript engine recognizes Asm.js directive.</td>
 *         </tr>
 *         <tr>
 *             <td>"simd.js"</td>
 *             <td>Detect if the JavaScript engine provide SIMD.float32x4, SIMD.int32x4, Float32x4Array, and Int32x4Array of SIMD.js</td>
 *         </tr>
 *         <tr>
 *             <td>"webgl"</td>
 *             <td>Detect if the environment supports WebGL (either experimental or stable implementation)</td>
 *         </tr>
 *         <tr>
 *             <td>"webcl"</td>
 *             <td>Detect if the environment supports WebCL</td>
 *         </tr>
 *         <tr>
 *             <td>"pnacl"</td>
 *             <td>Detect if Portable Native Client (PNaCl) is supported and enabled</td>
 *         </tr>
 *         <tr>
 *             <td>"nacl"</td>
 *             <td>Detect if Native Client (NaCl) is supported and enabled</td>
 *         </tr>
 *     </table>
 *
 * @return {Boolean} - true if the feature is supported, false otherwise
 */
var hasFeature = function(name) {
	switch (name) {
		case "asm.js":
			try {
				var userAgent = window.navigator.userAgent;
				var userAgentComponents = userAgent.split(/\s+/);
				var firefoxRegexp = /[Ff]irefox\/(\d+)/g;
				for (var i = 0; i < userAgentComponents.length; ++i) {
					var component = userAgentComponents[i];
					var match = firefoxRegexp.exec(component);
					if (match !== null) {
						var firefoxVersion = parseInt(match[1]);
						return firefoxVersion >= 29;
					}
				}
				return false;
			} catch (e) {
			}
			return false;
		case "simd.js":
			return (typeof SIMD !== "undefined") &&
				(typeof Float32x4Array !== "undefined") &&
				(typeof Int32x4Array !== "undefined");
		case "webworkers":
			return (typeof Worker !== "undefined");
		case "webgl":
			try {
				var canvas = document.createElement("canvas");
				try {
					if (canvas.getContext("webgl") !== null) {
						return true;
					}
				} catch (e) {
				}
				try {
					if (canvas.getContext("experimental-webgl") !== null) {
						return true;
					}
				} catch (e) {
				}
			} catch (e) {
			}
			return false;
		case "webcl":
			return WebCLContext.isSupported();
		case "pnacl":
			return PNaClContext.isSupported();
		case "nacl":
			try {
				return (typeof navigator.mimeTypes["application/x-nacl"]) !== "undefined";
			} catch (e) {
			}
			return false;
		default:
			throw new Error("Unknown feature: " + name);
	}
};

exports.init = init;
exports.hasFeature = hasFeature;
exports.getDefaultBackend = getDefaultBackend;
exports.getSupportedBackends = getSupportedBackends;
exports.getBackendOptions = getBackendOptions;
exports.getDefaultBackendOptions = getDefaultBackendOptions;
exports.DataType = DataType;
