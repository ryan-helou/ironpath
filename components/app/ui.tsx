"use client";

import { createContext, useContext } from "react";
import { Discipline } from "@/lib/types";

export interface UIActions {
  toggleDone(id: string): void;
  skip(id: string): void;
  unskip(id: string): void;
  move(id: string, dateISO: string): void;
  swap(id: string, discipline: Discipline): void;
  logInstead(id: string, note: string): void;
  rebuild(): void;
  ease(days: number): void;
}

export type TabKey = "today" | "plan" | "progress" | "profile";

export interface UICtxValue {
  today: string;
  openWorkout(id: string | null): void;
  openCoach(prefill?: string): void;
  goTab(tab: TabKey): void;
  actions: UIActions;
}

export const UICtx = createContext<UICtxValue | null>(null);
export function useUI() {
  const c = useContext(UICtx);
  if (!c) throw new Error("useUI outside provider");
  return c;
}
