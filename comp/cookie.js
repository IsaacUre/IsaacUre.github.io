/* ============================================================
   COOKIE CLICKER — a real, deep port for the UreOS desktop.
   The numbers are the real game's numbers: building costs and
   CpS, 1.15^n pricing, x7/77s Frenzies, Lucky's min(bank*15%,
   900s of CpS)+13, prestige = cbrt(all/1e12). Rendered in hard
   pixels; saves under comp_cookie; achievements feed the Steam
   client's achievement page live. Exposes window.COOKIE with
   { render, init, close, steamAch } for the comp.js APPS entry.
   ============================================================ */
(function () {
'use strict';

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

/* ───────────────────────── number formatting ─────────────────────────
   (lives up top: achievement descriptions call fmt() at module init) */
var SUF = [[1e27, 'octillion'], [1e24, 'septillion'], [1e21, 'sextillion'], [1e18, 'quintillion'],
    [1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
function fmt(n) {
    if (!isFinite(n)) return '∞';
    n = Math.floor(n);
    for (var i = 0; i < SUF.length; i++) if (n >= SUF[i][0]) return trim3(n / SUF[i][0]) + ' ' + SUF[i][1];
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function fmt1(n) {   // one decimal for CpS / click power
    for (var i = 0; i < SUF.length; i++) if (n >= SUF[i][0]) return trim3(n / SUF[i][0]) + ' ' + SUF[i][1];
    return n >= 100 ? fmt(n) : (Math.round(n * 10) / 10).toString();
}
function trim3(v) { return (Math.round(v * 1000) / 1000).toPrecision(v >= 100 ? 6 : v >= 10 ? 5 : 4).replace(/\.?0+$/, ''); }

/* ───────────────────────── buildings (real values) ───────────────────────── */
var B = [
    ['cursor',      'Cursor',               15,      0.1,   'Autoclicks once every 10 seconds.'],
    ['grandma',     'Grandma',              100,     1,     'A nice grandma to bake more cookies.'],
    ['farm',        'Farm',                 1100,    8,     'Grows cookie plants from cookie seeds.'],
    ['mine',        'Mine',                 12000,   47,    'Mines out cookie dough and chocolate chips.'],
    ['factory',     'Factory',              130000,  260,   'Produces large quantities of industrial cookies.'],
    ['bank',        'Bank',                 1.4e6,   1400,  'Generates cookies from interest.'],
    ['temple',      'Temple',               2e7,     7800,  'Full of precious, ancient chocolate.'],
    ['wizard',      'Wizard tower',         3.3e8,   44000, 'Summons cookies with magic spells.'],
    ['shipment',    'Shipment',             5.1e9,   2.6e5, 'Brings in fresh cookies from the cookie planet.'],
    ['alchemy',     'Alchemy lab',          7.5e10,  1.6e6, 'Turns gold into cookies!'],
    ['portal',      'Portal',               1e12,    1e7,   'Opens a door to the Cookieverse.'],
    ['timemachine', 'Time machine',         1.4e13,  6.5e7, 'Brings cookies from the past, before they were even eaten.'],
    ['antimatter',  'Antimatter condenser', 1.7e14,  4.3e8, 'Condenses the antimatter in the universe into cookies.'],
    ['prism',       'Prism',                2.1e15,  2.9e9, 'Converts light itself into cookies.']
];
function bDef(id) { for (var i = 0; i < B.length; i++) if (B[i][0] === id) return B[i]; return null; }
function price(id, owned, n) {   // total price of the next n (1.15^k scaling, like the real thing)
    var base = bDef(id)[2], sum = 0;
    for (var k = 0; k < (n || 1); k++) sum += Math.ceil(base * Math.pow(1.15, owned + k));
    return sum;
}
function sellback(id, owned, n) {
    var base = bDef(id)[2], sum = 0;
    for (var k = 0; k < n; k++) sum += Math.ceil(base * Math.pow(1.15, owned - 1 - k)) * 0.25;
    return Math.floor(sum);
}

/* ───────────────────────── upgrades (real names) ───────────────────────── */
var TIERS = {
    cursor:      ['Reinforced index finger', 'Carpal tunnel prevention cream', 'Ambidextrous'],
    grandma:     ['Forwards from grandma', 'Steel-plated rolling pins', 'Lubricated dentures'],
    farm:        ['Cheap hoes', 'Fertilizer', 'Cookie trees'],
    mine:        ['Sugar gas', 'Megadrill', 'Ultradrill'],
    factory:     ['Sturdier conveyor belts', 'Child labor', 'Sweatshop'],
    bank:        ['Taller tellers', 'Scissor-resistant credit cards', 'Acid-proof vaults'],
    temple:      ['Golden idols', 'Sacrifices', 'Delicious blessing'],
    wizard:      ['Pointier hats', 'Beardlier beards', 'Ancient grimoires'],
    shipment:    ['Vanilla nebulae', 'Wormholes', 'Frequent flyer'],
    alchemy:     ['Antimony', 'Essence of dough', 'True chocolate'],
    portal:      ['Ancient tablet', 'Insane oatling workers', 'Soul bond'],
    timemachine: ['Flux capacitors', 'Time paradox resolver', 'Quantum conundrum'],
    antimatter:  ['Sugar bosons', 'String theory', 'Large macaron collider'],
    prism:       ['Gem polish', '9th color', 'Chocolate light']
};
var TIER_AT = [1, 5, 25], TIER_X = [10, 50, 500];
var UP = [];
B.forEach(function (b) {
    TIERS[b[0]].forEach(function (name, i) {
        UP.push({ id: b[0] + i, n: name, cost: b[2] * TIER_X[i], kind: 'tier', b: b[0], at: TIER_AT[i],
            d: (b[0] === 'cursor' ? 'The mouse and cursors are twice as efficient.' : b[1] + 's are twice as efficient.') });
    });
});
[['Plastic mouse', 5e4], ['Iron mouse', 5e6], ['Titanium mouse', 5e8], ['Adamantium mouse', 5e10], ['Unobtainium mouse', 5e12]]
    .forEach(function (m, i) { UP.push({ id: 'mouse' + i, n: m[0], cost: m[1], kind: 'mouse', d: 'Clicking gains +1% of your CpS.' }); });
[['Kitten helpers', 9e6, 0.1, 5], ['Kitten workers', 9e9, 0.125, 15], ['Kitten engineers', 9e13, 0.15, 25]]
    .forEach(function (k, i) { UP.push({ id: 'kitten' + i, n: k[0], cost: k[1], kind: 'kitten', f: k[2], at: k[3], d: 'You gain more CpS the more milk you have. (You gotta pet the kittens.)' }); });
[['Plain cookies', 999999, 1], ['Sugar cookies', 5e6, 1], ['Oatmeal raisin cookies', 1e7, 1], ['Peanut butter cookies', 5e7, 2],
 ['Coconut cookies', 1e8, 2], ['White chocolate cookies', 5e8, 2], ['Macadamia nut cookies', 1e9, 2], ['Double-chip cookies', 5e9, 2]]
    .forEach(function (c, i) { UP.push({ id: 'ck' + i, n: c[0], cost: c[1], kind: 'cookie', pct: c[2], d: 'Cookie production multiplier +' + c[2] + '%.' }); });
var UPBY = {}; UP.forEach(function (u) { UPBY[u.id] = u; });

/* ───────────────────────── achievements (real names) ───────────────────────── */
var ACH = [];
function ach(id, n, d, test) { ACH.push({ id: id, n: n, d: d, test: test }); }
[[1, 'Wake and bake'], [1e3, 'Making some dough'], [1e5, 'So baked right now'], [1e7, 'Fledgling bakery'],
 [1e9, 'Affluent bakery'], [1e11, 'World-famous bakery'], [1e13, 'Cosmic bakery'], [1e15, 'Galactic bakery'], [1e17, 'Universal bakery']]
    .forEach(function (a, i) { ach('bake' + i, a[1], 'Bake ' + fmt(a[0]) + ' cookie' + (a[0] === 1 ? '' : 's') + ' in one ascension.', function (S) { return S.total >= a[0]; }); });
[[1, 'Casual baking'], [10, 'Hardcore baking'], [100, 'Steady tasty stream'], [1000, 'Cookie monster'], [1e5, 'Mass producer'], [1e7, 'Cookie vortex']]
    .forEach(function (a, i) { ach('cps' + i, a[1], 'Bake ' + fmt(a[0]) + ' cookies per second.', function (S, c) { return c >= a[0]; }); });
[[100, 'Clicktastic'], [1000, 'Clickathlon'], [1e4, 'Clickolympics'], [1e5, 'Clickorama']]
    .forEach(function (a, i) { ach('click' + i, a[1], 'Make ' + fmt(a[0]) + ' manual clicks.', function (S) { return S.clicks >= a[0]; }); });
var FIRSTB = { cursor: 'Click', grandma: "Grandma's cookies", farm: 'Bought the farm', mine: 'You know the drill',
    factory: 'Production chain', bank: 'Pretty penny', temple: 'Your time to shrine', wizard: 'Bewitched',
    shipment: 'Expedition', alchemy: 'Transmutation', portal: 'A whole new world', timemachine: 'Time warp',
    antimatter: 'Antibatter', prism: 'Bright future' };
B.forEach(function (b) { ach('own_' + b[0], FIRSTB[b[0]], 'Own a ' + b[1].toLowerCase() + '.', function (S) { return (S.b[b[0]] || 0) >= 1; }); });
ach('gran50', 'Retirement home', 'Own 50 grandmas.', function (S) { return (S.b.grandma || 0) >= 50; });
ach('bld100', 'Builder', 'Own 100 buildings.', function (S) { return bCount(S) >= 100; });
ach('bld400', 'Architect', 'Own 400 buildings.', function (S) { return bCount(S) >= 400; });
[[1, 'Golden cookie'], [7, 'Lucky cookie'], [27, 'A stroke of luck']]
    .forEach(function (a, i) { ach('gold' + i, a[1], 'Click ' + a[0] + ' golden cookie' + (a[0] > 1 ? 's' : '') + '.', function (S) { return S.gold >= a[0]; }); });
ach('legacy', 'Legacy', 'Ascend at least once.', function (S) { return S.resets >= 1; });
var MILKS = ['Plain milk', 'Chocolate milk', 'Raspberry milk', 'Orange milk', 'Caramel milk', 'Banana milk'];
function bCount(S) { var n = 0; B.forEach(function (b) { n += S.b[b[0]] || 0; }); return n; }

/* ───────────────────────── news ticker ───────────────────────── */
var NEWS = [
    'News : cookie farms suspected of employing undeclared elderly workforce!',
    'News : cookies found to be addictive, says study funded by the cookie industry.',
    'News : "cookies are the new bread," claims economist.',
    'News : man eats cookie, reportedly "likes it quite a bit."',
    'News : doctors warn against "cookie diets"; cookie lobby unmoved.',
    'News : cookie prices spike as demand reaches "frankly ridiculous" levels.',
    'News : local hero saves cookie from certain doom (a glass of milk).',
    'News : archaeologists unearth ancient cookie; immediately eat it.',
    'News : "we just want to bake," say grandmas. Nobody believes them.',
    'News : scientists announce cookies still delicious, funding renewed.',
    'News : cookie-based economy "surprisingly stable," says confused analyst.',
    'News : moon confirmed to not be a cookie. Disappointment widespread.',
    'News : local student clicks cookie instead of studying for econ midterm.',
    'News : silver GTI spotted making suspiciously fast cookie deliveries.',
    'News : URE BOY sales dip as entire household plays Cookie Clicker instead.',
    'News : Edge browser reportedly "happy for Chrome, really." Sources doubt it.',
    'News : kitten workforce demands more milk; management folds instantly.',
    'News : time travelers arrive from the future to eat cookies "before they run out."',
    'News : wizards insist cookie magic is "a legitimate school of thaumaturgy."',
    'News : antimatter cookie briefly erases hunger from the universe.'
];
var NEWS_GRAN = [
    'News : grandmas "multiplying at an alarming rate," reports local man.',
    'News : thousands of grandmas spotted moving in perfect unison.',
    'News : do not look at the grandmas. Do not let the grandmas know you know.',
    'News : "everything is fine," says grandma council in unified voice.'
];

/* ───────────────────────── state ───────────────────────── */
var S = null, RT = null;   // save state / runtime (timers, canvases, buffs)
function fresh() { return { bank: 0, total: 0, all: 0, clicks: 0, gold: 0, b: {}, up: {}, ach: {}, chips: 0, resets: 0, name: "Isaac's bakery", t: Date.now() }; }
function sLoad() {
    if (S) return S;
    try { S = JSON.parse(localStorage.getItem('comp_cookie') || 'null'); } catch (e) { S = null; }
    if (!S || typeof S.bank !== 'number') S = fresh();
    S.b = S.b || {}; S.up = S.up || {}; S.ach = S.ach || {};
    return S;
}
function sSave() { if (!S) return; S.t = Date.now(); try { localStorage.setItem('comp_cookie', JSON.stringify(S)); } catch (e) {} }
function achCount() { var n = 0; for (var k in S.ach) if (S.ach[k]) n++; return n; }
function milk() { return achCount() * 0.04; }
function tiersOwned(b) { var n = 0; for (var i = 0; i < 3; i++) if (S.up[b + i]) n++; return n; }
function mouseCount() { var n = 0; for (var i = 0; i < 5; i++) if (S.up['mouse' + i]) n++; return n; }

function cps(noBuff) {
    var total = 0;
    B.forEach(function (b) { total += b[3] * (S.b[b[0]] || 0) * Math.pow(2, tiersOwned(b[0])); });
    var mult = 1 + S.chips * 0.01;
    UP.forEach(function (u) { if (u.kind === 'cookie' && S.up[u.id]) mult *= 1 + u.pct / 100; });
    UP.forEach(function (u) { if (u.kind === 'kitten' && S.up[u.id]) mult *= 1 + milk() * u.f; });
    var out = total * mult;
    if (!noBuff && RT) RT.buffs.forEach(function (bf) { if (bf.k === 'frenzy') out *= 7; });
    return out;
}
function clickPow() {
    var p = Math.pow(2, tiersOwned('cursor'));
    p += cps() * mouseCount() / 100;
    if (RT) RT.buffs.forEach(function (bf) { if (bf.k === 'click') p *= 777; });
    return p;
}
function prestigeAt(all) { return Math.floor(Math.cbrt(all / 1e12)); }

/* ───────────────────────── pixel painters ───────────────────────── */
function paintCookie(cv, px) {   // the big one: dithered disc + chips, drawn small, scaled crisp
    var s = 34; cv.width = s; cv.height = s;
    var x = cv.getContext('2d'), r = s / 2 - 1;
    function seedRnd(seed) { return function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }
    var rnd = seedRnd(7);
    for (var yy = 0; yy < s; yy++) for (var xx = 0; xx < s; xx++) {
        var dx = xx - s / 2 + 0.5, dy = yy - s / 2 + 0.5, d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        var edge = d / r, lit = (-dx - dy) / (r * 1.4);
        var c = edge > 0.92 ? '#7a4a1c' : lit > 0.18 ? '#d29a4a' : lit < -0.22 ? '#a3672a' : '#bc7f38';
        if (((xx + yy) & 1) && edge > 0.82) c = '#8a561f';
        x.fillStyle = c; x.fillRect(xx, yy, 1, 1);
    }
    for (var ch = 0; ch < 11; ch++) {   // chocolate chips
        var a = rnd() * 6.28, dd = rnd() * (r - 5), cx = Math.round(s / 2 + Math.cos(a) * dd), cy = Math.round(s / 2 + Math.sin(a) * dd);
        x.fillStyle = '#4a2a12'; x.fillRect(cx - 1, cy - 1, 3, 3);
        x.fillStyle = '#6b3d1a'; x.fillRect(cx - 1, cy - 1, 1, 1);
    }
    cv.style.width = px + 'px'; cv.style.height = px + 'px';
}
var BICON = {   // 12×12 pixel glyphs per building
    cursor: function (x) { px(x, '4,1 4,2 5,2 4,3 5,3 6,3 4,4 5,4 6,4 7,4 4,5 5,5 6,5 7,5 8,5 4,6 5,6 6,6 5,7 6,7 6,8 7,8 6,9 7,9', '#e8e8f0'); },
    grandma: function (x) { px(x, '4,1 5,1 6,1 7,1 3,2 8,2 3,3 8,3', '#cfd2da'); px(x, '4,3 5,3 6,3 7,3 4,4 7,4 4,5 5,5 6,5 7,5', '#e8c9a8'); px(x, '5,4 7,4', '#333'); px(x, '3,6 4,6 5,6 6,6 7,6 8,6 3,7 8,7 3,8 8,8 4,9 5,9 6,9 7,9', '#b06a9c'); },
    farm: function (x) { px(x, '5,2 6,2 4,3 7,3 3,4 8,4 2,5 9,5', '#a3672a'); px(x, '3,5 4,5 5,5 6,5 7,5 8,5 3,6 8,6 3,7 8,7 3,8 8,8 3,9 4,9 5,9 6,9 7,9 8,9', '#c9902f'); px(x, '5,7 6,7 5,8 6,8 5,9 6,9', '#5a3a18'); },
    mine: function (x) { px(x, '2,9 3,8 4,7 5,6 6,5 7,4 8,3', '#8a8f96'); px(x, '8,2 9,2 10,2 8,3 9,3 10,3 9,4', '#5c6168'); px(x, '2,10 3,10 3,9', '#6b4a2a'); },
    factory: function (x) { px(x, '2,5 2,4 2,3', '#9aa3ad'); px(x, '2,6 3,6 4,6 5,6 6,6 7,6 8,6 9,6 2,7 9,7 2,8 9,8 2,9 9,9 3,7 3,8 3,9 4,7 4,8 4,9 5,7 5,8 5,9 6,7 6,8 6,9 7,7 7,8 7,9 8,7 8,8 8,9', '#7a828c'); px(x, '4,4 5,3 6,4 7,3', 'rgba(220,220,230,.6)'); },
    bank: function (x) { px(x, '2,4 3,4 4,4 5,4 6,4 7,4 8,4 9,4 5,2 6,2 4,3 7,3', '#d8cf9a'); px(x, '3,5 3,6 3,7 3,8 5,5 5,6 5,7 5,8 7,5 7,6 7,7 7,8 9,5 9,6 9,7 9,8 2,9 3,9 4,9 5,9 6,9 7,9 8,9 9,9', '#bfb782'); },
    temple: function (x) { px(x, '5,1 6,1 4,2 7,2 3,3 8,3', '#e0c34a'); px(x, '3,4 4,4 5,4 6,4 7,4 8,4 3,5 3,6 3,7 3,8 5,5 5,6 5,7 5,8 8,5 8,6 8,7 8,8 2,9 3,9 4,9 5,9 6,9 7,9 8,9 9,9', '#d8b13a'); },
    wizard: function (x) { px(x, '5,1 5,2 6,2 4,3 5,3 6,3 4,4 6,4 4,5 5,5 6,5 7,5 3,6 7,6 3,7 8,7 3,8 8,8 2,9 9,9', '#7b53c9'); px(x, '5,0', '#f0e070'); },
    shipment: function (x) { px(x, '5,2 6,2 4,3 5,3 6,3 7,3 4,4 5,4 6,4 7,4 3,5 8,5 3,6 8,6 4,7 7,7', '#9fb7cf'); px(x, '5,8 6,8 5,9 4,10 7,9 6,10', '#f0a02a'); },
    alchemy: function (x) { px(x, '5,1 6,1 5,2 6,2 4,4 7,4 3,6 8,6 3,7 8,7 3,8 4,8 5,8 6,8 7,8 8,8 4,9 5,9 6,9 7,9', '#57c9a0'); px(x, '5,3 6,3 5,4 6,4 4,5 7,5', 'rgba(130,220,180,.5)'); },
    portal: function (x) { px(x, '5,1 6,1 3,2 4,2 7,2 8,2 2,3 9,3 2,4 9,4 2,5 9,5 2,6 9,6 2,7 9,7 3,8 8,8 4,9 5,9 6,9 7,9', '#c86adc'); px(x, '5,4 6,4 4,5 7,5 5,6 6,6', '#3a1148'); },
    timemachine: function (x) { px(x, '4,2 5,2 6,2 7,2 3,3 8,3 2,4 9,4 2,5 5,5 9,5 2,6 5,6 6,6 9,6 3,7 8,7 4,8 5,8 6,8 7,8', '#57a9d8'); },
    antimatter: function (x) { px(x, '5,5 6,5 5,6 6,6', '#f0f0f8'); px(x, '3,3 8,3 2,5 9,6 3,8 8,8 5,1 6,10', '#8a67d8'); px(x, '4,4 7,4 3,6 8,5 4,7 7,7', 'rgba(160,130,240,.5)'); },
    prism: function (x) { px(x, '5,2 6,2 4,4 7,4 3,6 8,6 2,8 3,8 4,8 5,8 6,8 7,8 8,8 9,8', '#d8ecf8'); px(x, '5,4 4,6 6,6', '#7fd8c8'); px(x, '6,4 7,6', '#f0a0c0'); }
};
function px(x, pts, c) { x.fillStyle = c; pts.split(' ').forEach(function (p) { var a = p.split(','); x.fillRect(+a[0], +a[1], 1, 1); }); }
function paintB(cv, id) { cv.width = 12; cv.height = 12; var x = cv.getContext('2d'); if (BICON[id]) BICON[id](x); }

/* ───────────────────────── render ───────────────────────── */
function render() {
    var store = B.map(function (b, i) {
        return '<button class="ck-brow" data-b="' + b[0] + '" data-bi="' + i + '">' +
            '<canvas class="ck-bico"></canvas>' +
            '<span class="ck-bname"><b>' + esc(b[1]) + '</b><i class="ck-bprice"></i></span>' +
            '<span class="ck-bown"></span></button>';
    }).join('');
    return '<div class="ck">' +
        '<div class="ck-left">' +
          '<canvas class="ck-rain"></canvas>' +
          '<div class="ck-name" title="Click to rename your bakery"><span class="ck-name-t"></span></div>' +
          '<div class="ck-count"><b class="ck-bank">0</b> cookies</div>' +
          '<div class="ck-cps">per second: <span class="ck-cpsn">0</span></div>' +
          '<button class="ck-big" aria-label="The cookie. Click it."><canvas class="ck-bigcv"></canvas></button>' +
          '<div class="ck-buffs"></div>' +
          '<canvas class="ck-milk"></canvas>' +
        '</div>' +
        '<div class="ck-mid">' +
          '<div class="ck-news"><span class="ck-news-t"></span></div>' +
          '<div class="ck-uphead">Upgrades</div>' +
          '<div class="ck-ups"></div>' +
          '<div class="ck-tabs">' +
            '<button class="ck-tab sel" data-tab="stats">Stats</button>' +
            '<button class="ck-tab" data-tab="ach">Achievements</button>' +
            '<button class="ck-tab" data-tab="legacy">Legacy</button>' +
          '</div>' +
          '<div class="ck-tabbody"></div>' +
        '</div>' +
        '<div class="ck-store">' +
          '<div class="ck-storehead">Store</div>' +
          '<div class="ck-buymode">' +
            '<button class="ck-bm sel" data-n="1">1</button><button class="ck-bm" data-n="10">10</button>' +
            '<button class="ck-bm" data-n="100">100</button><button class="ck-bm ck-sell" data-n="-1">Sell</button>' +
          '</div>' +
          '<div class="ck-brows">' + store + '</div>' +
        '</div>' +
        '<div class="ck-tip" hidden></div>' +
        '<div class="ck-achtoast" hidden></div>' +
        '</div>';
}

/* ───────────────────────── init / loop ───────────────────────── */
function init(el) {
    sLoad();
    RT = { el: el, root: el.querySelector('.ck'), buffs: [], buyN: 1, timers: [], raf: 0, gold: null,
           started: Date.now(), rainDrops: [], floaters: [], tab: 'stats', newsI: Math.floor(Math.random() * NEWS.length) };
    var q = function (sel) { return RT.root.querySelector(sel); };
    RT.q = q;

    // dev seed for screenshots: ?ckdev gives a mature bakery
    if (location.search.indexOf('ckdev') >= 0 && S.total < 1000) {
        S.bank = 2.6e8; S.total = S.all = 4.2e9;
        S.b = { cursor: 61, grandma: 44, farm: 32, mine: 25, factory: 18, bank: 12, temple: 8, wizard: 5, shipment: 2, alchemy: 1 };
        S.up = { cursor0: 1, cursor1: 1, grandma0: 1, grandma1: 1, farm0: 1, mine0: 1, factory0: 1, mouse0: 1, mouse1: 1, ck0: 1, ck1: 1, kitten0: 1 };
        S.clicks = 3141; S.gold = 3;
    }

    paintCookie(q('.ck-bigcv'), 200);
    RT.root.querySelectorAll('.ck-brow').forEach(function (row, i) { paintB(row.querySelector('.ck-bico'), B[i][0]); });

    // offline earnings: half rate, capped at 6 hours (the grandmas unionized)
    var away = (Date.now() - (S.t || Date.now())) / 1000, base = cps(true);
    if (away > 90 && base > 0) {
        var gain = Math.min(away, 21600) * base * 0.5;
        S.bank += gain; S.total += gain; S.all += gain;
        newsSet('Welcome back. The grandmas baked ' + fmt(gain) + ' cookies while you were gone. They want to talk about overtime.');
    } else newsCycle();

    /* — big cookie — */
    q('.ck-big').addEventListener('click', function (e) {
        var p = clickPow();
        S.bank += p; S.total += p; S.all += p; S.clicks++;
        var big = q('.ck-big');
        big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop');
        floater(e, '+' + fmt1(p));
        paintCounts();
    });

    /* — store — */
    q('.ck-buymode').addEventListener('click', function (e) {
        var b = e.target.closest('.ck-bm'); if (!b) return;
        RT.buyN = +b.getAttribute('data-n');
        RT.root.querySelectorAll('.ck-bm').forEach(function (x) { x.classList.toggle('sel', x === b); });
        RT.root.classList.toggle('selling', RT.buyN < 0);
        paintStore();
    });
    q('.ck-brows').addEventListener('click', function (e) {
        var row = e.target.closest('.ck-brow'); if (!row) return;
        var id = row.getAttribute('data-b'), own = S.b[id] || 0;
        if (RT.buyN < 0) {   // sell one
            if (!own) return;
            S.bank += sellback(id, own, 1); S.b[id] = own - 1;
        } else {
            var n = RT.buyN, cost = price(id, own, n);
            if (S.bank < cost) return;
            S.bank -= cost; S.b[id] = own + n;
        }
        paintStore(); paintUps(); paintCounts(); checkAch();
    });
    wireTip(q('.ck-brows'), '.ck-brow', function (row) {
        var b = B[+row.getAttribute('data-bi')], own = S.b[b[0]] || 0;
        var each = b[3] * Math.pow(2, tiersOwned(b[0]));
        return '<b>' + esc(b[1]) + '</b><i>' + esc(b[4]) + '</i>' +
            (own ? '<span>each produces <b>' + fmt1(each) + '</b> CpS · all ' + own + ' produce <b>' + fmt1(each * own) + '</b> CpS</span>' : '') +
            (RT.buyN < 0 ? '<span>sells for <b>' + fmt(sellback(b[0], own, 1)) + '</b></span>' : '');
    });

    /* — upgrades — */
    q('.ck-ups').addEventListener('click', function (e) {
        var u = e.target.closest('.ck-up'); if (!u) return;
        var def = UPBY[u.getAttribute('data-u')];
        if (!def || S.up[def.id] || S.bank < def.cost) return;
        S.bank -= def.cost; S.up[def.id] = 1;
        paintUps(); paintStore(); paintCounts(); checkAch();
    });
    wireTip(q('.ck-ups'), '.ck-up', function (u) {
        var def = UPBY[u.getAttribute('data-u')];
        return '<b>' + esc(def.n) + '</b><i>' + esc(def.d) + '</i><span>cost: <b>' + fmt(def.cost) + '</b></span>';
    });

    /* — tabs — */
    q('.ck-tabs').addEventListener('click', function (e) {
        var t = e.target.closest('.ck-tab'); if (!t) return;
        RT.tab = t.getAttribute('data-tab');
        RT.root.querySelectorAll('.ck-tab').forEach(function (x) { x.classList.toggle('sel', x === t); });
        paintTab();
    });
    q('.ck-tabbody').addEventListener('click', function (e) {
        var a = e.target.closest('[data-ck]'); if (!a) return;
        var act = a.getAttribute('data-ck');
        if (act === 'ascend') {
            if (!a.classList.contains('armed')) { a.classList.add('armed'); a.textContent = 'Really ascend? Everything resets (you keep ' + fmt(prestigeAt(S.all) - S.chips) + ' chips + achievements)'; return; }
            var gain = prestigeAt(S.all) - S.chips; if (gain <= 0) return;
            S.chips += gain; S.resets++;
            S.bank = 0; S.total = 0; S.b = {}; S.up = {};
            RT.buffs = [];
            checkAch(); paintAll();
            newsSet('News : local bakery ascends to a higher plane; returns with ' + gain + ' heavenly chip' + (gain === 1 ? '' : 's') + ' and a hunger.');
        } else if (act === 'wipe') {
            if (!a.classList.contains('armed')) { a.classList.add('armed'); a.textContent = 'Really wipe the whole save? No bin for this one'; return; }
            S = fresh(); sSave(); RT.buffs = []; paintAll();
        }
    });

    /* — bakery name — */
    q('.ck-name').addEventListener('click', function () {
        var t = q('.ck-name-t'); if (t.querySelector('input')) return;
        var old = S.name;
        t.innerHTML = '<input class="ck-name-in" maxlength="28" aria-label="Bakery name">';
        var inp = t.firstChild; inp.value = old; inp.focus(); inp.select();
        var done = false;
        function fin(save) { if (done) return; done = true; if (save && inp.value.trim()) S.name = inp.value.trim().slice(0, 28); paintName(); }
        inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') fin(true); else if (e.key === 'Escape') fin(false); });
        inp.addEventListener('blur', function () { fin(true); });
    });

    /* — loops — */
    RT.timers.push(setInterval(function () {   // economy: 20 ticks/s
        var g = cps() / 20;
        S.bank += g; S.total += g; S.all += g;
        var now = Date.now();
        RT.buffs = RT.buffs.filter(function (bf) { return bf.end > now; });
    }, 50));
    RT.timers.push(setInterval(function () { paintCounts(); paintBuffs(); }, 150));
    RT.timers.push(setInterval(function () { paintStore(); paintUps(); }, 600));
    RT.timers.push(setInterval(function () { checkAch(); }, 1000));
    RT.timers.push(setInterval(function () { sSave(); }, 15000));
    RT.timers.push(setInterval(newsCycle, 9000));
    scheduleGold(8000 + Math.random() * 30000);   // first golden comes early; later ones wander 60–240s
    rainInit(); rafLoop();

    paintAll();
}
function paintAll() { paintName(); paintCounts(); paintStore(); paintUps(); paintTab(); paintBuffs(); }

/* ───────────────────────── painters ───────────────────────── */
function paintName() { RT.q('.ck-name-t').textContent = S.name; }
function paintCounts() {
    RT.q('.ck-bank').textContent = fmt(S.bank);
    RT.q('.ck-cpsn').textContent = fmt1(cps());
    if (RT.tab === 'stats') {   // live-ish stats without full redraw
        var live = RT.q('.ck-stat-live'); if (live) live.textContent = fmt(S.total);
    }
}
function paintStore() {
    RT.root.querySelectorAll('.ck-brow').forEach(function (row, i) {
        var b = B[i], own = S.b[b[0]] || 0;
        row.querySelector('.ck-bown').textContent = own || '';
        var pr = row.querySelector('.ck-bprice');
        if (RT.buyN < 0) { pr.textContent = own ? '+' + fmt(sellback(b[0], own, 1)) : '—'; pr.className = 'ck-bprice sell'; row.classList.toggle('cant', !own); }
        else {
            var cost = price(b[0], own, RT.buyN);
            pr.textContent = fmt(cost); pr.className = 'ck-bprice' + (S.bank >= cost ? ' ok' : '');
            row.classList.toggle('cant', S.bank < cost);
        }
        // buildings reveal themselves one step ahead, like the real store (the cursor is always on the menu)
        var seen = i === 0 || own > 0 || S.total >= b[2] * 0.5 || (S.b[B[i - 1][0]] || 0) > 0;
        row.classList.toggle('myst', !seen);
    });
}
function upVisible(u) {
    if (S.up[u.id]) return false;
    if (u.kind === 'tier') return (S.b[u.b] || 0) >= u.at;
    if (u.kind === 'mouse') return S.all >= u.cost / 10;
    if (u.kind === 'kitten') return achCount() >= u.at;
    return S.all >= u.cost / 2;   // flavored cookies
}
function paintUps() {
    var vis = UP.filter(upVisible).sort(function (a, b) { return a.cost - b.cost; }).slice(0, 12);
    RT.q('.ck-ups').innerHTML = vis.length ? vis.map(function (u) {
        return '<button class="ck-up k-' + u.kind + (S.bank >= u.cost ? '' : ' cant') + '" data-u="' + u.id + '"><span></span></button>';
    }).join('') : '<span class="ck-noup">Bake more. Upgrades will come.</span>';
}
function paintBuffs() {
    var now = Date.now();
    RT.q('.ck-buffs').innerHTML = RT.buffs.map(function (bf) {
        var left = Math.ceil((bf.end - now) / 1000);
        return '<span class="ck-buff">' + (bf.k === 'frenzy' ? 'Frenzy ×7' : 'Click frenzy ×777') + ' · ' + left + 's</span>';
    }).join('');
}
function paintTab() {
    var el = RT.q('.ck-tabbody');
    if (RT.tab === 'stats') {
        var rows = [
            ['Cookies in bank', fmt(S.bank)], ['Baked (this ascension)', '<span class="ck-stat-live">' + fmt(S.total) + '</span>'],
            ['Baked (all time)', fmt(S.all)], ['Cookies per second', fmt1(cps())], ['Cookies per click', fmt1(clickPow())],
            ['Hand-made clicks', fmt(S.clicks)], ['Golden cookies clicked', fmt(S.gold)],
            ['Buildings owned', fmt(bCount(S))], ['Achievements', achCount() + ' / ' + ACH.length],
            ['Milk', Math.round(milk() * 100) + '% · ' + MILKS[Math.min(MILKS.length - 1, Math.floor(achCount() / 10))]],
            ['Heavenly chips', fmt(S.chips) + (S.chips ? ' (+' + S.chips + '% CpS)' : '')], ['Ascensions', S.resets]
        ];
        el.innerHTML = '<dl class="ck-stats">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' +
            '<button class="ck-wipe" data-ck="wipe" type="button">Wipe save</button>';
    } else if (RT.tab === 'ach') {
        el.innerHTML = '<div class="ck-achgrid">' + ACH.map(function (a) {
            var got = !!S.ach[a.id];
            return '<div class="ck-achb' + (got ? ' got' : '') + '" title="' + esc(a.n + ' — ' + a.d) + '"><b>' + esc(got ? a.n : '???') + '</b><i>' + esc(got ? a.d : 'Locked') + '</i></div>';
        }).join('') + '</div>';
    } else {
        var gain = prestigeAt(S.all) - S.chips;
        el.innerHTML = '<div class="ck-legacy"><p>Ascend to shed this mortal bakery and gain <b>heavenly chips</b> — each one a permanent +1% CpS across every future life.</p>' +
            '<p>Prestige formula: ∛(all-time cookies ÷ 1 trillion). All-time: <b>' + fmt(S.all) + '</b>.</p>' +
            (gain > 0 ? '<button class="ck-ascend" data-ck="ascend" type="button">Ascend — gain ' + fmt(gain) + ' heavenly chip' + (gain === 1 ? '' : 's') + '</button>'
                      : '<p class="ck-dim">Next chip at <b>' + fmt(Math.pow(S.chips + 1, 3) * 1e12) + '</b> all-time cookies. Keep baking.</p>') +
            '</div>';
    }
}

/* ───────────────────────── golden cookies ───────────────────────── */
function scheduleGold(ms) {
    RT.timers.push(setTimeout(function () {
        spawnGold();
        scheduleGold(60000 + Math.random() * 180000);
    }, ms));
}
function spawnGold() {
    if (RT.gold) return;
    var left = RT.q('.ck-left'), r = left.getBoundingClientRect();
    var g = document.createElement('button');
    g.className = 'ck-gold'; g.setAttribute('aria-label', 'Golden cookie!');
    var cv = document.createElement('canvas'); g.appendChild(cv); paintGold(cv);
    g.style.left = (14 + Math.random() * (r.width - 70)) + 'px';
    g.style.top = (60 + Math.random() * (r.height - 160)) + 'px';
    left.appendChild(g); RT.gold = g;
    g.addEventListener('click', function (e) {
        e.stopPropagation();
        S.gold++;
        var roll = Math.random();
        if (roll < 0.45) { RT.buffs.push({ k: 'frenzy', end: Date.now() + 77000 }); newsSet('Frenzy! Cookie production ×7 for 77 seconds!'); }
        else if (roll < 0.9) { var lucky = Math.min(S.bank * 0.15, cps(true) * 900) + 13; S.bank += lucky; S.total += lucky; S.all += lucky; newsSet('Lucky! +' + fmt(lucky) + ' cookies!'); }
        else { RT.buffs.push({ k: 'click', end: Date.now() + 13000 }); newsSet('Click frenzy! Clicking power ×777 for 13 seconds!'); }
        killGold(); checkAch(); paintCounts(); paintBuffs();
    });
    RT.timers.push(setTimeout(killGold, 13000));
}
function killGold() { if (RT.gold) { RT.gold.remove(); RT.gold = null; } }
function paintGold(cv) {
    cv.width = 20; cv.height = 20; var x = cv.getContext('2d');
    for (var yy = 0; yy < 20; yy++) for (var xx = 0; xx < 20; xx++) {
        var dx = xx - 10 + 0.5, dy = yy - 10 + 0.5, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 9) continue;
        x.fillStyle = d > 8 ? '#a67c1a' : ((-dx - dy) > 3 ? '#f7e07a' : '#e0b83a');
        x.fillRect(xx, yy, 1, 1);
    }
    x.fillStyle = '#8a6414'; x.fillRect(6, 7, 2, 2); x.fillRect(12, 10, 2, 2); x.fillRect(8, 13, 2, 2);
}

/* ───────────────────────── achievements ───────────────────────── */
function checkAch() {
    var c = cps(true), got = [];
    ACH.forEach(function (a) { if (!S.ach[a.id] && a.test(S, c)) { S.ach[a.id] = 1; got.push(a); } });
    if (got.length) {
        sSave();
        var t = RT.q('.ck-achtoast');
        t.innerHTML = '<b>Achievement unlocked</b>' + got.slice(0, 3).map(function (a) { return '<span>' + esc(a.n) + '</span>'; }).join('');
        t.hidden = false; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
        RT.timers.push(setTimeout(function () { t.classList.remove('on'); t.hidden = true; }, 3400));
        if (RT.tab === 'ach' || RT.tab === 'stats') paintTab();
    }
}

/* ───────────────────────── news / tooltip / fx ───────────────────────── */
function newsSet(line) { var t = RT.q('.ck-news-t'); t.textContent = line; t.classList.remove('roll'); void t.offsetWidth; t.classList.add('roll'); }
function newsCycle() {
    var pool = NEWS.slice();
    if ((S.b.grandma || 0) >= 50 && Math.random() < 0.4) pool = NEWS_GRAN;
    RT.newsI = (RT.newsI + 1 + Math.floor(Math.random() * 3)) % pool.length;
    newsSet(pool[RT.newsI]);
}
function wireTip(container, sel, html) {
    container.addEventListener('mousemove', function (e) {
        var t = e.target.closest(sel), tip = RT.q('.ck-tip');
        if (!t) { tip.hidden = true; return; }
        tip.innerHTML = html(t); tip.hidden = false;
        var rr = RT.root.getBoundingClientRect();
        tip.style.left = clamp(e.clientX - rr.left - 240, 6, rr.width - 250) + 'px';
        tip.style.top = clamp(e.clientY - rr.top + 14, 6, rr.height - 110) + 'px';
    });
    container.addEventListener('mouseleave', function () { RT.q('.ck-tip').hidden = true; });
}
function floater(e, txt) {
    var big = RT.q('.ck-left'), r = big.getBoundingClientRect();
    var f = document.createElement('span'); f.className = 'ck-fl'; f.textContent = txt;
    f.style.left = (e.clientX - r.left + (Math.random() * 26 - 13)) + 'px';
    f.style.top = (e.clientY - r.top - 10) + 'px';
    big.appendChild(f);
    RT.timers.push(setTimeout(function () { f.remove(); }, 900));
}

/* rain of tiny cookies + rising milk, one light rAF while the window lives */
function rainInit() {
    var cv = RT.q('.ck-rain');
    for (var i = 0; i < 14; i++) RT.rainDrops.push({ x: Math.random(), y: Math.random(), v: 0.15 + Math.random() * 0.4, s: Math.random() < 0.3 ? 3 : 2 });
    RT.rainCv = cv; RT.milkCv = RT.q('.ck-milk'); RT.milkT = 0;
}
function rafLoop() {
    RT.raf = requestAnimationFrame(rafLoop);
    var cv = RT.rainCv, left = RT.q('.ck-left');
    if (!cv || !left) return;
    var w = left.clientWidth, h = left.clientHeight;
    if (cv.width !== w) { cv.width = w; cv.height = h; }
    var x = cv.getContext('2d'); x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(190,140,70,.5)';
    RT.rainDrops.forEach(function (d) {
        d.y += d.v / 240; if (d.y > 1) { d.y = -0.05; d.x = Math.random(); }
        x.fillRect(d.x * w, d.y * h, d.s, d.s);
    });
    // milk wave
    var mv = RT.milkCv, lvl = clamp(milk() * 0.55, 0, 0.5);
    if (mv.width !== w) { mv.width = w; mv.height = 60; }
    var mx = mv.getContext('2d'); mx.clearRect(0, 0, w, 60);
    if (lvl > 0) {
        RT.milkT += 0.03;
        mx.fillStyle = 'rgba(238,240,250,.85)';
        mx.beginPath(); mx.moveTo(0, 60);
        for (var i = 0; i <= w; i += 6) mx.lineTo(i, 60 - lvl * 100 + Math.sin(i * 0.05 + RT.milkT) * 3);
        mx.lineTo(w, 60); mx.closePath(); mx.fill();
    }
}

/* ───────────────────────── lifecycle / Steam ───────────────────────── */
function close() {
    var hrs = RT ? (Date.now() - RT.started) / 3600000 : 0;
    if (RT) {
        RT.timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
        cancelAnimationFrame(RT.raf);
        killGold();
        RT = null;
    }
    sSave();
    return Math.round(hrs * 10) / 10;
}
function steamAch() {
    sLoad();
    var list = ACH.map(function (a) { return [a.n, a.d, S.ach[a.id] ? 1 : 0]; });
    return { n: achCount(), total: ACH.length, list: list };
}

window.COOKIE = { render: render, init: init, close: close, steamAch: steamAch };
})();
