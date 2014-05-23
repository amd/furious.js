#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "Interfaces.h"
#include "Error.h"
#include "NDArray.h"
#include "Commands.h"
#include "IdMap.h"

enum NumJS_Error NumJS_GetBuffer(PP_Instance instance, int32_t idIn, struct PP_Var bufferOut[static 1]) {
	enum NumJS_Error error = NumJS_Error_Ok;
	struct PP_Var bufferVar = PP_MakeUndefined();
	void* bufferPointer = NULL;

	struct NDArray* array = NumJS_GetPointerFromId(instance, idIn);
	if (array == NULL) {
		error = NumJS_Error_InvalidId;
		goto cleanup;
	}

	const uint32_t elementSize = NumJS_DataType_GetSize(array->dataType);
	if (elementSize == 0) {
		error = NumJS_Error_InvalidDataType;
		goto cleanup;
	}
	const uint32_t dataSize = elementSize * array->length;
	bufferVar = bufferInterface->Create(dataSize);
	bufferPointer = bufferInterface->Map(bufferVar);
	if (bufferPointer == NULL) {
		error = NumJS_Error_OutOfMemory;
		goto cleanup;
	}

	memcpy(bufferPointer, NumJS_NDArray_GetData(array), dataSize);

cleanup:
	if (bufferPointer != NULL) {
		bufferInterface->Unmap(bufferVar);
	}
	if (error == NumJS_Error_Ok) {
		*bufferOut = bufferVar;
	} else {
		varInterface->Release(bufferVar);
	}
	return error;
}

