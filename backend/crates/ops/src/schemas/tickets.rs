use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::clients::identity_client::AccountSummary;
use crate::models::ticket::{StatusCount, Ticket, TicketEvent, TicketMessage};

// ── requests ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateTicketReq {
    /// `bug`, `question`, `report` or `request`.
    #[validate(length(min = 1, max = 32))]
    pub kind: String,
    #[validate(length(min = 1, max = 400))]
    pub subject: String,
    #[validate(length(min = 1, max = 20000))]
    pub body: String,
    /// Where the requester was and what they were using (page, browser). An
    /// object, at most 4 KB.
    #[schema(value_type = Option<Object>)]
    pub context: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct ReplyReq {
    #[validate(length(min = 1, max = 20000))]
    pub body: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct StaffReplyReq {
    #[validate(length(min = 1, max = 20000))]
    pub body: String,
    /// A staff-only note the requester never sees, and that notifies nobody.
    #[serde(default)]
    pub internal: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct StaffPatchReq {
    /// `open`, `in_progress`, `waiting`, `resolved` or `closed`.
    pub status: Option<String>,
    /// `low`, `normal` or `high`.
    pub priority: Option<String>,
    /// `me`, `none`, or an account id.
    pub assignee: Option<String>,
}

// ── responses ────────────────────────────────────────────────────────────

/// A ticket as its requester sees it.
#[derive(Debug, Serialize, ToSchema)]
pub struct TicketRes {
    pub id: Uuid,
    pub kind: String,
    pub subject: String,
    pub body: String,
    /// `open`, `in_progress`, `waiting`, `resolved` or `closed`.
    pub status: String,
    pub priority: String,
    /// Whether a member of staff has taken it.
    pub assigned: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

impl From<Ticket> for TicketRes {
    fn from(t: Ticket) -> Self {
        Self {
            id: t.id,
            kind: t.kind,
            subject: t.subject,
            body: t.body,
            status: t.status,
            priority: t.priority,
            assigned: t.assignee_account_id.is_some(),
            created_at: t.created_at,
            updated_at: t.updated_at,
            resolved_at: t.resolved_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MessageRes {
    pub id: Uuid,
    /// `requester` or `staff`.
    pub author_kind: String,
    pub body: String,
    /// Only ever true in the staff view.
    pub internal: bool,
    pub created_at: DateTime<Utc>,
}

impl From<TicketMessage> for MessageRes {
    fn from(m: TicketMessage) -> Self {
        Self {
            id: m.id,
            author_kind: m.author_kind,
            body: m.body,
            internal: m.internal,
            created_at: m.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TicketDetailRes {
    pub ticket: TicketRes,
    pub messages: Vec<MessageRes>,
}

/// A ticket as staff see it: who raised it, who has it, and the context.
#[derive(Debug, Serialize, ToSchema)]
pub struct StaffTicketRes {
    pub id: Uuid,
    pub kind: String,
    pub subject: String,
    pub body: String,
    pub status: String,
    pub priority: String,
    pub requester_account_id: Uuid,
    pub assignee_account_id: Option<Uuid>,
    #[schema(value_type = Object)]
    pub context: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

impl From<Ticket> for StaffTicketRes {
    fn from(t: Ticket) -> Self {
        Self {
            id: t.id,
            kind: t.kind,
            subject: t.subject,
            body: t.body,
            status: t.status,
            priority: t.priority,
            requester_account_id: t.requester_account_id,
            assignee_account_id: t.assignee_account_id,
            context: t.context,
            created_at: t.created_at,
            updated_at: t.updated_at,
            resolved_at: t.resolved_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StatusCountRes {
    pub status: String,
    pub count: i64,
}

impl From<StatusCount> for StatusCountRes {
    fn from(c: StatusCount) -> Self {
        Self {
            status: c.status,
            count: c.count,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct QueueRes {
    pub tickets: Vec<StaffTicketRes>,
    /// How many tickets are in each status, across the whole queue.
    pub counts: Vec<StatusCountRes>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EventRes {
    pub actor_account_id: Uuid,
    /// `created`, `reply`, `internal_note`, `status_changed`, `assigned`,
    /// `priority_changed` or `closed`.
    pub kind: String,
    pub detail: String,
    pub created_at: DateTime<Utc>,
}

impl From<TicketEvent> for EventRes {
    fn from(e: TicketEvent) -> Self {
        Self {
            actor_account_id: e.actor_account_id,
            kind: e.kind,
            detail: e.detail,
            created_at: e.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RequesterRes {
    pub account_id: Uuid,
    pub display_name: String,
    pub roles: Vec<String>,
    pub contact: Option<String>,
}

impl From<AccountSummary> for RequesterRes {
    fn from(a: AccountSummary) -> Self {
        Self {
            account_id: a.account_id,
            display_name: a.display_name,
            roles: a.roles,
            contact: a.contact,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StaffTicketDetailRes {
    pub ticket: StaffTicketRes,
    /// `None` when identity could not be reached.
    pub requester: Option<RequesterRes>,
    /// The whole conversation, including internal notes.
    pub messages: Vec<MessageRes>,
    /// Everything staff did to it, and when.
    pub events: Vec<EventRes>,
}
