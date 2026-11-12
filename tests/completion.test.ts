import { describe, expect, it } from "vitest";
import { actualTimeOptions, completionPatch, undoCompletionPatch } from "@/lib/completion";

describe("actualTimeOptions", () => {
  it("offers the estimate and ±15/±30 minutes", () => {
    expect(actualTimeOptions(45)).toEqual([15, 30, 45, 60, 75]);
  });

  it("leaves out zero and negative times", () => {
    expect(actualTimeOptions(20)).toEqual([5, 20, 35, 50]);
    expect(actualTimeOptions(15)).toEqual([15, 30, 45]);
  });
});

describe("completion patches", () => {
  const now = new Date("2026-11-11T21:00:00Z");

  it("marks done with the time and actual minutes", () => {
    expect(completionPatch(50, now)).toEqual({
      status: "done",
      completed_at: "2026-11-11T21:00:00.000Z",
      actual_minutes: 50,
    });
  });

  it("skipping still marks it done, without actual minutes", () => {
    expect(completionPatch(null, now).actual_minutes).toBeNull();
  });

  it("undo puts everything back (and satisfies the database's status check)", () => {
    expect(undoCompletionPatch).toEqual({ status: "todo", completed_at: null, actual_minutes: null });
  });
});
