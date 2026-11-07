'use client';

/**
 * Constrains the conversation view to the viewport so the message list scrolls inside
 * the page instead of the document (fixes mouse wheel scrolling in the chat window).
 * On a phone it fills what the browser shows: 100vh can run under the browser's own bars.
 */
export default function ConversationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden flex-1 min-h-0 h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-3.5rem)]">
      {children}
    </div>
  );
}
