//! A small client for Prometheus's HTTP query API: one PromQL expression in,
//! its instant samples out. Failure is an `Err(reason)` the console can print.

use std::collections::HashMap;
use std::time::Duration;

use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct Sample {
    pub labels: HashMap<String, String>,
    pub value: f64,
}

impl Sample {
    pub fn label(&self, name: &str) -> Option<&str> {
        self.labels.get(name).map(String::as_str)
    }
}

#[derive(Debug, Deserialize)]
struct QueryRes {
    status: String,
    data: Option<QueryData>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QueryData {
    result: Vec<RawSample>,
}

#[derive(Debug, Deserialize)]
struct RawSample {
    metric: HashMap<String, String>,
    /// `[timestamp, "value"]`.
    value: (f64, String),
}

/// Reads a Prometheus instant-query response into samples. A value that isn't a
/// number (`NaN` from a 0/0 rate, for instance) is dropped rather than shown.
pub fn parse_query_response(body: &str) -> Result<Vec<Sample>, String> {
    let parsed: QueryRes = serde_json::from_str(body)
        .map_err(|_| "Prometheus sent something unexpected".to_string())?;
    if parsed.status != "success" {
        return Err(format!(
            "Prometheus refused the query: {}",
            parsed.error.unwrap_or_default()
        ));
    }
    Ok(parsed
        .data
        .map(|d| d.result)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| {
            let value = s.value.1.parse::<f64>().ok().filter(|v| v.is_finite())?;
            Some(Sample {
                labels: s.metric,
                value,
            })
        })
        .collect())
}

#[derive(Debug, Clone)]
pub struct PrometheusClient {
    http: reqwest::Client,
    base_url: String,
}

impl PrometheusClient {
    pub fn new(base_url: String) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .unwrap_or_default(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    pub async fn query(&self, promql: &str) -> Result<Vec<Sample>, String> {
        let response = self
            .http
            .get(format!("{}/api/v1/query", self.base_url))
            .query(&[("query", promql)])
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    "Prometheus took too long to answer".to_string()
                } else {
                    "couldn't reach Prometheus".to_string()
                }
            })?;
        if !response.status().is_success() {
            return Err(format!("Prometheus answered {}", response.status()));
        }
        let body = response
            .text()
            .await
            .map_err(|_| "Prometheus sent something unexpected".to_string())?;
        parse_query_response(&body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_query_response_becomes_samples_and_nan_is_dropped() {
        let body = r#"{"status":"success","data":{"resultType":"vector","result":[
            {"metric":{"job":"identity"},"value":[1700000000.0,"1"]},
            {"metric":{"job":"commerce"},"value":[1700000000.0,"NaN"]}]}}"#;
        let samples = parse_query_response(body).unwrap();
        assert_eq!(samples.len(), 1);
        assert_eq!(samples[0].label("job"), Some("identity"));
        assert_eq!(samples[0].value, 1.0);
    }

    #[test]
    fn an_error_response_is_an_error() {
        let body = r#"{"status":"error","errorType":"bad_data","error":"parse error"}"#;
        assert!(parse_query_response(body)
            .unwrap_err()
            .contains("parse error"));
        assert!(parse_query_response("not json").is_err());
    }
}
