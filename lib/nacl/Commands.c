#include <string.h>

#include "Commands.h"

enum FJS_Command FJS_Command_Parse(const char* commandString, uint32_t commandLength) {
	enum FJS_Command command = FJS_Command_Invalid;
	if (commandString != NULL) {
		if (strncmp(commandString, "create", commandLength) == 0) {
			command = FJS_Command_Create;
		} else if (strncmp(commandString, "create-from-buffer", commandLength) == 0) {
			command = FJS_Command_CreateFromBuffer;
		} else if (strncmp(commandString, "create-from-array", commandLength) == 0) {
			command = FJS_Command_CreateFromArray;
		} else if (strncmp(commandString, "release", commandLength) == 0) {
			command = FJS_Command_Release;
		} else if (strncmp(commandString, "get-buffer", commandLength) == 0) {
			command = FJS_Command_GetBuffer;
		} else if (strncmp(commandString, "get-array", commandLength) == 0) {
			command = FJS_Command_GetArray;
		} else if (strncmp(commandString, "add", commandLength) == 0) {
			command = FJS_Command_Add;
		} else if (strncmp(commandString, "sub", commandLength) == 0) {
			command = FJS_Command_Sub;
		} else if (strncmp(commandString, "mul", commandLength) == 0) {
			command = FJS_Command_Mul;
		} else if (strncmp(commandString, "div", commandLength) == 0) {
			command = FJS_Command_Div;
		} else if (strncmp(commandString, "iadd", commandLength) == 0) {
			command = FJS_Command_IAdd;
		} else if (strncmp(commandString, "isub", commandLength) == 0) {
			command = FJS_Command_ISub;
		} else if (strncmp(commandString, "irsub", commandLength) == 0) {
			command = FJS_Command_IRSub;
		} else if (strncmp(commandString, "imul", commandLength) == 0) {
			command = FJS_Command_IMul;
		} else if (strncmp(commandString, "idiv", commandLength) == 0) {
			command = FJS_Command_IDiv;
		} else if (strncmp(commandString, "irdiv", commandLength) == 0) {
			command = FJS_Command_IRDiv;
		} else if (strncmp(commandString, "addc", commandLength) == 0) {
			command = FJS_Command_AddC;
		} else if (strncmp(commandString, "subc", commandLength) == 0) {
			command = FJS_Command_SubC;
		} else if (strncmp(commandString, "rsubc", commandLength) == 0) {
			command = FJS_Command_RSubC;
		} else if (strncmp(commandString, "mulc", commandLength) == 0) {
			command = FJS_Command_MulC;
		} else if (strncmp(commandString, "divc", commandLength) == 0) {
			command = FJS_Command_DivC;
		} else if (strncmp(commandString, "rdivc", commandLength) == 0) {
			command = FJS_Command_RDivC;
		} else if (strncmp(commandString, "iaddc", commandLength) == 0) {
			command = FJS_Command_IAddC;
		} else if (strncmp(commandString, "isubc", commandLength) == 0) {
			command = FJS_Command_ISubC;
		} else if (strncmp(commandString, "irsubc", commandLength) == 0) {
			command = FJS_Command_IRSubC;
		} else if (strncmp(commandString, "imulc", commandLength) == 0) {
			command = FJS_Command_IMulC;
		} else if (strncmp(commandString, "idivc", commandLength) == 0) {
			command = FJS_Command_IDivC;
		} else if (strncmp(commandString, "irdivc", commandLength) == 0) {
			command = FJS_Command_IRDivC;
		} else if (strncmp(commandString, "neg", commandLength) == 0) {
			command = FJS_Command_Neg;
		} else if (strncmp(commandString, "abs", commandLength) == 0) {
			command = FJS_Command_Abs;
		} else if (strncmp(commandString, "exp", commandLength) == 0) {
			command = FJS_Command_Exp;
		} else if (strncmp(commandString, "log", commandLength) == 0) {
			command = FJS_Command_Log;
		} else if (strncmp(commandString, "sqrt", commandLength) == 0) {
			command = FJS_Command_Sqrt;
		} else if (strncmp(commandString, "square", commandLength) == 0) {
			command = FJS_Command_Square;
		} else if (strncmp(commandString, "ineg", commandLength) == 0) {
			command = FJS_Command_INeg;
		} else if (strncmp(commandString, "iabs", commandLength) == 0) {
			command = FJS_Command_IAbs;
		} else if (strncmp(commandString, "iexp", commandLength) == 0) {
			command = FJS_Command_IExp;
		} else if (strncmp(commandString, "ilog", commandLength) == 0) {
			command = FJS_Command_ILog;
		} else if (strncmp(commandString, "isqrt", commandLength) == 0) {
			command = FJS_Command_ISqrt;
		} else if (strncmp(commandString, "isquare", commandLength) == 0) {
			command = FJS_Command_ISquare;
		} else if (strncmp(commandString, "min", commandLength) == 0) {
			command = FJS_Command_Min;
		} else if (strncmp(commandString, "max", commandLength) == 0) {
			command = FJS_Command_Max;
		} else if (strncmp(commandString, "sum", commandLength) == 0) {
			command = FJS_Command_Sum;
		} else if (strncmp(commandString, "amin", commandLength) == 0) {
			command = FJS_Command_AxisMin;
		} else if (strncmp(commandString, "amax", commandLength) == 0) {
			command = FJS_Command_AxisMax;
		} else if (strncmp(commandString, "asum", commandLength) == 0) {
			command = FJS_Command_AxisSum;
		}
	}
	return command;
}
