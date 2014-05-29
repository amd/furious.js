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


static const struct NumJS_VariableDescriptor getBufferDescriptors[] = 
{
	{ 
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_In
	}
};

void NumJS_Parse_GetBuffer(PP_Instance instance, struct PP_Var message) {
	struct NumJS_Variable variables[NUMJS_COUNT_OF(getBufferDescriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(getBufferDescriptors), getBufferDescriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error in GET-BUFFER");
		goto cleanup;
	}

	struct PP_Var bufferVar = PP_MakeUndefined();
	error = NumJS_Execute_GetBuffer(instance, variables[0].parsedValue.asInt32, &bufferVar);
	if (!NumJS_Message_SetStatus(NumJS_ResponseVariable, error)) {
		goto cleanup;
	}
	if (dictionaryInterface->Set(NumJS_ResponseVariable, NumJS_StringVariables[NumJS_StringVariable_Buffer], bufferVar) != PP_TRUE) {
		NUMJS_LOG_ERROR("Failed to set buffer in GET-BUFFER");
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, NumJS_ResponseVariable);
	if (!NumJS_Message_SetStatus(NumJS_ResponseVariable, error)) {
		goto cleanup;
	}

	NumJS_Message_RemoveStatus(NumJS_ResponseVariable);
	dictionaryInterface->Delete(NumJS_ResponseVariable, NumJS_StringVariables[NumJS_StringVariable_Buffer]);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
	varInterface->Release(bufferVar);
}

enum NumJS_Error NumJS_Execute_GetBuffer(PP_Instance instance, int32_t idIn, struct PP_Var bufferOut[static 1]) {
	enum NumJS_Error error = NumJS_Error_Ok;
	struct PP_Var bufferVar = PP_MakeUndefined();
	void* bufferPointer = NULL;

	struct NDArray* array = NumJS_GetPointerFromId(instance, idIn);
	if (array == NULL) {
		error = NumJS_Error_InvalidId;
		goto cleanup;
	}

	const uint32_t elementSize = NumJS_DataType_GetSize(array->dataType);
	if (elementSize == 0) {
		error = NumJS_Error_InvalidDataType;
		goto cleanup;
	}
	const uint32_t dataSize = elementSize * array->length;
	bufferVar = bufferInterface->Create(dataSize);
	bufferPointer = bufferInterface->Map(bufferVar);
	if (bufferPointer == NULL) {
		error = NumJS_Error_OutOfMemory;
		goto cleanup;
	}

	memcpy(bufferPointer, NumJS_NDArray_GetData(array), dataSize);

cleanup:
	if (bufferPointer != NULL) {
		bufferInterface->Unmap(bufferVar);
	}
	if (error == NumJS_Error_Ok) {
		*bufferOut = bufferVar;
	} else {
		varInterface->Release(bufferVar);
	}
	return error;
}

