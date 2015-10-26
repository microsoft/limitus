var suite = new (require('benchmark')).Suite;
var Limitus = require('./');
var limiter = new Limitus();
limiter.rule('login', { max: 5, interval: 1000 * 60 * 5 });

// add tests
suite
.add('cb', function() {
    limiter.drop('login', { ip: '127.0.0.1' }, function () {});
})
.add('bb', function() {
    limiter.drop('login', { ip: '127.0.0.1' }).catch(function(){});
})
// add listeners
.on('cycle', function(event) {
  console.log(String(event.target));
})
// run async
.run();
