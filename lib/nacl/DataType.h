#pragma once

#include <stddef.h>
#include <stdint.h>

enum FJS_DataType {
	FJS_DataType_Invalid = -1,
	FJS_DataType_F64 = 0,
	FJS_DataType_F32 = 1
};

enum FJS_DataType FJS_DataType_Parse(const char* string, uint32_t size);
size_t FJS_DataType_GetSize(enum FJS_DataType dataType);
