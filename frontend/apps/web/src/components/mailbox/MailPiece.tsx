'use client';

// ============================================================
// A piece of mail drawn as the thing it is (Mail tab drawings, MailPiece and
// Parts boards, 2026-10-27): a plain envelope for a letter, a window envelope
// for a bill or notice, a picture postcard, a booklet, a kraft parcel, a
// bundle, and the striped Special delivery envelope. Each carries its return
// address, a stamp (people) or printed postage (verified senders and
// Pantopus), and a postmark with town and date. Unopened pieces are sealed;
// opened envelopes show a torn flap; old mail fades. Paper keeps its own
// colours in dark mode, so it stays readable.
// ============================================================

import type { CSSProperties, ReactNode } from 'react';
import type { MailItemV2 } from '@/types/mailbox';
import { PantopusMark } from '@/components/brand/PantopusMark';

export type PieceKind = 'letter' | 'bill' | 'notice' | 'postcard' | 'booklet' | 'parcel' | 'bundle';

const KINDS: PieceKind[] = ['letter', 'bill', 'notice', 'postcard', 'booklet', 'parcel', 'bundle'];

// Servers before the Mail build send no `kind`; their stored shape is close enough.
const OBJECT_KINDS: Record<string, PieceKind> = { postcard: 'postcard', booklet: 'booklet', package: 'parcel', bundle: 'bundle' };

/** The server's `kind`; a value we don't know draws as a letter. */
export function pieceKind(item: Pick<MailItemV2, 'kind' | 'mail_object_type' | 'mail_type'>): PieceKind {
  if (item.kind != null) return KINDS.includes(item.kind as PieceKind) ? (item.kind as PieceKind) : 'letter';
  if (OBJECT_KINDS[item.mail_object_type]) return OBJECT_KINDS[item.mail_object_type];
  return item.mail_type === 'bill' ? 'bill' : item.mail_type === 'notice' ? 'notice' : 'letter';
}

/** What you hold when you open it: "envelope" for letters, bills and notices, else the piece itself. */
export function pieceOutside(kind: PieceKind): string {
  return kind === 'postcard' || kind === 'booklet' || kind === 'parcel' || kind === 'bundle' ? kind : 'envelope';
}

type Trust = { label: string; color: string; mark: string | null };

// How Pantopus checked the sender: the printed postage line and the label.
export function pieceTrust(item: Pick<MailItemV2, 'sender_trust' | 'from_pantopus'>): Trust {
  if (item.from_pantopus) return { label: 'From Pantopus', color: '#0369a1', mark: 'PANTOPUS' };
  switch (item.sender_trust) {
    case 'verified_gov': return { label: 'Verified government', color: '#047857', mark: 'GOVERNMENT' };
    case 'verified_utility': return { label: 'Verified utility', color: '#047857', mark: 'UTILITY' };
    case 'verified_business': return { label: 'Verified business', color: '#047857', mark: 'BUSINESS' };
    case 'pantopus_user': return { label: 'Pantopus neighbor', color: '#4e5563', mark: null };
    default: return { label: 'Unverified sender', color: '#a81a1a', mark: null };
  }
}

const KIND_WORDS: Record<PieceKind, string> = {
  letter: 'Letter', bill: 'Bill', notice: 'Notice', postcard: 'Postcard', booklet: 'Booklet', parcel: 'Parcel', bundle: 'Bundle',
};

const SERIF = "'Iowan Old Style', 'Hoefler Text', Charter, Georgia, serif";
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function shortDate(iso: string | undefined | null, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', opts);
}

/**
 * The piece as one sentence for screen readers: what it is, from whom, how
 * Pantopus checked them, and sealed or opened (rows add when it came and when
 * it's due).
 */
export function pieceSentence(item: MailItemV2, opened: boolean): string {
  const kind = pieceKind(item);
  const what = item.special_delivery ? `Special delivery ${KIND_WORDS[kind].toLowerCase()}` : KIND_WORDS[kind];
  const from = item.sender_display || 'an unknown sender';
  // Pantopus's own mail is already "from Pantopus": no trust words after it.
  const trust = item.from_pantopus ? '' : `, ${pieceTrust(item).label.toLowerCase()}`;
  const envelope = kind === 'letter' || kind === 'bill' || kind === 'notice' || kind === 'bundle';
  const state = envelope ? (opened ? ', opened' : ', sealed') : '';
  const title = item.display_title || item.subject;
  return `${what} from ${item.from_pantopus ? 'Pantopus' : from}${trust}${state}${title ? `: ${title}` : ''}`;
}

/** Old mail fades: a read piece from before today, more with age. */
export function pieceFade(item: Pick<MailItemV2, 'delivered_at' | 'created_at'>, read: boolean, now = new Date()): number {
  if (!read) return 1;
  const at = new Date(item.delivered_at || item.created_at);
  if (Number.isNaN(at.getTime())) return 1;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (at.getTime() >= startOfToday) return 1;
  const days = (startOfToday - at.getTime()) / 86_400_000;
  return days < 7 ? 0.82 : days < 30 ? 0.72 : 0.62;
}

// A stamp for mail from people, picked by the piece so it never changes.
const STAMPS = ['fir', 'peak', 'river'] as const;
function stampFor(id: string): (typeof STAMPS)[number] {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return STAMPS[hash % STAMPS.length];
}

const PERFORATION: CSSProperties = {
  WebkitMask: 'linear-gradient(#000 0 0) content-box, radial-gradient(circle at 3px 3px, transparent 1.6px, #000 1.9px) -3px -3px / 6px 6px',
  mask: 'linear-gradient(#000 0 0) content-box, radial-gradient(circle at 3px 3px, transparent 1.6px, #000 1.9px) -3px -3px / 6px 6px',
};

function Stamp({ design }: { design: (typeof STAMPS)[number] }) {
  return (
    <div className="h-[54px] w-[42px] bg-white p-[3px]" style={PERFORATION}>
      <svg width="36" height="48" viewBox="0 0 36 48" className="block">
        {design === 'fir' ? (
          <><rect width="36" height="48" fill="#0369a1" /><circle cx="27" cy="11" r="4" fill="#fde68a" /><path d="M18 10 L27 25 H22 L29 37 H7 L14 25 H9 Z" fill="#e0f2fe" /><rect x="16.5" y="37" width="3" height="6" fill="#e0f2fe" /></>
        ) : design === 'peak' ? (
          <><rect width="36" height="48" fill="#9a4a08" /><path d="M2 40 L15 18 L21 27 L25 21 L34 40 Z" fill="#fef3c7" /><path d="M15 18 L19 24.5 L16.5 23 L13.5 25 Z" fill="#ffffff" /><circle cx="9" cy="11" r="3.5" fill="#fde68a" /></>
        ) : (
          <><rect width="36" height="48" fill="#15803d" /><path d="M0 30 q6 -4 12 0 t12 0 t12 0 V48 H0 Z" fill="#bbf7d0" /><path d="M0 38 q6 -4 12 0 t12 0 t12 0" fill="none" stroke="#15803d" strokeWidth="2" /><path d="M11 22 L18 9 L25 22 Z" fill="#dcfce7" /></>
        )}
      </svg>
    </div>
  );
}

/** Printed postage: Pantopus's own mark, or "PANTOPUS POST · VERIFIED · <kind of sender>". */
function PrintedPostage({ mark }: { mark: string }) {
  return (
    <div
      className="flex h-11 w-[66px] flex-col items-center justify-center rounded-[2px] border-[1.5px] border-[#1f2937] text-center text-[6.5px] leading-[8px] tracking-[0.04em] text-[#1f2937]"
      style={{ fontFamily: MONO }}
    >
      {mark === 'PANTOPUS' ? (
        <>
          <PantopusMark size={18} />
          <span className="mt-0.5 font-bold">PANTOPUS</span>
        </>
      ) : (
        <>
          <span className="font-bold">PANTOPUS POST</span>
          <span>VERIFIED</span>
          <span>{mark}</span>
        </>
      )}
    </div>
  );
}

function Postmark({ town, date, size = 44, lines = true }: { town: string | null; date: string; size?: number; lines?: boolean }) {
  const year = date.slice(-4);
  const day = date.slice(0, -5);
  return (
    <svg width={lines ? size * 2 : size} height={size} viewBox={lines ? '0 0 92 46' : '0 0 46 46'} className="opacity-60">
      <circle cx="22" cy="23" r="19" fill="none" stroke="#1f2937" strokeWidth="1.4" />
      {town ? <text x="22" y="15" textAnchor="middle" fontFamily={MONO} fontSize="5.2" fill="#1f2937">{town.slice(0, 12).toUpperCase()}</text> : null}
      <text x="22" y={town ? 26 : 25} textAnchor="middle" fontFamily={MONO} fontSize="7" fontWeight="700" fill="#1f2937">{day}</text>
      <text x="22" y={town ? 34 : 33} textAnchor="middle" fontFamily={MONO} fontSize="5.2" fill="#1f2937">{year}</text>
      {lines ? (
        <>
          <path d="M44 15 q6 -4 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#1f2937" strokeWidth="1.2" />
          <path d="M44 23 q6 -4 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#1f2937" strokeWidth="1.2" />
          <path d="M44 31 q6 -4 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#1f2937" strokeWidth="1.2" />
        </>
      ) : null}
    </svg>
  );
}

function TrustLine({ trust, className = '' }: { trust: Trust; className?: string }) {
  return (
    <div className={`flex items-center gap-1 text-[11px] font-medium leading-[14px] ${className}`} style={{ color: trust.color }}>
      {trust.mark ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
      ) : trust.label === 'Unverified sender' ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
      ) : null}
      <span className="truncate">{trust.label}</span>
    </div>
  );
}

// The torn top edge of an opened envelope.
const TORN = 'polygon(0 7px, 3% 3px, 6% 8px, 9% 2px, 12% 7px, 15% 3px, 18% 8px, 21% 2px, 24% 6px, 27% 3px, 30% 8px, 33% 2px, 36% 7px, 39% 3px, 42% 8px, 45% 2px, 48% 6px, 51% 3px, 54% 8px, 57% 2px, 60% 7px, 63% 3px, 66% 8px, 69% 2px, 72% 6px, 75% 3px, 78% 8px, 81% 2px, 84% 7px, 87% 3px, 90% 8px, 93% 2px, 96% 6px, 100% 3px, 100% 100%, 0 100%)';

const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.08), 0 8px 18px rgba(15, 23, 42, 0.08)';

export type MailPieceProps = {
  item: MailItemV2;
  /** Who it's addressed to, as on the envelope. */
  recipientName: string;
  /** The address line under the name (the Home's, or the person's own). */
  recipientLine?: string | null;
  opened: boolean;
  /** 1 = fresh; lower = older read mail. */
  fade?: number;
};

/**
 * The drawing alone; the row around it gives it a name (pieceSentence), so
 * the drawing itself is hidden from screen readers.
 */
export default function MailPiece({ item, recipientName, recipientLine, opened, fade = 1 }: MailPieceProps) {
  const kind = pieceKind(item);
  const trust = pieceTrust(item);
  const from = item.sender_display || 'Unknown sender';
  const town = item.postmark?.town ?? null;
  const postDate = shortDate(item.postmark?.date || item.delivered_at || item.created_at, { month: 'short', day: 'numeric', year: 'numeric' })
    .replace(',', '').toUpperCase();
  const title = item.display_title || item.subject || '';
  const envelope = kind === 'letter' || kind === 'bill' || kind === 'notice' || kind === 'bundle' || item.special_delivery;
  const torn = opened && envelope;
  const person = !trust.mark;

  let body: ReactNode;
  if (item.special_delivery) {
    body = (
      <div
        className="relative h-[150px] rounded-md p-[5px]"
        style={{ background: 'repeating-linear-gradient(135deg, #a81a1a 0 9px, #ffffff 9px 14px, #0369a1 14px 23px, #ffffff 23px 28px)', boxShadow: SHADOW, clipPath: torn ? TORN : undefined }}
      >
        <div className="relative h-full rounded-[3px] bg-[#fffdf8]">
          <div className="absolute left-3 top-2.5 text-[10px] font-bold leading-3 tracking-[0.12em] text-[#a81a1a]" style={{ fontFamily: MONO }}>SPECIAL DELIVERY</div>
          <div className="absolute left-3 top-7 max-w-[56%]">
            <div className="truncate text-[12px] font-semibold leading-[15px] text-[#111827]">{from}</div>
            {town ? <div className="truncate text-[11px] leading-[14px] text-[#5f6775]">{town}</div> : null}
            <TrustLine trust={trust} className="mt-[3px]" />
          </div>
          <div className="absolute right-2.5 top-2.5">{trust.mark ? <PrintedPostage mark={trust.mark} /> : <Stamp design={stampFor(item.id)} />}</div>
          <div className="absolute bottom-3 left-[45%] right-3 text-[10.5px] leading-[14px] text-[#1f2937]" style={{ fontFamily: MONO }}>
            <div className="truncate">{recipientName}</div>
            {recipientLine ? <div className="truncate">{recipientLine}</div> : null}
          </div>
          {postDate ? <div className="absolute bottom-2 left-3"><Postmark town={town} date={postDate} size={40} lines={false} /></div> : null}
        </div>
      </div>
    );
  } else if (kind === 'bill' || kind === 'notice' || kind === 'bundle') {
    body = (
      <div className="relative">
        {kind === 'bundle' ? (
          <>
            <div className="absolute -top-2 left-4 right-4 h-4 rounded-t-[4px] border border-b-0 border-[#e2e8f0] bg-[#f1f5f9]" />
            <div className="absolute -top-1 left-2 right-2 h-3 rounded-t-[4px] border border-b-0 border-[#e2e8f0] bg-[#f8fafc]" />
          </>
        ) : null}
        <div className="relative h-[150px] rounded-[4px] border border-[#e2e8f0] bg-white" style={{ boxShadow: SHADOW, clipPath: torn ? TORN : undefined }}>
          <div className="absolute left-4 top-[15px] flex max-w-[58%] items-start gap-2">
            <div className="h-6 w-6 flex-shrink-0 rounded-md bg-[#1f2937] text-center text-[12px] font-bold leading-6 text-white">{from.charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold leading-[15px] text-[#111827]">{from}</div>
              {town ? <div className="truncate text-[11px] leading-[14px] text-[#5f6775]">{town}</div> : null}
              <TrustLine trust={trust} className="mt-[3px]" />
            </div>
          </div>
          {trust.mark ? <div className="absolute right-3.5 top-3.5"><PrintedPostage mark={trust.mark} /></div> : null}
          {postDate ? <div className="absolute right-[86px] top-4"><Postmark town={town} date={postDate} size={40} lines={false} /></div> : null}
          <div className="absolute left-4 top-[76px] h-[50px] w-[56%] rounded-[4px] border border-[#cfe0eb] bg-[#eef5fa] px-2.5 py-[9px] text-[10.5px] leading-[14px] text-[#1f2937]" style={{ fontFamily: MONO }}>
            <div className="truncate">{recipientName}</div>
            {recipientLine ? <div className="truncate">{recipientLine}</div> : null}
          </div>
          {/* What's printed under the window: the bundle's label, or the piece's own title. */}
          <div className="absolute bottom-[13px] right-3.5 line-clamp-2 max-w-[38%] text-right text-[9.5px] uppercase leading-3 tracking-[0.06em] text-[#374151]" style={{ fontFamily: MONO }}>
            {kind === 'bundle'
              ? item.bundle_label || `${item.bundle_item_count || 'Several'} pieces`
              : title || (kind === 'bill' ? 'Statement enclosed' : 'Notice enclosed')}
          </div>
        </div>
      </div>
    );
  } else if (kind === 'postcard') {
    body = (
      <div className="relative h-[150px] rounded-[4px] border border-[#ebe5d6] bg-[#fffdf7]" style={{ boxShadow: SHADOW }}>
        <div className="absolute left-3.5 top-[13px] w-[48%]">
          <div className="truncate text-[10px] font-semibold uppercase leading-[13px] tracking-[0.06em] text-[#0369a1]">{from}</div>
          <div className="mt-1.5 line-clamp-4 text-[13px] italic leading-[18px] text-[#1e293b]" style={{ fontFamily: SERIF }}>{item.preview_text || title}</div>
        </div>
        <div className="absolute bottom-3.5 left-[55%] top-3.5 w-px bg-[#e2dccd]" />
        <div className="absolute right-3 top-2.5"><Stamp design={stampFor(item.id)} /></div>
        {postDate ? <div className="absolute right-12 top-3.5"><Postmark town={town} date={postDate} size={40} lines={false} /></div> : null}
        <div className="absolute left-[calc(55%+12px)] right-3 top-[78px] text-[10px] leading-[15px] text-[#1f2937]" style={{ fontFamily: MONO }}>
          <div className="truncate border-b border-[#e2dccd]">{recipientName}</div>
          {recipientLine ? <div className="truncate border-b border-[#e2dccd]">{recipientLine}</div> : null}
        </div>
        <TrustLine trust={trust} className="absolute bottom-2.5 left-3.5" />
      </div>
    );
  } else if (kind === 'booklet') {
    body = (
      <div className="relative h-[172px]">
        <div className="absolute bottom-0 left-1.5 right-0 top-1.5 rounded-[4px] border border-[#e2e8f0] bg-[#f1f5f9]" style={{ boxShadow: '0 8px 18px rgba(15, 23, 42, 0.1)' }} />
        <div className="absolute inset-[3px] rounded-[4px] border border-[#e2e8f0] bg-[#f8fafc]" />
        <div className="absolute bottom-1.5 left-0 right-1.5 top-0 overflow-hidden rounded-[4px] bg-[#0c4a6e]">
          <div className="absolute left-[7px] top-[34px] h-4 w-0.5 bg-[#cbd5e1]" />
          <div className="absolute bottom-[34px] left-[7px] h-4 w-0.5 bg-[#cbd5e1]" />
          <div className="absolute left-[22px] right-3 top-4 flex items-center gap-2 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em] text-[#e0f2fe]">
            {item.from_pantopus ? <PantopusMark size={22} /> : null}
            <span className="truncate">{from}</span>
          </div>
          <div className="absolute left-[22px] top-[50px] line-clamp-2 w-[52%] text-[20px] leading-6 text-white" style={{ fontFamily: SERIF }}>{title}</div>
          <TrustLine trust={{ ...trust, color: '#bae6fd' }} className="absolute bottom-3.5 left-[22px] max-w-[44%]" />
          <div className="absolute bottom-3 right-3 w-[132px] rounded-[3px] bg-white px-[9px] py-[7px] text-[9.5px] leading-3 text-[#1f2937]" style={{ fontFamily: MONO }}>
            <div className="truncate">{recipientName}</div>
            {recipientLine ? <div className="truncate">{recipientLine}</div> : null}
          </div>
        </div>
      </div>
    );
  } else if (kind === 'parcel') {
    body = (
      <div className="relative h-[160px] overflow-hidden rounded-md bg-[#c9a676]" style={{ boxShadow: '0 1px 2px rgba(15, 23, 42, 0.12), 0 10px 22px rgba(15, 23, 42, 0.14)' }}>
        <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(100deg, rgba(255, 255, 255, 0.06) 0 2px, rgba(0, 0, 0, 0.03) 2px 5px)' }} />
        <div className="absolute left-0 right-0 top-[66px] h-[26px] border-y border-white/50 bg-[rgba(246,232,186,0.78)]" />
        <div className="absolute bottom-3.5 left-3.5 top-3.5 w-[58%] rounded-[3px] bg-white px-2.5 py-2 text-[9.5px] leading-[13px] text-[#1f2937]" style={{ fontFamily: MONO, boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)' }}>
          <div className="text-[#5f6775]">FROM</div>
          <div className="truncate font-bold">{from}</div>
          <div className="mt-[5px] text-[#5f6775]">TO</div>
          <div className="truncate font-bold">{recipientName}</div>
          {recipientLine ? <div className="truncate">{recipientLine}</div> : null}
          <div className="mt-1.5 h-3.5" style={{ background: 'repeating-linear-gradient(90deg, #1f2937 0 1px, #ffffff 1px 3px, #1f2937 3px 5px, #ffffff 5px 6px, #1f2937 6px 7px, #ffffff 7px 9px)' }} />
        </div>
        <div className="absolute right-3.5 top-3.5">{trust.mark ? <PrintedPostage mark={trust.mark} /> : <Stamp design={stampFor(item.id)} />}</div>
        <TrustLine trust={{ ...trust, color: trust.label === 'Unverified sender' ? '#7f1d1d' : '#3b2a16' }} className="absolute bottom-3.5 right-3.5 max-w-[34%] justify-end" />
      </div>
    );
  } else {
    // A letter: a cream envelope, handwritten addresses, a stamp from people,
    // printed postage from verified senders, nothing from an unknown one.
    body = (
      <div className="relative h-[150px] rounded-md border border-[#ebe1cb] bg-[#fbf6ea]" style={{ boxShadow: SHADOW, clipPath: torn ? TORN : undefined }}>
        <div className="absolute left-4 top-4 max-w-[48%] text-[13px] italic leading-[17px] text-[#334155]" style={{ fontFamily: SERIF }}>
          <div className="truncate">{from}</div>
          {town ? <div className="truncate">{town}</div> : null}
        </div>
        {trust.mark ? (
          // Printed postage, with the postmark beside it as on a window envelope.
          <>
            <div className="absolute right-3.5 top-3"><PrintedPostage mark={trust.mark} /></div>
            {postDate ? <div className="absolute right-[86px] top-4"><Postmark town={town} date={postDate} size={40} lines={false} /></div> : null}
          </>
        ) : person && trust.label !== 'Unverified sender' ? (
          // A stamp, cancelled by the postmark across it.
          <>
            <div className="absolute right-3.5 top-3"><Stamp design={stampFor(item.id)} /></div>
            {postDate ? <div className="absolute right-2 top-4"><Postmark town={town} date={postDate} size={46} /></div> : null}
          </>
        ) : postDate ? (
          <div className="absolute right-3.5 top-4"><Postmark town={town} date={postDate} size={40} lines={false} /></div>
        ) : null}
        <div className="absolute left-[38%] right-3 top-[72px] text-[16px] italic leading-[21px] text-[#0f172a]" style={{ fontFamily: SERIF }}>
          <div className="truncate">{recipientName}</div>
          {recipientLine ? <div className="truncate">{recipientLine}</div> : null}
        </div>
        <TrustLine trust={trust} className="absolute bottom-3 left-4 max-w-[60%]" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="relative w-full [@media(prefers-color-scheme:dark)]:brightness-[0.94]"
      style={{ paddingTop: torn ? 14 : 0, opacity: fade }}
    >
      {torn ? (
        // The letter peeking out of a torn envelope.
        <div className="absolute left-5 right-5 top-0 h-[30px] rounded-[2px] border border-[#e2e8f0] bg-white" style={{ boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)' }}>
          <div className="mx-3.5 mt-[7px] h-0.5 w-[46%] bg-[#cbd5e1]" />
          <div className="mx-3.5 mt-1 h-0.5 w-[30%] bg-[#e2e8f0]" />
        </div>
      ) : null}
      {body}
    </div>
  );
}
