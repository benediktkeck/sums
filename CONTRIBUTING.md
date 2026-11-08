# Contributing

Thanks for helping. Sums is a small project run in spare time, so a short note before a large change saves both sides work: open an issue first for new features or bigger refactors. Bug fixes and small improvements can go straight to a pull request.

## Ground rules

- **Never use real household data.** Not in tests, fixtures, screenshots or issues. Make numbers up.
- The UI is German (`de-DE`); code, comments, commits and issues are English.
- Every change to the calculation engine (`packages/core/src/engine`) needs a test. The golden tests in `calculate.test.ts` must keep passing; if a rule change is intended, update the hand calculation in the test comment too.
- Everything must work in both storage modes (server and local).
- Changing the plan's shape means bumping `SCHEMA_VERSION` and adding a migration in `packages/core/src/model/parse.ts`.

[AGENTS.md](AGENTS.md) has the full list of conventions and where things live.

## Before you open a pull request

```bash
pnpm typecheck && pnpm lint && pnpm test
```

By contributing you agree that your contribution is licensed under the [AGPL-3.0](LICENSE), like the rest of the project.
