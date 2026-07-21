"use client";

/**
 * The IronPath reactor — an original arc-reactor style mark. When `progress`
 * (0–100) is supplied, the outer ring fills and the core glows brighter as it
 * "charges", used on the plan-generation loading screen.
 */
export function Reactor({
  size = 180,
  progress,
  spinning = true,
}: {
  size?: number;
  progress?: number;
  spinning?: boolean;
}) {
  const p = progress == null ? null : Math.max(0, Math.min(100, progress));
  const R = 46;
  const C = 2 * Math.PI * R;
  const dash = p == null ? C : (p / 100) * C;
  const glow = p == null ? 0.5 : 0.35 + (p / 100) * 0.5;

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      {/* radial glow */}
      <div
        className="glow-breathe"
        style={{
          position: "absolute",
          inset: "-20%",
          background: "radial-gradient(circle, rgba(255,106,44,0.45), transparent 60%)",
          filter: "blur(10px)",
          opacity: glow,
        }}
      />
      <svg viewBox="0 0 120 120" width={size} height={size} style={{ position: "relative" }}>
        <defs>
          <linearGradient id="molten" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-soft)" />
            <stop offset="55%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
          <radialGradient id="coreGrad" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#fff6ec" />
            <stop offset="35%" stopColor="var(--accent-soft)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </radialGradient>
        </defs>

        {/* faint base ring */}
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="3" opacity="0.6" />

        {/* progress / energy ring */}
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="url(#molten)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dasharray 0.4s ease", filter: "drop-shadow(0 0 4px var(--accent))" }}
        />

        {/* rotating segmented rings */}
        <g className={spinning ? "spin-slow" : undefined} opacity="0.9">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const x1 = (60 + Math.cos(a) * 34).toFixed(2);
            const y1 = (60 + Math.sin(a) * 34).toFixed(2);
            const x2 = (60 + Math.cos(a) * 39).toFixed(2);
            const y2 = (60 + Math.sin(a) * 39).toFixed(2);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth="2" opacity={0.5} />;
          })}
        </g>
        <g className={spinning ? "spin-rev" : undefined}>
          <circle cx="60" cy="60" r="30" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.55" />
        </g>

        {/* inner hex frame */}
        <g className={spinning ? "spin-fast" : undefined} opacity="0.85">
          <polygon
            points="60,38 79,49 79,71 60,82 41,71 41,49"
            fill="none"
            stroke="url(#molten)"
            strokeWidth="2"
          />
        </g>

        {/* molten core */}
        <g className="core-pulse">
          <circle cx="60" cy="60" r="16" fill="url(#coreGrad)" style={{ filter: "drop-shadow(0 0 10px var(--accent-2))" }} />
          <circle cx="60" cy="60" r="9" fill="#fff3e6" opacity="0.9" />
        </g>
      </svg>
    </div>
  );
}
