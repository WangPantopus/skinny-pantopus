import type { Metadata, Viewport } from 'next';
import { buildShareMetadata, fetchPublicJoin } from '@/lib/publicShare';
import JoinInvite from '@/components/place/JoinInvite';

// A friend's invite link. The page reads the invite on the server so the link's
// preview in a message says who sent it; never indexed (robots.ts also disallows /join/).
export const dynamic = 'force-dynamic';

const DESCRIPTION =
  "Public records, local risks, and who's verified nearby — free, no account. Look up your address, then join your neighbors.";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const { data } = await fetchPublicJoin(code);
  const base = { robots: { index: false, follow: false } };
  if (!data?.valid) return { ...base, title: 'Pantopus invite', description: DESCRIPTION };
  return {
    ...base,
    ...buildShareMetadata({
      title: `${data.referrer_name || 'A neighbor'} invited you to Pantopus`,
      description: DESCRIPTION,
      path: `/join/${encodeURIComponent(code)}`,
      appArgument: `pantopus:///join/${encodeURIComponent(code)}`,
    }),
  };
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { data } = await fetchPublicJoin(code);
  if (!data) return <JoinInvite status="error" invite={null} />;
  if (!data.valid || !data.code) return <JoinInvite status="invalid" invite={null} />;
  return (
    <JoinInvite
      status="valid"
      invite={{ code: data.code, name: data.referrer_name || 'A neighbor', avatarUrl: data.referrer_avatar ?? null }}
    />
  );
}
