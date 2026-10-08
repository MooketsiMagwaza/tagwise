import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from 'react';
import { matchPath, navigate, useLocation } from './lib/router';
import { ToastProvider } from './lib/toast';
import { Shell } from './app/Shell';
import { SkeletonLines } from './ui';

type ScreenProps = { params: Record<string, string> };
type Screen = LazyExoticComponent<ComponentType<ScreenProps>>;

const screen = (load: () => Promise<{ default: ComponentType<ScreenProps> }>): Screen => lazy(load);

const Landing = lazy(() => import('./screens/Landing'));
const Dashboard = screen(() => import('./screens/Dashboard'));
const Soon = screen(() => import('./screens/Soon'));
const Assets = screen(() => import('./screens/Assets'));
const AssetNew = screen(() => import('./screens/AssetNew'));
const AssetDetail = screen(() => import('./screens/AssetDetail'));
const Stock = screen(() => import('./screens/Stock'));
const StockDetail = screen(() => import('./screens/StockDetail'));
const Scan = screen(() => import('./screens/Scan'));
const Labels = screen(() => import('./screens/Labels'));
const Import = screen(() => import('./screens/Import'));
const Counts = screen(() => import('./screens/Counts'));
const CountBoard = screen(() => import('./screens/CountBoard'));
const Sites = screen(() => import('./screens/Sites'));
const SiteDetail = screen(() => import('./screens/SiteDetail'));
const Activity = screen(() => import('./screens/Activity'));
const Settings = screen(() => import('./screens/Settings'));

/** App routes, most specific first. `title` names the browser tab. */
const ROUTES: { pattern: string; title: string; component: Screen }[] = [
  { pattern: '/app', title: 'Home', component: Dashboard },
  { pattern: '/app/assets', title: 'Assets', component: Assets },
  { pattern: '/app/assets/new', title: 'Add an asset', component: AssetNew },
  { pattern: '/app/assets/:id', title: 'Asset', component: AssetDetail },
  { pattern: '/app/stock', title: 'Stock', component: Stock },
  { pattern: '/app/stock/:id', title: 'Stock line', component: StockDetail },
  { pattern: '/app/scan', title: 'Scan', component: Scan },
  { pattern: '/app/labels', title: 'Labels', component: Labels },
  { pattern: '/app/import', title: 'Import', component: Import },
  { pattern: '/app/counts', title: 'Stock-takes', component: Counts },
  { pattern: '/app/counts/:id', title: 'Stock-take', component: CountBoard },
  { pattern: '/app/sites', title: 'Sites', component: Sites },
  { pattern: '/app/sites/:id', title: 'Site', component: SiteDetail },
  { pattern: '/app/activity', title: 'Activity', component: Activity },
  { pattern: '/app/settings', title: 'Settings', component: Settings },
  { pattern: '/app/settings/:section', title: 'Settings', component: Settings },
  { pattern: '/app/*', title: 'Not built yet', component: Soon },
];

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

export function App() {
  const { path } = useLocation();

  if (path === '/') {
    return (
      <Suspense fallback={null}>
        <Landing />
      </Suspense>
    );
  }

  // A printed label's QR code opens /s/<tag>: send it to the item.
  const label = matchPath('/s/:code', path);
  if (label) return <Redirect to={`/app/assets/${encodeURIComponent(label.code)}`} />;

  if (!path.startsWith('/app')) return <Redirect to="/app" />;

  const route = ROUTES.map((r) => ({ ...r, params: matchPath(r.pattern, path) })).find((r) => r.params);
  const Component = route?.component ?? Soon;

  return (
    <ToastProvider>
      <Shell title={route?.title ?? 'Tagwise'}>
        <Suspense fallback={<SkeletonLines rows={6} />}>
          <Component params={route?.params ?? {}} />
        </Suspense>
      </Shell>
    </ToastProvider>
  );
}
