// The planner: fits todo assignments into the time you have tonight.
//
// Rule-based on purpose, so every decision can be explained:
//   1. Work through assignments from most to least urgent: overdue, then due
//      within 24 hours, then by due date. Same due time → shorter first.
//   2. Add each one if it fits in the time left; if it doesn't, skip it and
//      try the next (a smaller one later in the list might still fit).
//   3. Big assignments (over 50 min) due 3+ days away get one 25–50 minute
//      chunk instead of the whole thing: they get started early without
//      crowding out tonight's urgent work.
//   4. A 10-minute break goes in between assignments once 50 minutes of work
//      have gone by. Breaks count toward your time.
//   5. Anything due within 48 hours (or overdue) that didn't fit is returned
//      as a warning.
// A simple planner with accurate time predictions beats a clever planner with
// bad ones, so the cleverness goes into the estimator, not here.
import type { Assignment } from "@/lib/types";

export const BREAK_EVERY_MINUTES = 50;
export const BREAK_MINUTES = 10;
export const CHUNK_MIN = 25;
export const CHUNK_MAX = 50;
const CHUNK_IF_DUE_IN_DAYS = 3;
const URGENT_WITHIN_HOURS = 48;
const HOUR_MS = 3_600_000;

export type SchedulableAssignment = Pick<
  Assignment,
  "id" | "due_at" | "estimated_minutes" | "predicted_minutes" | "status"
>;

export type PlanStep =
  | { kind: "work"; assignmentId: string; minutes: number; order: number; isChunk: boolean }
  | { kind: "break"; minutes: number; order: number };

export interface BuiltPlan {
  items: PlanStep[];
  /** Due within 48 hours (or overdue) and not in tonight's plan. */
  unscheduledUrgent: { assignmentId: string; minutes: number }[];
  workMinutes: number;
  breakMinutes: number;
}

/** The time we expect an assignment to take: the model's prediction if there is one. */
export function expectedMinutes(a: Pick<Assignment, "estimated_minutes" | "predicted_minutes">): number {
  return a.predicted_minutes ?? a.estimated_minutes;
}

/** 0 = overdue, 1 = due within 24 hours, 2 = everything else. Lower goes first. */
function urgencyTier(dueMs: number, nowMs: number): number {
  if (dueMs < nowMs) return 0;
  if (dueMs - nowMs <= 24 * HOUR_MS) return 1;
  return 2;
}

export function buildPlan(assignments: SchedulableAssignment[], availableMinutes: number, now: Date): BuiltPlan {
  const nowMs = now.getTime();
  const todo = assignments
    .filter((a) => a.status === "todo")
    .map((a) => ({ id: a.id, dueMs: new Date(a.due_at).getTime(), minutes: expectedMinutes(a) }))
    .sort(
      (a, b) =>
        urgencyTier(a.dueMs, nowMs) - urgencyTier(b.dueMs, nowMs) ||
        a.dueMs - b.dueMs ||
        a.minutes - b.minutes,
    );

  const items: PlanStep[] = [];
  const scheduled = new Set<string>();
  let timeLeft = Math.max(0, availableMinutes);
  let workSinceBreak = 0;

  for (const a of todo) {
    const breakFirst = items.length > 0 && workSinceBreak >= BREAK_EVERY_MINUTES;
    const room = timeLeft - (breakFirst ? BREAK_MINUTES : 0);

    const chunkable = a.minutes > CHUNK_MAX && a.dueMs - nowMs >= CHUNK_IF_DUE_IN_DAYS * 24 * HOUR_MS;
    let minutes: number;
    if (chunkable) {
      minutes = Math.min(CHUNK_MAX, room);
      if (minutes < CHUNK_MIN) continue; // not worth starting a chunk this short
    } else {
      if (a.minutes > room) continue; // doesn't fit; a later, shorter one might
      minutes = a.minutes;
    }

    if (breakFirst) {
      items.push({ kind: "break", minutes: BREAK_MINUTES, order: 0 });
      timeLeft -= BREAK_MINUTES;
      workSinceBreak = 0;
    }
    items.push({ kind: "work", assignmentId: a.id, minutes, order: 0, isChunk: chunkable });
    timeLeft -= minutes;
    workSinceBreak += minutes;
    scheduled.add(a.id);
  }

  items.forEach((step, i) => (step.order = i + 1));

  const unscheduledUrgent = todo
    .filter((a) => !scheduled.has(a.id) && a.dueMs - nowMs <= URGENT_WITHIN_HOURS * HOUR_MS)
    .map((a) => ({ assignmentId: a.id, minutes: a.minutes }));

  const sum = (kind: PlanStep["kind"]) =>
    items.filter((s) => s.kind === kind).reduce((total, s) => total + s.minutes, 0);

  return { items, unscheduledUrgent, workMinutes: sum("work"), breakMinutes: sum("break") };
}
