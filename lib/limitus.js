var Bluebird = require('bluebird');
var Rejected = require('./rejected');
var util = require('./util');

function Limitus (options) {
    options = options || {};
    this._overflows = !!options.overflow;

    this._objStore = {};
    this._rules = {};

    options.mode = options.mode || 'continuous';
    if (typeof options.mode === 'string') {
        this._mode = require('./modes/' + options.mode);
    } else {
        this._mode = options.mode;
    }
}

/**
 * Overrides a Limitus instance's values with that of another object.
 * @param  {Object} obj
 * @return {Limitus}
 */
Limitus.prototype.extend = function (obj) {
    for (var key in obj) {
        this[key] = obj[key];
    }

    return this;
};

/**
 * Creates a new limitus rule in advance, and binds an alias.
 * @param  {String} name
 * @param  {Object} rule
 * @return {Limitus}
 */
Limitus.prototype.rule = function (name, rule) {
    this._rules[name] = rule;
    this[util.camel('drop ' + name)] = this.drop.bind(this, name);

    return this;
};

/**
 * Converts an identifier into a key for storage.
 * @param  {Object} ident
 * @return {String}
 */
Limitus.prototype.identToKey = function (ident) {
    return 'u' + util.hash(JSON.stringify(ident));
};

/**
 * Runs a limit. Returns a promise that is rejected if the user
 * is over the limit, or resolved if they're still under it.
 * Persists the changed limit to the dabatase.
 * @param  {String} name
 * @param  {Object} ident
 * @param  {Object=} rule
 * @return {Promise}
 */
Limitus.prototype.drop = function (name, ident, rule) {
    rule = rule || this._rules[name];
    if (!rule) throw new Error('Rule for ' + name + ' not defined.');

    var mode = this._mode;
    var key = this.identToKey(ident);
    var self = this;

    return new Bluebird(function (resolve, reject) {

        // Pull up the data from the storage.
        self.get(key, function (err, value) {
            if (err) return reject(err);

            var data = mode(rule, value);
            // If we exceeded the limit and we don't want to
            // overflow, return the rejection at this point.
            if (data.limited && !self._overflows) {
                return reject(new Rejected());
            }

            // Save the "next" limit in whatever store
            // we're using.
            self.set(key, data.next, data.expiration, function (err) {
                if (err) return reject(err);

                // At this point, throw a rejected error or
                // resolve the promise and move on.
                if (data.limited) {
                    reject(new Rejected());
                } else {
                    resolve();
                }
            });
        });

    });
};

/**
 * Sets a key in some key/value store. Defaults to an internal, simple
 * object store, but you probably want to use Redis or Memcached or
 * something similar in production.
 *
 * @param {String}   key
 * @param {String}   value
 * @param {Number}   expiration Duration in milliseconds
 * @param {Function} callback
 */
Limitus.prototype.set = function (key, value, expiration, callback) {
    this._objStore[key] = value;

    var self = this;
    // If, at the end of the expiration, we have not touched the
    // key again, it should be removed to prevent memory leaks.
    setTimeout(function () {
        if (self._objStore[key] === value) {
            delete self._objStore[key];
        }
    }, expiration);

    callback();
};

/**
 * Returns a value from the store, or undefined.
 * @param  {String}   key
 * @param  {Function} callback
 */
Limitus.prototype.get = function (key, callback) {
    callback(undefined, this._objStore[key]);
};

/**
 * The error that is thrown when we're over the rate limit.
 */
Limitus.Rejected = Rejected;

module.exports = Limitus;
