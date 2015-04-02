var expect = require('chai').expect;
var sinon = require('sinon');

describe('modes', function () {
    var clock;

    beforeEach(function () {
        clock = sinon.useFakeTimers();
    });
    afterEach(function () {
        clock.restore();
    });

    describe('continuous', function () {
        var continuous = require('../lib/modes/continuous');
        var rule = { max: 5, interval: 100 };

        it('works from undefined', function () {
            expect(continuous(rule, undefined)).to.deep.equal({
                limited: false,
                next: '1:0',
                expiration: 100
            });
        });

        it('adds from previous', function () {
            clock.tick(50);

            expect(continuous(rule, '2:0')).to.deep.equal({
                limited: false,
                next: '2.5:50',
                expiration: 250
            });
        });

        it('denies when over limit', function () {
            clock.tick(50);

            expect(continuous(rule, '5:0')).to.deep.equal({
                limited: true,
                next: '5.5:50',
                expiration: 550
            });
        });
    });

    describe('interval', function () {
        var interval = require('../lib/modes/interval');
        var rule = { max: 5, interval: 100 };

        it('works from undefined', function () {
            expect(interval(rule, undefined)).to.deep.equal({
                limited: false,
                next: '1:100',
                expiration: 100
            });
        });

        it('adds from previous', function () {
            expect(interval(rule, '2:100')).to.deep.equal({
                limited: false,
                next: '3:100',
                expiration: 100
            });
        });

        it('resets after interval', function () {
            clock.tick(101);

            expect(interval(rule, '2:100')).to.deep.equal({
                limited: false,
                next: '1:201',
                expiration: 100
            });
        });

        it('denies when over limit', function () {
            clock.tick(50);

            expect(interval(rule, '5:100')).to.deep.equal({
                limited: true,
                next: '6:100',
                expiration: 100
            });
        });
    });
});
