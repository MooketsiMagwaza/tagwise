# Tagwise docs site

A [Fumadocs](https://fumadocs.dev) documentation site (Next.js 16, Fumadocs 16,
Tailwind CSS 4). Its pages are **generated** from the repository's Markdown by
`scripts/sync-content.mjs`, following an explicit list (`scripts/manifest.mjs`).
Edit the Markdown or the list, never `content/docs/` (generated and ignored by
git).

## Develop

```bash
pnpm install            # once (runs the fumadocs-mdx postinstall)
pnpm dev                # http://localhost:3010/docs (syncs content first)
```

Or through the development stack:
`docker compose -f docker/compose.dev.yml up -d --build`, then
<http://localhost:5290/docs>.

## Build

```bash
pnpm build && pnpm start
```

The Docker image (`docs-site/Dockerfile`, built with the repository root as
context) installs dependencies without lifecycle scripts, then syncs the
Markdown, generates the Fumadocs index and runs `next build` in standalone
mode.

## How it fits together

| Path | What it is |
| --- | --- |
| `scripts/manifest.mjs` | The only place that decides what is published and where |
| `scripts/sync-content.mjs` | Writes each listed Markdown file to `content/docs/**/*.mdx`, rewrites links (published files to their pages, screenshots to the site's copy, anything else to GitHub), mirrors `public/screens/` with a size manifest, writes the theme, then runs the API reference generator |
| `scripts/theme-tokens.mjs` | Turns the app's `src/theme/tokens.css` into `app/theme-tokens.css` (generated, ignored by git), so the site is light and dark exactly as the app is |
| `scripts/fetch-openapi.mjs` | Merges the five services' OpenAPI documents into `docs/reference/openapi.json` (committed). `pnpm openapi` asks each service binary through cargo; without `--from-source` it reads running services |
| `scripts/generate-api-reference.mjs` | Writes `content/docs/reference/**` from that snapshot: an overview and one page per tag |
| `scripts/check-links.mjs` | Fails on broken relative links in tracked Markdown |
| `app/(home)/page.tsx`, `components/`, `lib/` | The landing page; `lib/surfaces.ts` holds the app's and Grafana's addresses (`NEXT_PUBLIC_*`, set at build) |
| `app/api/search/route.ts` | Search (the gateway routes `/api/search` here) |

## What is published

| Source | Site page |
| --- | --- |
| `README.md` | `/docs` (Start here) |
| `ARCHITECTURE.md` | `/docs/architecture` |
| `docs/BACKEND.md` | `/docs/architecture/backend` |
| `PROVENANCE.md` | `/docs/architecture/provenance` |
| `docs/DEPLOY.md` | `/docs/operations` |
| `docs/OBSERVABILITY.md` | `/docs/operations/observability` |
| `docs/DESIGN.md` | `/docs/design-system` |
| `docs/reference/openapi.json` | `/docs/reference/**` |

Not published: `docs/WORK_ORDERS.md` and `CLAUDE.md`, which are working
records. A file under `docs/` is published only once it is added to the
manifest.

## Serving under the gateway

Pages live under `/docs`, so the gateway (`docker/nginx/gateway.dev.conf`)
passes `/docs` straight through, along with `/_next/*` and `/api/search`,
which Next.js serves from the root. No `basePath` is needed.
