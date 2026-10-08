import { describe, expect, it } from 'vitest';
import { applyQuery, ASSET_FIELDS, describeFilter, resolveDate, type Lookups } from './fields';
import { LocalRepository, normaliseCode, type Store } from './local';
import { createSeed, ean13CheckDigit } from './seed';
import type { Db } from './types';

function memoryStore(): Store {
  let db: Db | null = null;
  return {
    load: () => (db ? structuredClone(db) : null),
    save: (next) => {
      db = structuredClone(next);
    },
    clear: () => {
      db = null;
    },
  };
}

const seed = createSeed(new Date('2026-10-07T09:00:00Z'));
const lookups: Lookups = {
  people: new Map(seed.people.map((p) => [p.id, p])),
  sites: new Map(seed.sites.map((s) => [s.id, s])),
  places: new Map(seed.places.map((p) => [p.id, p])),
};

describe('seed', () => {
  it('is deterministic for the same moment', () => {
    const again = createSeed(new Date('2026-10-07T09:00:00Z'));
    expect(again.assets.map((a) => a.tag)).toEqual(seed.assets.map((a) => a.tag));
  });
  it('has unique tags and valid EAN-13 barcodes', () => {
    expect(new Set(seed.assets.map((a) => a.tag)).size).toBe(seed.assets.length);
    for (const k of seed.stock) expect(ean13CheckDigit(k.barcode.slice(0, 12))).toBe(Number(k.barcode[12]));
  });
  it('uses the reserved example domain for every email', () => {
    for (const p of seed.people) if (p.email) expect(p.email.endsWith('.example')).toBe(true);
  });
});

describe('filters', () => {
  it('filters by status with several values', () => {
    const rows = applyQuery(seed.assets, { filters: [{ field: 'status', op: 'is', value: 'in_repair,missing' }] }, ASSET_FIELDS, lookups);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((a) => a.status === 'in_repair' || a.status === 'missing')).toBe(true);
  });
  it('searches across displayed values such as site names', () => {
    const rows = applyQuery(seed.assets, { search: 'mochudi projector' }, ASSET_FIELDS, lookups);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((a) => a.siteId === 's-mochudi' && a.category === 'Projector')).toBe(true);
  });
  it('resolves relative dates', () => {
    expect(resolveDate('+10', new Date('2026-10-07T00:00:00Z'))).toBe('2026-10-17');
  });
  it('describes a filter in words', () => {
    expect(describeFilter({ field: 'status', op: 'is', value: 'in_repair,missing' }, ASSET_FIELDS, seed.assets, lookups)).toBe(
      'Status is In repair or Missing',
    );
  });
});

describe('LocalRepository', () => {
  it('rejects a stale edit as a conflict instead of overwriting', async () => {
    const r = new LocalRepository(memoryStore());
    const [a] = await r.assets();
    const first = await r.updateAsset(a.id, { notes: 'first' }, a.version, 'p-kagiso');
    expect(first.ok).toBe(true);
    const stale = await r.updateAsset(a.id, { notes: 'second' }, a.version, 'p-naledi');
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.reason).toBe('conflict');
  });
  it('finds an asset from a label URL', async () => {
    const r = new LocalRepository(memoryStore());
    const [a] = await r.assets();
    const hit = await r.lookup(`https://tagwise.example/s/${a.tag}`);
    expect(hit.kind).toBe('asset');
    expect(normaliseCode(' MCT-00001 ')).toBe('MCT-00001');
  });
  it('will not issue more stock than is on hand', async () => {
    const r = new LocalRepository(memoryStore());
    const [k] = await r.stock();
    const res = await r.adjustStock(k.id, -(k.quantity + 1), 'test', 'p-kagiso');
    expect(res.ok).toBe(false);
  });
  it('records count scans as found, repeat or unknown', async () => {
    const r = new LocalRepository(memoryStore());
    const count = await r.startCount({ name: 'Test', siteId: 's-hq', placeIds: [] }, 'p-lesego');
    const target = (await r.asset(count.expected[0].assetId))!;
    expect((await r.recordScan(count.id, target.tag, undefined, 'p-lesego')).result).toBe('found');
    expect((await r.recordScan(count.id, target.tag, undefined, 'p-naledi')).result).toBe('repeat');
    expect((await r.recordScan(count.id, 'NOPE-1', undefined, 'p-naledi')).result).toBe('unknown');
  });
  it('skips duplicates on import when asked', async () => {
    const r = new LocalRepository(memoryStore());
    const [a] = await r.assets();
    const { id: _id, createdAt: _c, updatedAt: _u, updatedBy: _b, version: _v, ...row } = a;
    const summary = await r.importAssets([row, { ...row, tag: undefined, name: 'New chair' }], 'skip', 'test.csv', 'p-kagiso');
    expect(summary).toEqual({ created: 1, updated: 0, skipped: 1 });
  });
});
