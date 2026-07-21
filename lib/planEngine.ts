import {
  Discipline,
  Level,
  Phase,
  Plan,
  Profile,
  Week,
  Workout,
} from "./types";
import { derivePaces } from "./paces";
import { BuildCtx, Draft } from "./workouts";
import * as W from "./workouts";
import {
  addDays,
  dayIndexOf,
  mondayOf,
  todayISO,
  weeksBetween,
} from "./dates";

// ---------------------------------------------------------------------------
// Deterministic periodization engine.  Runs entirely in code (no API cost).
// Encodes: plan length by distance×level, Base/Build/Peak/Taper split,
// 3:1 (or 2:1) load:deload cycles, 80/20 intensity, long-session caps, taper.
// ---------------------------------------------------------------------------

type Cat = "olympic" | "half" | "full";

export const RACE_DISTANCES: Record<Cat, { swim: number; bike: number; run: number; name: string }> = {
  olympic: { swim: 1500, bike: 40000, run: 10000, name: "Olympic" },
  half: { swim: 1900, bike: 90000, run: 21100, name: "Ironman 70.3" },
  full: { swim: 3800, bike: 180000, run: 42200, name: "Ironman" },
};

const PLAN_LEN: Record<Cat, { min: number; max: number }> = {
  olympic: { min: 8, max: 16 },
  half: { min: 12, max: 24 },
  full: { min: 16, max: 30 },
};

const PEAK_HOURS: Record<Cat, Record<Level, number>> = {
  olympic: { beginner: 7, intermediate: 9, advanced: 11, elite: 13 },
  half: { beginner: 9, intermediate: 11, advanced: 14, elite: 17 },
  full: { beginner: 12, intermediate: 15, advanced: 18, elite: 22 },
};

const TAPER_WEEKS: Record<Cat, number> = { olympic: 1, half: 2, full: 3 };

// long-session caps (minutes) — you don't train the full race distance
const LONG_RUN_CAP: Record<Cat, number> = { olympic: 90, half: 120, full: 180 };
const LONG_RIDE_CAP: Record<Cat, number> = { olympic: 150, half: 240, full: 330 };

export function categoryOf(p: Profile): Cat {
  if (p.raceType === "olympic") return "olympic";
  if (p.raceType === "half") return "half";
  if (p.raceType === "full") return "full";
  // classify a custom race by its run leg
  const run = p.custom?.runM ?? 10000;
  if (run <= 12000) return "olympic";
  if (run <= 25000) return "half";
  return "full";
}

const RACE_BIKE_KMH: Record<Level, number> = { beginner: 26, intermediate: 30, advanced: 33, elite: 36 };

/** Rough race-day finish estimate from the athlete's derived paces. */
export function estimateRaceSeconds(
  paces: import("./types").PaceModel,
  level: Level,
  cat: Cat,
  dist: { swim: number; bike: number; run: number },
): number {
  // swim ~ tempo pace (near CSS)
  const swimZ = paces.swim.zones[3];
  const swimPace = (swimZ.loSecPer100 + swimZ.hiSecPer100) / 2; // sec/100m
  const swimSec = (dist.swim / 100) * swimPace;
  // bike ~ level speed adjusted for race intensity by distance
  const bikeFactor = cat === "full" ? 0.9 : cat === "half" ? 1.0 : 1.08;
  const bikeKmh = RACE_BIKE_KMH[level] * bikeFactor;
  const bikeSec = (dist.bike / 1000 / bikeKmh) * 3600;
  // run ~ Z2 (full), Z3 (half), Z4-ish (olympic)
  const runZone = cat === "full" ? 2 : cat === "half" ? 3 : 4;
  const rz = paces.run.zones[runZone];
  const runPace = cat === "full" ? rz.hiSecPerKm : (rz.loSecPerKm + rz.hiSecPerKm) / 2;
  const runSec = (dist.run / 1000) * runPace;
  const transitions = cat === "full" ? 600 : cat === "half" ? 420 : 300;
  return Math.round(swimSec + bikeSec + runSec + transitions);
}

export function raceDistances(p: Profile): { swim: number; bike: number; run: number; name: string } {
  if (p.raceType === "custom" && p.custom) {
    return { swim: p.custom.swimM, bike: p.custom.bikeM, run: p.custom.runM, name: p.custom.name || "Custom Race" };
  }
  return RACE_DISTANCES[categoryOf(p)];
}

// ---- weekly load curve --------------------------------------------------

function baseFraction(phase: Phase, idxInPhase: number, phaseLen: number, taperPos: number, taperLen: number): number {
  if (phase === "base") {
    if (phaseLen <= 1) return 0.75;
    return 0.6 + (0.85 - 0.6) * (idxInPhase / (phaseLen - 1));
  }
  if (phase === "build") {
    if (phaseLen <= 1) return 0.95;
    return 0.85 + (1.0 - 0.85) * (idxInPhase / (phaseLen - 1));
  }
  if (phase === "peak") return 1.0;
  // taper: descend toward the race
  const ladder = [0.7, 0.55, 0.42];
  // taperPos: 0-based from start of taper; last taper week is race week
  const isRaceWeek = taperPos === taperLen - 1;
  if (isRaceWeek) return 0.32;
  // pick from ladder aligning the end
  const remainingBeforeRace = taperLen - 1 - taperPos; // weeks between this and race
  const li = Math.min(ladder.length - 1, remainingBeforeRace);
  return ladder[Math.max(0, li)];
}

// ---- the scheduler ------------------------------------------------------

interface Slot {
  day: number; // 0=Mon..6=Sun
  discipline: Discipline;
  hard: boolean;
  scalable: boolean;
  weight: number;
  minMin: number;
  maxMin: number;
  build: (min: number) => Draft;
}

function trainingDays(p: Profile): Set<number> {
  const D = Math.max(3, Math.min(7, p.daysPerWeek || 6));
  let pri = [5, 6, 1, 3, 2, 4, 0]; // Sat, Sun, Tue, Thu, Wed, Fri, Mon
  if (p.restDayPreference != null) pri = pri.filter((d) => d !== p.restDayPreference);
  return new Set(pri.slice(0, D));
}

function pickWeekSlots(
  ctx: BuildCtx,
  p: Profile,
  cat: Cat,
  phase: Phase,
  weekIndex: number,
  isRecovery: boolean,
): Slot[] {
  const days = trainingDays(p);
  const slots: Slot[] = [];
  const even = weekIndex % 2 === 0;
  const runCap = LONG_RUN_CAP[cat];
  const rideCap = LONG_RIDE_CAP[cat];
  const has = (d: number) => days.has(d);

  const recover = isRecovery;

  // ---- weekend long sessions ----
  const satTrained = has(5);
  const sunTrained = has(6);

  // Long ride / brick — Saturday (fallback Sunday)
  const bigDay = satTrained ? 5 : sunTrained ? 6 : [...days][0];
  if (satTrained || sunTrained) {
    if (phase === "build" || phase === "peak") {
      const runOff = phase === "peak" ? (cat === "olympic" ? 20 : 30) : cat === "olympic" ? 12 : 18;
      slots.push({
        day: bigDay,
        discipline: "brick",
        hard: !recover,
        scalable: true,
        weight: 3.0,
        minMin: 45,
        maxMin: rideCap + runOff,
        build: (min) => W.brick(ctx, Math.max(30, min - runOff), runOff, phase === "peak"),
      });
    } else {
      slots.push({
        day: bigDay,
        discipline: "bike",
        hard: false,
        scalable: true,
        weight: 3.0,
        minMin: 45,
        maxMin: rideCap,
        build: (min) => W.bikeLong(ctx, min, phase !== "base" && !recover),
      });
    }
  }

  // Long run — the weekend day not taken by the long ride/brick
  const longRunDay = [6, 5].find((d) => has(d) && d !== bigDay) ?? null;
  if (longRunDay != null && has(longRunDay)) {
    slots.push({
      day: longRunDay,
      discipline: "run",
      hard: false,
      scalable: true,
      weight: 2.2,
      minMin: 30,
      maxMin: runCap,
      build: (min) => W.runLong(ctx, min, phase === "peak" && !recover),
    });
  }

  // ---- midweek quality: run (Tue) ----
  if (has(1)) {
    if (phase === "base" || recover) {
      slots.push(quality(1, "run", false, (min) => W.runEasy(ctx, min), 1.2, 25, 70, true));
    } else if (phase === "taper") {
      slots.push(quality(1, "run", true, () => W.runThreshold(ctx, 45), 1.1, 30, 50));
    } else {
      slots.push(
        even
          ? quality(1, "run", true, () => W.runThreshold(ctx), 1.3, 45, 65)
          : quality(1, "run", true, () => W.runVO2(ctx), 1.3, 45, 60),
      );
    }
  }

  // ---- midweek quality: bike (Thu) ----
  if (has(3)) {
    if (phase === "base" || recover) {
      slots.push(quality(3, "bike", false, (min) => W.bikeEndurance(ctx, min), 1.4, 40, 90, true));
    } else if (phase === "taper") {
      slots.push(quality(3, "bike", true, () => W.bikeSweetSpot(ctx, 55), 1.3, 40, 60));
    } else {
      slots.push(
        even
          ? quality(3, "bike", true, () => W.bikeThreshold(ctx), 1.5, 55, 80)
          : quality(3, "bike", true, () => W.bikeSweetSpot(ctx), 1.5, 55, 85),
      );
    }
  }

  // ---- swims: Wed + Fri (a triathlon plan must always swim) ----
  const swimDays = [2, 4].filter(has);
  // borrow a free trained day if we're short
  if (swimDays.length < 2) {
    for (const d of [0, 4, 2, 1]) {
      if (has(d) && !swimDays.includes(d) && !slots.some((s) => s.day === d)) {
        swimDays.push(d);
        if (swimDays.length >= 2) break;
      }
    }
  }
  // still none (3–4 day athletes): double a swim onto the lightest quality day
  if (swimDays.length === 0 && days.size > 0) {
    const dayLoad = new Map<number, number>();
    for (const d of days) dayLoad.set(d, 0);
    for (const s of slots) dayLoad.set(s.day, (dayLoad.get(s.day) ?? 0) + s.weight);
    const lightest = [...dayLoad.entries()].sort((a, b) => a[1] - b[1])[0][0];
    swimDays.push(lightest);
  }
  swimDays.forEach((d, i) => {
    if (phase === "base" || recover) {
      slots.push(swimSlot(d, i === 0 ? () => W.swimTechnique(ctx) : (min) => W.swimEndurance(ctx, distFor(min))));
    } else if (phase === "peak") {
      slots.push(swimSlot(d, i === 0 ? () => W.swimOpenWater(ctx) : () => W.swimThreshold(ctx)));
    } else if (phase === "taper") {
      slots.push(swimSlot(d, i === 0 ? () => W.swimRecovery(ctx, 1000) : () => W.swimThreshold(ctx)));
    } else {
      slots.push(swimSlot(d, i === 0 ? () => W.swimThreshold(ctx) : (min) => W.swimEndurance(ctx, distFor(min))));
    }
  });

  // ---- easy / recovery filler on remaining trained days ----
  const used = new Set(slots.map((s) => s.day));
  const free = [...days].filter((d) => !used.has(d)).sort((a, b) => a - b);
  for (const d of free) {
    // fill with an easy run or recovery depending on load
    if (!slots.some((s) => s.day === d && s.discipline === "run")) {
      slots.push({
        day: d,
        discipline: "run",
        hard: false,
        scalable: true,
        weight: 1.0,
        minMin: 20,
        maxMin: 60,
        build: (min) => (recover || phase === "taper" ? W.runRecovery(ctx, Math.min(35, min)) : W.runEasy(ctx, min)),
      });
    }
  }

  // ---- strength: double up on the lightest trained day (skip taper/recovery peak) ----
  const wantStrength = p.daysPerWeek >= 5 && phase !== "taper";
  if (wantStrength) {
    // find an easy day to attach strength (prefer Mon or a swim/easy day)
    const candidate = [0, 4, 2].find((d) => has(d)) ?? [...days][0];
    slots.push({
      day: candidate,
      discipline: "strength",
      hard: false,
      scalable: false,
      weight: 0.8,
      minMin: 25,
      maxMin: 40,
      build: () => W.strength(ctx, recover ? 25 : 30),
    });
  }

  return slots;

  function quality(
    day: number,
    disc: Discipline,
    hard: boolean,
    build: (min: number) => Draft,
    weight: number,
    minMin: number,
    maxMin: number,
    scalable = false,
  ): Slot {
    return { day, discipline: disc, hard, scalable, weight, minMin, maxMin, build };
  }
  function swimSlot(day: number, build: (min: number) => Draft): Slot {
    return { day, discipline: "swim", hard: false, scalable: false, weight: 1.0, minMin: 30, maxMin: 60, build };
  }
  function distFor(min: number): number {
    // convert scaled minutes → a swim main-set distance (~1.5 m/s)
    return Math.max(600, Math.round((min * 60 * 1.3) / 100) * 100);
  }
}

// ---- assemble the whole plan --------------------------------------------

export function generatePlan(profile: Profile): Plan {
  const cat = categoryOf(profile);
  const paces = derivePaces(profile);
  const ctx: BuildCtx = { paces, level: profile.level };

  // plan length from race date
  const start0 = mondayOf(todayISO());
  const raceMonday = mondayOf(profile.raceDateISO);
  const weeksUntil = weeksBetween(start0, raceMonday) + 1; // include race week
  const { min, max } = PLAN_LEN[cat];

  let totalWeeks: number;
  let compressed = false;
  let delayedStart = false;
  if (weeksUntil < min) {
    totalWeeks = Math.max(4, weeksUntil);
    compressed = true;
  } else if (weeksUntil > max) {
    totalWeeks = max;
    delayedStart = true;
  } else {
    totalWeeks = weeksUntil;
  }

  // start Monday chosen so the last week contains race day
  const startMonday = addDays(raceMonday, -(totalWeeks - 1) * 7);

  // phase split
  const taperWeeks = Math.min(TAPER_WEEKS[cat], Math.max(1, Math.floor(totalWeeks * 0.18)));
  const remaining = totalWeeks - taperWeeks;
  let baseWeeks = Math.max(1, Math.round(remaining * 0.45));
  let peakWeeks = remaining >= 6 ? Math.min(2, Math.max(1, Math.round(remaining * 0.12))) : remaining >= 4 ? 1 : 0;
  let buildWeeks = remaining - baseWeeks - peakWeeks;
  if (buildWeeks < 1) {
    buildWeeks = Math.max(1, remaining - baseWeeks);
    peakWeeks = Math.max(0, remaining - baseWeeks - buildWeeks);
  }
  if (baseWeeks + buildWeeks + peakWeeks !== remaining) {
    baseWeeks = remaining - buildWeeks - peakWeeks;
  }

  const baseEnd = baseWeeks;
  const buildEnd = baseWeeks + buildWeeks;
  const peakEnd = baseWeeks + buildWeeks + peakWeeks;

  const cycleLen = profile.level === "beginner" ? 3 : 4; // 2:1 vs 3:1

  const peakHours = Math.min(
    PEAK_HOURS[cat][profile.level],
    profile.weeklyHoursCap && profile.weeklyHoursCap > 0 ? profile.weeklyHoursCap : Infinity,
  );

  const weeks: Week[] = [];
  const workouts: Record<string, Workout> = {};

  for (let i = 0; i < totalWeeks; i++) {
    const phase: Phase = i < baseEnd ? "base" : i < buildEnd ? "build" : i < peakEnd ? "peak" : "taper";
    const isRaceWeek = i === totalWeeks - 1;
    // recovery weeks only within base/build
    const isRecovery = (phase === "base" || phase === "build") && (i + 1) % cycleLen === 0 && i > 0;

    // phase-local index + label
    let idxInPhase = i;
    let phaseLen = baseWeeks;
    if (phase === "build") { idxInPhase = i - baseEnd; phaseLen = buildWeeks; }
    else if (phase === "peak") { idxInPhase = i - buildEnd; phaseLen = peakWeeks; }
    else if (phase === "taper") { idxInPhase = i - peakEnd; phaseLen = taperWeeks; }

    const label = isRaceWeek
      ? "Race Week"
      : phase === "base"
      ? `Base ${idxInPhase + 1}${isRecovery ? " · Recovery" : ""}`
      : phase === "build"
      ? `Build ${idxInPhase + 1}${isRecovery ? " · Recovery" : ""}`
      : phase === "peak"
      ? `Peak ${idxInPhase + 1}`
      : `Taper ${idxInPhase + 1}`;

    const frac = baseFraction(phase, idxInPhase, phaseLen, phase === "taper" ? idxInPhase : 0, taperWeeks);
    let targetHours = peakHours * frac * (isRecovery ? 0.62 : 1);
    targetHours = Math.round(targetHours * 2) / 2;

    const weekStart = addDays(startMonday, i * 7);
    const week: Week = {
      index: i,
      phase,
      startDate: weekStart,
      label,
      isRecovery,
      isRaceWeek,
      targetHours,
      focus: focusFor(phase, isRecovery, isRaceWeek),
      workoutIds: [],
    };

    // build the week's workouts
    if (isRaceWeek) {
      buildRaceWeek(ctx, profile, cat, week, workouts);
    } else {
      buildNormalWeek(ctx, profile, cat, phase, i, isRecovery, targetHours, week, workouts);
    }

    weeks.push(week);
  }

  const notice = compressed
    ? "Your race is sooner than the ideal build — this plan is compressed. Prioritise the key sessions and stay healthy."
    : delayedStart
    ? "Your race is far out, so structured training kicks off closer to race day. Until then, keep a steady aerobic base."
    : undefined;

  return {
    id: `plan-${Date.now()}`,
    profile,
    startDateISO: startMonday,
    raceDateISO: profile.raceDateISO,
    totalWeeks,
    weeks,
    workouts,
    paces,
    generatedAtISO: new Date().toISOString(),
    compressed,
    delayedStart,
    notice,
  };
}

function focusFor(phase: Phase, rec: boolean, race: boolean): string {
  if (race) return "Rest, sharpen, and race. Trust the work you've banked.";
  if (rec) return "Recovery week — volume drops so your body absorbs the training.";
  if (phase === "base") return "Build the aerobic engine with easy volume and technique.";
  if (phase === "build") return "Add race-specific intensity — threshold, VO2, and bricks.";
  if (phase === "peak") return "Sharpen at race pace with big race-simulation sessions.";
  return "Taper — cut volume, keep it sharp, and freshen up.";
}

function buildNormalWeek(
  ctx: BuildCtx,
  profile: Profile,
  cat: Cat,
  phase: Phase,
  weekIndex: number,
  isRecovery: boolean,
  targetHours: number,
  week: Week,
  out: Record<string, Workout>,
) {
  const slots = pickWeekSlots(ctx, profile, cat, phase, weekIndex, isRecovery);

  // build fixed (non-scalable) first to know their duration budget
  const built = new Map<Slot, Draft>();
  let fixedSec = 0;
  for (const s of slots) {
    if (!s.scalable) {
      const d = s.build(0);
      built.set(s, d);
      fixedSec += d.estDurationSec;
    }
  }

  const scalables = slots.filter((s) => s.scalable);
  const targetSec = targetHours * 3600;
  const remainingSec = Math.max(0, targetSec - fixedSec);
  const wsum = scalables.reduce((a, s) => a + s.weight, 0) || 1;
  for (const s of scalables) {
    const share = (s.weight / wsum) * remainingSec;
    let min = Math.round(share / 60);
    min = Math.max(s.minMin, Math.min(s.maxMin, min));
    built.set(s, s.build(min));
  }

  // emit workouts, one per (day, discipline). Days may hold a double (e.g. strength).
  const perDayCount: Record<number, number> = {};
  for (const s of slots) {
    const draft = built.get(s)!;
    const day = s.day;
    perDayCount[day] = (perDayCount[day] ?? 0) + 1;
    const id = `w-${weekIndex}-${day}-${s.discipline}`;
    const date = addDays(week.startDate, day);
    const wk: Workout = {
      id,
      date,
      weekIndex,
      dayIndex: day,
      discipline: draft.discipline,
      type: draft.type,
      title: draft.title,
      purpose: draft.purpose,
      segments: draft.segments,
      estDurationSec: draft.estDurationSec,
      estDistanceM: draft.estDistanceM,
      primaryZone: draft.primaryZone,
      status: "planned",
    };
    out[id] = wk;
    week.workoutIds.push(id);
  }
  // sort workoutIds by day then discipline
  week.workoutIds.sort((a, b) => out[a].dayIndex - out[b].dayIndex);
}

function buildRaceWeek(
  ctx: BuildCtx,
  profile: Profile,
  cat: Cat,
  week: Week,
  out: Record<string, Workout>,
) {
  const raceDayIndex = dayIndexOf(profile.raceDateISO);
  // light openers on the days before, rest the day before
  const openers: { day: number; build: () => Draft }[] = [];
  const D = trainingDays(profile);
  // a couple of short openers
  if (D.has(1)) openers.push({ day: 1, build: () => W.runThreshold(ctx, 35) });
  if (D.has(3)) openers.push({ day: 3, build: () => W.bikeSweetSpot(ctx, 45) });
  if (D.has(2)) openers.push({ day: 2, build: () => W.swimRecovery(ctx, 800) });

  for (const o of openers) {
    if (o.day >= raceDayIndex) continue; // no sessions on/after race day
    if (o.day === raceDayIndex - 1) continue; // rest day before race
    const draft = o.build();
    const id = `w-race-${o.day}-${draft.discipline}`;
    const wk: Workout = {
      id,
      date: addDays(week.startDate, o.day),
      weekIndex: week.index,
      dayIndex: o.day,
      discipline: draft.discipline,
      type: "race_prep",
      title: `Opener · ${draft.title}`,
      purpose: "Short and sharp — a few efforts to keep the body primed without adding fatigue.",
      segments: draft.segments,
      estDurationSec: Math.min(draft.estDurationSec, 40 * 60),
      estDistanceM: draft.estDistanceM,
      primaryZone: draft.primaryZone,
      status: "planned",
    };
    out[id] = wk;
    week.workoutIds.push(id);
  }

  // THE RACE
  const dist = raceDistances(profile);
  const raceId = "w-race-day";
  const raceWk: Workout = {
    id: raceId,
    date: profile.raceDateISO,
    weekIndex: week.index,
    dayIndex: raceDayIndex,
    discipline: "brick",
    type: "race_prep",
    title: `🏁 RACE DAY — ${dist.name}`,
    purpose: "This is what it was all for. Execute your pacing, fuel early and often, and enjoy every stroke, pedal, and stride.",
    primaryZone: 3,
    estDurationSec: estimateRaceSeconds(ctx.paces, profile.level, cat, dist),
    segments: [
      {
        kind: "main",
        discipline: "swim",
        zone: 3,
        distanceM: dist.swim,
        description: `Swim ${(dist.swim / 1000).toFixed(1)} km — settle into rhythm, sight often`,
        cue: "Start controlled. Find feet to draft. Don't bury yourself in the first 200m.",
      },
      {
        kind: "main",
        discipline: "bike",
        zone: cat === "full" ? 2 : 3,
        distanceM: dist.bike,
        description: `Bike ${(dist.bike / 1000).toFixed(0)} km @ ${cat === "full" ? "70–75%" : cat === "half" ? "80–85%" : "88–95%"} FTP`,
        cue: "Ride your own numbers. Fuel 60–90g carbs/hour. Save the legs for the run.",
      },
      {
        kind: "main",
        discipline: "run",
        zone: cat === "full" ? 2 : 3,
        distanceM: dist.run,
        description: `Run ${(dist.run / 1000).toFixed(1)} km — settle, then build`,
        cue: "First mile easy off the bike. Break it into segments. Finish strong.",
      },
    ],
    status: "planned",
  };
  out[raceId] = raceWk;
  week.workoutIds.push(raceId);
  week.workoutIds.sort((a, b) => out[a].dayIndex - out[b].dayIndex);
}
