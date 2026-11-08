"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { CheckIcon, Pipette } from "lucide-react";
import { NO_AUTOFILL } from "@/lib/no-autofill";

/** Mid-tone presets that stay readable on the dark and the light theme. */
export const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#a16207", "#78716c", "#64748b",
];

type Hsv = { h: number; s: number; v: number };

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return "#" + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

function hexToHsv(hex: string): Hsv | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const full = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: max ? d / max : 0, v: max };
}

/** Resolves any CSS color (including `var(--x)`) to #rrggbb in the current theme. */
function resolveHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  const el = document.createElement("span");
  el.style.color = color;
  el.style.display = "none";
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [136, 136, 136];
  el.remove();
  return "#" + rgb.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
}

/** Pointer drag over an element; reports the position as 0..1 fractions. */
function useDrag(onMove: (x: number, y: number) => void) {
  const pick = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onMove(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  };
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      pick(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.buttons & 1) pick(e);
    },
  };
}

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/**
 * Swatch button that opens a palette popover: theme colors (adapt to light/dark),
 * presets, and a custom picker (saturation/brightness field, hue slider, hex).
 */
export function ColorPicker({
  value,
  onChange,
  label,
  themed = [],
  className = "",
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
  /** CSS-variable colors that follow the theme, shown in their own row. */
  themed?: string[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [hsv, setHsv] = React.useState<Hsv>({ h: 0, s: 0, v: 0.5 });
  const [hex, setHex] = React.useState("");
  const lastEmitted = React.useRef<string | null>(null);

  // sync the custom picker with the current value whenever the popover opens or the value changes elsewhere
  React.useEffect(() => {
    if (!open || value === lastEmitted.current) return;
    const h = resolveHex(value);
    const next = hexToHsv(h);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from a DOM-resolved color, only available on the client
    if (next) setHsv((cur) => (next.s === 0 || next.v === 0 ? { ...next, h: cur.h } : next));
    setHex(h);
  }, [open, value]);

  const emit = (next: Hsv) => {
    setHsv(next);
    const h = hsvToHex(next);
    setHex(h);
    lastEmitted.current = h;
    onChange(h);
  };
  const pickPreset = (c: string) => {
    lastEmitted.current = null;
    onChange(c);
    setOpen(false);
  };

  const sv = useDrag((x, y) => emit({ ...hsv, s: x, v: 1 - y }));
  const hue = useDrag((x) => emit({ ...hsv, h: x * 359.9 }));
  const eyeDropper = typeof window !== "undefined" ? (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper : undefined;
  const current = value.toLowerCase();

  const swatch = (c: string) => (
    <button
      key={c}
      type="button"
      className="cp-sw"
      style={{ background: c }}
      aria-label={`Farbe ${c}`}
      aria-pressed={current === c.toLowerCase()}
      onClick={() => pickPreset(c)}
    >
      {current === c.toLowerCase() && <CheckIcon size={13} strokeWidth={3} />}
    </button>
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={`cp-trigger ${className}`} style={{ background: value }} aria-label={label} title="Farbe wählen" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="cp" sideOffset={8} align="start" collisionPadding={12}>
          {themed.length > 0 && (
            <>
              <div className="cp-h">Passend zum Design</div>
              <div className="cp-grid">{themed.map(swatch)}</div>
            </>
          )}
          <div className="cp-h">Farben</div>
          <div className="cp-grid">{PRESET_COLORS.map(swatch)}</div>

          <div className="cp-h">Eigene Farbe</div>
          <div
            className="cp-sv"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex({ h: hsv.h, s: 1, v: 1 })})` }}
            role="slider"
            tabIndex={0}
            aria-label="Sättigung und Helligkeit"
            aria-valuenow={Math.round(hsv.s * 100)}
            aria-valuetext={`Sättigung ${Math.round(hsv.s * 100)} %, Helligkeit ${Math.round(hsv.v * 100)} %`}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 0.1 : 0.02;
              const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
              if (!d) return;
              e.preventDefault();
              emit({ ...hsv, s: Math.min(1, Math.max(0, hsv.s + d[0])), v: Math.min(1, Math.max(0, hsv.v + d[1])) });
            }}
            {...sv}
          >
            <i className="cp-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex || undefined }} />
          </div>
          <div
            className="cp-hue"
            role="slider"
            tabIndex={0}
            aria-label="Farbton"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsv.h)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 15 : 3;
              const d = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : e.key === "ArrowRight" || e.key === "ArrowUp" ? step : 0;
              if (!d) return;
              e.preventDefault();
              emit({ ...hsv, h: (hsv.h + d + 360) % 360 });
            }}
            {...hue}
          >
            <i className="cp-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, top: "50%", background: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }} />
          </div>
          <div className="cp-row">
            <span className="cp-prev" style={{ background: value }} />
            <label className="cp-hex">
              <span>#</span>
              <input
                {...NO_AUTOFILL}
                aria-label="Hex-Farbcode"
                value={hex.replace(/^#/, "")}
                maxLength={7}
                spellCheck={false}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9a-f#]/gi, "");
                  setHex("#" + raw.replace(/^#/, ""));
                  const next = raw.replace(/^#/, "").length === 6 ? hexToHsv(raw) : null;
                  if (next) emit(next);
                }}
              />
            </label>
            {eyeDropper && (
              <button
                type="button"
                className="cp-eye"
                aria-label="Farbe vom Bildschirm aufnehmen"
                title="Farbe vom Bildschirm aufnehmen"
                onClick={async () => {
                  try {
                    const { sRGBHex } = await new eyeDropper().open();
                    const next = hexToHsv(sRGBHex);
                    if (next) emit(next);
                  } catch {
                    // cancelled
                  }
                }}
              >
                <Pipette size={15} />
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
