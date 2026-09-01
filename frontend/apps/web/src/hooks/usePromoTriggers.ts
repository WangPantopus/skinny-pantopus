// ============================================================
// usePromoTriggers — Evaluates user state on load and fires
// the appropriate floating promo modal.
//
// Mount once in AppShell. Runs after user profile is loaded.
// Each promo has a unique ID so it's only shown once per user
// (tracked via localStorage in promo-modal-store).
// ============================================================

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@pantopus/types';
import { promoModalStore } from '@/components/ui/promo-modal-store';
import { openMagicTaskComposer } from '@/lib/feedComposerEvents';

// ── Helpers ────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

function getLastVisit(): number | null {
  if (typeof window === 'undefined') return null;
  const ts = localStorage.getItem('pantopus_last_visit');
  return ts ? Number(ts) : null;
}

function recordVisit(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('pantopus_last_visit', String(Date.now()));
}

// ── Trigger definitions ────────────────────────────────────────

interface TriggerDef {
  id: string;
  /** Return true if this promo should fire for the given user. */
  shouldShow: (user: UserProfile) => boolean;
  /** Build the promo config. Router is provided for CTA navigation. */
  build: (user: UserProfile, router: ReturnType<typeof useRouter>) => Parameters<typeof promoModalStore.show>[0];
  /** Lower number = higher priority. Evaluated in order. */
  priority: number;
}

const triggers: TriggerDef[] = [
  // ─────────────────────────────────────────────────────────────
  // 1. WELCOME — brand-new user (account < 1 day, no address)
  // ─────────────────────────────────────────────────────────────
  {
    id: 'welcome-new-user-v1',
    priority: 1,
    shouldShow: (u) => daysSince(u.created_at) < 1 && !u.address_verified,
    build: (_u, router) => ({
      id: 'welcome-new-user-v1',
      badge: 'Welcome to Pantopus',
      title: 'Verify your address to unlock your neighborhood',
      body: 'Connect with neighbors, post gigs, and discover local services — all tied to your verified home address for trust and safety.',
      ctaLabel: 'Verify My Address',
      onAction: () => router.push('/app/homes'),
      variant: 'bottom-sheet',
    }),
  },

  // ─────────────────────────────────────────────────────────────
  // 2. ADDRESS NUDGE — existing user, still not verified
  // ─────────────────────────────────────────────────────────────
  {
    id: 'verify-address-nudge-v1',
    priority: 2,
    shouldShow: (u) => daysSince(u.created_at) >= 1 && !u.address_verified,
    build: (_u, router) => ({
      id: 'verify-address-nudge-v1',
      badge: 'Complete Your Profile',
      title: 'Unlock full access with a verified address',
      body: 'Verified addresses let you post gigs, join your neighborhood feed, and build trust with your community.',
      ctaLabel: 'Get Verified',
      onAction: () => router.push('/app/homes'),
      variant: 'center',
    }),
  },

  // ─────────────────────────────────────────────────────────────
  // 3. RETURNING USER — inactive 7+ days, has verified address
  // ─────────────────────────────────────────────────────────────
  {
    id: 'welcome-back-v1',
    priority: 3,
    shouldShow: (u) => {
      if (!u.address_verified) return false;
      const lastVisit = getLastVisit();
      if (!lastVisit) return false;
      const daysSinceVisit = (Date.now() - lastVisit) / (1000 * 60 * 60 * 24);
      return daysSinceVisit >= 7;
    },
    build: (_u, router) => ({
      id: 'welcome-back-v1',
      badge: 'Welcome Back',
      title: "See what's new in your neighborhood",
      body: "Your neighbors have been busy while you were away. Check out new gigs, listings, and posts near you.",
      ctaLabel: 'Explore Now',
      onAction: () => router.push('/app/feed'),
      dismissLabel: 'Maybe Later',
      allowRepeat: true,
      variant: 'bottom-sheet',
    }),
  },

  // ─────────────────────────────────────────────────────────────
  // 4. FIRST GIG PROMPT — verified but never posted a gig
  // ─────────────────────────────────────────────────────────────
  {
    id: 'first-gig-prompt-v1',
    priority: 4,
    shouldShow: (u) =>
      !!u.address_verified &&
      (u.gigs_posted ?? u.total_gigs_posted ?? 0) === 0 &&
      daysSince(u.created_at) >= 2,
    build: (_u, router) => ({
      id: 'first-gig-prompt-v1',
      badge: 'Get Started',
      title: 'Post your first gig',
      body: 'Need help with yard work, moving, cleaning, or errands? Post a gig and get bids from skilled neighbors in minutes.',
      ctaLabel: 'Post a Gig',
      onAction: () => openMagicTaskComposer(),
      variant: 'center',
    }),
  },

  // ─────────────────────────────────────────────────────────────
  // 5. WALLET BALANCE — has unclaimed earnings sitting idle
  // ─────────────────────────────────────────────────────────────
  {
    id: 'wallet-nudge-v1',
    priority: 5,
    shouldShow: (u) => (u.total_earnings ?? 0) > 500, // > $5.00 in cents
    build: (u, router) => {
      const dollars = ((u.total_earnings ?? 0) / 100).toFixed(2);
      return {
        id: 'wallet-nudge-v1',
        badge: 'Your Earnings',
        title: `You have $${dollars} in your wallet`,
        body: 'Your gig earnings are ready. Set up direct deposit to withdraw to your bank account anytime.',
        ctaLabel: 'View Wallet',
        onAction: () => router.push('/app/wallet'),
        variant: 'bottom-sheet',
      };
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 6. PROFILE COMPLETION — missing bio or profile picture
  // ─────────────────────────────────────────────────────────────
  {
    id: 'complete-profile-v1',
    priority: 6,
    shouldShow: (u) =>
      !!u.address_verified &&
      daysSince(u.created_at) >= 3 &&
      (!u.bio || !u.profile_picture_url),
    build: (_u, router) => ({
      id: 'complete-profile-v1',
      badge: 'Build Trust',
      title: 'Complete your profile',
      body: 'Profiles with a photo and bio get 3x more responses on gigs. Take a minute to stand out in your neighborhood.',
      ctaLabel: 'Edit Profile',
      onAction: () => router.push('/app/profile/edit'),
      variant: 'center',
    }),
  },

  // ─────────────────────────────────────────────────────────────
  // 7. MORNING BRIEFING — verified user, hasn't enabled daily briefing
  // ─────────────────────────────────────────────────────────────
  {
    id: 'enable-morning-briefing-v1',
    priority: 7,
    shouldShow: (u) =>
      !!u.address_verified &&
      daysSince(u.created_at) >= 2,
    build: (_u, router) => ({
      id: 'enable-morning-briefing-v1',
      badge: 'Stay Informed',
      title: 'Get a personalized morning briefing',
      body: 'Start your day with local weather, air quality, and what needs your attention — bills, tasks, and neighborhood updates delivered to your phone.',
      ctaLabel: 'Set Up Briefing',
      onAction: () => router.push('/app/settings/notifications'),
      dismissLabel: 'Not Now',
      variant: 'bottom-sheet',
    }),
  },
];

// ── Dev testing utility ────────────────────────────────────────
// In development, exposes window.__promoDebug so you can test
// any trigger from the browser console without waiting days.
//
// Console commands:
//   __promoDebug.list()                — list all trigger IDs
//   __promoDebug.fire('welcome-back-v1') — force-show a specific promo
//   __promoDebug.resetAll()            — clear all dismiss state
//   __promoDebug.fakeLastVisit(10)     — pretend last visit was 10 days ago
//   __promoDebug.fakeNewUser()         — pretend account was created today
//   __promoDebug.evaluate()            — re-evaluate triggers with current user

function installDevTools(user: UserProfile, router: ReturnType<typeof useRouter>) {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV === 'production') return;

  const triggerIds = triggers.map((t) => t.id);

  (window as any).__promoDebug = {
    /** List all available trigger IDs */
    list: () => {
      console.table(triggers.map((t) => ({
        id: t.id,
        priority: t.priority,
        wouldShow: t.shouldShow(user),
      })));
      return triggerIds;
    },

    /** Force-fire a specific promo by ID (bypasses conditions & dismiss state) */
    fire: (id: string) => {
      const t = triggers.find((tr) => tr.id === id);
      if (!t) {
        console.error(`Unknown trigger "${id}". Available: ${triggerIds.join(', ')}`);
        return;
      }
      promoModalStore.resetDismiss(id);
      promoModalStore.show(t.build(user, router));
      console.log(`Fired promo: ${id}`);
    },

    /** Fire all promos in sequence (they'll queue automatically) */
    fireAll: () => {
      triggers.forEach((t) => {
        promoModalStore.resetDismiss(t.id);
        promoModalStore.show(t.build(user, router));
      });
      console.log(`Queued ${triggers.length} promos`);
    },

    /** Clear all dismiss tracking so every promo can show again */
    resetAll: () => {
      triggerIds.forEach((id) => promoModalStore.resetDismiss(id));
      console.log('All promo dismiss state cleared. Refresh to re-evaluate.');
    },

    /** Fake the last visit timestamp to N days ago */
    fakeLastVisit: (daysAgo: number) => {
      const ts = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
      localStorage.setItem('pantopus_last_visit', String(ts));
      console.log(`Last visit set to ${daysAgo} days ago. Refresh to trigger.`);
    },

    /** Remove last visit record (simulates first-time visitor) */
    clearLastVisit: () => {
      localStorage.removeItem('pantopus_last_visit');
      console.log('Last visit cleared. Refresh to trigger.');
    },

    /** Re-evaluate all triggers with the current user state */
    evaluate: () => {
      const sorted = [...triggers].sort((a, b) => a.priority - b.priority);
      const match = sorted.find((t) => t.shouldShow(user));
      if (match) {
        console.log(`Would fire: ${match.id} (priority ${match.priority})`);
      } else {
        console.log('No triggers match current user state.');
      }
    },

    /** Show the raw store state */
    store: promoModalStore,
  };

  console.log(
    '%c[PromoDebug] Dev tools ready. Try __promoDebug.list() or __promoDebug.fire("welcome-back-v1")',
    'color: #0284c7; font-weight: bold',
  );
}

// ── Hook ───────────────────────────────────────────────────────

export default function usePromoTriggers(user: UserProfile | null) {
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    // Install dev tools for console-based testing
    installDevTools(user, router);

    // Sort by priority and find the first matching trigger
    const sorted = [...triggers].sort((a, b) => a.priority - b.priority);
    const match = sorted.find((t) => t.shouldShow(user));

    if (match) {
      // Small delay so the page finishes rendering first
      const timer = setTimeout(() => {
        promoModalStore.show(match.build(user, router));
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Record this visit for "returning user" detection
    recordVisit();
  }, [user, router]);
}
