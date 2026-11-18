import { expect, type Page } from "@playwright/test";
import { submitToken } from "./app-actions";

export async function discussionFixture(page: Page) {
  await page.goto("/login");
  await submitToken(page);
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const {
    session: { csrfToken },
  } = await discussionGraphQL<{ session: { csrfToken: string } }>(
    page,
    "{ session { csrfToken } }",
  );
  const {
    createOneTimeTask: {
      task: { id },
    },
  } = await discussionGraphQL<{ createOneTimeTask: { task: { id: string } } }>(
    page,
    "mutation($input: CreateOneTimeTaskInput!) { createOneTimeTask(input: $input) { task { id } } }",
    {
      input: {
        csrfToken,
        title: "Discussion journal",
        projectId: process.env["E2E_PROJECT_ID"],
        priority: "UNSET",
      },
    },
    csrfToken,
  );
  await page.goto(`/tasks/${id}`);
  await page.getByRole("link", { name: "Open separately: Discussion", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Comment", exact: true })).toBeVisible();
  return { taskId: id, csrfToken };
}

export async function discussionGraphQL<T>(
  page: Page,
  query: string,
  variables: Record<string, unknown> = {},
  csrfToken?: string,
): Promise<T> {
  const response = await page.request.post("/graphql", {
    headers: {
      Origin: new URL(page.url()).origin,
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    data: { query, variables },
  });
  expect(response.ok()).toBe(true);
  const result = (await response.json()) as { data: T; errors?: unknown };
  expect(result.errors).toBeUndefined();
  return result.data;
}
