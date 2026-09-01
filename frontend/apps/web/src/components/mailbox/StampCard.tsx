'use client';

/* eslint-disable @next/next/no-img-element */
import type { Stamp, StampRarity } from '@/types/mailbox';

type StampCardProps = {
  stamp: Stamp;
  onClick?: () => void;
};

const rarityColors: Record<StampRarity, string> = {
  common: 'border-app-border',
  uncommon: 'border-green-400 dark:border-green-600',
  rare: 'border-blue-400 dark:border-blue-600',
  legendary: 'border-amber-400 dark:border-amber-600',
};

const rarityBg: Record<StampRarity, string> = {
  common: 'bg-app-surface-raised',
  uncommon: 'bg-green-50 dark:bg-green-950/30',
  rare: 'bg-blue-50 dark:bg-blue-950/30',
  legendary: 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30',
};

export default function StampCard({ stamp, onClick }: StampCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-xl border-2 p-3 transition-all hover:shadow-md text-center ${
        rarityColors[stamp.rarity]
      } ${rarityBg[stamp.rarity]}`}
    >
      {/* Stamp image or fallback */}
      {stamp.visual_url ? (
        <img
          src={stamp.visual_url}
          alt={stamp.name}
          className="w-16 h-16 mx-auto rounded-lg object-contain"
        />
      ) : (
        <div className="w-16 h-16 mx-auto rounded-lg bg-app-surface-sunken flex items-center justify-center">
          <span className="text-2xl">🏅</span>
        </div>
      )}

      <p className="text-xs font-semibold text-app-text mt-2 truncate">
        {stamp.name}
      </p>
      <p className="text-[10px] text-app-text-secondary capitalize mt-0.5">
        {stamp.rarity}
      </p>
      {stamp.earned_at && (
        <p className="text-[10px] text-app-text-muted mt-0.5">
          {new Date(stamp.earned_at).toLocaleDateString()}
        </p>
      )}
    </button>
  );
}
