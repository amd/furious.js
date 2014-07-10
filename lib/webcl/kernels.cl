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
