import type { HomeEmergencyType } from '@pantopus/types';

// HomeEmergency.type only ever holds the HomeEmergencyType values (the
// HomeEmergency_type_chk constraint). The members' Emergency page and the
// dashboard card group them into the five design categories those screens
// already render; this is the same rollup the native EmergencyCategoryPalette
// applies (shutoffs, contacts, evacuation, medical, other). Shared by the three
// web readers so none of them keeps a private list of values the column never
// contains.
export type EmergencyCategory = 'shutoff' | 'contact' | 'evacuation' | 'medical' | 'other';

export const EMERGENCY_CATEGORY_OF: Record<HomeEmergencyType, EmergencyCategory> = {
  shutoff_water: 'shutoff', shutoff_gas: 'shutoff', shutoff_electric: 'shutoff', breaker_map: 'shutoff',
  emergency_contacts: 'contact',
  evac_plan: 'evacuation',
  first_aid: 'medical', extinguisher: 'medical',
  other: 'other',
};

// The native Add Emergency forms send these form categories as `type`. The
// column refuses them today (reproduced 2026-09-16); once the constraint admits
// them they roll up the way the native palette rolls them up.
const NATIVE_FORM_CATEGORY_OF: Record<string, EmergencyCategory> = {
  allergy: 'medical', medical_condition: 'medical', medication: 'medical', pet_medical: 'medical',
  contact: 'contact', power_of_attorney: 'contact',
};

export function emergencyCategory(type: unknown): EmergencyCategory {
  if (typeof type !== 'string') return 'other';
  return EMERGENCY_CATEGORY_OF[type as HomeEmergencyType] || NATIVE_FORM_CATEGORY_OF[type] || 'other';
}

// What the page's create form saves for each design category. Shutoffs need
// the exact utility, which is why the form asks for it.
export const SHUTOFF_KINDS: { type: HomeEmergencyType; label: string }[] = [
  { type: 'shutoff_water', label: 'Water' },
  { type: 'shutoff_gas', label: 'Gas' },
  { type: 'shutoff_electric', label: 'Electric' },
  { type: 'breaker_map', label: 'Breaker map' },
];
export const CATEGORY_CREATE_TYPE: Record<Exclude<EmergencyCategory, 'shutoff'>, HomeEmergencyType> = {
  contact: 'emergency_contacts',
  evacuation: 'evac_plan',
  medical: 'first_aid',
  other: 'other',
};

// `details` is a free-form jsonb object (the native forms write phone, notes
// and detail keys). Read one string out of it; never render the object itself.
export function emergencyDetail(row: { details?: unknown }, key: string): string {
  const details = row.details;
  if (!details || typeof details !== 'object' || Array.isArray(details)) return '';
  const value = (details as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}
