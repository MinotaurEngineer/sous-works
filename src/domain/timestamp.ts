const PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))?$/;

/**
 * Parses "YYYY-MM-DD[T ]HH:MM:SS[.fraction][Z|±HH:MM]" into a Date.
 * A timestamp without an offset is UTC, never host-local time. Fractions beyond milliseconds are truncated.
 * Returns undefined for any other format and for impossible values: JavaScript's Date would
 * silently roll Feb 30 over to Mar 1 and T24:00:00 to the next day.
 */
export const parseTimestamp = (raw: string): Date | undefined => {
  const match = PATTERN.exec(raw);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second, fraction = "", offset = "Z", offsetHour = "0", offsetMinute = "0"] =
    match;

  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const isRealDate =
    calendar.getUTCFullYear() === Number(year) &&
    calendar.getUTCMonth() === Number(month) - 1 &&
    calendar.getUTCDate() === Number(day);
  const isRealTime = Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60;
  const isRealOffset = Number(offsetHour) < 24 && Number(offsetMinute) < 60;
  if (!isRealDate || !isRealTime || !isRealOffset) return undefined;

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.${(fraction + "000").slice(0, 3)}${offset}`);
};
