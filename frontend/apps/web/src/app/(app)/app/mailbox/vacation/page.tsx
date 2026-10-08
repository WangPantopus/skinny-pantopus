import { redirect } from 'next/navigation';

/**
 * Legacy Travel Mode page: redirects to the one the mailbox menu opens,
 * /app/mailbox/travel. This copy read the wrong homes response and refused
 * everyone with "You need a home to set vacation mode".
 */
export default function VacationPage() {
  redirect('/app/mailbox/travel');
}
