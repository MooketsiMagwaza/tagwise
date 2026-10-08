use std::sync::Arc;

use tagwise_shared::auth::{AccessTokenDenylist, AuthState, JwtKeys};
use tagwise_shared::database::redis::RedisPool;
use tagwise_shared::database::DbPool;
use tagwise_shared::middleware::InternalAuthState;
use tagwise_shared::utils::metrics::Metrics;

use crate::clients::NotificationsClient;
use crate::config::Config;
use crate::repository::RegisterRepository;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: DbPool,
    pub redis: RedisPool,
    pub jwt: Arc<JwtKeys>,
    pub metrics: Arc<Metrics>,
    /// The same Redis-backed denylist identity writes to on logout, so a
    /// revoked token stops working here immediately.
    pub denylist: AccessTokenDenylist,
    pub register: RegisterRepository,
    pub notifications: NotificationsClient,
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
        let notifications = NotificationsClient::new(
            config.notifications_service_url.clone(),
            config.internal_token.clone(),
        );
        Self {
            register: RegisterRepository::new(db.clone()),
            config: Arc::new(config),
            db,
            redis,
            jwt,
            metrics: Arc::new(Metrics::default()),
            denylist,
            notifications,
        }
    }
}
