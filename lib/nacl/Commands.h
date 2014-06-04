#pragma once

#include <ppapi/c/pp_instance.h>
#include <ppapi/c/pp_var.h>

#include "DataType.h"

enum NumJS_Command {
	/* Invalid or unknown command */
	NumJS_Command_Invalid = -1,
	/* Create NDArray */
	NumJS_Command_Create,
	/* Create NDArray from ArrayBuffer */
	NumJS_Command_CreateFromBuffer,
	/* Create NDArray from JS Array */
	NumJS_Command_CreateFromArray,
	/* Delete NDArray */
	NumJS_Command_Release,
	/* Get data as ArrayBuffer */
	NumJS_Command_GetBuffer,
	/* Get data as JS Array */
	NumJS_Command_GetArray,
	/* Set data as ArrayBuffer */
	NumJS_Command_SetBuffer,
	/* Set data as JS Array */
	NumJS_Command_SetArray,
	/* Add: z[i] <- x[i] + y[i] */
	NumJS_Command_Add,
	/* Subtract: z[i] <- x[i] - y[i] */
	NumJS_Command_Sub,
	/* Multiply: z[i] <- x[i] * y[i] */
	NumJS_Command_Mul,
	/* Divide: z[i] <- x[i] / y[i] */
	NumJS_Command_Div,
	/* In-place add: x[i] <- x[i] + y[i] */
	NumJS_Command_IAdd,
	/* In-place subtract: x[i] <- x[i] - y[i] */
	NumJS_Command_ISub,
	/* In-place reverse subtract: x[i] <- y[i] - x[i] */
	NumJS_Command_IRSub,
	/* In-place multuply: x[i] <- x[i] * y[i] */
	NumJS_Command_IMul,
	/* In-place divide: x[i] <- x[i] / y[i] */
	NumJS_Command_IDiv,
	/* In-place reverse divide: x[i] = y[i] / x[i] */
	NumJS_Command_IRDiv,
	/* Add constant: z[i] <- x[i] + y */
	NumJS_Command_AddC,
	/* Subtract constant: z[i] <- x[i] - y */
	NumJS_Command_SubC,
	/* Reverse subtract constant: z[i] <- x - y[i] */
	NumJS_Command_RSubC,
	/* Multiply by constant: z[i] <- x[i] * y */
	NumJS_Command_MulC,
	/* Divide by constant: z[i] <- x[i] / y */
	NumJS_Command_DivC,
	/* Reverse divide by constant: z[i] <- x / y[i] */
	NumJS_Command_RDivC,
	/* In-place add constant: x[i] <- x[i] + y */
	NumJS_Command_IAddC,
	/* In-place subtract constant: x[i] <- x[i] - y */
	NumJS_Command_ISubC,
	/* In-place reverse subtract constant: y[i] <- x - y[i] */
	NumJS_Command_IRSubC,
	/* In-place multuply by constant: x[i] <- x[i] * y */
	NumJS_Command_IMulC,
	/* In-place divide by constant: x[i] <- x[i] / y */
	NumJS_Command_IDivC,
	/* In-place reverse divide by constant: y[i] = x / y[i] */
	NumJS_Command_IRDivC
};

enum NumJS_Command NumJS_Command_Parse(const char* string, uint32_t size);

void NumJS_Parse_Create(PP_Instance instance, struct PP_Var message);
void NumJS_Parse_CreateFromBuffer(PP_Instance instance, struct PP_Var message);
void NumJS_Parse_Release(PP_Instance instance, struct PP_Var message);
void NumJS_Parse_GetBuffer(PP_Instance instance, struct PP_Var message);
void NumJS_Parse_Add(PP_Instance instance, struct PP_Var message);
void NumJS_Parse_Sub(PP_Instance instance, struct PP_Var message);
void NumJS_Parse_Mul(PP_Instance instance, struct PP_Var message);
void NumJS_Parse_Div(PP_Instance instance, struct PP_Var message);
void NumJS_Parse_AddC(PP_Instance instance, struct PP_Var message);
void NumJS_Parse_SubC(PP_Instance instance, struct PP_Var message);
void NumJS_Parse_MulC(PP_Instance instance, struct PP_Var message);
void NumJS_Parse_DivC(PP_Instance instance, struct PP_Var message);

enum NumJS_Error NumJS_Execute_Create(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum NumJS_DataType dataType);
enum NumJS_Error NumJS_Execute_CreateFromBuffer(PP_Instance instance, int32_t idOut, size_t dimensions, uint32_t shape[static dimensions], enum NumJS_DataType dataType, uint32_t bufferSize, void* buffer);
enum NumJS_Error NumJS_Execute_Release(PP_Instance instance, int32_t idIn);
enum NumJS_Error NumJS_Execute_GetBuffer(PP_Instance instance, int32_t idIn, struct PP_Var bufferOut[static 1]);
enum NumJS_Error NumJS_Execute_GetArray(PP_Instance instance, int32_t idIn, struct PP_Var arrayOut[static 1]);
