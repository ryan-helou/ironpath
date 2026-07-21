// ---------------------------------------------------------------------------
// IronPath domain model
// ---------------------------------------------------------------------------

export type RaceType = "olympic" | "half" | "full" | "custom";

export type Level = "beginner" | "intermediate" | "advanced" | "elite";

export type Discipline = "swim" | "bike" | "run" | "brick" | "strength" | "rest";

// A workout's role in the training week.
export type SessionType =
  | "recovery" // very easy, flush the legs
  | "endurance" // steady aerobic (Z2) — the bulk of training
  | "technique" // drills / skills (swim & run form)
  | "tempo" // sustained moderately-hard (Z3)
  | "threshold" // lactate threshold intervals (Z4)
  | "vo2" // short, sharp intervals (Z5)
  | "long" // the weekly long ride / run
  | "brick" // bike-to-run transition
  | "race_prep" // race-pace / race-simulation work
  | "strength" // gym / mobility
  | "rest"; // full day off

export type Zone = 1 | 2 | 3 | 4 | 5;

// One building block inside a workout.
export interface Segment {
  kind: "warmup" | "main" | "cooldown" | "rest";
  /** how many times this segment (and any it wraps) repeats */
  repeat?: number;
  /** children — used to express "4 x (8min hard / 2min easy)" */
  children?: Segment[];
  discipline?: Discipline;
  zone?: Zone;
  durationSec?: number; // time-based target
  distanceM?: number; // distance-based target (meters)
  description: string; // human label, e.g. "8 min @ threshold"
  /** free-form cue, e.g. "smooth cadence, drive the arms" */
  cue?: string;
}

export interface Workout {
  id: string;
  /** ISO date (yyyy-mm-dd) this workout is scheduled for */
  date: string;
  weekIndex: number; // 0-based
  dayIndex: number; // 0 = Monday
  discipline: Discipline;
  type: SessionType;
  title: string;
  purpose: string; // the "why" — one motivating sentence
  segments: Segment[];
  estDurationSec: number;
  estDistanceM?: number;
  /** dominant intensity zone, for the calendar dot */
  primaryZone: Zone;
  /** completion tracking */
  status: "planned" | "done" | "skipped" | "swapped" | "moved";
  /** if the athlete logged something different */
  note?: string;
  /** set when the plan reshuffles a workout */
  movedFrom?: string;
}

export type Phase = "base" | "build" | "peak" | "taper";

export interface Week {
  index: number; // 0-based
  phase: Phase;
  startDate: string; // ISO Monday
  label: string; // "Base 1", "Build 3", "Race Week"…
  isRecovery: boolean;
  isRaceWeek: boolean;
  targetHours: number; // planned training hours this week
  focus: string; // one-liner describing the week's emphasis
  workoutIds: string[];
}

// ---- athlete inputs ----

export interface RunPR {
  distanceM: number; // e.g. 21097 for a half marathon
  timeSec: number;
  label: string; // "Half Marathon"
}
export interface SwimPR {
  distanceM: number; // e.g. 400
  timeSec: number;
  label: string;
}

export interface Profile {
  username: string;
  raceType: RaceType;
  // for custom races (all in meters):
  custom?: { swimM: number; bikeM: number; runM: number; name?: string };
  raceDateISO: string; // yyyy-mm-dd
  level: Level;
  // available training days per week (3–7)
  daysPerWeek: number;
  // optional performance references (drive the paces)
  runPR?: RunPR;
  swimPR?: SwimPR;
  ftp?: number; // cycling functional threshold power, watts
  maxHR?: number; // bpm
  // extras
  weeklyHoursCap?: number; // athlete-imposed ceiling on weekly hours
  restDayPreference?: number; // 0=Mon … 6=Sun, a day they'd like off
  focusDiscipline?: Discipline; // a limiter they want to bias toward
  createdAtISO: string;
}

// derived, per-athlete intensity targets
export interface PaceModel {
  run: {
    thresholdSecPerKm: number;
    zones: Record<Zone, { loSecPerKm: number; hiSecPerKm: number }>;
    source: "pr" | "level";
  };
  swim: {
    cssSecPer100: number;
    zones: Record<Zone, { loSecPer100: number; hiSecPer100: number }>;
    source: "pr" | "level";
  };
  bike: {
    ftp: number | null;
    zones: Record<Zone, { loPct: number; hiPct: number; loW?: number; hiW?: number }>;
    source: "ftp" | "level";
  };
  hr: {
    maxHR: number | null;
    zones: Record<Zone, { loPct: number; hiPct: number; loBpm?: number; hiBpm?: number }>;
  };
}

export interface Plan {
  id: string;
  profile: Profile;
  startDateISO: string; // Monday the plan begins
  raceDateISO: string;
  totalWeeks: number;
  weeks: Week[];
  workouts: Record<string, Workout>;
  paces: PaceModel;
  generatedAtISO: string;
  /** true when the race is sooner than the ideal minimum plan length */
  compressed: boolean;
  /** true when race is further out than the max plan; training starts later */
  delayedStart: boolean;
  notice?: string;
}

// what we persist per user
export interface UserRecord {
  username: string;
  passwordHash: string;
  createdAtISO: string;
}
