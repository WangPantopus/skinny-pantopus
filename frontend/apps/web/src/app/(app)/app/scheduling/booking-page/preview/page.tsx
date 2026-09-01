// C2 — Public booking page preview (owner-mode flip). Inert "preview as invitee"
// render of the real public read, honoring paused / hidden states.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import PagePreview from "@/components/scheduling/booking-page/PagePreview";

export const metadata = {
  title: "Preview · Booking link",
};

export default function BookingPagePreviewRoute() {
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
        <h1 className="text-xl font-bold text-app-text-strong">Preview</h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          This is what people see at your public booking page.
        </p>
      </div>
      <PagePreview />
    </div>
  );
}
