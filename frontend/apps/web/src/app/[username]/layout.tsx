import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { fetchPublicUser, normalizePublicProfileIdentifier } from '@/lib/publicShare';

export default async function UsernameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  // No account has this name (a private profile answers 403, not 404): answer a real 404. This
  // runs here, before the Suspense below starts streaming the page with a 200.
  const { username } = await params;
  const result = await fetchPublicUser(normalizePublicProfileIdentifier(username));
  if (!result.data && result.status === 404) notFound();

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    }>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
