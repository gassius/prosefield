/**
 * Art Direction 12.1 — relative for recent, then day+month,
 * year only when it isn't the current year. Always en-GB.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDayMonth(date: Date, includeYear: boolean): string {
  const options: Intl.DateTimeFormatOptions = includeYear
    ? { day: "numeric", month: "long", year: "numeric" }
    : { day: "numeric", month: "long" };
  return new Intl.DateTimeFormat("en-GB", options).format(date);
}

/**
 * Visible `<time>` label, e.g. "Edited 2 minutes ago", "Edited yesterday",
 * "Edited 28 September", "Edited 28 September 2025".
 */
export function formatEditedLabel(
  updatedAt: Date,
  now: Date = new Date(),
): string {
  const today = startOfLocalDay(now);
  const editedDay = startOfLocalDay(updatedAt);
  const dayDiff = Math.round(
    (today.getTime() - editedDay.getTime()) / (24 * HOUR_MS),
  );

  if (dayDiff <= 0) {
    const elapsed = Math.max(0, now.getTime() - updatedAt.getTime());
    if (elapsed < MINUTE_MS) {
      return "Edited just now";
    }
    if (elapsed < HOUR_MS) {
      const minutes = Math.floor(elapsed / MINUTE_MS);
      return minutes === 1
        ? "Edited 1 minute ago"
        : `Edited ${minutes} minutes ago`;
    }
    const hours = Math.floor(elapsed / HOUR_MS);
    return hours === 1 ? "Edited 1 hour ago" : `Edited ${hours} hours ago`;
  }

  if (dayDiff === 1) {
    return "Edited yesterday";
  }

  const includeYear = updatedAt.getFullYear() !== now.getFullYear();
  return `Edited ${formatDayMonth(updatedAt, includeYear)}`;
}

/**
 * Accessible absolute time for list item labels
 * (e.g. "edited 1 October 2026 at 11:42").
 */
export function formatEditedAccessible(updatedAt: Date): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(updatedAt);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(updatedAt);
  return `edited ${date} at ${time}`;
}
