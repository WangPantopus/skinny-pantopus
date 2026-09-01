'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Phone, Droplets, Users, DoorOpen, HeartPulse, AlertCircle, Trash2 } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

const CATEGORY_META: Record<string, { icon: typeof Droplets; color: string; label: string }> = {
  shutoff:    { icon: Droplets,    color: '#0284c7', label: 'Shutoffs' },
  contact:    { icon: Phone,       color: '#059669', label: 'Emergency Contacts' },
  evacuation: { icon: DoorOpen,    color: '#dc2626', label: 'Evacuation' },
  medical:    { icon: HeartPulse,  color: '#f59e0b', label: 'Medical' },
  other:      { icon: AlertCircle, color: '#6b7280', label: 'Other' },
};
const ORDERED_CATS = ['shutoff', 'contact', 'evacuation', 'medical', 'other'];

function EmergencyContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('contact');
  const [newDetails, setNewDetails] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchItems = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeProfile.getHomeEmergencies(homeId);
      setItems((res as any)?.emergencies || []);
    } catch { toast.error('Failed to load emergency info'); }
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchItems().finally(() => setLoading(false)); }, [fetchItems]);

  const handleCreate = useCallback(() => {
    if (!newTitle.trim()) return;
    setCreating(true);
    setItems((prev) => [{
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: newTitle.trim(), category: newCategory,
      details: newDetails.trim() || undefined, phone: newPhone.trim() || undefined,
    }, ...prev]);
    setNewTitle(''); setNewDetails(''); setNewPhone(''); setShowCreate(false);
    setCreating(false);
    toast.success('Emergency info added');
  }, [newTitle, newCategory, newDetails, newPhone]);

  const handleDelete = useCallback(async (itemId: string) => {
    const yes = await confirmStore.open({ title: 'Delete', description: 'Remove this emergency info?', confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes) return;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast.success('Removed');
  }, []);

  const grouped = items.reduce<Record<string, any[]>>((acc, i) => {
    const cat = i.category || 'other';
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
            {Object.entries(CATEGORY_META).map(([key, meta]) => {
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
          <button onClick={handleCreate} disabled={creating || !newTitle.trim()} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition">
            {creating ? 'Adding...' : 'Add Emergency Info'}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16">
          <HeartPulse className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">No emergency info</p>
          <p className="text-xs text-app-text-muted mt-1">Add shutoff locations, emergency contacts, and evacuation routes</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ORDERED_CATS.filter((cat) => grouped[cat]).map((cat) => {
            const meta = CATEGORY_META[cat] || CATEGORY_META.other;
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
                  {grouped[cat].map((item: any) => (
                    <div key={item.id} className="flex items-start gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-app-text">{item.title}</p>
                        {item.details && <p className="text-xs text-app-text-secondary mt-1">{item.details}</p>}
                        {item.phone && (
                          <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1.5 mt-2 text-sm text-emerald-600 font-medium hover:underline">
                            <Phone className="w-3.5 h-3.5" />{item.phone}
                          </a>
                        )}
                      </div>
                      <button onClick={() => handleDelete(item.id)} className="p-1 text-app-text-muted hover:text-red-500 transition flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
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
