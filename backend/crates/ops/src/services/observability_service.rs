//! What the admin console watches: users, orders and demand (from the services
//! that own them), and service health, traffic, container memory and firing
//! alerts (from Prometheus and Grafana).
//!
//! Each source is reported with its own status. A source that isn't set up says
//! "not configured"; one that is set up but unreachable says why. Nothing is
//! ever filled in with an invented figure.

use std::collections::HashMap;

use chrono::{DateTime, Utc};

use crate::clients::grafana_client::GrafanaAlert;
use crate::clients::prometheus_client::Sample;
use crate::clients::stats_clients::{CommerceStats, IdentityStats};
use crate::clients::{GrafanaClient, PrometheusClient, StatsClients};
use crate::repositories::TicketRepository;
use tagwise_shared::errors::AppResult;

/// The scrape jobs the health view looks for (see docker/observability).
pub const SERVICES: &[&str] = &["identity", "commerce", "notifications", "media", "ops"];

/// Is a source set up, and if so, could we reach it?
#[derive(Debug, Clone)]
pub struct Status {
    pub configured: bool,
    pub reachable: bool,
    pub message: Option<String>,
}

impl Status {
    pub fn ok() -> Self {
        Self {
            configured: true,
            reachable: true,
            message: None,
        }
    }
    pub fn not_configured(message: &str) -> Self {
        Self {
            configured: false,
            reachable: false,
            message: Some(message.to_string()),
        }
    }
    pub fn unreachable(message: String) -> Self {
        Self {
            configured: true,
            reachable: false,
            message: Some(message),
        }
    }
}

pub struct Traffic {
    pub status: Status,
    pub requests_per_sec: Option<f64>,
    pub errors_per_sec: Option<f64>,
    pub error_ratio: Option<f64>,
}

pub struct TicketCounts {
    pub open: i64,
    pub in_progress: i64,
    pub waiting: i64,
    pub resolved: i64,
}

pub struct Overview {
    pub users: (Status, Option<IdentityStats>),
    pub commerce: (Status, Option<CommerceStats>),
    pub traffic: Traffic,
    pub tickets: TicketCounts,
    pub generated_at: DateTime<Utc>,
}

pub struct ServiceHealth {
    pub service: String,
    pub up: Option<bool>,
    pub database_up: Option<bool>,
    pub redis_up: Option<bool>,
    pub requests_per_sec: Option<f64>,
    pub error_ratio: Option<f64>,
    pub in_flight: Option<f64>,
}

pub struct Health {
    pub prometheus: Status,
    pub services: Vec<ServiceHealth>,
}

pub struct ContainerMemory {
    pub name: String,
    pub used_bytes: f64,
    pub limit_bytes: Option<f64>,
}

pub struct Memory {
    pub prometheus: Status,
    pub containers: Vec<ContainerMemory>,
}

pub struct Alerts {
    pub grafana: Status,
    pub alerts: Vec<GrafanaAlert>,
    pub grafana_url: Option<String>,
}

const NO_PROMETHEUS: &str = "Prometheus isn't configured. Set PROMETHEUS_URL on the ops service.";

/// The share of requests that failed, or `None` when there were no requests
/// (a ratio of nothing isn't 0%).
pub fn error_ratio(requests_per_sec: f64, errors_per_sec: f64) -> Option<f64> {
    (requests_per_sec > 0.0).then(|| (errors_per_sec / requests_per_sec).clamp(0.0, 1.0))
}

fn by_label(samples: &[Sample], label: &str) -> HashMap<String, f64> {
    samples
        .iter()
        .filter_map(|s| Some((s.label(label)?.to_string(), s.value)))
        .collect()
}

#[derive(Clone)]
pub struct ObservabilityService {
    stats: StatsClients,
    prometheus: Option<PrometheusClient>,
    grafana: Option<GrafanaClient>,
    grafana_url: Option<String>,
    tickets: TicketRepository,
}

impl ObservabilityService {
    pub fn new(
        stats: StatsClients,
        prometheus: Option<PrometheusClient>,
        grafana: Option<GrafanaClient>,
        grafana_url: Option<String>,
        tickets: TicketRepository,
    ) -> Self {
        Self {
            stats,
            prometheus,
            grafana,
            grafana_url,
            tickets,
        }
    }

    pub async fn overview(&self) -> AppResult<Overview> {
        let users = match self.stats.identity().await {
            Ok(s) => (Status::ok(), Some(s)),
            Err(e) => (Status::unreachable(e), None),
        };
        let commerce = match self.stats.commerce().await {
            Ok(s) => (Status::ok(), Some(s)),
            Err(e) => (Status::unreachable(e), None),
        };
        let counts = self.tickets.counts_by_status().await?;
        let n = |s: &str| {
            counts
                .iter()
                .find(|c| c.status == s)
                .map(|c| c.count)
                .unwrap_or(0)
        };
        Ok(Overview {
            users,
            commerce,
            traffic: self.traffic().await,
            tickets: TicketCounts {
                open: n("open"),
                in_progress: n("in_progress"),
                waiting: n("waiting"),
                resolved: n("resolved"),
            },
            generated_at: Utc::now(),
        })
    }

    /// Requests and failures across every service over the last five minutes.
    async fn traffic(&self) -> Traffic {
        let Some(prom) = &self.prometheus else {
            return Traffic {
                status: Status::not_configured(NO_PROMETHEUS),
                requests_per_sec: None,
                errors_per_sec: None,
                error_ratio: None,
            };
        };
        let requests = prom
            .query("sum(rate(tagwise_http_requests_total[5m]))")
            .await;
        let errors = prom
            .query("sum(rate(tagwise_http_responses_total{class=\"5xx\"}[5m]))")
            .await;
        match (requests, errors) {
            (Ok(r), Ok(e)) => {
                let rps = r.first().map(|s| s.value);
                let eps = e.first().map(|s| s.value).or(rps.map(|_| 0.0));
                Traffic {
                    status: Status::ok(),
                    requests_per_sec: rps,
                    errors_per_sec: eps,
                    error_ratio: rps.zip(eps).and_then(|(r, e)| error_ratio(r, e)),
                }
            }
            (Err(e), _) | (_, Err(e)) => Traffic {
                status: Status::unreachable(e),
                requests_per_sec: None,
                errors_per_sec: None,
                error_ratio: None,
            },
        }
    }

    pub async fn health(&self) -> Health {
        let Some(prom) = &self.prometheus else {
            return Health {
                prometheus: Status::not_configured(NO_PROMETHEUS),
                services: Vec::new(),
            };
        };
        let up = prom
            .query("up{job=~\"identity|commerce|notifications|media|ops\"}")
            .await;
        let up = match up {
            Ok(u) => u,
            Err(e) => {
                return Health {
                    prometheus: Status::unreachable(e),
                    services: Vec::new(),
                }
            }
        };
        // The rest are best-effort: a missing series is `None`, not zero.
        let db = prom
            .query("tagwise_dependency_up{dependency=\"database\"}")
            .await
            .unwrap_or_default();
        let redis = prom
            .query("tagwise_dependency_up{dependency=\"redis\"}")
            .await
            .unwrap_or_default();
        let rps = prom
            .query("sum by (job) (rate(tagwise_http_requests_total[5m]))")
            .await
            .unwrap_or_default();
        let eps = prom
            .query("sum by (job) (rate(tagwise_http_responses_total{class=\"5xx\"}[5m]))")
            .await
            .unwrap_or_default();
        let in_flight = prom
            .query("sum by (job) (tagwise_http_requests_in_flight)")
            .await
            .unwrap_or_default();

        let (up, db, redis) = (
            by_label(&up, "job"),
            by_label(&db, "job"),
            by_label(&redis, "job"),
        );
        let (rps, eps, in_flight) = (
            by_label(&rps, "job"),
            by_label(&eps, "job"),
            by_label(&in_flight, "job"),
        );

        let services = SERVICES
            .iter()
            .map(|name| {
                let r = rps.get(*name).copied();
                ServiceHealth {
                    service: (*name).to_string(),
                    up: up.get(*name).map(|v| *v >= 1.0),
                    database_up: db.get(*name).map(|v| *v >= 1.0),
                    redis_up: redis.get(*name).map(|v| *v >= 1.0),
                    requests_per_sec: r,
                    error_ratio: r
                        .and_then(|r| error_ratio(r, eps.get(*name).copied().unwrap_or(0.0))),
                    in_flight: in_flight.get(*name).copied(),
                }
            })
            .collect();
        Health {
            prometheus: Status::ok(),
            services,
        }
    }

    pub async fn memory(&self) -> Memory {
        let Some(prom) = &self.prometheus else {
            return Memory {
                prometheus: Status::not_configured(NO_PROMETHEUS),
                containers: Vec::new(),
            };
        };
        let used = match prom
            .query("container_memory_working_set_bytes{name=~\"tagwise.+\"}")
            .await
        {
            Ok(u) => u,
            Err(e) => {
                return Memory {
                    prometheus: Status::unreachable(e),
                    containers: Vec::new(),
                }
            }
        };
        if used.is_empty() {
            return Memory {
                prometheus: Status::unreachable(
                    "Prometheus has no container memory series. Is cAdvisor running and being scraped?".into(),
                ),
                containers: Vec::new(),
            };
        }
        let limits = prom
            .query("container_spec_memory_limit_bytes{name=~\"tagwise.+\"}")
            .await
            .unwrap_or_default();
        let limits = by_label(&limits, "name");
        let mut containers: Vec<ContainerMemory> = used
            .iter()
            .filter_map(|s| {
                let name = s.label("name")?.to_string();
                // cAdvisor reports 0 for "no limit".
                let limit_bytes = limits.get(&name).copied().filter(|l| *l > 0.0);
                Some(ContainerMemory {
                    name,
                    used_bytes: s.value,
                    limit_bytes,
                })
            })
            .collect();
        containers.sort_by(|a, b| b.used_bytes.total_cmp(&a.used_bytes));
        Memory {
            prometheus: Status::ok(),
            containers,
        }
    }

    pub async fn alerts(&self) -> Alerts {
        let Some(grafana) = &self.grafana else {
            return Alerts {
                grafana: Status::not_configured("Grafana alerts aren't set up. Set GRAFANA_URL and GRAFANA_TOKEN on the ops service."),
                alerts: Vec::new(),
                grafana_url: self.grafana_url.clone(),
            };
        };
        match grafana.firing_alerts().await {
            Ok(alerts) => Alerts {
                grafana: Status::ok(),
                alerts,
                grafana_url: self.grafana_url.clone(),
            },
            Err(e) => Alerts {
                grafana: Status::unreachable(e),
                alerts: Vec::new(),
                grafana_url: self.grafana_url.clone(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_error_ratio_needs_traffic_and_stays_between_zero_and_one() {
        assert_eq!(
            error_ratio(0.0, 0.0),
            None,
            "no requests means no ratio, not 0%"
        );
        assert_eq!(error_ratio(10.0, 1.0), Some(0.1));
        assert_eq!(error_ratio(1.0, 5.0), Some(1.0));
    }
}
