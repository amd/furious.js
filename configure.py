import optparse
import os
import glob
import ninja_syntax

if __name__ == '__main__':
    parser = optparse.OptionParser()
    parser.add_option("--with-jsdoc", dest="jsdoc_compiler", default=os.getenv("JSDOC_COMPILER"))
    parser.add_option("--with-nacl-sdk", dest="nacl_sdk", default=os.getenv("NACL_SDK_ROOT"))
    parser.add_option("--pepper-api", dest="pepper_api", default="canary")
    options, _ = parser.parse_args()

    root_dir = os.path.dirname(os.path.abspath(__file__))

    with open('build.ninja', 'w') as buildfile:
        ninja = ninja_syntax.Writer(buildfile)

        # Variables
        if options.jsdoc_compiler:
            ninja.variable('jsdoc_compiler', options.jsdoc_compiler)
        if options.nacl_sdk:
            ninja.variable('nacl_sdk_dir', os.path.join(options.nacl_sdk, 'pepper_' + options.pepper_api))
            ninja.variable('pnacl_toolchain_dir', '$nacl_sdk_dir/toolchain/win_pnacl')
            ninja.variable('pnacl_cc', '$pnacl_toolchain_dir/bin/pnacl-clang.bat')
            ninja.variable('pnacl_cxx', '$pnacl_toolchain_dir/bin/pnacl-clang++.bat')
            ninja.variable('pnacl_finalize', '$pnacl_toolchain_dir/bin/pnacl-finalize.bat')

        # Rules
        ninja.rule('BROWSERIFY', 'cmd /K "browserify $in --outfile $min -p [minifyify --map $map --output $map]"',
            description='BROWSERIFY $out')
        ninja.rule('BROWSERIFY_STANDALONE', 'cmd /K "browserify --standalone $module --entry $entry --outfile $min --plugin [minifyify --map $map --output $map]"',
            description='BROWSERIFY MODULE $module')
        if options.jsdoc_compiler:
            ninja.rule('COMPILE_JSDOC', '$jsdoc_compiler $in -d $output_directory',
                description='JSDOC $in')
        if options.nacl_sdk:
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
        js_source_dir = os.path.join(root_dir, 'lib')
        js_sources = [os.path.join(root_dir, path) for path in glob.glob(os.path.join(js_source_dir, "*.js"))]
        js_source_min = os.path.join(root_dir, 'numjs.min.js')
        js_source_map = os.path.join(root_dir, 'numjs.map')
        ninja.build([js_source_min, js_source_map], 'BROWSERIFY_STANDALONE', js_sources,
            variables={'module': 'numjs', 'entry': 'lib/numjs.js', 'min': js_source_min, 'map': js_source_map})
        js_test_source_dir = os.path.join(root_dir, 'test')
        js_test_sources = [os.path.join(root_dir, path) for path in glob.glob(os.path.join(js_test_source_dir, "*.test.js"))]
        js_test_source_min = os.path.join(root_dir, 'test.min.js')
        js_test_source_map = os.path.join(root_dir, 'test.map')
        ninja.build([js_test_source_min, js_test_source_map], 'BROWSERIFY', js_test_sources,
            variables={'min': js_test_source_min, 'map': js_test_source_map})
        if options.jsdoc_compiler:
            ninja.build(os.path.join(root_dir, 'doc', 'index.html'), 'COMPILE_JSDOC', js_sources,
                variables={'output_directory': 'doc'})
        

        if options.nacl_sdk:
            c_source_dir = os.path.join(root_dir, "lib", "nacl")
            c_build_dir = os.path.join(root_dir, "build", "nacl")
            c_sources = [os.path.join(root_dir, path) for path in glob.glob(os.path.join(c_source_dir, "*.c"))]
            c_objects = [os.path.join(c_build_dir, os.path.splitext(os.path.relpath(path, c_source_dir))[0]) + ".bc" for path in c_sources]
            for source, object in zip(c_sources, c_objects):
                ninja.build(object, 'COMPILE_PNACL_C', source,
                    variables={'optflags': '-O3',
                        'cflags': '-I$nacl_sdk_dir/include -pthread -g -std=gnu99 -Wno-long-long -Wall -Wswitch-enum -Werror -Wno-unused-variable'})
            ninja.build(os.path.join(c_build_dir, 'numjs.unstable.pexe'), 'LINK_PNACL_C', c_objects,
                variables={'ldflags': '-L$nacl_sdk_dir/lib/pnacl/Release -lppapi -lm'})
            ninja.build(os.path.join(root_dir, 'numjs.pexe'), 'FINALIZE_PNACL', os.path.join(c_build_dir, 'numjs.unstable.pexe'))
