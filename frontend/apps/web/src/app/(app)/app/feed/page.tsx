// /app/feed: Pulse, with its first content read on the server for a document
// request (lib/firstContent.ts).
import FirstContent, { type FirstContentSearchParams } from '@/components/first-content/FirstContent';
import { pulseFirstContent } from '@/lib/server/firstContentReads';
import PulseScreen from './PulseScreen';

export default function PulsePage({ searchParams }: { searchParams: FirstContentSearchParams }) {
  return <FirstContent read={pulseFirstContent} searchParams={searchParams}><PulseScreen /></FirstContent>;
}
