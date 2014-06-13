#pragma once

enum FJS_Error {
	FJS_Error_Ok,
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
	FJS_Error_OutOfMemory
};

