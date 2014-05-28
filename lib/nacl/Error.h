#pragma once

enum NumJS_Error {
	NumJS_Error_Ok,
	NumJS_Error_InvalidJSType,
	/* The shape array has no elements */
	NumJS_Error_EmptyShape,
	/* Some of the shape elements is 0 */
	NumJS_Error_DegenerateShape,
	/* The product of shape components overflows */
	NumJS_Error_LengthOverflow,
	/* The product of length by element size overflows */
	NumJS_Error_SizeOverflow,
	NumJS_Error_InvalidDataType,
	NumJS_Error_InvalidId,
	NumJS_Error_MismatchingShape,
	NumJS_Error_MismatchingDataType,
	NumJS_Error_OutOfMemory
};

