var suite = new (require('benchmark')).Suite;
var Limitus = require('./');
var limiter = new Limitus();


limiter.extend({
    set: function(key, value, expiration, cb) { cb(); },
    get: function(key, callback) { callback(); }
});
limiter.rule('login', { max: 99999999, interval: 1000 * 60 * 5 });

// add tests
suite
.add('callbacks', function() {
    limiter.drop('login', { ip: '127.0.0.1' }, function () {});
})
.add('promises', function() {
    limiter.drop('login', { ip: '127.0.0.1' });
})
// add listeners
.on('cycle', function(event) {
  console.log(String(event.target));
})
// run async
.run();
