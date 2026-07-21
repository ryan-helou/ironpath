import { Discipline, Level, PaceModel, Segment, SessionType, Zone } from "./types";
import { ZONES } from "./zones";

// ---------------------------------------------------------------------------
// Workout builders. Each returns a "draft" (no id/date yet); the plan engine
// stamps those on. Sessions are built from structured segments so the UI can
// render them richly and we can estimate duration + distance from zone speeds.
// ---------------------------------------------------------------------------

export interface BuildCtx {
  paces: PaceModel;
  level: Level;
}

export interface Draft {
  discipline: Discipline;
  type: SessionType;
  title: string;
  purpose: string;
  segments: Segment[];
  estDurationSec: number;
  estDistanceM?: number;
  primaryZone: Zone;
}

const M = (min: number) => Math.round(min * 60);

// ---- speed model (m/s) used for estimating duration<->distance -------------

const BIKE_KMH: Record<Level, number> = {
  beginner: 26,
  intermediate: 30,
  advanced: 33,
  elite: 36,
};
const BIKE_ZONE_FACTOR: Record<Zone, number> = { 1: 0.85, 2: 1, 3: 1.08, 4: 1.14, 5: 1.2 };

function speed(ctx: BuildCtx, disc: Discipline, zone: Zone): number {
  if (disc === "run") {
    const z = ctx.paces.run.zones[zone];
    const pace = (z.loSecPerKm + z.hiSecPerKm) / 2; // sec/km
    return 1000 / pace;
  }
  if (disc === "swim") {
    const z = ctx.paces.swim.zones[zone];
    const pace = (z.loSecPer100 + z.hiSecPer100) / 2; // sec/100m
    return 100 / pace;
  }
  if (disc === "bike") {
    const kmh = BIKE_KMH[ctx.level] * BIKE_ZONE_FACTOR[zone];
    return (kmh * 1000) / 3600;
  }
  return 0; // strength / rest
}

function measure(
  ctx: BuildCtx,
  segments: Segment[],
): { durationSec: number; distanceM: number } {
  let dur = 0;
  let dist = 0;
  for (const s of segments) {
    const reps = s.repeat ?? 1;
    if (s.children && s.children.length) {
      const inner = measure(ctx, s.children);
      dur += reps * inner.durationSec;
      dist += reps * inner.distanceM;
      continue;
    }
    const disc = s.discipline ?? "run";
    const zone = (s.zone ?? 2) as Zone;
    let sd = 0;
    let sdist = 0;
    if (s.durationSec != null) {
      sd = s.durationSec;
      sdist = s.kind === "rest" ? 0 : sd * speed(ctx, disc, zone);
    } else if (s.distanceM != null) {
      sdist = s.distanceM;
      const sp = speed(ctx, disc, zone);
      sd = sp > 0 ? s.distanceM / sp : 0;
    }
    dur += reps * sd;
    dist += reps * (s.kind === "rest" || disc === "strength" ? 0 : sdist);
  }
  return { durationSec: dur, distanceM: dist };
}

function finish(
  ctx: BuildCtx,
  draft: Omit<Draft, "estDurationSec" | "estDistanceM">,
): Draft {
  const { durationSec, distanceM } = measure(ctx, draft.segments);
  const isDist = draft.discipline !== "strength";
  return {
    ...draft,
    estDurationSec: Math.round(durationSec),
    estDistanceM: isDist ? Math.round(distanceM) : undefined,
  };
}

function seg(s: Segment): Segment {
  return s;
}
const zn = (z: Zone) => `${ZONES[z].name} (Z${z})`;

// ===========================================================================
// SWIM
// ===========================================================================

function swimWU(m: number): Segment {
  return seg({
    kind: "warmup",
    discipline: "swim",
    zone: 2,
    distanceM: m,
    description: `${m}m easy free — mix in some backstroke`,
    cue: "Long, relaxed strokes. Wake the shoulders up gradually.",
  });
}
function swimCD(m: number): Segment {
  return seg({
    kind: "cooldown",
    discipline: "swim",
    zone: 1,
    distanceM: m,
    description: `${m}m easy choice — loosen down`,
  });
}

export function swimTechnique(ctx: BuildCtx): Draft {
  return finish(ctx, {
    discipline: "swim",
    type: "technique",
    title: "Technique & Drills",
    purpose: "Cheap speed lives in your stroke — better catch and body position lower the effort of every length you'll ever swim.",
    primaryZone: 2,
    segments: [
      swimWU(300),
      seg({
        kind: "main",
        discipline: "swim",
        zone: 2,
        repeat: 4,
        description: "4 × 50m drill / swim by 25m (15s rest)",
        cue: "Rotate drills: catch-up, single-arm, fingertip-drag, 6-3-6.",
        children: [
          seg({ kind: "main", discipline: "swim", zone: 2, distanceM: 50, description: "50m drill→swim" }),
          seg({ kind: "rest", discipline: "swim", durationSec: 15, description: "15s rest" }),
        ],
      }),
      seg({
        kind: "main",
        discipline: "swim",
        zone: 3,
        repeat: 8,
        description: "8 × 50m @ Tempo, hold stroke count (15s rest)",
        cue: "Count strokes per length and keep it steady as you fatigue.",
        children: [
          seg({ kind: "main", discipline: "swim", zone: 3, distanceM: 50, description: "50m steady" }),
          seg({ kind: "rest", discipline: "swim", durationSec: 15, description: "15s rest" }),
        ],
      }),
      seg({
        kind: "main",
        discipline: "swim",
        zone: 2,
        repeat: 4,
        description: "4 × 100m pull, buoy (20s rest)",
        children: [
          seg({ kind: "main", discipline: "swim", zone: 2, distanceM: 100, description: "100m pull" }),
          seg({ kind: "rest", discipline: "swim", durationSec: 20, description: "20s rest" }),
        ],
      }),
      swimCD(200),
    ],
  });
}

export function swimEndurance(ctx: BuildCtx, mainM = 1200): Draft {
  const setM = Math.max(400, Math.round(mainM / 3 / 100) * 100);
  return finish(ctx, {
    discipline: "swim",
    type: "endurance",
    title: "Aerobic Endurance Swim",
    purpose: "Steady aerobic volume builds the engine that carries your whole race — most of your swim fitness is built right here.",
    primaryZone: 2,
    segments: [
      swimWU(300),
      seg({
        kind: "main",
        discipline: "swim",
        zone: 2,
        repeat: 3,
        description: `3 × ${setM}m @ Endurance (CSS+6s, 30s rest)`,
        cue: "Smooth and continuous — you should be able to hold a rhythm all day.",
        children: [
          seg({ kind: "main", discipline: "swim", zone: 2, distanceM: setM, description: `${setM}m steady` }),
          seg({ kind: "rest", discipline: "swim", durationSec: 30, description: "30s rest" }),
        ],
      }),
      swimCD(200),
    ],
  });
}

export function swimThreshold(ctx: BuildCtx): Draft {
  return finish(ctx, {
    discipline: "swim",
    type: "threshold",
    title: "CSS Threshold Set",
    purpose: "Raising your Critical Swim Speed is the single biggest lever on your swim split — the pace you can hold without blowing up.",
    primaryZone: 4,
    segments: [
      swimWU(300),
      seg({
        kind: "warmup",
        discipline: "swim",
        zone: 4,
        repeat: 4,
        description: "4 × 50m build to CSS (15s rest)",
        children: [
          seg({ kind: "warmup", discipline: "swim", zone: 4, distanceM: 50, description: "50m build" }),
          seg({ kind: "rest", discipline: "swim", durationSec: 15, description: "15s rest" }),
        ],
      }),
      seg({
        kind: "main",
        discipline: "swim",
        zone: 4,
        repeat: 6,
        description: "6 × 100m @ CSS (15s rest)",
        cue: "Comfortably hard, strong, repeatable — not a sprint. Hold your line.",
        children: [
          seg({ kind: "main", discipline: "swim", zone: 4, distanceM: 100, description: "100m @ CSS" }),
          seg({ kind: "rest", discipline: "swim", durationSec: 15, description: "15s rest" }),
        ],
      }),
      seg({
        kind: "main",
        discipline: "swim",
        zone: 3,
        repeat: 4,
        description: "4 × 200m @ CSS+3s, pull (25s rest)",
        children: [
          seg({ kind: "main", discipline: "swim", zone: 3, distanceM: 200, description: "200m aerobic" }),
          seg({ kind: "rest", discipline: "swim", durationSec: 25, description: "25s rest" }),
        ],
      }),
      swimCD(200),
    ],
  });
}

export function swimVO2(ctx: BuildCtx): Draft {
  return finish(ctx, {
    discipline: "swim",
    type: "vo2",
    title: "Swim Speed — VO2",
    purpose: "Short, fast repeats sharpen your top-end and make CSS pace feel easy by comparison.",
    primaryZone: 5,
    segments: [
      swimWU(400),
      seg({
        kind: "main",
        discipline: "swim",
        zone: 5,
        repeat: 12,
        description: "12 × 50m @ CSS−4s (20s rest)",
        cue: "Fast but controlled — great technique at speed, not thrashing.",
        children: [
          seg({ kind: "main", discipline: "swim", zone: 5, distanceM: 50, description: "50m fast" }),
          seg({ kind: "rest", discipline: "swim", durationSec: 20, description: "20s rest" }),
        ],
      }),
      swimCD(300),
    ],
  });
}

export function swimOpenWater(ctx: BuildCtx): Draft {
  return finish(ctx, {
    discipline: "swim",
    type: "race_prep",
    title: "Open-Water Skills",
    purpose: "Race day isn't a black line on the pool floor — sighting and pack swimming are skills you have to rehearse.",
    primaryZone: 3,
    segments: [
      swimWU(400),
      seg({
        kind: "main",
        discipline: "swim",
        zone: 3,
        repeat: 4,
        description: "4 × 200m @ race effort, sight every 6 strokes (20s rest)",
        cue: "Lift the eyes forward, don't lift the head — keep hips high.",
        children: [
          seg({ kind: "main", discipline: "swim", zone: 3, distanceM: 200, description: "200m + sighting" }),
          seg({ kind: "rest", discipline: "swim", durationSec: 20, description: "20s rest" }),
        ],
      }),
      seg({ kind: "main", discipline: "swim", zone: 2, distanceM: 200, description: "200m no-wall turns / continuous" }),
      swimCD(200),
    ],
  });
}

export function swimRecovery(ctx: BuildCtx, m = 900): Draft {
  return finish(ctx, {
    discipline: "swim",
    type: "recovery",
    title: "Recovery Swim",
    purpose: "Easy water time flushes the legs and keeps your feel for the water without adding fatigue.",
    primaryZone: 1,
    segments: [
      swimWU(200),
      seg({ kind: "main", discipline: "swim", zone: 1, distanceM: Math.max(300, m - 400), description: `${Math.max(300, m - 400)}m easy, mixed strokes` }),
      swimCD(200),
    ],
  });
}

// ===========================================================================
// BIKE
// ===========================================================================

function bikeWU(min: number): Segment {
  return seg({ kind: "warmup", discipline: "bike", zone: 2, durationSec: M(min), description: `${min} min progressive spin-up`, cue: "Cadence 85–95, ease into it." });
}
function bikeCD(min: number): Segment {
  return seg({ kind: "cooldown", discipline: "bike", zone: 1, durationSec: M(min), description: `${min} min easy spin` });
}

export function bikeEndurance(ctx: BuildCtx, min = 60): Draft {
  const main = Math.max(20, min - 15);
  return finish(ctx, {
    discipline: "bike",
    type: "endurance",
    title: "Aerobic Endurance Ride",
    purpose: "Time in Zone 2 builds the aerobic engine and fat-burning that let you ride strong for hours — the foundation of the whole sport.",
    primaryZone: 2,
    segments: [
      bikeWU(10),
      seg({ kind: "main", discipline: "bike", zone: 2, durationSec: M(main), description: `${main} min @ ${zn(2)} — steady, cadence 85–95`, cue: "Conversational. If you can't talk, you're going too hard." }),
      bikeCD(5),
    ],
  });
}

export function bikeSweetSpot(ctx: BuildCtx, min = 75): Draft {
  const reps = min >= 80 ? 4 : 3;
  return finish(ctx, {
    discipline: "bike",
    type: "tempo",
    title: `Sweet Spot ${reps}×8`,
    purpose: "Sweet spot gives ~90% of the threshold benefit at a fraction of the fatigue — the most time-efficient way to raise your FTP.",
    primaryZone: 3,
    segments: [
      bikeWU(15),
      seg({
        kind: "main",
        discipline: "bike",
        zone: 3,
        repeat: reps,
        description: `${reps} × (8 min @ 88–94% FTP / 3 min easy)`,
        cue: "Settle in — don't launch it. Aim for a flat power line, not a fade.",
        children: [
          seg({ kind: "main", discipline: "bike", zone: 3, durationSec: M(8), description: "8 min sweet spot" }),
          seg({ kind: "main", discipline: "bike", zone: 1, durationSec: M(3), description: "3 min easy" }),
        ],
      }),
      bikeCD(10),
    ],
  });
}

export function bikeThreshold(ctx: BuildCtx, min = 70): Draft {
  const reps = min >= 75 ? 4 : 3;
  return finish(ctx, {
    discipline: "bike",
    type: "threshold",
    title: `Bike Threshold ${reps}×10`,
    purpose: "Threshold intervals lift the power you can hold for an hour — a faster bike split that leaves more in the legs for the run.",
    primaryZone: 4,
    segments: [
      bikeWU(15),
      seg({
        kind: "main",
        discipline: "bike",
        zone: 4,
        repeat: reps,
        description: `${reps} × (10 min @ 95–105% FTP / 5 min easy)`,
        cue: "Hold a steady, strong effort. The last rep should match the first.",
        children: [
          seg({ kind: "main", discipline: "bike", zone: 4, durationSec: M(10), description: "10 min @ threshold" }),
          seg({ kind: "main", discipline: "bike", zone: 1, durationSec: M(5), description: "5 min recovery" }),
        ],
      }),
      bikeCD(10),
    ],
  });
}

export function bikeVO2(ctx: BuildCtx, min = 60): Draft {
  return finish(ctx, {
    discipline: "bike",
    type: "vo2",
    title: "Bike VO2 5×3",
    purpose: "VO2 intervals raise your aerobic ceiling — hard now so everything below it feels easier on race day.",
    primaryZone: 5,
    segments: [
      bikeWU(15),
      seg({
        kind: "main",
        discipline: "bike",
        zone: 5,
        repeat: 5,
        description: "5 × (3 min @ 110–120% FTP / 3 min easy)",
        cue: "Full-gas but repeatable. Spin, don't grind — cadence 95+.",
        children: [
          seg({ kind: "main", discipline: "bike", zone: 5, durationSec: M(3), description: "3 min VO2" }),
          seg({ kind: "main", discipline: "bike", zone: 1, durationSec: M(3), description: "3 min easy" }),
        ],
      }),
      bikeCD(10),
    ],
  });
}

export function bikeLong(ctx: BuildCtx, min = 120, withRacePace = false): Draft {
  const main = Math.max(40, min - 20);
  const segs: Segment[] = [bikeWU(12)];
  if (withRacePace) {
    const rp = Math.min(30, Math.round(main * 0.25));
    segs.push(seg({ kind: "main", discipline: "bike", zone: 2, durationSec: M(main - rp), description: `${main - rp} min @ ${zn(2)} endurance` }));
    segs.push(seg({ kind: "main", discipline: "bike", zone: 3, durationSec: M(rp), description: `${rp} min @ race effort — finish strong`, cue: "Rehearse your target race pace and your fueling." }));
  } else {
    segs.push(seg({ kind: "main", discipline: "bike", zone: 2, durationSec: M(main), description: `${main} min @ ${zn(2)} — steady endurance`, cue: "Fuel every 30–40 min. This is where durability is made." }));
  }
  segs.push(bikeCD(8));
  return finish(ctx, {
    discipline: "bike",
    type: "long",
    title: withRacePace ? "Long Ride + Race Effort" : "Long Endurance Ride",
    purpose: "The weekly long ride is your durability builder — teaching body and mind to keep producing power deep into fatigue.",
    primaryZone: 2,
    segments: segs,
  });
}

export function bikeRecovery(ctx: BuildCtx, min = 40): Draft {
  return finish(ctx, {
    discipline: "bike",
    type: "recovery",
    title: "Recovery Spin",
    purpose: "Light, high-cadence spinning moves blood through tired legs and speeds recovery — keep it genuinely easy.",
    primaryZone: 1,
    segments: [seg({ kind: "main", discipline: "bike", zone: 1, durationSec: M(min), description: `${min} min @ <60% FTP, cadence 90+`, cue: "No efforts. If in doubt, go easier." })],
  });
}

// ===========================================================================
// RUN
// ===========================================================================

function runWU(min: number): Segment {
  return seg({ kind: "warmup", discipline: "run", zone: 2, durationSec: M(min), description: `${min} min easy jog`, cue: "Loose and relaxed — let the pace come to you." });
}
function runCD(min: number): Segment {
  return seg({ kind: "cooldown", discipline: "run", zone: 1, durationSec: M(min), description: `${min} min easy jog to finish` });
}
function strides(): Segment {
  return seg({
    kind: "warmup",
    discipline: "run",
    zone: 5,
    repeat: 4,
    description: "4 × 20s strides (walk-back recovery)",
    cue: "Quick, smooth turnover — neuromuscular, not a workout.",
    children: [
      seg({ kind: "warmup", discipline: "run", zone: 5, durationSec: 20, description: "20s stride" }),
      seg({ kind: "rest", discipline: "run", durationSec: 40, description: "walk back" }),
    ],
  });
}

export function runEasy(ctx: BuildCtx, min = 40): Draft {
  return finish(ctx, {
    discipline: "run",
    type: "endurance",
    title: "Easy Aerobic Run",
    purpose: "Easy running is where aerobic fitness is quietly built and injury risk stays low — resist the urge to push it.",
    primaryZone: 2,
    segments: [
      seg({ kind: "main", discipline: "run", zone: 2, durationSec: M(min), description: `${min} min @ ${zn(2)} easy`, cue: "Nose-breathing easy. You should finish feeling you could go again." }),
    ],
  });
}

export function runLong(ctx: BuildCtx, min = 75, withRacePace = false): Draft {
  const segs: Segment[] = [runWU(10)];
  if (withRacePace) {
    const rp = Math.min(25, Math.round(min * 0.25));
    segs.push(seg({ kind: "main", discipline: "run", zone: 2, durationSec: M(min - 10 - rp - 5), description: `${min - 10 - rp - 5} min @ ${zn(2)}` }));
    segs.push(seg({ kind: "main", discipline: "run", zone: 3, durationSec: M(rp), description: `${rp} min @ steady race effort to finish`, cue: "Controlled progression — strong, not straining." }));
  } else {
    segs.push(seg({ kind: "main", discipline: "run", zone: 2, durationSec: M(min - 15), description: `${min - 15} min @ ${zn(2)} steady`, cue: "Time on feet is the goal. Fuel and hydrate like race day." }));
  }
  segs.push(runCD(5));
  return finish(ctx, {
    discipline: "run",
    type: "long",
    title: withRacePace ? "Long Run + Finish Strong" : "Long Endurance Run",
    purpose: "The long run builds the fatigue-resistance that decides your race — especially the run off the bike.",
    primaryZone: 2,
    segments: segs,
  });
}

export function runTempo(ctx: BuildCtx, min = 50): Draft {
  const tempo = Math.min(25, Math.max(15, min - 25));
  return finish(ctx, {
    discipline: "run",
    type: "tempo",
    title: "Tempo Run",
    purpose: "Tempo running trains 'comfortably hard' — exactly the sustained effort long-course racing demands.",
    primaryZone: 3,
    segments: [
      runWU(15),
      seg({ kind: "main", discipline: "run", zone: 3, durationSec: M(tempo), description: `${tempo} min @ ${zn(3)} tempo`, cue: "Controlled discomfort — you could speak a sentence, not a paragraph." }),
      runCD(10),
    ],
  });
}

export function runThreshold(ctx: BuildCtx, min = 55): Draft {
  const reps = min >= 55 ? 5 : 4;
  return finish(ctx, {
    discipline: "run",
    type: "threshold",
    title: `Run Threshold ${reps}×1km`,
    purpose: "Threshold reps raise the pace you can hold before your legs flood — the ceiling on your run speed.",
    primaryZone: 4,
    segments: [
      runWU(15),
      strides(),
      seg({
        kind: "main",
        discipline: "run",
        zone: 4,
        repeat: reps,
        description: `${reps} × (1 km @ ${zn(4)} / 90s jog)`,
        cue: "Even splits. If you're fading, you started too fast.",
        children: [
          seg({ kind: "main", discipline: "run", zone: 4, distanceM: 1000, description: "1 km @ threshold" }),
          seg({ kind: "rest", discipline: "run", durationSec: 90, description: "90s jog" }),
        ],
      }),
      runCD(10),
    ],
  });
}

export function runVO2(ctx: BuildCtx, min = 50): Draft {
  return finish(ctx, {
    discipline: "run",
    type: "vo2",
    title: "Run VO2 6×3",
    purpose: "Fast intervals lift your VO2 max and running economy — the sharp end of speed.",
    primaryZone: 5,
    segments: [
      runWU(15),
      strides(),
      seg({
        kind: "main",
        discipline: "run",
        zone: 5,
        repeat: 6,
        description: "6 × (3 min @ ~5k pace / 2 min jog)",
        cue: "Strong and smooth. Hard effort, controlled form.",
        children: [
          seg({ kind: "main", discipline: "run", zone: 5, durationSec: M(3), description: "3 min hard" }),
          seg({ kind: "rest", discipline: "run", durationSec: M(2), description: "2 min jog" }),
        ],
      }),
      runCD(8),
    ],
  });
}

export function runRecovery(ctx: BuildCtx, min = 30): Draft {
  return finish(ctx, {
    discipline: "run",
    type: "recovery",
    title: "Recovery Jog",
    purpose: "A gentle jog keeps the legs turning over and blood flowing without adding real stress.",
    primaryZone: 1,
    segments: [seg({ kind: "main", discipline: "run", zone: 1, durationSec: M(min), description: `${min} min @ ${zn(1)} very easy`, cue: "Slower than feels natural. This is not a training run." })],
  });
}

// ===========================================================================
// BRICK
// ===========================================================================

export function brick(ctx: BuildCtx, bikeMin = 40, runMin = 15, racePace = false): Draft {
  return finish(ctx, {
    discipline: "brick",
    type: "brick",
    title: "Brick — Find Your Run Legs",
    purpose: "The first minutes off the bike feel awful for everyone. Practicing it is exactly why it won't rattle you on race day.",
    primaryZone: 3,
    segments: [
      seg({ kind: "warmup", discipline: "bike", zone: 2, durationSec: M(10), description: "10 min easy spin-up" }),
      seg({ kind: "main", discipline: "bike", zone: racePace ? 3 : 2, durationSec: M(bikeMin - 10), description: `${bikeMin - 10} min bike @ ${racePace ? "race effort" : zn(2)}`, cue: "Keep the bike honest but not heroic — save it for the run." }),
      seg({ kind: "main", discipline: "run", zone: 3, durationSec: M(2), description: "⚡ T2 — rack bike, swap shoes, go (under 3 min)", cue: "Practice a fast, calm transition like race day." }),
      seg({ kind: "main", discipline: "run", zone: 3, durationSec: M(runMin), description: `${runMin} min run, build easy → race pace`, cue: "Start deliberately short-strided. Heaviness lifts by minute 8 — note how long yours takes." }),
      seg({ kind: "cooldown", discipline: "run", zone: 1, durationSec: M(4), description: "4 min walk/jog down" }),
    ],
  });
}

// ===========================================================================
// STRENGTH
// ===========================================================================

export function strength(ctx: BuildCtx, min = 30): Draft {
  return finish(ctx, {
    discipline: "strength",
    type: "strength",
    title: "Triathlon Strength Circuit",
    purpose: "In-season strength keeps you durable and powerful — it protects against injury and holds form when fatigue sets in.",
    primaryZone: 2,
    segments: [
      seg({ kind: "warmup", discipline: "strength", zone: 2, durationSec: M(8), description: "8 min dynamic mobility — leg swings, hip openers, band walks" }),
      seg({
        kind: "main",
        discipline: "strength",
        zone: 3,
        repeat: 3,
        description: "3 rounds: goblet squat ×12 · RDL ×12 · step-up ×10/side · push-up ×12 · plank 45s · side plank 30s/side",
        cue: "Leave 1–2 reps in reserve. Control the movement, own each rep.",
        children: [
          seg({ kind: "main", discipline: "strength", zone: 3, durationSec: M(6), description: "circuit round" }),
          seg({ kind: "rest", discipline: "strength", durationSec: M(1.5), description: "90s rest" }),
        ],
      }),
      seg({ kind: "cooldown", discipline: "strength", zone: 1, durationSec: M(5), description: "5 min mobility — calves, hips, T-spine" }),
    ],
  });
}
