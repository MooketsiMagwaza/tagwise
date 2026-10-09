use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::notification::Notification;

#[derive(Debug, Serialize, ToSchema)]
pub struct NotificationRes {
    pub id: Uuid,
    /// `orders`, `payments`, `deliveries`, `support` or `system`.
    pub category: String,
    pub kind: String,
    pub title: String,
    pub body: String,
    /// Where opening it should go, relative to the site.
    pub link: Option<String>,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
    pub read_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl From<Notification> for NotificationRes {
    fn from(n: Notification) -> Self {
        Self {
            id: n.id,
            category: n.category,
            kind: n.kind,
            title: n.title,
            body: n.body,
            link: n.link,
            data: n.data,
            read_at: n.read_at,
            created_at: n.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UnreadCountRes {
    pub count: i64,
}
