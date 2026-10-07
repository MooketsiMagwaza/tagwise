import type { BadgeTone } from './IconBadge';

const TONES: BadgeTone[] = ['accent', 'indigo', 'warning', 'teal'];

/** A stable tone for a key (a SKU, say) so the same item always gets the same
 *  colour — a visual category marker, not decoration that shuffles. */
export function toneForKey(key: string): BadgeTone {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
