#pragma once

#include <stdint.h>
#include <stdbool.h>

#define FJS_COUNT_OF(array) (sizeof(array) / sizeof((array)[0]))
#define FJS_LENGTH_OF(stringLiteral) (FJS_COUNT_OF(stringLiteral) - 1)

inline static bool FJS_Util_Mul32u(uint32_t a, uint32_t b, uint32_t out[restrict static 1]) {
#if defined(__clang__) && !defined(__pnacl__)
	return !__builtin_umul_overflow(a, b, out);
#else
	const uint64_t fullProduct = ((uint64_t)a) * ((uint64_t)b);
	*out = (uint32_t)fullProduct;
	return (uint32_t)(fullProduct >> 32) == 0;
#endif
}

inline static bool FJS_Util_Add32u(uint32_t a, uint32_t b, uint32_t out[restrict static 1]) {
#if defined(__clang__) && !defined(__pnacl__)
	return !__builtin_uadd_overflow(a, b, out);
#else
	const uint32_t sum = a + b;
	*out = sum;
	return sum >= a;
#endif
}

inline static uint32_t FJS_Util_Min32u(uint32_t a, uint32_t b) {
	return a < b ? a : b;
}
