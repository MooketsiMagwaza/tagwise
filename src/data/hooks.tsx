// React glue for the data layer: one repository for the app, a small
// query hook that re-runs whenever the data changes (here or in another tab),
// who "you" are in the demo, and who else is looking at the same page.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Lookups } from './fields';
import { broadcast, onLive, tabId } from './live';
import { LocalRepository } from './local';
import { can, type Action } from './permissions';
import type { Repository } from './repository';
import type { Person } from './types';

let instance: Repository | null = null;

/** The app's repository. Swap this for an API-backed one later. */
export function repo(): Repository {
  if (!instance) instance = new LocalRepository();
  return instance;
}

/** Runs `load` now and again after every change. Keeps the last result on
 *  screen while it reloads, so updates never flash a spinner. */
export function useQuery<T>(load: (r: Repository) => Promise<T>, deps: unknown[]): { data: T | undefined; loading: boolean; error: unknown } {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: unknown }>({ data: undefined, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => repo().subscribe(() => setTick((t) => t + 1)), []);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    loadRef
      .current(repo())
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState((s) => ({ ...s, loading: false, error })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return state;
}

/** People, sites and rooms by id, for turning ids into names. */
export function useLookups(): Lookups & { ready: boolean; peopleList: Person[] } {
  const people = useQuery((r) => r.people(), []);
  const sites = useQuery((r) => r.sites(), []);
  const places = useQuery((r) => r.places(), []);
  return useMemo(
    () => ({
      ready: !!(people.data && sites.data && places.data),
      peopleList: people.data ?? [],
      people: new Map((people.data ?? []).map((p) => [p.id, p])),
      sites: new Map((sites.data ?? []).map((s) => [s.id, s])),
      places: new Map((places.data ?? []).map((p) => [p.id, p])),
    }),
    [people.data, sites.data, places.data],
  );
}

// ── who you are in the demo ────────────────────────────────────────────

const ME_KEY = 'tagwise.me';
const meListeners = new Set<() => void>();
function readMe(): string {
  try {
    return localStorage.getItem(ME_KEY) || 'p-kagiso';
  } catch {
    return 'p-kagiso';
  }
}
let meId = typeof window !== 'undefined' ? readMe() : 'p-kagiso';

export function setMe(personId: string) {
  meId = personId;
  try {
    localStorage.setItem(ME_KEY, personId);
  } catch {
    /* session only */
  }
  meListeners.forEach((l) => l());
}

/** The person you are acting as. The prototype has no sign-in: you pick one
 *  of the sample members (Settings, or the menu under your name). */
export function useMe(): { me: Person | undefined; can: (action: Action) => boolean } {
  const id = useSyncExternalStore(
    (cb) => {
      meListeners.add(cb);
      return () => meListeners.delete(cb);
    },
    () => meId,
  );
  const people = useQuery((r) => r.people(), []);
  const me = people.data?.find((p) => p.id === id && p.role) ?? people.data?.find((p) => p.role === 'owner');
  const check = useCallback((action: Action) => can(me?.role, action), [me?.role]);
  return { me, can: check };
}

// ── presence ───────────────────────────────────────────────────────────

export interface Peer {
  key: string;
  personId: string;
  path: string;
  /** True for the sample teammates the demo adds; false for your other tabs. */
  simulated: boolean;
}

const peers = new Map<string, { personId: string; path: string; at: number }>();
const peerListeners = new Set<() => void>();
let peerSnapshot: Peer[] = [];
let myPath = typeof window !== 'undefined' ? window.location.pathname : '/';

function refreshPeers() {
  const cutoff = Date.now() - 12_000;
  for (const [k, v] of peers) if (v.at < cutoff) peers.delete(k);
  peerSnapshot = Array.from(peers.entries()).map(([key, v]) => ({ key, personId: v.personId, path: v.path, simulated: false }));
  peerListeners.forEach((l) => l());
}

function announce() {
  broadcast({ type: 'presence', from: tabId, personId: meId, path: myPath, at: Date.now() });
}

if (typeof window !== 'undefined') {
  onLive((m) => {
    if (m.type === 'presence') {
      const isNew = !peers.has(m.from);
      peers.set(m.from, { personId: m.personId, path: m.path, at: m.at });
      if (isNew) announce();
      refreshPeers();
    } else if (m.type === 'bye') {
      peers.delete(m.from);
      refreshPeers();
    }
  });
  window.setInterval(() => {
    announce();
    refreshPeers();
  }, 4000);
  window.addEventListener('pagehide', () => broadcast({ type: 'bye', from: tabId }));
  announce();
}

/** Tell other tabs which page this tab is on. */
export function setPresencePath(path: string) {
  if (path === myPath) return;
  myPath = path;
  announce();
}

// Simulated teammates: shown so the shared workspace reads as shared in a
// one-person demo. Always marked as simulated in the UI, and can be turned
// off in Settings.
const SIM_KEY = 'tagwise.simulatedTeammates';
const simListeners = new Set<() => void>();
let simulate = (() => {
  try {
    return localStorage.getItem(SIM_KEY) !== 'off';
  } catch {
    return true;
  }
})();

export function setSimulatedTeammates(on: boolean) {
  simulate = on;
  try {
    localStorage.setItem(SIM_KEY, on ? 'on' : 'off');
  } catch {
    /* session only */
  }
  simListeners.forEach((l) => l());
}

export function useSimulatedTeammates(): boolean {
  return useSyncExternalStore(
    (cb) => {
      simListeners.add(cb);
      return () => simListeners.delete(cb);
    },
    () => simulate,
  );
}

const SIM_PEOPLE = ['p-naledi', 'p-tumelo', 'p-lesego', 'p-boitumelo', 'p-onalenna'];

function simulatedFor(path: string, me: string): Peer[] {
  const section = path.split('/').slice(0, 4).join('/');
  let h = 0;
  for (const ch of section) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const howMany = path === '/app' ? 2 : h % 3;
  const others = SIM_PEOPLE.filter((p) => p !== me);
  return Array.from({ length: howMany }, (_, i) => others[(h + i * 2) % others.length])
    .filter((v, i, list) => list.indexOf(v) === i)
    .map((personId) => ({ key: `sim-${personId}`, personId, path, simulated: true }));
}

/** Who else is on `path` (your other tabs, plus simulated teammates when on). */
export function usePresence(path: string): Peer[] {
  const real = useSyncExternalStore(
    (cb) => {
      peerListeners.add(cb);
      return () => peerListeners.delete(cb);
    },
    () => peerSnapshot,
  );
  const sim = useSimulatedTeammates();
  const { me } = useMe();
  return useMemo(() => {
    const here = real.filter((p) => p.path === path);
    return sim ? [...here, ...simulatedFor(path, me?.id ?? '')] : here;
  }, [real, sim, path, me?.id]);
}
