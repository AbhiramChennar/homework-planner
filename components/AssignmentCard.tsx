"use client";

// One assignment in a list: class color, title, class, due date and minutes.
// The whole card is a button that opens the edit form; `actions` (like a Done
// button) sit beside it, outside that button, so they're separate tap targets.
import { DEFAULT_CLASS_COLOR } from "@/lib/classColors";
import { formatDue, formatMinutes } from "@/lib/dates";
import type { Assignment, Class } from "@/lib/types";

export function AssignmentCard({
  assignment,
  cls,
  now,
  onOpen,
  actions,
  explanation,
}: {
  assignment: Assignment;
  cls: Class | undefined;
  now: Date;
  onOpen?: () => void;
  actions?: React.ReactNode;
  /** Why the prediction differs from the estimate (shown when it does). */
  explanation?: string;
}) {
  const due = new Date(assignment.due_at);
  const overdue = assignment.status === "todo" && due < now;
  const predicted = assignment.predicted_minutes;
  const showPrediction = predicted !== null && predicted !== assignment.estimated_minutes;

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-border bg-surface">
      <span aria-hidden className="w-1.5 shrink-0" style={{ backgroundColor: cls?.color ?? DEFAULT_CLASS_COLOR }} />
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="min-h-14 min-w-0 flex-1 px-3 py-2 text-left hover:bg-surface-2 disabled:hover:bg-transparent"
      >
        {/* <span className="block"> rather than <p>: a <button> may only contain inline content. */}
        <span
          className={`block truncate font-medium ${assignment.status === "done" ? "text-muted line-through" : ""}`}
        >
          {assignment.title}
        </span>
        <span className="block truncate text-sm text-muted">
          {cls?.name ?? "No class"}
          {" · "}
          <span className={overdue ? "font-medium text-danger" : ""}>
            {overdue ? "Overdue · " : ""}
            {formatDue(due, now)}
          </span>
          {" · "}
          {showPrediction ? (
            <span title="Your estimate → the app's prediction">
              <span className="line-through">{formatMinutes(assignment.estimated_minutes)}</span>{" "}
              <span className="font-medium text-accent">~{formatMinutes(predicted)}</span>
            </span>
          ) : (
            formatMinutes(assignment.estimated_minutes)
          )}
        </span>
        {showPrediction && explanation && assignment.status === "todo" && (
          <span className="mt-0.5 block text-xs text-accent">{explanation}</span>
        )}
      </button>
      {actions && <div className="flex shrink-0 items-center gap-1 pr-2">{actions}</div>}
    </div>
  );
}
