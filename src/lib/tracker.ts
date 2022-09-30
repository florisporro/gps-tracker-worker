import { lightbugPayloadToFrame } from "../handlers/lightbug";

import { NewFrame } from "../types/interfaces"
import { Frame } from "./frame"

interface Env {}

export class Tracker {
  state: DurableObjectState
  name?: string;
	type?: string;
	frames: Array<Frame>
	meta?: any;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.frames = []

    this.state.blockConcurrencyWhile(async () => {
      this.name = await this.state.storage?.get("name") || "";
      this.type = await this.state.storage?.get("type") || "";
      this.meta = await this.state.storage?.get("meta") || {};
      this.frames = await this.state.storage?.get("frames") || [];
    });
  }

  async handleRecord(newFrame: any) {
    function isNewFrame(payload: any): payload is NewFrame {
      return payload.position !== undefined && payload.position.latitude !== undefined && payload.position.longitude !== undefined;
    }

    if (!isNewFrame(newFrame)) {
      return new Response("Invalid payload", { status: 400 })
    }
  
    let currentFrame
    if (this.frames && this.frames.length > 0) {
      currentFrame = this.frames[this.frames.length - 1]
    }

    if (currentFrame?.positionTimestamp !== undefined) {
      if (currentFrame?.positionTimestamp === newFrame.positionTimestamp) {
        return new Response("Frame already exists", {
          status: 400
        })
      }
    }

    const frame = new Frame({ ...newFrame, lastFrame: currentFrame })
    this.frames.push(frame)
    await this.state.storage?.put("frames", this.frames);

    const json = JSON.stringify(frame, null, 2)
    return new Response(json, { status: 200 })
  
  }

  // Handle HTTP requests from clients.
  async fetch(request: Request) {
    // Apply requested action.
    let url = new URL(request.url);
    const path = url.pathname.slice(1).split('/').slice(1).join('/');
		const method = request?.method?.toUpperCase?.();

    console.log(path);


		if (method === "GET") {
      const tracker = {
        name: this.name,
        type: this.type,
        meta: this.meta,
        frames: this.frames
      }

      const json = JSON.stringify(tracker, null, 2)

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
        case "setmeta":
          break;
        case "record/basic":
          return await this.handleRecord(json);
        case "record/lightbug":
          if (json.SubscribeURL !== undefined) {
            await fetch(json.SubscribeURL);
            return new Response("subscribed", {
              status: 200
            });
          }
          const frame = lightbugPayloadToFrame(json)
          console.log(frame)
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
}