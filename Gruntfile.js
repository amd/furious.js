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
			options: {
				bundleOptions : {
					debug: true,
					standalone: "numjs"
				}
			},
			numjs: {
				files: {
					"numjs.js": ["lib/numjs.js"]
				}
			}
		},

		minifyify: {
			numjs: {
				src: "numjs.js",
				dest: {
					buildFile: "numjs.min.js",
					mapFile: "numjs.min.map"
				}
			}
		}
	});

	grunt.loadNpmTasks("grunt-mocha-test");
	grunt.loadNpmTasks("grunt-browserify");
	grunt.loadNpmTasks("grunt-minifyify");

	grunt.registerTask("default", ["mochaTest", "browserify", "minifyify"]);
	grunt.registerTask("test", ["mochaTest"]);
};
