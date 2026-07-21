"use client";

import { useState } from "react";
import { Discipline, Plan, Segment, Workout, Zone } from "@/lib/types";
import { DISCIPLINE_META, ZONES } from "@/lib/zones";
import { targetView } from "@/lib/targets";
import { fmtDistance, fmtDuration } from "@/lib/format";
import { addDays, fmtDayMonth, todayISO, weekdayShort } from "@/lib/dates";
import { IntervalBar } from "./IntervalBar";
import { useUI } from "./ui";

function ZoneChip({ zone }: { zone?: Zone }) {
  if (!zone) return null;
  const m = ZONES[zone];
  const onLight = zone === 3 || zone === 4;
  return (
    <span
      className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold"
      style={{ background: `var(${m.colorVar})`, color: onLight ? "#141a24" : "#fff" }}
    >
      Z{zone}
    </span>
  );
}

function SegRow({ seg, paces }: { seg: Segment; paces: Plan["paces"] }) {
  const disc = (seg.discipline ?? "run") as Discipline;
  const showTarget = seg.zone && seg.kind !== "rest" && disc !== "strength" && disc !== "rest";
  const tv = showTarget ? targetView(disc, seg.zone as Zone, paces) : null;
  return (
    <div className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium leading-snug">{seg.description}</div>
        <ZoneChip zone={seg.zone} />
      </div>
      {tv && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span className="font-semibold text-accent-soft">{tv.primary}</span>
          {tv.secondary.map((s, i) => (
            <span key={i} className="tnum">· {s}</span>
          ))}
        </div>
      )}
      {seg.cue && <div className="mt-1 text-xs italic text-muted">{seg.cue}</div>}
    </div>
  );
}

function sectionOf(k: Segment["kind"]): "warmup" | "main" | "cooldown" {
  return k === "warmup" ? "warmup" : k === "cooldown" ? "cooldown" : "main";
}
const SECTION_LABEL = { warmup: "Warm-up", main: "Main set", cooldown: "Cool-down" };

export function WorkoutDetail({ workout, plan }: { workout: Workout; plan: Plan }) {
  const { openWorkout, openCoach, actions } = useUI();
  const [mode, setMode] = useState<null | "move" | "swap" | "log">(null);
  const [note, setNote] = useState("");
  const meta = DISCIPLINE_META[workout.discipline];
  const isRace = workout.id === "w-race-day";
  const done = workout.status === "done";

  // group segments into sections
  const sections: { label: string; segs: Segment[] }[] = [];
  let cur = "";
  for (const s of workout.segments) {
    const sec = sectionOf(s.kind);
    if (sec !== cur) {
      sections.push({ label: SECTION_LABEL[sec], segs: [] });
      cur = sec;
    }
    sections[sections.length - 1].segs.push(s);
  }

  const close = () => openWorkout(null);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" onClick={close}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="animate-pop relative max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-line bg-background pb-8 safe-b"
        onClick={(e) => e.stopPropagation()}
      >
        {/* grab handle */}
        <div className="sticky top-0 z-10 flex justify-center bg-background/90 pt-3 pb-1 backdrop-blur">
          <div className="h-1.5 w-10 rounded-full bg-line" />
          <button onClick={close} className="absolute right-4 top-3 text-muted hover:text-foreground">✕</button>
        </div>

        <div className="px-5">
          {/* header */}
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ background: `color-mix(in oklab, var(${meta.colorVar}) 18%, transparent)` }}>
              {meta.icon}
            </div>
            <div>
              <h2 className={`font-display text-xl font-bold leading-tight ${isRace ? "text-gradient" : ""}`}>{workout.title}</h2>
              <div className="text-sm capitalize text-muted">{meta.label} · {workout.type.replace("_", " ")}</div>
            </div>
          </div>

          {/* totals */}
          <div className="mb-4 flex gap-2">
            <Stat label="Duration" value={workout.estDurationSec > 0 ? fmtDuration(workout.estDurationSec) : "—"} />
            {workout.estDistanceM ? <Stat label="Distance" value={fmtDistance(workout.estDistanceM)} /> : null}
            <Stat label="Intensity" value={ZONES[workout.primaryZone].name} accent />
          </div>

          {/* interval bar */}
          {!isRace && (
            <div className="mb-4">
              <IntervalBar segments={workout.segments} />
            </div>
          )}

          {/* purpose */}
          <div className="mb-4 rounded-2xl border border-accent/25 bg-accent/5 p-3.5">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-accent-soft">Why it matters</div>
            <p className="text-sm leading-relaxed">{workout.purpose}</p>
          </div>

          {workout.note && (
            <div className="mb-4 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-muted">Note: {workout.note}</div>
          )}

          {/* segments */}
          <div className="mb-5">
            {sections.map((sec, i) => (
              <div key={i} className="mb-2">
                <div className="mb-0.5 mt-2 text-xs font-bold uppercase tracking-wide text-muted">{sec.label}</div>
                <div className="divide-y divide-line rounded-2xl border border-line bg-surface px-3.5">
                  {sec.segs.map((s, j) => (
                    <SegRow key={j} seg={s} paces={plan.paces} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* action panels */}
          {mode === "move" && (
            <MovePanel
              onPick={(iso) => { actions.move(workout.id, iso); close(); }}
              onCancel={() => setMode(null)}
            />
          )}
          {mode === "swap" && (
            <SwapPanel current={workout.discipline} onPick={(d) => { actions.swap(workout.id, d); close(); }} onCancel={() => setMode(null)} />
          )}
          {mode === "log" && (
            <div className="mb-4 rounded-2xl border border-line bg-surface-2 p-3">
              <div className="mb-2 text-sm font-semibold">What did you do instead?</div>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 45 min easy trail run" />
              <div className="mt-2 flex gap-2">
                <button className="btn btn-primary flex-1 py-2.5" onClick={() => { if (note.trim()) { actions.logInstead(workout.id, note.trim()); close(); } }}>Save</button>
                <button className="btn btn-ghost px-4 py-2.5" onClick={() => setMode(null)}>Cancel</button>
              </div>
            </div>
          )}

          {/* actions */}
          {!isRace ? (
            <div className="space-y-2">
              <button
                onClick={() => actions.toggleDone(workout.id)}
                className={`btn w-full py-3.5 text-base ${done ? "btn-ghost" : "btn-primary"}`}
              >
                {done ? "✓ Completed — undo" : "Mark complete"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode(mode === "move" ? null : "move")} className="btn btn-ghost py-2.5 text-sm">Move day</button>
                <button onClick={() => setMode(mode === "swap" ? null : "swap")} className="btn btn-ghost py-2.5 text-sm">Swap sport</button>
                <button onClick={() => setMode(mode === "log" ? null : "log")} className="btn btn-ghost py-2.5 text-sm">Did something else</button>
                <button
                  onClick={() => (workout.status === "skipped" ? actions.unskip(workout.id) : actions.skip(workout.id))}
                  className="btn btn-ghost py-2.5 text-sm"
                  style={{ color: workout.status === "skipped" ? undefined : "var(--danger)" }}
                >
                  {workout.status === "skipped" ? "Un-skip" : "Skip workout"}
                </button>
              </div>
              <button onClick={() => openCoach(`About my session "${workout.title}": `)} className="btn btn-ghost w-full py-2.5 text-sm">
                💬 Ask the coach about this
              </button>
            </div>
          ) : (
            <button onClick={() => actions.toggleDone(workout.id)} className={`btn w-full py-3.5 text-base ${done ? "btn-ghost" : "btn-primary"}`}>
              {done ? "🏆 You did it! (undo)" : "I finished the race 🏁"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-display text-base font-bold tnum ${accent ? "text-accent-soft" : ""}`}>{value}</div>
    </div>
  );
}

function MovePanel({ onPick, onCancel }: { onPick: (iso: string) => void; onCancel: () => void }) {
  const today = todayISO();
  const days = Array.from({ length: 10 }).map((_, i) => addDays(today, i));
  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Move to which day?</span>
        <button onClick={onCancel} className="text-xs text-muted">Cancel</button>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {days.map((iso) => (
          <button key={iso} onClick={() => onPick(iso)} className="flex flex-col items-center rounded-xl border border-line bg-surface px-3 py-2 text-center hover:bg-surface-3">
            <span className="text-xs text-muted">{weekdayShort((new Date(iso).getDay() + 6) % 7)}</span>
            <span className="tnum text-sm font-semibold">{fmtDayMonth(iso)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SwapPanel({ current, onPick, onCancel }: { current: Discipline; onPick: (d: Discipline) => void; onCancel: () => void }) {
  const opts: Discipline[] = ["swim", "bike", "run", "strength"];
  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Swap for an easy…</span>
        <button onClick={onCancel} className="text-xs text-muted">Cancel</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {opts.map((d) => (
          <button
            key={d}
            disabled={d === current}
            onClick={() => onPick(d)}
            className="flex flex-col items-center rounded-xl border border-line bg-surface py-2.5 disabled:opacity-30 hover:bg-surface-3"
          >
            <span className="text-xl">{DISCIPLINE_META[d].icon}</span>
            <span className="text-xs">{DISCIPLINE_META[d].label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
