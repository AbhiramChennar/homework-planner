import { describe, expect, it } from "vitest";
import { accuracySummary, classBias, mape, weekStart, weeklyAccuracy, type Scored } from "@/lib/metrics";

let n = 0;
function done(estimated: number, predicted: number | null, actual: number | null, classId = "c1", completedAt = "2026-11-10T20:00:00"): Scored {
  n += 1;
  return {
    id: `a${n}`,
    class_id: classId,
    estimated_minutes: estimated,
    predicted_minutes: predicted,
    actual_minutes: actual,
    status: "done",
    completed_at: new Date(completedAt).toISOString(),
  };
}

describe("mape (mean absolute percentage error)", () => {
  it("averages |guess − actual| ÷ actual", () => {
    // 30 vs 60 is 50% off; 60 vs 60 is 0% off → 25% on average.
    expect(mape([{ guess: 30, actual: 60 }, { guess: 60, actual: 60 }])).toBeCloseTo(0.25);
  });

  it("treats over- and under-estimates the same", () => {
    expect(mape([{ guess: 90, actual: 60 }])).toBeCloseTo(0.5);
    expect(mape([{ guess: 30, actual: 60 }])).toBeCloseTo(0.5);
  });

  it("is null with no data", () => {
    expect(mape([])).toBeNull();
  });
});

describe("accuracySummary", () => {
  it("compares estimates and predictions on the same assignments", () => {
    const s = accuracySummary([
      done(30, 45, 60), // estimate 50% off, prediction 25% off: prediction closer
      done(60, 60, 60), // both exact: tie
      done(40, 30, 40), // estimate exact, prediction 25% off: estimate closer
    ]);
    expect(s.count).toBe(3);
    expect(s.estimateError).toBeCloseTo((0.5 + 0 + 0) / 3);
    expect(s.predictionError).toBeCloseTo((0.25 + 0 + 0.25) / 3);
    expect(s.predictionCloserShare).toBeCloseTo(1 / 3);
    expect(s.tieShare).toBeCloseTo(1 / 3);
  });

  it("only counts finished assignments with a logged time and a prediction", () => {
    const todo = { ...done(30, 30, null), status: "todo" as const, completed_at: null };
    const s = accuracySummary([done(30, 30, null), done(30, null, 60), todo, done(30, 30, 30)]);
    expect(s.count).toBe(1);
  });

  it("returns nulls when there's nothing to measure", () => {
    expect(accuracySummary([])).toEqual({
      count: 0,
      estimateError: null,
      predictionError: null,
      predictionCloserShare: null,
      tieShare: null,
    });
  });
});

describe("classBias", () => {
  it("gives the median actual ÷ estimate per class, most data first", () => {
    const rows = classBias([
      done(40, 40, 60, "hist"),
      done(40, 40, 80, "hist"),
      done(40, 40, 40, "hist"),
      done(50, 50, 40, "calc"),
    ]);
    expect(rows).toEqual([
      { classId: "hist", count: 3, medianRatio: 1.5 },
      { classId: "calc", count: 1, medianRatio: 0.8 },
    ]);
  });

  it("ignores assignments without a logged time", () => {
    expect(classBias([done(40, 40, null, "hist")])).toEqual([]);
  });
});

describe("weekStart", () => {
  it("is the Monday at midnight of the same week", () => {
    expect(weekStart(new Date(2026, 10, 11, 15))).toEqual(new Date(2026, 10, 9)); // Wed → Mon Nov 9
    expect(weekStart(new Date(2026, 10, 9, 0, 5))).toEqual(new Date(2026, 10, 9)); // Monday itself
    expect(weekStart(new Date(2026, 10, 15, 22))).toEqual(new Date(2026, 10, 9)); // Sunday → previous Monday
  });
});

describe("weeklyAccuracy", () => {
  it("groups completions by the week they were finished, oldest first", () => {
    const weeks = weeklyAccuracy([
      done(30, 45, 60, "c", "2026-11-10T20:00:00"), // week of Nov 9
      done(60, 60, 60, "c", "2026-11-11T20:00:00"), // week of Nov 9
      done(40, 40, 80, "c", "2026-11-03T20:00:00"), // week of Nov 2
    ]);
    expect(weeks.map((w) => [w.weekStart.getDate(), w.count])).toEqual([
      [2, 1],
      [9, 2],
    ]);
    expect(weeks[0].estimateError).toBeCloseTo(0.5);
    expect(weeks[1].predictionError).toBeCloseTo(0.125);
  });
});
