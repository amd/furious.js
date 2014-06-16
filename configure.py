#!/usr/bin/python

import optparse
import os
import glob
import ninja_syntax

if __name__ == '__main__':
    parser = optparse.OptionParser()
    parser.add_option("--with-nacl-sdk", dest="nacl_sdk", default=os.getenv("NACL_SDK_ROOT"))
    options, _ = parser.parse_args()

    root_dir = os.path.dirname(os.path.abspath(__file__))

    with open('build.ninja', 'w') as buildfile:
        ninja = ninja_syntax.Writer(buildfile)

        # Variables
        ninja.variable('nacl_sdk_dir', os.path.join(options.nacl_sdk))
        if os.name == 'nt':
            ninja.variable('pnacl_toolchain_dir', '$nacl_sdk_dir/toolchain/win_pnacl')
            ninja.variable('pnacl_cc', '$pnacl_toolchain_dir/bin/pnacl-clang.bat')
            ninja.variable('pnacl_cxx', '$pnacl_toolchain_dir/bin/pnacl-clang++.bat')
            ninja.variable('pnacl_finalize', '$pnacl_toolchain_dir/bin/pnacl-finalize.bat')
        else:
            ninja.variable('pnacl_toolchain_dir', '$nacl_sdk_dir/toolchain/linux_pnacl')
            ninja.variable('pnacl_cc', '$pnacl_toolchain_dir/bin/pnacl-clang')
            ninja.variable('pnacl_cxx', '$pnacl_toolchain_dir/bin/pnacl-clang++')
            ninja.variable('pnacl_finalize', '$pnacl_toolchain_dir/bin/pnacl-finalize')

        # Rules
        ninja.rule('COMPILE_PNACL_C', '$pnacl_cc -o $out -c $in -MMD -MF $out.d $optflags $cflags',
            deps='gcc', depfile='$out.d',
            description='CC[PNaCl] $in')
        ninja.rule('COMPILE_PNACL_CXX', '$pnacl_cxx -o $out -c $in -MMD -MF $optflags $cxxflags',
            deps='gcc', depfile='$out.d',
            description='CXX[PNaCl] $in')
        ninja.rule('LINK_PNACL_C', '$pnacl_cc -o $out $in $ldflags',
            description='CCLD[PNaCl] $out')
        ninja.rule('FINALIZE_PNACL', '$pnacl_finalize -o $out $in',
            description='FINALIZE[PNaCl] $out')

        # Build targets
        c_source_dir = os.path.join(root_dir, "lib", "nacl")
        c_build_dir = os.path.join(root_dir, "build", "nacl")
        c_sources = [os.path.join(root_dir, path) for path in glob.glob(os.path.join(c_source_dir, "*.c"))]
        c_objects = [os.path.join(c_build_dir, os.path.splitext(os.path.relpath(path, c_source_dir))[0]) + ".bc" for path in c_sources]
        for source, object in zip(c_sources, c_objects):
            ninja.build(object, 'COMPILE_PNACL_C', source,
                variables={'optflags': '-O3',
                    'cflags': '-I$nacl_sdk_dir/include -pthread -g -std=gnu99 -Wno-long-long -Wall -Werror -Wno-unused-variable -Wno-error=unused-function'})
        ninja.build(os.path.join(c_build_dir, 'furious.unstable.pexe'), 'LINK_PNACL_C', c_objects,
            variables={'ldflags': '-L$nacl_sdk_dir/lib/pnacl/Release -lppapi -lm'})
        ninja.build(os.path.join(root_dir, 'furious.pexe'), 'FINALIZE_PNACL', os.path.join(c_build_dir, 'furious.unstable.pexe'))
