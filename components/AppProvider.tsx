"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Plan, Profile } from "@/lib/types";
import { apiLogin, apiLogout, apiMe, apiSaveState, apiSignup } from "@/lib/api";

type Screen = "loading" | "anon" | "onboarding" | "app";

interface Ctx {
  screen: Screen;
  username: string | null;
  profile: Profile | null;
  plan: Plan | null;
  offline: boolean;
  signup(u: string, p: string): Promise<string | null>;
  login(u: string, p: string): Promise<string | null>;
  logout(): Promise<void>;
  startPlan(profile: Profile, plan: Plan): void;
  applyPlan(plan: Plan): void;
  resetPlan(): void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

const CACHE_KEY = "ironpath:cache";

function readCache(): { username: string; profile: Profile | null; plan: Plan | null } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeCache(username: string, profile: Profile | null, plan: Plan | null) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ username, profile, plan }));
  } catch {
    /* ignore quota */
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [booted, setBooted] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [offline, setOffline] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // hydrate
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await apiMe();
        if (cancelled) return;
        if (me.authenticated && me.user) {
          setUsername(me.user.username);
          const st = me.state ?? {};
          setProfile((st.profile as Profile) ?? null);
          setPlan((st.plan as Plan) ?? null);
          writeCache(me.user.username, (st.profile as Profile) ?? null, (st.plan as Plan) ?? null);
        }
      } catch {
        // offline — fall back to last cached session
        const cache = readCache();
        if (cache && !cancelled) {
          setOffline(true);
          setUsername(cache.username);
          setProfile(cache.profile);
          setPlan(cache.plan);
        }
      } finally {
        if (!cancelled) setBooted(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    (uname: string | null, prof: Profile | null, pl: Plan | null) => {
      if (!uname) return;
      writeCache(uname, prof, pl);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        apiSaveState(prof, pl).catch(() => setOffline(true));
      }, 700);
    },
    [],
  );

  const signup = useCallback(async (u: string, p: string): Promise<string | null> => {
    const { ok, data } = await apiSignup(u, p);
    if (!ok) return data.error || "Could not sign up.";
    setUsername(data.user.username);
    setProfile(null);
    setPlan(null);
    setOffline(false);
    writeCache(data.user.username, null, null);
    return null;
  }, []);

  const login = useCallback(async (u: string, p: string): Promise<string | null> => {
    const { ok, data } = await apiLogin(u, p);
    if (!ok) return data.error || "Could not sign in.";
    const st = data.state ?? {};
    setUsername(data.user.username);
    setProfile((st.profile as Profile) ?? null);
    setPlan((st.plan as Plan) ?? null);
    setOffline(false);
    writeCache(data.user.username, (st.profile as Profile) ?? null, (st.plan as Plan) ?? null);
    return null;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout().catch(() => {});
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
    setUsername(null);
    setProfile(null);
    setPlan(null);
  }, []);

  const startPlan = useCallback(
    (prof: Profile, pl: Plan) => {
      setProfile(prof);
      setPlan(pl);
      persist(username, prof, pl);
    },
    [username, persist],
  );

  const applyPlan = useCallback(
    (pl: Plan) => {
      setPlan(pl);
      persist(username, profile, pl);
    },
    [username, profile, persist],
  );

  const resetPlan = useCallback(() => {
    setProfile(null);
    setPlan(null);
    persist(username, null, null);
  }, [username, persist]);

  const screen: Screen = !booted
    ? "loading"
    : !username
    ? "anon"
    : !plan
    ? "onboarding"
    : "app";

  return (
    <AppCtx.Provider
      value={{ screen, username, profile, plan, offline, signup, login, logout, startPlan, applyPlan, resetPlan }}
    >
      {children}
    </AppCtx.Provider>
  );
}
