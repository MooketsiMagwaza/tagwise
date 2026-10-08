# Tagwise: notes for coding sessions

Tagwise is a shared register for an organisation's assets and stock: QR
labels, browser scanning, Excel and CSV import, stock-takes run together,
and sites on a map. Today it is a browser-only prototype (React 18,
TypeScript, Vite) with a seeded, invented sample workspace behind a data
interface (`src/data/repository.ts`); the Rust API comes later. Owner:
Mooketsi Vincent Magwaza. All rights reserved; there is no licence file.

## Commands

```sh
npm ci                 # install
npm run dev            # http://localhost:5280
npm run lint           # ESLint
npm run typecheck      # TypeScript
npm test               # Vitest
npm run build          # type-check and build dist/
npm run check:names    # name gate
npm run screenshots    # real captures; needs npm run dev running
```

Run lint, typecheck, test, build and the name gate before opening a pull
request. CI runs the same on every pull request and push to `main`.

## Git

- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `test:`), small, one topic each.
- One branch per piece of work (`feat/...`, `fix/...`, `chore/...`,
  `docs/...`). `main` holds merged work only; never rewrite its history.
- Open a pull request with a real description (what changed, what was run,
  what was not checked) and merge it with a merge commit
  (`gh pr merge --merge`), not a squash.
- **No attribution trailers anywhere**: no `Co-Authored-By`, no
  "Generated with" lines, in commits or pull requests.
- Check `git status` before every commit. Never commit secrets, tokens,
  personal data or build output.

## Honesty

- Never claim something works unless it was run, in the README, the
  interface, commit messages or pull requests. Say what was not checked.
- Sample data is labelled as sample on screen and in docs. Simulated
  teammates must always say they are simulated.

## Work orders

Keep `docs/WORK_ORDERS.md` current in the same commit as the change, with
honest states (Not started, In progress, Done with evidence, Blocked with
what it waits for). Every new instruction from the owner gets an entry.

## Boundaries

- The repository is private. The owner decides when it goes public.
- Never read or commit `.env` files.
- The name gate (`npm run check:names`) fails if another of the owner's
  product names appears in tracked files; `PROVENANCE.md` and the
  work-order register are exempt. Record any code copied from the owner's
  other projects in `PROVENANCE.md`.
- Design rules live in `docs/DESIGN.md` and `src/theme/tokens.css`.
