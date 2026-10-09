//! Data access for the register. Runtime-checked queries (no compile-time
//! database needed). Every read and write is scoped by workspace, so a
//! member of one workspace can never reach another's rows: a wrong
//! workspace looks exactly like a missing row.

use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use sqlx::FromRow;
use tagwise_shared::database::DbPool;
use tagwise_shared::errors::{AppError, AppResult};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::domain::{classify_scan, is_conflict, ScanResult};

#[derive(Debug, Clone, Serialize, FromRow, ToSchema)]
pub struct Workspace {
    pub id: Uuid,
    pub name: String,
    pub tag_prefix: String,
    pub currency: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow, ToSchema)]
pub struct Site {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub kind: String,
    pub town: String,
    pub address: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
}

#[derive(Debug, Clone, Serialize, FromRow, ToSchema)]
pub struct Asset {
    pub id: Uuid,
    pub tag: String,
    pub name: String,
    pub category: String,
    pub model: Option<String>,
    pub serial: Option<String>,
    pub site_id: Uuid,
    pub place_id: Option<Uuid>,
    pub status: String,
    pub custodian_id: Option<Uuid>,
    pub due_back: Option<NaiveDate>,
    pub purchased_on: Option<NaiveDate>,
    pub notes: Option<String>,
    pub updated_at: DateTime<Utc>,
    pub updated_by: Uuid,
    pub version: i32,
}

#[derive(Debug, Clone, Serialize, FromRow, ToSchema)]
pub struct StockLine {
    pub id: Uuid,
    pub site_id: Uuid,
    pub place_id: Option<Uuid>,
    pub sku: String,
    pub barcode: Option<String>,
    pub name: String,
    pub category: String,
    pub unit: String,
    pub quantity: i32,
    pub reorder_at: i32,
    pub batch: Option<String>,
    pub expires_on: Option<NaiveDate>,
    pub version: i32,
}

#[derive(Debug, Clone, Serialize, FromRow, ToSchema)]
pub struct Count {
    pub id: Uuid,
    pub site_id: Uuid,
    pub name: String,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub started_by: Uuid,
    pub closed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, FromRow, ToSchema)]
pub struct Comment {
    pub id: Uuid,
    pub target_type: String,
    pub target_id: Uuid,
    pub author_id: Uuid,
    pub body: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow, ToSchema)]
pub struct ActivityEntry {
    pub id: Uuid,
    pub at: DateTime<Utc>,
    pub actor_id: Uuid,
    pub kind: String,
    pub target_type: Option<String>,
    pub target_id: Option<Uuid>,
    pub target_label: Option<String>,
    pub summary: String,
    #[schema(value_type = Object)]
    pub changes: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct RegisterStats {
    pub workspaces_total: i64,
    pub assets_total: i64,
    pub assets_checked_out: i64,
    pub assets_overdue: i64,
    pub assets_missing: i64,
    pub stock_lines_low: i64,
    pub counts_open: i64,
}

/// The fields an asset edit may change.
#[derive(Debug, Clone, Default)]
pub struct AssetPatch {
    pub name: Option<String>,
    pub category: Option<String>,
    pub model: Option<String>,
    pub serial: Option<String>,
    pub site_id: Option<Uuid>,
    pub place_id: Option<Uuid>,
    pub status: Option<String>,
    pub notes: Option<String>,
}

pub enum EditOutcome<T> {
    Saved(T),
    /// Someone saved a newer version first; here it is.
    Conflict(T),
}

#[derive(Clone)]
pub struct RegisterRepository {
    db: DbPool,
}

impl RegisterRepository {
    pub fn new(db: DbPool) -> Self {
        Self { db }
    }

    /// The caller's role in a workspace, or "not found" if they are not a
    /// member (the same answer as for a workspace that does not exist).
    pub async fn role_in(&self, workspace_id: Uuid, account_id: Uuid) -> AppResult<String> {
        sqlx::query_scalar::<_, String>(
            "SELECT role FROM memberships WHERE workspace_id = $1 AND account_id = $2",
        )
        .bind(workspace_id)
        .bind(account_id)
        .fetch_optional(self.db.read())
        .await?
        .ok_or(AppError::NotFound("workspace"))
    }

    pub async fn my_workspaces(&self, account_id: Uuid) -> AppResult<Vec<Workspace>> {
        Ok(sqlx::query_as::<_, Workspace>(
            "SELECT w.* FROM workspaces w JOIN memberships m ON m.workspace_id = w.id \
             WHERE m.account_id = $1 ORDER BY w.name",
        )
        .bind(account_id)
        .fetch_all(self.db.read())
        .await?)
    }

    /// Creates a workspace with the caller as its owner, in one transaction.
    pub async fn create_workspace(
        &self,
        name: &str,
        tag_prefix: &str,
        owner: Uuid,
    ) -> AppResult<Workspace> {
        let mut tx = self.db.write().begin().await?;
        let ws = sqlx::query_as::<_, Workspace>(
            "INSERT INTO workspaces (name, tag_prefix) VALUES ($1, $2) RETURNING *",
        )
        .bind(name)
        .bind(tag_prefix)
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO memberships (workspace_id, account_id, role) VALUES ($1, $2, 'owner')",
        )
        .bind(ws.id)
        .bind(owner)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(ws)
    }

    pub async fn sites(&self, workspace_id: Uuid) -> AppResult<Vec<Site>> {
        Ok(sqlx::query_as::<_, Site>(
            "SELECT id, code, name, kind, town, address, lat, lng FROM sites \
             WHERE workspace_id = $1 ORDER BY name",
        )
        .bind(workspace_id)
        .fetch_all(self.db.read())
        .await?)
    }

    const ASSET_COLUMNS: &'static str =
        "id, tag, name, category, model, serial, site_id, place_id, status, \
         custodian_id, due_back, purchased_on, notes, updated_at, updated_by, version";

    pub async fn assets(
        &self,
        workspace_id: Uuid,
        status: Option<&str>,
        limit: i64,
    ) -> AppResult<Vec<Asset>> {
        let sql = format!(
            "SELECT {} FROM assets WHERE workspace_id = $1 AND ($2::text IS NULL OR status = $2) \
             ORDER BY tag LIMIT $3",
            Self::ASSET_COLUMNS
        );
        Ok(sqlx::query_as::<_, Asset>(&sql)
            .bind(workspace_id)
            .bind(status)
            .bind(limit)
            .fetch_all(self.db.read())
            .await?)
    }

    pub async fn asset(&self, workspace_id: Uuid, id: Uuid) -> AppResult<Asset> {
        let sql = format!(
            "SELECT {} FROM assets WHERE workspace_id = $1 AND id = $2",
            Self::ASSET_COLUMNS
        );
        sqlx::query_as::<_, Asset>(&sql)
            .bind(workspace_id)
            .bind(id)
            .fetch_optional(self.db.read())
            .await?
            .ok_or(AppError::NotFound("asset"))
    }

    /// Applies an edit only if the stored version is the one the caller saw.
    /// The check and the write are one conditional UPDATE, so two editors
    /// racing can never both win.
    pub async fn update_asset(
        &self,
        workspace_id: Uuid,
        id: Uuid,
        expected_version: i32,
        patch: &AssetPatch,
        actor: Uuid,
    ) -> AppResult<EditOutcome<Asset>> {
        let sql = format!(
            "UPDATE assets SET \
               name = COALESCE($4, name), category = COALESCE($5, category), \
               model = COALESCE($6, model), serial = COALESCE($7, serial), \
               site_id = COALESCE($8, site_id), place_id = COALESCE($9, place_id), \
               status = COALESCE($10, status), notes = COALESCE($11, notes), \
               updated_at = now(), updated_by = $12, version = version + 1 \
             WHERE workspace_id = $1 AND id = $2 AND version = $3 \
             RETURNING {}",
            Self::ASSET_COLUMNS
        );
        let updated = sqlx::query_as::<_, Asset>(&sql)
            .bind(workspace_id)
            .bind(id)
            .bind(expected_version)
            .bind(&patch.name)
            .bind(&patch.category)
            .bind(&patch.model)
            .bind(&patch.serial)
            .bind(patch.site_id)
            .bind(patch.place_id)
            .bind(&patch.status)
            .bind(&patch.notes)
            .bind(actor)
            .fetch_optional(self.db.write())
            .await?;
        match updated {
            Some(asset) => Ok(EditOutcome::Saved(asset)),
            None => {
                let current = self.asset(workspace_id, id).await?;
                debug_assert!(is_conflict(expected_version, current.version));
                Ok(EditOutcome::Conflict(current))
            }
        }
    }

    pub async fn stock(&self, workspace_id: Uuid) -> AppResult<Vec<StockLine>> {
        Ok(sqlx::query_as::<_, StockLine>(
            "SELECT id, site_id, place_id, sku, barcode, name, category, unit, quantity, \
                    reorder_at, batch, expires_on, version \
             FROM stock_lines WHERE workspace_id = $1 ORDER BY name, site_id",
        )
        .bind(workspace_id)
        .fetch_all(self.db.read())
        .await?)
    }

    /// Receives (positive) or issues (negative) stock, once per idempotency
    /// key. The decrement is conditional (`quantity + delta >= 0`), the
    /// pattern from the owner's earlier commerce service, so concurrent
    /// issues can never take a line below zero. Returns the line after the
    /// change, or after the earlier change if this key was already applied.
    pub async fn adjust_stock(
        &self,
        workspace_id: Uuid,
        id: Uuid,
        delta: i32,
        reason: &str,
        idempotency_key: &str,
        actor: Uuid,
    ) -> AppResult<StockLine> {
        let mut tx = self.db.write().begin().await?;
        let replay: Option<i32> = sqlx::query_scalar(
            "SELECT m.quantity_after FROM stock_movements m JOIN stock_lines s ON s.id = m.stock_line_id \
             WHERE s.workspace_id = $1 AND m.stock_line_id = $2 AND m.idempotency_key = $3",
        )
        .bind(workspace_id)
        .bind(id)
        .bind(idempotency_key)
        .fetch_optional(&mut *tx)
        .await?;
        if replay.is_none() {
            let after: Option<i32> = sqlx::query_scalar(
                "UPDATE stock_lines SET quantity = quantity + $3, updated_at = now(), \
                        updated_by = $4, version = version + 1 \
                 WHERE workspace_id = $1 AND id = $2 AND quantity + $3 >= 0 \
                 RETURNING quantity",
            )
            .bind(workspace_id)
            .bind(id)
            .bind(delta)
            .bind(actor)
            .fetch_optional(&mut *tx)
            .await?;
            let Some(after) = after else {
                // Either the line is not in this workspace, or there is not enough.
                let exists: Option<i32> = sqlx::query_scalar(
                    "SELECT quantity FROM stock_lines WHERE workspace_id = $1 AND id = $2",
                )
                .bind(workspace_id)
                .bind(id)
                .fetch_optional(&mut *tx)
                .await?;
                return Err(match exists {
                    None => AppError::NotFound("stock line"),
                    Some(on_hand) => AppError::Conflict(format!("only {on_hand} on hand")),
                });
            };
            sqlx::query(
                "INSERT INTO stock_movements (stock_line_id, delta, reason, actor_id, idempotency_key, quantity_after) \
                 VALUES ($1, $2, $3, $4, $5, $6)",
            )
            .bind(id)
            .bind(delta)
            .bind(reason)
            .bind(actor)
            .bind(idempotency_key)
            .bind(after)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        let line = self
            .stock(workspace_id)
            .await?
            .into_iter()
            .find(|l| l.id == id)
            .ok_or(AppError::NotFound("stock line"))?;
        Ok(line)
    }

    pub async fn counts(&self, workspace_id: Uuid) -> AppResult<Vec<Count>> {
        Ok(sqlx::query_as::<_, Count>(
            "SELECT id, site_id, name, status, started_at, started_by, closed_at FROM counts \
             WHERE workspace_id = $1 ORDER BY started_at DESC",
        )
        .bind(workspace_id)
        .fetch_all(self.db.read())
        .await?)
    }

    /// Starts a stock-take and snapshots what the register expects at the site.
    pub async fn start_count(
        &self,
        workspace_id: Uuid,
        site_id: Uuid,
        name: &str,
        actor: Uuid,
    ) -> AppResult<Count> {
        let mut tx = self.db.write().begin().await?;
        let count = sqlx::query_as::<_, Count>(
            "INSERT INTO counts (workspace_id, site_id, name, started_by) \
             SELECT $1, s.id, $3, $4 FROM sites s WHERE s.id = $2 AND s.workspace_id = $1 \
             RETURNING id, site_id, name, status, started_at, started_by, closed_at",
        )
        .bind(workspace_id)
        .bind(site_id)
        .bind(name)
        .bind(actor)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound("site"))?;
        sqlx::query(
            "INSERT INTO count_expected (count_id, asset_id, place_id) \
             SELECT $1, a.id, a.place_id FROM assets a \
             WHERE a.workspace_id = $2 AND a.site_id = $3 AND a.status NOT IN ('retired', 'checked_out')",
        )
        .bind(count.id)
        .bind(workspace_id)
        .bind(site_id)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(count)
    }

    /// Records one scan and says what it means (see `domain::classify_scan`).
    pub async fn record_scan(
        &self,
        workspace_id: Uuid,
        count_id: Uuid,
        code: &str,
        place_id: Option<Uuid>,
        actor: Uuid,
    ) -> AppResult<ScanResult> {
        let open: Option<String> =
            sqlx::query_scalar("SELECT status FROM counts WHERE workspace_id = $1 AND id = $2")
                .bind(workspace_id)
                .bind(count_id)
                .fetch_optional(self.db.read())
                .await?;
        match open.as_deref() {
            None => return Err(AppError::NotFound("stock-take")),
            Some("closed") => return Err(AppError::Conflict("this stock-take is closed".into())),
            _ => {}
        }
        let asset_id: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM assets WHERE workspace_id = $1 AND lower(tag) = lower($2)",
        )
        .bind(workspace_id)
        .bind(code.trim())
        .fetch_optional(self.db.read())
        .await?;
        let (already, expected) = match asset_id {
            None => (false, None),
            Some(a) => {
                let already: bool = sqlx::query_scalar(
                    "SELECT EXISTS (SELECT 1 FROM count_scans WHERE count_id = $1 AND asset_id = $2 AND result <> 'repeat')",
                )
                .bind(count_id)
                .bind(a)
                .fetch_one(self.db.read())
                .await?;
                let expected: Option<Option<Uuid>> = sqlx::query_scalar(
                    "SELECT place_id FROM count_expected WHERE count_id = $1 AND asset_id = $2",
                )
                .bind(count_id)
                .bind(a)
                .fetch_optional(self.db.read())
                .await?;
                (already, expected)
            }
        };
        let result = classify_scan(asset_id.is_some(), already, expected, place_id);
        sqlx::query(
            "INSERT INTO count_scans (count_id, code, asset_id, place_id, by_account, result) \
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(count_id)
        .bind(code.trim())
        .bind(asset_id)
        .bind(place_id)
        .bind(actor)
        .bind(result.as_str())
        .execute(self.db.write())
        .await?;
        Ok(result)
    }

    pub async fn comments(
        &self,
        workspace_id: Uuid,
        target_type: &str,
        target_id: Uuid,
    ) -> AppResult<Vec<Comment>> {
        Ok(sqlx::query_as::<_, Comment>(
            "SELECT id, target_type, target_id, author_id, body, created_at FROM comments \
             WHERE workspace_id = $1 AND target_type = $2 AND target_id = $3 ORDER BY created_at",
        )
        .bind(workspace_id)
        .bind(target_type)
        .bind(target_id)
        .fetch_all(self.db.read())
        .await?)
    }

    pub async fn add_comment(
        &self,
        workspace_id: Uuid,
        target_type: &str,
        target_id: Uuid,
        body: &str,
        author: Uuid,
    ) -> AppResult<Comment> {
        Ok(sqlx::query_as::<_, Comment>(
            "INSERT INTO comments (workspace_id, target_type, target_id, author_id, body) \
             VALUES ($1, $2, $3, $4, $5) \
             RETURNING id, target_type, target_id, author_id, body, created_at",
        )
        .bind(workspace_id)
        .bind(target_type)
        .bind(target_id)
        .bind(author)
        .bind(body.trim())
        .fetch_one(self.db.write())
        .await?)
    }

    pub async fn activity(&self, workspace_id: Uuid, limit: i64) -> AppResult<Vec<ActivityEntry>> {
        Ok(sqlx::query_as::<_, ActivityEntry>(
            "SELECT id, at, actor_id, kind, target_type, target_id, target_label, summary, changes \
             FROM activity WHERE workspace_id = $1 ORDER BY at DESC LIMIT $2",
        )
        .bind(workspace_id)
        .bind(limit)
        .fetch_all(self.db.read())
        .await?)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn log(
        &self,
        workspace_id: Uuid,
        actor: Uuid,
        kind: &str,
        target_type: Option<&str>,
        target_id: Option<Uuid>,
        target_label: Option<&str>,
        summary: &str,
    ) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO activity (workspace_id, actor_id, kind, target_type, target_id, target_label, summary) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(workspace_id)
        .bind(actor)
        .bind(kind)
        .bind(target_type)
        .bind(target_id)
        .bind(target_label)
        .bind(summary)
        .execute(self.db.write())
        .await?;
        Ok(())
    }

    /// Platform-wide figures for the staff console. No names.
    pub async fn stats(&self) -> AppResult<RegisterStats> {
        let row: (i64, i64, i64, i64, i64, i64, i64) = sqlx::query_as(
            "SELECT \
               (SELECT COUNT(*) FROM workspaces), \
               (SELECT COUNT(*) FROM assets), \
               (SELECT COUNT(*) FROM assets WHERE status = 'checked_out'), \
               (SELECT COUNT(*) FROM assets WHERE status = 'checked_out' AND due_back < current_date), \
               (SELECT COUNT(*) FROM assets WHERE status = 'missing'), \
               (SELECT COUNT(*) FROM stock_lines WHERE quantity <= reorder_at), \
               (SELECT COUNT(*) FROM counts WHERE status = 'open')",
        )
        .fetch_one(self.db.read())
        .await?;
        Ok(RegisterStats {
            workspaces_total: row.0,
            assets_total: row.1,
            assets_checked_out: row.2,
            assets_overdue: row.3,
            assets_missing: row.4,
            stock_lines_low: row.5,
            counts_open: row.6,
        })
    }
}
