//! HTTP client for the notifications service's `/internal/*` API. A ticket
//! update tells the person it concerns; a delivery failure is logged and
//! swallowed — the update itself already committed.

use serde_json::json;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct NotificationsClient {
    http: reqwest::Client,
    base_url: String,
    internal_token: String,
}

impl NotificationsClient {
    pub fn new(base_url: String, internal_token: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url,
            internal_token,
        }
    }

    /// Raises a `support` notification. Failure is logged, never propagated.
    pub async fn notify_support(
        &self,
        account_id: Uuid,
        kind: &str,
        title: &str,
        body: &str,
        link: String,
        ticket_id: Uuid,
    ) {
        let result = self
            .http
            .post(format!("{}/internal/notifications", self.base_url))
            .header("X-Internal-Token", &self.internal_token)
            .json(&json!({
                "account_id": account_id,
                "category": "support",
                "kind": kind,
                "title": title,
                "body": body,
                "link": link,
                "data": { "ticket_id": ticket_id },
            }))
            .send()
            .await;
        if let Err(err) = result {
            tracing::warn!(error = ?err, kind, "notifications service call failed; continuing");
        }
    }
}
