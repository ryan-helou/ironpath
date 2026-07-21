"use client";

import { Discipline, Segment, Zone } from "@/lib/types";
import { zoneColor } from "@/lib/zones";

// A horizontal, zone-colored proportional timeline of a workout — the single
// most useful "read a session at a glance" component (per TrainingPeaks/Zwift).

const NOMINAL_MPS: Record<string, number> = { run: 3.1, swim: 1.15, bike: 8.5, brick: 6, strength: 1, rest: 1 };
const ZFACT: Record<Zone, number> = { 1: 0.82, 2: 1, 3: 1.08, 4: 1.14, 5: 1.22 };

interface Block {
  zone: Zone;
  sec: number;
  kind: Segment["kind"];
}

function flatten(segments: Segment[], out: Block[] = []): Block[] {
  for (const s of segments) {
    const reps = s.repeat ?? 1;
    if (s.children && s.children.length) {
      for (let r = 0; r < reps; r++) flatten(s.children, out);
      continue;
    }
    const disc = (s.discipline ?? "run") as Discipline;
    const zone = (s.zone ?? 2) as Zone;
    let sec = 0;
    if (s.durationSec != null) sec = s.durationSec;
    else if (s.distanceM != null) sec = s.distanceM / ((NOMINAL_MPS[disc] ?? 3) * ZFACT[zone]);
    for (let r = 0; r < reps; r++) out.push({ zone, sec, kind: s.kind });
  }
  return out;
}

export function IntervalBar({ segments, height = 34 }: { segments: Segment[]; height?: number }) {
  const blocks = flatten(segments).filter((b) => b.sec > 0);
  const total = blocks.reduce((a, b) => a + b.sec, 0) || 1;
  return (
    <div
      className="flex w-full overflow-hidden rounded-lg"
      style={{ height, gap: 1, background: "var(--surface-3)" }}
    >
      {blocks.map((b, i) => {
        const isRest = b.kind === "rest";
        const h = isRest ? height * 0.4 : height * (0.5 + (b.zone / 5) * 0.5);
        return (
          <div
            key={i}
            style={{ width: `${(b.sec / total) * 100}%`, minWidth: 2, display: "flex", alignItems: "flex-end" }}
            title={`Z${b.zone}`}
          >
            <div
              style={{
                width: "100%",
                height: h,
                background: isRest ? "var(--rest)" : zoneColor(b.zone),
                opacity: isRest ? 0.5 : 1,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
