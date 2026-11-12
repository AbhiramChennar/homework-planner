// Accuracy measurements: how far off were students' estimates, and how far
// off were the app's predictions? These are the numbers that show whether the
// project works.
//
// The main measure is MAPE, the mean absolute percentage error:
//   average of |guess − actual| ÷ actual
// "Off by 38% on average." Percentages make a 10-minute miss on a 20-minute
// worksheet count more than a 10-minute miss on a 3-hour project.
import type { Assignment } from "@/lib/types";

export type Scored = Pick<
  Assignment,
  "id" | "class_id" | "estimated_minutes" | "predicted_minutes" | "actual_minutes" | "status" | "completed_at"
>;

/** Finished, with a logged time and a stored prediction: the assignments we can grade. */
type Gradable = Scored & { actual_minutes: number; predicted_minutes: number; completed_at: string };

function gradable(assignments: Scored[]): Gradable[] {
  // Both errors are measured on exactly the same assignments. If estimates
  // were measured on more (or different) work than predictions, the
  // comparison wouldn't be fair.
  return assignments.filter(
    (a): a is Gradable =>
      a.status === "done" &&
      a.completed_at !== null &&
      a.actual_minutes !== null &&
      a.actual_minutes > 0 &&
      a.predicted_minutes !== null,
  );
}

export function mape(pairs: { guess: number; actual: number }[]): number | null {
  if (pairs.length === 0) return null;
  return pairs.reduce((sum, p) => sum + Math.abs(p.guess - p.actual) / p.actual, 0) / pairs.length;
}

export interface AccuracySummary {
  count: number;
  /** MAPE of the student's own estimates (0.38 = off by 38%). */
  estimateError: number | null;
  /** MAPE of the app's predictions. */
  predictionError: number | null;
  /** Share of assignments where the prediction was strictly closer. */
  predictionCloserShare: number | null;
  /** Share where both were equally close (often both exact, or layer 0). */
  tieShare: number | null;
}

export function accuracySummary(assignments: Scored[]): AccuracySummary {
  const rows = gradable(assignments);
  if (rows.length === 0) {
    return { count: 0, estimateError: null, predictionError: null, predictionCloserShare: null, tieShare: null };
  }
  let closer = 0;
  let ties = 0;
  for (const a of rows) {
    const estMiss = Math.abs(a.estimated_minutes - a.actual_minutes);
    const predMiss = Math.abs(a.predicted_minutes - a.actual_minutes);
    if (predMiss < estMiss) closer += 1;
    else if (predMiss === estMiss) ties += 1;
  }
  return {
    count: rows.length,
    estimateError: mape(rows.map((a) => ({ guess: a.estimated_minutes, actual: a.actual_minutes }))),
    predictionError: mape(rows.map((a) => ({ guess: a.predicted_minutes, actual: a.actual_minutes }))),
    predictionCloserShare: closer / rows.length,
    tieShare: ties / rows.length,
  };
}

export interface ClassBias {
  classId: string;
  count: number;
  /** Median actual ÷ estimate: 1.5 = takes 50% longer than guessed. */
  medianRatio: number;
}

/** Per-class estimation bias, classes with the most data first. */
export function classBias(assignments: Scored[]): ClassBias[] {
  const byClass = new Map<string, number[]>();
  for (const a of assignments) {
    if (a.status !== "done" || !a.actual_minutes || a.estimated_minutes <= 0) continue;
    byClass.set(a.class_id, [...(byClass.get(a.class_id) ?? []), a.actual_minutes / a.estimated_minutes]);
  }
  return [...byClass.entries()]
    .map(([classId, ratios]) => {
      const sorted = [...ratios].sort((x, y) => x - y);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      return { classId, count: ratios.length, medianRatio: median };
    })
    .sort((x, y) => y.count - x.count || x.classId.localeCompare(y.classId));
}

/** Monday 00:00 (local time) of the week containing `date`. */
export function weekStart(date: Date): Date {
  const daysSinceMonday = (date.getDay() + 6) % 7; // getDay(): Sunday = 0
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
}

export interface WeekAccuracy {
  weekStart: Date;
  count: number;
  estimateError: number | null;
  predictionError: number | null;
}

/** Accuracy for each week, by when the work was finished, oldest week first. */
export function weeklyAccuracy(assignments: Scored[]): WeekAccuracy[] {
  const byWeek = new Map<number, Gradable[]>();
  for (const a of gradable(assignments)) {
    const key = weekStart(new Date(a.completed_at)).getTime();
    byWeek.set(key, [...(byWeek.get(key) ?? []), a]);
  }
  return [...byWeek.entries()]
    .sort(([x], [y]) => x - y)
    .map(([key, rows]) => {
      const s = accuracySummary(rows);
      return { weekStart: new Date(key), count: s.count, estimateError: s.estimateError, predictionError: s.predictionError };
    });
}
