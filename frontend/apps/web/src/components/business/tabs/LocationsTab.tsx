import { useState } from 'react';
import * as api from '@pantopus/api';
import type { BusinessLocation } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import Field from '../shared/Field';

interface LocationsTabProps {
  locations: BusinessLocation[];
  businessId: string;
  onUpdate: () => void;
}

export default function LocationsTab({ locations, businessId, onUpdate }: LocationsTabProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', address: '', city: '', state: '', zipcode: '', country: 'US' });
  const [saving, setSaving] = useState(false);

  const addLocation = async () => {
    if (!addForm.address || !addForm.city) return;
    setSaving(true);
    try {
      await api.businesses.createLocation(businessId, {
        label: addForm.label || 'Main',
        address: addForm.address,
        city: addForm.city,
        state: addForm.state || undefined,
        zipcode: addForm.zipcode || undefined,
        country: addForm.country,
        is_primary: locations.length === 0,
      });
      setShowAdd(false);
      setAddForm({ label: '', address: '', city: '', state: '', zipcode: '', country: 'US' });
      onUpdate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const removeLocation = async (locationId: string) => {
    const yes = await confirmStore.open({ title: 'Remove this location?', confirmLabel: 'Remove', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.businesses.deleteLocation(businessId, locationId);
      onUpdate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-app">Locations & Hours</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
        >
          {showAdd ? 'Cancel' : 'Add location'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 space-y-3">
          <Field label="Label" value={addForm.label} onChange={(v) => setAddForm({ ...addForm, label: v })} placeholder="e.g. Downtown, Main Office" />
          <Field label="Address *" value={addForm.address} onChange={(v) => setAddForm({ ...addForm, address: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="City *" value={addForm.city} onChange={(v) => setAddForm({ ...addForm, city: v })} />
            <Field label="State" value={addForm.state} onChange={(v) => setAddForm({ ...addForm, state: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ZIP" value={addForm.zipcode} onChange={(v) => setAddForm({ ...addForm, zipcode: v })} />
            <Field label="Country" value={addForm.country} onChange={(v) => setAddForm({ ...addForm, country: v })} />
          </div>
          <button onClick={addLocation} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
            {saving ? 'Adding…' : 'Add Location'}
          </button>
        </div>
      )}

      {/* Locations list */}
      {locations.length === 0 ? (
        <div className="rounded-xl border border-app bg-surface p-6 text-center text-app-secondary">
          No locations yet. Add your first location to show on your profile.
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div key={loc.id} className="rounded-xl border border-app bg-surface p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-app">{loc.label}</span>
                    {loc.is_primary && (
                      <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-app-secondary mt-0.5">{loc.address}</div>
                  <div className="text-sm text-app-secondary">
                    {[loc.city, loc.state, loc.zipcode].filter(Boolean).join(', ')}
                  </div>
                  {loc.phone && <div className="text-xs text-app-muted mt-1">{loc.phone}</div>}
                </div>
                <button
                  onClick={() => removeLocation(loc.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
