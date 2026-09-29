import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createTask } from "./app-actions";
import { graphQLOperation } from "./app-api";

export async function workflowHistory(page: Page, unscheduled: string) {
  await createTask(page, "one-time task", unscheduled, async () => {
    await expect(page.locator('input[name="dueDate"]')).toHaveValue("");
  });
  const unscheduledResponse = page.waitForResponse(
    (response) => graphQLOperation(response.request().postData()) === "TaskList",
  );
  await page.goto("/unscheduled");
  await unscheduledResponse;
  const taskList = page.locator("main section > div[aria-busy]").filter({
    has: page.locator('[data-slot="card"]'),
  });
  await expect(taskList).toHaveAttribute("aria-busy", "false");
  while (!(await page.getByText(unscheduled, { exact: true }).isVisible())) {
    const next = page.getByRole("button", { name: "Go to next page" });
    await expect(next).toBeEnabled();
    const nextResponse = page.waitForResponse(
      (response) => graphQLOperation(response.request().postData()) === "TaskList",
    );
    await next.click();
    await nextResponse;
    await expect(taskList).toHaveAttribute("aria-busy", "false");
  }
  await expect(page.getByText(unscheduled, { exact: true })).toBeVisible();

  await page.goto("/history");
  const historyTasks = page.locator('main a[href^="/tasks/"]:not([href^="/tasks/new"])');
  await expect(historyTasks).toHaveCount(30);
  await page.getByRole("button", { name: "Go to page 5" }).click();
  await expect(page).toHaveURL(/\/history\?project=all&page=5/);
  await expect.poll(() => historyTasks.count()).toBeGreaterThan(0);
  await expect(historyTasks).not.toHaveCount(30);
  await expect(page.getByRole("button", { name: "Go to page 5" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("button", { name: "Go to next page" })).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}
