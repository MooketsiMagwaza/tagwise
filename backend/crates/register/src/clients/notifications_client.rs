//! Client for the notifications service. The register raises a notification
//! when something needs a person: an item overdue for return, a stock-take
//! closed with gaps. A failure here is logged and swallowed; the register
//! write itself has already committed. Categories match the notifications
//! service's settings (custody, stock, counts, system).

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

    /// The one way anything is raised. Failure is logged, never propagated.
    #[allow(clippy::too_many_arguments)]
    pub async fn notify(
        &self,
        account_id: Uuid,
        category: &str,
        kind: &str,
        title: &str,
        body: &str,
        link: Option<String>,
        data: serde_json::Value,
    ) {
        let result = self
            .http
            .post(format!("{}/internal/notifications", self.base_url))
            .header("X-Internal-Token", &self.internal_token)
            .json(&json!({
                "account_id": account_id,
                "category": category,
                "kind": kind,
                "title": title,
                "body": body,
                "link": link,
                "data": data,
            }))
            .send()
            .await;
        if let Err(err) = result {
            tracing::warn!(error = ?err, kind, "notifications service call failed; continuing");
        }
    }

    /// Tells a custodian an item they have is overdue.
    pub async fn notify_overdue(&self, account_id: Uuid, tag: &str, name: &str, asset_id: Uuid) {
        self.notify(
            account_id,
            "custody",
            "asset_overdue",
            "Please return an item",
            &format!("{tag} {name} is past its due-back date."),
            Some(format!("/app/assets/{tag}")),
            json!({ "asset_id": asset_id }),
        )
        .await;
    }

    /// Tells whoever started a stock-take that it closed, and how many were missing.
    pub async fn notify_count_closed(&self, account_id: Uuid, count_id: Uuid, missing: i64) {
        self.notify(
            account_id,
            "counts",
            "count_closed",
            "Stock-take closed",
            &format!("{missing} expected items were not found."),
            Some(format!("/app/counts/{count_id}")),
            json!({ "count_id": count_id, "missing": missing }),
        )
        .await;
    }
}
