'use client';

import { useRouter } from 'next/navigation';
import { Building2, Package, MessageCircle, Wallet } from 'lucide-react';
import type { HubBusinessCard as BusinessData, HubBusiness } from './types';

interface BusinessCardProps {
  data: BusinessData;
  business: HubBusiness;
}

export default function BusinessCard({ data, business }: BusinessCardProps) {
  const router = useRouter();
  const hasSomething = data.newOrders > 0 || data.unreadThreads > 0 || data.pendingPayout > 0;

  return (
    <div className="bg-app-surface border border-violet-200 dark:border-violet-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
          <h3 className="font-semibold text-app-text dark:text-white truncate">{business.name}</h3>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 flex-shrink-0">Biz</span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {hasSomething ? (
          <>
            {data.newOrders > 0 && (
              <div className="flex items-center gap-2 text-sm text-app-text-secondary">
                <Package className="w-4 h-4 flex-shrink-0" />
                <span>{data.newOrders} new order{data.newOrders > 1 ? 's' : ''}</span>
              </div>
            )}
            {data.unreadThreads > 0 && (
              <div className="flex items-center gap-2 text-sm text-app-text-secondary">
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                <span>{data.unreadThreads} unread thread{data.unreadThreads > 1 ? 's' : ''}</span>
              </div>
            )}
            {data.pendingPayout > 0 && (
              <div className="flex items-center gap-2 text-sm text-app-text-secondary">
                <Wallet className="w-4 h-4 flex-shrink-0" />
                <span>${data.pendingPayout.toFixed(2)} pending</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-app-text-secondary dark:text-app-text-muted">All clear</span>
            <button
              onClick={() => router.push(`/app/businesses/${business.id}/dashboard`)}
              className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              View inbox →
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => router.push(`/app/businesses/${business.id}/dashboard`)}
          className="flex-1 py-2.5 px-3 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition"
        >
          Open Business
        </button>
        <button
          onClick={() => router.push(`/app/businesses/${business.id}/dashboard?tab=catalog`)}
          className="py-2.5 px-3 bg-app-surface-sunken text-app-text-strong rounded-lg text-sm font-medium hover:bg-app-hover dark:hover:bg-gray-600 transition"
        >
          Catalog
        </button>
      </div>
    </div>
  );
}
