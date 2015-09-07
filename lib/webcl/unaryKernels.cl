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
kernel void expm1_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = expm1(a[id]);
	}
}
kernel void expm1_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = expm1(a[id]);
	}
}
kernel void exp2_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	float result = 1;
	if (id < length) {
		out[id] = exp2(a[id]);
	}
}
kernel void exp2_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	double result = 1;
	if (id < length) {
		out[id] = exp2(a[id]);
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
kernel void log10_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = log10(a[id]);
	}
}
kernel void log10_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = log10(a[id]);
	}
}
kernel void log2_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = log2(a[id]);
}
kernel void log2_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = log2(a[id]);
	}
}
kernel void log1p_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = log1p(a[id]);
	}
}
kernel void log1p_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = log1p(a[id]);
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
kernel void sin_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = sin(a[id]);
	}
}
kernel void sin_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = sin(a[id]);
	}
}
kernel void cos_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = cos(a[id]);
	}
}
kernel void cos_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = cos(a[id]);
	}
}
kernel void tan_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = tan(a[id]);
	}
}
kernel void tan_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = tan(a[id]);
	}
}
kernel void arcsin_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = asin(a[id]);
	}
}
kernel void arcsin_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = asin(a[id]);
	}
}
kernel void arccos_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = acos(a[id]);
	}
}
kernel void arccos_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = acos(a[id]);
	}
}
kernel void arctan_f32(
	uint length,
	global float* a,
	global float* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = atan(a[id]);
	}
}
kernel void arctan_f64(
	uint length,
	global double* a,
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = atan(a[id]);
	}
}
kernel void radians_f32(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = radians(a[id]);
	}
}
kernel void radians_f64(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = radians(a[id]);
	}
}
kernel void degrees_f32(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = degrees(a[id]);
	}
}
kernel void degrees_f64(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = degrees(a[id]);
	}
}
kernel void rint_f32(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = radians(a[id]);
	}
}
kernel void rint_f64(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = rint(a[id]);
	}
}
kernel void floor_f32(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = floor(a[id]);
	}
}
kernel void floor_f64(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = floor(a[id]);
	}
}
kernel void ceil_f32(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = ceil(a[id]);
	}
}
kernel void ceil_f64(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = ceil(a[id]);
	}
}
kernel void trunc_f32(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = trunc(a[id]);
	}
}
kernel void trunc_f64(
	uint length
	global double* a
	global double* out)
{
	const uint id = get_global_id(0);
	if (id < length) {
		out[id] = trunc(a[id]);
	}
}
