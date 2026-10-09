//! Register behaviour against a real PostgreSQL. Ignored by default because
//! it needs a database; run it with the compose stack's Postgres:
//!
//! ```sh
//! docker compose -f docker/compose.dev.yml up -d db
//! cd backend
//! TEST_DATABASE_URL=postgres://tagwise:tagwise@localhost:5443/tagwise_register \
//!   cargo test -p tagwise-register --test register_db -- --ignored --test-threads=1
//! ```
//!
//! Each test makes its own workspace, so the database can be reused.

use std::time::Duration;

use tagwise_register::domain::ScanResult;
use tagwise_register::repository::{AssetPatch, EditOutcome, RegisterRepository};
use tagwise_shared::config::DatabaseConfig;
use tagwise_shared::database::{self, DbPool};
use uuid::Uuid;

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

async fn pool() -> DbPool {
    let url =
        std::env::var("TEST_DATABASE_URL").expect("set TEST_DATABASE_URL (see the module docs)");
    let db = database::connect(&DatabaseConfig {
        url,
        read_replica_url: None,
        max_connections: 10,
        min_connections: 1,
        acquire_timeout: Duration::from_secs(5),
    })
    .await
    .expect("connect to the test database");
    MIGRATOR.run(db.write()).await.expect("apply migrations");
    db
}

/// A workspace with one site, one asset (version 1) and one stock line of 5.
async fn fixture(db: &DbPool, repo: &RegisterRepository) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
    let owner = Uuid::new_v4();
    let ws = repo
        .create_workspace("Test trust", "TT", owner)
        .await
        .unwrap();
    let site: Uuid = sqlx::query_scalar(
        "INSERT INTO sites (workspace_id, code, name, kind) VALUES ($1, 'HQ', 'Head office', 'office') RETURNING id",
    )
    .bind(ws.id)
    .fetch_one(db.write())
    .await
    .unwrap();
    let asset: Uuid = sqlx::query_scalar(
        "INSERT INTO assets (workspace_id, tag, name, category, site_id, updated_by) \
         VALUES ($1, 'TT-00001', 'Projector', 'Projector', $2, $3) RETURNING id",
    )
    .bind(ws.id)
    .bind(site)
    .bind(owner)
    .fetch_one(db.write())
    .await
    .unwrap();
    let line: Uuid = sqlx::query_scalar(
        "INSERT INTO stock_lines (workspace_id, site_id, sku, name, quantity, updated_by) \
         VALUES ($1, $2, 'PAP-A4', 'A4 paper', 5, $3) RETURNING id",
    )
    .bind(ws.id)
    .bind(site)
    .bind(owner)
    .fetch_one(db.write())
    .await
    .unwrap();
    (ws.id, owner, site, asset, line)
}

#[tokio::test]
#[ignore = "needs PostgreSQL: see the module docs"]
async fn stock_never_goes_below_zero_under_concurrent_issues() {
    let db = pool().await;
    let repo = RegisterRepository::new(db.clone());
    let (ws, owner, _, _, line) = fixture(&db, &repo).await;
    // Ten people each try to issue 1 from a line of 5, at once.
    let tasks: Vec<_> = (0..10)
        .map(|i| {
            let repo = repo.clone();
            tokio::spawn(async move {
                repo.adjust_stock(ws, line, -1, "test", &format!("k{i}"), owner)
                    .await
            })
        })
        .collect();
    let mut ok = 0;
    for t in tasks {
        if t.await.unwrap().is_ok() {
            ok += 1;
        }
    }
    assert_eq!(ok, 5, "exactly the five on hand can be issued");
    let left = repo.stock(ws).await.unwrap()[0].quantity;
    assert_eq!(left, 0);
}

#[tokio::test]
#[ignore = "needs PostgreSQL: see the module docs"]
async fn a_retried_adjustment_applies_once() {
    let db = pool().await;
    let repo = RegisterRepository::new(db.clone());
    let (ws, owner, _, _, line) = fixture(&db, &repo).await;
    let first = repo
        .adjust_stock(ws, line, 3, "delivery", "same-key", owner)
        .await
        .unwrap();
    let again = repo
        .adjust_stock(ws, line, 3, "delivery", "same-key", owner)
        .await
        .unwrap();
    assert_eq!(first.quantity, 8);
    assert_eq!(again.quantity, 8, "the retry did not add another 3");
}

#[tokio::test]
#[ignore = "needs PostgreSQL: see the module docs"]
async fn a_stale_edit_is_a_conflict() {
    let db = pool().await;
    let repo = RegisterRepository::new(db.clone());
    let (ws, owner, _, asset, _) = fixture(&db, &repo).await;
    let patch = AssetPatch {
        notes: Some("first".into()),
        ..Default::default()
    };
    assert!(matches!(
        repo.update_asset(ws, asset, 1, &patch, owner)
            .await
            .unwrap(),
        EditOutcome::Saved(_)
    ));
    let stale = AssetPatch {
        notes: Some("second".into()),
        ..Default::default()
    };
    match repo
        .update_asset(ws, asset, 1, &stale, owner)
        .await
        .unwrap()
    {
        EditOutcome::Conflict(current) => assert_eq!(current.version, 2),
        EditOutcome::Saved(_) => panic!("a stale edit must not overwrite"),
    }
}

#[tokio::test]
#[ignore = "needs PostgreSQL: see the module docs"]
async fn another_workspace_cannot_see_the_asset() {
    let db = pool().await;
    let repo = RegisterRepository::new(db.clone());
    let (_, _, _, asset, _) = fixture(&db, &repo).await;
    let other = repo
        .create_workspace("Someone else", "SE", Uuid::new_v4())
        .await
        .unwrap();
    assert!(
        repo.asset(other.id, asset).await.is_err(),
        "not found from another workspace"
    );
    assert!(
        repo.role_in(other.id, Uuid::new_v4()).await.is_err(),
        "a stranger is not a member"
    );
}

#[tokio::test]
#[ignore = "needs PostgreSQL: see the module docs"]
async fn count_scans_are_classified() {
    let db = pool().await;
    let repo = RegisterRepository::new(db.clone());
    let (ws, owner, site, _, _) = fixture(&db, &repo).await;
    let count = repo
        .start_count(ws, site, "Test count", owner)
        .await
        .unwrap();
    assert_eq!(
        repo.record_scan(ws, count.id, "TT-00001", None, owner)
            .await
            .unwrap(),
        ScanResult::Found
    );
    assert_eq!(
        repo.record_scan(ws, count.id, "tt-00001", None, owner)
            .await
            .unwrap(),
        ScanResult::Repeat
    );
    assert_eq!(
        repo.record_scan(ws, count.id, "NOPE-1", None, owner)
            .await
            .unwrap(),
        ScanResult::Unknown
    );
}
