import { redirect } from 'next/navigation';

const HOME_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The Mailbox's own address. The old list page here (a second mailbox with
 * its own scopes and tabs) retired when Mail became its own tab (2026-10-27):
 * this opens the drawer pages, Me by default, and the Home drawer for Home
 * links (`?scope=home&homeId=…` from the Home sidebar, Hub cards and Home
 * records), keeping the Home's id for the drawer. While Mailbox is off, the
 * middleware sends this address to Messages before it gets here.
 */
export default async function MailboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope, homeId } = await searchParams;
  if (scope !== 'home') redirect('/app/mailbox/personal');
  redirect(typeof homeId === 'string' && HOME_ID.test(homeId)
    ? `/app/mailbox/home?homeId=${homeId.toLowerCase()}`
    : '/app/mailbox/home');
}
