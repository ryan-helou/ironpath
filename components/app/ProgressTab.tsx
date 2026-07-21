"use client";

import { useApp } from "../AppProvider";
import { useUI } from "./ui";
import { weekOfDate } from "./widgets";
import { daysBetween } from "@/lib/dates";
import { fmtDuration } from "@/lib/format";
import { DISCIPLINE_META } from "@/lib/zones";
import { Discipline } from "@/lib/types";

export function ProgressTab() {
  const { plan } = useApp();
  const { today } = useUI();
  if (!plan) return null;

  const all = Object.values(plan.workouts).filter((w) => w.discipline !== "rest");
  const done = all.filter((w) => w.status === "done" || w.status === "swapped");
  const skipped = all.filter((w) => w.status === "skipped");
  const totalDays = Math.max(1, daysBetween(plan.startDateISO, plan.raceDateISO));
  const elapsed = Math.max(0, Math.min(totalDays, daysBetween(plan.startDateISO, today)));
  const pct = Math.round((elapsed / totalDays) * 100);
  const curWeek = weekOfDate(plan, today).index;

  // discipline breakdown of completed time
  const byDisc: Record<string, number> = {};
  for (const w of done) byDisc[w.discipline] = (byDisc[w.discipline] ?? 0) + (w.estDurationSec || 0);
  const discOrder: Discipline[] = ["swim", "bike", "run", "brick", "strength"];
  const maxDisc = Math.max(1, ...Object.values(byDisc));

  const maxTarget = Math.max(...plan.weeks.map((w) => w.targetHours), 1);
  const doneHrsByWeek = plan.weeks.map((w) =>
    w.workoutIds.reduce((a, id) => {
      const x = plan.workouts[id];
      return a + (x.status === "done" || x.status === "swapped" ? (x.estDurationSec || 0) / 3600 : 0);
    }, 0),
  );

  return (
    <div className="space-y-4 px-4 py-4">
      <h1 className="font-display text-2xl font-bold">Progress</h1>

      <div className="grid grid-cols-3 gap-2">
        <BigStat label="Plan" value={`${pct}%`} sub="through" />
        <BigStat label="Done" value={String(done.length)} sub="sessions" accent />
        <BigStat label="Skipped" value={String(skipped.length)} sub="sessions" />
      </div>

      {/* weekly volume trend */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 text-sm font-bold">Weekly volume</div>
        <div className="flex h-28 items-end gap-1">
          {plan.weeks.map((w, i) => {
            const th = (w.targetHours / maxTarget) * 100;
            const dh = (doneHrsByWeek[i] / maxTarget) * 100;
            return (
              <div key={i} className="relative flex flex-1 items-end" style={{ height: "100%" }} title={`${w.label}: ${w.targetHours}h`}>
                <div className="w-full rounded-t bg-surface-3" style={{ height: `${th}%` }}>
                  <div
                    className="w-full rounded-t"
                    style={{ height: `${Math.min(100, (dh / Math.max(th, 1)) * 100)}%`, background: i === curWeek ? "var(--accent)" : "var(--z2)" }}
                  />
                </div>
                {i === curWeek && <div className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent" />}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-surface-3" /> target</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-z2" /> completed</span>
        </div>
      </div>

      {/* discipline breakdown */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 text-sm font-bold">Time by sport (completed)</div>
        <div className="space-y-2.5">
          {discOrder.filter((d) => byDisc[d]).length === 0 && (
            <div className="text-sm text-muted">Complete a session to see your breakdown here.</div>
          )}
          {discOrder.filter((d) => byDisc[d]).map((d) => (
            <div key={d} className="flex items-center gap-3">
              <span className="w-6 text-lg">{DISCIPLINE_META[d].icon}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${(byDisc[d] / maxDisc) * 100}%`, background: `var(${DISCIPLINE_META[d].colorVar})` }} />
              </div>
              <span className="tnum w-14 text-right text-sm text-muted">{fmtDuration(byDisc[d])}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-center text-sm text-muted">
        Consistency over weeks beats perfection over days. Keep showing up. 💪
      </div>
    </div>
  );
}

function BigStat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 text-center">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-display text-2xl font-bold tabular-nums ${accent ? "text-gradient" : ""}`}>{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  );
}
