# 0002: Reuse the owner's earlier platform for the backend

**State:** Accepted, October 2026.

## Context

The owner had already built a Rust platform for another product: accounts
and sign-in, notifications, uploads, a staff console, a gateway, compose
files and an observability stack, with its unit tests passing. Tagwise needs
the same foundations. The owner asked for the whole foundation to be brought
in, including the parts that are scaffolds.

## Decision

Copy the platform crates (shared, identity, notifications, media, ops), the
Docker and gateway set-up, the observability stack and the docs site, rename
them, and remove what belongs to the other product (its onboarding, orders,
payments and delivery). Write the domain service, register, new for Tagwise
on the earlier service's scaffolding. Record every copied part in
`PROVENANCE.md`.

## Costs

- More code than Tagwise uses today; the unused parts are listed as
  scaffold in `ARCHITECTURE.md` so nobody mistakes them for working features.
- Fixes in one product do not reach the other automatically.
- The name gate has to keep the other product's name out of tracked files.
