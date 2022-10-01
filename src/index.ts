export { Tracker } from './lib/tracker'

export default {
  async fetch(request: Request, env: Env) {
    return await handleErrors(request, async () => {
      const url = new URL(request.url);
      const path = url.pathname.slice(1).split('/');
      const name = path[0];
  
      if (!name) {
        return new Response("Invalid request", { status: 400 })
      }
      
      const trackerId = env.TRACKER.idFromName(name)
      const trackerObj = env.TRACKER.get(trackerId)

      return trackerObj.fetch(request)
    })
  },
}

async function handleErrors(request: Request, func: Function) {
  try {
    return await func(request)
  } catch (e: any) {

    if (request.headers.get("Upgrade") == "websocket") {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();
      server.send(JSON.stringify({
        error: e.stack
      }));
      server.close(1011, "Uncaught exception during session setup")
      return new Response(null, { status: 101, webSocket: client });

    } else {
      return new Response(e.stack, { status: 500 })
    }
  }
}
interface Env {
  TRACKER: DurableObjectNamespace
}
