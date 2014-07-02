"use strict";

/**
 * A numerical data type object.
 *
 * @class DataType
 * @constructor
 * @param {String} type - the abbreviated name of the data type. The following names are supported:
 *
 *     <table>
 *         <tr>
 *             <th>Abbreviated Name</th>
 *             <th>Interpretation</th>
 *         </tr>
 *         <tr>
 *             <td>"f32"</td>
 *             <td>Single-precision (32-bit) IEEE-754 floating-point type.</td>
 *         </tr>
 *         <tr>
 *             <td>"f64"</td>
 *             <td>Double-precision (64-bit) IEEE-754 floating-point type.</td>
 *         </tr>
 *     </table>
 *
 */
function DataType(type) {
	if (["f32", "f64"].indexOf(type) >= 0) {
		this.type = type;
		this.size = {"f32": 4, "f64": 8}[type];
		this.epsilon = {"f32": 1.1920928955078125e-7, "f64": 2.2204460492503131e-16}[type];
		this.arrayType = {"f32": Float32Array, "f64": Float64Array}[type];
	} else {
		throw new RangeError("Type " + type + " is not supported");
	}
}

/**
 * Compares two data type objects for equality.
 *
 * @method equals
 * @param {any} other - an object to compare to.
 */
DataType.prototype.equals = function(other) {
	return (other instanceof DataType) && (this.arrayType === other.arrayType);
};

module.exports = DataType;
