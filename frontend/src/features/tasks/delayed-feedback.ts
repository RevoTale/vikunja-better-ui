export function scheduleDelayedFeedback(show: () => void, delay: number): () => void {
  const timeout = setTimeout(show, delay);
  return () => clearTimeout(timeout);
}
