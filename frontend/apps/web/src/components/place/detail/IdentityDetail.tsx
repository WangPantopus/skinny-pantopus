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
import type { ResidencyLetter, ResidencyClaim, ResidencyClaimScope, ResidencyClaimExpiryDays, MailboxCheck, MailboxFindingSeverity, UnlistedRemovalStatus } from '@pantopus/api';
import { RESIDENCY_CLAIM_EXPIRY_DAYS } from '@pantopus/api';
import type { PlaceIntelligence } from '@pantopus/types';
import { BadgeCheck, Check, FileText, ScanFace, Mailbox, Download, ChevronRight, LayoutDashboard, ShieldCheck, Ban, Loader2, Fingerprint, Copy, Eye, Clock, MailCheck, TriangleAlert, Info, CircleCheck, CircleX, EyeOff } from 'lucide-react';
import Chip from '@/components/archetypes/primitives/Chip';
import { LockedCard, DetailHeader, DetailSectionLabel, SourceNote, InfoNote } from '@/components/archetypes/place';
import { toast } from '@/components/ui/toast-store';
import { queryKeys } from '@/lib/query-keys';
import { detailAddress } from './sections';
import {
  StateProgramSection,
  MethodNote,
  BrokerGroups,
  WeDoNotRemoveNote,
  fmtDay,
} from '@/components/place/unlisted/parts';

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

// ── Mailbox reality check — the verification step as a diagnostic ──
// Reads the claim-time postal validation already on file (DPV, RDI,
// vacancy, unit flags) + the caller's postcard state as the physical
// leg. Shown at every tier: for T3 residents, the "physical test
// hasn't run" leg is the honest verify nudge.

const CHECK_VERDICT: Record<MailboxCheck['verdict'], { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }> = {
  looks_good: { label: 'Looks good', variant: 'success' },
  needs_attention: { label: 'Needs attention', variant: 'warning' },
  problem: { label: 'Problem found', variant: 'error' },
  unknown: { label: 'Not checked yet', variant: 'neutral' },
};

const FINDING_ICON: Record<MailboxFindingSeverity, { icon: typeof Info; className: string }> = {
  ok: { icon: CircleCheck, className: 'text-app-success' },
  info: { icon: Info, className: 'text-app-text-muted' },
  attention: { icon: TriangleAlert, className: 'text-app-warning' },
  problem: { icon: CircleX, className: 'text-app-error' },
};

function MailboxCheckCard({ homeId }: { homeId: string }) {
  const checkQuery = useQuery({
    queryKey: queryKeys.mailboxCheck(homeId),
    queryFn: () => api.mailboxCheck.getMailboxCheck(homeId),
  });

  if (checkQuery.isLoading) {
    return <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-[13.5px] text-app-text-muted">Checking how databases see this address…</div>;
  }
  if (!checkQuery.data) {
    return <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-[13.5px] text-app-text-muted">Couldn&apos;t run the mailbox check just now.</div>;
  }

  const check = checkQuery.data;
  const verdict = CHECK_VERDICT[check.verdict];

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
          <MailCheck size={22} strokeWidth={2} className="text-primary-600" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">Mailbox reality check</span>
            <Chip label={verdict.label} variant={verdict.variant} />
          </div>
          <div className="text-[12.5px] text-app-text-muted mt-0.5">How USPS databases and real mail see this address</div>
        </div>
      </div>
      <ul className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-app-border-subtle">
        {check.findings.map((f, i) => {
          const meta = FINDING_ICON[f.severity];
          const Icon = meta.icon;
          return (
            <li key={i} className="flex items-start gap-2.5">
              <Icon size={16} strokeWidth={2.25} className={`${meta.className} shrink-0 mt-0.5`} />
              <div>
                <div className="text-[13.5px] font-semibold text-app-text">{f.title}</div>
                <div className="text-[12.5px] text-app-text-secondary leading-[18px] mt-0.5">{f.detail}</div>
              </div>
            </li>
          );
        })}
        <li className="flex items-start gap-2.5">
          {check.physical.status === 'proven'
            ? <CircleCheck size={16} strokeWidth={2.25} className="text-app-success shrink-0 mt-0.5" />
            : check.physical.status === 'in_progress'
              ? <Clock size={16} strokeWidth={2.25} className="text-app-warning shrink-0 mt-0.5" />
              : <Info size={16} strokeWidth={2.25} className="text-app-text-muted shrink-0 mt-0.5" />}
          <div>
            <div className="text-[13.5px] font-semibold text-app-text">{check.physical.title}</div>
            <div className="text-[12.5px] text-app-text-secondary leading-[18px] mt-0.5">{check.physical.detail}</div>
          </div>
        </li>
      </ul>
    </div>
  );
}

// ── Residency Pass — scoped live claims ──────────────────────
// The letter's minimal-disclosure sibling: share ONE fact ("verified
// resident of Camas School District") behind a live-checked code,
// see every check in the audit trail, revoke any time.

const CLAIM_SCOPES: { scope: ResidencyClaimScope; label: string; hint: string; discloses: boolean }[] = [
  { scope: 'city', label: 'City', hint: 'e.g. “a verified resident of Portland, OR”', discloses: false },
  { scope: 'school_district', label: 'School district', hint: 'For enrollment and school-zone checks', discloses: false },
  { scope: 'county', label: 'County', hint: 'For county services and programs', discloses: false },
  { scope: 'state', label: 'State', hint: 'For state-residency checks', discloses: false },
  { scope: 'congressional_district', label: 'Congressional district', hint: 'For civic and campaign checks', discloses: false },
  { scope: 'address', label: 'Full address', hint: 'Discloses your street address — like the letter', discloses: true },
];

const CLAIM_DURATIONS: { days: ResidencyClaimExpiryDays; label: string }[] =
  RESIDENCY_CLAIM_EXPIRY_DAYS.map((days) => ({ days, label: days === 1 ? '1 day' : `${days} days` }));

function claimStatusChip(claim: ResidencyClaim) {
  if (claim.status === 'revoked') return <Chip label="Revoked" variant="warning" />;
  if (claim.status === 'expired') return <Chip label="Expired" variant="neutral" />;
  return <Chip label="Active" variant="success" />;
}

function IssuedClaimCard({ claim, homeId }: { claim: ResidencyClaim; homeId: string }) {
  const queryClient = useQueryClient();
  const inactive = claim.status !== 'active';

  const revokeMutation = useMutation({
    mutationFn: () => api.residencyClaims.revokeResidencyClaim(homeId, claim.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residencyClaims(homeId) });
      toast.success('Claim revoked. Its link and code no longer check out as valid.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not revoke the claim.'),
  });

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(claim.verify_url);
      toast.success('Verification link copied.');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  return (
    <div className={`bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 ${inactive ? 'opacity-75' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[14px] font-bold text-app-text font-mono tracking-[0.02em]">{claim.claim_code}</span>
        {claimStatusChip(claim)}
      </div>
      <div className="text-[13.5px] text-app-text-strong leading-[20px] mt-1.5">{claim.statement}</div>
      <div className="flex items-center gap-3 text-[12px] text-app-text-muted mt-1.5">
        <span className="inline-flex items-center gap-1"><Clock size={12} strokeWidth={2.25} /> until {fmtDate(claim.expires_at)}</span>
        <span className="inline-flex items-center gap-1">
          <Eye size={12} strokeWidth={2.25} />
          {claim.view_count === 0 ? 'Not checked yet' : `Checked ${claim.view_count} ${claim.view_count === 1 ? 'time' : 'times'}`}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-app-border-subtle">
        <button
          type="button"
          onClick={onCopy}
          disabled={inactive}
          className="flex-1 h-10 rounded-[10px] bg-primary-600 text-white text-[13.5px] font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-700 transition disabled:opacity-50"
        >
          <Copy size={15} strokeWidth={2.25} /> Copy link
        </button>
        {claim.status === 'active' && (
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

function ResidencyPassLeaf({ homeId, address, onBack }: { homeId: string; address: string; onBack: () => void }) {
  const [scope, setScope] = useState<ResidencyClaimScope>('city');
  const [days, setDays] = useState<ResidencyClaimExpiryDays>(30);
  const queryClient = useQueryClient();

  const claimsQuery = useQuery({
    queryKey: queryKeys.residencyClaims(homeId),
    queryFn: () => api.residencyClaims.listResidencyClaims(homeId),
  });

  const issueMutation = useMutation({
    mutationFn: () => api.residencyClaims.issueResidencyClaim(homeId, scope, days),
    onSuccess: async (claim) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residencyClaims(homeId) });
      toast.success(`Claim issued — code ${claim.claim_code}.`);
      try {
        await navigator.clipboard.writeText(claim.verify_url);
        toast.success('Verification link copied — hand it to whoever asked.');
      } catch {
        /* the claim card's Copy button is the retry path */
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not issue the claim. Try again.'),
  });

  const claims = claimsQuery.data ?? [];
  const selected = CLAIM_SCOPES.find((s) => s.scope === scope);

  return (
    <>
      <DetailHeader title="Residency Pass" address={address} onBack={onBack} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        <DetailSectionLabel>What to share</DetailSectionLabel>
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
          {CLAIM_SCOPES.map((s, i) => (
            <button
              key={s.scope}
              type="button"
              onClick={() => setScope(s.scope)}
              aria-pressed={scope === s.scope}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${i > 0 ? 'border-t border-app-border-subtle' : ''} ${scope === s.scope ? 'bg-primary-50' : 'hover:bg-app-hover'}`}
            >
              <span className={`w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center ${scope === s.scope ? 'border-primary-600' : 'border-app-border-strong'}`}>
                {scope === s.scope && <span className="w-2 h-2 rounded-full bg-primary-600" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14.5px] font-semibold text-app-text">{s.label}</span>
                <span className={`block text-[12px] mt-0.5 ${s.discloses ? 'text-app-warning font-medium' : 'text-app-text-muted'}`}>{s.hint}</span>
              </span>
            </button>
          ))}
        </div>

        <DetailSectionLabel>Valid for</DetailSectionLabel>
        <div className="grid grid-cols-4 gap-2">
          {CLAIM_DURATIONS.map((d) => (
            <button
              key={d.days}
              type="button"
              onClick={() => setDays(d.days)}
              aria-pressed={days === d.days}
              className={`h-10 rounded-[10px] text-[13.5px] font-semibold border-[1.5px] transition ${days === d.days ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover'}`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => issueMutation.mutate()}
          disabled={issueMutation.isPending}
          className="w-full h-12 mt-4 rounded-xl bg-primary-600 text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(2,132,199,0.22)] hover:bg-primary-700 transition disabled:opacity-60"
        >
          {issueMutation.isPending
            ? (<><Loader2 size={18} className="animate-spin" /> Issuing…</>)
            : (<><Fingerprint size={18} strokeWidth={2.25} /> Issue claim &amp; copy link</>)}
        </button>
        <InfoNote>
          {selected?.discloses
            ? 'A full-address claim shows your street address to whoever opens the link — use a scoped claim when the address itself isn’t required.'
            : 'The link shares only the statement you picked — never your street address. Anyone opening it sees a live check against your current verification, every check is logged for you, and you can revoke at any time.'}
        </InfoNote>

        {(claims.length > 0 || claimsQuery.isLoading) && (
          <>
            <DetailSectionLabel>Issued claims</DetailSectionLabel>
            {claimsQuery.isLoading ? (
              <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-[13.5px] text-app-text-muted">Loading your claims…</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {claims.map((claim) => (
                  <IssuedClaimCard key={claim.id} claim={claim} homeId={homeId} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Unlisted — your address, and how to take it back ─────────
//
// The claimed-home half of /unlisted. Same three rules as the public
// page: the state's confidentiality program leads, `method_note` is
// rendered verbatim (we do NOT query these sites — searching them would
// hand them the address), and each broker's caveat travels whole.
//
// What the claimed home adds is bookkeeping the resident owns: which
// sites they have written to. Pantopus never submits an opt-out for
// anyone — the removal happens on the broker's own form, and we record
// only what the person tells us.
//
// Gate: home access, NOT verification. Someone who has just claimed
// their address is exactly who needs this.

function UnlistedLeaf({ homeId, address, onBack }: { homeId: string; address: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [busyBrokerId, setBusyBrokerId] = useState<string | null>(null);

  const unlistedQuery = useQuery({
    queryKey: queryKeys.unlisted(homeId),
    queryFn: () => api.unlisted.getHomeUnlisted(homeId),
  });

  const statusMutation = useMutation({
    mutationFn: ({ brokerId, status }: { brokerId: string; status: UnlistedRemovalStatus }) =>
      api.unlisted.setRemovalStatus(homeId, brokerId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unlisted(homeId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save your progress.'),
    onSettled: () => setBusyBrokerId(null),
  });

  const profile = unlistedQuery.data;
  const removals = profile?.removals ?? null;
  // NULL means the read FAILED — distinct from [] ("nothing done yet").
  // An empty checklist is a confident claim we cannot make when we could
  // not read the rows, so the progress UI is withheld and said so.
  // Anything that is not an array means we do not have the rows — null
  // (the read failed) and undefined (the key never arrived) alike. The
  // `=== null` form let undefined fall through to `?? []`, which renders
  // every broker as "todo": a confident "you have done nothing yet" off
  // data we never read. Both native clients already fail safe here.
  const removalsFailed = !!profile && !Array.isArray(profile.removals);
  const statusByBroker = new Map<string, UnlistedRemovalStatus>(
    (removals ?? []).map((r) => [r.broker_id, r.status]),
  );
  const confirmedCount = (removals ?? []).filter((r) => r.status === 'confirmed').length;

  return (
    <>
      <DetailHeader title="Unlisted" address={address} onBack={onBack} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        {unlistedQuery.isLoading ? (
          <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 mt-4 text-[13.5px] text-app-text-muted">
            Loading your removal list…
          </div>
        ) : !profile ? (
          <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 mt-4">
            <div className="text-[15px] font-semibold text-app-text">Couldn&apos;t load your removal list</div>
            <p className="text-[13px] text-app-text-secondary leading-[19px] mt-1">Check your connection and try again.</p>
            <button
              type="button"
              onClick={() => unlistedQuery.refetch()}
              className="mt-3 h-10 px-4 rounded-[10px] border-[1.5px] border-app-border bg-app-surface text-app-text text-[13.5px] font-semibold hover:bg-app-hover transition"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* 1. The escape hatch, above the list, always. */}
            <DetailSectionLabel>Your state&apos;s program</DetailSectionLabel>
            <StateProgramSection profile={profile} />

            {/* 2. The honesty line, verbatim, beside the list it is about. */}
            {/* Names the SITES, not the person: "where your address gets
                republished" would assert a listing we never checked for. */}
            <DetailSectionLabel>Sites that republish county records</DetailSectionLabel>
            <MethodNote note={profile.method_note} />

            {/* 3. This resident's own progress — or an honest gap. */}
            {removalsFailed ? (
              <div className="flex items-start gap-2.5 mt-3 px-3.5 py-3 rounded-xl border border-app-warning-light bg-app-warning-bg">
                <TriangleAlert size={16} strokeWidth={2.25} className="mt-0.5 shrink-0 text-app-warning" />
                <div>
                  <div className="text-[13.5px] font-semibold text-app-text-strong">
                    We couldn&apos;t read your progress just now
                  </div>
                  <p className="text-[12.5px] text-app-text-strong leading-[18px] mt-0.5">
                    So we are not showing a checklist — an empty one would say you have done nothing, and we do not
                    know that. Your saved progress is untouched.
                  </p>
                  <button
                    type="button"
                    onClick={() => unlistedQuery.refetch()}
                    className="mt-2 h-9 px-3.5 rounded-[10px] border-[1.5px] border-app-border bg-app-surface text-app-text text-[13px] font-semibold hover:bg-app-hover transition"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-[13px] text-app-text-secondary px-1">
                {confirmedCount === 0
                  ? `${profile.broker_count} ${profile.broker_count === 1 ? 'site' : 'sites'} to work through. Mark each one as you go.`
                  : `${confirmedCount} of ${profile.broker_count} confirmed removed.`}
              </div>
            )}

            <BrokerGroups
              profile={profile}
              // Withheld entirely when the read failed: no status chips,
              // no buttons, rather than a checklist of zeros.
              statusFor={removalsFailed ? undefined : (id) => statusByBroker.get(id) ?? 'todo'}
              onStatus={
                removalsFailed
                  ? undefined
                  : (brokerId, status) => {
                      setBusyBrokerId(brokerId);
                      statusMutation.mutate({ brokerId, status });
                    }
              }
              busyBrokerId={busyBrokerId}
            />

            {profile.registry_verified_at ? (
              <p className="text-[12px] text-app-text-muted mt-4 px-1">
                Links last checked {fmtDay(profile.registry_verified_at)}.
              </p>
            ) : null}

            <WeDoNotRemoveNote />
          </>
        )}
      </div>
    </>
  );
}

export default function IdentityDetail({ intelligence, homeId, residentName }: { intelligence: PlaceIntelligence; homeId: string | null; residentName: string }) {
  const router = useRouter();
  const [letterOpen, setLetterOpen] = useState(false);
  const [claimsOpen, setClaimsOpen] = useState(false);
  const [unlistedOpen, setUnlistedOpen] = useState(false);
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

  if (claimsOpen && verified && homeId) {
    return (
      <ResidencyPassLeaf
        homeId={homeId}
        address={address}
        onBack={() => setClaimsOpen(false)}
      />
    );
  }

  // Home access only — verification is deliberately NOT required here.
  if (unlistedOpen && homeId) {
    return <UnlistedLeaf homeId={homeId} address={address} onBack={() => setUnlistedOpen(false)} />;
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

            <DetailSectionLabel>Residency Pass</DetailSectionLabel>
            <button
              type="button"
              onClick={() => setClaimsOpen(true)}
              className="w-full flex items-center gap-3.5 bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-left hover:bg-app-hover transition"
            >
              <span className="w-11 h-11 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                <Fingerprint size={22} strokeWidth={2} className="text-primary-600" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">Prove residency without sharing your address</div>
                <div className="text-[12.5px] text-app-text-muted mt-0.5">Share one fact — your city, school district, or county — behind a live-checked link</div>
              </div>
              <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
            </button>
            <InfoNote>
              A claim is checked live: it stops verifying the moment you revoke it, it expires on the date you pick, and every check is logged for you.
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

        {homeId && (
          <>
            <DetailSectionLabel>Your address online</DetailSectionLabel>
            <button
              type="button"
              onClick={() => setUnlistedOpen(true)}
              className="w-full flex items-center gap-3.5 bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-left hover:bg-app-hover transition"
            >
              <span className="w-11 h-11 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                <EyeOff size={22} strokeWidth={2} className="text-primary-600" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">Unlisted — take your address back</div>
                <div className="text-[12.5px] text-app-text-muted mt-0.5">Your state&apos;s confidentiality program, then a verified opt-out path for each site we have confirmed</div>
              </div>
              <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
            </button>
            <InfoNote>
              We never look your address up on people-search sites — searching them would hand them your address.
              These are the sites we have verified a working removal path for, and how to leave each, plus a place
              to track what you have sent. It is not every site that republishes county records.
            </InfoNote>

            <DetailSectionLabel>Mailbox</DetailSectionLabel>
            <MailboxCheckCard homeId={homeId} />
            <InfoNote>
              Read from the postal databases checked when this address was claimed, plus your verification postcard as the real-world test. Pantopus can point at a fix but can&apos;t change USPS records for you.
            </InfoNote>
          </>
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
