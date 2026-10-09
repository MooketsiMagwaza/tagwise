#!/usr/bin/env node
// The OpenAPI coverage guard. Fails if the API's documentation and its code have
// drifted apart:
//
//   1. every route a service mounts (`.route("…", get(…).post(…))` in its
//      routes.rs) is documented (`#[utoipa::path(…)]`), and every documented
//      operation is mounted — except health, metrics and `/internal/*`, which
//      are deliberately undocumented;
//   2. every operation the code documents is in the committed snapshot
//      (docs/reference/openapi.json), and the snapshot holds nothing the code
//      doesn't;
//   3. operation ids are unique across the whole document (two handlers with
//      the same function name would otherwise collide);
//   4. every `$ref` in the snapshot points at a schema that exists.
//
// No dependencies. Run from anywhere:  node scripts/openapi-coverage.mjs
// Its own tests:                        node --test scripts/openapi-coverage.test.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const SERVICES = ['identity', 'register', 'notifications', 'media', 'ops'];
/** Mounted on purpose without documentation. */
const UNDOCUMENTED = [/^\/health\//, /^\/metrics$/, /^\/internal\//, /^\/docs\//, /^\/openapi\.json$/];

/** `:id` and `{id}` are the same parameter: compare shapes, not spellings. */
export const shape = (p) => p.replace(/[:*][A-Za-z_][A-Za-z0-9_]*/g, '{}').replace(/\{[^}]*\}/g, '{}');
const key = (method, p) => `${method.toUpperCase()} ${shape(p)}`;

/** The text between the parenthesis that opens at `open` and its match. */
function balanced(src, open) {
  let depth = 0;
  let inString = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return src.slice(open + 1, i);
  }
  return src.slice(open + 1);
}

/** Routes mounted by a routes.rs: `[{ path, methods }]`. */
export function mountedRoutes(routesRs) {
  const out = [];
  const re = /\.route\s*\(/g;
  let m;
  while ((m = re.exec(routesRs))) {
    const body = balanced(routesRs, m.index + m[0].length - 1);
    const p = body.match(/^\s*"([^"]+)"/);
    if (!p) continue;
    const rest = body.slice(body.indexOf(p[0]) + p[0].length);
    const methods = [...rest.matchAll(new RegExp(`(?:^|[^A-Za-z_])(${METHODS.join('|')})\\s*\\(`, 'g'))].map((x) => x[1]);
    out.push({ path: p[1], methods: [...new Set(methods)] });
  }
  return out;
}

/** Operations documented by `#[utoipa::path(...)]` attributes: `[{ method, path, id }]`. */
export function documentedOperations(controllerSrc) {
  const out = [];
  const re = /#\[utoipa::path\s*\(/g;
  let m;
  while ((m = re.exec(controllerSrc))) {
    const body = balanced(controllerSrc, m.index + m[0].length - 1);
    const head = body.match(/^\s*(get|post|put|patch|delete)\s*,/);
    const p = body.match(/path\s*=\s*"([^"]+)"/);
    if (!head || !p) continue;
    const explicit = body.match(/operation_id\s*=\s*"([^"]+)"/);
    // utoipa names an operation after its function unless told otherwise.
    const fn = controllerSrc.slice(m.index + m[0].length + body.length).match(/\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/);
    out.push({ method: head[1], path: p[1], id: explicit?.[1] ?? fn?.[1] ?? '?' });
  }
  return out;
}

/** The problems between what a service mounts and what it documents. */
export function compareMountedAndDocumented(service, mounted, documented) {
  const problems = [];
  const mountedKeys = new Set();
  for (const r of mounted) {
    if (UNDOCUMENTED.some((u) => u.test(r.path))) continue;
    for (const method of r.methods) mountedKeys.add(key(method, r.path));
  }
  const docKeys = new Set(documented.map((d) => key(d.method, d.path)));
  for (const k of mountedKeys) if (!docKeys.has(k)) problems.push(`${service}: ${k} is mounted but not documented`);
  for (const k of docKeys) if (!mountedKeys.has(k)) problems.push(`${service}: ${k} is documented but not mounted`);
  return problems;
}

/** Problems inside a merged OpenAPI document: duplicate operation ids, dangling refs. */
export function checkDocument(spec) {
  const problems = [];
  const ids = new Map();
  for (const [p, ops] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(ops)) {
      if (!METHODS.includes(method)) continue;
      if (!op.operationId) {
        problems.push(`${method.toUpperCase()} ${p} has no operationId`);
        continue;
      }
      ids.set(op.operationId, [...(ids.get(op.operationId) ?? []), `${method.toUpperCase()} ${p}`]);
    }
  }
  for (const [id, where] of ids) if (where.length > 1) problems.push(`operationId "${id}" is used by ${where.join(' and ')}`);
  const schemas = new Set(Object.keys(spec.components?.schemas ?? {}));
  const seen = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === '$ref' && typeof v === 'string') {
          const name = v.replace('#/components/schemas/', '');
          if (v.startsWith('#/components/schemas/') && !schemas.has(name) && !seen.has(name)) {
            seen.add(name);
            problems.push(`$ref to schema "${name}", which does not exist`);
          }
        } else walk(v);
      }
    }
  };
  walk(spec);
  return problems;
}

/** Operations the snapshot holds that the code doesn't, and the reverse. */
export function compareSnapshot(documentedAll, spec) {
  const problems = [];
  const inCode = new Set(documentedAll.map((d) => key(d.method, d.path)));
  const inSnapshot = new Set();
  for (const [p, ops] of Object.entries(spec.paths ?? {})) for (const method of Object.keys(ops)) if (METHODS.includes(method)) inSnapshot.add(key(method, p));
  for (const k of inCode) if (!inSnapshot.has(k)) problems.push(`${k} is documented in code but missing from the snapshot — regenerate it (node docs-site/scripts/fetch-openapi.mjs --from-source)`);
  for (const k of inSnapshot) if (!inCode.has(k)) problems.push(`${k} is in the snapshot but no longer documented in code — regenerate it`);
  return problems;
}

const rustFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? rustFiles(path.join(dir, e.name)) : e.name.endsWith('.rs') ? [path.join(dir, e.name)] : []));

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const problems = [];
  const documentedAll = [];
  let mountedCount = 0;

  for (const service of SERVICES) {
    const src = path.join(root, 'backend/crates', service, 'src');
    const routes = path.join(src, 'routes.rs');
    if (!existsSync(routes)) {
      problems.push(`${service}: routes.rs not found`);
      continue;
    }
    const mounted = mountedRoutes(readFileSync(routes, 'utf8'));
    const controllers = path.join(src, 'controllers');
    const documented = existsSync(controllers) ? rustFiles(controllers).flatMap((f) => documentedOperations(readFileSync(f, 'utf8'))) : [];
    mountedCount += mounted.length;
    documentedAll.push(...documented);
    problems.push(...compareMountedAndDocumented(service, mounted, documented));
  }

  const snapshotPath = path.join(root, 'docs/reference/openapi.json');
  const spec = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  problems.push(...compareSnapshot(documentedAll, spec));
  problems.push(...checkDocument(spec));

  if (problems.length) {
    console.error(`OpenAPI coverage guard FAILED (${problems.length}):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`OpenAPI coverage guard passed: ${mountedCount} mounted routes, ${documentedAll.length} documented operations, ${Object.keys(spec.paths).length} paths in the snapshot; operation ids unique; every $ref resolves.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
