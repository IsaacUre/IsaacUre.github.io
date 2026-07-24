# URE FETCH — the museum's allowlisted read-only fetcher

A ~200-line Cloudflare Worker. It lets the pixel browser in `/comp/` read pages
from sites that refuse to be framed, and reach a few APIs that send no CORS
headers.

**The site works completely without it.** Until a proxy URL is configured, every
page behaves exactly as it does today — unknown sites fall back to the sandboxed
iframe, and the APIs that need the worker simply don't appear. It is an
accelerator, never a dependency.

## Deploying it

One time:

```bash
npx wrangler login
```

Then, from this directory:

```bash
npx wrangler deploy
```

Wrangler prints a URL like `https://ure-fetch.<your-subdomain>.workers.dev`.
Paste that into the pixel desktop: **Chrome → ⋮ → Settings → Reader proxy**.
It's stored in `localStorage` (`comp_proxy`) and never committed.

Check it's alive:

```bash
curl https://ure-fetch.<your-subdomain>.workers.dev/health
```

## What it will and won't do

It fetches **only** hosts named in `ALLOW` at the top of `index.js`, and only
ever with `GET`. Everything else is denied.

- Hostnames must match an entry **exactly**, or be a subdomain of a `.example.com`
  entry. Substring matching is never used, so `evil-wikipedia.org` and
  `wikipedia.org.evil.com` both fail.
- Redirects are followed **manually** and every hop is re-validated. A `302` into
  an internal address is the standard way an allowlisted fetcher turns into an
  SSRF hole.
- Nothing authenticating crosses in either direction: no `Cookie`, no
  `Authorization`, and the upstream's `Set-Cookie` is dropped on the way back.
- Responses are capped at 3 MB and restricted to text/HTML/JSON/XML types, so it
  can't be used as a file mirror.
- URLs carrying credentials (`https://user:pass@host/`), non-443 ports, and
  non-`https` schemes are refused.
- Only the origins in `ORIGINS` may call it.
- It sends a real, identifying `User-Agent` — which is what Nominatim and the
  Wikimedia APIs ask for and a browser cannot provide.

It holds no secrets and no state, so there is nothing in it to steal.

## Adding a site

Add the hostname to `ALLOW` and redeploy. Prefer an exact host over a `.domain`
wildcard unless you actually want the subdomains.

## Cost

Cloudflare's free tier covers 100,000 requests/day. Responses are cached at the
edge for 10 minutes, so repeat reads of the same page cost nothing upstream.
