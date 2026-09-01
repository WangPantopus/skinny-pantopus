'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import type { CatalogCategory, CatalogItem } from '@pantopus/types';
import { confirmStore } from '@/components/ui/confirm-store';

export default function BusinessCatalogPage() {
  const params = useParams();
  const businessId = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [itemForm, setItemForm] = useState({
    name: '',
    kind: 'service',
    price_cents: '',
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [catRes, itemRes] = await Promise.all([
        api.businesses.getCatalogCategories(businessId),
        api.businesses.getCatalogItems(businessId),
      ]);
      setCategories(catRes.categories || []);
      setItems(itemRes.items || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addCategory = async () => {
    if (!categoryName.trim()) return;
    setSaving(true);
    try {
      await api.businesses.createCatalogCategory(businessId, { name: categoryName.trim() });
      setCategoryName('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add category');
    } finally {
      setSaving(false);
    }
  };

  const addItem = async () => {
    if (!itemForm.name.trim()) return;
    setSaving(true);
    try {
      await api.businesses.createCatalogItem(businessId, {
        name: itemForm.name.trim(),
        kind: itemForm.kind as CatalogItem['kind'],
        price_cents: itemForm.price_cents ? Number(itemForm.price_cents) : undefined,
        description: itemForm.description.trim() || undefined,
      });
      setItemForm({ name: '', kind: 'service', price_cents: '', description: '' });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  const archiveItem = async (itemId: string) => {
    const yes = await confirmStore.open({ title: 'Archive this item?', confirmLabel: 'Archive', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.businesses.deleteCatalogItem(businessId, itemId);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to archive item');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-app-text">Catalog</h1>
          <p className="text-sm text-app-text-secondary mt-1">Manage categories and item offerings</p>
        </div>
        <Link href={`/app/business/${businessId}/dashboard`} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
          Dashboard
        </Link>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      {loading && <div className="text-app-text-secondary">Loading...</div>}

      {!loading && (
        <div className="space-y-5">
          <div className="bg-app-surface border border-app-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-app-text mb-2">Categories</h2>
            <div className="flex items-center gap-2 mb-3">
              <input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="New category"
                className="rounded-lg border border-app-border px-3 py-2 text-sm flex-1"
              />
              <button onClick={addCategory} disabled={saving} className="px-3 py-2 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.length === 0 ? (
                <span className="text-sm text-app-text-secondary">No categories</span>
              ) : (
                categories.map((c: CatalogCategory) => (
                  <span key={c.id} className="px-2.5 py-1 rounded-full border border-app-border text-xs text-app-text-strong bg-app-surface-raised">
                    {c.name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-app-text mb-2">Add Item</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name" value={itemForm.name} onChange={(v) => setItemForm((f) => ({ ...f, name: v }))} />
              <label className="block">
                <div className="text-sm font-medium text-app-text-strong mb-1">Kind</div>
                <select
                  value={itemForm.kind}
                  onChange={(e) => setItemForm((f) => ({ ...f, kind: e.target.value }))}
                  className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
                >
                  {['service', 'product', 'menu_item', 'class', 'rental', 'membership', 'other'].map((kind) => (
                    <option key={kind} value={kind}>{kind}</option>
                  ))}
                </select>
              </label>
              <Field label="Price (cents)" value={itemForm.price_cents} onChange={(v) => setItemForm((f) => ({ ...f, price_cents: v }))} />
              <Field label="Description" value={itemForm.description} onChange={(v) => setItemForm((f) => ({ ...f, description: v }))} />
            </div>
            <button onClick={addItem} disabled={saving} className="mt-3 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
              Add Item
            </button>
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-app-text-secondary">No catalog items yet.</div>
            ) : (
              <div className="divide-y divide-app-border-subtle">
                {items.map((item: CatalogItem) => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-app-text">{item.name}</div>
                      <div className="text-xs text-app-text-secondary">
                        {item.kind} {item.price_cents != null ? `· $${(item.price_cents / 100).toFixed(2)}` : ''}
                      </div>
                    </div>
                    <button onClick={() => void archiveItem(item.id)} className="text-xs text-red-600 hover:underline">
                      Archive
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-app-text-strong mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
      />
    </label>
  );
}
