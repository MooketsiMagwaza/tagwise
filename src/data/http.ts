// The data layer over HTTP, against the register service (TW-15).
//
// SCAFFOLD. The app does not use this unless it is built with VITE_API_URL,
// and even then it cannot sign in yet: there is no sign-in screen, so no
// token. What the register API offers today is implemented and unit-tested
// against a fake server (http.test.ts); everything else rejects with
// NotAvailableYet, naming the method, so a missing piece is obvious rather
// than silently empty. Live updates are only this tab's own writes: the
// service has no websocket or event stream yet.

import { applyQuery, ASSET_FIELDS, STOCK_FIELDS, type Lookups } from './fields';
import { normaliseCode } from './local';
import type { ActivityQuery, AssetInput, CountDetail, DuplicateMode, ImportSummary, LookupResult, Repository, SaveResult, StockInput, TableQuery } from './repository';
import type {
  Activity,
  Asset,
  AssetStatus,
  Collection,
  Comment,
  CountScan,
  CountSession,
  Person,
  Place,
  Role,
  SavedView,
  ScanResult,
  Site,
  StockItem,
  Workspace,
} from './types';

export interface HttpOptions {
  /** Where the API is, for example `/api` behind the gateway. */
  baseUrl: string;
  /** The workspace this app is working in. */
  workspaceId: string;
  /** The signed-in account's access token, or null when signed out. */
  token: () => string | null;
  fetch?: typeof fetch;
}

/** A method the API cannot serve yet. */
export class NotAvailableYet extends Error {
  constructor(method: string) {
    super(`${method} is not available from the API yet (see TW-15)`);
    this.name = 'NotAvailableYet';
  }
}

/** A response the API answered with an error. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// The API's shapes: snake_case, as the register service sends them.
interface ApiWorkspace { id: string; name: string; tag_prefix: string; currency: string; created_at: string }
interface ApiSite { id: string; code: string; name: string; kind: Site['kind']; town: string; address: string; lat: number; lng: number }
interface ApiAsset {
  id: string; tag: string; name: string; category: string; model?: string | null; serial?: string | null;
  site_id: string; place_id?: string | null; status: AssetStatus; custodian_id?: string | null; due_back?: string | null;
  purchased_on?: string | null; notes?: string | null; updated_at: string; updated_by?: string | null; version: number;
}
interface ApiStock {
  id: string; site_id: string; place_id?: string | null; sku: string; barcode: string; name: string; category: string;
  unit: string; quantity: number; reorder_at: number; batch?: string | null; expires_on?: string | null; version: number;
  updated_at?: string; updated_by?: string | null;
}
interface ApiComment { id: string; target_type: Comment['targetType']; target_id: string; author_id: string; body: string; created_at: string }
interface ApiActivity {
  id: string; at: string; actor_id: string; kind: Activity['kind']; target_type?: Activity['targetType'] | null;
  target_id?: string | null; target_label?: string | null; summary: string; changes?: unknown;
}
interface ApiCount { id: string; site_id: string; name: string; status: CountSession['status']; started_at: string; started_by: string; closed_at?: string | null }

const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

export const fromApi = {
  workspace: (w: ApiWorkspace): Workspace => ({ id: w.id, name: w.name, tagPrefix: w.tag_prefix, currency: w.currency, createdAt: w.created_at }),
  site: (s: ApiSite): Site => ({ ...s }),
  asset: (a: ApiAsset): Asset => ({
    id: a.id,
    tag: a.tag,
    name: a.name,
    category: a.category,
    model: opt(a.model),
    serial: opt(a.serial),
    siteId: a.site_id,
    placeId: opt(a.place_id),
    status: a.status,
    custodianId: opt(a.custodian_id),
    dueBack: opt(a.due_back),
    purchasedOn: opt(a.purchased_on),
    notes: opt(a.notes),
    // The service does not send a creation time for assets yet.
    createdAt: a.updated_at,
    updatedAt: a.updated_at,
    updatedBy: a.updated_by ?? '',
    version: a.version,
  }),
  stock: (k: ApiStock): StockItem => ({
    id: k.id,
    sku: k.sku,
    barcode: k.barcode,
    name: k.name,
    category: k.category,
    unit: k.unit,
    siteId: k.site_id,
    placeId: opt(k.place_id),
    quantity: k.quantity,
    reorderAt: k.reorder_at,
    batch: opt(k.batch),
    expiresOn: opt(k.expires_on),
    updatedAt: k.updated_at ?? '',
    updatedBy: k.updated_by ?? '',
    version: k.version,
  }),
  comment: (c: ApiComment): Comment => ({ id: c.id, targetType: c.target_type, targetId: c.target_id, authorId: c.author_id, body: c.body, createdAt: c.created_at }),
  activity: (a: ApiActivity): Activity => ({
    id: a.id,
    at: a.at,
    actorId: a.actor_id,
    kind: a.kind,
    targetType: opt(a.target_type),
    targetId: opt(a.target_id),
    targetLabel: opt(a.target_label),
    summary: a.summary,
    changes: Array.isArray(a.changes) ? (a.changes as Activity['changes']) : undefined,
  }),
  count: (c: ApiCount): CountSession => ({
    id: c.id,
    name: c.name,
    siteId: c.site_id,
    // Not sent by the service yet.
    placeIds: [],
    expected: [],
    status: c.status,
    startedAt: c.started_at,
    startedBy: c.started_by,
    closedAt: opt(c.closed_at),
  }),
};

/** The edit fields the register service accepts, in its names. */
function assetPatch(patch: Partial<AssetInput>): Record<string, unknown> {
  const map: Record<string, string> = { name: 'name', category: 'category', model: 'model', serial: 'serial', siteId: 'site_id', placeId: 'place_id', status: 'status', notes: 'notes' };
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (map[key] && value !== undefined) body[map[key]] = value;
  }
  return body;
}

export class HttpRepository implements Repository {
  private readonly listeners = new Set<() => void>();
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: HttpOptions) {
    this.fetchImpl = opts.fetch ?? ((...args) => fetch(...args));
  }

  // ── transport ──────────────────────────────────────────────────────────

  private url(path: string, query?: Record<string, string>) {
    const base = this.opts.baseUrl.replace(/\/$/, '');
    const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
    return `${base}/v1/workspaces/${encodeURIComponent(this.opts.workspaceId)}${path}${qs}`;
  }

  private async send(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
    const token = this.opts.token();
    return this.fetchImpl(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private async fail(res: Response): Promise<never> {
    let code = 'HTTP_' + res.status;
    let message = res.statusText || 'request failed';
    try {
      const data = (await res.json()) as { error?: { code?: string; message?: string } | string };
      if (typeof data.error === 'object' && data.error) {
        code = data.error.code ?? code;
        message = data.error.message ?? message;
      } else if (typeof data.error === 'string') {
        message = data.error;
      }
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, code, message);
  }

  private async json<T>(method: string, url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const res = await this.send(method, url, body, headers);
    if (!res.ok) return this.fail(res);
    return (await res.json()) as T;
  }

  private changed() {
    for (const listener of this.listeners) listener();
  }

  /** Filters and sorting run here, as LocalRepository does; the service
   *  has no query language yet. Names of people and places are not looked
   *  up until the API serves them. */
  private lookups(sites: Site[]): Lookups {
    return { people: new Map<string, Person>(), sites: new Map(sites.map((s) => [s.id, s])), places: new Map<string, Place>() };
  }

  // ── reads ──────────────────────────────────────────────────────────────

  async workspace(): Promise<Workspace> {
    const base = this.opts.baseUrl.replace(/\/$/, '');
    const all = await this.json<ApiWorkspace[]>('GET', `${base}/v1/workspaces`);
    const mine = all.find((w) => w.id === this.opts.workspaceId);
    if (!mine) throw new ApiError(404, 'NOT_FOUND', 'workspace not found');
    return fromApi.workspace(mine);
  }
  async people(): Promise<Person[]> {
    throw new NotAvailableYet('people');
  }
  async sites(): Promise<Site[]> {
    return (await this.json<ApiSite[]>('GET', this.url('/sites'))).map(fromApi.site);
  }
  async places(): Promise<Place[]> {
    throw new NotAvailableYet('places');
  }
  async assets(q: TableQuery = {}): Promise<Asset[]> {
    const [rows, sites] = await Promise.all([this.json<ApiAsset[]>('GET', this.url('/assets')), this.sites()]);
    return applyQuery(rows.map(fromApi.asset), q, ASSET_FIELDS, this.lookups(sites));
  }
  async asset(idOrTag: string): Promise<Asset | null> {
    const key = normaliseCode(idOrTag).toLowerCase();
    const rows = (await this.json<ApiAsset[]>('GET', this.url('/assets'))).map(fromApi.asset);
    return rows.find((a) => a.id === idOrTag || a.tag.toLowerCase() === key) ?? null;
  }
  async stock(q: TableQuery = {}): Promise<StockItem[]> {
    const [rows, sites] = await Promise.all([this.json<ApiStock[]>('GET', this.url('/stock')), this.sites()]);
    return applyQuery(rows.map(fromApi.stock), q, STOCK_FIELDS, this.lookups(sites));
  }
  async stockItem(id: string): Promise<StockItem | null> {
    const rows = (await this.json<ApiStock[]>('GET', this.url('/stock'))).map(fromApi.stock);
    return rows.find((k) => k.id === id) ?? null;
  }
  async lookup(raw: string): Promise<LookupResult> {
    const code = normaliseCode(raw);
    const lower = code.toLowerCase();
    const assets = (await this.json<ApiAsset[]>('GET', this.url('/assets'))).map(fromApi.asset);
    const asset = assets.find((a) => a.tag.toLowerCase() === lower || a.serial?.toLowerCase() === lower);
    if (asset) return { kind: 'asset', asset };
    const stock = (await this.json<ApiStock[]>('GET', this.url('/stock'))).map(fromApi.stock);
    const item = stock.find((k) => k.barcode === code || k.sku.toLowerCase() === lower);
    if (item) return { kind: 'stock', item };
    return { kind: 'none', code };
  }
  async comments(targetType: Comment['targetType'], targetId: string): Promise<Comment[]> {
    const rows = await this.json<ApiComment[]>('GET', this.url('/comments', { target_type: targetType, target_id: targetId }));
    return rows.map(fromApi.comment);
  }
  async activity(q: ActivityQuery = {}): Promise<Activity[]> {
    const rows = (await this.json<ApiActivity[]>('GET', this.url('/activity'))).map(fromApi.activity);
    const filtered = rows.filter(
      (a) =>
        (!q.targetType || a.targetType === q.targetType) &&
        (!q.targetId || a.targetId === q.targetId) &&
        (!q.kinds || q.kinds.includes(a.kind)) &&
        (!q.actorId || a.actorId === q.actorId),
    );
    return q.limit ? filtered.slice(0, q.limit) : filtered;
  }
  async views(_collection: Collection): Promise<SavedView[]> {
    throw new NotAvailableYet('views');
  }
  async counts(): Promise<CountSession[]> {
    return (await this.json<ApiCount[]>('GET', this.url('/counts'))).map(fromApi.count);
  }
  async count(_id: string): Promise<CountDetail | null> {
    throw new NotAvailableYet('count');
  }

  // ── writes (the service takes the actor from the token) ────────────────

  async createAsset(_input: AssetInput, _actorId: string): Promise<Asset> {
    throw new NotAvailableYet('createAsset');
  }
  async updateAsset(id: string, patch: Partial<AssetInput>, expectedVersion: number, _actorId: string): Promise<SaveResult<Asset>> {
    const res = await this.send('PATCH', this.url(`/assets/${encodeURIComponent(id)}`), { version: expectedVersion, ...assetPatch(patch) });
    if (res.status === 409) {
      const body = (await res.json()) as { current: ApiAsset };
      return { ok: false, reason: 'conflict', current: fromApi.asset(body.current) };
    }
    if (res.status === 404) return { ok: false, reason: 'not_found', message: 'That asset no longer exists.' };
    if (res.status === 400 || res.status === 422) {
      const err = await this.fail(res).catch((e: ApiError) => e);
      return { ok: false, reason: 'invalid', message: err.message };
    }
    if (!res.ok) return this.fail(res);
    this.changed();
    return { ok: true, value: fromApi.asset((await res.json()) as ApiAsset) };
  }
  async checkOut(_id: string, _custodianId: string, _dueBack: string, _actorId: string): Promise<SaveResult<Asset>> {
    throw new NotAvailableYet('checkOut');
  }
  async checkIn(_id: string, _actorId: string): Promise<SaveResult<Asset>> {
    throw new NotAvailableYet('checkIn');
  }
  async adjustStock(id: string, delta: number, reason: string, _actorId: string): Promise<SaveResult<StockItem>> {
    // One key per adjustment the person makes; a network retry of this
    // request reuses it, so the service applies it once.
    const key = crypto.randomUUID();
    const res = await this.send('POST', this.url(`/stock/${encodeURIComponent(id)}/adjust`), { delta, reason }, { 'Idempotency-Key': key });
    if (res.status === 404) return { ok: false, reason: 'not_found', message: 'That stock item no longer exists.' };
    if (res.status === 409 || res.status === 400) {
      const err = await this.fail(res).catch((e: ApiError) => e);
      return { ok: false, reason: 'invalid', message: err.message };
    }
    if (!res.ok) return this.fail(res);
    this.changed();
    return { ok: true, value: fromApi.stock((await res.json()) as ApiStock) };
  }
  async addComment(targetType: Comment['targetType'], targetId: string, body: string, _actorId: string): Promise<Comment> {
    const row = await this.json<ApiComment>('POST', this.url('/comments'), { target_type: targetType, target_id: targetId, body });
    this.changed();
    return fromApi.comment(row);
  }
  async saveView(_view: Omit<SavedView, 'id'> & { id?: string }, _actorId: string): Promise<SavedView> {
    throw new NotAvailableYet('saveView');
  }
  async deleteView(_id: string): Promise<void> {
    throw new NotAvailableYet('deleteView');
  }
  async importAssets(_rows: AssetInput[], _mode: DuplicateMode, _fileName: string, _actorId: string): Promise<ImportSummary> {
    throw new NotAvailableYet('importAssets');
  }
  async importStock(_rows: StockInput[], _mode: DuplicateMode, _fileName: string, _actorId: string): Promise<ImportSummary> {
    throw new NotAvailableYet('importStock');
  }
  async startCount(input: { name: string; siteId: string; placeIds: string[] }, _actorId: string): Promise<CountSession> {
    const row = await this.json<ApiCount>('POST', this.url('/counts'), { site_id: input.siteId, name: input.name });
    this.changed();
    return fromApi.count(row);
  }
  async recordScan(countId: string, code: string, placeId: string | undefined, by: string): Promise<CountScan> {
    const res = await this.json<{ result: ScanResult }>('POST', this.url(`/counts/${encodeURIComponent(countId)}/scans`), {
      code: normaliseCode(code),
      ...(placeId ? { place_id: placeId } : {}),
    });
    this.changed();
    // The service answers only with the result; the rest is what was sent.
    return { id: crypto.randomUUID(), countId, code: normaliseCode(code), placeId, by, at: new Date().toISOString(), result: res.result };
  }
  async closeCount(_id: string, _markMissing: boolean, _actorId: string): Promise<CountSession> {
    throw new NotAvailableYet('closeCount');
  }
  async setRole(_personId: string, _role: Role | undefined, _actorId: string): Promise<Person> {
    throw new NotAvailableYet('setRole');
  }
  async invite(_input: { name: string; email: string; role: Role; team: string }, _actorId: string): Promise<Person> {
    throw new NotAvailableYet('invite');
  }
  async logLabelsPrinted(_assetIds: string[], _actorId: string): Promise<void> {
    throw new NotAvailableYet('logLabelsPrinted');
  }
  async renameWorkspace(_name: string, _actorId: string): Promise<Workspace> {
    throw new NotAvailableYet('renameWorkspace');
  }
  async reset(): Promise<void> {
    throw new NotAvailableYet('reset');
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
