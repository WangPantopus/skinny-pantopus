import type { Metadata } from 'next';
import Link from 'next/link';
import { planInviteToken } from '@/lib/publicShare';
import StopInvitationEmails from './StopInvitationEmails';

// "Don't send me invitations" from a Plans invitation email. Opening the page changes nothing (mail scanners open
// links); the button does, and it stops every later invitation email to the address.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invitation emails | Pantopus',
  robots: { index: false, follow: false },
};

export default async function PlanInvitationsUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const value = (await searchParams)?.invite;
  const token = planInviteToken(Array.isArray(value) ? value[0] : value);
  return (
    <main className="min-h-screen bg-app text-app-text">
      <div className="mx-auto w-full max-w-md pb-10">
        <div className="flex h-14 items-center border-b border-app-border bg-app-surface px-4">
          <Link href="/" className="text-[19px] font-bold leading-[22px] tracking-[-0.02em] text-app-text">
            Pantopus
          </Link>
        </div>
        <div className="flex flex-col gap-4 px-4 pt-[18px]">
          <h1 className="text-2xl font-bold leading-[30px] tracking-[-0.015em]">Invitation emails</h1>
          {token ? (
            <StopInvitationEmails token={token} />
          ) : (
            <p className="text-sm leading-5 text-app-text-secondary">
              This link isn&apos;t complete. Use the “Don&apos;t send me invitations” link at the bottom of the email.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
