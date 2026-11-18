import { expect, test } from "@playwright/test";
import { login, submitToken } from "./app-actions";
import { appURL, nativeFixtureSession, projectID, vikunjaURL } from "./app-fixture";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";
import { privateTask, readOnlyToken, secondAccount } from "./personal-token-fixture";

test("token login explains missing profile access and the first navigation works", async ({
  page,
  request,
}) => {
  const limited = await readOnlyToken(request, await nativeFixtureSession(request), {
    tasks: ["read_all"],
  });
  await page.goto("/login");
  await submitToken(page, limited.token);
  await expect(page.getByText(/other:user/)).toBeVisible();
  expect(
    (await page.context().cookies()).some((cookie) => cookie.name.startsWith("vbu_session")),
  ).toBe(false);

  // Click the first usable route link, without waiting for Today data or helper synchronization.
  await submitToken(page);
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await expect(page.getByRole("heading", { name: "This week", exact: true })).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === "/week");
});

test("personal tokens enforce read-only access and upstream revocation", async ({
  page,
  request,
}) => {
  const title = "Read-only session fixture";
  const taskId = await privateTask(request, title);
  const session = await nativeFixtureSession(request);
  const credential = await readOnlyToken(request, session);
  await page.goto("/login");
  await login(page, credential.token);
  const result = await discussionGraphQL<{
    session: { csrfToken: string };
    task: { title: string };
  }>(page, "query($id:ID!){session{csrfToken} task(id:$id){title}}", { id: taskId });
  expect(result.task.title).toBe(title);
  const { csrfToken } = result.session;
  const write = await page.request.post("/graphql", {
    headers: { Origin: appURL, "X-CSRF-Token": csrfToken },
    data: {
      query: "mutation($input:CreateTaskCommentInput!){createTaskComment(input:$input){id}}",
      variables: { input: { taskId, csrfToken, bodyHtml: "<p>Read-only write attempt</p>" } },
    },
  });
  expect((await write.json()).errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
  const comments = await discussionGraphQL<{ taskComments: { items: unknown[] } }>(
    page,
    "query($id:ID!){taskComments(taskId:$id){items{id}}}",
    { id: taskId },
  );
  expect(comments.taskComments.items).toEqual([]);
  const revoked = await request.delete(`${vikunjaURL}/api/v2/tokens/${credential.id}`, {
    headers: { Authorization: `Bearer ${session}` },
  });
  expect(revoked.ok()).toBe(true);
  const profile = await page.request.post("/graphql", {
    headers: { Origin: appURL },
    data: { query: "{ session { vikunjaUser { id } } }" },
  });
  expect((await profile.json()).errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  await page.goto(`/tasks/${taskId}`);
  await expect(page.getByLabel("Vikunja API token")).toBeVisible();
});

test("switching accounts across tabs discards a pending private read and a draft", async ({
  page,
  context,
  request,
}) => {
  const guest = await secondAccount(request);
  const { taskId } = await discussionFixture(page);
  const privateText = "Private comment from the original account";
  const draft = "Unsent draft from the original account";
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill(privateText);
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(page.getByRole("article")).toContainText(privateText);
  await editor.fill(draft);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured = false;
  await page.route("**/graphql", async (route) => {
    if (captured || route.request().postDataJSON()?.operationName !== "DiscussionComments") {
      return route.continue();
    }
    const response = await route.fetch();
    expect(await response.text()).toContain(privateText);
    captured = true;
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole("button", { name: /^Refresh/ }).click();
    await expect.poll(() => captured).toBe(true);
    const switcher = await context.newPage();
    await switcher.goto("/today");
    await switcher.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByLabel("Vikunja API token")).toBeVisible();
    await login(switcher, guest.token);
    await expect(switcher.getByText(guest.username, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}/discussion`));
    release();
    await page.unrouteAll({ behavior: "wait" });
    await expect(page.getByText(guest.username, { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(privateText);
    await expect(page.locator("body")).not.toContainText(draft);
    const projects = await discussionGraphQL<{ projects: { items: { id: string }[] } }>(
      switcher,
      "{projects{items{id}}}",
    );
    expect(projects.projects.items.map((project) => project.id)).not.toContain(projectID);
  } finally {
    release();
  }
});

test("token login keeps its controls stable while pending and after failure", async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (route.request().postDataJSON()?.operationName !== "Login") return route.continue();
    await gate;
    await route.fulfill({
      json: {
        data: null,
        errors: [
          { message: "The token needs permission to read its owner's profile (other:user)." },
        ],
      },
    });
  });
  await page.goto("/login");
  const input = page.getByLabel("Vikunja API token", { exact: true });
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  await expect(input).toHaveAttribute("type", "password");
  await expect(input).toHaveAttribute("autocomplete", "current-password");
  await input.fill("test-entry");
  const before = await input.boundingBox();
  const beforeButton = await submit.boundingBox();
  expect(before).not.toBeNull();
  expect(beforeButton).not.toBeNull();
  try {
    await input.press("Enter");
    const pending = page.getByRole("button", { name: "Signing in…" });
    await expect(pending).toBeDisabled();
    expect(await input.boundingBox()).toEqual(before);
    expect(await pending.boundingBox()).toEqual(beforeButton);
  } finally {
    release();
  }
  await expect(page.getByText(/needs permission to read/)).toBeVisible();
  await expect(input).toBeEnabled();
  expect(await input.boundingBox()).toEqual(before);
  expect(await submit.boundingBox()).toEqual(beforeButton);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
