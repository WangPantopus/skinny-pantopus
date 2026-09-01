'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Dog, Cat, Bird, Fish, Rabbit, Squirrel, PawPrint, ChevronLeft, Cross } from 'lucide-react';
import * as api from '@pantopus/api';
import type { HomePet } from '@pantopus/types';
import DashboardCard from '../DashboardCard';
import SlidePanel from '../SlidePanel';
import { confirmStore } from '@/components/ui/confirm-store';

const SPECIES_ICON: Record<string, ReactNode> = {
  dog: <Dog className="w-4 h-4" />,
  cat: <Cat className="w-4 h-4" />,
  bird: <Bird className="w-4 h-4" />,
  fish: <Fish className="w-4 h-4" />,
  rabbit: <Rabbit className="w-4 h-4" />,
  hamster: <Squirrel className="w-4 h-4" />,
  reptile: <PawPrint className="w-4 h-4" />,
  other: <PawPrint className="w-4 h-4" />,
};

type PetFormData = {
  name: string;
  species?: string;
  breed?: string;
  birthday?: string;
  weight_lbs?: number;
  microchip_id?: string;
  vet_name?: string;
  vet_phone?: string;
  notes?: string;
};

// ---- Preview ----

export function PetsCardPreview({
  pets,
  onExpand,
}: {
  pets: Record<string, any>[];
  onExpand: () => void;
}) {
  return (
    <DashboardCard
      title="Pets"
      icon={<PawPrint className="w-5 h-5" />}
      visibility="members"
      count={pets.length}
      onClick={onExpand}
    >
      {pets.length > 0 ? (
        <div className="space-y-1.5">
          {pets.slice(0, 3).map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <span className="flex-shrink-0">{SPECIES_ICON[p.species] || SPECIES_ICON.other}</span>
              <span className="text-app-text-strong truncate">{p.name}</span>
              {p.breed && <span className="text-xs text-app-text-muted truncate">{p.breed}</span>}
            </div>
          ))}
          {pets.length > 3 && <p className="text-xs text-app-text-muted">+{pets.length - 3} more</p>}
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="mb-1"><PawPrint className="w-5 h-5 mx-auto text-app-text-muted" /></div>
          <p className="text-xs text-app-text-muted">No pets registered</p>
        </div>
      )}
    </DashboardCard>
  );
}

// ---- Expanded ----

export default function PetsCard({
  homeId,
  onBack,
}: {
  homeId: string;
  onBack: () => void;
}) {
  const [pets, setPets] = useState<HomePet[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<{ open: boolean; pet?: HomePet }>({ open: false });

  const loadPets = useCallback(async () => {
    try {
      const res = await api.homeProfile.getHomePets(homeId);
      setPets(res.pets || []);
    } catch {
      setPets([]);
    }
    setLoading(false);
  }, [homeId]);

  useEffect(() => { loadPets(); }, [loadPets]);

  const handleSave = async (data: PetFormData) => {
    const pet = panel.pet;
    if (pet) {
      const res = await api.homeProfile.updateHomePet(homeId, pet.id, data);
      setPets((prev) => prev.map((p) => (p.id === pet.id ? { ...p, ...res.pet } : p)));
    } else {
      const res = await api.homeProfile.createHomePet(homeId, data);
      setPets((prev) => [res.pet, ...prev]);
    }
    setPanel({ open: false });
  };

  const handleDelete = async (petId: string) => {
    const yes = await confirmStore.open({ title: 'Remove this pet?', confirmLabel: 'Remove', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.homeProfile.deleteHomePet(homeId, petId);
      setPets((prev) => prev.filter((p) => p.id !== petId));
    } catch (err: unknown) {
      console.error('Failed to delete pet:', err);
    }
  };

  const getAge = (birthday: string) => {
    if (!birthday) return null;
    const born = new Date(birthday);
    const now = new Date();
    const years = now.getFullYear() - born.getFullYear();
    return years <= 0 ? '< 1 year' : `${years} year${years !== 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-app-text-muted text-sm">Loading pets…</div>
    );
  }

  return (
    <div className="space-y-4">
      <PetSlidePanel
        open={panel.open}
        onClose={() => setPanel({ open: false })}
        onSave={handleSave}
        pet={panel.pet}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-app-text-secondary hover:text-app-text-strong transition flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2"><PawPrint className="w-5 h-5" /> Pets</h2>
        </div>
        <button
          onClick={() => setPanel({ open: true })}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
        >
          + Add Pet
        </button>
      </div>

      <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
        {pets.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mb-2"><PawPrint className="w-8 h-8 mx-auto text-app-text-muted" /></div>
            <p className="text-sm text-app-text-secondary">No pets registered</p>
            <button
              onClick={() => setPanel({ open: true })}
              className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              + Add your first pet
            </button>
          </div>
        ) : (
          pets.map((pet) => (
            <div
              key={pet.id}
              className="px-4 py-3.5 flex items-start gap-3 hover:bg-app-hover/50 transition cursor-pointer group"
              onClick={() => setPanel({ open: true, pet })}
            >
              <span className="flex-shrink-0">{SPECIES_ICON[pet.species] || SPECIES_ICON.other}</span>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-app-text">{pet.name}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {pet.breed && <span className="text-xs text-app-text-secondary">{pet.breed}</span>}
                  {pet.birthday && <span className="text-xs text-app-text-muted">{getAge(pet.birthday)}</span>}
                  {pet.weight_lbs && <span className="text-xs text-app-text-muted">{pet.weight_lbs} lbs</span>}
                </div>
                {pet.vet_name && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-app-text-muted flex items-center gap-1"><Cross className="w-3 h-3" /> {pet.vet_name}</span>
                    {pet.vet_phone && (
                      <a
                        href={`tel:${pet.vet_phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-blue-600 hover:underline"
                      >
                        {pet.vet_phone}
                      </a>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(pet.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-app-text-muted hover:text-red-500 p-1 transition flex-shrink-0"
                title="Remove"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---- Pet Slide Panel ----

function PetSlidePanel({
  open,
  onClose,
  onSave,
  pet,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: PetFormData) => Promise<void>;
  pet?: HomePet;
}) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('dog');
  const [breed, setBreed] = useState('');
  const [birthday, setBirthday] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [microchipId, setMicrochipId] = useState('');
  const [vetName, setVetName] = useState('');
  const [vetPhone, setVetPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (pet) {
        setName(pet.name || '');
        setSpecies(pet.species || 'dog');
        setBreed(pet.breed || '');
        setBirthday(pet.birthday?.split('T')[0] || '');
        setWeightLbs(pet.weight_lbs ? String(pet.weight_lbs) : '');
        setMicrochipId(pet.microchip_id || '');
        setVetName(pet.vet_name || '');
        setVetPhone(pet.vet_phone || '');
        setNotes(pet.notes || '');
      } else {
        setName(''); setSpecies('dog'); setBreed(''); setBirthday('');
        setWeightLbs(''); setMicrochipId(''); setVetName(''); setVetPhone(''); setNotes('');
      }
      setError('');
    }
  }, [open, pet]);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        species,
        breed: breed.trim() || undefined,
        birthday: birthday || undefined,
        weight_lbs: weightLbs ? Number(weightLbs) : undefined,
        microchip_id: microchipId.trim() || undefined,
        vet_name: vetName.trim() || undefined,
        vet_phone: vetPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  const SPECIES_OPTIONS = [
    { value: 'dog', label: 'Dog', icon: <Dog className="w-4 h-4" /> },
    { value: 'cat', label: 'Cat', icon: <Cat className="w-4 h-4" /> },
    { value: 'bird', label: 'Bird', icon: <Bird className="w-4 h-4" /> },
    { value: 'fish', label: 'Fish', icon: <Fish className="w-4 h-4" /> },
    { value: 'rabbit', label: 'Rabbit', icon: <Rabbit className="w-4 h-4" /> },
    { value: 'hamster', label: 'Hamster', icon: <Squirrel className="w-4 h-4" /> },
    { value: 'reptile', label: 'Reptile', icon: <PawPrint className="w-4 h-4" /> },
    { value: 'other', label: 'Other', icon: <PawPrint className="w-4 h-4" /> },
  ];

  return (
    <SlidePanel open={open} onClose={onClose} title={pet ? 'Edit Pet' : 'Add Pet'}>
      <div className="space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div>
          <label className="block text-xs font-medium text-app-text-secondary mb-1">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-app-border px-3 py-2 text-sm" placeholder="Pet name" />
        </div>

        <div>
          <label className="block text-xs font-medium text-app-text-secondary mb-1">Species</label>
          <div className="flex flex-wrap gap-1.5">
            {SPECIES_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSpecies(s.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  species === s.value ? 'bg-gray-900 text-white' : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
                }`}
              >
                <span className="flex items-center gap-1">{s.icon} {s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-app-text-secondary mb-1">Breed</label>
          <input value={breed} onChange={(e) => setBreed(e.target.value)} className="w-full rounded-lg border border-app-border px-3 py-2 text-sm" placeholder="e.g. Golden Retriever" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-app-text-secondary mb-1">Birthday</label>
            <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="w-full rounded-lg border border-app-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-secondary mb-1">Weight (lbs)</label>
            <input type="number" value={weightLbs} onChange={(e) => setWeightLbs(e.target.value)} className="w-full rounded-lg border border-app-border px-3 py-2 text-sm" min={0} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-app-text-secondary mb-1">Microchip ID</label>
          <input value={microchipId} onChange={(e) => setMicrochipId(e.target.value)} className="w-full rounded-lg border border-app-border px-3 py-2 text-sm font-mono" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-app-text-secondary mb-1">Vet Name</label>
            <input value={vetName} onChange={(e) => setVetName(e.target.value)} className="w-full rounded-lg border border-app-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-secondary mb-1">Vet Phone</label>
            <input value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} className="w-full rounded-lg border border-app-border px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-app-text-secondary mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-app-border px-3 py-2 text-sm resize-none" placeholder="Feeding schedule, medications, allergies…" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-app-border text-sm text-app-text-secondary hover:bg-app-hover transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : pet ? 'Update Pet' : 'Add Pet'}
          </button>
        </div>
      </div>
    </SlidePanel>
  );
}
