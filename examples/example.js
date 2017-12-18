const namiLib = require('nami')
const NamiSaga = require('../src/NamiSaga')
const { take, cancel, call, fork, race } = require('redux-saga/effects')

class NamiSagaExample extends NamiSaga {
  /**
   * Open connection
   *
   * @returns {Promise}
   */
  open () {
    return this.runSaga(this._sagaOpen.bind(this))
  }

  /**
   * Make a call and get the results (startTime, answered, pickupTime, hangupTime)
   * Rejects if there's any error
   *
   * @param {Action} originateAction
   * @returns {Promise}
   */
  originate (originateAction) {
    return this.runSaga(this._sagaWatchConnection.bind(this), // watch for connection error
      this._sagaOriginate.bind(this), originateAction) // send originate action and watch for call progress
  }

  /**
   * Opens connection. Throws if connection or authorization fails.
   */
  * _sagaOpen () {
    yield fork([this, super.open])

    let events = yield race([
      take('namiConnected'),
      take('namiConnectionClose'),
      take('namiInvalidPeer'),
      take('namiLoginIncorrect')
    ])

    if (events[0]) { // success (namiConnected)
      return events[0]
    } else { // error
      throw events.find(e => !!e)
    }
  }

  /**
   * Run saga and make sure there's no connection error during saga's execution
   */
  * _sagaWatchConnection (saga, ...args) {
    let [connectionClosed, sagaResult] = yield race([
      take('namiConnectionClose'),
      call(saga, ...args)
    ])

    if (connectionClosed) throw new Error('Connection closed')

    return sagaResult
  }

  /**
   * Send `Originate` action and listen to events to get the call result
   * (answered, startTime, pickupTime, hangupTime)
   *
   * @param {Action} originateAction
   * @returns {Object}
   */
  * _sagaOriginate (originateAction) {
    let callResult = {
      startTime: new Date(),
      answered: false
    }

    // Send `Originate` action
    originateAction.variable = `call=${originateAction.ActionID}`
    let originateResponse = yield call([this, this.send], originateAction)
    if (originateResponse.response !== 'Success') throw new Error('Originate failed')

    let callId = originateAction.ActionID.toString()

    // Catch `VarSet` event to obtain channel ID associated with the call
    let varSet = yield take((a) => a.type === 'namiEventVarSet' && a.event.variable === 'call' && a.event.value === callId)
    let channelId = varSet.event.channel

    // Catch `OriginateResponse` event
    // (`fork` because `OriginateResponse` event may not occur in some circumstances)
    let originateResponseTask = yield fork(function * () {
      let originateResponse = yield take((a) => a.type === 'namiEventOriginateResponse' &&
        (a.event.channel === channelId || a.event.actionid === callId))
      if (originateResponse.event.response === 'Success') {
        callResult.answered = true
        callResult.pickupTime = new Date()
      }
    })

    // Catch `Hangup` event, call is over
    yield take(a => a.type === 'namiEventHangup' && a.event.channel === channelId)
    callResult.hangupTime = new Date()

    // Cancel `originateResponseTask` (in case `OriginateResponse` event has not occurred)
    yield cancel(originateResponseTask)

    return callResult
  }
}

// --------------------------------------------------------------------------------------------
// -- Usage example ---------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------

let nami = new NamiSagaExample({ /* config */ })

nami.open()
  .then(() => {
    console.log('Connected')
  })
  .then(() => {
    console.log('Making a call...')

    // Call and play an audio file
    let originateAction = Object.assign(new namiLib.Actions.Originate(), {
      channel: 'SIP/xxxxxxx/xxxxxxxx',
      application: 'Playback',
      data: 'ru/vm-options',
      async: 'true'
    })

    return nami.originate(originateAction)
  })
  .then((callResult) => {
    console.log({callResult})

    /* {
      startTime: 2017-12-18T04:27:16.340Z,
      answered: true,
      pickupTime: 2017-12-18T04:27:25.384Z,
      hangupTime: 2017-12-18T04:27:27.449Z
    } */
  })
  .then(() => {
    console.log('Disconnecting...')
    nami.close()
  })
  .catch(e => {
    console.log('Error', e)
  })
