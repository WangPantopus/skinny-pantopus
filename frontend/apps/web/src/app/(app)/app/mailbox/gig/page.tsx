'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import GigCreationModal from '@/components/mailbox/GigCreationModal';

function GigContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mailId = searchParams.get('id') || '';
  const mode = (searchParams.get('mode') || 'pre') as 'pre' | 'post';

  const [dashboard, setDashboard] = useState<any>(null);
  const [mail, setMail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  useEffect(() => {
    if (!mailId) return;
    setLoading(true);
    Promise.all([
      api.mailboxV2.getPackageDashboard(mailId),
      api.mailboxV2.getMailItem(mailId),
    ])
      .then(([dashResult, mailResult]) => {
        setDashboard(dashResult);
        setMail(mailResult.mail);
      })
      .catch(() => toast.error('Failed to load package'))
      .finally(() => setLoading(false));
  }, [mailId]);

  const createGig = useCallback(async (data: {
    gigType: string;
    title: string;
    description: string;
    compensation?: number;
    suggestedStart?: string;
  }) => {
    const result = await api.mailboxV2P2.createPackageGig(mailId, {
      gigType: data.gigType as any,
      title: data.title,
      description: data.description,
      compensation: data.compensation,
      suggestedStart: data.suggestedStart,
    });
    return { gigId: result.gigId };
  }, [mailId]);

  const pkg = dashboard?.package;

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  if (!pkg) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-app-text-secondary mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
      <p className="text-center text-app-text-muted py-16">Package not found</p>
    </div>
  );

  return (
    <GigCreationModal
      source={mode === 'post' ? 'post_delivery' : 'pre_delivery'}
      packageTitle={mail?.display_title || mail?.subject || 'Package'}
      packageDescription={mail?.ai_summary}
      deliveryEta={pkg.eta_earliest}
      homeAddress={pkg.delivery_location_note}
      photoUrl={pkg.delivery_photo_url}
      onGigCreated={(gigId) => router.push(`/app/gigs-v2/${gigId}`)}
      onClose={() => router.back()}
      createGig={createGig}
    />
  );
}

export default function GigPage() { return <Suspense><GigContent /></Suspense>; }
