// These tests document how the planner decides what to do tonight.
import { describe, expect, it } from "vitest";
import { buildPlan, type SchedulableAssignment } from "@/lib/scheduler";

// Wednesday, November 11 2026, 4pm local.
const NOW = new Date(2026, 10, 11, 16, 0);
const HOUR = 3_600_000;

let nextId = 0;
/** An assignment due `hoursFromNow` hours from NOW that takes `minutes`. */
function hw(minutes: number, hoursFromNow: number, extra: Partial<SchedulableAssignment> = {}): SchedulableAssignment {
  nextId += 1;
  return {
    id: extra.id ?? `a${nextId}`,
    due_at: new Date(NOW.getTime() + hoursFromNow * HOUR).toISOString(),
    estimated_minutes: minutes,
    predicted_minutes: null,
    status: "todo",
    ...extra,
  };
}

/** Compact view of a plan: "id:minutes" for work, "break" for breaks, "*" marks a chunk. */
function steps(plan: ReturnType<typeof buildPlan>) {
  return plan.items.map((s) => (s.kind === "break" ? "break" : `${s.assignmentId}:${s.minutes}${s.isChunk ? "*" : ""}`));
}

describe("buildPlan", () => {
  it("returns an empty plan when there's nothing to do", () => {
    const plan = buildPlan([], 120, NOW);
    expect(plan.items).toEqual([]);
    expect(plan.unscheduledUrgent).toEqual([]);
  });

  it("ignores finished assignments", () => {
    const plan = buildPlan([hw(30, 8, { id: "done", status: "done" }), hw(30, 8, { id: "todo" })], 120, NOW);
    expect(steps(plan)).toEqual(["todo:30"]);
  });

  it("uses the predicted minutes when the model has made a prediction", () => {
    const plan = buildPlan([hw(30, 8, { id: "x", predicted_minutes: 45 })], 120, NOW);
    expect(steps(plan)).toEqual(["x:45"]);
  });

  it("does overdue work first, then work due soonest", () => {
    const plan = buildPlan(
      [hw(20, 72, { id: "later" }), hw(20, 8, { id: "tonight" }), hw(20, -24, { id: "overdue" }), hw(20, 30, { id: "tomorrow" })],
      120,
      NOW,
    );
    expect(steps(plan)).toEqual(["overdue:20", "tonight:20", "tomorrow:20", "break", "later:20"]);
  });

  it("does the shorter one first when two are due at the same time (quick wins build momentum)", () => {
    const plan = buildPlan([hw(40, 8, { id: "long" }), hw(15, 8, { id: "short" })], 120, NOW);
    expect(steps(plan)).toEqual(["short:15", "long:40"]);
  });

  it("puts something due in 20 hours ahead of something due in 30 hours, even if it's longer", () => {
    const plan = buildPlan([hw(10, 30, { id: "b" }), hw(40, 20, { id: "a" })], 120, NOW);
    expect(steps(plan)).toEqual(["a:40", "b:10"]);
  });

  it("stops adding work when the time runs out", () => {
    const plan = buildPlan([hw(30, 8, { id: "a" }), hw(30, 9, { id: "b" })], 45, NOW);
    expect(steps(plan)).toEqual(["a:30"]);
  });

  it("skips something too long and fits in something shorter after it", () => {
    const plan = buildPlan([hw(20, 8, { id: "a" }), hw(60, 60, { id: "big" }), hw(15, 70, { id: "small" })], 45, NOW);
    expect(steps(plan)).toEqual(["a:20", "small:15"]);
  });

  it("adds a 10-minute break once 50 minutes of work have gone by", () => {
    const plan = buildPlan([hw(30, 8, { id: "a" }), hw(30, 9, { id: "b" }), hw(30, 10, { id: "c" })], 120, NOW);
    expect(steps(plan)).toEqual(["a:30", "b:30", "break", "c:30"]);
    expect(plan.items.find((s) => s.kind === "break")?.minutes).toBe(10);
  });

  it("never ends the plan with a break", () => {
    const plan = buildPlan([hw(30, 8, { id: "a" }), hw(30, 9, { id: "b" })], 120, NOW);
    expect(steps(plan)).toEqual(["a:30", "b:30"]);
  });

  it("counts breaks as part of your time (60 + break + 50 doesn't fit in 115)", () => {
    const plan = buildPlan([hw(60, 8, { id: "a" }), hw(50, 9, { id: "b" })], 115, NOW);
    expect(steps(plan)).toEqual(["a:60"]);
    expect(buildPlan([hw(60, 8, { id: "a" }), hw(50, 9, { id: "b" })], 120, NOW).items).toHaveLength(3);
  });

  it("does one 50-minute chunk of a big assignment due 3+ days away", () => {
    const plan = buildPlan([hw(120, 5 * 24, { id: "project" })], 180, NOW);
    expect(steps(plan)).toEqual(["project:50*"]);
  });

  it("makes the chunk smaller (but at least 25 minutes) to fit the time left", () => {
    expect(steps(buildPlan([hw(20, 8, { id: "a" }), hw(120, 96, { id: "p" })], 50, NOW))).toEqual(["a:20", "p:30*"]);
    expect(steps(buildPlan([hw(30, 8, { id: "a" }), hw(120, 96, { id: "p" })], 50, NOW))).toEqual(["a:30"]); // only 20 left
  });

  it("doesn't chunk work due within 3 days, even if it's big", () => {
    const plan = buildPlan([hw(120, 47, { id: "big" })], 60, NOW);
    expect(plan.items).toEqual([]);
    expect(plan.unscheduledUrgent).toEqual([{ assignmentId: "big", minutes: 120 }]);
  });

  it("doesn't chunk assignments of 50 minutes or less", () => {
    const plan = buildPlan([hw(50, 5 * 24, { id: "x" })], 120, NOW);
    expect(steps(plan)).toEqual(["x:50"]);
  });

  it("warns about work due within 48 hours (or overdue) that didn't fit", () => {
    const plan = buildPlan(
      [hw(40, -5, { id: "overdue" }), hw(40, 20, { id: "soon" }), hw(40, 47, { id: "edge" }), hw(40, 60, { id: "notUrgent" })],
      30,
      NOW,
    );
    expect(plan.items).toEqual([]);
    expect(plan.unscheduledUrgent.map((u) => u.assignmentId)).toEqual(["overdue", "soon", "edge"]);
  });

  it("schedules nothing and warns about everything urgent when there's no time", () => {
    const plan = buildPlan([hw(20, 8, { id: "a" })], 0, NOW);
    expect(plan.items).toEqual([]);
    expect(plan.unscheduledUrgent).toEqual([{ assignmentId: "a", minutes: 20 }]);
  });

  it("numbers every step in order, starting at 1", () => {
    const plan = buildPlan([hw(30, 8), hw(30, 9), hw(30, 10)], 120, NOW);
    expect(plan.items.map((s) => s.order)).toEqual([1, 2, 3, 4]);
  });

  it("reports total work and break minutes", () => {
    const plan = buildPlan([hw(30, 8), hw(30, 9), hw(30, 10)], 120, NOW);
    expect(plan.workMinutes).toBe(90);
    expect(plan.breakMinutes).toBe(10);
  });

  it("doesn't change the list it was given", () => {
    const input = [hw(40, 30), hw(10, 8)];
    const copy = structuredClone(input);
    buildPlan(input, 60, NOW);
    expect(input).toEqual(copy);
  });
});
