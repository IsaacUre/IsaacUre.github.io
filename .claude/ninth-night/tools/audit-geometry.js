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
    var S = { heard: {}, seen: {}, frags: {} };
    var sSave = function () {};
    return eval('(' + src.slice(start, j + 1) + ')');   // eslint-disable-line no-eval
}

var PLACES = grab('PLACES');
var NPCS = grab('NPCS');
var MAP_POS = grab('MAP_POS');

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

    if (W > 17 || H > 17) {
        bad(id + ': ' + W + 'x' + H + ' exceeds the 17x17 ceiling. There is no camera, so this renders off the bottom of the canvas.');
    }

    (p.props || []).forEach(function (o) {
        if (o.b[0] < 0 || o.b[1] < 0 || o.b[0] + o.b[2] > W || o.b[1] + o.b[3] > H) {
            bad(id + ': prop "' + o.t + '" [' + o.b + '] sticks out of the ' + W + 'x' + H + ' floor.');
        }
    });

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
        if (!back) {
            bad(id + ': you can walk here from ' + oid + ' but there is no exit back. One way trip.');
        }
    });

    if (!MAP_POS[id]) {
        bad(id + ': has no MAP_POS row, so it and every road to it are invisible on the map.');
    }
});

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
