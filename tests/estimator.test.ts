// How the app turns a student's estimate into a prediction.
import { describe, expect, it } from "vitest";
import { MIN_COMPLETIONS, predictMinutes, SHRINKAGE_K, type HistoryItem } from "@/lib/estimator";

/** n completed assignments in `classId`, each with the given actual ÷ estimate ratio. */
function history(classId: string, ratios: number[], estimate = 40): HistoryItem[] {
  return ratios.map((r) => ({
    class_id: classId,
    estimated_minutes: estimate,
    actual_minutes: Math.round(estimate * r),
    status: "done",
  }));
}

const NEW_HIST = { class_id: "hist", estimated_minutes: 40 };

describe("layer 0: not enough history", () => {
  it("returns the student's own estimate with fewer than 3 completions in the class", () => {
    const r = predictMinutes(NEW_HIST, history("hist", [1.5, 1.5]));
    expect(r).toMatchObject({ minutes: 40, layer: 0, explanation: null, completions: 2 });
  });

  it("only counts completions in the same class", () => {
    const r = predictMinutes(NEW_HIST, history("calc", [2, 2, 2, 2]));
    expect(r.layer).toBe(0);
    expect(r.minutes).toBe(40);
  });

  it("ignores completions where no actual time was logged", () => {
    const h = [...history("hist", [1.5, 1.5]), { class_id: "hist", estimated_minutes: 40, actual_minutes: null, status: "done" as const }];
    expect(predictMinutes(NEW_HIST, h).layer).toBe(0);
  });

  it("ignores assignments that aren't done", () => {
    const h = history("hist", [1.5, 1.5, 1.5]).map((a) => ({ ...a, status: "todo" as const }));
    expect(predictMinutes(NEW_HIST, h).layer).toBe(0);
  });

  it(`needs ${MIN_COMPLETIONS} completions and uses k = ${SHRINKAGE_K}`, () => {
    expect(MIN_COMPLETIONS).toBe(3);
    expect(SHRINKAGE_K).toBe(5);
  });
});

describe("layer 1: personal bias per class", () => {
  it("scales the estimate by the median ratio, shrunk toward 1.0", () => {
    // 3 completions at 1.5×: ratio = (3 × 1.5 + 5 × 1.0) / (3 + 5) = 1.1875
    const r = predictMinutes(NEW_HIST, history("hist", [1.5, 1.5, 1.5]));
    expect(r.layer).toBe(1);
    expect(r.ratio).toBeCloseTo(1.1875);
    expect(r.minutes).toBe(48); // round(40 × 1.1875 = 47.5)
  });

  it("moves toward the student's real ratio as completions add up", () => {
    const predictions = [3, 5, 10, 20, 50].map((n) => predictMinutes(NEW_HIST, history("hist", Array(n).fill(1.5))).minutes);
    expect(predictions).toEqual([48, 50, 53, 56, 58]); // → 60 (= 1.5 × 40) in the limit
    for (let i = 1; i < predictions.length; i++) expect(predictions[i]).toBeGreaterThan(predictions[i - 1]);
  });

  it("works for students who overestimate, too", () => {
    const r = predictMinutes(NEW_HIST, history("hist", [0.5, 0.5, 0.5, 0.5, 0.5]));
    expect(r.ratio).toBeCloseTo(0.75); // (5 × 0.5 + 5) / 10
    expect(r.minutes).toBe(30);
  });

  it("uses the median, so one weird assignment doesn't swing it", () => {
    const r = predictMinutes(NEW_HIST, history("hist", [1, 1, 1, 3.5]));
    expect(r.typicalRatio).toBe(1); // median of 1, 1, 1, 3.5 (mean would be 1.625)
    expect(r.minutes).toBe(40);
  });

  it("averages the middle two ratios when there's an even number", () => {
    expect(predictMinutes(NEW_HIST, history("hist", [1, 1.2, 1.4, 2])).typicalRatio).toBeCloseTo(1.3);
  });

  it("clips ratios to [0.25, 4] so typos (5 min logged as 500) can't dominate", () => {
    // Estimate 400, logged 4: ratio 0.01.
    const typos = predictMinutes(NEW_HIST, history("hist", [0.01, 0.01, 0.01], 400));
    expect(typos.typicalRatio).toBe(0.25);
    const huge = predictMinutes(NEW_HIST, history("hist", [20, 20, 20]));
    expect(huge.typicalRatio).toBe(4);
  });

  it("never predicts less than 1 minute", () => {
    const r = predictMinutes({ class_id: "hist", estimated_minutes: 1 }, history("hist", Array(100).fill(0.25)));
    expect(r.minutes).toBe(1);
  });

  it("doesn't change the history it was given", () => {
    const h = history("hist", [2, 1, 3]);
    const copy = structuredClone(h);
    predictMinutes(NEW_HIST, h);
    expect(h).toEqual(copy);
  });
});

describe("explanations", () => {
  it("describes taking longer", () => {
    const r = predictMinutes(NEW_HIST, history("hist", [1.5, 1.5, 1.5]), "History");
    expect(r.explanation).toBe("You usually take ~50% longer than you guess on History (3 done)");
  });

  it("describes taking less time", () => {
    const r = predictMinutes(NEW_HIST, history("hist", [0.8, 0.8, 0.8]), "Calculus");
    expect(r.explanation).toBe("You usually take ~20% less time than you guess on Calculus (3 done)");
  });

  it("says when estimates are about right", () => {
    const r = predictMinutes(NEW_HIST, history("hist", [1.02, 0.98, 1]), "Spanish");
    expect(r.explanation).toBe("Your guesses for Spanish are usually about right (3 done)");
  });

  it("falls back to 'this class' without a class name", () => {
    expect(predictMinutes(NEW_HIST, history("hist", [2, 2, 2])).explanation).toContain("this class");
  });
});
