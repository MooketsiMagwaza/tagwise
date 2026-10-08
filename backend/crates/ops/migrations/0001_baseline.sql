-- Ops service baseline schema: support tickets. Accounts are opaque UUIDs
-- (identity owns the `accounts` table in its own database) — see commerce's
-- migration file for why no foreign key crosses a service boundary.

create extension if not exists pgcrypto;

-- A request for help. `kind` says what sort; `status` where it is:
--   open         raised, nobody has looked
--   in_progress  staff are working on it
--   waiting      staff replied and are waiting on the requester
--   resolved     staff say it is done; the requester can reopen it by replying
--   closed       final
create table tickets (
    id uuid primary key default gen_random_uuid(),
    requester_account_id uuid not null,
    kind text not null check (kind in ('bug', 'question', 'report', 'request')),
    subject text not null,
    body text not null,
    status text not null default 'open'
        check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
    priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
    assignee_account_id uuid,
    -- Where the requester was and what they were using (page, browser); an
    -- object the client attaches to a bug report.
    context jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    resolved_at timestamptz
);
create index tickets_requester_idx on tickets (requester_account_id, updated_at desc);
create index tickets_queue_idx on tickets (status, priority, updated_at desc);
create index tickets_assignee_idx on tickets (assignee_account_id) where assignee_account_id is not null;

-- The conversation. An `internal` message is a staff note the requester never sees.
create table ticket_messages (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null references tickets (id) on delete cascade,
    author_account_id uuid not null,
    author_kind text not null check (author_kind in ('requester', 'staff')),
    body text not null,
    internal boolean not null default false,
    created_at timestamptz not null default now(),
    check (not internal or author_kind = 'staff')
);
create index ticket_messages_ticket_idx on ticket_messages (ticket_id, created_at);

-- Who did what to a ticket, and when. Staff actions are privileged, so each
-- one leaves a row here; nothing updates or deletes these rows.
create table ticket_events (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null references tickets (id) on delete cascade,
    actor_account_id uuid not null,
    kind text not null,
    detail text not null default '',
    created_at timestamptz not null default now()
);
create index ticket_events_ticket_idx on ticket_events (ticket_id, created_at);
