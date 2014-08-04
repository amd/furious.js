var furious = require("../lib/furious.js");
var expect = require("chai").expect;

var context = null;
before(function(done) {
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
});
