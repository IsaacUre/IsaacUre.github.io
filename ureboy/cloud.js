/* ============================================================
   URE BOY — cloud.js
   Optional cross-device sync, backed by a single GitHub Gist.

   The console works fully WITHOUT this file and without cloud
   configured. When a gist id is present, accounts + saves roam
   across devices:
     - READ is public (any device can log in and pull saves with
       no token at all),
     - WRITE needs a `gist`-scoped GitHub token pasted once per
       device (kept only in that device's localStorage, never
       committed — so GitHub's secret scanning can't revoke it and
       no random visitor can write the store).

   Security is intentionally minimal: the gist is PUBLIC, so the
   (fake) passcode hashes and save blobs are world-readable. Do not
   use a real password. The only genuinely sensitive value — the
   write token — never leaves the device it was entered on.

   Exposes window.UreCloud. app.js drives the login flow and calls
   in; this module owns all gist I/O and the two-way save merge.
   ============================================================ */
(function () {
    'use strict';

    var CFG = {
        /* Bake a gist id here to ship cloud "on" for every visitor. Empty means
           cloud is off until a device configures it at runtime via setup(). The
           id is safe to publish — it is just an identifier and reads are public.
           This secret gist holds accounts + saves so one login works across
           devices (read needs no token; writing needs a per-device `gist` token
           added via the `sync` prompt). */
        gistId: '8eff04f6465ebec97ccc6448279b7e39',
        file: 'ureboy-cloud.json',
        schema: 1,
        debounceMs: 2500,      // coalesce rapid game saves into one push
        cacheMs: 4000,         // blob fetch cache (avoids hammering the rate limit)
        timeoutMs: 8000        // per-request ceiling so offline never hangs the UI
    };

    /* Device-global config keys. They deliberately do NOT match app.js's
       per-user namespacing pattern (^ub_ / ^uq_), so they stay device-scoped
       and are never rewritten to u:<name>:… */
    var K_TOKEN = 'ureboy_cloud_token';
    var K_GIST = 'ureboy_cloud_gist';
    var K_API = 'ureboy_cloud_api';      // test override; defaults to api.github.com

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function lsRm(k) { try { localStorage.removeItem(k); } catch (e) {} }

    function apiBase() { return lsGet(K_API) || 'https://api.github.com'; }
    function gistId() { return lsGet(K_GIST) || CFG.gistId || ''; }
    function token() { return lsGet(K_TOKEN) || ''; }

    function ready() { return !!gistId(); }
    function canWrite() { return !!token(); }
    function status() { return !ready() ? 'off' : (canWrite() ? 'rw' : 'ro'); }

    /* ---------------- low-level gist HTTP ---------------- */
    function withTimeout(promise, ctrl) {
        var t = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, CFG.timeoutMs);
        return promise.then(function (r) { clearTimeout(t); return r; },
                            function (e) { clearTimeout(t); throw e; });
    }
    function ghFetch(path, opts) {
        opts = opts || {};
        var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var headers = { 'Accept': 'application/vnd.github+json' };
        if (opts.auth && token()) headers['Authorization'] = 'token ' + token();
        if (opts.body) headers['Content-Type'] = 'application/json';
        var init = {
            method: opts.method || 'GET',
            headers: headers,
            body: opts.body ? JSON.stringify(opts.body) : undefined
        };
        if (ctrl) init.signal = ctrl.signal;
        if (opts.keepalive) init.keepalive = true;
        var p = fetch(apiBase() + path, init).then(function (res) {
            if (!res.ok) {
                var err = new Error('gh ' + res.status);
                err.status = res.status;
                throw err;
            }
            return res.json();
        });
        return ctrl ? withTimeout(p, ctrl) : p;
    }

    /* ---------------- the cloud blob ---------------- */
    function emptyBlob() { return { v: CFG.schema, rev: 0, users: {}, saves: {} }; }
    function parseGist(gist) {
        try {
            var f = gist && gist.files && gist.files[CFG.file];
            if (!f || !f.content) return emptyBlob();
            var b = JSON.parse(f.content);
            if (!b || typeof b !== 'object') return emptyBlob();
            b.users = b.users || {};
            b.saves = b.saves || {};
            b.rev = b.rev || 0;
            return b;
        } catch (e) { return emptyBlob(); }
    }

    var cache = { at: 0, blob: null };
    function fetchBlob(force) {
        if (!ready()) return Promise.resolve(null);
        var now = Date.now();
        if (!force && cache.blob && now - cache.at < CFG.cacheMs) {
            return Promise.resolve(cache.blob);
        }
        return ghFetch('/gists/' + gistId(), { auth: true }).then(function (gist) {
            cache.blob = parseGist(gist);
            cache.at = Date.now();
            return cache.blob;
        });
    }

    /* Read-modify-write against a gist, which has no compare-and-swap. Two guards:
       (1) a same-device single-flight mutex (writeLock) so this device never has two
       PATCHes racing each other; (2) a genuine post-write verification — a gist PATCH
       echoes back exactly what we sent, so trusting the response can't detect a
       concurrent writer. We re-GET after the PATCH and, if the true stored content
       isn't ours, another device wrote in the window: re-fetch, re-merge, retry. */
    var writeLock = Promise.resolve();
    function writeBlob(mutate, opts) {
        var run = function () { return doWrite(mutate, opts || {}, 4); };
        var p = writeLock.then(run, run);
        writeLock = p.then(function () {}, function () {});   // keep the chain alive past errors
        return p;
    }
    function doWrite(mutate, opts, tries) {
        if (!ready()) return Promise.reject(new Error('cloud off'));
        if (!canWrite()) return Promise.reject(new Error('read-only (no token on this device)'));
        return fetchBlob(true).then(function (blob) {
            var next = JSON.parse(JSON.stringify(blob));
            if (mutate(next) === false) return blob;      // nothing to write
            next.rev = (blob.rev || 0) + 1;
            var nextStr = JSON.stringify(next);
            var files = {};
            files[CFG.file] = { content: nextStr };
            return ghFetch('/gists/' + gistId(), { method: 'PATCH', auth: true, body: { files: files }, keepalive: opts.keepalive })
                .then(function (gist) {
                    var written = parseGist(gist);
                    cache.blob = written; cache.at = Date.now();
                    if (tries <= 0 || opts.keepalive) return written;   // beacon path: no verify round-trip
                    return fetchBlob(true).then(function (fresh) {
                        if (JSON.stringify(fresh) === nextStr) return fresh;   // our write survived
                        return doWrite(mutate, opts, tries - 1);               // clobbered -> re-merge & retry
                    }, function () { return written; });                        // verify GET failed: trust the write
                });
        });
    }

    /* ---------------- accounts ---------------- */
    /* record shape matches app.js's local ub_users entry: { h, c, l } */
    function getUser(name) {
        return fetchBlob(false).then(function (blob) {
            if (!blob) return null;
            return Object.prototype.hasOwnProperty.call(blob.users, name) ? blob.users[name] : null;
        });
    }
    function createUser(name, rec) {
        var taken = false;
        return writeBlob(function (blob) {
            if (Object.prototype.hasOwnProperty.call(blob.users, name)) { taken = true; return false; }
            blob.users[name] = rec;
            if (!blob.saves[name]) blob.saves[name] = {};
            return true;
        }).then(function () { return { ok: !taken, taken: taken }; });
    }
    function touchUser(name) {
        return writeBlob(function (blob) {
            if (!Object.prototype.hasOwnProperty.call(blob.users, name)) return false;
            blob.users[name].l = Date.now();
            return true;
        });
    }
    function deleteUser(name) {
        return writeBlob(function (blob) {
            delete blob.users[name];
            delete blob.saves[name];
            return true;
        });
    }
    function setUserHash(name, rec) {
        return writeBlob(function (blob) { blob.users[name] = rec; if (!blob.saves[name]) blob.saves[name] = {}; return true; });
    }

    /* ---------------- per-device sync meta ----------------
       Tracks the last-known timestamp we've reconciled for each of a user's
       save keys, so pull() knows which side is newer. Stored at a key that
       does NOT match ^ub_/^uq_, so the namespacing patch leaves it alone. */
    function metaKey(name) { return 'u:' + name + ':__sync'; }
    function loadMeta(name) {
        try { return JSON.parse(lsGet(metaKey(name)) || 'null') || { keys: {}, rev: 0 }; }
        catch (e) { return { keys: {}, rev: 0 }; }
    }
    function saveMeta(name, m) { lsSet(metaKey(name), JSON.stringify(m)); }

    /* a user's real localStorage save keys are u:<name>:ub_… / …:uq_… */
    function userPrefix(name) { return 'u:' + name + ':'; }
    function enumLocal(name) {
        var pre = userPrefix(name), out = [];
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var real = localStorage.key(i);
                if (real && real.indexOf(pre) === 0) {
                    var logical = real.slice(pre.length);
                    if (/^(ub_|uq_)/.test(logical)) {
                        out.push({ logical: logical, real: real, value: localStorage.getItem(real) });
                    }
                }
            }
        } catch (e) {}
        return out;
    }

    /* ---------------- pull: cloud -> local ---------------- */
    function pull(name) {
        if (!ready() || !name) return Promise.resolve(null);
        return fetchBlob(true).then(function (blob) {
            if (!blob) return null;
            var meta = loadMeta(name);
            var cloudSaves = blob.saves[name] || {};
            var localByLogical = {};
            enumLocal(name).forEach(function (e) { localByLogical[e.logical] = e; });
            var applied = 0;
            for (var key in cloudSaves) {
                if (!Object.prototype.hasOwnProperty.call(cloudSaves, key)) continue;
                var cv = cloudSaves[key];               // { v: string|null, t: int }
                var localT = meta.keys[key] || 0;
                var lv = localByLogical[key] ? localByLogical[key].value : null;
                /* symmetric with push: cloud wins if newer, or same-ms tie with a
                   lexicographically-greater value (same deterministic winner) */
                if (cv.t > localT || (cv.t === localT && String(cv.v) > String(lv))) {
                    var real = userPrefix(name) + key;
                    if (cv.v === null || cv.v === undefined) { lsRm(real); }
                    else { lsSet(real, cv.v); }
                    meta.keys[key] = cv.t;
                    applied++;
                }
            }
            meta.rev = blob.rev || 0;
            saveMeta(name, meta);
            return { applied: applied, rev: meta.rev };
        });
    }

    /* ---------------- push: local -> cloud ---------------- */
    var pending = {};   // name -> true (has un-pushed local changes)
    var timer = null;
    function push(name, opts) {
        if (!ready() || !canWrite() || !name) return Promise.resolve(null);
        var meta = loadMeta(name);
        var locals = enumLocal(name);
        var localSet = {};
        locals.forEach(function (e) { localSet[e.logical] = true; });
        return writeBlob(function (blob) {
            /* blob here is the FRESHEST cloud (writeBlob force-fetches), so this is a
               true "max timestamp wins" merge: a local key overwrites cloud only when
               its stamp is strictly newer, which can't clobber another device's later
               write even from a debounced push that skipped the login pull. */
            var cloudSaves = blob.saves[name] = blob.saves[name] || {};
            var changed = false;
            for (var i = 0; i < locals.length; i++) {
                var e = locals[i];
                var t = meta.keys[e.logical] || Date.now();
                var existing = cloudSaves[e.logical];
                /* newer wins; on an exact-ms tie the lexicographically-greater value
                   wins deterministically so both devices converge (no ping-pong) */
                if (!existing || t > existing.t || (t === existing.t && String(e.value) > String(existing.v))) {
                    cloudSaves[e.logical] = { v: e.value, t: t };
                    changed = true;
                }
            }
            /* local deletions become tombstones (a key we've synced before, now gone) */
            for (var key in meta.keys) {
                if (!Object.prototype.hasOwnProperty.call(meta.keys, key)) continue;
                if (!localSet[key]) {
                    var cur = cloudSaves[key];
                    var dt = meta.keys[key] || Date.now();
                    if (!cur || (cur.v !== null && dt > cur.t)) {
                        cloudSaves[key] = { v: null, t: Math.max(dt, cur ? cur.t + 1 : dt) };
                        changed = true;
                    }
                }
            }
            return changed;
        }, opts).then(function (written) {
            if (written) { meta.rev = written.rev; saveMeta(name, meta); }
            return written;
        });
    }
    function flush() {
        if (timer) { clearTimeout(timer); timer = null; }
        var names = Object.keys(pending);
        pending = {};
        return Promise.all(names.map(function (n) {
            return push(n).catch(function () { pending[n] = true; });  // re-queue on failure
        }));
    }
    function schedule() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { timer = null; flush(); }, CFG.debounceMs);
    }
    /* called by app.js's storage hook on every namespaced write while a
       cloud user is logged in. value === null means the key was removed. */
    function noteWrite(name, logicalKey, value) {
        if (!ready() || !name) return;
        var meta = loadMeta(name);
        meta.keys[logicalKey] = Date.now();
        saveMeta(name, meta);
        if (!canWrite()) return;      // read-only device: stamp locally, don't push
        pending[name] = true;
        schedule();
    }
    /* best-effort flush when the tab is closing/hidden. keepalive:true lets the PATCH
       survive teardown (and skips the verify round-trip that wouldn't finish); if it
       still doesn't land, the change is safe locally and re-pushes at the next login. */
    function flushBeacon() {
        if (!canWrite()) return;
        var names = Object.keys(pending);
        if (!names.length) return;
        pending = {};
        names.forEach(function (n) { push(n, { keepalive: true }).catch(function () {}); });
    }

    /* ---------------- setup / teardown ---------------- */
    /* Validate a token and (optionally) a gist id. If no gist id is given,
       create a fresh cloud gist. Persists both on this device. */
    function setup(tok, gid) {
        tok = (tok || '').trim();
        if (!tok) return Promise.reject(new Error('a token is required to enable writing'));
        lsSet(K_TOKEN, tok);
        gid = (gid || '').trim();
        if (gid) {
            lsSet(K_GIST, gid);
            return fetchBlob(true).then(function () { return { gistId: gid }; })
                .catch(function (e) { lsRm(K_GIST); throw e; });
        }
        /* create a new private-by-obscurity public gist to hold the cloud */
        var files = {};
        files[CFG.file] = { content: JSON.stringify(emptyBlob()) };
        return ghFetch('/gists', { method: 'POST', auth: true, body: {
            description: 'URE BOY cloud save — public, do not store secrets',
            'public': false, files: files
        } }).then(function (gist) {
            if (!gist || !gist.id) throw new Error('gist create failed');
            lsSet(K_GIST, gist.id);
            cache.blob = parseGist(gist); cache.at = Date.now();
            return { gistId: gist.id, created: true };
        });
    }
    function addToken(tok) {   // enable writes on a device that already knows the gist id
        tok = (tok || '').trim();
        if (!tok) return Promise.reject(new Error('empty token'));
        var prev = token();
        lsSet(K_TOKEN, tok);
        /* verify the token can actually WRITE (a read passes even for a bad/scopeless
           token since the gist is public-read) by rewriting the blob unchanged */
        return writeBlob(function () { return true; })
            .then(function () { return { ok: true }; })
            .catch(function (e) {
                if (prev) lsSet(K_TOKEN, prev); else lsRm(K_TOKEN);   // roll back — don't keep a token we couldn't write with
                throw new Error('could not enable writes — check the token has the "gist" scope (or retry if GitHub is busy)');
            });
    }
    function useGist(gid) { gid = (gid || '').trim(); if (gid) { lsSet(K_GIST, gid); cache.blob = null; } }
    function forget() { lsRm(K_TOKEN); lsRm(K_GIST); cache.blob = null; pending = {}; }
    function forgetToken() { lsRm(K_TOKEN); }

    window.UreCloud = {
        ready: ready, canWrite: canWrite, status: status, gistId: gistId,
        fetchBlob: fetchBlob,
        getUser: getUser, createUser: createUser, touchUser: touchUser,
        deleteUser: deleteUser, setUserHash: setUserHash,
        pull: pull, push: push, flush: flush, noteWrite: noteWrite, flushBeacon: flushBeacon,
        setup: setup, addToken: addToken, useGist: useGist, forget: forget, forgetToken: forgetToken
    };
    if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('pagehide', flushBeacon);
        window.addEventListener('visibilitychange', function () { if (document.hidden) flushBeacon(); });
    }
})();
