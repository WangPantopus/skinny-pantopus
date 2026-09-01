import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import Field from '../shared/Field';

interface PagesTabProps {
  pages: Record<string, any>[];
  businessId: string;
  onUpdate: () => void;
}

export default function PagesTab({ pages: initialPages, businessId, onUpdate }: PagesTabProps) {
  const [pages, setPages] = useState<Record<string, any>[]>(initialPages);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', slug: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { setPages(initialPages); }, [initialPages]);

  const addPage = async () => {
    if (!addForm.title || !addForm.slug) return;
    setSaving(true);
    try {
      await api.businesses.createPage(businessId, {
        title: addForm.title,
        slug: addForm.slug,
        show_in_nav: true,
      });
      setShowAdd(false);
      setAddForm({ title: '', slug: '' });
      onUpdate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const removePage = async (pageId: string) => {
    const yes = await confirmStore.open({ title: 'Delete this page?', description: 'This action cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.businesses.deletePage(businessId, pageId);
      onUpdate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-app">Pages</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
        >
          {showAdd ? 'Cancel' : 'Add page'}
        </button>
      </div>

      {showAdd && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 space-y-3">
          <Field label="Page title *" value={addForm.title} onChange={(v) => setAddForm({ ...addForm, title: v })} placeholder="e.g. Menu, About Us" />
          <Field
            label="Slug *"
            value={addForm.slug}
            onChange={(v) => setAddForm({ ...addForm, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            placeholder="e.g. menu, about"
          />
          <button onClick={addPage} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Page'}
          </button>
        </div>
      )}

      {pages.length === 0 ? (
        <div className="rounded-xl border border-app bg-surface p-6 text-center text-app-secondary">
          No pages yet.
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <div key={page.id} className="rounded-xl border border-app bg-surface p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-app">{page.title}</span>
                  {page.is_default && (
                    <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                      Default
                    </span>
                  )}
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                    page.published_revision > 0
                      ? 'text-green-700 bg-green-50 border border-green-200'
                      : 'text-app-secondary bg-surface-raised border border-app'
                  }`}>
                    {page.published_revision > 0 ? `v${page.published_revision}` : 'Unpublished'}
                  </span>
                </div>
                <div className="text-xs text-app-secondary mt-0.5">/{page.slug}</div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/app/businesses/${businessId}/pages/${page.id}/edit`}
                  className="px-3 py-1.5 rounded-lg border border-app-strong text-xs font-medium text-app-strong hover:bg-surface-raised transition"
                >
                  Edit blocks
                </Link>
                {!page.is_default && (
                  <button onClick={() => removePage(page.id)} className="text-xs text-red-500 hover:text-red-700">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
