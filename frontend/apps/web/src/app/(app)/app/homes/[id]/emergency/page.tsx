'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Phone, Droplets, DoorOpen, HeartPulse, AlertCircle, Trash2 } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { HomeEmergency } from '@pantopus/types';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import { failureMessage, shareFailure } from '@/components/home/share/shareFailure';
import {
  CATEGORY_CREATE_TYPE, emergencyCategory, emergencyDetail, type EmergencyCategory,
} from '@/components/home/emergencyTypes';

const CATEGORY_META: Record<EmergencyCategory, { icon: typeof Droplets; color: string; label: string }> = {
  shutoff:    { icon: Droplets,    color: '#0284c7', label: 'Shutoffs' },
  contact:    { icon: Phone,       color: '#059669', label: 'Emergency Contacts' },
  evacuation: { icon: DoorOpen,    color: '#dc2626', label: 'Evacuation' },
  medical:    { icon: HeartPulse,  color: '#f59e0b', label: 'Medical' },
  other:      { icon: AlertCircle, color: '#6b7280', label: 'Other' },
};
const ORDERED_CATS: EmergencyCategory[] = ['shutoff', 'contact', 'evacuation', 'medical', 'other'];

function EmergencyContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [items, setItems] = useState<HomeEmergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<EmergencyCategory>('contact');
  // Shutoffs are stored per utility (shutoff_water, shutoff_gas, ...). Until a
  // utility choice is approved for this form, a Shutoffs entry cannot be saved
  // here (the submit stays disabled); every other category maps to one type.
  const [newDetails, setNewDetails] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // A superseded list read must never replace a newer one.
  const generation = useRef(0);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchItems = useCallback(async () => {
    if (!homeId) return;
    const request = ++generation.current;
    try {
      const res = await api.homeProfile.getHomeEmergencies(homeId);
      if (request !== generation.current) return;
      setLoadError(null);
      setItems((res?.emergencies || []) as HomeEmergency[]);
    } catch (err: unknown) {
      if (request !== generation.current) return;
      setLoadError('Current emergency info could not be loaded. Retry to check current information.');
      toast.error(failureMessage(err, 'Failed to load emergency info'));
    }
  }, [homeId]);

  useEffect(() => {
    setLoading(true);
    fetchItems().finally(() => setLoading(false));
    return () => { generation.current++; };
  }, [fetchItems]);

  // Saves through POST /api/homes/:id/emergencies with a HomeEmergencyType and
  // the free-form details object the native forms also write; the row shown is
  // the one the server returned, never a local placeholder.
  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !homeId || creating || newCategory === 'shutoff') return;
    setCreating(true);
    const details: Record<string, string> = {};
    if (newPhone.trim()) details.phone = newPhone.trim();
    if (newDetails.trim()) details.notes = newDetails.trim();
    try {
      const res = await api.homeProfile.createHomeEmergency(homeId, {
        type: CATEGORY_CREATE_TYPE[newCategory],
        label: newTitle.trim(),
        details,
      });
      const created = res?.emergency as HomeEmergency | undefined;
      if (!created?.id) throw new Error('Malformed create response');
      setItems((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
      setNewTitle(''); setNewDetails(''); setNewPhone(''); setShowCreate(false);
      toast.success('Emergency info added');
    } catch (err: unknown) {
      toast.error(failureMessage(err, 'Failed to add emergency info'));
    } finally { setCreating(false); }
  }, [homeId, creating, newTitle, newCategory, newDetails, newPhone]);

  const handleDelete = useCallback(async (itemId: string) => {
    const yes = await confirmStore.open({ title: 'Delete', description: 'Remove this emergency info?', confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes || !homeId) return;
    try {
      await api.homeProfile.deleteHomeEmergency(homeId, itemId);
    } catch (err: unknown) {
      // Already gone on the server is the outcome the member asked for.
      if (shareFailure(err).code !== 'EMERGENCY_NOT_FOUND') {
        toast.error(failureMessage(err, 'Failed to remove emergency info'));
        return;
      }
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast.success('Removed');
  }, [homeId]);

  // HomeEmergency rows carry `type`, never a category; group by the same rollup
  // the dashboard card and the native palettes apply.
  const grouped = items.reduce<Partial<Record<EmergencyCategory, HomeEmergency[]>>>((acc, i) => {
    const cat = emergencyCategory(i.type);
    (acc[cat] = acc[cat] || []).push(i);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Emergency Info</h1>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* 911 banner */}
      <a href="tel:911" className="flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl font-bold mb-4 hover:bg-red-700 transition">
        <Phone className="w-5 h-5" /> Emergency? Call 911
      </a>

      {showCreate && (
        <div className="bg-app-surface border border-app-border rounded-xl p-4 mb-4 space-y-3">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <div className="flex flex-wrap gap-1.5">
            {ORDERED_CATS.map((key) => {
              const meta = CATEGORY_META[key];
              const CatIcon = meta.icon;
              return (
                <button key={key} type="button" onClick={() => setNewCategory(key)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${newCategory === key ? 'border-current' : 'border-app-border text-app-text-secondary'}`}
                  style={newCategory === key ? { color: meta.color, backgroundColor: meta.color + '12', borderColor: meta.color } : undefined}>
                  <CatIcon className="w-3 h-3" />{meta.label}
                </button>
              );
            })}
          </div>
          <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone number (optional)" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <textarea value={newDetails} onChange={(e) => setNewDetails(e.target.value)} placeholder="Details (optional)" rows={2} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          <button onClick={handleCreate} disabled={creating || !newTitle.trim() || newCategory === 'shutoff'} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition">
            {creating ? 'Adding...' : 'Add Emergency Info'}
          </button>
        </div>
      )}

      {loadError ? (
        <div className="text-center py-16">
          <p className="text-sm text-app-text-secondary">{loadError}</p>
          <button type="button" onClick={() => { setLoading(true); fetchItems().finally(() => setLoading(false)); }} className="mt-3 px-4 py-2 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition">Retry</button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <HeartPulse className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">No emergency info</p>
          <p className="text-xs text-app-text-muted mt-1">Add shutoff locations, emergency contacts, and evacuation routes</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ORDERED_CATS.filter((cat) => grouped[cat]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const CatIcon = meta.icon;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: meta.color + '15' }}>
                    <CatIcon className="w-4 h-4" style={{ color: meta.color }} />
                  </div>
                  <h2 className="text-sm font-bold text-app-text-strong">{meta.label}</h2>
                </div>
                <div className="space-y-1.5">
                  {(grouped[cat] || []).map((item) => {
                    // `details` is a jsonb object; render its strings, never the object.
                    const notes = emergencyDetail(item, 'notes') || emergencyDetail(item, 'detail');
                    const phone = emergencyDetail(item, 'phone');
                    return (
                    <div key={item.id} className="flex items-start gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-app-text">{item.label}</p>
                        {item.location && <p className="text-xs text-app-text-secondary mt-1">{item.location}</p>}
                        {notes && <p className="text-xs text-app-text-secondary mt-1">{notes}</p>}
                        {phone && (
                          <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 mt-2 text-sm text-emerald-600 font-medium hover:underline">
                            <Phone className="w-3.5 h-3.5" />{phone}
                          </a>
                        )}
                      </div>
                      <button onClick={() => handleDelete(item.id)} aria-label={`Delete ${item.label}`} className="p-1 text-app-text-muted hover:text-red-500 transition flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EmergencyPage() { return <Suspense><EmergencyContent /></Suspense>; }
