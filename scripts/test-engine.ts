import { generatePlan } from "../lib/planEngine";
import { Profile } from "../lib/types";
import { fmtDuration } from "../lib/format";

function mk(over: Partial<Profile>): Profile {
  const race = new Date();
  race.setDate(race.getDate() + 7 * (over as any).__weeks || 7 * 20);
  return {
    username: "test",
    raceType: "half",
    raceDateISO: race.toISOString().slice(0, 10),
    level: "intermediate",
    daysPerWeek: 6,
    createdAtISO: new Date().toISOString(),
    ...over,
  };
}

function raceInWeeks(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n * 7 + 3);
  return d.toISOString().slice(0, 10);
}

const scenarios: { name: string; p: Profile }[] = [
  { name: "70.3 intermediate 6d 20wk", p: mk({ raceType: "half", raceDateISO: raceInWeeks(20), daysPerWeek: 6, runPR: { distanceM: 21097, timeSec: 5700, label: "HM" }, swimPR: { distanceM: 400, timeSec: 400, label: "400" }, ftp: 230 }) },
  { name: "Ironman beginner 5d 28wk", p: mk({ raceType: "full", level: "beginner", raceDateISO: raceInWeeks(28), daysPerWeek: 5 }) },
  { name: "Olympic advanced 7d 12wk", p: mk({ raceType: "olympic", level: "advanced", raceDateISO: raceInWeeks(12), daysPerWeek: 7 }) },
  { name: "Olympic beginner 3d 10wk", p: mk({ raceType: "olympic", level: "beginner", raceDateISO: raceInWeeks(10), daysPerWeek: 3 }) },
  { name: "70.3 compressed 6wk", p: mk({ raceType: "half", raceDateISO: raceInWeeks(6), daysPerWeek: 6 }) },
  { name: "Ironman delayed 40wk", p: mk({ raceType: "full", raceDateISO: raceInWeeks(40), daysPerWeek: 6 }) },
  { name: "Custom 4d", p: mk({ raceType: "custom", custom: { swimM: 1000, bikeM: 60000, runM: 15000, name: "Local Tri" }, raceDateISO: raceInWeeks(16), daysPerWeek: 4 }) },
];

let problems = 0;
for (const { name, p } of scenarios) {
  const plan = generatePlan(p);
  console.log(`\n=== ${name} ===`);
  console.log(`weeks=${plan.totalWeeks} start=${plan.startDateISO} race=${plan.raceDateISO} compressed=${plan.compressed} delayed=${plan.delayedStart}`);
  const phaseCounts: Record<string, number> = {};
  let totalWk = 0;
  for (const wk of plan.weeks) {
    phaseCounts[wk.phase] = (phaseCounts[wk.phase] ?? 0) + 1;
    totalWk += wk.workoutIds.length;
    // per-week checks
    let wkHours = 0;
    const days = new Set<number>();
    for (const id of wk.workoutIds) {
      const w = plan.workouts[id];
      if (!w) { console.log(`  !! missing workout ${id}`); problems++; continue; }
      if (w.estDurationSec != null && (isNaN(w.estDurationSec) || w.estDurationSec < 0)) { console.log(`  !! bad duration ${id} = ${w.estDurationSec}`); problems++; }
      if (w.estDistanceM != null && isNaN(w.estDistanceM)) { console.log(`  !! bad distance ${id}`); problems++; }
      if (!w.segments || w.segments.length === 0) { console.log(`  !! no segments ${id}`); problems++; }
      wkHours += (w.estDurationSec || 0) / 3600;
      days.add(w.dayIndex);
    }
  }
  console.log(`  phases: ${JSON.stringify(phaseCounts)}  totalWorkouts=${totalWk}`);
  // print week 0, a build week, race week detail
  const sample = [plan.weeks[0], plan.weeks[Math.floor(plan.totalWeeks * 0.6)], plan.weeks[plan.totalWeeks - 1]];
  for (const wk of sample) {
    if (!wk) continue;
    const actual = wk.workoutIds.reduce((a, id) => a + (plan.workouts[id].estDurationSec || 0), 0) / 3600;
    console.log(`  [${wk.label}] target=${wk.targetHours}h actual=${actual.toFixed(1)}h  sessions=${wk.workoutIds.length}`);
    for (const id of wk.workoutIds) {
      const w = plan.workouts[id];
      console.log(`     d${w.dayIndex} ${w.discipline.padEnd(8)} ${w.title.padEnd(28)} ${fmtDuration(w.estDurationSec)}${w.estDistanceM ? " · " + (w.estDistanceM / 1000).toFixed(1) + "km" : ""} Z${w.primaryZone}`);
    }
  }
}
console.log(`\n\n${problems === 0 ? "✅ NO PROBLEMS" : "❌ " + problems + " PROBLEMS"}`);
