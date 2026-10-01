export type EmojiChoice = { unicode: string; label: string; search: string };

let pending: Promise<EmojiChoice[]> | undefined;

// Bundle only the English compact dataset, lazily, without a third-party network request.
// https://emojibase.dev/docs/datasets/#compact-format
export function loadEmojiChoices(): Promise<EmojiChoice[]> {
  pending ??= import("virtual:vbu-emoji")
    .then(({ default: rows }) =>
      rows.map(([unicode, label, aliases]) => ({
        unicode,
        label,
        search: `${label} ${aliases}`.toLowerCase(),
      })),
    )
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
}

export function findEmoji(choices: readonly EmojiChoice[], query: string, limit = 60) {
  const words = query.toLowerCase().replaceAll("_", " ").split(/\s+/u).filter(Boolean);
  return choices
    .filter((choice) => words.every((word) => choice.search.includes(word)))
    .slice(0, limit);
}

export function emojiShortcodeMatch(text: string) {
  const match = /(?:^|\s):([\w+-]{2,40}):?$/u.exec(text);
  if (!match?.[1]) return null;
  const replaceableString = match[0].trimStart();
  return {
    leadOffset: text.length - replaceableString.length,
    matchingString: match[1],
    replaceableString,
  };
}
