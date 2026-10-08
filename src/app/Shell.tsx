import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  Boxes,
  ClipboardCheck,
  FileSpreadsheet,
  Home,
  Map,
  Menu,
  Moon,
  Package,
  ScanLine,
  Search,
  Settings,
  Sun,
  Tags,
  X,
} from 'lucide-react';
import { Avatar, CommandPalette, IconButton, type CommandGroup } from '../ui';
import { isActive, Link, navigate, useLocation } from '../lib/router';
import { setPresencePath, useLookups, useMe, usePresence, useQuery } from '../data/hooks';
import { ROLE_LABEL } from '../data/permissions';
import { setAppearance, useAppearance, useIsDark } from '../theme';
import { Logo, LogoMark, PresenceStack } from './bits';
import styles from './Shell.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
}

const PRIMARY: NavItem[] = [
  { href: '/app', label: 'Home', icon: <Home size={18} />, exact: true },
  { href: '/app/assets', label: 'Assets', icon: <Boxes size={18} /> },
  { href: '/app/stock', label: 'Stock', icon: <Package size={18} /> },
  { href: '/app/scan', label: 'Scan', icon: <ScanLine size={18} /> },
];
const WORK: NavItem[] = [
  { href: '/app/counts', label: 'Stock-takes', icon: <ClipboardCheck size={18} /> },
  { href: '/app/sites', label: 'Sites', icon: <Map size={18} /> },
  { href: '/app/labels', label: 'Labels', icon: <Tags size={18} /> },
  { href: '/app/import', label: 'Import', icon: <FileSpreadsheet size={18} /> },
  { href: '/app/activity', label: 'Activity', icon: <Activity size={18} /> },
];

function NavLink({ item, path, onNavigate }: { item: NavItem; path: string; onNavigate?: () => void }) {
  const active = isActive(item.href, path, item.exact);
  return (
    <Link href={item.href} className={styles.navLink} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
      {item.icon}
      <span>{item.label}</span>
    </Link>
  );
}

function Sidebar({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  const { me } = useMe();
  const ws = useQuery((r) => r.workspace(), []);
  return (
    <nav className={styles.sidebarInner} aria-label="Main">
      <Link href="/" className={styles.brand} onClick={onNavigate} aria-label="Tagwise home page">
        <Logo />
      </Link>
      <div className={styles.workspace}>
        <span className={styles.wsName}>{ws.data?.name ?? 'Workspace'}</span>
        <span className={styles.wsNote}>Sample workspace</span>
      </div>
      <div className={styles.navGroup}>
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} path={path} onNavigate={onNavigate} />
        ))}
      </div>
      <div className={styles.navGroup}>
        <span className={styles.navHeading}>Work</span>
        {WORK.map((item) => (
          <NavLink key={item.href} item={item} path={path} onNavigate={onNavigate} />
        ))}
      </div>
      <div className={styles.navFoot}>
        <NavLink item={{ href: '/app/settings', label: 'Settings', icon: <Settings size={18} /> }} path={path} onNavigate={onNavigate} />
        {me && (
          <Link href="/app/settings/people" className={styles.me} onClick={onNavigate}>
            <Avatar initials={me.initials} hue={me.hue} />
            <span className={styles.meText}>
              <span className={styles.meName}>{me.name}</span>
              <span className={styles.meRole}>{me.role ? ROLE_LABEL[me.role] : ''} · you, in this demo</span>
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}

const TABS: NavItem[] = [
  { href: '/app', label: 'Home', icon: <Home size={20} />, exact: true },
  { href: '/app/assets', label: 'Assets', icon: <Boxes size={20} /> },
  { href: '/app/scan', label: 'Scan', icon: <ScanLine size={22} /> },
  { href: '/app/counts', label: 'Counts', icon: <ClipboardCheck size={20} /> },
];

function TabBar({ path, onMore }: { path: string; onMore: () => void }) {
  return (
    <nav className={styles.tabbar} aria-label="Main">
      {TABS.map((t) => {
        const active = isActive(t.href, path, t.exact);
        return (
          <Link key={t.href} href={t.href} className={t.href === '/app/scan' ? styles.tabScan : styles.tab} aria-current={active ? 'page' : undefined}>
            {t.icon}
            <span>{t.label}</span>
          </Link>
        );
      })}
      <button type="button" className={styles.tab} onClick={onMore}>
        <Menu size={20} />
        <span>More</span>
      </button>
    </nav>
  );
}

function useCommands(): CommandGroup[] {
  const assets = useQuery((r) => r.assets(), []);
  const appearance = useAppearance();
  const dark = useIsDark();
  return useMemo(
    () => [
      {
        heading: 'Go to',
        commands: [...PRIMARY, ...WORK, { href: '/app/settings', label: 'Settings', icon: <Settings size={16} /> }].map((n) => ({
          id: n.href,
          label: n.label,
          icon: n.icon,
          onSelect: () => navigate(n.href),
        })),
      },
      {
        heading: 'Actions',
        commands: [
          { id: 'scan', label: 'Scan a code', icon: <ScanLine size={16} />, keywords: 'qr barcode camera', onSelect: () => navigate('/app/scan') },
          { id: 'import', label: 'Import a spreadsheet', icon: <FileSpreadsheet size={16} />, keywords: 'excel csv upload', onSelect: () => navigate('/app/import') },
          {
            id: 'theme',
            label: dark ? 'Switch to light theme' : 'Switch to dark theme',
            icon: dark ? <Sun size={16} /> : <Moon size={16} />,
            keywords: 'dark light appearance',
            onSelect: () => setAppearance({ ...appearance, theme: dark ? 'light' : 'dark' }),
          },
        ],
      },
      {
        heading: 'Assets',
        commands: (assets.data ?? []).map((a) => ({
          id: a.id,
          label: `${a.tag}  ${a.name}`,
          detail: a.category,
          keywords: `${a.serial ?? ''} ${a.model ?? ''}`,
          icon: <Boxes size={16} />,
          onSelect: () => navigate(`/app/assets/${a.tag}`),
        })),
      },
    ],
    [assets.data, appearance, dark],
  );
}

/** The signed-in frame: sidebar on wide screens, a floating tab bar and a
 *  drawer on phones, a glass top bar with search and presence. */
export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { path } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const commands = useCommands();
  const lookups = useLookups();
  const peers = usePresence(path);
  const dark = useIsDark();
  const appearance = useAppearance();

  useEffect(() => setPresencePath(path), [path]);
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    document.title = `${title} · Tagwise`;
  }, [title]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={styles.frame}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <aside className={styles.sidebar}>
        <Sidebar path={path} />
      </aside>

      {drawer && (
        <div className={styles.drawerScrim} onClick={() => setDrawer(false)}>
          <aside className={styles.drawer} onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <div className={styles.drawerClose}>
              <IconButton label="Close menu" variant="plain" onClick={() => setDrawer(false)}>
                <X size={18} />
              </IconButton>
            </div>
            <Sidebar path={path} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topLeft}>
            <span className={styles.phoneOnly}>
              <IconButton label="Open menu" variant="plain" onClick={() => setDrawer(true)}>
                <Menu size={18} />
              </IconButton>
            </span>
            <Link href="/app" className={styles.phoneBrand} aria-label="Home">
              <LogoMark size={24} />
            </Link>
            <button type="button" className={styles.search} onClick={() => setPalette(true)}>
              <Search size={16} aria-hidden="true" />
              <span className={styles.searchText}>Search assets, pages, actions</span>
              <kbd className={styles.kbd}>Ctrl K</kbd>
            </button>
          </div>
          <div className={styles.topRight}>
            <PresenceStack peers={peers} people={lookups.people} />
            <IconButton
              label={dark ? 'Use the light theme' : 'Use the dark theme'}
              variant="plain"
              onClick={() => setAppearance({ ...appearance, theme: dark ? 'light' : 'dark' })}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
            <Link href="/app/scan" className={styles.scanButton}>
              <ScanLine size={16} aria-hidden="true" />
              <span>Scan</span>
            </Link>
          </div>
        </header>
        <main id="main" className={styles.content} tabIndex={-1}>
          {children}
        </main>
      </div>

      <TabBar path={path} onMore={() => setDrawer(true)} />
      {palette && <CommandPalette groups={commands} placeholder="Search assets by tag or name, or jump to a page" onClose={() => setPalette(false)} />}
    </div>
  );
}
