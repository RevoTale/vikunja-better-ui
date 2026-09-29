import { expect, type Page, test } from "@playwright/test";
import { discussionGraphQL } from "./discussion-fixture";

test("Today count supports ready-now rules and completion without delaying the page", async ({
  page,
}, testInfo) => {
  await login(page);
  const before = await count(page);
  const past = new Date(Date.now() - 3_600_000).toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const inputs = [
    { title: "Count overdue without start", due_date: past },
    { title: "Count started with future deadline", start_date: past, due_date: future },
    { title: "Count started without deadline", start_date: past },
    { title: "Count overlapping once", start_date: past, due_date: past },
    { title: "Count overdue with future start", start_date: future, due_date: past },
    { title: "Exclude no dates" },
    { title: "Exclude deadline without start", due_date: future },
    { title: "Exclude future start", start_date: future },
    { title: "Exclude completed", start_date: past, due_date: past, done: true },
  ];
  const ids: number[] = [];
  try {
    for (const input of inputs) {
      const response = await upstream(
        `/projects/${process.env["E2E_PROJECT_ID"]}/tasks`,
        "POST",
        input,
      );
      const task: { id: number } = await response.json();
      ids.push(task.id);
    }
    expect(await count(page)).toBe(before + 5);
    await page.reload();
    const badge = page.locator('[data-slot="actionable-count"]:visible');
    await expect(badge).toHaveText(String(before + 5));
    await page.goto(`/today?project=${process.env["E2E_PROJECT_ID"]}`);
    await page
      .getByRole("button", { name: "Complete Count overdue without start", exact: true })
      .click();
    await expect(badge).toHaveText(String(before + 4));
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(badge).toHaveText(String(before + 5));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('nav[aria-label="Main navigation"]:visible')
      .screenshot({ path: testInfo.outputPath("today-count.png") });
  } finally {
    for (const id of ids) await upstream(`/tasks/${id}`, "DELETE");
  }
});

test("Today count supports independent loading, failure and focus retry", async ({ page }) => {
  let fail = false;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/graphql", async (route) => {
    const body: unknown = route.request().postDataJSON();
    if (
      !body ||
      typeof body !== "object" ||
      !("operationName" in body) ||
      body.operationName !== "ActionableTaskCount"
    ) {
      await route.continue();
      return;
    }
    requests += 1;
    await gate;
    await route.fulfill({
      json: fail
        ? { errors: [{ message: "Unavailable" }], data: null }
        : { data: { actionableTaskCount: 7 } },
    });
  });
  await login(page);
  await expect(page.getByRole("heading", { name: "This week", exact: true })).toBeVisible();
  const badge = page.locator('[data-slot="actionable-count"]:visible');
  await expect(badge).toHaveAttribute("aria-busy", "true");
  expect(requests).toBe(1);
  release?.();
  await expect(badge).toHaveText("7");
  fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(badge).toHaveText("?");
  await expect(badge).toHaveAttribute("aria-label", "Task count unavailable");
  fail = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(badge).toHaveText("7");
});

test("Today count supports a trailing refresh after an overlapping mutation", async ({ page }) => {
  const response = await upstream(`/projects/${process.env["E2E_PROJECT_ID"]}/tasks`, "POST", {
    title: "Count overlapping request",
    due_date: new Date(Date.now() - 3_600_000).toISOString(),
  });
  const task: { id: number } = await response.json();
  const oldRead = readGate();
  const newRead = readGate();
  let requests = 0;
  try {
    await page.route("**/graphql", async (route) => {
      const body = route.request().postDataJSON();
      if (body.operationName !== "ActionableTaskCount") return route.continue();
      requests += 1;
      const first = requests === 1;
      await (first ? oldRead.promise : newRead.promise);
      return route.fulfill({ json: { data: { actionableTaskCount: first ? 9 : 8 } } });
    });
    await login(page);
    await page
      .getByRole("button", { name: "Complete Count overlapping request", exact: true })
      .click();
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
    expect(requests).toBe(1);
    oldRead.resolve();
    await expect.poll(() => requests).toBe(2);
    const badge = page.locator('[data-slot="actionable-count"]:visible');
    await expect(badge).toHaveAttribute("aria-busy", "true");
    await expect(badge).not.toHaveText("9");
    newRead.resolve();
    await expect(badge).toHaveText("8");
  } finally {
    oldRead.resolve();
    newRead.resolve();
    await upstream(`/tasks/${task.id}`, "DELETE");
  }
});

test("Today count supports polling only while visible", async ({ page }) => {
  await page.clock.install();
  let requests = 0;
  await page.route("**/graphql", async (route) => {
    const body = route.request().postDataJSON();
    if (body.operationName !== "ActionableTaskCount") return route.continue();
    requests += 1;
    return route.fulfill({ json: { data: { actionableTaskCount: requests } } });
  });
  await login(page);
  const badge = page.locator('[data-slot="actionable-count"]:visible');
  await expect(badge).toHaveText("1");
  await page.clock.fastForward(60_000);
  await expect(badge).toHaveText("2");
  await page.evaluate(() =>
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }),
  );
  await page.clock.fastForward(60_000);
  expect(requests).toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(badge).toHaveText("3");
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/week/);
}

function readGate() {
  let release: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, resolve: () => release?.() };
}

async function count(page: Page) {
  return (await discussionGraphQL<{ actionableTaskCount: number }>(page, "{ actionableTaskCount }"))
    .actionableTaskCount;
}

async function upstream(path: string, method: string, body?: unknown) {
  const response = await fetch(`${process.env["E2E_VIKUNJA_URL"]}/api/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env["E2E_VIKUNJA_API_TOKEN"]}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  expect(response.ok).toBe(true);
  return response;
}
