//! Support, from the requester's side. Every route acts on the caller's own
//! tickets; someone else's ticket is "not found", never "forbidden", so its
//! existence isn't confirmed.

use axum::extract::State;
use axum::Json;
use tagwise_shared::auth::AuthUser;
use tagwise_shared::errors::AppResult;
use tagwise_shared::utils::validation::{UuidPath, ValidatedJson};

use crate::schemas::tickets::{CreateTicketReq, MessageRes, ReplyReq, TicketDetailRes, TicketRes};
use crate::state::AppState;

#[utoipa::path(
    post,
    path = "/v1/support/tickets",
    tag = "support",
    request_body = CreateTicketReq,
    responses((status = 200, body = TicketRes)),
)]
pub async fn create_ticket(
    State(state): State<AppState>,
    user: AuthUser,
    ValidatedJson(req): ValidatedJson<CreateTicketReq>,
) -> AppResult<Json<TicketRes>> {
    let ticket = state
        .tickets
        .create(
            user.account_id,
            &req.kind,
            &req.subject,
            &req.body,
            req.context,
        )
        .await?;
    Ok(Json(ticket.into()))
}

#[utoipa::path(
    get,
    path = "/v1/support/tickets",
    tag = "support",
    responses((status = 200, body = [TicketRes])),
)]
pub async fn my_tickets(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Vec<TicketRes>>> {
    let rows = state.tickets.mine(user.account_id).await?;
    Ok(Json(rows.into_iter().map(Into::into).collect()))
}

#[utoipa::path(
    get,
    path = "/v1/support/tickets/{ticket_id}",
    tag = "support",
    responses((status = 200, body = TicketDetailRes)),
)]
pub async fn my_ticket(
    State(state): State<AppState>,
    user: AuthUser,
    UuidPath(ticket_id): UuidPath,
) -> AppResult<Json<TicketDetailRes>> {
    let (ticket, messages) = state.tickets.get_own(user.account_id, ticket_id).await?;
    Ok(Json(TicketDetailRes {
        ticket: ticket.into(),
        messages: messages.into_iter().map(Into::into).collect(),
    }))
}

#[utoipa::path(
    post,
    path = "/v1/support/tickets/{ticket_id}/messages",
    tag = "support",
    request_body = ReplyReq,
    responses((status = 200, body = MessageRes)),
)]
pub async fn reply(
    State(state): State<AppState>,
    user: AuthUser,
    UuidPath(ticket_id): UuidPath,
    ValidatedJson(req): ValidatedJson<ReplyReq>,
) -> AppResult<Json<MessageRes>> {
    let message = state
        .tickets
        .reply_as_requester(user.account_id, ticket_id, &req.body)
        .await?;
    Ok(Json(message.into()))
}

#[utoipa::path(
    post,
    path = "/v1/support/tickets/{ticket_id}/close",
    tag = "support",
    responses((status = 200, body = TicketRes)),
)]
pub async fn close(
    State(state): State<AppState>,
    user: AuthUser,
    UuidPath(ticket_id): UuidPath,
) -> AppResult<Json<TicketRes>> {
    let ticket = state.tickets.close_own(user.account_id, ticket_id).await?;
    Ok(Json(ticket.into()))
}
