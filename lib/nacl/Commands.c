#include <string.h>

#include "Commands.h"

enum FJS_Command FJS_Command_Parse(const char* commandString, uint32_t commandLength) {
	enum FJS_Command command = FJS_Command_Invalid;
	if (commandString != NULL) {
		if (strncmp(commandString, "init", commandLength) == 0) {
			command = FJS_Command_Init;
		} else if (strncmp(commandString, "empty", commandLength) == 0) {
			command = FJS_Command_Empty;
		} else if (strncmp(commandString, "zeros", commandLength) == 0) {
			command = FJS_Command_Zeros;
		} else if (strncmp(commandString, "ones", commandLength) == 0) {
			command = FJS_Command_Ones;
		} else if (strncmp(commandString, "array", commandLength) == 0) {
			command = FJS_Command_Array;
		} else if (strncmp(commandString, "linspace", commandLength) == 0) {
			command = FJS_Command_LinSpace;
		} else if (strncmp(commandString, "reshape", commandLength) == 0) {
			command = FJS_Command_ReShape;
		} else if (strncmp(commandString, "repeat", commandLength) == 0) {
			command = FJS_Command_Repeat;
		} else if (strncmp(commandString, "free", commandLength) == 0) {
			command = FJS_Command_Free;
		} else if (strncmp(commandString, "get", commandLength) == 0) {
			command = FJS_Command_Get;
		} else if (strncmp(commandString, "set", commandLength) == 0) {
			command = FJS_Command_Set;
		} else if (strncmp(commandString, "info", commandLength) == 0) {
			command = FJS_Command_Info;
		} else if (strncmp(commandString, "add", commandLength) == 0) {
			command = FJS_Command_Add;
		} else if (strncmp(commandString, "sub", commandLength) == 0) {
			command = FJS_Command_Sub;
		} else if (strncmp(commandString, "mul", commandLength) == 0) {
			command = FJS_Command_Mul;
		} else if (strncmp(commandString, "div", commandLength) == 0) {
			command = FJS_Command_Div;
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
		} else if (strncmp(commandString, "dot", commandLength) == 0) {
			command = FJS_Command_Dot;
		}
	}
	return command;
}
