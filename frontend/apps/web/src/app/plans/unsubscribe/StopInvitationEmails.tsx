'use client';

import { useState } from 'react';

type State = { kind: 'ask' } | { kind: 'saving' } | { kind: 'done'; emailHint: string | null } | { kind: 'error'; message: string };

const PRIMARY_BUTTON =
  'flex h-[50px] w-full items-center justify-center rounded-xl bg-primary-600 text-base font-semibold text-white shadow-[0_6px_16px_rgba(2,132,199,0.18)] hover:opacity-95 disabled:opacity-60';

/** The button that stops Plans invitation emails to the address the email went to. */
export default function StopInvitationEmails({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: 'ask' });

  async function stop() {
    setState({ kind: 'saving' });
    try {
      const response = await fetch('/api/public/plans/invites/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setState({ kind: 'done', emailHint: typeof body.email_hint === 'string' ? body.email_hint : null });
      } else if (response.status === 404) {
        setState({ kind: 'error', message: "This link isn't valid anymore. Use the link in your newest invitation email." });
      } else {
        setState({ kind: 'error', message: "That didn't go through. Please try again." });
      }
    } catch {
      setState({ kind: 'error', message: "That didn't go through. Check your connection and try again." });
    }
  }

  if (state.kind === 'done') {
    return (
      <div className="flex flex-col gap-2 rounded-[20px] border border-app-border bg-app-surface p-4 shadow-sm" role="status">
        <h2 className="text-[17px] font-semibold leading-[22px]">You won&apos;t get invitation emails</h2>
        <p className="text-sm leading-5 text-app-text-secondary">
          Pantopus won&apos;t email {state.emailHint ?? 'this address'} when someone invites you to a plan. If you have a
          Pantopus account, invitations still show up in the app.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-5 text-app-text-secondary">
        Stop Pantopus from emailing this address when someone invites you to a plan. Invitations you already got keep
        working.
      </p>
      <button type="button" className={PRIMARY_BUTTON} onClick={stop} disabled={state.kind === 'saving'}>
        {state.kind === 'saving' ? 'Stopping…' : "Don't send me invitations"}
      </button>
      {state.kind === 'error' ? (
        <p className="text-sm leading-5 text-app-error" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
