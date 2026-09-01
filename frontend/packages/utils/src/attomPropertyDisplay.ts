/**
 * Turns ATTOM property-suggestion / niche_data payloads into labeled sections for UI.
 * Works with any nested shape ATTOM returns — unknown keys still appear under catch-all sections.
 */

export type AttomDisplayRow = { label: string; value: string };

export type AttomDisplaySection = {
  id: string;
  title: string;
  rows: AttomDisplayRow[];
};

/** Minimal shape: matches {@link import('@pantopus/api').AttomPropertyDetailPayload} without importing api package */
export type AttomPayloadLike = {
  full_response?: Record<string, unknown> | null;
  status?: Record<string, unknown> | null;
  property?: Record<string, unknown> | null;
};

export function humanizeAttomKey(key: string): string {
  const spaced = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]/g, ' ');
  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatPrimitive(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number' && !Number.isFinite(v)) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function rowsFromNested(obj: Record<string, unknown>, parentLabel = ''): AttomDisplayRow[] {
  const rows: AttomDisplayRow[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const base = humanizeAttomKey(k);
    const label = parentLabel ? `${parentLabel} › ${base}` : base;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      rows.push(...rowsFromNested(v as Record<string, unknown>, label));
    } else if (Array.isArray(v)) {
      rows.push({
        label,
        value: v.length ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : formatPrimitive(x))).join(', ') : '—',
      });
    } else {
      rows.push({ label, value: formatPrimitive(v) });
    }
  }
  return rows;
}

function getFirstProperty(payload: AttomPayloadLike): Record<string, unknown> | null {
  const fr = payload.full_response as { property?: unknown[] } | undefined;
  if (Array.isArray(fr?.property) && fr.property[0] && typeof fr.property[0] === 'object' && !Array.isArray(fr.property[0])) {
    return fr.property[0] as Record<string, unknown>;
  }
  if (payload.property && typeof payload.property === 'object' && !Array.isArray(payload.property)) {
    return payload.property as Record<string, unknown>;
  }
  return null;
}

const TOP_PROPERTY_SECTIONS: { key: string; title: string }[] = [
  { key: 'identifier', title: 'Parcel & assessor ID' },
  { key: 'lot', title: 'Lot' },
  { key: 'area', title: 'Jurisdiction & tax area' },
  { key: 'address', title: 'Address (assessor)' },
  { key: 'location', title: 'Location & geoids' },
  { key: 'summary', title: 'Property classification' },
  { key: 'utilities', title: 'Utilities' },
  { key: 'vintage', title: 'Record dates' },
];

const BUILDING_SUBSECTIONS: { key: string; title: string }[] = [
  { key: 'size', title: 'Size' },
  { key: 'rooms', title: 'Rooms & baths' },
  { key: 'interior', title: 'Interior' },
  { key: 'construction', title: 'Construction' },
  { key: 'parking', title: 'Parking' },
  { key: 'summary', title: 'Style & quality' },
];

/**
 * Builds scrollable sections from ATTOM full_response / stored niche_data payload.
 */
export function buildAttomDisplaySections(attom: AttomPayloadLike | null | undefined): AttomDisplaySection[] {
  if (!attom) return [];

  const sections: AttomDisplaySection[] = [];
  const fr = attom.full_response as Record<string, unknown> | undefined;
  const status = (fr?.status ?? attom.status) as Record<string, unknown> | undefined;

  if (status && typeof status === 'object' && !Array.isArray(status)) {
    sections.push({
      id: 'status',
      title: 'Response & metadata',
      rows: rowsFromNested(status),
    });
  }

  const prop = getFirstProperty(attom);
  if (!prop) return sections;

  const usedTop = new Set<string>();

  for (const { key, title } of TOP_PROPERTY_SECTIONS) {
    const val = prop[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      usedTop.add(key);
      sections.push({
        id: key,
        title,
        rows: rowsFromNested(val as Record<string, unknown>),
      });
    }
  }

  const building = prop.building;
  if (building && typeof building === 'object' && !Array.isArray(building)) {
    usedTop.add('building');
    const b = building as Record<string, unknown>;
    const usedBuilding = new Set<string>();

    for (const { key, title } of BUILDING_SUBSECTIONS) {
      const val = b[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        usedBuilding.add(key);
        sections.push({
          id: `building.${key}`,
          title: `Building · ${title}`,
          rows: rowsFromNested(val as Record<string, unknown>),
        });
      }
    }

    for (const bk of Object.keys(b)) {
      if (usedBuilding.has(bk)) continue;
      const val = b[bk];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        sections.push({
          id: `building.${bk}`,
          title: `Building · ${humanizeAttomKey(bk)}`,
          rows: rowsFromNested(val as Record<string, unknown>),
        });
      }
    }
  }

  for (const pk of Object.keys(prop)) {
    if (usedTop.has(pk)) continue;
    const val = prop[pk];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      sections.push({
        id: pk,
        title: humanizeAttomKey(pk),
        rows: rowsFromNested(val as Record<string, unknown>),
      });
    }
  }

  return sections;
}
