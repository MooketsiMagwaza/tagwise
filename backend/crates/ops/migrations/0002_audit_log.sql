-- Ops audit log: every privileged action taken through the admin console's
-- operational tools — looking at a database table, ending a database
-- connection — leaves a row here. Nothing updates or deletes these rows.
--
-- (Account, session and API-key actions are logged by identity, which owns
-- them; ticket actions are in each ticket's own trail.)

create table audit_log (
    id uuid primary key default gen_random_uuid(),
    actor_account_id uuid not null,
    action text not null,
    -- What it was done to: `tagwise_identity.accounts`, `pid 4821`.
    target text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create index audit_log_created_idx on audit_log (created_at desc);
create index audit_log_actor_idx on audit_log (actor_account_id);
