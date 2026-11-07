'use strict';

/**
 * `Home.niche_data` holds things different writers keep at different moments: the
 * county record's copy, the stored ATTOM copy and the household's own entries. A
 * refresh can take a while, so a writer that replaced the whole object with what it
 * read earlier would erase whatever landed in between. Each writer changes only its
 * own key here, on the row as it stands, and writes only if the row hasn't changed
 * since (every update to Home moves `updated_at`).
 */

const supabaseAdmin = require('../config/supabaseAdmin');

const ATTEMPTS = 8;
const pause = () => new Promise((resolve) => { setTimeout(resolve, 10 + Math.random() * 90); });

/**
 * @param {string} homeId
 * @param {(nicheData: object) => object|null} change Gets a copy of what's stored now and returns what to store, or null to write nothing.
 * @returns {Promise<object|null>} What's stored after the write; null when the Home is gone or `change` wrote nothing.
 */
async function changeNicheData(homeId, change) {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const { data: row, error } = await supabaseAdmin.from('Home').select('niche_data, updated_at').eq('id', homeId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const stored = row.niche_data && typeof row.niche_data === 'object' && !Array.isArray(row.niche_data) ? row.niche_data : {};
    const next = change({ ...stored });
    if (!next) return null;
    const { data: written, error: writeError } = await supabaseAdmin.from('Home').update({ niche_data: next })
      .eq('id', homeId).eq('updated_at', row.updated_at).select('id');
    if (writeError) throw new Error(writeError.message);
    if (written?.length) return next;
    await pause();
  }
  throw new Error('Home details kept changing during a write');
}

module.exports = { changeNicheData };
