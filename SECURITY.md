# Security

## Reporting a problem

The repository is private. If you have access and find a security problem,
do not open an issue or a pull request about it. Report it to the owner,
Mooketsi Vincent Magwaza, directly through GitHub, with what you found and
how to reproduce it. You will get an answer, and the fix will be credited if
you want it to be.

## What there is to protect today

| Part | State | What that means |
| --- | --- | --- |
| Web app (deployed) | Browser only | No server, no accounts, no real data. Everything lives in the visitor's own browser storage and is never sent anywhere. Roles are enforced in the interface only, which is no protection; it does not need to be while each browser holds only its own sample data |
| Backend (`backend/`) | Tested in CI, never deployed | The protections below are in the code. Unit tests cover them, and the register's data rules are tested against PostgreSQL; none has been exercised against a running system or tested by anyone else |

## Protections in the backend code

Authentication and sessions (identity, and the shared crate in every
service):

- Sign-in is by one-time code sent by email or SMS. Codes are stored only
  as Argon2 hashes and expire after 5 minutes. API keys are stored hashed.
- Access tokens are JWTs that last 15 minutes by default, verified in
  every service. A signed-out
  token goes on a Redis denylist that every service checks, so logout takes
  effect everywhere at once.
- Echoing the one-time code in the response, for local development only
  (`OTP_DEV_ECHO_ENABLED`), is refused at start-up in staging and production,
  and the compose guard checks for it.

Authorisation (register):

- Every request inside a workspace checks the caller's membership and role
  on the server, using the same role table as the web app.
- A workspace the caller does not belong to answers 404, so workspace and
  item ids cannot be probed.

Every service (`backend/crates/shared`):

- Rate limiting, Redis-backed and shared across services (120 requests a
  minute per client by default).
- Security headers on every response: `Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  no-referrer`, `X-Permitted-Cross-Domain-Policies: none`.
- CORS allows exact origins only; a wildcard is refused at start-up.
- Request bodies are capped at 15 MB and requests time out after 30 seconds.
- `Authorization` and `Cookie` headers are marked sensitive so they never
  reach the logs.
- `/internal/*` routes are never routed by the gateway and require a shared
  `X-Internal-Token`; `/metrics` is not routed by the gateway either.
- Database access is through parameterised queries (sqlx); there is no
  string-built SQL.

Data integrity (register): stock cannot go below zero (a check constraint
and a conditional update), adjustments are idempotent, and asset edits are
version-checked so one person cannot silently overwrite another.

## Secrets

- No secret is committed. `.env` files are ignored by git; the compose file
  uses development-only values that are named as such.
- Staging and production would take secrets from files mounted at run time;
  those compose files do not exist yet.

## Known gaps

- The backend has never run as a whole, and has had no penetration test or
  outside review.
- No staging or production configuration exists, so TLS, secret rotation and
  backups are not set up.
- Dependency updates are proposed by Dependabot; there is no automated
  vulnerability audit in CI yet.
