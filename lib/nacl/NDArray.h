#pragma once

#include <stdint.h>

#include "Interfaces.h"
#include "DataType.h"

struct NDArray {
	enum FJS_DataType dataType;
	void* data;
	uint32_t length;
	uint32_t dimensions;
};

struct NDArray* FJS_NDArray_Create(uint32_t dimensions, uint32_t length, const uint32_t shape[static dimensions], enum FJS_DataType dataType);
struct NDArray* FJS_NDArray_ReShape(struct NDArray* array, uint32_t newDimensions, const uint32_t newShape[static newDimensions]);
void FJS_NDArray_Delete(struct NDArray* array);

inline static uint32_t* FJS_NDArray_GetShape(struct NDArray* array) {
	if (array == NULL) {
		return NULL;
	} else {
		return (uint32_t*)(array + 1);
	}
}

inline static void* FJS_NDArray_GetData(struct NDArray* array) {
	if (array == NULL) {
		return NULL;
	} else {
		return array->data;
	}
}

extern int32_t FJS_NDArray_Allocations;
extern int32_t FJS_Byte_Allocations;