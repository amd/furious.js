#include <stdlib.h>
#include <stdint.h>
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
static void addF32(size_t length, const float dataA[restrict static length], const float dataB[restrict static length], float dataOut[restrict static length]);
static void addF64(size_t length, const double dataA[restrict static length], const double dataB[restrict static length], double dataOut[restrict static length]);
static void subF32(size_t length, const float dataA[restrict static length], const float dataB[restrict static length], float dataOut[restrict static length]);
static void subF64(size_t length, const double dataA[restrict static length], const double dataB[restrict static length], double dataOut[restrict static length]);
static void mulF32(size_t length, const float dataA[restrict static length], const float dataB[restrict static length], float dataOut[restrict static length]);
static void mulF64(size_t length, const double dataA[restrict static length], const double dataB[restrict static length], double dataOut[restrict static length]);
static void divF32(size_t length, const float dataA[restrict static length], const float dataB[restrict static length], float dataOut[restrict static length]);
static void divF64(size_t length, const double dataA[restrict static length], const double dataB[restrict static length], double dataOut[restrict static length]);

typedef void (*BinaryConstOpFunction)(size_t, const void*, double, void*);
static void addConstF32(size_t length, const float dataA[restrict static length], double dataB, float dataOut[restrict static length]);
static void addConstF64(size_t length, const double dataA[restrict static length], double dataB, double dataOut[restrict static length]);
static void subConstF32(size_t length, const float dataA[restrict static length], double dataB, float dataOut[restrict static length]);
static void subConstF64(size_t length, const double dataA[restrict static length], double dataB, double dataOut[restrict static length]);
static void mulConstF32(size_t length, const float dataA[restrict static length], double dataB, float dataOut[restrict static length]);
static void mulConstF64(size_t length, const double dataA[restrict static length], double dataB, double dataOut[restrict static length]);
static void divConstF32(size_t length, const float dataA[restrict static length], double dataB, float dataOut[restrict static length]);
static void divConstF64(size_t length, const double dataA[restrict static length], double dataB, double dataOut[restrict static length]);

typedef void (*UnaryOpFunction)(size_t, const void*, void*);
static void negF32(size_t length, const float dataInt[restrict static length], float dataOut[restrict static length]);
static void negF64(size_t length, const double dataInt[restrict static length], double dataOut[restrict static length]);
static void absF32(size_t length, const float dataInt[restrict static length], float dataOut[restrict static length]);
static void absF64(size_t length, const double dataInt[restrict static length], double dataOut[restrict static length]);
static void expF32(size_t length, const float dataInt[restrict static length], float dataOut[restrict static length]);
static void expF64(size_t length, const double dataInt[restrict static length], double dataOut[restrict static length]);
static void logF32(size_t length, const float dataInt[restrict static length], float dataOut[restrict static length]);
static void logF64(size_t length, const double dataInt[restrict static length], double dataOut[restrict static length]);
static void sqrtF32(size_t length, const float dataInt[restrict static length], float dataOut[restrict static length]);
static void sqrtF64(size_t length, const double dataInt[restrict static length], double dataOut[restrict static length]);
static void squareF32(size_t length, const float dataInt[restrict static length], float dataOut[restrict static length]);
static void squareF64(size_t length, const double dataInt[restrict static length], double dataOut[restrict static length]);

typedef void (*ReduceOpFunction)(size_t, const void*, void*);
static void minF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static 1]);
static void minF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static 1]);
static void maxF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static 1]);
static void maxF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static 1]);
static void sumF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static 1]);
static void sumF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static 1]);

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
	[FJS_DataType_F64] = (UnaryOpFunction) minF64,
	[FJS_DataType_F32] = (UnaryOpFunction) minF32
};

static const ReduceOpFunction maxFunctions[] = {
	[FJS_DataType_F64] = (UnaryOpFunction) maxF64,
	[FJS_DataType_F32] = (UnaryOpFunction) maxF32
};

static const ReduceOpFunction sumFunctions[] = {
	[FJS_DataType_F64] = (UnaryOpFunction) sumF64,
	[FJS_DataType_F32] = (UnaryOpFunction) sumF32
};

static void parseBinaryOp(PP_Instance instance, struct PP_Var message, const BinaryOpFunction computeFunctions[static 1]);
static void parseBinaryConstOp(PP_Instance instance, struct PP_Var message, const BinaryConstOpFunction computeFunctions[static 1]);
static void parseUnaryOp(PP_Instance instance, struct PP_Var message, const UnaryOpFunction computeFunctions[static 1]);
static void parseReduceOp(PP_Instance instance, struct PP_Var message, const ReduceOpFunction computeFunctions[static 1]);
static enum FJS_Error executeBinaryOp(PP_Instance instance, int32_t idA, int32_t idB, int32_t idOut, const BinaryOpFunction computeFunctions[static 1]);
static enum FJS_Error executeBinaryConstOp(PP_Instance instance, int32_t idA, double valueB, int32_t idOut, const BinaryConstOpFunction computeFunctions[static 1]);
static enum FJS_Error executeUnaryOp(PP_Instance instance, int32_t idA, int32_t idOut, const UnaryOpFunction computeFunctions[static 1]);
static enum FJS_Error executeReduceOp(PP_Instance instance, int32_t idA, int32_t idOut, const ReduceOpFunction computeFunctions[static 1]);

void FJS_Parse_Add(PP_Instance instance, struct PP_Var message) {
	parseBinaryOp(instance, message, addFunctions);
}

void FJS_Parse_Sub(PP_Instance instance, struct PP_Var message) {
	parseBinaryOp(instance, message, subFunctions);
}

void FJS_Parse_Mul(PP_Instance instance, struct PP_Var message) {
	parseBinaryOp(instance, message, mulFunctions);
}

void FJS_Parse_Div(PP_Instance instance, struct PP_Var message) {
	parseBinaryOp(instance, message, divFunctions);
}

void FJS_Parse_AddC(PP_Instance instance, struct PP_Var message) {
	parseBinaryConstOp(instance, message, addConstFunctions);
}

void FJS_Parse_SubC(PP_Instance instance, struct PP_Var message) {
	parseBinaryConstOp(instance, message, subConstFunctions);
}

void FJS_Parse_MulC(PP_Instance instance, struct PP_Var message) {
	parseBinaryConstOp(instance, message, mulConstFunctions);
}

void FJS_Parse_DivC(PP_Instance instance, struct PP_Var message) {
	parseBinaryConstOp(instance, message, divConstFunctions);
}

void FJS_Parse_Neg(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, negFunctions);
}

void FJS_Parse_Abs(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, absFunctions);
}

void FJS_Parse_Exp(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, expFunctions);
}

void FJS_Parse_Log(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, logFunctions);
}

void FJS_Parse_Sqrt(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, sqrtFunctions);
}

void FJS_Parse_Square(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, squareFunctions);
}

void FJS_Parse_Min(PP_Instance instance, struct PP_Var message) {
	parseReduceOp(instance, message, minFunctions);
}

void FJS_Parse_Max(PP_Instance instance, struct PP_Var message) {
	parseReduceOp(instance, message, maxFunctions);
}

void FJS_Parse_Sum(PP_Instance instance, struct PP_Var message) {
	parseReduceOp(instance, message, sumFunctions);
}

enum BinaryOp_Argument {
	BinaryOp_Argument_A,
	BinaryOp_Argument_B,
	BinaryOp_Argument_Out,
};

enum UnaryOp_Argument {
	UnaryOp_Argument_A,
	UnaryOp_Argument_Out,
};

static const struct FJS_VariableDescriptor binaryOpDescriptors[] =
{
	[BinaryOp_Argument_A] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_A
	},
	[BinaryOp_Argument_B] = {
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_B
	},
	[BinaryOp_Argument_Out] = {
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Out
	}
};

static const struct FJS_VariableDescriptor binaryConstOpDescriptors[] =
{
	[BinaryOp_Argument_A] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_A
	},
	[BinaryOp_Argument_B] = {
		.type = FJS_VariableType_Float64,
		.name = FJS_StringVariable_B
	},
	[BinaryOp_Argument_Out] = {
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Out
	}
};

static const struct FJS_VariableDescriptor unaryOpDescriptors[] =
{
	[UnaryOp_Argument_A] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_A
	},
	[UnaryOp_Argument_Out] = {
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Out
	}
};

static const struct FJS_VariableDescriptor reduceOpDescriptors[] =
{
	[UnaryOp_Argument_A] = { 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_A
	},
	[UnaryOp_Argument_Out] = {
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_Out
	}
};

static void parseBinaryOp(PP_Instance instance, struct PP_Var message, const BinaryOpFunction computeFunctions[static 1]) {
	struct FJS_Variable variables[FJS_COUNT_OF(binaryOpDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(binaryOpDescriptors), binaryOpDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = executeBinaryOp(instance,
		variables[BinaryOp_Argument_A].parsedValue.asInt32,
		variables[BinaryOp_Argument_B].parsedValue.asInt32,
		variables[BinaryOp_Argument_Out].parsedValue.asInt32,
		computeFunctions);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

static void parseBinaryConstOp(PP_Instance instance, struct PP_Var message, const BinaryConstOpFunction computeFunctions[static 1]) {
	struct FJS_Variable variables[FJS_COUNT_OF(binaryConstOpDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(binaryConstOpDescriptors), binaryConstOpDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = executeBinaryConstOp(instance,
		variables[BinaryOp_Argument_A].parsedValue.asInt32,
		variables[BinaryOp_Argument_B].parsedValue.asFloat64,
		variables[BinaryOp_Argument_Out].parsedValue.asInt32,
		computeFunctions);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

static void parseUnaryOp(PP_Instance instance, struct PP_Var message, const UnaryOpFunction computeFunctions[static 1]) {
	struct FJS_Variable variables[FJS_COUNT_OF(unaryOpDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(unaryOpDescriptors), unaryOpDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = executeUnaryOp(instance,
		variables[UnaryOp_Argument_A].parsedValue.asInt32,
		variables[UnaryOp_Argument_Out].parsedValue.asInt32,
		computeFunctions);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

static void parseReduceOp(PP_Instance instance, struct PP_Var message, const ReduceOpFunction computeFunctions[static 1]) {
	struct FJS_Variable variables[FJS_COUNT_OF(unaryOpDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(unaryOpDescriptors), unaryOpDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = executeReduceOp(instance,
		variables[UnaryOp_Argument_A].parsedValue.asInt32,
		variables[UnaryOp_Argument_Out].parsedValue.asInt32,
		computeFunctions);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

static enum FJS_Error executeBinaryOp(PP_Instance instance, int32_t idA, int32_t idB, int32_t idOut, const BinaryOpFunction computeFunctions[static 1]) {
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, idA);
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	struct NDArray* arrayB = FJS_GetPointerFromId(instance, idB);
	if (arrayB == NULL) {
		return FJS_Error_InvalidId;
	}

	const enum FJS_DataType dataType = arrayA->dataType;
	if (dataType != arrayB->dataType) {
		return FJS_Error_MismatchingDataType;
	}

	BinaryOpFunction computeFunction;
	switch (dataType) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			computeFunction = computeFunctions[dataType];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	const uint32_t dimensions = arrayA->dimensions;
	if (dimensions != arrayB->dimensions) {
		return FJS_Error_MismatchingDimensions;
	}

	uint32_t length = arrayA->length;
	if (length != arrayB->length) {
		return FJS_Error_MismatchingShape;
	}

	const uint32_t* shape = FJS_NDArray_GetShape(arrayA);
	const uint32_t* shapeB = FJS_NDArray_GetShape(arrayB);

	for (uint32_t i = 0; i < dimensions; i++) {
		if (shape[i] != shapeB[i]) {
			return FJS_Error_MismatchingShape;
		}
	}

	const void* dataA = FJS_NDArray_GetData(arrayA);
	const void* dataB = FJS_NDArray_GetData(arrayB);

	struct NDArray* arrayOut = FJS_NDArray_Create(dimensions, length, shape, dataType);
	if (arrayOut == NULL) {
		return FJS_Error_OutOfMemory;
	}

	void* dataOut = FJS_NDArray_GetData(arrayOut);
	computeFunction(length, dataA, dataB, dataOut);

	FJS_AllocateId(instance, idOut, arrayOut);
	return FJS_Error_Ok;
}

static enum FJS_Error executeBinaryConstOp(PP_Instance instance, int32_t idA, double valueB, int32_t idOut, const BinaryConstOpFunction computeFunctions[static 1]) {
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, idA);
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	const enum FJS_DataType dataType = arrayA->dataType;

	BinaryConstOpFunction computeFunction;
	switch (dataType) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			computeFunction = computeFunctions[dataType];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	const uint32_t dimensions = arrayA->dimensions;
	const uint32_t length = arrayA->length;
	const uint32_t* shape = FJS_NDArray_GetShape(arrayA);

	const void* dataA = FJS_NDArray_GetData(arrayA);

	struct NDArray* arrayOut = FJS_NDArray_Create(dimensions, length, shape, dataType);
	if (arrayOut == NULL) {
		return FJS_Error_OutOfMemory;
	}

	void* dataOut = FJS_NDArray_GetData(arrayOut);
	computeFunction(length, dataA, valueB, dataOut);

	FJS_AllocateId(instance, idOut, arrayOut);
	return FJS_Error_Ok;
}

static enum FJS_Error executeUnaryOp(PP_Instance instance, int32_t idA, int32_t idOut, const UnaryOpFunction computeFunctions[static 1]) {
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, idA);
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	const enum FJS_DataType dataType = arrayA->dataType;

	UnaryOpFunction computeFunction;
	switch (dataType) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			computeFunction = computeFunctions[dataType];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	const uint32_t dimensions = arrayA->dimensions;
	const uint32_t length = arrayA->length;
	const uint32_t* shape = FJS_NDArray_GetShape(arrayA);

	const void* dataA = FJS_NDArray_GetData(arrayA);

	struct NDArray* arrayOut = FJS_NDArray_Create(dimensions, length, shape, dataType);
	if (arrayOut == NULL) {
		return FJS_Error_OutOfMemory;
	}

	void* dataOut = FJS_NDArray_GetData(arrayOut);
	computeFunction(length, dataA, dataOut);

	FJS_AllocateId(instance, idOut, arrayOut);
	return FJS_Error_Ok;
}

static enum FJS_Error executeReduceOp(PP_Instance instance, int32_t idA, int32_t idOut, const ReduceOpFunction computeFunctions[static 1]) {
	struct NDArray* arrayA = FJS_GetPointerFromId(instance, idA);
	if (arrayA == NULL) {
		return FJS_Error_InvalidId;
	}

	const enum FJS_DataType dataType = arrayA->dataType;

	UnaryOpFunction computeFunction;
	switch (dataType) {
		case FJS_DataType_F64:
		case FJS_DataType_F32:
			computeFunction = computeFunctions[dataType];
			break;
		case FJS_DataType_Invalid:
		default:
			return FJS_Error_InvalidDataType;
	}

	const void* dataIn = FJS_NDArray_GetData(arrayA);
	const size_t lengthIn = arrayA->length;

	uint32_t outShape[1] = { 1 };
	struct NDArray* arrayOut = FJS_NDArray_Create(FJS_COUNT_OF(outShape), 1, outShape, dataType);
	if (arrayOut == NULL) {
		return FJS_Error_OutOfMemory;
	}

	void* dataOut = FJS_NDArray_GetData(arrayOut);
	computeFunction(lengthIn, dataIn, dataOut);

	FJS_AllocateId(instance, idOut, arrayOut);
	return FJS_Error_Ok;
}

/* Binary element-wise operations */

static void addF32(size_t length, const float dataA[restrict static length], const float dataB[restrict static length], float dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = (*dataA++) + (*dataB++);
	}
}

static void addF64(size_t length, const double dataA[restrict static length], const double dataB[restrict static length], double dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = (*dataA++) + (*dataB++);
	}
}

static void subF32(size_t length, const float dataA[restrict static length], const float dataB[restrict static length], float dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = (*dataA++) - (*dataB++);
	}
}

static void subF64(size_t length, const double dataA[restrict static length], const double dataB[restrict static length], double dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = (*dataA++) - (*dataB++);
	}
}

static void mulF32(size_t length, const float dataA[restrict static length], const float dataB[restrict static length], float dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = (*dataA++) * (*dataB++);
	}
}

static void mulF64(size_t length, const double dataA[restrict static length], const double dataB[restrict static length], double dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = (*dataA++) * (*dataB++);
	}
}

static void divF32(size_t length, const float dataA[restrict static length], const float dataB[restrict static length], float dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = (*dataA++) / (*dataB++);
	}
}

static void divF64(size_t length, const double dataA[restrict static length], const double dataB[restrict static length], double dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = (*dataA++) / (*dataB++);
	}
}

/* Binary element-wise operations with a constant */

static void addConstF32(size_t length, const float dataA[restrict static length], double dataB, float dataOut[restrict static length]) {
	const float dataBF32 = dataB;
	while (length--) {
		*dataOut++ = (*dataA++) + dataBF32;
	}
}

static void addConstF64(size_t length, const double dataA[restrict static length], double dataB, double dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = (*dataA++) + dataB;
	}
}

static void subConstF32(size_t length, const float dataA[restrict static length], double dataB, float dataOut[restrict static length]) {
	const float dataBF32 = dataB;
	while (length--) {
		*dataOut++ = (*dataA++) - dataBF32;
	}
}

static void subConstF64(size_t length, const double dataA[restrict static length], double dataB, double dataOut[restrict static length]) {
	const double* dataA_F64 = dataA;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut++ = (*dataA++) - dataB;
	}
}

static void mulConstF32(size_t length, const float dataA[restrict static length], double dataB, float dataOut[restrict static length]) {
	const float dataBF32 = dataB;
	while (length--) {
		*dataOut++ = (*dataA++) * dataBF32;
	}
}

static void mulConstF64(size_t length, const double dataA[restrict static length], double dataB, double dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = (*dataA++) * dataB;
	}
}

static void divConstF32(size_t length, const float dataA[restrict static length], double dataB, float dataOut[restrict static length]) {
	const float dataBF32 = dataB;
	while (length--) {
		*dataOut++ = (*dataA++) / dataBF32;
	}
}

static void divConstF64(size_t length, const double dataA[restrict static length], double dataB, double dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = (*dataA++) / dataB;
	}
}

/* Unary element-wise operations */

static void negF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = -(*dataIn++);
	}
}

static void negF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static length]) {
	const double* dataIn_F64 = dataIn;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut++ = -(*dataIn++);
	}
}

static void absF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = fabsf(*dataIn++);
	}
}

static void absF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = fabs(*dataIn++);
	}
}

static void expF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = expf(*dataIn++);
	}
}

static void expF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = exp(*dataIn++);
	}
}

static void logF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = logf(*dataIn++);
	}
}

static void logF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = log(*dataIn++);
	}
}

static void sqrtF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = sqrtf(*dataIn++);
	}
}

static void sqrtF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static length]) {
	while (length--) {
		*dataOut++ = sqrt(*dataIn++);
	}
}

static void squareF32(size_t length, const float dataIn[restrict static length], float dataOut[restrict static length]) {
	while (length--) {
		const float x = *dataIn++;
		*dataOut++ = x * x;
	}
}

static void squareF64(size_t length, const double dataIn[restrict static length], double dataOut[restrict static length]) {
	while (length--) {
		const double x = *dataIn++;
		*dataOut++ = x * x;
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
