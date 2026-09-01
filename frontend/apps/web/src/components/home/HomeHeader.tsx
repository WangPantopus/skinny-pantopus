'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode } from 'react';
import { Home, Link2, ShieldCheck, Settings, ChevronLeft } from 'lucide-react';

interface HomeHeaderProps {
  homeName: string;
  homeAddress?: string;
  roleBadge?: string | null;
  isOwner?: boolean;
  homeId: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS: { key: string; label: string; icon: ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
  { key: 'share', label: 'Share', icon: <Link2 className="w-4 h-4" /> },
  { key: 'security', label: 'Members & Security', icon: <ShieldCheck className="w-4 h-4" /> },
  { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export default function HomeHeader({
  homeName,
  homeAddress,
  roleBadge,
  isOwner,
  homeId: _homeId,
  activeTab,
  onTabChange,
}: HomeHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-6">
      {/* Top row: back + title */}
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => router.push('/app/homes')}
          className="text-app-text-muted hover:text-app-text-secondary transition text-sm"
        >
          <ChevronLeft className="w-4 h-4 inline" /> Homes
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-app-text truncate">
            {homeName || 'Home Dashboard'}
          </h1>
          {homeAddress && (
            <p className="text-xs text-app-text-secondary truncate">{homeAddress}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {roleBadge && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-app-surface-sunken text-app-text-secondary capitalize">
              {roleBadge}
            </span>
          )}
          {isOwner && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              Owner
            </span>
          )}
        </div>
      </div>

      {/* High-level tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              activeTab === t.key
                ? 'bg-gray-900 text-white'
                : 'text-app-text-secondary hover:bg-app-hover'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
