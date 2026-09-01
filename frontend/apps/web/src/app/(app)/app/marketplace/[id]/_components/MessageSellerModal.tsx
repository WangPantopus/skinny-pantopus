'use client';

interface MessageSellerModalProps {
  listing: { title: string };
  messageText: string;
  sendingMessage: boolean;
  onMessageTextChange: (text: string) => void;
  onSend: () => void;
  onClose: () => void;
}

export default function MessageSellerModal({
  listing,
  messageText,
  sendingMessage,
  onMessageTextChange,
  onSend,
  onClose,
}: MessageSellerModalProps) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-app-surface rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
          <h3 className="text-lg font-semibold text-app-text">Message Seller</h3>
          <button onClick={onClose} className="text-app-text-muted hover:text-app-text-secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6">
          <textarea
            value={messageText}
            onChange={e => onMessageTextChange(e.target.value)}
            placeholder={`Hi, I'm interested in "${listing.title}"...`}
            rows={4}
            className="w-full border border-app-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>
        <div className="px-6 py-4 border-t border-app-border flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-app-border text-app-text-strong rounded-lg font-medium text-sm hover:bg-app-hover">Cancel</button>
          <button onClick={onSend} disabled={sendingMessage || !messageText.trim()} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium text-sm hover:bg-primary-700 disabled:opacity-50">
            {sendingMessage ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
}
