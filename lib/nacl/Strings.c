#include <stddef.h>

#include "Strings.h"
#include "Interfaces.h"
#include "Util.h"

struct PP_Var FJS_StringVariables[FJS_StringVariable_NumberOfEntries];

struct StringLiteral {
	const char* pointer;
	size_t size;
};

#define FJS_INIT_STRING_LITERAL(text) \
	{ .pointer = text, .size = FJS_LENGTH_OF(text) }

static struct StringLiteral strings[FJS_StringVariable_NumberOfEntries] = {
	[FJS_StringVariable_Command] = FJS_INIT_STRING_LITERAL("command"),
	[FJS_StringVariable_Datatype] = FJS_INIT_STRING_LITERAL("datatype"),
	[FJS_StringVariable_Id] = FJS_INIT_STRING_LITERAL("id"),
	[FJS_StringVariable_Out] = FJS_INIT_STRING_LITERAL("out"),
	[FJS_StringVariable_In] = FJS_INIT_STRING_LITERAL("in"),
	[FJS_StringVariable_Shape] = FJS_INIT_STRING_LITERAL("shape"),
	[FJS_StringVariable_Array] = FJS_INIT_STRING_LITERAL("array"),
	[FJS_StringVariable_Buffer] = FJS_INIT_STRING_LITERAL("buffer"),
	[FJS_StringVariable_Data] = FJS_INIT_STRING_LITERAL("data"),
	[FJS_StringVariable_A] = FJS_INIT_STRING_LITERAL("a"),
	[FJS_StringVariable_B] = FJS_INIT_STRING_LITERAL("b"),
	[FJS_StringVariable_X] = FJS_INIT_STRING_LITERAL("x"),
	[FJS_StringVariable_Y] = FJS_INIT_STRING_LITERAL("y"),
	[FJS_StringVariable_Z] = FJS_INIT_STRING_LITERAL("z"),
	[FJS_StringVariable_Axis] = FJS_INIT_STRING_LITERAL("axis"),
	[FJS_StringVariable_Repeats] = FJS_INIT_STRING_LITERAL("repeats"),
	[FJS_StringVariable_Start] = FJS_INIT_STRING_LITERAL("start"),
	[FJS_StringVariable_Stop] = FJS_INIT_STRING_LITERAL("stop"),
	[FJS_StringVariable_Samples] = FJS_INIT_STRING_LITERAL("samples"),
	[FJS_StringVariable_Closed] = FJS_INIT_STRING_LITERAL("closed"),
	[FJS_StringVariable_Status] = FJS_INIT_STRING_LITERAL("status"),
	[FJS_StringVariable_Error] = FJS_INIT_STRING_LITERAL("error"),
	[FJS_StringVariable_Success] = FJS_INIT_STRING_LITERAL("success"),
	[FJS_StringVariable_Description] = FJS_INIT_STRING_LITERAL("description"),

	[FJS_StringVariable_IDAllocations] = FJS_INIT_STRING_LITERAL("idAllocations"),
	[FJS_StringVariable_ArrayAllocations] = FJS_INIT_STRING_LITERAL("arrayAllocations"),
	[FJS_StringVariable_ByteAllocations] = FJS_INIT_STRING_LITERAL("byteAllocations"),

	/* Strings for errors */
	[FJS_StringVariable_Ok] = FJS_INIT_STRING_LITERAL("no error"),
	[FJS_StringVariable_EmptyShape] = FJS_INIT_STRING_LITERAL("empty shape"),
	[FJS_StringVariable_DegenerateShape] = FJS_INIT_STRING_LITERAL("degenerate shape"),
	[FJS_StringVariable_LengthOverflow] = FJS_INIT_STRING_LITERAL("length overflow"),
	[FJS_StringVariable_SizeOverflow] = FJS_INIT_STRING_LITERAL("size overflow"),
	[FJS_StringVariable_IncompatibleBufferSize] = FJS_INIT_STRING_LITERAL("incompatible buffer size"),
	[FJS_StringVariable_InvalidBufferSize] = FJS_INIT_STRING_LITERAL("invalid buffer size"),
	[FJS_StringVariable_EmptyBuffer] = FJS_INIT_STRING_LITERAL("empty buffer"),
	[FJS_StringVariable_InvalidElementSize] = FJS_INIT_STRING_LITERAL("invalid element size"),
	[FJS_StringVariable_InvalidDataType] = FJS_INIT_STRING_LITERAL("invalid data type"),
	[FJS_StringVariable_InvalidVariableType] = FJS_INIT_STRING_LITERAL("invalid variable type"),
	[FJS_StringVariable_MissingVariable] = FJS_INIT_STRING_LITERAL("missing variable"),
	[FJS_StringVariable_InvalidId] = FJS_INIT_STRING_LITERAL("invalid id"),
	[FJS_StringVariable_MismatchingDimensions] = FJS_INIT_STRING_LITERAL("mismatching dimensions"),
	[FJS_StringVariable_MismatchingShape] = FJS_INIT_STRING_LITERAL("mismatching shape"),
	[FJS_StringVariable_MismatchingDataType] = FJS_INIT_STRING_LITERAL("mismatching data type"),
	[FJS_StringVariable_MismatchingLength] = FJS_INIT_STRING_LITERAL("mismatching length"),
	[FJS_StringVariable_InvalidLength] = FJS_INIT_STRING_LITERAL("invalid length"),
	[FJS_StringVariable_InvalidDimensions] = FJS_INIT_STRING_LITERAL("invalid dimensions"),
	[FJS_StringVariable_AxisOutOfRange] = FJS_INIT_STRING_LITERAL("axis out of range"),
	[FJS_StringVariable_RepeatsOutOfRange] = FJS_INIT_STRING_LITERAL("repeats out of range"),
	[FJS_StringVariable_OutOfMemory] = FJS_INIT_STRING_LITERAL("out of memory"),	
};

void FJS_Strings_Initialize() {
	for (size_t stringIndex = 0; stringIndex < FJS_StringVariable_NumberOfEntries; stringIndex++) {
		FJS_StringVariables[stringIndex] = varInterface->VarFromUtf8(strings[stringIndex].pointer, strings[stringIndex].size);
	}
}

void FJS_Strings_Release() {
	for (size_t stringIndex = 0; stringIndex < FJS_StringVariable_NumberOfEntries; stringIndex++) {
		varInterface->Release(FJS_StringVariables[stringIndex]);
		FJS_StringVariables[stringIndex] = PP_MakeUndefined();
	}
}
