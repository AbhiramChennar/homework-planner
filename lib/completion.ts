// Pure helpers for the "How long did it actually take?" dialog.

/**
 * The one-tap answers: the student's estimate, ±15 and ±30 minutes.
 * Options that would be zero or negative are left out, and duplicates removed.
 */
export function actualTimeOptions(estimate: number): number[] {
  const options = [estimate - 30, estimate - 15, estimate, estimate + 15, estimate + 30];
  return [...new Set(options.filter((m) => m > 0))];
}

/** The fields to save when an assignment is marked done. */
export function completionPatch(actualMinutes: number | null, now: Date) {
  return {
    status: "done" as const,
    completed_at: now.toISOString(),
    // null = the student skipped logging; the assignment is done but can't be
    // used to learn from.
    actual_minutes: actualMinutes,
  };
}

/** The fields to save to undo a completion. */
export const undoCompletionPatch = {
  status: "todo" as const,
  completed_at: null,
  actual_minutes: null,
};
