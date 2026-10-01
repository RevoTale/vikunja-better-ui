import { expect, test } from "@playwright/test";
import { discussionGraphQL } from "./discussion-fixture";

test("task labels support create, deselect, edit and inclusion filtering", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/today");
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const { session } = await discussionGraphQL<{ session: { csrfToken: string } }>(
    page,
    "{ session { csrfToken } }",
  );
  const labelTitle = "job";
  await page.goto("/tasks/new?type=one-time&returnTo=%2Funscheduled");
  await page.getByLabel("Find or create label").fill(labelTitle);
  await page.getByRole("button", { name: "Create or reuse label" }).click();
  await expect(page.getByRole("checkbox", { name: labelTitle, exact: true })).toBeChecked();
  await page.getByRole("checkbox", { name: labelTitle, exact: true }).uncheck();
  await expect(page.locator('input[name="labelIds"]')).toHaveCount(0);
  await page.getByLabel("Find or create label").fill(labelTitle);
  await page.getByRole("button", { name: "Create or reuse label" }).click();
  await expect(page.getByRole("checkbox", { name: labelTitle, exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByLabel("Title", { exact: true }).fill("Task with ordinary label");
  await page.getByRole("button", { name: "Create one-time task", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/\d+\?/);
  const taskID = /\/tasks\/(\d+)/.exec(page.url())?.[1];
  expect(taskID).toBeTruthy();
  const { taskLabels } = await discussionGraphQL<{ taskLabels: { id: string; title: string }[] }>(
    page,
    "{taskLabels {id title}}",
  );
  const label = taskLabels.find((item) => item.title === labelTitle);
  expect(label).toBeDefined();
  expect(taskLabels.some((item) => item.title.startsWith("vbu:"))).toBe(false);
  await page.goto(`/unscheduled?project=all&label=${label?.id}`);
  await expect(
    page.getByRole("link", { name: "Task with ordinary label", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Task with ordinary label", exact: true }).click();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: labelTitle, exact: true })).toBeChecked();
  await page.getByRole("checkbox", { name: labelTitle, exact: true }).uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).not.toHaveURL(/\/edit/);
  await page.goto(`/unscheduled?project=all&label=${label?.id}`);
  await expect(
    page.getByRole("link", { name: "Task with ordinary label", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("No tasks here.")).toBeVisible();
  await page.goto("/today");
  await page.getByRole("combobox", { name: "Filter by label" }).click();
  await page.getByRole("option", { name: "focus", exact: true }).click();
  await expect(page).toHaveURL(/label=/);
  await expect(
    page.getByRole("link", {
      name: process.env["E2E_LABELED_TITLE"] ?? "Labeled task fixture",
      exact: true,
    }),
  ).toBeVisible();
  const forbidden = await page.request.post("/graphql", {
    data: { query: 'mutation { createTaskLabel(csrfToken: "wrong", title: "blocked") {id} }' },
  });
  expect(forbidden.status()).toBe(403);
  const reserved = await page.request.post("/graphql", {
    headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": session.csrfToken },
    data: {
      query: 'mutation($csrf: String!){createTaskLabel(csrfToken:$csrf,title:" VBU:test "){id}}',
      variables: { csrf: session.csrfToken },
    },
  });
  expect((await reserved.json()).errors[0].extensions.code).toBe("VALIDATION_FAILED");
});
