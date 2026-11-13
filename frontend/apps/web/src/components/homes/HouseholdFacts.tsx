'use client';

import { useCallback, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import type { AddHomeCountyCheck, CountyPage, CountyRecordSection, DocumentFact, DocumentFactsAnswer, FloorPlanSuggestion, HouseholdCountyCheck, HouseholdDocumentsOffer, HouseholdFact, HouseholdFactChange, HouseholdGroup, HouseholdPart, HouseholdQuestion } from '@pantopus/api';
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
export function CountyPageLink({ page, onOpen }: { page: CountyPage; onOpen?: () => void }) {
  return (
    <a href={page.url} target="_blank" rel="noopener noreferrer" onClick={onOpen} className={`inline-flex items-center gap-1 ${LINK}`}>
      {page.label}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

/**
 * Whether this person opened the county's page for this Home on this device (link and confirm): "Is this right?"
 * waits for them to come back from it, and still asks after a reload. A browser that keeps nothing asks this visit only.
 */
export function useCountyPageOpened(homeId: string | null) {
  const key = homeId ? `pantopus.countyPageOpened.${homeId}` : null;
  const [opened, setOpened] = useState(() => {
    if (!key || typeof window === 'undefined') return false;
    try { return window.localStorage.getItem(key) === '1'; } catch { return false; }
  });
  const markOpened = useCallback(() => {
    setOpened(true);
    if (!key) return;
    try { window.localStorage.setItem(key, '1'); } catch { /* this visit only */ }
  }, [key]);
  return [opened, markOpened] as const;
}

/** Add Home's link and confirm: the county's page, then "Is this right?" over the form's own fields once the person is back. */
export function CountyCheckNote({ page, check, opened, checked, onOpen, onChecked, onFix }: {
  page: CountyPage;
  check: AddHomeCountyCheck;
  opened: boolean;
  checked: boolean;
  onOpen: () => void;
  onChecked: (checked: boolean) => void;
  onFix: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-app-border bg-app-surface-sunken/40 px-4 py-3">
      <CountyPageLink page={page} onOpen={onOpen} />
      {checked ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-app-text-secondary">{check.confirmed}</span>
          <button type="button" onClick={() => onChecked(false)} className={LINK}>Undo</button>
        </div>
      ) : opened ? (
        <>
          <p className="text-xs text-app-text-muted">{check.lead}</p>
          <div role="group" aria-label={check.prompt} className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-medium text-app-text-strong">{check.prompt}</span>
            <button type="button" onClick={() => onChecked(true)} className={chipClass(false)}>{check.confirm}</button>
            <button type="button" onClick={onFix} className={LINK}>{check.fix}</button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Link and confirm on Property details, for a home no county record answers: the county's page, then "Is this
 * right?" with year built, size, bedrooms and baths once the person is back. Yes keeps them as the household's own.
 */
function CountyCheckCard({ homeId, page, check, busy, onSave, onFix }: {
  homeId: string;
  page: CountyPage;
  check: HouseholdCountyCheck;
  busy: boolean;
  onSave: (changes: HouseholdFactChange[]) => Promise<boolean>;
  onFix: () => void;
}) {
  const [opened, markOpened] = useCountyPageOpened(homeId);
  const asking = opened || !!check.confirmed;
  return (
    <section aria-label={page.label} className="space-y-3 rounded-[28px] border border-app-border bg-app-surface px-5 py-5 shadow-sm">
      <CountyPageLink page={page} onOpen={markOpened} />
      {asking ? (
        <>
          <p className="text-sm text-app-text-secondary">{check.lead}</p>
          {check.facts.some((fact) => fact.value) ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
              {check.facts.map((fact) => (
                <div key={fact.key}>
                  <dt className="text-xs text-app-text-muted">{fact.label}</dt>
                  <dd className="font-medium text-app-text-strong">{fact.value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {check.confirmed ? (
              <>
                <span className="text-app-text-secondary">{check.confirmed}</span>
                {check.can_undo ? <button type="button" disabled={busy} onClick={() => void onSave([{ group: check.group, action: 'undo' }])} className={LINK}>Undo</button> : null}
              </>
            ) : null}
            {check.prompt ? (
              <>
                <span className="font-medium text-app-text-strong">{check.prompt}</span>
                <button type="button" disabled={busy} onClick={() => void onSave([{ group: check.group, action: 'confirm' }])} className={chipClass(false)}>Yes</button>
              </>
            ) : null}
            <button type="button" disabled={busy} onClick={onFix} className={check.prompt || check.confirmed ? LINK : chipClass(false)}>{check.fix}</button>
          </div>
        </>
      ) : null}
    </section>
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

function FactEditor({ group, busy, onClose, onSave, checkGroup }: {
  group: HouseholdGroup;
  busy: boolean;
  onClose: () => void;
  onSave: (changes: HouseholdFactChange[]) => Promise<boolean>;
  /** Opened from "Is this right?" after the county's page: what's saved is checked there, the facts left as they were too. */
  checkGroup?: string;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const changes: HouseholdFactChange[] = group.facts.flatMap((fact) => {
    const value = drafts[fact.key]?.trim();
    return value && value !== fact.current ? [{ key: fact.key, action: 'correct' as const, value, ...(checkGroup ? { via: 'county_page' as const } : {}) }] : [];
  });
  const save = async () => { if (await onSave(checkGroup ? [...changes, { group: checkGroup, action: 'confirm' }] : changes)) onClose(); };
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

/** "From your papers": a PDF of the home's own report, read for facts the household then checks. */
function DocumentsCard({ offer, reading, busy, onPick }: {
  offer: HouseholdDocumentsOffer;
  reading: boolean;
  busy: boolean;
  onPick: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="space-y-3 rounded-[28px] border border-app-border bg-app-surface px-5 py-4 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-app-text">{offer.title}</h3>
        <p className="text-sm text-app-text-secondary">{offer.lead}</p>
      </div>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onPick(file); }} />
      <button type="button" disabled={busy || reading} onClick={() => input.current?.click()} className={chipClass(false)}>
        {reading ? 'Reading your report…' : offer.action}
      </button>
    </section>
  );
}

type DocumentChoice = 'keep' | 'fix' | 'skip';
const DOCUMENT_CHOICES: Array<[DocumentChoice, string]> = [['keep', 'Right'], ['fix', 'Fix'], ['skip', 'Skip']];

/** One fact the report states, with where it says it: Right keeps it, Fix keeps the household's own value, Skip drops it. */
function DocumentFactRow({ fact, choice, draft, busy, onChoose, onDraft }: {
  fact: DocumentFact;
  choice: DocumentChoice | undefined;
  draft: string | undefined;
  busy: boolean;
  onChoose: (choice: DocumentChoice) => void;
  onDraft: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={fact.label} className="space-y-2 border-b border-app-border pb-4 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-app-text-strong">{fact.label}</span>
        <span className="text-sm font-semibold text-app-text">{fact.value}</span>
      </div>
      {fact.note ? <p className="text-xs text-app-text-muted">{fact.note}</p> : null}
      <p className="text-xs text-app-text-secondary">{fact.source}</p>
      <div className="flex flex-wrap gap-2">
        {DOCUMENT_CHOICES.map(([value, label]) => (
          <button key={value} type="button" disabled={busy} aria-pressed={choice === value} onClick={() => onChoose(value)} className={chipClass(choice === value)}>
            {label}
          </button>
        ))}
      </div>
      {choice === 'fix' ? (
        <FactField fact={{ ...fact, label: 'What it should say', note: null, can_undo: false }} draft={draft} onDraft={onDraft} onUndo={() => undefined} busy={busy} />
      ) : null}
    </div>
  );
}

/** "Check what we found": each fact the report states, kept only when the household says so. */
function DocumentFactsDialog({ answer, busy, onClose, onSave }: {
  answer: DocumentFactsAnswer;
  busy: boolean;
  onClose: () => void;
  onSave: (facts: Array<{ key: string; value: string }>) => void;
}) {
  const [choices, setChoices] = useState<Record<string, DocumentChoice>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (answer.message) {
    return (
      <ModalShell open onClose={onClose} onCancel={onClose} cancelLabel="Close" title={answer.title} subtitle={answer.subtitle}
        submitLabel="OK" onSubmit={onClose}>
        <p className="text-sm text-app-text-secondary">{answer.message}</p>
      </ModalShell>
    );
  }
  const kept = answer.facts.flatMap((fact) => {
    const choice = choices[fact.key];
    if (choice === 'keep') return [{ key: fact.key, value: fact.current }];
    const value = drafts[fact.key]?.trim();
    return choice === 'fix' && value ? [{ key: fact.key, value }] : [];
  });
  return (
    <ModalShell open onClose={onClose} onCancel={onClose} cancelLabel="Cancel" title="Check what we found" subtitle={`${answer.title} · ${answer.subtitle}`}
      submitLabel={kept.length ? `Save ${kept.length}` : 'Save'} onSubmit={() => onSave(kept)} submitDisabled={!kept.length} submitting={busy} maxWidth="max-w-xl">
      <div className="space-y-4">
        <p className="text-sm text-app-text-secondary">{answer.lead}</p>
        {answer.facts.map((fact) => (
          <DocumentFactRow key={fact.key} fact={fact} choice={choices[fact.key]} draft={drafts[fact.key]} busy={busy}
            onChoose={(choice) => setChoices((current) => ({ ...current, [fact.key]: choice }))}
            onDraft={(value) => setDrafts((current) => ({ ...current, [fact.key]: value }))} />
        ))}
        {answer.missing ? <p className="text-xs text-app-text-muted">{answer.missing}</p> : null}
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
  const [reading, setReading] = useState(false);
  const [found, setFound] = useState<DocumentFactsAnswer | null>(null);
  const groups = household?.groups ?? [];
  // Link and confirm: the county's page and "Is this right?" sit in a card of their own, so the link isn't drawn twice.
  const check = household?.county_check && household.county_page ? household.county_check : null;

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

  // "Add from a document": the server reads the file and keeps nothing; the household checks what it found.
  const readDocument = async (file: File) => {
    setReading(true);
    try {
      setFound(await api.homes.readDocumentFacts(homeId, file));
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Couldn't read that file. Please try again.");
    } finally {
      setReading(false);
    }
  };

  const saveDocument = async (facts: Array<{ key: string; value: string }>) => {
    if (!found) return;
    setBusy(true);
    try {
      const saved = await api.homes.saveDocumentFacts(homeId, { kind: found.kind, facts });
      await onChanged();
      setFound(null);
      toast.success(saved.message);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Couldn't save that. Check it and try again.");
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
      {household.county_page && !check ? <CountyPageLink page={household.county_page} /> : null}
    </section>
  ) : null;
  const fixCheck = () => {
    if (check) setEditing({ id: check.group, section_id: null, title: check.prompt || check.fix, lead: check.lead, prompt: null, confirmed: null, fix: null, facts: check.facts, report: null, reported: null });
  };
  const checkCard = check && household?.county_page ? (
    <CountyCheckCard homeId={homeId} page={household.county_page} check={check} busy={busy} onSave={save} onFix={fixCheck} />
  ) : null;

  const addDetails = groups.filter((group) => group.section_id === null);
  const after = (
    <>
      {household?.county_page && !check && !household.questions.length && sections?.length ? (
        <div className="text-center"><CountyPageLink page={household.county_page} /></div>
      ) : null}
      {addDetails.map((group) => (
        <section key={group.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-app-border bg-app-surface px-5 py-4 shadow-sm">
          <p className="text-sm text-app-text-secondary">{group.lead}</p>
          <button type="button" disabled={busy} onClick={() => setEditing(group)} className={chipClass(false)}>{group.fix}</button>
        </section>
      ))}
      {household?.documents ? <DocumentsCard offer={household.documents} reading={reading} busy={busy} onPick={(file) => void readDocument(file)} /> : null}
    </>
  );

  const dialogs = (
    <>
      {editing ? <FactEditor key={editing.id} group={editing} busy={busy} onClose={() => setEditing(null)} onSave={save} checkGroup={check && editing.id === check.group ? check.group : undefined} /> : null}
      {reporting ? <ReportProblem section={reporting} homeId={homeId} onClose={() => setReporting(null)} onReported={() => void onChanged()} /> : null}
      {found ? <DocumentFactsDialog answer={found} busy={busy} onClose={() => setFound(null)} onSave={(facts) => void saveDocument(facts)} /> : null}
    </>
  );

  return { sectionFooter, lead: lead || checkCard ? <>{lead}{checkCard}</> : null, after, dialogs };
}
