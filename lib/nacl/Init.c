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

	FJS_ResponseVariable = dictionaryInterface->Create();

	return PP_OK;
}

PP_EXPORT void PPP_ShutdownModule(void) {
	FJS_Strings_Release();
	varInterface->Release(FJS_ResponseVariable);
}

static PP_Bool onCreateInstance(PP_Instance instance, uint32_t argc, const char* argn[], const char* argv[]) {
	FJS_LOG_INFO("PNaCl INIT");
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

static void handleMessage(PP_Instance instance, struct PP_Var message) {
	struct PP_Var commandVar = PP_MakeUndefined();
	struct PP_Var idVar = PP_MakeUndefined();

	if (message.type == PP_VARTYPE_UNDEFINED) {
		FJS_LOG_ERROR("Message not specified");
		goto cleanup;
	} else if (message.type != PP_VARTYPE_DICTIONARY) {
		FJS_LOG_ERROR("Unsupported message type: dictionary expected");
		goto cleanup;
	}

	idVar = dictionaryInterface->Get(message, FJS_StringVariables[FJS_StringVariable_Id]);
	if (idVar.type == PP_VARTYPE_UNDEFINED) {
		FJS_LOG_ERROR("Id not specified");
		goto cleanup;
	} else if (idVar.type != PP_VARTYPE_INT32) {
		FJS_LOG_ERROR("Unsupported id type: int32 expected");
		goto cleanup;
	}
	if (dictionaryInterface->Set(FJS_ResponseVariable, FJS_StringVariables[FJS_StringVariable_Id], idVar) != PP_TRUE) {
		FJS_LOG_ERROR("Failed to set reply message id");
		goto cleanup;
	}

	commandVar = dictionaryInterface->Get(message, FJS_StringVariables[FJS_StringVariable_Command]);
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
		case FJS_Command_Empty:
			FJS_Parse_Empty(instance, message);
			break;
		case FJS_Command_Array:
			FJS_Parse_Array(instance, message);
			break;
		case FJS_Command_LinSpace:
			FJS_Parse_LinSpace(instance, message);
			break;
		case FJS_Command_ReShape:
			FJS_Parse_ReShape(instance, message);
			break;
		case FJS_Command_Release:
			FJS_Parse_Release(instance, message);
			break;
		case FJS_Command_Get:
			FJS_Parse_Get(instance, message);
			break;
		case FJS_Command_Add:
			FJS_Parse_Add(instance, message);
			break;
		case FJS_Command_Sub:
			FJS_Parse_Sub(instance, message);
			break;
		case FJS_Command_Mul:
			FJS_Parse_Mul(instance, message);
			break;
		case FJS_Command_Div:
			FJS_Parse_Div(instance, message);
			break;
		case FJS_Command_AddC:
			FJS_Parse_AddC(instance, message);
			break;
		case FJS_Command_SubC:
			FJS_Parse_SubC(instance, message);
			break;
		case FJS_Command_MulC:
			FJS_Parse_MulC(instance, message);
			break;
		case FJS_Command_DivC:
			FJS_Parse_DivC(instance, message);
			break;
		case FJS_Command_Neg:
			FJS_Parse_Neg(instance, message);
			break;
		case FJS_Command_Abs:
			FJS_Parse_Abs(instance, message);
			break;
		case FJS_Command_Exp:
			FJS_Parse_Exp(instance, message);
			break;
		case FJS_Command_Log:
			FJS_Parse_Log(instance, message);
			break;
		case FJS_Command_Sqrt:
			FJS_Parse_Sqrt(instance, message);
			break;
		case FJS_Command_Square:
			FJS_Parse_Square(instance, message);
			break;
		case FJS_Command_Min:
			FJS_Parse_Min(instance, message);
			break;
		case FJS_Command_Max:
			FJS_Parse_Max(instance, message);
			break;
		case FJS_Command_Sum:
			FJS_Parse_Sum(instance, message);
			break;
		case FJS_Command_AxisMin:
			FJS_Parse_AxisMin(instance, message);
			break;
		case FJS_Command_AxisMax:
			FJS_Parse_AxisMax(instance, message);
			break;
		case FJS_Command_AxisSum:
			FJS_Parse_AxisSum(instance, message);
			break;
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
