// Restore the existing searchable Mail.content from its authoritative private
// letter object. Dry run by default; --apply writes only changed, readable rows.
// Run with the intended backend environment. Production execution belongs to
// the founder. Logs contain counts only, never letter text or storage addresses.
require('dotenv').config();
const db = require('../config/supabaseAdmin');
const { hydrateMail } = require('../services/mailObjectStorage');

async function backfill({ apply = false } = {}) {
  const stats = { scanned: 0, changed: 0, failed: 0 };
  let cursor = null;
  for (;;) {
    let query = db.from('Mail').select('id, object_id, content').not('object_id', 'is', null)
      .is('deleted_at', null).or('lifecycle.is.null,lifecycle.neq.shredded').order('id').limit(100);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw new Error('Could not read the mail batch.');
    if (!data?.length) break;
    for (const row of data) {
      stats.scanned += 1;
      try {
        const full = await hydrateMail(row);
        if (typeof full.content !== 'string' || full.content === row.content) continue;
        if (apply) {
          const written = await db.from('Mail').update({ content: full.content }).eq('id', row.id)
            .eq('object_id', row.object_id).is('deleted_at', null)
            .or('lifecycle.is.null,lifecycle.neq.shredded').select('id');
          if (written.error) throw new Error('Could not update the mail batch.');
          if (!written.data?.length) continue;
        }
        stats.changed += 1;
      } catch (_) { stats.failed += 1; }
    }
    cursor = data[data.length - 1].id;
  }
  return stats;
}

if (require.main === module) {
  backfill({ apply: process.argv.includes('--apply') }).then((stats) => {
    console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'dry-run', ...stats }));
    if (stats.failed) process.exitCode = 1;
  }).catch(() => {
    console.error('Mail search backfill could not finish. Check the selected backend environment and retry.');
    process.exitCode = 1;
  });
}

module.exports = { backfill };
