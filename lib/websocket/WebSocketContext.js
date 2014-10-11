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
            if (cookies[i].indexOf("furious-websocket-url=") === 0) {
                var webSocketUrl = cookies[i].substring("furious-websocket-url=".length);
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
}

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

WebSocketContext.prototype.linspace = function(start, stop, samples, closed) {
    return this._messagingContext.linspace(start, stop, samples, closed);
};

WebSocketContext.prototype.reshape = function(a, shape) {
    return this._messagingContext.reshape(a, shape);
};

WebSocketContext.prototype.add = function(a, b, out) {
    return this._messagingContext.add(a, b, out);
}

WebSocketContext.prototype.sub = function(a, b, out) {
    return this._messagingContext.sub(a, b, out);
}

module.exports = WebSocketContext;
