var PBContext = require("./../PBContext");
var util = require("./../util");

function WebSocketContext(options, callback) {
	var self = this;
	//check that it works or throw error
	if (typeof options.url === "undefined") {
		options.url = WebSocketContext.getDefaultURL(options.baseUrl);
	}
	this._webSocket = new WebSocket(options.url);
	this._webSocket.binaryType = "arraybuffer";
	this._messagingContext = new PBContext(options, function(message) {
		self._webSocket.send(message);
	}, callback);
	this._webSocket.onopen = function() {
		callback(self);
	};
	this._webSocket.onmessage = function(e) {
		self._messagingContext._onMessage(e);
	};
}

WebSocketContext.isSupported = function() {
	try {
		return (typeof WebSocket !== "undefined");
	} catch (e) {
	}
	return false;
};

WebSocketContext.isConfigured = function() {
	if (WebSocketContext.isSupported()) {
		return WebSocketContext.getCookieURL() !== null;
	} else {
		return false;
	}
};

WebSocketContext.getDefaultURL = function(baseUrl) {
	var cookieURL = WebSocketContext.getCookieURL();
	if (cookieURL) {
		return cookieURL;
	} else {
		if (baseUrl) {
			var protocolSeparator = baseUrl.indexOf("://");
			if (protocolSeparator >= 0) {
				var protocol = baseUrl.substring(0, protocolSeparator);
				if (protocol == "https") {
					return "wss" + baseUrl.substring(protocolSeparator) + "furious.ws";
				} else {
					return "ws" + baseUrl.substring(protocolSeparator) + "furious.ws";
				}
			}
		}
	}
	return null;
};

WebSocketContext.getCookieURL = function() {
	try {
		var cookies = document.cookie.split(";");
		for (var i = 0; i < cookies.length; ++i) {
			/* Chrome separates cookies with "; " so we need to remove spaces (trim) */
			var cookie = cookies[i].trim();
			if (cookie.indexOf("furious-websocket-url=") === 0) {
				var webSocketUrl = cookie.substring("furious-websocket-url=".length);
				// TODO: proper validation for websocket url
				if (webSocketUrl.length !== 0) {
					return webSocketUrl;
				}
			}
		}
	} catch (e) {
	}
	return null;
};

WebSocketContext.prototype.empty = function(shape, dataType) {
	return this._messagingContext.empty(shape, dataType);
};

WebSocketContext.prototype.zeros = function(shape, dataType) {
	return this._messagingContext.zeros(shape, dataType);
};

WebSocketContext.prototype.ones = function(shape, dataType) {
	return this._messagingContext.ones(shape, dataType);
};

WebSocketContext.prototype.array = function(data, dataType) {
	return this._messagingContext.array(data, dataType);
};

WebSocketContext.prototype._invalidate = function(array) {
	return this._messagingContext._invalidate(array);
};

WebSocketContext.prototype.fetch = function() {
	this._messagingContext.fetch.apply(this._messagingContext, arguments);
};

WebSocketContext.prototype.get = function() {
	this._messagingContext.get.apply(this._messagingContext, arguments);
};

WebSocketContext.prototype.barrier = function(callback) {
	this._messagingContext.barrier(callback);
};

WebSocketContext.prototype.linspace = function(start, stop, samples, closed) {
	return this._messagingContext.linspace(start, stop, samples, closed);
};

WebSocketContext.prototype.reshape = function(a, shape) {
	return this._messagingContext.reshape(a, shape);
};

WebSocketContext.prototype.repeat = function(a, repeats, axis, out) {
	return this._messagingContext.repeat(a, repeats, axis, out);
};

WebSocketContext.prototype.add = function(a, b, out) {
	return this._messagingContext.add(a, b, out);
};

WebSocketContext.prototype.sub = function(a, b, out) {
	return this._messagingContext.sub(a, b, out);
};

WebSocketContext.prototype.mul = function(a, b, out) {
	return this._messagingContext.mul(a, b, out);
};

WebSocketContext.prototype.div = function(a, b, out) {
	return this._messagingContext.div(a, b, out);
};

WebSocketContext.prototype.addc = function(a, b, out) {
	return this._messagingContext.addc(a, b, out);
};

WebSocketContext.prototype.subc = function(a, b, out) {
	return this._messagingContext.subc(a, b, out);
};

WebSocketContext.prototype.mulc = function(a, b, out) {
	return this._messagingContext.mulc(a, b, out);
};

WebSocketContext.prototype.divc = function(a, b, out) {
	return this._messagingContext.divc(a, b, out);
};

WebSocketContext.prototype.neg = function(a, out) {
	return this._messagingContext.neg(a, out);
};

WebSocketContext.prototype.abs = function(a, out) {
	return this._messagingContext.abs(a, out);
};

WebSocketContext.prototype.exp = function(a, out) {
	return this._messagingContext.exp(a, out);
};

WebSocketContext.prototype.log = function(a, out) {
	return this._messagingContext.log(a, out);
};

WebSocketContext.prototype.sqrt = function(a, out) {
	return this._messagingContext.sqrt(a, out);
};

WebSocketContext.prototype.square = function(a, out) {
	return this._messagingContext.square(a, out);
};

WebSocketContext.prototype.sum = function(a, axis) {
	return this._messagingContext.sum(a, axis);
};

WebSocketContext.prototype.min = function(a, axis) {
	return this._messagingContext.min(a, axis);
};

WebSocketContext.prototype.max = function(a, axis) {
	return this._messagingContext.max(a, axis);
};

WebSocketContext.prototype.dot = function(a, b, out) {
	return this._messagingContext.dot(a, b, out);
};

module.exports = WebSocketContext;
