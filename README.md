# Sums

A household **budget planner**, not a spending tracker. Plan what comes in each month, what goes out (rent, contracts, insurance, subscriptions) and what you put aside, and see what is left. Then flip "what if" scenarios (parental leave, a new job, a bigger flat) and watch the numbers change before life does.

- **Scenarios**: switches that change amounts or turn items on and off, with their impact shown next to each one.
- **Fair split**: the free amount becomes pocket money per person (equal, by income, or not at all) up to a cap. The rest is surplus.
- **Yearly payments handled**: quarterly and yearly bills are saved for automatically, month by month.
- **Savings accounts and depots** with a growth projection, full **undo/redo and version history**.
- No bank connection, no account, no telemetry by default.

> The interface is in **German** (`de-DE`, amounts in €). Other languages may come later.

## Ways to use it

| | Public website | Self-hosted |
|---|---|---|
| Where the plan lives | In your browser (IndexedDB), on that device only | In a SQLite database on your server |
| Shared between devices | No (move it with a backup file) | Yes, every device that opens your installation |
| Setup | None | Docker, see below |

Both are the same app: `SUMS_STORAGE=local` keeps plans in the browser, the default (`server`) stores them in SQLite. A backup file moves a plan between them (*Einstellungen → Daten & Sicherung*).

## Self-hosting

You need Docker. Save [`docker-compose.yml`](docker-compose.yml), set a password in it, then:

```bash
docker compose up -d
```

Open `http://<your server>:3000`. Images exist for `linux/amd64` and `linux/arm64` (Raspberry Pi, most NAS boxes).

**Updating**: `docker compose pull && docker compose up -d`. Database changes are applied on start. The `:1` tag follows all 1.x releases; pin an exact version (`:1.0.0`) if you prefer to update by hand. Going back to an older version after an update is not supported, so take a backup first.

**Backups**: the plan lives in the `sums-data` volume (`/data` in the container). Either download a backup file in the app (*Einstellungen → Daten & Sicherung*), or copy the database while Sums is stopped:

```bash
docker compose stop && docker compose cp sums:/data ./sums-backup && docker compose start
```

**Security**: set `SUMS_PASSWORD` as soon as anyone but you can reach the port. If the installation is reachable from the internet, put it behind a reverse proxy with HTTPS (Caddy, Traefik, nginx) or keep it inside a VPN such as Tailscale or WireGuard. Failed logins are rate-limited per client address; behind a proxy, make sure it sets `X-Forwarded-For`.

**Limits**: one plan per installation, one shared password, no user accounts. Sums has to run at the root of a domain or port (not under a sub-path like `example.com/sums`).

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `SUMS_PASSWORD` | – | One shared password for the whole installation. |
| `SUMS_APP_NAME` | `Sums` | Name shown in the app, page titles and the installed app. |
| `SUMS_DB_PATH` | `/data/sums.db` (image) | SQLite file. |
| `SUMS_SESSION_SECRET` | generated | Key for login cookies. Without it, a random one is created next to the database on first start. |
| `SUMS_STORAGE` | `server` | `local` keeps every plan in the visitor's browser; the server then stores nothing. |
| `SUMS_IMPRINT_URL`, `SUMS_PRIVACY_URL` | – | Links to your legal notice and privacy policy (needed for public sites in Germany). Without a privacy URL, public installs link the built-in page at `/datenschutz`, which describes what the installation actually does. |
| `SUMS_HOSTING_PROVIDER` | – | Hosting provider named on the built-in privacy page. |
| `SUMS_POSTHOG_KEY`, `SUMS_POSTHOG_HOST` | – | Optional cookieless analytics with PostHog (see below). Off when unset. |

### Analytics

Off unless you set `SUMS_POSTHOG_KEY`; an installation never sends anything to the authors. When an operator turns it on, the browser sends usage events through a relay on the same origin (`/api/relay`) to their PostHog project, in cookieless mode: nothing is stored on the device, there is no session replay or autocapture, and events never contain plan content (amounts, names, labels). Visitors can turn it off for their browser (*Einstellungen → Daten & Sicherung*), and browsers sending Do Not Track or Global Privacy Control are never counted. Enable *Cookieless tracking* in the PostHog project, otherwise PostHog discards the events.

## Development

Requires Node 24 and pnpm (see `packageManager` in `package.json`).

```bash
pnpm install
pnpm dev          # the app on http://localhost:3000 (server mode)
pnpm dev:web      # the website on http://localhost:3001
pnpm test         # unit tests
pnpm typecheck && pnpm lint
```

`SUMS_STORAGE=local pnpm dev` runs the app in local mode.

| Folder | What |
|---|---|
| `apps/app` | The planner (Next.js). This is what the Docker image contains. |
| `apps/web` | The public website with the landing page. Not needed for self-hosting. |
| `packages/core` | Plan model, calculation engine, formatting, demo plan. Pure TypeScript. |
| `packages/ui` | Pieces both apps share: logo, design tokens, analytics client. |

[docs/PLAN.md](docs/PLAN.md) describes the domain model and the calculation rules; [AGENTS.md](AGENTS.md) the structure and conventions. Contributions are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[AGPL-3.0](LICENSE). You may use, change and host Sums freely; if you offer a modified version to others over a network, you have to publish your changes under the same license.
