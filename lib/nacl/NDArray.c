#include <stddef.h>
#include <pthread.h>

typedef float v4sf __attribute__((vector_size(16)));

float dotProductF32(size_t length, const float* x, const float* y) {
	const v4sf* simd_x = (const v4sf*)x;
	const v4sf* simd_y = (const v4sf*)y;
	v4sf simd_sum0 = { 0.0f, 0.0f, 0.0f, 0.0f };
	v4sf simd_sum1 = { 0.0f, 0.0f, 0.0f, 0.0f };
	v4sf simd_sum2 = { 0.0f, 0.0f, 0.0f, 0.0f };
	v4sf simd_sum3 = { 0.0f, 0.0f, 0.0f, 0.0f };
	v4sf simd_sum4 = { 0.0f, 0.0f, 0.0f, 0.0f };
	v4sf simd_sum5 = { 0.0f, 0.0f, 0.0f, 0.0f };
	while (length >= 24) {
		simd_sum0 += simd_x[0] * simd_y[0];
		simd_sum1 += simd_x[1] * simd_y[1];
		simd_sum2 += simd_x[2] * simd_y[2];
		simd_sum3 += simd_x[3] * simd_y[3];
		simd_sum4 += simd_x[4] * simd_y[4];
		simd_sum5 += simd_x[5] * simd_y[5];
		simd_x += 6;
		simd_y += 6;
		length -= 24;
	}
	x = (const float*)simd_x;
	y = (const float*)simd_y;
	const v4sf simd_sum = (simd_sum0 + simd_sum1) + (simd_sum2 + simd_sum3) + (simd_sum4 + simd_sum5);
	double sum = (simd_sum[0] + simd_sum[1]) + (simd_sum[2] + simd_sum[3]);
	while (length > 0) {
		sum += (*x++) * (*y++);
		length--;
	}
	return sum;
}
