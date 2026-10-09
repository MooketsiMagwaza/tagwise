//! The register service's OpenAPI document (served at /openapi.json outside
//! production; `tagwise-register openapi` prints it).

use utoipa::OpenApi;

use crate::controllers::register;
use crate::repository::{ActivityEntry, Asset, Comment, Count, Site, StockLine, Workspace};

#[derive(OpenApi)]
#[openapi(
    info(title = "Tagwise register service", version = "0.1.0"),
    paths(
        register::my_workspaces,
        register::create_workspace,
        register::sites,
        register::assets,
        register::asset,
        register::edit_asset,
        register::stock,
        register::adjust_stock,
        register::counts,
        register::start_count,
        register::scan,
        register::comments,
        register::add_comment,
        register::activity,
    ),
    components(schemas(
        Workspace,
        Site,
        Asset,
        StockLine,
        Count,
        Comment,
        ActivityEntry,
        register::CreateWorkspaceReq,
        register::EditAssetReq,
        register::ConflictRes,
        register::AdjustReq,
        register::StartCountReq,
        register::ScanReq,
        register::ScanRes,
        register::AddCommentReq,
    )),
    tags(
        (name = "workspaces", description = "Workspaces you belong to"),
        (name = "sites", description = "Offices, stores, schools and clinics"),
        (name = "assets", description = "Tagged assets; edits are version-checked"),
        (name = "stock", description = "Stock lines; adjustments are idempotent and never go below zero"),
        (name = "counts", description = "Stock-takes and scans"),
        (name = "comments", description = "Comments on assets and stock lines"),
        (name = "activity", description = "The workspace activity log"),
    )
)]
pub struct ApiDoc;
