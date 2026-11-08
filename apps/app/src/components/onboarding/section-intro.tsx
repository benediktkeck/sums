"use client";

import { Plus, type LucideIcon } from "lucide-react";
import { track } from "@/lib/analytics/client";
import type { StepId } from "@/lib/onboarding";

/**
 * Empty state of a list page: what belongs here, how to fill it in, and
 * examples that open the dialog with the name already filled in.
 */
export function SectionIntro({
  step,
  icon: Icon,
  title,
  children,
  tips,
  examples,
  onAdd,
  addLabel,
}: {
  /** Setup step of the page, for analytics. */
  step: StepId;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  tips?: React.ReactNode[];
  /** `trackAs` replaces the key in analytics when the key holds user data (a person's name). */
  examples: { key: string; label: string; trackAs?: string; onPick: () => void }[];
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="intro">
      <div className="intro-head">
        <span className="intro-ico">
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <h2>{title}</h2>
          <p>{children}</p>
        </div>
      </div>
      {tips && tips.length > 0 && (
        <ul className="intro-tips">
          {tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
      <div className="intro-ex">
        <span className="intro-ex-k">Zum Beispiel:</span>
        {examples.map((e) => (
          <button
            key={e.key}
            type="button"
            className="intro-chip"
            onClick={() => {
              track("setup_example_used", { step, example: e.trackAs ?? e.key });
              e.onPick();
            }}
          >
            <Plus size={14} strokeWidth={2.4} />
            {e.label}
          </button>
        ))}
        <button type="button" className="intro-chip own" onClick={onAdd}>
          {addLabel}
        </button>
      </div>
    </div>
  );
}
