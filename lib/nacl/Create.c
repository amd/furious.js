#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "Error.h"
#include "DataType.h"
#include "NDArray.h"
#include "Commands.h"
#include "IdMap.h"
#include "Util.h"

enum NumJS_Error NumJS_Create(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum NumJS_DataType datatype) {
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
