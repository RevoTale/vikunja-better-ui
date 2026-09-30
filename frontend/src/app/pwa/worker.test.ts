import { describe, expect, it } from "vitest";
import { shellResponse, workerRuntime } from "./worker-test-runtime";

describe("offline request boundaries", () => {
  it("handles every task screen and legacy navigation route", async () => {
    const worker = workerRuntime();
    for (const path of [
      "/",
      "/week/",
      "/month",
      "/tasks/new",
      "/tasks/137",
      "/tasks/137/edit",
      "/tasks/137/delete",
      "/tasks/137/extended",
      "/tasks/137/discussion",
    ]) {
      expect(await worker.request(path)).toBeInstanceOf(Response);
    }
  });
  it("never intercepts API, media, mutations, foreign URLs or unknown routes", () => {
    const worker = workerRuntime();
    for (const path of [
      "/graphql",
      "/media/tasks/1/attachments/2",
      "/integrations/v1/jobs",
      "/unknown",
      "https://other.test/week",
    ]) {
      expect(worker.request(path)).toBeUndefined();
    }
    expect(worker.request("/week", "POST")).toBeUndefined();
    expect(worker.request("/assets/app.js?secret=x", "GET", "cors")).toBeUndefined();
  });
});

describe("offline build installation", () => {
  it("discards incomplete new builds but preserves the old build", async () => {
    const worker = workerRuntime();
    await worker.cacheStorage.open("better-vikunja-shell-old");
    worker.fetch.mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(worker.dispatch("install")).rejects.toThrow("Build unavailable");
    expect(await worker.cacheStorage.keys()).toEqual(["better-vikunja-shell-old"]);
  });

  it("rejects cross-release HTML instead of caching a mixed build", async () => {
    const worker = workerRuntime();
    worker.fetch.mockResolvedValueOnce(shellResponse("other"));
    await expect(worker.dispatch("install")).rejects.toThrow("Build changed");
    expect(await worker.cacheStorage.keys()).toEqual([]);
  });

  it("installs public files without credentials and removes only obsolete app caches on activation", async () => {
    const worker = workerRuntime();
    worker.fetch.mockResolvedValueOnce(shellResponse());
    await worker.dispatch("install");
    expect(worker.entries.get("better-vikunja-shell-test")?.size).toBe(3);
    for (const call of worker.fetch.mock.calls)
      expect(call).toEqual([
        expect.any(String),
        expect.objectContaining({ credentials: "omit", redirect: "error" }),
      ]);
    await worker.cacheStorage.open("better-vikunja-shell-old");
    await worker.cacheStorage.open("unrelated");
    await worker.dispatch("activate");
    expect(await worker.cacheStorage.keys()).toEqual(["better-vikunja-shell-test", "unrelated"]);
  });
});

describe("offline response handling", () => {
  it("loads assets from the network when cache storage becomes unavailable", async () => {
    const worker = workerRuntime();
    worker.cacheStorage.open.mockRejectedValue(new Error("Storage unavailable"));
    worker.fetch.mockResolvedValue(new Response("fresh asset"));
    expect(await (await worker.request("/assets/app.js", "GET", "cors"))?.text()).toBe(
      "fresh asset",
    );
  });

  it("returns a network error when neither the server nor offline storage is available", async () => {
    const worker = workerRuntime();
    worker.cacheStorage.open.mockRejectedValue(new Error("Storage unavailable"));
    worker.fetch.mockRejectedValue(new Error("Offline"));
    expect((await worker.request("/week"))?.type).toBe("error");
  });

  it("uses fresh online navigation and cache-first assets without caching responses", async () => {
    const worker = workerRuntime();
    const cache = await worker.cacheStorage.open("better-vikunja-shell-test");
    await cache.put("/assets/app.js", new Response("saved asset"));
    expect(await (await worker.request("/assets/app.js", "GET", "cors"))?.text()).toBe(
      "saved asset",
    );
    expect(worker.fetch).not.toHaveBeenCalled();
    worker.fetch.mockResolvedValue(new Response("fresh page"));
    expect(await (await worker.request("/week"))?.text()).toBe("fresh page");
    expect(worker.entries.get("better-vikunja-shell-test")?.size).toBe(1);
  });

  it("rotates offline nonces and removes stale encoding headers without modifying saved HTML", async () => {
    const worker = workerRuntime();
    const cache = await worker.cacheStorage.open("better-vikunja-shell-test");
    await cache.put("/index.html", shellResponse());
    worker.fetch.mockRejectedValue(new Error("offline"));
    const first = await worker.request("/week");
    const second = await worker.request("/week");
    expect(first?.headers.get("content-security-policy")).not.toBe(
      second?.headers.get("content-security-policy"),
    );
    const html = await first?.text();
    const nonce = html?.match(/name="csp-nonce" content="([^"]+)"/)?.[1];
    expect(first?.headers.get("content-security-policy")).toContain(`'nonce-${nonce}'`);
    expect(html).toContain('name="offline-shell"');
    expect(first?.headers.has("content-length")).toBe(false);
    expect(first?.headers.has("content-encoding")).toBe(false);
    expect(await (await cache.match("/index.html"))?.text()).not.toContain("offline-shell");
  });
});
