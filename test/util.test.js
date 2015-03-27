var expect = require('chai').expect;

describe('util', function () {
    var util = require('../lib/util');

    it('hash works I guess', function () {
        expect(util.hash('hello world')).to.equal(2616892229);
        expect(util.hash('world hello')).to.equal(2266517189);
    });

    it('converts to camel case', function () {
        expect(util.camel('hello world')).to.equal('helloWorld');
        expect(util.camel('hello_world')).to.equal('helloWorld');
        expect(util.camel('hello:world')).to.equal('helloWorld');
        expect(util.camel('helloworld')).to.equal('helloworld');
        expect(util.camel('helloWorld')).to.equal('helloWorld');
    });
});
