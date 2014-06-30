#include <alloca.h>
#include <string.h>

#include "Message.h"
#include "Strings.h"
#include "Interfaces.h"

struct PP_Var FJS_ResponseVariable = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };

enum FJS_Error FJS_Message_Dispatch(PP_Instance instance,
	size_t variableSize,
	size_t variablesCount,
	const struct FJS_ArgumentDescriptor descriptors[static variablesCount],
	size_t cleanupEntries,
	const enum FJS_StringVariable cleanupNames[static cleanupEntries],
	struct PP_Var request,
	struct PP_Var response,
	FJS_Execute_Function executeFunction)
{
	enum FJS_Error error = FJS_Error_Ok;
	bool cleanupResponse = false;

	void* arguments = alloca(variableSize);
	memset(arguments, 0, variableSize);

	/* Zero-initialization sets PPAPI variables to undefined value */
	struct PP_Var variables[variablesCount];
	memset(variables, 0, sizeof(struct PP_Var) * variablesCount);
	for (uint32_t variableIndex = 0; variableIndex < variablesCount; variableIndex++) {
		variables[variableIndex] =
			dictionaryInterface->Get(request, FJS_StringVariables[descriptors[variableIndex].name]);
		const PP_VarType pepperType = variables[variableIndex].type;
		if (pepperType == PP_VARTYPE_UNDEFINED) {
			error = FJS_Error_MissingVariable;
			goto reply;
		}
		const void* argument = arguments + descriptors[variableIndex].offset;
		switch (descriptors[variableIndex].type) {
			case FJS_ArgumentType_Boolean:
				if (pepperType == PP_VARTYPE_BOOL) {
					*((bool*) argument) = variables[variableIndex].value.as_bool;
				} else {
					error = FJS_Error_InvalidVariableType;
					goto reply;
				}
				break;
			case FJS_ArgumentType_Int32:
				if (pepperType == PP_VARTYPE_INT32) {
					*((int32_t*) argument) = variables[variableIndex].value.as_int;
				} else {
					error = FJS_Error_InvalidVariableType;
					goto reply;
				}
				break;
			case FJS_ArgumentType_Float64:
				switch (pepperType) {
					case PP_VARTYPE_DOUBLE:
						*((double*) argument) = variables[variableIndex].value.as_double;
						break;
					case PP_VARTYPE_INT32:
						*((double*) argument) = variables[variableIndex].value.as_int;
						break;						
					default:
						error = FJS_Error_InvalidVariableType;
						goto reply;
				}
				break;
			case FJS_ArgumentType_DataType:
			{
				uint32_t stringSize = 0;
				const char* const stringPointer = varInterface->VarToUtf8(variables[variableIndex], &stringSize);
				/* For empty string VarToUtf8 returns zero length, but non-null pointer */
				if (stringPointer != NULL) {
					*((enum FJS_DataType*) argument) = FJS_DataType_Parse(stringPointer, stringSize);
				} else {
					error = FJS_Error_InvalidVariableType;
					goto reply;
				}
				break;
			}
			case FJS_ArgumentType_Buffer:
			case FJS_ArgumentType_Shape:
			{
				uint32_t bufferSize = 0;
				if (bufferInterface->ByteLength(variables[variableIndex], &bufferSize) == PP_TRUE) {
					if (bufferSize != 0) {
						if (descriptors[variableIndex].type == FJS_ArgumentType_Shape) {
							if (bufferSize % sizeof(uint32_t) != 0) {
								error = FJS_Error_InvalidBufferSize;
								goto reply;
							}
						}
						void* bufferPointer = bufferInterface->Map(variables[variableIndex]);
						if (bufferPointer != NULL) {
							switch (descriptors[variableIndex].type) {
								case FJS_ArgumentType_Buffer:
									*((struct FJS_Buffer*) argument) = (struct FJS_Buffer) {
										.size = bufferSize,
										.pointer = bufferPointer
									};
									break;
								case FJS_ArgumentType_Shape:
									*((struct FJS_Shape*) argument) = (struct FJS_Shape) {
										.dimensions = bufferSize / 4,
										.buffer = bufferPointer
									};
									break;
								default:
									__builtin_unreachable();
							}
						} else {
							error = FJS_Error_InvalidVariableType;
							goto reply;
						}
					} else {
						error = FJS_Error_EmptyBuffer;
						goto reply;
					}
				} else {
					error = FJS_Error_InvalidVariableType;
					goto reply;
				}
				break;
			}
			default:
				__builtin_unreachable();
		}
	}
	error = executeFunction(instance, arguments, &response);
	if (error == FJS_Error_Ok) {
		cleanupResponse = true;
	}

reply:
	if (!FJS_Message_SetStatus(instance, response, error)) {
		goto cleanup;
	}

	messagingInterface->PostMessage(instance, response);

	if (cleanupResponse) {
		for (size_t entryIndex = 0; entryIndex < cleanupEntries; entryIndex++) {
			const enum FJS_StringVariable cleanupName = cleanupNames[entryIndex];
			dictionaryInterface->Delete(response, FJS_StringVariables[cleanupName]);
		}
	}
	FJS_Message_ClearStatus(response, error);

cleanup:
	for (uint32_t variableIndex = 0; variableIndex < variablesCount; variableIndex++) {
		if (variables[variableIndex].type == PP_VARTYPE_ARRAY_BUFFER) {
			void* argument = (arguments + descriptors[variableIndex].offset);
			if (((struct FJS_Buffer*) argument)->pointer != NULL) {
				bufferInterface->Unmap(variables[variableIndex]);
			}
		}
		varInterface->Release(variables[variableIndex]);
	}
	return error;
}

bool FJS_Message_SetStatus(PP_Instance instance, struct PP_Var responseVar, enum FJS_Error error) {
	if (error == FJS_Error_Ok) {
		if (dictionaryInterface->Set(responseVar,
			FJS_StringVariables[FJS_StringVariable_Status],
			FJS_StringVariables[FJS_StringVariable_Success]) != PP_TRUE)
		{
			FJS_LOG_ERROR("Failed to set success status");
			return false;
		}
	} else {
		if (dictionaryInterface->Set(responseVar,
			FJS_StringVariables[FJS_StringVariable_Status],
			FJS_StringVariables[FJS_StringVariable_Error]) != PP_TRUE)
		{
			FJS_LOG_ERROR("Failed to set error status");
			return false;
		}
		if (dictionaryInterface->Set(responseVar,
			FJS_StringVariables[FJS_StringVariable_Description],
			FJS_StringVariables[FJS_Error_ToString(error)]) != PP_TRUE)
		{
			FJS_LOG_ERROR("Failed to set error description");
			return false;
		}
	}
	return true;
}

void FJS_Message_ClearStatus(struct PP_Var response, enum FJS_Error error) {
	dictionaryInterface->Delete(response, FJS_StringVariables[FJS_StringVariable_Status]);
	if (error != FJS_Error_Ok) {
		dictionaryInterface->Delete(response, FJS_StringVariables[FJS_StringVariable_Description]);
	}
}
