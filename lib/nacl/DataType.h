#pragma once

#include <stddef.h>

enum NumJS_DataType {
	NumJS_DataType_Invalid = -1,
	NumJS_DataType_F64 = 0,
	NumJS_DataType_F32 = 1
};

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