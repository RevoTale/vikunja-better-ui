import { createEditor } from "lexical";
import { expect, it, vi } from "vitest";
import { registerLinkEvents } from "./editor-link-events";

it("moves link shortcuts with the editor root and removes them on cleanup", () => {
  const editor = createEditor();
  // Only event registration is exercised here; rendering is covered in browser E2E.
  const first = new EventTarget() as HTMLElement;
  const second = new EventTarget() as HTMLElement;
  const open = vi.fn();
  let changeRoot: Parameters<typeof editor.registerRootListener>[0] = () => undefined;
  vi.spyOn(editor, "registerRootListener").mockImplementation((listener) => {
    changeRoot = listener;
    listener(first, null);
    return () => listener(null, second);
  });
  const unregister = registerLinkEvents(editor, open);
  const press = (root: HTMLElement) =>
    root.dispatchEvent(
      Object.assign(new Event("keydown", { cancelable: true }), {
        key: "k",
        ctrlKey: true,
      }),
    );
  press(first);
  expect(open).toHaveBeenCalledTimes(1);
  changeRoot(second, first);
  press(first);
  expect(open).toHaveBeenCalledTimes(1);
  press(second);
  expect(open).toHaveBeenCalledTimes(2);
  unregister();
  press(second);
  expect(open).toHaveBeenCalledTimes(2);
});
