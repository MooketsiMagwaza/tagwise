use std::sync::Arc;

use tagwise_shared::auth::{AccessTokenDenylist, AuthState, JwtKeys};
use tagwise_shared::database::redis::RedisPool;
use tagwise_shared::database::DbPool;
use tagwise_shared::middleware::InternalAuthState;
use tagwise_shared::utils::metrics::Metrics;

use crate::clients::{
    GrafanaClient, IdentityClient, NotificationsClient, PrometheusClient, StatsClients,
};
use crate::config::Config;
use crate::repositories::{AuditRepository, TicketRepository};
use crate::services::{DatabaseService, ObservabilityService, TicketService};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: DbPool,
    pub redis: RedisPool,
    pub jwt: Arc<JwtKeys>,
    pub metrics: Arc<Metrics>,
    pub denylist: AccessTokenDenylist,

    pub tickets: TicketService,
    pub observability: ObservabilityService,
    pub databases: DatabaseService,
    pub audit: AuditRepository,
}

impl AuthState for AppState {
    fn jwt(&self) -> &JwtKeys {
        &self.jwt
    }

    fn denylist(&self) -> &AccessTokenDenylist {
        &self.denylist
    }
}

impl InternalAuthState for AppState {
    fn internal_token(&self) -> &str {
        &self.config.internal_token
    }
}

impl AppState {
    pub fn new(config: Config, db: DbPool, redis: RedisPool) -> Self {
        let jwt = Arc::new(JwtKeys::new(&config.jwt));
        let denylist = AccessTokenDenylist::new(redis.clone());
        let metrics = Arc::new(Metrics::default());

        let identity = IdentityClient::new(
            config.identity_service_url.clone(),
            config.internal_token.clone(),
        );
        let notifications = NotificationsClient::new(
            config.notifications_service_url.clone(),
            config.internal_token.clone(),
        );
        let ticket_repo = TicketRepository::new(db.clone());
        let audit = AuditRepository::new(db.clone());
        let tickets = TicketService::new(ticket_repo.clone(), identity, notifications);

        let stats = StatsClients::new(
            config.identity_service_url.clone(),
            config.register_service_url.clone(),
            config.internal_token.clone(),
        );
        let prometheus = config.prometheus_url.clone().map(PrometheusClient::new);
        let grafana = config
            .grafana_url
            .clone()
            .zip(config.grafana_token.clone())
            .map(|(url, token)| GrafanaClient::new(url, token));
        let observability = ObservabilityService::new(
            stats,
            prometheus,
            grafana,
            config.grafana_url.clone(),
            ticket_repo,
        );
        let databases = DatabaseService::new(&config.viewer_databases, db.clone(), audit.clone());

        Self {
            config: Arc::new(config),
            db,
            redis,
            jwt,
            metrics,
            denylist,
            tickets,
            observability,
            databases,
            audit,
        }
    }
}
