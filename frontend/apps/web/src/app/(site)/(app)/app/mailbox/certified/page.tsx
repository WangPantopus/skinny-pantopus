import { redirect } from 'next/navigation';

const MAIL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Older certified-mail links use the same reader and receipt controls as the
// mailbox list. The reader moves Home letters into their own drawer.
export default async function CertifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id } = await searchParams;
  redirect(typeof id === 'string' && MAIL_ID.test(id)
    ? `/app/mailbox/personal/${id}`
    : '/app/mailbox/personal');
}
