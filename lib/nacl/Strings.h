#pragma once

#include <stdbool.h>
#include <ppapi/c/pp_var.h>

enum FJS_StringVariable {
	FJS_StringVariable_Command,
	FJS_StringVariable_Datatype,
	FJS_StringVariable_Id,
	FJS_StringVariable_Out,
	FJS_StringVariable_In,
	FJS_StringVariable_Shape,
	FJS_StringVariable_Array,
	FJS_StringVariable_Buffer,
	FJS_StringVariable_Data,
	FJS_StringVariable_A,
	FJS_StringVariable_B,
	FJS_StringVariable_X,
	FJS_StringVariable_Y,
	FJS_StringVariable_Z,

	FJS_StringVariable_Status,
	FJS_StringVariable_Error,
	FJS_StringVariable_Success,

	FJS_StringVariable_NumberOfEntries,
};

extern struct PP_Var FJS_StringVariables[FJS_StringVariable_NumberOfEntries];

void FJS_Strings_Initialize();
void FJS_Strings_Release();
