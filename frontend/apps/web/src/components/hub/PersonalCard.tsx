'use client';

import { useRouter } from 'next/navigation';
import { User, Calendar, MessageCircle } from 'lucide-react';
import type { HubPersonalCard as PersonalData } from './types';

interface PersonalCardProps {
  data: PersonalData;
}

export default function PersonalCard({ data }: PersonalCardProps) {
  const router = useRouter();

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"><User className="w-5 h-5" /></div>
          <h3 className="font-semibold text-app-text dark:text-white">Personal</h3>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">You</span>
        </div>
      </div>

      {/* Today slots */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-app-surface-raised/50">
          <Calendar className="w-5 h-5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-app-text-muted dark:text-app-text-secondary font-medium">Today</p>
            <p className="text-sm text-app-text-strong truncate">No events scheduled</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-app-surface-raised/50">
          <MessageCircle className="w-5 h-5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-app-text-muted dark:text-app-text-secondary font-medium">Messages</p>
            <p className="text-sm text-app-text-strong truncate">
              {data.unreadChats > 0 ? `${data.unreadChats} unread` : 'All read'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => router.push('/app/gigs-v2/new')}
          className="flex-1 py-2.5 px-3 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition"
        >
          Post Task
        </button>
        <button
          onClick={() => router.push('/app/chat')}
          className="py-2.5 px-3 bg-app-surface-sunken text-app-text-strong rounded-lg text-sm font-medium hover:bg-app-hover dark:hover:bg-gray-600 transition"
        >
          Messages
        </button>
        <button
          onClick={() => router.push('/app/gigs')}
          className="py-2.5 px-3 bg-app-surface-sunken text-app-text-strong rounded-lg text-sm font-medium hover:bg-app-hover dark:hover:bg-gray-600 transition"
        >
          Find Tasks
        </button>
      </div>
    </div>
  );
}
