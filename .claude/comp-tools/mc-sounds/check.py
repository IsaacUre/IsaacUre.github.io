"""The Minecraft build's sound, checked in headless Edge (see README.md beside this file).

    node .claude/comp-tools/serve.js . 8571 &
    python .claude/comp-tools/mc-sounds/check.py                all passes
    python .claude/comp-tools/mc-sounds/check.py paths events   just those

MC_BASE overrides the server (default http://localhost:8571). Each pass prints what it saw and
ends with PASS or FAIL lines; the run ends with ALL PASS or FAILURES: n. Nothing in the sound
engine shows in a screenshot, so the evidence is the game's own QC log (__mc._sndlog: which
sample started, at what gain and pitch, on which bus), the network log, a hook on
HTMLMediaElement.play, and a meter on whatever the page connects to the speakers.

  paths    every path the game can ask for (__mc._sndPaths) is a shipped file, and vice versa
  title    the shipped route with no dev handle: nothing loads until the first click, then the
           manifest, the calibration pulse and the effects arrive, a menu piece plays, and
           backing out to the title keeps it playing
  events   every one-shot, every mob voice, every SoundType x use, real footsteps, and the
           music the world picks in survival and in creative
  world    rain, going under water and surfacing, mobs left to themselves, closing the window
  desktop  /tcomp/: the desktop icon, the launcher's PLAY, the title screen, one click
"""
import sys, os, json, time, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import launch, shutdown

BASE = os.environ.get('MC_BASE', 'http://localhost:8571')
MENU = BASE + '/.claude/comp-tools/mc-menu.html?w=780&h=560'
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
SOUNDS = os.path.join(REPO, 'tcomp', 'mc-sounds')

TAP = r'''(() => {
  const M = window.__meter = { peak: 0, rmsMax: 0, ticks: 0, loud: 0 };
  window.__meterReset = () => { M.peak = 0; M.rmsMax = 0; M.ticks = 0; M.loud = 0; };
  window.__plays = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { window.__plays.push(this.src); return play.apply(this, arguments); };
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest) {
    const r = orig.apply(this, arguments);
    try {
      if (dest instanceof AudioDestinationNode && !this.context.__tapped) {
        this.context.__tapped = true; window.__ctx = this.context;
        const an = this.context.createAnalyser(); an.fftSize = 2048; orig.call(this, an);
        const buf = new Float32Array(an.fftSize);
        setInterval(() => {
          an.getFloatTimeDomainData(buf); let pk = 0, s = 0;
          for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (Math.abs(v) > pk) pk = Math.abs(v); s += v * v; }
          const rms = Math.sqrt(s / buf.length); M.ticks++; if (rms > 3e-4) M.loud++;
          if (pk > M.peak) M.peak = pk; if (rms > M.rmsMax) M.rmsMax = rms;
        }, 40);
      }
    } catch (e) {}
    return r;
  };
})();'''
# headless Chromium has no pointer lock; stand in for it the way a browser that granted it would
LOCK_SHIM = r'''(() => {
  let locked = null;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { get() { return locked; }, configurable: true });
  Element.prototype.requestPointerLock = function () { const el = this;
    return new Promise((res) => { setTimeout(() => { locked = el; document.dispatchEvent(new Event('pointerlockchange')); res(); }, 0); }); };
  Document.prototype.exitPointerLock = function () { if (!locked) return; locked = null; setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0); };
})();'''
# a control by accessible name, once it is enabled AND is what a pointer at its centre would hit:
# the title canvas covers the buttons while the screen fades in, and a click then lands on the canvas
FIND = '''(() => { const ui = document.querySelector('.mc-mui'); if (!ui) return null;
  for (const el of ui.querySelectorAll('[aria-label]')) if (el.getAttribute('aria-label') === %s && !el.disabled) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    if (top && (top === el || el.contains(top))) return [x, y]; }
  return null; })()'''

FAILS = []
def check(ok, msg, extra=None):
    print(('PASS ' if ok else 'FAIL ') + msg + ('  ' + json.dumps(extra) if extra is not None else ''))
    if not ok: FAILS.append(msg)

def boot(url, w=800, h=580, lock=False):
    proc, c = launch()
    c.call('Runtime.enable'); c.call('Log.enable'); c.call('Page.enable'); c.call('Network.enable')
    c.call('Emulation.setDeviceMetricsOverride', width=w, height=h, deviceScaleFactor=1, mobile=False)   # headless ignores --window-size
    c.call('Page.addScriptToEvaluateOnNewDocument', source=TAP)
    if lock: c.call('Page.addScriptToEvaluateOnNewDocument', source=LOCK_SHIM)
    c.call('Page.navigate', url=url)
    return proc, c

def sift(c):
    """The events so far, split into problems and mc-sounds responses."""
    c.drain(); probs, files = [], []
    for e in c.events:
        m, p = e.get('method'), e.get('params', {})
        if m == 'Runtime.exceptionThrown': probs.append('exception: ' + json.dumps(p['exceptionDetails'])[:300])
        elif m == 'Runtime.consoleAPICalled' and p['type'] in ('error', 'warning'):
            probs.append(p['type'] + ': ' + ' '.join(str(a.get('value', a.get('description', ''))) for a in p['args'])[:300])
        elif m == 'Log.entryAdded' and p['entry']['level'] in ('error', 'warning') and 'favicon.ico' not in p['entry'].get('url', ''):
            probs.append('log: ' + p['entry'].get('text', '')[:200] + ' ' + p['entry'].get('url', ''))
        elif m == 'Network.responseReceived' and '/mc-sounds/' in p['response']['url']:
            files.append((p['response']['url'].split('/mc-sounds/')[1], p['response']['status']))
        elif m == 'Network.loadingFailed': probs.append('network: ' + p.get('errorText', '') + ' ' + p.get('type', ''))
    c.events.clear()
    return probs, files

def world(c, mode='kit'):
    c.wait_for('window.__mc && window.__mc.state && window.__mc.state().ready', 180, 0.5)
    c.eval('__mc._snd("click")')   # the first sound builds the graph and starts the loader
    c.wait_for('__mc._sounds().pending === 0 && __mc._sounds().loaded > 250', 120, 0.5)

def family(p): return p.rstrip('0123456789')

# ── passes ───────────────────────────────────────────────────
def p_paths():
    proc, c = boot(MENU.replace('?', '?mcdev=kit&'))
    try:
        c.wait_for('window.__mc && window.__mc.state && window.__mc.state().ready', 180, 0.5)
        asked = set(c.eval('__mc._sndPaths()'))
    finally:
        shutdown(proc, c)
    shipped = set()
    for d, _, fs in os.walk(SOUNDS):
        for f in fs:
            if f.endswith('.m4a') and f != 'cal.m4a': shipped.add(os.path.relpath(os.path.join(d, f), SOUNDS).replace(os.sep, '/')[:-4])
    man = json.load(open(os.path.join(SOUNDS, 'manifest.json'), encoding='utf-8'))['len']
    check(not (asked - shipped), f'every one of the {len(asked)} paths the game can ask for is shipped', sorted(asked - shipped) or None)
    check(not (shipped - asked), f'every one of the {len(shipped)} shipped files is used', sorted(shipped - asked) or None)
    effects = {p for p in shipped if not p.startswith('music/')}
    check(set(man) == effects, 'the manifest indexes exactly the shipped effects', sorted(set(man) ^ effects) or None)

def p_title():
    proc, c = boot(MENU)
    try:
        c.wait_for(FIND % json.dumps('Singleplayer'), 90)
        _, files = sift(c)
        check(not files and not c.eval('window.__ctx'), 'nothing loads and no audio starts before the first click', len(files))
        c.click(*c.wait_for(FIND % json.dumps('Singleplayer'), 30)); time.sleep(5)
        probs, files = sift(c)
        names = [f for f, _ in files]
        check(c.eval('window.__ctx && window.__ctx.state') == 'running', 'the click starts the audio context')
        # they come down in parallel with the click's own sound, so any order among the first three
        check({'manifest.json', 'cal.m4a'} <= set(names[:3]), 'the manifest and the calibration pulse arrive first', names[:3])
        check(len(files) > 300 and all(s in (200, 206) for _, s in files), f'the effects arrive ({len(files)} files, all 200/206)')
        plays = c.eval('window.__plays')
        check(len(plays) == 1 and '/mc-sounds/music/menu/' in plays[0], 'the title screen plays a menu piece', plays)
        c.eval('window.__meterReset()'); time.sleep(3)
        m = c.eval('window.__meter')
        check(m['loud'] > m['ticks'] * 0.5, 'and it is audible on the master', {k: round(v, 5) for k, v in m.items()})
        c.click(*c.wait_for(FIND % json.dumps('Cancel'), 30)); time.sleep(1.5)
        check(c.eval('window.__plays') == plays, 'backing out to the title keeps the same piece playing')
        probs += sift(c)[0]
        check(not probs, 'no errors', probs or None)
    finally:
        shutdown(proc, c)

EVENTS = [
    ('hurt', 0, 0, 'damage/hit'), ('die', 0, 0, 'damage/hit'), ('hurtdrown', 0, 0, 'entity/player/hurt/drown'),
    ('hurtfire', 0, 0, 'entity/player/hurt/fire_hurt'), ('fall', 6, 0, 'damage/fallbig'), ('fall', 2, 0, 'damage/fallsmall'),
    ('eat', 0, 0, 'random/eat'), ('drink', 0, 0, 'random/drink'), ('burp', 0, 0, 'random/burp'),
    ('splash', 8, 1, 'liquid/splash'), ('splash', 40, 1, 'liquid/heavy_splash'), ('swim', 0, 1, 'liquid/swim'),
    ('bubble', 3, 0, 'ui/hud/hud_bubble'), ('uwenter', 0, 0, 'ambient/underwater/enter'), ('uwexit', 0, 0, 'ambient/underwater/exit'),
    ('uwadd', 0, 0, 'ambient/underwater/additions/'), ('uwrare', 0, 0, 'ambient/underwater/additions/'),
    ('hit', 0, 1, 'entity/player/attack/strong'), ('crit', 0, 1, 'entity/player/attack/crit'), ('bow', 1, 0, 'random/bow'),
    ('skelshoot', 0, 1, 'random/bow'), ('thud', 0, 1, 'random/bowhit'), ('arrowhit', 0, 0, 'random/successful_hit'),
    ('pop', 0, 0, 'random/pop'), ('orb', 0, 0, 'random/orb'), ('click', 0, 0, 'random/click'), ('break', 0, 0, 'random/break'),
    ('level', 12, 0, 'random/levelup'), ('levelbig', 30, 0, 'random/levelup'), ('ding', 0, 0, 'ui/toast/in'), ('toastout', 0, 0, 'ui/toast/out'),
    ('enchant', 0, 0, 'block/enchantment_table/enchant'), ('anvil', 0, 0, 'random/anvil_use'), ('chestopen', 0, 1, 'block/chest/open'),
    ('chestclose', 0, 1, 'block/chest/close'), ('equip', 'iron', 0, 'item/armor/equip_iron'), ('equip', 'gold', 0, 'item/armor/equip_gold'),
    ('bucketfill', 0, 1, 'item/bucket/fill'), ('bucketfilllava', 0, 1, 'item/bucket/fill_lava'), ('bucketempty', 0, 1, 'item/bucket/empty'),
    ('bucketemptylava', 0, 1, 'item/bucket/empty_lava'), ('milk', 0, 1, 'entity/cow/milk'), ('till', 0, 1, 'item/hoe/till'),
    ('fuse', 0, 1, 'random/fuse'), ('tntfuse', 0, 1, 'random/fuse'), ('boom', 0, 1, 'random/explode'), ('thunder', 0, 0, 'ambient/weather/thunder'),
    ('impact', 0, 1, 'random/explode'), ('teleport', 0, 1, 'mob/endermen/portal'), ('lavapop', 0, 1, 'liquid/lavapop'), ('lava', 0, 1, 'liquid/lava'),
    ('fizz', 0, 1, 'random/fizz'), ('crackle', 0, 1, 'block/furnace/fire_crackle'), ('cave', 0, 1, 'ambient/cave/cave'),
    ('rain', 1, 1, 'ambient/weather/rain'), ('rain', 0, 1, 'ambient/weather/rain'),
]
MOBS = [('pig', 'idle', 'mob/pig/say'), ('pig', 'death', 'mob/pig/death'), ('pig', 'step', 'mob/pig/step'),
        ('cow', 'idle', 'mob/cow/say'), ('cow', 'hurt', 'mob/cow/hurt'), ('sheep', 'idle', 'mob/sheep/say'), ('sheep', 'step', 'mob/sheep/step'),
        ('chicken', 'idle', 'mob/chicken/say'), ('chicken', 'hurt', 'mob/chicken/hurt'), ('chicken', 'egg', 'mob/chicken/plop'),
        ('zombie', 'idle', 'mob/zombie/say'), ('zombie', 'hurt', 'mob/zombie/hurt'), ('zombie', 'death', 'mob/zombie/death'), ('zombie', 'step', 'mob/zombie/step'),
        ('skeleton', 'idle', 'mob/skeleton/say'), ('skeleton', 'hurt', 'mob/skeleton/hurt'), ('skeleton', 'death', 'mob/skeleton/death'),
        ('creeper', 'hurt', 'mob/creeper/say'), ('creeper', 'death', 'mob/creeper/death'),
        ('spider', 'idle', 'mob/spider/say'), ('spider', 'death', 'mob/spider/death'), ('spider', 'step', 'mob/spider/step'),
        ('enderman', 'idle', 'mob/endermen/idle'), ('enderman', 'scream', 'mob/endermen/scream'), ('enderman', 'hurt', 'mob/endermen/hit'),
        ('enderman', 'death', 'mob/endermen/death'), ('enderman', 'stare', 'mob/endermen/stare'),
        ('slime', 'jump', 'mob/slime/big'), ('slime', 'squish', 'mob/slime/big'), ('slime', 'attack', 'mob/slime/attack'),
        ('squid', 'idle', 'mob/squid/ambient'), ('squid', 'hurt', 'mob/squid/hurt'), ('squid', 'death', 'mob/squid/death')]

def matched(log, wants):
    used, miss = [False] * len(log), []
    for w in wants:
        k = next((i for i, e in enumerate(log) if not used[i] and e['p'].startswith(w[-1])), None)
        if k is None: miss.append(w)
        else: used[k] = True
    return miss

def p_events():
    for mode in ('kit', 'creative'):
        proc, c = boot(MENU.replace('?', '?mcdev=%s&' % mode), lock=True)
        try:
            world(c)
            if mode == 'kit':
                pos = c.eval('(() => { const s = __mc.state(); return [s.px, s.py + 1, s.pz + 2]; })()')
                c.eval('__mc._sndlog(true)')
                for ev, arg, at, _ in EVENTS:
                    c.eval('__mc._snd(%s)' % ', '.join([json.dumps(ev), json.dumps(arg)] + ([str(v) for v in pos] if at else [])))
                    time.sleep(0.12)
                time.sleep(3.5)   # the long ones load on first use and start within their allowance
                miss = matched(c.eval('__mc._sndlog()'), EVENTS)
                check(not miss, f'every one of {len(EVENTS)} one-shot events starts a sample from its own set', miss or None)
                c.eval('__mc._sndlog(true)')
                for k, m, _ in MOBS:
                    c.eval('__mc._snd(%s, {sz: 2}, %s, %s, %s)' % (json.dumps('mob:%s:%s' % (k, m)), *pos)); time.sleep(0.1)
                c.eval('__mc._snd("mob:slime:jump", {sz: 1}, %s, %s, %s)' % tuple(pos))
                c.eval('__mc._snd("mob:pig:idle", {baby: 1}, %s, %s, %s)' % tuple(pos))
                time.sleep(3)
                log = c.eval('__mc._sndlog()')
                miss = matched(log, MOBS)
                check(not miss, f'every one of {len(MOBS)} mob voices starts a sample from its own set', miss or None)
                tiny = [e for e in log if e['p'].startswith('mob/slime/small')]
                check(bool(tiny) and tiny[0]['r'] > 1.2, 'a size-1 slime uses the small set, pitched up', tiny[:1])
                baby = [e for e in log if e['p'].startswith('mob/pig/say')][-1:]
                check(bool(baby) and baby[0]['r'] > 1.3, "a baby's voice is half an octave up", baby)
                # the SoundType table through the real call names; the game's own maths gives these gains and rates
                c.eval('__mc._sndlog(true)')
                ids = {}
                for bid, m in c.eval('__mc._mats()').items(): ids.setdefault(m, int(bid))
                for m, bid in sorted(ids.items()):
                    for use in ('dig', 'place', 'step', 'mine', 'land'):
                        c.eval('__mc._snd(%s, %d, %s, %s, %s)' % (json.dumps(use), bid, *pos)); time.sleep(0.05)
                time.sleep(1)
                log = c.eval('__mc._sndlog()')
                rates = [(e['r'] if i % 5 != 1 or 'plant/crop' not in e['p'] else 0.8) for i, e in enumerate(log)]
                want = [0.8, 0.8, 1, 0.5, 0.75] * len(ids)
                check(len(log) == 5 * len(ids) and all(abs(a - b) < 1e-3 for a, b in zip(rates, want)),
                      f'{len(ids)} SoundTypes x break/place/step/mine/land start at the game\'s pitches', len(log))
                # real footsteps
                c.eval('__mc._sndlog(true)')
                c.click(390, 280); time.sleep(0.6); c.eval("document.querySelector('.mc').focus()")
                c.key('w', 'KeyW', 87, True); time.sleep(2.2); c.key('w', 'KeyW', 87, False); time.sleep(0.4)
                steps = [e['p'] for e in c.eval('__mc._sndlog()') if e['p'].startswith('step/')]
                check(len(steps) >= 3, 'walking for two seconds makes footsteps', steps[:5])
            c.eval('__mc._mus(true)'); time.sleep(2.5)
            m = c.eval('__mc._sounds().music')
            want = 'creative' if mode == 'creative' else 'game'
            check(bool(m) and m['kind'] == want and not m['paused'] and m['t'] > 0.5, f'a {mode} world plays a {want} piece', m)
            s = c.eval('__mc._sounds()')
            check(not s['failed'], f'nothing failed to load ({s["loaded"]} buffers held)', s['failed'] or None)
            probs = sift(c)[0]
            check(not probs, f'no errors in the {mode} world', probs or None)
        finally:
            shutdown(proc, c)

def p_world():
    proc, c = boot(MENU.replace('?', '?mcdev=kit&'), lock=True)
    try:
        world(c)
        c.click(390, 280); time.sleep(0.5)
        c.eval('__mc._sndlog(true)'); c.eval('__mc.weather(1)'); time.sleep(3); c.eval('__mc.weather(0)')
        rain = [e for e in c.eval('__mc._sndlog()') if e['p'].startswith('ambient/weather/rain')]
        check(len(rain) >= 6, f'rain is a scatter of short clips ({len(rain)} in 3 s)', sorted({e['r'] for e in rain}))
        time.sleep(1); c.eval('__mc._sndlog(true)'); c.eval('window.__meterReset()')
        c.eval('__mc.chat("/fill ~-2 ~-1 ~-2 ~2 ~3 ~2 water")'); time.sleep(4.5)
        under = collections.Counter(family(e['p']) for e in c.eval('__mc._sndlog()')); m = c.eval('window.__meter')
        check(under['ambient/underwater/enter'] == 1, 'going under plays the enter sound once', dict(under))
        check(under['ui/hud/hud_bubble'] >= 2, 'held breath pops the HUD bubbles', under['ui/hud/hud_bubble'])
        check(m['loud'] > m['ticks'] * 0.8, 'the underwater bed sounds', {k: round(v, 5) for k, v in m.items()})
        c.eval('__mc._sndlog(true)'); c.eval('__mc.chat("/fill ~-2 ~-1 ~-2 ~2 ~3 ~2 air")'); time.sleep(1.5)
        check(any(e['p'].startswith('ambient/underwater/exit') for e in c.eval('__mc._sndlog()')), 'surfacing plays the exit sound')
        c.eval('__mc._sndlog(true)')
        for k, dx, dz, sz in (('zombie', 4, 0, 0), ('slime', 1.5, 0, 2), ('pig', -4, 2, 0), ('chicken', -3, -3, 0), ('spider', 5, -4, 0)):
            c.eval(f'__mc.spawnMob("{k}", {dx}, {dz}{", " + str(sz) if sz else ""}); 0')
        time.sleep(12)
        got = collections.Counter(family(e['p']) for e in c.eval('__mc._sndlog()'))
        check(got['mob/zombie/step'] > 0, 'a zombie walking up has footsteps', dict(got))
        check(got['mob/slime/big'] > 0, 'a slime hopping about squelches')
        check(any(k.startswith('mob/') and ('/say' in k or 'ambient' in k) for k in got), 'the mobs about talk now and then')
        c.eval('window.MC.close()'); time.sleep(1.5)
        check(c.eval('window.__ctx.state') == 'closed', 'closing the window closes the audio context')
        probs = sift(c)[0]
        check(not probs, 'no errors', probs or None)
    finally:
        shutdown(proc, c)

def p_desktop():
    proc, c = boot(BASE + '/tcomp/', 1400, 900)
    try:
        c.wait_for("document.readyState === 'complete'", 60); time.sleep(3)
        ic = c.eval('''(() => { const t = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /Minecraft\\s*Launcher/i.test(e.textContent) && e.getBoundingClientRect().left < 150);
          const r = t && t.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top - 20] : null; })()''')
        check(bool(ic), 'the desktop has its Minecraft Launcher icon')
        for t in ('mouseMoved', 'mousePressed', 'mouseReleased'): c.call('Input.dispatchMouseEvent', type=t, x=ic[0], y=ic[1], button='left', clickCount=1)
        for t in ('mousePressed', 'mouseReleased'): c.call('Input.dispatchMouseEvent', type=t, x=ic[0], y=ic[1], button='left', clickCount=2)
        play = c.wait_for('''(() => { const el = document.querySelector('.mcl .mcl-play[data-mca="play"]'); if (!el) return null; const r = el.getBoundingClientRect();
          return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; })()''', 60)
        c.click(*play)
        xy = c.wait_for(FIND % json.dumps('Singleplayer'), 120)
        c.click(*xy); time.sleep(5)
        probs, files = sift(c)
        check(len(files) > 300 and all(s in (200, 206) for _, s in files), f'the game in the desktop loads its sounds from /tcomp/mc-sounds/ ({len(files)} files)')
        plays = c.eval('window.__plays')
        check(len(plays) == 1 and '/tcomp/mc-sounds/music/menu/' in plays[0], 'and its title screen plays a menu piece', plays)
        check(not probs, 'no errors', probs or None)
    finally:
        shutdown(proc, c)

PASSES = {'paths': p_paths, 'title': p_title, 'events': p_events, 'world': p_world, 'desktop': p_desktop}
if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')   # the Windows console is cp1252
    for name in (sys.argv[1:] or list(PASSES)):
        print(f'\n── {name} ──', flush=True)
        try:
            PASSES[name]()
        except Exception as e:
            check(False, f'{name} pass crashed: {type(e).__name__}: {str(e)[:300]}')
    print('\n' + ('ALL PASS' if not FAILS else f'FAILURES: {len(FAILS)}'))
    sys.exit(1 if FAILS else 0)
