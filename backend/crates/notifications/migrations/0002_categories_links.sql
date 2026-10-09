-- Notifications gain a category (so a person's preferences can mute a kind of
-- notification) and an optional deep link (where clicking it should go).
alter table notifications
    add column category text not null default 'system'
    check (category in ('orders', 'payments', 'deliveries', 'support', 'system'));
alter table notifications add column link text;

create index notifications_unread_idx on notifications(account_id, created_at desc) where read_at is null;
