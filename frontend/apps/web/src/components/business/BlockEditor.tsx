// @ts-nocheck
'use client';

/**
 * BlockEditor — right-panel editor for the selected block.
 * Renders a form specific to the block_type and calls onUpdate on change.
 */

import React from 'react';
import type { BlockData } from './BlockPreview';
import { confirmStore } from '@/components/ui/confirm-store';

interface BlockEditorProps {
  block: BlockData;
  onUpdate: (updated: BlockData) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function BlockEditor({ block, onUpdate, onDelete, onClose }: BlockEditorProps) {
  const updateData = (patch: Record<string, any>) => {
    onUpdate({ ...block, data: { ...block.data, ...patch } });
  };

  const updateSettings = (patch: Record<string, any>) => {
    onUpdate({ ...block, settings: { ...block.settings, ...patch } });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-app-border flex-shrink-0">
        <div>
          <div className="text-sm font-semibold text-app-text capitalize">
            {block.block_type.replace(/_/g, ' ')}
          </div>
          <div className="text-[10px] text-app-text-muted">Edit block settings</div>
        </div>
        <button onClick={onClose} className="text-app-text-muted hover:text-app-text-secondary p-1 rounded hover:bg-app-hover transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Visibility toggle */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={block.is_visible !== false}
              onChange={(e) => onUpdate({ ...block, is_visible: e.target.checked })}
              className="rounded border-app-border text-violet-600 focus:ring-violet-500"
            />
            <span className="text-app-text-strong text-xs font-medium">Visible</span>
          </label>
          {block.is_visible === false && (
            <span className="text-[10px] text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">Hidden from visitors</span>
          )}
        </div>

        {/* Type-specific fields */}
        <div className="border-t border-app-border-subtle pt-3">
          <BlockTypeFields block={block} updateData={updateData} onUpdate={onUpdate} />
        </div>

        {/* Block settings (padding / background) */}
        <details className="group border-t border-app-border-subtle pt-3">
          <summary className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider cursor-pointer select-none flex items-center gap-1">
            <svg className="w-3 h-3 text-app-text-muted group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Appearance
          </summary>
          <div className="mt-3 space-y-2">
            <div>
              <label className="block text-[10px] font-medium text-app-text-secondary mb-1">Padding</label>
              <select
                value={block.settings?.padding || 'default'}
                onChange={(e) => updateSettings({ padding: e.target.value })}
                className="w-full rounded-lg border border-app-border px-2 py-1.5 text-xs"
              >
                <option value="none">None</option>
                <option value="small">Small</option>
                <option value="default">Default</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-app-text-secondary mb-1">Background</label>
              <select
                value={block.settings?.background || 'default'}
                onChange={(e) => updateSettings({ background: e.target.value })}
                className="w-full rounded-lg border border-app-border px-2 py-1.5 text-xs"
              >
                <option value="default">Default (white)</option>
                <option value="gray">Gray</option>
                <option value="brand">Brand color</option>
                <option value="transparent">Transparent</option>
              </select>
            </div>
          </div>
        </details>

        {/* Schedule (all block types) */}
        <details className="group border-t border-app-border-subtle pt-3">
          <summary className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider cursor-pointer select-none flex items-center gap-1">
            <svg className="w-3 h-3 text-app-text-muted group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Schedule
            {(block.show_from || block.show_until) && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-[10px] text-app-text-muted">Control when this block is visible to visitors.</p>
            <EditorField
              label="Show from"
              value={block.show_from || ''}
              onChange={(v) => onUpdate({ ...block, show_from: v || undefined })}
              type="datetime-local"
            />
            <EditorField
              label="Show until"
              value={block.show_until || ''}
              onChange={(v) => onUpdate({ ...block, show_until: v || undefined })}
              type="datetime-local"
            />
            {(block.show_from || block.show_until) && (
              <button
                onClick={() => onUpdate({ ...block, show_from: undefined, show_until: undefined })}
                className="text-[10px] text-violet-600 hover:underline"
              >
                Clear schedule
              </button>
            )}
          </div>
        </details>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-app-border flex-shrink-0">
        <button
          onClick={async () => { const yes = await confirmStore.open({ title: 'Delete this block?', confirmLabel: 'Delete', variant: 'destructive' }); if (yes) onDelete(); }}
          className="w-full py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete block
        </button>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────
 * Type-specific editor fields
 * ───────────────────────────────────────────── */
function BlockTypeFields({
  block,
  updateData,
}: {
  block: BlockData;
  updateData: (patch: Record<string, any>) => void;
  onUpdate?: (b: BlockData) => void;
}) {
  const d = block.data || {};

  switch (block.block_type) {
    case 'hero':
      return (
        <>
          <EditorField label="Headline" value={d.headline || ''} onChange={(v) => updateData({ headline: v })} placeholder="Your business headline" />
          <EditorField label="Subhead" value={d.subhead || ''} onChange={(v) => updateData({ subhead: v })} placeholder="A short description" />
          <ImagePlaceholder label="Background image" fileId={d.background_file_id} />
          <CtaListEditor ctas={d.cta || []} onChange={(ctas) => updateData({ cta: ctas })} />
        </>
      );

    case 'text':
      return (
        <>
          <EditorField label="Heading" value={d.heading || ''} onChange={(v) => updateData({ heading: v })} placeholder="Section heading" />
          <EditorTextarea label="Body" value={d.body || ''} onChange={(v) => updateData({ body: v })} rows={6} placeholder="Write your content here..." />
        </>
      );

    case 'gallery':
      return (
        <>
          <EditorField label="Heading" value={d.heading || ''} onChange={(v) => updateData({ heading: v })} />
          <EditorField label="Image count" value={String(d.image_count || 6)} onChange={(v) => updateData({ image_count: Number(v) || 6 })} type="number" />
          <ImagePlaceholder label="Gallery images" fileId={null} note="Image uploads available in media manager" />
        </>
      );

    case 'catalog_grid':
      return (
        <>
          <EditorField label="Heading" value={d.heading || ''} onChange={(v) => updateData({ heading: v })} />
          <div>
            <label className="block text-xs font-medium text-app-text-secondary mb-1">Filter by type</label>
            <select
              value={d.filter_kind || ''}
              onChange={(e) => updateData({ filter_kind: e.target.value })}
              className="w-full rounded-lg border border-app-border px-3 py-1.5 text-sm"
            >
              <option value="">All items</option>
              <option value="service">Services</option>
              <option value="product">Products</option>
              <option value="menu_item">Menu items</option>
              <option value="class">Classes</option>
              <option value="rental">Rentals</option>
            </select>
          </div>
          <EditorField label="Max items" value={String(d.max_items || 8)} onChange={(v) => updateData({ max_items: Number(v) || 8 })} type="number" />
        </>
      );

    case 'hours':
      return (
        <>
          <EditorField label="Heading" value={d.heading || ''} onChange={(v) => updateData({ heading: v })} />
          <p className="text-[10px] text-app-text-muted">Hours data is pulled from your business locations.</p>
        </>
      );

    case 'locations_map':
      return (
        <>
          <EditorField label="Heading" value={d.heading || ''} onChange={(v) => updateData({ heading: v })} />
          <p className="text-[10px] text-app-text-muted">Locations are pulled from your business settings.</p>
        </>
      );

    case 'cta':
      return (
        <>
          <EditorField label="Heading" value={d.heading || ''} onChange={(v) => updateData({ heading: v })} placeholder="Get in touch" />
          <EditorField label="Subhead" value={d.subhead || ''} onChange={(v) => updateData({ subhead: v })} placeholder="We'd love to hear from you" />
          <CtaListEditor ctas={d.buttons || []} onChange={(buttons) => updateData({ buttons })} label="Buttons" />
        </>
      );

    case 'faq':
      return (
        <>
          <EditorField label="Heading" value={d.heading || ''} onChange={(v) => updateData({ heading: v })} />
          <FaqItemsEditor items={d.items || []} onChange={(items) => updateData({ items })} />
        </>
      );

    case 'reviews':
      return (
        <>
          <EditorField label="Heading" value={d.heading || ''} onChange={(v) => updateData({ heading: v })} />
          <p className="text-[10px] text-app-text-muted">Reviews are automatically pulled from your business profile.</p>
        </>
      );

    case 'stats':
      return <StatsEditor stats={d.stats || []} onChange={(stats) => updateData({ stats })} />;

    case 'team':
      return (
        <>
          <EditorField label="Heading" value={d.heading || ''} onChange={(v) => updateData({ heading: v })} />
          <p className="text-[10px] text-app-text-muted">Team members are pulled from your business team settings.</p>
        </>
      );

    case 'contact_form':
      return (
        <>
          <EditorField label="Heading" value={d.heading || ''} onChange={(v) => updateData({ heading: v })} />
          <p className="text-[10px] text-app-text-muted">Messages will be sent to your business email.</p>
        </>
      );

    case 'embed':
      return (
        <>
          <EditorField label="URL" value={d.url || ''} onChange={(v) => updateData({ url: v })} placeholder="https://youtube.com/watch?v=..." type="url" />
          <p className="text-[10px] text-app-text-muted">Supports YouTube, Vimeo, Google Maps, and other embeddable URLs.</p>
        </>
      );

    case 'posts_feed':
      return (
        <>
          <EditorField label="Heading" value={d.heading || ''} onChange={(v) => updateData({ heading: v })} />
          <EditorField label="Max items" value={String(d.max_items || 5)} onChange={(v) => updateData({ max_items: Number(v) || 5 })} type="number" />
        </>
      );

    case 'divider':
      return <p className="text-xs text-app-text-muted">A horizontal separator between sections. No settings needed.</p>;

    default:
      return <p className="text-xs text-app-text-muted">No editor for this block type.</p>;
  }
}


/* ─── Shared field components ──────────────── */

function EditorField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-app-text-secondary mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-app-border px-3 py-1.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
      />
    </div>
  );
}

function EditorTextarea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-app-text-secondary mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-lg border border-app-border px-3 py-1.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none transition"
      />
    </div>
  );
}

function ImagePlaceholder({ label, fileId, note }: { label: string; fileId?: string | null; note?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-app-text-secondary mb-1">{label}</label>
      <div className="w-full h-20 rounded-lg border-2 border-dashed border-app-border bg-app-surface-raised flex flex-col items-center justify-center text-app-text-muted hover:border-violet-300 hover:text-violet-400 transition cursor-pointer">
        {fileId ? (
          <span className="text-xs font-medium text-violet-600">Image attached</span>
        ) : (
          <>
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px]">{note || 'Click to upload'}</span>
          </>
        )}
      </div>
    </div>
  );
}


/* ─── CTA List Editor ──────────────────────── */

function CtaListEditor({
  ctas,
  onChange,
  label = 'CTAs',
}: {
  ctas: { label: string; action?: string }[];
  onChange: (ctas: { label: string; action?: string }[]) => void;
  label?: string;
}) {
  const add = () => onChange([...ctas, { label: '', action: '' }]);
  const remove = (i: number) => onChange(ctas.filter((_, idx) => idx !== i));
  const update = (i: number, key: string, val: string) => {
    const next = [...ctas];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-app-text-secondary">{label}</label>
        <button onClick={add} className="text-[10px] text-violet-600 hover:underline font-medium">+ Add</button>
      </div>
      {ctas.length === 0 ? (
        <p className="text-[10px] text-app-text-muted">No buttons yet. Click &quot;+ Add&quot; to create one.</p>
      ) : (
        <div className="space-y-2">
          {ctas.map((c, i) => (
            <div key={i} className="flex gap-1.5 items-start bg-app-surface-raised rounded-lg p-2">
              <input
                value={c.label}
                onChange={(e) => update(i, 'label', e.target.value)}
                placeholder="Label"
                className="flex-1 rounded border border-app-border px-2 py-1 text-xs"
              />
              <select
                value={c.action || ''}
                onChange={(e) => update(i, 'action', e.target.value)}
                className="w-24 rounded border border-app-border px-1 py-1 text-xs"
              >
                <option value="">Action</option>
                <option value="message">Message</option>
                <option value="call">Call</option>
                <option value="directions">Directions</option>
                <option value="link">Link</option>
                <option value="book">Book</option>
              </select>
              <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-xs pt-1 flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ─── FAQ Items Editor ─────────────────────── */

function FaqItemsEditor({
  items,
  onChange,
}: {
  items: { q: string; a: string }[];
  onChange: (items: { q: string; a: string }[]) => void;
}) {
  const add = () => onChange([...items, { q: '', a: '' }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, key: 'q' | 'a', val: string) => {
    const next = [...items];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-app-text-secondary">Questions</label>
        <button onClick={add} className="text-[10px] text-violet-600 hover:underline font-medium">+ Add</button>
      </div>
      {items.length === 0 ? (
        <p className="text-[10px] text-app-text-muted">No questions yet. Click &quot;+ Add&quot; to create one.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border border-app-border p-2.5 space-y-1.5 relative bg-app-surface-raised">
              <button onClick={() => remove(i)} className="absolute top-1.5 right-1.5 text-red-400 hover:text-red-600 text-xs">✕</button>
              <div>
                <label className="text-[10px] text-app-text-muted font-medium">Q{i + 1}</label>
                <input
                  value={item.q}
                  onChange={(e) => update(i, 'q', e.target.value)}
                  placeholder="What is your question?"
                  className="w-full rounded border border-app-border px-2 py-1 text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-app-text-muted font-medium">Answer</label>
                <textarea
                  value={item.a}
                  onChange={(e) => update(i, 'a', e.target.value)}
                  placeholder="Write the answer..."
                  rows={2}
                  className="w-full rounded border border-app-border px-2 py-1 text-xs resize-none mt-0.5"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ─── Stats Editor ─────────────────────────── */

function StatsEditor({
  stats,
  onChange,
}: {
  stats: { label: string; value: string }[];
  onChange: (stats: { label: string; value: string }[]) => void;
}) {
  const add = () => onChange([...stats, { label: '', value: '' }]);
  const remove = (i: number) => onChange(stats.filter((_, idx) => idx !== i));
  const update = (i: number, key: 'label' | 'value', val: string) => {
    const next = [...stats];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-app-text-secondary">Stats</label>
        <button onClick={add} className="text-[10px] text-violet-600 hover:underline font-medium">+ Add</button>
      </div>
      {stats.length === 0 ? (
        <p className="text-[10px] text-app-text-muted">No stats yet. Click &quot;+ Add&quot; to create one.</p>
      ) : (
        <div className="space-y-2">
          {stats.map((s, i) => (
            <div key={i} className="flex gap-1.5 items-start bg-app-surface-raised rounded-lg p-2">
              <input
                value={s.value}
                onChange={(e) => update(i, 'value', e.target.value)}
                placeholder="100+"
                className="w-20 rounded border border-app-border px-2 py-1 text-xs font-semibold"
              />
              <input
                value={s.label}
                onChange={(e) => update(i, 'label', e.target.value)}
                placeholder="Label"
                className="flex-1 rounded border border-app-border px-2 py-1 text-xs"
              />
              <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-xs pt-1 flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
