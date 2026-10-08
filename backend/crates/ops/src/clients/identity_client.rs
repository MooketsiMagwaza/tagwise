//! HTTP client for identity's `/internal/*` API. Ops holds accounts only as
//! opaque ids; who someone is comes from identity, and only for staff screens.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// What a support agent may see about the person who raised a ticket.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AccountSummary {
    pub account_id: Uuid,
    pub display_name: String,
    pub roles: Vec<String>,
    pub contact: Option<String>,
}

#[derive(Debug, Clone)]
pub struct IdentityClient {
    http: reqwest::Client,
    base_url: String,
    internal_token: String,
}

impl IdentityClient {
    pub fn new(base_url: String, internal_token: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url,
            internal_token,
        }
    }

    /// `None` when identity can't say (unreachable, or the account is gone): a
    /// ticket must still open, just without the requester's name beside it.
    pub async fn account_summary(&self, account_id: Uuid) -> Option<AccountSummary> {
        let response = self
            .http
            .get(format!(
                "{}/internal/accounts/{account_id}/summary",
                self.base_url
            ))
            .header("X-Internal-Token", &self.internal_token)
            .send()
            .await;
        match response {
            Ok(r) if r.status().is_success() => r.json::<AccountSummary>().await.ok(),
            Ok(r) => {
                tracing::warn!(status = %r.status(), "identity did not return an account summary");
                None
            }
            Err(err) => {
                tracing::warn!(error = ?err, "identity service call failed");
                None
            }
        }
    }
}
