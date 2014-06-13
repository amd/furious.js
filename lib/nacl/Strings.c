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

	[FJS_StringVariable_Status] = FJS_INIT_STRING_LITERAL("status"),
	[FJS_StringVariable_Error] = FJS_INIT_STRING_LITERAL("error"),
	[FJS_StringVariable_Success] = FJS_INIT_STRING_LITERAL("success"),
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
