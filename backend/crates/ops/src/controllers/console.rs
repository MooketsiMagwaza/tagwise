//! The admin console's operational views: overview, health, memory, alerts, the
//! database viewer, database connections and the ops audit log. Staff only
//! (the [`AdminUser`] extractor says so in each signature).

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use tagwise_shared::auth::AdminUser;
use tagwise_shared::errors::AppResult;
use tagwise_shared::utils::validation::ValidatedJson;

use crate::schemas::console::{
    AlertsRes, ConnectionRes, DatabasesRes, HealthRes, MemoryRes, OpsAuditEntryRes, OverviewRes,
    RowsRes, TableRes, TerminateReq,
};
use crate::state::AppState;

#[utoipa::path(
    get,
    path = "/v1/admin/ops/overview",
    tag = "admin-ops",
    responses((status = 200, body = OverviewRes)),
)]
pub async fn overview(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> AppResult<Json<OverviewRes>> {
    Ok(Json(state.observability.overview().await?.into()))
}

#[utoipa::path(
    get,
    path = "/v1/admin/ops/health",
    tag = "admin-ops",
    responses((status = 200, body = HealthRes)),
)]
pub async fn health(State(state): State<AppState>, _admin: AdminUser) -> Json<HealthRes> {
    Json(state.observability.health().await.into())
}

#[utoipa::path(
    get,
    path = "/v1/admin/ops/memory",
    tag = "admin-ops",
    responses((status = 200, body = MemoryRes)),
)]
pub async fn memory(State(state): State<AppState>, _admin: AdminUser) -> Json<MemoryRes> {
    Json(state.observability.memory().await.into())
}

#[utoipa::path(
    get,
    path = "/v1/admin/ops/alerts",
    tag = "admin-ops",
    responses((status = 200, body = AlertsRes)),
)]
pub async fn alerts(State(state): State<AppState>, _admin: AdminUser) -> Json<AlertsRes> {
    Json(state.observability.alerts().await.into())
}

// ── database viewer ──────────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/v1/admin/ops/databases",
    tag = "admin-ops",
    responses((status = 200, body = DatabasesRes)),
)]
pub async fn databases(State(state): State<AppState>, _admin: AdminUser) -> Json<DatabasesRes> {
    Json(DatabasesRes {
        configured: state.databases.configured(),
        databases: state
            .databases
            .databases()
            .await
            .into_iter()
            .map(Into::into)
            .collect(),
    })
}

#[utoipa::path(
    get,
    path = "/v1/admin/ops/databases/{database}/tables",
    tag = "admin-ops",
    responses((status = 200, body = [TableRes])),
)]
pub async fn tables(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(database): Path<String>,
) -> AppResult<Json<Vec<TableRes>>> {
    let rows = state.databases.tables(&database).await?;
    Ok(Json(rows.into_iter().map(Into::into).collect()))
}

#[derive(Debug, Deserialize)]
pub struct RowsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// A page of a table with secret columns masked. Opening a table is recorded in
/// the audit log.
#[utoipa::path(
    get,
    path = "/v1/admin/ops/databases/{database}/tables/{table}/rows",
    tag = "admin-ops",
    params(
        ("limit" = Option<i64>, Query, description = "1 to 100, default 25"),
        ("offset" = Option<i64>, Query, description = "Rows to skip"),
    ),
    responses((status = 200, body = RowsRes)),
)]
pub async fn rows(
    State(state): State<AppState>,
    admin: AdminUser,
    Path((database, table)): Path<(String, String)>,
    Query(q): Query<RowsQuery>,
) -> AppResult<Json<RowsRes>> {
    let page = state
        .databases
        .rows(admin.0.account_id, &database, &table, q.limit, q.offset)
        .await?;
    Ok(Json(page.into()))
}

// ── connections ──────────────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/v1/admin/ops/connections",
    tag = "admin-ops",
    responses((status = 200, body = [ConnectionRes])),
)]
pub async fn connections(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> AppResult<Json<Vec<ConnectionRes>>> {
    let rows = state.databases.connections().await?;
    Ok(Json(rows.into_iter().map(Into::into).collect()))
}

/// Ends one database connection. It must be one the list shows, and a reason is
/// required; the action is audited.
#[utoipa::path(
    post,
    path = "/v1/admin/ops/connections/{pid}/terminate",
    tag = "admin-ops",
    request_body = TerminateReq,
    responses((status = 204)),
)]
pub async fn terminate_connection(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(pid): Path<i32>,
    ValidatedJson(req): ValidatedJson<TerminateReq>,
) -> AppResult<StatusCode> {
    state
        .databases
        .terminate(admin.0.account_id, pid, &req.reason)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── audit log ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub limit: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/v1/admin/ops/audit-log",
    operation_id = "ops_audit_log",
    tag = "admin-ops",
    params(("limit" = Option<i64>, Query, description = "Max entries, default 100")),
    responses((status = 200, body = [OpsAuditEntryRes])),
)]
pub async fn audit_log(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(q): Query<AuditQuery>,
) -> AppResult<Json<Vec<OpsAuditEntryRes>>> {
    let rows = state.audit.recent(q.limit.unwrap_or(100)).await?;
    Ok(Json(rows.into_iter().map(Into::into).collect()))
}
