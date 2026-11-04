import { Suspense } from 'react';
import AppShell from '../../../components/AppShell';
import { SESSION_RECOVERY_SCRIPT } from '../../../lib/session-refresh';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Before any bundle: recovers an expired access cookie in place when the
          middleware marked this document (lib/session-refresh.ts). */}
      <script dangerouslySetInnerHTML={{ __html: SESSION_RECOVERY_SCRIPT }} />
      <Suspense fallback={
        <div className="min-h-screen bg-app flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      }>
        <AppShell>{children}</AppShell>
      </Suspense>
    </>
  );
}
