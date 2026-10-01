import { describe, expect, it } from "vitest";
import { emojiShortcodeMatch, findEmoji, loadEmojiChoices } from "./emoji-data";

describe("Unicode emoji suggestions", () => {
  it.each(["https://example.test/:smile:", "word:smile", "http://", ":x"])(
    "does not treat %s as a shortcode",
    (text) => expect(emojiShortcodeMatch(text)).toBeNull(),
  );
  it("matches only the trailing token and keeps offsets", () => {
    expect(emojiShortcodeMatch("Keep :thumbsup:")).toEqual({
      leadOffset: 5,
      matchingString: "thumbsup",
      replaceableString: ":thumbsup:",
    });
  });
  it("loads searchable joined emoji and skin tones without unknown-code fallbacks", async () => {
    const choices = await loadEmojiChoices();
    expect(findEmoji(choices, "thumbsup").length).toBeGreaterThan(0);
    expect(
      findEmoji(choices, "thumbs up medium skin tone").some((choice) => choice.unicode === "👍🏽"),
    ).toBe(true);
    expect(choices.some((choice) => choice.unicode === "👩‍💻")).toBe(true);
    expect(findEmoji(choices, "not_a_real_shortcode_123")).toEqual([]);
  });
});
