// @ts-nocheck
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Clock } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import CertifiedMailDetail from '@/components/mailbox/CertifiedMailDetail';
import AuditTrailTimeline from '@/components/mailbox/AuditTrailTimeline';

function CertifiedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mailId = searchParams.get('id') || '';

  const [mail, setMail] = useState<any>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  useEffect(() => {
    if (!mailId) return;
    setLoading(true);
    api.mailboxV2P2.getCertifiedMail(mailId)
      .then((result) => {
        setMail(result.mail);
        setAcknowledged(!!result.mail.acknowledged_at);
        setAuditTrail(Array.isArray(result.mail.audit_trail) ? result.mail.audit_trail : []);
      })
      .catch(() => toast.error('Failed to load certified mail'))
      .finally(() => setLoading(false));
  }, [mailId]);

  const handleAcknowledge = async () => {
    if (!mail) return;
    setAcknowledging(true);
    try {
      await api.mailboxV2P2.acknowledgeCertifiedMail(mail.id);
      setAcknowledged(true);
      toast.success('Certified mail acknowledged');
    } catch (err: any) { toast.error(err?.message || 'Failed to acknowledge'); }
    finally { setAcknowledging(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  if (!mail) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-app-text-secondary mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
      <p className="text-center text-app-text-muted py-16">Certified mail not found</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Certified Mail</h1>
      </div>

      <CertifiedMailDetail mail={mail} />

      {/* Acknowledge */}
      {!acknowledged ? (
        <button onClick={handleAcknowledge} disabled={acknowledging}
          className="w-full mt-4 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 disabled:opacity-50 transition">
          {acknowledging ? 'Acknowledging...' : 'Acknowledge Receipt'}
        </button>
      ) : (
        <div className="flex items-center gap-2 mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-800">Acknowledged</p>
            {mail.acknowledged_at && <p className="text-xs text-green-600">{new Date(mail.acknowledged_at).toLocaleString()}</p>}
          </div>
        </div>
      )}

      {/* Audit trail */}
      {auditTrail.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-app-text-strong mb-3">Audit Trail</h2>
          <AuditTrailTimeline events={auditTrail} />
        </div>
      )}
    </div>
  );
}

export default function CertifiedPage() { return <Suspense><CertifiedContent /></Suspense>; }
