//! Settings endpoints: the signed-in account's own profile, preferences,
//! sessions, and account deletion. Every route acts on the caller's own
//! account (`AuthUser::account_id`) — none takes an account id from the URL.

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use axum_extra::extract::cookie::Cookie;
use axum_extra::extract::CookieJar;
use tagwise_shared::auth::extractor::SESSION_COOKIE;
use tagwise_shared::auth::AuthUser;
use tagwise_shared::errors::AppResult;
use tagwise_shared::utils::validation::{UuidPath, ValidatedJson};

use crate::schemas::me::{MeRes, SessionRes, UpdateMeReq};
use crate::state::AppState;

async fn me_res(state: &AppState, user: &AuthUser) -> AppResult<MeRes> {
    let (profile, contacts) = state.me.profile(user.account_id).await?;
    let roles = state.auth_repo.list_roles(user.account_id).await?;
    Ok(MeRes::new(profile, contacts, roles))
}

#[utoipa::path(
    get,
    path = "/v1/me",
    tag = "me",
    responses((status = 200, body = MeRes)),
)]
pub async fn get_me(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<MeRes>> {
    Ok(Json(me_res(&state, &user).await?))
}

#[utoipa::path(
    patch,
    path = "/v1/me",
    tag = "me",
    request_body = UpdateMeReq,
    responses((status = 200, body = MeRes)),
)]
pub async fn patch_me(
    State(state): State<AppState>,
    user: AuthUser,
    ValidatedJson(req): ValidatedJson<UpdateMeReq>,
) -> AppResult<Json<MeRes>> {
    state
        .me
        .update(
            user.account_id,
            req.display_name,
            req.preferred_lang,
            req.preferences,
        )
        .await?;
    Ok(Json(me_res(&state, &user).await?))
}

#[utoipa::path(
    get,
    path = "/v1/me/sessions",
    tag = "me",
    responses((status = 200, body = [SessionRes])),
)]
pub async fn list_sessions(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Vec<SessionRes>>> {
    let rows = state.me.sessions(user.account_id).await?;
    Ok(Json(rows.into_iter().map(Into::into).collect()))
}

#[utoipa::path(
    delete,
    path = "/v1/me/sessions/{session_id}",
    tag = "me",
    responses((status = 204)),
)]
pub async fn revoke_session(
    State(state): State<AppState>,
    user: AuthUser,
    UuidPath(session_id): UuidPath,
) -> AppResult<StatusCode> {
    state.me.revoke_session(user.account_id, session_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Signs the account out everywhere, this device included: every refresh
/// session is revoked and the presented access token is denylisted.
#[utoipa::path(
    delete,
    path = "/v1/me/sessions",
    tag = "me",
    responses((status = 204)),
)]
pub async fn revoke_all_sessions(
    State(state): State<AppState>,
    jar: CookieJar,
    user: AuthUser,
) -> AppResult<(CookieJar, StatusCode)> {
    state.me.revoke_all_sessions(user.account_id).await?;
    state
        .denylist
        .revoke(
            user.claims.jti,
            user.claims.remaining_ttl_secs(chrono::Utc::now()),
        )
        .await?;
    Ok((
        jar.remove(Cookie::from(SESSION_COOKIE)),
        StatusCode::NO_CONTENT,
    ))
}

/// Deletes the caller's account (soft delete) and signs them out everywhere.
#[utoipa::path(
    delete,
    path = "/v1/me",
    tag = "me",
    responses((status = 204)),
)]
pub async fn delete_me(
    State(state): State<AppState>,
    jar: CookieJar,
    user: AuthUser,
) -> AppResult<(CookieJar, StatusCode)> {
    state.me.delete_account(user.account_id).await?;
    state
        .denylist
        .revoke(
            user.claims.jti,
            user.claims.remaining_ttl_secs(chrono::Utc::now()),
        )
        .await?;
    Ok((
        jar.remove(Cookie::from(SESSION_COOKIE)),
        StatusCode::NO_CONTENT,
    ))
}
