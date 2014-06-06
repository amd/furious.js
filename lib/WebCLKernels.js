module.exports = "\
kernel void addF32(\
	uint length,\
	global float* a,\
	global float* b,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] + b[id];\
	}\
}\
kernel void addF64(\
	uint length,\
	global double* a,\
	global double* b,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] + b[id];\
	}\
}\
kernel void subF32(\
	uint length,\
	global float* a,\
	global float* b,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] - b[id];\
	}\
}\
kernel void subF64(\
	uint length,\
	global double* a,\
	global double* b,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] - b[id];\
	}\
}\
kernel void mulF32(\
	uint length,\
	global float* a,\
	global float* b,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] * b[id];\
	}\
}\
kernel void mulF64(\
	uint length,\
	global double* a,\
	global double* b,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] * b[id];\
	}\
}\
kernel void divF32(\
	uint length,\
	global float* a,\
	global float* b,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] / b[id];\
	}\
}\
kernel void divF64(\
	uint length,\
	global double* a,\
	global double* b,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] / b[id];\
	}\
}\
kernel void addConstF32(\
	uint length,\
	global float* a,\
	float b,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] + b;\
	}\
}\
kernel void addConstF64(\
	uint length,\
	global double* a,\
	double b,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] + b;\
	}\
}\
kernel void subConstF32(\
	uint length,\
	global float* a,\
	float b,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] - b;\
	}\
}\
kernel void subConstF64(\
	uint length,\
	global double* a,\
	double b,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] - b;\
	}\
}\
kernel void mulConstF32(\
	uint length,\
	global float* a,\
	float b,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] * b;\
	}\
}\
kernel void mulConstF64(\
	uint length,\
	global double* a,\
	double b,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] * b;\
	}\
}\
kernel void divConstF32(\
	uint length,\
	global float* a,\
	float b,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] / b;\
	}\
}\
kernel void divConstF64(\
	uint length,\
	global double* a,\
	double b,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = a[id] / b;\
	}\
}\
kernel void negF32(\
	uint length,\
	global float* a,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = -a[id];\
	}\
}\
kernel void negF64(\
	uint length,\
	global double* a,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = -a[id];\
	}\
}\
kernel void absF32(\
	uint length,\
	global float* a,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = fabs(a[id]);\
	}\
}\
kernel void absF64(\
	uint length,\
	global double* a,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = fabs(a[id]);\
	}\
}\
kernel void expF32(\
	uint length,\
	global float* a,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = exp(a[id]);\
	}\
}\
kernel void expF64(\
	uint length,\
	global double* a,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = exp(a[id]);\
	}\
}\
kernel void logF32(\
	uint length,\
	global float* a,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = log(a[id]);\
	}\
}\
kernel void logF64(\
	uint length,\
	global double* a,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = log(a[id]);\
	}\
}\
kernel void sqrtF32(\
	uint length,\
	global float* a,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = sqrt(a[id]);\
	}\
}\
kernel void sqrtF64(\
	uint length,\
	global double* a,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		out[id] = sqrt(a[id]);\
	}\
}\
kernel void squareF32(\
	uint length,\
	global float* a,\
	global float* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		const float aVal = a[id]; \
		out[id] = aVal * aVal;\
	}\
}\
kernel void squareF64(\
	uint length,\
	global double* a,\
	global double* out)\
{\
	const uint id = get_global_id(0);\
	if (id < length) {\
		const double aVal = a[id];\
		out[id] = aVal * aVal;\
	}\
}\
";
