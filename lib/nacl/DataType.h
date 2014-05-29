#pragma once

#include <stddef.h>
#include <stdint.h>

enum NumJS_DataType {
	NumJS_DataType_Invalid = -1,
	NumJS_DataType_F64 = 0,
	NumJS_DataType_F32 = 1
};

enum NumJS_DataType NumJS_DataType_Parse(const char* string, uint32_t size);
size_t NumJS_DataType_GetSize(enum NumJS_DataType dataType);
