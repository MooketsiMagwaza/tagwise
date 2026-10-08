use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::models::account::AccountContact;
use crate::repositories::account_admin_repository::{AccountRow, SessionAdminRow};
use crate::repositories::api_key_repository::ApiKeyRow;
use crate::schemas::me::ContactRes;

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminAuditEntryRes {
    pub id: Uuid,
    pub actor_account_id: Uuid,
    pub action: String,
    pub target_type: Option<String>,
    pub target_id: Option<Uuid>,
    #[schema(value_type = Object)]
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

impl From<crate::repositories::admin_repository::AdminAuditEntry> for AdminAuditEntryRes {
    fn from(e: crate::repositories::admin_repository::AdminAuditEntry) -> Self {
        Self {
            id: e.id,
            actor_account_id: e.actor_account_id,
            action: e.action,
            target_type: e.target_type,
            target_id: e.target_id,
            metadata: e.metadata,
            created_at: e.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema, Default)]
pub struct AdminLinksRes {
    pub grafana_url: Option<String>,
    pub prometheus_url: Option<String>,
    pub jira_url: Option<String>,
    pub status_url: Option<String>,
    pub docs_url: Option<String>,
}

impl From<&crate::admin_links::AdminLinksConfig> for AdminLinksRes {
    fn from(c: &crate::admin_links::AdminLinksConfig) -> Self {
        Self {
            grafana_url: c.grafana_url.clone(),
            prometheus_url: c.prometheus_url.clone(),
            jira_url: c.jira_url.clone(),
            status_url: c.status_url.clone(),
            docs_url: c.docs_url.clone(),
        }
    }
}

// ── accounts ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct AccountRes {
    pub id: Uuid,
    pub display_name: String,
    /// `active` or `suspended`.
    pub status: String,
    pub suspended_reason: Option<String>,
    pub roles: Vec<String>,
    /// The primary contact (email address or phone number).
    pub contact: Option<String>,
    pub last_active: Option<DateTime<Utc>>,
    pub active_sessions: i64,
    pub created_at: DateTime<Utc>,
}

impl From<AccountRow> for AccountRes {
    fn from(a: AccountRow) -> Self {
        Self {
            id: a.id,
            display_name: a.display_name,
            status: a.status,
            suspended_reason: a.suspended_reason,
            roles: a.roles,
            contact: a.contact,
            last_active: a.last_active,
            active_sessions: a.active_sessions,
            created_at: a.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AccountListRes {
    pub accounts: Vec<AccountRes>,
    /// How many accounts match the filters, across all pages.
    pub total: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminSessionRes {
    pub id: Uuid,
    pub user_agent: Option<String>,
    pub ip: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
}

impl From<SessionAdminRow> for AdminSessionRes {
    fn from(s: SessionAdminRow) -> Self {
        Self {
            id: s.id,
            user_agent: s.user_agent,
            ip: s.ip,
            created_at: s.created_at,
            last_used_at: s.last_used_at,
            revoked_at: s.revoked_at,
            expires_at: s.expires_at,
        }
    }
}

/// An API key as it is listed. Never the key, never its hash.
#[derive(Debug, Serialize, ToSchema)]
pub struct ApiKeyRes {
    pub id: Uuid,
    pub account_id: Uuid,
    pub owner_name: String,
    pub name: String,
    /// The first characters of the key, enough to recognise it.
    pub prefix: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
}

impl From<ApiKeyRow> for ApiKeyRes {
    fn from(k: ApiKeyRow) -> Self {
        Self {
            id: k.id,
            account_id: k.account_id,
            owner_name: k.owner_name,
            name: k.name,
            prefix: k.prefix,
            created_by: k.created_by,
            created_at: k.created_at,
            expires_at: k.expires_at,
            last_used_at: k.last_used_at,
            revoked_at: k.revoked_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AccountDetailRes {
    pub account: AccountRes,
    pub contacts: Vec<ContactRes>,
    pub sessions: Vec<AdminSessionRes>,
    pub api_keys: Vec<ApiKeyRes>,
}

impl AccountDetailRes {
    pub fn new(
        account: AccountRow,
        contacts: Vec<AccountContact>,
        sessions: Vec<SessionAdminRow>,
        api_keys: Vec<ApiKeyRow>,
    ) -> Self {
        Self {
            account: account.into(),
            contacts: contacts.into_iter().map(Into::into).collect(),
            sessions: sessions.into_iter().map(Into::into).collect(),
            api_keys: api_keys.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateAccountReq {
    #[validate(length(min = 1, max = 400))]
    pub display_name: String,
    /// `email` or `phone`.
    #[validate(length(min = 1, max = 16))]
    pub channel: String,
    #[validate(length(min = 1, max = 300))]
    pub identifier: String,
    /// Any of `warehouse`, `store`, `carrier`, `admin`.
    #[serde(default)]
    pub roles: Vec<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct SuspendReq {
    #[validate(length(min = 1, max = 1000))]
    pub reason: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SessionsRevokedRes {
    pub sessions_ended: u64,
}

// ── API keys ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateApiKeyReq {
    pub account_id: Uuid,
    #[validate(length(min = 1, max = 400))]
    pub name: String,
    /// 1 to 730; omitted means it doesn't expire.
    pub expires_in_days: Option<i64>,
}

/// A new key. `key` is shown **once**, here, and can't be retrieved again.
#[derive(Debug, Serialize, ToSchema)]
pub struct CreatedApiKeyRes {
    pub key: String,
    pub api_key: ApiKeyRes,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct ApiKeyTokenReq {
    #[validate(length(min = 1, max = 200))]
    pub api_key: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ApiKeyTokenRes {
    pub account_id: Uuid,
    pub access_token: String,
    pub expires_in_secs: i64,
    pub roles: Vec<String>,
}

// ── overview ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct RoleCountRes {
    pub role: String,
    pub count: i64,
}

/// Platform-wide account counts, for the ops overview (internal).
#[derive(Debug, Serialize)]
pub struct IdentityStatsRes {
    pub accounts_total: i64,
    pub accounts_active: i64,
    pub accounts_suspended: i64,
    pub accounts_new_7d: i64,
    pub sessions_active: i64,
    pub by_role: Vec<RoleCountRes>,
}
