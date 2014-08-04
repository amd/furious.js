import numpy
import scipy
import scipy.linalg
import string

datafile = open("forex-libor.csv", "r")
data = datafile.readlines()
# Skip the header line
data = data[1:]
# Remove trailing end-of-line
data = map(string.rstrip, data)
data = map(lambda line: tuple(line.split(',')), data)
fed_data = [(fed_date, usd_eur_rate, usd_3m_libor) for (fed_date, usd_eur_rate, usd_3m_libor, ebr_date, eur_3m_euribor) in data]
ebr_data = [(ebr_date, eur_3m_euribor) for (fed_date, usd_eur_rate, usd_3m_libor, ebr_date, eur_3m_euribor) in data]

def isfloat(text):
	try:
		float(text)
		return True
	except ValueError:
		return False

fed_data = filter(lambda data: isfloat(data[1]) and isfloat(data[2]), fed_data)
ebr_data = filter(lambda data: isfloat(data[1]), ebr_data)

fed_date = zip(*fed_data)[0]
ebr_date = zip(*ebr_data)[0]
dates = sorted(filter(bool, list(set(fed_date) & set(ebr_date))))
usd_eur_rate = numpy.empty(len(dates))
usd_3m_libor = numpy.empty(len(dates))
eur_3m_euribor = numpy.empty(len(dates))
for i, date in enumerate(dates):
	usd_eur_rate[i] = float(zip(*fed_data)[1][fed_date.index(date)])
	usd_3m_libor[i] = float(zip(*fed_data)[2][fed_date.index(date)])
	eur_3m_euribor[i] = float(zip(*ebr_data)[1][ebr_date.index(date)])
usd_eur_3m_spread = usd_3m_libor - eur_3m_euribor

data_points = len(usd_eur_3m_spread)
x = usd_eur_3m_spread.reshape([data_points, 1])
X = numpy.concatenate([numpy.ones([data_points, 1]), x, x*x, x*x*x], axis=1)
y = usd_eur_rate
l = 50
XTX = numpy.dot(X.T, X)
L = numpy.linalg.cholesky(XTX + l * numpy.eye(X.shape[1]))
beta = scipy.linalg.solve_triangular(L, scipy.linalg.solve_triangular(L, numpy.dot(X.T, y), lower=True), trans='T', lower=True)
y_hat = numpy.dot(X, beta)

import matplotlib
import pylab

matplotlib.pyplot.scatter(usd_eur_3m_spread, usd_eur_rate)
matplotlib.pyplot.plot(x, y_hat, color='r', linewidth=1)
matplotlib.pyplot.xlabel('USD/EUR 3M Spread, %')
matplotlib.pyplot.ylabel('USR/EUR FOREX Rate, %')
matplotlib.pyplot.show()
