'use client';

// The Nearby tab's two segments (founder decision 2026-10-20), as in the
// apps: Pulse (/app/feed), where Nearby opens, and Neighborhood
// (/app/nearby), the density window and meter. No door page between them;
// Connections is in the menu.

import Link from 'next/link';

export type NearbySegment = 'pulse' | 'neighborhood';

const SEGMENTS: { key: NearbySegment; label: string; href: string }[] = [
  { key: 'pulse', label: 'Pulse', href: '/app/feed' },
  { key: 'neighborhood', label: 'Neighborhood', href: '/app/nearby' },
];

export default function NearbyTabs({ active, className = '' }: { active: NearbySegment; className?: string }) {
  return (
    <nav aria-label="Nearby" data-testid="nearby-segments" className={`flex rounded-xl bg-surface-muted p-1 ${className}`}>
      {SEGMENTS.map((segment) => {
        const isActive = segment.key === active;
        return (
          <Link
            key={segment.key}
            href={segment.href}
            aria-current={isActive ? 'page' : undefined}
            data-testid={`nearby-segment-${segment.key}`}
            className={`flex-1 rounded-lg py-1.5 text-center text-sm transition-colors ${
              isActive ? 'bg-surface font-bold text-app shadow-sm' : 'font-semibold text-app-muted hover:text-app'
            }`}
          >
            {segment.label}
          </Link>
        );
      })}
    </nav>
  );
}
