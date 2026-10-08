const { localDisplayNames } = require('./identityProfiles');

// The residency queue, the review history and member removal name people by @username only, and installed apps
// check those shapes key by key. Clients that also understand an optional `display_name` send this header, so
// apps that don't keep getting the shape they check.
function wantsDisplayNames(req) {
  return req.headers?.['x-pantopus-display-names'] === '1';
}

/**
 * Adds `display_name` to each person: the name they already show neighbors (identityProfiles.localDisplayNames),
 * or null when they have none. Throws on a read error, so the household read fails closed like its other reads.
 *
 * @param {Array<{ id: string } | null>} people
 */
async function addDisplayNames(people) {
  const present = people.filter(Boolean);
  if (present.length === 0) return;
  const names = await localDisplayNames(present.map((person) => person.id));
  for (const person of present) person.display_name = names.get(String(person.id)) ?? null;
}

module.exports = { wantsDisplayNames, addDisplayNames };
