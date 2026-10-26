// How a person's look preferences (theme, table density, motion) reach the
// document. The choice lives in a tiny external store so any component can
// read and change it, and is mirrored to localStorage so the next load
// paints correctly (index.html applies the same values before first paint,
// so there is no light-to-dark flash).

import { useSyncExternalStore } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';
export type MotionPref = 'system' | 'reduce';

export interface Appearance {
  theme: ThemePref;
  density: Density;
  motion: MotionPref;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: 'system', density: 'comfortable', motion: 'system' };

const KEY = 'tagwise.appearance';

export function isAppearance(value: unknown): value is Appearance {
  const v = value as Appearance;
  return (
    !!v &&
    ['system', 'light', 'dark'].includes(v.theme) &&
    ['comfortable', 'compact'].includes(v.density) &&
    ['system', 'reduce'].includes(v.motion)
  );
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return isAppearance(parsed) ? parsed : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

const darkQuery = () =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

/** Is the dark theme showing right now (chosen, or following the system)? */
export const isDark = () => document.documentElement.dataset.theme === 'dark';

let current: Appearance = DEFAULT_APPEARANCE;
const listeners = new Set<() => void>();
const themeListeners = new Set<() => void>();
/** True while the public page is showing: it is light unless the visitor
 *  chose dark, whatever the system setting (the app follows the system). */
let lightUnlessChosen = false;

export function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  const dark = a.theme === 'dark' || (a.theme === 'system' && !lightUnlessChosen && !!darkQuery()?.matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.density = a.density;
  root.dataset.motion = a.motion;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d1218' : '#f3f5f7');
  themeListeners.forEach((l) => l());
}

export function setAppearance(next: Appearance) {
  current = next;
  applyAppearance(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: the preference just won't survive a reload */
  }
  listeners.forEach((l) => l());
}

/** The public page calls this with true while it is mounted (and false
 *  when it unmounts), so "system" means light there. index.html applies
 *  the same rule before first paint. */
export function setLightUnlessChosen(on: boolean) {
  lightUnlessChosen = on;
  applyAppearance(current);
}

/** Call once at startup: applies the stored look and follows the OS
 *  light/dark setting while the preference is "system". */
export function initAppearance() {
  current = loadAppearance();
  applyAppearance(current);
  darkQuery()?.addEventListener('change', () => {
    if (current.theme === 'system') applyAppearance(current);
  });
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/** True while the dark theme is showing; re-renders when it flips (the map
 *  swaps its basemap style on this). */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      themeListeners.add(cb);
      return () => themeListeners.delete(cb);
    },
    () => (typeof document !== 'undefined' ? document.documentElement.dataset.theme === 'dark' : false),
  );
}
