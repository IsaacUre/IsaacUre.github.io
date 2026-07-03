/* ============================================================
   PIT LANE — a URE BOY cartridge   (vanilla, no deps)
   A Formula SAE season manager. You are the brand-new Director
   of Financing of a brand-new team at Rice: one donated frame,
   $250 of club dues, and a competition slot in May.
   True Game Boy resolution (160x144), backbuffer + integer-ish
   nearest-neighbor upscale, honors the console's DMG theme.
   Registers window.PITLANE = { mount(host, api), unmount(), press(a) }.
   ============================================================ */
(function () {
    'use strict';

    var W = 160, H = 144;
    var WEEKS = 28;                       // September -> May
    var AP_PER_WEEK = 2;
    var SAVE_KEY = 'ub_pitlane_save';
    var SAVE_VER = 1;

    /* ---------------- palette ----------------
       [hex, dmgTier]; in Game Boy theme every color collapses to the
       classic 4-shade green by tier (0 darkest .. 3 lightest). */
    var DMG = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
    var mode = 'color';
    function C(pair) { return mode === 'dmg' ? DMG[pair[1]] : pair[0]; }

    var INK = ['#16161c', 0], PAPER = ['#e8e5d4', 3], WHT = ['#f2f2ee', 3];
    var RED = ['#d81e05', 2], REDD = ['#8f1404', 1], AMB = ['#ffd98a', 3];
    var DIM = ['#8b887a', 2], DIMD = ['#5a584e', 1], GRN = ['#3fae4a', 2], BLU = ['#3a6fc4', 2];
    var STEEL = ['#5f6878', 2], STEEL2 = ['#8a93a4', 2];

    /* ---------------- 4x5 bitmap font (shared design with GTI RUN) ---------------- */
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
        '?': 'XXX.|...X|.XX.|....|.X..', '$': '.XXX|XX..|.XX.|..XX|XXX.', '*': '....|X.X.|.X..|X.X.|....',
        '=': '....|XXX.|....|XXX.|....', '"': 'X.X.|X.X.|....|....|....', ' ': '....|....|....|....|....'
    };
    function textW(str, scale) { return str.length * 5 * (scale || 1) - (scale || 1); }
    function drawTextC(ctx, str, x, y, color, scale) {
        scale = scale || 1;
        str = String(str).toUpperCase();     // the 4x5 font is caps-only
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
    function txt(str, x, y, pair, scale) { drawTextC(bctx, str, x, y, C(pair), scale); }
    function txtO(str, x, y, pair, scale) {   // outlined
        scale = scale || 1;
        drawTextC(bctx, str, x + scale, y + scale, C(INK), scale);
        drawTextC(bctx, str, x, y, C(pair), scale);
    }
    function txtC(str, y, pair, scale) { txt(str, Math.round(W / 2 - textW(str, scale) / 2), y, pair, scale); }
    function txtCO(str, y, pair, scale) { txtO(str, Math.round(W / 2 - textW(str, scale || 1) / 2), y, pair, scale); }
    /* word-wrap into lines of maxChars */
    function wrap(s, maxChars) {
        var words = String(s).split(' '), lines = [], cur = '';
        for (var i = 0; i < words.length; i++) {
            var t = cur ? cur + ' ' + words[i] : words[i];
            if (t.length > maxChars) { if (cur) lines.push(cur); cur = words[i]; }
            else cur = t;
        }
        if (cur) lines.push(cur);
        return lines;
    }
    function fmt$(n) {
        n = Math.round(n);
        var neg = n < 0; n = Math.abs(n);
        var s = String(n), out = '';
        while (s.length > 3) { out = ',' + s.slice(-3) + out; s = s.slice(0, -3); }
        return (neg ? '-$' : '$') + s + out;
    }

    /* ---------------- tiny 8x8 icons ---------------- */
    var ICONS = {
        cash:  '........|.XXXXXX.|.X.XX.X.|.XX..XX.|.XX..XX.|.X.XX.X.|.XXXXXX.|........',
        wrench:'.....XX.|....XXXX|....XX..|...XX...|..XX....|.XX.....|XXX.....|XX......',
        person:'..XXX...|..XXX...|...X....|.XXXXX..|X..X..X.|...X....|..X.X...|.X...X..',
        star:  '...X....|...XX...|.XXXXXX.|..XXXX..|..XXXX..|.XX..XX.|........|........',
        cal:   'XXXXXXXX|X.X..X.X|XXXXXXXX|X..X.X.X|XXXXXXXX|X.X..X.X|XXXXXXXX|........',
        flag:  'X.......|XXXXXX..|XX.XX.X.|XXXXXXX.|X.XX.XX.|XXXXXX..|X.......|X.......',
        gear:  '..X..X..|.XXXXXX.|XX.XX.XX|.XX..XX.|.XX..XX.|XX.XX.XX|.XXXXXX.|..X..X..',
        heart: '.XX..XX.|XXXX.XXX|XXXXXXXX|.XXXXXX.|..XXXX..|...XX...|........|........',
        d20:   '...XX...|..XXXX..|.X.XX.X.|XXXXXXXX|.X.XX.X.|..XXXX..|...XX...|........',
        mail:  'XXXXXXXX|XX....XX|X.X..X.X|X..XX..X|X......X|XXXXXXXX|........|........'
    };
    function drawIcon(name, x, y, pair) {
        var art = ICONS[name]; if (!art) return;
        var rows = art.split('|');
        bctx.fillStyle = C(pair || WHT);
        for (var ry = 0; ry < rows.length; ry++)
            for (var rx = 0; rx < 8; rx++)
                if (rows[ry][rx] === 'X') bctx.fillRect(x + rx, y + ry, 1, 1);
    }

    /* ---------------- module state ---------------- */
    var host = null, api = null, mounted = false;
    var bb = null, bctx = null, disp = null, dctx = null;
    var rafId = 0, lastTs = 0, resizeObs = null;
    var boundWin = [], boundBtn = [];
    var frame = 0, nowT = 0;
    var ditherPat = null;
    var presentS = 1, presentOX = 0, presentOY = 0;   // last blit transform, for tap mapping

    /* ---------------- audio (gated by the console SOUND toggle) ---------------- */
    var AU = {
        ctx: null, master: null, musicTimer: 0, musicAt: 0, musicStep: 0, noiseBuf: null,
        get: function () {
            if (!api || !api.isSound()) return null;
            var c = api.audioCtx();
            if (!c) return null;
            if (this.ctx !== c) { this.ctx = c; this.master = null; }
            if (!this.master) {
                this.master = c.createGain();
                this.master.gain.value = 0.15;
                this.master.connect(c.destination);
            }
            if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
            return c;
        },
        noise: function (c) {
            if (!this.noiseBuf) {
                var len = c.sampleRate * 0.3 | 0;
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
            var t0 = when || c.currentTime;
            var o = c.createOscillator(), g = c.createGain();
            o.type = type || 'square';
            o.frequency.setValueAtTime(freq, t0);
            if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
            g.gain.setValueAtTime(gain || 0.18, t0);
            g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
            o.connect(g); g.connect(AU.master);
            o.start(t0); o.stop(t0 + dur + 0.02);
        } catch (e) {}
    }
    function noiseHit(dur, gain, freq) {
        var c = AU.get(); if (!c) return;
        try {
            var s = c.createBufferSource(); s.buffer = AU.noise(c); s.loop = true;
            var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 800; f.Q.value = 1;
            var g = c.createGain();
            g.gain.setValueAtTime(gain || 0.25, c.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
            s.connect(f); f.connect(g); g.connect(AU.master);
            s.start(); s.stop(c.currentTime + dur + 0.02);
        } catch (e) {}
    }
    var SFX = {
        blip: function () { tone(880, 0.05, 'square', 0.12); },
        move: function () { tone(520, 0.03, 'square', 0.08); },
        back: function () { tone(340, 0.05, 'square', 0.1); },
        deny: function () { tone(180, 0.11, 'square', 0.14); },
        cash: function () {
            var c = AU.get(); if (!c) return;
            tone(880, 0.07, 'square', 0.14); tone(1320, 0.12, 'square', 0.14, c.currentTime + 0.07);
        },
        spend: function () { tone(600, 0.06, 'square', 0.1, 0, 300); },
        dice: function () { for (var i = 0; i < 4; i++) noiseHit(0.03, 0.1, 1400 + i * 300); },
        win: function () {
            var c = AU.get(); if (!c) return;
            var n = [660, 880, 1108, 1318];
            for (var i = 0; i < n.length; i++) tone(n[i], 0.09, 'square', 0.14, c.currentTime + i * 0.07);
        },
        lose: function () {
            var c = AU.get(); if (!c) return;
            var n = [520, 415, 330, 262];
            for (var i = 0; i < n.length; i++) tone(n[i], 0.13, 'square', 0.13, c.currentTime + i * 0.11);
        },
        fanfare: function () {
            var c = AU.get(); if (!c) return;
            var n = [523, 523, 523, 659, 784, 659, 784, 1046];
            var d = [0.09, 0.09, 0.09, 0.14, 0.14, 0.09, 0.14, 0.4];
            var t = c.currentTime, at = 0;
            for (var i = 0; i < n.length; i++) { tone(n[i], d[i], 'square', 0.15, t + at); at += d[i] + 0.02; }
        },
        rev: function () { tone(70, 0.3, 'sawtooth', 0.16, 0, 210); },
        crash: function () { noiseHit(0.35, 0.3, 500); tone(110, 0.3, 'sine', 0.25, 0, 45); },
        beat: function () { tone(70, 0.09, 'sine', 0.3); },
        type: function () { tone(1100 + Math.random() * 300, 0.015, 'square', 0.04); }
    };
    /* garage lo-fi loop: mellow triangle bass + sparse pulse lead */
    var BASS_SEQ = [33, 0, 33, 0, 40, 0, 38, 0, 36, 0, 36, 0, 43, 0, 40, 0];
    var LEAD_SEQ = [0, 0, 64, 0, 0, 67, 0, 0, 69, 0, 0, 67, 64, 0, 62, 0,
                    0, 0, 64, 0, 0, 60, 0, 0, 57, 0, 0, 60, 62, 0, 64, 0];
    function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function musicTick() {
        var c = AU.get(); if (!c) return;
        var stepDur = 0.21;
        if (AU.musicAt < c.currentTime) AU.musicAt = c.currentTime + 0.05;
        while (AU.musicAt < c.currentTime + 0.3) {
            var b = BASS_SEQ[AU.musicStep % BASS_SEQ.length];
            var l = LEAD_SEQ[AU.musicStep % LEAD_SEQ.length];
            if (b) tone(midi(b), stepDur * 1.7, 'triangle', 0.13, AU.musicAt);
            if (l) tone(midi(l), stepDur * 0.8, 'square', 0.045, AU.musicAt);
            AU.musicAt += stepDur;
            AU.musicStep++;
        }
    }
    function musicStart() { if (!AU.musicTimer) { AU.musicStep = 0; AU.musicAt = 0; AU.musicTimer = setInterval(musicTick, 100); } }
    function musicStop() { if (AU.musicTimer) { clearInterval(AU.musicTimer); AU.musicTimer = 0; } }
    function silenceAudio() { musicStop(); }

    /* ================================================================
       GAME DATA
       ================================================================ */
    var MONTHS = ['SEP', 'SEP', 'SEP', 'OCT', 'OCT', 'OCT', 'NOV', 'NOV', 'NOV', 'DEC', 'DEC', 'DEC',
                  'JAN', 'JAN', 'JAN', 'FEB', 'FEB', 'FEB', 'MAR', 'MAR', 'MAR', 'MAR', 'APR', 'APR',
                  'APR', 'MAY', 'MAY', 'MAY'];
    function monthOf(w) { return MONTHS[Math.max(0, Math.min(WEEKS - 1, w - 1))]; }

    var SUBS = [
        { id: 'chassis', name: 'CHASSIS',    cost: [0, 300, 800, 1600],  note: 'the donated frame. it has history.' },
        { id: 'power',   name: 'POWERTRAIN', cost: [0, 900, 2200, 4200], note: 'a borrowed CBR600 engine. it runs. mostly.' },
        { id: 'susp',    name: 'SUSPENSION', cost: [0, 500, 1300, 2600], note: 'corners are where races happen.' },
        { id: 'aero',    name: 'AERO',       cost: [0, 250, 900, 2000],  note: 'wings. everyone loves wings.' },
        { id: 'elec',    name: 'ELECTRICAL', cost: [0, 200, 700, 1500],  note: 'the dark art. wiring is 90% of DNFs.' }
    ];
    var TIER_NAMES = ['NONE', 'USED', 'SOLID', 'RACE'];

    /* sponsors: pref is the pitch angle they respond to; hint leaks it.
       perk: shop10 = fab costs -10%, parts10 = part costs -10%, rep = +6 rep,
       recur = pays extra $250 at every milestone after signing. */
    var SPONSORS = [
        { id: 'pizza', name: 'CAMPUS PIZZA', amt: 200,  minRep: 0,  diff: 0,  pref: 'PASSION',
          blurb: 'They feed every club on campus. They just like enthusiasm.', hint: '"just tell us why you love it, man."', perk: 'morale' },
        { id: 'boba',  name: 'BAYOU BOBA',   amt: 350,  minRep: 5,  diff: 5,  pref: 'EXPOSURE',
          blurb: 'New tea shop in the village. Wants to be seen everywhere.', hint: 'they keep asking about instagram followers.', perk: null },
        { id: 'tools', name: 'H-TOWN TOOLS', amt: 500,  minRep: 10, diff: 10, pref: 'NUMBERS',
          blurb: 'Hardware wholesaler off I-45. All business.', hint: 'the owner answers emails with spreadsheets.', perk: 'shop10' },
        { id: 'media', name: 'GOOD EYE MEDIA', amt: 600, minRep: 15, diff: 10, pref: 'EXPOSURE',
          blurb: 'A photo studio that shoots motorsport on weekends.', hint: 'they want their name on something fast and photogenic.', perk: 'rep' },
        { id: 'torn',  name: 'TORNADO AUTO', amt: 800,  minRep: 20, diff: 15, pref: 'PASSION',
          blurb: 'Parts counter run by ex-racers. Red cars get a discount.', hint: 'the counter guy has a GTI. talk cars, not decks.', perk: 'parts10' },
        { id: 'cafe',  name: 'THE COFFEEHOUSE', amt: 400, minRep: 10, diff: 5, pref: 'PASSION',
          blurb: 'Student-run espresso. Fuel of every all-nighter build.', hint: 'they sponsor whoever seems most sleep-deprived.', perk: 'morale' },
        { id: 'bank',  name: 'WOODLANDS BANK', amt: 1500, minRep: 30, diff: 20, pref: 'NUMBERS',
          blurb: 'A suburban bank with a community budget line.', hint: 'bring a balance sheet or do not bother.', perk: null },
        { id: 'deep',  name: 'DEEP BLUE H2O', amt: 3000, minRep: 45, diff: 25, pref: 'NUMBERS',
          blurb: 'Permian water midstream. Serious people, serious money.', hint: 'they measure everything in cost-per-barrel.', perk: 'recur' },
        { id: 'perm',  name: 'PERMIAN ENERGY', amt: 5000, minRep: 60, diff: 30, pref: 'EXPOSURE',
          blurb: 'West Texas money. They want the biggest logo on the car.', hint: 'the question was "how many people will see it?"', perk: null },
        { id: 'ure',   name: 'URE CAPITAL', amt: 8000, minRep: 75, diff: 35, pref: 'NUMBERS',
          blurb: 'A boutique fund nobody can quite place. The card is just an eye.', hint: 'rumor is they only respect a perfect model.', perk: 'recur' }
    ];
    var PREFS = ['NUMBERS', 'PASSION', 'EXPOSURE'];

    var GRANTS = [
        { id: 'stu',  name: 'STUDENT ACTIVITIES', amt: 800,  steps: 2, req: function (S) { return true; },
          reqTxt: 'always open', blurb: 'Forms, signatures, patience.' },
        { id: 'eng',  name: 'ENGINEERING FUND',   amt: 1500, steps: 3, req: function (S) { return S.flags.designDone; },
          reqTxt: 'needs: design review', blurb: 'The dean funds teams that survive design review.' },
        { id: 'alum', name: 'ALUMNI FUND',        amt: 2500, steps: 3, req: function (S) { return S.rep >= 50; },
          reqTxt: 'needs: rep 50', blurb: 'Old owls with deep pockets and long memories.' }
    ];

    /* random events: two choices, each fx = {cash,morale,rep,members,ap,rel,driver,buildHit:subIdx} */
    var EVENTS = [
        { id: 'noStart', t: 'ENGINE WON\'T START', icon: 'gear',
          txt: 'The borrowed CBR600 refuses to fire. The shop goes quiet.',
          a: { l: 'PAY A MECHANIC ($150)', cost: 150, fx: { cash: -150, rel: 4 }, r: 'He finds a pinched fuel line in ten minutes. Money well spent.' },
          b: { l: 'LET THE TEAM TINKER', fx: { morale: -6, rel: 2 }, r: 'Three all-nighters later it fires. Nobody remembers why.' } },
        { id: 'midterms', t: 'MIDTERM WEEK', icon: 'cal',
          txt: 'Half the roster vanishes into Fondren Library.',
          a: { l: 'CLOSE THE SHOP', fx: { morale: 4, ap: -1 }, r: 'Grades saved. A quiet week.' },
          b: { l: 'BUILD ANYWAY', fx: { morale: -8 }, r: 'The three who show up feel like heroes. Tired heroes.' } },
        { id: 'alumCheck', t: 'ENVELOPE IN THE MAIL', icon: 'mail',
          txt: 'An alum from the class of \'02 heard about the team. There is a check inside.',
          a: { l: 'CASH IT ($500)', fx: { cash: 500, rep: 2 }, r: '"Beat A&M," the note says. No pressure.' },
          b: { l: 'CALL TO THANK HIM', fx: { cash: 500, rep: 6, ap: -1 }, r: 'An hour of stories. He knows people. People with money.' } },
        { id: 'viral', t: 'THE REEL WENT VIRAL', icon: 'star',
          txt: 'Someone posted a grinder-sparks slow-mo. 40k views overnight.',
          a: { l: 'RIDE THE WAVE', fx: { rep: 8 }, r: 'Sponsors suddenly answer emails.' },
          b: { l: 'POST A FUNDRAISER LINK', fx: { cash: 220, rep: 3 }, r: 'Strangers on the internet love a scrappy underdog.' } },
        { id: 'theft', t: 'MISSING TOOLBOX', icon: 'wrench',
          txt: 'The good socket set walked off. Nobody saw anything.',
          a: { l: 'REPLACE IT ($120)', cost: 120, fx: { cash: -120 }, r: 'New set. New lock. Lesson learned.' },
          b: { l: 'MAKE DO', fx: { morale: -5 }, r: 'Adjustable wrenches build character, allegedly.' } },
        { id: 'storm', t: 'HURRICANE WATCH', icon: 'flag',
          txt: 'Houston weather. Campus closes the shop for the week.',
          a: { l: 'EVERYONE HOME SAFE', fx: { ap: -1 }, r: 'The frame sits alone in the dark, dreaming of May.' },
          b: { l: 'GRANT-WRITE FROM HOME', fx: { rep: 2 }, r: 'Rain on the windows, spreadsheets on the screen.' } },
        { id: 'prof', t: 'PROFESSOR\'S WAGER', icon: 'cash',
          txt: 'Dr. M will match every dollar you raise this week, up to $400.',
          a: { l: 'HUSTLE ($? MATCH)', fx: { cash: 400, ap: -1, morale: 3 }, r: 'Calls, tables, jars of coins. She pays up with a smile.' },
          b: { l: 'POLITELY DECLINE', fx: { morale: -2 }, r: 'The team hears about it. They wish you hadn\'t.' } },
        { id: 'dropout', t: 'FOUNDER BURNOUT', icon: 'person',
          txt: 'One of the founding four says the club is eating his GPA.',
          a: { l: 'GIVE HIM A BREAK', fx: { members: -1, morale: 5 }, r: 'He leaves the keys and a playlist. The door stays open.' },
          b: { l: 'TALK HIM INTO STAYING', fx: { morale: -6, rep: 1 }, r: 'He stays. He is not happy. The car does not care.' } },
        { id: 'surplus', t: 'SURPLUS AUCTION', icon: 'cash',
          txt: 'The aero lab is auctioning off a wind-tunnel test rig, cheap.',
          a: { l: 'BID $200', cost: 200, fx: { cash: -200, buildBoost: 3 }, r: 'Sold! The aero crew weeps with joy.' },
          b: { l: 'PASS', fx: {}, r: 'Cardboard and box fans it is.' } },
        { id: 'foodtruck', t: 'TAILGATE OFFER', icon: 'cash',
          txt: 'A food truck wants the team to run a game-day booth. Split profits.',
          a: { l: 'WORK THE BOOTH', fx: { cash: 260, morale: 4, ap: -1 }, r: 'Smells like brisket and victory.' },
          b: { l: 'FOCUS ON THE CAR', fx: {}, r: 'The car appreciates your loyalty. Probably.' } },
        { id: 'weld', t: 'BAD WELD FOUND', icon: 'gear',
          txt: 'A crack in a chassis node. It has to be fixed before anything else moves.',
          a: { l: 'CERTIFIED WELDER ($180)', cost: 180, fx: { cash: -180, rel: 3 }, r: 'Clean bead. Sleep restored.' },
          b: { l: 'DIY RE-WELD', fx: { rel: -3, morale: 2 }, r: 'It holds. You think. You hope.' } },
        { id: 'rivals', t: 'SCOUTING REPORT', icon: 'flag',
          txt: 'A&M posted their build photos. Their budget has a comma in it. Two, actually.',
          a: { l: 'STUDY THEIR CAR', fx: { rep: 2, driver: 1 }, r: 'Good artists copy. Broke artists copy harder.' },
          b: { l: 'IGNORE THEM', fx: { morale: 3 }, r: '"We race our own race." The team nods.' } },
        { id: 'podcast', t: 'CAMPUS PODCAST', icon: 'star',
          txt: 'The engineering podcast wants the money person, not the car people.',
          a: { l: 'DO THE INTERVIEW', fx: { rep: 6, ap: -1 }, r: 'You explain cost reports like war stories. It lands.' },
          b: { l: 'SEND A BUILD LEAD', fx: { rep: 2, morale: 3 }, r: 'He talks camber for forty minutes. Niche, but charming.' } },
        { id: 'pizza', t: 'COLD PIZZA ECONOMY', icon: 'heart',
          txt: 'Morale is running on fumes and day-old slices.',
          a: { l: 'PROPER TEAM DINNER ($60)', cost: 60, fx: { cash: -60, morale: 10 }, r: 'Fajitas. Laughter. Someone names the car "PENNY".' },
          b: { l: 'INSPIRING SPEECH', fx: { morale: 3 }, r: 'You quote a racing movie. It half-works.' } },
        { id: 'inspection', t: 'SAFETY OFFICER VISIT', icon: 'flag',
          txt: 'Campus safety wants updated extinguishers and eyewash, this week.',
          a: { l: 'COMPLY ($90)', cost: 90, fx: { cash: -90, rep: 2 }, r: 'Green tags all around. The shop stays open.' },
          b: { l: 'STALL FOR TIME', fx: { ap: -1, morale: -3 }, r: 'A week of paperwork purgatory. The shop reopens anyway.' } },
        { id: 'transfer', t: 'TRANSFER STUDENT', icon: 'person',
          txt: 'A transfer from a top FSAE school shows up asking if you need help.',
          a: { l: 'WELCOME ABOARD', fx: { members: 1, rel: 3, driver: 1 }, r: 'She reorganizes the whole wiring loom in a weekend.' },
          b: { l: '"TRYOUTS" (HAZE GENTLY)', fx: { members: 1, morale: 4 }, r: 'She passes the vibe check. The vibe check was pizza.' } },
        { id: 'sim', t: 'SIM RIG NIGHT', icon: 'star',
          txt: 'Someone brings a sim rig to the shop. Productivity is in danger.',
          a: { l: 'DRIVER TRAINING, OBVIOUSLY', fx: { driver: 2, morale: 5, ap: -1 }, r: 'Lap after lap. Your driver stops crashing. Mostly.' },
          b: { l: 'BACK TO WORK', fx: { morale: -3, buildBoost: 2 }, r: 'The rig goes home. The car gets two more brackets.' } },
        { id: 'invoice', t: 'SURPRISE INVOICE', icon: 'mail',
          txt: 'The steel order from October was never actually paid. Oops.',
          a: { l: 'PAY IT ($130)', cost: 130, fx: { cash: -130 }, r: 'The supplier keeps taking your calls. Worth it.' },
          b: { l: 'NEGOTIATE ($65)', cost: 65, fx: { cash: -65, rep: -2 }, r: 'Half now, half "later". They remember this.' } },
        { id: 'photoday', t: 'GOLDEN HOUR', icon: 'star',
          txt: 'The light outside the shop is perfect. Someone has a real camera.',
          a: { l: 'TEAM PHOTOSHOOT', fx: { rep: 4, morale: 4, ap: -1 }, r: 'The frame has never looked so heroic. Sponsors notice.' },
          b: { l: 'KEEP WRENCHING', fx: { buildBoost: 1 }, r: 'The light fades. The car grows.' } },
        { id: 'donor', t: 'MYSTERY BOX', icon: 'gear',
          txt: 'A local shop donates a crate: "race takeoffs, some good."',
          a: { l: 'DIG IN', fx: { buildBoost: 2, morale: 3 }, r: 'Two usable dampers and a fire suit that fits nobody.' },
          b: { l: 'SELL WHAT YOU CAN', fx: { cash: 180 }, r: 'One team\'s junk is another team\'s $180.' } },
        { id: 'quiz', t: 'RULES QUIZ NIGHT', icon: 'cal',
          txt: 'FSAE rules are 140 pages. Someone suggests a quiz night with prizes.',
          a: { l: 'HOST IT ($30)', cost: 30, fx: { cash: -30, rel: 3, morale: 4 }, r: 'Turns out three "legal" brackets were not. Fixed now.' },
          b: { l: 'SKIM THE PDF LATER', fx: {}, r: 'Page 61 will be a surprise for everyone.' } },
        { id: 'coldsnap', t: 'COLD SNAP', icon: 'flag',
          txt: 'Texas grid does Texas things. The shop has no heat this week.',
          a: { l: 'SPACE HEATERS ($45)', cost: 45, fx: { cash: -45, morale: 2 }, r: 'Cozy enough to keep the epoxy curing.' },
          b: { l: 'GLOVES AND GRIT', fx: { morale: -5, buildBoost: 1 }, r: 'Cold hands, warm hearts, questionable bond lines.' } }
    ];

    /* rival field for the finale */
    var RIVAL_NAMES = ['TEXAS A&M', 'UT AUSTIN', 'MICHIGAN', 'CAL POLY', 'GEORGIA TECH', 'PURDUE',
        'KANSAS', 'AUBURN', 'RUTGERS', 'OLE MISS', 'UT ARLINGTON', 'OKLAHOMA ST', 'BAYLOR',
        'LSU', 'TULANE', 'SMU', 'TCU', 'HOUSTON', 'TX STATE', 'NEW MEXICO', 'ARKANSAS',
        'MISSOURI S&T', 'ILLINOIS', 'OHIO STATE', 'RPI', 'WISCONSIN', 'IOWA ST', 'CLEMSON', 'UTSA'];

    var ROSTER_FIRST = ['J.', 'PRIYA', 'MARCO', 'SAM', 'WEI', 'DANA', 'LUIS', 'KAT', 'OMAR', 'TESSA',
        'RAVI', 'JUNE', 'COLE', 'MAYA', 'NICO', 'ABBY'];
    var ROSTER_ROLE = ['FOUNDER', 'AERO', 'POWERTRAIN', 'CHASSIS', 'WIRING', 'SUSPENSION', 'COST',
        'DRIVER', 'MACHINIST', 'CAD', 'SOCIAL', 'SAFETY', 'TIRES', 'DATA', 'PIT CREW', 'BRAKES'];

    /* milestones by week */
    var MILESTONES = {
        3:  { id: 'fair',   t: 'CLUB FAIR' },
        8:  { id: 'alumni', t: 'ALUMNI NIGHT' },
        12: { id: 'design', t: 'DESIGN REVIEW' },
        14: { id: 'entry',  t: 'ENTRY FEE DUE' },
        18: { id: 'shake',  t: 'SHAKEDOWN' },
        24: { id: 'travel', t: 'TRAVEL LOCK-IN' },
        28: { id: 'comp',   t: 'COMPETITION' }
    };
    var ENTRY_FEE = 1800, TRAVEL_COST = 1200;

    /* ---------------- season state ---------------- */
    var S = null;          // season save-state (plain JSON data only)
    function newSeason(veteran) {
        var subs = {};
        for (var i = 0; i < SUBS.length; i++) subs[SUBS[i].id] = { tier: 0, build: SUBS[i].id === 'chassis' ? 15 : 0 };
        var roster = [];
        for (i = 0; i < 4; i++) roster.push(ROSTER_FIRST[i] + ' - ' + ROSTER_ROLE[i]);
        return {
            ver: SAVE_VER,
            week: 1, ap: AP_PER_WEEK,
            cash: 250, rep: veteran ? 15 : 0, morale: 70,
            members: 4, roster: roster,
            driver: 0, rel: 20,
            subs: subs,
            sponsors: {},              // id -> {signed:week} or {cooldown:week}
            grants: {},                // id -> {step, done}
            ledger: [{ w: 1, t: 'CLUB DUES', v: 250 }],
            raisedTotal: 250, spentTotal: 0,
            flags: { entryPaid: false, travelPaid: false, designDone: false, shakeDone: false,
                     veteran: !!veteran, pitchesWon: 0, fundraisers: 0, tested: 0, eggDone: false },
            eventBag: [],              // shuffled indices into EVENTS
            log: []
        };
    }
    function ledger(label, v) {
        S.cash += v;
        if (v > 0) S.raisedTotal = (S.raisedTotal || 0) + v;
        else S.spentTotal = (S.spentTotal || 0) - v;
        S.ledger.push({ w: S.week, t: label, v: v });
        if (S.ledger.length > 60) S.ledger.shift();     // display cap; totals keep running
        if (v > 0) SFX.cash(); else if (v < 0) SFX.spend();
    }
    function clampStats() {
        S.morale = Math.max(0, Math.min(100, S.morale));
        S.rep = Math.max(0, Math.min(100, S.rep));
        S.rel = Math.max(0, Math.min(100, S.rel));
        S.driver = Math.max(0, Math.min(100, S.driver));
        S.members = Math.max(1, Math.min(16, S.members));
    }
    function subQuality(id) {
        var s = S.subs[id];
        return (s.tier / 3) * 0.55 + (s.build / 100) * 0.45;
    }
    function carQuality() {
        var q = 0;
        for (var i = 0; i < SUBS.length; i++) q += subQuality(SUBS[i].id);
        return q / SUBS.length;
    }
    function carDrivable() {
        if (S.subs.power.tier < 1) return false;
        for (var i = 0; i < SUBS.length; i++) if (S.subs[SUBS[i].id].build < 55) return false;
        return true;
    }
    function partDiscount() { return S.sponsors.torn && S.sponsors.torn.signed ? 0.9 : 1; }
    function shopDiscount() { return S.sponsors.tools && S.sponsors.tools.signed ? 0.9 : 1; }

    /* ---------------- save / load ---------------- */
    function saveGame() {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
    }
    function loadGame() {
        try {
            var raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return null;
            var d = JSON.parse(raw);
            if (!d || d.ver !== SAVE_VER || !d.subs) return null;
            return d;
        } catch (e) { return null; }
    }
    function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
    function hasVeteran() { try { return localStorage.getItem('ub_pitlane_vet') === '1'; } catch (e) { return false; } }
    function setVeteran() { try { localStorage.setItem('ub_pitlane_vet', '1'); } catch (e) {} }

    /* ================================================================
       SYSTEMS — script runner, week loop, actions, pitching, the comp
       ================================================================ */
    var scr = 'title';           // title | intro | home | actions | car | sponsors | team | ledger | calendar | comp
    var cur = {};                // per-screen cursor indices
    var modal = null;            // {kind:'event'|'confirm'|'pitch'|'detail'..., ...}
    var script = null;           // running cutscene {steps, i, chars, onDone, anim}
    var toastQ = [];             // in-game toasts [{t, time}]
    var shake = 0, flashT = 0;

    function gtoast(t) { toastQ.push({ t: t, time: 2.2 }); if (toastQ.length > 2) toastQ.shift(); }

    /* ---------------- script runner (cutscenes, milestones, comp) ---------------- */
    function playScript(steps, onDone) {
        script = { steps: steps, i: 0, chars: 0, onDone: onDone || null, anim: null, t: 0 };
        enterStep();
    }
    function curStep() { return script && script.steps[script.i]; }
    function enterStep() {
        var st = curStep();
        if (!st) { return endScript(); }
        script.chars = 0; script.t = 0; script.anim = null;
        if (st.do) { st.do(); script.i++; return enterStep(); }
        if (st.anim) { script.anim = ANIMS[st.anim](st); }
    }
    function scriptNext() {
        if (!script) return;
        script.i++;
        if (script.i >= script.steps.length) endScript();
        else enterStep();
    }
    function endScript() {
        var cb = script && script.onDone;
        script = null;
        if (cb) cb();
    }
    function scriptTap() {          // A pressed while a script runs
        var st = curStep(); if (!st) return;
        if (st.anim) { if (script.anim && script.anim.skip) script.anim.skip(); return; }
        var full = (st.say || '').length;
        if (script.chars < full) { script.chars = full; return; }   // reveal all first
        if (st.ask) return;         // choices need explicit selection
        SFX.blip();
        scriptNext();
    }

    /* fx applier for events / milestones / pitches */
    function applyFx(fx, label) {
        if (!fx) return;
        if (fx.cash) ledger(label || 'EVENT', fx.cash);
        if (fx.morale) S.morale += fx.morale;
        if (fx.rep) S.rep += fx.rep;
        if (fx.members) {
            var want = Math.max(1, Math.min(16, S.members + fx.members));
            while (S.members < want) { S.members++; addRosterName(); }
            while (S.members > want) { S.members--; S.roster.pop(); }
        }
        if (fx.ap) S.ap = Math.max(0, S.ap + fx.ap);
        if (fx.rel) S.rel += fx.rel;
        if (fx.driver) S.driver += fx.driver;
        if (fx.buildBoost) {        // help the least-built subsystem
            var low = SUBS[0].id;
            for (i = 1; i < SUBS.length; i++) if (S.subs[SUBS[i].id].build < S.subs[low].build) low = SUBS[i].id;
            S.subs[low].build = Math.min(buildCap(low), S.subs[low].build + fx.buildBoost * 4);
        }
        clampStats();
    }
    function addRosterName() {
        var i = S.roster.length % ROSTER_FIRST.length;
        S.roster.push(ROSTER_FIRST[i] + ' - ' + ROSTER_ROLE[i]);
    }
    function buildCap(id) { return S.subs[id].tier > 0 ? 100 : (id === 'chassis' ? 50 : 35); }

    /* ---------------- week loop ---------------- */
    function endWeek() {
        if (S.week >= WEEKS) return;      // comp handles the last week
        S.week++;
        S.ap = AP_PER_WEEK;
        S.morale -= 1;
        if (S.morale < 22 && Math.random() < 0.12 && S.members > 2) {
            S.members--; S.roster.pop();
            gtoast('A MEMBER QUIETLY QUIT.');
        }
        clampStats();
        var ms = MILESTONES[S.week];
        if (ms) payRetainers();
        if (ms && ms.id === 'comp') {
            S.pendingMilestone = 'comp';
            saveGame();
            startComp();
            return;
        }
        if (ms) {
            S.pendingMilestone = ms.id;
            saveGame();
            runMilestone(ms.id);
        } else if (Math.random() < 0.5) {
            if (!S.eventBag || !S.eventBag.length) {
                S.eventBag = [];
                for (var i = 0; i < EVENTS.length; i++) S.eventBag.push(i);
                for (i = S.eventBag.length - 1; i > 0; i--) {
                    var j = Math.floor(Math.random() * (i + 1));
                    var tmp = S.eventBag[i]; S.eventBag[i] = S.eventBag[j]; S.eventBag[j] = tmp;
                }
            }
            S.pendingEvent = S.eventBag.pop();
            saveGame();
            openEvent(S.pendingEvent);
        } else {
            saveGame();
        }
        scr = 'home';
    }
    function openEvent(idx) {
        var ev = EVENTS[idx];
        if (!ev) { S.pendingEvent = undefined; return; }
        modal = { kind: 'event', ev: ev, sel: 0 };
    }
    function resolveEvent(choice) {
        var ev = modal.ev;
        var c = choice === 0 ? ev.a : ev.b;
        if (c.cost && S.cash < c.cost) { SFX.deny(); return; }
        applyFx(c.fx, ev.t);
        modal = { kind: 'note', title: ev.t, text: c.r, icon: ev.icon };
        S.pendingEvent = undefined;
        saveGame();
    }

    /* ---------------- actions ---------------- */
    function spendAP(n) {
        if (S.ap < n) { SFX.deny(); gtoast('NO ACTION POINTS LEFT. END THE WEEK.'); return false; }
        S.ap -= n;
        return true;
    }
    function actFundraiser(kind) {
        if (!spendAP(1)) return;
        var got = 0, extra = '';
        if (kind === 0) { got = 60 + Math.round(Math.random() * 120); S.morale += 2; extra = 'CAR WASH'; }
        if (kind === 1) { got = 40 + Math.round(Math.random() * 80); S.morale += 3; extra = 'BAKE SALE'; }
        if (kind === 2) {
            if (S.cash < 50) { S.ap++; SFX.deny(); gtoast('RAFFLE NEEDS $50 SEED.'); return; }
            ledger('RAFFLE SEED', -50);
            got = 100 + Math.round(Math.random() * 260); S.rep += 1; extra = 'RAFFLE';
        }
        ledger(extra, got);
        S.flags.fundraisers++;
        clampStats();
        modal = { kind: 'note', title: extra, text: 'The team raised ' + fmt$(got) + '. Every bracket counts.', icon: 'cash' };
        saveGame();
    }
    function actGrant(gi) {
        var g = GRANTS[gi];
        var st = S.grants[g.id] || (S.grants[g.id] = { step: 0, done: false });
        if (st.done) { SFX.deny(); return; }
        if (!g.req(S)) { SFX.deny(); gtoast('LOCKED: ' + g.reqTxt.toUpperCase()); return; }
        if (!spendAP(1)) return;
        st.step++;
        if (st.step >= g.steps) {
            st.done = true;
            ledger(g.name, g.amt);
            modal = { kind: 'note', title: g.name, text: 'Application approved! ' + fmt$(g.amt) + ' hits the account. Paperwork: undefeated.', icon: 'cash' };
        } else {
            modal = { kind: 'note', title: g.name, text: 'Forms filed (' + st.step + '/' + g.steps + '). The committee "will be in touch."', icon: 'mail' };
        }
        saveGame();
    }
    function actShop(subIdx) {
        var sub = SUBS[subIdx], st = S.subs[sub.id];
        var cap = buildCap(sub.id);
        if (st.build >= cap) { SFX.deny(); gtoast(st.tier > 0 ? 'ALREADY FULLY BUILT.' : 'NEEDS PARTS TO GO FURTHER.'); return; }
        if (!spendAP(1)) return;
        var hours = S.members * (2 + 4 * S.morale / 100);
        var cost = Math.round(hours * 1.6 * shopDiscount());
        if (cost > S.cash) { hours = Math.max(2, S.cash / (1.6 * shopDiscount())); cost = Math.round(S.cash); }
        if (cost > 0) ledger('MATERIALS - ' + sub.name, -cost);
        var gain = Math.round(hours * (0.85 + Math.random() * 0.4));
        st.build = Math.min(cap, st.build + gain);
        S.rel += 1;
        clampStats();
        modal = { kind: 'note', title: sub.name + ' +' + gain + '%',
            text: S.members + ' members, ' + Math.round(hours) + ' shop hours. ' + (st.build >= cap && st.tier === 0 ? 'That\'s as far as it goes without real parts.' : 'The car is a little more real tonight.'), icon: 'wrench' };
        saveGame();
    }
    function buyTier(subIdx) {
        var sub = SUBS[subIdx], st = S.subs[sub.id];
        if (st.tier >= 3) { SFX.deny(); return; }
        var cost = Math.round(sub.cost[st.tier + 1] * partDiscount());
        if (S.cash < cost) { SFX.deny(); gtoast('NEED ' + fmt$(cost) + '.'); return; }
        ledger(sub.name + ' T' + (st.tier + 1), -cost);
        st.tier++;
        SFX.win();
        gtoast(sub.name + ' PARTS: ' + TIER_NAMES[st.tier]);
        saveGame();
    }
    function actRecruit() {
        if (!spendAP(1)) return;
        if (S.cash >= 20) ledger('FLYERS', -20);
        var got = 1 + (Math.random() < (S.rep + S.morale) / 220 ? 1 : 0);
        if (S.members + got > 16) got = Math.max(0, 16 - S.members);
        S.members += got;
        for (var i = 0; i < got; i++) addRosterName();
        S.morale += 2;
        clampStats();
        modal = { kind: 'note', title: 'RECRUITING', text: got > 0 ? got + ' new member' + (got > 1 ? 's' : '') + ' signed the roster. Fresh hands for the build.' : 'The shop is at capacity. Sixteen souls, one car.', icon: 'person' };
        saveGame();
    }
    function actTeamNight() {
        if (S.cash < 40) { SFX.deny(); gtoast('NEED $40.'); return; }
        if (!spendAP(1)) return;
        ledger('TEAM NIGHT', -40);
        S.morale += 12;
        clampStats();
        modal = { kind: 'note', title: 'TEAM NIGHT', text: 'Tacos, lore, and a heated debate about wing endplates. Morale is up.', icon: 'heart' };
        saveGame();
    }
    function actTestDay() {
        if (!carDrivable()) { SFX.deny(); gtoast('CAR IS NOT DRIVABLE YET.'); return; }
        if (S.cash < 120) { SFX.deny(); gtoast('NEED $120 FOR FUEL + TIRES.'); return; }
        if (!spendAP(1)) return;
        ledger('TEST DAY', -120);
        var d = 4 + Math.round(Math.random() * 3), r = 5 + Math.round(Math.random() * 3);
        S.driver += d; S.rel += r;
        S.flags.tested++;
        clampStats();
        if (Math.random() < 0.25) {
            var v = SUBS[1 + Math.floor(Math.random() * (SUBS.length - 1))];
            S.subs[v.id].build = Math.max(10, S.subs[v.id].build - 8);
            S.morale -= 3;
            clampStats();
            modal = { kind: 'note', title: 'TEST DAY', text: 'Driver +' + d + ', reliability +' + r + '... and the ' + v.name.toLowerCase() + ' let go on the last run. Back on the stands.', icon: 'gear' };
        } else {
            modal = { kind: 'note', title: 'TEST DAY', text: 'Parking-lot autocross. Driver +' + d + ', reliability +' + r + '. The car came home on its own wheels.', icon: 'flag' };
        }
        saveGame();
    }

    /* ---------------- sponsor pitching ---------------- */
    function sponsorState(sp) {
        var rec = S.sponsors[sp.id];
        if (rec && rec.signed) return 'SIGNED';
        if (rec && rec.cooldown && rec.cooldown > S.week) return 'COLD ' + (rec.cooldown - S.week) + 'W';
        if (S.rep < sp.minRep) return 'REP ' + sp.minRep;
        return 'READY';
    }
    function startPitch(sp) {
        if (sponsorState(sp) !== 'READY') { SFX.deny(); return; }
        if (!spendAP(1)) return;
        modal = { kind: 'pitch', sp: sp, round: 0, matches: 0, sel: 0, phase: 'talk', rollT: 0, rollVal: 0, need: 0 };
        saveGame();
    }
    function pitchChoose(angle) {
        var m = modal, sp = m.sp;
        if (PREFS[angle] === sp.pref) { m.matches++; SFX.blip(); } else SFX.move();
        m.round++;
        if (m.round >= 3) {
            var chance = 35 + S.rep * 0.25 - sp.diff + m.matches * 18 + (m.round - m.matches) * 4;
            chance = Math.max(10, Math.min(95, chance));
            m.need = Math.max(2, Math.min(20, 21 - Math.round(chance / 5)));
            m.phase = 'roll';
            m.rollT = 1.2;
            SFX.dice();
        }
    }
    function pitchResolve() {
        var m = modal, sp = m.sp;
        var v = m.rollVal;
        if (v >= m.need) {
            var amt = sp.amt;
            if (v === 20) amt = Math.round(amt * 1.25 / 25) * 25;
            S.sponsors[sp.id] = { signed: S.week };
            ledger(sp.name, amt);
            S.rep += (v === 20 ? 5 : 3);
            S.flags.pitchesWon++;
            if (sp.perk === 'morale') S.morale += 8;
            if (sp.perk === 'rep') S.rep += 6;
            clampStats();
            m.phase = 'won';
            m.wonAmt = amt;
            SFX.fanfare();
        } else {
            S.sponsors[sp.id] = { cooldown: S.week + 4 };
            S.rep = Math.max(0, S.rep - 1);
            if (v === 1) { S.morale -= 3; clampStats(); }
            m.phase = 'lost';
            SFX.lose();
        }
        saveGame();
    }

    /* ---------------- milestones ---------------- */
    function payRetainers() {
        /* recurring sponsor perks pay out at each milestone */
        var paid = 0;
        for (var i = 0; i < SPONSORS.length; i++) {
            var sp = SPONSORS[i];
            if (sp.perk === 'recur' && S.sponsors[sp.id] && S.sponsors[sp.id].signed) paid += 250;
        }
        if (paid) { ledger('SPONSOR RETAINERS', paid); gtoast('RETAINERS: +' + fmt$(paid)); }
    }
    function finishMilestone() {
        S.pendingMilestone = undefined;
        saveGame();
    }
    function runMilestone(id) {
        var steps = [];
        /* placed right after each milestone's effect step: once the stat changes have been
           applied, mark the milestone resolved so quitting mid-epilogue can't re-apply them */
        var msDone = { do: function () { S.pendingMilestone = undefined; saveGame(); } };
        if (id === 'fair') {
            var gain = 2 + Math.round(S.rep / 30 + S.morale / 45);
            steps = [
                { say: 'CLUB FAIR - The quad smells like free pizza and ambition. Rice Racing has a folding table and a dream.', art: 'banner', t: 'CLUB FAIR' },
                { ask: 'What goes on the table?', choices: [
                    { t: 'THE BARE FRAME ITSELF', fx: { rep: 4 }, r: 'Hauling a race car frame across the quad turns every head on campus.' },
                    { t: 'A SIGN: "FREE PIZZA LATER"', fx: { members: 1, morale: 3 }, r: 'It is technically true. Eventually. The line forms fast.' }
                ] },
                { do: function () {
                    var actual = Math.max(0, Math.min(gain, 16 - S.members));
                    S.members += actual;
                    for (var i = 0; i < actual; i++) addRosterName();
                    clampStats();
                    S.pendingMilestone = undefined; saveGame();
                    script.steps.splice(script.i + 1, 0, { say: actual > 0
                        ? actual + ' freshmen sign the roster on the spot. The team is real now. Roster: ' + S.members + ' members.'
                        : 'The table draws a crowd, but the roster is already full. Sixteen is the legal limit of chaos.', art: 'black' });
                } }
            ];
        } else if (id === 'alumni') {
            steps = [
                { say: 'ALUMNI NIGHT - Engineering school mixer. Name tags, cheese cubes, and forty years of Rice engineers in one room.', art: 'banner', t: 'ALUMNI NIGHT' },
                { ask: 'You get one good hour. Spend it:', choices: [
                    { t: 'WORK THE ROOM', fx: { rep: 8 }, r: 'Handshakes and elevator pitches. Three business cards say "call me in the spring."' },
                    { t: 'PASS THE HAT', fx: {}, r: '', then: function () {
                        var got = 35 * S.members + Math.round(Math.random() * 150);
                        ledger('ALUMNI HAT', got);
                        return 'Old owls dig deep for a new team: ' + fmt$(got) + '.';
                    } },
                    { t: 'TALK ABOUT THE CAR', fx: {}, r: '', then: function () {
                        if (carQuality() > 0.2) { S.rep += 12; clampStats(); return 'You describe the build in detail. An alum who raced in \'88 tears up. Rep soars.'; }
                        S.rep += 2; clampStats(); return 'You describe... a frame. On stands. "It has potential," someone offers, kindly.';
                    } }
                ] },
                msDone
            ];
        } else if (id === 'design') {
            var dq = carQuality();
            var repGain = Math.round(dq * 30) + 3;
            steps = [
                { say: 'DESIGN REVIEW - Two professors and a guest engineer from an F1 supplier want to see everything.', art: 'banner', t: 'DESIGN REVIEW' },
                { do: function () { S.flags.designDone = true; S.rep += repGain; S.morale += dq > 0.3 ? 5 : (dq < 0.15 ? -5 : 0); clampStats(); } },
                msDone,
                { say: dq > 0.45 ? 'They are impressed. "Year one? Really?" Rep +' + repGain + '. The Engineering Fund is now open to you.'
                     : dq > 0.2 ? 'Fair questions, fair answers. "Keep going." Rep +' + repGain + '. The Engineering Fund is now open to you.'
                     : 'It is a long hour. "Ambitious," they write, which is professor for "oh no." Rep +' + repGain + '. Still - the Engineering Fund opens.' }
            ];
        } else if (id === 'entry') {
            if (S.cash >= ENTRY_FEE) {
                steps = [
                    { say: 'ENTRY FEE DUE - FSAE registration closes tonight. ' + fmt$(ENTRY_FEE) + ', non-refundable, no exceptions.', art: 'banner', t: 'ENTRY FEE' },
                    { do: function () { ledger('FSAE ENTRY FEE', -ENTRY_FEE); S.flags.entryPaid = true; S.morale += 6; clampStats(); } },
                    msDone,
                    { say: 'Payment confirmed. Rice Racing is officially on the entry list for May. It is in writing. It is happening.' }
                ];
            } else {
                steps = [
                    { say: 'ENTRY FEE DUE - ' + fmt$(ENTRY_FEE) + ' by midnight. The account holds ' + fmt$(S.cash) + '. This is the nightmare scenario.', art: 'banner', t: 'ENTRY FEE' },
                    { say: 'You knock on the department chair\'s door at 9 PM with a budget printout and zero shame.' },
                    { do: function () { S.flags.entryPaid = true; S.flags.loan = 2000; S.rep = Math.max(0, S.rep - 8); } },
                    msDone,
                    { say: 'The department floats the fee - as a LOAN. $2,000 due back by travel week. Rep takes a bruise. The team does not need to know tonight.' }
                ];
            }
        } else if (id === 'shake') {
            if (carDrivable()) {
                var broke = Math.random() < 0.3;
                steps = [
                    { say: 'SHAKEDOWN DAY - An empty parking lot, a borrowed helmet, and the first time PENNY moves under her own power.', art: 'banner', t: 'SHAKEDOWN' },
                    { anim: 'shakedown', broke: broke },
                    { do: function () {
                        if (broke) { S.driver += 3; S.rel += 4; S.subs.power.build = Math.max(20, S.subs.power.build - 10); S.morale += 2; }
                        else { S.driver += 6; S.rel += 10; S.morale += 10; S.rep += 5; }
                        S.flags.shakeDone = true; clampStats();
                    } },
                    msDone,
                    { say: broke ? 'Three glorious laps, then a bang and a coast to a stop. Data was gathered. Lessons were learned. Something in the powertrain was sacrificed.'
                                 : 'She runs. SHE RUNS. The whole team chases the car down the lot screaming. Reliability +10, and everyone believes now.' }
                ];
            } else {
                steps = [
                    { say: 'SHAKEDOWN DAY - The lot is booked. The helmet is borrowed. The car... is still on stands.', art: 'banner', t: 'SHAKEDOWN' },
                    { do: function () { S.morale -= 8; S.rep = Math.max(0, S.rep - 3); clampStats(); } },
                    msDone,
                    { say: 'The team eats cold pizza around a car that does not run yet. Nobody says much. May is coming either way.' }
                ];
            }
        } else if (id === 'travel') {
            var owed = TRAVEL_COST + (S.flags.loan || 0);
            if (S.cash >= owed) {
                steps = [
                    { say: 'TRAVEL LOCK-IN - Trailer rental, fuel, a motel with questionable reviews. ' + fmt$(TRAVEL_COST) + ' total' + (S.flags.loan ? ', plus the ' + fmt$(S.flags.loan) + ' loan comes due.' : '.'), art: 'banner', t: 'TRAVEL WEEK' },
                    { do: function () {
                        ledger('TRAVEL + TRAILER', -TRAVEL_COST);
                        if (S.flags.loan) { ledger('LOAN REPAID', -S.flags.loan); S.flags.loan = 0; }
                        S.flags.travelPaid = true; S.morale += 8; clampStats();
                    } },
                    msDone,
                    { say: 'Booked. Paid. Real. In four weeks a Rice-built race car rolls into competition. Finish the build.' }
                ];
            } else {
                steps = [
                    { say: 'TRAVEL LOCK-IN - You need ' + fmt$(owed) + '. You have ' + fmt$(S.cash) + '. You run the numbers four times. They do not change.', art: 'banner', t: 'TRAVEL WEEK' },
                    { do: function () { S.flags.noTravel = true; S.morale -= 15; clampStats(); } },
                    msDone,
                    { say: 'There is no version of this where the trailer gets rented. The team will watch competition on a livestream. The car deserved better. So did you.' }
                ];
            }
        }
        playScript(steps, function () { finishMilestone(); });
    }

    /* ---------------- competition ---------------- */
    var comp = null;      // finale working state
    function compQuality() {
        var qs = [], sum = 0;
        for (var i = 0; i < SUBS.length; i++) { var q = subQuality(SUBS[i].id); qs.push(q); sum += q; }
        var avg = sum / qs.length;
        var varsum = 0;
        for (i = 0; i < qs.length; i++) varsum += (qs[i] - avg) * (qs[i] - avg);
        var balance = Math.max(0, 1 - Math.sqrt(varsum / qs.length) * 2.2);
        return { avg: avg, balance: balance };
    }
    function buildComp() {
        var q = compQuality();
        var spent = S.spentTotal || 0;
        var i;
        var design = Math.round((q.avg * 0.75 + q.balance * 0.25) * 150);
        var cost = Math.round(100 * Math.max(0.05, Math.min(1, 0.4 + q.avg * 0.55 - spent / 22000)));
        var biz = Math.round(75 * Math.max(0.08, Math.min(1, S.rep / 100 * 0.8 + S.flags.pitchesWon * 0.035)));
        var pq = subQuality('power'), sq = subQuality('susp'), aq = subQuality('aero'), d = S.driver / 100;
        var runs = carDrivable();       // a car that can't drive scores nothing in dynamics
        var accel = runs ? Math.round(100 * Math.max(0.05, Math.min(1, pq * 0.68 + d * 0.32))) : 0;
        var skid = runs ? Math.round(75 * Math.max(0.05, Math.min(1, sq * 0.62 + d * 0.38))) : 0;
        var auto = runs ? Math.round(125 * Math.max(0.05, Math.min(1, q.avg * 0.5 + d * 0.32 + aq * 0.18))) : 0;
        /* endurance simulated lap by lap */
        var laps = [], dnf = 0, lapRisk = Math.max(0.015, Math.min(0.22, (62 - S.rel) / 100 * 0.3 + (0.5 - q.avg) * 0.08));
        for (i = 1; i <= 10; i++) {
            if (Math.random() < lapRisk) { dnf = i; break; }
            laps.push(i);
        }
        var endu = !runs ? 0
                 : dnf ? Math.round(275 * 0.25 * (dnf - 1) / 10)
                       : Math.round(275 * Math.max(0.1, Math.min(1, q.avg * 0.52 + d * 0.26 + S.rel / 100 * 0.22)));
        var techPass = S.rel >= 30;
        var techPenalty = techPass ? 0 : 25;
        var total = design + cost + biz + accel + skid + auto + endu - techPenalty;
        /* the field */
        var field = [];
        for (i = 0; i < RIVAL_NAMES.length; i++) {
            var str = 0.3 + Math.random() * 0.62;
            field.push({ name: RIVAL_NAMES[i], pts: Math.round(1000 * str * (0.9 + Math.random() * 0.15)) });
        }
        field.push({ name: 'RICE RACING', pts: total, us: true });
        field.sort(function (a, b) { return b.pts - a.pts; });
        var place = 1;
        for (i = 0; i < field.length; i++) if (field[i].us) { place = i + 1; break; }
        return { design: design, cost: cost, biz: biz, accel: accel, skid: skid, auto: auto,
                 endu: endu, dnfLap: dnf, techPass: techPass, total: total, field: field,
                 place: place, q: q, spent: spent, accelT: (5.4 - (pq * 0.68 + d * 0.32) * 1.9).toFixed(2) };
    }

    /* ================================================================
       RENDERING — UI framework, garage scene, screens, modals
       ================================================================ */
    var HITS = [];
    function addHit(x, y, w, h, cb) { HITS.push({ x: x, y: y, w: w, h: h, cb: cb }); }
    function panel(x, y, w, h, plain) {
        bctx.fillStyle = C(INK);
        bctx.fillRect(x, y, w, h);
        if (!plain) {
            bctx.fillStyle = C(RED);
            bctx.fillRect(x, y, w, 2);
            bctx.fillRect(x, y + h - 2, w, 2);
        }
    }
    function bar(x, y, w, h, frac, pair) {
        bctx.fillStyle = C(INK);
        bctx.fillRect(x, y, w, h);
        bctx.fillStyle = C(pair);
        bctx.fillRect(x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, frac))), h - 2);
    }
    function ditherFill(x, y, w, h) {
        if (!ditherPat) return;
        bctx.fillStyle = ditherPat;
        bctx.fillRect(x, y, w, h);
    }
    function tierPips(x, y, tier) {
        for (var i = 0; i < 3; i++) {
            bctx.fillStyle = i < tier ? C(RED) : C(DIMD);
            bctx.fillRect(x + i * 4, y, 3, 4);
        }
    }

    /* ---------------- garage scene ---------------- */
    function drawCarSide(x, y, big) {
        /* the car assembles visually as the season progresses; origin = rear-left ground */
        var ch = S.subs.chassis, pw = S.subs.power, sp = S.subs.susp, ae = S.subs.aero;
        var done = carDrivable();
        var frameC = ch.tier > 0 ? C(STEEL2) : C(STEEL);
        var wheels = sp.tier > 0;
        /* jack stands until it has wheels */
        if (!wheels) {
            bctx.fillStyle = C(DIMD);
            bctx.fillRect(x + 8, y - 4, 3, 4); bctx.fillRect(x + 6, y - 1, 7, 1);
            bctx.fillRect(x + 40, y - 4, 3, 4); bctx.fillRect(x + 38, y - 1, 7, 1);
        }
        var lift = wheels ? 0 : -3;
        var gy = y - 8 + lift;             // frame beltline
        /* main frame rails */
        if (ch.build > 0) {
            bctx.fillStyle = frameC;
            bctx.fillRect(x + 4, gy, 44, 2);                       // top rail
            bctx.fillRect(x + 2, gy + 4, 50, 2);                   // bottom rail
            bctx.fillRect(x + 4, gy, 2, 6); bctx.fillRect(x + 46, gy, 2, 6);
            bctx.fillRect(x + 20, gy - 6, 2, 8);                   // main hoop
            bctx.fillRect(x + 20, gy - 6, 8, 2);
            bctx.fillRect(x + 30, gy - 3, 2, 5);                   // front hoop
        }
        /* engine block */
        if (pw.tier > 0) {
            bctx.fillStyle = C(['#5a4a3a', 1]);
            bctx.fillRect(x + 8, gy - 3, 9, 7);
            bctx.fillStyle = C(AMB);
            bctx.fillRect(x + 9, gy - 2, 2, 2);
            if (done) { bctx.fillStyle = C(DIM); bctx.fillRect(x + 2, gy + 2, 5, 2); } // exhaust
        }
        /* body panels once drivable: Tornado Red, obviously */
        if (done) {
            bctx.fillStyle = C(RED);
            bctx.fillRect(x + 28, gy - 1, 22, 5);                  // nose
            bctx.fillRect(x + 48, gy + 1, 4, 3);
            bctx.fillRect(x + 6, gy - 1, 12, 3);                   // sidepod
        } else if (ch.build >= 70) {
            bctx.fillStyle = C(REDD);
            bctx.fillRect(x + 30, gy, 18, 4);                      // primered nose
        }
        /* wings */
        if (ae.tier > 0) {
            bctx.fillStyle = C(INK);
            bctx.fillRect(x, gy - 8, 10, 2); bctx.fillRect(x + 4, gy - 6, 2, 6);   // rear wing
            if (ae.tier > 1) bctx.fillRect(x + 46, gy + 3, 10, 2);                 // front wing
        }
        /* wheels */
        if (wheels) {
            bctx.fillStyle = C(INK);
            bctx.fillRect(x + 8, y - 6, 6, 6); bctx.fillRect(x + 38, y - 6, 6, 6);
            bctx.fillStyle = C(DIM);
            bctx.fillRect(x + 10, y - 4, 2, 2); bctx.fillRect(x + 40, y - 4, 2, 2);
        }
        /* driver helmet at speed */
        if (big && big.driver) {
            bctx.fillStyle = C(WHT);
            bctx.fillRect(x + 23, gy - 5, 4, 4);
        }
    }
    function drawPerson(x, y, f, working) {
        bctx.fillStyle = C(['#c9a179', 3]);
        bctx.fillRect(x + 1, y, 3, 3);                              // head
        bctx.fillStyle = C(['#3a5a8f', 1]);
        bctx.fillRect(x, y + 3, 5, 4);                              // body
        bctx.fillStyle = C(INK);
        bctx.fillRect(x, y + 7, 2, 3); bctx.fillRect(x + 3, y + 7, 2, 3);
        if (working) {                                              // wrench arm bobbing
            bctx.fillStyle = C(DIM);
            bctx.fillRect(x + 5, y + (f ? 2 : 4), 3, 1);
        }
    }
    function drawGarage(y0) {
        /* back wall */
        bctx.fillStyle = C(['#2a2a30', 1]);
        bctx.fillRect(0, y0, W, 62);
        /* floor */
        bctx.fillStyle = C(['#4a4a52', 2]);
        bctx.fillRect(0, y0 + 62, W, 14);
        bctx.fillStyle = C(DIMD);
        for (var fx2 = 0; fx2 < W; fx2 += 16) bctx.fillRect(fx2, y0 + 62, 1, 14);
        /* roll-up door, left */
        bctx.fillStyle = C(['#3a3f48', 1]);
        bctx.fillRect(4, y0 + 4, 30, 58);
        bctx.fillStyle = C(DIMD);
        for (var dy = 0; dy < 56; dy += 6) bctx.fillRect(5, y0 + 6 + dy, 28, 1);
        /* sponsor banners on the wall */
        var bx = 40;
        for (var i = 0; i < SPONSORS.length && bx < 118; i++) {
            var sp = SPONSORS[i];
            if (S.sponsors[sp.id] && S.sponsors[sp.id].signed) {
                bctx.fillStyle = C(PAPER);
                bctx.fillRect(bx, y0 + 6, 18, 9);
                drawTextC(bctx, sp.name.slice(0, 2), bx + 4, y0 + 8, C(REDD), 1);
                bx += 22;
            }
        }
        if (bx === 40) { txt('(SPONSOR WALL)', 42, y0 + 8, DIMD, 1); }
        /* workbench, right */
        bctx.fillStyle = C(['#5a4632', 1]);
        bctx.fillRect(126, y0 + 46, 30, 3);
        bctx.fillRect(128, y0 + 49, 3, 13); bctx.fillRect(151, y0 + 49, 3, 13);
        bctx.fillStyle = C(RED);
        bctx.fillRect(132, y0 + 40, 10, 6);                          // toolbox
        /* the car */
        drawCarSide(44, y0 + 62);
        /* crew: up to 6 shown */
        var n = Math.min(6, S.members);
        var spots = [[28, 40], [104, 42], [64, 46], [16, 48], [118, 50], [84, 40]];
        for (i = 0; i < n; i++) {
            drawPerson(spots[i][0], y0 + spots[i][1], (frame >> 4 + i) & 1, i < 3);
        }
        /* the eye-brand poster */
        bctx.fillStyle = C(PAPER);
        bctx.fillRect(140, y0 + 8, 14, 12);
        bctx.fillStyle = C(INK);
        bctx.fillRect(143, y0 + 12, 8, 3);
        bctx.fillRect(145, y0 + 11, 4, 5);
    }

    /* ---------------- chrome: top bar, tabs, hints, toasts ---------------- */
    var TABS = [
        { id: 'home', t: 'HOME' }, { id: 'actions', t: 'ACT' }, { id: 'car', t: 'CAR' },
        { id: 'sponsors', t: 'SPN' }, { id: 'team', t: 'TEM' }, { id: 'ledger', t: 'LOG' }, { id: 'calendar', t: 'CAL' }
    ];
    function tabIdx() { for (var i = 0; i < TABS.length; i++) if (TABS[i].id === scr) return i; return 0; }
    function drawChrome() {
        panel(0, 0, W, 15, true);
        txt('WK' + S.week + ' ' + monthOf(S.week), 3, 2, DIM, 1);
        txt(fmt$(S.cash), 3, 9, S.cash < 200 ? RED : AMB, 1);
        var rp = 'REP ' + S.rep;
        txt(rp, W - textW(rp, 1) - 3, 9, WHT, 1);
        txt('AP', W - 26, 2, DIM, 1);
        for (var i = 0; i < AP_PER_WEEK; i++) {
            bctx.fillStyle = i < S.ap ? C(GRN) : C(DIMD);
            bctx.fillRect(W - 13 + i * 5, 2, 4, 5);
        }
        /* tab strip */
        var x = 2;
        for (i = 0; i < TABS.length; i++) {
            var t = TABS[i], w = textW(t.t, 1) + 5;
            var on = scr === t.id;
            if (on) { bctx.fillStyle = C(RED); bctx.fillRect(x - 1, 16, w, 9); }
            txt(t.t, x + 1, 18, on ? WHT : DIM, 1);
            (function (id) { addHit(x - 1, 15, w + 1, 11, function () { switchTab(id); }); })(t.id);
            x += w + 2;
        }
        bctx.fillStyle = C(DIMD);
        bctx.fillRect(0, 26, W, 1);
    }
    function hint(t) {
        bctx.fillStyle = C(INK);
        bctx.fillRect(0, H - 8, W, 8);
        txt(t, 3, H - 7, DIM, 1);
    }
    function drawToasts(dt) {
        for (var i = toastQ.length - 1; i >= 0; i--) {
            var t = toastQ[i];
            t.time -= dt;
            if (t.time <= 0) { toastQ.splice(i, 1); continue; }
            var w = textW(t.t, 1) + 8;
            var x = Math.round(W / 2 - w / 2), y = 30 + i * 12;
            bctx.fillStyle = C(INK); bctx.fillRect(x, y, w, 10);
            bctx.fillStyle = C(RED); bctx.fillRect(x, y, w, 1);
            txt(t.t, x + 4, y + 2, WHT, 1);
        }
    }
    function switchTab(id) {
        if (modal || script) return;
        scr = id; SFX.move();
    }

    /* ---------------- generic cursor list ---------------- */
    function drawList(items, x, y, rowH, selIdx, maxRows, scrollKey) {
        var first = 0;
        if (items.length > maxRows) {
            first = Math.max(0, Math.min(selIdx - (maxRows >> 1), items.length - maxRows));
        }
        for (var r = 0; r < Math.min(maxRows, items.length); r++) {
            var i = first + r, it = items[i];
            var yy = y + r * rowH;
            var on = i === selIdx;
            if (on) { bctx.fillStyle = C(REDD); bctx.fillRect(x - 2, yy - 1, W - x * 2 + 4, rowH - 1); }
            if (on) txt('>', x, yy, AMB, 1);
            it.draw(x + 6, yy, on);
            (function (idx) { addHit(0, yy - 1, W, rowH, function () { cur[scrollKey] = idx; listActivate(); }); })(i);
        }
        if (first > 0) txt('^', W - 8, y, DIM, 1);
        if (first + maxRows < items.length) txt('*', W - 8, y + (maxRows - 1) * rowH, DIM, 1);
    }
    var listItems = [];    // rebuilt every frame by the active screen
    function listActivate() {
        if (modal || script) return;      // a modal or cutscene owns input
        var it = listItems[cur[scr] || 0];
        if (it && it.go) { it.go(); }
    }

    /* ---------------- screens ---------------- */
    function drawHome() {
        drawGarage(27);
        var next = null, nw = 0;
        for (var w2 = S.week + 1; w2 <= WEEKS; w2++) if (MILESTONES[w2]) { next = MILESTONES[w2]; nw = w2; break; }
        if (next) txtO('NEXT: ' + next.t + ' WK' + nw + ' (' + (nw - S.week) + 'W)', 3, 95, AMB, 1);
        var y = 105;
        txt('MORALE', 3, y, DIM, 1); bar(34, y, 44, 6, S.morale / 100, S.morale > 45 ? GRN : RED);
        txt('REL', 84, y, DIM, 1); bar(102, y, 44, 6, S.rel / 100, BLU);
        y += 9;
        txt('CREW ' + S.members, 3, y, DIM, 1);
        txt('DRIVER ' + S.driver, 48, y, DIM, 1);
        txt(carDrivable() ? 'CAR RUNS!' : 'ON STANDS', 104, y, carDrivable() ? GRN : DIM, 1);
        listItems = [
            { draw: function (x, yy) { txt('END WEEK ' + S.week + (S.ap > 0 ? ' (' + S.ap + ' AP UNSPENT)' : ''), x, yy, WHT, 1); },
              go: function () {
                  if (S.ap > 0) modal = { kind: 'confirm', text: S.ap + ' AP unspent. End the week anyway?', yes: function () { endWeek(); }, sel: 1 };
                  else endWeek();
              } }
        ];
        drawList(listItems, 6, y + 10, 9, cur.home || 0, 1, 'home');
        hint('<> TABS  A SELECT  START MENU');
    }

    function drawActions() {
        txtC('ACTIONS - ' + S.ap + ' AP LEFT', 30, AMB, 1);
        listItems = [
            mkAct('PITCH A SPONSOR', '1AP', function () { switchTab('sponsors'); }),
            mkAct('GRANT PAPERWORK', '1AP', function () { openGrants(); }),
            mkAct('RUN A FUNDRAISER', '1AP', function () { openFundraisers(); }),
            mkAct('SHOP WORK', '1AP', function () { openShopWork(); }),
            mkAct('RECRUIT DRIVE', '1AP $20', function () { actRecruit(); }),
            mkAct('TEAM NIGHT', '1AP $40', function () { actTeamNight(); }),
            mkAct('TEST DAY', '1AP $120', function () { actTestDay(); }),
            mkAct('END WEEK', '', function () { switchTab('home'); cur.home = 0; } )
        ];
        drawList(listItems, 8, 42, 11, cur.actions || 0, 8, 'actions');
        hint('A SELECT  B BACK  <> TABS');
    }
    function mkAct(t, cost, go) {
        return { draw: function (x, y, on) {
            txt(t, x, y, on ? WHT : PAPER, 1);
            if (cost) txt(cost, W - textW(cost, 1) - 8, y, DIM, 1);
        }, go: go };
    }
    function openGrants() {
        var items = [];
        for (var i = 0; i < GRANTS.length; i++) {
            (function (gi) {
                var g = GRANTS[gi];
                var st = S.grants[g.id];
                var status = st && st.done ? 'PAID' : (st ? st.step + '/' + g.steps : (g.req(S) ? 'OPEN' : 'LOCKED'));
                items.push({ t: g.name, info: fmt$(g.amt) + ' - ' + status, sub: st && st.done ? '' : g.reqTxt,
                    dis: (st && st.done) || !g.req(S),
                    cb: function () { actGrant(gi); } });
            })(i);
        }
        modal = { kind: 'submenu', title: 'GRANTS (1AP EACH)', items: items, sel: 0 };
    }
    function openFundraisers() {
        modal = { kind: 'submenu', title: 'FUNDRAISER (1AP)', sel: 0, items: [
            { t: 'CAR WASH', info: '$60-180 +MORALE', cb: function () { actFundraiser(0); } },
            { t: 'BAKE SALE', info: '$40-120 +MORALE', cb: function () { actFundraiser(1); } },
            { t: 'RAFFLE', info: 'SEED $50, $100-360', cb: function () { actFundraiser(2); } }
        ] };
    }
    function openShopWork() {
        var items = [];
        for (var i = 0; i < SUBS.length; i++) {
            (function (si) {
                var sub = SUBS[si], st = S.subs[sub.id];
                items.push({ t: sub.name, info: 'BUILD ' + st.build + '% ' + TIER_NAMES[st.tier],
                    dis: st.build >= buildCap(sub.id),
                    cb: function () { actShop(si); } });
            })(i);
        }
        modal = { kind: 'submenu', title: 'SHOP WORK (1AP)', items: items, sel: 0 };
    }

    function drawCarScr() {
        txtC('THE CAR - "PENNY"', 30, AMB, 1);
        listItems = [];
        for (var i = 0; i < SUBS.length; i++) {
            (function (si) {
                var sub = SUBS[si];
                listItems.push({
                    draw: function (x, y, on) {
                        var st = S.subs[sub.id];
                        txt(sub.name, x, y, on ? WHT : PAPER, 1);
                        tierPips(x + 58, y, st.tier);
                        bar(x + 74, y, 40, 6, st.build / 100, st.build >= 100 ? GRN : BLU);
                        txt(st.build + '%', x + 118, y, DIM, 1);
                    },
                    go: function () { openSubDetail(si); }
                });
            })(i);
        }
        drawList(listItems, 6, 42, 11, cur.car || 0, 5, 'car');
        var y = 100;
        txt('QUALITY', 3, y, DIM, 1); bar(40, y, 50, 6, carQuality(), RED);
        txt(Math.round(carQuality() * 100) + '%', 94, y, DIM, 1);
        txt(carDrivable() ? 'STATUS: DRIVABLE' : 'STATUS: NOT DRIVABLE', 3, y + 9, carDrivable() ? GRN : RED, 1);
        txt('REL ' + S.rel + '  DRIVER ' + S.driver + '  TESTS ' + S.flags.tested, 3, y + 18, DIM, 1);
        hint('A DETAIL  B BACK  <> TABS');
    }
    function openSubDetail(si) {
        var sub = SUBS[si], st = S.subs[sub.id];
        var items = [];
        if (st.tier < 3) {
            var cost = Math.round(sub.cost[st.tier + 1] * partDiscount());
            items.push({ t: 'BUY ' + TIER_NAMES[st.tier + 1] + ' PARTS', info: fmt$(cost) + (partDiscount() < 1 ? ' (-10%)' : ''),
                dis: S.cash < cost, cb: function () { buyTier(si); modal = null; } });
        }
        items.push({ t: 'SHOP WORK HERE', info: '1AP', dis: st.build >= buildCap(sub.id), cb: function () { actShop(si); } });
        modal = { kind: 'submenu', title: sub.name, note: sub.note, items: items, sel: 0 };
    }

    function drawSponsors() {
        txtC('SPONSORS - PITCH COSTS 1AP', 30, AMB, 1);
        listItems = [];
        for (var i = 0; i < SPONSORS.length; i++) {
            (function (sp) {
                listItems.push({
                    draw: function (x, y, on) {
                        var stt = sponsorState(sp);
                        var pair = stt === 'SIGNED' ? GRN : (stt === 'READY' ? WHT : DIMD);
                        txt(sp.name, x, y, on ? WHT : pair, 1);
                        txt(fmt$(sp.amt), x + 82, y, stt === 'SIGNED' ? GRN : DIM, 1);
                        txt(stt, W - textW(stt, 1) - 8, y, pair, 1);
                    },
                    go: function () { openSponsorDetail(sp); }
                });
            })(SPONSORS[i]);
        }
        drawList(listItems, 6, 40, 10, cur.sponsors || 0, 9, 'sponsors');
        hint('A DETAIL  B BACK  <> TABS');
    }
    function openSponsorDetail(sp) {
        var stt = sponsorState(sp);
        var perkTxt = { shop10: 'PERK: SHOP COSTS -10%', parts10: 'PERK: PARTS -10%', rep: 'PERK: +6 REP ON SIGNING',
                        morale: 'PERK: TEAM MORALE BOOST', recur: 'PERK: $250 EVERY MILESTONE' }[sp.perk] || '';
        var items = [];
        if (stt === 'READY') items.push({ t: 'MAKE THE PITCH', info: '1AP', cb: function () { startPitch(sp); } });
        items.push({ t: 'BACK', info: '', cb: function () { modal = null; } });
        modal = { kind: 'submenu', title: sp.name + ' - ' + fmt$(sp.amt), items: items, sel: 0,
                  note: sp.blurb + ' HINT: ' + sp.hint + (perkTxt ? ' ' + perkTxt : '') };
    }

    function drawTeam() {
        txtC('THE TEAM', 30, AMB, 1);
        txt('MEMBERS ' + S.members + '/16', 6, 40, PAPER, 1);
        txt('MORALE', 76, 40, DIM, 1); bar(110, 40, 40, 6, S.morale / 100, S.morale > 45 ? GRN : RED);
        listItems = [
            mkAct('RECRUIT DRIVE', '1AP $20', function () { actRecruit(); }),
            mkAct('TEAM NIGHT', '1AP $40', function () { actTeamNight(); })
        ];
        drawList(listItems, 6, 50, 10, cur.team || 0, 2, 'team');
        bctx.fillStyle = C(DIMD); bctx.fillRect(4, 71, W - 8, 1);
        var maxRows = 7;
        for (var i = 0; i < Math.min(maxRows, S.roster.length); i++) {
            txt(S.roster[i], 8, 75 + i * 8, i < 4 ? PAPER : DIM, 1);
        }
        if (S.roster.length > maxRows) txt('+' + (S.roster.length - maxRows) + ' MORE', 8, 75 + maxRows * 8, DIMD, 1);
        hint('A SELECT  B BACK  <> TABS');
    }

    function drawLedger() {
        txtC('LEDGER', 30, AMB, 1);
        var raised = S.raisedTotal || 0, spent = S.spentTotal || 0;
        var rows = S.ledger.slice(-9).reverse();
        var i;
        for (i = 0; i < rows.length; i++) {
            var r = rows[i], y = 40 + i * 8;
            txt('W' + r.w, 4, y, DIMD, 1);
            txt(r.t.slice(0, 16), 24, y, PAPER, 1);
            var vs = (r.v > 0 ? '+' : '') + fmt$(r.v).replace('$-', '-$');
            txt(vs, W - textW(vs, 1) - 4, y, r.v > 0 ? GRN : RED, 1);
        }
        bctx.fillStyle = C(DIMD); bctx.fillRect(4, 113, W - 8, 1);
        txt('RAISED ' + fmt$(raised), 4, 117, GRN, 1);
        txt('SPENT ' + fmt$(spent), 84, 117, RED, 1);
        txt('CASH ' + fmt$(S.cash), 4, 126, AMB, 1);
        txt('BURN ' + fmt$(Math.round(spent / Math.max(1, S.week))) + '/WK', 84, 126, DIM, 1);
        hint('THE DIRECTOR SEES ALL  <> TABS');
    }

    function drawCalendar() {
        txtC('SEASON CALENDAR', 30, AMB, 1);
        var ws = [3, 8, 12, 14, 18, 24, 28];
        for (var i = 0; i < ws.length; i++) {
            var w2 = ws[i], ms = MILESTONES[w2], y = 42 + i * 10;
            var stt = w2 < S.week ? 'DONE' : (w2 === S.week ? 'NOW!' : monthOf(w2));
            var pair = w2 < S.week ? DIMD : (w2 === S.week ? RED : PAPER);
            txt('W' + (w2 < 10 ? '0' : '') + w2, 6, y, pair, 1);
            txt(ms.t, 30, y, pair, 1);
            txt(stt, W - textW(stt, 1) - 6, y, w2 <= S.week ? pair : DIM, 1);
        }
        txt('ENTRY FEE ' + fmt$(ENTRY_FEE) + (S.flags.entryPaid ? ' PAID' : ' DUE W14'), 6, 116, S.flags.entryPaid ? GRN : AMB, 1);
        txt('TRAVEL ' + fmt$(TRAVEL_COST) + (S.flags.travelPaid ? ' PAID' : ' DUE W24'), 6, 125, S.flags.travelPaid ? GRN : AMB, 1);
        if (S.flags.loan) txt('DEPT LOAN ' + fmt$(S.flags.loan) + ' DUE W24', 6, 134, RED, 1);
        hint((WEEKS - S.week) + ' WEEKS TO COMPETITION');
    }

    /* ---------------- modals ---------------- */
    function drawModal(dt) {
        /* modals own the pointer: swallow any tap that misses their own controls,
           so nothing falls through to the screen hits registered underneath */
        addHit(0, 0, W, H, function () {});
        ditherFill(0, 0, W, H);
        var m = modal;
        if (m.kind === 'note') {
            panel(14, 34, W - 28, 70);
            if (m.icon) drawIcon(m.icon, W / 2 - 4, 40, AMB);
            txtC(m.title, 52, WHT, 1);
            var lines = wrap(m.text, 24);
            for (var i = 0; i < Math.min(5, lines.length); i++) txtC(lines[i], 63 + i * 7, PAPER, 1);
            if (frame % 40 < 26) txtC('A OK', 96, DIM, 1);
            addHit(0, 0, W, H, function () { modal = null; SFX.blip(); });
        } else if (m.kind === 'confirm') {
            panel(20, 46, W - 40, 48);
            var lines2 = wrap(m.text, 22);
            for (i = 0; i < lines2.length && i < 3; i++) txtC(lines2[i], 52 + i * 7, PAPER, 1);
            var opts = ['YES', 'NO'];
            for (i = 0; i < 2; i++) {
                var on = m.sel === i;
                var x = 52 + i * 40;
                if (on) txt('>', x - 7, 80, AMB, 1);
                txt(opts[i], x, 80, on ? WHT : DIM, 1);
                (function (idx) { addHit(x - 10, 76, 36, 12, function () { m.sel = idx; confirmGo(); }); })(i);
            }
        } else if (m.kind === 'submenu') {
            var hh = 40 + m.items.length * 10 + (m.note ? 42 : 0);
            var y0 = Math.max(24, Math.round(72 - hh / 2));
            panel(10, y0, W - 20, hh);
            txtC(m.title, y0 + 5, AMB, 1);
            var yy = y0 + 15;
            if (m.note) {
                var nl = wrap(m.note, 26);
                for (i = 0; i < Math.min(5, nl.length); i++) txt(nl[i], 16, yy + i * 7, DIM, 1);
                yy += Math.min(5, nl.length) * 7 + 5;
            }
            for (i = 0; i < m.items.length; i++) {
                var it = m.items[i], on2 = m.sel === i;
                if (on2) txt('>', 15, yy, AMB, 1);
                txt(it.t, 22, yy, it.dis ? DIMD : (on2 ? WHT : PAPER), 1);
                if (it.info) txt(it.info, W - textW(it.info, 1) - 16, yy, it.dis ? DIMD : DIM, 1);
                if (it.sub && on2) txt(it.sub, 22, yy + 7, DIMD, 1);
                (function (idx) { addHit(12, yy - 1, W - 24, 10, function () { m.sel = idx; submenuGo(); }); })(i);
                yy += 10;
            }
            hint('A SELECT  B CLOSE');
        } else if (m.kind === 'event') {
            panel(8, 28, W - 16, 92);
            drawIcon(m.ev.icon, W / 2 - 4, 33, AMB);
            txtC(m.ev.t, 44, WHT, 1);
            var el = wrap(m.ev.txt, 27);
            for (i = 0; i < Math.min(4, el.length); i++) txtC(el[i], 55 + i * 7, PAPER, 1);
            var chs = [m.ev.a, m.ev.b];
            for (i = 0; i < 2; i++) {
                var ch = chs[i], on3 = m.sel === i;
                var cy = 88 + i * 12;
                var dis = ch.cost && S.cash < ch.cost;
                if (on3) txt('>', 14, cy, AMB, 1);
                txt(ch.l, 21, cy, dis ? DIMD : (on3 ? WHT : PAPER), 1);
                (function (idx) { addHit(10, cy - 2, W - 20, 12, function () { m.sel = idx; resolveEvent(idx); }); })(i);
            }
            hint('AN EVENT DEMANDS A DECISION');
        } else if (m.kind === 'pitch') {
            drawPitch(dt);
        }
    }
    function confirmGo() {
        var m = modal;
        modal = null;
        if (m.sel === 0 && m.yes) m.yes();
        else SFX.back();
    }
    function submenuGo() {
        var m = modal, it = m.items[m.sel];
        if (!it || it.dis) { SFX.deny(); return; }
        it.cb();
    }
    function drawPitch(dt) {
        var m = modal, sp = m.sp;
        panel(6, 24, W - 12, 104);
        txtC('PITCH: ' + sp.name, 29, AMB, 1);
        txtC('ASK: ' + fmt$(sp.amt), 38, PAPER, 1);
        if (m.phase === 'talk') {
            txtC('ROUND ' + (m.round + 1) + '/3', 48, DIM, 1);
            var hl = wrap(sp.hint, 27);
            for (var i = 0; i < Math.min(2, hl.length); i++) txtC(hl[i], 58 + i * 7, DIM, 1);
            txtC('LEAD WITH...', 76, PAPER, 1);
            for (i = 0; i < 3; i++) {
                var on = m.sel === i, y = 86 + i * 11;
                if (on) txt('>', 34, y, AMB, 1);
                txt(PREFS[i], 42, y, on ? WHT : PAPER, 1);
                (function (idx) { addHit(30, y - 2, 100, 11, function () { m.sel = idx; pitchChoose(idx); }); })(i);
            }
            hint('READ THE HINT. PICK THE ANGLE.');
        } else if (m.phase === 'roll') {
            m.rollT -= dt;
            if (m.rollT > 0) {
                if (frame % 4 === 0) { m.rollVal = 1 + Math.floor(Math.random() * 20); SFX.type(); }
            } else if (!m.rolled) {
                m.rolled = true;
                m.rollVal = 1 + Math.floor(Math.random() * 20);
                pitchResolve();
            }
            txtC('THE ASK IS MADE...', 52, PAPER, 1);
            txtC('NEED ' + m.need + '+', 62, DIM, 1);
            /* the d20 */
            bctx.fillStyle = C(PAPER);
            bctx.fillRect(66, 74, 28, 28);
            bctx.fillStyle = C(INK);
            bctx.fillRect(66, 74, 28, 2); bctx.fillRect(66, 100, 28, 2);
            bctx.fillRect(66, 74, 2, 28); bctx.fillRect(92, 74, 2, 28);
            var vs = String(m.rollVal);
            drawTextC(bctx, vs, 80 - textW(vs, 2) / 2, 82, C(REDD), 2);
        } else {
            var won = m.phase === 'won';
            txtC(won ? (m.rollVal === 20 ? 'NAT 20! SIGNED!' : 'SIGNED!') : (m.rollVal === 1 ? 'NAT 1. OUCH.' : 'THEY PASS.'), 56, won ? GRN : RED, 1);
            bctx.fillStyle = C(PAPER);
            bctx.fillRect(66, 66, 28, 28);
            var vs2 = String(m.rollVal);
            drawTextC(bctx, vs2, 80 - textW(vs2, 2) / 2, 74, won ? C(REDD) : C(DIMD), 2);
            var msg = won ? sp.name + ' wires ' + fmt$(m.wonAmt) + '.' + (m.rollVal === 20 ? ' They loved the deck.' : '')
                          : 'Cooldown 4 weeks. Rep -1.' + (m.rollVal === 1 ? ' Someone said "synergy" too many times.' : '');
            var ml = wrap(msg, 26);
            for (i = 0; i < Math.min(3, ml.length); i++) txtC(ml[i], 100 + i * 7, PAPER, 1);
            if (frame % 40 < 26) txtC('A OK', 122, DIM, 1);
            addHit(0, 0, W, H, function () { modal = null; SFX.blip(); });
        }
    }
    function openSystem() {
        modal = { kind: 'submenu', title: 'SYSTEM', sel: 0, items: [
            { t: 'RESUME', info: '', cb: function () { modal = null; } },
            { t: 'SAVE', info: 'AUTO EVERY WEEK', cb: function () { saveGame(); gtoast('SAVED.'); modal = null; } },
            { t: 'HOW TO PLAY', info: '', cb: function () {
                modal = { kind: 'note', title: 'HOW TO PLAY', icon: 'flag',
                    text: 'Spend 2 AP a week on money, car, and crew. Hit every deadline. Bring a finished car to May. <> tabs, A select, B back.' };
            } },
            { t: 'QUIT TO TITLE', info: 'SAVES', cb: function () { saveGame(); cur = {}; enterTitle(); } }
        ] };
    }

    /* ================================================================
       TITLE, INTRO, CUTSCENE DRAWING, COMPETITION ANIMS, LIFECYCLE
       ================================================================ */
    var titleSel = 0, report = null, titleCache = null;

    function bestPlace() { try { return parseInt(localStorage.getItem('ub_pitlane_best') || '0', 10) || 0; } catch (e) { return 0; } }
    function setBestPlace(p) { try { var b = bestPlace(); if (!b || p < b) localStorage.setItem('ub_pitlane_best', String(p)); } catch (e) {} }

    /* single entry point to the title screen: caches the localStorage reads so the
       per-frame drawTitle doesn't JSON.parse the whole save 60 times a second */
    function enterTitle() {
        scr = 'title';
        titleSel = 0;
        modal = null;
        titleCache = { save: loadGame(), vet: hasVeteran(), best: bestPlace() };
        musicStart();
    }
    function titleItems() {
        var tc = titleCache || (titleCache = { save: loadGame(), vet: hasVeteran(), best: bestPlace() });
        var items = [];
        if (tc.save) items.push({ t: 'CONTINUE', go: function () { S = tc.save; resumeSeason(); } });
        items.push({ t: 'NEW SEASON', go: function () {
            if (tc.save) modal = { kind: 'confirm', text: 'Overwrite the saved season?', sel: 1, yes: startNewSeason };
            else startNewSeason();
        } });
        if (tc.vet) items.push({ t: 'NEW SEASON+ (REP 15)', go: function () {
            if (tc.save) modal = { kind: 'confirm', text: 'Overwrite the saved season?', sel: 1, yes: function () { startNewSeason(true); } };
            else startNewSeason(true);
        } });
        items.push({ t: 'EJECT CARTRIDGE', go: function () { if (api && api.quit) api.quit(); } });
        return items;
    }
    function startNewSeason(vet) {
        modal = null;
        S = newSeason(vet);
        /* no save until the intro finishes — quitting mid-intro restarts it cleanly */
        musicStop();
        playScript(introScript(), function () { scr = 'home'; saveGame(); });
        scr = 'cutscene';
    }
    function resumeSeason() {
        musicStop();
        scr = 'home';
        cur = {};
        if (S.pendingMilestone === 'comp') { startComp(); return; }
        if (S.pendingMilestone) runMilestone(S.pendingMilestone);
        else if (S.pendingEvent !== undefined && S.pendingEvent !== null) openEvent(S.pendingEvent);
        gtoast('WEEK ' + S.week + '. WELCOME BACK.');
    }
    function drawTitle(dt) {
        /* checkered backdrop */
        bctx.fillStyle = C(['#20242e', 1]);
        bctx.fillRect(0, 0, W, H);
        bctx.fillStyle = C(['#2b303c', 1]);
        for (var y = 0; y < H; y += 8)
            for (var x = ((y / 8) & 1) * 8; x < W; x += 16) bctx.fillRect(x, y, 8, 8);
        /* checkered flag strips */
        for (x = 0; x < W; x += 8) {
            bctx.fillStyle = (x / 8) & 1 ? C(WHT) : C(INK);
            bctx.fillRect(x, 22, 8, 5);
            bctx.fillStyle = (x / 8) & 1 ? C(INK) : C(WHT);
            bctx.fillRect(x, 60, 8, 5);
        }
        txtCO('PIT', 28, RED, 4);
        txtCO('LANE', 51, WHT, 2);
        txtC('A FORMULA SAE STORY', 68, AMB, 1);
        var b = titleCache ? titleCache.best : 0;
        if (b) txtC('BEST FINISH: P' + b, 78, DIM, 1);
        var items = titleItems();
        for (var i = 0; i < items.length; i++) {
            var on = titleSel === i, yy = 90 + i * 10;
            if (on && frame % 30 < 20) txt('>', 34, yy, RED, 1);
            txt(items[i].t, 42, yy, on ? WHT : DIM, 1);
            (function (idx) { addHit(30, yy - 2, 110, 10, function () { titleSel = idx; titleItems()[idx].go(); }); })(i);
        }
        txt('2026 URE SOFT', 4, H - 7, DIMD, 1);
        txt('SELECT: LIST', W - 52, H - 7, DIMD, 1);
    }

    /* ---------------- intro ---------------- */
    function introScript() {
        return [
            { say: 'SEPTEMBER. RICE UNIVERSITY.', art: 'black' },
            { say: 'To: you. From: J. -- "The club is real. We have a donated frame, a borrowed engine, and a competition slot in May. What we do not have is money. Someone has to run it. Everyone said you."', art: 'letter' },
            { anim: 'door' },
            { say: 'This is the car. Well. It will be.', art: 'garage' },
            { say: 'YOU ARE THE DIRECTOR OF FINANCING. Budget: $250. Weeks to competition: 28. Crew: four believers. Good luck.', art: 'black' },
            { say: 'TIP - Spend your 2 AP each week, watch the deadlines on the CAL tab, and never miss a sponsor hint. The car only goes as fast as the budget.', art: 'black' }
        ];
    }

    /* ---------------- cutscene / script drawing ---------------- */
    function drawScript(dt) {
        var st = curStep();
        if (!st) return;
        var full = st.say || '';
        script.t += dt;
        if (script.chars < full.length) {
            script.chars = Math.min(full.length, script.chars + dt * 45);
            if (frame % 3 === 0) SFX.type();
        }
        if (st.anim) {
            var an = script.anim;
            if (an) {
                an.update(dt);
                /* update() may finish the step and advance the script — only draw if still current */
                if (script && script.anim === an) an.draw();
            }
            addHit(0, 0, W, H, function () { if (script && script.anim && script.anim.skip) script.anim.skip(); });
            return;
        }
        /* backdrop */
        if (st.art === 'letter') {
            bctx.fillStyle = C(INK); bctx.fillRect(0, 0, W, H);
            bctx.fillStyle = C(PAPER); bctx.fillRect(14, 12, W - 28, H - 24);
            bctx.fillStyle = C(DIM); bctx.fillRect(14, 12, W - 28, 1); bctx.fillRect(14, H - 13, W - 28, 1);
            var lines = wrap(full, 24), remain = Math.ceil(script.chars);
            for (var i = 0; i < Math.min(13, lines.length) && remain > 0; i++) {
                drawTextC(bctx, lines[i].slice(0, remain), 20, 18 + i * 8, C(INK), 1);
                remain -= lines[i].length + 1;
            }
        } else {
            bctx.fillStyle = C(['#14141a', 0]); bctx.fillRect(0, 0, W, H);
            if (st.art === 'garage' && S) drawGarage(20);
            if (st.art === 'banner') {
                panel(8, 20, W - 16, 22);
                txtC(st.t || '', 27, AMB, 1);
                if (S) drawGarage(48);
            }
            /* text box auto-sizes to the text, up to 9 lines */
            var lines2 = wrap(full, 28);
            var nLines = Math.min(st.ask ? 3 : 9, lines2.length);
            var boxY = st.ask ? 58 : Math.min(96, H - 4 - (nLines * 8 + 14));
            panel(4, boxY, W - 8, H - boxY - 4);
            var remain2 = Math.ceil(script.chars);
            for (i = 0; i < nLines && remain2 > 0; i++) {
                txt(lines2[i].slice(0, remain2), 10, boxY + 6 + i * 8, PAPER, 1);
                remain2 -= lines2[i].length + 1;
            }
            if (st.ask && script.chars >= full.length) {
                for (i = 0; i < st.choices.length; i++) {
                    var on = (script.choiceSel || 0) === i;
                    var cy = boxY + 32 + i * 11;
                    var dis = st.choices[i].cost && S.cash < st.choices[i].cost;
                    if (on) txt('>', 12, cy, AMB, 1);
                    txt(st.choices[i].t, 20, cy, dis ? DIMD : (on ? WHT : PAPER), 1);
                    (function (idx) { addHit(8, cy - 2, W - 16, 11, function () { script.choiceSel = idx; scriptChoice(); }); })(i);
                }
            }
        }
        if (!st.ask && script.chars >= (full.length || 0) && frame % 40 < 26) {
            txt('A', W - 12, H - 12, RED, 1);
        }
        if (!st.ask) addHit(0, 0, W, H, function () { scriptTap(); });
    }
    function scriptChoice() {
        var st = curStep(); if (!st || !st.ask) return;
        var c = st.choices[script.choiceSel || 0];
        if (!c) return;
        if (c.cost && S.cash < c.cost) { SFX.deny(); return; }
        SFX.blip();
        applyFx(c.fx, st.t || 'CHOICE');
        var result = c.then ? c.then() : c.r;
        if (result) script.steps.splice(script.i + 1, 0, { say: result, art: 'black' });
        scriptNext();
    }

    /* ---------------- animated set-pieces ---------------- */
    var ANIMS = {
        door: function () {
            var t = 0, done = false;
            function fin() { if (!done) { done = true; scriptNext(); } }
            return {
                update: function (dt) { t += dt; if (t > 2.6) fin(); },
                draw: function () {
                    bctx.fillStyle = C(['#14141a', 0]); bctx.fillRect(0, 0, W, H);
                    if (S) drawGarage(34);
                    var doorH = Math.max(0, Math.round((H - 20) * (1 - Math.min(1, t / 2))));
                    bctx.fillStyle = C(['#3a3f48', 1]);
                    bctx.fillRect(0, 0, W, doorH + 20);
                    bctx.fillStyle = C(DIMD);
                    for (var dy = 12; dy < doorH + 18; dy += 7) bctx.fillRect(0, dy, W, 1);
                    bctx.fillStyle = C(INK);
                    bctx.fillRect(0, doorH + 18, W, 3);
                    if (t > 0.2 && t < 1.9 && frame % 10 === 0) noiseHit(0.06, 0.05, 300);
                },
                skip: fin
            };
        },
        shakedown: function (st) {
            var t = 0, done = false, broke = st.broke;
            function fin() { if (!done) { done = true; scriptNext(); } }
            return {
                update: function (dt) { t += dt; if (t > 4) fin(); },
                draw: function () {
                    bctx.fillStyle = C(['#7a90a8', 2]); bctx.fillRect(0, 0, W, 70);         // morning sky
                    bctx.fillStyle = C(['#c8c8b8', 3]); bctx.fillRect(0, 70, W, 20);        // lot far
                    bctx.fillStyle = C(['#55565e', 1]); bctx.fillRect(0, 90, W, 54);        // asphalt
                    bctx.fillStyle = C(AMB);
                    for (var i = 0; i < 5; i++) bctx.fillRect(20 + i * 30, 108, 3, 6);      // cones
                    var prog = Math.min(1, t / 3.2);
                    var cx = broke ? Math.min(60, prog * 160) : -60 + prog * 260;
                    var bounce = (frame >> 2) & 1;
                    drawCarSide(Math.round(cx), 120 + bounce, { driver: true });
                    if (broke && cx >= 60) {
                        for (i = 0; i < 3; i++) {
                            var sx = 68 + ((frame * 2 + i * 30) % 26);
                            bctx.fillStyle = C(DIM);
                            bctx.fillRect(sx, 96 - ((frame + i * 8) % 18), 3, 3);
                        }
                        if (frame % 30 === 0) noiseHit(0.1, 0.08, 350);
                    } else if (frame % 12 === 0) SFX.rev();
                    txtCO('SHAKEDOWN', 12, WHT, 2);
                },
                skip: fin
            };
        },
        accel: function (st) {
            var t = 0, done = false, T = parseFloat(st.time);
            function fin() { if (!done) { done = true; scriptNext(); } }
            return {
                update: function (dt) { t += dt; if (t > 3.4) fin(); },
                draw: function () {
                    bctx.fillStyle = C(['#8fb0c8', 3]); bctx.fillRect(0, 0, W, 60);
                    bctx.fillStyle = C(['#55565e', 1]); bctx.fillRect(0, 60, W, 84);
                    bctx.fillStyle = C(WHT);
                    bctx.fillRect(10, 60, 2, 84); bctx.fillRect(148, 60, 2, 84);            // start/finish
                    for (var x = 0; x < W; x += 8) {
                        bctx.fillStyle = (x / 8) & 1 ? C(WHT) : C(INK);
                        bctx.fillRect(148, 60 + (x / 8) * 10 % 84, 2, 5);
                    }
                    var p = Math.min(1, (t / 2.4) * (t / 2.4) + t * 0.12);
                    drawCarSide(Math.round(-40 + p * 180), 118, { driver: true });
                    var shown = Math.min(T, t / 2.8 * T);
                    txtCO('ACCELERATION', 8, WHT, 1);
                    txtCO(shown.toFixed(2) + 'S', 20, AMB, 2);
                    if (t > 2.9) txtCO('+' + st.pts + ' PTS', 42, GRN, 1);
                    if (frame % 9 === 0 && t < 2.6) SFX.rev();
                },
                skip: fin
            };
        },
        skid: function (st) {
            var t = 0, done = false;
            function fin() { if (!done) { done = true; scriptNext(); } }
            return {
                update: function (dt) { t += dt; if (t > 3.2) fin(); },
                draw: function () {
                    bctx.fillStyle = C(['#55565e', 1]); bctx.fillRect(0, 0, W, H);
                    bctx.fillStyle = C(DIM);
                    for (var a = 0; a < 32; a++) {
                        var ang = a / 32 * Math.PI * 2;
                        bctx.fillRect(Math.round(80 + Math.cos(ang) * 34), Math.round(80 + Math.sin(ang) * 26), 2, 2);
                        bctx.fillRect(Math.round(80 + Math.cos(ang) * 14), Math.round(80 + Math.sin(ang) * 10), 1, 1);
                    }
                    var ang2 = t * 4.2;
                    bctx.fillStyle = C(RED);
                    bctx.fillRect(Math.round(78 + Math.cos(ang2) * 24), Math.round(78 + Math.sin(ang2) * 18), 5, 4);
                    txtCO('SKIDPAD', 8, WHT, 1);
                    if (t > 2.6) txtCO('+' + st.pts + ' PTS', 20, GRN, 1);
                },
                skip: fin
            };
        },
        autox: function (st) {
            var t = 0, done = false;
            var path = [[0, 120], [40, 110], [60, 80], [30, 56], [70, 40], [110, 60], [96, 96], [130, 116], [160, 100]];
            function fin() { if (!done) { done = true; scriptNext(); } }
            return {
                update: function (dt) { t += dt; if (t > 3.4) fin(); },
                draw: function () {
                    bctx.fillStyle = C(['#55565e', 1]); bctx.fillRect(0, 0, W, H);
                    bctx.fillStyle = C(AMB);
                    for (var i = 1; i < path.length - 1; i++) bctx.fillRect(path[i][0] - 1, path[i][1] - 1, 3, 5);
                    var prog = Math.min(0.999, t / 3) * (path.length - 1);
                    var seg = Math.floor(prog), f = prog - seg;
                    var x = path[seg][0] + (path[seg + 1][0] - path[seg][0]) * f;
                    var y = path[seg][1] + (path[seg + 1][1] - path[seg][1]) * f;
                    bctx.fillStyle = C(RED);
                    bctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 4);
                    txtCO('AUTOCROSS', 8, WHT, 1);
                    if (t > 2.7) txtCO('+' + st.pts + ' PTS', 20, GRN, 1);
                },
                skip: fin
            };
        },
        endurance: function (st) {
            var t = 0, done = false, dnf = st.dnf, lap = 0;
            function fin() { if (!done) { done = true; scriptNext(); } }
            return {
                update: function (dt) {
                    t += dt;
                    var nl = Math.min(10, Math.floor(t / 0.75) + 1);
                    if (nl !== lap) { lap = nl; if (!(dnf && lap >= dnf)) SFX.beat(); }
                    if (dnf && lap >= dnf && t > dnf * 0.75 + 1.6) fin();
                    if (!dnf && t > 9) fin();
                },
                draw: function () {
                    bctx.fillStyle = C(['#3a5a3a', 1]); bctx.fillRect(0, 0, W, H);
                    /* oval */
                    bctx.fillStyle = C(['#55565e', 1]);
                    for (var a = 0; a < 64; a++) {
                        var ang = a / 64 * Math.PI * 2;
                        bctx.fillRect(Math.round(80 + Math.cos(ang) * 52) - 4, Math.round(84 + Math.sin(ang) * 34) - 3, 9, 7);
                    }
                    bctx.fillStyle = C(['#3a5a3a', 1]);
                    for (a = 0; a < 48; a++) {
                        var ang3 = a / 48 * Math.PI * 2;
                        bctx.fillRect(Math.round(80 + Math.cos(ang3) * 32) - 3, Math.round(84 + Math.sin(ang3) * 20) - 2, 7, 5);
                    }
                    var stopped = dnf && lap >= dnf;
                    var ang2 = (stopped ? dnf * 0.75 : t) * 1.9;
                    var cx = Math.round(78 + Math.cos(ang2) * 42), cy2 = Math.round(82 + Math.sin(ang2) * 27);
                    bctx.fillStyle = C(RED);
                    bctx.fillRect(cx, cy2, 5, 4);
                    if (stopped) {
                        bctx.fillStyle = C(DIM);
                        bctx.fillRect(cx + ((frame >> 2) % 3), cy2 - 4 - ((frame >> 1) % 6), 2, 2);
                        if (frame % 40 < 24) txtCO('D N F', 66, RED, 2);
                    }
                    txtCO('ENDURANCE', 8, WHT, 1);
                    txtCO('LAP ' + Math.min(lap, dnf || 10) + '/10', 20, stopped ? RED : AMB, 1);
                    if (!stopped && S.rel < 45 && frame % 24 < 10) txtCO('RELIABILITY...', 130, RED, 1);
                },
                skip: fin
            };
        },
        standings: function (st) {
            var t = 0, done = false, R = st.R;
            function fin() { if (!done) { done = true; scriptNext(); } }
            return {
                update: function (dt) { t += dt; if (t > 5) fin(); },
                draw: function () {
                    bctx.fillStyle = C(INK); bctx.fillRect(0, 0, W, H);
                    txtC('FINAL STANDINGS', 6, AMB, 1);
                    var reveal = Math.floor(t / 0.35);
                    var start = Math.max(0, Math.min(R.place - 5, R.field.length - 9));
                    for (var i = 0; i < 9; i++) {
                        var idx = start + i;
                        if (idx >= R.field.length || i >= reveal) continue;
                        var row = R.field[idx], y = 20 + i * 12;
                        if (row.us) { bctx.fillStyle = C(REDD); bctx.fillRect(2, y - 2, W - 4, 11); }
                        txt('P' + (idx + 1), 8, y, row.us ? AMB : DIM, 1);
                        txt(row.name, 30, y, row.us ? WHT : PAPER, 1);
                        txt(String(row.pts), W - textW(String(row.pts), 1) - 8, y, row.us ? AMB : DIM, 1);
                    }
                    if (t > 3.6) txtC('A ...', 132, DIM, 1);
                },
                skip: fin
            };
        }
    };

    /* ---------------- the competition ---------------- */
    function startComp() {
        scr = 'cutscene';
        if (S.flags.noTravel) {
            playScript([
                { say: 'MAY. COMPETITION WEEK.', art: 'black' },
                { say: 'The shop projector shows the livestream. Somewhere out there, thirty teams are racing. The trailer money never came together.', art: 'garage' },
                { say: 'The team watches every run. Quietly, someone starts a list titled NEXT YEAR. The car sits behind them, 90% of a dream.', art: 'garage' },
                { do: function () { finishSeason({ place: 0, total: 0, noTravel: true }); } }
            ]);
            return;
        }
        /* roll the whole competition once and persist it, so quitting mid-cutscene
           resumes into the SAME outcome instead of re-rolling a witnessed result */
        var R = S.compResult;
        if (!R) { R = buildComp(); S.compResult = R; saveGame(); }
        var steps = [
            { say: 'MAY. COMPETITION WEEK. The trailer rolls out of Houston at 5 AM, PENNY strapped down under a tarp like a secret.', art: 'banner', t: 'FSAE COMPETITION' },
            { say: 'TECH INSPECTION - ' + (R.techPass ? 'Stickers on the nose. First try. The scrutineer actually says "nice loom."'
                : 'Two failed items and a frantic night of zip ties and prayers. You lose points but make the grid.'), art: 'black' },
            { say: 'DESIGN EVENT - The judges circle the car for forty minutes. Verdict: ' + R.design + '/150.' +
                   (R.q.balance > 0.7 ? ' "Balanced build," one notes.' : ' "Interesting priorities," one notes.'), art: 'black' },
            { say: 'COST REPORT - Your ledger is the tidiest document at the event. ' + R.cost + '/100.', art: 'black' },
            { say: 'BUSINESS PRESENTATION - You have pitched sponsors all season. This room holds no fear. ' + R.biz + '/75.', art: 'black' }
        ];
        if (carDrivable()) {
            steps = steps.concat([
                { anim: 'accel', pts: R.accel, time: R.accelT },
                { anim: 'skid', pts: R.skid },
                { anim: 'autox', pts: R.auto },
                { say: 'ENDURANCE - 22 minutes. Every weld, every wire, every dollar. This is what the season was for.', art: 'black' },
                { anim: 'endurance', dnf: R.dnfLap },
                { say: R.dnfLap ? 'Lap ' + R.dnfLap + '. A noise, then silence, then the push crew. It is a long walk back. ' + R.endu + '/275.'
                                : 'CHECKERED FLAG. PENNY takes every lap. The crew is hoarse. ' + R.endu + '/275.', art: 'black' }
            ]);
        } else {
            steps.push({ say: 'DYNAMIC EVENTS - PENNY never turns a wheel. The team pushes her to the fence and watches thirty other cars do what she could not. Nobody says much.', art: 'black' });
        }
        steps = steps.concat([
            { anim: 'standings', R: R },
            { say: epilogueText(R), art: 'black' },
            { do: function () { finishSeason(R); } }
        ]);
        playScript(steps);
    }
    function epilogueText(R) {
        if (R.place <= 3) return 'P' + R.place + ' OVERALL. A podium. In year one. Nobody back home believes it until they see the trophy in the trailer cupholder. Legends start like this.';
        if (R.place <= 10) return 'P' + R.place + ' OVERALL. Top ten, year one, on a budget other teams spend on tires. The paddock knows the name RICE RACING now.';
        if (R.place <= 20) return 'P' + R.place + ' OVERALL. Points on the board and a car that came home alive. The freshmen are already sketching next season.';
        return 'P' + R.place + ' OVERALL. Not the number you dreamed of. But a team that did not exist a year ago built a car, took it to nationals, and finished. That is the whole miracle.';
    }
    function finishSeason(R) {
        report = {
            place: R.place, total: R.total, noTravel: !!R.noTravel,
            raised: S.raisedTotal || 0, spent: S.spentTotal || 0, sponsors: 0, members: S.members,
            tests: S.flags.tested, pitches: S.flags.pitchesWon, weeks: S.week
        };
        for (var i = 0; i < SPONSORS.length; i++) if (S.sponsors[SPONSORS[i].id] && S.sponsors[SPONSORS[i].id].signed) report.sponsors++;
        if (!R.noTravel) {
            setBestPlace(R.place);
            setVeteran();
            if (api && api.markEgg) api.markEgg('pitlane', 'took a rookie team to nationals');
        }
        clearSave();
        scr = 'report';
        SFX.fanfare();
    }
    function drawReport() {
        bctx.fillStyle = C(INK); bctx.fillRect(0, 0, W, H);
        for (var x = 0; x < W; x += 8) {
            bctx.fillStyle = (x / 8) & 1 ? C(WHT) : C(INK);
            bctx.fillRect(x, 0, 8, 4);
            bctx.fillStyle = (x / 8) & 1 ? C(INK) : C(WHT);
            bctx.fillRect(x, H - 4, 8, 4);
        }
        txtC('SEASON REPORT', 10, AMB, 1);
        if (report.noTravel) txtC('DNS - WATCHED FROM HOME', 22, RED, 1);
        else { txtCO('P' + report.place, 22, report.place <= 10 ? GRN : WHT, 3); txtC(report.total + ' PTS', 42, DIM, 1); }
        var rows = [
            ['RAISED', fmt$(report.raised)], ['SPENT', fmt$(report.spent)],
            ['SPONSORS SIGNED', String(report.sponsors)], ['PITCHES WON', String(report.pitches)],
            ['CREW SIZE', String(report.members)], ['TEST DAYS', String(report.tests)]
        ];
        for (var i = 0; i < rows.length; i++) {
            var y = 56 + i * 10;
            txt(rows[i][0], 16, y, DIM, 1);
            txt(rows[i][1], W - textW(rows[i][1], 1) - 16, y, PAPER, 1);
        }
        txtC(report.noTravel ? 'NEXT YEAR. FOR REAL.' : 'VETERAN START UNLOCKED', 120, AMB, 1);
        if (frame % 40 < 26) txtC('A - TITLE', 132, WHT, 1);
        addHit(0, 0, W, H, function () { report = null; enterTitle(); SFX.blip(); });
    }

    /* ---------------- input ---------------- */
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
    function actionTap(a) {
        if (script) {
            var st = curStep();
            if (st && st.ask && script.chars >= (st.say || '').length) {
                if (a === 'up') { script.choiceSel = ((script.choiceSel || 0) + st.choices.length - 1) % st.choices.length; SFX.move(); return; }
                if (a === 'down') { script.choiceSel = ((script.choiceSel || 0) + 1) % st.choices.length; SFX.move(); return; }
                if (a === 'a') { scriptChoice(); return; }
                return;
            }
            if (a === 'a' || a === 'start') scriptTap();
            return;
        }
        if (modal) { modalTap(a); return; }
        if (scr === 'title') {
            var items = titleItems();
            if (a === 'up') { titleSel = (titleSel + items.length - 1) % items.length; SFX.move(); }
            else if (a === 'down') { titleSel = (titleSel + 1) % items.length; SFX.move(); }
            else if (a === 'a' || a === 'start') { items[Math.min(titleSel, items.length - 1)].go(); }
            return;
        }
        if (scr === 'report') { if (a === 'a' || a === 'start') { report = null; enterTitle(); } return; }
        /* season screens */
        if (a === 'left' || a === 'right') {
            var i = tabIdx();
            i = (i + (a === 'left' ? TABS.length - 1 : 1)) % TABS.length;
            switchTab(TABS[i].id);
            return;
        }
        var n = listItems.length;
        if (a === 'up' && n) { cur[scr] = ((cur[scr] || 0) + n - 1) % n; SFX.move(); }
        else if (a === 'down' && n) { cur[scr] = ((cur[scr] || 0) + 1) % n; SFX.move(); }
        else if (a === 'a') listActivate();
        else if (a === 'b') { if (scr !== 'home') { switchTab('home'); SFX.back(); } }
        else if (a === 'start') openSystem();
    }
    function modalTap(a) {
        var m = modal;
        if (m.kind === 'note') { if (a === 'a' || a === 'b' || a === 'start') { modal = null; SFX.blip(); } return; }
        if (m.kind === 'confirm') {
            if (a === 'left' || a === 'up') { m.sel = 0; SFX.move(); }
            else if (a === 'right' || a === 'down') { m.sel = 1; SFX.move(); }
            else if (a === 'a') confirmGo();
            else if (a === 'b') { modal = null; SFX.back(); }
            return;
        }
        if (m.kind === 'submenu') {
            if (a === 'up') { m.sel = (m.sel + m.items.length - 1) % m.items.length; SFX.move(); }
            else if (a === 'down') { m.sel = (m.sel + 1) % m.items.length; SFX.move(); }
            else if (a === 'a') submenuGo();
            else if (a === 'b' || a === 'start') { modal = null; SFX.back(); }
            return;
        }
        if (m.kind === 'event') {
            if (a === 'up' || a === 'down') { m.sel = 1 - m.sel; SFX.move(); }
            else if (a === 'a') resolveEvent(m.sel);
            return;
        }
        if (m.kind === 'pitch') {
            if (m.phase === 'talk') {
                if (a === 'up') { m.sel = (m.sel + 2) % 3; SFX.move(); }
                else if (a === 'down') { m.sel = (m.sel + 1) % 3; SFX.move(); }
                else if (a === 'a') pitchChoose(m.sel);
            } else if (m.phase === 'won' || m.phase === 'lost') {
                if (a === 'a' || a === 'b') { modal = null; SFX.blip(); }
            }
            return;
        }
    }
    function onKeyDown(e) {
        if (!mounted || document.body.classList.contains('list-mode')) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var a = keyToAction(e.key);
        if (!a) return;
        if (e.key === 'Enter' || e.key === ' ') {
            var tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'BUTTON' || tag === 'A') return;
        }
        e.preventDefault();
        if (!e.repeat) actionTap(a);
    }
    function bindTapButton(id, a) {
        var el = document.getElementById(id);
        if (!el) return;
        var down = function (e) { e.preventDefault(); actionTap(a); };
        el.addEventListener('pointerdown', down);
        boundBtn.push([el, 'pointerdown', down]);
    }
    function onCanvasDown(e) {
        e.preventDefault();
        var r = disp.getBoundingClientRect();
        var px = (e.clientX - r.left) * (disp.width / r.width);
        var py = (e.clientY - r.top) * (disp.height / r.height);
        var bx = (px - presentOX) / presentS, by = (py - presentOY) / presentS;
        for (var i = HITS.length - 1; i >= 0; i--) {
            var h2 = HITS[i];
            if (bx >= h2.x && bx < h2.x + h2.w && by >= h2.y && by < h2.y + h2.h) { h2.cb(); return; }
        }
    }
    function onVis() { if (document.hidden) silenceAudio(); }

    /* ---------------- frame loop / lifecycle ---------------- */
    function render(dt) {
        HITS.length = 0;
        bctx.fillStyle = C(['#14141a', 0]);
        bctx.fillRect(0, 0, W, H);
        if (scr === 'title') { drawTitle(dt); if (modal) drawModal(dt); }
        else if (scr === 'report') drawReport();
        else if (script) drawScript(dt);
        else {
            listItems = [];
            drawChrome();
            if (scr === 'home') drawHome();
            else if (scr === 'actions') drawActions();
            else if (scr === 'car') drawCarScr();
            else if (scr === 'sponsors') drawSponsors();
            else if (scr === 'team') drawTeam();
            else if (scr === 'ledger') drawLedger();
            else if (scr === 'calendar') drawCalendar();
            if (modal) drawModal(dt);
        }
        drawToasts(dt);
    }
    function frameLoop(ts) {
        if (!mounted) return;
        rafId = requestAnimationFrame(frameLoop);
        var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
        lastTs = ts;
        frame++; nowT += dt;
        var m = api.isDMG() ? 'dmg' : 'color';
        if (m !== mode) { mode = m; buildDither(); }
        if (host.offsetParent === null) { silenceAudio(); return; }
        if (scr === 'title' && api.isSound()) musicStart(); else if (scr !== 'title') musicStop();
        render(dt);
        present();
    }
    function present() {
        var cw = disp.width, ch = disp.height;
        var s = Math.min(cw / W, ch / H);
        var dw = Math.round(W * s), dh = Math.round(H * s);
        presentS = s;
        presentOX = (cw - dw) >> 1;
        presentOY = (ch - dh) >> 1;
        dctx.imageSmoothingEnabled = false;
        dctx.fillStyle = '#000';
        dctx.fillRect(0, 0, cw, ch);
        dctx.drawImage(bb, 0, 0, W, H, presentOX, presentOY, dw, dh);
    }
    function resize() {
        if (!disp || !host) return;
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        disp.width = Math.round(Math.max(32, host.clientWidth) * dpr);
        disp.height = Math.round(Math.max(32, host.clientHeight) * dpr);
    }
    function buildDither() {
        var dt2 = document.createElement('canvas');
        dt2.width = 2; dt2.height = 2;
        var dg = dt2.getContext('2d');
        dg.fillStyle = C(['#0a0a10', 0]);
        dg.fillRect(0, 0, 1, 1); dg.fillRect(1, 1, 1, 1);
        ditherPat = bctx.createPattern(dt2, 'repeat');
    }

    function mount(hostEl, apiObj) {
        if (mounted) unmount();
        host = hostEl; api = apiObj;
        if (!host) return;
        mounted = true;
        mode = api.isDMG() ? 'dmg' : 'color';
        host.innerHTML = '';
        disp = document.createElement('canvas');
        disp.setAttribute('aria-label', 'PIT LANE, a Formula SAE season manager. Arrow keys move, A selects, B goes back.');
        host.appendChild(disp);
        dctx = disp.getContext('2d');
        bb = document.createElement('canvas');
        bb.width = W; bb.height = H;
        bctx = bb.getContext('2d');
        buildDither();
        resize();
        if (window.ResizeObserver) { resizeObs = new ResizeObserver(resize); resizeObs.observe(host); }
        var wl = [['keydown', onKeyDown], ['resize', resize]];
        for (var i = 0; i < wl.length; i++) { window.addEventListener(wl[i][0], wl[i][1]); boundWin.push(wl[i]); }
        document.addEventListener('visibilitychange', onVis);
        boundWin.push(['__vis', onVis]);
        disp.addEventListener('pointerdown', onCanvasDown);
        boundBtn.push([disp, 'pointerdown', onCanvasDown]);
        bindTapButton('dLeft', 'left'); bindTapButton('dRight', 'right');
        bindTapButton('dUp', 'up'); bindTapButton('dDown', 'down');
        bindTapButton('btnA', 'a'); bindTapButton('btnB', 'b');
        bindTapButton('btnStart', 'start');
        cur = {}; script = null; report = null; S = null;
        toastQ.length = 0;
        enterTitle();
        lastTs = 0;
        rafId = requestAnimationFrame(frameLoop);
    }
    function unmount() {
        if (!mounted) return;
        mounted = false;
        cancelAnimationFrame(rafId);
        /* an unresolved pitch would silently eat its AP — refund it */
        if (S && modal && modal.kind === 'pitch' && modal.phase !== 'won' && modal.phase !== 'lost') {
            S.ap = Math.min(AP_PER_WEEK, S.ap + 1);
        }
        if (S && scr !== 'title' && scr !== 'report' && !script) saveGame();
        musicStop();
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
    function press(a) { return a !== 'select'; }

    window.PITLANE = { mount: mount, unmount: unmount, press: press };
})();
