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

enum FJS_Error FJS_Execute_Empty(PP_Instance instance, const struct FJS_Empty_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	const struct FJS_Shape shape = arguments->shape;
	const uint32_t elementSize = FJS_DataType_GetSize(arguments->dataType);
	if (elementSize == 0) {
		return FJS_Error_InvalidDataType;
	}
	uint32_t length = 1;
	for (uint32_t dimension = 0; dimension < shape.dimensions; dimension++) {
		const uint32_t measure = shape.buffer[dimension];
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

	struct NDArray* array = FJS_NDArray_Create(shape.dimensions, length, shape.buffer, arguments->dataType);
	if (array == NULL) {
		return FJS_Error_OutOfMemory;
	}

	FJS_AllocateId(instance, arguments->idOut, array);
	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_Zeros(PP_Instance instance, const struct FJS_Zeros_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	const struct FJS_Shape shape = arguments->shape;
	const uint32_t elementSize = FJS_DataType_GetSize(arguments->dataType);
	if (elementSize == 0) {
		return FJS_Error_InvalidDataType;
	}
	uint32_t length = 1;
	for (uint32_t dimension = 0; dimension < shape.dimensions; dimension++) {
		const uint32_t measure = shape.buffer[dimension];
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

	struct NDArray* array = FJS_NDArray_Create(shape.dimensions, length, shape.buffer, arguments->dataType);
	if (array == NULL) {
		return FJS_Error_OutOfMemory;
	}

	memset(FJS_NDArray_GetData(array), 0, size);

	FJS_AllocateId(instance, arguments->idOut, array);
	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_Ones(PP_Instance instance, const struct FJS_Ones_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	const struct FJS_Shape shape = arguments->shape;
	const uint32_t elementSize = FJS_DataType_GetSize(arguments->dataType);
	if (elementSize == 0) {
		return FJS_Error_InvalidDataType;
	}
	uint32_t length = 1;
	for (uint32_t dimension = 0; dimension < shape.dimensions; dimension++) {
		const uint32_t measure = shape.buffer[dimension];
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

	const enum FJS_DataType dataType = arguments->dataType;
	struct NDArray* array = FJS_NDArray_Create(shape.dimensions, length, shape.buffer, dataType);
	if (array == NULL) {
		return FJS_Error_OutOfMemory;
	}

	void* data = FJS_NDArray_GetData(array);
	switch (dataType) {
	case FJS_DataType_F32:
		for (size_t i = 0; i < length; i++) {
			*((float*)data) = 1.0f;
			data += sizeof(float);
		}
		break;
	case FJS_DataType_F64:
		for (size_t i = 0; i < length; i++) {
			*((double*)data) = 1.0;
			data += sizeof(double);
		}
		break;
	default:
		__builtin_unreachable();
	}

	FJS_AllocateId(instance, arguments->idOut, array);
	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_Array(PP_Instance instance, const struct FJS_Array_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	const struct FJS_Shape shape = arguments->shape;
	if (shape.dimensions == 0) {
		return FJS_Error_EmptyShape;
	}
	const uint32_t elementSize = FJS_DataType_GetSize(arguments->dataType);
	if (elementSize == 0) {
		return FJS_Error_InvalidDataType;
	}
	uint32_t length = 1;
	for (uint32_t dimension = 0; dimension < shape.dimensions; dimension++) {
		const uint32_t measure = shape.buffer[dimension];
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
	const struct FJS_Buffer buffer = arguments->buffer;
	if (size != buffer.size) {
		return FJS_Error_IncompatibleBufferSize;
	}

	struct NDArray* array = FJS_NDArray_Create(shape.dimensions, length, shape.buffer, arguments->dataType);
	if (array == NULL) {
		return FJS_Error_OutOfMemory;
	}

	memcpy(FJS_NDArray_GetData(array), buffer.pointer, buffer.size);

	FJS_AllocateId(instance, arguments->idOut, array);
	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_LinSpace(PP_Instance instance, const struct FJS_LinSpace_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	/* Check that the number of samples is sane */
	const int32_t samples = arguments->samples;
	if (samples <= 0) {
		return FJS_Error_InvalidLength;
	}
	const bool closed = arguments->closed;
	if (closed && (samples == 1)) {
		return FJS_Error_InvalidLength;
	}

	/* Check that the data type is supported and choose the initialization function for this data type */
	const enum FJS_DataType dataType = arguments->dataType;
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
	const uint32_t length = arguments->samples;
	const uint32_t shape[1] = { arguments->samples };
	const uint32_t dimensions = 1;

	/* Create output array */
	struct NDArray* array = FJS_NDArray_Create(dimensions, length, shape, dataType);
	if (array == NULL) {
		return FJS_Error_OutOfMemory;
	}

	/* Associate the output array with its id */
	FJS_AllocateId(instance, arguments->idOut, array);

	/* Do the initialization */
	void* data = FJS_NDArray_GetData(array);
	const double start = arguments->start;
	const double stop = arguments->stop;
	const double range = stop - start;
	const double step = range / ((closed) ? samples - 1 : samples);
	initFunction(samples, start, step, data);

	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_ReShape(PP_Instance instance, const struct FJS_ReShape_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	/* Validate the id for input array A and get NDArray object for array A */
	const int32_t idA = arguments->idA;
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
	const struct FJS_Shape shapeOut = arguments->shapeOut;
	for (uint32_t dimension = 0; dimension < shapeOut.dimensions; dimension++) {
		const uint32_t measure = shapeOut.buffer[dimension];
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

	/* Try short-cut: if input and output arrays are the same, only change array shape */
	const int32_t idOut = arguments->idOut;
	if (idOut == idA) {
		struct NDArray* arrayOut = FJS_NDArray_ReShape(arrayA, shapeOut.dimensions, shapeOut.buffer);
		if (arrayOut == NULL) {
			/* If re-allocation failed, then arrayA (associated with idA) is not a valid pointer */
			FJS_ReleaseId(instance, idA);
			return FJS_Error_OutOfMemory;
		}
		return FJS_Error_Ok;
	}

	/*
	 * Try to get NDArray for the provided output id.
	 * If there is an NDArray associated with the supplied id, validate it, reshape, and use the data buffer.
	 */
	struct NDArray* arrayOut = FJS_GetPointerFromId(instance, idOut);
	if (arrayOut != NULL) {
		/* Check that the output array has expected length */
		if (arrayOut->length != lengthOut) {
			return FJS_Error_MismatchingLength;
		}

		/* Check that the output array matches the data type of the input array */
		if (arrayOut->dataType != dataTypeA) {
			return FJS_Error_MismatchingDataType;
		}

		arrayOut = FJS_NDArray_ReShape(arrayOut, shapeOut.dimensions, shapeOut.buffer);
		if (arrayOut == NULL) {
			/* If re-allocation failed, then arrayOut (associated with idOut) is not a valid pointer */
			FJS_ReleaseId(instance, idOut);
			return FJS_Error_OutOfMemory;
		}

		/* Replace pointer associated with idOut */
		FJS_ReleaseId(instance, idOut);
		FJS_AllocateId(instance, idOut, arrayOut);

		/* Copy data to the output array */
		void* dataOut = FJS_NDArray_GetData(arrayOut);
		memcpy(dataOut, dataA, lengthA * elementSizeA);

		return FJS_Error_Ok;
	} else {
		/* Create an output array with the required parameters */
		const enum FJS_DataType dataTypeOut = dataTypeA;
		arrayOut = FJS_NDArray_Create(shapeOut.dimensions, lengthOut, shapeOut.buffer, dataTypeOut);
		if (arrayOut == NULL) {
			return FJS_Error_OutOfMemory;
		}

		/* Copy data to the output array */
		void* dataOut = FJS_NDArray_GetData(arrayOut);
		memcpy(dataOut, dataA, lengthA * elementSizeA);

		/* Associate the (new) output array with output id */
		FJS_AllocateId(instance, idOut, arrayOut);

		return FJS_Error_Ok;
	}
}

enum FJS_Error FJS_Execute_Repeat(PP_Instance instance, const struct FJS_Repeat_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	/* Validate the id for input array A and get NDArray object for array A */
	const int32_t idA = arguments->idA;
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
	const int32_t axis = arguments->axis;
	if ((axis < 0) || (axis >= dimensionsA)) {
		return FJS_Error_AxisOutOfRange;
	}

	/* Validate repeats count */
	const int32_t repeats = arguments->repeats;
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
	const int32_t idOut = arguments->idOut;
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
				double valueA = dataA[(i * repeatLengthA + j) * innerStride + k];
				for (size_t c = 0; c < repeats; c++) {
					dataOut[((i * repeatLengthA + j) * repeats + c) * innerStride + k] = valueA;
				}
			}
		}
	}

	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_Free(PP_Instance instance, const struct FJS_Free_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	const int32_t idA = arguments->idA;
	struct NDArray* array = FJS_GetPointerFromId(instance, idA);
	if (array == NULL) {
		return FJS_Error_InvalidId;
	} else {
		FJS_NDArray_Delete(array);
		return FJS_Error_Ok;
	}
}

enum FJS_Error FJS_Execute_Get(PP_Instance instance, const struct FJS_Get_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	enum FJS_Error error = FJS_Error_Ok;
	struct PP_Var bufferVar = PP_MakeUndefined();
	void* bufferPointer = NULL;

	const int32_t idA = arguments->idA;
	struct NDArray* array = FJS_GetPointerFromId(instance, idA);
	if (array == NULL) {
		error = FJS_Error_InvalidId;
		goto cleanup;
	}

	const uint32_t elementSize = FJS_DataType_GetSize(array->dataType);
	if (elementSize == 0) {
		error = FJS_Error_InvalidDataType;
		goto cleanup;
	}
	const uint32_t dataSize = elementSize * array->length;
	bufferVar = bufferInterface->Create(dataSize);
	bufferPointer = bufferInterface->Map(bufferVar);
	if (bufferPointer == NULL) {
		error = FJS_Error_OutOfMemory;
		goto cleanup;
	}

	memcpy(bufferPointer, FJS_NDArray_GetData(array), dataSize);

	if (dictionaryInterface->Set(*response, FJS_StringVariables[FJS_StringVariable_Buffer], bufferVar) != PP_TRUE) {
		FJS_LOG_ERROR("Failed to set buffer");
		goto cleanup;
	}

cleanup:
	if (bufferPointer != NULL) {
		bufferInterface->Unmap(bufferVar);
	}
	if (error != FJS_Error_Ok) {
		varInterface->Release(bufferVar);
	}
	return error;
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
