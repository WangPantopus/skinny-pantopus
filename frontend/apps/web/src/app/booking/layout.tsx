// Minimal public layout for the invitee manage flow (/booking/:token). No (app)
// chrome — a clean public surface, mirroring the support-trains standalone
// styling. The root layout provides QueryProvider + ToastContainer.

import type { ReactNode } from "react";

export default function BookingLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-app text-app">{children}</div>;
}
