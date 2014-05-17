var interpolation_points = 1000;
var a = numjs.min(gdp_growth);
var b = numjs.max(gdp_growth);
var x = numjs.linspace(a, b, interpolation_points);

var h = 0.01;
var Xmx = gdp_growth.div(h).reshape([1, data_points]).repeat(interpolation_points, 0).sub(x.div(h).reshape([interpolation_points, 1]).repeat(data_points, 1));
// Squared Exponential kernel
var K = numjs.exp(Xmx.mul(Xmx).mul(-0.5));
var y = numjs.dot(K, unemployment).div(numjs.sum(K, 1));
