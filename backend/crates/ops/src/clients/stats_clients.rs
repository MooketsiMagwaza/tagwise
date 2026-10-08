//! Platform-wide counts, read from the services that own the data over their
//! internal APIs. A service that can't be reached is reported as unavailable
//! with the reason — never as zero.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap_or_default()
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct RoleCount {
    pub role: String,
    pub count: i64,
}

/// Accounts and sessions, from identity.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct IdentityStats {
    pub accounts_total: i64,
    pub accounts_active: i64,
    pub accounts_suspended: i64,
    pub accounts_new_7d: i64,
    pub sessions_active: i64,
    pub by_role: Vec<RoleCount>,
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct StatusCount {
    pub status: String,
    pub count: i64,
}

/// The register at a glance, from the register service: workspaces, assets
/// out or missing, stock below its reorder level, stock-takes running.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct RegisterStats {
    pub workspaces_total: i64,
    pub assets_total: i64,
    pub assets_checked_out: i64,
    pub assets_overdue: i64,
    pub assets_missing: i64,
    pub stock_lines_low: i64,
    pub counts_open: i64,
}

async fn fetch<T: for<'de> Deserialize<'de>>(
    base: &str,
    token: &str,
    name: &str,
) -> Result<T, String> {
    let response = http()
        .get(format!("{base}/internal/stats"))
        .header("X-Internal-Token", token)
        .send()
        .await
        .map_err(|e| {
            format!(
                "couldn't reach the {name} service ({})",
                if e.is_timeout() {
                    "timed out"
                } else {
                    "connection failed"
                }
            )
        })?;
    if !response.status().is_success() {
        return Err(format!("the {name} service answered {}", response.status()));
    }
    response
        .json::<T>()
        .await
        .map_err(|_| format!("the {name} service sent something unexpected"))
}

#[derive(Debug, Clone)]
pub struct StatsClients {
    identity_url: String,
    register_url: String,
    token: String,
}

impl StatsClients {
    pub fn new(identity_url: String, register_url: String, token: String) -> Self {
        Self {
            identity_url,
            register_url,
            token,
        }
    }

    pub async fn identity(&self) -> Result<IdentityStats, String> {
        fetch(&self.identity_url, &self.token, "identity").await
    }

    pub async fn register(&self) -> Result<RegisterStats, String> {
        fetch(&self.register_url, &self.token, "register").await
    }
}
