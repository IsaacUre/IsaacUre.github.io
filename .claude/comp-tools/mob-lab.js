/* mob-lab — a bench for the Minecraft mob animations.

   Load it into a page already running the game (`/comp/?dev=mc&mcdev=kit`) and
   it gives you three things the eye alone cannot give you:

     __lab.place(kind, opts)   stand one mob in front of the camera, posed
     __lab.range(kind, n)      how far every part of it TRAVELS over n frames —
                               the honest answer to "is that animating?", taken
                               off the built vertex buffer rather than off the
                               timers that feed it
     __lab.sheet(name, cells)  a contact sheet of renders, POSTed to serve.js,
                               because the preview pane will not always composite

   Dotfolder: committed, never published. Usage from the console:
     __lab.boot(); __lab.place('pig'); __lab.shot('pig.png');
*/
(function () {
    'use strict';
    var m = window.__mc;
    if (!m) { console.warn('mob-lab: no __mc (open the game with ?dev=mc first)'); return; }

    var lab = window.__lab = {
        m: m,
        step: function (n) { for (var i = 0; i < (n || 1); i++) m.step(16.7); return this; },
        /* rAF does not run when the preview pane is not compositing, so the world
           never finishes booting on its own — drive it by hand */
        boot: function () {
            var n = 0;
            while (!m.state().ready && n < 8000) { m.step(16.7); n++; }
            return n;
        },
        // a flat, lit floor with headroom, so nothing under test falls in a hole
        flat: function (r) {
            r = r || 16;
            var s = m.state(), bx = Math.floor(s.px), by = Math.floor(s.py) - 1, bz = Math.floor(s.pz);
            for (var x = -r; x <= r; x++) for (var z = -r; z <= r; z++) {
                m.setB(bx + x, by, bz + z, 1);
                for (var y = 1; y <= 8; y++) m.setB(bx + x, by + y, bz + z, 0);
            }
            m.relightBox(bx, bz);
            for (var cx = -2; cx <= 2; cx++) for (var cz = -2; cz <= 2; cz++) m.remesh((bx >> 4) + cx, (bz >> 4) + cz);
            return this;
        },
        clear: function () { m.chat('/kill @e'); return this; },
        place: function (k, o) {
            o = o || {};
            if (!o.keep) this.clear();
            var s = m.state(), f = m.spawnMob(k, 0, 0, o.sz);
            f.x = s.px + (o.dx || 0); f.z = s.pz - (o.dz == null ? 3.2 : o.dz);
            f.y = Math.floor(s.py) + (o.dy || 0); f.vy = 0; f.ground = true;
            f.yaw = o.yaw == null ? 0.6 : o.yaw;
            f.wd = null; f.wt = 999;                 // hold still unless the test says otherwise
            if (o.baby) f.baby = 20;
            /* Stand it on a plinth. Not for looks: a camera tipped down at a
               short mob puts a block under the crosshair, and the game draws its
               selection wireframe right across the subject. */
            if (o.plinth !== false) {
                var bx = Math.floor(f.x), bz = Math.floor(f.z), by = Math.floor(f.y);
                for (var px = -1; px <= 1; px++) for (var pz = -1; pz <= 1; pz++) m.setB(bx + px, by, bz + pz, 4);
                m.relightBox(bx, bz); m.remesh(bx >> 4, bz >> 4);
                for (var cx = -1; cx <= 1; cx++) for (var cz = -1; cz <= 1; cz++) m.remesh((bx >> 4) + cx, (bz >> 4) + cz);
                f.y = by + 1;
            }
            // frame it: aim the camera at the middle of whatever we just stood there
            var dz = (o.dz == null ? 3.2 : o.dz);
            var pitch = o.pitch != null ? o.pitch : Math.atan2((s.py + 1.62) - (f.y + f.h * 0.55), dz);
            m.look(o.camYaw || 0, pitch);
            if (o.after) o.after(f);
            this.step(o.steps == null ? 24 : o.steps);
            if (o.then) o.then(f);
            return f;
        },
        // the widest excursion each part makes over n frames, in blocks
        range: function (k, n) {
            var lo = null, hi = null, g, i, j;
            for (var t = 0; t < (n || 120); t++) {
                g = m.mobGeo(k); if (!g) return null;
                if (!lo) { lo = []; hi = []; for (i = 0; i < g.parts.length; i++) { lo.push([9, 9, 9]); hi.push([-9, -9, -9]); } }
                for (i = 0; i < g.parts.length; i++) for (j = 0; j < 3; j++) {
                    var v = g.parts[i].c[j];
                    if (v < lo[i][j]) lo[i][j] = v;
                    if (v > hi[i][j]) hi[i][j] = v;
                }
                this.step(1);
            }
            g = m.mobGeo(k);
            var out = {};
            for (i = 0; i < g.parts.length; i++) {
                var d = 0;
                for (j = 0; j < 3; j++) d += hi[i][j] - lo[i][j];
                out[g.parts[i].role] = Math.round(d * 1e3) / 1e3;
            }
            return out;
        },
        cv: function () { return document.querySelector('.mc-cv'); },
        shot: function (name, scale) {
            scale = scale || 3;
            var src = this.cv(), c = document.createElement('canvas');
            c.width = src.width * scale; c.height = src.height * scale;
            var x = c.getContext('2d'); x.imageSmoothingEnabled = false;
            x.drawImage(src, 0, 0, c.width, c.height);
            return this.post(name, c);
        },
        /* Several renders side by side in one image, cropped to the middle where
           the subject stands: one file to look at instead of twelve. */
        sheet: function (name, cells, o) {
            o = o || {};
            var cols = o.cols || 4, cw = o.cw || 260, ch = o.ch || 260;
            var zx = o.zx == null ? 0.36 : o.zx, zy = o.zy == null ? 0.05 : o.zy;
            var zw = o.zw == null ? 0.28 : o.zw, zh = o.zh == null ? 0.86 : o.zh;
            var rows = Math.ceil(cells.length / cols);
            var out = document.createElement('canvas');
            out.width = cols * cw; out.height = rows * ch;
            var g = out.getContext('2d'); g.imageSmoothingEnabled = false;
            g.fillStyle = '#101018'; g.fillRect(0, 0, out.width, out.height);
            var src = this.cv();
            for (var i = 0; i < cells.length; i++) {
                cells[i].run();
                var sw = Math.round(src.width * zw), sh = Math.round(src.height * zh);
                var sx = Math.round(src.width * zx), sy = Math.round(src.height * zy);
                g.drawImage(src, sx, sy, sw, sh, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
                g.fillStyle = 'rgba(0,0,0,0.7)';
                g.fillRect((i % cols) * cw, Math.floor(i / cols) * ch, cw, 16);
                g.fillStyle = '#fff'; g.font = '12px monospace';
                g.fillText(cells[i].label, (i % cols) * cw + 4, Math.floor(i / cols) * ch + 12);
            }
            return this.post(name, out);
        },
        // a strip of consecutive frames of ONE subject: the flipbook that proves motion
        strip: function (name, setup, frames, every, o) {
            o = o || {};
            setup();
            var cells = [];
            for (var i = 0; i < (frames || 6); i++) {
                (function (n) { cells.push({ label: 't+' + (n * (every || 4)), run: function () { lab.step(every || 4); } }); })(i);
            }
            return this.sheet(name, cells, o);
        },
        post: function (name, canvas) {
            return fetch('/__shot/' + name, { method: 'POST', body: canvas.toDataURL('image/png') })
                .then(function (r) { return r.text(); });
        }
    };
    console.log('mob-lab ready');
})();
