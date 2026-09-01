// ============================================================
// HomeHeroHeader — primary-600 "hero" card with overline +
// headline + 3-stat row. Used on home dashboards, wallet.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import { ShieldCheck } from 'lucide-react';

export interface HomeHeroStat {
  label: string;
  value: string;
}

export interface HomeHeroHeaderProps {
  overline: string;
  overlineIcon?: LucideIcon;
  headline: string;
  subheadline?: string;
  stats?: HomeHeroStat[];
  accent?: 'primary' | 'success' | 'business';
  className?: string;
}

const BG: Record<NonNullable<HomeHeroHeaderProps['accent']>, string> = {
  primary: 'bg-primary-600',
  success: 'bg-app-success',
  business: 'bg-app-business',
};

export default function HomeHeroHeader({
  overline,
  overlineIcon: Icon = ShieldCheck,
  headline,
  subheadline,
  stats,
  accent = 'primary',
  className = '',
}: HomeHeroHeaderProps) {
  return (
    <section className={`rounded-2xl p-6 text-white shadow-lg ${BG[accent]} ${className}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={14} className="opacity-90" />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-90">{overline}</span>
      </div>
      <h1 className="text-[22px] font-bold -tracking-[0.015em] leading-tight">{headline}</h1>
      {subheadline ? <p className="text-sm opacity-90 mt-1">{subheadline}</p> : null}
      {stats && stats.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 mt-5">
          {stats.map((s) => (
            <div key={s.label} className="bg-white/15 rounded-lg py-2.5 px-2 text-center">
              <div className="text-lg font-bold">{s.value}</div>
              <div className="text-[11px] opacity-90 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
