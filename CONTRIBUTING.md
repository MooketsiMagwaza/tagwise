# Contributing

Tagwise is private and all rights are reserved; contributions are by
invitation of the owner. This page is how work is done here.

## Before you start

- Find or add the work order in `docs/WORK_ORDERS.md`. Every piece of work
  has one, and its state is kept honest: Not started, In progress, Done with
  the evidence, or Blocked with what it waits for. Update it in the same
  commit as the change.
- Read `ARCHITECTURE.md` for how the parts fit, and `docs/DESIGN.md` before
  touching the interface.

## Branches, commits and pull requests

- One branch per piece of work: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `test:`), small, one topic each, with the reason in the body.
- `main` holds merged work only; its history is never rewritten.
- A pull request says what changed, what was run (with the results), and
  what was not checked. It is merged with a merge commit, not a squash,
  once CI is green and the owner agrees.
- No attribution trailers in commits or pull requests.

## Checks

Run what applies before opening a pull request. CI runs all of them.

| Part | Commands |
| --- | --- |
| Web app | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |
| Everything | `npm run check:names` (no other product names in tracked files) |
| Backend | `cd backend && cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace` |
| Database tests | See `docs/BACKEND.md` (need PostgreSQL; ignored by default) |
| Docker | `docker compose -f docker/compose.dev.yml config --quiet` and `node docker/scripts/validate-compose.mjs` |
| Docs site | `cd docs-site && pnpm install && pnpm build` |

Commands that take minutes (cargo builds, image builds, installs) are best
run with their output going to a log file.

## Rules that are easy to break

- **Say only what was run.** Never write that something works (in code,
  docs, the interface, commits or pull requests) unless it was run. Name
  what was not checked.
- **Sample data is labelled as sample**, on screen and in docs. Simulated
  teammates always say they are simulated.
- **No secrets** in the repository: no `.env` files, keys or tokens. Never
  read someone else's `.env`.
- **Copied code is recorded.** Anything taken from the owner's other
  projects goes in `PROVENANCE.md`, with where it came from and what changed.
- **Screens use the data interface** (`src/data/repository.ts`), never
  storage or the network directly.
- **Design tokens only.** Components read `src/theme/tokens.css`; no
  hard-coded colours, sizes or durations.
- **Server rules match the app.** Roles and permissions are one table, in
  `src/data/permissions.ts` and in the register service; change both
  together.

## Decisions

Significant decisions are written down in `docs/adr/`, one short file each:
the context, the decision, and what it costs. Add one when a choice would
be expensive to reverse.
