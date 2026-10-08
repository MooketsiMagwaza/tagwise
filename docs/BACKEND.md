# Backend

A Rust workspace in `backend/`: five services and a shared crate, each
service with its own PostgreSQL database and migrations. The web app does
not call it yet (it uses its in-browser sample data); the services are the
foundation the app moves onto (TW-15).

| Crate | What it does | Port in the container |
| --- | --- | --- |
| `shared` | Config, errors, JWT auth with a Redis denylist, rate limiting, request IDs, Prometheus metrics, JSON logs, OpenTelemetry spans, the outbox | (library) |
| `identity` | Accounts, email and phone one-time codes, sessions, API keys, the staff admin console | 8080 |
| `register` | Workspaces and roles, sites, assets and custody, stock lines and movements, stock-takes, comments, activity | 8080 (8082 default outside Docker) |
| `notifications` | In-app inbox, preferences, push devices | 8080 |
| `media` | Presigned uploads for asset photos and attachments | 8080 |
| `ops` | Support tickets, the staff console's health, database and observability views | 8080 |

Where each crate came from is in `PROVENANCE.md`; what is finished and what
is scaffold is in `ARCHITECTURE.md`.

## Build and check

Needs Rust stable (1.80 or later; developed on 1.97).

```sh
cd backend
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace          # unit tests; database tests are ignored
```

CI runs the same three on every pull request.

Development builds carry no debug info (see the `[profile.dev]` section of
`backend/Cargo.toml`): it keeps `target/` around 1.5 GB instead of about
6 GB. Set `CARGO_PROFILE_DEV_DEBUG=true` to get it back when debugging.

## Database tests

Tests that need PostgreSQL are marked `#[ignore]` and say why. With the
compose stack's database running:

```sh
docker compose -f docker/compose.dev.yml up -d db
cd backend
TEST_DATABASE_URL=postgres://tagwise:tagwise@localhost:5453/tagwise_register \
  cargo test -p tagwise-register --test register_db -- --ignored --test-threads=1
```

They cover: stock never going below zero when ten requests issue at once,
a retried adjustment applying once, a stale asset edit coming back as a
conflict, another workspace getting "not found", and scan classification.
**They have not been run yet**: Docker was not running on the machine they
were written on.

## Running a service on its own

Each service reads its configuration from the environment (see its
`config.rs`). The compose file (`docker/compose.dev.yml`) is the reference
for a working set of values. A service refuses to start while migrations are
pending; run `<binary> migrate` first.

```sh
cargo run -p tagwise-register -- openapi   # prints the OpenAPI document, needs nothing
```
