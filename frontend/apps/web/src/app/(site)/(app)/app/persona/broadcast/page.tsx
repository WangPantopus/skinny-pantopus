'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Copy, ExternalLink, Eye, Globe, ImageIcon, Megaphone, RefreshCw, Send, Sparkles, Users, Video, X } from 'lucide-react';
import * as api from '@pantopus/api';
import type { AudienceProfile, BroadcastAnalyticsSummary, BroadcastChannel, BroadcastMessage } from '@pantopus/types';
import type { MembershipStats } from '@pantopus/api';
import BroadcastMessageContent from '@/components/audience/BroadcastMessageContent';
import { toast } from '@/components/ui/toast-store';
import { trackIdentityEvent } from '@/lib/identityAnalytics';
import { identityCopy } from '@/lib/identityLabels';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';

const BODY_LIMIT = 5000;

// P1.10 — composer visibility selector. The dropdown's logical values
// map to (visibility, target_tier_rank) on submit. Audience-profile
// §11.3: live counts shown next to each option so the creator knows
// what they're committing to before clicking Post.
type ComposerVisibility = 'public' | 'followers' | 'members' | 'insiders';

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: ComposerVisibility;
  label: string;
  icon: typeof Globe;
  visibility: 'public' | 'followers' | 'tier_or_above';
  targetTierRank: number | null;
}> = [
  { value: 'public',    label: 'Public',    icon: Globe, visibility: 'public',        targetTierRank: null },
  { value: 'followers', label: 'Followers', icon: Users, visibility: 'followers',     targetTierRank: null },
  { value: 'members',   label: 'Members',   icon: Sparkles, visibility: 'tier_or_above', targetTierRank: 2 },
  { value: 'insiders',  label: 'Insiders',  icon: Sparkles, visibility: 'tier_or_above', targetTierRank: 3 },
];

function formatRelative(dateInput: string | Date) {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function PersonaBroadcastPage() {
  const router = useRouter();
  // P2.5: when the audience_profile flag is on this page is superseded
  // by /app/audience?tab=updates (which mounts AudienceComposer +
  // BroadcastTimeline). Redirect once the flag check resolves so old
  // deep links land users in the new shell instead of two parallel
  // composers. Flag-off users still see the legacy page below.
  const audienceFlag = useFeatureFlagState('audience_profile');
  useEffect(() => {
    if (audienceFlag.isFetched && audienceFlag.enabled) {
      router.replace('/app/audience?tab=updates');
    }
  }, [audienceFlag.isFetched, audienceFlag.enabled, router]);

  const [persona, setPersona] = useState<AudienceProfile | null>(null);
  const [channel, setChannel] = useState<BroadcastChannel | null>(null);
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [analytics, setAnalytics] = useState<BroadcastAnalyticsSummary | null>(null);
  const [body, setBody] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<ComposerVisibility>('followers');
  const [stats, setStats] = useState<MembershipStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadBroadcast = useCallback(() => {
    let mounted = true;
    setLoading(true);
    setLoadError('');
    api.personas.getMyPersona()
      .then(async (res) => {
        if (!mounted) return;
        setPersona(res.persona);
        setChannel(res.channel);
        if (res.channel?.id) {
          const messagesRes = await api.broadcast.getBroadcastMessages(res.channel.id);
          if (mounted) {
            setMessages(messagesRes.messages || []);
            setAnalytics(messagesRes.analytics || null);
          }
        }
        // P1.10 — fetch membership-stats once we know the persona id
        // so the tier-visibility selector can show live reach counts.
        // Non-fatal on error; the dropdown falls back to "—" labels.
        if (res.persona?.id) {
          try {
            const statsRes = await api.personas.getMembershipStats(res.persona.id);
            if (mounted) setStats(statsRes.counts);
          } catch {
            if (mounted) setStats(null);
          }
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load updates.');
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => loadBroadcast(), [loadBroadcast]);

  const selectedOption = VISIBILITY_OPTIONS.find((o) => o.value === visibility) ?? VISIBILITY_OPTIONS[1];
  const reachLabel = (option: typeof VISIBILITY_OPTIONS[number]): string => {
    if (!stats) return '';
    if (option.value === 'public') return 'Public';
    if (option.value === 'followers') return `${stats.followers.toLocaleString()} reach`;
    if (option.value === 'members')   return `${stats.members.toLocaleString()} reach`;
    if (option.value === 'insiders')  return `${stats.insiders.toLocaleString()} reach`;
    return '';
  };

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files) return;
    const media = Array.from(files)
      .filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    setMediaFiles((prev) => [...prev, ...media].slice(0, 9));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const publish = async () => {
    if (!channel || !body.trim()) return;
    setPublishing(true);
    setError('');
    try {
      const payload: {
        body: string;
        visibility: typeof selectedOption.visibility;
        target_tier_rank?: number;
      } = {
        body: body.trim(),
        visibility: selectedOption.visibility,
      };
      if (selectedOption.targetTierRank !== null) {
        payload.target_tier_rank = selectedOption.targetTierRank;
      }
      const res = await api.broadcast.publishBroadcastMessage(channel.id, payload);
      let postedMessage = res.message;
      if (mediaFiles.length > 0) {
        try {
          const upload = await api.upload.uploadPostMedia(postedMessage.id, mediaFiles);
          postedMessage = {
            ...postedMessage,
            media: upload.media_urls.map((url: string, index: number) => ({
              url,
              type: upload.media_types[index] || 'image',
            })),
          };
        } catch {
          setError('Update posted, but some media failed to upload.');
        }
      }
      trackIdentityEvent('identity_update_published', {
        visibility: selectedOption.visibility,
        targetTierRank: selectedOption.targetTierRank,
        bodyLength: body.trim().length,
        mediaCount: mediaFiles.length,
        hasPublicProfile: Boolean(persona),
      });
      setMessages((prev) => [postedMessage, ...prev]);
      setAnalytics((prev) => ({
        deliveredCount: Number(prev?.deliveredCount || 0) + Number(postedMessage.delivered_count || 0),
        readCount: Number(prev?.readCount || 0) + Number(postedMessage.read_count || 0),
      }));
      setBody('');
      setMediaFiles([]);
      toast.success('Update posted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post update.');
    } finally {
      setPublishing(false);
    }
  };

  const publicUrl = persona
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://pantopus.com'}/@${persona.handle}`
    : '';

  const copyPublicLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Beacon link copied');
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error('Could not copy link');
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-app">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-app bg-surface p-10 text-center text-app-secondary">
            <RefreshCw className="mx-auto h-5 w-5 animate-spin" />
            <p className="mt-3 text-sm">Loading updates...</p>
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-app">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <AlertCircle className="mb-3 h-6 w-6" />
            <h1 className="text-lg font-semibold">Updates could not load</h1>
            <p className="mt-2 text-sm">{loadError}</p>
            <button
              type="button"
              onClick={loadBroadcast}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!persona || !channel) {
    return (
      <main className="min-h-screen bg-app">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-2xl border border-app bg-surface p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <Megaphone className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-app">Create a Beacon first</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-app-secondary">
              Updates are one-way posts from your Beacon. They do not open direct chat to your private account.
            </p>
            <Link
              href="/app/persona"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
            >
              <Sparkles className="h-4 w-4" />
              Set up Beacon
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const updateCount = messages.length;
  const deliveredTotal = Number(analytics?.deliveredCount ?? sumMessageCount(messages, 'delivered_count'));
  const readTotal = Number(analytics?.readCount ?? sumMessageCount(messages, 'read_count'));
  const audienceLabel = String(persona.audienceLabel || 'followers').toLowerCase();
  const charsLeft = BODY_LIMIT - body.length;
  const charLow = charsLeft < 240;
  const canPost = body.trim().length > 0 && !publishing;

  return (
    <main className="min-h-screen bg-app">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Heading row */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-app">{identityCopy.updates}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyPublicLink}
              className="inline-flex items-center gap-1.5 rounded-full border border-app bg-surface px-3 py-1.5 text-xs font-semibold text-app transition hover:bg-surface-muted"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
            <Link
              href={`/@${persona.handle}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-app bg-surface px-3 py-1.5 text-xs font-semibold text-app transition hover:bg-surface-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Beacon
            </Link>
          </div>
        </div>

        {/* Identity strip — context not chrome */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-app bg-surface px-4 py-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-50 text-sm font-semibold text-primary-700">
            {persona.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={persona.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              persona.displayName.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-app">{persona.displayName}</p>
            <p className="truncate text-xs text-app-secondary">@{persona.handle} · posting one-way to your {audienceLabel}</p>
          </div>
        </div>

        {/* Composer — the centerpiece */}
        <section className="rounded-2xl border border-app bg-surface shadow-sm">
          {/* Visibility selector */}
          <div className="flex flex-wrap items-center gap-2 border-b border-app px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-app-secondary">Visible to</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Update visibility">
              {VISIBILITY_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = visibility === option.value;
                const reach = reachLabel(option);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setVisibility(option.value)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'border border-app bg-surface text-app-secondary hover:bg-surface-muted'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                    {reach && option.value !== 'public' ? (
                      <span className={`text-[10px] font-medium ${active ? 'text-white/80' : 'text-app-muted'}`}>
                        {reach}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Textarea */}
          <div className="px-5 pt-4">
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                if (error) setError('');
              }}
              rows={6}
              maxLength={BODY_LIMIT + 100}
              className="w-full resize-none border-0 bg-transparent p-0 text-app outline-none placeholder:text-app-muted"
              placeholder="Write an update for your followers..."
            />
          </div>

          {mediaFiles.length > 0 ? (
            <div className="mx-5 mt-3 grid gap-2 sm:grid-cols-2">
              {mediaFiles.map((file, index) => {
                const isVideo = file.type.startsWith('video/');
                return (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-app bg-surface-muted px-3 py-2">
                    {isVideo ? <Video className="h-4 w-4 shrink-0 text-primary-700" /> : <ImageIcon className="h-4 w-4 shrink-0 text-primary-700" />}
                    <span className="min-w-0 flex-1 truncate text-xs text-app-secondary">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setMediaFiles((prev) => prev.filter((_, i) => i !== index))}
                      className="rounded-full p-1 text-app-muted hover:bg-surface hover:text-app"
                      aria-label="Remove media"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {visibility === 'public' && (
            <div className="mx-5 mt-1 inline-flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Anyone with the link can see this update.</span>
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-app px-5 py-3">
            <span className={`text-xs font-medium ${charLow ? 'text-amber-600' : 'text-app-muted'}`}>
              {charsLeft.toLocaleString()} left
            </span>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(event) => handleFilesSelected(event.currentTarget.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={mediaFiles.length >= 9 || publishing}
                className="inline-flex items-center gap-2 rounded-xl border border-app bg-surface px-3 py-2 text-sm font-semibold text-app transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImageIcon className="h-4 w-4" />
                Media
                {mediaFiles.length > 0 ? <span className="text-xs text-app-muted">{mediaFiles.length}/9</span> : null}
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={!canPost}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-app-muted disabled:shadow-none"
              >
                {publishing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {publishing ? 'Posting...' : 'Post update'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-5 mb-4 inline-flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Quiet stats line */}
        <div className="mt-5 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-sm">
          <Stat value={updateCount} label={updateCount === 1 ? 'Update' : 'Updates'} />
          <span className="text-app-muted">·</span>
          <Stat value={deliveredTotal} label="Delivered" />
          <span className="text-app-muted">·</span>
          <Stat value={readTotal} label="Reads" />
        </div>

        {/* Recent updates */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-app-secondary">Recent updates</h2>
            {messages.length > 0 ? (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-app-secondary">{messages.length}</span>
            ) : null}
          </div>
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-app bg-surface p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <Megaphone className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-app">No updates yet</p>
              <p className="mt-1 text-sm text-app-secondary">Post your first update — your followers will see it instantly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <UpdateCard key={message.id} message={message} fresh={index === 0} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function sumMessageCount(messages: BroadcastMessage[], key: 'delivered_count' | 'read_count') {
  return messages.reduce((sum, message) => sum + Number(message[key] || 0), 0);
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-semibold text-app">{Number(value || 0).toLocaleString()}</span>
      <span className="text-app-secondary">{label}</span>
    </span>
  );
}

function UpdateCard({ message, fresh }: { message: BroadcastMessage; fresh: boolean }) {
  const visibility = String(message.visibility || 'followers');
  const isPublic = visibility === 'public';
  return (
    <article
      className={`rounded-2xl border bg-surface p-5 transition ${
        fresh ? 'border-primary-200 shadow-sm' : 'border-app'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isPublic
              ? 'bg-amber-50 text-amber-800'
              : 'bg-primary-50 text-primary-700'
          }`}
        >
          {isPublic ? <Globe className="h-3 w-3" /> : <Users className="h-3 w-3" />}
          {isPublic ? 'Public' : visibility === 'tier_or_above' ? 'Members' : 'Followers'}
        </span>
        <span className="text-xs text-app-secondary">{formatRelative(message.created_at)}</span>
      </div>
      <BroadcastMessageContent message={message} />
      <div className="mt-4 flex items-center gap-4 border-t border-app pt-3 text-xs text-app-secondary">
        <span className="inline-flex items-center gap-1">
          <Send className="h-3 w-3" />
          {Number(message.delivered_count || 0).toLocaleString()} delivered
        </span>
        <span className="inline-flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {Number(message.read_count || 0).toLocaleString()} reads
        </span>
      </div>
    </article>
  );
}
