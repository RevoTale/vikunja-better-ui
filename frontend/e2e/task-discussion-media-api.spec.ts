import { expect, test } from "@playwright/test";
import { discussionFixture, discussionGraphQL } from "./discussion-fixture";

test("discussion media uploads to native attachments and streams privately", async ({
  page,
  playwright,
}) => {
  const { taskId, csrfToken } = await discussionFixture(page);
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=",
    "base64",
  );
  // Exercise gqlgen's >1 MiB temporary-file path, not just its small-buffer path.
  const png = Buffer.concat([pixel, Buffer.alloc(2 * 1024 * 1024)]);
  const uploaded = await page.request.post("/graphql", {
    headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": csrfToken },
    multipart: {
      operations: JSON.stringify({
        query:
          "mutation($input: UploadTaskMediaInput!) { uploadTaskMedia(input:$input) { id taskId name mimeType contentUrl } }",
        variables: { input: { taskId, csrfToken, file: null } },
      }),
      map: JSON.stringify({ file: ["variables.input.file"] }),
      file: { name: "pixel.png", mimeType: "image/png", buffer: png },
    },
  });
  expect(uploaded.ok(), await uploaded.text()).toBe(true);
  const result = await uploaded.json();
  expect(result.errors).toBeUndefined();
  const attachment = result.data.uploadTaskMedia as {
    id: string;
    taskId: string;
    mimeType: string;
    contentUrl: string;
  };
  expect(attachment.taskId).toBe(taskId);
  expect(attachment.mimeType).toBe("image/png");
  const content = await page.request.get(attachment.contentUrl);
  expect(content.status()).toBe(200);
  expect(content.headers()["cache-control"]).toBe("private, no-store");
  expect(await content.body()).toEqual(png);
  const range = await page.request.get(attachment.contentUrl, { headers: { Range: "bytes=0-7" } });
  expect([200, 206]).toContain(range.status());
  if (range.status() === 206) expect(await range.body()).toEqual(png.subarray(0, 8));
  const anonymous = await playwright.request.newContext({ baseURL: new URL(page.url()).origin });
  expect((await anonymous.get(attachment.contentUrl)).status()).toBe(401);
  expect(
    (await page.request.get(`/media/tasks/9999999/attachments/${attachment.id}`)).status(),
  ).toBe(404);
  await anonymous.dispose();
  const metadata = await discussionGraphQL<{ taskAttachments: { items: { id: string }[] } }>(
    page,
    "query($id:ID!){taskAttachments(taskId:$id){items{id}}}",
    { id: taskId },
  );
  expect(metadata.taskAttachments.items.map((item) => item.id)).toContain(attachment.id);

  const native = await page.request.get(
    `${process.env["E2E_VIKUNJA_URL"]}/api/v2/tasks/${taskId}/attachments/${attachment.id}`,
    { headers: { Authorization: `Bearer ${process.env["E2E_VIKUNJA_API_TOKEN"]}` } },
  );
  expect(native.status()).toBe(200);
  expect(await native.body()).toEqual(png);
});
