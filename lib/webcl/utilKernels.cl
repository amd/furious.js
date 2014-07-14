kernel void set_f32(
	uint length,
	global float* out,
	float value)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = value;
	}
}
kernel void set_f64(
	uint length,
	global double* out,
	double value)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = value;
	}
}

kernel void linspace_f32(
	uint length,
	global float* out,
	float start,
	float step)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = start + step * ((float) id);
	}
}
kernel void linspace_f64(
	uint length,
	global double* out,
	double start,
	double step)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = start + step * ((double) id);
	}
}

kernel void repeat_f32(
	uint expansionDim,
	uint innerStride,
	uint repeats,
	global float *restrict a,
	global float *restrict out)
{
	const uint i = get_global_id(0);
	const uint j = get_global_id(1);
	const uint k = get_global_id(2);
	const float value = a[(i * expansionDim + j) * innerStride + k];
	uint offsetOut = (i * expansionDim + j) * repeats * innerStride + k;
	for (uint c = 0; c < repeats; ++c) {
		out[offsetOut] = value;
		offsetOut += innerStride;
	}
}
kernel void repeat_f64(
	uint expansionDim,
	uint innerStride,
	uint repeats,
	global double *restrict a,
	global double *restrict out)
{
	const uint i = get_global_id(0);
	const uint j = get_global_id(1);
	const uint k = get_global_id(2);
	const double value = a[(i * expansionDim + j) * innerStride + k];
	uint offsetOut = (i * expansionDim + j) * repeats * innerStride + k;
	for (uint c = 0; c < repeats; ++c) {
		out[offsetOut] = value;
		offsetOut += innerStride;
	}
}
