'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken, getMyProfile } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import FamilyMailParty from '@/components/mailbox/FamilyMailParty';

function PartyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mailId = searchParams.get('id') || '';

  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [mail, setMail] = useState<any>(null);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  useEffect(() => {
    if (!mailId) return;
    setLoading(true);
    Promise.all([
      api.mailboxV2.getMailItem(mailId),
      getMyProfile(),
    ])
      .then(([mailResult, profileResult]) => {
        setMail(mailResult.mail);
        const profile = (profileResult as any)?.profile || profileResult;
        setUserId(profile.id || '');
        setUserName(profile.name || profile.username || 'You');
      })
      .catch(() => toast.error('Failed to load party data'))
      .finally(() => setLoading(false));
  }, [mailId]);

  const checkPresence = useCallback(async (itemId: string) => {
    const sessions = await api.mailboxV2P2.getActiveParties();
    const session = (sessions?.sessions || []).find((s: any) => s.mail_id === itemId);
    if (!session?.home_id) return [];
    const membersResult = await api.homeIam.getHomeMembers(session.home_id);
    return ((membersResult as any)?.members || []).map((m: any) => ({
      user_id: m.user_id || m.id,
      name: m.name || m.username,
      present: !!m.online,
      avatar_url: m.avatar_url,
    }));
  }, []);

  const createParty = useCallback(async (itemId: string) => {
    const result = await api.mailboxV2P2.createParty(itemId);
    return { sessionId: result.session.id };
  }, []);

  const sendReaction = useCallback(async (sessionId: string, emoji: string) => {
    await api.mailboxV2P2.sendReaction(sessionId, emoji);
  }, []);

  const assignToMember = useCallback(async (sessionId: string, assignUserId: string) => {
    await api.mailboxV2P2.assignPartyItem({ sessionId, mailId, assignToUserId: assignUserId });
  }, [mailId]);

  const handleReveal = useCallback(() => setRevealed(true), []);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Family Mail Party</h1>
      </div>

      <FamilyMailParty
        itemId={mailId}
        currentUserId={userId}
        currentUserName={userName}
        checkPresence={checkPresence}
        createParty={createParty}
        sendReaction={sendReaction}
        assignToMember={assignToMember}
        onReveal={handleReveal}
      />

      {/* Show mail content after reveal */}
      {revealed && mail && (
        <div className="bg-app-surface border border-app-border rounded-xl p-5 mt-4">
          <p className="text-sm font-semibold text-app-text mb-1">{mail.sender_display || mail.from || 'Unknown sender'}</p>
          <p className="text-sm text-app-text-secondary mb-2">{mail.subject || ''}</p>
          {mail.ai_summary && <p className="text-sm text-app-text whitespace-pre-wrap">{mail.ai_summary}</p>}
          {mail.body_preview && !mail.ai_summary && <p className="text-sm text-app-text whitespace-pre-wrap">{mail.body_preview}</p>}
        </div>
      )}
    </div>
  );
}

export default function PartyPage() { return <Suspense><PartyContent /></Suspense>; }
