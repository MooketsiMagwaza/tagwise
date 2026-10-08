# Design

Tagwise is a tool people read tables in all day, so the look is quiet and
legible first: **quiet glass for tables**.

## Identity

- **Canvas:** cool slate-white (`#f3f5f7`), with two faint washes, amber at the
  top left and slate blue at the bottom right. Dark mode is its own palette
  (deep blue-black with the same washes in low light), not an inversion.
- **Surfaces:** translucent white cards with a white inner edge and a soft
  slate shadow. Blur only on things that float over content (top bar, phone
  tab bar, drawer, dialogs, sticky table headers).
- **Action:** the one primary action on a screen is ink (`#141a21`; light ink
  on dark). Blue (`#1d5bb8`) is for links, selection and focus.
- **Brand spot:** tag amber (`#f2a516`), used sparingly: the logo, the active
  tab underline, the scan frame, the edge of a printed label, stock-take
  progress.
- **Type:** Schibsted Grotesk (self-hosted, OFL) for titles; the system face
  for everything you read; monospace for tags, SKUs and barcodes; tabular
  figures in tables.
- **Labels and codes** are always black on white, in every theme, so they scan.

## Rules

1. Fewer things per screen: one question and one primary action. Notices are
   one line. Numbers live inside tables and sentences, not in hero tiles.
2. Each landing-page section picks its own layout; no repeated three-card
   grids, no stat banners, no gradients on buttons, text or icons. The only
   gradients are the canvas washes (and the scan frame's corner marks, which
   are drawn with solid-colour gradient strips).
3. Status never relies on colour alone: every pill has a word.
4. Contrast meets WCAG AA on the composited translucent surfaces; the figures
   are in the header of `src/theme/tokens.css`.
5. Motion is short (150 to 220 ms), explains a change, and switches off for
   reduced motion (system setting or Settings → Appearance). Reduced
   transparency gets solid surfaces.
6. Every control is reachable by keyboard with a visible focus ring; icon-only
   buttons must have a label (the type system enforces it); there is a skip
   link to the content.
7. Screens do not style inline (lint rule). Looks live in `src/theme`,
   `src/ui` and `src/app`.

## Where it lives

| What | Where |
| --- | --- |
| Tokens (colour, type, space, radius, shadow, motion) | `src/theme/tokens.css` |
| Theme, density and motion preferences | `src/theme/appearance.ts` |
| Component library | `src/ui` |
| App pieces (shell, register, labels, scanner, map) | `src/app` |
| Real screenshots, light and dark | `public/screens`, made by `npm run screenshots` |
