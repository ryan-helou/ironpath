"use client";

import { useMemo, useState } from "react";
import { useApp } from "../AppProvider";
import { UICtx, UIActions, TabKey } from "./ui";
import { BottomNav } from "./BottomNav";
import { TodayTab } from "./TodayTab";
import { PlanTab } from "./PlanTab";
import { ProgressTab } from "./ProgressTab";
import { ProfileTab } from "./ProfileTab";
import { WorkoutDetail } from "./WorkoutDetail";
import { CoachSheet } from "./CoachSheet";
import { todayISO } from "@/lib/dates";
import {
  easeUpcoming,
  logInstead,
  moveWorkout,
  rebuildFromToday,
  setStatus,
  swapDiscipline,
} from "@/lib/adapt";

export function AppShell() {
  const { plan, applyPlan } = useApp();
  const [tab, setTab] = useState<TabKey>("today");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [coach, setCoach] = useState<{ open: boolean; prefill?: string }>({ open: false });
  const [dismissRealign, setDismissRealign] = useState(false);
  const today = useMemo(() => todayISO(), []);

  if (!plan) return null;

  const actions: UIActions = {
    toggleDone: (id) => applyPlan(setStatus(plan, id, plan.workouts[id]?.status === "done" ? "planned" : "done")),
    skip: (id) => applyPlan(setStatus(plan, id, "skipped")),
    unskip: (id) => applyPlan(setStatus(plan, id, "planned")),
    move: (id, date) => applyPlan(moveWorkout(plan, id, date)),
    swap: (id, d) => applyPlan(swapDiscipline(plan, id, d)),
    logInstead: (id, note) => applyPlan(logInstead(plan, id, note)),
    rebuild: () => applyPlan(rebuildFromToday(plan, today)),
    ease: (days) => applyPlan(easeUpcoming(plan, today, days)),
  };

  const missed = Object.values(plan.workouts).filter(
    (w) => w.discipline !== "rest" && w.date < today && w.status === "planned",
  );

  const detail = detailId ? plan.workouts[detailId] : null;

  return (
    <UICtx.Provider
      value={{
        today,
        openWorkout: setDetailId,
        openCoach: (prefill) => setCoach({ open: true, prefill }),
        goTab: setTab,
        actions,
      }}
    >
      <div className="flex min-h-full flex-1 flex-col">
        <div className="mx-auto w-full max-w-md flex-1">
          {missed.length >= 3 && !dismissRealign && (
            <div className="mx-4 mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-3.5 safe-t">
              <div className="text-sm font-semibold">You&apos;ve missed {missed.length} sessions</div>
              <div className="mt-0.5 text-sm text-muted">Fallen behind? Rebuild your plan around today so you still land on race day.</div>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => { actions.rebuild(); setDismissRealign(true); }}
                  className="btn btn-primary flex-1 py-2.5 text-sm"
                >
                  Rebuild my plan
                </button>
                <button onClick={() => setDismissRealign(true)} className="btn btn-ghost px-4 py-2.5 text-sm">
                  I&apos;m okay
                </button>
              </div>
            </div>
          )}

          {tab === "today" && <TodayTab />}
          {tab === "plan" && <PlanTab />}
          {tab === "progress" && <ProgressTab />}
          {tab === "profile" && <ProfileTab />}
        </div>

        <BottomNav tab={tab} onChange={setTab} />
      </div>

      {detail && <WorkoutDetail workout={detail} plan={plan} />}
      {coach.open && <CoachSheet plan={plan} today={today} prefill={coach.prefill} onClose={() => setCoach({ open: false })} />}
    </UICtx.Provider>
  );
}
