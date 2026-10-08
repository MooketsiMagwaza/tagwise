// The browser-storage implementation of Repository. The whole workspace is
// one JSON document in localStorage, seeded with the sample trust on first
// use. Every write re-reads storage first (so a write from another tab is
// never lost), checks versions, appends to the activity log, saves, and tells
// other tabs over BroadcastChannel.

import { applyQuery, ASSET_FIELDS, STATUS_LABEL, STOCK_FIELDS, type Lookups } from './fields';
import { broadcast, onLive, tabId } from './live';
import type { ActivityQuery, AssetInput, CountDetail, DuplicateMode, ImportSummary, LookupResult, Repository, SaveResult, StockInput, TableQuery } from './repository';
import { createSeed, SCHEMA } from './seed';
import type { Activity, Asset, Change, Comment, CountScan, CountSession, Db, Person, Role, SavedView, StockItem } from './types';

const KEY = 'tagwise.db.v1';

export interface Store {
  load(): Db | null;
  save(db: Db): void;
  clear(): void;
}

export function browserStore(): Store {
  let memory: Db | null = null;
  const ls = typeof localStorage !== 'undefined' ? localStorage : null;
  return {
    load() {
      try {
        const raw = ls?.getItem(KEY);
        if (raw) return JSON.parse(raw) as Db;
      } catch {
        /* fall back to memory */
      }
      return memory ? (structuredClone(memory) as Db) : null;
    },
    save(db) {
      memory = db;
      try {
        ls?.setItem(KEY, JSON.stringify(db));
      } catch {
        /* storage full or blocked: keep working in memory for this tab */
      }
    },
    clear() {
      memory = null;
      try {
        ls?.removeItem(KEY);
      } catch {
        /* nothing to clear */
      }
    },
  };
}

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nowIso = () => new Date().toISOString();

/** Pull a tag out of whatever a scanner read: a bare code, or a label URL
 *  such as https://example.com/s/MCT-00042. */
export function normaliseCode(raw: string): string {
  const value = raw.trim();
  try {
    if (/^https?:\/\//i.test(value)) {
      const parts = new URL(value).pathname.split('/').filter(Boolean);
      return decodeURIComponent(parts[parts.length - 1] ?? value);
    }
  } catch {
    /* not a URL */
  }
  return value;
}

export class LocalRepository implements Repository {
  private db: Db;
  private listeners = new Set<() => void>();

  constructor(private store: Store = browserStore()) {
    const existing = store.load();
    if (existing && existing.schema === SCHEMA) this.db = existing;
    else {
      this.db = createSeed();
      store.save(this.db);
    }
    onLive((m) => {
      if (m.type === 'db') this.reloadFromStore();
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === KEY) this.reloadFromStore();
      });
    }
  }

  private reloadFromStore() {
    const fresh = this.store.load();
    if (fresh) this.db = fresh;
    this.emit();
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Apply a change to the latest stored state, save it and tell everyone. */
  private mutate<T>(fn: (db: Db) => T): T {
    const fresh = this.store.load();
    if (fresh && fresh.schema === SCHEMA) this.db = fresh;
    const result = fn(this.db);
    this.store.save(this.db);
    broadcast({ type: 'db', from: tabId });
    this.emit();
    return result;
  }

  private lookups(): Lookups {
    return {
      people: new Map(this.db.people.map((p) => [p.id, p])),
      sites: new Map(this.db.sites.map((s) => [s.id, s])),
      places: new Map(this.db.places.map((p) => [p.id, p])),
    };
  }

  private log(db: Db, a: Omit<Activity, 'id' | 'at'>) {
    db.activity.unshift({ id: uid('e'), at: nowIso(), ...a });
  }

  private nextTag(db: Db): string {
    const prefix = db.workspace.tagPrefix;
    const max = db.assets.reduce((m, a) => {
      const n = Number(a.tag.split('-').pop());
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return `${prefix}-${String(max + 1).padStart(5, '0')}`;
  }

  // ── reads ────────────────────────────────────────────────────────────
  async workspace() {
    return this.db.workspace;
  }
  async people() {
    return this.db.people;
  }
  async sites() {
    return this.db.sites;
  }
  async places() {
    return this.db.places;
  }
  async assets(q: TableQuery = {}) {
    return applyQuery(this.db.assets, q, ASSET_FIELDS, this.lookups());
  }
  async asset(idOrTag: string) {
    const key = normaliseCode(idOrTag).toLowerCase();
    return this.db.assets.find((a) => a.id === idOrTag || a.tag.toLowerCase() === key) ?? null;
  }
  async stock(q: TableQuery = {}) {
    return applyQuery(this.db.stock, q, STOCK_FIELDS, this.lookups());
  }
  async stockItem(id: string) {
    return this.db.stock.find((k) => k.id === id) ?? null;
  }
  async lookup(raw: string): Promise<LookupResult> {
    const code = normaliseCode(raw);
    const lower = code.toLowerCase();
    const asset = this.db.assets.find((a) => a.tag.toLowerCase() === lower || a.serial?.toLowerCase() === lower);
    if (asset) return { kind: 'asset', asset };
    const item = this.db.stock.find((k) => k.barcode === code || k.sku.toLowerCase() === lower);
    if (item) return { kind: 'stock', item };
    return { kind: 'none', code };
  }
  async comments(targetType: Comment['targetType'], targetId: string) {
    return this.db.comments.filter((c) => c.targetType === targetType && c.targetId === targetId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async activity(q: ActivityQuery = {}) {
    const rows = this.db.activity.filter(
      (a) =>
        (!q.targetType || a.targetType === q.targetType) &&
        (!q.targetId || a.targetId === q.targetId) &&
        (!q.kinds || q.kinds.includes(a.kind)) &&
        (!q.actorId || a.actorId === q.actorId),
    );
    return q.limit ? rows.slice(0, q.limit) : rows;
  }
  async views(collection: SavedView['collection']) {
    return this.db.views.filter((v) => v.collection === collection);
  }
  async counts() {
    return [...this.db.counts].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async count(id: string): Promise<CountDetail | null> {
    const session = this.db.counts.find((c) => c.id === id);
    if (!session) return null;
    return { session, scans: this.db.scans.filter((s) => s.countId === id).sort((a, b) => b.at.localeCompare(a.at)) };
  }

  // ── writes ───────────────────────────────────────────────────────────
  async createAsset(input: AssetInput, actorId: string) {
    return this.mutate((db) => {
      const at = nowIso();
      const asset: Asset = { ...input, tag: input.tag?.trim() || this.nextTag(db), id: uid('a'), createdAt: at, updatedAt: at, updatedBy: actorId, version: 1 };
      db.assets.unshift(asset);
      this.log(db, { actorId, kind: 'created', targetType: 'asset', targetId: asset.id, targetLabel: `${asset.tag} ${asset.name}`, summary: 'Added to the register' });
      return asset;
    });
  }

  private describeChanges(before: Asset, after: Asset): Change[] {
    const l = this.lookups();
    const show = (key: keyof Asset, a: Asset) => {
      const v = a[key];
      if (v == null || v === '') return 'empty';
      if (key === 'status') return STATUS_LABEL[v as Asset['status']];
      if (key === 'siteId') return l.sites.get(String(v))?.name ?? String(v);
      if (key === 'placeId') return l.places.get(String(v))?.name ?? String(v);
      if (key === 'custodianId') return l.people.get(String(v))?.name ?? String(v);
      return String(v);
    };
    const labels: Partial<Record<keyof Asset, string>> = {
      name: 'Name', category: 'Category', model: 'Model', serial: 'Serial number', siteId: 'Site', placeId: 'Room or store',
      status: 'Status', custodianId: 'Custodian', dueBack: 'Due back', purchasedOn: 'Purchased', cost: 'Cost', notes: 'Notes', tag: 'Tag',
    };
    return (Object.keys(labels) as (keyof Asset)[])
      .filter((k) => (before[k] ?? '') !== (after[k] ?? ''))
      .map((k) => ({ field: labels[k]!, from: show(k, before), to: show(k, after) }));
  }

  async updateAsset(id: string, patch: Partial<AssetInput>, expectedVersion: number, actorId: string): Promise<SaveResult<Asset>> {
    return this.mutate((db) => {
      const i = db.assets.findIndex((a) => a.id === id);
      if (i < 0) return { ok: false, reason: 'not_found', message: 'This asset no longer exists.' };
      const before = db.assets[i];
      if (before.version !== expectedVersion) return { ok: false, reason: 'conflict', current: before };
      const after: Asset = { ...before, ...patch, id, updatedAt: nowIso(), updatedBy: actorId, version: before.version + 1 };
      const changes = this.describeChanges(before, after);
      if (!changes.length) return { ok: true, value: before };
      db.assets[i] = after;
      const moved = changes.some((c) => c.field === 'Room or store' || c.field === 'Site');
      this.log(db, {
        actorId,
        kind: moved && changes.length === 1 ? 'moved' : 'updated',
        targetType: 'asset',
        targetId: id,
        targetLabel: `${after.tag} ${after.name}`,
        summary: moved && changes.length === 1 ? `Moved to ${changes[0].to}` : changes.length === 1 ? `${changes[0].field} changed` : `${changes.length} fields changed`,
        changes,
      });
      return { ok: true, value: after };
    });
  }

  async checkOut(id: string, custodianId: string, dueBack: string, actorId: string): Promise<SaveResult<Asset>> {
    return this.mutate((db) => {
      const a = db.assets.find((x) => x.id === id);
      if (!a) return { ok: false, reason: 'not_found', message: 'This asset no longer exists.' };
      if (a.status === 'checked_out') return { ok: false, reason: 'invalid', message: 'It is already checked out.' };
      Object.assign(a, { status: 'checked_out', custodianId, dueBack, updatedAt: nowIso(), updatedBy: actorId, version: a.version + 1 });
      const who = db.people.find((p) => p.id === custodianId)?.name ?? 'someone';
      this.log(db, { actorId, kind: 'checked_out', targetType: 'asset', targetId: id, targetLabel: `${a.tag} ${a.name}`, summary: `Checked out to ${who}, due back ${dueBack}` });
      return { ok: true, value: { ...a } };
    });
  }

  async checkIn(id: string, actorId: string): Promise<SaveResult<Asset>> {
    return this.mutate((db) => {
      const a = db.assets.find((x) => x.id === id);
      if (!a) return { ok: false, reason: 'not_found', message: 'This asset no longer exists.' };
      const who = db.people.find((p) => p.id === a.custodianId)?.name ?? 'someone';
      Object.assign(a, { status: 'available', custodianId: undefined, dueBack: undefined, updatedAt: nowIso(), updatedBy: actorId, version: a.version + 1 });
      this.log(db, { actorId, kind: 'returned', targetType: 'asset', targetId: id, targetLabel: `${a.tag} ${a.name}`, summary: `Returned by ${who}` });
      return { ok: true, value: { ...a } };
    });
  }

  async adjustStock(id: string, delta: number, reason: string, actorId: string): Promise<SaveResult<StockItem>> {
    return this.mutate((db) => {
      const k = db.stock.find((x) => x.id === id);
      if (!k) return { ok: false, reason: 'not_found', message: 'This stock line no longer exists.' };
      if (!Number.isInteger(delta) || delta === 0) return { ok: false, reason: 'invalid', message: 'Enter a whole number other than zero.' };
      if (k.quantity + delta < 0) return { ok: false, reason: 'invalid', message: `Only ${k.quantity} ${k.unit} on hand.` };
      Object.assign(k, { quantity: k.quantity + delta, updatedAt: nowIso(), updatedBy: actorId, version: k.version + 1 });
      const what = delta > 0 ? `Received ${delta} ${k.unit}` : `Issued ${-delta} ${k.unit}`;
      this.log(db, { actorId, kind: 'stock_adjusted', targetType: 'stock', targetId: id, targetLabel: `${k.sku} ${k.name}`, summary: reason ? `${what}: ${reason}` : what });
      return { ok: true, value: { ...k } };
    });
  }

  async addComment(targetType: Comment['targetType'], targetId: string, body: string, actorId: string) {
    return this.mutate((db) => {
      const comment: Comment = { id: uid('c'), targetType, targetId, authorId: actorId, body: body.trim(), createdAt: nowIso() };
      db.comments.push(comment);
      const target = targetType === 'asset' ? db.assets.find((a) => a.id === targetId) : undefined;
      const item = targetType === 'stock' ? db.stock.find((k) => k.id === targetId) : undefined;
      this.log(db, {
        actorId,
        kind: 'commented',
        targetType,
        targetId,
        targetLabel: target ? `${target.tag} ${target.name}` : item ? `${item.sku} ${item.name}` : undefined,
        summary: comment.body,
      });
      return comment;
    });
  }

  async saveView(view: Omit<SavedView, 'id'> & { id?: string }, actorId: string) {
    return this.mutate((db) => {
      const saved: SavedView = { ...view, id: view.id ?? uid('v'), createdBy: view.createdBy ?? actorId };
      const i = db.views.findIndex((v) => v.id === saved.id);
      if (i >= 0) db.views[i] = saved;
      else {
        db.views.push(saved);
        this.log(db, { actorId, kind: 'view_saved', targetType: 'workspace', summary: `Saved the view "${saved.name}"` });
      }
      return saved;
    });
  }

  async deleteView(id: string) {
    this.mutate((db) => {
      db.views = db.views.filter((v) => v.id !== id || v.builtIn);
    });
  }

  async importAssets(rows: AssetInput[], mode: DuplicateMode, fileName: string, actorId: string): Promise<ImportSummary> {
    return this.mutate((db) => {
      const summary: ImportSummary = { created: 0, updated: 0, skipped: 0 };
      const at = nowIso();
      for (const row of rows) {
        const existing = row.tag ? db.assets.find((a) => a.tag.toLowerCase() === row.tag!.toLowerCase()) : undefined;
        if (existing && mode === 'skip') {
          summary.skipped += 1;
        } else if (existing && mode === 'update') {
          Object.assign(existing, { ...row, tag: existing.tag, updatedAt: at, updatedBy: actorId, version: existing.version + 1 });
          summary.updated += 1;
        } else {
          const tag = existing || !row.tag ? this.nextTag(db) : row.tag;
          db.assets.unshift({ ...row, tag, id: uid('a'), createdAt: at, updatedAt: at, updatedBy: actorId, version: 1 });
          summary.created += 1;
        }
      }
      this.log(db, {
        actorId,
        kind: 'imported',
        targetType: 'workspace',
        summary: `Imported assets from ${fileName}: ${summary.created} added, ${summary.updated} updated, ${summary.skipped} skipped`,
      });
      return summary;
    });
  }

  async importStock(rows: StockInput[], mode: DuplicateMode, fileName: string, actorId: string): Promise<ImportSummary> {
    return this.mutate((db) => {
      const summary: ImportSummary = { created: 0, updated: 0, skipped: 0 };
      const at = nowIso();
      for (const row of rows) {
        const existing = db.stock.find((k) => k.sku.toLowerCase() === row.sku.toLowerCase() && k.siteId === row.siteId);
        if (existing && mode === 'skip') summary.skipped += 1;
        else if (existing && mode === 'update') {
          Object.assign(existing, { ...row, updatedAt: at, updatedBy: actorId, version: existing.version + 1 });
          summary.updated += 1;
        } else {
          db.stock.push({ ...row, id: uid('k'), updatedAt: at, updatedBy: actorId, version: 1 });
          summary.created += 1;
        }
      }
      this.log(db, {
        actorId,
        kind: 'imported',
        targetType: 'workspace',
        summary: `Imported stock from ${fileName}: ${summary.created} added, ${summary.updated} updated, ${summary.skipped} skipped`,
      });
      return summary;
    });
  }

  async startCount(input: { name: string; siteId: string; placeIds: string[] }, actorId: string) {
    return this.mutate((db) => {
      const expected = db.assets
        .filter((a) => a.siteId === input.siteId && a.status !== 'retired' && a.status !== 'checked_out')
        .filter((a) => !input.placeIds.length || (a.placeId && input.placeIds.includes(a.placeId)))
        .map((a) => ({ assetId: a.id, placeId: a.placeId }));
      const session: CountSession = { id: uid('count'), name: input.name, siteId: input.siteId, placeIds: input.placeIds, status: 'open', startedAt: nowIso(), startedBy: actorId, expected };
      db.counts.unshift(session);
      this.log(db, { actorId, kind: 'count_started', targetType: 'count', targetId: session.id, targetLabel: session.name, summary: `Started a stock-take of ${expected.length} assets` });
      return session;
    });
  }

  async recordScan(countId: string, raw: string, placeId: string | undefined, by: string): Promise<CountScan> {
    return this.mutate((db) => {
      const session = db.counts.find((c) => c.id === countId);
      const code = normaliseCode(raw);
      const asset = db.assets.find((a) => a.tag.toLowerCase() === code.toLowerCase());
      let result: CountScan['result'] = 'unknown';
      if (asset) {
        const already = db.scans.some((s) => s.countId === countId && s.assetId === asset.id && s.result !== 'repeat');
        const expected = session?.expected.find((e) => e.assetId === asset.id);
        if (already) result = 'repeat';
        else if (!expected) result = 'unexpected';
        else if (placeId && expected.placeId && placeId !== expected.placeId) result = 'wrong_place';
        else result = 'found';
      }
      const scan: CountScan = { id: uid('scan'), countId, code, assetId: asset?.id, placeId, by, at: nowIso(), result };
      if (session?.status === 'open') db.scans.push(scan);
      return scan;
    });
  }

  async closeCount(id: string, markMissing: boolean, actorId: string) {
    return this.mutate((db) => {
      const session = db.counts.find((c) => c.id === id);
      if (!session) throw new Error('Stock-take not found');
      const seen = new Set(db.scans.filter((s) => s.countId === id && s.assetId).map((s) => s.assetId));
      const missing = session.expected.filter((e) => !seen.has(e.assetId));
      if (markMissing) {
        for (const e of missing) {
          const a = db.assets.find((x) => x.id === e.assetId);
          if (!a || a.status === 'missing') continue;
          const from = STATUS_LABEL[a.status];
          Object.assign(a, { status: 'missing', updatedAt: nowIso(), updatedBy: actorId, version: a.version + 1 });
          this.log(db, { actorId, kind: 'updated', targetType: 'asset', targetId: a.id, targetLabel: `${a.tag} ${a.name}`, summary: 'Marked missing after the count', changes: [{ field: 'Status', from, to: 'Missing' }] });
        }
      }
      Object.assign(session, { status: 'closed', closedAt: nowIso(), closedBy: actorId });
      this.log(db, {
        actorId,
        kind: 'count_closed',
        targetType: 'count',
        targetId: id,
        targetLabel: session.name,
        summary: `Closed the stock-take: ${seen.size} found, ${missing.length} not found${markMissing && missing.length ? ' (marked missing)' : ''}`,
      });
      return { ...session };
    });
  }

  async setRole(personId: string, role: Role | undefined, actorId: string) {
    return this.mutate((db) => {
      const p = db.people.find((x) => x.id === personId);
      if (!p) throw new Error('Person not found');
      p.role = role;
      this.log(db, { actorId, kind: 'member_changed', targetType: 'member', targetId: p.id, targetLabel: p.name, summary: role ? `Role set to ${role}` : 'Removed from the workspace' });
      return { ...p };
    });
  }

  async invite(input: { name: string; email: string; role: Role; team: string }, actorId: string) {
    return this.mutate((db) => {
      const initials = input.name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
      const person: Person = { id: uid('p'), name: input.name.trim(), email: input.email.trim(), role: input.role, team: input.team || 'Invited', initials, hue: '#1d5bb8' };
      db.people.push(person);
      this.log(db, { actorId, kind: 'member_changed', targetType: 'member', targetId: person.id, targetLabel: person.name, summary: `Invited as ${input.role} (no email is sent in the prototype)` });
      return person;
    });
  }

  async logLabelsPrinted(assetIds: string[], actorId: string) {
    this.mutate((db) => {
      const first = db.assets.find((a) => a.id === assetIds[0]);
      this.log(db, {
        actorId,
        kind: 'labels_printed',
        targetType: assetIds.length === 1 ? 'asset' : 'workspace',
        targetId: assetIds.length === 1 ? assetIds[0] : undefined,
        targetLabel: assetIds.length === 1 && first ? `${first.tag} ${first.name}` : undefined,
        summary: assetIds.length === 1 ? 'Printed a label' : `Printed ${assetIds.length} labels`,
      });
    });
  }

  async renameWorkspace(name: string, actorId: string) {
    return this.mutate((db) => {
      db.workspace.name = name.trim() || db.workspace.name;
      this.log(db, { actorId, kind: 'updated', targetType: 'workspace', summary: `Renamed the workspace to ${db.workspace.name}` });
      return { ...db.workspace };
    });
  }

  async reset() {
    this.store.clear();
    this.db = createSeed();
    this.store.save(this.db);
    broadcast({ type: 'db', from: tabId });
    this.emit();
  }
}
