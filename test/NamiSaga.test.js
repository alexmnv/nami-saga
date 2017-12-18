/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))

const NamiSaga = require('../src/NamiSaga')
const namiLib = require('nami')

describe('#runSaga', () => {
  let namiSaga

  beforeEach(() => {
    namiSaga = new NamiSaga({})
  })

  it('should return a promise', () => {
    let p = namiSaga.runSaga(function * () {})
    expect(p).to.be.a('promise')
  })

  describe('returned promise', () => {
    it('should resolve with saga\'s result', async () => {
      let saga = function * () { return 123 }

      let result = await namiSaga.runSaga(saga)

      expect(result).to.be.equal(123)
    })

    describe('when saga fails', () => {
      it('should reject with saga\'s error', () => {
        let err = new Error()
        let saga = function * () { throw err }

        let promise = namiSaga.runSaga(saga)

        return expect(promise).to.be.rejectedWith(err)
      })
    })
  })
})

describe('#createSagaIO', () => {
  let namiSaga
  beforeEach(() => {
    namiSaga = new NamiSaga({})
    namiSaga.sagaIO = namiSaga.createSagaIO()
  })

  it('should return Saga IO interface', () => {
    expect(namiSaga.sagaIO).to.have.all.keys('subscribe', 'dispatch', 'getState')
    expect(namiSaga.sagaIO.subscribe).to.be.a('function')
    expect(namiSaga.sagaIO.dispatch).to.be.a('function')
    expect(namiSaga.sagaIO.getState).to.be.a('function')
  })

  describe('sagaIO.subscribe', () => {
    it('should subscribe to all events', () => {
      sinon.spy(namiSaga, 'on')
      namiSaga.sagaIO.subscribe(sinon.spy())

      expect(namiSaga.on).to.have.been.calledWith('*', sinon.match.func)
    })

    it('should return unsubscribe function', () => {
      sinon.spy(namiSaga, 'removeListener')
      let unsubscribe = namiSaga.sagaIO.subscribe(sinon.spy())

      unsubscribe()

      expect(namiSaga.removeListener).to.have.been.calledOnce
    })

    it('should call subscriber with `Action` format ({type, event})', () => {
      let subscriber = sinon.spy()
      namiSaga.sagaIO.subscribe(subscriber)
      namiSaga.emit('Foo', 42)
      expect(subscriber).to.have.been.calledWith({type: 'Foo', event: 42})
    })
  })

  describe('sagaIO.dispatch', () => {
    it('should accept `Action` as argument', () => {
      let dispatchFunc = (action) => () => {
        namiSaga.sagaIO.dispatch(action)
      }

      expect(dispatchFunc({type: 'someValidEvent'})).to.not.throw
      expect(dispatchFunc({someWrongFormat: 'a'})).to.throw
    })

    it('should emit an event', () => {
      sinon.spy(namiSaga, 'emit')
      namiSaga.sagaIO.dispatch({type: 'someEvent'})
      expect(namiSaga.emit).to.have.been.called
    })

    describe('emitted event', () => {
      it('should have name equal to `action.type`', () => {
        sinon.spy(namiSaga, 'emit')
        namiSaga.sagaIO.dispatch({type: 'foo'})

        let firstArg = namiSaga.emit.getCall(0).args[0]
        expect(firstArg).to.be.equal('foo')
      })

      it('should have action itself as `event` property', () => {
        sinon.spy(namiSaga, 'emit')
        namiSaga.sagaIO.dispatch({type: 'foo', data: 42})

        let secondArg = namiSaga.emit.getCall(0).args[1]
        expect(secondArg).to.be.deep.equal({type: 'foo', data: 42})
      })
    })
  })
})

describe('#emit', () => {
  it('should duplicate emitted event with `*` event name', () => {
    let namiSaga = new NamiSaga({})
    let listenerAll = sinon.spy()
    let listenerFoo = sinon.spy()
    namiSaga.on('*', listenerAll)
    namiSaga.on('fooEvent', listenerFoo)

    namiSaga.emit('fooEvent', 42)

    expect(listenerAll).to.have.been.calledOnce.calledWith('fooEvent', 42)
    expect(listenerFoo).to.have.been.calledOnce.calledWith(42)
  })
})

describe('#send', () => {
  let namiSaga

  beforeEach(() => {
    sinon.stub(namiLib.Nami.prototype, 'send')
    namiSaga = new NamiSaga({})
  })

  afterEach(() => {
    namiLib.Nami.prototype.send.restore()
  })

  describe('when `callback` argument is omitted', () => {
    it('should return a promise', () => {
      expect(namiSaga.send({})).to.be.a('promise')
    })

    it('should resolve the promise when `callback` is called', async () => {
      let superSend = namiLib.Nami.prototype.send
      let promise = namiSaga.send({})

      expect(superSend).to.have.been.calledOnce
      let callback = superSend.getCall(0).args[1]

      callback('sendResult')
      expect(await promise).to.be.equal('sendResult')
    })
  })
})
