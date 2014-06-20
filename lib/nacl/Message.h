#pragma once

#include <stdbool.h>
#include <stdint.h>

#include <ppapi/c/pp_var.h>
#include <ppapi/c/pp_instance.h>

#include "Error.h"
#include "DataType.h"
#include "Commands.h"
#include "Interfaces.h"
#include "Strings.h"

extern struct PP_Var FJS_ResponseVariable;

enum FJS_VariableType {
	FJS_VariableType_Int32,
	FJS_VariableType_Float64,
	FJS_VariableType_Boolean,
	FJS_VariableType_DataType,
	FJS_VariableType_Command,
	FJS_VariableType_Buffer
};

struct FJS_Buffer {
	void* pointer;
	uint32_t size;
};

struct FJS_VariableDescriptor {
	enum FJS_VariableType type;
	enum FJS_StringVariable name;
};

union FJS_VariableValue {
	bool asBoolean;
	int32_t asInt32;
	double asFloat64;
	enum FJS_DataType asDatatype;
	enum FJS_Command asCommand;
	struct FJS_Buffer asBuffer;
};

struct FJS_Variable {
	union FJS_VariableValue parsedValue;
	struct PP_Var pepperVariable;
};

enum FJS_Error FJS_Message_Parse(uint32_t variablesCount, const struct FJS_VariableDescriptor descriptors[static variablesCount], struct FJS_Variable variables[static variablesCount], struct PP_Var request);
void FJS_Message_FreeVariables(uint32_t variablesCount, struct FJS_Variable variables[static variablesCount]);

bool FJS_Message_SetStatus(PP_Instance instance, struct PP_Var response, enum FJS_Error error);
inline static void FJS_Message_RemoveStatus(struct PP_Var response) {
	dictionaryInterface->Delete(response, FJS_StringVariables[FJS_StringVariable_Status]);
}
