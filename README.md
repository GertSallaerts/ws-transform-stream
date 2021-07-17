# ws-transform-stream

A transformer for websocket streams.

## Usage

```sh
yarn add @gertt/ws-transform-stream
```

or

```sh
npm install @gertt/ws-transform-stream
```

In your code:

```js
const WsTransformStream = require('@gertt/ws-transform-stream');

/**
 * Make all WS messages uppercase
 */
function transform(message) {
    return message.toUpperCase();
}

const transformer = new WsTransformStream({ transform });

// You'd typically get these when receiving a request on a webserver and needing
// to forward/proxy the WS elsewhere;
const clientWsSocket = ...;
const upstreamWsSocket = ...;

// pipe the sockets through the transformer to transform any messages going from
// client to upstream server
clientWsSocket.pipe(transformer).pipe(upstreamWsSocket);
```
