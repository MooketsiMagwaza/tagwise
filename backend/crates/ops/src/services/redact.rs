//! What the database viewer never shows. A column whose *name* says it holds a
//! secret is replaced, whatever its content, and the same rule is applied to
//! the keys inside JSON values. Deciding by name (not by looking at values)
//! errs toward hiding: an innocent column that happens to match is masked, and
//! nothing sensitive slips through because it "looked harmless".

use serde_json::{Map, Value};

pub const REDACTED: &str = "••• redacted";

/// Parts of a name that mark it as secret wherever they appear.
const SECRET_PARTS: &[&str] = &[
    "password",
    "passwd",
    "secret",
    "token",
    "hash",
    "private",
    "credential",
    "signature",
    "api_key",
    "apikey",
    "access_key",
    "cvv",
    "card_number",
];

/// Does this column (or JSON key) name mark its value as secret?
///
/// Besides the parts above: `otp` as a word (`otp_challenges`, `otp_hash`) and
/// `code` as a word or suffix (`pickup_code`, `delivery_code`) — the handover
/// codes are secrets until they are used.
pub fn is_secret_name(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    if SECRET_PARTS.iter().any(|p| n.contains(p)) {
        return true;
    }
    n.split('_').any(|w| w == "otp") || n == "code" || n.ends_with("_code")
}

/// Masks secret keys anywhere inside a JSON value.
pub fn redact_json(value: &mut Value) {
    match value {
        Value::Object(map) => redact_object(map),
        Value::Array(items) => items.iter_mut().for_each(redact_json),
        _ => {}
    }
}

fn redact_object(map: &mut Map<String, Value>) {
    for (key, value) in map.iter_mut() {
        if is_secret_name(key) {
            *value = Value::String(REDACTED.to_string());
        } else {
            redact_json(value);
        }
    }
}

/// Masks one row (a JSON object keyed by column name).
pub fn redact_row(row: &mut Value) {
    if let Value::Object(map) = row {
        redact_object(map);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn secret_looking_names_are_recognised() {
        for name in [
            "password_hash",
            "secret_hash",
            "refresh_token",
            "token",
            "code_hash",
            "key_hash",
            "Api_Key",
            "otp_hash",
            "pickup_code",
            "delivery_code",
            "code",
            "signature",
            "cvv",
            "client_secret",
        ] {
            assert!(is_secret_name(name), "{name} should be treated as secret");
        }
        for name in [
            "id",
            "display_name",
            "status",
            "prefix",
            "barcode",
            "currency",
            "footprint",
            "created_at",
            "total",
        ] {
            assert!(!is_secret_name(name), "{name} should be visible");
        }
    }

    #[test]
    fn a_row_has_its_secret_columns_masked_and_the_rest_left_alone() {
        let mut row = json!({ "id": 7, "secret_hash": "$argon2id$abc", "status": "active", "pickup_code": "123456" });
        redact_row(&mut row);
        assert_eq!(row["id"], 7);
        assert_eq!(row["status"], "active");
        assert_eq!(row["secret_hash"], REDACTED);
        assert_eq!(row["pickup_code"], REDACTED);
        assert!(
            !row.to_string().contains("argon2"),
            "the secret must not survive anywhere"
        );
    }

    #[test]
    fn secrets_inside_json_values_are_masked_too() {
        let mut row = json!({ "payload": { "order": 1, "token": "abc", "nested": [{ "password": "x", "ok": true }] } });
        redact_row(&mut row);
        assert_eq!(row["payload"]["order"], 1);
        assert_eq!(row["payload"]["token"], REDACTED);
        assert_eq!(row["payload"]["nested"][0]["password"], REDACTED);
        assert_eq!(row["payload"]["nested"][0]["ok"], true);
    }
}
