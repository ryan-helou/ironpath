"use client";

import { useState } from "react";
import { useApp } from "./AppProvider";
import { Reactor } from "./Reactor";

export function AuthScreen() {
  const { signup, login } = useApp();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = mode === "signup" ? await signup(username, password) : await login(username, password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="flex flex-1 flex-col safe-t">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <Reactor size={96} />
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">
            IRON<span className="text-gradient">PATH</span>
          </h1>
          <p className="mt-2 max-w-xs text-sm text-muted">
            Your personal triathlon coach. A day-by-day plan that adapts to you — swim, bike, run, all the way to the finish line.
          </p>
        </div>

        <div className="mb-5 flex rounded-full border border-line bg-surface-2 p-1 text-sm font-semibold">
          <button
            onClick={() => { setMode("signup"); setError(null); }}
            className={`flex-1 rounded-full py-2 transition ${mode === "signup" ? "accent-gradient text-[#1a0d06]" : "text-muted"}`}
          >
            Create account
          </button>
          <button
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 rounded-full py-2 transition ${mode === "login" ? "accent-gradient text-[#1a0d06]" : "text-muted"}`}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">Username</label>
          <input
            className="input"
            value={username}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ironmike"
          />
          <label className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error && <div className="mt-1 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

          <button type="submit" disabled={busy} className="btn btn-primary mt-3 py-3.5 text-base">
            {busy ? "One sec…" : mode === "signup" ? "Start training" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Built for you and your friends. Add it to your home screen to use it like a real app.
        </p>
      </div>
    </div>
  );
}
