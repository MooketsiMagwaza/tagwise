//! Service-to-service endpoint: other services (the register service today) POST here
//! to raise a notification for an account. Never reachable through the
//! public gateway; guarded by `tagwise_shared::middleware::internal_auth_mw`.

use axum::extract::State;
use axum::Json;
use serde::Deserialize;
use tagwise_shared::errors::AppResult;
use uuid::Uuid;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct RaiseNotificationReq {
    pub account_id: Uuid,
    /// `orders`, `payments`, `deliveries`, `support` or `system` — what the
    /// recipient's preferences are keyed by. Anything else counts as `system`.
    #[serde(default)]
    pub category: Option<String>,
    pub kind: String,
    pub title: String,
    pub body: String,
    /// Where opening the notification should go, e.g. `/my-orders/<id>`.
    #[serde(default)]
    pub link: Option<String>,
    #[serde(default)]
    pub data: serde_json::Value,
}

pub async fn raise(
    State(state): State<AppState>,
    Json(req): Json<RaiseNotificationReq>,
) -> AppResult<()> {
    state
        .notifications
        .dispatch(
            req.account_id,
            req.category.as_deref().unwrap_or("system"),
            &req.kind,
            &req.title,
            &req.body,
            req.link.as_deref(),
            req.data,
        )
        .await?;
    Ok(())
}
