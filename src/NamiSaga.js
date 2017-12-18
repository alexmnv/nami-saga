const { Nami } = require('nami')
const { runSaga } = require('redux-saga')

class NamiSaga extends Nami {
  constructor (...args) {
    super(...args)
    this.sagaIO = this.createSagaIO()
  }

  /**
   * IO interface for connecting `Nami` events to `redux-saga`
   */
  createSagaIO () {
    return {
      subscribe: (callback) => {
        let eventListener = (eventName, e) => {
          callback({type: eventName, event: e})
        }

        this.on('*', eventListener)

        // unsubscribe
        return () => {
          this.removeListener('*', eventListener)
        }
      },

      dispatch: (action) => {
        this.emit(action.type, action)
      },

      getState: () => { throw new Error('Not implemented') }
    }
  }

  /**
   * Overrides `Nami.send`
   * - returns a promise if `callback` argument is omitted, so that it was comfy to use in sagas
   *
   * @param {Action} action
   * @param {function} callback
   *
   * @returns {void|Promise}
   */
  send (action, callback) {
    let result

    if (callback === undefined) {
      result = new Promise(resolve => {
        callback = resolve
      })
    }

    super.send(action, callback)

    return result
  }

  /**
   * Overrides `EventEmitter.emit`
   * - re-emits the event with '*' event name, so that it was possible to subscribe to all events at once
   *
   * @param eventName
   * @param args
   *
   * @returns {void}
   */
  emit (eventName, ...args) {
    super.emit('*', eventName, ...args)
    super.emit(eventName, ...args)
  }

  /**
   * Run saga
   *
   * @param {generator} saga
   * @param args
   * @returns {Promise}
   */
  runSaga (saga, ...args) {
    return new Promise((resolve, reject) => {
      runSaga(
        this.sagaIO,
        function * () {
          try {
            let result = yield * saga(...args)
            resolve(result)
          } catch (e) {
            reject(e)
          }
        }
      )
    })
  }
}

module.exports = NamiSaga
