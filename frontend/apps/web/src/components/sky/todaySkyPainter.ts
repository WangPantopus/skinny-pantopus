// ============================================================
// The Today sky: the Living Sky's gradient, smoke veil and land (skyLand.ts)
// with the apps' own air and home.
//
// The air: stars, the sun or the moon in its real phase, clouds, rain, snow,
// wind and lightning. The ground: the resident's own kind of home, the bins at
// the curb, chimney smoke and the trees through the year. In front: fog and
// frost. All in CSS pixels with the apps' numbers: the same inputs always give
// the same picture, and a still frame is the same scene. Parity twin of
// TodaySkyPainter, TodaySkyGround, TodaySkyHouse, TodaySkyHomes, TodaySkyMoments
// and SkyWind on iOS and Android.
// ============================================================

import type { SkyDraw } from './SkyCanvas';
import { hillY, mixColor, paintGroundShadow, paintLand, paintSkyGradient, paintSmokeVeil, rgba } from './skyLand';
import { homeLeftReach, homeRightReach, homeWallHeight, type SkyHome, type SkyRoof, type TodayScene } from './todaySky';

/** The frame being painted. */
interface SkyFrame {
  w: number;
  H: number;
  /** The sky's top, middle and horizon colours. */
  s: readonly [string, string, string];
  horizon: number;
  animate: boolean;
}

/** The horizon as a share of the card's height: the apps' 34 px of ground under a 188 px sky. */
const HORIZON = 0.82;
/** The home's door, as a share of the card's width. */
const HOME_X = 0.7;

const WHITE = '#FFFFFF';
const BLACK = '#000000';
const INK = '#04070F';
const SUN_HIGH = '#FFE08A';
const SUN_LOW = '#FFC27A';
const SMOKE_SUN = '#F0743E';
const MOON = '#EEF1FA';
const MOON_SHADOW = '#CBD5F5';
const MOON_GLOW = '#E2E8FF';
const WINDOW_GLOW = '#FFD27A';
const TAU = Math.PI * 2;

/** The scene's deterministic random numbers, so stars and raindrops keep their places (same sequence as the apps). */
function skyRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

/** A position that drifts at [speed] px a second and wraps over [span]. */
function drift(base: number, speed: number, span: number, time: number): number {
  const raw = (base + time * speed) % span;
  return raw < 0 ? raw + span : raw;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, opacity: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, opacity));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function polygon(ctx: CanvasRenderingContext2D, points: ReadonlyArray<readonly [number, number]>, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  // Safari before 16 and Firefox before 112 have no roundRect: square corners there.
  if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius);
  else ctx.rect(x, y, width, height);
}

function oval(ctx: CanvasRenderingContext2D, left: number, top: number, width: number, height: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, TAU);
  ctx.fill();
}

// ── The air ───────────────────────────────────────────────

function paintStars(ctx: CanvasRenderingContext2D, f: SkyFrame, time: number): void {
  const random = skyRandom(7);
  const count = Math.round(46 * Math.max(1, f.w / 358));
  for (let i = 0; i < count; i++) {
    const x = random() * f.w;
    const y = random() * f.horizon * 0.8;
    const radius = 0.5 + random() * 1.1;
    const speed = 0.6 + random() * 1.6;
    const offset = random() * 6.28;
    const twinkle = f.animate ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * speed + offset)) : 0.75;
    circle(ctx, x, y, radius, rgba(WHITE, 0.85 * twinkle));
  }
}

function paintSun(ctx: CanvasRenderingContext2D, f: SkyFrame, scene: TodayScene, time: number, rise: number): void {
  const { moment, smoke, goldenWarmth, family } = scene;
  // The sun rides the right half of the sky: low at dawn and dusk, high at noon.
  const fraction = moment.dayFraction;
  const x = f.w * (0.56 + 0.32 * fraction);
  const y = f.horizon - 18 - Math.sin(Math.PI * fraction) * (f.horizon - 58) + (1 - rise) * 44;
  const warm = moment.phase === 'dawn' || moment.phase === 'dusk';
  // In the golden hour the sun warms and a wide halo of gold spreads around it.
  const lit = warm ? SUN_LOW : mixColor(SUN_HIGH, SUN_LOW, goldenWarmth * 2);
  // Through smoke the sun is a dim red disc without rays.
  const core = mixColor(lit, SMOKE_SUN, Math.min(1, smoke * 1.2));
  const veiled = family !== 'clear' && family !== 'partly';
  glow(ctx, x, y, smoke > 0 ? 56 : 78, core, veiled ? 0.22 : 0.45);
  if (veiled) return;
  if (smoke > 0) {
    circle(ctx, x, y, 16, rgba(core, 0.9));
    return;
  }
  if (goldenWarmth > 0) glow(ctx, x, y, 130, SUN_LOW, goldenWarmth * 0.7);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(f.animate ? time * 0.12 : 0);
  ctx.strokeStyle = rgba(core, 0.55);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * TAU;
    const reach = 33 + (f.animate ? Math.sin(time * 1.4 + i) * 2 : 0);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 25, Math.sin(angle) * 25);
    ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
    ctx.stroke();
  }
  ctx.restore();
  circle(ctx, x, y, 18, core);
  circle(ctx, x - 5, y - 5, 8, rgba(WHITE, 0.35));
}

/** The moon's dark seas: offset from its centre and radius. */
const MARIA = [[-5, -4, 4.5], [4, 2, 3.5], [-1, 7, 2.8], [6, -6, 2]] as const;

/** The lit part of the moon for a phase (0 new → 0.5 full → 1 new); waxing lights the right side. */
function moonPath(x: number, y: number, radius: number, phase: number): Path2D {
  const terminator = Math.cos(TAU * phase);
  const side = phase < 0.5 ? 1 : -1;
  const steps = 40;
  const path = new Path2D();
  for (let step = 0; step <= steps; step++) {
    const dy = -radius + (2 * radius * step) / steps;
    const edge = Math.sqrt(Math.max(0, radius * radius - dy * dy));
    if (step === 0) path.moveTo(x + side * edge, y + dy);
    else path.lineTo(x + side * edge, y + dy);
  }
  for (let step = steps; step >= 0; step--) {
    const dy = -radius + (2 * radius * step) / steps;
    const edge = Math.sqrt(Math.max(0, radius * radius - dy * dy));
    path.lineTo(x + side * terminator * edge, y + dy);
  }
  path.closePath();
  return path;
}

function paintMoon(ctx: CanvasRenderingContext2D, f: SkyFrame, scene: TodayScene, rise: number): void {
  const { family, moment } = scene;
  if (family === 'wet' || family === 'snow' || family === 'storm') return;
  const x = f.w * 0.8;
  const y = 50 + (1 - rise) * 44;
  const veiled = family === 'overcast' || family === 'fog';
  // A full moon lights up more of the sky.
  const full = Math.abs(moment.moonPhase - 0.5) < 0.034;
  glow(ctx, x, y, full ? 92 : 70, MOON_GLOW, veiled ? 0.12 : full ? 0.3 : 0.22);
  if (veiled) return;
  circle(ctx, x, y, 17, rgba(MOON_SHADOW, 0.13));
  const disc = moonPath(x, y, 17, moment.moonPhase);
  ctx.fillStyle = MOON;
  ctx.fill(disc);
  // Faint maria on the lit part, so it reads as the moon and not a lamp.
  ctx.save();
  ctx.clip(disc);
  for (const [dx, dy, r] of MARIA) circle(ctx, x + dx, y + dy, r, rgba(MOON_SHADOW, 0.45));
  ctx.restore();
}

let unitCloud: Path2D | null = null;

/** A cloud one unit wide on a flat base at y = 0: four puffs and a base bar. */
function cloudPath(): Path2D {
  if (unitCloud) return unitCloud;
  unitCloud = new Path2D();
  unitCloud.rect(0.2, -0.14, 0.66, 0.14);
  for (const [center, radius] of [[0.2, 0.2], [0.45, 0.28], [0.7, 0.22], [0.86, 0.14]]) {
    unitCloud.moveTo(center + radius, -radius);
    unitCloud.arc(center, -radius, radius, 0, TAU);
  }
  return unitCloud;
}

/** A cloud [width] px wide sitting on a flat base at [y], lit from above. */
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, color: string, opacity: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width, width);
  const g = ctx.createLinearGradient(0, -0.56, 0, 0);
  g.addColorStop(0, rgba(mixColor(color, WHITE, 0.22), opacity));
  g.addColorStop(1, rgba(color, opacity));
  ctx.fillStyle = g;
  ctx.fill(cloudPath());
  ctx.restore();
}

/** Two puffs near the sun or moon; they sway rather than cross the reading. */
function paintPuffs(ctx: CanvasRenderingContext2D, f: SkyFrame, scene: TodayScene, time: number): void {
  const { phase } = scene.moment;
  const night = phase === 'night';
  const tint = night ? '#3A4668' : phase === 'dawn' ? '#F6E3EA' : phase === 'dusk' ? '#F8DCCB' : WHITE;
  const sway = (offset: number) => (f.animate ? Math.sin(time * scene.wind.swayPace + offset) * scene.wind.sway : 0);
  cloud(ctx, f.w * 0.5 + sway(0), 70, 96, tint, night ? 0.9 : 0.88);
  cloud(ctx, f.w * 0.74 + sway(2), 92, 120, tint, night ? 0.95 : 0.97);
}

// One cloud of the overcast deck: start (fraction of its track), base line, width, drift speed, upper row.
const DECK = [
  [0, 24, 150, 5, true], [0.3, 18, 170, 5, true], [0.62, 26, 160, 5, true], [0.9, 20, 140, 5, true],
  [0.12, 52, 130, 9, false], [0.5, 60, 150, 9, false], [0.82, 50, 120, 9, false],
] as const;

/** A deck across the top, close to the sky's own colour so the reading stays legible. */
function paintDeck(ctx: CanvasRenderingContext2D, f: SkyFrame, scene: TodayScene, time: number): void {
  const night = scene.moment.phase === 'night';
  const storm = scene.family === 'storm';
  const [top, mid] = f.s;
  const upper = storm ? mixColor(top, BLACK, 0.1) : mixColor(top, WHITE, night ? 0.08 : 0.16);
  const lower = storm ? mixColor(mid, BLACK, 0.05) : mixColor(mid, WHITE, night ? 0.06 : 0.2);
  const pace = scene.wind.cloudPace * scene.wind.toward;
  // The deck spans the card however wide it is.
  const stretch = Math.max(1, f.w / 358);
  for (const [start, y, width, speed, isUpper] of DECK) {
    const wide = width * stretch;
    const span = f.w + wide;
    const x = drift(start * span, speed * pace, span, time) - wide;
    cloud(ctx, x, y, wide, isUpper ? upper : lower, isUpper ? 0.95 : 0.9);
  }
}

function paintRain(ctx: CanvasRenderingContext2D, f: SkyFrame, scene: TodayScene, time: number): void {
  const random = skyRandom(11);
  // Fewer streaks for a passing shower, more for a downpour.
  const base = scene.family === 'storm' ? 90 : scene.sleet ? 40 : 70;
  // Sideways for each pixel fallen; the drops start further upwind to cover the card.
  const slant = scene.wind.slant * scene.wind.toward;
  const spread = f.H * Math.abs(slant);
  const from = slant > 0 ? -spread - 10 : -10;
  const count = Math.floor(base * (0.6 + 0.8 * scene.rain) * (f.w + spread) / Math.min(f.w, 358));
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const start = from + random() * (f.w + spread + 20);
    const speed = 380 + random() * 160;
    const length = 9 + random() * 7;
    const offset = random() * f.H;
    const fall = (offset + time * speed) % (f.H + length);
    const y = fall - length;
    const x = start + (y + length) * slant;
    ctx.moveTo(x, y);
    ctx.lineTo(x + length * slant, y + length);
  }
  ctx.strokeStyle = scene.moment.phase === 'night' ? rgba('#AABEE6', 0.45) : rgba('#E1EBFA', 0.55);
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function paintSnow(ctx: CanvasRenderingContext2D, f: SkyFrame, scene: TodayScene, time: number): void {
  const random = skyRandom(23);
  // Flakes blow sideways as they fall, so they start further upwind.
  const slant = scene.wind.slant * scene.wind.toward;
  const spread = f.H * Math.abs(slant);
  const from = slant > 0 ? -spread : 0;
  const count = Math.floor((scene.sleet ? 26 : 55) * (f.w + spread) / Math.min(f.w, 358));
  for (let i = 0; i < count; i++) {
    const start = from + random() * (f.w + spread);
    const speed = 18 + random() * 24;
    const radius = 1 + random() * 1.7;
    const offset = random() * f.H;
    const amplitude = 5 + random() * 9;
    const frequency = 0.5 + random() * 0.8;
    const phase = random() * 6.28;
    const opacity = 0.65 + random() * 0.3;
    const y = (offset + time * speed) % (f.H + 8) - 4;
    circle(ctx, start + (y + 4) * slant + Math.sin(time * frequency + phase) * amplitude, y, radius, rgba(WHITE, opacity));
  }
}

/** Streaks of air crossing the sky, more and faster in a stronger wind, and from 20 mph a few leaves. */
function paintWind(ctx: CanvasRenderingContext2D, f: SkyFrame, scene: TodayScene, time: number): void {
  const { wind } = scene;
  const night = scene.moment.phase === 'night';
  const across = (along: number) => (wind.toward < 0 ? f.w - along : along);
  if (wind.mph >= 20 && scene.season !== 'winter') {
    const random = skyRandom(31);
    const color = night ? rgba('#A08C5A', 0.7) : rgba('#EAB308', 0.85);
    const span = f.w + 60;
    for (let i = 0; i < 4; i++) {
      const speed = wind.mph + 35 + random() * 35;
      const base = 40 + random() * 90;
      const phase = random() * 6.28;
      const along = drift(random() * span, speed, span, time) - 30;
      ctx.save();
      ctx.translate(across(along), base + Math.sin(time * 2 + phase) * 8);
      ctx.rotate(wind.toward * (time * 3 + phase));
      oval(ctx, -4, -2, 8, 4, color);
      ctx.restore();
    }
  }
  const span = f.w + 160;
  ctx.beginPath();
  for (let i = 0; i < wind.streaks; i++) {
    const tail = drift(i * 0.27 * span, 40 + wind.mph * 2.5 + i * 12, span, time) - 120;
    const y = 36 + i * 23;
    ctx.moveTo(across(tail), y);
    ctx.bezierCurveTo(across(tail + 40), y - 6, across(tail + 70), y + 6, across(tail + 110), y);
  }
  ctx.strokeStyle = rgba(WHITE, (night ? 0.28 : 0.5) * (0.55 + 0.45 * wind.strength));
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/**
 * A soft double flash about every seven seconds: well under the three flashes a second that
 * photosensitivity guidance allows, and never drawn while motion is off.
 */
function paintLightning(ctx: CanvasRenderingContext2D, f: SkyFrame, time: number): void {
  const period = 7;
  const cycle = Math.floor(time / period);
  const random = skyRandom(100 + cycle);
  const since = time - cycle * period - (1 + random() * 4);
  const opacity = since >= 0 && since < 0.09 ? 0.28 : since >= 0.17 && since < 0.25 ? 0.18 : 0;
  if (opacity === 0) return;
  ctx.fillStyle = rgba('#EBF0FF', opacity);
  ctx.fillRect(0, 0, f.w, f.H);
  const x = f.w * (0.35 + random() * 0.5);
  ctx.beginPath();
  ctx.moveTo(x, 40);
  ctx.lineTo(x - 8, 70);
  ctx.lineTo(x + 4, 72);
  ctx.lineTo(x - 6, f.horizon - 20);
  ctx.strokeStyle = rgba('#FFFADC', 0.9);
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ── The ground ────────────────────────────────────────────

/**
 * The near hill and ground under snow, repainted over the land before the home stands on them. The far ridge keeps
 * its colour: it rises behind the reading, where white hills would take the white text with them.
 */
function paintSnowGround(ctx: CanvasRenderingContext2D, f: SkyFrame, night: boolean): void {
  const { w, H, horizon } = f;
  ctx.fillStyle = night ? '#46546E' : '#F3F6FA';
  ctx.beginPath();
  ctx.moveTo(0, hillY(0, horizon, H));
  for (let px = 0; px <= w + 8; px += 8) ctx.lineTo(px, hillY(px / w, horizon, H));
  ctx.lineTo(w, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
}

/** The roof's top edge from eave to eave: up to the ridge (a gable) or to a short flat top (a hip, 0.65 as high). */
function roofLine(roof: SkyRoof, left: number, right: number, top: number, ridge: number): Array<[number, number]> {
  if (roof === 'hip') {
    const rise = Math.round(ridge * 0.65);
    const inset = Math.min(14, (right - left) / 2 - 2);
    return [[left, top], [left + inset, top - rise], [right - inset, top - rise], [right, top]];
  }
  return [[left, top], [(left + right) / 2, top - ridge - 1], [right, top]];
}

function paintRoof(ctx: CanvasRenderingContext2D, roof: SkyRoof, left: number, right: number, top: number, ridge: number, color: string): void {
  if (roof === 'flat') {
    ctx.fillStyle = color;
    ctx.fillRect(left - 2, top - 3, right - left + 4, 4);
    return;
  }
  polygon(ctx, roofLine(roof, left - 5, right + 5, top + 1, ridge), color);
}

function paintRoofSnow(ctx: CanvasRenderingContext2D, roof: SkyRoof, left: number, right: number, top: number, ridge: number): void {
  const line: Array<[number, number]> = roof === 'flat' ? [[left - 1, top - 3], [right + 1, top - 3]] : roofLine(roof, left - 4, right + 4, top, ridge - 2);
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

/** The light the home drawings share: lamps after dusk, plain glass by day. */
interface HomeLight {
  lit: boolean;
  late: boolean;
  night: boolean;
  window(lit: boolean): string;
  door: string;
  garageDoor(house: string): string;
}

function porchGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, opacity: number, box: readonly [number, number, number, number]): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(WINDOW_GLOW, opacity));
  g.addColorStop(1, rgba(WINDOW_GLOW, 0));
  ctx.fillStyle = g;
  ctx.fillRect(box[0], box[1], box[2], box[3]);
}

function chimneyTop(home: SkyHome, x: number, y: number): [number, number] {
  if (home.kind !== 'house') return [x + 8, y - 44];
  return [x + home.width * 0.2, y - homeWallHeight(home) - (home.roof === 'gable' ? 18 : home.roof === 'hip' ? 17 : 12)];
}

/** An attached or detached garage right of the house with a door per car, or a carport: a roof on two posts. */
function paintGarage(ctx: CanvasRenderingContext2D, home: SkyHome, light: HomeLight, house: string, snow: boolean, x: number, y: number): void {
  if (home.garage === 'none') return;
  ctx.fillStyle = house;
  if (home.garage === 'carport') {
    const left = x + home.width / 2 - 1;
    ctx.fillRect(left, y - 17, 21, 2.5);
    ctx.fillRect(left + 9, y - 15, 1.6, 15);
    ctx.fillRect(left + 18, y - 15, 1.6, 15);
    return;
  }
  const attached = home.garage === 'attached';
  const width = 8 + 8 * home.garageSpaces;
  const left = x + home.width / 2 + (attached ? 0 : 5);
  const top = y - 18;
  // An attached garage tucks under the house's wall, so no seam shows.
  const tuck = attached ? 2 : 0;
  ctx.fillRect(left - tuck, top, width + tuck, 18);
  paintRoof(ctx, home.roof, left, left + width, top, 9, house);
  if (snow) paintRoofSnow(ctx, home.roof, left, left + width, top, 9);
  const doors = home.garageSpaces;
  const doorWidth = doors === 1 ? 10 : 9;
  const span = doors * doorWidth + (doors - 1) * 2;
  ctx.fillStyle = light.garageDoor(house);
  for (let i = 0; i < doors; i++) ctx.fillRect(left + (width - span) / 2 + i * (doorWidth + 2), y - 11, doorWidth, 11);
}

/** A row of windows a storey; late at night only the top row's last window stays lit. */
function paintWindows(ctx: CanvasRenderingContext2D, home: SkyHome, light: HomeLight, x: number, y: number): void {
  const stories = home.stories ?? 1;
  const rows = stories >= 2.5 ? 3 : stories >= 2 ? 2 : 1;
  const late = light.lit && light.late;
  ctx.fillStyle = light.window(light.lit);
  for (let row = 0; row < rows; row++) {
    const columns = [x - home.width / 2 + 6, x + home.width / 2 - 14];
    // Wide upper floors get a middle window over the door.
    if (row > 0 && home.width >= 44) columns.splice(1, 0, x - 4);
    columns.forEach((left, i) => {
      if (!late || (row === rows - 1 && i === columns.length - 1)) ctx.fillRect(left, y - 18 - row * 16, 8, 7);
    });
  }
  // A storey and a half: the attic window in the gable.
  if (stories > 1 && stories < 2 && home.roof === 'gable' && !late) ctx.fillRect(x - 3, y - homeWallHeight(home) - 10, 6, 6);
}

/** The house from its county record, all one silhouette; only the windows, the door and the garage doors catch the light. */
function paintHouse(ctx: CanvasRenderingContext2D, home: SkyHome, light: HomeLight, house: string, snow: boolean, x: number, y: number): void {
  const wall = homeWallHeight(home);
  const top = y - wall;
  const left = x - home.width / 2;
  const right = x + home.width / 2;
  paintGarage(ctx, home, light, house, snow, x, y);
  ctx.fillStyle = house;
  ctx.fillRect(left, top, home.width, wall);
  if (home.chimney) {
    const [cx, cy] = chimneyTop(home, x, y);
    ctx.fillRect(cx, cy, 6, home.roof === 'flat' ? 12 : 14);
  }
  paintRoof(ctx, home.roof, left, right, top, 20, house);
  if (snow) paintRoofSnow(ctx, home.roof, left, right, top, 20);
  if (light.lit) porchGlow(ctx, x, y - 12, 40, 0.28, [x - 50, y - 60, 100, 70]);
  paintWindows(ctx, home, light, x, y);
  ctx.fillStyle = light.door;
  ctx.fillRect(x - 3, y - 11, 6, 11);
  if (home.pool) {
    ctx.fillStyle = mixColor('#7DD3FC', house, light.night ? 0.7 : light.lit ? 0.45 : 0.25);
    ctx.beginPath();
    roundedRect(ctx, left - 15, y + 1.5, 16, 3.5, 1.5);
    ctx.fill();
  }
}

/** Three attached houses; the resident's is the middle one, and the neighbours' sit a shade darker. */
function paintTownhouses(ctx: CanvasRenderingContext2D, home: SkyHome, light: HomeLight, house: string, x: number, y: number): void {
  const side = mixColor(house, INK, 0.12);
  const unit = (center: number, width: number, tone: string) => {
    ctx.fillStyle = tone;
    ctx.fillRect(center - width / 2, y - 25, width, 25);
    polygon(ctx, [[center - width / 2 - 2, y - 24], [center, y - 40], [center + width / 2 + 2, y - 24]], tone);
  };
  unit(x - 26, 24, side);
  unit(x + 26, 24, side);
  unit(x, 28, house);
  if (home.chimney) {
    ctx.fillStyle = house;
    ctx.fillRect(x + 8, y - 42, 5, 12);
  }
  if (light.lit) porchGlow(ctx, x, y - 12, 40, 0.28, [x - 44, y - 60, 88, 70]);
  ctx.fillStyle = light.window(light.lit);
  ctx.fillRect(x - 10, y - 18, 7, 6);
  ctx.fillStyle = light.window(light.lit && !light.late);
  ctx.fillRect(x + 3, y - 18, 7, 6);
  // The neighbours' windows stay dark: only the resident's home is lit.
  ctx.fillStyle = light.window(false);
  ctx.fillRect(x - 30, y - 17, 8, 6);
  ctx.fillRect(x + 22, y - 17, 8, 6);
  ctx.fillStyle = light.door;
  ctx.fillRect(x - 3, y - 10, 6, 10);
}

/** A small three-storey block with a flat roof; the resident's window is the warm one, a few others glow dimmer after dusk. */
function paintApartment(ctx: CanvasRenderingContext2D, light: HomeLight, house: string, x: number, y: number): void {
  ctx.fillStyle = house;
  ctx.fillRect(x - 26, y - 50, 52, 50);
  ctx.fillRect(x - 28, y - 52, 56, 3);
  if (light.lit) porchGlow(ctx, x, y - 12, 40, 0.28, [x - 48, y - 60, 96, 70]);
  const random = skyRandom(77);
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 4; column++) {
      // Draw the dice for every window, so the lit ones never move.
      const neighbour = random() < 0.35;
      ctx.fillStyle = row === 1 && column === 1
        ? light.window(light.lit)
        : light.lit && neighbour ? rgba(WINDOW_GLOW, 0.45) : light.window(false);
      ctx.fillRect(x - 21 + column * 11, y - 44 + row * 12, 7, 6);
    }
  }
  ctx.fillStyle = light.door;
  ctx.fillRect(x - 4, y - 9, 8, 9);
}

/** A long, low home on a skirt. */
function paintMobileHome(ctx: CanvasRenderingContext2D, light: HomeLight, house: string, x: number, y: number): void {
  ctx.fillStyle = house;
  ctx.beginPath();
  roundedRect(ctx, x - 29, y - 20, 58, 17, 3);
  ctx.fill();
  ctx.fillStyle = mixColor(house, INK, 0.2);
  ctx.fillRect(x - 26, y - 3, 52, 3);
  if (light.lit) porchGlow(ctx, x, y - 12, 40, 0.28, [x - 46, y - 60, 92, 70]);
  [x - 22, x - 8, x + 12].forEach((left, i) => {
    ctx.fillStyle = light.window(light.lit && !(i === 0 && light.late));
    ctx.fillRect(left, y - 15, 8, 5);
  });
  ctx.fillStyle = light.door;
  ctx.fillRect(x + 3, y - 15, 6, 12);
}

/** Bins at the curb left of the home, lit by the porch after dark. */
function paintBins(ctx: CanvasRenderingContext2D, scene: TodayScene, light: HomeLight, house: string, x: number, y: number): void {
  const right = x - homeLeftReach(scene.home) - 2;
  // At the curb: a little in front of the house.
  const base = y + 8;
  const { bins } = scene;
  if (light.lit) {
    const width = bins.length * 9 + 12;
    porchGlow(ctx, right - width / 2 + 3, base - 5, 18, 0.22, [right - width, base - 22, width + 6, 26]);
  }
  [...bins].reverse().forEach((kind, i) => {
    const colour = kind === 'recycling' ? '#2563EB' : kind === 'yard_waste' ? '#15803D' : '#4B5563';
    const left = right - (i + 1) * 9 + 2;
    ctx.fillStyle = mixColor(colour, house, light.night ? 0.55 : 0.35);
    ctx.beginPath();
    roundedRect(ctx, left, base - 9, 7, 9, 1.2);
    roundedRect(ctx, left - 0.6, base - 10.6, 8.2, 2, 0.8);
    ctx.fill();
  });
}

/** Three puffs rising from the chimney on a loop: straight up when it's calm, bent over and kept low in a strong wind. */
function paintChimneySmoke(ctx: CanvasRenderingContext2D, scene: TodayScene, x: number, y: number, time: number): void {
  const { wind, home } = scene;
  const reach = wind.calm ? 0 : wind.toward * (2 + wind.mph * 0.8);
  const rise = 34 * (1 - 0.45 * wind.strength);
  const [cx, cy] = chimneyTop(home, x, y);
  for (let i = 0; i < 3; i++) {
    const progress = (time * 0.35 + i / 3) % 1;
    circle(ctx, cx + 3 + Math.sin(progress * 5 + i) * 3 + progress * reach, cy - 2 - progress * rise, 3 + progress * 6, rgba('#E6EBF5', 0.35 * (1 - progress)));
  }
}

/** A round tree and a pine beside the home; both lean with the wind. The round tree blossoms in spring, turns in autumn and is bare in winter. */
function paintTrees(ctx: CanvasRenderingContext2D, f: SkyFrame, scene: TodayScene, house: string, x: number, y: number, time: number): void {
  const { home, season, wind } = scene;
  const night = scene.moment.phase === 'night';
  const lean = wind.lean(time, !f.animate);
  const reach = homeRightReach(home);
  ctx.save();
  ctx.translate(x + 11 + reach, y + 2);
  ctx.rotate(lean);
  ctx.fillStyle = house;
  ctx.fillRect(-1.5, -12, 3, 12);
  if (season === 'winter') {
    ctx.strokeStyle = house;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, -30);
    // Each twig: where it leaves the trunk, and its tip.
    for (const [from, tipX, tipY] of [[-16, -9, -27], [-19, 8, -29], [-24, -5, -33], [-25, 5, -34]]) {
      ctx.moveTo(0, from);
      ctx.lineTo(tipX, tipY);
    }
    ctx.stroke();
  } else {
    const leaf = season === 'spring' ? '#7BC67E' : season === 'autumn' ? '#E07A2E' : '#3F8F4A';
    const amount = night ? 0.22 : 0.62;
    oval(ctx, -10, -30, 22, 21, season === 'autumn' ? mixColor(house, '#B8432A', night ? 0.2 : 0.6) : mixColor(house, leaf, amount * 0.6));
    oval(ctx, -11, -31.5, 17, 16, mixColor(house, leaf, amount));
    if (season === 'spring') {
      for (const [bx, by] of [[-6, -26], [3, -28], [7, -22], [-3, -19], [-8, -20], [2, -16]]) circle(ctx, bx, by, 1.5, rgba('#F9A8D4', night ? 0.35 : 0.9));
    }
    if (season === 'autumn' && f.animate) {
      // Two leaves drifting down from the canopy on a loop, carried downwind.
      const carry = wind.toward * wind.strength * 16;
      for (let i = 0; i < 2; i++) {
        const progress = (time * 0.22 + i * 0.5) % 1;
        ctx.save();
        ctx.translate(6 - i * 12 + Math.sin(progress * 9 + i) * 4 + carry * progress, -20 + progress * 22);
        ctx.rotate(progress * 6 + i);
        oval(ctx, -2, -1, 4, 2, rgba('#E07A2E', (night ? 0.4 : 0.85) * (1 - progress * 0.7)));
        ctx.restore();
      }
    }
  }
  ctx.restore();
  // Past a garage the pine needs more room; on a narrow card it gives way rather than crossing the edge.
  const pineX = x + 35 + reach;
  if (home.garage !== 'none' && pineX + 9 > f.w - 2) return;
  ctx.save();
  ctx.translate(pineX, y + 3);
  ctx.rotate(lean * 0.7);
  ctx.fillStyle = house;
  ctx.fillRect(-1.5, -7, 3, 8);
  polygon(ctx, [[-9, -6], [0, -34], [9, -6]], mixColor(house, '#2F6B3F', night ? 0.12 : 0.4));
  ctx.restore();
}

// ── In front ──────────────────────────────────────────────

/** Soft puffs of fog drifting along the ground, in front of the house and below the reading. */
function paintFog(ctx: CanvasRenderingContext2D, f: SkyFrame, night: boolean, time: number): void {
  const tint = night ? '#C8D2E1' : '#EBF0F5';
  const opacity = night ? 0.22 : 0.45;
  const span = f.w * 1.6;
  const stretch = 9 * Math.max(1, f.w / 358);
  for (let i = 0; i < 6; i++) {
    const x = drift((i * span) / 6, i % 2 === 0 ? 7 : -5, span, time) - f.w * 0.3;
    ctx.save();
    ctx.translate(x, f.horizon - 12 + (i % 3) * 12);
    ctx.scale(stretch, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 13);
    g.addColorStop(0, rgba(tint, opacity));
    g.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/** Frost from three corners (never the top left, where the reading sits): a pale haze and a few crystals with side shoots. */
function paintFrost(ctx: CanvasRenderingContext2D, f: SkyFrame): void {
  const frost = '#E8F4FF';
  const random = skyRandom(41);
  const crystals = new Path2D();
  for (const [cx, cy] of [[f.w, 0], [0, f.H], [f.w, f.H]]) {
    glow(ctx, cx, cy, 64, frost, 0.38);
    const inward = Math.atan2(f.H / 2 - cy, f.w / 2 - cx);
    for (let i = 0; i < 7; i++) {
      const angle = inward + (random() - 0.5) * 1.4;
      const length = 18 + random() * 26;
      const offset = random() * 8;
      const startX = cx + Math.cos(angle) * offset;
      const startY = cy + Math.sin(angle) * offset;
      crystals.moveTo(startX, startY);
      crystals.lineTo(startX + Math.cos(angle) * length, startY + Math.sin(angle) * length);
      const midX = startX + Math.cos(angle) * length * 0.55;
      const midY = startY + Math.sin(angle) * length * 0.55;
      for (const side of [-0.6, 0.6]) {
        crystals.moveTo(midX, midY);
        crystals.lineTo(midX + Math.cos(angle + side) * length * 0.35, midY + Math.sin(angle + side) * length * 0.35);
      }
    }
  }
  ctx.strokeStyle = rgba(frost, 0.55);
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.stroke(crystals);
}

// ── The picture ───────────────────────────────────────────

function paintAir(ctx: CanvasRenderingContext2D, f: SkyFrame, scene: TodayScene, time: number, rise: number): void {
  const { family, moment, wind } = scene;
  const night = moment.phase === 'night';
  if (night && (family === 'clear' || family === 'partly')) paintStars(ctx, f, time);
  if (night) paintMoon(ctx, f, scene, rise);
  else paintSun(ctx, f, scene, time, rise);
  if (family === 'partly') paintPuffs(ctx, f, scene, time);
  else if (family !== 'clear') paintDeck(ctx, f, scene, time);
  if (family === 'wet' || family === 'storm') paintRain(ctx, f, scene, time);
  if (family === 'snow' || scene.sleet) paintSnow(ctx, f, scene, time);
  if (wind.streaks > 0) paintWind(ctx, f, scene, time);
  if (family === 'storm' && f.animate) paintLightning(ctx, f, time);
}

function paintHome(ctx: CanvasRenderingContext2D, f: SkyFrame, scene: TodayScene, time: number): void {
  const { family, moment, home } = scene;
  const night = moment.phase === 'night';
  const snow = family === 'snow';
  if (snow) paintSnowGround(ctx, f, night);
  const bottom = f.s[2];
  const house = snow ? (night ? '#2C3850' : '#5E7088') : mixColor(bottom, INK, night ? 0.75 : 0.72);
  const lit = moment.phase === 'dusk' || night;
  const light: HomeLight = {
    lit,
    late: moment.lateNight,
    night,
    window: (on) => (on ? WINDOW_GLOW : mixColor(bottom, WHITE, 0.15)),
    door: lit ? rgba(WINDOW_GLOW, 0.55) : mixColor(bottom, INK, 0.55),
    garageDoor: (tone) => mixColor(tone, bottom, 0.18),
  };
  const x = f.w * HOME_X;
  const y = f.horizon + 7;
  if (home.kind === 'townhouse') paintTownhouses(ctx, home, light, house, x, y);
  else if (home.kind === 'apartment') paintApartment(ctx, light, house, x, y);
  else if (home.kind === 'mobile') paintMobileHome(ctx, light, house, x, y);
  else paintHouse(ctx, home, light, house, snow, x, y);
  if (scene.bins.length) paintBins(ctx, scene, light, house, x, y);
  if (scene.cold && f.animate && home.chimney) paintChimneySmoke(ctx, scene, x, y, time);
  paintTrees(ctx, f, scene, house, x, y, time);
}

/** One card's painter: the sun or moon rises into place once, when the card first paints. */
export function todaySkyPainter(): SkyDraw<TodayScene> {
  let firstFrame = NaN;
  return (ctx, w, H, _hour, t, scene, seeds, animate) => {
    const horizon = H * HORIZON;
    const s = scene.colors;
    const f: SkyFrame = { w, H, s, horizon, animate };
    // Seconds of the running clock. A still frame is the apps' own, at 2 s.
    const time = animate ? t / 1000 : 2;
    if (Number.isNaN(firstFrame)) firstFrame = t;
    // Eased over 0.9 s; in place at once without motion.
    const rise = animate ? 1 - Math.pow(1 - Math.min(1, (t - firstFrame) / 900), 3) : 1;

    try {
      paintSkyGradient(ctx, w, H, horizon, s);
      paintAir(ctx, f, scene, time, rise);
      if (scene.smoke > 0) paintSmokeVeil(ctx, w, horizon, scene.smoke);
      paintLand(ctx, w, H, horizon, s, scene.dark, { homes: scene.lights, cells: false }, HOME_X, seeds, animate ? t : 0, animate);
      paintHome(ctx, f, scene, time);
      paintGroundShadow(ctx, w, H, horizon);
      // Fog hugs the ground, in front of the home and below the reading.
      if (scene.family === 'fog') paintFog(ctx, f, scene.moment.phase === 'night', time);
      if (scene.frost) paintFrost(ctx, f);
    } catch {
      // A picture never takes the page down, from its first paint in an effect or from the loop.
    }
  };
}
