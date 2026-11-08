"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatEur } from "@sums/core/format";

export type GrowthSeries = { id: string; name: string; color: string; values: number[] };

const H = 300;
const PAD = { top: 16, right: 16, bottom: 30, left: 76 };
const axisFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const monthFmt = new Intl.DateTimeFormat("de-DE", { month: "short", year: "numeric" });

/** 0 → 1.000 → 5.000 style ticks covering [min, max]. */
function niceTicks(min: number, max: number, count = 5): number[] {
  // at least a 1.000 € range so an empty account still gets a readable axis
  max = Math.max(max, min + 1000);
  const span = max - min;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw);
  const lo = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Cumulative bands, largest final balance first. Negative balances can't stack and count as 0. */
function stackBands(series: GrowthSeries[]) {
  const ordered = series
    .filter((s) => s.values.some((v) => v > 0))
    .sort((a, b) => b.values[b.values.length - 1] - a.values[a.values.length - 1]);
  let base = series[0]?.values.map(() => 0) ?? [];
  return ordered.map((s) => {
    const top = s.values.map((v, i) => base[i] + Math.max(0, v));
    const band = { series: s, base, top };
    base = top;
    return band;
  });
}

export function monthDate(start: Date, m: number): Date {
  return new Date(start.getFullYear(), start.getMonth() + m, 1);
}

/**
 * Balance-over-time stacked area chart: one band per account, so the top edge
 * is the total. The largest account sits at the bottom where its band keeps a
 * straight baseline. Crosshair + tooltip list every series at the hovered month.
 */
export function GrowthChart({ series, total, start }: { series: GrowthSeries[]; total?: number[]; start: Date }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipWidth, setTipWidth] = useState(200);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = (series[0]?.values.length ?? 1) - 1;
  const bands = stackBands(series);
  const tops = bands[bands.length - 1]?.top ?? [];
  const ticks = niceTicks(0, Math.max(1, ...tops));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const iw = width - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (m: number) => PAD.left + (n === 0 ? 0 : (m / n) * iw);
  const y = (v: number) => PAD.top + ih - ((v - yMin) / (yMax - yMin)) * ih;
  const edge = (vals: number[]) => vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const area = (top: number[], base: number[]) => `M${edge(top).join("L")}L${edge(base).reverse().join("L")}Z`;

  // x ticks: every January (or every k-th year when the range is long), plus "Heute"
  // Each year label needs about 44px; narrow charts label fewer years.
  const years = n / 12;
  const pxPerYear = years > 0 ? iw / years : iw;
  const every = [1, 2, 5, 10].find((k) => k * pxPerYear >= 44 && years / k <= 12) ?? 10;
  const xTicks: number[] = [];
  for (let m = 1; m <= n; m++) {
    const d = monthDate(start, m);
    if (d.getMonth() === 0 && d.getFullYear() % every === 0 && x(m) - x(0) > 48) xTicks.push(m);
  }

  const pick = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const m = Math.round(((clientX - rect.left - PAD.left) / iw) * n);
    setHover(Math.max(0, Math.min(n, m)));
  };

  // top-down, in the same order as the bands
  const rows = hover == null ? [] : bands.map((b) => ({ ...b.series, v: b.series.values[hover] })).reverse();
  const tipLeft = hover == null ? 0 : x(hover);
  // Beside the crosshair, on whichever side has room; on a narrow chart it stays inside the box.
  const flip = tipLeft + 12 + tipWidth > width;
  const tipX = Math.max(0, Math.min(width - tipWidth, flip ? tipLeft - 12 - tipWidth : tipLeft + 12));

  useLayoutEffect(() => {
    if (tipRef.current) setTipWidth(tipRef.current.offsetWidth);
  }, [hover]);

  return (
    <div
      ref={wrapRef}
      className="gchart"
      onPointerMove={(e) => pick(e.clientX)}
      onPointerLeave={() => setHover(null)}
      tabIndex={0}
      role="img"
      aria-label="Verlauf der Kontostände"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setHover((h) => Math.min(n, (h ?? -1) + 1));
        else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n + 1) - 1));
        else if (e.key === "Escape") setHover(null);
      }}
      onBlur={() => setHover(null)}
    >
      <svg width={width} height={H} aria-hidden>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? "g-base" : "g-grid"} />
            <text x={PAD.left - 10} y={y(t)} className="g-lbl" textAnchor="end" dominantBaseline="middle">
              {axisFmt.format(t)} €
            </text>
          </g>
        ))}
        {xTicks.map((m) => (
          <text key={m} x={x(m)} y={H - 8} className="g-lbl" textAnchor="middle">
            {monthDate(start, m).getFullYear()}
          </text>
        ))}
        <text x={x(0)} y={H - 8} className="g-lbl" textAnchor="start">
          Heute
        </text>
        {bands.map((b) => (
          <path key={b.series.id} d={area(b.top, b.base)} fill={b.series.color} className="g-band" />
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} className="g-cross" />
            {bands.map((b) => (
              <circle key={b.series.id} cx={x(hover)} cy={y(b.top[hover])} r={4.5} className="g-dot" style={{ fill: b.series.color }} />
            ))}
          </g>
        )}
      </svg>
      {hover != null && (
        <div ref={tipRef} className="g-tip" style={{ left: tipX }}>
          <div className="g-tip-h">{hover === 0 ? "Heute" : monthFmt.format(monthDate(start, hover))}</div>
          {total && (
            <div className="g-tip-r">
              <b className="n">{formatEur(total[hover])}</b>
              <span>Gesamt</span>
            </div>
          )}
          {rows.map((r) => (
            <div className="g-tip-r" key={r.id}>
              <b className="n">{formatEur(r.v)}</b>
              <span>
                <i className="g-key" style={{ background: r.color }} /> {r.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
