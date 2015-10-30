# Limitus

[![Build Status](https://travis-ci.org/MCProHosting/limitus.svg)](https://travis-ci.org/MCProHosting/limitus) [![Coverage Status](https://coveralls.io/repos/MCProHosting/limitus/badge.svg?branch=master)](https://coveralls.io/r/MCProHosting/limitus?branch=master)

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

### Class: Limitus()

The Limitus class is exported by this module. Options can take the following values:

 * `overflow` - Record the next limit value even after the rate limit was passed - "punishing" clients who continue to request even after being notified of their rate limit exceeding. This is only useful in "continuous" mode. Defaults to `false`.


#### limitus.rule(name, rule)

Creates a new "rule". The name should be a string, the rule should be an object with the `max` number of requests in an `interval`. You can also pass the `mode`, which can be one of the following:

 * `interval` Heaps requests into a stack. If the stack is over the max, requests are denied. At the end of the interval, the stack is reset back to zero.
 * `continuous` Keeps a running "count". Making a request adds one to the count, and the count is decreased at a rate of (interval / max).
 * Any function that accepts a `rule` (an object with a max and interval) and returns an object with the keys:
   * `limited` - boolean, whether this request should be denied.
   * `next` - a string for the next saved value to take.
   * `expiration` - time until it's safe to remove the "next" record from storage.

```
limiter.rule('login', { max: 5, interval: 1000 * 60 * 5 });
```

#### limitus.drop(bucket, identifier[, rule][, calback]) -> Promise

Add a "drop" in the specified bucket. The `bucket` should be a string, such as "login". The `identifier` should be an object for which you want to identify the client. If you previously created a rule matching the name, you don't need to pass the `rule` argument. Otherwise, it is required. Also, if you did create a rule before, it is aliased as `drop[Rule]`.

If you pass a callback, it gets called potentially with an `err`. If no callback is passed, it returns a Promise which is resolved if the limit has not been hit, or is rejected with Limitus.Rejected if the rate limit has been exceeded.
.

```js
limiter.dropLogin({ ip: req.ip })
    .then(function () {
        // do the login
    })
    .catch(Limitus.Rejected, function () {
        req.status(400).json('Too many requests!')
    });

// Or:
limiter.dropLogin({ ip: req.ip }, function (err) { ... });
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
        redis.setex(key, value, Math.ceil(expiration / 1000), callback);
    },
    get: function (key, callback) {
        redis.get(key, callback);
    }
});
```

### Class: Limitus.Rejected

This is the error thrown when a rate limit is exceeded

## Performance

Running on io.js in callback mode, Limitus runs an overhead of around 1.5 μs (0.0015 milliseconds). Promise mode and older Node versions may be slightly slower, so use what you think is best:

```bash
$ node bench.jsnode bench.js
callbacks: continuous mode x 682,714 ops/sec ±2.78% (88 runs sampled)
promises: continuous mode x 517,370 ops/sec ±2.31% (86 runs sampled)
callbacks: interval mode x 639,222 ops/sec ±2.34% (88 runs sampled)
promises: interval mode x 481,796 ops/sec ±2.88% (87 runs sampled)
```

## License

Limitus is copyright 2015 by Beam LLC and distributed under the MIT license.
