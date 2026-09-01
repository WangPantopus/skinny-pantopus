'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import type { BusinessPage } from '@pantopus/types';
import { confirmStore } from '@/components/ui/confirm-store';

export default function BusinessPagesPage() {
  const params = useParams();
  const businessId = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pages, setPages] = useState<BusinessPage[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.businesses.getPages(businessId);
      setPages(res.pages || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addPage = async () => {
    if (!newTitle.trim() || !newSlug.trim()) {
      setError('Title and slug are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.businesses.createPage(businessId, {
        title: newTitle.trim(),
        slug: newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
        show_in_nav: true,
      });
      setNewTitle('');
      setNewSlug('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add page');
    } finally {
      setSaving(false);
    }
  };

  const removePage = async (pageId: string) => {
    const yes = await confirmStore.open({ title: 'Delete this page?', confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.businesses.deletePage(businessId, pageId);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete page');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-app-text">Pages</h1>
          <p className="text-sm text-app-text-secondary mt-1">Create and manage public pages</p>
        </div>
        <Link href={`/app/business/${businessId}/dashboard`} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
          Dashboard
        </Link>
      </div>

      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-app-text mb-3">Create Page</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" className="rounded border border-app-border px-3 py-2 text-sm" />
          <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="slug" className="rounded border border-app-border px-3 py-2 text-sm" />
          <button onClick={addPage} disabled={saving} className="rounded bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
            Add Page
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      {loading && <div className="text-app-text-secondary">Loading...</div>}

      {!loading && (
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
          {pages.length === 0 ? (
            <div className="p-6 text-center text-app-text-secondary text-sm">No pages yet.</div>
          ) : (
            <div className="divide-y divide-app-border-subtle">
              {pages.map((page) => (
                <div key={page.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-app-text">{page.title}</div>
                    <div className="text-xs text-app-text-secondary">/{page.slug} · draft v{page.draft_revision} · published v{page.published_revision}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/app/businesses/${businessId}/pages/${page.id}/edit`} className="px-2.5 py-1 rounded border border-app-border text-xs text-app-text-strong hover:bg-app-hover">
                      Edit
                    </Link>
                    {!page.is_default && (
                      <button onClick={() => void removePage(page.id)} className="text-xs text-red-600 hover:underline">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
