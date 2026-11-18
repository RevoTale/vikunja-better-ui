import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { login } from "./app-actions";
import { expectVikunjaTask } from "./app-api";
import { requiredEnv, vikunjaURL } from "./app-fixture";
import { privateTask } from "./personal-token-fixture";

async function privateAddress() {
  const address = Object.values(networkInterfaces())
    .flat()
    .find(
      (entry) =>
        entry?.family === "IPv4" &&
        !entry.internal &&
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address),
    )?.address;
  if (!address)
    throw new Error("The private HTTP browser test needs a private non-loopback IPv4 address");
  const listener = createServer().listen(0, address);
  await once(listener, "listening");
  const bound = listener.address();
  await new Promise<void>((resolve, reject) => {
    listener.close((error) => (error ? reject(error) : resolve()));
  });
  if (!bound || typeof bound === "string") throw new Error("Missing private HTTP listener");
  return `${address}:${bound.port}`;
}

async function withDeployment(address: string, key: string, visit: () => Promise<void>) {
  const child = spawn(join(requiredEnv("E2E_FIXTURE_DIR"), "app"), [], {
    env: {
      APP_ENV: "production",
      APP_HTTP_ADDR: address,
      APP_SESSION_SECRET: key,
      APP_VIKUNJA_URL: vikunjaURL,
      APP_VIKUNJA_PUBLIC_URL: "https://vikunja.example.invalid",
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const closed = once(child, "close");
  try {
    await expect
      .poll(async () => {
        if (child.exitCode !== null)
          throw new Error(`Production app exited with code ${child.exitCode}`);
        return fetch(`http://${address}/readyz`).then(
          (response) => response.status,
          () => 0,
        );
      })
      .toBe(200);
    await visit();
  } finally {
    child.kill();
    await closed;
  }
}

test("production private HTTP supports online workflows and session continuity across redeployment", async ({
  page,
  context,
  request,
}) => {
  const address = await privateAddress();
  const origin = `http://${address}`;
  const key = randomBytes(32).toString("base64");
  const title = "Private HTTP task";
  const id = await privateTask(request, title);
  const taskURL = `${origin}/tasks/${id}`;
  const heading = page.getByRole("heading", { name: title, exact: true });
  await withDeployment(address, key, async () => {
    await page.goto(taskURL);
    await expect(page.getByLabel("Vikunja API token")).toBeVisible();
    expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
    await login(page);
    await expect(heading).toBeVisible();
    // Examine attributes only; failure reports must never serialize the sealed cookie.
    const cookies = await context.cookies(origin);
    const selected = cookies.find((item) => item.name === "vbu_session");
    const sealed = cookies.find((item) => item.name === `vbu_session_${selected?.value}`);
    for (const cookie of [selected, sealed]) {
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe("Lax");
      expect(cookie?.secure).toBe(false);
      expect(cookie?.path).toBe("/");
    }
  });
  await withDeployment(address, key, async () => {
    await page.reload();
    await expect(heading).toBeVisible();
    await page.getByRole("button", { name: "Share task", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Copy link" });
    await expect(dialog.getByRole("textbox", { name: "Link to share" })).toHaveValue(taskURL);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Complete task", exact: true }).click();
    await expectVikunjaTask(id, { title, done: true });
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByLabel("Vikunja API token")).toBeVisible();
    expect(
      (await context.cookies(origin)).some((item) => item.name.startsWith("vbu_session")),
    ).toBe(false);
    await login(page);
    await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  });
  await withDeployment(address, randomBytes(32).toString("base64"), async () => {
    await page.goto(taskURL);
    await expect(page.getByLabel("Vikunja API token")).toBeVisible();
  });
});
