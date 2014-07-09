#include <stdint.h>
#include <malloc.h>
#include <string.h>

#include "IdMap.h"

struct Entry {
	int32_t instance;
	int32_t id;
	void* pointer;
};

int32_t FJS_ID_Allocations = 0;

static struct Entry* entriesBuffer = NULL;
static size_t entriesCount = 0;
static size_t entriesCapacity = 0;

static size_t computeExpansionCapacity(size_t capacity) {
	return capacity + 128;
}

static struct Entry* findEntry(PP_Instance instance, int32_t id) {
	for (struct Entry *currentEntry = entriesBuffer, *endEntry = &entriesBuffer[entriesCount]; currentEntry != endEntry; currentEntry++) {
		if ((currentEntry->id == id) && (currentEntry->instance == instance)) {
			return currentEntry;
		}
	}
	return NULL;
}

void* FJS_GetPointerFromId(PP_Instance instance, int32_t id) {
	const struct Entry* entry = findEntry(instance, id);
	if (entry == NULL) {
		return NULL;
	} else {
		return entry->pointer;
	}
}

void FJS_ReleaseId(PP_Instance instance, int32_t id) {
	struct Entry* releasedEntry = findEntry(instance, id);
	if (releasedEntry != NULL) {
		struct Entry* beginMovableEntry = releasedEntry + 1;
		struct Entry* endMovableEntry = &entriesBuffer[entriesCount];
		const size_t movableEntriesSize = (endMovableEntry - beginMovableEntry) * sizeof(struct Entry);
		memmove(releasedEntry, beginMovableEntry, movableEntriesSize);
		entriesCount -= 1;
		FJS_ID_Allocations -= 1;
	}
}

void FJS_AllocateId(PP_Instance instance, int32_t id, void* pointer) {
	if (entriesCount + 1 > entriesCapacity) {
		entriesCapacity = computeExpansionCapacity(entriesCapacity);
		entriesBuffer = realloc(entriesBuffer, entriesCapacity * sizeof(struct Entry));
	}
	const struct Entry entry = {
		.instance = instance,
		.id = id,
		.pointer = pointer
	};
	entriesBuffer[entriesCount] = entry;
	entriesCount += 1;
	FJS_ID_Allocations += 1;
}
