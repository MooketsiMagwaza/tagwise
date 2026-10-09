//! The signed-in account's own profile, preferences and sessions — what the
//! Settings screens read and write. Kept apart from `AuthRepository` so the
//! `Account` model used by sign-in isn't widened for a screen it never serves.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use tagwise_shared::database::DbPool;
use tagwise_shared::errors::AppResult;

use crate::models::account::AccountContact;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ProfileRow {
    pub id: Uuid,
    pub status: String,
    pub display_name: String,
    pub preferred_lang: String,
    pub preferences: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct SessionRow {
    pub id: Uuid,
    pub user_agent: Option<String>,
    pub ip: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct MeRepository {
    db: DbPool,
}

impl MeRepository {
    pub fn new(db: DbPool) -> Self {
        Self { db }
    }

    pub async fn profile(&self, account_id: Uuid) -> AppResult<Option<ProfileRow>> {
        Ok(sqlx::query_as::<_, ProfileRow>(
            "SELECT id, status, display_name, preferred_lang, preferences, created_at \
             FROM accounts WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(account_id)
        .fetch_optional(self.db.read())
        .await?)
    }

    pub async fn contacts(&self, account_id: Uuid) -> AppResult<Vec<AccountContact>> {
        Ok(sqlx::query_as::<_, AccountContact>(
            "SELECT * FROM account_contacts WHERE account_id = $1 ORDER BY is_primary DESC, created_at",
        )
        .bind(account_id)
        .fetch_all(self.db.read())
        .await?)
    }

    /// Each argument left `None` is left unchanged. `preferences` is merged
    /// into the stored object (top-level keys replace), never replaced
    /// wholesale, so two devices saving different settings don't clobber
    /// each other.
    pub async fn update_profile(
        &self,
        account_id: Uuid,
        display_name: Option<&str>,
        preferred_lang: Option<&str>,
        preferences: Option<serde_json::Value>,
    ) -> AppResult<bool> {
        let res = sqlx::query(
            "UPDATE accounts SET \
               display_name = COALESCE($2, display_name), \
               preferred_lang = COALESCE($3, preferred_lang), \
               preferences = CASE WHEN $4::jsonb IS NULL THEN preferences ELSE preferences || $4::jsonb END, \
               updated_at = now() \
             WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(account_id)
        .bind(display_name)
        .bind(preferred_lang)
        .bind(preferences)
        .execute(self.db.write())
        .await?;
        Ok(res.rows_affected() > 0)
    }

    /// What the notifications service needs to decide whether and how to notify
    /// an account: its saved notification preferences (may be null) and its
    /// primary email address, if it has one.
    pub async fn notification_settings(
        &self,
        account_id: Uuid,
    ) -> AppResult<(Option<serde_json::Value>, Option<String>)> {
        let row: Option<(Option<serde_json::Value>, Option<String>)> = sqlx::query_as(
            "SELECT a.preferences -> 'notifications', \
                    (SELECT c.identifier FROM account_contacts c \
                     WHERE c.account_id = a.id AND c.channel = 'email' \
                     ORDER BY c.is_primary DESC, c.created_at LIMIT 1) \
             FROM accounts a WHERE a.id = $1 AND a.deleted_at IS NULL",
        )
        .bind(account_id)
        .fetch_optional(self.db.read())
        .await?;
        Ok(row.unwrap_or((None, None)))
    }

    pub async fn list_sessions(&self, account_id: Uuid) -> AppResult<Vec<SessionRow>> {
        Ok(sqlx::query_as::<_, SessionRow>(
            "SELECT id, user_agent, ip, created_at, last_used_at, expires_at FROM sessions \
             WHERE account_id = $1 AND revoked_at IS NULL AND expires_at > now() \
             ORDER BY created_at DESC",
        )
        .bind(account_id)
        .fetch_all(self.db.read())
        .await?)
    }

    /// Scoped to the account so one user can never revoke another's session.
    pub async fn revoke_session(&self, account_id: Uuid, session_id: Uuid) -> AppResult<bool> {
        let res = sqlx::query(
            "UPDATE sessions SET revoked_at = now() \
             WHERE id = $1 AND account_id = $2 AND revoked_at IS NULL",
        )
        .bind(session_id)
        .bind(account_id)
        .execute(self.db.write())
        .await?;
        Ok(res.rows_affected() > 0)
    }

    pub async fn revoke_all_sessions(&self, account_id: Uuid) -> AppResult<u64> {
        let res = sqlx::query(
            "UPDATE sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL",
        )
        .bind(account_id)
        .execute(self.db.write())
        .await?;
        Ok(res.rows_affected())
    }

    /// Soft delete: the row stays (orders and the ledger reference it) but the
    /// account can no longer sign in or be found by its contacts.
    pub async fn soft_delete(&self, account_id: Uuid) -> AppResult<bool> {
        let res = sqlx::query(
            "UPDATE accounts SET status = 'deleted', deleted_at = now(), updated_at = now() \
             WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(account_id)
        .execute(self.db.write())
        .await?;
        Ok(res.rows_affected() > 0)
    }
}
