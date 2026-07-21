"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "../AppProvider";
import { useUI } from "./ui";
import { WorkoutCard } from "./WorkoutCard";
import { PhaseBar, weekOfDate } from "./widgets";
import { weekProgress } from "@/lib/adapt";
import { addDays, weekdayShort, fmtDayMonth } from "@/lib/dates";
import { fmtDuration } from "@/lib/format";
import { Week } from "@/lib/types";

export function PlanTab() {
  const { plan } = useApp();
  const { today, openWorkout } = useUI();
  const cur = plan ? weekOfDate(plan, today).index : 0;
  const [sel, setSel] = useState(cur);
  const pillRow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // scroll the selected week pill into view
    pillRow.current?.querySelector<HTMLElement>(`[data-w="${sel}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [sel]);

  if (!plan) return null;
  const week = plan.weeks[sel];
  const prog = weekProgress(plan, week);

  return (
    <div className="px-4 py-4">
      <h1 className="mb-3 font-display text-2xl font-bold">Training Plan</h1>

      <div className="mb-3 rounded-2xl border border-line bg-surface p-3">
        <PhaseBar plan={plan} current={cur} />
      </div>

      {/* week pills */}
      <div ref={pillRow} className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {plan.weeks.map((w) => (
          <button
            key={w.index}
            data-w={w.index}
            onClick={() => setSel(w.index)}
            className={`flex-shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
              w.index === sel ? "border-accent bg-accent/15 text-foreground" : "border-line bg-surface-2 text-muted"
            } ${w.index === cur && w.index !== sel ? "ring-1 ring-accent/40" : ""}`}
          >
            {w.isRaceWeek ? "🏁 Race" : w.label.replace(" · Recovery", "*")}
          </button>
        ))}
      </div>

      {/* week header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setSel((s) => Math.max(0, s - 1))} disabled={sel === 0} className="btn btn-ghost h-8 w-8 !p-0 disabled:opacity-30">‹</button>
          <div>
            <div className="font-display text-lg font-bold">{week.label}</div>
            <div className="text-xs text-muted capitalize">{week.phase} phase · target {fmtDuration(week.targetHours * 3600)}</div>
          </div>
          <button onClick={() => setSel((s) => Math.min(plan.weeks.length - 1, s + 1))} disabled={sel === plan.weeks.length - 1} className="btn btn-ghost h-8 w-8 !p-0 disabled:opacity-30">›</button>
        </div>
        <span className="text-xs text-muted">{prog.done}/{prog.total} done</span>
      </div>

      <DayStrip week={week} today={today} plan={plan} />

      <p className="mb-3 mt-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-muted">{week.focus}</p>

      {/* agenda */}
      <div className="space-y-4">
        {Array.from({ length: 7 }).map((_, day) => {
          const iso = addDays(week.startDate, day);
          const items = week.workoutIds.map((id) => plan.workouts[id]).filter((w) => w.dayIndex === day);
          const isToday = iso === today;
          return (
            <div key={day}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`text-sm font-bold ${isToday ? "text-accent-soft" : ""}`}>{weekdayShort(day)}</span>
                <span className="text-xs text-muted">{fmtDayMonth(iso)}</span>
                {isToday && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-soft">TODAY</span>}
              </div>
              {items.length === 0 ? (
                <div className="rounded-xl border border-line/60 bg-surface/50 px-3 py-2 text-sm text-muted">Rest</div>
              ) : (
                <div className="space-y-2">
                  {items.map((w) => (
                    <WorkoutCard key={w.id} workout={w} onOpen={() => openWorkout(w.id)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayStrip({ week, today, plan }: { week: Week; today: string; plan: import("@/lib/types").Plan }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 7 }).map((_, day) => {
        const iso = addDays(week.startDate, day);
        const items = week.workoutIds.map((id) => plan.workouts[id]).filter((w) => w.dayIndex === day);
        const isToday = iso === today;
        return (
          <div
            key={day}
            className={`flex flex-1 flex-col items-center rounded-xl border py-2 ${isToday ? "border-accent bg-accent/10" : "border-line bg-surface-2"}`}
          >
            <span className="text-[10px] text-muted">{weekdayShort(day)[0]}</span>
            <span className="tnum text-sm font-bold">{new Date(iso).getDate()}</span>
            <div className="mt-1 flex h-1.5 items-center gap-0.5">
              {items.slice(0, 3).map((w) => (
                <span key={w.id} className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--z${w.primaryZone})`, opacity: w.status === "skipped" ? 0.3 : 1 }} />
              ))}
              {items.length === 0 && <span className="h-1.5 w-1.5 rounded-full bg-line" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
