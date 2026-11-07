'use client';

import { useState } from 'react';
import * as api from '@pantopus/api';
import type { CountyPage, CountyRecordSection, FloorPlanSuggestion, HouseholdFact, HouseholdFactChange, HouseholdGroup, HouseholdPart, HouseholdQuestion } from '@pantopus/api';
import { ExternalLink } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { toast } from '@/components/ui/toast-store';

const CHIP = 'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50';
const chipClass = (selected: boolean) =>
  `${CHIP} ${selected ? 'border-black bg-app-surface-raised text-app-text-strong' : 'border-app-border text-app-text-secondary hover:border-app-text-muted'}`;
const LINK = 'text-xs font-semibold text-violet-700 hover:underline disabled:opacity-50';

/** "Bedrooms? 1 2 3 4 Other". A tap answers it; Other is the person's own number. */
export function QuickQuestion({ question, value, disabled = false, onAnswer, onOther }: {
  question: HouseholdQuestion;
  value?: string;
  disabled?: boolean;
  onAnswer: (value: string) => void;
  onOther: () => void;
}) {
  const known = question.options.some((option) => option.value === value);
  return (
    <div role="group" aria-label={question.prompt} className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-app-text-strong">{question.prompt}</span>
      {question.options.map((option) => (
        <button key={option.value} type="button" disabled={disabled} aria-pressed={option.value === value} onClick={() => onAnswer(option.value)} className={chipClass(option.value === value)}>
          {option.label}
        </button>
      ))}
      <button type="button" disabled={disabled} aria-pressed={!!value && !known} onClick={onOther} className={chipClass(!!value && !known)}>
        {question.other}
      </button>
    </div>
  );
}

/** The county's own page: a person checks a fact at the source and comes back to confirm it. */
export function CountyPageLink({ page }: { page: CountyPage }) {
  return (
    <a href={page.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 ${LINK}`}>
      {page.label}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

/** What the building's own floor-plan sheet says, above Add Home's fields: this unit's plan with "Is this your layout?", or the building's plans. */
export function FloorPlanNote({ part, answer, onAnswer }: {
  part: FloorPlanSuggestion;
  answer: 'yes' | 'no' | null;
  onAnswer: (answer: 'yes' | 'no') => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-app-border bg-app-surface-sunken/40 px-4 py-3">
      <p className="text-sm font-medium text-app-text-strong">{part.line}</p>
      <p className="text-xs text-app-text-muted">{part.source}</p>
      {part.prompt ? (
        <div role="group" aria-label={part.prompt} className="flex flex-wrap items-center gap-2 pt-1">
          <span className="mr-1 text-sm font-medium text-app-text-strong">{part.prompt}</span>
          <button type="button" aria-pressed={answer === 'yes'} onClick={() => onAnswer('yes')} className={chipClass(answer === 'yes')}>Yes</button>
          <button type="button" aria-pressed={answer === 'no'} onClick={() => onAnswer('no')} className={chipClass(answer === 'no')}>No</button>
        </div>
      ) : null}
      {answer === 'no' ? <p className="text-xs text-app-text-secondary">Thanks. We&apos;ll check this layout with the building. Change anything that&apos;s different below.</p> : null}
    </div>
  );
}

function FactField({ fact, draft, onDraft, onUndo, busy }: {
  fact: HouseholdFact;
  draft: string | undefined;
  onDraft: (value: string) => void;
  onUndo: () => void;
  busy: boolean;
}) {
  const value = draft ?? fact.current;
  const known = fact.options.some((option) => option.value.toLowerCase() === value.toLowerCase());
  const [typing, setTyping] = useState(false);
  const showField = !fact.options.length || typing || (!!value && !known);
  const inputId = `household-fact-${fact.key}`;
  return (
    <div role="group" aria-label={fact.label}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-app-text-strong">{fact.label}</label>
        {fact.can_undo ? <button type="button" disabled={busy} onClick={onUndo} className={LINK}>Undo</button> : null}
      </div>
      {fact.options.length ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {fact.options.map((option) => {
            const selected = !typing && option.value.toLowerCase() === value.toLowerCase();
            return (
              <button key={option.value} type="button" disabled={busy} aria-pressed={selected} onClick={() => { setTyping(false); onDraft(option.value); }} className={chipClass(selected)}>
                {option.label}
              </button>
            );
          })}
          <button type="button" disabled={busy} aria-pressed={showField} onClick={() => setTyping(true)} className={chipClass(showField)}>Other</button>
        </div>
      ) : null}
      {showField ? (
        <input
          id={inputId}
          value={value}
          disabled={busy}
          onChange={(event) => onDraft(event.target.value)}
          inputMode={fact.input === 'text' ? 'text' : fact.input === 'decimal' ? 'decimal' : 'numeric'}
          maxLength={fact.input === 'text' ? 80 : 12}
          placeholder={fact.unit || undefined}
          className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
        />
      ) : null}
      {fact.note ? <p className="mt-1 text-xs text-app-text-muted">{fact.note}</p> : null}
    </div>
  );
}

function FactEditor({ group, busy, onClose, onSave }: {
  group: HouseholdGroup;
  busy: boolean;
  onClose: () => void;
  onSave: (changes: HouseholdFactChange[]) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const changes: HouseholdFactChange[] = group.facts.flatMap((fact) => {
    const value = drafts[fact.key]?.trim();
    return value && value !== fact.current ? [{ key: fact.key, action: 'correct' as const, value }] : [];
  });
  const save = async () => { if (await onSave(changes)) onClose(); };
  return (
    <ModalShell open onClose={onClose} onCancel={onClose} cancelLabel="Cancel" title={group.title}
      subtitle={group.lead || "Tap what's right. The county's own record stays as it is."}
      submitLabel="Save" onSubmit={() => void save()} submitDisabled={!changes.length} submitting={busy}>
      <div className="space-y-5">
        {group.facts.map((fact) => (
          <FactField key={fact.key} fact={fact} draft={drafts[fact.key]} busy={busy}
            onDraft={(value) => setDrafts((current) => ({ ...current, [fact.key]: value }))}
            onUndo={() => void onSave([{ key: fact.key, action: 'undo' }]).then((saved) => { if (saved) onClose(); })} />
        ))}
      </div>
    </ModalShell>
  );
}

function ReportProblem({ section, homeId, onClose, onReported }: {
  section: CountyRecordSection;
  homeId: string;
  onClose: () => void;
  onReported: () => void;
}) {
  const [field, setField] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api.homes.reportRecordProblem(homeId, { section: section.id, field: field || null, note: note.trim() || null });
      toast.success("Thanks. We'll check it against the county's record.");
      onReported();
      onClose();
    } catch {
      toast.error("Couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalShell open onClose={onClose} onCancel={onClose} cancelLabel="Cancel" title="Report a problem"
      subtitle="We'll check it against the county's record. This page stays as it is until the county's record changes."
      submitLabel="Send" onSubmit={() => void send()} submitting={busy}>
      <div className="space-y-4">
        <div>
          <label htmlFor="record-problem-field" className="mb-1.5 block text-sm font-medium text-app-text-strong">What looks wrong?</label>
          <select id="record-problem-field" value={field} onChange={(event) => setField(event.target.value)} disabled={busy}
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm">
            <option value="">Something in {section.title}</option>
            {section.rows.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="record-problem-note" className="mb-1.5 block text-sm font-medium text-app-text-strong">Anything to add? (optional)</label>
          <textarea id="record-problem-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} disabled={busy}
            className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20" />
        </div>
      </div>
    </ModalShell>
  );
}

/**
 * The household's controls on Property details: `sectionFooter` sits at the foot of each
 * record card, `lead` above the record, `after` below it, `dialogs` anywhere. All of it
 * comes from what the server sends, so a server without it draws nothing new.
 */
export function useHouseholdFacts({ homeId, household, sections, onChanged }: {
  homeId: string;
  household: HouseholdPart | null | undefined;
  sections: CountyRecordSection[] | undefined;
  onChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<HouseholdGroup | null>(null);
  const [reporting, setReporting] = useState<CountyRecordSection | null>(null);
  const groups = household?.groups ?? [];

  const save = async (changes: HouseholdFactChange[]) => {
    setBusy(true);
    try {
      await api.homes.updateHome(homeId, { household_facts: changes });
      await onChanged();
      return true;
    } catch {
      toast.error("Couldn't save that. Check it and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const answerLayout = async (answer: 'yes' | 'no' | 'undo') => {
    setBusy(true);
    try {
      await api.homes.answerFloorPlan(homeId, answer);
      await onChanged();
    } catch {
      toast.error("Couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // "Is this your layout?": for a unit its building's sheet names, whoever lives there.
  const layout = household?.floor_plan;
  const layoutFooter = (sectionId: string) => {
    if (layout?.section_id !== sectionId || !(layout.prompt || layout.answered)) return null;
    return (
      <div className="flex flex-wrap items-center gap-2 bg-app-surface-sunken/40 px-3 py-2.5 text-xs">
        {layout.answered ? (
          <>
            <span className="text-app-text-secondary">{layout.answered}</span>
            {layout.can_undo ? <button type="button" disabled={busy} onClick={() => void answerLayout('undo')} className={LINK}>Undo</button> : null}
          </>
        ) : (
          <>
            <span className="font-medium text-app-text-strong">{layout.prompt}</span>
            <button type="button" disabled={busy} onClick={() => void answerLayout('yes')} className={chipClass(false)}>Yes</button>
            <button type="button" disabled={busy} onClick={() => void answerLayout('no')} className={chipClass(false)}>No</button>
          </>
        )}
      </div>
    );
  };

  const groupFooter = (sectionId: string) => {
    const group = groups.find((candidate) => candidate.section_id === sectionId);
    const section = sections?.find((candidate) => candidate.id === sectionId);
    if (!group || !section) return null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-app-surface-sunken/40 px-3 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {group.confirmed ? (
            <>
              <span className="text-app-text-secondary">{group.confirmed}</span>
              <button type="button" disabled={busy} onClick={() => void save([{ group: group.id, action: 'undo' }])} className={LINK}>Undo</button>
            </>
          ) : null}
          {group.prompt ? (
            <>
              <span className="font-medium text-app-text-strong">{group.prompt}</span>
              <button type="button" disabled={busy} onClick={() => void save([{ group: group.id, action: 'confirm' }])} className={chipClass(false)}>Yes</button>
            </>
          ) : null}
          {group.reported ? <span className="text-app-text-secondary">{group.reported}</span> : null}
        </div>
        {group.fix ? <button type="button" disabled={busy} onClick={() => setEditing(group)} className={LINK}>{group.fix}</button> : null}
        {group.report ? <button type="button" onClick={() => setReporting(section)} className={LINK}>{group.report}</button> : null}
      </div>
    );
  };

  const sectionFooter = (sectionId: string) => {
    const parts = [layoutFooter(sectionId), groupFooter(sectionId)].filter(Boolean);
    return parts.length ? <>{parts[0]}{parts[1]}</> : null;
  };

  const questionFact = (key: string) => groups.flatMap((group) => group.facts).find((fact) => fact.key === key);
  const answerOther = (question: HouseholdQuestion) => {
    const fact = questionFact(question.key);
    if (fact) setEditing({ id: fact.key, section_id: null, title: fact.label, prompt: null, confirmed: null, fix: null, facts: [{ ...fact, options: [] }], report: null, reported: null });
  };

  const lead = household?.questions.length ? (
    <section className="space-y-3 rounded-[28px] border border-app-border bg-app-surface px-5 py-5 shadow-sm">
      <h3 className="text-sm font-semibold text-app-text">A few quick questions</h3>
      {household.questions.map((question) => (
        <QuickQuestion key={question.key} question={question} disabled={busy}
          onAnswer={(value) => void save([{ key: question.key, action: 'correct', value }])} onOther={() => answerOther(question)} />
      ))}
      {household.county_page ? <CountyPageLink page={household.county_page} /> : null}
    </section>
  ) : null;

  const addDetails = groups.filter((group) => group.section_id === null);
  const after = (
    <>
      {household?.county_page && !household.questions.length && sections?.length ? (
        <div className="text-center"><CountyPageLink page={household.county_page} /></div>
      ) : null}
      {addDetails.map((group) => (
        <section key={group.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-app-border bg-app-surface px-5 py-4 shadow-sm">
          <p className="text-sm text-app-text-secondary">{group.lead}</p>
          <button type="button" disabled={busy} onClick={() => setEditing(group)} className={chipClass(false)}>{group.fix}</button>
        </section>
      ))}
    </>
  );

  const dialogs = (
    <>
      {editing ? <FactEditor key={editing.id} group={editing} busy={busy} onClose={() => setEditing(null)} onSave={save} /> : null}
      {reporting ? <ReportProblem section={reporting} homeId={homeId} onClose={() => setReporting(null)} onReported={() => void onChanged()} /> : null}
    </>
  );

  return { sectionFooter, lead, after, dialogs };
}
