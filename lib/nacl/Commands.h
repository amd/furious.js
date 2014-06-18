#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <ppapi/c/pp_instance.h>
#include <ppapi/c/pp_var.h>

#include "DataType.h"

enum FJS_Command {
	/* Invalid or unknown command */
	FJS_Command_Invalid = -1,
	/* Create NDArray */
	FJS_Command_Create,
	/* Create NDArray from ArrayBuffer */
	FJS_Command_CreateFromBuffer,
	/* Create NDArray from JS Array */
	FJS_Command_CreateFromArray,
	/* Create NDArray the specified number on points evenly distributed on an interval */
	FJS_Command_LinSpace,
	/* Delete NDArray */
	FJS_Command_Release,
	/* Get data as ArrayBuffer */
	FJS_Command_GetBuffer,
	/* Get data as JS Array */
	FJS_Command_GetArray,
	/* Set data as ArrayBuffer */
	FJS_Command_SetBuffer,
	/* Set data as JS Array */
	FJS_Command_SetArray,
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
};

enum FJS_Command FJS_Command_Parse(const char* string, uint32_t size);

void FJS_Parse_Create(PP_Instance instance, struct PP_Var message);
void FJS_Parse_CreateFromBuffer(PP_Instance instance, struct PP_Var message);
void FJS_Parse_LinSpace(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Release(PP_Instance instance, struct PP_Var message);
void FJS_Parse_GetBuffer(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Add(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Sub(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Mul(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Div(PP_Instance instance, struct PP_Var message);
void FJS_Parse_AddC(PP_Instance instance, struct PP_Var message);
void FJS_Parse_SubC(PP_Instance instance, struct PP_Var message);
void FJS_Parse_MulC(PP_Instance instance, struct PP_Var message);
void FJS_Parse_DivC(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Neg(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Abs(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Exp(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Log(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Sqrt(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Square(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Min(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Max(PP_Instance instance, struct PP_Var message);
void FJS_Parse_Sum(PP_Instance instance, struct PP_Var message);
void FJS_Parse_AxisMin(PP_Instance instance, struct PP_Var message);
void FJS_Parse_AxisMax(PP_Instance instance, struct PP_Var message);
void FJS_Parse_AxisSum(PP_Instance instance, struct PP_Var message);

enum FJS_Error FJS_Execute_Create(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum FJS_DataType dataType);
enum FJS_Error FJS_Execute_CreateFromBuffer(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum FJS_DataType dataType, uint32_t bufferSize, void* buffer);
enum FJS_Error FJS_Execute_LinSpace(PP_Instance instance, int32_t idOut, double start, double stop, int32_t samples, bool closed, enum FJS_DataType dataType);
enum FJS_Error FJS_Execute_Release(PP_Instance instance, int32_t idIn);
enum FJS_Error FJS_Execute_GetBuffer(PP_Instance instance, int32_t idIn, struct PP_Var bufferOut[static 1]);
enum FJS_Error FJS_Execute_GetArray(PP_Instance instance, int32_t idIn, struct PP_Var arrayOut[static 1]);
