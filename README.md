# Tagwise

A shared register for an organisation's assets and stock. Put a QR label on
each thing, scan it with any phone, import the spreadsheet you already have,
count a site with several people at once, and see every site on a map. Built
for schools, clinics, offices and stores that keep their register in Excel
today.

**Status: prototype.** The app runs entirely in the browser with a
fictional sample organisation: no sign-in and no real data yet. Behind it
sits a backend (five Rust services, a Docker stack with a gateway,
observability and a documentation site) that is tested in CI and starts as
a Docker development stack, but is not yet connected to the app. What is
real and what is scaffold is listed below, in
[ARCHITECTURE.md](ARCHITECTURE.md) and in
[docs/WORK_ORDERS.md](docs/WORK_ORDERS.md).

## Screens

Every major surface, light and dark, captured from the running app with
`npm run screenshots` (desktop 1440 × 900; phone 390 × 844 at 2x).

| | Light | Dark |
| --- | --- | --- |
| The public page | ![The public page: the headline, the Open the demo button and a large capture of the home screen in a window frame](public/screens/landing-light.webp) | ![The public page in the dark theme: the headline, the demo button and the home screen capture](public/screens/landing-dark.webp) |
| Home | ![Home: items overdue and due back, low stock, a stock-take in progress, assets by site and recent activity](public/screens/dashboard-light.webp) | ![Home in the dark theme, with the floating theme button in the bottom right corner](public/screens/dashboard-dark.webp) |
| The register | ![The register: saved views as a segmented control, search, filter and column buttons, and a table of 126 assets](public/screens/register-light.webp) | ![The register in the dark theme, with status pills and custodians in the table](public/screens/register-dark.webp) |
| An asset and its QR label | ![An asset page: details, who has it and that it is overdue, its QR label with a print button, and comments](public/screens/asset-light.webp) | ![An asset page in the dark theme; the QR label stays black on white so it scans](public/screens/asset-dark.webp) |
| Scan | ![Scan: a scanned asset with check-in, move and count actions, and sample codes to try](public/screens/scan-light.webp) | ![Scan in the dark theme, after scanning a laptop's tag](public/screens/scan-dark.webp) |
| Labels | ![Labels: seven assets chosen and their QR labels laid out three across on an A4 sheet](public/screens/labels-light.webp) | ![Labels in the dark theme; the A4 sheet stays white](public/screens/labels-dark.webp) |
| The import check | ![The import check: problem rows marked cell by cell, with counts of rows ready, rows with errors and rows already in the register](public/screens/import-light.webp) | ![The import check in the dark theme, showing the Problems view](public/screens/import-dark.webp) |
| A stock-take | ![A stock-take board: 14 of 22 found, progress by room, a live feed of scans and the items still to find](public/screens/count-light.webp) | ![The stock-take board in the dark theme](public/screens/count-dark.webp) |
| Sites | ![Six sample sites on a map of Botswana, with a list of each site's assets, items out and stock](public/screens/sites-light.webp) | ![The sites map in the dark theme, with a dark basemap](public/screens/sites-dark.webp) |
| People and roles | ![People and roles: the sample member you act as, and the members with their roles and last activity](public/screens/people-light.webp) | ![People and roles in the dark theme, with the settings sections as a segmented control](public/screens/people-dark.webp) |

On a phone:

| The public page | Home | Register | Scan |
| --- | --- | --- | --- |
| ![The public page on a phone: the headline, the demo button and the home screen in a phone frame](public/screens/phone-landing-light.webp) | ![Home on a phone, with the floating tab bar and the theme button just above it on the left](public/screens/phone-home-light.webp) | ![The register on a phone: saved views as a segmented control and assets as cards](public/screens/phone-register-light.webp) | ![A scan result on a phone: the asset with its actions](public/screens/phone-scan-light.webp) |
| ![The public page on a phone, dark](public/screens/phone-landing-dark.webp) | ![Home on a phone, dark](public/screens/phone-home-dark.webp) | ![The register on a phone, dark](public/screens/phone-register-dark.webp) | ![A scan result on a phone, dark](public/screens/phone-scan-dark.webp) |

The screenshots are of the sample workspace: the trust, the people and every
figure are invented, and the app says so on screen. Each capture is saved as
WebP (used here and on the public page) and as JPEG (mirrored by the docs
site); every file is under 150 KB.

## What is real, and what is demo

| Area | State |
| --- | --- |
| Register (assets and stock): saved views, filters, sort, columns, search, bulk selection | Works in the browser |
| Asset and stock pages: edit, check out and in, issue and receive, comments, history | Works in the browser |
| Shared editing | A stale edit is caught (version check) and you choose which version to keep. Shown working between two tabs |
| Live updates and presence | Real between tabs of the same browser (BroadcastChannel). Across devices it needs the app connected to the server, which is not done yet |
| Simulated teammates | Demo only: sample members shown as present (dashed ring) and an optional simulated counter in stock-takes. Labelled on screen and can be switched off |
| Scanning | Typed codes and handheld scanners work. Camera decoding (BarcodeDetector, with ZXing as the fallback) is built but **not yet tested on a real phone** |
| QR labels | A4 sheets of 18 and single labels render with working QR codes. **Not yet printed and scanned from paper** |
| Excel and CSV import | Works with the practice register: column matching, row checks, duplicates, problem report |
| Excel and CSV export | Built, with a formula guard. The files were not opened in a spreadsheet program during testing |
| Stock-takes | Works in the browser (tried with the simulated counter, typed scans, repeats and unknown codes). Updates between tabs use the same mechanism that was shown working for edits |
| Sites map | Works with an internet connection (OpenFreeMap tiles) |
| Roles | Owner, admin, editor, auditor, viewer. Enforced in the interface only; the register service enforces the same table, but the app does not use it yet |
| Sign-in, accounts, email | Not built. You pick a sample member to act as |
| Data storage | This browser's local storage only. Nothing is sent anywhere |

## The backend: real and scaffold

| Part | State |
| --- | --- |
| Services (shared, identity, register, notifications, media, ops) | **Tested**: formatting, clippy with warnings as errors, and 51 unit tests pass in CI |
| Register rules: stock never below zero under concurrent issues, idempotent adjustments, version conflicts on edits, workspace isolation, scan classification | **Tested**: 5 tests against PostgreSQL pass in CI |
| API reference | **Real**: generated from the services' own OpenAPI documents (53 paths, 67 operations); a CI guard keeps the committed snapshot in step with the routes |
| Documentation site (`docs-site/`) | **Builds** in CI; not deployed |
| Docker development stack and gateway (`docker/`) | **Runs**: built and started with `docker compose -f docker/compose.dev.yml up -d --build` on 25 Oct 2026. On 26 Oct 2026 `docker ps` showed all ten containers healthy (PostgreSQL, Redis, the five services, the docs site, the web container and the gateway), the five migration jobs had exited with 0, and the gateway's `/gw-health` answered 200. A development stack only; the app does not call it yet |
| Observability: Prometheus, Grafana, OpenTelemetry collector, Tempo | **Configuration**: renders; never started; no alert rules |
| Identity and register running together | **Run once, outside containers**: on 9 Oct 2026 both ran from their binaries against the compose file's PostgreSQL and Redis, and `scripts/smoke-identity-register.mjs` passed 14 of 14 checks: sign-in by one-time code, register accepting identity's token, another account getting 404, and a signed-out token refused by register at once |
| Notifications, media and ops running; sending email, SMS and push | **Scaffold**: never run; sending needs provider keys |
| The app talking to the API | **Scaffold**: `HttpRepository` (tested against a fake server) is used only when the app is built with `VITE_API_URL`; there is no sign-in, so it has no token |
| Register's outbox, notifications from register, live updates between devices | **Not wired** |
| Staging and production | **None** |

Where the backend came from, measured line by line, is in
[PROVENANCE.md](PROVENANCE.md).

## Run it

Needs Node 20 or later (CI uses 22).

```sh
npm ci
npm run dev        # http://localhost:5280
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run preview` | Serve `dist/` on port 5281 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run check:names` | Name gate: fails if another of the owner's product names appears in the code |
| `npm run screenshots` | Captures the screenshots above from a running dev server, using the Edge already installed |
| `npm run check:openapi` | Checks that the API snapshot matches the services' routes |

The backend's commands (build, lint, tests, database tests) are in
[docs/BACKEND.md](docs/BACKEND.md); the documentation site's in
[docs-site/README.md](docs-site/README.md).

## How it is built

- **React 18, TypeScript, Vite.** A static single-page app; any static host can serve `dist/`.
- **Data layer behind an interface** (`src/data/repository.ts`). Screens call only that interface. `LocalRepository` implements it on localStorage with a seeded sample workspace; `HttpRepository` (a scaffold) implements part of it over the register API.
- **Design tokens** in `src/theme/tokens.css`; components in `src/ui` and `src/app` read only those tokens. Light and dark are separate palettes; reduced motion and reduced transparency are honoured.
- **Route-level code splitting**, so the map, the spreadsheet library and the scanner fallback load only on the pages that need them.
- **Backend** (`backend/`): a Rust workspace of five services (axum, sqlx, PostgreSQL, Redis), each with its own database and migrations. See [ARCHITECTURE.md](ARCHITECTURE.md).
- **Docker** (`docker/`): a development stack behind an nginx gateway, and an observability stack.
- **Decisions** are recorded in [docs/adr](docs/adr/README.md); security in [SECURITY.md](SECURITY.md); how to contribute in [CONTRIBUTING.md](CONTRIBUTING.md).

## Deploy

Set up for Vercel. No environment variables are needed. See
[docs/DEPLOY.md](docs/DEPLOY.md).

## Dependencies

| Package | Why | Licence |
| --- | --- | --- |
| react, react-dom | Interface | MIT |
| lucide-react | Icons | ISC |
| qrcode | QR codes on labels | MIT |
| jsbarcode | EAN-13 and Code 128 barcodes | MIT |
| @zxing/library | Barcode decoding where the browser has no BarcodeDetector | Apache-2.0 |
| xlsx (SheetJS Community Edition 0.20.3, from cdn.sheetjs.com) | Reading and writing Excel files | Apache-2.0 |
| maplibre-gl | The sites map | BSD-3-Clause |
| @fontsource-variable/schibsted-grotesk | Display typeface, self-hosted | OFL-1.1 |

Development only: TypeScript, Vite, Vitest, ESLint and its plugins, jsdom,
playwright-core (screenshots). The backend's crates are listed in
`backend/Cargo.toml` and the documentation site's packages in
`docs-site/package.json`. Map tiles come from
[OpenFreeMap](https://openfreemap.org) (free, no key), with data ©
OpenStreetMap contributors.

## Licence

Copyright (c) 2026 Mooketsi Vincent Magwaza. **All rights reserved.** There is
no licence file on purpose: no permission is granted to use, copy, modify or
distribute this code. Where the code came from is recorded in
[PROVENANCE.md](PROVENANCE.md).
