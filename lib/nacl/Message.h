#pragma once

#include <stdbool.h>
#include <stdint.h>

#include <ppapi/c/pp_var.h>

#include "Error.h"
#include "DataType.h"
#include "Commands.h"
#include "Interfaces.h"
#include "Strings.h"

enum NumJS_VariableType {
	NumJS_VariableType_Int32,
	NumJS_VariableType_Float64,
	NumJS_VariableType_DataType,
	NumJS_VariableType_Command,
	NumJS_VariableType_Buffer
};

struct NumJS_Buffer {
	void* pointer;
	uint32_t size;
};

struct NumJS_VariableDescriptor {
	enum NumJS_VariableType type;
	const struct PP_Var* name;
};

union NumJS_VariableValue {
	int32_t asInt32;
	double asFloat64;
	enum NumJS_DataType asDatatype;
	enum NumJS_Command asCommand;
	struct NumJS_Buffer asBuffer;
};

struct NumJS_Variable {
	union NumJS_VariableValue parsedValue;
	struct PP_Var pepperVariable;
};

enum NumJS_Error NumJS_Message_Parse(uint32_t variablesCount, const struct NumJS_VariableDescriptor descriptors[static variablesCount], struct NumJS_Variable variables[static variablesCount], struct PP_Var request);
void NumJS_Message_FreeVariables(uint32_t variablesCount, struct NumJS_Variable variables[static variablesCount]);

bool NumJS_Message_SetStatus(struct PP_Var response, enum NumJS_Error error);
inline void NumJS_Message_RemoveStatus(struct PP_Var response) {
	dictionaryInterface->Delete(response, NumJS_StringVariables[NumJS_StringVariable_Status]);
}