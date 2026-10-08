//! Admin console: finding, creating, suspending and removing accounts, and
//! their sessions. Read and write only what a staff member needs — never a
//! password hash, refresh secret or one-time code.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::models::account::{Account, AccountContact};
use tagwise_shared::database::DbPool;
use tagwise_shared::errors::AppResult;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AccountRow {
    pub id: Uuid,
    pub display_name: String,
    pub status: String,
    pub suspended_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub roles: Vec<String>,
    pub contact: Option<String>,
    pub last_active: Option<DateTime<Utc>>,
    pub active_sessions: i64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct SessionAdminRow {
    pub id: Uuid,
    pub user_agent: Option<String>,
    pub ip: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RoleCountRow {
    pub role: String,
    pub count: i64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AccountCountsRow {
    pub total: i64,
    pub active: i64,
    pub suspended: i64,
    pub new_7d: i64,
    pub active_sessions: i64,
}

#[derive(Debug, Default, Clone)]
pub struct AccountFilter {
    pub status: Option<String>,
    pub role: Option<String>,
    /// Text in the name or a contact, already escaped for `ILIKE`.
    pub query: Option<String>,
    pub limit: i64,
    pub offset: i64,
}

const SELECT_ROW: &str = "SELECT a.id, a.display_name, a.status, a.suspended_reason, a.created_at, \
       COALESCE((SELECT array_agg(r.role ORDER BY r.role) FROM account_roles r WHERE r.account_id = a.id), '{}') AS roles, \
       (SELECT c.identifier FROM account_contacts c WHERE c.id = a.primary_contact_id) AS contact, \
       (SELECT MAX(s.last_used_at) FROM sessions s WHERE s.account_id = a.id) AS last_active, \
       (SELECT COUNT(*) FROM sessions s WHERE s.account_id = a.id AND s.revoked_at IS NULL AND s.expires_at > now())::bigint AS active_sessions \
     FROM accounts a";

const FILTER: &str = " WHERE a.deleted_at IS NULL \
       AND ($1::text IS NULL OR a.status = $1) \
       AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM account_roles r WHERE r.account_id = a.id AND r.role = $2)) \
       AND ($3::text IS NULL OR a.display_name ILIKE '%' || $3 || '%' \
            OR EXISTS (SELECT 1 FROM account_contacts c WHERE c.account_id = a.id AND c.identifier ILIKE '%' || $3 || '%'))";

#[derive(Clone)]
pub struct AccountAdminRepository {
    db: DbPool,
}

impl AccountAdminRepository {
    pub fn new(db: DbPool) -> Self {
        Self { db }
    }

    pub async fn list(&self, f: &AccountFilter) -> AppResult<Vec<AccountRow>> {
        let sql = format!("{SELECT_ROW}{FILTER} ORDER BY a.created_at DESC LIMIT $4 OFFSET $5");
        Ok(sqlx::query_as::<_, AccountRow>(&sql)
            .bind(&f.status)
            .bind(&f.role)
            .bind(&f.query)
            .bind(f.limit.clamp(1, 200))
            .bind(f.offset.max(0))
            .fetch_all(self.db.read())
            .await?)
    }

    pub async fn count(&self, f: &AccountFilter) -> AppResult<i64> {
        let sql = format!("SELECT COUNT(*)::bigint FROM accounts a{FILTER}");
        Ok(sqlx::query_scalar(&sql)
            .bind(&f.status)
            .bind(&f.role)
            .bind(&f.query)
            .fetch_one(self.db.read())
            .await?)
    }

    pub async fn find(&self, id: Uuid) -> AppResult<Option<AccountRow>> {
        let sql = format!("{SELECT_ROW} WHERE a.id = $1 AND a.deleted_at IS NULL");
        Ok(sqlx::query_as::<_, AccountRow>(&sql)
            .bind(id)
            .fetch_optional(self.db.read())
            .await?)
    }

    pub async fn contacts(&self, id: Uuid) -> AppResult<Vec<AccountContact>> {
        Ok(sqlx::query_as::<_, AccountContact>(
            "SELECT * FROM account_contacts WHERE account_id = $1 ORDER BY is_primary DESC, created_at",
        )
        .bind(id)
        .fetch_all(self.db.read())
        .await?)
    }

    pub async fn sessions(&self, id: Uuid) -> AppResult<Vec<SessionAdminRow>> {
        Ok(sqlx::query_as::<_, SessionAdminRow>(
            "SELECT id, user_agent, ip, created_at, last_used_at, revoked_at, expires_at \
             FROM sessions WHERE account_id = $1 ORDER BY created_at DESC LIMIT 50",
        )
        .bind(id)
        .fetch_all(self.db.read())
        .await?)
    }

    /// Creates the account, its primary contact (not yet verified — the person
    /// proves it by signing in) and its roles, together.
    pub async fn create(
        &self,
        display_name: &str,
        channel: &str,
        identifier: &str,
        roles: &[String],
    ) -> AppResult<Account> {
        let mut tx = self.db.write().begin().await?;
        let account = sqlx::query_as::<_, Account>(
            "INSERT INTO accounts (display_name) VALUES ($1) RETURNING *",
        )
        .bind(display_name)
        .fetch_one(&mut *tx)
        .await?;
        let contact_id: Uuid = sqlx::query_scalar(
            "INSERT INTO account_contacts (account_id, channel, identifier, is_primary) \
             VALUES ($1, $2, $3, true) RETURNING id",
        )
        .bind(account.id)
        .bind(channel)
        .bind(identifier)
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query("UPDATE accounts SET primary_contact_id = $1 WHERE id = $2")
            .bind(contact_id)
            .bind(account.id)
            .execute(&mut *tx)
            .await?;
        for role in roles {
            sqlx::query("INSERT INTO account_roles (account_id, role) VALUES ($1, $2)")
                .bind(account.id)
                .bind(role)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await?;
        Ok(account)
    }

    /// `true` if an active account was changed.
    pub async fn suspend(&self, id: Uuid, reason: &str) -> AppResult<bool> {
        let res = sqlx::query(
            "UPDATE accounts SET status = 'suspended', suspended_at = now(), suspended_reason = $2, updated_at = now() \
             WHERE id = $1 AND status = 'active' AND deleted_at IS NULL",
        )
        .bind(id)
        .bind(reason)
        .execute(self.db.write())
        .await?;
        Ok(res.rows_affected() > 0)
    }

    /// `true` if a suspended account was reinstated.
    pub async fn reinstate(&self, id: Uuid) -> AppResult<bool> {
        let res = sqlx::query(
            "UPDATE accounts SET status = 'active', suspended_at = NULL, suspended_reason = NULL, updated_at = now() \
             WHERE id = $1 AND status = 'suspended' AND deleted_at IS NULL",
        )
        .bind(id)
        .execute(self.db.write())
        .await?;
        Ok(res.rows_affected() > 0)
    }

    /// Soft delete (orders and the ledger still refer to the account), and
    /// end everything that could act as it: sessions and API keys.
    pub async fn remove(&self, id: Uuid) -> AppResult<bool> {
        let mut tx = self.db.write().begin().await?;
        let res = sqlx::query(
            "UPDATE accounts SET status = 'deleted', deleted_at = now(), updated_at = now() \
             WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;
        if res.rows_affected() == 0 {
            return Ok(false);
        }
        sqlx::query(
            "UPDATE sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "UPDATE api_keys SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(true)
    }

    /// Ends one session; returns whose it was.
    pub async fn revoke_session(&self, session_id: Uuid) -> AppResult<Option<Uuid>> {
        Ok(sqlx::query_scalar(
            "UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING account_id",
        )
        .bind(session_id)
        .fetch_optional(self.db.write())
        .await?)
    }

    pub async fn revoke_all_sessions(&self, account_id: Uuid) -> AppResult<u64> {
        Ok(sqlx::query(
            "UPDATE sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL",
        )
        .bind(account_id)
        .execute(self.db.write())
        .await?
        .rows_affected())
    }

    /// Active admins other than `except` — the check that stops the last one
    /// being suspended or deleted.
    pub async fn other_active_admins(&self, except: Uuid) -> AppResult<i64> {
        Ok(sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM accounts a \
             JOIN account_roles r ON r.account_id = a.id AND r.role = 'admin' \
             WHERE a.status = 'active' AND a.deleted_at IS NULL AND a.id <> $1",
        )
        .bind(except)
        .fetch_one(self.db.read())
        .await?)
    }

    pub async fn counts(&self) -> AppResult<AccountCountsRow> {
        Ok(sqlx::query_as::<_, AccountCountsRow>(
            "SELECT \
               (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL)::bigint AS total, \
               (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL AND status = 'active')::bigint AS active, \
               (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL AND status = 'suspended')::bigint AS suspended, \
               (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL AND created_at > now() - interval '7 days')::bigint AS new_7d, \
               (SELECT COUNT(*) FROM sessions WHERE revoked_at IS NULL AND expires_at > now())::bigint AS active_sessions",
        )
        .fetch_one(self.db.read())
        .await?)
    }

    pub async fn role_counts(&self) -> AppResult<Vec<RoleCountRow>> {
        Ok(sqlx::query_as::<_, RoleCountRow>(
            "SELECT r.role, COUNT(*)::bigint AS count FROM account_roles r \
             JOIN accounts a ON a.id = r.account_id \
             WHERE a.deleted_at IS NULL GROUP BY r.role ORDER BY r.role",
        )
        .fetch_all(self.db.read())
        .await?)
    }
}
