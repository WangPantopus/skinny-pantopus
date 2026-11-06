// /app/place: the Place screen, with its first content read on the server for a
// document request (lib/firstContent.ts).
import FirstContent, { type FirstContentSearchParams } from '@/components/first-content/FirstContent';
import PlaceScreen from './PlaceScreen';

export default function PlacePage({ searchParams }: { searchParams: FirstContentSearchParams }) {
  return <FirstContent route="/app/place" searchParams={searchParams}><PlaceScreen /></FirstContent>;
}
