'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import { confirmStore } from '@/components/ui/confirm-store';
import type { MailItem, Summary, MailScope, MailType, AvailableHome } from './mailbox-types';
import { DELIVERABLE_TYPE_META } from './mailbox-constants';

export default function useMailboxData() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopeFromUrlParam = searchParams.get('scope');
  const homeIdFromUrlParam = searchParams.get('homeId') || '';
  const initialScopeFromUrl = searchParams.get('scope');
  const initialHomeIdFromUrl = searchParams.get('homeId');
  const initialScope: MailScope =
    initialScopeFromUrl === 'home' || initialScopeFromUrl === 'all'
      ? initialScopeFromUrl
      : 'personal';

  const isDev = process.env.NODE_ENV !== 'production';
  const [mail, setMail] = useState<MailItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [mailScope, setMailScope] = useState<MailScope>(initialScope);
  const [scopeHomeId, setScopeHomeId] = useState<string>(initialHomeIdFromUrl || '');
  const [availableHomes, setAvailableHomes] = useState<AvailableHome[]>([]);
  const [scopeError, setScopeError] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewFilter, setViewFilter] = useState<'inbox' | 'starred' | 'archived'>('inbox');
  const [search, setSearch] = useState('');
  const [selectedMail, setSelectedMail] = useState<MailItem | null>(null);
  const [readSessionId, setReadSessionId] = useState<string | null>(null);
  const [readSessionStartedAt, setReadSessionStartedAt] = useState<number | null>(null);
  const [maxScrollPercent, setMaxScrollPercent] = useState(0);
  const detailBodyRef = useRef<HTMLDivElement | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [seedLoading, setSeedLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const loadMail = useCallback(async () => {
    if (mailScope === 'home' && !scopeHomeId) {
      setMail([]);
      setSummary({
        total_mail: 0, unread_count: 0, ad_count: 0, unread_ad_count: 0,
        starred_count: 0, total_earned: 0, pending_earnings: 0
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setScopeError('');
    try {
      const res = await api.mailbox.getMailbox({
        scope: mailScope,
        type: typeFilter !== 'all' ? typeFilter as MailType : undefined,
        archived: viewFilter === 'archived' ? 'true' : undefined,
        starred: viewFilter === 'starred' ? 'true' : undefined,
        homeId: mailScope === 'home' && scopeHomeId ? scopeHomeId : undefined,
      });
      setMail(res.mail as unknown as MailItem[] || []);
      setSummary(res.summary || null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load mailbox for this scope.';
      setScopeError(message);
      console.error('Failed to load mailbox', err);
    }
    setLoading(false);
  }, [typeFilter, viewFilter, mailScope, scopeHomeId]);

  useEffect(() => { loadMail(); }, [loadMail]);

  useEffect(() => {
    const nextScope: MailScope =
      scopeFromUrlParam === 'home' || scopeFromUrlParam === 'all'
        ? scopeFromUrlParam : 'personal';

    setMailScope((prev) => {
      if (prev === nextScope) return prev;
      setSelectedMail(null);
      return nextScope;
    });

    setScopeHomeId((prev) => {
      if (prev === homeIdFromUrlParam) return prev;
      setSelectedMail(null);
      return homeIdFromUrlParam;
    });
  }, [scopeFromUrlParam, homeIdFromUrlParam]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (mailScope !== 'personal') params.set('scope', mailScope);
    if (mailScope === 'home' && scopeHomeId) params.set('homeId', scopeHomeId);
    const query = params.toString();
    const nextUrl = query ? `/app/mailbox?${query}` : '/app/mailbox';
    const currentScope = scopeFromUrlParam === 'home' || scopeFromUrlParam === 'all' ? scopeFromUrlParam : '';
    const currentHomeId = homeIdFromUrlParam;
    const nextScope = mailScope === 'personal' ? '' : mailScope;
    const nextHomeId = mailScope === 'home' ? scopeHomeId : '';
    if (currentScope === nextScope && currentHomeId === nextHomeId) return;
    router.replace(nextUrl, { scroll: false });
  }, [mailScope, scopeHomeId, router, scopeFromUrlParam, homeIdFromUrlParam]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const profile = await api.users.getMyProfile();
        setCurrentUserId(profile?.id || '');
      } catch { setCurrentUserId(''); }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchHomes = async () => {
      try {
        const homesRes = await api.homes.getMyHomes();
        const homes = homesRes?.homes || [];
        const mapped = homes.map((home) => {
          const addressParts = [home.address, home.city, home.state, home.zip_code].filter(Boolean).join(', ');
          const homeName = (home as unknown as Record<string, string>).name || '';
          return {
            id: home.id,
            label: addressParts || homeName || 'Home',
            searchText: [homeName, addressParts].filter(Boolean).join(' ').toLowerCase()
          };
        }).filter((home) => home.id);
        setAvailableHomes(mapped);
      } catch { setAvailableHomes([]); }
    };
    fetchHomes();
  }, []);

  useEffect(() => {
    if (mailScope !== 'home') return;
    if (scopeHomeId) return;
    if (availableHomes.length === 0) return;
    setScopeHomeId(availableHomes[0].id);
  }, [mailScope, scopeHomeId, availableHomes]);

  const closeReadSession = useCallback(async (reason: string) => {
    if (!readSessionId || !readSessionStartedAt) return;
    const activeTimeMs = Math.max(0, Date.now() - readSessionStartedAt);
    const sessionId = readSessionId;
    setReadSessionId(null);
    setReadSessionStartedAt(null);
    try {
      await api.mailbox.closeMailReadSession(sessionId, {
        activeTimeMs, maxScrollPercent, eventMeta: { reason }
      });
    } catch {}
  }, [readSessionId, readSessionStartedAt, maxScrollPercent]);

  useEffect(() => {
    return () => {
      if (readSessionId && readSessionStartedAt) {
        const activeTimeMs = Math.max(0, Date.now() - readSessionStartedAt);
        api.mailbox.closeMailReadSession(readSessionId, {
          activeTimeMs, maxScrollPercent, eventMeta: { reason: 'unmount' }
        }).catch(() => {});
      }
    };
  }, [readSessionId, readSessionStartedAt, maxScrollPercent]);

  const handleMailClick = async (item: MailItem) => {
    if (selectedMail?.id && selectedMail.id !== item.id) {
      await closeReadSession('switch_mail');
    }
    setSelectedMail(item);
    setMaxScrollPercent(0);
    try {
      const detail = await api.mailbox.getMail(item.id);
      const fullMail = detail?.mail;
      if (fullMail) {
        setSelectedMail(fullMail as unknown as MailItem);
        setMail(prev => prev.map(m => m.id === item.id ? { ...m, ...(fullMail as unknown as MailItem) } : m));
      }
      try {
        const sessionResult = await api.mailbox.startMailReadSession(item.id, {
          source: 'mailbox_web', at: new Date().toISOString()
        });
        if (sessionResult?.success && sessionResult.sessionId) {
          setReadSessionId(sessionResult.sessionId);
          setReadSessionStartedAt(Date.now());
        }
      } catch {}
    } catch (err) {
      console.warn('Failed to fetch full mail object', err);
    }
    if (!item.viewed) {
      try {
        await api.mailbox.markMailAsRead(item.id);
        setMail(prev => prev.map(m => m.id === item.id ? { ...m, viewed: true } : m));
        setSelectedMail(prev => prev && prev.id === item.id ? { ...prev, viewed: true } : prev);
      } catch {}
    }
  };

  const handleStar = async (e: React.MouseEvent, item: MailItem) => {
    e.stopPropagation();
    try {
      await api.mailbox.starMail(item.id, !item.starred);
      setMail(prev => prev.map(m => m.id === item.id ? { ...m, starred: !m.starred } : m));
      if (selectedMail?.id === item.id) setSelectedMail(prev => prev ? { ...prev, starred: !prev.starred } : null);
    } catch {
      setMail(prev => prev.map(m => m.id === item.id ? { ...m, starred: !m.starred } : m));
    }
  };

  const handleArchive = async (item: MailItem) => {
    try {
      if (selectedMail?.id === item.id) await closeReadSession('archive');
      await api.mailbox.archiveMail(item.id);
      setMail(prev => prev.filter(m => m.id !== item.id));
      setSelectedMail(null);
    } catch {}
  };

  const handleDelete = async (item: MailItem) => {
    const yes = await confirmStore.open({ title: 'Delete this mail permanently?', confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes) return;
    try {
      if (selectedMail?.id === item.id) await closeReadSession('delete');
      await api.mailbox.deleteMail(item.id);
      setMail(prev => prev.filter(m => m.id !== item.id));
      setSelectedMail(null);
    } catch {}
  };

  const handleCloseDetail = async () => {
    await closeReadSession('close_panel');
    setSelectedMail(null);
  };

  const handleDetailScroll = () => {
    const element = detailBodyRef.current;
    if (!element) return;
    const scrollRange = element.scrollHeight - element.clientHeight;
    if (scrollRange <= 0) { setMaxScrollPercent((prev) => Math.max(prev, 100)); return; }
    const current = Math.min(100, Math.max(0, (element.scrollTop / scrollRange) * 100));
    setMaxScrollPercent((prev) => Math.max(prev, current));
  };

  const handleSeedInbox = async () => {
    setActionError('');
    setActionSuccess('');
    setSeedLoading(true);
    try {
      const result = await api.mailbox.seedMailboxTestData({ count: 20, clearExisting: false });
      setViewFilter('inbox');
      await loadMail();
      setActionSuccess(`Seeded ${result.insertedCount} test mail item(s).`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to seed inbox.');
    } finally { setSeedLoading(false); }
  };

  // Helper functions
  const getSenderName = (item: MailItem) => {
    if (item.sender_business_name) return item.sender_business_name;
    if (item.sender?.name) return item.sender.name;
    if (item.sender?.username) return `@${item.sender.username}`;
    if (item.sender_address) return item.sender_address;
    return 'Pantopus';
  };

  const getDisplayTitle = (item: MailItem) => {
    if (item.display_title && item.display_title.trim()) return item.display_title.trim();
    if (item.subject && item.subject.trim()) return item.subject.trim();
    return '(untitled)';
  };

  const getPreviewText = (item: MailItem) => {
    if (item.preview_text && item.preview_text.trim()) return item.preview_text.trim();
    return (item.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  };

  const getDeliverableMeta = (item: MailItem) => {
    const typeKey = item.mail_type || (
      item.type === 'statement' ? 'bill'
        : item.type === 'package' || item.type === 'document' ? 'packet'
          : item.type === 'newsletter' ? 'book'
            : item.type === 'ad' ? 'promotion'
              : item.type
    );
    return DELIVERABLE_TYPE_META[typeKey] || DELIVERABLE_TYPE_META.other;
  };

  const getPrimaryActionLabel = (item: MailItem) => {
    const action = item.primary_action || (
      item.mail_type === 'bill' ? 'view_bill'
        : item.mail_type === 'packet' ? 'open_packet'
          : item.mail_type === 'book' ? 'read'
            : item.mail_type === 'notice' ? 'review'
              : 'open'
    );
    switch (action) {
      case 'view_bill': return 'View Bill';
      case 'open_packet': return 'Open Packet';
      case 'read': return 'Read';
      case 'review': return 'Review';
      case 'open': default: return 'Open';
    }
  };

  const filteredMail = mail.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const title = getDisplayTitle(item).toLowerCase();
    const sender = getSenderName(item).toLowerCase();
    const preview = getPreviewText(item).toLowerCase();
    return title.includes(q) || sender.includes(q) || preview.includes(q);
  });

  const selectedHomeLabel = availableHomes.find((home) => home.id === scopeHomeId)?.label || 'Selected home';
  const detailParams = new URLSearchParams();
  if (mailScope === 'home' || mailScope === 'all') detailParams.set('scope', mailScope);
  if (mailScope === 'home' && scopeHomeId) detailParams.set('homeId', scopeHomeId);
  const detailQuery = detailParams.toString();

  return {
    isDev, mail, summary, loading, mailScope, setMailScope, scopeHomeId, setScopeHomeId,
    availableHomes, scopeError, typeFilter, setTypeFilter, viewFilter, setViewFilter,
    search, setSearch, selectedMail, setSelectedMail, detailBodyRef,
    currentUserId, seedLoading, actionError, setActionError, actionSuccess, setActionSuccess,
    loadMail, handleMailClick, handleStar, handleArchive, handleDelete, handleCloseDetail,
    handleDetailScroll, handleSeedInbox, getSenderName, getDisplayTitle, getPreviewText,
    getDeliverableMeta, getPrimaryActionLabel, filteredMail, selectedHomeLabel, detailQuery,
  };
}
