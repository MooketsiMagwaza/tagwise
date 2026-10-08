# Provenance

Where Tagwise's code came from. Everything here is owned by Mooketsi Vincent
Magwaza. Tagwise started with a fresh git history on 7 October 2026; no
history was carried over from any other repository.

## Started from StockLink (owner-owned)

StockLink is the owner's private product (Rust services and a React web app).
Only parts of its **web** app were copied, from `web/src` on the `master`
branch as of 7 October 2026, and then changed. Nothing was copied from its
backend, desktop app, documentation site, marketing site or docs.

| Tagwise path | Copied from StockLink `web/src/…` | What changed |
| --- | --- | --- |
| `src/ui/*` (Avatar, Banner, Barcode, Button, Callout, Card, Clickable, CommandPalette, ConfirmDialog, Divider, EmptyState, Field, IconBadge, InfoTip, Layout, List, Modal, Page, Pill, Popover, PrintPortal, QrCode, RadioList, Segmented, Skeleton, Sparkline, Steps, Switch, Table, Text, Toast, VisuallyHidden) | `ui/*` | Restyled for Tagwise (new tokens, translucent cards, ink primary action, display face on titles). Button gained `sm`, `ghost` and `ButtonLink`; Pill gained a dot and a brand tone; Avatar gained a colour and a presence ring; Text gained `mono`. Components that Tagwise does not use were left out. |
| `src/theme/appearance.ts`, `src/theme/base.css`, `src/theme/index.ts` | `theme/appearance.ts`, `theme/base.css`, `theme/index.ts` | Accent choices replaced by table density; storage key renamed; the canvas wash added to `base.css`. |
| `src/lib/router.tsx` | `lib/router.ts` | Event renamed, support-page tracking removed, `Link` and `isActive` added. |
| `src/lib/toast.tsx` | `lib/toast.tsx` | Unchanged apart from imports. |
| `src/app/scan/Scanner.tsx` | `ui/Scanner/Scanner.tsx` | Kept: camera start-up, BarcodeDetector use, manual entry. Replaced the jsQR fallback with ZXing (so 1D barcodes work without BarcodeDetector), and added continuous scanning with a repeat guard, a torch toggle, a secure-context check and a note saying which decoder is in use. |
| `eslint.config.js`, `tsconfig.json`, `vite.config.ts`, `index.html` | `web/` root files of the same names | Rewritten for Tagwise; the shape (strict TypeScript, "no inline styles in screens" lint rule, pre-paint theme script) is kept. |

Later pull requests that copy more StockLink code add a row here in the same
commit.

## New in Tagwise

Everything not listed above, including:

- the Tagwise design tokens (`src/theme/tokens.css`), logo and favicon;
- the name gate (`scripts/name-gate.mjs`), CI workflow and Vercel config;
- all documentation under `docs/`.

## Design inspiration (not copied)

The "soft glass" direction and the "fewer things per screen" rule come from
the owner's design principles for another of his products. Tagwise has its
own palette (slate, ink and tag amber), its own display face (Schibsted
Grotesk) and its own layout. No token values or components were copied from
that product.

## Third-party packages

Listed with their licences in the README. None of their source is vendored
into this repository; they are installed from npm.
