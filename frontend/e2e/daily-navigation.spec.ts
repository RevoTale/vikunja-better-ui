import { expect, test } from "@playwright/test";
import { login } from "./app-actions";
import { addCalendarDays, localDate } from "./app-calendar";
import { discussionGraphQL } from "./discussion-fixture";

test("daily navigation supports real and computed days, filters and date-prefilled creation", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);
  await expect(page).toHaveURL(/\/today/);
  const tomorrow = addCalendarDays(localDate(), 1);
  await expect(page.getByRole("button", { name: "Next day", exact: true })).toBeEnabled();
  let sessionReads = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/graphql") && request.postDataJSON()?.operationName === "Session")
      sessionReads++;
  });
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  const day = page.locator('[data-slot="week-day"]');
  await expect(day).toHaveAttribute("data-date", tomorrow);
  // The fresh route-auth read invalidates partial Session metadata once.
  // The day view must not start a second metadata request after that refresh.
  expect(sessionReads).toBe(1);
  await expect(day.getByText("Computed", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(day).toHaveAttribute("data-date", addCalendarDays(tomorrow, 1));
  await page.getByRole("button", { name: "Previous day", exact: true }).click();
  await expect(day).toHaveAttribute("data-date", tomorrow);
  await page.getByRole("combobox", { name: "Filter by label" }).click();
  await page.getByRole("option", { name: "focus", exact: true }).click();
  await expect(page).toHaveURL(/label=/);
  await expect(day).toHaveAttribute("data-date", tomorrow);
  await day.getByRole("link", { name: /Add task for/ }).click();
  await expect(page.locator('input[name="dueDate"]')).toHaveValue(tomorrow);
  await page.goto("/today");
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(day).toHaveAttribute("data-date", tomorrow);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/date=/);
});

test("daily navigation supports long term dated and undated tasks through native filters", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);
  await expect(page).toHaveURL(/\/today/);
  const { session } = await discussionGraphQL<{ session: { csrfToken: string } }>(
    page,
    "{session {csrfToken}}",
  );
  const suffix = `${test.info().project.name}-${Date.now()}`;
  const { createTaskLabel } = await discussionGraphQL<{ createTaskLabel: { id: string } }>(
    page,
    "mutation($csrf:String!,$title:String!){createTaskLabel(csrfToken:$csrf,title:$title){id}}",
    { csrf: session.csrfToken, title: `daily-${suffix}` },
    session.csrfToken,
  );
  for (const [kind, days] of [
    ["undated", null],
    ["later", 9],
    ["near", 2],
  ] as const) {
    await discussionGraphQL(
      page,
      "mutation($input:CreateOneTimeTaskInput!){createOneTimeTask(input:$input){task{id}}}",
      {
        input: {
          csrfToken: session.csrfToken,
          title: `${kind}-${suffix}`,
          projectId: process.env["E2E_PROJECT_ID"],
          priority: "UNSET",
          labelIds: [createTaskLabel.id],
          ...(days !== null ? { dueDate: addCalendarDays(localDate(), days) } : {}),
        },
      },
      session.csrfToken,
    );
  }
  const { tasks } = await discussionGraphQL<{ tasks: { items: { title: string }[] } }>(
    page,
    "query($input:TaskListInput!){tasks(input:$input){items{title}}}",
    {
      input: {
        scope: "LONG_TERM",
        pageSize: 100,
        page: 1,
        projectId: process.env["E2E_PROJECT_ID"],
        labelId: createTaskLabel.id,
      },
    },
  );
  const titles = tasks.items.map((task) => task.title);
  expect(titles).toHaveLength(2);
  expect(titles).toContain(`undated-${suffix}`);
  expect(titles).toContain(`later-${suffix}`);
  expect(titles).not.toContain(`near-${suffix}`);
  await page.goto(
    `/unscheduled?project=${process.env["E2E_PROJECT_ID"]}&label=${createTaskLabel.id}`,
  );
  await expect(page.getByRole("heading", { name: "Long term", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Later", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `later-${suffix}`, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No deadline", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `undated-${suffix}`, exact: true })).toBeVisible();
});
