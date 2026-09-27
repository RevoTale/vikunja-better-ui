export type MediaKind = "image" | "audio" | "video";
export type MediaReference = {
  taskId: string;
  attachmentId: string;
  contentUrl: string;
  sourceUrl: string;
};

// Parse an identity, never a fetch destination. Even an absolute native URL is
// displayed only through our authenticated same-origin attachment endpoint.
export function mediaReference(source: string): MediaReference | null {
  if (source.startsWith("//")) return null;
  try {
    const url = new URL(source, "https://attachment.invalid");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    const match = /\/(?:api\/v[12]|media)\/tasks\/([1-9]\d*)\/attachments\/([1-9]\d*)$/.exec(
      url.pathname,
    );
    const taskId = match?.[1];
    const attachmentId = match?.[2];
    if (
      !taskId ||
      !attachmentId ||
      taskId.length > 19 ||
      attachmentId.length > 19 ||
      BigInt(taskId) > 9223372036854775807n ||
      BigInt(attachmentId) > 9223372036854775807n
    )
      return null;
    return {
      taskId,
      attachmentId,
      contentUrl: `/media/tasks/${taskId}/attachments/${attachmentId}`,
      sourceUrl: source,
    };
  } catch {
    return null;
  }
}

export function mediaKind(mime: string): MediaKind | null {
  if (["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mime)) return "image";
  if (
    [
      "audio/mpeg",
      "audio/wave",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "application/ogg",
      "audio/flac",
      "audio/mp4",
      "audio/webm",
    ].includes(mime)
  )
    return "audio";
  if (["video/mp4", "video/webm", "video/ogg"].includes(mime)) return "video";
  return null;
}
