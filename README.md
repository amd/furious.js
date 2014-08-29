[![License](http://img.shields.io/badge/license-MIT-brightgreen.png)](http://github.com/amd/furious.js/blob/master/LICENSE)
[![Build Status](https://travis-ci.org/amd/furious.js.svg?branch=master)](https://travis-ci.org/amd/furious.js)

[![Dependency Status](https://david-dm.org/amd/furious.js.png)](https://david-dm.org/amd/furious.js)
[![OptionalDependency Status](https://david-dm.org/amd/furious.js/optional-status.png)](https://david-dm.org/amd/furious.js#info=optionalDependencies)
[![devDependency Status](https://david-dm.org/amd/furious.js/dev-status.png)](https://david-dm.org/amd/furious.js#info=devDependencies)

[![Browser Support](https://ci.testling.com/amd/furious.js.png)](https://ci.testling.com/amd/furious.js)

# Furious.js

Furious.js is a scientific computing package for JavaScript. Furious.js features:

- Provides n-dimensional array (NDArray) class
- Programming interface similar to NumPy
- Works with all modern browsers and Node.js
- Accelerates computation on Portable Native Client (PNaCl) and WebCL
- Computes asynchronously, without stalling the GUI
- Functionality covered with unit tests ([Try it!](https://amd.github.io/furious.js/unittest.html))
- Comes with extensive documentation

## Backends

Currently Furious.js provides three computational backends:

- JavaScript backend that works in all modern JS engines (Typed Array support required).
- Portable Native Client that works in Google Chrome and other Chromium-based browsers.
- WebCL backend that can be used with Node.js (via [node-webcl](https://www.npmjs.org/package/node-webcl)) and [WebKit-WebCL](https://github.com/SRA-SiliconValley/webkit-webcl).

Normally Furious.js would automatically detect the optimal backend, but it is possible to specify it manually.

## Development

### System pre-requisites

- Windows, Linux, or OS X operating systems.
- Python `2.x` (we recommend to use the latest `2.7` release).
- [Ninja](https://martine.github.io/ninja/) build system. Add the directory with `ninja` (or `ninja.exe`) executable to the `PATH` environment variable. Add the `misc` directory with [`ninja_syntax.py`](https://github.com/martine/ninja/blob/master/misc/ninja_syntax.py) to the `PYTHONPATH` environment variable.
- [Protocol Buffers](https://code.google.com/p/protobuf/) compiler. Add the directory with `protoc` executable to the `PATH` environment variable.
- [Native Client SDK](https://developer.chrome.com/native-client/sdk/download). Use the `naclsdk`/`naclsdk.bat` script to install one of the Pepper toolchains. For development, we recommend to use `pepper_canary` toolchain. For deployment, the current stable toolchain is recommended. Make an environment variable `NACL_SDK_ROOT` point to the toolchain directory (e.g. `C:/naclsdk/pepper_canary` if you use `pepper_canary` toolchain and the Native Client SDK is unpacked to `C:/naclsdk`)
- [Node.js](http://nodejs.org/) and Node Package Manager (`npm`).

#### Node-WebCL prerequisited (optional)

- OpenCL SDK from Intel, AMD, or nVidia (except on Mac)
- GLEW library (except on Windows)
- GLFW 3 library (except on Windows)
- FreeImage library (except on Windows)
- AntTweakBar library (except on Windows)

### Cloning the repository
If you intend to develop Furious.js, we recommend that you fork the repository. Then clone your fork with
```bash
git clone https://github.com/<GITHUB-USERNAME>/furious.js.git
```

### Installing Node.js modules
If you do not intend to use Node-WebCL, navigate to Furious.js directory and execute
```bash
npm install --no-optional
npm install -g grunt-cli
```

If you plan to use Node-WebCL, you'll need to install the upstream version of Node-WebCL, and its dependencies.

- Clone and build `node-glfw` repository
```bash
git clone https://github.com/Maratyszcza/node-glfw.git
cd node-glfw
npm link
```
- Clone and build `node-image` repository
```bash
git clone https://github.com/Maratyszcza/node-image.git
cd node-image
npm link
```
- Clone `node-webgl` repository, link its `node-glfw` dependency, and build
```bash
git clone https://github.com/Maratyszcza/node-webgl.git
cd node-webgl
npm link node-glfw
npm link
```

- Clone the `node-webcl` repository, link its `node-image` and `node-webgl` dependencies, and build
```bash
git clone https://github.com/Maratyszcza/node-webcl.git
cd node-webcl
npm link node-webgl
npm link node-image
npm link
```

- Navigate to Furious.js directory, link `node-webcl` dependency, and install other dependencies
```bash
npm link node-webcl
npm install
npm install -g grunt-cli
```

### Installing Native Client libraries

Follow the [official instructions](https://code.google.com/p/naclports/wiki/HowTo_Checkout) to get a copy of `naclports` repository. Next, navigate to `src` directory and install `protobuf` library for your PNaCl toolchain:
```bash
NACL_ARCH=pnacl make protobuf
```

### Building everything
```bash
grunt
```

### Building the PNaCl backend only

```bash
python configure.py
ninja
```

