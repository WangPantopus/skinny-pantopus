'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Users, Building2 } from 'lucide-react';

type NearbyTab = 'gigs' | 'people' | 'businesses';

const tabs: { key: NearbyTab; label: string; icon: ReactNode }[] = [
  { key: 'gigs', label: 'Tasks', icon: <ClipboardList className="w-4 h-4" /> },
  { key: 'people', label: 'People', icon: <Users className="w-4 h-4" /> },
  { key: 'businesses', label: 'Businesses', icon: <Building2 className="w-4 h-4" /> },
];

const tabRoutes: Record<NearbyTab, string> = {
  gigs: '/app/gigs',
  people: '/app/network',
  businesses: '/app/discover',
};

const tabDescriptions: Record<NearbyTab, string> = {
  gigs: 'Discover tasks near you',
  people: 'Find neighbors and professionals',
  businesses: 'Explore local businesses',
};

export default function NearbyModule() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<NearbyTab>('gigs');

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-app-text-secondary dark:text-app-text-muted uppercase tracking-wider">
          Nearby
        </h2>
        <button
          onClick={() => router.push(tabRoutes[activeTab])}
          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          See all →
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-app-surface text-app-text-secondary border border-app-border hover:bg-app-hover dark:hover:bg-gray-700'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => router.push(tabRoutes[activeTab])}
        className="w-full bg-app-surface border border-app-border rounded-xl p-4 text-center hover:bg-app-hover dark:hover:bg-gray-700/50 transition"
      >
        <p className="text-sm text-app-text-secondary">
          {tabDescriptions[activeTab]}
        </p>
        <p className="text-xs text-primary-600 dark:text-primary-400 font-medium mt-1">
          Tap to explore →
        </p>
      </button>
    </div>
  );
}
