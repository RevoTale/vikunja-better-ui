import { useEffect, useState } from "react";
import { type EmojiChoice, loadEmojiChoices } from "./emoji-data";

export function useEmojiData(active: boolean) {
  const [choices, setChoices] = useState<EmojiChoice[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setError(false);
    void loadEmojiChoices()
      .then((loaded) => {
        if (!cancelled) setChoices(loaded);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);
  return { choices, error };
}
