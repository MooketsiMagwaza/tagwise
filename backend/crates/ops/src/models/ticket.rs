use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Ticket {
    pub id: Uuid,
    pub requester_account_id: Uuid,
    pub kind: String,
    pub subject: String,
    pub body: String,
    pub status: String,
    pub priority: String,
    pub assignee_account_id: Option<Uuid>,
    pub context: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct TicketMessage {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub author_account_id: Uuid,
    pub author_kind: String,
    pub body: String,
    pub internal: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct TicketEvent {
    pub id: Uuid,
    pub ticket_id: Uuid,
    pub actor_account_id: Uuid,
    pub kind: String,
    pub detail: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct StatusCount {
    pub status: String,
    pub count: i64,
}
