import { Level, PaceModel, Profile, Zone } from "./types";
import { ZONES } from "./zones";

// ---------------------------------------------------------------------------
// Derive per-athlete intensity targets from whatever inputs we have.
// Primary anchor comes from PRs when available, otherwise level defaults.
// See research: Riegel T2 = T1 * (D2/D1)^exp; CSS from a swim TT; %FTP; %HRmax.
// ---------------------------------------------------------------------------

/** Riegel endurance prediction: time to cover d2 given a d1/t1 result. */
export function riegel(d1: number, t1: number, d2: number, exp = 1.06): number {
  return t1 * Math.pow(d2 / d1, exp);
}

const RUN_THRESHOLD_DEFAULT: Record<Level, number> = {
  // sec per km
  beginner: 390, // 6:30/km
  intermediate: 315, // 5:15/km
  advanced: 260, // 4:20/km
  elite: 220, // 3:40/km
};

const SWIM_CSS_DEFAULT: Record<Level, number> = {
  // sec per 100m
  beginner: 135, // 2:15
  intermediate: 110, // 1:50
  advanced: 95, // 1:35
  elite: 80, // 1:20
};

export function derivePaces(p: Profile): PaceModel {
  // ---- RUN threshold pace ----
  let thresholdSecPerKm: number;
  let runSource: "pr" | "level";
  if (p.runPR && p.runPR.distanceM > 0 && p.runPR.timeSec > 0) {
    // predict a 10k, then threshold ≈ 10k pace + ~7 s/km
    const t10k = riegel(p.runPR.distanceM, p.runPR.timeSec, 10000, 1.06);
    thresholdSecPerKm = t10k / 10 + 7;
    runSource = "pr";
  } else {
    thresholdSecPerKm = RUN_THRESHOLD_DEFAULT[p.level];
    runSource = "level";
  }
  const runZones = {} as PaceModel["run"]["zones"];
  ([1, 2, 3, 4, 5] as Zone[]).forEach((z) => {
    const [ml, mh] = ZONES[z].paceMult;
    const a = thresholdSecPerKm * ml;
    const b = thresholdSecPerKm * mh;
    runZones[z] = { loSecPerKm: Math.min(a, b), hiSecPerKm: Math.max(a, b) };
  });

  // ---- SWIM CSS ----
  let cssSecPer100: number;
  let swimSource: "pr" | "level";
  if (p.swimPR && p.swimPR.distanceM > 0 && p.swimPR.timeSec > 0) {
    // flat swim fatigue curve → exp ~1.02; anchor CSS to a 1000m effort
    const t1000 = riegel(p.swimPR.distanceM, p.swimPR.timeSec, 1000, 1.02);
    cssSecPer100 = t1000 / 10;
    swimSource = "pr";
  } else {
    cssSecPer100 = SWIM_CSS_DEFAULT[p.level];
    swimSource = "level";
  }
  const swimZones = {} as PaceModel["swim"]["zones"];
  ([1, 2, 3, 4, 5] as Zone[]).forEach((z) => {
    const [ol, oh] = ZONES[z].cssOffset;
    const a = cssSecPer100 + ol;
    const b = cssSecPer100 + oh;
    swimZones[z] = { loSecPer100: Math.min(a, b), hiSecPer100: Math.max(a, b) };
  });

  // ---- BIKE %FTP (+ watts if FTP known) ----
  const ftp = p.ftp && p.ftp > 0 ? p.ftp : null;
  const bikeZones = {} as PaceModel["bike"]["zones"];
  ([1, 2, 3, 4, 5] as Zone[]).forEach((z) => {
    const [lo, hi] = ZONES[z].ftpPct;
    bikeZones[z] = {
      loPct: lo,
      hiPct: hi,
      loW: ftp ? Math.round((ftp * lo) / 100) : undefined,
      hiW: ftp ? Math.round((ftp * hi) / 100) : undefined,
    };
  });

  // ---- HR %HRmax (+ bpm if maxHR known) ----
  const maxHR = p.maxHR && p.maxHR > 0 ? p.maxHR : null;
  const hrZones = {} as PaceModel["hr"]["zones"];
  ([1, 2, 3, 4, 5] as Zone[]).forEach((z) => {
    const [lo, hi] = ZONES[z].hrPct;
    hrZones[z] = {
      loPct: lo,
      hiPct: hi,
      loBpm: maxHR ? Math.round((maxHR * lo) / 100) : undefined,
      hiBpm: maxHR ? Math.round((maxHR * hi) / 100) : undefined,
    };
  });

  return {
    run: { thresholdSecPerKm, zones: runZones, source: runSource },
    swim: { cssSecPer100, zones: swimZones, source: swimSource },
    bike: { ftp, zones: bikeZones, source: ftp ? "ftp" : "level" },
    hr: { maxHR, zones: hrZones },
  };
}

// Common PR presets offered in onboarding
export const RUN_PR_OPTIONS = [
  { label: "5K", distanceM: 5000 },
  { label: "10K", distanceM: 10000 },
  { label: "Half Marathon", distanceM: 21097 },
  { label: "Marathon", distanceM: 42195 },
];

export const SWIM_PR_OPTIONS = [
  { label: "100m", distanceM: 100 },
  { label: "200m", distanceM: 200 },
  { label: "400m", distanceM: 400 },
  { label: "1500m", distanceM: 1500 },
];
