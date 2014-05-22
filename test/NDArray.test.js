describe('NDArray', function(){
	describe('constructor', function(){
		it('No error with integer shape', function(){
			expect(function (){new numjs.NDArray(100)}).to.not.throw(Error);
		})
		it('No error with integer array shape', function(){
			expect(function (){new numjs.NDArray([100])}).to.not.throw(Error);
		})
		it('No error with multi-dimensional integer array shape', function(){
			expect(function (){new numjs.NDArray([2, 5, 1])}).to.not.throw(Error);
		})
		it('No error with explicit F64 data type', function(){
			expect(function (){new numjs.NDArray([2, 5, 1], numjs.DataType('f64'))}).to.not.throw(Error);
		})
		it('No error with F32 data type', function(){
			expect(function (){new numjs.NDArray([2, 5, 1], numjs.DataType('f32'))}).to.not.throw(Error);
		})
	})
	describe('length', function(){
		it('Equals to the number passed in constructor', function(){
			expect((new numjs.NDArray(42)).length).to.equal(42);
		})
		it('Equals to the number passed in constructor as an array', function(){
			expect((new numjs.NDArray([42])).length).to.equal(42);
		})
		it('Equals to the product of dimensions passed in constructor', function(){
			expect((new numjs.NDArray([2, 5, 3])).length).to.equal(30);
		})
	})
	describe('reshape', function(){
		it('Preserves length', function(){
			var x = new numjs.NDArray([7,5,3]);
			var y = x.reshape([21,5]);
			expect(y.length).to.equal(x.length);
		})
		it('Changes shape', function(){
			var x = new numjs.NDArray([7,5,3]);
			var y = x.reshape([21,5]);
			expect(y.shape).to.deep.equal([21,5]);
		})
		it('Rearranges data', function(){
			var x = numjs.linspace(1, 8, 8).reshape([2, 2, 2]);
			expect(x.toArray()).to.deep.equal([[[ 1.,  2.], [ 3.,  4.]],
			                                   [[ 5.,  6.], [ 7.,  8.]]]);
		})
	})
	describe('set', function(){
		it('No error with 1D array', function(){
			var x = new numjs.NDArray(2);
			expect(function (){x.set([0], 1)}).to.not.throw(Error);
			expect(function (){x.set([1], -1)}).to.not.throw(Error);
		})
		it('No error with multi-dimensional array', function(){
			var x = new numjs.NDArray([2,2,2]);
			expect(function (){x.set([0, 0, 0], 1)}).to.not.throw(Error);
			expect(function (){x.set([0, 0, 1], 2)}).to.not.throw(Error);
			expect(function (){x.set([0, 1, 0], 3)}).to.not.throw(Error);
			expect(function (){x.set([0, 1, 1], 4)}).to.not.throw(Error);
			expect(function (){x.set([1, 0, 0], 5)}).to.not.throw(Error);
			expect(function (){x.set([1, 0, 1], 6)}).to.not.throw(Error);
			expect(function (){x.set([1, 1, 0], 7)}).to.not.throw(Error);
			expect(function (){x.set([1, 1, 1], 8)}).to.not.throw(Error);
		})
	})
	describe('get', function(){
		it('Can be used with a single index', function(){
			var x = new numjs.NDArray(2);
			x.set([0], 42);
			x.set([1], 10);
			expect(x.get(1)).to.equal(10);
		})
		it('Can be used with a multiple indices', function(){
			var x = new numjs.NDArray([2,2,2]);
			x.set([0, 0, 0], 1);
			x.set([0, 0, 1], 2);
			x.set([0, 1, 0], 3);
			x.set([0, 1, 1], 4);
			x.set([1, 0, 0], 5);
			x.set([1, 0, 1], 6);
			x.set([1, 1, 0], 7);
			x.set([1, 1, 1], 8);
		})
		it('Can be used with an array of indices', function(){
			var x = new numjs.NDArray([2,2,2]);
			x.set([0, 0, 0], 1);
			x.set([0, 0, 1], 2);
			x.set([0, 1, 0], 3);
			x.set([0, 1, 1], 4);
			x.set([1, 0, 0], 5);
			x.set([1, 0, 1], 6);
			x.set([1, 1, 0], 7);
			x.set([1, 1, 1], 8);
			expect(x.get([1, 1, 0])).to.equal(7);
		})
	})
	describe('toArray', function(){
		it('Works with 1-dimensional array', function(){
			var x = numjs.array([42, 10]);
			expect(x.toArray()).to.deep.equal([42, 10]);
		})
		it('Works with 2-dimensional array', function(){
			var array = [[16,  2,  3, 13,  5],
			             [11, 10,  8,  9,  7],
			             [ 6, 12,  4, 14, 15]];
			var x = numjs.array(array);
			expect(x.toArray()).to.deep.equal(array);
		})
	})
	describe('add', function(){
		describe('Add array', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = new numjs.array([8, -1, 10]);
				var z = x.add(y);
				expect(z.toArray()).to.deep.equal([9, 3, 19]);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = new numjs.array([[8, -1], [10, -21]]);
				var z = x.add(y);
				expect(z.toArray()).to.deep.equal([[9, 3], [19, -38]]);
			})
		})
		describe('Add scalar', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var z = x.add(-7);
				expect(z.toArray()).to.deep.equal([-6, -3, 2]);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var z = x.add(42);
				expect(z.toArray()).to.deep.equal([[43, 46], [51, 25]]);
			})
		})
	})
	describe('sub', function(){
		describe('Subtract array', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = new numjs.array([8, -1, 10]);
				var z = x.sub(y);
				expect(z.toArray()).to.deep.equal([-7, 5, -1]);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = new numjs.array([[8, -1], [10, -21]]);
				var z = x.sub(y);
				expect(z.toArray()).to.deep.equal([[-7, 5], [-1, 4]]);
			})
		})
		describe('Subtract scalar', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = x.sub(-7);
				expect(y.toArray()).to.deep.equal([8, 11, 16]);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = x.sub(42);
				expect(y.toArray()).to.deep.equal([[-41, -38], [-33, -59]]);
			})
		})
	})
	describe('mul', function(){
		describe('Multiply by array', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = new numjs.array([8, -1, 10]);
				var z = x.mul(y);
				expect(z.toArray()).to.deep.equal([8, -4, 90]);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = new numjs.array([[8, -1], [10, -21]]);
				var z = x.mul(y);
				expect(z.toArray()).to.deep.equal([[8, -4], [90, 357]]);
			})
		})
		describe('Multiply by scalar', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = x.mul(-10);
				expect(y.toArray()).to.deep.equal([-10, -40, -90]);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = x.mul(10);
				expect(y.toArray()).to.deep.equal([[10, 40], [90, -170]]);
			})
		})
	})
	describe('div', function(){
		describe('Divide by array', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = new numjs.array([2, -4, 8]);
				var z = x.div(y);
				expect(z.toArray()).to.deep.equal([0.5, -1, 1.125]);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = new numjs.array([[-2, 4], [-8, 16]]);
				var z = x.div(y);
				expect(z.toArray()).to.deep.equal([[-0.5, 1], [-1.125, -1.0625]]);
			})
		})
		describe('Divide by scalar', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var z = x.div(-2);
				expect(z.toArray()).to.deep.equal([-0.5, -2, -4.5]);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = x.div(-4);
				expect(y.toArray()).to.deep.equal([[-0.25, -1], [-2.25, 4.25]]);
			})
		})
	})
	describe('min', function(){
		describe('All elements', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				expect(x.min()).to.equal(1);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[-2, 4], [-8, 16]]);
				expect(x.min()).to.equal(-8);
			})
		})
		describe('Along an axis', function(){
			it('Correct shape for 3-dimensional arrays', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]);
				expect(x.min(0).shape).to.deep.equal([3, 4]);
				expect(x.min(1).shape).to.deep.equal([2, 4]);
				expect(x.min(2).shape).to.deep.equal([2, 3]);
			})
			it('Correct result for 3-dimensional arrays, axis 0', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]).min(0);
				expect(x.toArray()).to.deep.equal([[ 1,  2,  3,  4],
				                                   [ 5,  6,  7,  8],
				                                   [ 9, 10, 11, 12]])
			})
			it('Correct result for 3-dimensional arrays, axis 1', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]).min(1);
				expect(x.toArray()).to.deep.equal([[  1,  2,  3,  4],
				                                   [ 13, 14, 15, 16]]);
			})
			it('Correct result for 3-dimensional arrays, axis 2', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]).min(2);
				expect(x.toArray()).to.deep.equal([[  1,  5,  9],
				                                   [ 13, 17, 21]]);
			})
		})
	})
	describe('max', function(){
		describe('All elements', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				expect(x.max()).to.equal(9);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[-2, 4], [-8, 16]]);
				expect(x.max()).to.equal(16);
			})
		})
		describe('Along an axis', function(){
			it('Correct shape for 3-dimensional arrays', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]);
				expect(x.max(0).shape).to.deep.equal([3, 4]);
				expect(x.max(1).shape).to.deep.equal([2, 4]);
				expect(x.max(2).shape).to.deep.equal([2, 3]);
			})
			it('Correct result for 3-dimensional arrays, axis 0', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]).max(0);
				expect(x.toArray()).to.deep.equal([[ 13, 14, 15, 16],
				                                   [ 17, 18, 19, 20],
				                                   [ 21, 22, 23, 24]])
			})
			it('Correct result for 3-dimensional arrays, axis 1', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]).max(1);
				expect(x.toArray()).to.deep.equal([[  9, 10, 11, 12],
				                                   [ 21, 22, 23, 24]]);
			})
			it('Correct result for 3-dimensional arrays, axis 2', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]).max(2);
				expect(x.toArray()).to.deep.equal([[  4,  8, 12],
				                                   [ 16, 20, 24]]);
			})
		})
	})
	describe('sum', function(){
		describe('All elements', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				expect(x.sum()).to.equal(14);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[-2, 4], [-8, 16]]);
				expect(x.sum()).to.equal(10);
			})
		})
		describe('Along an axis', function(){
			it('Correct shape for 3-dimensional arrays', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]);
				expect(x.sum(0).shape).to.deep.equal([3, 4]);
				expect(x.sum(1).shape).to.deep.equal([2, 4]);
				expect(x.sum(2).shape).to.deep.equal([2, 3]);
			})
			it('Correct result for 3-dimensional arrays, axis 0', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]).sum(0);
				expect(x.toArray()).to.deep.equal([[ 14, 16, 18, 20],
				                                  [ 22, 24, 26, 28],
				                                  [ 30, 32, 34, 36]])
			})
			it('Correct result for 3-dimensional arrays, axis 1', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]).sum(1);
				expect(x.toArray()).to.deep.equal([[ 15,  18,  21,  24],
				                                   [ 51,  54,  57,  60]]);
			})
			it('Correct result for 3-dimensional arrays, axis 2', function(){
				var x = numjs.linspace(1, 24, 24).reshape([2, 3, 4]).sum(2);
				expect(x.toArray()).to.deep.equal([[ 10,  26,  42],
				                                   [ 58,  74,  90]]);
			})
		})
	})
	describe('dot', function(){
		it('Correct shape for 2-dimensional arrays', function(){
			var x = new numjs.NDArray([2, 5]);
			var y = new numjs.NDArray([5, 11]);
			expect(numjs.dot(x, y).shape).to.deep.equal([2, 11]);
		})
		it('Correct shape for 3-dimensional arrays', function(){
			var x = new numjs.NDArray([2, 3, 4]);
			var y = new numjs.NDArray([7, 4, 8]);
			expect(numjs.dot(x, y).shape).to.deep.equal([2, 3, 7, 8]);
		})
		it('Correct shape for 4-dimensional arrays', function(){
			var x = new numjs.NDArray([2, 3, 4, 5]);
			var y = new numjs.NDArray([6, 7, 5, 8]);
			expect(numjs.dot(x, y).shape).to.deep.equal([2, 3, 4, 6, 7, 8]);
		})
		it('Correct value for 1-dimensional arrays', function(){
			var x = numjs.array([2, 5]);
			var y = numjs.array([5, 11]);
			expect(numjs.dot(x, y).toArray()).to.deep.equal([65]);
		})
		it('Correct value for 2-dimensional arrays', function(){
			var x = numjs.array([[64,  2,  3],
			                     [61, 60,  6]]);
			var y = numjs.array([[92, 99,  1,  8, 15],
			                     [67, 74, 51, 58, 40],
			                     [98, 80,  7, 14, 16]]);
			var z = numjs.dot(x, y);
			expect(z.toArray()).to.deep.equal([[  6316,  6724,  187,  670, 1088],
			                                   [ 10220, 10959, 3163, 4052, 3411]]);
		})
	})
})
describe('array', function(){
	it('Matches the length of the provided array', function(){
		expect((new numjs.array([0, 1])).length).to.equal(2);
		expect((new numjs.array([[0, 1], [2,3], [3,4]])).length).to.equal(6);
	})
	it('Matches the shape of the provided array', function(){
		expect((new numjs.array([0, 1])).shape).to.deep.equal([2]);
		expect((new numjs.array([[0, 1], [2,3], [3,4]])).shape).to.deep.equal([3, 2]);
		expect((new numjs.array([[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]])).shape).to.deep.equal([2, 2, 3]);
	})
	it('Matches the data of the provided array', function(){
		var array = [[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]];
		var x = new numjs.array(array);
		expect(x.toArray()).to.deep.equal(array);
	})
})
describe('linspace', function(){
	it('Has length of 50 with default arguments', function(){
		expect((new numjs.linspace(0, 1)).length).to.equal(50);
	})
	it('Has the specified number of samples', function(){
		expect((new numjs.linspace(0, 1, 243)).length).to.equal(243);
	})
	it('Has expected values', function(){
		var start = 50;
		var stop = 99;
		var x = numjs.linspace(start, stop);
		for (var i = 0; i < x.length; i++) {
			expect(x.get(i)).to.equal(start+i);
		}
	})
	describe('with includeStop === false', function(){
		it('Has the specified number of samples', function(){
			expect((new numjs.linspace(0, 1, 243, false)).length).to.equal(243);
		})
		it('Does not contain the right endpoint', function(){
			var x = numjs.linspace(-1, 1, 1000, false);
			expect(x.get(x.length - 1)).to.not.equal(1);
		})
	})
})
describe('abs', function() {
	it('Correct result for 2-dimensional array', function(){
		var x = new numjs.array([1, -7.5, 0, -15]);
		var y = numjs.abs(x);
		expect(y.toArray()).to.deep.equal([1, 7.5, 0, 15]);
	})
})
describe('exp', function() {
	it('Correct result for 1-dimensional newly created output array', function(){
		var x = new numjs.array([1, -1, 0]);
		var y = numjs.exp(x);
		expect(y.get(0)).to.be.closeTo(Math.exp(1), Math.exp(1) * Number.EPSILON * 3);
		expect(y.get(1)).to.be.closeTo(Math.exp(-1), Math.exp(-1) * Number.EPSILON * 3);
		expect(y.get(2)).to.equal(1);
	})
})
describe('log', function() {
	it('Correct result for 1-dimensional newly created output array', function(){
		var x = new numjs.array([1, 3, 10]);
		var y = numjs.log(x);
		expect(y.get(0)).to.equal(0);
		expect(y.get(1)).to.be.closeTo(Math.log(3), Math.log(3) * Number.EPSILON * 3);
		expect(y.get(2)).to.be.closeTo(Math.log(10), Math.log(10) * Number.EPSILON * 3);
	})
})
