//! Service-to-service endpoints (never routed by the public gateway, and
//! guarded again by the shared internal token).

use axum::extract::State;
use axum::Json;
use tagwise_shared::errors::AppResult;

use crate::repository::RegisterStats;
use crate::state::AppState;

/// Platform-wide figures for the ops service's staff overview. No names.
pub async fn stats(State(state): State<AppState>) -> AppResult<Json<RegisterStats>> {
    Ok(Json(state.register.stats().await?))
}
