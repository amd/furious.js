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

static struct PP_Var responseVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };

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

	NumJS_Strings_Initialize();

	responseVar = dictionaryInterface->Create();

	return PP_OK;
}

PP_EXPORT void PPP_ShutdownModule(void) {
	NumJS_Strings_Release();
}

static PP_Bool onCreateInstance(PP_Instance instance, uint32_t argc, const char* argn[], const char* argv[]) {
	NUMJS_LOG_INFO("PNaCl INIT");
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

static void handleCreateCommand(PP_Instance instance, struct PP_Var message) {
	enum NumJS_Create_Argument {
		NumJS_Create_Argument_Out,
		NumJS_Create_Argument_DataType,
		NumJS_Create_Argument_Shape
	};

	const struct NumJS_VariableDescriptor descriptors[] =
	{
		[NumJS_Create_Argument_Out] = { 
			.type = NumJS_VariableType_Int32,
			.name = &NumJS_StringVariables[NumJS_StringVariable_Out]
		},
		[NumJS_Create_Argument_DataType] = {
			.type = NumJS_VariableType_DataType,
			.name = &NumJS_StringVariables[NumJS_StringVariable_Datatype]
		},
		[NumJS_Create_Argument_Shape] = {
			.type = NumJS_VariableType_Buffer,
			.name = &NumJS_StringVariables[NumJS_StringVariable_Shape]
		}
	};
	struct NumJS_Variable variables[NUMJS_COUNT_OF(descriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(descriptors), descriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error in GET-BUFFER");
		goto cleanup;
	}

	error = NumJS_Release(instance, variables[0].parsedValue.asInt32);

	error = NumJS_Create(instance,
		variables[NumJS_Create_Argument_Out].parsedValue.asInt32,
		variables[NumJS_Create_Argument_Shape].parsedValue.asBuffer.size / 4,
		variables[NumJS_Create_Argument_Shape].parsedValue.asBuffer.pointer,
		variables[NumJS_Create_Argument_DataType].parsedValue.asDatatype);
	if (!NumJS_Message_SetStatus(responseVar, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, responseVar);

	NumJS_Message_RemoveStatus(responseVar);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

static void handleCreateFromBufferCommand(PP_Instance instance, struct PP_Var message) {
	enum NumJS_Create_Argument {
		NumJS_Create_Argument_Out,
		NumJS_Create_Argument_DataType,
		NumJS_Create_Argument_Shape,
		NumJS_Create_Argument_Buffer
	};

	const struct NumJS_VariableDescriptor descriptors[] =
	{
		[NumJS_Create_Argument_Out] = { 
			.type = NumJS_VariableType_Int32,
			.name = &NumJS_StringVariables[NumJS_StringVariable_Out]
		},
		[NumJS_Create_Argument_DataType] = {
			.type = NumJS_VariableType_DataType,
			.name = &NumJS_StringVariables[NumJS_StringVariable_Datatype]
		},
		[NumJS_Create_Argument_Shape] = {
			.type = NumJS_VariableType_Buffer,
			.name = &NumJS_StringVariables[NumJS_StringVariable_Shape]
		},
		[NumJS_Create_Argument_Buffer] = {
			.type = NumJS_VariableType_Buffer,
			.name = &NumJS_StringVariables[NumJS_StringVariable_Buffer]
		}
	};
	struct NumJS_Variable variables[NUMJS_COUNT_OF(descriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(descriptors), descriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error in GET-BUFFER");
		goto cleanup;
	}

	error = NumJS_CreateFromBuffer(instance,
		variables[NumJS_Create_Argument_Out].parsedValue.asInt32,
		variables[NumJS_Create_Argument_Shape].parsedValue.asBuffer.size / 4,
		variables[NumJS_Create_Argument_Shape].parsedValue.asBuffer.pointer,
		variables[NumJS_Create_Argument_DataType].parsedValue.asDatatype,
		variables[NumJS_Create_Argument_Buffer].parsedValue.asBuffer.size,
		variables[NumJS_Create_Argument_Buffer].parsedValue.asBuffer.pointer);
	if (!NumJS_Message_SetStatus(responseVar, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, responseVar);

	NumJS_Message_RemoveStatus(responseVar);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

static void handleReleaseCommand(PP_Instance instance, struct PP_Var message) {
	const struct NumJS_VariableDescriptor descriptors[] = 
	{
		{
			.type = NumJS_VariableType_Int32,
			.name = &NumJS_StringVariables[NumJS_StringVariable_In]
		}
	};
	struct NumJS_Variable variables[NUMJS_COUNT_OF(descriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(descriptors), descriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error in GET-BUFFER");
		goto cleanup;
	}

	error = NumJS_Release(instance, variables[0].parsedValue.asInt32);
	if (!NumJS_Message_SetStatus(responseVar, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, responseVar);

	NumJS_Message_RemoveStatus(responseVar);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
}

static void handleGetBufferCommand(PP_Instance instance, struct PP_Var message) {
	const struct NumJS_VariableDescriptor descriptors[] = 
	{
		{ 
			.type = NumJS_VariableType_Int32,
			.name = &NumJS_StringVariables[NumJS_StringVariable_In]
		}
	};
	struct NumJS_Variable variables[NUMJS_COUNT_OF(descriptors)];
	enum NumJS_Error error = NumJS_Error_Ok;

	error = NumJS_Message_Parse(NUMJS_COUNT_OF(descriptors), descriptors, variables, message);
	if (error != NumJS_Error_Ok) {
		NUMJS_LOG_ERROR("Parse error in GET-BUFFER");
		goto cleanup;
	}

	struct PP_Var bufferVar = PP_MakeUndefined();
	error = NumJS_GetBuffer(instance, variables[0].parsedValue.asInt32, &bufferVar);
	if (!NumJS_Message_SetStatus(responseVar, error)) {
		goto cleanup;
	}
	if (dictionaryInterface->Set(responseVar, NumJS_StringVariables[NumJS_StringVariable_Buffer], bufferVar) != PP_TRUE) {
		NUMJS_LOG_ERROR("Failed to set buffer in GET-BUFFER");
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, responseVar);
	if (!NumJS_Message_SetStatus(responseVar, error)) {
		goto cleanup;
	}

	NumJS_Message_RemoveStatus(responseVar);
	dictionaryInterface->Delete(responseVar, NumJS_StringVariables[NumJS_StringVariable_Buffer]);
cleanup:
	NumJS_Message_FreeVariables(NUMJS_COUNT_OF(variables), variables);
	varInterface->Release(bufferVar);
}

static void handleMessage(PP_Instance instance, struct PP_Var message) {
	struct PP_Var commandVar = PP_MakeUndefined();
	struct PP_Var idVar = PP_MakeUndefined();

	if (message.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("Message not specified");
		goto cleanup;
	} else if (message.type != PP_VARTYPE_DICTIONARY) {
		NUMJS_LOG_ERROR("Unsupported message type: dictionary expected");
		goto cleanup;
	}

	idVar = dictionaryInterface->Get(message, NumJS_StringVariables[NumJS_StringVariable_Id]);
	if (idVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("Id not specified");
		goto cleanup;
	} else if (idVar.type != PP_VARTYPE_INT32) {
		NUMJS_LOG_ERROR("Unsupported id type: int32 expected");
		goto cleanup;
	}
	if (dictionaryInterface->Set(responseVar, NumJS_StringVariables[NumJS_StringVariable_Buffer], idVar) != PP_TRUE) {
		NUMJS_LOG_ERROR("Failed to set reply message id");
		goto cleanup;
	}

	commandVar = dictionaryInterface->Get(message, NumJS_StringVariables[NumJS_StringVariable_Command]);
	if (commandVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("Command not specified");
		goto cleanup;
	}

	uint32_t commandLength = 0;
	const char* const commandString = varInterface->VarToUtf8(commandVar, &commandLength);
	/* For empty string VarToUtf8 returns zero length, but non-null pointer */
	if (commandString == NULL) {
		NUMJS_LOG_ERROR("Unsupported command type: string expected");
		goto cleanup;
	}

	const enum NumJS_Command command = NumJS_Command_Parse(commandString, commandLength);
	switch (command) {
		case NumJS_Command_Create:
			handleCreateCommand(instance, message);
			break;
		case NumJS_Command_CreateFromBuffer:
			handleCreateFromBufferCommand(instance, message);
			break;
		case NumJS_Command_Release:
			handleReleaseCommand(instance, message);
			break;
		case NumJS_Command_GetBuffer:
			handleGetBufferCommand(instance, message);
			break;
		case NumJS_Command_CreateFromArray:
		case NumJS_Command_SetBuffer:
		case NumJS_Command_GetArray:
		case NumJS_Command_SetArray:
		case NumJS_Command_Add:
		case NumJS_Command_Sub:
		case NumJS_Command_Mul:
		case NumJS_Command_Div:
		case NumJS_Command_IAdd:
		case NumJS_Command_ISub:
		case NumJS_Command_IRSub:
		case NumJS_Command_IMul:
		case NumJS_Command_IDiv:
		case NumJS_Command_IRDiv:
		case NumJS_Command_Invalid:
		default:
			NUMJS_LOG_ERROR("Unsupported command");
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
