var util = require('util');


function Rejected () {
    Error.call(this);
    this.message = 'Rate limit exceeded.';
}

util.inherits(Rejected, Error);

module.exports = Rejected;
