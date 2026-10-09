# Tagwise — API & health monitoring

A self-contained **Prometheus + Grafana** stack for the Rust API. Prometheus
scrapes the API's `GET /metrics`; Grafana is provisioned with the datasource and
the **"Tagwise — API & Health"** dashboard, so there is no manual setup.

| Component | Image | Notes |
| --- | --- | --- |
| Prometheus | `prom/prometheus:v3.14.0` | Prometheus 3 rejects scrapes without a valid `Content-Type`; the API sends `text/plain; version=0.0.4; charset=utf-8` (`backend/src/controllers/health.rs`) |
| Grafana | `grafana/grafana:13.2.1` | The provisioned dashboard uses only React panels (`stat`, `timeseries`, `gauge`), so Grafana 12's Angular removal does not affect it; the datasource has a fixed UID (`tagwise-prometheus`) |

Both containers' health checks probe `127.0.0.1`, not `localhost` (see
`docker/README.md` for why).

## What the API exposes

`GET /metrics` (Prometheus text format, unauthenticated — never publish it; the
gateways return 404 for it):

| Metric | Type | Meaning |
| --- | --- | --- |
| `tagwise_http_requests_total` | counter | all HTTP requests |
| `tagwise_http_requests_in_flight` | gauge | requests currently being handled |
| `tagwise_http_responses_total{class="2xx\|4xx\|5xx"}` | counter | responses by status class |
| `tagwise_rate_limited_requests_total` | counter | requests rejected by the rate limiter |
| `tagwise_up` | gauge | `1` whenever the process answers a scrape |
| `tagwise_dependency_up{dependency="database\|redis"}` | gauge | readiness ping result, refreshed each scrape |
| `tagwise_build_info{version="…"}` | gauge | build version (value always `1`) |

## Run it

```bash
docker compose -f docker/observability/docker-compose.observability.yml up -d
```

- Grafana: <http://localhost:3029> — `admin` / `admin` locally (override with
  `GF_SECURITY_ADMIN_PASSWORD`). The dashboard is under **Dashboards →
  Tagwise**.
- Prometheus: <http://localhost:9096>

## Grafana and the admin console

Two dashboards, two jobs. **Grafana** is the metrics tool: time series, gauges,
alert rules. Tagwise's own **admin console** (`/admin` in the app) is where staff
run the platform: accounts and sessions, orders and demand, database views, support
requests — and it reads this Grafana's firing alerts (`GRAFANA_URL` and
`GRAFANA_TOKEN` on the `ops` service) so they show up beside everything else.

They link to each other. The console's **Open Grafana** button goes here; the
provisioned dashboard has a **Tagwise admin console** link (and one to the docs)
in its header, pointing at the development gateway (`http://localhost:5190`). For
another environment, change the two `url` values under `links` in
`grafana/dashboards/tagwise-api-health.json`. Grafana opens on that dashboard
and follows the system light/dark setting (`GF_USERS_DEFAULT_THEME`); its
look is otherwise Grafana's own — it isn't restyled to match the app.

The console **pulls** firing alerts from Grafana's API. A Grafana contact point
that pushes alerts to the console as they fire is not built.

### Pointing at the API

Set `TAGWISE_API_TARGET` (default `host.docker.internal:8080`):

| Where the API runs | `TAGWISE_API_TARGET` |
| --- | --- |
| `cargo run` on the host | `host.docker.internal:8080` (default) |
| `docker/compose.dev.yml` (API published on `HF_DEV_API_PORT`, default 8280) | `host.docker.internal:8280` |
| Same Docker network as the API | `api:8080`, after `docker network connect tagwise-dev-app tagwise-prometheus` |

```bash
TAGWISE_API_TARGET=host.docker.internal:8280 \
  docker compose -f docker/observability/docker-compose.observability.yml up -d
```

Staging and production bind the API's direct port to `127.0.0.1`, so run
Prometheus on the same host or network rather than scraping across machines.

## Linking from other tools

Tagwise's admin console (WO-04, WO-10) is expected to link to this
dashboard through a non-secret `ADMIN_GRAFANA_URL` setting, and Grafana
alerts should go to an on-call channel once one exists. Neither the admin
console nor an operations runbook exists yet in this repository — this
section will point at real docs once WO-10 adds them, rather than at paths
that do not exist.

## Production notes

- Set a real `GF_SECURITY_ADMIN_PASSWORD`, terminate TLS at the proxy, and keep
  both `/metrics` and Grafana off the public internet (allowlist the scrape
  source; put Grafana behind SSO).
- `--storage.tsdb.retention.time=15d` — raise it or add remote-write for
  long-term storage.
- Alerting: add Prometheus alert rules (`tagwise_up == 0`,
  `tagwise_dependency_up == 0`, a high 5xx ratio) and wire Grafana contact
  points. Alert rules and any Kubernetes deployment manifests are WO-10 work;
  none exist in this repository yet.
- Upgrading: Prometheus 3 no longer adds default ports to scrape targets, so
  always include the port in `TAGWISE_API_TARGET`. Check the Prometheus
  migration guide and Grafana release notes before future major upgrades.
