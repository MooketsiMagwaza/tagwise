//! The ops audit log: append-only.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use tagwise_shared::database::DbPool;
use tagwise_shared::errors::AppResult;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AuditEntry {
    pub id: Uuid,
    pub actor_account_id: Uuid,
    pub action: String,
    pub target: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct AuditRepository {
    db: DbPool,
}

impl AuditRepository {
    pub fn new(db: DbPool) -> Self {
        Self { db }
    }

    pub async fn record(
        &self,
        actor: Uuid,
        action: &str,
        target: Option<&str>,
        metadata: serde_json::Value,
    ) -> AppResult<()> {
        sqlx::query("INSERT INTO audit_log (actor_account_id, action, target, metadata) VALUES ($1, $2, $3, $4)")
            .bind(actor)
            .bind(action)
            .bind(target)
            .bind(metadata)
            .execute(self.db.write())
            .await?;
        Ok(())
    }

    pub async fn recent(&self, limit: i64) -> AppResult<Vec<AuditEntry>> {
        Ok(sqlx::query_as::<_, AuditEntry>(
            "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1",
        )
        .bind(limit.clamp(1, 500))
        .fetch_all(self.db.read())
        .await?)
    }
}
