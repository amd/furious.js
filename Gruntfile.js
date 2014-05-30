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
		},

		yuidoc: {
			numjs: {
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
	});

	grunt.loadNpmTasks("grunt-mocha-test");
	grunt.loadNpmTasks("grunt-browserify");
	grunt.loadNpmTasks("grunt-minifyify");
	grunt.loadNpmTasks('grunt-contrib-yuidoc');

	grunt.registerTask("default", ["mochaTest", "browserify", "minifyify", "yuidoc"]);
	grunt.registerTask("test", ["mochaTest"]);
};
