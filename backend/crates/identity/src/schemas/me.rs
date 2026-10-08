use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::models::account::AccountContact;
use crate::repositories::me_repository::{ProfileRow, SessionRow};

#[derive(Debug, Serialize, ToSchema)]
pub struct ContactRes {
    pub id: Uuid,
    pub channel: String,
    pub identifier: String,
    pub verified: bool,
    pub is_primary: bool,
}

impl From<AccountContact> for ContactRes {
    fn from(c: AccountContact) -> Self {
        Self {
            id: c.id,
            channel: c.channel,
            identifier: c.identifier,
            verified: c.verified_at.is_some(),
            is_primary: c.is_primary,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MeRes {
    pub account_id: Uuid,
    pub display_name: String,
    pub preferred_lang: String,
    pub roles: Vec<String>,
    pub contacts: Vec<ContactRes>,
    /// Free-form settings (appearance, dashboard choices, notification and
    /// onboarding state). A JSON object.
    #[schema(value_type = Object)]
    pub preferences: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

impl MeRes {
    pub fn new(profile: ProfileRow, contacts: Vec<AccountContact>, roles: Vec<String>) -> Self {
        Self {
            account_id: profile.id,
            display_name: profile.display_name,
            preferred_lang: profile.preferred_lang,
            roles,
            contacts: contacts.into_iter().map(Into::into).collect(),
            preferences: profile.preferences,
            created_at: profile.created_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateMeReq {
    pub display_name: Option<String>,
    pub preferred_lang: Option<String>,
    /// Merged into the stored preferences: top-level keys replace, others stay.
    #[schema(value_type = Option<Object>)]
    pub preferences: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SessionRes {
    pub id: Uuid,
    pub user_agent: Option<String>,
    pub ip: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
}

impl From<SessionRow> for SessionRes {
    fn from(s: SessionRow) -> Self {
        Self {
            id: s.id,
            user_agent: s.user_agent,
            ip: s.ip,
            created_at: s.created_at,
            last_used_at: s.last_used_at,
            expires_at: s.expires_at,
        }
    }
}
