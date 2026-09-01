'use client';

import { Lightbulb } from 'lucide-react';

interface PostPrecheckProps {
  suggestions: Array<{ type: string; message: string }>;
  onDismiss: (index: number) => void;
}

export default function PostPrecheck({ suggestions, onDismiss }: PostPrecheckProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="mx-4 mb-2 space-y-1">
      {suggestions.map((s, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="mt-0.5 flex-shrink-0"><Lightbulb className="w-4 h-4" /></span>
          <span className="flex-1">{s.message}</span>
          <button onClick={() => onDismiss(i)} className="text-amber-400 hover:text-amber-600 font-bold ml-1 flex-shrink-0">✕</button>
        </div>
      ))}
    </div>
  );
}
