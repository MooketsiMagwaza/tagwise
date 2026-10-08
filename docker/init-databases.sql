-- Runs once, only on first container start (postgres only executes
-- docker-entrypoint-initdb.d/* against a brand-new data directory) — creates
-- one database per service. Each service's own `<service> migrate` then
-- creates that database's tables; this file only makes the databases exist.
CREATE DATABASE tagwise_identity;
CREATE DATABASE tagwise_register;
CREATE DATABASE tagwise_notifications;
CREATE DATABASE tagwise_media;
CREATE DATABASE tagwise_ops;
