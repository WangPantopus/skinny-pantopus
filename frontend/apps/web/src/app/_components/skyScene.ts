// ============================================================
// The Living Sky for the web — the homepage's scene.
//
// A Canvas 2D port of the rules the iOS and Android Today sky follows
// (TodaySky*.swift / TodaySky*.kt): the sky's colour for the hour, the
// sun or moon on its arc, clouds, rain and a smoke veil when the air is
// bad, the house and an apartment block in the horizon's colour with
// only their windows catching the light, bins at the curb on pickup
// eve, a street lamp after dusk, and lights on the far hill for the
// verified homes around, one ~1 km cell at a time, nearest first.
//
// Pure drawing: no DOM, no React. LivingSky.tsx owns the canvas, the
// clock and the animation loop.
// ============================================================

/** The hero's element id: skyPhaseScript paints it before React loads. */
export const HERO_ID = 'home-hero';

export type SkyWeather = 'clear' | 'clouds' | 'rain';

export interface SkyOptions {
  weather: SkyWeather;
  /** 0–1: how much smoke veils the sky (bad air). */
  smoke: number;
  /** 0–1: the share of nearby cells with verified homes lit on the hill. */
  homes: number;
  /** Outline the lit cells on the hill. */
  cells: boolean;
  /** `auto` puts the bins out on pickup eve (5 PM to midnight). */
  bins: 'auto' | 'on' | 'off';
  /** The house's centre as a share of the width, at 760 px and wider. */
  houseX: number;
  /** The same below 760 px. */
  houseXNarrow: number;
  scale: number;
  /** The horizon as a share of the height. */
  horizon: number;
  apartment: boolean;
  /** Pins the sun or moon to this share of the width; null follows the hour. */
  orbX: number | null;
  /** How high the sun and moon climb below 760 px, as a share of their arc. */
  arcNarrow: number;
}

export const DEFAULT_SKY_OPTIONS: SkyOptions = {
  weather: 'clear',
  smoke: 0,
  homes: 0.55,
  cells: false,
  bins: 'auto',
  houseX: 0.62,
  houseXNarrow: 0.4,
  scale: 1,
  horizon: 0.8,
  apartment: true,
  orbX: null,
  arcNarrow: 1,
};

/** Top, middle and horizon colours through the day. */
const STOPS: ReadonlyArray<readonly [number, string, string, string]> = [
  [0, '#070D24', '#0F1A3A', '#1B2A4E'],
  [5, '#0A1230', '#15204A', '#26305A'],
  [6, '#1E2A5C', '#4A4E86', '#D08C86'],
  [6.8, '#3F5E9C', '#C99AA6', '#F7C59A'],
  [8, '#6FA6DB', '#A9CDEB', '#F2DCC2'],
  [10, '#5EA2DE', '#93C6EE', '#D9ECF8'],
  [13, '#4E98DA', '#86BFEC', '#DDEFFC'],
  [16, '#5B9AD3', '#9CC4E4', '#F2DDB4'],
  [17.6, '#5C7FBF', '#D9A88A', '#F7C07E'],
  [18.5, '#3E3F7E', '#B7678A', '#F38E5E'],
  [19.3, '#232A5E', '#5B3F72', '#A8607A'],
  [20.3, '#121A44', '#22295A', '#3A3767'],
  [21.5, '#0A1230', '#131D44', '#222C55'],
  [24, '#070D24', '#0F1A3A', '#1B2A4E'],
];

const SUNRISE = 6.8;
const SUNSET = 18.6;
const LAMP = '#FFC867';
const HILL_LIGHT = '#FFD27F';

export function wrapHour(h: number): number {
  return ((h % 24) + 24) % 24;
}

/** Light text reads on the sky from here until morning. */
export function isNightHour(h: number): boolean {
  const x = wrapHour(h);
  return x < 6.6 || x > 17.9;
}

/** "7:45 PM", to the quarter hour. */
export function formatHour(h: number): string {
  let q = Math.round(wrapHour(h) * 4) / 4;
  if (q >= 24) q = 0;
  const hh = Math.floor(q);
  const mm = Math.round((q - hh) * 60);
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

function rgb(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixColor(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

function rgba(c: string, a: number): string {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** The sky's top, middle and horizon colours at an hour. */
export function skyColorsAt(hour: number): [string, string, string] {
  const h = wrapHour(hour);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (h >= a[0] && h <= b[0]) {
      const t = (h - a[0]) / (b[0] - a[0]);
      return [mixColor(a[1], b[1], t), mixColor(a[2], b[2], t), mixColor(a[3], b[3], t)];
    }
  }
  return [STOPS[0][1], STOPS[0][2], STOPS[0][3]];
}

/**
 * An inline script for the server-rendered hero: it sets the hour's phase
 * and sky colours from the visitor's clock before first paint, so the
 * headline is never dark-on-night or light-on-day while React loads.
 */
export function skyPhaseScript(elementId: string): string {
  return `(function(){try{var e=document.getElementById(${JSON.stringify(elementId)});if(!e)return;var n=new Date(),h=n.getHours()+n.getMinutes()/60,S=${JSON.stringify(STOPS)},c=null;for(var i=0;i<S.length-1;i++){if(h>=S[i][0]&&h<=S[i+1][0]){var t=(h-S[i][0])/(S[i+1][0]-S[i][0]);c=[1,2,3].map(function(j){var a=parseInt(S[i][j].slice(1),16),b=parseInt(S[i+1][j].slice(1),16);return'rgb('+[16,8,0].map(function(s){var x=(a>>s)&255,y=(b>>s)&255;return Math.round(x+(y-x)*t)}).join(',')+')'});break}}e.setAttribute('data-phase',(h<6.6||h>17.9)?'night':'day');if(c){e.style.setProperty('--sky-top',c[0]);e.style.setProperty('--sky-bot',c[2])}}catch(_){}})();`;
}

/** 0 by day, 1 at night. */
function darkness(h: number): number {
  if (h < 5 || h >= 21) return 1;
  if (h < 7.3) return 1 - (h - 5) / 2.3;
  if (h < 17.8) return 0;
  return (h - 17.8) / 3.2;
}

/** How warm the light is near sunrise and sunset. */
function golden(h: number): number {
  return Math.min(1, Math.max(0, 1 - Math.abs(h - 6.9) / 1.2) + Math.max(0, 1 - Math.abs(h - 18.4) / 1.3));
}

function hillY(xf: number, horizon: number, H: number): number {
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

function tree(ctx: CanvasRenderingContext2D, x: number, gy: number, k: number, sil: string, sway: number, size: number) {
  ctx.fillStyle = sil;
  ctx.fillRect(x - 3 * k * size, gy - 46 * k * size, 6 * k * size, 46 * k * size);
  ctx.beginPath();
  for (const [dx, dy, rr] of [[0, -66, 26], [-16, -52, 18], [16, -54, 19], [4, -82, 18]]) {
    const cx = x + (dx * k + sway * (-dy / 80)) * size;
    const cy = gy + dy * k * size;
    const R = rr * k * size;
    ctx.moveTo(cx + R, cy);
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
  }
  ctx.fill();
}

/**
 * Paints one frame. `t` is a running clock in ms that drives the ambient
 * motion (drifting clouds, twinkling, rain, chimney smoke); `animate`
 * false freezes it.
 */
export function drawSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  H: number,
  hour: number,
  t: number,
  o: SkyOptions,
  seeds: SkySeeds,
  animate: boolean,
): void {
  const h = wrapHour(hour);
  const tt = animate ? t : 0;
  const s = skyColorsAt(h);
  const d = darkness(h);
  const gold = golden(h);
  const horizon = H * o.horizon;
  const TAU = Math.PI * 2;

  // Sky
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, s[0]);
  g.addColorStop(0.62, s[1]);
  g.addColorStop(1, s[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, H);
  if (o.weather === 'rain') {
    ctx.fillStyle = rgba('#4F596C', 0.3 * (1 - d * 0.5));
    ctx.fillRect(0, 0, w, horizon);
  }

  // Stars
  if (d > 0.02) {
    ctx.fillStyle = '#FFFFFF';
    for (const st of seeds.stars) {
      const tw = animate ? 0.72 + 0.28 * Math.sin(tt / 900 + st.p) : 1;
      ctx.globalAlpha = d * st.a * tw * (o.weather === 'clear' ? 1 : 0.4);
      ctx.beginPath();
      ctx.arc(st.x * w, st.y * horizon, st.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Sun or moon
  const arc = w >= 760 ? 1 : o.arcNarrow;
  const R0 = Math.max(16, Math.min(30, Math.min(w, H * 1.6) * 0.022));
  if (h > SUNRISE - 0.5 && h < SUNSET + 0.5) {
    const ts = (h - SUNRISE) / (SUNSET - SUNRISE);
    const tc = Math.min(1, Math.max(0, ts));
    const x = w * (o.orbX ?? 0.06 + 0.88 * ts);
    const y = horizon - Math.sin(Math.PI * tc) * horizon * 0.74 * arc + R0 * 0.6;
    let core = mixColor('#FFF8E0', '#FFAE5E', gold);
    if (o.smoke > 0) core = mixColor(core, '#E8703E', o.smoke * 0.7);
    const veil = o.weather === 'clear' ? 1 : 0.55;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, R0 * 6);
    rg.addColorStop(0, rgba(core, 0.55 * veil));
    rg.addColorStop(1, rgba(core, 0));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, R0 * 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(core, veil);
    ctx.beginPath();
    ctx.arc(x, y, R0, 0, TAU);
    ctx.fill();
  } else {
    const mt = wrapHour(h - SUNSET) / (24 - (SUNSET - SUNRISE));
    const x = w * (o.orbX ?? 0.1 + 0.8 * mt);
    const y = horizon - Math.sin(Math.PI * mt) * horizon * 0.68 * arc + R0 * 0.6;
    const mr = R0 * 0.72;
    const mg = ctx.createRadialGradient(x, y, 0, x, y, mr * 5);
    mg.addColorStop(0, 'rgba(220,228,245,0.16)');
    mg.addColorStop(1, 'rgba(220,228,245,0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(x, y, mr * 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#EEF2F8';
    ctx.beginPath();
    ctx.arc(x, y, mr, 0, TAU);
    ctx.fill();
    // The crescent: the sky's own colour at that height covers part of the disc.
    const yf = Math.max(0, Math.min(1, y / horizon));
    ctx.fillStyle = yf < 0.62 ? mixColor(s[0], s[1], yf / 0.62) : mixColor(s[1], s[2], (yf - 0.62) / 0.38);
    ctx.beginPath();
    ctx.arc(x + mr * 0.45, y - mr * 0.25, mr * 0.92, 0, TAU);
    ctx.fill();
  }

  // Clouds
  const cloudN = o.weather === 'clear' ? 3 : 7;
  const cloudA = o.weather === 'clear' ? 0.34 : o.weather === 'clouds' ? 0.66 : 0.8;
  let cc = mixColor('#FFFFFF', '#FFD2B5', gold);
  cc = mixColor(cc, '#2B3563', d * 0.85);
  if (o.weather === 'rain') cc = mixColor(cc, '#7C889C', 0.55);
  const cs = Math.max(0.7, Math.min(1.4, w / 1100));
  for (let i = 0; i < cloudN; i++) {
    const c = seeds.clouds[i];
    const span = w + 420;
    const cx = ((c.x * span + (tt * c.v) / 1000) % span) - 210;
    const cy = c.y * horizon;
    const sc = c.s * cs;
    ctx.fillStyle = rgba(cc, cloudA * (1 - d * 0.5));
    ctx.beginPath();
    for (const [dx, dy, rr] of [[0, 0, 34], [30, -12, 28], [58, 2, 30], [-28, 6, 24], [86, 8, 20]]) {
      const px = cx + dx * sc;
      const py = cy + dy * sc;
      const R = rr * sc;
      ctx.moveTo(px + R, py);
      ctx.arc(px, py, R, 0, TAU);
    }
    ctx.fill();
  }

  // Smoke veil when the air is bad
  if (o.smoke > 0) {
    const sg = ctx.createLinearGradient(0, horizon * 0.15, 0, horizon);
    sg.addColorStop(0, rgba('#C49A74', 0));
    sg.addColorStop(1, rgba('#C49A74', 0.55 * o.smoke));
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = rgba('#B08A6C', 0.18 * o.smoke);
    ctx.fillRect(0, 0, w, horizon);
  }

  // Far ridge, then the near hill
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
  const wide = w >= 760;
  const hxf = wide ? o.houseX : o.houseXNarrow;
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

  // Near ground and the sidewalk
  ctx.fillStyle = mixColor(s[2], '#0C131D', 0.58 + 0.34 * d);
  ctx.beginPath();
  ctx.moveTo(0, horizon + 8);
  ctx.quadraticCurveTo(w * 0.5, horizon - 6, w, horizon + 10);
  ctx.lineTo(w, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  let k = wide ? Math.max(0.85, Math.min(1.35, w / 1150)) : Math.max(0.62, Math.min(0.85, w / 520));
  k *= o.scale;
  const hxp = hxf * w;
  const gy = horizon + 6;
  ctx.fillStyle = rgba(mixColor(s[2], '#FFFFFF', 0.25), 0.1 + 0.06 * (1 - d));
  ctx.fillRect(0, gy + 14 * k, w, 2 * k);

  const sil = mixColor(s[2], '#0B1119', 0.66 + 0.28 * d);
  const windowsLit = d > 0.35;
  const late = h >= 23.3 || h < 5;
  const dim = mixColor(s[2], '#FFFFFF', 0.1);
  const sway = animate ? Math.sin(tt / 1500) * 1.6 * k : 0;

  const W = 132 * k;
  const Hh = 74 * k;
  const Rf = 50 * k;
  const hl = hxp - W / 2;

  tree(ctx, hl - 58 * k, gy, k, sil, sway, 1.05);

  // Window light spilling onto the ground
  if (windowsLit) {
    const sp = ctx.createRadialGradient(hxp, gy + 6 * k, 0, hxp, gy + 6 * k, 130 * k);
    sp.addColorStop(0, rgba(LAMP, 0.18 * d));
    sp.addColorStop(1, rgba(LAMP, 0));
    ctx.fillStyle = sp;
    ctx.fillRect(hxp - 140 * k, gy - 40 * k, 280 * k, 90 * k);
  }

  // The house
  ctx.fillStyle = sil;
  ctx.fillRect(hl, gy - Hh, W, Hh);
  ctx.beginPath();
  ctx.moveTo(hl - 9 * k, gy - Hh);
  ctx.lineTo(hxp, gy - Hh - Rf);
  ctx.lineTo(hl + W + 9 * k, gy - Hh);
  ctx.closePath();
  ctx.fill();
  const chX = hxp + W * 0.22;
  const chTop = gy - Hh - Rf * 0.88;
  ctx.fillRect(chX, chTop, 13 * k, Rf * 0.62);
  ctx.fillRect(chX - 2 * k, chTop - 3 * k, 17 * k, 4 * k);
  const ww = 24 * k;
  const wh = 20 * k;
  [[hl + W * 0.12, gy - Hh * 0.74], [hl + W * 0.64, gy - Hh * 0.74]].forEach(([wx, wy], i) => {
    // Late at night only the last window stays lit.
    const on = windowsLit && !(late && i === 0);
    if (on) {
      const hg = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 0, wx + ww / 2, wy + wh / 2, 46 * k);
      hg.addColorStop(0, rgba(LAMP, 0.32 * d));
      hg.addColorStop(1, rgba(LAMP, 0));
      ctx.fillStyle = hg;
      ctx.fillRect(wx - 36 * k, wy - 36 * k, ww + 72 * k, wh + 72 * k);
    }
    ctx.fillStyle = on ? LAMP : dim;
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = sil;
    ctx.fillRect(wx + ww / 2 - 0.8 * k, wy, 1.6 * k, wh);
    ctx.fillRect(wx, wy + wh / 2 - 0.8 * k, ww, 1.6 * k);
  });
  ctx.fillStyle = windowsLit && !late ? rgba(LAMP, 0.85) : dim;
  ctx.beginPath();
  ctx.arc(hxp, gy - Hh - Rf * 0.4, 6 * k, 0, TAU);
  ctx.fill();
  const dX = hl + W * 0.41;
  const dW = 18 * k;
  const dH = 38 * k;
  ctx.fillStyle = windowsLit ? rgba(LAMP, 0.5) : mixColor(s[2], '#0B1119', 0.5);
  ctx.fillRect(dX, gy - dH, dW, dH);
  if (windowsLit) {
    const pg = ctx.createRadialGradient(dX + dW / 2, gy - dH - 6 * k, 0, dX + dW / 2, gy - dH - 6 * k, 24 * k);
    pg.addColorStop(0, rgba(LAMP, 0.55 * d));
    pg.addColorStop(1, rgba(LAMP, 0));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(dX + dW / 2, gy - dH - 6 * k, 24 * k, 0, TAU);
    ctx.fill();
  }

  // Chimney smoke in the evening
  if (animate && d > 0.12) {
    const smokeColor = mixColor(s[1], '#C9D2E0', 0.5);
    for (let i = 0; i < 9; i++) {
      const p = (tt / 3200 + i / 9) % 1;
      const sx = chX + 6.5 * k + p * 34 * k + Math.sin(p * 5 + i) * 4 * k;
      const sy = chTop - 4 * k - p * 80 * k;
      ctx.fillStyle = rgba(smokeColor, (1 - p) * 0.16 * d);
      ctx.beginPath();
      ctx.arc(sx, sy, (3 + p * 10) * k, 0, TAU);
      ctx.fill();
    }
  }

  // Bins at the curb on pickup eve
  if (o.bins === 'on' || (o.bins === 'auto' && h >= 17 && h < 23.9)) {
    const bx = hl + W + 16 * k;
    for (const [col, off] of [['#2F6B4A', 0], ['#2E62A0', 17]] as const) {
      ctx.fillStyle = mixColor(col, sil, 0.2 + 0.5 * d);
      const x0 = bx + off * k;
      ctx.beginPath();
      ctx.moveTo(x0, gy);
      ctx.lineTo(x0 + 13 * k, gy);
      ctx.lineTo(x0 + 14 * k, gy - 21 * k);
      ctx.lineTo(x0 - 1 * k, gy - 21 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x0 - 2 * k, gy - 24.5 * k, 17 * k, 3.5 * k);
    }
  }

  // Street lamp
  const lx = hl + W + 66 * k;
  if (lx < w - 6) {
    if (d > 0.3) {
      ctx.fillStyle = rgba(LAMP, 0.14 * d);
      ctx.beginPath();
      ctx.moveTo(lx + 8 * k, gy - 92 * k);
      ctx.lineTo(lx + 16 * k, gy - 92 * k);
      ctx.lineTo(lx + 44 * k, gy + 2 * k);
      ctx.lineTo(lx - 20 * k, gy + 2 * k);
      ctx.closePath();
      ctx.fill();
      const lg = ctx.createRadialGradient(lx + 12 * k, gy - 92 * k, 0, lx + 12 * k, gy - 92 * k, 22 * k);
      lg.addColorStop(0, rgba(LAMP, 0.8 * d));
      lg.addColorStop(1, rgba(LAMP, 0));
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx + 12 * k, gy - 92 * k, 22 * k, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = sil;
    ctx.fillRect(lx - 1.6 * k, gy - 98 * k, 3.2 * k, 98 * k);
    ctx.fillRect(lx - 1.6 * k, gy - 98 * k, 16 * k, 3 * k);
    ctx.fillStyle = d > 0.3 ? LAMP : sil;
    ctx.fillRect(lx + 8 * k, gy - 95 * k, 8 * k, 4 * k);
  }

  // Apartment block
  const AW = 96 * k;
  const AH = 172 * k;
  const ax = hl + W + 92 * k;
  if (o.apartment && ax + AW < w - 4) {
    ctx.fillStyle = sil;
    ctx.fillRect(ax, gy - AH, AW, AH);
    ctx.fillRect(ax - 4 * k, gy - AH - 6 * k, AW + 8 * k, 7 * k);
    ctx.fillRect(ax + AW * 0.72, gy - AH - 26 * k, 2 * k, 20 * k);
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 3; col++) {
        const on = windowsLit && seeds.apartment[row * 3 + col] < (late ? 0.12 : 0.2 + 0.55 * d);
        ctx.fillStyle = on ? LAMP : dim;
        ctx.fillRect(ax + 13 * k + col * 28 * k, gy - AH + 16 * k + row * 21 * k, 16 * k, 11 * k);
      }
    }
    ctx.fillStyle = windowsLit ? rgba(LAMP, 0.55) : mixColor(s[2], '#0B1119', 0.5);
    ctx.fillRect(ax + AW / 2 - 9 * k, gy - 26 * k, 18 * k, 26 * k);
    if (ax + AW + 70 * k < w) tree(ctx, ax + AW + 44 * k, gy, k, sil, sway, 0.8);
  }

  // Rain falls in front of everything
  if (o.weather === 'rain' && animate) {
    ctx.strokeStyle = rgba(d > 0.5 ? '#9DB0CF' : '#DCE8F5', 0.42);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const rd of seeds.rain) {
      const y = ((rd.y * (H + 40) + tt * 0.9 * rd.v) % (H + 40)) - 20;
      const x = rd.x * (w + 60) - 30 + y * 0.16;
      ctx.moveTo(x, y);
      ctx.lineTo(x + rd.l * 0.16, y + rd.l);
    }
    ctx.stroke();
  }

  // The ground falls into shadow
  const vg = ctx.createLinearGradient(0, horizon, 0, H);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, horizon, w, H - horizon);
}
