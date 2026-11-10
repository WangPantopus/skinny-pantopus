// ============================================================
// Three quiet paper sounds on the card table (design plan 8.3, launch key card_table): the card sliding, the seal
// pressing or breaking, the card set down. On by default, with a switch in Mail Day settings kept on this device
// only. On iPhone Safari the page's audio is "ambient", so the ringer switch silences it as it does in the app.
// ============================================================

export type CardSound = 'card-slide' | 'seal' | 'card-down';

const KEY = 'pantopus.cardSounds';
const players = new Map<CardSound, HTMLAudioElement>();
const lastPlayed = new Map<CardSound, number>();

/** Whether the card sounds are on here (default on). */
export function cardSoundsOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setCardSoundsOn(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // Private windows may refuse storage; the switch then lasts for this page only.
  }
  if (!on) players.forEach((player) => player.pause());
}

/** Play one, quietly, unless they're off or it just played. Never throws (autoplay rules may refuse it). */
export function playCardSound(name: CardSound) {
  if (typeof window === 'undefined' || !cardSoundsOn()) return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -1e9) < 350) return;
  lastPlayed.set(name, now);
  try {
    // Safari 16.4+: ambient audio mixes with other sound and follows the ringer switch.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== 'ambient') session.type = 'ambient';
    let player = players.get(name);
    if (!player) {
      player = new Audio(`/holiday-cards/sounds/${name}.mp3`);
      player.preload = 'auto';
      player.volume = 0.85;
      players.set(name, player);
    }
    player.currentTime = 0;
    void player.play().catch(() => {});
  } catch {
    // No sound here.
  }
}

/** Load the three ahead, so the first one isn't late. */
export function preloadCardSounds() {
  if (typeof window === 'undefined' || !cardSoundsOn()) return;
  (['card-slide', 'seal', 'card-down'] as CardSound[]).forEach((name) => {
    if (players.has(name)) return;
    const player = new Audio(`/holiday-cards/sounds/${name}.mp3`);
    player.preload = 'auto';
    player.volume = 0.85;
    players.set(name, player);
  });
}
