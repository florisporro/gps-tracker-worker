# Cloudflare worker position server

Written for a specific project, this Cloudflare worker uses Durable Objects to store and announce positions on a GPS tracker via HTTP and Websockets.

It was specifically written to work with [Lightbug.io](https://lightbug.io/) worldwide GPS trackers, but is easily adaptable to accept any HTTP-based input.

## Install

Clone locally and make any adjustments you may need.

```bash
git clone https://github.com/florisporro/gps-tracker-worker.git
npm install
```

## Local development

Note there are some limits to local development, particularly that Durable Objects lose their state after shutdown and storage is not locally emulated, so no persistance.

```bash
npm run dev
```

## Build & deploy

```bash
npx wrangler2 publish
```

## Concepts

### Frame

A tracker is essentially a collection of GPS position data.

```js
Frame {
	// The position
  position: { latitude: 0.01, longitude: 25 },
	// The altitude above sea level that was recorded
  altitude: 0,
	// The accuracy in meters that the tracker recorded
  accuracy: 0,
	// The frameTimestamp is automatically recorded with Date.now()
  frameTimestamp: 1664392994440,
	// The positionTimestamp can be optionally provided, and can be used when the GPS data comes with its own timestamp. The positionTimestamp can be used for all calculations that require a time parameter, like speed.
  positionTimestamp: 1664393054440,
	// A sequential frame number, automatically incremented
  frameno: 1,
}
```

Note that frames must have an accuracy lower than 300 meters, or they will be rejected.

## Usage

Use above steps to deploy on Cloudflare. Once deployed, the following paths are available:

### `GET /:trackername`

Gets the most recent 1000 tracker stored frames and returns as an array of JSON strings.

```json
[
  "{\"frameno\":698,\"position\":{\"latitude\":50.2345,\"longitude\":9.6285},\"altitude\":0,\"accuracy\":36,\"frameTimestamp\":1664658131630,\"positionTimestamp\":1664658130769}",
  "{\"frameno\":697,\"position\":{\"latitude\":50.2350,\"longitude\":9.6280},\"altitude\":0,\"accuracy\":37,\"frameTimestamp\":1664655249345,\"positionTimestamp\":1664655248596}"
]
```

### `GET /:trackername/ws`

This is the websocket endpoint. When first opened, the server will send the last 50 frames in an array. After that, every newly recorded frame will be sent through as an object.

To display on a map, it's recommended to implement a debounce filter on incoming data. In testing I've found that especially the Lightbug trackers in some circumstances can send through a few datapoints with almost the same timestamp.

An example implementation might look like this:

```js
socket = new WebSocket(
  'ws://{workername}.{account}.workers.dev/{trackername}/ws',
)

let timeoutId
function handleNewTrackerData(data, timeout = 0) {
  clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    // Do something with the data here
    console.log(data)
  }, timeout)
}

socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)

  // Message is either an object with new tracker data, or an array of tracker datapoints
  if (Array.isArray(message)) {
    console.log('Initial data received')
    // Note that data is received newest frames first in the array
    message.forEach(trackerDataString => {
      const trackerData = JSON.parse(trackerDataString)
      handleNewTrackerData(trackerData)
    })
  } else {
    handleNewTrackerData(message, 1000)
  }
})
```

_Note:_ See Cloudflare Durable Object billing. Cost can increase quite rapidly with a lot of websockets open.

### `POST /:trackername/basic`

Accepts a basic JSON object and stores it on the Durable Object as a tracker frame. An example request with the options accepted:

```json
{
  "position": {
    "latitude": number,
    "longitude": number
  },
  "accuracy": number,
  "altitude": number,
  "positionTimestamp": number
}
```

Note that frames must have an accuracy lower than 300 meters, or they will be rejected.

### `POST /:trackername/lightbug`

On lightbug trackers, an option exists to send notifications to an API. This is preceded by a message that asks to confirm subscription to the service.

The worker will automatically confirm the subscription and store future notifications from the Lightbug service as frames on the Durable Object.

Note that frames must have an accuracy lower than 300 meters, or they will be rejected.

### `POST /:trackername/reset`

Deletes all data on the :trackername Durable Object, resetting the tracker frameno to 0. Handy for testing, or when the database grows too large.
