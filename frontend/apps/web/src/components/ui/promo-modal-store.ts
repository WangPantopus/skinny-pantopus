// ============================================================
// PROMO MODAL STORE — lightweight pub/sub singleton
// Manages floating promotional modals with dismiss tracking.
// Can be called from anywhere (not just React components).
// ============================================================

export interface PromoConfig {
  /** Unique key used for dismiss tracking in localStorage */
  id: string;
  /** Hero image URL displayed at the top of the modal */
  imageUrl?: string;
  /** Small label above the title (e.g. "Pantopus Pro") */
  badge?: string;
  title: string;
  body: string;
  /** Primary CTA button label */
  ctaLabel: string;
  /** Called when user taps the CTA */
  onAction: () => void;
  /** Secondary dismiss label (defaults to "Close") */
  dismissLabel?: string;
  /** If true the promo can be shown again after dismiss */
  allowRepeat?: boolean;
  /** Background color for the hero area (Tailwind class) */
  heroBg?: string;
  /** "bottom-sheet" slides up from bottom, "center" appears centered */
  variant?: 'bottom-sheet' | 'center';
}

type Listener = (promo: PromoConfig | null) => void;

const STORAGE_PREFIX = 'pantopus_promo_dismissed_';

let current: PromoConfig | null = null;
const queue: PromoConfig[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn(current));
}

function isDismissed(id: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`${STORAGE_PREFIX}${id}`) === '1';
}

function markDismissed(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${STORAGE_PREFIX}${id}`, '1');
}

/** Show a promo modal. Queues if another is already visible. */
function show(config: PromoConfig) {
  if (!config.allowRepeat && isDismissed(config.id)) return;

  if (current) {
    queue.push(config);
    return;
  }
  current = config;
  emit();
}

/** Dismiss the current promo and show next in queue. */
function dismiss() {
  if (current && !current.allowRepeat) {
    markDismissed(current.id);
  }
  current = null;
  emit();

  // Show next queued promo after a brief delay
  if (queue.length > 0) {
    const next = queue.shift()!;
    setTimeout(() => show(next), 400);
  }
}

/** Fire the CTA action and dismiss. */
function action() {
  if (current) {
    current.onAction();
    markDismissed(current.id);
  }
  current = null;
  emit();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PromoConfig | null {
  return current;
}

/** Reset dismiss state for a specific promo (useful for testing). */
function resetDismiss(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
}

export const promoModalStore = { show, dismiss, action, subscribe, getSnapshot, resetDismiss };
