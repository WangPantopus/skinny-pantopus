// d3's Albers USA, as the journey map's outlines were drawn with it (usStates.json, 975 x 610: scale 1300, centred at
// 487.5, 305), small enough to carry: the lower 48 on an Albers equal-area conic, Alaska and Hawaii on their own,
// moved under it. A town's point is its state's projection of its Census centre.

const RAD = Math.PI / 180;
const K = 1300;
const TX = 487.5;
const TY = 305;

function conic(rotate: number, center: [number, number], parallels: [number, number], k: number, tx: number, ty: number) {
  const sy0 = Math.sin(parallels[0] * RAD);
  const n = (sy0 + Math.sin(parallels[1] * RAD)) / 2;
  const c = 1 + sy0 * (2 * n - sy0);
  const r0 = Math.sqrt(c) / n;
  const raw = (lambda: number, phi: number): [number, number] => {
    const r = Math.sqrt(c - 2 * n * Math.sin(phi)) / n;
    const x = lambda * n;
    return [r * Math.sin(x), r0 - r * Math.cos(x)];
  };
  const [cx, cy] = raw(center[0] * RAD, center[1] * RAD);
  const dx = tx - k * cx;
  const dy = ty + k * cy;
  return (lon: number, lat: number): [number, number] => {
    let lambda = (lon + rotate) * RAD;
    // Wrap to [-π, π], as d3's rotation does.
    lambda = ((lambda + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const [x, y] = raw(lambda, lat * RAD);
    return [dx + k * x, dy - k * y];
  };
}

const lower48 = conic(96, [-0.6, 38.7], [29.5, 45.5], K, TX, TY);
const alaska = conic(154, [-2, 58.5], [55, 65], 0.35 * K, TX - 0.307 * K, TY + 0.201 * K);
const hawaii = conic(157, [-3, 19.9], [8, 18], K, TX - 0.205 * K, TY + 0.212 * K);

/** A town's point on the 975 x 610 map, by its state (Alaska and Hawaii sit in their boxes under the lower 48). */
export function albersUsa(lon: number, lat: number, state?: string | null): [number, number] {
  if (state === 'AK') return alaska(lon, lat);
  if (state === 'HI') return hawaii(lon, lat);
  return lower48(lon, lat);
}
