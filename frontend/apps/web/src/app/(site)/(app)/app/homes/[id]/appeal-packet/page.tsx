'use client';

// The Home Money Check's appeal packet: what it holds, and the download. Every word comes from the server
// (backend/services/appealPacket.js), so the page and the PDF say the same thing. Only the Home's confirmed owner gets
// one, where the county is switched on for it and values the home above similar homes; anyone else sees that there is
// none for this home.

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import * as api from '@pantopus/api';

export default function AppealPacketPage() {
  const { id: homeId } = useParams<{ id: string }>();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const packet = useQuery({
    queryKey: ['home', homeId, 'appeal-packet'],
    queryFn: () => api.homeProfile.getAppealPacket(homeId),
    staleTime: 0,
  });

  const download = async (fileName: string) => {
    setSaving(true);
    setFailed(false);
    try {
      const blob = await api.homeProfile.downloadAppealPacket(homeId);
      const url = URL.createObjectURL(blob);
      try { const link = document.createElement('a'); link.href = url; link.download = fileName; link.click(); }
      finally { URL.revokeObjectURL(url); }
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const data = packet.data;
  return (
    <div className="max-w-2xl mx-auto px-4 py-8" data-testid="appeal-packet-page">
      <Link href="/app/place/money" className="mb-5 inline-flex items-center gap-2 text-sm text-app-text-secondary hover:text-app-text-strong">
        <ArrowLeft className="h-4 w-4" />
        Money signals
      </Link>

      {packet.isLoading ? <div className="text-sm text-app-text-secondary">Loading…</div> : null}

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

          <button
            type="button"
            onClick={() => void download(data.file_name)}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
            data-testid="appeal-packet-download"
          >
            <Download size={16} />
            {saving ? 'Preparing…' : 'Download the packet (PDF)'}
          </button>
          {failed ? <div role="alert" className="text-[13px] text-red-700 mt-2">The packet could not be made. Try again.</div> : null}
          <div className="text-[12.5px] text-app-text-secondary leading-[18px] mt-3">{data.note}</div>
        </div>
      ) : null}
    </div>
  );
}
