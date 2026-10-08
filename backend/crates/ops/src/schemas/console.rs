//! The admin console's operational views.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::clients::stats_clients::{IdentityStats, RegisterStats};
use crate::repositories::audit_repository::AuditEntry;
use crate::services::database_service::{ConnectionRow, DatabaseInfo, RowsPage, TableRow};
use crate::services::observability_service::{
    Alerts, ContainerMemory, Health, Memory, Overview, ServiceHealth, Status, TicketCounts, Traffic,
};

/// Is a source set up, and could it be reached? `message` says why not.
#[derive(Debug, Serialize, ToSchema)]
pub struct StatusRes {
    pub configured: bool,
    pub reachable: bool,
    pub message: Option<String>,
}

impl From<Status> for StatusRes {
    fn from(s: Status) -> Self {
        Self {
            configured: s.configured,
            reachable: s.reachable,
            message: s.message,
        }
    }
}

// ── overview ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct UsersSection {
    pub status: StatusRes,
    pub data: Option<IdentityStats>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RegisterSection {
    pub status: StatusRes,
    pub data: Option<RegisterStats>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TrafficSection {
    pub status: StatusRes,
    pub requests_per_sec: Option<f64>,
    pub errors_per_sec: Option<f64>,
    /// Failed requests as a share of all requests (0 to 1); absent when there
    /// was no traffic to measure.
    pub error_ratio: Option<f64>,
}

impl From<Traffic> for TrafficSection {
    fn from(t: Traffic) -> Self {
        Self {
            status: t.status.into(),
            requests_per_sec: t.requests_per_sec,
            errors_per_sec: t.errors_per_sec,
            error_ratio: t.error_ratio,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TicketSection {
    pub open: i64,
    pub in_progress: i64,
    pub waiting: i64,
    pub resolved: i64,
}

impl From<TicketCounts> for TicketSection {
    fn from(t: TicketCounts) -> Self {
        Self {
            open: t.open,
            in_progress: t.in_progress,
            waiting: t.waiting,
            resolved: t.resolved,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OverviewRes {
    pub users: UsersSection,
    pub register: RegisterSection,
    pub traffic: TrafficSection,
    pub tickets: TicketSection,
    pub generated_at: DateTime<Utc>,
}

impl From<Overview> for OverviewRes {
    fn from(o: Overview) -> Self {
        Self {
            users: UsersSection {
                status: o.users.0.into(),
                data: o.users.1,
            },
            register: RegisterSection {
                status: o.register.0.into(),
                data: o.register.1,
            },
            traffic: o.traffic.into(),
            tickets: o.tickets.into(),
            generated_at: o.generated_at,
        }
    }
}

// ── health, memory, alerts ───────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct ServiceHealthRes {
    pub service: String,
    /// Whether Prometheus can scrape it; absent if Prometheus has no series.
    pub up: Option<bool>,
    pub database_up: Option<bool>,
    pub redis_up: Option<bool>,
    pub requests_per_sec: Option<f64>,
    pub error_ratio: Option<f64>,
    pub in_flight: Option<f64>,
}

impl From<ServiceHealth> for ServiceHealthRes {
    fn from(s: ServiceHealth) -> Self {
        Self {
            service: s.service,
            up: s.up,
            database_up: s.database_up,
            redis_up: s.redis_up,
            requests_per_sec: s.requests_per_sec,
            error_ratio: s.error_ratio,
            in_flight: s.in_flight,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct HealthRes {
    pub prometheus: StatusRes,
    pub services: Vec<ServiceHealthRes>,
}

impl From<Health> for HealthRes {
    fn from(h: Health) -> Self {
        Self {
            prometheus: h.prometheus.into(),
            services: h.services.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ContainerMemoryRes {
    pub name: String,
    pub used_bytes: f64,
    /// Absent when the container has no memory limit.
    pub limit_bytes: Option<f64>,
}

impl From<ContainerMemory> for ContainerMemoryRes {
    fn from(c: ContainerMemory) -> Self {
        Self {
            name: c.name,
            used_bytes: c.used_bytes,
            limit_bytes: c.limit_bytes,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MemoryRes {
    pub prometheus: StatusRes,
    pub containers: Vec<ContainerMemoryRes>,
}

impl From<Memory> for MemoryRes {
    fn from(m: Memory) -> Self {
        Self {
            prometheus: m.prometheus.into(),
            containers: m.containers.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AlertRes {
    pub name: String,
    pub severity: Option<String>,
    pub state: String,
    pub summary: Option<String>,
    pub started_at: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AlertsRes {
    pub grafana: StatusRes,
    pub alerts: Vec<AlertRes>,
    /// Where to open Grafana itself, if it is known.
    pub grafana_url: Option<String>,
}

impl From<Alerts> for AlertsRes {
    fn from(a: Alerts) -> Self {
        Self {
            grafana: a.grafana.into(),
            alerts: a
                .alerts
                .into_iter()
                .map(|x| AlertRes {
                    name: x.name,
                    severity: x.severity,
                    state: x.state,
                    summary: x.summary,
                    started_at: x.started_at,
                })
                .collect(),
            grafana_url: a.grafana_url,
        }
    }
}

// ── database viewer ──────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct DatabaseRes {
    pub name: String,
    pub reachable: bool,
    pub error: Option<String>,
    pub table_count: Option<i64>,
}

impl From<DatabaseInfo> for DatabaseRes {
    fn from(d: DatabaseInfo) -> Self {
        Self {
            name: d.name,
            reachable: d.reachable,
            error: d.error,
            table_count: d.table_count,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DatabasesRes {
    /// `false` when no database has been given to the viewer.
    pub configured: bool,
    pub databases: Vec<DatabaseRes>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TableRes {
    pub name: String,
    /// Postgres's own estimate; exact counts come with the rows.
    pub row_estimate: i64,
    pub size_bytes: i64,
}

impl From<TableRow> for TableRes {
    fn from(t: TableRow) -> Self {
        Self {
            name: t.name,
            row_estimate: t.row_estimate,
            size_bytes: t.size_bytes,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ColumnRes {
    pub name: String,
    pub data_type: String,
    /// The column holds a secret; its values are masked.
    pub redacted: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RowsRes {
    pub columns: Vec<ColumnRes>,
    #[schema(value_type = Vec<Vec<Object>>)]
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total: Option<i64>,
    pub limit: i64,
    pub offset: i64,
}

impl From<RowsPage> for RowsRes {
    fn from(p: RowsPage) -> Self {
        Self {
            columns: p
                .columns
                .into_iter()
                .map(|c| ColumnRes {
                    name: c.name,
                    data_type: c.data_type,
                    redacted: c.redacted,
                })
                .collect(),
            rows: p.rows,
            total: p.total,
            limit: p.limit,
            offset: p.offset,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ConnectionRes {
    pub pid: i32,
    pub database: Option<String>,
    pub user: Option<String>,
    pub application: Option<String>,
    pub client_addr: Option<String>,
    pub state: Option<String>,
    pub waiting_on: Option<String>,
    pub connected_at: Option<DateTime<Utc>>,
    pub query_started_at: Option<DateTime<Utc>>,
    /// The first 160 characters of the current or last statement.
    pub query: Option<String>,
}

impl From<ConnectionRow> for ConnectionRes {
    fn from(c: ConnectionRow) -> Self {
        Self {
            pid: c.pid,
            database: c.datname,
            user: c.usename,
            application: c.application_name.filter(|a| !a.is_empty()),
            client_addr: c.client_addr,
            state: c.state,
            waiting_on: c.wait_event_type,
            connected_at: c.backend_start,
            query_started_at: c.query_start,
            query: c.query.filter(|q| !q.is_empty()),
        }
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct TerminateReq {
    /// Why — 3 to 300 characters; kept in the audit log.
    #[validate(length(min = 1, max = 2000))]
    pub reason: String,
}

// ── audit log ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct OpsAuditEntryRes {
    pub id: Uuid,
    pub actor_account_id: Uuid,
    pub action: String,
    pub target: Option<String>,
    #[schema(value_type = Object)]
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

impl From<AuditEntry> for OpsAuditEntryRes {
    fn from(e: AuditEntry) -> Self {
        Self {
            id: e.id,
            actor_account_id: e.actor_account_id,
            action: e.action,
            target: e.target,
            metadata: e.metadata,
            created_at: e.created_at,
        }
    }
}
