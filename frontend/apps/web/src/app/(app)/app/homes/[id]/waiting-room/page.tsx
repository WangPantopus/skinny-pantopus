'use client';

import { Suspense, useCallback, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Mail, ShieldHalf, Hourglass, FileText, Clock,
  AlertCircle, KeyRound, Upload, ShieldCheck, LogOut, HelpCircle, ChevronRight,
} from 'lucide-react';
import { getAuthToken } from '@pantopus/api';
import { useHomeAccess } from '@/hooks/useHomeAccess';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import * as api from '@pantopus/api';

interface StatusConfig {
  icon: typeof Mail;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
}

function getStatusConfig(status: string, access: any): StatusConfig {
  switch (status) {
    case 'pending_postcard':
      return { icon: Mail, iconColor: '#0284c7', iconBg: 'bg-blue-100', title: 'Check your mailbox', body: 'A verification code has been mailed to this address. Enter the code to complete verification.' };
    case 'provisional_bootstrap':
      return { icon: ShieldHalf, iconColor: '#f59e0b', iconBg: 'bg-amber-100', title: 'Limited access', body: 'You have provisional access with limited features. Verify your address to unlock full home management.' };
    case 'pending_approval':
      return { icon: Hourglass, iconColor: '#0284c7', iconBg: 'bg-blue-100', title: 'Waiting for approval', body: 'A household member needs to approve your request. Refresh to check for updates.' };
    case 'pending_doc':
      return { icon: FileText, iconColor: '#f59e0b', iconBg: 'bg-amber-100', title: 'Document under review', body: 'Your uploaded documents are being reviewed. This usually takes 1-2 business days.' };
    case 'provisional':
      if (access?.is_in_challenge_window) {
        return { icon: Clock, iconColor: '#0284c7', iconBg: 'bg-blue-100', title: 'Challenge window active', body: 'Your access is provisional while existing members can review. Full access will be granted once the window closes.' };
      }
      return { icon: ShieldHalf, iconColor: '#f59e0b', iconBg: 'bg-amber-100', title: 'Provisional access', body: 'Verify your address to unlock full home management features.' };
    case 'suspended_challenged':
      return { icon: AlertCircle, iconColor: '#dc2626', iconBg: 'bg-red-100', title: 'Access suspended', body: 'Your access has been challenged by a household member. Contact support if you believe this is an error.' };
    default:
      return { icon: Hourglass, iconColor: '#6b7280', iconBg: 'bg-gray-100', title: 'Verification required', body: 'Complete verification to access this home.' };
  }
}

function WaitingRoomContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { access, loading, needsVerification, reload } = useHomeAccess(homeId);

  // The Place verify flow routes here with ?return=place; the param is
  // preserved across the method pages so the verified resident lands back
  // on /app/place (the B3 reveal).
  const returnToPlace = searchParams.get('return') === 'place';
  const returnQuery = returnToPlace ? '?return=place' : '';
  const verifiedDest = returnToPlace ? '/app/place?verified=1' : `/app/homes/${homeId}/dashboard`;

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  // Auto-redirect once verified — back to /app/place if that's where we came from.
  useEffect(() => {
    if (!loading && access && !needsVerification) {
      router.replace(verifiedDest);
    }
  }, [loading, access, needsVerification, router, verifiedDest]);

  const handleMoveOut = useCallback(async () => {
    const yes = await confirmStore.open({ title: "This isn't my home", description: 'This will remove you from this home. You can request to join again later.', confirmLabel: 'Remove me', variant: 'destructive' });
    if (!yes) return;
    try {
      await (api as any).post(`/api/homes/${homeId}/move-out`);
      router.push('/app/hub');
    } catch { toast.error('Failed to process move-out'); }
  }, [homeId, router]);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  const status = (access as any)?.verification_status || 'unverified';
  const config = getStatusConfig(status, access);
  const StatusIcon = config.icon;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Verification Center</h1>
      </div>

      <div className="flex flex-col items-center text-center">
        {/* Status icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${config.iconBg}`}>
          <StatusIcon className="w-10 h-10" style={{ color: config.iconColor }} />
        </div>

        <h2 className="text-2xl font-bold text-app-text mb-3">{config.title}</h2>
        <p className="text-sm text-app-text-secondary leading-relaxed mb-6 max-w-sm">{config.body}</p>

        {/* Challenge window countdown */}
        {status === 'provisional' && (access as any)?.is_in_challenge_window && (access as any)?.challenge_window_ends_at && (
          <div className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-xl px-4 py-3 mb-4">
            <Clock className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="text-left">
              <p className="text-xs text-app-text-secondary">Challenge window ends</p>
              <p className="text-sm font-semibold text-app-text">{new Date((access as any).challenge_window_ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
        )}

        {/* Postcard expiry */}
        {status === 'pending_postcard' && (access as any)?.postcard_expires_at && (
          <div className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-xl px-4 py-3 mb-4">
            <Mail className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="text-left">
              <p className="text-xs text-app-text-secondary">Code expires</p>
              <p className="text-sm font-semibold text-app-text">{new Date((access as any).postcard_expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
        )}

        {/* Action cards */}
        <div className="w-full space-y-2.5">
          {status === 'pending_postcard' && (
            <ActionCard icon={KeyRound} label="Enter verification code" desc="Enter the code from your postcard"
              onClick={() => router.push(`/app/homes/${homeId}/verify-postcard${returnQuery}`)} />
          )}

          {(status === 'provisional_bootstrap' || status === 'pending_doc' || status === 'provisional') && (
            <ActionCard icon={Upload} label="Upload proof" desc="Speed up verification with a document"
              onClick={() => router.push(`/app/homes/${homeId}/claim-owner/evidence${returnQuery}`)} />
          )}

          {(status === 'pending_approval' || status === 'unverified' || status === 'provisional') && (
            <ActionCard icon={ShieldCheck} label="Landlord verification"
              desc={status === 'pending_approval' ? 'Check your approval status' : 'Request landlord approval'}
              onClick={() => router.push(`/app/homes/${homeId}/verify-landlord${returnQuery}`)} />
          )}

          {status !== 'pending_postcard' && status !== 'pending_approval' && (
            <ActionCard icon={Mail} label="Verify with mailed code" desc="Receive a code at this address"
              onClick={() => router.push(`/app/homes/${homeId}/verify-postcard${returnQuery}`)} />
          )}
        </div>

        {/* Bottom actions */}
        <div className="w-full mt-6 space-y-2">
          <button onClick={handleMoveOut} className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium text-red-600 hover:text-red-700">
            <LogOut className="w-4 h-4" /> This isn&apos;t my home
          </button>
          <button onClick={() => toast.info('Contact support at help@pantopus.com')} className="flex items-center justify-center gap-2 w-full py-2.5 text-sm text-app-text-secondary hover:text-app-text">
            <HelpCircle className="w-4 h-4" /> Request help
          </button>
          <button onClick={() => router.push('/app/hub')} className="w-full py-3 border border-app-border rounded-xl text-sm font-semibold text-app-text-secondary hover:bg-app-hover transition">
            Done
          </button>
          <button onClick={reload} className="w-full py-2 text-xs text-emerald-600 font-medium hover:text-emerald-700">
            Refresh status
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, label, desc, onClick }: { icon: typeof Mail; label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-xl px-4 py-3.5 hover:bg-app-hover transition text-left">
      <Icon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-app-text">{label}</p>
        <p className="text-xs text-app-text-secondary mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-app-text-muted flex-shrink-0" />
    </button>
  );
}

export default function WaitingRoomPage() { return <Suspense><WaitingRoomContent /></Suspense>; }
