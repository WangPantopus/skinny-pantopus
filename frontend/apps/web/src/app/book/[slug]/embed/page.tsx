// /book/[slug]/embed — the embeddable iframe target the C9 snippet points at.
// Bare (book/[slug]/embed/layout.tsx adds no chrome). A server shell reads the
// embed params and renders the client booker. Slots are fetched client-side
// (no-store) by the W0 SlotPicker; the booking hands off to the public flow.

import EmbedBooker from "@/components/scheduling/booking-page/EmbedBooker";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function EmbedTargetPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const theme = first(sp.theme) === "dark" ? "dark" : "light";
  const hideHeaderRaw = first(sp.hideHeader);
  const hideHeader = hideHeaderRaw === "1" || hideHeaderRaw === "true";
  const primary = first(sp.primary);

  return (
    <div style={{ colorScheme: theme }}>
      <EmbedBooker slug={slug} hideHeader={hideHeader} primary={primary} />
    </div>
  );
}
