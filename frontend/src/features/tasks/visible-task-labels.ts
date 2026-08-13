const markerLabels = new Set(["job", "vbu:date-only", "vbu:recurrence-history"]);

export function visibleTaskLabels<T extends { title: string }>(labels: readonly T[]): T[] {
  return labels.filter((label) => !markerLabels.has(label.title));
}
