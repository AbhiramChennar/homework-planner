import { describe, expect, it } from "vitest";
import { normalizeShortName, suggestShortName } from "@/lib/classColors";

describe("suggestShortName", () => {
  it.each([
    ["AP US History", "hist"],
    ["Calculus BC", "calc"],
    ["English 11", "engl"],
    ["Honors Chemistry", "chem"],
    ["Spanish", "span"],
    ["AP", "ap"], // nothing left after skipping prefixes: use what there is
    ["", ""],
  ])("%s → %s", (name, expected) => {
    expect(suggestShortName(name)).toBe(expected);
  });
});

describe("normalizeShortName", () => {
  it("lowercases and strips spaces and symbols", () => {
    expect(normalizeShortName(" Hist-2 ")).toBe("hist2");
  });
});
