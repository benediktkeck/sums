"use client";

import { useSyncExternalStore } from "react";
import type { StepId } from "@/lib/onboarding";

/**
 * Per-browser state of the first-run guide. It is a convenience, not plan
 * data: losing it only brings the guide back. Progress itself is derived from
 * the plan (`setupProgress`).
 */
export type GuideState = {
  /** The user closed the guide ("Erste Schritte" in the menu brings it back). */
  dismissed: boolean;
  /** Steps the user chose to leave empty. */
  skipped: StepId[];
  /** The demo plan is loaded: show the "Beispielplan" banner. */
  demo: boolean;
};

const KEY = "sums:guide";
const DEFAULT: GuideState = { dismissed: false, skipped: [], demo: false };
const listeners = new Set<() => void>();
let cache: { raw: string | null; state: GuideState } | null = null;
/** Used when browser storage is unavailable (private mode, blocked site data): the guide still works for this page load. */
let memory: GuideState | null = null;

function read(): GuideState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return memory ?? DEFAULT;
  }
  if (cache && cache.raw === raw) return cache.state;
  let state = DEFAULT;
  try {
    if (raw) state = { ...DEFAULT, ...(JSON.parse(raw) as Partial<GuideState>) };
  } catch {}
  cache = { raw, state };
  return state;
}

/** Current state outside React (e.g. while handling an edit). */
export const guideState = (): GuideState => read();

export function setGuide(patch: Partial<GuideState> | ((s: GuideState) => Partial<GuideState>)) {
  const current = read();
  const next = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  cache = null;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** `null` during server rendering and hydration: guide UI renders nothing until the browser state is known. */
export function useGuide(): GuideState | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export const skipStep = (id: StepId) => setGuide((s) => ({ skipped: [...new Set([...s.skipped, id])] }));
/** A fresh start: guide on, nothing skipped, no demo banner. */
export const resetGuide = () => setGuide({ dismissed: false, skipped: [], demo: false });
