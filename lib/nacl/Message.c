#include <string.h>

#include "Message.h"
#include "Strings.h"
#include "Interfaces.h"

struct PP_Var NumJS_ResponseVariable = { PP_VARTYPE_UNDEFINED, 0, {PP_FALSE} };

enum NumJS_Error NumJS_Message_Parse(uint32_t variablesCount, const struct NumJS_VariableDescriptor descriptors[static variablesCount], struct NumJS_Variable variables[static variablesCount], struct PP_Var request) {
	enum NumJS_Error error = NumJS_Error_Ok;
	/* Zero-initialization sets PPAPI variables to undefined value */
	memset(variables, 0, sizeof(struct NumJS_Variable) * variablesCount);
	for (uint32_t variableIndex = 0; variableIndex < variablesCount; variableIndex++) {
		variables[variableIndex].pepperVariable = dictionaryInterface->Get(request,
			NumJS_StringVariables[descriptors[variableIndex].name]);
		const PP_VarType pepperType = variables[variableIndex].pepperVariable.type;
		if (pepperType == PP_VARTYPE_UNDEFINED) {
			error = NumJS_Error_MissingVariable;
			goto cleanup;
		}
		switch (descriptors[variableIndex].type) {
			case NumJS_VariableType_Int32:
				if (pepperType == PP_VARTYPE_INT32) {
					variables[variableIndex].parsedValue.asInt32 = variables[variableIndex].pepperVariable.value.as_int;
				} else {
					error = NumJS_Error_InvalidVariableType;
					goto cleanup;
				}
				break;
			case NumJS_VariableType_Float64:
				if (pepperType == PP_VARTYPE_DOUBLE) {
					variables[variableIndex].parsedValue.asFloat64 = variables[variableIndex].pepperVariable.value.as_double;
				} else if (pepperType == PP_VARTYPE_INT32) {
					variables[variableIndex].parsedValue.asFloat64 = (double) variables[variableIndex].pepperVariable.value.as_int;
				} else {
					error = NumJS_Error_InvalidVariableType;
					goto cleanup;
				}
				break;
			case NumJS_VariableType_DataType:
			case NumJS_VariableType_Command:
			{
				uint32_t stringSize = 0;
				const char* const stringPointer = varInterface->VarToUtf8(variables[variableIndex].pepperVariable, &stringSize);
				/* For empty string VarToUtf8 returns zero length, but non-null pointer */
				if (stringPointer != NULL) {
					switch (descriptors[variableIndex].type) {
						case NumJS_VariableType_DataType:
							variables[variableIndex].parsedValue.asDatatype = NumJS_DataType_Parse(stringPointer, stringSize);
							break;
						case NumJS_VariableType_Command:
							variables[variableIndex].parsedValue.asCommand = NumJS_Command_Parse(stringPointer, stringSize);
							break;
						case NumJS_VariableType_Int32:
						case NumJS_VariableType_Float64:
						case NumJS_VariableType_Buffer:
						default:
							__builtin_unreachable();
					}
				} else {
					error = NumJS_Error_InvalidVariableType;
					goto cleanup;
				}
				break;
			}
			case NumJS_VariableType_Buffer:
			{
				uint32_t bufferSize = 0;
				if (bufferInterface->ByteLength(variables[variableIndex].pepperVariable, &bufferSize) == PP_TRUE) {
					if (bufferSize != 0) {
						void* bufferPointer = bufferInterface->Map(variables[variableIndex].pepperVariable);
						if (bufferPointer != NULL) {
							variables[variableIndex].parsedValue.asBuffer.size = bufferSize;
							variables[variableIndex].parsedValue.asBuffer.pointer = bufferPointer;
						} else {
							error = NumJS_Error_InvalidVariableType;
							goto cleanup;
						}
					} else {
						error = NumJS_Error_EmptyBuffer;
						goto cleanup;
					}
				} else {
					error = NumJS_Error_InvalidVariableType;
					goto cleanup;
				}
				break;
			}
			default:
				__builtin_unreachable();
		}
	}
	return NumJS_Error_Ok;
cleanup:
	NumJS_Message_FreeVariables(variablesCount, variables);
	return error;
}

void NumJS_Message_FreeVariables(uint32_t variablesCount, struct NumJS_Variable variables[static variablesCount]) {
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

bool NumJS_Message_SetStatus(struct PP_Var responseVar, enum NumJS_Error error) {
	if (error == NumJS_Error_Ok) {
		if (dictionaryInterface->Set(responseVar,
			NumJS_StringVariables[NumJS_StringVariable_Status],
			NumJS_StringVariables[NumJS_StringVariable_Success]) != PP_TRUE)
		{
			//~ NUMJS_LOG_ERROR("Failed to set success status");
			return false;
		}
	} else {
		if (dictionaryInterface->Set(responseVar,
			NumJS_StringVariables[NumJS_StringVariable_Status],
			NumJS_StringVariables[NumJS_StringVariable_Error]) != PP_TRUE)
		{
			//~ NUMJS_LOG_ERROR("Failed to set error status");
			return false;
		}
	}
	return true;
}
