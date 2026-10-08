use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct RequestOtpReq {
    /// `email` or `phone`.
    #[validate(length(min = 1))]
    pub channel: String,
    #[validate(length(min = 3, max = 320))]
    pub identifier: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RequestOtpRes {
    pub expires_in_secs: u64,
    /// Present only in development (`OTP_DEV_ECHO_ENABLED=true`), never in
    /// staging/production — config refuses to start with it enabled there.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dev_code: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct VerifyOtpReq {
    #[validate(length(min = 1))]
    pub channel: String,
    #[validate(length(min = 3, max = 320))]
    pub identifier: String,
    #[validate(length(equal = 6))]
    pub code: String,
}

#[derive(Debug, Deserialize, Validate, Default, ToSchema)]
pub struct RefreshReq {
    /// Optional — the browser client omits this and relies on the
    /// `tw_refresh` HttpOnly cookie instead (WO-05: no tokens in
    /// `localStorage`, including the refresh token). Non-browser clients
    /// (mobile app, `curl`, tests) pass it explicitly here.
    #[serde(default)]
    pub refresh_token: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TokenPairRes {
    pub account_id: Uuid,
    pub access_token: String,
    pub refresh_token: String,
    pub roles: Vec<String>,
}

#[derive(Debug, Deserialize, Validate, Default, ToSchema)]
pub struct LogoutReq {
    /// Optional for the same reason as `RefreshReq::refresh_token`.
    #[serde(default)]
    pub refresh_token: Option<String>,
}
