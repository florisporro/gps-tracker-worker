export { Tracker } from './tracker'

export default {
  async fetch(request: Request, env: Env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.slice(1).split('/');
      
      return await handleRequest(request, env, path)
    } catch (e) {
      return new Response(`${e}`)
    }
  },
}

async function handleRequest(request: Request, env: Env, path: Array<string>) {
  const name = path[0];
  
  if (!name) {
    return new Response("Invalid request", { status: 400 })
  }
  
  if (name === "ws") {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }
    
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    server.accept();
    
    server.addEventListener('message', event => {
      console.log(event.data);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  
  const trackerId = env.TRACKER.idFromName(name)
  const trackerObj = env.TRACKER.get(trackerId)
  const response = await trackerObj.fetch(request)
  console.log(response)
  return response
}

interface Env {
  TRACKER: DurableObjectNamespace
}
