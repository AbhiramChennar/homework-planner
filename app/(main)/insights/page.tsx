"use client";

// Insights: how good are your guesses, and is the app doing better?
// Hidden until 5 completions with logged times, because with fewer than that
// the numbers are mostly noise.
import { useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { ErrorChart } from "@/components/ErrorChart";
import { Card, PageTitle, Spinner } from "@/components/ui";
import { DEFAULT_CLASS_COLOR } from "@/lib/classColors";
import { accuracySummary, classBias, weeklyAccuracy } from "@/lib/metrics";

const NEEDED = 5;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function InsightsPage() {
  const { classes, assignments, loading } = useData();

  const logged = assignments.filter((a) => a.status === "done" && a.actual_minutes !== null).length;
  const summary = useMemo(() => accuracySummary(assignments), [assignments]);
  const bias = useMemo(() => classBias(assignments), [assignments]);
  const weeks = useMemo(() => weeklyAccuracy(assignments), [assignments]);
  const classById = new Map(classes.map((c) => [c.id, c]));

  if (loading) return <Spinner />;

  if (logged < NEEDED) {
    return (
      <>
        <PageTitle>Insights</PageTitle>
        <Card className="space-y-3">
          <p className="font-medium">
            {logged === 0 ? "Your insights unlock after 5 finished assignments." : `${logged} of ${NEEDED} done. Almost there!`}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={logged} aria-valuemin={0} aria-valuemax={NEEDED}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${(logged / NEEDED) * 100}%` }} />
          </div>
          <p className="text-sm text-muted">
            When you finish homework, tap <strong>Done</strong> and pick how long it really took. After {NEEDED}, you&apos;ll
            see how accurate your guesses are, which classes take longer than you think, and how much the app&apos;s
            predictions help.
          </p>
        </Card>
      </>
    );
  }

  const better =
    summary.estimateError !== null && summary.predictionError !== null && summary.predictionError < summary.estimateError;

  return (
    <>
      <PageTitle>Insights</PageTitle>

      {summary.count > 0 && summary.estimateError !== null && summary.predictionError !== null ? (
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Your guesses are off by" value={pct(summary.estimateError)} color="var(--series-estimate)" />
            <Stat label="App predictions are off by" value={pct(summary.predictionError)} color="var(--series-prediction)" />
          </div>
          <p className="text-sm text-muted">
            On average, across {summary.count} assignments.{" "}
            {better
              ? `The app's prediction was closer ${pct(summary.predictionCloserShare!)} of the time.`
              : "The app is still learning your habits; predictions improve as you log more."}
            {summary.tieShare! > 0 && ` (${pct(summary.tieShare!)} were a tie, usually before the app had enough data for that class.)`}
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">
            Accuracy shows up once assignments created with a prediction are finished. Keep logging!
          </p>
        </Card>
      )}

      <h2 className="mt-6 mb-2 font-semibold">By class</h2>
      <Card>
        <ul className="divide-y divide-border">
          {bias.map((b) => {
            const cls = classById.get(b.classId);
            return (
              <li key={b.classId} className="flex items-center gap-3 py-2">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: cls?.color ?? DEFAULT_CLASS_COLOR }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{cls?.name ?? "Deleted class"}</span>
                  <span className="block text-xs text-muted">{b.count} logged</span>
                </span>
                <span className="text-right text-sm">{describeBias(b.medianRatio)}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <h2 className="mt-6 mb-2 font-semibold">Error by week</h2>
      <Card>
        {weeks.length >= 2 ? (
          <ErrorChart weeks={weeks} />
        ) : (
          <p className="text-sm text-muted">The weekly chart appears after two weeks of logged work.</p>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="flex items-center gap-2 text-xs text-muted">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** 1.5 → "takes 50% longer than you guess" */
function describeBias(ratio: number): string {
  const p = Math.round(((ratio - 1) * 100) / 5) * 5;
  if (p === 0) return "about what you guess";
  return p > 0 ? `${p}% longer than you guess` : `${-p}% less than you guess`;
}
