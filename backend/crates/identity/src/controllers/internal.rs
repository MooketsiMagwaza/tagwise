//! Service-to-service endpoints (never reachable through the public
//! gateway — see `docker/nginx/gateway.conf` — and guarded again by
//! `tagwise_shared::middleware::internal_auth_mw`). Other services call
//! these for notification settings, account summaries, email and stats.

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use tagwise_shared::errors::{AppError, AppResult};

use crate::email::gateway::EmailMessage;
use uuid::Uuid;

use crate::state::AppState;
use tagwise_shared::utils::validation::UuidPath;

#[derive(Debug, Serialize)]
pub struct NotificationSettingsRes {
    /// The account's saved `preferences.notifications` object, or null.
    pub notifications: serde_json::Value,
    /// Where an email notification would go.
    pub email: Option<String>,
}

/// The notifications service asks this before creating a notification, so a
/// muted category creates nothing.
pub async fn notification_settings(
    State(state): State<AppState>,
    UuidPath(id): UuidPath,
) -> AppResult<Json<NotificationSettingsRes>> {
    let (notifications, email) = state.me.notification_settings(id).await?;
    Ok(Json(NotificationSettingsRes {
        notifications: notifications.unwrap_or(serde_json::Value::Null),
        email,
    }))
}

#[derive(Debug, Deserialize)]
pub struct SendEmailReq {
    pub subject: String,
    pub body: String,
}

/// Sends an email to the account's primary address through the same gateway
/// that sends sign-in codes (logged in development, the real provider in
/// production).
pub async fn send_email(
    State(state): State<AppState>,
    UuidPath(id): UuidPath,
    Json(req): Json<SendEmailReq>,
) -> AppResult<()> {
    let (_, email) = state.me.notification_settings(id).await?;
    let to = email.ok_or(AppError::NotFound("email address"))?;
    state
        .email
        .send(EmailMessage {
            to: &to,
            subject: &req.subject,
            text_body: &req.body,
            html_body: None,
        })
        .await
        .map_err(|_| AppError::ServiceUnavailable("email delivery"))
}

#[derive(Debug, Serialize)]
pub struct AccountSummaryRes {
    pub account_id: Uuid,
    pub display_name: String,
    pub roles: Vec<String>,
    /// The primary contact (an email address or phone number), if any.
    pub contact: Option<String>,
}

/// Who an account is, for another service's staff-facing screens (the support
/// queue shows who raised a ticket). Only what a support agent needs.
pub async fn account_summary(
    State(state): State<AppState>,
    UuidPath(id): UuidPath,
) -> AppResult<Json<AccountSummaryRes>> {
    let (profile, contacts) = state.me.profile(id).await?;
    let roles = state.auth_repo.list_roles(id).await?;
    let contact = contacts
        .iter()
        .find(|c| c.is_primary)
        .or(contacts.first())
        .map(|c| c.identifier.clone());
    Ok(Json(AccountSummaryRes {
        account_id: profile.id,
        display_name: profile.display_name,
        roles,
        contact,
    }))
}

/// Platform-wide account counts for the staff overview. No names or contacts.
pub async fn stats(
    State(state): State<AppState>,
) -> AppResult<Json<crate::schemas::admin::IdentityStatsRes>> {
    let s = state.accounts_admin.stats().await?;
    Ok(Json(crate::schemas::admin::IdentityStatsRes {
        accounts_total: s.counts.total,
        accounts_active: s.counts.active,
        accounts_suspended: s.counts.suspended,
        accounts_new_7d: s.counts.new_7d,
        sessions_active: s.counts.active_sessions,
        by_role: s
            .by_role
            .into_iter()
            .map(|r| crate::schemas::admin::RoleCountRes {
                role: r.role,
                count: r.count,
            })
            .collect(),
    }))
}
