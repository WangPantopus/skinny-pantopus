'use client';

export default function ChatDateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-app-surface-raised text-app-text-secondary text-xs font-medium px-3 py-1 rounded-full">
        {label || 'Unknown date'}
      </div>
    </div>
  );
}
