# Architecture

Tagwise has two halves that are not connected yet:

1. **The web app** (`src/`): a React single-page app that works today, on its
   own, with sample data kept in the browser. This is what is deployed.
2. **The backend** (`backend/`, `docker/`): five Rust services behind an
   nginx gateway, with PostgreSQL, Redis and an observability stack. It
   compiles and its unit tests pass; it has not been run as a whole.

Joining them is TW-15: the app gets a second implementation of its data
interface that calls the API instead of the browser's storage.

```
browser --> nginx gateway (localhost:5290 in development)
              |-- /                               web: the static build of src/
              |-- /api/v1/auth, /me, /admin       identity
              |-- /api/v1/workspaces              register
              |-- /api/v1/notifications, devices  notifications
              |-- /api/v1/media                   media
              |-- /api/v1/support, admin/tickets  ops
              `-- /docs                           docs site

identity, register, notifications, media, ops
   |-- PostgreSQL: one database each (tagwise_identity, tagwise_register, ...)
   `-- Redis, shared: signed-out token denylist and rate limits
```

## The web app

| Part | Where | Notes |
| --- | --- | --- |
| Screens | `src/screens`, `src/app` | Read data only through the repository interface |
| Data interface | `src/data/repository.ts` | The one seam between screens and storage |
| Browser storage | `src/data/local.ts` (`LocalRepository`) | localStorage, seeded with a fictional organisation |
| Live updates | `src/data/live.ts` | BroadcastChannel between tabs of one browser |
| Roles | `src/data/permissions.ts` | Owner, admin, editor, auditor, viewer; the register service uses the same table |
| Theme | `src/theme/tokens.css` | Every colour, size and duration; the docs site reuses it |

## The services

Each service is its own binary and its own crate, owns one PostgreSQL
database and its migrations, and refuses to start while a migration is
pending. All of them share `backend/crates/shared`.

| Service | Owns | State |
| --- | --- | --- |
| identity | Accounts, sign-in by one-time code (email or SMS), sessions and refresh tokens, API keys, staff accounts and the audit log | Carried over from the owner's earlier platform and trimmed; unit tests pass |
| register | Workspaces and memberships, people, sites and places, assets, stock lines and movements, stock-takes and scans, comments, activity, saved views | New for Tagwise, on the earlier platform's service scaffolding; 4 unit tests pass, 5 database tests written but not run |
| notifications | In-app inbox, preferences, push devices (FCM) | Carried over; nothing sends to it yet |
| media | Presigned upload and download URLs for attachments | Carried over |
| ops | Support tickets; the staff console's views of service health, database figures and alerts (from Prometheus and Grafana) | Carried over; register figures replace order figures |

### How they talk

- **Authentication** is checked in every service, locally: identity signs a
  JWT with a secret all services share, and each service verifies it. A
  signed-out token goes on a Redis denylist that every service reads, so a
  logout takes effect everywhere at once.
- **Service to service** calls use `/internal/*` routes over the private
  Docker network, guarded by a shared `X-Internal-Token`. The gateway never
  routes `/internal/*`. Today: notifications and ops call identity; ops
  calls register and notifications.
- **Rate limiting** is Redis-backed and shared (120 requests a minute per
  client by default).

### Rules the register service enforces

- A workspace's data is visible only to its members. Another workspace's id
  returns 404, not 403, so ids cannot be probed.
- Roles are checked on the server with the same table as the web app.
- Stock never goes below zero: a check constraint and a conditional update,
  so two people issuing the last item at once cannot both succeed.
- Adjustments carry an `Idempotency-Key`; a retried request applies once.
- Asset edits carry the version they were based on; a stale edit gets 409
  with the current asset, the same conflict the web app already shows.

## Scaffold, not wired

These exist as code or configuration but do nothing yet:

| Piece | What is missing |
| --- | --- |
| The web app calling the API | `HttpRepository` (TW-15); the app still uses browser storage |
| Register's outbox (`domain_outbox` table) | Nothing writes to it and no publisher runs |
| Register's notifications client | Held in the service's state, never called |
| Realtime between devices | No websocket or server-sent events; the app's live updates are between tabs only |
| Email and SMS sending | Identity's Resend and Africa's Talking clients need keys; never run |
| Push notifications | FCM client needs credentials; never run |
| Staging and production compose files | Only the development stack exists |
| Alerting | Grafana has a dashboard but no alert rules |

## Running it

- Web app: `npm ci && npm run dev` (see README.md).
- Backend checks: see `docs/BACKEND.md`.
- Whole stack: `docker compose -f docker/compose.dev.yml up -d --build`
  (not yet tried; see TW-21 in the work-order register).
- Metrics and traces: `docs/OBSERVABILITY.md`.

## Repository layout

| Path | What |
| --- | --- |
| `src/` | The web app |
| `backend/` | Rust workspace: `crates/shared` and the five services |
| `docker/` | Development compose file, gateway, web container, observability stack |
| `docs-site/` | Documentation site (Fumadocs), built from these Markdown files and the services' OpenAPI documents |
| `docs/` | Backend, deploy, design and observability notes; the work-order register |
| `scripts/` | The name gate and screenshot capture |
