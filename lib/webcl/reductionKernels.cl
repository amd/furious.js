kernel void sum_f32_gpu(
	uint length,
	global float* a,
	local float* scratch,
	global float* out)
{
	const uint globalSize = get_global_size(0);
	uint globalIndex = get_global_id(0);
	float accumulator = 0.0f;
	while (globalIndex < length) {
		accumulator += a[globalIndex];
		globalIndex += globalSize;
	}

	uint localIndex = get_local_id(0);
	scratch[localIndex] = accumulator;
	barrier(CLK_LOCAL_MEM_FENCE);
	for (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {
		if (localIndex < offset) {
			scratch[localIndex] += scratch[localIndex + offset];
		}
		barrier(CLK_LOCAL_MEM_FENCE);
	}
	if (localIndex == 0) {
		out[get_group_id(0)] = scratch[0];
	}
}

kernel void sum_f64_gpu(
	uint length,
	global double* a,
	local double* scratch,
	global double* out)
{
	const uint globalSize = get_global_size(0);
	uint globalIndex = get_global_id(0);
	double accumulator = 0.0;
	while (globalIndex < length) {
		accumulator += a[globalIndex];
		globalIndex += globalSize;
	}

	uint localIndex = get_local_id(0);
	scratch[localIndex] = accumulator;
	barrier(CLK_LOCAL_MEM_FENCE);
	for (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {
		if (localIndex < offset) {
			scratch[localIndex] += scratch[localIndex + offset];
		}
		barrier(CLK_LOCAL_MEM_FENCE);
	}
	if (localIndex == 0) {
		out[get_group_id(0)] = scratch[0];
	}
}

kernel void min_f32_gpu(
	uint length,
	global float* a,
	local float* scratch,
	global float* out)
{
	const uint globalSize = get_global_size(0);
	uint globalIndex = get_global_id(0);
	float accumulator = INFINITY;
	while (globalIndex < length) {
		accumulator = min(accumulator, a[globalIndex]);
		globalIndex += globalSize;
	}

	uint localIndex = get_local_id(0);
	scratch[localIndex] = accumulator;
	barrier(CLK_LOCAL_MEM_FENCE);
	for (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {
		if (localIndex < offset) {
			scratch[localIndex] = min(scratch[localIndex], scratch[localIndex + offset]);
		}
		barrier(CLK_LOCAL_MEM_FENCE);
	}
	if (localIndex == 0) {
		out[get_group_id(0)] = scratch[0];
	}
}

kernel void min_f64_gpu(
	uint length,
	global double* a,
	local double* scratch,
	global double* out)
{
	const uint globalSize = get_global_size(0);
	uint globalIndex = get_global_id(0);
	double accumulator = INFINITY;
	while (globalIndex < length) {
		accumulator = min(accumulator, a[globalIndex]);
		globalIndex += globalSize;
	}

	uint localIndex = get_local_id(0);
	scratch[localIndex] = accumulator;
	barrier(CLK_LOCAL_MEM_FENCE);
	for (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {
		if (localIndex < offset) {
			scratch[localIndex] = min(scratch[localIndex], scratch[localIndex + offset]);
		}
		barrier(CLK_LOCAL_MEM_FENCE);
	}
	if (localIndex == 0) {
		out[get_group_id(0)] = scratch[0];
	}
}

kernel void max_f32_gpu(
	uint length,
	global float* a,
	local float* scratch,
	global float* out)
{
	const uint globalSize = get_global_size(0);
	uint globalIndex = get_global_id(0);
	float accumulator = -INFINITY;
	while (globalIndex < length) {
		accumulator = max(accumulator, a[globalIndex]);
		globalIndex += globalSize;
	}

	uint localIndex = get_local_id(0);
	scratch[localIndex] = accumulator;
	barrier(CLK_LOCAL_MEM_FENCE);
	for (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {
		if (localIndex < offset) {
			scratch[localIndex] = max(scratch[localIndex], scratch[localIndex + offset]);
		}
		barrier(CLK_LOCAL_MEM_FENCE);
	}
	if (localIndex == 0) {
		out[get_group_id(0)] = scratch[0];
	}
}

kernel void max_f64_gpu(
	uint length,
	global double* a,
	local double* scratch,
	global double* out)
{
	const uint globalSize = get_global_size(0);
	uint globalIndex = get_global_id(0);
	double accumulator = -INFINITY;
	while (globalIndex < length) {
		accumulator = max(accumulator, a[globalIndex]);
		globalIndex += globalSize;
	}

	uint localIndex = get_local_id(0);
	scratch[localIndex] = accumulator;
	barrier(CLK_LOCAL_MEM_FENCE);
	for (uint offset = get_local_size(0) / 2; offset != 0; offset >>= 1) {
		if (localIndex < offset) {
			scratch[localIndex] = max(scratch[localIndex], scratch[localIndex + offset]);
		}
		barrier(CLK_LOCAL_MEM_FENCE);
	}
	if (localIndex == 0) {
		out[get_group_id(0)] = scratch[0];
	}
}
