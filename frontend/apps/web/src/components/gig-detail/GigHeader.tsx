'use client';

import { useEffect, useState } from 'react';
import { Bookmark, Tag, Flag } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import ReportModal from '@/components/ui/ReportModal';

type AnyObj = Record<string, any>;

interface GigHeaderProps {
  gigId: string;
  isOwner: boolean;
  currentUserId: string | undefined;
  initialSaved?: boolean;
}

export default function GigHeader({
  gigId,
  isOwner,
  currentUserId,
  initialSaved = false,
}: GigHeaderProps) {
  const [isSaved, setIsSaved] = useState(Boolean(initialSaved));
  const [savingGig, setSavingGig] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    setIsSaved(Boolean(initialSaved));
  }, [initialSaved, gigId, currentUserId, isOwner]);

  const handleToggleSave = async () => {
    setSavingGig(true);
    const wasSaved = isSaved;
    setIsSaved(!wasSaved); // optimistic
    try {
      if (wasSaved) {
        await api.gigs.unsaveGig(gigId);
      } else {
        await api.gigs.saveGig(gigId);
      }
    } catch {
      setIsSaved(wasSaved); // revert on error
    } finally {
      setSavingGig(false);
    }
  };

  const handleReportGig = async (reason: string, details?: string) => {
    try {
      await api.gigs.reportGig(gigId, reason, details);
      toast.success('Report submitted. Thank you for keeping the community safe.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit report');
    }
  };

  if (isOwner) return null;

  return (
    <>
      <div className="flex items-center gap-2 flex-shrink-0 pt-1">
        <button
          onClick={handleToggleSave}
          disabled={savingGig}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
            isSaved
              ? 'bg-primary-50 border-primary-300 text-primary-700'
              : 'bg-app-surface border-app-border text-app-text-secondary hover:bg-app-hover'
          } disabled:opacity-50`}
          title={isSaved ? 'Remove bookmark' : 'Save this gig'}
        >
          <span>{isSaved ? <Bookmark className="w-4 h-4 inline-block" /> : <Tag className="w-4 h-4 inline-block" />}</span>
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>
        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition border bg-app-surface border-app-border text-app-text-secondary hover:bg-red-50 hover:text-red-600 hover:border-red-300"
          title="Report this gig"
        >
          <span><Flag className="w-4 h-4 inline-block" /></span>
          <span>Report</span>
        </button>
      </div>

      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportGig}
        entityType="gig"
      />
    </>
  );
}
