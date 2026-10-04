import { expect, type Page, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("discussion supports long project and label values in task creation, detail and editing", async ({
  page,
}) => {
  await discussionFixture(page);
  const title = `Mobile fields ${Date.now()}`;
  const label = `mobile-${"unbroken".repeat(12)}`;
  await page.goto("/tasks/new?type=job");
  await page.getByLabel("Title (optional)").fill(title);
  await page.getByRole("combobox", { name: "Project", exact: true }).click();
  await page.getByRole("option", { name: /^E2E Project With A Deliberately Long/ }).click();
  await expectFieldsWithinViewport(page);
  await page.getByLabel("Start time", { exact: true }).fill("23:59");
  await page.getByLabel("Find or create label").fill(label);
  await page.getByRole("button", { name: "Create or reuse label", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
  await expectFieldsWithinViewport(page);
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
  await expectFieldsWithinViewport(page);
  const id = /\/tasks\/(\d+)/.exec(page.url())?.[1];
  expect(id).toBeDefined();
  await page.goto(`/tasks/${id}/edit`);
  await expect(page.getByRole("textbox", { name: "Description", exact: true })).toBeVisible();
  await expect(page.getByLabel("Start time", { exact: true })).toHaveValue("23:59");
  for (const name of ["Start time", "End time", "Due time"]) {
    await page.getByLabel(name, { exact: true }).focus();
    await expectFieldsWithinViewport(page);
  }
  await expect(page.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
});

async function expectFieldsWithinViewport(page: Page) {
  await test.info().attach("field-layout", {
    body: JSON.stringify(
      await page.locator("main").evaluate((main) =>
        Array.from(main.querySelectorAll("*"))
          .filter(
            (node) => node.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
          )
          .slice(0, 20)
          .map((node) => ({
            tag: node.tagName,
            class: node.className,
            width: node.getBoundingClientRect().width,
            minWidth: getComputedStyle(node).minWidth,
            text: node.textContent?.slice(0, 90),
          })),
      ),
      null,
      2,
    ),
    contentType: "application/json",
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
  const escapedControls = await page.locator("main").evaluate((main) =>
    Array.from(main.querySelectorAll('input:not([type="hidden"]),button[role="combobox"]'))
      .filter((node) => {
        const box = node.getBoundingClientRect();
        return (
          box.width > 0 && (box.left < -1 || box.right > document.documentElement.clientWidth + 1)
        );
      })
      .map((node) => node.getAttribute("name") ?? node.getAttribute("id")),
  );
  expect(escapedControls).toEqual([]);
}
