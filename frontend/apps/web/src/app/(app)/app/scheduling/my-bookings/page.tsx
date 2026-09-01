// D11 — My bookings (customer-side). The scheduling layout supplies the
// AppShell chrome, section nav, and SchedulingOwnerProvider; this route renders
// the booker's own outgoing bookings across every host.

import { MyBookingsList } from "@/components/scheduling/public/edge";

export const metadata = {
  title: "My bookings · Scheduling",
};

export default function MyBookingsRoute() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-app-text-strong">My bookings</h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          Everything you’ve booked, in one place.
        </p>
      </div>
      <MyBookingsList />
    </div>
  );
}
