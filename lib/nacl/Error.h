#pragma once

#include "Strings.h"

enum FJS_Error {
	FJS_Error_Ok,
	/* Invalid format of request protobuf */
	FJS_Error_InvalidProtobuf,
	/* The shape array has no elements */
	FJS_Error_EmptyShape,
	/* Some of the shape elements is 0 */
	FJS_Error_DegenerateShape,
	/* The product of shape components overflows */
	FJS_Error_LengthOverflow,
	/* The product of length by element size overflows */
	FJS_Error_SizeOverflow,
	/* The size of the supplied buffer does not match the size of internal buffer */
	FJS_Error_IncompatibleBufferSize,
	/* The size of the supplied buffer is not proportional to element size */
	FJS_Error_InvalidBufferSize,
	/* The size of buffer is zero */
	FJS_Error_EmptyBuffer,
	/* Datatype elements have zero size */
	FJS_Error_InvalidElementSize,
	/* Datatype has invalid or unknown value */
	FJS_Error_InvalidDataType,
	/* Wrong variable type */
	FJS_Error_InvalidVariableType,
	/* Missing variable */
	FJS_Error_MissingVariable,
	/* Invalid identifier */
	FJS_Error_InvalidId,
	/* Mismatching array dimensions */
	FJS_Error_MismatchingDimensions,
	FJS_Error_MismatchingShape,
	FJS_Error_MismatchingDataType,
	/* Mismatching array lengths */
	FJS_Error_MismatchingLength,
	/* Invalid number of elements */
	FJS_Error_InvalidLength,
	/* Invalid dimensions */
	FJS_Error_InvalidDimensions,
	/* Invalid shape */
	FJS_Error_InvalidShape,
	/* Axis is either negative or exceeds valid array dimensions */
	FJS_Error_AxisOutOfRange,
	/* Repeats arguments does not exceed 2 */
	FJS_Error_RepeatsOutOfRange,
	/* Diagonal argument is out of range */
	FJS_Error_DiagonalOutOfRange,
	FJS_Error_OutOfMemory
};

inline static enum FJS_StringVariable FJS_Error_ToString(enum FJS_Error error) {
	switch (error) {
		case FJS_Error_Ok:
			return FJS_StringVariable_Ok;
		case FJS_Error_InvalidProtobuf:
			return FJS_StringVariable_InvalidProtobuf;
		case FJS_Error_EmptyShape:
			return FJS_StringVariable_EmptyShape;
		case FJS_Error_DegenerateShape:
			return FJS_StringVariable_DegenerateShape;
		case FJS_Error_LengthOverflow:
			return FJS_StringVariable_LengthOverflow;
		case FJS_Error_SizeOverflow:
			return FJS_StringVariable_SizeOverflow;
		case FJS_Error_IncompatibleBufferSize:
			return FJS_StringVariable_IncompatibleBufferSize;
		case FJS_Error_InvalidBufferSize:
			return FJS_StringVariable_InvalidBufferSize;
		case FJS_Error_EmptyBuffer:
			return FJS_StringVariable_EmptyBuffer;
		case FJS_Error_InvalidElementSize:
			return FJS_StringVariable_InvalidElementSize;
		case FJS_Error_InvalidDataType:
			return FJS_StringVariable_InvalidDataType;
		case FJS_Error_InvalidVariableType:
			return FJS_StringVariable_InvalidVariableType;
		case FJS_Error_MissingVariable:
			return FJS_StringVariable_MissingVariable;
		case FJS_Error_InvalidId:
			return FJS_StringVariable_InvalidId;
		case FJS_Error_MismatchingDimensions:
			return FJS_StringVariable_MismatchingDimensions;
		case FJS_Error_MismatchingShape:
			return FJS_StringVariable_MismatchingShape;
		case FJS_Error_MismatchingDataType:
			return FJS_StringVariable_MismatchingDataType;
		case FJS_Error_MismatchingLength:
			return FJS_StringVariable_MismatchingLength;
		case FJS_Error_InvalidLength:
			return FJS_StringVariable_InvalidLength;
		case FJS_Error_InvalidDimensions:
			return FJS_StringVariable_InvalidDimensions;
		case FJS_Error_AxisOutOfRange:
			return FJS_StringVariable_AxisOutOfRange;
		case FJS_Error_RepeatsOutOfRange:
			return FJS_StringVariable_RepeatsOutOfRange;
		case FJS_Error_OutOfMemory:
			return FJS_StringVariable_OutOfMemory;
		default:
			__builtin_unreachable();
	}
}
