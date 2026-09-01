/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import { confirmStore } from '@/components/ui/confirm-store';
import type { MailItem, MailLink } from './legacy-detail-types';
import { useLinkPreviews } from './useLinkPreviews';

export function useLegacyMailDetail() {
  const params = useParams<{ mailId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mailId = Array.isArray(params.mailId) ? params.mailId[0] : params.mailId;
  const scope = searchParams.get('scope');
  const homeId = searchParams.get('homeId');
  const [mail, setMail] = useState<MailItem | null>(null);
  const [homeLabels, setHomeLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [readSessionId, setReadSessionId] = useState<string | null>(null);
  const [readSessionStartedAt, setReadSessionStartedAt] = useState<number | null>(null);
  const [maxScrollPercent, setMaxScrollPercent] = useState(0);
  const [ackLoading, setAckLoading] = useState(false);
  const [linkType, setLinkType] = useState<MailLink['target_type']>('document');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { linkPreviews, linkPreviewLoading } = useLinkPreviews(mail);

  const backHref = useMemo(() => {
    const params = new URLSearchParams();
    if (scope === 'home' || scope === 'all') {
      params.set('scope', scope);
    }
    if (scope === 'home' && homeId) {
      params.set('homeId', homeId);
    }
    const query = params.toString();
    return query ? `/app/mailbox?${query}` : '/app/mailbox';
  }, [scope, homeId]);

  const closeReadSession = useCallback(async (reason: string) => {
    if (!readSessionId || !readSessionStartedAt) return;

    const activeTimeMs = Math.max(0, Date.now() - readSessionStartedAt);
    const sessionId = readSessionId;
    setReadSessionId(null);
    setReadSessionStartedAt(null);

    try {
      await api.mailbox.closeMailReadSession(sessionId, {
        activeTimeMs,
        maxScrollPercent,
        eventMeta: { reason, source: 'mailbox_detail_web' }
      });
    } catch {
    }
  }, [readSessionId, readSessionStartedAt, maxScrollPercent]);

  useEffect(() => {
    return () => {
      if (readSessionId && readSessionStartedAt) {
        const activeTimeMs = Math.max(0, Date.now() - readSessionStartedAt);
        api.mailbox.closeMailReadSession(readSessionId, {
          activeTimeMs,
          maxScrollPercent,
          eventMeta: { reason: 'unmount', source: 'mailbox_detail_web' }
        }).catch(() => {});
      }
    };
  }, [readSessionId, readSessionStartedAt, maxScrollPercent]);

  useEffect(() => {
    const fetchHomes = async () => {
      try {
        const homesRes = await api.homes.getMyHomes();
        const homes = ((homesRes as any)?.homes || []) as any[];
        const labels: Record<string, string> = {};
        homes.forEach((entry) => {
          const home = entry?.home || entry;
          if (!home?.id) return;
          labels[home.id] =
            home.name ||
            home.address_line1 ||
            home.address ||
            [home.city, home.state].filter(Boolean).join(', ') ||
            'Home';
        });
        setHomeLabels(labels);
      } catch {
        setHomeLabels({});
      }
    };
    fetchHomes();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchMail = async () => {
      if (!mailId) {
        setError('Mail ID is missing.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      setActionError('');
      setActionSuccess('');
      setMaxScrollPercent(0);

      try {
        const detail = await api.mailbox.getMail(mailId);
        if (cancelled) return;
        const fullMail = (detail as any)?.mail as MailItem;
        setMail(fullMail);

        if (!fullMail?.viewed) {
          api.mailbox.markMailAsRead(mailId).catch(() => {});
          setMail((prev) => (prev ? { ...prev, viewed: true } : prev));
        }

        try {
          const session = await api.mailbox.startMailReadSession(mailId, {
            source: 'mailbox_detail_web',
            at: new Date().toISOString()
          });
          if (!cancelled && session?.success && session.sessionId) {
            setReadSessionId(session.sessionId);
            setReadSessionStartedAt(Date.now());
          }
        } catch {
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load this mail.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMail();
    return () => {
      cancelled = true;
    };
  }, [mailId]);

  const handleDetailScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const scrollRange = element.scrollHeight - element.clientHeight;
    if (scrollRange <= 0) {
      setMaxScrollPercent((prev) => Math.max(prev, 100));
      return;
    }
    const current = Math.min(100, Math.max(0, (element.scrollTop / scrollRange) * 100));
    setMaxScrollPercent((prev) => Math.max(prev, current));
  };

  const handleStar = async () => {
    if (!mail) return;
    setActionError('');
    setActionSuccess('');
    try {
      await api.mailbox.starMail(mail.id, !mail.starred);
      setMail((prev) => (prev ? { ...prev, starred: !prev.starred } : prev));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update star.');
    }
  };

  const handleArchiveToggle = async () => {
    if (!mail) return;
    setActionError('');
    setActionSuccess('');
    try {
      await closeReadSession(mail.archived ? 'unarchive' : 'archive');
      if (mail.archived) {
        await api.mailbox.unarchiveMail(mail.id);
      } else {
        await api.mailbox.archiveMail(mail.id);
      }
      setMail((prev) => (prev ? { ...prev, archived: !prev.archived } : prev));
      setActionSuccess(mail.archived ? 'Mail moved back to inbox.' : 'Mail archived.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update archive.');
    }
  };

  const handleDelete = async () => {
    if (!mail) return;
    const confirmed = await confirmStore.open({ title: 'Delete this mail permanently?', confirmLabel: 'Delete', variant: 'destructive' });
    if (!confirmed) return;
    setActionError('');
    setActionSuccess('');
    try {
      await closeReadSession('delete');
      await api.mailbox.deleteMail(mail.id);
      router.push(backHref);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete mail.');
    }
  };

  const handleAcknowledge = async () => {
    if (!mail || !mail.ack_required || mail.ack_status === 'acknowledged') return;
    setAckLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      const result = await api.mailbox.acknowledgeMail(mail.id);
      setMail((prev) => prev ? { ...prev, ack_status: result.ackStatus } : prev);
      setActionSuccess('Notice acknowledged.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to acknowledge notice.');
    } finally {
      setAckLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (!mail || !linkTargetId.trim()) return;

    setActionError('');
    setActionSuccess('');
    setLinkSaving(true);

    try {
      const result = await api.mailbox.createMailLink(mail.id, {
        targetType: linkType,
        targetId: linkTargetId.trim(),
        createdBy: 'user'
      });

      setMail((prev) => {
        if (!prev) return prev;
        const existing = prev.links || [];
        const deduped = existing.some((link) => link.id === result.link.id)
          ? existing
          : [result.link as MailLink, ...existing];
        return { ...prev, links: deduped };
      });

      setLinkTargetId('');
      setActionSuccess('Link added to this mail.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to add link.');
    } finally {
      setLinkSaving(false);
    }
  };

  const homeLabelFor = (id?: string | null) => {
    if (!id) return 'Home';
    return homeLabels[id] || 'Home';
  };

  return {
    mail,
    loading,
    error,
    actionError,
    actionSuccess,
    backHref,
    ackLoading,
    linkType,
    setLinkType,
    linkTargetId,
    setLinkTargetId,
    linkSaving,
    linkPreviews,
    linkPreviewLoading,
    scrollRef,
    handleDetailScroll,
    handleStar,
    handleArchiveToggle,
    handleDelete,
    handleAcknowledge,
    handleCreateLink,
    homeLabelFor,
  };
}
