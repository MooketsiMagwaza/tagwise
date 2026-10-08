# Work orders

The register of work on Tagwise. Each entry has an honest state:

- **Not started**
- **In progress**
- **Done**, with the evidence (what was run and what it showed)
- **Blocked**, with what it waits for

> **Standing instruction from the owner (7 October 2026):** every new
> instruction from the owner gets a work-order entry here, in the same commit
> as the change it asks for.

## Owner's brief (7 October 2026)

Build Tagwise, the replacement for StockLink in the portfolio (the earlier
working name was Thoto): a shared register for an organisation's assets and
stock with QR and barcode scanning in the browser, a Notion-like shared
workspace, Excel and CSV import and export, stock-takes several people can
run at once, sites on a map and printable QR labels. Priorities, in order:
appearance, then deployment, then working features. A browser-only front end
with seeded sample data behind a data-layer interface is the fastest path;
the backend comes later. Private repository, fresh history, all rights
reserved, merge commits only, no attribution trailers.

## Register

| # | Work order | State | Evidence or blocker |
| --- | --- | --- | --- |
| TW-01 | Repository, scaffold, CI and Vercel config | **Done** | Private repository created. `npm run typecheck`, `npm run lint` (0 errors), `npm test` (5 router tests pass), `npm run build` and `npm run check:names` all ran clean locally on 7 Oct 2026. The name gate was shown to fail on a deliberate break (a file containing a forbidden name, exit 1) and pass once it was removed. |
| TW-02 | Design system: tokens, light and dark, components, accessibility basics | In progress | Tokens and restyled components are in. Contrast figures for the palette were computed with a script (in the `tokens.css` header). Not yet reviewed on real screens. |
| TW-03 | Data layer: repository interface, browser storage, seeded sample workspace, live updates between tabs | **Done** | `src/data`: a `Repository` interface and a `LocalRepository` on localStorage, seeded with a fictional trust (6 sites, 24 rooms, 126 assets, 49 stock lines, 16 sample people). 12 unit tests pass (`npm test`, 8 Oct 2026): deterministic seed, unique tags, valid EAN-13 check digits, filters and search, a stale edit returns a conflict, label URLs resolve, stock cannot go below zero, count scans classify found/repeat/unknown, import skips duplicates. Cross-tab updates use BroadcastChannel; not yet exercised in a browser. |
| TW-04 | App shell (sidebar, top bar, phone navigation) and dashboard | **Done** | Viewed in the browser pane on 8 Oct 2026 against `npm run dev`: sidebar, glass top bar, Ctrl K search, presence avatars (simulated, dashed) and the dashboard in dark at desktop width and light at 375 px with the floating tab bar. No console errors. Pages not built yet show an honest "not built yet" card. |
| TW-05 | Register table: saved views, filters, sorting, columns; item detail with comments and history | Not started | |
| TW-06 | Scanning: camera with BarcodeDetector and a ZXing fallback, manual entry | Not started | |
| TW-07 | Printable QR labels | Not started | |
| TW-08 | Excel and CSV import wizard (mapping, validation preview, duplicates, error report) and export | Not started | |
| TW-09 | Stock-takes that several people run at once | Not started | |
| TW-10 | Sites on a map | Not started | |
| TW-11 | Activity feed, settings, members and roles | Not started | |
| TW-12 | Landing page | Not started | |
| TW-13 | Deploy to Vercel | **Blocked** | Needs the owner to import the private repository in Vercel (no Vercel login is available to the assistant). Steps in [DEPLOY.md](DEPLOY.md). |
| TW-14 | Real screenshots in the README | Not started | |
| TW-15 | Connect the web app to the Rust API (replace browser storage) | Not started | Waits for the backend work in WO-008 (portfolio work orders). |
| TW-16 | Review and make the repository public | Not started | Owner decision. |
