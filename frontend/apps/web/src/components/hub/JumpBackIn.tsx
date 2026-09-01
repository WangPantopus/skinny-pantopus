'use client';

import { useRouter } from 'next/navigation';
import { Building2, MapPin } from 'lucide-react';
import type { JumpBackInItem } from './types';

interface JumpBackInProps {
  items: JumpBackInItem[];
  hasBusiness: boolean;
}

export default function JumpBackIn({ items, hasBusiness }: JumpBackInProps) {
  const router = useRouter();
  const allItems = [...items];

  if (!hasBusiness && !allItems.some((i) => i.route.includes('businesses/new'))) {
    allItems.push({ title: 'Create Business', route: '/app/businesses/new', icon: <Building2 className="w-5 h-5" /> });
  }

  if (allItems.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-app-text-secondary dark:text-app-text-muted uppercase tracking-wider mb-3">
        Jump Back In
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {allItems.slice(0, 6).map((item) => (
          <button
            key={item.route}
            onClick={() => router.push(item.route)}
            className="flex items-center gap-2.5 p-3 bg-app-surface border border-app-border rounded-xl text-sm text-app-text-strong font-medium hover:bg-app-hover dark:hover:bg-gray-700 hover:shadow-sm transition"
          >
            <span className="text-lg">{item.icon || <MapPin className="w-5 h-5" />}</span>
            <span className="truncate">{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
