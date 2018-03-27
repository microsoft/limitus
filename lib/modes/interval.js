/**
 * Called to update a rate limit value in bucket mode. Heaps
 * everything into a bucket which is emptied after the interval.
 *
 * @param  {Object} rule
 * @param  {String} value
 * @return {Object}
 */
module.exports = function (rule, value) {
    const parts = (value || '0:0').split(':', 2);
    let count = +parts[0];
    let bucket = +parts[1];
    const now = Date.now();

    if (now >= bucket) {
        count = 0;
        bucket = now + rule.interval;
    }

    return {
        limited: ++count > rule.max,
        next: count + ':' + bucket,
        expiration: rule.interval,
        info: { count, bucket }
    };
};
