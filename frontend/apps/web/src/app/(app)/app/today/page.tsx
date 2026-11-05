// Today — the daily briefing as a first-class tab (wedge Phase 1.5, D2).
// Hosts the same screen as /app/hub/today, with its first content read on the
// server for a document request (lib/firstContent.ts); that route stays for
// deep links and the morning push.
import FirstContent, { type FirstContentSearchParams } from '@/components/first-content/FirstContent';
import HubTodayPage from '../hub/today/page';

export default function TodayPage({ searchParams }: { searchParams: FirstContentSearchParams }) {
  return <FirstContent route="/app/today" searchParams={searchParams}><HubTodayPage /></FirstContent>;
}
