import { readFileSync } from 'node:fs';
import path from 'node:path';

export type Screen = {
  name: string;
  light: string;
  dark: string;
  width: number;
  height: number;
};

let cache: Screen[] | undefined;

/**
 * The app's screenshots, a light and a dark capture of each page, mirrored
 * from the repository's public/screens/ by scripts/sync-content.mjs, which
 * also records each image's size in public/screens/manifest.json.
 */
export function screens(): Screen[] {
  if (!cache) {
    const manifest = path.join(process.cwd(), 'public/screens/manifest.json');
    cache = (JSON.parse(readFileSync(manifest, 'utf8')) as { screens: Screen[] }).screens;
  }
  return cache;
}

export function screenNamed(name: string): Screen {
  const found = screens().find((s) => s.name === name);
  if (!found) throw new Error('No screenshot called "' + name + '" in public/screens.');
  return found;
}
