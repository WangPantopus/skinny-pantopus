'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { Droplets, Flame, Zap, ShowerHead, OctagonX, Siren, MapPin, Phone, ChevronLeft } from 'lucide-react';
import DashboardCard from '../DashboardCard';

const SHUTOFF_TYPES: Record<string, { icon: ReactNode; label: string }> = {
  water_main: { icon: <Droplets className="w-5 h-5" />, label: 'Water Main' },
  gas_shutoff: { icon: <Flame className="w-5 h-5" />, label: 'Gas Shutoff' },
  electrical_panel: { icon: <Zap className="w-5 h-5" />, label: 'Electrical Panel' },
  sprinkler: { icon: <ShowerHead className="w-5 h-5" />, label: 'Sprinkler System' },
  other: { icon: <OctagonX className="w-5 h-5" />, label: 'Other' },
};

// ---- Preview ----

export function EmergencyCardPreview({
  emergencies,
  onExpand,
}: {
  emergencies: Record<string, any>[];
  onExpand: () => void;
}) {
  return (
    <DashboardCard
      title="Emergency"
      icon={<Siren className="w-5 h-5" />}
      visibility="members"
      count={emergencies.length}
      onClick={onExpand}
    >
      {emergencies.length > 0 ? (
        <div className="space-y-1.5">
          {emergencies.slice(0, 3).map((e) => {
            const cfg = SHUTOFF_TYPES[e.emergency_type] || SHUTOFF_TYPES.other;
            return (
              <div key={e.id} className="flex items-center gap-2 text-sm">
                <span className="flex-shrink-0">{cfg.icon}</span>
                <span className="text-app-text-strong truncate">{e.label || cfg.label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="mb-1"><Siren className="w-5 h-5 mx-auto text-app-text-muted" /></div>
          <p className="text-xs text-app-text-muted">No emergency info</p>
        </div>
      )}
    </DashboardCard>
  );
}

// ---- Expanded ----

export default function EmergencyCard({
  emergencies,
  home: _home,
  homeId: _homeId,
  onBack,
}: {
  emergencies: Record<string, any>[];
  home: Record<string, any>;
  homeId: string;
  onBack: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);

  // Categorize emergencies
  const shutoffs = emergencies.filter(
    (e) => e.emergency_type === 'water_main' || e.emergency_type === 'gas_shutoff' ||
           e.emergency_type === 'electrical_panel' || e.emergency_type === 'sprinkler'
  );
  const contacts = emergencies.filter((e) => e.emergency_type === 'contact');
  const plans = emergencies.filter(
    (e) => e.emergency_type === 'evacuation' || e.emergency_type === 'plan'
  );
  const other = emergencies.filter(
    (e) => !shutoffs.includes(e) && !contacts.includes(e) && !plans.includes(e)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-app-text-secondary hover:text-app-text-strong transition flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2"><Siren className="w-5 h-5" /> Emergency Info</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
        >
          + Add Info
        </button>
      </div>

      {/* Shutoffs */}
      <div>
        <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Shutoffs</h3>
        <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
          {shutoffs.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-app-text-muted">No shutoff locations documented</p>
            </div>
          ) : (
            shutoffs.map((s) => {
              const cfg = SHUTOFF_TYPES[s.emergency_type] || SHUTOFF_TYPES.other;
              return (
                <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                  <span className="flex-shrink-0">{cfg.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-app-text">{s.label || cfg.label}</div>
                    {s.location && (
                      <div className="text-xs text-app-text-secondary mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location}</div>
                    )}
                    {s.notes && (
                      <div className="text-xs text-app-text-muted mt-0.5">{s.notes}</div>
                    )}
                    {s.photo_url && (
                      <Image
                        src={s.photo_url}
                        alt={s.label || cfg.label}
                        className="mt-2 rounded-lg w-full max-w-[200px] h-auto border border-app-border"
                        width={200}
                        height={150}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        quality={80}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Emergency Contacts */}
      <div>
        <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Emergency Contacts</h3>
        <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
          {contacts.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-app-text-muted">No emergency contacts added</p>
            </div>
          ) : (
            contacts.map((c) => (
              <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                <Phone className="w-5 h-5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-app-text">{c.label || 'Contact'}</div>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="text-xs text-blue-600 hover:underline">{c.phone}</a>
                  )}
                  {c.notes && <div className="text-xs text-app-text-muted mt-0.5">{c.notes}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Evacuation Plan */}
      <div>
        <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Evacuation Plan</h3>
        <div className="bg-app-surface rounded-xl border border-app-border shadow-sm">
          {plans.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-app-text-muted">No evacuation plan documented</p>
            </div>
          ) : (
            <div className="px-4 py-3 space-y-2">
              {plans.map((p) => (
                <div key={p.id}>
                  <div className="text-sm font-medium text-app-text">{p.label || 'Evacuation Plan'}</div>
                  {p.description && <div className="text-xs text-app-text-secondary mt-1 whitespace-pre-wrap">{p.description}</div>}
                  {p.notes && <div className="text-xs text-app-text-muted mt-1">{p.notes}</div>}
                  {p.photo_url && (
                    <Image
                      src={p.photo_url}
                      alt="Evacuation Plan"
                      className="mt-2 rounded-lg w-full max-w-[300px] h-auto border border-app-border"
                      width={300}
                      height={200}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      quality={80}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Other emergency items */}
      {other.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Other</h3>
          <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
            {other.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="text-sm font-medium text-app-text">{item.label || 'Emergency Item'}</div>
                {item.notes && <div className="text-xs text-app-text-muted mt-0.5">{item.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
