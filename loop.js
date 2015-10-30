var Limitus = require('./');
var limiter = new Limitus();
limiter.rule('login', { max: 1000000, interval: 1000 * 60 * 5 });

for (var i = 0; i < 100000; i++) {
    limiter.drop('login', { ip: '127.0.0.1' }, function () {});
}
process.exit(0);
