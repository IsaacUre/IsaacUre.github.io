"""PNG read/write with the standard library only: every colour type and bit
depth a PNG may use, non-interlaced or Adam7, decoded to 8-bit RGBA; and
8-bit RGBA encoding. An image is [w, h, px], px a bytearray of w*h*4."""
import struct, zlib

SIG = b'\x89PNG\r\n\x1a\n'


def _unfilter(raw, h, bpp, rowlen):
    out = bytearray(h * rowlen)
    prev = bytearray(rowlen)
    i = 0
    for y in range(h):
        ft = raw[i]; i += 1
        line = bytearray(raw[i:i + rowlen]); i += rowlen
        if ft == 1:
            for x in range(bpp, rowlen): line[x] = (line[x] + line[x - bpp]) & 255
        elif ft == 2:
            for x in range(rowlen): line[x] = (line[x] + prev[x]) & 255
        elif ft == 3:
            for x in range(rowlen):
                a = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif ft == 4:
            for x in range(rowlen):
                a = line[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        elif ft != 0:
            raise ValueError('bad filter %d' % ft)
        out[y * rowlen:(y + 1) * rowlen] = line
        prev = line
    return out, i


def _samples(line, w, depth, per):
    """one unfiltered row as ints, per samples to a pixel"""
    n = w * per
    if depth == 8: return list(line[:n])
    if depth == 16: return [line[2 * k] << 8 | line[2 * k + 1] for k in range(n)]   # the full sample; the caller takes the high byte
    out = []
    mask = (1 << depth) - 1
    for byte in line:
        for s in range(8 // depth):
            out.append((byte >> (8 - depth * (s + 1))) & mask)
            if len(out) == n: return out
    return out


def read(path):
    return decode(open(path, 'rb').read(), path)


def decode(data, name='png'):
    assert data[:8] == SIG, name
    p = 8
    idat = b''
    pal = None; trns = None
    while p < len(data):
        ln, typ = struct.unpack('>I4s', data[p:p + 8])
        body = data[p + 8:p + 8 + ln]
        p += 12 + ln
        if typ == b'IHDR':
            w, h, depth, ctype, _, _, inter = struct.unpack('>IIBBBBB', body)
        elif typ == b'PLTE':
            pal = [tuple(body[i:i + 3]) for i in range(0, len(body), 3)]
        elif typ == b'tRNS':
            trns = body
        elif typ == b'IDAT':
            idat += body
        elif typ == b'IEND':
            break
    raw = zlib.decompress(idat)
    per = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    bits = depth * per
    bpp = max(1, bits // 8)
    px = bytearray(w * h * 4)
    scale = 255 // ((1 << depth) - 1) if depth < 8 else 1
    sh = 8 if depth == 16 else 0
    grey_key = (trns[0] << 8 | trns[1]) if trns is not None and len(trns) >= 2 else None
    rgb_key = struct.unpack('>HHH', trns[:6]) if trns is not None and len(trns) >= 6 else None

    def norm(v): return (v >> sh) * scale   # a sample as 8 bits

    def emit(x, y, s, k):
        o = (y * w + x) * 4
        if ctype == 3:
            idx = s[k]
            r, g, b = pal[idx]
            a = trns[idx] if trns is not None and idx < len(trns) else 255
            px[o:o + 4] = bytes((r, g, b, a))
        elif ctype == 0:
            v = norm(s[k])
            a = 0 if grey_key is not None and s[k] == grey_key else 255   # the key is the raw sample at any depth
            px[o:o + 4] = bytes((v, v, v, a))
        elif ctype == 4:
            px[o:o + 4] = bytes((norm(s[2 * k]), norm(s[2 * k]), norm(s[2 * k]), norm(s[2 * k + 1])))
        elif ctype == 2:
            raw = tuple(s[3 * k:3 * k + 3])
            a = 0 if rgb_key is not None and raw == rgb_key else 255
            px[o:o + 4] = bytes((norm(raw[0]), norm(raw[1]), norm(raw[2]), a))
        else:
            px[o:o + 4] = bytes(norm(v) for v in s[4 * k:4 * k + 4])

    if inter == 0:
        rowlen = (w * bits + 7) // 8
        rows, _ = _unfilter(raw, h, bpp, rowlen)
        for y in range(h):
            s = _samples(rows[y * rowlen:(y + 1) * rowlen], w, depth, per)
            for x in range(w): emit(x, y, s, x)
    else:   # Adam7
        off = 0
        for x0, y0, dx, dy in [(0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8), (2, 0, 4, 4), (0, 2, 2, 4), (1, 0, 2, 2), (0, 1, 1, 2)]:
            pw = (w - x0 + dx - 1) // dx; ph = (h - y0 + dy - 1) // dy
            if pw <= 0 or ph <= 0: continue
            rowlen = (pw * bits + 7) // 8
            rows, used = _unfilter(raw[off:], ph, bpp, rowlen)
            off += used
            for yy in range(ph):
                s = _samples(rows[yy * rowlen:(yy + 1) * rowlen], pw, depth, per)
                for xx in range(pw): emit(x0 + xx * dx, y0 + yy * dy, s, xx)
    return [w, h, px]


def encode(img):
    w, h, px = img

    def chunk(t, b):
        return struct.pack('>I', len(b)) + t + b + struct.pack('>I', zlib.crc32(t + b) & 0xffffffff)
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += px[y * w * 4:(y + 1) * w * 4]
    return SIG + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + \
        chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')


def write(path, img):
    open(path, 'wb').write(encode(img))


def new(w, h):
    return [w, h, bytearray(w * h * 4)]


def crop(img, x, y, cw, ch):
    w, h, px = img
    out = bytearray(cw * ch * 4)
    for yy in range(ch):
        sy = y + yy
        if not 0 <= sy < h: continue
        for xx in range(cw):
            sx = x + xx
            if 0 <= sx < w:
                o = (sy * w + sx) * 4
                d = (yy * cw + xx) * 4
                out[d:d + 4] = px[o:o + 4]
    return [cw, ch, out]


def blit(dst, src, dx, dy, over=False):
    """copy src into dst at (dx, dy); over=True composites it with its alpha"""
    dw, dh, dp = dst
    sw, sh, sp = src
    for y in range(sh):
        for x in range(sw):
            tx, ty = dx + x, dy + y
            if not (0 <= tx < dw and 0 <= ty < dh): continue
            s = (y * sw + x) * 4; d = (ty * dw + tx) * 4
            if not over:
                dp[d:d + 4] = sp[s:s + 4]
                continue
            a = sp[s + 3] / 255.0
            if a <= 0: continue
            da = dp[d + 3] / 255.0
            oa = a + da * (1 - a)
            for c in range(3):
                dp[d + c] = int(round((sp[s + c] * a + dp[d + c] * da * (1 - a)) / oa))
            dp[d + 3] = int(round(oa * 255))


def scale_nearest(img, nw, nh):
    """nearest neighbour, sampling at pixel centres as GL_NEAREST does"""
    w, h, px = img
    out = bytearray(nw * nh * 4)
    for y in range(nh):
        sy = min(h - 1, (2 * y + 1) * h // (2 * nh))
        for x in range(nw):
            sx = min(w - 1, (2 * x + 1) * w // (2 * nw))
            s = (sy * w + sx) * 4
            d = (y * nw + x) * 4
            out[d:d + 4] = px[s:s + 4]
    return [nw, nh, out]


def scale_box(img, nw, nh):
    """area-averaged resize, alpha-weighted, for shrinking by a whole factor"""
    w, h, px = img
    fx, fy = w // nw, h // nh
    out = bytearray(nw * nh * 4)
    for y in range(nh):
        for x in range(nw):
            acc = [0, 0, 0]; aw = 0
            for yy in range(fy):
                for xx in range(fx):
                    s = ((y * fy + yy) * w + x * fx + xx) * 4
                    a = px[s + 3]
                    aw += a
                    for c in range(3): acc[c] += px[s + c] * a
            d = (y * nw + x) * 4
            if aw:
                for c in range(3): out[d + c] = int(round(acc[c] / aw))
            out[d + 3] = int(round(aw / (fx * fy)))
    return [nw, nh, out]
