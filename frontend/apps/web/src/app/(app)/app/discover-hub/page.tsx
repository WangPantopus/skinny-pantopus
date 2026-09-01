'use client';

import { useRouter } from 'next/navigation';
import { Store, Map, Search, PlusCircle, Hammer, ArrowLeftRight, Users, ChevronRight } from 'lucide-react';

const FEATURES = [
  { icon: Store, title: 'Find Businesses', subtitle: 'Search local providers by category, distance, and trust signals', route: '/app/discover', color: '#059669', bg: 'bg-green-50' },
  { icon: Map, title: 'Explore Map', subtitle: 'Browse businesses, gigs, and posts on an interactive map', route: '/app/gigs', color: '#2563eb', bg: 'bg-blue-50' },
  { icon: Search, title: 'Universal Search', subtitle: 'Search across gigs, people, businesses, and homes', route: '/app/discover', color: '#7c3aed', bg: 'bg-purple-50' },
];

const QUICK_ACTIONS = [
  { icon: PlusCircle, label: 'Post a Task', route: '/app/gigs-v2/new', color: '#f97316' },
  { icon: Hammer, label: 'Browse Tasks', route: '/app/gigs', color: '#0284c7' },
  { icon: ArrowLeftRight, label: 'Marketplace', route: '/app/marketplace', color: '#8b5cf6' },
  { icon: Users, label: 'Connections', route: '/app/network', color: '#ec4899' },
];

export default function DiscoverHubPage() {
  const router = useRouter();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-app-text leading-tight">
          Your neighborhood,<br />all in one place
        </h1>
        <p className="text-sm text-app-text-secondary mt-2 leading-relaxed">
          Find trusted businesses, explore nearby services, and connect with your community.
        </p>
      </div>

      {/* Feature cards */}
      <div className="space-y-3 mb-8">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <button key={f.route + f.title} onClick={() => router.push(f.route)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl ${f.bg} hover:opacity-90 transition text-left`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: f.color }}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-app-text">{f.title}</p>
                <p className="text-xs text-app-text-secondary mt-0.5">{f.subtitle}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-app-text-muted flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-bold text-app-text mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} onClick={() => router.push(a.route)}
                className="flex flex-col items-center gap-2 py-4 bg-app-surface border border-app-border rounded-xl hover:bg-app-hover transition">
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: a.color + '15' }}>
                  <Icon className="w-5 h-5" style={{ color: a.color }} />
                </div>
                <span className="text-xs font-semibold text-app-text">{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
