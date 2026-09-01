// ============================================================
// Place — Identity detail (C9). Verification status + SERVER-ATTESTED
// residency letters (Phase 1, #11): set a purpose, preview, then issue.
// The backend freezes the printed facts + the exact PDF and prints an
// unguessable verification code on the letter — anyone holding it can
// check it at /verify-residency/[code]. Letters can be downloaded
// (the exact issued PDF), mailed to your mailbox, and revoked.
//
// Identity has no launch-set contract section, so this reads the
// verified tier from the intelligence + the resident's name/home.
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { ResidencyLetter } from '@pantopus/api';
import type { PlaceIntelligence } from '@pantopus/types';
import { BadgeCheck, Check, FileText, ScanFace, Mailbox, Download, ChevronRight, LayoutDashboard, ShieldCheck, Ban, Loader2 } from 'lucide-react';
import Chip from '@/components/archetypes/primitives/Chip';
import { LockedCard, DetailHeader, DetailSectionLabel, SourceNote, InfoNote } from '@/components/archetypes/place';
import { toast } from '@/components/ui/toast-store';
import { queryKeys } from '@/lib/query-keys';
import { detailAddress } from './sections';

function issueDate(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

interface LetterFacts {
  name: string;
  line1: string;
  cityStateZip: string;
  purpose: string;
}

function letterPurpose(purpose: string): string {
  const p = purpose.trim();
  return p || 'General verification of residency';
}

// Plain-text body for "Mail a copy" — mirrors the issued letter,
// including the verification code so the mailed copy is checkable too.
function letterPlainText(letter: ResidencyLetter): string {
  const cityZip = [[letter.address.city, letter.address.state].filter(Boolean).join(', '), letter.address.zipcode]
    .filter(Boolean)
    .join(' ');
  return [
    fmtDate(letter.issued_at),
    '',
    'To whom it may concern,',
    '',
    `This letter certifies that ${letter.resident_name} is a verified resident of the address below, confirmed through the Pantopus address-verification process.`,
    '',
    'Verified address:',
    letter.address.line1,
    cityZip,
    '',
    `Issued for: ${letter.purpose}`,
    '',
    `Verify this letter — code ${letter.letter_code}`,
    letter.verify_url,
  ].join('\n');
}

// Browser-side download of the exact issued PDF.
async function downloadLetterPdf(homeId: string, letter: ResidencyLetter): Promise<void> {
  const blob = await api.residencyLetters.getResidencyLetterPdf(homeId, letter.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pantopus-residency-letter-${letter.id.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Verification status — the green badge ───────────────────
function VerifiedStatus({ name, address }: { name: string; address: string }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
      <div className="flex items-center gap-3.5">
        <span className="w-14 h-14 rounded-2xl bg-app-home-bg border border-app-success-light flex items-center justify-center shrink-0">
          <BadgeCheck size={30} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[18px] font-bold -tracking-[0.015em] text-app-text">Verified resident</span>
            <Chip label="Active" variant="success" icon={Check} />
          </div>
          <div className="text-[13.5px] text-app-text-secondary mt-0.5 truncate">{[name, address].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div className="text-[13px] text-app-text-strong leading-5 mt-[15px] pt-[15px] border-t border-app-border-subtle">
        Your address is verified through Pantopus. You can generate a residency letter from it below.
      </div>
    </div>
  );
}

// ── Letter preview — product-UI, sans-serif (not ceremonial) ──
function LetterPreview({ facts }: { facts: LetterFacts }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-[14px] shadow-md overflow-hidden">
      <div className="px-5 py-4 border-b border-app-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-[26px] h-[26px] rounded-[7px] bg-primary-600 flex items-center justify-center">
            <LayoutDashboard size={15} strokeWidth={2.25} className="text-white" />
          </span>
          <span className="text-[15px] font-bold text-app-text -tracking-[0.01em]">Pantopus</span>
        </div>
        <span className="text-[10.5px] font-semibold tracking-[0.06em] uppercase text-app-text-muted">Verified residency</span>
      </div>
      <div className="px-5 pt-[18px] pb-5">
        <div className="text-[11px] text-app-text-muted">{issueDate()}</div>
        <div className="text-[15px] font-bold text-app-text mt-3 -tracking-[0.01em]">To whom it may concern,</div>
        <div className="text-[13.5px] text-app-text-strong leading-[21px] mt-2">
          This letter certifies that <span className="font-bold text-app-text">{facts.name || 'the resident named on this account'}</span> is a verified resident of the address below, confirmed through the Pantopus address-verification process.
        </div>
        <div className="mt-3.5 px-3.5 py-3 bg-app-surface-muted border border-app-border-subtle rounded-[11px]">
          <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-app-text-muted mb-1">Verified address</div>
          <div className="text-[14.5px] font-semibold text-app-text leading-5">{facts.line1}<br />{facts.cityStateZip}</div>
        </div>
        <div className="mt-3 text-[13.5px] text-app-text-strong leading-[21px]">
          <span className="text-app-text-muted">Issued for: </span>
          <span className="font-semibold text-app-text">{letterPurpose(facts.purpose)}</span>
        </div>
        <div className="mt-3.5 px-3.5 py-3 bg-app-surface-muted border border-dashed border-app-border-strong rounded-[11px]">
          <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-app-text-muted mb-1">Verify this letter</div>
          <div className="text-[13px] text-app-text-secondary leading-[19px]">
            A unique verification code is printed here when the letter is issued — anyone you hand it to can confirm it&apos;s genuine.
          </div>
        </div>
        <div className="flex items-center gap-3 mt-[18px] pt-3.5 border-t border-dashed border-app-border-strong">
          <span className="w-[38px] h-[38px] rounded-[9px] bg-app-home-bg border border-app-success-light flex items-center justify-center shrink-0">
            <BadgeCheck size={20} strokeWidth={2} className="text-app-home" />
          </span>
          <div className="text-[12.5px] font-bold text-app-success">Address verified through Pantopus</div>
        </div>
      </div>
    </div>
  );
}

// ── One issued letter — code, status, actions ────────────────
function IssuedLetterCard({ letter, homeId }: { letter: ResidencyLetter; homeId: string }) {
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState(false);
  const [mailing, setMailing] = useState(false);
  const revoked = letter.status === 'revoked';

  const revokeMutation = useMutation({
    mutationFn: () => api.residencyLetters.revokeResidencyLetter(homeId, letter.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residencyLetters(homeId) });
      toast.success('Letter revoked. Its verification code no longer checks out as active.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not revoke the letter.'),
  });

  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadLetterPdf(homeId, letter);
    } catch {
      toast.error('Could not download the letter. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  const onMail = async () => {
    setMailing(true);
    try {
      await api.mailCompose.sendComposedMail({
        destination: { deliveryTargetType: 'home', homeId, attnLabel: 'Current Resident', visibility: 'home_members' },
        envelope: { type: 'letter', subject: 'Verified residency letter' },
        object: {
          format: 'mailjson_v1',
          mimeType: 'application/json',
          title: 'Verified residency letter',
          content: letterPlainText(letter),
          payload: { bodyFormat: 'plain_text' },
        },
        tracking: { source: 'place_identity_residency_letter_web' },
      });
      toast.success('A copy is on its way through your mailbox.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We couldn’t mail your letter. Try again.');
    } finally {
      setMailing(false);
    }
  };

  return (
    <div className={`bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 ${revoked ? 'opacity-75' : ''}`}>
      <div className="flex items-center gap-3">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${revoked ? 'bg-app-surface-sunken' : 'bg-primary-100'}`}>
          <FileText size={20} strokeWidth={2} className={revoked ? 'text-app-text-muted' : 'text-primary-600'} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold text-app-text font-mono tracking-[0.02em]">{letter.letter_code}</span>
            <Chip label={revoked ? 'Revoked' : 'Active'} variant={revoked ? 'warning' : 'success'} />
          </div>
          <div className="text-[12.5px] text-app-text-muted mt-0.5 truncate">
            {fmtDate(letter.issued_at)} · {letter.purpose}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-app-border-subtle">
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="flex-1 h-10 rounded-[10px] bg-primary-600 text-white text-[13.5px] font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-700 transition disabled:opacity-60"
        >
          {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} strokeWidth={2.25} />} PDF
        </button>
        <button
          type="button"
          onClick={onMail}
          disabled={mailing || revoked}
          className="flex-1 h-10 rounded-[10px] border-[1.5px] border-app-border bg-app-surface text-app-text text-[13.5px] font-semibold flex items-center justify-center gap-1.5 hover:bg-app-hover transition disabled:opacity-50"
        >
          <Mailbox size={15} strokeWidth={2} /> {mailing ? 'Sending…' : 'Mail'}
        </button>
        {!revoked && (
          <button
            type="button"
            onClick={() => revokeMutation.mutate()}
            disabled={revokeMutation.isPending}
            className="h-10 px-3.5 rounded-[10px] border-[1.5px] border-app-border bg-app-surface text-app-error text-[13.5px] font-semibold flex items-center justify-center gap-1.5 hover:bg-app-error-light/40 transition disabled:opacity-50"
          >
            <Ban size={15} strokeWidth={2} /> Revoke
          </button>
        )}
      </div>
    </div>
  );
}

function ResidencyLetterLeaf({ facts, homeId, address, onBack }: { facts: Omit<LetterFacts, 'purpose'>; homeId: string; address: string; onBack: () => void }) {
  const [purpose, setPurpose] = useState('');
  const queryClient = useQueryClient();
  const fullFacts: LetterFacts = { ...facts, purpose };

  const lettersQuery = useQuery({
    queryKey: queryKeys.residencyLetters(homeId),
    queryFn: () => api.residencyLetters.listResidencyLetters(homeId),
  });

  const issueMutation = useMutation({
    mutationFn: () => api.residencyLetters.issueResidencyLetter(homeId, purpose),
    onSuccess: async (letter) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residencyLetters(homeId) });
      setPurpose('');
      toast.success(`Letter issued — verification code ${letter.letter_code}.`);
      // Hand the PDF over immediately; the card below offers it again.
      try {
        await downloadLetterPdf(homeId, letter);
      } catch {
        /* the issued card's PDF button is the retry path */
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not issue the letter. Try again.'),
  });

  const letters = lettersQuery.data ?? [];

  return (
    <>
      <DetailHeader title="Residency letter" address={address} onBack={onBack} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        <DetailSectionLabel>Purpose</DetailSectionLabel>
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
          <label htmlFor="letter-purpose" className="block text-[12.5px] font-semibold text-app-text-secondary mb-1.5">What is this letter for?</label>
          <input
            id="letter-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            maxLength={140}
            placeholder="e.g. New library card application"
            className="w-full h-[46px] px-3.5 text-[15px] text-app-text bg-app-surface border-[1.5px] border-app-border rounded-[10px] outline-none transition focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10 placeholder:text-app-text-muted"
          />
          <div className="text-[12px] text-app-text-muted mt-1.5 leading-[17px]">Appears on the letter as the stated purpose. Leave blank for general verification.</div>
        </div>

        <DetailSectionLabel>Preview</DetailSectionLabel>
        <LetterPreview facts={fullFacts} />

        <button
          type="button"
          onClick={() => issueMutation.mutate()}
          disabled={issueMutation.isPending}
          className="w-full h-12 mt-3.5 rounded-xl bg-primary-600 text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(2,132,199,0.22)] hover:bg-primary-700 transition disabled:opacity-60"
        >
          {issueMutation.isPending
            ? (<><Loader2 size={18} className="animate-spin" /> Issuing…</>)
            : (<><ShieldCheck size={18} strokeWidth={2.25} /> Issue verified letter</>)}
        </button>
        <InfoNote>
          Issuing creates the official PDF with a unique verification code and starts the download. The letter states only what you&apos;ve already verified; you can revoke it any time.
        </InfoNote>

        {(letters.length > 0 || lettersQuery.isLoading) && (
          <>
            <DetailSectionLabel>Issued letters</DetailSectionLabel>
            {lettersQuery.isLoading ? (
              <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-[13.5px] text-app-text-muted">Loading your letters…</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {letters.map((letter) => (
                  <IssuedLetterCard key={letter.id} letter={letter} homeId={homeId} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function IdentityDetail({ intelligence, homeId, residentName }: { intelligence: PlaceIntelligence; homeId: string | null; residentName: string }) {
  const router = useRouter();
  const [letterOpen, setLetterOpen] = useState(false);
  const verified = intelligence.tier === 'T4';
  const address = detailAddress(intelligence.place);
  const place = intelligence.place;
  const cityStateZip = [place.city, place.state].filter(Boolean).join(', ') + (place.postal_code ? ` ${place.postal_code}` : '');

  if (letterOpen && verified && homeId) {
    return (
      <ResidencyLetterLeaf
        facts={{ name: residentName, line1: place.line1 || place.label, cityStateZip }}
        homeId={homeId}
        address={address}
        onBack={() => setLetterOpen(false)}
      />
    );
  }

  return (
    <>
      <DetailHeader title="Identity" address={address} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        <DetailSectionLabel>Verification</DetailSectionLabel>
        {verified ? (
          <>
            <VerifiedStatus name={residentName} address={place.line1 || place.label} />
            <SourceNote name="Address verification · Pantopus" asOf="active" />

            <DetailSectionLabel>Residency letter</DetailSectionLabel>
            <button
              type="button"
              onClick={() => setLetterOpen(true)}
              className="w-full flex items-center gap-3.5 bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-left hover:bg-app-hover transition"
            >
              <span className="w-11 h-11 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                <FileText size={22} strokeWidth={2} className="text-primary-600" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">Generate a verified residency letter</div>
                <div className="text-[12.5px] text-app-text-muted mt-0.5">An official PDF with a verification code anyone can check</div>
              </div>
              <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
            </button>
            <InfoNote>
              A residency letter states your verified address for a purpose you choose — landlords, schools, libraries. Each letter carries a unique code a recipient can verify, and you can revoke it any time.
            </InfoNote>
          </>
        ) : (
          <LockedCard
            icon={BadgeCheck}
            title="Verify your address"
            reason="Verify your address to get your badge and generate a residency letter."
            cta="Verify address"
            onCta={() => homeId && router.push(`/app/homes/${homeId}/verify-postcard`)}
          />
        )}

        <DetailSectionLabel>Portable ID</DetailSectionLabel>
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-xl bg-app-surface-sunken flex items-center justify-center shrink-0">
            <ScanFace size={22} strokeWidth={2} className="text-app-text-muted" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">Portable ID</div>
            <div className="text-[12.5px] text-app-text-muted mt-0.5">Carry your verified status to other apps</div>
          </div>
          <Chip label="Coming soon" variant="neutral" />
        </div>
      </div>
    </>
  );
}
