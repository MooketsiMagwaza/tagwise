# 0003: One database per service, one shared Redis

**State:** Accepted, October 2026.

## Context

Five services each own part of the data. They must be deployable and
migratable on their own, but sign-out and rate limits must hold across all
of them at once.

## Decision

Each service owns one PostgreSQL database and its own migrations, and
refuses to start while one is pending. In development the five databases
share one PostgreSQL instance. Services never read each other's tables;
they call `/internal/*` routes instead. One Redis is shared for the
signed-out token denylist and the rate limiter, and JWTs are verified
locally in each service with a shared secret.

## Costs

- No joins or transactions across services; a change that spans two of
  them needs an internal call or, later, the outbox.
- Redis is a single point every service depends on; if it is down, sign-out
  and rate limiting stop working, so readiness checks report it.
- The shared JWT secret must be rotated in every service at once.
