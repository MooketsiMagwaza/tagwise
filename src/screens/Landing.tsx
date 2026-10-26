// The public page at /. A product page in a flat, banded style: a slim top
// bar, a split hero with a real screenshot, a sticky section nav, feature
// tiles, alternating feature rows, the engineering behind it, use cases, a
// FAQ and a footer. Every claim is backed by the repository's records
// (README, docs/WORK_ORDERS.md); every picture is a real capture of the
// sample workspace from public/screens.

import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  History,
  Map as MapIcon,
  Menu,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Store,
  X,
} from 'lucide-react';
import { Link } from '../lib/router';
import { Logo } from '../app/bits';
import { ThemeToggle } from '../app/ThemeToggle';
import { ArchitectureDiagram } from '../app/marketing/ArchitectureDiagram';
import { setLightUnlessChosen, useIsDark } from '../theme';
import styles from './Landing.module.css';

const REPO = 'https://github.com/MooketsiMagwaza/tagwise';

const SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'scan', label: 'Scan' },
  { id: 'import', label: 'Import' },
  { id: 'stock-takes', label: 'Stock-takes' },
  { id: 'sites', label: 'Sites' },
  { id: 'under-the-hood', label: 'Under the hood' },
  { id: 'faq', label: 'FAQ' },
];

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 780, height: 1688 };

/** A real capture of the app in the visitor's theme (WebP, sized). */
function useShot(name: string) {
  const dark = useIsDark();
  return `/screens/${name}-${dark ? 'dark' : 'light'}.webp`;
}

function Window({ name, alt, eager = false, phoneName }: { name: string; alt: string; eager?: boolean; phoneName?: string }) {
  const src = useShot(name);
  const phoneSrc = useShot(phoneName ?? name);
  return (
    <div className={phoneName ? `${styles.window} ${styles.adapt}` : styles.window}>
      <div className={styles.windowBar} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <picture>
        {phoneName && <source media="(max-width: 600px)" srcSet={phoneSrc} width={PHONE.width} height={PHONE.height} />}
        <img src={src} alt={alt} width={DESKTOP.width} height={DESKTOP.height} loading={eager ? 'eager' : 'lazy'} decoding="async" />
      </picture>
    </div>
  );
}

function Phone({ name, alt }: { name: string; alt: string }) {
  const src = useShot(name);
  return (
    <div className={styles.phone}>
      <img src={src} alt={alt} width={PHONE.width} height={PHONE.height} loading="lazy" decoding="async" />
    </div>
  );
}

function More({ href, children, about }: { href: string; children: ReactNode; about?: string }) {
  const inner = (
    <>
      {children}
      {about && <span className={styles.vh}> {about}</span>}
      <ChevronRight size={16} aria-hidden="true" />
    </>
  );
  return href.startsWith('/') ? (
    <Link href={href} className={styles.more}>
      {inner}
    </Link>
  ) : (
    <a href={href} className={styles.more}>
      {inner}
    </a>
  );
}

function Cta({ href, kind = 'primary', size, children }: { href: string; kind?: 'primary' | 'secondary'; size?: 'sm'; children: ReactNode }) {
  const className = `${styles.btn} ${styles[kind]} ${size === 'sm' ? styles.btnSm : ''}`;
  return href.startsWith('/') ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function TopBar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <header className={styles.top}>
      <div className={styles.topInner}>
        <Link href="/" className={styles.brand} aria-label="Tagwise, home">
          <Logo />
        </Link>
        <nav className={styles.topNav} aria-label="Sections">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.label}
            </a>
          ))}
        </nav>
        <div className={styles.topEnd}>
          <Cta href="/app" size="sm">
            Open the demo
          </Cta>
          <button type="button" className={styles.menuButton} aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            <span className={styles.vh}>{open ? 'Close the menu' : 'Open the menu'}</span>
          </button>
        </div>
      </div>
      {open && (
        <nav id="site-menu" className={styles.menu} aria-label="Menu">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={() => setOpen(false)}>
              {s.label}
            </a>
          ))}
          <Cta href="/app">Open the demo</Cta>
        </nav>
      )}
    </header>
  );
}

/** The sticky nav under the hero; marks the section in view. */
function SectionNav() {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
        setCurrent(SECTIONS.find((s) => seen.get(s.id))?.id ?? null);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return (
    <div className={styles.secnav}>
      <div className={styles.secnavInner}>
        <span className={styles.secnavName} aria-hidden="true">
          Tagwise
        </span>
        <nav className={styles.secnavLinks} aria-label="On this page">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} aria-current={current === s.id ? 'location' : undefined}>
              {s.label}
            </a>
          ))}
        </nav>
        <span className={styles.secnavCta}>
          <Cta href="/app" size="sm">
            Open the demo
          </Cta>
        </span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    id: 'scan',
    icon: <ScanLine size={28} aria-hidden="true" />,
    title: 'Scan and labels',
    text: 'QR labels laid out on A4, 18 to a sheet. Scanning one opens the item with the actions that matter.',
  },
  {
    id: 'import',
    icon: <FileSpreadsheet size={28} aria-hidden="true" />,
    title: 'Import from Excel',
    text: 'Bring in the register you already keep. Columns are matched and every row is checked first.',
  },
  {
    id: 'stock-takes',
    icon: <ClipboardCheck size={28} aria-hidden="true" />,
    title: 'Stock-takes together',
    text: 'Split a site into rooms, scan, and watch the board fill in with what is found and what is missing.',
  },
  {
    id: 'sites',
    icon: <MapIcon size={28} aria-hidden="true" />,
    title: 'Every site on a map',
    text: 'Offices, stores, schools and clinics, each with what is there, what is out and any count running.',
  },
  {
    id: 'history',
    icon: <History size={28} aria-hidden="true" />,
    title: 'Comments and history',
    text: 'Each item keeps its conversation and a record of every change, and edits never overwrite silently.',
  },
  {
    id: 'history',
    icon: <ShieldCheck size={28} aria-hidden="true" />,
    title: 'Roles that fit',
    text: 'Owner, admin, editor, auditor and viewer, each offered only the actions that role may take.',
  },
];

function FeatureRow({
  id,
  eyebrow,
  title,
  children,
  media,
  reverse = false,
  band = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
  media: ReactNode;
  reverse?: boolean;
  band?: boolean;
}) {
  return (
    <section id={id} className={`${styles.section} ${band ? styles.band : ''}`} aria-labelledby={`${id}-title`}>
      <div className={`${styles.inner} ${styles.row} ${reverse ? styles.reverse : ''}`}>
        <div className={styles.rowText}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id={`${id}-title`} className={styles.h2}>
            {title}
          </h2>
          {children}
        </div>
        <figure className={styles.rowMedia}>{media}</figure>
      </div>
    </section>
  );
}

const TOOLS = [
  {
    id: 'tools-web',
    title: 'Front end',
    items: ['React 18 and TypeScript, built with Vite', 'MapLibre for the sites map', 'SheetJS for reading and writing spreadsheets'],
  },
  {
    id: 'tools-services',
    title: 'Services',
    items: ['Rust with axum and sqlx', 'identity, register, notifications, media and ops', 'OpenAPI documents generated from the code'],
  },
  {
    id: 'tools-data',
    title: 'Data',
    items: ['PostgreSQL 15, a database per service', 'Redis 7 for the sign-out list and rate limits', 'Each service runs its own migrations'],
  },
  {
    id: 'tools-observability',
    title: 'Observability',
    items: ['OpenTelemetry collector', 'Tempo for traces', 'Prometheus for metrics, Grafana for dashboards'],
  },
  {
    id: 'tools-docs',
    title: 'Docs',
    items: ['Fumadocs on Next.js', 'An API reference built from the services’ OpenAPI documents'],
  },
  {
    id: 'tools-delivery',
    title: 'Delivery',
    items: ['GitHub Actions: lint, types, tests, build and Rust checks', 'Docker Compose behind an nginx gateway', 'Dependabot for npm, Cargo, Docker and Actions'],
  },
];

const USES = [
  {
    icon: <GraduationCap size={28} aria-hidden="true" />,
    title: 'Schools',
    text: 'Laptops, projectors and lab kit checked out to staff with a due date, and counted room by room at the end of term.',
  },
  {
    icon: <Stethoscope size={28} aria-hidden="true" />,
    title: 'Clinics',
    text: 'Equipment by room, and consumables with batches and expiry dates in view before anything is issued.',
  },
  {
    icon: <Building2 size={28} aria-hidden="true" />,
    title: 'Offices',
    text: 'Who has which laptop, phone and screen, with check-out, check-in and a record of every handover.',
  },
  {
    icon: <Store size={28} aria-hidden="true" />,
    title: 'Stores',
    text: 'Stock lines with reorder levels, issues and receipts, and a balance that never goes below zero.',
  },
];

const FAQ: { id: string; q: string; a: ReactNode }[] = [
  {
    id: 'faq-what',
    q: 'What is Tagwise?',
    a: 'A shared register for an organisation’s assets and stock: what you own, where it is, who has it and what state it is in, with QR labels, scanning, spreadsheet import, stock-takes and a map of your sites.',
  },
  {
    id: 'faq-account',
    q: 'Do I need an account to try it?',
    a: 'No. The demo opens straight into a sample workspace for an invented community trust. You choose a sample member to act as, so you can see the app through each role.',
  },
  {
    id: 'faq-data',
    q: 'Where is the demo’s data kept?',
    a: 'In your browser’s local storage only. Nothing you do is sent anywhere, and the sample workspace can be reset from Settings.',
  },
  {
    id: 'faq-import',
    q: 'Can I bring my existing spreadsheet?',
    a: 'Yes: .xlsx, .xls or .csv, up to 5 MB and 5,000 rows. Columns are matched for you, and nothing is written until you have seen every problem. Macro files (.xlsm) are refused, and formulas are read as their saved values.',
  },
  {
    id: 'faq-together',
    q: 'Can several people work at once?',
    a: 'Between tabs of the same browser, yes: edits, presence and stock-take scans appear live, and a stale edit is caught instead of overwriting. Across devices it needs the app connected to the services, which it is not yet.',
  },
  {
    id: 'faq-devices',
    q: 'Has it been tried with real phones and printed labels?',
    a: 'Not yet. Typed codes and handheld scanners work. Camera scanning uses the browser’s own barcode reader, with a fallback where there is none, and still needs trying on real phones; the labels have not yet been printed and scanned from paper.',
  },
  {
    id: 'faq-built',
    q: 'What is it built with?',
    a: (
      <>
        React and TypeScript in the browser; five Rust services with PostgreSQL and Redis behind an nginx gateway; OpenTelemetry, Prometheus, Grafana and
        Tempo for observability. The details are <a href="#under-the-hood">under the hood</a>, and the code is on <a href={REPO}>GitHub</a>.
      </>
    ),
  },
];

const FOOTER: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Scan and labels', href: '#scan' },
      { label: 'Import', href: '#import' },
      { label: 'Stock-takes', href: '#stock-takes' },
      { label: 'Sites', href: '#sites' },
      { label: 'Open the demo', href: '/app' },
    ],
  },
  {
    title: 'Docs',
    links: [
      { label: 'Read me', href: `${REPO}#readme` },
      { label: 'Architecture', href: `${REPO}/blob/main/ARCHITECTURE.md` },
      { label: 'Backend', href: `${REPO}/blob/main/docs/BACKEND.md` },
      { label: 'Design', href: `${REPO}/blob/main/docs/DESIGN.md` },
      { label: 'Work orders', href: `${REPO}/blob/main/docs/WORK_ORDERS.md` },
    ],
  },
  {
    title: 'Under the hood',
    links: [
      { label: 'How it fits together', href: '#under-the-hood' },
      { label: 'Services', href: '#tools-services' },
      { label: 'Observability', href: '#tools-observability' },
      { label: 'Delivery', href: '#tools-delivery' },
      { label: 'Source code', href: REPO },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Copyright', href: `${REPO}#licence` },
      { label: 'Security', href: `${REPO}/blob/main/SECURITY.md` },
      { label: 'Provenance', href: `${REPO}/blob/main/PROVENANCE.md` },
      { label: 'Map data © OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
      { label: 'Map tiles: OpenFreeMap', href: 'https://openfreemap.org' },
    ],
  },
];

/** Opening a FAQ answer by its address (#faq-data) unfolds it. */
function useOpenFromHash() {
  useEffect(() => {
    const open = () => {
      const el = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
      if (el instanceof HTMLDetailsElement) el.open = true;
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
}

export default function Landing() {
  useLayoutEffect(() => {
    setLightUnlessChosen(true);
    document.documentElement.classList.add(styles.smooth);
    return () => {
      setLightUnlessChosen(false);
      document.documentElement.classList.remove(styles.smooth);
    };
  }, []);
  useEffect(() => {
    document.title = 'Tagwise · a shared register for assets and stock';
  }, []);
  useOpenFromHash();

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <TopBar />

      <main id="main" tabIndex={-1} className={styles.main}>
        <section className={`${styles.hero} ${styles.band}`} aria-labelledby="hero-title">
          <div className={`${styles.inner} ${styles.heroGrid}`}>
            <div className={styles.heroText}>
              <p className={styles.eyebrow}>Assets and stock, shared</p>
              <h1 id="hero-title" className={styles.h1}>
                Know what you own, where it is, and who has it.
              </h1>
              <p className={styles.lead}>
                Tagwise is a shared register for schools, clinics, offices and stores. Label each thing with a QR code, scan it, and count together instead
                of passing a spreadsheet around.
              </p>
              <div className={styles.ctas}>
                <Cta href="/app">Open the demo</Cta>
                <Cta href="#features" kind="secondary">
                  See the features
                </Cta>
              </div>
              <p className={styles.fine}>No sign-up. The demo runs in your browser on a sample workspace.</p>
            </div>
            <figure className={styles.heroShot}>
              <Window
                name="dashboard"
                phoneName="phone-home"
                eager
                alt="Tagwise home screen: items overdue and due back, low stock, a stock-take in progress, assets by site and recent activity"
              />
              <figcaption className={styles.caption}>The home screen of the sample workspace. The organisation, people and figures are invented.</figcaption>
            </figure>
          </div>
        </section>

        <SectionNav />

        <section id="features" className={styles.section} aria-labelledby="features-title">
          <div className={styles.inner}>
            <div className={styles.sectionHead}>
              <h2 id="features-title" className={styles.h2}>
                One register, from the label to the last count
              </h2>
              <p className={styles.lead}>Everything an organisation needs to keep track of its things, in one place everyone can see.</p>
            </div>
            <ul className={styles.tiles}>
              {FEATURES.map((f) => (
                <li key={f.title} className={styles.tile}>
                  <span className={styles.tileIcon}>{f.icon}</span>
                  <h3 className={styles.h3}>{f.title}</h3>
                  <p className={styles.tileText}>{f.text}</p>
                  <More href={`#${f.id}`} about={`about ${f.title.toLowerCase()}`}>
                    Learn more
                  </More>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <FeatureRow
          id="scan"
          band
          eyebrow="Scan and labels"
          title="A label that opens the record"
          media={
            <div className={styles.composite}>
              <Window name="labels" alt="The labels page: a sheet of QR labels for seven assets, laid out three across on A4" />
              <Phone name="phone-scan" alt="Tagwise on a phone after a scan: the asset with check-in, move and count actions" />
            </div>
          }
        >
          <p className={styles.body}>
            Every asset gets a tag and a QR code that holds a link to its page. Print a sheet, stick the labels on, and a scan brings up the item with the
            actions that matter: check out, check in, move or count.
          </p>
          <ul className={styles.points}>
            <li>A4 sheets of 18 labels at 62 × 40 mm, or one label from the item’s page</li>
            <li>Stock lines are found by their barcode as well as their name</li>
            <li>Handheld scanners and typed codes work as they are</li>
          </ul>
          <More href="/app/scan">Try the scanner in the demo</More>
        </FeatureRow>

        <FeatureRow
          id="import"
          reverse
          eyebrow="Import"
          title="Start from the spreadsheet you already have"
          media={<Window name="import" alt="The import check: problem rows marked cell by cell, with counts of rows ready, rows with errors and rows already in the register" />}
        >
          <p className={styles.body}>
            Drop in an Excel or CSV file. Tagwise matches your columns to its fields, then checks every row before anything is written: unknown sites,
            impossible dates, negative costs, tags used twice and tags already in the register.
          </p>
          <ul className={styles.points}>
            <li>Choose to skip or update the rows already in the register</li>
            <li>Download a report of the rows that need fixing</li>
            <li>Export any view back to Excel or CSV</li>
          </ul>
          <More href="/app/import">Try it with the practice spreadsheet</More>
        </FeatureRow>

        <FeatureRow
          id="stock-takes"
          band
          eyebrow="Stock-takes"
          title="Count a site with several people at once"
          media={<Window name="count" alt="A stock-take board: progress by room, a live feed of scans and the list of items still to find" />}
        >
          <p className={styles.body}>
            Start a stock-take, split the rooms and scan. The board shows progress by room, a feed of every scan, things found in the wrong room and the
            list still to find. Close it to mark what is missing and export the variance report.
          </p>
          <ul className={styles.points}>
            <li>A repeat scan says it is already counted; an unknown code says it is not in the register</li>
            <li>Live between tabs of one browser today; across devices once the app talks to the services</li>
          </ul>
          <More href="/app/counts/count-mochudi-t3">Open the sample stock-take</More>
        </FeatureRow>

        <FeatureRow
          id="sites"
          reverse
          eyebrow="Sites"
          title="Every site on one map"
          media={<Window name="sites" alt="Six sites of the sample trust on a map of Botswana, with a list of each site's assets and stock" />}
        >
          <p className={styles.body}>
            Offices, the store, the school and the clinics, each with what is there, what is out and whether a count is running. Choose a site to see its
            rooms and open the register filtered to it.
          </p>
          <p className={styles.small}>Map data © OpenStreetMap contributors, tiles by OpenFreeMap.</p>
          <More href="/app/sites">See the sites in the demo</More>
        </FeatureRow>

        <FeatureRow
          id="history"
          band
          eyebrow="Comments, history and roles"
          title="Every item keeps its story"
          media={<Window name="asset" alt="An asset page: details, who has it and when it is due, its QR label, comments and history" />}
        >
          <p className={styles.body}>
            Each asset page shows its details, who has it, its label, a comment thread and the history of every change. Two people editing at once never
            overwrite each other silently: the second save asks which version to keep.
          </p>
          <ul className={styles.points}>
            <li>Five roles: owner, admin, editor, auditor and viewer</li>
            <li>A viewer reads and comments; an auditor runs stock-takes without changing the register</li>
            <li>Every change is recorded with who made it and when</li>
          </ul>
          <More href="/app/assets/MCT-00040">Open an asset in the demo</More>
        </FeatureRow>

        <section id="under-the-hood" className={styles.section} aria-labelledby="hood-title">
          <div className={styles.inner}>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Under the hood</p>
              <h2 id="hood-title" className={styles.h2}>
                Built like a real system
              </h2>
              <p className={styles.lead}>
                Behind the demo sits a complete back end in the same repository: five Rust services behind an nginx gateway, PostgreSQL with a database per
                service, Redis, an observability stack and a documentation site, all checked by continuous integration.
              </p>
            </div>
            <p className={styles.status}>
              <span className={styles.chip}>Demo data</span>
              <span>
                The demo runs on a sample workspace in your browser. The services are built and tested, and start together as a development stack in Docker;
                the app does not call them yet.
              </span>
            </p>
            <figure className={styles.diagram}>
              <ArchitectureDiagram />
            </figure>
            <div className={styles.tools}>
              {TOOLS.map((group) => (
                <div key={group.id} id={group.id} className={styles.toolGroup}>
                  <h3 className={styles.h3}>{group.title}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="use-cases" className={`${styles.section} ${styles.band}`} aria-labelledby="uses-title">
          <div className={styles.inner}>
            <div className={styles.sectionHead}>
              <h2 id="uses-title" className={styles.h2}>
                Made for places that keep a register
              </h2>
              <p className={styles.lead}>For teams that track their things in a spreadsheet today.</p>
            </div>
            <ul className={`${styles.tiles} ${styles.uses}`}>
              {USES.map((u) => (
                <li key={u.title} className={styles.tile}>
                  <span className={styles.tileIcon}>{u.icon}</span>
                  <h3 className={styles.h3}>{u.title}</h3>
                  <p className={styles.tileText}>{u.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" className={styles.section} aria-labelledby="faq-title">
          <div className={`${styles.inner} ${styles.faqGrid}`}>
            <h2 id="faq-title" className={styles.h2}>
              Frequently asked questions
            </h2>
            <div className={styles.faq}>
              {FAQ.map((item) => (
                <details key={item.id} id={item.id} className={styles.qa}>
                  <summary>
                    <span>{item.q}</span>
                    <ChevronDown size={20} aria-hidden="true" className={styles.chevron} />
                  </summary>
                  <div className={styles.answer}>{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.closing}`} aria-labelledby="closing-title">
          <div className={`${styles.inner} ${styles.closingInner}`}>
            <h2 id="closing-title" className={styles.h2}>
              See it with the sample workspace
            </h2>
            <p className={styles.lead}>Try a scan, an import and a stock-take. Nothing to install and no account.</p>
            <div className={styles.ctas}>
              <Cta href="/app">Open the demo</Cta>
              <Cta href={REPO} kind="secondary">
                Read the code on GitHub
              </Cta>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.inner}>
          <div className={styles.footCols}>
            {FOOTER.map((col) => (
              <nav key={col.title} aria-labelledby={`foot-${col.title.replace(/\s+/g, '-').toLowerCase()}`}>
                <h2 id={`foot-${col.title.replace(/\s+/g, '-').toLowerCase()}`} className={styles.footTitle}>
                  {col.title}
                </h2>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>{l.href.startsWith('/') ? <Link href={l.href}>{l.label}</Link> : <a href={l.href}>{l.label}</a>}</li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className={styles.footBottom}>
            <Logo />
            <p>© 2026 Mooketsi Vincent Magwaza. All rights reserved.</p>
            <p>The organisation, people and figures in the demo and its screenshots are invented.</p>
          </div>
        </div>
      </footer>

      <ThemeToggle placement="page" />
    </div>
  );
}
