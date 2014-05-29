#pragma once

#include <stdbool.h>
#include <ppapi/c/pp_var.h>

enum NumJS_StringVariable {
	NumJS_StringVariable_Command,
	NumJS_StringVariable_Datatype,
	NumJS_StringVariable_Id,
	NumJS_StringVariable_Out,
	NumJS_StringVariable_In,
	NumJS_StringVariable_Shape,
	NumJS_StringVariable_Array,
	NumJS_StringVariable_Buffer,
	NumJS_StringVariable_Data,
	NumJS_StringVariable_A,
	NumJS_StringVariable_B,
	NumJS_StringVariable_X,
	NumJS_StringVariable_Y,
	NumJS_StringVariable_Z,

	NumJS_StringVariable_Status,
	NumJS_StringVariable_Error,
	NumJS_StringVariable_Success,

	NumJS_StringVariable_NumberOfEntries,
};

extern struct PP_Var NumJS_StringVariables[NumJS_StringVariable_NumberOfEntries];

void NumJS_Strings_Initialize();
void NumJS_Strings_Release();
