export const durationUnits = { minutes: 1, hours: 60, days: 1440 } as const;
export type DurationUnit = keyof typeof durationUnits;

export function durationMinutes(amount: string, unit: DurationUnit): string {
  const minutes = Number(amount) * durationUnits[unit];
  return amount.trim() !== "" &&
    Number.isSafeInteger(minutes) &&
    minutes > 0 &&
    minutes <= 2147483647
    ? String(minutes)
    : "";
}

export function durationDisplay(value: string): { amount: string; unit: DurationUnit } {
  const minutes = Number(value);
  let unit: DurationUnit = "minutes";
  if (minutes > 0 && minutes % 1440 === 0) unit = "days";
  else if (minutes > 0 && minutes % 60 === 0) unit = "hours";
  return { amount: value === "" ? "" : String(minutes / durationUnits[unit]), unit };
}
