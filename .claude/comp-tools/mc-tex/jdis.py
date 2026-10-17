"""Minimal JVM bytecode disassembler (stdlib only).
python -I jdis.py <class path inside the 26.3 jar, e.g. net/minecraft/client/gui/Gui> [method-name-substring ...]
Prints the matching methods' bytecode with constants resolved."""
import os, struct, sys, zipfile

JAR = os.path.join(os.environ['APPDATA'], '.minecraft', 'versions', '26.3', '26.3.jar')

OPS = {}
def op(code, name, n=0): OPS[code] = (name, n)
names0 = ['nop','aconst_null','iconst_m1','iconst_0','iconst_1','iconst_2','iconst_3','iconst_4','iconst_5','lconst_0','lconst_1','fconst_0','fconst_1','fconst_2','dconst_0','dconst_1']
for i, n in enumerate(names0): op(i, n)
op(0x10, 'bipush', 1); op(0x11, 'sipush', 2); op(0x12, 'ldc', 1); op(0x13, 'ldc_w', 2); op(0x14, 'ldc2_w', 2)
for i, n in enumerate(['iload','lload','fload','dload','aload']): op(0x15 + i, n, 1)
k = 0x1a
for t in 'ilfda':
    for j in range(4): op(k, '%sload_%d' % (t, j)); k += 1
for i, n in enumerate(['iaload','laload','faload','daload','aaload','baload','caload','saload']): op(0x2e + i, n)
for i, n in enumerate(['istore','lstore','fstore','dstore','astore']): op(0x36 + i, n, 1)
k = 0x3b
for t in 'ilfda':
    for j in range(4): op(k, '%sstore_%d' % (t, j)); k += 1
for i, n in enumerate(['iastore','lastore','fastore','dastore','aastore','bastore','castore','sastore','pop','pop2','dup','dup_x1','dup_x2','dup2','dup2_x1','dup2_x2','swap']): op(0x4f + i, n)
arith = ['iadd','ladd','fadd','dadd','isub','lsub','fsub','dsub','imul','lmul','fmul','dmul','idiv','ldiv','fdiv','ddiv','irem','lrem','frem','drem','ineg','lneg','fneg','dneg','ishl','lshl','ishr','lshr','iushr','lushr','iand','land','ior','lor','ixor','lxor']
for i, n in enumerate(arith): op(0x60 + i, n)
op(0x84, 'iinc', 2)
conv = ['i2l','i2f','i2d','l2i','l2f','l2d','f2i','f2l','f2d','d2i','d2l','d2f','i2b','i2c','i2s','lcmp','fcmpl','fcmpg','dcmpl','dcmpg']
for i, n in enumerate(conv): op(0x85 + i, n)
br = ['ifeq','ifne','iflt','ifge','ifgt','ifle','if_icmpeq','if_icmpne','if_icmplt','if_icmpge','if_icmpgt','if_icmple','if_acmpeq','if_acmpne','goto','jsr']
for i, n in enumerate(br): op(0x99 + i, n, 2)
op(0xa9, 'ret', 1); op(0xaa, 'tableswitch', -1); op(0xab, 'lookupswitch', -1)
for i, n in enumerate(['ireturn','lreturn','freturn','dreturn','areturn','return']): op(0xac + i, n)
for i, n in enumerate(['getstatic','putstatic','getfield','putfield','invokevirtual','invokespecial','invokestatic']): op(0xb2 + i, n, 2)
op(0xb9, 'invokeinterface', 4); op(0xba, 'invokedynamic', 4); op(0xbb, 'new', 2); op(0xbc, 'newarray', 1); op(0xbd, 'anewarray', 2)
op(0xbe, 'arraylength'); op(0xbf, 'athrow'); op(0xc0, 'checkcast', 2); op(0xc1, 'instanceof', 2); op(0xc2, 'monitorenter'); op(0xc3, 'monitorexit')
op(0xc4, 'wide', -2); op(0xc5, 'multianewarray', 3); op(0xc6, 'ifnull', 2); op(0xc7, 'ifnonnull', 2); op(0xc8, 'goto_w', 4)


class CF:
    def __init__(self, data):
        self.d = data
        p = 8
        n = struct.unpack('>H', data[p:p + 2])[0]; p += 2
        cp = [None] * n
        i = 1
        while i < n:
            t = data[p]; p += 1
            if t == 1:
                ln = struct.unpack('>H', data[p:p + 2])[0]; p += 2
                cp[i] = ('utf8', data[p:p + ln].decode('utf-8', 'replace')); p += ln
            elif t == 3: cp[i] = ('int', struct.unpack('>i', data[p:p + 4])[0]); p += 4
            elif t == 4: cp[i] = ('float', struct.unpack('>f', data[p:p + 4])[0]); p += 4
            elif t == 5: cp[i] = ('long', struct.unpack('>q', data[p:p + 8])[0]); p += 8; i += 1
            elif t == 6: cp[i] = ('double', struct.unpack('>d', data[p:p + 8])[0]); p += 8; i += 1
            elif t in (7, 8, 16, 19, 20): cp[i] = (t, struct.unpack('>H', data[p:p + 2])[0]); p += 2
            elif t in (9, 10, 11, 12, 17, 18): cp[i] = (t, struct.unpack('>HH', data[p:p + 4])); p += 4
            elif t == 15: cp[i] = (t, (data[p], struct.unpack('>H', data[p + 1:p + 3])[0])); p += 3
            else: raise ValueError('cp tag %d' % t)
            i += 1
        self.cp = cp
        p += 6
        ni = struct.unpack('>H', data[p:p + 2])[0]; p += 2 + 2 * ni
        self.fields = []
        nf = struct.unpack('>H', data[p:p + 2])[0]; p += 2
        for _ in range(nf):
            acc, nm, ds, na = struct.unpack('>HHHH', data[p:p + 8]); p += 8
            attrs = {}
            for _ in range(na):
                an, al = struct.unpack('>HI', data[p:p + 6]); p += 6
                attrs[self.u(an)] = data[p:p + al]; p += al
            self.fields.append((self.u(nm), self.u(ds), attrs))
        self.methods = []
        nm_ = struct.unpack('>H', data[p:p + 2])[0]; p += 2
        for _ in range(nm_):
            acc, nm, ds, na = struct.unpack('>HHHH', data[p:p + 8]); p += 8
            code = None
            for _ in range(na):
                an, al = struct.unpack('>HI', data[p:p + 6]); p += 6
                if self.u(an) == 'Code': code = data[p:p + al]
                p += al
            self.methods.append((self.u(nm), self.u(ds), code))

    def u(self, i): return self.cp[i][1]

    def s(self, i):
        e = self.cp[i]
        if e is None: return '?'
        t, v = e
        if t == 'utf8': return repr(v)
        if t in ('int', 'long'): return str(v)
        if t in ('float', 'double'): return repr(v)
        if t == 7: return self.u(v)
        if t == 8: return repr(self.u(v))
        if t in (9, 10, 11):
            c, nt = v
            n, d = self.cp[nt][1]
            return '%s.%s:%s' % (self.u(self.cp[c][1]), self.u(n), self.u(d))
        if t == 12: return '%s:%s' % (self.u(v[0]), self.u(v[1]))
        if t == 18:
            n, d = self.cp[v[1]][1]
            return 'indy#%d %s:%s' % (v[0], self.u(n), self.u(d))
        if t == 15: return 'mh(%d,%s)' % (v[0], self.s(v[1]))
        if t == 16: return 'mt(%s)' % self.u(v)
        return str(e)

    def dis(self, code):
        ml, mlc, cl = struct.unpack('>HHI', code[:8])
        b = code[8:8 + cl]
        out = []
        p = 0
        while p < len(b):
            o = b[p]
            name, n = OPS.get(o, ('op%02x' % o, 0))
            at = p; p += 1
            arg = ''
            if n == -1:
                pad = (4 - p % 4) % 4; p += pad
                if name == 'tableswitch':
                    dflt, lo, hi = struct.unpack('>iii', b[p:p + 12]); p += 12
                    offs = struct.unpack('>%di' % (hi - lo + 1), b[p:p + 4 * (hi - lo + 1)]); p += 4 * (hi - lo + 1)
                    arg = 'lo=%d hi=%d default=%d %s' % (lo, hi, at + dflt, [at + x for x in offs])
                else:
                    dflt, np_ = struct.unpack('>ii', b[p:p + 8]); p += 8
                    pairs = [struct.unpack('>ii', b[p + 8 * k:p + 8 * k + 8]) for k in range(np_)]; p += 8 * np_
                    arg = 'default=%d %s' % (at + dflt, [(k, at + v) for k, v in pairs])
            elif n == -2:
                o2 = b[p]; p += 1
                nm2 = OPS[o2][0]
                if nm2 == 'iinc': idx, c = struct.unpack('>Hh', b[p:p + 4]); p += 4; arg = 'iinc %d %d' % (idx, c)
                else: idx = struct.unpack('>H', b[p:p + 2])[0]; p += 2; arg = '%s %d' % (nm2, idx)
            elif n:
                raw = b[p:p + n]; p += n
                if name == 'bipush': arg = str(struct.unpack('>b', raw)[0])
                elif name == 'sipush': arg = str(struct.unpack('>h', raw)[0])
                elif name == 'ldc': arg = self.s(raw[0])
                elif name in ('ldc_w', 'ldc2_w', 'getstatic', 'putstatic', 'getfield', 'putfield', 'invokevirtual', 'invokespecial', 'invokestatic', 'new', 'anewarray', 'checkcast', 'instanceof'):
                    arg = self.s(struct.unpack('>H', raw[:2])[0])
                elif name in ('invokeinterface', 'invokedynamic', 'multianewarray'):
                    arg = self.s(struct.unpack('>H', raw[:2])[0])
                elif name == 'iinc': arg = '%d %d' % (raw[0], struct.unpack('>b', raw[1:2])[0])
                elif name in br or name in ('ifnull', 'ifnonnull'): arg = '-> %d' % (at + struct.unpack('>h', raw)[0])
                elif name == 'goto_w': arg = '-> %d' % (at + struct.unpack('>i', raw)[0])
                else: arg = ' '.join(str(x) for x in raw)
            out.append('%5d %s %s' % (at, name, arg))
        return out


def main():
    cls = sys.argv[1]
    pats = sys.argv[2:]
    z = zipfile.ZipFile(JAR)
    cf = CF(z.read(cls + '.class'))
    if not pats:
        for f in cf.fields: print('field', f[0], f[1])
        for m in cf.methods: print('method', m[0], m[1])
        return
    for nm, ds, code in cf.methods:
        if any(pt == nm or (pt.endswith('*') and nm.startswith(pt[:-1])) for pt in pats):
            print('=== %s%s' % (nm, ds))
            if code: print('\n'.join(cf.dis(code)))


if __name__ == '__main__':
    main()
