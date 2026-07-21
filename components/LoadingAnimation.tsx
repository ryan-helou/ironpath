"use client";

import { useEffect, useRef, useState } from "react";
import { Profile } from "@/lib/types";
import { Reactor } from "./Reactor";

const RACE_LABEL: Record<string, string> = {
  olympic: "Olympic-distance",
  half: "Ironman 70.3",
  full: "full Ironman",
  custom: "custom",
};

export function LoadingAnimation({
  profile,
  onDone,
}: {
  profile: Profile;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const done = useRef(false);

  const race = profile.raceType === "custom" ? profile.custom?.name || "custom" : RACE_LABEL[profile.raceType];
  const steps = [
    `Analyzing your ${race} goal…`,
    "Reading your PRs and setting training zones…",
    "Structuring Base → Build → Peak → Taper…",
    `Balancing your ${profile.daysPerWeek} days around long sessions…`,
    "Applying the 80/20 intensity rule…",
    "Placing your bricks and threshold work…",
    "Forging your plan…",
  ];

  useEffect(() => {
    let raf = 0;
    let p = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      // ease toward 100 with a little jitter; slow near the end
      const speed = p < 80 ? 0.028 : 0.012;
      p = Math.min(100, p + dt * speed * (0.7 + Math.random() * 0.6));
      setProgress(p);
      if (p >= 100) {
        if (!done.current) {
          done.current = true;
          setTimeout(onDone, 450);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  const stepIndex = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <Reactor size={200} progress={progress} />
      <div className="mt-8 font-display text-5xl font-bold tabular-nums tracking-tight">
        {Math.round(progress)}
        <span className="text-2xl text-muted">%</span>
      </div>
      <div className="mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-2">
        <div
          className="relative h-full rounded-full accent-gradient"
          style={{ width: `${progress}%`, transition: "width 0.1s linear" }}
        >
          <div className="shimmer absolute inset-0 rounded-full" />
        </div>
      </div>
      <div key={stepIndex} className="animate-rise mt-5 h-6 text-sm font-medium text-muted">
        {steps[stepIndex]}
      </div>
      <div className="mt-10 font-display text-lg font-semibold tracking-tight">
        Building your <span className="text-gradient">IronPath</span>
      </div>
    </div>
  );
}
