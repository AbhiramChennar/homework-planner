import { describe, expect, it } from "vitest";
import { pilotMetrics, toCsv, type PilotAssignment, type PilotDataset } from "@/lib/pilot";

// Wednesday Nov 25 2026, noon local.
const NOW = new Date(2026, 10, 25, 12);
const day = (month: number, d: number, h = 18) => new Date(2026, month - 1, d, h).toISOString();

function a(u: string, created: string, extra: Partial<PilotAssignment> = {}): PilotAssignment {
  return {
    u,
    class_category: "math",
    category: "problem_set",
    description_length: 0,
    created_at: created,
    due_at: created,
    completed_at: null,
    status: "todo",
    estimated_minutes: 30,
    predicted_minutes: 30,
    actual_minutes: null,
    ...extra,
  };
}

const DATA: PilotDataset = {
  users: [
    { u: "u1", signed_up_at: day(11, 2, 9) }, // signed up Mon Nov 2
    { u: "u2", signed_up_at: day(11, 9, 9) }, // Mon Nov 9
    { u: "u3", signed_up_at: day(11, 23, 9) }, // Mon Nov 23 (this week)
  ],
  assignments: [
    a("u1", day(11, 3)), // week of Nov 2
    a("u1", day(11, 10), { status: "done", completed_at: day(11, 11), actual_minutes: 60 }), // Nov 9 week
    a("u2", day(11, 10)),
    a("u1", day(11, 24), { status: "done", completed_at: day(11, 24), actual_minutes: null }), // Nov 23 week
    a("u3", day(11, 24)),
  ],
};

describe("pilotMetrics", () => {
  const m = pilotMetrics(DATA, NOW);

  it("counts users", () => {
    expect(m.totalUsers).toBe(3);
  });

  it("weekly active users and assignments added per active user", () => {
    expect(m.weeks.map((w) => [w.weekStart.getDate(), w.activeUsers, w.assignmentsAdded])).toEqual([
      [2, 1, 1],
      [9, 2, 2],
      [16, 0, 0], // a quiet week still shows up
      [23, 2, 2],
    ]);
    expect(m.weeks[1].assignmentsPerActiveUser).toBe(1);
    expect(m.weeks[2].assignmentsPerActiveUser).toBeNull();
  });

  it("share of completions with a logged time", () => {
    expect(m.loggedShare).toBe(0.5); // 1 of 2 completions
    expect(m.weeks[1].loggedShare).toBe(1);
    expect(m.weeks[3].loggedShare).toBe(0);
  });

  it("retention: still active 1, 2 and 3 weeks after signing up", () => {
    // u1 (signed up Nov 2) was active Nov 24: retained at 1, 2 and 3 weeks.
    // u2 (Nov 9) wasn't active after Nov 10: not retained at 1 or 2 weeks.
    // u3 (Nov 23) is too new to count.
    expect(m.retention).toEqual([
      { afterWeeks: 1, eligible: 2, retained: 1 },
      { afterWeeks: 2, eligible: 2, retained: 1 },
      { afterWeeks: 3, eligible: 1, retained: 1 },
    ]);
  });

  it("estimate vs prediction error by week", () => {
    expect(m.weeks[1].estimateError).toBeCloseTo(0.5); // 30 vs 60
  });

  it("handles an empty pilot", () => {
    const empty = pilotMetrics({ users: [], assignments: [] }, NOW);
    expect(empty.totalUsers).toBe(0);
    expect(empty.weeks).toEqual([]);
    expect(empty.loggedShare).toBeNull();
  });
});

describe("toCsv (anonymized export)", () => {
  const csv = toCsv(DATA);
  const lines = csv.trim().split("\n");

  it("has a header and one row per completed assignment only", () => {
    expect(lines[0]).toBe(
      "user,class_category,category,description_length,estimated_minutes,predicted_minutes,actual_minutes,lead_time_hours,completed_day_of_week,completed_on",
    );
    expect(lines).toHaveLength(3);
  });

  it("derives lead time and day of week, and leaves missing values blank", () => {
    const row = toCsv({
      users: [],
      assignments: [
        a("u7", day(11, 10, 12), { due_at: day(11, 12, 23), status: "done", completed_at: day(11, 11, 20), actual_minutes: null }),
      ],
    })
      .trim()
      .split("\n")[1];
    expect(row).toBe("u7,math,problem_set,0,30,30,,59,Wed,2026-11-11");
  });

  it("quotes values that contain commas or quotes", () => {
    const row = toCsv({ users: [], assignments: [a("u,1", day(11, 3), { status: "done", completed_at: day(11, 3) })] })
      .trim()
      .split("\n")[1];
    expect(row.startsWith('"u,1",')).toBe(true);
  });
});
