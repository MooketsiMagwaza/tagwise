//! Admin console: audit log and deep-link tiles. Every route here requires
//! the `admin` role — there's no separate `AdminUser` extractor (unlike
//! `WarehouseUser`) since this is the only controller that needs it; a
//! second admin-scoped controller should factor this check out the same
//! way `WarehouseUser` did.

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use tagwise_shared::auth::claims::ROLE_ADMIN;
use tagwise_shared::auth::{AdminUser, AuthUser};
use tagwise_shared::errors::{AppError, AppResult};
use tagwise_shared::utils::validation::{UuidPath, ValidatedJson};
use uuid::Uuid;

use crate::schemas::admin::{
    AccountDetailRes, AccountListRes, AccountRes, AdminAuditEntryRes, AdminLinksRes, ApiKeyRes,
    CreateAccountReq, CreateApiKeyReq, CreatedApiKeyRes, SessionsRevokedRes, SuspendReq,
};
use crate::services::account_admin_service::ListParams;
use crate::state::AppState;

fn require_admin(user: &AuthUser) -> AppResult<()> {
    if user.has_role(ROLE_ADMIN) {
        Ok(())
    } else {
        Err(AppError::Unauthorized)
    }
}

#[derive(Debug, Deserialize)]
pub struct AuditLogQuery {
    limit: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/v1/admin/audit-log",
    tag = "admin",
    params(("limit" = Option<i64>, Query, description = "Max entries, default 100")),
    responses((status = 200, body = [AdminAuditEntryRes])),
)]
pub async fn audit_log(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<AuditLogQuery>,
) -> AppResult<Json<Vec<AdminAuditEntryRes>>> {
    require_admin(&user)?;
    let entries = state.admin.audit_log(query.limit.unwrap_or(100)).await?;
    Ok(Json(entries.into_iter().map(Into::into).collect()))
}

#[utoipa::path(
    get,
    path = "/v1/admin/links",
    tag = "admin",
    responses((status = 200, body = AdminLinksRes)),
)]
pub async fn links(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<AdminLinksRes>> {
    require_admin(&user)?;
    Ok(Json(AdminLinksRes::from(state.admin.links())))
}

// ── accounts ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AccountsQuery {
    status: Option<String>,
    role: Option<String>,
    q: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/v1/admin/accounts",
    tag = "admin",
    params(
        ("status" = Option<String>, Query, description = "`active` or `suspended`"),
        ("role" = Option<String>, Query, description = "`warehouse`, `store`, `carrier` or `admin`"),
        ("q" = Option<String>, Query, description = "Text in a name or contact"),
        ("limit" = Option<i64>, Query, description = "1 to 200, default 50"),
        ("offset" = Option<i64>, Query, description = "Rows to skip"),
    ),
    responses((status = 200, body = AccountListRes)),
)]
pub async fn list_accounts(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(q): Query<AccountsQuery>,
) -> AppResult<Json<AccountListRes>> {
    let (accounts, total) = state
        .accounts_admin
        .list(ListParams {
            status: q.status,
            role: q.role,
            query: q.q,
            limit: q.limit.unwrap_or(50),
            offset: q.offset.unwrap_or(0),
        })
        .await?;
    Ok(Json(AccountListRes {
        accounts: accounts.into_iter().map(Into::into).collect(),
        total,
    }))
}

#[utoipa::path(
    get,
    path = "/v1/admin/accounts/{account_id}",
    tag = "admin",
    responses((status = 200, body = AccountDetailRes)),
)]
pub async fn get_account(
    State(state): State<AppState>,
    _admin: AdminUser,
    UuidPath(account_id): UuidPath,
) -> AppResult<Json<AccountDetailRes>> {
    let d = state.accounts_admin.detail(account_id).await?;
    Ok(Json(AccountDetailRes::new(
        d.account, d.contacts, d.sessions, d.api_keys,
    )))
}

#[utoipa::path(
    post,
    path = "/v1/admin/accounts",
    tag = "admin",
    request_body = CreateAccountReq,
    responses((status = 200, body = AccountRes)),
)]
pub async fn create_account(
    State(state): State<AppState>,
    admin: AdminUser,
    ValidatedJson(req): ValidatedJson<CreateAccountReq>,
) -> AppResult<Json<AccountRes>> {
    let account = state
        .accounts_admin
        .create(
            admin.0.account_id,
            &req.display_name,
            &req.channel,
            &req.identifier,
            &req.roles,
        )
        .await?;
    Ok(Json(
        state
            .accounts_admin
            .detail(account.id)
            .await?
            .account
            .into(),
    ))
}

#[utoipa::path(
    post,
    path = "/v1/admin/accounts/{account_id}/suspend",
    tag = "admin",
    request_body = SuspendReq,
    responses((status = 200, body = AccountRes)),
)]
pub async fn suspend_account(
    State(state): State<AppState>,
    admin: AdminUser,
    UuidPath(account_id): UuidPath,
    ValidatedJson(req): ValidatedJson<SuspendReq>,
) -> AppResult<Json<AccountRes>> {
    state
        .accounts_admin
        .suspend(admin.0.account_id, account_id, &req.reason)
        .await?;
    Ok(Json(
        state
            .accounts_admin
            .detail(account_id)
            .await?
            .account
            .into(),
    ))
}

#[utoipa::path(
    post,
    path = "/v1/admin/accounts/{account_id}/reinstate",
    tag = "admin",
    responses((status = 200, body = AccountRes)),
)]
pub async fn reinstate_account(
    State(state): State<AppState>,
    admin: AdminUser,
    UuidPath(account_id): UuidPath,
) -> AppResult<Json<AccountRes>> {
    state
        .accounts_admin
        .reinstate(admin.0.account_id, account_id)
        .await?;
    Ok(Json(
        state
            .accounts_admin
            .detail(account_id)
            .await?
            .account
            .into(),
    ))
}

#[utoipa::path(
    delete,
    path = "/v1/admin/accounts/{account_id}",
    tag = "admin",
    responses((status = 204)),
)]
pub async fn delete_account(
    State(state): State<AppState>,
    admin: AdminUser,
    UuidPath(account_id): UuidPath,
) -> AppResult<StatusCode> {
    state
        .accounts_admin
        .remove(admin.0.account_id, account_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── sessions ─────────────────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/v1/admin/accounts/{account_id}/sessions/revoke-all",
    operation_id = "admin_revoke_all_sessions",
    tag = "admin",
    responses((status = 200, body = SessionsRevokedRes)),
)]
pub async fn revoke_all_sessions(
    State(state): State<AppState>,
    admin: AdminUser,
    UuidPath(account_id): UuidPath,
) -> AppResult<Json<SessionsRevokedRes>> {
    let sessions_ended = state
        .accounts_admin
        .revoke_all_sessions(admin.0.account_id, account_id)
        .await?;
    Ok(Json(SessionsRevokedRes { sessions_ended }))
}

#[utoipa::path(
    delete,
    path = "/v1/admin/sessions/{session_id}",
    operation_id = "admin_revoke_session",
    tag = "admin",
    responses((status = 204)),
)]
pub async fn revoke_session(
    State(state): State<AppState>,
    admin: AdminUser,
    UuidPath(session_id): UuidPath,
) -> AppResult<StatusCode> {
    state
        .accounts_admin
        .revoke_session(admin.0.account_id, session_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── API keys ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct KeysQuery {
    account_id: Option<Uuid>,
}

#[utoipa::path(
    get,
    path = "/v1/admin/api-keys",
    tag = "admin",
    params(("account_id" = Option<Uuid>, Query, description = "Only this account's keys")),
    responses((status = 200, body = [ApiKeyRes])),
)]
pub async fn list_api_keys(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(q): Query<KeysQuery>,
) -> AppResult<Json<Vec<ApiKeyRes>>> {
    let keys = state.accounts_admin.list_keys(q.account_id).await?;
    Ok(Json(keys.into_iter().map(Into::into).collect()))
}

/// Makes a key. The response is the only time the key itself is ever shown.
#[utoipa::path(
    post,
    path = "/v1/admin/api-keys",
    tag = "admin",
    request_body = CreateApiKeyReq,
    responses((status = 200, body = CreatedApiKeyRes)),
)]
pub async fn create_api_key(
    State(state): State<AppState>,
    admin: AdminUser,
    ValidatedJson(req): ValidatedJson<CreateApiKeyReq>,
) -> AppResult<Json<CreatedApiKeyRes>> {
    let created = state
        .accounts_admin
        .create_key(
            admin.0.account_id,
            req.account_id,
            &req.name,
            req.expires_in_days,
        )
        .await?;
    Ok(Json(CreatedApiKeyRes {
        key: created.key,
        api_key: created.api_key.into(),
    }))
}

#[utoipa::path(
    delete,
    path = "/v1/admin/api-keys/{key_id}",
    tag = "admin",
    responses((status = 204)),
)]
pub async fn revoke_api_key(
    State(state): State<AppState>,
    admin: AdminUser,
    UuidPath(key_id): UuidPath,
) -> AppResult<StatusCode> {
    state
        .accounts_admin
        .revoke_key(admin.0.account_id, key_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
