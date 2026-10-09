//! The shape encoded into every access token, and the role names every
//! service checks against it. Roles are plain strings, not an enum — a
//! service that doesn't know about a given role just never matches it,
//! rather than failing to compile against a domain it doesn't own any part
//! of (see ARCHITECTURE.md, accounts and roles).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Every Tagwise account. What someone may do inside a workspace (owner,
/// admin, editor, auditor, viewer) is the register service's business.
pub const ROLE_MEMBER: &str = "member";
/// Tagwise staff: the admin console.
pub const ROLE_ADMIN: &str = "admin";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenClaims {
    /// The account id this token was issued to.
    pub sub: Uuid,
    pub roles: Vec<String>,
    /// Unique per issued token, not per session — lets a single access
    /// token be revoked (via the denylist) without touching the refresh
    /// session it was minted from.
    pub jti: Uuid,
    pub iat: i64,
    pub exp: i64,
    pub iss: String,
    pub aud: String,
}

impl TokenClaims {
    pub fn has_role(&self, role: &str) -> bool {
        self.roles.iter().any(|r| r == role)
    }

    /// Never negative — a token presented after `exp` has already failed
    /// verification before anything reads this, so a caller computing "how
    /// long left to denylist this jti for" only ever sees a sensible value.
    pub fn remaining_ttl_secs(&self, now: DateTime<Utc>) -> i64 {
        (self.exp - now.timestamp()).max(0)
    }
}
