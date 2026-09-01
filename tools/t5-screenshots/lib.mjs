// Shared building blocks for the T5 design-reference snapshot harness.
// Hand-rolled HTML/SVG that mirrors the design package verbatim (same
// tokens, same geometry). Self-contained — no network deps.

export const P = {
  primary25:  '#f8fbff',
  primary50:  '#f0f9ff',
  primary100: '#e0f2fe',
  primary400: '#38bdf8',
  primary500: '#0ea5e9',
  primary600: '#0284c7',
  primary700: '#0369a1',
  bg:      '#f6f7f9',
  surface: '#ffffff',
  sunken:  '#f3f4f6',
  border:  '#e5e7eb',
  borderSubtle: '#f3f4f6',
  fg1: '#111827',
  fg2: '#374151',
  fg3: '#6b7280',
  fg4: '#9ca3af',
  successBg: '#d1fae5',
  success:   '#047857',
  warningBg: '#fef3c7',
  warning:   '#92400e',
  errorBg:   '#fee2e2',
  error:     '#b91c1c',
  homeBg: '#dcfce7',
  home:   '#16a34a',
  personalBg: '#dbeafe',
  personal:   '#1d4ed8',
  businessBg: '#f3e8ff',
  business:   '#7c3aed',
  slateBg: '#e2e8f0',
  slate:   '#334155',
  amberBg: '#fef3c7',
  amber:   '#b45309',
  rose: '#e11d48',
  roseBg: '#ffe4e6',
  violet: '#7c3aed',
  violetBg: '#ede9fe',
  teal: '#0d9488',
  tealBg: '#ccfbf1',
};

// Lucide-style stroke icons (24x24 viewBox). Minimal subset needed by T5.
// Kept inline so the harness has no remote deps.
const ICONS = {
  'chevron-left': '<polyline points="15 18 9 12 15 6"></polyline>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"></polyline>',
  'check': '<polyline points="20 6 9 17 4 12"></polyline>',
  'check-check': '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
  'x': '<path d="M18 6 6 18M6 6l12 12"/>',
  'plus': '<path d="M5 12h14M12 5v14"/>',
  'pen-line': '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/>',
  'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" x2="20" y1="8" y2="14"/><line x1="23" x2="17" y1="11" y2="11"/>',
  'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'users-round': '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  'send': '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  'briefcase': '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  'tag': '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/>',
  'shield-alert': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'badge-check': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  'at-sign': '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>',
  'inbox': '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
  'search': '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>',
  'more-horizontal': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'more-vertical': '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  'hammer': '<path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>',
  'sparkles': '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  'home': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  'paw-print': '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>',
  'cat': '<path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>',
  'receipt': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  'circle-dollar-sign': '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
  'building-2': '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  'compass': '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  'sliders-horizontal': '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><circle cx="12" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="20" r="2"/>',
  'calendar': '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  'sparkle': '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  'megaphone': '<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  'gift': '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C9 3 12 5 12 8h-4.5z"/><path d="M16.5 8a2.5 2.5 0 0 0 0-5C15 3 12 5 12 8h4.5z"/>',
  'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  'arrow-up-right': '<path d="M7 7h10v10"/><path d="m7 17 10-10"/>',
  'thumbs-up': '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l5.34-8 1.66 3.88"/>',
  // T6.0a Bills utility iconography + banner/auto-pay markers.
  'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  'droplet': '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  'wifi': '<path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><line x1="12" x2="12.01" y1="20" y2="20"/>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  'trash-2': '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  'smartphone': '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  'wallet': '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  'repeat': '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  'calendar-clock': '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/>',
  'hash': '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
};

export function icon(name, opts = {}) {
  const { size = 18, color = 'currentColor', stroke = 2, fill = 'none' } = opts;
  const body = ICONS[name];
  if (!body) throw new Error(`Unknown icon: ${name}`);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${body}</svg>`;
}

export function statusBar() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 28px 0;height:44px;box-sizing:border-box;font-family:-apple-system,system-ui;font-weight:600;font-size:15px;color:${P.fg1}">
      <span>9:41</span>
      <div style="display:flex;gap:5px;align-items:center">
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill="${P.fg1}"/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill="${P.fg1}"/><rect x="9" y="2" width="3" height="9" rx="0.6" fill="${P.fg1}"/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill="${P.fg1}"/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill="${P.fg1}"/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill="${P.fg1}"/><circle cx="7.5" cy="9" r="1.3" fill="${P.fg1}"/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke="${P.fg1}" stroke-opacity="0.35" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1.5" fill="${P.fg1}"/><path d="M22.5 3.8v3.4c.6-.2 1-.8 1-1.7s-.4-1.5-1-1.7z" fill="${P.fg1}" fill-opacity="0.4"/></svg>
      </div>
    </div>`;
}

// Android system bar: time on the left, battery + wifi on the right.
export function androidStatusBar() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px 0;height:32px;box-sizing:border-box;font-family:Roboto,system-ui;font-weight:500;font-size:13px;color:${P.fg1}">
      <span>9:41</span>
      <div style="display:flex;gap:6px;align-items:center">
        <svg width="14" height="10" viewBox="0 0 14 10"><path d="M7 1C9 1 10.8 1.7 12.1 3l.9-.9C11.5.7 9.4 0 7 0S2.5.7 1 2.1l.9.9C3.2 1.7 5 1 7 1z" fill="${P.fg1}"/><path d="M7 4c1.2 0 2.2.4 3 1.1l.9-.9C10.1 3.4 8.6 2.7 7 2.7s-3.1.7-3.9 1.5l.9.9C4.8 4.4 5.8 4 7 4z" fill="${P.fg1}"/><circle cx="7" cy="7.5" r="1.2" fill="${P.fg1}"/></svg>
        <svg width="22" height="10" viewBox="0 0 22 10"><rect x="0.5" y="0.5" width="19" height="9" rx="2" stroke="${P.fg1}" stroke-opacity="0.4" fill="none"/><rect x="2" y="2" width="14" height="6" rx="1" fill="${P.fg1}"/></svg>
      </div>
    </div>`;
}

export function topBar({ title, right = '', leading = 'back' }) {
  const leadingHtml = leading === 'back'
    ? `<button style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;cursor:pointer;color:${P.fg1};padding:0">${icon('chevron-left', { size: 22 })}</button>`
    : `<div style="width:36px;height:36px"></div>`;
  return `
    <div style="display:flex;align-items:center;padding:8px 12px;height:52px;box-sizing:border-box;background:${P.surface};border-bottom:1px solid ${P.border}">
      ${leadingHtml}
      <div style="flex:1;text-align:center;font-size:16px;font-weight:600;color:${P.fg1};letter-spacing:-0.2px">${title}</div>
      <div style="min-width:36px;height:36px;display:flex;align-items:center;justify-content:flex-end;padding:0 4px">${right}</div>
    </div>`;
}

export function tabStrip({ tabs, active = 0 }) {
  return `
    <div style="display:flex;background:${P.surface};border-bottom:1px solid ${P.border};padding:0 16px">
      ${tabs.map((t, i) => {
        const on = i === active;
        const fg = on ? P.primary600 : P.fg3;
        const w = on ? 600 : 500;
        const border = on ? `2px solid ${P.primary600}` : '2px solid transparent';
        return `<button style="flex:1;padding:12px 4px;background:transparent;border:none;border-bottom:${border};color:${fg};font-weight:${w};font-size:14px;cursor:pointer">${t}</button>`;
      }).join('')}
    </div>`;
}

export function chipStrip({ chips, active = 0 }) {
  return `
    <div style="display:flex;background:${P.surface};border-bottom:1px solid ${P.border};padding:10px 16px;gap:8px;overflow-x:auto">
      ${chips.map((c, i) => {
        const on = i === active;
        const bg = on ? P.primary600 : P.surface;
        const fg = on ? P.surface : P.fg2;
        const bd = on ? P.primary600 : P.border;
        return `<div style="padding:6px 12px;border:1px solid ${bd};background:${bg};color:${fg};font-size:13px;font-weight:500;border-radius:999px;white-space:nowrap;flex-shrink:0">${c}</div>`;
      }).join('')}
    </div>`;
}

export function searchBar({ placeholder = 'Search', value = '' }) {
  return `
    <div style="background:${P.surface};border-bottom:1px solid ${P.borderSubtle};padding:8px 16px">
      <div style="display:flex;align-items:center;gap:8px;background:${P.sunken};border-radius:8px;padding:8px 12px">
        ${icon('search', { size: 16, color: P.fg3 })}
        <input style="flex:1;background:transparent;border:none;outline:none;font-size:14px;color:${P.fg1}" placeholder="${placeholder}" value="${value}" />
      </div>
    </div>`;
}

export function fab({ kind = 'secondaryCreate', label, iconName = 'plus', tint = 'sky' }) {
  // canonicalCreate 56pt / secondaryCreate 52pt / extendedNav (pill, 48pt with label)
  // T6.0a — `tint` selects (background, shadow). `sky` is the default;
  // `home` and `business` swap to identity tokens.
  const tints = {
    sky: { bg: P.primary600, shadow: '0 6px 16px rgba(2,132,199,0.35)' },
    home: { bg: P.home, shadow: '0 6px 16px rgba(22,163,74,0.35)' },
    business: { bg: P.business, shadow: '0 6px 16px rgba(124,58,237,0.35)' },
  };
  const t = tints[tint] || tints.sky;
  if (kind === 'extendedNav') {
    return `
      <div style="position:absolute;right:20px;bottom:24px;z-index:5">
        <button style="height:48px;padding:0 22px;border-radius:24px;background:${t.bg};color:${P.surface};border:none;display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:15px;box-shadow:${t.shadow};cursor:pointer">
          ${icon(iconName, { size: 18, color: P.surface })}
          ${label}
        </button>
      </div>`;
  }
  const size = kind === 'canonicalCreate' ? 56 : 52;
  return `
    <div style="position:absolute;right:20px;bottom:24px;z-index:5">
      <button style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${t.bg};color:${P.surface};border:none;display:inline-flex;align-items:center;justify-content:center;box-shadow:${t.shadow};cursor:pointer">
        ${icon(iconName, { size: 22, color: P.surface })}
      </button>
    </div>`;
}

// Renders one mobile "phone" frame. Returns the *inside* HTML, sized to
// fit the viewport.
export function frame({ platform = 'ios', body }) {
  const isIOS = platform === 'ios';
  const isAndroid = platform === 'android';
  const sb = isIOS ? statusBar() : isAndroid ? androidStatusBar() : '';
  return `
    <div style="position:relative;background:${P.bg};min-height:100%;display:flex;flex-direction:column">
      ${sb}
      <div style="flex:1;display:flex;flex-direction:column;position:relative">
        ${body}
      </div>
    </div>`;
}

// Renders a complete HTML document for a single platform.
export function htmlDoc({ title, body, font = 'system-ui' }) {
  const fontStack = font === 'system-ui'
    ? '-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'
    : 'Roboto,system-ui,sans-serif';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  *,*::before,*::after { box-sizing: border-box; }
  html,body { margin:0; padding:0; background:${P.bg}; font-family:${fontStack}; color:${P.fg1}; }
  button { font-family: inherit; }
  ::-webkit-scrollbar { display:none; }
  input::placeholder { color: ${P.fg4}; }
</style></head><body>${body}</body></html>`;
}

// Renders a "parity composite" HTML: 3 phones side by side with platform
// labels under each.
export function parityComposite({ title, screenName, ios, android, web, caption }) {
  const phone = (label, viewportWidth, html) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
      <div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${P.fg3}">${label}</div>
      <div style="width:${viewportWidth}px;height:780px;background:${P.surface};border:1px solid ${P.border};border-radius:32px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08)">
        ${html}
      </div>
    </div>`;
  return htmlDoc({
    title: `${screenName} · parity`,
    body: `
      <div style="padding:32px 48px 24px;background:#fafafa;min-height:100vh">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${P.primary600};margin-bottom:6px">T5 · Cross-platform parity</div>
        <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.02em;margin:0 0 4px;color:${P.fg1}">${title}</h1>
        <p style="margin:0 0 24px;color:${P.fg3};font-size:13px;max-width:980px;line-height:1.5">${caption}</p>
        <div style="display:flex;gap:24px;justify-content:flex-start;align-items:flex-start">
          ${phone('iOS · 390pt', 390, ios)}
          ${phone('Android · 411dp', 411, android)}
          ${phone('Web · 400px', 400, web)}
        </div>
      </div>`,
  });
}
