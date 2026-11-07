import { expect, test } from "@playwright/test";
import { createTask, login } from "./app-actions";
import { chooseSelectOption } from "./app-layout";

test("recurring overview groups live routines and opens creation with Repeat selected", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);
  const suffix = Date.now();
  const daily = `Practice piano ${suffix}`;
  const monthly = `Review household expenses ${suffix}`;
  const once = `Buy sheet music ${suffix}`;
  await createTask(page, "one-time task", once);
  await createTask(page, "recurring task", daily);
  await createTask(page, "recurring task", monthly, () =>
    chooseSelectOption(page, "Unit", "Months"),
  );
  await page.goto("/more");
  await page.getByRole("link", { name: /^Recurring/ }).click();
  await expect(
    page.getByRole("region", { name: "Daily" }).getByRole("link", { name: daily }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Monthly" }).getByRole("link", { name: monthly }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: once })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Daily", exact: true })).toContainText("7× / week");
  await page.getByRole("button", { name: "Year", exact: true }).click();
  await expect(page.getByRole("region", { name: "Monthly", exact: true })).toContainText(
    "12× / year",
  );
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(page.getByRole("region", { name: "Daily", exact: true })).toContainText(
    "≈ 30.4× / month",
  );
  await page.getByRole("link", { name: "New recurring task" }).click();
  await expect(page.getByRole("button", { name: "Repeat", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
