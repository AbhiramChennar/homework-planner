"use client";

// "Tonight": say how much time you have, get an ordered plan with start times.
import { useEffect, useMemo, useState } from "react";
import { AssignmentCard } from "@/components/AssignmentCard";
import { useAuth } from "@/components/AuthProvider";
import { DoneButton } from "@/components/Completion";
import { useData } from "@/components/DataProvider";
import { Button, Card, Field, Input, Notice, PageTitle, Spinner } from "@/components/ui";
import { useNow } from "@/components/useNow";
import { getLocalStorage } from "@/lib/browser";
import {
  clearCurrentPlan,
  loadCurrentPlan,
  planStartTime,
  saveCurrentPlan,
  type CurrentPlan,
} from "@/lib/currentPlan";
import { formatDue, formatMinutes, formatTime } from "@/lib/dates";
import { parseDurationText } from "@/lib/parser";
import { buildPlan, type PlanStep } from "@/lib/scheduler";
import type { Assignment, Class } from "@/lib/types";

const QUICK_TIMES = [30, 60, 120, 180];

export default function TonightPage() {
  const { session } = useAuth();
  const { classes, assignments, loading, error, store } = useData();
  const now = useNow();
  const userId = session.status === "signedIn" ? session.userId : "";

  const [choice, setChoice] = useState<number | "custom" | null>(null);
  const [customText, setCustomText] = useState("");
  const [plan, setPlan] = useState<CurrentPlan | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  // Show the plan made earlier tonight, if there is one.
  useEffect(() => {
    if (userId) setPlan(loadCurrentPlan(getLocalStorage(), userId, new Date()));
  }, [userId]);

  const customMinutes = parseDurationText(customText);
  const availableMinutes = choice === "custom" ? customMinutes : choice;

  const byId = useMemo(() => new Map(assignments.map((a) => [a.id, a])), [assignments]);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const todoCount = assignments.filter((a) => a.status === "todo").length;

  if (loading) return <Spinner />;

  async function makePlan() {
    if (!availableMinutes) return;
    const created = new Date();
    const built = buildPlan(assignments, availableMinutes, created);
    const current: CurrentPlan = { ...built, createdAt: created.toISOString(), availableMinutes };
    setPlan(current);
    saveCurrentPlan(getLocalStorage(), userId, current);
    setSaveWarning(null);
    // Every generated plan is logged so scheduling can be studied later.
    try {
      await store.savePlan({
        available_minutes: availableMinutes,
        items: built.items.flatMap((s) =>
          s.kind === "work" ? [{ assignment_id: s.assignmentId, minutes: s.minutes, order: s.order }] : [],
        ),
        model_version: "baseline",
      });
    } catch {
      setSaveWarning("Your plan is ready, but it couldn't be saved to your account (are you offline?).");
    }
  }

  function startOver() {
    setPlan(null);
    clearCurrentPlan(getLocalStorage(), userId);
  }

  return (
    <>
      <PageTitle>Tonight</PageTitle>
      {error && <Notice tone="danger">{error}</Notice>}

      {!plan ? (
        <Card className="space-y-4">
          <fieldset>
            <legend className="mb-2 font-medium">How much time do you have?</legend>
            <div className="grid grid-cols-5 gap-2">
              {QUICK_TIMES.map((m) => (
                <Button
                  key={m}
                  variant={choice === m ? "primary" : "secondary"}
                  aria-pressed={choice === m}
                  onClick={() => setChoice(m)}
                  className="px-1"
                >
                  {formatMinutes(m)}
                </Button>
              ))}
              <Button
                variant={choice === "custom" ? "primary" : "secondary"}
                aria-pressed={choice === "custom"}
                onClick={() => setChoice("custom")}
                className="px-1"
              >
                Other
              </Button>
            </div>
          </fieldset>
          {choice === "custom" && (
            <Field label="Time available" hint='Like "90", "1h30" or "2.5h"'>
              <Input
                autoFocus
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void makePlan()}
                placeholder="1h30"
                inputMode="text"
                aria-invalid={customText !== "" && !customMinutes}
              />
            </Field>
          )}
          <Button variant="primary" className="w-full" disabled={!availableMinutes || todoCount === 0} onClick={makePlan}>
            Make my plan
          </Button>
          {todoCount === 0 && <p className="text-sm text-muted">No homework to plan. Nice! Add some on the Homework page.</p>}
        </Card>
      ) : (
        <PlanView
          plan={plan}
          now={now}
          byId={byId}
          classById={classById}
          saveWarning={saveWarning}
          onStartOver={startOver}
        />
      )}
    </>
  );
}

function PlanView({
  plan,
  now,
  byId,
  classById,
  saveWarning,
  onStartOver,
}: {
  plan: CurrentPlan;
  now: Date;
  byId: Map<string, Assignment>;
  classById: Map<string, Class>;
  saveWarning: string | null;
  onStartOver: () => void;
}) {
  // Start times are fixed when the plan is made, so they don't drift as the clock moves.
  let clock = planStartTime(new Date(plan.createdAt)).getTime();
  const rows = plan.items.map((step) => {
    const start = new Date(clock);
    clock += step.minutes * 60_000;
    return { step, start };
  });
  const end = new Date(clock);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {formatMinutes(plan.workMinutes)} of work
          {plan.breakMinutes > 0 && `, ${formatMinutes(plan.breakMinutes)} of breaks`}
          {rows.length > 0 && `, done around ${formatTime(end)}`}
        </p>
        <Button onClick={onStartOver}>New plan</Button>
      </div>

      {saveWarning && <Notice tone="warn">{saveWarning}</Notice>}

      {rows.length === 0 && (
        <Notice>Nothing fits in {formatMinutes(plan.availableMinutes)}. Try more time, or check what&apos;s due below.</Notice>
      )}

      <ol className="space-y-2">
        {rows.map(({ step, start }) => (
          <li key={step.order} className="flex gap-3">
            <span className="w-16 shrink-0 pt-2 text-right text-sm tabular-nums text-muted">{formatTime(start)}</span>
            <div className="min-w-0 flex-1">
              {step.kind === "break" ? (
                <div className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted">
                  Break · {step.minutes}m. Stand up, stretch, get water.
                </div>
              ) : (
                <WorkRow step={step} byId={byId} classById={classById} now={now} />
              )}
            </div>
          </li>
        ))}
      </ol>

      {plan.unscheduledUrgent.length > 0 && (
        <Notice tone="warn">
          <p className="font-medium">Didn&apos;t fit, but due soon:</p>
          <ul className="mt-1 list-disc pl-5">
            {plan.unscheduledUrgent.map((u) => {
              const a = byId.get(u.assignmentId);
              if (!a) return null;
              return (
                <li key={u.assignmentId}>
                  {a.title} ({classById.get(a.class_id)?.name ?? "class"}, {formatMinutes(u.minutes)}, due{" "}
                  {formatDue(new Date(a.due_at), now)})
                </li>
              );
            })}
          </ul>
        </Notice>
      )}
    </div>
  );
}

function WorkRow({
  step,
  byId,
  classById,
  now,
}: {
  step: Extract<PlanStep, { kind: "work" }>;
  byId: Map<string, Assignment>;
  classById: Map<string, Class>;
  now: Date;
}) {
  const a = byId.get(step.assignmentId);
  if (!a) {
    return <div className="rounded-xl border border-border px-3 py-2 text-sm text-muted">(deleted assignment)</div>;
  }
  return (
    <div className="space-y-1">
      <AssignmentCard
        assignment={a}
        cls={classById.get(a.class_id)}
        now={now}
        actions={<DoneButton assignment={a} />}
      />
      {step.isChunk && (
        <p className="pl-2 text-xs text-muted">
          Work on this for {formatMinutes(step.minutes)} tonight (the whole thing is about{" "}
          {formatMinutes(a.predicted_minutes ?? a.estimated_minutes)}).
        </p>
      )}
    </div>
  );
}
