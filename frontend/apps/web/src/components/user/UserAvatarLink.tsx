'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

interface Props {
  /** The page the name beside the photo links to, e.g. `/${username}`; nothing links without one. */
  href?: string | null;
  children: ReactNode;
  className?: string;
  stopPropagation?: boolean;
}

/**
 * A person's photo that opens the same page as their name beside it. The name stays the one link keyboards and
 * screen readers reach, so the photo is a second, pointer-only way in.
 */
export default function UserAvatarLink({ href, children, className = '', stopPropagation = true }: Props) {
  if (!href) return <>{children}</>;
  return (
    <Link
      href={href}
      tabIndex={-1}
      aria-hidden="true"
      className={`inline-flex flex-shrink-0 rounded-full ${className}`}
      onClick={(e) => { if (stopPropagation) e.stopPropagation(); }}
    >
      {children}
    </Link>
  );
}
