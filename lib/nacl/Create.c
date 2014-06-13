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


enum FJS_Create_Argument {
	FJS_Create_Argument_Out,
	FJS_Create_Argument_DataType,
	FJS_Create_Argument_Shape
};

static const struct FJS_VariableDescriptor createDescriptors[] =
{
	[FJS_Create_Argument_Out] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Out
	},
	[FJS_Create_Argument_DataType] = {
		.type = FJS_VariableType_DataType,
		.name = FJS_StringVariable_Datatype
	},
	[FJS_Create_Argument_Shape] = {
		.type = FJS_VariableType_Buffer,
		.name = FJS_StringVariable_Shape
	}
};

void FJS_Parse_Create(PP_Instance instance, struct PP_Var message) {
	struct FJS_Variable variables[FJS_COUNT_OF(createDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(createDescriptors), createDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = FJS_Execute_Create(instance,
		variables[FJS_Create_Argument_Out].parsedValue.asInt32,
		variables[FJS_Create_Argument_Shape].parsedValue.asBuffer.size / 4,
		variables[FJS_Create_Argument_Shape].parsedValue.asBuffer.pointer,
		variables[FJS_Create_Argument_DataType].parsedValue.asDatatype);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

enum FJS_CreateFromBuffer_Argument {
	FJS_CreateFromBuffer_Argument_Out,
	FJS_CreateFromBuffer_Argument_DataType,
	FJS_CreateFromBuffer_Argument_Shape,
	FJS_CreateFromBuffer_Argument_Buffer
};

static const struct FJS_VariableDescriptor createFromBufferDescriptors[] =
{
	[FJS_CreateFromBuffer_Argument_Out] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Out
	},
	[FJS_CreateFromBuffer_Argument_DataType] = {
		.type = FJS_VariableType_DataType,
		.name = FJS_StringVariable_Datatype
	},
	[FJS_CreateFromBuffer_Argument_Shape] = {
		.type = FJS_VariableType_Buffer,
		.name = FJS_StringVariable_Shape
	},
	[FJS_CreateFromBuffer_Argument_Buffer] = {
		.type = FJS_VariableType_Buffer,
		.name = FJS_StringVariable_Buffer
	}
};

void FJS_Parse_CreateFromBuffer(PP_Instance instance, struct PP_Var message) {
	struct FJS_Variable variables[FJS_COUNT_OF(createFromBufferDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(createFromBufferDescriptors), createFromBufferDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = FJS_Execute_CreateFromBuffer(instance,
		variables[FJS_CreateFromBuffer_Argument_Out].parsedValue.asInt32,
		variables[FJS_CreateFromBuffer_Argument_Shape].parsedValue.asBuffer.size / 4,
		variables[FJS_CreateFromBuffer_Argument_Shape].parsedValue.asBuffer.pointer,
		variables[FJS_CreateFromBuffer_Argument_DataType].parsedValue.asDatatype,
		variables[FJS_CreateFromBuffer_Argument_Buffer].parsedValue.asBuffer.size,
		variables[FJS_CreateFromBuffer_Argument_Buffer].parsedValue.asBuffer.pointer);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

enum FJS_Error FJS_Execute_Create(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum FJS_DataType datatype) {
	if (dimensions == 0) {
		return FJS_Error_EmptyShape;
	}
	const uint32_t elementSize = FJS_DataType_GetSize(datatype);
	if (elementSize == 0) {
		return FJS_Error_InvalidDataType;
	}
	uint32_t length = 1;
	for (uint32_t dimension = 0; dimension < dimensions; dimension++) {
		const uint32_t measure = shape[dimension];
		if (measure < 1) {
			return FJS_Error_DegenerateShape;
		}
		/* This multiplication can easily overflow */
		if (!FJS_Util_Mul32u(length, measure, &length)) {
			return FJS_Error_LengthOverflow;
		}
	}
	uint32_t size;
	if (!FJS_Util_Mul32u(length, elementSize, &size)) {
		return FJS_Error_SizeOverflow;
	}

	struct NDArray* array = FJS_NDArray_Create(dimensions, length, shape, datatype);
	if (array == NULL) {
		return FJS_Error_OutOfMemory;
	}

	memset(FJS_NDArray_GetData(array), 0, size);

	FJS_AllocateId(instance, idOut, array);
	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_CreateFromBuffer(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum FJS_DataType datatype, uint32_t bufferSize, void* buffer) {
	if (dimensions == 0) {
		return FJS_Error_EmptyShape;
	}
	const uint32_t elementSize = FJS_DataType_GetSize(datatype);
	if (elementSize == 0) {
		return FJS_Error_InvalidDataType;
	}
	uint32_t length = 1;
	for (uint32_t dimension = 0; dimension < dimensions; dimension++) {
		const uint32_t measure = shape[dimension];
		if (measure < 1) {
			return FJS_Error_DegenerateShape;
		}
		/* This multiplication can easily overflow */
		if (!FJS_Util_Mul32u(length, measure, &length)) {
			return FJS_Error_LengthOverflow;
		}
	}
	uint32_t size;
	if (!FJS_Util_Mul32u(length, elementSize, &size)) {
		return FJS_Error_SizeOverflow;
	}
	if (size != bufferSize) {
		return FJS_Error_IncompatibleBufferSize;
	}

	struct NDArray* array = FJS_NDArray_Create(dimensions, length, shape, datatype);
	if (array == NULL) {
		return FJS_Error_OutOfMemory;
	}

	memcpy(FJS_NDArray_GetData(array), buffer, bufferSize);

	FJS_AllocateId(instance, idOut, array);
	return FJS_Error_Ok;
}
