'use client';

// The Home Money Check's appeal packet: what it holds, buying it, and the download. Every word about the packet comes
// from the server (backend/services/appealPacket.js), so the page and the PDF say the same thing. Only the Home's
// confirmed owner gets one, where the county is switched on for it and values the home above similar homes; anyone
// else sees that there is none for this home.
//
// Buying is Stripe's own checkout page. It sends the buyer back here with `packet_session`, which the server checks
// with Stripe before the download opens; `packet_cancelled` means they left without paying.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import * as api from '@pantopus/api';

type Notice = { tone: 'good' | 'plain' | 'bad'; text: string } | null;
const NOTICE_TONES = { good: 'border-emerald-200 bg-emerald-50 text-emerald-800', plain: 'border-app-border bg-app-surface-muted text-app-text-secondary', bad: 'border-red-200 bg-red-50 text-red-700' };

export default function AppealPacketPage() {
  const { id: homeId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const queryKey = ['home', homeId, 'appeal-packet'];
  const [busy, setBusy] = useState<'buy' | 'download' | 'confirm' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  // One checkout per visit to the page, however many times the button is clicked.
  const requestId = useRef<string>(crypto.randomUUID());
  const returned = useRef(false);
  const packet = useQuery({ queryKey, queryFn: () => api.homeProfile.getAppealPacket(homeId), staleTime: 0 });

  // Back from Stripe: take its marks off the address, then have the server check the payment.
  useEffect(() => {
    if (returned.current) return;
    returned.current = true;
    const url = new URL(window.location.href);
    const session = url.searchParams.get('packet_session');
    const cancelled = url.searchParams.get('packet_cancelled');
    if (!session && !cancelled) return;
    url.searchParams.delete('packet_session');
    url.searchParams.delete('packet_cancelled');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    if (!session) { setNotice({ tone: 'plain', text: 'You left the payment page. Nothing was charged.' }); return; }
    setBusy('confirm');
    api.homeProfile.confirmAppealPacketPurchase(homeId, session)
      .then((summary) => {
        queryClient.setQueryData(queryKey, summary);
        setNotice({ tone: 'good', text: 'Payment received. Your packet is ready to download.' });
      })
      .catch(() => setNotice({ tone: 'bad', text: 'We could not confirm the payment yet. Reload this page in a minute; if it was paid, the download opens then.' }))
      .finally(() => setBusy(null));
    // Runs once for the address the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buy = async () => {
    setBusy('buy');
    setNotice(null);
    try {
      const { url } = await api.homeProfile.startAppealPacketCheckout(homeId, requestId.current);
      window.location.assign(url);
    } catch {
      setNotice({ tone: 'bad', text: 'The payment page could not be opened. Try again.' });
      setBusy(null);
    }
  };

  const download = async (fileName: string) => {
    setBusy('download');
    setNotice(null);
    try {
      const blob = await api.homeProfile.downloadAppealPacket(homeId);
      const url = URL.createObjectURL(blob);
      try { const link = document.createElement('a'); link.href = url; link.download = fileName; link.click(); }
      finally { URL.revokeObjectURL(url); }
    } catch {
      setNotice({ tone: 'bad', text: 'The packet could not be made. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const data = packet.data;
  const buttonClass = 'mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60';
  return (
    <div className="max-w-2xl mx-auto px-4 py-8" data-testid="appeal-packet-page">
      <Link href="/app/place/money" className="mb-5 inline-flex items-center gap-2 text-sm text-app-text-secondary hover:text-app-text-strong">
        <ArrowLeft className="h-4 w-4" />
        Money signals
      </Link>

      {notice ? (
        <div role={notice.tone === 'bad' ? 'alert' : 'status'} className={`mb-4 rounded-2xl border px-4 py-3 text-[13.5px] ${NOTICE_TONES[notice.tone]}`} data-testid="appeal-packet-notice">{notice.text}</div>
      ) : null}

      {packet.isLoading || busy === 'confirm' ? <div className="text-sm text-app-text-secondary">{busy === 'confirm' ? 'Checking the payment…' : 'Loading…'}</div> : null}

      {packet.isError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p>The packet could not be loaded.</p>
          <button type="button" onClick={() => void packet.refetch()} className="mt-3 rounded-lg border border-red-200 px-3 py-2 font-semibold">Retry</button>
        </div>
      ) : null}

      {data && !data.available ? (
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]" data-testid="appeal-packet-none">
          <div className="text-[15.5px] font-semibold text-app-text">There is no packet for this home</div>
          <div className="text-[13.5px] text-app-text-secondary leading-[20px] mt-2">
            A packet is made for a home&apos;s confirmed owner, where the county&apos;s value is above similar homes on the street.
          </div>
        </div>
      ) : null}

      {data && data.available ? (
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-app-home-bg flex items-center justify-center shrink-0">
              <FileText size={22} strokeWidth={2} className="text-app-home" />
            </span>
            <h1 className="text-[17px] font-semibold text-app-text -tracking-[0.01em]">{data.title}</h1>
          </div>
          <p className="text-[13.5px] text-app-text-strong leading-[20px] mt-3 pt-3 border-t border-app-border-subtle">{data.lead}</p>

          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary mt-4">What is in it</div>
          <ol className="mt-1.5 list-decimal pl-5 text-[13.5px] text-app-text leading-[22px]">
            {data.contents.map((line) => <li key={line}>{line}</li>)}
          </ol>

          {data.rows.length ? (
            <dl className="mt-3 px-3.5 py-2 bg-app-surface-muted border border-app-border-subtle rounded-[11px]">
              {data.rows.map((row) => (
                <div key={row.id} className="flex items-baseline justify-between gap-4 py-1">
                  <dt className="text-[13px] text-app-text-secondary">{row.label}</dt>
                  <dd className="text-[13px] font-semibold text-app-text text-right tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {data.source ? <div className="text-[12.5px] text-app-text-secondary leading-[18px] mt-2.5">{data.source}</div> : null}

          {data.purchased ? (
            <button type="button" onClick={() => void download(data.file_name)} disabled={busy !== null} className={buttonClass} data-testid="appeal-packet-download">
              <Download size={16} />
              {busy === 'download' ? 'Preparing…' : 'Download the packet (PDF)'}
            </button>
          ) : null}
          {!data.purchased && data.on_sale ? (
            <button type="button" onClick={() => void buy()} disabled={busy !== null} className={buttonClass} data-testid="appeal-packet-buy">
              {busy === 'buy' ? 'Opening the payment page…' : `Buy the packet · ${data.price.label}`}
            </button>
          ) : null}
          {!data.purchased && !data.on_sale ? (
            <div className="mt-4 rounded-xl border border-app-border bg-app-surface-muted px-4 py-3 text-[13.5px] text-app-text-secondary" data-testid="appeal-packet-not-on-sale">
              The packet is not on sale yet. It will cost {data.price.label}.
            </div>
          ) : null}
          {!data.purchased ? <div className="text-[12.5px] text-app-text-secondary leading-[18px] mt-3">{data.covers}</div> : null}
          <div className="text-[12.5px] text-app-text-secondary leading-[18px] mt-2">{data.note}</div>
        </div>
      ) : null}
    </div>
  );
}
