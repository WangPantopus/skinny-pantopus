'use client';

import { useRef } from 'react';
import { useServerInsertedHTML } from 'next/navigation';

// First paint waits for the stylesheets, and a page's scripts ask for far more bytes at the same
// moment. A script after the stylesheets doesn't run until they've loaded, so the parser stops here
// instead of at the first script in <body>, and until it reaches <body> Chromium sends at most two
// low-priority requests at a time, on HTTP/1.1 and HTTP/2 alike. Every page script is low priority,
// so the stylesheets go first and the scripts follow; no code runs here.
//
// It has to be this hook: React writes a <head> child before the stylesheets, where it wouldn't
// wait for them, and Next inserts this HTML right before </head>.
export default function StylesheetsFirst() {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: ';' }} />;
  });
  return null;
}
