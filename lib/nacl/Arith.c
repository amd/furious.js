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

typedef void (*BinaryOpFunction)(const void*, const void*, void*, uint32_t);
static void addF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void addF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void subF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void subF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void mulF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void mulF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void divF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void divF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length);

typedef void (*BinaryConstOpFunction)(const void*, double, void*, uint32_t);
static void addConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void addConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void subConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void subConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void mulConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void mulConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void divConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void divConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length);

typedef void (*UnaryOpFunction)(const void*, void*, uint32_t);
static void negF32(const void* dataIn, void* dataOut, uint32_t length);
static void negF64(const void* dataIn, void* dataOut, uint32_t length);
static void absF32(const void* dataIn, void* dataOut, uint32_t length);
static void absF64(const void* dataIn, void* dataOut, uint32_t length);
static void expF32(const void* dataIn, void* dataOut, uint32_t length);
static void expF64(const void* dataIn, void* dataOut, uint32_t length);
static void logF32(const void* dataIn, void* dataOut, uint32_t length);
static void logF64(const void* dataIn, void* dataOut, uint32_t length);
static void sqrtF32(const void* dataIn, void* dataOut, uint32_t length);
static void sqrtF64(const void* dataIn, void* dataOut, uint32_t length);
static void squareF32(const void* dataIn, void* dataOut, uint32_t length);
static void squareF64(const void* dataIn, void* dataOut, uint32_t length);

typedef void (*ReduceOpFunction)(const void*, void*, size_t);
static void minF32(const void* dataIn, void* dataOut, size_t length);
static void minF64(const void* dataIn, void* dataOut, size_t length);
static void maxF32(const void* dataIn, void* dataOut, size_t length);
static void maxF64(const void* dataIn, void* dataOut, size_t length);
static void sumF32(const void* dataIn, void* dataOut, size_t length);
static void sumF64(const void* dataIn, void* dataOut, size_t length);

static const BinaryOpFunction addFunctions[] = {
	[NumJS_DataType_F64] = addF64,
	[NumJS_DataType_F32] = addF32
};

static const BinaryOpFunction subFunctions[] = {
	[NumJS_DataType_F64] = subF64,
	[NumJS_DataType_F32] = subF32
};

static const BinaryOpFunction mulFunctions[] = {
	[NumJS_DataType_F64] = mulF64,
	[NumJS_DataType_F32] = mulF32
};

static const BinaryOpFunction divFunctions[] = {
	[NumJS_DataType_F64] = divF64,
	[NumJS_DataType_F32] = divF32
};

static const BinaryConstOpFunction addConstFunctions[] = {
	[NumJS_DataType_F64] = addConstF64,
	[NumJS_DataType_F32] = addConstF32
};

static const BinaryConstOpFunction subConstFunctions[] = {
	[NumJS_DataType_F64] = subConstF64,
	[NumJS_DataType_F32] = subConstF32
};

static const BinaryConstOpFunction mulConstFunctions[] = {
	[NumJS_DataType_F64] = mulConstF64,
	[NumJS_DataType_F32] = mulConstF32
};

static const BinaryConstOpFunction divConstFunctions[] = {
	[NumJS_DataType_F64] = divConstF64,
	[NumJS_DataType_F32] = divConstF32
};

static const UnaryOpFunction negFunctions[] = {
	[NumJS_DataType_F64] = negF64,
	[NumJS_DataType_F32] = negF32
};

static const UnaryOpFunction absFunctions[] = {
	[NumJS_DataType_F64] = absF64,
	[NumJS_DataType_F32] = absF32
};

static const UnaryOpFunction expFunctions[] = {
	[NumJS_DataType_F64] = expF64,
	[NumJS_DataType_F32] = expF32
};

static const UnaryOpFunction logFunctions[] = {
	[NumJS_DataType_F64] = logF64,
	[NumJS_DataType_F32] = logF32
};

static const UnaryOpFunction sqrtFunctions[] = {
	[NumJS_DataType_F64] = sqrtF64,
	[NumJS_DataType_F32] = sqrtF32
};

static const UnaryOpFunction squareFunctions[] = {
	[NumJS_DataType_F64] = squareF64,
	[NumJS_DataType_F32] = squareF32
};

static const ReduceOpFunction minFunctions[] = {
	[NumJS_DataType_F64] = minF64,
	[NumJS_DataType_F32] = minF32
};

static const ReduceOpFunction maxFunctions[] = {
	[NumJS_DataType_F64] = maxF64,
	[NumJS_DataType_F32] = maxF32
};

static const ReduceOpFunction sumFunctions[] = {
	[NumJS_DataType_F64] = sumF64,
	[NumJS_DataType_F32] = sumF32
};

static void parseBinaryOp(PP_Instance instance, struct PP_Var message, const BinaryOpFunction computeFunctions[static 1]);
static void parseBinaryConstOp(PP_Instance instance, struct PP_Var message, const BinaryConstOpFunction computeFunctions[static 1]);
static void parseUnaryOp(PP_Instance instance, struct PP_Var message, const UnaryOpFunction computeFunctions[static 1]);
static void parseReduceOp(PP_Instance instance, struct PP_Var message, const ReduceOpFunction computeFunctions[static 1]);
static enum NumJS_Error executeBinaryOp(PP_Instance instance, int32_t idA, int32_t idB, int32_t idOut, const BinaryOpFunction computeFunctions[static 1]);
static enum NumJS_Error executeBinaryConstOp(PP_Instance instance, int32_t idA, double valueB, int32_t idOut, const BinaryConstOpFunction computeFunctions[static 1]);
static enum NumJS_Error executeUnaryOp(PP_Instance instance, int32_t idA, int32_t idOut, const UnaryOpFunction computeFunctions[static 1]);
static enum NumJS_Error executeReduceOp(PP_Instance instance, int32_t idA, int32_t idOut, const ReduceOpFunction computeFunctions[static 1]);

void NumJS_Parse_Add(PP_Instance instance, struct PP_Var message) {
	parseBinaryOp(instance, message, addFunctions);
}

void NumJS_Parse_Sub(PP_Instance instance, struct PP_Var message) {
	parseBinaryOp(instance, message, subFunctions);
}

void NumJS_Parse_Mul(PP_Instance instance, struct PP_Var message) {
	parseBinaryOp(instance, message, mulFunctions);
}

void NumJS_Parse_Div(PP_Instance instance, struct PP_Var message) {
	parseBinaryOp(instance, message, divFunctions);
}

void NumJS_Parse_AddC(PP_Instance instance, struct PP_Var message) {
	parseBinaryConstOp(instance, message, addConstFunctions);
}

void NumJS_Parse_SubC(PP_Instance instance, struct PP_Var message) {
	parseBinaryConstOp(instance, message, subConstFunctions);
}

void NumJS_Parse_MulC(PP_Instance instance, struct PP_Var message) {
	parseBinaryConstOp(instance, message, mulConstFunctions);
}

void NumJS_Parse_DivC(PP_Instance instance, struct PP_Var message) {
	parseBinaryConstOp(instance, message, divConstFunctions);
}

void NumJS_Parse_Neg(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, negFunctions);
}

void NumJS_Parse_Abs(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, absFunctions);
}

void NumJS_Parse_Exp(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, expFunctions);
}

void NumJS_Parse_Log(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, logFunctions);
}

void NumJS_Parse_Sqrt(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, sqrtFunctions);
}

void NumJS_Parse_Square(PP_Instance instance, struct PP_Var message) {
	parseUnaryOp(instance, message, squareFunctions);
}

void NumJS_Parse_Min(PP_Instance instance, struct PP_Var message) {
	parseReduceOp(instance, message, minFunctions);
}

void NumJS_Parse_Max(PP_Instance instance, struct PP_Var message) {
	parseReduceOp(instance, message, maxFunctions);
}

void NumJS_Parse_Sum(PP_Instance instance, struct PP_Var message) {
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

static const struct NumJS_VariableDescriptor binaryOpDescriptors[] =
{
	[BinaryOp_Argument_A] = { 
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_A
	},
	[BinaryOp_Argument_B] = {
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_B
	},
	[BinaryOp_Argument_Out] = {
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_Out
	}
};

static const struct NumJS_VariableDescriptor binaryConstOpDescriptors[] =
{
	[BinaryOp_Argument_A] = { 
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_A
	},
	[BinaryOp_Argument_B] = {
		.type = NumJS_VariableType_Float64,
		.name = NumJS_StringVariable_B
	},
	[BinaryOp_Argument_Out] = {
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_Out
	}
};

static const struct NumJS_VariableDescriptor unaryOpDescriptors[] =
{
	[UnaryOp_Argument_A] = { 
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_A
	},
	[UnaryOp_Argument_Out] = {
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_Out
	}
};

static const struct NumJS_VariableDescriptor reduceOpDescriptors[] =
{
	[UnaryOp_Argument_A] = { 
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_A
	},
	[UnaryOp_Argument_Out] = {
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_Out
	}
};

static void parseBinaryOp(PP_Instance instance, struct PP_Var message, const BinaryOpFunction computeFunctions[static 1]) {
	struct NumJS_Variable variables[NUMJS_COUNT_OF(binaryOpDescriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(binaryOpDescriptors), binaryOpDescriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = executeBinaryOp(instance,
		variables[BinaryOp_Argument_A].parsedValue.asInt32,
		variables[BinaryOp_Argument_B].parsedValue.asInt32,
		variables[BinaryOp_Argument_Out].parsedValue.asInt32,
		computeFunctions);
	if (!NumJS_Message_SetStatus(instance, NumJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, NumJS_ResponseVariable);

	NumJS_Message_RemoveStatus(NumJS_ResponseVariable);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

static void parseBinaryConstOp(PP_Instance instance, struct PP_Var message, const BinaryConstOpFunction computeFunctions[static 1]) {
	struct NumJS_Variable variables[NUMJS_COUNT_OF(binaryConstOpDescriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(binaryConstOpDescriptors), binaryConstOpDescriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = executeBinaryConstOp(instance,
		variables[BinaryOp_Argument_A].parsedValue.asInt32,
		variables[BinaryOp_Argument_B].parsedValue.asFloat64,
		variables[BinaryOp_Argument_Out].parsedValue.asInt32,
		computeFunctions);
	if (!NumJS_Message_SetStatus(instance, NumJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, NumJS_ResponseVariable);

	NumJS_Message_RemoveStatus(NumJS_ResponseVariable);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

static void parseUnaryOp(PP_Instance instance, struct PP_Var message, const UnaryOpFunction computeFunctions[static 1]) {
	struct NumJS_Variable variables[NUMJS_COUNT_OF(unaryOpDescriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(unaryOpDescriptors), unaryOpDescriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = executeUnaryOp(instance,
		variables[UnaryOp_Argument_A].parsedValue.asInt32,
		variables[UnaryOp_Argument_Out].parsedValue.asInt32,
		computeFunctions);
	if (!NumJS_Message_SetStatus(instance, NumJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, NumJS_ResponseVariable);

	NumJS_Message_RemoveStatus(NumJS_ResponseVariable);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

static void parseReduceOp(PP_Instance instance, struct PP_Var message, const ReduceOpFunction computeFunctions[static 1]) {
	struct NumJS_Variable variables[NUMJS_COUNT_OF(unaryOpDescriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(unaryOpDescriptors), unaryOpDescriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = executeReduceOp(instance,
		variables[UnaryOp_Argument_A].parsedValue.asInt32,
		variables[UnaryOp_Argument_Out].parsedValue.asInt32,
		computeFunctions);
	if (!NumJS_Message_SetStatus(instance, NumJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, NumJS_ResponseVariable);

	NumJS_Message_RemoveStatus(NumJS_ResponseVariable);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

static enum NumJS_Error executeBinaryOp(PP_Instance instance, int32_t idA, int32_t idB, int32_t idOut, const BinaryOpFunction computeFunctions[static 1]) {
	struct NDArray* arrayA = NumJS_GetPointerFromId(instance, idA);
	if (arrayA == NULL) {
		return NumJS_Error_InvalidId;
	}

	struct NDArray* arrayB = NumJS_GetPointerFromId(instance, idB);
	if (arrayB == NULL) {
		return NumJS_Error_InvalidId;
	}

	const enum NumJS_DataType dataType = arrayA->dataType;
	if (dataType != arrayB->dataType) {
		return NumJS_Error_MismatchingDataType;
	}

	BinaryOpFunction computeFunction;
	switch (dataType) {
		case NumJS_DataType_F64:
		case NumJS_DataType_F32:
			computeFunction = computeFunctions[dataType];
			break;
		case NumJS_DataType_Invalid:
		default:
			return NumJS_Error_InvalidDataType;
	}

	const uint32_t dimensions = arrayA->dimensions;
	if (dimensions != arrayB->dimensions) {
		return NumJS_Error_MismatchingDimensions;
	}

	uint32_t length = arrayA->length;
	if (length != arrayB->length) {
		return NumJS_Error_MismatchingShape;
	}

	const uint32_t* shape = NumJS_NDArray_GetShape(arrayA);
	const uint32_t* shapeB = NumJS_NDArray_GetShape(arrayB);

	for (uint32_t i = 0; i < dimensions; i++) {
		if (shape[i] != shapeB[i]) {
			return NumJS_Error_MismatchingShape;
		}
	}

	const void* dataA = NumJS_NDArray_GetData(arrayA);
	const void* dataB = NumJS_NDArray_GetData(arrayB);

	struct NDArray* arrayOut = NumJS_NDArray_Create(dimensions, length, shape, dataType);
	if (arrayOut == NULL) {
		return NumJS_Error_OutOfMemory;
	}

	void* dataOut = NumJS_NDArray_GetData(arrayOut);
	computeFunction(dataA, dataB, dataOut, length);

	NumJS_AllocateId(instance, idOut, arrayOut);
	return NumJS_Error_Ok;
}

static enum NumJS_Error executeBinaryConstOp(PP_Instance instance, int32_t idA, double valueB, int32_t idOut, const BinaryConstOpFunction computeFunctions[static 1]) {
	struct NDArray* arrayA = NumJS_GetPointerFromId(instance, idA);
	if (arrayA == NULL) {
		return NumJS_Error_InvalidId;
	}

	const enum NumJS_DataType dataType = arrayA->dataType;

	BinaryConstOpFunction computeFunction;
	switch (dataType) {
		case NumJS_DataType_F64:
		case NumJS_DataType_F32:
			computeFunction = computeFunctions[dataType];
			break;
		case NumJS_DataType_Invalid:
		default:
			return NumJS_Error_InvalidDataType;
	}

	const uint32_t dimensions = arrayA->dimensions;
	const uint32_t length = arrayA->length;
	const uint32_t* shape = NumJS_NDArray_GetShape(arrayA);

	const void* dataA = NumJS_NDArray_GetData(arrayA);

	struct NDArray* arrayOut = NumJS_NDArray_Create(dimensions, length, shape, dataType);
	if (arrayOut == NULL) {
		return NumJS_Error_OutOfMemory;
	}

	void* dataOut = NumJS_NDArray_GetData(arrayOut);
	computeFunction(dataA, valueB, dataOut, length);

	NumJS_AllocateId(instance, idOut, arrayOut);
	return NumJS_Error_Ok;
}

static enum NumJS_Error executeUnaryOp(PP_Instance instance, int32_t idA, int32_t idOut, const UnaryOpFunction computeFunctions[static 1]) {
	struct NDArray* arrayA = NumJS_GetPointerFromId(instance, idA);
	if (arrayA == NULL) {
		return NumJS_Error_InvalidId;
	}

	const enum NumJS_DataType dataType = arrayA->dataType;

	UnaryOpFunction computeFunction;
	switch (dataType) {
		case NumJS_DataType_F64:
		case NumJS_DataType_F32:
			computeFunction = computeFunctions[dataType];
			break;
		case NumJS_DataType_Invalid:
		default:
			return NumJS_Error_InvalidDataType;
	}

	const uint32_t dimensions = arrayA->dimensions;
	const uint32_t length = arrayA->length;
	const uint32_t* shape = NumJS_NDArray_GetShape(arrayA);

	const void* dataA = NumJS_NDArray_GetData(arrayA);

	struct NDArray* arrayOut = NumJS_NDArray_Create(dimensions, length, shape, dataType);
	if (arrayOut == NULL) {
		return NumJS_Error_OutOfMemory;
	}

	void* dataOut = NumJS_NDArray_GetData(arrayOut);
	computeFunction(dataA, dataOut, length);

	NumJS_AllocateId(instance, idOut, arrayOut);
	return NumJS_Error_Ok;
}

static enum NumJS_Error executeReduceOp(PP_Instance instance, int32_t idA, int32_t idOut, const ReduceOpFunction computeFunctions[static 1]) {
	struct NDArray* arrayA = NumJS_GetPointerFromId(instance, idA);
	if (arrayA == NULL) {
		return NumJS_Error_InvalidId;
	}

	const enum NumJS_DataType dataType = arrayA->dataType;

	UnaryOpFunction computeFunction;
	switch (dataType) {
		case NumJS_DataType_F64:
		case NumJS_DataType_F32:
			computeFunction = computeFunctions[dataType];
			break;
		case NumJS_DataType_Invalid:
		default:
			return NumJS_Error_InvalidDataType;
	}

	const void* dataIn = NumJS_NDArray_GetData(arrayA);
	const size_t lengthIn = arrayA->length;

	uint32_t outShape[1] = { 1 };
	struct NDArray* arrayOut = NumJS_NDArray_Create(NUMJS_COUNT_OF(outShape), 1, outShape, dataType);
	if (arrayOut == NULL) {
		return NumJS_Error_OutOfMemory;
	}

	void* dataOut = NumJS_NDArray_GetData(arrayOut);
	computeFunction(dataIn, dataOut, lengthIn);

	NumJS_AllocateId(instance, idOut, arrayOut);
	return NumJS_Error_Ok;
}

static void addF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float* dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) + (*dataB_F32++);
	}
}

static void addF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	const double* dataB_F64 = dataB;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) + (*dataB_F64++);
	}
}

static void subF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float* dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) - (*dataB_F32++);
	}
}

static void subF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	const double* dataB_F64 = dataB;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) - (*dataB_F64++);
	}
}

static void mulF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float* dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) * (*dataB_F32++);
	}
}

static void mulF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	const double* dataB_F64 = dataB;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) * (*dataB_F64++);
	}
}

static void divF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float* dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) / (*dataB_F32++);
	}
}

static void divF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	const double* dataB_F64 = dataB;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) / (*dataB_F64++);
	}
}

static void addConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) + dataB_F32;
	}
}

static void addConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) + dataB;
	}
}

static void subConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) - dataB_F32;
	}
}

static void subConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) - dataB;
	}
}

static void mulConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) * dataB_F32;
	}
}

static void mulConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) * dataB;
	}
}

static void divConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) / dataB_F32;
	}
}

static void divConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) / dataB;
	}
}

static void negF32(const void* dataIn, void* dataOut, uint32_t length) {
	const float* dataIn_F32 = dataIn;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = -(*dataIn_F32++);
	}
}

static void negF64(const void* dataIn, void* dataOut, uint32_t length) {
	const double* dataIn_F64 = dataIn;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = -(*dataIn_F64++);
	}
}

static void absF32(const void* dataIn, void* dataOut, uint32_t length) {
	const float* dataIn_F32 = dataIn;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = fabsf(*dataIn_F32++);
	}
}

static void absF64(const void* dataIn, void* dataOut, uint32_t length) {
	const double* dataIn_F64 = dataIn;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = fabs(*dataIn_F64++);
	}
}

static void expF32(const void* dataIn, void* dataOut, uint32_t length) {
	const float* dataIn_F32 = dataIn;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = expf(*dataIn_F32++);
	}
}

static void expF64(const void* dataIn, void* dataOut, uint32_t length) {
	const double* dataIn_F64 = dataIn;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = exp(*dataIn_F64++);
	}
}

static void logF32(const void* dataIn, void* dataOut, uint32_t length) {
	const float* dataIn_F32 = dataIn;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = logf(*dataIn_F32++);
	}
}

static void logF64(const void* dataIn, void* dataOut, uint32_t length) {
	const double* dataIn_F64 = dataIn;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = log(*dataIn_F64++);
	}
}

static void sqrtF32(const void* dataIn, void* dataOut, uint32_t length) {
	const float* dataIn_F32 = dataIn;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = sqrtf(*dataIn_F32++);
	}
}

static void sqrtF64(const void* dataIn, void* dataOut, uint32_t length) {
	const double* dataIn_F64 = dataIn;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = sqrt(*dataIn_F64++);
	}
}

static void squareF32(const void* dataIn, void* dataOut, uint32_t length) {
	const float* dataIn_F32 = dataIn;
	float* dataOut_F32 = dataOut;
	while (length--) {
		const float x = *dataIn_F32++;
		*dataOut_F32++ = x * x;
	}
}

static void squareF64(const void* dataIn, void* dataOut, uint32_t length) {
	const double* dataIn_F64 = dataIn;
	double* dataOut_F64 = dataOut;
	while (length--) {
		const double x = *dataIn_F64++;
		*dataOut_F64++ = x * x;
	}
}


static void minF32(const void* dataIn, void* dataOut, uint32_t length) {
	const float* dataIn_F32 = dataIn;
	float* dataOut_F32 = dataOut;
	if (length == 0) {
		*dataOut_F32 = __builtin_nanf("");
	} else {
		float min = *dataIn_F32++;
		while (--length) {
			const float val = *dataIn_F32++;
			min = min < val ? min : val;
		}
		*dataOut_F32 = min;
	}
}

static void minF64(const void* dataIn, void* dataOut, uint32_t length) {
	const double* dataIn_F64 = dataIn;
	double* dataOut_F64 = dataOut;
	if (length == 0) {
		*dataOut_F64 = __builtin_nan("");
	} else {
		double min = *dataIn_F64++;
		while (--length) {
			const double val = *dataIn_F64++;
			min = min < val ? min : val;
		}
		*dataOut_F64 = min;
	}
}

static void maxF32(const void* dataIn, void* dataOut, uint32_t length) {
	const float* dataIn_F32 = dataIn;
	float* dataOut_F32 = dataOut;
	if (length == 0) {
		*dataOut_F32 = __builtin_nanf("");
	} else {
		float max = *dataIn_F32++;
		while (--length) {
			const float val = *dataIn_F32++;
			max = max < val ? val : max;
		}
		*dataOut_F32 = max;
	}
}

static void maxF64(const void* dataIn, void* dataOut, uint32_t length) {
	const double* dataIn_F64 = dataIn;
	double* dataOut_F64 = dataOut;
	if (length == 0) {
		*dataOut_F64 = __builtin_nan("");
	} else {
		double max = *dataIn_F64++;
		while (--length) {
			const double val = *dataIn_F64++;
			max = max < val ? val : max;
		}
		*dataOut_F64 = max;
	}
}

static void sumF32(const void* dataIn, void* dataOut, uint32_t length) {
	const float* dataIn_F32 = dataIn;
	float* dataOut_F32 = dataOut;
	float s = 0.0f;
	while (length--) {
		s += *dataIn_F32++;
	}
	*dataOut_F32 = s;
}

static void sumF64(const void* dataIn, void* dataOut, uint32_t length) {
	const double* dataIn_F64 = dataIn;
	double* dataOut_F64 = dataOut;
	double s = 0.0;
	while (length--) {
		s += *dataIn_F64++;
	}
	*dataOut_F64 = s;
}
