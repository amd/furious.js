exports.isNumber = function(n) {
	return n === +n;
}

exports.isReal = function(n) {
	return (n === +n) && (isFinite(n));
}

exports.isInt = function(n) {
	return (n === +n) && (n === (n|0));
}

exports.isPositiveInt = function(n) {
	return (n === +n) && (n === (n|0)) && (n > 0);
}

exports.isNonNegativeInt = function(n) {
	return (n === +n) && (n === (n|0)) && (n >= 0);
}

exports.isArray = function(list) {
	return list instanceof Array;
}

exports.isIntArray = function(list) {
	if (exports.isArray(list)) {
		for (var i = 0; i < list.length; i++) {
			if (!exports.isInt(list[i])) {
				return false;
			}
		}
		return true;
	} else {
		return false;
	}
}

exports.isPositiveIntArray = function(list) {
	if (exports.isArray(list)) {
		for (var i = 0; i < list.length; i++) {
			if (!exports.isPositiveInt(list[i])) {
				return false;
			}
		}
		return true;
	} else {
		return false;
	}
}

exports.asIntArray = function (list) {
	if (exports.isInt(list)) {
		return [list];
	} else if (exports.isIntArray(list)) {
		return list;
	} else {
		throw new TypeError(list + " can not be converted to integer array");
	}
}
