"use client";

// Marking homework done. Any page can call useCompletion().complete(assignment):
// a dialog asks "How long did it actually take?" with one-tap answers, then an
// "Undo" bar shows for 10 seconds.
//
// Logging actual time is the most important thing users do for the project
// (it's the data the estimator learns from), so it must take one tap.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { actualTimeOptions, completionPatch, undoCompletionPatch } from "@/lib/completion";
import { formatMinutes } from "@/lib/dates";
import type { Assignment } from "@/lib/types";
import { useData } from "./DataProvider";
import { Dialog } from "./Dialog";
import { Button, Input, Notice } from "./ui";

const UNDO_SECONDS = 10;

interface CompletionContextValue {
  complete: (assignment: Assignment) => void;
}

const CompletionContext = createContext<CompletionContextValue | null>(null);

export function CompletionProvider({ children }: { children: React.ReactNode }) {
  const { editAssignment } = useData();
  const [asking, setAsking] = useState<Assignment | null>(null);
  const [undo, setUndo] = useState<{ assignment: Assignment; secondsLeft: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const complete = useCallback((a: Assignment) => {
    setError(null);
    setAsking(a);
  }, []);

  async function finish(actualMinutes: number | null) {
    if (!asking) return;
    const a = asking;
    try {
      await editAssignment(a.id, completionPatch(actualMinutes, new Date()));
      setAsking(null);
      setUndo({ assignment: a, secondsLeft: UNDO_SECONDS });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    }
  }

  async function undoNow() {
    if (!undo) return;
    const a = undo.assignment;
    setUndo(null);
    await editAssignment(a.id, undoCompletionPatch);
  }

  // Count the undo window down once a second, then hide the bar.
  useEffect(() => {
    if (!undo) return;
    if (undo.secondsLeft <= 0) {
      setUndo(null);
      return;
    }
    const id = setTimeout(() => setUndo((u) => u && { ...u, secondsLeft: u.secondsLeft - 1 }), 1000);
    return () => clearTimeout(id);
  }, [undo]);

  const value = useMemo(() => ({ complete }), [complete]);

  return (
    <CompletionContext.Provider value={value}>
      {children}

      <Dialog open={asking !== null} onClose={() => setAsking(null)} title="Nice work! How long did it take?">
        {asking && <ActualTimePicker assignment={asking} error={error} onPick={finish} />}
      </Dialog>

      {undo && (
        <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4" role="status">
          <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-xl bg-text px-4 py-2 text-bg shadow-lg">
            <span className="min-w-0 truncate text-sm">Done: {undo.assignment.title}</span>
            <button
              type="button"
              onClick={() => void undoNow()}
              className="min-h-11 shrink-0 rounded-lg px-3 font-semibold underline"
            >
              Undo ({undo.secondsLeft})
            </button>
          </div>
        </div>
      )}
    </CompletionContext.Provider>
  );
}

function ActualTimePicker({
  assignment,
  error,
  onPick,
}: {
  assignment: Assignment;
  error: string | null;
  onPick: (minutes: number | null) => Promise<void>;
}) {
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const estimate = assignment.estimated_minutes;
  const customMinutes = parseInt(custom, 10);

  async function pick(minutes: number | null) {
    setBusy(true);
    await onPick(minutes);
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        <span className="font-medium text-text">{assignment.title}</span>. You guessed {formatMinutes(estimate)}.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {actualTimeOptions(estimate).map((m) => (
          <Button
            key={m}
            variant={m === estimate ? "primary" : "secondary"}
            disabled={busy}
            onClick={() => void pick(m)}
            data-autofocus={m === estimate ? true : undefined}
          >
            {formatMinutes(m)}
          </Button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (customMinutes > 0) void pick(customMinutes);
        }}
      >
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          placeholder="Other (minutes)"
          aria-label="Actual minutes"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button type="submit" disabled={busy || !(customMinutes > 0)}>
          Save
        </Button>
      </form>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button variant="ghost" className="w-full" disabled={busy} onClick={() => void pick(null)}>
        Skip: just mark it done
      </Button>
    </div>
  );
}

export function useCompletion(): CompletionContextValue {
  const ctx = useContext(CompletionContext);
  if (!ctx) throw new Error("useCompletion must be used inside <CompletionProvider>");
  return ctx;
}

/** The "Done" button shown on assignment cards. */
export function DoneButton({ assignment }: { assignment: Assignment }) {
  const { complete } = useCompletion();
  if (assignment.status === "done") {
    return <span className="px-2 text-sm font-medium text-ok">✓ Done</span>;
  }
  return (
    <Button onClick={() => complete(assignment)} aria-label={`Mark ${assignment.title} done`} className="px-3">
      Done
    </Button>
  );
}
