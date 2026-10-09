'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast-store';

// Settings → Storage & data, web (Instant Screens contract §7, exact wording).
// The browser keeps the pages you opened in this tab's memory only: the query
// cache and the router's visited routes. Clearing drops every kept page that
// isn't on screen, reads this page again quietly and empties the router's
// kept routes. Drafts, unfinished actions, the sign-in and settings stay.
export default function StorageDataSection() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [clearing, setClearing] = useState(false);

  const clear = async () => {
    setClearing(true);
    try {
      queryClient.removeQueries({ predicate: (query) => query.getObserversCount() === 0 });
      router.refresh();
      await queryClient.invalidateQueries({ type: 'active' });
      toast.success('Cleared. Pages will load fresh.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-app p-6">
      <h2 className="text-lg font-semibold text-app mb-2">Storage &amp; data</h2>
      <p className="text-sm text-app-secondary">
        Pantopus keeps the pages you&apos;ve opened in this tab&apos;s memory so going back is instant. It doesn&apos;t save your homes or messages in this browser.
      </p>
      <p className="text-sm text-app-secondary mt-2 mb-4">
        Signing out clears everything Pantopus kept in this browser. If you use a shared computer, sign out when you&apos;re done.
      </p>
      <button
        type="button"
        onClick={() => { void clear(); }}
        disabled={clearing}
        className="px-4 py-2 border border-app-strong text-app-strong rounded-lg hover-bg-app font-medium disabled:opacity-50"
      >
        Clear saved data in this browser
      </button>
    </div>
  );
}
