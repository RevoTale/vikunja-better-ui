import { expect, test } from "@playwright/test";
import { createTask, login } from "./app-actions";
import { searchTasks, vikunjaTask } from "./app-api";

test("task relationships support quick child creation without schedule inheritance", async ({
  page,
}) => {
  await page.goto("/today");
  await login(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const suffix = Date.now();
  const parent = await createTask(page, "one-time task", `Quick parent ${suffix}`);
  const before = await vikunjaTask(parent);
  await page.goto(`/tasks/${parent}`);
  await page.getByRole("button", { name: "New subtask", exact: true }).click();
  const form = page.getByRole("form", { name: "New subtask" });
  const title = `Quick child ${suffix}`;
  await form.getByLabel("Subtask title").fill(title);
  await form.getByRole("button", { name: "Add subtask", exact: true }).click();
  await expect(form.getByRole("link", { name: title, exact: true })).toBeVisible();
  await expect(form.getByLabel("Subtask title")).toHaveValue("");
  const children = await searchTasks(title);
  expect(children).toHaveLength(1);
  const child = children[0];
  if (!child) throw new Error("Missing created child");
  expect(child.repeat_after).toBe(0);
  expect(child.done).toBe(false);
  expect(child.priority).toBe(before.priority);
  expect(child.due_date).toMatch(/^0001-/);
  expect(child.labels ?? []).toEqual(
    (before.labels ?? []).filter((label) => !label.title.startsWith("vbu:")),
  );
  await expect(
    page
      .getByRole("region", { name: "Subtasks", exact: true })
      .getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
