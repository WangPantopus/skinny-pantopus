'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { MailboxHome } from '@/types/mailbox';
import VerifyPromptSheet from '@/components/place/VerifyPromptSheet';

/** The closed Home mailbox with a padlock (Mail tab drawings, R14-HomeLocked). */
function LockedMailbox({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <rect x="54" y="92" width="12" height="28" rx="2" fill="#8a6a4a" />
      <path d="M18 94 V50 A42 42 0 0 1 102 50 V94 Z" fill="#94a3b8" />
      <path d="M27 90 V53 A33 33 0 0 1 93 53 V90 Z" fill="#64748b" />
      <rect x="51" y="38" width="18" height="6" rx="3" fill="#e2e8f0" />
      <rect x="40" y="68" width="40" height="13" rx="2" fill="#f1f5f9" stroke="#cbd5e1" strokeDasharray="3 2" />
      <rect x="102" y="64" width="16" height="7" rx="1.5" fill="#94a3b8" />
      <path d="M53 52 V47 a7 7 0 0 1 14 0 V52" fill="none" stroke="#f8fafc" strokeWidth="3" />
      <rect x="49" y="51" width="22" height="16" rx="3" fill="#f8fafc" />
      <circle cx="60" cy="58" r="2.4" fill="#64748b" />
    </svg>
  );
}

/**
 * A Home whose mail waits on proof of address: the closed box with Verify your
 * home (which opens the Place verify sheet for that home). `compact` is the
 * one-line card shown above other Homes' mail.
 */
export default function HomeLockedBox({ home, compact = false }: { home: MailboxHome; compact?: boolean }) {
  const [verifying, setVerifying] = useState(false);
  const where = home.name || home.address_line;
  const sheet = verifying
    ? createPortal(
      <VerifyPromptSheet open onClose={() => setVerifying(false)} homeId={home.home_id} address={home.address_line} />,
      document.body,
    )
    : null;

  if (compact) {
    return (
      <section aria-label={`Mail for ${where}`} className="mx-3 mt-3 flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-2.5">
        <LockedMailbox size={44} />
        <p className="min-w-0 flex-1 text-sm text-app-text">
          <span className="font-semibold">Verify {where}</span> to get its mail.
        </p>
        <button type="button" onClick={() => setVerifying(true)} className="min-h-[40px] flex-shrink-0 rounded-lg px-3 text-sm font-semibold text-primary-700 hover:bg-app-hover dark:text-primary-300">
          Verify
        </button>
        {sheet}
      </section>
    );
  }

  return (
    <section aria-label="Home drawer" className="flex flex-col items-center px-6 pb-10 pt-8 text-center">
      <LockedMailbox size={150} />
      <h3 className="mt-3 text-xl font-semibold text-app-text">Verify your home to get its mail</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-5 text-app-text-secondary">
        Bills, notices and ballot guides for your household come to the Home drawer once you verify you live at {home.address_line}.
      </p>
      <button
        type="button"
        onClick={() => setVerifying(true)}
        className="mt-5 min-h-[48px] w-full max-w-sm rounded-xl bg-primary-600 px-4 text-base font-semibold text-white hover:bg-primary-700"
      >
        Verify your home
      </button>
      <p className="mt-3 text-sm text-app-text-secondary">
        Your own mail still comes to <Link href="/app/mailbox/personal" className="font-semibold text-primary-600 hover:underline">Me</Link>.
      </p>
      {sheet}
    </section>
  );
}
