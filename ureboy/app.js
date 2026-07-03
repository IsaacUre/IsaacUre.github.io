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
        "QUEST ROM  8 MEG ... ok",
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
        '<path class="cart-body" d="M14 6 H85 V13 H90 Q96 13 96 19 V104 Q96 110 90 110 H14 Q8 110 8 104 V12 Q8 6 14 6 Z"/>' +
        '<g stroke="rgba(0,0,0,.16)" stroke-width="2" stroke-linecap="round">' +
        '<line x1="16" y1="18" x2="16" y2="38"/><line x1="20" y1="18" x2="20" y2="38"/><line x1="24" y1="18" x2="24" y2="38"/><line x1="28" y1="18" x2="28" y2="38"/>' +
        '<line x1="74" y1="22" x2="74" y2="41"/><line x1="78" y1="22" x2="78" y2="41"/><line x1="82" y1="22" x2="82" y2="41"/><line x1="86" y1="22" x2="86" y2="41"/>' +
        '</g>' +
        '<rect x="33" y="18" width="34" height="22" rx="9" fill="rgba(0,0,0,.05)" stroke="rgba(0,0,0,.12)" stroke-width="1"/>' +
        '<path d="M45 99 H55 L50 106 Z" fill="rgba(0,0,0,.22)"/>' +
        '<path class="cart-edge" d="M14 6 H85 V13 H90 Q96 13 96 19 V104 Q96 110 90 110 H14 Q8 110 8 104 V12 Q8 6 14 6 Z" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1.5"/>' +
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
            id: 'quest', ico: '🎲', name: 'QUEST', tag: 'a whole pocket CRPG', color: '#7b53c9',
            fs: true,   // takes over the entire LCD — no game bar
            render: function () {
                return '<div class="uq-holder" id="uqHolder"><div class="uq-boot">READING QUEST ROM<span class="cl-cur">_</span></div></div>';
            },
            onShow: function () {
                var holder = byId('uqHolder');
                var boot = function () { if (window.UreQuest && holder) window.UreQuest.mount(holder, QUEST_API); };
                if (window.UreQuest) { boot(); return; }
                var s = document.createElement('script');
                s.src = '/ureboy/quest.js';
                s.onload = boot;
                s.onerror = function () { if (holder) holder.innerHTML = '<div class="uq-boot">ROM READ ERROR.<br>blow into the cartridge<br>and re-insert it.</div>'; };
                document.head.appendChild(s);
            },
            onHide: function () { if (window.UreQuest) window.UreQuest.unmount(); },
            input: function (a) { return window.UreQuest ? window.UreQuest.input(a) : false; }
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

    /* ---------------- quest (URE QUEST — the CRPG lives in /ureboy/quest.js) ----------------
       The cartridge lazy-loads the ROM and hands it this little API so the game can
       ring the console's bell without reaching into our closure. */
    var QUEST_API = {
        toast: toast,
        markEgg: markEgg,
        soundOn: function () { return soundOn; },
        reduced: reduce,
        eject: function () { openMenu(); }
    };

    function resumeAction() {
        if (DATA.resumeUrl) { window.open(DATA.resumeUrl, '_blank', 'noopener'); return; }
        toast("Résumé's still being polished — hit <b>✉ Email</b> and it's yours.");
    }

    /* ---------------- engine / state machine ---------------- */
    var state = 'boot', sel = 0, curCart = null, bootTimer = null, typer = null;
    var inserting = false, dockedIdx = null;
    var ejectHud = null, ejectChute = null, ejectBeam = null, ejectLine = null, ejectHit = null;
    var ejectNear = false, ejectHinted = false, ejX = 0, ejY = 0, ejRaf = 0;

    function showState(name) {
        ['boot', 'menu', 'game'].forEach(function (s) { var e = byId(s); if (e) e.hidden = (s !== name); });
        state = name;
        updateEject();
    }
    /* the eject pull is live only while a cartridge is actually loaded */
    function ejectArmed() { return state === 'game' && !inserting; }
    function finePointer() { return window.matchMedia && window.matchMedia('(pointer:fine)').matches; }
    // size + place the top highlight onto the docked cartridge; returns its centre-x
    function placeEjectChute() {
        var dc = document.querySelector('#cartDock .dock-cart');
        var r = dc && dc.getBoundingClientRect();
        var cx, w;
        if (r && r.width > 4) { cx = r.left + r.width / 2; w = r.width; }
        else { cx = window.innerWidth / 2; w = 96; }
        ejectChute.style.left = (cx - w / 2) + 'px';
        ejectChute.style.width = w + 'px';
        if (ejectBeam) ejectBeam.setAttribute('viewBox', '0 0 ' + window.innerWidth + ' ' + window.innerHeight);
        return cx;
    }
    function moveEjectHud() {
        if (!ejectHud || !ejectNear || !ejectArmed()) return;
        var ax = parseFloat(ejectChute.style.left || 0) + parseFloat(ejectChute.style.width || 0) / 2;
        ejectLine.setAttribute('x1', ax); ejectLine.setAttribute('y1', 6);
        ejectLine.setAttribute('x2', ejX); ejectLine.setAttribute('y2', ejY);
        ejectHit.style.transform = 'translate(' + ejX + 'px,' + ejY + 'px)';
        byId('ejectFollow').style.transform = 'translate(' + ejX + 'px,' + (ejY + 17) + 'px) translate(-50%, 0)';
    }
    function updateEject() {
        if (!ejectHud) return;
        var armed = ejectArmed();
        if (curCart) ejectHud.style.setProperty('--eject-accent', curCart.color);
        if (!armed) { ejectNear = false; ejectHud.classList.remove('active', 'hint'); return; }
        if (!ejectHinted && !reduce && finePointer()) {        // first cartridge on a mouse: pulse the chute to advertise it
            ejectHinted = true;
            placeEjectChute();
            ejectHud.classList.add('hint');
            setTimeout(function () { ejectHud.classList.remove('hint'); }, 1300);
        }
        ejectHud.classList.toggle('active', ejectNear);
        if (ejectNear) moveEjectHud();
    }
    function cartLabelName(c) { return c.name.split('.')[0]; }
    function cartInnerHTML(c) {
        return CART_SVG +
            '<span class="gbcart-label">' +
            '<span class="gbcart-ico" aria-hidden="true">' + c.ico + '</span>' +
            '<span class="gbcart-name">' + cartLabelName(c) + '</span>' +
            '<span class="gbcart-pub">URE BOY</span>' +
            '</span>';
    }
    function cartButtonHTML(c, i) {
        return '<button class="gbcart" data-i="' + i + '" style="--cart:' + c.color + '" aria-label="' + c.name + ' — ' + c.tag + '">' +
            cartInnerHTML(c) + '</button>';
    }
    var SPLIT = 2; // first SPLIT cartridges on the left shelf, the rest on the right
    function buildDeck() {
        var left = byId('rackLeft'), right = byId('rackRight');
        if (left) left.innerHTML = CARTS.slice(0, SPLIT).map(function (c, i) { return cartButtonHTML(c, i); }).join('');
        if (right) right.innerHTML = CARTS.slice(SPLIT).map(function (c, i) { return cartButtonHTML(c, i + SPLIT); }).join('');
        Array.prototype.forEach.call(document.querySelectorAll('.gbcart'), function (b) {
            var i = parseInt(b.getAttribute('data-i'), 10);
            b.addEventListener('mouseenter', function () { if (inserting) return; sel = i; paintSel(false); });
            b.addEventListener('focus', function () { if (inserting) return; sel = i; paintSel(false); });
            b.addEventListener('click', function () { if (inserting) return; sel = i; paintSel(false); insertCart(i); });
        });
        var ec = byId('eggCount'); if (ec) ec.textContent = eggLabel();
        paintSel(false);
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
    function reallyOpenMenu() {
        dockedIdx = null;
        showState('menu');
        paintSel(true);
    }
    function openMenu() {
        if (inserting) return;
        if (state === 'game' && curCart && curCart.onHide) curCart.onHide();
        if (dockedIdx === null) { reallyOpenMenu(); return; }
        if (reduce) { var di = dockedIdx; clearDock(); setVacant(di, false); reallyOpenMenu(); return; }
        inserting = true; setBusy(true);
        var idx = dockedIdx;
        var oldDc = byId('cartDock').querySelector('.dock-cart');
        // capture at the settled scale before the camera moves
        var data = { idx: idx, from: fullyOutRect(localRect(oldDc)), to: localRect(getCartBtn(idx)) };
        showState('menu');                 // reveal home behind the ejecting cart
        cameraOut();
        setTimeout(function () {
            ejectDock(data, function () {
                cameraIn();
                inserting = false; setBusy(false);
                paintSel(true);
            });
        }, CAM_LEAD);
    }

    function renderGame(idx) {
        if (curCart && curCart.onHide && curCart !== CARTS[idx]) curCart.onHide();
        sel = idx;
        curCart = CARTS[idx];
        var gt = byId('gameTitle'); if (gt) gt.textContent = curCart.ico + ' ' + curCart.name;
        var gameSec = byId('game'); if (gameSec) gameSec.classList.toggle('fs', !!curCart.fs);
        var body = byId('gameBody');
        body.innerHTML = curCart.render();
        body.scrollTop = 0;
        showState('game');
        if (curCart.onShow) curCart.onShow();
        try { body.focus({ preventScroll: true }); } catch (e) { body.focus(); }
        beep(660, 0.05);
    }

    /* ---------------- cartridge insert / eject micro-interaction ---------------- */
    function setBusy(on) { document.body.classList.toggle('cart-busy', on); updateEject(); }
    function getCartBtn(idx) { return document.querySelector('.gbcart[data-i="' + idx + '"]'); }
    function setVacant(idx, on) { var b = getCartBtn(idx); if (b) b.classList.toggle('vacant', on); }

    /* ---- camera pull-back: scale the whole scene out during a swap, back in after ---- */
    var sceneEl = document.querySelector('.stage');
    var camScale = 1;
    var CAM_OUT = 0.85;       // peak pull-back (subtle); tune here
    var CAM_OUT_MS = 340;     // pull-back duration
    var CAM_IN_MS = 380;      // pull-in duration
    var CAM_LEAD = 80;        // ms the zoom leads the flight
    function setSceneOrigin() {
        if (!sceneEl) return;
        var ub = byId('ureboy'); if (!ub) return;
        var s = sceneEl.getBoundingClientRect(), u = ub.getBoundingClientRect();
        // origin centered on the console so the pull-back is symmetric about it
        sceneEl.style.transformOrigin = (u.left + u.width / 2 - s.left) + 'px ' + (u.top + u.height / 2 - s.top) + 'px';
    }
    function cameraOut() {
        if (reduce || !sceneEl || camScale === CAM_OUT) return;
        setSceneOrigin();
        camScale = CAM_OUT;
        sceneEl.style.willChange = 'transform';
        sceneEl.style.transition = 'transform ' + CAM_OUT_MS + 'ms cubic-bezier(.4,0,.2,1)';
        sceneEl.style.transform = 'scale(' + CAM_OUT + ')';
    }
    function cameraIn() {
        if (reduce || !sceneEl || camScale === 1) return;
        camScale = 1;
        sceneEl.style.transition = 'transform ' + CAM_IN_MS + 'ms cubic-bezier(.4,0,.25,1)';
        sceneEl.style.transform = 'scale(1)';
        setTimeout(function () { if (camScale === 1) sceneEl.style.willChange = ''; }, CAM_IN_MS + 60);
    }
    // an element's rect normalised to scene-LOCAL (scale-1) coords. S is read from the live rendered
    // scale (bounding width / layout width), so this is correct at any zoom — even mid-transition.
    // The flying clone lives inside .stage, so local coords keep it aligned with the (also-scaled) shelf/dock.
    function localRect(el) {
        var er = el.getBoundingClientRect();
        if (!sceneEl) return { left: er.left, top: er.top, width: er.width, height: er.height };
        var sr = sceneEl.getBoundingClientRect();
        var S = sceneEl.offsetWidth ? (sr.width / sceneEl.offsetWidth) : 1;
        return { left: (er.left - sr.left) / S, top: (er.top - sr.top) / S, width: er.width / S, height: er.height / S };
    }

    // Animate a clone of a cartridge between two scene-local rects, arcing through the
    // air (transform-only) and scaling shelf-size <-> inserted-size along the way.
    // The clone is parented to .stage so the camera zoom scales it with everything else.
    function flyBetween(fromR, toR, opts, done) {
        var fly = document.createElement('div');
        fly.className = 'cart-fly';
        fly.style.left = fromR.left + 'px';
        fly.style.top = fromR.top + 'px';
        fly.style.width = fromR.width + 'px';
        fly.style.height = fromR.height + 'px';
        fly.style.setProperty('--cart', opts.cart.color);
        fly.innerHTML = cartInnerHTML(opts.cart);
        (sceneEl || document.body).appendChild(fly);

        var dx = (toR.left + toR.width / 2) - (fromR.left + fromR.width / 2);
        var dy = (toR.top + toR.height / 2) - (fromR.top + fromR.height / 2);
        var sc = fromR.width ? (toR.width / fromR.width) : 1;   // shelf-size -> inserted-size (or reverse)
        var peakY = Math.min(0, dy) - opts.lift;                // arc up above both ends
        function S(w) { return (1 + (sc - 1) * w).toFixed(4); } // scale at travel-weight w (0..1)
        var frames;
        if (opts.insert) {
            // grow weighted toward the second half (w ~ p^2): starts shelf-size, peaks at the slot
            frames = [
                { offset: 0,   transform: 'translate(0px,0px) rotate(0deg) scale(' + S(0) + ')', easing: 'cubic-bezier(.4,0,.5,1)' },
                { offset: .5,  transform: 'translate(' + (dx * 0.55) + 'px,' + peakY + 'px) rotate(-12deg) scale(' + S(0.25) + ')', easing: 'cubic-bezier(.4,0,.55,1)' },
                { offset: .82, transform: 'translate(' + dx + 'px,' + (dy - 14) + 'px) rotate(3deg) scale(' + S(0.80) + ')', easing: 'cubic-bezier(.3,0,.2,1)' },
                { offset: .93, transform: 'translate(' + dx + 'px,' + (dy + 7) + 'px) rotate(0deg) scale(' + S(0.97) + ')', easing: 'ease-out' },
                { offset: 1,   transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(0deg) scale(' + S(1) + ')' }
            ];
        } else {
            // eject: pop up out of the slot, then arc back to the shelf, shrinking weighted toward the first half
            frames = [
                { offset: 0,   transform: 'translate(0px,0px) rotate(0deg) scale(' + S(0) + ')', easing: 'cubic-bezier(.4,0,.4,1)' },
                { offset: .22, transform: 'translate(0px,' + (-opts.lift * 0.5) + 'px) rotate(0deg) scale(' + S(0.44) + ')', easing: 'cubic-bezier(.4,0,.5,1)' },
                { offset: .6,  transform: 'translate(' + (dx * 0.5) + 'px,' + peakY + 'px) rotate(-6deg) scale(' + S(0.84) + ')', easing: 'cubic-bezier(.45,0,.55,1)' },
                { offset: 1,   transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(0deg) scale(' + S(1) + ')' }
            ];
        }
        var anim = fly.animate(frames, { duration: opts.dur, delay: opts.delay || 0, fill: 'both' });
        anim.onfinish = function () { done(fly); };
        return fly;
    }

    function prepDock(idx) {
        var dock = byId('cartDock'); if (!dock) return null;
        dock.innerHTML = '<div class="dock-cart hidden" style="--cart:' + CARTS[idx].color + '">' + cartInnerHTML(CARTS[idx]) + '</div>';
        dock.classList.add('docked');
        dockedIdx = idx;
        setVacant(idx, true);
        return dock.querySelector('.dock-cart');
    }
    function revealDock() {
        var dc = byId('cartDock') && byId('cartDock').querySelector('.dock-cart');
        if (!dc) return;
        dc.classList.remove('hidden');
        dc.classList.add('seating');
        setTimeout(function () { if (dc) dc.classList.remove('seating'); }, 480);
    }
    // at rest the cart is fully buried (translateY 0%); fully-out is one full height higher (translateY -100%)
    var HIDE_FRAC = 1.0;
    // the "fully out" box (cart 100% above the slot) given the resting dock rect
    function fullyOutRect(restR) {
        return { left: restR.left, top: restR.top - HIDE_FRAC * restR.height, width: restR.width, height: restR.height };
    }
    function clearDock() {
        var dock = byId('cartDock'); if (dock) { dock.innerHTML = ''; dock.classList.remove('docked'); }
        dockedIdx = null;
    }
    function dockInstant(idx) {
        var dock = byId('cartDock'); if (!dock) return;
        dock.innerHTML = '<div class="dock-cart" style="--cart:' + CARTS[idx].color + '">' + cartInnerHTML(CARTS[idx]) + '</div>';
        dock.classList.add('docked');
        dockedIdx = idx; setVacant(idx, true);
    }

    function flashScreen() {
        if (reduce) return;
        var s = byId('screen'); if (!s) return;
        s.classList.remove('surge'); void s.offsetWidth; s.classList.add('surge');
        setTimeout(function () { s.classList.remove('surge'); }, 360);
    }
    function seatReact() {
        if (reduce) return;
        var u = byId('ureboy');
        if (u) { u.classList.remove('shake'); void u.offsetWidth; u.classList.add('shake'); setTimeout(function () { u.classList.remove('shake'); }, 280); }
        flashScreen();
        beep(150, 0.05, 'square'); setTimeout(function () { beep(90, 0.12, 'square'); }, 70);
    }
    function cartBoot(idx, done) {
        if (reduce) { done(); return; }
        var c = CARTS[idx], load = byId('cartLoad');
        if (load) {
            load.innerHTML =
                '<div class="cl-eye" aria-hidden="true"><svg viewBox="0 0 48 48" shape-rendering="crispEdges">' +
                '<g class="eye-ink" fill="currentColor"><rect x="22" y="12" width="14" height="2"/><rect x="16" y="14" width="24" height="2"/><rect x="14" y="16" width="28" height="2"/><rect x="8" y="18" width="24" height="2"/><rect x="38" y="18" width="6" height="2"/><rect x="42" y="20" width="4" height="2"/><rect x="44" y="22" width="2" height="2"/><rect x="4" y="24" width="4" height="2"/><rect x="46" y="24" width="2" height="2"/><rect x="2" y="26" width="2" height="2"/><rect x="0" y="28" width="2" height="2"/><rect x="38" y="28" width="10" height="2"/><rect x="6" y="30" width="12" height="2"/><rect x="32" y="30" width="8" height="2"/><rect x="14" y="32" width="22" height="2"/><rect x="20" y="34" width="10" height="2"/></g>' +
                '<g class="eye-pupil" fill="currentColor"><rect x="8" y="20" width="8" height="2"/><rect x="18" y="20" width="14" height="2"/><rect x="6" y="22" width="8" height="2"/><rect x="18" y="22" width="8" height="2"/><rect x="30" y="22" width="6" height="2"/><rect x="18" y="24" width="14" height="2"/><rect x="20" y="26" width="12" height="2"/><rect x="20" y="28" width="10" height="2"/><g class="eye-glint"><rect x="16" y="20" width="2" height="2"/><rect x="14" y="22" width="4" height="2"/></g></g></svg></div>' +
                '<div class="cl-word">URE<b>BOY</b></div>' +
                '<div class="cl-load">&#9656; LOADING ' + c.name + '<span class="cl-cur">_</span></div>';
            load.hidden = false;
            requestAnimationFrame(function () { load.classList.add('show'); });
        }
        setTimeout(function () {
            if (load) {
                load.classList.remove('show');
                setTimeout(function () { load.hidden = true; }, 160);
            }
            done();
        }, 300);
    }

    function insertCart(idx) {
        if (inserting) return;
        if (state === 'boot') { clearTimeout(bootTimer); clearInterval(typer); }   // clicking a cart skips the intro boot
        if (idx === dockedIdx && state === 'game') return;                          // already playing it
        inserting = true; setBusy(true);

        if (reduce) {
            if (dockedIdx !== null && dockedIdx !== idx) { var di = dockedIdx; clearDock(); setVacant(di, false); }
            dockInstant(idx);
            renderGame(idx);
            inserting = false; setBusy(false);
            return;
        }

        // capture all coordinates at the settled (scale-1) zoom, BEFORE pulling the camera back
        var swap = (dockedIdx !== null && dockedIdx !== idx);
        var insertFrom = localRect(getCartBtn(idx));
        var insertTarget, ejectData = null;
        if (swap) {
            var oldDc = byId('cartDock').querySelector('.dock-cart');
            insertTarget = fullyOutRect(localRect(oldDc));        // the slot position is the same for any cart
            ejectData = { idx: dockedIdx, from: fullyOutRect(localRect(oldDc)), to: localRect(getCartBtn(dockedIdx)) };
        } else {
            insertTarget = fullyOutRect(localRect(prepDock(idx))); // create + measure the dock at scale 1
        }

        var finish = function () { renderGame(idx); cameraIn(); inserting = false; setBusy(false); };
        var flyIn = function (lead) {
            flyBetween(insertFrom, insertTarget, { cart: CARTS[idx], lift: 120, dur: 640, insert: true, delay: lead }, function (fly) {
                revealDock();
                if (fly.parentNode) fly.parentNode.removeChild(fly);
                seatReact();
                cartBoot(idx, finish);
            });
        };

        cameraOut();   // one continuous pull-back covering the whole sequence
        if (swap) {
            // eject the old cart, then insert the new one — camera stays out across both
            setTimeout(function () { ejectDock(ejectData, function () { prepDock(idx); flyIn(0); }); }, CAM_LEAD);
        } else {
            flyIn(CAM_LEAD);   // the flight's own delay lets the zoom lead it
        }
    }

    // eject the docked cart using pre-captured scene-local rects; pops it out of the slot, then arcs it home
    function ejectDock(data, done) {
        var idx = data.idx;
        var dock = byId('cartDock');
        var dc = dock && dock.querySelector('.dock-cart');
        if (!dc) { clearDock(); setVacant(idx, false); if (done) done(); return; }
        dc.classList.remove('seating');
        dc.classList.add('unseating');                          // pop the cart up out of the slot
        flashScreen();
        beep(120, 0.06, 'square');
        setTimeout(function () {
            dc.style.visibility = 'hidden';
            flyBetween(data.from, data.to, { cart: CARTS[idx], lift: 96, dur: 440, insert: false }, function (fly) {
                if (fly.parentNode) fly.parentNode.removeChild(fly);
                clearDock();
                setVacant(idx, false);
                if (done) done();
            });
        }, 190);
    }

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
        if (inserting) return;
        if (state === 'boot') { if (a === 'a' || a === 'start' || a === 'up' || a === 'down') endBoot(); return; }
        if (state === 'menu') {
            if (a === 'up' || a === 'left') moveSel(-1);
            else if (a === 'down' || a === 'right') moveSel(1);
            else if (a === 'a') insertCart(sel);
            else if (a === 'select') toggleList();
            return;
        }
        if (state === 'game') {
            if (curCart && curCart.input && curCart.input(a)) return;   // the cartridge ate it
            if (a === 'b' || a === 'start') openMenu();
            else if (a === 'select') toggleList();
        }
    }

    function bindButton(id, action) {
        var b = byId(id);
        if (b) b.addEventListener('click', function () { press(action); });
    }
    // d-pad buttons auto-repeat while held (walking across a map one tap at a time is cruel)
    function bindHold(id, action) {
        var b = byId(id); if (!b) return;
        var t = null, iv = null, fromPointer = false;
        function stop() { clearTimeout(t); clearInterval(iv); t = iv = null; }
        b.addEventListener('pointerdown', function () {
            fromPointer = true; press(action);
            stop();
            t = setTimeout(function () { iv = setInterval(function () { press(action); }, 110); }, 300);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, stop); });
        b.addEventListener('click', function () {         // keyboard activation still works;
            if (fromPointer) { fromPointer = false; return; } // pointer taps already fired on pointerdown
            press(action);
        });
    }
    bindHold('dUp', 'up'); bindHold('dDown', 'down');
    bindHold('dLeft', 'left'); bindHold('dRight', 'right');
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
        // a fullscreen cartridge (the QUEST ROM) owns the arrows — don't scroll the page under it
        if (state === 'game' && curCart && curCart.fs && (a === 'up' || a === 'down' || a === 'left' || a === 'right' || k === ' ')) e.preventDefault();
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
        // blink on its own every few seconds (skip while dozing or reduced-motion)
        if (!reduce) (function blinkLoop() {
            setTimeout(function () {
                if (!eye.classList.contains('asleep')) {
                    eye.classList.add('blink');
                    setTimeout(function () { eye.classList.remove('blink'); }, 440);
                }
                blinkLoop();
            }, 3500 + Math.random() * 4500);
        })();
    })();

    /* the big home-screen eye blinks on its own too */
    (function () {
        if (reduce) return;
        var he = document.querySelector('.home-eye'); if (!he) return;
        (function blinkLoop() {
            setTimeout(function () {
                he.classList.add('blink');
                setTimeout(function () { he.classList.remove('blink'); }, 440);
                blinkLoop();
            }, 4200 + Math.random() * 5000);
        })();
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
            '<h2>Quest</h2><p>The QUEST cartridge holds <b>URE QUEST: The Check-Engine Prophecy</b> — a tiny D&amp;D-flavored RPG about lifting a check-engine curse. It needs the console view (and is better with SOUND on).</p>' +
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

    /* ---------------- eject pull: top highlight + tether to cursor + click to eject ---------------- */
    ejectHud = byId('ejectHud'); ejectChute = byId('ejectChute');
    ejectBeam = byId('ejectBeam'); ejectLine = byId('ejectLine'); ejectHit = byId('ejectHit');
    var EJ_IN = 160, EJ_OUT = 210;   // pointer enters the pull zone below 160px, leaves past 210px
    if (ejectHit) {
        ejectHit.addEventListener('click', function () {
            if (!ejectArmed()) return;
            ejectNear = false; ejectHud.classList.remove('active');
            openMenu();                                 // pop the cart out and return to the menu
        });
    }
    window.addEventListener('pointermove', function (e) {
        ejX = e.clientX; ejY = e.clientY;
        if (!ejectArmed()) { if (ejectNear) { ejectNear = false; updateEject(); } return; }
        if (e.clientY <= EJ_IN) {
            if (!ejectNear) { ejectNear = true; placeEjectChute(); updateEject(); }
        } else if (e.clientY > EJ_OUT) {
            if (ejectNear) { ejectNear = false; updateEject(); }
        }
        if (ejectNear && !ejRaf) ejRaf = requestAnimationFrame(function () { ejRaf = 0; moveEjectHud(); });
    }, { passive: true });
    window.addEventListener('resize', function () { if (ejectNear) placeEjectChute(); });
    updateEject();

    /* ---------------- go ---------------- */
    buildDeck();
    runBoot();
})();
