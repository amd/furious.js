var PBContext = require("./../PBContext");

//Web socket context constructor
function WebSocketContext(options, callback) {
    var self = this;
    //check that it works or throw error
    if (typeof options.url == "undefined") {
        options.url = "ws://localhost:8081/";
    }
    this._webSocket = new WebSocket(options.url);
    this._messagingContext = new PBContext(options, function(message) {
        self._webSocket.send(message);
    } , callback);
    this._webSocket.onopen = function() {
        console.log("connected");
        callback(self);
    };
}

WebSocketContext.prototype.array = function(data, dataType) {
    return this._messagingContext.array(data, dataType);
};

WebSocketContext.prototype.get = function() {
    this._messagingContext.get.apply(this._messagingContext, arguments);
};



//Export the websocketcontext class
module.exports = WebSocketContext;
