"""The Christmas card envelope, as layers: inside with its lining, pocket, flap (outside and lining side), and front.
Each part is a height map lit from the top left, not a drawn shape."""
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from common import *

EW, EH = 1200, 1392
FD = 500            # how far the closed flap's tip reaches
VY = FD - 40        # lowest point of the pocket's V opening
AY = VY + 30        # top of the bottom flap
CX = EW / 2
RED = hexrgb('#82191e')
RED_INSIDE = hexrgb('#74171b')
GREEN = hexrgb('#0d2a22')
GOLD = hexrgb('#bd9849')


def paper_detail(h, w, seed):
    fib = gaussian_filter(fibers(h, w, int(h * w / 22), seed, lo=10, hi=52), .55)
    fine = gaussian_filter(rng(seed + 1).standard_normal((h, w)).astype(F), .7)
    fine /= fine.std()
    mottle = fbm(h, w, seed + 2, octaves=((90, 1), (40, .6), (18, .35), (8, .2)))
    return fib, fine, mottle


def albedo(color, fib, fine, mottle):
    tone = 1 + .014 * mottle + .05 * (fib - fib.mean()) / (fib.std() + 1e-6) * .28 + .008 * fine
    return color[None, None, :] * tone[..., None]


def liner_pattern(h, w, seed=31, px=138, py=216, line=2.1):
    """A gold ogee lattice with a small star in each cell, printed on dark green paper. Returns rgb and the gold's mask."""
    y, x = np.mgrid[0:h, 0:w].astype(F)
    x = x - w / 2  # symmetric about the fold's middle
    amp = px / 2
    s = amp * np.sin(2 * np.pi * y / py)
    d1 = np.abs(((x + s) % px) - px / 2)
    d2 = np.abs(((x - s) % px) - px / 2)
    # Sloped lines look thicker in x, so even the stroke out by the slope.
    slope = np.sqrt(1 + (amp * 2 * np.pi / py * np.cos(2 * np.pi * y / py)) ** 2)
    gold = np.maximum(smooth(line + .9, line - .9, d1 / slope), smooth(line + .9, line - .9, d2 / slope))
    # A small four-point star in the middle of every cell (two offset grids of cells).
    def star(xc, yc):
        rx = np.abs(((x - xc + px / 2) % px) - px / 2)
        ry = np.abs(((y - yc + py / 4) % (py / 2)) - py / 4)
        return (rx ** .6 + ry ** .6) ** (1 / .6)
    stars = np.minimum(star(px / 2, py / 4), star(0, 0))
    gold = np.maximum(gold, smooth(15.5, 13.2, stars))
    fib, fine, mottle = paper_detail(h, w, seed)
    base = albedo(GREEN, fib, fine, mottle) * (.92 + .1 * smooth(-2, 2, mottle))[..., None]
    # Foil: bright and dark patches along the print, a little ink edge.
    sheen = fbm(h, w, seed + 5, octaves=((60, 1), (30, .5), (12, .25)))
    foil = GOLD[None, None, :] * (1.0 + .22 * sheen + .05 * fine)[..., None]
    H = 2.4 * gaussian_filter(gold, 1.0) + .5 * fib
    shade = np.clip(lambert(H), .7, 1.5)
    rgb = base * (1 - gold[..., None]) + foil * gold[..., None] * shade[..., None]
    return rgb * shade[..., None] ** .3, gold


def yy_mask(h, w):
    return np.mgrid[0:h, 0:w][0].astype(F)


def pocket():
    h, w = EH, EW
    left = poly_mask(h, w, [(0, 0), (CX, VY), (CX, AY + 30), (0, h)])
    right = poly_mask(h, w, [(w, 0), (CX, VY), (CX, AY + 30), (w, h)])
    bottom = round_mask(poly_mask(h, w, [(-40, h + 60), (CX, AY), (w + 40, h + 60)]), 12)
    alpha = np.clip(left + right + bottom, 0, 1)
    alpha = round_mask(alpha, 3.5)
    fib, fine, mottle = paper_detail(h, w, 11)
    rim = gaussian_filter(alpha, 5)
    H = 9 * (rim - 1)
    H += 8 * smooth(.25, .75, gaussian_filter(bottom, 1.4))
    # The seam where the side flaps meet.
    seam = np.exp(-((np.arange(w, dtype=F) - CX) / 2.0) ** 2)[None, :] * (1 - bottom)
    H -= 2 * seam
    # The card inside pushes the paper out a little.
    yy, xx = np.mgrid[0:h, 0:w].astype(F)
    pillow = gaussian_filter(((xx > 40) & (xx < w - 40) & (yy > 18) & (yy < h - 26)).astype(F), 24)
    H += 16 * pillow
    H += 3.2 * fbm(h, w, 12, octaves=((140, 1), (70, .4)))
    H += .34 * fib + .11 * fine
    shade = np.clip(lambert(H), .5, 1.5)
    rgb = albedo(RED, fib, fine, mottle) * shade[..., None]
    # The bottom flap's soft shadow on the side flaps, away from the light.
    cast = gaussian_filter(np.roll(np.roll(bottom, 7, axis=1), 9, axis=0), 7) * (1 - bottom) * (yy_mask(h, w) > 12)
    near = gaussian_filter(bottom, 12) * (1 - bottom)
    rgb *= (1 - .42 * cast - .14 * near)[..., None]
    # Flaps tilt slightly into the fold.
    tilt = 1 + .05 * (yy - h / 2) / h - .05 * np.abs(xx - CX) / w
    rgb *= tilt[..., None]
    return rgb, alpha


def inside():
    h, w = EH, EW
    rgb, gold = liner_pattern(h, w)
    yy, xx = np.mgrid[0:h, 0:w].astype(F)
    # It's darker deep in the envelope.
    depth = 1 - .55 * smooth(0, VY + 40, yy)
    rgb = rgb * depth[..., None]
    # The fold at the top.
    crease = np.exp(-(yy / 7) ** 2)
    rgb = rgb * (1 - .4 * crease[..., None])
    rgb += np.array([.25, .2, .14], dtype=F)[None, None, :] * np.exp(-((yy - 16) / 6) ** 2)[..., None] * .35
    # Red paper margin at the sides, as a lined envelope has.
    margin = smooth(30, 26, np.minimum(xx, w - 1 - xx))
    red = RED_INSIDE[None, None, :] * (.72 + .05 * rng(3).standard_normal((h, w)).astype(F)[..., None]) * depth[..., None]
    rgb = rgb * (1 - margin[..., None]) + red * margin[..., None]
    alpha = round_mask(np.ones((h, w), F) * (xx >= 0), 3)
    alpha = round_mask(poly_mask(h, w, [(0, 0), (w, 0), (w, h), (0, h)]), 3.5)
    return rgb, alpha, gold * alpha * depth


def flap_shape(h):
    pts = [(0, 0), (EW, 0), (CX + 18, FD - 2), (CX - 18, FD - 2)]
    return round_mask(poly_mask(h, EW, pts), 16)


def flap_outside():
    h = FD + 12
    w = EW
    alpha = flap_shape(h)
    fib, fine, mottle = paper_detail(h, w, 21)
    yy, xx = np.mgrid[0:h, 0:w].astype(F)
    H = 9 * (gaussian_filter(alpha, 5) - 1)
    # Fold at the top; the flap lifts a hair towards its tip.
    H -= 5 * np.exp(-((yy - 2) / 7) ** 2)
    H += 12 * smooth(0, FD, yy)
    H += 2.4 * fbm(h, w, 22, octaves=((110, 1), (55, .4)))
    H += .34 * fib + .11 * fine
    shade = np.clip(lambert(H), .5, 1.5)
    rgb = albedo(RED, fib, fine, mottle) * shade[..., None]
    # Top lit a little more than the tip.
    rgb *= (1.05 - .08 * yy / h)[..., None]
    return rgb, alpha


def flap_inside():
    """The lining side, seen when the flap is open: tip up, fold at the bottom."""
    h = FD + 12
    w = EW
    alpha = flap_shape(h)
    # A rim of envelope paper around the lining.
    lining = round_mask(flap_shape(h) * poly_mask(h, w, [(0, 0), (w, 0), (w, h), (0, h)]), 3)
    from scipy.ndimage import distance_transform_edt
    dist = distance_transform_edt(alpha > .5).astype(F)
    # The fold side has no rim.
    yy, xx = np.mgrid[0:h, 0:w].astype(F)
    dist = np.where(yy < 40, np.maximum(dist, 60), dist)
    lining = smooth(26, 30, dist)
    rgb_l, gold = liner_pattern(h, w, seed=37)
    fib, fine, mottle = paper_detail(h, w, 25)
    red = albedo(RED_INSIDE, fib, fine, mottle)
    H = 9 * (gaussian_filter(alpha, 5) - 1) + 2.0 * gaussian_filter(lining, 1.2) + .7 * fib + .2 * fine
    shade = np.clip(lambert(H), .55, 1.4)
    rgb = (red * (1 - lining[..., None]) + rgb_l * lining[..., None]) * shade[..., None]
    # Flip so the tip is up.
    rgb = rgb[::-1]
    alpha = alpha[::-1]
    gold = (gold * lining)[::-1]
    # Near the fold (now at the bottom) it darkens.
    yy2 = np.arange(h, dtype=F)[:, None]
    fold = np.exp(-((h - 1 - yy2) / 18) ** 2)
    rgb = rgb * (1 - .3 * fold)[..., None]
    rgb = rgb * (1.06 - .1 * (yy2 / h))[..., None]
    return rgb, alpha, gold * alpha


def shifted(a, dx, dy):
    """Move a mask without wrapping it round the edges."""
    out = np.zeros_like(a)
    out[dy:, dx:] = a[:a.shape[0] - dy, :a.shape[1] - dx]
    return out


def shadow_layers(pocket_alpha, flap_alpha):
    """Soft shadows: what the pocket throws on the card and lining; what the closed flap throws on the pocket."""
    s = gaussian_filter(shifted(pocket_alpha, 6, 12), 10)
    pocket_shadow = np.clip(s, 0, 1) * .62
    full = np.zeros((EH, EW), F)
    full[:flap_alpha.shape[0], :EW] = flap_alpha
    f = gaussian_filter(shifted(full, 7, 12), 11)
    return pocket_shadow, np.clip(f, 0, 1) * .72


def front():
    h, w = EH, EW
    fib, fine, mottle = paper_detail(h, w, 41)
    alpha = round_mask(poly_mask(h, w, [(0, 0), (w, 0), (w, h), (0, h)]), 3.5)
    yy, xx = np.mgrid[0:h, 0:w].astype(F)
    H = 9 * (gaussian_filter(alpha, 5) - 1)
    H += 7 * gaussian_filter(((xx > 40) & (xx < w - 40) & (yy > 18) & (yy < h - 26)).astype(F), 30)
    H += 3.2 * fbm(h, w, 42, octaves=((140, 1), (70, .4)))
    H -= 5 * np.exp(-((yy - 3) / 6) ** 2)
    H += .34 * fib + .11 * fine
    shade = np.clip(lambert(H), .5, 1.5)
    rgb = albedo(RED, fib, fine, mottle) * shade[..., None]
    rgb *= (1.03 - .06 * yy / h)[..., None]
    return rgb, alpha


if __name__ == '__main__':
    import time
    t = time.time()
    p_rgb, p_a = pocket()
    i_rgb, i_a, i_gold = inside()
    fo_rgb, fo_a = flap_outside()
    fi_rgb, fi_a, fi_gold = flap_inside()
    fr_rgb, fr_a = front()
    ps, fs = shadow_layers(p_a, fo_a)
    print('computed', round(time.time() - t, 1))
    np.savez_compressed(OUT + 'env-layers.npz', p_rgb=p_rgb.astype(np.float16), p_a=p_a.astype(np.float16), i_rgb=i_rgb.astype(np.float16), i_a=i_a.astype(np.float16), i_gold=i_gold.astype(np.float16), fo_rgb=fo_rgb.astype(np.float16), fo_a=fo_a.astype(np.float16), fi_rgb=fi_rgb.astype(np.float16), fi_a=fi_a.astype(np.float16), fi_gold=fi_gold.astype(np.float16), fr_rgb=fr_rgb.astype(np.float16), fr_a=fr_a.astype(np.float16), ps=ps.astype(np.float16), fs=fs.astype(np.float16))
    save_webp(to_img(p_rgb, p_a), 'env-pocket.webp')
    save_webp(to_img(i_rgb, i_a), 'env-inside.webp')
    save_webp(to_img(fo_rgb, fo_a), 'env-flap-out.webp')
    save_webp(to_img(fi_rgb, fi_a), 'env-flap-in.webp')
    white = np.ones_like(fi_rgb)
    save_webp(to_img(white, fi_gold).resize((EW // 2, (FD + 12) // 2), Image.LANCZOS), 'env-flap-gold.webp', q=50, alpha_q=70)
    # Shadows are soft, so a quarter size is plenty.
    black = np.zeros((EH, EW, 3), F)
    save_webp(to_img(black, ps).resize((EW // 4, EH // 4), Image.LANCZOS), 'env-pocket-shadow.webp', q=60, alpha_q=70)
    save_webp(to_img(black, fs).resize((EW // 4, EH // 4), Image.LANCZOS), 'env-flap-shadow.webp', q=60, alpha_q=70)
    np.save(OUT + 'front-rgb.npy', fr_rgb.astype(np.float16))
    np.save(OUT + 'front-a.npy', fr_a.astype(np.float16))
    # A look: closed back and open back, on a neutral table, for judging.
    wax = Image.open(OUT + 'wax-gold.png').convert('RGBA')
    table = Image.new('RGBA', (EW * 2 + 300, EH + FD + 200), (58, 54, 58, 255))
    # closed
    ox, oy = 100, FD + 100
    table.alpha_composite(to_img(p_rgb, p_a), (ox, oy))
    fs_img = to_img(black, fs)
    table.alpha_composite(fs_img, (ox, oy))
    table.alpha_composite(to_img(fo_rgb, fo_a), (ox, oy))
    w = wax.resize((300, 300), Image.LANCZOS)
    table.alpha_composite(w, (ox + EW // 2 - 150, oy + FD - 180))
    # open
    ox2 = ox + EW + 100
    table.alpha_composite(to_img(i_rgb, i_a), (ox2, oy))
    table.alpha_composite(to_img(fi_rgb, fi_a), (ox2, oy - FD - 12))
    table.alpha_composite(to_img(black, ps), (ox2, oy))
    table.alpha_composite(to_img(p_rgb, p_a), (ox2, oy))
    table.convert('RGB').resize((table.size[0] // 2, table.size[1] // 2), Image.LANCZOS).save(OUT + 'env-look.jpg', quality=90)
    print('done', round(time.time() - t, 1))
