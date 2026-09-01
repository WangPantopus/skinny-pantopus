// ============================================================
// The Block Founders opt-out surface. One promise, one button, no
// account, no questions. Success and not-found copy are deliberately
// calm: this page exists for someone who got mail they didn't ask for.
// Plain state, not react-query — a choice, not a constraint. The root
// layout wraps every route in QueryProvider; nothing on this one page is
// worth a cache entry.
// ============================================================

'use client';

import { useState } from 'react';
import * as api from '@pantopus/api';
import { MailX, Check, Loader2 } from 'lucide-react';

type Phase = 'ready' | 'sending' | 'done' | 'failed';

export default function NoMailView({ code }: { code: string }) {
  const [phase, setPhase] = useState<Phase>('ready');

  const confirm = async () => {
    setPhase('sending');
    try {
      const result = await api.blockFounders.redeemInviteOptOut(code);
      setPhase(result.done ? 'done' : 'failed');
    } catch {
      setPhase('failed');
    }
  };

  const done = phase === 'done';

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px] bg-app-surface border border-app-border rounded-2xl shadow-sm p-6 text-center">
        <span className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${done ? 'bg-app-success-light' : 'bg-app-surface-sunken'}`}>
          {done
            ? <Check size={26} strokeWidth={2.5} className="text-app-success" />
            : <MailX size={26} strokeWidth={2} className="text-app-text-secondary" />}
        </span>

        {done ? (
          <>
            <h1 className="text-[19px] font-bold text-app-text -tracking-[0.01em] mt-4">You&apos;re off the list</h1>
            <p className="text-[14px] text-app-text-secondary leading-[21px] mt-2">
              Your address will never receive another neighbor invitation from Pantopus. This is permanent and applies no matter who sends it.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[19px] font-bold text-app-text -tracking-[0.01em] mt-4">Stop mail to this address</h1>
            <p className="text-[14px] text-app-text-secondary leading-[21px] mt-2">
              A neighbor asked us to mail your address an invitation. One tap below and we&apos;ll never send another — permanently, no account needed.
            </p>
            <button
              type="button"
              onClick={confirm}
              disabled={phase === 'sending'}
              className="w-full h-12 mt-5 rounded-xl bg-app-text text-app-surface text-[15px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60"
            >
              {phase === 'sending' ? <Loader2 size={18} className="animate-spin" /> : <MailX size={17} strokeWidth={2.25} />}
              Never mail me again
            </button>
            {phase === 'failed' && (
              <p className="text-[13px] text-app-error leading-[19px] mt-3">
                That code didn&apos;t work. Check the link printed on the card and try again — codes are 16 characters.
              </p>
            )}
          </>
        )}

        <p className="text-[12px] text-app-text-muted leading-[17px] mt-5 pt-4 border-t border-app-border-subtle">
          Neighbors choose an address, but every card is written and mailed by Pantopus with this opt-out printed on it. The sender is never told you opted out.
        </p>
      </div>
    </div>
  );
}
