import { useEffect } from 'react';
import { ArrowRight, Check, Minus } from 'lucide-react';
import { ButtonLink } from '../ui';
import { Link } from '../lib/router';
import { Logo } from '../app/bits';
import { AssetLabel } from '../app/AssetLabel';
import { setAppearance, useAppearance, useIsDark } from '../theme';
import styles from './Landing.module.css';

/** A real screenshot of the app, in the visitor's theme. */
function Shot({ name, alt, phone = false }: { name: string; alt: string; phone?: boolean }) {
  const dark = useIsDark();
  return (
    <span className={phone ? styles.phone : styles.window}>
      <img src={`/screens/${name}-${dark ? 'dark' : 'light'}.jpg`} alt={alt} loading="lazy" decoding="async" />
    </span>
  );
}

const REAL = [
  'The register: saved views, filters, sorting, columns, Excel and CSV export',
  'Asset pages with check-out, comments, history and a printable QR label',
  'Scanning by typed code or handheld scanner; camera decoding is built and still needs a test on a real phone',
  'Excel and CSV import with column matching, a row-by-row check and a problem report',
  'Stock-takes with a live board, and edits that never silently overwrite',
  'Two tabs of the same browser see each other’s changes and presence at once',
];
const NOT_YET = [
  'Sign-in and real accounts (you pick a sample member to act as)',
  'A server: data lives in your browser only, so other devices do not see it',
  'Email invitations and reminders',
  'The simulated teammates are a demo device, and say so',
];

export default function Landing() {
  const dark = useIsDark();
  const appearance = useAppearance();
  useEffect(() => {
    document.title = 'Tagwise · a shared register for assets and stock';
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Tagwise">
          <Logo />
        </Link>
        <nav className={styles.nav} aria-label="Page sections">
          <a href="#labels">Labels and scanning</a>
          <a href="#import">Import</a>
          <a href="#counts">Stock-takes</a>
          <a href="#status">What works today</a>
        </nav>
        <div className={styles.headerActions}>
          <button type="button" className={styles.themeButton} onClick={() => setAppearance({ ...appearance, theme: dark ? 'light' : 'dark' })}>
            {dark ? 'Light' : 'Dark'}
          </button>
          <ButtonLink href="/app" size="sm">
            Open the demo
          </ButtonLink>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.h1}>Know what you own, where it is, and who has it.</h1>
            <p className={styles.lead}>
              Tagwise is a shared register for schools, clinics, offices and stores. Put a QR label on each thing, scan it with any phone, and count everything
              together instead of passing a spreadsheet around.
            </p>
            <div className={styles.ctas}>
              <ButtonLink href="/app" size="lg" icon={<ArrowRight size={18} />}>
                Open the demo workspace
              </ButtonLink>
              <a href="#labels" className={styles.textLink}>
                How a label works
              </a>
            </div>
            <p className={styles.fine}>No sign-up. The demo runs in your browser with a fictional community trust; nothing you do leaves your device.</p>
          </div>
          <div className={styles.heroShot}>
            <Shot name="dashboard" alt="The Tagwise home page: overdue returns, low stock, a stock-take in progress and recent activity" />
          </div>
        </section>

        <section id="labels" className={styles.split}>
          <div className={styles.labelStage}>
            <div className={styles.paper} aria-hidden="true">
              <AssetLabel asset={{ tag: 'MCT-00040', name: 'HP ProBook 450 G10' }} org="Morula Community Trust" />
              <AssetLabel asset={{ tag: 'MCT-00063', name: 'Microscope, 40-1000x' }} org="Morula Community Trust" />
            </div>
            <Shot name="phone-scan" alt="Tagwise on a phone after scanning a label: the asset with check-out and move actions" phone />
          </div>
          <div className={styles.copy}>
            <h2 className={styles.h2}>A label that opens the record</h2>
            <p>
              Print sheets of 62 × 40 mm QR labels on an ordinary printer. The code holds a link, so any phone camera opens the item; inside Tagwise the scanner
              reads it, and the barcodes on consumables too.
            </p>
            <ul className={styles.ticks}>
              <li>Check things out to a person with a due date, and back in</li>
              <li>Move an item to another room in two taps</li>
              <li>Handheld USB and Bluetooth scanners work as they are</li>
            </ul>
          </div>
        </section>

        <section id="import" className={styles.band}>
          <div className={styles.bandText}>
            <h2 className={styles.h2}>Start from the spreadsheet you already have</h2>
            <p>
              Drop in the Excel file. Tagwise matches the columns, then checks every row before anything is written: unknown sites, impossible dates, negative
              costs, tags used twice, tags already in the register. You decide what happens to duplicates and download a report of the rest.
            </p>
          </div>
          <Shot name="import" alt="The import check: rows with problems are marked cell by cell, with a summary of what is ready" />
        </section>

        <section id="counts" className={styles.wide}>
          <Shot name="count" alt="A stock-take board: progress by room, a live feed of scans and the list still to find" />
          <div className={styles.wideText}>
            <h2 className={styles.h2}>Count a site with several people at once</h2>
            <p>
              Start a stock-take, split the rooms, and scan. The board fills in as each person scans, flags things found in the wrong room, and lists what is still
              missing. Close it to mark the gaps and export the variance report.
            </p>
          </div>
        </section>

        <section className={styles.split}>
          <div className={styles.copy}>
            <h2 className={styles.h2}>Every site on one map</h2>
            <p>Offices, the store, the school and the clinics, each with what is there, what is out and whether a count is running. Choose one to see its rooms.</p>
            <p className={styles.small}>Map data © OpenStreetMap contributors, tiles by OpenFreeMap.</p>
          </div>
          <Shot name="sites" alt="Six sites in Botswana on a map, with a list of each site's assets and stock" />
        </section>

        <section id="status" className={styles.status}>
          <h2 className={styles.h2}>What works today, honestly</h2>
          <p className={styles.statusLead}>This is a prototype. The left list was built and tried in a browser; the right list is not built yet.</p>
          <div className={styles.columns}>
            <ul className={styles.real}>
              {REAL.map((t) => (
                <li key={t}>
                  <Check size={16} aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
            <ul className={styles.notYet}>
              {NOT_YET.map((t) => (
                <li key={t}>
                  <Minus size={16} aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <ButtonLink href="/app" size="lg" icon={<ArrowRight size={18} />}>
            Try it with the sample trust
          </ButtonLink>
        </section>
      </main>

      <footer className={styles.footer}>
        <Logo />
        <p>© 2026 Mooketsi Vincent Magwaza. All rights reserved. The organisation, people and figures in the demo are invented.</p>
      </footer>
    </div>
  );
}
