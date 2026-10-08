//! Router assembly for the notifications service.

use axum::routing::{delete, get, post};
use axum::{middleware, Router};
use tagwise_shared::middleware as shared_mw;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::controllers::{health, internal, notifications};
use crate::openapi::ApiDoc;
use crate::state::AppState;

pub fn build_router(state: AppState) -> Router {
    let internal_routes = Router::new()
        .route("/internal/notifications", post(internal::raise))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            shared_mw::internal_auth_mw::<AppState>,
        ));

    let mut router: Router<AppState> = Router::new()
        .route("/health/live", get(health::live))
        .route("/health/ready", get(health::ready))
        .route("/metrics", get(health::metrics))
        .route(
            "/v1/notifications",
            get(notifications::list_my_notifications).delete(notifications::clear_notifications),
        )
        .route(
            "/v1/notifications/unread-count",
            get(notifications::unread_count),
        )
        .route(
            "/v1/notifications/read-all",
            post(notifications::mark_all_read),
        )
        .route(
            "/v1/notifications/:id",
            delete(notifications::delete_notification),
        )
        .route(
            "/v1/notifications/:id/read",
            post(notifications::mark_notification_read),
        )
        .route("/v1/devices", post(notifications::register_device))
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
