//! Router assembly for the ops service.

use axum::routing::{get, post};
use axum::Router;
use tagwise_shared::middleware as shared_mw;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::controllers::{admin_tickets, console, health, support};
use crate::openapi::ApiDoc;
use crate::state::AppState;

pub fn build_router(state: AppState) -> Router {
    let mut router: Router<AppState> = Router::new()
        .route("/health/live", get(health::live))
        .route("/health/ready", get(health::ready))
        .route("/metrics", get(health::metrics))
        // Support: the requester's side.
        .route(
            "/v1/support/tickets",
            get(support::my_tickets).post(support::create_ticket),
        )
        .route("/v1/support/tickets/:ticket_id", get(support::my_ticket))
        .route(
            "/v1/support/tickets/:ticket_id/messages",
            post(support::reply),
        )
        .route("/v1/support/tickets/:ticket_id/close", post(support::close))
        // Support: staff.
        .route("/v1/admin/tickets", get(admin_tickets::queue))
        .route(
            "/v1/admin/tickets/:ticket_id",
            get(admin_tickets::detail).patch(admin_tickets::update),
        )
        .route(
            "/v1/admin/tickets/:ticket_id/messages",
            post(admin_tickets::reply),
        )
        // The console's operational views: staff only.
        .route("/v1/admin/ops/overview", get(console::overview))
        .route("/v1/admin/ops/health", get(console::health))
        .route("/v1/admin/ops/memory", get(console::memory))
        .route("/v1/admin/ops/alerts", get(console::alerts))
        .route("/v1/admin/ops/databases", get(console::databases))
        .route(
            "/v1/admin/ops/databases/:database/tables",
            get(console::tables),
        )
        .route(
            "/v1/admin/ops/databases/:database/tables/:table/rows",
            get(console::rows),
        )
        .route("/v1/admin/ops/connections", get(console::connections))
        .route(
            "/v1/admin/ops/connections/:pid/terminate",
            post(console::terminate_connection),
        )
        .route("/v1/admin/ops/audit-log", get(console::audit_log));

    if !state.config.env.is_production_like() {
        router =
            router.merge(SwaggerUi::new("/docs/swagger").url("/openapi.json", ApiDoc::openapi()));
    }

    let mw = shared_mw::MiddlewareState {
        redis: state.redis.clone(),
        rate_limit: state.config.rate_limit,
        trust_proxy_headers: state.config.trust_proxy_headers,
        metrics: state.metrics.clone(),
    };
    let router = shared_mw::apply(router, mw, &state.config.cors, state.config.enforce_https);
    router.with_state(state)
}
