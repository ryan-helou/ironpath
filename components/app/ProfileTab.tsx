"use client";

import { useState } from "react";
import { useApp } from "../AppProvider";
import { useUI } from "./ui";
import { fmtPace, fmtPace100 } from "@/lib/format";
import { fmtFullDate } from "@/lib/dates";
import { raceDistances } from "@/lib/planEngine";
import { InstallHint } from "./InstallHint";

export function ProfileTab() {
  const { plan, username, profile, logout, resetPlan } = useApp();
  const { actions, today } = useUI();
  const [confirmReset, setConfirmReset] = useState(false);
  if (!plan || !profile) return null;

  const dist = raceDistances(profile);
  const paces = plan.paces;

  const rows: [string, string][] = [
    ["Race", dist.name],
    ["Date", fmtFullDate(profile.raceDateISO)],
    ["Level", profile.level],
    ["Days / week", String(profile.daysPerWeek)],
  ];

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl accent-gradient font-display text-2xl font-bold text-[#1a0d06]">
          {username?.[0]?.toUpperCase()}
        </div>
        <div>
          <div className="font-display text-2xl font-bold capitalize">{username}</div>
          <div className="text-sm text-muted">IronPath athlete</div>
        </div>
      </div>

      <Section title="Your race">
        {rows.map(([k, v], i) => (
          <Row key={k} k={k} v={v} first={i === 0} />
        ))}
      </Section>

      <Section title="Your training paces">
        <Row k="Run threshold" v={fmtPace(paces.run.thresholdSecPerKm)} first raw />
        <Row k="Swim CSS" v={fmtPace100(paces.swim.cssSecPer100)} raw />
        <Row k="Bike FTP" v={paces.bike.ftp ? `${paces.bike.ftp} W` : "Zone / RPE based"} raw />
        {paces.hr.maxHR ? <Row k="Max HR" v={`${paces.hr.maxHR} bpm`} /> : null}
        <div className="px-4 pb-3 pt-1 text-xs text-muted">
          {paces.run.source === "pr" ? "Dialed in from your PRs." : "Estimated from your level — add PRs to sharpen them."}
        </div>
      </Section>

      <Section title="Adjust your plan">
        <button onClick={() => actions.ease(7)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-2">
          <span>Not feeling 100% — ease this week</span><span className="text-muted">›</span>
        </button>
        <button onClick={() => actions.rebuild()} className="flex w-full items-center justify-between border-t border-line px-4 py-3 text-left hover:bg-surface-2">
          <span>Rebuild plan around today</span><span className="text-muted">›</span>
        </button>
      </Section>

      <InstallHint />

      <div className="space-y-2">
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="btn btn-ghost w-full py-3">Start a new plan</button>
        ) : (
          <div className="rounded-2xl border border-danger/40 bg-danger/5 p-3">
            <div className="mb-2 text-sm">This clears your current plan and starts over. Sure?</div>
            <div className="flex gap-2">
              <button onClick={resetPlan} className="btn flex-1 py-2.5" style={{ background: "var(--danger)", color: "#fff" }}>Yes, restart</button>
              <button onClick={() => setConfirmReset(false)} className="btn btn-ghost flex-1 py-2.5">Cancel</button>
            </div>
          </div>
        )}
        <button onClick={logout} className="btn btn-ghost w-full py-3">Log out</button>
      </div>

      <div className="pb-4 text-center text-xs text-muted">IronPath · your path to the finish line</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{title}</div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
    </div>
  );
}
function Row({ k, v, first, raw }: { k: string; v: string; first?: boolean; raw?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${first ? "" : "border-t border-line"}`}>
      <span className="text-sm text-muted">{k}</span>
      <span className={`font-semibold ${raw ? "" : "capitalize"}`}>{v}</span>
    </div>
  );
}
