import { describe, expect, it } from "vitest";
import {
  calendarDaysBetween,
  dueGroup,
  formatDue,
  formatMinutes,
  formatTime,
  fromDateInputValue,
  toDateInputValue,
} from "@/lib/dates";

// Wednesday, November 11 2026, 3pm local.
const NOW = new Date(2026, 10, 11, 15, 0);
const at = (month: number, day: number, h = 23, m = 59) => new Date(2026, month - 1, day, h, m);

describe("calendarDaysBetween", () => {
  it("counts calendar days, not 24-hour periods", () => {
    expect(calendarDaysBetween(NOW, at(11, 11, 23))).toBe(0);
    expect(calendarDaysBetween(NOW, at(11, 12, 0, 5))).toBe(1); // just 9 hours away, but tomorrow
    expect(calendarDaysBetween(NOW, at(11, 10))).toBe(-1);
  });

  it("handles the daylight-saving change (Nov 1 2026 in the US)", () => {
    expect(calendarDaysBetween(new Date(2026, 9, 31, 12), new Date(2026, 10, 2, 12))).toBe(2);
  });
});

describe("dueGroup", () => {
  it.each([
    [at(11, 11, 14), "overdue"], // earlier today
    [at(11, 9), "overdue"],
    [at(11, 11), "today"],
    [at(11, 12), "tomorrow"],
    [at(11, 13), "thisWeek"],
    [at(11, 18), "thisWeek"], // 7 days out
    [at(11, 19), "later"],
  ] as const)("%s → %s", (date, group) => {
    expect(dueGroup(date, NOW)).toBe(group);
  });
});

describe("formatDue", () => {
  it.each([
    [at(11, 11), "Today"],
    [at(11, 12), "Tomorrow"],
    [at(11, 10), "Yesterday"],
    [at(11, 13), "Fri"],
    [at(11, 17), "Tue"],
    [at(11, 20), "Nov 20"],
    [at(11, 8), "Nov 8"],
    [at(11, 12, 8, 30), "Tomorrow 8:30am"],
    [at(11, 13, 15, 0), "Fri 3pm"],
  ] as const)("%s → %s", (date, text) => {
    expect(formatDue(date, NOW)).toBe(text);
  });
});

describe("formatting helpers", () => {
  it("formatTime", () => {
    expect(formatTime(at(1, 1, 0, 0))).toBe("12am");
    expect(formatTime(at(1, 1, 12, 5))).toBe("12:05pm");
    expect(formatTime(at(1, 1, 23, 59))).toBe("11:59pm");
  });

  it("formatMinutes", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(95)).toBe("1h 35m");
  });

  it("date input values round-trip in local time", () => {
    expect(toDateInputValue(at(11, 3))).toBe("2026-11-03");
    expect(fromDateInputValue("2026-11-03")).toEqual(at(11, 3));
    expect(fromDateInputValue("")).toBeNull();
    expect(fromDateInputValue("nope")).toBeNull();
  });
});
