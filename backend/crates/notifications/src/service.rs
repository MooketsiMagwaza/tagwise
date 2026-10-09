//! Creates notifications, honouring the recipient's preferences: for each
//! category the account chose which channels are on (in the app, push, email),
//! and a muted channel is never used — a muted category creates no inbox row at
//! all. Push and email failures never fail the caller; the in-app notification
//! (the record of truth) is written first.

use std::sync::Arc;

use uuid::Uuid;

use crate::identity_client::IdentityClient;
use crate::models::notification::Notification;
use crate::provider::{NotificationEvent, NotificationProvider};
use crate::repositories::device_repository::DeviceRepository;
use crate::repositories::notification_repository::{Listing, NotificationRepository};
use tagwise_shared::errors::AppResult;

/// The kinds of notification a person can mute.
pub const CATEGORIES: &[&str] = &["orders", "payments", "deliveries", "support", "system"];

#[derive(Clone)]
pub struct NotificationService {
    repo: NotificationRepository,
    devices: DeviceRepository,
    push: Option<Arc<dyn NotificationProvider>>,
    identity: IdentityClient,
}

impl NotificationService {
    pub fn new(
        repo: NotificationRepository,
        devices: DeviceRepository,
        push: Option<Arc<dyn NotificationProvider>>,
        identity: IdentityClient,
    ) -> Self {
        Self {
            repo,
            devices,
            push,
            identity,
        }
    }

    /// Raises a notification for `account_id` in `category`, on whichever
    /// channels that account has left on. Returns whether an in-app
    /// notification was created.
    #[allow(clippy::too_many_arguments)]
    pub async fn dispatch(
        &self,
        account_id: Uuid,
        category: &str,
        kind: &str,
        title: &str,
        body: &str,
        link: Option<&str>,
        data: serde_json::Value,
    ) -> AppResult<bool> {
        let category = if CATEGORIES.contains(&category) {
            category
        } else {
            "system"
        };
        let channels = self.identity.channels_for(account_id, category).await;

        if channels.inapp {
            self.repo
                .create(account_id, category, kind, title, body, link, data)
                .await?;
        }

        if channels.push {
            if let Some(push) = &self.push {
                let targets = self.devices.active_targets_for_account(account_id).await?;
                if !targets.is_empty() {
                    let event = NotificationEvent::Generic {
                        title: title.to_string(),
                        body: body.to_string(),
                    };
                    if let Err(err) = push.send(&event, &targets).await {
                        tracing::warn!(error = ?err, "push dispatch failed; in-app notification still recorded");
                    }
                }
            }
        }

        if channels.email {
            self.identity.send_email(account_id, title, body).await;
        }
        Ok(channels.inapp)
    }

    pub async fn list(
        &self,
        account_id: Uuid,
        unread_only: bool,
        limit: i64,
    ) -> AppResult<Vec<Notification>> {
        self.repo
            .list(account_id, Listing { unread_only, limit })
            .await
    }

    pub async fn unread_count(&self, account_id: Uuid) -> AppResult<i64> {
        self.repo.unread_count(account_id).await
    }

    pub async fn mark_read(&self, account_id: Uuid, id: Uuid) -> AppResult<bool> {
        self.repo.mark_read(account_id, id).await
    }

    pub async fn mark_all_read(&self, account_id: Uuid) -> AppResult<u64> {
        self.repo.mark_all_read(account_id).await
    }

    pub async fn delete(&self, account_id: Uuid, id: Uuid) -> AppResult<bool> {
        self.repo.delete(account_id, id).await
    }

    pub async fn clear(&self, account_id: Uuid) -> AppResult<u64> {
        self.repo.clear(account_id).await
    }
}
