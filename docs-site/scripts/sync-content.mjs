#!/usr/bin/env node
/**
 * Builds `content/docs/**` from two sources of truth:
 *
 *  1. `manifest.mjs` — an explicit list of `docs/**` Markdown files this site
 *     publishes, each with its own site section/slug/title/order. Nothing
 *     under `docs/` is published unless it is named in the manifest, so an
 *     agent handoff, work order, or integration manifest dropped into
 *     `docs/` does NOT appear on the site just by existing.
 *  2. `docs/reference/openapi.json` (a committed snapshot of the backend's
 *     OpenAPI document) via `generate-api-reference.mjs`, which builds the
 *     whole "API reference" section.
 *
 * Run automatically before `dev` / `build` (see package.json `predev`/
 * `prebuild`), or on demand with `pnpm sync`.
 *
 * Each source `.md` becomes `.mdx` with a `title` (the manifest entry's
 * title, else the first `# heading`, else the file name) and `description`
 * (first paragraph) in frontmatter; the leading H1 is dropped (Fumadocs
 * renders the frontmatter title). Prose outside code fences is escaped so
 * arbitrary Markdown (`<addr>`, `{channel}`) is valid MDX. `meta.json` files
 * are generated from the manifest's page order.
 *
 * NOT published, deliberately: docs/WORK_ORDERS.md (the work-order register)
 * and CLAUDE.md. They are working records, not product documentation, and
 * stay in the repository.
 *
 * Links between published files are rewritten to their site addresses; links
 * to other repository files go to GitHub. Images under public/screens/ are
 * served from the site's own copy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tokensCss } from './theme-tokens.mjs';
import { ROOT_INDEX, SECTIONS, GITHUB_BLOB } from './manifest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const outRoot = path.resolve(here, '../content/docs');

// Mirror the app's screenshots (public/screens/<name>-light.jpg and
// <name>-dark.jpg, plus the WebP copies the README links to) into this
// site, with a manifest of each JPEG or PNG pair's size so pages can
// reserve space for them.
{
  const from = path.join(repoRoot, 'public/screens');
  const to = path.resolve(here, '../public/screens');
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  const shots = [];
  if (fs.existsSync(from)) {
    for (const f of fs.readdirSync(from).sort()) {
      if (!/\.(jpe?g|png|webp)$/.test(f)) continue;
      fs.copyFileSync(path.join(from, f), path.join(to, f));
      const m = f.match(/^(.*)-light\.(jpe?g|png)$/);
      if (!m) continue;
      const dark = f.replace('-light.', '-dark.');
      if (!fs.existsSync(path.join(from, dark))) continue;
      const { width, height } = imageSize(path.join(from, f));
      shots.push({ name: m[1], light: f, dark, width, height });
    }
  }
  fs.writeFileSync(path.join(to, 'manifest.json'), JSON.stringify({ screens: shots }, null, 2) + '\n');
}

/** Width and height of a JPEG (from its SOF marker) or PNG (from IHDR). */
function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error(`${file}: not a JPEG this script can read`);
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error(`${file}: no image size found`);
}

// The site's look is the app's own theme: src/theme/tokens.css becomes the
// stylesheet app/global.css imports, so the docs can never drift from the app.
fs.writeFileSync(path.resolve(here, '../app/theme-tokens.css'), tokensCss());

function escapeMdxProse(markdown) {
  const lines = markdown.split('\n');
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      // Keep leading blockquote markers (`> `, `> > `) as Markdown syntax;
      // escaping them turned every callout into a literal "&gt;" paragraph.
      const quote = line.match(/^\s*(?:>\s?)+/)?.[0] ?? '';
      // Protect inline code spans, then escape the rest.
      const parts = line.slice(quote.length).split(/(`[^`]*`)/);
      return quote + parts
        .map((part, i) =>
          i % 2 === 1
            ? part
            : part
                // A Markdown autolink (<http://…>) is a link, not text in angle brackets.
                .replace(/<(https?:\/\/[^>\s]+)>/g, '[$1]($1)')
                .replace(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\{/g, '&#123;')
                .replace(/\}/g, '&#125;'),
        )
        .join('');
    })
    .join('\n');
}

function toFrontmatterDoc(raw, fallbackTitle, titleOverride, srcPath) {
  const lines = raw.split('\n');
  let title = fallbackTitle;
  let start = 0;
  const h1 = lines.findIndex((l) => /^#\s+/.test(l));
  if (h1 !== -1 && lines.slice(0, h1).every((l) => l.trim() === '')) {
    if (!titleOverride) title = lines[h1].replace(/^#\s+/, '').trim();
    start = h1 + 1;
  }
  if (titleOverride) title = titleOverride;
  // Relative links are written for the repository (README.md links to
  // docs/DEPLOY.md, an image to public/screens/x.jpg). On the site they are
  // rewritten: a published file goes to its page, a screenshot to the site's
  // copy, anything else to the file on GitHub. Next's MDX loader would
  // otherwise try to import a relative image and fail the build.
  const body = rewriteLinks(lines.slice(start).join('\n'), srcPath).trim();
  const firstPara =
    body
      .split('\n\n')
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .find((p) => p && !p.startsWith('|') && !p.startsWith('#') && !p.startsWith('```')) ?? '';
  const description = firstPara.slice(0, 180).replace(/"/g, "'");
  const fm = ['---', `title: "${title.replace(/"/g, "'")}"`];
  // No `description`: Fumadocs renders it under the title, and it is the page's own
  // first paragraph, so every page showed that paragraph twice.
  void description;
  fm.push('---', '');
  return fm.join('\n') + escapeMdxProse(body) + '\n';
}

/** Repository path of each published file -> its address on this site. */
const sitePathOf = new Map([[ROOT_INDEX.src, '/docs']]);
for (const section of SECTIONS) {
  for (const page of section.pages) {
    sitePathOf.set(page.src, page.slug === 'index' ? `/docs/${section.slug}` : `/docs/${section.slug}/${page.slug}`);
  }
}

function rewriteLinks(markdown, srcPath) {
  const fromDir = path.posix.dirname(srcPath);
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      if (inFence) return line;
      return line.replace(/(!?)\]\(([^)\s]+)\)/g, (whole, bang, target) => {
        if (/^([a-z]+:|#|\/)/i.test(target)) return whole;
        const [file, hash = ''] = target.split('#');
        const repoPath = path.posix.normalize(path.posix.join(fromDir, file));
        const anchor = hash ? `#${hash}` : '';
        if (repoPath.startsWith('public/screens/')) return `${bang}](/screens/${repoPath.slice('public/screens/'.length)})`;
        if (sitePathOf.has(repoPath)) return `${bang}](${sitePathOf.get(repoPath)}${anchor})`;
        return `${bang}](${GITHUB_BLOB}/${repoPath}${anchor})`;
      });
    })
    .join('\n');
}

function humanize(name) {
  return name
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\.(md|mdx)$/, '')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Copies one manifest page entry into `outDir/<slug>.mdx`. Returns the slug
 * actually written, or `null` if an optional source is missing. */
function writePage(page, outDir) {
  const srcPath = path.join(repoRoot, page.src);
  if (!fs.existsSync(srcPath)) {
    if (page.optional) {
      console.log(`  (skip, not yet present) ${page.src}`);
      return null;
    }
    throw new Error(
      `manifest.mjs references ${page.src}, which does not exist. Add it, remove the ` +
        `manifest entry, or mark it optional: true if another workstream owns it.`,
    );
  }
  const raw = fs.readFileSync(srcPath, 'utf8');
  const doc = toFrontmatterDoc(raw, humanize(path.basename(page.src)), page.title, page.src);
  fs.writeFileSync(path.join(outDir, `${page.slug}.mdx`), doc);
  return page.slug;
}

/** Generates a simple linking index page when a section has no explicit
 * `index` page among its manifest entries. */
function writeGeneratedIndex(outDir, title, pageSlugsInOrder) {
  const indexPath = path.join(outDir, 'index.mdx');
  if (fs.existsSync(indexPath)) return; // an explicit index page was already written
  const links = pageSlugsInOrder
    .filter((slug) => slug !== 'index')
    .map((slug) => `- [${humanize(slug)}](${slug})`)
    .join('\n');
  fs.writeFileSync(
    indexPath,
    `---\ntitle: "${title}"\ndescription: "Section index."\n---\n\n${links}\n`,
  );
}

function writeSection(section, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`section: ${section.slug}`);
  const written = [];
  for (const page of section.pages) {
    const slug = writePage(page, outDir);
    if (slug) written.push(slug);
  }
  writeGeneratedIndex(outDir, section.title, written);
  const orderedPages = written.includes('index')
    ? ['index', ...written.filter((s) => s !== 'index')]
    : written;

  const subsectionSlugs = [];
  for (const sub of section.subsections ?? []) {
    writeSection(sub, path.join(outDir, sub.slug));
    subsectionSlugs.push(sub.slug);
  }

  fs.writeFileSync(
    path.join(outDir, 'meta.json'),
    JSON.stringify({ title: section.title, pages: [...orderedPages, ...subsectionSlugs] }, null, 2) + '\n',
  );
}

// ── reset and rebuild content/docs from the manifest ───────────────────────
fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });

const rootIndexPath = path.join(repoRoot, ROOT_INDEX.src);
if (!fs.existsSync(rootIndexPath)) {
  throw new Error(`manifest.mjs ROOT_INDEX references ${ROOT_INDEX.src}, which does not exist.`);
}
fs.writeFileSync(
  path.join(outRoot, 'index.mdx'),
  toFrontmatterDoc(fs.readFileSync(rootIndexPath, 'utf8'), 'Start here', ROOT_INDEX.title, ROOT_INDEX.src),
);

for (const section of SECTIONS) {
  writeSection(section, path.join(outRoot, section.slug));
}

// The API reference section is generated separately from the OpenAPI
// snapshot, not from manifest.mjs.
const generateApiReference = path.join(here, 'generate-api-reference.mjs');
execFileSync(process.execPath, [generateApiReference], { stdio: 'inherit', cwd: here });

// Root nav order. 'reference' (the API reference, generated above from the
// OpenAPI snapshot rather than from a manifest section) is inserted right
// after 'architecture' to match the target hierarchy; every other slug comes
// from SECTIONS in manifest.mjs, in the order declared there.
const afterArchitecture = ['reference'];
const rootPages = ['index'];
for (const section of SECTIONS) {
  rootPages.push(section.slug);
  if (section.slug === 'architecture') rootPages.push(...afterArchitecture);
}
fs.writeFileSync(path.join(outRoot, 'meta.json'), JSON.stringify({ pages: rootPages }, null, 2) + '\n');

console.log(`synced docs -> ${path.relative(process.cwd(), outRoot)}`);
