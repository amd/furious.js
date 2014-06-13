module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),

		mochaTest: {
			test: {
				options: {
					reporter: "min"
				},
				src: ["test/*.test.js"]
			}
		},

		browserify: {
			furious: {
				options: {
					bundleOptions : {
						debug: true,
						standalone: "furious"
					}
				},
				files: {
					"furious.js": ["lib/furious.js"]
				}
			},
			test: {
				options: {
					bundleOptions : {
						debug: true
					}
				},
				files: {
					"test.js": ["test/*.test.js"]
				}
			}
		},

		minifyify: {
			furious: {
				src: "furious.js",
				dest: {
					buildFile: "furious.min.js",
					mapFile: "furious.min.map"
				}
			}
		},

		yuidoc: {
			furious: {
				name: '<%= pkg.name %>',
				description: '<%= pkg.description %>',
				version: '<%= pkg.version %>',
				options: {
					paths: 'lib',
					outdir: 'doc',
					themedir: './node_modules/yuidoc-bootstrap-theme',
					helpers: ["./node_modules/yuidoc-bootstrap-theme/helpers/helpers.js"]
				}
			}
		},

		shell: {
			configure: {
				command: "python configure.py"
			},
			buildPNaCl: {
				command: "ninja"
			}
		}
	});

	grunt.loadNpmTasks("grunt-mocha-test");
	grunt.loadNpmTasks("grunt-browserify");
	grunt.loadNpmTasks("grunt-minifyify");
	grunt.loadNpmTasks('grunt-contrib-yuidoc');
	grunt.loadNpmTasks('grunt-shell');

	grunt.registerTask("default", ["mochaTest", "browserify", "minifyify", "yuidoc", "shell:configure", "shell:buildPNaCl"]);
	grunt.registerTask("test", ["mochaTest"]);
};
