var fs = require("fs");
var protobufjs = require("protobufjs");
protobufjs.convertFieldsToCamelCase = true;
var requestsProto = fs.readFileSync(__dirname + "/../protobuf/Requests.proto", "utf8");
module.exports = protobufjs.loadProto(requestsProto).build("furious");
