kernel void neg_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = -a[id];
	}
}
kernel void neg_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = -a[id];
	}
}
kernel void abs_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = fabs(a[id]);
	}
}
kernel void abs_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = fabs(a[id]);
	}
}
kernel void exp_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = exp(a[id]);
	}
}
kernel void exp_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = exp(a[id]);
	}
}
kernel void log_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = log(a[id]);
	}
}
kernel void log_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = log(a[id]);
	}
}
kernel void sqrt_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = sqrt(a[id]);
	}
}
kernel void sqrt_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = sqrt(a[id]);
	}
}
kernel void square_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		const float aVal = a[id]; 
		out[id] = aVal * aVal;
	}
}
kernel void square_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		const double aVal = a[id];
		out[id] = aVal * aVal;
	}
}
