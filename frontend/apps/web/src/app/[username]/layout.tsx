import { Suspense } from 'react';
import AppShell from '../../components/AppShell';

export default function UsernameLayout({ children }: { children: React.ReactNode }) {
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
