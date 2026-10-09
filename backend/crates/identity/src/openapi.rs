//! OpenAPI document assembly: every `#[utoipa::path]`-annotated handler and
//! the schema it references, listed once here rather than discovered by
//! macro magic — the OpenAPI coverage guard (WO-03) diffs this list against
//! the mounted routes, so an entry only mounted here and not in `routes.rs`
//! (or vice versa) fails CI instead of silently drifting.

use utoipa::OpenApi;

use crate::controllers::{admin, auth, me};
use crate::schemas::account::{
    LogoutReq, RefreshReq, RequestOtpReq, RequestOtpRes, TokenPairRes, VerifyOtpReq,
};
use crate::schemas::admin::{
    AccountDetailRes, AccountListRes, AccountRes, AdminAuditEntryRes, AdminLinksRes,
    AdminSessionRes, ApiKeyRes, ApiKeyTokenReq, ApiKeyTokenRes, CreateAccountReq, CreateApiKeyReq,
    CreatedApiKeyRes, SessionsRevokedRes, SuspendReq,
};
use crate::schemas::common::{DependencyStatus, ErrorBody, ErrorRes, ReadyRes};
use crate::schemas::me::{ContactRes, MeRes, SessionRes, UpdateMeReq};

#[derive(OpenApi)]
#[openapi(
    paths(
        auth::request_otp,
        auth::verify_otp,
        auth::refresh,
        auth::logout,
        auth::api_key_token,
        me::get_me,
        me::patch_me,
        me::delete_me,
        me::list_sessions,
        me::revoke_session,
        me::revoke_all_sessions,
        admin::audit_log,
        admin::links,
        admin::list_accounts,
        admin::get_account,
        admin::create_account,
        admin::suspend_account,
        admin::reinstate_account,
        admin::delete_account,
        admin::revoke_all_sessions,
        admin::revoke_session,
        admin::list_api_keys,
        admin::create_api_key,
        admin::revoke_api_key,
    ),
    components(schemas(
        RequestOtpReq,
        RequestOtpRes,
        VerifyOtpReq,
        RefreshReq,
        LogoutReq,
        TokenPairRes,
        MeRes,
        ContactRes,
        UpdateMeReq,
        SessionRes,
        AdminAuditEntryRes,
        AdminLinksRes,
        AccountRes,
        AccountListRes,
        AccountDetailRes,
        AdminSessionRes,
        ApiKeyRes,
        CreateAccountReq,
        SuspendReq,
        SessionsRevokedRes,
        CreateApiKeyReq,
        CreatedApiKeyRes,
        ApiKeyTokenReq,
        ApiKeyTokenRes,
        DependencyStatus,
        ReadyRes,
        ErrorBody,
        ErrorRes,
    )),
    tags(
        (name = "auth", description = "Email/phone OTP sign-in, refresh and logout"),
        (name = "me", description = "The signed-in account: profile, preferences, sessions, deletion"),
        (name = "admin", description = "Admin console: accounts, sessions, API keys, audit log and deep links - staff only"),
    ),
)]
pub struct ApiDoc;
