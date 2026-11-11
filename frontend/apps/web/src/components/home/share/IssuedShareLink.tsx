'use client';

import { useState } from 'react';

// A share link can be read only when it is created. It stays on screen until the
// person closes it, because a browser may refuse the clipboard (Safari does once
// a request has been awaited) and the link can't be fetched again.
export default function IssuedShareLink({
  url,
  title,
  note,
  onDone,
}: {
  url: string;
  title: string;
  note: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // The link stays selectable on screen.
    }
  };

  return (
    <div role="status" className="bg-app-surface-raised border border-app-border rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-app-text">{title}</p>
        <p className="text-xs text-app-text-secondary mt-0.5">{note}</p>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 text-xs font-mono bg-app-surface border border-app-border rounded-lg px-3 py-2 truncate select-all">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition flex-shrink-0"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-2 rounded-lg border border-app-border text-xs font-medium text-app-text-strong hover:bg-app-hover transition flex-shrink-0"
        >
          Done
        </button>
      </div>
    </div>
  );
}
