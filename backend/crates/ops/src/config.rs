//! Ops service configuration.

use tagwise_shared::config::{
    enforce_https_from_env, non_empty_env, required, trust_proxy_headers_from_env, ConfigError,
    CorsConfig, DatabaseConfig, Environment, JwtConfig, ObservabilityConfig, RateLimitConfig,
    RedisConfig, ServerConfig,
};

#[derive(Debug, Clone)]
pub struct Config {
    pub env: Environment,
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub jwt: JwtConfig,
    pub cors: CorsConfig,
    pub rate_limit: RateLimitConfig,
    pub observability: ObservabilityConfig,
    pub enforce_https: bool,
    pub trust_proxy_headers: bool,
    pub internal_token: String,
    /// Identity says who a requester is, and how many accounts there are.
    pub identity_service_url: String,
    /// The register service says how many assets are out, missing or low.
    pub register_service_url: String,
    /// Where a ticket update is announced to the person it concerns.
    pub notifications_service_url: String,
    /// Prometheus, for service health, traffic and container memory. Optional:
    /// without it the console says so instead of showing made-up figures.
    pub prometheus_url: Option<String>,
    /// Grafana, for its firing alerts. Both are needed; either missing means
    /// "not configured".
    pub grafana_url: Option<String>,
    pub grafana_token: Option<String>,
    /// The databases the viewer may read: `name=postgres://…` entries,
    /// comma-separated. Should be a **read-only** login; the viewer also asks
    /// Postgres to refuse writes on every connection it opens.
    pub viewer_databases: Vec<(String, String)>,
}

/// Parses `name=url,name=url`. Entries without a name or URL are skipped. The
/// URL is everything after the first `=`, so query strings survive.
pub fn parse_viewer_databases(raw: &str) -> Vec<(String, String)> {
    raw.split(',')
        .filter_map(|entry| {
            let (name, url) = entry.trim().split_once('=')?;
            let (name, url) = (name.trim(), url.trim());
            let name_ok = !name.is_empty()
                && name.len() <= 63
                && name
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
            (name_ok && !url.is_empty()).then(|| (name.to_string(), url.to_string()))
        })
        .collect()
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let env = Environment::from_env()?;
        Ok(Self {
            env,
            server: ServerConfig::from_env(8085)?,
            database: DatabaseConfig::from_env()?,
            redis: RedisConfig::from_env()?,
            jwt: JwtConfig::from_env(env)?,
            cors: CorsConfig::from_env(env)?,
            rate_limit: RateLimitConfig::from_env(env)?,
            observability: ObservabilityConfig::from_env(env, "tagwise-ops")?,
            enforce_https: enforce_https_from_env(env)?,
            trust_proxy_headers: trust_proxy_headers_from_env()?,
            internal_token: required("INTERNAL_SERVICE_TOKEN")?,
            identity_service_url: required("IDENTITY_SERVICE_URL")?,
            register_service_url: required("REGISTER_SERVICE_URL")?,
            notifications_service_url: required("NOTIFICATIONS_SERVICE_URL")?,
            prometheus_url: non_empty_env("PROMETHEUS_URL"),
            grafana_url: non_empty_env("GRAFANA_URL"),
            grafana_token: non_empty_env("GRAFANA_TOKEN"),
            viewer_databases: non_empty_env("VIEWER_DATABASES")
                .map(|raw| parse_viewer_databases(&raw))
                .unwrap_or_default(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn viewer_databases_are_parsed_and_junk_is_skipped() {
        let parsed = parse_viewer_databases(
            "identity=postgres://u:p@db:5432/tagwise_identity?sslmode=disable, register = postgres://u:p@db/c ,=x,bad name=y,empty=",
        );
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].0, "identity");
        assert!(
            parsed[0].1.ends_with("sslmode=disable"),
            "everything after the first = is the URL"
        );
        assert_eq!(parsed[1].0, "register");
        assert!(parse_viewer_databases("").is_empty());
    }
}
