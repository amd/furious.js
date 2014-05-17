import numpy
dataset = numpy.genfromtxt("okun.csv", delimiter=',', skiprows=1)
unemployment = dataset[:,1]
gdp_growth = dataset[:,2]
data_points = len(gdp_growth)

import matplotlib
import pylab

interpolation_points = 1000
a, b = numpy.min(gdp_growth), numpy.max(gdp_growth)
x = numpy.linspace(a, b, interpolation_points)

h = 0.01
Xmx = (gdp_growth / h).reshape([1, data_points]).repeat(interpolation_points, axis=0) - (x / h).reshape([interpolation_points, 1]).repeat(data_points, axis=1)
# Squared Exponential kernel
K = numpy.exp(-0.5 * (Xmx*Xmx))
y = numpy.dot(K, unemployment) / numpy.sum(K, axis=1)

matplotlib.pyplot.scatter(gdp_growth * 100, unemployment * 100)
matplotlib.pyplot.plot(x * 100, y * 100)
matplotlib.pyplot.xlabel('GDP Growth, %')
matplotlib.pyplot.ylabel('Unemployment, %')
matplotlib.pyplot.show()
