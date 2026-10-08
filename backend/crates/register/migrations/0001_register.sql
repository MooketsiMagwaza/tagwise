-- Register service baseline: workspaces and who belongs to them, sites and
-- rooms, tagged assets and their custody, stock lines with movements,
-- stock-takes, comments, the activity log and saved views. The shapes match
-- the web app's src/data/types.ts. Accounts live in the identity service's
-- own database, so account ids here are plain uuids with no foreign key
-- (see ARCHITECTURE.md, services and data).

create extension if not exists pgcrypto;

create table workspaces (
    id uuid primary key default gen_random_uuid(),
    name text not null check (btrim(name) <> ''),
    tag_prefix text not null default 'TW' check (tag_prefix ~ '^[A-Z]{2,5}$'),
    currency text not null default 'BWP',
    created_at timestamptz not null default now()
);

-- Workspace roles. Mirrors src/data/permissions.ts on the web side.
create table memberships (
    workspace_id uuid not null references workspaces(id) on delete cascade,
    account_id uuid not null,
    role text not null check (role in ('owner', 'admin', 'editor', 'auditor', 'viewer')),
    created_at timestamptz not null default now(),
    primary key (workspace_id, account_id)
);
create index memberships_account_idx on memberships(account_id);

-- People who can hold things: members, and custodians without an account.
create table people (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    account_id uuid,
    name text not null check (btrim(name) <> ''),
    team text not null default '',
    created_at timestamptz not null default now()
);
create index people_workspace_idx on people(workspace_id);

create table sites (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    code text not null,
    name text not null,
    kind text not null check (kind in ('office', 'warehouse', 'school', 'clinic')),
    town text not null default '',
    address text not null default '',
    lat double precision check (lat between -90 and 90),
    lng double precision check (lng between -180 and 180),
    created_at timestamptz not null default now(),
    unique (workspace_id, code)
);

create table places (
    id uuid primary key default gen_random_uuid(),
    site_id uuid not null references sites(id) on delete cascade,
    name text not null,
    unique (site_id, name)
);

create table assets (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    tag text not null,
    name text not null check (btrim(name) <> ''),
    category text not null,
    model text,
    serial text,
    site_id uuid not null references sites(id),
    place_id uuid references places(id),
    status text not null default 'in_use'
        check (status in ('in_use', 'available', 'checked_out', 'in_repair', 'missing', 'retired')),
    custodian_id uuid references people(id),
    due_back date,
    purchased_on date,
    cost numeric(14, 2) check (cost >= 0),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    updated_by uuid not null,
    -- Bumped on every write; an edit against an older version is a conflict.
    version int not null default 1,
    unique (workspace_id, tag),
    -- A checked-out item always has someone and a date.
    check (status <> 'checked_out' or (custodian_id is not null and due_back is not null))
);
create index assets_workspace_status_idx on assets(workspace_id, status);
create index assets_site_idx on assets(site_id);

-- Stock lines: the catalogue and stock pattern from the owner's earlier
-- commerce service. Quantity can never go below zero (the check is the last
-- line of defence; decrements are conditional updates).
create table stock_lines (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    site_id uuid not null references sites(id),
    place_id uuid references places(id),
    sku text not null,
    barcode text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
    name text not null,
    category text not null default 'General',
    unit text not null default 'each',
    quantity int not null default 0 check (quantity >= 0),
    reorder_at int not null default 0 check (reorder_at >= 0),
    batch text,
    expires_on date,
    updated_at timestamptz not null default now(),
    updated_by uuid not null,
    version int not null default 1,
    unique (workspace_id, site_id, sku)
);

-- Every receipt and issue. The idempotency key makes a retried request
-- (a phone on a bad connection) apply once.
create table stock_movements (
    id uuid primary key default gen_random_uuid(),
    stock_line_id uuid not null references stock_lines(id) on delete cascade,
    delta int not null check (delta <> 0),
    reason text not null default '',
    actor_id uuid not null,
    idempotency_key text not null,
    quantity_after int not null,
    created_at timestamptz not null default now(),
    unique (stock_line_id, idempotency_key)
);

create table counts (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    site_id uuid not null references sites(id),
    name text not null,
    place_ids uuid[] not null default '{}',
    status text not null default 'open' check (status in ('open', 'closed')),
    started_at timestamptz not null default now(),
    started_by uuid not null,
    closed_at timestamptz,
    closed_by uuid
);

-- What the register expected when the count started.
create table count_expected (
    count_id uuid not null references counts(id) on delete cascade,
    asset_id uuid not null references assets(id),
    place_id uuid,
    primary key (count_id, asset_id)
);

create table count_scans (
    id uuid primary key default gen_random_uuid(),
    count_id uuid not null references counts(id) on delete cascade,
    code text not null,
    asset_id uuid references assets(id),
    place_id uuid,
    by_account uuid not null,
    at timestamptz not null default now(),
    result text not null check (result in ('found', 'wrong_place', 'unexpected', 'unknown', 'repeat'))
);
create index count_scans_count_idx on count_scans(count_id, at desc);

create table comments (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    target_type text not null check (target_type in ('asset', 'stock')),
    target_id uuid not null,
    author_id uuid not null,
    body text not null check (btrim(body) <> '' and length(body) <= 4000),
    created_at timestamptz not null default now()
);
create index comments_target_idx on comments(target_type, target_id, created_at);

-- Append-only: the application never updates or deletes rows here.
create table activity (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    at timestamptz not null default now(),
    actor_id uuid not null,
    kind text not null,
    target_type text,
    target_id uuid,
    target_label text,
    summary text not null,
    changes jsonb not null default '[]'::jsonb
);
create index activity_workspace_at_idx on activity(workspace_id, at desc);

create table saved_views (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    collection text not null check (collection in ('assets', 'stock')),
    name text not null,
    filters jsonb not null default '[]'::jsonb,
    sort jsonb,
    columns jsonb,
    created_by uuid not null,
    built_in boolean not null default false
);

-- Transactional outbox (see tagwise-shared::outbox; column names are
-- load-bearing).
create table domain_outbox (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null,
    idempotency_key text not null unique,
    aggregate_type text not null,
    aggregate_id uuid not null,
    event_type text not null,
    event_version int not null default 1,
    topic text not null,
    payload jsonb not null,
    occurred_at timestamptz not null,
    status text not null default 'pending' check (status in ('pending', 'processing', 'retry', 'published', 'dead')),
    attempts int not null default 0,
    available_at timestamptz not null default now(),
    locked_at timestamptz,
    locked_by text,
    last_error text,
    dead_lettered_at timestamptz,
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index domain_outbox_claim_idx on domain_outbox(status, available_at);
