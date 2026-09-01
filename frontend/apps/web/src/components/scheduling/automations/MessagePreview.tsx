"use client";

// W16 · H7 — Message Preview. A local panel that interpolates {{variables}} with
// realistic sample values and renders the result the way the channel would show
// it. Calls POST /message-templates/preview (server interpolation) with a
// client-side mirror for instant, offline-friendly feedback.

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type { MessageChannel } from "@pantopus/types";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import {
  buildSampleVars,
  channelMeta,
  extractVariables,
  interpolate,
} from "./templateMeta";

export default function MessagePreview({
  channel,
  subject,
  body,
  pillar = "personal",
}: {
  channel: MessageChannel;
  subject: string;
  body: string;
  pillar?: Pillar;
}) {
  const tk = pillarTokens(pillar);
  const meta = channelMeta(channel);
  const Icon = meta.icon;

  const usedVars = useMemo(
    () => extractVariables(subject, body),
    [subject, body],
  );
  const sampleVars = useMemo(() => buildSampleVars(usedVars), [usedVars]);

  // Instant client-side fill; replaced by the server result when it returns.
  const [filled, setFilled] = useState(() => ({
    subject: interpolate(subject, sampleVars),
    body: interpolate(body, sampleVars),
  }));
  const reqId = useRef(0);

  useEffect(() => {
    setFilled({
      subject: interpolate(subject, sampleVars),
      body: interpolate(body, sampleVars),
    });
    if (!body.trim()) return;
    const id = ++reqId.current;
    const t = setTimeout(() => {
      api.scheduling
        .previewMessageTemplate({
          subject: meta.needsSubject ? subject : undefined,
          body,
          variables: sampleVars,
        })
        .then((res) => {
          if (id === reqId.current)
            setFilled({ subject: res.subject ?? "", body: res.body ?? "" });
        })
        .catch(() => undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [subject, body, sampleVars, meta.needsSubject]);

  if (!body.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-app-border bg-app-surface-sunken p-6 text-center text-[12.5px] text-app-text-secondary">
        Add a message body to see the preview.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-sm">
        <div className={clsx("flex items-center gap-2 px-4 py-2.5", tk.bgSoft)}>
          <Icon className={clsx("h-4 w-4", tk.text)} aria-hidden />
          <span
            className={clsx(
              "text-[11.5px] font-bold uppercase tracking-wide",
              tk.text,
            )}
          >
            {meta.label} preview
          </span>
        </div>
        <div className="p-4">
          {meta.needsSubject && (
            <p className="mb-2 text-[14px] font-bold text-app-text">
              {filled.subject || (
                <span className="italic text-app-text-muted">No subject</span>
              )}
            </p>
          )}
          <p className="whitespace-pre-wrap text-[13.5px] leading-6 text-app-text">
            {filled.body}
          </p>
        </div>
      </div>

      {usedVars.length > 0 && (
        <div className="rounded-lg bg-app-surface-sunken px-3 py-2">
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-app-text-muted">
            Sample values
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {usedVars.map((v) => (
              <span key={v} className="text-[11.5px] text-app-text-secondary">
                <span className="font-mono text-app-text-muted">{`{{${v}}}`}</span>
                {" → "}
                <span className="font-medium text-app-text">
                  {sampleVars[v]}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
