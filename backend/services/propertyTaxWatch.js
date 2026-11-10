'use strict';

/**
 * The Home Money Check's yearly watch: tells a house's confirmed owner, once for each year of county values, when the
 * county values their home above similar houses on its street (propertyRecords/similarHomes.js). A county's new roll
 * reaches a Home through its release, so the week it arrives is the week the owner hears. Nothing is said for a home
 * near or below its neighbors, and nothing twice for the same year: the notification's own key is the claim, so
 * several servers running this send one.
 *
 * Only in counties with similar homes switched on, and only to the owner whose ownership is confirmed, as on Place.
 * Words state the county's figures: never "you should appeal", never a saving.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const config = require('../config/propertyRecords');
const router = require('./propertyRecords/router');
const homeRecords = require('./propertyRecords/homeRecord');
const similarHomes = require('./propertyRecords/similarHomes');
const notificationService = require('./notificationService');

const BATCH_SIZE = 500;
const HOME_SELECT = 'id, owner_id, ownership_state, address, address2, city, state, zipcode, niche_data';

/** What the owner is told, from the comparison. Pure, so its words can be read without a database. */
function notice(home, found) {
  const year = found.value_year ? `${found.value_year} ` : '';
  return {
    userId: home.owner_id,
    type: 'property_tax_check',
    title: 'The county values your home above similar homes',
    body: `The county's ${year}value for your home is ${found.pct}% above similar homes on your street, per square foot. See the comparison.`,
    icon: '🏛️',
    // The link both phone apps and the web resolve to Place's money page (as the rate watch's).
    link: '/place?section=money',
    metadata: { home_id: home.id, value_year: found.value_year || null, pct: found.pct, homes: found.homes },
    idempotencyKey: `property_tax_check:${home.id}:${home.owner_id}:${found.value_year || 'year'}`,
  };
}

/**
 * Looks at every confirmed owner's house in the switched-on counties and tells the ones above their neighbors.
 * @returns {Promise<{homes: number, above: number, told: number}>}
 */
async function evaluate() {
  const counties = config.enabled() ? router.similarHomesCounties() : [];
  if (!counties.length) return { homes: 0, above: 0, told: 0 };
  let homes = 0;
  let above = 0;
  let told = 0;
  // Paged by id: an unpaged read stops at the server's row cap and would leave the rest out without a word.
  for (let after = null; ;) {
    let query = supabaseAdmin.from('Home').select(HOME_SELECT)
      .not('owner_id', 'is', null)
      .eq('ownership_state', 'owner_verified')
      .in('niche_data->property_record->>jurisdiction', counties)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);
    if (after) query = query.gt('id', after);
    const { data: page, error } = await query;
    if (error) {
      logger.warn('propertyTaxWatch: scan failed', { error: error.message });
      break;
    }
    for (const home of page || []) {
      homes += 1;
      const found = await similarHomes.forHome(home, homeRecords.liveCopy(home));
      if (!found || found.stance !== 'above') continue;
      above += 1;
      // Null when this year's notice was already written (or the owner turned home reminders off).
      if (await notificationService.createNotification(notice(home, found))) told += 1;
    }
    if (!page || page.length < BATCH_SIZE) break;
    after = page[page.length - 1].id;
  }
  logger.info('propertyTaxWatch: evaluation complete', { counties: counties.length, homes, above, told });
  return { homes, above, told };
}

module.exports = { evaluate, notice };
