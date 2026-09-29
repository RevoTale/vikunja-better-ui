import { expect, test } from "@playwright/test";

test("label creation retries preserve newer input and prevent concurrent submission", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/week/);
  await page.goto("/tasks/new?type=one-time");
  await page.getByLabel("Title", { exact: true }).fill("Keep my task draft");
  let release: () => void = () => undefined;
  const delay = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName !== "CreateTaskLabel") {
      await route.continue();
      return;
    }
    calls++;
    if (calls === 1) {
      await route.fulfill({
        json: {
          data: null,
          errors: [
            { message: "Label service unavailable", extensions: { code: "UPSTREAM_UNAVAILABLE" } },
          ],
        },
      });
      return;
    }
    await delay;
    await route.continue();
  });
  const search = page.getByLabel("Find or create label");
  await search.fill("Retry-safe label");
  await page.getByRole("button", { name: "Create or reuse label" }).click();
  await expect(page.getByRole("alert")).toContainText("Label service unavailable");
  await page.getByRole("button", { name: "Create or reuse label" }).click();
  await expect(
    page.getByRole("button", { name: "Create one-time task", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reset autosave" })).toHaveCount(0);
  await search.fill("Text entered while waiting");
  await page.getByLabel("Title", { exact: true }).fill("Newer draft");
  release();
  await expect(page.getByRole("checkbox", { name: "Retry-safe label", exact: true })).toBeChecked();
  await expect(search).toHaveValue("Text entered while waiting");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Newer draft");
  expect(calls).toBe(2);
});

test("partial label save shows the created task instead of a duplicate submission", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/week/);
  await page.goto("/tasks/new?type=one-time");
  await page.getByLabel("Title", { exact: true }).fill("Created only once");
  let writes = 0;
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON().operationName !== "CreateOneTimeTask") {
      await route.continue();
      return;
    }
    writes++;
    const response = await route.fetch();
    const body = await response.json();
    body.data.createOneTimeTask.labelError =
      "The task was created, but labels could not be confirmed. Review its labels.";
    await route.fulfill({ response, json: body });
  });
  await page.getByRole("button", { name: "Create one-time task", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Task created", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create one-time task", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Review task labels" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Created only once");
  expect(writes).toBe(1);
});
