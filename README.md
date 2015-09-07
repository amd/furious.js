<p align="center"><img src="https://amd.github.io/furious.js/logo.png" alt="Furious.js" title="Furious.js Logo"/></p>

[![License](http://img.shields.io/badge/license-MIT-brightgreen.png)](http://github.com/hpcgarage/furious.js/blob/master/LICENSE)
[![Build Status](https://travis-ci.org/hpcgarage/furious.js.svg?branch=master)](https://travis-ci.org/hpcgarage/furious.js)

[![Dependency Status](https://david-dm.org/hpcgarage/furious.js.png)](https://david-dm.org/hpcgarage/furious.js)
[![OptionalDependency Status](https://david-dm.org/hpcgarage/furious.js/optional-status.png)](https://david-dm.org/hpcgarage/furious.js#info=optionalDependencies)
[![devDependency Status](https://david-dm.org/hpcgarage/furious.js/dev-status.png)](https://david-dm.org/hpcgarage/furious.js#info=devDependencies)

# Furious.js

Furious.js is a scientific computing package for JavaScript. Furious.js features:

- Provides n-dimensional array (NDArray) class
- Programming interface similar to NumPy
- Works with all modern browsers and Node.js
- Accelerates computation on Portable Native Client (PNaCl) and WebCL
- Computes asynchronously, without stalling the GUI
- Functionality covered with unit tests ([Try it!](https://hpcgarage.github.io/furious.js/unittest.html))
- Comes with extensive documentation

## Backends

Currently Furious.js provides four computational backends:

- JavaScript backend that works in all modern JS engines (Typed Array support required).
- Portable Native Client that works in Google Chrome and other Chromium-based browsers.
- WebCL backend that can be used with Node.js (via [Node-WebCL](https://www.npmjs.org/package/node-webcl)) and [WebKit-WebCL](https://github.com/SRA-SiliconValley/webkit-webcl).
- Web Socket backend that sends compute commands to a cloud server for execution. Furious.js includes implementation of compute server based on [ws](https://www.npmjs.org/package/ws) and [Node-WebCL](https://www.npmjs.org/package/node-webcl).

Normally Furious.js would automatically detect the optimal backend, but it is possible to specify it manually.

## Configuration

Client-side backends require that the server is configured to server files with extensions `.js`, `.nmf` (Native Client Manifest), `.pexe` (Portable Native Client module), and, for debugging only, `.map` (JavaScript source maps).

WebSocket backend needs additional configuration. Furious.js will choose WebSocket backend in two cases:

- It is explicitly specified in the `furious.init` call. Then the caller might specify the URL that will be used for the Web Socket connection in `options.url` argument of `furious.init`. If this option is not specified, Furious.js will try to use the value of `furious-websocket-url` cookie as a connection URL (see below). If this cookie is not set, Furious.js will derive the URL of the Web Socket connection from the URL of its own script by changing protocol schema to `ws` (`wss` if the script was loaded through `https`) and replacing extension with `.ws`. E.g. if the Furious.js script was accessed at `http://example.com/lib/furious.js`, it will derive `ws://example.com/lib/furious.ws` as the Web Socket connection URL.
- If the cookie `furious-websocket-url` is set, Furious.js will choose WebSocket backend by default and use cookie value as the connection URL.

The server administrator must ensure that the computational Web Socket server is available at the URL expected by Furious.js

The Node-WebCL-based implementation of computational server is located in `lib/WebSocketServer.js`. By default, it starts on port `8081` and accepts all incoming connections regardless of host name and URL.

#### Example: Nginx configuration to serve both Web site and Web Socket requests on the port 80:

```
# Bypass only Web Socket connections (with HTTP Upgrade header) to the computational server
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# Parameters of the computational server
upstream websocket {
    # The WS server by default uses port 8081
    server localhost:8081;
}

server {
    listen 80;
    location / {
        # Assume that the static content of the Web site is located at /home/www
        root /home/www;
        # Set the furious-websocket-url cookie with the URL for the WS connection
        add_header Set-Cookie furious-websocket-url=ws://$host/furious.ws;
    }
    # WS connections to $host/furious.ws will be redirected to the computational server
    location /furious.ws {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}
```

## Development

### System pre-requisites

- Windows, Linux, or OS X operating systems.
- Python `2.x` (we recommend to use the latest `2.7` release).
- [Ninja](https://martine.github.io/ninja/) build system. Add the directory with `ninja` (or `ninja.exe`) executable to the `PATH` environment variable. Add the `misc` directory with [`ninja_syntax.py`](https://github.com/martine/ninja/blob/master/misc/ninja_syntax.py) to the `PYTHONPATH` environment variable.
- [Protocol Buffers C](https://github.com/protobuf-c/protobuf-c) compiler. Add the directory with `protoc-c` executable to the `PATH` environment variable.
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
git clone https://github.com/mikeseven/node-glfw.git
cd node-glfw
npm link
```
- Clone and build `node-image` repository
```bash
git clone https://github.com/mikeseven/node-image.git
cd node-image
npm link
```
- Clone `node-webgl` repository, link its `node-glfw` dependency, and build
```bash
git clone https://github.com/mikeseven/node-glfw.git
cd node-webgl
npm link node-glfw
npm link
```

- Clone the `node-webcl` repository, link its `node-image` and `node-webgl` dependencies, and build
```bash
git clone https://github.com/Motorola-Mobility/node-webcl.git
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

Follow the [official instructions](https://code.google.com/p/naclports/wiki/HowTo_Checkout) to get a copy of `naclports` repository. Next, navigate to `src` directory and install `protobuf-c` library for your PNaCl toolchain:
```bash
NACL_ARCH=pnacl make protobuf-c
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

