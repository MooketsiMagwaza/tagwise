//! HTTP client for identity's `/internal/*` API. Notifications holds accounts
//! only as opaque ids, so "may I notify this account, and how?" is a question
//! for identity, which owns preferences and contact details.

use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

/// The channels a notification may use, after applying the account's choices.
#[derive(Debug, Clone, Copy)]
pub struct Channels {
    pub inapp: bool,
    pub push: bool,
    pub email: bool,
}

impl Channels {
    /// What an account that has never touched its settings gets: in the app and
    /// push, not email.
    pub const DEFAULT: Channels = Channels {
        inapp: true,
        push: true,
        email: false,
    };
}

#[derive(Debug, Deserialize)]
struct SettingsRes {
    notifications: serde_json::Value,
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

    /// The channels enabled for `category`. If identity can't be reached the
    /// defaults apply: better to deliver to the inbox than to drop something
    /// silently because of an outage.
    pub async fn channels_for(&self, account_id: Uuid, category: &str) -> Channels {
        let url = format!(
            "{}/internal/accounts/{account_id}/notification-settings",
            self.base_url
        );
        let response = self
            .http
            .get(url)
            .header("X-Internal-Token", &self.internal_token)
            .send()
            .await;
        let settings = match response {
            Ok(r) if r.status().is_success() => r.json::<SettingsRes>().await.ok(),
            Ok(r) => {
                tracing::warn!(status = %r.status(), "identity refused notification-settings lookup; using defaults");
                None
            }
            Err(err) => {
                tracing::warn!(error = ?err, "identity unreachable for notification-settings; using defaults");
                None
            }
        };
        let per_category = settings
            .as_ref()
            .and_then(|s| s.notifications.get(category))
            .cloned()
            .unwrap_or(serde_json::Value::Null);
        let flag = |name: &str, default: bool| {
            per_category
                .get(name)
                .and_then(|v| v.as_bool())
                .unwrap_or(default)
        };
        Channels {
            inapp: flag("inapp", Channels::DEFAULT.inapp),
            push: flag("push", Channels::DEFAULT.push),
            email: flag("email", Channels::DEFAULT.email),
        }
    }

    /// Emails the account's primary address. Failure is logged and swallowed —
    /// the in-app notification is the record of truth.
    pub async fn send_email(&self, account_id: Uuid, subject: &str, body: &str) {
        let url = format!("{}/internal/accounts/{account_id}/email", self.base_url);
        let result = self
            .http
            .post(url)
            .header("X-Internal-Token", &self.internal_token)
            .json(&json!({ "subject": subject, "body": body }))
            .send()
            .await;
        match result {
            Ok(r) if r.status().is_success() => {}
            Ok(r) => tracing::warn!(status = %r.status(), "email notification not sent"),
            Err(err) => tracing::warn!(error = ?err, "email notification not sent"),
        }
    }
}
