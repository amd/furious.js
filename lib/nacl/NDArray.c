#include <malloc.h>
#include <string.h>

#include "NDArray.h"
#include "Util.h"

struct NDArray* FJS_NDArray_Create(uint32_t dimensions, uint32_t length, const uint32_t shape[static dimensions], enum FJS_DataType dataType) {
	const uint32_t headerSize = sizeof(struct NDArray);

	/* Round dimensions to the nearest even number so that the data is 8-byte aligned (malloc returns 8-byte aligned pointer) */
	const uint32_t paddedDimensions = (dimensions + 1) & -2;
	const uint32_t shapeSize = paddedDimensions * sizeof(uint32_t);

	const uint32_t elementSize = FJS_DataType_GetSize(dataType);
	/* This multiplication can easily overflow */
	uint32_t dataSize;
	if (!FJS_Util_Mul32u(length, elementSize, &dataSize)) {
		return NULL;
	}

	uint32_t arraySize = headerSize + shapeSize;
	/* This addition can overflow if dataSize is close to 4GB */
	if (!FJS_Util_Add32u(arraySize, dataSize, &arraySize)) {
		return NULL;
	}
	
	struct NDArray* array = malloc(arraySize);
	if (array == NULL) {
		return NULL;
	}

	array->dataType = dataType;
	array->length = length;
	array->dimensions = dimensions;
	memcpy(FJS_NDArray_GetShape(array), shape, dimensions * sizeof(uint32_t));
	return array;
}

void FJS_NDArray_Delete(struct NDArray* array) {
	free(array);
}
