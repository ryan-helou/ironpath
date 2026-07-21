"use client";

import { useEffect, useRef, useState } from "react";
import { Plan } from "@/lib/types";
import { apiCoach } from "@/lib/api";
import { summarizeForCoach } from "@/lib/adapt";
import { Reactor } from "../Reactor";

interface Msg { role: "coach" | "you"; text: string }

export function CoachSheet({ plan, today, prefill, onClose }: { plan: Plan; today: string; prefill?: string; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "coach", text: "I'm your IronPath coach. Ask me anything about today's session, pacing, fueling, or how you're feeling." },
  ]);
  const [input, setInput] = useState(prefill ?? "");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "you", text: q }]);
    setBusy(true);
    const ctx = summarizeForCoach(plan, today);
    const res = await apiCoach(ctx, q);
    setBusy(false);
    setMsgs((m) => [...m, { role: "coach", text: res.text || "…" }]);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="animate-pop relative flex h-[80vh] flex-col rounded-t-3xl border-t border-line bg-background safe-b"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Reactor size={30} spinning={false} />
          <div className="flex-1">
            <div className="font-display font-bold">IronPath Coach</div>
            <div className="text-xs text-muted">Powered by Claude · Haiku</div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "you" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "you" ? "accent-gradient text-[#1a0d06]" : "border border-line bg-surface-2"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">Thinking…</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask your coach…"
          />
          <button onClick={send} disabled={busy || !input.trim()} className="btn btn-primary px-4 py-3">Send</button>
        </div>
      </div>
    </div>
  );
}
