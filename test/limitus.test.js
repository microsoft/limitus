const sinon = require('sinon');
const { expect } = require('chai');

function noop () {}

describe('limitus', () => {
    const Limitus = require('../');
    let limitus;
    let clock;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });
    afterEach(() => {
        clock.restore();
    });

    beforeEach(() => {
        limitus = new Limitus({ cleanInterval: 10 });
    });

    it('extends', () => {
        var spy = sinon.spy();
        limitus.extend({ set: spy });
        limitus.set('foo', 'bar');
        expect(spy.called).to.be.true;
    });

    it('defines rules', () => {
        var spy = sinon.spy();
        limitus.extend({ drop: spy });
        limitus.rule('login', { max: 5, interval: 100 });
        limitus.dropLogin({ foo: 'bar' });
        expect(spy.calledWith('login', { foo: 'bar' })).to.be.true;
    });

    describe('default object store', () => {

        it('gets and sets a value', done => {
            limitus.set('foo', 'bar', 10, err => {
                expect(err).to.be.undefined;

                limitus.get('foo', (err, result) => {
                    expect(err).to.be.undefined;
                    expect(result).to.equal('bar');
                    done();
                });
            });
        });

        it('expires unchanged values', done => {
            limitus.set('foo', 'bar', 10, err => {
                expect(err).to.be.undefined;
                clock.tick(20);

                limitus.get('foo', (err, result) => {
                    expect(err).to.be.undefined;
                    expect(result).to.be.undefined;
                    done();
                });
            });
        });

        it('does not expire when changed', done => {
            limitus.set('foo', 'bar', 10, err => {
                expect(err).to.be.undefined;
                clock.tick(8);
                limitus.set('foo', 'baz', 10, () => {});
                clock.tick(8);

                limitus.get('foo', (err, result) => {
                    expect(err).to.be.undefined;
                    expect(result).to.equal('baz');
                    done();
                });
            });
        });
    });

    describe('mode selection', () => {
        it('uses given mode', () => {
            const mode = () => {};
            expect(limitus.resolveMode(mode)).to.equal(mode);
        });
        it('defaults to continuous', () => {
            expect(limitus.resolveMode(undefined)).to.equal(require('../lib/modes/continuous'));
        });
        it('overrides and requires', () => {
            expect(limitus.resolveMode('interval')).to.equal(require('../lib/modes/interval'));
        });
    });

    describe('is limited', () => {
        let mode;
        const emptyKey = '5861539';

        beforeEach(() => {
            mode = sinon.stub();
            limitus.rule('login', { max: 5, interval: 100, mode: mode });
            sinon.spy(limitus, 'set');
            sinon.spy(limitus, 'get');
        });

        it('says it\'s not limited when it isn\'t (callback)', done => {
            mode.returns({ limited: false, next: 'asdf', expiration: 300, info: 'foobar' });

            limitus.checkLimited('login', {}, err => {
                expect(err).to.be.undefined;
                done();
            });
        });

        it('says it\'s limited when it is (callback)', done => {
            mode.returns({ limited: true, next: 'asdf', expiration: 300 });

            limitus.checkLimited('login', {}, err => {
                expect(err).not.to.be.undefined;
                done();
            });
        });

        it('says it\'s not limited when it isn\'t (promise)', () => {
            mode.returns({ limited: false, next: 'asdf', expiration: 300, info: 'foobar' });
            return limitus.checkLimited('login', {});
        });

        it('says it\'s limited when it is (promise)', () => {
            mode.returns({ limited: true, next: 'asdf', expiration: 300 });
            return limitus.checkLimited('login', {}).then(() => {
                throw new Error('expected to be limited');
            })
            .catch((e) => {
                if (e instanceof Limitus.Rejected) {
                    return;
                }
                throw e;
                // ok!
            });
        });
    });

    describe('drop', () => {
        let mode;
        const emptyKey = 'login:5861539';

        beforeEach(() => {
            mode = sinon.stub();
            limitus.rule('login', { max: 5, interval: 100, mode: mode });
            sinon.spy(limitus, 'set');
            sinon.spy(limitus, 'get');
        });

        it('calls back with an error on undefined rule', done => {
            limitus.drop('foo', {}, err => {
                expect(err.message).to.match(/foo not defined/);
                done();
            });
        });

        it('rejects with an error on undefined rule', done => {
            limitus.drop('foo', {}).catch(err => {
                expect(err.message).to.match(/foo not defined/);
                done();
            });
        });

        it('resolves when everything is OK', done => {
            mode.returns({ limited: false, next: 'asdf', expiration: 300, info: 'foobar' });

            limitus.dropLogin({}).then(data => {
                expect(limitus.get.calledWith(emptyKey)).to.be.true;
                expect(mode.calledWith({ max: 5, interval: 100, mode: mode }, undefined)).to.be.true;
                expect(limitus.set.calledWith(emptyKey, 'asdf', 300)).to.be.true;
                expect(data).to.equal('foobar');
                done();
            }).catch(done);
        });

        it('calls back when everything ok', done => {
            mode.returns({ limited: false, next: 'asdf', expiration: 300, info: 'foobar' });

            limitus.dropLogin({}, (err, data) => {
                expect(err).to.be.undefined;
                expect(limitus.get.calledWith(emptyKey)).to.be.true;
                expect(mode.calledWith({ max: 5, interval: 100, mode: mode }, undefined)).to.be.true;
                expect(limitus.set.calledWith(emptyKey, 'asdf', 300)).to.be.true;
                expect(data).to.equal('foobar');
                done();
            });
        });

        it('rejects when limited and not overflowed', done => {
            mode.returns({ limited: true, next: 'asdf', expiration: 300 });

            limitus.dropLogin({}).catch(err => {
                expect(err).to.be.an.instanceof(Limitus.Rejected);
                expect(limitus.get.calledWith(emptyKey)).to.be.true;
                expect(mode.calledWith({ max: 5, interval: 100, mode: mode }, undefined)).to.be.true;
                expect(limitus.set.called).to.be.false;
                done();
            });
        });

        it('calls back when limited and not overflowed', done => {
            mode.returns({ limited: true, next: 'asdf', expiration: 300 });

            limitus.dropLogin({}, err => {
                expect(err).to.be.an.instanceof(Limitus.Rejected);
                expect(limitus.get.calledWith(emptyKey)).to.be.true;
                expect(mode.calledWith({ max: 5, interval: 100, mode: mode }, undefined)).to.be.true;
                expect(limitus.set.called).to.be.false;
                done();
            });
        });

        it('sets when overflow is on', done => {
            limitus._overflows = true;
            mode.returns({ limited: true, next: 'asdf', expiration: 300 });

            limitus.dropLogin({}).catch(err => {
                expect(err).to.be.an.instanceof(Limitus.Rejected);
                expect(limitus.get.calledWith(emptyKey)).to.be.true;
                expect(mode.calledWith({ max: 5, interval: 100, mode: mode }, undefined)).to.be.true;
                expect(limitus.set.calledWith(emptyKey, 'asdf', 300)).to.be.true;
                done();
            });
        });
    });
});
