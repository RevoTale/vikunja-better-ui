export type TaskLabel = { id: string; title: string };

export function isInternalTaskLabel(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return normalized.startsWith("vbu:");
}

export function taskLabelOptions(labels: readonly TaskLabel[]) {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label.title, (counts.get(label.title) ?? 0) + 1);
  return labels
    .filter((label) => !isInternalTaskLabel(label.title))
    .map((label) => ({
      value: label.id,
      label: (counts.get(label.title) ?? 0) > 1 ? `${label.title} (#${label.id})` : label.title,
    }));
}
