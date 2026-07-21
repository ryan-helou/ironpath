"use client";

import { Phase, Plan, Week, Workout } from "@/lib/types";
import { daysBetween, fromISO } from "@/lib/dates";
import { fmtClock } from "@/lib/format";
import { raceDistances, estimateRaceSeconds, categoryOf } from "@/lib/planEngine";

export function weekOfDate(plan: Plan, iso: string): Week {
  const t = fromISO(iso).getTime();
  for (const w of plan.weeks) {
    const s = fromISO(w.startDate).getTime();
    if (t >= s && t < s + 7 * 86400000) return w;
  }
  return t < fromISO(plan.weeks[0].startDate).getTime() ? plan.weeks[0] : plan.weeks[plan.weeks.length - 1];
}

export function workoutsOn(plan: Plan, iso: string): Workout[] {
  return Object.values(plan.workouts)
    .filter((w) => w.date === iso)
    .sort((a, b) => (a.discipline > b.discipline ? 1 : -1));
}

const PHASE_COLOR: Record<Phase, string> = {
  base: "var(--z2)",
  build: "var(--z4)",
  peak: "var(--accent)",
  taper: "var(--z1)",
};
const PHASE_LABEL: Record<Phase, string> = { base: "Base", build: "Build", peak: "Peak", taper: "Taper" };

export function RaceCountdown({ plan, today }: { plan: Plan; today: string }) {
  const dist = raceDistances(plan.profile);
  const days = Math.max(0, daysBetween(today, plan.raceDateISO));
  const est = estimateRaceSeconds(plan.paces, plan.profile.level, categoryOf(plan.profile), dist);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-surface p-4">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full accent-gradient opacity-20 blur-xl" />
      <div className="relative flex items-end justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">{dist.name} · Race day</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tabular-nums text-gradient">{days}</span>
            <span className="text-sm text-muted">days to go</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Projected finish</div>
          <div className="font-display text-lg font-bold tabular-nums">{fmtClock(est)}</div>
        </div>
      </div>
    </div>
  );
}

export function PhaseBar({ plan, current }: { plan: Plan; current: number }) {
  // consecutive phase bands
  const bands: { phase: Phase; count: number; startIdx: number }[] = [];
  plan.weeks.forEach((w, i) => {
    const last = bands[bands.length - 1];
    if (last && last.phase === w.phase) last.count++;
    else bands.push({ phase: w.phase, count: 1, startIdx: i });
  });
  return (
    <div>
      <div className="flex gap-1">
        {bands.map((b, i) => {
          const isCurrent = current >= b.startIdx && current < b.startIdx + b.count;
          return (
            <div key={i} className="flex flex-col gap-1" style={{ flex: b.count }}>
              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ background: `color-mix(in oklab, ${PHASE_COLOR[b.phase]} 25%, var(--surface-2))` }}
              >
                {isCurrent && (
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${((current - b.startIdx + 1) / b.count) * 100}%`,
                      background: PHASE_COLOR[b.phase],
                    }}
                  />
                )}
                {!isCurrent && current >= b.startIdx + b.count && (
                  <div className="h-full w-full rounded-full" style={{ background: PHASE_COLOR[b.phase], opacity: 0.6 }} />
                )}
              </div>
              <div className={`text-center text-[10px] font-semibold ${isCurrent ? "text-foreground" : "text-muted"}`}>
                {PHASE_LABEL[b.phase]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
