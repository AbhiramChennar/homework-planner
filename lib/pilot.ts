// Pilot dashboard math and the anonymized CSV export. Pure functions over the
// anonymized dataset that admin_dataset() returns (see the migration), so
// they're tested without a database.
import { mape, weekStart } from "@/lib/metrics";

export interface PilotUser {
  u: string; // random per-export id like "u3"
  signed_up_at: string;
}

export interface PilotAssignment {
  u: string;
  class_category: string;
  category: string | null;
  description_length: number;
  created_at: string;
  due_at: string;
  completed_at: string | null;
  status: "todo" | "done";
  estimated_minutes: number;
  predicted_minutes: number | null;
  actual_minutes: number | null;
}

export interface PilotDataset {
  users: PilotUser[];
  assignments: PilotAssignment[];
}

export interface PilotWeek {
  weekStart: Date;
  /** Users who added or finished anything that week. */
  activeUsers: number;
  assignmentsAdded: number;
  assignmentsPerActiveUser: number | null;
  completions: number;
  /** Of that week's completions, the share with an actual time logged. */
  loggedShare: number | null;
  estimateError: number | null;
  predictionError: number | null;
}

export interface Retention {
  afterWeeks: number;
  /** Users who signed up at least this many weeks ago. */
  eligible: number;
  /** Of those, how many did anything at least this many weeks after signing up. */
  retained: number;
}

export interface PilotMetrics {
  totalUsers: number;
  weeks: PilotWeek[];
  retention: Retention[];
  loggedShare: number | null;
}

const WEEK_MS = 7 * 86_400_000;

export function pilotMetrics(data: PilotDataset, now: Date): PilotMetrics {
  const done = data.assignments.filter((a) => a.status === "done" && a.completed_at);

  // Every moment a user did something: adding or finishing an assignment.
  const activity = data.assignments.flatMap((a) =>
    [a.created_at, a.completed_at].filter((t): t is string => t !== null).map((t) => ({ u: a.u, t: new Date(t) })),
  );

  // Weeks from the first signup to now, including quiet weeks.
  const weeks: PilotWeek[] = [];
  if (data.users.length > 0) {
    const first = Math.min(...data.users.map((u) => new Date(u.signed_up_at).getTime()));
    for (let w = weekStart(new Date(first)); w <= now; w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)) {
      const end = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7);
      const inWeek = (t: Date) => t >= w && t < end;
      const active = new Set(activity.filter((x) => inWeek(x.t)).map((x) => x.u));
      const added = data.assignments.filter((a) => inWeek(new Date(a.created_at))).length;
      const finished = done.filter((a) => inWeek(new Date(a.completed_at!)));
      const graded = finished.filter((a) => a.actual_minutes && a.predicted_minutes !== null);
      weeks.push({
        weekStart: w,
        activeUsers: active.size,
        assignmentsAdded: added,
        assignmentsPerActiveUser: active.size ? added / active.size : null,
        completions: finished.length,
        loggedShare: finished.length ? finished.filter((a) => a.actual_minutes !== null).length / finished.length : null,
        estimateError: mape(graded.map((a) => ({ guess: a.estimated_minutes, actual: a.actual_minutes! }))),
        predictionError: mape(graded.map((a) => ({ guess: a.predicted_minutes!, actual: a.actual_minutes! }))),
      });
    }
  }

  const retention = [1, 2, 3].map((k) => {
    const eligible = data.users.filter((u) => now.getTime() - new Date(u.signed_up_at).getTime() >= k * WEEK_MS);
    const retained = eligible.filter((u) => {
      const cutoff = new Date(u.signed_up_at).getTime() + k * WEEK_MS;
      return activity.some((x) => x.u === u.u && x.t.getTime() >= cutoff);
    });
    return { afterWeeks: k, eligible: eligible.length, retained: retained.length };
  });

  return {
    totalUsers: data.users.length,
    weeks,
    retention,
    loggedShare: done.length ? done.filter((a) => a.actual_minutes !== null).length / done.length : null,
  };
}

const CSV_COLUMNS = [
  "user",
  "class_category",
  "category",
  "description_length",
  "estimated_minutes",
  "predicted_minutes",
  "actual_minutes",
  "lead_time_hours",
  "completed_day_of_week",
  "completed_on",
] as const;

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function csvValue(v: string | number | null): string {
  if (v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Completed assignments as CSV for the analysis notebook. Only the anonymized
 * fields: no titles, descriptions, class names, emails or account ids.
 * Day of week and date use the admin's local time zone (the pilot is one school).
 */
export function toCsv(data: PilotDataset): string {
  const rows = data.assignments
    .filter((a) => a.status === "done" && a.completed_at)
    .sort((x, y) => x.completed_at!.localeCompare(y.completed_at!))
    .map((a) => {
      const completed = new Date(a.completed_at!);
      const leadHours = (new Date(a.due_at).getTime() - new Date(a.created_at).getTime()) / 3_600_000;
      const pad = (n: number) => String(n).padStart(2, "0");
      return [
        a.u,
        a.class_category,
        a.category,
        a.description_length,
        a.estimated_minutes,
        a.predicted_minutes,
        a.actual_minutes,
        Math.round(leadHours * 10) / 10,
        DOW[completed.getDay()],
        `${completed.getFullYear()}-${pad(completed.getMonth() + 1)}-${pad(completed.getDate())}`,
      ]
        .map(csvValue)
        .join(",");
    });
  return [CSV_COLUMNS.join(","), ...rows].join("\n") + "\n";
}
