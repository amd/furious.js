#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <math.h>

#include "Error.h"
#include "DataType.h"
#include "NDArray.h"
#include "Commands.h"
#include "Interfaces.h"
#include "Message.h"
#include "Strings.h"
#include "IdMap.h"
#include "Util.h"

typedef void (*BinaryOpFunction)(size_t, const void*, const void*, void*);
static void addF32(size_t length, const float dataA[static length], const float dataB[static length], float dataOut[static length]);
static void addF64(size_t length, const double dataA[static length], const double dataB[static length], double dataOut[static length]);
static void subF32(size_t length, const float dataA[static length], const float dataB[static length], float dataOut[static length]);
static void subF64(size_t length, const double dataA[static length], const double dataB[static length], double dataOut[static length]);
static void mulF32(size_t length, const float dataA[static length], const float dataB[static length], float dataOut[static length]);
static void mulF64(size_t length, const double dataA[static length], const double dataB[static length], double dataOut[static length]);
static void divF32(size_t length, const float dataA[static length], const float dataB[static length], float dataOut[static length]);
static void divF64(size_t length, const double dataA[static length], const double dataB[static length], double dataOut[static length]);

typedef void (*BinaryConstOpFunction)(size_t, const void*, double, void*);
static void addConstF32(size_t length, const float dataA[static length], double dataB, float dataOut[static length]);
static void addConstF64(size_t length, const double dataA[static length], double dataB, double dataOut[static length]);
static void subConstF32(size_t length, const float dataA[static length], double dataB, float dataOut[static length]);
static void subConstF64(size_t length, const double dataA[static length], double dataB, double dataOut[static length]);
static void mulConstF32(size_t length, const float dataA[static length], double dataB, float dataOut[static length]);
static void mulConstF64(size_t length, const double dataA[static length], double dataB, double dataOut[static length]);
static void divConstF32(size_t length, const float dataA[static length], double dataB, float dataOut[static length]);
static void divConstF64(size_t length, const double dataA[static length], double dataB, double dataOut[static length]);

typedef void (*UnaryOpFunction)(size_t, const void*, void*);
static void negF32(size_t length, const float dataInt[static length], float dataOut[static length]);
static void negF64(size_t length, const double dataInt[static length], double dataOut[static length]);
static void absF32(size_t length, const float dataInt[static length], float dataOut[static length]);
static void absF64(size_t length, const double dataInt[static length], double dataOut[static length]);
static void expF32(size_t length, const float dataInt[static length], float dataOut[static length]);
static void expF64(size_t length, const double dataInt[static length], double dataOut[static length]);
static void logF32(size_t length, const float dataInt[static length], float dataOut[static length]);
static void logF64(size_t length, const double dataInt[static length], double dataOut[static length]);
static void sqrtF32(size_t length, const float dataInt[static length], float dataOut[static length]);
static void sqrtF64(size_t length, const double dataInt[static length], double dataOut[static length]);
static void squareF32(size_t length, const float dataInt[static length], float dataOut[static length]);
static void squareF64(size_t length, const double dataInt[static length], double dataOut[static length]);

typedef void (*ReduceOpFunction)(size_t, const void*, void*);
static void minF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static 1]);
static void minF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static 1]);
static void maxF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static 1]);
static void maxF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static 1]);
static void sumF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static 1]);
static void sumF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static 1]);

typedef void (*AxisReduceOpFunction)(size_t, size_t, size_t, const void*, void*);
static void axisMinF32(size_t width, size_t height, size_t depth, const float dataIn[restrict static width*height*depth], float dataOut[restrict static width*depth]);
static void axisMinF64(size_t width, size_t height, size_t depth, const double dataIn[restrict static width*height*depth], double dataOut[restrict static width*depth]);
static void axisMaxF32(size_t width, size_t height, size_t depth, const float dataIn[restrict static width*height*depth], float dataOut[restrict static width*depth]);
static void axisMaxF64(size_t width, size_t height, size_t depth, const double dataIn[restrict static width*height*depth], double dataOut[restrict static width*depth]);
static void axisSumF32(size_t width, size_t height, size_t depth, const float dataIn[restrict static width*height*depth], float dataOut[restrict static width*depth]);
static void axisSumF64(size_t width, size_t height, size_t depth, const double dataIn[restrict static width*height*depth], double dataOut[restrict static width*depth]);

typedef void (*DotOpFunction)(size_t, size_t, size_t, size_t, const void*, const void*, void*);
static void dotF32(size_t aStride, size_t bOuterStride, size_t bInnerStride, size_t reductionLength,
	const float a[restrict static aStride*reductionLength],
	const float b[restrict static bOuterStride*reductionLength*bInnerStride],
	float out[restrict static aStride*bOuterStride*bInnerStride]);
static void dotF64(size_t aStride, size_t bOuterStride, size_t bInnerStride, size_t reductionLength,
	const double a[restrict static aStride*reductionLength],
	const double b[restrict static bOuterStride*reductionLength*bInnerStride],
	double out[restrict static aStride*bOuterStride*bInnerStride]);

static const BinaryOpFunction addFunctions[] = {
	[FJS_DataType_F64] = (BinaryOpFunction) addF64,
	[FJS_DataType_F32] = (BinaryOpFunction) addF32
};

static const BinaryOpFunction subFunctions[] = {
	[FJS_DataType_F64] = (BinaryOpFunction) subF64,
	[FJS_DataType_F32] = (BinaryOpFunction) subF32
};

static const BinaryOpFunction mulFunctions[] = {
	[FJS_DataType_F64] = (BinaryOpFunction) mulF64,
	[FJS_DataType_F32] = (BinaryOpFunction) mulF32
};

static const BinaryOpFunction divFunctions[] = {
	[FJS_DataType_F64] = (BinaryOpFunction) divF64,
	[FJS_DataType_F32] = (BinaryOpFunction) divF32
};

static const BinaryConstOpFunction addConstFunctions[] = {
	[FJS_DataType_F64] = (BinaryConstOpFunction) addConstF64,
	[FJS_DataType_F32] = (BinaryConstOpFunction) addConstF32
};

static const BinaryConstOpFunction subConstFunctions[] = {
	[FJS_DataType_F64] = (BinaryConstOpFunction) subConstF64,
	[FJS_DataType_F32] = (BinaryConstOpFunction) subConstF32
};

static const BinaryConstOpFunction mulConstFunctions[] = {
	[FJS_DataType_F64] = (BinaryConstOpFunction) mulConstF64,
	[FJS_DataType_F32] = (BinaryConstOpFunction) mulConstF32
};

static const BinaryConstOpFunction divConstFunctions[] = {
	[FJS_DataType_F64] = (BinaryConstOpFunction) divConstF64,
	[FJS_DataType_F32] = (BinaryConstOpFunction) divConstF32
};

static const UnaryOpFunction negFunctions[] = {
	[FJS_DataType_F64] = (UnaryOpFunction) negF64,
	[FJS_DataType_F32] = (UnaryOpFunction) negF32
};

static const UnaryOpFunction absFunctions[] = {
	[FJS_DataType_F64] = (UnaryOpFunction) absF64,
	[FJS_DataType_F32] = (UnaryOpFunction) absF32
};

static const UnaryOpFunction expFunctions[] = {
	[FJS_DataType_F64] = (UnaryOpFunction) expF64,
	[FJS_DataType_F32] = (UnaryOpFunction) expF32
};

static const UnaryOpFunction logFunctions[] = {
	[FJS_DataType_F64] = (UnaryOpFunction) logF64,
	[FJS_DataType_F32] = (UnaryOpFunction) logF32
};

static const UnaryOpFunction sqrtFunctions[] = {
	[FJS_DataType_F64] = (UnaryOpFunction) sqrtF64,
	[FJS_DataType_F32] = (UnaryOpFunction) sqrtF32
};

static const UnaryOpFunction squareFunctions[] = {
	[FJS_DataType_F64] = (UnaryOpFunction) squareF64,
	[FJS_DataType_F32] = (UnaryOpFunction) squareF32
};

static const ReduceOpFunction minFunctions[] = {
	[FJS_DataType_F64] = (ReduceOpFunction) minF64,
	[FJS_DataType_F32] = (ReduceOpFunction) minF32
};

static const ReduceOpFunction maxFunctions[] = {
	[FJS_DataType_F64] = (ReduceOpFunction) maxF64,
	[FJS_DataType_F32] = (ReduceOpFunction) maxF32
};

static const ReduceOpFunction sumFunctions[] = {
	[FJS_DataType_F64] = (ReduceOpFunction) sumF64,
	[FJS_DataType_F32] = (ReduceOpFunction) sumF32
};

static const AxisReduceOpFunction axisMinFunctions[] = {
	[FJS_DataType_F64] = (AxisReduceOpFunction) axisMinF64,
	[FJS_DataType_F32] = (AxisReduceOpFunction) axisMinF32
};

static const AxisReduceOpFunction axisMaxFunctions[] = {
	[FJS_DataType_F64] = (AxisReduceOpFunction) axisMaxF64,
	[FJS_DataType_F32] = (AxisReduceOpFunction) axisMaxF32
};

static const AxisReduceOpFunction axisSumFunctions[] = {
	[FJS_DataType_F64] = (AxisReduceOpFunction) axisSumF64,
	[FJS_DataType_F32] = (AxisReduceOpFunction) axisSumF32
};

static const DotOpFunction dotFunctions[] = {
	[FJS_DataType_F64] = (DotOpFunction) dotF64,
	[FJS_DataType_F32] = (DotOpFunction) dotF32
};

static enum FJS_Error executeBinaryOp(PP_Instance instance, const struct FJS_BinaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1], const BinaryOpFunction computeFunctions[static 1]);
static enum FJS_Error executeBinaryConstOp(PP_Instance instance, const struct FJS_BinaryConstOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1], const BinaryConstOpFunction computeFunctions[static 1]);
static enum FJS_Error executeUnaryOp(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1], const UnaryOpFunction computeFunctions[static 1]);
static enum FJS_Error executeReduceOp(PP_Instance instance, const struct FJS_ReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1], const ReduceOpFunction computeFunctions[static 1]);
static enum FJS_Error executeAxisReduceOp(PP_Instance instance, const struct FJS_AxisReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1], const AxisReduceOpFunction computeFunctions[static 1]);

enum FJS_Error FJS_Execute_Add(PP_Instance instance, const struct FJS_BinaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeBinaryOp(instance, arguments, response, addFunctions);
}

enum FJS_Error FJS_Execute_Sub(PP_Instance instance, const struct FJS_BinaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeBinaryOp(instance, arguments, response, subFunctions);
}

enum FJS_Error FJS_Execute_Mul(PP_Instance instance, const struct FJS_BinaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeBinaryOp(instance, arguments, response, mulFunctions);
}

enum FJS_Error FJS_Execute_Div(PP_Instance instance, const struct FJS_BinaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeBinaryOp(instance, arguments, response, divFunctions);
}

enum FJS_Error FJS_Execute_AddC(PP_Instance instance, const struct FJS_BinaryConstOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeBinaryConstOp(instance, arguments, response, addConstFunctions);
}

enum FJS_Error FJS_Execute_SubC(PP_Instance instance, const struct FJS_BinaryConstOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeBinaryConstOp(instance, arguments, response, subConstFunctions);
}

enum FJS_Error FJS_Execute_MulC(PP_Instance instance, const struct FJS_BinaryConstOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeBinaryConstOp(instance, arguments, response, mulConstFunctions);
}

enum FJS_Error FJS_Execute_DivC(PP_Instance instance, const struct FJS_BinaryConstOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeBinaryConstOp(instance, arguments, response, divConstFunctions);
}

enum FJS_Error FJS_Execute_Neg(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeUnaryOp(instance, arguments, response, negFunctions);
}

enum FJS_Error FJS_Execute_Abs(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeUnaryOp(instance, arguments, response, absFunctions);
}

enum FJS_Error FJS_Execute_Exp(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeUnaryOp(instance, arguments, response, expFunctions);
}

enum FJS_Error FJS_Execute_Log(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeUnaryOp(instance, arguments, response, logFunctions);
}

enum FJS_Error FJS_Execute_Sqrt(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeUnaryOp(instance, arguments, response, sqrtFunctions);
}

enum FJS_Error FJS_Execute_Square(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeUnaryOp(instance, arguments, response, squareFunctions);
}

enum FJS_Error FJS_Execute_Min(PP_Instance instance, const struct FJS_ReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeReduceOp(instance, arguments, response, minFunctions);
}

enum FJS_Error FJS_Execute_Max(PP_Instance instance, const struct FJS_ReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeReduceOp(instance, arguments, response, maxFunctions);
}

enum FJS_Error FJS_Execute_Sum(PP_Instance instance, const struct FJS_ReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeReduceOp(instance, arguments, response, sumFunctions);
}

enum FJS_Error FJS_Execute_AxisMin(PP_Instance instance, const struct FJS_AxisReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeAxisReduceOp(instance, arguments, response, axisMinFunctions);
}

enum FJS_Error FJS_Execute_AxisMax(PP_Instance instance, const struct FJS_AxisReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeAxisReduceOp(instance, arguments, response, axisMaxFunctions);
}

enum FJS_Error FJS_Execute_AxisSum(PP_Instance instance, const struct FJS_AxisReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	return executeAxisReduceOp(instance, arguments, response, axisSumFunctions);
}

static enum FJS_Error executeBinaryOp(PP_Instance instance,
	const struct FJS_BinaryOp_Command_Arguments arguments[static 1],
	struct PP_Var response[static 1],
	const BinaryOpFunction computeFunctions[static 1])
{
	/* Validate the id for input array A and get NDArray object for array A */
	const int32_t idA = arguments->idA;
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, __builtin_abs(idA));
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	/* Validate the id for input array B and get NDArray object for array B */
	const int32_t idB = arguments->idB;
	struct NDArray* arrayB = FJS_GetPointerFromId(instance, __builtin_abs(idB));
	if (arrayB == NULL) {
		return FJS_Error_InvalidId;
	}

	/* Load information on the input array A */
	const uint32_t lengthA = arrayA->length;
	const uint32_t dimensionsA = arrayA->dimensions;
	const uint32_t* shapeA = FJS_NDArray_GetShape(arrayA);
	const void* dataA = FJS_NDArray_GetData(arrayA);
	const enum FJS_DataType dataTypeA = arrayA->dataType;

	/* Load information on the input array B */
	const uint32_t lengthB = arrayB->length;
	const uint32_t dimensionsB = arrayB->dimensions;
	const uint32_t* shapeB = FJS_NDArray_GetShape(arrayB);
	const void* dataB = FJS_NDArray_GetData(arrayB);
	const enum FJS_DataType dataTypeB = arrayB->dataType;

	/* Check that the input arrays have the same data type */
	if (dataTypeB != dataTypeA) {
		return FJS_Error_MismatchingDataType;
	}

	/*
	 * Check input data type (at this point it the same for a and b arrays)
	 * and choose the compute function for this data type.
	 */
	BinaryOpFunction computeFunction;
	switch (dataTypeA) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			computeFunction = computeFunctions[dataTypeA];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	/* Check that the input arrays have the same number of dimensions */
	if (dimensionsB != dimensionsA) {
		return FJS_Error_MismatchingDimensions;
	}

	/* Check that the input arrays have the same shape */
	if (lengthB != lengthA) {
		return FJS_Error_MismatchingShape;
	}
	if (memcmp(shapeA, shapeB, dimensionsA * sizeof(uint32_t)) != 0) {
		return FJS_Error_MismatchingShape;
	}

	/* Short-cut: do additional checks only if a and out are actually different arrays */
	void* dataOut = (void*) dataA;
	const int32_t idOut = arguments->idOut;
	if (idA != idOut) {
		/* Short-cut: do additional checks only if b and out are actually different arrays */
		dataOut = (void*) dataB;
		if (idB != idOut) {
			/*
			 * Try to get NDArray for the provided output id.
			 * If there is an NDArray associated with the supplied id, validate it.
			 * Otherwise, create an NDArray and associate it with the provided id.
			 */
			struct NDArray* arrayOut = FJS_GetPointerFromId(instance, idOut);
			if (arrayOut == NULL) {
				/* Define parameters for the output array */
				const uint32_t dimensionsOut = dimensionsA;
				const uint32_t lengthOut = lengthA;
				const uint32_t* shapeOut = shapeA;
				const enum FJS_DataType dataTypeOut = dataTypeA;

				/* Create output array */
				arrayOut = FJS_NDArray_Create(dimensionsOut, lengthOut, shapeOut, dataTypeOut);
				if (arrayOut == NULL) {
					return FJS_Error_OutOfMemory;
				}

				/* Associate the output array with its id */
				FJS_AllocateId(instance, idOut, arrayOut);
			} else {
				/* Check that the output array has the same data type as input array */
				if (arrayOut->dataType != dataTypeA) {
					return FJS_Error_MismatchingDataType;
				}

				/* Check that the output array has the same data type as input array */
				if (arrayOut->dataType != dataTypeA) {
					return FJS_Error_MismatchingDataType;
				}

				/* Check the number of dimensions of the output array */
				if (arrayOut->dimensions != dimensionsA) {
					return FJS_Error_MismatchingDimensions;
				}
				/* Check the shape of the output array */
				if (arrayOut->length != lengthA) {
					return FJS_Error_MismatchingShape;
				}
				const uint32_t* shapeOut = FJS_NDArray_GetShape(arrayOut);
				if (memcmp(shapeA, shapeOut, dimensionsA * sizeof(uint32_t)) != 0) {
					return FJS_Error_MismatchingShape;
				}
			}
			/* Re-initialize with proper value for created/validated output array */
			dataOut = FJS_NDArray_GetData(arrayOut);
		}
	}

	/* Do the binary operation with constant */
	computeFunction(lengthA, dataA, dataB, dataOut);

	/* De-allocate input arrays if needed */
	if (idA < 0) {
		FJS_NDArray_Delete(arrayA);
		FJS_ReleaseId(instance, __builtin_abs(idA));
	}
	if (idB < 0) {
		FJS_NDArray_Delete(arrayB);
		FJS_ReleaseId(instance, __builtin_abs(idB));
	}

	return FJS_Error_Ok;
}

static enum FJS_Error executeBinaryConstOp(PP_Instance instance,
	const struct FJS_BinaryConstOp_Command_Arguments arguments[static 1],
	struct PP_Var response[static 1],
	const BinaryConstOpFunction computeFunctions[static 1])
{
	/* Validate input array id and get NDArray object for this id */
	const int32_t idA = arguments->idA;
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, __builtin_abs(idA));
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	/* Load input array information */
	const uint32_t lengthA = arrayA->length;
	const uint32_t dimensionsA = arrayA->dimensions;
	const uint32_t* shapeA = FJS_NDArray_GetShape(arrayA);
	const void* dataA = FJS_NDArray_GetData(arrayA);
	const enum FJS_DataType dataTypeA = arrayA->dataType;

	/* Check input data type and choose the compute function for this data type */
	BinaryConstOpFunction computeFunction;
	switch (dataTypeA) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			computeFunction = computeFunctions[dataTypeA];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	/* Short-cut: do additional checks only if a and out are actually different arrays */
	void* dataOut = (void*) dataA;
	const int32_t idOut = arguments->idOut;
	if (idA != idOut) {
		/*
		 * Try to get NDArray for the provided output id.
		 * If there is an NDArray associated with the supplied id, validate it.
		 * Otherwise, create an NDArray and associate it with the provided id.
		 */
		struct NDArray* arrayOut = FJS_GetPointerFromId(instance, idOut);
		if (arrayOut == NULL) {
			/* Define parameters for the output array */
			const uint32_t dimensionsOut = dimensionsA;
			const uint32_t lengthOut = lengthA;
			const uint32_t* shapeOut = shapeA;
			const enum FJS_DataType dataTypeOut = dataTypeA;

			/* Create output array */
			arrayOut = FJS_NDArray_Create(dimensionsOut, lengthOut, shapeOut, dataTypeOut);
			if (arrayOut == NULL) {
				return FJS_Error_OutOfMemory;
			}

			/* Associate the output array with its id */
			FJS_AllocateId(instance, idOut, arrayOut);
		} else {
			/* Check that the output array has the same data type as input array */
			if (arrayOut->dataType != dataTypeA) {
				return FJS_Error_MismatchingDataType;
			}

			/* Check that the output array has the same data type as input array */
			if (arrayOut->dataType != dataTypeA) {
				return FJS_Error_MismatchingDataType;
			}

			/* Check the number of dimensions of the output array */
			if (arrayOut->dimensions != dimensionsA) {
				return FJS_Error_MismatchingDimensions;
			}
			/* Check the shape of the output array */
			if (arrayOut->length != lengthA) {
				return FJS_Error_MismatchingShape;
			}
			const uint32_t* shapeOut = FJS_NDArray_GetShape(arrayOut);
			if (memcmp(shapeA, shapeOut, dimensionsA * sizeof(uint32_t)) != 0) {
				return FJS_Error_MismatchingShape;
			}
		}
		/* Re-initialize with proper value for created/validated output array */
		dataOut = FJS_NDArray_GetData(arrayOut);
	}

	/* Do the binary operation with constant */
	computeFunction(lengthA, dataA, arguments->valueB, dataOut);

	/* De-allocate the input array if needed */
	if (idA < 0) {
		FJS_NDArray_Delete(arrayA);
		FJS_ReleaseId(instance, __builtin_abs(idA));
	}

	return FJS_Error_Ok;
}

static enum FJS_Error executeUnaryOp(PP_Instance instance,
	const struct FJS_UnaryOp_Command_Arguments arguments[static 1],
	struct PP_Var response[static 1],
	const UnaryOpFunction computeFunctions[static 1])
{
	/* Validate input array id and get NDArray object for this id */
	const int32_t idA = arguments->idA;
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, __builtin_abs(idA));
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	/* Load input array information */
	const uint32_t lengthA = arrayA->length;
	const uint32_t dimensionsA = arrayA->dimensions;
	const uint32_t* shapeA = FJS_NDArray_GetShape(arrayA);
	const void* dataA = FJS_NDArray_GetData(arrayA);
	const enum FJS_DataType dataTypeA = arrayA->dataType;

	/* Check input data type and choose the compute function for this data type */
	UnaryOpFunction computeFunction;
	switch (dataTypeA) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			computeFunction = computeFunctions[dataTypeA];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	/* Short-cut: do additional checks only if a and out are actually different arrays */
	void* dataOut = (void*) dataA;
	const int32_t idOut = arguments->idOut;
	if (idA != idOut) {
		/*
		 * Try to get NDArray for the provided output id.
		 * If there is an NDArray associated with the supplied id, validate it.
		 * Otherwise, create an NDArray and associate it with the provided id.
		 */
		struct NDArray* arrayOut = FJS_GetPointerFromId(instance, idOut);
		if (arrayOut == NULL) {
			/* Define parameters for the output array */
			const uint32_t dimensionsOut = dimensionsA;
			const uint32_t lengthOut = lengthA;
			const uint32_t* shapeOut = shapeA;
			const enum FJS_DataType dataTypeOut = dataTypeA;

			/* Create output array */
			arrayOut = FJS_NDArray_Create(dimensionsOut, lengthOut, shapeOut, dataTypeOut);
			if (arrayOut == NULL) {
				return FJS_Error_OutOfMemory;
			}

			/* Associate the output array with its id */
			FJS_AllocateId(instance, idOut, arrayOut);
		} else {
			/* Check that the output array has the same data type as input array */
			if (arrayOut->dataType != dataTypeA) {
				return FJS_Error_MismatchingDataType;
			}

			/* Check the number of dimensions of the output array */
			if (arrayOut->dimensions != dimensionsA) {
				return FJS_Error_MismatchingDimensions;
			}
			/* Check the shape of the output array */
			if (arrayOut->length != lengthA) {
				return FJS_Error_MismatchingShape;
			}
			const uint32_t* shapeOut = FJS_NDArray_GetShape(arrayOut);
			if (memcmp(shapeA, shapeOut, dimensionsA * sizeof(uint32_t)) != 0) {
				return FJS_Error_MismatchingShape;
			}
		}
		/* Re-initialize with proper value for created/validated output array */
		dataOut = FJS_NDArray_GetData(arrayOut);
	}

	/* Do the unary operation */
	computeFunction(lengthA, dataA, dataOut);

	/* De-allocate input array if needed */
	if (idA < 0) {
		FJS_NDArray_Delete(arrayA);
		FJS_ReleaseId(instance, __builtin_abs(idA));
	}

	return FJS_Error_Ok;
}

static enum FJS_Error executeReduceOp(PP_Instance instance,
	const struct FJS_ReduceOp_Command_Arguments arguments[static 1],
	struct PP_Var response[static 1],
	const ReduceOpFunction computeFunctions[static 1])
{
	/* Validate input array id and get NDArray object for this id */
	const int32_t idA = arguments->idA;
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, __builtin_abs(idA));
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	/* Load input array information */
	const size_t lengthA = arrayA->length;
	const uint32_t dimensionsA = arrayA->dimensions;
	const void* dataA = FJS_NDArray_GetData(arrayA);
	const enum FJS_DataType dataTypeA = arrayA->dataType;

	/* Check input data type and choose the compute function for this data type */
	ReduceOpFunction computeFunction;
	switch (dataTypeA) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			computeFunction = computeFunctions[dataTypeA];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	/*
	 * Try to get NDArray for the provided output id.
	 * If there is an NDArray associated with the supplied id, validate it.
	 * Otherwise, create an NDArray and associate it with the provided id.
	 */
	const int32_t idOut = arguments->idOut;
	struct NDArray* arrayOut = FJS_GetPointerFromId(instance, idOut);
	if (arrayOut == NULL) {
		/* Define parameters for the output array */
		const uint32_t dimensionsOut = 0;
		const uint32_t lengthOut = 1;
		const uint32_t* shapeOut = NULL;
		const enum FJS_DataType dataTypeOut = dataTypeA;

		/* Create output array */
		arrayOut = FJS_NDArray_Create(dimensionsOut, lengthOut, shapeOut, dataTypeOut);
		if (arrayOut == NULL) {
			return FJS_Error_OutOfMemory;
		}

		/* Associate the output array with its id */
		FJS_AllocateId(instance, idOut, arrayOut);
	} else {
		/* Check that the output array has the same data type as input array */
		if (arrayOut->dataType != dataTypeA) {
			return FJS_Error_MismatchingDataType;
		}

		/* Check that the output array is just a number: is should have length of 1 and no dimensions */
		if (arrayOut->dimensions != 0) {
			return FJS_Error_MismatchingDimensions;
		}
		if (arrayOut->length != 1) {
			return FJS_Error_MismatchingShape;
		}
	}

	/* Do the reduction */
	void* dataOut = FJS_NDArray_GetData(arrayOut);
	computeFunction(lengthA, dataA, dataOut);

	/* De-allocate input array if needed */
	if (idA < 0) {
		FJS_NDArray_Delete(arrayA);
		FJS_ReleaseId(instance, __builtin_abs(idA));
	}

	return FJS_Error_Ok;
}

static enum FJS_Error executeAxisReduceOp(PP_Instance instance,
	const struct FJS_AxisReduceOp_Command_Arguments arguments[static 1],
	struct PP_Var response[static 1],
	const AxisReduceOpFunction computeFunctions[static 1])
{
	/* Validate input array id and get NDArray object for this id */
	const int32_t idA = arguments->idA;
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, __builtin_abs(idA));
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	/* Load input array information */
	const size_t lengthA = arrayA->length;
	const uint32_t dimensionsA = arrayA->dimensions;
	const uint32_t* shapeA = FJS_NDArray_GetShape(arrayA);
	const void* dataA = FJS_NDArray_GetData(arrayA);
	const enum FJS_DataType dataTypeA = arrayA->dataType;

	/* Validate axis. Note that this check always fails if dimensionsA == 0. */
	const int32_t axis = arguments->axis;
	if ((axis < 0) || (axis >= dimensionsA)) {
		return FJS_Error_AxisOutOfRange;
	}

	/* Validate input data type and choose the compute function for this data type */
	AxisReduceOpFunction computeFunction;
	switch (dataTypeA) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			computeFunction = computeFunctions[dataTypeA];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	/* Compute strides for reduction */
	uint32_t outerStride = 1;
	for (uint32_t i = 0; i < axis; i++) {
		outerStride *= shapeA[i];
	}
	const uint32_t reductionLength = shapeA[axis];
	uint32_t innerStride = 1;
	for (uint32_t i = axis + 1; i < dimensionsA; i++) {
		innerStride *= shapeA[i];
	}

	/*
	 * Try to get NDArray for the provided output id.
	 * If there is an NDArray associated with the supplied id, validate it.
	 * Otherwise, create an NDArray and associate it with the provided id.
	 */
	const int32_t idOut = arguments->idOut;
	struct NDArray* arrayOut = FJS_GetPointerFromId(instance, idOut);
	if (arrayOut == NULL) {
		/* Initialize the shape for the output array and compute strides for reduction */
		const uint32_t dimensionsOut = dimensionsA - 1;
		uint32_t shapeOut[dimensionsOut];
		for (uint32_t i = 0; i < axis; i++) {
			shapeOut[i] = shapeA[i];
		}
		for (uint32_t i = axis + 1; i < dimensionsA; i++) {
			shapeOut[i-1] = shapeA[i];
		}
		const uint32_t lengthOut = outerStride * innerStride;

		/* Create output array */
		arrayOut = FJS_NDArray_Create(dimensionsOut, lengthOut, shapeOut, dataTypeA);
		if (arrayOut == NULL) {
			return FJS_Error_OutOfMemory;
		}

		/* Associate the output array with its id */
		FJS_AllocateId(instance, idOut, arrayOut);
	} else {
		/* Check that the output array has the same data type as input array */
		if (arrayOut->dataType != dataTypeA) {
			return FJS_Error_MismatchingDataType;
		}

		/* Check the shape of the output array and compute strides for reduction */
		const uint32_t* shapeOut = FJS_NDArray_GetShape(arrayOut);
		for (uint32_t i = 0; i < axis; i++) {
			if (shapeOut[i] != shapeA[i]) {
				return FJS_Error_MismatchingShape;
			}
		}
		for (uint32_t i = axis + 1; i < dimensionsA; i++) {
			if (shapeOut[i-1] != shapeA[i]) {
				return FJS_Error_MismatchingShape;
			}
		}
	}

	/* Do the reduction */
	void* dataOut = FJS_NDArray_GetData(arrayOut);
	computeFunction(outerStride, reductionLength, innerStride, dataA, dataOut);

	/* De-allocate input array if needed */
	if (idA < 0) {
		FJS_NDArray_Delete(arrayA);
		FJS_ReleaseId(instance, __builtin_abs(idA));
	}

	return FJS_Error_Ok;
}

enum FJS_Error FJS_Execute_Dot(PP_Instance instance, const struct FJS_Dot_Command_Arguments arguments[static 1], struct PP_Var response[static 1]) {
	/* Validate the id for input array A and get NDArray object for array A */
	const int32_t idA = arguments->idA;
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, __builtin_abs(idA));
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	/* Validate the id for input array B and get NDArray object for array B */
	const int32_t idB = arguments->idB;
	struct NDArray* arrayB = FJS_GetPointerFromId(instance, __builtin_abs(idB));
	if (arrayB == NULL) {
		return FJS_Error_InvalidId;
	}

	/* Load information on the input array A */
	const uint32_t lengthA = arrayA->length;
	const uint32_t dimensionsA = arrayA->dimensions;
	const uint32_t* shapeA = FJS_NDArray_GetShape(arrayA);
	const void* dataA = FJS_NDArray_GetData(arrayA);
	const enum FJS_DataType dataTypeA = arrayA->dataType;

	/* Check the dimension of input array A */
	if (dimensionsA == 0) {
		return FJS_Error_InvalidDimensions;
	}

	/* Load information on the input array B */
	const uint32_t lengthB = arrayB->length;
	const uint32_t dimensionsB = arrayB->dimensions;
	const uint32_t* shapeB = FJS_NDArray_GetShape(arrayB);
	const void* dataB = FJS_NDArray_GetData(arrayB);
	const enum FJS_DataType dataTypeB = arrayB->dataType;

	/* Check the dimension of input array B */
	if (dimensionsB == 0) {
		return FJS_Error_InvalidDimensions;
	}

	/* Check that the input arrays have the same data type */
	if (dataTypeB != dataTypeA) {
		return FJS_Error_MismatchingDataType;
	}

	/*
	 * Validate input data type (at this point it is the same for a and b arrays)
	 * and choose the compute function for this data type
	 */
	DotOpFunction computeFunction;
	switch (dataTypeA) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			computeFunction = dotFunctions[dataTypeA];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	/* Compute the axes that will be used for reduction */
	const size_t axisA = dimensionsA - 1;
	const size_t axisB = (dimensionsB == 1) ? 0 : dimensionsB - 2;

	/* Check that the length along the reduction dimension mathes */
	const size_t reductionLength = shapeA[axisA];
	if (shapeB[axisB] != reductionLength) {
		return FJS_Error_MismatchingShape;
	}

	const int32_t idOut = arguments->idOut;
	struct NDArray* arrayOut = FJS_GetPointerFromId(instance, idOut);
	if (arrayOut != NULL) {
		FJS_LOG_ERROR("TODO [executeDotOp]: implement in-place operation");
		__builtin_trap();
	} else {
		/* Define parameters for the output array */
		const uint32_t dimensionsOut = (dimensionsA - 1) + (dimensionsB - 1);
		const uint32_t lengthOut = (lengthA / reductionLength) * (lengthB / reductionLength);
		const enum FJS_DataType dataTypeOut = dataTypeA;
		uint32_t shapeOut[dimensionsOut];
		for (size_t i = 0; i < axisA; i++) {
			shapeOut[i] = shapeA[i];
		}
		if (dimensionsB != 1) {
			for (size_t i = 0; i < axisB; i++) {
				shapeOut[axisA + i] = shapeB[i];
			}
			shapeOut[axisA + axisB] = shapeB[dimensionsB - 1];
		}
		
		/* Create output array */
		arrayOut = FJS_NDArray_Create(dimensionsOut, lengthOut, shapeOut, dataTypeOut);
		if (arrayOut == NULL) {
			return FJS_Error_OutOfMemory;
		}

		/* Associate the output array with its id */
		FJS_AllocateId(instance, idOut, arrayOut);
	}

	/* Compute the strides */
	size_t aStride = 1, bOuterStride = 1, bInnerStride = 1;
	for (size_t i = 0; i < axisA; i++) {
		aStride *= shapeA[i];
	}
	if (dimensionsB != 1) {
		for (size_t i = 0; i < axisB; i++) {
			bOuterStride *= shapeB[i];
		}
		bInnerStride = shapeB[dimensionsB - 1];
	}

	/* Do the dot product operation */
	void* dataOut = FJS_NDArray_GetData(arrayOut);
	computeFunction(aStride, bOuterStride, bInnerStride, reductionLength, dataA, dataB, dataOut);

	/* De-allocate input array if needed */
	if (idA < 0) {
		FJS_NDArray_Delete(arrayA);
		FJS_ReleaseId(instance, __builtin_abs(idA));
	}
	if (idB < 0) {
		FJS_NDArray_Delete(arrayB);
		FJS_ReleaseId(instance, __builtin_abs(idB));
	}

	return FJS_Error_Ok;
}

/* Binary element-wise operations */

static void addF32(size_t length, const float dataA[static length], const float dataB[static length], float dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] + b[i] */
		while (length--) {
			*dataOut = (*dataOut) + (*dataB++);
			dataOut++;
		}
	} else if (dataOut == dataB) {
		/* In-place operation: out[i] = a[i] + out[i] */
		while (length--) {
			*dataOut = (*dataA++) + (*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] + b[i] */
		while (length--) {
			*dataOut++ = (*dataA++) + (*dataB++);
		}
	}
}

static void addF64(size_t length, const double dataA[static length], const double dataB[static length], double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] + b[i] */
		while (length--) {
			*dataOut = (*dataOut) + (*dataB++);
			dataOut++;
		}
	} else if (dataOut == dataB) {
		/* In-place operation: out[i] = a[i] + out[i] */
		while (length--) {
			*dataOut = (*dataA++) + (*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] + b[i] */
		while (length--) {
			*dataOut++ = (*dataA++) + (*dataB++);
		}
	}
}

static void subF32(size_t length, const float dataA[static length], const float dataB[static length], float dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] - b[i] */
		while (length--) {
			*dataOut = (*dataOut) - (*dataB++);
			dataOut++;
		}
	} else if (dataOut == dataB) {
		/* In-place operation: out[i] = a[i] - out[i] */
		while (length--) {
			*dataOut = (*dataA++) * (*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] - b[i] */
		while (length--) {
			*dataOut++ = (*dataA++) - (*dataB++);
		}
	}
}

static void subF64(size_t length, const double dataA[static length], const double dataB[static length], double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] - b[i] */
		while (length--) {
			*dataOut = (*dataOut) - (*dataB++);
			dataOut++;
		}
	} else if (dataOut == dataB) {
		/* In-place operation: out[i] = a[i] - out[i] */
		while (length--) {
			*dataOut = (*dataA++) - (*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] - b[i] */
		while (length--) {
			*dataOut++ = (*dataA++) - (*dataB++);
		}
	}
}

static void mulF32(size_t length, const float dataA[static length], const float dataB[static length], float dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] * b[i] */
		while (length--) {
			*dataOut = (*dataOut) * (*dataB++);
			dataOut++;
		}
	} else if (dataOut == dataB) {
		/* In-place operation: out[i] = a[i] * out[i] */
		while (length--) {
			*dataOut = (*dataA++) * (*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] * b[i] */
		while (length--) {
			*dataOut++ = (*dataA++) * (*dataB++);
		}
	}
}

static void mulF64(size_t length, const double dataA[static length], const double dataB[static length], double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] * b[i] */
		while (length--) {
			*dataOut = (*dataOut) * (*dataB++);
			dataOut++;
		}
	} else if (dataOut == dataB) {
		/* In-place operation: out[i] = a[i] * out[i] */
		while (length--) {
			*dataOut = (*dataA++) * (*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] * b[i] */
		while (length--) {
			*dataOut++ = (*dataA++) * (*dataB++);
		}
	}
}

static void divF32(size_t length, const float dataA[static length], const float dataB[static length], float dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] / b[i] */
		while (length--) {
			*dataOut = (*dataOut) * (*dataB++);
			dataOut++;
		}
	} else if (dataOut == dataB) {
		/* In-place operation: out[i] = a[i] / out[i] */
		while (length--) {
			*dataOut = (*dataA++) * (*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] / b[i] */
		while (length--) {
			*dataOut++ = (*dataA++) * (*dataB++);
		}
	}
}

static void divF64(size_t length, const double dataA[static length], const double dataB[static length], double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] / b[i] */
		while (length--) {
			*dataOut = (*dataOut) / (*dataB++);
			dataOut++;
		}
	} else if (dataOut == dataB) {
		/* In-place operation: out[i] = a[i] / out[i] */
		while (length--) {
			*dataOut = (*dataA++) / (*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] / b[i] */
		while (length--) {
			*dataOut++ = (*dataA++) / (*dataB++);
		}
	}
}

/* Binary element-wise operations with a constant */

static void addConstF32(size_t length, const float dataA[static length], double dataB, float dataOut[static length]) {
	const float dataBF32 = dataB;
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] + b */
		while (length--) {
			*dataOut = (*dataOut) + dataBF32;
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] + b */
		while (length--) {
			*dataOut++ = (*dataA++) + dataBF32;
		}
	}
}

static void addConstF64(size_t length, const double dataA[static length], double dataB, double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] + b */
		while (length--) {
			*dataOut = (*dataOut) + dataB;
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] + b */
		while (length--) {
			*dataOut++ = (*dataA++) + dataB;
		}
	}
}

static void subConstF32(size_t length, const float dataA[static length], double dataB, float dataOut[static length]) {
	const float dataBF32 = dataB;
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] - b */
		while (length--) {
			*dataOut = (*dataOut) - dataBF32;
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] - b */
		while (length--) {
			*dataOut++ = (*dataA++) - dataBF32;
		}
	}
}

static void subConstF64(size_t length, const double dataA[static length], double dataB, double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] - b */
		while (length--) {
			*dataOut = (*dataOut) - dataB;
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] - b */
		while (length--) {
			*dataOut++ = (*dataA++) - dataB;
		}
	}
}

static void mulConstF32(size_t length, const float dataA[static length], double dataB, float dataOut[static length]) {
	const float dataBF32 = dataB;
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] * b */
		while (length--) {
			*dataOut = (*dataOut) * dataBF32;
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] * b */
		while (length--) {
			*dataOut++ = (*dataA++) * dataBF32;
		}
	}
}

static void mulConstF64(size_t length, const double dataA[static length], double dataB, double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] * b */
		while (length--) {
			*dataOut = (*dataOut) * dataB;
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] * b */
		while (length--) {
			*dataOut++ = (*dataA++) * dataB;
		}
	}
}

static void divConstF32(size_t length, const float dataA[static length], double dataB, float dataOut[static length]) {
	const float dataBF32 = dataB;
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] / b */
		while (length--) {
			*dataOut = (*dataOut) / dataBF32;
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] / b */
		while (length--) {
			*dataOut++ = (*dataA++) / dataBF32;
		}
	}
}

static void divConstF64(size_t length, const double dataA[static length], double dataB, double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = out[i] / b */
		while (length--) {
			*dataOut = (*dataOut) / dataB;
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = a[i] / b */
		while (length--) {
			*dataOut++ = (*dataA++) / dataB;
		}
	}
}

/* Unary element-wise operations */

static void negF32(size_t length, const float dataA[static length], float dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = -out[i] */
		while (length--) {
			*dataOut = -(*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = -a[i] */
		while (length--) {
			*dataOut++ = -(*dataA++);
		}
	}
}

static void negF64(size_t length, const double dataA[static length], double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = -out[i] */
		while (length--) {
			*dataOut = -(*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = -a[i] */
		while (length--) {
			*dataOut++ = -(*dataA++);
		}
	}
}

static void absF32(size_t length, const float dataA[static length], float dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = abs(out[i]) */
		while (length--) {
			*dataOut = fabsf(*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = abs(a[i]) */
		while (length--) {
			*dataOut++ = fabsf(*dataA++);
		}
	}
}

static void absF64(size_t length, const double dataA[static length], double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = abs(out[i]) */
		while (length--) {
			*dataOut = fabs(*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = abs(a[i]) */
		while (length--) {
			*dataOut++ = fabs(*dataA++);
		}
	}
}

static void expF32(size_t length, const float dataA[static length], float dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = exp(out[i]) */
		while (length--) {
			*dataOut = expf(*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = exp(a[i]) */
		while (length--) {
			*dataOut++ = expf(*dataA++);
		}
	}
}

static void expF64(size_t length, const double dataA[static length], double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = exp(out[i]) */
		while (length--) {
			*dataOut = exp(*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = exp(a[i]) */
		while (length--) {
			*dataOut++ = exp(*dataA++);
		}
	}
}

static void logF32(size_t length, const float dataA[static length], float dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = log(out[i]) */
		while (length--) {
			*dataOut = logf(*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = log(a[i]) */
		while (length--) {
			*dataOut++ = logf(*dataA++);
		}
	}
}

static void logF64(size_t length, const double dataA[static length], double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = log(out[i]) */
		while (length--) {
			*dataOut = log(*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = log(a[i]) */
		while (length--) {
			*dataOut++ = log(*dataA++);
		}
	}
}

static void sqrtF32(size_t length, const float dataA[static length], float dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = sqrt(out[i]) */
		while (length--) {
			*dataOut = sqrtf(*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = sqrt(a[i]) */
		while (length--) {
			*dataOut++ = sqrtf(*dataA++);
		}
	}
}

static void sqrtF64(size_t length, const double dataA[static length], double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = sqrt(out[i]) */
		while (length--) {
			*dataOut = sqrt(*dataOut);
			dataOut++;
		}
	} else {
		/* Non-destructive operation: out[i] = sqrt(a[i]) */
		while (length--) {
			*dataOut++ = sqrt(*dataA++);
		}
	}
}

static void squareF32(size_t length, const float dataA[static length], float dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = sqrt(out[i]) */
		while (length--) {
			const float value = *dataOut;
			*dataOut++ = value * value;
		}
	} else {
		/* Non-destructive operation: out[i] = sqrt(a[i]) */
		while (length--) {
			const float value = *dataA++;
			*dataOut++ = value * value;
		}
	}
}

static void squareF64(size_t length, const double dataA[static length], double dataOut[static length]) {
	if (dataOut == dataA) {
		/* In-place operation: out[i] = sqrt(out[i]) */
		while (length--) {
			const double value = *dataOut;
			*dataOut++ = value * value;
		}
	} else {
		/* Non-destructive operation: out[i] = sqrt(a[i]) */
		while (length--) {
			const double value = *dataA++;
			*dataOut++ = value * value;
		}
	}
}

/* All-array reduction functions */

static void minF32(size_t length, const float data[restrict static length], float minOut[restrict static 1]) {
	if (length == 0) {
		*minOut = __builtin_nanf("");
	} else {
		float min = *data++;
		while (--length) {
			const float val = *data++;
			min = min < val ? min : val;
		}
		*minOut = min;
	}
}

static void minF64(size_t length, const double data[restrict static length], double minOut[restrict static 1]) {
	if (length == 0) {
		*minOut = __builtin_nan("");
	} else {
		double min = *data++;
		while (--length) {
			const double value = *data++;
			min = min < value ? min : value;
		}
		*minOut = min;
	}
}

static void maxF32(size_t length, const float data[restrict static length], float maxOut[restrict static 1]) {
	if (length == 0) {
		*maxOut = __builtin_nanf("");
	} else {
		float max = *data++;
		while (--length) {
			const float value = *data++;
			max = max < value ? value : max;
		}
		*maxOut = max;
	}
}

static void maxF64(size_t length, const double data[restrict static length], double maxOut[restrict static 1]) {
	if (length == 0) {
		*maxOut = __builtin_nan("");
	} else {
		double max = *data++;
		while (--length) {
			const double value = *data++;
			max = max < value ? value : max;
		}
		*maxOut = max;
	}
}

static void sumF32(size_t length, const float data[restrict static length], float sumOut[restrict static 1]) {
	float s = 0.0f;
	while (length--) {
		s += *data++;
	}
	*sumOut = s;
}

static void sumF64(size_t length, const double data[restrict static length], double sumOut[restrict static 1]) {
	double s = 0.0;
	while (length--) {
		s += *data++;
	}
	*sumOut = s;
}

/* Axis reduction functions */

static void axisMinF32(size_t width, size_t height, size_t depth, const float dataIn[restrict static width*height*depth], float dataOut[restrict static width*depth]) {
	if (height == 0) {
		__builtin_trap();
	}
	for (size_t i = 0; i < width; i++) {
		for (size_t k = 0; k < depth; k++) {
			size_t offset = i * height * depth + k;
			float min = dataIn[offset];
			for (size_t j = 1; j < height; j++) {
				offset += width;

				const float value = dataIn[offset];
				min = min < value ? min : value;
			}
			dataOut[i * depth + k] = min;
		}
	}
}

static void axisMinF64(size_t width, size_t height, size_t depth, const double dataIn[restrict static width*height*depth], double dataOut[restrict static width*depth]) {
	if (height == 0) {
		__builtin_trap();
	}
	for (size_t i = 0; i < width; i++) {
		for (size_t k = 0; k < depth; k++) {
			size_t offset = i * height * depth + k;
			double min = dataIn[offset];
			for (size_t j = 1; j < height; j++) {
				offset += depth;

				const double value = dataIn[offset];
				min = min < value ? min : value;
			}
			dataOut[i * depth + k] = min;
		}
	}
}

static void axisMaxF32(size_t width, size_t height, size_t depth, const float dataIn[restrict static width*height*depth], float dataOut[restrict static width*depth]) {
	if (height == 0) {
		__builtin_trap();
	}
	for (size_t i = 0; i < width; i++) {
		for (size_t k = 0; k < depth; k++) {
			size_t offset = i * height * depth + k;
			float max = dataIn[offset];
			for (size_t j = 1; j < height; j++) {
				offset += depth;

				const float value = dataIn[offset];
				max = max > value ? max : value;
			}
			dataOut[i * depth + k] = max;
		}
	}
}

static void axisMaxF64(size_t width, size_t height, size_t depth, const double dataIn[restrict static width*height*depth], double dataOut[restrict static width*depth]) {
	if (height == 0) {
		__builtin_trap();
	}
	for (size_t i = 0; i < width; i++) {
		for (size_t k = 0; k < depth; k++) {
			size_t offset = i * height * depth + k;
			double max = dataIn[offset];
			for (size_t j = 1; j < height; j++) {
				offset += depth;

				const double value = dataIn[offset];
				max = max > value ? max : value;
			}
			dataOut[i * depth + k] = max;
		}
	}
}

static void axisSumF32(size_t width, size_t height, size_t depth, const float dataIn[restrict static width*height*depth], float dataOut[restrict static width*depth]) {
	for (size_t i = 0; i < width; i++) {
		for (size_t k = 0; k < depth; k++) {
			size_t offset = i * height * depth + k;
			float sum = 0.0f;
			for (size_t j = 0; j < height; j++) {
				sum += dataIn[offset];
				offset += depth;
			}
			dataOut[i * depth + k] = sum;
		}
	}
}

static void axisSumF64(size_t width, size_t height, size_t depth, const double dataIn[restrict static width*height*depth], double dataOut[restrict static width*depth]) {
	for (size_t i = 0; i < width; i++) {
		for (size_t k = 0; k < depth; k++) {
			size_t offset = i * height * depth + k;
			double sum = 0.0;
			for (size_t j = 0; j < height; j++) {
				sum += dataIn[offset];
				offset += depth;
			}
			dataOut[i * depth + k] = sum;
		}
	}
}

/* Dot product kernel */

static void dotF32(size_t aStride, size_t bOuterStride, size_t bInnerStride, size_t reductionLength,
	const float a[restrict static aStride*reductionLength],
	const float b[restrict static bOuterStride*reductionLength*bInnerStride],
	float out[restrict static aStride*bOuterStride*bInnerStride])
{
	memset(out, 0, aStride * bOuterStride * bInnerStride * sizeof(float));
	for (size_t i = 0; i < aStride; i++) {
		for (size_t j = 0; j < reductionLength; j++) {
			for (size_t k = 0; k < bOuterStride; k++) {
				for (size_t l = 0; l < bInnerStride; l++) {
					out[(i*bOuterStride + k) * bInnerStride + l] += a[i*reductionLength+j] * b[(k*reductionLength+j)*bInnerStride+l];
				}
			}
		}
	}
}

static void dotF64(size_t aStride, size_t bOuterStride, size_t bInnerStride, size_t reductionLength,
	const double a[restrict static aStride*reductionLength],
	const double b[restrict static bOuterStride*reductionLength*bInnerStride],
	double out[restrict static aStride*bOuterStride*bInnerStride])
{
	memset(out, 0, aStride * bOuterStride * bInnerStride * sizeof(double));
	for (size_t i = 0; i < aStride; i++) {
		for (size_t j = 0; j < reductionLength; j++) {
			for (size_t k = 0; k < bOuterStride; k++) {
				for (size_t l = 0; l < bInnerStride; l++) {
					out[(i*bOuterStride + k) * bInnerStride + l] += a[i*reductionLength+j] * b[(k*reductionLength+j)*bInnerStride+l];
				}
			}
		}
	}
}
