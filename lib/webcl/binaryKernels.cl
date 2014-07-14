kernel void add_f32(
	uint length,
	global float* a,
	global float* b,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] + b[id];
	}
}
kernel void add_f64(
	uint length,
	global double* a,
	global double* b,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] + b[id];
	}
}
kernel void sub_f32(
	uint length,
	global float* a,
	global float* b,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] - b[id];
	}
}
kernel void sub_f64(
	uint length,
	global double* a,
	global double* b,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] - b[id];
	}
}
kernel void mul_f32(
	uint length,
	global float* a,
	global float* b,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] * b[id];
	}
}
kernel void mul_f64(
	uint length,
	global double* a,
	global double* b,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] * b[id];
	}
}
kernel void div_f32(
	uint length,
	global float* a,
	global float* b,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] / b[id];
	}
}
kernel void div_f64(
	uint length,
	global double* a,
	global double* b,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] / b[id];
	}
}
kernel void addc_f32(
	uint length,
	global float* a,
	float b,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] + b;
	}
}
kernel void addc_f64(
	uint length,
	global double* a,
	double b,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] + b;
	}
}
kernel void subc_f32(
	uint length,
	global float* a,
	float b,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] - b;
	}
}
kernel void subc_f64(
	uint length,
	global double* a,
	double b,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] - b;
	}
}
kernel void subrc_f32(
	uint length,
	global float* a,
	float b,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = b / a[id];
	}
}
kernel void subrc_f64(
	uint length,
	global double* a,
	double b,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = b / a[id];
	}
}
kernel void mulc_f32(
	uint length,
	global float* a,
	float b,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] * b;
	}
}
kernel void mulc_f64(
	uint length,
	global double* a,
	double b,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] * b;
	}
}
kernel void divc_f32(
	uint length,
	global float* a,
	float b,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] / b;
	}
}
kernel void divc_f64(
	uint length,
	global double* a,
	double b,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = a[id] / b;
	}
}
kernel void divrc_f32(
	uint length,
	global float* a,
	float b,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = b / a[id];
	}
}
kernel void divrc_f64(
	uint length,
	global double* a,
	double b,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = b / a[id];
	}
}
