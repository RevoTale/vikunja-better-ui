const weekDay = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function activityWeekLabel(start: string) {
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(first);
  last.setUTCDate(last.getUTCDate() + 6);
  const end = last.toISOString().slice(0, 10);
  return {
    start: weekDay.format(first),
    end: weekDay.format(last),
    endDate: end,
    range: `${start} – ${end}`,
  };
}
