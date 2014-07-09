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

struct FJS_Empty_Command_Arguments {
	int32_t idOut;
	struct FJS_Shape shape;
	enum FJS_DataType dataType;
};

struct FJS_Zeros_Command_Arguments {
	int32_t idOut;
	struct FJS_Shape shape;
	enum FJS_DataType dataType;
};

struct FJS_Ones_Command_Arguments {
	int32_t idOut;
	struct FJS_Shape shape;
	enum FJS_DataType dataType;
};

struct FJS_Array_Command_Arguments {
	int32_t idOut;
	struct FJS_Shape shape;
	enum FJS_DataType dataType;
	struct FJS_Buffer buffer;
};

struct FJS_LinSpace_Command_Arguments {
	int32_t idOut;
	double start;
	double stop;
	int32_t samples;
	bool closed;
	enum FJS_DataType dataType;
};

struct FJS_ReShape_Command_Arguments {
	int32_t idA;
	int32_t idOut;
	struct FJS_Shape shapeOut;
};

struct FJS_Repeat_Command_Arguments {
	int32_t idA;
	int32_t idOut;
	int32_t repeats;
	int32_t axis;
};

struct FJS_Free_Command_Arguments {
	int32_t idA;
};

struct FJS_Get_Command_Arguments {
	int32_t idA;
};

struct FJS_BinaryOp_Command_Arguments {
	int32_t idA;
	int32_t idB;
	int32_t idOut;
	enum FJS_Command command;
};

struct FJS_BinaryConstOp_Command_Arguments {
	int32_t idA;
	double valueB;
	int32_t idOut;
	enum FJS_Command command;
};

struct FJS_UnaryOp_Command_Arguments {
	int32_t idA;
	int32_t idOut;
	enum FJS_Command command;
};

struct FJS_ReduceOp_Command_Arguments {
	int32_t idA;
	int32_t idOut;
	enum FJS_Command command;
};

struct FJS_AxisReduceOp_Command_Arguments {
	int32_t idA;
	int32_t axis;
	int32_t idOut;
	enum FJS_Command command;
};

struct FJS_Dot_Command_Arguments {
	int32_t idA;
	int32_t idB;
	int32_t idOut;
};

enum FJS_Command FJS_Command_Parse(const char* string, uint32_t size);

typedef enum FJS_Error (*FJS_Execute_Function)(PP_Instance instance, const void* arguments, struct PP_Var response[static 1]);

enum FJS_Error FJS_Execute_Empty(PP_Instance instance, const struct FJS_Empty_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Zeros(PP_Instance instance, const struct FJS_Zeros_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Ones(PP_Instance instance, const struct FJS_Ones_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Array(PP_Instance instance, const struct FJS_Array_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_LinSpace(PP_Instance instance, const struct FJS_LinSpace_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_ReShape(PP_Instance instance, const struct FJS_ReShape_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Repeat(PP_Instance instance, const struct FJS_Repeat_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Free(PP_Instance instance, const struct FJS_Free_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Get(PP_Instance instance, const struct FJS_Get_Command_Arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Info(PP_Instance instance, const void*, struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Add(PP_Instance instance, const struct FJS_BinaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Sub(PP_Instance instance, const struct FJS_BinaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Mul(PP_Instance instance, const struct FJS_BinaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Div(PP_Instance instance, const struct FJS_BinaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_AddC(PP_Instance instance, const struct FJS_BinaryConstOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_SubC(PP_Instance instance, const struct FJS_BinaryConstOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_MulC(PP_Instance instance, const struct FJS_BinaryConstOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_DivC(PP_Instance instance, const struct FJS_BinaryConstOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Neg(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Abs(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Exp(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Log(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Sqrt(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Square(PP_Instance instance, const struct FJS_UnaryOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Min(PP_Instance instance, const struct FJS_ReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Max(PP_Instance instance, const struct FJS_ReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Sum(PP_Instance instance, const struct FJS_ReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_AxisMin(PP_Instance instance, const struct FJS_AxisReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_AxisMax(PP_Instance instance, const struct FJS_AxisReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_AxisSum(PP_Instance instance, const struct FJS_AxisReduceOp_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);
enum FJS_Error FJS_Execute_Dot(PP_Instance instance, const struct FJS_Dot_Command_Arguments arguments[static 1], struct PP_Var response[static 1]);

struct FJS_Command_Descriptor {
	size_t argumentsSize;
	size_t argumentsCount;
	const struct FJS_ArgumentDescriptor* argumentsDescriptors;
	size_t cleanupEntries;
	const enum FJS_StringVariable* cleanupNames;
	FJS_Execute_Function executeFunction;
};

extern const struct FJS_Command_Descriptor FJS_Command_Descriptors[];
