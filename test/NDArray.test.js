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
			expect(x.get(0, 0, 0)).to.equal(1);
			expect(x.get(0, 0, 1)).to.equal(2);
			expect(x.get(0, 1, 0)).to.equal(3);
			expect(x.get(0, 1, 1)).to.equal(4);
			expect(x.get(1, 0, 0)).to.equal(5);
			expect(x.get(1, 0, 1)).to.equal(6);
			expect(x.get(1, 1, 0)).to.equal(7);
			expect(x.get(1, 1, 1)).to.equal(8);
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
	describe('add', function(){
		describe('Add array', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = new numjs.array([8, -1, 10]);
				var z = x.add(y);
				expect(z.get(0)).to.equal(9);
				expect(z.get(1)).to.equal(3);
				expect(z.get(2)).to.equal(19);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = new numjs.array([[8, -1], [10, -21]]);
				var z = x.add(y);
				expect(z.get(0, 0)).to.equal(9);
				expect(z.get(0, 1)).to.equal(3);
				expect(z.get(1, 0)).to.equal(19);
				expect(z.get(1, 1)).to.equal(-38);
			})
		})
		describe('Add scalar', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var z = x.add(-7);
				expect(z.get(0)).to.equal(-6);
				expect(z.get(1)).to.equal(-3);
				expect(z.get(2)).to.equal(2);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var z = x.add(42);
				expect(z.get(0, 0)).to.equal(43);
				expect(z.get(0, 1)).to.equal(46);
				expect(z.get(1, 0)).to.equal(51);
				expect(z.get(1, 1)).to.equal(25);
			})
		})
	})
	describe('sub', function(){
		describe('Subtract array', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = new numjs.array([8, -1, 10]);
				var z = x.sub(y);
				expect(z.get(0)).to.equal(-7);
				expect(z.get(1)).to.equal(5);
				expect(z.get(2)).to.equal(-1);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = new numjs.array([[8, -1], [10, -21]]);
				var z = x.sub(y);
				expect(z.get(0, 0)).to.equal(-7);
				expect(z.get(0, 1)).to.equal(5);
				expect(z.get(1, 0)).to.equal(-1);
				expect(z.get(1, 1)).to.equal(4);
			})
		})
		describe('Subtract scalar', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = x.sub(-7);
				var yRef = new numjs.array([8, 11, 16]);
				expect(numjs.abs(y.sub(yRef)).max()).to.equal(0);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = x.sub(42);
				var yRef = new numjs.array([[-41, -38], [-33, -59]]);
				expect(numjs.abs(y.sub(yRef)).max()).to.equal(0);
			})
		})
	})
	describe('mul', function(){
		describe('Multiply by array', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = new numjs.array([8, -1, 10]);
				var z = x.mul(y);
				var zRef = new numjs.array([8, -4, 90]);
				expect(numjs.abs(z.sub(zRef)).max()).to.equal(0);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = new numjs.array([[8, -1], [10, -21]]);
				var z = x.mul(y);
				var zRef = new numjs.array([[8, -4], [90, 357]]);
				expect(numjs.abs(z.sub(zRef)).max()).to.equal(0);
			})
		})
		describe('Multiply by scalar', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = x.mul(-10);
				var yRef = new numjs.array([-10, -40, -90]);
				expect(numjs.abs(y.sub(yRef)).max()).to.equal(0);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = x.mul(10);
				var yRef = new numjs.array([[10, 40], [90, -170]]);
				expect(numjs.abs(y.sub(yRef)).max()).to.equal(0);
			})
		})
	})
	describe('div', function(){
		describe('Divide by array', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var y = new numjs.array([2, -4, 8]);
				var z = x.div(y);
				var zRef = new numjs.array([0.5, -1, 1.125]);
				expect(numjs.abs(z.sub(zRef)).max()).to.equal(0);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = new numjs.array([[-2, 4], [-8, 16]]);
				var z = x.div(y);
				var zRef = new numjs.array([[-0.5, 1], [-1.125, -1.0625]]);
				expect(numjs.abs(z.sub(zRef)).max()).to.equal(0);
			})
		})
		describe('Divide by scalar', function(){
			it('Correct result for 1-dimensional arrays', function(){
				var x = new numjs.array([1, 4, 9]);
				var z = x.div(-2);
				var zRef = new numjs.array([-0.5, -2, -4.5]);
				expect(numjs.abs(z.sub(zRef)).max()).to.equal(0);
			})
			it('Correct result for 2-dimensional arrays', function(){
				var x = new numjs.array([[1, 4], [9, -17]]);
				var y = x.div(-4);
				var yRef = new numjs.array([[-0.25, -1], [-2.25, 4.25]]);
				expect(numjs.abs(y.sub(yRef)).max()).to.equal(0);
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
		var x = new numjs.array([[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]]);
		expect(x.get(0, 0, 0)).to.equal(1);
		expect(x.get(0, 0, 1)).to.equal(2);
		expect(x.get(0, 0, 2)).to.equal(3);
		expect(x.get(0, 1, 0)).to.equal(4);
		expect(x.get(0, 1, 1)).to.equal(5);
		expect(x.get(0, 1, 2)).to.equal(6);
		expect(x.get(1, 0, 0)).to.equal(7);
		expect(x.get(1, 0, 1)).to.equal(8);
		expect(x.get(1, 0, 2)).to.equal(9);
		expect(x.get(1, 1, 0)).to.equal(10);
		expect(x.get(1, 1, 1)).to.equal(11);
		expect(x.get(1, 1, 2)).to.equal(12);
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
		expect(y.get(0)).to.equal(1);
		expect(y.get(1)).to.equal(7.5);
		expect(y.get(2)).to.equal(0);
		expect(y.get(3)).to.equal(15);
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
