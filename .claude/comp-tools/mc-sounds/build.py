"""Build tcomp/mc-sounds/ from the Minecraft sound library (see README.md beside this file).

    python .claude/comp-tools/mc-sounds/build.py              everything, about a minute and a half
    python .claude/comp-tools/mc-sounds/build.py dig/ mob/pig only the paths that start with these

Windows only. The AAC encoder is Media Foundation's own, driven by mf_encode.ps1 through
Windows PowerShell 5.1; nothing needs installing. Python 3, stdlib only.

Every effect gets PAD seconds of silence in front before it is encoded, for two reasons: the
Windows encoder softens whatever lands in a file's first ~20 ms (a footstep that starts at
sample 20 lost its attack), and browsers need not agree on where an AAC stream without an edit
list begins. cal.m4a carries the same pad and one pulse at CAL_AT; minecraft.js decodes it once
and trims every effect by exactly what this browser needs. Music is streamed rather than
trimmed, so it is not padded, but its moov box is moved to the front so a stream can start
without first fetching the end of the file.
"""
import os, sys, wave, json, struct, math, subprocess, tempfile, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(REPO, 'tcomp', 'mc-sounds')
LIB = os.environ.get('MC_SOUND_LIB', r'C:\Users\isaac\code\site-assets\Minecraft sounds')
PAD = 0.064          # 3 AAC frames at 48 kHz
CAL_AT = 0.074       # the calibration pulse's centre, 10 ms after the pad
BITRATE = 96000      # the Windows AAC encoder's floor

def seq(prefix, a, b): return [f'{prefix}{i}' for i in range(a, b + 1)]

# Everything minecraft.js can ask for, as Java resource paths. check.py holds this against the game.
SFX = (
    # block SoundTypes
    seq('dig/stone', 1, 4) + seq('dig/wood', 1, 4) + seq('dig/gravel', 1, 4) + seq('dig/grass', 1, 4) +
    seq('dig/sand', 1, 4) + seq('dig/snow', 1, 4) + seq('dig/cloth', 1, 4) +
    seq('step/stone', 1, 6) + seq('step/wood', 1, 6) + seq('step/gravel', 1, 4) + seq('step/grass', 1, 6) +
    seq('step/sand', 1, 5) + seq('step/snow', 1, 4) + seq('step/cloth', 1, 4) + seq('step/ladder', 1, 5) +
    seq('random/glass', 1, 3) + ['random/anvil_land', 'random/anvil_use'] +
    seq('block/bamboo/sapling_place', 1, 6) + seq('item/plant/crop', 1, 6) +
    # the player
    seq('damage/hit', 1, 3) + ['damage/fallbig', 'damage/fallsmall'] +
    seq('entity/player/hurt/drown', 1, 4) + seq('entity/player/hurt/fire_hurt', 1, 3) +
    seq('random/eat', 1, 3) + ['random/drink', 'random/burp'] +
    ['liquid/splash', 'liquid/splash2', 'liquid/heavy_splash'] + seq('liquid/swim', 5, 18) +
    ['ui/hud/hud_bubble'] +
    seq('ambient/underwater/enter', 1, 3) + seq('ambient/underwater/exit', 1, 3) + ['ambient/underwater/underwater_ambience'] +
    seq('ambient/underwater/additions/bubbles', 1, 6) + seq('ambient/underwater/additions/water', 1, 2) +
    ['ambient/underwater/additions/animal1', 'ambient/underwater/additions/bass_whale1', 'ambient/underwater/additions/bass_whale2',
     'ambient/underwater/additions/crackles1', 'ambient/underwater/additions/crackles2', 'ambient/underwater/additions/driplets1',
     'ambient/underwater/additions/driplets2', 'ambient/underwater/additions/earth_crack'] +
    # combat
    seq('entity/player/attack/strong', 1, 6) + seq('entity/player/attack/crit', 1, 3) +
    ['random/bow'] + seq('random/bowhit', 1, 4) + ['random/successful_hit'] +
    # items and UI
    ['random/pop', 'random/orb', 'random/click', 'random/break', 'random/levelup', 'ui/toast/in', 'ui/toast/out'] +
    seq('block/enchantment_table/enchant', 1, 3) + ['block/chest/open'] + seq('block/chest/close', 1, 3) +
    seq('item/bucket/fill', 1, 3) + seq('item/bucket/fill_lava', 1, 3) + seq('item/bucket/empty', 1, 3) + seq('item/bucket/empty_lava', 1, 3) +
    seq('entity/cow/milk', 1, 3) + seq('item/hoe/till', 1, 4) +
    seq('item/armor/equip_leather', 1, 6) + seq('item/armor/equip_iron', 1, 6) + seq('item/armor/equip_gold', 1, 6) + seq('item/armor/equip_diamond', 1, 6) +
    # the world
    ['random/fuse'] + seq('random/explode', 1, 4) + seq('ambient/weather/thunder', 1, 3) + seq('ambient/weather/rain', 1, 8) +
    ['liquid/lavapop', 'liquid/lava', 'random/fizz'] + seq('block/furnace/fire_crackle', 1, 5) + seq('ambient/cave/cave', 1, 23) +
    # mobs
    seq('mob/pig/say', 1, 3) + ['mob/pig/death'] + seq('mob/pig/step', 1, 5) +
    seq('mob/cow/say', 1, 4) + seq('mob/cow/hurt', 1, 3) + seq('mob/cow/step', 1, 4) +
    seq('mob/sheep/say', 1, 3) + seq('mob/sheep/step', 1, 5) +
    seq('mob/chicken/say', 1, 3) + seq('mob/chicken/hurt', 1, 2) + ['mob/chicken/plop'] + seq('mob/chicken/step', 1, 2) +
    seq('mob/zombie/say', 1, 3) + seq('mob/zombie/hurt', 1, 2) + ['mob/zombie/death'] + seq('mob/zombie/step', 1, 5) +
    seq('mob/skeleton/say', 1, 3) + seq('mob/skeleton/hurt', 1, 4) + ['mob/skeleton/death'] + seq('mob/skeleton/step', 1, 4) +
    seq('mob/creeper/say', 1, 4) + ['mob/creeper/death'] +
    seq('mob/spider/say', 1, 4) + ['mob/spider/death'] + seq('mob/spider/step', 1, 4) +
    seq('mob/endermen/idle', 1, 5) + seq('mob/endermen/hit', 1, 4) + ['mob/endermen/death', 'mob/endermen/stare', 'mob/endermen/portal', 'mob/endermen/portal2'] + seq('mob/endermen/scream', 1, 4) +
    seq('mob/slime/big', 1, 4) + seq('mob/slime/small', 1, 5) + seq('mob/slime/attack', 1, 2) +
    seq('mob/squid/ambient', 1, 5) + seq('mob/squid/hurt', 1, 4) + seq('mob/squid/death', 1, 3) + seq('mob/squid/squirt', 1, 3)
)
MUSIC = {
    'menu': ['music/menu/mutation', 'music/menu/moog_city_2', 'music/menu/beginning_2', 'music/menu/floating_trees'],
    'game': ['music/game/minecraft', 'music/game/clark', 'music/game/sweden', 'music/game/subwoofer_lullaby', 'music/game/living_mice',
             'music/game/haggstrom', 'music/game/danny', 'music/game/key', 'music/game/oxygene', 'music/game/dry_hands',
             'music/game/wet_hands', 'music/game/mice_on_venus'],
    'creative': ['music/game/creative/biome_fest', 'music/game/creative/blind_spots', 'music/game/creative/haunt_muskie',
                 'music/game/creative/aria_math', 'music/game/creative/dreiton', 'music/game/creative/taswell'],
    'water': ['music/game/water/axolotl', 'music/game/water/dragon_fish', 'music/game/water/shuniji'],
}

def lib(p): return os.path.join(LIB, *p.split('/')) + '.wav'
def out(p): return os.path.join(OUT, *p.split('/')) + '.m4a'

def read_wav(path):
    with wave.open(path, 'rb') as w:
        assert w.getsampwidth() == 2, path + ': expected 16-bit PCM'
        return w.getnchannels(), w.getframerate(), w.getnframes(), w.readframes(w.getnframes())

def write_wav(path, ch, rate, frames):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(rate); w.writeframes(frames)

# ── faststart: moov in front of mdat, every stco/co64 chunk offset shifted by moov's size ──
CONTAINERS = {b'moov', b'trak', b'mdia', b'minf', b'stbl', b'edts', b'dinf', b'udta', b'mvex'}
def _boxes(b):
    res, off = [], 0
    while off + 8 <= len(b):
        size, typ = struct.unpack_from('>I4s', b, off)
        if size == 1: size = struct.unpack_from('>Q', b, off + 8)[0]
        elif size == 0: size = len(b) - off
        res.append((typ, off, size)); off += size
    return res
def _shift(buf, start, end, delta):
    off = start
    while off + 8 <= end:
        size, typ = struct.unpack_from('>I4s', buf, off); hdr = 8
        if size == 1: size = struct.unpack_from('>Q', buf, off + 8)[0]; hdr = 16
        if typ in CONTAINERS: _shift(buf, off + hdr, off + size, delta)
        elif typ in (b'stco', b'co64'):
            w = 4 if typ == b'stco' else 8; fmt = '>I' if w == 4 else '>Q'
            n = struct.unpack_from('>I', buf, off + hdr + 4)[0]
            for i in range(n):
                p = off + hdr + 8 + i * w
                struct.pack_into(fmt, buf, p, struct.unpack_from(fmt, buf, p)[0] + delta)
        off += size
def faststart(path):
    b = open(path, 'rb').read(); bx = _boxes(b); kinds = [t for t, _, _ in bx]
    if kinds.index(b'moov') < kinds.index(b'mdat'): return
    _, mo, ms = bx[kinds.index(b'moov')]
    moov = bytearray(b[mo:mo + ms]); _shift(moov, 8, len(moov), ms)
    first = kinds.index(b'mdat'); res = bytearray()
    for t, o, s in bx[:first]: res += b[o:o + s]
    res += moov
    for t, o, s in bx[first:]:
        if t != b'moov': res += b[o:o + s]
    open(path, 'wb').write(res)

def main(prefixes):
    tmp = tempfile.mkdtemp(prefix='mc-sounds-')   # the padded WAVs: tens of megabytes, gone when the build is
    try:
        build(prefixes, tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def build(prefixes, tmp):
    want = lambda p: not prefixes or any(p.startswith(x) for x in prefixes)
    jobs, lengths = [], {}
    for p in SFX:
        if not want(p): continue
        ch, rate, n, frames = read_wav(lib(p))
        padded = os.path.join(tmp, *p.split('/')) + '.wav'
        write_wav(padded, ch, rate, b'\x00\x00' * ch * round(PAD * rate) + frames)
        jobs.append((padded, out(p), BITRATE, ch, rate if rate in (44100, 48000) else 48000))
        lengths[p] = round(n / rate, 5)
    if want('cal'):
        rate, c = 48000, round(CAL_AT * 48000)
        pcm = b''.join(struct.pack('<h', int(round(32767 * 0.9 * math.exp(-0.5 * ((i - c) / 4.0) ** 2)))) if abs(i - c) < 40 else b'\x00\x00'
                       for i in range(round(0.2 * rate)))
        write_wav(os.path.join(tmp, 'cal.wav'), 1, rate, pcm)
        jobs.append((os.path.join(tmp, 'cal.wav'), os.path.join(OUT, 'cal.m4a'), BITRATE, 1, rate))
    music = [p for v in MUSIC.values() for p in v if want(p)]
    for p in music:
        with wave.open(lib(p), 'rb') as w: jobs.append((lib(p), out(p), BITRATE, w.getnchannels(), w.getframerate()))
    if not jobs: sys.exit('nothing matches ' + ' '.join(prefixes))
    listing = os.path.join(tmp, 'jobs.tsv')
    with open(listing, 'w', encoding='utf-8') as f:
        for j in jobs: f.write('\t'.join(map(str, j)) + '\n')
    print(f'encoding {len(jobs)} files...', flush=True)
    r = subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', os.path.join(HERE, 'mf_encode.ps1'), '-List', listing],
                       capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    if 'FAIL' in r.stdout or r.returncode: sys.exit(1)
    for p in music: faststart(out(p))
    mpath = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mpath, encoding='utf-8')) if os.path.exists(mpath) else {'len': {}}
    man.update({'pad': PAD, 'cal': CAL_AT}); man['len'].update(lengths)
    with open(mpath, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(man, f, separators=(',', ':'), sort_keys=True); f.write('\n')
    print(f'{len(lengths)} effects indexed, {len(music)} music tracks, manifest at {os.path.relpath(mpath, REPO)}')

if __name__ == '__main__':
    main(sys.argv[1:])
