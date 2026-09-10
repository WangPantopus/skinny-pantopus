'use client';

import { useEffect } from 'react';

/** Payment return parameters are neither durable state nor proof of success.
 * Run at the page boundary, including when the webhook already authorized it. */
export function usePaymentRedirectCleanup() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const keys = ['payment_intent', 'payment_intent_client_secret', 'setup_intent', 'setup_intent_client_secret', 'redirect_status'];
    if (!keys.some((key) => url.searchParams.has(key))) return;
    keys.forEach((key) => url.searchParams.delete(key));
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);
}
