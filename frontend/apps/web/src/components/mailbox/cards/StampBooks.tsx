"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { get, post } from "@pantopus/api";

type Balance = {
  available: number;
  free_remaining: number;
  paid_remaining: number;
  books: {
    id: string;
    credits: number;
    price_cents: number;
    currency: string;
  }[];
};
const path = "/api/mailbox/stamp-books";

/** Checkout opens separately so the card, including its request ID, stays on this desk. */
export default function StampBooks({ refreshKey }: { refreshKey: string }) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<{ product: string; id: string } | null>(null);
  const refresh = useCallback(async () => {
    try {
      setBalance(await get<Balance>(path));
    } catch {
      setMessage("Could not load your stamps. Try refreshing.");
    }
  }, []);
  useEffect(() => {
    setMessage(null);
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh, refreshKey]);
  useEffect(() => {
    const url = new URL(window.location.href);
    const session = url.searchParams.get("stamp_session");
    if (!session) return;
    void post(path + "/confirm", { provider: "stripe", reference: session })
      .then(async () => {
        setMessage(
          "Your stamps are ready. You can return to the tab with your card.",
        );
        url.searchParams.delete("stamp_session");
        window.history.replaceState(window.history.state, "", url);
        await refresh();
      })
      .catch(() =>
        setMessage(
          "Your payment is being checked. Refresh your balance in a moment; do not pay again.",
        ),
      );
  }, [refresh]);
  async function buy(product: string) {
    // Open during the click, before the network request, to avoid popup blockers.
    const checkout = window.open("about:blank", "_blank");
    if (!checkout) {
      setMessage("Allow a new tab to open checkout. Your card will stay here.");
      return;
    }
    checkout.opener = null;
    setBusy(true);
    setMessage(null);
    request.current =
      request.current?.product === product
        ? request.current
        : { product, id: crypto.randomUUID() };
    try {
      const result = await post<{ url: string }>(path + "/checkout", {
        product_id: product,
        request_id: request.current.id,
      });
      checkout.location.href = result.url;
      request.current = null;
      setMessage(
        "Complete payment in the checkout tab, then refresh your stamps here.",
      );
    } catch {
      checkout.close();
      setMessage("Checkout could not open. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="mx-4 my-3 rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] p-3 text-sm text-[#374151]"
      aria-label="Digital stamp books"
    >
      <p className="font-semibold">
        {balance
          ? `${balance.available} digital stamp${balance.available === 1 ? "" : "s"} available`
          : "Your digital stamps"}
      </p>
      <p className="mt-1">
        One stamp sends one Christmas card to one recipient. Your first 3 are
        free. Receiving and replies are always free.
      </p>
      <details
        className="mt-2"
        open={balance?.available === 0 ? true : undefined}
      >
        <summary className="cursor-pointer font-medium">
          Buy a stamp book
        </summary>
        <p className="my-2">
          Digital delivery only. Purchased stamps never expire.
        </p>
        <div className="flex flex-wrap gap-2">
          {balance?.books.map((book) => (
            <button
              key={book.id}
              disabled={busy}
              onClick={() => void buy(book.id)}
              className="rounded-lg bg-[#8b1d1d] px-3 py-2 text-white disabled:opacity-50"
            >
              {book.credits} stamps ·{" "}
              {new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: book.currency,
              }).format(book.price_cents / 100)}
            </button>
          ))}
        </div>
      </details>
      <button
        className="mt-2 underline"
        onClick={() => {
          setMessage(null);
          void refresh();
        }}
      >
        Refresh balance
      </button>
      {message && (
        <p role="status" className="mt-2">
          {message}
        </p>
      )}
    </section>
  );
}
