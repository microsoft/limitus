# Limitus

[![Build Status](https://travis-ci.org/MCProHosting/limitus.svg)](https://travis-ci.org/MCProHosting/limitus) [![Coverage Status](https://coveralls.io/repos/MCProHosting/limitus/badge.svg)](https://coveralls.io/r/MCProHosting/limitus)

Limitus is a (very) fast solution to rate limiting your application. It is agnostic as far as persistence goes - all you need to run it is a key value store (see examples for implementations using a plain hashmap and Redis).

## Example

```js
var Limitus = require('limitus');
var limiter = new Limitus();

/* create a "login" bucket */
limiter.rule('login', { max: 5, interval: 1000 * 60 * 5 });

/* in your application... */
app.post('/login', function (req, res) {

    limiter.dropLogin({ ip: req.ip })
        .then(function () {
            // do the login
        })
        .catch(Limitus.Rejected, function () {
            req.status(400).json('Too many requests!')
        });
});
```

## Usage

### Class: Limitus(options)

The Limitus class is exported by this module. Options can take the following values:

 * `mode` - Mode may be either one of "interval" or "continuous". Interval mode pools requests in a time interval, and at the end of the interval the bucket is reset. Defaults to `continuous`.
 * `overflow` - In continuous mode, record requests even after the rate limit was passed - punishing clients who continue to request even after being notified of their rate limit exceeding. Defaults to `false`.

#### limitus.rule(name, rule)

Creates a new "rule". The name should be a string, the rule should be an object with the `max` number of requests in an `interval`.

```
limiter.rule('login', { max: 5, interval: 1000 * 60 * 5 });
```

#### limitus.drop(bucket, identifier[, rule]) -> Promise

Add a "drop" in the specified bucket. The `bucket` should be a string, such as "login". The `identifier` should be an object for which you want to identify the client. It returns a Promise which is resolved if the limit has not been hit, or is rejected with Limitus. Rejected if the rate limit has been exceeded.

If you previously created a rule matching the name, you don't need to pass the `rule` argument. Otherwise, it is required. Also, if you did create a rule before, it is ailiased as `dropRule`.

```js
limiter.dropLogin({ ip: req.ip })
    .then(function () {
        // do the login
    })
    .catch(Limitus.Rejected, function () {
        req.status(400).json('Too many requests!')
    });

// If you did not specify a rule:
limiter.drop('login', { ip: req.ip }, { max: 5, interval: 1000 * 60 * 5 }); // -> Promise
// If you already did, it's aliased:
limiter.drop('login', { ip: req.ip }); // -> Promise
limiter.dropLogin({ ip: req.ip }); // -> Promise
```

#### limitus.extend(store)

Extends the limitus instance, mostly useful for settings the store. The `store` should be an object that provides following methods:

 * `.set(key, value, expiration, callback)` is used to save data to the store. Key and values are strings, the expiration is given in milliseconds. The callback should be called with no arguments on success, or a single error argument on failure.
 * `.get(key, callback)` should return a previously stored key (or null/undefined) as the second argument in the callback, or pass a single error on failure.

```js
limiter.extend({
    set: function (key, value, expiration, callback) {
        redis.setex(key, value, expiration / 1000, callback);
    },
    get: function (key, callback) {
        redis.get(key, callback)l
    }
});
```

### Class: Limitus.Rejected

This is the error thrown when a rate limit is exceeded
