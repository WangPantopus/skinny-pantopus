// ============================================================
// FridgeCardLeaf — compose, issue, and manage the household's
// 911-ready fridge cards (Wave 1, #2). Reached from Risk & readiness.
//
// Composer stance: the address block is server-derived; everything
// else is typed by the household because only they know it — but we
// derive passively where we can (shutoffs pre-seed from the home's
// existing emergency info) so the card starts half-full, not blank.
// Issuing FREEZES the card; edits mean issuing a fresh card and
// revoking the old one, which is exactly the safety model we want for
// a printout that lives on a fridge.
// ============================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { FridgeCard, FridgeCardItem, FridgeCardSection, FridgeCardSectionKey } from '@pantopus/api';
import { Users, Cross, PawPrint, Wrench, Phone, StickyNote, Plus, X, Loader2, Copy, Eye, Ban, ExternalLink, HeartPulse } from 'lucide-react';
import Chip from '@/components/archetypes/primitives/Chip';
import { DetailHeader, DetailSectionLabel, InfoNote } from '@/components/archetypes/place';
import { toast } from '@/components/ui/toast-store';
import { queryKeys } from '@/lib/query-keys';

const SECTION_DEFS: { key: FridgeCardSectionKey; title: string; icon: typeof Users; placeholder: { label: string; note: string } }[] = [
  { key: 'household', title: 'Household', icon: Users, placeholder: { label: 'Mia (6)', note: 'Peanut allergy — EpiPen in the pantry' } },
  { key: 'medical', title: 'Medical', icon: Cross, placeholder: { label: 'Dana', note: 'Type 1 diabetic — insulin in fridge door' } },
  { key: 'pets', title: 'Pets', icon: PawPrint, placeholder: { label: 'Biscuit', note: 'Golden retriever, friendly' } },
  { key: 'utilities', title: 'Shutoffs & utilities', icon: Wrench, placeholder: { label: 'Gas shutoff', note: 'Left side of the house' } },
  { key: 'contacts', title: 'Emergency contacts', icon: Phone, placeholder: { label: 'Grandma Ana', note: '503-555-0101' } },
  { key: 'notes', title: 'Notes', icon: StickyNote, placeholder: { label: 'Spare key', note: 'Lockbox by the side gate — ask us for the code' } },
];

type Draft = Record<FridgeCardSectionKey, FridgeCardItem[]>;

const EMPTY_DRAFT: Draft = { household: [], medical: [], pets: [], utilities: [], contacts: [], notes: [] };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── One issued card ──────────────────────────────────────────
function IssuedCardRow({ card, homeId }: { card: FridgeCard; homeId: string }) {
  const queryClient = useQueryClient();
  const revoked = card.status === 'revoked';

  const revokeMutation = useMutation({
    mutationFn: () => api.fridgeCards.revokeFridgeCard(homeId, card.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fridgeCards(homeId) });
      toast.success('Card revoked. Its link now shows “no longer active” and none of its content.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not revoke the card.'),
  });

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(card.card_url);
      toast.success('Card link copied.');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  return (
    <div className={`bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 ${revoked ? 'opacity-75' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[14.5px] font-bold text-app-text">{card.label || 'Fridge card'}</span>
        <Chip label={revoked ? 'Revoked' : 'Active'} variant={revoked ? 'warning' : 'success'} />
      </div>
      <div className="flex items-center gap-3 text-[12px] text-app-text-muted mt-1">
        <span>{fmtDate(card.issued_at)}</span>
        <span className="inline-flex items-center gap-1">
          <Eye size={12} strokeWidth={2.25} />
          {card.view_count === 0 ? 'Not opened yet' : `Opened ${card.view_count} ${card.view_count === 1 ? 'time' : 'times'}`}
        </span>
      </div>
      {!revoked && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-app-border-subtle">
          <button
            type="button"
            onClick={onCopy}
            className="flex-1 h-10 rounded-[10px] bg-primary-600 text-white text-[13.5px] font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-700 transition"
          >
            <Copy size={15} strokeWidth={2.25} /> Copy link
          </button>
          <a
            href={card.card_url}
            target="_blank"
            rel="noreferrer"
            className="h-10 px-3.5 rounded-[10px] border-[1.5px] border-app-border bg-app-surface text-app-text text-[13.5px] font-semibold flex items-center justify-center gap-1.5 hover:bg-app-hover transition"
          >
            <ExternalLink size={15} strokeWidth={2} /> Open &amp; print
          </a>
          <button
            type="button"
            onClick={() => revokeMutation.mutate()}
            disabled={revokeMutation.isPending}
            className="h-10 px-3.5 rounded-[10px] border-[1.5px] border-app-border bg-app-surface text-app-error text-[13.5px] font-semibold flex items-center justify-center gap-1.5 hover:bg-app-error-light/40 transition disabled:opacity-50"
          >
            <Ban size={15} strokeWidth={2} /> Revoke
          </button>
        </div>
      )}
    </div>
  );
}

// ── Section editor ───────────────────────────────────────────
function SectionEditor({
  def, items, onChange,
}: {
  def: (typeof SECTION_DEFS)[number];
  items: FridgeCardItem[];
  onChange: (items: FridgeCardItem[]) => void;
}) {
  const Icon = def.icon;
  const setItem = (i: number, patch: Partial<FridgeCardItem>) =>
    onChange(items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-app-text-muted flex items-center gap-1.5">
          <Icon size={13} strokeWidth={2.5} /> {def.title}
        </span>
        <button
          type="button"
          onClick={() => onChange([...items, { label: '', note: '' }])}
          disabled={items.length >= 12}
          className="h-8 px-2.5 rounded-[8px] border-[1.5px] border-app-border text-app-text-secondary text-[12.5px] font-semibold flex items-center gap-1 hover:bg-app-hover transition disabled:opacity-50"
        >
          <Plus size={13} strokeWidth={2.5} /> Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-col gap-2 mt-3">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                value={item.label}
                onChange={(e) => setItem(i, { label: e.target.value })}
                maxLength={80}
                placeholder={def.placeholder.label}
                aria-label={`${def.title} — who or what`}
                className="w-[38%] h-[42px] px-3 text-[14px] text-app-text bg-app-surface border-[1.5px] border-app-border rounded-[10px] outline-none transition focus:border-primary-600 placeholder:text-app-text-muted"
              />
              <input
                value={item.note}
                onChange={(e) => setItem(i, { note: e.target.value })}
                maxLength={160}
                placeholder={def.placeholder.note}
                aria-label={`${def.title} — the detail`}
                className="flex-1 h-[42px] px-3 text-[14px] text-app-text bg-app-surface border-[1.5px] border-app-border rounded-[10px] outline-none transition focus:border-primary-600 placeholder:text-app-text-muted"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${def.title} item`}
                className="w-[42px] h-[42px] rounded-[10px] border-[1.5px] border-app-border text-app-text-muted flex items-center justify-center hover:bg-app-hover transition shrink-0"
              >
                <X size={15} strokeWidth={2.25} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── The leaf ─────────────────────────────────────────────────
export default function FridgeCardLeaf({ homeId, address, onBack }: { homeId: string; address: string; onBack: () => void }) {
  const [label, setLabel] = useState('');
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const queryClient = useQueryClient();

  const cardsQuery = useQuery({
    queryKey: queryKeys.fridgeCards(homeId),
    queryFn: () => api.fridgeCards.listFridgeCards(homeId),
  });

  // Passive derivation: the home's existing emergency info (gas/water
  // shutoffs…) pre-seeds the utilities section. The seed applies in an
  // effect off the query DATA, never inside the queryFn — a cached
  // query skips its queryFn on remount, which would silently skip the
  // seed; the effect fires either way and only fills an empty section.
  //
  // Its key lives OUTSIDE the fridgeCards prefix: issue/revoke
  // invalidate that prefix, and a prefix-matched seed refetch used to
  // re-fill a utilities section the person had deliberately emptied.
  // The ref makes the seed strictly once-per-mount either way.
  const emergenciesQuery = useQuery({
    queryKey: ['place', 'fridge-card-seed', homeId],
    queryFn: () => api.homeProfile.getHomeEmergencies(homeId),
    staleTime: Infinity,
  });
  const emergencies = emergenciesQuery.data?.emergencies;
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const rows = (emergencies || []) as { label?: string; location_in_home?: string; location?: string }[];
    if (!rows.length) return;
    seededRef.current = true;
    setDraft((d) => (d.utilities.length ? d : {
      ...d,
      utilities: rows
        .map((r) => ({ label: String(r.label || ''), note: String(r.location_in_home || r.location || '') }))
        .filter((r) => r.label)
        .slice(0, 12),
    }));
  }, [emergencies]);

  const issueMutation = useMutation({
    mutationFn: () => {
      const sections: FridgeCardSection[] = SECTION_DEFS
        .map((def) => ({ key: def.key, items: draft[def.key].filter((i) => i.label.trim() || i.note.trim()) }))
        .filter((s) => s.items.length > 0);
      return api.fridgeCards.issueFridgeCard(homeId, sections, label.trim() || undefined);
    },
    onSuccess: async (card) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fridgeCards(homeId) });
      toast.success('Card issued — open it to print for the fridge.');
      try {
        await navigator.clipboard.writeText(card.card_url);
        toast.success('Card link copied.');
      } catch {
        /* the card row's Copy button is the retry path */
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not issue the card. Try again.'),
  });

  const hasContent = SECTION_DEFS.some((def) => draft[def.key].some((i) => i.label.trim() || i.note.trim()));
  const cards = cardsQuery.data ?? [];

  return (
    <>
      <DetailHeader title="Fridge card" address={address} onBack={onBack} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        <InfoNote>
          Everything a babysitter or house-sitter needs to say on a 911 call — starting with your exact address, which the card always shows. It&apos;s read by people you hand it to; it is not delivered to 911 dispatch.
        </InfoNote>

        <DetailSectionLabel>Card name</DetailSectionLabel>
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            placeholder="e.g. Sitter card"
            aria-label="Card name"
            className="w-full h-[46px] px-3.5 text-[15px] text-app-text bg-app-surface border-[1.5px] border-app-border rounded-[10px] outline-none transition focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10 placeholder:text-app-text-muted"
          />
        </div>

        <DetailSectionLabel>What goes on it</DetailSectionLabel>
        <div className="flex flex-col gap-2.5">
          {SECTION_DEFS.map((def) => (
            <SectionEditor
              key={def.key}
              def={def}
              items={draft[def.key]}
              onChange={(items) => setDraft((d) => ({ ...d, [def.key]: items }))}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => issueMutation.mutate()}
          disabled={issueMutation.isPending || !hasContent}
          className="w-full h-12 mt-4 rounded-xl bg-primary-600 text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(2,132,199,0.22)] hover:bg-primary-700 transition disabled:opacity-60"
        >
          {issueMutation.isPending
            ? (<><Loader2 size={18} className="animate-spin" /> Issuing…</>)
            : (<><HeartPulse size={18} strokeWidth={2.25} /> Issue card &amp; copy link</>)}
        </button>
        <InfoNote>
          Issuing freezes the card exactly as previewed here — so you always know what a printout says. To change it later, issue a fresh card and revoke the old one; revoking pulls all of its content immediately.
        </InfoNote>

        {(cards.length > 0 || cardsQuery.isLoading) && (
          <>
            <DetailSectionLabel>This home&apos;s cards</DetailSectionLabel>
            {cardsQuery.isLoading ? (
              <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-[13.5px] text-app-text-muted">Loading cards…</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {cards.map((card) => (
                  <IssuedCardRow key={card.id} card={card} homeId={homeId} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
