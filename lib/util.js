var util = module.exports = {};

var letter = /[a-z]/i;

/**
 * Fast djb2-like hashing implementation.
 * @param  {String} str
 * @return {Number}
 */
util.hash = function (str) {
    var hash = 5381, i = str.length;

    while (i) {
        hash = (hash * 33) ^ str.charCodeAt(--i);
    }

    return hash >>> 0;
};

/**
 * Converts a string to camel case.
 * @param  {String} str
 * @return {String}
 */
util.camel = function (str) {
    var out = '', upper = false;

    for (var i = 0; i < str.length; i++) {
        if (letter.test(str[i])) {
            out += upper ? str[i].toUpperCase() : str[i];
            upper = false;
        } else {
            upper = true;
        }
    }

    return out;
};
