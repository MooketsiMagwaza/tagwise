import { describe, expect, it } from 'vitest';
import { ApiError, HttpRepository, NotAvailableYet } from './http';

// A fake register service: records each request and answers from a table of
// handlers keyed by "METHOD path". Nothing here touches a network.
type Handler = (req: { url: URL; init: RequestInit; body: unknown }) => { status: number; body?: unknown };

function fakeServer(handlers: Record<string, Handler>) {
  const calls: { method: string; path: string; url: URL; headers: Record<string, string>; body: unknown }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://test.local');
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ method, path: url.pathname, url, headers, body });
    const handler = handlers[`${method} ${url.pathname}`];
    const res = handler ? handler({ url, init, body }) : { status: 404, body: { error: { code: 'NOT_FOUND', message: 'no route' } } };
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const WS = 'ws-1';
const base = `/api/v1/workspaces/${WS}`;

const apiAsset = {
  id: 'a-1',
  tag: 'MCT-00042',
  name: 'Projector',
  category: 'AV',
  model: null,
  serial: 'SN-9',
  site_id: 's-1',
  place_id: null,
  status: 'in_use',
  custodian_id: null,
  due_back: null,
  purchased_on: '2025-02-01',
  notes: null,
  updated_at: '2026-10-01T10:00:00Z',
  updated_by: 'p-1',
  version: 3,
};
const apiSite = { id: 's-1', code: 'HQ', name: 'Head office', kind: 'office', town: 'Gaborone', address: 'Plot 1', lat: -24.6, lng: 25.9 };
const apiStock = { id: 'k-1', site_id: 's-1', place_id: null, sku: 'PAPER-A4', barcode: '600000000001', name: 'A4 paper', category: 'Stationery', unit: 'ream', quantity: 4, reorder_at: 2, batch: null, expires_on: null, version: 7 };

function repoWith(handlers: Record<string, Handler>, token: string | null = 'tok') {
  const server = fakeServer(handlers);
  const repo = new HttpRepository({ baseUrl: '/api/', workspaceId: WS, token: () => token, fetch: server.fetchImpl });
  return { repo, calls: server.calls };
}

describe('HttpRepository (scaffold)', () => {
  it('maps the service’s snake_case assets to the app’s shape and sends the token', async () => {
    const { repo, calls } = repoWith({
      [`GET ${base}/assets`]: () => ({ status: 200, body: [apiAsset] }),
      [`GET ${base}/sites`]: () => ({ status: 200, body: [apiSite] }),
    });
    const [asset] = await repo.assets();
    expect(asset).toMatchObject({ id: 'a-1', tag: 'MCT-00042', siteId: 's-1', serial: 'SN-9', purchasedOn: '2025-02-01', version: 3 });
    expect(asset.model).toBeUndefined();
    expect(asset.placeId).toBeUndefined();
    expect(calls[0].headers.Authorization).toBe('Bearer tok');
  });

  it('finds an asset by tag, including from a label URL', async () => {
    const { repo } = repoWith({ [`GET ${base}/assets`]: () => ({ status: 200, body: [apiAsset] }) });
    expect((await repo.asset('https://example.com/s/mct-00042'))?.id).toBe('a-1');
    expect(await repo.asset('NOPE-1')).toBeNull();
  });

  it('sends the version with an edit and turns a 409 into a conflict carrying the current asset', async () => {
    const { repo, calls } = repoWith({
      [`PATCH ${base}/assets/a-1`]: () => ({ status: 409, body: { error: 'edited by someone else first', current: { ...apiAsset, name: 'Projector (Room 4)', version: 4 } } }),
    });
    const result = await repo.updateAsset('a-1', { name: 'Old projector', siteId: 's-2' }, 3, 'p-1');
    expect(calls[0].body).toEqual({ version: 3, name: 'Old projector', site_id: 's-2' });
    expect(result).toMatchObject({ ok: false, reason: 'conflict', current: { name: 'Projector (Room 4)', version: 4 } });
  });

  it('tells subscribers after a successful write', async () => {
    const { repo } = repoWith({ [`PATCH ${base}/assets/a-1`]: () => ({ status: 200, body: { ...apiAsset, version: 4 } }) });
    let heard = 0;
    const stop = repo.subscribe(() => heard++);
    const result = await repo.updateAsset('a-1', { notes: 'cable missing' }, 3, 'p-1');
    stop();
    expect(result).toMatchObject({ ok: true, value: { version: 4 } });
    expect(heard).toBe(1);
  });

  it('sends a fresh Idempotency-Key with each stock adjustment and reports "not enough" as invalid', async () => {
    const { repo, calls } = repoWith({
      [`POST ${base}/stock/k-1/adjust`]: ({ body }) =>
        (body as { delta: number }).delta < -4
          ? { status: 409, body: { error: { code: 'CONFLICT', message: 'only 4 on hand' } } }
          : { status: 200, body: { ...apiStock, quantity: 4 + (body as { delta: number }).delta, version: 8 } },
    });
    const ok = await repo.adjustStock('k-1', -1, 'issued', 'p-1');
    const short = await repo.adjustStock('k-1', -9, 'issued', 'p-1');
    expect(ok).toMatchObject({ ok: true, value: { quantity: 3, reorderAt: 2 } });
    expect(short).toEqual({ ok: false, reason: 'invalid', message: 'only 4 on hand' });
    const keys = calls.map((c) => c.headers['Idempotency-Key']);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('asks for comments on one target with query parameters', async () => {
    const { repo, calls } = repoWith({
      [`GET ${base}/comments`]: () => ({ status: 200, body: [{ id: 'c-1', target_type: 'asset', target_id: 'a-1', author_id: 'p-1', body: 'hello', created_at: '2026-10-01T10:00:00Z' }] }),
    });
    const comments = await repo.comments('asset', 'a-1');
    expect(calls[0].url.searchParams.get('target_type')).toBe('asset');
    expect(calls[0].url.searchParams.get('target_id')).toBe('a-1');
    expect(comments[0]).toEqual({ id: 'c-1', targetType: 'asset', targetId: 'a-1', authorId: 'p-1', body: 'hello', createdAt: '2026-10-01T10:00:00Z' });
  });

  it('raises the service’s error code and message', async () => {
    const { repo } = repoWith({ [`GET ${base}/sites`]: () => ({ status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'sign in first' } } }) }, null);
    await expect(repo.sites()).rejects.toMatchObject({ name: 'ApiError', status: 401, code: 'UNAUTHORIZED', message: 'sign in first' });
    await expect(repo.sites()).rejects.toBeInstanceOf(ApiError);
  });

  it('says plainly which methods the API cannot serve yet', async () => {
    const { repo, calls } = repoWith({});
    await expect(repo.people()).rejects.toBeInstanceOf(NotAvailableYet);
    await expect(repo.createAsset({} as never, 'p-1')).rejects.toThrow('createAsset is not available from the API yet');
    expect(calls).toHaveLength(0);
  });
});
