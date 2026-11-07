// ============================================================
// What moves on the table (launch key card_table): every moving thing is a
// spring, and one pull does it all. A port of sample/index.html, numbers and
// all; design.md section 3 explains them. It writes straight to the elements
// it finds by data-el under `root`, so a frame never goes through React, and
// tells React only when the words and buttons should change.
// ============================================================

export type TableStep = 'front' | 'back' | 'flap' | 'pulling' | 'out';

export type TableState = {
  step: TableStep;
  /** The card's back is up (or turning to it). */
  backUp: boolean;
  turnedOnce: boolean;
  envTurnedOnce: boolean;
  heldOnce: boolean;
};

export type TableCallbacks = {
  /** The words and buttons should follow: called when the step or what's been done changes. */
  onState: (state: TableState) => void;
  /** A sealed flap refused. */
  onRefused: () => void;
  /** Tapped the table with the card on it: hide or show the controls. */
  onTableTap: () => void;
  /** Something other than a control was pressed: close any open menu. */
  onPress: () => void;
};

type Spring = { x: number; v: number; t: number; k: number; c: number };
type SpringKey = 'envDeg' | 'pull' | 'lay' | 'deg' | 'tx' | 'ty' | 'drop';
type Drag = {
  id: number; x0: number; y0: number; t0: number; lx: number; ly: number; lt: number; vx: number; vy: number;
  mode: null | 'env' | 'pull' | 'turn' | 'tilt' | 'none';
  env0: number; pull0: number; deg0: number; xs?: number; ys?: number; holdTimer?: number;
};
type Geometry = {
  w: number; h: number; cw: number; ch: number; ew: number; eh: number; fd: number; cardTop: number; envTopFinal: number;
  envX: number; envY: number; cardX: number; envYOpen: number; envTopOut: number; cardTopOut: number;
};

const FLAP_OPEN = 0.3;
const LAYERS = ['lInside', 'lPocket', 'lPocketShadow', 'lFlapShadow', 'lFront', 'lFlapOut', 'lFlapIn'];
const BACK_LAYERS = ['lInside', 'lPocket', 'lPocketShadow', 'lFlapShadow', 'lFlapOut', 'lFlapIn'];

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** A tap you can feel, where the browser allows it (iOS Safari has no vibrate). */
function tick(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* no haptics here */ }
}

export class CardTableEngine {
  private readonly root: HTMLElement;

  private readonly sealed: boolean;

  private readonly callbacks: TableCallbacks;

  private readonly crackedSrc: string;

  private readonly wholeSrc: string;

  private readonly v: Record<SpringKey, Spring> = {
    envDeg: { x: 0, v: 0, t: 0, k: 95, c: 15 }, // the envelope turning over: 0 address side, 180 flap side
    pull: { x: 0, v: 0, t: 0, k: 70, c: 16 }, // 0 shut, .3 flap open, 1 card out
    lay: { x: 0, v: 0, t: 0, k: 62, c: 12.5 }, // the card laid down in front of the envelope
    deg: { x: 0, v: 0, t: 0, k: 88, c: 13.5 }, // the card turning over
    tx: { x: 0, v: 0, t: 0, k: 40, c: 11 }, // the light
    ty: { x: 0, v: 0, t: 0, k: 40, c: 11 },
    drop: { x: 1, v: 0, t: 0, k: 58, c: 11.5 }, // the envelope arriving on the table
  };

  private step: TableStep = 'front';

  private turnedOnce = false;

  private envTurnedOnce = false;

  private heldOnce = false;

  private cracked = false;

  private paused = false;

  private gyro = false;

  private lastTouch = 0;

  private dragging: Drag | null = null;

  private g: Geometry | null = null;

  private raf = 0;

  private last = 0;

  private destroyed = false;

  private flapTimer = 0;

  private readonly elements = new Map<string, HTMLElement>();

  constructor(root: HTMLElement, options: { sealed: boolean; crackedSrc: string; wholeSrc: string; callbacks: TableCallbacks }) {
    this.root = root;
    this.sealed = options.sealed;
    this.crackedSrc = options.crackedSrc;
    this.wholeSrc = options.wholeSrc;
    this.callbacks = options.callbacks;
    root.addEventListener('pointerdown', this.onDown);
    root.addEventListener('mousemove', this.onMouse);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('resize', this.onResize);
    // A phone's tilt, where the browser gives it freely. iOS Safari asks permission first, so it isn't asked at all.
    const orientation = window.DeviceOrientationEvent as unknown as { requestPermission?: unknown } | undefined;
    if (orientation && !orientation.requestPermission && !reducedMotion()) window.addEventListener('deviceorientation', this.onTilt);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.flapTimer);
    if (this.dragging?.holdTimer) window.clearTimeout(this.dragging.holdTimer);
    this.root.removeEventListener('pointerdown', this.onDown);
    this.root.removeEventListener('mousemove', this.onMouse);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('deviceorientation', this.onTilt);
  }

  private $(name: string): HTMLElement {
    let el = this.elements.get(name);
    if (!el) {
      el = this.root.querySelector<HTMLElement>(`[data-el="${name}"]`) ?? undefined;
      if (!el) throw new Error(`No ${name} on the table`);
      this.elements.set(name, el);
    }
    return el;
  }

  /** Stop and start with an overlay over the table. */
  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) this.wake();
  }

  private state(): TableState {
    return {
      step: this.step,
      backUp: Math.cos((this.v.deg.t * Math.PI) / 180) < 0,
      turnedOnce: this.turnedOnce,
      envTurnedOnce: this.envTurnedOnce,
      heldOnce: this.heldOnce,
    };
  }

  private mark() {
    this.callbacks.onState(this.state());
  }

  /** The envelope arrives, address side up, as it does the first time. */
  restart(animated = true) {
    for (const key of ['envDeg', 'pull', 'lay', 'deg'] as const) {
      this.v[key].x = 0; this.v[key].t = 0; this.v[key].v = 0;
    }
    window.clearTimeout(this.flapTimer);
    this.step = 'front';
    this.setCracked(false);
    this.v.drop.x = animated && !reducedMotion() ? 1 : 0;
    this.v.drop.v = 0;
    this.v.drop.t = 0;
    this.mark();
    this.layout();
    this.render();
    this.wake();
  }

  /** Straight to the card lying on the table, as when it was opened before. */
  startOnTable() {
    const set = (key: SpringKey, x: number) => { this.v[key].x = x; this.v[key].t = x; this.v[key].v = 0; };
    set('drop', 0); set('envDeg', 180); set('pull', 1); set('lay', 1); set('deg', 0);
    this.step = 'out';
    this.envTurnedOnce = true;
    this.setCracked(true);
    this.mark();
    this.layout();
    this.render();
    this.wake();
  }

  private setCracked(cracked: boolean) {
    this.cracked = cracked;
    const seal = this.$('seal') as HTMLImageElement;
    seal.src = cracked ? this.crackedSrc : this.wholeSrc;
    seal.dataset.cracked = cracked ? '1' : '0';
  }

  private crack() {
    if (this.cracked) return;
    this.setCracked(true);
    tick(14);
  }

  private toFlapSide() {
    this.v.envDeg.t = 180 * (Math.sign(this.v.envDeg.t) || -1);
    this.envTurnedOnce = true;
    this.step = 'back';
    tick();
    this.mark();
    this.wake();
  }

  private openFlap() {
    if (this.sealed) { this.resist(); return; }
    this.crack();
    this.v.pull.t = FLAP_OPEN;
    this.step = 'flap';
    this.mark();
    this.wake();
  }

  private resist() {
    this.v.pull.t = 0;
    this.v.pull.v = 1.1;
    this.callbacks.onRefused();
    tick(20);
    this.wake();
  }

  private takeOut() {
    this.crack();
    this.v.pull.t = 1;
    this.step = 'pulling';
    this.mark();
    this.wake();
  }

  /** The button under the table: whatever comes next. */
  primary() {
    this.lastTouch = performance.now();
    const reduce = reducedMotion();
    if (this.step === 'front') {
      if (reduce) {
        this.v.envDeg.x = 180; this.v.envDeg.t = 180;
        this.step = 'back'; this.envTurnedOnce = true;
        this.mark(); this.render();
        return;
      }
      this.toFlapSide();
    } else if (this.step === 'back') {
      if (this.sealed) { this.resist(); return; }
      if (reduce) {
        this.v.pull.x = 1; this.v.pull.t = 1; this.v.lay.x = 1; this.v.lay.t = 1;
        this.step = 'out';
        this.setCracked(true);
        this.mark(); this.render();
        return;
      }
      this.openFlap();
      this.flapTimer = window.setTimeout(() => { if (this.step === 'flap') this.takeOut(); }, 680);
    } else if (this.step === 'flap') {
      this.takeOut();
    } else if (this.step === 'out') {
      this.turnCard();
    }
  }

  /** Arrow keys: the same turns a finger makes. */
  arrow(direction: -1 | 1) {
    this.lastTouch = performance.now();
    if (this.step === 'front') { this.primary(); return; }
    if (this.step === 'back') {
      // Back to the address side.
      this.v.envDeg.t = 0;
      if (reducedMotion()) this.v.envDeg.x = 0;
      this.step = 'front';
      tick();
      this.mark();
      this.render();
      this.wake();
      return;
    }
    if (this.step === 'out') this.turnCard(direction);
  }

  private turnCard(dir = -1) {
    this.v.deg.t = (Math.round(this.v.deg.t / 180) + (dir < 0 ? -1 : 1)) * 180;
    if (reducedMotion()) this.v.deg.x = this.v.deg.t;
    this.turnedOnce = true;
    tick();
    this.mark();
    this.render();
    this.wake();
  }

  // ---- Layout: design.md section 2 ----

  private readonly onResize = () => { this.layout(); this.render(); };

  layout() {
    const stage = this.root;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    const probe = this.$('safe').getBoundingClientRect();
    const safeTop = probe.height;
    const bottom = this.$('bottom').getBoundingClientRect().height + 8;
    const topGap = safeTop + 6;
    const room = h - topGap - bottom;
    const side = w < 560 ? 9 : 14;
    // Phones: nearly as wide as the screen. Tablets and wide windows cap the card on a big table.
    let cw = Math.min(w - side * 2, w < 760 ? 470 : 560);
    let peek = room - cw * 1.2;
    const minPeek = cw * 0.13;
    const maxPeek = cw * 0.47;
    if (peek < minPeek) { cw = Math.min(cw, room / (1.2 + 0.13)); peek = cw * 0.13; }
    peek = Math.min(peek, maxPeek);
    const spare = Math.max(0, room - cw * 1.2 - peek);
    const cardTop = topGap + spare * 0.46 + peek;
    const ew = cw * 1.012;
    const eh = (ew * 1392) / 1200;
    const fd = (ew * 512) / 1200;
    const envTopFinal = cardTop - peek + fd;
    // Shut, it sits a little above the middle of the free space, under the words.
    const free = h - safeTop - bottom;
    // Large text: the words above it may take two lines.
    const wordSize = parseFloat(getComputedStyle(this.$('words')).fontSize) || 18;
    const envY = safeTop + Math.max(88, 54 + wordSize * 1.3 * (wordSize >= 24 ? 2 : 1) + 6, (free - eh) * 0.56);
    const envTopOut = Math.min(h - eh * 0.5, cw * 1.2 * 0.8 + 8);
    this.g = {
      w, h, cw, ch: cw * 1.2, ew, eh, fd, cardTop, envTopFinal, envX: (w - ew) / 2, envY, cardX: (w - cw) / 2,
      envYOpen: Math.max(envY, safeTop + fd * 0.9 + 4), envTopOut, cardTopOut: envTopOut - cw * 1.2 * 1.02 - 8,
    };
    stage.style.setProperty('--ew', `${ew}px`);
    this.$('card').style.setProperty('--u', `${cw / 100}px`);
    for (const id of LAYERS) {
      const el = this.$(id);
      el.style.width = `${ew}px`;
      el.style.height = `${eh}px`;
      el.style.transformOrigin = `${ew / 2}px ${eh / 2}px`;
    }
    this.$('flapIn').style.top = `${-fd}px`;
    this.$('flapIn').style.height = `${fd}px`;
    this.$('flapOut').style.height = `${fd}px`;
    const envShadow = this.$('envShadow').style;
    envShadow.width = `${ew}px`;
    envShadow.height = `${eh}px`;
    envShadow.boxShadow = `0 0 ${ew * 0.08}px ${ew * 0.02}px rgba(0,0,0,.72)`;
    for (const [id, blur] of [['cardShadowWide', 0.14], ['cardShadowTight', 0.03]] as const) {
      const shadow = this.$(id).style;
      shadow.width = `${cw}px`;
      shadow.height = `${cw * 1.2}px`;
      shadow.boxShadow = `0 0 ${cw * blur}px ${cw * blur * 0.25}px #000`;
    }
    this.$('words').style.top = `${safeTop + 54}px`;
  }

  // ---- Fingers ----

  private readonly onDown = (e: PointerEvent) => {
    if ((e.target as Element).closest?.('[data-ui]')) return;
    this.callbacks.onPress();
    this.root.setPointerCapture?.(e.pointerId);
    const now = performance.now();
    const drag: Drag = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: now, lx: e.clientX, ly: e.clientY, lt: now, vx: 0, vy: 0, mode: null,
      env0: this.v.envDeg.x, pull0: this.v.pull.x, deg0: this.v.deg.x,
    };
    this.dragging = drag;
    this.lastTouch = now;
    // Hold still for a moment on the card: the finger moves the light instead.
    drag.holdTimer = window.setTimeout(() => {
      if (this.dragging === drag && !drag.mode && this.step === 'out' && !reducedMotion()) {
        drag.mode = 'tilt';
        this.heldOnce = true;
        tick(5);
        this.mark();
      }
    }, 240);
    this.wake();
  };

  private readonly onMove = (e: PointerEvent) => {
    const d = this.dragging;
    if (!d || e.pointerId !== d.id || !this.g) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    const now = performance.now();
    const dt = Math.max(1, now - d.lt);
    d.vx = lerp(d.vx, (e.clientX - d.lx) / dt, 0.5);
    d.vy = lerp(d.vy, (e.clientY - d.ly) / dt, 0.5);
    d.lx = e.clientX; d.ly = e.clientY; d.lt = now;
    this.lastTouch = now;
    if (!d.mode && Math.hypot(dx, dy) > 8) {
      window.clearTimeout(d.holdTimer);
      const horizontal = Math.abs(dx) > Math.abs(dy);
      // With Reduce Motion nothing turns under a finger: the button does it all.
      if (reducedMotion()) d.mode = 'none';
      else if (this.step === 'front') d.mode = horizontal ? 'env' : 'none';
      else if (this.step === 'back' || this.step === 'flap') d.mode = !horizontal && dy < 0 ? 'pull' : (horizontal && this.step === 'back' ? 'env' : 'none');
      else if (this.step === 'out') d.mode = horizontal ? 'turn' : 'tilt';
      else d.mode = 'none';
      d.xs = e.clientX; d.ys = e.clientY;
    }
    const { v, g } = this;
    if (d.mode === 'env') {
      v.envDeg.x = d.env0 + ((e.clientX - (d.xs ?? 0)) / (g.ew * 0.8)) * 180;
      v.envDeg.t = v.envDeg.x; v.envDeg.v = 0;
    } else if (d.mode === 'pull') {
      const up = (d.ys ?? 0) - e.clientY;
      let p = d.pull0 + up / (g.h * 0.36);
      if (this.sealed) p = Math.min(0.04, p * 0.12);
      v.pull.x = clamp(p, 0, 1); v.pull.t = v.pull.x; v.pull.v = 0;
      if (!this.sealed && v.pull.x > 0.03) this.crack();
    } else if (d.mode === 'turn') {
      v.deg.x = d.deg0 + ((e.clientX - (d.xs ?? 0)) / (g.cw * 0.86)) * 180;
      v.deg.t = v.deg.x; v.deg.v = 0;
    } else if (d.mode === 'tilt') {
      const r = this.root.getBoundingClientRect();
      v.tx.t = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1) * 1.1;
      v.ty.t = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1) * 1.1;
    }
    this.render();
  };

  private readonly onUp = (e: PointerEvent) => {
    const d = this.dragging;
    if (!d || e.pointerId !== d.id || !this.g) return;
    this.dragging = null;
    window.clearTimeout(d.holdTimer);
    const now = performance.now();
    const { v, g } = this;
    if (e.type !== 'pointercancel' && !d.mode && now - d.t0 < 320) { this.onTap(e); return; }
    if (d.mode === 'env') {
      const flick = ((d.vx * 1000) / (g.ew * 0.8)) * 180 * 0.22;
      const aim = Math.round((v.envDeg.x + flick) / 180) * 180;
      v.envDeg.t = aim; v.envDeg.v = flick * 1.2;
      if (Math.cos((aim * Math.PI) / 180) < 0) {
        if (this.step !== 'back') tick();
        this.step = 'back';
        this.envTurnedOnce = true;
      } else this.step = 'front';
      this.mark();
    } else if (d.mode === 'pull') {
      const flick = ((-d.vy * 1000) / (g.h * 0.36)) * 0.22;
      const aim = v.pull.x + flick;
      if (this.sealed) this.resist();
      else if (aim > 0.54) { this.takeOut(); v.pull.v = flick; }
      else if (aim > 0.14) { v.pull.t = FLAP_OPEN; this.step = 'flap'; this.mark(); }
      else { v.pull.t = 0; this.step = 'back'; this.mark(); }
    } else if (d.mode === 'turn') {
      const flick = ((d.vx * 1000) / (g.cw * 0.86)) * 180 * 0.22;
      const aim = Math.round((v.deg.x + flick) / 180) * 180;
      v.deg.t = aim; v.deg.v = flick * 1.1;
      if (Math.abs(aim - d.deg0) > 1) { this.turnedOnce = true; tick(); }
      this.mark();
    }
    this.lastTouch = now;
    this.wake();
  };

  private onTap(e: PointerEvent) {
    if (this.step === 'out') {
      const r = this.$('card').getBoundingClientRect();
      const inCard = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
      if (inCard) this.turnCard();
      else this.callbacks.onTableTap();
      return;
    }
    if (this.step === 'front' || this.step === 'back') { this.primary(); return; }
    if (this.step === 'flap') this.takeOut();
  }

  /** A computer's mouse moves the light directly. */
  private readonly onMouse = (e: MouseEvent) => {
    if (this.dragging || reducedMotion()) return;
    const r = this.root.getBoundingClientRect();
    this.v.tx.t = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    this.v.ty.t = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    this.lastTouch = performance.now();
    this.wake();
  };

  private readonly onTilt = (ev: DeviceOrientationEvent) => {
    if (ev.gamma == null || ev.beta == null) return;
    this.gyro = true;
    this.heldOnce = true;
    this.v.tx.t = clamp(ev.gamma / 22, -1.1, 1.1);
    this.v.ty.t = clamp((ev.beta - 45) / 22, -1.1, 1.1);
    this.wake();
  };

  // ---- The picture of the moment ----

  private render() {
    const { g, v } = this;
    if (!g) return;
    const pull = v.pull.x;
    const lay = v.lay.x;
    const tx = v.tx.x;
    const ty = v.ty.x;
    const drop = v.drop.x;
    const flapT = smooth(0, FLAP_OPEN, pull);
    const theta = 180 * flapT;
    const r = smooth(FLAP_OPEN, 1, pull); // the card coming out

    // Envelope pose.
    const eRot = lerp(lerp(-1.1, 0.4, r), 1.5, lay);
    let eTop = lerp(lerp(g.envY, g.envYOpen, flapT), g.envTopOut, r);
    eTop = lerp(eTop, g.envTopFinal, lay);
    const arrive = drop * (g.h * 0.9);
    const ex = g.envX + tx * 2.5;
    const ey = eTop + ty * 2.5 - arrive;
    const eRotA = eRot - drop * 6;

    // Which side of the envelope is up.
    const envAngle = v.envDeg.x;
    const cosE = Math.cos((envAngle * Math.PI) / 180);
    const flapSide = cosE < 0;
    const persp = g.ew * 3.6;
    const base = `translate3d(${ex}px,${ey}px,0) rotate(${eRotA}deg)`;
    const settled = Math.abs(Math.sin((envAngle * Math.PI) / 180)) < 0.001;
    const backT = base + (settled ? '' : ` perspective(${persp}px) rotateY(${envAngle + 180}deg)`);
    const frontT = base + (settled ? '' : ` perspective(${persp}px) rotateY(${envAngle}deg)`);
    const front = this.$('lFront');
    front.style.display = flapSide ? 'none' : 'block';
    front.style.transform = frontT;
    for (const id of BACK_LAYERS) {
      const el = this.$(id);
      el.style.display = flapSide ? 'block' : 'none';
      el.style.transform = backT;
    }
    // The envelope's shadow on the table.
    const envShadow = this.$('envShadow');
    envShadow.style.transform = `translate3d(${ex + 3 - tx * 7}px,${ey + 7 - ty * 7}px,0) rotate(${eRotA}deg) scaleX(${Math.max(0.02, Math.abs(cosE))})`;
    envShadow.style.opacity = '.78';

    // Flap.
    const flapOut = this.$('flapOut');
    const flapIn = this.$('flapIn');
    const open = theta >= 90;
    flapOut.style.display = open ? 'none' : 'block';
    flapIn.style.display = open ? 'block' : 'none';
    if (!open) {
      flapOut.style.transform = theta > 0.01 ? `perspective(${g.ew * 2.4}px) rotateX(${theta}deg)` : 'none';
      flapOut.style.filter = theta > 0.01 ? `brightness(${1 - 0.3 * Math.sin((theta * Math.PI) / 180)})` : 'none';
    } else {
      flapIn.style.transform = theta < 179.99 ? `perspective(${g.ew * 2.4}px) rotateX(${theta - 180}deg)` : 'none';
      flapIn.style.filter = theta < 179.99 ? `brightness(${1 - 0.45 * Math.sin((theta * Math.PI) / 180)})` : 'none';
    }
    this.$('lFlapShadow').style.opacity = open ? '0' : String(Math.cos((theta * Math.PI) / 180) ** 1.4);
    this.$('flapGlint').style.transform = `translateX(${tx * 28}%) translateY(${ty * 10}%)`;

    // Card pose.
    const cardIn = eTop + g.eh * 0.02;
    let cTop = lerp(cardIn, g.cardTopOut, r);
    let cRot = lerp(eRot, -0.8, r);
    let cs = lerp(0.94, 1.03, smooth(0.2, 1, r));
    cTop = lerp(cTop, g.cardTop, lay);
    cRot = lerp(cRot, -1.05, lay);
    cs = lerp(cs, 1, lay);
    const cx = g.cardX + tx * 5;
    const cy = cTop + ty * 5 - arrive;
    const yFix = (g.ch * (cs - 1)) / 2; // it grows from its top edge
    const card = this.$('card');
    card.style.display = flapSide && pull > 0.001 ? 'block' : 'none';
    const out = r >= 0.999;
    card.style.zIndex = out ? '20' : '5';
    card.style.transform = `translate3d(${cx}px,${cy + yFix}px,0) rotate(${cRot}deg) scale(${cs})`;
    this.$('flip').style.transform = `rotateX(${-ty * 2.6}deg) rotateY(${v.deg.x + tx * 3.2}deg)`;

    // The card's shadows grow as it lifts off the paper.
    const lift = (1 - lay) * r;
    const narrow = Math.max(0.03, Math.abs(Math.cos((v.deg.x * Math.PI) / 180)));
    const wide = this.$('cardShadowWide');
    const tight = this.$('cardShadowTight');
    wide.style.display = out ? 'block' : 'none';
    tight.style.display = out ? 'block' : 'none';
    if (out) {
      const off = 6 + lift * 26;
      wide.style.transform = `translate3d(${cx + off * 0.45 - tx * 10}px,${cy + yFix + off - ty * 10}px,0) rotate(${cRot}deg) scale(${cs * narrow},${cs})`;
      wide.style.opacity = String(0.4 + lift * 0.16);
      tight.style.transform = `translate3d(${cx + 1.5 - tx * 2}px,${cy + yFix + 2.5 - ty * 2}px,0) rotate(${cRot}deg) scale(${cs * narrow},${cs})`;
      tight.style.opacity = String(0.55 * (1 - lift));
    }

    // Light, sheen, shading as the card turns.
    this.$('light').style.transform = `translate(${tx * 22}px,${ty * 22}px) scale(1.04)`;
    const sinD = Math.abs(Math.sin((v.deg.x * Math.PI) / 180));
    const sheen = `translate(${(tx * 0.9 + (v.deg.x / 180) * 0.6) * 26}%,${ty * 16}%)`;
    this.$('sheenFront').style.transform = sheen;
    this.$('sheenBack').style.transform = sheen;
    this.$('shadeFront').style.opacity = String(sinD * 0.34);
    this.$('shadeBack').style.opacity = String(sinD * 0.34);
    this.$('table').style.transform = `translate(${-tx * 7}px,${-ty * 7}px)`;

    // Words stay out of the way of what's moving.
    this.$('words').style.opacity = pull > 0.02 || this.step === 'pulling' ? '0' : '';
    this.$('act').style.opacity = this.step === 'pulling' ? '0' : '';
  }

  // ---- The animation loop ----

  wake() {
    if (!this.raf && !this.paused && !this.destroyed) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private readonly frame = (now: number) => {
    this.raf = 0;
    if (this.paused || this.destroyed) return;
    const { v, dragging } = this;
    const reduce = reducedMotion();
    const dt = Math.min(0.05, Math.max(0, now - this.last) / 1000);
    this.last = now;
    // Idle: the light drifts by itself, slowly, so the paper is alive even without a hand on it.
    if (now - this.lastTouch > 2600 && !dragging && !this.gyro && !reduce) {
      v.tx.t = Math.sin(now / 2900) * 0.62;
      v.ty.t = Math.sin(now / 4100 + 1) * 0.5;
    }
    const steps = Math.max(1, Math.ceil(dt / 0.006));
    const h = dt / steps;
    let moving = false;
    for (const key of Object.keys(v) as (SpringKey)[]) {
      const s = v[key];
      const held = dragging && ((dragging.mode === 'env' && key === 'envDeg') || (dragging.mode === 'pull' && key === 'pull') || (dragging.mode === 'turn' && key === 'deg'));
      if (!held) {
        for (let i = 0; i < steps; i += 1) {
          const a = s.k * (s.t - s.x) - s.c * s.v;
          s.v += a * h;
          s.x += s.v * h;
        }
        if (Math.abs(s.t - s.x) > 0.0006 || Math.abs(s.v) > 0.0006) moving = true;
        else { s.x = s.t; s.v = 0; }
      }
    }
    // Once it has cleared the envelope, the card is laid down in front of it.
    if (this.step === 'pulling' && v.pull.x > 0.985) {
      v.pull.x = 1; v.pull.t = 1; v.pull.v = 0;
      this.step = 'out';
      v.lay.t = 1;
      tick(10);
      this.mark();
      moving = true;
    }
    this.render();
    if (moving || dragging || (!reduce && !this.gyro)) this.raf = requestAnimationFrame(this.frame);
  };

  /** For checks in a browser: jump straight to any moment, as the sample's __sample.go does. */
  go(step: 'front' | 'back' | 'flap' | 'rising' | 'out' | 'outback', options: { p?: number; tx?: number; ty?: number } = {}) {
    const set = (key: SpringKey, x: number) => { this.v[key].x = x; this.v[key].t = x; this.v[key].v = 0; };
    window.clearTimeout(this.flapTimer);
    set('drop', 0); set('tx', options.tx ?? 0); set('ty', options.ty ?? 0);
    this.lastTouch = performance.now() + 3_600_000;
    set('envDeg', 0); set('pull', 0); set('lay', 0); set('deg', 0);
    this.setCracked(false);
    if (step === 'front') this.step = 'front';
    if (step === 'back') { set('envDeg', 180); this.step = 'back'; }
    if (step === 'flap') { set('envDeg', 180); set('pull', FLAP_OPEN); this.step = 'flap'; this.setCracked(true); }
    if (step === 'rising') { set('envDeg', 180); set('pull', options.p ?? 0.6); this.step = 'flap'; this.setCracked(true); }
    if (step === 'out' || step === 'outback') {
      set('envDeg', 180); set('pull', 1); set('lay', 1); this.step = 'out'; this.setCracked(true);
      if (step === 'outback') { set('deg', 180); this.turnedOnce = true; }
    }
    this.mark();
    this.layout();
    this.render();
  }
}
