//! Grafana's firing alerts, through its Alertmanager-compatible API. Needs a
//! service-account token; without one the console says alerts aren't set up.

use std::collections::HashMap;
use std::time::Duration;

use serde::Deserialize;

/// One alert as Grafana reports it, reduced to what the console shows.
#[derive(Debug, Clone)]
pub struct GrafanaAlert {
    pub name: String,
    pub severity: Option<String>,
    pub state: String,
    pub summary: Option<String>,
    pub started_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawAlert {
    #[serde(default)]
    labels: HashMap<String, String>,
    #[serde(default)]
    annotations: HashMap<String, String>,
    #[serde(rename = "startsAt")]
    starts_at: Option<String>,
    status: Option<RawStatus>,
}

#[derive(Debug, Deserialize)]
struct RawStatus {
    state: Option<String>,
}

pub fn parse_alerts(body: &str) -> Result<Vec<GrafanaAlert>, String> {
    let raw: Vec<RawAlert> =
        serde_json::from_str(body).map_err(|_| "Grafana sent something unexpected".to_string())?;
    Ok(raw
        .into_iter()
        .map(|a| GrafanaAlert {
            name: a
                .labels
                .get("alertname")
                .cloned()
                .unwrap_or_else(|| "(unnamed alert)".into()),
            severity: a.labels.get("severity").cloned(),
            state: a
                .status
                .and_then(|s| s.state)
                .unwrap_or_else(|| "active".into()),
            summary: a
                .annotations
                .get("summary")
                .or_else(|| a.annotations.get("description"))
                .cloned(),
            started_at: a.starts_at,
        })
        .collect())
}

#[derive(Debug, Clone)]
pub struct GrafanaClient {
    http: reqwest::Client,
    base_url: String,
    token: String,
}

impl GrafanaClient {
    pub fn new(base_url: String, token: String) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .unwrap_or_default(),
            base_url: base_url.trim_end_matches('/').to_string(),
            token,
        }
    }

    /// Alerts that are firing now (not silenced or inhibited).
    pub async fn firing_alerts(&self) -> Result<Vec<GrafanaAlert>, String> {
        let response = self
            .http
            .get(format!(
                "{}/api/alertmanager/grafana/api/v2/alerts",
                self.base_url
            ))
            .query(&[
                ("active", "true"),
                ("silenced", "false"),
                ("inhibited", "false"),
            ])
            .bearer_auth(&self.token)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    "Grafana took too long to answer".to_string()
                } else {
                    "couldn't reach Grafana".to_string()
                }
            })?;
        match response.status().as_u16() {
            200 => {}
            401 | 403 => return Err("Grafana refused the token — check GRAFANA_TOKEN".to_string()),
            other => return Err(format!("Grafana answered {other}")),
        }
        let body = response
            .text()
            .await
            .map_err(|_| "Grafana sent something unexpected".to_string())?;
        parse_alerts(&body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alerts_are_reduced_to_what_the_console_shows() {
        let body = r#"[{"labels":{"alertname":"HighErrorRate","severity":"critical"},
            "annotations":{"summary":"5xx above 5% on commerce"},
            "startsAt":"2026-09-20T10:00:00Z","status":{"state":"active"}},
            {"labels":{},"annotations":{},"status":{}}]"#;
        let alerts = parse_alerts(body).unwrap();
        assert_eq!(alerts.len(), 2);
        assert_eq!(alerts[0].name, "HighErrorRate");
        assert_eq!(alerts[0].severity.as_deref(), Some("critical"));
        assert_eq!(alerts[1].name, "(unnamed alert)");
        assert!(parse_alerts("nope").is_err());
    }
}
