#include <malloc.h>
#include <string.h>
#include <stdbool.h>

#include "NDArray.h"
#include "Util.h"

int32_t FJS_NDArray_Allocations = 0;
int32_t FJS_Byte_Allocations = 0;

struct NDArray* FJS_NDArray_Create(uint32_t dimensions, uint32_t length, const uint32_t shape[static dimensions], enum FJS_DataType dataType) {
	const uint32_t elementSize = FJS_DataType_GetSize(dataType);
	/* This multiplication can overflow */
	uint32_t dataSize;
	if (!FJS_Util_Mul32u(length, elementSize, &dataSize)) {
		return NULL;
	}

	void* data = malloc(dataSize);
	if (data == NULL) {
		return NULL;
	}

	const uint32_t headerSize = sizeof(struct NDArray);
	const uint32_t shapeSize = dimensions * sizeof(uint32_t);
	const uint32_t arraySize = headerSize + shapeSize;

	struct NDArray* array = malloc(arraySize);
	if (array == NULL) {
		free(data);
		return NULL;
	}

	array->dataType = dataType;
	array->data = data;
	array->length = length;
	array->dimensions = dimensions;
	memcpy(FJS_NDArray_GetShape(array), shape, dimensions * sizeof(uint32_t));

	FJS_NDArray_Allocations += 1;

	return array;
}

struct NDArray* FJS_NDArray_ReShape(struct NDArray* array, uint32_t newDimensions, const uint32_t newShape[static newDimensions]) {
	/* If the number of dimensions is the same or smaller, simply overwrite the shape */
	if (newDimensions <= array->dimensions) {
		memcpy(FJS_NDArray_GetShape(array), newShape, newDimensions * sizeof(uint32_t));
		array->dimensions = newDimensions;
		return array;
	}

	const uint32_t headerSize = sizeof(struct NDArray);
	const uint32_t newShapeSize = newDimensions * sizeof(uint32_t);
	const uint32_t newArraySize = headerSize + newShapeSize;

	struct NDArray* newArray = realloc(array, newArraySize);
	if (newArray == NULL) {
		/* Out of memory: do clean-up */
		free(array->data);
		free(array);

		FJS_NDArray_Allocations -= 1;

		return NULL;
	}

	/* Copy shape */
	newArray->dimensions = newDimensions;
	memcpy(FJS_NDArray_GetShape(newArray), newShape, newDimensions * sizeof(uint32_t));

	return newArray;
}

void FJS_NDArray_Delete(struct NDArray* array) {
	free(array);
	FJS_NDArray_Allocations -= 1;
}
