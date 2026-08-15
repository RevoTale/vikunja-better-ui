const markerLabels = new Set([
  "job",
  "vbu:date-only",
  "vbu:recurrence-history",
  "vbu:skipped",
  "vbu:fixed-due-time",
]);

export function visibleTaskLabels<T extends { title: string }>(labels: readonly T[]): T[] {
  return labels.filter((label) => !markerLabels.has(label.title));
}
