// These tests document exactly how quick-add understands what you type.
import { describe, expect, it } from "vitest";
import { parseDurationText, parseQuickAdd } from "@/lib/parser";
import type { Class } from "@/lib/types";

function cls(id: string, name: string, short_name: string | null = null): Class {
  return { id, user_id: "u", name, short_name, color: null, created_at: "" };
}

const CLASSES: Class[] = [
  cls("hist", "AP US History", "hist"),
  cls("calc", "Calculus BC", "calc"),
  cls("callig", "Calligraphy"), // shares a prefix with Calculus
  cls("chem", "Honors Chemistry", "chem"),
  cls("eng", "English 11"), // no short name: matched by name prefix
  cls("span", "Spanish", "span"),
  cls("phys", "Physics"), // "phys" is a prefix of both of these…
  cls("pe", "Physical Education"), // …so it's ambiguous
];

// Wednesday, November 11 2026, 3pm (local time).
const NOW = new Date(2026, 10, 11, 15, 0);
/** 11:59pm local on the given date (month is 1-based here for readability). */
const due = (month: number, day: number, year = 2026) => new Date(year, month - 1, day, 23, 59, 0, 0);

const parse = (input: string) => parseQuickAdd(input, CLASSES, NOW);

describe("the examples from the plan", () => {
  it("hist essay fri 45m", () => {
    expect(parse("hist essay fri 45m")).toEqual({
      classId: "hist",
      title: "essay",
      dueAt: due(11, 13),
      estimatedMinutes: 45,
      category: "essay",
      missing: [],
    });
  });

  it("calc pset 3.2 tomorrow 1h30m", () => {
    expect(parse("calc pset 3.2 tomorrow 1h30m")).toEqual({
      classId: "calc",
      title: "pset 3.2", // "3.2" is not mistaken for a date or a duration
      dueAt: due(11, 12),
      estimatedMinutes: 90,
      category: "problem_set",
      missing: [],
    });
  });
});

describe("durations", () => {
  it.each([
    ["45m", 45],
    ["45min", 45],
    ["45mins", 45],
    ["90min", 90],
    ["1h", 60],
    ["2hr", 120],
    ["2hrs", 120],
    ["1h30m", 90],
    ["1h30", 90],
    ["1.5h", 90],
    ["0.75h", 45],
    ["30 min", 30],
    ["30 minutes", 30],
    ["1 hour", 60],
    ["2 hours", 120],
  ])("%s → %i minutes", (text, minutes) => {
    const r = parse(`hist reading fri ${text}`);
    expect(r.estimatedMinutes).toBe(minutes);
    expect(r.title).toBe("reading");
  });

  it("reports a missing duration", () => {
    const r = parse("hist essay fri");
    expect(r.estimatedMinutes).toBeNull();
    expect(r.missing).toEqual(["estimatedMinutes"]);
  });

  it("ignores a zero duration (and leaves it in the title)", () => {
    const r = parse("hist essay fri 0m");
    expect(r.estimatedMinutes).toBeNull();
    expect(r.title).toBe("essay 0m");
  });

  it("uses the first duration if there are two", () => {
    const r = parse("hist essay fri 45m 1h");
    expect(r.estimatedMinutes).toBe(45);
    expect(r.title).toBe("essay 1h");
  });
});

describe("due dates", () => {
  it("today", () => expect(parse("hist essay today 30m").dueAt).toEqual(due(11, 11)));
  it("tomorrow", () => expect(parse("hist essay tomorrow 30m").dueAt).toEqual(due(11, 12)));
  it("tmrw (common shorthand)", () => expect(parse("hist essay tmrw 30m").dueAt).toEqual(due(11, 12)));

  it("a weekday name means its next occurrence", () => {
    expect(parse("hist essay thu 30m").dueAt).toEqual(due(11, 12));
    expect(parse("hist essay friday 30m").dueAt).toEqual(due(11, 13));
    expect(parse("hist essay sun 30m").dueAt).toEqual(due(11, 15));
    expect(parse("hist essay mon 30m").dueAt).toEqual(due(11, 16));
    expect(parse("hist essay tues 30m").dueAt).toEqual(due(11, 17));
  });

  it("today's weekday means today (it's not 11:59pm yet), not next week", () => {
    expect(parse("hist essay wed 30m").dueAt).toEqual(due(11, 11));
    expect(parse("hist essay wednesday 30m").dueAt).toEqual(due(11, 11));
  });

  it("month/day dates", () => {
    expect(parse("hist essay 11/14 30m").dueAt).toEqual(due(11, 14));
    expect(parse("hist essay 12/1 30m").dueAt).toEqual(due(12, 1));
  });

  it("a recent past date stays in this year (it's overdue)", () => {
    expect(parse("hist essay 11/10 30m").dueAt).toEqual(due(11, 10));
  });

  it("a date months in the past means next year (January, typed in November)", () => {
    expect(parse("hist essay 1/5 30m").dueAt).toEqual(due(1, 5, 2027));
  });

  it("month/day/year dates, with 2- or 4-digit years", () => {
    expect(parse("hist essay 1/5/2027 30m").dueAt).toEqual(due(1, 5, 2027));
    expect(parse("hist essay 1/5/27 30m").dueAt).toEqual(due(1, 5, 2027));
  });

  it("an impossible date isn't a date (stays in the title)", () => {
    const r = parse("hist essay 13/45 30m");
    expect(r.dueAt).toBeNull();
    expect(r.title).toBe("essay 13/45");
    expect(r.missing).toEqual(["dueAt"]);
  });

  it("drops the word 'due' or 'by' right before the date", () => {
    expect(parse("hist essay due fri 30m").title).toBe("essay");
    expect(parse("hist essay by fri 30m").title).toBe("essay");
  });

  it("keeps 'due' when it isn't followed by a date", () => {
    expect(parse("hist due process essay fri 30m").title).toBe("due process essay");
  });
});

describe("classes", () => {
  it("matches a class's short name, in any letter case", () => {
    expect(parse("HIST essay fri 45m").classId).toBe("hist");
  });

  it("matches the start of a class name when there's no short name", () => {
    expect(parse("engl reading fri 30m").classId).toBe("eng");
    expect(parse("english reading fri 30m").classId).toBe("eng");
  });

  it("an exact short name wins over a name prefix ('calc' vs Calligraphy)", () => {
    expect(parse("calc pset fri 30m").classId).toBe("calc");
  });

  it("an ambiguous prefix matches nothing", () => {
    const r = parse("phys lab fri 30m");
    expect(r.classId).toBeNull();
    expect(r.title).toBe("phys lab");
    expect(r.missing).toEqual(["class"]);
  });

  it("an unknown class is reported missing and its word stays in the title", () => {
    const r = parse("bio worksheet fri 30m");
    expect(r.classId).toBeNull();
    expect(r.title).toBe("bio worksheet");
    expect(r.missing).toEqual(["class"]);
  });

  it("the class can appear anywhere", () => {
    expect(parse("essay for hist fri 45m")).toMatchObject({ classId: "hist", title: "essay for" });
  });

  it("one-letter words never match a class (too easy to hit by accident)", () => {
    expect(parse("a essay fri 30m").classId).toBeNull();
  });
});

describe("categories", () => {
  it.each([
    ["essay draft", "essay"],
    ["read act 2", "reading"],
    ["reading notes", "reading"],
    ["ch 5 notes", "reading"],
    ["chapter 5", "reading"],
    ["pset 4", "problem_set"],
    ["problems 1-20", "problem_set"],
    ["hw 7", "problem_set"],
    ["worksheet", "problem_set"],
    ["science project", "project"],
    ["quiz review", "study"],
    ["test prep", "study"],
    ["study for unit 3", "study"],
    ["exam", "study"],
    ["lab writeup", null],
  ])("%s → %s", (title, category) => {
    const r = parse(`hist ${title} fri 30m`);
    expect(r.category).toBe(category);
    expect(r.title).toBe(title); // category words stay in the title
  });
});

describe("titles and edge cases", () => {
  it("keeps the original letter case in the title", () => {
    expect(parse("hist DBQ Essay fri 45m").title).toBe("DBQ Essay");
  });

  it("works in any order", () => {
    expect(parse("45m fri essay hist")).toMatchObject({
      classId: "hist",
      title: "essay",
      dueAt: due(11, 13),
      estimatedMinutes: 45,
    });
  });

  it("ignores extra spaces and trailing commas", () => {
    expect(parse("  hist,   essay   fri,  45m ")).toMatchObject({
      classId: "hist",
      title: "essay",
      dueAt: due(11, 13),
      estimatedMinutes: 45,
    });
  });

  it("reports a missing title", () => {
    const r = parse("hist fri 45m");
    expect(r.title).toBe("");
    expect(r.missing).toEqual(["title"]);
  });

  it("empty input: everything is missing", () => {
    expect(parse("")).toEqual({
      classId: null,
      title: "",
      dueAt: null,
      estimatedMinutes: null,
      category: null,
      missing: ["class", "title", "dueAt", "estimatedMinutes"],
    });
  });

  it("works with no classes at all", () => {
    expect(parseQuickAdd("hist essay fri 45m", [], NOW).missing).toEqual(["class"]);
  });
});

describe("parseDurationText (the planner's custom time box)", () => {
  it.each([
    ["90", 90],
    ["90m", 90],
    ["1h30", 90],
    ["1.5 hours", 90],
    [" 2h ", 120],
    ["0", null],
    ["abc", null],
    ["90 apples", null],
    ["", null],
  ] as const)("%s → %s", (text, minutes) => {
    expect(parseDurationText(text)).toBe(minutes);
  });
});
