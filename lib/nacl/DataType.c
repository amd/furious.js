#include <string.h>

#include "DataType.h"

enum FJS_DataType FJS_DataType_Parse(const char* datatypeString, uint32_t datatypeStringSize) {
	enum FJS_DataType dataType = FJS_DataType_Invalid;
	if (datatypeString != NULL) {
		if (strncmp(datatypeString, "f64", datatypeStringSize) == 0) {
			dataType = FJS_DataType_F64;
		} else if (strncmp(datatypeString, "f32", datatypeStringSize) == 0) {
			dataType = FJS_DataType_F32;
		}
	}
	return dataType;
}

inline size_t FJS_DataType_GetSize(enum FJS_DataType dataType) {
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
