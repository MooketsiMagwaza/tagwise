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

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct CurrencyAmount {
    pub currency: String,
    pub amount: f64,
}

/// Orders, demand and deliveries, from commerce.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct CommerceStats {
    pub orders_total: i64,
    pub orders_last_24h: i64,
    pub orders_last_7d: i64,
    pub orders_unpaid: i64,
    pub orders_by_status: Vec<StatusCount>,
    pub ordered_value_7d: Vec<CurrencyAmount>,
    pub open_bulk_orders: i64,
    pub pooled_demand_units: f64,
    pub shipments_active: i64,
    pub shipments_unclaimed: i64,
    pub shipments_with_problems: i64,
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
    commerce_url: String,
    token: String,
}

impl StatsClients {
    pub fn new(identity_url: String, commerce_url: String, token: String) -> Self {
        Self {
            identity_url,
            commerce_url,
            token,
        }
    }

    pub async fn identity(&self) -> Result<IdentityStats, String> {
        fetch(&self.identity_url, &self.token, "identity").await
    }

    pub async fn commerce(&self) -> Result<CommerceStats, String> {
        fetch(&self.commerce_url, &self.token, "commerce").await
    }
}
