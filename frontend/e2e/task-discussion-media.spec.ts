import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { commentMenu } from "./comment-menu-fixture";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";
import { silentWave } from "./discussion-media-fixture";

const pixel = {
  name: "pixel.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=",
    "base64",
  ),
};

test("discussion supports image uploads without overwriting newer text", async ({
  page,
}, testInfo) => {
  const { taskId } = await discussionFixture(page);
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let uploads = 0;
  await page.route("**/graphql", async (route) => {
    if (route.request().headers()["content-type"]?.startsWith("multipart/form-data")) {
      uploads++;
      await held;
    }
    await route.continue();
  });
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill("Before upload");
  await page.getByText("Media and attachments", { exact: true }).click();
  await page.getByLabel("Upload media", { exact: true }).setInputFiles(pixel);
  await expect(page.getByRole("button", { name: "Post comment", exact: true })).toBeDisabled();
  await editor.press("ControlOrMeta+End");
  await editor.pressSequentially(" Text typed while uploading.");
  release();
  await expect(page.getByLabel("Image alternative text")).toBeVisible();
  await page.getByLabel("Image alternative text").fill("A tiny test image");
  await expect(editor).toContainText("Text typed while uploading.");
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("media-editor.png"), fullPage: true });
  await page.reload();
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await expect(page.getByLabel("Image alternative text")).toHaveValue("A tiny test image");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  const comment = page.getByRole("article").filter({ hasText: "Before upload" });
  await expect(comment).toContainText("Text typed while uploading.");
  await expect(comment.getByAltText("A tiny test image")).toBeVisible();
  expect(uploads).toBe(1);
  await (await commentMenu(page, comment))
    .getByRole("menuitem", { name: "Edit", exact: true })
    .click();
  await expect(page.getByLabel("Image alternative text")).toHaveValue("A tiny test image");
  await page.getByRole("button", { name: "Remove media", exact: true }).click();
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  const data = await discussionGraphQL<{ taskAttachments: { items: unknown[] } }>(
    page,
    "query($id:ID!){taskAttachments(taskId:$id){items{id}}}",
    { id: taskId },
  );
  expect(data.taskAttachments.items).toHaveLength(1);
});

test("discussion retries a rejected upload only after an explicit decision", async ({ page }) => {
  await discussionFixture(page);
  let attempts = 0;
  await page.route("**/graphql", async (route) => {
    if (route.request().headers()["content-type"]?.startsWith("multipart/form-data")) {
      attempts++;
      if (attempts === 1) {
        await route.fulfill({ status: 503, body: "Unavailable before upload" });
        return;
      }
    }
    await route.continue();
  });
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill("Keep this draft");
  await page.getByText("Media and attachments", { exact: true }).click();
  const picker = page.getByLabel("Upload media", { exact: true });
  await picker.setInputFiles(pixel);
  await expect(picker).toBeDisabled();
  await expect(editor).toContainText("Keep this draft");
  expect(attempts).toBe(1);
  await page.getByRole("button", { name: "Choose task attachment", exact: true }).click();
  await expect(page.getByText("No attachments yet.", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "I checked attachments; allow another upload", exact: true })
    .click();
  await picker.setInputFiles(pixel);
  await expect(page.getByLabel("Image alternative text")).toBeVisible();
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(page.getByRole("article")).toContainText("Keep this draft");
  expect(attempts).toBe(2);
});

test("discussion recovers a lost upload response without duplicating attachments", async ({
  page,
}) => {
  const { taskId } = await discussionFixture(page);
  let uploads = 0;
  await page.route("**/graphql", async (route) => {
    if (route.request().headers()["content-type"]?.startsWith("multipart/form-data")) {
      uploads++;
      await route.fetch();
      await route.fulfill({ status: 502, body: "Connection lost after upstream upload" });
    } else await route.continue();
  });
  await page.getByRole("textbox", { name: "Comment", exact: true }).fill("Preserved draft");
  await page.getByText("Media and attachments", { exact: true }).click();
  await page.getByLabel("Upload media", { exact: true }).setInputFiles(pixel);
  await expect(page.getByText("Upload could not be confirmed.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Upload media", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Choose task attachment", exact: true }).click();
  await page.getByRole("button", { name: "Insert pixel.png", exact: true }).click();
  await expect(page.getByLabel("Image alternative text")).toBeVisible();
  await page.getByLabel("Image alternative text").fill("Recovered upload");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(page.getByRole("article").getByAltText("Recovered upload")).toBeVisible();
  expect(uploads).toBe(1);
  const metadata = await discussionGraphQL<{ taskAttachments: { items: unknown[] } }>(
    page,
    "query($id:ID!){taskAttachments(taskId:$id){items{id}}}",
    { id: taskId },
  );
  expect(metadata.taskAttachments.items).toHaveLength(1);
});

test("discussion does not resurrect a removed upload placeholder", async ({ page }) => {
  await discussionFixture(page);
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/graphql", async (route) => {
    if (route.request().headers()["content-type"]?.startsWith("multipart/form-data")) await held;
    await route.continue();
  });
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.fill("Keep this instead");
  await page.getByText("Media and attachments", { exact: true }).click();
  await page.getByLabel("Upload media", { exact: true }).setInputFiles(pixel);
  await page.getByRole("button", { name: "Remove media", exact: true }).click();
  release();
  await expect(page.getByText("pixel.png uploaded.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Image alternative text")).toHaveCount(0);
  await expect(editor).toContainText("Keep this instead");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(page.getByRole("article")).toContainText("Keep this instead");
  await expect(page.getByRole("article").locator(".discussion-rich-text img")).toHaveCount(0);
});

test("discussion supports pasted images, dropped audio and media-only comments", async ({
  page,
}) => {
  await discussionFixture(page);
  const editor = page.getByRole("textbox", { name: "Comment", exact: true });
  await editor.focus();
  await editor.evaluate(
    (element, bytes) => {
      const clipboardData = new DataTransfer();
      clipboardData.items.add(
        new File([new Uint8Array(bytes)], "pasted.png", { type: "image/png" }),
      );
      element.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
      );
    },
    [...pixel.buffer],
  );
  await page.getByLabel("Image alternative text").fill("Pasted image");
  await editor.evaluate(
    (element, bytes) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(
        new File([new Uint8Array(bytes)], "recording.wav", { type: "audio/wav" }),
      );
      element.dispatchEvent(
        new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }),
      );
    },
    [...silentWave()],
  );
  const audio = editor.locator("audio");
  await expect(audio).toBeVisible();
  await expect(audio).toHaveAttribute("controls", "");
  await expect(audio).not.toHaveAttribute("autoplay");
  await expect
    .poll(() => audio.evaluate((element) => element.readyState))
    .toBeGreaterThanOrEqual(1);
  await audio.evaluate((element) => element.play());
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(0);
  await audio.evaluate((element) => element.pause());
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  const article = page.getByRole("article");
  await expect(article.getByAltText("Pasted image")).toBeVisible();
  await expect(article.locator("audio")).toBeVisible();
  await (await commentMenu(page, article))
    .getByRole("menuitem", { name: "Edit", exact: true })
    .click();
  await expect(page.getByLabel("Image alternative text")).toHaveValue("Pasted image");
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  await expect(article.locator("audio")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("discussion plays an uploaded video with native controls and no autoplay", async ({
  page,
  browser,
}, testInfo) => {
  await discussionFixture(page);
  // Use Playwright's bundled video recorder, avoiding GPU encoder support in
  // headless Chromium and avoiding downloaded or committed media fixtures.
  const fixtureContext = await browser.newContext({
    recordVideo: { dir: testInfo.outputPath("fixture"), size: { width: 64, height: 64 } },
  });
  const fixturePage = await fixtureContext.newPage();
  await fixturePage.setContent("<p>Video fixture</p>");
  await fixturePage.screenshot();
  const videoFile = fixturePage.video();
  await fixtureContext.close();
  if (!videoFile) throw new Error("Video fixture was not recorded");
  const recording = await readFile(await videoFile.path());
  await page.getByText("Media and attachments", { exact: true }).click();
  await page
    .getByLabel("Upload media", { exact: true })
    .setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: recording });
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).not.toHaveAttribute("autoplay");
  await expect
    .poll(() => video.evaluate((element) => element.readyState))
    .toBeGreaterThanOrEqual(1);
  await video.evaluate((element) => element.play());
  await expect.poll(() => video.evaluate((element) => element.currentTime)).toBeGreaterThan(0);
  await video.evaluate((element) => element.pause());
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(page.getByRole("article").locator("video")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("video-comment.png"), fullPage: true });
});
