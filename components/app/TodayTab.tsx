"use client";

import { useApp } from "../AppProvider";
import { useUI } from "./ui";
import { WorkoutCard } from "./WorkoutCard";
import { PhaseBar, RaceCountdown, weekOfDate, workoutsOn } from "./widgets";
import { weekProgress } from "@/lib/adapt";
import { fmtDuration } from "@/lib/format";
import { fmtFullDate as fullDate } from "@/lib/dates";

export function TodayTab() {
  const { plan, username, offline } = useApp();
  const { today, openWorkout, openCoach, goTab } = useUI();
  if (!plan) return null;

  const todays = workoutsOn(plan, today);
  const wk = weekOfDate(plan, today);
  const prog = weekProgress(plan, wk);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted">{greeting},</div>
          <div className="font-display text-2xl font-bold capitalize">{username}</div>
        </div>
        <button onClick={() => openCoach()} className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-4 text-sm font-semibold">
          💬 Coach
        </button>
      </div>

      {offline && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          You&apos;re offline — showing your saved plan. Changes will sync when you reconnect.
        </div>
      )}

      <RaceCountdown plan={plan} today={today} />

      {plan.notice && (
        <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-muted">{plan.notice}</div>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Today</h2>
          <span className="text-sm text-muted">{fullDate(today)}</span>
        </div>
        {todays.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-5 text-center">
            <div className="text-3xl">🌙</div>
            <div className="mt-2 font-semibold">Rest day</div>
            <div className="text-sm text-muted">Recovery is where you get stronger. Sleep, hydrate, and refuel.</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {todays.map((w) => (
              <WorkoutCard key={w.id} workout={w} onOpen={() => openWorkout(w.id)} />
            ))}
          </div>
        )}
      </div>

      {/* week at a glance */}
      <button onClick={() => goTab("plan")} className="w-full rounded-2xl border border-line bg-surface p-4 text-left transition hover:bg-surface-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display font-bold">{wk.label}</span>
          <span className="text-xs text-muted">
            {prog.done}/{prog.total} done · {fmtDuration(prog.plannedSec)}
          </span>
        </div>
        <PhaseBar plan={plan} current={wk.index} />
        <div className="mt-3 text-sm text-muted">{wk.focus}</div>
      </button>
    </div>
  );
}
