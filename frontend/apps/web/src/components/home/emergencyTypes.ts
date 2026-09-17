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
  // The six categories the native Add Emergency forms send (admitted by
  // migration 20260916011000), rolled up the way the native palette rolls them.
  allergy: 'medical', medical_condition: 'medical', medication: 'medical', pet_medical: 'medical',
  contact: 'contact', power_of_attorney: 'contact',
};

export function emergencyCategory(type: unknown): EmergencyCategory {
  if (typeof type !== 'string') return 'other';
  return EMERGENCY_CATEGORY_OF[type as HomeEmergencyType] || 'other';
}

// What the page's create form saves for each design category. Shutoffs are
// stored per utility and have no create mapping until a utility choice is
// approved for the form.
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
