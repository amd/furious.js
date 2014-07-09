#pragma once

#include <stdint.h>
#include <ppapi/c/pp_instance.h>

extern void* FJS_GetPointerFromId(PP_Instance instance, int32_t id);
extern void FJS_ReleaseId(PP_Instance instance, int32_t id);
extern void FJS_AllocateId(PP_Instance instance, int32_t id, void* pointer);

extern int32_t FJS_ID_Allocations;
