// Display formatters. Dates are shown the British way ("7 Oct 2026"), money in
// pula with a thin grouping space ("P 14 500").

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  if (diff < 2 * DAY) return 'yesterday';
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} days ago`;
  return shortDate(iso);
}

export function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Days from today to an ISO date (negative when it has passed). */
export function daysUntil(isoDate: string | undefined, now: Date = new Date()): number | null {
  if (!isoDate) return null;
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  const then = new Date(isoDate.slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.round((then - today) / DAY);
}

export function dueLabel(isoDate: string | undefined, now: Date = new Date()): string {
  const d = daysUntil(isoDate, now);
  if (d == null) return '';
  if (d < -1) return `${-d} days overdue`;
  if (d === -1) return '1 day overdue';
  if (d === 0) return 'due today';
  if (d === 1) return 'due tomorrow';
  return `due in ${d} days`;
}

export function money(amount: number | undefined): string {
  if (amount == null) return '';
  const nbsp = String.fromCharCode(160);
  const thin = String.fromCharCode(8201);
  return `P${nbsp}${Math.round(amount).toLocaleString('en-GB').replace(/,/g, thin)}`;
}

export function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
}
