'use client';

import { useEffect, useState } from 'react';
import { Paperclip, CheckCircle, Clock, Pin } from 'lucide-react';
import * as api from '@pantopus/api';
import type { GigQuestion } from '@pantopus/types';
import FileUpload from '@/components/FileUpload';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

// ─── Types ───

interface QASectionProps {
  gigId: string;
  isMyGig: boolean;
  currentUserId?: string;
}

// ─── Component ───

export default function QASection({ gigId, isMyGig, currentUserId }: QASectionProps) {
  const [questions, setQuestions] = useState<GigQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [questionFiles, setQuestionFiles] = useState<File[]>([]);
  const [answerFiles, setAnswerFiles] = useState<File[]>([]);
  const [uploadingQuestionFiles, setUploadingQuestionFiles] = useState(false);
  const [uploadingAnswerFiles, setUploadingAnswerFiles] = useState(false);

  const loadQuestions = async () => {
    try {
      const data = await api.gigs.getGigQuestions(gigId);
      setQuestions(data.questions || []);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQuestions(); }, [gigId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAsk = async () => {
    if (!newQuestion.trim() || newQuestion.trim().length < 5) return;
    setSubmitting(true);
    try {
      let attachmentUrls: string[] = [];
      if (questionFiles.length > 0) {
        setUploadingQuestionFiles(true);
        const uploadRes = await api.upload.uploadGigQuestionMedia(gigId, questionFiles);
        attachmentUrls = (uploadRes?.media || []).map((m: Record<string, any>) => m.file_url).filter(Boolean) as string[];
      }
      await api.gigs.askGigQuestion(gigId, newQuestion.trim(), attachmentUrls);
      setNewQuestion('');
      setQuestionFiles([]);
      await loadQuestions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to post question');
    } finally {
      setUploadingQuestionFiles(false);
      setSubmitting(false);
    }
  };

  const handleAnswer = async (questionId: string) => {
    if (!answerText.trim()) return;
    setAnswerSubmitting(true);
    try {
      let attachmentUrls: string[] = [];
      if (answerFiles.length > 0) {
        setUploadingAnswerFiles(true);
        const uploadRes = await api.upload.uploadGigQuestionMedia(gigId, answerFiles);
        attachmentUrls = (uploadRes?.media || []).map((m: Record<string, any>) => m.file_url).filter(Boolean) as string[];
      }
      await api.gigs.answerGigQuestion(gigId, questionId, answerText.trim(), attachmentUrls);
      setAnsweringId(null);
      setAnswerText('');
      setAnswerFiles([]);
      await loadQuestions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to answer');
    } finally {
      setUploadingAnswerFiles(false);
      setAnswerSubmitting(false);
    }
  };

  const handleUpvote = async (questionId: string) => {
    try {
      await api.gigs.toggleUpvoteQuestion(gigId, questionId);
      await loadQuestions();
    } catch {}
  };

  const handlePin = async (questionId: string) => {
    try {
      await api.gigs.togglePinQuestion(gigId, questionId);
      await loadQuestions();
    } catch {}
  };

  const handleDelete = async (questionId: string) => {
    const yes = await confirmStore.open({ title: 'Delete this question?', confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.gigs.deleteGigQuestion(gigId, questionId);
      await loadQuestions();
    } catch {}
  };

  const pinnedQuestions = questions.filter((q) => q.is_pinned && q.status === 'answered');
  const otherQuestions = questions.filter((q) => !(q.is_pinned && q.status === 'answered'));
  const openCount = questions.filter((q) => q.status === 'open').length;
  const answeredCount = questions.filter((q) => q.status === 'answered').length;
  const renderAttachments = (urls: string[] = []) => {
    if (!urls || urls.length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {urls.map((url, idx) => (
          <a
            key={`${url}-${idx}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-app-surface-sunken hover:bg-app-hover text-xs text-app-text-strong"
          >
            <span><Paperclip className="w-3 h-3 inline-block" /></span>
            <span className="max-w-[220px] truncate">{url.split('/').pop() || `Attachment ${idx + 1}`}</span>
          </a>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-app-surface rounded-xl p-6 border border-app-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-app-text">
          Questions ({questions.length})
        </h2>
        <div className="flex gap-2 text-xs">
          {answeredCount > 0 && (
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{answeredCount} answered</span>
          )}
          {openCount > 0 && (
            <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{openCount} awaiting</span>
          )}
        </div>
      </div>

      {/* Pinned answers shown prominently */}
      {pinnedQuestions.length > 0 && (
        <div className="mb-4 space-y-2">
          {pinnedQuestions.map((q) => (
            <div key={q.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium mb-1">
                <Pin className="w-3 h-3 inline-block" /> Pinned Answer
              </div>
              <p className="text-sm font-medium text-app-text mb-1">Q: {q.question}</p>
              {renderAttachments(q.question_attachments || [])}
              <p className="text-sm text-app-text-strong">A: {q.answer}</p>
              {renderAttachments(q.answer_attachments || [])}
            </div>
          ))}
        </div>
      )}

      {/* Ask a question form */}
      {currentUserId && !isMyGig && (
        <div className="mb-5 border border-app-border rounded-lg p-3">
          <textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Ask a question about this gig..."
            rows={2}
            maxLength={1000}
            className="w-full border-0 resize-none text-sm focus:ring-0 p-0 placeholder-gray-400"
          />
          <div className="mt-3">
            <FileUpload
              compact
              accept={['image', 'video', 'document']}
              maxFiles={10}
              maxSize={100 * 1024 * 1024}
              files={questionFiles}
              onFilesSelected={setQuestionFiles}
              helperText="Attach images, videos, or documents (optional)."
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-app-text-muted">{newQuestion.length}/1000</span>
            <button
              onClick={handleAsk}
              disabled={submitting || uploadingQuestionFiles || newQuestion.trim().length < 5}
              className="bg-primary-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
            >
              {submitting || uploadingQuestionFiles ? 'Posting…' : 'Ask Question'}
            </button>
          </div>
        </div>
      )}

      {/* Questions list */}
      {loading ? (
        <p className="text-sm text-app-text-secondary text-center py-4">Loading questions...</p>
      ) : otherQuestions.length === 0 && pinnedQuestions.length === 0 ? (
        <p className="text-sm text-app-text-secondary text-center py-4">No questions yet. Be the first to ask!</p>
      ) : (
        <div className="space-y-3">
	          {otherQuestions.map((q) => {
	            const asker = (q.asker || {}) as NonNullable<GigQuestion['asker']>;
            const askerName = asker.name || [asker.first_name, asker.last_name].filter(Boolean).join(' ') || asker.username || 'Anonymous';
            const isMyQuestion = currentUserId && String(asker.id) === String(currentUserId);
            const timeAgoStr = q.created_at ? timeAgo(q.created_at) : '';

            return (
              <div key={q.id} className="border border-app-border-subtle rounded-lg p-3">
                {/* Question */}
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => handleUpvote(q.id)}
                    className="flex flex-col items-center pt-0.5 text-app-text-muted hover:text-primary-600 min-w-[28px]"
                    title="Upvote"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    <span className="text-xs font-medium">{q.upvote_count || 0}</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-app-text">{q.question}</p>
                    {renderAttachments(q.question_attachments || [])}
                    <div className="flex items-center gap-2 mt-1 text-xs text-app-text-muted">
                      {asker?.username ? (
                        <UserIdentityLink
                          userId={asker?.id || null}
                          username={asker.username}
                          displayName={askerName}
                          avatarUrl={asker?.profile_picture_url || null}
                          city={asker?.city || null}
                          state={asker?.state || null}
                          textClassName="text-xs text-app-text-secondary hover:underline"
                        />
                      ) : (
                        <span>{askerName}</span>
                      )}
                      <span>•</span>
                      <span>{timeAgoStr}</span>
                      {q.status === 'answered' && (
                        <span className="text-green-600 font-medium"><CheckCircle className="w-3 h-3 inline-block" /> Answered</span>
                      )}
                      {q.status === 'open' && (
                        <span className="text-yellow-600 font-medium"><Clock className="w-3 h-3 inline-block" /> Awaiting answer</span>
                      )}
                    </div>

                    {/* Answer */}
                    {q.answer && (
                      <div className="mt-2 bg-green-50 rounded-md p-2.5 border-l-2 border-green-400">
                        <div className="text-xs text-green-700 font-medium mb-0.5">
                          {q.answerer?.username ? (
                            <>
                              <UserIdentityLink
                                userId={q.answerer?.id || null}
                                username={q.answerer.username}
                                displayName={q.answerer_display_name || q.answerer?.name || q.answerer?.username || 'Poster'}
                                avatarUrl={q.answerer?.profile_picture_url || null}
                                city={q.answerer?.city || null}
                                state={q.answerer?.state || null}
                                textClassName="text-xs text-green-700 hover:underline"
                              />{' '}
                              answered:
                            </>
                          ) : (
                            `${q.answerer_display_name || q.answerer?.name || q.answerer?.username || 'Poster'} answered:`
                          )}
                        </div>
                        <p className="text-sm text-app-text-strong">{q.answer}</p>
                        {renderAttachments(q.answer_attachments || [])}
                      </div>
                    )}

                    {/* Answer form (poster only, unanswered) */}
                    {isMyGig && q.status === 'open' && answeringId === q.id && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Write your answer..."
                          rows={2}
                          maxLength={2000}
                          className="w-full border border-app-border rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary-500"
                        />
                        <FileUpload
                          compact
                          accept={['image', 'video', 'document']}
                          maxFiles={10}
                          maxSize={100 * 1024 * 1024}
                          files={answerFiles}
                          onFilesSelected={setAnswerFiles}
                          helperText="Attach files with your answer (optional)."
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => { setAnsweringId(null); setAnswerText(''); setAnswerFiles([]); }}
                            className="text-xs text-app-text-secondary hover:text-app-text-strong px-2 py-1"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAnswer(q.id)}
                            disabled={answerSubmitting || uploadingAnswerFiles || !answerText.trim()}
                            className="text-xs bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 disabled:opacity-50"
                          >
                            {answerSubmitting || uploadingAnswerFiles ? 'Posting…' : 'Post Answer'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 mt-2">
                      {isMyGig && q.status === 'open' && answeringId !== q.id && (
                        <button
                          onClick={() => { setAnsweringId(q.id); setAnswerText(''); setAnswerFiles([]); }}
                          className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                        >
                          Answer
                        </button>
                      )}
                      {isMyGig && q.status === 'answered' && (
                        <button
                          onClick={() => handlePin(q.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {q.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                      )}
                      {(isMyQuestion || isMyGig) && (
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
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
