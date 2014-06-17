"use strict";

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

		jshint: {
			options: {
				jshintrc: true
			},
			furious: ["lib/*.js"],
			test: ["test/*.test.js"],
			build: ["Gruntfile.js"]
		},

		browserify: {
			furious: {
				options: {
					bundleOptions : {
						debug: false,
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

		uglify: {
			dist: {
				files: {
					"furious.min.js": ["furious.js"]
				}
			}
		},

		yuidoc: {
			furious: {
				name: "<%= pkg.name %>",
				description: "<%= pkg.description %>",
				version: "<%= pkg.version %>",
				options: {
					paths: "lib",
					outdir: "doc",
					themedir: "./node_modules/yuidoc-bootstrap-theme",
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
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-contrib-yuidoc");
	grunt.loadNpmTasks("grunt-contrib-jshint");
	grunt.loadNpmTasks("grunt-shell");

	grunt.registerTask("default", ["mochaTest", "jshint", "browserify", "uglify", "yuidoc", "shell:configure", "shell:buildPNaCl"]);
	grunt.registerTask("test", ["mochaTest"]);
};
