//! Support tickets. Owns the rules: what a ticket may contain, who may see and
//! change it, which status moves are legal, and who is told when it changes.
//!
//! A requester sees only their own tickets and never the staff's internal
//! notes. Staff changes are recorded in the ticket's audit trail.

use uuid::Uuid;

use crate::clients::identity_client::AccountSummary;
use crate::clients::{IdentityClient, NotificationsClient};
use crate::models::ticket::{StatusCount, Ticket, TicketEvent, TicketMessage};
use crate::repositories::ticket_repository::QueueFilter;
use crate::repositories::TicketRepository;
use tagwise_shared::errors::{AppError, AppResult};

pub const KINDS: &[&str] = &["bug", "question", "report", "request"];
pub const STATUSES: &[&str] = &["open", "in_progress", "waiting", "resolved", "closed"];
pub const PRIORITIES: &[&str] = &["low", "normal", "high"];

/// One account can have this many unfinished tickets at once.
const MAX_UNFINISHED: i64 = 20;
const MAX_CONTEXT_BYTES: usize = 4096;

fn invalid(field: &str, message: &str) -> AppError {
    AppError::Validation {
        field: field.into(),
        message: message.into(),
    }
}

/// A ticket as submitted, after checking.
#[derive(Debug)]
pub struct NewTicket {
    pub kind: String,
    pub subject: String,
    pub body: String,
    pub context: serde_json::Value,
}

/// Checks and tidies what a requester sent. Pure, so it is easy to test.
pub fn validate_new(
    kind: &str,
    subject: &str,
    body: &str,
    context: Option<serde_json::Value>,
) -> AppResult<NewTicket> {
    if !KINDS.contains(&kind) {
        return Err(invalid(
            "kind",
            "must be `bug`, `question`, `report` or `request`",
        ));
    }
    let subject = subject.trim();
    if !(3..=120).contains(&subject.chars().count()) {
        return Err(invalid("subject", "must be 3 to 120 characters"));
    }
    let body = body.trim();
    if !(5..=4000).contains(&body.chars().count()) {
        return Err(invalid("body", "must be 5 to 4000 characters"));
    }
    let context = match context {
        None | Some(serde_json::Value::Null) => serde_json::json!({}),
        Some(v @ serde_json::Value::Object(_)) => v,
        Some(_) => return Err(invalid("context", "must be an object")),
    };
    if context.to_string().len() > MAX_CONTEXT_BYTES {
        return Err(invalid("context", "is too large"));
    }
    Ok(NewTicket {
        kind: kind.to_string(),
        subject: subject.to_string(),
        body: body.to_string(),
        context,
    })
}

/// A reply or note: 1 to 4000 characters once trimmed.
pub fn validate_message(body: &str) -> AppResult<String> {
    let body = body.trim();
    if !(1..=4000).contains(&body.chars().count()) {
        return Err(invalid("body", "must be 1 to 4000 characters"));
    }
    Ok(body.to_string())
}

/// Staff may move a ticket between any two statuses, except that a closed ticket
/// can only be reopened. One place, so the rule is the same everywhere.
pub fn staff_can_move(from: &str, to: &str) -> bool {
    from != to && (from != "closed" || to == "open")
}

/// Escapes `%`, `_` and `\` so search text is matched literally by `ILIKE`.
pub fn escape_like(q: &str) -> String {
    q.chars()
        .flat_map(|c| match c {
            '\\' | '%' | '_' => vec!['\\', c],
            other => vec![other],
        })
        .collect()
}

/// Who a ticket is being assigned to.
#[derive(Debug, Clone, Copy)]
pub enum Assignee {
    Me,
    Nobody,
    Account(Uuid),
}

#[derive(Debug, Default)]
pub struct StaffPatch {
    pub status: Option<String>,
    pub priority: Option<String>,
    pub assignee: Option<Assignee>,
}

pub struct QueueParams {
    pub status: Option<String>,
    pub kind: Option<String>,
    pub assignee: Option<String>,
    pub query: Option<String>,
    pub limit: i64,
    pub offset: i64,
}

pub struct StaffDetail {
    pub ticket: Ticket,
    pub messages: Vec<TicketMessage>,
    pub events: Vec<TicketEvent>,
    pub requester: Option<AccountSummary>,
}

#[derive(Clone)]
pub struct TicketService {
    repo: TicketRepository,
    identity: IdentityClient,
    notifications: NotificationsClient,
}

impl TicketService {
    pub fn new(
        repo: TicketRepository,
        identity: IdentityClient,
        notifications: NotificationsClient,
    ) -> Self {
        Self {
            repo,
            identity,
            notifications,
        }
    }

    async fn get(&self, id: Uuid) -> AppResult<Ticket> {
        self.repo
            .find(id)
            .await?
            .ok_or(AppError::NotFound("ticket"))
    }

    /// A ticket, but only if it belongs to `requester` — anyone else's is "not found".
    async fn get_own_ticket(&self, requester: Uuid, id: Uuid) -> AppResult<Ticket> {
        let ticket = self.get(id).await?;
        if ticket.requester_account_id != requester {
            return Err(AppError::NotFound("ticket"));
        }
        Ok(ticket)
    }

    // ── the requester ────────────────────────────────────────────────────

    pub async fn create(
        &self,
        requester: Uuid,
        kind: &str,
        subject: &str,
        body: &str,
        context: Option<serde_json::Value>,
    ) -> AppResult<Ticket> {
        let new = validate_new(kind, subject, body, context)?;
        if self.repo.count_unfinished(requester).await? >= MAX_UNFINISHED {
            return Err(AppError::Conflict(
                "you already have a lot of open requests — wait for some to be answered, or close ones you no longer need".into(),
            ));
        }
        self.repo
            .create(requester, &new.kind, &new.subject, &new.body, new.context)
            .await
    }

    pub async fn mine(&self, requester: Uuid) -> AppResult<Vec<Ticket>> {
        self.repo.list_for_requester(requester, 100).await
    }

    /// The ticket and its conversation, without staff-only notes.
    pub async fn get_own(
        &self,
        requester: Uuid,
        id: Uuid,
    ) -> AppResult<(Ticket, Vec<TicketMessage>)> {
        let ticket = self.get_own_ticket(requester, id).await?;
        let messages = self.repo.messages(id, false).await?;
        Ok((ticket, messages))
    }

    /// The requester adds to the conversation. A reply to a ticket staff had
    /// resolved (or were waiting on) puts it back in the queue; a closed ticket
    /// takes no more replies.
    pub async fn reply_as_requester(
        &self,
        requester: Uuid,
        id: Uuid,
        body: &str,
    ) -> AppResult<TicketMessage> {
        let body = validate_message(body)?;
        let ticket = self.get_own_ticket(requester, id).await?;
        if ticket.status == "closed" {
            return Err(AppError::Conflict(
                "this request is closed — open a new one".into(),
            ));
        }
        let message = self
            .repo
            .add_message(id, requester, "requester", &body, false)
            .await?;
        self.repo.add_event(id, requester, "reply", "").await?;
        if matches!(ticket.status.as_str(), "resolved" | "waiting") {
            self.repo.set_status(id, "open").await?;
            self.repo
                .add_event(
                    id,
                    requester,
                    "status_changed",
                    &format!("{} -> open", ticket.status),
                )
                .await?;
        }
        if let Some(assignee) = ticket.assignee_account_id {
            self.notifications
                .notify_support(
                    assignee,
                    "ticket_reply",
                    "New reply on a ticket",
                    &format!("Re: {}", ticket.subject),
                    format!("/admin/tickets/{id}"),
                    id,
                )
                .await;
        }
        Ok(message)
    }

    pub async fn close_own(&self, requester: Uuid, id: Uuid) -> AppResult<Ticket> {
        let ticket = self.get_own_ticket(requester, id).await?;
        if ticket.status == "closed" {
            return Err(AppError::Conflict("this request is already closed".into()));
        }
        let closed = self.repo.set_status(id, "closed").await?;
        self.repo
            .add_event(id, requester, "closed", "closed by the requester")
            .await?;
        Ok(closed)
    }

    // ── staff ────────────────────────────────────────────────────────────

    pub async fn queue(
        &self,
        viewer: Uuid,
        p: QueueParams,
    ) -> AppResult<(Vec<Ticket>, Vec<StatusCount>)> {
        if let Some(s) = &p.status {
            if !STATUSES.contains(&s.as_str()) {
                return Err(invalid("status", "not a ticket status"));
            }
        }
        if let Some(k) = &p.kind {
            if !KINDS.contains(&k.as_str()) {
                return Err(invalid("kind", "not a ticket kind"));
            }
        }
        if let Some(a) = &p.assignee {
            if !matches!(a.as_str(), "mine" | "unassigned") {
                return Err(invalid("assignee", "must be `mine` or `unassigned`"));
            }
        }
        let tickets = self
            .repo
            .queue(QueueFilter {
                status: p.status,
                kind: p.kind,
                assignee: p.assignee,
                viewer: Some(viewer),
                query: p
                    .query
                    .map(|q| q.trim().to_string())
                    .filter(|q| !q.is_empty())
                    .map(|q| escape_like(&q)),
                limit: p.limit,
                offset: p.offset,
            })
            .await?;
        Ok((tickets, self.repo.counts_by_status().await?))
    }

    pub async fn staff_detail(&self, id: Uuid) -> AppResult<StaffDetail> {
        let ticket = self.get(id).await?;
        Ok(StaffDetail {
            messages: self.repo.messages(id, true).await?,
            events: self.repo.events(id).await?,
            requester: self
                .identity
                .account_summary(ticket.requester_account_id)
                .await,
            ticket,
        })
    }

    /// A staff reply (the requester is told) or an internal note (nobody is).
    /// A public reply on a ticket nobody owns makes the replier its owner, and
    /// on one still `open` or `in_progress` marks it as waiting on the requester.
    pub async fn staff_reply(
        &self,
        staff: Uuid,
        id: Uuid,
        body: &str,
        internal: bool,
    ) -> AppResult<TicketMessage> {
        let body = validate_message(body)?;
        let ticket = self.get(id).await?;
        if ticket.status == "closed" && !internal {
            return Err(AppError::Conflict(
                "this ticket is closed — reopen it first".into(),
            ));
        }
        let message = self
            .repo
            .add_message(id, staff, "staff", &body, internal)
            .await?;
        self.repo
            .add_event(
                id,
                staff,
                if internal { "internal_note" } else { "reply" },
                "",
            )
            .await?;
        if internal {
            return Ok(message);
        }
        if ticket.assignee_account_id.is_none() {
            self.repo.set_assignee(id, Some(staff)).await?;
            self.repo
                .add_event(id, staff, "assigned", "took the ticket by replying")
                .await?;
        }
        if matches!(ticket.status.as_str(), "open" | "in_progress") {
            self.repo.set_status(id, "waiting").await?;
            self.repo
                .add_event(
                    id,
                    staff,
                    "status_changed",
                    &format!("{} -> waiting", ticket.status),
                )
                .await?;
        }
        self.notifications
            .notify_support(
                ticket.requester_account_id,
                "ticket_reply",
                "Support replied to your request",
                &format!("Re: {}", ticket.subject),
                format!("/support/{id}"),
                id,
            )
            .await;
        Ok(message)
    }

    pub async fn staff_update(
        &self,
        staff: Uuid,
        id: Uuid,
        patch: StaffPatch,
    ) -> AppResult<Ticket> {
        let mut ticket = self.get(id).await?;

        if let Some(priority) = &patch.priority {
            if !PRIORITIES.contains(&priority.as_str()) {
                return Err(invalid("priority", "must be `low`, `normal` or `high`"));
            }
        }
        if let Some(status) = &patch.status {
            if !STATUSES.contains(&status.as_str()) {
                return Err(invalid("status", "not a ticket status"));
            }
            if !staff_can_move(&ticket.status, status) {
                return Err(AppError::Conflict(format!(
                    "a {} ticket can't move to {}",
                    ticket.status.replace('_', " "),
                    status.replace('_', " ")
                )));
            }
        }

        if let Some(priority) = &patch.priority {
            if *priority != ticket.priority {
                let detail = format!("{} -> {}", ticket.priority, priority);
                ticket = self.repo.set_priority(id, priority).await?;
                self.repo
                    .add_event(id, staff, "priority_changed", &detail)
                    .await?;
            }
        }
        if let Some(assignee) = patch.assignee {
            let target = match assignee {
                Assignee::Me => Some(staff),
                Assignee::Nobody => None,
                Assignee::Account(a) => Some(a),
            };
            if target != ticket.assignee_account_id {
                ticket = self.repo.set_assignee(id, target).await?;
                let detail = match target {
                    Some(a) if a == staff => "assigned to themselves".to_string(),
                    Some(a) => format!("assigned to {a}"),
                    None => "unassigned".to_string(),
                };
                self.repo.add_event(id, staff, "assigned", &detail).await?;
            }
        }
        if let Some(status) = &patch.status {
            let detail = format!("{} -> {}", ticket.status, status);
            ticket = self.repo.set_status(id, status).await?;
            self.repo
                .add_event(id, staff, "status_changed", &detail)
                .await?;
            if let Some((title, body)) = requester_message(status, &ticket.subject) {
                self.notifications
                    .notify_support(
                        ticket.requester_account_id,
                        "ticket_status",
                        title,
                        &body,
                        format!("/support/{id}"),
                        id,
                    )
                    .await;
            }
        }
        Ok(ticket)
    }
}

/// What the requester is told when staff move their ticket. Moves that are only
/// the team's bookkeeping (back to `open`, on to `waiting`) say nothing.
fn requester_message(status: &str, subject: &str) -> Option<(&'static str, String)> {
    match status {
        "in_progress" => Some(("We're working on your request", format!("Re: {subject}"))),
        "resolved" => Some((
            "Your request was marked resolved",
            format!("Re: {subject}. Reply if it isn't."),
        )),
        "closed" => Some(("Your request was closed", format!("Re: {subject}"))),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_new_ticket_is_checked_and_tidied() {
        let t = validate_new(
            "bug",
            "  Can't pay  ",
            "  The pay button does nothing.  ",
            None,
        )
        .unwrap();
        assert_eq!(t.subject, "Can't pay");
        assert_eq!(t.body, "The pay button does nothing.");
        assert!(t.context.is_object());
        assert!(
            validate_new("feedback", "Hello there", "Some body text", None).is_err(),
            "unknown kind"
        );
        assert!(
            validate_new("bug", "Hi", "Some body text", None).is_err(),
            "subject too short"
        );
        assert!(
            validate_new("bug", "Hello there", "no", None).is_err(),
            "body too short"
        );
        assert!(
            validate_new(
                "bug",
                "Hello there",
                "Some body text",
                Some(serde_json::json!([1]))
            )
            .is_err(),
            "context must be an object"
        );
        let big = serde_json::json!({ "x": "a".repeat(5000) });
        assert!(
            validate_new("bug", "Hello there", "Some body text", Some(big)).is_err(),
            "context too large"
        );
    }

    #[test]
    fn a_closed_ticket_can_only_be_reopened() {
        assert!(staff_can_move("open", "in_progress"));
        assert!(staff_can_move("resolved", "open"));
        assert!(staff_can_move("closed", "open"));
        assert!(!staff_can_move("closed", "resolved"));
        assert!(!staff_can_move("open", "open"));
    }

    #[test]
    fn search_text_is_matched_literally() {
        assert_eq!(escape_like("100%_done\\"), "100\\%\\_done\\\\");
        assert_eq!(escape_like("plain"), "plain");
    }

    #[test]
    fn replies_must_have_content() {
        assert!(validate_message("   ").is_err());
        assert_eq!(validate_message("  thanks ").unwrap(), "thanks");
        assert!(validate_message(&"x".repeat(4001)).is_err());
    }
}
