/* Geometry audit for NINTH NIGHT.
 *
 *   node .claude/ninth-night/tools/audit-geometry.js
 *
 * Parses the PLACES and NPCS literals straight out of comp/ninth.js and
 * re-derives, at the real player radius, whether the world is actually
 * playable: can you stand in every exit band, can you reach every person
 * and every examinable, does every arrival land somewhere solid.
 *
 * Every category below has been a real shipped bug. The mark's only exit
 * was once entirely inside its own fence, a one way trap that survived a
 * reload, and it looked perfectly fine in a screenshot.
 *
 * Exit code 1 if anything is wrong, so it can gate a commit.
 */
'use strict';

var fs = require('fs');
var path = require('path');

var FILE = path.join(__dirname, '..', '..', '..', 'comp', 'ninth.js');
var src = fs.readFileSync(FILE, 'utf8');

var R = 0.3;          // moveActor's default radius
var GRID = 17;        // default place size, and the current hard ceiling
var MARGIN = 0.5;     // moveActor clamps to 0.5 .. size-0.5

function grab(name, kind) {
    kind = kind || '{';
    var close = kind === '[' ? ']' : '}';
    var i = src.indexOf('var ' + name + ' = ' + kind);
    if (i < 0) throw new Error('could not find `var ' + name + '` in ' + FILE);
    var start = src.indexOf(kind, i), depth = 0, j = start;
    for (; j < src.length; j++) {
        if (src[j] === kind) depth++;
        else if (src[j] === close) { depth--; if (!depth) break; }
    }
    /* the literals are plain data plus function-valued talk() fields, so
       evaluating them standalone is safe enough and far more honest than
       a regex. S and sSave are stubbed for the talk bodies. */
    var S = { heard: {}, seen: {}, frags: {}, a3: {} };
    var sSave = function () {};
    return eval('(' + src.slice(start, j + 1) + ')');   // eslint-disable-line no-eval
}

var PLACES = grab('PLACES');
var NPCS = grab('NPCS');
var MAP_SEED = grab('MAP_SEED');
var MAP_HIDE = grab('MAP_HIDE');
var PROP = grab('PROP');
var FLOOR_PAL = grab('FLOOR_PAL');
var A3_ROWS = grab('A3_ROWS', '[');
var SPRITE_BUDGET = (function () {
    var m = /SPRITE_BUDGET = (\d+) << 20/.exec(src);
    return m ? +m[1] * 1048576 : 0;
})();

/* The map is derived from the exit graph now rather than hand kept, so
   the audit derives it the same way and checks the derivation, instead
   of checking a table that can no longer be forgotten. Keep this in step
   with buildMap()/exitDir() in the game. */
function exitDir(p, e) {
    if (e.dir) return e.dir;                      // an exit may say which way it goes
    var W = p.w || GRID, H = p.h || GRID;
    var dx = e.x < W * 0.25 ? -1 : e.x > W * 0.75 ? 1 : 0;
    var dy = e.y < H * 0.25 ? -1 : e.y > H * 0.75 ? 1 : 0;
    if (dx && dy) { if (Math.abs(e.x - W / 2) / W > Math.abs(e.y - H / 2) / H) dy = 0; else dx = 0; }
    if (!dx && !dy) dy = -1;
    return [dx, dy];
}
var SLIPS = [];
function buildMap() {
    var pos = {}, taken = {}, k;
    function hold(id, c) { pos[id] = c; if (!MAP_HIDE[id]) taken[c.join(',')] = id; }
    for (k in MAP_SEED) if (PLACES[k]) hold(k, MAP_SEED[k].slice());
    var q = ['square'], guard = 0;
    while (q.length && guard++ < 400) {
        var id = q.shift(), p = PLACES[id]; if (!p || !pos[id]) continue;
        (p.exits || []).forEach(function (e) {
            if (!PLACES[e.to] || pos[e.to]) return;
            var d = exitDir(p, e), c = [pos[id][0] + d[0], pos[id][1] + d[1]], want = c.slice(), slip = 0;
            while (taken[c.join(',')] && slip < 12) {
                slip++;
                if (d[0]) c[1] = pos[id][1] + (slip % 2 ? 1 : -1) * Math.ceil(slip / 2);
                else c[0] = pos[id][0] + (slip % 2 ? 1 : -1) * Math.ceil(slip / 2);
            }
            /* A slip is the map about to lie about where somewhere is, and
               it is the only warning available: the "two places on one
               cell" check cannot fire, because sliding is exactly what
               stops that happening. The mill sat two columns east of Wick
               on Wick's own row for a release because of one of these. */
            if (slip && !MAP_HIDE[e.to]) SLIPS.push(e.to + ': its cell on the map was decided by collision, not by direction. "' +
                e.n + '" points ' + d + ' out of ' + id + ' so it wanted ' + want + ', which is held by ' +
                taken[want.join(',')] + '. It ended up at ' + c + '.');
            hold(e.to, c); q.push(e.to);
        });
    }
    var spare = 0;
    Object.keys(PLACES).forEach(function (id) {
        if (pos[id] || MAP_HIDE[id]) return;
        while (taken[(-1) + ',' + spare] && spare < 40) spare++;
        hold(id, [-1, spare]); spare++;
    });
    return pos;
}
var MAP_POS = buildMap();

var problems = [];
function bad(msg) { problems.push(msg); }

/* In step with the game: `ins` is what fraction of its footprint a prop
   actually is, and blocked() honours it now. */
function solidBox(o) {
    var b = o.b, d = PROP[o.t] || PROP._, k = d.ins;
    if (!k || k >= 1) return b;
    var iw = b[2] * k, ih = b[3] * k;
    return [b[0] + (b[2] - iw) / 2, b[1] + (b[3] - ih) / 2, iw, ih];
}
function blocked(p, x, y, r) {
    var ps = p.props || [];
    for (var i = 0; i < ps.length; i++) {
        var b = solidBox(ps[i]);
        if (x + r > b[0] && x - r < b[0] + b[2] && y + r > b[1] && y - r < b[1] + b[3]) return true;
    }
    return false;
}
/* The game's paintSpan, so "is this prop painted over that person" is
   asked the same way here as it is on screen. Keep in step with
   paintedBox()/paintSpan() in comp/ninth.js. */
function lerp(a, b, t) { return a + (b - a) * t; }
function paintSpan(b, d, lx) {
    var bw = b[2], bh = b[3];
    var rrx = (bw + bh) * 58 / 4, rry = (bw + bh) * 29 / 4;
    var sk = (bw - bh) * 58 / 4, ex = (bw - bh) * 29 / 4;
    var up = d.h + (d.over || 0);
    if (lx < -rrx || lx > rrx) return null;
    var top, bot;
    if (lx <= -sk) top = lerp(-ex, -rry, (lx + rrx) / Math.max(1e-6, rrx - sk));
    else           top = lerp(-rry, ex, (lx + sk) / Math.max(1e-6, rrx + sk));
    if (lx <= sk) bot = lerp(-ex, rry, (lx + rrx) / Math.max(1e-6, rrx + sk));
    else          bot = lerp(rry, ex, (lx - sk) / Math.max(1e-6, rrx - sk));
    var taper = up - (up - d.h) * Math.abs(lx) / Math.max(1e-6, rrx);
    return { top: top - taper, bot: bot + 4 };
}
// how much of a figure `fh` tall standing at (x,y) some prop paints over
function hiddenBy(p, x, y, fh) {
    var k0 = x + y, sx = (x - y) * 29, sy = (x + y) * 14.5, worst = 0, who = null;
    (p.props || []).forEach(function (o) {
        var d = PROP[o.t]; if (!d) return;
        var b = o.b, k = b[0] + b[2] / 2 + b[1] + b[3] / 2;
        if (k <= k0) return;
        var cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
        var mxc = (cx - cy) * 29, myc = (cx + cy) * 14.5;
        var s = paintSpan(b, d, sx - mxc); if (!s) return;
        var ov = Math.min(sy, myc + s.bot) - Math.max(sy - fh, myc + s.top);
        if (ov > worst) { worst = ov; who = o.t + ' [' + b + ']'; }
    });
    return { pct: Math.max(0, worst) / fh, who: who };
}

function standable(p, x, y, W, H) {
    return x >= MARGIN && y >= MARGIN && x <= W - MARGIN && y <= H - MARGIN && !blocked(p, x, y, R);
}

// can you get within the 1.9 tile prompt range of this point, from somewhere you can stand?
function reachable(p, x, y, W, H) {
    for (var a = 0; a < 48; a++) {
        for (var d = 0.35; d < 1.9; d += 0.15) {
            var px = x + Math.cos(a / 48 * Math.PI * 2) * d;
            var py = y + Math.sin(a / 48 * Math.PI * 2) * d;
            if (standable(p, px, py, W, H)) return true;
        }
    }
    return false;
}

Object.keys(PLACES).forEach(function (id) {
    var p = PLACES[id], W = p.w || GRID, H = p.h || GRID;

    /* The 17x17 ceiling is gone: there is a camera. What replaces it is
       memory. A floor bitmap is (w+h) tiles across and prerendered, so
       a place that is huge on both axes costs real megabytes. */
    var px = (W + H) * 29 + 128, py = (W + H) * 14.5 + 157;
    var mb = px * py * 4 / 1048576;
    if (mb > 8) bad(id + ': ' + W + 'x' + H + ' bakes a ' + Math.round(px) + 'x' + Math.round(py) + ' floor, about ' + mb.toFixed(1) + ' MB. Split it or make it narrower.');
    if (W < 5 || H < 5) bad(id + ': ' + W + 'x' + H + ' is too small to stand up in.');

    if (!FLOOR_PAL[p.floor]) {
        bad(id + ': floor "' + p.floor + '" has no palette, so it silently falls back to the mill. Add it to FLOOR_PAL or use a kind that exists.');
    }

    (p.props || []).forEach(function (o) {
        if (o.b[0] < 0 || o.b[1] < 0 || o.b[0] + o.b[2] > W || o.b[1] + o.b[3] > H) {
            bad(id + ': prop "' + o.t + '" [' + o.b + '] sticks out of the ' + W + 'x' + H + ' floor.');
        }
        if (!PROP[o.t]) {
            bad(id + ': prop type "' + o.t + '" is not in PROP, so it draws as an anonymous box. (This is exactly how `stone` hid.)');
        }
    });

    /* Two solids standing in the same square metre. The painter sort
       draws the souther one over the norther one, so the overlap is not
       symmetric and not obvious: Bern's bed was parked across three
       quarters of his hearth, mattress over the fire, and it read as a
       slightly odd corner rather than as a mistake. Walls are exempt
       because everything in a room is meant to stand against one. */
    var solid = (p.props || []).filter(function (o) { return o.t !== 'wall' && o.t !== 'foot' && o.t !== 'beam'; });
    solid.forEach(function (a, i) {
        solid.slice(i + 1).forEach(function (b) {
            var ox = Math.min(a.b[0] + a.b[2], b.b[0] + b.b[2]) - Math.max(a.b[0], b.b[0]);
            var oy = Math.min(a.b[1] + a.b[3], b.b[1] + b.b[3]) - Math.max(a.b[1], b.b[1]);
            if (ox > 0.05 && oy > 0.05) {
                bad(id + ': "' + a.t + '" [' + a.b + '] and "' + b.t + '" [' + b.b + '] overlap by ' +
                    ox.toFixed(1) + 'x' + oy.toFixed(1) + ' tiles. One is drawn through the other.');
            }
        });
    });

    /* Somebody standing where a roof covers them. A tall prop paints up
       and to the left of its own footprint, so a person can be authored
       on open, walkable, reachable ground and still never appear: the
       widow stood three tiles behind a house for a whole release, and
       the game happily offered "E — talk to A woman setting out a lamp"
       over an empty roof. The player gets a cutaway; people do not.

       Three things this used to get wrong. It modelled the paint as a
       bounding box, which for a nine tile wall is mostly empty triangle.
       It hard-coded a 40px figure, and a small NPC is 26, which is how it
       missed the child under the south-east house by 1.1 pixels. And it
       only looked at the tile they are authored on, so a walker could
       spend a third of its loop somewhere this never asked about. */
    (p.npcs || []).forEach(function (nid) {
        var n = NPCS[nid]; if (!n) return;
        var fh = n.small ? 26 : 40;
        var spots = [[n.x, n.y, 'stands']];
        (n.path || []).forEach(function (pt, i) { spots.push([pt[0], pt[1], 'walks to path point ' + i + ' at']); });
        if (n.wander) for (var a = 0; a < 16; a++) {
            var wx = n.x + Math.cos(a / 16 * Math.PI * 2) * n.wander;
            var wy = n.y + Math.sin(a / 16 * Math.PI * 2) * n.wander;
            if (standable(p, wx, wy, W, H)) spots.push([wx, wy, 'can wander to']);
        }
        spots.forEach(function (sp) {
            var h = hiddenBy(p, sp[0], sp[1], fh);
            if (h.pct > 0.9) bad(id + ': ' + nid + ' ' + sp[2] + ' ' + sp[0].toFixed(1) + ',' + sp[1].toFixed(1) +
                ' where "' + h.who + '" is painted over ' + Math.round(h.pct * 100) + '% of them (' + fh + 'px figure). Nothing fades for anybody but the player.');
        });
    });

    /* The Act 3 audience are foes spawned from A3_ROWS, so nothing above
       looks at them, and the cutaway does not fade for them either.
       Seven of the twenty-four were behind one house and one was inside
       it. A seated folk is about 26px. */
    if (id === 'a3sq') A3_ROWS.forEach(function (st, i) {
        if (blocked(p, st[0], st[1], R)) bad(id + ': A3_ROWS seat ' + i + ' [' + st + '] is inside a prop.');
        var h = hiddenBy(p, st[0], st[1], 26);
        if (h.pct > 0.5) bad(id + ': A3_ROWS seat ' + i + ' [' + st + '] is ' + Math.round(h.pct * 100) +
            '% behind "' + h.who + '". Nobody in this crowd gets a cutaway.');
    });

    /* revive() is the other teleport, and unlike gotoPlace it is not
       modelled anywhere below. It drops you at (W/2, H-2) with nothing to
       catch it if that is inside something. */
    (function () {
        var rx = W / 2, ry = H - 2;
        if (blocked(p, rx, ry, R)) bad(id + ': dying puts you back at ' + rx + ',' + ry + ', which is inside a prop. revive() has no unstick behind it.');
        (p.exits || []).forEach(function (e) {
            var w = e.w || 0.9, h = e.h || 0.9;
            if (rx > e.x - w / 2 && rx < e.x + w / 2 && ry > e.y - h / 2 && ry < e.y + h / 2)
                bad(id + ': dying puts you back inside the exit band for "' + e.n + '", so you get up and walk out of the place you died in.');
        });
    })();

    /* A look you cannot read without risking the door beside it. The one
       that matters is the playbill next to the steps up to the Act 3
       stage, which is the only point of no return in the game and which
       you cross by walking. */
    (p.exits || []).forEach(function (e) {
        var w = e.w || 0.9, h = e.h || 0.9;
        (p.looks || []).forEach(function (l) {
            var d = Math.hypot(Math.max(0, Math.abs(l.x - e.x) - w / 2), Math.max(0, Math.abs(l.y - e.y) - h / 2));
            if (d < 0.75) bad(id + ': look "' + l.n + '" is ' + d.toFixed(2) + ' tiles from the edge of the exit band "' +
                e.n + '". You cannot stand and read it without risking walking through the door.');
        });
    });

    // a place lit only by your own lantern is a deliberate choice; a lit
    // place with nothing to light it is a mistake
    if (p.night) {
        // the list has to match lightsOf(): hearth was missing from it, so a
        // room lit only by its fire would have failed this gate
        var lit = (p.props || []).some(function (o) {
            return o.t === 'house' || o.t === 'lamp' || o.t === 'foot' || o.t === 'mill' || o.t === 'hearth';
        }) || (p.lights || []).length;
        if (!lit && !p.dark) bad(id + ': is night but has no lamp, house or light in it. Set `dark: 1` if the lantern is meant to be the only light.');
    }

    (p.exits || []).forEach(function (e) {
        var w = e.w || 0.9, h = e.h || 0.9, ok = 0, tot = 0;
        for (var x = e.x - w / 2 + 0.02; x < e.x + w / 2; x += 0.05) {
            for (var y = e.y - h / 2 + 0.02; y < e.y + h / 2; y += 0.05) {
                tot++;
                if (standable(p, x, y, W, H)) ok++;
            }
        }
        var pct = tot ? Math.round(ok / tot * 100) : 0;
        if (!ok) bad(id + ': exit "' + e.n + '" has NO standable point. You cannot walk through it at all.');
        else if (pct < 25) bad(id + ': exit "' + e.n + '" is ' + (100 - pct) + '% buried. Only ' + pct + '% of its band is standable.');
        if (!PLACES[e.to]) bad(id + ': exit "' + e.n + '" points at "' + e.to + '", which is not a place.');
        if (e.needs && !e.shut) bad(id + ': exit "' + e.n + '" is gated on "' + e.needs + '" but has no `shut` line, so it refuses the player silently.');
    });

    (p.npcs || []).forEach(function (nid) {
        var n = NPCS[nid];
        if (!n) return bad(id + ': npc "' + nid + '" is not in NPCS.');
        if (blocked(p, n.x, n.y, 0.05)) bad(id + ': ' + nid + ' at ' + n.x + ',' + n.y + ' is standing inside a prop.');
        if (!reachable(p, n.x, n.y, W, H)) bad(id + ': ' + nid + ' has no standable tile within talk range. You can see them and never speak to them.');
        /* people walk now, so where they walk has to be walkable too:
           a waypoint in a wall makes them shudder against it forever */
        (n.path || []).forEach(function (pt, i) {
            if (!standable(p, pt[0], pt[1], W, H)) bad(id + ': ' + nid + ' path point ' + i + ' (' + pt + ') is inside a prop or off the floor.');
            if (!reachable(p, pt[0], pt[1], W, H)) bad(id + ': ' + nid + ' path point ' + i + ' (' + pt + ') cannot be reached to talk to them there.');
        });
        if (n.wander) {
            var free = 0;
            for (var a = 0; a < 16; a++) {
                var wx = n.x + Math.cos(a / 16 * Math.PI * 2) * n.wander;
                var wy = n.y + Math.sin(a / 16 * Math.PI * 2) * n.wander;
                if (standable(p, wx, wy, W, H)) free++;
            }
            if (free < 4) bad(id + ': ' + nid + ' wanders ' + n.wander + ' tiles but only ' + free + '/16 of that ring is standable. They will grind against a wall.');
        }
    });

    (p.looks || []).forEach(function (l) {
        if (!reachable(p, l.x, l.y, W, H)) bad(id + ': look "' + l.n + '" has no standable tile in range.');
    });

    // where you land coming in from every place that points here
    Object.keys(PLACES).forEach(function (oid) {
        if (!(PLACES[oid].exits || []).some(function (e) { return e.to === id; })) return;
        var back = (p.exits || []).filter(function (e) { return e.to === oid; })[0];
        var px, py;
        if (back) {
            px = Math.max(1, Math.min(back.x, W - 1));
            py = Math.max(1, Math.min(back.y, H - 1));
            px += back.h ? (back.x < W / 2 ? 1.2 : -1.2) : 0;
            py += back.h ? 0 : (back.y < H / 2 ? 1.2 : -1.2);
        } else { px = W / 2; py = H - 2.2; }
        if (blocked(p, px, py, R)) {
            bad(id + ': arriving from ' + oid + ' lands inside a prop at ' + px.toFixed(2) + ',' + py.toFixed(2) + '. unstick() should catch it, but do not rely on that.');
        }
        if (!back && !p.oneway) {
            bad(id + ': you can walk here from ' + oid + ' but there is no exit back. One way trip. (Set oneway:1 if a script returns the player.)');
        }
    });

    if (!MAP_POS[id]) {
        bad(id + ': the map derivation gave it no cell, so it and every road to it are invisible on the map.');
    }
});

/* Two places on the same map cell draw on top of each other. The
   derivation slides to avoid it, but it can run out of room. */
var cells = {};
Object.keys(MAP_POS).forEach(function (id) {
    if (MAP_HIDE[id]) return;
    var k = MAP_POS[id].join(',');
    if (cells[k]) bad('map: "' + id + '" and "' + cells[k] + '" both land on cell ' + k + '. They will overlap.');
    cells[k] = id;
});

/* A cell decided by collision rather than by direction, which is the map
   about to draw a shape the world does not have. Collected during the
   derivation above. */
SLIPS.forEach(bad);

/* Two places joined by a door have to derive to OPPOSITE directions or
   the graph is not embeddable and something has to slide. Interior doors
   are exempt: a room off a square is legitimately in the same cell as
   whatever it is a door in. */
Object.keys(PLACES).forEach(function (a) {
    (PLACES[a].exits || []).forEach(function (e) {
        var b = PLACES[e.to]; if (!b || b.indoor || PLACES[a].indoor) return;
        var back = (b.exits || []).filter(function (f) { return f.to === a; })[0];
        if (!back) return;
        var d1 = exitDir(PLACES[a], e), d2 = exitDir(b, back);
        if (d1[0] === d2[0] && d1[1] === d2[1])
            bad('map: ' + a + ' and ' + e.to + ' both put their shared door on the same wall (' + d1 +
                '), so one of them cannot be the far side of the other. Give one of the two exits a `dir`.');
    });
});

/* Every prop sprite the game can build, against the cache that has to
   hold them. Over budget means the LRU runs at its ceiling and throws
   something away on every transition that builds anything, and the
   failure mode is invisible: a place you walk back into replays its
   plain-solid fallback for a frame or two. */
(function () {
    function hash2(a, b, c) {
        var n = (Math.round(a * 16) + 1013) | 0;
        n = Math.imul(n ^ (Math.round(b * 16) + 9176), 374761393);
        n = Math.imul(n ^ ((c || 0) * 2654435761), 668265263);
        n ^= n >>> 13; n = Math.imul(n, 1274126177);
        return (n ^ (n >>> 16)) >>> 0;
    }
    var keys = {};
    Object.keys(PLACES).forEach(function (id) {
        var used = {};
        (PLACES[id].props || []).forEach(function (o) {
            var d = PROP[o.t] || PROP._, b = o.b, v = 0;
            // in step with propVar(): a taken variant steps on until one is free
            if (d.vars) {
                v = hash2(b[0], b[1], o.t.length * 31 + o.t.charCodeAt(0)) % d.vars;
                var u = used[o.t] || (used[o.t] = {}), n = 0;
                while (u[v] && n < d.vars) { v = (v + 1) % d.vars; n++; }
                u[v] = 1;
            }
            var rrx = (b[2] + b[3]) * 58 / 4, rry = (b[2] + b[3]) * 29 / 4;
            var w = Math.ceil(rrx * 2) + 60, h = Math.ceil(rry * 2 + d.h + (d.over || 0)) + 60;
            keys[o.t + '|' + b[2] + '|' + b[3] + '|' + v] = w * h * 4;
        });
    });
    var total = Object.keys(keys).reduce(function (a, k) { return a + keys[k]; }, 0);
    if (SPRITE_BUDGET && total > SPRITE_BUDGET)
        bad('sprites: the ' + Object.keys(keys).length + ' distinct prop sprites total ' +
            (total / 1048576).toFixed(2) + ' MB against a SPRITE_BUDGET of ' + (SPRITE_BUDGET / 1048576).toFixed(0) +
            ' MB, so the cache can never hold the game and evicts on every place change that builds.');
})();

/* A flag written and read by nobody is a gate somebody meant to build.
   Look keys are the usual case: `key` on a look exists only to set
   S.seen[key], and the dimming of a read look is driven separately. */
(function () {
    var writes = {};
    Object.keys(PLACES).forEach(function (id) {
        (PLACES[id].looks || []).forEach(function (l) { if (l.key) writes[l.key] = id + ' look "' + l.n + '"'; });
    });
    Object.keys(writes).forEach(function (k) {
        /* The write is the look's `key:` field, which is just the string,
           so every S.seen.<k> in the file is a READ. Comments count, which
           is the one false negative here and an acceptable one: a comment
           naming the flag means somebody knows about it. */
        var reads = src.split('S.seen.' + k).length - 1 + src.split("S.seen['" + k + "']").length - 1;
        if (!reads) bad('flag "' + k + '" is set by ' + writes[k] + ' and read nowhere. Either wire it or drop the key.');
    });
})();

/* Somewhere you can never walk to is content nobody will ever see. */
(function () {
    var seen = { square: 1 }, q = ['square'];
    while (q.length) {
        var id = q.shift();
        (PLACES[id].exits || []).forEach(function (e) {
            if (PLACES[e.to] && !seen[e.to]) { seen[e.to] = 1; q.push(e.to); }
        });
    }
    Object.keys(PLACES).forEach(function (id) {
        if (!seen[id] && !MAP_HIDE[id]) bad(id + ': no route to it from the square. Nobody will ever reach it.');
    });
})();

var placed = {};
Object.keys(PLACES).forEach(function (id) { (PLACES[id].npcs || []).forEach(function (n) { placed[n] = 1; }); });
Object.keys(NPCS).forEach(function (n) {
    if (!placed[n]) bad('NPC "' + n + '" is written but stands in no place. Nobody can ever meet them.');
});

var counts = {
    places: Object.keys(PLACES).length,
    npcs: Object.keys(NPCS).length,
    exits: Object.keys(PLACES).reduce(function (a, id) { return a + (PLACES[id].exits || []).length; }, 0),
    looks: Object.keys(PLACES).reduce(function (a, id) { return a + (PLACES[id].looks || []).length; }, 0)
};

console.log(counts.places + ' places, ' + counts.npcs + ' people, ' + counts.exits + ' exits, ' + counts.looks + ' things to look at');
if (!problems.length) {
    console.log('geometry clean');
    process.exit(0);
}
console.log('\n' + problems.length + ' problem' + (problems.length === 1 ? '' : 's') + ':\n');
problems.forEach(function (p) { console.log('  ' + p); });
process.exit(1);
