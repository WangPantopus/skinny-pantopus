import { redirect } from 'next/navigation';

// The door moved to /app/nearby (wedge Phase 1.5 tab rename). Shipped
// clients and shared links still resolve here.
export default function NeighborhoodRedirect() {
  redirect('/app/nearby');
}
