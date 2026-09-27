import { expect, type Page } from "@playwright/test";

export async function discussionFixture(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("app-user");
  await page.getByLabel("Password").fill("app-password-strong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/week/);
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
  await page.getByRole("link", { name: "Discussion", exact: true }).click();
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
