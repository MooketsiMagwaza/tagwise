# 0004: Version numbers for edits, conditional updates for stock

**State:** Accepted, October 2026.

## Context

Several people edit the same register at once, and stock-takes are run by
several people together. Two failures matter: one person silently
overwriting another's edit, and stock going below zero when two people
issue the last item at the same moment. Phones on poor connections retry
requests.

## Decision

- Assets carry a version number. An edit says which version it was based
  on; if the asset has moved on, the edit is refused with 409 and the
  current asset, and the person chooses. The web app already behaves this
  way between tabs.
- Stock changes are deltas applied with one conditional update
  (`quantity + delta >= 0`), backed by a check constraint, not read, check,
  then write.
- Every stock adjustment carries an `Idempotency-Key`; a repeated key
  changes nothing a second time.

## Costs

- Clients must keep and send versions and make idempotency keys.
- A conflict needs a screen to resolve it, which the app has.
- The concurrency tests need PostgreSQL and have not been run yet
  (`backend/crates/register/tests/register_db.rs`).
