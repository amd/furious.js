var furious = require('../lib/furious.js');
var expect = require('chai').expect;

describe('NDArray', function(){
	describe('length', function(){
		furious.connect(function(context) {
			it('Equals to the number passed in constructor', function(){
				expect((context.empty(42)).length).to.equal(42);
			})
			it('Equals to the number passed in constructor as an array', function(){
				expect((context.empty([42])).length).to.equal(42);
			})
			it('Equals to the product of dimensions', function(){
				expect((context.empty([2, 5, 3])).length).to.equal(30);
			})
		})
	})
	describe('reshape', function(){
		furious.connect(function(context) {
			it('Preserves length', function(){
				var x = context.empty([7,5,3]);
				var y = x.reshape([21,5]);
				expect(y.length).to.equal(x.length);
			})
			it('Changes shape', function(){
				var x = context.empty([7,5,3]);
				var y = x.reshape([21,5]);
				expect(y.shape).to.deep.equal([21,5]);
			})
			it('Rearranges data', function(done){
				var x = context.linspace(1, 8, 8).reshape([2, 2, 2]);
				x.toArray(function(result){
					expect(result).to.deep.equal([[[ 1.,  2.], [ 3.,  4.]],
					                              [[ 5.,  6.], [ 7.,  8.]]]);
					done();
				});
			})
		})
	})
	describe('toArray', function(){
		furious.connect(function(context) {
			it('Works with 1-dimensional array', function(done){
				var x = context.array([42, 10]);
				x.toArray(function(result){
					expect(result).to.deep.equal([42, 10]);
					done();
				});
			})
			it('Works with 2-dimensional array', function(done){
				var array = [[16,  2,  3, 13,  5],
				             [11, 10,  8,  9,  7],
				             [ 6, 12,  4, 14, 15]];
				var x = context.array(array);
				x.toArray(function(result){
					expect(result).to.deep.equal(array);
					done();
				});
			})
		})
	})
	describe('add', function(){
		describe('Add array', function(){
			furious.connect(function(context) {
				it('Correct result for 1-dimensional arrays', function(done){
					var x = context.array([1, 4, 9]);
					var y = context.array([8, -1, 10]);
					var z = x.add(y);
					z.toArray(function(result){
						expect(result).to.deep.equal([9, 3, 19]);
						done();
					});
				})
				it('Correct result for 2-dimensional arrays', function(done){
					var x = context.array([[1, 4], [9, -17]]);
					var y = context.array([[8, -1], [10, -21]]);
					var z = x.add(y);
					z.toArray(function(result){
						expect(result).to.deep.equal([[9, 3], [19, -38]]);
						done();
					});
				})
			})
		})
		describe('Add scalar', function(){
			furious.connect(function(context) {
				it('Correct result for 1-dimensional arrays', function(done){
					var x = context.array([1, 4, 9]);
					var z = x.add(-7);
					z.toArray(function(result){
						expect(result).to.deep.equal([-6, -3, 2]);
						done();
					});
				})
				it('Correct result for 2-dimensional arrays', function(done){
					var x = context.array([[1, 4], [9, -17]]);
					var z = x.add(42);
					z.toArray(function(result){
						expect(result).to.deep.equal([[43, 46], [51, 25]]);
						done();
					});
				})
			})
		})
	})
	describe('sub', function(){
		describe('Subtract array', function(){
			furious.connect(function(context) {
				it('Correct result for 1-dimensional arrays', function(done){
					var x = context.array([1, 4, 9]);
					var y = context.array([8, -1, 10]);
					var z = x.sub(y);
					z.toArray(function(result){
						expect(result).to.deep.equal([-7, 5, -1]);
						done();
					});
				})
				it('Correct result for 2-dimensional arrays', function(done){
					var x = context.array([[1, 4], [9, -17]]);
					var y = context.array([[8, -1], [10, -21]]);
					var z = x.sub(y);
					z.toArray(function(result){
						expect(result).to.deep.equal([[-7, 5], [-1, 4]]);
						done();
					});
				})
			})
		})
		describe('Subtract scalar', function(){
			furious.connect(function(context) {
				it('Correct result for 1-dimensional arrays', function(done){
					var x = context.array([1, 4, 9]);
					var y = x.sub(-7);
					y.toArray(function(result){
						expect(result).to.deep.equal([8, 11, 16]);
						done();
					});
				})
				it('Correct result for 2-dimensional arrays', function(done){
					var x = context.array([[1, 4], [9, -17]]);
					var y = x.sub(42);
					y.toArray(function(result){
						expect(result).to.deep.equal([[-41, -38], [-33, -59]]);
						done();
					});
				})
			})
		})
	})
	describe('mul', function(){
		describe('Multiply by array', function(){
			furious.connect(function(context) {
				it('Correct result for 1-dimensional arrays', function(done){
					var x = context.array([1, 4, 9]);
					var y = context.array([8, -1, 10]);
					var z = x.mul(y);
					z.toArray(function(result){
						expect(result).to.deep.equal([8, -4, 90]);
						done();
					});
				})
				it('Correct result for 2-dimensional arrays', function(done){
					var x = context.array([[1, 4], [9, -17]]);
					var y = context.array([[8, -1], [10, -21]]);
					var z = x.mul(y);
					z.toArray(function(result){
						expect(result).to.deep.equal([[8, -4], [90, 357]]);
						done();
					});
				})
			})
		})
		describe('Multiply by scalar', function(){
			furious.connect(function(context) {
				it('Correct result for 1-dimensional arrays', function(done){
					var x = context.array([1, 4, 9]);
					var y = x.mul(-10);
					y.toArray(function(result){
						expect(result).to.deep.equal([-10, -40, -90]);
						done();
					});
				})
				it('Correct result for 2-dimensional arrays', function(done){
					var x = context.array([[1, 4], [9, -17]]);
					var y = x.mul(10);
					y.toArray(function(result){
						expect(result).to.deep.equal([[10, 40], [90, -170]]);
						done();
					});
				})
			})
		})
	})
	describe('div', function(){
		describe('Divide by array', function(){
			furious.connect(function(context) {
				it('Correct result for 1-dimensional arrays', function(done){
					var x = context.array([1, 4, 9]);
					var y = context.array([2, -4, 8]);
					var z = x.div(y);
					z.toArray(function(result){
						expect(result).to.deep.equal([0.5, -1, 1.125]);
						done();
					});
				})
				it('Correct result for 2-dimensional arrays', function(done){
					var x = context.array([[1, 4], [9, -17]]);
					var y = context.array([[-2, 4], [-8, 16]]);
					var z = x.div(y);
					z.toArray(function(result){
						expect(result).to.deep.equal([[-0.5, 1], [-1.125, -1.0625]]);
						done();
					});
				})
			})
		})
		describe('Divide by scalar', function(){
			furious.connect(function(context) {
				it('Correct result for 1-dimensional arrays', function(){
					var x = context.array([1, 4, 9]);
					var y = x.div(-2);
					y.toArray(function(result){
						expect(result).to.deep.equal([-0.5, -2, -4.5]);
					});
				})
				it('Correct result for 2-dimensional arrays', function(){
					var x = context.array([[1, 4], [9, -17]]);
					var y = x.div(-4);
					y.toArray(function(result){
						expect(result).to.deep.equal([[-0.25, -1], [-2.25, 4.25]]);
					});
				})
			})
		})
	})
	describe('min', function(){
		describe('All elements', function(){
			furious.connect(function(context) {
				it('Correct result for 1-dimensional arrays', function(done){
					var x = context.array([1, 4, 9]);
					x.min().toArray(function(result) {
						expect(result[0]).to.equal(1);
						done();
					});
				})
				it('Correct result for 2-dimensional arrays', function(done){
					var x = context.array([[-2, 4], [-8, 16]]);
					x.min().toArray(function(result) {
						expect(result[0]).to.equal(-8);
						done();
					});
				})
			})
		})
		describe('Along an axis', function(){
			furious.connect(function(context) {
				it('Correct shape for 3-dimensional arrays', function(){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					expect(x.min(0).shape).to.deep.equal([3, 4]);
					expect(x.min(1).shape).to.deep.equal([2, 4]);
					expect(x.min(2).shape).to.deep.equal([2, 3]);
				})
				it('Correct result for 3-dimensional arrays, axis 0', function(done){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					x.min(0).toArray(function(result){
						expect(result).to.deep.equal([[ 1,  2,  3,  4],
						                              [ 5,  6,  7,  8],
						                              [ 9, 10, 11, 12]]);
						done();
					});
				})
				it('Correct result for 3-dimensional arrays, axis 1', function(done){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					x.min(1).toArray(function(result){
						expect(result).to.deep.equal([[  1,  2,  3,  4],
						                              [ 13, 14, 15, 16]]);
						done();
					});
				})
				it('Correct result for 3-dimensional arrays, axis 2', function(done){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					x.min(2).toArray(function(result){
						expect(result).to.deep.equal([[  1,  5,  9],
						                              [ 13, 17, 21]]);
						done();
					});
				})
			})
		})
	})
	describe('max', function(){
		describe('All elements', function(){
			furious.connect(function(context) {
				it('Correct result for 1-dimensional arrays', function(done){
					var x = context.array([1, 4, 9]);
					x.max().toArray(function(result) {
						expect(result[0]).to.equal(9);
						done();
					});
				})
				it('Correct result for 2-dimensional arrays', function(done){
					var x = context.array([[-2, 4], [-8, 16]]);
					x.max().toArray(function(result) {
						expect(result[0]).to.equal(16);
						done();
					});
				})
			})
		})
		describe('Along an axis', function(){
			furious.connect(function(context) {
				it('Correct shape for 3-dimensional arrays', function(){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					expect(x.max(0).shape).to.deep.equal([3, 4]);
					expect(x.max(1).shape).to.deep.equal([2, 4]);
					expect(x.max(2).shape).to.deep.equal([2, 3]);
				})
				it('Correct result for 3-dimensional arrays, axis 0', function(done){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					x.max(0).toArray(function(result){
						expect(result).to.deep.equal([[ 13, 14, 15, 16],
						                              [ 17, 18, 19, 20],
						                              [ 21, 22, 23, 24]]);
						done();
					});
				})
				it('Correct result for 3-dimensional arrays, axis 1', function(done){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					x.max(1).toArray(function(result){
						expect(result).to.deep.equal([[  9, 10, 11, 12],
						                              [ 21, 22, 23, 24]]);
						done();
					});
				})
				it('Correct result for 3-dimensional arrays, axis 2', function(done){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					x.max(2).toArray(function(result){
						expect(result).to.deep.equal([[  4,  8, 12],
						                              [ 16, 20, 24]]);
						done();
					});
				})
			})
		})
	})
	describe('sum', function(){
		describe('All elements', function(){
			furious.connect(function(context) {
				it('Correct result for 1-dimensional arrays', function(done){
					var x = context.array([1, 4, 9]);
					x.sum().toArray(function (result) {
						expect(result[0]).to.equal(14);
						done();
					});
				})
				it('Correct result for 2-dimensional arrays', function(done){
					var x = context.array([[-2, 4], [-8, 16]]);
					x.sum().toArray(function (result) {
						expect(result[0]).to.equal(10);
						done();
					});
				})
			})
		})
		describe('Along an axis', function(){
			furious.connect(function(context) {
				it('Correct shape for 3-dimensional arrays', function(){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					expect(x.sum(0).shape).to.deep.equal([3, 4]);
					expect(x.sum(1).shape).to.deep.equal([2, 4]);
					expect(x.sum(2).shape).to.deep.equal([2, 3]);
				})
				it('Correct result for 3-dimensional arrays, axis 0', function(done){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					x.sum(0).toArray(function(result){
						expect(result).to.deep.equal([[ 14, 16, 18, 20],
						                              [ 22, 24, 26, 28],
						                              [ 30, 32, 34, 36]]);
						done();
					});
				})
				it('Correct result for 3-dimensional arrays, axis 1', function(done){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					x.sum(1).toArray(function(result){
						expect(result).to.deep.equal([[ 15,  18,  21,  24],
						                              [ 51,  54,  57,  60]]);
						done();
					});
				})
				it('Correct result for 3-dimensional arrays, axis 2', function(done){
					var x = context.linspace(1, 24, 24).reshape([2, 3, 4]);
					x.sum(2).toArray(function(result){
						expect(result).to.deep.equal([[ 10,  26,  42],
						                              [ 58,  74,  90]]);
						done();
					});
				})
			})
		})
	})
	describe('dot', function(){
		furious.connect(function(context) {
			it('Correct shape for 2-dimensional arrays', function(){
				var x = context.empty([2, 5]);
				var y = context.empty([5, 11]);
				expect(context.dot(x, y).shape).to.deep.equal([2, 11]);
			})
			it('Correct shape for 3-dimensional arrays', function(){
				var x = context.empty([2, 3, 4]);
				var y = context.empty([7, 4, 8]);
				expect(context.dot(x, y).shape).to.deep.equal([2, 3, 7, 8]);
			})
			it('Correct shape for 4-dimensional arrays', function(){
				var x = context.empty([2, 3, 4, 5]);
				var y = context.empty([6, 7, 5, 8]);
				expect(context.dot(x, y).shape).to.deep.equal([2, 3, 4, 6, 7, 8]);
			})
			it('Correct value for 1-dimensional arrays', function(done){
				var x = context.array([2, 5]);
				var y = context.array([5, 11]);
				context.dot(x, y).toArray(function(result){
					expect(result).to.deep.equal([65]);
					done();
				});
			})
			it('Correct value for 2-dimensional arrays', function(done){
				var x = context.array([[64,  2,  3],
				                   [61, 60,  6]]);
				var y = context.array([[92, 99,  1,  8, 15],
				                   [67, 74, 51, 58, 40],
				                   [98, 80,  7, 14, 16]]);
				var z = context.dot(x, y);
				z.toArray(function(result){
					expect(result).to.deep.equal([[  6316,  6724,  187,  670, 1088],
					                              [ 10220, 10959, 3163, 4052, 3411]]);
					done();
				});
			})
		})
	})
})
describe('empty', function(){
	furious.connect(function(context) {
		it('No error with integer shape', function(){
			expect(function (){context.empty(100)}).to.not.throw(Error);
		})
		it('No error with integer array shape', function(){
			expect(function (){context.empty([100])}).to.not.throw(Error);
		})
		it('No error with multi-dimensional integer array shape', function(){
			expect(function (){context.empty([2, 5, 1])}).to.not.throw(Error);
		})
		it('No error with explicit F64 data type', function(){
			expect(function (){context.empty([2, 5, 1], furious.DataType('f64'))}).to.not.throw(Error);
		})
		it('No error with F32 data type', function(){
			expect(function (){context.empty([2, 5, 1], furious.DataType('f32'))}).to.not.throw(Error);
		})
	})
})
describe('array', function(){
	furious.connect(function(context) {
		it('Matches the length of the provided array', function(){
			expect((context.array([0, 1])).length).to.equal(2);
			expect((context.array([[0, 1], [2,3], [3,4]])).length).to.equal(6);
		})
		it('Matches the shape of the provided array', function(){
			expect((context.array([0, 1])).shape).to.deep.equal([2]);
			expect((context.array([[0, 1], [2,3], [3,4]])).shape).to.deep.equal([3, 2]);
			expect((context.array([[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]])).shape).to.deep.equal([2, 2, 3]);
		})
		it('Matches the data of the provided array', function(done){
			var array = [[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]];
			var x = context.array(array);
			x.toArray(function(result){
				expect(result).to.deep.equal(array);
				done();
			});
		})
	})
})
describe('linspace', function(){
	furious.connect(function(context) {
		it('Has length of 50 with default arguments', function(){
			expect((context.linspace(0, 1)).length).to.equal(50);
		})
		it('Has the specified number of samples', function(){
			expect((context.linspace(0, 1, 243)).length).to.equal(243);
		})
		it('Has expected values', function(done){
			var start = 50;
			var stop = 99;
			var x = context.linspace(start, stop);
			x.toArray(function(result) {
				for (var i = 0; i < result.length; i++) {
					expect(result[i]).to.equal(start+i);
				}
				done();
			});
		})
		describe('with includeStop === false', function(){
			it('Has the specified number of samples', function(){
				expect((context.linspace(0, 1, 243, false)).length).to.equal(243);
			})
			it('Does not contain the right endpoint', function(done){
				var x = context.linspace(-1, 1, 1000, false);
				x.toArray(function(result) {
					expect(result[result.length - 1]).to.not.equal(1);
					done();
				});
			})
		})
	})
})
describe('neg', function() {
	furious.connect(function(context) {
		it('Correct result for 2-dimensional array', function(done){
			var x = context.array([1, -7.5, 0, -15]);
			var y = context.neg(x);
			y.toArray(function(result){
				expect(result).to.deep.equal([-1, 7.5, -0, 15]);
				done();
			});
		})
	})
})
describe('abs', function() {
	furious.connect(function(context) {
		it('Correct result for 2-dimensional array', function(done){
			var x = context.array([1, -7.5, 0, -15]);
			var y = context.abs(x);
			y.toArray(function(result){
				expect(result).to.deep.equal([1, 7.5, 0, 15]);
				done();
			});
		})
	})
})
describe('exp', function() {
	furious.connect(function(context) {
		it('Correct result for 1-dimensional newly created output array', function(done){
			var x = context.array([1, -1, 0]);
			context.exp(x).toArray(function(result) {
				expect(result[0]).to.be.closeTo(Math.exp(1), Math.exp(1) * 2.2204460492503130808472633361816E-16 * 3);
				expect(result[1]).to.be.closeTo(Math.exp(-1), Math.exp(-1) * 2.2204460492503130808472633361816E-16 * 3);
				expect(result[2]).to.equal(1);
				done();
			});
		})
	})
})
describe('log', function() {
	furious.connect(function(context) {
		it('Correct result for 1-dimensional newly created output array', function(done){
			var x = context.array([1, 3, 10]);
			context.log(x).toArray(function(result) {
				expect(result[0]).to.equal(0);
				expect(result[1]).to.be.closeTo(Math.log(3), Math.log(3) * 2.2204460492503130808472633361816E-16 * 3);
				expect(result[2]).to.be.closeTo(Math.log(10), Math.log(10) * 2.2204460492503130808472633361816E-16 * 3);
				done();
			});
		})
	})
})
describe('sqrt', function() {
	furious.connect(function(context) {
		it('Correct result for 1-dimensional newly created output array', function(done){
			var x = context.array([0, 0.25, 1, 9, 10]);
			context.sqrt(x).toArray(function(result) {
				expect(result[0]).to.equal(0);
				expect(result[1]).to.equal(0.5);
				expect(result[2]).to.equal(1);
				expect(result[3]).to.equal(3);
				expect(result[4]).to.be.closeTo(Math.sqrt(10), Math.sqrt(10) * 2.2204460492503130808472633361816E-16 * 3);
				done();
			});
		})
	})
})
describe('square', function() {
	furious.connect(function(context) {
		it('Correct result for 1-dimensional newly created output array', function(done){
			var x = context.array([-2, 0, 0.5, 1, 3]);
			context.square(x).toArray(function(result) {
				expect(result[0]).to.equal(4);
				expect(result[1]).to.equal(0);
				expect(result[2]).to.equal(0.25);
				expect(result[3]).to.equal(1);
				expect(result[4]).to.equal(9);
				done();
			});
		})
	})
})
