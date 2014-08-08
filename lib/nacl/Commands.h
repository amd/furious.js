#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <ppapi/c/pp_instance.h>
#include <ppapi/c/pp_var.h>

#include "DataType.h"

enum FJS_Command {
	/* Invalid or unknown command */
	FJS_Command_Invalid = -1,
	/* Initialize */
	FJS_Command_Init,
	/* Create empty NDArray */
	FJS_Command_Empty,
	/* Create NDArray with zero elements */
	FJS_Command_Zeros,
	/* Create NDArray with identity elements */
	FJS_Command_Ones,
	/* Create NDArray from ArrayBuffer */
	FJS_Command_Array,
	/* Create NDArray the specified number on points evenly distributed on an interval */
	FJS_Command_LinSpace,
	/* Change NDArray shape (creates a copy of array data) */
	FJS_Command_ReShape,
	/* Repeat array elements along an axis */
	FJS_Command_Repeat,
	/* Delete NDArray */
	FJS_Command_Free,
	/* Get data as ArrayBuffer */
	FJS_Command_Get,
	/* Set data as ArrayBuffer */
	FJS_Command_Set,
	/* Get debug/profile information */
	FJS_Command_Info,
	/* Execution barrier */
	FJS_Command_Barrier,
	/* Add: z[i] <- x[i] + y[i] */
	FJS_Command_Add,
	/* Subtract: z[i] <- x[i] - y[i] */
	FJS_Command_Sub,
	/* Multiply: z[i] <- x[i] * y[i] */
	FJS_Command_Mul,
	/* Divide: z[i] <- x[i] / y[i] */
	FJS_Command_Div,
	/* Add constant: z[i] <- x[i] + y */
	FJS_Command_AddC,
	/* Subtract constant: z[i] <- x[i] - y */
	FJS_Command_SubC,
	/* Reverse subtract constant: z[i] <- x - y[i] */
	FJS_Command_RSubC,
	/* Multiply by constant: z[i] <- x[i] * y */
	FJS_Command_MulC,
	/* Divide by constant: z[i] <- x[i] / y */
	FJS_Command_DivC,
	/* Reverse divide by constant: z[i] <- x / y[i] */
	FJS_Command_RDivC,
	/* Negation: y[i] <- -x[i] */
	FJS_Command_Neg,
	/* Absolute value: y[i] <- abs(x[i]) */
	FJS_Command_Abs,
	/* Exponentiation: y[i] <- exp(x[i]) */
	FJS_Command_Exp,
	/* Logarithm: y[i] <- log(x[i]) */
	FJS_Command_Log,
	/* Square root: y[i] <- sqrt(x[i]) */
	FJS_Command_Sqrt,
	/* Square: y[i] <- x[i] * x[i] */
	FJS_Command_Square,
	/* All-array minimum */
	FJS_Command_Min,
	/* All-array maximum */
	FJS_Command_Max,
	/* All-array sum */
	FJS_Command_Sum,
	/* Axis minimum */
	FJS_Command_AxisMin,
	/* Axis maximum */
	FJS_Command_AxisMax,
	/* Axis sum */
	FJS_Command_AxisSum,
	/* Dot product: C[i, ..., j, k, ..., l, m] <- sum over x {A[i, ..., j, x] * B[k, ..., l, x, m]} */
	FJS_Command_Dot,
};

struct FJS_Buffer {
	void* pointer;
	uint32_t size;
};

struct FJS_Shape {
	uint32_t* buffer;
	uint32_t dimensions;
};

enum FJS_BinaryOperationType {
	FJS_BinaryOperationType_Add = 0,
	FJS_BinaryOperationType_Sub = 1,
	FJS_BinaryOperationType_Mul = 2,
	FJS_BinaryOperationType_Div = 3
};

enum FJS_BinaryConstOperationType {
	FJS_BinaryConstOperationType_AddC  = 0,
	FJS_BinaryConstOperationType_SubC  = 1,
	FJS_BinaryConstOperationType_SubRC = 2,
	FJS_BinaryConstOperationType_MulC  = 3,
	FJS_BinaryConstOperationType_DivC  = 4,
	FJS_BinaryConstOperationType_DivRC = 5
};

enum FJS_UnaryOperationType {
	FJS_UnaryOperationType_Neg    = 0,
	FJS_UnaryOperationType_Abs    = 1,
	FJS_UnaryOperationType_Exp    = 2,
	FJS_UnaryOperationType_Log    = 3,
	FJS_UnaryOperationType_Sqrt   = 4,
	FJS_UnaryOperationType_Square = 5
};

enum FJS_ReductionType {
	FJS_ReductionType_Sum = 0,
	FJS_ReductionType_Min = 1,
	FJS_ReductionType_Max = 2
};

enum FJS_AxisReductionType {
	FJS_AxisReductionType_Sum = 0,
	FJS_AxisReductionType_Min = 1,
	FJS_AxisReductionType_Max = 2
};

#ifdef __cplusplus
extern "C" {
#endif

enum FJS_Error FJS_Execute_CreateEmptyArray(PP_Instance instance, uint32_t idOut, struct FJS_Shape shape, enum FJS_DataType dataType);
enum FJS_Error FJS_Execute_CreateConstArray(PP_Instance instance, uint32_t idOut, struct FJS_Shape shape, enum FJS_DataType dataType, double fillValue);
enum FJS_Error FJS_Execute_CreateDataArray(PP_Instance instance, uint32_t idOut, struct FJS_Shape shape, enum FJS_DataType dataType, struct FJS_Buffer dataBuffer);
enum FJS_Error FJS_Execute_CreateIdentityMatrix(PP_Instance instance, uint32_t id_out, uint32_t rows, uint32_t columns, int32_t diagonal, enum FJS_DataType dataType);
enum FJS_Error FJS_Execute_LinSpace(PP_Instance instance, uint32_t idOut, double start, double stop, uint32_t samples, bool closed, enum FJS_DataType dataType);
enum FJS_Error FJS_Execute_ReShape(PP_Instance instance, int32_t idA, uint32_t idOut, struct FJS_Shape shapeOut);
enum FJS_Error FJS_Execute_Repeat(PP_Instance instance, int32_t idA, uint32_t idOut, uint32_t repeats, uint32_t axis);
enum FJS_Error FJS_Execute_DeAllocate(PP_Instance instance, int32_t idA);
enum FJS_Error FJS_Execute_Fetch(PP_Instance instance, int32_t idA, struct FJS_Buffer* buffer);
enum FJS_Error FJS_Execute_Info(PP_Instance instance, struct PP_Var* response);
enum FJS_Error FJS_Execute_BinaryOperation(PP_Instance instance, enum FJS_BinaryOperationType type, int32_t idA, int32_t idB, uint32_t idOut);
enum FJS_Error FJS_Execute_BinaryConstOperation(PP_Instance instance, enum FJS_BinaryConstOperationType type, int32_t idA, double valueB, uint32_t idOut);
enum FJS_Error FJS_Execute_UnaryOperation(PP_Instance instance, enum FJS_UnaryOperationType type, int32_t idA, uint32_t idOut);
enum FJS_Error FJS_Execute_Reduction(PP_Instance instance, enum FJS_ReductionType type, int32_t idA, uint32_t idOut);
enum FJS_Error FJS_Execute_AxisReduction(PP_Instance instance, enum FJS_AxisReductionType type, int32_t idA, uint32_t axis, uint32_t idOut);
enum FJS_Error FJS_Execute_DotOperation(PP_Instance instance, int32_t idA, int32_t idB, uint32_t idOut);
enum FJS_Error FJS_Execute_CholeskyDecomposition(PP_Instance instance, int32_t idA, bool isLower, uint32_t idOut);
enum FJS_Error FJS_Execute_SolveTriangular(PP_Instance instance, int32_t idA, int32_t idY, uint32_t idX, bool isLower, bool transpose, bool unitDiagonal);

#ifdef __cplusplus
} // extern "C"
#endif