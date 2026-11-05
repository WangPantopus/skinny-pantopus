// Holds /app/place's first bytes for its first content (components/first-content/FirstContentHold.tsx).
import FirstContentHold from '@/components/first-content/FirstContentHold';
import type { FirstContentSearchParams } from '@/components/first-content/FirstContent';

export default function PlaceFirstContent({ searchParams }: { searchParams: FirstContentSearchParams }) {
  return <FirstContentHold route="/app/place" searchParams={searchParams} />;
}
