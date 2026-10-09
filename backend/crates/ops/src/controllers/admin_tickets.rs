//! The support queue, for staff. Every route needs the `admin` role (the
//! [`AdminUser`] extractor says so in the handler's signature). Every change a
//! staff member makes is recorded in the ticket's audit trail by the service.

use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;
use tagwise_shared::auth::AdminUser;
use tagwise_shared::errors::{AppError, AppResult};
use tagwise_shared::utils::validation::{UuidPath, ValidatedJson};
use uuid::Uuid;

use crate::schemas::tickets::{
    MessageRes, QueueRes, StaffPatchReq, StaffReplyReq, StaffTicketDetailRes, StaffTicketRes,
};
use crate::services::ticket_service::{Assignee, QueueParams, StaffPatch};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct QueueQuery {
    pub status: Option<String>,
    pub kind: Option<String>,
    pub assignee: Option<String>,
    pub q: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/v1/admin/tickets",
    tag = "admin-tickets",
    params(
        ("status" = Option<String>, Query, description = "`open`, `in_progress`, `waiting`, `resolved` or `closed`"),
        ("kind" = Option<String>, Query, description = "`bug`, `question`, `report` or `request`"),
        ("assignee" = Option<String>, Query, description = "`mine` or `unassigned`"),
        ("q" = Option<String>, Query, description = "Text in the subject or body"),
        ("limit" = Option<i64>, Query, description = "1 to 200, default 50"),
        ("offset" = Option<i64>, Query, description = "Rows to skip"),
    ),
    responses((status = 200, body = QueueRes)),
)]
pub async fn queue(
    State(state): State<AppState>,
    admin: AdminUser,
    Query(q): Query<QueueQuery>,
) -> AppResult<Json<QueueRes>> {
    let (tickets, counts) = state
        .tickets
        .queue(
            admin.0.account_id,
            QueueParams {
                status: q.status,
                kind: q.kind,
                assignee: q.assignee,
                query: q.q,
                limit: q.limit.unwrap_or(50),
                offset: q.offset.unwrap_or(0),
            },
        )
        .await?;
    Ok(Json(QueueRes {
        tickets: tickets.into_iter().map(Into::into).collect(),
        counts: counts.into_iter().map(Into::into).collect(),
    }))
}

#[utoipa::path(
    get,
    path = "/v1/admin/tickets/{ticket_id}",
    tag = "admin-tickets",
    responses((status = 200, body = StaffTicketDetailRes)),
)]
pub async fn detail(
    State(state): State<AppState>,
    _admin: AdminUser,
    UuidPath(ticket_id): UuidPath,
) -> AppResult<Json<StaffTicketDetailRes>> {
    let d = state.tickets.staff_detail(ticket_id).await?;
    Ok(Json(StaffTicketDetailRes {
        ticket: d.ticket.into(),
        requester: d.requester.map(Into::into),
        messages: d.messages.into_iter().map(Into::into).collect(),
        events: d.events.into_iter().map(Into::into).collect(),
    }))
}

#[utoipa::path(
    patch,
    path = "/v1/admin/tickets/{ticket_id}",
    tag = "admin-tickets",
    request_body = StaffPatchReq,
    responses((status = 200, body = StaffTicketRes)),
)]
pub async fn update(
    State(state): State<AppState>,
    admin: AdminUser,
    UuidPath(ticket_id): UuidPath,
    Json(req): Json<StaffPatchReq>,
) -> AppResult<Json<StaffTicketRes>> {
    let assignee = match req.assignee.as_deref() {
        None => None,
        Some("me") => Some(Assignee::Me),
        Some("none") => Some(Assignee::Nobody),
        Some(id) => Some(Assignee::Account(Uuid::parse_str(id).map_err(|_| {
            AppError::Validation {
                field: "assignee".into(),
                message: "must be `me`, `none` or an account id".into(),
            }
        })?)),
    };
    let ticket = state
        .tickets
        .staff_update(
            admin.0.account_id,
            ticket_id,
            StaffPatch {
                status: req.status,
                priority: req.priority,
                assignee,
            },
        )
        .await?;
    Ok(Json(ticket.into()))
}

#[utoipa::path(
    post,
    path = "/v1/admin/tickets/{ticket_id}/messages",
    operation_id = "admin_ticket_reply",
    tag = "admin-tickets",
    request_body = StaffReplyReq,
    responses((status = 200, body = MessageRes)),
)]
pub async fn reply(
    State(state): State<AppState>,
    admin: AdminUser,
    UuidPath(ticket_id): UuidPath,
    ValidatedJson(req): ValidatedJson<StaffReplyReq>,
) -> AppResult<Json<MessageRes>> {
    let message = state
        .tickets
        .staff_reply(admin.0.account_id, ticket_id, &req.body, req.internal)
        .await?;
    Ok(Json(message.into()))
}
