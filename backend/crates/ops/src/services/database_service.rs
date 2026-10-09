//! The admin console's database viewer and connection list.
//!
//! **Read-only by construction.** Every connection the viewer opens tells
//! Postgres to refuse writes (`default_transaction_read_only`) and to give up
//! on slow statements; the login should also be a read-only role (see
//! `VIEWER_DATABASES`). Table and column names are never taken from the caller
//! as SQL: a table must appear in the database's own catalogue before it is
//! read, and is then quoted. Secret columns are masked (see `redact`). Looking
//! at a table, and ending a connection, are written to the audit log.

use std::collections::HashMap;
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::PgPool;
use uuid::Uuid;

use crate::repositories::AuditRepository;
use crate::services::redact::{is_secret_name, redact_row, REDACTED};
use tagwise_shared::database::DbPool;
use tagwise_shared::errors::{AppError, AppResult};

const MAX_PAGE: i64 = 100;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct TableRow {
    pub name: String,
    pub row_estimate: i64,
    pub size_bytes: i64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct ColumnRow {
    column_name: String,
    data_type: String,
}

#[derive(Debug, Clone)]
pub struct Column {
    pub name: String,
    pub data_type: String,
    pub redacted: bool,
}

pub struct RowsPage {
    pub columns: Vec<Column>,
    pub rows: Vec<Vec<Value>>,
    /// The exact row count, or `None` if counting was too slow.
    pub total: Option<i64>,
    pub limit: i64,
    pub offset: i64,
}

pub struct DatabaseInfo {
    pub name: String,
    pub reachable: bool,
    pub error: Option<String>,
    pub table_count: Option<i64>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ConnectionRow {
    pub pid: i32,
    pub datname: Option<String>,
    pub usename: Option<String>,
    pub application_name: Option<String>,
    pub client_addr: Option<String>,
    pub state: Option<String>,
    pub wait_event_type: Option<String>,
    pub backend_start: Option<DateTime<Utc>>,
    pub query_start: Option<DateTime<Utc>>,
    pub query: Option<String>,
}

/// `"name"` with any `"` doubled — only ever applied to a name that already
/// exists in the catalogue.
fn quote_ident(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

/// Keeps a requested page inside the limits.
pub fn clamp_page(limit: Option<i64>, offset: Option<i64>) -> (i64, i64) {
    (
        limit.unwrap_or(25).clamp(1, MAX_PAGE),
        offset.unwrap_or(0).max(0),
    )
}

#[derive(Clone)]
pub struct DatabaseService {
    pools: HashMap<String, PgPool>,
    /// Ops's own database connection, used to list connections on the server.
    own: DbPool,
    audit: AuditRepository,
}

impl DatabaseService {
    pub fn new(configured: &[(String, String)], own: DbPool, audit: AuditRepository) -> Self {
        let mut pools = HashMap::new();
        for (name, url) in configured {
            let options: PgConnectOptions = match url.parse() {
                Ok(o) => o,
                Err(_) => {
                    tracing::warn!(database = %name, "VIEWER_DATABASES entry has an unreadable URL; skipped");
                    continue;
                }
            };
            let pool = PgPoolOptions::new()
                .max_connections(2)
                .acquire_timeout(Duration::from_secs(5))
                .after_connect(|conn, _meta| {
                    Box::pin(async move {
                        sqlx::query("SET default_transaction_read_only = on")
                            .execute(&mut *conn)
                            .await?;
                        sqlx::query("SET statement_timeout = '5s'")
                            .execute(&mut *conn)
                            .await?;
                        sqlx::query("SET application_name = 'tagwise-ops-viewer'")
                            .execute(&mut *conn)
                            .await?;
                        Ok(())
                    })
                })
                .connect_lazy_with(options);
            pools.insert(name.clone(), pool);
        }
        Self { pools, own, audit }
    }

    pub fn configured(&self) -> bool {
        !self.pools.is_empty()
    }

    fn pool(&self, database: &str) -> AppResult<&PgPool> {
        self.pools
            .get(database)
            .ok_or(AppError::NotFound("database"))
    }

    // ── databases and tables ─────────────────────────────────────────────

    pub async fn databases(&self) -> Vec<DatabaseInfo> {
        let mut names: Vec<&String> = self.pools.keys().collect();
        names.sort();
        let mut out = Vec::with_capacity(names.len());
        for name in names {
            let count: Result<i64, _> = sqlx::query_scalar(
                "SELECT COUNT(*)::bigint FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace \
                 WHERE n.nspname = 'public' AND c.relkind = 'r'",
            )
            .fetch_one(&self.pools[name])
            .await;
            out.push(match count {
                Ok(n) => DatabaseInfo {
                    name: name.clone(),
                    reachable: true,
                    error: None,
                    table_count: Some(n),
                },
                Err(_) => DatabaseInfo {
                    name: name.clone(),
                    reachable: false,
                    error: Some("couldn't connect to this database".into()),
                    table_count: None,
                },
            });
        }
        out
    }

    pub async fn tables(&self, database: &str) -> AppResult<Vec<TableRow>> {
        let pool = self.pool(database)?;
        sqlx::query_as::<_, TableRow>(
            "SELECT c.relname::text AS name, GREATEST(c.reltuples, 0)::bigint AS row_estimate, \
                    pg_total_relation_size(c.oid)::bigint AS size_bytes \
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace \
             WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname",
        )
        .fetch_all(pool)
        .await
        .map_err(|_| AppError::ServiceUnavailable("that database"))
    }

    // ── rows ─────────────────────────────────────────────────────────────

    /// One page of a table, secrets masked. The table must exist in the
    /// database's own catalogue. The view is recorded in the audit log.
    pub async fn rows(
        &self,
        actor: Uuid,
        database: &str,
        table: &str,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> AppResult<RowsPage> {
        let pool = self.pool(database)?;
        let tables = self.tables(database).await?;
        if !tables.iter().any(|t| t.name == table) {
            return Err(AppError::NotFound("table"));
        }
        let (limit, offset) = clamp_page(limit, offset);

        let columns: Vec<Column> = sqlx::query_as::<_, ColumnRow>(
            "SELECT column_name::text, data_type::text FROM information_schema.columns \
             WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
        )
        .bind(table)
        .fetch_all(pool)
        .await
        .map_err(|_| AppError::ServiceUnavailable("that database"))?
        .into_iter()
        .map(|c| Column {
            redacted: is_secret_name(&c.column_name),
            name: c.column_name,
            data_type: c.data_type,
        })
        .collect();

        let quoted = quote_ident(table);
        let sql = format!("SELECT to_jsonb(t) FROM (SELECT * FROM public.{quoted} ORDER BY 1 LIMIT $1 OFFSET $2) t");
        let raw: Vec<Value> = sqlx::query_scalar(&sql)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
            .map_err(|_| AppError::ServiceUnavailable("that table"))?;

        let rows = raw
            .into_iter()
            .map(|mut row| {
                redact_row(&mut row);
                columns
                    .iter()
                    .map(|c| row.get(&c.name).cloned().unwrap_or(Value::Null))
                    .collect()
            })
            .collect();

        let total =
            sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*)::bigint FROM public.{quoted}"))
                .fetch_one(pool)
                .await
                .ok();

        self.audit
            .record(
                actor,
                "db.table.view",
                Some(&format!("{database}.{table}")),
                json!({ "limit": limit, "offset": offset, "masked_columns": columns.iter().filter(|c| c.redacted).map(|c| c.name.clone()).collect::<Vec<_>>() }),
            )
            .await?;

        Ok(RowsPage {
            columns,
            rows,
            total,
            limit,
            offset,
        })
    }

    // ── connections ──────────────────────────────────────────────────────

    /// Connections to Tagwise's databases on the server, except this one.
    pub async fn connections(&self) -> AppResult<Vec<ConnectionRow>> {
        Ok(sqlx::query_as::<_, ConnectionRow>(
            "SELECT pid, datname::text, usename::text, application_name, client_addr::text, state, \
                    wait_event_type, backend_start, query_start, left(query, 160) AS query \
             FROM pg_stat_activity \
             WHERE datname LIKE 'tagwise\\_%' AND pid <> pg_backend_pid() AND backend_type = 'client backend' \
             ORDER BY datname, backend_start",
        )
        .fetch_all(self.own.read())
        .await?)
    }

    /// Ends one connection. It must be one the list shows, and a reason is
    /// required; both the request and its outcome are audited.
    pub async fn terminate(&self, actor: Uuid, pid: i32, reason: &str) -> AppResult<()> {
        let reason = reason.trim();
        if !(3..=300).contains(&reason.chars().count()) {
            return Err(AppError::Validation {
                field: "reason".into(),
                message: "say why, in 3 to 300 characters".into(),
            });
        }
        let conn = self
            .connections()
            .await?
            .into_iter()
            .find(|c| c.pid == pid)
            .ok_or(AppError::NotFound("connection"))?;
        let ended: bool = sqlx::query_scalar("SELECT pg_terminate_backend($1)")
            .bind(pid)
            .fetch_one(self.own.write())
            .await?;
        self.audit
            .record(
                actor,
                "db.connection.terminate",
                Some(&format!("pid {pid}")),
                json!({
                    "database": conn.datname,
                    "user": conn.usename,
                    "application": conn.application_name,
                    "reason": reason,
                    "ended": ended,
                }),
            )
            .await?;
        if !ended {
            return Err(AppError::Conflict(
                "Postgres wouldn't end that connection".into(),
            ));
        }
        Ok(())
    }
}

/// What a masked value looks like on screen (for tests and the UI's key).
pub fn masked_placeholder() -> &'static str {
    REDACTED
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifiers_are_quoted_and_quotes_doubled() {
        assert_eq!(quote_ident("orders"), "\"orders\"");
        assert_eq!(quote_ident("we\"ird"), "\"we\"\"ird\"");
    }

    #[test]
    fn a_page_is_kept_within_limits() {
        assert_eq!(clamp_page(None, None), (25, 0));
        assert_eq!(clamp_page(Some(10_000), Some(-5)), (100, 0));
        assert_eq!(clamp_page(Some(0), Some(40)), (1, 40));
    }
}
