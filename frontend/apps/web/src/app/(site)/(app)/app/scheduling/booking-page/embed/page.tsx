// C9 — Embed widget config (web-only). Builds a copyable snippet pointing at the
// bare iframe target /book/[slug]/embed, with a live preview.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import EmbedSnippetBuilder from "@/components/scheduling/booking-page/EmbedSnippetBuilder";

export const metadata = {
  title: "Embed widget · Booking link",
};

export default function EmbedWidgetRoute() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/app/scheduling/booking-page"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-app-text-secondary hover:text-app-text"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Booking link
        </Link>
        <h1 className="text-xl font-bold text-app-text-strong">
          Embed your booking widget
        </h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          Drop your booking flow onto your own site.
        </p>
      </div>
      <EmbedSnippetBuilder />
    </div>
  );
}
