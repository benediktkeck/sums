"use client";

import * as React from "react";
import { cn } from "cn";
import { Select as SelectPrimitive } from "radix-ui";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

/** Radix does not allow "" as an item value; map it to a sentinel internally. */
const EMPTY = "__empty__";
const toRadix = (v: string) => (v === "" ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? "" : v);

export type SelectOption = {
  value: string;
  label: React.ReactNode;
  /** Text shown in the closed trigger (defaults to label). */
  short?: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** Small marker shown at the end of the menu item (not in the trigger). */
  aside?: React.ReactNode;
  disabled?: boolean;
};
export type SelectGroup = { label: React.ReactNode; options: SelectOption[] };

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Flat options, or groups with a heading each. Ungrouped options come first. */
  options?: SelectOption[];
  groups?: SelectGroup[];
  /** "field" = form control (dialogs, settings); "inline" = compact table cell. */
  variant?: "field" | "inline";
  id?: string;
  "aria-label"?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function Select({
  value,
  onChange,
  options = [],
  groups = [],
  variant = "field",
  id,
  placeholder,
  disabled,
  className,
  ...rest
}: Props) {
  const all = [...options, ...groups.flatMap((g) => g.options)];
  const current = all.find((o) => o.value === value);
  return (
    <SelectPrimitive.Root value={toRadix(value)} onValueChange={(v) => onChange(fromRadix(v))} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={rest["aria-label"]}
        className={cn(variant === "field" ? "field xsel" : "sel", "group/sel", className)}
      >
        <span className="xsel-v">
          {current?.icon}
          <span className="truncate">{current ? (current.short ?? current.label) : <span className="text-fg-3">{placeholder}</span>}</span>
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="xsel-chev" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={6} className="xsel-menu" data-variant={variant}>
          <SelectPrimitive.Viewport className="xsel-vp">
            {options.map((o) => (
              <Item key={o.value} option={o} />
            ))}
            {groups.map((g, i) => (
              <SelectPrimitive.Group key={i}>
                {(i > 0 || options.length > 0) && <SelectPrimitive.Separator className="xsel-sep" />}
                <SelectPrimitive.Label className="xsel-gl">{g.label}</SelectPrimitive.Label>
                {g.options.map((o) => (
                  <Item key={o.value} option={o} />
                ))}
              </SelectPrimitive.Group>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function Item({ option }: { option: SelectOption }) {
  return (
    <SelectPrimitive.Item value={toRadix(option.value)} disabled={option.disabled} className="xsel-it">
      {option.icon}
      <span className="min-w-0 flex-1">
        <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
        {option.hint && <small>{option.hint}</small>}
      </span>
      {option.aside}
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="size-4 text-brand" strokeWidth={2.6} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
