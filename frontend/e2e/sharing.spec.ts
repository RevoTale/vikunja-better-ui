import { expect, test } from "@playwright/test";
import { discussionFixture } from "./discussion-fixture";

test("sharing preserves filters and addresses tasks and comments directly", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value: string) => {
          document.documentElement.dataset["copied"] = value;
        },
      },
      configurable: true,
    });
  });
  const { taskId } = await discussionFixture(page);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill("Share this specific comment");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  const comment = page.getByRole("article").filter({ hasText: "Share this specific comment" });
  const commentId = (await comment.getAttribute("id"))?.replace("comment-", "");
  await comment.getByRole("button", { name: "Share comment", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-copied",
    `${new URL(page.url()).origin}/tasks/${taskId}/discussion?comment=${commentId}`,
  );
  await page.goto(`/unscheduled?project=${process.env["E2E_PROJECT_ID"]}&page=1&priority=UNSET`);
  await page.getByRole("button", { name: "Share page", exact: true }).click();
  const copied = await page.locator("html").getAttribute("data-copied");
  expect(new URL(copied ?? "").searchParams.get("project")).toBe(process.env["E2E_PROJECT_ID"]);
  expect(new URL(copied ?? "").searchParams.get("priority")).toBe("UNSET");
  await page.goto(`/tasks/${taskId}?returnTo=%2Ftoday`);
  await page.getByRole("button", { name: "Share task", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-copied",
    `${new URL(page.url()).origin}/tasks/${taskId}`,
  );
  await page.goto(`/unscheduled?project=${process.env["E2E_PROJECT_ID"]}&page=1&priority=UNSET`);
  await page.screenshot({ path: testInfo.outputPath("sharing-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.getByRole("button", { name: "Share page", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("sharing-phone.png"), fullPage: true });
});

test("sharing handles native cancellation and unavailable clipboard without false success", async ({
  page,
}) => {
  await discussionFixture(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Unavailable");
        },
      },
    });
  });
  await page.getByRole("button", { name: "Share page", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Link copied.", { exact: true })).toHaveCount(0);
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await page.getByRole("button", { name: "Share page", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Copy link" })).toBeVisible();
  const url = new URL(page.url());
  url.searchParams.delete("returnTo");
  await expect(page.getByRole("textbox", { name: "Link to share" })).toHaveValue(url.href);
});
