/**
 * Called to update a rate limit value in bucket mode. Heaps
 * everything into a bucket which is emptied after the interval.
 *
 * @param  {Object} rule
 * @param  {String} value
 * @return {Object}
 */
module.exports = function (rule, value) {
    var parts = (value || '0:0').split(':', 2);
    var count = +parts[0];
    var bucket = +parts[1];
    var now = Date.now();

    if (now >= bucket) {
        count = 0;
        bucket = now + rule.interval;
    }

    return {
        limited: ++count > rule.max,
        next: count + ':' + bucket,
        expiration: rule.interval
    };
};
