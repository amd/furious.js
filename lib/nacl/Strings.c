#include <stddef.h>

#include "Strings.h"
#include "Interfaces.h"
#include "Util.h"

struct PP_Var NumJS_StringVariables[NumJS_StringVariable_NumberOfEntries];

struct StringLiteral {
	const char* pointer;
	size_t size;
};

#define NUMJS_INIT_STRING_LITERAL(text) \
	{ .pointer = text, .size = NUMJS_LENGTH_OF(text) }

static struct StringLiteral strings[NumJS_StringVariable_NumberOfEntries] = {
	[NumJS_StringVariable_Command] = NUMJS_INIT_STRING_LITERAL("command"),
	[NumJS_StringVariable_Datatype] = NUMJS_INIT_STRING_LITERAL("datatype"),
	[NumJS_StringVariable_Id] = NUMJS_INIT_STRING_LITERAL("id"),
	[NumJS_StringVariable_Out] = NUMJS_INIT_STRING_LITERAL("out"),
	[NumJS_StringVariable_In] = NUMJS_INIT_STRING_LITERAL("in"),
	[NumJS_StringVariable_Shape] = NUMJS_INIT_STRING_LITERAL("shape"),
	[NumJS_StringVariable_Array] = NUMJS_INIT_STRING_LITERAL("array"),
	[NumJS_StringVariable_Buffer] = NUMJS_INIT_STRING_LITERAL("buffer"),
	[NumJS_StringVariable_Data] = NUMJS_INIT_STRING_LITERAL("data"),
	[NumJS_StringVariable_A] = NUMJS_INIT_STRING_LITERAL("a"),
	[NumJS_StringVariable_B] = NUMJS_INIT_STRING_LITERAL("b"),
	[NumJS_StringVariable_X] = NUMJS_INIT_STRING_LITERAL("x"),
	[NumJS_StringVariable_Y] = NUMJS_INIT_STRING_LITERAL("y"),
	[NumJS_StringVariable_Z] = NUMJS_INIT_STRING_LITERAL("z"),

	[NumJS_StringVariable_Status] = NUMJS_INIT_STRING_LITERAL("status"),
	[NumJS_StringVariable_Error] = NUMJS_INIT_STRING_LITERAL("error"),
	[NumJS_StringVariable_Success] = NUMJS_INIT_STRING_LITERAL("success"),
};

void NumJS_Strings_Initialize() {
	for (size_t stringIndex = 0; stringIndex < NumJS_StringVariable_NumberOfEntries; stringIndex++) {
		NumJS_StringVariables[stringIndex] = varInterface->VarFromUtf8(strings[stringIndex].pointer, strings[stringIndex].size);
	}
}

void NumJS_Strings_Release() {
	for (size_t stringIndex = 0; stringIndex < NumJS_StringVariable_NumberOfEntries; stringIndex++) {
		varInterface->Release(NumJS_StringVariables[stringIndex]);
		NumJS_StringVariables[stringIndex] = PP_MakeUndefined();
	}
}
