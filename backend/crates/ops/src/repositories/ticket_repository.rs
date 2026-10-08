//! Support tickets, their messages and their audit trail.

use uuid::Uuid;

use crate::models::ticket::{StatusCount, Ticket, TicketEvent, TicketMessage};
use tagwise_shared::database::DbPool;
use tagwise_shared::errors::AppResult;

/// What the staff queue is filtered by. Every field is optional; `None` means
/// "don't filter on this".
#[derive(Debug, Default, Clone)]
pub struct QueueFilter {
    pub status: Option<String>,
    pub kind: Option<String>,
    /// `mine`, `unassigned`, or `None` for anyone.
    pub assignee: Option<String>,
    /// The viewer, for `mine`.
    pub viewer: Option<Uuid>,
    /// Text to look for in the subject or body (already escaped for `ILIKE`).
    pub query: Option<String>,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Clone)]
pub struct TicketRepository {
    db: DbPool,
}

impl TicketRepository {
    pub fn new(db: DbPool) -> Self {
        Self { db }
    }

    /// Creates the ticket and records that it was created, together.
    pub async fn create(
        &self,
        requester: Uuid,
        kind: &str,
        subject: &str,
        body: &str,
        context: serde_json::Value,
    ) -> AppResult<Ticket> {
        let mut tx = self.db.write().begin().await?;
        let ticket = sqlx::query_as::<_, Ticket>(
            "INSERT INTO tickets (requester_account_id, kind, subject, body, context) \
             VALUES ($1, $2, $3, $4, $5) RETURNING *",
        )
        .bind(requester)
        .bind(kind)
        .bind(subject)
        .bind(body)
        .bind(context)
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query("INSERT INTO ticket_events (ticket_id, actor_account_id, kind, detail) VALUES ($1, $2, 'created', $3)")
            .bind(ticket.id)
            .bind(requester)
            .bind(kind)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(ticket)
    }

    pub async fn find(&self, id: Uuid) -> AppResult<Option<Ticket>> {
        Ok(
            sqlx::query_as::<_, Ticket>("SELECT * FROM tickets WHERE id = $1")
                .bind(id)
                .fetch_optional(self.db.read())
                .await?,
        )
    }

    pub async fn list_for_requester(&self, requester: Uuid, limit: i64) -> AppResult<Vec<Ticket>> {
        Ok(sqlx::query_as::<_, Ticket>(
            "SELECT * FROM tickets WHERE requester_account_id = $1 \
             ORDER BY (status IN ('resolved', 'closed')), updated_at DESC LIMIT $2",
        )
        .bind(requester)
        .bind(limit.clamp(1, 200))
        .fetch_all(self.db.read())
        .await?)
    }

    /// How many tickets the requester has that aren't finished — the cap that
    /// stops one account flooding the queue.
    pub async fn count_unfinished(&self, requester: Uuid) -> AppResult<i64> {
        Ok(sqlx::query_scalar(
            "SELECT COUNT(*) FROM tickets WHERE requester_account_id = $1 \
             AND status NOT IN ('resolved', 'closed')",
        )
        .bind(requester)
        .fetch_one(self.db.read())
        .await?)
    }

    pub async fn messages(
        &self,
        ticket_id: Uuid,
        include_internal: bool,
    ) -> AppResult<Vec<TicketMessage>> {
        Ok(sqlx::query_as::<_, TicketMessage>(
            "SELECT * FROM ticket_messages WHERE ticket_id = $1 AND ($2 OR NOT internal) \
             ORDER BY created_at",
        )
        .bind(ticket_id)
        .bind(include_internal)
        .fetch_all(self.db.read())
        .await?)
    }

    pub async fn add_message(
        &self,
        ticket_id: Uuid,
        author: Uuid,
        author_kind: &str,
        body: &str,
        internal: bool,
    ) -> AppResult<TicketMessage> {
        let mut tx = self.db.write().begin().await?;
        let message = sqlx::query_as::<_, TicketMessage>(
            "INSERT INTO ticket_messages (ticket_id, author_account_id, author_kind, body, internal) \
             VALUES ($1, $2, $3, $4, $5) RETURNING *",
        )
        .bind(ticket_id)
        .bind(author)
        .bind(author_kind)
        .bind(body)
        .bind(internal)
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query("UPDATE tickets SET updated_at = now() WHERE id = $1")
            .bind(ticket_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(message)
    }

    pub async fn events(&self, ticket_id: Uuid) -> AppResult<Vec<TicketEvent>> {
        Ok(sqlx::query_as::<_, TicketEvent>(
            "SELECT * FROM ticket_events WHERE ticket_id = $1 ORDER BY created_at",
        )
        .bind(ticket_id)
        .fetch_all(self.db.read())
        .await?)
    }

    pub async fn add_event(
        &self,
        ticket_id: Uuid,
        actor: Uuid,
        kind: &str,
        detail: &str,
    ) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO ticket_events (ticket_id, actor_account_id, kind, detail) VALUES ($1, $2, $3, $4)",
        )
        .bind(ticket_id)
        .bind(actor)
        .bind(kind)
        .bind(detail)
        .execute(self.db.write())
        .await?;
        Ok(())
    }

    /// Sets the status, stamping `resolved_at` when it is finished and clearing
    /// it when the ticket is reopened.
    pub async fn set_status(&self, id: Uuid, status: &str) -> AppResult<Ticket> {
        Ok(sqlx::query_as::<_, Ticket>(
            "UPDATE tickets SET status = $2, updated_at = now(), \
               resolved_at = CASE WHEN $2 IN ('resolved', 'closed') THEN COALESCE(resolved_at, now()) ELSE NULL END \
             WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(status)
        .fetch_one(self.db.write())
        .await?)
    }

    pub async fn set_priority(&self, id: Uuid, priority: &str) -> AppResult<Ticket> {
        Ok(sqlx::query_as::<_, Ticket>(
            "UPDATE tickets SET priority = $2, updated_at = now() WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(priority)
        .fetch_one(self.db.write())
        .await?)
    }

    pub async fn set_assignee(&self, id: Uuid, assignee: Option<Uuid>) -> AppResult<Ticket> {
        Ok(sqlx::query_as::<_, Ticket>(
            "UPDATE tickets SET assignee_account_id = $2, updated_at = now() WHERE id = $1 RETURNING *",
        )
        .bind(id)
        .bind(assignee)
        .fetch_one(self.db.write())
        .await?)
    }

    /// The staff queue: unfinished tickets first, high priority before low,
    /// most recently touched first.
    pub async fn queue(&self, f: QueueFilter) -> AppResult<Vec<Ticket>> {
        Ok(sqlx::query_as::<_, Ticket>(
            "SELECT * FROM tickets \
             WHERE ($1::text IS NULL OR status = $1) \
               AND ($2::text IS NULL OR kind = $2) \
               AND ($3::text IS NULL \
                    OR ($3 = 'unassigned' AND assignee_account_id IS NULL) \
                    OR ($3 = 'mine' AND assignee_account_id = $4)) \
               AND ($5::text IS NULL OR subject ILIKE '%' || $5 || '%' OR body ILIKE '%' || $5 || '%') \
             ORDER BY (status IN ('resolved', 'closed')), \
                      CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, \
                      updated_at DESC \
             LIMIT $6 OFFSET $7",
        )
        .bind(f.status)
        .bind(f.kind)
        .bind(f.assignee)
        .bind(f.viewer)
        .bind(f.query)
        .bind(f.limit.clamp(1, 200))
        .bind(f.offset.max(0))
        .fetch_all(self.db.read())
        .await?)
    }

    pub async fn counts_by_status(&self) -> AppResult<Vec<StatusCount>> {
        Ok(sqlx::query_as::<_, StatusCount>(
            "SELECT status, COUNT(*)::bigint AS count FROM tickets GROUP BY status",
        )
        .fetch_all(self.db.read())
        .await?)
    }
}
