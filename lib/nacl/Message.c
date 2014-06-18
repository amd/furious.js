#include <string.h>

#include "Message.h"
#include "Strings.h"
#include "Interfaces.h"

struct PP_Var FJS_ResponseVariable = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };

enum FJS_Error FJS_Message_Parse(uint32_t variablesCount, const struct FJS_VariableDescriptor descriptors[static variablesCount], struct FJS_Variable variables[static variablesCount], struct PP_Var request) {
	enum FJS_Error error = FJS_Error_Ok;
	/* Zero-initialization sets PPAPI variables to undefined value */
	memset(variables, 0, sizeof(struct FJS_Variable) * variablesCount);
	for (uint32_t variableIndex = 0; variableIndex < variablesCount; variableIndex++) {
		variables[variableIndex].pepperVariable = dictionaryInterface->Get(request,
			FJS_StringVariables[descriptors[variableIndex].name]);
		const PP_VarType pepperType = variables[variableIndex].pepperVariable.type;
		if (pepperType == PP_VARTYPE_UNDEFINED) {
			error = FJS_Error_MissingVariable;
			goto cleanup;
		}
		switch (descriptors[variableIndex].type) {
			case FJS_VariableType_Boolean:
				if (pepperType == PP_VARTYPE_BOOL) {
					variables[variableIndex].parsedValue.asBoolean = variables[variableIndex].pepperVariable.value.as_bool;
				} else {
					error = FJS_Error_InvalidVariableType;
					goto cleanup;
				}
				break;
			case FJS_VariableType_Int32:
				if (pepperType == PP_VARTYPE_INT32) {
					variables[variableIndex].parsedValue.asInt32 = variables[variableIndex].pepperVariable.value.as_int;
				} else {
					error = FJS_Error_InvalidVariableType;
					goto cleanup;
				}
				break;
			case FJS_VariableType_Float64:
				switch (pepperType) {
					case PP_VARTYPE_DOUBLE:
						variables[variableIndex].parsedValue.asFloat64 = variables[variableIndex].pepperVariable.value.as_double;
						break;
					case PP_VARTYPE_INT32:
						variables[variableIndex].parsedValue.asFloat64 = (double) variables[variableIndex].pepperVariable.value.as_int;
						break;						
					default:
						error = FJS_Error_InvalidVariableType;
						goto cleanup;
				}
				break;
			case FJS_VariableType_DataType:
			case FJS_VariableType_Command:
			{
				uint32_t stringSize = 0;
				const char* const stringPointer = varInterface->VarToUtf8(variables[variableIndex].pepperVariable, &stringSize);
				/* For empty string VarToUtf8 returns zero length, but non-null pointer */
				if (stringPointer != NULL) {
					switch (descriptors[variableIndex].type) {
						case FJS_VariableType_DataType:
							variables[variableIndex].parsedValue.asDatatype = FJS_DataType_Parse(stringPointer, stringSize);
							break;
						case FJS_VariableType_Command:
							variables[variableIndex].parsedValue.asCommand = FJS_Command_Parse(stringPointer, stringSize);
							break;
						case FJS_VariableType_Int32:
						case FJS_VariableType_Float64:
						case FJS_VariableType_Buffer:
						default:
							__builtin_unreachable();
					}
				} else {
					error = FJS_Error_InvalidVariableType;
					goto cleanup;
				}
				break;
			}
			case FJS_VariableType_Buffer:
			{
				uint32_t bufferSize = 0;
				if (bufferInterface->ByteLength(variables[variableIndex].pepperVariable, &bufferSize) == PP_TRUE) {
					if (bufferSize != 0) {
						void* bufferPointer = bufferInterface->Map(variables[variableIndex].pepperVariable);
						if (bufferPointer != NULL) {
							variables[variableIndex].parsedValue.asBuffer.size = bufferSize;
							variables[variableIndex].parsedValue.asBuffer.pointer = bufferPointer;
						} else {
							error = FJS_Error_InvalidVariableType;
							goto cleanup;
						}
					} else {
						error = FJS_Error_EmptyBuffer;
						goto cleanup;
					}
				} else {
					error = FJS_Error_InvalidVariableType;
					goto cleanup;
				}
				break;
			}
			default:
				__builtin_unreachable();
		}
	}
	return FJS_Error_Ok;
cleanup:
	FJS_Message_FreeVariables(variablesCount, variables);
	return error;
}

void FJS_Message_FreeVariables(uint32_t variablesCount, struct FJS_Variable variables[static variablesCount]) {
	for (uint32_t variableIndex = 0; variableIndex < variablesCount; variableIndex++) {
		if (variables[variableIndex].pepperVariable.type == PP_VARTYPE_ARRAY_BUFFER) {
			if (variables[variableIndex].parsedValue.asBuffer.pointer != NULL) {
				bufferInterface->Unmap(variables[variableIndex].pepperVariable);
			}
		}
		varInterface->Release(variables[variableIndex].pepperVariable);
		variables[variableIndex].pepperVariable = PP_MakeUndefined();
	}
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
	}
	return true;
}
