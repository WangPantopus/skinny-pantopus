// ============================================================
// WizardArchetype — linear multi-step flow shell (spec A12, web).
//
// Two visual variants:
//   variant: 'left-rail'  (default) — two-column: stepper on left,
//                                      content on right. Collapses
//                                      to top-segments under `md:`.
//   variant: 'top-segments'          — segmented progress bar on top
//                                      (mobile-parity).
//
// Content blocks use the same DSL as mobile:
//   headline, subcopy, requirements, uploadSlots, fields,
//   reviewSummary, successHero, timeline, custom.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Check, CheckCircle2, Circle, CloudUpload, X } from 'lucide-react';
import {
  Overline,
  ProgressSegments,
  SectionCard,
  StickyFooter,
  type StickyFooterProps,
} from '../primitives';

// ── Content blocks ───────────────────────────────────────────

export type WizardContentBlock =
  | { type: 'headline'; text: ReactNode }
  | { type: 'subcopy'; text: ReactNode }
  | {
      type: 'requirements';
      overline?: string;
      items: Array<{ icon?: LucideIcon; label: ReactNode; met?: boolean }>;
    }
  | {
      type: 'uploadSlots';
      overline?: string;
      slots: Array<{
        key: string;
        label: string;
        filled?: boolean;
        onClick?: () => void;
      }>;
    }
  | { type: 'fields'; overline?: string; children: ReactNode }
  | {
      type: 'reviewSummary';
      overline?: string;
      rows: Array<{ label: string; value: ReactNode }>;
    }
  | {
      type: 'successHero';
      icon?: LucideIcon;
      headline: ReactNode;
      subcopy?: ReactNode;
    }
  | {
      type: 'timeline';
      overline?: string;
      steps: Array<{
        label: ReactNode;
        caption?: ReactNode;
        state: 'done' | 'current' | 'upcoming';
      }>;
    }
  | { type: 'custom'; key: string; node: ReactNode };

export interface WizardStepMeta {
  key: string;
  label: string;
  description?: string;
}

export interface WizardArchetypeProps {
  title: ReactNode;
  variant?: 'left-rail' | 'top-segments';
  /** Full step list (used by the left-rail stepper). Required for left-rail variant. */
  steps?: WizardStepMeta[];
  /** 1-indexed current step. Also drives the progress bar fill count. */
  step?: number;
  /** Total step count — defaults to `steps.length`. */
  totalSteps?: number;
  onClose?: () => void;
  onBack?: () => void;
  /** Hide the progress row (success screens). */
  hideProgress?: boolean;
  /** Array of content blocks, or arbitrary children. */
  contentBlocks?: WizardContentBlock[];
  children?: ReactNode;
  /** Sticky footer with primary + optional secondary actions. */
  footer?: StickyFooterProps;
  className?: string;
}

export default function WizardArchetype({
  title,
  variant = 'left-rail',
  steps,
  step,
  totalSteps,
  onClose,
  onBack,
  hideProgress,
  contentBlocks,
  children,
  footer,
  className = '',
}: WizardArchetypeProps) {
  const safeTotal = totalSteps ?? steps?.length ?? 0;

  return (
    <div className={`max-w-5xl mx-auto ${className}`}>
      {/* Header: X close + title */}
      <div className="flex items-center gap-2 mb-6">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-md flex items-center justify-center text-app-text hover:bg-app-hover transition"
          >
            <X size={20} />
          </button>
        ) : null}
        <h1 className="text-lg font-semibold text-app-text truncate">{title}</h1>
        {!hideProgress && step != null && safeTotal > 0 ? (
          <span className="ml-auto text-xs font-semibold text-app-text-secondary">
            {step} of {safeTotal}
          </span>
        ) : null}
      </div>

      {/* Top-segments variant — progress bar spans full width */}
      {!hideProgress && variant === 'top-segments' && step != null && safeTotal > 0 ? (
        <div className="mb-6">
          <ProgressSegments step={step} totalSteps={safeTotal} hideReadout />
        </div>
      ) : null}

      {variant === 'left-rail' && steps && steps.length > 0 && !hideProgress ? (
        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-8">
          <aside className="hidden md:block">
            <LeftRailStepper steps={steps} currentStep={step ?? 1} />
          </aside>
          <div className="min-w-0">
            <div className="md:hidden mb-4">
              <ProgressSegments step={step ?? 1} totalSteps={safeTotal || steps.length} />
            </div>
            <WizardBody blocks={contentBlocks} onBack={onBack}>
              {children}
            </WizardBody>
          </div>
        </div>
      ) : (
        <WizardBody blocks={contentBlocks} onBack={onBack}>
          {children}
        </WizardBody>
      )}

      {footer ? <StickyFooter {...footer} /> : null}
    </div>
  );
}

// ── Left-rail stepper ────────────────────────────────────────

function LeftRailStepper({
  steps,
  currentStep,
}: {
  steps: WizardStepMeta[];
  currentStep: number;
}) {
  return (
    <ol className="space-y-4 sticky top-4">
      {steps.map((s, i) => {
        const idx = i + 1;
        const done = idx < currentStep;
        const current = idx === currentStep;
        const upcoming = idx > currentStep;
        const stateCls = done
          ? 'bg-app-success text-white'
          : current
          ? 'bg-primary-600 text-white'
          : 'bg-app-surface-sunken text-app-text-muted';
        return (
          <li key={s.key} className="flex items-start gap-3">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${stateCls}`}>
              {done ? <Check size={14} /> : idx}
            </span>
            <div className="min-w-0">
              <div
                className={`text-sm font-semibold ${current ? 'text-app-text' : upcoming ? 'text-app-text-muted' : 'text-app-text-secondary'}`}
              >
                {s.label}
              </div>
              {s.description ? (
                <div className="text-xs text-app-text-secondary mt-0.5 leading-snug">{s.description}</div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Content body ─────────────────────────────────────────────

function WizardBody({
  blocks,
  children,
  onBack,
}: {
  blocks?: WizardContentBlock[];
  children?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <div>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          ← Back
        </button>
      ) : null}
      {blocks?.map((b, idx) => (
        <WizardBlock key={blockKey(b, idx)} block={b} />
      ))}
      {children}
    </div>
  );
}

function blockKey(block: WizardContentBlock, idx: number) {
  return block.type === 'custom' ? block.key : `${block.type}-${idx}`;
}

function WizardBlock({ block }: { block: WizardContentBlock }) {
  switch (block.type) {
    case 'headline':
      return <h2 className="text-2xl font-bold text-app-text -tracking-[0.015em] mb-2 leading-tight">{block.text}</h2>;
    case 'subcopy':
      return <p className="text-[15px] text-app-text-secondary leading-relaxed mb-5">{block.text}</p>;
    case 'requirements':
      return (
        <SectionCard overline={block.overline} className="mb-4">
          <ul className="space-y-2">
            {block.items.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                {item.met ? (
                  <CheckCircle2 size={18} className="text-app-success shrink-0" />
                ) : item.icon ? (
                  <item.icon size={18} className="text-app-text-muted shrink-0" />
                ) : (
                  <Circle size={18} className="text-app-text-muted shrink-0" />
                )}
                <span className={`text-sm ${item.met ? 'text-app-text' : 'text-app-text-strong'}`}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      );
    case 'uploadSlots':
      return (
        <div className="mb-4">
          {block.overline ? <Overline className="mb-3">{block.overline}</Overline> : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {block.slots.map((slot) => (
              <button
                key={slot.key}
                type="button"
                onClick={slot.onClick}
                className={`flex flex-col items-center justify-center gap-2 py-6 rounded-xl transition ${
                  slot.filled
                    ? 'bg-app-success-bg border border-app-success-light'
                    : 'bg-primary-50 border-[1.5px] border-dashed border-primary-200 hover:bg-primary-100'
                }`}
              >
                {slot.filled ? (
                  <CheckCircle2 size={22} className="text-app-success" />
                ) : (
                  <CloudUpload size={22} className="text-primary-600" />
                )}
                <span className="text-xs font-medium text-app-text-strong">{slot.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    case 'fields':
      return (
        <div className="mb-4">
          {block.overline ? <Overline className="mb-2">{block.overline}</Overline> : null}
          {block.children}
        </div>
      );
    case 'reviewSummary':
      return (
        <SectionCard overline={block.overline} className="mb-4" padding="none">
          <dl className="divide-y divide-app-border">
            {block.rows.map((r, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-app-text-secondary">{r.label}</dt>
                <dd className="text-sm font-semibold text-app-text text-right flex-1 min-w-0 truncate">{r.value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      );
    case 'successHero': {
      const Icon = block.icon ?? Check;
      return (
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-[88px] h-[88px] rounded-full bg-app-success text-white flex items-center justify-center shadow-lg mb-5">
            <Icon size={44} />
          </div>
          <h2 className="text-2xl font-bold text-app-text -tracking-[0.015em] mb-3">{block.headline}</h2>
          {block.subcopy ? (
            <p className="text-[15px] text-app-text-secondary leading-relaxed max-w-md">{block.subcopy}</p>
          ) : null}
        </div>
      );
    }
    case 'timeline':
      return (
        <SectionCard overline={block.overline} className="mb-4">
          <ol className="space-y-0">
            {block.steps.map((s, i) => {
              const last = i === block.steps.length - 1;
              const dotCls =
                s.state === 'done'
                  ? 'bg-app-success'
                  : s.state === 'current'
                  ? 'bg-primary-600'
                  : 'bg-app-border-strong';
              return (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0 w-4">
                    <span className={`w-3 h-3 rounded-full mt-1 ${dotCls}`} />
                    {last ? null : <span className="flex-1 w-0.5 bg-app-border mt-1" />}
                  </div>
                  <div className="pb-4 flex-1 min-w-0">
                    <div
                      className={`text-sm font-semibold ${s.state === 'upcoming' ? 'text-app-text-muted' : 'text-app-text'}`}
                    >
                      {s.label}
                    </div>
                    {s.caption ? <div className="text-xs text-app-text-secondary mt-0.5">{s.caption}</div> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </SectionCard>
      );
    case 'custom':
      return <div className="mb-4">{block.node}</div>;
    default:
      return null;
  }
}
