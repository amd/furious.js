#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "Error.h"
#include "NDArray.h"
#include "Commands.h"
#include "IdMap.h"

enum NumJS_Error NumJS_Release(PP_Instance instance, int32_t idIn) {
	struct NDArray* array = NumJS_GetPointerFromId(instance, idIn);
	if (array == NULL) {
		return NumJS_Error_InvalidId;
	} else {
		NumJS_NDArray_Delete(array);
		return NumJS_Error_Ok;
	}
}

