import { describe, expect, it } from "vitest";
import { draftKey, loadDraft, saveDraft } from "./draft";

describe("discussion drafts", () => {
  it("does not claim to save drafts that cannot be recovered", () => {
    let value = "previous";
    const storage = {
      setItem: (_key: string, next: string) => {
        value = next;
      },
      removeItem: () => undefined,
    };
    expect(saveDraft(storage, "key", "x".repeat(100_001))).toBe(false);
    expect(value).toBe("previous");
  });
  it("isolates task, author and edit drafts", () => {
    expect(
      new Set([draftKey("1", "2"), draftKey("2", "2"), draftKey("1", "3"), draftKey("1", "2", "4")])
        .size,
    ).toBe(4);
  });
  it("tolerates inaccessible storage and corrupted records", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadDraft(storage, "key")).toBe("");
    expect(saveDraft(storage, "key", "text")).toBe(false);
    expect(loadDraft({ getItem: () => '{"body":12}' }, "key")).toBe("");
  });
  it("round trips text and removes only the requested draft when cleared", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    saveDraft(storage, "one", "<p>Work</p>");
    saveDraft(storage, "two", "<p>Other</p>");
    expect(loadDraft(storage, "one")).toBe("<p>Work</p>");
    saveDraft(storage, "one", "");
    expect(loadDraft(storage, "one")).toBe("");
    expect(loadDraft(storage, "two")).toBe("<p>Other</p>");
  });
});
