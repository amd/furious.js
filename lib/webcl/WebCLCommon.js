"use strict";

var NDArray = require("../NDArray");
var DataType = require("../DataType");
var util = require("../util");
var fs = require("fs");

var cl = void 0;
exports.cl = cl;
var availableDevices = null;
var availableDevicesDescriptions = null;
exports.availableDevicesDescriptions = availableDevicesDescriptions;
var defaultDeviceIndex = -1;
var isNodeWebCL = false;

/**
 * If the global cl variable is undefined, this method would initialize it with a WebCL instance.
 * Works for both browser and Node.js
 *
 * @private
 * @static
 * @method initWebCL
 * @return {WebCL} - an instance of WebCL object from WebCL specification. If WebCL is not supported, return null.
 */
var initWebCL = function() {
    cl = require("node-webcl");
//    if (typeof cl === "undefined") {
//        if (typeof window === "object") {
//            cl = (typeof window.webcl !== "undefined") ? window.webcl : null;
//        } else {
//            try {
//                cl = require("node-webcl");
//                isNodeWebCL = true;
//            } catch (e) {
//                cl = null;
//            }
//        }
//    }
    return cl;
};

/**
 * Creates an empty WebCLEvent.
 * Works for both browser and Node.js
 *
 * @private
 * @static
 * @method createEvent
 * @return {WebCLEvent} - an empty instance of WebCLEvent.
 */
var createEvent = function() {
    if (isNodeWebCL) {
        return new cl.WebCLEvent();
    } else {
        return new WebCLEvent();
    }
};

/**
 * Tries to release a WebCL resource and ignores any errors in the process.
 *
 * @private
 * @method tryRlease
 * @param {Object} webclObject - a WebCL object.
 * @return {Boolean} - true if the object was successfully released and false otherwise.
 */
var tryRelease = function(webclResource) {
    if (webclResource !== null) {
        try {
            webclResource.release();
            return true;
        } catch (e) {
            /* Silently ignore */
        }
    }
    return false;
};

/**
 * Checks if a WebCL device supports KHR_fp64 extension.
 *
 * @private
 * @method isFP64Capable
 * @param {WebCLDevice} device - the device to check for KHR_fp64 support.
 * @return {Boolean} - true if the device supports KHR_fp64 and false otherwise.
 */
var isFP64Capable = function(device) {
    var extensions = device.getSupportedExtensions();
    if (extensions.indexOf("KHR_fp64") === -1) {
        return false;
    }
    /*
     * Due to a bug WebKit-WebCL may report KHR_fp64 even if it is not supported by the underlying OpenCL device.
     * See bug https://github.com/SRA-SiliconValley/webkit-webcl/issues/536
     */
    var testSource = "kernel void foo(global double* bar) { }";
    var context = null, program = null;
    try {
        context = cl.createContext(device);
        program = context.createProgram(testSource);
        program.build();
        return true;
    } catch (e) {
        return false;
    } finally {
        tryRelease(program);
        tryRelease(context);
    }
};

/**
 * Initialises and returns a list of WebCL devices suitable for computation.
 *
 * @private
 * @static
 * @method getAvailableDevices
 * @return {WebCLDevice[]} - a list of GPU and CPU WebCL devices that support KHR_FP64 (may be empty).
 */
var getAvailableDevices = function() {
    if (availableDevices === null) {
        availableDevices = [];
        var webcl = initWebCL();
        if (webcl !== null) {
            var platforms = cl.getPlatforms();
            for (var i = 0; i < platforms.length; ++i) {
                var platform = platforms[i];
                var devices = platform.getDevices(cl.DEVICE_TYPE_ALL);
                for (var j = 0; j < devices.length; ++j) {
                    var device = devices[j];
                    if (isFP64Capable(device)) {
                        availableDevices.push(device);
                    }
                }
            }
        }
        generateAvailableDevicesDescriptions();
    }
    exports.availableDevices = availableDevices;
    return availableDevices;
};

var generateAvailableDevicesDescriptions = function() {
    availableDevicesDescriptions = [];
    /* If devices names are available, use them */
    var haveNames = true;
    for (var i = 0; i < availableDevices.length; ++i) {
        var device = availableDevices[i];
        var name = device.getInfo(cl.DEVICE_NAME);
        if ((name === null) || (name === "")) {
            haveNames = false;
            break;
        }
        availableDevicesDescriptions[i] = name;
    }
    if (!haveNames) {
        /* At least some names are not available: try to assign names based on classification (e.g. "CPU", "dGPU", "iGPU") */
        var cpuCount = 0, igpuCount = 0, dgpuCount = 0;
        for (var i = 0; i < availableDevices.length; ++i) {
            var device = availableDevices[i];
            var classification = classifyDevice(device);
            if (classification === "cpu") {
                ++cpuCount;
                availableDevicesDescriptions[i] = "CPU";
            } else if (classification === "igpu") {
                ++igpuCount;
                availableDevicesDescriptions[i] = "iGPU";
            } else if (classification === "dgpu") {
                ++dgpuCount;
                availableDevicesDescriptions[i] = "dGPU";
            } else {
                throw new Error("Impossible device classification: " + classification);
            }
        }
        if ((cpuCount > 1) || (igpuCount > 1) || (dgpuCount > 1)) {
            /* We have multiple devices of the same type. Need to use more complicated naming scheme */
            var cpuIndex = 0, igpuIndex = 0, dgpuIndex = 0;
            for (var i = 0; i < availableDevices.length; ++i) {
                var device = availableDevices[i];
                var classification = classifyDevice(device);
                if (classification === "cpu") {
                    if (cpuCount > 1) {
                        ++cpuIndex;
                        availableDevicesDescriptions[i] = "CPU #" + cpuIndex;
                    }
                } else if (classification === "igpu") {
                    if (igpuCount > 1) {
                        ++igpuIndex;
                        availableDevicesDescriptions[i] = "iGPU #" + igpuIndex;
                    }
                } else if (classification === "dgpu") {
                    if (dgpuCount > 1) {
                        ++dgpuCount;
                        availableDevicesDescriptions[i] = "dGPU #" + dgpuIndex;
                    }
                } else {
                    throw new Error("Impossible device classification: " + classification);
                }
            }
        }
    }
    exports.availableDevicesDescriptions = availableDevicesDescriptions;
};

/**
 * Classifies WebCL device to one of four categories:
 * - "cpu" for CPU devices.
 * - "igpu" for GPUs integrated with CPU package or chipset.
 * - "dgpu" for discrete GPUs.
 * - "unknown" for other types of devices (e.g. FPGAs)
 *
 * @private
 * @method classifyDevice
 * @param {WebCLDevice} device - the WebCL device to classify.
 * @return {String} - one of the strings described above.
 */
var classifyDevice = function(device) {
    try {
        var deviceType = device.getInfo(cl.DEVICE_TYPE);
        if (deviceType === cl.DEVICE_TYPE_CPU) {
            return "cpu";
        } else if (deviceType === cl.DEVICE_TYPE_GPU) {
            var isHostUnifiedMemory = device.getInfo(cl.DEVICE_HOST_UNIFIED_MEMORY);
            return (isHostUnifiedMemory ? "igpu" : "dgpu");
        }
    } catch (e) {
    }
    return "unknown";
};

/**
 * Selects the optimal WebCL device among the available devices.
 * The priority of devices: "dgpu" > "igpu" > "cpu"
 *
 * @private
 * @method getDefaultDeviceIndex
 * @return {WebCLDevice} - the selected device from the list.
 */
var getDefaultDeviceIndex = function() {
    if (defaultDeviceIndex === -1) {
        var availableDevices = getAvailableDevices();
        if (availableDevices.length === 0) {
            defaultDeviceIndex = -2;
            return defaultDeviceIndex;
        }
        var deviceClassifications = [];
        /* Search for "dgpu" */
        for (var i = 0; i < availableDevices.length; ++i) {
            var device = availableDevices[i];
            var deviceClass = classifyDevice(device);
            if (deviceClass === "dgpu") {
                defaultDeviceIndex = i;
                return i;
            }
            deviceClassifications.push(deviceClass);
        }
        /* Search for "igpu" */
        for (var i = 0; i < availableDevices.length; ++i) {
            if (deviceClassifications[i] === "igpu") {
                defaultDeviceIndex = i;
                return i;
            }
        }
        /* Search for "cpu" */
        for (var i = 0; i < availableDevices.length; ++i) {
            if (deviceClassifications[i] === "cpu") {
                defaultDeviceIndex = i;
                return i;
            }
        }
    }
    return defaultDeviceIndex;
};

var createKernels = function(program) {
    var kernels = {
        set: {
            f32: program.createKernel("set_f32"),
            f64: program.createKernel("set_f64")
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
        log: {
            f32: program.createKernel("log_f32"),
            f64: program.createKernel("log_f64")
        },
        sqrt: {
            f32: program.createKernel("sqrt_f32"),
            f64: program.createKernel("sqrt_f64")
        },
        square: {
            f32: program.createKernel("square_f32"),
            f64: program.createKernel("square_f64")
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

exports.createEvent = createEvent;
exports.tryRelease = tryRelease;
exports.isFP64Capable = isFP64Capable;
exports.getAvailableDevices = getAvailableDevices;
exports.generateAvailableDevicesDescriptions = generateAvailableDevicesDescriptions;
exports.classifyDevice = classifyDevice;
exports.getDefaultDeviceIndex = getDefaultDeviceIndex;
exports.createKernels = createKernels;
exports.initWebCL = initWebCL;