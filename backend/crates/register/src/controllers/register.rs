//! The register's public API. Every route under `/v1/workspaces/:ws` first
//! checks that the caller is a member of that workspace (a non-member gets
//! 404, the same as a workspace that does not exist) and that their role
//! allows the action.

use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use tagwise_shared::auth::AuthUser;
use tagwise_shared::errors::{AppError, AppResult};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::domain::{can, validate_adjustment, Action, AdjustError, Role, EDITABLE_STATUSES};
use crate::repository::{
    ActivityEntry, Asset, AssetPatch, Comment, Count, EditOutcome, Site, StockLine, Workspace,
};
use crate::state::AppState;

/// The caller's role in `workspace_id`, refusing if it does not allow `action`.
async fn authorise(
    state: &AppState,
    user: &AuthUser,
    workspace_id: Uuid,
    action: Option<Action>,
) -> AppResult<Role> {
    let role = state
        .register
        .role_in(workspace_id, user.account_id)
        .await?;
    let role = Role::parse(&role).ok_or(AppError::Forbidden("unknown workspace role"))?;
    if let Some(action) = action {
        if !can(role, action) {
            return Err(AppError::Forbidden(
                "your role in this workspace cannot do that",
            ));
        }
    }
    Ok(role)
}

// ── workspaces ───────────────────────────────────────────────────────────

#[utoipa::path(get, path = "/v1/workspaces", tag = "workspaces",
    responses((status = 200, body = [Workspace])))]
pub async fn my_workspaces(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Vec<Workspace>>> {
    Ok(Json(state.register.my_workspaces(user.account_id).await?))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateWorkspaceReq {
    pub name: String,
    /// Two to five capital letters, used in tags (MCT-00001).
    pub tag_prefix: String,
}

#[utoipa::path(post, path = "/v1/workspaces", tag = "workspaces", request_body = CreateWorkspaceReq,
    responses((status = 201, body = Workspace)))]
pub async fn create_workspace(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateWorkspaceReq>,
) -> AppResult<(StatusCode, Json<Workspace>)> {
    let name = req.name.trim();
    if name.is_empty() || name.len() > 120 {
        return Err(AppError::BadRequest(
            "a workspace needs a name of up to 120 characters".into(),
        ));
    }
    let prefix = req.tag_prefix.trim();
    if !(2..=5).contains(&prefix.len()) || !prefix.chars().all(|c| c.is_ascii_uppercase()) {
        return Err(AppError::BadRequest(
            "the tag prefix is two to five capital letters".into(),
        ));
    }
    let ws = state
        .register
        .create_workspace(name, prefix, user.account_id)
        .await?;
    Ok((StatusCode::CREATED, Json(ws)))
}

#[utoipa::path(get, path = "/v1/workspaces/{ws}/sites", tag = "sites",
    params(("ws" = Uuid, Path, description = "Workspace id")), responses((status = 200, body = [Site])))]
pub async fn sites(
    State(state): State<AppState>,
    user: AuthUser,
    Path(ws): Path<Uuid>,
) -> AppResult<Json<Vec<Site>>> {
    authorise(&state, &user, ws, None).await?;
    Ok(Json(state.register.sites(ws).await?))
}

// ── assets ───────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct AssetListQuery {
    pub status: Option<String>,
    pub limit: Option<i64>,
}

#[utoipa::path(get, path = "/v1/workspaces/{ws}/assets", tag = "assets",
    params(("ws" = Uuid, Path, description = "Workspace id")), responses((status = 200, body = [Asset])))]
pub async fn assets(
    State(state): State<AppState>,
    user: AuthUser,
    Path(ws): Path<Uuid>,
    Query(q): Query<AssetListQuery>,
) -> AppResult<Json<Vec<Asset>>> {
    authorise(&state, &user, ws, None).await?;
    let limit = q.limit.unwrap_or(500).clamp(1, 5000);
    Ok(Json(
        state
            .register
            .assets(ws, q.status.as_deref(), limit)
            .await?,
    ))
}

#[utoipa::path(get, path = "/v1/workspaces/{ws}/assets/{id}", tag = "assets",
    params(("ws" = Uuid, Path, description = "Workspace id"), ("id" = Uuid, Path, description = "Item id")), responses((status = 200, body = Asset), (status = 404)))]
pub async fn asset(
    State(state): State<AppState>,
    user: AuthUser,
    Path((ws, id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<Asset>> {
    authorise(&state, &user, ws, None).await?;
    Ok(Json(state.register.asset(ws, id).await?))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct EditAssetReq {
    /// The version the caller loaded. A stale version gets 409 with the current asset.
    pub version: i32,
    pub name: Option<String>,
    pub category: Option<String>,
    pub model: Option<String>,
    pub serial: Option<String>,
    pub site_id: Option<Uuid>,
    pub place_id: Option<Uuid>,
    pub status: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ConflictRes {
    pub error: &'static str,
    /// What is saved now; show it beside the caller's edit and let them choose.
    pub current: Asset,
}

#[utoipa::path(patch, path = "/v1/workspaces/{ws}/assets/{id}", tag = "assets", request_body = EditAssetReq,
    params(("ws" = Uuid, Path, description = "Workspace id"), ("id" = Uuid, Path, description = "Item id")),
    responses((status = 200, body = Asset), (status = 409, body = ConflictRes)))]
pub async fn edit_asset(
    State(state): State<AppState>,
    user: AuthUser,
    Path((ws, id)): Path<(Uuid, Uuid)>,
    Json(req): Json<EditAssetReq>,
) -> AppResult<Response> {
    authorise(&state, &user, ws, Some(Action::AssetEdit)).await?;
    if let Some(status) = req.status.as_deref() {
        if !EDITABLE_STATUSES.contains(&status) {
            return Err(AppError::BadRequest(
                "use check-out and check-in to change custody".into(),
            ));
        }
    }
    let patch = AssetPatch {
        name: req.name,
        category: req.category,
        model: req.model,
        serial: req.serial,
        site_id: req.site_id,
        place_id: req.place_id,
        status: req.status,
        notes: req.notes,
    };
    match state
        .register
        .update_asset(ws, id, req.version, &patch, user.account_id)
        .await?
    {
        EditOutcome::Saved(asset) => {
            let label = format!("{} {}", asset.tag, asset.name);
            state
                .register
                .log(
                    ws,
                    user.account_id,
                    "updated",
                    Some("asset"),
                    Some(asset.id),
                    Some(&label),
                    "Edited",
                )
                .await?;
            Ok(Json(asset).into_response())
        }
        EditOutcome::Conflict(current) => Ok((
            StatusCode::CONFLICT,
            Json(ConflictRes {
                error: "edited by someone else first",
                current,
            }),
        )
            .into_response()),
    }
}

// ── stock ────────────────────────────────────────────────────────────────

#[utoipa::path(get, path = "/v1/workspaces/{ws}/stock", tag = "stock",
    params(("ws" = Uuid, Path, description = "Workspace id")), responses((status = 200, body = [StockLine])))]
pub async fn stock(
    State(state): State<AppState>,
    user: AuthUser,
    Path(ws): Path<Uuid>,
) -> AppResult<Json<Vec<StockLine>>> {
    authorise(&state, &user, ws, None).await?;
    Ok(Json(state.register.stock(ws).await?))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdjustReq {
    /// Positive to receive, negative to issue.
    pub delta: i32,
    #[serde(default)]
    pub reason: String,
}

#[utoipa::path(post, path = "/v1/workspaces/{ws}/stock/{id}/adjust", tag = "stock", request_body = AdjustReq,
    params(("ws" = Uuid, Path, description = "Workspace id"), ("id" = Uuid, Path, description = "Item id"),
        ("Idempotency-Key" = String, Header, description = "Made by the client; a retry with the same key applies once")),
    responses((status = 200, body = StockLine), (status = 409, description = "Not enough on hand")))]
pub async fn adjust_stock(
    State(state): State<AppState>,
    user: AuthUser,
    Path((ws, id)): Path<(Uuid, Uuid)>,
    headers: HeaderMap,
    Json(req): Json<AdjustReq>,
) -> AppResult<Json<StockLine>> {
    authorise(&state, &user, ws, Some(Action::StockAdjust)).await?;
    let key = headers.get("idempotency-key").and_then(|v| v.to_str().ok());
    validate_adjustment(req.delta, key).map_err(|e| {
        AppError::BadRequest(
            match e {
                AdjustError::Zero => "the amount cannot be zero",
                AdjustError::TooLarge => "the amount is too large",
                AdjustError::MissingKey => "send an Idempotency-Key header",
                AdjustError::KeyTooLong => "the Idempotency-Key is too long",
            }
            .into(),
        )
    })?;
    let line = state
        .register
        .adjust_stock(
            ws,
            id,
            req.delta,
            req.reason.trim(),
            key.unwrap_or_default().trim(),
            user.account_id,
        )
        .await?;
    Ok(Json(line))
}

// ── stock-takes ──────────────────────────────────────────────────────────

#[utoipa::path(get, path = "/v1/workspaces/{ws}/counts", tag = "counts",
    params(("ws" = Uuid, Path, description = "Workspace id")), responses((status = 200, body = [Count])))]
pub async fn counts(
    State(state): State<AppState>,
    user: AuthUser,
    Path(ws): Path<Uuid>,
) -> AppResult<Json<Vec<Count>>> {
    authorise(&state, &user, ws, None).await?;
    Ok(Json(state.register.counts(ws).await?))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct StartCountReq {
    pub site_id: Uuid,
    pub name: String,
}

#[utoipa::path(post, path = "/v1/workspaces/{ws}/counts", tag = "counts", request_body = StartCountReq,
    params(("ws" = Uuid, Path, description = "Workspace id")), responses((status = 201, body = Count)))]
pub async fn start_count(
    State(state): State<AppState>,
    user: AuthUser,
    Path(ws): Path<Uuid>,
    Json(req): Json<StartCountReq>,
) -> AppResult<(StatusCode, Json<Count>)> {
    authorise(&state, &user, ws, Some(Action::CountRun)).await?;
    let count = state
        .register
        .start_count(ws, req.site_id, req.name.trim(), user.account_id)
        .await?;
    Ok((StatusCode::CREATED, Json(count)))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ScanReq {
    pub code: String,
    pub place_id: Option<Uuid>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ScanRes {
    /// found, wrong_place, unexpected, unknown or repeat.
    pub result: &'static str,
}

#[utoipa::path(post, path = "/v1/workspaces/{ws}/counts/{id}/scans", tag = "counts", request_body = ScanReq,
    params(("ws" = Uuid, Path, description = "Workspace id"), ("id" = Uuid, Path, description = "Item id")), responses((status = 200, body = ScanRes)))]
pub async fn scan(
    State(state): State<AppState>,
    user: AuthUser,
    Path((ws, id)): Path<(Uuid, Uuid)>,
    Json(req): Json<ScanReq>,
) -> AppResult<Json<ScanRes>> {
    authorise(&state, &user, ws, Some(Action::CountRun)).await?;
    if req.code.trim().is_empty() || req.code.len() > 200 {
        return Err(AppError::BadRequest(
            "send the code that was scanned".into(),
        ));
    }
    let result = state
        .register
        .record_scan(ws, id, &req.code, req.place_id, user.account_id)
        .await?;
    Ok(Json(ScanRes {
        result: result.as_str(),
    }))
}

// ── comments and activity ────────────────────────────────────────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct CommentsQuery {
    pub target_type: String,
    pub target_id: Uuid,
}

#[utoipa::path(get, path = "/v1/workspaces/{ws}/comments", tag = "comments",
    params(("ws" = Uuid, Path, description = "Workspace id")), responses((status = 200, body = [Comment])))]
pub async fn comments(
    State(state): State<AppState>,
    user: AuthUser,
    Path(ws): Path<Uuid>,
    Query(q): Query<CommentsQuery>,
) -> AppResult<Json<Vec<Comment>>> {
    authorise(&state, &user, ws, None).await?;
    Ok(Json(
        state
            .register
            .comments(ws, &q.target_type, q.target_id)
            .await?,
    ))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AddCommentReq {
    pub target_type: String,
    pub target_id: Uuid,
    pub body: String,
}

#[utoipa::path(post, path = "/v1/workspaces/{ws}/comments", tag = "comments", request_body = AddCommentReq,
    params(("ws" = Uuid, Path, description = "Workspace id")), responses((status = 201, body = Comment)))]
pub async fn add_comment(
    State(state): State<AppState>,
    user: AuthUser,
    Path(ws): Path<Uuid>,
    Json(req): Json<AddCommentReq>,
) -> AppResult<(StatusCode, Json<Comment>)> {
    authorise(&state, &user, ws, Some(Action::Comment)).await?;
    if !matches!(req.target_type.as_str(), "asset" | "stock") {
        return Err(AppError::BadRequest(
            "comments go on an asset or a stock line".into(),
        ));
    }
    let body = req.body.trim();
    if body.is_empty() || body.len() > 4000 {
        return Err(AppError::BadRequest(
            "a comment is 1 to 4,000 characters".into(),
        ));
    }
    let comment = state
        .register
        .add_comment(ws, &req.target_type, req.target_id, body, user.account_id)
        .await?;
    Ok((StatusCode::CREATED, Json(comment)))
}

#[utoipa::path(get, path = "/v1/workspaces/{ws}/activity", tag = "activity",
    params(("ws" = Uuid, Path, description = "Workspace id")), responses((status = 200, body = [ActivityEntry])))]
pub async fn activity(
    State(state): State<AppState>,
    user: AuthUser,
    Path(ws): Path<Uuid>,
) -> AppResult<Json<Vec<ActivityEntry>>> {
    authorise(&state, &user, ws, None).await?;
    Ok(Json(state.register.activity(ws, 200).await?))
}
