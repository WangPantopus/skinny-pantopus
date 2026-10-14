'use strict';

// Pure scope policy shared with query-only consumers. Home and ancestry reads
// are supplied by readAccess; a missing viewer has only public/legacy access.
function scopeAccessForHomes(userId, homes = { areas: [], verifiedAreaIds: new Set() }, loadTown) {
  const townIds = new Set(homes.areas.filter(area => area.kind === 'town'
    && homes.verifiedAreaIds.has(area.id)).map(area => area.id));
  // verified_area is the street/neighborhood wall. A malformed town/place
  // reference must not turn it into a broader grant.
  const areaIds = new Set(homes.areas.filter(area => ['street', 'neighborhood'].includes(area.kind)
    && homes.verifiedAreaIds.has(area.id)).map(area => area.id));
  const townLookups = new Map();
  function allows(post) {
    if (post.read_scope == null || (userId && post.user_id === userId)) return true;
    if (post.read_scope === 'public') return true;
    if (post.read_scope === 'verified_area') return areaIds.has(post.area_id);
    if (post.read_scope === 'verified_town') return townIds.has(post.pulse_post_town_id);
    return false;
  }
  async function canRead(post) {
    if (post.read_scope !== 'verified_town' || post.pulse_post_town_id !== undefined
      || (userId && post.user_id === userId)) return allows(post);
    if (!post.area_id || !townIds.size) return false;
    if (!townLookups.has(post.area_id)) {
      townLookups.set(post.area_id, loadTown(post.area_id));
    }
    return allows({ ...post, pulse_post_town_id: await townLookups.get(post.area_id) });
  }
  function query(q, referencedTable, jsonColumn) {
    const field = name => jsonColumn ? `${jsonColumn}->>${name}` : name;
    const scope = field('read_scope');
    const clauses = [`${scope}.is.null`, `${scope}.eq.public`];
    if (userId) clauses.push(`${field('user_id')}.eq.${userId}`);
    if (townIds.size) clauses.push(`and(${scope}.eq.verified_town,${field('pulse_post_town_id')}.in.(${[...townIds].join(',')}))`);
    if (areaIds.size) clauses.push(`and(${scope}.eq.verified_area,${field('area_id')}.in.(${[...areaIds].join(',')}))`);
    return q.or(clauses.join(','), referencedTable ? { referencedTable } : {});
  }
  return { allows, canRead, query };
}

module.exports = { scopeAccessForHomes };
