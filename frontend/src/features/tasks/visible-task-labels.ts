import { isInternalTaskLabel } from "./task-label-options";

export function visibleTaskLabels<T extends { title: string }>(labels: readonly T[]): T[] {
  return labels.filter((label) => !isInternalTaskLabel(label.title));
}
