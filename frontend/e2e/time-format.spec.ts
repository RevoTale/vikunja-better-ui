import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion supports the configured clock independently of browser locale", async ({
  page,
}) => {
  await discussionFixture(page);
  const twelve = process.env["APP_TIME_FORMAT"] === "12h";
  const settings = await discussionGraphQL<{ session: { use12HourTime: boolean } }>(
    page,
    "{ session { use12HourTime } }",
  );
  expect(settings.session.use12HourTime).toBe(twelve);
  await page.goto("/tasks/new?type=job");
  await page.getByLabel("Title (optional)").fill("Configured clock job");
  const start = page.getByLabel("Start time", { exact: true });
  await expect(start).toHaveAttribute("type", "text");
  await start.fill(twelve ? "09:07" : "2107");
  if (twelve) {
    await page.getByRole("combobox", { name: "startTime AM/PM", exact: true }).click();
    await page.getByRole("option", { name: "PM", exact: true }).click();
  }
  await expect(page.locator('input[name="startTime"]')).toHaveValue("21:07");
  await start.fill(twelve ? "13:07" : "24:07");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(page.getByText("Enter a valid time.", { exact: true })).toBeVisible();
  await start.fill(twelve ? "09:07" : "21:07");
  await page.getByRole("button", { name: "Create job", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Configured clock job", exact: true }),
  ).toBeVisible();
  const properties = page.getByRole("complementary", { name: "Task properties" });
  await expect(properties).toContainText(twelve ? "09:07 PM" : "21:07");
  if (!twelve) await expect(properties).not.toContainText(/\b(?:AM|PM)\b/);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Start time", { exact: true })).toHaveValue(
    twelve ? "09:07" : "21:07",
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Configured clock job", exact: true }),
  ).toBeVisible();
  await expect(properties).toContainText(twelve ? "09:07 PM" : "21:07");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
