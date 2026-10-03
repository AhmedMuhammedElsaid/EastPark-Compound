#!/usr/bin/env node
// EastPark post-deploy smoke test suite. Plain Node ESM (>= 20), zero dependencies.
//
//   node scripts/smoke/run.mjs [--only=<group>[,<group>]] [--with-writes]
//
// Groups (default order): health, pages, auth, content, roles, security.
// Opt-in: --with-writes (image uploads + Supabase cleanup), --only=throttle (spoofed-IP check;
// consumes the login rate limit for a minute).
//
// Output never contains passwords, tokens, cookies, emails or env values: only statuses,
// counts, hosts and paths. See README.md in this folder.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------------------------

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Parses KEY=VALUE lines; tolerates leading spaces, quotes and trailing `# comments`. */
function parseEnvFile(file) {
  const out = {};
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2];
    const q = value[0];
    if (q === '"' || q === "'") {
      const end = value.indexOf(q, 1);
      value = end > 0 ? value.slice(1, end) : value.slice(1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    out[m[1]] = value;
  }
  return out;
}

const fileEnv = parseEnvFile(path.join(ROOT, '.env'));
const env = (key, fallback = undefined) => {
  const v = process.env[key];
  if (v !== undefined && v !== '') return v;
  const f = fileEnv[key];
  return f !== undefined && f !== '' ? f : fallback;
};

const WEB = env('SMOKE_WEB_URL', 'https://eastpark-web-app.vercel.app').replace(/\/+$/, '');
const API_ORIGIN = env('SMOKE_API_URL', 'https://eastpark-backend.onrender.com').replace(/\/+$/, '').replace(/\/v1$/, '');
const API = `${API_ORIGIN}/v1`;

const CREDS = {
  merchant: { email: 'showcase.adam-cafe@eastpark.app', password: env('SEED_MERCHANT_PASSWORD') },
  resident: { email: env('SMOKE_RESIDENT_EMAIL'), password: env('SMOKE_RESIDENT_PASSWORD') },
  admin: { email: env('SMOKE_ADMIN_EMAIL'), password: env('SMOKE_ADMIN_PASSWORD') },
};
const hasCreds = (role) => Boolean(CREDS[role].email && CREDS[role].password);

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;
const WITH_WRITES = args.includes('--with-writes') || Boolean(ONLY?.includes('writes'));
const DEFAULT_GROUPS = ['health', 'pages', 'auth', 'content', 'roles', 'security'];
const KNOWN_GROUPS = [...DEFAULT_GROUPS, 'writes', 'throttle'];
if (ONLY) {
  const unknown = ONLY.filter((g) => !KNOWN_GROUPS.includes(g));
  if (unknown.length) {
    console.error(`Unknown group(s): ${unknown.join(', ')}. Known: ${KNOWN_GROUPS.join(', ')}`);
    process.exit(2);
  }
}
const wants = (group) => (ONLY ? ONLY.includes(group) : DEFAULT_GROUPS.includes(group) || (group === 'writes' && WITH_WRITES));

// ---------------------------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------------------------

const results = [];
function record(status, name, detail = '') {
  results.push({ status, name });
  console.log(`${status.padEnd(4)}  ${name}  ${detail}`.trimEnd());
}
const pass = (n, d) => record('PASS', n, d);
const fail = (n, d) => record('FAIL', n, d);
const skip = (n, d) => record('SKIP', n, d);
const check = (ok, n, d) => (ok ? pass(n, d) : fail(n, d));

// ---------------------------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(url, opts = {}) {
  const { timeout = 30_000, ...init } = opts;
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeout), ...init });
  const text = await res.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, text, json, res };
}

/** Status plus the safe `error`/`message` code; never the body. */
function brief(r) {
  const parts = [`status=${r.status}`];
  if (r.status === 429) parts.push('rate_limited');
  const code = r.json && (typeof r.json.error === 'string' ? r.json.error : null);
  if (code) parts.push(`error=${code.slice(0, 40)}`);
  return parts.join(' ');
}

const locPath = (r) => {
  const loc = r.headers.get('location');
  if (!loc) return '';
  try {
    const u = new URL(loc, WEB);
    return `${u.pathname}${u.search}`;
  } catch {
    return '(unparseable location)';
  }
};

const unwrap = (j) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

// Auth-route rate limit: 5/min/IP shared by /v1/auth/* and the BFF auth routes (the BFF forwards
// the client IP). Stay at 4 per rolling 60 s.
const AUTH_WINDOW_MS = 61_000;
const AUTH_MAX = 4;
const authCalls = [];
async function authSlot(label) {
  for (;;) {
    const now = Date.now();
    while (authCalls.length && now - authCalls[0] >= AUTH_WINDOW_MS) authCalls.shift();
    if (authCalls.length < AUTH_MAX) break;
    const wait = AUTH_WINDOW_MS - (now - authCalls[0]) + 250;
    console.log(`....  waiting ${Math.ceil(wait / 1000)}s for the auth rate-limit window (${label})`);
    await sleep(wait);
  }
  authCalls.push(Date.now());
}

// Cookie jar for the web BFF (HttpOnly cookies, read from Set-Cookie).
function cookieJar() {
  const jar = new Map();
  return {
    take(res) {
      const cleared = [];
      for (const sc of res.headers.getSetCookie?.() ?? []) {
        const [kv, ...attrs] = sc.split(';');
        const i = kv.indexOf('=');
        if (i < 0) continue;
        const name = kv.slice(0, i).trim();
        const value = kv.slice(i + 1).trim();
        const a = attrs.join(';').toLowerCase();
        const expired =
          !value ||
          /max-age=\s*(0|-\d+)\b/.test(a) ||
          (/expires=([^;]+)/.test(a) && Date.parse(/expires=([^;]+)/.exec(a)[1]) <= Date.now());
        if (expired) {
          jar.delete(name);
          cleared.push(name);
        } else {
          jar.set(name, value);
        }
      }
      return cleared;
    },
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    has: (name) => jar.has(name),
    size: () => jar.size,
  };
}

const webHeaders = (jar, extra = {}) => ({ ...(jar && jar.size() ? { cookie: jar.header() } : {}), ...extra });

// ---------------------------------------------------------------------------------------------
// Sessions (memoised so each role logs in at most once per run)
// ---------------------------------------------------------------------------------------------

const failedLogin = new Set(); // role -> stop retrying (avoid the per-email lockout)
const webSessions = new Map();
let backendMerchant = null;

async function backendLogin(role) {
  if (role === 'merchant' && backendMerchant) return backendMerchant;
  if (!hasCreds(role) || failedLogin.has(role)) return null;
  await authSlot(`${role} backend login`);
  const r = await http(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(CREDS[role]),
  });
  const data = unwrap(r.json) || {};
  const session = { r, accessToken: data.accessToken, refreshToken: data.refreshToken };
  if (r.status !== 200 || !session.accessToken) failedLogin.add(role);
  if (role === 'merchant') backendMerchant = session;
  return session;
}

async function webLogin(role) {
  if (webSessions.has(role)) return webSessions.get(role);
  if (!hasCreds(role) || failedLogin.has(role)) return null;
  await authSlot(`${role} web login`);
  const jar = cookieJar();
  const r = await http(`${WEB}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: WEB },
    body: JSON.stringify(CREDS[role]),
  });
  jar.take(r.res);
  const session = { r, jar, loggedOut: false };
  if (r.status !== 200) failedLogin.add(role);
  webSessions.set(role, session);
  return session;
}

async function webLogout(role) {
  const s = webSessions.get(role);
  if (!s || s.loggedOut || s.r.status !== 200) return null;
  await authSlot(`${role} web logout`);
  const r = await http(`${WEB}/api/auth/logout`, { method: 'POST', headers: webHeaders(s.jar, { origin: WEB }) });
  const cleared = s.jar.take(r.res);
  s.loggedOut = true;
  return { r, cleared };
}

// ---------------------------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------------------------

async function groupHealth() {
  // Render free tier cold-starts; allow ~60 s and one retry.
  let last = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    try {
      last = await http(`${API_ORIGIN}/health`, { timeout: 60_000 });
      if (last.status === 200) {
        pass('health: GET /health', `status=200 in ${Date.now() - started}ms (attempt ${attempt})`);
        return true;
      }
    } catch (e) {
      last = { error: e.name };
    }
    if (attempt === 1) await sleep(5_000);
  }
  fail('health: GET /health', last?.error ? `error=${last.error}` : brief(last));
  return false;
}

const NOT_FOUND_RE = /This page doesn.{1,8}t exist|هذه الصفحة غير موجودة/;
const ERROR_RE = /We couldn.{1,8}t complete your request|تعذّر إكمال طلبك/;
function pageMarkers(text) {
  if (NOT_FOUND_RE.test(text)) return 'not-found page rendered';
  if (ERROR_RE.test(text)) return 'error page rendered';
  return null;
}

async function groupPages() {
  for (const p of ['/', '/login', '/register-unit', '/home', '/announcements', '/profile']) {
    try {
      const r = await http(`${WEB}${p}`);
      const marker = r.status === 200 ? pageMarkers(r.text) : null;
      check(r.status === 200 && !marker, `pages: guest GET ${p}`, `${brief(r)} bytes=${r.text.length}${marker ? ` ${marker}` : ''}`);
    } catch (e) {
      fail(`pages: guest GET ${p}`, `error=${e.name}`);
    }
  }
  for (const p of ['/admin', '/merchant']) {
    try {
      const r = await http(`${WEB}${p}`);
      const loc = locPath(r);
      const expected = `/login?next=${encodeURIComponent(p)}`;
      check(r.status === 307 && loc === expected, `pages: guest GET ${p} -> login`, `${brief(r)} location=${loc || '-'}`);
    } catch (e) {
      fail(`pages: guest GET ${p} -> login`, `error=${e.name}`);
    }
  }
  try {
    const r = await http(`${WEB}/smoke-missing-${randomUUID().slice(0, 8)}`);
    check(r.status === 404 && NOT_FOUND_RE.test(r.text), 'pages: unknown route -> not-found page', `${brief(r)} marker=${NOT_FOUND_RE.test(r.text)}`);
  } catch (e) {
    fail('pages: unknown route -> not-found page', `error=${e.name}`);
  }
}

async function groupAuth() {
  // 1. Unknown email -> 401 (unique throwaway address, no real account involved).
  await authSlot('unknown-email login');
  const unknown = await http(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `smoke-${randomUUID()}@example.com`, password: 'Wrong-Password-123' }),
  });
  check(unknown.status === 401, 'auth: backend login, unknown email -> 401', brief(unknown));

  if (!hasCreds('merchant')) {
    skip('auth: merchant backend login/refresh', 'SEED_MERCHANT_PASSWORD not set');
  } else {
    const s = await backendLogin('merchant');
    check(s.r.status === 200 && !!s.accessToken && !!s.refreshToken, 'auth: backend login, merchant -> 200', `${brief(s.r)} tokens=${s.accessToken && s.refreshToken ? 'yes' : 'no'}`);
    if (s.refreshToken) {
      const oldRefresh = s.refreshToken;
      await authSlot('refresh');
      const r1 = await http(`${API}/auth/refresh`, {
        method: 'POST',
        headers: { authorization: `Bearer ${oldRefresh}`, 'content-type': 'application/json' },
        body: '{}',
      });
      const t1 = unwrap(r1.json) || {};
      check(r1.status === 200 && !!t1.refreshToken, 'auth: backend refresh -> 200', `${brief(r1)} rotated=${t1.refreshToken && t1.refreshToken !== oldRefresh ? 'yes' : 'no'}`);
      if (t1.accessToken) backendMerchant.accessToken = t1.accessToken;
      if (t1.refreshToken) backendMerchant.refreshToken = t1.refreshToken;
      await sleep(1_500);
      await authSlot('refresh reuse');
      const r2 = await http(`${API}/auth/refresh`, {
        method: 'POST',
        headers: { authorization: `Bearer ${oldRefresh}`, 'content-type': 'application/json' },
        body: '{}',
      });
      check(r2.status === 401, 'auth: reuse of old refresh token -> 401', brief(r2));
    } else {
      skip('auth: backend refresh', 'no refresh token from login');
    }
  }

  // Web BFF login (the shared merchant session also feeds content/roles/writes).
  if (!hasCreds('merchant')) {
    skip('auth: web login', 'SEED_MERCHANT_PASSWORD not set');
    return;
  }
  const w = await webLogin('merchant');
  if (!w) {
    skip('auth: web login', 'merchant login already failed in this run');
    return;
  }
  const both = w.jar.has('eastpark_access') && w.jar.has('eastpark_refresh');
  check(w.r.status === 200 && both, 'auth: web login -> 200 + 2 cookies', `${brief(w.r)} cookies=${w.jar.size()} access+refresh=${both}`);
  if (w.r.status === 200) {
    const s = await http(`${WEB}/api/auth/session`, { headers: webHeaders(w.jar) });
    const user = unwrap(s.json)?.user;
    check(s.status === 200 && !!user, 'auth: /api/auth/session signed in', `${brief(s)} role=${user?.role ?? 'none'}`);
  }
}

/** Logout is the last step: it destroys the shared web session. */
async function finalLogout() {
  for (const role of webSessions.keys()) {
    const out = await webLogout(role);
    if (!out) continue;
    const s = webSessions.get(role);
    const clearedBoth = out.cleared.includes('eastpark_access') && out.cleared.includes('eastpark_refresh');
    check(out.r.status === 200 && clearedBoth, `auth: ${role} web logout clears cookies`, `${brief(out.r)} cleared=${out.cleared.length}`);
    // Only the cleared jar is asserted: the old access JWT stays valid until it expires (~15 min).
    const after = await http(`${WEB}/api/auth/session`, { headers: webHeaders(s.jar) });
    const user = unwrap(after.json)?.user;
    check(after.status === 200 && user === null, `auth: ${role} session null after logout`, `${brief(after)} user=${user === null ? 'null' : 'present'}`);
  }
}

async function groupContent() {
  const list = await http(`${API}/announcements?limit=5`);
  const items = unwrap(list.json)?.items;
  check(list.status === 200 && Array.isArray(items), 'content: API announcements list (guest)', `${brief(list)} items=${Array.isArray(items) ? items.length : 'n/a'}`);
  const id = Array.isArray(items) ? items[0]?.id : undefined;
  if (!id) {
    skip('content: announcement detail checks', 'no announcement available');
    return;
  }
  const dGuest = await http(`${API}/announcements/${encodeURIComponent(id)}`);
  const dg = unwrap(dGuest.json);
  check(dGuest.status === 200 && dg?.id === id, 'content: API announcement detail (guest)', `${brief(dGuest)} comments=${Array.isArray(dg?.comments) ? dg.comments.length : 'n/a'}`);

  const b = await backendLogin('merchant');
  if (b?.accessToken) {
    const dAuth = await http(`${API}/announcements/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${b.accessToken}` } });
    check(dAuth.status === 200 && unwrap(dAuth.json)?.id === id, 'content: API announcement detail (signed in)', brief(dAuth));
  } else {
    skip('content: API announcement detail (signed in)', hasCreds('merchant') ? 'merchant backend login failed' : 'SEED_MERCHANT_PASSWORD not set');
  }

  const bffGuest = await http(`${WEB}/api/announcements?limit=5`);
  check(bffGuest.status === 200, 'content: BFF /api/announcements (guest)', brief(bffGuest));
  const pageGuest = await http(`${WEB}/announcements/${encodeURIComponent(id)}`);
  const mg = pageMarkers(pageGuest.text);
  check(pageGuest.status === 200 && !mg, 'content: web announcement page (guest)', `${brief(pageGuest)}${mg ? ` ${mg}` : ''}`);

  const w = await webLogin('merchant');
  if (w?.r.status === 200) {
    const bffAuth = await http(`${WEB}/api/announcements?limit=5`, { headers: webHeaders(w.jar) });
    check(bffAuth.status === 200, 'content: BFF /api/announcements (signed in)', brief(bffAuth));
    const pageAuth = await http(`${WEB}/announcements/${encodeURIComponent(id)}`, { headers: webHeaders(w.jar) });
    const ma = pageMarkers(pageAuth.text);
    check(pageAuth.status === 200 && !ma, 'content: web announcement page (signed in)', `${brief(pageAuth)}${ma ? ` ${ma}` : ''}`);
  } else {
    skip('content: web signed-in checks', hasCreds('merchant') ? 'merchant web login failed' : 'SEED_MERCHANT_PASSWORD not set');
  }
}

async function groupRoles() {
  // Merchant (unrestricted).
  const m = await webLogin('merchant');
  if (m?.r.status === 200) {
    const r = await http(`${WEB}/merchant`, { headers: webHeaders(m.jar) });
    const mk = pageMarkers(r.text);
    check(r.status === 200 && !mk, 'roles: merchant GET /merchant', `${brief(r)}${r.status !== 200 ? ` location=${locPath(r) || '-'}` : ''}${mk ? ` ${mk}` : ''}`);
  } else {
    skip('roles: merchant GET /merchant', hasCreds('merchant') ? 'merchant web login failed' : 'SEED_MERCHANT_PASSWORD not set');
  }

  // Resident (confined to /home and /profile).
  if (!hasCreds('resident')) {
    skip('roles: resident checks', 'SMOKE_RESIDENT_EMAIL / SMOKE_RESIDENT_PASSWORD not set');
  } else {
    const r = await webLogin('resident');
    if (r?.r.status !== 200) {
      fail('roles: resident web login', r ? brief(r.r) : 'login failed earlier');
    } else {
      const dir = await http(`${WEB}/directory`, { headers: webHeaders(r.jar) });
      check(dir.status === 307 && locPath(dir) === '/home', 'roles: resident /directory -> /home', `${brief(dir)} location=${locPath(dir) || '-'}`);
      const prof = await http(`${WEB}/profile`, { headers: webHeaders(r.jar) });
      check(prof.status === 200 && !pageMarkers(prof.text), 'roles: resident GET /profile', brief(prof));
      const api = await http(`${WEB}/api/profile`, { headers: webHeaders(r.jar) });
      check(api.status === 200, 'roles: resident GET /api/profile', brief(api));
      const blocked = await http(`${WEB}/api/shops`, { headers: webHeaders(r.jar) });
      check(blocked.status === 403, 'roles: resident GET /api/shops -> 403', brief(blocked));
    }
  }

  // Admin.
  if (!hasCreds('admin')) {
    skip('roles: admin GET /admin', 'SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD not set');
  } else {
    const a = await webLogin('admin');
    if (a?.r.status !== 200) {
      fail('roles: admin web login', a ? brief(a.r) : 'login failed earlier');
    } else {
      const r = await http(`${WEB}/admin`, { headers: webHeaders(a.jar) });
      check(r.status === 200 && !pageMarkers(r.text), 'roles: admin GET /admin', `${brief(r)}${r.status !== 200 ? ` location=${locPath(r) || '-'}` : ''}`);
    }
  }
}

function cacheVerdict(headers) {
  const cc = (headers.get('cache-control') || '').toLowerCase();
  const maxAge = /(?:^|,)\s*max-age=(\d+)/.exec(cc);
  const sMaxAge = /s-maxage=(\d+)/.exec(cc);
  const fresh = (maxAge && Number(maxAge[1]) > 0) || (sMaxAge && Number(sMaxAge[1]) > 0);
  const vercelCache = headers.get('x-vercel-cache') || '-';
  const ok = !fresh && vercelCache.toUpperCase() !== 'HIT';
  return { ok, detail: `cache-control="${cc || '-'}" x-vercel-cache=${vercelCache}`, isPublic: /\bpublic\b/.test(cc) };
}

async function groupSecurity() {
  const r = await http(`${WEB}/`);
  const csp = r.headers.get('content-security-policy') || '';
  check(/default-src/.test(csp) && /frame-ancestors|default-src/.test(csp), 'security: CSP header on web', csp ? `present (${csp.split(';').length} directives)` : 'missing');
  const hsts = r.headers.get('strict-transport-security') || '';
  const hstsAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] || 0);
  check(hstsAge >= 15_552_000, 'security: HSTS header on web', hsts ? `max-age=${hstsAge}` : 'missing');
  const xfo = (r.headers.get('x-frame-options') || '').toUpperCase();
  check(xfo === 'DENY' || xfo === 'SAMEORIGIN', 'security: X-Frame-Options on web', xfo || 'missing');
  const xcto = (r.headers.get('x-content-type-options') || '').toLowerCase();
  check(xcto === 'nosniff', 'security: X-Content-Type-Options on web', xcto || 'missing');

  const g = await http(`${WEB}/api/auth/session`);
  const gv = cacheVerdict(g.headers);
  check(g.status === 200 && gv.ok, 'security: /api/auth/session (guest) not cacheable', `${brief(g)} ${gv.detail}`);

  const w = await webLogin('merchant');
  if (w?.r.status === 200) {
    let ok = true;
    let detail = '';
    for (let i = 0; i < 2; i++) {
      const s = await http(`${WEB}/api/auth/session`, { headers: webHeaders(w.jar) });
      const v = cacheVerdict(s.headers);
      ok = ok && s.status === 200 && v.ok;
      detail = `${brief(s)} ${v.detail}`;
    }
    check(ok, 'security: /api/auth/session (signed in) not cacheable', detail);
  } else {
    skip('security: /api/auth/session (signed in) not cacheable', 'no merchant web session');
  }
}

/** Minimal valid RGB PNG in the EastPark gold. */
function png(w = 16, h = 16) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc = (buf) => {
    let x = 0xffffffff;
    for (const b of buf) x = table[(x ^ b) & 0xff] ^ (x >>> 8);
    return (x ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = 0xb8;
      raw[o + 1] = 0x96;
      raw[o + 2] = 0x6a;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function groupWrites() {
  const w = await webLogin('merchant');
  if (w?.r.status !== 200) {
    skip('writes: image uploads', hasCreds('merchant') ? 'merchant web login failed' : 'SEED_MERCHANT_PASSWORD not set');
    return;
  }
  const sbUrl = env('SUPABASE_URL');
  const sbKey = env('SUPABASE_SERVICE_KEY');
  const bucket = env('SUPABASE_BUCKET', 'eastpark-uploads');
  const created = [];

  for (const purpose of ['avatar', 'feedback']) {
    const name = `upload ${purpose}`;
    const fd = new FormData();
    fd.append('file', new Blob([png()], { type: 'image/png' }), 'smoke.png');
    const r = await http(`${WEB}/api/uploads/image?purpose=${purpose}`, {
      method: 'POST',
      headers: webHeaders(w.jar, { origin: WEB }),
      body: fd,
    });
    const data = unwrap(r.json) || {};
    let urlHost = '-';
    let urlOk = false;
    try {
      const u = new URL(data.url);
      urlHost = u.host;
      // The path must be the tail of the public URL: proves it is the object this run created.
      urlOk = typeof data.path === 'string' && data.path.length > 0 && !data.path.includes('..') && decodeURIComponent(u.pathname).endsWith(`/${bucket}/${data.path}`);
    } catch {
      urlOk = false;
    }
    if (r.status !== 200 || !urlOk) {
      fail(`writes: ${name}`, `${brief(r)} url-matches-path=${urlOk}`);
      continue;
    }
    created.push(data.path);
    const folder = data.path.split('/')[0];
    pass(`writes: ${name}`, `status=200 host=${urlHost} folder=${folder}`);
    const img = await http(data.url, { timeout: 30_000 });
    const ct = (img.headers.get('content-type') || '').split(';')[0];
    check(img.status === 200 && ct === 'image/png', `writes: ${purpose} public URL loads`, `status=${img.status} content-type=${ct || '-'}`);
  }

  // Cleanup: delete ONLY the exact objects created above.
  if (!created.length) return;
  if (!sbUrl || !sbKey) {
    fail('writes: cleanup', `SUPABASE_URL / SUPABASE_SERVICE_KEY not set; ${created.length} object(s) left in bucket`);
    return;
  }
  const sbHeaders = { apikey: sbKey, authorization: `Bearer ${sbKey}`, 'content-type': 'application/json' };
  const del = await http(`${sbUrl.replace(/\/+$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
    headers: sbHeaders,
    body: JSON.stringify({ prefixes: created }),
  });
  const deleted = Array.isArray(del.json) ? del.json.length : 0;
  check(del.status === 200 && deleted === created.length, 'writes: cleanup delete', `status=${del.status} deleted=${deleted}/${created.length}`);

  let remaining = 0;
  for (const p of created) {
    const dir = p.split('/').slice(0, -1).join('/');
    const base = p.split('/').pop();
    const list = await http(`${sbUrl.replace(/\/+$/, '')}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers: sbHeaders,
      body: JSON.stringify({ prefix: dir, search: base, limit: 100, offset: 0 }),
    });
    if (list.status !== 200 || !Array.isArray(list.json)) {
      remaining = -1;
      break;
    }
    if (list.json.some((o) => o.name === base)) remaining++;
  }
  check(remaining === 0, 'writes: cleanup verified by listing', remaining < 0 ? 'list call failed' : `remaining=${remaining}`);
}

async function groupThrottle() {
  // Direct to the API without the BFF secret, rotating spoofed X-Forwarded-For values. The backend must
  // key on the real client IP, so one of the first 6 calls must hit 429. (A client-sent CF-Connecting-IP
  // is rejected by Cloudflare with 403 before it reaches Render, so it is not sent here.)
  console.log('....  throttle: waiting for an empty auth window, then 7 spoofed logins (locks login for ~60 s)');
  if (authCalls.length) await sleep(AUTH_WINDOW_MS - (Date.now() - authCalls[authCalls.length - 1]) + 250);
  const statuses = [];
  for (let i = 1; i <= 7; i++) {
    const r = await http(`${API}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `203.0.113.${i}`,
      },
      body: JSON.stringify({ email: `smoke-${randomUUID()}@example.com`, password: 'Wrong-Password-123' }),
    });
    statuses.push(r.status);
    authCalls.push(Date.now());
  }
  const first429 = statuses.indexOf(429) + 1;
  check(first429 > 0 && first429 <= 6, 'throttle: spoofed X-Forwarded-For does not create new buckets', `statuses=${statuses.join(',')}`);
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

const started = Date.now();
console.log(`EastPark smoke  web=${new URL(WEB).host}  api=${new URL(API).host}  groups=${ONLY ? ONLY.join(',') : DEFAULT_GROUPS.join(',')}${WITH_WRITES && !ONLY ? ',writes' : ''}`);

const steps = [
  ['pages', groupPages],
  ['auth', groupAuth],
  ['content', groupContent],
  ['roles', groupRoles],
  ['security', groupSecurity],
  ['writes', groupWrites],
  ['throttle', groupThrottle],
];

try {
  // Health always runs first: it warms a cold Render instance for every other group.
  const healthy = await groupHealth();
  if (!healthy) console.log('....  backend unhealthy; continuing so the report shows what still works');
  for (const [group, fn] of steps) {
    if (!wants(group)) continue;
    try {
      await fn();
    } catch (e) {
      fail(`${group}: unexpected error`, `${e.name}: ${String(e.message).slice(0, 120)}`);
    }
  }
} finally {
  try {
    await finalLogout();
  } catch (e) {
    fail('auth: final logout', `${e.name}`);
  }
}

const count = (s) => results.filter((r) => r.status === s).length;
console.log(`\nSummary: ${count('PASS')} passed, ${count('FAIL')} failed, ${count('SKIP')} skipped in ${Math.round((Date.now() - started) / 1000)}s`);
process.exitCode = count('FAIL') ? 1 : 0;
