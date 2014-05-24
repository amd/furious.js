#include <string.h>

#include "DataType.h"

enum NumJS_DataType NumJS_DataType_Parse(const char* datatypeString, uint32_t datatypeStringSize) {
	enum NumJS_DataType dataType = NumJS_DataType_Invalid;
	if (datatypeString != NULL) {
		if (strncmp(datatypeString, "f64", datatypeStringSize) == 0) {
			dataType = NumJS_DataType_F64;
		} else if (strncmp(datatypeString, "f32", datatypeStringSize) == 0) {
			dataType = NumJS_DataType_F32;
		}
	}
	return dataType;
}

inline size_t NumJS_DataType_GetSize(enum NumJS_DataType dataType) {
	switch (dataType) {
		case NumJS_DataType_F64:
			return sizeof(double);
		case NumJS_DataType_F32:
			return sizeof(float);
		case NumJS_DataType_Invalid:
		default:
			return 0;
	}
}
