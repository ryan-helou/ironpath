import { Discipline, Plan, Week, Workout } from "./types";
import { addDays, dayIndexOf, fromISO } from "./dates";
import { BuildCtx, Draft } from "./workouts";
import * as W from "./workouts";
import { generatePlan } from "./planEngine";
import { fmtDuration } from "./format";

// ---------------------------------------------------------------------------
// Plan adaptation. Pure functions returning a new Plan.
// Rules (from best-in-class apps): a single miss is absorbed, not crammed;
// "skip" (won't do) and "move" (will do later) are distinct; swaps replace a
// session; falling behind → rebuild the remainder from today.
// ---------------------------------------------------------------------------

function clonePlan(plan: Plan): Plan {
  return {
    ...plan,
    workouts: Object.fromEntries(Object.entries(plan.workouts).map(([k, v]) => [k, { ...v, segments: v.segments }])),
    weeks: plan.weeks.map((w) => ({ ...w, workoutIds: [...w.workoutIds] })),
  };
}

/** Recompute each week's workout membership + day/week indices from dates. */
export function reindexWeeks(plan: Plan): void {
  for (const wk of plan.weeks) wk.workoutIds = [];
  const weeksSorted = [...plan.weeks].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  for (const w of Object.values(plan.workouts)) {
    const wk = weeksSorted.find((week) => {
      const start = fromISO(week.startDate).getTime();
      const end = start + 7 * 86400000;
      const t = fromISO(w.date).getTime();
      return t >= start && t < end;
    });
    if (wk) {
      w.weekIndex = wk.index;
      w.dayIndex = dayIndexOf(w.date);
      wk.workoutIds.push(w.id);
    }
  }
  for (const wk of plan.weeks) {
    wk.workoutIds.sort((a, b) => plan.workouts[a].dayIndex - plan.workouts[b].dayIndex);
  }
}

export function setStatus(plan: Plan, id: string, status: Workout["status"], note?: string): Plan {
  const p = clonePlan(plan);
  const w = p.workouts[id];
  if (!w) return p;
  p.workouts[id] = { ...w, status, note: note ?? (status === "planned" ? undefined : w.note) };
  return p;
}

export function logInstead(plan: Plan, id: string, note: string): Plan {
  const p = clonePlan(plan);
  const w = p.workouts[id];
  if (!w) return p;
  p.workouts[id] = { ...w, status: "swapped", note };
  return p;
}

/** Move a workout to a new date (kept inside the plan window). Returns null if invalid. */
export function moveWorkout(plan: Plan, id: string, newDateISO: string): Plan {
  const p = clonePlan(plan);
  const w = p.workouts[id];
  if (!w) return p;
  const start = fromISO(p.startDateISO).getTime();
  const end = fromISO(addDays(p.weeks[p.weeks.length - 1].startDate, 6)).getTime();
  const t = fromISO(newDateISO).getTime();
  if (t < start || t > end) return p; // out of range → ignore
  p.workouts[id] = { ...w, date: newDateISO, movedFrom: w.movedFrom ?? w.date, status: "moved" };
  reindexWeeks(p);
  // moved workouts should present as still-to-do
  p.workouts[id] = { ...p.workouts[id], status: "planned", movedFrom: w.movedFrom ?? w.date };
  return p;
}

function replacementDraft(ctx: BuildCtx, discipline: Discipline, minutes: number): Draft {
  const m = Math.max(20, Math.round(minutes));
  switch (discipline) {
    case "swim":
      return W.swimEndurance(ctx, Math.max(800, Math.round((m * 60 * 1.3) / 100) * 100));
    case "bike":
      return W.bikeEndurance(ctx, m);
    case "run":
      return W.runEasy(ctx, m);
    case "strength":
      return W.strength(ctx, Math.min(40, m));
    default:
      return W.runEasy(ctx, m);
  }
}

/** Swap a session for an easy session of a different discipline (keeps the day). */
export function swapDiscipline(plan: Plan, id: string, discipline: Discipline): Plan {
  const p = clonePlan(plan);
  const w = p.workouts[id];
  if (!w) return p;
  const ctx: BuildCtx = { paces: p.paces, level: p.profile.level };
  const draft = replacementDraft(ctx, discipline, (w.estDurationSec || 2400) / 60);
  const newId = `${w.id}-swap-${discipline}`;
  delete p.workouts[id];
  const nw: Workout = {
    ...w,
    id: newId,
    discipline: draft.discipline,
    type: draft.type,
    title: draft.title,
    purpose: draft.purpose,
    segments: draft.segments,
    estDurationSec: draft.estDurationSec,
    estDistanceM: draft.estDistanceM,
    primaryZone: draft.primaryZone,
    status: "planned",
    note: `Swapped from ${w.discipline}`,
  };
  p.workouts[newId] = nw;
  reindexWeeks(p);
  return p;
}

/**
 * Rebuild the remaining plan from today (the "realign / rebuild" action for
 * when you've fallen behind). Past workouts + their statuses are preserved;
 * future weeks are regenerated to still land on race day.
 */
export function rebuildFromToday(plan: Plan, todayISO: string): Plan {
  const fresh = generatePlan(plan.profile);
  const cutoff = fromISO(todayISO).getTime();

  // keep old workouts strictly before today (with their statuses)
  const kept: Record<string, Workout> = {};
  for (const w of Object.values(plan.workouts)) {
    if (fromISO(w.date).getTime() < cutoff) kept[w.id] = w;
  }
  // add fresh workouts from today onward
  for (const w of Object.values(fresh.workouts)) {
    if (fromISO(w.date).getTime() >= cutoff) kept[w.id] = w;
  }
  const merged: Plan = { ...fresh, workouts: kept, id: plan.id, notice: "Plan rebuilt around today — you're realigned to hit race day." };
  reindexWeeks(merged);
  return merged;
}

/** Ease the next N days: downgrade hard sessions to endurance, trim long ones. */
export function easeUpcoming(plan: Plan, fromISODate: string, days: number): Plan {
  const p = clonePlan(plan);
  const ctx: BuildCtx = { paces: p.paces, level: p.profile.level };
  const start = fromISO(fromISODate).getTime();
  const end = start + days * 86400000;
  for (const [id, w] of Object.entries(p.workouts)) {
    const t = fromISO(w.date).getTime();
    if (t < start || t > end) continue;
    if (w.status !== "planned") continue;
    const hard = ["threshold", "vo2", "tempo", "brick"].includes(w.type);
    if (hard) {
      const draft = replacementDraft(ctx, w.discipline === "brick" ? "bike" : w.discipline, (w.estDurationSec || 2400) / 60 * 0.8);
      p.workouts[id] = {
        ...w,
        type: draft.type,
        title: `Easy ${draft.title}`,
        purpose: "Dialed back so you can recover and come back stronger.",
        segments: draft.segments,
        estDurationSec: draft.estDurationSec,
        estDistanceM: draft.estDistanceM,
        primaryZone: draft.primaryZone,
        note: "Eased off",
      };
    }
  }
  return p;
}

// ---- week / plan progress helpers (for the UI) ----

export function weekProgress(plan: Plan, wk: Week): { done: number; total: number; plannedSec: number; doneSec: number } {
  let done = 0;
  let plannedSec = 0;
  let doneSec = 0;
  const total = wk.workoutIds.filter((id) => plan.workouts[id]?.discipline !== "rest").length;
  for (const id of wk.workoutIds) {
    const w = plan.workouts[id];
    if (!w) continue;
    plannedSec += w.estDurationSec || 0;
    if (w.status === "done" || w.status === "swapped") {
      done++;
      doneSec += w.estDurationSec || 0;
    }
  }
  return { done, total, plannedSec, doneSec };
}

export interface ComplianceColor {
  status: Workout["status"];
  color: string;
  label: string;
}

export function complianceOf(w: Workout): ComplianceColor {
  switch (w.status) {
    case "done":
      return { status: w.status, color: "var(--success)", label: "Completed" };
    case "swapped":
      return { status: w.status, color: "var(--z3)", label: "Swapped" };
    case "skipped":
      return { status: w.status, color: "var(--danger)", label: "Skipped" };
    case "moved":
      return { status: w.status, color: "var(--z2)", label: "Moved" };
    default:
      return { status: w.status, color: "var(--muted)", label: "Planned" };
  }
}

export function summarizeForCoach(plan: Plan, todayISO: string): string {
  const dist = plan.profile.raceType;
  const wk = plan.weeks.find((week) => {
    const s = fromISO(week.startDate).getTime();
    return fromISO(todayISO).getTime() >= s && fromISO(todayISO).getTime() < s + 7 * 86400000;
  });
  const today = Object.values(plan.workouts).filter((w) => w.date === todayISO);
  const lines: string[] = [];
  lines.push(`Race: ${plan.profile.raceType} on ${plan.raceDateISO}. Level: ${plan.profile.level}.`);
  if (wk) lines.push(`Current week: ${wk.label} (${wk.phase} phase), target ${wk.targetHours}h. Focus: ${wk.focus}`);
  if (today.length) {
    lines.push(
      `Today's sessions: ${today
        .map((w) => `${w.title} (${w.discipline}, ${fmtDuration(w.estDurationSec)})`)
        .join("; ")}`,
    );
  } else {
    lines.push("Today is a rest day.");
  }
  return lines.join("\n");
}
