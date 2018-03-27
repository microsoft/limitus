'use strict';

const Rejected = require('./rejected');
const modes = require('./modes');
const util = require('./util');
const { promisify } = require('util');

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
            const err = new Error('Rule for ' + name + ' not defined.');
            return callback ? callback(err) : Promise.reject(err);
        }

        return fn.call(this, name, ident, rule, callback);
    };
};

class Limitus {
    constructor (options) {
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
    extend (obj) {
        for (let key in obj) {
            this[key] = obj[key];
        }

        return this;
    }

    /**
     * Creates a new limitus rule in advance, and binds an alias.
     * @param  {String} name
     * @param  {Object} rule
     * @return {Limitus}
     */
    rule (name, rule) {
        this._rules[name] = rule;
        this[util.camel('drop ' + name)] = this.drop.bind(this, name);

        return this;
    }

    /**
     * Converts an identifier into a key for storage.
     * @param  {String} name rule name
     * @param  {Object} ident
     * @return {String}
     */
    identToKey (name, ident) {
        return String(name + ':' + util.hash(JSON.stringify(ident)));
    }
    /**
     * Base implementation of CheckLimited, for internal user.
     * @param  {Object} rule
     * @param  {Object}   mode
     * @param  {Strign}   key
     * @param  {Function} callback
     * @return {Function}
     */
    baseCheckLimited (rule, key, callback) {
        const mode = this.resolveMode(rule.mode);

        // Pull up the data from the storage.
        this.get(key, (err, value) => {
            if (err) return callback(err);

            const data = mode(rule, value);
            // If we exceeded the limit and we don't want to
            // overflow, return the rejection at this point.
            if (data.limited && !this._overflows) {
                return callback(new Rejected(data.info), data);
            }
            return callback(undefined, data);
        });
    }

    /**
     * Returns the mode function for the rule. It is:
     *   - Treated as "continuous" if not defined;
     *   - Requires from "./modes/{mode}.js" if a string;
     *   - Returned directly otherwise.
     *
     * @param  {*} mode
     * @return {Function}
     */
    resolveMode (mode) {
        mode = mode || 'continuous';

        if (typeof mode === 'string') {
            return modes[mode];
        }
        return mode;
    }

    /**
     * Base, callback-based drop function.
     * @param  {String}   name
     * @param  {Object}   ident
     * @param  {Object=}  rule
     * @param  {Function} callback
     * @return {Promise}
     */
    baseDrop (name, ident, rule, callback) {
        const key = this.identToKey(name, ident);

        this.baseCheckLimited(rule, key, (err, data) => {
            if (err) {
                return callback(err, data && data.info);
            }

            // Save the "next" limit in whatever store
            // we're using.
            this.set(key, data.next, data.expiration, (err) => {
                if (err) return callback(err, data.info);

                // At this point, throw a rejected error or
                // resolve the promise and move on.
                if (data.limited) {
                    callback(new Rejected(data.info), data.info);
                } else {
                    callback(undefined, data.info);
                }
            });
        });
    }

    /**
     * Function that scrubs out objstore occasionally to prevent
     * memory leaks. Should only be used with the default implementation.
     */
    maintain () {
        const oldStore = this._objStore;
        const newStore = this._objStore = {};
        const now = Date.now();

        for (let key in oldStore) {
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
    set (key, value, expiration, callback) {
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
    get (key, callback) {
        const value = this._objStore[key];
        callback(undefined, value ? value[0] : undefined);
    }
}

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
Limitus.prototype.drop = loadArgs(function (name, ident, rule, callback) {
    // If we have a callback, pass it right in to baseDrop.
    // Otherwise, use the promisified version.
    if (callback) {
        return this.baseDrop(name, ident, rule, callback);
    }
    return this.baseDropAsync(name, ident, rule);
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
Limitus.prototype.checkLimited = loadArgs(function (name, ident, rule, callback) {
    const mode = this.resolveMode(rule.mode);
    const key = this.identToKey(name, ident);

    if (callback) {
        return this.baseCheckLimited(rule, key, callback);
    }
   return this.baseCheckLimitedAsync(rule, key);
});

Limitus.prototype.baseCheckLimitedAsync = promisify(Limitus.prototype.baseCheckLimited);
Limitus.prototype.baseDropAsync = promisify(Limitus.prototype.baseDrop);

/**
 * The error that is thrown when we're over the rate limit.
 */
Limitus.Rejected = Rejected;

module.exports = Limitus;
