import { expect, test } from "@playwright/test";
import { addCalendarDays, localDate, localDateTime, selectDate } from "./app-calendar";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("full editor retains exact scheduling and validates existing planning deadlines", async ({
  page,
}) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const start = localDate();
  const finish = addCalendarDays(start, 30);
  const deadline = addCalendarDays(finish, 1);
  await page.goto(`/tasks/${taskId}/edit`);
  await expect(page.getByLabel("Available from time", { exact: true })).toBeVisible();
  await page.getByText("Shift schedule", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Apply shift to fields" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Do once", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "This month", exact: true })).toHaveCount(0);
  const delayed = addCalendarDays(start, 2);
  await selectDate(page, "Available from date", delayed);
  await selectDate(page, "Planned finish date", finish);
  await selectDate(page, "Deadline date", deadline);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}\\?`));
  const read = () =>
    discussionGraphQL<{ task: { startAt: string; endAt: string; dueAt: string } }>(
      page,
      "query($id: ID!) { task(id: $id) { startAt endAt dueAt } }",
      { id: taskId },
      csrfToken,
    );
  const planned = (await read()).task;
  expect(localDateTime(planned.startAt)).toBe(`${delayed}T00:00`);
  expect(new Date(planned.endAt).getUTCSeconds()).toBe(59);
  expect(localDateTime(planned.endAt)).toBe(`${finish}T23:59`);
  await page.goto(`/tasks/${taskId}/edit`);
  await expect(page.getByLabel("Available from time", { exact: true })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("Preserved planning precision");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}\\?`));
  expect((await read()).task).toEqual(planned);
  await page.goto(`/tasks/${taskId}/edit`);
  await selectDate(page, "Deadline date", addCalendarDays(finish, -1));
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("deadline");
  await selectDate(page, "Deadline date", finish);
  await page.getByLabel("Deadline time", { exact: true }).fill("10:00");
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeEnabled();
  await page.getByLabel("Planned finish time", { exact: true }).fill("09:00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}\\?`));
  expect((await read()).task.endAt).not.toBe(planned.endAt);
});
