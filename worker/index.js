/* ============================================================
   URE FETCH — the museum's allowlisted read-only fetcher
   ------------------------------------------------------------
   A deliberately small Cloudflare Worker. It exists so the pixel
   browser in /comp/ can (a) read pages from sites that refuse to
   be framed and (b) reach a handful of APIs that send no CORS
   headers. It is NOT a general proxy: it will only ever touch
   hosts named in ALLOW below, and it only ever performs GET.

   Everything here is deny-by-default. The rules that matter:
     · hostname must MATCH an allowlist entry exactly, or be a
       subdomain of one. Never a substring — "evil-wikipedia.org"
       and "wikipedia.org.evil.com" must both fail.
     · redirects are followed manually, and every hop is
       re-validated. A 302 to an internal address is the classic
       way an allowlisted fetcher becomes an SSRF hole.
     · nothing authenticating travels in either direction: no
       cookies, no auth headers, and the response's Set-Cookie is
       dropped on the way back.
     · responses are capped by size and content-type, so this can
       never be used as a file mirror.
     · the browser cannot set a User-Agent; we can, and Nominatim
       and the Wikimedia APIs are entitled to know who is calling.
   ============================================================ */

/* Hosts this worker may fetch. A leading dot means "this domain and
   any subdomain"; a bare name means that exact host only.
   Keep this list boring and short. */
const ALLOW = [
  // --- APIs the browser can't reach itself (no CORS headers) ---
  'api.frankfurter.app',            // currency, ECB data
  'api.gdeltproject.org',           // world news index
  'www.googleapis.com',             // books
  'hacker-news.firebaseio.com',
  // --- readable content sites ---
  '.wikipedia.org',
  '.wikimedia.org',
  '.wiktionary.org',
  'news.ycombinator.com',
  '.arstechnica.com',
  '.theverge.com',
  '.bbc.co.uk',
  '.bbc.com',
  '.npr.org',
  '.apnews.com',
  '.reuters.com',
  'text.npr.org',
  '.rice.edu',                      // the Thresher, FSAE, campus
  'isaacure.com',
  '.github.com',
  '.githubusercontent.com',
  'stackoverflow.com',
  '.stackexchange.com',
  'developer.mozilla.org',
  '.openstreetmap.org',
  'nominatim.openstreetmap.org',
  'query.wikidata.org',
  'api.dictionaryapi.dev',
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
];

/* Origins allowed to call this worker. Anything else gets a flat no,
   which keeps the endpoint from being handy to a stranger's page. */
const ORIGINS = [
  'https://isaacure.com',
  'https://www.isaacure.com',
  'https://isaacure.github.io',
  'http://localhost:8741',
  'http://127.0.0.1:8741',
];

const MAX_BYTES = 3 * 1024 * 1024;          // 3 MB is a generous article
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10000;
const UA = 'UreFetch/1.0 (+https://isaacure.com; pixel-desktop reader; contact: isaacoure@gmail.com)';

const OK_TYPES = [
  'text/html', 'text/plain', 'application/json', 'application/xml',
  'text/xml', 'application/rss+xml', 'application/atom+xml',
  'application/sparql-results+json', 'application/ld+json',
];

function hostAllowed(hostname) {
  // normalise: lowercase, drop a trailing dot ("example.com." is example.com)
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!h) return false;
  return ALLOW.some((entry) => {
    const e = entry.toLowerCase();
    if (e.startsWith('.')) {
      const bare = e.slice(1);
      return h === bare || h.endsWith(e);   // ".foo.com" matches foo.com and a.foo.com, never xfoo.com
    }
    return h === e;                          // exact only
  });
}

/* Reject anything that isn't a plain https URL to an allowlisted host.
   Credentials in the URL are refused outright rather than stripped:
   "https://user@allowed.example@evil.com/" is a parser-confusion classic. */
function validate(raw) {
  let u;
  try { u = new URL(raw); } catch { return { err: 'unparseable URL' }; }
  if (u.protocol !== 'https:') return { err: 'https only' };
  if (u.username || u.password) return { err: 'credentials not allowed in URL' };
  if (u.port && u.port !== '443') return { err: 'non-standard port not allowed' };
  if (!hostAllowed(u.hostname)) return { err: 'host not on the allowlist' };
  return { url: u };
}

function corsHeaders(origin) {
  const allowed = ORIGINS.includes(origin) ? origin : ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function fail(status, message, origin) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'GET') return fail(405, 'GET only', origin);

    // A browser always sends Origin on a cross-origin fetch. Absent means a
    // direct hit (curl, a scanner) — allowed for /health only.
    const reqUrl = new URL(request.url);
    if (reqUrl.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, hosts: ALLOW.length }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
    if (origin && !ORIGINS.includes(origin)) return fail(403, 'origin not allowed', origin);

    const target = reqUrl.searchParams.get('url');
    if (!target) return fail(400, 'missing ?url=', origin);

    let check = validate(target);
    if (check.err) return fail(403, check.err, origin);

    // Serve from Cloudflare's cache when we can: the politest request to a
    // free API is the one we never make.
    const cache = caches.default;
    const cacheKey = new Request(reqUrl.origin + reqUrl.pathname + '?url=' + encodeURIComponent(check.url.toString()), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) {
      const r = new Response(cached.body, cached);
      Object.entries(corsHeaders(origin)).forEach(([k, v]) => r.headers.set(k, v));
      r.headers.set('X-Ure-Cache', 'hit');
      return r;
    }

    // Follow redirects by hand so every hop can be re-checked. redirect:'follow'
    // would happily land us somewhere the allowlist never approved.
    let current = check.url;
    let upstream = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        upstream = await fetch(current.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': UA,
            'Accept': 'text/html,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.5',
            'Accept-Language': 'en',
            // deliberately absent: Cookie, Authorization, and anything else
            // that could carry identity from the caller to the target
          },
        });
      } catch (e) {
        clearTimeout(timer);
        return fail(504, 'upstream did not answer', origin);
      }
      clearTimeout(timer);

      if (upstream.status >= 300 && upstream.status < 400) {
        const loc = upstream.headers.get('Location');
        if (!loc) return fail(502, 'redirect without a destination', origin);
        let next;
        try { next = new URL(loc, current); } catch { return fail(502, 'unparseable redirect', origin); }
        const recheck = validate(next.toString());
        if (recheck.err) return fail(403, 'redirect left the allowlist (' + recheck.err + ')', origin);
        current = recheck.url;
        if (hop === MAX_REDIRECTS) return fail(508, 'too many redirects', origin);
        continue;
      }
      break;
    }

    if (!upstream.ok) return fail(upstream.status === 404 ? 404 : 502, 'upstream returned ' + upstream.status, origin);

    const ctype = (upstream.headers.get('Content-Type') || '').toLowerCase();
    const base = ctype.split(';')[0].trim();
    if (!OK_TYPES.includes(base)) return fail(415, 'unsupported content type: ' + (base || 'unknown'), origin);

    const declared = parseInt(upstream.headers.get('Content-Length') || '0', 10);
    if (declared && declared > MAX_BYTES) return fail(413, 'response too large', origin);

    // Read with a hard ceiling — Content-Length can lie or be absent entirely.
    const reader = upstream.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) { reader.cancel(); return fail(413, 'response too large', origin); }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { body.set(c, at); at += c.byteLength; }

    const out = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': ctype || 'text/plain; charset=utf-8',
        'X-Ure-Final-Url': current.toString(),     // the client shows where it actually landed
        'Cache-Control': 'public, max-age=600',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        ...corsHeaders(origin),
        // Set-Cookie and every other upstream header are simply not copied.
      },
    });
    ctx.waitUntil(cache.put(cacheKey, out.clone()));
    return out;
  },
};
