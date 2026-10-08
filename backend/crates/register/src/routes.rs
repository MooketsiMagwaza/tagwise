//! Router assembly for the register service.

use axum::routing::{get, post};
use axum::{middleware, Router};
use tagwise_shared::middleware as shared_mw;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::controllers::{health, internal, register};
use crate::openapi::ApiDoc;
use crate::state::AppState;

pub fn build_router(state: AppState) -> Router {
    let internal_routes = Router::new()
        .route("/internal/stats", get(internal::stats))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            shared_mw::internal_auth_mw::<AppState>,
        ));

    let mut router: Router<AppState> = Router::new()
        .route("/health/live", get(health::live))
        .route("/health/ready", get(health::ready))
        .route("/metrics", get(health::metrics))
        .route(
            "/v1/workspaces",
            get(register::my_workspaces).post(register::create_workspace),
        )
        .route("/v1/workspaces/:ws/sites", get(register::sites))
        .route("/v1/workspaces/:ws/assets", get(register::assets))
        .route(
            "/v1/workspaces/:ws/assets/:id",
            get(register::asset).patch(register::edit_asset),
        )
        .route("/v1/workspaces/:ws/stock", get(register::stock))
        .route(
            "/v1/workspaces/:ws/stock/:id/adjust",
            post(register::adjust_stock),
        )
        .route(
            "/v1/workspaces/:ws/counts",
            get(register::counts).post(register::start_count),
        )
        .route("/v1/workspaces/:ws/counts/:id/scans", post(register::scan))
        .route(
            "/v1/workspaces/:ws/comments",
            get(register::comments).post(register::add_comment),
        )
        .route("/v1/workspaces/:ws/activity", get(register::activity))
        .merge(internal_routes);

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
