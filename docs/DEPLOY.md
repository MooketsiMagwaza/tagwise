# Deploying Tagwise

Tagwise is a static single-page app. `npm run build` writes `dist/`, and any
static host can serve it. The repository is set up for **Vercel**.

Nothing has been deployed yet: deploying needs a Vercel login, which only the
owner can give. Everything else is ready.

## What is already in the repository

- `vercel.json`: framework `vite`, install `npm ci`, build `npm run build`,
  output `dist`, a rewrite that sends every path to `index.html` (so deep
  links such as `/app/assets/TW-00042` work on reload), and a few security
  headers. The camera is allowed for the site itself only
  (`Permissions-Policy: camera=(self)`).
- `.nvmrc`: Node 22, which CI uses too.
- `.github/workflows/ci.yml`: name gate, lint, type-check, unit tests and
  build on every pull request and every push to `main`.

## Environment variables

**None.** The prototype runs entirely in the browser with sample data and
makes no calls to an API of its own. (When the backend exists, its address
will be one variable, `VITE_API_BASE_URL`; it is not read by the code yet.)

## Option A: the Vercel dashboard (about five minutes)

1. Sign in at <https://vercel.com> with the GitHub account that owns the
   repository (`MooketsiMagwaza`).
2. Go to <https://vercel.com/new>.
3. Under **Import Git Repository**, find `tagwise`. It is private, so if it
   is not listed, click **Adjust GitHub App Permissions**, choose
   **Only select repositories**, add `tagwise`, save, and return to the
   import page.
4. Click **Import** next to `tagwise`.
5. On **Configure Project**, leave everything as Vercel fills it in from
   `vercel.json`:
   - Framework Preset: **Vite**
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm ci`
   - Environment Variables: none
6. Click **Deploy**. The first build takes one to two minutes.
7. Open the address Vercel shows (for example `tagwise-<something>.vercel.app`)
   and check:
   - the landing page loads, with its screenshots, in light and dark;
   - **Open the demo** opens the home page of the sample workspace;
   - reloading on `/app/assets/MCT-00040` still shows that asset (the
     rewrite works) rather than a 404;
   - on a phone, **Scan** asks for the camera and reads a printed label or a
     product barcode (this is the first real-device test of the camera; see
     TW-06 in `docs/WORK_ORDERS.md`);
   - **Sites** shows the map with six pins.

From then on, every merge to `main` deploys to production and every pull
request gets its own preview address.

### Keeping it private until you have reviewed it

A Vercel production address is public to anyone who has the link. If you
want a login in front of it, open the project's **Settings → Deployment
Protection** and turn on **Vercel Authentication**. Which deployments it
covers depends on your Vercel plan, so check the description on that page.
The site also sends `X-Robots-Tag: noindex` and has a `robots.txt` that
disallows crawling, so search engines are asked not to index it.

## Option B: the Vercel command line

```sh
npm install --global vercel
vercel login          # opens a browser; sign in as the owner
vercel link           # in the repository folder; create a new project called tagwise
vercel --prod         # builds on Vercel and deploys to production
```

## Checking a build locally first

```sh
npm ci
npm run build
npm run preview       # serves dist/ on http://localhost:5281
```

The camera only works on `localhost` or HTTPS, so test scanning on a phone
against the Vercel address, not a LAN IP.
