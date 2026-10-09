-- Admin console: suspending an account, and API keys.

-- When and why an account was suspended. `status` already allows 'suspended';
-- these say who did it and for what, for the person reading the account later.
alter table accounts
    add column suspended_at timestamptz,
    add column suspended_reason text;

-- An API key lets a program act as an account without a person typing a code.
-- The key itself is shown once, when it is made, and never stored: only its
-- SHA-256 is. `prefix` (the first characters) is what identifies it in a list.
-- Keys are high-entropy random values, so a fast hash is the right one here
-- (unlike a password, there is nothing to guess).
create table api_keys (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references accounts (id) on delete cascade,
    name text not null,
    prefix text not null,
    key_hash text not null unique,
    created_by uuid not null,
    created_at timestamptz not null default now(),
    expires_at timestamptz,
    last_used_at timestamptz,
    revoked_at timestamptz
);
create index api_keys_account_idx on api_keys (account_id);
