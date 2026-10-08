// Spreadsheet import, the pure part: guess which column is which, turn each
// row into a typed record, and say exactly what is wrong with each cell
// before anything is written. The file reading lives in lib/sheet.ts.

import { STATUS_LABEL, STATUS_ORDER } from './fields';
import type { AssetInput, StockInput } from './repository';
import { ean13CheckDigit } from './seed';
import type { Asset, AssetStatus, Person, Place, Site, StockItem } from './types';

export type ImportTarget = 'assets' | 'stock';

export interface TargetField {
  key: string;
  label: string;
  required?: boolean;
  /** Header spellings that map here automatically (compared normalised). */
  synonyms: string[];
  hint?: string;
}

export const TARGET_FIELDS: Record<ImportTarget, TargetField[]> = {
  assets: [
    { key: 'tag', label: 'Tag', synonyms: ['tag', 'assettag', 'tagno', 'tagnumber', 'assetno', 'assetnumber', 'assetid', 'barcode', 'code'], hint: 'Leave empty to get the next free tag' },
    { key: 'name', label: 'Name', required: true, synonyms: ['name', 'item', 'description', 'assetname', 'itemname', 'asset'] },
    { key: 'category', label: 'Category', required: true, synonyms: ['category', 'type', 'class', 'assettype', 'group'] },
    { key: 'site', label: 'Site', required: true, synonyms: ['site', 'location', 'branch', 'office', 'facility', 'sitename', 'building'], hint: 'Site name or code' },
    { key: 'room', label: 'Room or store', synonyms: ['room', 'store', 'area', 'department', 'roomname', 'sublocation'] },
    { key: 'status', label: 'Status', synonyms: ['status', 'condition', 'state'] },
    { key: 'model', label: 'Model', synonyms: ['model', 'make', 'makemodel', 'brand'] },
    { key: 'serial', label: 'Serial number', synonyms: ['serial', 'serialno', 'serialnumber', 'sn'] },
    { key: 'custodian', label: 'Custodian', synonyms: ['custodian', 'assignedto', 'user', 'holder', 'owner', 'issuedto'] },
    { key: 'purchased', label: 'Purchased', synonyms: ['purchased', 'purchasedate', 'dateofpurchase', 'acquired', 'date', 'datepurchased'] },
    { key: 'cost', label: 'Cost', synonyms: ['cost', 'price', 'value', 'purchaseprice', 'amount', 'costbwp', 'costp'] },
    { key: 'notes', label: 'Notes', synonyms: ['notes', 'comment', 'comments', 'remarks'] },
  ],
  stock: [
    { key: 'sku', label: 'SKU', required: true, synonyms: ['sku', 'itemcode', 'code', 'productcode', 'partno', 'stockcode'] },
    { key: 'name', label: 'Name', required: true, synonyms: ['name', 'item', 'description', 'product', 'itemname'] },
    { key: 'category', label: 'Category', synonyms: ['category', 'type', 'group'] },
    { key: 'site', label: 'Site', required: true, synonyms: ['site', 'location', 'store', 'branch', 'warehouse'] },
    { key: 'unit', label: 'Unit', synonyms: ['unit', 'uom', 'unitofmeasure', 'pack'] },
    { key: 'quantity', label: 'Quantity', required: true, synonyms: ['quantity', 'qty', 'onhand', 'stock', 'count', 'balance'] },
    { key: 'reorder', label: 'Reorder at', synonyms: ['reorder', 'reorderat', 'reorderlevel', 'minimum', 'min', 'minstock'] },
    { key: 'barcode', label: 'Barcode (EAN-13)', synonyms: ['barcode', 'ean', 'ean13', 'gtin', 'upc'] },
    { key: 'batch', label: 'Batch', synonyms: ['batch', 'lot', 'batchno', 'lotno'] },
    { key: 'expires', label: 'Expires', synonyms: ['expires', 'expiry', 'expirydate', 'bestbefore', 'expdate'] },
  ],
};

export const normaliseHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Column index per target field, guessed from the headers. */
export function guessMapping(headers: string[], target: ImportTarget): Record<string, number | null> {
  const used = new Set<number>();
  const out: Record<string, number | null> = {};
  for (const field of TARGET_FIELDS[target]) {
    const i = headers.findIndex((h, idx) => !used.has(idx) && field.synonyms.includes(normaliseHeader(h)));
    out[field.key] = i >= 0 ? i : null;
    if (i >= 0) used.add(i);
  }
  return out;
}

export interface Problem {
  field: string;
  message: string;
}

export interface RowCheck<T> {
  /** Row number as the person sees it in the spreadsheet (header is row 1). */
  rowNumber: number;
  cells: Record<string, string>;
  value: T | null;
  errors: Problem[];
  warnings: Problem[];
  duplicate: 'register' | 'file' | null;
}

export interface ImportContext {
  sites: Site[];
  places: Place[];
  people: Person[];
  assets: Pick<Asset, 'tag'>[];
  stock: Pick<StockItem, 'sku' | 'siteId'>[];
}

const text = (v: unknown) => (v == null ? '' : String(v).trim());

/** Dates arrive as ISO text, day/month/year text, or Excel serial numbers. */
export function parseDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{4,5}(\.\d+)?$/.test(v)) {
    const serial = Number(v);
    if (serial > 20000 && serial < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000);
      return d.toISOString().slice(0, 10);
    }
  }
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

export function parseNumber(raw: string): number | null {
  const v = raw.replace(/[\s,]/g, '').replace(/^(P|BWP)/i, '');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function findSite(sites: Site[], raw: string) {
  const v = raw.toLowerCase();
  return sites.find((s) => s.name.toLowerCase() === v || s.code.toLowerCase() === v || s.id === raw);
}

function cellsOf(row: unknown[], mapping: Record<string, number | null>) {
  const cells: Record<string, string> = {};
  for (const [key, idx] of Object.entries(mapping)) cells[key] = idx == null ? '' : text(row[idx]);
  return cells;
}

const STATUS_BY_LABEL = new Map<string, AssetStatus>([
  ...STATUS_ORDER.map((s) => [STATUS_LABEL[s].toLowerCase(), s] as [string, AssetStatus]),
  ...STATUS_ORDER.map((s) => [s, s] as [string, AssetStatus]),
  ['in service', 'in_use'],
  ['active', 'in_use'],
  ['spare', 'available'],
  ['broken', 'in_repair'],
  ['faulty', 'in_repair'],
  ['lost', 'missing'],
  ['stolen', 'missing'],
  ['disposed', 'retired'],
  ['written off', 'retired'],
]);

export function checkAssetRows(rows: unknown[][], mapping: Record<string, number | null>, ctx: ImportContext, firstRowNumber = 2): RowCheck<AssetInput>[] {
  const existing = new Set(ctx.assets.map((a) => a.tag.toLowerCase()));
  const seen = new Map<string, number>();
  return rows.map((row, i) => {
    const cells = cellsOf(row, mapping);
    const errors: Problem[] = [];
    const warnings: Problem[] = [];
    if (!cells.name) errors.push({ field: 'name', message: 'Name is empty' });
    for (const [field, v] of Object.entries(cells)) {
      if (/^[=+@]/.test(v)) warnings.push({ field, message: 'Looks like a formula; it is stored as plain text and neutralised in exports' });
    }
    if (!cells.category) errors.push({ field: 'category', message: 'Category is empty' });
    const site = cells.site ? findSite(ctx.sites, cells.site) : undefined;
    if (!cells.site) errors.push({ field: 'site', message: 'Site is empty' });
    else if (!site) errors.push({ field: 'site', message: `No site called "${cells.site}". Add the site first, or fix the name.` });
    let placeId: string | undefined;
    if (cells.room && site) {
      placeId = ctx.places.find((p) => p.siteId === site.id && p.name.toLowerCase() === cells.room.toLowerCase())?.id;
      if (!placeId) warnings.push({ field: 'room', message: `No room "${cells.room}" at ${site.name}; it will be left empty` });
    }
    let status: AssetStatus = 'in_use';
    if (cells.status) {
      const s = STATUS_BY_LABEL.get(cells.status.toLowerCase());
      if (!s) errors.push({ field: 'status', message: `Unknown status "${cells.status}". Use one of: ${STATUS_ORDER.map((x) => STATUS_LABEL[x]).join(', ')}` });
      else if (s === 'checked_out') warnings.push({ field: 'status', message: 'Imported as In use: check it out in Tagwise so it has a due date' });
      else status = s;
    }
    let custodianId: string | undefined;
    if (cells.custodian) {
      custodianId = ctx.people.find((p) => p.name.toLowerCase() === cells.custodian.toLowerCase())?.id;
      if (!custodianId) warnings.push({ field: 'custodian', message: `"${cells.custodian}" is not in the people list; custodian left empty` });
    }
    let purchasedOn: string | undefined;
    if (cells.purchased) {
      const d = parseDate(cells.purchased);
      if (!d) errors.push({ field: 'purchased', message: `"${cells.purchased}" is not a date. Use 2025-03-14 or 14/03/2025` });
      else purchasedOn = d;
    }
    let cost: number | undefined;
    if (cells.cost) {
      const n = parseNumber(cells.cost);
      if (n == null) errors.push({ field: 'cost', message: `"${cells.cost}" is not a number` });
      else if (n < 0) errors.push({ field: 'cost', message: 'Cost cannot be negative' });
      else cost = n;
    }
    let duplicate: RowCheck<AssetInput>['duplicate'] = null;
    if (cells.tag) {
      const key = cells.tag.toLowerCase();
      if (seen.has(key)) {
        duplicate = 'file';
        errors.push({ field: 'tag', message: `Tag ${cells.tag} is already on row ${seen.get(key)} of this file` });
      } else {
        seen.set(key, firstRowNumber + i);
        if (existing.has(key)) duplicate = 'register';
      }
    }
    const value: AssetInput | null =
      errors.length || !site
        ? null
        : {
            tag: cells.tag || undefined,
            name: cells.name,
            category: cells.category,
            model: cells.model || undefined,
            serial: cells.serial || undefined,
            siteId: site.id,
            placeId,
            status,
            custodianId,
            purchasedOn,
            cost,
            notes: cells.notes || undefined,
          };
    return { rowNumber: firstRowNumber + i, cells, value, errors, warnings, duplicate };
  });
}

export function checkStockRows(rows: unknown[][], mapping: Record<string, number | null>, ctx: ImportContext, firstRowNumber = 2): RowCheck<StockInput>[] {
  const existing = new Set(ctx.stock.map((k) => `${k.sku.toLowerCase()}@${k.siteId}`));
  const seen = new Map<string, number>();
  return rows.map((row, i) => {
    const cells = cellsOf(row, mapping);
    const errors: Problem[] = [];
    const warnings: Problem[] = [];
    if (!cells.sku) errors.push({ field: 'sku', message: 'SKU is empty' });
    if (!cells.name) errors.push({ field: 'name', message: 'Name is empty' });
    const site = cells.site ? findSite(ctx.sites, cells.site) : undefined;
    if (!cells.site) errors.push({ field: 'site', message: 'Site is empty' });
    else if (!site) errors.push({ field: 'site', message: `No site called "${cells.site}"` });
    const qty = parseNumber(cells.quantity ?? '');
    if (cells.quantity === '' || cells.quantity == null) errors.push({ field: 'quantity', message: 'Quantity is empty' });
    else if (qty == null || !Number.isInteger(qty)) errors.push({ field: 'quantity', message: `"${cells.quantity}" is not a whole number` });
    else if (qty < 0) errors.push({ field: 'quantity', message: 'Quantity cannot be negative' });
    const reorder = cells.reorder ? parseNumber(cells.reorder) : 0;
    if (cells.reorder && (reorder == null || reorder < 0)) errors.push({ field: 'reorder', message: `"${cells.reorder}" is not a valid reorder level` });
    if (cells.barcode && !(/^\d{13}$/.test(cells.barcode) && ean13CheckDigit(cells.barcode.slice(0, 12)) === Number(cells.barcode[12]))) {
      errors.push({ field: 'barcode', message: `"${cells.barcode}" is not a valid EAN-13 (13 digits with a correct check digit)` });
    }
    let expiresOn: string | undefined;
    if (cells.expires) {
      const d = parseDate(cells.expires);
      if (!d) errors.push({ field: 'expires', message: `"${cells.expires}" is not a date` });
      else expiresOn = d;
    }
    if (!cells.unit) warnings.push({ field: 'unit', message: 'No unit; "each" will be used' });
    let duplicate: RowCheck<StockInput>['duplicate'] = null;
    if (cells.sku && site) {
      const key = `${cells.sku.toLowerCase()}@${site.id}`;
      if (seen.has(key)) {
        duplicate = 'file';
        errors.push({ field: 'sku', message: `${cells.sku} at ${site.name} is already on row ${seen.get(key)} of this file` });
      } else {
        seen.set(key, firstRowNumber + i);
        if (existing.has(key)) duplicate = 'register';
      }
    }
    const value: StockInput | null =
      errors.length || !site || qty == null
        ? null
        : {
            sku: cells.sku,
            name: cells.name,
            category: cells.category || 'General',
            unit: cells.unit || 'each',
            siteId: site.id,
            quantity: qty,
            reorderAt: reorder ?? 0,
            barcode: cells.barcode || '',
            batch: cells.batch || undefined,
            expiresOn,
          };
    return { rowNumber: firstRowNumber + i, cells, value, errors, warnings, duplicate };
  });
}

/** One line per problem, for the downloadable error report. */
export function problemReport<T>(checks: RowCheck<T>[], target: ImportTarget): string[][] {
  const label = (k: string) => TARGET_FIELDS[target].find((f) => f.key === k)?.label ?? k;
  const out = [['Row', 'Column', 'Problem', 'Value in the file', 'Severity']];
  for (const c of checks) {
    for (const p of c.errors) out.push([String(c.rowNumber), label(p.field), p.message, c.cells[p.field] ?? '', 'Error: row not imported']);
    for (const p of c.warnings) out.push([String(c.rowNumber), label(p.field), p.message, c.cells[p.field] ?? '', 'Warning: row imported']);
  }
  return out;
}
