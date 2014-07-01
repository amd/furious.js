#include <stdlib.h>
#include <string.h>
#include <math.h>

#include <ppapi/c/pp_bool.h>
#include <ppapi/c/pp_errors.h>
#include <ppapi/c/pp_var.h>
#include <ppapi/c/ppp.h>
#include <ppapi/c/ppp_messaging.h>
#include <ppapi/c/ppp_instance.h>

#include "Error.h"
#include "DataType.h"
#include "Interfaces.h"
#include "Commands.h"
#include "Message.h"
#include "Strings.h"
#include "Util.h"

const struct PPB_Console_1_0* consoleInterface = NULL;
const struct PPB_Var_1_1* varInterface = NULL;
const struct PPB_Messaging_1_0* messagingInterface = NULL;
const struct PPB_VarDictionary_1_0* dictionaryInterface = NULL;
const struct PPB_VarArray_1_0* arrayInterface = NULL;
const struct PPB_VarArrayBuffer_1_0* bufferInterface = NULL;

PP_EXPORT int32_t PPP_InitializeModule(PP_Module module, PPB_GetInterface get_browser_interface) {
	consoleInterface = get_browser_interface(PPB_CONSOLE_INTERFACE_1_0);
	if (consoleInterface == NULL) {
		return PP_ERROR_NOINTERFACE;
	}
	messagingInterface = get_browser_interface(PPB_MESSAGING_INTERFACE_1_0);
	if (messagingInterface == NULL) {
		return PP_ERROR_NOINTERFACE;
	}
	varInterface = get_browser_interface(PPB_VAR_INTERFACE_1_1);
	if (varInterface == NULL) {
		return PP_ERROR_NOINTERFACE;
	}
	dictionaryInterface = get_browser_interface(PPB_VAR_DICTIONARY_INTERFACE_1_0);
	if (dictionaryInterface == NULL) {
		return PP_ERROR_NOINTERFACE;
	}
	arrayInterface = get_browser_interface(PPB_VAR_ARRAY_INTERFACE_1_0);
	if (arrayInterface == NULL) {
		return PP_ERROR_NOINTERFACE;
	}
	bufferInterface = get_browser_interface(PPB_VAR_ARRAY_BUFFER_INTERFACE_1_0);
	if (bufferInterface == NULL) {
		return PP_ERROR_NOINTERFACE;
	}

	FJS_Strings_Initialize();

	return PP_OK;
}

PP_EXPORT void PPP_ShutdownModule(void) {
	FJS_Strings_Release();
	varInterface->Release(FJS_ResponseVariable);
}

static PP_Bool onCreateInstance(PP_Instance instance, uint32_t argc, const char* argn[], const char* argv[]) {
	FJS_ResponseVariable = dictionaryInterface->Create();
	if (dictionaryInterface->Set(FJS_ResponseVariable,
		FJS_StringVariables[FJS_StringVariable_Id],
		PP_MakeInt32(0)) != PP_TRUE)
	{
		FJS_LOG_ERROR("Failed to set reply message id");
		return PP_FALSE;
	}
	if (dictionaryInterface->Set(FJS_ResponseVariable,
		FJS_StringVariables[FJS_StringVariable_Status],
		FJS_StringVariables[FJS_StringVariable_Success]) != PP_TRUE)
	{
		FJS_LOG_ERROR("Failed to set success status");
		return PP_FALSE;
	}
	messagingInterface->PostMessage(instance, FJS_ResponseVariable);

	return PP_TRUE;
}

static void onDestroyInstance(PP_Instance instance) {
}

static void onChangeView(PP_Instance instance, PP_Resource view) {
}

static void onChangeFocus(PP_Instance instance, PP_Bool has_focus) {
}

static PP_Bool onDocumentLoad(PP_Instance instance, PP_Resource url_loader) {
	return PP_FALSE;
}

static struct PPP_Instance_1_1 pluginInstanceInterface = {
	.DidCreate = onCreateInstance,
	.DidDestroy = onDestroyInstance,
	.DidChangeView = onChangeView,
	.DidChangeFocus = onChangeFocus,
	.HandleDocumentLoad = onDocumentLoad
};

static void handleMessage(PP_Instance instance, struct PP_Var requestVar) {
	struct PP_Var commandVar = PP_MakeUndefined();
	struct PP_Var idVar = PP_MakeUndefined();

	if (requestVar.type == PP_VARTYPE_UNDEFINED) {
		FJS_LOG_ERROR("Request not specified");
		goto cleanup;
	} else if (requestVar.type != PP_VARTYPE_DICTIONARY) {
		FJS_LOG_ERROR("Unsupported request type: dictionary expected");
		goto cleanup;
	}

	idVar = dictionaryInterface->Get(requestVar, FJS_StringVariables[FJS_StringVariable_Id]);
	if (idVar.type == PP_VARTYPE_UNDEFINED) {
		FJS_LOG_ERROR("Id not specified");
		goto cleanup;
	} else if (idVar.type != PP_VARTYPE_INT32) {
		FJS_LOG_ERROR("Unsupported id type: int32 expected");
		goto cleanup;
	}
	if (dictionaryInterface->Set(FJS_ResponseVariable, FJS_StringVariables[FJS_StringVariable_Id], idVar) != PP_TRUE) {
		FJS_LOG_ERROR("Failed to set response message id");
		goto cleanup;
	}

	commandVar = dictionaryInterface->Get(requestVar, FJS_StringVariables[FJS_StringVariable_Command]);
	if (commandVar.type == PP_VARTYPE_UNDEFINED) {
		FJS_LOG_ERROR("Command not specified");
		goto cleanup;
	}

	uint32_t commandLength = 0;
	const char* const commandString = varInterface->VarToUtf8(commandVar, &commandLength);
	/* For empty string VarToUtf8 returns zero length, but non-null pointer */
	if (commandString == NULL) {
		FJS_LOG_ERROR("Unsupported command type: string expected");
		goto cleanup;
	}

	const enum FJS_Command command = FJS_Command_Parse(commandString, commandLength);
	switch (command) {
		case FJS_Command_Init:
		{
			if (FJS_Message_SetStatus(instance, FJS_ResponseVariable, FJS_Error_Ok)) {
				messagingInterface->PostMessage(instance, FJS_ResponseVariable);
			}
			break;
		}
		case FJS_Command_Empty:
		case FJS_Command_Array:
		case FJS_Command_LinSpace:
		case FJS_Command_ReShape:
		case FJS_Command_Repeat:
		case FJS_Command_Release:
		case FJS_Command_Get:
		case FJS_Command_Add:
		case FJS_Command_Sub:
		case FJS_Command_Mul:
		case FJS_Command_Div:
		case FJS_Command_AddC:
		case FJS_Command_SubC:
		case FJS_Command_MulC:
		case FJS_Command_DivC:
		case FJS_Command_Neg:
		case FJS_Command_Abs:
		case FJS_Command_Exp:
		case FJS_Command_Log:
		case FJS_Command_Sqrt:
		case FJS_Command_Square:
		case FJS_Command_Min:
		case FJS_Command_Max:
		case FJS_Command_Sum:
		case FJS_Command_AxisMin:
		case FJS_Command_AxisMax:
		case FJS_Command_AxisSum:
		case FJS_Command_Dot:
		{
			const struct FJS_Command_Descriptor commandDescriptor = FJS_Command_Descriptors[command];
			FJS_Message_Dispatch(instance,
				commandDescriptor.argumentsSize,
				commandDescriptor.argumentsCount,
				commandDescriptor.argumentsDescriptors,
				commandDescriptor.cleanupEntries,
				commandDescriptor.cleanupNames,
				requestVar,
				FJS_ResponseVariable,
				commandDescriptor.executeFunction);
			break;
		}
		case FJS_Command_Set:
		case FJS_Command_RSubC:
		case FJS_Command_RDivC:
		case FJS_Command_Invalid:
		default:
			FJS_LOG_ERROR("Unsupported command");
			goto cleanup;
	}

cleanup:
	varInterface->Release(commandVar);
	varInterface->Release(idVar);
	varInterface->Release(requestVar);
}

static struct PPP_Messaging_1_0 pluginMessagingInterface = {
	.HandleMessage = handleMessage
};

PP_EXPORT const void* PPP_GetInterface(const char* interface_name) {
	if (strcmp(interface_name, PPP_INSTANCE_INTERFACE_1_1) == 0) {
		return &pluginInstanceInterface;
	} else if (strcmp(interface_name, PPP_MESSAGING_INTERFACE_1_0) == 0) {
		return &pluginMessagingInterface;
	} else {
		return NULL;
	}
}
