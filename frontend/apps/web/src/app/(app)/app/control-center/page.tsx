import { redirect } from 'next/navigation';

/**
 * Control Center — redirects to the Hub page which serves as
 * the web's equivalent of mobile's control-center.tsx.
 *
 * Mobile's control-center renders: HubTopBar, HubActionStrip,
 * HubSetupBanner, HubPillarCards, HubDiscovery, HubJumpBackIn,
 * HubActivityLog — all of which are already rendered by the
 * web's /app/hub page.
 */
export default function ControlCenterPage() {
  redirect('/app/hub');
}
