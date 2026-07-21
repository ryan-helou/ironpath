"use client";

import { Workout } from "@/lib/types";
import { DISCIPLINE_META } from "@/lib/zones";
import { complianceOf } from "@/lib/adapt";
import { fmtDuration, fmtDistance } from "@/lib/format";

export function WorkoutCard({ workout, onOpen, compact }: { workout: Workout; onOpen: () => void; compact?: boolean }) {
  const meta = DISCIPLINE_META[workout.discipline];
  const comp = complianceOf(workout);
  const dimmed = workout.status === "skipped";
  const isRace = workout.id === "w-race-day";

  return (
    <button
      onClick={onOpen}
      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-3 text-left transition hover:bg-surface-2 ${
        dimmed ? "opacity-55" : ""
      } ${isRace ? "ring-1 ring-accent" : ""}`}
    >
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: `var(${meta.colorVar})` }} />
      <div
        className="ml-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-xl"
        style={{ background: `color-mix(in oklab, var(${meta.colorVar}) 18%, transparent)` }}
      >
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate font-semibold ${isRace ? "text-gradient" : ""}`}>{workout.title}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-sm text-muted">
          <span className="tnum">{workout.estDurationSec > 0 ? fmtDuration(workout.estDurationSec) : "—"}</span>
          {workout.estDistanceM ? (
            <>
              <span className="opacity-40">·</span>
              <span className="tnum">{fmtDistance(workout.estDistanceM)}</span>
            </>
          ) : null}
          {!compact && (
            <>
              <span className="opacity-40">·</span>
              <span className="capitalize">{meta.label}</span>
            </>
          )}
        </div>
      </div>
      {workout.status !== "planned" && (
        <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `color-mix(in oklab, ${comp.color} 18%, transparent)`, color: comp.color }}>
          {comp.label}
        </span>
      )}
      {workout.status === "planned" && !isRace && (
        <span className="mr-1 flex h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: `var(--z${workout.primaryZone})` }} />
      )}
    </button>
  );
}
