// ============================================================
// NeighborMessageCompose — authed container for composing (W2.6).
//
// Owns the trust-and-safety gates the design depends on:
//   * verified-only — resolves the resident's primary home tier; only a
//     verified resident (T4) sees the compose form, others get a calm
//     verify gate (the same VerifyPromptSheet that frames the Band-D
//     unlock). The backend enforces this too.
//   * recipient by address within the block — any address on your block can
//     be chosen, and the note reaches a verified household if one lives there.
//     Nothing tells the sender either way, so nobody can enumerate who's
//     verified (that would leak membership the k-anon density model hides).
//   * template-only send — picks a server template id; no free text.
//
// Mobile-web-first single column with a comfortable desktop max-width.
// ============================================================

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { ShieldCheck, Check, MapPinned } from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { ShimmerBlock } from '@/components/ui/Shimmer';
import { DetailHeader, IconTile } from '@/components/archetypes/place';
import { detailAddress } from '@/components/place/detail/sections';
import VerifyPromptSheet from '@/components/place/VerifyPromptSheet';
import NeighborMessageComposeView, { type ComposeRecipient } from './NeighborMessageComposeView';
import ChooseHomeCard, { type ChosenAddress } from './ChooseHomeCard';
import { usePrimaryHome } from '@/lib/primaryHome';
import { myHomesQuery as sharedMyHomesQuery, useHomeCenter } from '@/lib/myHomes';
import { PLACE_FRESH_MS, gatedStaleTime, placeCopyGate, useAfterRecheck } from '@/lib/householdCopy';

const REDIRECT_TO = encodeURIComponent('/app/place/neighbor-message');

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[640px]">{children}</div>;
}

function ComposeSkeleton() {
  return (
    <div className="px-4 sm:px-5 pt-3 pb-16" aria-hidden="true">
      <ShimmerBlock className="h-16 w-full rounded-2xl" />
      <ShimmerBlock className="h-12 w-full rounded-xl mt-3" />
      <div className="flex flex-col gap-2.5 mt-6">
        {[0, 1, 2, 3].map((i) => (
          <ShimmerBlock key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function NeighborMessageCompose() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [sent, setSent] = useState(false);
  // An address chosen on this screen (Choose a home). Kept in state, not the URL: a neighbor's address
  // doesn't belong in the browser's history.
  const [chosen, setChosen] = useState<ChosenAddress | null>(null);
  const [unit, setUnit] = useState('');

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !getAuthToken()) router.replace(`/login?redirectTo=${REDIRECT_TO}`);
  }, [mounted, router]);
  const authed = mounted && !!getAuthToken();

  const homeQuery = usePrimaryHome({ enabled: authed });
  const home = homeQuery.data?.home ?? null;
  const homeId = home?.id ?? null;

  const myHomesQuery = useQuery({ ...sharedMyHomesQuery(), enabled: authed && !!homeId });
  const homeCenter = useHomeCenter(authed ? homeId : null);
  const showsCopy = placeCopyGate(myHomesQuery.data?.homes.find((home) => home.id === homeId));
  const intelQuery = useQuery({
    queryKey: homeId ? queryKeys.placeIntelligence(homeId) : ['place', 'intelligence', 'none'],
    queryFn: () => api.place.getPlaceIntelligence(homeId as string),
    enabled: authed && !!homeId,
    staleTime: gatedStaleTime(PLACE_FRESH_MS, showsCopy),
  });
  // A guest's or service provider's copy is used only once the re-check answers (decision 3).
  const { data: intelligence, waiting: intelWaiting } = useAfterRecheck(intelQuery, showsCopy);

  const templatesQuery = useQuery({
    queryKey: queryKeys.neighborMessageTemplates(),
    queryFn: () => api.neighborMessages.getNeighborMessageTemplates(),
    enabled: authed,
    staleTime: 5 * 60_000,
  });

  const recipient: ComposeRecipient | null = useMemo(() => {
    if (chosen) return { address: chosen.address, relativeLabel: chosen.relativeLabel };
    const to = searchParams.get('to');
    const addr = searchParams.get('addr');
    if (!to || !addr) return null;
    return { address: addr, relativeLabel: searchParams.get('rel') || 'On your block' };
  }, [chosen, searchParams]);
  const linkedHomeId = searchParams.get('to');

  const homeAddress = home ? [home.address, home.city].filter(Boolean).join(' · ') : undefined;
  const address = intelligence ? detailAddress(intelligence.place) : homeAddress;
  const verifyAddress = intelligence?.place.label ?? homeAddress ?? '';
  const tier = intelligence?.tier;

  const sendMutation = useMutation({
    mutationFn: () =>
      api.neighborMessages.sendNeighborMessage({
        senderHomeId: homeId as string,
        ...(chosen
          ? {
              recipientAddress: {
                address: chosen.address,
                unit: unit.trim() || null,
                city: chosen.city,
                state: chosen.state,
                zipcode: chosen.zipcode,
              },
            }
          : { recipientHomeId: linkedHomeId as string }),
        templateId: selectedId as string,
      }),
    onSuccess: () => setSent(true),
  });

  // ── States ───────────────────────────────────────────────
  if (!mounted || !authed) {
    return (
      <Shell>
        <DetailHeader title="New message" backHref="/app/place" />
        <ComposeSkeleton />
      </Shell>
    );
  }

  if (homeQuery.isError) {
    return (
      <Shell>
        <DetailHeader title="New message" backHref="/app/place" />
        <div className="px-4 sm:px-5">
          <ErrorState message="We couldn't open the composer. Check your connection and try again." onRetry={() => homeQuery.refetch()} />
        </div>
      </Shell>
    );
  }

  if (homeQuery.isSuccess && !homeId) {
    return (
      <Shell>
        <DetailHeader title="New message" backHref="/app/place" />
        <div className="px-4 sm:px-5">
          <EmptyState
            icon={MapPinned}
            title="Claim your place first"
            description="Messaging neighbors is for verified residents. Add and verify your address to unlock it."
            actionLabel="Add your place"
            onAction={() => router.push('/app/homes')}
          />
        </div>
      </Shell>
    );
  }

  if (homeQuery.isPending || intelQuery.isPending || intelWaiting || templatesQuery.isPending) {
    return (
      <Shell>
        <DetailHeader title="New message" address={address} backHref="/app/place" />
        <ComposeSkeleton />
      </Shell>
    );
  }

  // Sent confirmation — calm, then back to Place.
  if (sent) {
    return (
      <Shell>
        <DetailHeader title="Message sent" backHref="/app/place" />
        <div className="px-4 sm:px-5 pt-6">
          <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-5 flex flex-col items-center text-center">
            <IconTile icon={Check} tone="home" size={48} />
            <h2 className="text-lg font-bold text-app-text mt-3 -tracking-[0.01em]">Sent anonymously</h2>
            <p className="text-[13.5px] text-app-text-secondary mt-1.5 leading-[19px] max-w-[32ch]">
              If a verified household lives there, they&apos;ll get it as &ldquo;from a verified neighbor nearby&rdquo; —
              never your name or address.
            </p>
            <button
              type="button"
              onClick={() => router.push('/app/place')}
              className="mt-5 h-11 px-5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-[15px] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // Verified-only gate — only T4 may compose.
  if (tier !== 'T4') {
    return (
      <Shell>
        <DetailHeader title="New message" address={address} backHref="/app/place" />
        <div className="px-4 sm:px-5 pt-6">
          <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-5 flex flex-col items-center text-center">
            <IconTile icon={ShieldCheck} tone="home" size={48} />
            <h2 className="text-lg font-bold text-app-text mt-3 -tracking-[0.01em]">Verify to message neighbors</h2>
            <p className="text-[13.5px] text-app-text-secondary mt-1.5 leading-[19px] max-w-[30ch]">
              Neighbor messaging is for verified residents only — it&apos;s what keeps the channel safe and trusted.
              Verify your address to unlock it.
            </p>
            <button
              type="button"
              onClick={() => setVerifyOpen(true)}
              className="mt-5 h-11 px-5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-[15px] inline-flex items-center gap-2 transition-colors"
            >
              <ShieldCheck size={17} strokeWidth={2.25} /> Verify your address
            </button>
          </div>
        </div>
        {homeId ? (
          <VerifyPromptSheet open={verifyOpen} onClose={() => setVerifyOpen(false)} homeId={homeId} address={verifyAddress} />
        ) : null}
      </Shell>
    );
  }

  return (
    <Shell>
      <NeighborMessageComposeView
        templates={templatesQuery.data?.templates ?? []}
        recipient={recipient}
        unit={chosen ? unit : undefined}
        onUnitChange={setUnit}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onSend={() => sendMutation.mutate()}
        onChangeRecipient={() => {
          if (sendMutation.isPending) return;
          if (chosen) {
            setChosen(null);
            setUnit('');
            sendMutation.reset();
          } else {
            router.back();
          }
        }}
        chooser={homeId ? (
          <ChooseHomeCard
            senderHomeId={homeId}
            near={homeCenter}
            onChoose={(address) => {
              setChosen(address);
              sendMutation.reset();
            }}
          />
        ) : null}
        sending={sendMutation.isPending}
        errorMessage={
          sendMutation.isError
            ? (sendMutation.error as { message?: string })?.message ||
              'We couldn’t send that message. Please try again.'
            : null
        }
      />
    </Shell>
  );
}
