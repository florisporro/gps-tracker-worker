import { lightbugPayloadToFrame } from "../handlers/lightbug";

import { NewFrame } from "../types/interfaces"
import { Frame } from "./frame"

interface Env {}

export class Tracker {
  state: DurableObjectState
  storage: DurableObjectStorage | undefined
  sessions: Array<any>

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.sessions = []
  }

  async getFrames() {
    const response = await this.state.storage?.list({ reverse: true, limit: 500 }) || []
    const frames = [...response.values()]
    const json = JSON.stringify(frames, null, 2)
    return json
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1).split('/').slice(1).join('/');
		const method = request?.method?.toUpperCase?.();

    console.log(path)

		if (method === "GET") {
      if (path === "ws") {
        const upgradeHeader = request.headers.get('Upgrade');
        if (!upgradeHeader || upgradeHeader !== 'websocket') {
          return new Response('Expected Upgrade: websocket', { status: 426 });
        }
        
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);
        
        await this.handleSession(server)
        
        server.addEventListener('message', event => {
          console.log(event.data);
        });

        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      }

      const json = await this.getFrames()
  
      return new Response(json, {
        headers: {
          "content-type": "application/json;charset=UTF-8"
        }
      });

		}

		if (method === "POST") {
			const json: any = await request.json()

      console.log(json)

      switch (path) {
        case "record/basic":
          console.log("Storing basic frame")
          return await this.handleRecord(json);
          case "record/lightbug":
          console.log("Handling Lightbug frame")
          if (json.SubscribeURL !== undefined) {
            console.log("Subscribing to Lightbug feed")
            await fetch(json.SubscribeURL);
            return new Response("subscribed", {
              status: 200
            });
          }
          const frame = lightbugPayloadToFrame(json)
          return await this.handleRecord(frame)
        default:
          return new Response("nope", {
              status: 418
          });
      }
		}

    // Not a GET or POST request, so return an error.
    return new Response("nope", {
      status: 418
  });
  }

  async handleSession(webSocket: WebSocket) {
    webSocket.accept();
    let session = { webSocket }
    this.sessions.push(session)

    const json = await this.getFrames()
    webSocket.send(json)

    const closeOrErrorHandler = (event: any) => {
      console.log("Closing session")
      this.sessions.filter(member => member !== session)
    }

    webSocket.addEventListener('close', closeOrErrorHandler);
    // @ts-ignore
    webSocket.addEventListener("error", closeOrErrorHandler);

    return
  }

  broadcast(message: any) {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }

    this.sessions.forEach(session => {
      try {
        session.webSocket.send(message);
      } catch(e) {
        // Probably dead connection
        console.log(e)
        this.sessions.filter(member => member !== session)
      }
    })
  }

  async handleRecord(newFrame: any) {
    function isNewFrame(payload: any): payload is NewFrame {
      return payload.position !== undefined && payload.position.latitude !== undefined && payload.position.longitude !== undefined;
    }

    if (!isNewFrame(newFrame)) {
      return new Response("Invalid payload", { status: 400 })
    }

    const storage = await this.storage?.list({ reverse: true, limit: 1000 }) || []
    const frames = [...storage?.values()]

    const currentFrame = frames[0] as Frame

    const frame = new Frame({ ...newFrame, lastFrame: currentFrame })

    const time = frame.positionTimestamp || frame.frameTimestamp
    const key = new Date(time).toISOString()
    const json = JSON.stringify(frame)

    this.broadcast(json)
    console.log(json)

    await this.storage?.put(key, json);

    return new Response(json, { status: 200 })
  
  }
}