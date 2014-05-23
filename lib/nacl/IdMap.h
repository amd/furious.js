#pragma once

#include <stdint.h>
#include <ppapi/c/pp_instance.h>

extern void* NumJS_GetPointerFromId(PP_Instance instance, int32_t id);
extern void NumJS_ReleaseId(PP_Instance instance, int32_t id);
extern void NumJS_AllocateId(PP_Instance instance, int32_t id, void* pointer);
