"use client";

import { useMemo, useState } from "react";
import { useApp } from "../AppProvider";
import { LoadingAnimation } from "../LoadingAnimation";
import { Discipline, Level, Profile, RaceType } from "@/lib/types";
import { generatePlan } from "@/lib/planEngine";
import { RUN_PR_OPTIONS, SWIM_PR_OPTIONS } from "@/lib/paces";
import { todayISO, addDays, fmtFullDate } from "@/lib/dates";

interface Draft {
  raceType?: RaceType;
  custom: { swimM: number; bikeM: number; runM: number; name: string };
  raceDateISO?: string;
  level?: Level;
  daysPerWeek: number;
  restDayPreference?: number;
  runPR?: { distanceM: number; timeSec: number; label: string };
  swimPR?: { distanceM: number; timeSec: number; label: string };
  ftp?: number;
  maxHR?: number;
  weeklyHoursCap?: number;
  focusDiscipline?: Discipline;
}

const STEPS = ["race", "custom", "date", "level", "days", "prs", "extras", "recap"] as const;

function parseTime(str: string): number | null {
  const s = str.trim();
  if (!s) return null;
  const parts = s.split(":").map((x) => Number(x));
  if (parts.some((x) => isNaN(x))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60; // bare minutes
  return null;
}

export function Onboarding() {
  const { username, startPlan } = useApp();
  const [idx, setIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    daysPerWeek: 6,
    custom: { swimM: 1500, bikeM: 40000, runM: 10000, name: "My Race" },
  });

  const step = STEPS[idx];
  const isCustom = draft.raceType === "custom";

  const finalProfile: Profile | null = useMemo(() => {
    if (!username || !draft.raceType || !draft.raceDateISO || !draft.level) return null;
    return {
      username,
      raceType: draft.raceType,
      custom: draft.raceType === "custom" ? draft.custom : undefined,
      raceDateISO: draft.raceDateISO,
      level: draft.level,
      daysPerWeek: draft.daysPerWeek,
      restDayPreference: draft.restDayPreference,
      runPR: draft.runPR,
      swimPR: draft.swimPR,
      ftp: draft.ftp,
      maxHR: draft.maxHR,
      weeklyHoursCap: draft.weeklyHoursCap,
      focusDiscipline: draft.focusDiscipline,
      createdAtISO: new Date().toISOString(),
    };
  }, [username, draft]);

  function skip(dir: 1 | -1, from: number): number {
    let n = from + dir;
    while (STEPS[n] === "custom" && !isCustom) n += dir;
    return Math.max(0, Math.min(STEPS.length - 1, n));
  }
  const next = () => setIdx((i) => skip(1, i));
  const back = () => setIdx((i) => skip(-1, i));

  const canNext = (() => {
    switch (step) {
      case "race":
        return !!draft.raceType;
      case "custom":
        return draft.custom.swimM > 0 && draft.custom.bikeM > 0 && draft.custom.runM > 0;
      case "date":
        return !!draft.raceDateISO && draft.raceDateISO > todayISO();
      case "level":
        return !!draft.level;
      case "days":
        return draft.daysPerWeek >= 3;
      default:
        return true;
    }
  })();

  const visibleCount = STEPS.length - (isCustom ? 0 : 1);
  const visibleIdx = idx - (idx > 1 && !isCustom ? 1 : 0);

  if (generating && finalProfile) {
    return (
      <LoadingAnimation
        profile={finalProfile}
        onDone={() => {
          const plan = generatePlan(finalProfile);
          startPlan(finalProfile, plan);
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col safe-t">
      {/* progress bar */}
      <div className="px-6 pt-6">
        <div className="mx-auto flex max-w-md gap-1.5">
          {Array.from({ length: visibleCount }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition ${i <= visibleIdx ? "accent-gradient" : "bg-surface-2"}`}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-6">
        <div key={step} className="animate-fade-up flex flex-1 flex-col">
          {step === "race" && <RaceStep draft={draft} set={setDraft} />}
          {step === "custom" && <CustomStep draft={draft} set={setDraft} />}
          {step === "date" && <DateStep draft={draft} set={setDraft} />}
          {step === "level" && <LevelStep draft={draft} set={setDraft} />}
          {step === "days" && <DaysStep draft={draft} set={setDraft} />}
          {step === "prs" && <PRStep draft={draft} set={setDraft} parseTime={parseTime} />}
          {step === "extras" && <ExtrasStep draft={draft} set={setDraft} />}
          {step === "recap" && <RecapStep draft={draft} />}
        </div>

        <div className="mt-6 flex items-center gap-3">
          {idx > 0 && (
            <button onClick={back} className="btn btn-ghost px-5 py-3">
              Back
            </button>
          )}
          {step === "recap" ? (
            <button onClick={() => setGenerating(true)} disabled={!finalProfile} className="btn btn-primary flex-1 py-3.5 text-base">
              Build my plan
            </button>
          ) : (
            <button onClick={next} disabled={!canNext} className="btn btn-primary flex-1 py-3.5 text-base">
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- step components ----------------

function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">{title}</h2>
      {sub && <p className="mt-1.5 text-sm text-muted">{sub}</p>}
    </div>
  );
}

function Card({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        active ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-line bg-surface-2 hover:bg-surface-3"
      }`}
    >
      {children}
    </button>
  );
}

type StepProps = { draft: Draft; set: React.Dispatch<React.SetStateAction<Draft>> };

function RaceStep({ draft, set }: StepProps) {
  const races: { key: RaceType; name: string; d: string }[] = [
    { key: "olympic", name: "Olympic", d: "1.5 km swim · 40 km bike · 10 km run" },
    { key: "half", name: "Ironman 70.3", d: "1.9 km swim · 90 km bike · 21.1 km run" },
    { key: "full", name: "Full Ironman", d: "3.8 km swim · 180 km bike · 42.2 km run" },
    { key: "custom", name: "Custom distance", d: "Set your own swim / bike / run" },
  ];
  return (
    <div>
      <Head title="What are you training for?" sub="Pick your race — this shapes the whole plan." />
      <div className="flex flex-col gap-2.5">
        {races.map((r) => (
          <Card key={r.key} active={draft.raceType === r.key} onClick={() => set((d) => ({ ...d, raceType: r.key }))}>
            <div className="font-display text-lg font-semibold">{r.name}</div>
            <div className="text-sm text-muted">{r.d}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NumField({ label, value, unit, onChange }: { label: string; value: number; unit: string; onChange: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          className="input"
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="text-sm text-muted">{unit}</span>
      </div>
    </label>
  );
}

function CustomStep({ draft, set }: StepProps) {
  const c = draft.custom;
  const upd = (patch: Partial<Draft["custom"]>) => set((d) => ({ ...d, custom: { ...d.custom, ...patch } }));
  return (
    <div>
      <Head title="Your custom race" sub="Enter the distances — we'll structure the training around them." />
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Race name</span>
          <input className="input" value={c.name} onChange={(e) => upd({ name: e.target.value })} />
        </label>
        <NumField label="Swim" unit="m" value={c.swimM} onChange={(n) => upd({ swimM: n })} />
        <NumField label="Bike" unit="m" value={c.bikeM} onChange={(n) => upd({ bikeM: n })} />
        <NumField label="Run" unit="m" value={c.runM} onChange={(n) => upd({ runM: n })} />
      </div>
    </div>
  );
}

function DateStep({ draft, set }: StepProps) {
  const min = addDays(todayISO(), 14);
  return (
    <div>
      <Head title="When's race day?" sub="Your plan counts back from here — with the right taper built in." />
      <input
        className="input text-lg"
        type="date"
        min={addDays(todayISO(), 1)}
        value={draft.raceDateISO ?? ""}
        onChange={(e) => set((d) => ({ ...d, raceDateISO: e.target.value }))}
      />
      {draft.raceDateISO && (
        <p className="mt-3 text-sm text-muted">
          Racing on <span className="font-semibold text-foreground">{fmtFullDate(draft.raceDateISO)}</span>.
        </p>
      )}
      {draft.raceDateISO && draft.raceDateISO < min && (
        <p className="mt-2 text-sm text-warning">That's a tight timeline — we'll compress the plan and keep you safe.</p>
      )}
    </div>
  );
}

function LevelStep({ draft, set }: StepProps) {
  const levels: { key: Level; name: string; d: string }[] = [
    { key: "beginner", name: "Beginner", d: "New to triathlon or building your first base." },
    { key: "intermediate", name: "Intermediate", d: "A season or two in; comfortable in all three sports." },
    { key: "advanced", name: "Advanced", d: "Consistent training, targeting a strong result." },
    { key: "elite", name: "Elite", d: "High training load, chasing the podium." },
  ];
  return (
    <div>
      <Head title="How experienced are you?" sub="This sets your volume, intensity, and how fast we ramp." />
      <div className="flex flex-col gap-2.5">
        {levels.map((l) => (
          <Card key={l.key} active={draft.level === l.key} onClick={() => set((d) => ({ ...d, level: l.key }))}>
            <div className="font-display text-lg font-semibold">{l.name}</div>
            <div className="text-sm text-muted">{l.d}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DaysStep({ draft, set }: StepProps) {
  const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div>
      <Head title="How many days a week can you train?" sub="We'll fit the sessions to your life." />
      <div className="grid grid-cols-5 gap-2">
        {[3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            onClick={() => set((d) => ({ ...d, daysPerWeek: n }))}
            className={`rounded-2xl border py-4 font-display text-xl font-bold transition ${
              draft.daysPerWeek === n ? "border-accent bg-accent/10 text-foreground ring-1 ring-accent" : "border-line bg-surface-2 text-muted"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Preferred rest day (optional)</div>
        <div className="flex flex-wrap gap-2">
          {WD.map((w, i) => (
            <button
              key={w}
              onClick={() => set((d) => ({ ...d, restDayPreference: d.restDayPreference === i ? undefined : i }))}
              className={`chip ${draft.restDayPreference === i ? "border-accent bg-accent/10" : ""}`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PRStep({ draft, set, parseTime }: StepProps & { parseTime: (s: string) => number | null }) {
  const [runDist, setRunDist] = useState(draft.runPR?.distanceM ?? 0);
  const [runTime, setRunTime] = useState("");
  const [swimDist, setSwimDist] = useState(draft.swimPR?.distanceM ?? 0);
  const [swimTime, setSwimTime] = useState("");

  function commitRun(dist: number, timeStr: string) {
    const sec = parseTime(timeStr);
    const opt = RUN_PR_OPTIONS.find((o) => o.distanceM === dist);
    set((d) => ({ ...d, runPR: dist && sec ? { distanceM: dist, timeSec: sec, label: opt?.label ?? "" } : undefined }));
  }
  function commitSwim(dist: number, timeStr: string) {
    const sec = parseTime(timeStr);
    const opt = SWIM_PR_OPTIONS.find((o) => o.distanceM === dist);
    set((d) => ({ ...d, swimPR: dist && sec ? { distanceM: dist, timeSec: sec, label: opt?.label ?? "" } : undefined }));
  }

  return (
    <div>
      <Head title="Your personal bests" sub="Optional, but the more you share, the sharper your pace targets. Skip any you don't know." />

      <div className="mb-5 rounded-2xl border border-line bg-surface-2 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">🏃 Run PR</div>
        <div className="flex flex-wrap gap-2">
          {RUN_PR_OPTIONS.map((o) => (
            <button
              key={o.label}
              onClick={() => { setRunDist(o.distanceM); commitRun(o.distanceM, runTime); }}
              className={`chip ${runDist === o.distanceM ? "border-accent bg-accent/10" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <input
          className="input mt-3"
          placeholder="Time, e.g. 1:45:00 or 22:30"
          value={runTime}
          onChange={(e) => { setRunTime(e.target.value); commitRun(runDist, e.target.value); }}
        />
      </div>

      <div className="mb-5 rounded-2xl border border-line bg-surface-2 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">🏊 Swim PR</div>
        <div className="flex flex-wrap gap-2">
          {SWIM_PR_OPTIONS.map((o) => (
            <button
              key={o.label}
              onClick={() => { setSwimDist(o.distanceM); commitSwim(o.distanceM, swimTime); }}
              className={`chip ${swimDist === o.distanceM ? "border-accent bg-accent/10" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <input
          className="input mt-3"
          placeholder="Time, e.g. 6:30 or 1:20"
          value={swimTime}
          onChange={(e) => { setSwimTime(e.target.value); commitSwim(swimDist, e.target.value); }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumFieldOpt label="🚴 Bike FTP" unit="W" value={draft.ftp} onChange={(n) => set((d) => ({ ...d, ftp: n }))} />
        <NumFieldOpt label="❤️ Max HR" unit="bpm" value={draft.maxHR} onChange={(n) => set((d) => ({ ...d, maxHR: n }))} />
      </div>
    </div>
  );
}

function NumFieldOpt({ label, value, unit, onChange }: { label: string; value?: number; unit: string; onChange: (n: number | undefined) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          className="input"
          type="number"
          inputMode="numeric"
          value={value ?? ""}
          placeholder="—"
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        />
        <span className="text-xs text-muted">{unit}</span>
      </div>
    </label>
  );
}

function ExtrasStep({ draft, set }: StepProps) {
  const foci: { key: Discipline; label: string; icon: string }[] = [
    { key: "swim", label: "Swim", icon: "🏊" },
    { key: "bike", label: "Bike", icon: "🚴" },
    { key: "run", label: "Run", icon: "🏃" },
  ];
  return (
    <div>
      <Head title="A few final touches" sub="All optional — tune the plan to you." />
      <div className="mb-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Which sport is your limiter?</div>
        <div className="flex gap-2">
          {foci.map((f) => (
            <button
              key={f.key}
              onClick={() => set((d) => ({ ...d, focusDiscipline: d.focusDiscipline === f.key ? undefined : f.key }))}
              className={`flex-1 rounded-2xl border py-3 text-center transition ${
                draft.focusDiscipline === f.key ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-line bg-surface-2"
              }`}
            >
              <div className="text-2xl">{f.icon}</div>
              <div className="mt-1 text-sm font-semibold">{f.label}</div>
            </button>
          ))}
        </div>
      </div>
      <NumFieldOpt
        label="Cap my weekly hours at (optional)"
        unit="hrs"
        value={draft.weeklyHoursCap}
        onChange={(n) => set((d) => ({ ...d, weeklyHoursCap: n }))}
      />
    </div>
  );
}

function RecapStep({ draft }: { draft: Draft }) {
  const race =
    draft.raceType === "custom"
      ? draft.custom.name
      : draft.raceType === "olympic"
      ? "Olympic"
      : draft.raceType === "half"
      ? "Ironman 70.3"
      : "Full Ironman";
  const rows: [string, string][] = [
    ["Race", race],
    ["Date", draft.raceDateISO ? fmtFullDate(draft.raceDateISO) : "—"],
    ["Level", draft.level ?? "—"],
    ["Days / week", String(draft.daysPerWeek)],
  ];
  if (draft.runPR) rows.push(["Run PR", `${draft.runPR.label}`]);
  if (draft.swimPR) rows.push(["Swim PR", `${draft.swimPR.label}`]);
  if (draft.ftp) rows.push(["FTP", `${draft.ftp} W`]);
  if (draft.focusDiscipline) rows.push(["Focus", draft.focusDiscipline]);

  return (
    <div>
      <Head title="Here's your plan setup" sub="We'll forge a full day-by-day plan from this." />
      <div className="rounded-2xl border border-line bg-surface-2 p-1">
        {rows.map(([k, v], i) => (
          <div key={k} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
            <span className="text-sm text-muted">{k}</span>
            <span className="font-semibold capitalize">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
