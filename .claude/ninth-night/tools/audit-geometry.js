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

function grab(name) {
    var i = src.indexOf('var ' + name + ' = {');
    if (i < 0) throw new Error('could not find `var ' + name + '` in ' + FILE);
    var start = src.indexOf('{', i), depth = 0, j = start;
    for (; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (!depth) break; }
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

/* The map is derived from the exit graph now rather than hand kept, so
   the audit derives it the same way and checks the derivation, instead
   of checking a table that can no longer be forgotten. Keep this in step
   with buildMap()/exitDir() in the game. */
function exitDir(p, e) {
    var W = p.w || GRID, H = p.h || GRID;
    var dx = e.x < W * 0.25 ? -1 : e.x > W * 0.75 ? 1 : 0;
    var dy = e.y < H * 0.25 ? -1 : e.y > H * 0.75 ? 1 : 0;
    if (dx && dy) { if (Math.abs(e.x - W / 2) / W > Math.abs(e.y - H / 2) / H) dy = 0; else dx = 0; }
    if (!dx && !dy) dy = -1;
    return [dx, dy];
}
function buildMap() {
    var pos = {}, taken = {}, k;
    for (k in MAP_SEED) if (PLACES[k]) { pos[k] = MAP_SEED[k].slice(); taken[pos[k].join(',')] = k; }
    var q = ['square'], guard = 0;
    while (q.length && guard++ < 400) {
        var id = q.shift(), p = PLACES[id]; if (!p || !pos[id]) continue;
        (p.exits || []).forEach(function (e) {
            if (!PLACES[e.to] || pos[e.to]) return;
            var d = exitDir(p, e), c = [pos[id][0] + d[0], pos[id][1] + d[1]], slip = 0;
            while (taken[c.join(',')] && slip < 12) {
                slip++;
                if (d[0]) c[1] = pos[id][1] + (slip % 2 ? 1 : -1) * Math.ceil(slip / 2);
                else c[0] = pos[id][0] + (slip % 2 ? 1 : -1) * Math.ceil(slip / 2);
            }
            pos[e.to] = c; taken[c.join(',')] = e.to; q.push(e.to);
        });
    }
    var spare = 0;
    Object.keys(PLACES).forEach(function (id) {
        if (pos[id] || MAP_HIDE[id]) return;
        while (taken[(-1) + ',' + spare] && spare < 40) spare++;
        pos[id] = [-1, spare]; taken[pos[id].join(',')] = id; spare++;
    });
    return pos;
}
var MAP_POS = buildMap();

var problems = [];
function bad(msg) { problems.push(msg); }

function blocked(p, x, y, r) {
    var ps = p.props || [];
    for (var i = 0; i < ps.length; i++) {
        var b = ps[i].b;
        if (x + r > b[0] && x - r < b[0] + b[2] && y + r > b[1] && y - r < b[1] + b[3]) return true;
    }
    return false;
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

    // a place lit only by your own lantern is a deliberate choice; a lit
    // place with nothing to light it is a mistake
    if (p.night) {
        var lit = (p.props || []).some(function (o) { return o.t === 'house' || o.t === 'lamp' || o.t === 'foot' || o.t === 'mill'; }) || (p.lights || []).length;
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
