"use client";

// Line chart: average error per week, your guesses vs the app's predictions.
// Plain SVG (no chart library) so every piece is explainable. Hovering or
// using the arrow keys moves a crosshair that shows both values for that week;
// a table view below has the same numbers for anyone who can't see the chart.
import { useEffect, useRef, useState } from "react";
import type { WeekAccuracy } from "@/lib/metrics";

const H = 220;
const PAD = { top: 16, right: 64, bottom: 28, left: 40 }; // right side holds the line labels
const FONT = 12;

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekLabel = (d: Date) => `${MONTH[d.getMonth()]} ${d.getDate()}`;
const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

const SERIES = [
  { key: "estimateError", label: "Your guesses", color: "var(--series-estimate)" },
  { key: "predictionError", label: "App predictions", color: "var(--series-prediction)" },
] as const;

export function ErrorChart({ weeks }: { weeks: WeekAccuracy[] }) {
  const [active, setActive] = useState<number | null>(null);
  // Draw at the container's real width (rather than scaling a fixed drawing),
  // so labels stay a readable 12px on a phone.
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxValue = Math.max(0.25, ...weeks.flatMap((w) => [w.estimateError ?? 0, w.predictionError ?? 0]));
  const yMax = Math.ceil(maxValue / 0.25) * 0.25; // round up to a multiple of 25%
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (weeks.length === 1 ? plotW / 2 : (i / (weeks.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;
  const ticks = Array.from({ length: Math.round(yMax / 0.25) + 1 }, (_, i) => i * 0.25);

  function pointerToIndex(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    weeks.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setActive(best);
  }

  const shown = active ?? weeks.length - 1;

  return (
    <figure>
      {/* Legend (always shown for 2 series) */}
      <div className="mb-2 flex flex-wrap gap-4 text-sm text-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <span className="h-0.5 w-5 rounded" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative" ref={boxRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none outline-none"
          role="img"
          aria-label="Average error per week for your guesses and the app's predictions. Use left and right arrow keys to read each week."
          tabIndex={0}
          onPointerMove={pointerToIndex}
          onPointerDown={pointerToIndex}
          onPointerLeave={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive(Math.max(0, shown - 1));
            if (e.key === "ArrowRight") setActive(Math.min(weeks.length - 1, shown + 1));
          }}
          onFocus={() => setActive(shown)}
          onBlur={() => setActive(null)}
        >
          {/* Recessive grid and y-axis labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={FONT} fill="var(--muted)">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {/* x-axis: first and last week labels only, to avoid collisions */}
          {weeks.map((w, i) =>
            i === 0 || i === weeks.length - 1 || i === active ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={FONT} fill="var(--muted)">
                {weekLabel(w.weekStart)}
              </text>
            ) : null,
          )}

          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--muted)" strokeWidth={1} />
          )}

          {SERIES.map((s) => {
            const pts = weeks
              .map((w, i) => ({ i, v: w[s.key] }))
              .filter((p): p is { i: number; v: number } => p.v !== null);
            const d = pts.map((p, j) => `${j ? "L" : "M"}${x(p.i)},${y(p.v)}`).join(" ");
            const last = pts[pts.length - 1];
            return (
              <g key={s.key}>
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {pts.map((p) => (
                  <circle
                    key={p.i}
                    cx={x(p.i)}
                    cy={y(p.v)}
                    r={p.i === active ? 5 : 4}
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                ))}
                {/* Direct label at the end of each line (text in ink color, not series color) */}
                {last && (
                  <text x={x(last.i) + 10} y={y(last.v)} dy="0.32em" fontSize={FONT} fill="var(--text)">
                    {s.label === "Your guesses" ? "You" : "App"} {pct(last.v)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {active !== null && (
          <div
            className="pointer-events-none absolute top-0 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow"
            style={{
              left: `${(x(active) / W) * 100}%`,
              transform: x(active) > W / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
            }}
          >
            <p className="font-medium">Week of {weekLabel(weeks[active].weekStart)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center gap-2 whitespace-nowrap">
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}: off by {pct(weeks[active][s.key])}
              </p>
            ))}
            <p className="text-muted">{weeks[active].count} assignments</p>
          </div>
        )}
      </div>

      <details className="mt-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 text-accent">Show as a table</summary>
        <table className="w-full text-left">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-medium">Week of</th>
              <th className="py-1 font-medium">Done</th>
              <th className="py-1 font-medium">Your guesses</th>
              <th className="py-1 font-medium">App</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.weekStart.getTime()} className="border-t border-border">
                <td className="py-1">{weekLabel(w.weekStart)}</td>
                <td className="py-1">{w.count}</td>
                <td className="py-1">{pct(w.estimateError)}</td>
                <td className="py-1">{pct(w.predictionError)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
