#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
#include "Requests.pb.h"
extern "C" {
#endif

enum FJS_DataType {
	FJS_DataType_Invalid = -1,
	FJS_DataType_F64 = 0,
	FJS_DataType_F32 = 1,
	FJS_DataType_Max
};

size_t FJS_DataType_GetSize(enum FJS_DataType dataType);

#ifdef __cplusplus
inline enum FJS_DataType FJS_DataType_FromProtobuf(enum furious::DataType dataType) {
	switch (dataType) {
		case furious::FLOAT64:
			return FJS_DataType_F64;
		case furious::FLOAT32:
			return FJS_DataType_F32;
		default:
			return FJS_DataType_Invalid;
	}
}

} // extern "C"
#endif