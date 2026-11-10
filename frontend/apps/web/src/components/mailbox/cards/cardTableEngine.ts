// ============================================================
// What moves on the table (launch key card_table): every moving thing is a
// spring, and one pull does it all. A port of sample/index.html, numbers and
// all; design.md section 3 explains them. It writes straight to the elements
// it finds by data-el under `root`, so a frame never goes through React, and
// tells React only when the words and buttons should change.
// ============================================================

export type TableStep = 'front' | 'back' | 'flap' | 'pulling' | 'out';

/**
 * Sealing it by hand (design plan Part 2): the receiving moment run backwards. ready: the card note side up in front
 * of the open envelope; putting: it goes in; in: its top edge shows in the V; closing: the flap comes down; seal: shut,
 * waiting for the press; sending: the seal is on and the card is going; addressed: the envelope turns over, the name is
 * written, the stamp and the postmark land; gone: it slides up and off the table.
 */
export type SendStep = 'ready' | 'putting' | 'in' | 'closing' | 'seal' | 'sending' | 'addressed' | 'gone';

export type TableState = {
  step: TableStep;
  /** The card's back is up (or turning to it). */
  backUp: boolean;
  turnedOnce: boolean;
  envTurnedOnce: boolean;
  heldOnce: boolean;
  /** Sealing it by hand: where it is. Null when receiving. */
  send: SendStep | null;
  /** The card is enlarged (pinch or double-tap, design plan 6.1). */
  enlarged?: boolean;
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
  /** Sealing it by hand: the seal is pressed home. The host sends the card and answers with sealResult. */
  onSeal?: () => void;
};

type Spring = { x: number; v: number; t: number; k: number; c: number };
type SpringKey = 'envDeg' | 'pull' | 'lay' | 'deg' | 'tx' | 'ty' | 'drop' | 'zs' | 'zx' | 'zy';
type Drag = {
  id: number; x0: number; y0: number; t0: number; lx: number; ly: number; lt: number; vx: number; vy: number;
  mode: null | 'env' | 'pull' | 'turn' | 'tilt' | 'none' | 'push' | 'shut' | 'press' | 'pan';
  env0: number; pull0: number; deg0: number; lay0: number; xs?: number; ys?: number; holdTimer?: number; zx0?: number; zy0?: number;
};
type Geometry = {
  w: number; h: number; cw: number; ch: number; ew: number; eh: number; fd: number; cardTop: number; envTopFinal: number;
  envX: number; envY: number; cardX: number; envYOpen: number; envTopOut: number; cardTopOut: number;
};

const FLAP_OPEN = 0.3;
/** The press that seals it, in milliseconds. */
const SEAL_HOLD = 600;
/** The gold seal stays in sight this long before the envelope turns over. */
const SEAL_BEAT = 800;
/** After the seal: the envelope turns over, the name is written (0.7 s), the stamp drops, the postmark thumps (and a
 * sealed card's gold stamp lands); then it leaves. design.md / CardTable.module.css keep the same times. */
const STAMP_AT = 1600;
const POSTMARK_AT = 1980;
const SEALED_MARK_AT = 2380;
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
    zs: { x: 1, v: 0, t: 1, k: 150, c: 24 }, // the card enlarged (design plan 6.1): 1 to 3
    zx: { x: 0, v: 0, t: 0, k: 150, c: 24 }, // and moved around while it's enlarged
    zy: { x: 0, v: 0, t: 0, k: 150, c: 24 },
  };

  /** Two fingers on the card: where the pinch began. */
  private pinch: { ids: [number, number]; d0: number; s0: number; mx0: number; my0: number; x0: number; y0: number } | null = null;

  private readonly pointers = new Map<number, { x: number; y: number }>();

  /** A tap on the card waits this long for a second one (a double-tap enlarges it) before it turns the card. */
  private tapTimer = 0;

  private lastTap = { t: 0, x: 0, y: 0 };

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

  private readonly sending: boolean;

  private send: SendStep | null = null;

  /** When the press began (0: not pressing), and whether the button is doing the press. */
  private holdStart = 0;

  private holdTicks = 0;

  private sendTimers: number[] = [];

  private sealedMark = false;

  /** When the seal went on: it stays in sight a moment before the envelope turns over, however fast the answer is. */
  private sealedAt = 0;

  private readonly elements = new Map<string, HTMLElement>();

  constructor(root: HTMLElement, options: { sealed: boolean; crackedSrc: string; wholeSrc: string; callbacks: TableCallbacks; sending?: boolean }) {
    this.root = root;
    this.sending = Boolean(options.sending);
    this.sealed = this.sending ? false : options.sealed;
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
    window.clearTimeout(this.tapTimer);
    this.clearSendTimers();
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
      send: this.send,
      enlarged: this.v.zs.t > 1.02,
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

  // ---- Enlarging the card (design plan 6.1) ----

  /** The card is enlarged: a drag moves around it instead of turning it. */
  get enlarged() {
    return this.v.zs.t > 1.02;
  }

  private setZoom(scale: number, x: number, y: number, immediate = false) {
    const g = this.g;
    const s = clamp(scale, 1, 3);
    // It never moves so far that the card leaves its own place on the table.
    const mx = g ? (g.cw * (s - 1)) / 2 : 0;
    const my = g ? (g.ch * (s - 1)) / 2 : 0;
    const zx = clamp(x, -mx, mx);
    const zy = clamp(y, -my, my);
    const set = (key: 'zs' | 'zx' | 'zy', value: number) => {
      this.v[key].t = value;
      if (immediate || reducedMotion()) { this.v[key].x = value; this.v[key].v = 0; }
    };
    set('zs', s); set('zx', zx); set('zy', zy);
    this.mark();
    this.wake();
  }

  /** Back to its size on the table. */
  resetZoom(immediate = false) {
    if (this.v.zs.t === 1 && this.v.zx.t === 0 && this.v.zy.t === 0) return;
    this.setZoom(1, 0, 0, immediate);
  }

  /** Double-tap (or double-click): enlarge it 2.4x around that spot, or back again. */
  private toggleZoom(px: number, py: number) {
    if (this.enlarged) { this.resetZoom(); return; }
    const r = this.$('card').getBoundingClientRect();
    const s = 2.4;
    this.setZoom(s, (r.left + r.width / 2 - px) * (s - 1), (r.top + r.height / 2 - py) * (s - 1));
    tick(6);
  }

  // ---- Sealing it by hand (design plan Part 2) ----

  private setSend(next: SendStep) {
    this.send = next;
    this.root.dataset.sendStep = next;
    this.mark();
    this.wake();
  }

  private clearSendTimers() {
    for (const id of this.sendTimers) window.clearTimeout(id);
    this.sendTimers = [];
  }

  /** The card lies note side up in front of the open envelope, flap up, as the other person will find it. */
  startSending(options: { sealedMark: boolean }) {
    const set = (key: SpringKey, x: number) => { this.v[key].x = x; this.v[key].t = x; this.v[key].v = 0; };
    this.clearSendTimers();
    this.sealedMark = options.sealedMark;
    set('drop', 0); set('envDeg', 180); set('pull', 1); set('lay', 1); set('deg', 180);
    this.step = 'out';
    this.envTurnedOnce = true;
    this.turnedOnce = true;
    this.setCracked(false);
    delete this.root.dataset.addressed;
    this.holdStart = 0;
    this.layout();
    this.render();
    this.setSend('ready');
  }

  private putIn() {
    if (this.send !== 'ready') return;
    this.v.lay.t = 0;
    tick();
    this.setSend('putting');
  }

  private closeFlap() {
    if (this.send !== 'in') return;
    this.v.pull.t = 0;
    this.setSend('closing');
  }

  /** The press: the stamp head's shadow grows over the spot, with ticks closer and closer, for SEAL_HOLD ms. */
  private beginPress() {
    if (this.send !== 'seal' || this.holdStart) return;
    this.holdStart = performance.now();
    this.holdTicks = 0;
    this.root.dataset.pressing = '1';
    tick(6);
    this.wake();
  }

  private endPress() {
    if (!this.holdStart) return;
    // Let go early: nothing happens.
    this.holdStart = 0;
    delete this.root.dataset.pressing;
    this.$('press').style.transform = '';
    this.$('press').style.opacity = '';
  }

  private sealNow() {
    this.holdStart = 0;
    delete this.root.dataset.pressing;
    this.$('press').style.transform = '';
    this.$('press').style.opacity = '';
    tick(26);
    this.sealedAt = performance.now();
    this.setSend('sending');
    this.callbacks.onSeal?.();
  }

  /** The host's answer to the seal: it went (the envelope is addressed and leaves), or it didn't (the seal lifts off). */
  sealResult(ok: boolean) {
    if (this.send !== 'sending') return;
    if (!ok) { tick(20); this.setSend('seal'); return; }
    const reduce = reducedMotion();
    const beat = reduce ? 0 : Math.max(0, SEAL_BEAT - (performance.now() - this.sealedAt));
    if (beat > 0) { this.sendTimers.push(window.setTimeout(() => this.address(), beat)); return; }
    this.address();
  }

  private address() {
    const reduce = reducedMotion();
    this.v.envDeg.t = 0;
    if (reduce) { this.v.envDeg.x = 0; this.v.envDeg.v = 0; }
    this.step = 'front';
    this.root.dataset.addressed = '1';
    this.setSend('addressed');
    this.render();
    if (reduce) {
      this.sendTimers.push(window.setTimeout(() => this.setSend('gone'), 1200));
      return;
    }
    this.sendTimers.push(window.setTimeout(() => tick(16), STAMP_AT));
    this.sendTimers.push(window.setTimeout(() => tick(24), POSTMARK_AT));
    if (this.sealedMark) this.sendTimers.push(window.setTimeout(() => tick(16), SEALED_MARK_AT));
    this.sendTimers.push(window.setTimeout(() => {
      this.v.drop.t = 1;
      this.setSend('gone');
    }, (this.sealedMark ? SEALED_MARK_AT : POSTMARK_AT) + 900));
  }

  /** The button under the table while sealing it: whatever comes next. With Reduce Motion it does all of it. */
  private sendPrimary() {
    const reduce = reducedMotion();
    if (reduce && (this.send === 'ready' || this.send === 'in' || this.send === 'seal')) {
      const set = (key: SpringKey, x: number) => { this.v[key].x = x; this.v[key].t = x; this.v[key].v = 0; };
      set('lay', 0); set('pull', 0);
      this.step = 'back';
      this.render();
      this.sealNow();
      return;
    }
    if (this.send === 'ready') this.putIn();
    else if (this.send === 'in') this.closeFlap();
    else if (this.send === 'seal') this.beginPress();
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
    if (this.sending) { this.sendPrimary(); return; }
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
    if (this.sending) return;
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
    this.resetZoom();
    this.v.deg.t = (Math.round(this.v.deg.t / 180) + (dir < 0 ? -1 : 1)) * 180;
    if (reducedMotion()) this.v.deg.x = this.v.deg.t;
    this.turnedOnce = true;
    tick();
    this.mark();
    this.render();
    this.wake();
  }

  // ---- Layout: design.md section 2 ----

  // A new window size brings an enlarged card back to its size; the controls changing height only lays it out again.
  private readonly onResize = () => { this.resetZoom(true); this.layout(); this.render(); };

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
    // Tablets and wide windows go to 640 where the height allows (design plan 6.3); the room below keeps it in.
    let cw = Math.min(w - side * 2, w < 760 ? 470 : 640);
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
    // Several cards: the stack of envelopes behind the top one is the envelope's size.
    const stack = this.root.querySelector<HTMLElement>('[data-el="lStack"]');
    if (stack) {
      stack.style.width = `${ew}px`;
      stack.style.height = `${eh}px`;
      stack.style.transformOrigin = `${ew / 2}px ${eh / 2}px`;
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
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // A second finger on the card while it lies on the table: pinch to enlarge it (design plan 6.1).
    if (!this.sending && this.step === 'out' && this.pointers.size === 2 && !reducedMotion()) {
      const [a, b] = [...this.pointers.entries()];
      if (this.dragging?.holdTimer) window.clearTimeout(this.dragging.holdTimer);
      this.dragging = null;
      window.clearTimeout(this.tapTimer);
      this.pinch = {
        ids: [a[0], b[0]], d0: Math.max(1, Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y)), s0: this.v.zs.t,
        mx0: (a[1].x + b[1].x) / 2, my0: (a[1].y + b[1].y) / 2, x0: this.v.zx.t, y0: this.v.zy.t,
      };
      try { this.root.setPointerCapture?.(e.pointerId); } catch { /* not a live pointer */ }
      return;
    }
    this.callbacks.onPress();
    this.root.setPointerCapture?.(e.pointerId);
    const now = performance.now();
    const drag: Drag = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: now, lx: e.clientX, ly: e.clientY, lt: now, vx: 0, vy: 0, mode: null,
      env0: this.v.envDeg.x, pull0: this.v.pull.x, deg0: this.v.deg.x, lay0: this.v.lay.x,
    };
    this.dragging = drag;
    this.lastTouch = now;
    if (this.sending) {
      // Sealing: a press anywhere on the table holds the seal down; nothing tilts the light.
      if (this.send === 'seal' && !reducedMotion()) { drag.mode = 'press'; this.beginPress(); }
      this.wake();
      return;
    }
    // Hold still for a moment on the card: the finger moves the light instead.
    drag.holdTimer = window.setTimeout(() => {
      if (this.dragging === drag && !drag.mode && this.step === 'out' && !this.enlarged && !reducedMotion()) {
        drag.mode = 'tilt';
        this.heldOnce = true;
        tick(5);
        this.mark();
      }
    }, 240);
    this.wake();
  };

  private readonly onMove = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = this.pinch;
    if (p && p.ids.includes(e.pointerId)) {
      const a = this.pointers.get(p.ids[0]);
      const b = this.pointers.get(p.ids[1]);
      if (a && b) {
        const scale = p.s0 * (Math.hypot(a.x - b.x, a.y - b.y) / p.d0);
        this.setZoom(scale, p.x0 + ((a.x + b.x) / 2 - p.mx0), p.y0 + ((a.y + b.y) / 2 - p.my0), true);
        this.lastTouch = performance.now();
        this.render();
      }
      return;
    }
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
      else if (this.sending) d.mode = this.send === 'ready' && !horizontal && dy < 0 ? 'push' : this.send === 'in' && !horizontal && dy > 0 ? 'shut' : 'none';
      else if (this.step === 'front') d.mode = horizontal ? 'env' : 'none';
      else if (this.step === 'back' || this.step === 'flap') d.mode = !horizontal && dy < 0 ? 'pull' : (horizontal && this.step === 'back' ? 'env' : 'none');
      else if (this.step === 'out' && this.enlarged) { d.mode = 'pan'; d.zx0 = this.v.zx.t; d.zy0 = this.v.zy.t; }
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
    } else if (d.mode === 'pan') {
      // Moving around the enlarged card.
      this.setZoom(v.zs.t, (d.zx0 ?? 0) + (e.clientX - (d.xs ?? 0)), (d.zy0 ?? 0) + (e.clientY - (d.ys ?? 0)), true);
    } else if (d.mode === 'push') {
      // Pushing the card up off the table, toward the envelope's open top.
      const up = (d.ys ?? 0) - e.clientY;
      v.lay.x = clamp(d.lay0 - up / (g.ch * 0.55)); v.lay.t = v.lay.x; v.lay.v = 0;
    } else if (d.mode === 'shut') {
      // Pulling the flap down over the card.
      const down = e.clientY - (d.ys ?? 0);
      v.pull.x = clamp(d.pull0 - (down / (g.fd * 1.6)) * FLAP_OPEN, 0, FLAP_OPEN); v.pull.t = v.pull.x; v.pull.v = 0;
    } else if (d.mode === 'tilt') {
      const r = this.root.getBoundingClientRect();
      v.tx.t = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1) * 1.1;
      v.ty.t = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1) * 1.1;
    }
    this.render();
  };

  private readonly onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pinch && this.pinch.ids.includes(e.pointerId)) {
      this.pinch = null;
      // Hardly enlarged: back to its size.
      if (this.v.zs.t < 1.08) this.resetZoom();
      this.dragging = null;
      return;
    }
    const d = this.dragging;
    if (!d || e.pointerId !== d.id || !this.g) return;
    this.dragging = null;
    window.clearTimeout(d.holdTimer);
    const now = performance.now();
    const { v, g } = this;
    if (d.mode === 'press') { if (this.holdStart) this.endPress(); return; }
    if (this.sending && d.mode === 'push') {
      const flick = ((-d.vy * 1000) / (g.ch * 0.55)) * 0.22;
      if (v.lay.x - flick < 0.62) this.putIn(); else { v.lay.t = 1; }
      this.wake();
      return;
    }
    if (this.sending && d.mode === 'shut') {
      const flick = ((d.vy * 1000) / (g.fd * 1.6)) * FLAP_OPEN * 0.22;
      if (v.pull.x - flick < FLAP_OPEN * 0.55) this.closeFlap(); else { v.pull.t = FLAP_OPEN; }
      this.wake();
      return;
    }
    if (this.sending) return;
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
      if (inCard) {
        // A second tap soon after on the same spot enlarges it (or brings it back); one tap turns it, a moment later.
        const now = performance.now();
        const twice = now - this.lastTap.t < 330 && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 44;
        window.clearTimeout(this.tapTimer);
        if (twice && !reducedMotion()) { this.lastTap.t = 0; this.toggleZoom(e.clientX, e.clientY); return; }
        this.lastTap = { t: now, x: e.clientX, y: e.clientY };
        if (this.enlarged) return;
        this.tapTimer = window.setTimeout(() => this.turnCard(), 300);
      } else this.callbacks.onTableTap();
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
    const zoom = v.zs.x > 1.0005 || Math.abs(v.zx.x) > 0.1 || Math.abs(v.zy.x) > 0.1
      ? `translate(${v.zx.x.toFixed(1)}px,${v.zy.x.toFixed(1)}px) scale(${v.zs.x.toFixed(4)}) ` : '';
    this.$('flip').style.transform = `${zoom}rotateX(${-ty * 2.6}deg) rotateY(${v.deg.x + tx * 3.2}deg)`;

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

    // Words stay out of the way of what's moving. Sealing, the host shows them step by step.
    if (!this.sending) {
      this.$('words').style.opacity = pull > 0.02 || this.step === 'pulling' ? '0' : '';
      this.$('act').style.opacity = this.step === 'pulling' ? '0' : '';
    } else {
      // Several cards: a stack of envelope edges behind the top one, once it's addressed.
      const stack = this.root.querySelector<HTMLElement>('[data-el="lStack"]');
      if (stack) {
        stack.style.display = flapSide ? 'none' : 'block';
        stack.style.transform = frontT;
      }
    }
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
      const held = dragging && ((dragging.mode === 'env' && key === 'envDeg') || (dragging.mode === 'pull' && key === 'pull') || (dragging.mode === 'turn' && key === 'deg')
        || (dragging.mode === 'push' && key === 'lay') || (dragging.mode === 'shut' && key === 'pull'));
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
    if (this.sending) {
      // Lifted off the table, the card slides down into the envelope; then the flap can come down.
      if (this.send === 'putting' && v.lay.x < 0.05 && v.pull.t !== FLAP_OPEN) { v.pull.t = FLAP_OPEN; moving = true; }
      if (this.send === 'putting' && v.pull.t === FLAP_OPEN && v.pull.x < FLAP_OPEN + 0.012) {
        this.step = 'flap';
        tick(8);
        this.setSend('in');
      }
      if (this.send === 'closing' && v.pull.x < 0.006) {
        v.pull.x = 0; v.pull.t = 0; v.pull.v = 0;
        this.step = 'back';
        tick(12);
        this.setSend('seal');
      }
      if (this.holdStart) {
        const p = clamp((now - this.holdStart) / SEAL_HOLD);
        const press = this.$('press');
        press.style.transform = `scale(${(0.35 + 0.7 * p).toFixed(3)})`;
        press.style.opacity = (0.3 + 0.6 * p).toFixed(3);
        // Soft ticks, closer and closer together.
        const due = [0.3, 0.55, 0.72, 0.84, 0.93].filter((at) => p >= at).length;
        if (due > this.holdTicks) { this.holdTicks = due; tick(5); }
        if (p >= 1) this.sealNow();
        else moving = true;
      }
    }
    // Once it has cleared the envelope, the card is laid down in front of it.
    if (!this.sending && this.step === 'pulling' && v.pull.x > 0.985) {
      v.pull.x = 1; v.pull.t = 1; v.pull.v = 0;
      this.step = 'out';
      v.lay.t = 1;
      tick(10);
      this.mark();
      moving = true;
    }
    this.render();
    if (moving || dragging || this.holdStart || (!reduce && !this.gyro)) this.raf = requestAnimationFrame(this.frame);
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
