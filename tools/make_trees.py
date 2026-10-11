#!/usr/bin/env python3
"""ps2 / mgs2-flavoured PNW tree concepts.

real 3d trunks + branches (tapered low-sided tubes) with small alpha-card
sprays clustered along them in 3d. no billboard-trees. textures are generated
procedurally at ps2-ish res and sampled nearest-neighbour.

usage: python3 tools/make_trees.py -- <out_dir>
"""
import math
import os
import random
import sys

import bpy
import numpy as np
from mathutils import Quaternion, Vector
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "trees"
TEX = os.path.join(OUT, "textures")
PRE = os.path.join(OUT, "previews")
os.makedirs(TEX, exist_ok=True)
os.makedirs(PRE, exist_ok=True)
Z = Vector((0, 0, 1))


# ---------------------------------------------------------------- textures
def _noise(img_arr, rng, amt=4):
    n = rng.randint(-amt, amt + 1, img_arr.shape[:2] + (1,))
    img_arr[..., :3] = np.clip(img_arr[..., :3].astype(int) + n, 0, 255)
    return img_arr


def _line(d, p0, p1, col):
    d.line([p0, p1], fill=col + (255,), width=1)


def spray_png(path, seed, greens, stem=(58, 44, 34), pairs=18, maxlen=52, ang=50,
              needle=4, nspace=2.4, sub=False, size=128):
    """feathery frond: stem up the middle, twig pairs, needle ticks, dark underlay."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, y0, y1 = size // 2, size - 2, 8
    right, left, twigs = [], [], []
    for i in range(pairs):
        t = i / (pairs - 1)
        y = y0 - (y0 - y1) * (0.06 + 0.9 * t)
        L = max(7, maxlen * (1 - 0.82 * t ** 1.15))
        for side in (-1, 1):
            a = math.radians(ang + rng.uniform(-7, 7) - 12 * t)
            ex = cx + side * math.sin(a) * L * rng.uniform(0.85, 1.1)
            ey = y - math.cos(a) * L * rng.uniform(0.8, 1.0)
            twigs.append(((cx, y), (ex, ey), side))
            (right if side > 0 else left).append((ex, ey))
    under = [(cx, y0)] + right + [(cx, y1)] + left[::-1]
    d.polygon(under, fill=greens[2] + (255,))
    _line(d, (cx, y0), (cx, y1), stem)
    for (x0, y0_), (x1, y1_), side in twigs:
        _line(d, (x0, y0_), (x1, y1_), stem)
        dx, dy = x1 - x0, y1_ - y0_
        ln = math.hypot(dx, dy)
        ux, uy = dx / ln, dy / ln
        s = 2.0
        while s < ln:
            px, py = x0 + ux * s, y0_ + uy * s
            for k in (-1, 1):
                ca, sa = math.cos(math.radians(55 * k)), math.sin(math.radians(55 * k))
                vx, vy = ux * ca - uy * sa, ux * sa + uy * ca
                nl = needle * rng.uniform(0.6, 1.2)
                _line(d, (px, py), (px + vx * nl, py + vy * nl), rng.choice(greens))
            s += nspace
        if sub:
            s = 6.0
            while s < ln - 4:
                px, py = x0 + ux * s, y0_ + uy * s
                for k in (-1, 1):
                    ca, sa = math.cos(math.radians(38 * k)), math.sin(math.radians(38 * k))
                    vx, vy = ux * ca - uy * sa, ux * sa + uy * ca
                    _line(d, (px, py), (px + vx * 9, py + vy * 9 + 3), rng.choice(greens))
                s += 4.5
    arr = _noise(np.array(img), np.random.RandomState(seed), 3)
    Image.fromarray(arr).save(path)


def leaf_png(path, seed, greens, kind="maple", count=110, accents=(), radius=56, size=128):
    rng = random.Random(seed)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts_all = []
    for _ in range(count):
        while True:
            x, y = rng.uniform(-1, 1), rng.uniform(-1, 1)
            if x * x + y * y <= 1:
                break
        pts_all.append((size / 2 + x * radius, size / 2 + y * radius * 0.9))
    pts_all.sort(key=lambda p: -p[1])  # lower leaves first (drawn under)
    for (cx, cy) in pts_all:
        s = rng.uniform(8, 13) if kind == "maple" else rng.uniform(7, 11)
        rot = rng.uniform(0, 6.283)
        shade = 0.6 + 0.5 * (1 - (cy / size))
        base = rng.choice(accents) if (accents and rng.random() < 0.1) else rng.choice(greens)
        col = tuple(int(min(255, c * shade)) for c in base) + (255,)
        if kind == "maple":
            poly = [(cx, cy)]
            for j in range(11):
                a = rot - math.radians(120) + j * math.radians(240 / 10)
                r = s if j % 2 == 0 else s * 0.45
                poly.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        else:  # pointed oval
            shape = [(0, 0), (-0.5, 0.35), (-0.45, 0.8), (0, 1.35), (0.45, 0.8), (0.5, 0.35)]
            poly = []
            for px, py in shape:
                px, py = px * s, py * s
                poly.append((cx + px * math.cos(rot) - py * math.sin(rot),
                             cy + px * math.sin(rot) + py * math.cos(rot)))
        d.polygon(poly, fill=col)
        _line(d, (cx, cy), poly[len(poly) // 2], tuple(int(c * 0.6) for c in base))
    arr = _noise(np.array(img), np.random.RandomState(seed), 3)
    Image.fromarray(arr).save(path)


def lichen_png(path, seed, w=64, h=128):
    """hanging moss / old man's beard. drawn hung from the top, then flipped so
    the attachment point is at the bottom of the image (card base)."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cols = [(110, 128, 84), (92, 112, 70), (132, 146, 104), (72, 92, 58)]
    d.rectangle([0, 0, w, 6], fill=(70, 88, 52, 255))
    for x in range(0, w, 2):
        if rng.random() < 0.8:
            ln = int(rng.uniform(34, 124) * (1 - abs(x - w / 2) / w * 0.8))
            ph = rng.uniform(0, 6)
            c = rng.choice(cols)
            for y in range(6, ln):
                xx = int(x + 1.6 * math.sin(y / 6 + ph))
                d.point((xx, y), fill=c + (255,))
                if rng.random() < 0.4:
                    d.point((xx + 1, y), fill=c + (255,))
    img = img.transpose(Image.FLIP_TOP_BOTTOM)
    Image.fromarray(_noise(np.array(img), np.random.RandomState(seed), 3)).save(path)


def bark_png(path, seed, dark, mid, light, run=(12, 40), moss=0.0, lenticel=False,
             w=64, h=128, mossc=((58, 76, 40), (76, 94, 50), (44, 60, 36))):
    rng = np.random.RandomState(seed)
    colv = rng.rand(w)
    sm = 2
    k = np.ones(sm * 2 + 1) / (sm * 2 + 1)
    colv = np.convolve(np.r_[colv[-sm:], colv, colv[:sm]], k, "valid")
    colv = (colv - colv.min()) / (colv.max() - colv.min() + 1e-6)
    arr = np.zeros((h, w))
    for x in range(w):
        y = -rng.randint(0, run[1])
        while y < h:
            r = rng.randint(run[0], run[1] + 1)
            arr[max(y, 0):max(y + r, 0), x] = 0.65 * colv[x] + 0.35 * rng.rand()
            y += r
    t = np.clip(np.floor(arr * 5) / 4, 0, 1)[..., None]
    dk, md, lt = (np.array(c, float) for c in (dark, mid, light))
    img = np.where(t < 0.5, dk + (md - dk) * (t * 2), md + (lt - md) * ((t - 0.5) * 2))
    if moss > 0:
        low = np.kron(rng.rand(h // 8, w // 8), np.ones((8, 8)))
        m = (low + rng.rand(h, w) * 0.3) > (1 - moss)
        mc = np.array(mossc, float)[rng.randint(0, len(mossc), (h, w))]
        img = np.where(m[..., None], mc * (0.6 + 0.6 * arr[..., None]), img)
    if lenticel:
        for _ in range(46):
            yy, xx, ln = rng.randint(0, h), rng.randint(0, w - 8), rng.randint(3, 8)
            img[yy, xx:xx + ln] = dk * 0.7
        for _ in range(10):
            yy, xx = rng.randint(0, h - 6), rng.randint(0, w - 8)
            img[yy:yy + 5, xx:xx + 6] = (150, 164, 130)
    img = np.clip(img + rng.randint(-5, 6, (h, w, 1)), 0, 255).astype(np.uint8)
    out = np.dstack([img, np.full((h, w, 1), 255, np.uint8)])
    Image.fromarray(out).save(path)


def ground_png(path, seed=3, n=64):
    rng = np.random.RandomState(seed)
    low = np.kron(rng.rand(n // 4, n // 4), np.ones((4, 4)))
    cols = np.array([(52, 46, 36), (72, 62, 42), (56, 72, 44), (38, 34, 28)], float)
    idx = np.clip((low * 2.2 + rng.rand(n, n) * 1.2).astype(int), 0, 3)
    img = cols[idx]
    for _ in range(120):  # needle duff
        x, y = rng.randint(0, n - 4), rng.randint(0, n - 4)
        for s in range(4):
            img[y + s, x + s // 2] = (96, 78, 50)
    img = np.clip(img + rng.randint(-4, 5, (n, n, 1)), 0, 255).astype(np.uint8)
    Image.fromarray(np.dstack([img, np.full((n, n, 1), 255, np.uint8)])).save(path)


def fungus_png(path):
    img = np.zeros((16, 4, 4), np.uint8)
    for y in range(16):
        c = (214, 200, 160) if y < 10 else (186, 120, 52) if y < 14 else (96, 62, 34)
        img[y, :] = c + (255,)
    Image.fromarray(img).save(path)


def make_textures():
    t = lambda n: os.path.join(TEX, n)
    spray_png(t("spray_fir.png"), 1, [(34, 58, 44), (46, 74, 52), (28, 48, 38), (62, 90, 60)],
              pairs=18, maxlen=52, ang=48, needle=4)
    spray_png(t("spray_cedar.png"), 2, [(58, 78, 40), (72, 94, 46), (46, 64, 36), (88, 104, 52)],
              pairs=12, maxlen=56, ang=74, needle=2, nspace=3, sub=True)
    spray_png(t("spray_hemlock.png"), 3, [(52, 82, 60), (70, 100, 70), (40, 66, 50), (96, 124, 84)],
              pairs=22, maxlen=40, ang=60, needle=3, nspace=2)
    leaf_png(t("leaves_maple.png"), 4, [(36, 60, 34), (48, 78, 40), (62, 92, 44), (26, 46, 30)],
             "maple", 120, accents=[(176, 150, 56), (150, 140, 50)])
    leaf_png(t("leaves_alder.png"), 5, [(86, 112, 60), (104, 130, 70), (70, 96, 52), (122, 146, 86)],
             "alder", 80, radius=58)
    lichen_png(t("lichen.png"), 6)
    bark_png(t("bark_fir.png"), 10, (40, 28, 24), (74, 48, 38), (108, 72, 54), (14, 48))
    bark_png(t("bark_cedar.png"), 11, (62, 44, 38), (104, 76, 64), (134, 102, 86), (30, 90))
    bark_png(t("bark_hemlock.png"), 12, (44, 38, 40), (78, 66, 62), (108, 94, 88), (8, 24))
    bark_png(t("bark_maple.png"), 13, (52, 48, 40), (88, 84, 70), (116, 112, 92), (12, 40), moss=0.5)
    bark_png(t("bark_snag.png"), 14, (60, 56, 52), (128, 124, 116), (170, 166, 156), (20, 70))
    bark_png(t("bark_alder.png"), 15, (80, 80, 76), (176, 174, 164), (214, 212, 202), (40, 100),
             lenticel=True)
    ground_png(t("ground.png"))
    fungus_png(t("fungus.png"))


# ---------------------------------------------------------------- geometry
class MB:
    """tiny mesh builder: verts w/ colour, faces w/ per-loop uvs."""

    def __init__(s):
        s.v, s.c, s.f, s.uv = [], [], [], []

    def vert(s, p, c):
        s.v.append((p.x, p.y, p.z))
        s.c.append(c)
        return len(s.v) - 1

    def face(s, idx, uvs):
        s.f.append(idx)
        s.uv.append(uvs)

    def tris(s):
        return sum(len(f) - 2 for f in s.f)

    def build(s, name, mat):
        me = bpy.data.meshes.new(name)
        me.from_pydata(s.v, [], s.f)
        me.update()
        me.uv_layers.new(name="UVMap").data.foreach_set(
            "uv", [x for uvs in s.uv for uv in uvs for x in uv])
        ca = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        cols = []
        for f in s.f:
            for i in f:
                cols += [*s.c[i], 1.0]
        ca.data.foreach_set("color", cols)
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def tube(mb, pts, radii, sides, ucount=1.0, vscale=1.0, bright=None, tint=(1, 1, 1), radial=None):
    n = len(pts)
    t0 = (pts[1] - pts[0]).normalized()
    a = t0.cross(Z if abs(t0.z) < 0.9 else Vector((1, 0, 0))).normalized()
    rings, vs, acc = [], [], 0.0
    for i, p in enumerate(pts):
        t = ((pts[i + 1] - p) if i < n - 1 else (p - pts[i - 1])).normalized()
        a = a - t * a.dot(t)
        a = a.normalized() if a.length > 1e-5 else t.orthogonal().normalized()
        b = t.cross(a)
        if i:
            acc += (p - pts[i - 1]).length
        vs.append(acc * vscale)
        br = 1.0 if bright is None else bright[i]
        col = (tint[0] * br, tint[1] * br, tint[2] * br)
        ring = []
        for k in range(sides):
            ang = 2 * math.pi * k / sides
            r = radii[i] * (radial(k, i) if radial else 1.0)
            ring.append(mb.vert(p + (a * math.cos(ang) + b * math.sin(ang)) * r, col))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            mb.face([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]],
                    [(ucount * k / sides, vs[i]), (ucount * (k + 1) / sides, vs[i]),
                     (ucount * (k + 1) / sides, vs[i + 1]), (ucount * k / sides, vs[i + 1])])


def card(mb, base, u, v, w, l, droop=0.0, tint=(1, 1, 1), dark=0.5, segs=2):
    u, v = u.normalized(), v.normalized()
    rows = []
    for j in range(segs + 1):
        t = j / segs
        pos = base + v * (l * t) - Z * (droop * l * t * t)
        sh = dark + (1 - dark) * t
        col = (tint[0] * sh, tint[1] * sh, tint[2] * sh)
        rows.append((mb.vert(pos - u * (w / 2), col), mb.vert(pos + u * (w / 2), col)))
    for j in range(segs):
        t0, t1 = j / segs, (j + 1) / segs
        mb.face([rows[j][0], rows[j][1], rows[j + 1][1], rows[j + 1][0]],
                [(0, t0), (1, t0), (1, t1), (0, t1)])


def path_at(pts, z):
    for a, b in zip(pts, pts[1:]):
        if a.z <= z <= b.z:
            f = (z - a.z) / max(b.z - a.z, 1e-6)
            return a.lerp(b, f)
    return pts[-1].copy()


def spray_cards(fol, P, T, count, l, w, spread, droop, roll, rng, tint, dark=0.5):
    for s in range(count):
        sgn = (-1 if s % 2 == 0 else 1) if count > 1 else 0
        v = (Quaternion(Z, sgn * spread * (0.7 + 0.6 * rng.random())) @ T).normalized()
        u = v.cross(Z)
        u = Vector((1, 0, 0)) if u.length < 1e-3 else u.normalized()
        u = Quaternion(v, rng.uniform(-roll, roll)) @ u
        j = rng.uniform(0.88, 1.08)
        card(fol, P, u, v, w * rng.uniform(0.9, 1.15), l * rng.uniform(0.85, 1.15), droop,
             (tint[0] * j, tint[1] * j, tint[2] * j), dark)


def bough(bark, fol, O, az, L, pitch, dzf, r0, stations, cl, cw, spread, droop, rng, tint,
          cards_per=2, roll=0.35, sides=3, seg=4):
    h = Vector((math.cos(az), math.sin(az), 0))

    def P(t):
        return O + h * (t * L * math.cos(pitch)) + Vector((0, 0, t * L * math.sin(pitch) + dzf(t) * L))

    ts = [i / seg for i in range(seg + 1)]
    tube(bark, [P(t) for t in ts], [max(r0 * (1 - t) ** 0.9, 0.012) for t in ts], sides, vscale=0.5)
    for st in stations:
        T = (P(min(st + 0.05, 1.0)) - P(max(st - 0.05, 0.0))).normalized()
        l = L * cl * (1 - 0.5 * st) + 0.25
        spray_cards(fol, P(st), T, cards_per, l, l * cw, spread, droop, roll, rng, tint)


def limb(bark, O, az, reach, rise, r0, r1, sides, segs, wobble, rng, vs=0.5):
    h = Vector((math.cos(az), math.sin(az), 0))
    pts = []
    for i in range(segs + 1):
        t = i / segs
        p = O + h * (reach * t ** 1.25) + Z * (rise * (1 - (1 - t) ** 1.7))
        p += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.5, 0.5))) * wobble * (t * (1 - t)) * 4
        pts.append(p)
    tube(bark, pts, [r0 + (r1 - r0) * (i / segs) ** 0.8 for i in range(segs + 1)], sides, vscale=vs)
    return pts


def leaf_clump(fol, c, size, rng, tint, dark=0.55):
    a0 = rng.uniform(0, math.pi)
    for k in range(2):
        a = a0 + k * math.pi / 2
        card(fol, c - Z * size * 0.45, Vector((math.cos(a), math.sin(a), 0)), Z, size, size * 0.95,
             0.0, tint, dark, segs=1)
    a = rng.uniform(0, 6.28)
    u, v = Vector((math.cos(a), math.sin(a), 0)), Vector((-math.sin(a), math.cos(a), 0))
    card(fol, c + Z * size * 0.1 - v * size * 0.5, u, v, size, size, 0.0, tint, 0.8, segs=1)


def strands(fol, P, rng, n=2, w=0.55, l=1.1):
    a0 = rng.uniform(0, math.pi)
    for k in range(n):
        a = a0 + k * math.pi / max(n, 1)
        card(fol, P, Vector((math.cos(a), math.sin(a), 0)), -Z, w, l * rng.uniform(0.8, 1.2),
             0.0, (1, 1, 1), 0.9, segs=1)


def roots(bark, rng, n, r, length, z0=0.5):
    a0 = rng.uniform(0, 6.28)
    for i in range(n):
        a = a0 + i * 2 * math.pi / n + rng.uniform(-0.3, 0.3)
        h = Vector((math.cos(a), math.sin(a), 0))
        L = length * rng.uniform(0.7, 1.2)
        pts = [Vector((0, 0, z0)) + h * 0.0, Vector((0, 0, z0 * 0.5)) + h * L * 0.45,
               Vector((0, 0, -0.05)) + h * L]
        tube(bark, pts, [r, r * 0.55, 0.03], 4, vscale=0.5)


# ------------------------------------------------------------------- trees
def build_fir(seed=1):
    rng = random.Random(seed)
    bark, fol = MB(), MB()
    H = 10.4
    zs = [-0.3, 0.4, 1.4, 2.8, 4.6, 6.4, 8.0, 9.2, H]
    pts = [Vector((0.10 * math.sin(z * 0.7 + 1) * (max(z, 0) / H) ** 0.5, 0.07 * math.sin(z * 0.5), z)) for z in zs]
    rad = lambda z: (0.40 * (1 - max(z, 0) / H) ** 0.85 + 0.02) * (1 + 0.55 * math.exp(-max(z, 0) / 0.7))
    tube(bark, pts, [rad(z) for z in zs], 7, ucount=2, vscale=1 / 2.5,
         bright=[0.7 + 0.3 * z / H for z in zs])
    roots(bark, rng, 4, 0.2, 1.1)
    tint = (0.95, 1.0, 1.02)
    z = 2.6
    while z < 9.6:
        fr = (z - 2.2) / 8.0
        L = 3.6 * (1 - fr) ** 0.95 + 0.45
        a0 = rng.uniform(0, 2 * math.pi)
        for b in range(4):
            bough(bark, fol, path_at(pts, z), a0 + b * math.pi / 2 + rng.uniform(-0.3, 0.3), L,
                  math.radians(-12 + fr * 38), lambda t: -0.20 * t ** 1.6 + 0.10 * t ** 3,
                  0.05 + 0.012 * L, (0.3, 0.6, 0.9) if z > 4 else (0.5, 0.85), 0.6, 1.0,
                  math.radians(38), 0.4, rng, tint, cards_per=3)
        z += rng.uniform(0.45, 0.62)
    top = pts[-1]
    for k in range(3):
        a = k * math.pi / 3
        card(fol, top - Z * 1.2, Vector((math.cos(a), math.sin(a), 0)), Z, 1.0, 2.0, 0.0, tint, 0.6, segs=2)
    return "Douglas Fir", "tall conical tiers, drooping-then-upturned boughs, dark furrowed bark", \
        dict(bark=(bark, "bark_fir.png", False), fol=(fol, "spray_fir.png", True))


def build_cedar(seed=2):
    rng = random.Random(seed)
    bark, fol = MB(), MB()
    H = 8.8
    zs = [-0.3, 0.3, 1.2, 2.6, 4.2, 5.8, 7.2, H]
    pts = [Vector((0.06 * math.sin(z * 0.9), 0.05 * math.cos(z * 0.6), z)) for z in zs]
    rad = lambda z: (0.62 * (1 - max(z, 0) / H) ** 0.6 + 0.02) * (1 + 0.9 * math.exp(-max(z, 0) / 0.9))
    tube(bark, pts, [rad(z) for z in zs], 10, ucount=2, vscale=1 / 2.5,
         bright=[0.7 + 0.3 * z / H for z in zs],
         radial=lambda k, i: (1.0 + (0.16 if k % 2 == 0 else -0.10)) if i < 4 else 1.0)
    roots(bark, rng, 5, 0.3, 1.5, 0.7)
    tint = (1.0, 1.03, 0.92)
    z = 1.8
    while z < 8.2:
        fr = (z - 1.4) / 7.0
        L = 2.7 * (1 - fr) ** 0.9 + 0.5
        a0 = rng.uniform(0, 2 * math.pi)
        for b in range(4):
            a = a0 + b * math.pi / 2 + rng.uniform(-0.3, 0.3)
            O = path_at(pts, z)
            bough(bark, fol, O, a, L, math.radians(-4 + fr * 20),
                  lambda t: -0.42 * t ** 1.5 + 0.18 * t ** 3, 0.05 + 0.012 * L, (0.4, 0.75, 1.0),
                  0.42, 0.9, math.radians(28), 0.9, rng, tint)
            # hanging curtain spray off the outer half of the bough
            h = Vector((math.cos(a), math.sin(a), 0))
            tip = O + h * (0.7 * L) - Z * (0.25 * L)
            card(fol, tip, h.cross(Z), -Z + h * 0.25, 0.8 * L * 0.35 + 0.4, L * 0.35 + 0.5, 0.0, tint, 0.45)
        z += rng.uniform(0.5, 0.7)
    for k in range(3):
        a = k * math.pi / 3
        card(fol, pts[-1] - Z * 1.0, Vector((math.cos(a), math.sin(a), 0)), Z, 1.1, 1.8, 0.8, tint, 0.6)
    return "Western Red Cedar", "fat fluted flared trunk, long drooping fan sprays, shaggy red-grey bark", \
        dict(bark=(bark, "bark_cedar.png", False), fol=(fol, "spray_cedar.png", True))


def build_hemlock(seed=3):
    rng = random.Random(seed)
    bark, fol = MB(), MB()
    H = 11.6
    zs = [-0.3, 0.4, 2.0, 4.2, 6.4, 8.6, 10.2]
    pts = [Vector((0.12 * math.sin(z * 0.45), 0.08 * math.cos(z * 0.5), z)) for z in zs]
    lead = [pts[-1], pts[-1] + Vector((0.05, 0, 0.7)), pts[-1] + Vector((0.35, 0.05, 1.2)),
            pts[-1] + Vector((0.85, 0.05, 1.35)), pts[-1] + Vector((1.35, 0.05, 1.05))]
    rad = lambda z: (0.30 * (1 - max(z, 0) / H) ** 0.9 + 0.02) * (1 + 0.5 * math.exp(-max(z, 0) / 0.6))
    tube(bark, pts, [rad(z) for z in zs], 6, ucount=2, vscale=1 / 2.5,
         bright=[0.72 + 0.28 * z / H for z in zs])
    tube(bark, lead, [0.04, 0.035, 0.03, 0.022, 0.012], 4)
    roots(bark, rng, 4, 0.16, 0.9, 0.4)
    tint = (1.04, 1.1, 1.0)
    z = 2.0
    while z < 10.2:
        fr = (z - 1.8) / 8.4
        L = 2.7 * (1 - fr) ** 0.8 + 0.5
        a0 = rng.uniform(0, 2 * math.pi)
        for b in range(rng.choice((3, 4))):
            bough(bark, fol, path_at(pts, z), a0 + b * 2 * math.pi / 3.6 + rng.uniform(-0.4, 0.4), L,
                  math.radians(2 + fr * 16), lambda t: 0.18 * t - 0.62 * t * t,
                  0.04 + 0.010 * L, (0.4, 0.75, 1.0), 0.42, 0.7, math.radians(30), 0.9, rng, tint)
        z += rng.uniform(0.3, 0.55)
    for p0, p1 in zip(lead[1:], lead[2:]):
        T = (p1 - p0).normalized()
        spray_cards(fol, p0, T, 2, 0.8, 0.6, math.radians(30), 0.9, 0.4, rng, tint)
    return "Western Hemlock", "slim, drooping leader, arching feathery boughs, scaly grey-brown bark", \
        dict(bark=(bark, "bark_hemlock.png", False), fol=(fol, "spray_hemlock.png", True))


def build_maple(seed=4):
    rng = random.Random(seed)
    bark, fol = MB(), MB()
    zs = [-0.3, 0.5, 1.3, 2.1]
    pts = [Vector((0.05 * math.sin(z), 0.0, z)) for z in zs]
    tube(bark, pts, [0.78, 0.55, 0.46, 0.42], 8, ucount=2, vscale=1 / 2.5,
         radial=lambda k, i: 1.0 + (0.12 if k % 3 == 0 else 0.0) * (1 if i < 2 else 0.3))
    roots(bark, rng, 5, 0.26, 1.3, 0.6)
    tint = (0.95, 1.02, 0.9)
    O = pts[-1] - Z * 0.1
    a0 = rng.uniform(0, 6.28)
    for i in range(4):
        az = a0 + i * math.pi / 2 + rng.uniform(-0.3, 0.3)
        reach, rise = rng.uniform(2.6, 3.4), rng.uniform(3.0, 4.2)
        lp = limb(bark, O, az, reach, rise, 0.30, 0.07, 5, 5, 0.25, rng)
        leaf_clump(fol, lp[-1] + Z * 0.5, rng.uniform(2.4, 2.9), rng, tint)
        leaf_clump(fol, lp[3] + Vector((0, 0, 0.3)) + (lp[3] - lp[2]).normalized() * 0.6, rng.uniform(2.0, 2.5), rng, tint)
        for st, sgn in ((2, 1), (3, -1)):
            az2 = az + sgn * rng.uniform(0.6, 1.0)
            sp = limb(bark, lp[st], az2, rng.uniform(1.6, 2.2), rng.uniform(0.6, 1.6), 0.09, 0.025, 4, 3, 0.1, rng)
            leaf_clump(fol, sp[-1] + Z * 0.4, rng.uniform(2.0, 2.6), rng, tint)
        for st in (1, 2, 3):
            strands(fol, lp[st] - Z * 0.05, rng, 2, 0.55, 1.1)
    return "Bigleaf Maple", "short mossy trunk splitting into big arching limbs, palmate leaf clumps, hanging moss", \
        dict(bark=(bark, "bark_maple.png", False), fol=(fol, "leaves_maple.png", True),
             moss=(None, None, None))


def build_snag(seed=5):
    rng = random.Random(seed)
    bark, fol, fun = MB(), MB(), MB()
    zs = [-0.3, 0.4, 1.6, 3.2, 5.0, 6.8, 8.0]
    pts = [Vector((0.10 * math.sin(z * 0.5), 0.06 * math.sin(z * 0.8), z)) for z in zs]
    rad = lambda z: (0.38 * (1 - max(z, 0) / 11.0) ** 0.9) * (1 + 0.5 * math.exp(-max(z, 0) / 0.7))
    tube(bark, pts, [rad(z) for z in zs], 7, ucount=2, vscale=1 / 2.5,
         bright=[0.7 + 0.3 * z / 8 for z in zs])
    roots(bark, rng, 4, 0.2, 1.0)
    top = pts[-1]
    for hgt, dx, dy in ((8.7, 0.14, 0.0), (9.4, -0.05, 0.1), (8.9, -0.12, -0.1)):
        tube(bark, [top + Vector((dx * 0.2, dy * 0.2, -0.3)), top + Vector((dx, dy, (hgt - 8.0) * 0.6)),
                    Vector((top.x + dx * 1.4, top.y + dy * 1.4, hgt))], [0.15, 0.10, 0.015], 4)
    tint = (1, 1, 1)
    for _ in range(13):
        z = rng.uniform(1.8, 7.6)
        L = rng.uniform(0.35, 1.4)
        a = rng.uniform(0, 6.28)
        bough(bark, fol, path_at(pts, z), a, L, math.radians(rng.uniform(-25, 10)),
              lambda t: -0.2 * t ** 2, 0.07, (), 0.0, 0.0, 0, 0, rng, tint, 0, sides=4, seg=3)
        if rng.random() < 0.6:
            h = Vector((math.cos(a), math.sin(a), 0))
            strands(fol, path_at(pts, z) + h * L * 0.6, rng, 2, 0.5, 1.0)
    for z_ in (3.4, 6.0):  # long dead limbs
        a = rng.uniform(0, 6.28)
        bough(bark, fol, path_at(pts, z_), a, 2.5, math.radians(10), lambda t: -0.35 * t ** 1.7 + 0.1 * math.sin(t * 9) * t,
              0.09, (), 0.0, 0.0, 0, 0, rng, tint, 0, sides=4, seg=5)
        h = Vector((math.cos(a), math.sin(a), 0))
        strands(fol, path_at(pts, z_) + h * 1.2 - Z * 0.2, rng, 2, 0.6, 1.2)
    for z_ in (1.2, 2.6, 4.1):  # bracket fungus
        a = rng.uniform(0, 6.28)
        c0 = path_at(pts, z_)
        r_t = rad(z_) * 0.9
        h = Vector((math.cos(a), math.sin(a), 0))
        ctr = fun.vert(c0 + h * r_t, (1, 1, 1))
        ring = []
        for k in range(7):
            aa = a - 1.0 + k * (2.0 / 6)
            hh = Vector((math.cos(aa), math.sin(aa), 0))
            ring.append(fun.vert(c0 + hh * (r_t + 0.34) - Z * 0.03, (1, 1, 1)))
        for k in range(6):
            fun.face([ctr, ring[k], ring[k + 1]], [(0.5, 0.05), (0.5, 0.95), (0.5, 0.95)])
    return "Standing Snag", "dead broken-top fir, bare stubs, silver-grey wood, bracket fungus, hanging lichen", \
        dict(bark=(bark, "bark_snag.png", False), fol=(fol, "lichen.png", True),
             fun=(fun, "fungus.png", False))


def build_alder(seed=6):
    rng = random.Random(seed)
    bark, fol = MB(), MB()
    zs = [-0.3, 0.5, 1.6, 2.8, 3.6]
    pts = [Vector((0.25 * math.sin(z * 0.6), 0.1 * math.cos(z * 0.7), z)) for z in zs]
    rad = [0.30, 0.22, 0.17, 0.14, 0.12]
    tube(bark, pts, rad, 6, ucount=2, vscale=1 / 2.5)
    roots(bark, rng, 3, 0.1, 0.6, 0.3)
    tint = (1.0, 1.04, 0.92)
    O = pts[-1]
    a0 = rng.uniform(0, 6.28)
    for i in range(2):
        az = a0 + i * math.pi + rng.uniform(-0.3, 0.3)
        lp = limb(bark, O - Z * 0.1, az, rng.uniform(1.2, 1.8), rng.uniform(3.6, 4.4), 0.12, 0.04, 5, 5, 0.15, rng)
        leaf_clump(fol, lp[-1] + Z * 0.4, rng.uniform(1.8, 2.2), rng, tint, 0.65)
        for st in (2, 3, 4):
            az2 = az + rng.choice((-1, 1)) * rng.uniform(1.2, 2.0)
            sp = limb(bark, lp[st], az2, rng.uniform(1.1, 1.8), rng.uniform(0.5, 1.4), 0.05, 0.02, 3, 3, 0.1, rng)
            leaf_clump(fol, sp[-1] + Z * 0.3, rng.uniform(1.5, 1.9), rng, tint, 0.65)
    return "Red Alder", "slim leaning pale trunk with dark lenticels, airy ovate-leaf canopy", \
        dict(bark=(bark, "bark_alder.png", False), fol=(fol, "leaves_alder.png", True))


# --------------------------------------------------------------- rendering
def make_mat(name, png, cutout):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tex = nt.nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(os.path.join(TEX, png))
    img.alpha_mode = "STRAIGHT"
    tex.image, tex.interpolation = img, "Closest"
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    rin = [i for i in mix.inputs if i.type == "RGBA"]
    rout = [o for o in mix.outputs if o.type == "RGBA"][0]
    L = nt.links.new
    L(tex.outputs["Color"], rin[0])
    L(vc.outputs["Color"], rin[1])
    L(rout, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    if cutout:
        mt = nt.nodes.new("ShaderNodeMath")
        mt.operation = "GREATER_THAN"
        mt.inputs[1].default_value = 0.5
        L(tex.outputs["Alpha"], mt.inputs[0])
        L(mt.outputs[0], bsdf.inputs["Alpha"])
    L(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def ground_mb(r):
    mb = MB()
    c = mb.vert(Vector((0, 0, -0.02)), (0.8, 0.8, 0.8))
    n = 28
    ring = [mb.vert(Vector((math.cos(2 * math.pi * k / n) * r, math.sin(2 * math.pi * k / n) * r, -0.02)), (0.5, 0.5, 0.5))
            for k in range(n)]
    s = r / 2.2
    for k in range(n):
        k2 = (k + 1) % n
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * k2 / n
        mb.face([c, ring[k], ring[k2]], [(0, 0), (math.cos(a0) * r / s, math.sin(a0) * r / s),
                                         (math.cos(a1) * r / s, math.sin(a1) * r / s)])
    return mb


def render_tree(slug, parts, res=(512, 640), angles=(35, 125), samples=28):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    lo, hi = [1e9] * 3, [-1e9] * 3
    for key, (mb, png, cut) in parts.items():
        if mb is None or not mb.v:
            continue
        for p in mb.v:
            for i in range(3):
                lo[i], hi[i] = min(lo[i], p[i]), max(hi[i], p[i])
        mb.build(slug + "_" + key, make_mat(key, png, cut))
    gr = min(max(hi[0] - lo[0], hi[1] - lo[1]) * 0.6, 4.5)
    ground_mb(gr).build("ground", make_mat("ground", "ground.png", False))
    height = hi[2] - lo[2]
    halfw = max(hi[0] - lo[0], hi[1] - lo[1]) / 2
    aspect = res[0] / res[1]
    fh = max(height * 1.12, halfw * 2 * 1.1 / aspect)
    target = Vector((0, 0, lo[2] + height * 0.5))
    # world + light
    w = bpy.data.worlds.new("W")
    scn.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.50, 0.57, 0.58, 1)
    bg.inputs[1].default_value = 1.1
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy, sun.angle = 2.6, math.radians(25)
    sun.color = (1.0, 0.96, 0.88)
    so = bpy.data.objects.new("sun", sun)
    so.rotation_euler = (math.radians(52), math.radians(8), math.radians(-30))
    scn.collection.objects.link(so)
    cam = bpy.data.cameras.new("cam")
    cam.lens = 50
    co = bpy.data.objects.new("cam", cam)
    scn.collection.objects.link(co)
    scn.camera = co
    D = (fh / 2) / math.tan(math.atan(18 / 50))
    scn.render.engine = "CYCLES"
    scn.cycles.device = "CPU"
    scn.cycles.samples = samples
    scn.cycles.use_denoising = True
    scn.cycles.transparent_max_bounces = 16
    scn.render.resolution_x, scn.render.resolution_y = res
    scn.view_settings.view_transform = "Standard"
    scn.render.image_settings.file_format = "PNG"
    files = []
    for ai, az in enumerate(angles):
        a = math.radians(az)
        co.location = target + Vector((math.sin(a) * D, -math.cos(a) * D, D * 0.12))
        co.rotation_euler = (target - co.location).to_track_quat("-Z", "Y").to_euler()
        f = os.path.join(PRE, f"_{slug}_{ai}.png")
        scn.render.filepath = f
        bpy.ops.render.render(write_still=True)
        files.append(f)
    return files


def label(img, text, sub=None):
    d = ImageDraw.Draw(img)
    try:
        f1 = ImageFont.load_default(size=22)
        f2 = ImageFont.load_default(size=14)
    except TypeError:
        f1 = f2 = ImageFont.load_default()
    d.rectangle([0, 0, img.width, 54 if sub else 34], fill=(18, 20, 20))
    d.text((10, 6), text, fill=(235, 235, 225), font=f1)
    if sub:
        d.text((10, 34), sub, fill=(170, 180, 170), font=f2)


def main():
    make_textures()
    builders = [build_fir, build_cedar, build_hemlock, build_maple, build_snag, build_alder]
    sheet_cells = []
    for i, fn in enumerate(builders):
        name, blurb, parts = fn()
        slug = name.lower().replace(" ", "_")
        tris = sum(mb.tris() for mb, _, _ in parts.values() if mb)
        print(f"{name}: {tris} tris", flush=True)
        files = render_tree(slug, {k: v for k, v in parts.items() if v[0] is not None})
        ims = [Image.open(f).convert("RGB") for f in files]
        row = Image.new("RGB", (sum(im.width for im in ims), ims[0].height + 54))
        x = 0
        for im in ims:
            row.paste(im, (x, 54))
            x += im.width
        label(row, f"{chr(65 + i)}. {name}  ({tris} tris)", blurb)
        row.save(os.path.join(PRE, f"{chr(97 + i)}_{slug}.png"))
        cell = ims[0].copy()
        cell2 = Image.new("RGB", (cell.width, cell.height + 54))
        cell2.paste(cell, (0, 54))
        label(cell2, f"{chr(65 + i)}. {name}", f"{tris} tris")
        sheet_cells.append(cell2)
        for f in files:
            os.remove(f)
    cw, ch = sheet_cells[0].size
    sheet = Image.new("RGB", (cw * 3, ch * 2))
    for i, c in enumerate(sheet_cells):
        sheet.paste(c, ((i % 3) * cw, (i // 3) * ch))
    sheet.save(os.path.join(PRE, "00_overview.png"))


if __name__ == "__main__":
    main()
