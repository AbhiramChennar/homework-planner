// Date helpers shared by the assignments list, the planner and forms.
// All pure functions that take `now`, so they're easy to test.

const DAY_MS = 86_400_000;

/** Whole calendar days from `now`'s date to `date`'s date (local time). 0 = same day. */
export function calendarDaysBetween(now: Date, date: Date): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Math.round, not floor: a day is 23 or 25 hours long when clocks change.
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export type DueGroup = "overdue" | "today" | "tomorrow" | "thisWeek" | "later";

export const DUE_GROUP_LABELS: Record<DueGroup, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  thisWeek: "This week",
  later: "Later",
};

export function dueGroup(dueAt: Date, now: Date): DueGroup {
  if (dueAt.getTime() < now.getTime()) return "overdue";
  const days = calendarDaysBetween(now, dueAt);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "thisWeek"; // the next 7 days
  return "later";
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3:30pm" */
export function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/**
 * Short, friendly due date: "Today", "Tomorrow", "Fri", "Nov 20", or "Yesterday".
 * The time is only shown when it isn't the default 11:59pm.
 */
export function formatDue(dueAt: Date, now: Date): string {
  const days = calendarDaysBetween(now, dueAt);
  let day: string;
  if (days === 0) day = "Today";
  else if (days === 1) day = "Tomorrow";
  else if (days === -1) day = "Yesterday";
  else if (days > 1 && days < 7) day = WEEKDAY[dueAt.getDay()];
  else day = `${MONTH[dueAt.getMonth()]} ${dueAt.getDate()}`;
  const isDefaultTime = dueAt.getHours() === 23 && dueAt.getMinutes() === 59;
  return isDefaultTime ? day : `${day} ${formatTime(dueAt)}`;
}

/** "75" → "1h 15m", "45" → "45m" */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Date → "2026-11-13" for <input type="date"> (local date, not UTC). */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2026-11-13" → that date at 11:59pm local, or null if it isn't a valid date. */
export function fromDateInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}
