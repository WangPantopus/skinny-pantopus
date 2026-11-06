import { redirect } from 'next/navigation';

/**
 * Legacy New Message page: redirects to Messages, whose "New message" dialog
 * lists your connections as well as people search. Nothing links here; this
 * search-only copy couldn't reach a connection without a neighbor profile.
 */
export default function NewChatPage() {
  redirect('/app/chat');
}
