'use client';

import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import type { ProfilePrompt } from '@/hooks/useProfileForm';
import { MAX_PROFILE_PROMPTS, PROFILE_PROMPTS, PROMPT_ANSWER_MAX, promptText } from '@/lib/profilePrompts';

const helpClass = 'mt-1.5 text-[0.8125rem] leading-[1.125rem] text-app-muted';
const sheetButton = 'min-h-[2.75rem] px-4 rounded-xl text-[0.9375rem] font-semibold disabled:opacity-50';

interface PromptsFieldProps {
  /** Every saved prompt in order, keys from a newer catalog included (kept, not shown). */
  prompts: ProfilePrompt[];
  onChange: (prompts: ProfilePrompt[]) => void;
  /** The server's sentence when it refused the list. */
  error?: string;
}

/**
 * Edit profile's Prompts (up to 3): each answered prompt opens its answer to change or remove; "Add a prompt" opens
 * the picker, where prompts in use say so. Changes save with the rest of the page.
 */
export default function PromptsField({ prompts, onChange, error }: PromptsFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<{ key: string; isNew: boolean } | null>(null);
  const [draft, setDraft] = useState('');

  const known = prompts.filter((prompt) => promptText(prompt.key) !== null);
  const used = new Set(prompts.map((prompt) => prompt.key));
  const full = prompts.length >= MAX_PROFILE_PROMPTS;

  const openAnswer = (key: string) => {
    const saved = prompts.find((prompt) => prompt.key === key);
    setDraft(saved?.answer ?? '');
    setEditing({ key, isNew: !saved });
  };

  const done = () => {
    if (!editing) return;
    const answer = draft.replace(/\s+/g, ' ').trim();
    if (!answer) return;
    onChange(editing.isNew
      ? [...prompts, { key: editing.key, answer }]
      : prompts.map((prompt) => (prompt.key === editing.key ? { ...prompt, answer } : prompt)));
    setEditing(null);
  };

  const remove = () => {
    if (!editing) return;
    onChange(prompts.filter((prompt) => prompt.key !== editing.key));
    setEditing(null);
  };

  return (
    <section id="prompts" aria-labelledby="edit-prompts" className="mt-4 rounded-2xl border border-app bg-surface p-4 scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="edit-prompts" className="text-[1.0625rem] leading-[1.375rem] font-semibold text-app">Prompts</h3>
        <span className="text-[0.8125rem] leading-[1.125rem] text-app-muted">{prompts.length} of {MAX_PROFILE_PROMPTS}</span>
      </div>
      {known.length > 0 ? (
        <ul className="mt-1.5 divide-y divide-app">
          {known.map((prompt) => (
            <li key={prompt.key}>
              <button
                type="button"
                onClick={() => openAnswer(prompt.key)}
                className="w-full min-h-[4rem] py-2.5 flex items-center gap-2.5 text-left"
              >
                <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                  <span className="text-[0.8125rem] leading-[1.125rem] font-semibold text-app-muted">{promptText(prompt.key)}</span>
                  <span className="text-[0.9375rem] leading-5 text-app [overflow-wrap:anywhere]">
                    <span className="sr-only"> </span>
                    {prompt.answer}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 text-app-muted" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!full ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          className="mt-3 min-h-[3rem] px-4 rounded-xl border border-app-strong bg-surface text-base font-semibold text-app inline-flex items-center gap-1.5 hover-bg-app"
        >
          <Plus aria-hidden="true" className="w-4 h-4" />
          Add a prompt
        </button>
      ) : null}
      <p className={helpClass}>
        {known.length > 0
          ? `Tap one to change it. Answers can be up to ${PROMPT_ANSWER_MAX} characters.`
          : `Give neighbors something to ask you about: pick up to ${MAX_PROFILE_PROMPTS} prompts and answer each in a line.`}
      </p>
      {error ? <p role="alert" className="mt-1.5 text-[0.8125rem] leading-[1.125rem] text-red-600">{error}</p> : null}

      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Pick a prompt"
        subhead={`Pick up to ${MAX_PROFILE_PROMPTS}. A short, friendly answer works best.`}
      >
        <ul className="-my-1 divide-y divide-app">
          {PROFILE_PROMPTS.map((prompt) => {
            const inUse = used.has(prompt.key);
            return (
              <li key={prompt.key}>
                <button
                  type="button"
                  onClick={() => { setPickerOpen(false); openAnswer(prompt.key); }}
                  className="w-full min-h-[3rem] py-2.5 flex items-center justify-between gap-3 text-left text-[0.9375rem] leading-5 text-app"
                >
                  <span>{prompt.text}</span>
                  {inUse
                    ? <span className="shrink-0 text-[0.8125rem] font-semibold text-app-muted">In use</span>
                    : <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 text-app-muted" />}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? promptText(editing.key) ?? '' : ''}
        subhead="Neighbors see your answer on your profile."
        footer={(
          <div className="flex items-center justify-between gap-3">
            {editing && !editing.isNew ? (
              <button type="button" onClick={remove} className={`${sheetButton} -ml-2 text-red-600`}>Remove</button>
            ) : <span />}
            <button
              type="button"
              onClick={done}
              disabled={!draft.trim()}
              className={`${sheetButton} bg-primary-600 text-white hover:bg-primary-700`}
            >
              Done
            </button>
          </div>
        )}
      >
        <label htmlFor="prompt-answer" className="sr-only">Your answer</label>
        <textarea
          id="prompt-answer"
          rows={3}
          maxLength={PROMPT_ANSWER_MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              done();
            }
          }}
          aria-describedby="prompt-answer-count"
          // The sheet opens to type in.
          autoFocus
          className="w-full px-4 py-3 rounded-xl border border-app-strong bg-surface text-base text-app placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          placeholder="A short, friendly answer"
        />
        <p id="prompt-answer-count" className={`${helpClass} text-right`}>
          {draft.length} / {PROMPT_ANSWER_MAX}
        </p>
      </BottomSheet>
    </section>
  );
}
