#pragma once

#include <stdbool.h>
#include <ppapi/c/pp_var.h>

enum FJS_StringVariable {
	FJS_StringVariable_IDAllocations,
	FJS_StringVariable_ArrayAllocations,
	FJS_StringVariable_ByteAllocations,

	FJS_StringVariable_Status,
	FJS_StringVariable_Error,
	FJS_StringVariable_Success,
	FJS_StringVariable_Description,

	/* Strings for errors */
	FJS_StringVariable_Ok,
	FJS_StringVariable_InvalidProtobuf,
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
	FJS_StringVariable_InvalidShape,
	FJS_StringVariable_AxisOutOfRange,
	FJS_StringVariable_RepeatsOutOfRange,
	FJS_StringVariable_OutOfMemory,
	
	FJS_StringVariable_NumberOfEntries,
};

extern struct PP_Var FJS_StringVariables[FJS_StringVariable_NumberOfEntries];

#ifdef __cplusplus
extern "C" {
#endif

void FJS_Strings_Initialize();
void FJS_Strings_Release();

#ifdef __cplusplus
}
#endif
