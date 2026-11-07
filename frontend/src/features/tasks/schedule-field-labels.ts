export function scheduleFieldLabels(oneTime: boolean) {
  return oneTime
    ? { start: "Available from", end: "Planned finish", due: "Deadline" }
    : { start: "Start", end: "End", due: "Due" };
}
