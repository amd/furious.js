var furious = require("../lib/furious.js");
var expect = require("chai").expect;

var context = null;
before(function(done) {
	furious.init(function(ctx) {
		context = ctx;
		done();
	});
});

describe("NDArray", function(){
	describe("length", function(){
		it("Equals to the number passed in constructor", function(){
			expect((context.empty(42)).length).to.equal(42);
		});
		it("Equals to the number passed in constructor as an array", function(){
			expect((context.empty([42])).length).to.equal(42);
		});
		it("Equals to the product of dimensions", function(){
			expect((context.empty([2, 5, 3])).length).to.equal(30);
		});
	});
	describe("reshape", function(){
		it("Preserves length", function(){
			var x = context.empty([7,5,3]);
			var y = x.reshape([21,5]);
			expect(y.length).to.equal(x.length);
		});
		it("Changes shape", function(){
			var x = context.empty([7,5,3]);
			var y = x.reshape([21,5]);
			expect(y.shape).to.deep.equal([21,5]);
		});
		it("Rearranges data", function(done){
			var x = context.linspace(1, 8, 8).reshape([2, 2, 2]);
			x.get(function(result){
				expect(result).to.deep.equal([[[ 1,  2], [ 3,  4]],
											  [[ 5,  6], [ 7,  8]]]);
				done();
			});
		});
	});
	describe("repeat", function(){
		it("Repeats array elements along axis 0", function(done){
			var x = context.array([[8, 1, 6],
			                       [3, 5, 7],
			                       [4, 9, 2]]);
			x.repeat(2, 0).get(function(result) {
				expect(result).to.deep.equal([[8, 1, 6],
				                              [8, 1, 6],
				                              [3, 5, 7],
				                              [3, 5, 7],
				                              [4, 9, 2],
				                              [4, 9, 2]]);
				done();
			});
		});
		it("Repeats array elements along axis 1", function(done){
			var x = context.array([[8, 1, 6],
			                       [3, 5, 7],
			                       [4, 9, 2]]);
			x.repeat(2, 1).get(function(result) {
				expect(result).to.deep.equal([[8, 8, 1, 1, 6, 6],
				                              [3, 3, 5, 5, 7, 7],
				                              [4, 4, 9, 9, 2, 2]]);
				done();
			});
		});
	});
	describe("get", function(){
		it("Works with 1-dimensional array", function(done){
			var x = context.array([42, 10]);
			x.get(function(result){
				expect(result).to.deep.equal([42, 10]);
				done();
			});
		});
		it("Works with 2-dimensional array", function(done){
			var array = [[16,  2,  3, 13,  5],
						 [11, 10,  8,  9,  7],
						 [ 6, 12,  4, 14, 15]];
			var x = context.array(array);
			x.get(function(result){
				expect(result).to.deep.equal(array);
				done();
			});
		});
	});
	describe("add", function(){
		describe("Add array", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = context.array([8, -1, 10]);
				var z = x.add(y);
				z.get(function(result){
					expect(result).to.deep.equal([9, 3, 19]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[8, -1], [10, -21]]);
				var z = x.add(y);
				z.get(function(result){
					expect(result).to.deep.equal([[9, 3], [19, -38]]);
					done();
				});
			});
		});
		describe("Add scalar", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var z = x.add(-7);
				z.get(function(result){
					expect(result).to.deep.equal([-6, -3, 2]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var z = x.add(42);
				z.get(function(result){
					expect(result).to.deep.equal([[43, 46], [51, 25]]);
					done();
				});
			});
		});
	});
	describe("sub", function(){
		describe("Subtract array", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = context.array([8, -1, 10]);
				var z = x.sub(y);
				z.get(function(result){
					expect(result).to.deep.equal([-7, 5, -1]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[8, -1], [10, -21]]);
				var z = x.sub(y);
				z.get(function(result){
					expect(result).to.deep.equal([[-7, 5], [-1, 4]]);
					done();
				});
			});
		});
		describe("Subtract scalar", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = x.sub(-7);
				y.get(function(result){
					expect(result).to.deep.equal([8, 11, 16]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = x.sub(42);
				y.get(function(result){
					expect(result).to.deep.equal([[-41, -38], [-33, -59]]);
					done();
				});
			});
		});
	});
	describe("mul", function(){
		describe("Multiply by array", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = context.array([8, -1, 10]);
				var z = x.mul(y);
				z.get(function(result){
					expect(result).to.deep.equal([8, -4, 90]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[8, -1], [10, -21]]);
				var z = x.mul(y);
				z.get(function(result){
					expect(result).to.deep.equal([[8, -4], [90, 357]]);
					done();
				});
			});
		});
		describe("Multiply by scalar", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = x.mul(-10);
				y.get(function(result){
					expect(result).to.deep.equal([-10, -40, -90]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = x.mul(10);
				y.get(function(result){
					expect(result).to.deep.equal([[10, 40], [90, -170]]);
					done();
				});
			});
		});
	});
	describe("div", function(){
		describe("Divide by array", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				var y = context.array([2, -4, 8]);
				var z = x.div(y);
				z.get(function(result){
					expect(result).to.deep.equal([0.5, -1, 1.125]);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[1, 4], [9, -17]]);
				var y = context.array([[-2, 4], [-8, 16]]);
				var z = x.div(y);
				z.get(function(result){
					expect(result).to.deep.equal([[-0.5, 1], [-1.125, -1.0625]]);
					done();
				});
			});
		});
		describe("Divide by scalar", function(){
			it("Correct result for 1-dimensional arrays", function(){
				var x = context.array([1, 4, 9]);
				var y = x.div(-2);
				y.get(function(result){
					expect(result).to.deep.equal([-0.5, -2, -4.5]);
				});
			});
			it("Correct result for 2-dimensional arrays", function(){
				var x = context.array([[1, 4], [9, -17]]);
				var y = x.div(-4);
				y.get(function(result){
					expect(result).to.deep.equal([[-0.25, -1], [-2.25, 4.25]]);
				});
			});
		});
	});
	describe("min", function(){
		describe("All elements", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				x.min().get(function(result) {
					expect(result).to.equal(1);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[-2, 4], [-8, 16]]);
				x.min().get(function(result) {
					expect(result).to.equal(-8);
					done();
				});
			});
		});
		describe("Along an axis", function(){
			it("Correct shape for 3-dimensional arrays", function(){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]).lock();
				expect(x.min(0).shape).to.deep.equal([3, 4]);
				expect(x.min(1).shape).to.deep.equal([2, 4]);
				expect(x.min(2).shape).to.deep.equal([2, 3]);
				x.invalidate();
			});
			it("Correct result for 3-dimensional arrays, axis 0", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.min(0).get(function(result){
					expect(result).to.deep.equal([[ 1,  2,  3,  4],
												  [ 5,  6,  7,  8],
												  [ 9, 10, 11, 12]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 1", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.min(1).get(function(result){
					expect(result).to.deep.equal([[  1,  2,  3,  4],
												  [ 13, 14, 15, 16]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 2", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.min(2).get(function(result){
					expect(result).to.deep.equal([[  1,  5,  9],
												  [ 13, 17, 21]]);
					done();
				});
			});
		});
	});
	describe("max", function(){
		describe("All elements", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				x.max().get(function(result) {
					expect(result).to.equal(9);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[-2, 4], [-8, 16]]);
				x.max().get(function(result) {
					expect(result).to.equal(16);
					done();
				});
			});
		});
		describe("Along an axis", function(){
			it("Correct shape for 3-dimensional arrays", function(){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]).lock();
				expect(x.max(0).shape).to.deep.equal([3, 4]);
				expect(x.max(1).shape).to.deep.equal([2, 4]);
				expect(x.max(2).shape).to.deep.equal([2, 3]);
				x.invalidate();
			});
			it("Correct result for 3-dimensional arrays, axis 0", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.max(0).get(function(result){
					expect(result).to.deep.equal([[ 13, 14, 15, 16],
												  [ 17, 18, 19, 20],
												  [ 21, 22, 23, 24]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 1", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.max(1).get(function(result){
					expect(result).to.deep.equal([[  9, 10, 11, 12],
												  [ 21, 22, 23, 24]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 2", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.max(2).get(function(result){
					expect(result).to.deep.equal([[  4,  8, 12],
												  [ 16, 20, 24]]);
					done();
				});
			});
		});
	});
	describe("sum", function(){
		describe("All elements", function(){
			it("Correct result for 1-dimensional arrays", function(done){
				var x = context.array([1, 4, 9]);
				x.sum().get(function (result) {
					expect(result).to.equal(14);
					done();
				});
			});
			it("Correct result for 2-dimensional arrays", function(done){
				var x = context.array([[-2, 4], [-8, 16]]);
				x.sum().get(function (result) {
					expect(result).to.equal(10);
					done();
				});
			});
		});
		describe("Along an axis", function(){
			it("Correct shape for 3-dimensional arrays", function(){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]).lock();
				expect(x.sum(0).shape).to.deep.equal([3, 4]);
				expect(x.sum(1).shape).to.deep.equal([2, 4]);
				expect(x.sum(2).shape).to.deep.equal([2, 3]);
				x.invalidate();
			});
			it("Correct result for 3-dimensional arrays, axis 0", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.sum(0).get(function(result){
					expect(result).to.deep.equal([[ 14, 16, 18, 20],
												  [ 22, 24, 26, 28],
												  [ 30, 32, 34, 36]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 1", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.sum(1).get(function(result){
					expect(result).to.deep.equal([[ 15,  18,  21,  24],
												  [ 51,  54,  57,  60]]);
					done();
				});
			});
			it("Correct result for 3-dimensional arrays, axis 2", function(done){
				var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
				x.sum(2).get(function(result){
					expect(result).to.deep.equal([[ 10,  26,  42],
												  [ 58,  74,  90]]);
					done();
				});
			});
		});
	});
	describe("dot", function(){
		it("Correct shape for 2-dimensional arrays", function(){
			var x = context.empty([2, 5]);
			var y = context.empty([5, 11]);
			expect(context.dot(x, y).shape).to.deep.equal([2, 11]);
		});
		it("Correct shape for 3-dimensional arrays", function(){
			var x = context.empty([2, 3, 4]);
			var y = context.empty([7, 4, 8]);
			expect(context.dot(x, y).shape).to.deep.equal([2, 3, 7, 8]);
		});
		it("Correct shape for 4-dimensional arrays", function(){
			var x = context.empty([2, 3, 4, 5]);
			var y = context.empty([6, 7, 5, 8]);
			expect(context.dot(x, y).shape).to.deep.equal([2, 3, 4, 6, 7, 8]);
		});
		it("Correct value for 1-dimensional arrays", function(done){
			var x = context.array([2, 5]);
			var y = context.array([5, 11]);
			context.dot(x, y).get(function(result){
				expect(result).to.deep.equal(65);
				done();
			});
		});
		it("Correct value for 2-dimensional arrays", function(done){
			var x = context.array([[64,  2,  3],
								   [61, 60,  6]]);
			var y = context.array([[92, 99,  1,  8, 15],
								   [67, 74, 51, 58, 40],
								   [98, 80,  7, 14, 16]]);
			var z = context.dot(x, y);
			z.get(function(result){
				expect(result).to.deep.equal([[  6316,  6724,  187,  670, 1088],
											  [ 10220, 10959, 3163, 4052, 3411]]);
				done();
			});
		});
	});
});
