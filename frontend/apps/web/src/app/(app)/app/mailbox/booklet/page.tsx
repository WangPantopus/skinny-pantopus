// @ts-nocheck
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import BookletViewer from '@/components/mailbox/BookletViewer';

function BookletContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mailId = searchParams.get('id') || '';

  const [booklet, setBooklet] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  useEffect(() => {
    if (!mailId) return;
    setLoading(true);
    api.mailboxV2P2.getBooklet(mailId)
      .then((result) => { setBooklet(result.booklet); setPages(result.pages); })
      .catch(() => toast.error('Failed to load booklet'))
      .finally(() => setLoading(false));
  }, [mailId]);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  if (!booklet) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-app-text-secondary mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
      <p className="text-center text-app-text-muted py-16">Booklet not found</p>
    </div>
  );

  const page = pages[currentPage - 1];
  const totalPages = pages.length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">{booklet.title || 'Booklet'}</h1>
      </div>

      <BookletViewer booklet={booklet} pages={pages} currentPage={currentPage} onPageChange={setCurrentPage} />

      {/* Page nav */}
      <div className="flex items-center justify-between mt-4">
        <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}
          className="flex items-center gap-1 px-3 py-2 border border-app-border rounded-lg text-sm text-app-text disabled:opacity-30 hover:bg-app-hover transition">
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <span className="text-sm text-app-text-muted">Page {currentPage} of {totalPages}</span>
        <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}
          className="flex items-center gap-1 px-3 py-2 border border-app-border rounded-lg text-sm text-app-text disabled:opacity-30 hover:bg-app-hover transition">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function BookletPage() { return <Suspense><BookletContent /></Suspense>; }
