# Sums — Plan

Sums is a household **budget planner** (not a spending tracker). It plans monthly income, recurring costs, savings buckets and how the remaining money is split between people. Households often do this in a spreadsheet, where formulas break when rows are added, removed or moved. Sums keeps all logic in a tested calculation engine; users only edit data.

## Scope

**In scope (V1)**
- Plan monthly income, recurring fixed costs, variable costs and savings buckets.
- Scenario switches ("what if …") that change the plan when toggled.
- Live summary: what is left each month, and how it is split.
- Undo/redo, automatic version history, named save states.
- Desktop first, usable on mobile.
- UI language German, `de-DE` formatting (`1.234,56 €`).

**Out of scope**
- Tracking actual transactions, bank import.
- User accounts. Self-hosted installs can set one shared password (`SUMS_PASSWORD`); public installs use local mode, where nothing is stored on the server.

## Storage modes and publishing

- **Server mode** (default): SQLite, one plan per installation, optional password. For self-hosting a household; shipped as a Docker image (`linux/amd64`, `linux/arm64`). The session cookie is keyed with a server secret, and failed logins are limited per client and per installation.
- **Local mode** (`SUMS_STORAGE=local`): the same version store runs in the browser on IndexedDB. The server serves pages only; API routes return no data. Suited to a public instance. The service worker caches pages and build assets so the app opens offline.
- **Backup files** (the plan as JSON) move data between browsers, devices and modes. Importing adds a new version. Backups from earlier versions may also contain money-flow boards; they are ignored.
- **Website** (`apps/web`, separate from the app): what Sums does, with a live example (the demo plan, scenarios to flip) and feature visuals computed from it. Its calls to action link to the app (`SUMS_APP_URL`); the public app runs in local mode on its own address. In the app, `/` always opens the plan.
- **In-app start**: a blank plan explains the calculation in one line and offers an own start (names of the persons), the demo plan (Alex & Sam) or a backup.
- **First-run guide**: the start screen asks for the names, then the guide walks through four steps (Einkommen, Fixkosten, Variable Kosten, Rücklagen). A step bar above those pages shows progress and the next step; a step counts as done once it has an entry or was skipped. Empty list pages explain what belongs there and offer one-click examples that open the dialog prefilled. While steps are open, the overview shows only the checklist (no empty section cards) and the sidebar leaves out scenarios and pocket money until an amount exists; once complete it lists the features beyond the lists. While the demo plan is loaded, a banner says so and starts an own plan. Skip/hide flags are per browser; "Mehr → Erste Schritte" brings the guide back.
- **Legal pages**: the Impressum is a link to the operator's own site (`SUMS_IMPRINT_URL`). Datenschutz is the operator's page (`SUMS_PRIVACY_URL`) or the built-in `/datenschutz`, which follows the configuration (storage mode, password cookie, offline cache, analytics, `SUMS_HOSTING_PROVIDER`) and names the operator by pointing to the Impressum.
- **Product analytics** (optional, `SUMS_POSTHOG_KEY`, off by default): PostHog in cookieless mode through a same-origin relay. Events say what kind of thing happened (item created, scenario toggled, setup step done), never plan content. No session replay, no autocapture. Visitors can turn it off per browser (*Einstellungen → Daten & Sicherung*); Do Not Track and Global Privacy Control count as an opt-out.

**V2 ideas**: the money-flow board (a sandbox to sketch accounts, cards and transfers; removed for v1, kept on the `archive/simulation` branch), contract end dates and cancellation reminders, price-change history, charts, savings goals with target dates, CSV/PDF export, comparing two save states side by side.

## Domain model

| Entity | Fields |
|---|---|
| Person | id, name, color, office days per week, commute km (one way), car (optional, several persons can share one) |
| Car | id, name, fuel consumption (l/100 km), fuel type (`e10` \| `diesel`) |
| Income | id, label, person (optional), monthly amount, active |
| Category | id, name, color, order — user-editable |
| Expense (fixed cost) | id, name, provider, amount, interval (`monthly` \| `quarterly` \| `half-yearly` \| `yearly`), category, active, condition (optional), notes, order |
| Variable cost | id, label, kind: `fixed` (monthly amount) or `commute-fuel` (person) — extensible kinds |
| Savings bucket | id, name, monthly amount, active, order |
| Switch (scenario) | id, name, on, ordered list of effects |
| Settings | fuel prices (E10, Diesel), allowance cap per person, split mode (`equal` \| `income` \| `none`), commute module on/off, weeks per month (default 52/12) |

**Switch effects** (applied in switch order; later effects win):
- `set` — override a value, e.g. an income amount or a person's office days.
- `enable` / `disable` — force an item active/inactive.

Items may also carry a **condition**: "active only when switch X is on/off".

## Calculation engine

A pure function `calculate(plan) → result`, framework-free, fully unit tested.

1. Apply effects of all switches that are on, in order, to a copy of the plan.
2. Resolve item activity (own `active` flag AND condition).
3. Monthly equivalent per expense: amount ÷ {1, 3, 6, 12} by interval.
4. **Fixed costs** = sum of active expenses with interval `monthly`, also grouped by category.
5. **Periodic reserve** = sum of monthly equivalents of active non-monthly expenses. It is added automatically as a savings line ("Periodische Ausgaben"), not to fixed costs.
6. **Variable costs**: fixed amounts plus commute fuel per person =
   `officeDays × 2 × weeksPerMonth × km / 100 × consumption × price(fuelType)`, with consumption and fuel type from the person's car; 0 without a car.
7. **Savings** = periodic reserve + active savings buckets.
8. **Free** (Differenz) = income − fixed − variable − savings.
9. **Allowance** per person = `max(0, min(share, cap))`, where share is `free / persons` (`equal`), `free × person's income / Σ persons' incomes` (`income`; only active incomes assigned to a person count; equal without any) or 0 (`none`). **Surplus** = `max(0, free − Σ allowance)`. A negative free amount is shown as a shortfall.

Monthly/yearly view: yearly = monthly × 12.

### Golden test

A synthetic reference plan (`packages/core/src/fixtures/reference-plan.ts`, Person A/B, made-up amounts) with hand-computed totals:

- income 6.000,00 · fixed 1.820,98 · variable 891,32 · savings 791,86 (incl. periodic 91,86)
- **free 2.495,84** · allowance 200,00 each · **surplus 2.095,84**

The derivation is written out in `calculate.test.ts`. Other rules it pins down: yearly values are monthly × 12, each car's fuel type selects its price, and the default is 52/12 weeks per month.

## Persistence and history

- The whole plan is one JSON document validated with Zod (schema-versioned for migrations).
- SQLite (Drizzle), table `plan_versions(id, created_at, label nullable, data json)`.
- Every committed edit stores a new version. Undo/redo moves through versions; restoring an old version creates a new version (nothing is lost).
- Named save states = versions with a label. The UI lists them, can restore them and shows which one is current.
- Debounce or coalesce rapid edits (e.g. typing in one field) into one version.

## UI

The design reference is the "middle" prototype (dark by default, light toggle, Geist font, orange accent `#ff6b35`, **wide** container of max 1640 px). Key elements:
- Top bar: logo, sections (Übersicht, Fixkosten, Einkommen, Variable Kosten, Rücklagen), save status, Undo, Verlauf (history), theme toggle.
- Page header with a summary sentence and primary action.
- Scenario chips with mini toggles and an edit button. The edit dialog lists effects as sentences and previews the impact.
- Fixed-cost list grouped by category (collapsible): checkbox, name with provider underneath, interval select, amount input (faint border, clearer on hover/focus), monthly value. Non-monthly items show "wird angespart" in the savings color. Items disabled by a scenario say why.
- Right sidebar (sticky): "Was bleibt übrig?" with a large free amount, last-change line, the calculation (Einkommen − Fixkosten − Variable Kosten − Rücklagen = Frei verfügbar), a stacked bar with legend, and the split card (allowance per person + surplus).
- Mobile: single column, summary first on Übersicht, bottom tab bar, compact rows (name + amount).
- Keyboard: ⌘/Ctrl+Z undo, ⇧⌘Z redo, N new item.

Pages not covered by the prototype should follow the same design language.

## Tech stack

Next.js (App Router) + TypeScript, Tailwind CSS + shadcn/ui, Zod, Drizzle + SQLite (better-sqlite3), Vitest, pnpm workspaces. Two Next apps (`apps/app`, `apps/web`) share `packages/core` (model, engine, formatting; no React/Next dependencies) and `packages/ui`.

## Milestones

1. Engine and model: schema, calculations, golden tests.
2. Persistence and history: versions, undo/redo, save states.
3. Editor UI: all sections, scenarios and the switch editor, summary sidebar, responsive layout.
4. Deployment (Docker, data volume), optional password.
5. Publishing: local mode, backups, start screen and demo plan, split modes, optional commute module, legal pages.
6. Open source (v1.0.0): monorepo with a separate website, Docker image on the GitHub Container Registry, login hardening, version shown in the app.

## Implementation notes (V1)

- **Order**: arrays in the plan document are ordered; the array position is the display order (no separate `order` field).
- **Versions**: `plan_versions` also stores `parent_id`, `updated_at`, `summary` and `coalesce_key`. Versions form a tree: undo moves the head to the parent, redo to the newest child, so redo still works after undoing and editing. The head pointer lives in `app_state`.
- **Coalescing**: the client debounces keystrokes (~0.45 s); the server merges commits with the same coalesce key into the head version for 15 s, unless the head is a named save state or already has children.
- **Concurrency**: commits carry the base version id; a stale base returns 409 and the client reloads.
- **Switch priority**: later switches win.
