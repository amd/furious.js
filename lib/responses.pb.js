var fs = require("fs");
var protobufjs = require("protobufjs");
protobufjs.convertFieldsToCamelCase = true;
var responsesProto = fs.readFileSync(__dirname + "/../protobuf/Responses.proto", "utf8");
module.exports = protobufjs.loadProto(responsesProto).build("furious");
