"use client";

// Pilot dashboard, for the pilot's organizer only. Not linked in the main
// navigation; the More page links here for admins. Access is enforced by the
// database (admin_dataset() refuses non-admins), not by this page.
import { useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import { Button, Card, Notice, PageTitle, Spinner } from "@/components/ui";
import { pilotMetrics, toCsv, type PilotDataset } from "@/lib/pilot";

type State =
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: PilotDataset };

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

export default function AdminPage() {
  const { store } = useData();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await store.isAdmin())) {
        if (!cancelled) setState({ kind: "denied" });
        return;
      }
      try {
        const data = await store.adminDataset();
        if (!cancelled) setState({ kind: "ready", data });
      } catch (e) {
        if (!cancelled) setState({ kind: "error", message: e instanceof Error ? e.message : "Couldn't load." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);

  if (state.kind === "loading") return <Spinner />;
  if (state.kind === "denied") {
    return (
      <>
        <PageTitle>Pilot dashboard</PageTitle>
        <Notice>This page is only for the pilot&apos;s organizer.</Notice>
      </>
    );
  }
  if (state.kind === "error") {
    return (
      <>
        <PageTitle>Pilot dashboard</PageTitle>
        <Notice tone="danger">{state.message}</Notice>
      </>
    );
  }

  const m = pilotMetrics(state.data, new Date());
  const completions = state.data.assignments.filter((a) => a.status === "done").length;

  function download() {
    const blob = new Blob([toCsv(state.kind === "ready" ? state.data : { users: [], assignments: [] })], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `homework-planner-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageTitle action={<Button onClick={download}>Download anonymized CSV</Button>}>Pilot dashboard</PageTitle>

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Users" value={String(m.totalUsers)} />
        <Tile label="Completions" value={String(completions)} />
        <Tile label="With time logged" value={pct(m.loggedShare)} />
      </div>

      <h2 className="mt-6 mb-2 font-semibold">Still active after…</h2>
      <div className="grid grid-cols-3 gap-2">
        {m.retention.map((r) => (
          <Tile
            key={r.afterWeeks}
            label={`${r.afterWeeks} week${r.afterWeeks > 1 ? "s" : ""}`}
            value={r.eligible ? pct(r.retained / r.eligible) : "–"}
            detail={`${r.retained} of ${r.eligible}`}
          />
        ))}
      </div>

      <h2 className="mt-6 mb-2 font-semibold">By week</h2>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="p-2 font-medium">Week of</th>
              <th className="p-2 font-medium">Active</th>
              <th className="p-2 font-medium">Added / user</th>
              <th className="p-2 font-medium">Done</th>
              <th className="p-2 font-medium">Logged</th>
              <th className="p-2 font-medium">Guess error</th>
              <th className="p-2 font-medium">App error</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {[...m.weeks].reverse().map((w) => (
              <tr key={w.weekStart.getTime()} className="border-t border-border">
                <td className="p-2">{`${MONTH[w.weekStart.getMonth()]} ${w.weekStart.getDate()}`}</td>
                <td className="p-2">{w.activeUsers}</td>
                <td className="p-2">{w.assignmentsPerActiveUser === null ? "–" : w.assignmentsPerActiveUser.toFixed(1)}</td>
                <td className="p-2">{w.completions}</td>
                <td className="p-2">{pct(w.loggedShare)}</td>
                <td className="p-2">{pct(w.estimateError)}</td>
                <td className="p-2">{pct(w.predictionError)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-4 text-xs text-muted">
        Everything here is anonymized by the database: users are random ids (different on every load), classes are
        reduced to a subject, and titles and descriptions never leave the database. Feedback messages are in the
        Supabase dashboard (Table Editor → feedback).
      </p>
    </>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="text-xs text-muted">{detail}</p>}
    </div>
  );
}
