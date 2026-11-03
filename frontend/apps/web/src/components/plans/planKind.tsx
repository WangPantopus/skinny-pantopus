import type { CSSProperties, ReactNode } from 'react';
import type { PublicPlan } from '@/lib/publicShare';

// A Nearby Plans kind's glyph and colors, as the plan's share page and a profile's "You and …" show them.

type PlanKind = PublicPlan['kind'];

const KIND_TOKEN: Record<PlanKind, string> = {
  watch_party: 'watch',
  playdate: 'playdate',
  pickup_game: 'pickup',
  walk_coffee: 'walk',
  study_group: 'study',
};

/** A plan kind's colors as CSS variables, light and dark: `--plan-c` (ink) and `--plan-cs` (tint). */
export function kindColors(kind: string): CSSProperties {
  const token = KIND_TOKEN[kind as PlanKind] || 'watch';
  return {
    ['--plan-c' as string]: `var(--color-cat-plan-${token})`,
    ['--plan-cs' as string]: `var(--color-cat-plan-${token}-tint)`,
  };
}

export function Icon({ children, className = 'h-5 w-5' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={`flex-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** The kind's glyph (a ticket for kinds this web build doesn't know). */
export function KindGlyph({ kind, className }: { kind: string; className?: string }) {
  switch (kind) {
    case 'playdate':
      return (
        <Icon className={className}>
          <circle cx="8" cy="6" r="2.6" />
          <path d="M3.8 20v-4.2a4.2 4.2 0 0 1 8.4 0V20" />
          <circle cx="17" cy="10.2" r="2" />
          <path d="M14 20v-2.6a3 3 0 0 1 6 0V20" />
        </Icon>
      );
    case 'pickup_game':
      return (
        <Icon className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M5.6 5.6c3.3 3.4 3.3 9.4 0 12.8M18.4 5.6c-3.3 3.4-3.3 9.4 0 12.8" />
        </Icon>
      );
    case 'walk_coffee':
      return (
        <Icon className={className}>
          <path d="M4 9.5h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
          <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
          <path d="M8 3.5v3M12 3.5v3" />
        </Icon>
      );
    case 'study_group':
      return (
        <Icon className={className}>
          <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
          <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
        </Icon>
      );
    default:
      return (
        <Icon className={className}>
          <rect x="3" y="7" width="18" height="12.5" rx="2" />
          <path d="M8 3l4 4 4-4" />
        </Icon>
      );
  }
}
