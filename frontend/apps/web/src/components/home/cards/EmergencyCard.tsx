'use client';

import { type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Droplets, Flame, Zap, OctagonX, Siren, MapPin, Phone, ChevronLeft } from 'lucide-react';
import DashboardCard from '../DashboardCard';
import { emergencyCategory, emergencyDetail } from '../emergencyTypes';

// Keyed by the HomeEmergency.type values the column actually holds; the earlier
// water_main/gas_shutoff/electrical_panel keys never matched a row.
const SHUTOFF_TYPES: Record<string, { icon: ReactNode; label: string }> = {
  shutoff_water: { icon: <Droplets className="w-5 h-5" />, label: 'Water Main' },
  shutoff_gas: { icon: <Flame className="w-5 h-5" />, label: 'Gas Shutoff' },
  shutoff_electric: { icon: <Zap className="w-5 h-5" />, label: 'Electrical Panel' },
  breaker_map: { icon: <Zap className="w-5 h-5" />, label: 'Breaker Map' },
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
            const cfg = SHUTOFF_TYPES[e.type] || SHUTOFF_TYPES.other;
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
  homeId,
  onBack,
}: {
  emergencies: Record<string, any>[];
  home: Record<string, any>;
  homeId: string;
  onBack: () => void;
}) {
  const router = useRouter();

  // Categorize by the row's actual HomeEmergency.type (the card has no medical
  // section, so first-aid/extinguisher rows list under Other).
  const shutoffs = emergencies.filter((e) => emergencyCategory(e.type) === 'shutoff');
  const contacts = emergencies.filter((e) => emergencyCategory(e.type) === 'contact');
  const plans = emergencies.filter((e) => emergencyCategory(e.type) === 'evacuation');
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
          onClick={() => router.push(`/app/homes/${homeId}/emergency`)}
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
              const cfg = SHUTOFF_TYPES[s.type] || SHUTOFF_TYPES.other;
              const notes = emergencyDetail(s, 'notes') || emergencyDetail(s, 'detail');
              const photoUrl = emergencyDetail(s, 'photo_url');
              return (
                <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                  <span className="flex-shrink-0">{cfg.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-app-text">{s.label || cfg.label}</div>
                    {s.location && (
                      <div className="text-xs text-app-text-secondary mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location}</div>
                    )}
                    {notes && (
                      <div className="text-xs text-app-text-muted mt-0.5">{notes}</div>
                    )}
                    {photoUrl && (
                      <Image
                        src={photoUrl}
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
            contacts.map((c) => {
              const phone = emergencyDetail(c, 'phone');
              const notes = emergencyDetail(c, 'notes') || emergencyDetail(c, 'detail');
              return (
              <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                <Phone className="w-5 h-5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-app-text">{c.label || 'Contact'}</div>
                  {phone && (
                    <a href={`tel:${phone}`} className="text-xs text-blue-600 hover:underline">{phone}</a>
                  )}
                  {notes && <div className="text-xs text-app-text-muted mt-0.5">{notes}</div>}
                </div>
              </div>
              );
            })
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
              {plans.map((p) => {
                const description = emergencyDetail(p, 'detail') || emergencyDetail(p, 'description');
                const notes = emergencyDetail(p, 'notes');
                const photoUrl = emergencyDetail(p, 'photo_url');
                return (
                <div key={p.id}>
                  <div className="text-sm font-medium text-app-text">{p.label || 'Evacuation Plan'}</div>
                  {description && <div className="text-xs text-app-text-secondary mt-1 whitespace-pre-wrap">{description}</div>}
                  {notes && <div className="text-xs text-app-text-muted mt-1">{notes}</div>}
                  {photoUrl && (
                    <Image
                      src={photoUrl}
                      alt="Evacuation Plan"
                      className="mt-2 rounded-lg w-full max-w-[300px] h-auto border border-app-border"
                      width={300}
                      height={200}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      quality={80}
                    />
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Other emergency items */}
      {other.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Other</h3>
          <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
            {other.map((item) => {
              const notes = emergencyDetail(item, 'notes') || emergencyDetail(item, 'detail');
              return (
              <div key={item.id} className="px-4 py-3">
                <div className="text-sm font-medium text-app-text">{item.label || 'Emergency Item'}</div>
                {notes && <div className="text-xs text-app-text-muted mt-0.5">{notes}</div>}
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
