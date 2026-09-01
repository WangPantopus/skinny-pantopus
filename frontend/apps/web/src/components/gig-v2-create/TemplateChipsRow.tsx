'use client';

import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import type { SmartTemplate } from '@pantopus/types';

interface TemplateChipsRowProps {
  onSelect: (template: SmartTemplate) => void;
}

export default function TemplateChipsRow({ onSelect }: TemplateChipsRowProps) {
  const [templates, setTemplates] = useState<SmartTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.magicTask.getTemplateLibrary();
        if (!cancelled) setTemplates(res.templates || []);
      } catch {
        // Templates are optional
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-3">
        <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (templates.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-sm font-semibold text-app-text-strong mb-2">Quick templates</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className="flex-shrink-0 px-3.5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition"
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
