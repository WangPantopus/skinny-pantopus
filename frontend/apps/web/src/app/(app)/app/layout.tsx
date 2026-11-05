import AppShell from '../../../components/AppShell';
import PrerenderSuspense from '../../../components/first-content/PrerenderSuspense';
import { SESSION_RECOVERY_SCRIPT } from '../../../lib/session-refresh';
import { EARLY_READS_SCRIPT } from '../../../lib/early-reads';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Before any bundle: recovers an expired access cookie in place when the
          middleware marked this document (lib/session-refresh.ts). */}
      <script dangerouslySetInnerHTML={{ __html: SESSION_RECOVERY_SCRIPT }} />
      {/* Before any bundle: the page's first reads (lib/early-reads.ts). */}
      <script dangerouslySetInnerHTML={{ __html: EARLY_READS_SCRIPT }} />
      {/* No boundary in a tab document with its first content, so the screen goes
          out with the frame (components/first-content/PrerenderSuspense.tsx). */}
      <PrerenderSuspense fallback={
        <div className="min-h-screen bg-app flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      }>
        <AppShell>{children}</AppShell>
      </PrerenderSuspense>
    </>
  );
}
