"use client";

import { TabKey } from "./ui";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "today", label: "Today", icon: "⚡" },
  { key: "plan", label: "Plan", icon: "🗓️" },
  { key: "progress", label: "Progress", icon: "📈" },
  { key: "profile", label: "Profile", icon: "👤" },
];

export function BottomNav({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-line bg-background/90 backdrop-blur safe-b">
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 transition"
            >
              <span className={`text-xl transition ${active ? "" : "opacity-50 grayscale"}`}>{t.icon}</span>
              <span className={`text-[11px] font-semibold ${active ? "text-accent-soft" : "text-muted"}`}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
