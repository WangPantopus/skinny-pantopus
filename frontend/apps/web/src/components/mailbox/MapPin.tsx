'use client';

import type { HomeMapPin, MapPinType } from '@/types/mailbox';

type MapPinProps = {
  pin: HomeMapPin;
  onClick?: () => void;
  selected?: boolean;
};

const pinConfig: Record<MapPinType, { color: string; tailColor: string; icon: string; label: string }> = {
  permit: {
    color: 'bg-orange-500',
    tailColor: 'border-t-orange-500',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    label: 'Permit',
  },
  civic: {
    color: 'bg-blue-500',
    tailColor: 'border-t-blue-500',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    label: 'Civic',
  },
  delivery: {
    color: 'bg-green-500',
    tailColor: 'border-t-green-500',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    label: 'Delivery',
  },
  notice: {
    color: 'bg-purple-500',
    tailColor: 'border-t-purple-500',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    label: 'Notice',
  },
  utility_work: {
    color: 'bg-yellow-500',
    tailColor: 'border-t-yellow-500',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    label: 'Utility Work',
  },
  community: {
    color: 'bg-teal-500',
    tailColor: 'border-t-teal-500',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    label: 'Community',
  },
};

export default function MapPin({ pin, onClick, selected = false }: MapPinProps) {
  const cfg = pinConfig[pin.pin_type] ?? pinConfig.civic;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex flex-col items-center ${selected ? 'z-10' : ''}`}
      title={pin.title}
    >
      {/* Pin head */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md ${cfg.color} text-white ${
        selected ? 'ring-2 ring-white ring-offset-2 scale-110' : ''
      } transition-transform`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cfg.icon} />
        </svg>
      </div>
      {/* Pin tail */}
      <div className={`w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-transparent ${cfg.tailColor} -mt-0.5`} />
    </button>
  );
}
