import { createServer, type IncomingMessage } from "node:http";

// Real connection failure avoids WebKit's broken setOffline service-worker emulation:
// https://github.com/microsoft/playwright/issues/42775
export async function pwaOrigin(upstream: string) {
  let available = true;
  let nextBuild = false;
  const server = createServer(async (request, response) => {
    if (!available) {
      request.socket.destroy();
      return;
    }
    try {
      const target = new URL(request.url ?? "/", upstream);
      if (target.origin !== new URL(upstream).origin) {
        response.writeHead(400).end();
        return;
      }
      const body = await requestBody(request);
      const result = await fetch(target, {
        redirect: "manual",
        method: request.method ?? "GET",
        ...(body.length
          ? { body, headers: { "content-type": "application/json", origin: target.origin } }
          : {}),
      });
      response.writeHead(
        result.status,
        Object.fromEntries(
          [...result.headers].filter(
            ([name]) =>
              !["content-encoding", "content-length", "transfer-encoding", "connection"].includes(
                name,
              ),
          ),
        ),
      );
      const bytes = Buffer.from(await result.arrayBuffer());
      response.end(
        nextBuild && (target.pathname === "/sw.js" || target.pathname === "/index.html")
          ? bytes
              .toString()
              .replace(/(const version = "|<meta name="app-build" content=")([^"]+)/g, "$1$2-next")
          : bytes,
      );
    } catch {
      response.writeHead(502).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing PWA test origin");
  return {
    url: `http://127.0.0.1:${address.port}`,
    nextBuild() {
      nextBuild = true;
    },
    setAvailable(value: boolean) {
      available = value;
      server.closeAllConnections();
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function requestBody(request: IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks);
}
