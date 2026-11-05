import { redirect } from 'next/navigation';

// Place is the default landing for the authed app (the dashboard is the
// reason you have an account). Other surfaces remain directly reachable.
export default function AppIndexPage() {
  redirect('/app/place');
}
