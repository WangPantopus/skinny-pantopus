"""Shared helpers: noise, paper fibres, lighting from height maps, masks."""
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter

OUT = __file__.rsplit('/', 1)[0] + '/out/'
A = __file__.rsplit('/', 2)[0] + '/a/'
F = np.float32


def rng(seed):
    return np.random.default_rng(seed)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def fbm(h, w, seed, octaves=((96, 1.0), (48, .6), (24, .35), (12, .2), (6, .12), (3, .07), (1.5, .04)), wrap=False):
    r = rng(seed)
    out = np.zeros((h, w), F)
    for sigma, amp in octaves:
        n = r.standard_normal((h, w)).astype(F)
        n = gaussian_filter(n, sigma, mode='wrap' if wrap else 'reflect')
        n /= n.std() + 1e-6
        out += amp * n
    return out / (out.std() + 1e-6)


def fibers(h, w, count, seed, lo=14, hi=70, width=1, ss=1, wrap=False):
    """Short bent paper fibres as a 0..1 height layer."""
    r = rng(seed)
    im = Image.new('L', (w * ss, h * ss), 0)
    d = ImageDraw.Draw(im)
    for _ in range(count):
        x, y = r.uniform(0, w * ss), r.uniform(0, h * ss)
        length = r.uniform(lo, hi) * ss
        a = r.uniform(0, 2 * np.pi)
        bend = r.uniform(-.9, .9)
        pts = []
        for t in np.linspace(0, 1, 6):
            ang = a + bend * t
            pts.append((x + np.cos(ang) * length * t, y + np.sin(ang) * length * t))
        tone = int(r.uniform(70, 255))
        d.line(pts, fill=tone, width=width * ss)
        if wrap:
            for dx in (-w * ss, 0, w * ss):
                for dy in (-h * ss, 0, h * ss):
                    if dx or dy:
                        d.line([(p[0] + dx, p[1] + dy) for p in pts], fill=tone, width=width * ss)
    if ss > 1:
        im = im.resize((w, h), Image.LANCZOS)
    return np.asarray(im, F) / 255


LIGHT = np.array([-.46, -.60, .66], dtype=F)
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def normals(H):
    gy, gx = np.gradient(H.astype(F))
    nz = np.ones_like(gx)
    length = np.sqrt(gx * gx + gy * gy + nz * nz)
    return -gx / length, -gy / length, nz / length


def lambert(H, light=LIGHT):
    nx, ny, nz = normals(H)
    return np.clip(nx * light[0] + ny * light[1] + nz * light[2], 0, None) / light[2]


def blinn(H, shininess, light=LIGHT):
    nx, ny, nz = normals(H)
    hv = light + np.array([0, 0, 1], dtype=F)
    hv = hv / np.linalg.norm(hv)
    return np.clip(nx * hv[0] + ny * hv[1] + nz * hv[2], 0, 1) ** shininess


def hexrgb(s):
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], dtype=F) / 255


def poly_mask(h, w, pts, ss=3):
    im = Image.new('L', (w * ss, h * ss), 0)
    ImageDraw.Draw(im).polygon([(x * ss, y * ss) for x, y in pts], fill=255)
    return np.asarray(im.resize((w, h), Image.LANCZOS), F) / 255


def round_mask(mask, r):
    """Round convex and concave corners by blurring and re-thresholding, keeping a clean anti-aliased edge."""
    b = gaussian_filter(mask, r)
    return smooth(.5 - .9 / (r * 1.6 + 1), .5 + .9 / (r * 1.6 + 1), b)


def to_img(rgb, alpha=None):
    rgb8 = (np.clip(rgb, 0, 1) * 255 + .5).astype(np.uint8)
    if alpha is None:
        return Image.fromarray(rgb8, 'RGB')
    a8 = (np.clip(alpha, 0, 1) * 255 + .5).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb8, a8]), 'RGBA')


def save_webp(img, name, q=84, alpha_q=90, folder=None):
    path = (folder or A) + name
    img.save(path, 'WEBP', quality=q, alpha_quality=alpha_q, method=6)
    import os
    print(f'{name}: {img.size[0]}x{img.size[1]} {os.path.getsize(path) // 1024} KB')


def on_gray(rgba, bg=(44, 42, 48)):
    """For looking at an alpha layer."""
    base = Image.new('RGBA', rgba.size, bg + (255,))
    base.alpha_composite(rgba)
    return base.convert('RGB')
