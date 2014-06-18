#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "Error.h"
#include "NDArray.h"
#include "Commands.h"
#include "Interfaces.h"
#include "Message.h"
#include "Strings.h"
#include "IdMap.h"
#include "Util.h"


static const struct FJS_VariableDescriptor getBufferDescriptors[] = 
{
	{ 
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_In
	}
};

void FJS_Parse_Get(PP_Instance instance, struct PP_Var message) {
	struct FJS_Variable variables[FJS_COUNT_OF(getBufferDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(getBufferDescriptors), getBufferDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	struct PP_Var bufferVar = PP_MakeUndefined();
	error = FJS_Execute_Get(instance, variables[0].parsedValue.asInt32, &bufferVar);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}
	if (dictionaryInterface->Set(FJS_ResponseVariable, FJS_StringVariables[FJS_StringVariable_Buffer], bufferVar) != PP_TRUE) {
		FJS_LOG_ERROR("Failed to set buffer");
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
	dictionaryInterface->Delete(FJS_ResponseVariable, FJS_StringVariables[FJS_StringVariable_Buffer]);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
	varInterface->Release(bufferVar);
}

enum FJS_Error FJS_Execute_Get(PP_Instance instance, int32_t idIn, struct PP_Var bufferOut[static 1]) {
	enum FJS_Error error = FJS_Error_Ok;
	struct PP_Var bufferVar = PP_MakeUndefined();
	void* bufferPointer = NULL;

	struct NDArray* array = FJS_GetPointerFromId(instance, idIn);
	if (array == NULL) {
		error = FJS_Error_InvalidId;
		goto cleanup;
	}

	const uint32_t elementSize = FJS_DataType_GetSize(array->dataType);
	if (elementSize == 0) {
		error = FJS_Error_InvalidDataType;
		goto cleanup;
	}
	const uint32_t dataSize = elementSize * array->length;
	bufferVar = bufferInterface->Create(dataSize);
	bufferPointer = bufferInterface->Map(bufferVar);
	if (bufferPointer == NULL) {
		error = FJS_Error_OutOfMemory;
		goto cleanup;
	}

	memcpy(bufferPointer, FJS_NDArray_GetData(array), dataSize);

cleanup:
	if (bufferPointer != NULL) {
		bufferInterface->Unmap(bufferVar);
	}
	if (error == FJS_Error_Ok) {
		*bufferOut = bufferVar;
	} else {
		varInterface->Release(bufferVar);
	}
	return error;
}

