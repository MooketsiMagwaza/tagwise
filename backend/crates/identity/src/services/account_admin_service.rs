//! Admin console: managing accounts, their sessions and their API keys. Owns
//! the rules — who may not be locked out, what a key looks like, what a valid
//! contact is — and writes an audit entry for every privileged action.
//!
//! An admin can't suspend or delete their own account, nor the last active
//! admin: either would leave nobody able to undo it.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::Rng;
use serde_json::json;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::models::account::{Account, AccountContact};
use crate::repositories::account_admin_repository::{
    AccountAdminRepository, AccountCountsRow, AccountFilter, AccountRow, RoleCountRow,
    SessionAdminRow,
};
use crate::repositories::api_key_repository::{ApiKeyRepository, ApiKeyRow};
use crate::repositories::{AdminRepository, AuthRepository};
use tagwise_shared::errors::{AppError, AppResult};

pub const ROLES: &[&str] = &["warehouse", "store", "carrier", "admin"];
const KEY_PREFIX: &str = "slk_";
/// How much of a key is kept in the clear to identify it in a list.
const SHOWN_PREFIX_LEN: usize = 12;

fn invalid(field: &str, message: &str) -> AppError {
    AppError::Validation {
        field: field.into(),
        message: message.into(),
    }
}

/// Makes a new key: `slk_` and 32 random bytes, URL-safe. Returns the key and
/// the SHA-256 that is stored in its place.
pub fn new_api_key() -> (String, String) {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill(&mut bytes);
    let key = format!("{KEY_PREFIX}{}", URL_SAFE_NO_PAD.encode(bytes));
    let hash = hash_api_key(&key);
    (key, hash)
}

/// The value a key is stored (and looked up) as.
pub fn hash_api_key(key: &str) -> String {
    hex::encode(Sha256::digest(key.trim().as_bytes()))
}

/// The part of a key that is safe to show in a list.
pub fn key_prefix(key: &str) -> String {
    key.chars().take(SHOWN_PREFIX_LEN).collect()
}

/// Checks a contact for an admin-created account. Email needs an `@` with text
/// either side of it; a phone number is digits with an optional leading `+`.
pub fn validate_contact(channel: &str, identifier: &str) -> AppResult<String> {
    let id = identifier.trim();
    match channel {
        "email" => {
            let ok = id.len() <= 254
                && id.split_once('@').is_some_and(|(local, domain)| {
                    !local.is_empty()
                        && domain.contains('.')
                        && !domain.starts_with('.')
                        && !domain.ends_with('.')
                })
                && !id.contains(char::is_whitespace);
            if !ok {
                return Err(invalid("identifier", "must be an email address"));
            }
            Ok(id.to_lowercase())
        }
        "phone" => {
            let digits = id.strip_prefix('+').unwrap_or(id);
            if !(7..=15).contains(&digits.len()) || !digits.chars().all(|c| c.is_ascii_digit()) {
                return Err(invalid(
                    "identifier",
                    "must be a phone number of 7 to 15 digits, optionally starting with +",
                ));
            }
            Ok(id.to_string())
        }
        _ => Err(invalid("channel", "must be `email` or `phone`")),
    }
}

pub struct AccountDetail {
    pub account: AccountRow,
    pub contacts: Vec<AccountContact>,
    pub sessions: Vec<SessionAdminRow>,
    pub api_keys: Vec<ApiKeyRow>,
}

pub struct ListParams {
    pub status: Option<String>,
    pub role: Option<String>,
    pub query: Option<String>,
    pub limit: i64,
    pub offset: i64,
}

pub struct Stats {
    pub counts: AccountCountsRow,
    pub by_role: Vec<RoleCountRow>,
}

/// A newly made key: the key itself (shown once) and how it will be listed.
pub struct CreatedKey {
    pub key: String,
    pub api_key: ApiKeyRow,
}

/// Escapes `%`, `_` and `\` so search text is matched literally by `ILIKE`.
fn escape_like(q: &str) -> String {
    q.chars()
        .flat_map(|c| match c {
            '\\' | '%' | '_' => vec!['\\', c],
            other => vec![other],
        })
        .collect()
}

#[derive(Clone)]
pub struct AccountAdminService {
    accounts: AccountAdminRepository,
    keys: ApiKeyRepository,
    audit: AdminRepository,
    auth: AuthRepository,
}

impl AccountAdminService {
    pub fn new(
        accounts: AccountAdminRepository,
        keys: ApiKeyRepository,
        audit: AdminRepository,
        auth: AuthRepository,
    ) -> Self {
        Self {
            accounts,
            keys,
            audit,
            auth,
        }
    }

    async fn get(&self, id: Uuid) -> AppResult<AccountRow> {
        self.accounts
            .find(id)
            .await?
            .ok_or(AppError::NotFound("account"))
    }

    // ── reading ──────────────────────────────────────────────────────────

    pub async fn list(&self, p: ListParams) -> AppResult<(Vec<AccountRow>, i64)> {
        if let Some(s) = &p.status {
            if !matches!(s.as_str(), "active" | "suspended") {
                return Err(invalid("status", "must be `active` or `suspended`"));
            }
        }
        if let Some(r) = &p.role {
            if !ROLES.contains(&r.as_str()) {
                return Err(invalid("role", "not a role"));
            }
        }
        let filter = AccountFilter {
            status: p.status,
            role: p.role,
            query: p
                .query
                .map(|q| q.trim().to_string())
                .filter(|q| !q.is_empty())
                .map(|q| escape_like(&q)),
            limit: p.limit,
            offset: p.offset,
        };
        Ok((
            self.accounts.list(&filter).await?,
            self.accounts.count(&filter).await?,
        ))
    }

    pub async fn detail(&self, id: Uuid) -> AppResult<AccountDetail> {
        let account = self.get(id).await?;
        Ok(AccountDetail {
            contacts: self.accounts.contacts(id).await?,
            sessions: self.accounts.sessions(id).await?,
            api_keys: self.keys.list(Some(id)).await?,
            account,
        })
    }

    pub async fn stats(&self) -> AppResult<Stats> {
        Ok(Stats {
            counts: self.accounts.counts().await?,
            by_role: self.accounts.role_counts().await?,
        })
    }

    // ── accounts ─────────────────────────────────────────────────────────

    pub async fn create(
        &self,
        actor: Uuid,
        display_name: &str,
        channel: &str,
        identifier: &str,
        roles: &[String],
    ) -> AppResult<Account> {
        let name = display_name.trim();
        if !(1..=120).contains(&name.chars().count()) {
            return Err(invalid("display_name", "must be 1 to 120 characters"));
        }
        let identifier = validate_contact(channel, identifier)?;
        for role in roles {
            if !ROLES.contains(&role.as_str()) {
                return Err(invalid(
                    "roles",
                    "each role must be `warehouse`, `store`, `carrier` or `admin`",
                ));
            }
        }
        let account = self
            .accounts
            .create(name, channel, &identifier, roles)
            .await?;
        self.audit
            .record(
                actor,
                "account.create",
                Some("account"),
                Some(account.id),
                json!({ "channel": channel, "roles": roles }),
            )
            .await?;
        Ok(account)
    }

    /// Stops an account signing in and ends its sessions. Its API keys stop
    /// working too (exchanging one checks the account is active).
    pub async fn suspend(&self, actor: Uuid, id: Uuid, reason: &str) -> AppResult<()> {
        let reason = reason.trim();
        if !(3..=300).contains(&reason.chars().count()) {
            return Err(invalid("reason", "say why, in 3 to 300 characters"));
        }
        self.guard_not_locking_out_admins(actor, id, "suspend")
            .await?;
        if !self.accounts.suspend(id, reason).await? {
            return Err(AppError::Conflict(
                "only an active account can be suspended".into(),
            ));
        }
        let ended = self.accounts.revoke_all_sessions(id).await?;
        self.audit
            .record(
                actor,
                "account.suspend",
                Some("account"),
                Some(id),
                json!({ "reason": reason, "sessions_ended": ended }),
            )
            .await
    }

    pub async fn reinstate(&self, actor: Uuid, id: Uuid) -> AppResult<()> {
        if !self.accounts.reinstate(id).await? {
            return Err(AppError::Conflict(
                "only a suspended account can be reinstated".into(),
            ));
        }
        self.audit
            .record(
                actor,
                "account.reinstate",
                Some("account"),
                Some(id),
                json!({}),
            )
            .await
    }

    pub async fn remove(&self, actor: Uuid, id: Uuid) -> AppResult<()> {
        self.get(id).await?;
        self.guard_not_locking_out_admins(actor, id, "delete")
            .await?;
        if !self.accounts.remove(id).await? {
            return Err(AppError::NotFound("account"));
        }
        self.audit
            .record(
                actor,
                "account.delete",
                Some("account"),
                Some(id),
                json!({}),
            )
            .await
    }

    async fn guard_not_locking_out_admins(
        &self,
        actor: Uuid,
        target: Uuid,
        verb: &'static str,
    ) -> AppResult<()> {
        if actor == target {
            return Err(AppError::Conflict(format!(
                "you can't {verb} your own account"
            )));
        }
        let roles = self.auth.list_roles(target).await?;
        if roles.iter().any(|r| r == "admin")
            && self.accounts.other_active_admins(target).await? == 0
        {
            return Err(AppError::Conflict(format!(
                "you can't {verb} the last active admin"
            )));
        }
        Ok(())
    }

    // ── sessions ─────────────────────────────────────────────────────────

    pub async fn revoke_session(&self, actor: Uuid, session_id: Uuid) -> AppResult<()> {
        let Some(account_id) = self.accounts.revoke_session(session_id).await? else {
            return Err(AppError::NotFound("session"));
        };
        self.audit
            .record(
                actor,
                "session.revoke",
                Some("session"),
                Some(session_id),
                json!({ "account_id": account_id }),
            )
            .await
    }

    pub async fn revoke_all_sessions(&self, actor: Uuid, account_id: Uuid) -> AppResult<u64> {
        self.get(account_id).await?;
        let ended = self.accounts.revoke_all_sessions(account_id).await?;
        self.audit
            .record(
                actor,
                "sessions.revoke_all",
                Some("account"),
                Some(account_id),
                json!({ "sessions_ended": ended }),
            )
            .await?;
        Ok(ended)
    }

    // ── API keys ─────────────────────────────────────────────────────────

    pub async fn list_keys(&self, account_id: Option<Uuid>) -> AppResult<Vec<ApiKeyRow>> {
        self.keys.list(account_id).await
    }

    /// Makes a key for an account. The key is in the return value once and is
    /// stored nowhere.
    pub async fn create_key(
        &self,
        actor: Uuid,
        account_id: Uuid,
        name: &str,
        expires_in_days: Option<i64>,
    ) -> AppResult<CreatedKey> {
        let name = name.trim();
        if !(1..=80).contains(&name.chars().count()) {
            return Err(invalid("name", "must be 1 to 80 characters"));
        }
        if let Some(d) = expires_in_days {
            if !(1..=730).contains(&d) {
                return Err(invalid("expires_in_days", "must be between 1 and 730"));
            }
        }
        let owner = self.get(account_id).await?;
        if owner.status != "active" {
            return Err(AppError::Conflict(
                "a key can only be made for an active account".into(),
            ));
        }
        let (key, hash) = new_api_key();
        let api_key = self
            .keys
            .create(
                account_id,
                name,
                &key_prefix(&key),
                &hash,
                actor,
                expires_in_days,
            )
            .await?;
        self.audit
            .record(
                actor,
                "api_key.create",
                Some("api_key"),
                Some(api_key.id),
                json!({ "account_id": account_id, "name": name, "prefix": api_key.prefix, "expires_in_days": expires_in_days }),
            )
            .await?;
        Ok(CreatedKey { key, api_key })
    }

    pub async fn revoke_key(&self, actor: Uuid, id: Uuid) -> AppResult<()> {
        let key = self
            .keys
            .find(id)
            .await?
            .ok_or(AppError::NotFound("api key"))?;
        if !self.keys.revoke(id).await? {
            return Err(AppError::Conflict("that key is already revoked".into()));
        }
        self.audit
            .record(
                actor,
                "api_key.revoke",
                Some("api_key"),
                Some(id),
                json!({ "account_id": key.account_id, "name": key.name, "prefix": key.prefix }),
            )
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_key_is_random_prefixed_and_stored_only_as_its_hash() {
        let (key, hash) = new_api_key();
        assert!(key.starts_with("slk_"));
        assert!(key.len() >= 40);
        assert_eq!(hash, hash_api_key(&key));
        assert_eq!(hash.len(), 64);
        assert!(
            !hash.contains(&key[4..]),
            "the hash must not contain the key"
        );
        assert_ne!(key, new_api_key().0, "keys don't repeat");
        assert_eq!(key_prefix(&key).len(), 12);
        assert!(
            key.len() > key_prefix(&key).len(),
            "a prefix is not the whole key"
        );
    }

    #[test]
    fn contacts_are_checked_by_channel() {
        assert_eq!(
            validate_contact("email", " Ops@Example.com ").unwrap(),
            "ops@example.com"
        );
        assert!(validate_contact("email", "not-an-email").is_err());
        assert!(validate_contact("email", "a b@example.com").is_err());
        assert!(validate_contact("phone", "+26771234567").is_ok());
        assert!(validate_contact("phone", "12ab").is_err());
        assert!(validate_contact("fax", "123").is_err());
    }

    #[test]
    fn search_text_is_matched_literally() {
        assert_eq!(escape_like("50%_off"), "50\\%\\_off");
    }
}
