#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "Error.h"
#include "DataType.h"
#include "NDArray.h"
#include "Commands.h"
#include "Interfaces.h"
#include "Strings.h"
#include "IdMap.h"
#include "Util.h"

typedef void (*ConstInitFunction)(uint32_t, double, void*);
static void initConstF32(uint32_t length, double fillValue, float dataOut[restrict static length]);
static void initConstF64(uint32_t length, double fillValue, double dataOut[restrict static length]);

typedef void (*StepInitFunction)(uint32_t, double, double, void*);
static void initLinearF32(uint32_t samples, double start, double step, float dataOut[restrict static samples]);
static void initLinearF64(uint32_t samples, double start, double step, double dataOut[restrict static samples]);

typedef void (*IdentityInitFunction)(uint32_t, uint32_t, int32_t, void*, double);
static void initIdentityF32(uint32_t rows, uint32_t columns, int32_t diagonal, float data[restrict static rows*columns], double diagonalValue);
static void initIdentityF64(uint32_t rows, uint32_t columns, int32_t diagonal, double data[restrict static rows*columns], double diagonalValue);

static const ConstInitFunction constInitFunctions[] = {
	[FJS_DataType_F64] = (ConstInitFunction) initConstF64,
	[FJS_DataType_F32] = (ConstInitFunction) initConstF32
};

static const StepInitFunction stepInitFunctions[] = {
	[FJS_DataType_F64] = (StepInitFunction) initLinearF64,
	[FJS_DataType_F32] = (StepInitFunction) initLinearF32
};

static const IdentityInitFunction identityInitFunctions[] = {
	[FJS_DataType_F64] = (IdentityInitFunction) initIdentityF64,
	[FJS_DataType_F32] = (IdentityInitFunction) initIdentityF32
};

enum FJS_Error FJS_Execute_CreateEmptyArray(PP_Instance instance,
	uint32_t idOut,
	struct FJS_Shape shape,
	enum FJS_DataType dataType)
{
	const uint32_t elementSize = FJS_DataType_GetSize(dataType);
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

	struct NDArray* array = FJS_NDArray_Create(shape.dimensions, length, shape.buffer, dataType);
	if (array == NULL) {
		return FJS_Error_OutOfMemory;
	}

	FJS_AllocateId(instance, idOut, array);
	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_CreateConstArray(PP_Instance instance,
	uint32_t idOut,
	struct FJS_Shape shape,
	enum FJS_DataType dataType,
	double fillValue)
{
	const uint32_t elementSize = FJS_DataType_GetSize(dataType);
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

	if ((uint32_t) dataType >= FJS_DataType_Max) {
		return FJS_Error_InvalidDataType;
	}
	const ConstInitFunction initFunction = constInitFunctions[dataType];
	if (initFunction == NULL) {
		return FJS_Error_InvalidDataType;
	}

	struct NDArray* arrayOut = FJS_NDArray_Create(shape.dimensions, length, shape.buffer, dataType);
	if (arrayOut == NULL) {
		return FJS_Error_OutOfMemory;
	}

	void* dataOut = FJS_NDArray_GetData(arrayOut);
	initFunction(length, fillValue, dataOut);

	FJS_AllocateId(instance, idOut, arrayOut);
	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_CreateDataArray(PP_Instance instance,
	uint32_t idOut,
	struct FJS_Shape shape,
	enum FJS_DataType dataType,
	struct FJS_Buffer dataBuffer)
{
	if (shape.dimensions == 0) {
		return FJS_Error_EmptyShape;
	}
	const uint32_t elementSize = FJS_DataType_GetSize(dataType);
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
	if (size != dataBuffer.size) {
		return FJS_Error_IncompatibleBufferSize;
	}

	struct NDArray* arrayOut = FJS_NDArray_Create(shape.dimensions, length, shape.buffer, dataType);
	if (arrayOut == NULL) {
		return FJS_Error_OutOfMemory;
	}

	void* dataOut = FJS_NDArray_GetData(arrayOut);
	memcpy(dataOut, dataBuffer.pointer, dataBuffer.size);

	FJS_AllocateId(instance, idOut, arrayOut);
	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_CreateIdentityMatrix(PP_Instance instance,
	uint32_t idOut,
	uint32_t rows,
	uint32_t columns,
	int32_t diagonal,
	enum FJS_DataType dataType)
{
	/* Validate the shape of the new array */
	if (rows == 0) {
		return FJS_Error_DegenerateShape;
	}
	if (columns == 0) {
		return FJS_Error_DegenerateShape;
	}

	/* Validate the diagonal argument */
	if ((diagonal > 0) && ((uint32_t) diagonal >= columns)) {
		return FJS_Error_DiagonalOutOfRange;
	}
	if ((diagonal < 0) && ((uint32_t) (-diagonal) >= rows)) {
		return FJS_Error_DiagonalOutOfRange;
	}

	/* Check that the data type is supported and choose the initialization function for this data type */
	IdentityInitFunction initFunction;
	switch (dataType) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			initFunction = identityInitFunctions[dataType];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	/* Define parameters for the output array */
	const uint32_t lengthOut = rows * columns;
	const uint32_t shapeOut[2] = { rows, columns };
	const uint32_t dimensionsOut = 2;

	/* Create output array */
	struct NDArray* arrayOut = FJS_NDArray_Create(dimensionsOut, lengthOut, shapeOut, dataType);
	if (arrayOut == NULL) {
		return FJS_Error_OutOfMemory;
	}

	/* Associate the output array with its id */
	FJS_AllocateId(instance, idOut, arrayOut);

	/* Do the initialization */
	void* dataOut = FJS_NDArray_GetData(arrayOut);
	memset(dataOut, 0, lengthOut * FJS_DataType_GetSize(dataType));
	initFunction(rows, columns, diagonal, dataOut, 1.0);

	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_LinSpace(PP_Instance instance,
	uint32_t idOut,
	double start,
	double stop,
	uint32_t samples,
	bool closed,
	enum FJS_DataType dataType)
{
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
	const uint32_t lengthOut = samples;
	const uint32_t shapeOut[1] = { samples };
	const uint32_t dimensionsOut = 1;

	/* Create output array */
	struct NDArray* arrayOut = FJS_NDArray_Create(dimensionsOut, lengthOut, shapeOut, dataType);
	if (arrayOut == NULL) {
		return FJS_Error_OutOfMemory;
	}

	/* Associate the output array with its id */
	FJS_AllocateId(instance, idOut, arrayOut);

	/* Do the initialization */
	void* dataOut = FJS_NDArray_GetData(arrayOut);
	const double range = stop - start;
	const double step = range / ((double) ((closed) ? samples - 1 : samples));
	initFunction(samples, start, step, dataOut);

	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_ReShape(PP_Instance instance,
	int32_t idA,
	uint32_t idOut,
	struct FJS_Shape shapeOut)
{
	/* Validate the id for input array A and get NDArray object for array A */
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, __builtin_abs(idA));
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
	if (idOut == idA) {
		struct NDArray* arrayOut = FJS_NDArray_ReShape(arrayA, shapeOut.dimensions, shapeOut.buffer);
		if (arrayOut == NULL) {
			/* If re-allocation failed, then arrayA (associated with idA) is not a valid pointer */
			FJS_ReleaseId(instance, idA);
			return FJS_Error_OutOfMemory;
		}

		/* If array was moved to a new address, we have to re-bind the id */
		if (arrayOut != arrayA) {
			FJS_ReleaseId(instance, idA);
			FJS_AllocateId(instance, idOut, arrayOut);
		}

		/* Input array never needs to be de-allocated in this case */
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
	}

	/* De-allocate input array if needed */
	if (idA < 0) {
		FJS_NDArray_Delete(arrayA);
		FJS_ReleaseId(instance, __builtin_abs(idA));
	}

	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_Repeat(PP_Instance instance,
	int32_t idA,
	uint32_t idOut,
	uint32_t repeats,
	uint32_t axis)
{
	/* Validate the id for input array A and get NDArray object for array A */
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, __builtin_abs(idA));
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
	if (axis >= dimensionsA) {
		return FJS_Error_AxisOutOfRange;
	}

	/* Validate repeats count */
	if (repeats <= 1) {
		return FJS_Error_RepeatsOutOfRange;
	}

	/* Compute the length of the new array */
	uint32_t lengthOut = lengthA;
	if (!FJS_Util_Mul32u(lengthOut, repeats, &lengthOut)) {
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
		for (size_t i = 0; i < axis; i++) {
			const size_t sizeOut = shapeOut[i];
			if (sizeOut != shapeA[i]) {
				return FJS_Error_MismatchingShape;
			}
			outerStride *= sizeOut;
		}
		{
			repeatLengthOut = shapeOut[axis];
			repeatLengthA = shapeA[axis];
			if (repeatLengthOut != repeatLengthA * repeats) {
				return FJS_Error_MismatchingShape;
			}
		}
		for (size_t i = axis; i < dimensionsA; i++) {
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
		for (size_t i = 0; i < axis; i++) {
			const size_t sizeA = shapeA[i];
			shapeOut[i] = sizeA;
			outerStride *= sizeA;
		}
		{
			repeatLengthA = shapeA[axis];
			repeatLengthOut = repeatLengthA * repeats;
			shapeOut[axis] = repeatLengthOut;
		}
		for (size_t i = axis + 1; i < dimensionsA; i++) {
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

	/* De-allocate input array if needed */
	if (idA < 0) {
		FJS_NDArray_Delete(arrayA);
		FJS_ReleaseId(instance, __builtin_abs(idA));
	}

	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_DeAllocate(PP_Instance instance, int32_t idA) {
	struct NDArray* array = FJS_GetPointerFromId(instance, idA);
	if (array == NULL) {
		return FJS_Error_InvalidId;
	} else {
		FJS_NDArray_Delete(array);
		FJS_ReleaseId(instance, idA);
		return FJS_Error_Ok;
	}
}

enum FJS_Error FJS_Execute_Fetch(PP_Instance instance, int32_t idA, struct FJS_Buffer buffer[restrict static 1]) {
	struct NDArray* array = FJS_GetPointerFromId(instance, __builtin_abs(idA));
	if (array == NULL) {
		return FJS_Error_InvalidId;
	}

	const uint32_t elementSize = FJS_DataType_GetSize(array->dataType);
	if (elementSize == 0) {
		return FJS_Error_InvalidDataType;
	}

	buffer->pointer = FJS_NDArray_GetData(array);
	buffer->size = elementSize * array->length;

	/* De-allocate input array if needed */
	// if (idA < 0) {
	// 	FJS_NDArray_Delete(array);
	// 	FJS_ReleaseId(instance, __builtin_abs(idA));
	// }

	return FJS_Error_Ok;
}

/*
enum FJS_Error FJS_Execute_Info(PP_Instance instance, const void* unused, struct PP_Var response[static 1]) {
	enum FJS_Error error = FJS_Error_Ok;

	if (dictionaryInterface->Set(*response,
		FJS_StringVariables[FJS_StringVariable_IDAllocations],
		PP_MakeInt32(FJS_ID_Allocations)) != PP_TRUE)
	{
		FJS_LOG_ERROR("Failed to set idAllocations");
		goto cleanup;
	}

	if (dictionaryInterface->Set(*response,
		FJS_StringVariables[FJS_StringVariable_ArrayAllocations],
		PP_MakeInt32(FJS_NDArray_Allocations)) != PP_TRUE)
	{
		FJS_LOG_ERROR("Failed to set arrayAllocations");
		goto cleanup;
	}

	if (dictionaryInterface->Set(*response,
		FJS_StringVariables[FJS_StringVariable_ByteAllocations],
		PP_MakeInt32(FJS_Byte_Allocations)) != PP_TRUE)
	{
		FJS_LOG_ERROR("Failed to set arrayAllocations");
		goto cleanup;
	}

cleanup:
	return error;
}
*/

static void initConstF32(uint32_t length, double fillValue, float dataOut[restrict static length]) {
	const float fillValueF32 = fillValue;
	for (uint32_t i = 0; i < length; i++) {
		*dataOut++ = fillValueF32;
	}
}

static void initConstF64(uint32_t length, double fillValue, double dataOut[restrict static length]) {
	for (uint32_t i = 0; i < length; i++) {
		*dataOut++ = fillValue;
	}
}

static void initLinearF32(uint32_t samples, double start, double step, float dataOut[restrict static samples]) {
	const float startF32 = start;
	const float stepF32 = step;
	for (uint32_t i = 0; i < samples; i++) {
		*dataOut++ = startF32 + stepF32 * ((float) i);
	}
}

static void initLinearF64(uint32_t samples, double start, double step, double dataOut[restrict static samples]) {
	for (uint32_t i = 0; i < samples; i++) {
		*dataOut++ = start + step * ((double) i);
	}
}

static void initIdentityF32(uint32_t rows, uint32_t columns, int32_t diagonal, float data[restrict static rows*columns], double diagonalValue) {
	const float diagonalValueF32 = diagonalValue;
	if (diagonal == 0) {
		const uint32_t imax = FJS_Util_Min32u(rows, columns);
		for (uint32_t i = 0; i < imax; ++i) {
			data[i*columns+i] = diagonalValueF32;
		}
	} else if (diagonal > 0) {
		const uint32_t imax = FJS_Util_Min32u(rows, columns - diagonal);
		for (uint32_t i = 0; i < imax; ++i) {
			data[i*columns+i+diagonal] = diagonalValueF32;
		}
	} else {
		const uint32_t imax = FJS_Util_Min32u(rows + diagonal, columns);
		for (uint32_t i = 0; i < imax; ++i) {
			data[(i - diagonal)*columns+i] = diagonalValueF32;
		}
	}
}

static void initIdentityF64(uint32_t rows, uint32_t columns, int32_t diagonal, double data[restrict static rows*columns], double diagonalValue) {
	if (diagonal == 0) {
		const uint32_t imax = FJS_Util_Min32u(rows, columns);
		for (uint32_t i = 0; i < imax; ++i) {
			data[i*columns+i] = diagonalValue;
		}
	} else if (diagonal > 0) {
		const uint32_t imax = FJS_Util_Min32u(rows, columns - diagonal);
		for (uint32_t i = 0; i < imax; ++i) {
			data[i*columns+i+diagonal] = diagonalValue;
		}
	} else {
		const uint32_t imax = FJS_Util_Min32u(rows + diagonal, columns);
		for (uint32_t i = 0; i < imax; ++i) {
			data[(i - diagonal)*columns+i] = diagonalValue;
		}
	}
}
