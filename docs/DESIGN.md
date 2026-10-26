# Design

Tagwise has two looks, kept apart on purpose:

- **The app** (`/app/...`) is a tool people read tables in all day. It looks
  like Apple's own software: **flat, plain, nothing decorative**.
- **The public page** (`/`) is a product page in a flat, banded style:
  white and light-grey bands, near-black text, one blue primary action and
  small-radius tiles, in the manner of large software makers' product
  pages. It takes the manner only: no borrowed text, logos, icons, images or
  trademarks, and no implied connection to anyone.

Neither has a gradient anywhere.

## The app

### Identity

- **Background:** the grouped background, flat: `#f2f2f7` by day, black at
  night. No washes, glows or tints.
- **Surfaces:** opaque cards and inset grouped lists (white by day,
  `#1c1c1e` at night) with a hairline edge and hairline separators between
  rows. No glass on cards and no inner highlights.
- **Materials:** translucency with a plain blur only where Apple uses a
  material: the top bar, the phone tab bar, sheets, popovers, the command
  palette, toasts, the floating bulk-action bar, notes over the map and the
  floating theme button. Shadows only lift those floating things.
- **Sidebar:** a plain column flush to the left edge, divided from the
  content by a hairline; icons in the accent colour; the current page is a
  tinted row.
- **Shape:** cards and grouped lists 14 px, controls 12 px, sheets 24 px,
  pill buttons and pill segmented controls.
- **Controls:** a choice between a few options, or between sections of a
  page, is a segmented control (`Segmented`, `SegmentedLinks`), never
  underline tabs. Dialogs are sheets: a bottom sheet with a grabber on
  phones, a centred form sheet on wider screens. On phones the main places
  are a floating tab bar; the current tab takes the accent colour.
- **Buttons:** the one primary action is filled with the accent; every other
  button is flat and tinted (accent text on an accent tint); plain buttons
  are just the accent-coloured label. No shadows on buttons.
- **Accent:** one blue for actions, links, selection and focus: `#005fbf` by
  day (`#0071e3` filled and `#4da3ff` as text at night).
- **Theme switch:** a small round button floating in a bottom corner, never
  in a navigation bar: bottom right on wide screens, bottom left just above
  the tab bar on phones. It steps aside while a text field has focus.
  Settings and the command palette also offer the theme.
- **Brand spot:** tag amber (`#f2a516`) only in the logo, on printed labels
  and in the scan frame's corner brackets (drawn with borders).
- **Type:** the system face on Apple devices (`-apple-system`,
  `BlinkMacSystemFont`, SF Pro Text and SF Pro Display come first in the
  stack), the bundled Schibsted Grotesk (self-hosted, OFL) on every other
  system; the wordmark is always Schibsted Grotesk. Screen titles are large
  titles (32 px, bold). Icons are drawn at a 1.75 px stroke, close to SF
  Symbols' regular weight. Monospace for tags, SKUs and barcodes; tabular
  figures in tables.
- **Labels and codes** are always black on white, in every theme, so they scan.

### Rules

1. Fewer things per screen: one question and one primary action. Notices are
   one line. Numbers live inside tables and sentences, not in hero tiles.
2. No gradients, glows or decorative tints anywhere (`grep -rniE
   "(linear|radial|conic)-gradient" src` finds none).
3. Status never relies on colour alone: every pill has a word. Status tones
   (green, orange, red) are semantic, not accents.
4. Contrast meets WCAG AA; the figures are in the header of
   `src/theme/tokens.css`.
5. Motion is short (150 to 220 ms), explains a change, and switches off for
   reduced motion (system setting or Settings → Appearance). Reduced
   transparency gets solid materials.
6. Every control is reachable by keyboard with a visible focus ring; icon-only
   buttons must have a label (the type system enforces it); there is a skip
   link to the content.
7. Screens do not style inline (lint rule). Looks live in `src/theme`,
   `src/ui` and `src/app`.

## The public page

- **Palette:** its own `--mk-*` tokens in `src/theme/tokens.css`. Light by
  default, whatever the system setting; dark only when the visitor chooses
  it with the floating button. Primary action blue `#1d5bb8` (white text,
  6.48:1); in dark, light blue `#8cb8ff` with dark text (9.48:1). Every pair
  is computed, not estimated; the figures are in the tokens file header.
- **Shape:** 4 px controls, 8 px tiles and screenshot frames, hairline
  edges and soft shadows. Flat colour blocks only: no gradient washes. No
  glass except the sticky section nav.
- **Type:** the platform's own face (Segoe UI on Windows, SF Pro on Apple
  devices), Schibsted Grotesk elsewhere; large semibold headings.
- **Structure:** a slim top bar (a menu on phones), a split hero with a real
  capture, a sticky section nav, equal feature tiles with a line icon each,
  alternating rows of text and a large capture, the engineering behind it
  with an SVG diagram, use-case tiles, a FAQ, a closing call to action and a
  footer with link columns.
- **Honesty:** no customer logos, testimonials, invented numbers, pricing or
  "trusted by". Every claim is something the README or the work-order
  register supports. The demo's state is said once, calmly, in "Under the
  hood" with a "Demo data" chip, not as a banner.
- **Pictures:** real captures of the sample workspace from `public/screens`,
  WebP with width and height set, lazy below the fold.

## Where it lives

| What | Where |
| --- | --- |
| Tokens (colour, type, space, radius, shadow, motion; the app's and the page's) | `src/theme/tokens.css` |
| Theme, density and motion preferences | `src/theme/appearance.ts` |
| Component library | `src/ui` |
| App pieces (shell, register, labels, scanner, map, theme button) | `src/app` |
| The public page and its diagram | `src/screens/Landing.tsx`, `src/app/marketing` |
| Real screenshots, light and dark (WebP and JPEG) | `public/screens`, made by `npm run screenshots` |
