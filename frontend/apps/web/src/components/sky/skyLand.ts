// ============================================================
// What every Living Sky shares, whatever stands on it: the colour helpers,
// the sky's gradient, the smoke veil, and the land: a far ridge, the near
// hill with the verified homes' lights on it (one ~1 km cell at a time,
// nearest first), the near ground and its shadow.
//
// The homepage's scene (app/_components/skyScene.ts) and Today's (todaySkyPainter.ts) each
// paint their own air and home around these. Pure drawing: no DOM, no React.
// ============================================================

export const LAMP = '#FFC867';
const HILL_LIGHT = '#FFD27F';

function rgb(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixColor(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

export function rgba(c: string, a: number): string {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

export function hillY(xf: number, horizon: number, H: number): number {
  return horizon - H * (0.075 + 0.04 * Math.sin(xf * Math.PI * 2.1 + 0.7) + 0.022 * Math.sin(xf * Math.PI * 5.3 + 1.3));
}

function ridgeY(xf: number, horizon: number, H: number): number {
  return horizon - H * (0.14 + 0.035 * Math.sin(xf * Math.PI * 1.6 + 0.4) + 0.02 * Math.sin(xf * Math.PI * 4.1 + 1.1));
}

interface Star { x: number; y: number; a: number; r: number; p: number }
interface Cloud { x: number; y: number; s: number; v: number }
interface HillLight { c: number; x: number; dy: number; a: number; on: number; p: number }
interface Drop { x: number; y: number; l: number; v: number }

/** Fixed random placements, so the scene is the same on every visit. */
export interface SkySeeds {
  stars: Star[];
  clouds: Cloud[];
  centers: number[];
  lights: HillLight[];
  apartment: number[];
  rain: Drop[];
}

export function makeSkySeeds(): SkySeeds {
  let s = 20261021;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const stars = Array.from({ length: 140 }, () => ({ x: r(), y: Math.pow(r(), 1.35) * 0.74, a: 0.3 + r() * 0.7, r: 0.45 + r() * 1.15, p: r() * 6.28 }));
  const clouds = Array.from({ length: 7 }, () => ({ x: r(), y: 0.1 + r() * 0.32, s: 0.6 + r() * 0.85, v: 4 + r() * 8 }));
  const centers = [0.05, 0.16, 0.27, 0.38, 0.5, 0.72, 0.84, 0.95];
  const lights: HillLight[] = [];
  centers.forEach((c, ci) => {
    const n = 7 + Math.floor(r() * 6);
    for (let k = 0; k < n; k++) lights.push({ c: ci, x: c + (r() - 0.5) * 0.075, dy: 6 + r() * 22, a: 0.45 + r() * 0.55, on: r(), p: r() * 6.28 });
  });
  const apartment = Array.from({ length: 30 }, () => r());
  const rain = Array.from({ length: 170 }, () => ({ x: r(), y: r(), l: 10 + r() * 12, v: 0.7 + r() * 0.6 }));
  return { stars, clouds, centers, lights, apartment, rain };
}

export function paintSkyGradient(ctx: CanvasRenderingContext2D, w: number, H: number, horizon: number, s: readonly [string, string, string]): void {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, s[0]);
  g.addColorStop(0.62, s[1]);
  g.addColorStop(1, s[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, H);
}

/** A veil of smoke when the air is bad, [smoke] 0–1. */
export function paintSmokeVeil(ctx: CanvasRenderingContext2D, w: number, horizon: number, smoke: number): void {
  const sg = ctx.createLinearGradient(0, horizon * 0.15, 0, horizon);
  sg.addColorStop(0, rgba('#C49A74', 0));
  sg.addColorStop(1, rgba('#C49A74', 0.55 * smoke));
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = rgba('#B08A6C', 0.18 * smoke);
  ctx.fillRect(0, 0, w, horizon);
}

/**
 * The far ridge, the near hill with its lights, and the near ground, in the horizon's colour.
 * [d] is 0 by day and 1 at night, [hxf] the home's centre as a share of the width.
 */
export function paintLand(
  ctx: CanvasRenderingContext2D,
  w: number,
  H: number,
  horizon: number,
  s: readonly [string, string, string],
  d: number,
  o: { homes: number; cells: boolean },
  hxf: number,
  seeds: SkySeeds,
  tt: number,
  animate: boolean,
): void {
  ctx.fillStyle = mixColor(s[2], '#2A3550', 0.32 + 0.38 * d);
  ctx.beginPath();
  ctx.moveTo(0, ridgeY(0, horizon, H));
  for (let px = 0; px <= w + 8; px += 8) ctx.lineTo(px, ridgeY(px / w, horizon, H));
  ctx.lineTo(w, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = mixColor(s[2], '#16202E', 0.45 + 0.38 * d);
  ctx.beginPath();
  ctx.moveTo(0, hillY(0, horizon, H));
  for (let px = 0; px <= w + 8; px += 8) ctx.lineTo(px, hillY(px / w, horizon, H));
  ctx.lineTo(w, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Lights on the hill: verified homes by ~1 km cell, the nearest cells first
  const order = seeds.centers
    .map((c, i) => [Math.abs(c - hxf), i] as const)
    .sort((a, b) => a[0] - b[0])
    .map((p) => p[1]);
  const litN = Math.round(Math.max(0, Math.min(1, o.homes)) * seeds.centers.length);
  const lit = new Set(order.slice(0, litN));
  if (d > 0.1) {
    if (o.cells) {
      const rr = Math.min(64, w * 0.045);
      for (const ci of lit) {
        const cx = seeds.centers[ci] * w;
        const cy = hillY(seeds.centers[ci], horizon, H) + 18;
        ctx.beginPath();
        for (let k2 = 0; k2 < 6; k2++) {
          const a = Math.PI / 6 + (k2 * Math.PI) / 3;
          const px = cx + rr * Math.cos(a);
          const py = cy + rr * 0.55 * Math.sin(a);
          if (k2 === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = rgba(LAMP, 0.06 * d);
        ctx.fill();
        ctx.strokeStyle = rgba(LAMP, 0.3 * d);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    const ls = Math.max(1.6, Math.min(2.6, w / 600));
    for (const l of seeds.lights) {
      if (!lit.has(l.c) || l.on > 0.35 + 0.65 * d) continue;
      const tw = animate ? 0.85 + 0.15 * Math.sin(tt / 1300 + l.p) : 1;
      ctx.fillStyle = rgba(HILL_LIGHT, d * l.a * tw);
      ctx.fillRect(l.x * w, hillY(l.x, horizon, H) + l.dy, ls, ls);
    }
  }

  // Near ground
  ctx.fillStyle = mixColor(s[2], '#0C131D', 0.58 + 0.34 * d);
  ctx.beginPath();
  ctx.moveTo(0, horizon + 8);
  ctx.quadraticCurveTo(w * 0.5, horizon - 6, w, horizon + 10);
  ctx.lineTo(w, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
}

/** The ground falls into shadow. */
export function paintGroundShadow(ctx: CanvasRenderingContext2D, w: number, H: number, horizon: number): void {
  const vg = ctx.createLinearGradient(0, horizon, 0, H);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, horizon, w, H - horizon);
}
