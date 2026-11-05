// H15 — Notification / Reminder Permission & Channel Connect (W18 polish).
// Server shell + metadata; the interactive surface is the client manager.

import ChannelsManager from "@/components/scheduling/polish/ChannelsManager";

export const metadata = {
  title: "Reminder channels · Pantopus",
};

export default function SchedulingChannelsPage() {
  return <ChannelsManager />;
}
