// /app/chat: the Messages list, with its first content read on the server for a
// document request (lib/firstContent.ts).
import FirstContent, { type FirstContentSearchParams } from '@/components/first-content/FirstContent';
import ChatListScreen from './ChatListScreen';

export default function MessagesPage({ searchParams }: { searchParams: FirstContentSearchParams }) {
  return <FirstContent route="/app/chat" searchParams={searchParams}><ChatListScreen /></FirstContent>;
}
