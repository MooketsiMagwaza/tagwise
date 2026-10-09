//! Settings: read and edit the caller's own profile and preferences, list and
//! revoke their sessions, delete their account.

use uuid::Uuid;

use tagwise_shared::errors::{AppError, AppResult};

use crate::models::account::AccountContact;
use crate::repositories::me_repository::{MeRepository, ProfileRow, SessionRow};

/// Preferences are a convenience store, not a database: cap the size so an
/// account can't be used to park arbitrary data.
const MAX_PREFERENCES_BYTES: usize = 8 * 1024;

#[derive(Clone)]
pub struct MeService {
    repo: MeRepository,
}

impl MeService {
    pub fn new(repo: MeRepository) -> Self {
        Self { repo }
    }

    pub async fn profile(&self, account_id: Uuid) -> AppResult<(ProfileRow, Vec<AccountContact>)> {
        let profile = self
            .repo
            .profile(account_id)
            .await?
            .ok_or(AppError::NotFound("account"))?;
        let contacts = self.repo.contacts(account_id).await?;
        Ok((profile, contacts))
    }

    pub async fn update(
        &self,
        account_id: Uuid,
        display_name: Option<String>,
        preferred_lang: Option<String>,
        preferences: Option<serde_json::Value>,
    ) -> AppResult<(ProfileRow, Vec<AccountContact>)> {
        if let Some(name) = &display_name {
            let len = name.trim().chars().count();
            if !(1..=120).contains(&len) {
                return Err(AppError::Validation {
                    field: "display_name".into(),
                    message: "must be 1 to 120 characters".into(),
                });
            }
        }
        if let Some(lang) = &preferred_lang {
            let ok = (2..=8).contains(&lang.len())
                && lang.chars().all(|c| c.is_ascii_alphabetic() || c == '-');
            if !ok {
                return Err(AppError::Validation {
                    field: "preferred_lang".into(),
                    message: "must be a language tag such as `en`".into(),
                });
            }
        }
        if let Some(prefs) = &preferences {
            if !prefs.is_object() {
                return Err(AppError::Validation {
                    field: "preferences".into(),
                    message: "must be a JSON object".into(),
                });
            }
            if prefs.to_string().len() > MAX_PREFERENCES_BYTES {
                return Err(AppError::Validation {
                    field: "preferences".into(),
                    message: "too large".into(),
                });
            }
        }

        let updated = self
            .repo
            .update_profile(
                account_id,
                display_name.as_deref().map(str::trim),
                preferred_lang.as_deref(),
                preferences,
            )
            .await?;
        if !updated {
            return Err(AppError::NotFound("account"));
        }
        self.profile(account_id).await
    }

    pub async fn notification_settings(
        &self,
        account_id: Uuid,
    ) -> AppResult<(Option<serde_json::Value>, Option<String>)> {
        self.repo.notification_settings(account_id).await
    }

    pub async fn sessions(&self, account_id: Uuid) -> AppResult<Vec<SessionRow>> {
        self.repo.list_sessions(account_id).await
    }

    pub async fn revoke_session(&self, account_id: Uuid, session_id: Uuid) -> AppResult<()> {
        if self.repo.revoke_session(account_id, session_id).await? {
            Ok(())
        } else {
            Err(AppError::NotFound("session"))
        }
    }

    pub async fn revoke_all_sessions(&self, account_id: Uuid) -> AppResult<u64> {
        self.repo.revoke_all_sessions(account_id).await
    }

    /// Deletes the account and signs it out everywhere.
    pub async fn delete_account(&self, account_id: Uuid) -> AppResult<()> {
        if !self.repo.soft_delete(account_id).await? {
            return Err(AppError::NotFound("account"));
        }
        self.repo.revoke_all_sessions(account_id).await?;
        Ok(())
    }
}
