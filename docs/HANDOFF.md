# Tagwise: hand-off

Written on 26 October 2026 so that someone who has never seen the repository can carry on. Where this
file and the code disagree, the code is right: fix this file. The owner is Mooketsi Vincent Magwaza
(GitHub `MooketsiMagwaza`). The cross-project hand-off (all repositories, accounts, decisions waiting on
the owner) is `HANDOFF.md` in the private `portfolio-work-orders` repository.

## What Tagwise is

A shared register for an organisation's assets and stock, for schools, clinics, offices and stores that
keep it in a spreadsheet: QR labels, scanning in the browser, Excel and CSV import, stock-takes counted
by several people at once, and a map of sites. The repository is public (since 25 October 2026), all
rights reserved, no licence file.

## What is real and what is not

| Part | State |
| --- | --- |
| Web app (`src/`, React 18, TypeScript, Vite) | Works in a browser on a **seeded, invented sample workspace** ("Morula Community Trust"). Data lives in the browser behind `src/data/repository.ts`. Look: flat Apple-style UI, no gradients, a floating theme button. |
| Public page at `/` | A product page (hero with a real screenshot, tiles, feature rows, architecture diagram, FAQ). No customers, testimonials, numbers or prices, on purpose. |
| Backend (`backend/`, Rust workspace) | Five services (identity, register, notifications, media, ops) plus a shared crate, a database and migrations each. Built, linted and unit-tested in CI; the register's database tests (stock never below zero, idempotent retries, workspace isolation) run in CI on PostgreSQL. |
| Gateway and stack (`docker/`) | `docker/compose.dev.yml`: Postgres 15, Redis 7, migration jobs, the five services, the docs site, the web container, an nginx gateway. Ran healthy on 25 and 26 October 2026. |
| Observability | OpenTelemetry, Prometheus, Grafana, Tempo (`docker/observability/`, `docs/OBSERVABILITY.md`). The observability compose file has **not** been run. |
| Docs site (`docs-site/`, Fumadocs) | Builds in CI (27 pages). OpenAPI reference generated from the services. |
| **App to services connection** | **Not built (TW-21).** The app does not call the services. `HttpRepository` is a scaffold. There is no sign-in screen yet. |
| Deployment | **Not deployed.** `vercel.json` exists; importing the repository into Vercel needs the owner's login. |
| Camera scanning, label printing | Never tried on real phones or on paper. |
| Accessibility | No screen-reader or automated audit (TW-18). |

## Run it

```sh
npm ci
npm run dev                  # http://localhost:5280
npm run lint && npm run typecheck && npm test && npm run build && npm run check:names
cd backend && cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace
docker compose -f docker/compose.dev.yml up -d --build      # gateway on localhost:5290, docs on localhost:3021
docker compose -f docker/compose.dev.yml down               # stop it (add -v to delete its databases)
```

`docs/BACKEND.md` has the database-test instructions, `docs/DEPLOY.md` the deploy steps,
`docs/OBSERVABILITY.md` the monitoring setup, `ARCHITECTURE.md` what is finished and what is scaffold.

## CI

Five jobs on every pull request and push to `main`: web (lint, type-check, tests, build, name gate),
backend (fmt, clippy, test), compose files render and pass the guard, docs site builds, register
database tests on PostgreSQL. All five passed on `main` on 26 October 2026. Dependabot is on; about
twenty of its pull requests were open and unmerged on that date (triage them one at a time).

## Design rules (do not drift)

- The **app** is Apple-like: system font first, large titles, grouped cards on a flat system
  background (`#f2f2f7` by day, black at night), hairline borders, one accent blue, flat tinted
  buttons, segmented controls, bottom-sheet dialogs. **No gradients, no glass washes, no glow.** Blur
  only on bars, the tab bar, sheets and the floating theme button. Check with
  `grep -rniE "(linear|radial|conic)-gradient" src` (it should find nothing).
- The **public page** takes layout inspiration from large software companies' product pages: inspiration
  only, no copied text, logos or imagery, no implied connection.
- The theme button is a floating round button, never in a top bar.
- Rules and tokens: `docs/DESIGN.md`, `src/theme/tokens.css` (its header has the measured contrast).

## Pictures

`npm run screenshots` (with `npm run dev` running) writes 28 captures to `public/screens/` (WebP and
JPEG, desktop 1440 x 900 and phone 780 x 1688, Day and Night). The README grid and the docs site use
them. The portfolio and the profile README use copies: see the cross-project hand-off, section 7.

## What to do next

1. Connect the app to the services behind `HttpRepository`, add sign-in (TW-21), keep the sample
   workspace as the demo.
2. Deploy (Vercel) and add the live link to the README, the portfolio and the profile.
3. Try scanning and printed labels on real phones and paper; run an accessibility audit (TW-18).
4. Run the observability compose file and record the evidence (TW-22).
5. Get the shared platform code (copied from the owner's other products, see `PROVENANCE.md`; 59 % of
   hand-written lines were kept) reviewed by someone independent, now that it is public.
6. Triage Dependabot.

## Rules for working here

Read `CLAUDE.md`. In short: conventional commits, one branch per piece, merge commits, **no
attribution trailers**, keep `docs/WORK_ORDERS.md` current with honest states, label sample data, never
commit secrets or `.env` files, and never claim something works unless it was run.
