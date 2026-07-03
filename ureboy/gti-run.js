/* ============================================================
   GTI RUN — a URE BOY racing cartridge   (vanilla, no deps)
   Pseudo-3D arcade racer at true Game Boy resolution (160x144),
   rendered to a backbuffer and nearest-neighbor scaled up.
   Registers window.GTIRUN = { mount(host, api), unmount() }.
   ============================================================ */
(function () {
    'use strict';

    var W = 160, H = 144;              // logical (DMG) resolution
    var HOR_BASE = 52;                 // horizon row at flat ground
    var CAMK = 10;                     // row->depth constant: z = CAMK / p
    var DRAW = 460;                    // draw distance (world units)
    var ROAD_HALF_PX = 80;             // half road width at the nearest row, in px
    var PZ = 14;                       // player's depth ahead of the camera
    var STAGE_LEN = 4200;              // world units per stage
    var SPEED_MAX = 165;               // world units / s
    var MPH = 0.93;                    // display factor -> ~153 mph flat out
    var BOOST_MULT = 1.30;

    /* ---------------- palette ----------------
       Every color is [hex, dmgTier]. In Game Boy theme the hex is swapped
       for the classic 4-shade DMG green by tier (0 darkest .. 3 lightest). */
    var DMG = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
    var mode = 'color';                            // 'color' | 'dmg'
    function C(pair) { return mode === 'dmg' ? DMG[pair[1]] : pair[0]; }

    var INK = {   // shared sprite legend colors
        K: ['#0e0e12', 0], T: ['#08080a', 0],
        w: ['#252b38', 1], G: ['#4d5a6e', 2],
        W: ['#f2f2ee', 3], L: ['#ff5030', 3], l: ['#7c1207', 1],
        D: ['#23262c', 1], d: ['#40454e', 2], S: ['#c7ccd4', 2],
        R: ['#d81e05', 2], r: ['#9a1505', 1], Q: ['#f04a30', 3]
    };

    /* ---------------- stages ---------------- */
    var STAGES = [
        {
            name: 'THE WOODLANDS', time: 27,
            sky: [['#2e2a4a', 2], ['#6a3f6b', 2], ['#b0527d', 3], ['#e08b6d', 3], ['#f2c987', 3], ['#f9e9c0', 3]],
            grass: [['#2f7a3d', 2], ['#296e36', 2]],
            road: [['#63646e', 3], ['#5b5c66', 3]],
            rumble: [['#d8d4c8', 3], ['#c03a2a', 0]],
            lane: ['#e8e6da', 0],
            bg: ['#1d4034', 1], bg2: ['#2a5a44', 1],
            sun: ['#ffd9a0', 3],
            scenery: 'pines', gap: 12, density: 0.85, traffic: 4,
            curves: [[420, 0], [340, 0.55], [260, 0], [380, -0.8], [300, 0], [420, 1.0], [260, 0], [360, -0.55], [300, 0.3], [360, -0.25], [400, 0.7], [400, 0]],
            hillAmp: 7
        },
        {
            name: 'I-45 SOUTH', time: 26,
            sky: [['#2557a7', 2], ['#3a6fc4', 2], ['#5b8fd9', 3], ['#8ab4e8', 3], ['#b7d4f2', 3], ['#e2eefc', 3]],
            grass: [['#7ba04a', 2], ['#6f9443', 2]],
            road: [['#6a6b75', 3], ['#626371', 3]],
            rumble: [['#e8e4d8', 3], ['#c03a2a', 0]],
            lane: ['#f0eee2', 0],
            bg: ['#4a7a52', 1], bg2: ['#5d9163', 1],
            sun: null, clouds: true,
            scenery: 'highway', gap: 26, density: 0.8, traffic: 7,
            curves: [[500, 0], [400, 0.35], [400, 0], [360, -0.4], [500, 0], [340, 0.9], [300, -0.9], [400, 0], [500, 0.25], [500, 0]],
            hillAmp: 2
        },
        {
            name: 'HOUSTON', time: 26,
            sky: [['#1b1b3a', 1], ['#3a2b5f', 1], ['#6b3a74', 2], ['#a04a6e', 2], ['#d97a5a', 3], ['#f2b04a', 3]],
            grass: [['#4a5548', 2], ['#424d40', 2]],
            road: [['#565764', 3], ['#4e4f5c', 3]],
            rumble: [['#c8c4bc', 3], ['#a83226', 0]],
            lane: ['#d8d4c8', 0],
            bg: ['#232746', 1], bg2: ['#2f3458', 1],
            sun: ['#f2b04a', 3], rain: true, skyline: true,
            scenery: 'city', gap: 18, density: 0.8, traffic: 5,
            curves: [[380, 0], [280, 0.7], [240, -0.7], [280, 0.7], [340, 0], [400, -0.45], [300, 0], [280, 0.95], [340, 0], [360, -0.6], [400, 0.2], [600, 0]],
            hillAmp: 3
        },
        {
            name: 'MIDLAND BASIN', time: 25,
            sky: [['#050914', 1], ['#0a1128', 1], ['#101a3a', 1], ['#1a2750', 1], ['#253566', 2], ['#33477f', 2]],
            grass: [['#7a6a4a', 2], ['#6e5f42', 2]],
            road: [['#4b4c58', 3], ['#434450', 3]],
            rumble: [['#b8b4a8', 3], ['#8c2a20', 0]],
            lane: ['#c8c4b8', 0],
            bg: ['#151226', 1], bg2: ['#1e1a33', 1],
            stars: true, moon: true,
            scenery: 'basin', gap: 22, density: 0.75, traffic: 3,
            curves: [[600, 0], [500, 0.5], [400, 0], [500, -0.5], [600, 0.85], [400, 0], [500, -0.85], [700, 0.3], [520, 0]],
            hillAmp: 9
        }
    ];
    // precompute cumulative curve tables
    (function () {
        for (var s = 0; s < STAGES.length; s++) {
            var acc = 0, cum = [];
            for (var i = 0; i < STAGES[s].curves.length; i++) {
                cum.push(acc); acc += STAGES[s].curves[i][0];
            }
            STAGES[s].cum = cum; STAGES[s].total = acc;
        }
    })();
    function stageAt(z) { return STAGES[(Math.floor(z / STAGE_LEN) % 4 + 4) % 4]; }
    function curveAt(z) {
        var st = stageAt(z);
        var local = ((z % STAGE_LEN) + STAGE_LEN) % STAGE_LEN;
        local = local * (st.total / STAGE_LEN);              // stretch authored curves over the stage
        var i, c = 0;
        for (i = st.curves.length - 1; i >= 0; i--) { if (local >= st.cum[i]) break; }
        if (i < 0) i = 0;
        c = st.curves[i][1];
        // ease section-to-section over 90 units to avoid kinks
        var into = local - st.cum[i];
        if (into < 90 && i > 0) {
            var prev = st.curves[i - 1][1];
            var t = into / 90;
            c = prev + (c - prev) * (t * t * (3 - 2 * t));
        }
        return c;
    }
    function hillAt(z) {
        var st = stageAt(z);
        return (Math.sin(z * 0.006) * 0.6 + Math.sin(z * 0.0023 + 1.7) * 0.4) * st.hillAmp;
    }
    function rand01(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

    /* ---------------- 4x5 bitmap font ---------------- */
    var FONT = {
        'A': '.XX.|X..X|XXXX|X..X|X..X', 'B': 'XXX.|X..X|XXX.|X..X|XXX.', 'C': '.XXX|X...|X...|X...|.XXX',
        'D': 'XXX.|X..X|X..X|X..X|XXX.', 'E': 'XXXX|X...|XXX.|X...|XXXX', 'F': 'XXXX|X...|XXX.|X...|X...',
        'G': '.XXX|X...|X.XX|X..X|.XXX', 'H': 'X..X|X..X|XXXX|X..X|X..X', 'I': 'XXX.|.X..|.X..|.X..|XXX.',
        'J': '..XX|...X|...X|X..X|.XX.', 'K': 'X..X|X.X.|XX..|X.X.|X..X', 'L': 'X...|X...|X...|X...|XXXX',
        'M': 'X..X|XXXX|XXXX|X..X|X..X', 'N': 'X..X|XX.X|X.XX|X..X|X..X', 'O': '.XX.|X..X|X..X|X..X|.XX.',
        'P': 'XXX.|X..X|XXX.|X...|X...', 'Q': '.XX.|X..X|X..X|X.XX|.XXX', 'R': 'XXX.|X..X|XXX.|X.X.|X..X',
        'S': '.XXX|X...|.XX.|...X|XXX.', 'T': 'XXXX|.X..|.X..|.X..|.X..', 'U': 'X..X|X..X|X..X|X..X|.XX.',
        'V': 'X..X|X..X|X..X|.XX.|.X..', 'W': 'X..X|X..X|XXXX|XXXX|X..X', 'X': 'X..X|X..X|.XX.|X..X|X..X',
        'Y': 'X..X|X..X|.XX.|.X..|.X..', 'Z': 'XXXX|...X|.XX.|X...|XXXX',
        '0': '.XX.|X..X|X..X|X..X|.XX.', '1': '.X..|XX..|.X..|.X..|XXX.', '2': 'XXX.|...X|.XX.|X...|XXXX',
        '3': 'XXX.|...X|.XX.|...X|XXX.', '4': 'X..X|X..X|XXXX|...X|...X', '5': 'XXXX|X...|XXX.|...X|XXX.',
        '6': '.XXX|X...|XXX.|X..X|.XX.', '7': 'XXXX|...X|..X.|.X..|.X..', '8': '.XX.|X..X|.XX.|X..X|.XX.',
        '9': '.XX.|X..X|.XXX|...X|XXX.',
        '!': '.X..|.X..|.X..|....|.X..', '.': '....|....|....|....|.X..', ',': '....|....|....|.X..|X...',
        '-': '....|....|XXX.|....|....', '+': '....|.X..|XXX.|.X..|....', ':': '....|.X..|....|.X..|....',
        'x': '....|X.X.|.X..|X.X.|....', "'": '.X..|.X..|....|....|....', '/': '...X|..X.|.X..|X...|....',
        '>': 'X...|XX..|XXX.|XX..|X...', '<': '...X|..XX|.XXX|..XX|...X', '#': '.XX.|XXXX|.XX.|XXXX|.XX.',
        '(': '..X.|.X..|.X..|.X..|..X.', ')': '.X..|..X.|..X.|..X.|.X..', '%': 'X..X|...X|.XX.|X...|X..X',
        '?': 'XXX.|...X|.XX.|....|.X..', ' ': '....|....|....|....|....'
    };
    // drawText: bctx target, pixel-rect glyphs, integer scale
    function textW(str, scale) { return str.length * 5 * scale - scale; }
    function drawTextC(ctx, str, x, y, color, scale) {
        scale = scale || 1;
        ctx.fillStyle = color;
        for (var i = 0; i < str.length; i++) {
            var g = FONT[str[i]] || FONT[' '];
            var rows = g.split('|');
            for (var ry = 0; ry < rows.length; ry++) {
                for (var rx = 0; rx < 4; rx++) {
                    if (rows[ry][rx] === 'X') ctx.fillRect(x + (rx + i * 5) * scale, y + ry * scale, scale, scale);
                }
            }
        }
    }
    function drawText(str, x, y, pair, scale) { drawTextC(bctx, str, x, y, C(pair), scale); }
    function drawTextOutlined(str, x, y, pair, outline, scale) {
        drawText(str, x + scale, y + scale, outline, scale);
        drawText(str, x, y, pair, scale);
    }

    /* ---------------- car sprite art (string maps) ---------------- */
    var PLAYER_ART = [
        '......KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK......',
        '......KRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRK......',
        '..........KK..................KK............',
        '........KKKKKKKKKKKKKKKKKKKKKKKKKKKK........',
        '........KRRwwwwwwwwwwwwwwwwwwwwwwRRK........',
        '.......KRRGGwwwwwwwwwwwwwwwwwwwwwwRRK.......',
        '.KKKK..KRRGGwwwwwwwwwwwwwwwwwwwwwwRRK..KKKK.',
        '.KRRK..KRRwwwwwwwwwwwwwwwwwwwwwwwwRRK..KRRK.',
        '.KKKKKKKRRRwwwwwwwwwwwwwwwwwwwwwwRRRKKKKKKK.',
        '......KRRRRwwwwwwwwwwwwwwwwwwwwwwRRRRK......',
        '.....KRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRrK.....',
        '....KRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRrrK....',
        '....KQRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRrrK....',
        '....KQRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRrrK....',
        '....KRLLLLLLLLLLLLLLllllllLLLLLLLLLLLLrK....',
        '....KrllllllllllllllllllllllllllllllllrK....',
        '....KRRRRRRRRRWWWWWWWWWWWWWWWWRRRRRRRrrK....',
        '....KRRRRRRRRRWKWKWKWKWKWKWKWWRRRRRRRrrK....',
        '....KRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRrrK....',
        '...KKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKK...',
        '..KTTKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKTTK..',
        '..KTTKDddddddddddddddddddddddddddddddDKTTK..',
        '..KTTKSSSKddddddddddddddddddddddddKSSSKTTK..',
        '..KTTK..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..KTTK..',
        '..KTTK................................KTTK..',
        '..KKKK................................KKKK..'
    ];
    var SEDAN_ART = [
        '........KKKKKKKKKKKKKK........',
        '......KKBwwwwwwwwwwwwBKK......',
        '.....KBBwwwwwwwwwwwwwwBBK.....',
        '.....KBBwwwwwwwwwwwwwwBBK.....',
        '....KBBBBBBBBBBBBBBBBBBBBK....',
        '...KBBBBBBBBBBBBBBBBBBBBBBK...',
        '...KBbbbbbbbbbbbbbbbbbbbbBK...',
        '...KLLBBBBBBBBBBBBBBBBBBLLK...',
        '...KLLBBBBWWWWWWWWWWBBBBLLK...',
        '...KBBBBBBWKWKWKWKWKBBBBBBK...',
        '..KKDDDDDDDDDDDDDDDDDDDDDDKK..',
        '.KTTKDDDDDDDDDDDDDDDDDDDDKTTK.',
        '.KTTKDDDDDDDDDDDDDDDDDDDDKTTK.',
        '.KTTK....KKKKKKKKKKKK....KTTK.',
        '.KKKK....................KKKK.'
    ];
    var PICKUP_ART = [
        '.......KKKKKKKKKKKKKKKK.......',
        '......KBwwwwwwwwwwwwwwBK......',
        '.....KBBwwwwwwwwwwwwwwBBK.....',
        '....KBBBBBBBBBBBBBBBBBBBBK....',
        '...KBBBBBBBBBBBBBBBBBBBBBBK...',
        '...KBBKKKKKKKKKKKKKKKKKKBBK...',
        '...KBBKddddddddddddddddKBBK...',
        '...KBBKddddddddddddddddKBBK...',
        '...KBbBBBBBBBBBBBBBBBBBBbBK...',
        '...KLLBBBBBBBBBBBBBBBBBBLLK...',
        '...KLLBBBWKWKWKWKWKWKBBBLLK...',
        '..KKDDDDDDDDDDDDDDDDDDDDDDKK..',
        '.KTTKDDDDDDDDDDDDDDDDDDDDKTTK.',
        '.KTTKDDDDDDDDDDDDDDDDDDDDKTTK.',
        '.KTTK....................KTTK.',
        '.KKKK....................KKKK.'
    ];
    var SEMI_ART = [
        '..KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..',
        '..KPPPPPPPPPPPPPPPPPPPPPPPPPPPPK..',
        '..KPPPPPPPPPPPPPPPPPPPPPPPPPPPPK..',
        '..KPPPPPPPPPPPPPPPPPPPPPPPPPPPPK..',
        '..KPPPPPPPPPPPPPPPPPPPPPPPPPPPPK..',
        '..KppppppppppppppppppppppppppppK..',
        '..KPPPPPPPPPPPPPPPPPPPPPPPPPPPPK..',
        '..KPPPPPPPPPPPPPPPPPPPPPPPPPPPPK..',
        '..KPPPPPPPPPPPPPPPPPPPPPPPPPPPPK..',
        '..KPPPPPPPPPPPPPPPPPPPPPPPPPPPPK..',
        '..KPPPPPPPPPPPPPPPPPPPPPPPPPPPPK..',
        '..KppppppppppppppppppppppppppppK..',
        '..KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..',
        '..KLLDDDDDDDDDDDDDDDDDDDDDDDDLLK..',
        '.KTTKDDDDDDDDDDDDDDDDDDDDDDDDKTTK.',
        '.KTTKDDDDDDDDDDDDDDDDDDDDDDDDKTTK.',
        '.KKKK........................KKKK.'
    ];
    var SPORTS_ART = [
        '.........KKKKKKKKKKKK.........',
        '.......KKBwwwwwwwwwwBKK.......',
        '.....KKBBwwwwwwwwwwwwBBKK.....',
        '...KKBBBBBBBBBBBBBBBBBBBBKK...',
        '..KBBBBBBBBBBBBBBBBBBBBBBBBK..',
        '..KBbbbbbbbbbbbbbbbbbbbbbbBK..',
        '..KLLLBBBBBBBBBBBBBBBBBLLLBK..',
        '..KLLLBBBWKWKWKWKWKWKBBBLLLK..',
        '.KKDDDDDDDDDDDDDDDDDDDDDDDDKK.',
        'KTTKDDDDDDDDDDDDDDDDDDDDDDKTTK',
        'KTTKDDDDDDDDDDDDDDDDDDDDDDKTTK',
        'KKKK......................KKKK'
    ];
    var NPC_TYPES = [
        { art: SEDAN_ART,  worldW: 0.58, sp: [0.50, 0.62], colors: [['#c9c9d4', '#9a9aa8'], ['#4a72c4', '#33518f'], ['#c4b04a', '#93842e']] },
        { art: PICKUP_ART, worldW: 0.60, sp: [0.44, 0.54], colors: [['#2f8f83', '#20655c'], ['#8f5a2f', '#65401f']] },
        { art: SEMI_ART,   worldW: 0.72, sp: [0.38, 0.46], colors: [['#b8bcc4', '#888c96'], ['#7a4a9e', '#573471'], ['#3f7a44', '#2b5730']] },
        { art: SPORTS_ART, worldW: 0.56, sp: [0.68, 0.80], colors: [['#d8a020', '#a57612'], ['#20b4d8', '#1583a0']] }
    ];

    /* ---------------- atlas (sprites prerendered per palette mode) ---------------- */
    var atlas = {};
    function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    function rasterArt(art, extra) {
        var w = art[0].length, h = art.length;
        var c = mkCanvas(w, h), x2 = c.getContext('2d');
        for (var y = 0; y < h; y++) {
            if (art[y].length !== w && window.console) console.warn('GTIRUN art row length', y, art[y].length, '!=', w);
            for (var x = 0; x < art[y].length; x++) {
                var ch = art[y][x];
                if (ch === '.') continue;
                var pair = (extra && extra[ch]) || INK[ch];
                if (!pair) { if (window.console) console.warn('GTIRUN unknown art char', ch); continue; }
                x2.fillStyle = C(pair);
                x2.fillRect(x, y, 1, 1);
            }
        }
        return c;
    }
    // lean frames: shear the base art toward the turn (top rows shift most)
    function shearArt(art, dir, amt) {
        var h = art.length, out = [];
        for (var y = 0; y < h; y++) {
            var shift = Math.round(dir * amt * (1 - y / h));
            var row = art[y];
            if (shift > 0) row = row.slice(shift) + new Array(shift + 1).join('.');
            else if (shift < 0) row = new Array(-shift + 1).join('.') + row.slice(0, row.length + shift);
            out.push(row);
        }
        return out;
    }

    /* -------- programmatic scenery sprites (crisp rects, no strings) -------- */
    function spritePine() {
        var c = mkCanvas(22, 34), g = c.getContext('2d');
        var dark = C([ '#1c4a28', 1 ]), lite = C(['#2f6e3a', 2]), trunk = C(['#4a3423', 1]);
        var tiers = [[10, 3, 4], [8, 8, 6], [6, 15, 7], [3, 23, 7]];   // [halfW at bottom, yTop, height]
        for (var t = 0; t < tiers.length; t++) {
            var hw = tiers[t][0], yt = tiers[t][1], hh = tiers[t][2];
            for (var y = 0; y < hh; y++) {
                var w2 = Math.max(1, Math.round(hw * (y + 1) / hh) + 3);
                g.fillStyle = (y % 2 === 0) ? lite : dark;
                g.fillRect(11 - w2 / 2 | 0, yt + y, w2, 1);
            }
        }
        g.fillStyle = trunk; g.fillRect(10, 29, 3, 5);
        return c;
    }
    function spriteCactus() {
        var c = mkCanvas(16, 24), g = c.getContext('2d');
        var body = C(['#4a7a42', 2]), dk = C(['#33582e', 1]);
        g.fillStyle = body;
        g.fillRect(7, 2, 3, 22);          // trunk
        g.fillRect(2, 7, 3, 7); g.fillRect(2, 12, 6, 3);      // left arm
        g.fillRect(12, 4, 3, 6); g.fillRect(9, 8, 6, 3);      // right arm
        g.fillStyle = dk;
        g.fillRect(8, 2, 1, 22); g.fillRect(3, 7, 1, 7); g.fillRect(13, 4, 1, 6);
        return c;
    }
    function spritePumpjack(frame) {
        var c = mkCanvas(30, 26), g = c.getContext('2d');
        var steel = C(['#2a2432', 1]), head = C(['#3a3346', 1]), rust = C(['#7a3a28', 1]);
        g.fillStyle = steel;
        // A-frame legs
        g.fillRect(13, 8, 2, 16); g.fillRect(9, 12, 2, 12); g.fillRect(17, 12, 2, 12);
        g.fillRect(6, 23, 18, 3);                       // base skid
        // walking beam: tilts with frame
        var tilt = frame === 0 ? -3 : 2;
        for (var i = 0; i < 16; i++) {
            g.fillRect(6 + i, 8 + Math.round(tilt * (i - 8) / 8), 1, 2);
        }
        // horsehead at the left end
        g.fillStyle = head;
        var hy = 8 + Math.round(tilt * -1) - 1;
        g.fillRect(3, hy - 1, 4, 6);
        // counterweight right
        g.fillStyle = rust;
        var cy = 8 + Math.round(tilt * 0.9);
        g.fillRect(21, cy, 5, 5);
        g.fillStyle = steel; g.fillRect(4, hy + 5, 1, 22 - hy > 0 ? Math.min(22 - hy, 12) : 1); // sucker rod
        return c;
    }
    function spriteBillboard(text, accent) {
        var c = mkCanvas(38, 26), g = c.getContext('2d');
        g.fillStyle = C(['#4a4438', 1]);
        g.fillRect(6, 18, 3, 8); g.fillRect(29, 18, 3, 8);          // posts
        g.fillStyle = C(['#14161c', 0]); g.fillRect(0, 0, 38, 18);  // frame
        g.fillStyle = C(['#efe9d6', 3]); g.fillRect(2, 2, 34, 14);  // panel
        var col = C(accent || ['#b5180a', 0]);
        var wpx = textW(text, 1);
        drawTextC(g, text, Math.max(3, (38 - wpx) >> 1), 5, col, 1);
        g.fillStyle = C(['#b8b09a', 2]); g.fillRect(2, 15, 34, 1);
        return c;
    }
    function spriteSign(dir) {   // curve chevron
        var c = mkCanvas(14, 20), g = c.getContext('2d');
        g.fillStyle = C(['#3a3a40', 1]); g.fillRect(6, 12, 2, 8);
        g.fillStyle = C(['#e8c22a', 3]); g.fillRect(1, 1, 12, 11);
        g.fillStyle = C(['#14161c', 0]);
        for (var i = 0; i < 4; i++) {
            var x = dir > 0 ? 3 + i : 9 - i;
            g.fillRect(x, 2 + i, 2, 2);
            g.fillRect(x, 9 - i, 2, 2);
        }
        return c;
    }
    function spriteStreetlight() {
        var c = mkCanvas(12, 34), g = c.getContext('2d');
        g.fillStyle = C(['#3a3f4a', 1]);
        g.fillRect(2, 4, 2, 30); g.fillRect(2, 2, 8, 2);
        g.fillStyle = C(['#ffd98a', 3]); g.fillRect(8, 4, 3, 2);
        return c;
    }
    function spriteArch() {
        var c = mkCanvas(96, 26), g = c.getContext('2d');
        g.fillStyle = C(['#14161c', 0]);
        g.fillRect(0, 0, 96, 12);                                    // banner
        g.fillRect(0, 12, 5, 14); g.fillRect(91, 12, 5, 14);         // legs
        g.fillStyle = C(['#d81e05', 2]); g.fillRect(0, 0, 96, 2); g.fillRect(0, 10, 96, 2);
        drawTextC(g, 'CHECKPOINT', (96 - textW('CHECKPOINT', 1)) >> 1, 4, C(['#f2f2ee', 3]), 1);
        return c;
    }
    function spriteCloud() {
        var c = mkCanvas(26, 10), g = c.getContext('2d');
        g.fillStyle = C(['#f4f6fa', 3]);
        g.fillRect(4, 4, 18, 4); g.fillRect(8, 2, 8, 2); g.fillRect(2, 6, 22, 2); g.fillRect(16, 3, 6, 1);
        return c;
    }
    function spriteMoon() {
        var c = mkCanvas(12, 12), g = c.getContext('2d');
        g.fillStyle = C(['#e8e6d8', 3]);
        g.fillRect(3, 1, 6, 1); g.fillRect(2, 2, 5, 2); g.fillRect(1, 4, 5, 4); g.fillRect(2, 8, 5, 2); g.fillRect(3, 10, 6, 1);
        return c;
    }
    function tileSkyline() {
        var c = mkCanvas(64, 22), g = c.getContext('2d');
        var b = C(['#232746', 1]), win = C(['#ffd98a', 3]);
        var xs = [0, 9, 16, 26, 34, 43, 52, 58], ws = [8, 6, 9, 7, 8, 8, 5, 6], hs = [12, 18, 9, 21, 14, 17, 8, 12];
        g.fillStyle = b;
        for (var i = 0; i < xs.length; i++) g.fillRect(xs[i], 22 - hs[i], ws[i], hs[i]);
        g.fillStyle = win;
        for (i = 0; i < 26; i++) {
            var bi = i % xs.length;
            var wx = xs[bi] + 1 + Math.floor(rand01(i * 3.7) * (ws[bi] - 2));
            var wy = 22 - hs[bi] + 2 + Math.floor(rand01(i * 9.1) * (hs[bi] - 4));
            if (rand01(i * 5.3) > 0.35) g.fillRect(wx, wy, 1, 1);
        }
        return c;
    }
    function tileRidge() {   // far pine ridge / hills
        var c = mkCanvas(64, 14), g = c.getContext('2d');
        g.fillStyle = C(['#1d4034', 1]);
        for (var x = 0; x < 64; x++) {
            var h2 = 5 + Math.round(Math.sin(x * 0.35) * 2 + Math.sin(x * 0.11 + 2) * 3);
            g.fillRect(x, 14 - h2, 1, h2);
        }
        return c;
    }
    function tileMesa() {
        var c = mkCanvas(64, 12), g = c.getContext('2d');
        g.fillStyle = C(['#241d33', 1]);
        g.fillRect(0, 8, 64, 4);
        g.fillRect(4, 4, 16, 4); g.fillRect(6, 3, 12, 1);
        g.fillRect(34, 5, 22, 3); g.fillRect(38, 4, 14, 1);
        return c;
    }
    function tileHills() {
        var c = mkCanvas(64, 12), g = c.getContext('2d');
        g.fillStyle = C(['#4a7a52', 1]);
        for (var x = 0; x < 64; x++) {
            var h2 = 4 + Math.round(Math.sin(x * 0.09 + 1) * 3 + Math.sin(x * 0.23) * 1.5);
            g.fillRect(x, 12 - h2, 1, h2);
        }
        return c;
    }

    var BILLBOARDS = [
        ['URE BOY', ['#b5180a', 0]], ['RICE > 12', ['#1a3a8f', 0]], ['GAS FOOD', ['#7a4a1a', 0]],
        ['EAT', ['#b5180a', 0]], ['P0420 FIX', ['#1a6a2a', 0]], ['DEEP BLUE', ['#153a6e', 0]],
        ['GTI PARTS', ['#b5180a', 0]], ['MOTEL', ['#5a2a7a', 0]]
    ];

    function buildAtlas() {
        atlas = {};
        atlas.player = rasterArt(PLAYER_ART);
        atlas.playerL1 = rasterArt(shearArt(PLAYER_ART, -1, 2));
        atlas.playerL2 = rasterArt(shearArt(PLAYER_ART, -1, 4));
        atlas.playerR1 = rasterArt(shearArt(PLAYER_ART, 1, 2));
        atlas.playerR2 = rasterArt(shearArt(PLAYER_ART, 1, 4));
        atlas.npc = [];
        for (var t = 0; t < NPC_TYPES.length; t++) {
            var frames = [];
            for (var v = 0; v < NPC_TYPES[t].colors.length; v++) {
                frames.push(rasterArt(NPC_TYPES[t].art, {
                    B: [NPC_TYPES[t].colors[v][0], 2],
                    b: [NPC_TYPES[t].colors[v][1], 1],
                    P: [NPC_TYPES[t].colors[v][0], 2],
                    p: [NPC_TYPES[t].colors[v][1], 1]
                }));
            }
            atlas.npc.push(frames);
        }
        atlas.pine = spritePine();
        atlas.cactus = spriteCactus();
        atlas.pump = [spritePumpjack(0), spritePumpjack(1)];
        atlas.bills = [];
        for (var b = 0; b < BILLBOARDS.length; b++) atlas.bills.push(spriteBillboard(BILLBOARDS[b][0], BILLBOARDS[b][1]));
        atlas.signL = spriteSign(-1); atlas.signR = spriteSign(1);
        atlas.lamp = spriteStreetlight();
        atlas.arch = spriteArch();
        atlas.cloud = spriteCloud();
        atlas.moon = spriteMoon();
        atlas.skyline = tileSkyline();
        atlas.ridge = tileRidge();
        atlas.mesa = tileMesa();
        atlas.hills = tileHills();
        // 50% dither tile for GB-style overlays
        var dt = mkCanvas(2, 2), dg = dt.getContext('2d');
        dg.fillStyle = C(['#0a0a10', 0]);
        dg.fillRect(0, 0, 1, 1); dg.fillRect(1, 1, 1, 1);
        atlas.ditherPattern = dt;
    }

    /* ---------------- module state ---------------- */
    var host = null, api = null, mounted = false;
    var bb = null, bctx = null, disp = null, dctx = null;
    var rafId = 0, lastTs = 0, resizeObs = null, recTimer = 0;
    var boundWin = [], boundBtn = [];     // listener bookkeeping for teardown

    /* ---------------- audio (WebAudio synth, gated by console SOUND) ---------------- */
    var AU = {
        ctx: null, master: null,
        engOsc: null, engSub: null, engGain: null, engFilter: null,
        noiseBuf: null, musicTimer: 0, musicAt: 0, musicStep: 0,
        get: function () {
            if (!api || !api.isSound()) return null;
            var c = api.audioCtx();
            if (!c) return null;
            if (this.ctx !== c) { this.ctx = c; this.master = null; }
            if (!this.master) {
                this.master = c.createGain();
                this.master.gain.value = 0.16;
                this.master.connect(c.destination);
            }
            if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
            return c;
        },
        noise: function (c) {
            if (!this.noiseBuf) {
                var len = c.sampleRate * 0.4 | 0;
                this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
                var d = this.noiseBuf.getChannelData(0);
                for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            }
            return this.noiseBuf;
        }
    };
    function tone(freq, dur, type, gain, when, slideTo) {
        var c = AU.get(); if (!c) return;
        try {
            var t0 = (when || c.currentTime);
            var o = c.createOscillator(), g = c.createGain();
            o.type = type || 'square';
            o.frequency.setValueAtTime(freq, t0);
            if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
            g.gain.setValueAtTime(gain || 0.22, t0);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
            o.connect(g); g.connect(AU.master);
            o.start(t0); o.stop(t0 + dur + 0.02);
        } catch (e) {}
    }
    function noiseHit(dur, gain, freq) {
        var c = AU.get(); if (!c) return;
        try {
            var s = c.createBufferSource(); s.buffer = AU.noise(c); s.loop = true;
            var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 700; f.Q.value = 0.8;
            var g = c.createGain();
            g.gain.setValueAtTime(gain || 0.3, c.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
            s.connect(f); f.connect(g); g.connect(AU.master);
            s.start(); s.stop(c.currentTime + dur + 0.02);
        } catch (e) {}
    }
    var SFX = {
        blip: function () { tone(880, 0.05, 'square', 0.14); },
        move: function () { tone(520, 0.03, 'square', 0.1); },
        countLow: function () { tone(440, 0.12, 'square', 0.2); },
        countGo: function () { tone(880, 0.4, 'square', 0.22); },
        checkpoint: function () {
            var c = AU.get(); if (!c) return;
            var n = [660, 880, 1108, 1318];
            for (var i = 0; i < n.length; i++) tone(n[i], 0.09, 'square', 0.16, c.currentTime + i * 0.07);
        },
        nearMiss: function () { tone(300, 0.16, 'sawtooth', 0.1, 0, 950); },
        bump: function () { noiseHit(0.12, 0.26, 400); tone(140, 0.1, 'square', 0.2); },
        crash: function () {
            noiseHit(0.4, 0.4, 500);
            tone(110, 0.35, 'sine', 0.34, 0, 40);
        },
        offroadTick: function () { noiseHit(0.05, 0.07, 300); },
        boostOn: function () { tone(220, 0.25, 'sawtooth', 0.12, 0, 660); },
        over: function () {
            var c = AU.get(); if (!c) return;
            var n = [523, 392, 311, 262];
            for (var i = 0; i < n.length; i++) tone(n[i], 0.16, 'square', 0.18, c.currentTime + i * 0.14);
        },
        record: function () {
            var c = AU.get(); if (!c) return;
            var n = [523, 659, 784, 1046, 784, 1046, 1318];
            for (var i = 0; i < n.length; i++) tone(n[i], 0.12, 'square', 0.16, c.currentTime + i * 0.09);
        }
    };
    /* engine hum: two oscillators pitch-tracking speed with fake gear steps */
    function engineStart() {
        var c = AU.get(); if (!c || AU.engOsc) return;
        try {
            AU.engGain = c.createGain(); AU.engGain.gain.value = 0;
            AU.engFilter = c.createBiquadFilter(); AU.engFilter.type = 'lowpass'; AU.engFilter.frequency.value = 900;
            AU.engOsc = c.createOscillator(); AU.engOsc.type = 'sawtooth';
            AU.engSub = c.createOscillator(); AU.engSub.type = 'square';
            var subG = c.createGain(); subG.gain.value = 0.5;
            AU.engOsc.connect(AU.engFilter);
            AU.engSub.connect(subG); subG.connect(AU.engFilter);
            AU.engFilter.connect(AU.engGain); AU.engGain.connect(AU.master);
            AU.engOsc.start(); AU.engSub.start();
        } catch (e) { AU.engOsc = null; }
    }
    function engineStop() {
        try {
            if (AU.engOsc) { AU.engOsc.stop(); AU.engSub.stop(); }
            if (AU.engGain) AU.engGain.disconnect();
        } catch (e) {}
        AU.engOsc = null; AU.engSub = null; AU.engGain = null;
    }
    var GEARS = [0, 0.17, 0.33, 0.50, 0.67, 0.84, 1.01];
    function gearOf(sp) {
        for (var g = GEARS.length - 2; g >= 0; g--) if (sp >= GEARS[g]) return g;
        return 0;
    }
    function engineUpdate(quiet) {
        if (!api.isSound() || G.state === 'pause' || !mounted) { if (AU.engOsc && AU.engGain) AU.engGain.gain.value = 0; return; }
        var c = AU.get(); if (!c) { return; }
        engineStart(); if (!AU.engOsc) return;
        var sp = G.speed / SPEED_MAX;
        var g = gearOf(sp);
        var prog = (sp - GEARS[g]) / (GEARS[g + 1] - GEARS[g]);
        var f = 40 + prog * 55 + sp * 26 + (G.boosting ? 22 : 0);
        AU.engOsc.frequency.value = f;
        AU.engSub.frequency.value = f * 0.5;
        var vol = sp > 0.02 ? (0.05 + sp * 0.055) : 0.012;
        if (quiet) vol *= 0.35;
        AU.engGain.gain.value = vol;
    }
    /* title chiptune: tiny two-voice loop, scheduled ahead */
    var BASS_SEQ = [36, 36, 43, 43, 39, 39, 41, 43, 36, 36, 43, 43, 46, 46, 43, 41];
    var LEAD_SEQ = [72, 0, 75, 0, 79, 77, 75, 0, 74, 0, 72, 0, 70, 72, 74, 0,
                    72, 0, 75, 0, 79, 0, 82, 80, 79, 0, 75, 0, 74, 72, 70, 0];
    function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function musicTick() {
        var c = AU.get(); if (!c) return;
        var stepDur = 0.16;
        if (AU.musicAt < c.currentTime) { AU.musicAt = c.currentTime + 0.05; }
        while (AU.musicAt < c.currentTime + 0.24) {
            var b = BASS_SEQ[AU.musicStep % BASS_SEQ.length];
            var l = LEAD_SEQ[AU.musicStep % LEAD_SEQ.length];
            if (b) tone(midi(b), stepDur * 0.9, 'triangle', 0.16, AU.musicAt);
            if (l) tone(midi(l), stepDur * 0.75, 'square', 0.07, AU.musicAt);
            AU.musicAt += stepDur;
            AU.musicStep++;
        }
    }
    function musicStart() {
        if (AU.musicTimer) return;
        AU.musicStep = 0; AU.musicAt = 0;
        AU.musicTimer = setInterval(musicTick, 90);
    }
    function musicStop() {
        if (AU.musicTimer) { clearInterval(AU.musicTimer); AU.musicTimer = 0; }
    }

    /* ---------------- game state ---------------- */
    var G = {};
    function resetRun(demo) {
        G.state = demo ? 'demo' : 'count';
        G.demo = !!demo;
        G.camZ = 0;
        G.speed = demo ? SPEED_MAX * 0.8 : 0;
        G.playerX = 0;
        G.steer = 0;                 // -1..1 held input
        G.boost = 1.2; G.boosting = false;
        G.timeLeft = STAGES[0].time + 18;
        G.score = 0; G.dispScore = 0;
        G.combo = 0; G.comboT = 0;
        G.stageIdx = 0; G.lastStage = 0;
        G.spinT = 0; G.spinA = 0; G.invulnT = 0;
        G.countT = demo ? 0 : 3.6;
        G.overT = 0; G.overPhase = 0;
        G.demoT = 0;
        G.newRecord = false;
        G.shake = 0; G.flash = 0; G.slowmo = 0;
        G.bump = 0;                  // suspension bounce
        G.passCount = 0;
        G.banner = demo ? null : { l1: 'STAGE 1', l2: STAGES[0].name, t: 2.4 };
        G.popups = [];
        parts.length = 0;
        speedLines.length = 0;
        initTraffic();
        initRain();
    }
    function toTitle() {
        G.state = 'title';
        G.demo = false;
        G.titleT = 0; G.camZ = ((G.camZ || 0) % (STAGE_LEN * 4));
        G.speed = 62; G.playerX = 0; G.boosting = false;
        G.shake = 0; G.flash = 0; G.slowmo = 0;
        G.popups = []; parts.length = 0; speedLines.length = 0;
        traffic.length = 0;
        musicStart();
    }

    /* high score */
    function loadHS() { try { return parseInt(localStorage.getItem('ub_gti_hs') || '0', 10) || 0; } catch (e) { return 0; } }
    function saveHS(v) { try { localStorage.setItem('ub_gti_hs', String(v)); } catch (e) {} }

    /* ---------------- traffic ---------------- */
    var traffic = [];
    var LANES = [-0.55, 0, 0.55];
    function spawnNPC(zMin, zMax, tries) {
        var st = stageAt(G.camZ);
        var type = Math.floor(Math.random() * NPC_TYPES.length);
        // trucks rarer outside I-45
        if (type === 2 && st.name !== 'I-45 SOUTH' && Math.random() < 0.5) type = 0;
        var t = NPC_TYPES[type];
        var lane = LANES[Math.floor(Math.random() * 3)];
        var z = zMin + Math.random() * (zMax - zMin);
        // keep spawn gaps sane
        for (var i = 0; i < traffic.length; i++) {
            if (Math.abs(traffic[i].z - z) < 46 && Math.abs(traffic[i].x - lane) < 0.4) {
                if (tries > 0) return spawnNPC(zMin, zMax, tries - 1);
                return null;
            }
        }
        return {
            type: type, variant: Math.floor(Math.random() * t.colors.length),
            z: z, x: lane + (Math.random() * 0.14 - 0.07),
            sp: SPEED_MAX * (t.sp[0] + Math.random() * (t.sp[1] - t.sp[0])),
            prevRel: 1, laneT: 0
        };
    }
    function initTraffic() {
        traffic.length = 0;
        var st = stageAt(G.camZ);
        for (var i = 0; i < st.traffic; i++) {
            var n = spawnNPC(G.camZ + 120 + i * 60, G.camZ + DRAW + 100, 4);
            if (n) traffic.push(n);
        }
    }
    function updateTraffic(dt) {
        var st = stageAt(G.camZ);
        var lap = Math.floor(G.camZ / (STAGE_LEN * 4));
        var want = Math.min(9, st.traffic + Math.floor(lap * 1.5));
        var playerZ = G.camZ + PZ;
        for (var i = 0; i < traffic.length; i++) {
            var n = traffic[i];
            n.z += n.sp * dt;
            // drift back to a lane center after avoidance
            if (n.laneT > 0) { n.laneT -= dt; }
            // simple avoidance: slower car directly ahead -> pick a free lane
            if (n.type !== 2 && n.laneT <= 0) {
                for (var j = 0; j < traffic.length; j++) {
                    if (j === i) continue;
                    var m = traffic[j];
                    if (m.z > n.z && m.z - n.z < 55 && Math.abs(m.x - n.x) < 0.3 && m.sp < n.sp) {
                        var target = n.x > 0 ? n.x - 0.55 : n.x + 0.55;
                        if (Math.abs(target) < 0.75) { n.x = target; n.laneT = 2.5; }
                        break;
                    }
                }
            }
            var rel = n.z - playerZ;
            // passing events
            if (n.prevRel > 0 && rel <= 0 && G.state === 'run' && G.spinT <= 0) {
                var dx = Math.abs(n.x - G.playerX);
                G.passCount++;
                if (dx < 0.72 && dx > 0.40 && G.speed > SPEED_MAX * 0.6) {
                    // near miss!
                    G.combo = Math.min(5, G.combo + 1); G.comboT = 4;
                    var pts = 150 * G.combo;
                    addScore(pts);
                    popup('NEAR MISS +' + pts, ['#f2f2ee', 3]);
                    G.boost = Math.min(3, G.boost + 0.55);
                    SFX.nearMiss();
                } else if (dx >= 0.72) {
                    addScore(80);
                }
            }
            n.prevRel = rel;
            // recycle far-behind cars ahead of the player
            if (rel < -40) {
                var fresh = spawnNPC(G.camZ + DRAW * 0.7, G.camZ + DRAW + 140, 4);
                if (fresh) { traffic[i] = fresh; }
                else { n.z = G.camZ + DRAW + 60 + Math.random() * 120; n.prevRel = 1; }
            }
        }
        while (traffic.length < want) {
            var extra = spawnNPC(G.camZ + 200, G.camZ + DRAW + 120, 4);
            if (!extra) break;
            traffic.push(extra);
        }
        if (traffic.length > want + 2) traffic.length = want + 2;
    }
    function collide(dt) {
        if (G.state !== 'run' && G.state !== 'demo') return;
        if (G.spinT > 0 || G.invulnT > 0) return;
        var playerZ = G.camZ + PZ;
        for (var i = 0; i < traffic.length; i++) {
            var n = traffic[i];
            var rel = n.z - playerZ;
            if (Math.abs(rel) < 6 && Math.abs(n.x - G.playerX) < 0.40) {
                var closing = G.speed - n.sp;
                if (closing > 55 && rel > 0) {
                    // full crash: spin out
                    G.spinT = 0.9; G.spinA = 0;
                    G.combo = 0;
                    G.shake = 0.5; G.flash = 0.12;
                    if (!reduceFX()) G.slowmo = 0.42;
                    G.speed = Math.min(G.speed, SPEED_MAX * 0.22);
                    n.z += 14;      // shove the poor sedan up the road
                    SFX.crash();
                    popup('CRASH!', ['#ff5030', 3]);
                    burstParts(W / 2, 112, 14, 'spark');
                } else {
                    // glancing bump
                    G.speed = Math.max(40, n.sp * 0.86);
                    G.playerX += (G.playerX < n.x ? -1 : 1) * 0.22;
                    G.combo = 0;
                    G.shake = Math.max(G.shake, 0.22);
                    SFX.bump();
                    burstParts(W / 2 + (G.playerX < n.x ? 18 : -18), 108, 7, 'spark');
                }
                return;
            }
        }
    }

    /* ---------------- particles / popups ---------------- */
    var parts = [];
    var speedLines = [];
    var rain = [];
    function reduceFX() { return api && api.reduce; }
    function spawnPart(x, y, vx, vy, life, pair, size, grav) {
        if (parts.length > 90) return;
        parts.push({ x: x, y: y, vx: vx, vy: vy, t: 0, life: life, pair: pair, size: size || 1, grav: grav || 0 });
    }
    function burstParts(x, y, n, kind) {
        if (reduceFX()) n = Math.min(n, 4);
        for (var i = 0; i < n; i++) {
            var a = Math.random() * Math.PI * 2, sp2 = 18 + Math.random() * 46;
            if (kind === 'spark') {
                spawnPart(x, y, Math.cos(a) * sp2 * 1.6, -Math.abs(Math.sin(a)) * sp2 - 20, 0.5, Math.random() < 0.5 ? ['#ffd98a', 3] : ['#ff5030', 3], 1, 190);
            } else if (kind === 'confetti') {
                spawnPart(x, y, Math.cos(a) * 14, 12 + Math.random() * 26, 1.6, [['#d81e05', 2], ['#f2b04a', 3], ['#2f8f83', 2], ['#f2f2ee', 3]][i % 4], Math.random() < 0.4 ? 2 : 1, 24);
            }
        }
    }
    function updateParts(dt) {
        for (var i = parts.length - 1; i >= 0; i--) {
            var p = parts[i];
            p.t += dt;
            if (p.t >= p.life) { parts.splice(i, 1); continue; }
            p.vy += p.grav * dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
        }
    }
    function drawParts() {
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (p.t / p.life > 0.75 && (frame & 2)) continue;    // dying particles flicker
            bctx.fillStyle = C(p.pair);
            bctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
        }
    }
    function popup(text, pair) {
        G.popups.push({ text: text, pair: pair, t: 0 });
        if (G.popups.length > 3) G.popups.shift();
    }
    function initRain() {
        rain.length = 0;
        for (var i = 0; i < 26; i++) {
            rain.push({ x: Math.random() * W, y: Math.random() * H, l: 3 + Math.random() * 4 });
        }
    }

    /* ---------------- player update ---------------- */
    function addScore(v) { G.score += v; }
    function updatePlayer(dt) {
        var sp = G.speed / SPEED_MAX;
        var st = stageAt(G.camZ);
        var offroad = Math.abs(G.playerX) > 1.05;

        if (G.spinT > 0) {
            G.spinT -= dt;
            G.spinA += dt * 9.2;
            G.speed = Math.max(30, G.speed - 130 * dt);
            if (G.spinT <= 0) { G.invulnT = 1.5; }
            if (!reduceFX() && frame % 3 === 0) {
                spawnPart(W / 2 - 12 + Math.random() * 24, 116, (Math.random() - 0.5) * 20, -22 - Math.random() * 18, 0.8, ['#8a8d96', 2], 2, -14);
            }
        } else {
            // steering (game-feel: quicker to counter-steer than to hold)
            var steerRate = 1.62 * (0.34 + 0.66 * sp);
            G.playerX += G.steer * steerRate * dt;
            // centrifugal pull from the current curve
            var curve = curveAt(G.camZ + PZ);
            G.playerX -= curve * sp * sp * 1.9 * dt;

            // throttle: auto-cruise; boost overrides; brake/offroad drag down
            G.boosting = G.heldBoost && G.boost > 0 && G.speed > 30 && !G.demo;
            var target = SPEED_MAX * (G.boosting ? BOOST_MULT : 1);
            if (G.heldBrake) {
                G.speed = Math.max(0, G.speed - 210 * dt);
            } else if (offroad) {
                G.speed = Math.min(G.speed, Math.max(72, G.speed - 150 * dt));
                G.speed = Math.min(target, G.speed + 26 * dt);
            } else {
                var accel = G.boosting ? 130 : 62 * (1.08 - sp * 0.85);
                G.speed = Math.min(target, G.speed + accel * dt);
                if (G.speed > target) G.speed = Math.max(target, G.speed - 90 * dt);
            }
            if (G.boosting) {
                G.boost = Math.max(0, G.boost - 0.85 * dt);
                if (G.boost <= 0) G.boosting = false;
            }
        }
        G.playerX = Math.max(-1.45, Math.min(1.45, G.playerX));
        if (G.invulnT > 0) G.invulnT -= dt;

        // offroad rumble
        if (offroad && G.speed > 40 && G.spinT <= 0) {
            G.bump = (frame % 4 < 2) ? 1 : 0;
            if (frame % 5 === 0) {
                SFX.offroadTick();
                var side = G.playerX > 0 ? 1 : -1;
                spawnPart(W / 2 + side * 20 + (Math.random() * 10 - 5), 124, -side * 14, -30 - Math.random() * 20, 0.55, st.grass[0], 1, 120);
            }
            G.shake = Math.max(G.shake, 0.12);
        } else {
            G.bump = 0;
        }

        // exhaust: idle putter and boost flames handled at draw; embers here
        if (!reduceFX() && G.boosting && frame % 2 === 0) {
            spawnPart(W / 2 - 8 + Math.random() * 16, 128, (Math.random() - 0.5) * 26, 30 + Math.random() * 40, 0.4, Math.random() < 0.5 ? ['#ffd98a', 3] : ['#ff8a30', 3], 1, 0);
        }

        G.camZ += G.speed * dt;

        // combo decay
        if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }

        // scoring by distance
        if (G.state === 'run') addScore(G.speed * dt * 0.55);

        // stage / checkpoint crossings
        var idx = Math.floor(G.camZ / STAGE_LEN);
        if (idx !== G.lastStage) {
            G.lastStage = idx;
            G.stageIdx = idx % 4;
            var lap = Math.floor(idx / 4);
            var stNew = STAGES[G.stageIdx];
            if (G.state === 'run') {
                var bonusT = Math.max(18, stNew.time - lap * 2);
                G.timeLeft += bonusT;
                addScore(500);
                G.boost = Math.min(3, G.boost + 1.2);
                G.flash = 0.1;
                SFX.checkpoint();
                popup('CHECKPOINT +' + bonusT + '!', ['#f2f2ee', 3]);
                if (G.stageIdx === 2 && api.markEgg) api.markEgg('gtirun', 'drove all the way to Houston');
            }
            G.banner = { l1: (lap > 0 ? 'LAP ' + (lap + 1) + ' - ' : '') + 'STAGE ' + (G.stageIdx + 1), l2: stNew.name, t: 2.4 };
        }

        // speed lines at very high speed
        if (!reduceFX() && sp > 0.86 && frame % 2 === 0 && speedLines.length < 10) {
            var e = Math.random() < 0.5;
            speedLines.push({ x: e ? 2 + Math.random() * 30 : W - 32 + Math.random() * 30, y: HOR_BASE + Math.random() * 60, len: 8 + Math.random() * 14, t: 0 });
        }
        for (var i = speedLines.length - 1; i >= 0; i--) {
            speedLines[i].t += dt;
            speedLines[i].y += 90 * dt;
            if (speedLines[i].t > 0.3) speedLines.splice(i, 1);
        }
    }

    /* demo autopilot: hunt the emptiest lane */
    function demoSteer(dt) {
        var playerZ = G.camZ + PZ;
        var danger = null, dMin = 1e9;
        for (var i = 0; i < traffic.length; i++) {
            var rel = traffic[i].z - playerZ;
            if (rel > 4 && rel < 110 && Math.abs(traffic[i].x - G.playerX) < 0.5 && rel < dMin) {
                dMin = rel; danger = traffic[i];
            }
        }
        var target = 0;
        if (danger) target = danger.x > 0 ? danger.x - 0.72 : danger.x + 0.72;
        target = Math.max(-0.8, Math.min(0.8, target));
        // also lean into curves a touch
        target -= curveAt(G.camZ + PZ) * 0.25;
        G.steer = Math.max(-1, Math.min(1, (target - G.playerX) * 4));
    }

    /* ---------------- projection + scene rendering ---------------- */
    var xoff = new Float32Array(H);
    var frame = 0;
    var ditherPat = null;

    function band(z, len) { return (Math.floor(z / len) % 2 + 2) % 2; }
    function ditherFill(x, y, w, h) {
        if (!ditherPat) return;
        bctx.fillStyle = ditherPat;
        bctx.fillRect(x, y, w, h);
    }
    function project(rel, hor) {
        var p = CAMK / rel;
        var y = hor + p * (H - hor);
        var yi = Math.max(hor + 1, Math.min(H - 1, Math.round(y)));
        return { p: p, y: y, xo: xoff[yi] };
    }
    function renderScene(showCar) {
        var st = stageAt(G.camZ);
        var hill = hillAt(G.camZ);
        var hor = Math.max(26, Math.min(78, Math.round(HOR_BASE - hill)));

        /* sky bands */
        var bh = Math.max(1, Math.ceil(hor / st.sky.length));
        for (var i = 0; i < st.sky.length; i++) {
            bctx.fillStyle = C(st.sky[i]);
            bctx.fillRect(0, i * bh, W, i === st.sky.length - 1 ? hor - i * bh + 1 : bh);
        }
        /* celestial bits */
        if (st.stars) {
            bctx.fillStyle = C(['#dfe2ea', 3]);
            for (i = 0; i < 42; i++) {
                if ((frame + i) % 90 < 4) continue;   // twinkle
                var sx = Math.floor(rand01(i * 3.1) * W);
                var sy = Math.floor(rand01(i * 7.7) * (hor - 10));
                bctx.fillRect(sx, sy, 1, 1);
            }
        }
        if (st.moon) bctx.drawImage(atlas.moon, 128, 8);
        if (st.sun) {
            var sunX = st.skyline ? 34 : 112, sunY = st.skyline ? hor - 8 : hor - 20, sr = st.skyline ? 9 : 7;
            bctx.fillStyle = C(st.sun);
            for (var dy = -sr; dy <= sr; dy++) {
                var hw = Math.floor(Math.sqrt(sr * sr - dy * dy));
                if (sunY + dy < hor) bctx.fillRect(sunX - hw, sunY + dy, hw * 2 + 1, 1);
            }
        }
        if (st.clouds) {
            for (i = 0; i < 3; i++) {
                var cx = ((rand01(i * 13.7) * 260 + G.bgX * 0.25 + i * 70) % (W + 60) + (W + 60)) % (W + 60) - 30;
                bctx.drawImage(atlas.cloud, cx | 0, 6 + i * 11);
            }
        }
        /* parallax strips on the horizon */
        var tile = st.skyline ? atlas.skyline : (st.scenery === 'pines' ? atlas.ridge : (st.scenery === 'basin' ? atlas.mesa : atlas.hills));
        var toff = G.bgX * 0.35;
        var tx = -(((-toff) % 64 + 64) % 64);
        for (var x = tx - 64; x < W + 64; x += 64) bctx.drawImage(tile, Math.round(x), hor - tile.height + 1);

        /* road rows: accumulate curve near -> far */
        var xAcc = 0, dxAcc = 0;
        for (var y = H - 1; y > hor; y--) {
            var p = (y - hor) / (H - hor);
            var rel = CAMK / p;
            var z = G.camZ + rel;
            dxAcc += curveAt(G.camZ + Math.min(rel, DRAW)) * 0.0135;
            xAcc += dxAcc;
            xoff[y] = xAcc;
            var far = rel > DRAW * 0.8;
            var rowSt = stageAt(z);
            var center = W / 2 + xAcc - G.playerX * p * ROAD_HALF_PX;
            var half = p * ROAD_HALF_PX;
            bctx.fillStyle = C(rowSt.grass[far ? 0 : band(z, 26)]);
            bctx.fillRect(0, y, W, 1);
            var rw = Math.max(1, half * 0.14);
            bctx.fillStyle = C(rowSt.rumble[far ? 0 : band(z, 9)]);
            bctx.fillRect(Math.round(center - half - rw), y, Math.round(rw), 1);
            bctx.fillRect(Math.round(center + half), y, Math.round(rw), 1);
            bctx.fillStyle = C(rowSt.road[far ? 0 : band(z, 18)]);
            bctx.fillRect(Math.round(center - half), y, Math.round(half * 2), 1);
            if (!far && half > 9 && band(z, 14) === 0) {
                var lw = Math.max(1, Math.round(half * 0.045));
                bctx.fillStyle = C(rowSt.lane);
                bctx.fillRect(Math.round(center - half * 0.335 - lw / 2), y, lw, 1);
                bctx.fillRect(Math.round(center + half * 0.335 - lw / 2), y, lw, 1);
            }
        }
        xoff[hor] = xAcc;

        /* world sprites: scenery + traffic + checkpoint arch, far -> near */
        var list = [];
        var SLOT = 8;
        var s0 = Math.ceil((G.camZ + CAMK + 2) / SLOT), s1 = Math.floor((G.camZ + DRAW) / SLOT);
        for (var s = s0; s <= s1; s++) {
            var z2 = s * SLOT;
            var sSt = stageAt(z2);
            var every = Math.max(2, Math.round(sSt.gap / SLOT));
            if (s % every !== 0) continue;
            if (rand01(s * 2.1) > sSt.density) continue;
            list.push({ rel: z2 - G.camZ, slot: s, st: sSt });
        }
        for (i = 0; i < traffic.length; i++) {
            var rel2 = traffic[i].z - G.camZ;
            if (rel2 > CAMK * 0.75 && rel2 < DRAW) list.push({ rel: rel2, npc: traffic[i] });
        }
        var nextB = Math.ceil((G.camZ + 1) / STAGE_LEN) * STAGE_LEN;
        if (nextB - G.camZ < DRAW) list.push({ rel: nextB - G.camZ, arch: true });
        list.sort(function (a, b) { return b.rel - a.rel; });
        for (i = 0; i < list.length; i++) {
            var it = list[i];
            var pr = project(it.rel, hor);
            if (pr.y <= hor + 1) continue;
            var cxs = W / 2 + pr.xo - G.playerX * pr.p * ROAD_HALF_PX;
            if (it.arch) {
                var aw = pr.p * ROAD_HALF_PX * 2 * 1.3;
                var ah = aw * atlas.arch.height / atlas.arch.width;
                bctx.drawImage(atlas.arch, Math.round(cxs - aw / 2), Math.round(pr.y - ah), Math.max(2, Math.round(aw)), Math.max(1, Math.round(ah)));
            } else if (it.npc) {
                var n = it.npc, ty = NPC_TYPES[n.type];
                var img = atlas.npc[n.type][n.variant];
                var nw = ty.worldW * 2 * ROAD_HALF_PX * pr.p * (img.width / 30) / (img.width / 30);
                nw = ty.worldW * ROAD_HALF_PX * pr.p * 2;
                var nh = nw * img.height / img.width;
                var nx = cxs + n.x * pr.p * ROAD_HALF_PX;
                bctx.drawImage(img, Math.round(nx - nw / 2), Math.round(pr.y - nh), Math.max(1, Math.round(nw)), Math.max(1, Math.round(nh)));
            } else {
                var sc = it.st, sl = it.slot;
                var side = rand01(sl * 1.3) < 0.5 ? -1 : 1;
                var xu = side * (1.55 + rand01(sl * 3.3) * 1.2);
                var kind = rand01(sl * 5.7);
                var img2 = null, ww = 0.9;
                if (sc.scenery === 'pines') { img2 = atlas.pine; ww = 0.85 + rand01(sl * 9.1) * 0.5; }
                else if (sc.scenery === 'highway') {
                    if (kind < 0.5) { img2 = atlas.bills[Math.floor(rand01(sl * 4.3) * atlas.bills.length)]; ww = 1.3; }
                    else if (kind < 0.75) { img2 = curveAt(G.camZ + it.rel) >= 0 ? atlas.signR : atlas.signL; ww = 0.45; xu = side * 1.35; }
                    else { img2 = atlas.pine; ww = 0.8; }
                } else if (sc.scenery === 'city') {
                    if (kind < 0.6) { img2 = atlas.lamp; ww = 0.4; xu = side * 1.3; }
                    else if (kind < 0.85) { img2 = atlas.bills[Math.floor(rand01(sl * 4.3) * atlas.bills.length)]; ww = 1.25; }
                    else { img2 = curveAt(G.camZ + it.rel) >= 0 ? atlas.signR : atlas.signL; ww = 0.45; }
                } else {
                    if (kind < 0.5) { img2 = atlas.pump[(Math.floor(nowSec * 1.6) + sl) % 2]; ww = 1.15; }
                    else if (kind < 0.9) { img2 = atlas.cactus; ww = 0.55; }
                    else { img2 = atlas.bills[Math.floor(rand01(sl * 4.3) * atlas.bills.length)]; ww = 1.3; }
                }
                if (img2) {
                    var sw = ww * ROAD_HALF_PX * pr.p;
                    var sh = sw * img2.height / img2.width;
                    var sxp = cxs + xu * pr.p * ROAD_HALF_PX;
                    bctx.drawImage(img2, Math.round(sxp - sw / 2), Math.round(pr.y - sh), Math.max(1, Math.round(sw)), Math.max(1, Math.round(sh)));
                }
            }
        }

        /* the player's GTI */
        if (showCar && !(G.invulnT > 0 && (frame & 3) < 2)) {
            drawPlayer();
        }
        drawParts();

        /* weather + speed streaks */
        if (st.rain && !reduceFX() && G.state !== 'title') {
            bctx.fillStyle = C(['#9aa8c8', 2]);
            for (i = 0; i < rain.length; i++) {
                var rd = rain[i];
                bctx.fillRect(rd.x | 0, rd.y | 0, 1, rd.l | 0);
            }
        }
        if (speedLines.length) {
            bctx.fillStyle = C(['#f2f2ee', 3]);
            for (i = 0; i < speedLines.length; i++) {
                bctx.fillRect(speedLines[i].x | 0, speedLines[i].y | 0, 1, speedLines[i].len | 0);
            }
        }
    }
    function drawPlayer() {
        var img = atlas.player;
        if (G.spinT <= 0) {
            if (G.steer < -0.4) img = G.playerLean < -0.8 ? atlas.playerL2 : atlas.playerL1;
            else if (G.steer > 0.4) img = G.playerLean > 0.8 ? atlas.playerR2 : atlas.playerR1;
            G.playerLean = (G.playerLean || 0) * 0.8 + G.steer * 0.2 * 1.5;
        }
        var cw = img.width, ch = img.height;
        var px = Math.round(W / 2 - cw / 2);
        var py = Math.round(114 - ch / 2 + (G.bump || 0) + (G.speed > 10 ? (frame % 8 < 4 ? 0 : 1) : 0));
        /* shadow */
        ditherFill(px + 4, py + ch - 3, cw - 8, 3);
        if (G.spinT > 0) {
            bctx.save();
            bctx.translate(W / 2, py + ch / 2);
            bctx.rotate(G.spinA);
            bctx.drawImage(img, -cw / 2, -ch / 2);
            bctx.restore();
            return;
        }
        bctx.drawImage(img, px, py);
        /* brake glow */
        if (G.heldBrake && G.speed > 8) {
            bctx.fillStyle = C(['#ff7a50', 3]);
            bctx.fillRect(px + 5, py + 14, 10, 2);
            bctx.fillRect(px + cw - 15, py + 14, 10, 2);
        }
        /* boost flames */
        if (G.boosting) {
            var fl = (frame % 4 < 2);
            bctx.fillStyle = C(fl ? ['#ffd98a', 3] : ['#ff8a30', 3]);
            bctx.fillRect(px + 7, py + ch - 4, 4, fl ? 5 : 3);
            bctx.fillRect(px + cw - 11, py + ch - 4, 4, fl ? 3 : 5);
            bctx.fillStyle = C(['#f2f2ee', 3]);
            bctx.fillRect(px + 8, py + ch - 4, 2, 2);
            bctx.fillRect(px + cw - 10, py + ch - 4, 2, 2);
        } else if (G.speed > 20 && frame % 9 === 0 && !reduceFX()) {
            spawnPart(px + (Math.random() < 0.5 ? 9 : cw - 9), py + ch - 3, (Math.random() - 0.5) * 8, 14 + Math.random() * 10, 0.5, ['#8a8d96', 2], 1, -30);
        }
    }

    /* ---------------- HUD + overlays ---------------- */
    var WHT = ['#f2f2ee', 3], BLK = ['#0e0e12', 0], REDp = ['#d81e05', 2], DIMp = ['#b9b9ad', 2], AMB = ['#ffd98a', 3];
    function drawHUD() {
        var sc = Math.floor(G.score);
        var scs = ('000000' + sc).slice(-6);
        drawTextOutlined(scs, 4, 4, WHT, BLK, 1);
        if (G.combo > 1) drawTextOutlined('x' + G.combo, 4, 12, AMB, BLK, 1);
        var t = Math.max(0, Math.ceil(G.timeLeft));
        var ts = String(t);
        var flash = G.timeLeft < 5 && (frame & 8);
        drawTextOutlined(ts, W - textW(ts, 2) - 4, 3, flash ? REDp : WHT, BLK, 2);
        /* speed */
        var mph = String(Math.round(G.speed * MPH));
        drawTextOutlined(mph, 4, H - 15, WHT, BLK, 2);
        drawTextOutlined('MPH', 6 + textW(mph, 2), H - 10, DIMp, BLK, 1);
        /* boost bar */
        drawTextOutlined('TURBO', W - 34, H - 18, DIMp, BLK, 1);
        bctx.fillStyle = C(BLK);
        bctx.fillRect(W - 35, H - 11, 31, 6);
        for (var i = 0; i < 3; i++) {
            var fill = Math.max(0, Math.min(1, G.boost - i));
            if (fill > 0) {
                bctx.fillStyle = C((G.boosting && (frame & 2)) ? WHT : REDp);
                bctx.fillRect(W - 34 + i * 10, H - 10, Math.round(9 * fill), 4);
            }
        }
    }
    function drawBanner(dt) {
        if (!G.banner) return;
        G.banner.t -= dt;
        if (G.banner.t <= 0) { G.banner = null; return; }
        var appear = Math.min(1, (2.4 - G.banner.t) * 4);
        var leave = Math.min(1, G.banner.t * 3);
        var yb = Math.round(-24 + appear * 56 - (1 - leave) * 10);
        var wMax = Math.max(textW(G.banner.l1, 1), textW(G.banner.l2, 1)) + 14;
        var xb = Math.round(W / 2 - wMax / 2);
        bctx.fillStyle = C(BLK); bctx.fillRect(xb, yb, wMax, 22);
        bctx.fillStyle = C(REDp); bctx.fillRect(xb, yb, wMax, 2); bctx.fillRect(xb, yb + 20, wMax, 2);
        drawText(G.banner.l1, Math.round(W / 2 - textW(G.banner.l1, 1) / 2), yb + 5, DIMp, 1);
        drawText(G.banner.l2, Math.round(W / 2 - textW(G.banner.l2, 1) / 2), yb + 13, WHT, 1);
    }
    function drawPopups(dt) {
        for (var i = G.popups.length - 1; i >= 0; i--) {
            var p = G.popups[i];
            p.t += dt;
            if (p.t > 1.15) { G.popups.splice(i, 1); continue; }
            if (p.t > 0.85 && (frame & 2)) continue;
            var yp = Math.round(64 - i * 9 - p.t * 12);
            drawTextOutlined(p.text, Math.round(W / 2 - textW(p.text, 1) / 2), yp, p.pair, BLK, 1);
        }
    }
    function drawCountdown() {
        var n = Math.ceil(G.countT - 0.6);
        for (var i = 0; i < 3; i++) {
            var lit = (3 - i) >= n && n > 0;
            bctx.fillStyle = C(BLK);
            bctx.fillRect(62 + i * 14, 56, 10, 10);
            bctx.fillStyle = lit ? C(REDp) : C(['#3a3a40', 1]);
            bctx.fillRect(64 + i * 14, 58, 6, 6);
        }
        if (n > 0) {
            drawTextOutlined(String(n), Math.round(W / 2 - textW(String(n), 3) / 2), 71, WHT, BLK, 3);
        } else if (G.countT > 0) {
            bctx.fillStyle = C(['#3fae4a', 2]);
            bctx.fillRect(64, 58, 6, 6); bctx.fillRect(78, 58, 6, 6); bctx.fillRect(92, 58, 6, 6);
            drawTextOutlined('GO!', Math.round(W / 2 - textW('GO!', 3) / 2), 71, AMB, BLK, 3);
        }
    }
    function drawTitle() {
        ditherFill(0, 0, W, H);
        var hs = loadHS();
        if (hs > 0) drawTextOutlined('HI ' + ('000000' + hs).slice(-6), Math.round(W / 2 - textW('HI 000000', 1) / 2), 4, AMB, BLK, 1);
        /* logo */
        bctx.fillStyle = C(REDp);
        bctx.fillRect(8, 38, 26, 4); bctx.fillRect(126, 38, 26, 4);
        drawTextOutlined('GTI', 38, 18, REDp, BLK, 6);
        drawTextOutlined('RUN', Math.round(W / 2 - textW('RUN', 3) / 2), 52, WHT, BLK, 3);
        drawText('TORNADO RED EDITION', Math.round(W / 2 - textW('TORNADO RED EDITION', 1) / 2), 76, ['#f04a30', 3], 1);
        if (G.titleT % 1.1 < 0.7) {
            drawTextOutlined('PRESS A TO DRIVE', Math.round(W / 2 - textW('PRESS A TO DRIVE', 1) / 2), 96, WHT, BLK, 1);
        }
        drawText('<> STEER A BOOST B BRAKE', Math.round(W / 2 - textW('<> STEER A BOOST B BRAKE', 1) / 2), 114, DIMp, 1);
        drawText('2026 URE SOFT', Math.round(W / 2 - textW('2026 URE SOFT', 1) / 2), 134, DIMp, 1);
    }
    function drawPause() {
        ditherFill(0, 0, W, H);
        var xb = 42, yb = 42, wb = 76, hb = 56;
        bctx.fillStyle = C(BLK); bctx.fillRect(xb, yb, wb, hb);
        bctx.fillStyle = C(REDp); bctx.fillRect(xb, yb, wb, 2); bctx.fillRect(xb, yb + hb - 2, wb, 2);
        drawText('PAUSED', Math.round(W / 2 - textW('PAUSED', 1) / 2), yb + 6, WHT, 1);
        var items = ['RESUME', 'RESTART', 'QUIT'];
        for (var i = 0; i < items.length; i++) {
            var sel = G.pauseSel === i;
            if (sel) drawText('>', xb + 10, yb + 18 + i * 10, REDp, 1);
            drawText(items[i], xb + 18, yb + 18 + i * 10, sel ? WHT : DIMp, 1);
        }
    }
    function drawOver() {
        if (G.overT < 1.0) {
            var bounce = Math.round(Math.abs(Math.sin(G.overT * 9)) * (1 - G.overT) * 8);
            drawTextOutlined('TIME UP', Math.round(W / 2 - textW('TIME UP', 3) / 2), 44 - bounce, REDp, BLK, 3);
            return;
        }
        ditherFill(0, 20, W, 104);
        drawTextOutlined('TIME UP', Math.round(W / 2 - textW('TIME UP', 2) / 2), 28, REDp, BLK, 2);
        var target = Math.floor(G.score);
        if (G.dispScore < target) {
            G.dispScore = Math.min(target, G.dispScore + Math.max(7, (target - G.dispScore) * 0.14));
            if (frame % 4 === 0) SFX.move();
        }
        var line = 'SCORE ' + ('000000' + Math.floor(G.dispScore)).slice(-6);
        drawTextOutlined(line, Math.round(W / 2 - textW(line, 1) / 2), 52, WHT, BLK, 1);
        var hs = loadHS();
        var bl = 'BEST  ' + ('000000' + hs).slice(-6);
        drawTextOutlined(bl, Math.round(W / 2 - textW(bl, 1) / 2), 62, DIMp, BLK, 1);
        var st3 = 'STAGE ' + (G.stageIdx + 1) + '  PASSED ' + G.passCount;
        drawTextOutlined(st3, Math.round(W / 2 - textW(st3, 1) / 2), 72, DIMp, BLK, 1);
        if (G.newRecord && G.dispScore >= target) {
            if (frame % 16 < 10) drawTextOutlined('NEW RECORD!', Math.round(W / 2 - textW('NEW RECORD!', 2) / 2), 86, AMB, BLK, 2);
            if (!reduceFX() && frame % 7 === 0) burstParts(20 + Math.random() * 120, 18, 2, 'confetti');
        }
        if (G.overT > 1.8 && G.overT % 1 < 0.66) {
            drawTextOutlined('A RETRY    B TITLE', Math.round(W / 2 - textW('A RETRY    B TITLE', 1) / 2), 112, WHT, BLK, 1);
        }
    }
    function drawDemoTag() {
        if (frame % 40 < 26) drawTextOutlined('DEMO', Math.round(W / 2 - textW('DEMO', 2) / 2), 8, WHT, BLK, 2);
    }

    /* ---------------- update / render dispatch ---------------- */
    var nowSec = 0;
    function updateRain(dt) {
        var st = stageAt(G.camZ);
        if (!st.rain || reduceFX()) return;
        for (var i = 0; i < rain.length; i++) {
            var r = rain[i];
            r.y += (120 + G.speed * 0.35) * dt;
            r.x -= 26 * dt;
            if (r.y > H) { r.y = -6; r.x = Math.random() * (W + 30); }
            if (r.x < -4) r.x += W + 8;
        }
    }
    function tick(dt) {
        nowSec += dt;
        if (G.state === 'title') {
            G.titleT += dt;
            G.camZ += G.speed * dt;
            G.playerX *= 0.98;
            G.bgX = (G.bgX || 0) - curveAt(G.camZ + PZ) * G.speed * dt * 0.5;
            if (G.titleT > 9 && !reduceFX()) { musicStop(); resetRun(true); }
        } else if (G.state === 'count') {
            G.countT -= dt;
            var n = Math.ceil(G.countT - 0.6);
            if (n !== G.lastCount) { G.lastCount = n; if (n > 0) SFX.countLow(); else { SFX.countGo(); } }
            if (G.countT <= 0) { G.state = 'run'; }
        } else if (G.state === 'run' || G.state === 'demo') {
            if (G.state === 'demo') {
                G.demoT += dt;
                demoSteer(dt);
                if (G.demoT > 14) { toTitle(); return; }
            } else {
                G.timeLeft -= dt;
                if (G.timeLeft <= 0) {
                    G.timeLeft = 0;
                    G.state = 'over'; G.overT = 0; G.dispScore = 0;
                    G.boosting = false;
                    var sc = Math.floor(G.score);
                    var hs = loadHS();
                    if (sc > hs) { G.newRecord = true; saveHS(sc); recTimer = setTimeout(function () { if (mounted) SFX.record(); }, 900); }
                    else SFX.over();
                }
            }
            updatePlayer(dt);
            updateTraffic(dt);
            collide(dt);
            G.bgX = (G.bgX || 0) - curveAt(G.camZ + PZ) * G.speed * dt * 0.5;
        } else if (G.state === 'over') {
            G.overT += dt;
            G.speed = Math.max(0, G.speed - 120 * dt);
            G.camZ += G.speed * dt;
        }
        updateParts(dt);
        updateRain(dt);
    }
    function render(dt) {
        bctx.fillStyle = C(BLK);
        bctx.fillRect(0, 0, W, H);
        var showCar = G.state !== 'title';
        renderScene(showCar);
        if (G.state === 'title') drawTitle();
        else if (G.state === 'count') { drawHUD(); drawCountdown(); drawBanner(dt); }
        else if (G.state === 'run') { drawHUD(); drawBanner(dt); drawPopups(dt); }
        else if (G.state === 'demo') { drawDemoTag(); }
        else if (G.state === 'pause') { drawPause(); }
        else if (G.state === 'over') { drawOver(); }
        /* impact flash */
        if (G.flash > 0) {
            G.flash -= dt;
            if (G.flash > 0.04) { bctx.fillStyle = C(WHT); bctx.fillRect(0, 0, W, H); }
        }
    }

    /* ---------------- input ---------------- */
    var held = {};
    var touchSteer = 0, touchBoost = false, pointers = {};
    function refreshHeld() {
        G.steer = (held.left ? -1 : 0) + (held.right ? 1 : 0) + touchSteer;
        G.steer = Math.max(-1, Math.min(1, G.steer));
        G.heldBoost = !!(held.up || held.a || touchBoost);
        G.heldBrake = !!(held.down || held.b);
    }
    function actionTap(a) {
        if (G.state === 'title') {
            if (a === 'a' || a === 'start' || a === 'up') { musicStop(); SFX.blip(); resetRun(false); }
            return;
        }
        if (G.state === 'demo') { toTitle(); return; }
        if (G.state === 'run' || G.state === 'count') {
            if (a === 'start') { G.pausedFrom = G.state; G.state = 'pause'; G.pauseSel = 0; SFX.blip(); }
            return;
        }
        if (G.state === 'pause') {
            if (a === 'up') { G.pauseSel = (G.pauseSel + 2) % 3; SFX.move(); }
            else if (a === 'down') { G.pauseSel = (G.pauseSel + 1) % 3; SFX.move(); }
            else if (a === 'a') {
                SFX.blip();
                if (G.pauseSel === 0) G.state = G.pausedFrom || 'run';
                else if (G.pauseSel === 1) resetRun(false);
                else if (api && api.quit) api.quit();
            }
            else if (a === 'b' || a === 'start') { G.state = G.pausedFrom || 'run'; }
            return;
        }
        if (G.state === 'over' && G.overT > 1.4) {
            if (a === 'a') { SFX.blip(); resetRun(false); }
            else if (a === 'b' || a === 'start') { toTitle(); }
        }
    }
    function keyToAction(k) {
        if (k === 'ArrowLeft') return 'left';
        if (k === 'ArrowRight') return 'right';
        if (k === 'ArrowUp') return 'up';
        if (k === 'ArrowDown') return 'down';
        if (k === 'Enter' || k === ' ') return 'a';
        if (k === 'Escape') return 'start';
        var lk = k.length === 1 ? k.toLowerCase() : k;
        if (lk === 'a') return 'a';
        if (lk === 'b') return 'b';
        if (lk === 'p') return 'start';
        return null;
    }
    function onKeyDown(e) {
        if (!mounted || document.body.classList.contains('list-mode')) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;    // never hijack browser shortcuts
        var a = keyToAction(e.key);
        if (!a) return;
        /* a focused console control keeps its native Enter/Space activation */
        if (e.key === 'Enter' || e.key === ' ') {
            var tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'BUTTON' || tag === 'A') return;
        }
        e.preventDefault();
        if (!e.repeat && !held[a]) actionTap(a);
        held[a] = true;      // outside the repeat guard so auto-repeat re-latches after clearInputs()
        refreshHeld();
    }
    function onKeyUp(e) {
        if (!mounted) return;
        var a = keyToAction(e.key);
        if (!a) return;
        held[a] = false;
        refreshHeld();
    }
    function bindHoldButton(id, a) {
        var el = document.getElementById(id);
        if (!el) return;
        var down = function (e) { e.preventDefault(); if (!held[a]) actionTap(a); held[a] = true; refreshHeld(); try { el.setPointerCapture(e.pointerId); } catch (er) {} };
        var up = function () { held[a] = false; refreshHeld(); };
        el.addEventListener('pointerdown', down);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        el.addEventListener('lostpointercapture', up);
        boundBtn.push([el, 'pointerdown', down], [el, 'pointerup', up], [el, 'pointercancel', up], [el, 'lostpointercapture', up]);
    }
    function onCanvasDown(e) {
        e.preventDefault();
        if (G.state !== 'run' && G.state !== 'count') { actionTap('a'); return; }
        pointers[e.pointerId] = (e.clientX < disp.getBoundingClientRect().left + disp.clientWidth / 2) ? -1 : 1;
        recalcTouch();
        try { disp.setPointerCapture(e.pointerId); } catch (er) {}
    }
    function onCanvasMove(e) {
        if (pointers[e.pointerId] === undefined) return;
        pointers[e.pointerId] = (e.clientX < disp.getBoundingClientRect().left + disp.clientWidth / 2) ? -1 : 1;
        recalcTouch();
    }
    function onCanvasUp(e) {
        delete pointers[e.pointerId];
        recalcTouch();
    }
    function recalcTouch() {
        var ids = Object.keys(pointers);
        touchSteer = 0;
        for (var i = 0; i < ids.length; i++) touchSteer += pointers[ids[i]];
        touchSteer = Math.max(-1, Math.min(1, touchSteer));
        touchBoost = ids.length >= 2;
        refreshHeld();
    }
    /* drop all held input — a keyup delivered to another window would otherwise stay latched
       and the car would steer/boost by itself after resume */
    function clearInputs() {
        held = {}; pointers = {}; touchSteer = 0; touchBoost = false;
        refreshHeld();
    }
    /* the frame loop normally gates audio; when it stops (hidden tab) or early-returns
       (console hidden behind the list view), silence the continuous sounds directly */
    function silenceAudio() {
        musicStop();
        if (AU.engGain) { try { AU.engGain.gain.value = 0; } catch (e) {} }
    }
    function onBlur() {
        clearInputs();
        if (G.state === 'run' || G.state === 'count') { G.pausedFrom = G.state; G.state = 'pause'; G.pauseSel = 0; }
    }
    function onVis() { if (document.hidden) { onBlur(); silenceAudio(); } }

    /* ---------------- loop / lifecycle ---------------- */
    function frameLoop(ts) {
        if (!mounted) return;
        rafId = requestAnimationFrame(frameLoop);
        var dtReal = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
        lastTs = ts;
        frame++;
        /* live palette-mode switch (URE BOY theme button) */
        var m = api.isDMG() ? 'dmg' : 'color';
        if (m !== mode) { mode = m; buildAtlas(); ditherPat = bctx.createPattern(atlas.ditherPattern, 'repeat'); }
        /* auto-pause when the console is hidden (list view etc.) */
        if (host.offsetParent === null) { onBlur(); silenceAudio(); return; }
        /* music gating */
        if (G.state === 'title' && api.isSound()) musicStart(); else if (G.state !== 'title') musicStop();
        var dt = dtReal;
        if (G.slowmo > 0) { G.slowmo -= dtReal; dt *= 0.35; }
        if (G.state !== 'pause') tick(dt);
        engineUpdate(G.state === 'demo' || G.state === 'title');
        render(dt);
        present(dtReal);
    }
    function present(dtReal) {
        var cw = disp.width, ch = disp.height;
        var s = Math.min(cw / W, ch / H);
        var dw = Math.round(W * s), dh = Math.round(H * s);
        var ox = (cw - dw) >> 1, oy = (ch - dh) >> 1;
        var sx = 0, sy = 0;
        if (G.shake > 0 && !reduceFX()) {
            G.shake -= dtReal;
            sx = Math.round((Math.random() - 0.5) * 2 * Math.min(1, G.shake * 3) * 2 * s);
            sy = Math.round((Math.random() - 0.5) * 2 * Math.min(1, G.shake * 3) * 2 * s);
        }
        dctx.imageSmoothingEnabled = false;
        dctx.fillStyle = '#000';
        dctx.fillRect(0, 0, cw, ch);
        dctx.drawImage(bb, 0, 0, W, H, ox + sx, oy + sy, dw, dh);
    }
    function resize() {
        if (!disp || !host) return;
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var cw = Math.max(32, host.clientWidth), chh = Math.max(32, host.clientHeight);
        disp.width = Math.round(cw * dpr);
        disp.height = Math.round(chh * dpr);
    }

    function mount(hostEl, apiObj) {
        if (mounted) unmount();
        host = hostEl; api = apiObj;
        if (!host) return;
        mounted = true;
        mode = api.isDMG() ? 'dmg' : 'color';
        host.innerHTML = '';
        disp = document.createElement('canvas');
        disp.setAttribute('aria-label', 'GTI RUN. Steer with the arrow keys or the D-pad, A boosts, B brakes.');
        host.appendChild(disp);
        dctx = disp.getContext('2d');
        bb = mkCanvas(W, H);
        bctx = bb.getContext('2d');
        buildAtlas();
        ditherPat = bctx.createPattern(atlas.ditherPattern, 'repeat');
        resize();
        if (window.ResizeObserver) { resizeObs = new ResizeObserver(resize); resizeObs.observe(host); }
        /* input */
        held = {}; pointers = {}; touchSteer = 0; touchBoost = false;
        var wl = [['keydown', onKeyDown], ['keyup', onKeyUp], ['blur', onBlur], ['resize', resize]];
        for (var i = 0; i < wl.length; i++) { window.addEventListener(wl[i][0], wl[i][1]); boundWin.push(wl[i]); }
        document.addEventListener('visibilitychange', onVis);
        boundWin.push(['__vis', onVis]);
        disp.addEventListener('pointerdown', onCanvasDown);
        disp.addEventListener('pointermove', onCanvasMove);
        disp.addEventListener('pointerup', onCanvasUp);
        disp.addEventListener('pointercancel', onCanvasUp);
        boundBtn.push([disp, 'pointerdown', onCanvasDown], [disp, 'pointermove', onCanvasMove],
                      [disp, 'pointerup', onCanvasUp], [disp, 'pointercancel', onCanvasUp]);
        bindHoldButton('dLeft', 'left'); bindHoldButton('dRight', 'right');
        bindHoldButton('dUp', 'up'); bindHoldButton('dDown', 'down');
        bindHoldButton('btnA', 'a'); bindHoldButton('btnB', 'b');
        bindHoldButton('btnStart', 'start');
        G = {}; G.bgX = 0; G.camZ = 0;
        toTitle();
        lastTs = 0;
        rafId = requestAnimationFrame(frameLoop);
    }
    function unmount() {
        if (!mounted) return;
        mounted = false;
        cancelAnimationFrame(rafId);
        clearTimeout(recTimer);
        engineStop(); musicStop();
        for (var i = 0; i < boundWin.length; i++) {
            if (boundWin[i][0] === '__vis') document.removeEventListener('visibilitychange', boundWin[i][1]);
            else window.removeEventListener(boundWin[i][0], boundWin[i][1]);
        }
        boundWin = [];
        for (i = 0; i < boundBtn.length; i++) boundBtn[i][0].removeEventListener(boundBtn[i][1], boundBtn[i][2]);
        boundBtn = [];
        if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
        host = null; disp = null; dctx = null;
    }
    /* engine forwards console button presses here while this cart is live */
    function press(a) { return a !== 'select'; }

    window.GTIRUN = { mount: mount, unmount: unmount, press: press };
})();
