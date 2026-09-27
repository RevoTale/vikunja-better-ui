import { describe, expect, it } from "vitest";
import { mediaReference } from "./media-reference";

describe("mediaReference", () => {
  it("maps native and application attachment identities to same-origin content", () => {
    for (const source of [
      "https://vikunja.example/sub/api/v1/tasks/42/attachments/8",
      "/api/v2/tasks/42/attachments/8",
      "/media/tasks/42/attachments/8",
    ]) {
      expect(mediaReference(source)).toEqual({
        taskId: "42",
        attachmentId: "8",
        contentUrl: "/media/tasks/42/attachments/8",
        sourceUrl: source,
      });
    }
  });
  it("rejects arbitrary sources, credentials, parameters and unsafe identities", () => {
    for (const source of [
      "https://example.com/image.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "https://user:pass@example.com/api/v1/tasks/42/attachments/8",
      "/api/v1/tasks/0/attachments/8",
      "/api/v1/tasks/42/attachments/-8",
      "/api/v1/tasks/42/attachments/8?token=secret",
      "/api/v1/tasks/42/attachments/9223372036854775808",
      "//example.com/api/v1/tasks/42/attachments/8",
    ]) {
      expect(mediaReference(source)).toBeNull();
    }
  });
});
