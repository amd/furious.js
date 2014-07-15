kernel void dot_f32(
	uint reductionDim,
	global float* a,
	global float* b,
	global float* out)
{
	const uint i = get_global_id(0);
	const uint k = get_global_id(1);
	const uint l = get_global_id(2);
	const uint outerStrideB = get_global_size(1);
	const uint innerStrideB = get_global_size(2);

	float accumulator = 0.0f;
	for (uint j = 0; j < reductionDim; ++j) {
		accumulator += a[i*reductionDim+j] * b[(k*reductionDim+j)*innerStrideB+l];
	}
	out[(i*outerStrideB + k) * innerStrideB + l] = accumulator;
}

kernel void dot_f64(
	uint reductionDim,
	global double* a,
	global double* b,
	global double* out)
{
	const uint i = get_global_id(0);
	const uint k = get_global_id(1);
	const uint l = get_global_id(2);
	const uint outerStrideB = get_global_size(1);
	const uint innerStrideB = get_global_size(2);

	double accumulator = 0.0;
	for (uint j = 0; j < reductionDim; ++j) {
		accumulator += a[i*reductionDim+j] * b[(k*reductionDim+j)*innerStrideB+l];
	}
	out[(i*outerStrideB + k) * innerStrideB + l] = accumulator;
}
