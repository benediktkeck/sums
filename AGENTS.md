<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Sums – project conventions

Household budget planner. Spec: `docs/PLAN.md`. UI language German (`de-DE`), code and comments English. The app runs in two storage modes (see below); every feature must work in both. This is a public open-source repository (AGPL-3.0): never commit personal data, real plans, host names or credentials.

## Commands (from the repository root)

```bash
pnpm install          # native build for better-sqlite3 is allowed in pnpm-workspace.yaml
pnpm dev              # the app on 0.0.0.0:3000
pnpm dev:web          # the website on 0.0.0.0:3001
pnpm test             # Vitest in every package
pnpm typecheck        # next typegen && tsc --noEmit, per package
pnpm lint             # ESLint, per package
pnpm build            # production builds of both apps
pnpm --filter @sums/app exec drizzle-kit generate --name <name>   # after changing apps/app/src/server/db/schema.ts
```

Run `pnpm test`, `pnpm typecheck` and `pnpm lint` before committing.

## Layout

- `packages/core` (`@sums/core/*`, pure TypeScript, no React/Next):
  - `model/` – Zod plan schema (`schema.ts`, `SCHEMA_VERSION`), parsing/migration (`parse.ts`), pure helpers (`ops.ts`: labels, effect sentences, reference-safe deletes).
  - `engine/calculate.ts` – the calculation engine. Every rule change needs a test; the golden tests in `calculate.test.ts` (hand-computed, derivation in the comment) must keep passing. `engine/project.ts` – savings growth projection.
  - `fixtures/` – synthetic reference plan (Person A / Person B, golden tests) and the demo plan (Alex & Sam).
  - `format.ts` (de-DE money/number formatting), `env.ts` (`env()` reads `SUMS_*`), `analytics-config.ts`, `links.ts` (URL contract between website and app), `brand-mark.ts`.
- `packages/ui` (`@sums/ui/*`): what both apps share – `logo.tsx`, `legal-links.tsx`, `analytics.ts` (cookieless PostHog client, per-browser opt-out), `relay.ts` (same-origin PostHog relay handlers), `styles/base.css` (design tokens, base layer) and `styles/shared.css`.
- `apps/app` (`@sums/app`) – the planner; the Docker image contains only this.
  - `src/lib/preview.ts` – read-only table documents for the "Vorschau" mode. Only what counts is shown; rows must add up to the closing total.
  - `src/lib/store/` – storage-agnostic logic: `version-tree.ts` (versions, undo/redo, coalescing); `memory.ts` implements its repo in memory.
  - `src/lib/backend/` – what the client talks to: `types.ts` (`Backend`, `AppConfig`), `http.ts` (server mode, the API routes), `local.ts` + `idb.ts` (local mode: the same store logic in the browser, persisted to IndexedDB, synced across tabs).
  - `src/lib/analytics/` – `events.ts` (typed event list, plan-diff events, pure and tested), `client.ts` (typed `track()` on top of `@sums/ui/analytics`).
  - `src/lib/backup.ts` – backup file format (the plan).
  - `src/server/` – SQLite repo (`plan-store.ts`, Drizzle in `db/`), runtime config (`config.ts`), password sessions (`auth.ts`, server secret) and the failed-login limit (`login-limit.ts`). Server-only.
  - `src/proxy.ts` – `/` → `/uebersicht`, password guard (only active with `SUMS_PASSWORD`).
  - `src/app/(app)/` – pages that work on the plan; their layout loads it (`components/plan-loader.tsx`). `src/app/(public)/` – login and the built-in privacy page (`/datenschutz`); they never load the plan.
  - `src/app/api/` – route handlers (plan, commit, replace, undo/redo, history, login/logout, analytics relay, health). In local mode they serve no data.
  - `src/components/` – client UI. `backend-context.tsx` provides `Backend` and `AppConfig`; `plan-provider.tsx` holds the plan, recalculates live and persists edits (debounced, coalesced). `welcome.tsx` is the start for a blank plan (`/uebersicht?beispiel=1` loads the demo); `onboarding/` holds the first-run guide, with steps and examples in `src/lib/onboarding.ts`. `views/` has one component per page. `ui/` is shadcn/ui.
  - `drizzle/` – SQL migrations, applied automatically on start.
- `apps/web` (`@sums/web`) – the public website (landing page, computed from the demo plan). Links into the app via `SUMS_APP_URL`; legal pages are the operator's own (`SUMS_IMPRINT_URL`, `SUMS_PRIVACY_URL`).

## Rules

- The whole plan is one JSON document. Changing its shape means bumping `SCHEMA_VERSION` and adding a migration in `packages/core/src/model/parse.ts`.
- Storage goes through `useBackend()`, never `fetch("/api/…")` directly, so local mode keeps working. Local mode promises that no plan data reaches the server; server-only features must be hidden there.
- Optional modules live in plan settings: `settings.commute` gates cars, office days, fuel prices and commute-fuel lines in the UI; `settings.splitMode` decides the pocket-money split.
- Edits go through `usePlan().update(mutator, { summary, coalesceKey })`. Use a `coalesceKey` for keystroke-level edits so typing becomes one version; write `summary` in German.
- Never delete versions. Restore creates a new version.
- The `simulations` SQLite table and IndexedDB store belong to a money-flow board that is not part of v1. Leave them untouched so boards from earlier installs survive.
- Analytics events go through a typed `track()` and are declared in the app's `AnalyticsEvents` or the website's `WebEvents`. Never put plan content in them (amounts, names, labels, notes): only types, schema field names, enum values and counts. Plan edits are tracked automatically from the diff in `update()`; add explicit events only for things that aren't plan edits. A new kind of data collection means updating `apps/app/src/app/(public)/datenschutz/page.tsx`.
- Text inputs spread `NO_AUTOFILL` (`apps/app/src/lib/no-autofill.ts`) so password managers leave budget fields alone.
- Custom dropdowns use `components/ui/select.tsx`; don't add native `<select>`. Color choices use `components/ui/color-picker.tsx`; don't add native `<input type="color">`.
- Design tokens live in `packages/ui/src/styles/base.css`; app component classes in `apps/app/src/app/globals.css` (`@layer components`), website classes in `apps/web/src/app/globals.css`. Reuse tokens for new pages.
- Test data must be synthetic. `local/`, `data/`, `*.db` are gitignored.

## Configuration

Server code and config files read settings through `env()` (`@sums/core/env`), never `process.env.SUMS_*` directly.

App:
- `SUMS_STORAGE` – `server` (default, SQLite) or `local` (IndexedDB in the browser).
- `SUMS_DB_PATH` – SQLite file (default `data/sums.db`).
- `SUMS_PASSWORD` – one shared password for the whole app. `SUMS_SESSION_SECRET` – key for session cookies; without it, server mode creates `session-secret` next to the database.
- `SUMS_APP_NAME` – display name (default "Sums", `appName()` in `src/server/config.ts`). Client code reads it from `useAppConfig().name`; never hard-code the name in UI text.
- `SUMS_IMPRINT_URL`, `SUMS_PRIVACY_URL` – links to the operator's Impressum and Datenschutz pages. Without a privacy URL, public installs link the built-in `/datenschutz`.
- `SUMS_HOSTING_PROVIDER` – hosting provider named on the built-in privacy page.
- `SUMS_POSTHOG_KEY`, `SUMS_POSTHOG_HOST` – cookieless PostHog analytics (off without a key; host defaults to the EU cloud).
- `SUMS_DEV_ORIGINS` – comma-separated hostnames allowed to load dev resources when the dev server is opened from another machine. Without it the HMR websocket is blocked and the app never hydrates: pages look fine but no button works.

Website (read at build time): `SUMS_APP_NAME`, `SUMS_APP_URL` (where the app runs), `SUMS_SOURCE_URL` (footer link to the source), `SUMS_IMPRINT_URL`, `SUMS_PRIVACY_URL`, `SUMS_POSTHOG_KEY`, `SUMS_POSTHOG_HOST`, `SUMS_DEV_ORIGINS`.

## Releases

`apps/app/package.json` holds the version shown in the app. To release: update it and `CHANGELOG.md`, merge, then tag `vX.Y.Z` on `main`. The `release` workflow publishes the multi-arch image to the GitHub Container Registry and creates the GitHub release.
