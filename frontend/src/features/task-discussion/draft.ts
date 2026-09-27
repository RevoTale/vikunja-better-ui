export function draftKey(taskId: string, authorId: string, commentId = "new"): string {
  return `vbu:discussion:v1:${authorId}:${taskId}:${commentId}`;
}

export function draftStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadDraft(storage: Pick<Storage, "getItem"> | undefined, key: string): string {
  try {
    const value: unknown = JSON.parse(storage?.getItem(key) ?? "null");
    if (typeof value !== "object" || value === null || !("body" in value)) return "";
    return typeof value.body === "string" && value.body.length <= 100_000 ? value.body : "";
  } catch {
    return "";
  }
}

export function saveDraft(
  storage: Pick<Storage, "setItem" | "removeItem"> | undefined,
  key: string,
  body: string,
): boolean {
  if (!storage || body.length > 100_000) return false;
  try {
    if (body) storage.setItem(key, JSON.stringify({ body }));
    else storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
