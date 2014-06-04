#include <stdlib.h>
#include <stdint.h>

#include "Error.h"
#include "DataType.h"
#include "NDArray.h"
#include "Commands.h"
#include "Interfaces.h"
#include "Message.h"
#include "Strings.h"
#include "IdMap.h"
#include "Util.h"

typedef void (*ArithBinOpComputeFunction)(const void*, const void*, void*, uint32_t);
static void computeAddF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void computeAddF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void computeSubF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void computeSubF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void computeMulF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void computeMulF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void computeDivF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length);
static void computeDivF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length);

typedef void (*ArithBinOpConstComputeFunction)(const void*, double, void*, uint32_t);
static void computeAddConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void computeAddConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void computeSubConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void computeSubConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void computeMulConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void computeMulConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void computeDivConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length);
static void computeDivConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length);

static const ArithBinOpComputeFunction addComputeFunctions[] = {
	[NumJS_DataType_F64] = computeAddF64,
	[NumJS_DataType_F32] = computeAddF32
};

static const ArithBinOpComputeFunction subComputeFunctions[] = {
	[NumJS_DataType_F64] = computeSubF64,
	[NumJS_DataType_F32] = computeSubF32
};

static const ArithBinOpComputeFunction mulComputeFunctions[] = {
	[NumJS_DataType_F64] = computeMulF64,
	[NumJS_DataType_F32] = computeMulF32
};

static const ArithBinOpComputeFunction divComputeFunctions[] = {
	[NumJS_DataType_F64] = computeDivF64,
	[NumJS_DataType_F32] = computeDivF32
};

static const ArithBinOpConstComputeFunction addConstComputeFunctions[] = {
	[NumJS_DataType_F64] = computeAddConstF64,
	[NumJS_DataType_F32] = computeAddConstF32
};

static const ArithBinOpConstComputeFunction subConstComputeFunctions[] = {
	[NumJS_DataType_F64] = computeSubConstF64,
	[NumJS_DataType_F32] = computeSubConstF32
};

static const ArithBinOpConstComputeFunction mulConstComputeFunctions[] = {
	[NumJS_DataType_F64] = computeMulConstF64,
	[NumJS_DataType_F32] = computeMulConstF32
};

static const ArithBinOpConstComputeFunction divConstComputeFunctions[] = {
	[NumJS_DataType_F64] = computeDivConstF64,
	[NumJS_DataType_F32] = computeDivConstF32
};

static void parseArithBinOp(PP_Instance instance, struct PP_Var message, const ArithBinOpComputeFunction computeFunctions[static 1]);
static void parseArithBinOpConst(PP_Instance instance, struct PP_Var message, const ArithBinOpConstComputeFunction computeFunctions[static 1]);
static enum NumJS_Error executeArithBinOp(PP_Instance instance, int32_t idA, int32_t idB, int32_t idOut, const ArithBinOpComputeFunction computeFunctions[static 1]);
static enum NumJS_Error executeArithBinOpConst(PP_Instance instance, int32_t idA, double valueB, int32_t idOut, const ArithBinOpConstComputeFunction computeFunctions[static 1]);

void NumJS_Parse_Add(PP_Instance instance, struct PP_Var message) {
	parseArithBinOp(instance, message, addComputeFunctions);
}

void NumJS_Parse_Sub(PP_Instance instance, struct PP_Var message) {
	parseArithBinOp(instance, message, subComputeFunctions);
}

void NumJS_Parse_Mul(PP_Instance instance, struct PP_Var message) {
	parseArithBinOp(instance, message, mulComputeFunctions);
}

void NumJS_Parse_Div(PP_Instance instance, struct PP_Var message) {
	parseArithBinOp(instance, message, divComputeFunctions);
}

void NumJS_Parse_AddC(PP_Instance instance, struct PP_Var message) {
	parseArithBinOpConst(instance, message, addConstComputeFunctions);
}

void NumJS_Parse_SubC(PP_Instance instance, struct PP_Var message) {
	parseArithBinOpConst(instance, message, subConstComputeFunctions);
}

void NumJS_Parse_MulC(PP_Instance instance, struct PP_Var message) {
	parseArithBinOpConst(instance, message, mulConstComputeFunctions);
}

void NumJS_Parse_DivC(PP_Instance instance, struct PP_Var message) {
	parseArithBinOpConst(instance, message, divConstComputeFunctions);
}

enum NumJS_ArithBinOp_Argument {
	NumJS_ArithBinOp_Argument_A,
	NumJS_ArithBinOp_Argument_B,
	NumJS_ArithBinOp_Argument_Out,
};

static const struct NumJS_VariableDescriptor binOpArithDescriptors[] =
{
	[NumJS_ArithBinOp_Argument_A] = { 
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_A
	},
	[NumJS_ArithBinOp_Argument_B] = {
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_B
	},
	[NumJS_ArithBinOp_Argument_Out] = {
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_Out
	}
};

static const struct NumJS_VariableDescriptor binOpConstArithDescriptors[] =
{
	[NumJS_ArithBinOp_Argument_A] = { 
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_A
	},
	[NumJS_ArithBinOp_Argument_B] = {
		.type = NumJS_VariableType_Float64,
		.name = NumJS_StringVariable_B
	},
	[NumJS_ArithBinOp_Argument_Out] = {
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_Out
	}
};

static void parseArithBinOp(PP_Instance instance, struct PP_Var message, const ArithBinOpComputeFunction computeFunctions[static 1]) {
	struct NumJS_Variable variables[NUMJS_COUNT_OF(binOpArithDescriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(binOpArithDescriptors), binOpArithDescriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = executeArithBinOp(instance,
		variables[NumJS_ArithBinOp_Argument_A].parsedValue.asInt32,
		variables[NumJS_ArithBinOp_Argument_B].parsedValue.asInt32,
		variables[NumJS_ArithBinOp_Argument_Out].parsedValue.asInt32,
		computeFunctions);
	if (!NumJS_Message_SetStatus(instance, NumJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, NumJS_ResponseVariable);

	NumJS_Message_RemoveStatus(NumJS_ResponseVariable);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

static void parseArithBinOpConst(PP_Instance instance, struct PP_Var message, const ArithBinOpConstComputeFunction computeFunctions[static 1]) {
	struct NumJS_Variable variables[NUMJS_COUNT_OF(binOpConstArithDescriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(binOpConstArithDescriptors), binOpConstArithDescriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = executeArithBinOpConst(instance,
		variables[NumJS_ArithBinOp_Argument_A].parsedValue.asInt32,
		variables[NumJS_ArithBinOp_Argument_B].parsedValue.asFloat64,
		variables[NumJS_ArithBinOp_Argument_Out].parsedValue.asInt32,
		computeFunctions);
	if (!NumJS_Message_SetStatus(instance, NumJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, NumJS_ResponseVariable);

	NumJS_Message_RemoveStatus(NumJS_ResponseVariable);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

static enum NumJS_Error executeArithBinOp(PP_Instance instance, int32_t idA, int32_t idB, int32_t idOut, const ArithBinOpComputeFunction computeFunctions[static 1]) {
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

	ArithBinOpComputeFunction computeFunction;
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

static enum NumJS_Error executeArithBinOpConst(PP_Instance instance, int32_t idA, double valueB, int32_t idOut, const ArithBinOpConstComputeFunction computeFunctions[static 1]) {
	struct NDArray* arrayA = NumJS_GetPointerFromId(instance, idA);
	if (arrayA == NULL) {
		return NumJS_Error_InvalidId;
	}

	const enum NumJS_DataType dataType = arrayA->dataType;

	ArithBinOpConstComputeFunction computeFunction;
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

static void computeAddF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float* dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) + (*dataB_F32++);
	}
}

static void computeAddF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	const double* dataB_F64 = dataB;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) + (*dataB_F64++);
	}
}

static void computeSubF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float* dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) - (*dataB_F32++);
	}
}

static void computeSubF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	const double* dataB_F64 = dataB;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) - (*dataB_F64++);
	}
}

static void computeMulF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float* dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) * (*dataB_F32++);
	}
}

static void computeMulF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	const double* dataB_F64 = dataB;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) * (*dataB_F64++);
	}
}

static void computeDivF32(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float* dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) / (*dataB_F32++);
	}
}

static void computeDivF64(const void* dataA, const void* dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	const double* dataB_F64 = dataB;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) / (*dataB_F64++);
	}
}

static void computeAddConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) + dataB_F32;
	}
}

static void computeAddConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) + dataB;
	}
}

static void computeSubConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) - dataB_F32;
	}
}

static void computeSubConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) - dataB;
	}
}

static void computeMulConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) * dataB_F32;
	}
}

static void computeMulConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) * dataB;
	}
}

static void computeDivConstF32(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const float* dataA_F32 = dataA;
	const float dataB_F32 = dataB;
	float* dataOut_F32 = dataOut;
	while (length--) {
		*dataOut_F32++ = (*dataA_F32++) / dataB_F32;
	}
}

static void computeDivConstF64(const void* dataA, double dataB, void* dataOut, uint32_t length) {
	const double* dataA_F64 = dataA;
	double* dataOut_F64 = dataOut;
	while (length--) {
		*dataOut_F64++ = (*dataA_F64++) / dataB;
	}
}
