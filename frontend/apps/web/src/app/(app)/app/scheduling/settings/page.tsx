// A3 — Booking settings root (scheduling settings index).

import { Suspense } from "react";
import BookingSettings from "@/components/scheduling/hub/BookingSettings";

export const metadata = {
  title: "Booking settings · Pantopus",
};

export default function BookingSettingsPage() {
  return (
    <Suspense fallback={null}>
      <BookingSettings />
    </Suspense>
  );
}
