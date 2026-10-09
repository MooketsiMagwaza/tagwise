//! OpenAPI document assembly: every `#[utoipa::path]`-annotated handler and
//! the schema it references, listed once here rather than discovered by
//! macro magic — the OpenAPI coverage guard (WO-03) diffs this list against
//! the mounted routes, so an entry only mounted here and not in `routes.rs`
//! (or vice versa) fails CI instead of silently drifting.

use utoipa::OpenApi;

use crate::controllers::notifications;
use crate::schemas::common::{DependencyStatus, ErrorBody, ErrorRes, ReadyRes};
use crate::schemas::notifications::{NotificationRes, UnreadCountRes};

#[derive(OpenApi)]
#[openapi(
    paths(
        notifications::list_my_notifications,
        notifications::unread_count,
        notifications::mark_notification_read,
        notifications::mark_all_read,
        notifications::delete_notification,
        notifications::clear_notifications,
        notifications::register_device,
    ),
    components(schemas(
        NotificationRes,
        UnreadCountRes,
        notifications::RegisterDeviceReq,
        DependencyStatus,
        ReadyRes,
        ErrorBody,
        ErrorRes,
    )),
    tags((name = "notifications", description = "In-app notification inbox, preferences-aware delivery, and device registration")),
)]
pub struct ApiDoc;
