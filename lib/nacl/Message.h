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

enum FJS_ArgumentType {
	FJS_ArgumentType_Int32,
	FJS_ArgumentType_Float64,
	FJS_ArgumentType_Boolean,
	FJS_ArgumentType_DataType,
	FJS_ArgumentType_Buffer,
	FJS_ArgumentType_Shape
};

struct FJS_ArgumentDescriptor {
	enum FJS_ArgumentType type;
	enum FJS_StringVariable name;
	size_t offset;
};

enum FJS_Error FJS_Message_Dispatch(PP_Instance instance,
	enum FJS_Command command,
	size_t variablesSize,
	size_t variablesCount,
	const struct FJS_ArgumentDescriptor descriptors[static variablesCount],
	size_t cleanupEntries,
	const enum FJS_StringVariable cleanupNames[static cleanupEntries],
	struct PP_Var request,
	struct PP_Var response,
	FJS_Execute_Function executeFunction);

bool FJS_Message_SetStatus(PP_Instance instance, struct PP_Var response, enum FJS_Error error);
void FJS_Message_ClearStatus(struct PP_Var response, enum FJS_Error error);
