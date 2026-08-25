type DatedDay = {
  date: string;
};

export function groupCurrentWeekDays<Day extends DatedDay>(
  days: readonly Day[],
  today: string,
): { today: Day; upcoming: Day[]; earlier: Day[] } | undefined {
  const todayIndex = days.findIndex((day) => day.date === today);
  const currentDay = days[todayIndex];
  if (todayIndex < 0 || !currentDay) return undefined;

  return {
    today: currentDay,
    upcoming: days.slice(todayIndex + 1),
    earlier: days.slice(0, todayIndex),
  };
}
