"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { calculate } from "@sums/core/engine/calculate";
import { demoPlan } from "@sums/core/fixtures/demo-plan";
import { track } from "@/lib/analytics";
import { formatDelta, formatEur } from "@sums/core/format";

const TWEEN_MS = 1100;

/**
 * Eases displayed numbers towards their targets in one animation frame loop, so
 * the card renders once per frame however many numbers move (instant with
 * reduced motion).
 */
function useTweened(targets: number[]): number[] {
  const [values, setValues] = useState(targets);
  const current = useRef(targets);
  const key = targets.join("|");
  useEffect(() => {
    const to = key.split("|").map(Number);
    const from = current.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - start) / TWEEN_MS);
      const e = 1 - Math.pow(1 - k, 4);
      const v = to.map((t, i) => (from[i] ?? t) + (t - (from[i] ?? t)) * e);
      current.current = v;
      setValues(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key]);
  return values;
}

/** "up"/"down" while a tweened number is still travelling towards its target. */
function motion(shown: number, target: number): string {
  if (Math.abs(target - shown) < 0.5) return "";
  return target > shown ? "moving up" : "moving down";
}

/**
 * Autoplay script: one scenario flips per step, as if someone were clicking
 * through. Ids refer to the demo plan.
 */
const TOUR: string[][] = [
  [],
  ["demo-sw-raise"],
  ["demo-sw-raise", "demo-sw-move"],
  ["demo-sw-move"],
  ["demo-sw-move", "demo-sw-parental"],
  ["demo-sw-parental"],
];
const STEP_MS = 3000;
const toState = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, true]));

/**
 * The landing page's hook: the example household's month, computed live by the
 * real engine. Visitors flip the scenarios and watch what is left change; until
 * they do, it plays through the scenarios by itself.
 */
export function HeroDemo() {
  const base = useMemo(() => demoPlan(), []);
  const baseResult = useMemo(() => calculate(base), [base]);
  const [on, setOn] = useState<Record<string, boolean>>({});
  // Autoplay walks through TOUR until the visitor takes over (click) or pauses it.
  const [auto, setAuto] = useState(true);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const el = root.current;
    if (!el) return () => mq.removeEventListener("change", sync);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => {
      mq.removeEventListener("change", sync);
      io.disconnect();
    };
  }, []);
  const playing = auto && visible && !reduceMotion;

  const nextStep = (step + 1) % TOUR.length;
  const nextOn = toState(TOUR[nextStep]);
  // An invisible CSS animation (paused on hover/focus) times the tour.
  const advance = () => {
    for (const s of base.switches) {
      if (!!on[s.id] === !!nextOn[s.id]) continue;
      rows.current.get(s.id)?.animate([{ transform: "scale(1)" }, { transform: "scale(0.97)" }, { transform: "scale(1)" }], {
        duration: 320,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      });
    }
    setStep(nextStep);
    setOn(nextOn);
  };

  const plan = useMemo(() => ({ ...base, switches: base.switches.map((s) => ({ ...s, on: !!on[s.id] })) }), [base, on]);
  const r = useMemo(() => calculate(plan), [plan]);
  // Each scenario's effect on its own, so the chips stay stable while toggling.
  const impact = useMemo(
    () =>
      Object.fromEntries(
        base.switches.map((s) => [s.id, calculate({ ...base, switches: base.switches.map((x) => ({ ...x, on: x.id === s.id })) }).free - baseResult.free]),
      ),
    [base, baseResult],
  );
  const delta = r.free - baseResult.free;
  const targets = [r.free, delta, r.surplus, r.income.total, r.fixed.total, r.variable.total, r.savings.total];
  const [free, shownDelta, surplus, income, ...costs] = useTweened(targets);
  const total = Math.max(r.income.total, 1);
  const parts = [
    { key: "fixed", label: "Fixkosten", value: r.fixed.total, color: "var(--s-fixed)" },
    { key: "var", label: "Variabel", value: r.variable.total, color: "var(--s-var)" },
    { key: "sav", label: "Rücklagen", value: r.savings.total, color: "var(--sav)" },
    { key: "free", label: "Frei", value: Math.max(0, r.free), color: "var(--brand)" },
  ];
  const hasDelta = Math.abs(delta) >= 0.005;

  return (
    <div ref={root} className={`lp-demo ${playing ? "playing" : ""}`} aria-label="Beispielrechnung zum Ausprobieren">
      <div className="lp-demo-head">
        <span>Was bleibt übrig?</span>
        <span className="lp-pill">Beispiel · Alex &amp; Sam</span>
      </div>
      <div className="lp-demo-free">
        <b className={`n ${motion(free, r.free)}`}>{formatEur(free)}</b>
        <span className="sr-only" aria-live="polite">
          {formatEur(r.free)} frei pro Monat
        </span>
        <span className={`lp-delta lp-demo-delta n ${shownDelta < 0 ? "down" : "up"} ${hasDelta ? "" : "hidden"}`} aria-hidden>
          {formatDelta(hasDelta ? shownDelta : delta)}
        </span>
      </div>
      <p className="lp-demo-sub">
        frei pro Monat · davon <b className={`n ${motion(surplus, r.surplus)}`}>{formatEur(surplus)}</b> Überschuss nach Taschengeld
      </p>
      <div className="lp-demo-bar" aria-hidden>
        {parts.map((p) => (
          <i key={p.key} style={{ flexGrow: p.value / total, background: p.color, minWidth: p.value > 0 ? undefined : 0 }} />
        ))}
      </div>
      <dl className="lp-demo-lines">
        <div>
          <dt>Einkommen</dt>
          <dd className={`n ${motion(income, r.income.total)}`}>{formatEur(income)}</dd>
        </div>
        {parts.slice(0, 3).map((p, i) => (
          <div key={p.key}>
            <dt>
              <i style={{ background: p.color }} />− {p.label}
            </dt>
            <dd className={`n ${motion(costs[i], p.value)}`}>{formatEur(costs[i])}</dd>
          </div>
        ))}
      </dl>
      <div className="lp-demo-scen">
        <div className="lp-demo-scen-title">
          <span>Szenarien zum Ausprobieren</span>
          {!reduceMotion && (
            <button
              type="button"
              className="lp-demo-auto"
              aria-pressed={auto}
              aria-label={auto ? "Automatische Vorführung anhalten" : "Automatische Vorführung starten"}
              onClick={() => setAuto((a) => !a)}
            >
              {auto ? <Pause size={12} /> : <Play size={12} />}
              Auto
              {playing && <i key={step} className="lp-demo-timer" onAnimationEnd={advance} style={{ animationDuration: `${STEP_MS}ms` }} />}
            </button>
          )}
        </div>
        <div className="lp-scen-list">
          {base.switches.map((s) => {
            const active = !!on[s.id];
            const d = impact[s.id];
            return (
              <button
                key={s.id}
                ref={(el) => {
                  if (el) rows.current.set(s.id, el);
                  else rows.current.delete(s.id);
                }}
                type="button"
                role="switch"
                aria-checked={active}
                className={`lp-scen ${active ? "on" : ""}`}
                onClick={() => {
                  setAuto(false);
                  track("landing_scenario_toggled", { on: !active });
                  setOn((o) => ({ ...o, [s.id]: !o[s.id] }));
                }}
              >
                <span className={`sw ${active ? "on" : ""}`} aria-hidden />
                <span className="lp-scen-name">{s.name}</span>
                <span className={`lp-delta n ${d < 0 ? "down" : "up"}`}>{formatDelta(d)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
