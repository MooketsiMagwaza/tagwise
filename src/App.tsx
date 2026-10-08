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

/** App routes, most specific first. `title` names the browser tab. */
const ROUTES: { pattern: string; title: string; component: Screen }[] = [
  { pattern: '/app', title: 'Home', component: Dashboard },
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
