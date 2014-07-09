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
	FJS_StringVariable_Axis,
	FJS_StringVariable_Repeats,
	FJS_StringVariable_Start,
	FJS_StringVariable_Stop,
	FJS_StringVariable_Samples,
	FJS_StringVariable_Closed,
	FJS_StringVariable_A,
	FJS_StringVariable_B,
	FJS_StringVariable_X,
	FJS_StringVariable_Y,
	FJS_StringVariable_Z,

	FJS_StringVariable_IDAllocations,
	FJS_StringVariable_ArrayAllocations,
	FJS_StringVariable_ByteAllocations,

	FJS_StringVariable_Status,
	FJS_StringVariable_Error,
	FJS_StringVariable_Success,
	FJS_StringVariable_Description,

	/* Strings for errors */
	FJS_StringVariable_Ok,
	FJS_StringVariable_EmptyShape,
	FJS_StringVariable_DegenerateShape,
	FJS_StringVariable_LengthOverflow,
	FJS_StringVariable_SizeOverflow,
	FJS_StringVariable_IncompatibleBufferSize,
	FJS_StringVariable_InvalidBufferSize,
	FJS_StringVariable_EmptyBuffer,
	FJS_StringVariable_InvalidElementSize,
	FJS_StringVariable_InvalidDataType,
	FJS_StringVariable_InvalidVariableType,
	FJS_StringVariable_MissingVariable,
	FJS_StringVariable_InvalidId,
	FJS_StringVariable_MismatchingDimensions,
	FJS_StringVariable_MismatchingShape,
	FJS_StringVariable_MismatchingDataType,
	FJS_StringVariable_MismatchingLength,
	FJS_StringVariable_InvalidLength,
	FJS_StringVariable_InvalidDimensions,
	FJS_StringVariable_AxisOutOfRange,
	FJS_StringVariable_RepeatsOutOfRange,
	FJS_StringVariable_OutOfMemory,
	
	FJS_StringVariable_NumberOfEntries,
};

extern struct PP_Var FJS_StringVariables[FJS_StringVariable_NumberOfEntries];

void FJS_Strings_Initialize();
void FJS_Strings_Release();
