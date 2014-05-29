#pragma once

#include <stdint.h>

#include "Interfaces.h"
#include "DataType.h"

struct NDArray {
	enum NumJS_DataType dataType;
	uint32_t length;
	uint32_t dimensions;
	uint32_t size;
};

struct NDArray* NumJS_NDArray_Create(uint32_t dimensions, uint32_t length, const uint32_t shape[static dimensions], enum NumJS_DataType dataType);
void NumJS_NDArray_Delete(struct NDArray* array);

inline uint32_t* NumJS_NDArray_GetShape(struct NDArray* array) {
	if (array == NULL) {
		return NULL;
	} else {
		return (uint32_t*)(array + 1);
	}
}

inline void* NumJS_NDArray_GetData(struct NDArray* array) {
	if (array == NULL) {
		return NULL;
	} else {
		const uint32_t paddedDimensions = (array->dimensions + 1) & -2;
		return (void*)(((uint32_t*)(array + 1)) + paddedDimensions);
	}
}