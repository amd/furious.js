var PBContext = require("./../PBContext");
var util = require("./../util");

function WebSocketContext(options, callback) {
    var self = this;
    //check that it works or throw error
    if (typeof options.url === "undefined") {
        options.url = "ws://localhost:8081/";
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
    }
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

module.exports = WebSocketContext;
