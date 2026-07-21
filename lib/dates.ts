// Date helpers — all plan dates are ISO yyyy-mm-dd, weeks are Monday-based.

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Monday of the week containing `iso` (Mon=0 internally). */
export function mondayOf(iso: string): string {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

export function todayISO(): string {
  return toISO(new Date());
}

/** whole weeks between two Mondays (b - a). */
export function weeksBetween(aISO: string, bISO: string): number {
  const a = fromISO(mondayOf(aISO)).getTime();
  const b = fromISO(mondayOf(bISO)).getTime();
  return Math.round((b - a) / (7 * 86400000));
}

export function daysBetween(aISO: string, bISO: string): number {
  const a = fromISO(aISO).getTime();
  const b = fromISO(bISO).getTime();
  return Math.round((b - a) / 86400000);
}

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WD_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const MO = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** dayIndex 0=Mon..6=Sun */
export function weekdayShort(dayIndex: number): string {
  return WD[dayIndex];
}
export function weekdayLong(dayIndex: number): string {
  return WD_LONG[dayIndex];
}

export function fmtDayMonth(iso: string): string {
  const d = fromISO(iso);
  return `${MO[d.getMonth()]} ${d.getDate()}`;
}

export function fmtFullDate(iso: string): string {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7;
  return `${WD_LONG[dow]}, ${MO[d.getMonth()]} ${d.getDate()}`;
}

/** dayIndex 0=Mon of an ISO date */
export function dayIndexOf(iso: string): number {
  return (fromISO(iso).getDay() + 6) % 7;
}
