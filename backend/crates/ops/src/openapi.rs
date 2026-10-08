//! OpenAPI document assembly: every `#[utoipa::path]`-annotated handler and
//! the schema it references, listed once here rather than discovered by
//! macro magic — the OpenAPI coverage guard diffs this list against the
//! mounted routes, so an entry only mounted here and not in `routes.rs` (or
//! vice versa) fails CI instead of silently drifting.

use utoipa::OpenApi;

use crate::clients::stats_clients::{
    CommerceStats, CurrencyAmount, IdentityStats, RoleCount, StatusCount,
};
use crate::controllers::{admin_tickets, console, support};
use crate::schemas::common::{DependencyStatus, ErrorBody, ErrorRes, ReadyRes};
use crate::schemas::console::{
    AlertRes, AlertsRes, ColumnRes, CommerceSection, ConnectionRes, ContainerMemoryRes,
    DatabaseRes, DatabasesRes, HealthRes, MemoryRes, OpsAuditEntryRes, OverviewRes, RowsRes,
    ServiceHealthRes, StatusRes, TableRes, TerminateReq, TicketSection, TrafficSection,
    UsersSection,
};
use crate::schemas::tickets::{
    CreateTicketReq, EventRes, MessageRes, QueueRes, ReplyReq, RequesterRes, StaffPatchReq,
    StaffReplyReq, StaffTicketDetailRes, StaffTicketRes, StatusCountRes, TicketDetailRes,
    TicketRes,
};

#[derive(OpenApi)]
#[openapi(
    paths(
        support::create_ticket,
        support::my_tickets,
        support::my_ticket,
        support::reply,
        support::close,
        admin_tickets::queue,
        admin_tickets::detail,
        admin_tickets::update,
        admin_tickets::reply,
        console::overview,
        console::health,
        console::memory,
        console::alerts,
        console::databases,
        console::tables,
        console::rows,
        console::connections,
        console::terminate_connection,
        console::audit_log,
    ),
    components(schemas(
        CreateTicketReq,
        ReplyReq,
        StaffReplyReq,
        StaffPatchReq,
        TicketRes,
        MessageRes,
        TicketDetailRes,
        StaffTicketRes,
        StatusCountRes,
        QueueRes,
        EventRes,
        RequesterRes,
        StaffTicketDetailRes,
        StatusRes,
        UsersSection,
        CommerceSection,
        TrafficSection,
        TicketSection,
        OverviewRes,
        ServiceHealthRes,
        HealthRes,
        ContainerMemoryRes,
        MemoryRes,
        AlertRes,
        AlertsRes,
        DatabaseRes,
        DatabasesRes,
        TableRes,
        ColumnRes,
        RowsRes,
        ConnectionRes,
        TerminateReq,
        OpsAuditEntryRes,
        IdentityStats,
        CommerceStats,
        RoleCount,
        StatusCount,
        CurrencyAmount,
        DependencyStatus,
        ReadyRes,
        ErrorBody,
        ErrorRes,
    )),
    tags(
        (name = "support", description = "Raise a request, follow it and reply — the requester's side"),
        (name = "admin-tickets", description = "The support queue: triage, assign, reply and resolve — staff only"),
        (name = "admin-ops", description = "Overview, service health, container memory, alerts, the database viewer, connections and the ops audit log — staff only"),
    ),
)]
pub struct ApiDoc;
