#include <stdlib.h>
#include <string.h>
#include <math.h>

#include <ppapi/c/pp_bool.h>
#include <ppapi/c/pp_errors.h>
#include <ppapi/c/ppp.h>
#include <ppapi/c/ppp_messaging.h>
#include <ppapi/c/ppp_instance.h>

#include <ppapi/c/ppb_console.h>
#include <ppapi/c/ppb_messaging.h>
#include <ppapi/c/ppb_var.h>
#include <ppapi/c/ppb_var_dictionary.h>
#include <ppapi/c/ppb_var_array_buffer.h>

#define NUMJS_VAR_FROM_STRING_LITERAL(interface, string) \
	interface->VarFromUtf8(string, sizeof(string) - 1)

static const struct PPB_Console_1_0* consoleInterface = NULL;
static const struct PPB_Var_1_1* varInterface = NULL;
static const struct PPB_Messaging_1_0* messagingInterface = NULL;
static const struct PPB_VarDictionary_1_0* dictionaryInterface = NULL;
static const struct PPB_VarArrayBuffer_1_0* arrayBufferInterface = NULL;

static struct PP_Var operationStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var idStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var shapeStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var xStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var yStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var zStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var lengthStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var statusStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var errorStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
static struct PP_Var successStringVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };

static float xArray[1024*1024*32];
static float yArray[1024*1024*32];

PP_EXPORT int32_t PPP_InitializeModule(PP_Module module, PPB_GetInterface get_browser_interface) {
	consoleInterface = get_browser_interface(PPB_CONSOLE_INTERFACE_1_0);
	messagingInterface = get_browser_interface(PPB_MESSAGING_INTERFACE_1_0);
	varInterface = get_browser_interface(PPB_VAR_INTERFACE_1_1);
	dictionaryInterface = get_browser_interface(PPB_VAR_DICTIONARY_INTERFACE_1_0);
	arrayBufferInterface = get_browser_interface(PPB_VAR_ARRAY_BUFFER_INTERFACE_1_0);
	operationStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "operation");
	idStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "id");
	xStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "x");
	xOffsetStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "xOffset");
	yStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "y");
	yOffsetStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "yOffset");
	zStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "z");
	zOffsetStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "zOffset");
	lengthStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "length");
	statusStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "status");
	errorStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "error");
	successStringVar = NUMJS_VAR_FROM_STRING_LITERAL(varInterface, "success");
	for (size_t i = 0; i < 1024*1024*32; i++) {
		xArray[i] = (float)rand() / (float)RAND_MAX;
		yArray[i] = (float)rand() / (float)RAND_MAX;
	}
	return PP_OK;
}

PP_EXPORT void PPP_ShutdownModule(void) {
	varInterface->Release(successStringVar);
	varInterface->Release(errorStringVar);
	varInterface->Release(statusStringVar);
	varInterface->Release(lengthStringVar);
	varInterface->Release(zStringVar);
	varInterface->Release(yStringVar);
	varInterface->Release(xStringVar);
	varInterface->Release(idStringVar);
	varInterface->Release(operationStringVar);
}

static PP_Bool onCreateInstance(PP_Instance instance, uint32_t argc, const char* argn[], const char* argv[]) {
	struct PP_Var varMessage = varInterface->VarFromUtf8("PNaCl INIT", sizeof("PNaCl INIT") - 1);
	consoleInterface->Log(instance, PP_LOGLEVEL_LOG, varMessage);
	varInterface->Release(varMessage);
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

float dotProductF32(size_t length, const float x[restrict static length], const float y[restrict static length]);

static void handleDotProduct(PP_Instance instance, struct PP_Var message) {
	struct PP_Var xVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
	struct PP_Var yVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
	struct PP_Var xOffsetVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
	struct PP_Var yOffsetVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
	struct PP_Var lengthVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };
	struct PP_Var replyVar = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };

	float* xPointer = NULL;
	float* yPointer = NULL;

	xVar = dictionaryInterface->Get(message, xStringVar);
	if (xVar.type != PP_VARTYPE_ARRAY_BUFFER) {
		goto cleanup;
	}

	yVar = dictionaryInterface->Get(message, yStringVar);
	if (yVar.type != PP_VARTYPE_ARRAY_BUFFER) {
		goto cleanup;
	}

	xOffsetVar = dictionaryInterface->Get(message, xOffsetStringVar);
	if (xOffsetVar.type != PP_VARTYPE_INT32) {
		goto cleanup;
	}
	const int32_t xOffset = xOffsetVar.value.as_int;

	if (xOffset < 0) {
		goto cleanup;
	}

	yOffsetVar = dictionaryInterface->Get(message, yOffsetStringVar);
	if (yOffsetVar.type != PP_VARTYPE_INT32) {
		goto cleanup;
	}
	const int32_t yOffset = yOffsetVar.value.as_int;

	if (yOffset < 0) {
		goto cleanup;
	}

	lengthVar = dictionaryInterface->Get(message, lengthStringVar);
	if (lengthVar.type != PP_VARTYPE_INT32) {
		goto cleanup;
	}
	const int32_t length = lengthVar.value.as_int;

	if (length < 0) {
		goto cleanup;
	}

	uint32_t xSize = 0;
	if (arrayBufferInterface->ByteLength(xVar, &xSize) != PP_TRUE) {
		goto cleanup;
	}

	if ((xOffset + length) * sizeof(float) > xSize) {
		goto cleanup;
	}

	uint32_t ySize;
	if (arrayBufferInterface->ByteLength(yVar, &ySize) != PP_TRUE) {
		goto cleanup;
	}

	if ((yOffset + length) * sizeof(float) > xSize) {
		goto cleanup;
	}

	xPointer = arrayBufferInterface->Map(xVar);
	if (xPointer == NULL) {
		goto cleanup;
	}

	yPointer = arrayBufferInterface->Map(yVar);
	if (yPointer == NULL) {
		goto cleanup;
	}

	replyVar = dictionaryInterface->Create();
	if (dictionaryInterface->Set(replyVar, statusStringVar, successStringVar) != PP_TRUE) {
		goto cleanup;
	}

	const float result = dotProductF32(length, xPointer, yPointer);
	const struct PP_Var zVar = PP_MakeDouble(result);
	if (dictionaryInterface->Set(replyVar, zStringVar, zVar) != PP_TRUE) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, replyVar);
cleanup:
	if (xPointer != NULL) {
		arrayBufferInterface->Unmap(xVar);
	}
	if (yPointer != NULL) {
		arrayBufferInterface->Unmap(yVar);
	}
	varInterface->Release(replyVar);
	varInterface->Release(lengthVar);
	varInterface->Release(yOffsetVar);
	varInterface->Release(yVar);
	varInterface->Release(xOffsetVar);
	varInterface->Release(xVar);
}

static void handleMessage(PP_Instance instance, struct PP_Var message) {
	if (message.type == PP_VARTYPE_DICTIONARY) {
		const struct PP_Var operationVar = dictionaryInterface->Get(message, operationStringVar);
		uint32_t operationLength = 0;
		const char* const operationPointer = varInterface->VarToUtf8(operationVar, &operationLength);
		if (strncmp(operationPointer, "ALLOC.F64", operationLength) == 0) {
			handleAllocF64(instance, message);
		} else if (strncmp(operationPointer, "ALLOC.F32", operationLength) == 0) {
			handleAllocF32(instance, message);
		} else if (strncmp(operationPointer, "LOG.F64", operationLength) == 0) {
			handleExpF32(instance, message);
		} else if (strncmp(operationPointer, "LOG.F32", operationLength) == 0) {
			handleExpF32(instance, message);
		}
		varInterface->Release(operationVar);
	}
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
