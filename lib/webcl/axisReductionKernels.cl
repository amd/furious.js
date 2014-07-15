kernel void asum_f32(
	uint reductionDim,
	global float* a,
	global float* out)
{
	const uint innerStride = get_global_size(1);
	const uint i = get_global_id(0);
	const uint k = get_global_id(1);
	a += i * reductionDim * innerStride + k;
	float accumulator = *a;
	while (--reductionDim) {
		a += innerStride;
		accumulator += *a;
	}
	out[i * innerStride + k] = accumulator;
}

kernel void asum_f64(
	uint reductionDim,
	global double* a,
	global double* out)
{
	const uint innerStride = get_global_size(1);
	const uint i = get_global_id(0);
	const uint k = get_global_id(1);
	a += i * reductionDim * innerStride + k;
	double accumulator = *a;
	while (--reductionDim) {
		a += innerStride;
		accumulator += *a;
	}
	out[i * innerStride + k] = accumulator;
}

kernel void amin_f32(
	uint reductionDim,
	global float* a,
	global float* out)
{
	const uint innerStride = get_global_size(1);
	const uint i = get_global_id(0);
	const uint k = get_global_id(1);
	a += i * reductionDim * innerStride + k;
	float accumulator = *a;
	while (--reductionDim) {
		a += innerStride;
		accumulator = min(accumulator, *a);
	}
	out[i * innerStride + k] = accumulator;
}

kernel void amin_f64(
	uint reductionDim,
	global double* a,
	global double* out)
{
	const uint innerStride = get_global_size(1);
	const uint i = get_global_id(0);
	const uint k = get_global_id(1);
	a += i * reductionDim * innerStride + k;
	double accumulator = *a;
	while (--reductionDim) {
		a += innerStride;
		accumulator = min(accumulator, *a);
	}
	out[i * innerStride + k] = accumulator;
}

kernel void amax_f32(
	uint reductionDim,
	global float* a,
	global float* out)
{
	const uint innerStride = get_global_size(1);
	const uint i = get_global_id(0);
	const uint k = get_global_id(1);
	a += i * reductionDim * innerStride + k;
	float accumulator = *a;
	while (--reductionDim) {
		a += innerStride;
		accumulator = max(accumulator, *a);
	}
	out[i * innerStride + k] = accumulator;
}

kernel void amax_f64(
	uint reductionDim,
	global double* a,
	global double* out)
{
	const uint innerStride = get_global_size(1);
	const uint i = get_global_id(0);
	const uint k = get_global_id(1);
	a += i * reductionDim * innerStride + k;
	double accumulator = *a;
	while (--reductionDim) {
		a += innerStride;
		accumulator = max(accumulator, *a);
	}
	out[i * innerStride + k] = accumulator;
}
