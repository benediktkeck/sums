"use client";

import { createContext, useContext } from "react";

export type UiContextValue = {
  /** Opens the scenario editor for an existing switch, or a new one with `null`. */
  editSwitch: (id: string | null) => void;
  /** Trial: icons in the main navigation (Einstellungen → Darstellung). */
  navIcons: boolean;
  setNavIcons: (on: boolean) => void;
  /** Opens the read-only "Vorschau" of the current page; undefined where there is none. */
  openPreview?: () => void;
};

export const UiContext = createContext<UiContextValue | null>(null);

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used within AppShell");
  return ctx;
}
