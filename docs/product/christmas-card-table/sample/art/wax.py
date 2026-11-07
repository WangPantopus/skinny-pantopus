"""The wax seal: a poured blob with a pressed centre and the Pantopus mark embossed, lit from a height map."""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates
from common import *

S = 900
R = S * .36


def blob_radius(theta, seed):
    r = rng(seed)
    out = np.ones_like(theta)
    for k, amp in ((2, .018), (3, .03), (5, .022), (7, .014), (11, .008), (17, .004)):
        out += amp * np.cos(k * theta + r.uniform(0, 6.28))
    # A couple of soft lobes where the wax ran further.
    for _ in range(4):
        c = r.uniform(0, 6.28)
        out += r.uniform(.02, .055) * np.exp(-((np.angle(np.exp(1j * (theta - c)))) / r.uniform(.16, .34)) ** 2)
    return out


def make(name, color, seed=4, metal=False, spec_gain=1.0, crack=False):
    y, x = np.mgrid[0:S, 0:S].astype(F)
    dx, dy = x - S / 2, y - S / 2
    d = np.sqrt(dx * dx + dy * dy)
    th = np.arctan2(dy, dx)
    edge = R * blob_radius(th, seed)
    rel = d / edge  # 1 at the wax's edge

    # Mark, drawn in the middle of the pressed disc.
    mark = np.asarray(Image.open(OUT + 'mark.png').convert('RGBA').resize((int(R * 1.02), int(R * 1.02)), Image.LANCZOS), F)[..., 3] / 255
    mk = np.zeros((S, S), F)
    o = (S - mark.shape[0]) // 2
    mk[o:o + mark.shape[0], o:o + mark.shape[1]] = mark

    press_r = R * .74
    # Body: rises quickly at the edge, a thick rounded lip, then the pressed flat disc.
    lip = smooth(1.0, .80, rel)  # 0 outside, 1 inside
    H = 62 * lip ** .55
    # A rounded lip: bulge between the edge and the pressed disc.
    t = np.clip((d - press_r) / np.maximum(edge - press_r, 1), 0, 1)
    H += 26 * np.sin(np.pi * t) * (d > press_r)
    # Pressed disc goes down, with a soft wall.
    H -= 34 * smooth(press_r + 10, press_r - 10, d)
    # A fine ring just inside the press.
    H += 5 * np.exp(-((d - press_r * .93) / 4.5) ** 2)
    # The mark stands up from the pressed disc.
    H += 30 * gaussian_filter(mk, 1.7)
    # Wax is never perfect, but the die leaves the pressed disc nearly smooth: lumps stay on the lip.
    pressed = smooth(press_r + 14, press_r - 14, d)
    roughness = 1 - .86 * pressed
    H += 7 * fbm(S, S, seed + 1, octaves=((48, 1), (24, .6), (12, .3))) * lip * roughness
    H += .55 * fbm(S, S, seed + 2, octaves=((4, 1), (2, .7), (1, .4))) * lip * (1 - .7 * pressed)
    # A very gentle dish in the pressed disc so light rolls across it.
    H += 10 * (d / press_r) ** 2 * pressed
    if crack:
        # The break: a jagged line across the wax where the flap pulled away.
        r0 = rng(seed + 9)
        n_pts = 34
        xs = np.linspace(S * .08, S * .94, n_pts)
        ys = S * .43 + np.cumsum(r0.normal(0, S * .011, n_pts)) + (xs - S / 2) * .13
        line = np.interp(np.arange(S), xs, ys)
        dist = np.abs(y - line[np.clip(x.astype(int), 0, S - 1)])
        H -= 30 * np.exp(-(dist / 3.2) ** 2) * lip
        H += 9 * np.exp(-((dist - 7) / 5) ** 2) * lip
        # A hairline branching off.
        xs2 = np.linspace(S * .52, S * .66, 12)
        ys2 = np.interp(S * .52, xs, ys) + np.cumsum(r0.normal(S * .02, S * .006, 12))
        line2 = np.interp(np.arange(S), xs2, ys2, left=-1e4, right=-1e4)
        dist2 = np.abs(y - line2[np.clip(x.astype(int), 0, S - 1)])
        H -= 12 * np.exp(-(dist2 / 2.0) ** 2) * lip
    # Soft-edge everything a touch so highlights roll rather than alias.
    H = gaussian_filter(H, 1.1)

    alpha = smooth(1.012, .992, rel)

    diff = np.clip(lambert(H), 0, 1.7)
    # Ambient occlusion: darker in the creases.
    ao = np.clip(1 - (gaussian_filter(H, 14) - H) / 34, .45, 1.15)
    base = hexrgb(color)
    # Colour varies a little: thinner wax is lighter at the very edge.
    thin = smooth(.86, 1.0, rel)
    rgb = base[None, None, :] * (.55 + .55 * diff[..., None]) * ao[..., None]
    rgb = rgb * (1 + .22 * thin[..., None])
    # Two lights' highlights: a broad sheen and a tight glint.
    broad = blinn(H, 14)
    tight = blinn(H, 90)
    if metal:
        tint = base * .6 + np.array([1, .9, .72], dtype=F) * .4
        rgb += tint[None, None, :] * (broad[..., None] ** 1.3) * .34 * spec_gain
        rgb += np.array([1, .95, .84], dtype=F)[None, None, :] * tight[..., None] * .5 * spec_gain
        # Fine metallic flake.
        flake = gaussian_filter(rng(seed + 3).standard_normal((S, S)).astype(F), .8)
        rgb *= (1 + .045 * flake / flake.std())[..., None]
    else:
        rgb += np.array([1, .86, .8], dtype=F)[None, None, :] * broad[..., None] * .14 * spec_gain
        rgb += np.array([1, .95, .92], dtype=F)[None, None, :] * tight[..., None] * .62 * spec_gain
    img = to_img(rgb, alpha)
    # Trim to the wax, keeping it centred.
    return img


if __name__ == '__main__':
    from scipy.ndimage import gaussian_filter as gf
    for name, crack in (('wax-gold', False), ('wax-gold-cracked', True)):
        gold = make(name, '#94702e', metal=True, crack=crack)
        arr = np.asarray(gold, F) / 255
        al = arr[..., 3]
        # A soft shadow under the wax, baked in, and trimmed square around the wax.
        sh = gf(np.roll(np.roll(al, 5, axis=1), 9, axis=0), 7) * .62
        out_a = al + sh * (1 - al)
        rgb = arr[..., :3] * (al / np.maximum(out_a, 1e-4))[..., None]
        img = to_img(rgb, out_a).crop((70, 70, S - 40, S - 30))
        img = img.resize((540, int(540 * img.size[1] / img.size[0])), Image.LANCZOS)
        save_webp(img, name + '.webp', q=90, alpha_q=92)
