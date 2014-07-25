#include <string.h>

#include "DataType.h"

size_t FJS_DataType_GetSize(enum FJS_DataType dataType) {
	switch (dataType) {
		case FJS_DataType_F64:
			return sizeof(double);
		case FJS_DataType_F32:
			return sizeof(float);
		case FJS_DataType_Invalid:
		default:
			return 0;
	}
}
