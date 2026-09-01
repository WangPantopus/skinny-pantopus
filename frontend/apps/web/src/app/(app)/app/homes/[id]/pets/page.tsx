'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Stethoscope, FileText, Dumbbell, Trash2 } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

const SPECIES_ICON: Record<string, string> = {
  dog: '\uD83D\uDC15', cat: '\uD83D\uDC08', bird: '\uD83D\uDC26', fish: '\uD83D\uDC1F', rabbit: '\uD83D\uDC07',
  hamster: '\uD83D\uDC39', reptile: '\uD83E\uDD8E', other: '\uD83D\uDC3E',
};

function PetsContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newSpecies, setNewSpecies] = useState('dog');
  const [newBreed, setNewBreed] = useState('');
  const [newVet, setNewVet] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchPets = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeProfile.getHomePets(homeId);
      setPets((res as any)?.pets || []);
    } catch { toast.error('Failed to load pets'); }
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchPets().finally(() => setLoading(false)); }, [fetchPets]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.homeProfile.createHomePet(homeId!, {
        name: newName.trim(), species: newSpecies,
        breed: newBreed.trim() || undefined, vet_name: newVet.trim() || undefined, notes: newNotes.trim() || undefined,
      });
      setNewName(''); setNewBreed(''); setNewVet(''); setNewNotes(''); setShowCreate(false);
      toast.success('Pet added');
      await fetchPets();
    } catch (err: any) { toast.error(err?.message || 'Failed to add pet'); }
    finally { setCreating(false); }
  }, [homeId, newName, newSpecies, newBreed, newVet, newNotes, fetchPets]);

  const handleDelete = useCallback(async (petId: string, petName: string) => {
    const yes = await confirmStore.open({ title: 'Remove Pet', description: `Remove ${petName} from this home?`, confirmLabel: 'Remove', variant: 'destructive' });
    if (!yes) return;
    try { await api.homeProfile.deleteHomePet(homeId!, petId); toast.success('Pet removed'); await fetchPets(); }
    catch { toast.error('Failed to remove pet'); }
  }, [homeId, fetchPets]);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Pets</h1>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> Add Pet
        </button>
      </div>

      {showCreate && (
        <div className="bg-app-surface border border-app-border rounded-xl p-4 mb-4 space-y-3">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Pet name" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <div>
            <p className="text-xs font-semibold text-app-text-strong mb-1.5">Species</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SPECIES_ICON).map(([species, emoji]) => (
                <button key={species} type="button" onClick={() => setNewSpecies(species)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-sm transition ${newSpecies === species ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-700' : 'border-app-border text-app-text-secondary'}`}>
                  <span>{emoji}</span>{species.charAt(0).toUpperCase() + species.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <input type="text" value={newBreed} onChange={(e) => setNewBreed(e.target.value)} placeholder="Breed (optional)" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <input type="text" value={newVet} onChange={(e) => setNewVet(e.target.value)} placeholder="Vet name / phone (optional)" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Notes (allergies, medication, etc.)" rows={2} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          <button onClick={handleCreate} disabled={creating || !newName.trim()} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition">
            {creating ? 'Adding...' : 'Add Pet'}
          </button>
        </div>
      )}

      {pets.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl block mb-3">{'\uD83D\uDC3E'}</span>
          <p className="text-sm text-app-text-secondary">No pets registered</p>
          <p className="text-xs text-app-text-muted mt-1">Add your furry (or scaly) friends!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pets.map((pet) => {
            const expanded = expandedId === pet.id;
            const vetInfo = pet.vet_info || [pet.vet_name, pet.vet_phone].filter(Boolean).join(' \u00b7 ');
            return (
              <button key={pet.id} type="button" onClick={() => setExpandedId(expanded ? null : pet.id)}
                className="w-full text-left bg-app-surface border border-app-border rounded-xl p-4 hover:bg-app-hover transition">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl">{SPECIES_ICON[pet.species] || '\uD83D\uDC3E'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-app-text">{pet.name}</p>
                    <p className="text-sm text-app-text-secondary mt-0.5">
                      {pet.species?.charAt(0).toUpperCase() + pet.species?.slice(1)}
                      {pet.breed ? ` \u00b7 ${pet.breed}` : ''}
                    </p>

                    {expanded && (
                      <div className="mt-3 space-y-2">
                        {vetInfo && (
                          <div className="flex items-start gap-2 text-sm text-app-text-secondary">
                            <Stethoscope className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span>{vetInfo}</span>
                          </div>
                        )}
                        {pet.notes && (
                          <div className="flex items-start gap-2 text-sm text-app-text-secondary">
                            <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span>{pet.notes}</span>
                          </div>
                        )}
                        {(pet.weight_lbs || pet.weight) && (
                          <div className="flex items-start gap-2 text-sm text-app-text-secondary">
                            <Dumbbell className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span>{pet.weight_lbs || pet.weight} lbs</span>
                          </div>
                        )}
                        <div className="pt-2">
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(pet.id, pet.name); }}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {expanded ? <ChevronUp className="w-4 h-4 text-app-text-muted" /> : <ChevronDown className="w-4 h-4 text-app-text-muted" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PetsPage() { return <Suspense><PetsContent /></Suspense>; }
