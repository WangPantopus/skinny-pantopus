'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import TranslationBanner from '@/components/mailbox/TranslationBanner';

function TranslationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mailId = searchParams.get('id') || '';

  const [mail, setMail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<{ text: string; fromLang: string; toLang: string } | null>(null);
  const [showingTranslation, setShowingTranslation] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  useEffect(() => {
    if (!mailId) return;
    setLoading(true);
    api.mailboxV2.getMailItem(mailId)
      .then((result) => setMail(result.mail))
      .catch(() => toast.error('Failed to load mail'))
      .finally(() => setLoading(false));
  }, [mailId]);

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const result = await api.mailboxV2P3.translateMail(mailId);
      setTranslation({
        text: result.translated_text,
        fromLang: result.from_language,
        toLang: result.to_language,
      });
      setShowingTranslation(true);
    } catch {
      toast.error('Translation failed');
    } finally {
      setTranslating(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  if (!mail) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-app-text-secondary mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
      <p className="text-center text-app-text-muted py-16">Mail not found</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Translation</h1>
      </div>

      {/* Mail preview */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-4">
        <p className="text-sm font-semibold text-app-text mb-1">{mail.sender_display || mail.from || 'Unknown sender'}</p>
        <p className="text-sm text-app-text-secondary">{mail.subject || ''}</p>
        {mail.body_preview && <p className="text-xs text-app-text-muted mt-2 line-clamp-3">{mail.body_preview}</p>}
      </div>

      {/* Translation banner */}
      <TranslationBanner
        item={mail}
        detectedLanguage={mail.detected_language || translation?.fromLang || 'Unknown'}
        confidence={mail.language_confidence}
        translatedContent={translation?.text}
        onTranslate={handleTranslate}
        onShowOriginal={() => setShowingTranslation(false)}
        loading={translating}
        showingTranslation={showingTranslation}
      />

      {/* Original content */}
      {!showingTranslation && mail.ai_summary && (
        <div className="bg-app-surface border border-app-border rounded-xl p-5 mt-4">
          <h2 className="text-sm font-bold text-app-text-strong mb-2">Content</h2>
          <p className="text-sm text-app-text whitespace-pre-wrap">{mail.ai_summary}</p>
        </div>
      )}
    </div>
  );
}

export default function TranslationPage() { return <Suspense><TranslationContent /></Suspense>; }
