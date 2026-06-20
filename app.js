/* ============================================================
   URE BOY — app.js   (vanilla, no deps, no build)
   ============================================================ */
(function () {
    'use strict';

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var byId = function (id) { return document.getElementById(id); };

    /* ---------------- CONTENT (single source for console + list view) -------------- */
    var DATA = {
        about: {
            lead: "Hi — I'm Isaac. I shoot for The Rice Thresher and Rice Raw, spend an unreasonable amount on my MK8 GTI, and run the occasional D&D table.",
            lead2: "Day job: Rice '29, studying Mathematical Economic Analysis & Finance — a long way of saying I like spreadsheets that actually mean something. Houston / The Woodlands, TX.",
            now: [
                "Director of Financing @ Rice Racing (Formula SAE)",
                "Analyst @ Rice Undergraduate Wealth Management",
                "Summer '26 — intern @ Deep Blue Midland Basin",
                "Shooting · modding the GTI · DMing"
            ]
        },
        photos: [
            { src: "/images/Headshot-md.jpg", alt: "Isaac Ure", cap: "self-portrait, natural light", exif: "50mm · f/1.8 · 1/200 · ISO 200" },
            { src: "", cap: "[ Thresher — slot 01 ]", alt: "", exif: "a real frame drops here soon" },
            { src: "", cap: "[ Rice Raw — concert ]", alt: "", exif: "stage light, high ISO, no regrets" },
            { src: "", cap: "[ the GTI, golden hour ]", alt: "", exif: "the car gets a photoshoot too" },
            { src: "", cap: "[ campus, blue hour ]", alt: "", exif: "reserved" },
            { src: "", cap: "[ coming soon ]", alt: "", exif: "reserved" }
        ],
        garage: {
            spent: 6480,
            mods: [
                { part: "ECU Tune", spec: "Stage 2", note: "more boost, fewer brain cells. worth it." },
                { part: "Intake", spec: "cold air", note: "mostly for the noise. I'll admit it." },
                { part: "Coilovers", spec: "lowered", note: "every speed bump is now a personal decision." },
                { part: "Wheels", spec: "18\"", note: "curb rash builds character." },
                { part: "Exhaust", spec: "catback", note: "my neighbors have notes." }
            ]
        },
        work: [
            { date: "Summer 2026", role: "Summer Intern", org: "Deep Blue Midland Basin — Permian water midstream" },
            { date: "2024 — now", role: "Director of Financing", org: "Rice Racing (Formula SAE)" },
            { date: "2024 — now", role: "Analyst", org: "Rice Undergraduate Wealth Management Club" },
            { date: "2020 — 2024", role: "Cum Laude", org: "The John Cooper School — founded the D&D club" }
        ],
        contact: { email: "iu2@rice.edu", linkedin: "https://www.linkedin.com/in/isaacure/" },
        resumeUrl: "" /* drop a real /Isaac-Ure-Resume.pdf here and the loot/button will serve it */
    };

    var BOOT_LINES = [
        "URE BOY  v1.0",
        "(c) 2026 ISAAC URE",
        "",
        "CPU  SHARP LR35902 . ok",
        "EYE  a good one .... ok",
        "PHOTOS ............. ok",
        "GARAGE  MK8 GTI .... ok",
        "DICE  loaded ....... ok",
        "READY."
    ];

    /* ---------------- tiny helpers ---------------- */
    function toast(html, ms) {
        var t = document.createElement('div');
        t.className = 'toast';
        t.setAttribute('role', 'status');
        t.setAttribute('aria-live', 'polite');
        t.innerHTML = html;
        document.body.appendChild(t);
        requestAnimationFrame(function () { t.classList.add('show'); });
        setTimeout(function () {
            t.classList.remove('show');
            setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
        }, ms || 2600);
    }

    /* sound (WebAudio, off by default, zero asset files) */
    var soundOn = false, actx = null;
    function beep(freq, dur, type) {
        if (!soundOn) return;
        try {
            actx = actx || new (window.AudioContext || window.webkitAudioContext)();
            var o = actx.createOscillator(), g = actx.createGain();
            o.type = type || 'square'; o.frequency.value = freq;
            o.connect(g); g.connect(actx.destination);
            g.gain.value = 0.04;
            o.start();
            g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
            o.stop(actx.currentTime + dur);
        } catch (e) {}
    }

    /* ---------------- easter-egg tracking ---------------- */
    var EGGS = ['nat20', 'gameboy', 'p0420', 'sleep', 'character'];
    var found = new Set();
    try { (JSON.parse(localStorage.getItem('ub_eggs') || '[]') || []).forEach(function (e) { found.add(e); }); } catch (e) {}
    function eggLabel() { return '◉ ' + found.size + '/' + EGGS.length; }
    function markEgg(id, msg) {
        if (found.has(id)) return;
        found.add(id);
        try { localStorage.setItem('ub_eggs', JSON.stringify(Array.from(found))); } catch (e) {}
        var ec = byId('eggCount'); if (ec) ec.textContent = eggLabel();
        toast('🥚 <b>easter egg</b> — ' + (msg || id) + '  ·  ' + found.size + '/' + EGGS.length);
        beep(880, 0.08); setTimeout(function () { beep(1180, 0.1); }, 90);
    }

    /* ---------------- car ---------------- */
    var CAR_SVG =
        '<svg class="gti" id="gti" viewBox="0 0 220 96" role="img" aria-label="Isaac\'s MK8 GTI, side view">' +
        '<ellipse cx="114" cy="88" rx="98" ry="6" fill="rgba(0,0,0,.18)"/>' +
        '<path d="M14 64 L14 54 C14 49 18 47 26 46 L70 45 L92 30 C95 27 99 26 105 26 L150 26 C160 26 166 29 172 36 L196 47 L206 50 C212 51 212 56 212 64 L192 64 Q170 45 148 64 L84 64 Q62 45 40 64 Z" fill="#D81E05"/>' +
        '<path d="M192 64 Q170 45 148 64" fill="none" stroke="#7a0f06" stroke-width="2"/>' +
        '<path d="M84 64 Q62 45 40 64" fill="none" stroke="#7a0f06" stroke-width="2"/>' +
        '<path d="M26 57 L196 57" stroke="#9c1707" stroke-width="2"/>' +
        '<path d="M84 44 L96 31 C98 29 100 29 104 29 L121 29 L121 44 Z" fill="#39434d"/>' +
        '<path d="M127 29 L150 29 L160 44 L127 44 Z" fill="#39434d"/>' +
        '<rect x="121" y="29" width="3" height="16" fill="#9c1707"/>' +
        '<rect x="200" y="48" width="10" height="6" rx="1" fill="#ffd98a"/>' +
        '<rect x="14" y="50" width="6" height="7" rx="1" fill="#7a0f06"/>' +
        '<circle cx="62" cy="70" r="21" fill="#141417"/><circle cx="170" cy="70" r="21" fill="#141417"/>' +
        '<circle cx="62" cy="70" r="18" fill="#1c1c20"/><circle cx="170" cy="70" r="18" fill="#1c1c20"/>' +
        '<circle cx="62" cy="70" r="9" fill="#d7dade"/><circle cx="170" cy="70" r="9" fill="#d7dade"/>' +
        '<circle cx="62" cy="70" r="2.6" fill="#8b8e93"/><circle cx="170" cy="70" r="2.6" fill="#8b8e93"/>' +
        '<rect x="99" y="48" width="24" height="10" rx="1.5" fill="#17171a"/>' +
        '<text x="103" y="56" font-family="Press Start 2P, monospace" font-size="6" fill="#fff">GTI</text>' +
        '</svg>';

    // A real Game Boy cartridge silhouette: rounded body, stepped-down top-right shelf,
    // grip ridges flanking a top oval recess, and the bottom insertion triangle.
    var CART_SVG =
        '<svg class="cart-svg" viewBox="0 0 100 112" aria-hidden="true">' +
        '<path class="cart-body" d="M14 6 H72 V13 H90 Q96 13 96 19 V104 Q96 110 90 110 H14 Q8 110 8 104 V12 Q8 6 14 6 Z"/>' +
        '<g stroke="rgba(0,0,0,.16)" stroke-width="2" stroke-linecap="round">' +
        '<line x1="16" y1="18" x2="16" y2="38"/><line x1="20" y1="18" x2="20" y2="38"/><line x1="24" y1="18" x2="24" y2="38"/><line x1="28" y1="18" x2="28" y2="38"/>' +
        '<line x1="74" y1="22" x2="74" y2="41"/><line x1="78" y1="22" x2="78" y2="41"/><line x1="82" y1="22" x2="82" y2="41"/><line x1="86" y1="22" x2="86" y2="41"/>' +
        '</g>' +
        '<rect x="33" y="18" width="34" height="22" rx="9" fill="rgba(0,0,0,.05)" stroke="rgba(0,0,0,.12)" stroke-width="1"/>' +
        '<path d="M45 99 H55 L50 106 Z" fill="rgba(0,0,0,.22)"/>' +
        '<path class="cart-edge" d="M14 6 H72 V13 H90 Q96 13 96 19 V104 Q96 110 90 110 H14 Q8 110 8 104 V12 Q8 6 14 6 Z" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1.5"/>' +
        '</svg>';

    /* ---------------- cartridges ---------------- */
    var CARTS = [
        {
            id: 'about', ico: '👤', name: 'ABOUT', tag: 'who is this guy', color: '#5a6acf',
            render: function () {
                var d = DATA.about;
                return '<p class="gb-lead">' + d.lead + '</p>' +
                    '<p class="gb-lead dim">' + d.lead2 + '</p>' +
                    '<div class="gb-h">// currently</div>' +
                    '<ul class="now-list">' + d.now.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
            }
        },
        {
            id: 'photos', ico: '📷', name: 'PHOTOS', tag: 'a good eye, allegedly', color: '#1f9e98',
            render: function () { return '<p class="gb-lead dim">Real frames go here — Thresher &amp; Rice Raw. Tap one.</p>' + photoGridHTML(); },
            onShow: wirePhotoGrid
        },
        {
            id: 'garage', ico: '🚗', name: 'GARAGE', tag: 'the money pit', color: '#d8472b',
            render: function () {
                var g = DATA.garage;
                return '<div class="garage-stage"><span class="cel" id="cel">⚠ P0420</span>' + CAR_SVG + '<span class="exhaust" id="exhaust"></span></div>' +
                    '<div class="rev-row"><button class="rev-btn" id="revBtn">REV ▲</button>' +
                    '<div class="spent">$<b id="spentNum">0</b><small>spent on this car (do not tell anyone)</small></div></div>' +
                    '<div class="gb-h">// build sheet — tap a line</div>' +
                    '<ul class="mods">' + g.mods.map(function (m) {
                        return '<li class="mod"><div class="mod-part">' + m.part + '<span>' + m.spec + '</span></div><div class="mod-note">' + m.note + '</div></li>';
                    }).join('') + '</ul>';
            },
            onShow: wireGarage
        },
        {
            id: 'quest', ico: '🎲', name: 'QUEST', tag: 'roll for loot', color: '#7b53c9',
            render: function () {
                return '<div class="quest-felt"><div class="die" id="die" role="button" tabindex="0" aria-label="Roll a d20">20</div>' +
                    '<div class="quest-msg" id="questMsg">tap the die.</div></div>' +
                    '<div class="quest-actions"><button class="qbtn" id="rollBtn">Roll d20</button>' +
                    '<button class="qbtn" id="charBtn">Roll a character</button></div>' +
                    '<ul class="roll-log" id="rollLog"></ul><div id="lootSlot"></div>';
            },
            onShow: wireQuest
        },
        {
            id: 'work', ico: '💼', name: 'WORK', tag: 'the professional cartridge', color: '#c7972f',
            render: function () {
                var rows = DATA.work.map(function (w) {
                    return '<li class="xp-item"><div class="xp-date">' + w.date + '</div><div class="xp-role">' + w.role + '</div><div class="xp-org">' + w.org + '</div></li>';
                }).join('');
                return '<p class="gb-lead dim">The serious cartridge. It\'s short on purpose.</p>' +
                    '<ul class="xp">' + rows + '</ul>' +
                    '<div class="gb-h">// contact</div>' +
                    '<div class="contact-row">' +
                    '<a class="cbtn" href="mailto:' + DATA.contact.email + '">✉ Email</a>' +
                    '<a class="cbtn ghost" href="' + DATA.contact.linkedin + '" target="_blank" rel="noopener">in · LinkedIn</a>' +
                    '<button class="cbtn ghost" id="resumeBtn">▤ Résumé</button>' +
                    '</div>';
            },
            onShow: function () {
                var r = byId('resumeBtn');
                if (r) r.addEventListener('click', resumeAction);
            }
        }
    ];

    /* ---------------- photos ---------------- */
    function photoGridHTML() {
        return '<div class="photo-grid">' + DATA.photos.map(function (p, i) {
            var inner = p.src
                ? '<img src="' + p.src + '" alt="' + p.alt + '"><span class="ph-cap">' + p.cap + '</span>'
                : '<span class="ph-empty">' + p.cap + '</span>';
            return '<button class="photo" data-i="' + i + '" aria-label="' + (p.alt || p.cap) + '">' + inner + '</button>';
        }).join('') + '</div>';
    }
    function wirePhotoGrid() {
        Array.prototype.forEach.call(document.querySelectorAll('.photo'), function (b) {
            b.addEventListener('click', function () { openPhoto(parseInt(b.getAttribute('data-i'), 10)); });
        });
    }
    function openPhoto(i) {
        var p = DATA.photos[i]; if (!p) return;
        var body = byId('gameBody');
        var media = p.src
            ? '<img src="' + p.src + '" alt="' + p.alt + '">'
            : '<div class="photo" style="height:55%"><span class="ph-empty">' + p.cap + '</span></div>';
        body.innerHTML = '<div class="photo-viewer">' + media +
            '<div class="pv-cap">' + p.cap + '</div>' +
            '<div class="pv-exif">' + p.exif + '</div>' +
            '<button class="qbtn pv-back" id="pvBack">◀ back to photos</button></div>';
        byId('pvBack').addEventListener('click', function () {
            body.innerHTML = '<p class="gb-lead dim">Real frames go here — Thresher &amp; Rice Raw. Tap one.</p>' + photoGridHTML();
            wirePhotoGrid();
        });
        beep(520, 0.05);
    }

    /* ---------------- garage ---------------- */
    function wireGarage() {
        var target = DATA.garage.spent, num = byId('spentNum');
        if (num) {
            if (reduce) { num.textContent = target.toLocaleString(); }
            else {
                var start = null, dur = 1100;
                var step = function (ts) {
                    if (start === null) start = ts;
                    var t = Math.min(1, (ts - start) / dur);
                    num.textContent = Math.floor(target * (1 - Math.pow(1 - t, 3))).toLocaleString();
                    if (t < 1) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            }
        }
        var revBtn = byId('revBtn'), holdTimer = null;
        function doRev() {
            var car = byId('gti'), ex = byId('exhaust');
            if (car) { car.classList.remove('revving'); void car.offsetWidth; car.classList.add('revving'); }
            if (ex) { ex.classList.remove('puff'); void ex.offsetWidth; ex.classList.add('puff'); }
            beep(95, 0.22, 'sawtooth');
        }
        if (revBtn) {
            revBtn.addEventListener('click', doRev);
            var startHold = function () { holdTimer = setTimeout(function () {
                var cel = byId('cel'); if (cel) cel.classList.add('on');
                toast("<b>P0420</b> — should've left it stock (you won't)");
                markEgg('p0420', 'check engine');
            }, 850); };
            var endHold = function () { clearTimeout(holdTimer); };
            revBtn.addEventListener('pointerdown', startHold);
            revBtn.addEventListener('pointerup', endHold);
            revBtn.addEventListener('pointerleave', endHold);
        }
        Array.prototype.forEach.call(document.querySelectorAll('.mod'), function (m) {
            m.addEventListener('click', function () { m.classList.toggle('open'); beep(440, 0.03); });
        });
    }

    /* ---------------- quest ---------------- */
    function wireQuest() {
        var die = byId('die'), msg = byId('questMsg'), log = byId('rollLog');
        var charClasses = ['Finance Bard', 'Spreadsheet Paladin', 'Tornado-Red Rogue', 'Shutter Druid', 'Caffeinated Sorcerer'];

        function logLine(s) {
            if (!log) return;
            var li = document.createElement('li'); li.textContent = s;
            log.insertBefore(li, log.firstChild);
        }
        function roll() {
            var n;
            if (!sessionStorage.getItem('ub_rolled')) { n = 20; try { sessionStorage.setItem('ub_rolled', '1'); } catch (e) {} }
            else { n = 1 + Math.floor(Math.random() * 20); }
            if (die) {
                die.classList.remove('crit', 'fail', 'rolling'); void die.offsetWidth;
                die.classList.add('rolling'); die.textContent = n;
            }
            beep(300, 0.05); setTimeout(function () { beep(420, 0.05); }, 80);
            if (n === 20) {
                if (die) die.classList.add('crit');
                if (msg) msg.innerHTML = '★ CRITICAL HIT ★';
                logLine('d20 → 20  (natural!)');
                burst(document.querySelector('.quest-felt'));
                showLoot();
                markEgg('nat20', 'critical hit');
            } else if (n === 1) {
                if (die) die.classList.add('fail');
                if (msg) msg.textContent = 'natural 1. the DM smiles.';
                logLine('d20 → 1  (oof)');
                toast('the DM smiles. 🎲');
            } else {
                if (msg) msg.textContent = n >= 15 ? 'solid roll.' : n >= 8 ? 'it\'ll do.' : 'we don\'t talk about that one.';
                logLine('d20 → ' + n);
            }
        }
        function rollChar() {
            var cls = charClasses[Math.floor(Math.random() * charClasses.length)];
            var line = cls + ' · CR 1/2 · INT ' + (13 + Math.floor(Math.random() * 5)) + ' · CHA ' + (11 + Math.floor(Math.random() * 6)) + ' · CON (caffeinated)';
            if (msg) msg.textContent = cls + '!';
            logLine(line);
            beep(660, 0.06);
            markEgg('character', 'rolled a character');
        }
        function showLoot() {
            var slot = byId('lootSlot'); if (!slot) return;
            slot.innerHTML = '<div class="loot"><div class="loot-title">★ LEGENDARY LOOT ★</div>' +
                '<p style="font-family:var(--font-body);font-size:.84rem;margin:.35rem 0">You found <b>Isaac\'s résumé</b>. It\'s surprisingly well-formatted.</p>' +
                '<button class="cbtn" id="lootBtn">Claim résumé</button></div>';
            byId('lootBtn').addEventListener('click', resumeAction);
        }
        if (die) {
            die.addEventListener('click', roll);
            die.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); roll(); } });
        }
        var rb = byId('rollBtn'); if (rb) rb.addEventListener('click', roll);
        var cb = byId('charBtn'); if (cb) cb.addEventListener('click', rollChar);
    }

    function burst(host) {
        if (reduce || !host || !host.animate) return;
        var colors = ['#D81E05', '#1A1A18', '#2f5d3a', '#f3f1e2'];
        for (var i = 0; i < 18; i++) {
            var p = document.createElement('span');
            p.className = 'confetti-pc';
            p.style.left = (8 + Math.random() * 84) + '%';
            p.style.background = colors[i % colors.length];
            host.appendChild(p);
            (function (node) {
                node.animate(
                    [{ transform: 'translateY(0) rotate(0)', opacity: 1 },
                     { transform: 'translateY(130px) rotate(' + (360 + Math.random() * 360) + 'deg)', opacity: 0 }],
                    { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.6,.4,1)' }
                ).onfinish = function () { if (node.parentNode) node.parentNode.removeChild(node); };
            })(p);
        }
    }

    function resumeAction() {
        if (DATA.resumeUrl) { window.open(DATA.resumeUrl, '_blank', 'noopener'); return; }
        toast("Résumé's still being polished — hit <b>✉ Email</b> and it's yours.");
    }

    /* ---------------- engine / state machine ---------------- */
    var state = 'boot', sel = 0, curCart = null, bootTimer = null, typer = null;

    function showState(name) {
        ['boot', 'menu', 'game'].forEach(function (s) { var e = byId(s); if (e) e.hidden = (s !== name); });
        state = name;
    }
    function cartLabelName(c) { return c.name.split('.')[0]; }
    function cartButtonHTML(c, i) {
        return '<button class="gbcart" data-i="' + i + '" style="--cart:' + c.color + '" aria-label="' + c.name + ' — ' + c.tag + '">' +
            CART_SVG +
            '<span class="gbcart-label">' +
            '<span class="gbcart-ico" aria-hidden="true">' + c.ico + '</span>' +
            '<span class="gbcart-name">' + cartLabelName(c) + '</span>' +
            '<span class="gbcart-pub">URE BOY</span>' +
            '</span></button>';
    }
    var SPLIT = 2; // first SPLIT cartridges on the left shelf, the rest on the right
    function buildDeck() {
        var left = byId('rackLeft'), right = byId('rackRight');
        if (left) left.innerHTML = CARTS.slice(0, SPLIT).map(function (c, i) { return cartButtonHTML(c, i); }).join('');
        if (right) right.innerHTML = CARTS.slice(SPLIT).map(function (c, i) { return cartButtonHTML(c, i + SPLIT); }).join('');
        Array.prototype.forEach.call(document.querySelectorAll('.gbcart'), function (b) {
            var i = parseInt(b.getAttribute('data-i'), 10);
            b.addEventListener('mouseenter', function () { sel = i; paintSel(false); });
            b.addEventListener('focus', function () { sel = i; paintSel(false); });
            b.addEventListener('click', function () { sel = i; launch(); });
        });
        var ec = byId('eggCount'); if (ec) ec.textContent = eggLabel();
        paintSel(false);
    }
    function markInserted(idx) {
        Array.prototype.forEach.call(document.querySelectorAll('.gbcart'), function (b) {
            var i = parseInt(b.getAttribute('data-i'), 10);
            var on = (i === idx);
            b.classList.toggle('inserted', on);
            if (on) { b.classList.remove('inserting'); void b.offsetWidth; b.classList.add('inserting'); }
        });
    }
    function paintSel(doFocus) {
        var btns = document.querySelectorAll('.gbcart');
        Array.prototype.forEach.call(btns, function (b) {
            var i = parseInt(b.getAttribute('data-i'), 10);
            var on = (i === sel);
            b.classList.toggle('sel', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
            b.tabIndex = on ? 0 : -1;
            if (on) {
                b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                if (doFocus) b.focus();
            }
        });
        updatePreview();
    }
    function updatePreview() {
        var hp = byId('homePreview'); if (!hp) return;
        var c = CARTS[sel]; if (!c) { hp.textContent = ''; return; }
        hp.innerHTML = '▸ <b>' + c.name + '</b><span class="hp-tag">' + c.tag + ' · press A</span>';
    }
    function moveSel(d) { sel = (sel + d + CARTS.length) % CARTS.length; paintSel(true); beep(520, 0.025); }
    function openMenu() {
        showState('menu');
        Array.prototype.forEach.call(document.querySelectorAll('.gbcart'), function (b) { b.classList.remove('inserted'); });
        paintSel(true);
    }
    function launch() {
        curCart = CARTS[sel];
        var gt = byId('gameTitle'); if (gt) gt.textContent = curCart.ico + ' ' + curCart.name;
        var body = byId('gameBody');
        body.innerHTML = curCart.render();
        body.scrollTop = 0;
        markInserted(sel);
        showState('game');
        if (curCart.onShow) curCart.onShow();
        body.focus();
        beep(660, 0.05);
    }
    function launchSel() { launch(); }

    function runBoot() {
        showState('boot');
        var eye = byId('ledEye');
        if (eye) { eye.classList.add('lit'); eye.classList.add('blink'); setTimeout(function () { eye.classList.remove('blink'); }, 500); }
        var log = byId('bootLog'); if (log) log.textContent = '';
        if (reduce) { if (log) log.textContent = BOOT_LINES.join('\n'); bootTimer = setTimeout(openMenu, 500); return; }
        var i = 0;
        typer = setInterval(function () {
            if (i >= BOOT_LINES.length) { clearInterval(typer); bootTimer = setTimeout(openMenu, 650); return; }
            log.textContent += BOOT_LINES[i] + '\n';
            beep(360 + i * 28, 0.025);
            i++;
        }, 230);
    }
    function endBoot() {
        if (state !== 'boot') return;
        clearTimeout(bootTimer); clearInterval(typer);
        openMenu();
    }

    /* ---------------- input ---------------- */
    function press(a) {
        if (state === 'boot') { if (a === 'a' || a === 'start' || a === 'up' || a === 'down') endBoot(); return; }
        if (state === 'menu') {
            if (a === 'up' || a === 'left') moveSel(-1);
            else if (a === 'down' || a === 'right') moveSel(1);
            else if (a === 'a') launchSel();
            else if (a === 'select') toggleList();
            return;
        }
        if (state === 'game') {
            if (a === 'b' || a === 'start') openMenu();
            else if (a === 'select') toggleList();
        }
    }

    function bindButton(id, action) {
        var b = byId(id);
        if (b) b.addEventListener('click', function () { press(action); });
    }
    bindButton('dUp', 'up'); bindButton('dDown', 'down');
    bindButton('dLeft', 'left'); bindButton('dRight', 'right');
    bindButton('btnA', 'a'); bindButton('btnB', 'b');
    bindButton('btnStart', 'start'); bindButton('btnSelect', 'select');

    var konamiSeq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    var konamiBuf = [];
    function konami(key) {
        konamiBuf.push(key.length === 1 ? key.toLowerCase() : key);
        if (konamiBuf.length > konamiSeq.length) konamiBuf.shift();
        if (konamiBuf.join(',') === konamiSeq.join(',')) {
            konamiBuf.length = 0;
            setTheme('theme-gameboy');
            toast('🎮 <b>GAME BOY MODE</b>');
            markEgg('gameboy', 'game boy mode');
            return true;
        }
        return false;
    }

    window.addEventListener('keydown', function (e) {
        if (konami(e.key)) { e.preventDefault(); return; }
        var k = e.key, a = null;
        if (k === 'ArrowUp') a = 'up';
        else if (k === 'ArrowDown') a = 'down';
        else if (k === 'ArrowLeft') a = 'left';
        else if (k === 'ArrowRight') a = 'right';
        else if (k === 'Enter' || k === ' ') a = 'a';
        else if (k.toLowerCase && k.toLowerCase() === 'a') a = 'a';
        else if (k === 'Escape' || k === 'Backspace') a = 'b';
        else if (k.toLowerCase && k.toLowerCase() === 'b') a = 'b';
        if (!a) return;
        // let a focused control handle its own Enter/Space activation
        var tag = document.activeElement && document.activeElement.tagName;
        if ((k === 'Enter' || k === ' ') && (tag === 'BUTTON' || tag === 'A')) return;
        if ((a === 'up' || a === 'down') && (state === 'menu' || state === 'boot')) e.preventDefault();
        if ((a === 'left' || a === 'right') && state === 'menu') e.preventDefault();
        if (k === 'Backspace') e.preventDefault();
        press(a);
    });

    // click the screen during boot to skip
    var screen = byId('screen');
    if (screen) screen.addEventListener('click', function () { if (state === 'boot') endBoot(); });

    /* ---------------- the eye: track + blink + sleep ---------------- */
    (function () {
        var eye = byId('ledEye'); if (!eye) return;
        var pupil = eye.querySelector('.eye-pupil');
        var idleT = null;
        function wake() {
            eye.classList.remove('asleep');
            clearTimeout(idleT);
            idleT = setTimeout(function () {
                eye.classList.add('asleep');
                markEgg('sleep', 'the eye dozed off');
            }, 30000);
        }
        if (window.matchMedia && window.matchMedia('(pointer:fine)').matches && pupil) {
            window.addEventListener('pointermove', function (e) {
                var r = eye.getBoundingClientRect();
                var ang = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
                pupil.style.transform = 'translate(' + (Math.cos(ang) * 2.4) + 'px,' + (Math.sin(ang) * 1.4) + 'px)';
            });
        }
        ['pointermove', 'keydown', 'pointerdown'].forEach(function (ev) { window.addEventListener(ev, wake, { passive: true }); });
        wake();
    })();

    /* ---------------- toolbar: sound / theme / list ---------------- */
    var soundBtn = byId('soundBtn');
    if (soundBtn) soundBtn.addEventListener('click', function () {
        soundOn = !soundOn;
        soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
        soundBtn.textContent = (soundOn ? '🔊' : '🔇') + ' SOUND';
        if (soundOn) beep(720, 0.08);
    });

    var themes = ['', 'theme-gameboy'], themeIdx = 0;
    function setTheme(name) {
        document.body.classList.remove('theme-gameboy');
        if (name) document.body.classList.add(name);
        themeIdx = themes.indexOf(name); if (themeIdx < 0) themeIdx = 0;
        var tb = byId('themeBtn'); if (tb) tb.setAttribute('aria-pressed', name === 'theme-gameboy' ? 'true' : 'false');
    }
    var themeBtn = byId('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', function () {
        themeIdx = (themeIdx + 1) % themes.length;
        setTheme(themes[themeIdx]);
        if (themes[themeIdx] === 'theme-gameboy') markEgg('gameboy', 'game boy mode');
    });

    /* ---------------- list view (accessible / "skip") ---------------- */
    var listBuilt = false;
    function buildList() {
        if (listBuilt) return; listBuilt = true;
        var d = DATA;
        byId('list').innerHTML =
            '<button class="list-back" id="listBack">◀ back to URE BOY</button>' +
            '<h2>About</h2><p>' + d.about.lead + '</p><p>' + d.about.lead2 + '</p>' +
            '<h2>Currently</h2><ul>' + d.about.now.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
            '<h2>Garage — MK8 GTI</h2><ul>' + d.garage.mods.map(function (m) { return '<li><b>' + m.part + '</b> (' + m.spec + ') — ' + m.note + '</li>'; }).join('') + '</ul>' +
            '<h2>Work</h2><ul>' + d.work.map(function (w) { return '<li><b>' + w.role + '</b> — ' + w.org + ' <em>(' + w.date + ')</em></li>'; }).join('') + '</ul>' +
            '<h2>Contact</h2><p><a href="mailto:' + d.contact.email + '">' + d.contact.email + '</a> · <a href="' + d.contact.linkedin + '" rel="me">LinkedIn</a></p>' +
            '<p style="color:#8a8a82;font-size:.85rem">Previous version of this site is archived at <a href="/behind-the-lens/">/behind-the-lens/</a>.</p>';
        byId('listBack').addEventListener('click', function () { toggleList(false); });
    }
    function toggleList(force) {
        var on = (typeof force === 'boolean') ? force : !document.body.classList.contains('list-mode');
        var lb = byId('listBtn');
        if (on) {
            buildList();
            var lv = byId('list'); lv.hidden = false; lv.setAttribute('tabindex', '-1');
            document.body.classList.add('list-mode'); window.scrollTo(0, 0);
            var bk = byId('listBack'); if (bk) bk.focus(); else lv.focus();
            if (lb) lb.setAttribute('aria-pressed', 'true');
        } else {
            document.body.classList.remove('list-mode'); byId('list').hidden = true;
            if (lb) { lb.setAttribute('aria-pressed', 'false'); lb.focus(); }
        }
    }
    var listBtn = byId('listBtn'); if (listBtn) listBtn.addEventListener('click', function () { toggleList(); });
    var skip = document.querySelector('.skip-link');
    if (skip) skip.addEventListener('click', function (e) { e.preventDefault(); toggleList(true); });

    /* ---------------- go ---------------- */
    buildDeck();
    runBoot();
})();
