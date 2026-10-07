# Tagwise

A shared register for an organisation's assets and stock: QR labels, scanning
in the browser, stock-takes run together, Excel and CSV import, and sites on
a map. For schools, clinics, offices and stores that keep their register in a
spreadsheet today.

**Status: early prototype.** See [docs/WORK_ORDERS.md](docs/WORK_ORDERS.md)
for what is built and what is not.

## Run it

Needs Node 20 or later (CI uses 22).

```sh
npm ci
npm run dev        # http://localhost:5280
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run preview` | Serve the built `dist/` on port 5281 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no output |
| `npm test` | Unit tests (Vitest) |
| `npm run check:names` | Name gate: fails if another product's name appears in the code |

## Deploy

Set up for Vercel; see [docs/DEPLOY.md](docs/DEPLOY.md). No environment
variables are needed.

## Licence

Copyright (c) 2026 Mooketsi Vincent Magwaza. **All rights reserved.** There is
no licence file on purpose: no permission is granted to use, copy, modify or
distribute this code. Where the code came from is recorded in
[PROVENANCE.md](PROVENANCE.md).
