// /app/feed: Pulse, with its first content read on the server for a document
// request (lib/firstContent.ts).
import FirstContent, { type FirstContentSearchParams } from '@/components/first-content/FirstContent';
import PulseScreen from './PulseScreen';

export default function PulsePage({ searchParams }: { searchParams: FirstContentSearchParams }) {
  return <FirstContent route="/app/feed" searchParams={searchParams}><PulseScreen /></FirstContent>;
}
