'use client';

// ============================================================
// /join/:code — a friend's invite link (Me → "Invite a neighbor" and
// the apps' other invites). Someone new sees who invited them over the
// /start funnel, so the invite still answers their own address first
// and every sign-up on the way carries the code that credits the friend.
// Someone already signed in has nothing to accept.
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import * as api from '@pantopus/api';
import { PantopusLockup } from '@/components/brand/PantopusMark';
import { ShimmerBlock } from '@/components/ui/Shimmer';
import StartFunnel, { InvitedBy, type StartInvite } from './StartFunnel';

const PRIMARY_BUTTON =
  'h-[54px] w-full flex items-center justify-center gap-1.5 rounded-2xl bg-primary-600 text-white text-base font-semibold -tracking-[0.01em] shadow-[var(--shadow-primary)] hover:bg-primary-700 transition-colors';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-app-bg">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 pb-8 sm:max-w-[540px]">
        <div className="pt-2">
          <PantopusLockup size={30} />
        </div>
        <div className="flex flex-1 flex-col justify-center py-8">{children}</div>
      </div>
    </main>
  );
}

function Message({ title, body, invite, children }: {
  title: string;
  body: string;
  invite?: StartInvite;
  children: React.ReactNode;
}) {
  return (
    <>
      {invite ? <div className="mb-4"><InvitedBy invite={invite} /></div> : null}
      <h1 className="text-[28px] leading-[34px] font-bold -tracking-[0.024em] text-app-text text-balance">{title}</h1>
      <p className="mt-3 text-[15.5px] leading-[23px] text-app-text-secondary">{body}</p>
      <div className="mt-6 flex flex-col items-center gap-2">{children}</div>
    </>
  );
}

export default function JoinInvite({ status, invite }: { status: 'valid' | 'invalid' | 'error'; invite: StartInvite | null }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    setSignedIn(api.hasActiveSession());
  }, []);

  if (status === 'error') {
    return (
      <Shell>
        <Message title="We couldn't open this invite" body="Something went wrong on our side. Try again in a moment.">
          <button type="button" onClick={() => router.refresh()} className={PRIMARY_BUTTON}>
            Try again
          </button>
        </Message>
      </Shell>
    );
  }

  if (status === 'invalid' || !invite) {
    return (
      <Shell>
        <Message
          title="This invite link isn't valid"
          body="Check that you opened the whole link your friend sent. You can still look up your address and join."
        >
          <Link href="/start" className={PRIMARY_BUTTON}>
            See your place
            <ArrowRight size={17} strokeWidth={2.5} />
          </Link>
          <Link href="/login" className="py-2 text-sm font-semibold text-primary-600 hover:text-primary-700">
            Sign in
          </Link>
        </Message>
      </Shell>
    );
  }

  if (signedIn === null) {
    return (
      <Shell>
        <div className="space-y-4" aria-hidden="true">
          <ShimmerBlock className="h-9 w-64 rounded-full" />
          <ShimmerBlock className="h-24 w-full rounded-2xl" />
          <ShimmerBlock className="h-[54px] w-full rounded-2xl" />
        </div>
      </Shell>
    );
  }

  if (signedIn) {
    return (
      <Shell>
        <Message
          invite={invite}
          title="You're already on Pantopus"
          body="You have an account, so there's nothing to accept. The invite is for people who are new to Pantopus."
        >
          <Link href="/app/place" className={PRIMARY_BUTTON}>
            Open Pantopus
            <ArrowRight size={17} strokeWidth={2.5} />
          </Link>
        </Message>
      </Shell>
    );
  }

  return <StartFunnel invite={invite} />;
}
