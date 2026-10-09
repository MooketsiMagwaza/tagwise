//! The register's rules, as pure functions so they are tested without a
//! database: workspace roles (the same table as the web app's
//! src/data/permissions.ts), how a stock-take scan is classified, how a
//! stock adjustment is validated, and when an edit is a conflict.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Owner,
    Admin,
    Editor,
    Auditor,
    Viewer,
}

impl Role {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "owner" => Some(Self::Owner),
            "admin" => Some(Self::Admin),
            "editor" => Some(Self::Editor),
            "auditor" => Some(Self::Auditor),
            "viewer" => Some(Self::Viewer),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Owner => "owner",
            Self::Admin => "admin",
            Self::Editor => "editor",
            Self::Auditor => "auditor",
            Self::Viewer => "viewer",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    AssetCreate,
    AssetEdit,
    AssetCustody,
    StockAdjust,
    Comment,
    Import,
    Export,
    CountRun,
    CountManage,
    LabelsPrint,
    ViewsSave,
    MembersManage,
    WorkspaceManage,
}

/// What each workspace role may do.
pub fn can(role: Role, action: Action) -> bool {
    use Action::*;
    match role {
        Role::Owner => true,
        Role::Admin => action != WorkspaceManage,
        Role::Editor => matches!(
            action,
            AssetCreate
                | AssetEdit
                | AssetCustody
                | StockAdjust
                | Comment
                | Import
                | Export
                | CountRun
                | LabelsPrint
                | ViewsSave
        ),
        Role::Auditor => matches!(
            action,
            Comment | Export | CountRun | CountManage | ViewsSave
        ),
        Role::Viewer => action == Comment,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScanResult {
    Found,
    WrongPlace,
    Unexpected,
    Unknown,
    Repeat,
}

impl ScanResult {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Found => "found",
            Self::WrongPlace => "wrong_place",
            Self::Unexpected => "unexpected",
            Self::Unknown => "unknown",
            Self::Repeat => "repeat",
        }
    }
}

/// What a scan means for a stock-take, given what the register knows.
/// `expected_place` is `Some(..)` when the asset was expected, holding the
/// room it was expected in (which may itself be unknown).
pub fn classify_scan(
    asset_known: bool,
    already_counted: bool,
    expected_place: Option<Option<uuid::Uuid>>,
    scanned_place: Option<uuid::Uuid>,
) -> ScanResult {
    if !asset_known {
        return ScanResult::Unknown;
    }
    if already_counted {
        return ScanResult::Repeat;
    }
    match expected_place {
        None => ScanResult::Unexpected,
        Some(expected) => match (expected, scanned_place) {
            (Some(e), Some(s)) if e != s => ScanResult::WrongPlace,
            _ => ScanResult::Found,
        },
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum AdjustError {
    Zero,
    TooLarge,
    MissingKey,
    KeyTooLong,
}

/// A stock adjustment is a non-zero whole number with a client-made
/// idempotency key; going below zero is refused by the conditional update.
pub fn validate_adjustment(delta: i32, idempotency_key: Option<&str>) -> Result<(), AdjustError> {
    if delta == 0 {
        return Err(AdjustError::Zero);
    }
    if delta.unsigned_abs() > 1_000_000 {
        return Err(AdjustError::TooLarge);
    }
    match idempotency_key.map(str::trim) {
        None | Some("") => Err(AdjustError::MissingKey),
        Some(k) if k.len() > 200 => Err(AdjustError::KeyTooLong),
        Some(_) => Ok(()),
    }
}

/// An edit made against an older version than the stored one is a
/// conflict: the caller sees the current version and chooses.
pub fn is_conflict(expected_version: i32, stored_version: i32) -> bool {
    expected_version != stored_version
}

/// Asset statuses the API accepts (checked out is reached through
/// check-out, not by editing the status).
pub const EDITABLE_STATUSES: &[&str] = &["in_use", "available", "in_repair", "missing", "retired"];

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn roles_match_the_web_app() {
        assert!(can(Role::Owner, Action::WorkspaceManage));
        assert!(!can(Role::Admin, Action::WorkspaceManage));
        assert!(can(Role::Admin, Action::MembersManage));
        assert!(can(Role::Editor, Action::StockAdjust));
        assert!(!can(Role::Editor, Action::CountManage));
        assert!(can(Role::Auditor, Action::CountManage));
        assert!(!can(Role::Auditor, Action::AssetEdit));
        assert!(can(Role::Viewer, Action::Comment));
        assert!(!can(Role::Viewer, Action::Export));
        assert_eq!(Role::parse("auditor"), Some(Role::Auditor));
        assert_eq!(Role::parse("warehouse"), None);
    }

    #[test]
    fn scans_are_classified() {
        let room = Uuid::new_v4();
        let other = Uuid::new_v4();
        assert_eq!(classify_scan(false, false, None, None), ScanResult::Unknown);
        assert_eq!(
            classify_scan(true, true, Some(Some(room)), Some(room)),
            ScanResult::Repeat
        );
        assert_eq!(
            classify_scan(true, false, None, Some(room)),
            ScanResult::Unexpected
        );
        assert_eq!(
            classify_scan(true, false, Some(Some(room)), Some(other)),
            ScanResult::WrongPlace
        );
        assert_eq!(
            classify_scan(true, false, Some(Some(room)), None),
            ScanResult::Found
        );
        assert_eq!(
            classify_scan(true, false, Some(None), Some(other)),
            ScanResult::Found
        );
    }

    #[test]
    fn adjustments_need_a_key_and_a_non_zero_amount() {
        assert_eq!(validate_adjustment(0, Some("k")), Err(AdjustError::Zero));
        assert_eq!(validate_adjustment(-3, None), Err(AdjustError::MissingKey));
        assert_eq!(
            validate_adjustment(-3, Some("  ")),
            Err(AdjustError::MissingKey)
        );
        assert_eq!(
            validate_adjustment(2_000_000, Some("k")),
            Err(AdjustError::TooLarge)
        );
        assert_eq!(
            validate_adjustment(-3, Some(&"x".repeat(201))),
            Err(AdjustError::KeyTooLong)
        );
        assert!(validate_adjustment(-3, Some("phone-42")).is_ok());
    }

    #[test]
    fn stale_edits_conflict() {
        assert!(is_conflict(3, 4));
        assert!(!is_conflict(4, 4));
    }
}
