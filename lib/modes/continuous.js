function divide(str, substr) {
    var idx = str.indexOf(substr);
    return [str.slice(0, idx), str.slice(idx + 1)];
}

/**
 * Called to update a rate limit value in continuous mode. This
 * works by using a concat'ed value of the last request time, and
 * a count. On every request, the count is decremented based
 * on the current time and the last request, in a linear fashion
 * (and we then add 1 for this request), and the last
 * request time is updated;
 *
 * @param  {Object} rule
 * @param  {String} value
 * @return {Object}
 */
module.exports = function (rule, value) {
    var parts = divide(value || '0:0', ':');
    var count = +parts[0];
    var last = +parts[1];

    count = Math.max(0, count - (Date.now() - last) / rule.interval) + 1;
    last = Date.now();

    return {
        limited: count > rule.max,
        next: count + ':' + last,
        expiration: Math.ceil(count * rule.interval)
    };
};
