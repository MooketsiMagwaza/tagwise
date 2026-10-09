#!/usr/bin/env node
// Smoke test: identity and register running together. Two accounts sign in
// by one-time code, one creates a workspace in register, the other is kept
// out, then the first signs out and register must refuse the old token.
//
// Needs identity with OTP_DEV_ECHO_ENABLED=true (development only), and both
// services sharing Redis and the JWT secret, as in docker/compose.dev.yml.
//
//   node scripts/smoke-identity-register.mjs              # through the gateway
//   TW_IDENTITY_URL=http://127.0.0.1:8281 TW_REGISTER_URL=http://127.0.0.1:8282 \
//     node scripts/smoke-identity-register.mjs            # services run directly
//
// Exit code 0 when every check passes.
const ID = process.env.TW_IDENTITY_URL ?? 'http://localhost:5290/api';
const REG = process.env.TW_REGISTER_URL ?? 'http://localhost:5290/api';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
};

async function call(base, method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, requestId: res.headers.get('x-request-id') };
}

async function signIn(email) {
  const req = await call(ID, 'POST', '/v1/auth/otp/request', { body: { channel: 'email', identifier: email } });
  check(`one-time code requested for ${email}`, req.status === 200 && !!req.data?.dev_code, `status ${req.status}`);
  const ver = await call(ID, 'POST', '/v1/auth/otp/verify', { body: { channel: 'email', identifier: email, code: req.data?.dev_code } });
  check(`code verified, tokens issued for ${email}`, ver.status === 200 && !!ver.data?.access_token, `status ${ver.status}`);
  return ver.data;
}

const stamp = Date.now();
const a = await signIn(`owner.${stamp}@example.test`);
const b = await signIn(`outsider.${stamp}@example.test`);

const wrong = await call(ID, 'POST', '/v1/auth/otp/verify', { body: { channel: 'email', identifier: `owner.${stamp}@example.test`, code: '000000' } });
check('a wrong code is refused', wrong.status >= 400 && wrong.status < 500, `status ${wrong.status}`);

const noToken = await call(REG, 'GET', '/v1/workspaces');
check('register refuses a request with no token', noToken.status === 401, `status ${noToken.status}`);

const created = await call(REG, 'POST', '/v1/workspaces', { token: a.access_token, body: { name: 'Test trust', tag_prefix: 'TT' } });
check('register accepts identity’s token and creates a workspace', created.status === 201 && !!created.data?.id, `status ${created.status}`);
check('responses carry a request id', /^[0-9a-f-]{36}$/.test(created.requestId ?? ''), created.requestId ?? 'none');
const ws = created.data?.id;

const mine = await call(REG, 'GET', '/v1/workspaces', { token: a.access_token });
check('the owner sees the workspace', mine.status === 200 && mine.data?.some((w) => w.id === ws));

const theirs = await call(REG, 'GET', '/v1/workspaces', { token: b.access_token });
check('another account does not list it', theirs.status === 200 && !theirs.data?.some((w) => w.id === ws));

const probe = await call(REG, 'GET', `/v1/workspaces/${ws}/assets`, { token: b.access_token });
check('another account gets 404 for its assets', probe.status === 404, `status ${probe.status}`);

const assets = await call(REG, 'GET', `/v1/workspaces/${ws}/assets`, { token: a.access_token });
check('the owner can list its (empty) assets', assets.status === 200 && Array.isArray(assets.data), `status ${assets.status}`);

const out = await call(ID, 'POST', '/v1/auth/logout', { token: a.access_token, body: { refresh_token: a.refresh_token } });
check('the owner signs out at identity', out.status >= 200 && out.status < 300, `status ${out.status}`);

const after = await call(REG, 'GET', '/v1/workspaces', { token: a.access_token });
check('register refuses the signed-out token at once (shared Redis denylist)', after.status === 401, `status ${after.status}`);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
console.log(`request id to find in the logs: ${created.requestId}`);
process.exit(failed ? 1 : 0);
