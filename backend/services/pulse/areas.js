'use strict';

const db = require('../../config/supabaseAdmin');
const { currentOccupancy, resolveHomeRole, NON_RESIDENT_ROLES } = require('../../utils/homeAccessPolicy');
const { isVerifiedResident } = require('../../utils/homePermissions');

const AREA_SELECT = 'id, kind, name, slug, parent_id, state, opened_at';
const HOME_SELECT = [
  'home_id', 'is_active', 'role', 'role_base', 'verification_status', 'verification_source',
  'verified_at', 'start_at', 'end_at', 'access_start_at', 'access_end_at', 'created_at',
  'home:home_id (id, home_status, security_state)',
].join(', ');
const NEARBY_METRES = 15 * 1609.344;

async function checked(query) {
  const result = await query;
  if (!result || result.error) throw result?.error || new Error('Pulse area lookup failed');
  return result.data;
}

function openAreas(query) {
  return query.not('opened_at', 'is', null).lte('opened_at', new Date().toISOString());
}

function eligibleHomeOccupancy(row) {
  return currentOccupancy(row) && !!resolveHomeRole(row)
    && !!row.home && !['archived', 'merged'].includes(row.home.home_status)
    && !['frozen', 'frozen_silent', 'disputed'].includes(row.home.security_state);
}

function verifiedHomeOccupancy(row) {
  return eligibleHomeOccupancy(row) && !NON_RESIDENT_ROLES.has(resolveHomeRole(row))
    && isVerifiedResident({ occupancy: row });
}

// Public area metadata only. Home ids, boundaries and measured distances never enter endpoint DTOs.
function areaDto(area) {
  return area ? { id: area.id, kind: area.kind, name: area.name, state: area.state, title: area.name } : null;
}

async function searchTowns(text) {
  const literal = text.replace(/[\\%_]/g, '\\$&');
  const rows = await checked(openAreas(db.from('PulseArea').select(AREA_SELECT))
    .eq('kind', 'town').ilike('name', `%${literal}%`).order('name').order('id').limit(20));
  return (rows || []).map(areaDto);
}

/** Current, server-derived homes and their open areas, shared by labels and read scopes.
 * Never accept a device point, a caller-supplied home id or a cached verification decision.
 * All verified homes contribute to reading; only the primary contributes to posting/defaults.
 */
async function homeAreaContext(userId) {
  if (!userId) return { homes: [], primary: null, areas: [], matches: [], verifiedAreaIds: new Set() };
  const [occupancies, preferences] = await Promise.all([
    checked(db.from('HomeOccupancy').select(HOME_SELECT).eq('user_id', userId)
      .eq('is_active', true).order('created_at').order('home_id')),
    // #2280 adds default_home_id here. Reading the existing preferences row keeps this
    // compatible before that column ships and follows the choice as soon as it does.
    checked(db.from('UserNotificationPreferences').select('*').eq('user_id', userId).maybeSingle()),
  ]);
  const homes = (occupancies || []).filter(eligibleHomeOccupancy)
    .map(row => ({ id: row.home_id, verified: verifiedHomeOccupancy(row),
      pendingPostcard: row.verification_status === 'pending_postcard' }));
  const primary = homes.find(home => home.id === preferences?.default_home_id) || homes[0] || null;
  if (!homes.length) return { homes, primary, areas: [], matches: [], verifiedAreaIds: new Set() };
  const matches = await checked(db.rpc('pulse_home_area_matches', { p_home_ids: homes.map(home => home.id) }));
  const ids = [...new Set((matches || []).map(match => match.area_id))];
  const areas = ids.length ? await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).in('id', ids)) : [];
  const verified = new Set(homes.filter(home => home.verified).map(home => home.id));
  const opened = new Set((areas || []).map(area => area.id));
  const verifiedAreaIds = new Set((matches || []).filter(match => match.inside === true
    && verified.has(match.home_id) && opened.has(match.area_id)).map(match => match.area_id));
  return { homes, primary, areas: areas || [], matches: matches || [], verifiedAreaIds };
}

async function myAreas(userId, loadedContext) {
  const context = loadedContext || await homeAreaContext(userId);
  const inside = new Set(context.matches.filter(match => match.home_id === context.primary?.id
    && match.inside === true).map(match => match.area_id));
  const available = context.areas.filter(area => inside.has(area.id));
  // Stable if administrative areas overlap. Streets and neighborhoods must belong to this town.
  const choose = kind => available.filter(area => area.kind === kind).sort((a, b) => a.slug.localeCompare(b.slug))[0];
  const town = choose('town');
  const child = kind => available.filter(area => area.kind === kind && area.parent_id === town?.id)
    .sort((a, b) => a.slug.localeCompare(b.slug))[0];
  const verified = context.primary?.verified === true;
  return { town: areaDto(town), neighborhood: verified ? areaDto(child('neighborhood')) : null,
    street: verified ? areaDto(child('street')) : null, home_verified: verified };
}

async function labelFor(author, areaId, context) {
  if (author.origin === 'curator') return 'pantopus';
  if (author.accountType === 'official') return 'official';
  if (author.identityType === 'business') return 'business';
  if (!areaId || !author.userId) return 'visitor';
  const homes = context || await homeAreaContext(author.userId);
  // Extra homes grant reading access only. Posting, limits and the author's label
  // always use their primary home (build spec §12, two homes).
  const matches = homes.matches.filter(match => match.area_id === areaId && match.home_id === homes.primary?.id);
  if (homes.primary?.verified && matches.some(match => match.inside === true)) return 'resident';
  if (homes.primary?.pendingPostcard && matches.some(match => match.inside === true)) return 'new_here';
  if (matches.some(match => Number.isFinite(match.distance_m) && match.distance_m <= NEARBY_METRES
    && homes.primary?.verified)) return 'nearby';
  return 'visitor';
}

module.exports = { AREA_SELECT, HOME_SELECT, areaDto, openAreas, searchTowns, homeAreaContext,
  myAreas, labelFor, eligibleHomeOccupancy, verifiedHomeOccupancy };
