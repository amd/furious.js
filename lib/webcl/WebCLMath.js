var createKernels = function(program) {
	var kernels = {
		set: {
			f32: program.createKernel("set_f32"),
			f64: program.createKernel("set_f64")
		},
        eye: {
            f32: program.createKernel("eye_f32"),
            f64: program.createKernel("eye_f64")
        },
		linspace: {
			f32: program.createKernel("linspace_f32"),
			f64: program.createKernel("linspace_f64")
		},
		repeat: {
			f32: program.createKernel("repeat_f32"),
			f64: program.createKernel("repeat_f64")
		},
		add: {
			f32: program.createKernel("add_f32"),
			f64: program.createKernel("add_f64")
		},
		sub: {
			f32: program.createKernel("sub_f32"),
			f64: program.createKernel("sub_f64")
		},
		mul: {
			f32: program.createKernel("mul_f32"),
			f64: program.createKernel("mul_f64")
		},
		div: {
			f32: program.createKernel("div_f32"),
			f64: program.createKernel("div_f64")
		},
		addc: {
			f32: program.createKernel("addc_f32"),
			f64: program.createKernel("addc_f64")
		},
		subc: {
			f32: program.createKernel("subc_f32"),
			f64: program.createKernel("subc_f64")
		},
		subrc: {
			f32: program.createKernel("subrc_f32"),
			f64: program.createKernel("subrc_f64")
		},
		mulc: {
			f32: program.createKernel("mulc_f32"),
			f64: program.createKernel("mulc_f64")
		},
		divc: {
			f32: program.createKernel("divc_f32"),
			f64: program.createKernel("divc_f64")
		},
		divrc: {
			f32: program.createKernel("divrc_f32"),
			f64: program.createKernel("divrc_f64")
		},
		neg: {
			f32: program.createKernel("neg_f32"),
			f64: program.createKernel("neg_f64")
		},
		abs: {
			f32: program.createKernel("abs_f32"),
			f64: program.createKernel("abs_f64")
		},
		exp: {
			f32: program.createKernel("exp_f32"),
			f64: program.createKernel("exp_f64")
		},
		expm1: {
			f32: program.createKernel("expm1_f32"),
			f64: program.createKernel("expm1_f64")
		},
		exp2: {
			f32: program.createKernel("exp2_f32"),
			f64: program.createKernel("exp2_f64")
		},
		log: {
			f32: program.createKernel("log_f32"),
			f64: program.createKernel("log_f64")
		},
		log10: {
			f32: program.createKernel("log10_f32"),
			f64: program.createKernel("log10_f64")
		},
		log2: {
			f32: program.createKernel("log2_f32"),
			f64: program.createKernel("log2_f64")
		},
		log1p: {
			f32: program.createKernel("log1p_f32"),
			f64: program.createKernel("log1p_f64")
		},
		sqrt: {
			f32: program.createKernel("sqrt_f32"),
			f64: program.createKernel("sqrt_f64")
		},
		square: {
			f32: program.createKernel("square_f32"),
			f64: program.createKernel("square_f64")
		},
		sin: {
			f32: program.createKernel("sin_f32"),
			f64: program.createKernel("sin_f64")
		},
		cos: {
			f32: program.createKernel("cos_f32"),
			f64: program.createKernel("cos_f64")
		},
		tan: {
			f32: program.createKernel("tan_f32"),
			f64: program.createKernel("tan_f64")
		},
		arcsin: {
			f32: program.createKernel("arcsin_f32"),
			f64: program.createKernel("arcsin_f64")
		},
		arccos: {
			f32: program.createKernel("arccos_f32"),
			f64: program.createKernel("arccos_f64")
		},
		arctan: {
			f32: program.createKernel("arctan_f32"),
			f64: program.createKernel("arctan_f64")
		},
		degrees: {
			f32: program.createKernel("degrees_f32"),
			f64: program.createKernel("degrees_f64")
		},
		radians: {
			f32: program.createKernel("radians_f32"),
			f64: program.createKernel("radians_f64")
		},
		rint: {
			f32: program.createKernel("rint_f32"),
			f64: program.createKernel("rint_f64")
		},
		floor: {
			f32: program.createKernel("floor_f32"),
			f64: program.createKernel("floor_f64")
		},
		ceil: {
			f32: program.createKernel("ceil_f32"),
			f64: program.createKernel("ceil_f64")
		},
		trunc: {
			f32: program.createKernel("trunc_f32"),
			f64: program.createKernel("trunc_f64")
		},
		sum: {
			f32: program.createKernel("sum_f32_gpu"),
			f64: program.createKernel("sum_f64_gpu")
		},
		min: {
			f32: program.createKernel("min_f32_gpu"),
			f64: program.createKernel("min_f64_gpu")
		},
		max: {
			f32: program.createKernel("max_f32_gpu"),
			f64: program.createKernel("max_f64_gpu")
		},
		asum: {
			f32: program.createKernel("asum_f32"),
			f64: program.createKernel("asum_f64")
		},
		amin: {
			f32: program.createKernel("amin_f32"),
			f64: program.createKernel("amin_f64")
		},
		amax: {
			f32: program.createKernel("amax_f32"),
			f64: program.createKernel("amax_f64")
		},
		dot: {
			f32: program.createKernel("dot_f32"),
			f64: program.createKernel("dot_f64")
		}
	};
	return kernels;
};

function WebCLMath(cl, deviceInfo, program) {
	this.cl = cl;
	this.deviceInfo = deviceInfo;
	this.kernels = createKernels(program);
}

var dataTypeBufferMap = {
	"f32": Float32Array,
	"f64": Float64Array
};

var createTypedConstant = function(x, dataType) {
	return new dataTypeBufferMap[dataType]([x]);
};

/**
 * Adds two WebCL arrays.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input augend array.
 * @param {WebCLBuffer} b - the input addend array.
 * @param {WebCLBuffer} out - the output sum array.
 * @param {Number} length - the length of the slices to add.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method add
 */
WebCLMath.prototype.add = function(queue, a, b, out, length, dataType) {
	var kernel = this.kernels.add[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, b);
	kernel.setArg(3, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Adds a constant to a WebCL array.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input augend array.
 * @param {Number} b - the addend constant.
 * @param {WebCLBuffer} out - the output sum array.
 * @param {Number} length - the length of the slice to add.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method addConst
 */
WebCLMath.prototype.addConst = function(queue, a, b, out, length, dataType) {
	var kernel = this.kernels.addc[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, createTypedConstant(b, dataType));
	kernel.setArg(3, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Subtracts two WebCL arrays.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input minuend array.
 * @param {WebCLBuffer} b - the input subtrahend array.
 * @param {WebCLBuffer} out - the output difference array.
 * @param {Number} length - the length of the slices to subtract.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method sub
 */
WebCLMath.prototype.sub = function(queue, a, b, out, length, dataType) {
	var kernel = this.kernels.sub[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, b);
	kernel.setArg(3, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Subtracts a constant from a WebCL array.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input minuend array.
 * @param {Number} b - the subtrahend constant.
 * @param {WebCLBuffer} out - the output difference array.
 * @param {Number} length - the length of the slice to subtract from.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method subConst
 */
WebCLMath.prototype.subConst = function(queue, a, b, out, length, dataType) {
	var kernel = this.kernels.subc[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, createTypedConstant(b, dataType));
	kernel.setArg(3, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Subtracts a WebCL array from a constant.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input subtrahend array.
 * @param {Number} b - the minuend constant.
 * @param {WebCLBuffer} out - the output difference array.
 * @param {Number} length - the length of the slice to subtract.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method subRevConst
 */
WebCLMath.prototype.subRevConst = function(queue, a, b, out, length, dataType) {
	var kernel = this.kernels.subrc[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, createTypedConstant(b, dataType));
	kernel.setArg(3, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Multiplies two WebCL arrays.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input multiplicand array.
 * @param {WebCLBuffer} b - the input multiplier array.
 * @param {WebCLBuffer} out - the output product array.
 * @param {Number} length - the length of the slice to multiply.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method mul
 */
WebCLMath.prototype.mul = function(queue, a, b, out, length, dataType) {
	var kernel = this.kernels.mul[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, b);
	kernel.setArg(3, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Multiplies a WebCL array by a constant.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input multiplicand array.
 * @param {Number} b - the multiplier constant.
 * @param {WebCLBuffer} out - the output product array.
 * @param {Number} length - the length of the slice to multiply.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method mulConst
 */
WebCLMath.prototype.mulConst = function(queue, a, b, out, length, dataType) {
	var kernel = this.kernels.mulc[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, createTypedConstant(b, dataType));
	kernel.setArg(3, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Divides two WebCL arrays.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input minuend array.
 * @param {WebCLBuffer} b - the input subtrahend array.
 * @param {WebCLBuffer} out - the output difference array.
 * @param {Number} length - the length of the slices to divide.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method div
 */
WebCLMath.prototype.div = function(queue, a, b, out, length, dataType) {
	var kernel = this.kernels.div[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, b);
	kernel.setArg(3, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Divides a WebCL array by a constant.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input minuend array.
 * @param {Number} b - the subtrahend constant.
 * @param {WebCLBuffer} out - the output difference array.
 * @param {Number} length - the length of the slice to divide.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method divConst
 */
WebCLMath.prototype.divConst = function(queue, a, b, out, length, dataType) {
	var kernel = this.kernels.divc[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, createTypedConstant(b, dataType));
	kernel.setArg(3, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Divides a constant by a WebCL array.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input subtrahend array.
 * @param {Number} b - the minuend constant.
 * @param {WebCLBuffer} out - the output difference array.
 * @param {Number} length - the length of the slice to divide by.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method divRevConst
 */
WebCLMath.prototype.divRevConst = function(queue, a, b, out, length, dataType) {
	var kernel = this.kernels.divrc[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, createTypedConstant(b, dataType));
	kernel.setArg(3, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Negates an WebCL array.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to negate.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method neg
 */
WebCLMath.prototype.neg = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.neg[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes absolute value of a WebCL array.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to compute absolute value on.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method abs
 */
WebCLMath.prototype.abs = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.abs[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Exponentiates WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to exponentiate.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method exp
 */
WebCLMath.prototype.exp = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.exp[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Exponentiates WebCL array elements minus 1.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to exponentiate.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method exp
 */
WebCLMath.prototype.expm1 = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.expm1[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Raises 2 to the power of each WebCL array element.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to exponentiate.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method exp
 */
WebCLMath.prototype.exp2 = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.exp2[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes logarithm of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to compute logarithm on.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method log
 */
WebCLMath.prototype.log = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.log[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes logarithm base 10 of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to compute logarithm on.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method log
 */
WebCLMath.prototype.log10 = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.log10[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes logarithm base 2 of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to compute logarithm on.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method log
 */
WebCLMath.prototype.log2 = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.log2[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes logarithm of WebCL array elements plus 1.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to compute logarithm on.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method log
 */
WebCLMath.prototype.log1p = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.log1p[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes square root of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to compute square root on.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method sqrt
 */
WebCLMath.prototype.sqrt = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.sqrt[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Squares WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.square = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.square[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes sin of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.sin = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.sin[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes cos of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.cos = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.cos[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes tan of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.tan = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.tan[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes arcsin of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.arcsin = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.arcsin[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes arccos of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.arccos = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.arccos[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes arctan of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.arctan = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.arctan[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Converts WebCL array elements to degrees
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.degrees = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.degrees[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Converts WebCL array elements to radians.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.radians = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.radians[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Rounds WebCL array elements to the nearest integer.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.rint = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.rint[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes the floor of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.floor = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.floor[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Computes the ceiling of WebCL array elements.
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.ceil = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.ceil[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

/**
 * Rounds WebCL array elements to the nearest integer towards 0
 *
 * @param {WebCLCommandQueue} queue - the command queue to launch kernels on. Must use the same device as the program passed to the WebCLMath constructor.
 * @param {WebCLBuffer} a - the input array.
 * @param {WebCLBuffer} out - the output array.
 * @param {Number} length - the length of the slice to square.
 * @param {String} dataType - the abbreviated data type to be used for the operation. Must be "f32" or "f64".
 *
 * @private
 * @static
 * @method square
 */
WebCLMath.prototype.trunc = function(queue, a, out, length, dataType) {
	var kernel = this.kernels.trunc[dataType];
	kernel.setArg(0, new Uint32Array([length]));
	kernel.setArg(1, a);
	kernel.setArg(2, out);
	queue.enqueueNDRangeKernel(kernel, 1, null, [length], null);
};

module.exports = WebCLMath;
