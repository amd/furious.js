#include <stdlib.h>
#include <string.h>
#include <math.h>

#include <ppapi/c/pp_bool.h>
#include <ppapi/c/pp_errors.h>
#include <ppapi/c/ppp.h>
#include <ppapi/c/ppp_messaging.h>
#include <ppapi/c/ppp_instance.h>

#include "Error.h"
#include "DataType.h"
#include "Interfaces.h"
#include "Commands.h"

const struct PPB_Console_1_0* consoleInterface = NULL;
const struct PPB_Var_1_1* varInterface = NULL;
const struct PPB_Messaging_1_0* messagingInterface = NULL;
const struct PPB_VarDictionary_1_0* dictionaryInterface = NULL;
const struct PPB_VarArray_1_0* arrayInterface = NULL;
const struct PPB_VarArrayBuffer_1_0* bufferInterface = NULL;

static struct PP_Var commandStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var datatypeStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var idStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var outStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var inStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var shapeStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var arrayStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var bufferStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var dataStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var xStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var yStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var zStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var replyVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };

static struct PP_Var statusStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var errorStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var successStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };

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

	commandStringVar = NUMJS_VAR_FROM_STRING_LITERAL("command");
	datatypeStringVar = NUMJS_VAR_FROM_STRING_LITERAL("datatype");
	idStringVar = NUMJS_VAR_FROM_STRING_LITERAL("id");
	outStringVar = NUMJS_VAR_FROM_STRING_LITERAL("out");
	inStringVar = NUMJS_VAR_FROM_STRING_LITERAL("in");
	shapeStringVar = NUMJS_VAR_FROM_STRING_LITERAL("shape");
	arrayStringVar = NUMJS_VAR_FROM_STRING_LITERAL("array");
	bufferStringVar = NUMJS_VAR_FROM_STRING_LITERAL("buffer");
	dataStringVar = NUMJS_VAR_FROM_STRING_LITERAL("data");
	xStringVar = NUMJS_VAR_FROM_STRING_LITERAL("x");
	yStringVar = NUMJS_VAR_FROM_STRING_LITERAL("y");
	zStringVar = NUMJS_VAR_FROM_STRING_LITERAL("z");

	statusStringVar = NUMJS_VAR_FROM_STRING_LITERAL("status");
	errorStringVar = NUMJS_VAR_FROM_STRING_LITERAL("error");
	successStringVar = NUMJS_VAR_FROM_STRING_LITERAL("success");

	replyVar = dictionaryInterface->Create();

	return PP_OK;
}

PP_EXPORT void PPP_ShutdownModule(void) {
	varInterface->Release(commandStringVar);
	varInterface->Release(datatypeStringVar);
	varInterface->Release(idStringVar);
	varInterface->Release(outStringVar);
	varInterface->Release(inStringVar);
	varInterface->Release(shapeStringVar);
	varInterface->Release(arrayStringVar);
	varInterface->Release(bufferStringVar);
	varInterface->Release(dataStringVar);
	varInterface->Release(xStringVar);
	varInterface->Release(yStringVar);
	varInterface->Release(zStringVar);

	varInterface->Release(statusStringVar);
	varInterface->Release(errorStringVar);
	varInterface->Release(successStringVar);

	varInterface->Release(replyVar);
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
	struct PP_Var outVar = PP_MakeUndefined();
	struct PP_Var datatypeVar = PP_MakeUndefined();
	struct PP_Var shapeVar = PP_MakeUndefined();
	uint32_t* shapePointer = NULL;

	outVar = dictionaryInterface->Get(message, outStringVar);
	if (outVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("Out not specified in CREATE");
		goto cleanup;
	} else if (outVar.type != PP_VARTYPE_INT32) {
		NUMJS_LOG_ERROR("Unsupported out type: int32 expected in CREATE");
		goto cleanup;
	}
	const int32_t out = outVar.value.as_int;

	datatypeVar = dictionaryInterface->Get(message, datatypeStringVar);
	if (datatypeVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("DataType not specified in CREATE");
		goto cleanup;
	}

	uint32_t datatypeLength = 0;
	const char* const datatypeString = varInterface->VarToUtf8(datatypeVar, &datatypeLength);
	if (datatypeString == NULL) {
		NUMJS_LOG_ERROR("Unsupported type type in CREATE");
		goto cleanup;
	}

	const enum NumJS_DataType datatype = NumJS_DataType_Parse(datatypeString, datatypeLength);
	if (datatype == NumJS_DataType_Invalid) {
		NUMJS_LOG_ERROR("Unsupported type value in CREATE");
		goto cleanup;
	}

	shapeVar = dictionaryInterface->Get(message, shapeStringVar);
	if (shapeVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("Shape not specified in CREATE");
		goto cleanup;
	}

	uint32_t shapeSize = 0;
	if (bufferInterface->ByteLength(shapeVar, &shapeSize) != PP_TRUE) {
		NUMJS_LOG_ERROR("Invalid shape type in CREATE");
		goto cleanup;
	}

	if (shapeSize % 4 != 0) {
		NUMJS_LOG_ERROR("Invalid shape size in CREATE");
		goto cleanup;
	}
	const size_t shapeLength = shapeSize / 4;

	if (shapeLength == 0) {
		NUMJS_LOG_ERROR("Empty shape in CREATE");
		goto cleanup;
	}

	shapePointer = bufferInterface->Map(shapeVar);
	if (shapePointer == NULL) {
		NUMJS_LOG_ERROR("Failed to map shape buffer in CREATE");
		goto cleanup;
	}

	const enum NumJS_Error error = NumJS_Create(instance, out, shapeLength, shapePointer, datatype);
	if (error == NumJS_Error_Ok) {
		if (dictionaryInterface->Set(replyVar, statusStringVar, successStringVar) != PP_TRUE) {
			NUMJS_LOG_ERROR("Failed to set success status in CREATE");
			goto cleanup;
		}
	} else {
		if (dictionaryInterface->Set(replyVar, statusStringVar, errorStringVar) != PP_TRUE) {
			NUMJS_LOG_ERROR("Failed to set error status in CREATE");
			goto cleanup;
		}
	}

	messagingInterface->PostMessage(instance, replyVar);

	dictionaryInterface->Delete(replyVar, statusStringVar);
cleanup:
	if (shapePointer != NULL) {
		bufferInterface->Unmap(shapeVar);
	}

	varInterface->Release(outVar);
	varInterface->Release(datatypeVar);
	varInterface->Release(shapeVar);
}

static void handleCreateFromBufferCommand(PP_Instance instance, struct PP_Var message) {
	struct PP_Var outVar = PP_MakeUndefined();
	struct PP_Var datatypeVar = PP_MakeUndefined();
	struct PP_Var shapeVar = PP_MakeUndefined();
	struct PP_Var bufferVar = PP_MakeUndefined();
	uint32_t* shapePointer = NULL;
	uint32_t* bufferPointer = NULL;

	outVar = dictionaryInterface->Get(message, outStringVar);
	if (outVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("Out not specified in CREATE-FROM-BUFFER");
		goto cleanup;
	} else if (outVar.type != PP_VARTYPE_INT32) {
		NUMJS_LOG_ERROR("Unsupported out type: int32 expected in CREATE-FROM-BUFFER");
		goto cleanup;
	}
	const int32_t out = outVar.value.as_int;

	datatypeVar = dictionaryInterface->Get(message, datatypeStringVar);
	if (datatypeVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("DataType not specified in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	uint32_t datatypeLength = 0;
	const char* const datatypeString = varInterface->VarToUtf8(datatypeVar, &datatypeLength);
	if (datatypeString == NULL) {
		NUMJS_LOG_ERROR("Unsupported type type in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	const enum NumJS_DataType datatype = NumJS_DataType_Parse(datatypeString, datatypeLength);
	if (datatype == NumJS_DataType_Invalid) {
		NUMJS_LOG_ERROR("Unsupported type value in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	const uint32_t elementSize = NumJS_DataType_GetSize(datatype);
	if (elementSize == 0) {
		NUMJS_LOG_ERROR("Invalid data type in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	shapeVar = dictionaryInterface->Get(message, shapeStringVar);
	if (shapeVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("Shape not specified in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	uint32_t shapeSize = 0;
	if (bufferInterface->ByteLength(shapeVar, &shapeSize) != PP_TRUE) {
		NUMJS_LOG_ERROR("Invalid shape type in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	if (shapeSize % 4 != 0) {
		NUMJS_LOG_ERROR("Invalid shape size in CREATE-FROM-BUFFER");
		goto cleanup;
	}
	const size_t shapeLength = shapeSize / 4;

	if (shapeLength == 0) {
		NUMJS_LOG_ERROR("Empty shape in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	bufferVar = dictionaryInterface->Get(message, bufferStringVar);
	if (bufferVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("Buffer not specified in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	uint32_t bufferSize = 0;
	if (bufferInterface->ByteLength(bufferVar, &bufferSize) != PP_TRUE) {
		NUMJS_LOG_ERROR("Invalid buffer type in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	if (bufferSize % elementSize != 0) {
		consoleInterface->Log(instance, PP_LOGLEVEL_LOG, PP_MakeInt32(bufferSize));
		consoleInterface->Log(instance, PP_LOGLEVEL_LOG, PP_MakeInt32(elementSize));
		NUMJS_LOG_ERROR("Invalid buffer size in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	if (bufferSize == 0) {
		NUMJS_LOG_ERROR("Empty buffer in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	shapePointer = bufferInterface->Map(shapeVar);
	if (shapePointer == NULL) {
		NUMJS_LOG_ERROR("Failed to map shape buffer in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	bufferPointer = bufferInterface->Map(bufferVar);
	if (bufferPointer == NULL) {
		NUMJS_LOG_ERROR("Failed to map buffer in CREATE-FROM-BUFFER");
		goto cleanup;
	}

	const enum NumJS_Error error = NumJS_CreateFromBuffer(instance, out, shapeLength, shapePointer, datatype, bufferSize, bufferPointer);
	if (error == NumJS_Error_Ok) {
		if (dictionaryInterface->Set(replyVar, statusStringVar, successStringVar) != PP_TRUE) {
			NUMJS_LOG_ERROR("Failed to set success status in CREATE-FROM-BUFFER");
			goto cleanup;
		}
	} else {
		if (dictionaryInterface->Set(replyVar, statusStringVar, errorStringVar) != PP_TRUE) {
			NUMJS_LOG_ERROR("Failed to set error status in CREATE-FROM-BUFFER");
			goto cleanup;
		}
	}

	messagingInterface->PostMessage(instance, replyVar);

	dictionaryInterface->Delete(replyVar, statusStringVar);
cleanup:
	if (shapePointer != NULL) {
		bufferInterface->Unmap(shapeVar);
	}
	if (bufferPointer != NULL) {
		bufferInterface->Unmap(bufferVar);
	}

	varInterface->Release(outVar);
	varInterface->Release(datatypeVar);
	varInterface->Release(shapeVar);
	varInterface->Release(bufferVar);
}

static void handleReleaseCommand(PP_Instance instance, struct PP_Var message) {
	const struct PP_Var inVar = dictionaryInterface->Get(message, inStringVar);
	if (inVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("In not specified in RELEASE");
		goto cleanup;
	} else if (inVar.type != PP_VARTYPE_INT32) {
		NUMJS_LOG_ERROR("Unsupported in type: int32 expected in RELEASE");
		goto cleanup;
	}
	const int32_t in = inVar.value.as_int;

	enum NumJS_Error error = NumJS_Release(instance, in);
	if (error == NumJS_Error_Ok) {
		if (dictionaryInterface->Set(replyVar, statusStringVar, successStringVar) != PP_TRUE) {
			NUMJS_LOG_ERROR("Failed to set success status in RELEASE");
			goto cleanup;
		}
	} else {
		if (dictionaryInterface->Set(replyVar, statusStringVar, errorStringVar) != PP_TRUE) {
			NUMJS_LOG_ERROR("Failed to set error status in RELEASE");
			goto cleanup;
		}
	}

	messagingInterface->PostMessage(instance, replyVar);

	dictionaryInterface->Delete(replyVar, statusStringVar);
cleanup:
	varInterface->Release(inVar);
}

static void handleGetBufferCommand(PP_Instance instance, struct PP_Var message) {
	struct PP_Var inVar = PP_MakeUndefined();
	struct PP_Var bufferVar = PP_MakeUndefined();

	inVar = dictionaryInterface->Get(message, inStringVar);
	if (inVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("In not specified in GET-BUFFER");
		goto cleanup;
	} else if (inVar.type != PP_VARTYPE_INT32) {
		NUMJS_LOG_ERROR("Unsupported in type: int32 expected in GET-BUFFER");
		goto cleanup;
	}
	const int32_t in = inVar.value.as_int;

	enum NumJS_Error error = NumJS_GetBuffer(instance, in, &bufferVar);
	if (error == NumJS_Error_Ok) {
		if (dictionaryInterface->Set(replyVar, statusStringVar, successStringVar) != PP_TRUE) {
			NUMJS_LOG_ERROR("Failed to set success status in GET-BUFFER");
			goto cleanup;
		}
		if (dictionaryInterface->Set(replyVar, bufferStringVar, bufferVar) != PP_TRUE) {
			NUMJS_LOG_ERROR("Failed to set buffer in GET-BUFFER");
			goto cleanup;
		}
	} else {
		if (dictionaryInterface->Set(replyVar, statusStringVar, errorStringVar) != PP_TRUE) {
			NUMJS_LOG_ERROR("Failed to set error status in GET-BUFFER");
			goto cleanup;
		}
	}

	messagingInterface->PostMessage(instance, replyVar);

	dictionaryInterface->Delete(replyVar, statusStringVar);
	dictionaryInterface->Delete(replyVar, bufferStringVar);
cleanup:
	varInterface->Release(inVar);
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

	idVar = dictionaryInterface->Get(message, idStringVar);
	if (idVar.type == PP_VARTYPE_UNDEFINED) {
		NUMJS_LOG_ERROR("Id not specified");
		goto cleanup;
	} else if (idVar.type != PP_VARTYPE_INT32) {
		NUMJS_LOG_ERROR("Unsupported id type: int32 expected");
		goto cleanup;
	}
	if (dictionaryInterface->Set(replyVar, idStringVar, idVar) != PP_TRUE) {
		NUMJS_LOG_ERROR("Failed to set reply message id");
		goto cleanup;
	}

	commandVar = dictionaryInterface->Get(message, commandStringVar);
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
