'use client';

import { useCallback } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { copyToClipboard } from '@pantopus/utils';

/**
 * Copy this page's link (`path` on this site) for the iPhone app to pick up after an App Store install: its
 * first screen offers the link back with a Paste button. Resolves after the copy, or after a short wait at most,
 * so leaving for the store is never held up.
 */
export function copyPageLink(path: string): Promise<void> {
  const link = new URL(path, window.location.origin).toString();
  const copied = copyToClipboard(link).then(() => undefined);
  return Promise.race([copied, new Promise<void>((resolve) => window.setTimeout(resolve, 400))]);
}

type StoreLinkProps = {
  href: string;
  /** On an iPhone, the page's link to copy on the way to the App Store (`StoreDownloadCta.copyPath`). */
  copyPath?: string | null;
  className?: string;
  target?: string;
  rel?: string;
  children: ReactNode;
};

/** A store button. With `copyPath` it copies the page's link first, then opens the store in this tab. */
export default function StoreLink({ href, copyPath, className, target, rel, children }: StoreLinkProps) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!copyPath) return;
      event.preventDefault();
      void copyPageLink(copyPath).finally(() => window.location.assign(href));
    },
    [href, copyPath]
  );

  return (
    <a href={href} onClick={handleClick} className={className} target={target} rel={rel}>
      {children}
    </a>
  );
}
