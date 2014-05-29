#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "Error.h"
#include "DataType.h"
#include "NDArray.h"
#include "Commands.h"
#include "Interfaces.h"
#include "Message.h"
#include "Strings.h"
#include "IdMap.h"
#include "Util.h"


enum NumJS_Create_Argument {
	NumJS_Create_Argument_Out,
	NumJS_Create_Argument_DataType,
	NumJS_Create_Argument_Shape
};

static const struct NumJS_VariableDescriptor createDescriptors[] =
{
	[NumJS_Create_Argument_Out] = { 
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_Out
	},
	[NumJS_Create_Argument_DataType] = {
		.type = NumJS_VariableType_DataType,
		.name = NumJS_StringVariable_Datatype
	},
	[NumJS_Create_Argument_Shape] = {
		.type = NumJS_VariableType_Buffer,
		.name = NumJS_StringVariable_Shape
	}
};

void NumJS_Parse_Create(PP_Instance instance, struct PP_Var message) {
	struct NumJS_Variable variables[NUMJS_COUNT_OF(createDescriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(createDescriptors), createDescriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error in GET-BUFFER");
		goto cleanup;
	}

	error = NumJS_Execute_Create(instance,
		variables[NumJS_Create_Argument_Out].parsedValue.asInt32,
		variables[NumJS_Create_Argument_Shape].parsedValue.asBuffer.size / 4,
		variables[NumJS_Create_Argument_Shape].parsedValue.asBuffer.pointer,
		variables[NumJS_Create_Argument_DataType].parsedValue.asDatatype);
	if (!NumJS_Message_SetStatus(NumJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, NumJS_ResponseVariable);

	NumJS_Message_RemoveStatus(NumJS_ResponseVariable);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

enum NumJS_CreateFromBuffer_Argument {
	NumJS_CreateFromBuffer_Argument_Out,
	NumJS_CreateFromBuffer_Argument_DataType,
	NumJS_CreateFromBuffer_Argument_Shape,
	NumJS_CreateFromBuffer_Argument_Buffer
};

static const struct NumJS_VariableDescriptor createFromBufferDescriptors[] =
{
	[NumJS_CreateFromBuffer_Argument_Out] = { 
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_Out
	},
	[NumJS_CreateFromBuffer_Argument_DataType] = {
		.type = NumJS_VariableType_DataType,
		.name = NumJS_StringVariable_Datatype
	},
	[NumJS_CreateFromBuffer_Argument_Shape] = {
		.type = NumJS_VariableType_Buffer,
		.name = NumJS_StringVariable_Shape
	},
	[NumJS_CreateFromBuffer_Argument_Buffer] = {
		.type = NumJS_VariableType_Buffer,
		.name = NumJS_StringVariable_Buffer
	}
};

void NumJS_Parse_CreateFromBuffer(PP_Instance instance, struct PP_Var message) {
	struct NumJS_Variable variables[NUMJS_COUNT_OF(createFromBufferDescriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(createFromBufferDescriptors), createFromBufferDescriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error in GET-BUFFER");
		goto cleanup;
	}

	error = NumJS_Execute_CreateFromBuffer(instance,
		variables[NumJS_CreateFromBuffer_Argument_Out].parsedValue.asInt32,
		variables[NumJS_CreateFromBuffer_Argument_Shape].parsedValue.asBuffer.size / 4,
		variables[NumJS_CreateFromBuffer_Argument_Shape].parsedValue.asBuffer.pointer,
		variables[NumJS_CreateFromBuffer_Argument_DataType].parsedValue.asDatatype,
		variables[NumJS_CreateFromBuffer_Argument_Buffer].parsedValue.asBuffer.size,
		variables[NumJS_CreateFromBuffer_Argument_Buffer].parsedValue.asBuffer.pointer);
	if (!NumJS_Message_SetStatus(NumJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, NumJS_ResponseVariable);

	NumJS_Message_RemoveStatus(NumJS_ResponseVariable);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

enum NumJS_Error NumJS_Execute_Create(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum NumJS_DataType datatype) {
	if (dimensions == 0) {
		return NumJS_Error_EmptyShape;
	}
	const uint32_t elementSize = NumJS_DataType_GetSize(datatype);
	if (elementSize == 0) {
		return NumJS_Error_InvalidDataType;
	}
	uint32_t length = 1;
	for (uint32_t dimension = 0; dimension < dimensions; dimension++) {
		const uint32_t measure = shape[dimension];
		if (measure < 1) {
			return NumJS_Error_DegenerateShape;
		}
		/* This multiplication can easily overflow */
		if (!NumJS_Util_Mul32u(length, measure, &length)) {
			return NumJS_Error_LengthOverflow;
		}
	}
	uint32_t size;
	if (!NumJS_Util_Mul32u(length, elementSize, &size)) {
		return NumJS_Error_SizeOverflow;
	}

	struct NDArray* array = NumJS_NDArray_Create(dimensions, length, shape, datatype);
	if (array == NULL) {
		return NumJS_Error_OutOfMemory;
	}

	memset(NumJS_NDArray_GetData(array), 0, size);

	NumJS_AllocateId(instance, idOut, array);
	return NumJS_Error_Ok;
}

enum NumJS_Error NumJS_Execute_CreateFromBuffer(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum NumJS_DataType datatype, uint32_t bufferSize, void* buffer) {
	if (dimensions == 0) {
		return NumJS_Error_EmptyShape;
	}
	const uint32_t elementSize = NumJS_DataType_GetSize(datatype);
	if (elementSize == 0) {
		return NumJS_Error_InvalidDataType;
	}
	uint32_t length = 1;
	for (uint32_t dimension = 0; dimension < dimensions; dimension++) {
		const uint32_t measure = shape[dimension];
		if (measure < 1) {
			return NumJS_Error_DegenerateShape;
		}
		/* This multiplication can easily overflow */
		if (!NumJS_Util_Mul32u(length, measure, &length)) {
			return NumJS_Error_LengthOverflow;
		}
	}
	uint32_t size;
	if (!NumJS_Util_Mul32u(length, elementSize, &size)) {
		return NumJS_Error_SizeOverflow;
	}
	if (size != bufferSize) {
		return NumJS_Error_IncompatibleBufferSize;
	}

	struct NDArray* array = NumJS_NDArray_Create(dimensions, length, shape, datatype);
	if (array == NULL) {
		return NumJS_Error_OutOfMemory;
	}

	memcpy(NumJS_NDArray_GetData(array), buffer, bufferSize);

	NumJS_AllocateId(instance, idOut, array);
	return NumJS_Error_Ok;
}
