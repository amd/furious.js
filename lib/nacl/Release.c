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


static const struct NumJS_VariableDescriptor releaseDescriptors[] = 
{
	{
		.type = NumJS_VariableType_Int32,
		.name = NumJS_StringVariable_In
	}
};

void NumJS_Parse_Release(PP_Instance instance, struct PP_Var message) {
	struct NumJS_Variable variables[NUMJS_COUNT_OF(releaseDescriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(releaseDescriptors), releaseDescriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error in GET-BUFFER");
		goto cleanup;
	}

	error = NumJS_Execute_Release(instance, variables[0].parsedValue.asInt32);
	if (!NumJS_Message_SetStatus(NumJS_ResponseVariable, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, NumJS_ResponseVariable);

	NumJS_Message_RemoveStatus(NumJS_ResponseVariable);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

enum NumJS_Error NumJS_Execute_Release(PP_Instance instance, int32_t idIn) {
	struct NDArray* array = NumJS_GetPointerFromId(instance, idIn);
	if (array == NULL) {
		return NumJS_Error_InvalidId;
	} else {
		NumJS_NDArray_Delete(array);
		return NumJS_Error_Ok;
	}
}

