# nami-saga

`nami` extension for using `redux-saga`

AMI apps tend to have a lot of asynchronous logic by their nature.
`redux-saga` is pretty cool at handling asynchronous logic. 
`nami-saga` allows using `nami` and `redux-saga` together.

> [nami](https://github.com/marcelog/Nami) - Asterisk manager interface (ami) client for nodejs

> [redux-saga](https://github.com/redux-saga/redux-saga) - a library that aims to make application side effects (i.e. asynchronous things like data fetching and impure things like accessing the browser cache) easier to manage, more efficient to execute, simple to test, and better at handling failures.

### NamiSaga

`NamiSaga` extends `Nami` class and provides the following methods:

Method | Returns | Description
--- | --- | ---
runSaga (saga, ...args) | Promise | Runs `saga` and returns a promise that resolves with `saga` result. Throws if `saga` fails.
send(action) | Promise | Overrides `Nami.send` method to return a promise (for convenience)

#### nami events to saga actions
`Nami` events are transformed to `redux-saga` action format `{type: eventName, event: eventData}`

In saga you can "take" the events like so:

    let action = take('namiConnectionClose')
    console.log(action) // {type: 'namiConnectionClose', event: {event: 'Close', had_error: true}}
    
    let action = take((action) => action.type === 'namiEventHangup' && action.event.channel === '...')
    console.log(action) // {type: 'namiEventHangup', event: {event: 'Hangup', channel: '...', ...}}

#### saga actions to nami events

Actions dispatched with `put()` in sagas will be emitted as `Nami` events:

    put({type: 'MyCustomEvent', foo: 'foo'})
    
will emit the following event: 
    
    {type: 'MyCustomEvent', event: {type: 'MyCustomEvent', foo: 'foo'}} 

Such events can be received via subscribing to them (same as with other `nami` events): 

    nami.on('MyCustomEvent', (e) => {
      console.log(e) // {type: 'MyCustomEvent', event: {type: 'MyCustomEvent', foo: 'foo'}}
    })
    
or in saga:
    
    let action = take('MyCustomEvent')
    console.log(action) // {type: 'MyCustomEvent', event: {type: 'MyCustomEvent', foo: 'foo'}}
    
### Usage

[Usage example](/examples/example.js)

### License
MIT