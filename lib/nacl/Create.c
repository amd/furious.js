#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "Error.h"
#include "DataType.h"
#include "NDArray.h"
#include "Commands.h"
#include "IdMap.h"

enum NumJS_Error NumJS_Create(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum NumJS_DataType dataType) {
	if (dimensions == 0) {
		return NumJS_Error_InvalidShape;
	}
	if (dataType == NumJS_DataType_Invalid) {
		return NumJS_Error_InvalidDataType;
	}
	uint32_t length = 1;
	for (uint32_t dimension = 0; dimension < dimensions; dimension++) {
		const uint32_t measure = shape[dimension];
		if (measure < 1) {
			return NumJS_Error_InvalidShape;
		}
		/* This multiplication can easily overflow */
		const uint32_t newLength = length * measure;
		if (newLength < length) {
			return NumJS_Error_OutOfMemory;
		}
		length = newLength;
	}

	struct NDArray* array = NumJS_NDArray_Create(dimensions, length, shape, dataType);
	if (array == NULL) {
		return NumJS_Error_OutOfMemory;
	}

	NumJS_AllocateId(instance, idOut, array);
	return NumJS_Error_Ok;

}
