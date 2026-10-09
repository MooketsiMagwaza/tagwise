# Observability

What the backend reports about itself, where it goes, and what is wired
versus only configured. The observability stack has never been started. On
9 October 2026 identity and register ran outside containers against the
development PostgreSQL and Redis, which showed the request id, health and
log lines below working; the rest is code and configuration that was
compiled or rendered, not observed.

## In the services (code, compiled and unit-tested)

All five services get these from the shared crate
(`backend/crates/shared`; where it came from is in `PROVENANCE.md`):

| Signal | How | State |
| --- | --- | --- |
| Request IDs | `x-request-id` is set on every request (a UUID if the caller sent none) and returned on the response (`tower_http` request-id layers in `shared::middleware`) | Wired |
| Structured logs | `tracing` with a JSON formatter when `LOG_JSON=true` (the default in production-like environments). Every response writes one INFO line inside the request's span, with method, path, request id, status and latency | Seen working on 9 Oct 2026, for example `request{method=POST path=/v1/workspaces request_id=41ea6062-…}: finished processing request latency=16 ms status=201`; dev compose uses plain text |
| Metrics | `GET /metrics` on each service: HTTP request counts and durations by route and status, requests in flight, rate-limited requests, and `tagwise_up`, `tagwise_dependency_up` (database, Redis) and `tagwise_build_info` | Wired |
| Traces | OpenTelemetry spans exported over OTLP when `OTEL_ENABLED=true`, to `OTEL_EXPORTER_OTLP_ENDPOINT` | Wired, **off by default** |
| Health | `/health/live` (process only) and `/health/ready` (database and Redis) | Wired; used by the compose health checks |

## The stack (`docker/observability`, configuration only)

```sh
docker compose -f docker/compose.dev.yml up -d --build      # first: creates the network
docker compose -f docker/observability/docker-compose.observability.yml up -d
```

| Container | Job | Address |
| --- | --- | --- |
| Prometheus | Scrapes `/metrics` from identity, register, notifications, media, ops, and cAdvisor | <http://localhost:9096> |
| Grafana | Provisioned Prometheus and Tempo datasources and the "Tagwise — API & Health" dashboard (carried over, renamed) | <http://localhost:3029> |
| cAdvisor | Container memory and CPU | internal |
| OpenTelemetry collector | Receives OTLP on 4317 and 4318, forwards to Tempo (new for Tagwise) | internal |
| Tempo | Stores traces locally for 48 hours (new for Tagwise) | internal, read by Grafana |

To send traces, start both stacks with `TW_DEV_OTEL_ENABLED=true`.

The ops service's staff console reads service health and container memory
from Prometheus and firing alerts from Grafana (`PROMETHEUS_URL`,
`GRAFANA_URL`, `GRAFANA_TOKEN` in the dev compose file).

## Not wired yet

- **Never run.** The observability stack has not started, so no
  dashboard, scrape or trace has been seen.
- **No alert rules.** Grafana has a dashboard but no provisioned alerts, so
  the ops console will say alerts are not set up.
- **No log aggregation.** Logs go to each container's stdout; there is no
  Loki or similar.
- **No traces from the web app.** Only the services emit spans.
- **No trace dashboard.** Tempo is a datasource; there is no saved view
  that links a request ID to its trace.

## Checks that do run

- `docker compose -f docker/observability/docker-compose.observability.yml config --quiet` exits 0 (CI renders it).
- The services' metrics and health code compiles and the shared crate's unit tests pass (`cargo test --workspace`).
