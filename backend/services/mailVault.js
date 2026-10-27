/**
 * The Vault's folders (Mail tab, SRV-2). Me and Biz folders are each person's own (user_id). Home folders belong to
 * the Home (home_id): everyone who may read that Home's mail sees one cabinet, the same folders and the same filed
 * letters, and nobody else sees them. VaultFolder.user_id stays NOT NULL, so a Home folder records who made it.
 *
 * Until now each member got their own copy of the Home folders (and only for their first Home). Copies with the same
 * label in the same Home count as one folder: the oldest is the one shown, and letters filed in any copy show in it.
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const { visibleMailFilter, onlyDelivered } = require('../utils/homeMailAccess');

const SYSTEM_FOLDERS = {
  personal: [
    { label: 'Taxes', icon: '📋', color: '#1E40AF' },
    { label: 'Medical', icon: '🏥', color: '#065F46' },
    { label: 'School', icon: '🎓', color: '#6D28D9' },
    { label: 'Receipts', icon: '🧾', color: '#D97706' },
    { label: 'Bank', icon: '🏦', color: '#374151' },
  ],
  home: [
    { label: 'Utilities', icon: '⚡', color: '#065F46' },
    { label: 'Warranties', icon: '🔧', color: '#7C3AED' },
    { label: 'Permits', icon: '📜', color: '#B91C1C' },
    { label: 'HOA', icon: '🏘', color: '#0C4A6E' },
    { label: 'Mortgage', icon: '🏡', color: '#78350F' },
  ],
  business: [
    { label: 'Invoices', icon: '📩', color: '#1E40AF' },
    { label: 'Contracts', icon: '📝', color: '#065F46' },
    { label: 'Government', icon: '🏛', color: '#991B1B' },
    { label: 'Subscriptions', icon: '💳', color: '#7C3AED' },
  ],
};

const AUTO_RULES = {
  'personal:Taxes': [
    { field: 'sender_name', operator: 'contains', value: 'IRS' },
    { field: 'sender_trust', operator: 'equals', value: 'verified_gov' },
  ],
  'personal:Receipts': [
    { field: 'category', operator: 'equals', value: 'receipt' },
  ],
  'personal:Medical': [
    { field: 'keyword', operator: 'contains', value: 'EOB' },
    { field: 'keyword', operator: 'contains', value: 'explanation of benefits' },
  ],
  'personal:Bank': [
    { field: 'keyword', operator: 'contains', value: 'bank statement' },
  ],
  'home:Utilities': [
    { field: 'sender_trust', operator: 'equals', value: 'verified_utility' },
  ],
  'home:Warranties': [
    { field: 'keyword', operator: 'contains', value: 'warranty' },
    { field: 'keyword', operator: 'contains', value: 'manual' },
  ],
  'home:Permits': [
    { field: 'keyword', operator: 'contains', value: 'permit' },
    { field: 'keyword', operator: 'contains', value: 'variance' },
  ],
  'home:HOA': [
    { field: 'sender_name', operator: 'contains', value: 'HOA' },
  ],
  'home:Mortgage': [
    { field: 'keyword', operator: 'contains', value: 'mortgage' },
    { field: 'keyword', operator: 'contains', value: 'escrow' },
  ],
  'business:Invoices': [
    { field: 'category', operator: 'equals', value: 'invoice' },
    { field: 'category', operator: 'equals', value: 'receipt' },
  ],
  'business:Contracts': [
    { field: 'keyword', operator: 'contains', value: 'contract' },
    { field: 'keyword', operator: 'contains', value: 'NDA' },
    { field: 'keyword', operator: 'contains', value: 'agreement' },
  ],
  'business:Government': [
    { field: 'sender_trust', operator: 'equals', value: 'verified_gov' },
  ],
  'business:Subscriptions': [
    { field: 'keyword', operator: 'contains', value: 'subscription' },
    { field: 'keyword', operator: 'contains', value: 'renewal' },
  ],
};

const sameLabel = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const older = (a, b) => (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0) || String(a.id).localeCompare(String(b.id));

/** The person's own Me and Biz system folders, and each readable Home's, created once if missing. */
async function ensureSystemFolders(userId, homeIds) {
  const [{ data: own }, { data: homes }] = await Promise.all([
    supabaseAdmin.from('VaultFolder').select('id, drawer, label').eq('user_id', userId).eq('system', true)
      .in('drawer', ['personal', 'business']),
    homeIds.length
      ? supabaseAdmin.from('VaultFolder').select('id, home_id, label').eq('drawer', 'home').eq('system', true).in('home_id', homeIds)
      : Promise.resolve({ data: [] }),
  ]);
  const ownSet = new Set((own || []).map((f) => `${f.drawer}:${f.label}`));
  const homeSet = new Set((homes || []).map((f) => `${f.home_id}:${f.label}`));
  const inserts = [];
  const add = (drawer, folder, i, homeId) => inserts.push({
    user_id: userId, home_id: homeId, drawer, label: folder.label, icon: folder.icon, color: folder.color,
    system: true, sort_order: i, auto_file_rules: AUTO_RULES[`${drawer}:${folder.label}`] || [],
  });
  for (const drawer of ['personal', 'business']) {
    SYSTEM_FOLDERS[drawer].forEach((f, i) => { if (!ownSet.has(`${drawer}:${f.label}`)) add(drawer, f, i, null); });
  }
  for (const homeId of homeIds) {
    SYSTEM_FOLDERS.home.forEach((f, i) => { if (!homeSet.has(`${homeId}:${f.label}`)) add('home', f, i, homeId); });
  }
  if (inserts.length) await supabaseAdmin.from('VaultFolder').insert(inserts);
}

// A Home's folders by label: the one shown (oldest) and every copy's id.
function groupHomeFolders(rows) {
  const groups = [];
  for (const row of [...rows].sort(older)) {
    const group = groups.find((g) => g.folder.home_id === row.home_id && sameLabel(g.folder.label, row.label));
    if (group) group.ids.push(row.id); else groups.push({ folder: row, ids: [row.id] });
  }
  return groups;
}

/**
 * The folders this person sees: their own Me and Biz folders and the folders of the Homes whose mail they may read,
 * each with item_count = the filed letters in it they can read. `drawer` narrows to one drawer.
 */
async function readableFolders(userId, homeIds, { drawer } = {}) {
  let ownQuery = supabaseAdmin.from('VaultFolder').select('*').eq('user_id', userId).in('drawer', ['personal', 'business']);
  if (drawer) ownQuery = ownQuery.eq('drawer', drawer);
  const wantHome = homeIds.length && (!drawer || drawer === 'home');
  const [{ data: own, error: ownError }, { data: homeRows, error: homeError }] = await Promise.all([
    drawer === 'home' ? Promise.resolve({ data: [] }) : ownQuery,
    wantHome ? supabaseAdmin.from('VaultFolder').select('*').eq('drawer', 'home').in('home_id', homeIds) : Promise.resolve({ data: [] }),
  ]);
  if (ownError || homeError) throw new Error((ownError || homeError).message);
  const groups = [...(own || []).map((f) => ({ folder: f, ids: [f.id] })), ...groupHomeFolders(homeRows || [])];
  const counts = await filedCounts(groups, userId, homeIds);
  const folders = groups.map((g) => ({ ...g.folder, item_count: counts.get(g.folder.id) || 0 }))
    .sort((a, b) => Number(b.system) - Number(a.system) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return folders;
}

async function filedCounts(groups, userId, homeIds) {
  const owner = new Map();
  for (const g of groups) for (const id of g.ids) owner.set(id, g.folder.id);
  const counts = new Map();
  if (!owner.size) return counts;
  const { data, error } = await onlyDelivered(supabaseAdmin.from('Mail').select('vault_folder_id')
    .in('vault_folder_id', [...owner.keys()]).eq('lifecycle', 'filed').is('deleted_at', null)
    .or(visibleMailFilter(userId, homeIds)));
  if (error) throw new Error(error.message);
  for (const row of data || []) {
    const shown = owner.get(row.vault_folder_id);
    counts.set(shown, (counts.get(shown) || 0) + 1);
  }
  return counts;
}

/**
 * A folder this person may use: their own Me or Biz folder, or a folder of a Home whose mail they may read. Answers
 * { folder (the one shown), ids (it and its copies) } or null.
 */
async function resolveFolder(folderId, userId, homeIds) {
  if (!folderId || !/^[0-9a-f-]{36}$/i.test(String(folderId))) return null;
  const { data: folder, error } = await supabaseAdmin.from('VaultFolder').select('*').eq('id', folderId).maybeSingle();
  if (error || !folder) return null;
  if (folder.drawer !== 'home') return folder.user_id === userId ? { folder, ids: [folder.id] } : null;
  if (!folder.home_id || !homeIds.includes(folder.home_id)) return null;
  const { data: copies } = await supabaseAdmin.from('VaultFolder').select('*').eq('drawer', 'home').eq('home_id', folder.home_id);
  const group = groupHomeFolders(copies || [folder]).find((g) => g.ids.includes(folder.id));
  return group || { folder, ids: [folder.id] };
}

/** Whether a piece may go in this folder: a Home letter in its own Home's folder, other mail in its drawer's folder. */
function folderFits(resolved, mail) {
  const folder = resolved?.folder;
  if (!folder || !mail) return false;
  if (folder.drawer === 'home') return Boolean(mail.recipient_home_id) && folder.home_id === mail.recipient_home_id
    && (mail.drawer || 'personal') === 'home';
  return folder.drawer === (mail.drawer || 'personal');
}

module.exports = { SYSTEM_FOLDERS, AUTO_RULES, ensureSystemFolders, readableFolders, resolveFolder, folderFits };
