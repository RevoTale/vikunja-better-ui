// Build-time placeholders are replaced by the Vite plugin. Only public build files enter this cache.
const version = "__BUILD_VERSION__";
/** @type {string[]} */
const assets = JSON.parse("__BUILD_ASSETS__");
const cacheName = `better-vikunja-shell-${version}`;
const worker = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

worker.addEventListener("install", (event) => {
  event.waitUntil(installBuild());
});

async function installBuild() {
  const cache = await caches.open(cacheName);
  try {
    const responses = await Promise.all(
      assets.map(async (path) => {
        const response = await fetch(path, {
          credentials: "omit",
          cache: "reload",
          redirect: "error",
        });
        if (!response.ok) throw new Error("Build unavailable");
        if (path === "/index.html") {
          const html = await response.clone().text();
          if (!html.includes(`content="${version}"`))
            throw new Error("Build changed during installation");
        } else if (response.headers.get("content-type")?.includes("text/html")) {
          throw new Error("Missing build asset");
        }
        return /** @type {[string, Response]} */ ([path, response]);
      }),
    );
    await Promise.all(responses.map(([path, response]) => cache.put(path, response)));
  } catch (error) {
    await caches.delete(cacheName);
    throw error;
  }
}

worker.addEventListener("activate", (event) => {
  // No skipWaiting/claim: existing tabs keep their own build and unsaved editors.
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("better-vikunja-shell-") && name !== cacheName)
            .map((name) => caches.delete(name)),
        ),
      ),
  );
});

worker.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && isAppPath(url.pathname)) {
    event.respondWith(navigate(request));
  } else if (!url.search && url.pathname !== "/index.html" && assets.includes(url.pathname)) {
    event.respondWith(loadAsset(request, url.pathname));
  }
});

/** @param {Request} request @param {string} path */
async function loadAsset(request, path) {
  if (path === "/favicon.svg" || path === "/site.webmanifest") {
    try {
      return await fetch(request);
    } catch {
      /* Respect HTTP cache lifetime online. */
    }
  }
  return (await readCached(request)) ?? fetch(request);
}

/** @param {Request | string} request */
async function readCached(request) {
  try {
    return await (await caches.open(cacheName)).match(request);
  } catch {
    // A denied or unavailable cache must not break online requests.
    return undefined;
  }
}

/** @param {string} path */
function isAppPath(path) {
  return /^\/(?:|login|today|week|month|jobs|unscheduled|history|tasks\/(?:new|\d+(?:\/(?:edit|discussion|delete|extended))?))\/?$/.test(
    path,
  );
}

/** @param {Request} request */
async function navigate(request) {
  try {
    // Online HTML stays fresh, including current security headers. Only static assets are cache-first.
    const response = await fetch(request);
    if (response.status < 500) return response;
  } catch {
    // Offline fallback never contains task data or an authenticated session.
  }
  const cached = await readCached("/index.html");
  if (!cached) return Response.error();
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const headers = new Headers(cached.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("cache-control", "no-store");
  const policy = headers.get("content-security-policy");
  if (policy)
    headers.set("content-security-policy", policy.replace(/'nonce-[^']+'/g, `'nonce-${nonce}'`));
  const html = (await cached.text())
    .replace(/(<meta name="csp-nonce" content=")[^"]+/, `$1${nonce}`)
    .replace("</head>", '<meta name="offline-shell" content="true" /></head>');
  return new Response(html, { headers });
}
