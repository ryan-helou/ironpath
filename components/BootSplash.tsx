"use client";

import { Reactor } from "./Reactor";

export function BootSplash() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <Reactor size={120} />
      <div className="text-center">
        <div className="font-display text-2xl font-bold tracking-tight">
          IRON<span className="text-gradient">PATH</span>
        </div>
        <div className="mt-1 text-sm text-muted">Loading your training…</div>
      </div>
    </div>
  );
}
