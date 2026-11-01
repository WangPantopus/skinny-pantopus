import Link from 'next/link';
import { promptText } from '@/lib/profilePrompts';

interface GetToKnowSectionProps {
  /** Their first name as neighbors see it: "Get to know Rowan". */
  firstName: string;
  /** The person's prompts in saved order, as the profile read gives them. */
  prompts: Array<{ key: string; answer: string }> | null | undefined;
  /** Your own profile: where Edit goes (the editor's Prompts). */
  editHref?: string | null;
}

/**
 * "Get to know Rowan": the person's prompts and answers, in their order. Prompts from a newer catalog are skipped;
 * nothing shows when there are none.
 */
export default function GetToKnowSection({ firstName, prompts, editHref = null }: GetToKnowSectionProps) {
  const shown = (Array.isArray(prompts) ? prompts : [])
    .map((prompt) => ({ key: prompt?.key, text: prompt?.key ? promptText(prompt.key) : null, answer: prompt?.answer?.trim() }))
    .filter((prompt): prompt is { key: string; text: string; answer: string } => Boolean(prompt.text && prompt.answer));
  if (shown.length === 0) return null;
  const headingId = `get-to-know-${firstName.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <section className="mt-7" aria-labelledby={headingId}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-[1.25rem] leading-[1.5625rem] font-bold text-app">Get to know {firstName}</h2>
        {editHref ? (
          <Link href={editHref} className="min-h-[2.75rem] -my-2.5 -mr-2 px-2 flex items-center text-[1.0625rem] text-app-link">
            Edit<span className="sr-only"> your prompts</span>
          </Link>
        ) : null}
      </div>
      <dl className="rounded-2xl border border-app bg-surface px-4 py-0.5 divide-y divide-app">
        {shown.map((prompt) => (
          <div key={prompt.key} className="py-3">
            <dt className="text-[0.8125rem] leading-[1.125rem] font-semibold text-app-muted">{prompt.text}</dt>
            <dd className="mt-[0.1875rem] text-[1.0625rem] leading-[1.375rem] text-app [overflow-wrap:anywhere]">{prompt.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
