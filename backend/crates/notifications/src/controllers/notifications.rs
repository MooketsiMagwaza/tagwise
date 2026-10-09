//! The caller's in-app notification inbox and device registration. Every route
//! acts on the caller's own account.

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use tagwise_shared::auth::AuthUser;
use tagwise_shared::errors::{AppError, AppResult};
use tagwise_shared::utils::validation::UuidPath;

use crate::schemas::notifications::{NotificationRes, UnreadCountRes};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub unread: Option<bool>,
    pub limit: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/v1/notifications",
    tag = "notifications",
    params(
        ("unread" = Option<bool>, Query, description = "Only unread notifications"),
        ("limit" = Option<i64>, Query, description = "1 to 200, default 50"),
    ),
    responses((status = 200, body = [NotificationRes])),
)]
pub async fn list_my_notifications(
    State(state): State<AppState>,
    user: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Vec<NotificationRes>>> {
    let rows = state
        .notifications
        .list(
            user.account_id,
            q.unread.unwrap_or(false),
            q.limit.unwrap_or(50),
        )
        .await?;
    Ok(Json(rows.into_iter().map(Into::into).collect()))
}

#[utoipa::path(
    get,
    path = "/v1/notifications/unread-count",
    tag = "notifications",
    responses((status = 200, body = UnreadCountRes)),
)]
pub async fn unread_count(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<UnreadCountRes>> {
    Ok(Json(UnreadCountRes {
        count: state.notifications.unread_count(user.account_id).await?,
    }))
}

#[utoipa::path(
    post,
    path = "/v1/notifications/{id}/read",
    tag = "notifications",
    responses((status = 204)),
)]
pub async fn mark_notification_read(
    State(state): State<AppState>,
    user: AuthUser,
    UuidPath(id): UuidPath,
) -> AppResult<StatusCode> {
    if state.notifications.mark_read(user.account_id, id).await? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound("notification"))
    }
}

#[utoipa::path(
    post,
    path = "/v1/notifications/read-all",
    tag = "notifications",
    responses((status = 204)),
)]
pub async fn mark_all_read(State(state): State<AppState>, user: AuthUser) -> AppResult<StatusCode> {
    state.notifications.mark_all_read(user.account_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/v1/notifications/{id}",
    tag = "notifications",
    responses((status = 204)),
)]
pub async fn delete_notification(
    State(state): State<AppState>,
    user: AuthUser,
    UuidPath(id): UuidPath,
) -> AppResult<StatusCode> {
    if state.notifications.delete(user.account_id, id).await? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound("notification"))
    }
}

#[utoipa::path(
    delete,
    path = "/v1/notifications",
    tag = "notifications",
    responses((status = 204)),
)]
pub async fn clear_notifications(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<StatusCode> {
    state.notifications.clear(user.account_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct RegisterDeviceReq {
    pub provider: String,
    pub token: String,
}

#[utoipa::path(
    post,
    path = "/v1/devices",
    tag = "notifications",
    request_body = RegisterDeviceReq,
    responses((status = 200)),
)]
pub async fn register_device(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<RegisterDeviceReq>,
) -> AppResult<()> {
    state
        .devices
        .register(user.account_id, &req.provider, &req.token)
        .await
}
