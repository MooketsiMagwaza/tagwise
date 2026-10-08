use std::sync::Arc;

use tagwise_shared::auth::{AccessTokenDenylist, AuthState, JwtKeys};
use tagwise_shared::database::redis::RedisPool;
use tagwise_shared::database::DbPool;
use tagwise_shared::middleware::InternalAuthState;
use tagwise_shared::utils::metrics::Metrics;

use crate::config::Config;
use crate::fcm::FcmNotificationProvider;
use crate::identity_client::IdentityClient;
use crate::provider::NotificationProvider;
use crate::repositories::{DeviceRepository, NotificationRepository};
use crate::service::NotificationService;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: DbPool,
    pub redis: RedisPool,
    pub jwt: Arc<JwtKeys>,
    pub metrics: Arc<Metrics>,
    pub denylist: AccessTokenDenylist,

    pub notifications: NotificationService,
    pub devices: DeviceRepository,
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

        let notification_repo = NotificationRepository::new(db.clone());
        let device_repo = DeviceRepository::new(db.clone());

        let push: Option<Arc<dyn NotificationProvider>> = config.fcm.as_ref().map(|cfg| {
            Arc::new(FcmNotificationProvider::new(cfg, device_repo.clone()))
                as Arc<dyn NotificationProvider>
        });
        let identity = IdentityClient::new(
            config.identity_service_url.clone(),
            config.internal_token.clone(),
        );
        let notifications =
            NotificationService::new(notification_repo, device_repo.clone(), push, identity);

        Self {
            config: Arc::new(config),
            db,
            redis,
            jwt,
            metrics,
            denylist,
            notifications,
            devices: device_repo,
        }
    }
}
