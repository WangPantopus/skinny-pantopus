'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import AuthenticatedInvitationPage from '@/components/homes/invitations/AuthenticatedInvitationPage';
import PublicInvitationPage from '@/components/homes/invitations/PublicInvitationPage';

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => setSignedIn(api.hasActiveSession());
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) check(); };
    const unsubscribe = api.onTokenChange(check);
    window.addEventListener('storage', storage); window.addEventListener('focus', check); window.addEventListener('pageshow', check); check();
    return () => { unsubscribe(); window.removeEventListener('storage', storage); window.removeEventListener('focus', check); window.removeEventListener('pageshow', check); };
  }, []);
  if (signedIn === null) return <main className="px-4 py-8"><p role="status">Checking invitation…</p></main>;
  return signedIn ? <AuthenticatedInvitationPage key={token} token={token} /> : <PublicInvitationPage key={token} />;
}
