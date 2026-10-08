// Field definitions for the two tables (assets and stock): how to read a
// value, how to show it, and which filters make sense. Filtering, sorting
// and search live here as pure functions so they can be tested and, later,
// sent to the API as the same filter objects.

import type { Asset, AssetStatus, Person, Place, Site, StockItem, ViewFilter, ViewSort } from './types';

export interface Lookups {
  people: Map<string, Person>;
  sites: Map<string, Site>;
  places: Map<string, Place>;
}

export const STATUS_LABEL: Record<AssetStatus, string> = {
  in_use: 'In use',
  available: 'Available',
  checked_out: 'Checked out',
  in_repair: 'In repair',
  missing: 'Missing',
  retired: 'Retired',
};

export const STATUS_ORDER: AssetStatus[] = ['in_use', 'available', 'checked_out', 'in_repair', 'missing', 'retired'];

export type FieldType = 'text' | 'enum' | 'date' | 'number' | 'person' | 'site' | 'place' | 'bool';

export interface FieldDef<T> {
  key: string;
  label: string;
  type: FieldType;
  /** The raw value used for filtering and sorting. */
  get: (row: T, l: Lookups) => string | number | undefined;
  /** What a person reads (site name rather than site id). */
  display?: (row: T, l: Lookups) => string;
  /** Choices for "is" filters. */
  options?: (rows: T[], l: Lookups) => { value: string; label: string }[];
}

const distinct = <T,>(rows: T[], get: (r: T) => string | undefined) =>
  Array.from(new Set(rows.map(get).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));

const siteOptions = (_: unknown, l: Lookups) =>
  Array.from(l.sites.values()).map((s) => ({ value: s.id, label: s.name }));

export const ASSET_FIELDS: FieldDef<Asset>[] = [
  { key: 'tag', label: 'Tag', type: 'text', get: (a) => a.tag },
  { key: 'name', label: 'Name', type: 'text', get: (a) => a.name },
  {
    key: 'category',
    label: 'Category',
    type: 'enum',
    get: (a) => a.category,
    options: (rows) => distinct(rows, (r) => r.category).map((v) => ({ value: v, label: v })),
  },
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    get: (a) => a.status,
    display: (a) => STATUS_LABEL[a.status],
    options: () => STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
  },
  { key: 'siteId', label: 'Site', type: 'site', get: (a) => a.siteId, display: (a, l) => l.sites.get(a.siteId)?.name ?? '', options: siteOptions },
  { key: 'placeId', label: 'Room or store', type: 'place', get: (a) => a.placeId, display: (a, l) => (a.placeId ? l.places.get(a.placeId)?.name ?? '' : '') },
  {
    key: 'custodianId',
    label: 'Custodian',
    type: 'person',
    get: (a) => a.custodianId,
    display: (a, l) => (a.custodianId ? l.people.get(a.custodianId)?.name ?? '' : ''),
    options: (_, l) => Array.from(l.people.values()).map((p) => ({ value: p.id, label: p.name })),
  },
  { key: 'dueBack', label: 'Due back', type: 'date', get: (a) => a.dueBack },
  { key: 'serial', label: 'Serial number', type: 'text', get: (a) => a.serial },
  { key: 'purchasedOn', label: 'Purchased', type: 'date', get: (a) => a.purchasedOn },
  { key: 'cost', label: 'Cost', type: 'number', get: (a) => a.cost },
  { key: 'updatedAt', label: 'Updated', type: 'date', get: (a) => a.updatedAt },
];

export const STOCK_FIELDS: FieldDef<StockItem>[] = [
  { key: 'sku', label: 'SKU', type: 'text', get: (k) => k.sku },
  { key: 'name', label: 'Name', type: 'text', get: (k) => k.name },
  {
    key: 'category',
    label: 'Category',
    type: 'enum',
    get: (k) => k.category,
    options: (rows) => distinct(rows, (r) => r.category).map((v) => ({ value: v, label: v })),
  },
  { key: 'siteId', label: 'Site', type: 'site', get: (k) => k.siteId, display: (k, l) => l.sites.get(k.siteId)?.name ?? '', options: siteOptions },
  { key: 'quantity', label: 'Quantity', type: 'number', get: (k) => k.quantity },
  { key: 'reorderAt', label: 'Reorder at', type: 'number', get: (k) => k.reorderAt },
  {
    key: 'belowReorder',
    label: 'Below reorder level',
    type: 'bool',
    get: (k) => (k.quantity <= k.reorderAt ? 'yes' : 'no'),
    options: () => [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  { key: 'expiresOn', label: 'Expires', type: 'date', get: (k) => k.expiresOn },
  { key: 'barcode', label: 'Barcode', type: 'text', get: (k) => k.barcode },
  { key: 'updatedAt', label: 'Updated', type: 'date', get: (k) => k.updatedAt },
];

/** "+60" means 60 days from `now`; anything else is taken as a date. */
export function resolveDate(value: string, now: Date = new Date()): string {
  const rel = /^([+-])(\d+)$/.exec(value.trim());
  if (rel) {
    const days = Number(rel[2]) * (rel[1] === '-' ? -1 : 1);
    return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  }
  return value;
}

export function matchesFilter<T>(row: T, filter: ViewFilter, fields: FieldDef<T>[], l: Lookups, now = new Date()): boolean {
  const field = fields.find((f) => f.key === filter.field);
  if (!field) return true;
  const raw = field.get(row, l);
  const shown = field.display ? field.display(row, l) : raw == null ? '' : String(raw);
  const value = filter.value ?? '';
  switch (filter.op) {
    case 'is':
      return value.split(',').some((v) => String(raw ?? '') === v);
    case 'is_not':
      return !value.split(',').some((v) => String(raw ?? '') === v);
    case 'contains':
      return shown.toLowerCase().includes(value.toLowerCase());
    case 'is_empty':
      return raw == null || raw === '';
    case 'not_empty':
      return raw != null && raw !== '';
    case 'lt':
      return typeof raw === 'number' && raw < Number(value);
    case 'lte':
      return typeof raw === 'number' && raw <= Number(value);
    case 'gt':
      return typeof raw === 'number' && raw > Number(value);
    case 'before':
      return typeof raw === 'string' && raw !== '' && raw.slice(0, 10) <= resolveDate(value, now);
    case 'after':
      return typeof raw === 'string' && raw !== '' && raw.slice(0, 10) >= resolveDate(value, now);
    default:
      return true;
  }
}

/** Free-text search over the columns a person would read. */
export function matchesSearch<T>(row: T, search: string, fields: FieldDef<T>[], l: Lookups): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields
    .filter((f) => f.type !== 'number' && f.type !== 'date')
    .map((f) => (f.display ? f.display(row, l) : String(f.get(row, l) ?? '')))
    .join(' ')
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function sortRows<T>(rows: T[], sort: ViewSort | undefined, fields: FieldDef<T>[], l: Lookups): T[] {
  if (!sort) return rows;
  const field = fields.find((f) => f.key === sort.field);
  if (!field) return rows;
  const dir = sort.dir === 'asc' ? 1 : -1;
  const value = (r: T) => (field.display && field.type !== 'date' ? field.display(r, l) : field.get(r, l));
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va == null || va === '') return 1;
    if (vb == null || vb === '') return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
  });
}

export function applyQuery<T>(
  rows: T[],
  q: { filters?: ViewFilter[]; search?: string; sort?: ViewSort },
  fields: FieldDef<T>[],
  l: Lookups,
  now = new Date(),
): T[] {
  const filtered = rows.filter(
    (r) => (q.filters ?? []).every((f) => matchesFilter(r, f, fields, l, now)) && matchesSearch(r, q.search ?? '', fields, l),
  );
  return sortRows(filtered, q.sort, fields, l);
}

/** A filter written out for a chip: "Status is Checked out". */
export function describeFilter<T>(filter: ViewFilter, fields: FieldDef<T>[], rows: T[], l: Lookups): string {
  const field = fields.find((f) => f.key === filter.field);
  if (!field) return '';
  const opts = field.options?.(rows, l) ?? [];
  const values = (filter.value ?? '')
    .split(',')
    .filter(Boolean)
    .map((v) => opts.find((o) => o.value === v)?.label ?? v);
  const list = values.length > 1 ? `${values.slice(0, -1).join(', ')} or ${values[values.length - 1]}` : values[0] ?? '';
  const rel = (v: string) => (/^[+-]\d+$/.test(v) ? (v.startsWith('+') ? `${v.slice(1)} days from today` : `${v.slice(1)} days ago`) : v);
  switch (filter.op) {
    case 'is':
      return `${field.label} is ${list}`;
    case 'is_not':
      return `${field.label} is not ${list}`;
    case 'contains':
      return `${field.label} contains "${filter.value}"`;
    case 'is_empty':
      return `${field.label} is empty`;
    case 'not_empty':
      return `${field.label} is set`;
    case 'lt':
      return `${field.label} under ${filter.value}`;
    case 'lte':
      return `${field.label} at most ${filter.value}`;
    case 'gt':
      return `${field.label} over ${filter.value}`;
    case 'before':
      return `${field.label} before ${rel(filter.value ?? '')}`;
    case 'after':
      return `${field.label} after ${rel(filter.value ?? '')}`;
    default:
      return field.label;
  }
}
