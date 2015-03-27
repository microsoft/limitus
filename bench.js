var suite = new (require('benchmark')).Suite;
var data = JSON.stringify({ user: '2', ip: '127.0.0.1' });
var es = require('es-hash');
var msgpack = require('msgpack5')();
var hasher = require('./lib/hasher');
// add tests
suite.add('normal', function() {
  hasher(data);
})
suite.add('other', function() {
  hasher.other(data);
})
// add listeners
.on('cycle', function(event) {
  console.log(String(event.target));
})
.on('complete', function() {
  console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})
// run async
.run();
