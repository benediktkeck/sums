"use client";

import { NO_AUTOFILL } from "@/lib/no-autofill";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Ellipsis, Equal, GripVertical, Minus, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUi } from "./ui-context";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatAmount, formatNumber, parseAmount } from "@sums/core/format";
import type { Condition, Plan } from "@sums/core/model/schema";
import type { ItemStatus, Override } from "@sums/core/engine/calculate";
import { formatEur, formatPercent } from "@sums/core/format";
import { NEW_ITEM_EVENT } from "@/lib/events";

const OP_ICONS = { "+": Plus, "−": Minus, "=": Equal } as const;

/** Sign of a calculation line, tinted like its segment. Icons: text glyphs sit off-center in the square. */
export function Op({ op, color }: { op?: string; color?: string }) {
  const Icon = OP_ICONS[op as keyof typeof OP_ICONS];
  return (
    <span className={`op ${color ? "tone" : ""}`} style={color ? { background: color } : undefined}>
      {Icon && <Icon size={13} strokeWidth={3} aria-label={op} />}
    </span>
  );
}

export function Checkbox({
  on,
  onToggle,
  label,
  disabled,
  title,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      title={title}
      disabled={disabled}
      className={`cb ${on ? "on" : ""} disabled:cursor-not-allowed disabled:opacity-60`}
      onClick={onToggle}
    >
      {on && <CheckMark />}
    </button>
  );
}

/** Own path, optically centered in its 16×16 box (the icon-font check sits off-center). */
export function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d="M3.5 8.25 6.5 11.25 12.5 4.75" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`sw ${on ? "on" : ""}`} onClick={onToggle} />
  );
}

/**
 * Number input with German formatting. Calls `onChange` on every valid
 * keystroke (live recalculation); `start` is the value when editing began,
 * so callers can describe the whole edit ("50 € → 55 €").
 */
export function NumberInput({
  value,
  onChange,
  label,
  className = "inp",
  decimals = 2,
  suffix = "€",
  min,
  id,
  autoFocus,
}: {
  value: number;
  onChange: (value: number, start: number) => void;
  label: string;
  className?: string;
  decimals?: number;
  suffix?: string;
  min?: number;
  id?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const start = useRef(value);
  const fmt = (n: number) => (decimals === 2 ? formatAmount(n) : formatNumber(n, decimals));
  const display = text ?? `${fmt(value)}${suffix ? ` ${suffix}` : ""}`;
  const parsed = text == null ? value : parseAmount(text);
  const invalid = text != null && (parsed == null || (min != null && parsed < min));
  return (
    <input {...NO_AUTOFILL}
      id={id}
      autoFocus={autoFocus}
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid}
      className={`${className} n ${invalid ? "invalid" : ""}`}
      value={display}
      onFocus={(e) => {
        start.current = value;
        setText(fmt(value).replace(/\./g, ""));
        const el = e.currentTarget;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseAmount(e.target.value);
        if (n != null && (min == null || n >= min) && n !== value) onChange(n, start.current);
      }}
      onBlur={() => setText(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          if (value !== start.current) onChange(start.current, start.current);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function Tip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Replaces the checkbox when a scenario decides whether an item counts.
 * Same box in the accent color; clicking opens the scenario.
 */
export function ScenarioToggle({ status, label }: { status: ItemStatus; label: string }) {
  const { editSwitch } = useUi();
  const reason = status.reason!;
  return (
    <Tip content={<>Szenario „{reason.switchName}“ schaltet {label} {status.active ? "ein" : "aus"}</>}>
      <button
        type="button"
        role="checkbox"
        aria-checked={status.active}
        aria-label={`${label}: gesteuert von Szenario ${reason.switchName}`}
        className={`cb scen ${status.active ? "on" : ""}`}
        onClick={() => editSwitch(reason.switchId)}
      >
        {status.active && <CheckMark />}
      </button>
    </Tip>
  );
}

/**
 * The value that counts for an item. Inactive: struck through. Overridden by a
 * scenario: original struck through, new value in the accent color.
 */
export function ValueCell({
  value,
  active,
  override,
  reserve,
}: {
  value: number;
  active: boolean;
  override?: Override;
  reserve?: boolean;
}) {
  if (!active) {
    return (
      <span className="mo n">
        <s className="text-fg-3 decoration-fg-3/70">{formatEur(value)}</s>
      </span>
    );
  }
  if (override) {
    return (
      <Tip content={<>Szenario „{override.switchName}“: {formatEur(override.value)} statt {formatEur(override.original)}</>}>
        <span className="mo n ov">
          <s>{formatEur(override.original)}</s>
          <b>{formatEur(value)}</b>
        </span>
      </Tip>
    );
  }
  if (reserve) {
    return (
      <Tip content="Wird angespart: Der Monatsanteil wandert in die Rücklagen.">
        <span className="mo n sav">
          <b className="inline-flex items-center justify-end gap-1.5">
            <PiggyBank size={14} strokeWidth={2.2} />
            {formatEur(value)}
          </b>
        </span>
      </Tip>
    );
  }
  return (
    <span className="mo n">
      <b>{formatEur(value)}</b>
    </span>
  );
}

export function FormDialog({
  title,
  description,
  children,
  onClose,
  onSave,
  onDelete,
  saveLabel = "Speichern",
  canSave = true,
  wide,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saveLabel?: string;
  canSave?: boolean;
  wide?: boolean;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={`dlg flex flex-col gap-0 p-0 ${wide ? "sm:max-w-[680px]" : "sm:max-w-[560px]"} max-h-[calc(100dvh-40px)] w-[560px] ${wide ? "w-[680px]" : ""}`}
      >
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSave?.();
          }}
        >
          <div className="hd">
            <DialogTitle asChild className="text-lg leading-tight font-[650]">
              <h3>{title}</h3>
            </DialogTitle>
            {description ? (
              <DialogDescription asChild className="text-[15px] text-fg-2">
                <p>{description}</p>
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </div>
          <div className="bd">{children}</div>
          <div className="ft">
            {onDelete && (
              <button type="button" className="btn ghost danger mr-auto" onClick={onDelete} aria-label="Löschen" title="Löschen">
                <Trash2 />
                <span className="hide-m">Löschen</span>
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              Abbrechen
            </button>
            {onSave && (
              <button type="submit" className="btn p" disabled={!canSave}>
                {saveLabel}
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="lbl" htmlFor={htmlFor}>
        {label} {hint && <small>{hint}</small>}
      </label>
      {children}
    </div>
  );
}

/** "Active only when switch X is on/off" picker. */
export function ConditionSelect({
  id,
  plan,
  value,
  onChange,
}: {
  id?: string;
  plan: Plan;
  value: Condition | null;
  onChange: (c: Condition | null) => void;
}) {
  const key = value ? `${value.switchId}:${value.when}` : "";
  return (
    <Select
      id={id}
      value={key}
      onChange={(v) => {
        if (!v) return onChange(null);
        const [switchId, when] = v.split(":");
        onChange({ switchId, when: when as "on" | "off" });
      }}
      options={[{ value: "", label: "Immer" }]}
      groups={plan.switches.map((s) => ({
        label: s.name,
        options: [
          { value: `${s.id}:on`, label: "Nur wenn an", short: `Nur wenn „${s.name}“ an`, icon: <span className="sw sw-mini on flex-none" /> },
          { value: `${s.id}:off`, label: "Nur wenn aus", short: `Nur wenn „${s.name}“ aus`, icon: <span className="sw sw-mini flex-none" /> },
        ],
      }))}
    />
  );
}

export function RowMenu({
  onEdit,
  onUp,
  onDown,
  onDuplicate,
  onDelete,
  label,
}: {
  onEdit: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  label: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="menu" aria-label={`Aktionen für ${label}`}>
          <Ellipsis size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Bearbeiten
        </DropdownMenuItem>
        {onDuplicate && (
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy /> Duplizieren
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onUp} disabled={!onUp}>
          <ArrowUp /> Nach oben
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDown} disabled={!onDown}>
          <ArrowDown /> Nach unten
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> Löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Drag-and-drop reordering with a grip handle. `onDrop(dragId, targetId, after)`
 * moves the dragged item before the target row, or after it when dropped on the
 * row's lower half (the only way to reach the last place).
 */
export function useDragReorder(onDrop: (dragId: string, targetId: string, after: boolean) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  return {
    handle(id: string, label: string) {
      return (
        <span
          draggable
          role="button"
          aria-label={`${label} verschieben`}
          title="Ziehen zum Verschieben"
          className="absolute top-1/2 left-0.5 hidden -translate-y-1/2 cursor-grab text-fg-3 opacity-0 group-hover:opacity-100 sm:block"
          onDragStart={(e) => {
            setDragId(id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", id);
            const row = (e.currentTarget as HTMLElement).closest(".r");
            if (row) e.dataTransfer.setDragImage(row, 20, 20);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOver(null);
          }}
        >
          <GripVertical size={14} />
        </span>
      );
    },
    rowProps(id: string) {
      const here = over?.id === id ? over : null;
      return {
        onDragOver: (e: React.DragEvent) => {
          if (!dragId || dragId === id) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const box = e.currentTarget.getBoundingClientRect();
          const after = e.clientY > box.top + box.height / 2;
          if (here?.after !== after) setOver({ id, after });
        },
        onDragLeave: () => setOver((o) => (o?.id === id ? null : o)),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          if (dragId && dragId !== id) onDrop(dragId, id, here?.after ?? false);
          setDragId(null);
          setOver(null);
        },
        className: `group relative ${here ? (here.after ? "drag-over-after" : "drag-over") : ""}`,
      };
    },
  };
}

/** Subscribes to the global "N" shortcut. */
export function useNewItemShortcut(handler: () => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const fn = () => ref.current();
    window.addEventListener(NEW_ITEM_EVENT, fn);
    return () => window.removeEventListener(NEW_ITEM_EVENT, fn);
  }, []);
}

export function useLocalStorageSet(key: string) {
  const [set, setSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore client-only UI state after hydration
      if (raw) setSet(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, [key]);
  const toggle = (id: string) =>
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(key, JSON.stringify([...next]));
      return next;
    });
  return [set, toggle] as const;
}

/** Thin stacked bar of parts (e.g. categories), each segment with a tooltip. */
export function CompositionBar({
  parts,
  className = "",
}: {
  parts: { id: string; name: string; value: number; color: string }[];
  className?: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return null;
  return (
    <div className={`ov-comp ${className}`} aria-hidden>
      {parts.map((p) =>
        p.value > 0 ? (
          <Tip key={p.id} content={<>{p.name} · {formatEur(p.value)} · {formatPercent(p.value, total)}</>}>
            <i style={{ flex: p.value, background: p.color }} />
          </Tip>
        ) : null,
      )}
    </div>
  );
}

/** "Aktiviert" checkbox row for dialogs, same look as the list checkboxes. */
export function ActiveCheck({ on, onToggle, hint }: { on: boolean; onToggle: (on: boolean) => void; hint?: React.ReactNode }) {
  return (
    <label className="act-chk">
      <Checkbox on={on} label="Aktiviert" onToggle={() => onToggle(!on)} />
      <span>
        Aktiviert
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}
