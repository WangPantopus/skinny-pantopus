import { redirect } from 'next/navigation';

/**
 * Control Center — an old address; Place is the web's first screen now.
 * next.config.js redirects it before this page renders.
 */
export default function ControlCenterPage() {
  redirect('/app/place');
}
