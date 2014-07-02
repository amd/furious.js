#include "Message.h"
#include "Commands.h"
#include "Util.h"

static const struct FJS_ArgumentDescriptor emptyArguments[] =
{
	{ 
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_Empty_Command_Arguments, idOut)
	},
	{
		.type = FJS_ArgumentType_DataType,
		.name = FJS_StringVariable_Datatype,
		.offset = offsetof(struct FJS_Empty_Command_Arguments, dataType)
	},
	{
		.type = FJS_ArgumentType_Shape,
		.name = FJS_StringVariable_Shape,
		.offset = offsetof(struct FJS_Empty_Command_Arguments, shape)
	}
};

static const struct FJS_ArgumentDescriptor zerosArguments[] =
{
	{ 
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_Zeros_Command_Arguments, idOut)
	},
	{
		.type = FJS_ArgumentType_DataType,
		.name = FJS_StringVariable_Datatype,
		.offset = offsetof(struct FJS_Zeros_Command_Arguments, dataType)
	},
	{
		.type = FJS_ArgumentType_Shape,
		.name = FJS_StringVariable_Shape,
		.offset = offsetof(struct FJS_Zeros_Command_Arguments, shape)
	}
};

static const struct FJS_ArgumentDescriptor onesArguments[] =
{
	{ 
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_Ones_Command_Arguments, idOut)
	},
	{
		.type = FJS_ArgumentType_DataType,
		.name = FJS_StringVariable_Datatype,
		.offset = offsetof(struct FJS_Ones_Command_Arguments, dataType)
	},
	{
		.type = FJS_ArgumentType_Shape,
		.name = FJS_StringVariable_Shape,
		.offset = offsetof(struct FJS_Ones_Command_Arguments, shape)
	}
};

static const struct FJS_ArgumentDescriptor arrayArguments[] =
{
	{ 
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_Array_Command_Arguments, idOut)
	},
	{
		.type = FJS_ArgumentType_DataType,
		.name = FJS_StringVariable_Datatype,
		.offset = offsetof(struct FJS_Array_Command_Arguments, dataType)
	},
	{
		.type = FJS_ArgumentType_Shape,
		.name = FJS_StringVariable_Shape,
		.offset = offsetof(struct FJS_Array_Command_Arguments, shape)
	},
	{
		.type = FJS_ArgumentType_Buffer,
		.name = FJS_StringVariable_Buffer,
		.offset = offsetof(struct FJS_Array_Command_Arguments, buffer)
	}
};

static const struct FJS_ArgumentDescriptor linspaceArguments[] =
{
	{ 
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_LinSpace_Command_Arguments, idOut)
	},
	{ 
		.type = FJS_ArgumentType_Float64,
		.name = FJS_StringVariable_Start,
		.offset = offsetof(struct FJS_LinSpace_Command_Arguments, start)
	},
	{
		.type = FJS_ArgumentType_Float64,
		.name = FJS_StringVariable_Stop,
		.offset = offsetof(struct FJS_LinSpace_Command_Arguments, stop)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Samples,
		.offset = offsetof(struct FJS_LinSpace_Command_Arguments, samples)
	},
	{
		.type = FJS_ArgumentType_Boolean,
		.name = FJS_StringVariable_Closed,
		.offset = offsetof(struct FJS_LinSpace_Command_Arguments, closed)
	},
	{
		.type = FJS_ArgumentType_DataType,
		.name = FJS_StringVariable_Datatype,
		.offset = offsetof(struct FJS_LinSpace_Command_Arguments, dataType)
	}
};

static const struct FJS_ArgumentDescriptor reshapeArguments[] =
{
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_A,
		.offset = offsetof(struct FJS_ReShape_Command_Arguments, idA)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_ReShape_Command_Arguments, idOut)
	},
	{
		.type = FJS_ArgumentType_Shape,
		.name = FJS_StringVariable_Shape,
		.offset = offsetof(struct FJS_ReShape_Command_Arguments, shapeOut)
	}
};

static const struct FJS_ArgumentDescriptor repeatArguments[] =
{
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_A,
		.offset = offsetof(struct FJS_Repeat_Command_Arguments, idA)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_Repeat_Command_Arguments, idOut)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Repeats,
		.offset = offsetof(struct FJS_Repeat_Command_Arguments, repeats)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Axis,
		.offset = offsetof(struct FJS_Repeat_Command_Arguments, axis)
	}
};

static const struct FJS_ArgumentDescriptor freeArguments[] = 
{
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_In,
		.offset = offsetof(struct FJS_Free_Command_Arguments, idA)
	}
};

static const enum FJS_StringVariable getCleanupNames[] = {
	FJS_StringVariable_Buffer
};

static const struct FJS_ArgumentDescriptor getArguments[] = 
{
	{ 
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_In,
		.offset = offsetof(struct FJS_Get_Command_Arguments, idA)
	}
};

static const struct FJS_ArgumentDescriptor binaryOpArguments[] =
{
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_A,
		.offset = offsetof(struct FJS_BinaryOp_Command_Arguments, idA)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_B,
		.offset = offsetof(struct FJS_BinaryOp_Command_Arguments, idB)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_BinaryOp_Command_Arguments, idOut)
	}
};

static const struct FJS_ArgumentDescriptor binaryConstOpArguments[] =
{
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_A,
		.offset = offsetof(struct FJS_BinaryConstOp_Command_Arguments, idA)
	},
	{
		.type = FJS_ArgumentType_Float64,
		.name = FJS_StringVariable_B,
		.offset = offsetof(struct FJS_BinaryConstOp_Command_Arguments, valueB)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_BinaryConstOp_Command_Arguments, idOut)
	}
};

static const struct FJS_ArgumentDescriptor unaryOpArguments[] =
{
	{ 
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_A,
		.offset = offsetof(struct FJS_UnaryOp_Command_Arguments, idA)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_UnaryOp_Command_Arguments, idOut)
	}
};

static const struct FJS_ArgumentDescriptor reduceOpArguments[] =
{
	{ 
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_A,
		.offset = offsetof(struct FJS_ReduceOp_Command_Arguments, idA)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_ReduceOp_Command_Arguments, idOut)
	}
};

static const struct FJS_ArgumentDescriptor axisReduceOpArguments[] =
{
	{ 
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_A,
		.offset = offsetof(struct FJS_AxisReduceOp_Command_Arguments, idA)
	},
	{ 
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Axis,
		.offset = offsetof(struct FJS_AxisReduceOp_Command_Arguments, axis)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_AxisReduceOp_Command_Arguments, idOut)
	}
};

static const struct FJS_ArgumentDescriptor dotArguments[] = 
{
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_A,
		.offset = offsetof(struct FJS_Dot_Command_Arguments, idA)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_B,
		.offset = offsetof(struct FJS_Dot_Command_Arguments, idB)
	},
	{
		.type = FJS_ArgumentType_Int32,
		.name = FJS_StringVariable_Out,
		.offset = offsetof(struct FJS_Dot_Command_Arguments, idOut)
	}
};

const struct FJS_Command_Descriptor FJS_Command_Descriptors[] = {
	[FJS_Command_Empty] = {
		.argumentsSize = sizeof(struct FJS_Empty_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(emptyArguments),
		.argumentsDescriptors = emptyArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Empty
	},
	[FJS_Command_Zeros] = {
		.argumentsSize = sizeof(struct FJS_Zeros_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(zerosArguments),
		.argumentsDescriptors = zerosArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Zeros
	},
	[FJS_Command_Ones] = {
		.argumentsSize = sizeof(struct FJS_Ones_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(onesArguments),
		.argumentsDescriptors = onesArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Ones
	},
	[FJS_Command_Array] = {
		.argumentsSize = sizeof(struct FJS_Array_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(arrayArguments),
		.argumentsDescriptors = arrayArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Array
	},
	[FJS_Command_LinSpace] = {
		.argumentsSize = sizeof(struct FJS_LinSpace_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(linspaceArguments),
		.argumentsDescriptors = linspaceArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_LinSpace
	},
	[FJS_Command_ReShape] = {
		.argumentsSize = sizeof(struct FJS_ReShape_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(reshapeArguments),
		.argumentsDescriptors = reshapeArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_ReShape
	},
	[FJS_Command_Repeat] = {
		.argumentsSize = sizeof(struct FJS_Repeat_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(repeatArguments),
		.argumentsDescriptors = repeatArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Repeat
	},
	[FJS_Command_Free] = {
		.argumentsSize = sizeof(struct FJS_Free_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(freeArguments),
		.argumentsDescriptors = freeArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Free
	},
	[FJS_Command_Get] = {
		.argumentsSize = sizeof(struct FJS_Get_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(getArguments),
		.argumentsDescriptors = getArguments,
		.cleanupEntries = FJS_COUNT_OF(getCleanupNames),
		.cleanupNames = getCleanupNames,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Get
	},
	[FJS_Command_Add] = {
		.argumentsSize = sizeof(struct FJS_BinaryOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(binaryOpArguments),
		.argumentsDescriptors = binaryOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Add
	},
	[FJS_Command_Sub] = {
		.argumentsSize = sizeof(struct FJS_BinaryOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(binaryOpArguments),
		.argumentsDescriptors = binaryOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Sub
	},
	[FJS_Command_Mul] = {
		.argumentsSize = sizeof(struct FJS_BinaryOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(binaryOpArguments),
		.argumentsDescriptors = binaryOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Mul
	},
	[FJS_Command_Div] = {
		.argumentsSize = sizeof(struct FJS_BinaryOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(binaryOpArguments),
		.argumentsDescriptors = binaryOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Div
	},
	[FJS_Command_AddC] = {
		.argumentsSize = sizeof(struct FJS_BinaryConstOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(binaryConstOpArguments),
		.argumentsDescriptors = binaryConstOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_AddC
	},
	[FJS_Command_SubC] = {
		.argumentsSize = sizeof(struct FJS_BinaryConstOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(binaryConstOpArguments),
		.argumentsDescriptors = binaryConstOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_SubC
	},
	[FJS_Command_MulC] = {
		.argumentsSize = sizeof(struct FJS_BinaryConstOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(binaryConstOpArguments),
		.argumentsDescriptors = binaryConstOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_MulC
	},
	[FJS_Command_DivC] = {
		.argumentsSize = sizeof(struct FJS_BinaryConstOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(binaryConstOpArguments),
		.argumentsDescriptors = binaryConstOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_DivC
	},
	[FJS_Command_Neg] = {
		.argumentsSize = sizeof(struct FJS_UnaryOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(unaryOpArguments),
		.argumentsDescriptors = unaryOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Neg
	},
	[FJS_Command_Abs] = {
		.argumentsSize = sizeof(struct FJS_UnaryOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(unaryOpArguments),
		.argumentsDescriptors = unaryOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Abs
	},
	[FJS_Command_Exp] = {
		.argumentsSize = sizeof(struct FJS_UnaryOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(unaryOpArguments),
		.argumentsDescriptors = unaryOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Exp
	},
	[FJS_Command_Log] = {
		.argumentsSize = sizeof(struct FJS_UnaryOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(unaryOpArguments),
		.argumentsDescriptors = unaryOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Log
	},
	[FJS_Command_Sqrt] = {
		.argumentsSize = sizeof(struct FJS_UnaryOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(unaryOpArguments),
		.argumentsDescriptors = unaryOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Sqrt
	},
	[FJS_Command_Square] = {
		.argumentsSize = sizeof(struct FJS_UnaryOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(unaryOpArguments),
		.argumentsDescriptors = unaryOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Square
	},
	[FJS_Command_Min] = {
		.argumentsSize = sizeof(struct FJS_ReduceOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(reduceOpArguments),
		.argumentsDescriptors = reduceOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Min
	},
	[FJS_Command_Max] = {
		.argumentsSize = sizeof(struct FJS_ReduceOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(reduceOpArguments),
		.argumentsDescriptors = reduceOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Max
	},
	[FJS_Command_Sum] = {
		.argumentsSize = sizeof(struct FJS_ReduceOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(reduceOpArguments),
		.argumentsDescriptors = reduceOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Sum
	},
	[FJS_Command_AxisMin] = {
		.argumentsSize = sizeof(struct FJS_AxisReduceOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(axisReduceOpArguments),
		.argumentsDescriptors = axisReduceOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_AxisMin
	},
	[FJS_Command_AxisMax] = {
		.argumentsSize = sizeof(struct FJS_AxisReduceOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(axisReduceOpArguments),
		.argumentsDescriptors = axisReduceOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_AxisMax
	},
	[FJS_Command_AxisSum] = {
		.argumentsSize = sizeof(struct FJS_AxisReduceOp_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(axisReduceOpArguments),
		.argumentsDescriptors = axisReduceOpArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_AxisSum
	},
	[FJS_Command_Dot] = {
		.argumentsSize = sizeof(struct FJS_Dot_Command_Arguments),
		.argumentsCount = FJS_COUNT_OF(dotArguments),
		.argumentsDescriptors = dotArguments,
		.executeFunction = (FJS_Execute_Function) FJS_Execute_Dot
	}
};
