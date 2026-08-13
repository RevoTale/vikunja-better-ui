declare const localDateTimeBrand: unique symbol;

export type LocalDateTime = string & { readonly [localDateTimeBrand]: true };

export type LocalDateTimeParts = Readonly<{
  date: string;
  time: string;
}>;

export function composeLocalDateTime(parts: LocalDateTimeParts): LocalDateTime | undefined {
  if (!isValidLocalDate(parts.date) || !isValidLocalTime(parts.time)) return undefined;
  return `${parts.date}T${parts.time}` as LocalDateTime;
}

export function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function isValidLocalTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

export function currentLocalDate(now = new Date()): string {
  return `${now.getFullYear()}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}`;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
