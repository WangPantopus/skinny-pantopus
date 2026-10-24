'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast-store';
import { clearChatStorage } from '@/components/chat/chatStorage';

// Clear recent history and inactive pages while preserving pending originals,
// unfinished actions, the sign-in and settings.
export default function StorageDataSection() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [clearing, setClearing] = useState(false);

  const clear = async () => {
    setClearing(true);
    try {
      await clearChatStorage(true);
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
        Pantopus keeps recent messages encrypted in this browser for up to seven days (up to 20 conversations, 100 messages each). Photos and videos you receive are not saved. Drafts, pending messages, and their attachments stay encrypted until sent or removed. Clearing saved data keeps drafts and pending messages.
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
