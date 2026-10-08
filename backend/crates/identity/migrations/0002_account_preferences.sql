-- Per-account preferences (theme, accent, chart choices, notification
-- settings, onboarding progress…). A single jsonb object so the web app can
-- add a preference without a migration; the API validates that it stays a
-- small object. Merged shallowly on update (top-level keys replace).
alter table accounts
    add column preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object');

create index sessions_account_active_idx on sessions(account_id) where revoked_at is null;
