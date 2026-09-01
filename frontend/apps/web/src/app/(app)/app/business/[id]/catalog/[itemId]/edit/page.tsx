'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';

export default function BusinessCatalogEditPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = String(params.id || '');
  const itemId = String(params.itemId || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    kind: 'service',
    price_cents: '',
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.businesses.getCatalogItems(businessId);
      const item = (res.items || []).find((i: { id: string }) => i.id === itemId);
      if (!item) throw new Error('Catalog item not found');
      setForm({
        name: item.name || '',
        kind: item.kind || 'service',
        price_cents: item.price_cents != null ? String(item.price_cents) : '',
        description: item.description || '',
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load item');
    } finally {
      setLoading(false);
    }
  }, [businessId, itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.businesses.updateCatalogItem(businessId, itemId, {
        name: form.name.trim(),
        kind: form.kind as 'service' | 'product',
        price_cents: form.price_cents ? Number(form.price_cents) : undefined,
        description: form.description.trim() || undefined,
      });
      router.push(`/app/business/${businessId}/catalog`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-app-text-secondary">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-app-text">Edit Catalog Item</h1>
        <Link href={`/app/business/${businessId}/catalog`} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
          Back
        </Link>
      </div>
      <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
        <Field label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
        <label className="block">
          <div className="text-sm font-medium text-app-text-strong mb-1">Kind</div>
          <select
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
            className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
          >
            {['service', 'product', 'menu_item', 'class', 'rental', 'membership', 'other'].map((kind) => (
              <option key={kind} value={kind}>{kind}</option>
            ))}
          </select>
        </label>
        <Field label="Price (cents)" value={form.price_cents} onChange={(v) => setForm((f) => ({ ...f, price_cents: v }))} />
        <Field label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-app-text-strong mb-1">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-app-border px-3 py-2 text-sm" />
    </label>
  );
}
