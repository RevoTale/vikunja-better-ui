import { afterEach, describe, expect, it, vi } from "vitest";
import {
  finishSessionChange,
  sessionChangedElsewhere,
  watchSessionChanges,
} from "./session-change";

function setup() {
  const records = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => records.set(key, value),
  };
  const win = Object.assign(new EventTarget(), { localStorage });
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  const discard = vi.fn();
  watchSessionChanges(discard);
  return { win, doc, records, discard };
}

afterEach(() => vi.unstubAllGlobals());

describe("browser session boundaries", () => {
  it("stores only a change marker and opens the requested destination once", () => {
    const { records, discard } = setup();
    finishSessionChange("/tasks/18");
    expect(Object.fromEntries(records)).toEqual({
      "vbu:session-change": expect.stringMatching(/^\d+\.\d+$/),
    });
    sessionChangedElsewhere();
    expect(discard.mock.calls).toEqual([["/tasks/18"]]);
  });

  it("discards a suspended tab on resume if another tab changed accounts", () => {
    const { doc, records, discard } = setup();
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(discard).not.toHaveBeenCalled();
    records.set("vbu:session-change", "new session");
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(discard).toHaveBeenCalledOnce();
  });

  it("ignores unrelated storage events and discards restored private browser history", () => {
    const { win, discard } = setup();
    win.dispatchEvent(Object.assign(new Event("storage"), { key: "draft" }));
    expect(discard).not.toHaveBeenCalled();
    win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(discard).toHaveBeenCalledOnce();
  });
});
