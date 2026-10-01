import { describe, expect, it } from "vitest";
import { safeLink } from "./html";

describe("discussion links", () => {
  it.each([
    "https://example.com/a",
    "http://example.com",
    "mailto:person@example.com",
    "/tasks/2",
    "/tasks/2/discussion#comment-3",
  ])("allows %s", (url) => {
    expect(safeLink(url)).toBe(true);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "//example.com",
    "/logout",
    "/tasks/2/../../logout",
    "/tasks/2\\evil",
    "file:///etc/passwd",
    "vbscript:test",
  ])("rejects %s", (url) => {
    expect(safeLink(url)).toBe(false);
  });
});
