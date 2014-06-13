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


static const struct FJS_VariableDescriptor releaseDescriptors[] = 
{
	{
		.type = FJS_VariableType_Int32,
		.name = FJS_StringVariable_In
	}
};

void FJS_Parse_Release(PP_Instance instance, struct PP_Var message) {
	struct FJS_Variable variables[FJS_COUNT_OF(releaseDescriptors)];
	enum FJS_Error error = FJS_Error_Ok;

	error = FJS_Message_Parse(FJS_COUNT_OF(releaseDescriptors), releaseDescriptors, variables, message);
	if (error != FJS_Error_Ok) {
		FJS_LOG_ERROR("Parse error");
		goto cleanup;
	}

	error = FJS_Execute_Release(instance, variables[0].parsedValue.asInt32);
	if (!FJS_Message_SetStatus(instance, FJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	FJS_Message_RemoveStatus(FJS_ResponseVariable);
cleanup:
	FJS_Message_FreeVariables(FJS_COUNT_OF(variables), variables);
}

enum FJS_Error FJS_Execute_Release(PP_Instance instance, int32_t idIn) {
	struct NDArray* array = FJS_GetPointerFromId(instance, idIn);
	if (array == NULL) {
		return FJS_Error_InvalidId;
	} else {
		FJS_NDArray_Delete(array);
		return FJS_Error_Ok;
	}
}

