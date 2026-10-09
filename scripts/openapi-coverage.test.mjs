// Red tests for the OpenAPI coverage guard: each drift it exists to catch, fed to
// it on purpose, must be reported — and the honest case must pass.  node --test scripts/openapi-coverage.test.mjs

import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDocument, compareMountedAndDocumented, compareSnapshot, documentedOperations, mountedRoutes, shape } from './openapi-coverage.mjs';

const ROUTES = `
  Router::new()
    .route("/health/live", get(health::live))
    .route("/v1/things", get(things::list).post(things::create))
    .route(
        "/v1/things/:thing_id",
        get(things::one).delete(things::remove),
    )
    .route("/internal/stats", get(internal::stats))
`;

const CONTROLLER = `
#[utoipa::path(
    get,
    path = "/v1/things",
    tag = "things",
    responses((status = 200)),
)]
pub async fn list() {}

#[utoipa::path(
    post,
    path = "/v1/things",
    responses((status = 200)),
)]
pub async fn create() {}

#[utoipa::path(get, path = "/v1/things/{thing_id}")]
pub async fn one() {}

#[utoipa::path(delete, path = "/v1/things/{thing_id}", operation_id = "remove_thing")]
pub async fn remove() {}
`;

test('it reads the routes a service mounts, methods included', () => {
  const mounted = mountedRoutes(ROUTES);
  assert.deepEqual(mounted.find((r) => r.path === '/v1/things')?.methods.sort(), ['get', 'post']);
  assert.deepEqual(mounted.find((r) => r.path === '/v1/things/:thing_id')?.methods.sort(), ['delete', 'get']);
});

test('it reads the operations the code documents, with their ids', () => {
  const ops = documentedOperations(CONTROLLER);
  assert.equal(ops.length, 4);
  assert.deepEqual(ops.map((o) => o.id), ['list', 'create', 'one', 'remove_thing']);
});

test('`:id`, `{id}` and `*key` are the same parameter', () => {
  assert.equal(shape('/v1/a/:id/b'), shape('/v1/a/{id}/b'));
  assert.equal(shape('/v1/media/local/*key'), shape('/v1/media/local/{key}'));
});

test('an honest service passes: health and internal routes need no documentation', () => {
  assert.deepEqual(compareMountedAndDocumented('things', mountedRoutes(ROUTES), documentedOperations(CONTROLLER)), []);
});

test('RED: a mounted route with no documentation is reported', () => {
  const problems = compareMountedAndDocumented('things', mountedRoutes(ROUTES.replace('get(things::list).post(things::create)', 'get(things::list).post(things::create).put(things::replace)')), documentedOperations(CONTROLLER));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /PUT \/v1\/things is mounted but not documented/);
});

test('RED: documentation for a route that is not mounted is reported', () => {
  const problems = compareMountedAndDocumented('things', mountedRoutes(ROUTES), [...documentedOperations(CONTROLLER), { method: 'patch', path: '/v1/things/{id}', id: 'x' }]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /PATCH \/v1\/things\/\{\} is documented but not mounted/);
});

const spec = (paths, schemas = {}) => ({ paths, components: { schemas } });

test('RED: two operations with the same id are reported', () => {
  const problems = checkDocument(spec({ '/a': { get: { operationId: 'reply' } }, '/b': { post: { operationId: 'reply' } } }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /operationId "reply" is used by GET \/a and POST \/b/);
});

test('RED: an operation with no id is reported', () => {
  assert.match(checkDocument(spec({ '/a': { get: {} } }))[0], /has no operationId/);
});

test('RED: a $ref to a schema that does not exist is reported, once', () => {
  const op = { operationId: 'a', responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Missing' } } } } }, requestBody: { $ref: '#/components/schemas/Missing' } };
  const problems = checkDocument(spec({ '/a': { get: op } }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /schema "Missing"/);
});

test('a document with unique ids and resolving refs passes', () => {
  const ok = spec({ '/a': { get: { operationId: 'a', responses: { 200: { schema: { $ref: '#/components/schemas/Thing' } } } } } }, { Thing: {} });
  assert.deepEqual(checkDocument(ok), []);
});

test('RED: a snapshot out of step with the code is reported, both ways', () => {
  const code = documentedOperations(CONTROLLER);
  const missing = compareSnapshot(code, spec({ '/v1/things': { get: {}, post: {} } }));
  assert.ok(missing.some((p) => /DELETE \/v1\/things\/\{\} is documented in code but missing from the snapshot/.test(p)));
  const extra = compareSnapshot(code, spec({ '/v1/things': { get: {}, post: {} }, '/v1/things/{id}': { get: {}, delete: {} }, '/v1/old': { get: {} } }));
  assert.ok(extra.some((p) => /GET \/v1\/old is in the snapshot but no longer documented in code/.test(p)));
});
