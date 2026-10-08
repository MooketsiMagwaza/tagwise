//! Register service configuration.

use tagwise_shared::config::{
    enforce_https_from_env, required, trust_proxy_headers_from_env, ConfigError, CorsConfig,
    DatabaseConfig, Environment, JwtConfig, ObservabilityConfig, RateLimitConfig, RedisConfig,
    ServerConfig,
};

#[derive(Debug, Clone)]
pub struct Config {
    pub env: Environment,
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    /// Verifies tokens identity issued. The signing secret is shared by
    /// every service, so authenticating a request needs no network call
    /// (see ARCHITECTURE.md, services and auth).
    pub jwt: JwtConfig,
    pub cors: CorsConfig,
    pub rate_limit: RateLimitConfig,
    pub observability: ObservabilityConfig,
    pub enforce_https: bool,
    pub trust_proxy_headers: bool,
    pub internal_token: String,
    pub notifications_service_url: String,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let env = Environment::from_env()?;
        Ok(Self {
            env,
            server: ServerConfig::from_env(8082)?,
            database: DatabaseConfig::from_env()?,
            redis: RedisConfig::from_env()?,
            jwt: JwtConfig::from_env(env)?,
            cors: CorsConfig::from_env(env)?,
            rate_limit: RateLimitConfig::from_env(env)?,
            observability: ObservabilityConfig::from_env(env, "tagwise-register")?,
            enforce_https: enforce_https_from_env(env)?,
            trust_proxy_headers: trust_proxy_headers_from_env()?,
            internal_token: required("INTERNAL_SERVICE_TOKEN")?,
            notifications_service_url: required("NOTIFICATIONS_SERVICE_URL")?,
        })
    }
}
