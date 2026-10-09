//! Identity service entry point.
//!
//! `tagwise-identity migrate` applies pending migrations and exits.
//! Run with no arguments, the server refuses to start against a database
//! with migrations still pending, rather than applying them itself at boot
//! — auto-migrating is exactly wrong the moment there's more than one
//! replica, since two processes racing the same migration is how a rollout
//! corrupts a schema. A real deployment runs `migrate` once, then starts
//! every replica.
//!
//! `tagwise-identity grant-admin <email>` gives that address the admin role
//! (making the account if it doesn't exist) and exits. It is how the first admin
//! is made — everything after that is done from the admin console. It needs
//! database access, which is the point: whoever can run it could edit the
//! database anyway. The grant is written to the audit log.

use tagwise_identity::config::Config;
use tagwise_identity::repositories::{AccountAdminRepository, AdminRepository, AuthRepository};
use tagwise_identity::routes;
use tagwise_identity::services::account_admin_service::validate_contact;
use tagwise_identity::state::AppState;
use tagwise_shared::database::{self, redis, DbPool};

#[tokio::main]
async fn main() {
    // `tagwise-identity openapi` prints this service's OpenAPI document and exits.
    // It needs no configuration or database, so the docs snapshot can be
    // regenerated from the code (see docs-site/scripts/fetch-openapi.mjs).
    if std::env::args().nth(1).as_deref() == Some("openapi") {
        use utoipa::OpenApi;
        println!(
            "{}",
            tagwise_identity::openapi::ApiDoc::openapi()
                .to_pretty_json()
                .expect("the OpenAPI document serialises")
        );
        return;
    }

    dotenvy::dotenv().ok();

    let config = Config::from_env().expect("invalid configuration — see the error above");
    let _tracing = tagwise_shared::utils::observability::init_tracing(&config.observability);

    let db = database::connect(&config.database)
        .await
        .expect("failed to connect to the database");

    if std::env::args().nth(1).as_deref() == Some("migrate") {
        MIGRATOR
            .run(db.write())
            .await
            .expect("failed to apply migrations");
        tracing::info!("migrations applied");
        return;
    }

    if migrations_are_pending(&db).await {
        eprintln!("refusing to start: pending migrations. Run `tagwise-identity migrate` first.");
        std::process::exit(1);
    }

    if std::env::args().nth(1).as_deref() == Some("grant-admin") {
        let Some(email) = std::env::args().nth(2) else {
            eprintln!("usage: tagwise-identity grant-admin <email>");
            std::process::exit(2);
        };
        grant_admin(&db, &email).await;
        return;
    }

    let redis = redis::connect(&config.redis).expect("failed to build the redis pool");

    let host = config.server.host.clone();
    let port = config.server.port;
    let state = AppState::new(config, db, redis);
    let router = routes::build_router(state);

    let listener = tokio::net::TcpListener::bind((host.as_str(), port))
        .await
        .unwrap_or_else(|err| panic!("failed to bind {host}:{port}: {err}"));
    tracing::info!(%host, port, "tagwise-identity listening");

    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .expect("server error");
}

/// Gives `raw` the admin role, creating the account if there isn't one. The
/// account signs in the usual way, with a one-time code sent to that address.
async fn grant_admin(db: &DbPool, raw: &str) {
    let email = match validate_contact("email", raw) {
        Ok(email) => email,
        Err(_) => {
            eprintln!("{raw:?} isn't an email address");
            std::process::exit(2);
        }
    };
    let auth = AuthRepository::new(db.clone());
    let existing = auth
        .find_account_by_contact("email", &email)
        .await
        .expect("failed to look the account up");
    let (id, created) = match existing {
        Some(account) => {
            if account.status != "active" {
                eprintln!(
                    "that account is {} — reinstate it from the admin console first",
                    account.status
                );
                std::process::exit(1);
            }
            auth.add_role(account.id, "admin")
                .await
                .expect("failed to grant the role");
            (account.id, false)
        }
        None => {
            let account = AccountAdminRepository::new(db.clone())
                .create(&email, "email", &email, &["admin".to_string()])
                .await
                .expect("failed to create the account");
            (account.id, true)
        }
    };
    // The account is its own actor: there is no signed-in admin to name.
    AdminRepository::new(db.clone())
        .record(
            id,
            "account.grant_admin_cli",
            Some("account"),
            Some(id),
            serde_json::json!({ "via": "tagwise-identity grant-admin", "created": created }),
        )
        .await
        .expect("failed to write the audit entry");
    println!(
        "{email} is now an admin (account {id}{}). They sign in with a one-time code sent to that address.",
        if created { ", newly created" } else { "" }
    );
}

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

async fn migrations_are_pending(db: &DbPool) -> bool {
    let applied: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM _sqlx_migrations WHERE success = true")
            .fetch_one(db.write())
            .await
            .unwrap_or(0);
    (applied as usize) < MIGRATOR.migrations.len()
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install Ctrl+C handler");
    tracing::info!("shutdown signal received");
}
