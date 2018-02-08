var Bluebird = require('bluebird');
var Rejected = require('./rejected');
var modes = require('./modes');
var util = require('./util');

function Limitus (options) {
    options = options || {};
    this._overflows = !!options.overflow;

    this._objStore = {};
    this._rules = {};

    this._cleanInterval = options.cleanInterval || 5000;
    this._cleaning = false;
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
 * @param  {String} name rule name
 * @param  {Object} ident
 * @return {String}
 */
Limitus.prototype.identToKey = function (name, ident) {
    return String(name + ':' + util.hash(JSON.stringify(ident)));
};

/**
 * Wraps a function to correctly resolve its rule and callback.
 * @param  {String}   rule
 * @param  {Function} callback
 * @return {Object}
 */
function loadArgs (fn) {
    return function (name, ident, rule, callback) {
        // Fix args if we were given a callback but not a rule.
        if (!callback && typeof rule === 'function') {
            callback = rule;
            rule = null;
        }

        // Load the rule of none was given.
        rule = rule || this._rules[name];
        if (!rule) {
            var err = new Error('Rule for ' + name + ' not defined.');
            return callback ? callback(err) : Bluebird.reject(err);
        }

        return fn(this, name, ident, rule, callback);
    };
};

/**
 * Runs a limit. Returns a promise that is rejected if the user
 * is over the limit, or resolved if they're still under it.
 * Persists the changed limit to the dabatase.
 * @param  {String} name
 * @param  {Object} ident
 * @param  {Object=} rule
 * @param  {Function} callback
 * @return {Promise}
 */
Limitus.prototype.drop = loadArgs(function (self, name, ident, rule, callback) {
    // If we have a callback, pass it right in to baseDrop.
    // Otherwise, use the promisified version.
    if (callback) {
        return self.baseDrop(name, ident, rule, callback);
    } else {
        return self.baseDropAsync(name, ident, rule);
    }
});

/**
 * Returns whether the requester is limited in the provided
 * parameters without actually incrementing the limit as .drop does.
 * @param  {String}   name
 * @param  {Object}   ident
 * @param  {Object=}  rule
 * @param  {Function} callback
 * @return {Boolean}
 */
Limitus.prototype.checkLimited = loadArgs(function (self, name, ident, rule, callback) {
    var mode = self.resolveMode(rule.mode);
    var key = self.identToKey(name, ident);

    if (callback) {
        return self.baseCheckLimited(rule, key, callback);
    } else {
        return self.baseCheckLimitedAsync(rule, key);
    }
});

/**
 * Base implementation of CheckLimited, for internal user.
 * @param  {Object} rule
 * @param  {Object}   mode
 * @param  {Strign}   key
 * @param  {Function} callback
 * @return {Function}
 */
Limitus.prototype.baseCheckLimited = function (rule, key, callback) {
    var mode = this.resolveMode(rule.mode);
    var self = this;

    // Pull up the data from the storage.
    self.get(key, function (err, value) {
        if (err) return callback(err);

        var data = mode(rule, value);
        // If we exceeded the limit and we don't want to
        // overflow, return the rejection at this point.
        if (data.limited && !self._overflows) {
            return callback(new Rejected(), data);
        } else {
            return callback(undefined, data);
        }
    });
};
Limitus.prototype.baseCheckLimitedAsync = Bluebird.promisify(Limitus.prototype.baseCheckLimited);

/**
 * Returns the mode function for the rule. It is:
 *   - Treated as "continuous" if not defined;
 *   - Requires from "./modes/{mode}.js" if a string;
 *   - Returned directly otherwise.
 *
 * @param  {*} mode
 * @return {Function}
 */
Limitus.prototype.resolveMode = function (mode) {
    mode = mode || 'continuous';

    if (typeof mode === 'string') {
        return modes[mode];
    } else {
        return mode;
    }
};

/**
 * Base, callback-based drop function.
 * @param  {String}   name
 * @param  {Object}   ident
 * @param  {Object=}  rule
 * @param  {Function} callback
 * @return {Promise}
 */
Limitus.prototype.baseDrop = function (name, ident, rule, callback) {
    var key = this.identToKey(name, ident);
    var self = this;

    self.baseCheckLimited(rule, key, function (err, data) {
        if (err) {
            return callback(err, data && data.info);
        }

        // Save the "next" limit in whatever store
        // we're using.
        self.set(key, data.next, data.expiration, function (err) {
            if (err) return callback(err, data.info);

            // At this point, throw a rejected error or
            // resolve the promise and move on.
            if (data.limited) {
                callback(new Rejected(), data.info);
            } else {
                callback(undefined, data.info);
            }
        });
    });
};

Limitus.prototype.baseDropAsync = Bluebird.promisify(Limitus.prototype.baseDrop);

/**
 * Function that scrubs out objstore occasionally to prevent
 * memory leaks. Should only be used with the default implementation.
 */
Limitus.prototype.maintain = function () {
    var oldStore = this._objStore;
    var newStore = this._objStore = {};
    var now = Date.now();

    for (var key in oldStore) {
        if (oldStore[key][1] > now) {
            newStore[key] = oldStore[key];
        }
    }
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
    this._objStore[key] = [value, Date.now() + expiration];

    if (!this._cleaning) {
        this._cleaning = true;
        setInterval(this.maintain.bind(this), this._cleanInterval);
    }

    callback();
};

/**
 * Returns a value from the store, or undefined.
 * @param  {String}   key
 * @param  {Function} callback
 */
Limitus.prototype.get = function (key, callback) {
    var value = this._objStore[key];
    callback(undefined, value ? value[0] : undefined);
};

/**
 * The error that is thrown when we're over the rate limit.
 */
Limitus.Rejected = Rejected;

module.exports = Limitus;
