'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pin } from 'lucide-react';
import { formatTimeAgo } from '@pantopus/ui-utils';
import type { ListingDetail, ListingQuestion, User } from '@pantopus/types';

interface QASectionProps {
  listing: ListingDetail;
  user: User | null;
  isOwner: boolean;
  questions: ListingQuestion[];
  questionsLoading: boolean;
  onAskQuestion: (question: string) => Promise<void>;
  onAnswerQuestion: (questionId: string, answer: string) => Promise<void>;
  onUpvote: (questionId: string) => Promise<void>;
  onPin: (questionId: string) => Promise<void>;
  onDeleteQuestion: (questionId: string) => Promise<void>;
}

export default function QASection({
  user,
  isOwner,
  questions,
  questionsLoading,
  onAskQuestion,
  onAnswerQuestion,
  onUpvote,
  onPin,
  onDeleteQuestion,
}: QASectionProps) {
  const [newQuestion, setNewQuestion] = useState('');
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerSubmitting, setAnswerSubmitting] = useState(false);

  const pinnedQuestions = questions.filter(q => q.is_pinned && q.answer);
  const otherQuestions = questions.filter(q => !q.is_pinned || !q.answer);
  const answeredCount = questions.filter(q => q.status === 'answered').length;
  const openCount = questions.filter(q => q.status === 'open').length;

  const handleAskQuestion = async () => {
    if (newQuestion.trim().length < 5) return;
    setQuestionSubmitting(true);
    try {
      await onAskQuestion(newQuestion.trim());
      setNewQuestion('');
    } finally {
      setQuestionSubmitting(false);
    }
  };

  const handleAnswerQuestion = async (questionId: string) => {
    if (!answerText.trim()) return;
    setAnswerSubmitting(true);
    try {
      await onAnswerQuestion(questionId, answerText.trim());
      setAnsweringId(null);
      setAnswerText('');
    } finally {
      setAnswerSubmitting(false);
    }
  };

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-app-text">Questions ({questions.length})</h2>
        <div className="flex gap-2">
          {answeredCount > 0 && (
            <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">{answeredCount} answered</span>
          )}
          {openCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">{openCount} awaiting</span>
          )}
        </div>
      </div>

      {/* Pinned answers */}
      {pinnedQuestions.map(q => (
        <div key={q.id} className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-3">
          <span className="text-xs font-semibold text-blue-700 mb-1 inline-flex items-center gap-1"><Pin className="w-3 h-3" /> Pinned Answer</span>
          <p className="text-sm text-app-text-strong mb-1"><span className="font-medium">Q:</span> {q.question}</p>
          <p className="text-sm text-app-text"><span className="font-medium">A:</span> {q.answer}</p>
        </div>
      ))}

      {/* Ask question form (non-owner) */}
      {user?.id && !isOwner && (
        <div className="border border-app-border rounded-lg p-4 mb-4">
          <textarea
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
            placeholder="Ask a question about this listing..."
            maxLength={1000}
            rows={2}
            className="w-full text-sm border-0 p-0 focus:outline-none focus:ring-0 resize-none placeholder:text-app-text-muted"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-app-text-muted">{newQuestion.length}/1000</span>
            <button
              onClick={handleAskQuestion}
              disabled={questionSubmitting || newQuestion.trim().length < 5}
              className="px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {questionSubmitting ? 'Posting...' : 'Ask Question'}
            </button>
          </div>
        </div>
      )}

      {/* Questions list */}
      {questionsLoading ? (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : otherQuestions.length === 0 && pinnedQuestions.length === 0 ? (
        <p className="text-sm text-app-text-secondary text-center py-4">No questions yet. Be the first to ask!</p>
      ) : (
        <div className="space-y-3">
          {otherQuestions.map(q => {
            const asker = q.asker;
            const askerName = asker?.name || asker?.first_name || asker?.username || 'Anonymous';
            const isMyQuestion = user?.id && asker?.id && String(asker.id) === String(user.id);

            return (
              <div key={q.id} className="border border-app-border rounded-lg p-4">
                <div className="flex gap-3">
                  {/* Upvote column */}
                  <button onClick={() => onUpvote(q.id)} className="flex flex-col items-center pt-0.5 text-app-text-muted hover:text-primary-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    <span className="text-xs font-medium">{q.upvote_count || 0}</span>
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-app-text">{q.question}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-app-text-secondary">
                      {asker?.username ? (
                        <Link href={`/${asker.username}`} className="font-medium text-app-text-secondary">
                          {askerName}
                        </Link>
                      ) : (
                        <span className="font-medium">{askerName}</span>
                      )}
                      <span>·</span>
                      <span>{q.created_at ? formatTimeAgo(q.created_at) : ''}</span>
                      {q.status === 'answered' && (
                        <>
                          <span>·</span>
                          <span className="text-green-600 font-medium">Answered</span>
                        </>
                      )}
                    </div>

                    {/* Answer */}
                    {q.answer && (
                      <div className="mt-2 bg-app-surface-raised rounded-lg p-3">
                        <p className="text-xs font-medium text-app-text-secondary mb-1">Answer from seller:</p>
                        <p className="text-sm text-app-text">{q.answer}</p>
                      </div>
                    )}

                    {/* Answer form (owner, unanswered) */}
                    {isOwner && !q.answer && answeringId === q.id && (
                      <div className="mt-2">
                        <textarea
                          value={answerText}
                          onChange={e => setAnswerText(e.target.value)}
                          placeholder="Type your answer..."
                          maxLength={2000}
                          rows={2}
                          className="w-full text-sm border border-app-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            onClick={() => handleAnswerQuestion(q.id)}
                            disabled={answerSubmitting || !answerText.trim()}
                            className="px-3 py-1 bg-primary-600 text-white rounded-md text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
                          >
                            {answerSubmitting ? 'Submitting...' : 'Submit Answer'}
                          </button>
                          <button onClick={() => { setAnsweringId(null); setAnswerText(''); }} className="text-xs text-app-text-secondary hover:text-app-text-strong">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action links */}
                    <div className="flex gap-3 mt-2">
                      {isOwner && !q.answer && answeringId !== q.id && (
                        <button onClick={() => { setAnsweringId(q.id); setAnswerText(''); }} className="text-xs text-primary-600 font-medium hover:underline">
                          Answer
                        </button>
                      )}
                      {isOwner && q.status === 'answered' && (
                        <button onClick={() => onPin(q.id)} className="text-xs text-primary-600 font-medium hover:underline">
                          {q.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                      )}
                      {(isOwner || isMyQuestion) && (
                        <button onClick={() => onDeleteQuestion(q.id)} className="text-xs text-red-600 font-medium hover:underline">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
