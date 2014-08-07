var furious = require("../lib/furious.js");
var expect = require("chai").expect;

var context = null;
before(function(done) {
	this.timeout(10000);
	furious.init(function(ctx) {
		context = ctx;
		done();
	});
});

describe("Context", function(){
	describe("barrier", function() {
		it("Calls the callback", function(done) {
			context.barrier(function () {
				done();
			});
		});
		it("Executes after preceeding commands have finished", function(done) {
			var x = context.zeros([3, 3]);
			var getHasFinished = false;
			x.get(function(data) {
				getHasFinished = true;
			});
			context.barrier(function (){
				expect(getHasFinished).to.be.true;
				done();
			});
		});
		it("Executes before subsequent commands have started", function(done) {
			var x = context.zeros([3, 3]);
			var barrierHasFinished = false;
			context.barrier(function (){
				barrierHasFinished = true;
			});
			x.get(function(x) {
				expect(barrierHasFinished).to.be.true;
				done();
			});
		});
	});
	describe("empty", function(){
		it("Creates array with specified shape", function() {
			var x = context.empty(42);
			var y = context.empty([42]);
			var z = context.empty([4, 2]);
			expect(x.shape).to.deep.equal([42]);
			expect(y.shape).to.deep.equal([42]);
			expect(z.shape).to.deep.equal([4, 2]);
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with specified data type (f64 by default)", function() {
			var x = context.empty([4, 2]);
			var y = context.empty([4, 2], new furious.DataType("f64"));
			var z = context.empty([4, 2], new furious.DataType("f32"));
			expect(x.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(y.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(z.dataType.equals(new furious.DataType("f32"))).to.be.true;
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
	});
	describe("zeros", function(){
		it("Creates array with specified shape", function() {
			var x = context.zeros(42);
			var y = context.zeros([42]);
			var z = context.zeros([4, 2]);
			expect(x.shape).to.deep.equal([42]);
			expect(y.shape).to.deep.equal([42]);
			expect(z.shape).to.deep.equal([4, 2]);
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with specified data type (f64 by default)", function() {
			var x = context.zeros([4, 2]);
			var y = context.zeros([4, 2], new furious.DataType("f64"));
			var z = context.zeros([4, 2], new furious.DataType("f32"));
			expect(x.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(y.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(z.dataType.equals(new furious.DataType("f32"))).to.be.true;
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with all elements initialized to zero", function(done) {
			var x = context.zeros([3, 2], new furious.DataType("f64"));
			var y = context.zeros([2, 3], new furious.DataType("f32"));
			context.get(x, y, function(x, y) {
				expect(x).to.deep.equal([[0.0, 0.0],
				                         [0.0, 0.0],
				                         [0.0, 0.0]]);
				expect(y).to.deep.equal([[0.0, 0.0, 0.0],
				                         [0.0, 0.0, 0.0]]);
				done();
			});
		});
	});
	describe("ones", function(){
		it("Creates array with specified shape", function() {
			var x = context.ones(42);
			var y = context.ones([42]);
			var z = context.ones([4, 2]);
			expect(x.shape).to.deep.equal([42]);
			expect(y.shape).to.deep.equal([42]);
			expect(z.shape).to.deep.equal([4, 2]);
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with specified data type (f64 by default)", function() {
			var x = context.ones([4, 2]);
			var y = context.ones([4, 2], new furious.DataType("f64"));
			var z = context.ones([4, 2], new furious.DataType("f32"));
			expect(x.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(y.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(z.dataType.equals(new furious.DataType("f32"))).to.be.true;
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with all elements initialized to one", function(done) {
			var x = context.ones([3, 2], new furious.DataType("f64"));
			var y = context.ones([2, 3], new furious.DataType("f32"));
			context.get(x, y, function(x, y) {
				expect(x).to.deep.equal([[1.0, 1.0],
				                         [1.0, 1.0],
				                         [1.0, 1.0]]);
				expect(y).to.deep.equal([[1.0, 1.0, 1.0],
				                         [1.0, 1.0, 1.0]]);
				done();
			});
		});
	});
	describe("eye", function() {
		it("Creates array with specified shape", function() {
			var x = context.eye(10);
			var y = context.eye(20, 20);
			var z = context.eye(11, 6);
			expect(x.shape).to.deep.equal([10, 10]);
			expect(y.shape).to.deep.equal([20, 20]);
			expect(z.shape).to.deep.equal([11, 6]);
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with specified data type (f64 by default)", function() {
			var x = context.eye(10);
			var y = context.eye(10, 10, 0, new furious.DataType("f64"));
			var z = context.eye(10, 10, 0, new furious.DataType("f32"));
			expect(x.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(y.dataType.equals(new furious.DataType("f64"))).to.be.true;
			expect(z.dataType.equals(new furious.DataType("f32"))).to.be.true;
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates a square identity array when called with one argument", function() {
			var x = context.eye(5);
			x.get(function(xVal) {
				for (var i = 0; i < x.shape[0]; i++) {
					for (var j = 0; j < x.shape[1]; j++) {
						expect(xVal[i][j]).to.equal((i === j)|0);
					}
				}
			});
		});
		it("Creates an identity array when called with two arguments", function() {
			var x = context.eye(3, 4);
			x.get(function(xVal) {
				for (var i = 0; i < x.shape[0]; i++) {
					for (var j = 0; j < x.shape[1]; j++) {
						expect(xVal[i][j]).to.equal((i === j)|0);
					}
				}
			});
		});
		it("Creates an array with unit diagonal above the main diagonal when diagonal > 0", function(done) {
			var x = context.eye(3, 4, 3);
			context.get(x, function(xVal) {
				for (var i = 0; i < x.shape[0]; i++) {
					for (var j = 0; j < x.shape[1]; j++) {
						expect(xVal[i][j]).to.equal(+((i === 0) && (j === 3)));
					}
				}
				done();
			});
		});
		it("Creates an array with unit diagonal below the main diagonal when diagonal < 0", function(done) {
			var x = context.eye(4, 3, -3);
			context.get(x, function(xVal) {
				for (var i = 0; i < x.shape[0]; i++) {
					for (var j = 0; j < x.shape[1]; j++) {
						expect(xVal[i][j]).to.equal(+((i === 3) && (j === 0)));
					}
				}
				done();
			});
		});
	});
	describe("array", function(){
		it("Creates array of the same length as the provided array", function(){
			var x = context.array([0, 1]);
			var y = context.array([[0, 1],
			                       [2, 3],
			                       [3, 4]]);
			expect(x.length).to.equal(2);
			expect(y.length).to.equal(6);
			x.invalidate();
			y.invalidate();
		});
		it("Creates array of the same shape as the provided array", function(){
			var x = context.array([0, 1]);
			var y = context.array([[0, 1],
			                       [2, 3],
			                       [3, 4]]);
			var z = context.array([[[1, 2, 3], [ 4,  5,  6]],
			                       [[7, 8, 9], [10, 11, 12]]]);
			expect(x.shape).to.deep.equal([2]);
			expect(y.shape).to.deep.equal([3, 2]);
			expect(z.shape).to.deep.equal([2, 2, 3]);
			x.invalidate();
			y.invalidate();
			z.invalidate();
		});
		it("Creates array with the same data as the provided array", function(done){
			var array = [[[1, 2, 3], [ 4,  5,  6]],
			             [[7, 8, 9], [10, 11, 12]]];
			var x = context.array(array, new furious.DataType("f64"));
			var y = context.array(array, new furious.DataType("f32"));
			context.get(x, y, function(x, y) {
				expect(x).to.deep.equal(array);
				expect(y).to.deep.equal(array);
				done();
			});
		});
	});
	describe("linspace", function(){
		it("Has length of 50 with default arguments", function(){
			expect((context.linspace(0, 1)).length).to.equal(50);
		});
		it("Has the specified number of samples", function(){
			expect((context.linspace(0, 1, 243)).length).to.equal(243);
		});
		it("Has expected values", function(done){
			var start = 50;
			var stop = 99;
			var x = context.linspace(start, stop);
			x.get(function(result) {
				for (var i = 0; i < result.length; i++) {
					expect(result[i]).to.equal(start+i);
				}
				done();
			});
		});
		describe("with includeStop === false", function(){
			it("Has the specified number of samples", function(){
				expect((context.linspace(0, 1, 243, false)).length).to.equal(243);
			});
			it("Does not contain the right endpoint", function(done){
				var x = context.linspace(-1, 1, 1000, false);
				x.get(function(result) {
					expect(result[result.length - 1]).to.not.equal(1);
					done();
				});
			});
		});
	});
	describe("neg", function() {
		var xRef = [ 1, -7.5,  0, -15];
		var yRef = [-1,  7.5, -0,  15];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.neg(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.neg(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with negated elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.neg(x);
						y.get(function(y) {
							expect(y).to.deep.equal(yRef);
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with negated elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.neg(x, y);
						y.get(function(y) {
							expect(y).to.deep.equal(yRef);
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
	describe("abs", function() {
		var xRef = [1, -7.5, 0, -15];
		var yRef = [1,  7.5, 0,  15];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.abs(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.abs(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.abs(x);
						y.get(function(y) {
							expect(y).to.deep.equal(yRef);
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.abs(x, y);
						y.get(function(y) {
							expect(y).to.deep.equal(yRef);
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
	describe("exp", function() {
		var xRef = [1, -1, 0];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.exp(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.exp(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.exp(x);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.exp(xRef[k]), Math.exp(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.exp(x, y);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.exp(xRef[k]), Math.exp(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
	describe("log", function() {
		var xRef = [1, 3, 10];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.log(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.log(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.log(x);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.log(xRef[k]), Math.log(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.log(x, y);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.log(xRef[k]), Math.log(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
	describe("sqrt", function() {
		var xRef = [0, 0.25, 1, 9, 10];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.sqrt(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.sqrt(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.sqrt(x);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.sqrt(xRef[k]), Math.sqrt(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.sqrt(x, y);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(Math.sqrt(xRef[k]), Math.sqrt(xRef[k]) * 3 * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
	describe("square", function() {
		var xRef = [-2, 0, 0.5, 1, 3];
		var dataTypes = ["f32", "f64"];

		describe("With no output array supplied", function() {
			it("Creates an output array with the same shape as input array", function() {
				var x = context.ones([2, 3, 4]);
				var y = context.square(x);
				expect(y.shape).to.deep.equal([2, 3, 4]);
				y.invalidate();
			});

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with the same data type as input array (" + dataType + " data type)", function() {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.square(x);
						expect(y.dataType.equals(new furious.DataType(dataType))).to.be.true;
						y.invalidate();
					});
				})(dataTypes[i]);
			}

			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Creates an output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.square(x);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(xRef[k] * xRef[k], xRef[k] * xRef[k] * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
		describe("With an output array", function() {
			for (var i = 0; i < dataTypes.length; i++) {
				(function(dataType) {
					it("Populates the output array with absolute values of elements (" + dataType + " data type)", function(done) {
						var x = context.array(xRef, new furious.DataType(dataType));
						var y = context.ones(x.shape, x.dataType);
						context.square(x, y);
						y.get(function(y) {
							for (var k = 0; k < y.length; k++) {
								expect(y[k]).to.be.closeTo(xRef[k] * xRef[k], xRef[k] * xRef[k] * x.dataType.epsilon);
							}
							done();
						});
					});
				})(dataTypes[i]);
			}
		});
	});
	describe("dot", function() {
		it("Correct shape for 2-dimensional arrays", function() {
			var x = context.empty([2, 5]);
			var y = context.empty([5, 11]);
			var z = context.dot(x, y);
			expect(z.shape).to.deep.equal([2, 11]);
			z.invalidate();
		});
		it("Correct shape for 3-dimensional arrays", function() {
			var x = context.empty([2, 3, 4]);
			var y = context.empty([7, 4, 8]);
			var z = context.dot(x, y);
			expect(z.shape).to.deep.equal([2, 3, 7, 8]);
			z.invalidate();
		});
		it("Correct shape for 4-dimensional arrays", function() {
			var x = context.empty([2, 3, 4, 5]);
			var y = context.empty([6, 7, 5, 8]);
			var z = context.dot(x, y);
			expect(z.shape).to.deep.equal([2, 3, 4, 6, 7, 8]);
			z.invalidate();
		});
		it("Correct value for 1-dimensional arrays", function(done) {
			var x = context.array([2, 5]);
			var y = context.array([5, 11]);
			context.dot(x, y).get(function(z) {
				expect(z).to.deep.equal(65);
				done();
			});
		});
		it("Correct value for 2-dimensional arrays", function(done) {
			var x = context.array([[64,  2,  3],
			                       [61, 60,  6]]);
			var y = context.array([[92, 99,  1,  8, 15],
			                       [67, 74, 51, 58, 40],
			                       [98, 80,  7, 14, 16]]);
			var z = context.dot(x, y);
			z.get(function(result) {
				expect(result).to.deep.equal([[  6316,  6724,  187,  670, 1088],
				                              [ 10220, 10959, 3163, 4052, 3411]]);
				done();
			});
		});
	});
	describe("cholesky", function() {
		var xRef = [[1155,  870,  715,  690,  795],
		            [ 870, 1055,  845,  765,  690],
		            [ 715,  845, 1105,  845,  715],
		            [ 690,  765,  845, 1055,  870],
		            [ 795,  690,  715,  870, 1155]];
		var lRef = [[ 33.985290935932859213,  0.0                 ,  0.0                 ,  0.0                 ,  0.0                 ],
		            [ 25.599310055637733541, 19.991881469119530124,  0.0                 ,  0.0                 ,  0.0                 ],
		            [ 21.038513436529861167, 15.327650471612518146, 20.674720878430960624,  0.0                 ,  0.0                 ],
		            [ 20.302901078609238539, 12.267966906395521676, 11.115895371451522067, 19.202241167809937394,  0.0                 ],
		            [ 23.392472981875862104,  4.560292702297942924,  7.39833786233360069 , 13.377618959392336251, 18.796272133421663142]];
		var dataTypes = ["f32", "f64"];
		it("Produces an output matrix of the same shape as input matrix", function() {
			var x = context.array([[1, 0], [0, 1]]);
			var c = context.cholesky(x);
			expect(c.shape).to.deep.equal(x.shape);
			c.invalidate();
		});
		it("Produces an output matrix of the same data type as input matrix", function() {
			var x = context.array([[1, 0], [0, 1]]);
			var c = context.cholesky(x);
			expect(c.dataType).to.equal(x.dataType);
			c.invalidate();
		});
		it("Produces a lower triangular matrix with kind = \"L\"", function(done) {
			var x = context.array(xRef);
			var l = context.cholesky(x, "L");
			l.get(function(lVal) {
				for (var i = 0; i < l.shape[0]; i++) {
					for (var j = i + 1; j < l.shape[1]; j++) {
						expect(lVal[i][j]).to.equal(0.0);
					}
				}
				done();
			});
		});
		it("Produces an upper triangular matrix with kind = \"U\"", function(done) {
			var x = context.array(xRef);
			var u = context.cholesky(x, "U");
			u.get(function(uVal) {
				for (var i = 0; i < u.shape[0]; i++) {
					for (var j = 0; j < i; j++) {
						expect(uVal[i][j]).to.equal(0.0);
					}
				}
				done();
			});
		});
		for (var i = 0; i < dataTypes.length; i++) {
			(function(dataType) {
				it("Produces a Cholesky decomposition (" + dataType + " data type)", function(done) {
					var x = context.array(xRef, new furious.DataType(dataType));
					var l = context.cholesky(x, "L");
					l.get(function(lVal) {
						for (var i = 0; i < l.shape[0]; i++) {
							for (var j = 0; j < l.shape[1]; j++) {
								expect(lVal[i][j]).to.be.closeTo(lRef[i][j], Math.abs(lRef[i][j]) * 10.0 * l.dataType.epsilon);
							}
						}
						done();
					});
				});
			})(dataTypes[i]);
		}
	});
	describe("solveTriangular", function() {
		var Dref = [[17,  0,  0,  0,  0],
		            [ 0,  5,  0,  0,  0],
		            [ 0,  0, 13,  0,  0],
		            [ 0,  0,  0, 21,  0],
		            [ 0,  0,  0,  0,  9]];
		var Lref = [[17,  0,  0,  0,  0],
		            [23,  5,  0,  0,  0],
		            [ 4,  6, 13,  0,  0],
		            [10, 12, 19, 21,  0],
		            [11, 18, 25,  2,  9]];
		var Uref = [[17, 24,  1,  8, 15],
		            [ 0,  5,  7, 14, 16],
		            [ 0,  0, 13, 20, 22],
		            [ 0,  0,  0, 21,  3],
		            [ 0,  0,  0,  0,  9]];
		var Bref = [[ 1.043853493141967403,  1.6372060525736436  ],
		            [-0.256567502623645749,  2.910931198527798802],
		            [-1.293144653712114067, -0.253521960140791869],
		            [-0.52110688571667263 , -0.904890851117336581],
		            [-0.454402652042796729, -0.94813096703015487 ]];
		var bRef = [-1.15094048574409813, -0.445846090199789602, -0.313207650636184609, 0.347350807241414206, -0.417420100901399582];
		var dataTypes = ["f32", "f64"];
		it("Produces a solution matrix of the same shape as right-hand size matrix", function() {
			var A = context.array(Dref).retain();
			var B = context.array(Bref);
			var b = context.array(bRef);
			var X = context.solveTriangular(A, B);
			var x = context.solveTriangular(A, b);
			expect(X.shape).to.deep.equal(B.shape);
			expect(x.shape).to.deep.equal(b.shape);
			X.invalidate();
			x.invalidate();
		});
		it("Produces a solution matrix of the same data type as input matrices", function() {
			var A = context.array(Dref, new furious.DataType("f64"));
			var a = context.array(Dref, new furious.DataType("f32"));
			var B = context.array(Bref, new furious.DataType("f64"));
			var b = context.array(bRef, new furious.DataType("f32"));
			var X = context.solveTriangular(A, B);
			var x = context.solveTriangular(a, b);
			expect(X.dataType).to.equal(B.dataType);
			expect(x.dataType).to.equal(b.dataType);
			X.invalidate();
			x.invalidate();
		});
		for (var i = 0; i < dataTypes.length; i++) {
			(function(dataType) {
				it("Matches scipy.solve_triangular (diagonal matrix of " + dataType + " data type, vector r.h.s.)", function(done) {
					var A = context.array(Dref, new furious.DataType(dataType));
					var y = context.array(bRef, new furious.DataType(dataType));
					var x = context.solveTriangular(A, y);
					x.get(function(xVal) {
						var xRef = [-0.067702381514358714, -0.08916921803995792 , -0.024092896202783431, 0.016540514630543533, -0.046380011211266621];
						for (var i = 0; i < x.length; i++) {
							expect(xVal[i]).to.be.closeTo(xRef[i], Math.abs(xRef[i]) * 30.0 * x.dataType.epsilon);
						}
						done();
					});
				});
				it("Matches scipy.solve_triangular (diagonal matrix of " + dataType + " data type, matrix r.h.s.)", function(done) {
					var A = context.array(Dref, new furious.DataType(dataType));
					var Y = context.array(Bref, new furious.DataType(dataType));
					var X = context.solveTriangular(A, Y);
					X.get(function(Xval) {
						var Xref = [[ 0.061403146655409843,  0.096306238386684923],
						            [-0.051313500524729154,  0.582186239705559827],
						            [-0.099472665670162622, -0.019501689241599375],
						            [-0.024814613605555837, -0.043090040529396981],
						            [-0.050489183560310742, -0.105347885225572757]];
						for (var i = 0; i < X.shape[0]; i++) {
							for (var j = 0; j < X.shape[1]; j++) {
								expect(Xval[i][j]).to.be.closeTo(Xref[i][j], Math.abs(Xref[i][j]) * 30.0 * X.dataType.epsilon);
							}
						}
						done();
					});
				});
				it("Matches scipy.solve_triangular (upper triangular matrix of " + dataType + " data type, vector r.h.s.)", function(done) {
					var A = context.array(Uref, new furious.DataType(dataType));
					var y = context.array(bRef, new furious.DataType(dataType));
					var x = context.solveTriangular(A, y);
					x.get(function(xVal) {
						var xRef = [0.006218968531873263, -0.031877026069015428,  0.018755998896487252, 0.023166230517867335, -0.046380011211266621];
						for (var i = 0; i < x.length; i++) {
							expect(xVal[i]).to.be.closeTo(xRef[i], Math.abs(xRef[i]) * 30.0 * x.dataType.epsilon);
						}
						done();
					});
				});
				it("Matches scipy.solve_triangular (upper triangular matrix of " + dataType + " data type, matrix r.h.s.)", function(done) {
					var A = context.array(Uref, new furious.DataType(dataType));
					var Y = context.array(Bref, new furious.DataType(dataType));
					var X = context.solveTriangular(A, Y);
					X.get(function(Xval) {
						var Xref = [[-0.085967221880329306, -0.819012561113931836],
						            [ 0.141266609603164062,  0.715126761460139981],
						            [ 0.013050372811809438,  0.201918335970953683],
						            [-0.017601873096940019, -0.028040342640029439],
						            [-0.050489183560310742, -0.105347885225572757]];
						for (var i = 0; i < X.shape[0]; i++) {
							for (var j = 0; j < X.shape[1]; j++) {
								expect(Xval[i][j]).to.be.closeTo(Xref[i][j], Math.abs(Xref[i][j]) * 30.0 * X.dataType.epsilon);
							}
						}
						done();
					});
				});
				it("Matches scipy.solve_triangular (lower triangular matrix of " + dataType + " data type, vector r.h.s.)", function(done) {
					var A = context.array(Lref, new furious.DataType(dataType));
					var y = context.array(bRef, new furious.DataType(dataType));
					var x = context.solveTriangular(A, y, "L");
					x.get(function(xVal) {
						var xRef = [-0.067702381514358714,  0.222261736926092163, -0.105843734318100208, 0.017536415776942829, -0.118042738057165877];
						for (var i = 0; i < x.length; i++) {
							expect(xVal[i]).to.be.closeTo(xRef[i], Math.abs(xRef[i]) * 30.0 * x.dataType.epsilon);
						}
						done();
					});
				});
				it("Matches scipy.solve_triangular (lower triangular matrix of " + dataType + " data type, matrix r.h.s.)", function(done) {
					var A = context.array(Lref, new furious.DataType(dataType));
					var Y = context.array(Bref, new furious.DataType(dataType));
					var X = context.solveTriangular(A, Y, "L");
					X.get(function(Xval) {
						var Xref = [[ 0.061403146655409843,  0.096306238386684923],
						            [-0.333767975139614481,  0.139177543126809161],
						            [ 0.035680816192610251, -0.113370167111414344],
						            [ 0.104387706749762249, -0.065907170351858238],
						            [ 0.419687829882886054, -0.171847427453019841]];
						for (var i = 0; i < X.shape[0]; i++) {
							for (var j = 0; j < X.shape[1]; j++) {
								expect(Xval[i][j]).to.be.closeTo(Xref[i][j], Math.abs(Xref[i][j]) * 30.0 * X.dataType.epsilon);
							}
						}
						done();
					});
				});
				it("Matches scipy.solve_triangular (transposed upper triangular matrix of " + dataType + " data type, vector r.h.s.)", function(done) {
					var A = context.array(Uref, new furious.DataType(dataType));
					var y = context.array(bRef, new furious.DataType(dataType));
					var x = context.solveTriangular(A, y, "U", "T");
					x.get(function(xVal) {
						var xRef = [-0.067702381514358714,  0.235802213228963942, -0.145855443209582575, 0.024040368492497136, -0.00422457163512407];
						for (var i = 0; i < x.length; i++) {
							expect(xVal[i]).to.be.closeTo(xRef[i], Math.abs(xRef[i]) * 30.0 * x.dataType.epsilon);
						}
						done();
					});
				});
				it("Matches scipy.solve_triangular (transposed upper triangular matrix of " + dataType + " data type, matrix r.h.s.)", function(done) {
					var A = context.array(Uref, new furious.DataType(dataType));
					var Y = context.array(Bref, new furious.DataType(dataType));
					var X = context.solveTriangular(A, Y, "U", "T");
					X.get(function(Xval) {
						var Xref = [[ 0.061403146655409843,  0.096306238386684923],
						            [-0.346048604470696408,  0.119916295449472188],
						            [ 0.082137879302103922, -0.091480174359521715],
						            [ 0.104266229408939051, -0.072598352729190102],
						            [ 0.22683286519823273 , -0.231225152880548401]];
						for (var i = 0; i < X.shape[0]; i++) {
							for (var j = 0; j < X.shape[1]; j++) {
								expect(Xval[i][j]).to.be.closeTo(Xref[i][j], Math.abs(Xref[i][j]) * 30.0 * X.dataType.epsilon);
							}
						}
						done();
					});
				});
				it("Matches scipy.solve_triangular (transposed lower triangular matrix of " + dataType + " data type, vector r.h.s.)", function(done) {
					var A = context.array(Lref, new furious.DataType(dataType));
					var y = context.array(bRef, new furious.DataType(dataType));
					var x = context.solveTriangular(A, y, "L", "T");
					x.get(function(xVal) {
						var xRef = [-0.039375205677707963, -0.013862369020948569,  0.034469009007106602, 0.020957658555426067, -0.046380011211266621];
						for (var i = 0; i < x.length; i++) {
							expect(xVal[i]).to.be.closeTo(xRef[i], Math.abs(xRef[i]) * 30.0 * x.dataType.epsilon);
						}
						done();
					});
				});
				it("Matches scipy.solve_triangular (transposed lower triangular matrix of " + dataType + " data type, matrix r.h.s.)", function(done) {
					var A = context.array(Lref, new furious.DataType(dataType));
					var Y = context.array(Bref, new furious.DataType(dataType));
					var X = context.solveTriangular(A, Y, "L", "T");
					X.get(function(Xval) {
						var Xref = [[-0.098317734340139518, -0.902946202316054825],
						            [ 0.14622828991420761 ,  0.763089997876717385],
						            [ 0.026861631848108854,  0.231404341073724207],
						            [-0.020006119933145293, -0.033056908603151955],
						            [-0.050489183560310742, -0.105347885225572757]];
						for (var i = 0; i < X.shape[0]; i++) {
							for (var j = 0; j < X.shape[1]; j++) {
								expect(Xval[i][j]).to.be.closeTo(Xref[i][j], Math.abs(Xref[i][j]) * 30.0 * X.dataType.epsilon);
							}
						}
						done();
					});
				});
			})(dataTypes[i]);
		}
	});
});
