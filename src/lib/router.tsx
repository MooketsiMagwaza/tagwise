// A small History-API router. The app needs real URLs (deep links, reload,
// a QR label that opens an item) but only a handful of patterns, so this is
// a few dozen lines instead of a dependency. Patterns look like
// `/app/assets/:id`; a trailing `/*` matches anything below.

import { useMemo, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const EVENT = 'tw:navigate';

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const url = new URL(to, window.location.origin);
  const next = url.pathname + url.search + url.hash;
  if (next === window.location.pathname + window.location.search + window.location.hash) return;
  const samePage = url.pathname === window.location.pathname;
  window.history[opts.replace ? 'replaceState' : 'pushState'](null, '', next);
  window.dispatchEvent(new Event(EVENT));
  if (!opts.replace && !samePage) window.scrollTo({ top: 0 });
}

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(EVENT, callback);
  };
}

export interface Location {
  path: string;
  search: URLSearchParams;
}

/** The current URL, re-rendering on every navigation (including back/forward). */
export function useLocation(): Location {
  const raw = useSyncExternalStore(subscribe, () => window.location.pathname + window.location.search);
  return useMemo(() => {
    const [path, search = ''] = raw.split('?');
    return { path: path.replace(/\/+$/, '') || '/', search: new URLSearchParams(search) };
  }, [raw]);
}

/** Returns the captured `:params` if `path` matches `pattern`, else null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split('/').filter(Boolean);
  const have = path.split('/').filter(Boolean);
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i] === '*') return params;
    if (i >= have.length) return null;
    if (want[i].startsWith(':')) params[want[i].slice(1)] = decodeURIComponent(have[i]);
    else if (want[i] !== have[i]) return null;
  }
  return want.length === have.length ? params : null;
}

/** Is `href` the current page or one of its children? (For "current" nav items.) */
export function isActive(href: string, path: string, exact = false): boolean {
  if (exact) return path === href;
  return path === href || path.startsWith(`${href}/`);
}

/** An ordinary link that navigates in-app on a plain click, so modified clicks
 *  (new tab, copy address) still behave like any link. */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  function handle(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (rest.target && rest.target !== '_self') return;
    event.preventDefault();
    navigate(href);
  }
  return <a {...rest} href={href} onClick={handle} />;
}
