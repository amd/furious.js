#include <string.h>

#include "Commands.h"

enum NumJS_Command NumJS_Command_Parse(const char* commandString, uint32_t commandLength) {
	enum NumJS_Command command = NumJS_Command_Invalid;
	if (commandString != NULL) {
		if (strncmp(commandString, "create", commandLength) == 0) {
			command = NumJS_Command_Create;
		} else if (strncmp(commandString, "create-from-buffer", commandLength) == 0) {
			command = NumJS_Command_CreateFromBuffer;
		} else if (strncmp(commandString, "create-from-array", commandLength) == 0) {
			command = NumJS_Command_CreateFromArray;
		} else if (strncmp(commandString, "release", commandLength) == 0) {
			command = NumJS_Command_Release;
		} else if (strncmp(commandString, "get-buffer", commandLength) == 0) {
			command = NumJS_Command_GetBuffer;
		} else if (strncmp(commandString, "get-array", commandLength) == 0) {
			command = NumJS_Command_GetArray;
		} else if (strncmp(commandString, "add", commandLength) == 0) {
			command = NumJS_Command_Add;
		} else if (strncmp(commandString, "sub", commandLength) == 0) {
			command = NumJS_Command_Sub;
		} else if (strncmp(commandString, "mul", commandLength) == 0) {
			command = NumJS_Command_Mul;
		} else if (strncmp(commandString, "div", commandLength) == 0) {
			command = NumJS_Command_Div;
		} else if (strncmp(commandString, "iadd", commandLength) == 0) {
			command = NumJS_Command_IAdd;
		} else if (strncmp(commandString, "isub", commandLength) == 0) {
			command = NumJS_Command_ISub;
		} else if (strncmp(commandString, "irsub", commandLength) == 0) {
			command = NumJS_Command_IRSub;
		} else if (strncmp(commandString, "imul", commandLength) == 0) {
			command = NumJS_Command_IMul;
		} else if (strncmp(commandString, "idiv", commandLength) == 0) {
			command = NumJS_Command_IDiv;
		} else if (strncmp(commandString, "irdiv", commandLength) == 0) {
			command = NumJS_Command_IRDiv;
		}
	}
	return command;
}
