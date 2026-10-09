# Provenance

Where Tagwise's code came from. Everything here is owned by Mooketsi Vincent
Magwaza. Tagwise started with a fresh git history on 7 October 2026; no
history was carried over from any other repository.

## Started from StockLink (owner-owned)

StockLink is the owner's private product: Rust services, a React web app, a
documentation site, a desktop shell and a marketing site. Two things were
taken from it, from the `master` branch:

1. **7 October 2026: parts of its web app** (`web/src`), restyled for
   Tagwise. The front end is otherwise Tagwise's own.
2. **8 and 9 October 2026: its foundation** (TW-19, on the owner's
   instruction to bring in the whole foundation, scaffolds included): the
   backend workspace, the Docker and gateway set-up, the observability
   stack, the documentation site and the OpenAPI coverage guard.

### Measured reuse

Measured on 9 October 2026 by comparing every tracked Tagwise file with its
StockLink counterpart, after undoing the renames (StockLink to Tagwise,
commerce to register, `SL_` to `TW_`), using `git diff --no-index --numstat`.
"Kept" lines are unchanged from StockLink; "written" lines are new or
changed for Tagwise; a file with no counterpart is written in full. Lock
files and the generated OpenAPI snapshot are left out (4 files, 19,122
lines). The figures were taken just before this file and the README were
rewritten, so the documentation row is a few dozen lines low.

| Area | Files | From StockLink | Lines | Kept | Written | Written share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| backend: shared | 18 | 18 | 2,312 | 2,280 | 32 | 1% |
| backend: identity | 44 | 44 | 4,623 | 4,589 | 34 | 1% |
| backend: notifications | 25 | 25 | 1,407 | 1,405 | 2 | 0% |
| backend: media | 22 | 22 | 1,132 | 1,125 | 7 | 1% |
| backend: ops | 34 | 34 | 3,970 | 3,954 | 16 | 0% |
| backend: register | 19 | 14 | 2,248 | 488 | 1,760 | 78% |
| backend: workspace files | 3 | 3 | 148 | 138 | 10 | 7% |
| docker and gateway | 10 | 10 | 1,413 | 1,352 | 61 | 4% |
| observability | 9 | 6 | 598 | 500 | 98 | 16% |
| docs site | 32 | 32 | 1,812 | 1,513 | 299 | 17% |
| scripts | 4 | 2 | 418 | 284 | 134 | 32% |
| web app (`src/`) | 140 | 72 | 13,463 | 2,833 | 10,630 | 79% |
| web app (root config) | 11 | 4 | 242 | 77 | 165 | 68% |
| documentation | 16 | 0 | 897 | 0 | 897 | 100% |
| CI and Dependabot | 2 | 0 | 173 | 0 | 173 | 100% |
| **Total** | **389** | **286** | **34,856** | **20,538** | **14,318** | **41%** |

So 59% of Tagwise's hand-written lines are StockLink's, almost all of it the
platform services and their infrastructure. The parts that make Tagwise what
it is (the web app, the register service, the documentation and CI) are
mostly new. "Kept" counts surviving lines only: what was removed from
StockLink (for example identity's onboarding, about 760 lines, and all of
commerce's orders, payments and delivery) does not appear in the table.

### What came from where

| Tagwise path | From StockLink | What changed |
| --- | --- | --- |
| `backend/crates/shared` | `backend/crates/shared` | Renamed. Each request's span now carries its request id |
| `backend/crates/identity` | `backend/crates/identity` | Renamed; warehouse, store and carrier onboarding removed (routes, tables, services); platform roles reduced to member and admin |
| `backend/crates/notifications`, `media` | the same crates | Renamed |
| `backend/crates/ops` | `backend/crates/ops` | Renamed; reads register figures instead of orders |
| `backend/crates/register` | `backend/crates/commerce` (scaffolding only) | Kept: entry point (with "refuse to start with pending migrations"), config, state, health and metrics, notifications client, the stock rules. New: the workspace, asset, stock, stock-take, comment, activity and saved-view domain, its migration, routes, OpenAPI and tests. Cart, checkout, orders, payments, receipts, bulk pooling and delivery were not brought |
| `backend/Cargo.toml`, `Dockerfile`, `.dockerignore` | the same files | Renamed; register in place of commerce; development builds without debug info |
| `docker/compose.dev.yml`, `init-databases.sql`, `nginx/*`, `scripts/validate-compose.mjs` | the same paths | Renamed; ports moved; marketing site removed; gateway routes `/api/v1/workspaces` to register |
| `docker/scripts/rolling-update.mjs` | `scripts/rolling-update.mjs` | Renamed |
| `docker/web/Dockerfile`, `docker/web/nginx.conf` | `web/Dockerfile`, `web/nginx.conf` | Rewritten to build Tagwise's app from the repository root |
| `docker/observability/*` | the same paths | Renamed, ports moved; OpenTelemetry collector, Tempo and a Tempo datasource added |
| `docs-site/*` | `docs-site/*` | Theme from Tagwise's tokens, Tagwise screenshots, link rewriting, a new landing page and API overview, a new manifest |
| `docs-site/scripts/theme-tokens.mjs` | `scripts/theme-tokens.mjs` | Rewritten for Tagwise's single token file |
| `scripts/openapi-coverage.mjs` and its test | the same paths | Service list (register in place of commerce) |
| `src/ui/*` (Avatar, Banner, Barcode, Button, Callout, Card, Clickable, CommandPalette, ConfirmDialog, Divider, EmptyState, Field, IconBadge, InfoTip, Layout, List, Modal, Page, Pill, Popover, PrintPortal, QrCode, RadioList, Segmented, Skeleton, Sparkline, Steps, Switch, Table, Text, Toast, VisuallyHidden) | `web/src/ui/*` | Restyled for Tagwise (new tokens, translucent cards, ink primary action, display face on titles). Button gained `sm`, `ghost` and `ButtonLink`; Pill gained a dot and a brand tone; Avatar gained a colour and a presence ring; Text gained `mono`. Unused components left out |
| `src/theme/appearance.ts`, `base.css`, `index.ts` | `web/src/theme/*` | Accent choices replaced by table density; storage key renamed; canvas wash added |
| `src/lib/router.tsx`, `src/lib/toast.tsx` | `web/src/lib/router.ts`, `toast.tsx` | Router: event renamed, support-page tracking removed, `Link` and `isActive` added. Toast: imports only |
| `src/app/scan/Scanner.tsx` | `web/src/ui/Scanner/Scanner.tsx` | jsQR fallback replaced with ZXing; continuous scanning, repeat guard, torch, secure-context check added |
| `eslint.config.js`, `tsconfig.json`, `vite.config.ts`, `index.html` | `web/` files of the same names | Rewritten; the shape is kept |

### StockLink's tree, and what Tagwise has of it

| StockLink | Files, lines | In Tagwise |
| --- | --- | --- |
| `backend/crates/shared`, `identity`, `notifications`, `media`, `ops` | 147, 14,200 | Yes, renamed (identity trimmed) |
| `backend/crates/commerce` | 64, 9,540 | Replaced by `register`, which keeps its scaffolding |
| `backend/` workspace files and its own CI workflow | 6, 586 | Workspace files yes; the CI is replaced by Tagwise's (which also runs the database tests on PostgreSQL) |
| `docker/` (compose, gateway, observability, compose guard) | 13, 1,786 | Yes, plus the collector and Tempo |
| `docs-site/` | 31, 1,833 | Yes, adapted |
| `scripts/` (OpenAPI coverage, rolling update, theme tokens) | 4, 492 | Yes, the theme script rewritten |
| `web/src` (the StockLink app) | 215, 16,242 | No: Tagwise keeps its own front end (owner's instruction). Only the components listed above |
| `web/` root (build config, screenshots tool) | 28, 2,553 | Build config only, rewritten |
| `docs/` (StockLink's own documents) | 12, 3,301 | No: Tagwise writes its own |
| `marketing-site/` | 29, 1,137 | No: Tagwise's landing page is part of its app |
| `desktop/` (Tauri shell) | 13, 746 | No |
| Staging, production and demo compose files | none in StockLink | Not available to bring |

Later pull requests that copy more StockLink code add a row here in the same
commit.

## New in Tagwise

Everything not listed above, including:

- the web app's screens, data layer, importer, labels, map, stock-takes and
  the `HttpRepository` scaffold;
- the register service's domain, migration and tests;
- the design tokens (`src/theme/tokens.css`), logo and favicon;
- the name gate, CI workflow, Dependabot configuration and Vercel config;
- all documentation (`docs/`, `ARCHITECTURE.md`, `SECURITY.md`,
  `CONTRIBUTING.md`, the decision records).

## Design inspiration (not copied)

The "soft glass" direction and the "fewer things per screen" rule come from
the owner's design principles for another of his products. Tagwise has its
own palette (slate, ink and tag amber), its own display face (Schibsted
Grotesk) and its own layout. No token values or components were copied from
that product.

## Third-party packages

Listed with their licences in the README. None of their source is vendored
into this repository; they are installed from npm, crates.io and Docker Hub.
