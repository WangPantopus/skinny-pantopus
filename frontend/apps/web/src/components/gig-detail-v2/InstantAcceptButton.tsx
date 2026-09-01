'use client';

import { useState } from 'react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

interface InstantAcceptButtonProps {
  gigId: string;
  onAccepted: () => void;
}

export default function InstantAcceptButton({ gigId, onAccepted }: InstantAcceptButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handlePress = async () => {
    if (state === 'loading' || state === 'success') return;
    setState('loading');
    setErrorMsg('');
    try {
      const resp = await api.gigs.instantAccept(gigId);
      setState('success');
      if ((resp as any)?.requiresPaymentSetup) {
        toast.success("You're assigned! Waiting for the task owner to finish payment authorization.");
      } else {
        toast.success("You're assigned!");
      }
      setTimeout(onAccepted, 800);
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 409) {
        setErrorMsg('This task was just taken by someone else');
        toast.warning('This task was just taken by someone else');
      } else if (status === 403) {
        setErrorMsg('Set up your wallet to accept tasks');
        toast.error('Set up your wallet to accept tasks');
      } else {
        setErrorMsg(err?.message || 'Something went wrong');
      }
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <div className="bg-green-500 text-white text-center py-4 rounded-xl font-bold text-lg animate-pulse">
        &#10003; You&apos;re assigned!
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handlePress}
        disabled={state === 'loading'}
        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-60 transition"
      >
        {state === 'loading' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            Accepting&hellip;
          </span>
        ) : (
          'I Can Help! \uD83E\uDD1D'
        )}
      </button>
      {errorMsg && <p className="text-red-600 text-sm text-center mt-2">{errorMsg}</p>}
    </div>
  );
}
