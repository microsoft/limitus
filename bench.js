var suite = new (require('benchmark')).Suite;
var Limitus = require('./');
var limiter = new Limitus();


limiter.extend({
    set: function(key, value, expiration, cb) { cb(); },
    get: function(key, callback) { callback(); }
});
limiter.rule('login1', { max: 99999999, interval: 1000 * 60 * 5, mode: 'continuous' });
limiter.rule('login2', { max: 99999999, interval: 1000 * 60 * 5, mode: 'interval' });

// add tests
suite
.add('callbacks: continuous mode', function() {
    limiter.drop('login1', { ip: '127.0.0.1' }, function () {});
})
.add('promises: continuous mode', function() {
    limiter.drop('login1', { ip: '127.0.0.1' });
})
.add('callbacks: interval mode', function() {
    limiter.drop('login2', { ip: '127.0.0.1' }, function () {});
})
.add('promises: interval mode', function() {
    limiter.drop('login2', { ip: '127.0.0.1' });
})
// add listeners
.on('cycle', function(event) {
  console.log(String(event.target));
})
// run async
.run();
