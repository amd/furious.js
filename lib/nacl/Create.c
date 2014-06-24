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

typedef void (*StepInitFunction)(int32_t, double, double, void*);
static void initLinearF32(int32_t samples, double start, double step, float dataOut[restrict static samples]);
static void initLinearF64(int32_t samples, double start, double step, double dataOut[restrict static samples]);

static const StepInitFunction stepInitFunctions[] = {
	[FJS_DataType_F64] = (StepInitFunction) initLinearF64,
	[FJS_DataType_F32] = (StepInitFunction) initLinearF32
};

enum FJS_Empty_Argument {
	FJS_Empty_Argument_Out,
	FJS_Empty_Argument_DataType,
	FJS_Empty_Argument_Shape
};

static const struct FJS_VariableDescriptor emptyDescriptors[] =
{
	[FJS_Empty_Argument_Out] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Out
	},
	[FJS_Empty_Argument_DataType] = {
		.type = FJS_VariableType_DataType,
		.name = FJS_StringVariable_Datatype
	},
	[FJS_Empty_Argument_Shape] = {
		.type = FJS_VariableType_Buffer,
		.name = FJS_StringVariable_Shape
	}
};

void FJS_Parse_Empty(PP_Instance instance, struct PP_Var message) {
	struct FJS_Variable variables[FJS_COUNT_OF(emptyDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(emptyDescriptors), emptyDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = FJS_Execute_Empty(instance,
		variables[FJS_Empty_Argument_Out].parsedValue.asInt32,
		variables[FJS_Empty_Argument_Shape].parsedValue.asBuffer.size / 4,
		variables[FJS_Empty_Argument_Shape].parsedValue.asBuffer.pointer,
		variables[FJS_Empty_Argument_DataType].parsedValue.asDatatype);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

enum FJS_Array_Argument {
	FJS_Array_Argument_Out,
	FJS_Array_Argument_DataType,
	FJS_Array_Argument_Shape,
	FJS_Array_Argument_Buffer
};

static const struct FJS_VariableDescriptor arrayDescriptors[] =
{
	[FJS_Array_Argument_Out] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Out
	},
	[FJS_Array_Argument_DataType] = {
		.type = FJS_VariableType_DataType,
		.name = FJS_StringVariable_Datatype
	},
	[FJS_Array_Argument_Shape] = {
		.type = FJS_VariableType_Buffer,
		.name = FJS_StringVariable_Shape
	},
	[FJS_Array_Argument_Buffer] = {
		.type = FJS_VariableType_Buffer,
		.name = FJS_StringVariable_Buffer
	}
};

void FJS_Parse_Array(PP_Instance instance, struct PP_Var message) {
	struct FJS_Variable variables[FJS_COUNT_OF(arrayDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(arrayDescriptors), arrayDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = FJS_Execute_Array(instance,
		variables[FJS_Array_Argument_Out].parsedValue.asInt32,
		variables[FJS_Array_Argument_Shape].parsedValue.asBuffer.size / 4,
		variables[FJS_Array_Argument_Shape].parsedValue.asBuffer.pointer,
		variables[FJS_Array_Argument_DataType].parsedValue.asDatatype,
		variables[FJS_Array_Argument_Buffer].parsedValue.asBuffer.size,
		variables[FJS_Array_Argument_Buffer].parsedValue.asBuffer.pointer);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

enum FJS_LinSpace_Argument {
	FJS_LinSpace_Argument_Out,
	FJS_LinSpace_Argument_Start,
	FJS_LinSpace_Argument_Stop,
	FJS_LinSpace_Argument_Samples,
	FJS_LinSpace_Argument_Closed,
	FJS_LinSpace_Argument_DataType,
};

static const struct FJS_VariableDescriptor linspaceDescriptors[] =
{
	[FJS_LinSpace_Argument_Out] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Out
	},
	[FJS_LinSpace_Argument_Start] = { 
		.type = FJS_VariableType_Float64,
		.name = FJS_StringVariable_Start
	},
	[FJS_LinSpace_Argument_Stop] = {
		.type = FJS_VariableType_Float64,
		.name = FJS_StringVariable_Stop
	},
	[FJS_LinSpace_Argument_Samples] = {
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Samples
	},
	[FJS_LinSpace_Argument_Closed] = {
		.type = FJS_VariableType_Boolean,
		.name = FJS_StringVariable_Closed
	},
	[FJS_LinSpace_Argument_DataType] = {
		.type = FJS_VariableType_DataType,
		.name = FJS_StringVariable_Datatype
	}
};

void FJS_Parse_LinSpace(PP_Instance instance, struct PP_Var message) {
	struct FJS_Variable variables[FJS_COUNT_OF(linspaceDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(linspaceDescriptors), linspaceDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = FJS_Execute_LinSpace(instance,
		variables[FJS_LinSpace_Argument_Out].parsedValue.asInt32,
		variables[FJS_LinSpace_Argument_Start].parsedValue.asFloat64,
		variables[FJS_LinSpace_Argument_Stop].parsedValue.asFloat64,
		variables[FJS_LinSpace_Argument_Samples].parsedValue.asInt32,
		variables[FJS_LinSpace_Argument_Closed].parsedValue.asBoolean,
		variables[FJS_LinSpace_Argument_DataType].parsedValue.asDatatype);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

enum FJS_ReShape_Argument {
	FJS_ReShape_Argument_A,
	FJS_ReShape_Argument_Out,
	FJS_ReShape_Argument_Shape
};

static const struct FJS_VariableDescriptor reshapeDescriptors[] =
{
	[FJS_ReShape_Argument_A] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_A
	},
	[FJS_ReShape_Argument_Out] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Out
	},
	[FJS_ReShape_Argument_Shape] = {
		.type = FJS_VariableType_Buffer,
		.name = FJS_StringVariable_Shape
	},
};

void FJS_Parse_ReShape(PP_Instance instance, struct PP_Var message) {
	struct FJS_Variable variables[FJS_COUNT_OF(reshapeDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(reshapeDescriptors), reshapeDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = FJS_Execute_ReShape(instance,
		variables[FJS_ReShape_Argument_A].parsedValue.asInt32,
		variables[FJS_ReShape_Argument_Out].parsedValue.asInt32,
		variables[FJS_ReShape_Argument_Shape].parsedValue.asBuffer.size / 4,
		variables[FJS_ReShape_Argument_Shape].parsedValue.asBuffer.pointer);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

enum FJS_Repeat_Argument {
	FJS_Repeat_Argument_A,
	FJS_Repeat_Argument_Out,
	FJS_Repeat_Argument_Repeats,
	FJS_Repeat_Argument_Axis,
};

static const struct FJS_VariableDescriptor repeatDescriptors[] =
{
	[FJS_Repeat_Argument_A] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_A
	},
	[FJS_Repeat_Argument_Out] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Out
	},
	[FJS_Repeat_Argument_Repeats] = {
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Repeats
	},
	[FJS_Repeat_Argument_Axis] = {
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Axis
	},
};

void FJS_Parse_Repeat(PP_Instance instance, struct PP_Var message) {
	struct FJS_Variable variables[FJS_COUNT_OF(repeatDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(repeatDescriptors), repeatDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = FJS_Execute_Repeat(instance,
		variables[FJS_Repeat_Argument_A].parsedValue.asInt32,
		variables[FJS_Repeat_Argument_Out].parsedValue.asInt32,
		variables[FJS_Repeat_Argument_Repeats].parsedValue.asInt32,
		variables[FJS_Repeat_Argument_Axis].parsedValue.asInt32);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

enum FJS_Error FJS_Execute_Empty(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum FJS_DataType datatype) {
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

enum FJS_Error FJS_Execute_Array(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum FJS_DataType datatype, uint32_t bufferSize, void* buffer) {
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

enum FJS_Error FJS_Execute_LinSpace(PP_Instance instance, int32_t idOut, double start, double stop, int32_t samples, bool closed, enum FJS_DataType dataType) {
	/* Check that the number of samples is sane */
	if (samples <= 0) {
		return FJS_Error_InvalidLength;
	}
	if (closed && (samples == 1)) {
		return FJS_Error_InvalidLength;
	}

	/* Check that the data type is supported and choose the initialization function for this data type */
	StepInitFunction initFunction;
	switch (dataType) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			initFunction = stepInitFunctions[dataType];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	/* Define parameters for the output array */
	const uint32_t length = samples;
	const uint32_t shape[1] = { samples };
	const uint32_t dimensions = 1;

	/* Create output array */
	struct NDArray* array = FJS_NDArray_Create(dimensions, length, shape, dataType);
	if (array == NULL) {
		return FJS_Error_OutOfMemory;
	}

	/* Associate the output array with its id */
	FJS_AllocateId(instance, idOut, array);

	/* Do the initialization */
	void* data = FJS_NDArray_GetData(array);
	const double range = stop - start;
	const double step = range / ((closed) ? samples - 1 : samples);
	initFunction(samples, start, step, data);

	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_ReShape(PP_Instance instance, int32_t idA, int32_t idOut, size_t dimensionsOut, uint32_t shapeOut[static dimensionsOut]) {
	/* Validate the id for input array A and get NDArray object for array A */
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, idA);
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	/* Load information on the input array */
	uint32_t* shapeA = FJS_NDArray_GetShape(arrayA);
	const uint32_t lengthA = arrayA->length;
	const uint32_t dimensionsA = arrayA->dimensions;
	const void* dataA = FJS_NDArray_GetData(arrayA);
	const enum FJS_DataType dataTypeA = arrayA->dataType;
	const size_t elementSizeA = FJS_DataType_GetSize(dataTypeA);

	/* Compute the length of the new array */
	uint32_t lengthOut = 1;
	for (uint32_t dimension = 0; dimension < dimensionsOut; dimension++) {
		const uint32_t measure = shapeOut[dimension];
		if (measure < 1) {
			return FJS_Error_DegenerateShape;
		}
		/* This multiplication can easily overflow */
		if (!FJS_Util_Mul32u(lengthOut, measure, &lengthOut)) {
			return FJS_Error_LengthOverflow;
		}
	}

	/* Check that the length does not change */
	if (lengthOut != lengthA) {
		return FJS_Error_MismatchingLength;
	}

	/*
	 * Pointer to the old output array.
	 * If it is non-null, the output array must be deleted and de-associated from id if the function finishes successfully
	 */
	struct NDArray* arrayOutOld = NULL;

	/* Short-cut: if input and output arrays and the number of dimensions are the same, only change array shape */
	if (idOut == idA) {
		if (dimensionsOut == dimensionsA) {
			memcpy(shapeA, shapeOut, dimensionsA * sizeof(uint32_t));
			return FJS_Error_Ok;
		} else {
			arrayOutOld = arrayA;
		}
	} else {
		/*
		 * Try to get NDArray for the provided output id.
		 * If there is an NDArray associated with the supplied id, validate it.
		 * Note that currently this array is not used for output, but recreated again with target parameters.
		 */
		arrayOutOld = FJS_GetPointerFromId(instance, idOut);
		if (arrayOutOld != NULL) {
			/* Check that the output array has expected length */
			if (arrayOutOld->length != lengthOut) {
				return FJS_Error_MismatchingLength;
			}

			/* Check that the output array matches the data type of the input array */
			if (arrayOutOld->dataType != dataTypeA) {
				return FJS_Error_MismatchingDataType;
			}
		}
	}

	/* Create an output array with the required parameters */
	const enum FJS_DataType dataTypeOut = dataTypeA;
	struct NDArray* arrayOut = FJS_NDArray_Create(dimensionsOut, lengthOut, shapeOut, dataTypeOut);
	if (arrayOut == NULL) {
		return FJS_Error_OutOfMemory;
	}

	/* Copy data to the output array */
	void* dataOut = FJS_NDArray_GetData(arrayOut);
	memcpy(dataOut, dataA, lengthA * elementSizeA);

	/*
	 * At this point the command cannot fail.
	 * If needed, delete the old output array.
	 * Note that it may be the same as input array
	 * (thus we should not delete it before we copy the data, as in previous statement).
	 */
	if (arrayOutOld != NULL) {
		FJS_ReleaseId(instance, idOut);
		FJS_NDArray_Delete(arrayOutOld);
	}

	/* Associate the (new) output array with output id */
	FJS_AllocateId(instance, idOut, arrayOut);

	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_Repeat(PP_Instance instance, int32_t idA, int32_t idOut, int32_t repeats, int32_t axis) {
	/* Validate the id for input array A and get NDArray object for array A */
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, idA);
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	/* Load information on the input array */
	uint32_t* shapeA = FJS_NDArray_GetShape(arrayA);
	const uint32_t lengthA = arrayA->length;
	const uint32_t dimensionsA = arrayA->dimensions;
	const double* dataA = FJS_NDArray_GetData(arrayA);
	const enum FJS_DataType dataTypeA = arrayA->dataType;
	const size_t elementSizeA = FJS_DataType_GetSize(dataTypeA);

	/* Validate axis. Note that this check always fails if dimensionsA == 0. */
	if ((axis < 0) || (axis >= dimensionsA)) {
		return FJS_Error_AxisOutOfRange;
	}

	/* Validate repeats count */
	if (repeats <= 1) {
		return FJS_Error_RepeatsOutOfRange;
	}

	/* Compute the length of the new array */
	uint32_t lengthOut = lengthA;
	if (!FJS_Util_Mul32u(lengthOut, (uint32_t) repeats, &lengthOut)) {
		/* This multiplication overflowed */
		return FJS_Error_LengthOverflow;
	}

	/*
	 * Try to get NDArray for the provided output id.
	 * If there is an NDArray associated with the supplied id, validate it.
	 */
	struct NDArray* arrayOut = FJS_GetPointerFromId(instance, idOut);
	size_t outerStride = 1, innerStride = 1, repeatLengthA, repeatLengthOut;
	if (arrayOut != NULL) {
		/* Check that the output array matches the data type of the input array */
		if (arrayOut->dataType != dataTypeA) {
			return FJS_Error_MismatchingDataType;
		}

		/* Check that the output array has expected length */
		if (arrayOut->length != lengthOut) {
			return FJS_Error_MismatchingLength;
		}

		/* Check that the output array has expected number of dimensions */
		if (arrayOut->dimensions != dimensionsA) {
			return FJS_Error_MismatchingDimensions;
		}

		/* Check that the output array has expected shape and compute strides */
		const uint32_t* shapeOut = FJS_NDArray_GetShape(arrayOut);
		for (size_t i = 0; i < (size_t) axis; i++) {
			const size_t sizeOut = shapeOut[i];
			if (sizeOut != shapeA[i]) {
				return FJS_Error_MismatchingShape;
			}
			outerStride *= sizeOut;
		}
		{
			repeatLengthOut = shapeOut[(uint32_t) axis];
			repeatLengthA = shapeA[(uint32_t) axis];
			if (repeatLengthOut != repeatLengthA * ((uint32_t) repeats)) {
				return FJS_Error_MismatchingShape;
			}
		}
		for (size_t i = (size_t) axis; i < dimensionsA; i++) {
			const size_t sizeOut = shapeOut[i];
			if (sizeOut != shapeA[i]) {
				return FJS_Error_MismatchingShape;
			}
			innerStride *= sizeOut;
		}
	} else {
		/* Initialize the parameters for the output array */
		const enum FJS_DataType dataTypeOut = dataTypeA;
		const size_t dimensionsOut = dimensionsA;

		/* Initialize the shape for the output array and compute strides */
		uint32_t shapeOut[dimensionsA];
		for (size_t i = 0; i < (size_t) axis; i++) {
			const size_t sizeA = shapeA[i];
			shapeOut[i] = sizeA;
			outerStride *= sizeA;
		}
		{
			repeatLengthA = shapeA[(uint32_t) axis];
			repeatLengthOut = repeatLengthA * ((uint32_t) repeats);
			shapeOut[(uint32_t) axis] = repeatLengthOut;
		}
		for (size_t i = (size_t) (axis + 1); i < dimensionsA; i++) {
			const size_t sizeA = shapeA[i];
			shapeOut[i] = sizeA;
			innerStride *= sizeA;
		}

		/* Create output array */
		arrayOut = FJS_NDArray_Create(dimensionsOut, lengthOut, shapeOut, dataTypeOut);
		if (arrayOut == NULL) {
			return FJS_Error_OutOfMemory;
		}

		/* Associate the output array with its id */
		FJS_AllocateId(instance, idOut, arrayOut);
	}

	/* Do the computation */
	double* dataOut = FJS_NDArray_GetData(arrayOut);
	for (size_t i = 0; i < outerStride; i++) {
		for (size_t j = 0; j < repeatLengthA; j++) {
			for (size_t k = 0; k < innerStride; k++) {
				size_t valueA = dataA[(i * repeatLengthA + j) * innerStride + k];
				for (size_t c = 0; c < repeats; c++) {
					dataOut[((i * repeatLengthA + j) * repeats + c) * innerStride + k] = valueA;
				}
			}
		}
	}

	return FJS_Error_Ok;
}

static void initLinearF32(int32_t samples, double start, double step, float dataOut[restrict static samples]) {
	const float startF32 = start;
	const float stepF32 = step;
	for (int32_t i = 0; i < samples; i++) {
		*dataOut++ = startF32 + stepF32 * ((float) i);
	}
}

static void initLinearF64(int32_t samples, double start, double step, double dataOut[restrict static samples]) {
	for (int32_t i = 0; i < samples; i++) {
		*dataOut++ = start + step * ((double) i);
	}
}
