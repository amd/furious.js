#!/usr/bin/python

from __future__ import print_function
import optparse
import os
import sys
import glob
import ninja_syntax

def replace_ext(filename, ext):
    return os.path.splitext(filename)[0] + ext

if __name__ == '__main__':
    parser = optparse.OptionParser()
    parser.add_option("--with-protoc", dest="protoc", default="protoc")
    parser.add_option("--with-nacl-sdk", dest="nacl_sdk", default=os.getenv("NACL_SDK_ROOT"))
    options, _ = parser.parse_args()

    root_dir = os.path.dirname(os.path.abspath(__file__))

    with open('build.ninja', 'w') as buildfile:
        ninja = ninja_syntax.Writer(buildfile)

        # Variables
        ninja.variable('nacl_sdk_dir', options.nacl_sdk)
        if sys.platform == 'win32':
            ninja.variable('pnacl_toolchain_dir', '$nacl_sdk_dir/toolchain/win_pnacl')
            ninja.variable('pnacl_cc', '$pnacl_toolchain_dir/bin/pnacl-clang.bat')
            ninja.variable('pnacl_cxx', '$pnacl_toolchain_dir/bin/pnacl-clang++.bat')
            ninja.variable('pnacl_finalize', '$pnacl_toolchain_dir/bin/pnacl-finalize.bat')
        elif sys.platform == 'linux2':
            ninja.variable('pnacl_toolchain_dir', '$nacl_sdk_dir/toolchain/linux_pnacl')
            ninja.variable('pnacl_cc', '$pnacl_toolchain_dir/bin/pnacl-clang')
            ninja.variable('pnacl_cxx', '$pnacl_toolchain_dir/bin/pnacl-clang++')
            ninja.variable('pnacl_finalize', '$pnacl_toolchain_dir/bin/pnacl-finalize')
        elif sys.platform == 'darwin':
            ninja.variable('pnacl_toolchain_dir', '$nacl_sdk_dir/toolchain/mac_pnacl')
            ninja.variable('pnacl_cc', '$pnacl_toolchain_dir/bin/pnacl-clang')
            ninja.variable('pnacl_cxx', '$pnacl_toolchain_dir/bin/pnacl-clang++')
            ninja.variable('pnacl_finalize', '$pnacl_toolchain_dir/bin/pnacl-finalize')
        else:
            print("Unsupported platform: " + sys.platform, file=sys.stderr)
            exit(1)
        ninja.variable('protoc', options.protoc)

        # Rules
        ninja.rule('COMPILE_PNACL_C', '$pnacl_cc -o $out -c $in -MMD -MF $out.d $optflags $cflags',
            deps='gcc', depfile='$out.d',
            description='CC[PNaCl] $in')
        ninja.rule('COMPILE_PNACL_CXX', '$pnacl_cxx -o $out -c $in -MMD -MF $out.d $optflags $cxxflags',
            deps='gcc', depfile='$out.d',
            description='CXX[PNaCl] $in')
        ninja.rule('LINK_PNACL_C', '$pnacl_cc -o $out $in $ldflags',
            description='CCLD[PNaCl] $out')
        ninja.rule('LINK_PNACL_CXX', '$pnacl_cxx -o $out $in $ldflags',
            description='CXXLD[PNaCl] $out')
        ninja.rule('FINALIZE_PNACL', '$pnacl_finalize -o $out $in',
            description='FINALIZE[PNaCl] $out')
        ninja.rule('PROTOC_CXX', '$protoc --proto_path=$indir --cpp_out=$outdir $in',
            description='PROTOC[CXX] $in')

        # Build targets
        proto_dir = os.path.join(root_dir, "protobuf")
        proto_sources = [os.path.join(proto_dir, path) for path in glob.glob(os.path.join(proto_dir, "*.proto"))]
        c_source_dir = os.path.join(root_dir, "lib", "nacl")
        c_build_dir = os.path.join(root_dir, "build", "nacl")
        c_sources = [os.path.join(root_dir, path) for path in glob.glob(os.path.join(c_source_dir, "*.c"))]
        c_objects = [os.path.join(c_build_dir, replace_ext(os.path.relpath(path, c_source_dir), ".bc")) for path in c_sources]
        cxx_sources = [os.path.join(root_dir, path) for path in glob.glob(os.path.join(c_source_dir, "*.cc"))]
        cxx_objects = [os.path.join(c_build_dir, replace_ext(os.path.relpath(path, c_source_dir), ".bc")) for path in cxx_sources]
        cxx_proto_sources = [os.path.join(c_source_dir, replace_ext(os.path.relpath(path, proto_dir), ".pb.cc")) for path in proto_sources]
        cxx_proto_headers = [os.path.join(c_source_dir, replace_ext(os.path.relpath(path, proto_dir), ".pb.h")) for path in proto_sources]
        cxx_proto_objects = [os.path.join(c_build_dir, replace_ext(os.path.relpath(path, c_source_dir), ".bc")) for path in cxx_proto_sources]
        for proto_source, cxx_source, cxx_header, cxx_object in zip(proto_sources, cxx_proto_sources, cxx_proto_headers, cxx_proto_objects):
            ninja.build([cxx_source, cxx_header], "PROTOC_CXX", proto_source,
                variables={'indir': proto_dir, 'outdir': c_source_dir})
            if cxx_source not in cxx_sources:
                cxx_sources.append(cxx_source)
                cxx_objects.append(cxx_object)
        for source, object in zip(c_sources, c_objects):
            ninja.build(object, 'COMPILE_PNACL_C', source,
                variables={'optflags': '-O3',
                    'cflags': '-I$nacl_sdk_dir/include -pthread -g -std=gnu99 -Wno-long-long -Wall -Werror -Wno-unused-variable -Wno-error=unused-function'})
        for source, object in zip(cxx_sources, cxx_objects):
            ninja.build(object, 'COMPILE_PNACL_CXX', source,
                variables={'optflags': '-O3',
                    'cxxflags': '-I$nacl_sdk_dir/include -pthread -g -std=gnu++11 -fno-exceptions -Wno-long-long -Wall -Werror -Wno-unused-variable -Wno-error=unused-function'})
        ninja.build(os.path.join(root_dir, 'furious.bc'), 'LINK_PNACL_CXX', c_objects + cxx_objects,
            variables={'ldflags': '-L$nacl_sdk_dir/lib/pnacl/Release -lppapi -lm -lprotobuf-lite'})
        ninja.build(os.path.join(root_dir, 'furious.pexe'), 'FINALIZE_PNACL', os.path.join(root_dir, 'furious.bc'))
