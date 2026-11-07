'use client';

import { useRouter } from 'next/navigation';
import { AIAssistantView } from '@/components/ai-assistant';
import { navigateChatPath } from '@/hooks/useChatOfflineShell';

export default function AIAssistantPage() {
  const router = useRouter();
  return (
    <>
      <h1 className="sr-only">Pantopus Assistant</h1>
      {/* On a phone the thread scrolls inside the window, its composer at the bottom, as in a person's chat. */}
      <div className="max-md:h-[calc(100dvh-3.5rem)] max-md:min-h-0 max-md:flex-1">
        <AIAssistantView onBack={() => navigateChatPath('/app/chat', router.push)} />
      </div>
    </>
  );
}
