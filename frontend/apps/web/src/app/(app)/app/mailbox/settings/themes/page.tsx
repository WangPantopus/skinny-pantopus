'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useCallback, useMemo } from 'react';
import type { Stamp, SeasonalTheme } from '@/types/mailbox';
import { useStamps, useThemes, useSetActiveTheme } from '@/lib/mailbox-queries';
import { StampCard } from '@/components/mailbox';

// ── Stamp category filter ────────────────────────────────────

type StampCategory = 'all' | 'milestones' | 'senders' | 'seasonal' | 'community';

const STAMP_CATEGORIES: { value: StampCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'milestones', label: 'Milestones' },
  { value: 'senders', label: 'Senders' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'community', label: 'Community' },
];

const STAMP_TYPE_CATEGORY: Record<string, StampCategory> = {
  first_mail: 'milestones',
  hundred_mails: 'milestones',
  first_earn: 'milestones',
  vault_organizer: 'milestones',
  package_pro: 'milestones',
  certified_handler: 'milestones',
  milestone: 'milestones',
  community_contributor: 'community',
  seasonal: 'seasonal',
  custom: 'senders',
};

// ── Rarity colors ────────────────────────────────────────────

const RARITY_BG: Record<string, string> = {
  common: 'bg-app-surface-sunken text-app-text-secondary',
  uncommon: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  rare: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  legendary: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

// ── Stamp detail modal ───────────────────────────────────────

function StampDetailModal({
  stamp,
  onClose,
}: {
  stamp: Stamp;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm mx-4 bg-app-surface rounded-xl shadow-2xl border border-app-border overflow-hidden">
        {/* Header with rarity gradient */}
        <div className={`px-5 py-6 text-center ${
          stamp.rarity === 'legendary'
            ? 'bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-950/40 dark:to-yellow-950/40'
            : stamp.rarity === 'rare'
              ? 'bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30'
              : stamp.rarity === 'uncommon'
                ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30'
                : 'bg-app-surface-raised'
        }`}>
          {stamp.visual_url ? (
            <img
              src={stamp.visual_url}
              alt={stamp.name}
              className="w-24 h-24 mx-auto rounded-xl object-contain"
            />
          ) : (
            <div className="w-24 h-24 mx-auto rounded-xl bg-app-surface/60 flex items-center justify-center shadow-inner">
              <span className="text-4xl">🏅</span>
            </div>
          )}
          <h3 className="text-base font-bold text-app-text mt-3">
            {stamp.name}
          </h3>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${RARITY_BG[stamp.rarity] || RARITY_BG.common}`}>
            {stamp.rarity}
          </span>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          {stamp.description && (
            <p className="text-sm text-app-text-secondary dark:text-app-text-muted">
              {stamp.description}
            </p>
          )}
          <p className="text-xs text-app-text-secondary">
            Earned by: <span className="font-medium text-app-text-strong">{stamp.earned_by}</span>
          </p>
          <p className="text-xs text-app-text-muted">
            Earned {new Date(stamp.earned_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Close */}
        <div className="px-5 py-3 border-t border-app-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Locked stamp card ────────────────────────────────────────

function LockedStampCard({
  stamp,
}: {
  stamp: { stamp_type: string; name: string; description: string; rarity: string; progress?: number; target?: number };
}) {
  const hasProgress = typeof stamp.progress === 'number' && typeof stamp.target === 'number' && stamp.target > 0;
  const progressPct = hasProgress ? Math.min(100, Math.round(((stamp.progress ?? 0) / (stamp.target ?? 1)) * 100)) : 0;

  return (
    <div className="w-full rounded-xl border-2 border-app-border p-3 text-center opacity-60 relative">
      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <div className="w-8 h-8 rounded-full bg-gray-800/60 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      </div>

      {/* Greyscale stamp */}
      <div className="w-16 h-16 mx-auto rounded-lg bg-app-surface-sunken flex items-center justify-center grayscale">
        <span className="text-2xl opacity-40">🏅</span>
      </div>

      <p className="text-xs font-semibold text-app-text-secondary mt-2 truncate">
        {stamp.name}
      </p>
      <p className={`text-[10px] capitalize mt-0.5 ${RARITY_BG[stamp.rarity]?.split(' ')[1] || 'text-app-text-muted'}`}>
        {stamp.rarity}
      </p>

      {/* Earn condition */}
      <p className="text-[10px] text-app-text-muted mt-1 truncate">
        {stamp.description}
      </p>

      {/* Progress bar for streak-based stamps */}
      {hasProgress && (
        <div className="mt-2">
          <div className="w-full h-1.5 bg-app-surface-sunken rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-app-text-muted mt-0.5">
            {stamp.progress} of {stamp.target}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Theme confirm modal ──────────────────────────────────────

function ThemeConfirmModal({
  theme,
  onConfirm,
  onCancel,
  confirming,
}: {
  theme: SeasonalTheme;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm mx-4 bg-app-surface rounded-xl shadow-2xl border border-app-border p-5">
        <h3 className="text-sm font-semibold text-app-text mb-2">
          Switch Theme
        </h3>
        <p className="text-sm text-app-text-secondary dark:text-app-text-muted mb-4">
          Switch to <span className="font-semibold">{theme.name}</span>?
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              confirming
                ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {confirming ? 'Switching...' : 'Switch'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Season icon ──────────────────────────────────────────────

const SEASON_ICONS: Record<string, string> = {
  spring: '🌸',
  summer: '☀️',
  autumn: '🍂',
  winter: '❄️',
  custom: '🎨',
};

// ── Main Page ────────────────────────────────────────────────

export default function StampsThemesPage() {
  const { data: stampData, isLoading: stampsLoading } = useStamps();
  const { data: themeData, isLoading: themesLoading } = useThemes();
  const setThemeMutation = useSetActiveTheme();

  const [activeTab, setActiveTab] = useState<'stamps' | 'themes'>('stamps');
  const [stampCategory, setStampCategory] = useState<StampCategory>('all');
  const [selectedStamp, setSelectedStamp] = useState<Stamp | null>(null);
  const [confirmTheme, setConfirmTheme] = useState<SeasonalTheme | null>(null);

  // Filter earned stamps by category
  const filteredStamps = useMemo(() => {
    if (!stampData) return [];
    if (stampCategory === 'all') return stampData.earned;
    return stampData.earned.filter(
      (s) => STAMP_TYPE_CATEGORY[s.stamp_type] === stampCategory,
    );
  }, [stampData, stampCategory]);

  const filteredLocked = useMemo(() => {
    if (!stampData) return [];
    if (stampCategory === 'all') return stampData.locked;
    return stampData.locked.filter(
      (s) => STAMP_TYPE_CATEGORY[s.stamp_type] === stampCategory,
    );
  }, [stampData, stampCategory]);

  const handleSwitchTheme = useCallback(
    (theme: SeasonalTheme) => {
      setThemeMutation.mutate(theme.id, {
        onSuccess: () => {
          setConfirmTheme(null);
          // Apply theme tokens immediately
          if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--theme-accent', theme.accent_color);
            document.documentElement.setAttribute('data-theme', theme.id);
          }
        },
      });
    },
    [setThemeMutation],
  );

  const activeTheme = themeData?.themes.find((t) => t.id === themeData.active);

  if (stampsLoading || themesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-app-surface">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* ── Tab navigation ───────────────────────────────── */}
        <div className="flex items-center gap-1 bg-app-surface-sunken rounded-lg p-1">
          <button
            type="button"
            onClick={() => setActiveTab('stamps')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'stamps'
                ? 'bg-app-surface text-app-text shadow-sm'
                : 'text-app-text-secondary hover:text-app-text-strong dark:hover:text-gray-300'
            }`}
          >
            Stamp Gallery
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('themes')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'themes'
                ? 'bg-app-surface text-app-text shadow-sm'
                : 'text-app-text-secondary hover:text-app-text-strong dark:hover:text-gray-300'
            }`}
          >
            Seasonal Themes
          </button>
        </div>

        {/* ── STAMP GALLERY ────────────────────────────────── */}
        {activeTab === 'stamps' && stampData && (
          <div className="space-y-5">
            {/* Counter */}
            <p className="text-sm text-app-text-secondary dark:text-app-text-muted">
              <span className="font-bold text-app-text">{stampData.total_earned}</span> of{' '}
              <span className="font-bold text-app-text">{stampData.total_available}</span> stamps collected
            </p>

            {/* Category filter */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {STAMP_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setStampCategory(cat.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                    stampCategory === cat.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-app-surface-sunken text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Stamp grid — earned */}
            {filteredStamps.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {filteredStamps.map((stamp) => (
                  <StampCard
                    key={stamp.id}
                    stamp={stamp}
                    onClick={() => setSelectedStamp(stamp)}
                  />
                ))}
              </div>
            )}

            {/* Locked stamps */}
            {filteredLocked.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider pt-2">
                  Locked
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {filteredLocked.map((locked) => (
                    <LockedStampCard key={locked.stamp_type} stamp={locked} />
                  ))}
                </div>
              </>
            )}

            {filteredStamps.length === 0 && filteredLocked.length === 0 && (
              <p className="text-sm text-app-text-muted text-center py-8">
                No stamps in this category yet.
              </p>
            )}
          </div>
        )}

        {/* ── THEMES TAB ───────────────────────────────────── */}
        {activeTab === 'themes' && themeData && (
          <div className="space-y-6">
            {/* Active theme preview */}
            {activeTheme && (
              <div>
                <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-3">
                  Current Theme
                </p>
                <div
                  className="rounded-xl border-2 border-primary-400 dark:border-primary-600 overflow-hidden"
                >
                  <div
                    className="px-6 py-8 text-center"
                    style={{ backgroundColor: `${activeTheme.accent_color}15` }}
                  >
                    <div className="text-5xl mb-3">
                      {SEASON_ICONS[activeTheme.season] || '📬'}
                    </div>
                    <div
                      className="w-20 h-20 mx-auto rounded-xl flex items-center justify-center mb-3 shadow-inner"
                      style={{ backgroundColor: activeTheme.accent_color }}
                    >
                      <span className="text-3xl text-white">📬</span>
                    </div>
                    <h3 className="text-base font-bold text-app-text">
                      {activeTheme.name}
                    </h3>
                    <p className="text-xs text-app-text-secondary mt-1 capitalize">
                      {activeTheme.season} theme
                    </p>
                    <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold uppercase bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Available themes */}
            <div>
              <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-3">
                Available Themes
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {themeData.themes.map((theme) => {
                  const isActive = theme.id === themeData.active;
                  const isLocked = !theme.unlocked;

                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        if (!isLocked && !isActive) setConfirmTheme(theme);
                      }}
                      disabled={isLocked}
                      className={`relative rounded-xl border-2 overflow-hidden text-left transition-all ${
                        isActive
                          ? 'border-primary-500 ring-1 ring-primary-500'
                          : isLocked
                            ? 'border-app-border opacity-50 cursor-not-allowed'
                            : 'border-app-border hover:border-app-border dark:hover:border-gray-600 hover:shadow-md'
                      }`}
                    >
                      {/* Preview area */}
                      <div
                        className="px-4 py-5 text-center"
                        style={{ backgroundColor: `${theme.accent_color}15` }}
                      >
                        <div className="text-3xl mb-1">
                          {SEASON_ICONS[theme.season] || '📬'}
                        </div>
                        <div
                          className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: theme.accent_color }}
                        >
                          <span className="text-lg text-white">📬</span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="px-3 py-2 border-t border-app-border-subtle">
                        <p className="text-xs font-semibold text-app-text truncate">
                          {theme.name}
                        </p>
                        <p className="text-[10px] text-app-text-secondary capitalize">
                          {theme.season}
                        </p>
                      </div>

                      {/* Active checkmark */}
                      {isActive && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}

                      {/* Lock overlay */}
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-app-surface/30">
                          <div className="text-center">
                            <svg className="w-6 h-6 text-app-text-muted mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stamp detail modal ──────────────────────────────── */}
      {selectedStamp && (
        <StampDetailModal
          stamp={selectedStamp}
          onClose={() => setSelectedStamp(null)}
        />
      )}

      {/* ── Theme confirm modal ─────────────────────────────── */}
      {confirmTheme && (
        <ThemeConfirmModal
          theme={confirmTheme}
          onConfirm={() => handleSwitchTheme(confirmTheme)}
          onCancel={() => setConfirmTheme(null)}
          confirming={setThemeMutation.isPending}
        />
      )}
    </div>
  );
}
