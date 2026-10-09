# 0001: Build the app browser-first, behind a data interface

**State:** Accepted, October 2026.

## Context

The product had to be usable and shown before there was a server: the
register, scanning, labels, imports and stock-takes needed to be tried by
people, and the owner wanted to see them working. Building the server first
would have delayed every screen.

## Decision

Every screen reads and writes through one interface,
`src/data/repository.ts`. The first implementation, `LocalRepository`, keeps
a seeded sample workspace in the browser's storage and shares changes
between tabs with BroadcastChannel. A second implementation that calls the
API (`HttpRepository`) replaces it without changing the screens.

## Costs

- Nothing is shared between devices until the API implementation is wired
  in; the app says so.
- Roles are enforced only in the interface until then.
- The interface has to stay narrow enough that both implementations can
  honour it, including the version conflict on edits.
