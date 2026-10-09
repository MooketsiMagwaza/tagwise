//! API keys. Only a key's SHA-256 is stored; the key itself exists in memory
//! for the one response that shows it to the person who made it.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use tagwise_shared::database::DbPool;
use tagwise_shared::errors::AppResult;

/// A key as a list shows it: which one, whose, and how it's doing — never the
/// key and never its hash.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ApiKeyRow {
    pub id: Uuid,
    pub account_id: Uuid,
    pub owner_name: String,
    pub name: String,
    pub prefix: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
}

const SELECT: &str =
    "SELECT k.id, k.account_id, a.display_name AS owner_name, k.name, k.prefix, k.created_by, \
       k.created_at, k.expires_at, k.last_used_at, k.revoked_at \
     FROM api_keys k JOIN accounts a ON a.id = k.account_id";

#[derive(Clone)]
pub struct ApiKeyRepository {
    db: DbPool,
}

impl ApiKeyRepository {
    pub fn new(db: DbPool) -> Self {
        Self { db }
    }

    pub async fn create(
        &self,
        account_id: Uuid,
        name: &str,
        prefix: &str,
        key_hash: &str,
        created_by: Uuid,
        expires_in_days: Option<i64>,
    ) -> AppResult<ApiKeyRow> {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO api_keys (account_id, name, prefix, key_hash, created_by, expires_at) \
             VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::bigint IS NULL THEN NULL ELSE now() + make_interval(days => $6::int) END) \
             RETURNING id",
        )
        .bind(account_id)
        .bind(name)
        .bind(prefix)
        .bind(key_hash)
        .bind(created_by)
        .bind(expires_in_days)
        .fetch_one(self.db.write())
        .await?;
        Ok(self.find(id).await?.expect("just inserted"))
    }

    pub async fn find(&self, id: Uuid) -> AppResult<Option<ApiKeyRow>> {
        let sql = format!("{SELECT} WHERE k.id = $1");
        Ok(sqlx::query_as::<_, ApiKeyRow>(&sql)
            .bind(id)
            .fetch_optional(self.db.read())
            .await?)
    }

    /// Newest first; optionally only one account's.
    pub async fn list(&self, account_id: Option<Uuid>) -> AppResult<Vec<ApiKeyRow>> {
        let sql = format!("{SELECT} WHERE ($1::uuid IS NULL OR k.account_id = $1) ORDER BY k.created_at DESC LIMIT 200");
        Ok(sqlx::query_as::<_, ApiKeyRow>(&sql)
            .bind(account_id)
            .fetch_all(self.db.read())
            .await?)
    }

    /// `true` if a live key was revoked.
    pub async fn revoke(&self, id: Uuid) -> AppResult<bool> {
        Ok(sqlx::query(
            "UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
        )
        .bind(id)
        .execute(self.db.write())
        .await?
        .rows_affected()
            > 0)
    }

    /// The key (and its owner) a presented key's hash belongs to, if it is
    /// neither revoked nor expired.
    pub async fn find_live_by_hash(&self, key_hash: &str) -> AppResult<Option<(Uuid, Uuid)>> {
        Ok(sqlx::query_as::<_, (Uuid, Uuid)>(
            "SELECT id, account_id FROM api_keys \
             WHERE key_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())",
        )
        .bind(key_hash)
        .fetch_optional(self.db.read())
        .await?)
    }

    pub async fn touch(&self, id: Uuid) -> AppResult<()> {
        sqlx::query("UPDATE api_keys SET last_used_at = now() WHERE id = $1")
            .bind(id)
            .execute(self.db.write())
            .await?;
        Ok(())
    }
}
