//! The in-app notification inbox (the bell, `/v1/notifications`).

use uuid::Uuid;

use crate::models::notification::Notification;
use tagwise_shared::database::DbPool;
use tagwise_shared::errors::AppResult;

pub struct Listing {
    pub unread_only: bool,
    pub limit: i64,
}

#[derive(Clone)]
pub struct NotificationRepository {
    db: DbPool,
}

impl NotificationRepository {
    pub fn new(db: DbPool) -> Self {
        Self { db }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        &self,
        account_id: Uuid,
        category: &str,
        kind: &str,
        title: &str,
        body: &str,
        link: Option<&str>,
        data: serde_json::Value,
    ) -> AppResult<Notification> {
        Ok(sqlx::query_as::<_, Notification>(
            "INSERT INTO notifications (account_id, category, kind, title, body, link, data) \
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        )
        .bind(account_id)
        .bind(category)
        .bind(kind)
        .bind(title)
        .bind(body)
        .bind(link)
        .bind(data)
        .fetch_one(self.db.write())
        .await?)
    }

    pub async fn list(&self, account_id: Uuid, q: Listing) -> AppResult<Vec<Notification>> {
        Ok(sqlx::query_as::<_, Notification>(
            "SELECT * FROM notifications \
             WHERE account_id = $1 AND ($2 = false OR read_at IS NULL) \
             ORDER BY created_at DESC LIMIT $3",
        )
        .bind(account_id)
        .bind(q.unread_only)
        .bind(q.limit.clamp(1, 200))
        .fetch_all(self.db.read())
        .await?)
    }

    pub async fn unread_count(&self, account_id: Uuid) -> AppResult<i64> {
        Ok(sqlx::query_scalar(
            "SELECT COUNT(*) FROM notifications WHERE account_id = $1 AND read_at IS NULL",
        )
        .bind(account_id)
        .fetch_one(self.db.read())
        .await?)
    }

    pub async fn mark_read(&self, account_id: Uuid, id: Uuid) -> AppResult<bool> {
        let result = sqlx::query(
            "UPDATE notifications SET read_at = now() WHERE id = $1 AND account_id = $2 AND read_at IS NULL",
        )
        .bind(id)
        .bind(account_id)
        .execute(self.db.write())
        .await?;
        Ok(result.rows_affected() == 1)
    }

    pub async fn mark_all_read(&self, account_id: Uuid) -> AppResult<u64> {
        let result = sqlx::query(
            "UPDATE notifications SET read_at = now() WHERE account_id = $1 AND read_at IS NULL",
        )
        .bind(account_id)
        .execute(self.db.write())
        .await?;
        Ok(result.rows_affected())
    }

    pub async fn delete(&self, account_id: Uuid, id: Uuid) -> AppResult<bool> {
        let result = sqlx::query("DELETE FROM notifications WHERE id = $1 AND account_id = $2")
            .bind(id)
            .bind(account_id)
            .execute(self.db.write())
            .await?;
        Ok(result.rows_affected() == 1)
    }

    pub async fn clear(&self, account_id: Uuid) -> AppResult<u64> {
        let result = sqlx::query("DELETE FROM notifications WHERE account_id = $1")
            .bind(account_id)
            .execute(self.db.write())
            .await?;
        Ok(result.rows_affected())
    }
}
