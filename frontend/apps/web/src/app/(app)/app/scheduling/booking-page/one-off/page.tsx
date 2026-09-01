// C4 — One-off / single-use booking link generator.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import OneOffGenerator from "@/components/scheduling/booking-page/OneOffGenerator";

export const metadata = {
  title: "One-off link · Booking link",
};

export default function OneOffLinkRoute() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link
          href="/app/scheduling/booking-page"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-app-text-secondary hover:text-app-text"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Booking link
        </Link>
        <h1 className="text-xl font-bold text-app-text-strong">
          Create a one-off link
        </h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          A private, optionally single-use link for one person.
        </p>
      </div>
      <OneOffGenerator />
    </div>
  );
}
