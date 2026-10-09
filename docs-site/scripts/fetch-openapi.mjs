#!/usr/bin/env node
/**
 * Downloads each service's live OpenAPI document and merges them into the
 * committed snapshot the API reference is generated from
 * (`docs/reference/openapi.json`).
 *
 * Tagwise is five independent services (see docs/STATUS.md's
 * microservices entry), each with its own `/openapi.json` — there is no
 * single backend to fetch one document from any more. Paths and schemas
 * are namespaced by service name to avoid collisions (none exist yet, but
 * nothing stops a future one).
 *
 * This is a manual/CI step, not part of `predev`/`prebuild` — dev services
 * are not always running, and the reference must build from a stable,
 * reviewed snapshot rather than whatever happens to be running at build
 * time. Re-run this after an accepted API contract change, review the diff,
 * then run `generate-api-reference.mjs` (or `pnpm sync`, which calls it).
 *
 * Two ways to get each service's document:
 *   --from-source   (default when no service answers) asks each service binary to
 *                   print it: `cargo run -p tagwise-<service> -- openapi`. Needs
 *                   Rust, no database, no running stack — the document comes from
 *                   the code, so it can't drift from it.
 *   live            downloads each running service's `/openapi.json`.
 *
 * Usage (defaults assume the dev stack's direct service ports — see
 * docker/compose.dev.yml; those services publish no fixed host port by
 * design, so from outside Docker use `docker exec <container> curl
 * localhost:8080/openapi.json` per service, or override each URL below):
 *   node scripts/fetch-openapi.mjs
 *   IDENTITY_OPENAPI_URL=http://localhost:8281/openapi.json node scripts/fetch-openapi.mjs
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(here, '../../docs/reference/openapi.json');

const SERVICES = [
  { name: 'identity', urlEnv: 'IDENTITY_OPENAPI_URL', default: 'http://localhost:8281/openapi.json' },
  { name: 'register', urlEnv: 'REGISTER_OPENAPI_URL', default: 'http://localhost:8282/openapi.json' },
  { name: 'notifications', urlEnv: 'NOTIFICATIONS_OPENAPI_URL', default: 'http://localhost:8283/openapi.json' },
  { name: 'media', urlEnv: 'MEDIA_OPENAPI_URL', default: 'http://localhost:8284/openapi.json' },
  { name: 'ops', urlEnv: 'OPS_OPENAPI_URL', default: 'http://localhost:8285/openapi.json' },
];

const backend = path.resolve(here, '../../backend');

/** Operations that need no token: their handlers take no authenticated user. */
const PUBLIC_OPERATIONS = new Set([
  'POST /v1/auth/otp/request',
  'POST /v1/auth/otp/verify',
  'POST /v1/auth/refresh',
  'POST /v1/auth/api-key/token',
  'GET /v1/media/local/{key}',
  'GET /health/live',
  'GET /health/ready',
]);

/** Asks the service binary to print its own document. */
function specFromSource(service) {
  const out = execFileSync('cargo', ['run', '--quiet', '-p', `tagwise-${service.name}`, '--bin', `tagwise-${service.name}`, '--', 'openapi'], {
    cwd: backend,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const spec = JSON.parse(out);
  if (!spec.openapi || !spec.paths) throw new Error(`${service.name} printed something that is not an OpenAPI document`);
  return spec;
}

async function fetchSpec(service) {
  const url = process.env[service.urlEnv] ?? service.default;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`could not reach ${service.name} at ${url}: ${err.message}`);
  }
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  const spec = await res.json();
  if (!spec.openapi || !spec.paths) throw new Error(`${url} does not look like an OpenAPI document`);
  return spec;
}

async function main() {
  const fromSource = process.argv.includes('--from-source');
  const specs = fromSource ? SERVICES.map(specFromSource) : await Promise.all(SERVICES.map(fetchSpec));

  const merged = {
    openapi: specs[0].openapi,
    info: { title: 'Tagwise API', version: '0.1.0' },
    paths: {},
    components: { schemas: {} },
  };

  for (const [i, spec] of specs.entries()) {
    const service = SERVICES[i].name;
    for (const [p, ops] of Object.entries(spec.paths ?? {})) {
      if (merged.paths[p]) {
        console.warn(`path collision on ${p} (${service}) — keeping the first service's definition`);
        continue;
      }
      merged.paths[p] = ops;
    }
    for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
      merged.components.schemas[name] = schema; // identical shared shapes (e.g. health) collide harmlessly
    }
  }

  // The services' documents do not declare security, but every handler that
  // takes an authenticated user rejects a request without a token. Record
  // that here, so the reference says which operations need one. The public
  // ones are the handlers that take no user (checked by reading them).
  merged.components.securitySchemes = { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } };
  for (const [p, ops] of Object.entries(merged.paths)) {
    for (const [method, op] of Object.entries(ops)) {
      if (!op || typeof op !== 'object' || !op.operationId) continue;
      if (!PUBLIC_OPERATIONS.has(`${method.toUpperCase()} ${p}`)) op.security = [{ bearer: [] }];
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n');
  const pathCount = Object.keys(merged.paths).length;
  console.log(`wrote ${path.relative(process.cwd(), outPath)} (${pathCount} paths from ${specs.length} services)`);
}

main().catch((err) => {
  console.error(err.message);
  console.error('Is the dev stack running? docker compose -f docker/compose.dev.yml up -d --build');
  process.exit(1);
});
