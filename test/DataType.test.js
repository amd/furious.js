var numjs = require('../lib/numjs.js');
var expect = require('chai').expect;

describe('DataType', function(){
	describe('f32', function(){
		numjs.connect(function(num) {
			it("should have size 4", function(){
				var dtype = new num.DataType('f32');
				expect(dtype.size).to.equal(4);
			})

			it("should have type 'f32'", function(){
				var dtype = new num.DataType('f32');
				expect(dtype.type).to.equal('f32');
			})
		})
	})
	describe('f64', function(){
		numjs.connect(function(num) {
			it("should have size 8", function(){
				var dtype = new num.DataType('f64');
				expect(dtype.size).to.equal(8);
			})

			it("should have type 'f64'", function(){
				var dtype = new num.DataType('f64');
				expect(dtype.type).to.equal('f64');
			})
		})
	})
})
