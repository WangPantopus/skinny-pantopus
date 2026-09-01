'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { GIG_CATEGORIES } from '@pantopus/ui-utils';
import { buildGigShareUrl } from '@pantopus/utils';
import LocationPicker, { type SelectedLocation } from '@/components/LocationPicker';
import FileUpload from '@/components/FileUpload';
import { toast } from '@/components/ui/toast-store';
import { InlineDraftHelper } from '@/components/ai-assistant';
import type { BusinessMembership } from '@pantopus/types';

interface TaskItem {
  name: string;
  notes: string;
  budgetCap: string;
  preferredStore: string;
}

const ALL_CATEGORIES = ['General', ...GIG_CATEGORIES];

function PostTaskPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editGigId = searchParams.get('editGigId');
  const isEditMode = !!editGigId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [price, setPrice] = useState<string>('50');
  const [deadline, setDeadline] = useState<string>('');
  const [estimatedDur, setEstimatedDur] = useState<string>('');

  // Media files for upload
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);

  const [cancellationPolicy, setCancellationPolicy] = useState<string>('standard');

  // New fields from mobile parity
  const [isUrgent, setIsUrgent] = useState(false);
  const [tags, setTags] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const [items, setItems] = useState<TaskItem[]>([]);
  const [prefillSource, setPrefillSource] = useState<{ sourceType: string; sourceId: string; sourceTitle: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [initialLoading, setInitialLoading] = useState(false);

  // First-gig share prompt
  const [shareModal, setShareModal] = useState<{ gigId: string; title: string } | null>(null);

  // "Post as business" — proxy posting
  const [myBusinesses, setMyBusinesses] = useState<BusinessMembership[]>([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string>(''); // '' = personal

  useEffect(() => {
    const loadBusinesses = async () => {
      const token = getAuthToken();
      if (!token) return;
      try {
        const res = await api.businesses.getMyBusinesses();
        // Only show businesses where user can post gigs
        const allowedBusinesses = (res.businesses || []).filter(
          (b: BusinessMembership) => ['owner', 'admin', 'editor', 'staff'].includes(b.role_base)
        );
        setMyBusinesses(allowedBusinesses);

        const beneficiaryFromQuery = searchParams.get('beneficiary');
        if (
          beneficiaryFromQuery &&
          allowedBusinesses.some((b: BusinessMembership) => String(b.business_user_id) === String(beneficiaryFromQuery))
        ) {
          setSelectedBeneficiary(beneficiaryFromQuery);
        }
      } catch {
        // Not a blocker
      }
    };
    loadBusinesses();
  }, [searchParams]);

  useEffect(() => {
    if (!isEditMode || !editGigId) return;
    const loadGigForEdit = async () => {
      setInitialLoading(true);
      try {
        const g = await api.gigs.getGigById(editGigId) as any;
        setTitle(g.title || '');
        setDescription(g.description || '');
        setCategory(g.category || 'General');
        setPrice(g.price != null ? String(g.price) : '50');
        setIsUrgent(Boolean(g.is_urgent));
        setTags(Array.isArray(g.tags) ? g.tags.join(', ') : '');
        setEstimatedDur(g.estimated_duration != null ? String(g.estimated_duration) : '');
        if (g.deadline) {
          const d = new Date(g.deadline);
          if (!isNaN(d.getTime())) {
            setDeadline(d.toISOString().slice(0, 10));
            setDeadlineTime(d.toISOString().slice(11, 16));
          }
        }
        setCancellationPolicy(g.cancellation_policy || 'standard');
        if (Array.isArray(g.items)) {
          const mapped = g.items.map((it: unknown) => {
            const item = (it || {}) as Record<string, any>;
            return {
              name: String(item.name || ''),
              notes: String(item.notes || ''),
              budgetCap: String(item.budgetCap || ''),
              preferredStore: String(item.preferredStore || ''),
            };
          }).filter((it: TaskItem) => it.name || it.notes || it.budgetCap || it.preferredStore);
          setItems(mapped);
        }

        if (g.location?.latitude && g.location?.longitude) {
          setSelectedLocation({
            latitude: g.location.latitude,
            longitude: g.location.longitude,
            address: g.exact_address || '',
            city: g.exact_city || null,
            state: g.exact_state || null,
            zip: g.exact_zip || null,
            mode: ((g.origin_mode as SelectedLocation['mode']) || 'address'),
            homeId: g.origin_home_id || null,
            place_id: g.origin_place_id || null,
            label: g.exact_address || 'Gig location',
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load task for editing');
      } finally {
        setInitialLoading(false);
      }
    };
    void loadGigForEdit();
  }, [isEditMode, editGigId]);

  // ── Prefill from URL params ──
  useEffect(() => {
    const prefillParam = searchParams.get('prefill');
    if (!prefillParam) return;
    try {
      const data = JSON.parse(prefillParam);
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.price) setPrice(String(data.price));
      if (data.category) setCategory(data.category);
      if (Array.isArray(data.tags) && data.tags.length) {
        setTags(data.tags.join(', '));
      }
      if (data.is_urgent != null) setIsUrgent(Boolean(data.is_urgent));
      if (data.estimated_duration != null) setEstimatedDur(String(data.estimated_duration));
      if (data.cancellation_policy) setCancellationPolicy(data.cancellation_policy);
      if (data.deadline) {
        const parsed = new Date(data.deadline);
        if (!isNaN(parsed.getTime())) {
          // Split into date + time so both inputs prefill correctly.
          const yyyy = parsed.getFullYear();
          const mm = String(parsed.getMonth() + 1).padStart(2, '0');
          const dd = String(parsed.getDate()).padStart(2, '0');
          const hh = String(parsed.getHours()).padStart(2, '0');
          const mi = String(parsed.getMinutes()).padStart(2, '0');
          setDeadline(`${yyyy}-${mm}-${dd}`);
          // Only set time if it isn't midnight (which is the default when only a date was supplied).
          if (parsed.getHours() !== 0 || parsed.getMinutes() !== 0) {
            setDeadlineTime(`${hh}:${mi}`);
          }
        }
      }
      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude) && data.address) {
        setSelectedLocation({
          latitude,
          longitude,
          address: data.address,
          city: data.city || null,
          state: data.state || null,
          zip: data.zip || null,
          mode: (data.mode as SelectedLocation['mode']) || 'address',
          homeId: data.homeId || null,
          place_id: data.place_id || null,
          label: data.address,
        });
      }
      if (data.sourceType && data.sourceId) {
        setPrefillSource({
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          sourceTitle: data.sourceTitle || data.title || '',
        });
      }
    } catch { /* invalid prefill JSON */ }
  }, [searchParams]);

  // ── SessionStorage prefill from AI Assistant ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ai_gig_draft');
      if (!raw) return;
      sessionStorage.removeItem('ai_gig_draft');
      const data = JSON.parse(raw);
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.price != null) setPrice(String(data.price));
      if (data.category) setCategory(data.category);
      if (data.is_urgent != null) setIsUrgent(Boolean(data.is_urgent));
      if (data.tags?.length) setTags(data.tags.join(', '));
      if (data.estimated_duration != null) setEstimatedDur(String(data.estimated_duration));
      if (data.cancellation_policy) setCancellationPolicy(data.cancellation_policy);
    } catch { /* ignore */ }
  }, []);

  // ── Item helpers ──
  const addItem = () => setItems((prev) => [...prev, { name: '', notes: '', budgetCap: '', preferredStore: '' }]);
  const updateItem = (idx: number, field: keyof TaskItem, value: string) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const parsedPrice = useMemo(() => {
    const n = parseFloat(price);
    return Number.isFinite(n) ? n : 0;
  }, [price]);

  const parsedEstimatedDur = useMemo(() => {
    if (!estimatedDur.trim()) return null;
    const n = parseFloat(estimatedDur);
    return Number.isFinite(n) ? n : null;
  }, [estimatedDur]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }

    if (!title.trim()) {
      setFieldErrors({ title: 'Title is required.' });
      setError('Please fix the highlighted fields.');
      return;
    }
    if (title.trim().length < 5) {
      setFieldErrors({ title: 'Title must be at least 5 characters.' });
      setError('Please fix the highlighted fields.');
      return;
    }
    if (!description.trim()) {
      setFieldErrors({ description: 'Description is required.' });
      setError('Please fix the highlighted fields.');
      return;
    }
    if (description.trim().length < 10) {
      setFieldErrors({ description: 'Description must be at least 10 characters.' });
      setError('Please fix the highlighted fields.');
      return;
    }
    if (parsedPrice <= 0) {
      setFieldErrors({ price: 'Budget must be greater than 0.' });
      setError('Please fix the highlighted fields.');
      return;
    }
    if (parsedEstimatedDur !== null && parsedEstimatedDur <= 0) {
      setFieldErrors({ estimated_duration: 'Estimated duration must be a positive number.' });
      setError('Please fix the highlighted fields.');
      return;
    }

    if (!selectedLocation || !selectedLocation.address) {
      setFieldErrors({ location: 'Please choose an exact address (Home, Address, or Current).' });
      setError('Please fix the highlighted fields.');
      return;
    }

    // Combine date + optional time for deadline
    let deadlineIso: string | null = null;
    if (deadline) {
      if (deadlineTime) {
        deadlineIso = new Date(`${deadline}T${deadlineTime}:00`).toISOString();
      } else {
        deadlineIso = new Date(deadline).toISOString();
      }
    }

    const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    const validItems = items.filter((it) => it.name.trim());

    const payload: Record<string, any> = {
      title: title.trim(),
      description: description.trim(),
      price: parsedPrice,
      category: category?.trim() || null,
      deadline: deadlineIso,
      estimated_duration: parsedEstimatedDur,
      attachments: [] as string[],
      beneficiary_user_id: selectedBeneficiary || null,
      cancellation_policy: cancellationPolicy,
      is_urgent: isUrgent || undefined,
      ...(parsedTags.length > 0 ? { tags: parsedTags } : {}),
      ...(validItems.length > 0 ? { items: validItems } : {}),
      ...(prefillSource ? { source_type: prefillSource.sourceType, source_id: prefillSource.sourceId } : {}),
      location: selectedLocation
        ? {
            mode: selectedLocation.mode === 'address' ? 'address' : selectedLocation.mode,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            address: selectedLocation.address,
            city: selectedLocation.city || null,
            state: selectedLocation.state || null,
            zip: selectedLocation.zip || null,
            homeId: selectedLocation.homeId || null,
            place_id: selectedLocation.place_id || null,
          }
        : undefined,
    };

    setSubmitting(true);

    try {
      let targetGigId = '';
      if (isEditMode && editGigId) {
        setUploadProgress('Saving changes...');
        const updatePayload = { ...payload };
        delete (updatePayload as Record<string, any>).beneficiary_user_id;
        const res = await api.gigs.updateGig(editGigId, updatePayload as Parameters<typeof api.gigs.updateGig>[1]);
        targetGigId = String(res?.gig?.id || editGigId);
      } else {
        // Step 1: Create the gig
        setUploadProgress('Creating task...');
        const res = await api.gigs.createGigV2(payload as unknown as Parameters<typeof api.gigs.createGigV2>[0]);
        targetGigId = String(res?.gig?.id || '');
      }

      if (!targetGigId) {
        throw new Error('Failed to save task — no ID returned');
      }

      // Step 2: Upload media files if any
      if (mediaFiles.length > 0) {
        setUploadProgress(`Uploading ${mediaFiles.length} file(s)...`);
        try {
          await api.upload.uploadGigMedia(targetGigId, mediaFiles);
        } catch (uploadErr: unknown) {
          console.error('Media upload failed:', uploadErr);
          // Task was created, just media failed — still redirect
          toast.warning(`${isEditMode ? 'Task updated' : 'Task posted'}, but some media failed to upload: ${uploadErr instanceof Error ? uploadErr.message : 'Unknown error'}`);
        }
      }

      setUploadProgress('');

      // Check if first gig — show share prompt
      const FIRST_GIG_KEY = 'pantopus_first_gig_shared';
      if (!isEditMode) {
        try {
          const flag = localStorage.getItem(FIRST_GIG_KEY);
          localStorage.setItem(FIRST_GIG_KEY, '1');
          if (!flag) {
            setShareModal({ gigId: targetGigId, title: title.trim() });
            return;
          }
        } catch { /* non-critical */ }
      }

      toast.success(isEditMode ? 'Task updated' : 'Task posted');
      router.push(`/app/gigs/${targetGigId}`);
    } catch (err: unknown) {
      const errData = err && typeof err === 'object' ? (err as Record<string, any>) : null;
      const details = Array.isArray(errData?.validationDetails) ? (errData.validationDetails as Record<string, any>[]) : [];
      if (details.length > 0) {
        const nextFieldErrors: Record<string, string> = {};
        for (const d of details) {
          const rawField = String(d?.field || '');
          const field = rawField.startsWith('location.') ? 'location' : rawField;
          if (field && d?.message && !nextFieldErrors[field]) {
            nextFieldErrors[field] = String(d.message);
          }
        }
        setFieldErrors(nextFieldErrors);
        setError('Please fix the highlighted fields.');
      } else {
        setError(err instanceof Error ? err.message : isEditMode ? 'Failed to update task' : 'Failed to post task');
      }
      console.error('Failed to create gig:', err);
    } finally {
      setSubmitting(false);
      setUploadProgress('');
    }
  };

  const handleShareGig = useCallback(async () => {
    if (!shareModal) return;
    const url = buildGigShareUrl(shareModal.gigId);
    const text = `I just posted a task on Pantopus: ${shareModal.title}. Check it out: ${url}`;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: shareModal.title, text, url });
      } catch { /* user cancelled */ }
    } else {
      try {
        const clipboard = (navigator as Navigator & { clipboard?: Clipboard }).clipboard;
        if (clipboard?.writeText) {
          await clipboard.writeText(url);
          toast.success('Link copied to clipboard');
        }
      } catch { /* fallback */ }
    }
    toast.success('Task posted');
    router.push(`/app/gigs/${shareModal.gigId}`);
  }, [shareModal, router]);

  const handleSkipShare = useCallback(() => {
    if (!shareModal) return;
    toast.success('Task posted');
    router.push(`/app/gigs/${shareModal.gigId}`);
  }, [shareModal, router]);

  const handleCopyGigLink = useCallback(async () => {
    if (!shareModal) return;
    try {
      await navigator.clipboard.writeText(buildGigShareUrl(shareModal.gigId));
      toast.success('Link copied to clipboard');
    } catch { /* fallback */ }
  }, [shareModal]);

  const inputClass = (field: string) =>
    `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
      fieldErrors[field] ? 'border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/40' : 'border-app-border'
    }`;

  // ── Share modal (first gig) ─────────────────────────────
  if (shareModal) {
    return (
      <div className="bg-app-surface-raised min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Your gig is live!</h2>
          <p className="text-gray-500 mb-6">Share it with your neighbors to get offers faster.</p>
          <div className="space-y-3">
            <button
              onClick={handleCopyGigLink}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
              Copy link
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleShareGig}
                className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition"
              >
                Share
              </button>
            )}
            <button
              onClick={handleSkipShare}
              className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-app-surface-raised min-h-screen">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-xl font-semibold text-app-text mb-6">{isEditMode ? 'Edit Task' : 'Post Task'}</h1>
        {initialLoading ? (
          <div className="rounded-lg border border-app-border bg-app-surface p-6 text-sm text-app-text-secondary">Loading task details…</div>
        ) : (
        <form onSubmit={handleSubmit} className="bg-app-surface rounded-xl border border-app-border p-6 space-y-5">
          {error ? (
            <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {/* Prefill banner */}
          {prefillSource && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <span className="text-lg">🔗</span>
              <p className="text-sm text-blue-700 font-medium">Posting task for: {prefillSource.sourceTitle}</p>
            </div>
          )}

          {/* Post as business selector */}
          {myBusinesses.length > 0 && (
            <div className="rounded-lg border border-app-border bg-app-surface-raised p-3">
              <label className="block text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Post as</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBeneficiary('')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition border ${
                    selectedBeneficiary === ''
                      ? 'bg-app-surface border-gray-900 text-app-text shadow-sm'
                      : 'border-app-border text-app-text-secondary hover:bg-app-surface'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-white">👤</span>
                  Personal
                </button>
                {myBusinesses.map((biz) => (
                  <button
                    key={biz.business_user_id}
                    type="button"
                    onClick={() => setSelectedBeneficiary(biz.business_user_id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition border ${
                      selectedBeneficiary === biz.business_user_id
                        ? 'bg-violet-50 border-violet-500 text-violet-700 shadow-sm'
                        : 'border-app-border text-app-text-secondary hover:bg-app-surface'
                    }`}
                  >
                    {biz.business?.profile_picture_url ? (
                      <Image src={biz.business.profile_picture_url} alt="" width={20} height={20} sizes="20px" quality={75} className="rounded-full object-cover" />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-violet-200 flex items-center justify-center text-[10px] text-violet-700 font-bold">
                        {(biz.business?.name || 'B')[0]}
                      </span>
                    )}
                    {biz.business?.name || 'Business'}
                  </button>
                ))}
              </div>
              {selectedBeneficiary && (
                <p className="text-[10px] text-violet-600 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  This task will appear as posted by the business
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-2">Title</label>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.title;
                    return next;
                  });
                }
              }}
              placeholder="e.g., Need help moving a couch"
              className={inputClass('title')}
              maxLength={120}
              required
            />
            {fieldErrors.title ? <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p> : null}
            <p className="mt-1 text-xs text-app-text-secondary">{title.length}/120</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-app-text-strong">Description</label>
              <InlineDraftHelper
                mode="gig"
                seed={description}
                context={{ category, budgetHint: price ? `$${price}` : undefined }}
                compact
                onDraft={(fields) => {
                  if (fields.title) setTitle(fields.title);
                  if (fields.description) setDescription(fields.description);
                  if (fields.price) setPrice(fields.price);
                  if (fields.category) setCategory(fields.category);
                  if (fields.isUrgent) setIsUrgent(fields.isUrgent === 'true');
                  if (fields.tags) {
                    try { setTags(JSON.parse(fields.tags).join(', ')); } catch { setTags(fields.tags); }
                  }
                  if (fields.estimatedDuration) setEstimatedDur(fields.estimatedDuration);
                  if (fields.cancellationPolicy) setCancellationPolicy(fields.cancellationPolicy);
                }}
              />
            </div>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (fieldErrors.description) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.description;
                    return next;
                  });
                }
              }}
              placeholder="Describe what you need, when, where, and any important details..."
              rows={6}
              className={`${inputClass('description')} resize-none`}
              required
            />
            {fieldErrors.description ? <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p> : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-2">Location</label>
            <LocationPicker value={selectedLocation} onChange={setSelectedLocation} />
            {fieldErrors.location ? <p className="mt-1 text-xs text-red-600">{fieldErrors.location}</p> : null}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Category Dropdown */}
            <div className="relative">
              <label className="block text-sm font-medium text-app-text-strong mb-2">Category</label>
              <button
                type="button"
                onClick={() => setShowCategories(!showCategories)}
                className={`w-full flex items-center justify-between px-4 py-2 border rounded-lg bg-app-surface text-left focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  fieldErrors.category ? 'border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/40' : 'border-app-border'
                }`}
              >
                <span className={category ? 'text-app-text' : 'text-app-text-muted'}>{category || 'Select a category'}</span>
                <svg className={`w-4 h-4 text-app-text-muted transition ${showCategories ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showCategories && (
                <div className="absolute z-20 mt-1 w-full bg-app-surface border border-app-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {ALL_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setCategory(cat); setShowCategories(false); }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-app-hover transition ${
                        category === cat ? 'bg-blue-50 text-primary-600 font-semibold' : 'text-app-text-strong'
                      }`}
                    >
                      {cat}
                      {category === cat && (
                        <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {fieldErrors.category ? <p className="mt-1 text-xs text-red-600">{fieldErrors.category}</p> : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-2">Budget ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (fieldErrors.price) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.price;
                      return next;
                    });
                  }
                }}
                placeholder="50"
                className={inputClass('price')}
              />
              {fieldErrors.price ? <p className="mt-1 text-xs text-red-600">{fieldErrors.price}</p> : null}
            </div>
          </div>

          {/* Urgency Toggle */}
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-2">Urgency</label>
            <button
              type="button"
              onClick={() => setIsUrgent(!isUrgent)}
              className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border-2 text-left transition ${
                isUrgent
                  ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950'
                  : 'border-app-border hover:border-app-border'
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 transition ${
                isUrgent ? 'bg-red-600 border-red-600' : 'border-app-border'
              }`}>
                {isUrgent && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">⚡</span>
                  <span className={`text-sm font-semibold ${isUrgent ? 'text-red-600' : 'text-app-text-strong'}`}>Mark as Urgent</span>
                </div>
                <p className="text-xs text-app-text-secondary mt-1">Urgent tasks get highlighted and appear first in search results</p>
              </div>
            </button>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-2">Tags</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., plumbing, outdoor, heavy-lifting (comma-separated)"
              className={inputClass('tags')}
            />
            {tags.trim().length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag, idx) => (
                  <span key={`${tag}-${idx}`} className="text-xs text-primary-600 bg-blue-50 px-2 py-0.5 rounded-md font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-app-text-secondary">Add tags to help people find your task</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-2">Deadline date (optional)</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={inputClass('deadline')}
              />
              {fieldErrors.deadline ? <p className="mt-1 text-xs text-red-600">{fieldErrors.deadline}</p> : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-2">Add time (optional)</label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className={inputClass('deadlineTime')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-2">Estimated Duration (hours)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={estimatedDur}
                onChange={(e) => {
                  setEstimatedDur(e.target.value);
                  if (fieldErrors.estimated_duration) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.estimated_duration;
                      return next;
                    });
                  }
                }}
                placeholder="e.g., 2"
                className={inputClass('estimated_duration')}
              />
              {fieldErrors.estimated_duration ? <p className="mt-1 text-xs text-red-600">{fieldErrors.estimated_duration}</p> : null}
            </div>
          </div>

          {/* Items (for errands / pickup tasks) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-app-text-strong">Items</label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-sm text-primary-600 font-semibold hover:text-primary-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add item
              </button>
            </div>
            {items.length === 0 && (
              <p className="text-xs text-app-text-secondary">Optional: add specific items for errands or pickup tasks</p>
            )}
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="bg-app-surface-raised border border-app-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-app-text-secondary">Item {idx + 1}</span>
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                    placeholder="Item name"
                    className="w-full px-3 py-1.5 border border-app-border rounded-md text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <input
                    value={item.notes}
                    onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                    placeholder="Notes (size, brand, etc.)"
                    className="w-full px-3 py-1.5 border border-app-border rounded-md text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={item.budgetCap}
                      onChange={(e) => updateItem(idx, 'budgetCap', e.target.value)}
                      placeholder="Budget cap"
                      className="px-3 py-1.5 border border-app-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <input
                      value={item.preferredStore}
                      onChange={(e) => updateItem(idx, 'preferredStore', e.target.value)}
                      placeholder="Preferred store"
                      className="px-3 py-1.5 border border-app-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cancellation Policy */}
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-2">Cancellation Policy</label>
            <div className="space-y-2">
              {[
                { value: 'flexible', label: 'Flexible', desc: 'Free cancellation anytime before work starts.', icon: '🟢' },
                { value: 'standard', label: 'Standard', desc: 'Free within 1 hour of acceptance. 5% fee after.', icon: '🟡' },
                { value: 'strict', label: 'Strict', desc: '10% fee after acceptance. 50% after work starts.', icon: '🔴' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setCancellationPolicy(p.value)}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border-2 text-left transition ${
                    cancellationPolicy === p.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-app-border hover:border-app-border'
                  }`}
                >
                  <span className="text-lg mt-0.5">{p.icon}</span>
                  <div>
                    <p className="font-medium text-app-text text-sm">{p.label}</p>
                    <p className="text-xs text-app-text-secondary">{p.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Media Upload */}
          <FileUpload
            label="Attachments (optional)"
            accept={['image', 'video', 'document']}
            maxFiles={10}
            maxSize={100 * 1024 * 1024}
            files={mediaFiles}
            onFilesSelected={setMediaFiles}
            helperText="Upload photos, videos, or documents to help describe your task. Max 10 files."
          />

          {/* Upload progress */}
          {uploadProgress && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              {uploadProgress}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50"
            >
              {submitting ? (uploadProgress || (isEditMode ? 'Saving…' : 'Posting…')) : (isEditMode ? 'Save Changes' : 'Post Task')}
            </button>
          </div>
        </form>
        )}
      </main>
    </div>
  );
}

export default function PostTaskPage() {
  return (
    <Suspense>
      <PostTaskPageContent />
    </Suspense>
  );
}
