//! Router assembly for the identity service.

use axum::routing::{delete, get};
use axum::{middleware, Router};
use tagwise_shared::middleware as shared_mw;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::controllers::{admin, auth, health, internal, me};
use crate::openapi::ApiDoc;
use crate::state::AppState;

pub fn build_router(state: AppState) -> Router {
    let internal_routes = Router::new()
        .route(
            "/internal/accounts/:id/notification-settings",
            get(internal::notification_settings),
        )
        .route("/internal/stats", get(internal::stats))
        .route(
            "/internal/accounts/:id/summary",
            get(internal::account_summary),
        )
        .route(
            "/internal/accounts/:id/email",
            axum::routing::post(internal::send_email),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            shared_mw::internal_auth_mw::<AppState>,
        ));

    let mut router: Router<AppState> = Router::new()
        .route("/health/live", get(health::live))
        .route("/health/ready", get(health::ready))
        .route("/metrics", get(health::metrics))
        .route(
            "/v1/auth/otp/request",
            axum::routing::post(auth::request_otp),
        )
        .route("/v1/auth/otp/verify", axum::routing::post(auth::verify_otp))
        .route("/v1/auth/refresh", axum::routing::post(auth::refresh))
        .route("/v1/auth/logout", axum::routing::post(auth::logout))
        .route(
            "/v1/me",
            get(me::get_me).patch(me::patch_me).delete(me::delete_me),
        )
        .route(
            "/v1/me/sessions",
            get(me::list_sessions).delete(me::revoke_all_sessions),
        )
        .route("/v1/me/sessions/:session_id", delete(me::revoke_session))
        .route(
            "/v1/auth/api-key/token",
            axum::routing::post(auth::api_key_token),
        )
        .route("/v1/admin/audit-log", get(admin::audit_log))
        .route(
            "/v1/admin/accounts",
            get(admin::list_accounts).post(admin::create_account),
        )
        .route(
            "/v1/admin/accounts/:account_id",
            get(admin::get_account).delete(admin::delete_account),
        )
        .route(
            "/v1/admin/accounts/:account_id/suspend",
            axum::routing::post(admin::suspend_account),
        )
        .route(
            "/v1/admin/accounts/:account_id/reinstate",
            axum::routing::post(admin::reinstate_account),
        )
        .route(
            "/v1/admin/accounts/:account_id/sessions/revoke-all",
            axum::routing::post(admin::revoke_all_sessions),
        )
        .route(
            "/v1/admin/sessions/:session_id",
            delete(admin::revoke_session),
        )
        .route(
            "/v1/admin/api-keys",
            get(admin::list_api_keys).post(admin::create_api_key),
        )
        .route("/v1/admin/api-keys/:key_id", delete(admin::revoke_api_key))
        .route("/v1/admin/links", get(admin::links))
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
