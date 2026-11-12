// The estimator: predicts how long an assignment will really take.
//
// Layer 0 (baseline): fewer than 3 finished assignments with logged times in
//   this class → trust the student's own estimate.
// Layer 1 (personal bias): look at how long this student's work in this class
//   really took compared to their guesses (actual ÷ estimate), take the
//   median, and scale the new estimate by it.
//
// Two safeguards keep layer 1 from overreacting:
// * Clipping: ratios are limited to 0.25–4, so a typo (500 instead of 50)
//   counts as "4x" rather than "10x".
// * Shrinkage: ratio = (n × median + k × 1.0) ÷ (n + k), with k = 5. With few
//   data points the ratio stays close to 1.0 (trust the student); as n grows it
//   moves toward their real median. It's like starting with 5 imaginary
//   assignments where they guessed exactly right.
//
// Layer 2 (a model pooled across all students) comes later, once there's data.
import type { Assignment } from "@/lib/types";

export const MIN_COMPLETIONS = 3;
export const SHRINKAGE_K = 5;
export const MIN_RATIO = 0.25;
export const MAX_RATIO = 4;
export const MODEL_VERSION = "v1-class-factor";

export type HistoryItem = Pick<Assignment, "class_id" | "estimated_minutes" | "actual_minutes" | "status">;

export interface Prediction {
  minutes: number;
  layer: 0 | 1;
  /** Completed assignments with logged times in this class. */
  completions: number;
  /** The student's median actual ÷ estimate (before shrinkage); null in layer 0. */
  typicalRatio: number | null;
  /** The ratio actually applied (after shrinkage); 1 in layer 0. */
  ratio: number;
  /** A sentence for the UI, or null when there's nothing to explain. */
  explanation: string | null;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function predictMinutes(
  assignment: Pick<Assignment, "class_id" | "estimated_minutes">,
  history: HistoryItem[],
  className = "this class",
): Prediction {
  const ratios = history
    .filter(
      (h) =>
        h.class_id === assignment.class_id &&
        h.status === "done" &&
        h.actual_minutes !== null &&
        h.actual_minutes > 0 &&
        h.estimated_minutes > 0,
    )
    .map((h) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, h.actual_minutes! / h.estimated_minutes)))
    .sort((a, b) => a - b);

  const n = ratios.length;
  if (n < MIN_COMPLETIONS) {
    return { minutes: assignment.estimated_minutes, layer: 0, completions: n, typicalRatio: null, ratio: 1, explanation: null };
  }

  const typical = median(ratios);
  const ratio = (n * typical + SHRINKAGE_K * 1.0) / (n + SHRINKAGE_K);
  return {
    minutes: Math.max(1, Math.round(assignment.estimated_minutes * ratio)),
    layer: 1,
    completions: n,
    typicalRatio: typical,
    ratio,
    explanation: explain(typical, className, n),
  };
}

/** "You usually take ~50% longer than you guess on History (3 done)" */
function explain(typicalRatio: number, className: string, n: number): string {
  // Round to the nearest 5% so it reads like a person said it.
  const pct = Math.round(((typicalRatio - 1) * 100) / 5) * 5;
  if (pct === 0) return `Your guesses for ${className} are usually about right (${n} done)`;
  return pct > 0
    ? `You usually take ~${pct}% longer than you guess on ${className} (${n} done)`
    : `You usually take ~${-pct}% less time than you guess on ${className} (${n} done)`;
}
