'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Mail, Hash, Clock, ShieldCheck } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

const CODE_LENGTH = 6;

function VerifyPostcardContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  // The Place verify flow routes here with ?return=place; on success we
  // send the now-verified resident back to /app/place (the B3 reveal).
  const returnToPlace = searchParams.get('return') === 'place';
  const verifiedDest = returnToPlace ? '/app/place?verified=1' : `/app/homes/${homeId}/dashboard`;

  const [step, setStep] = useState<'request' | 'enter'>('request');
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [postcardInfo, setPostcardInfo] = useState<{ id: string; expires_at: string } | null>(null);
  const [code, setCode] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const handleRequestCode = useCallback(async () => {
    if (!homeId) return;
    setRequesting(true);
    try {
      const res = await api.homeOwnership.requestPostcardCode(homeId);
      setPostcardInfo({ id: res.postcard.id, expires_at: res.postcard.expires_at });
      setStep('enter');
      toast.success('Verification code requested! Check your mailbox in 3-7 days.');
    } catch (err: any) {
      const msg = err?.message || 'Failed to request code';
      if (msg.includes('already have a pending')) {
        setStep('enter');
        toast.info('A code has already been requested. Enter it below.');
      } else {
        toast.error(msg);
      }
    } finally {
      setRequesting(false);
    }
  }, [homeId]);

  const handleVerify = useCallback(async () => {
    if (!homeId || code.length !== CODE_LENGTH) return;
    setVerifying(true);
    try {
      await api.homeOwnership.verifyPostcardCode(homeId, code);
      toast.success('Verified! You are now a verified member of this home.');
      router.push(verifiedDest);
    } catch (err: any) {
      const msg = err?.message || 'Verification failed';
      if ((err as any)?.attempts_remaining != null) {
        setAttemptsRemaining((err as any).attempts_remaining);
      }
      if (msg.includes('expired') || msg.includes('Too many')) {
        toast.error('Code expired. Please request a new one.');
        setStep('request');
        setCode('');
      } else {
        toast.error('Invalid code. Please try again.');
        setCode('');
      }
    } finally {
      setVerifying(false);
    }
  }, [homeId, code, router, verifiedDest]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Verify by Mail</h1>
      </div>

      <div className="flex flex-col items-center text-center">
        {step === 'request' ? (
          <>
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6">
              <Mail className="w-10 h-10 text-blue-600" />
            </div>

            <h2 className="text-2xl font-bold text-app-text mb-3">Verify with a mailed code</h2>
            <p className="text-sm text-app-text-secondary leading-relaxed mb-6 max-w-sm">
              We&apos;ll send a 6-digit verification code to the home&apos;s physical address.
              Once you receive the letter, enter the code here to complete verification.
            </p>

            <div className="w-full space-y-2.5 mb-6">
              <div className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl px-4 py-3">
                <Clock className="w-4 h-4 text-app-text-secondary flex-shrink-0" />
                <p className="text-sm text-app-text-strong">Delivery usually takes 3-7 business days</p>
              </div>
              <div className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl px-4 py-3">
                <ShieldCheck className="w-4 h-4 text-app-text-secondary flex-shrink-0" />
                <p className="text-sm text-app-text-strong">The code is valid for 30 days after the request</p>
              </div>
            </div>

            <button onClick={handleRequestCode} disabled={requesting}
              className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-semibold text-base hover:bg-emerald-700 disabled:opacity-50 transition">
              {requesting ? 'Requesting...' : 'Send verification code'}
            </button>
            <button onClick={() => setStep('enter')} className="mt-3 text-sm text-emerald-600 font-medium hover:text-emerald-700">
              I already have a code
            </button>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6">
              <Hash className="w-10 h-10 text-blue-600" />
            </div>

            <h2 className="text-2xl font-bold text-app-text mb-3">Enter your code</h2>
            <p className="text-sm text-app-text-secondary leading-relaxed mb-6 max-w-sm">
              Enter the 6-digit code from the letter mailed to this address.
            </p>

            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              maxLength={CODE_LENGTH}
              placeholder="000000"
              autoFocus
              className="w-full max-w-[280px] text-center text-3xl font-bold tracking-[0.75em] border-b-2 border-emerald-500 py-3 mb-4 text-app-text bg-transparent outline-none placeholder:text-gray-300"
            />

            {attemptsRemaining !== null && attemptsRemaining <= 3 && (
              <p className="text-sm text-red-600 mb-2">
                {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
              </p>
            )}

            {postcardInfo?.expires_at && (
              <p className="text-xs text-app-text-muted mb-4">
                Code expires {new Date(postcardInfo.expires_at).toLocaleDateString()}
              </p>
            )}

            <button onClick={handleVerify} disabled={verifying || code.length !== CODE_LENGTH}
              className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-semibold text-base hover:bg-emerald-700 disabled:opacity-50 transition mt-2">
              {verifying ? 'Verifying...' : 'Verify'}
            </button>
            <button onClick={() => { setStep('request'); setCode(''); }} className="mt-3 text-sm text-emerald-600 font-medium hover:text-emerald-700">
              Request a new code
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPostcardPage() { return <Suspense><VerifyPostcardContent /></Suspense>; }
