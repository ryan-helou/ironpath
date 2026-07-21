// Small pure formatters shared across the UI.

export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** seconds → "1h 20m", "45 min", "8 min" */
export function fmtDuration(totalSec: number): string {
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m} min`;
}

/** seconds → "1:20:05" or "45:00" (clock) */
export function fmtClock(totalSec: number): string {
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

/** meters → "5.0 km" / "400 m" */
export function fmtDistance(m: number): string {
  if (m >= 1000) {
    const km = m / 1000;
    return `${km % 1 === 0 ? km.toFixed(0) : km.toFixed(1)} km`;
  }
  return `${Math.round(m)} m`;
}

/** sec/km → "4:37/km" */
export function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${pad(s)}/km`;
}

/** sec/100m → "1:31/100m" */
export function fmtPace100(secPer100: number): string {
  const m = Math.floor(secPer100 / 60);
  const s = Math.round(secPer100 % 60);
  return `${m}:${pad(s)}/100m`;
}

/** a range like "4:30–4:45/km" from two sec/km values */
export function fmtPaceRange(lo: number, hi: number): string {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  const fa = fmtPace(a).replace("/km", "");
  const fb = fmtPace(b);
  return `${fa}–${fb}`;
}

export function fmtPace100Range(lo: number, hi: number): string {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  const fa = fmtPace100(a).replace("/100m", "");
  const fb = fmtPace100(b);
  return `${fa}–${fb}`;
}
