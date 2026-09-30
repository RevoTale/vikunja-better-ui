import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { vi } from "vitest";

type WorkerEvent = {
  request?: { url: string; method: string; mode: string };
  waitUntil?: (result: Promise<unknown>) => void;
  respondWith?: (result: Promise<Response>) => void;
};

export function workerRuntime() {
  const entries = new Map<string, Map<string, Response>>();
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const fetch = vi.fn(async () => new Response("asset"));
  const cacheStorage = {
    keys: async () => [...entries.keys()],
    delete: async (name: string) => entries.delete(name),
    open: vi.fn(async (name: string) => {
      const cache = entries.get(name) ?? new Map<string, Response>();
      entries.set(name, cache);
      return {
        match: async (key: string | Request) => cache.get(path(key))?.clone(),
        put: async (key: string | Request, response: Response) => {
          cache.set(path(key), response.clone());
        },
      };
    }),
  };
  const source = readFileSync(new URL("./worker.js", import.meta.url), "utf8")
    .replace("__BUILD_VERSION__", "test")
    .replace(
      'JSON.parse("__BUILD_ASSETS__")',
      JSON.stringify(["/index.html", "/assets/app.js", "/favicon.svg"]),
    );
  runInNewContext(source, {
    self: {
      location: { origin: "https://app.test" },
      addEventListener: (name: string, handler: (event: WorkerEvent) => void) =>
        handlers.set(name, handler),
    },
    caches: cacheStorage,
    fetch,
    Response,
    Headers,
    URL,
    crypto,
  });
  function dispatch(name: string) {
    let pending: Promise<unknown> | undefined;
    handlers.get(name)?.({
      waitUntil: (result) => {
        pending = result;
      },
    });
    return pending;
  }
  function request(pathname: string, method = "GET", mode = "navigate") {
    let pending: Promise<Response> | undefined;
    handlers.get("fetch")?.({
      request: { url: new URL(pathname, "https://app.test").href, method, mode },
      respondWith: (result) => {
        pending = result;
      },
    });
    return pending;
  }
  return { entries, fetch, cacheStorage, dispatch, request };
}

function path(key: string | Request) {
  return typeof key === "string" ? key : new URL(key.url).pathname;
}

export function shellResponse(version = "test") {
  return new Response(
    `<head><meta name="csp-nonce" content="old" /><meta name="app-build" content="${version}" /></head>`,
    {
      headers: {
        "content-type": "text/html",
        "content-security-policy": "style-src-elem 'self' 'nonce-old'",
        "content-length": "42",
        "content-encoding": "gzip",
      },
    },
  );
}
