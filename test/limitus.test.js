var sinon = require('sinon');
var expect = require('chai').expect;

function noop () {}

describe('limitus', function () {
    var Limitus = require('../');
    var limitus, clock;

    beforeEach(function () {
        clock = sinon.useFakeTimers();
    });
    afterEach(function () {
        clock.restore();
    });

    beforeEach(function () {
        limitus = new Limitus({ cleanInterval: 10 });
    });

    it('extends', function () {
        var spy = sinon.spy();
        limitus.extend({ set: spy });
        limitus.set('foo', 'bar');
        expect(spy.called).to.be.true;
    });

    it('defines rules', function () {
        var spy = sinon.spy();
        limitus.extend({ drop: spy });
        limitus.rule('login', { max: 5, interval: 100 });
        limitus.dropLogin({ foo: 'bar' });
        expect(spy.calledWith('login', { foo: 'bar' })).to.be.true;
    });

    describe('default object store', function () {

        it('gets and sets a value', function (done) {
            limitus.set('foo', 'bar', 10, function (err) {
                expect(err).to.be.undefined;

                limitus.get('foo', function (err, result) {
                    expect(err).to.be.undefined;
                    expect(result).to.equal('bar');
                    done();
                });
            });
        });

        it('expires unchanged values', function (done) {
            limitus.set('foo', 'bar', 10, function (err) {
                expect(err).to.be.undefined;
                clock.tick(20);

                limitus.get('foo', function (err, result) {
                    expect(err).to.be.undefined;
                    expect(result).to.be.undefined;
                    done();
                });
            });
        });

        it('does not expire when changed', function (done) {
            limitus.set('foo', 'bar', 10, function (err) {
                expect(err).to.be.undefined;
                clock.tick(8);
                limitus.set('foo', 'baz', 10, function () {});
                clock.tick(8);

                limitus.get('foo', function (err, result) {
                    expect(err).to.be.undefined;
                    expect(result).to.equal('baz');
                    done();
                });
            });
        });
    });

    describe('drop', function () {
        var mode, emptyKey = 'u5861539';

        beforeEach(function () {
            limitus.rule('login', { max: 5, interval: 100 });
            mode = limitus._mode = sinon.stub();
            sinon.spy(limitus, 'set');
            sinon.spy(limitus, 'get');
        });

        it('throws an error on undefined rule', function () {
            expect(function () {
                limitus.drop('foo', {});
            }).to.throw;
        });

        it('resolves when everything is OK', function (done) {
            mode.returns({ limited: false, next: 'asdf', expiration: 300 });

            limitus.dropLogin({}).then(function () {
                expect(limitus.get.calledWith(emptyKey)).to.be.true;
                expect(mode.calledWith({ max: 5, interval: 100 }, undefined)).to.be.true;
                expect(limitus.set.calledWith(emptyKey, 'asdf', 300)).to.be.true;
                done();
            }).catch(done);
        });

        it('calls back when everything ok', function (done) {
            mode.returns({ limited: false, next: 'asdf', expiration: 300 });

            limitus.dropLogin({}, function (err) {
                expect(err).to.be.undefined;
                expect(limitus.get.calledWith(emptyKey)).to.be.true;
                expect(mode.calledWith({ max: 5, interval: 100 }, undefined)).to.be.true;
                expect(limitus.set.calledWith(emptyKey, 'asdf', 300)).to.be.true;
                done();
            });
        });

        it('rejects when limited and not overflowed', function (done) {
            mode.returns({ limited: true, next: 'asdf', expiration: 300 });

            limitus.dropLogin({}).catch(function (err) {
                expect(err).to.be.an.instanceof(Limitus.Rejected);
                expect(limitus.get.calledWith(emptyKey)).to.be.true;
                expect(mode.calledWith({ max: 5, interval: 100 }, undefined)).to.be.true;
                expect(limitus.set.called).to.be.false;
                done();
            });
        });

        it('calls back when limited and not overflowed', function (done) {
            mode.returns({ limited: true, next: 'asdf', expiration: 300 });

            limitus.dropLogin({}, function (err) {
                expect(err).to.be.an.instanceof(Limitus.Rejected);
                expect(limitus.get.calledWith(emptyKey)).to.be.true;
                expect(mode.calledWith({ max: 5, interval: 100 }, undefined)).to.be.true;
                expect(limitus.set.called).to.be.false;
                done();
            });
        });

        it('sets when overflow is on', function (done) {
            limitus._overflows = true;
            mode.returns({ limited: true, next: 'asdf', expiration: 300 });

            limitus.dropLogin({}).catch(function (err) {
                expect(err).to.be.an.instanceof(Limitus.Rejected);
                expect(limitus.get.calledWith(emptyKey)).to.be.true;
                expect(mode.calledWith({ max: 5, interval: 100 }, undefined)).to.be.true;
                expect(limitus.set.calledWith(emptyKey, 'asdf', 300)).to.be.true;
                done();
            });
        });
    });
});
