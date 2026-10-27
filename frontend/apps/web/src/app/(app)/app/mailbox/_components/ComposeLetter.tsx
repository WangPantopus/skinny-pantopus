'use client';

// Launch cut #8 (Mail extras): the Mailbox menu's "Write a letter" opens the
// composer the old list page offered (that page retired when Mail became its
// own tab, 2026-10-27). The composer needs who you are and the homes you can
// send from; its result shows as a toast.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/lib/me';
import { myHomesQuery } from '@/lib/myHomes';
import { mailboxKeys } from '@/lib/mailbox-queries';
import { toast } from '@/components/ui/toast-store';
import ComposeMailModal from './ComposeMailModal';
import type { AvailableHome } from './mailbox-types';

export default function ComposeLetter({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data: homesReply } = useQuery(myHomesQuery());
  const availableHomes: AvailableHome[] = (homesReply?.homes ?? [])
    .filter((home) => home.has_home_access === true && home.id)
    .map((home) => {
      const addressParts = [home.address, home.city, home.state, home.zipcode].filter(Boolean).join(', ');
      const homeName = (home as unknown as Record<string, string>).name || '';
      return {
        id: home.id,
        label: addressParts || homeName || 'Home',
        searchText: [homeName, addressParts].filter(Boolean).join(' ').toLowerCase(),
      };
    });

  return (
    <ComposeMailModal
      currentUserId={me?.id ?? ''}
      availableHomes={availableHomes}
      scopeHomeId=""
      onClose={onClose}
      onSent={() => { void queryClient.invalidateQueries({ queryKey: mailboxKeys.all }); }}
      setActionError={(message) => { if (message) toast.error(message); }}
      setActionSuccess={(message) => { if (message) toast.success(message); }}
    />
  );
}
