import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import Field from '../shared/Field';

interface CatalogTabProps {
  catalog: Record<string, any>[];
  businessId: string;
  onUpdate: () => void;
}

export default function CatalogTab({ catalog: initialCatalog, businessId, onUpdate }: CatalogTabProps) {
  const [items, setItems] = useState<Record<string, any>[]>(initialCatalog);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', kind: 'service', price_cents: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { setItems(initialCatalog); }, [initialCatalog]);

  const addItem = async () => {
    if (!addForm.name) return;
    setSaving(true);
    try {
      await api.businesses.createCatalogItem(businessId, {
        name: addForm.name,
        kind: addForm.kind,
        price_cents: addForm.price_cents ? Number(addForm.price_cents) : undefined,
        description: addForm.description || undefined,
      });
      setShowAdd(false);
      setAddForm({ name: '', kind: 'service', price_cents: '', description: '' });
      onUpdate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (itemId: string) => {
    const yes = await confirmStore.open({ title: 'Archive this item?', confirmLabel: 'Archive', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.businesses.deleteCatalogItem(businessId, itemId);
      onUpdate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-app">Catalog</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
        >
          {showAdd ? 'Cancel' : 'Add item'}
        </button>
      </div>

      {showAdd && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 space-y-3">
          <Field label="Name *" value={addForm.name} onChange={(v) => setAddForm({ ...addForm, name: v })} placeholder="e.g. Haircut, Large Pizza" />
          <div>
            <label className="block text-sm font-medium text-app-strong mb-1">Type</label>
            <select
              value={addForm.kind}
              onChange={(e) => setAddForm({ ...addForm, kind: e.target.value })}
              className="w-full rounded-lg border border-app-strong px-3 py-2 text-sm"
            >
              {['service', 'product', 'menu_item', 'class', 'rental', 'membership', 'other'].map((k) => (
                <option key={k} value={k}>{k.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <Field label="Price (cents)" value={addForm.price_cents} onChange={(v) => setAddForm({ ...addForm, price_cents: v })} placeholder="1500 = $15.00" type="number" />
          <div>
            <label className="block text-sm font-medium text-app-strong mb-1">Description</label>
            <textarea
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-app-strong px-3 py-2 text-sm resize-none"
            />
          </div>
          <button onClick={addItem} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
            {saving ? 'Adding…' : 'Add Item'}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-app bg-surface p-6 text-center text-app-secondary">
          No catalog items yet. Add services, products, or menu items.
        </div>
      ) : (
        <div className="rounded-xl border border-app bg-surface divide-y divide-app">
          {items.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-app">{item.name}</span>
                  {item.is_featured && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      Featured
                    </span>
                  )}
                </div>
                <div className="text-xs text-app-secondary capitalize">{item.kind?.replace('_', ' ')}</div>
              </div>
              <div className="flex items-center gap-3">
                {item.price_cents != null && (
                  <span className="text-sm font-semibold text-app-strong">${(item.price_cents / 100).toFixed(2)}</span>
                )}
                <button onClick={() => removeItem(item.id)} className="text-xs text-red-500 hover:text-red-700">
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
