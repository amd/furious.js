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

static void parseArithBinOp(PP_Instance instance, struct PP_Var message, const ArithBinOpComputeFunction computeFunctions[static 1]);
static enum NumJS_Error executeArithBinOp(PP_Instance instance, int32_t idA, int32_t idB, int32_t idOut, const ArithBinOpComputeFunction computeFunctions[static 1]);

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
	if (!NumJS_Message_SetStatus(NumJS_ResponseVariable, error)) {
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

	const uint32_t* shapeA = NumJS_NDArray_GetShape(arrayA);
	const uint32_t* shapeB = NumJS_NDArray_GetShape(arrayB);

	for (uint32_t i = 0; i < dimensions; i++) {
		if (shapeA[i] != shapeB[i]) {
			return NumJS_Error_MismatchingShape;
		}
	}

	const void* dataA = NumJS_NDArray_GetData(arrayA);
	const void* dataB = NumJS_NDArray_GetData(arrayB);

	struct NDArray* arrayOut = NumJS_NDArray_Create(dimensions, length, shapeA, dataType);
	if (arrayOut == NULL) {
		return NumJS_Error_OutOfMemory;
	}

	void* dataOut = NumJS_NDArray_GetData(arrayOut);
	computeFunction(dataA, dataB, dataOut, length);

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
